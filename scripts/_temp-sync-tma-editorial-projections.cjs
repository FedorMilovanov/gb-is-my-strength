'use strict';

const fs = require('fs');
const assert = require('assert/strict');

const TARGET_ISO = '2026-07-29T21:00:00.000Z';
const TARGET_OFFSET = '2026-07-30T00:00:00+03:00';
const ROUTE = '/articles/tma-na-serdce/';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

const registryPath = 'data/editorial-metadata.json';
const registry = readJson(registryPath);
const record = registry.records?.[ROUTE];
assert(record, `missing editorial registry record for ${ROUTE}`);
assert.equal(record.editorialModifiedAt, '2026-07-10T21:00:00.000Z');
assert.equal(record.observations?.metaModifiedAt, '2026-07-10T21:00:00.000Z');
assert.equal(record.observations?.jsonLdModifiedAt, '2026-07-10T21:00:00.000Z');
assert.equal(record.observations?.searchModifiedAt, '2026-07-10T21:00:00.000Z');
assert.equal(record.observations?.sitemapLastmod, '2026-07-14T18:00:00.000Z');
record.editorialModifiedAt = TARGET_ISO;
record.observations.metaModifiedAt = TARGET_ISO;
record.observations.jsonLdModifiedAt = TARGET_ISO;
record.observations.searchModifiedAt = TARGET_ISO;
record.observations.sitemapLastmod = TARGET_ISO;
writeJson(registryPath, registry);

const searchPath = 'data/search-manifest.json';
const search = readJson(searchPath);
const item = search.items?.find((entry) => entry.url === ROUTE);
assert(item, `missing search manifest item for ${ROUTE}`);
assert.equal(item.modifiedTime, '2026-07-11T00:00:00+03:00');
assert.equal(item.readTime, 26);
item.modifiedTime = TARGET_OFFSET;
item.readTime = 34;
writeJson(searchPath, search);

const sitemapPath = 'sitemap.xml';
let sitemap = fs.readFileSync(sitemapPath, 'utf8');
const escapedRoute = ROUTE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pattern = new RegExp(`(<loc>https://gospod-bog\\.ru${escapedRoute}<\\/loc>\\s*<lastmod>)([^<]+)(<\\/lastmod>)`);
const match = sitemap.match(pattern);
assert(match, `missing sitemap block for ${ROUTE}`);
assert.equal(match[2], '2026-07-14T21:00:00+03:00');
sitemap = sitemap.replace(pattern, `$1${TARGET_OFFSET}$3`);
fs.writeFileSync(sitemapPath, sitemap, 'utf8');

for (const file of [
  'scripts/_temp-sync-tma-editorial-projections.cjs',
  '.github/workflows/_temp-sync-tma-editorial-projections.yml',
]) {
  fs.rmSync(file, { force: true });
}

console.log('Synced tma editorial projections and removed temporary bootstrap files.');
