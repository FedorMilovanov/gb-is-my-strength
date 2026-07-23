#!/usr/bin/env node
/*
 * Gill reading-time canonical audit.
 *
 * Canonical source: src/content/articles/dzhon-gill-*.mdx frontmatter.
 * Ensures public HTML, data/series.json, search manifest, links graph, and
 * Gill Astro chrome/components do not keep stale series reading-time values.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GILL_ORDER = [
  'dzhon-gill-istoricheskiy-kontekst',
  'dzhon-gill-chast-1-chelovek',
  'dzhon-gill-chast-2-uchenyi',
  'dzhon-gill-chast-3-nasledie',
  'dzhon-gill-chast-4-ekzeget',
  'dzhon-gill-spravochnik',
];
const problems = [];
function ok(msg) { console.log(`✅ ${msg}`); }
function bad(msg) { problems.push(msg); console.log(`❌ ${msg}`); }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function readJson(rel) { return JSON.parse(read(rel)); }
function mdxReadingTime(slug) {
  const src = read(`src/content/articles/${slug}.mdx`);
  const m = src.match(/^readingTime:\s*(\d+)\s*$/m);
  if (!m) bad(`${slug}: missing readingTime in MDX frontmatter`);
  return m ? Number(m[1]) : NaN;
}
function filesUnder(rel, exts) {
  const root = path.join(ROOT, rel);
  const out = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (exts.some((ext) => full.endsWith(ext))) out.push(path.relative(ROOT, full).replace(/\\/g, '/'));
    }
  }
  walk(root);
  return out;
}

console.log('GILL READING-TIME CANONICAL AUDIT');
const canonical = Object.fromEntries(GILL_ORDER.map((slug) => [slug, mdxReadingTime(slug)]));
const total = Object.values(canonical).reduce((a, b) => a + b, 0);
ok(`MDX canonical total: ${total} (generated from MDX frontmatter, no longer hardcoded 149)`); const CANONICAL_TOTAL = total;

const series = readJson('data/series.json')['dzhon-gill'];
if (!series) bad('data/series.json missing dzhon-gill series');
else {
  for (const part of series.parts || []) {
    const expected = canonical[part.slug];
    if (part.readingTime === expected) ok(`series ${part.slug}: ${expected}`);
    else bad(`series ${part.slug}: expected ${expected}, got ${part.readingTime}`);
  }
  const seriesTotal = (series.parts || []).reduce((sum, p) => sum + Number(p.readingTime || 0), 0);
  if (seriesTotal === total) ok(`series total: ${seriesTotal}`);
  else bad(`series total expected ${total}, got ${seriesTotal}`);
}

const search = readJson('data/search-manifest.json');
const searchItems = new Map((search.items || []).map((item) => [item.id, item]));
const seriesItem = searchItems.get('dzhon-gill-seriya');
if (seriesItem?.readTime === total) ok(`search series total: ${total}`);
else bad(`search series total expected ${total}, got ${seriesItem?.readTime}`);
for (const slug of GILL_ORDER) {
  const item = searchItems.get(slug);
  if (!item) bad(`search missing ${slug}`);
  else {
    if (item.readTime === canonical[slug]) ok(`search ${slug}: ${canonical[slug]}`);
    else bad(`search ${slug}: expected ${canonical[slug]}, got ${item.readTime}`);
    if ('readingTime' in item) bad(`search ${slug}: duplicate readingTime alias present`);
  }
}

const graph = readJson('data/links-graph.json');
for (const node of graph.nodes || []) {
  if (canonical[node.id] != null) {
    if (node.readingTime === canonical[node.id]) ok(`links-graph ${node.id}: ${canonical[node.id]}`);
    else bad(`links-graph ${node.id}: expected ${canonical[node.id]}, got ${node.readingTime}`);
  }
}

const scanFiles = [
  ...GILL_ORDER.map((slug) => `articles/${slug}/index.html`),
  ...filesUnder('src/components/article-pilots/gill-context', ['.astro', '.html']),
  ...filesUnder('src/components/article-pilots/gill-spravochnik', ['.astro', '.html']),
  'index.html',
  'src/components/home/_legacy/main.html',
  'src/components/home/_legacy/publications.html',
  'src/components/articles/ArticlesPublicationsSection.astro',
  'data/series.json',
  'data/search-manifest.json',
  'data/links-graph.json',
];
const staleLiterals = [
  '133 мин серии',
  'data-gbs2-total-min="133"',
  'II · 28 мин',
  'III · 34 мин',
  'IV · 47 мин',
  '~28 мин',
  '~34 мин',
  '~47 мин',
  '≈ 28 минут чтения',
  '≈ 34 минуты чтения',
  '≈ 47 минут чтения',
  'Кеттеринг → Лондон · 21 мин',
  'Кеттеринг → Лондон · 28 мин',
  'Экзегеза и Троица · 8 мин',
  'Экзегеза и Троица · 34 мин',
  'Сперджен и кафедра · 16 мин',
  'Сперджен и кафедра · 47 мин',
  'Спердген',
];
for (const rel of [...new Set(scanFiles)]) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  const txt = fs.readFileSync(abs, 'utf8');
  for (const stale of staleLiterals) {
    if (txt.includes(stale)) bad(`${rel}: stale Gill literal '${stale}'`);
  }
}

for (const slug of GILL_ORDER) {
  const rel = `articles/${slug}/index.html`;
  const txt = read(rel);
  const expected = canonical[slug];
  if (new RegExp(`\\b${expected}\\s*мин`).test(txt)) ok(`${rel}: contains canonical ${expected} мин`);
  else bad(`${rel}: missing canonical ${expected} мин`);
}

// Gill catalog reading-time bindings: /articles/ must project data/series.json.
const catalogMain = read('src/components/articles/ArticlesMain.astro');
const catalogCards = read('src/components/articles/ArticlesPublicationsSection.astro');
if (catalogMain.includes("const gill = seriesData['dzhon-gill'];") && catalogMain.includes('gillReadingTime={gillReadingTime}')) ok('articles catalog derives Gill reading times from series.json');
else bad('articles catalog does not derive Gill reading times from series.json');
for (const slug of ['dzhon-gill-istoricheskiy-kontekst', 'dzhon-gill-spravochnik']) {
  const binding = `gillReadingTime['${slug}']`;
  if (catalogCards.includes(binding)) ok(`articles catalog binding: ${slug}`);
  else bad(`articles catalog missing canonical binding: ${slug}`);
}
if (/\b(?:16|8)\s*мин\b/.test(catalogCards)) bad('articles catalog retains stale Gill 16/8 minute literal');
else ok('articles catalog has no stale Gill 16/8 minute literals');

if (problems.length) {
  console.log(`\n❌ Gill reading-time canonical audit failed: ${problems.length} issue(s)`);
  process.exit(1);
}
console.log('\n✅ Gill reading-time canonical audit passed');
