#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE_URL = process.env.AUDIT_BASE || 'http://127.0.0.1:8090';
const ROUTE_URL = `${BASE_URL}/karty/avraam/`;
const OUT_DIR = path.resolve(process.env.AUDIT_BROWSER_OUT || 'reports/audit/browser-runtime-wave');
const HEAD_SHA = process.env.HEAD_SHA || process.env.GITHUB_SHA || 'local';
const TARGET_ID = process.env.AUDIT_TARGET_ID || 'unknown-target';
const RUN_ID = process.env.GITHUB_RUN_ID || 'local';

fs.mkdirSync(OUT_DIR, { recursive: true });
const writeJson = (name, value) => fs.writeFileSync(path.join(OUT_DIR, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const resolveUrl = (value) => {
  try { return new URL(value, ROUTE_URL).href; } catch { return String(value || ''); }
};
const messageOf = (error) => error instanceof Error ? error.message : String(error);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
  colorScheme: 'light',
});
const page = await context.newPage();
page.setDefaultTimeout(8_000);

await page.addInitScript(() => {
  window.__auditH1Samples = [];
  const sample = () => {
    const intro = document.querySelector('.me-intro');
    const headings = [...document.querySelectorAll('h1')].map((element) => ({
      className: typeof element.className === 'string' ? element.className : null,
      text: (element.textContent || '').replace(/\s+/g, ' ').trim(),
      inIntro: Boolean(element.closest('.me-intro')),
      ariaHidden: element.getAttribute('aria-hidden'),
    }));
    window.__auditH1Samples.push({
      at: performance.now(),
      readyState: document.readyState,
      introPresent: Boolean(intro),
      h1Count: headings.length,
      headings,
    });
    if (window.__auditH1Samples.length > 600) window.__auditH1Samples.shift();
  };
  const observer = new MutationObserver(sample);
  observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-hidden', 'hidden'] });
  sample();
  window.__auditH1Timer = setInterval(sample, 25);
});

const consoleEvents = [];
const failedRequests = [];
page.on('console', (message) => consoleEvents.push({ type: message.type(), text: message.text().slice(0, 1000) }));
page.on('pageerror', (error) => consoleEvents.push({ type: 'pageerror', text: error.message.slice(0, 1000) }));
page.on('requestfailed', (request) => failedRequests.push({
  url: request.url(),
  method: request.method(),
  error: request.failure()?.errorText || 'unknown',
}));

const evidence = {
  schema: 2,
  targetId: TARGET_ID,
  headSha: HEAD_SHA,
  runId: RUN_ID,
  route: ROUTE_URL,
  capturedAt: new Date().toISOString(),
  findings: {
    'A11Y-P1-01': null,
    'AVRAAM-P1-04': null,
    'QUAL-P1-04': null,
  },
  consoleEvents,
  failedRequests,
  infrastructureFatal: null,
};

async function waitForMap() {
  await page.goto(ROUTE_URL, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(() => {
    const stage = document.querySelector('[data-map-stage]');
    return Boolean(
      document.querySelector('.me-map,#mapRoot')
      && document.querySelector('.me-canvas svg,.me-map svg,#mapRoot svg')
      && (stage?.getAttribute('data-map-state') === 'ready' || !stage)
    );
  }, { timeout: 60_000 });
  await page.waitForTimeout(350);
}

async function dismissIntro() {
  const intro = page.locator('.me-intro');
  if (!(await intro.count())) return;
  const start = intro.locator('button').first();
  if (await start.count()) await start.click({ force: true });
  await intro.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
}

async function panelIsOpen() {
  return Boolean(await page.locator('.me-panel--open,.me-panel:not([aria-hidden="true"])').count());
}

async function closePanel() {
  if (!(await panelIsOpen())) return;
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(120);
  if (await panelIsOpen()) {
    await page.locator('.me-panel__close:visible').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(120);
  }
}

async function openPlace(placeId) {
  await closePanel();
  const marker = page.locator(`[data-place-id="${placeId}"]`).first();
  if (!(await marker.count())) throw new Error(`marker not found: ${placeId}`);
  await marker.evaluate((element) => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
  const panel = page.locator('.me-panel--open,.me-panel:not([aria-hidden="true"])').first();
  await panel.waitFor({ state: 'visible', timeout: 5000 });
  return panel;
}

async function routeData() {
  return page.evaluate(async () => {
    const response = await fetch('/karty/avraam/route.json', { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`route.json ${response.status}`);
    return response.json();
  });
}

async function findPlaceWithTabs(route) {
  const candidates = (route.places || []).filter((place) => {
    const count = ['story', 'bible', 'arch', 'he_deep', 'dispute', 'photos', 'bible_extra'].filter((key) => {
      if (key === 'photos') return Array.isArray(place.photos) && place.photos.length > 0;
      return Boolean(place[key]);
    }).length;
    return count >= 2;
  });
  for (const candidate of candidates) {
    try {
      await openPlace(candidate.id);
      const count = await page.locator('.me-tabs .me-tab[data-tab]:visible').count();
      if (count >= 2) return candidate;
    } catch {}
  }
  throw new Error('no place with at least two visible tabs');
}

async function captureA11yFinding() {
  const samples = await page.evaluate(() => {
    clearInterval(window.__auditH1Timer);
    return window.__auditH1Samples || [];
  });
  const introSamples = samples.filter((sample) => sample.introPresent);
  const maxH1CountDuringIntro = introSamples.reduce((max, sample) => Math.max(max, sample.h1Count), 0);
  const maxSamples = introSamples.filter((sample) => sample.h1Count === maxH1CountDuringIntro).slice(0, 12);
  evidence.findings['A11Y-P1-01'] = {
    sampleCount: samples.length,
    introSampleCount: introSamples.length,
    maxH1CountDuringIntro,
    simultaneousDuplicateHeading: maxH1CountDuringIntro >= 2,
    representativeMaxSamples: maxSamples,
    disposition: maxH1CountDuringIntro >= 2 ? 'CONFIRMED-CURRENT' : 'NOT-REPRODUCED-STALE-ON-EXACT-HEAD',
  };
}

async function captureTabFinding(route) {
  try {
    const place = await findPlaceWithTabs(route);
    const panel = page.locator('.me-panel--open,.me-panel:not([aria-hidden="true"])').first();
    const tabs = page.locator('.me-tabs .me-tab[data-tab]:visible');
    const structure = await tabs.evaluateAll((nodes) => nodes.map((node) => ({
      id: node.getAttribute('data-tab'),
      tagName: node.tagName,
      role: node.getAttribute('role'),
      tabIndexAttribute: node.getAttribute('tabindex'),
      tabIndexProperty: node.tabIndex,
      ariaSelected: node.getAttribute('aria-selected'),
      active: node.classList.contains('me-tab--active'),
    })));
    const container = await page.locator('.me-tabs').first().evaluate((node) => ({
      tagName: node.tagName,
      role: node.getAttribute('role'),
      ariaLabel: node.getAttribute('aria-label'),
    }));

    const testKey = async (key, index) => {
      await openPlace(place.id);
      const freshTabs = page.locator('.me-tabs .me-tab[data-tab]:visible');
      const count = await freshTabs.count();
      const target = freshTabs.nth(Math.min(index, Math.max(0, count - 1)));
      const targetId = await target.getAttribute('data-tab');
      await target.focus();
      const before = {
        focusedTab: await page.evaluate(() => document.activeElement?.getAttribute?.('data-tab') || null),
        activeTab: await page.locator('.me-tab--active').first().getAttribute('data-tab'),
      };
      await page.keyboard.press(key);
      await page.waitForTimeout(180);
      const open = await panelIsOpen();
      return {
        key,
        targetId,
        before,
        panelOpenAfter: open,
        activeTabAfter: open ? await page.locator('.me-tab--active').first().getAttribute('data-tab').catch(() => null) : null,
        focusedTabAfter: await page.evaluate(() => document.activeElement?.getAttribute?.('data-tab') || null),
        tourActiveAfter: Boolean(await page.locator('.me-tour-progress--active,.me-tour-active,[data-touring="true"]').count()),
      };
    };

    const enter = await testKey('Enter', 1);
    const space = await testKey('Space', structure.length >= 3 ? 2 : 1);

    await openPlace(place.id);
    const numericExpected = await page.locator('.me-tabs .me-tab[data-tab]:visible').nth(1).getAttribute('data-tab');
    await panel.locator('.me-panel__close').focus();
    await page.keyboard.press('2');
    await page.waitForTimeout(150);
    const numeric = {
      key: '2',
      expected: numericExpected,
      panelOpenAfter: await panelIsOpen(),
      activeTabAfter: await page.locator('.me-tab--active').first().getAttribute('data-tab').catch(() => null),
    };

    await openPlace(place.id);
    const first = page.locator('.me-tabs .me-tab[data-tab]:visible').first();
    const firstId = await first.getAttribute('data-tab');
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(180);
    const arrowRight = {
      key: 'ArrowRight',
      firstId,
      panelOpenAfter: await panelIsOpen(),
      activeTabAfter: await page.locator('.me-tab--active').first().getAttribute('data-tab').catch(() => null),
      focusedTabAfter: await page.evaluate(() => document.activeElement?.getAttribute?.('data-tab') || null),
      panelHeadingAfter: await page.locator('.me-panel__name').first().textContent().catch(() => null),
    };

    const nativeButtons = structure.length > 0 && structure.every((tab) => tab.tagName === 'BUTTON' && tab.tabIndexProperty >= 0);
    const ariaTabPattern = container.role === 'tablist'
      && structure.length > 0
      && structure.every((tab) => tab.role === 'tab' && tab.ariaSelected !== null);
    const enterWorks = enter.panelOpenAfter && enter.activeTabAfter === enter.targetId;
    const spaceWorks = space.panelOpenAfter && space.activeTabAfter === space.targetId;
    const numericWorks = numeric.panelOpenAfter && numeric.activeTabAfter === numeric.expected;
    const arrowNavigationWorks = arrowRight.panelOpenAfter && arrowRight.focusedTabAfter !== firstId;

    evidence.findings['AVRAAM-P1-04'] = {
      placeId: place.id,
      tabsContainer: container,
      tabs: structure,
      keyboard: { enter, space, numeric, arrowRight },
      nativeButtons,
      historicalDivClaimReproduced: structure.some((tab) => tab.tagName === 'DIV'),
      ariaTabPattern,
      enterWorks,
      spaceWorks,
      numericWorks,
      arrowNavigationWorks,
      disposition: nativeButtons && enterWorks && !ariaTabPattern
        ? 'PARTIAL-STALE-NARROW-RESIDUAL'
        : (!ariaTabPattern ? 'CONFIRMED-CURRENT' : 'NOT-REPRODUCED'),
      residual: !ariaTabPattern || !spaceWorks || !arrowNavigationWorks
        ? 'Native buttons replaced divs and Enter/numeric activation work, but the ARIA tablist/tab/aria-selected/roving-tabindex contract is absent; Space or arrow handling is not isolated as a tab widget.'
        : null,
    };
    await page.screenshot({ path: path.join(OUT_DIR, '02-panel-tabs.png'), animations: 'disabled' });
  } catch (error) {
    evidence.findings['AVRAAM-P1-04'] = { disposition: 'WITNESS-ERROR', error: messageOf(error) };
  }
}

async function captureGalleryFinding(route) {
  try {
    const candidates = (route.places || []).filter((place) => Array.isArray(place.photos)
      && place.photos.length === 1
      && place.photos[0]?.src
      && place.photos[0]?.thumb
      && resolveUrl(place.photos[0].src) !== resolveUrl(place.photos[0].thumb));
    let selected = null;
    for (const candidate of candidates) {
      try {
        await openPlace(candidate.id);
        const photosTab = page.locator('.me-tab[data-tab="photos"]:visible').first();
        if (!(await photosTab.count())) continue;
        await photosTab.click();
        await page.waitForTimeout(120);
        if (await page.locator('.me-clickable-photo:visible').count()) {
          selected = candidate;
          break;
        }
      } catch {}
    }

    if (!selected) {
      evidence.findings['QUAL-P1-04'] = {
        disposition: 'UNVERIFIED-NO-SUITABLE-RUNTIME-FIXTURE',
        candidateCount: candidates.length,
      };
      return;
    }

    const clickable = page.locator('.me-clickable-photo:visible').first();
    const expectedFull = resolveUrl(selected.photos[0].src);
    const expectedThumb = resolveUrl(selected.photos[0].thumb);
    const sourceBefore = await clickable.evaluate((node) => ({
      src: node.currentSrc || node.src,
      dataSrc: node.getAttribute('data-src'),
    }));
    await clickable.click({ force: true });
    const modal = page.locator('.me-photo-modal--open').first();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    const image = modal.locator('.me-photo-modal__img').first();
    const immediate = resolveUrl(await image.getAttribute('src'));
    await page.waitForTimeout(500);
    const settled = resolveUrl(await image.getAttribute('src'));
    const modalCount = await page.locator('.me-photo-modal--open').count();
    const retainedFullSource = immediate === expectedFull && settled === expectedFull;

    evidence.findings['QUAL-P1-04'] = {
      placeId: selected.id,
      expectedFull,
      expectedThumb,
      sourceBefore,
      modalCount,
      immediate,
      settled,
      retainedFullSource,
      resetToThumbnail: immediate === expectedThumb || settled === expectedThumb,
      disposition: retainedFullSource && modalCount === 1
        ? 'NOT-REPRODUCED-STALE-ON-EXACT-HEAD'
        : 'CONFIRMED-CURRENT',
    };
    await page.screenshot({ path: path.join(OUT_DIR, '01-gallery-modal.png'), animations: 'disabled' });
  } catch (error) {
    evidence.findings['QUAL-P1-04'] = { disposition: 'WITNESS-ERROR', error: messageOf(error) };
  }
}

try {
  await waitForMap();
  await page.screenshot({ path: path.join(OUT_DIR, '00-intro.png'), animations: 'disabled' });
  await captureA11yFinding();
  await dismissIntro();
  const route = await routeData();
  await captureTabFinding(route);
  await captureGalleryFinding(route);
} catch (error) {
  evidence.infrastructureFatal = { message: messageOf(error), stack: error instanceof Error ? error.stack : null };
  await page.screenshot({ path: path.join(OUT_DIR, 'FATAL.png'), fullPage: true }).catch(() => {});
} finally {
  await context.close();
  await browser.close();
}

writeJson('evidence.json', evidence);
const summary = [
  '# Expanded browser/runtime finding wave',
  '',
  `- Target: \`${TARGET_ID}\``,
  `- Exact head: \`${HEAD_SHA}\``,
  `- Workflow run: \`${RUN_ID}\``,
  `- Route: \`${ROUTE_URL}\``,
  `- Captured: ${evidence.capturedAt}`,
  '- Production claim: none.',
  '',
  '## Finding dispositions',
  '',
  ...Object.entries(evidence.findings).map(([id, finding]) => `- **${id}:** ${finding?.disposition || 'UNAVAILABLE'}`),
  '',
  'The JSON evidence contains sampled heading states, DOM/ARIA structure, keyboard behavior and exact resolved photo URLs.',
  '',
].join('\n');
fs.writeFileSync(path.join(OUT_DIR, 'SUMMARY.md'), summary, 'utf8');
console.log(summary);
if (evidence.infrastructureFatal) process.exitCode = 1;
