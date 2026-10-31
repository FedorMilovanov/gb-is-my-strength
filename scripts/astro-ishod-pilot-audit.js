#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnNpm } = require('./lib/npm-spawn');
const { inspectSharedMapInitSource } = require('./lib/map-init-source-contract');
const { resolveReferenceForRoute } = require('../migration/legacy-reference-path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const NO_BUILD = process.argv.includes('--no-build');
const PUBLIC_ROUTE = '/karty/ishod/';
const DIST_ROUTE = 'karty/ishod/index.html';
const URL = 'https://gospod-bog.ru/karty/ishod/';
const COMPONENT = 'src/components/karty/ishod/IshodMap.astro';
const FALLBACK = 'src/components/karty/_shared/MapRuntimeFallback.astro';
const PROJECTION = 'src/components/karty/ishod/IshodStaticProjection.astro';
const ENGINE = 'karty/_engine/map-engine.js';

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
  const res = spawnNpm(['run', 'strangler:build:production-like'], { cwd: ROOT, stdio: 'inherit' });
  if (res.status !== 0) process.exit(res.status);
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

// GBS-ISHOD-STATIC-PROJECTION-RICH-BLOCK-FLATTENING: source → печатная
// проекция parity для rich-dispute + доказательство отказа unsafe markup.
function auditRichDisputes({ astro, component, projection }) {
  const route = require('../karty/ishod/route.json');
  const authority = require('../karty/ishod/pihahiroth-authority.json');
  const {
    parseDisputeProjection,
    tryParseDisputeProjection,
    decodeEntities,
    FLATTENING_ARTIFACTS,
  } = require('../src/lib/ishod-dispute-projection.mjs');
  const forbiddenClaims = Array.isArray(authority.forbiddenRuntimeClaims)
    ? authority.forbiddenRuntimeClaims
    : [];
  const isForbidden = (raw) => {
    const flat = decodeEntities(String(raw).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ');
    return forbiddenClaims.find((term) => flat.includes(term)) ?? '';
  };

  // 1) Парсер: позитив inline-режима + негативы unsafe/foreign markup.
  const inlineSample = tryParseDisputeProjection('Проза <b>без</b> блоков.');
  if (inlineSample?.mode === 'inline' && inlineSample.text === 'Проза без блоков.') {
    ok('rich-dispute parser accepts boundary-free inline prose');
  } else {
    bad('rich-dispute parser must accept boundary-free inline prose');
  }
  const negFixtures = {
    'script injection': '<div class="dispute-block"><div class="dispute-title">T<script>alert(1)</script></div><div class="dispute-pos cons"><b>L</b>: D</div></div>',
    'foreign child div': '<div class="dispute-block"><div class="evil">x</div></div>',
    'unclosed root': '<div class="dispute-block"><div class="dispute-title">T</div>',
    'img onerror': '<div class="dispute-block"><div class="dispute-title">T<img src=x onerror=alert(1)></div><div class="dispute-pos cons"><b>L</b>: D</div></div>',
    'event-handler span': '<div class="dispute-block"><div class="dispute-title">T</div><div class="dispute-pos cons"><b>L</b>: D <span onmouseover="x">c</span></div></div>',
    'content before title': '<div class="dispute-block">junk<div class="dispute-title">T</div><div class="dispute-pos cons"><b>L</b>: D</div></div>',
    'note before positions': '<div class="dispute-block"><div class="dispute-title">T</div><div class="dispute-note">N</div><div class="dispute-pos cons"><b>L</b>: D</div></div>',
    'missing pos label': '<div class="dispute-block"><div class="dispute-title">T</div><div class="dispute-pos cons">no label</div></div>',
    'foreign paragraph': '<p>just a paragraph</p>',
    'foreign inline anchor': 'проза <a href="#">ссылка</a>',
  };
  const accepted = Object.entries(negFixtures)
    .filter(([, html]) => tryParseDisputeProjection(html) !== null)
    .map(([label]) => label);
  if (accepted.length) bad(`rich-dispute parser accepted unsafe payloads: ${accepted.join(', ')}`);
  else ok(`rich-dispute parser rejects unsafe markup (${Object.keys(negFixtures).length} fixtures)`);

  // 2) Source side: каждый эффективный payload разбирается в типизированные блоки;
  // поле с forbidden-утверждением печатать нельзя (authority withhold), но парсер
  // обязан покрывать его источник (panel/route parity).
  const effective = [];
  const withheldPlaces = [];
  for (const place of Array.isArray(route.places) ? route.places : []) {
    if (!place.dispute) continue;
    const isOverridden = place.id === 'pihahiroth';
    const raw = isOverridden ? authority.panel?.dispute : place.dispute;
    let parsed;
    try {
      parsed = parseDisputeProjection(raw);
    } catch (error) {
      bad(`${place.id}: effective dispute payload does not parse: ${error.message}`);
      continue;
    }
    if (parsed.mode !== 'structured') {
      bad(`${place.id}: rich dispute must parse to structured blocks`);
      continue;
    }
    const forbidden = isForbidden(raw);
    if (forbidden) withheldPlaces.push({ id: place.id, forbidden });
    else effective.push({ id: place.id, isOverridden, parsed });
  }
  if (effective.length + withheldPlaces.length >= 4) {
    ok(`rich-dispute source payloads parse to typed blocks (${effective.length} print, ${withheldPlaces.length} authority-withheld)`);
  } else {
    bad(`expected at least 4 structured dispute payloads, got ${effective.length + withheldPlaces.length}`);
  }

  // 3) Dist: печатная проекция — отдельные семантические элементы в порядке source.
  const sectionMarker = '<section class="sr-only map-text-fallback"';
  const sectionStart = astro.indexOf(sectionMarker);
  if (sectionStart < 0) {
    bad('rich-dispute: static projection section missing from dist');
    return;
  }
  const sectionEnd = astro.indexOf('</section>', sectionStart);
  const section = astro.slice(sectionStart, sectionEnd < 0 ? astro.length : sectionEnd);

  let cursor = 0;
  let orderProblems = 0;
  for (const { id, parsed } of effective) {
    const needles = [
      parsed.title,
      ...parsed.positions.flatMap((pos) => [pos.label, pos.detail].filter(Boolean)),
      ...(parsed.note ? [parsed.note] : []),
    ];
    let local = cursor;
    for (const needle of needles) {
      const idx = section.indexOf(needle, local);
      if (idx < 0) {
        bad(`${id}: projection is missing ordered block text: ${needle.slice(0, 60)}…`);
        orderProblems += 1;
        break;
      }
      local = idx + needle.length;
    }
    cursor = Math.max(cursor, local);
  }
  if (!orderProblems) ok('rich-dispute print projection preserves source order and boundaries for every printed place');

  // Authority-withheld поля: в печати отсутствуют целиком, notice присутствует.
  for (const { id, forbidden } of withheldPlaces) {
    const place = (Array.isArray(route.places) ? route.places : []).find((item) => item.id === id);
    const raw = id === 'pihahiroth' ? authority.panel?.dispute : place?.dispute;
    const leaked = tryParseDisputeProjection(raw);
    if (leaked && leaked.mode === 'structured' && section.includes(leaked.title)) {
      bad(`${id}: authority-withheld dispute title leaked into projection (${forbidden})`);
    } else {
      ok(`${id}: authority-withheld dispute stays out of the projection (${forbidden})`);
    }
  }
  if (withheldPlaces.length) {
    mustContain('withheld disputes announce themselves in the projection', section, 'map-static-withheld');
  }

  if (section.includes('<p class="map-static-dispute-title">')
      && section.includes('map-static-dispute-pos--cons')
      && section.includes('map-static-dispute-pos--alt')
      && section.includes('map-static-dispute-note')) {
    ok('rich-dispute print projection renders typed semantic elements');
  } else {
    bad('rich-dispute print projection must render typed semantic elements (title/pos cons|alt/note)');
  }

  const rawAuthorMarkup = ['class="dispute-block"', 'class="dispute-title"', 'class="dispute-pos', 'class="conf-med"', 'class="conf-hi"', 'class="conf-lo"'];
  const leaked = rawAuthorMarkup.filter((needle) => section.includes(needle));
  if (leaked.length) bad(`rich-dispute projection raw-injects author markup: ${leaked.join(', ')}`);
  else ok('rich-dispute projection never raw-injects route HTML (author classes absent)');

  // 4) Pihahiroth authority override: спор authority печатается, исторический — нет.
  const authorityTitle = parseDisputeProjection(authority.panel?.dispute).title;
  if (section.includes(authorityTitle)) ok('pihahiroth authority dispute title present in projection');
  else bad('pihahiroth authority dispute title missing from projection');
  const routePihahiroth = (Array.isArray(route.places) ? route.places : []).find((place) => place.id === 'pihahiroth');
  const historicalTitle = routePihahiroth?.dispute ? String(routePihahiroth.dispute).match(/class="dispute-title">([^<]+)</)?.[1] : '';
  if (historicalTitle && section.includes(historicalTitle)) {
    bad(`pihahiroth historical dispute leaked into projection: ${historicalTitle}`);
  } else {
    ok('pihahiroth historical dispute stays out of the projection (authority override)');
  }

  // 5) Смежные flatten-артефакты отсутствуют во всём файле маршрута.
  const presentArtifacts = FLATTENING_ARTIFACTS.filter((artifact) => astro.includes(artifact));
  if (presentArtifacts.length) bad(`flatten adjacency artifacts present in final HTML: ${presentArtifacts.join(', ')}`);
  else ok(`flatten adjacency artifacts absent from final HTML (${FLATTENING_ARTIFACTS.length} strings)`);

  // 6) Wiring: компонент обязан использовать строгий парсер и типизированные классы;
  //    рантайм-карта — переопределение спора Пи-Гахирофа authority-панелью.
  mustContain('projection wires the strict dispute parser', projection, 'tryParseDisputeProjection');
  mustContain('projection renders typed dispute classes', projection, 'map-static-dispute-pos--');
  mustContain('interactive runtime overrides pihahiroth dispute with authority panel', component, 'place.dispute = panel.dispute');
}

function main() {
  console.log(`ASTRO ISHOD SHADOW AUDIT (${NO_BUILD ? 'no-build' : 'build'})`);
  runBuild();

  let reference;
  try {
    reference = resolveReferenceForRoute(PUBLIC_ROUTE);
  } catch (error) {
    return bad(`Ishod reference unavailable: ${error.message}`);
  }

  const referencePath = reference.absolutePath;
  const distPath = path.join(DIST, DIST_ROUTE);
  const componentPath = path.join(ROOT, COMPONENT);
  const fallbackPath = path.join(ROOT, FALLBACK);
  const projectionPath = path.join(ROOT, PROJECTION);
  const enginePath = path.join(ROOT, ENGINE);
  if (!fs.existsSync(distPath)) return bad(`dist route missing: ${DIST_ROUTE}`);
  if (!fs.existsSync(componentPath)) return bad(`Ishod component missing: ${COMPONENT}`);
  if (!fs.existsSync(fallbackPath)) return bad(`shared map fallback missing: ${FALLBACK}`);
  if (!fs.existsSync(projectionPath)) return bad(`ishod static print projection missing: ${PROJECTION}`);
  if (!fs.existsSync(enginePath)) return bad(`shared MapEngine missing: ${ENGINE}`);

  const legacy = read(referencePath);
  const astro = read(distPath);
  const component = read(componentPath);
  const fallback = read(fallbackPath);
  const projection = read(projectionPath);
  const engine = read(enginePath);

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

  mustContain('ishod ships a static text projection for print/no-JS', astro, 'data-map-static-projection');
  mustContain('ishod print projection is inside a sr-only text fallback', astro, 'class="sr-only map-text-fallback"');
  mustContain('ishod print projection is a pagefind body', astro, '<section class="sr-only map-text-fallback" data-map-static-projection data-pagefind-body');
  mustContain('ishod component mounts the static projection', component, 'IshodStaticProjection');
  mustContain('ishod print projection carries the route title', projection, 'маршрут Исхода');
  const runtimeNote = component.match(/place\.bible_extra = '(<p class="bib-note">[\s\S]*?)';/);
  if (!runtimeNote) bad('adapter authority note for pihahiroth.bible_extra not found');
  else if (!projection.includes(runtimeNote[1])) bad('print projection diverges from the runtime authority note for pihahiroth.bible_extra');
  else ok('print projection reuses the runtime authority note verbatim');
  mustContain('ishod imports shared fallback', component, 'MapRuntimeFallback');
  mustContain('ishod stage owns runtime state', component, 'data-map-state="loading"');
  mustContain('ishod stage exposes busy state', component, 'aria-busy="true"');
  const mapInit = inspectSharedMapInitSource(component);
  if (mapInit.runtimeGuard) ok('ishod guards the shared runtime before bootstrap');
  else bad('ishod missing shared GBMapRuntime availability guard');
  if (mapInit.bootEngineRouteCalled && mapInit.routeUrlConfigured) ok('ishod delegates route loading to shared bootEngineRoute');
  else bad('ishod must delegate an explicit routeUrl to shared bootEngineRoute');
  if (mapInit.noLocalLifecycle) ok('ishod does not duplicate createMap/ready lifecycle');
  else bad('ishod must not own createMap or ready-state lifecycle');
  mustMatch('shared runtime delegates to MapEngine.bootRoute', fallback, /return engine\.bootRoute\(options\)/);
  mustMatch('shared runtime routes missing-engine failure to visible renderer', fallback, /renderFailure\(container,[\s\S]*?MapEngine mount failed/);
  mustMatch('shared engine marks successful stage ready', engine, /container\.setAttribute\('data-map-state','ready'\)/);

  mustContain('fallback includes no-JS surface', fallback, 'map-runtime-noscript');
  mustMatch('fallback hides only the stage without JS', fallback, /<noscript>[\s\S]*?\[data-map-stage\][\s\S]*?display:\s*none\s*!important/);
  mustMatch('fallback creates visible alert card', fallback, /card\.className = 'me-error'[\s\S]*?role', 'alert'/);
  mustContain('fallback has reload recovery', fallback, 'Повторить загрузку');
  mustContain('fallback has maps back-link', fallback, "back.href = '/karty/'");
  mustMatch('fallback recovery targets are at least 44px', fallback, /min-height:\s*44px/);
  mustMatch('fallback avoids unsafe HTML injection', fallback, /node\.textContent = String/);
  if (/innerHTML\s*=/.test(fallback)) bad('shared map fallback must not use innerHTML');
  else ok('shared map fallback avoids innerHTML');

  auditRichDisputes({ astro, component, projection });

  console.log('');
  if (problems.length) {
    console.log(`❌ astro ishod shadow audit failed: ${problems.length} issue(s)`);
    process.exit(1);
  }
  console.log('✅ astro ishod shadow audit passed');
}

main();
