#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadRouteRecords } = require('./lib/effective-route-registry');
const {
  INDEXABLE_SOCIAL_META,
  expectedSeoRouteEntries,
  auditSeoRouteFiles,
} = require('./lib/seo-route-contract');

const ROOT = path.resolve(__dirname, '..');
const loaded = loadRouteRecords();
const baseline = expectedSeoRouteEntries({ loaded });
const indexableEntries = baseline.filter((entry) => entry.indexable);
const noindexEntries = baseline.filter((entry) => !entry.indexable);
const GENESIS6_ROUTES = [
  '/hard-texts/angely-pod-mrakom-iuda-6-7-2-petra-2/',
  '/hard-texts/blagovestie-mertvym-1-petra-4-5-6/',
  '/hard-texts/duhi-v-temnice-noi-kreshchenie-pobeda/',
  '/hard-texts/enoh-prorochestvoval-iuda-14-15-4q204/',
  '/hard-texts/genesis-6/',
  '/hard-texts/kniga-enoha-kotoroy-ne-bylo-kak-raznye-proizvedeniya-stali-korpusom/',
  '/hard-texts/mozhno-li-doveryat-1-enohu-kanonicheskiy-audit/',
];

assert.ok(baseline.length > 0, 'effective registry must expose production SEO audit obligations');
assert.equal(
  new Set(baseline.map((entry) => entry.route)).size,
  baseline.length,
  'every production SEO audit obligation must have a unique route'
);
assert.equal(
  indexableEntries.length + noindexEntries.length,
  baseline.length,
  'every production SEO audit obligation must have an explicit indexability disposition'
);
assert.ok(indexableEntries.length > 0, 'effective registry must expose indexable production routes');
assert.ok(noindexEntries.length > 0, 'effective registry must expose explicit noindex production routes');
assert.deepEqual(
  baseline
    .filter((entry) => GENESIS6_ROUTES.includes(entry.route))
    .map((entry) => entry.route)
    .sort(),
  [...GENESIS6_ROUTES].sort(),
  'all seven published Genesis 6 surfaces must be SEO audit obligations'
);
assert.ok(
  GENESIS6_ROUTES.every((route) => baseline.find((entry) => entry.route === route)?.indexable === true),
  'all seven published Genesis 6 surfaces must remain indexable'
);
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

const SOCIAL_VALUES = Object.freeze({
  'og:image': 'https://gospod-bog.ru/assets/social/fixture.jpg',
  'og:image:width': '1200',
  'og:image:height': '630',
  'twitter:image': 'https://gospod-bog.ru/assets/social/fixture.jpg',
  'twitter:site': '@gospod_bog_ru',
  'twitter:creator': '@gospod_bog_ru',
});

function socialMetadata({ duplicate, empty } = {}) {
  return INDEXABLE_SOCIAL_META.map(({ attr, name }, index) => {
    const value = empty === name ? '' : SOCIAL_VALUES[name];
    const orderedTag = index % 2 === 0
      ? `<meta ${attr}="${name}" content="${value}">`
      : `<meta content="${value}" ${attr}="${name}">`;
    return duplicate === name ? `${orderedTag}${orderedTag}` : orderedTag;
  }).join('');
}

const JOURNAL_IMAGE_ALT_VALUES = Object.freeze({
  'og:image:alt': 'Descriptive journal cover image for the social preview.',
  'twitter:image:alt': 'Descriptive journal cover image for the social preview.',
});

function journalImageAltMetadata({ duplicate, empty } = {}) {
  return Object.entries(JOURNAL_IMAGE_ALT_VALUES).map(([name, value], index) => {
    const attr = index === 0 ? 'property' : 'name';
    const content = empty === name ? '' : value;
    const tag = `<meta ${attr}="${name}" content="${content}">`;
    return duplicate === name ? `${tag}${tag}` : tag;
  }).join('');
}

function withJournalImageAlt(html, options) {
  return html.replace('</head>', `${journalImageAltMetadata(options)}</head>`);
}

function htmlDocument({ canonical, robots, social = true, duplicateSocial, emptySocial }) {
  return `<!doctype html><html><head>${
    canonical ? `<link rel="canonical" href="${canonical}">` : ''
  }${robots ? `<meta name="robots" content="${robots}">` : ''}${
    social ? socialMetadata({ duplicate: duplicateSocial, empty: emptySocial }) : ''
  }</head><body></body></html>`;
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
const journalLanding = {
  route: '/journal/',
  htmlFile: 'journal/index.html',
  canonical: 'https://gospod-bog.ru/journal/',
  indexable: true,
};
const g3Dossier = {
  route: '/journal/dossiers/g3/',
  htmlFile: 'journal/dossiers/g3/index.html',
  canonical: 'https://gospod-bog.ru/journal/dossiers/g3/',
  indexable: true,
};

try {
  writeRoute(fixtureRoot, indexable, htmlDocument({ canonical: indexable.canonical }));
  writeRoute(fixtureRoot, hidden, htmlDocument({ canonical: hidden.canonical, robots: 'noindex, follow', social: false }));

  const clean = auditSeoRouteFiles(fixtureRoot, { entries: [indexable, hidden] });
  assert.deepEqual(clean.errors, [], clean.errors.join('\n'));
  assert.deepEqual(clean.counts, { production: 2, indexable: 1, noindex: 1, files: 2 });

  for (const entry of [journalLanding, g3Dossier]) {
    writeRoute(
      fixtureRoot,
      entry,
      withJournalImageAlt(htmlDocument({ canonical: entry.canonical }))
    );
  }
  const journalClean = auditSeoRouteFiles(fixtureRoot, { entries: [journalLanding, g3Dossier] });
  assert.deepEqual(journalClean.errors, [], journalClean.errors.join('\n'));

  writeRoute(fixtureRoot, g3Dossier, htmlDocument({ canonical: g3Dossier.canonical }));
  const missingJournalAlts = auditSeoRouteFiles(fixtureRoot, { entries: [g3Dossier] }).errors;
  assert.ok(missingJournalAlts.some((error) => error.includes('og:image:alt')),
    'indexable Journal routes must include an accessible Open Graph image description');
  assert.ok(missingJournalAlts.some((error) => error.includes('twitter:image:alt')),
    'indexable Journal routes must include an accessible Twitter image description');

  writeRoute(
    fixtureRoot,
    g3Dossier,
    withJournalImageAlt(
      htmlDocument({ canonical: g3Dossier.canonical }),
      { duplicate: 'og:image:alt' }
    )
  );
  assert.ok(
    auditSeoRouteFiles(fixtureRoot, { entries: [g3Dossier] }).errors
      .some((error) => error.includes('og:image:alt meta, found 2 values')),
    'Journal routes must not emit duplicate Open Graph image descriptions'
  );

  writeRoute(
    fixtureRoot,
    g3Dossier,
    withJournalImageAlt(
      htmlDocument({ canonical: g3Dossier.canonical }),
      { empty: 'twitter:image:alt' }
    )
  );
  assert.ok(
    auditSeoRouteFiles(fixtureRoot, { entries: [g3Dossier] }).errors
      .some((error) => error.includes('twitter:image:alt meta, found 1 empty value')),
    'Journal routes must not emit empty Twitter image descriptions'
  );

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

  writeRoute(fixtureRoot, indexable, htmlDocument({ canonical: indexable.canonical, social: false }));
  assert.ok(
    auditSeoRouteFiles(fixtureRoot, { entries: [indexable, hidden] }).errors
      .some((error) => error.includes('expected exactly one non-empty og:image meta, found 0 values')),
    'indexable route must render the complete social metadata set'
  );

  writeRoute(fixtureRoot, indexable, htmlDocument({
    canonical: indexable.canonical,
    emptySocial: 'twitter:site',
  }));
  assert.ok(
    auditSeoRouteFiles(fixtureRoot, { entries: [indexable, hidden] }).errors
      .some((error) => error.includes('expected exactly one non-empty twitter:site meta, found 1 empty value')),
    'empty social metadata must fail'
  );

  writeRoute(fixtureRoot, indexable, htmlDocument({
    canonical: indexable.canonical,
    duplicateSocial: 'og:image',
  }));
  assert.ok(
    auditSeoRouteFiles(fixtureRoot, { entries: [indexable, hidden] }).errors
      .some((error) => error.includes('expected exactly one non-empty og:image meta, found 2 values')),
    'duplicate social metadata must fail'
  );

  writeRoute(fixtureRoot, indexable, htmlDocument({ canonical: indexable.canonical }));
  writeRoute(fixtureRoot, hidden, htmlDocument({ canonical: hidden.canonical, social: false }));
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

console.log(`✅ seo-route-contract: ${baseline.length} production routes (${indexableEntries.length} indexable, ${noindexEntries.length} noindex); exact-one social metadata and Journal image-alt metadata enforced; seven Genesis 6 routes required`);
