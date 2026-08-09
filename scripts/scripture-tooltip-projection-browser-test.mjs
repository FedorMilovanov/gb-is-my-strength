#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { createBibleResolver } from '../src/lib/bible-reference-core.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:4179';
const ROUTE = '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const REFERENCE = '2 Тимофею 2:14–15';
const MISSING_REFERENCE = '__scripture_projection_missing__';
const GENERIC_FALLBACK = 'Ссылка на указанное место Священного Писания.';
const TOOLTIP_OWNER = 'article-inline-tooltip';
const TOOLTIP_VERSION = 20;

const normalizeRoute = (value) => {
  let route = String(value || '/').split('#', 1)[0] || '/';
  if (!route.startsWith('/')) route = `/${route}`;
  if (!route.includes('.') && !route.endsWith('/')) route += '/';
  return route;
};

const scriptureIndex = JSON.parse(
  fs.readFileSync(new URL('../data/scripture-search-index.json', import.meta.url), 'utf8'),
);
const EXPECTED_PROJECTION = {};
for (const reference of scriptureIndex.references || []) {
  const text = String(reference.canonicalText || '').trim();
  if (!text) continue;
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
assert(Object.keys(EXPECTED_PROJECTION).length > 0, 'Hermenevtika must have centrally resolved route-scoped Scripture records');

const resolver = createBibleResolver();
const { record } = resolver.resolve(REFERENCE);
assert(record?.text, `Central Bible corpus must resolve ${REFERENCE}`);
const EXPECTED_TEXT = record.text;
assert.equal(EXPECTED_PROJECTION[REFERENCE], EXPECTED_TEXT,
  'occurrence index canonical text must agree with the independent central resolver');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error?.message || error)));
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});

try {
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
    scriptureData: Object.fromEntries(Object.entries(window.SCRIPTURE_DATA || {}).sort(([a], [b]) => a.localeCompare(b, 'ru'))),
  }));
  assert.equal(projectionSnapshot.ownerVersion, TOOLTIP_VERSION, 'canonical article tooltip owner version must remain v20');
  assert.equal(projectionSnapshot.ownerName, TOOLTIP_OWNER, 'canonical article tooltip owner must remain unchanged');
  assert.deepEqual(
    projectionSnapshot.scriptureData,
    Object.fromEntries(Object.entries(EXPECTED_PROJECTION).sort(([a], [b]) => a.localeCompare(b, 'ru'))),
    'browser Scripture payload must equal the canonical current-route projection exactly',
  );

  // The old retained route-local payload must not be required for the native handoff.
  await page.evaluate(() => document.querySelector('#bibleRefs')?.remove());

  const trigger = page.locator(`.bref[data-ref="${REFERENCE}"]`).first();
  assert.equal(await trigger.count(), 1, `real route must expose ${REFERENCE}`);
  await trigger.focus();
  const tip = page.locator('.btip.is-open').last();
  await tip.waitFor({ state: 'visible' });
  assert.equal((await tip.locator('.btip__reference').textContent())?.trim(), REFERENCE);
  const actualText = (await tip.locator('.btip__text').textContent())?.trim();
  assert.equal(actualText, EXPECTED_TEXT, 'tooltip must render central canonical Scripture text');
  assert.notEqual(actualText, GENERIC_FALLBACK, 'known central reference must not degrade to the generic fallback');
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
  console.log(`Scripture tooltip projection browser contract passed for ${REFERENCE}`);
} finally {
  await browser.close();
}
