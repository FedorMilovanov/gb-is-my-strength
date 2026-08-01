#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { mergeObservedRecord, observeRoute } = require('./lib/editorial-metadata');
const {
  validateRegistryV3,
  projectHtml,
  projectRegistryToDist,
} = require('./lib/editorial-metadata-v3');

const previous = Object.freeze({
  route: '/articles/example/',
  canonical: 'https://gospod-bog.ru/articles/old/',
  title: 'Editorial title',
  metadataSource: 'old-source.astro',
  contentType: 'article',
  editorialPublishedAt: '2026-07-14T18:00:00.000Z',
  editorialModifiedAt: '2026-07-10T21:00:00.000Z',
  originalWorkPublishedAt: '1700-01-01T00:00:00.000Z',
  reviewStatus: 'inconsistent-needs-review',
  provenance: 'production-like-dist-migration-freeze',
  observations: Object.freeze({ rssPublishedAt: 'old' }),
});
const observed = Object.freeze({
  route: '/articles/example/',
  canonical: 'https://gospod-bog.ru/articles/example/',
  title: 'Observed title',
  metadataSource: 'new-source.astro',
  contentType: 'series-article',
  editorialPublishedAt: '2026-07-11T21:00:00.000Z',
  editorialModifiedAt: '2026-07-11T21:00:00.000Z',
  originalWorkPublishedAt: null,
  reviewStatus: 'migration-freeze-unverified',
  provenance: 'replacement-provenance',
  observations: Object.freeze({ rssPublishedAt: 'new' }),
});

const merged = mergeObservedRecord(previous, observed);
assert.deepEqual(merged, {
  ...previous,
  canonical: observed.canonical,
  title: observed.title,
  metadataSource: observed.metadataSource,
  observations: observed.observations,
});
assert.equal(merged.editorialPublishedAt, previous.editorialPublishedAt);
assert.equal(merged.editorialModifiedAt, previous.editorialModifiedAt);
assert.equal(merged.originalWorkPublishedAt, previous.originalWorkPublishedAt);
assert.equal(merged.reviewStatus, previous.reviewStatus);
assert.equal(merged.provenance, previous.provenance);
assert.equal(merged.contentType, previous.contentType);
assert.deepEqual(mergeObservedRecord(null, observed), observed);
assert.deepEqual(previous.observations, { rssPublishedAt: 'old' });

const approved = { ...previous, reviewStatus: 'approved' };
const approvedMerged = mergeObservedRecord(approved, observed);
assert.equal(approvedMerged.reviewStatus, 'approved');
assert.equal(approvedMerged.editorialPublishedAt, approved.editorialPublishedAt);
assert.deepEqual(approvedMerged.observations, observed.observations);

const distRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'editorial-rss-item-'));
try {
  const route = '/articles/old-entry/';
  const distFile = path.join(distRoot, 'articles/old-entry/index.html');
  fs.mkdirSync(path.dirname(distFile), { recursive: true });
  fs.writeFileSync(
    distFile,
    '<!doctype html><html><head><title>Old entry</title><link rel="canonical" href="https://gospod-bog.ru/articles/old-entry/"></head><body></body></html>',
    'utf8'
  );

  const feedXml = `<?xml version="1.0"?><rss><channel>
    <item><link>https://gospod-bog.ru/articles/new-entry/</link><pubDate>Tue, 28 Jul 2026 21:00:00 GMT</pubDate></item>
    <item><link>https://gospod-bog.ru/articles/old-entry/</link><pubDate>Sat, 11 Jul 2026 21:00:00 GMT</pubDate></item>
  </channel></rss>`;

  const routeRecord = {
    route,
    sourceRel: 'src/pages/articles/old-entry/index.astro',
    inspection: { headImports: [] },
    profile: { routeType: 'article' },
  };
  const shared = { searchItems: [], sitemapXml: '', feedXml };
  const rssObserved = observeRoute(routeRecord, distRoot, shared);
  assert.equal(rssObserved.observations.rssPublishedAt, '2026-07-11T21:00:00.000Z');

  const missingRoute = {
    ...routeRecord,
    route: '/articles/missing-entry/',
  };
  const missingFile = path.join(distRoot, 'articles/missing-entry/index.html');
  fs.mkdirSync(path.dirname(missingFile), { recursive: true });
  fs.copyFileSync(distFile, missingFile);
  const missingObserved = observeRoute(missingRoute, distRoot, shared);
  assert.equal(missingObserved.observations.rssPublishedAt, null);
} finally {
  fs.rmSync(distRoot, { recursive: true, force: true });
}

function fixtureRecord(overrides = {}) {
  return {
    route: '/articles/example/',
    canonical: 'https://gospod-bog.ru/articles/example/',
    title: 'Example',
    metadataSource: 'src/components/example/ExamplePageHead.astro',
    contentType: 'article',
    editorialPublishedAt: '2026-07-01T09:00:00.000Z',
    editorialModifiedAt: '2026-07-02T10:30:00.000Z',
    originalWorkPublishedAt: null,
    reviewStatus: 'approved',
    provenance: 'owner-reviewed-editorial-decision',
    observations: {},
    ...overrides,
  };
}

function fixtureRegistry(record = fixtureRecord()) {
  return {
    version: 1,
    policy: {
      model: 'editorial-time-is-not-build-time',
      freezeMode: 'observed-projections-with-review-status',
      approvedRecordsRequireProjectionConvergence: true,
      technicalCommitsMayChangeEditorialDates: false,
    },
    sourceCommit: 'fixture',
    records: { [record.route]: record },
  };
}

const now = Date.parse('2026-08-01T00:00:00.000Z');
assert.deepEqual(validateRegistryV3(fixtureRegistry(), { now }), []);
assert.deepEqual(
  validateRegistryV3(fixtureRegistry(fixtureRecord({ editorialModifiedAt: null })), { now }),
  [],
  'null must be the explicit unknown-date semantic'
);

const missingField = fixtureRecord();
delete missingField.editorialModifiedAt;
assert.match(validateRegistryV3(fixtureRegistry(missingField), { now }).join('\n'), /editorialModifiedAt missing/);
assert.match(
  validateRegistryV3(fixtureRegistry(fixtureRecord({
    editorialModifiedAt: '2026-06-01T00:00:00.000Z',
  })), { now }).join('\n'),
  /precedes editorialPublishedAt/
);
assert.match(
  validateRegistryV3(fixtureRegistry(fixtureRecord({
    editorialModifiedAt: '2027-01-01T00:00:00.000Z',
  })), { now }).join('\n'),
  /in the future/
);
assert.match(
  validateRegistryV3(fixtureRegistry(fixtureRecord({
    provenance: 'git-commit-mtime',
  })), { now }).join('\n'),
  /technical build\/Git\/cache source/
);

const duplicateIdentity = fixtureRegistry();
duplicateIdentity.records['/articles/other/'] = {
  ...fixtureRecord(),
  canonical: 'https://gospod-bog.ru/articles/example/',
};
assert.match(validateRegistryV3(duplicateIdentity, { now }).join('\n'), /duplicate record identity/);

const projectionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'editorial-v3-projection-'));
try {
  const route = '/articles/example/';
  const htmlFile = path.join(projectionRoot, 'articles/example/index.html');
  fs.mkdirSync(path.dirname(htmlFile), { recursive: true });
  fs.writeFileSync(htmlFile, `<!doctype html><html><head>
<meta property="article:published_time" content="2025-01-01T00:00:00.000Z">
<meta property="article:modified_time" content="2025-01-02T00:00:00.000Z">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","url":"https://gospod-bog.ru/articles/example/","datePublished":"2025-01-01T00:00:00.000Z","dateModified":"2025-01-02T00:00:00.000Z"}</script>
</head><body>
<p class="article-byline">Опубликовано <time datetime="2025-01-01T00:00:00.000Z">1 января</time></p>
<p class="article-updated">Обновлено <time datetime="2025-01-02T00:00:00.000Z">2 января</time></p>
<main data-pagefind-body><h1>Example</h1></main>
</body></html>`, 'utf8');

  const dataDir = path.join(projectionRoot, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'search-manifest.json'), JSON.stringify({
    version: 1,
    generatedAt: '2026-06-01T00:00:00Z',
    items: [{
      url: route,
      publishedTime: '2025-01-01T00:00:00.000Z',
      modifiedTime: '2025-01-02T00:00:00.000Z',
    }],
  }, null, 2) + '\n');

  fs.writeFileSync(path.join(projectionRoot, 'sitemap-0.xml'), `<?xml version="1.0"?>
<urlset><url><loc>https://gospod-bog.ru/articles/example/</loc><lastmod>2025-01-02T00:00:00.000Z</lastmod></url></urlset>
`);
  fs.writeFileSync(path.join(projectionRoot, 'feed.xml'), `<?xml version="1.0"?><rss><channel>
<language>ru</language><lastBuildDate>Thu, 02 Jan 2025 00:00:00 GMT</lastBuildDate>
<item><link>https://gospod-bog.ru/articles/example/</link><guid isPermaLink="true">https://gospod-bog.ru/articles/example/</guid><pubDate>Wed, 01 Jan 2025 00:00:00 GMT</pubDate></item>
</channel></rss>`);

  const report = projectRegistryToDist({
    distRoot: projectionRoot,
    registry: fixtureRegistry(),
    technicalInstant: '2026-08-01T01:00:00.000Z',
    reportFile: path.join(projectionRoot, 'projection-report.json'),
    now,
  });
  assert.equal(report.htmlMatched, 1);
  assert.equal(report.searchManifestMatched, 1);
  assert.equal(report.sitemapMatched, 1);
  assert.equal(report.rssMatched, 1);
  assert.equal(report.technicalBuildInstant, '2026-08-01T01:00:00.000Z');

  const projectedHtml = fs.readFileSync(htmlFile, 'utf8');
  assert.match(projectedHtml, /article:published_time" content="2026-07-01T09:00:00\.000Z"/);
  assert.match(projectedHtml, /article:modified_time" content="2026-07-02T10:30:00\.000Z"/);
  assert.match(projectedHtml, /"datePublished": "2026-07-01T09:00:00\.000Z"/);
  assert.match(projectedHtml, /"dateModified": "2026-07-02T10:30:00\.000Z"/);
  assert.match(projectedHtml, /article-byline[\s\S]*datetime="2026-07-01T09:00:00\.000Z"/);
  assert.match(projectedHtml, /article-updated[\s\S]*datetime="2026-07-02T10:30:00\.000Z"/);
  assert.match(projectedHtml, /data-pagefind-meta="publishedTime" hidden>2026-07-01T09:00:00\.000Z/);
  assert.match(projectedHtml, /data-pagefind-meta="modifiedTime" hidden>2026-07-02T10:30:00\.000Z/);

  const projectedManifest = JSON.parse(fs.readFileSync(path.join(dataDir, 'search-manifest.json'), 'utf8'));
  assert.equal(projectedManifest.items[0].publishedTime, '2026-07-01T09:00:00.000Z');
  assert.equal(projectedManifest.items[0].modifiedTime, '2026-07-02T10:30:00.000Z');
  assert.match(fs.readFileSync(path.join(projectionRoot, 'sitemap-0.xml'), 'utf8'), /2026-07-02T10:30:00\.000Z/);
  const projectedFeed = fs.readFileSync(path.join(projectionRoot, 'feed.xml'), 'utf8');
  assert.match(projectedFeed, /Wed, 01 Jul 2026 09:00:00 GMT/);
  assert.match(projectedFeed, /Sat, 01 Aug 2026 01:00:00 GMT/);

  const unknown = fixtureRecord({
    editorialPublishedAt: null,
    editorialModifiedAt: null,
    reviewStatus: 'migration-freeze-unverified',
  });
  const unknownHtml = projectHtml(projectedHtml, route, unknown);
  assert.doesNotMatch(unknownHtml, /article:(?:published|modified)_time/);
  assert.doesNotMatch(unknownHtml, /"date(?:Published|Modified)"/);
  assert.doesNotMatch(unknownHtml, /data-pagefind-meta="(?:publishedTime|modifiedTime)"/);

  assert.throws(
    () => projectHtml(
      projectedHtml.replace(
        '<meta property="article:published_time"',
        '<meta property="article:published_time" content="duplicate"><meta property="article:published_time"'
      ),
      route,
      fixtureRecord()
    ),
    /duplicate article:published_time metadata/
  );
} finally {
  fs.rmSync(projectionRoot, { recursive: true, force: true });
}

console.log('✅ Editorial Metadata v3 preserves decisions and projects one final date owner');
