#!/usr/bin/env node
'use strict';

const { chromium } = require('playwright');

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:8090';
const results = [];

function record(name, ok, detail = {}) {
  results.push({ name, ok, detail });
}

async function openMap(context, slug) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${BASE}/karty/${slug}/`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('.me-map', { timeout: 15000 });
  await page.evaluate(() => document.querySelector('.me-intro__btn')?.click());
  await page.waitForTimeout(550);
  return { page, errors };
}

async function clickLayer(page, id) {
  const selector = `.me-layers__row[data-layer-id="${id}"] .me-layers__toggle`;
  await page.waitForSelector(selector, { timeout: 8000 });
  await page.evaluate((sel) => document.querySelector(sel)?.click(), selector);
  await page.waitForTimeout(120);
}

async function elementLayerState(page, selector) {
  return page.$eval(selector, (el) => ({
    hidden: el.getAttribute('data-me-layer-hidden'),
    opacity: el.style.opacity,
    visibility: el.style.visibility,
    pointerEvents: el.style.pointerEvents,
    all: el.getAttribute('data-layer-all') || '',
    any: el.getAttribute('data-layer-any') || '',
    tokens: el.getAttribute('data-layer') || '',
  }));
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  try {
    await context.addInitScript(() => {
      try { localStorage.removeItem('me-map-theme'); } catch (_) {}
    });

    // ISHOD: main layer controls markers and paths, then restores them.
    {
      const { page, errors } = await openMap(context, 'ishod');
      const markerSelector = '#me-markers [data-place-id]';
      const pathSelector = '#me-paths path[data-stage]';
      await page.waitForSelector(markerSelector);
      await clickLayer(page, 'main');
      const off = await page.evaluate(({ markerSelector, pathSelector }) => ({
        markers: [...document.querySelectorAll(markerSelector)].every((el) => el.getAttribute('data-me-layer-hidden') === '1'),
        paths: [...document.querySelectorAll(pathSelector)].every((el) => el.getAttribute('data-me-layer-hidden') === '1'),
      }), { markerSelector, pathSelector });
      await clickLayer(page, 'main');
      const on = await page.evaluate(({ markerSelector, pathSelector }) => ({
        markers: [...document.querySelectorAll(markerSelector)].every((el) => el.getAttribute('data-me-layer-hidden') === '0'),
        paths: [...document.querySelectorAll(pathSelector)].every((el) => el.getAttribute('data-me-layer-hidden') === '0'),
      }), { markerSelector, pathSelector });
      record('ishod main layer hides/restores route', errors.length === 0 && off.markers && off.paths && on.markers && on.paths, { off, on, errors });

      const before = await page.evaluate(() => ({
        theme: document.querySelector('.me-map')?.getAttribute('data-map-theme'),
        bg: getComputedStyle(document.querySelector('.me-map')).backgroundColor,
        filter: getComputedStyle(document.querySelector('.me-canvas svg')).filter,
      }));
      await page.evaluate(() => document.querySelector('.me-theme-btn')?.click());
      await page.waitForTimeout(180);
      const after = await page.evaluate(() => ({
        theme: document.querySelector('.me-map')?.getAttribute('data-map-theme'),
        bg: getComputedStyle(document.querySelector('.me-map')).backgroundColor,
        filter: getComputedStyle(document.querySelector('.me-canvas svg')).filter,
        stored: localStorage.getItem('me-map-theme'),
        pressed: document.querySelector('.me-theme-btn')?.getAttribute('aria-pressed'),
      }));
      record('ishod theme changes rendered palette', before.theme === 'dark' && after.theme === 'light' && before.bg !== after.bg && before.filter !== after.filter && after.stored === 'light' && after.pressed === 'true', { before, after });
      await page.close();
    }

    // AVRAAM: explicit stage/type facets remain restrictive and survive rerender.
    {
      const { page, errors } = await openMap(context, 'avraam');
      const warSelector = '#me-markers [data-layer~="war"]';
      const candSelector = '#me-markers [data-layer~="cand"]';
      await page.waitForSelector(warSelector);
      await page.waitForSelector(candSelector);
      const theme = await page.evaluate(() => ({
        theme: document.querySelector('.me-map')?.getAttribute('data-map-theme'),
        stored: localStorage.getItem('me-map-theme'),
      }));
      await clickLayer(page, 'war');
      const warOff = await elementLayerState(page, warSelector);
      await clickLayer(page, 'war');
      const warOn = await elementLayerState(page, warSelector);
      await clickLayer(page, 'cand');
      const candOffBeforeStory = await elementLayerState(page, candSelector);
      await page.evaluate(() => {
        const chips = [...document.querySelectorAll('.me-story-chip')];
        const other = chips.find((chip) => !chip.classList.contains('me-story-chip--active'));
        other?.click();
      });
      await page.waitForTimeout(850);
      await page.waitForSelector(candSelector);
      const candOffAfterStory = await elementLayerState(page, candSelector);
      record('avraam restrictive war/cand layers survive rerender', errors.length === 0 && theme.theme === 'light' && theme.stored === 'light' && warOff.hidden === '1' && warOn.hidden === '0' && candOffBeforeStory.hidden === '1' && candOffAfterStory.hidden === '1', { theme, warOff, warOn, candOffBeforeStory, candOffAfterStory, errors });
      await page.close();
    }

    // PAVEL: alternative journey membership keeps shared Antioch until all matching journeys are off.
    {
      const { page, errors } = await openMap(context, 'pavel');
      const antiochSelector = '#me-markers [data-place-id="antioch"]';
      await page.waitForSelector(antiochSelector);
      const initial = await elementLayerState(page, antiochSelector);
      await clickLayer(page, 'journey1');
      const afterJourney1Off = await elementLayerState(page, antiochSelector);
      await clickLayer(page, 'journey2');
      const afterBothOff = await elementLayerState(page, antiochSelector);
      await clickLayer(page, 'journey1');
      const afterJourney1On = await elementLayerState(page, antiochSelector);
      record('pavel shared city uses alternative journey membership', errors.length === 0 && initial.any.includes('journey1') && initial.any.includes('journey2') && afterJourney1Off.hidden === '0' && afterBothOff.hidden === '1' && afterJourney1On.hidden === '0', { initial, afterJourney1Off, afterBothOff, afterJourney1On, errors });
      await page.close();
    }
  } finally {
    await context.close();
    await browser.close();
  }

  for (const result of results) console.log(`${result.ok ? '✅' : '❌'} ${result.name}: ${JSON.stringify(result.detail)}`);
  const failed = results.filter((result) => !result.ok);
  console.log(failed.length ? `❌ ${failed.length} map layer/theme browser witness(es) failed` : '✅ map layer/theme browser witnesses passed');
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
