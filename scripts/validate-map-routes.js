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
function countPhotos(places) {
  return (places || []).reduce((sum, p) => sum + (Array.isArray(p.photos) ? p.photos.length : 0), 0);
}
function countScientificVariants(route) {
  const sv = route.scientific_variants;
  if (!sv || typeof sv !== 'object') return 0;
  return Object.values(sv).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
}
const ALLOWED_VARIANT_STATUSES = new Set(['consensus','primary','candidate','alternative','caveat','minor','rejected']);
function storyPlaces(story) { return story.place_ids ?? story.places ?? null; }
function storyStages(story) { return story.stage_ids ?? story.stages ?? null; }
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
  if (placeIds.size !== places.length) bad(`${label}: duplicate or missing place ids`);
  const storyIds = ids(stories);
  if (storyIds.size !== stories.length) bad(`${label}: duplicate or missing story ids`);

  places.forEach((p, i) => {
    const where = `${label}: places[${i}] ${p?.id || '(no id)'}`;
    if (!p || typeof p !== 'object') return bad(`${where}: not object`);
    if (!p.id || !/^[a-z0-9_-]+$/.test(p.id)) bad(`${where}: invalid id`);
    if (!p.name) bad(`${where}: missing name`);
    if (!isFiniteNum(p.x) || !isFiniteNum(p.y)) bad(`${where}: invalid coordinates`);
    // Styled SVG coordinate system is wider than viewport; allow modest negative for future maps but catch absurd values.
    if (isFiniteNum(p.x) && (p.x < -250 || p.x > 2200)) bad(`${where}: x out of expected SVG range (${p.x})`);
    if (isFiniteNum(p.y) && (p.y < -250 || p.y > 1600)) bad(`${where}: y out of expected SVG range (${p.y})`);
    if (!Number.isInteger(p.stage) || p.stage < 0 || p.stage >= stages.length) bad(`${where}: stage ${p.stage} outside stages[]`);
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
  if (Number.isFinite(stats.places) && stats.places !== places.length) bad(`${label}: meta.stats.places ${stats.places} != places.length ${places.length}`);
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
  if (errors.length) {
    console.log(`\n❌ Map route validation failed: ${errors.length} issue(s)`);
    process.exit(1);
  }
  console.log(`\n✅ Map route validation passed: ${files.length} route file(s)`);
}

main();
