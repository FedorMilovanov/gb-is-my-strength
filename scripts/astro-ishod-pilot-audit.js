#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const NO_BUILD = process.argv.includes('--no-build');
const ROUTE = 'karty/ishod/index.html';
const URL = 'https://gospod-bog.ru/karty/ishod/';

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
    .replace(/\s+/g, ' ').trim();
}
function ownText(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  return stripTags(html.match(re)?.[1] || '');
}
function title(html) { return ownText(html, 'title'); }
function meta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<meta\\b([^>]*\\b(?:name|property)=["']${escaped}["'][^>]*)>`, 'i');
  const m = html.match(re);
  return m?.[1]?.match(new RegExp(`\\bcontent=["']([^"']*)["']`, 'i'))?.[1]?.trim() || '';
}
function canonical(html) {
  const links = [...html.matchAll(/<link\b([^>]+)>/gi)];
  for (const link of links) {
    if (!/\brel=["']canonical["']/i.test(link[1])) continue;
    return link[1].match(/\bhref=["']([^"']+)["']/i)?.[1]?.trim() || '';
  }
  return '';
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
  
  const robotsTag = meta(astro, 'robots');
  if (/\bnoindex\b/i.test(robotsTag)) bad(`ishod unexpectedly noindex: ${robotsTag}`);
  else ok('ishod is indexable');

  mustContain('ishod pagefind body', astro, 'data-pagefind-body');
  mustContain('ishod sr-only SEO text', astro, 'Исход из Египта');
  
  // Refactoring 5.0: unfinished engine maps are intentionally hidden behind
  // visual-audit holding pages until they pass route-specific screenshots.
  mustContain('ishod holding page marker', astro, 'Визуальный аудит карт');
  if (/id="mapRoot"|map-engine\.js|route\.json/.test(astro)) bad('ishod holding page must not expose unfinished live MapEngine UI');
  else ok('ishod unfinished live MapEngine UI is not exposed');
  
  console.log('');
  if (problems.length) {
    console.log(`❌ astro ishod shadow audit failed: ${problems.length} issue(s)`);
    process.exit(1);
  }
  console.log('✅ astro ishod shadow audit passed');
}

main();
