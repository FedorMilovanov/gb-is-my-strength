#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const PRE_WAVE12 = '2273b8c930eebf383d429b917d3636bc28a80bae';
const RELEASE_BOUNDARY = '8f17085dc8411cffbcb5a4dcd2f8fc5db9c30a97';
const ROUTE = '/articles/diotrefy-nashego-vremeni/';
const SEARCH_ID = 'diotrefy-nashego-vremeni';
const PATHS = {
  ownership: 'migration/page-ownership.json',
  matrix: 'migration/route-migration-matrix.json',
  searchPolicy: 'data/route-search-policy.json',
  searchManifest: 'data/search-manifest.json',
  series: 'data/series.json',
};

const errors = [];
const requireValue = (condition, message) => {
  if (!condition) errors.push(message);
};

function git(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', ...options }).trimEnd();
}

function gitJson(ref, file) {
  try {
    return JSON.parse(git(['show', `${ref}:${file}`]));
  } catch (error) {
    errors.push(`${ref}:${file}: cannot parse JSON: ${error.stderr?.toString().trim() || error.message}`);
    return {};
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right, 'en'))
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function deepEqual(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function project(value, fields) {
  return Object.fromEntries(fields.map((field) => [field, value?.[field]]));
}

function unique(values, label) {
  requireValue(new Set(values).size === values.length, `${label}: duplicate values`);
}

function preserveMap({ before, after, label, projection = (value) => value }) {
  for (const [key, oldValue] of Object.entries(before || {})) {
    const current = after?.[key];
    requireValue(Boolean(current), `${label}: pre-Wave12 key disappeared: ${key}`);
    if (!current) continue;
    requireValue(
      deepEqual(projection(current), projection(oldValue)),
      `${label}: protected projection changed: ${key}`
    );
  }
}

try {
  execFileSync('git', ['merge-base', '--is-ancestor', PRE_WAVE12, RELEASE_BOUNDARY]);
  execFileSync('git', ['merge-base', '--is-ancestor', RELEASE_BOUNDARY, 'HEAD']);
} catch {
  errors.push('Wave 12 transaction refs are not ancestors in the expected order');
}

const beforeOwnership = gitJson(PRE_WAVE12, PATHS.ownership);
const afterOwnership = gitJson(RELEASE_BOUNDARY, PATHS.ownership);
const beforeMatrix = gitJson(PRE_WAVE12, PATHS.matrix);
const afterMatrix = gitJson(RELEASE_BOUNDARY, PATHS.matrix);
const beforePolicy = gitJson(PRE_WAVE12, PATHS.searchPolicy);
const afterPolicy = gitJson(RELEASE_BOUNDARY, PATHS.searchPolicy);
const beforeSearch = gitJson(PRE_WAVE12, PATHS.searchManifest);
const afterSearch = gitJson(RELEASE_BOUNDARY, PATHS.searchManifest);
const beforeSeries = gitJson(PRE_WAVE12, PATHS.series);
const afterSeries = gitJson(RELEASE_BOUNDARY, PATHS.series);

// Page ownership is transaction-critical. Existing route ownership bytes may
// be reformatted, but their complete semantic objects may not change.
preserveMap({
  before: beforeOwnership.routes,
  after: afterOwnership.routes,
  label: 'page ownership',
});
requireValue(
  Object.keys(afterOwnership.routes || {}).length === Object.keys(beforeOwnership.routes || {}).length + 1,
  'page ownership must add exactly one route'
);
requireValue(deepEqual(afterOwnership.routes?.[ROUTE], {
  owner: 'astro',
  source: 'src/pages/articles/diotrefy-nashego-vremeni/index.astro',
  risk: 3,
  status: 'production-dist',
}), 'Wave 12 page-ownership record drift');

// Global matrix regeneration legitimately rewrote explanatory `reason` text.
// Preserve only executable routing semantics owned by the runtime contract.
const matrixProjection = (record) => project(record, [
  'mode',
  'source',
  'scope',
  'requiredMarkers',
  'audits',
]);
preserveMap({
  before: beforeMatrix.routes,
  after: afterMatrix.routes,
  label: 'migration matrix',
  projection: matrixProjection,
});
requireValue(
  Object.keys(afterMatrix.routes || {}).length === Object.keys(beforeMatrix.routes || {}).length + 1,
  'migration matrix must add exactly one route'
);
requireValue(deepEqual(matrixProjection(afterMatrix.routes?.[ROUTE]), {
  mode: 'strict-native',
  source: 'src/pages/articles/diotrefy-nashego-vremeni/index.astro',
  scope: undefined,
  requiredMarkers: ['data-pagefind-body', 'data-wave12-publication'],
  audits: ['native-source-contract', 'native-runtime-taxonomy', 'diotrophes-wave12-release'],
}), 'Wave 12 migration-matrix executable projection drift');

// Editorial categorisation may evolve independently. The five blocking
// publication/discovery decisions must remain stable for every old route.
const policyProjection = (record) => project(record, [
  'indexPolicy',
  'pagefindPolicy',
  'searchManifestPolicy',
  'sitemapPolicy',
  'rssPolicy',
]);
preserveMap({
  before: beforePolicy.routes,
  after: afterPolicy.routes,
  label: 'search policy',
  projection: policyProjection,
});
requireValue(
  Object.keys(afterPolicy.routes || {}).length === Object.keys(beforePolicy.routes || {}).length + 1,
  'search policy must add exactly one route'
);
requireValue(deepEqual(policyProjection(afterPolicy.routes?.[ROUTE]), {
  indexPolicy: 'index',
  pagefindPolicy: 'include',
  searchManifestPolicy: 'include',
  sitemapPolicy: 'include',
  rssPolicy: 'include',
}), 'Wave 12 blocking search-policy projection drift');

// Search descriptions, titles, images and timing estimates are editorial
// metadata. Preserve publication identity and series linkage for all old items.
const beforeItems = Array.isArray(beforeSearch.items) ? beforeSearch.items : [];
const afterItems = Array.isArray(afterSearch.items) ? afterSearch.items : [];
const searchIdentity = (item) => project(item, [
  'id',
  'type',
  'url',
  'editor',
  'author',
  'publishedTime',
  'seriesId',
  'seriesPosition',
]);
unique(beforeItems.map((item) => item.id), 'pre-Wave12 search IDs');
unique(afterItems.map((item) => item.id), 'release search IDs');
unique(beforeItems.map((item) => item.url), 'pre-Wave12 search URLs');
unique(afterItems.map((item) => item.url), 'release search URLs');
const afterItemsById = new Map(afterItems.map((item) => [item.id, item]));
for (const oldItem of beforeItems) {
  const current = afterItemsById.get(oldItem.id);
  requireValue(Boolean(current), `search manifest lost pre-Wave12 item: ${oldItem.id}`);
  if (!current) continue;
  requireValue(
    deepEqual(searchIdentity(current), searchIdentity(oldItem)),
    `search manifest publication identity changed: ${oldItem.id}`
  );
}
requireValue(afterItems.length === beforeItems.length + 1, 'search manifest must add exactly one item');
const newSearchItem = afterItemsById.get(SEARCH_ID);
requireValue(Boolean(newSearchItem), 'Wave 12 search-manifest item missing');
requireValue(deepEqual(project(newSearchItem, [
  'id', 'type', 'url', 'title', 'section', 'editor', 'readTime', 'publishedTime',
  'modifiedTime', 'seriesId', 'seriesPosition', 'scripture',
]), {
  id: SEARCH_ID,
  type: 'article',
  url: ROUTE,
  title: 'Диотрефы нашего времени: власть, подотчётность и верность',
  section: 'Служение',
  editor: 'Фёдор Милованов',
  readTime: 35,
  publishedTime: '2026-08-02T00:00:00+03:00',
  modifiedTime: '2026-08-02T00:00:00+03:00',
  seriesId: 'pastor-series',
  seriesPosition: 2,
  scripture: '3 Ин 9–10, 1 Тим 5:19–20, 1 Пет 5:1–4',
}), 'Wave 12 search-manifest authority drift');

// Unrelated series remain semantically identical. The pastor series retains
// its identity and old parts, then adds exactly one exact published Part II.
for (const [seriesId, oldSeries] of Object.entries(beforeSeries || {})) {
  const currentSeries = afterSeries?.[seriesId];
  requireValue(Boolean(currentSeries), `series registry lost series: ${seriesId}`);
  if (!currentSeries) continue;
  if (seriesId !== 'pastor-series') {
    requireValue(deepEqual(currentSeries, oldSeries), `unrelated series changed: ${seriesId}`);
    continue;
  }
  requireValue(currentSeries.title === oldSeries.title, 'pastor-series title drift');
  requireValue(currentSeries.baseUrl === oldSeries.baseUrl, 'pastor-series baseUrl drift');
  const currentParts = Array.isArray(currentSeries.parts) ? currentSeries.parts : [];
  for (const oldPart of oldSeries.parts || []) {
    const currentPart = currentParts.find((part) => part.slug === oldPart.slug);
    requireValue(deepEqual(currentPart, oldPart), `pastor-series old part changed: ${oldPart.slug}`);
  }
  requireValue(
    currentParts.length === (oldSeries.parts || []).length + 1,
    'pastor-series must add exactly one part'
  );
  requireValue(deepEqual(currentParts.find((part) => part.slug === SEARCH_ID), {
    n: 2,
    slug: SEARCH_ID,
    title: 'Диотрефы нашего времени',
    status: 'published',
    readingTime: 35,
  }), 'pastor-series Part II authority drift');
}
requireValue(
  Object.keys(afterSeries || {}).length === Object.keys(beforeSeries || {}).length,
  'Wave 12 must not add or remove a series registry'
);

if (errors.length) {
  console.error(`❌ Diotrophes Wave 12 transaction scope failed (${errors.length})`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(
  `✅ Diotrophes Wave 12 transaction scope passed: ` +
  `${Object.keys(beforeOwnership.routes || {}).length} ownership routes, ` +
  `${Object.keys(beforeMatrix.routes || {}).length} matrix routes, ` +
  `${Object.keys(beforePolicy.routes || {}).length} search policies and ` +
  `${beforeItems.length} search identities preserved; exactly one Wave 12 route/item/part added`
);
