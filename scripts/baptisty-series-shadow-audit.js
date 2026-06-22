#!/usr/bin/env node
/*
 * baptisty-series-shadow-audit.js — audit public Astro shadow routes for
 * /baptisty-rossii/* series pages.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SITE = 'https://gospod-bog.ru';
const NO_BUILD = process.argv.includes('--no-build');
const MIN_WORD_RATIO = 0.8;
const NATIVE_SHADOW_ROUTES = ['dva-sezda-1884', 'noch-na-kure'];
const ROUTES = [
  'noch-na-kure',
  'yuzhnaya-shtunda',
  'dva-sezda-1884',
  'peterburgskaya-liniya',
  'goneniya-i-sovest',
  'sovetskaya-noch',
  'vsehib-1944',
  'iniciativnaya-gruppa',
  'podpolnaya-pechat',
  'spravochnik',
];

const problems = [];
const notes = [];

function ok(msg) { console.log(`✅ ${msg}`); }
function note(msg) { notes.push(msg); console.log(`ℹ️ ${msg}`); }
function bad(msg) { problems.push(msg); console.log(`❌ ${msg}`); }
function file(rel) { return path.join(ROOT, rel); }
function distFile(rel) { return path.join(DIST, rel); }
function read(abs) { return fs.readFileSync(abs, 'utf8'); }
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
function ownText(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  return stripTags(html.match(re)?.[1] || '');
}
function title(html) { return ownText(html, 'title'); }
function h1(html) { return ownText(html, 'h1'); }
function meta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<meta\\b([^>]*\\b(?:name|property)=["']${escaped}["'][^>]*)>`, 'i');
  const m = html.match(re);
  return m?.[1]?.match(/\bcontent=["']([^"']*)["']/i)?.[1]?.trim() || '';
}
function canonical(html) {
  const links = [...html.matchAll(/<link\b([^>]+)>/gi)];
  for (const link of links) {
    const attrs = link[1];
    if (!/\brel=["']canonical["']/i.test(attrs)) continue;
    return attrs.match(/\bhref=["']([^"']+)["']/i)?.[1]?.trim() || '';
  }
  return '';
}
function hasNoindex(html) {
  return /\bnoindex\b/i.test(meta(html, 'robots'));
}
function wordCount(html) {
  const text = stripTags(html);
  return (text.match(/[A-Za-zА-Яа-яЁё0-9]{2,}/g) || []).length;
}
function runBuild() {
  if (NO_BUILD) return;
  console.log('▶ Building production-like strangler dist for baptisty series audit…');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const res = spawnSync(npm, ['run', 'strangler:build:production-like'], { cwd: ROOT, stdio: 'inherit' });
  if (res.status !== 0) process.exit(res.status || 1);
}
function mustEqual(label, actual, expected) {
  if (actual === expected) ok(`${label}: ${expected}`);
  else bad(`${label}: expected "${expected}", got "${actual}"`);
}
function mustContain(label, html, needle) {
  if (String(html || '').includes(needle)) ok(`${label}: contains ${needle}`);
  else bad(`${label}: missing ${needle}`);
}

function auditNativeShadowSource(slug) {
  if (!NATIVE_SHADOW_ROUTES.includes(slug)) return;
  const pagePath = file(`src/pages/baptisty-rossii/${slug}/index.astro`);
  if (!fs.existsSync(pagePath)) return bad(`${slug}: native-shadow Astro page missing`);
  const src = read(pagePath);

  const legacyDir = file(`src/components/baptisty-rossii/_legacy/${slug}`);
  if (!fs.existsSync(legacyDir)) return bad(`${slug}: native-shadow _legacy directory missing`);
  for (const f of ['body-segment-0.html', 'body-segment-1.html', 'main.html']) {
    if (!fs.existsSync(path.join(legacyDir, f))) bad(`${slug}: native-shadow _legacy/${f} missing`);
    else ok(`${slug}: native-shadow _legacy/${f} present`);
  }

  if (src.includes('BaptistyRossiiArticleMain')) ok(`${slug}: uses BaptistyRossiiArticleMain component`);
  else bad(`${slug}: native-shadow page must use BaptistyRossiiArticleMain`);

  if (src.includes('_legacy/' + slug + '/body-segment-0.html')) ok(`${slug}: imports body-segment-0.html`);
  else bad(`${slug}: native-shadow page must import body-segment-0.html`);

  if (src.includes('_legacy/' + slug + '/body-segment-1.html')) ok(`${slug}: imports body-segment-1.html`);
  else bad(`${slug}: native-shadow page must import body-segment-1.html`);

  if (!src.includes('bodyHtml')) ok(`${slug}: no full-body shadow bodyHtml (native-shadow recipe)`);
  else bad(`${slug}: native-shadow page must NOT import bodyHtml from loadLegacyFullDocument`);
}

function auditSlug(slug) {
  console.log(`\nBAPTISTY: ${slug}`);
  const rel = `baptisty-rossii/${slug}/index.html`;
  const legacyPath = file(rel);
  const publicPath = distFile(rel);
  if (!fs.existsSync(legacyPath)) return bad(`${slug}: legacy page missing`);
  if (!fs.existsSync(publicPath)) return bad(`${slug}: dist page missing`);

  const legacy = read(legacyPath);
  const astro = read(publicPath);
  const url = `${SITE}/baptisty-rossii/${slug}/`;

  if (!/class="gbs2-world"/.test(astro)) bad(`${slug}: dist route is not SeriesArticleLayout output`);
  else ok(`${slug}: dist route is SeriesArticleLayout output`);

  mustEqual(`${slug} canonical`, canonical(astro), url);
  mustEqual(`${slug} title mirrors legacy`, title(astro), title(legacy));
  mustEqual(`${slug} description mirrors legacy`, meta(astro, 'description'), meta(legacy, 'description'));
  mustEqual(`${slug} H1 mirrors legacy`, h1(astro), h1(legacy));

  if (hasNoindex(astro)) bad(`${slug}: page is unexpectedly noindex`);
  else ok(`${slug}: page is indexable`);

  mustContain(`${slug} pagefind body`, astro, 'data-pagefind-body');
  mustContain(`${slug} series sidebar rail`, astro, 'gbs2-rail');
  mustContain(`${slug} cycle link`, astro, '/baptisty-rossii/');
  mustContain(`${slug} map link`, astro, '/konfessii/russkij-baptizm/');
  mustContain(`${slug} series parts nav`, astro, 'gbs2-parts');
  mustContain(`${slug} series next nav`, astro, 'gbs2-next');
  mustContain(`${slug} series timeline`, astro, 'gbs2-timeline');
  mustContain(`${slug} author card`, astro, 'author-card');
  mustContain(`${slug} progress ring`, astro, 'gbs2-ring');
  mustContain(`${slug} mobile header`, astro, 'gbs2-mobile-head');
  mustContain(`${slug} mobile sheet`, astro, 'gbs2-sheet');

  const legacyWords = wordCount(legacy);
  const astroWords = wordCount(astro);
  const ratio = astroWords / Math.max(1, legacyWords);
  console.log(`${slug} words: legacy=${legacyWords}; astro=${astroWords}; ratio=${ratio.toFixed(2)}`);
  if (ratio < MIN_WORD_RATIO) bad(`${slug}: word-count ratio too low (${ratio.toFixed(2)} < ${MIN_WORD_RATIO})`);
  else ok(`${slug}: word-count parity within threshold`);

  if (!/og:image:type/.test(astro)) note(`${slug}: og:image:type not found as plain text; verify via head parser if needed`);

  auditNativeShadowSource(slug);
}

function main() {
  console.log(`BAPTISTY SERIES SHADOW AUDIT (${NO_BUILD ? 'no-build' : 'build'})`);
  runBuild();
  for (const slug of ROUTES) auditSlug(slug);
  console.log('');
  if (problems.length) {
    console.log(`❌ baptisty series shadow audit failed: ${problems.length} issue(s)`);
    process.exit(1);
  }
  console.log(`✅ baptisty series shadow audit passed (${ROUTES.length} route(s))`);
  if (notes.length) console.log('ℹ️ Notes remain until full GBS-parity audit exists.');
}

main();
