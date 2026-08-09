#!/usr/bin/env node
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createBibleResolver } from '../src/lib/bible-reference-core.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:4179';
const ROUTE = '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const REFERENCE = '2 Тимофею 2:14–15';
const MISSING_REFERENCE = '__scripture_projection_missing__';
const GENERIC_FALLBACK = 'Ссылка на указанное место Священного Писания.';

const resolver = createBibleResolver();
const { record } = resolver.resolve(REFERENCE);
assert(record?.text, `Central Bible corpus must resolve ${REFERENCE}`);
const EXPECTED_TEXT = record.text;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error?.message || error)));
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});

try {
  await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.GBArticleTooltips?.VERSION === 20);

  const projectedText = await page.evaluate((reference) => window.SCRIPTURE_DATA?.[reference] || null, REFERENCE);
  assert.equal(projectedText, EXPECTED_TEXT, 'route projection must expose the central canonical text');

  const projectionSnapshot = await page.evaluate(() => ({
    ownerVersion: window.GBArticleTooltips?.VERSION || null,
    ownerName: window.GBArticleTooltips?.OWNER || null,
    projectedKeys: Object.keys(window.SCRIPTURE_DATA || {}),
  }));
  assert.equal(projectionSnapshot.ownerVersion, 20, 'canonical article tooltip owner version must remain v20');
  assert.equal(projectionSnapshot.ownerName, 'article-inline-tooltip', 'canonical article tooltip owner must remain unchanged');
  assert(projectionSnapshot.projectedKeys.length > 0, 'current route must receive at least one canonical Scripture record');
  assert(projectionSnapshot.projectedKeys.length < 100, 'route projection must stay route-scoped rather than shipping the whole corpus');

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
