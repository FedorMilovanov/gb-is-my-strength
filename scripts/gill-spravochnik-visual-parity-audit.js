#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  legacyIsAuthoritative,
  loadRouteProfile,
} = require('./lib/legacy-source-authority');

const ROOT = path.join(__dirname, '..');
const ROUTE = '/articles/dzhon-gill-spravochnik/';
const LEGACY_REL = 'articles/dzhon-gill-spravochnik/index.html';
const PAGE_REL = 'src/pages/articles/dzhon-gill-spravochnik/index.astro';
const BASE_REL = 'src/components/article-pilots/gill-spravochnik';
const SHARED_CHROME_REL = 'src/components/article-pilots/gill-series/GillSeriesChrome.astro';
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
const REQUIRE_DIST = process.argv.includes('--require-dist');
const DIST_REL = 'dist/articles/dzhon-gill-spravochnik/index.html';
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
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
function bodyInner(html) { return String(html || '').match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || ''; }
function articleInner(html) {
  return String(html || '').match(/<article\b[^>]*class=["'][^"']*\barticle-body\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/i)?.[1] || '';
}
function stripFrontmatter(source) { return String(source || '').replace(/^---[\s\S]*?---\s*/, ''); }
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
function hasScriptSource(html, fileName) {
  const escaped = String(fileName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<script\\b[^>]*\\bsrc=["'][^"']*(?:^|/)${escaped}(?:[?#][^"']*)?["'][^>]*>`, 'i').test(String(html || ''));
}
function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function findElementRangeByClass(html, className) {
  const openRe = /<([a-zA-Z][\w:-]*)\b[^>]*\bclass\s*=\s*(["'])([^"']*)\2[^>]*>/gi;
  let match;
  while ((match = openRe.exec(html))) {
    if (!match[3].trim().split(/\s+/).includes(className)) continue;
    const start = match.index;
    const openEnd = start + match[0].length;
    const tag = match[1].toLowerCase();
    if (VOID_TAGS.has(tag) || /\/\s*>$/.test(match[0])) return { start, end: openEnd };
    const tagRe = new RegExp(`<\/?${escapeRegExp(tag)}\\b[^>]*>`, 'gi');
    tagRe.lastIndex = openEnd;
    let depth = 1;
    let token;
    while ((token = tagRe.exec(html))) {
      if (/^<\//.test(token[0])) depth -= 1;
      else if (!/\/\s*>$/.test(token[0]) && !VOID_TAGS.has(tag)) depth += 1;
      if (depth === 0) return { start, end: tagRe.lastIndex };
    }
    throw new Error(`Unbalanced <${tag}> for .${className}`);
  }
  return null;
}
function removeElementsByClass(html, className) {
  let output = String(html || '');
  while (true) {
    const range = findElementRangeByClass(output, className);
    if (!range) return output;
    output = `${output.slice(0, range.start)}${output.slice(range.end)}`;
  }
}

console.log('GILL SPRAVOCHNIK STRICT-NATIVE AUDIT');
mustExist('legacy route', LEGACY_REL);
mustExist('Astro route', PAGE_REL);
for (const [label, rel] of Object.entries(REQUIRED)) mustExist(label, rel);
mustNotExist('legacy spravochnik directory retired', `${BASE_REL}/_legacy`);
for (const component of SECTION_COMPONENTS) mustExist(`section component ${component}`, `${BASE_REL}/${component}`);

const { file: profileFile, profile } = loadRouteProfile(ROUTE);
if (!profileFile || !profile) {
  bad(`route profile missing for ${ROUTE}`);
} else {
  const profileRel = path.relative(ROOT, profileFile).replace(/\\/g, '/');
  ok(`route profile: ${profileRel}`);
  profile.route === ROUTE ? ok('route profile path matches') : bad(`route profile path mismatch: ${profile.route}`);
  profile.renderSource === PAGE_REL ? ok('route profile render source matches native entry') : bad(`route profile render source mismatch: ${profile.renderSource}`);
  profile.legacyPath === LEGACY_REL ? ok('route profile legacy reference matches') : bad(`route profile legacy path mismatch: ${profile.legacyPath}`);
  profile.migrationMode === 'strict-native' ? ok('route profile is strict-native') : bad(`route profile migration mode is ${profile.migrationMode}`);
}

if (!problems.length) {
  const page = read(PAGE_REL);
  const pageHead = read(REQUIRED.pageHead);
  const pageChrome = read(REQUIRED.pageChrome);
  const sharedChrome = read(SHARED_CHROME_REL);
  const pageChromeContract = `${pageChrome}\n${sharedChrome}`;
  const shell = read(REQUIRED.shell);
  const header = read(REQUIRED.header);
  const body = read(REQUIRED.body);
  const post = read(REQUIRED.post);
  const legacyHtml = read(LEGACY_REL);
  const legacyBody = articleInner(legacyHtml) || bodyInner(legacyHtml);
  const sectionHtml = SECTION_COMPONENTS.map((name) => read(`${BASE_REL}/${name}`)).join('');
  const article = `<article class="article-body" data-pagefind-body>${sectionHtml}</article>`;
  const main = `<main id="main-content">${header}${article}${post}</main>`;
  const reconstructed = stripFrontmatter(sharedChrome).replace('<slot />', main);
  const scopeText = [page, pageHead, pageChrome, sharedChrome, shell, header, body, post, ...SECTION_COMPONENTS.map((name) => read(`${BASE_REL}/${name}`))].join('\n');
  let distHtml = '';
  if (exists(DIST_REL)) {
    distHtml = read(DIST_REL);
    ok('dist page present for runtime parity');
  } else if (REQUIRE_DIST) bad(`dist page required but missing: ${DIST_REL}`);
  else console.log('ℹ️ dist not built — dist-level assertions skipped');

  for (const token of FORBIDDEN) mustNotContain('strict-native source scope', scopeText, token);
  mustContain('route imports native page head', page, 'GillSpravochnikPageHead');
  mustContain('route imports native page chrome', page, 'GillSpravochnikPageChrome');
  mustContain('route imports native main shell', page, 'GillSpravochnikMainShell');
  mustContain('route sets explicit body class', page, 'class="gbs-world"');
  if (page.includes('data-gbs2-done-min="141"') || page.includes('data-gbs2-done-min={pageData.readingProgressDoneMin}')) ok('route sets explicit done minutes'); else bad('route sets explicit done minutes missing');
  if (page.includes('data-gbs2-part-min="8"') || page.includes('data-gbs2-part-min={pageData.readingProgressPartMin}')) ok('route sets explicit part minutes'); else bad('route sets explicit part minutes missing');
  mustContain('page head has canonical', pageHead, 'rel="canonical"');
  mustContain('page head has SITE_CONFIG', pageHead, 'window.SITE_CONFIG');
  mustContain('page head has JSON-LD', pageHead, 'application/ld+json');
  mustContain('page head has Yandex', pageHead, 'mc.yandex.ru');
  mustContain('page chrome exposes slot', pageChromeContract, '<slot />');
  if (pageChromeContract.includes('toc-overlay') || pageChromeContract.includes('GillSeriesOverlay')) ok('page chrome has v16 toc popup'); else bad('page chrome has v16 toc popup missing');
  mustContain('page chrome keeps bookmark runtime', pageChromeContract, 'bookmark-engine.js');
  mustContain('page chrome keeps shared site utilities', pageChromeContract, 'site-utils.js');
  mustContain('page chrome keeps glossary runtime', pageChromeContract, 'glossary.js');
  mustContain('page chrome owns native reader runtime', pageChromeContract, 'ReaderActionsRuntime');
  hasScriptSource(pageChromeContract, 'site.js') ? bad('page chrome must not restore legacy site.js ownership') : ok('page chrome excludes legacy site.js ownership');

  if (distHtml) {
    mustContain('dist keeps v16 toc popup', distHtml, 'toc-overlay');
    mustContain('dist keeps bookmark runtime', distHtml, 'bookmark-engine.js');
    mustContain('dist keeps shared site utilities', distHtml, 'site-utils.js');
    mustContain('dist keeps glossary runtime', distHtml, 'glossary.js');
    hasScriptSource(distHtml, 'site.js') ? bad('dist must not restore legacy site.js ownership') : ok('dist excludes legacy site.js ownership');
    /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=/i.test(distHtml) ? ok('dist contains native module runtime') : bad('dist native module runtime missing');
    mustContain('dist has data-gill-v16 marker', distHtml, 'data-gill-v16');
    mustContain('dist has label series mark', distHtml, 'gb-series-mark--label');
    mustNotContain('dist does not contain forbidden Часть 1 из 5', distHtml, 'Часть 1 из 5');
    mustNotContain('dist does not contain forbidden Часть 0', distHtml, 'Часть 0');
  }

  mustContain('main shell renders main-content', shell, '<main id="main-content">');
  mustContain('main shell uses header', shell, 'GillSpravochnikHeaderHero');
  mustContain('main shell uses article body', shell, 'GillSpravochnikArticleBody');
  mustContain('main shell uses post article', shell, 'GillSpravochnikPostArticle');
  mustContain('body component owns article wrapper', body, '<article class="article-body" data-pagefind-body>');
  for (const component of SECTION_COMPONENTS) mustContain(`body imports ${component}`, body, component.replace(/\.astro$/, ''));
  for (const marker of ['class="gbs2-hero"', 'Джон Гилл: справочник', 'summary-card', 'id="sec-prdl"', 'id="sec-timeline"', 'id="sec-works"', 'id="sec-body-structure"', 'id="sec-network"', 'id="sec-disputes"', 'id="sec-terms"', 'id="sec-links"', 'id="sec-quiz"', 'gbs2-next', 'gbs2-timeline', 'article-end-sdg-wrap']) mustContain('reconstructed body marker', reconstructed, marker);
  if (normalize(reconstructed) === normalize(legacyBody)) ok('reconstructed article matches legacy article after normalization');
  else console.log(`⚠ reconstructed article differs from legacy reference (legacyStatus=${profile.legacyStatus}; exact equality is non-blocking)`);

  const legacyWords = wordCount(legacyBody);
  const nativeWords = wordCount(reconstructed);
  if (legacyIsAuthoritative(profile)) {
    const drift = Math.abs(legacyWords - nativeWords);
    drift <= 200 ? ok(`authoritative legacy word-count within tolerance: legacy=${legacyWords}, reconstructed=${nativeWords}, drift=${drift}`) : bad(`authoritative legacy word-count drift: legacy=${legacyWords}, reconstructed=${nativeWords}`);
  } else if (profile.legacyStatus === 'reference-only') {
    nativeWords >= legacyWords ? ok(`reference-only legacy is a lower-bound safeguard: legacy=${legacyWords}, native=${nativeWords}`) : bad(`strict-native source regressed below reference-only snapshot: legacy=${legacyWords}, native=${nativeWords}`);
  } else bad(`unsupported non-authoritative legacy status: ${profile.legacyStatus || 'missing'}`);

  const legacyH2 = h2Count(legacyBody);
  if (distHtml) {
    const distArticle = articleInner(distHtml);
    if (!distArticle) bad('dist article-body scope missing');
    else {
      const editorialArticle = removeElementsByClass(distArticle, 'gb-relations-panel');
      const distH2 = h2Count(editorialArticle);
      legacyH2 === distH2 ? ok(`H2 parity (editorial article body): ${distH2}`) : bad(`H2 drift: legacy=${legacyH2}, distEditorial=${distH2}`);
    }
  } else {
    const reconstructedH2 = h2Count(reconstructed);
    Math.abs(legacyH2 - reconstructedH2) <= 1 ? ok(`H2 parity within shared-chrome tolerance: legacy=${legacyH2}, reconstructed=${reconstructedH2}`) : bad(`H2 drift: legacy=${legacyH2}, reconstructed=${reconstructedH2}`);
  }
}

console.log('');
if (problems.length) {
  console.log(`❌ Gill spravochnik strict-native audit failed: ${problems.length} issue(s)`);
  process.exit(1);
}
console.log('✅ Gill spravochnik strict-native audit passed');
