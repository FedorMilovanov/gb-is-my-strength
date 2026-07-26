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
const PRODUCTION_MANIFEST_URL = 'https://gospod-bog.ru/manifest.json';
const PRODUCTION_YANDEX_METRIKA_PIXEL_URL = 'https://mc.yandex.ru/watch/108353327';
const PRODUCTION_YANDEX_METRIKA_PIXEL_FALLBACK_URL = 'https://mc.yandex.com/watch/108353327';
const LOCAL_YANDEX_METRIKA_PIXEL_PATH = '/__fixtures/yandex-metrika-pixel.gif';
const YANDEX_METRIKA_TAG = /^https:\/\/mc\.yandex\.ru\/metrika\/tag\.js\?id=108353327(?:&|$)/;
const YANDEX_METRIKA_PIXEL = /^https:\/\/mc\.yandex\.(?:ru|com)\/watch\/108353327(?:\?|$)/;
const TRANSPARENT_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
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

  const fixtureRequests = [];
  const server = http.createServer((request, response) => {
    try {
      const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
      response.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
      if (requestUrl.pathname === LOCAL_YANDEX_METRIKA_PIXEL_PATH) {
        fixtureRequests.push({
          fixture: 'yandex-metrika-pixel',
          method: request.method || 'GET',
          path: requestUrl.pathname,
        });
        response.setHeader('Content-Type', 'image/gif');
        response.end(TRANSPARENT_GIF);
        return;
      }
      const filePath = resolveRequestPath(request.url);
      if (!filePath) {
        response.statusCode = 404;
        response.end('Not found');
        return;
      }
      response.setHeader('Content-Type', contentType(filePath));
      if (path.extname(filePath).toLowerCase() === '.html') {
        // Absolute production resources that are same-origin on gospod-bog.ru
        // must remain same-origin in the 127.0.0.1 acceptance harness. Rewrite
        // only the web-app manifest and the exact Yandex counter-pixel URLs;
        // canonical/OG/JSON-LD metadata stays byte-identical to the build.
        const html = fs.readFileSync(filePath, 'utf8')
          .replaceAll(PRODUCTION_MANIFEST_URL, '/manifest.json')
          .replaceAll(PRODUCTION_YANDEX_METRIKA_PIXEL_URL, LOCAL_YANDEX_METRIKA_PIXEL_PATH)
          .replaceAll(PRODUCTION_YANDEX_METRIKA_PIXEL_FALLBACK_URL, LOCAL_YANDEX_METRIKA_PIXEL_PATH);
        response.end(html);
        return;
      }
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
    fixtureRequests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function isKnownBrowserDiagnostic(browserName, text) {
  return browserName === 'webkit'
    && text === 'Viewport argument key "interactive-widget" not recognized and ignored.';
}

function isExpectedYandexCounterPixelCancellation(request) {
  if (request.method() !== 'GET') return false;
  const errorText = request.failure()?.errorText || '';
  if (!['Load request cancelled', 'net::ERR_ABORTED'].includes(errorText)) return false;
  return YANDEX_METRIKA_PIXEL.test(request.url());
}

async function installExternalServiceFixtures(context, fixtures) {
  await context.route(YANDEX_METRIKA_TAG, async (route) => {
    const request = route.request();
    fixtures.push({
      service: 'yandex-metrika-tag',
      method: request.method(),
      resourceType: request.resourceType(),
      url: request.url(),
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: 'window.ym = function () {};',
    });
  });
  await context.route(YANDEX_METRIKA_PIXEL, async (route) => {
    const request = route.request();
    fixtures.push({
      service: 'yandex-metrika-pixel',
      method: request.method(),
      resourceType: request.resourceType(),
      url: request.url(),
    });
    await route.fulfill({
      status: 200,
      contentType: 'image/gif',
      body: TRANSPARENT_GIF,
    });
  });
}

async function assertLocalManifest(page, baseUrl, label) {
  const manifests = page.locator('link[rel="manifest"]');
  assert.equal(await manifests.count(), 1, `${label}: expected exactly one web-app manifest`);
  const href = await manifests.first().getAttribute('href');
  assert.ok(href, `${label}: web-app manifest href is missing`);
  const resolved = new URL(href, page.url());
  assert.equal(resolved.origin, baseUrl, `${label}: production manifest was not mapped to the local acceptance origin`);
  assert.equal(resolved.pathname, '/manifest.json', `${label}: unexpected web-app manifest path`);
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
    window.__gbHomeLifecycleDocumentToken ||= `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.addEventListener('pageshow', (event) => append({
      type: 'pageshow',
      path: location.pathname,
      persisted: event.persisted,
      documentToken: window.__gbHomeLifecycleDocumentToken,
    }));
    window.addEventListener('pagehide', (event) => append({
      type: 'pagehide',
      path: location.pathname,
      persisted: event.persisted,
      documentToken: window.__gbHomeLifecycleDocumentToken,
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

async function assertRealHistoryRestore(page, baseUrl, navigationState, browserName) {
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
    // Preserve the anchor's same-context default action while isolating this
    // lifecycle fixture from the product's cross-document View Transition.
    link.addEventListener('click', (event) => event.stopPropagation(), { once: true });
    document.body.appendChild(link);
  });
  navigationState.allowPagefindAbort = true;
  try {
    await Promise.all([
      page.waitForURL(`${baseUrl}/about/`),
      page.locator('#home-contract-history-target').click(),
    ]);
    await page.locator('#main-content').waitFor({ state: 'visible' });
    await assertLocalManifest(page, baseUrl, 'history destination');
  } finally {
    navigationState.allowPagefindAbort = false;
  }

  // A BFCache restore does not fire DOMContentLoaded again. Wait only for the
  // navigation commit, then assert the restored URL, DOM and persisted events.
  await page.goBack({ waitUntil: 'commit' });
  await page.waitForSelector('#hMobileMenuBtn');
  // WebKit may expose the restored DOM before dispatching pageshow. Wait for
  // the actual lifecycle evidence rather than sleeping or assuming selector
  // readiness implies that the history traversal event already fired.
  await page.waitForFunction((storageKey) => {
    try {
      const events = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
      return Array.isArray(events)
        && events.some((entry) => entry.type === 'pageshow' && entry.path === '/');
    } catch {
      return false;
    }
  }, LIFECYCLE_KEY);
  await assertLocalManifest(page, baseUrl, 'restored homepage');
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
  assert.equal(typeof homePageHide?.persisted, 'boolean', `home page did not emit pagehide evidence: ${diagnostic}`);
  assert.equal(typeof homePageShow?.persisted, 'boolean', `home page did not emit pageshow evidence: ${diagnostic}`);
  assert.equal(homePageHide.persisted, homePageShow.persisted, `history restoration reported an incoherent persisted pair: ${diagnostic}`);

  assert.equal(typeof homePageHide.documentToken, 'string', `home pagehide did not record a document token: ${diagnostic}`);
  assert.equal(typeof homePageShow.documentToken, 'string', `home pageshow did not record a document token: ${diagnostic}`);

  const usesBFCache = homePageHide.persisted === true;
  if (usesBFCache) {
    assert.equal(homePageShow.documentToken, homePageHide.documentToken, `BFCache restoration replaced the home document: ${diagnostic}`);
  } else {
    assert.notEqual(homePageShow.documentToken, homePageHide.documentToken, `history reload unexpectedly reused the original home document: ${diagnostic}`);
  }

  if (browserName === 'chromium') {
    // Chromium is launched without Playwright's --disable-back-forward-cache
    // default argument, so this remains the strict real-BFCache witness.
    assert.equal(usesBFCache, true, `Chromium home page was not restored from BFCache: ${diagnostic}`);
  } else {
    assert.equal(browserName, 'webkit', `unsupported restoration capability contract: ${browserName}`);
    if (!usesBFCache) {
      // Playwright WebKit does not admit even a minimal two-page control to
      // BFCache on Linux or macOS (headed/headless, ephemeral/persistent,
      // cacheable/revalidate/no cache header). Do not mislabel a truthful
      // back/forward reload as BFCache; require the browser's explicit history
      // traversal signal and keep all product state/runtime checks blocking.
      assert.equal(evidence.navigationType, 'back_forward', `WebKit did not complete a coherent back/forward traversal: ${diagnostic}`);
    }
  }

  evidence.restoration = {
    admitted: homePageHide.persisted,
    restored: homePageShow.persisted,
    bfcacheRequired: browserName === 'chromium',
    mode: usesBFCache ? 'bfcache' : 'history-reload',
  };
  assert.deepEqual(evidence.theme, themeBefore, `${browserName} theme state drifted across ${evidence.restoration.mode} restoration`);

  await menuButton.click();
  await waitForMenuState(page, true);
  await page.keyboard.press('Escape');
  await waitForMenuState(page, false);
  await assertScrollUnlocked(page, `${browserName} post-${evidence.restoration.mode} menu close`);

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
  const externalServiceFixtures = [];
  await installExternalServiceFixtures(context, externalServiceFixtures);
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
  const recordExpectedExternalCancellation = (request, diagnostic) => {
    if (!isExpectedYandexCounterPixelCancellation(request)) return false;
    externalServiceFixtures.push({
      service: 'yandex-metrika-counter-pixel-cancelled',
      method: request.method(),
      resourceType: request.resourceType(),
      url: request.url(),
      failure: request.failure()?.errorText || null,
    });
    ignoredDiagnostics.push(diagnostic);
    return true;
  };
  const observeRuntimeFailure = (request) => {
    const diagnostic = `requestfailed: ${request.url()} — ${request.failure()?.errorText || 'unknown'}`;
    if (recordExpectedExternalCancellation(request, diagnostic)) return;
    if (isKnownNavigationAbort(request, expectedNavigationAborts)) ignoredDiagnostics.push(diagnostic);
    else runtimeErrors.push(diagnostic);
  };
  const observePagefindFailure = (request) => {
    const diagnostic = `requestfailed: ${request.url()} — ${request.failure()?.errorText || 'unknown'}`;
    if (recordExpectedExternalCancellation(request, diagnostic)) return;
    const knownNavigationAbort = isKnownNavigationAbort(request, expectedNavigationAborts);
    if (knownNavigationAbort) {
      ignoredDiagnostics.push(diagnostic);
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
    await assertLocalManifest(page, baseUrl, 'initial homepage');
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);

    const lifecycle = await assertRealHistoryRestore(page, baseUrl, navigationState, browserName);
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
    assert.ok(
      externalServiceFixtures.some((fixture) => fixture.service === 'yandex-metrika-tag' && fixture.resourceType === 'script'),
      'Yandex Metrika test fixture did not intercept the exact third-party tag script',
    );
    const cancelledCounterPixels = externalServiceFixtures.filter(
      (fixture) => fixture.service === 'yandex-metrika-counter-pixel-cancelled',
    );
    assert.ok(
      cancelledCounterPixels.length <= 2,
      `Yandex counter pixel emitted duplicate cancellations (${cancelledCounterPixels.length})`,
    );
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
      externalServiceFixtures,
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
    fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify({ result: 'PASS', results, serverFixtures: server.fixtureRequests }, null, 2)}\n`);
    console.log(`Home browser lifecycle contract: PASS (${results.length} browsers)`);
  } catch (error) {
    fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify({ result: 'FAIL', results, serverFixtures: server.fixtureRequests, error: error.stack || error.message }, null, 2)}\n`);
    throw error;
  } finally {
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
