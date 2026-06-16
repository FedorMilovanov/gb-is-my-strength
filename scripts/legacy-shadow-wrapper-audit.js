#!/usr/bin/env node
/*
 * legacy-shadow-wrapper-audit.js — verify legacy-faithful Astro wrappers.
 *
 * Covers raw-shadow routes where Astro ownership is achieved by preserving the
 * legacy HTML body almost 1:1 while moving publication control to src/pages.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const NO_BUILD = process.argv.includes('--no-build');
const ROUTES = [
  { rel: 'map/index.html', url: 'https://gospod-bog.ru/map/', marker: 'astro-map-shadow', ratio: 0.95 },
  { rel: 'karty/avraam/index.html', url: 'https://gospod-bog.ru/karty/avraam/', marker: 'astro-avraam-shadow', ratio: 0.95 },
  { rel: 'nagornaya/chast-1/index.html', url: 'https://gospod-bog.ru/nagornaya/chast-1/', marker: 'astro-nagornaya-shadow', ratio: 0.97 },
  { rel: 'nagornaya/chast-2/index.html', url: 'https://gospod-bog.ru/nagornaya/chast-2/', marker: 'astro-nagornaya-shadow', ratio: 0.97 },
  { rel: 'nagornaya/chast-3/index.html', url: 'https://gospod-bog.ru/nagornaya/chast-3/', marker: 'astro-nagornaya-shadow', ratio: 0.97 },
  { rel: 'nagornaya/chast-4/index.html', url: 'https://gospod-bog.ru/nagornaya/chast-4/', marker: 'astro-nagornaya-shadow', ratio: 0.97 },
  { rel: 'nagornaya/chast-5/index.html', url: 'https://gospod-bog.ru/nagornaya/chast-5/', marker: 'astro-nagornaya-shadow', ratio: 0.97 },
];

const problems = [];

function ok(msg) { console.log(`✅ ${msg}`); }
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
function mustEqual(label, actual, expected) {
  if (actual === expected) ok(`${label}: ${expected}`);
  else bad(`${label}: expected "${expected}", got "${actual}"`);
}
function runBuild() {
  if (NO_BUILD) return;
  console.log('▶ Building production-like strangler dist for legacy-wrapper audit…');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const res = spawnSync(npm, ['run', 'strangler:build:production-like'], { cwd: ROOT, stdio: 'inherit' });
  if (res.status !== 0) process.exit(res.status || 1);
}

function auditRoute(route) {
  const legacyPath = path.join(ROOT, route.rel);
  const distPath = path.join(DIST, route.rel);
  console.log(`\nWRAPPER: ${route.rel}`);
  if (!fs.existsSync(legacyPath)) return bad(`${route.rel}: legacy file missing`);
  if (!fs.existsSync(distPath)) return bad(`${route.rel}: dist file missing`);
  const legacy = read(legacyPath);
  const astro = read(distPath);

  if (!astro.includes(route.marker)) bad(`${route.rel}: Astro wrapper marker missing (${route.marker})`);
  else ok(`${route.rel}: Astro wrapper marker present`);

  mustEqual(`${route.rel} canonical`, canonical(astro), route.url);
  mustEqual(`${route.rel} title mirrors legacy`, title(astro), title(legacy));
  mustEqual(`${route.rel} description mirrors legacy`, meta(astro, 'description'), meta(legacy, 'description'));
  mustEqual(`${route.rel} H1 mirrors legacy`, h1(astro), h1(legacy));
  if (hasNoindex(astro)) bad(`${route.rel}: unexpectedly noindex`);
  else ok(`${route.rel}: indexable`);

  const legacyWords = wordCount(legacy);
  const astroWords = wordCount(astro);
  const ratio = astroWords / Math.max(1, legacyWords);
  console.log(`${route.rel} words: legacy=${legacyWords}; astro=${astroWords}; ratio=${ratio.toFixed(2)}`);
  if (ratio < route.ratio) bad(`${route.rel}: word-count ratio too low (${ratio.toFixed(2)} < ${route.ratio})`);
  else ok(`${route.rel}: word-count parity within threshold`);
}

function main() {
  console.log(`LEGACY SHADOW WRAPPER AUDIT (${NO_BUILD ? 'no-build' : 'build'})`);
  runBuild();
  ROUTES.forEach(auditRoute);
  console.log('');
  if (problems.length) {
    console.log(`❌ legacy shadow wrapper audit failed: ${problems.length} issue(s)`);
    process.exit(1);
  }
  console.log(`✅ legacy shadow wrapper audit passed (${ROUTES.length} route(s))`);
}

main();
