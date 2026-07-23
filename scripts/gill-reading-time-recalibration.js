#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const ORDER = [
  'dzhon-gill-istoricheskiy-kontekst',
  'dzhon-gill-chast-1-chelovek',
  'dzhon-gill-chast-2-uchenyi',
  'dzhon-gill-chast-4-ekzeget',
  'dzhon-gill-chast-3-nasledie',
  'dzhon-gill-spravochnik',
];
const MINUTES = {
  'dzhon-gill-istoricheskiy-kontekst': 28,
  'dzhon-gill-chast-1-chelovek': 32,
  'dzhon-gill-chast-2-uchenyi': 39,
  'dzhon-gill-chast-4-ekzeget': 71,
  'dzhon-gill-chast-3-nasledie': 54,
  'dzhon-gill-spravochnik': 15,
};
const PAGE_ID = {
  'dzhon-gill-istoricheskiy-kontekst': 'context',
  'dzhon-gill-chast-1-chelovek': 'part1',
  'dzhon-gill-chast-2-uchenyi': 'part2',
  'dzhon-gill-chast-4-ekzeget': 'part4',
  'dzhon-gill-chast-3-nasledie': 'part3',
  'dzhon-gill-spravochnik': 'spravochnik',
};
const TOTAL = ORDER.reduce((sum, slug) => sum + MINUTES[slug], 0);
const problems = [];
const changed = [];

function abs(rel) { return path.join(ROOT, rel); }
function read(rel) { return fs.readFileSync(abs(rel), 'utf8'); }
function write(rel, text) {
  const before = read(rel);
  if (before === text) return;
  if (!WRITE) {
    problems.push(`${rel}: requires recalibration`);
    return;
  }
  fs.writeFileSync(abs(rel), text, 'utf8');
  changed.push(rel);
}
function writeJson(rel, value) {
  write(rel, `${JSON.stringify(value, null, 2)}\n`);
}
function replaceRequired(text, pattern, replacement, label) {
  if (!pattern.test(text)) throw new Error(`Required pattern not found: ${label}`);
  pattern.lastIndex = 0;
  return text.replace(pattern, replacement);
}

// 1. Canonical MDX frontmatter.
for (const slug of ORDER) {
  const rel = `src/content/articles/${slug}.mdx`;
  let text = read(rel);
  text = replaceRequired(
    text,
    /^readingTime:\s*\d+\s*$/m,
    `readingTime: ${MINUTES[slug]}`,
    `${rel} readingTime`,
  );
  write(rel, text);
}

// 2. Series registry.
const seriesRel = 'data/series.json';
const series = JSON.parse(read(seriesRel));
for (const part of series['dzhon-gill'].parts) {
  if (MINUTES[part.slug] != null) part.readingTime = MINUTES[part.slug];
}
writeJson(seriesRel, series);

// 3. Search manifest and series total.
const manifestRel = 'data/search-manifest.json';
const manifest = JSON.parse(read(manifestRel));
for (const item of manifest.items || []) {
  const slug = String(item.url || '').match(/\/articles\/([^/]+)\/?$/)?.[1];
  if (slug && MINUTES[slug] != null) item.readTime = MINUTES[slug];
  if (item.id === 'dzhon-gill-seriya') item.readTime = TOTAL;
}
writeJson(manifestRel, manifest);

// 4. Link graph.
const graphRel = 'data/links-graph.json';
const graph = JSON.parse(read(graphRel));
for (const node of graph.nodes || []) {
  if (MINUTES[node.id] != null) node.readingTime = MINUTES[node.id];
}
writeJson(graphRel, graph);

// 5. Shared Gill series data and progress.
const tsRel = 'src/components/article-pilots/gill-series/gillSeriesData.ts';
let ts = read(tsRel);
for (const slug of ORDER) {
  const id = PAGE_ID[slug];
  const itemPattern = new RegExp(`(id:\\s*"${id}"[\\s\\S]*?readingTime:\\s*")\\d+(\\s*мин")`);
  ts = replaceRequired(ts, itemPattern, `$1${MINUTES[slug]}$2`, `${id} series item`);
}
let done = 0;
for (const slug of ORDER) {
  const id = PAGE_ID[slug];
  const nextIds = ORDER.map((s) => PAGE_ID[s]);
  const start = ts.indexOf(`  ${id}: {`);
  if (start < 0) throw new Error(`GILL_PAGE_DATA block missing: ${id}`);
  const later = nextIds
    .map((next) => ts.indexOf(`\n  ${next}: {`, start + 1))
    .filter((index) => index > start)
    .sort((a, b) => a - b)[0] ?? ts.length;
  let block = ts.slice(start, later);
  block = replaceRequired(block, /readingProgressDoneMin:\s*\d+/, `readingProgressDoneMin: ${done}`, `${id} done`);
  block = replaceRequired(block, /readingProgressPartMin:\s*\d+/, `readingProgressPartMin: ${MINUTES[slug]}`, `${id} part`);
  block = replaceRequired(block, /readingProgressTotalMin:\s*\d+/, `readingProgressTotalMin: ${TOTAL}`, `${id} total`);
  ts = ts.slice(0, start) + block + ts.slice(later);
  done += MINUTES[slug];
}
write(tsRel, ts);

// 6. Visible card literals and committed route mirrors. Only changed values are
// replaced, and only in Gill-owned files.
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (/\.(astro|html|ts|mdx)$/.test(ent.name)) out.push(full);
  }
  return out;
}
const owned = [
  ...walk(abs('src/components/article-pilots')).filter((file) => file.includes(`${path.sep}gill-`)),
  ...ORDER.flatMap((slug) => walk(abs(`articles/${slug}`))),
];
for (const file of [...new Set(owned)]) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  let text = fs.readFileSync(file, 'utf8');
  text = text
    .replace(/≈\s*16\s*минут(?:а|ы)?\s*чтения/g, '≈ 28 минут чтения')
    .replace(/≈\s*8\s*минут(?:а|ы)?\s*чтения/g, '≈ 15 минут чтения')
    .replace(/\b16\s*мин\b/g, '28 мин')
    .replace(/\b8\s*мин\b/g, '15 мин')
    .replace(/data-gbs2-total-min="220"/g, `data-gbs2-total-min="${TOTAL}"`);

  const slug = ORDER.find((candidate) => rel.includes(candidate));
  if (slug && /articles\/dzhon-gill-/.test(rel)) {
    const index = ORDER.indexOf(slug);
    const routeDone = ORDER.slice(0, index).reduce((sum, current) => sum + MINUTES[current], 0);
    text = text
      .replace(/data-gbs2-done-min="\d+"/g, `data-gbs2-done-min="${routeDone}"`)
      .replace(/data-gbs2-part-min="\d+"/g, `data-gbs2-part-min="${MINUTES[slug]}"`);
  }
  write(rel, text);
}

// 7. Remove the hardcoded 220-minute invariant from the consistency audit.
const consistencyRel = 'scripts/gill-series-data-consistency-audit.js';
let consistency = read(consistencyRel);
if (!consistency.includes('const expectedTotal = seriesItems.reduce')) {
  consistency = consistency.replace(
    '// 6. Progress coherence',
    '// 6. Progress coherence\nconst expectedTotal = seriesItems.reduce((sum, item) => sum + item.readingTimeMin, 0);',
  );
}
consistency = consistency
  .replace(/if \(pd\.totalMin !== 220\) bad\('totalMin must be 220', `\$\{pid\}: got \$\{pd\.totalMin\}`\);/g,
    "if (pd.totalMin !== expectedTotal) bad('totalMin mismatch', `${pid}: expected ${expectedTotal}, got ${pd.totalMin}`);")
  .replace(/else ok\(`totalMin OK \$\{pid\}: 220`\);/g,
    'else ok(`totalMin OK ${pid}: ${expectedTotal}`);')
  .replace(/if \(cumulative !== 220\) bad\('cumulative progress sum != 220', `got \$\{cumulative\}`\);/g,
    "if (cumulative !== expectedTotal) bad('cumulative progress sum mismatch', `expected ${expectedTotal}, got ${cumulative}`);")
  .replace(/else ok\(`cumulative progress sum = 220 ✅`\);/g,
    'else ok(`cumulative progress sum = ${expectedTotal} ✅`);');
write(consistencyRel, consistency);

// 8. Make the canonical audit route-specific instead of requiring four old
// literals on every page.
const auditRel = 'scripts/gill-reading-time-canonical-audit.js';
let audit = read(auditRel);
const oldLoop = /for \(const rel of GILL_ORDER\.map\(\(slug\) => `articles\/\$\{slug\}\/index\.html`\)\) \{[\s\S]*?\n\}/;
const newLoop = `for (const slug of GILL_ORDER) {\n  const rel = \`articles/\${slug}/index.html\`;\n  const txt = read(rel);\n  const expected = canonical[slug];\n  if (new RegExp(\`\\\\b\${expected}\\\\s*мин\`).test(txt)) ok(\`\${rel}: contains canonical \${expected} мин\`);\n  else bad(\`\${rel}: missing canonical \${expected} мин\`);\n}`;
audit = replaceRequired(audit, oldLoop, newLoop, 'route-specific reading-time loop');
write(auditRel, audit);

if (problems.length) {
  console.error(`❌ Gill reading-time recalibration required (${problems.length} files):`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
console.log(`✅ Gill reading-time recalibration ${WRITE ? 'applied' : 'already canonical'}: total ${TOTAL} min`);
if (changed.length) console.log(changed.map((rel) => `- ${rel}`).join('\n'));
