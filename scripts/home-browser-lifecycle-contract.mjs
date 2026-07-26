#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const ROOT = path.resolve(process.cwd());
const DIST = path.join(ROOT, 'dist');
const REPORT_DIR = path.join(ROOT, 'reports', 'home-browser-lifecycle-contract');
const LIFECYCLE_KEY = 'gb-home-browser-lifecycle-contract-v1';
const BROWSERS = { chromium, webkit };
const browserNames = String(process.env.HOME_BROWSERS || 'chromium,webkit')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

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
  assert.ok(fs.existsSync(path.join(DIST, 'about', 'index.html')), 'dist/about/index.html is missing; real history traversal needs a same-origin destination');

  const server = http.createServer((request, response) => {
    try {
      const filePath = resolveRequestPath(request.url);
      response.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
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

function isKnownBrowserDiagnostic(browserName, text) {
  return browserName === 'webkit'
    && text === 'Viewport argument key "interactive-widget" not recognized and ignored.';
}

function isExactPagefindAssetRequest(request, baseUrl) {
  try {
    const url = new URL(request.url());
    return url.origin === baseUrl && url.pathname === '/pagefind/pagefind.js';
  } catch {
    return false;
  }
}

function isExpectedPagefindRequest(request, baseUrl) {
  return request.method() === 'GET'
    && isExactPagefindAssetRequest(request, baseUrl);
}

function isKnownNavigationAbort(request, expectedNavigationAborts) {
  // Bind the exception to the exact request object when it starts inside the
  // intentional route transition. requestfailed may arrive asynchronously.
  return request.failure()?.errorText === 'net::ERR_ABORTED'
    && expectedNavigationAborts.has(request);
}

function isKnownSuccessfulPagefindHeadAbort(browserName, request, baseUrl, pagefindState) {
  // Chromium reports this HEAD probe as aborted after exposing its successful
  // response to fetch(). Accept only that exact response object during the
  // canonical bootstrap; Pagefind readiness and the completed GET are asserted
  // separately before the browser result can pass.
  return browserName === 'chromium'
    && pagefindState.bootstrapActive
    && request.method() === 'HEAD'
    && request.resourceType() === 'fetch'
    && isExactPagefindAssetRequest(request, baseUrl)
    && request.failure()?.errorText === 'net::ERR_ABORTED'
    && pagefindState.successfulHeadResponses.has(request);
}

async function installLifecycleProbe(context) {
  await context.addInitScript(({ storageKey }) => {
    const read = () => {
      try {
        const parsed = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };
    const append = (event) => {
      const events = read();
      events.push({ ...event, sequence: events.length + 1 });
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(events.slice(-40)));
      } catch (error) {
        // The init script also runs in Playwright's transient opaque document.
        // Only that non-HTTP document may lack storage; product pages stay strict.
        if (!['http:', 'https:'].includes(location.protocol)) return;
        throw error;
      }
    };
    window.addEventListener('pageshow', (event) => append({
      type: 'pageshow',
      path: location.pathname,
      persisted: event.persisted,
    }));
    window.addEventListener('pagehide', (event) => append({
      type: 'pagehide',
      path: location.pathname,
      persisted: event.persisted,
    }));
  }, { storageKey: LIFECYCLE_KEY });
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

async function closeSearch(page) {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const overlay = document.querySelector('.cp-backdrop');
    return !overlay || getComputedStyle(overlay).display === 'none' || !overlay.classList.contains('open');
  });
}

async function assertCanonicalShortcut(page, chord, label, baseUrl, pagefindState) {
  const observeHeadResponse = (response) => {
    const request = response.request();
    if (
      response.status() >= 200
      && response.status() < 300
      && request.method() === 'HEAD'
      && request.resourceType() === 'fetch'
      && isExactPagefindAssetRequest(request, baseUrl)
    ) {
      pagefindState.successfulHeadResponses.add(request);
      pagefindState.headResponseCount += 1;
    }
  };
  const observeModuleLoad = (request) => {
    if (
      request.method() === 'GET'
      && request.resourceType() === 'script'
      && isExactPagefindAssetRequest(request, baseUrl)
    ) {
      pagefindState.moduleLoadCount += 1;
    }
  };
  page.on('response', observeHeadResponse);
  page.on('requestfinished', observeModuleLoad);
  pagefindState.bootstrapActive = true;
  try {
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    await page.keyboard.press(chord);
    const searchInput = page.locator('.cp-input');
    await searchInput.waitFor({ state: 'visible' });
    assert.equal(await searchInput.evaluate((element) => element === document.activeElement), true, `${label}: search input did not receive focus`);
    assert.equal(await page.locator('.cp-backdrop').count(), 1, `${label}: search initialized more than once`);
    await page.waitForFunction(() => window.__pagefindReady__ === true || window.__pagefindFailed__ === true);
    const loadState = await page.evaluate(() => ({
      failed: window.__pagefindFailed__ === true,
      ready: window.__pagefindReady__ === true,
    }));
    assert.equal(loadState.failed, false, `${label}: Pagefind bootstrap reported failure`);
    assert.equal(loadState.ready, true, `${label}: Pagefind bootstrap did not reach ready state`);
  } finally {
    pagefindState.bootstrapActive = false;
    page.off('response', observeHeadResponse);
    page.off('requestfinished', observeModuleLoad);
  }
  await closeSearch(page);
}

async function assertRealHistoryRestore(page, baseUrl, navigationState) {
  await page.evaluate((storageKey) => sessionStorage.setItem(storageKey, '[]'), LIFECYCLE_KEY);
  const themeBefore = await page.evaluate(() => ({
    attribute: document.documentElement.getAttribute('data-theme'),
    stored: localStorage.getItem('theme'),
  }));

  const menuButton = page.locator('#hMobileMenuBtn');
  await menuButton.click();
  await waitForMenuState(page, true);
  // Let the opened menu and scroll lock reach a painted, stable frame before
  // the product captures them for its full-page View Transition navigation.
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  await waitForMenuState(page, true);

  await page.evaluate(() => {
    const link = document.createElement('a');
    link.id = 'home-contract-history-target';
    link.href = '/about/';
    link.textContent = 'history target';
    link.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:2147483647';
    document.body.appendChild(link);
  });
  navigationState.allowPagefindAbort = true;
  try {
    await Promise.all([
      page.waitForURL(`${baseUrl}/about/`),
      page.locator('#home-contract-history-target').click(),
    ]);
    await page.locator('#main-content').waitFor({ state: 'visible' });
  } finally {
    navigationState.allowPagefindAbort = false;
  }

  // A BFCache restore does not fire DOMContentLoaded again. Wait only for the
  // navigation commit, then assert the restored URL, DOM and persisted events.
  await page.goBack({ waitUntil: 'commit' });
  await page.waitForSelector('#hMobileMenuBtn');
  const restoredUrl = new URL(page.url());
  assert.equal(restoredUrl.origin, baseUrl, 'history traversal changed origin');
  assert.equal(restoredUrl.pathname, '/', 'history traversal did not restore the homepage path');
  await waitForMenuState(page, false);
  await assertScrollUnlocked(page, 'real history restore');

  const evidence = await page.evaluate((storageKey) => {
    const navigation = performance.getEntriesByType('navigation').at(-1);
    return {
      events: JSON.parse(sessionStorage.getItem(storageKey) || '[]'),
      theme: {
        attribute: document.documentElement.getAttribute('data-theme'),
        stored: localStorage.getItem('theme'),
      },
      navigationType: navigation?.type || null,
      notRestoredReasons: navigation?.notRestoredReasons || null,
    };
  }, LIFECYCLE_KEY);
  const homePageHide = [...evidence.events].reverse().find((entry) => entry.type === 'pagehide' && entry.path === '/');
  const homePageShow = [...evidence.events].reverse().find((entry) => entry.type === 'pageshow' && entry.path === '/');
  const diagnostic = JSON.stringify({ events: evidence.events, navigationType: evidence.navigationType, notRestoredReasons: evidence.notRestoredReasons });
  assert.equal(homePageHide?.persisted, true, `home page was not admitted to BFCache: ${diagnostic}`);
  assert.equal(homePageShow?.persisted, true, `home page was not restored from BFCache: ${diagnostic}`);
  assert.deepEqual(evidence.theme, themeBefore, 'theme state drifted across real history restoration');

  await menuButton.click();
  await waitForMenuState(page, true);
  await page.keyboard.press('Escape');
  await waitForMenuState(page, false);
  await assertScrollUnlocked(page, 'post-BFCache menu close');

  return evidence;
}

async function assertEditableShortcutIsolation(page) {
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'home-contract-editable-host';
    host.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:2147483647;background:white;color:black';
    host.innerHTML = [
      '<input id="home-contract-input" aria-label="contract input">',
      '<textarea id="home-contract-textarea" aria-label="contract textarea"></textarea>',
      '<div id="home-contract-role-textbox" role="textbox" tabindex="0" contenteditable="true">role textbox</div>',
    ].join('');
    document.body.appendChild(host);
  });

  for (const [selector, chord, label] of [
    ['#home-contract-input', 'Control+K', 'input Ctrl+K'],
    ['#home-contract-textarea', 'Meta+K', 'textarea Meta+K'],
    ['#home-contract-role-textbox', 'Control+K', 'role=textbox Ctrl+K'],
  ]) {
    await page.locator(selector).focus();
    await page.keyboard.press(chord);
    await page.waitForTimeout(80);
    await assertSearchClosed(page, label);
  }

  const input = page.locator('#home-contract-input');
  await input.fill('');
  await input.focus();
  await page.keyboard.press('k');
  assert.equal(await input.inputValue(), 'k', 'plain unmodified K was intercepted before reaching an ordinary input');

  const ime = await page.evaluate(() => {
    const target = document.getElementById('home-contract-input');
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      code: 'KeyK',
      ctrlKey: true,
      isComposing: true,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return { isComposing: event.isComposing, defaultPrevented: event.defaultPrevented };
  });
  assert.equal(ime.isComposing, true, 'IME fixture did not create a composing keyboard event');
  await page.waitForTimeout(80);
  await assertSearchClosed(page, 'IME Ctrl+K');
  await page.evaluate(() => document.getElementById('home-contract-editable-host')?.remove());
}

async function assertBackToTopThreshold(page) {
  const control = page.locator('#hScrollTop');
  const inactive = () => page.evaluate(() => {
    const element = document.getElementById('hScrollTop');
    if (!element) return true;
    const style = getComputedStyle(element);
    return element.hidden
      || element.getAttribute('aria-hidden') === 'true'
      || style.display === 'none'
      || style.visibility === 'hidden'
      || Number.parseFloat(style.opacity || '1') < 0.5
      || style.pointerEvents === 'none';
  });

  await page.evaluate(() => window.scrollTo(0, Math.min(900, document.documentElement.scrollHeight - innerHeight)));
  await page.waitForFunction(() => {
    const element = document.getElementById('hScrollTop');
    if (!element) return false;
    const style = getComputedStyle(element);
    return !element.hidden
      && element.getAttribute('aria-hidden') !== 'true'
      && style.display !== 'none'
      && style.visibility !== 'hidden'
      && Number.parseFloat(style.opacity || '1') >= 0.5
      && style.pointerEvents !== 'none';
  });
  assert.equal(await inactive(), false, 'back-to-top did not become active above its threshold');

  await control.click();
  await page.waitForFunction(() => Math.round(window.scrollY) === 0);
  await page.waitForFunction(() => {
    const element = document.getElementById('hScrollTop');
    if (!element) return false;
    const style = getComputedStyle(element);
    return element.hidden
      || element.getAttribute('aria-hidden') === 'true'
      || style.display === 'none'
      || style.visibility === 'hidden'
      || Number.parseFloat(style.opacity || '1') < 0.5
      || style.pointerEvents === 'none';
  });
  assert.equal(await inactive(), true, 'back-to-top remained active below its threshold');
}

async function runBrowser(browserName, browserType, baseUrl) {
  const launchOptions = { headless: false };
  if (browserName === 'chromium') {
    launchOptions.ignoreDefaultArgs = ['--disable-back-forward-cache'];
  }
  const browser = await browserType.launch(launchOptions);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
    locale: 'ru-RU',
  });
  await installLifecycleProbe(context);
  const page = await context.newPage();
  const runtimeErrors = [];
  const ignoredDiagnostics = [];
  const navigationState = { allowPagefindAbort: false };
  const expectedNavigationAborts = new WeakSet();
  const pagefindState = {
    bootstrapActive: false,
    headAbortCount: 0,
    headResponseCount: 0,
    moduleLoadCount: 0,
    successfulHeadResponses: new WeakSet(),
  };
  page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (isKnownBrowserDiagnostic(browserName, text)) ignoredDiagnostics.push(text);
    else runtimeErrors.push(`console: ${text}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) runtimeErrors.push(`HTTP ${response.status()} ${response.url()}`);
  });
  page.on('request', (request) => {
    if (navigationState.allowPagefindAbort && isExpectedPagefindRequest(request, baseUrl)) {
      expectedNavigationAborts.add(request);
    }
  });
  const observeRuntimeFailure = (request) => {
    const diagnostic = `requestfailed: ${request.url()} — ${request.failure()?.errorText || 'unknown'}`;
    if (isKnownNavigationAbort(request, expectedNavigationAborts)) ignoredDiagnostics.push(diagnostic);
    else runtimeErrors.push(diagnostic);
  };
  const observePagefindFailure = (request) => {
    const knownNavigationAbort = isKnownNavigationAbort(request, expectedNavigationAborts);
    if (knownNavigationAbort) {
      ignoredDiagnostics.push(`requestfailed: ${request.url()} — ${request.failure()?.errorText || 'unknown'}`);
      return;
    }
    const knownSuccessfulHeadAbort = isKnownSuccessfulPagefindHeadAbort(
      browserName,
      request,
      baseUrl,
      pagefindState,
    );
    if (knownSuccessfulHeadAbort) {
      pagefindState.headAbortCount += 1;
      ignoredDiagnostics.push(`requestfailed: ${request.method()} ${request.url()} — ${request.failure()?.errorText || 'unknown'} (${request.resourceType()})`);
      return;
    }
    runtimeErrors.push(`requestfailed: ${request.url()} — ${request.failure()?.errorText || 'unknown'}`);
  };
  page.on('requestfailed', observeRuntimeFailure);

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#hMobileMenuBtn');
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);

    const lifecycle = await assertRealHistoryRestore(page, baseUrl, navigationState);
    page.off('requestfailed', observeRuntimeFailure);
    page.on('requestfailed', observePagefindFailure);
    try {
      await assertCanonicalShortcut(page, 'Meta+K', 'canonical Meta+K', baseUrl, pagefindState);
    } finally {
      page.off('requestfailed', observePagefindFailure);
      page.on('requestfailed', observeRuntimeFailure);
    }
    await assertEditableShortcutIsolation(page);
    await assertBackToTopThreshold(page);

    assert.equal(pagefindState.headResponseCount, 1, 'Pagefind bootstrap did not receive exactly one successful HEAD response');
    assert.equal(pagefindState.moduleLoadCount, 1, 'Pagefind bootstrap did not finish exactly one module GET');
    assert.ok(pagefindState.headAbortCount <= 1, 'Pagefind bootstrap emitted duplicate successful HEAD aborts');
    assert.deepEqual(runtimeErrors, [], `runtime errors: ${runtimeErrors.join(' | ')}`);
    return {
      browser: browserName,
      result: 'PASS',
      lifecycle,
      pagefind: {
        headAborts: pagefindState.headAbortCount,
        headResponses: pagefindState.headResponseCount,
        moduleLoads: pagefindState.moduleLoadCount,
      },
      ignoredDiagnostics,
    };
  } catch (error) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(REPORT_DIR, `${browserName}-failure.png`), fullPage: true }).catch(() => {});
    throw error;
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
      results.push(await runBrowser(browserName, browserType, server.baseUrl));
    }
    fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify({ result: 'PASS', results }, null, 2)}\n`);
    console.log(`Home browser lifecycle contract: PASS (${results.length} browsers)`);
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
