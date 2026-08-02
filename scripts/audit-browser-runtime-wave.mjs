#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE_URL = process.env.AUDIT_BASE || 'http://127.0.0.1:8090';
const ROUTE_URL = `${BASE_URL}/karty/avraam/`;
const OUT_DIR = path.resolve(process.env.AUDIT_BROWSER_OUT || 'reports/audit/browser-runtime-wave');
const HEAD_SHA = process.env.HEAD_SHA || process.env.GITHUB_SHA || 'local';
const RUN_ID = process.env.GITHUB_RUN_ID || 'local';

fs.mkdirSync(OUT_DIR, { recursive: true });
const writeJson = (name, value) => fs.writeFileSync(path.join(OUT_DIR, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const resolveUrl = (value) => {
  try { return new URL(value, ROUTE_URL).href; } catch { return String(value || ''); }
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
  colorScheme: 'light',
});
const page = await context.newPage();
page.setDefaultTimeout(10_000);

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
  schema: 1,
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
  fatal: null,
};

async function waitForMap() {
  await page.goto(ROUTE_URL, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForFunction(() => {
    const stage = document.querySelector('[data-map-stage]');
    return Boolean(
      document.querySelector('.me-map,#mapRoot')
      && document.querySelector('.me-canvas svg,.me-map svg,#mapRoot svg')
      && (stage?.getAttribute('data-map-state') === 'ready' || !stage)
    );
  }, { timeout: 60_000 });
}

async function dismissIntro() {
  const intro = page.locator('.me-intro');
  if (!(await intro.count())) return;
  const start = intro.getByRole('button').filter({ hasText: /Начать|изучение|тур/i }).first();
  if (await start.count()) {
    await start.click({ force: true });
  } else {
    await intro.locator('button').first().click({ force: true });
  }
  await intro.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
}

async function openPlace(placeId) {
  const marker = page.locator(`[data-place-id="${placeId}"]`).first();
  if (!(await marker.count())) throw new Error(`marker not found: ${placeId}`);
  await marker.evaluate((element) => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
  await page.locator('.me-panel--open,.me-panel:not([aria-hidden="true"])').first().waitFor({ state: 'visible', timeout: 5000 });
}

try {
  await waitForMap();
  await page.screenshot({ path: path.join(OUT_DIR, '00-intro.png'), animations: 'disabled' });

  evidence.findings['A11Y-P1-01'] = await page.evaluate(() => {
    const intro = document.querySelector('.me-intro');
    const h1s = [...document.querySelectorAll('h1')].map((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return {
        className: element.className || null,
        text: (element.textContent || '').replace(/\s+/g, ' ').trim(),
        inIntro: Boolean(element.closest('.me-intro')),
        ariaHidden: element.getAttribute('aria-hidden'),
        display: style.display,
        visibility: style.visibility,
        width: box.width,
        height: box.height,
      };
    });
    return {
      introPresent: Boolean(intro),
      h1Count: h1s.length,
      simultaneousDuplicateHeading: Boolean(intro && h1s.length >= 2),
      headings: h1s,
      disposition: intro && h1s.length >= 2 ? 'CONFIRMED-CURRENT' : 'NOT-REPRODUCED',
    };
  });

  await dismissIntro();

  const route = await page.evaluate(async () => {
    const response = await fetch('/karty/avraam/route.json', { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`route.json ${response.status}`);
    return response.json();
  });

  const tabCandidate = (route.places || []).find((place) => {
    const count = ['story', 'bible', 'arch', 'he_deep', 'dispute', 'photos', 'bible_extra'].filter((key) => {
      if (key === 'photos') return Array.isArray(place.photos) && place.photos.length > 0;
      return Boolean(place[key]);
    }).length;
    return count >= 2;
  }) || (route.places || [])[0];
  if (!tabCandidate?.id) throw new Error('no place available for panel-tab witness');

  await openPlace(tabCandidate.id);
  const tabs = page.locator('.me-tabs .me-tab[data-tab]:visible');
  await tabs.first().waitFor({ state: 'visible', timeout: 5000 });

  const structuralTabs = await tabs.evaluateAll((nodes) => nodes.map((node) => ({
    id: node.getAttribute('data-tab'),
    tagName: node.tagName,
    role: node.getAttribute('role'),
    tabIndexAttribute: node.getAttribute('tabindex'),
    tabIndexProperty: node.tabIndex,
    ariaSelected: node.getAttribute('aria-selected'),
    active: node.classList.contains('me-tab--active'),
  })));
  const tabsContainer = await page.locator('.me-tabs').first().evaluate((node) => ({
    tagName: node.tagName,
    role: node.getAttribute('role'),
    ariaLabel: node.getAttribute('aria-label'),
  }));

  const keyboard = { enter: null, space: null, numericShortcut: null, arrowRight: null };
  const tabCount = await tabs.count();
  if (tabCount >= 2) {
    const second = tabs.nth(1);
    await second.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    keyboard.enter = {
      target: await second.getAttribute('data-tab'),
      active: await second.evaluate((node) => node.classList.contains('me-tab--active')),
    };
  }
  if (tabCount >= 3) {
    const third = tabs.nth(2);
    await third.focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
    keyboard.space = {
      target: await third.getAttribute('data-tab'),
      active: await third.evaluate((node) => node.classList.contains('me-tab--active')),
    };
  }
  if (tabCount >= 2) {
    const first = tabs.nth(0);
    const secondId = await tabs.nth(1).getAttribute('data-tab');
    await first.focus();
    await page.keyboard.press('2');
    await page.waitForTimeout(100);
    keyboard.numericShortcut = {
      expected: secondId,
      active: await page.locator('.me-tab--active').first().getAttribute('data-tab'),
    };

    await first.focus();
    const beforeFocus = await page.evaluate(() => document.activeElement?.getAttribute?.('data-tab') || null);
    const beforePlace = await page.locator('.me-panel--open [data-place-id],.me-panel:not([aria-hidden="true"]) [data-place-id]').first().getAttribute('data-place-id').catch(() => null);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    keyboard.arrowRight = {
      beforeFocus,
      afterFocus: await page.evaluate(() => document.activeElement?.getAttribute?.('data-tab') || null),
      activeTab: await page.locator('.me-tab--active').first().getAttribute('data-tab'),
      beforePlace,
    };
  }

  const nativeButtons = structuralTabs.length > 0 && structuralTabs.every((tab) => tab.tagName === 'BUTTON' && tab.tabIndexProperty >= 0);
  const ariaTabPattern = tabsContainer.role === 'tablist'
    && structuralTabs.length > 0
    && structuralTabs.every((tab) => tab.role === 'tab' && tab.ariaSelected !== null);
  const nativeKeyboardWorks = Boolean(keyboard.enter?.active || keyboard.space?.active || (keyboard.numericShortcut && keyboard.numericShortcut.active === keyboard.numericShortcut.expected));

  evidence.findings['AVRAAM-P1-04'] = {
    placeId: tabCandidate.id,
    tabsContainer,
    tabs: structuralTabs,
    keyboard,
    nativeButtons,
    ariaTabPattern,
    nativeKeyboardWorks,
    historicalDivClaimReproduced: structuralTabs.some((tab) => tab.tagName === 'DIV'),
    disposition: nativeButtons && nativeKeyboardWorks && !ariaTabPattern ? 'PARTIAL-STALE-NARROW-RESIDUAL' : (!ariaTabPattern ? 'CONFIRMED-CURRENT' : 'NOT-REPRODUCED'),
    residual: !ariaTabPattern ? 'Missing ARIA tablist/tab/aria-selected semantics and roving-tabindex contract.' : null,
  };

  const photoCandidate = (route.places || []).find((place) => Array.isArray(place.photos)
    && place.photos.length === 1
    && place.photos[0]?.src
    && place.photos[0]?.thumb
    && resolveUrl(place.photos[0].src) !== resolveUrl(place.photos[0].thumb));

  if (!photoCandidate) {
    evidence.findings['QUAL-P1-04'] = {
      disposition: 'UNVERIFIED-NO-SUITABLE-FIXTURE',
      reason: 'No single-photo place with distinct full and thumbnail URLs.',
    };
  } else {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(100);
    await openPlace(photoCandidate.id);
    const photosTab = page.locator('.me-tab[data-tab="photos"]:visible').first();
    await photosTab.click();
    await page.waitForTimeout(150);

    const clickable = page.locator('.me-clickable-photo:visible').first();
    await clickable.waitFor({ state: 'visible', timeout: 5000 });
    const expectedFull = resolveUrl(photoCandidate.photos[0].src);
    const expectedThumb = resolveUrl(photoCandidate.photos[0].thumb);
    const sourceBefore = await clickable.evaluate((node) => ({
      src: node.currentSrc || node.src,
      dataSrc: node.getAttribute('data-src'),
    }));
    await clickable.click({ force: true });
    const modal = page.locator('.me-photo-modal--open').first();
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    const modalImage = modal.locator('.me-photo-modal__img').first();
    const immediate = resolveUrl(await modalImage.getAttribute('src'));
    await page.waitForTimeout(350);
    const settled = resolveUrl(await modalImage.getAttribute('src'));
    const modalCount = await page.locator('.me-photo-modal--open').count();
    const retainedFullSource = immediate === expectedFull && settled === expectedFull;
    evidence.findings['QUAL-P1-04'] = {
      placeId: photoCandidate.id,
      expectedFull,
      expectedThumb,
      sourceBefore,
      modalCount,
      immediate,
      settled,
      retainedFullSource,
      resetToThumbnail: immediate === expectedThumb || settled === expectedThumb,
      disposition: retainedFullSource && modalCount === 1 ? 'NOT-REPRODUCED-STALE-ON-CURRENT-HEAD' : 'CONFIRMED-CURRENT',
    };
    await page.screenshot({ path: path.join(OUT_DIR, '01-gallery-modal.png'), animations: 'disabled' });
  }

  await page.screenshot({ path: path.join(OUT_DIR, '02-panel-tabs.png'), animations: 'disabled' });
} catch (error) {
  evidence.fatal = { message: error.message, stack: error.stack };
  await page.screenshot({ path: path.join(OUT_DIR, 'FATAL.png'), fullPage: true }).catch(() => {});
} finally {
  await context.close();
  await browser.close();
}

writeJson('evidence.json', evidence);
const summary = [
  '# Expanded browser/runtime finding wave',
  '',
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
  'The JSON evidence contains DOM structure, keyboard behavior and exact resolved photo URLs.',
  '',
].join('\n');
fs.writeFileSync(path.join(OUT_DIR, 'SUMMARY.md'), summary, 'utf8');

console.log(summary);
if (evidence.fatal) process.exitCode = 1;
