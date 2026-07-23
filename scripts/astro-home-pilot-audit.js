#!/usr/bin/env node
/*
 * astro-home-pilot-audit.js — compare legacy / vs Astro dist /.
 *
 * Static contract guard for the shadow-owned home page. This is intentionally
 * lighter than a full browser visual audit but stricter than plain URL contract.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SITE = 'https://gospod-bog.ru/';
const NO_BUILD = process.argv.includes('--no-build');
const MIN_WORD_RATIO = 0.72;

const problems = [];
const notes = [];

function ok(msg) { console.log(`✅ ${msg}`); }
function note(msg) { notes.push(msg); console.log(`ℹ️ ${msg}`); }
function bad(msg) { problems.push(msg); console.log(`❌ ${msg}`); }
function read(file) { return fs.readFileSync(file, 'utf8'); }
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
function wordCount(html) {
  const text = stripTags(html);
  return (text.match(/[A-Za-zА-Яа-яЁё0-9]{2,}/g) || []).length;
}
function hasNoindex(html) {
  return /\bnoindex\b/i.test(meta(html, 'robots'));
}
function runBuild() {
  if (NO_BUILD) return;
  console.log('▶ Building production-like strangler dist for home audit…');
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

function main() {
  console.log(`ASTRO HOME SHADOW AUDIT (${NO_BUILD ? 'no-build' : 'build'})`);
  runBuild();

  const legacyFile = path.join(ROOT, 'index.html');
  const distFile = path.join(DIST, 'index.html');
  if (!fs.existsSync(legacyFile)) return bad('legacy root index.html missing');
  if (!fs.existsSync(distFile)) return bad('dist/index.html missing');

  const legacy = read(legacyFile);
  const astro = read(distFile);

  if (/Astro shadow-pilot/i.test(stripTags(astro))) bad('public Astro home still contains technical shadow badge');
  else ok('public Astro home has no technical shadow badge');

  mustEqual('home canonical', canonical(astro), SITE);
  mustEqual('home title mirrors legacy', title(astro), title(legacy));
  mustEqual('home meta description mirrors legacy', meta(astro, 'description'), meta(legacy, 'description'));
  mustEqual('home H1 mirrors legacy', h1(astro), h1(legacy));
  if (hasNoindex(astro)) bad(`home unexpectedly noindex: ${meta(astro, 'robots')}`);
  else ok('home is indexable');
  mustContain('home pagefind body', astro, 'data-pagefind-body');
  mustContain('home responsive library gateway', astro, 'h-home-gateway');
  mustContain('home interactive Habakkuk text', astro, 'Аввакум 3:19');
  for (const rejected of ['h-mobile-dock', 'h-mobile-dashboard', 'h-mobile-rail', 'h-mobile-paths', 'h-mobile-hero-hub']) {
    if (astro.includes(rejected)) bad(`home contains rejected mobile experiment: ${rejected}`);
    else ok(`home has no rejected mobile experiment: ${rejected}`);
  }

  const legacyWords = wordCount(legacy);
  const astroWords = wordCount(astro);
  const ratio = astroWords / Math.max(1, legacyWords);
  console.log(`home words: legacy=${legacyWords}; astro=${astroWords}; ratio=${ratio.toFixed(2)}`);
  if (ratio < MIN_WORD_RATIO) bad(`home word-count ratio too low: ${ratio.toFixed(2)} < ${MIN_WORD_RATIO}`);
  else ok(`home word-count parity within threshold (${ratio.toFixed(2)})`);

  const cardCount =
    (astro.match(/astro-series-card/g) || []).length +
    (astro.match(/astro-article-card/g) || []).length +
    (astro.match(/h-featured-series/g) || []).length +
    (astro.match(/h-article-card/g) || []).length +
    (astro.match(/h-home-route/g) || []).length;
  if (cardCount < 8) note(`home card count looks thin (${cardCount}); mobile-first IA pass still recommended`);
  else ok(`home has substantial card structure (${cardCount} cards)`);

  console.log('');
  if (problems.length) {
    console.log(`❌ astro home shadow audit failed: ${problems.length} issue(s)`);
    process.exit(1);
  }
  console.log('✅ astro home shadow audit passed');
  if (notes.length) console.log('ℹ️ Home audit notes remain for the future mobile-first polish pass.');
}

main();
