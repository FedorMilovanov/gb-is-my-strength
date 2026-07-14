#!/usr/bin/env node
/*
 * validate-map-routes.js — lightweight route.json validator for /karty.
 * No external dependencies by design; this is a pre-Astro Level-0 safety guard.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ROUTES_ROOT = path.join(ROOT, 'karty');
const schemaPath = path.join(ROOT, 'karty/_shared/route.schema.json');
const errors = [];
const ok = (m) => console.log('✅ ' + m);
const bad = (m) => { errors.push(m); console.log('❌ ' + m); };

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { bad(`${rel(file)} JSON parse failed: ${e.message}`); return null; }
}
function rel(file) { return path.relative(ROOT, file).replace(/\\/g, '/'); }
function isFiniteNum(v) { return typeof v === 'number' && Number.isFinite(v); }
function ids(arr) { return new Set((arr || []).map(x => x && x.id).filter(Boolean)); }
function findDuplicateIds(items) {
  const seen = new Set();
  const dups = [];
  for (const x of items || []) {
    if (!x || !x.id) continue;
    if (seen.has(x.id)) {
      if (!dups.includes(x.id)) dups.push(x.id);
    } else {
      seen.add(x.id);
    }
  }
  return dups;
}
function countPhotos(places) {
  return (places || []).reduce((sum, p) => sum + (Array.isArray(p.photos) ? p.photos.length : 0), 0);
}
function countScientificVariants(route) {
  const sv = route.scientific_variants;
  if (!sv || typeof sv !== 'object') return 0;
  return Object.values(sv).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
}
const ALLOWED_VARIANT_STATUSES = new Set(['consensus','primary','candidate','alternative','caveat','minor','rejected']);
const ALLOWED_SIGNATURE_TYPES = new Set([
  'water-split','sea-voyage','hanukkah-lights','split-kingdom','judge-cycles',
  'tribe-stars','ministry-light','gospel-waves','lampstands'
]);
function storyPlaces(story) { return story.place_ids ?? story.places ?? null; }
function storyStages(story) { return story.stage_ids ?? story.stages ?? null; }
function validateKnownIdList({ label, sig, key, placeIds, min = 1 }) {
  const rows = sig[key];
  const where = `${label}: signature.${key}`;
  if (!Array.isArray(rows)) return bad(`${where}: must be array`);
  if (rows.length < min) bad(`${where}: must contain at least ${min} id(s)`);
  const seen = new Set();
  rows.forEach((id) => {
    if (typeof id !== 'string' || !id) bad(`${where}: invalid id ${id}`);
    else if (!placeIds.has(id)) bad(`${where}: unknown place id ${id}`);
    if (seen.has(id)) bad(`${where}: duplicate id ${id}`);
    seen.add(id);
  });
  return rows;
}
function validateSignature(route, label, placeIds) {
  const sig = route.signature;
  if (sig === undefined || sig === null) return;
  if (!sig || typeof sig !== 'object' || Array.isArray(sig)) return bad(`${label}: signature must be object`);
  if (!sig.type || typeof sig.type !== 'string') bad(`${label}: signature.type missing/invalid`);
  else if (!ALLOWED_SIGNATURE_TYPES.has(sig.type)) bad(`${label}: signature.type ${sig.type} is not allowed`);
  if (!sig.label || typeof sig.label !== 'string') bad(`${label}: signature.label missing/invalid`);
  if (!sig.description || typeof sig.description !== 'string') bad(`${label}: signature.description missing/invalid`);
  else if (sig.description.length > 260) bad(`${label}: signature.description too long (${sig.description.length} > 260)`);

  const origin = sig.origin || sig.origin_id;
  const requireOrigin = (fallback) => {
    if (!origin || typeof origin !== 'string') bad(`${label}: signature.${fallback} origin missing/invalid`);
    else if (!placeIds.has(origin)) bad(`${label}: signature origin unknown place id ${origin}`);
  };

  if (sig.type === 'water-split') requireOrigin('water-split');
  else if (sig.type === 'hanukkah-lights') requireOrigin('hanukkah-lights');
  else if (sig.type === 'gospel-waves') requireOrigin('gospel-waves');
  else if (sig.type === 'lampstands') validateKnownIdList({ label, sig, key: 'place_ids', placeIds, min: 7 });
  else if (sig.type === 'sea-voyage') validateKnownIdList({ label, sig, key: 'place_ids', placeIds, min: 2 });
  else if (sig.type === 'judge-cycles') validateKnownIdList({ label, sig, key: 'place_ids', placeIds, min: 2 });
  else if (sig.type === 'tribe-stars') validateKnownIdList({ label, sig, key: 'place_ids', placeIds, min: 3 });
  else if (sig.type === 'ministry-light') validateKnownIdList({ label, sig, key: 'place_ids', placeIds, min: 2 });
  else if (sig.type === 'split-kingdom') {
    const north = validateKnownIdList({ label, sig, key: 'north_ids', placeIds, min: 1 }) || [];
    const south = validateKnownIdList({ label, sig, key: 'south_ids', placeIds, min: 1 }) || [];
    const southSet = new Set(south);
    north.forEach(id => { if (southSet.has(id)) bad(`${label}: signature split-kingdom id appears in both north_ids and south_ids: ${id}`); });
    if (sig.divide !== undefined && typeof sig.divide !== 'string') bad(`${label}: signature.divide must be SVG path string when present`);
  }
}
function validateRoute(file) {
  const route = readJson(file);
  if (!route) return;
  const label = rel(file);
  if (!route.meta || typeof route.meta !== 'object') bad(`${label}: missing meta`);
  if (!route.meta?.id || !/^[a-z0-9-]+$/.test(route.meta.id)) bad(`${label}: meta.id invalid`);
  if (!route.meta?.title) bad(`${label}: meta.title missing`);
  if (!route.meta?.era) bad(`${label}: meta.era missing`);
  if (!route.meta?.viewport_init || !isFiniteNum(route.meta.viewport_init.cx) || !isFiniteNum(route.meta.viewport_init.cy) || !isFiniteNum(route.meta.viewport_init.w)) bad(`${label}: meta.viewport_init invalid`);

  const places = Array.isArray(route.places) ? route.places : [];
  const stages = Array.isArray(route.stages) ? route.stages : [];
  const stories = Array.isArray(route.stories) ? route.stories : [];
  if (!places.length) bad(`${label}: places[] empty/missing`);
  if (!stages.length) bad(`${label}: stages[] empty/missing`);
  if (!stories.length) bad(`${label}: stories[] empty/missing`);

  const placeIds = ids(places);
  const placeDups = findDuplicateIds(places);
  if (placeDups.length) bad(`${label}: duplicate place ids: ${placeDups.join(', ')}`);
  else if (placeIds.size !== places.length) bad(`${label}: place with missing id`);
  const storyIds = ids(stories);
  const storyDups = findDuplicateIds(stories);
  if (storyDups.length) bad(`${label}: duplicate story ids: ${storyDups.join(', ')}`);
  else if (storyIds.size !== stories.length) bad(`${label}: story with missing id`);

  places.forEach((p, i) => {
    const where = `${label}: places[${i}] ${p?.id || '(no id)'}`;
    if (!p || typeof p !== 'object') return bad(`${where}: not object`);
    if (!p.id || !/^[a-z0-9_-]+$/.test(p.id)) bad(`${where}: invalid id`);
    if (!p.name) bad(`${where}: missing name`);
    if (!isFiniteNum(p.x) || !isFiniteNum(p.y)) bad(`${where}: invalid coordinates`);
    // Styled SVG coordinate system is wider than viewport; allow modest negative for future maps but catch absurd values.
    if (isFiniteNum(p.x) && (p.x < -250 || p.x > 2200)) bad(`${where}: x out of expected SVG range (${p.x})`);
    if (isFiniteNum(p.y) && (p.y < -250 || p.y > 1600)) bad(`${where}: y out of expected SVG range (${p.y})`);
    // ctx/region — контекстные точки лексикона Атласа (Вавилон/Мари/Фаран,
    // DEBT 2026-07-11), не привязаны к этапу маршрута.
    if (p.type !== 'ctx' && p.type !== 'region') {
      if (!Number.isInteger(p.stage) || p.stage < 0 || p.stage >= stages.length) bad(`${where}: stage ${p.stage} outside stages[]`);
    }
    if (!p.type) bad(`${where}: missing type`);
    if (p.photos) {
      if (!Array.isArray(p.photos)) bad(`${where}: photos must be array`);
      else p.photos.forEach((photo, n) => {
        if (!photo.src || !photo.alt) bad(`${where}: photos[${n}] must have src + alt`);
      });
    }
  });

  stages.forEach((st, i) => {
    const where = `${label}: stages[${i}]`;
    if (!st.n || !st.t) bad(`${where}: missing n/t`);
    if (!st.r) bad(`${where}: missing scripture ref r`);
    if (st.paths && !Array.isArray(st.paths)) bad(`${where}: paths must be array when present`);
  });

  stories.forEach((story, i) => {
    const where = `${label}: stories[${i}] ${story?.id || '(no id)'}`;
    if (!story.id || !story.label) bad(`${where}: missing id/label`);
    const pids = storyPlaces(story);
    const sids = storyStages(story);
    if (pids !== null && pids !== undefined) {
      if (!Array.isArray(pids)) bad(`${where}: place list must be array/null`);
      else pids.forEach(id => { if (!placeIds.has(id)) bad(`${where}: unknown place id ${id}`); });
    }
    if (sids !== null && sids !== undefined) {
      if (!Array.isArray(sids)) bad(`${where}: stage list must be array/null`);
      else sids.forEach(n => { if (!Number.isInteger(n) || n < 0 || n >= stages.length) bad(`${where}: unknown stage index ${n}`); });
    }
  });

  validateSignature(route, label, placeIds);

  const scientificVariants = route.scientific_variants || {};
  if (scientificVariants && typeof scientificVariants === 'object' && !Array.isArray(scientificVariants)) {
    Object.entries(scientificVariants).forEach(([pid, rows]) => {
      const where = `${label}: scientific_variants.${pid}`;
      // scientific_variants may include contextual keys that are not rendered as places; keep non-blocking.
      if (!Array.isArray(rows)) bad(`${where}: must be array`);
      else rows.forEach((row, i) => {
        if (!row || typeof row !== 'object') return bad(`${where}[${i}]: not object`);
        if (!row.title) bad(`${where}[${i}]: missing title`);
        if (!row.status) bad(`${where}[${i}]: missing status`);
        else if (!ALLOWED_VARIANT_STATUSES.has(row.status)) bad(`${where}[${i}]: non-canonical status ${row.status}`);
        if (!row.detail && !row.note && !row.text) bad(`${where}[${i}]: missing detail/note/text`);
      });
    });
  }

  const stats = route.meta?.stats || {};
  const routePlaces = places.filter(p => p && p.type !== 'ctx' && p.type !== 'region').length;
  if (Number.isFinite(stats.places) && stats.places !== routePlaces) bad(`${label}: meta.stats.places ${stats.places} != маршрутных мест ${routePlaces} (ctx/region не считаются)`);
  if (Number.isFinite(stats.stages) && stats.stages !== stages.length) bad(`${label}: meta.stats.stages ${stats.stages} != stages.length ${stages.length}`);
  if (Number.isFinite(stats.stories) && stats.stories !== stories.length) bad(`${label}: meta.stats.stories ${stats.stories} != stories.length ${stories.length}`);
  if (Number.isFinite(stats.photos)) {
    const actual = countPhotos(places);
    if (stats.photos !== actual) bad(`${label}: meta.stats.photos ${stats.photos} != actual photos ${actual}`);
  }
  if (Number.isFinite(stats.scientific_variants)) {
    const actual = countScientificVariants(route);
    if (stats.scientific_variants !== actual) bad(`${label}: meta.stats.scientific_variants ${stats.scientific_variants} != actual ${actual}`);
  }

  ok(`${label}: ${places.length} places · ${stages.length} stages · ${stories.length} stories`);
}

function hasAuditPendingDesign(htmlSrc, missingCount) {
  if (!htmlSrc) return false;
  if (missingCount <= 0) return false;
  // 1) An explicit explanation that some maps are pending visual audit.
  const hasExplicitMessage = /на\s+аудите|временно\s+не\s+на\s+витрине|только\s+после\s+визуального\s+аудита/i.test(htmlSrc);
  if (!hasExplicitMessage) return false;
  // 2) A numeric stat that matches the missing count. Patterns observed:
  //      <div class="karty-stat"><b>9</b><span>на аудите</span></div>
  //      <b>9</b><span>на аудите</span>
  // We tolerate whitespace inside the stat markup.
  const numericMatches = [...htmlSrc.matchAll(/<b[^>]*>\s*(\d+)\s*<\/b>\s*<span[^>]*>\s*на\s+аудите\s*<\/span>/gi)];
  if (!numericMatches.length) return false;
  return numericMatches.some(m => parseInt(m[1], 10) === missingCount);
}

function checkAstroHub(files) {
  const routeIds = files.map(f => path.basename(path.dirname(f))).sort();

  // 1. Check built / root HTML for actual links (shadow-wrap or legacy)
  const htmlCandidates = [
    path.join(ROOT, 'dist', 'karty', 'index.html'),
    path.join(ROOT, 'karty', 'index.html'),
  ];
  const htmlHub = htmlCandidates.find(p => fs.existsSync(p));
  let htmlSrc = htmlHub ? fs.readFileSync(htmlHub, 'utf8') : '';

  const missingFromHtml = routeIds.filter(id => {
    const hasAbsolute = htmlSrc.includes(`/karty/${id}/`);
    // NB: regex literals do NOT interpolate ${id}; we use new RegExp(string) instead.
    // The previous literal /href=["']\.\/[^"']*\b${id}\b[^"']*["']/ silently searched
    // for the literal substring "${id}" and therefore reported every route as missing.
    const hasRelative = new RegExp(`href=["']\\.\\/[^"']*\\b${id}\\b[^"']*["']`).test(htmlSrc);
    return !hasAbsolute && !hasRelative;
  });

  // 2. If HTML is missing links, check Astro source for explicit slugs or shadow-wrap comments
  const astroHub = path.join(ROOT, 'src', 'pages', 'karty', 'index.astro');
  let astroSrc = '';
  if (fs.existsSync(astroHub)) astroSrc = fs.readFileSync(astroHub, 'utf8');
  const isShadowWrap = astroSrc.includes('loadLegacyFullDocument');

  const missingFromAstro = routeIds.filter(id => {
    const hasSlug = new RegExp(`['"\\b]${id}['"\\b;]|slug:\\s*['"\\b]${id}['"\\b]`).test(astroSrc);
    return !hasSlug;
  });

  // If all links exist in HTML → full parity, ok.
  // If some missing in HTML but Astro source is shadow-wrap AND declares slugs → warn, not fail (legacy hub may intentionally show subset).
  // If some missing in HTML and Astro source is native → fail UNLESS the hub carries
  //   an explicit "на аудите" / "временно не на витрине" message AND the count of missing
  //   routes matches the figure mentioned in that message. This preserves the owner design
  //   intent (e.g. AGENTS-r252 native pilot for /karty/ keeps Avraam as the only featured map
  //   while 9 others are explicitly listed as pending visual audit).
  if (missingFromHtml.length === 0) {
    ok(`karty hub links all live route.json maps (${routeIds.length})`);
  } else if (isShadowWrap && missingFromAstro.length === 0) {
    ok(`karty hub is shadow-wrap; legacy HTML shows subset, Astro source declares all ${routeIds.length} slugs`);
  } else if (hasAuditPendingDesign(htmlSrc, missingFromHtml.length)) {
    ok(`karty hub uses audit-pending design: ${missingFromHtml.length} map(s) explicitly listed as 'на аудите' / 'временно не на витрине'`);
  } else {
    missingFromHtml.forEach(id => bad(`karty hub missing clickable route card for /karty/${id}/`));
  }

  // 3. Stale "soon" checks against HTML (or Astro if no HTML)
  const checkSrc = htmlSrc || astroSrc;
  const staleSoon = routeIds.filter(id => {
    const idx = checkSrc.indexOf(`/karty/${id}/`) >= 0 ? checkSrc.indexOf(`/karty/${id}/`) : checkSrc.indexOf(`./${id}/`);
    if (idx < 0) return false;
    const chunk = checkSrc.slice(Math.max(0, idx - 180), Math.min(checkSrc.length, idx + 420));
    return /\bsoon\b|Скоро|pointer-events\s*:\s*none/i.test(chunk);
  });
  if (staleSoon.length) staleSoon.forEach(id => bad(`karty hub marks live map as soon/disabled: /karty/${id}/`));
  else ok('karty hub has no disabled/soon cards for live maps');
}

function main() {
  if (!fs.existsSync(schemaPath)) bad('karty/_shared/route.schema.json missing');
  else ok('route schema present');
  const files = [];
  for (const dir of fs.readdirSync(ROUTES_ROOT, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name.startsWith('_')) continue;
    const f = path.join(ROUTES_ROOT, dir.name, 'route.json');
    if (fs.existsSync(f)) files.push(f);
  }
  if (!files.length) bad('No karty/*/route.json files found');
  // Листы Атласа (sheet-движок: meta.sheet_no без meta.id) — черновики §13-бис,
  // маршрутный контракт и карточка на хабе к ним не применяются до «ДА» владельца.
  const routeFiles = files.filter(f => {
    try {
      const probe = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (probe && probe.meta && probe.meta.sheet_no != null && probe.meta.id == null) {
        ok(path.relative(ROOT, f) + ': лист Атласа (ждёт публикации) — пропущен');
        return false;
      }
    } catch (_) {}
    return true;
  });
  routeFiles.sort().forEach(validateRoute);
  checkAstroHub(routeFiles);
  if (errors.length) {
    console.log(`\n❌ Map route validation failed: ${errors.length} issue(s)`);
    process.exit(1);
  }
  console.log(`\n✅ Map route validation passed: ${files.length} route file(s)`);
}

main();
