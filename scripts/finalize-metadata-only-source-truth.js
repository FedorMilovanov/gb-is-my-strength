#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const changed = [];
const problems = [];

const GILL_SLUGS = [
  'dzhon-gill-istoricheskiy-kontekst',
  'dzhon-gill-chast-1-chelovek',
  'dzhon-gill-chast-2-uchenyi',
  'dzhon-gill-chast-4-ekzeget',
  'dzhon-gill-chast-3-nasledie',
  'dzhon-gill-spravochnik',
];

function abs(rel) { return path.join(ROOT, rel); }
function read(rel) { return fs.readFileSync(abs(rel), 'utf8'); }
function apply(rel, next) {
  const before = read(rel);
  if (before === next) return;
  if (!WRITE) {
    problems.push(`${rel}: requires source-truth normalization`);
    return;
  }
  fs.writeFileSync(abs(rel), next, 'utf8');
  changed.push(rel);
}
function replaceRequired(text, search, replacement, label) {
  if (!text.includes(search)) throw new Error(`Required text not found: ${label}`);
  return text.replace(search, replacement);
}

// 1. Content schema: explicit universal distinction between rendered entries and
// metadata-only reference entries.
{
  const rel = 'src/content.config.ts';
  let text = read(rel);
  if (!text.includes("sourceMode: z.enum(['rendered', 'metadata-only'])")) {
    text = replaceRequired(
      text,
      '  readingTime: z.number().int().positive().optional(),\n',
      "  readingTime: z.number().int().positive().optional(),\n  sourceMode: z.enum(['rendered', 'metadata-only']).default('rendered'),\n",
      'content sourceMode schema',
    );
  }
  apply(rel, text);
}

// 2. Gill MDX files are metadata/reference records only. Remove the stale body
// so there is one editorial source: the strict-native Astro route graph.
for (const slug of GILL_SLUGS) {
  const rel = `src/content/articles/${slug}.mdx`;
  const source = read(rel).replace(/\r\n/g, '\n');
  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error(`Invalid frontmatter envelope: ${rel}`);
  let frontmatter = match[1];
  if (!/^sourceMode:\s*["']metadata-only["']\s*$/m.test(frontmatter)) {
    frontmatter = `${frontmatter}\nsourceMode: "metadata-only"`;
  }
  const next = `---\n${frontmatter}\n---\n\n<!-- Metadata-only reference entry. The public article is rendered from the strict-native route source declared in the effective route registry. -->\n`;
  apply(rel, next);
}

// 3. Catalog times come from data/series.json instead of duplicated literals.
{
  const rel = 'src/components/articles/ArticlesMain.astro';
  let text = read(rel);
  if (!text.includes("const gill = seriesData['dzhon-gill'];")) {
    text = replaceRequired(
      text,
      'const nagornaya = seriesData.nagornaya;\n',
      "const nagornaya = seriesData.nagornaya;\nconst gill = seriesData['dzhon-gill'];\nconst gillReadingTime = Object.fromEntries(\n  gill.parts.map((part) => [part.slug, part.readingTime]),\n);\n",
      'Gill series derivation in ArticlesMain',
    );
  }
  if (!text.includes('gillReadingTime={gillReadingTime}')) {
    text = replaceRequired(
      text,
      '  nagornayaPartsLabel={nagornayaPartsLabel}\n',
      '  nagornayaPartsLabel={nagornayaPartsLabel}\n  gillReadingTime={gillReadingTime}\n',
      'Gill reading-time prop',
    );
  }
  apply(rel, text);
}

{
  const rel = 'src/components/articles/ArticlesPublicationsSection.astro';
  let text = read(rel);
  if (!text.includes('gillReadingTime: Record<string, number>;')) {
    text = replaceRequired(
      text,
      '  nagornayaPartsLabel: string;\n',
      '  nagornayaPartsLabel: string;\n  gillReadingTime: Record<string, number>;\n',
      'Gill reading-time props interface',
    );
  }
  text = replaceRequired(
    text,
    'const { hardTextsPartsLabel, nagornayaPartsLabel } = Astro.props;\n',
    'const { hardTextsPartsLabel, nagornayaPartsLabel, gillReadingTime } = Astro.props;\n',
    'Gill reading-time prop destructuring',
  );
  text = replaceRequired(
    text,
    '                     16 мин\n',
    "                     {gillReadingTime['dzhon-gill-istoricheskiy-kontekst']} мин\n",
    'Gill context catalog time',
  );
  text = replaceRequired(
    text,
    '                <p class="h-article-abstract">Акт о единообразии, правовое положение диссентеров, Хорслидаун, Goat’s Yard, Картер-Лейн и книжная культура — исторический фон, без которого биография Гилла теряет объём и напряжение.</p>\n',
    '                <p class="h-article-abstract">Англия после Акта о единообразии: условная терпимость, гражданские и университетские ограничения, диссентерские академии, Саутварк и книжная культура XVIII века.</p>\n',
    'Gill context catalog abstract',
  );
  text = replaceRequired(
    text,
    '<span class="h-meta-time">8 мин</span>',
    "<span class=\"h-meta-time\">{gillReadingTime['dzhon-gill-spravochnik']} мин</span>",
    'Gill reference catalog time',
  );
  text = replaceRequired(
    text,
    '                <p class="h-article-abstract">Справочное приложение: даты, труды, Body of Divinity, PRDL, сеть влияний и спорные темы наследия Гилла.</p>\n',
    '                <p class="h-article-abstract">Хронология жизни и изданий, основные труды, структура Body of Divinity, источники, спорные темы и богословский словарь эпохи.</p>\n',
    'Gill reference catalog abstract',
  );
  apply(rel, text);
}

// 4. Existing route-source contract validates the universal metadata-only mode.
{
  const rel = 'scripts/lib/route-source-contract.js';
  let text = read(rel);
  if (!text.includes('function inspectReferenceContent(rel)')) {
    text = replaceRequired(
      text,
      "function stripComments(source) {\n  return String(source || '')\n    .replace(/<!--[\\s\\S]*?-->/g, ' ')\n    .replace(/\\/\\*[\\s\\S]*?\\*\\//g, ' ')\n    .replace(/(^|[^:])\\/\\/.*$/gm, '$1 ');\n}\n",
      "function stripComments(source) {\n  return String(source || '')\n    .replace(/<!--[\\s\\S]*?-->/g, ' ')\n    .replace(/\\/\\*[\\s\\S]*?\\*\\//g, ' ')\n    .replace(/(^|[^:])\\/\\/.*$/gm, '$1 ');\n}\n\nfunction inspectReferenceContent(rel) {\n  if (!existsRel(rel)) return null;\n  const source = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\\r\\n/g, '\\n');\n  const match = source.match(/^---\\n([\\s\\S]*?)\\n---\\n?([\\s\\S]*)$/);\n  if (!match) return { sourceMode: '', body: source, validFrontmatter: false };\n  const sourceMode = match[1].match(/^sourceMode:\\s*[\"']([^\"']+)[\"']\\s*$/m)?.[1] || '';\n  return { sourceMode, body: match[2], validFrontmatter: true };\n}\n",
      'reference content inspector',
    );
  }
  if (!text.includes('metadata-only reference MDX contains substantive body content')) {
    text = replaceRequired(
      text,
      "      if (inspection.mdxImports.some((item) => item.resolved === profile.mdxPath)) {\n        issue('reference-only MDX is imported by the public route graph');\n      }\n",
      "      if (inspection.mdxImports.some((item) => item.resolved === profile.mdxPath)) {\n        issue('reference-only MDX is imported by the public route graph');\n      }\n      const referenceContent = inspectReferenceContent(profile.mdxPath);\n      if (referenceContent?.sourceMode === 'metadata-only') {\n        if (!referenceContent.validFrontmatter) issue('metadata-only reference MDX has invalid frontmatter envelope');\n        if (stripComments(referenceContent.body).trim()) {\n          issue('metadata-only reference MDX contains substantive body content');\n        }\n      }\n",
      'metadata-only reference validation',
    );
  }
  if (!text.includes('  inspectReferenceContent,\n')) {
    text = replaceRequired(
      text,
      '  inspectRouteSource,\n',
      '  inspectRouteSource,\n  inspectReferenceContent,\n',
      'metadata-only helper export',
    );
  }
  apply(rel, text);
}

// 5. Strengthen the Gill reading-time audit so the native catalog cannot drift.
{
  const rel = 'scripts/gill-reading-time-canonical-audit.js';
  let text = read(rel);
  if (!text.includes('Gill catalog reading-time bindings')) {
    const anchor = "for (const slug of GILL_ORDER) {\n  const rel = `articles/${slug}/index.html`;\n  const txt = read(rel);\n  const expected = canonical[slug];\n  if (new RegExp(`\\\\b${expected}\\\\s*мин`).test(txt)) ok(`${rel}: contains canonical ${expected} мин`);\n  else bad(`${rel}: missing canonical ${expected} мин`);\n}\n";
    const extra = '\n// Gill catalog reading-time bindings: /articles/ must project data/series.json.\nconst catalogMain = read(\'src/components/articles/ArticlesMain.astro\');\nconst catalogCards = read(\'src/components/articles/ArticlesPublicationsSection.astro\');\nif (catalogMain.includes("const gill = seriesData[\'dzhon-gill\'];") && catalogMain.includes(\'gillReadingTime={gillReadingTime}\')) ok(\'articles catalog derives Gill reading times from series.json\');\nelse bad(\'articles catalog does not derive Gill reading times from series.json\');\nfor (const slug of [\'dzhon-gill-istoricheskiy-kontekst\', \'dzhon-gill-spravochnik\']) {\n  const binding = `gillReadingTime[\'${slug}\']`;\n  if (catalogCards.includes(binding)) ok(`articles catalog binding: ${slug}`);\n  else bad(`articles catalog missing canonical binding: ${slug}`);\n}\nif (/\\b(?:16|8)\\s*мин\\b/.test(catalogCards)) bad(\'articles catalog retains stale Gill 16/8 minute literal\');\nelse ok(\'articles catalog has no stale Gill 16/8 minute literals\');\n';
    text = replaceRequired(text, anchor, `${anchor}${extra}`, 'Gill catalog contract');
  }
  apply(rel, text);
}

if (problems.length) {
  console.error(`❌ Source-truth normalization required (${problems.length} files)`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
console.log(`✅ Source-truth normalization ${WRITE ? 'applied' : 'already canonical'}`);
if (changed.length) console.log(changed.map((rel) => `- ${rel}`).join('\n'));
