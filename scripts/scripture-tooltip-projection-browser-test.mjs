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
const MISSING_REFERENCE = '__scripture_projection_missing__';
const STALE_REFERENCE = '__stale_scripture_projection_probe__';
const GENERIC_FALLBACK = 'Ссылка на указанное место Священного Писания.';
const TOOLTIP_OWNER = 'article-inline-tooltip';
const TOOLTIP_VERSION = 20;

const normalizeRoute = (value) => {
  let route = String(value || '/').split('#', 1)[0] || '/';
  if (!route.startsWith('/')) route = `/${route}`;
  if (!route.includes('.') && !route.endsWith('/')) route += '/';
  return route;
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
  if (message.type() === 'error') consoleErrors.push(message.text());
});

try {
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

  const heldTrigger = page.locator(`.bref[data-ref="${HELD_REFERENCE}"]`).first();
  assert.equal(await heldTrigger.count(), 1, `real route must expose reference label ${HELD_REFERENCE}`);
  await heldTrigger.focus();
  const heldTip = page.locator('.btip.is-open').last();
  await heldTip.waitFor({ state: 'visible' });
  assert.equal((await heldTip.locator('.btip__reference').textContent())?.trim(), HELD_REFERENCE);
  const heldTooltipText = (await heldTip.locator('.btip__text').textContent())?.trim();
  assert.equal(heldTooltipText, GENERIC_FALLBACK,
    'known but publication-blocked Scripture must use the existing generic fallback');
  assert.notEqual(heldTooltipText, HELD_TEXT,
    'publication-blocked Cassian verbatim text must not reach the reader tooltip');
  await page.keyboard.press('Escape');

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
  assert.equal(await page.evaluate((reference) => Object.hasOwn(window.SCRIPTURE_DATA || {}, reference), MISSING_REFERENCE), false,
    'missing probe must not be synthesized into the canonical projection');

  assert.deepEqual(pageErrors, [], `unexpected page errors: ${pageErrors.join(' | ')}`);
  assert.deepEqual(consoleErrors, [], `unexpected console errors: ${consoleErrors.join(' | ')}`);
  console.log(`Scripture rights-safe projection/browser/public-index contract passed for held ${HELD_REFERENCE}`);
} finally {
  await browser.close();
}
