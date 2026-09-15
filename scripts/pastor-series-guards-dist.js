#!/usr/bin/env node
'use strict';
/**
 * Wave 5 guard contracts — «Тёмная сторона кафедры» (pastor series), dist-level.
 * Each guard freezes a repaired defect so it cannot silently return (backlog G-1…G-8):
 *
 *   G-1 a11y     — every role="button" in published markup has an accessible name
 *                  (aria-label or non-empty text). D-01.
 *   G-2 anchors  — 0 non-latin (Cyrillic/auto-markdown) heading ids on series pages,
 *                  and every rail/outline anchor (href="#...") resolves to a real id. D-06.
 *   G-3 summary  — >= 1 .summary-card «Коротко» on every series route where it is declared. D-07.
 *   G-4 empty    — no «Конспект появится…» empty-state on series pages with non-empty structure. D-03.
 *   G-5 metadata — effective reviewStatus of all published series routes is "approved"
 *                  (raw storage may keep *-unverified / *-needs-review behind owner review
 *                  decision ledgers; the guard checks the effective state). D-05.
 *   G-7 root     — the «Проверь себя» block sits inside article[data-pagefind-body]. E-01.
 *   G-8 print    — table print rules cover [data-gbs2-series] (not gill-only). E-02.
 *   G-6 minutes  — readingTime is consistent across surfaces: data/series.json (registry)
 *                  == MDX frontmatter per part == dist body data-gbs2-* attributes ==
 *                  landing SITE_CONFIG readingTime/companionReadingTime. (WU-1.3 T1-T2 closed:
 *                  all surfaces carry the honest 200-wpm recalculation, core 157 + dossier 15.)
 *
 * Run after `npm run strangler:build`: `node scripts/pastor-series-guards-dist.js`
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERIES_PAGES = [
  ['I', 'articles/20-antisovetov-pastoru/index.html'],
  ['II', 'articles/anatomiya-padeniya-pyat-stadiy/index.html'],
  ['III', 'articles/teksty-pisaniya-kotorymi-manipuliruyut/index.html'],
  ['IV', 'articles/sem-tipov-razlichenie-uchiteley/index.html'],
  ['V', 'articles/cerkovnaya-disciplina-vlast-granicy-zashchita/index.html'],
  ['VI', 'articles/kogda-uhodit-kogda-ostavatsya/index.html'],
  ['VII', 'articles/vernye-i-neizvestnye-zdorovoe-pastyrstvo/index.html'],
  ['VIII', 'articles/priznaki-zdorovoy-cerkvi/index.html'],
  ['IX', 'articles/nesovershennyy-chelovek-v-nesovershennoy-cerkvi/index.html'],
  ['A', 'articles/diotrefy-nashego-vremeni/index.html'],
];
const QUIZ_ROUTES = SERIES_PAGES.filter(([part]) => part !== 'A'); // Dossier A: no quiz by owner decision

const issues = [];
const fail = (guard, part, msg) => issues.push(`[${guard}] [${part}] ${msg}`);

const pages = {};
for (const [part, rel] of SERIES_PAGES) {
  const file = path.join(ROOT, 'dist', rel);
  if (!fs.existsSync(file)) {
    fail('DIST', part, `missing dist page: ${rel}`);
    continue;
  }
  pages[part] = fs.readFileSync(file, 'utf8');
}

/* G-1 — accessible names for role="button" */
for (const [part, html] of Object.entries(pages)) {
  let unnamed = 0;
  const examples = [];
  for (const m of html.matchAll(/<([a-z0-9]+)((?:[^>"']|"[^"]*"|'[^']*')*?)role="button"((?:[^>"']|"[^"]*"|'[^']*')*?)/g)) {
    const tag = m[0];
    if (/aria-label\s*=\s*["'][^"']+["']/.test(tag)) continue;
    const end = html.indexOf(`</${m[1]}>`, m.index + tag.length);
    const inner = end > 0 ? html.slice(m.index + tag.length, end) : '';
    const text = inner.replace(/<[^>]*>/g, '').trim();
    if (!text) {
      unnamed += 1;
      if (examples.length < 3) examples.push(tag.slice(0, 90));
    }
  }
  if (unnamed > 0) fail('G-1', part, `${unnamed} role="button" without accessible name, e.g. ${examples[0]}`);
}

/* G-2 — no non-latin heading ids; every local anchor resolves */
for (const [part, html] of Object.entries(pages)) {
  const cyrillicIds = [...html.matchAll(/<(?:h[1-6])[^>]*\sid="([^"]*[^\x00-\x7F][^"]*)"/g)].map((m) => m[1]);
  if (cyrillicIds.length) fail('G-2', part, `non-latin heading id(s): ${cyrillicIds.slice(0, 3).join(', ')}`);
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const dangling = [...new Set([...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]))].filter((a) => a && !ids.has(a));
  if (dangling.length) fail('G-2', part, `dangling anchor(s): ${dangling.slice(0, 5).join(', ')}`);
}

/* G-3 — summary-card on every route */
for (const [part, html] of Object.entries(pages)) {
  if (!/class="[^"]*\bsummary-card\b/.test(html)) fail('G-3', part, 'no .summary-card «Коротко» block');
}

/* G-4 — learning-sheet «Конспект» tab is populated (no empty-state on structured pages) */
for (const [part, html] of Object.entries(pages)) {
  if (html.includes('Конспект появится')) fail('G-4', part, 'empty-state «Конспект появится…» present on structured page');
  const cards = (html.match(/class="outline-card"/g) || []).length;
  if (cards < 1) fail('G-4', part, 'learning-sheet outline has 0 cards (partToc has no level-2 summaries)');
}

/* G-7 — quiz block inside the pagefind article root */
for (const [part, html] of QUIZ_ROUTES.map(([, rel]) => [rel, null])) {
  // map rel -> part
}
for (const [part] of QUIZ_ROUTES) {
  const html = pages[part];
  if (!html) continue;
  if (!html.includes('id="sec-quiz"')) {
    fail('G-7', part, 'sec-quiz block missing');
    continue;
  }
  const quizPos = html.indexOf('id="sec-quiz"');
  const articleMatch = html.match(/<article[^>]*data-pagefind-body[^>]*>/);
  if (!articleMatch) {
    fail('G-7', part, 'article[data-pagefind-body] missing');
    continue;
  }
  const openPos = articleMatch.index;
  const closePos = html.indexOf('</article>', openPos);
  if (!(openPos < quizPos && (closePos < 0 || quizPos < closePos))) {
    fail('G-7', part, `sec-quiz outside article[data-pagefind-body] (quiz=${quizPos}, article=${openPos}..${closePos})`);
  }
}

/* G-8 — print table rules cover the series */
{
  const css = fs.readFileSync(path.join(ROOT, 'dist', 'css', 'site.css'), 'utf8');
  const printBlocks = [...css.matchAll(/@media print\s*\{/g)];
  let covered = 0;
  for (const token of ['article table', 'article thead', 'article tr', 'article th']) {
    const sel = `[data-gbs2-series] ${token}`;
    const ok = printBlocks.some((m) => {
      const start = m.index + m[0].length;
      const end = css.indexOf('@media', start);
      return css.slice(start, end === -1 ? undefined : end).includes(sel);
    });
    if (ok) covered += 1;
  }
  if (covered < 4) fail('G-8', 'site.css', `only ${covered}/4 print table selectors cover [data-gbs2-series]`);
}

/* G-5 — effective metadata review status */
{
  const { readRegistry } = require('./lib/editorial-metadata');
  const registry = readRegistry();
  const seriesRoutes = SERIES_PAGES.map(([, rel]) => `/${rel.replace(/index\.html$/, '')}`);
  for (const route of seriesRoutes) {
    const record = registry.records[route];
    if (!record) {
      fail('G-5', route, 'no editorial metadata record');
      continue;
    }
    if (record.reviewStatus !== 'approved') fail('G-5', route, `effective reviewStatus="${record.reviewStatus}"`);
  }
}

/* G-6 — reading-time consistency across surfaces (registry SSOT: data/series.json) */
{
  const registrySeries = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'series.json'), 'utf8'));
  const parts = (registrySeries['pastor-series'] || {}).parts || [];
  const bySlug = new Map(parts.map((p) => [p.slug, p.readingTime]));
  const slugByPart = Object.fromEntries(SERIES_PAGES.map(([part, rel]) => [part, rel.replace(/^articles\//, '').replace('/index.html', '')]));
  let coreTotal = 0;
  for (const [part, slug] of Object.entries(slugByPart)) {
    if (part === 'A') continue;
    const minutes = bySlug.get(slug);
    if (typeof minutes !== 'number') {
      fail('G-6', part, `series.json has no numeric readingTime for ${slug}`);
      continue;
    }
    coreTotal += minutes;
    // MDX frontmatter must agree with the registry
    const mdx = path.join(ROOT, 'src', 'content', 'articles', `${slug}.mdx`);
    if (fs.existsSync(mdx)) {
      const fm = fs.readFileSync(mdx, 'utf8').split('---')[1] || '';
      const m = fm.match(/^readingTime:\s*(\d+)/m);
      if (!m || Number(m[1]) !== minutes) fail('G-6', part, `frontmatter readingTime ${m && m[1]} != registry ${minutes}`);
    }
    // dist body attributes: done-min before part, part-min, total-min
    const html = pages[part];
    if (html) {
      const attrs = html.match(/data-gbs2-(?:done|part|total)-min="(\d+)"/g) || [];
      const done = Number(attrs.find((a) => a.startsWith('data-gbs2-done-min'))?.match(/"(\d+)"/)?.[1]);
      const partMin = Number(attrs.find((a) => a.startsWith('data-gbs2-part-min'))?.match(/"(\d+)"/)?.[1]);
      if (partMin !== minutes) fail('G-6', part, `dist data-gbs2-part-min ${partMin} != registry ${minutes}`);
      if (part !== 'I' && done < 0) fail('G-6', part, 'dist data-gbs2-done-min missing');
    }
  }
  const partI = pages['I'];
  if (partI) {
    const total = Number((partI.match(/data-gbs2-total-min="(\d+)"/) || [])[1]);
    if (total !== coreTotal) fail('G-6', 'I', `dist data-gbs2-total-min ${total} != core total ${coreTotal}`);
  }
  const landing = fs.readFileSync(path.join(ROOT, 'dist', 'pastor-series', 'index.html'), 'utf8');
  const siteCfg = landing.match(/readingTime:\s*(\d+)/);
  const companion = landing.match(/companionReadingTime:\s*(\d+)/);
  if (!siteCfg || Number(siteCfg[1]) !== coreTotal) fail('G-6', 'landing', `SITE_CONFIG readingTime ${siteCfg && siteCfg[1]} != core total ${coreTotal}`);
  const dossierMin = bySlug.get('diotrefy-nashego-vremeni');
  if (dossierMin !== undefined && companion && Number(companion[1]) !== dossierMin) fail('G-6', 'landing', `companionReadingTime ${companion[1]} != registry ${dossierMin}`);
  const dossierHtml = pages['A'];
  if (dossierMin !== undefined && dossierHtml) {
    const visibleTime = dossierHtml.match(/article-byline[\\s\\S]{0,1200}?(\\d+)\\s*мин/);
    if (!visibleTime || Number(visibleTime[1]) !== dossierMin) {
      fail('G-6', 'A', `rendered dossier byline ${visibleTime && visibleTime[1]} != registry ${dossierMin}`);
    }
  }
}

if (issues.length) {
  console.error('PASTOR-SERIES GUARDS (dist): FAIL');
  for (const issue of issues) console.error('  - ' + issue);
  process.exit(1);
}
console.log('✅ pastor-series guards (dist): G-1 a11y, G-2 anchors, G-3 summary, G-4 empty-state, G-5 metadata, G-6 reading-time, G-7 article root, G-8 print — all passed');
