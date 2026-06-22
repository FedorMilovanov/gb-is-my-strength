#!/usr/bin/env node
/*
 * gill-context-visual-parity-audit.js — source-level guard for the first
 * Gill/GBS2 componentized shadow-breakout route.
 *
 * The route must preserve legacy visual truth while exposing Astro seams.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEGACY_REL = 'articles/dzhon-gill-istoricheskiy-kontekst/index.html';
const PAGE_REL = 'src/pages/articles/dzhon-gill-istoricheskiy-kontekst/index.astro';
const BASE_REL = 'src/components/article-pilots/gill-context';
const LEGACY_DIR_REL = `${BASE_REL}/_legacy`;
const SECTION_DIR_REL = `${LEGACY_DIR_REL}/article-sections`;
const TOTAL_SECTIONS = 12;
const TOTAL_RAW_SECTIONS = 6;
const TOTAL_ASTRO_SECTIONS = 6;
const files = {
  seg0: `${LEGACY_DIR_REL}/body-segment-0.html`,
  seg1: `${LEGACY_DIR_REL}/body-segment-1.html`,
  header: `${LEGACY_DIR_REL}/header-hero.html`,
  post: `${LEGACY_DIR_REL}/post-article.html`,
  shell: `${BASE_REL}/GillContextMainShell.astro`,
  headerComp: `${BASE_REL}/GillContextHeaderHero.astro`,
  bodyComp: `${BASE_REL}/GillContextArticleBody.astro`,
  particularComp: `${BASE_REL}/GillContextSectionParticularVsGeneral.astro`,
  academiesComp: `${BASE_REL}/GillContextSectionAcademies.astro`,
  saltersComp: `${BASE_REL}/GillContextSectionSaltersHall.astro`,
  coffeeComp: `${BASE_REL}/GillContextSectionCoffeeHouse.astro`,
  booksComp: `${BASE_REL}/GillContextSectionBooks.astro`,
  conclusionComp: `${BASE_REL}/GillContextSectionConclusion.astro`,
  postComp: `${BASE_REL}/GillContextPostArticle.astro`,
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
    // Component seams may add or remove formatting whitespace between tags;
    // visual/DOM parity is unaffected, so canonicalize inter-tag whitespace.
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
function sectionFiles() {
  const dir = abs(SECTION_DIR_REL);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.html'))
    .sort()
    .map((name) => `${SECTION_DIR_REL}/${name}`);
}

console.log('GILL CONTEXT VISUAL-PARITY SOURCE AUDIT');

mustExist('legacy Gill context route', LEGACY_REL);
mustExist('Astro Gill context page', PAGE_REL);
for (const [label, rel] of Object.entries(files)) mustExist(label, rel);
mustExist('Gill context article section directory', SECTION_DIR_REL);
mustNotExist('Gill context article-body monolith retired', `${LEGACY_DIR_REL}/article-body.html`);
mustNotExist('Gill context particular-vs-general raw fragment promoted', `${SECTION_DIR_REL}/02-sec-particular-vs-general.html`);
mustNotExist('Gill context academies raw fragment promoted', `${SECTION_DIR_REL}/05-sec-academies.html`);
mustNotExist('Gill context Salters Hall raw fragment promoted', `${SECTION_DIR_REL}/06-sec-salters-hall.html`);
mustNotExist('Gill context coffee-house raw fragment promoted', `${SECTION_DIR_REL}/07-sec-coffee-house.html`);
mustNotExist('Gill context books raw fragment promoted', `${SECTION_DIR_REL}/09-sec-books.html`);
mustNotExist('Gill context conclusion raw fragment promoted', `${SECTION_DIR_REL}/10-sec-conclusion.html`);

if (!problems.length) {
  const legacy = read(LEGACY_REL);
  const page = read(PAGE_REL);
  const shell = read(files.shell);
  const headerComp = read(files.headerComp);
  const bodyComp = read(files.bodyComp);
  const postComp = read(files.postComp);
  const particularComp = read(files.particularComp);
  const academiesComp = read(files.academiesComp);
  const saltersComp = read(files.saltersComp);
  const coffeeComp = read(files.coffeeComp);
  const booksComp = read(files.booksComp);
  const conclusionComp = read(files.conclusionComp);
  const seg0 = read(files.seg0);
  const seg1 = read(files.seg1);
  const header = read(files.header);
  const sections = sectionFiles();
  const sectionName = (rel) => rel.split('/').pop() || rel;
  const sectionsBeforeParticular = sections.filter((rel) => sectionName(rel) < '02-sec-particular-vs-general.html');
  const sectionsBetweenParticularAndAcademies = sections.filter((rel) => {
    const name = sectionName(rel);
    return name > '02-sec-particular-vs-general.html' && name < '05-sec-academies.html';
  });
  const sectionsBetweenAcademiesAndSalters = sections.filter((rel) => {
    const name = sectionName(rel);
    return name > '05-sec-academies.html' && name < '06-sec-salters-hall.html';
  });
  const sectionsBetweenSaltersAndCoffee = sections.filter((rel) => {
    const name = sectionName(rel);
    return name > '06-sec-salters-hall.html' && name < '07-sec-coffee-house.html';
  });
  const sectionsBetweenCoffeeAndBooks = sections.filter((rel) => {
    const name = sectionName(rel);
    return name > '07-sec-coffee-house.html' && name < '09-sec-books.html';
  });
  const sectionsBetweenBooksAndConclusion = sections.filter((rel) => {
    const name = sectionName(rel);
    return name > '09-sec-books.html' && name < '10-sec-conclusion.html';
  });
  const sectionsAfterConclusion = sections.filter((rel) => sectionName(rel) > '10-sec-conclusion.html');
  const articleInner = `${sectionsBeforeParticular.map(read).join('')}${particularComp}${sectionsBetweenParticularAndAcademies.map(read).join('')}${academiesComp}${sectionsBetweenAcademiesAndSalters.map(read).join('')}${saltersComp}${sectionsBetweenSaltersAndCoffee.map(read).join('')}${coffeeComp}${sectionsBetweenCoffeeAndBooks.map(read).join('')}${booksComp}${sectionsBetweenBooksAndConclusion.map(read).join('')}${conclusionComp}${sectionsAfterConclusion.map(read).join('')}`;
  const article = `<article class="article-body">${articleInner}</article>`;
  const post = read(files.post);

  if (sections.length === TOTAL_RAW_SECTIONS) ok(`Gill context raw article section count: ${TOTAL_RAW_SECTIONS} (+${TOTAL_ASTRO_SECTIONS} Astro sections = ${TOTAL_SECTIONS})`);
  else bad(`Gill context raw article section count drift: expected ${TOTAL_RAW_SECTIONS}, got ${sections.length}`);
  if (sections[0]?.endsWith('/00-summary-and-intro.html')) ok('Gill context first raw section is summary/intro prelude');
  else bad(`Gill context first raw section order drift: ${sections[0] || 'none'}`);
  if (sections.at(-1)?.endsWith('/11-sec-sources-and-series-tail.html')) ok('Gill context last raw section is sources + series tail');
  else bad(`Gill context last raw section order drift: ${sections.at(-1) || 'none'}`);

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

  mustContain('Astro page uses shared full-document loader', page, "loadLegacyFullDocument('articles/dzhon-gill-istoricheskiy-kontekst/index.html')");
  mustContain('Astro page imports GillContextMainShell', page, 'GillContextMainShell');
  mustContain('Astro page imports body segment before main', page, 'body-segment-0.html?raw');
  mustContain('Astro page imports body segment after main', page, 'body-segment-1.html?raw');
  mustNotContain('Astro page must not transport full bodyHtml', page, 'bodyHtml');
  mustNotContain('Astro page must not use generic BaseLayout', page, '<BaseLayout');
  mustNotContain('Astro page must not use generic ArticleLayout', page, 'ArticleLayout');
  mustNotContain('Astro page must not use generic SeriesArticleLayout', page, 'SeriesArticleLayout');

  mustContain('Main shell renders main-content', shell, '<main id="main-content">');
  mustContain('Main shell uses header hero component', shell, 'GillContextHeaderHero');
  mustContain('Main shell uses article body component', shell, 'GillContextArticleBody');
  mustContain('Main shell uses post article component', shell, 'GillContextPostArticle');
  mustContain('HeaderHero component raw import', headerComp, '_legacy/header-hero.html?raw');
  mustContain('ArticleBody component owns article wrapper', bodyComp, '<article class="article-body">');
  mustContain('ArticleBody component uses ordered section glob', bodyComp, 'article-sections/*.html');
  mustContain('ArticleBody component imports promoted particular-vs-general', bodyComp, 'GillContextSectionParticularVsGeneral');
  mustContain('ArticleBody component imports promoted academies', bodyComp, 'GillContextSectionAcademies');
  mustContain('ArticleBody component imports promoted Salters Hall', bodyComp, 'GillContextSectionSaltersHall');
  mustContain('ArticleBody component imports promoted coffee-house', bodyComp, 'GillContextSectionCoffeeHouse');
  mustContain('ArticleBody component imports promoted books', bodyComp, 'GillContextSectionBooks');
  mustContain('ArticleBody component imports promoted conclusion', bodyComp, 'GillContextSectionConclusion');
  mustNotContain('ArticleBody component no longer imports monolith', bodyComp, 'article-body.html?raw');
  mustContain('PostArticle component raw import', postComp, '_legacy/post-article.html?raw');

  mustContain('header fragment keeps GBS2 hero', header, 'class="gbs2-hero"');
  mustContain('header fragment keeps Gill H1', header, 'Джон Гилл: исторический контекст');
  mustContain('particular-vs-general component keeps H2', particularComp, 'id="sec-particular-vs-general"');
  mustContain('particular-vs-general component keeps table', particularComp, 'compare-table');
  mustContain('academies component keeps academies H2', academiesComp, 'id="sec-academies"');
  mustContain('academies component keeps academy term', academiesComp, 'диссентерских академий');
  mustContain('Salters Hall component keeps H2', saltersComp, 'id="sec-salters-hall"');
  mustContain('Salters Hall component keeps table', saltersComp, 'compare-table');
  mustContain('coffee-house component keeps H2', coffeeComp, 'id="sec-coffee-house"');
  mustContain('coffee-house component keeps float figure', coffeeComp, 'article-img--vertical float-right');
  mustContain('books component keeps books H2', booksComp, 'id="sec-books"');
  mustContain('books component keeps bookshop image', booksComp, 'gill-bookshop-strip.webp');
  mustContain('conclusion component keeps conclusion H2', conclusionComp, 'id="sec-conclusion"');
  mustContain('conclusion component keeps note box', conclusionComp, 'note-box reveal');
  mustContain('article sections keep summary card', article, 'summary-card');
  mustContain('article sections keep source section', article, 'sec-sources-context');
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
    mustNotContain('Gill context breakout forbidden legacy/generic marker', reconstructed, forbidden);
  }
}

console.log('');
if (problems.length) {
  console.log(`❌ Gill context visual-parity source audit failed: ${problems.length} issue(s)`);
  process.exit(1);
}
console.log('✅ Gill context visual-parity source audit passed');
