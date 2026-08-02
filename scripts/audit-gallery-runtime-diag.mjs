#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE_URL = process.env.AUDIT_BASE || 'http://127.0.0.1:8090';
const ROUTE_URL = `${BASE_URL}/karty/avraam/`;
const OUT_DIR = path.resolve(process.env.AUDIT_BROWSER_OUT || 'reports/audit/browser-runtime-wave');
const EVIDENCE_PATH = path.join(OUT_DIR, 'evidence.json');
const HEAD_SHA = process.env.HEAD_SHA || process.env.GITHUB_SHA || 'local';
const TARGET_ID = process.env.AUDIT_TARGET_ID || 'unknown-target';
const resolveUrl = (value) => {
  try { return new URL(value, ROUTE_URL).href; } catch { return String(value || ''); }
};
const messageOf = (error) => error instanceof Error ? error.message : String(error);

const diagnostic = {
  targetId: TARGET_ID,
  headSha: HEAD_SHA,
  route: ROUTE_URL,
  capturedAt: new Date().toISOString(),
  candidates: [],
  result: null,
  fatal: null,
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(8_000);

async function waitForMap(url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(() => {
    const stage = document.querySelector('[data-map-stage]');
    return Boolean(
      document.querySelector('.me-map,#mapRoot')
      && document.querySelector('.me-canvas svg,.me-map svg,#mapRoot svg')
      && (stage?.getAttribute('data-map-state') === 'ready' || !stage)
    );
  }, { timeout: 60_000 });
  await page.waitForTimeout(300);
}

async function dismissIntro() {
  const intro = page.locator('.me-intro');
  if (!(await intro.count())) return;
  await intro.locator('button').first().click({ force: true }).catch(() => {});
  await intro.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
}

async function inspectPanel() {
  const panel = page.locator('.me-panel--open,.me-panel:not([aria-hidden="true"])').first();
  const panelOpen = Boolean(await panel.count());
  if (!panelOpen) return { panelOpen: false };
  const tabs = await page.locator('.me-tab[data-tab]:visible').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-tab')));
  const images = await panel.locator('img').evaluateAll((nodes) => nodes.map((node) => ({
    className: node.className || null,
    src: node.currentSrc || node.src,
    dataSrc: node.getAttribute('data-src'),
    visible: Boolean(node.getClientRects().length),
  })));
  return {
    panelOpen: true,
    heading: await panel.locator('.me-panel__name').first().textContent().catch(() => null),
    tabs,
    images,
  };
}

async function activatePhotos() {
  const tab = page.locator('.me-tab[data-tab="photos"]:visible').first();
  if (!(await tab.count())) return false;
  await tab.click({ force: true });
  await page.waitForTimeout(180);
  return true;
}

async function testCandidate(candidate, storyId) {
  const params = new URLSearchParams();
  if (storyId && storyId !== 'main') params.set('story', storyId);
  params.set('place', candidate.id);
  const url = `${ROUTE_URL}?${params.toString()}`;
  const attempt = { placeId: candidate.id, storyId: storyId || null, url, stages: [] };

  await waitForMap(url);
  await dismissIntro();
  await page.waitForTimeout(300);
  attempt.stages.push({ stage: 'deep-link-loaded', ...(await inspectPanel()) });

  if (!(await page.locator('.me-panel--open,.me-panel:not([aria-hidden="true"])').count())) {
    const marker = page.locator(`[data-place-id="${candidate.id}"]`).first();
    attempt.markerCount = await marker.count();
    if (attempt.markerCount) {
      await marker.evaluate((element) => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
      await page.waitForTimeout(250);
      attempt.stages.push({ stage: 'marker-dispatched', ...(await inspectPanel()) });
    }
  }

  attempt.photosActivated = await activatePhotos();
  attempt.stages.push({ stage: 'photos-activated', ...(await inspectPanel()) });
  if (!attempt.photosActivated) return { attempt, success: false, reason: 'photos tab unavailable' };

  let clickable = page.locator('.me-clickable-photo:visible').first();
  if (!(await clickable.count())) clickable = page.locator('.me-content img[data-src]:visible').first();
  attempt.clickableCount = await clickable.count();
  if (!attempt.clickableCount) return { attempt, success: false, reason: 'full-source image control unavailable' };

  const expectedFull = resolveUrl(candidate.photos[0].src);
  const expectedThumb = resolveUrl(candidate.photos[0].thumb);
  const trigger = await clickable.evaluate((node) => ({
    className: node.className || null,
    src: node.currentSrc || node.src,
    dataSrc: node.getAttribute('data-src'),
  }));
  await clickable.evaluate((element) => element.click());
  const modal = page.locator('.me-photo-modal--open').first();
  await modal.waitFor({ state: 'visible', timeout: 5000 });
  const image = modal.locator('.me-photo-modal__img').first();
  const immediate = resolveUrl(await image.getAttribute('src'));
  await page.waitForTimeout(700);
  const settled = resolveUrl(await image.getAttribute('src'));
  const modalCount = await page.locator('.me-photo-modal--open').count();
  const retainedFullSource = immediate === expectedFull && settled === expectedFull;
  await page.screenshot({ path: path.join(OUT_DIR, '03-gallery-deep-link.png'), animations: 'disabled' });

  return {
    attempt,
    success: true,
    evidence: {
      placeId: candidate.id,
      storyId: storyId || null,
      expectedFull,
      expectedThumb,
      trigger,
      modalCount,
      immediate,
      settled,
      retainedFullSource,
      resetToThumbnail: immediate === expectedThumb || settled === expectedThumb,
      disposition: retainedFullSource && modalCount === 1
        ? 'NOT-REPRODUCED-STALE-ON-EXACT-HEAD'
        : 'CONFIRMED-CURRENT',
    },
  };
}

try {
  await waitForMap(ROUTE_URL);
  const route = await page.evaluate(async () => {
    const response = await fetch('/karty/avraam/route.json', { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`route.json ${response.status}`);
    return response.json();
  });
  const candidates = (route.places || []).filter((place) => Array.isArray(place.photos)
    && place.photos.length === 1
    && place.photos[0]?.src
    && place.photos[0]?.thumb
    && resolveUrl(place.photos[0].src) !== resolveUrl(place.photos[0].thumb));

  for (const candidate of candidates) {
    const story = (route.stories || []).find((item) => Array.isArray(item.places) && item.places.includes(candidate.id));
    const record = {
      id: candidate.id,
      type: candidate.type || null,
      stage: Number.isInteger(candidate.stage) ? candidate.stage : null,
      storyId: story?.id || 'main',
      full: resolveUrl(candidate.photos[0].src),
      thumb: resolveUrl(candidate.photos[0].thumb),
    };
    diagnostic.candidates.push(record);
    try {
      const tested = await testCandidate(candidate, record.storyId);
      record.attempt = tested.attempt;
      if (tested.success) {
        diagnostic.result = tested.evidence;
        break;
      }
      record.failure = tested.reason;
    } catch (error) {
      record.error = messageOf(error);
    }
  }

  if (!diagnostic.result) {
    diagnostic.result = {
      disposition: 'WITNESS-ERROR',
      reason: diagnostic.candidates.length
        ? 'No candidate reached a clickable full-source modal path; see candidate diagnostics.'
        : 'No single-photo record with distinct full and thumbnail URLs exists.',
    };
  }
} catch (error) {
  diagnostic.fatal = { message: messageOf(error), stack: error instanceof Error ? error.stack : null };
  diagnostic.result = { disposition: 'WITNESS-ERROR', reason: messageOf(error) };
} finally {
  await context.close();
  await browser.close();
}

fs.writeFileSync(path.join(OUT_DIR, 'gallery-diagnostic.json'), `${JSON.stringify(diagnostic, null, 2)}\n`, 'utf8');
if (fs.existsSync(EVIDENCE_PATH)) {
  const evidence = JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8'));
  evidence.findings['QUAL-P1-04'] = {
    ...diagnostic.result,
    diagnosticCandidates: diagnostic.candidates,
  };
  fs.writeFileSync(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
}
console.log(`QUAL-P1-04: ${diagnostic.result?.disposition || 'UNAVAILABLE'}`);
if (diagnostic.fatal) process.exitCode = 1;
