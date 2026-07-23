#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadRouteRecords } = require('./lib/effective-route-registry');
const {
  expectedSeoRouteEntries,
  auditSeoRouteFiles,
} = require('./lib/seo-route-contract');

const ROOT = path.resolve(__dirname, '..');
const loaded = loadRouteRecords();
const baseline = expectedSeoRouteEntries({ loaded });

assert.equal(baseline.length, 75, 'all production-dist routes must be audited');
assert.equal(baseline.filter((entry) => entry.indexable).length, 66, 'indexable route count');
assert.equal(baseline.filter((entry) => !entry.indexable).length, 9, 'explicit noindex route count');
assert.ok(
  !baseline.some((entry) => entry.route === '/konfessii/russkij-baptizm/_app/'),
  'copy-as-built assets must not become public SEO routes'
);

const astroOnly = baseline.find((entry) => !fs.existsSync(path.join(ROOT, entry.htmlFile)));
assert.ok(astroOnly, 'fixture must include a real production route without committed root HTML');

const syntheticRoute = '/__seo-registry-astro-only-fixture__/';
const synthetic = expectedSeoRouteEntries({
  records: [
    ...loaded.records,
    {
      route: syntheticRoute,
      owner: { owner: 'astro', status: 'production-dist' },
      profile: { seo: { indexable: true } },
      profileFile: 'synthetic-fixture.json',
    },
  ],
});
assert.ok(
  synthetic.some((entry) => entry.route === syntheticRoute),
  'a new Astro-only production route must become an SEO audit obligation automatically'
);

function htmlDocument({ canonical, robots }) {
  return `<!doctype html><html><head>${
    canonical ? `<link rel="canonical" href="${canonical}">` : ''
  }${robots ? `<meta name="robots" content="${robots}">` : ''}</head><body></body></html>`;
}

function writeRoute(root, entry, html) {
  const file = path.join(root, entry.htmlFile);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html, 'utf8');
}

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-seo-route-contract-'));
const indexable = {
  route: '/fixture/',
  htmlFile: 'fixture/index.html',
  canonical: 'https://gospod-bog.ru/fixture/',
  indexable: true,
};
const hidden = {
  route: '/hidden/',
  htmlFile: 'hidden/index.html',
  canonical: 'https://gospod-bog.ru/hidden/',
  indexable: false,
};

try {
  writeRoute(fixtureRoot, indexable, htmlDocument({ canonical: indexable.canonical }));
  writeRoute(fixtureRoot, hidden, htmlDocument({ canonical: hidden.canonical, robots: 'noindex, follow' }));

  const clean = auditSeoRouteFiles(fixtureRoot, { entries: [indexable, hidden] });
  assert.deepEqual(clean.errors, [], clean.errors.join('\n'));
  assert.deepEqual(clean.counts, { production: 2, indexable: 1, noindex: 1, files: 2 });

  writeRoute(fixtureRoot, indexable, htmlDocument({ robots: 'index, follow' }));
  assert.ok(
    auditSeoRouteFiles(fixtureRoot, { entries: [indexable, hidden] }).errors
      .some((error) => error.includes('canonical <missing>')),
    'missing canonical must fail'
  );

  writeRoute(fixtureRoot, indexable, htmlDocument({ canonical: indexable.canonical, robots: 'noindex' }));
  assert.ok(
    auditSeoRouteFiles(fixtureRoot, { entries: [indexable, hidden] }).errors
      .some((error) => error.includes('indexable registry route renders noindex')),
    'indexable route must not render noindex'
  );

  writeRoute(fixtureRoot, indexable, htmlDocument({ canonical: indexable.canonical }));
  writeRoute(fixtureRoot, hidden, htmlDocument({ canonical: hidden.canonical }));
  assert.ok(
    auditSeoRouteFiles(fixtureRoot, { entries: [indexable, hidden] }).errors
      .some((error) => error.includes('seo.indexable=false route must render noindex')),
    'explicit noindex route must render noindex'
  );

  fs.rmSync(path.join(fixtureRoot, hidden.htmlFile));
  assert.ok(
    auditSeoRouteFiles(fixtureRoot, { entries: [indexable, hidden] }).errors
      .some((error) => error.includes('missing generated route HTML')),
    'missing generated route file must fail'
  );
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log(`✅ seo-route-contract: ${baseline.length} production routes (${baseline.filter((entry) => entry.indexable).length} indexable, ${baseline.filter((entry) => !entry.indexable).length} noindex)`);
