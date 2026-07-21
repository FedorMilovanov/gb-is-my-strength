#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const MapEngine = require('../karty/_engine/map-engine.js');

const ROOT = path.join(__dirname, '..');
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:8090';
const ROUTES = (process.env.MAP_INITIAL_STATE_ROUTES || 'ishod,avraam')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

function storyIds(story) {
  return story && (story.places || story.place_ids || []) || [];
}

function defaultStoryId(route) {
  return (route.stories || []).find((story) => story.active_by_default)?.id || (route.stories || [])[0]?.id || 'main';
}

function selectWitness(route) {
  const fallbackStory = defaultStoryId(route);
  const targetStory = (route.stories || []).find((story) => story.id !== fallbackStory && storyIds(story).length) || (route.stories || [])[0];
  const targetPlace = storyIds(targetStory)[0] || (route.places || [])[0]?.id;
  const savedStory = fallbackStory;
  const savedPlace = (route.places || []).find((place) => place.id !== targetPlace)?.id || null;
  return { targetStory: targetStory?.id || fallbackStory, targetPlace, savedStory, savedPlace };
}

async function seedSavedState(context, key, state) {
  await context.addInitScript(({ storageKey, stored }) => {
    try { localStorage.setItem(storageKey, JSON.stringify(stored)); } catch (_) {}
  }, { storageKey: key, stored: state });
}

async function readRuntime(page) {
  return page.evaluate(() => {
    const activeChip = document.querySelector('.me-story-chip--active');
    const panel = document.querySelector('.me-panel');
    const params = new URLSearchParams(location.search);
    const svg = document.querySelector('.me-canvas svg');
    const vb = (svg?.getAttribute('viewBox') || '').split(/\s+/).map(Number);
    return {
      activeStory: activeChip?.getAttribute('data-story') || null,
      panelOpen: !!panel?.classList.contains('me-panel--open'),
      panelName: document.querySelector('.me-panel__name')?.textContent?.trim() || '',
      queryStory: params.get('story'),
      queryPlace: params.get('place'),
      hash: location.hash,
      viewBox: vb,
    };
  });
}

async function witnessExplicit(browser, slug, route, kind) {
  const { targetStory, targetPlace, savedStory, savedPlace } = selectWitness(route);
  if (!targetPlace) throw new Error(`${slug}: no target place for ${kind}`);
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const key = `me-map-state-${route.meta?.id || 'map'}`;
  await seedSavedState(context, key, { story: savedStory, place: savedPlace });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  const state = `story=${encodeURIComponent(targetStory)}&place=${encodeURIComponent(targetPlace)}`;
  const url = kind === 'query'
    ? `${BASE}/karty/${slug}/?${state}`
    : `${BASE}/karty/${slug}/#${state}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('.me-map', { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('.me-panel')?.classList.contains('me-panel--open'), null, { timeout: 8000 });
  await page.waitForTimeout(250);
  const runtime = await readRuntime(page);
  const stored = await page.evaluate((storageKey) => {
    try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (_) { return null; }
  }, key);
  await context.close();
  const ok = errors.length === 0 &&
    runtime.activeStory === targetStory &&
    runtime.panelOpen &&
    runtime.queryStory === (targetStory === 'main' ? null : targetStory) &&
    runtime.queryPlace === targetPlace &&
    runtime.hash === '' &&
    stored?.story === targetStory &&
    stored?.place === targetPlace;
  return { ok, kind, slug, targetStory, targetPlace, runtime, stored, errors };
}

async function witnessDefaultViewport(browser, slug, route) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const key = `me-map-state-${route.meta?.id || 'map'}`;
  await context.addInitScript((storageKey) => { try { localStorage.removeItem(storageKey); } catch (_) {} }, key);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${BASE}/karty/${slug}/`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('.me-canvas svg', { timeout: 15000 });
  await page.waitForTimeout(450);
  const runtime = await readRuntime(page);
  const expected = MapEngine.resolveInitialMapState(route, { origin: BASE, pathname: `/karty/${slug}/`, search: '', hash: '' }, null).viewport;
  await context.close();
  const [x, y, w, h] = runtime.viewBox;
  const centerX = x + w / 2;
  const centerY = y + h / 2;
  const tolerance = 3;
  const ok = errors.length === 0 &&
    Math.abs(centerX - expected[0]) <= tolerance &&
    Math.abs(centerY - expected[1]) <= tolerance &&
    Math.abs(w - expected[2]) <= tolerance;
  return { ok, kind: 'default', slug, expected, actual: { centerX, centerY, w, h }, errors };
}

(async () => {
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const slug of ROUTES) {
      const routePath = path.join(ROOT, 'karty', slug, 'route.json');
      const route = JSON.parse(fs.readFileSync(routePath, 'utf8'));
      results.push(await witnessExplicit(browser, slug, route, 'query'));
      results.push(await witnessExplicit(browser, slug, route, 'hash'));
      results.push(await witnessDefaultViewport(browser, slug, route));
    }
  } finally {
    await browser.close();
  }
  for (const result of results) {
    console.log(`${result.ok ? '✅' : '❌'} ${result.slug} ${result.kind}: ${JSON.stringify(result)}`);
  }
  const failed = results.filter((result) => !result.ok);
  console.log(failed.length ? `❌ ${failed.length} browser witness(es) failed` : '✅ map initial-state browser witnesses passed');
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
