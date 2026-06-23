#!/usr/bin/env node
/*
 * about-visual-parity-audit.js — guard /about/ native Astro contract.
 *
 * V10 verification (2026-06-23): the large visual diff was caused by an
 * unbalanced component split (FrameBefore opened page-wrap/main; FrameAfter
 * closed it). Astro serializes component roots independently, so the article
 * became a body-level sibling instead of a child of <main>. The approved native
 * page now uses AboutPageChrome + AboutMain: one balanced chrome component and
 * native semantic leaf blocks.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const problems = [];
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function ok(msg) { console.log('✅ ' + msg); }
function bad(msg) { problems.push(msg); console.log('❌ ' + msg); }
function must(haystack, needle, label) {
  haystack.includes(needle) ? ok(label || needle) : bad(`missing: ${label || needle}`);
}
function mustNot(haystack, needle, label) {
  !haystack.includes(needle) ? ok(`no ${label || needle}`) : bad(`forbidden present: ${label || needle}`);
}
function mustExist(rel, label) {
  exists(rel) ? ok(label || rel) : bad(`missing file: ${label || rel}`);
}
function mustNotExist(rel, label) {
  !exists(rel) ? ok(`absent: ${label || rel}`) : bad(`forbidden file/dir present: ${label || rel}`);
}

const legacy = read('about/index.html');
for (const marker of [
  'about-page',
  'about-resources',
  'about-contact-card',
  'gb-accuracy-block',
  'Фёдор Милованов',
]) {
  must(legacy, marker, `legacy /about/ approved marker: ${marker}`);
}

const page = read('src/pages/about/index.astro');
const chrome = read('src/components/about/AboutPageChrome.astro');
const main = read('src/components/about/AboutMain.astro');
const article = read('src/components/about/AboutArticle.astro');
const accuracy = read('src/components/about/AboutAccuracyBlock.astro');

must(page, '<!DOCTYPE html>', 'Astro /about/ emits full document');
must(page, 'AboutPageChrome', 'Astro /about/ uses balanced AboutPageChrome component');
must(page, 'AboutMain', 'Astro /about/ uses AboutMain semantic component');
mustExist('src/components/about/AboutPageChrome.astro', 'AboutPageChrome.astro component file');
mustExist('src/components/about/AboutMain.astro', 'AboutMain.astro component file');
mustExist('src/components/about/AboutArticle.astro', 'AboutArticle.astro component file');
mustExist('src/components/about/AboutAccuracyBlock.astro', 'AboutAccuracyBlock.astro component file');
mustNotExist('src/components/about/AboutFrameBefore.astro', 'unbalanced AboutFrameBefore retired');
mustNotExist('src/components/about/AboutFrameAfter.astro', 'unbalanced AboutFrameAfter retired');
mustNotExist('src/components/about/_legacy', 'about _legacy fragments retired');

must(chrome, '<head>', 'AboutPageChrome owns <head>');
must(chrome, '<body>', 'AboutPageChrome owns <body>');
must(chrome, '<main id="main-content">', 'AboutPageChrome opens main in balanced component');
must(chrome, '</main>', 'AboutPageChrome closes main in same component');
must(chrome, '<slot />', 'AboutPageChrome slots native content inside main');
must(chrome, 'page-wrap', 'AboutPageChrome preserves page-wrap');
must(chrome, 'breadcrumb', 'AboutPageChrome preserves breadcrumb');
must(chrome, 'themeToggle', 'AboutPageChrome preserves theme toggle');
must(chrome, 'article-end-block', 'AboutPageChrome preserves SDG end block');
must(chrome, '<footer>', 'AboutPageChrome preserves footer');
must(chrome, 'site.js', 'AboutPageChrome preserves runtime script');
must(chrome, 'ProfilePage', 'AboutPageChrome preserves ProfilePage JSON-LD');

must(main, 'AboutArticle', 'AboutMain includes AboutArticle');
must(main, 'AboutAccuracyBlock', 'AboutMain includes AboutAccuracyBlock');
for (const marker of [
  'about-page',
  'data-pagefind-body',
  'about-resources',
  'about-contact-card',
  'Библейские ресурсы',
  'Обратная связь',
]) {
  must(article, marker, `AboutArticle marker: ${marker}`);
}
for (const marker of ['gb-accuracy-block', 'Нашли неточность?', 'Email', 'Telegram']) {
  must(accuracy, marker, `AboutAccuracyBlock marker: ${marker}`);
}

for (const content of [page, chrome, main, article, accuracy]) {
  for (const marker of [
    'loadLegacyFullDocument',
    '?raw',
    '_legacy/',
    '<Fragment set:html',
    'AboutFrameBefore',
    'AboutFrameAfter',
    'import BaseLayout',
    '<BaseLayout',
    'astro-about-shadow',
    'astro-shell',
    'class="astro-about"',
    'astro-contact-grid',
    'astro-accuracy-block',
  ]) {
    mustNot(content, marker, `forbidden native about marker: ${marker}`);
  }
}

const dist = exists('dist/about/index.html') ? read('dist/about/index.html') : '';
if (dist) {
  for (const marker of ['about-page', 'about-resources', 'about-contact-card', 'gb-accuracy-block', 'Фёдор Милованов']) {
    must(dist, marker, `dist /about/ marker: ${marker}`);
  }
  mustNot(dist, 'class="astro-shell"', 'dist /about/ no astro-shell fallback');
  const mainOpen = dist.indexOf('<main id="main-content">');
  const articleAt = dist.indexOf('<article class="about-page"');
  const mainClose = dist.indexOf('</main>', mainOpen);
  if (mainOpen !== -1 && articleAt !== -1 && mainClose !== -1 && mainOpen < articleAt && articleAt < mainClose) {
    ok('dist /about/ article is inside <main> (balanced wrapper regression fixed)');
  } else {
    bad('dist /about/ article is NOT inside <main>');
  }
}

console.log('\nABOUT VISUAL PARITY AUDIT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s). /about/ native contract is broken.`);
  process.exit(1);
}
ok('/about/ is balanced native Astro and visual-parity guarded');
