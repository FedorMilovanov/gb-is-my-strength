#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { loadRouteRecords } = require('./lib/effective-route-registry');
const {
  auditSitemapCoverage,
  contractProblems,
  expectedSitemapRoutes,
  routeToUrl,
} = require('./lib/sitemap-route-contract');

const ROOT = path.resolve(__dirname, '..');
const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const loaded = loadRouteRecords();
const expectedRoutes = expectedSitemapRoutes({ loaded });
const baseline = auditSitemapCoverage(sitemap, { loaded });

assert.equal(expectedRoutes.length, 75, 'canonical production sitemap surface must contain 75 routes');
assert.ok(!expectedRoutes.includes('/konfessii/russkij-baptizm/_app/'), 'built app asset must not be a public sitemap route');
assert.deepEqual(contractProblems(baseline), [], contractProblems(baseline).join('\n'));
assert.equal(baseline.localRoutes.length, 75, 'sitemap must contain exactly the canonical public route count');

function rootHtmlForRoute(route) {
  return path.join(ROOT, route === '/' ? 'index.html' : route.replace(/^\//, '') + 'index.html');
}

const astroOnlyRoute = expectedRoutes.find((route) => !fs.existsSync(rootHtmlForRoute(route)));
assert.ok(astroOnlyRoute, 'fixture must include at least one production route without committed root HTML');
const astroOnlyUrl = routeToUrl(astroOnlyRoute);
const withoutAstroOnly = sitemap.replace(`<loc>${astroOnlyUrl}</loc>`, '');
assert.notEqual(withoutAstroOnly, sitemap, `fixture loc must exist for ${astroOnlyRoute}`);
const missingAstroOnly = auditSitemapCoverage(withoutAstroOnly, { loaded });
assert.ok(
  missingAstroOnly.missingRoutes.includes(astroOnlyRoute),
  `removing Astro-only ${astroOnlyRoute} must fail registry-driven sitemap coverage`
);

const syntheticRoute = '/__mutation-astro-only-route__/';
const syntheticLoaded = {
  ...loaded,
  records: [
    ...loaded.records,
    {
      route: syntheticRoute,
      owner: {
        owner: 'astro',
        source: 'src/pages/__mutation-astro-only-route__/index.astro',
        status: 'production-dist',
      },
      profile: null,
      matrix: null,
      inspection: { exists: false, imports: [] },
    },
  ],
};
const syntheticResult = auditSitemapCoverage(sitemap, { loaded: syntheticLoaded });
assert.ok(
  syntheticResult.missingRoutes.includes(syntheticRoute),
  'a newly registered Astro-only production route must be required without adding a second route list'
);

const knownUrl = routeToUrl(expectedRoutes[0]);
const duplicateResult = auditSitemapCoverage(
  sitemap.replace('</urlset>', `<url><loc>${knownUrl}</loc></url></urlset>`),
  { loaded }
);
assert.ok(duplicateResult.duplicateUrls.includes(knownUrl), 'duplicate loc must fail');

const unknownRoute = '/__unregistered-public-route__/';
const unknownResult = auditSitemapCoverage(
  sitemap.replace('</urlset>', `<url><loc>${routeToUrl(unknownRoute)}</loc></url></urlset>`),
  { loaded }
);
assert.ok(unknownResult.unexpectedRoutes.includes(unknownRoute), 'same-origin route absent from ownership must fail');

const foreignUrl = 'https://example.com/foreign/';
const foreignResult = auditSitemapCoverage(
  sitemap.replace('</urlset>', `<url><loc>${foreignUrl}</loc></url></urlset>`),
  { loaded }
);
assert.ok(foreignResult.foreignUrls.includes(foreignUrl), 'foreign sitemap URL must fail');

console.log(
  `✅ sitemap route contract: ${baseline.expectedRoutes.length} registry routes, Astro-only mutation ${astroOnlyRoute} blocked`
);
