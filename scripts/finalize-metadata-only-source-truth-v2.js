#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const changed = [];
const pending = [];
const slugs = [
  'dzhon-gill-istoricheskiy-kontekst',
  'dzhon-gill-chast-1-chelovek',
  'dzhon-gill-chast-2-uchenyi',
  'dzhon-gill-chast-4-ekzeget',
  'dzhon-gill-chast-3-nasledie',
  'dzhon-gill-spravochnik',
];

const file = (rel) => path.join(ROOT, rel);
const read = (rel) => fs.readFileSync(file(rel), 'utf8');
function write(rel, next) {
  const prev = read(rel);
  if (prev === next) return;
  if (WRITE) {
    fs.writeFileSync(file(rel), next, 'utf8');
    changed.push(rel);
  } else pending.push(rel);
}
function requireChange(before, after, label) {
  if (before === after) throw new Error(`No change for ${label}`);
  return after;
}

{
  const rel = 'src/content.config.ts';
  let text = read(rel);
  if (!text.includes("sourceMode: z.enum(['rendered', 'metadata-only'])")) {
    text = requireChange(text, text.replace(
      /(\s+readingTime:\s*z\.number\(\)\.int\(\)\.positive\(\)\.optional\(\),\n)/,
      "$1  sourceMode: z.enum(['rendered', 'metadata-only']).default('rendered'),\n",
    ), 'sourceMode schema');
  }
  write(rel, text);
}

for (const slug of slugs) {
  const rel = `src/content/articles/${slug}.mdx`;
  const source = read(rel).replace(/\r\n/g, '\n');
  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error(`Invalid frontmatter: ${rel}`);
  let fm = match[1].replace(/^sourceMode:.*\n?/m, '').replace(/\n+$/, '');
  fm += '\nsourceMode: "metadata-only"';
  write(rel, `---\n${fm}\n---\n\n<!-- Metadata-only reference entry. The public article is rendered from the strict-native route source declared in the effective route registry. -->\n`);
}

{
  const rel = 'src/components/articles/ArticlesMain.astro';
  let text = read(rel);
  if (!text.includes("const gill = seriesData['dzhon-gill'];")) {
    text = requireChange(text, text.replace(
      /(const nagornaya = seriesData\.nagornaya;\n)/,
      "$1const gill = seriesData['dzhon-gill'];\nconst gillReadingTime = Object.fromEntries(\n  gill.parts.map((part) => [part.slug, part.readingTime]),\n);\n",
    ), 'Gill map in ArticlesMain');
  }
  if (!text.includes('gillReadingTime={gillReadingTime}')) {
    text = requireChange(text, text.replace(
      /(\s+nagornayaPartsLabel=\{nagornayaPartsLabel\}\n)/,
      '$1  gillReadingTime={gillReadingTime}\n',
    ), 'Gill prop in ArticlesMain');
  }
  write(rel, text);
}

{
  const rel = 'src/components/articles/ArticlesPublicationsSection.astro';
  let text = read(rel);
  if (!text.includes('gillReadingTime: Record<string, number>;')) {
    text = requireChange(text, text.replace(
      /(\s+nagornayaPartsLabel:\s*string;\n)/,
      '$1  gillReadingTime: Record<string, number>;\n',
    ), 'Gill prop type');
  }
  if (!text.includes('nagornayaPartsLabel, gillReadingTime')) {
    text = requireChange(text, text.replace(
      /const \{ hardTextsPartsLabel, nagornayaPartsLabel \} = Astro\.props;/,
      'const { hardTextsPartsLabel, nagornayaPartsLabel, gillReadingTime } = Astro.props;',
    ), 'Gill prop destructuring');
  }
  if (!text.includes("gillReadingTime['dzhon-gill-istoricheskiy-kontekst']")) {
    text = requireChange(text, text.replace(
      /(<a href="dzhon-gill-istoricheskiy-kontekst\/"[\s\S]*?<span class="h-meta-time">[\s\S]*?)(?:16)(\s*мин)/,
      "$1{gillReadingTime['dzhon-gill-istoricheskiy-kontekst']}$2",
    ), 'context catalog time');
  }
  if (!text.includes("gillReadingTime['dzhon-gill-spravochnik']")) {
    text = requireChange(text, text.replace(
      /(<a href="dzhon-gill-spravochnik\/"[\s\S]*?<span class="h-meta-time">)(?:8)(\s*мин)/,
      "$1{gillReadingTime['dzhon-gill-spravochnik']}$2",
    ), 'reference catalog time');
  }
  text = text.replace(
    'Акт о единообразии, правовое положение диссентеров, Хорслидаун, Goat’s Yard, Картер-Лейн и книжная культура — исторический фон, без которого биография Гилла теряет объём и напряжение.',
    'Англия после Акта о единообразии: условная терпимость, гражданские и университетские ограничения, диссентерские академии, Саутварк и книжная культура XVIII века.',
  );
  text = text.replace(
    'Справочное приложение: даты, труды, Body of Divinity, PRDL, сеть влияний и спорные темы наследия Гилла.',
    'Хронология жизни и изданий, основные труды, структура Body of Divinity, источники, спорные темы и богословский словарь эпохи.',
  );
  write(rel, text);
}

{
  const rel = 'scripts/lib/route-source-contract.js';
  let text = read(rel);
  if (!text.includes('function inspectReferenceContent(rel)')) {
    const marker = '\nfunction hasUnsafeSetHtml(source) {';
    const helper = `\nfunction inspectReferenceContent(rel) {\n  if (!existsRel(rel)) return null;\n  const source = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\\r\\n/g, '\\n');\n  const match = source.match(/^---\\n([\\s\\S]*?)\\n---\\n?([\\s\\S]*)$/);\n  if (!match) return { sourceMode: '', body: source, validFrontmatter: false };\n  const sourceMode = match[1].match(/^sourceMode:\\s*[\"']([^\"']+)[\"']\\s*$/m)?.[1] || '';\n  return { sourceMode, body: match[2], validFrontmatter: true };\n}\n`;
    if (!text.includes(marker)) throw new Error('Missing route-source helper marker');
    text = text.replace(marker, `${helper}${marker}`);
  }
  if (!text.includes('metadata-only reference MDX contains substantive body content')) {
    const marker = "      if (inspection.mdxImports.some((item) => item.resolved === profile.mdxPath)) {\n        issue('reference-only MDX is imported by the public route graph');\n      }\n";
    const extra = "      const referenceContent = inspectReferenceContent(profile.mdxPath);\n      if (referenceContent?.sourceMode === 'metadata-only') {\n        if (!referenceContent.validFrontmatter) issue('metadata-only reference MDX has invalid frontmatter envelope');\n        if (stripComments(referenceContent.body).trim()) issue('metadata-only reference MDX contains substantive body content');\n      }\n";
    if (!text.includes(marker)) throw new Error('Missing reference-only validation marker');
    text = text.replace(marker, `${marker}${extra}`);
  }
  if (!text.includes('  inspectReferenceContent,\n')) {
    text = requireChange(text, text.replace('  inspectRouteSource,\n', '  inspectRouteSource,\n  inspectReferenceContent,\n'), 'helper export');
  }
  write(rel, text);
}

{
  const rel = 'scripts/gill-reading-time-canonical-audit.js';
  let text = read(rel);
  if (!text.includes('Gill catalog reading-time bindings')) {
    const marker = '\nif (problems.length) {';
    const block = `\n// Gill catalog reading-time bindings: /articles/ must project data/series.json.\nconst catalogMain = read('src/components/articles/ArticlesMain.astro');\nconst catalogCards = read('src/components/articles/ArticlesPublicationsSection.astro');\nif (catalogMain.includes(\"const gill = seriesData['dzhon-gill'];\") && catalogMain.includes('gillReadingTime={gillReadingTime}')) ok('articles catalog derives Gill reading times from series.json');\nelse bad('articles catalog does not derive Gill reading times from series.json');\nfor (const slug of ['dzhon-gill-istoricheskiy-kontekst', 'dzhon-gill-spravochnik']) {\n  const binding = \`gillReadingTime['\${slug}']\`;\n  if (catalogCards.includes(binding)) ok(\`articles catalog binding: \${slug}\`);\n  else bad(\`articles catalog missing canonical binding: \${slug}\`);\n}\nif (/\\b(?:16|8)\\s*мин\\b/.test(catalogCards)) bad('articles catalog retains stale Gill 16/8 minute literal');\nelse ok('articles catalog has no stale Gill 16/8 minute literals');\n`;
    if (!text.includes(marker)) throw new Error('Missing audit final marker');
    text = text.replace(marker, `${block}${marker}`);
  }
  write(rel, text);
}

if (pending.length) {
  console.error(`❌ ${pending.length} files require normalization`);
  for (const rel of pending) console.error(`- ${rel}`);
  process.exit(1);
}
console.log(`✅ Source-truth normalization ${WRITE ? 'applied' : 'already canonical'}`);
for (const rel of changed) console.log(`- ${rel}`);
