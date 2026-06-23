#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEGACY_REL = 'articles/dzhon-gill-chast-1-chelovek/index.html';
const PAGE_REL = 'src/pages/articles/dzhon-gill-chast-1-chelovek/index.astro';
const BASE_REL = 'src/components/article-pilots/gill-part1';
const REQUIRED = {
  pageHead: `${BASE_REL}/GillPart1PageHead.astro`,
  pageChrome: `${BASE_REL}/GillPart1PageChrome.astro`,
  shell: `${BASE_REL}/GillPart1MainShell.astro`,
  header: `${BASE_REL}/GillPart1HeaderHero.astro`,
  body: `${BASE_REL}/GillPart1ArticleBody.astro`,
  post: `${BASE_REL}/GillPart1PostArticle.astro`,
};
const SECTION_COMPONENTS = [
  'GillPart1SectionSeriesAndHero.astro',
  'GillPart1SectionCallingHeading.astro',
  'GillPart1SectionIntro.astro',
  'GillPart1SectionBirthProphecy.astro',
  'GillPart1SectionEducation.astro',
  'GillPart1SectionConversion.astro',
  'GillPart1SectionPastorHeading.astro',
  'GillPart1SectionPastor.astro',
  'GillPart1SectionIllnessFamily.astro',
  'GillPart1SectionEvangelism.astro',
  'GillPart1SectionGoatyardDecl.astro',
  'GillPart1SectionDaughterSermon.astro',
  'GillPart1SectionFamilyDeep.astro',
  'GillPart1SectionOrdination1720.astro',
  'GillPart1SectionPersonalCredo.astro',
  'GillPart1SectionContextSouthwark.astro',
  'GillPart1SectionLastWordsWife.astro',
  'GillPart1SectionSkeppDetail.astro',
  'GillPart1SectionSourcesPart1.astro',
  'GillPart1SectionQuizTail.astro',
];
const FORBIDDEN = ['loadLegacyFullDocument', 'headHtml', 'bodyHtml', 'bodyAttributes', '?raw', 'set:html', '_legacy'];
const problems = [];

function ok(msg){ console.log(`✅ ${msg}`); }
function bad(msg){ problems.push(msg); console.log(`❌ ${msg}`); }
function abs(rel){ return path.join(ROOT, rel); }
function exists(rel){ return fs.existsSync(abs(rel)); }
function read(rel){ return fs.readFileSync(abs(rel), 'utf8'); }
function mustExist(label, rel){ exists(rel) ? ok(`${label}: ${rel}`) : bad(`${label} missing: ${rel}`); }
function mustNotExist(label, rel){ !exists(rel) ? ok(`${label}: ${rel} absent`) : bad(`${label}: ${rel} must be absent`); }
function mustContain(label, text, needle){ String(text).includes(needle) ? ok(`${label}: contains ${needle}`) : bad(`${label}: missing ${needle}`); }
function mustNotContain(label, text, needle){ !String(text).includes(needle) ? ok(`${label}: no ${needle}`) : bad(`${label}: forbidden ${needle}`); }
function bodyInner(html){ return html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || ''; }
function stripTags(html){
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;|&#160;/g,' ')
    .replace(/&[a-z0-9#]+;/gi,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function words(html){ return (stripTags(html).match(/[A-Za-zА-Яа-яЁё0-9]{2,}/g)||[]).length; }
function count(html, re){ return (String(html||'').match(re)||[]).length; }
function normalize(html){
  return String(html || '')
    .replace(/\s+is:inline(?=\s|>)/g, '')
    .replace(/\s+data-pagefind-body(?=\s|>)/g, '')
    .replace(/viewBox=/g, 'viewbox=')
    .replace(/\/>/g, '>')
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
}

console.log('GILL PART I STRICT-NATIVE AUDIT');
mustExist('legacy route', LEGACY_REL);
mustExist('Astro route', PAGE_REL);
for (const [label, rel] of Object.entries(REQUIRED)) mustExist(label, rel);
mustNotExist('legacy part1 directory retired', `${BASE_REL}/_legacy`);
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
  const reconstructed = pageChrome.replace('<slot />', main);
  const scopeText = [page, pageHead, pageChrome, shell, header, body, post, ...SECTION_COMPONENTS.map((name) => read(`${BASE_REL}/${name}`))].join('\n');

  for (const token of FORBIDDEN) mustNotContain('strict-native source scope', scopeText, token);
  mustContain('route imports native page head', page, 'GillPart1PageHead');
  mustContain('route imports native page chrome', page, 'GillPart1PageChrome');
  mustContain('route imports native main shell', page, 'GillPart1MainShell');
  mustContain('route sets explicit body class', page, 'class="gbs-world"');
  mustContain('route sets explicit done minutes', page, 'data-gbs2-done-min="16"');
  mustContain('route sets explicit part minutes', page, 'data-gbs2-part-min="32"');
  mustContain('page head has canonical', pageHead, 'rel="canonical"');
  mustContain('page head has SITE_CONFIG', pageHead, 'window.SITE_CONFIG');
  mustContain('page head has JSON-LD', pageHead, 'application/ld+json');
  mustContain('page head has Yandex', pageHead, 'mc.yandex.ru');
  mustContain('page chrome exposes slot', pageChrome, '<slot />');
  mustContain('page chrome keeps mobile sheet', pageChrome, 'id="gbs2Sheet"');
  mustContain('page chrome keeps bookmark runtime', pageChrome, 'bookmark-engine.js');
  mustContain('page chrome keeps site runtime', pageChrome, 'site.js');
  mustContain('main shell renders main-content', shell, '<main id="main-content">');
  mustContain('main shell uses header', shell, 'GillPart1HeaderHero');
  mustContain('main shell uses article body', shell, 'GillPart1ArticleBody');
  mustContain('main shell uses post article', shell, 'GillPart1PostArticle');
  mustContain('body component owns article wrapper', body, '<article class="article-body" data-pagefind-body>');
  for (const comp of SECTION_COMPONENTS) mustContain(`body imports ${comp}`, body, comp.replace(/\.astro$/, ''));
  for (const marker of ['class="gbs2-hero"', 'Джон Гилл (1697–1771)', 'id="part-calling"', 'id="sec-intro"', 'id="sec-birth-prophecy"', 'id="part-pastor"', 'id="sec-goatyardDecl"', 'id="sec-ordination-1720"', 'id="sec-sources-part1"', 'id="sec-quiz"', 'gbs2-next', 'gbs2-timeline', 'article-end-sdg-wrap']) {
    mustContain('reconstructed body marker', reconstructed, marker);
  }
  if (normalize(reconstructed) === normalize(legacyBody)) ok('reconstructed body matches legacy body after normalization');
  else bad('reconstructed body differs from legacy body after normalization');
  const lw = words(legacyBody), rw = words(reconstructed);
  lw === rw ? ok(`word-count parity: ${lw}`) : bad(`word-count drift: legacy=${lw}, reconstructed=${rw}`);
  const legacyH2 = count(legacyBody, /<h2\b/gi), reconH2 = count(reconstructed, /<h2\b/gi);
  legacyH2 === reconH2 ? ok(`H2 parity: ${legacyH2}`) : bad(`H2 drift: legacy=${legacyH2}, reconstructed=${reconH2}`);
  const legacyH3 = count(legacyBody, /<h3\b/gi), reconH3 = count(reconstructed, /<h3\b/gi);
  legacyH3 === reconH3 ? ok(`H3 parity: ${legacyH3}`) : bad(`H3 drift: legacy=${legacyH3}, reconstructed=${reconH3}`);
}

console.log('');
if (problems.length) {
  console.log(`❌ Gill Part I strict-native audit failed: ${problems.length} issue(s)`);
  process.exit(1);
}
console.log('✅ Gill Part I strict-native audit passed');
