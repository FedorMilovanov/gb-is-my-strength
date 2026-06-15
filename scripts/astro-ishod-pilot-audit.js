#!/usr/bin/env node
/*
 * astro-ishod-pilot-audit.js — compare legacy /karty/ishod/ vs Astro dist /karty/ishod/.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const NO_BUILD = process.argv.includes('--no-build');
const ROUTE = 'karty/ishod/index.html';
const URL = 'https://gospod-bog.ru/karty/ishod/';
const MIN_WORD_RATIO = 0.9;

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
function hasNoindex(html) {
  return /\bnoindex\b/i.test(meta(html, 'robots'));
}
function wordCount(html) {
  const text = stripTags(html);
  return (text.match(/[A-Za-zА-Яа-яЁё0-9]{2,}/g) || []).length;
}
function runBuild() {
  if (NO_BUILD) return;
  console.log('▶ Building production-like strangler dist for ishod audit…');
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
  console.log(`ASTRO ISHOD SHADOW AUDIT (${NO_BUILD ? 'no-build' : 'build'})`);
  runBuild();

  const legacyPath = path.join(ROOT, ROUTE);
  const distPath = path.join(DIST, ROUTE);
  if (!fs.existsSync(legacyPath)) return bad(`legacy route missing: ${ROUTE}`);
  if (!fs.existsSync(distPath)) return bad(`dist route missing: ${ROUTE}`);

  const legacy = read(legacyPath);
  const astro = read(distPath);

  mustEqual('ishod canonical', canonical(astro), URL);
  mustEqual('ishod title mirrors legacy', title(astro), title(legacy));
  mustEqual('ishod meta description mirrors legacy', meta(astro, 'description'), meta(legacy, 'description'));
  mustEqual('ishod H1 mirrors legacy', h1(astro), h1(legacy));
  if (hasNoindex(astro)) bad(`ishod unexpectedly noindex: ${meta(astro, 'robots')}`);
  else ok('ishod is indexable');
  mustContain('ishod Astro marker', astro, 'astro-ishod-map-page');
  mustContain('ishod pagefind body', astro, 'data-pagefind-body');
  mustContain('ishod route stages block', astro, 'Маршрут в шести этапах');

  const legacyWords = wordCount(legacy);
  const astroWords = wordCount(astro);
  const ratio = astroWords / Math.max(1, legacyWords);
  console.log(`ishod words: legacy=${legacyWords}; astro=${astroWords}; ratio=${ratio.toFixed(2)}`);
  if (ratio < MIN_WORD_RATIO) bad(`ishod word-count ratio too low: ${ratio.toFixed(2)} < ${MIN_WORD_RATIO}`);
  else ok(`ishod word-count parity within threshold (${ratio.toFixed(2)})`);

  const stageCount = (astro.match(/class="astro-card astro-ishod-stage-card"/g) || []).length;
  if (stageCount !== 6) note(`ishod stage card count expected 6, got ${stageCount}`);
  else ok('ishod stage card count matches route schema');

  console.log('');
  if (problems.length) {
    console.log(`❌ astro ishod shadow audit failed: ${problems.length} issue(s)`);
    process.exit(1);
  }
  console.log('✅ astro ishod shadow audit passed');
  if (notes.length) console.log('ℹ️ Notes remain for future full map-app pass.');
}

main();
