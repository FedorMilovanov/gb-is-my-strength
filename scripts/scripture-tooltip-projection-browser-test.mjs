#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import {
  BIBLE_PUBLICATION_STATES,
  createBibleResolver,
  isBibleRecordPublicationEligible,
} from '../src/lib/bible-reference-core.mjs';

const require = createRequire(import.meta.url);
const { sanitizePublicScriptureIndex } = require('./public-scripture-index.js');

const BASE = process.env.BASE || 'http://127.0.0.1:4179';
const ROUTE = '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const HELD_REFERENCE = '2 Тимофею 2:14–15';
const HELD_CORPUS_PATH = '/data/bible/kassian/2timofeyu.json';
const MISSING_REFERENCE = '__scripture_projection_missing__';
const STALE_REFERENCE = '__stale_scripture_projection_probe__';
const GENERIC_FALLBACK = 'Ссылка на указанное место Священного Писания.';
const REFERENCE_FALLBACK = 'Текст этого перевода на сайте не опубликован.';
const TOOLTIP_OWNER = 'article-inline-tooltip';
const TOOLTIP_VERSION = 20;
const LOCAL_TEST_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const LOCAL_CSP_ICON_URLS = new Set([
  'https://gospod-bog.ru/favicon.ico',
  'https://gospod-bog.ru/apple-touch-icon.png',
  'https://gospod-bog.ru/favicon-48.png',
  'https://gospod-bog.ru/favicon-120.png',
  'https://gospod-bog.ru/icons/icon-192.png',
]);

const normalizeRoute = (value) => {
  let route = String(value || '/').split('#', 1)[0] || '/';
  if (!route.startsWith('/')) route = `/${route}`;
  if (!route.includes('.') && !route.endsWith('/')) route += '/';
  return route;
};

const isExpectedLocalIconCspDiagnostic = (text) => {
  let base;
  try {
    base = new URL(BASE);
  } catch {
    return false;
  }
  if (!LOCAL_TEST_HOSTS.has(base.hostname)) return false;
  const match = String(text || '').match(
    /^Loading the image '([^']+)' violates the following Content Security Policy directive: "img-src 'self'[^\"]*"\. The action has been blocked\.$/,
  );
  return Boolean(match && LOCAL_CSP_ICON_URLS.has(match[1]));
};

const sanitizerSecret = '__held_public_index_secret__';
const sanitizerFixture = sanitizePublicScriptureIndex({
  schemaVersion: 1,
  stats: { internal: true },
  references: [{
    id: 'fixture-1',
    label: 'Fixture 1:1',
    canonicalText: sanitizerSecret,
    canonicalSource: { rights: 'held' },
    internalOnly: true,
    occurrences: [{
      url: '/articles/fixture/',
      anchor: 'fixture-anchor',
      context: 'fixture context',
      title: 'fixture title',
      topics: ['fixture-topic'],
      raw: sanitizerSecret,
      internalOnly: true,
    }],
  }],
});
assert.deepEqual(sanitizerFixture, {
  schemaVersion: 1,
  references: [{
    id: 'fixture-1',
    label: 'Fixture 1:1',
    occurrences: [{
      url: '/articles/fixture/',
      anchor: 'fixture-anchor',
      context: 'fixture context',
      title: 'fixture title',
      topics: ['fixture-topic'],
    }],
  }],
}, 'public Scripture sanitizer must preserve only Search navigation/display identity');
const sanitizerFixtureJson = JSON.stringify(sanitizerFixture);
assert.equal(sanitizerFixtureJson.includes(sanitizerSecret), false,
  'public Scripture sanitizer must strip held/internal text bytes');
assert.equal(sanitizerFixtureJson.includes('canonicalText'), false,
  'public Scripture sanitizer must strip canonicalText');
assert.equal(sanitizerFixtureJson.includes('canonicalSource'), false,
  'public Scripture sanitizer must strip canonicalSource');
assert.throws(() => sanitizePublicScriptureIndex({ schemaVersion: 2, references: [] }),
  /schemaVersion/, 'public Scripture sanitizer must fail closed on unsupported schema');
assert.throws(() => sanitizePublicScriptureIndex({ schemaVersion: 1, references: [{ id: 'x', label: 'X', occurrences: 'bad' }] }),
  /occurrences/, 'public Scripture sanitizer must fail closed on malformed references');

const scriptureIndex = JSON.parse(
  fs.readFileSync(new URL('../data/scripture-search-index.json', import.meta.url), 'utf8'),
);
const EXPECTED_PROJECTION = {};
for (const reference of scriptureIndex.references || []) {
  const text = String(reference.canonicalText || '').trim();
  if (!text || !isBibleRecordPublicationEligible(reference.canonicalSource || {})) continue;
  const routeOccurrences = (reference.occurrences || []).filter(
    (occurrence) => normalizeRoute(occurrence.url) === ROUTE,
  );
  if (routeOccurrences.length === 0) continue;
  for (const occurrence of routeOccurrences) {
    const raw = String(occurrence.raw || '').trim();
    if (raw) EXPECTED_PROJECTION[raw] = text;
  }
  const label = String(reference.label || '').trim();
  if (label) EXPECTED_PROJECTION[label] = text;
}

const heldIndexReference = (scriptureIndex.references || []).find((reference) =>
  String(reference.label || '').trim() === HELD_REFERENCE
  || (reference.occurrences || []).some((occurrence) =>
    normalizeRoute(occurrence.url) === ROUTE && String(occurrence.raw || '').trim() === HELD_REFERENCE),
);
assert(heldIndexReference?.canonicalText, `occurrence index must retain reference-only canonical data for ${HELD_REFERENCE}`);
assert.equal(
  heldIndexReference.canonicalSource?.publicationState,
  BIBLE_PUBLICATION_STATES.BLOCKED,
  'current Cassian source must remain Product-publication blocked',
);
assert.equal(
  isBibleRecordPublicationEligible(heldIndexReference.canonicalSource || {}),
  false,
  'held Cassian canonicalSource must not become publication eligible',
);
assert.equal(
  Object.hasOwn(EXPECTED_PROJECTION, HELD_REFERENCE),
  false,
  'held Cassian reference must be excluded from the public route projection',
);

const resolver = createBibleResolver();
const { record: heldRecord } = resolver.resolve(HELD_REFERENCE);
assert(heldRecord?.text, `central Bible corpus must still resolve reference-only ${HELD_REFERENCE}`);
assert.equal(heldRecord.publicationState, BIBLE_PUBLICATION_STATES.BLOCKED,
  'central Cassian record must normalize to BLOCKED when no Product approval exists');
assert.equal(isBibleRecordPublicationEligible(heldRecord), false,
  'central Cassian record must fail the public eligibility contract');
const HELD_TEXT = heldRecord.text;

const expectedPublicHeldReference = sanitizePublicScriptureIndex({
  schemaVersion: scriptureIndex.schemaVersion,
  references: [heldIndexReference],
}).references[0];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error?.message || error)));
page.on('console', (message) => {
  if (message.type() !== 'error') return;
  const text = message.text();
  // Third-party analytics (Yandex Metrika) reachability is not product
  // behaviour; Playwright reports its load failures with the resource URL
  // only in location(), never in text(). Exempt exactly that origin and
  // keep every first-party console error failing.
  const locationUrl = (message.location() || {}).url || '';
  if (/^https?:\/\/mc\.yandex\.(?:ru|com)\//i.test(locationUrl)) return;
  if (!isExpectedLocalIconCspDiagnostic(text)) consoleErrors.push(text);
});

try {
  const rawCorpusResponse = await page.request.get(`${BASE}${HELD_CORPUS_PATH}`);
  assert.equal(rawCorpusResponse.ok(), false,
    'internal Bible corpus must not be publicly fetchable from production-like dist');
  assert.equal(rawCorpusResponse.status(), 404,
    `internal Bible corpus path must be absent from public dist: ${HELD_CORPUS_PATH}`);

  const publicIndexResponse = await page.request.get(`${BASE}/data/scripture-search-index.json`);
  assert.equal(publicIndexResponse.ok(), true, 'public Scripture Search index must remain fetchable at the existing URL');
  const publicIndexText = await publicIndexResponse.text();
  assert.equal(publicIndexText.includes('canonicalText'), false,
    'published Scripture Search index must not expose canonicalText');
  assert.equal(publicIndexText.includes('canonicalSource'), false,
    'published Scripture Search index must not expose canonicalSource');
  assert.equal(publicIndexText.includes(HELD_TEXT), false,
    'published Scripture Search index must not expose held Cassian verbatim bytes');
  const publicIndex = JSON.parse(publicIndexText);
  assert.equal(publicIndex.schemaVersion, 1, 'public Scripture Search index must preserve schemaVersion=1');
  assert(Array.isArray(publicIndex.references), 'public Scripture Search index must preserve references[]');
  const publicHeldReference = publicIndex.references.find((reference) => reference.id === heldIndexReference.id);
  assert.deepEqual(publicHeldReference, expectedPublicHeldReference,
    'sanitized public index must preserve exact held-reference label and occurrence navigation/display identity');

  const rawRouteResponse = await page.request.get(`${BASE}${ROUTE}`);
  assert.equal(rawRouteResponse.ok(), true, 'Hermenevtika source HTML must remain fetchable');
  const rawRouteHtml = await rawRouteResponse.text();
  assert.equal(/<script\b[^>]*\bid=["']bibleRefs["'][^>]*>/iu.test(rawRouteHtml), false,
    'published Hermenevtika HTML must not contain retained #bibleRefs Scripture payload');
  assert.equal(rawRouteHtml.includes(HELD_TEXT), false,
    'published Hermenevtika HTML must not contain held Cassian verbatim bytes');

  // Adversarial predecessor payload: the canonical projection must replace it,
  // not merge it, or a held value could bypass the publication-rights filter.
  await page.addInitScript(({ heldReference, heldText, staleReference }) => {
    window.SCRIPTURE_DATA = {
      [heldReference]: heldText,
      [staleReference]: 'stale ungoverned payload',
    };
  }, { heldReference: HELD_REFERENCE, heldText: HELD_TEXT, staleReference: STALE_REFERENCE });

  await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(({ owner, version }) => {
    const data = document.documentElement.dataset;
    return window.GBArticleTooltips?.version === version &&
      window.GBArticleTooltips?.owner === owner &&
      data.gbArticleTooltipsOwner === owner &&
      data.gbArticleTooltipsVersion === String(version);
  }, { owner: TOOLTIP_OWNER, version: TOOLTIP_VERSION }, { timeout: 15000 });

  const projectionSnapshot = await page.evaluate(() => ({
    ownerVersion: window.GBArticleTooltips?.version || null,
    ownerName: window.GBArticleTooltips?.owner || null,
    frozen: Object.isFrozen(window.SCRIPTURE_DATA),
    scriptureData: Object.fromEntries(Object.entries(window.SCRIPTURE_DATA || {}).sort(([a], [b]) => a.localeCompare(b, 'ru'))),
  }));
  assert.equal(projectionSnapshot.ownerVersion, TOOLTIP_VERSION, 'canonical article tooltip owner version must remain v20');
  assert.equal(projectionSnapshot.ownerName, TOOLTIP_OWNER, 'canonical article tooltip owner must remain unchanged');
  assert.equal(projectionSnapshot.frozen, true, 'route-scoped Scripture projection must remain immutable after handoff');
  assert.deepEqual(
    projectionSnapshot.scriptureData,
    Object.fromEntries(Object.entries(EXPECTED_PROJECTION).sort(([a], [b]) => a.localeCompare(b, 'ru'))),
    'browser Scripture payload must equal the publication-eligible current-route projection exactly',
  );
  assert.equal(Object.hasOwn(projectionSnapshot.scriptureData, HELD_REFERENCE), false,
    'held Cassian reference must not exist in public SCRIPTURE_DATA');
  assert.equal(Object.hasOwn(projectionSnapshot.scriptureData, STALE_REFERENCE), false,
    'canonical projection must discard stale pre-existing global Scripture payloads');
  assert.equal(Object.values(projectionSnapshot.scriptureData).includes(HELD_TEXT), false,
    'held Cassian verbatim text must not leak through another projection key');

  assert.equal(await page.locator('.bref a[href]').count(), 0,
    'generated external passage links must not become nested interactive controls inside reference buttons');
  const heldTrigger = page.locator(`.bref[data-ref="${HELD_REFERENCE}"]`).first();
  assert.equal(await heldTrigger.count(), 1, `real route must expose reference label ${HELD_REFERENCE}`);
  await heldTrigger.focus();
  const heldTip = page.locator('.btip.is-open').last();
  await heldTip.waitFor({ state: 'visible' });
  assert.equal((await heldTip.locator('.btip__reference').textContent())?.trim(), HELD_REFERENCE);
  const heldTooltipText = (await heldTip.locator('.btip__text').textContent())?.trim();
  assert.equal(heldTooltipText, REFERENCE_FALLBACK,
    'known but publication-blocked Scripture must disclose missing publication rights without a dead placeholder');
  const heldExternal = heldTip.locator('.btip__external');
  assert.equal(await heldExternal.count(), 1, 'publication-blocked reference needs one genuine external passage link');
  const heldHref = new URL(await heldExternal.getAttribute('href'));
  assert.equal(heldHref.origin, 'https://www.biblegateway.com');
  assert.equal(heldHref.pathname, '/passage/');
  assert.equal(heldHref.searchParams.get('version'), 'RUSV');
  assert.equal(heldHref.searchParams.get('search'), '2 Тимофею 2:14-15');
  assert.equal(await heldExternal.getAttribute('target'), '_blank');
  assert.match(await heldExternal.getAttribute('rel'), /noopener/);
  assert.notEqual(heldTooltipText, HELD_TEXT,
    'publication-blocked Cassian verbatim text must not reach the reader tooltip');
  await page.keyboard.press('Escape');

  const lukeTrigger = page.locator('.bref[data-ref="Луки 24:27"]').first();
  await lukeTrigger.focus();
  const lukeTip = page.locator('.btip.is-open').last();
  await lukeTip.waitFor({ state: 'visible' });
  const lukeLink = new URL(await lukeTip.locator('.btip__external').getAttribute('href'));
  assert.equal(lukeLink.searchParams.get('search'), 'От Луки 24:27',
    'real user screenshot Luke 24:27 must link to the verified Synodal passage');
  assert.equal(lukeLink.searchParams.get('version'), 'RUSV');
  assert.equal((await lukeTip.locator('.btip__text').textContent())?.trim(), REFERENCE_FALLBACK);
  // Tab leaves the native reference button into the one real external link.
  await page.keyboard.press('Tab');
  assert.equal(await lukeTip.locator('.btip__external').evaluate((link) => document.activeElement === link), true,
    'scripture external source must be keyboard reachable');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.btip.is-open').count(), 0,
    'Escape closes the link-bearing Scripture card without a stale overlay');

  await page.evaluate((missingReference) => {
    const host = document.querySelector('article') || document.querySelector('main') || document.body;
    const probe = document.createElement('span');
    probe.className = 'bref';
    probe.dataset.ref = missingReference;
    probe.textContent = 'missing scripture projection probe';
    host.appendChild(probe);
    window.GBArticleTooltips.init(document);
    probe.focus();
  }, MISSING_REFERENCE);

  const missingTip = page.locator('.btip.is-open').last();
  await missingTip.waitFor({ state: 'visible' });
  assert.equal((await missingTip.locator('.btip__reference').textContent())?.trim(), MISSING_REFERENCE);
  assert.equal((await missingTip.locator('.btip__text').textContent())?.trim(), GENERIC_FALLBACK,
    'intentionally missing reference must preserve the existing generic fallback');
  assert.equal(await missingTip.locator('.btip__external').count(), 0,
    'invalid non-Bible references must not invent an external passage URL');
  assert.equal(await page.evaluate((reference) => Object.hasOwn(window.SCRIPTURE_DATA || {}, reference), MISSING_REFERENCE), false,
    'missing probe must not be synthesized into the canonical projection');

  // Deep-scroll mobile regression: the fixed-body scroll lock must not move
  // the Scripture card outside the visible viewport; second tap, Escape
  // and outside tap must each close one owner without reopening it.
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    const mobileErrors = [];
    mobile.on('pageerror', (error) => mobileErrors.push(String(error.message || error)));
    await mobile.goto(`${BASE}${ROUTE}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await mobile.waitForFunction(() => window.GBArticleTooltips?.owner === 'article-inline-tooltip');
    const mobileLuke = mobile.locator('.bref[data-ref="Луки 24:27"]').first();
    await mobileLuke.scrollIntoViewIfNeeded();
    const beforeY = await mobile.evaluate(() => window.scrollY);
    assert(beforeY > 1000, 'deep-scroll mobile witness must start well below the first fold');
    const mobileTip = mobile.locator('.btip.is-open');
    const checkMobileCard = async () => {
      await mobileTip.waitFor({ state: 'visible' });
      const box = await mobileTip.boundingBox();
      assert(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= 391 && box.y + box.height <= 845,
        'mobile Scripture card moved outside viewport after scroll lock');
      assert.equal(await mobileTip.locator('.btip__external').count(), 1);
      assert.equal(await mobile.locator('.bref a[href]').count(), 0,
        'mobile generated links must not be nested inside a reference button');
    };
    await mobileLuke.click();
    await checkMobileCard();
    await mobileLuke.click();
    await mobile.waitForFunction(() => document.querySelectorAll('.btip.is-open').length === 0);
    await mobileLuke.click();
    await checkMobileCard();
    await mobile.keyboard.press('Escape');
    await mobile.waitForFunction(() => document.querySelectorAll('.btip.is-open').length === 0);
    await mobileLuke.click();
    await checkMobileCard();
    await mobile.mouse.click(380, 75);
    await mobile.waitForFunction(() => document.querySelectorAll('.btip.is-open').length === 0);
    // The shared overlay's delayed focus-restoration retries must not
    // resurrect a dismissed mobile popup during the following half-second.
    await mobile.waitForTimeout(550);
    assert.equal(await mobileTip.count(), 0, 'outside-click dismissal must remain stable after focus restoration');
    const afterY = await mobile.evaluate(() => window.scrollY);
    assert(Math.abs(afterY - beforeY) < 80, 'closing mobile Scripture card must restore the previous reading position');
    assert.equal(await mobile.evaluate(() => window.SiteUtils?._scrollLockCount), 0,
      'mobile Scripture card must fully release the shared scroll lock');
    assert.deepEqual(mobileErrors, [], 'deep-scroll mobile Scripture interactions must not throw');
  } finally {
    await mobile.close();
  }

  assert.deepEqual(pageErrors, [], `unexpected page errors: ${pageErrors.join(' | ')}`);
  assert.deepEqual(consoleErrors, [], `unexpected console errors: ${consoleErrors.join(' | ')}`);
  console.log(`Scripture rights-safe projection/browser/public-index contract passed for held ${HELD_REFERENCE}`);
} finally {
  await browser.close();
}
