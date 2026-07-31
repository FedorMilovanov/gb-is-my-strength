#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const REPORT_DIR = path.join(ROOT, 'reports', 'home-browser-contract');

async function setThemeForEvidence(page, dark) {
  const current = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if (current === dark) return;

  const dispatched = await page.evaluate(() => {
    const toggle = document.getElementById('themeToggle');
    if (!(toggle instanceof HTMLButtonElement)) return false;
    toggle.click();
    return true;
  });
  assert.equal(dispatched, true, 'theme toggle is missing from the evidence page');
  await page.waitForFunction((expected) => document.documentElement.classList.contains('dark') === expected, dark);
}

async function assertDirectionObjects(page, label) {
  const images = page.locator('img.h-route-object');
  assert.equal(await images.count(), 5, `${label}: direction object count changed`);
  await images.first().scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const nodes = [...document.querySelectorAll('img.h-route-object')];
    return nodes.length === 5 && nodes.every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
  });
  await images.evaluateAll((nodes) => Promise.all(nodes.map((image) => image.decode())));

  const state = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('img.h-route-object')];
    return {
      svgCount: document.querySelectorAll('.h-home-routes svg').length,
      sources: nodes.map((image) => new URL(image.currentSrc || image.src, location.href).pathname),
      dimensions: nodes.map((image) => [image.naturalWidth, image.naturalHeight]),
      keys: nodes.map((image) => [...image.classList].find((name) => name.startsWith('h-route-object--')) || ''),
      loading: nodes.map((image) => image.getAttribute('loading')),
      fetchPriorities: nodes.map((image) => image.getAttribute('fetchpriority')),
      visibleCoverage: nodes.map((image) => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return 0;
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let visible = 0;
        for (let index = 3; index < pixels.length; index += 4) {
          if (pixels[index] > 16) visible += 1;
        }
        return visible / (canvas.width * canvas.height);
      }),
    };
  });

  assert.equal(state.svgCount, 0, `${label}: obsolete SVG remains in gateway`);
  assert.equal(new Set(state.keys).size, 5, `${label}: object identities are not unique`);
  assert.deepEqual(state.sources, [
    '/images/home/directions/articles-scroll.png',
    '/images/home/directions/series-documents.png',
    '/images/home/directions/biographies-theologian.png',
    '/images/home/directions/maps-biblical-atlas.png',
    '/images/home/directions/confessions-dossier.png',
  ], `${label}: direction asset order or URLs changed`);
  for (const [width, height] of state.dimensions) {
    assert.ok(width >= 200 && height >= 200, `${label}: PNG did not decode at expected resolution`);
  }
  assert.deepEqual(state.loading, ['eager', 'eager', 'eager', 'eager', 'eager'], `${label}: direction art must load deterministically`);
  assert.deepEqual(state.fetchPriorities, ['low', 'low', 'low', 'low', 'low'], `${label}: direction art must not compete with first-view content`);
  for (const coverage of state.visibleCoverage) {
    assert.ok(coverage >= 0.08, `${label}: direction PNG is decoded but visually empty (${(coverage * 100).toFixed(1)}% coverage)`);
  }
}

async function assertResponsiveLayout(page, width, height, expectedColumns) {
  await page.setViewportSize({ width, height });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);

  const state = await page.evaluate(() => {
    const routes = document.querySelector('.h-home-routes');
    const gateway = document.getElementById('issledovat');
    const menu = document.getElementById('hMobileMenuBtn');
    const style = routes ? getComputedStyle(routes) : null;
    const rect = gateway?.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      display: style?.display || '',
      columns: style?.gridTemplateColumns?.split(' ').filter(Boolean).length || 0,
      routeCount: routes?.querySelectorAll('.h-home-route').length || 0,
      menuDisplay: menu ? getComputedStyle(menu).display : '',
      gatewayWidth: rect?.width || 0,
      left: rect?.left || 0,
      right: rect ? innerWidth - rect.right : 0,
      ambientVisible: [...document.querySelectorAll('.h-ambient-word')]
        .filter((node) => getComputedStyle(node).display !== 'none').length,
    };
  });

  assert.equal(state.overflow, false, `${width}×${height}: horizontal overflow`);
  assert.equal(state.display, 'grid', `${width}×${height}: gateway is not a grid`);
  assert.equal(state.columns, expectedColumns, `${width}×${height}: expected ${expectedColumns} tracks, got ${state.columns}`);
  assert.equal(state.routeCount, 5, `${width}×${height}: route count changed`);
  if (width <= 760) assert.notEqual(state.menuDisplay, 'none', `${width}px: mobile menu hidden`);
  else assert.equal(state.menuDisplay, 'none', `${width}px: mobile menu visible above boundary`);
  if (width >= 1500) {
    assert.ok(state.gatewayWidth <= 1481, `${width}px: gateway exceeded 1480px cap`);
    assert.ok(state.left >= 100 && state.right >= 100, `${width}px: side marginalia safe fields were lost`);
    assert.equal(state.ambientVisible, 32, `${width}px: ambient phrases are not fully visible`);
  }
  await assertDirectionObjects(page, `${width}×${height}`);
}

async function settleForEvidence(page) {
  await page.evaluate(async () => {
    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    for (const element of document.querySelectorAll('.h-reveal')) {
      element.scrollIntoView({ behavior: 'auto', block: 'center' });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await pause(55);
    }
    window.scrollTo(0, 0);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await pause(300);
  });
}

async function captureEvidence(page, browserName) {
  if (browserName !== 'chromium') return [];
  const captures = [];
  for (const viewport of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet', width: 820, height: 1180 },
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'wide', width: 1720, height: 980 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await settleForEvidence(page);
    await assertDirectionObjects(page, `${viewport.name} evidence`);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
      true,
      `${viewport.name} evidence has horizontal overflow`,
    );
    for (const theme of ['light', 'dark']) {
      await setThemeForEvidence(page, theme === 'dark');
      await page.waitForTimeout(180);
      const file = `${browserName}-${viewport.name}-${theme}.png`;
      await page.screenshot({ path: path.join(REPORT_DIR, file), fullPage: true });
      captures.push(file);
    }
  }
  await setThemeForEvidence(page, false);
  return captures;
}

export async function runResponsiveEvidence(browserName, browserType, baseUrl) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
    locale: 'ru-RU',
    colorScheme: 'light',
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    const knownWebKitDiagnostic = browserName === 'webkit'
      && text === 'Viewport argument key "interactive-widget" not recognized and ignored.';
    if (!knownWebKitDiagnostic) runtimeErrors.push(`console: ${text}`);
  });

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    for (const spec of [
      [320, 568, 2],
      [390, 844, 2],
      [760, 900, 2],
      [761, 900, 6],
      [820, 1180, 6],
      [1024, 450, 6],
      [1280, 900, 5],
      [1720, 980, 5],
    ]) await assertResponsiveLayout(page, ...spec);

    const evidence = await captureEvidence(page, browserName);
    assert.deepEqual(runtimeErrors, [], `responsive evidence runtime errors: ${runtimeErrors.join(' | ')}`);
    return { browser: `${browserName}-responsive-evidence`, result: 'PASS', evidence };
  } finally {
    await context.close();
    await browser.close();
  }
}

export async function runResponsiveNoJavaScript(browserName, browserType, baseUrl) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: false,
    locale: 'ru-RU',
  });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'load' });
    await assertDirectionObjects(page, `${browserName} no-JS evidence`);
    for (const [width, height] of [[320, 568], [390, 844], [820, 1180], [1024, 450], [1720, 980]]) {
      await page.setViewportSize({ width, height });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
        true,
        `no-JS overflow at ${width}×${height}`,
      );
    }
    return { browser: `${browserName}-responsive-no-js`, result: 'PASS' };
  } finally {
    await context.close();
    await browser.close();
  }
}
