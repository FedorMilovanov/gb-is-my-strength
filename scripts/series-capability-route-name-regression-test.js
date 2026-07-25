#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { SERIES_FACADE } = require('./lib/public-surface-registry');
const { validateSeriesCapabilityContract } = require('./lib/series-capability-contract');

const route = '/private-reader-name/';
const pageFile = 'src/pages/private-reader-name.astro';
const privateImplementation = 'src/components/private/SeriesReaderChrome.astro';
const deceptiveSpecifier = '@/components/private/SeriesReaderChrome.astro';
const pageSource = [
  `import SeriesReaderChrome from '${deceptiveSpecifier}';`,
  '<body data-gbs2-series="private-reader">',
  '  <SeriesReaderChrome pageId="part-1"><slot /></SeriesReaderChrome>',
  '</body>',
].join('\n');

assert.notEqual(
  privateImplementation,
  SERIES_FACADE,
  'fixture must resolve to a route-specific implementation, not the shared façade'
);

const record = {
  route,
  profile: {
    surface: 'series',
    seriesShape: 'flat',
    routeType: 'series-article',
  },
  owner: { status: 'production-dist' },
  sourceRel: pageFile,
  inspection: {
    files: [pageFile, privateImplementation],
    imports: [{
      importer: pageFile,
      specifier: deceptiveSpecifier,
      resolved: privateImplementation,
    }],
  },
};

const entry = {
  route,
  surface: 'series',
  seriesShape: 'flat',
  routeRole: 'reading',
};

const sources = new Map([
  [pageFile, pageSource],
  [privateImplementation, '<slot />'],
]);

const result = validateSeriesCapabilityContract({
  loaded: { records: [record] },
  registry: { entries: [entry] },
  records: [record],
  entries: [entry],
  exceptions: {},
  readText(file) {
    if (!sources.has(file)) throw new Error(`unexpected fixture read: ${file}`);
    return sources.get(file);
  },
  fileExists(file) {
    return sources.has(String(file).split('#', 1)[0]);
  },
});

assert.deepEqual(result.governedReadingRoutes, [route]);
assert.ok(
  result.errors.some((error) => error.includes('missing series capability exception')),
  `a route-specific component named SeriesReaderChrome must not satisfy the shared façade contract:\n${result.errors.join('\n')}`
);
assert.ok(
  result.errors.every((error) => !error.includes('bound config')),
  'the deceptive private component must be rejected before generic config validation'
);

console.log('✅ series capability: route-specific implementation names cannot impersonate the shared façade');
