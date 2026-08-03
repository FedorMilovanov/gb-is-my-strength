#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const KARTY_ROOT = path.join(ROOT, 'karty');
const SCHEMA_PATH = path.join(KARTY_ROOT, '_shared', 'uncertainty-area.schema.json');
const MAX_X = 2200;
const MAX_Y = 1600;
const MIN_X = -250;
const MIN_Y = -250;
const ALLOWED_STATUS = new Set(['UNRESOLVED', 'CANDIDATE_CORRIDORS_ONLY']);
const ALLOWED_CORRIDOR_STATUS = new Set(['CANDIDATE', 'ALTERNATIVE']);
const ALLOWED_CONFIDENCE = new Set(['LOW', 'MODERATE_LOW', 'MODERATE']);

function fail(message) {
  throw new Error(message);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${path.relative(ROOT, file)}: JSON parse failed: ${error.message}`);
  }
}

function routeFiles() {
  return fs.readdirSync(KARTY_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => path.join(KARTY_ROOT, entry.name, 'route.json'))
    .filter((file) => fs.existsSync(file))
    .sort();
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function assertString(value, where, minLength = 1) {
  if (typeof value !== 'string' || value.trim().length < minLength) {
    fail(`${where}: expected non-empty string (min ${minLength})`);
  }
}

function assertUniqueStrings(values, where, minItems = 1) {
  if (!Array.isArray(values) || values.length < minItems) {
    fail(`${where}: expected at least ${minItems} item(s)`);
  }
  const seen = new Set();
  values.forEach((value, index) => {
    assertString(value, `${where}[${index}]`);
    if (seen.has(value)) fail(`${where}: duplicate value ${value}`);
    seen.add(value);
  });
}

function validateDate(value, where) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(`${where}: expected YYYY-MM-DD`);
  }
  const normalized = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(normalized.getTime()) || normalized.toISOString().slice(0, 10) !== value) {
    fail(`${where}: invalid calendar date ${value}`);
  }
}

function validatePoint(point, where) {
  if (!Array.isArray(point) || point.length !== 2 || !point.every(isFiniteNumber)) {
    fail(`${where}: expected [x,y] finite coordinate pair`);
  }
  const [x, y] = point;
  if (x < MIN_X || x > MAX_X || y < MIN_Y || y > MAX_Y) {
    fail(`${where}: coordinate outside governed SVG bounds (${x},${y})`);
  }
}

function validateCorridor(corridor, where) {
  if (!corridor || typeof corridor !== 'object' || Array.isArray(corridor)) fail(`${where}: expected object`);
  const allowed = new Set(['id', 'label', 'status', 'confidence', 'geometry', 'source_ids']);
  Object.keys(corridor).forEach((key) => {
    if (!allowed.has(key)) fail(`${where}: unsupported property ${key}`);
  });
  assertString(corridor.id, `${where}.id`);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(corridor.id)) fail(`${where}.id: invalid identifier`);
  assertString(corridor.label, `${where}.label`, 2);
  if (!ALLOWED_CORRIDOR_STATUS.has(corridor.status)) fail(`${where}.status: non-canonical ${corridor.status}`);
  if (!ALLOWED_CONFIDENCE.has(corridor.confidence)) fail(`${where}.confidence: non-canonical ${corridor.confidence}`);
  const geometry = corridor.geometry;
  if (!geometry || typeof geometry !== 'object' || Array.isArray(geometry)) fail(`${where}.geometry: expected object`);
  if (geometry.type !== 'polygon') fail(`${where}.geometry.type: must be polygon`);
  if (!Array.isArray(geometry.points) || geometry.points.length < 3) fail(`${where}.geometry.points: polygon requires at least 3 points`);
  geometry.points.forEach((point, index) => validatePoint(point, `${where}.geometry.points[${index}]`));
  const uniqueVertices = new Set(geometry.points.map((point) => `${point[0]},${point[1]}`));
  if (uniqueVertices.size < 3) fail(`${where}.geometry.points: polygon requires 3 distinct vertices`);
  const doubledArea = geometry.points.reduce((sum, point, index, points) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0);
  if (Math.abs(doubledArea) < 0.000001) fail(`${where}.geometry.points: polygon area must be non-zero`);
  assertUniqueStrings(corridor.source_ids, `${where}.source_ids`);
}

function validateArea(area, where) {
  if (!area || typeof area !== 'object' || Array.isArray(area)) fail(`${where}: expected object`);
  if ('x' in area || 'y' in area || 'coordinate' in area || 'coordinates' in area) {
    fail(`${where}: an uncertainty area cannot own a single point coordinate`);
  }
  const allowed = new Set([
    'id', 'label', 'feature_type', 'status', 'single_authoritative_point',
    'reader_label', 'corridors', 'palaeowater', 'credits'
  ]);
  Object.keys(area).forEach((key) => {
    if (!allowed.has(key)) fail(`${where}: unsupported property ${key}`);
  });
  assertString(area.id, `${where}.id`);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(area.id)) fail(`${where}.id: invalid identifier`);
  assertString(area.label, `${where}.label`, 2);
  if (area.feature_type !== 'uncertainty-area') fail(`${where}.feature_type: must be uncertainty-area`);
  if (!ALLOWED_STATUS.has(area.status)) fail(`${where}.status: non-canonical ${area.status}`);
  if (area.single_authoritative_point !== false) fail(`${where}.single_authoritative_point: must be false`);
  assertString(area.reader_label, `${where}.reader_label`, 24);
  if (!Array.isArray(area.corridors) || area.corridors.length < 2) fail(`${where}.corridors: expected at least two candidate corridors`);
  const corridorIds = new Set();
  area.corridors.forEach((corridor, index) => {
    validateCorridor(corridor, `${where}.corridors[${index}]`);
    if (corridorIds.has(corridor.id)) fail(`${where}.corridors: duplicate id ${corridor.id}`);
    corridorIds.add(corridor.id);
  });
  if (!area.corridors.some((corridor) => corridor.status === 'CANDIDATE')) {
    fail(`${where}.corridors: at least one corridor must be CANDIDATE`);
  }

  const palaeowater = area.palaeowater;
  if (!palaeowater || typeof palaeowater !== 'object' || Array.isArray(palaeowater)) fail(`${where}.palaeowater: expected object`);
  const palaeowaterAllowed = new Set(['dataset_date', 'reconstruction_label', 'source_ids', 'modern_boundary_distinct']);
  Object.keys(palaeowater).forEach((key) => {
    if (!palaeowaterAllowed.has(key)) fail(`${where}.palaeowater: unsupported property ${key}`);
  });
  validateDate(palaeowater.dataset_date, `${where}.palaeowater.dataset_date`);
  assertString(palaeowater.reconstruction_label, `${where}.palaeowater.reconstruction_label`, 2);
  assertUniqueStrings(palaeowater.source_ids, `${where}.palaeowater.source_ids`);
  if (palaeowater.modern_boundary_distinct !== true) fail(`${where}.palaeowater.modern_boundary_distinct: must be true`);

  const credits = area.credits;
  if (!credits || typeof credits !== 'object' || Array.isArray(credits)) fail(`${where}.credits: expected object`);
  const creditsAllowed = new Set(['label', 'source_url', 'rights']);
  Object.keys(credits).forEach((key) => {
    if (!creditsAllowed.has(key)) fail(`${where}.credits: unsupported property ${key}`);
  });
  assertString(credits.label, `${where}.credits.label`, 2);
  assertString(credits.rights, `${where}.credits.rights`, 2);
  if (typeof credits.source_url !== 'string' || !credits.source_url.startsWith('https://')) {
    fail(`${where}.credits.source_url: canonical credits URL must use HTTPS`);
  }
}

function validateRouteObject(route, label) {
  const areas = route.uncertainty_areas;
  if (areas === undefined) {
    const illegalPoint = (route.places || []).find((place) => place?.type === 'uncertainty-area');
    if (illegalPoint) fail(`${label}: uncertainty-area ${illegalPoint.id || '(missing id)'} must live in uncertainty_areas[], not places[]`);
    return 0;
  }
  if (!Array.isArray(areas)) fail(`${label}: uncertainty_areas must be an array`);
  const ids = new Set();
  areas.forEach((area, index) => {
    validateArea(area, `${label}: uncertainty_areas[${index}]`);
    if (ids.has(area.id)) fail(`${label}: duplicate uncertainty area id ${area.id}`);
    ids.add(area.id);
  });
  const places = Array.isArray(route.places) ? route.places : [];
  const illegalPoint = places.find((place) => place?.type === 'uncertainty-area');
  if (illegalPoint) fail(`${label}: uncertainty-area ${illegalPoint.id || '(missing id)'} must not be duplicated in places[]`);
  const duplicatePlace = places.find((place) => ids.has(place?.id));
  if (duplicatePlace) fail(`${label}: uncertainty area id ${duplicatePlace.id} must not also exist in places[]`);
  return areas.length;
}

function main() {
  const schema = readJson(SCHEMA_PATH);
  if (schema?.properties?.feature_type?.const !== 'uncertainty-area') {
    fail('karty/_shared/uncertainty-area.schema.json: feature_type const drift');
  }
  if (schema?.properties?.single_authoritative_point?.const !== false) {
    fail('karty/_shared/uncertainty-area.schema.json: single-point prohibition drift');
  }
  const files = routeFiles();
  if (!files.length) fail('no governed karty/*/route.json files discovered');
  let areaCount = 0;
  files.forEach((file) => {
    const label = path.relative(ROOT, file).replaceAll('\\', '/');
    areaCount += validateRouteObject(readJson(file), label);
  });
  console.log(`PASS map uncertainty-area contract: ${files.length} routes, ${areaCount} area(s)`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`FAIL map uncertainty-area contract: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { validateArea, validateRouteObject };
