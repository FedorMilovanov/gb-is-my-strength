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
const SECTION_COMPONENTS = [
  'GillContextSectionSummaryIntro.astro',
  'GillContextSectionFromPuritansToBaptists.astro',
  'GillContextSectionParticularVsGeneral.astro',
  'GillContextSectionGreatEjection.astro',
  'GillContextSectionClarendon.astro',
  'GillContextSectionAcademies.astro',
  'GillContextSectionSaltersHall.astro',
  'GillContextSectionCoffeeHouse.astro',
  'GillContextSectionSouthwark.astro',
  'GillContextSectionBooks.astro',
  'GillContextSectionConclusion.astro',
  'GillContextSectionSourcesAndSeriesTail.astro',
];
const files = {
  shell: `${BASE_REL}/GillContextMainShell.astro`,
  pageChromeComp: `${BASE_REL}/GillContextPageChrome.astro`,
  headerComp: `${BASE_REL}/GillContextHeaderHero.astro`,
  bodyComp: `${BASE_REL}/GillContextArticleBody.astro`,
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
    // Astro-only directive for preserving external script tags; not rendered.
    .replace(/\s+is:inline(?=\s|>)/g, '')
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

console.log('GILL CONTEXT VISUAL-PARITY SOURCE AUDIT');

mustExist('legacy Gill context route', LEGACY_REL);
mustExist('Astro Gill context page', PAGE_REL);
for (const [label, rel] of Object.entries(files)) mustExist(label, rel);
mustNotExist('Gill context body-segment-0 raw fragment retired', `${LEGACY_DIR_REL}/body-segment-0.html`);
mustNotExist('Gill context body-segment-1 raw fragment retired', `${LEGACY_DIR_REL}/body-segment-1.html`);
mustNotExist('Gill context header-hero raw fragment retired', `${LEGACY_DIR_REL}/header-hero.html`);
mustNotExist('Gill context post-article raw fragment retired', `${LEGACY_DIR_REL}/post-article.html`);
mustNotExist('Gill context article-body monolith retired', `${LEGACY_DIR_REL}/article-body.html`);
mustNotExist('Gill context raw section directory retired after full promotion', SECTION_DIR_REL);
for (const comp of SECTION_COMPONENTS) mustExist(`Gill context promoted section ${comp}`, `${BASE_REL}/${comp}`);

if (!problems.length) {
  const legacy = read(LEGACY_REL);
  const page = read(PAGE_REL);
  const shell = read(files.shell);
  const pageChromeComp = read(files.pageChromeComp);
  const headerComp = read(files.headerComp);
  const bodyComp = read(files.bodyComp);
  const postComp = read(files.postComp);
  const header = headerComp;
  const sectionHtml = SECTION_COMPONENTS.map((comp) => read(`${BASE_REL}/${comp}`)).join('');
  const article = `<article class="article-body" data-pagefind-body>${sectionHtml}</article>`;
  const post = postComp;

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
  mustContain('Astro page imports GillContextPageChrome', page, 'GillContextPageChrome');
  mustNotContain('Astro page no longer imports body segment before main', page, 'body-segment-0.html?raw');
  mustNotContain('Astro page no longer imports body segment after main', page, 'body-segment-1.html?raw');
  mustNotContain('Astro page must not transport full bodyHtml', page, 'bodyHtml');
  mustNotContain('Astro page must not use generic BaseLayout', page, '<BaseLayout');
  mustNotContain('Astro page must not use generic ArticleLayout', page, 'ArticleLayout');
  mustNotContain('Astro page must not use generic SeriesArticleLayout', page, 'SeriesArticleLayout');

  mustContain('Main shell renders main-content', shell, '<main id="main-content">');
  mustContain('Main shell uses header hero component', shell, 'GillContextHeaderHero');
  mustContain('Main shell uses article body component', shell, 'GillContextArticleBody');
  mustContain('Main shell uses post article component', shell, 'GillContextPostArticle');
  mustContain('PageChrome component exposes slot', pageChromeComp, '<slot />');
  mustContain('PageChrome component keeps rail', pageChromeComp, 'class="gbs2-rail"');
  mustContain('PageChrome component keeps mobile sheet', pageChromeComp, 'class="gbs2-sheet"');
  mustContain('PageChrome component keeps runtime script', pageChromeComp, 'site.js');
  mustNotContain('HeaderHero component no longer imports raw fragment', headerComp, 'header-hero.html?raw');
  mustContain('ArticleBody component owns article wrapper', bodyComp, '<article class="article-body" data-pagefind-body>');
  mustNotContain('ArticleBody component no longer uses raw section glob after full promotion', bodyComp, 'article-sections/*.html');
  for (const comp of SECTION_COMPONENTS) {
    mustContain(`ArticleBody imports ${comp}`, bodyComp, comp.replace(/\.astro$/, ''));
  }
  mustNotContain('PostArticle component no longer imports raw fragment', postComp, 'post-article.html?raw');

  mustContain('HeaderHero component keeps GBS2 hero', header, 'class="gbs2-hero"');
  mustContain('HeaderHero component keeps Gill H1', header, 'Джон Гилл: исторический контекст');
  mustContain('summary/intro section keeps summary card', sectionHtml, 'summary-card');
  mustContain('from-puritans section keeps H2', sectionHtml, 'id="sec-from-puritans-to-baptists"');
  mustContain('particular-vs-general section keeps H2', sectionHtml, 'id="sec-particular-vs-general"');
  mustContain('great-ejection section keeps figure', sectionHtml, 'underground-puritan-meeting');
  mustContain('clarendon section keeps acts image', sectionHtml, 'gill-clarendon-code-acts');
  mustContain('academies section keeps H2', sectionHtml, 'id="sec-academies"');
  mustContain('salters section keeps table', sectionHtml, 'id="sec-salters-hall"');
  mustContain('coffee-house section keeps float figure', sectionHtml, 'article-img--vertical float-right');
  mustContain('southwark section keeps Whitefield image', sectionHtml, 'whitefield-preaching');
  mustContain('books section keeps bookshop image', sectionHtml, 'gill-bookshop-strip.webp');
  mustContain('conclusion section keeps note box', sectionHtml, 'note-box reveal');
  mustContain('sources/tail section keeps source section', sectionHtml, 'sec-sources-context');
  mustContain('sources/tail section keeps Gill next navigation', sectionHtml, 'gbs2-next');
  mustContain('sources/tail section keeps Gill timeline', sectionHtml, 'gbs2-timeline');
  mustContain('PostArticle component keeps SDG end block', post, 'article-end-sdg-wrap');

  const main = `<main id="main-content">${header}${article}${post}</main>`;
  const reconstructed = pageChromeComp.replace('<slot />', main);
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
