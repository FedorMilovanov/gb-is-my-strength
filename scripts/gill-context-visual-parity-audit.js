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
const files = {
  seg0: `${LEGACY_DIR_REL}/body-segment-0.html`,
  seg1: `${LEGACY_DIR_REL}/body-segment-1.html`,
  header: `${LEGACY_DIR_REL}/header-hero.html`,
  body: `${LEGACY_DIR_REL}/article-body.html`,
  post: `${LEGACY_DIR_REL}/post-article.html`,
  shell: `${BASE_REL}/GillContextMainShell.astro`,
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

console.log('GILL CONTEXT VISUAL-PARITY SOURCE AUDIT');

mustExist('legacy Gill context route', LEGACY_REL);
mustExist('Astro Gill context page', PAGE_REL);
for (const [label, rel] of Object.entries(files)) mustExist(label, rel);

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
  const article = read(files.body);
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
  mustContain('ArticleBody component raw import', bodyComp, '_legacy/article-body.html?raw');
  mustContain('PostArticle component raw import', postComp, '_legacy/post-article.html?raw');

  mustContain('header fragment keeps GBS2 hero', header, 'class="gbs2-hero"');
  mustContain('header fragment keeps Gill H1', header, 'Джон Гилл: исторический контекст');
  mustContain('article fragment keeps summary card', article, 'summary-card');
  mustContain('article fragment keeps source section', article, 'sec-sources-context');
  mustContain('article fragment keeps Gill next navigation', article, 'gbs2-next');
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
