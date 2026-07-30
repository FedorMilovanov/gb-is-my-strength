#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const ROOT = path.resolve(process.cwd());
const DIST = path.join(ROOT, 'dist');
const REPORT_DIR = path.join(ROOT, 'reports', 'home-browser-contract');
const BROWSERS = { chromium, webkit };
const browserNames = String(process.env.HOME_BROWSERS || 'chromium,webkit')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

function isKnownBrowserDiagnostic(browserName, text) {
  return browserName === 'webkit'
    && text === 'Viewport argument key "interactive-widget" not recognized and ignored.';
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
  }[extension] || 'application/octet-stream';
}

function resolveRequestPath(urlValue) {
  const url = new URL(urlValue || '/', 'http://127.0.0.1');
  const decoded = decodeURIComponent(url.pathname);
  const relative = decoded.endsWith('/') ? `${decoded}index.html` : decoded;
  const candidate = path.resolve(DIST, `.${relative}`);
  assert.ok(candidate === DIST || candidate.startsWith(`${DIST}${path.sep}`), 'request escaped dist root');
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  const indexCandidate = path.join(candidate, 'index.html');
  if (fs.existsSync(indexCandidate) && fs.statSync(indexCandidate).isFile()) return indexCandidate;
  return null;
}

async function startServer() {
  assert.ok(fs.existsSync(path.join(DIST, 'index.html')), 'dist/index.html is missing; build production-like dist first');
  const server = http.createServer((request, response) => {
    try {
      const filePath = resolveRequestPath(request.url);
      response.setHeader('Cache-Control', 'no-store');
      if (!filePath) {
        response.statusCode = 404;
        response.end('Not found');
        return;
      }
      response.setHeader('Content-Type', contentType(filePath));
      fs.createReadStream(filePath).pipe(response);
    } catch (error) {
      response.statusCode = 400;
      response.end(error.message);
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function waitForMenuState(page, open) {
  await page.waitForFunction((expected) => {
    const trigger = document.getElementById('hMobileMenuBtn');
    const panel = document.getElementById('hMobileNav');
    if (!trigger || !panel) return false;
    const actual = trigger.getAttribute('aria-expanded') === 'true' && panel.classList.contains('open');
    return actual === expected;
  }, open);
}

async function assertScrollUnlocked(page, label) {
  const state = await page.evaluate(() => ({
    bodyPosition: getComputedStyle(document.body).position,
    bodyOverflow: getComputedStyle(document.body).overflow,
    bodyOverflowY: getComputedStyle(document.body).overflowY,
    lockCount: Number(window.SiteUtils?._scrollLockCount || 0),
  }));
  assert.notEqual(state.bodyPosition, 'fixed', `${label}: body position remained fixed`);
  assert.notEqual(state.bodyOverflow, 'hidden', `${label}: body overflow remained hidden`);
  assert.notEqual(state.bodyOverflowY, 'hidden', `${label}: body overflow-y remained hidden`);
  assert.equal(state.lockCount, 0, `${label}: SiteUtils lock count remained non-zero`);
}

async function assertSearchClosed(page, label) {
  const visible = await page.locator('.cp-backdrop').isVisible().catch(() => false);
  assert.equal(visible, false, `${label}: search overlay opened unexpectedly`);
}

async function clickExposedBackdrop(page) {
  const point = await page.evaluate(() => {
    const backdrop = document.getElementById('hMobileBackdrop');
    if (!backdrop) return null;
    const rect = backdrop.getBoundingClientRect();
    const left = Math.max(2, Math.ceil(rect.left) + 2);
    const right = Math.min(innerWidth - 2, Math.floor(rect.right) - 2);
    const top = Math.max(2, Math.ceil(rect.top) + 2);
    const bottom = Math.min(innerHeight - 2, Math.floor(rect.bottom) - 2);
    for (let y = bottom; y >= top; y -= 24) {
      for (const x of [left, right, Math.round((left + right) / 2)]) {
        const hit = document.elementFromPoint(x, y);
        if (hit === backdrop || backdrop.contains(hit)) return { x, y };
      }
    }
    return null;
  });
  assert.ok(point, 'mobile backdrop has no exposed clickable pixel');
  await page.mouse.click(point.x, point.y);
}

async function runInteractiveBrowser(browserName, browserType, baseUrl) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
    locale: 'ru-RU',
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (!isKnownBrowserDiagnostic(browserName, text)) runtimeErrors.push(`console: ${text}`);
  });

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#hMobileMenuBtn');
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true, 'home has horizontal overflow');

    const menuButton = page.locator('#hMobileMenuBtn');
    const menuPanel = page.locator('#hMobileNav');
    const menuControls = menuPanel.locator('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
    const menuControlCount = await menuControls.count();
    assert.ok(menuControlCount >= 6, `mobile menu exposes too few controls (${menuControlCount})`);

    await menuButton.click();
    await waitForMenuState(page, true);
    await page.waitForFunction(() => document.getElementById('hMobileNav')?.contains(document.activeElement));
    assert.equal(await menuButton.getAttribute('aria-expanded'), 'true');
    assert.notEqual(await menuPanel.getAttribute('aria-hidden'), 'true', 'visible mobile menu remained hidden from assistive technology');
    assert.equal(await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      return body.position === 'fixed' || body.overflow === 'hidden' || body.overflowY === 'hidden' || Number(window.SiteUtils?._scrollLockCount || 0) > 0;
    }), true, 'mobile menu did not lock page scroll');

    const firstControl = menuControls.first();
    const lastControl = menuControls.last();
    await lastControl.focus();
    await page.keyboard.press('Tab');
    assert.equal(await firstControl.evaluate((element) => element === document.activeElement), true, 'Tab escaped mobile menu');
    await firstControl.focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await lastControl.evaluate((element) => element === document.activeElement), true, 'Shift+Tab escaped mobile menu');

    await page.keyboard.press('Escape');
    await waitForMenuState(page, false);
    assert.equal(await menuButton.evaluate((element) => element === document.activeElement), true, 'Escape did not restore menu opener focus');
    await assertScrollUnlocked(page, 'Escape close');

    await menuButton.click();
    await waitForMenuState(page, true);
    await clickExposedBackdrop(page);
    await waitForMenuState(page, false);
    await assertScrollUnlocked(page, 'backdrop close');

    await menuButton.click();
    await waitForMenuState(page, true);
    await page.setViewportSize({ width: 1024, height: 844 });
    await waitForMenuState(page, false);
    await assertScrollUnlocked(page, 'mobile-to-desktop resize');
    assert.equal(await page.evaluate(() => document.activeElement?.matches('.h-nav-links a') || document.activeElement === document.body), true, 'resize left focus in hidden mobile UI');

    await page.setViewportSize({ width: 390, height: 844 });
    await menuButton.click();
    await waitForMenuState(page, true);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await waitForMenuState(page, false);
    await assertScrollUnlocked(page, 'BFCache pageshow');

    await page.keyboard.press('Alt+Control+K');
    await page.waitForTimeout(120);
    await assertSearchClosed(page, 'Alt+Ctrl+K');
    await page.keyboard.press('Control+Meta+K');
    await page.waitForTimeout(120);
    await assertSearchClosed(page, 'Ctrl+Meta+K');

    await page.evaluate(() => {
      const editable = document.createElement('div');
      editable.id = 'home-contract-editable';
      editable.contentEditable = 'true';
      editable.textContent = 'editable';
      document.body.appendChild(editable);
      editable.focus();
    });
    await page.keyboard.press('Control+K');
    await page.waitForTimeout(120);
    await assertSearchClosed(page, 'editable Ctrl+K');

    await page.locator('body').click({ position: { x: 1, y: 1 } });
    await page.keyboard.press('Control+K');
    const searchInput = page.locator('.cp-input');
    await searchInput.waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const input = document.querySelector('.cp-input');
      return input !== null && input === document.activeElement;
    });
    assert.equal(await searchInput.evaluate((element) => element === document.activeElement), true, 'canonical Ctrl+K did not focus search input');
    assert.equal(await page.locator('.cp-backdrop').count(), 1, 'search initialized more than once');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => {
      const overlay = document.querySelector('.cp-backdrop');
      return !overlay || getComputedStyle(overlay).display === 'none' || !overlay.classList.contains('open');
    });

    const hebrew = page.locator('.h-sacred-block--hero .hb-w').first();
    const hebrewCountBefore = await page.locator('.h-sacred-block--hero .hb-w, .h-sacred-block--hero .h-tetra').count();
    await hebrew.click();
    await page.waitForFunction(() => document.querySelector('.h-sacred-block--hero .hb-w')?.getAttribute('aria-pressed') === 'true');
    assert.ok((await hebrew.locator('.hb-back').textContent())?.trim(), 'Hebrew translation is empty');
    const rect = await hebrew.boundingBox();
    assert.ok(rect && rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= 390 && rect.y + rect.height <= 844, 'Hebrew interaction escaped visual viewport');
    await hebrew.focus();
    await page.keyboard.press('Enter');
    assert.equal(await hebrew.getAttribute('aria-pressed'), 'false', 'Enter did not toggle Hebrew word');
    await page.keyboard.press('Space');
    assert.equal(await hebrew.getAttribute('aria-pressed'), 'true', 'Space did not toggle Hebrew word');
    assert.equal(await page.locator('.h-sacred-block--hero .hb-w, .h-sacred-block--hero .h-tetra').count(), hebrewCountBefore, 'Hebrew interaction cloned controls');

    await page.evaluate(() => window.scrollTo(0, Math.min(900, document.documentElement.scrollHeight - innerHeight)));
    await page.waitForTimeout(100);
    const scrollTop = page.locator('#hScrollTop');
    await scrollTop.waitFor({ state: 'visible' });
    const progress = await page.locator('#hProgressCircle').evaluate((element) => {
      const raw = element.style.strokeDashoffset || getComputedStyle(element).strokeDashoffset;
      return { raw, value: Number.parseFloat(raw) };
    });
    assert.ok(Number.isFinite(progress.value), `progress offset is not numeric: ${progress.raw}`);
    assert.ok(progress.value < 138.23, `reading progress did not advance (${progress.raw})`);
    await scrollTop.click();
    await page.waitForFunction(() => Math.round(window.scrollY) === 0);

    assert.deepEqual(runtimeErrors, [], `runtime errors: ${runtimeErrors.join(' | ')}`);
    return { browser: browserName, result: 'PASS' };
  } catch (error) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(REPORT_DIR, `${browserName}-failure.png`), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function runNoJavaScript(browserName, browserType, baseUrl) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: false,
    locale: 'ru-RU',
  });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'load' });
    await page.locator('#main-content').waitFor({ state: 'visible' });
    await page.locator('h1').waitFor({ state: 'visible' });
    const noJsNavigation = page.locator('.h-nojs-nav');
    await noJsNavigation.waitFor({ state: 'visible' });
    assert.ok(await noJsNavigation.locator('a[href]').count() >= 6, 'no-JS navigation is incomplete');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true, 'no-JS home has horizontal overflow');
    return { browser: `${browserName}-no-js`, result: 'PASS' };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const server = await startServer();
  const results = [];
  try {
    for (const browserName of browserNames) {
      const browserType = BROWSERS[browserName];
      assert.ok(browserType, `unsupported browser: ${browserName}`);
      results.push(await runInteractiveBrowser(browserName, browserType, server.baseUrl));
      results.push(await runNoJavaScript(browserName, browserType, server.baseUrl));
    }
    fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify({ result: 'PASS', results }, null, 2)}\n`);
    console.log(`Home browser contract: PASS (${results.length} browser modes)`);
  } catch (error) {
    fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify({ result: 'FAIL', results, error: error.stack || error.message }, null, 2)}\n`);
    throw error;
  } finally {
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
