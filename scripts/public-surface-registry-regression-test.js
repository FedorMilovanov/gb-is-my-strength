#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const { loadRouteRecords } = require('./lib/effective-route-registry');
const {
  SERIES_FACADE,
  HISTORICAL_SERIES_IMPL,
  buildPublicSurfaceRegistry,
} = require('./lib/public-surface-registry');

const loaded = loadRouteRecords();
const baseline = buildPublicSurfaceRegistry({ loaded });
assert.deepEqual(baseline.errors, [], baseline.errors.join('\n'));
assert.equal(baseline.entries.length, 76);
assert.deepEqual(baseline.counts, { page: 9, series: 51, article: 2, special: 14 });
assert.deepEqual(baseline.shapeCounts, { flat: 27, book: 24 });

const entryByRoute = new Map(baseline.entries.map((entry) => [entry.route, entry]));
const bookEntry = entryByRoute.get('/articles/novoe-serdce/');
const pageEntry = entryByRoute.get('/about/');
const specialEntry = entryByRoute.get('/karty/avraam/');
assert.ok(bookEntry, 'book fixture must be present in registry');
assert.ok(pageEntry, 'ordinary page fixture must be present in registry');
assert.ok(specialEntry, 'special map fixture must be present in registry');
assert.equal(bookEntry.settingsCapability, 'reader-ui');
assert.equal(pageEntry.settingsCapability, 'global-preferences');
assert.equal(specialEntry.settingsCapability, 'global-preferences+special-bridge');
assert.ok(
  bookEntry.configSources.includes('src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts'),
  'book route must resolve the canonical hard-texts series config'
);

function cloneRecord(route) {
  const record = loaded.records.find((item) => item.route === route);
  assert.ok(record, `missing fixture route ${route}`);
  return JSON.parse(JSON.stringify(record));
}

function errorsFor(record) {
  const mobileEntries = new Map();
  if (baseline.mobileEntries.has(record.route)) {
    mobileEntries.set(record.route, baseline.mobileEntries.get(record.route));
  }
  return buildPublicSurfaceRegistry({
    loaded,
    records: [record],
    expectedRoutes: [record.route],
    mobileEntries,
  }).errors;
}

{
  const record = cloneRecord('/articles/novoe-serdce/');
  record.profile.surface = 'nonsense';
  assert.ok(errorsFor(record).some((error) => error.includes('invalid or missing surface')));
}
{
  const record = cloneRecord('/articles/novoe-serdce/');
  delete record.profile.seriesShape;
  assert.ok(errorsFor(record).some((error) => error.includes('series requires seriesShape')));
}
{
  const record = cloneRecord('/articles/novoe-serdce/');
  record.profile.seriesShape = 'flat';
  assert.ok(errorsFor(record).some((error) => error.includes('hardTextsSeriesConfig import requires')));
}
{
  const record = cloneRecord('/karty/avraam/');
  record.inspection.imports.push({ importer: record.sourceRel, resolved: SERIES_FACADE });
  assert.ok(errorsFor(record).some((error) => error.includes('must not import SeriesReaderChrome')));
}
{
  const record = cloneRecord('/articles/dzhon-gill-chast-1-chelovek/');
  record.inspection.imports.push({ importer: record.sourceRel, resolved: HISTORICAL_SERIES_IMPL });
  assert.ok(errorsFor(record).some((error) => error.includes('direct GillSeriesChrome import outside façade')));
}
{
  const record = cloneRecord('/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/');
  record.profile.source = 'src/pages/drifted/index.astro';
  assert.ok(errorsFor(record).some((error) => error.includes('profile.source drift')));
}
{
  const record = cloneRecord('/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/');
  record.profile.surface = 'page';
  assert.ok(errorsFor(record).some((error) => error.includes('mobile engine=article requires surface=article')));
}
{
  const records = loaded.records.slice(1);
  const result = buildPublicSurfaceRegistry({ loaded, records });
  assert.ok(result.errors.some((error) => error.includes('missing from public surface registry')));
}
{
  const record = cloneRecord('/about/');
  record.profile.surface = 'series';
  record.profile.seriesShape = 'book';
  assert.ok(errorsFor(record).some((error) => error.includes('requires resolved hardTextsSeriesConfig import')));
}

console.log('✅ public-surface-registry mutation tests passed');
