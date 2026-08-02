#!/usr/bin/env node
/*
 * legacy-shadow-wrapper-audit.js — verify every registry-owned Astro route that
 * still has a committed legacy HTML shadow.
 *
 * The route set is derived from migration/page-ownership.json. The audit guards
 * semantic continuity rather than freezing stale wording: canonical ownership,
 * required metadata/H1, indexability disposition, route-specific structural
 * markers and a lower bound on retained reader text.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OWNERSHIP = path.join(ROOT, 'migration', 'page-ownership.json');
const SITE = 'https://gospod-bog.ru';
const NO_BUILD = process.argv.includes('--no-build');

const ROUTE_OVERRIDES = Object.freeze({
  '/karty/avraam/': { marker: 'id="stage"', ratio: 0.95 },
  '/nagornaya/chast-1/': { marker: 'nagornaya-page', ratio: 0.97 },
  '/nagornaya/chast-2/': { marker: 'nagornaya-page', ratio: 0.97 },
  '/nagornaya/chast-3/': { marker: 'nagornaya-page', ratio: 0.97 },
  '/nagornaya/chast-4/': { marker: 'nagornaya-page', ratio: 0.97 },
  '/nagornaya/chast-5/': { marker: 'nagornaya-page', ratio: 0.97 },
});
const DEFAULT_RATIO = 0.85;

const problems = [];

function ok(msg) { console.log(`✅ ${msg}`); }
function bad(msg) { problems.push(msg); console.log(`❌ ${msg}`); }
function read(file) { return fs.readFileSync(file, 'utf8'); }
function routeToRel(route) {
  if (route === '/') return 'index.html';
  if (route.endsWith('/')) return route.replace(/^\//, '') + 'index.html';
  return route.replace(/^\//, '');
}
function canonicalUrl(route) { return new URL(route, SITE).href; }
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
function hasNoindex(html) { return /\bnoindex\b/i.test(meta(html, 'robots')); }
function wordCount(html) {
  const text = stripTags(html);
  return (text.match(/[A-Za-zА-Яа-яЁё0-9]{2,}/g) || []).length;
}
function mustEqual(label, actual, expected) {
  if (actual === expected) ok(`${label}: ${expected}`);
  else bad(`${label}: expected "${expected}", got "${actual}"`);
}
function mustPresent(label, value) {
  if (String(value || '').trim()) ok(`${label}: present`);
  else bad(`${label}: missing or empty`);
}
function loadOwnership() {
  if (!fs.existsSync(OWNERSHIP)) {
    bad('migration/page-ownership.json missing');
    return null;
  }
  try { return JSON.parse(read(OWNERSHIP)); }
  catch (error) {
    bad(`migration/page-ownership.json invalid JSON: ${error.message}`);
    return null;
  }
}
function discoverRoutes() {
  const manifest = loadOwnership();
  if (!manifest || !manifest.routes || typeof manifest.routes !== 'object') {
    bad('ownership manifest routes object missing');
    return [];
  }

  const routes = Object.entries(manifest.routes)
    .filter(([, meta]) => meta && meta.owner === 'astro' && meta.status === 'production-dist')
    .map(([route]) => ({ route, rel: routeToRel(route) }))
    .filter(({ rel }) => fs.existsSync(path.join(ROOT, rel)))
    .map(({ route, rel }) => ({
      route,
      rel,
      url: canonicalUrl(route),
      marker: ROUTE_OVERRIDES[route]?.marker || '',
      ratio: ROUTE_OVERRIDES[route]?.ratio || DEFAULT_RATIO,
    }))
    .sort((a, b) => a.route.localeCompare(b.route));

  const discovered = new Set(routes.map(({ route }) => route));
  for (const route of Object.keys(ROUTE_OVERRIDES)) {
    if (!discovered.has(route)) bad(`${route}: route override has no registry-owned committed legacy shadow`);
  }
  if (!routes.length) bad('no registry-owned committed legacy shadows discovered');
  if (new Set(routes.map(({ rel }) => rel)).size !== routes.length) bad('duplicate legacy shadow file discovered');
  return routes;
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

  if (route.marker) {
    if (!astro.includes(route.marker)) bad(`${route.rel}: Astro wrapper marker missing (${route.marker})`);
    else ok(`${route.rel}: Astro wrapper marker present`);
  }

  mustEqual(`${route.rel} canonical`, canonical(astro), route.url);
  mustPresent(`${route.rel} title`, title(astro));
  mustPresent(`${route.rel} description`, meta(astro, 'description'));
  mustPresent(`${route.rel} H1`, h1(astro));
  mustEqual(`${route.rel} noindex disposition mirrors committed shadow`, hasNoindex(astro), hasNoindex(legacy));

  const legacyWords = wordCount(legacy);
  const astroWords = wordCount(astro);
  const ratio = astroWords / Math.max(1, legacyWords);
  console.log(`${route.rel} words: legacy=${legacyWords}; astro=${astroWords}; ratio=${ratio.toFixed(2)}`);
  if (ratio < route.ratio) bad(`${route.rel}: word-count ratio too low (${ratio.toFixed(2)} < ${route.ratio})`);
  else ok(`${route.rel}: word-count parity within threshold`);
}
function main() {
  console.log(`LEGACY SHADOW WRAPPER AUDIT (${NO_BUILD ? 'no-build' : 'build'})`);
  const routes = discoverRoutes();
  if (problems.length) {
    console.log(`\n❌ legacy shadow discovery failed: ${problems.length} issue(s)`);
    process.exit(1);
  }
  console.log(`✅ registry-derived legacy shadow set: ${routes.length} route(s)`);
  runBuild();
  routes.forEach(auditRoute);
  console.log('');
  if (problems.length) {
    console.log(`❌ legacy shadow wrapper audit failed: ${problems.length} issue(s)`);
    process.exit(1);
  }
  console.log(`✅ legacy shadow wrapper audit passed (${routes.length} registry-derived route(s))`);
}

if (require.main === module) main();
module.exports = { discoverRoutes, routeToRel, stripTags, wordCount };
