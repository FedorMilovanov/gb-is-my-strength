#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadRouteRecords } = require('./lib/effective-route-registry');
const {
  auditSitemapCoverage,
  contractProblems,
  expectedSitemapRoutes,
  routeToUrl,
} = require('./lib/sitemap-route-contract');
const {
  approvedSocialImageProfileLabel,
  auditSitemapImages,
  isApprovedSocialImageDimensions,
  normalizeAbsoluteUrl,
  projectSitemapImages,
  readImageDimensions,
} = require('./lib/sitemap-image-projection');

const ROOT = path.resolve(__dirname, '..');
const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const loaded = loadRouteRecords();
const expectedRoutes = expectedSitemapRoutes({ loaded });
const baseline = auditSitemapCoverage(sitemap, { loaded });
const genesis6Routes = [
  '/hard-texts/genesis-6/',
  '/hard-texts/enoh-prorochestvoval-iuda-14-15-4q204/',
  '/hard-texts/kniga-enoha-kotoroy-ne-bylo-kak-raznye-proizvedeniya-stali-korpusom/',
  '/hard-texts/mozhno-li-doveryat-1-enohu-kanonicheskiy-audit/',
  '/hard-texts/angely-pod-mrakom-iuda-6-7-2-petra-2/',
  '/hard-texts/duhi-v-temnice-noi-kreshchenie-pobeda/',
  '/hard-texts/blagovestie-mertvym-1-petra-4-5-6/',
];

assert.equal(expectedRoutes.length, 73, 'canonical indexable production sitemap surface must contain 73 routes');
for (const route of genesis6Routes) {
  assert.ok(expectedRoutes.includes(route), `${route}: published Genesis 6 route must be required in sitemap`);
}
assert.ok(!expectedRoutes.includes('/konfessii/russkij-baptizm/_app/'), 'built app asset must not be a public sitemap route');
const explicitNoindexRoutes = loaded.records
  .filter((record) => record.owner?.status === 'production-dist' && record.profile?.seo?.indexable === false)
  .map((record) => record.route)
  .sort();
assert.deepEqual(explicitNoindexRoutes, [
  '/izbrannoe/',
  '/karty/early-church/',
  '/karty/maccabim/',
  '/karty/melachim/',
  '/karty/pavel/',
  '/karty/revelation/',
  '/karty/shoftim/',
  '/karty/shvatim/',
  '/karty/yeshua/',
]);
for (const route of explicitNoindexRoutes) {
  assert.ok(!expectedRoutes.includes(route), `${route}: explicit noindex route must stay out of sitemap obligations`);
}
assert.deepEqual(contractProblems(baseline), [], contractProblems(baseline).join('\n'));
assert.equal(baseline.localRoutes.length, 73, 'sitemap must contain exactly the canonical indexable route count');

function rootHtmlForRoute(route) {
  return path.join(ROOT, route === '/' ? 'index.html' : route.replace(/^\//, '') + 'index.html');
}

const astroOnlyRoute = expectedRoutes.find((route) => !fs.existsSync(rootHtmlForRoute(route)));
assert.ok(astroOnlyRoute, 'fixture must include at least one indexable production route without committed root HTML');
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
      profile: { seo: { indexable: true } },
      matrix: null,
      inspection: { exists: false, imports: [] },
    },
  ],
};
const syntheticResult = auditSitemapCoverage(sitemap, { loaded: syntheticLoaded });
assert.ok(
  syntheticResult.missingRoutes.includes(syntheticRoute),
  'a newly registered indexable Astro-only production route must be required without adding a second route list'
);

const syntheticNoindexLoaded = {
  ...loaded,
  records: [
    ...loaded.records,
    {
      route: '/__mutation-noindex-route__/',
      owner: { owner: 'astro', status: 'production-dist' },
      profile: { seo: { indexable: false } },
    },
  ],
};
assert.ok(
  !expectedSitemapRoutes({ loaded: syntheticNoindexLoaded }).includes('/__mutation-noindex-route__/'),
  'only explicit profile.seo.indexable=false may exempt a production route from sitemap obligations'
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

function writeVp8xFixture(file, width, height) {
  const bytes = Buffer.alloc(30);
  bytes.write('RIFF', 0, 'ascii');
  bytes.writeUInt32LE(22, 4);
  bytes.write('WEBP', 8, 'ascii');
  bytes.write('VP8X', 12, 'ascii');
  bytes.writeUInt32LE(10, 16);
  bytes.writeUIntLE(width - 1, 24, 3);
  bytes.writeUIntLE(height - 1, 27, 3);
  fs.writeFileSync(file, bytes);
}

function runSitemapImageProjectionContract() {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gbs-sitemap-images-'));
  try {
    const route = '/__sitemap-image-contract__/';
    const canonical = routeToUrl(route);
    const imageUrl = routeToUrl('/images/__sitemap-image-contract__.webp');
    const routeDir = path.join(fixtureRoot, '__sitemap-image-contract__');
    const imageFile = path.join(fixtureRoot, 'images', '__sitemap-image-contract__.webp');
    fs.mkdirSync(routeDir, { recursive: true });
    fs.mkdirSync(path.dirname(imageFile), { recursive: true });
    fs.writeFileSync(path.join(routeDir, 'index.html'), `<!doctype html><html><head>
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index, follow">
<meta property="og:image" content="${imageUrl}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/webp">
</head><body></body></html>`, 'utf8');
    writeVp8xFixture(imageFile, 1200, 630);
    const sitemapFile = path.join(fixtureRoot, 'sitemap.xml');
    fs.writeFileSync(
      sitemapFile,
      `<?xml version="1.0"?><urlset xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"><url><loc>${canonical}</loc></url></urlset>`,
      'utf8'
    );
    const htmlFiles = [path.join(routeDir, 'index.html')];
    const projection = projectSitemapImages({ root: fixtureRoot, htmlFiles });
    assert.equal(projection.inserted, 1, 'compact one-line sitemap block must receive an image');
    const projected = fs.readFileSync(sitemapFile, 'utf8');
    assert.match(projected, new RegExp(`<image:loc>${imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</image:loc>`));
    assert.deepEqual(auditSitemapImages({ root: fixtureRoot, htmlFiles }).errors, []);

    const missing = projected.replace(/<image:image>[\s\S]*?<\/image:image>/, '');
    fs.writeFileSync(sitemapFile, missing, 'utf8');
    assert.ok(
      auditSitemapImages({ root: fixtureRoot, htmlFiles }).errors.some((message) => message.includes('expected exactly one sitemap image, found 0')),
      'missing sitemap image must fail'
    );

    const mismatched = projected.replace(imageUrl, routeToUrl('/images/wrong.webp'));
    fs.writeFileSync(sitemapFile, mismatched, 'utf8');
    assert.ok(
      auditSitemapImages({ root: fixtureRoot, htmlFiles }).errors.some((message) => message.includes('!= page og:image')),
      'sitemap image differing from page og:image must fail'
    );

    const duplicate = projected.replace('</url>', `<image:image><image:loc>${imageUrl}</image:loc></image:image></url>`);
    fs.writeFileSync(sitemapFile, duplicate, 'utf8');
    assert.ok(
      auditSitemapImages({ root: fixtureRoot, htmlFiles }).errors.some((message) => message.includes('expected exactly one sitemap image, found 2')),
      'duplicate sitemap image blocks must fail'
    );

    assert.equal(normalizeAbsoluteUrl('   '), '', 'blank metadata must stay blank instead of resolving to the site root');

    const dimensions = readImageDimensions(imageFile);
    assert.deepEqual(dimensions, { width: 1200, height: 630, type: 'image/webp' });
    assert.ok(isApprovedSocialImageDimensions(1200, 630));
    assert.ok(isApprovedSocialImageDimensions(1200, 675));
    assert.ok(!isApprovedSocialImageDimensions(1200, 700));
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

runSitemapImageProjectionContract();

console.log(
  `✅ sitemap route contract: ${baseline.expectedRoutes.length} indexable registry routes, seven Genesis 6 routes required, Astro-only mutation ${astroOnlyRoute} blocked; sitemap image projection and ${approvedSocialImageProfileLabel()} profiles guarded`
);
