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
const COMPONENT = 'src/components/karty/ishod/IshodMap.astro';
const FALLBACK = 'src/components/karty/_shared/MapRuntimeFallback.astro';

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
function mustMatch(label, value, pattern) {
  if (pattern.test(String(value || ''))) ok(label);
  else bad(`${label}: pattern ${pattern} missing`);
}

function main() {
  console.log(`ASTRO ISHOD SHADOW AUDIT (${NO_BUILD ? 'no-build' : 'build'})`);
  runBuild();

  const legacyPath = path.join(ROOT, ROUTE);
  const distPath = path.join(DIST, ROUTE);
  const componentPath = path.join(ROOT, COMPONENT);
  const fallbackPath = path.join(ROOT, FALLBACK);
  if (!fs.existsSync(legacyPath)) return bad(`legacy route missing: ${ROUTE}`);
  if (!fs.existsSync(distPath)) return bad(`dist route missing: ${ROUTE}`);
  if (!fs.existsSync(componentPath)) return bad(`Ishod component missing: ${COMPONENT}`);
  if (!fs.existsSync(fallbackPath)) return bad(`shared map fallback missing: ${FALLBACK}`);

  const legacy = read(legacyPath);
  const astro = read(distPath);
  const component = read(componentPath);
  const fallback = read(fallbackPath);

  mustEqual('ishod canonical', canonical(astro), URL);
  mustEqual('ishod title mirrors legacy', title(astro), title(legacy));

  const robotsTag = meta(astro, 'robots');
  if (/\bnoindex\b/i.test(robotsTag)) bad(`ishod unexpectedly noindex: ${robotsTag}`);
  else ok('ishod is indexable');

  mustContain('ishod sr-only SEO text', astro, 'Исход из Египта');
  if (!/map-engine.js/.test(astro)) bad('ishod must load map-engine.js (live map, not holding page)');
  else ok('ishod loads map-engine.js (live map)');
  if (!/route.json/.test(astro)) bad('ishod must reference route.json (live map data)');
  else ok('ishod references route.json (live map data)');
  if (!/class="sr-only"/.test(astro)) bad('ishod must have sr-only h1 for SEO/a11y');
  else ok('ishod has sr-only h1 for SEO/a11y');

  mustContain('ishod imports shared fallback', component, 'MapRuntimeFallback');
  mustContain('ishod stage owns runtime state', component, 'data-map-state="loading"');
  mustContain('ishod stage exposes busy state', component, 'aria-busy="true"');
  mustMatch('ishod throws when engine is absent', component, /!window\.MapEngine[\s\S]*?throw new Error\('движок карты не загрузился'\)/);
  mustMatch('ishod rejects null map instances', component, /if \(!inst\) throw new Error\('движок не создал карту'\)/);
  mustMatch('ishod routes failures to visible renderer', component, /GBMapRuntime\.renderFailure\(container/);
  mustMatch('ishod marks successful stage ready', component, /data-map-state', 'ready'/);

  mustContain('fallback includes no-JS surface', fallback, 'map-runtime-noscript');
  mustMatch('fallback hides only the stage without JS', fallback, /<noscript>[\s\S]*?\[data-map-stage\][\s\S]*?display:\s*none\s*!important/);
  mustMatch('fallback creates visible alert card', fallback, /card\.className = 'me-error'[\s\S]*?role', 'alert'/);
  mustContain('fallback has reload recovery', fallback, 'Повторить загрузку');
  mustContain('fallback has maps back-link', fallback, "back.href = '/karty/'");
  mustMatch('fallback recovery targets are at least 44px', fallback, /min-height:\s*44px/);
  mustMatch('fallback avoids unsafe HTML injection', fallback, /node\.textContent = String/);
  if (/innerHTML\s*=/.test(fallback)) bad('shared map fallback must not use innerHTML');
  else ok('shared map fallback avoids innerHTML');

  console.log('');
  if (problems.length) {
    console.log(`❌ astro ishod shadow audit failed: ${problems.length} issue(s)`);
    process.exit(1);
  }
  console.log('✅ astro ishod shadow audit passed');
}

main();
