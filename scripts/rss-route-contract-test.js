#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { loadRouteRecords } = require('./lib/effective-route-registry');
const {
  auditRssContract,
  contractProblems,
  inventoryWarnings,
  routeToUrl,
} = require('./lib/rss-route-contract');

const ROOT = path.resolve(__dirname, '..');
const feed = fs.readFileSync(path.join(ROOT, 'feed.xml'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/search-manifest.json'), 'utf8'));
const loaded = loadRouteRecords();
const baseline = auditRssContract(feed, { loaded, manifest });
const problems = contractProblems(baseline);
const warnings = inventoryWarnings(baseline);

assert.deepEqual(problems, [], problems.join('\n'));
assert.ok(baseline.itemCount >= 1, 'feed must contain at least one item');
assert.equal(
  baseline.localRoutes.length,
  baseline.itemCount,
  'every RSS item must resolve to one unique canonical local route'
);
assert.ok(
  baseline.localRoutes.every((route) => loaded.records.some((record) => record.route === route)),
  'every RSS route must exist in the effective route registry'
);

const fixtureLoaded = {
  records: [
    {
      route: '/article/',
      owner: { status: 'production-dist' },
      profile: { seo: { indexable: true } },
    },
  ],
};
const fixtureManifest = {
  items: [
    {
      id: 'article',
      type: 'article',
      url: '/article/',
      title: 'Article',
      description: 'Description',
      publishedTime: '2026-07-20T12:00:00+03:00',
    },
  ],
};
const fixture = `<?xml version="1.0"?><rss><channel>
<title>Fixture</title><link>https://gospod-bog.ru/</link>
<lastBuildDate>Mon, 20 Jul 2026 12:00:00 +0300</lastBuildDate>
<atom:link href="https://gospod-bog.ru/feed.xml" rel="self" type="application/rss+xml"/>
<item><title>Article</title><link>${routeToUrl('/article/')}</link><guid>${routeToUrl('/article/')}</guid><pubDate>Mon, 20 Jul 2026 12:00:00 +0300</pubDate><description><![CDATA[Description]]></description></item>
</channel></rss>`;

assert.deepEqual(contractProblems(auditRssContract(fixture, { loaded: fixtureLoaded, manifest: fixtureManifest })), []);

const duplicate = auditRssContract(
  fixture.replace('</channel>', `<item><title>Duplicate</title><link>${routeToUrl('/article/')}</link><guid>${routeToUrl('/article/')}</guid><pubDate>Mon, 20 Jul 2026 12:00:00 +0300</pubDate><description>Duplicate</description></item></channel>`),
  { loaded: fixtureLoaded, manifest: fixtureManifest }
);
assert.ok(duplicate.duplicateRoutes.includes('/article/'), 'duplicate route must fail');

const foreign = auditRssContract(
  fixture.replaceAll(routeToUrl('/article/'), 'https://example.com/article/'),
  { loaded: fixtureLoaded, manifest: fixtureManifest }
);
assert.ok(foreign.foreignUrls.includes('https://example.com/article/'), 'foreign item URL must fail');

const unknown = auditRssContract(
  fixture.replaceAll(routeToUrl('/article/'), routeToUrl('/unknown/')),
  { loaded: fixtureLoaded, manifest: fixtureManifest }
);
assert.ok(unknown.unregisteredRoutes.includes('/unknown/'), 'unregistered route must fail');

const stale = auditRssContract(
  fixture.replace('Mon, 20 Jul 2026 12:00:00 +0300</lastBuildDate>', 'Sun, 19 Jul 2026 12:00:00 +0300</lastBuildDate>'),
  { loaded: fixtureLoaded, manifest: fixtureManifest }
);
assert.equal(stale.staleLastBuildDate.length, 1, 'lastBuildDate older than newest item must fail');

const missingGuid = auditRssContract(
  fixture.replace(`<guid>${routeToUrl('/article/')}</guid>`, ''),
  { loaded: fixtureLoaded, manifest: fixtureManifest }
);
assert.ok(missingGuid.missingFields.some((value) => value.endsWith('missing guid')), 'missing guid must fail');

fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, 'reports/rss-route-contract.json'),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    problems,
    warnings,
    summary: {
      itemCount: baseline.itemCount,
      registeredRoutes: baseline.localRoutes.length,
      feedRoutesMissingFromManifest: baseline.feedRoutesMissingFromManifest.length,
      chronologicalInversions: baseline.chronologicalInversions.length,
    },
    audit: baseline,
  }, null, 2) + '\n'
);

console.log(
  `✅ RSS route contract: ${baseline.itemCount} canonical registered items; `
  + `${warnings.length} migration warning(s) recorded in reports/rss-route-contract.json`
);
