#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEGACY_REL = 'articles/dzhon-gill-spravochnik/index.html';
const PAGE_REL = 'src/pages/articles/dzhon-gill-spravochnik/index.astro';
const BASE_REL = 'src/components/article-pilots/gill-spravochnik';
const REQUIRED = {
  pageHead: `${BASE_REL}/GillSpravochnikPageHead.astro`,
  pageChrome: `${BASE_REL}/GillSpravochnikPageChrome.astro`,
  shell: `${BASE_REL}/GillSpravochnikMainShell.astro`,
  header: `${BASE_REL}/GillSpravochnikHeaderHero.astro`,
  body: `${BASE_REL}/GillSpravochnikArticleBody.astro`,
  post: `${BASE_REL}/GillSpravochnikPostArticle.astro`,
};
const SECTION_COMPONENTS = [
  'GillSpravochnikSectionSummary.astro',
  'GillSpravochnikSectionPrdl.astro',
  'GillSpravochnikSectionTimeline.astro',
  'GillSpravochnikSectionWorks.astro',
  'GillSpravochnikSectionBodyStructure.astro',
  'GillSpravochnikSectionNetwork.astro',
  'GillSpravochnikSectionDisputes.astro',
  'GillSpravochnikSectionTerms.astro',
  'GillSpravochnikSectionLinks.astro',
  'GillSpravochnikSectionSources.astro',
  'GillSpravochnikSectionQuizTail.astro',
];
const FORBIDDEN = ['loadLegacyFullDocument', 'headHtml', 'bodyHtml', 'bodyAttributes', '?raw', 'set:html', '_legacy'];
const problems = [];

function ok(msg) { console.log(`✅ ${msg}`); }
function bad(msg) { problems.push(msg); console.log(`❌ ${msg}`); }
function abs(rel) { return path.join(ROOT, rel); }
function read(rel) { return fs.readFileSync(abs(rel), 'utf8'); }
function exists(rel) { return fs.existsSync(abs(rel)); }
function mustExist(label, rel) { exists(rel) ? ok(`${label}: ${rel}`) : bad(`${label} missing: ${rel}`); }
function mustNotExist(label, rel) { !exists(rel) ? ok(`${label}: ${rel} absent`) : bad(`${label}: ${rel} must be absent`); }
function mustContain(label, text, needle) { String(text).includes(needle) ? ok(`${label}: contains ${needle}`) : bad(`${label}: missing ${needle}`); }
function mustNotContain(label, text, needle) { !String(text).includes(needle) ? ok(`${label}: no ${needle}`) : bad(`${label}: forbidden ${needle}`); }
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
function bodyInner(html) { return html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || ''; }
function stripFrontmatter(source) {
  return String(source || '').replace(/^---[\s\S]*?---\s*/, '');
}
function normalize(html) {
  return String(html || '')
    .replace(/\s+is:inline(?=\s|>)/g, '')
    .replace(/\s+data-pagefind-body(?=\s|>)/g, '')
    .replace(/viewBox=/g, 'viewbox=')
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
}
function wordCount(html) { return (stripTags(html).match(/[A-Za-zА-Яа-яЁё0-9]{2,}/g) || []).length; }
function h2Count(html) { return (String(html || '').match(/<h2\b/gi) || []).length; }
function themeBtn(cls) {
  return `<button type="button" class="${cls} fc-button fc-theme-toggle" aria-label="Переключить тему" title="Тема" aria-pressed="false" data-gbs2-theme=""><span aria-hidden="true" class="fc-theme-toggle__sun"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg></span><span aria-hidden="true" class="fc-theme-toggle__moon"><svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path></svg></span></button>`;
}
function searchBtn(cls) {
  return `<button type="button" class="${cls} fc-button" aria-label="Поиск" title="Поиск" data-gbs2-search=""><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path></svg></button>`;
}
function shareBtn(cls) {
  return `<button type="button" class="${cls} fc-button" aria-label="Поделиться" title="Поделиться" data-gbs2-share=""><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="M8.59 13.51l6.83 3.98"></path><path d="M15.41 6.51L8.59 10.49"></path></svg></button>`;
}
function fontBtn(cls, kind, label, text) {
  return `<button type="button" class="${cls} fc-button fc-font" aria-label="${label}" title="${label}" data-gbs2-font="${kind}">${text}</button>`;
}
function playBtn(cls) {
  return `<button type="button" class="fc-button fc-play-ember ${cls}" data-fc-action="play" data-audio-state="none" aria-label="Озвучка" aria-disabled="true"><span aria-hidden="true" class="fc-play-ember__ring"></span><svg aria-hidden="true" class="fc-play-ember__icon fc-play-ember__icon--play" viewBox="0 0 24 24"><path d="M8 5.5v13l10-6.5z"></path></svg><svg aria-hidden="true" class="fc-play-ember__icon fc-play-ember__icon--pause" viewBox="0 0 24 24"><path d="M9 6v12"></path><path d="M15 6v12"></path></svg><svg aria-hidden="true" class="fc-play-ember__icon fc-play-ember__icon--spark" viewBox="0 0 24 24"><path d="M12 5.5v3"></path><path d="M12 15.5v3"></path><path d="M5.5 12h3"></path><path d="M15.5 12h3"></path></svg></button>`;
}
function saveBtn(cls) {
  return `<button type="button" class="fc-button fc-save ${cls}" data-fc-action="save" aria-label="Сохранить" aria-pressed="false"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg></button>`;
}
function offlineBtn(cls) {
  return `<button type="button" class="${cls} fc-button fc-offline" aria-label="Сохранить серию офлайн" title="Офлайн" data-gbs2-offline="">↓</button>`;
}
function mobileControlsMarkup() {
  return `<div class="gbs2-mobile-actions fc-mobile-actions" data-fc-root data-fc-variant="gill" role="group" aria-label="Быстрые действия серии">${themeBtn('gbs2-mctl')}${searchBtn('gbs2-mctl')}${playBtn('gbs2-mctl')}${saveBtn('gbs2-mctl')}</div>`;
}
function railControlsMarkup() {
  const cls = 'gbs2-ctl';
  return `<div class="gbs2-rfoot fc-rfoot" data-fc-root data-fc-variant="gill" role="group" aria-label="Управление серией">${themeBtn(cls)}${searchBtn(cls)}${shareBtn(cls)}${fontBtn(cls, 'down', 'Шрифт меньше', 'A−')}${fontBtn(cls, 'up', 'Шрифт больше', 'A+')}${playBtn(cls)}${saveBtn(cls)}${offlineBtn(cls)}<a class="gbs2-home fc-home" href="../../biografii/">← Назад</a></div>`;
}
function expandChromeHelpers(html, roman) {
  return String(html || '')
    .replace(/<GillRailControls\s+context="mobile"\s+audioState="none"\s+includeStyles=\{true\}\s*\/>/g, mobileControlsMarkup())
    .replace(/<GillRailControls\s+context="rail"\s+audioState="none"\s+homeHref="\.\.\/\.\.\/biografii\/"\s*\/>/g, railControlsMarkup())
    .replace(new RegExp(`<RomanNumeral\\s+value="${roman}"\\s*\\/>`, 'g'), `<span aria-hidden="true" class="fc-roman">${roman}</span>`);
}

console.log('GILL SPRAVOCHNIK STRICT-NATIVE AUDIT');
mustExist('legacy route', LEGACY_REL);
mustExist('Astro route', PAGE_REL);
for (const [label, rel] of Object.entries(REQUIRED)) mustExist(label, rel);
mustNotExist('legacy spravochnik directory retired', `${BASE_REL}/_legacy`);
for (const comp of SECTION_COMPONENTS) mustExist(`section component ${comp}`, `${BASE_REL}/${comp}`);

if (!problems.length) {
  const page = read(PAGE_REL);
  const pageHead = read(REQUIRED.pageHead);
  const pageChrome = read(REQUIRED.pageChrome);
  const shell = read(REQUIRED.shell);
  const header = read(REQUIRED.header);
  const body = read(REQUIRED.body);
  const post = read(REQUIRED.post);
  const legacy = read(LEGACY_REL);
  const legacyBody = bodyInner(legacy);
  const sectionHtml = SECTION_COMPONENTS.map((name) => read(`${BASE_REL}/${name}`)).join('');
  const article = `<article class="article-body" data-pagefind-body>${sectionHtml}</article>`;
  const main = `<main id="main-content">${header}${article}${post}</main>`;
  const reconstructed = expandChromeHelpers(stripFrontmatter(pageChrome).replace('<slot />', main), 'V');
  const scopeText = [page, pageHead, pageChrome, shell, header, body, post, ...SECTION_COMPONENTS.map((name) => read(`${BASE_REL}/${name}`))].join('\n');

  for (const token of FORBIDDEN) mustNotContain('strict-native source scope', scopeText, token);
  mustContain('route imports native page head', page, 'GillSpravochnikPageHead');
  mustContain('route imports native page chrome', page, 'GillSpravochnikPageChrome');
  mustContain('route imports native main shell', page, 'GillSpravochnikMainShell');
  mustContain('route sets explicit body class', page, 'class="gbs-world"');
  mustContain('route sets explicit done minutes', page, 'data-gbs2-done-min="141"');
  mustContain('route sets explicit part minutes', page, 'data-gbs2-part-min="8"');
  mustContain('page head has canonical', pageHead, 'rel="canonical"');
  mustContain('page head has SITE_CONFIG', pageHead, 'window.SITE_CONFIG');
  mustContain('page head has JSON-LD', pageHead, 'application/ld+json');
  mustContain('page head has Yandex', pageHead, 'mc.yandex.ru');
  mustContain('page chrome exposes slot', pageChrome, '<slot />');
  mustContain('page chrome keeps mobile sheet', pageChrome, 'id="gbs2Sheet"');
  mustContain('page chrome keeps bookmark runtime', pageChrome, 'bookmark-engine.js');
  mustContain('page chrome keeps site runtime', pageChrome, 'site.js');
  mustContain('main shell renders main-content', shell, '<main id="main-content">');
  mustContain('main shell uses header', shell, 'GillSpravochnikHeaderHero');
  mustContain('main shell uses article body', shell, 'GillSpravochnikArticleBody');
  mustContain('main shell uses post article', shell, 'GillSpravochnikPostArticle');
  mustContain('body component owns article wrapper', body, '<article class="article-body" data-pagefind-body>');
  for (const comp of SECTION_COMPONENTS) mustContain(`body imports ${comp}`, body, comp.replace(/\.astro$/, ''));
  for (const marker of ['class="gbs2-hero"', 'Джон Гилл: справочник', 'summary-card', 'id="sec-prdl"', 'id="sec-timeline"', 'id="sec-works"', 'id="sec-body-structure"', 'id="sec-network"', 'id="sec-disputes"', 'id="sec-terms"', 'id="sec-links"', 'id="sec-quiz"', 'gbs2-next', 'gbs2-timeline', 'article-end-sdg-wrap']) {
    mustContain('reconstructed body marker', reconstructed, marker);
  }
  if (normalize(reconstructed) === normalize(legacyBody)) ok('reconstructed body matches legacy body after normalization');
  else bad('reconstructed body differs from legacy body after normalization');
  const lw = wordCount(legacyBody), rw = wordCount(reconstructed);
  lw === rw ? ok(`word-count parity: ${lw}`) : bad(`word-count drift: legacy=${lw}, reconstructed=${rw}`);
  const lh = h2Count(legacyBody), rh = h2Count(reconstructed);
  lh === rh ? ok(`H2 parity: ${lh}`) : bad(`H2 drift: legacy=${lh}, reconstructed=${rh}`);
}

console.log('');
if (problems.length) {
  console.log(`❌ Gill spravochnik strict-native audit failed: ${problems.length} issue(s)`);
  process.exit(1);
}
console.log('✅ Gill spravochnik strict-native audit passed');
