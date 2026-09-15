#!/usr/bin/env node
/*
 * validate-map-routes.js — lightweight route.json validator for /karty.
 * No external dependencies by design; this is a pre-Astro Level-0 safety guard.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { getKartyHubInventory, isAtlasSheetDraft } = require('../src/lib/karty-hub-inventory.cjs');

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
const ALLOWED_ARCHETYPES = new Set(['route','political','thematic','territorial','overview']);
const ALLOWED_CAPABILITIES = new Set(['stages','stories','layers','timeline','signature','interpretations','uncertainty']);
const BASE_LIVE_CAPABILITIES = ['stages','stories','layers','timeline','interpretations'];

function validateMapContract(route, label, file) {
  if (!ALLOWED_ARCHETYPES.has(route.archetype)) {
    bad(`${label}: archetype ${route.archetype} is not allowed`);
  }
  if (!Array.isArray(route.capabilities) || !route.capabilities.length) {
    bad(`${label}: capabilities[] missing/empty`);
    return;
  }
  const seen = new Set();
  for (const capability of route.capabilities) {
    if (!ALLOWED_CAPABILITIES.has(capability)) bad(`${label}: unknown capability ${capability}`);
    if (seen.has(capability)) bad(`${label}: duplicate capability ${capability}`);
    seen.add(capability);
  }
  if (route.publication?.status !== 'draft') {
    for (const capability of BASE_LIVE_CAPABILITIES) {
      if (!seen.has(capability)) bad(`${label}: live route missing base capability ${capability}`);
    }
  }
  if (seen.has('layers') !== Array.isArray(route.layers)) {
    bad(`${label}: layers capability must match route.layers presence`);
  }
  const hasSignature = Boolean(route.signature && typeof route.signature === 'object');
  if (seen.has('signature') !== hasSignature) {
    bad(`${label}: signature capability must match route.signature presence`);
  }
  const hasInterpretations = Boolean(route.scientific_variants && typeof route.scientific_variants === 'object');
  if (seen.has('interpretations') !== hasInterpretations) {
    bad(`${label}: interpretations capability must match scientific_variants presence`);
  }
  if (seen.has('uncertainty')) {
    const authorityFile = path.join(path.dirname(file), 'pihahiroth-authority.json');
    if (!fs.existsSync(authorityFile)) bad(`${label}: uncertainty capability requires route authority data`);
  }
}

const ALLOWED_PUBLICATION_STATUSES = new Set(['ready','temporary-placeholder','draft']);
const ALLOWED_HUB_STATES = new Set(['featured','listed','withheld']);
function validatePublication(route, label) {
  const publication = route.publication;
  if (!publication || typeof publication !== 'object' || Array.isArray(publication)) {
    bad(`${label}: publication missing/invalid`);
    return;
  }
  if (!ALLOWED_PUBLICATION_STATUSES.has(publication.status)) {
    bad(`${label}: publication.status ${publication.status} is not allowed`);
  }
  if (!ALLOWED_HUB_STATES.has(publication.hub)) {
    bad(`${label}: publication.hub ${publication.hub} is not allowed`);
  }
  for (const key of ['indexable','sitemap','llms','pagefind']) {
    if (typeof publication[key] !== 'boolean') bad(`${label}: publication.${key} must be boolean`);
  }

  if (publication.status === 'ready') {
    for (const key of ['indexable','sitemap','pagefind']) {
      if (publication[key] !== true) bad(`${label}: ready route requires publication.${key}=true`);
    }
  } else if (publication.status === 'temporary-placeholder' || publication.status === 'draft') {
    for (const key of ['indexable','sitemap','llms','pagefind']) {
      if (publication[key] !== false) bad(`${label}: ${publication.status} requires publication.${key}=false`);
    }
    if (publication.hub !== 'withheld') bad(`${label}: ${publication.status} route must be withheld from hub`);
  }

  if (publication.hub === 'featured' || publication.hub === 'listed') {
    if (publication.status !== 'ready') bad(`${label}: hub-visible route must have publication.status=ready`);
    if (!Number.isInteger(publication.hub_order) || publication.hub_order < 0) bad(`${label}: hub-visible route requires non-negative integer publication.hub_order`);
    if (typeof publication.hub_summary !== 'string' || publication.hub_summary.trim().length < 20) bad(`${label}: hub-visible route requires publication.hub_summary`);
    if (typeof publication.hub_image !== 'string' || !/^\/images\/[^?#]+\.(?:avif|webp|png|jpe?g)$/i.test(publication.hub_image)) {
      bad(`${label}: hub-visible route requires publication.hub_image under /images/`);
    } else {
      const imageFile = path.join(ROOT, publication.hub_image.replace(/^\//, ''));
      if (!fs.existsSync(imageFile)) bad(`${label}: publication.hub_image missing: ${publication.hub_image}`);
    }

    const approval = publication.hub_approval;
    if (!approval || typeof approval !== 'object' || Array.isArray(approval)) {
      bad(`${label}: hub-visible route requires publication.hub_approval`);
    } else if (approval.basis === 'legacy-production') {
      if (route.meta?.id !== 'avraam') bad(`${label}: legacy-production hub approval is reserved for avraam migration`);
    } else if (approval.basis === 'owner-receipt') {
      const receipt = approval.receipt;
      if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
        bad(`${label}: owner-receipt hub approval requires structured publication.hub_approval.receipt`);
      } else {
        if (receipt.gate !== 'G9') bad(`${label}: owner receipt must declare gate=G9`);
        if (typeof receipt.id !== 'string' || !/^[A-Za-z0-9._:-]{3,120}$/.test(receipt.id)) {
          bad(`${label}: owner receipt id invalid`);
        }
        if (typeof receipt.path !== 'string' || !/^projects\/gb-is-my-strength\/[^\s]+$/.test(receipt.path)) {
          bad(`${label}: owner receipt path must point inside AuditRepo projects/gb-is-my-strength/`);
        }
        if (typeof receipt.head_sha !== 'string' || !/^[0-9a-f]{40}$/.test(receipt.head_sha)) {
          bad(`${label}: owner receipt head_sha must be an exact 40-char git SHA`);
        }
      }
    } else {
      bad(`${label}: publication.hub_approval.basis must be legacy-production or owner-receipt`);
    }
  }
}

function validateRoute(file) {
  const route = readJson(file);
  if (!route) return;
  const label = rel(file);
  validateMapContract(route, label, file);
  validatePublication(route, label);
  if (!route.meta || typeof route.meta !== 'object') bad(`${label}: missing meta`);
  const draftSheet = isAtlasSheetDraft(route);
  if (!draftSheet && (!route.meta?.id || !/^[a-z0-9-]+$/.test(route.meta.id))) bad(`${label}: meta.id invalid`);
  if (draftSheet && route.meta?.sheet_no == null) bad(`${label}: draft atlas sheet requires meta.sheet_no`);
  if (!route.meta?.title) bad(`${label}: meta.title missing`);
  if (draftSheet) {
    const sheetViewport = route.meta?.sheet_viewport;
    if (!sheetViewport || !isFiniteNum(sheetViewport.cx) || !isFiniteNum(sheetViewport.cy) || !isFiniteNum(sheetViewport.w) || sheetViewport.w <= 0) {
      bad(`${label}: draft atlas sheet requires valid meta.sheet_viewport`);
    }
  } else {
    if (!route.meta?.era) bad(`${label}: meta.era missing`);
    if (!route.meta?.viewport_init || !isFiniteNum(route.meta.viewport_init.cx) || !isFiniteNum(route.meta.viewport_init.cy) || !isFiniteNum(route.meta.viewport_init.w)) bad(`${label}: meta.viewport_init invalid`);
  }

  const places = Array.isArray(route.places) ? route.places : [];
  const stages = Array.isArray(route.stages) ? route.stages : [];
  const stories = Array.isArray(route.stories) ? route.stories : [];
  if (!places.length) bad(`${label}: places[] empty/missing`);
  if (!stages.length) bad(`${label}: stages[] empty/missing`);
  if (!draftSheet && !stories.length) bad(`${label}: stories[] empty/missing`);

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
    if (isFiniteNum(p.x) && (p.x < -250 || p.x > 2200)) bad(`${where}: x out of expected SVG range (${p.x})`);
    if (isFiniteNum(p.y) && (p.y < -250 || p.y > 1600)) bad(`${where}: y out of expected SVG range (${p.y})`);
    if (draftSheet) {
      if (p.stage !== undefined && (!Number.isInteger(p.stage) || p.stage < 0 || p.stage >= stages.length)) {
        bad(`${where}: optional draft stage ${p.stage} outside stages[]`);
      }
    } else if (p.type !== 'ctx' && p.type !== 'region') {
      if (!Number.isInteger(p.stage) || p.stage < 0 || p.stage >= stages.length) bad(`${where}: stage ${p.stage} outside stages[]`);
    }
    if (!p.type) bad(`${where}: missing type`);
    if (p.photos) {
      if (!Array.isArray(p.photos)) bad(`${where}: photos must be array`);
      else p.photos.forEach((photo, n) => {
        if (!photo.src) bad(`${where}: photos[${n}] must have src`);
        if (!draftSheet && !photo.alt) bad(`${where}: photos[${n}] must have alt on live routes`);
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
    if (story.id && !/^[a-z0-9_-]+$/.test(story.id)) bad(`${where}: invalid id`);
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

function sameStringSet(left, right) {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function renderedCount(htmlSrc, label) {
  const dataMatch = htmlSrc.match(new RegExp(`data-${label}-count=["'](\\d+)["']`, 'i'));
  const visibleMatch = label === 'audit'
    ? htmlSrc.match(/<b[^>]*>\s*(\d+)\s*<\/b>\s*<span[^>]*>\s*на\s+аудите\s*<\/span>/i)
    : htmlSrc.match(/<b[^>]*>\s*(\d+)\s*<\/b>\s*<span[^>]*>\s*(?:карта\s+открыта|карты\s+открыты|карт\s+открыто)\s*<\/span>/i);
  return {
    data: dataMatch ? Number(dataMatch[1]) : null,
    visible: visibleMatch ? Number(visibleMatch[1]) : null,
  };
}

function hasGovernedAuditPendingDesign({ htmlSrc, heroSrc, missingIds, inventory, isBuiltHtml }) {
  if (!htmlSrc || !missingIds.length) return false;
  const explicitCopy = `${htmlSrc}\n${heroSrc}`;
  if (!/на\s+аудите|временно\s+не\s+на\s+витрине|только\s+после\s+визуального\s+аудита/i.test(explicitCopy)) return false;
  if (!sameStringSet(missingIds, inventory.auditSlugs)) return false;

  const producerIsGoverned =
    heroSrc.includes('getKartyHubInventory') &&
    heroSrc.includes('publishedRecords') &&
    heroSrc.includes('data-audit-count={auditCount}') &&
    heroSrc.includes('data-published-count={publishedCount}') &&
    heroSrc.includes('<b>{auditCount}</b><span>на аудите</span>') &&
    heroSrc.includes('<b>{publishedCount}</b><span>{publishedLabel(publishedCount)}</span>') &&
    heroSrc.includes('data-karty-published={record.slug}');
  if (!producerIsGoverned) return false;

  if (!isBuiltHtml) return true;
  const audit = renderedCount(htmlSrc, 'audit');
  const published = renderedCount(htmlSrc, 'published');
  return audit.data === inventory.auditCount &&
    audit.visible === inventory.auditCount &&
    published.data === inventory.publishedCount &&
    published.visible === inventory.publishedCount;
}

function checkAstroHub(files) {
  const routeIds = files.map(f => path.basename(path.dirname(f))).sort();
  const inventory = getKartyHubInventory(ROOT);

  for (const record of inventory.records) {
    if (record.publication?.status !== 'temporary-placeholder') continue;
    const pageFile = path.join(ROOT, 'src', 'pages', 'karty', record.slug, 'index.astro');
    if (!fs.existsSync(pageFile)) {
      bad(`temporary-placeholder route missing Astro page: /karty/${record.slug}/`);
      continue;
    }
    const pageSrc = fs.readFileSync(pageFile, 'utf8');
    if (!pageSrc.includes(`<KartyHoldingPage slug="${record.slug}" />`)) {
      bad(`/karty/${record.slug}/ must render shared KartyHoldingPage by slug only`);
    }
    if (/\b(?:title|canonical|ogTitle)=/.test(pageSrc)) {
      bad(`/karty/${record.slug}/ duplicates holding-page metadata outside route SSOT`);
    }
  }
  const hubOrders = inventory.publishedRecords.map((record) => record.publication.hub_order);
  const duplicateHubOrders = hubOrders.filter((value, index) => hubOrders.indexOf(value) !== index);
  if (duplicateHubOrders.length) bad(`karty hub publication has duplicate hub_order: ${[...new Set(duplicateHubOrders)].join(', ')}`);
  const featured = inventory.publishedRecords.filter((record) => record.publication.hub === 'featured');
  if (featured.length > 1) bad(`karty hub publication has multiple featured routes: ${featured.map((record) => record.slug).join(', ')}`);
  if (inventory.publishedCount > 0 && featured.length !== 1) bad('karty hub publication requires exactly one featured route when hub is non-empty');

  if (!sameStringSet(routeIds, inventory.routeSlugs)) {
    bad(`karty hub inventory mismatch: validator=${routeIds.join(',')} inventory=${inventory.routeSlugs.join(',')}`);
  }

  const distHub = path.join(ROOT, 'dist', 'karty', 'index.html');
  const rootHub = path.join(ROOT, 'karty', 'index.html');
  const htmlHub = [distHub, rootHub].find(p => fs.existsSync(p));
  const htmlSrc = htmlHub ? fs.readFileSync(htmlHub, 'utf8') : '';
  const isBuiltHtml = htmlHub === distHub;

  const missingFromHtml = routeIds.filter(id => {
    const hasAbsolute = htmlSrc.includes(`/karty/${id}/`);
    const hasRelative = new RegExp(`href=["']\\.\\/[^"']*\\b${id}\\b[^"']*["']`).test(htmlSrc);
    return !hasAbsolute && !hasRelative;
  });

  const astroHub = path.join(ROOT, 'src', 'pages', 'karty', 'index.astro');
  const heroPath = path.join(ROOT, 'src', 'components', 'karty', 'KartyHeroSection.astro');
  const astroSrc = fs.existsSync(astroHub) ? fs.readFileSync(astroHub, 'utf8') : '';
  const heroSrc = fs.existsSync(heroPath) ? fs.readFileSync(heroPath, 'utf8') : '';
  const isShadowWrap = astroSrc.includes('loadLegacyFullDocument');

  const missingFromAstro = routeIds.filter(id => {
    const hasSlug = new RegExp(`['"\\b]${id}['"\\b;]|slug:\\s*['"\\b]${id}['"\\b]`).test(astroSrc);
    return !hasSlug;
  });

  if (missingFromHtml.length === 0) {
    ok(`karty hub links all live route.json maps (${routeIds.length})`);
  } else if (isShadowWrap && missingFromAstro.length === 0) {
    ok(`karty hub is shadow-wrap; legacy HTML shows subset, Astro source declares all ${routeIds.length} slugs`);
  } else if (hasGovernedAuditPendingDesign({
    htmlSrc,
    heroSrc,
    missingIds: missingFromHtml,
    inventory,
    isBuiltHtml,
  })) {
    ok(`karty hub uses governed audit inventory: ${inventory.publishedCount} published, ${inventory.auditCount} audit-pending`);
  } else {
    missingFromHtml.forEach(id => bad(`karty hub missing clickable route card for /karty/${id}/`));
  }

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
  files.sort().forEach(validateRoute);
  const hubRouteFiles = files.filter(f => {
    try {
      return !isAtlasSheetDraft(JSON.parse(fs.readFileSync(f, 'utf8')));
    } catch (_) {
      return false;
    }
  });
  checkAstroHub(hubRouteFiles);
  if (errors.length) {
    console.log(`\n❌ Map route validation failed: ${errors.length} issue(s)`);
    process.exit(1);
  }
  console.log(`\n✅ Map route validation passed: ${files.length} route file(s)`);
}

main();
