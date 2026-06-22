#!/usr/bin/env node
/*
 * gill-spravochnik-visual-parity-audit.js — source-level guard for the
 * /articles/dzhon-gill-spravochnik/ GBS2 componentized shadow-breakout.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEGACY_REL = 'articles/dzhon-gill-spravochnik/index.html';
const PAGE_REL = 'src/pages/articles/dzhon-gill-spravochnik/index.astro';
const BASE_REL = 'src/components/article-pilots/gill-spravochnik';
const LEGACY_DIR_REL = `${BASE_REL}/_legacy`;
const SECTION_DIR_REL = `${LEGACY_DIR_REL}/article-sections`;

const SECTION_ORDER = [
  ['00-summary.html', null],
  ['01-sec-prdl.html', 'GillSpravochnikSectionPrdl.astro'],
  ['02-sec-timeline.html', null],
  ['03-sec-works.html', null],
  ['04-sec-body-structure.html', 'GillSpravochnikSectionBodyStructure.astro'],
  ['05-sec-network.html', 'GillSpravochnikSectionNetwork.astro'],
  ['06-sec-disputes.html', 'GillSpravochnikSectionDisputes.astro'],
  ['07-sec-terms.html', 'GillSpravochnikSectionTerms.astro'],
  ['08-sec-links.html', 'GillSpravochnikSectionLinks.astro'],
  ['09-sec-sources.html', null],
  ['10-sec-quiz-tail.html', null],
];
const PROMOTED = SECTION_ORDER.filter(([, comp]) => comp);
const RAW = SECTION_ORDER.filter(([, comp]) => !comp);

const files = {
  seg0: `${LEGACY_DIR_REL}/body-segment-0.html`,
  seg1: `${LEGACY_DIR_REL}/body-segment-1.html`,
  header: `${LEGACY_DIR_REL}/header-hero.html`,
  post: `${LEGACY_DIR_REL}/post-article.html`,
  shell: `${BASE_REL}/GillSpravochnikMainShell.astro`,
  headerComp: `${BASE_REL}/GillSpravochnikHeaderHero.astro`,
  bodyComp: `${BASE_REL}/GillSpravochnikArticleBody.astro`,
  postComp: `${BASE_REL}/GillSpravochnikPostArticle.astro`,
};

const problems = [];
function ok(msg) { console.log(`✅ ${msg}`); }
function bad(msg) { problems.push(msg); console.log(`❌ ${msg}`); }
function abs(rel) { return path.join(ROOT, rel); }
function read(rel) { return fs.readFileSync(abs(rel), 'utf8'); }
function mustExist(label, rel) {
  if (fs.existsSync(abs(rel))) ok(`${label}: ${rel}`);
  else bad(`${label} missing: ${rel}`);
}
function mustNotExist(label, rel) {
  if (!fs.existsSync(abs(rel))) ok(`${label}: ${rel} absent`);
  else bad(`${label}: ${rel} must be absent`);
}
function mustContain(label, text, needle) {
  if (String(text || '').includes(needle)) ok(`${label}: contains ${needle}`);
  else bad(`${label}: missing ${needle}`);
}
function mustNotContain(label, text, needle) {
  if (!String(text || '').includes(needle)) ok(`${label}: no ${needle}`);
  else bad(`${label}: forbidden ${needle}`);
}
function bodyInner(html) {
  return html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '';
}
function normalize(html) {
  return String(html || '')
    .replace(/<!-- Pagefind search data:[\s\S]*?<\/div>\s*/i, '')
    .replace(/\s+data-pagefind-body(?=\s|>)/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
}
function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function wordCount(html) {
  return (stripTags(html).match(/[A-Za-zА-Яа-яЁё0-9]{2,}/g) || []).length;
}
function h2Count(html) {
  return (String(html || '').match(/<h2\b/gi) || []).length;
}

console.log('GILL SPRAVOCHNIK VISUAL-PARITY SOURCE AUDIT');

mustExist('legacy Gill spravochnik route', LEGACY_REL);
mustExist('Astro Gill spravochnik page', PAGE_REL);
for (const [label, rel] of Object.entries(files)) mustExist(label, rel);
mustExist('Gill spravochnik article section directory', SECTION_DIR_REL);
if (fs.existsSync(abs(SECTION_DIR_REL))) {
  const rawFiles = fs.readdirSync(abs(SECTION_DIR_REL)).filter((name) => name.endsWith('.html')).sort();
  if (rawFiles.length === RAW.length) ok(`Gill spravochnik raw article section count: ${RAW.length} (+${PROMOTED.length} Astro sections = ${SECTION_ORDER.length})`);
  else bad(`Gill spravochnik section count drift: expected ${RAW.length}, got ${rawFiles.length}`);
  for (const [rawName] of RAW) mustExist(`Gill spravochnik raw section ${rawName}`, `${SECTION_DIR_REL}/${rawName}`);
}
mustNotExist('Gill spravochnik article-body monolith retired', `${LEGACY_DIR_REL}/article-body.html`);
for (const [rawName, comp] of PROMOTED) {
  mustNotExist(`Gill spravochnik promoted raw fragment ${rawName}`, `${SECTION_DIR_REL}/${rawName}`);
  mustExist(`Gill spravochnik promoted section ${comp}`, `${BASE_REL}/${comp}`);
}

if (!problems.length) {
  const legacy = read(LEGACY_REL);
  const page = read(PAGE_REL);
  const shell = read(files.shell);
  const headerComp = read(files.headerComp);
  const bodyComp = read(files.bodyComp);
  const postComp = read(files.postComp);
  const seg0 = read(files.seg0);
  const seg1 = read(files.seg1);
  const header = read(files.header);
  const sectionHtml = SECTION_ORDER.map(([rawName, comp]) => comp
    ? read(`${BASE_REL}/${comp}`)
    : read(`${SECTION_DIR_REL}/${rawName}`)
  ).join('');
  const article = `<article class="article-body" data-pagefind-body>${sectionHtml}</article>`;
  const post = read(files.post);

  for (const marker of [
    'class="gbs-world"',
    'data-gbs2-series="dzhon-gill"',
    'gbs2-mobile-head',
    'class="gbs2-world"',
    'class="gbs2-rail"',
    'id="gbs2Ring"',
    'id="gbs2Toc"',
    'id="gbs2Bbar"',
    'id="gbs2Sheet"',
    'gbs2-hero',
    'article-body',
    'author-card',
    'gbs2-next',
    'gbs2-timeline',
  ]) mustContain('legacy/source Gill GBS2 marker', legacy, marker);

  mustContain('Astro page uses shared full-document loader', page, "loadLegacyFullDocument('articles/dzhon-gill-spravochnik/index.html')");
  mustContain('Astro page imports GillSpravochnikMainShell', page, 'GillSpravochnikMainShell');
  mustContain('Astro page imports body segment before main', page, 'body-segment-0.html?raw');
  mustContain('Astro page imports body segment after main', page, 'body-segment-1.html?raw');
  mustNotContain('Astro page must not transport full bodyHtml', page, 'bodyHtml');
  mustNotContain('Astro page must not use generic BaseLayout', page, '<BaseLayout');
  mustNotContain('Astro page must not use generic ArticleLayout', page, 'ArticleLayout');
  mustNotContain('Astro page must not use generic SeriesArticleLayout', page, 'SeriesArticleLayout');

  mustContain('Main shell renders main-content', shell, '<main id="main-content">');
  mustContain('Main shell uses header hero component', shell, 'GillSpravochnikHeaderHero');
  mustContain('Main shell uses article body component', shell, 'GillSpravochnikArticleBody');
  mustContain('Main shell uses post article component', shell, 'GillSpravochnikPostArticle');
  mustContain('HeaderHero component raw import', headerComp, '_legacy/header-hero.html?raw');
  mustContain('ArticleBody component owns article wrapper', bodyComp, '<article class="article-body" data-pagefind-body>');
  mustContain('ArticleBody component uses ordered section glob', bodyComp, 'article-sections/*.html');
  for (const [, comp] of PROMOTED) mustContain(`ArticleBody component imports promoted ${comp}`, bodyComp, comp.replace(/\.astro$/, ''));
  mustNotContain('ArticleBody component no longer imports monolith', bodyComp, 'article-body.html?raw');
  mustContain('PostArticle component raw import', postComp, '_legacy/post-article.html?raw');

  mustContain('header fragment keeps GBS2 hero', header, 'class="gbs2-hero"');
  mustContain('header fragment keeps Gill reference H1', header, 'Джон Гилл: справочник');
  mustContain('article sections keep summary card', article, 'summary-card');
  mustContain('article sections keep PRDL section', article, 'id="sec-prdl"');
  mustContain('article sections keep body structure section', article, 'id="sec-body-structure"');
  mustContain('article sections keep network section', article, 'id="sec-network"');
  mustContain('article sections keep disputes section', article, 'id="sec-disputes"');
  mustContain('article sections keep terms section', article, 'id="sec-terms"');
  mustContain('article sections keep links section', article, 'id="sec-links"');
  mustContain('article sections keep sources section', article, 'sec-sources');
  mustContain('article sections keep quiz', article, 'quizPlaceholder');
  mustContain('article sections keep Gill next navigation', article, 'gbs2-next');
  mustContain('post fragment keeps SDG end block', post, 'article-end-sdg-wrap');
  mustContain('body before segment keeps rail', seg0, 'class="gbs2-rail"');
  mustContain('body after segment keeps mobile sheet', seg1, 'class="gbs2-sheet"');

  const reconstructed = `${seg0}<main id="main-content">${header}${article}${post}</main>${seg1}`;
  const legacyBody = bodyInner(legacy);
  if (normalize(reconstructed) === normalize(legacyBody)) ok('reconstructed body matches legacy body after whitespace normalization');
  else bad('reconstructed body differs from legacy body after whitespace normalization');

  const legacyWords = wordCount(legacyBody);
  const reconstructedWords = wordCount(reconstructed);
  if (legacyWords === reconstructedWords) ok(`word-count parity: ${legacyWords}`);
  else bad(`word-count drift: legacy=${legacyWords}, reconstructed=${reconstructedWords}`);

  const legacyH2 = h2Count(legacyBody);
  const reconstructedH2 = h2Count(reconstructed);
  if (legacyH2 === reconstructedH2) ok(`H2 parity: ${legacyH2}`);
  else bad(`H2 drift: legacy=${legacyH2}, reconstructed=${reconstructedH2}`);

  for (const forbidden of ['astro-card-grid', 'astro-article', 'data-series-strip', 'series-next-cta']) {
    mustNotContain('Gill spravochnik breakout forbidden legacy/generic marker', reconstructed, forbidden);
  }
}

console.log('');
if (problems.length) {
  console.log(`❌ Gill spravochnik visual-parity source audit failed: ${problems.length} issue(s)`);
  process.exit(1);
}
console.log('✅ Gill spravochnik visual-parity source audit passed');
