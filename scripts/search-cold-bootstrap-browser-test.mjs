#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const ROOT = path.resolve(process.cwd());
const DIST = path.join(ROOT, 'dist');
const REPORT_DIR = path.join(ROOT, 'reports', 'search-cold-bootstrap');
const PRODUCTION_MANIFEST_URL = 'https://gospod-bog.ru/manifest.json';
const BROWSERS = { chromium, webkit };
const browserNames = String(process.env.SEARCH_BOOTSTRAP_BROWSERS || 'chromium,webkit')
  .split(',').map((value) => value.trim()).filter(Boolean);
const routes = ['/', '/articles/', '/biografii/', '/pastor-series/', '/hard-texts/'];
const viewports = [{ width: 390, height: 844 }, { width: 1366, height: 900 }];
const writerPattern = /window\.__gbSearch(?:Loading|BootRequested|OpenAfterLoad|LoadState)\s*(?:=|\|\|=)/;
let currentCase = 'source setup';
const completedResults = [];

function emitGithubFailureAnnotation(error) {
  if (process.env.GITHUB_ACTIONS !== 'true') return;
  const detail = [currentCase, error?.name || 'Error', error?.message || String(error),
    ...String(error?.stack || '').split('\n').slice(1, 5)].join(' | ').slice(0, 5000);
  const escaped = detail.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  process.stdout.write(`::error title=Search cold-bootstrap failure::${escaped}\n`);
}

function assertSingleWriterBoundary() {
  const roots = ['src/components', 'src/layouts', 'src/pages'];
  const canonicalOwner = 'src/components/reader-platform/ReaderPreferencesHead.astro';
  const offenders = [];
  const owners = [];
  for (const root of roots) {
    const pending = [path.join(ROOT, root)];
    while (pending.length) {
      const current = pending.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const target = path.join(current, entry.name);
        if (entry.isDirectory()) pending.push(target);
        else if (/\.(?:astro|js|ts|mjs)$/.test(entry.name) && writerPattern.test(fs.readFileSync(target, 'utf8'))) {
          const relative = path.relative(ROOT, target).replace(/\\/g, '/');
          if (relative === canonicalOwner) owners.push(relative);
          else offenders.push(relative);
        }
      }
    }
  }
  assert.deepEqual(offenders, [], `search bootstrap state has non-owner writers: ${offenders.join(', ')}`);
  assert.deepEqual(owners, [canonicalOwner], 'ReaderPreferencesHead must remain the sole shared bootstrap state owner');
}

function contentType(filePath) {
  return {
    '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.woff2': 'font/woff2',
  }[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
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
  for (const route of routes) assert.ok(resolveRequestPath(route), `built route missing: ${route}`);
  const server = http.createServer((request, response) => {
    try {
      if (request.method === 'HEAD') {
        const filePath = resolveRequestPath(request.url);
        response.statusCode = filePath ? 200 : 404;
        response.end();
        return;
      }
      const filePath = resolveRequestPath(request.url);
      if (!filePath) { response.statusCode = 404; response.end('Not found'); return; }
      response.setHeader('Cache-Control', path.extname(filePath) === '.html' ? 'no-store' : 'public, max-age=3600');
      response.setHeader('Content-Type', contentType(filePath));
      if (path.extname(filePath).toLowerCase() === '.html') {
        // The built site points at the production-origin manifest. Keep that
        // same-origin relationship inside this localhost browser harness.
        const html = fs.readFileSync(filePath, 'utf8').replaceAll(PRODUCTION_MANIFEST_URL, '/manifest.json');
        response.end(html);
        return;
      }
      fs.createReadStream(filePath).pipe(response);
    } catch (error) {
      response.statusCode = 400;
      response.end(String(error?.message || error));
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

async function auditAxe(page) {
  const axePath = process.env.SEARCH_BOOTSTRAP_AXE_PATH;
  if (!axePath) return { skipped: true, reason: 'SEARCH_BOOTSTRAP_AXE_PATH is unset' };
  await page.addScriptTag({ path: axePath });
  const result = await page.evaluate(async () => window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  }));
  return {
    violations: result.violations.map((item) => ({
      id: item.id,
      impact: item.impact,
      nodes: item.nodes.map((node) => ({ target: node.target, failureSummary: node.failureSummary })),
      help: item.help,
    })),
    passes: result.passes.length,
    incomplete: result.incomplete.length,
  };
}

function assertCleanBrowserDiagnostics(browserName, route, consoleErrors, failedResponses) {
  const isExpectedWebKitViewportWarning = ({ text }) => (
    browserName === 'webkit' && text === 'Viewport argument key "interactive-widget" not recognized and ignored.'
  );
  const engineWarnings = consoleErrors.filter(isExpectedWebKitViewportWarning);
  const unexpectedConsoleErrors = consoleErrors.filter((entry) => !isExpectedWebKitViewportWarning(entry) && !(
    entry.url === 'https://mc.yandex.ru/metrika/tag.js?id=108353327' && /net::ERR_CONNECTION_CLOSED/.test(entry.text)
  ));
  assert.deepEqual(unexpectedConsoleErrors, [], `${browserName} ${route}: unexpected browser console errors`);
  assert.deepEqual(failedResponses, [], `${browserName} ${route}: failed local or reachable HTTP responses`);
  return { consoleErrors: unexpectedConsoleErrors, engineWarnings };
}

function contextOptions(viewport, options = {}) {
  const mobile = viewport.width < 500;
  return {
    viewport,
    colorScheme: options.colorScheme || 'light',
    reducedMotion: options.reducedMotion || 'no-preference',
    ...(mobile ? { isMobile: true, hasTouch: true } : {}),
  };
}

async function runColdAndWarmCase(browser, browserName, baseUrl, route, viewport) {
  const context = await browser.newContext(contextOptions(viewport));
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const failedResponses = [];
  const searchRequests = [];
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push({ text: message.text(), url: message.location().url || '' }); });
  page.on('response', (response) => { if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() }); });
  page.on('request', (request) => {
    if (/\/js\/search\.js(?:\?|$)/.test(request.url())) searchRequests.push(request.url());
  });

  try {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    assert.ok(response?.ok(), `${browserName} ${route} ${viewport.width}: route did not load`);

    const triggerSelector = route === '/hard-texts/' ? '.mcp-search' : '#gbSearchBtn';
    const trigger = page.locator(triggerSelector);
    await trigger.waitFor({ state: route === '/hard-texts/' ? 'attached' : 'visible' });
    const cold = await page.evaluate((selector) => ({
      triggerFocusable: document.querySelector(selector)?.tabIndex === 0,
      bootstrapPhase: window.GBSearchBootstrap?.getState().phase,
      bootstrapCopies: document.querySelectorAll('script[data-gb-search-bootstrap]').length,
      ready: window.GBSearch?.__ready === true,
      paletteExists: Boolean(document.querySelector('.cp-backdrop')),
    }), triggerSelector);
    assert.equal(cold.bootstrapPhase, 'idle', `${browserName} ${route}: shared bootstrap should be idle before interaction`);
    assert.equal(cold.bootstrapCopies, 1, `${browserName} ${route}: shared bootstrap must have one DOM owner`);
    assert.equal(cold.ready, false, `${browserName} ${route}: full search runtime was eagerly ready before interaction`);
    assert.equal(cold.paletteExists, false, `${browserName} ${route}: palette existed before cold interaction`);
    assert.equal(cold.triggerFocusable, true, `${browserName} ${route}: search opener is not keyboard-focusable`);
    assert.equal(searchRequests.length, 0, `${browserName} ${route}: search runtime requested before cold interaction`);

    await page.keyboard.press('Control+K');
    await page.locator('.cp-backdrop.is-open').waitFor({ state: 'visible' });
    await page.waitForFunction(() => window.GBSearch?.__ready === true);
    const opened = await page.evaluate(() => ({
      phase: window.GBSearchBootstrap?.getState().phase,
      pendingOpen: window.GBSearchBootstrap?.getState().pendingOpen,
      activeClass: document.activeElement?.className || '',
    }));
    assert.equal(opened.phase, 'ready', `${browserName} ${route}: shortcut did not settle shared loader state`);
    assert.equal(opened.pendingOpen, false, `${browserName} ${route}: open request remained pending after readiness`);
    assert.ok(String(opened.activeClass).includes('cp-input'), `${browserName} ${route}: Ctrl+K did not focus search input`);
    assert.equal(searchRequests.length, 1, `${browserName} ${route}: cold shortcut should request search runtime once`);

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.cp-backdrop')?.classList.contains('is-open'));
    const afterEscape = await page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      id: document.activeElement?.id,
      className: document.activeElement?.className || '',
    }));
    assert.ok(!String(afterEscape.className).includes('cp-input'), `${browserName} ${route}: Escape left focus inside the closed palette`);

    if (route === '/hard-texts/' && viewport.width < 500) {
      await page.mouse.wheel(0, 420);
      await trigger.waitFor({ state: 'visible' });
    }
    let enterOpen;
    if (await trigger.isVisible()) {
      await trigger.focus();
      assert.equal(await trigger.evaluate((element) => element === document.activeElement), true,
        `${browserName} ${route}: visible search trigger could not receive focus before Enter`);
      await page.keyboard.press('Enter');
      try {
        await page.locator('.cp-backdrop.is-open').waitFor({ state: 'visible', timeout: 5000 });
        await page.waitForFunction(() => document.activeElement?.classList.contains('cp-input'), null, { timeout: 5000 });
      } catch (error) {
        const failure = await page.evaluate(() => ({
          activeTag: document.activeElement?.tagName,
          activeId: document.activeElement?.id,
          activeClass: document.activeElement?.className || '',
          bootstrap: window.GBSearchBootstrap?.getState(),
          ready: window.GBSearch?.__ready === true,
          open: document.querySelector('.cp-backdrop')?.classList.contains('is-open') === true,
        }));
        throw new Error(`${browserName} ${route} ${viewport.width}: Enter activation failed ${JSON.stringify(failure)}: ${error.message}`);
      }
      enterOpen = await page.evaluate(() => ({
        phase: window.GBSearchBootstrap?.getState().phase,
        pendingOpen: window.GBSearchBootstrap?.getState().pendingOpen,
        activeClass: document.activeElement?.className || '',
      }));
      assert.equal(enterOpen.phase, 'ready', `${browserName} ${route}: Enter did not reuse the ready bootstrap`);
      assert.equal(enterOpen.pendingOpen, false, `${browserName} ${route}: Enter left an open request pending`);
      assert.ok(String(enterOpen.activeClass).includes('cp-input'), `${browserName} ${route}: Enter did not focus search input`);
      assert.equal(searchRequests.length, 1, `${browserName} ${route}: Enter fetched search runtime again`);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.cp-backdrop')?.classList.contains('is-open'));
    } else {
      assert.equal(route, '/hard-texts/', `${browserName} ${route}: unexpectedly missing a visible opener for Enter coverage`);
      assert.ok(viewport.width >= 500, `${browserName} /hard-texts/: mobile Search opener must remain visible for Enter coverage`);
      enterOpen = { skipped: 'HardTexts has no visible Search trigger at desktop width' };
    }

    await page.keyboard.press('Control+K');
    try {
      await page.locator('.cp-backdrop.is-open').waitFor({ state: 'visible', timeout: 5000 });
      await page.waitForFunction(() => document.activeElement?.classList.contains('cp-input'), null, { timeout: 5000 });
    } catch (error) {
      const failure = await page.evaluate(() => ({
        activeTag: document.activeElement?.tagName,
        activeId: document.activeElement?.id,
        activeClass: document.activeElement?.className || '',
        open: document.querySelector('.cp-backdrop')?.classList.contains('is-open') === true,
        bootstrap: window.GBSearchBootstrap?.getState(),
        ready: window.GBSearch?.__ready === true,
      }));
      throw new Error(`${browserName} ${route} ${viewport.width}: warm Ctrl+K failed after Escape ${JSON.stringify({ afterEscape, failure })}: ${error.message}`);
    }
    const warmShortcut = await page.evaluate(() => ({
      phase: window.GBSearchBootstrap?.getState().phase,
      pendingOpen: window.GBSearchBootstrap?.getState().pendingOpen,
      activeClass: document.activeElement?.className || '',
    }));
    assert.equal(warmShortcut.phase, 'ready', `${browserName} ${route}: warm shortcut did not retain ready state`);
    assert.equal(warmShortcut.pendingOpen, false, `${browserName} ${route}: warm shortcut left an open request pending`);
    assert.ok(String(warmShortcut.activeClass).includes('cp-input'), `${browserName} ${route}: warm Ctrl+K did not focus search input`);
    assert.equal(searchRequests.length, 1, `${browserName} ${route}: warm shortcut fetched search runtime again`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.cp-backdrop')?.classList.contains('is-open'));
    await page.evaluate(() => window.GBSearchBootstrap.open());
    await page.locator('.cp-backdrop.is-open').waitFor({ state: 'visible' });
    assert.equal(searchRequests.length, 1, `${browserName} ${route}: warm API reopen fetched search runtime again`);
    assert.deepEqual(pageErrors, [], `${browserName} ${route}: uncaught page errors`);
    const browserDiagnostics = assertCleanBrowserDiagnostics(browserName, route, consoleErrors, failedResponses);
    return { browser: browserName, route, viewport, cold, opened, afterEscape, enterOpen, warmShortcut, searchRequestCount: searchRequests.length, pageErrors, ...browserDiagnostics, failedResponses };
  } finally {
    await context.close();
  }
}

async function runTouchPreloadRace(browser, browserName, baseUrl) {
  const viewport = { width: 390, height: 844 };
  const context = await browser.newContext(contextOptions(viewport, { colorScheme: 'dark', reducedMotion: 'reduce' }));
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const failedResponses = [];
  const searchRequests = [];
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push({ text: message.text(), url: message.location().url || '' }); });
  page.on('response', (response) => { if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() }); });
  page.on('request', (request) => {
    if (/\/js\/search\.js(?:\?|$)/.test(request.url())) searchRequests.push(request.url());
  });

  try {
    const response = await page.goto(`${baseUrl}/hard-texts/`, { waitUntil: 'networkidle' });
    assert.ok(response?.ok(), `${browserName} /hard-texts/: route did not load`);
    assert.equal(searchRequests.length, 0, `${browserName} /hard-texts/: bootstrap ran before interaction`);
    assert.equal(await page.locator('[data-gb-search-preload-on-interaction]').count(), 1,
      `${browserName} /hard-texts/: declarative first-interaction preloader missing`);

    await page.mouse.wheel(0, 420);
    const trigger = page.locator('.mcp-search');
    await trigger.waitFor({ state: 'visible' });
    await page.evaluate(() => {
      let captured = false;
      const snapshotAfterFirstInput = () => {
        if (captured) return;
        captured = true;
        queueMicrotask(() => {
          window.__gbSearchTouchSnapshot = {
            phase: window.GBSearchBootstrap?.getState().phase,
            ready: window.GBSearch?.__ready === true,
            preloadLinks: document.querySelectorAll('link[data-gb-search-preload]').length,
            runtimeScripts: document.querySelectorAll('script[src*="/js/search.js"]').length,
          };
        });
      };
      for (const eventName of ['pointerdown', 'touchstart']) {
        document.addEventListener(eventName, snapshotAfterFirstInput, { capture: true, once: true });
      }
    });
    await trigger.tap();
    await page.locator('.cp-backdrop.is-open').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForFunction(() => window.GBSearch?.__ready === true);

    const firstTap = await page.evaluate(() => ({
      preloadInterleaving: window.__gbSearchTouchSnapshot || null,
      phase: window.GBSearchBootstrap?.getState().phase,
      pendingOpen: window.GBSearchBootstrap?.getState().pendingOpen,
      paletteOpen: document.querySelector('.cp-backdrop')?.classList.contains('is-open') === true,
      activeClass: document.activeElement?.className || '',
      preloadLinks: document.querySelectorAll('link[data-gb-search-preload]').length,
    }));
    assert.equal(firstTap.preloadInterleaving?.phase, 'idle', `${browserName} /hard-texts/: preload executed runtime before the click`);
    assert.equal(firstTap.preloadInterleaving?.ready, false, `${browserName} /hard-texts/: runtime became ready during preload phase`);
    assert.equal(firstTap.preloadInterleaving?.preloadLinks, 1, `${browserName} /hard-texts/: network-only preload was not observed`);
    assert.equal(firstTap.preloadInterleaving?.runtimeScripts, 0, `${browserName} /hard-texts/: preload inserted executable runtime`);
    assert.equal(firstTap.phase, 'ready', `${browserName} /hard-texts/: first tap did not settle bootstrap`);
    assert.equal(firstTap.pendingOpen, false, `${browserName} /hard-texts/: first tap was stranded pending`);
    assert.equal(firstTap.paletteOpen, true, `${browserName} /hard-texts/: first trusted tap did not open the palette`);
    assert.ok(String(firstTap.activeClass).includes('cp-input'), `${browserName} /hard-texts/: palette input did not receive focus`);
    assert.equal(searchRequests.length, 1, `${browserName} /hard-texts/: preload/open interleaving must execute one search request`);
    const axe = await auditAxe(page);
    await page.screenshot({ path: path.join(REPORT_DIR, 'hard-texts-first-touch-open.png'), fullPage: false });

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.cp-backdrop')?.classList.contains('is-open'));
    await trigger.tap();
    await page.locator('.cp-backdrop.is-open').waitFor({ state: 'visible' });
    assert.equal(searchRequests.length, 1, `${browserName} /hard-texts/: warm touch should reuse the loaded runtime`);
    assert.deepEqual(pageErrors, [], `${browserName} /hard-texts/: uncaught page errors`);
    const browserDiagnostics = assertCleanBrowserDiagnostics(browserName, '/hard-texts/', consoleErrors, failedResponses);
    return { browser: browserName, route: '/hard-texts/', viewport, theme: 'dark', reducedMotion: 'reduce', firstTap, axe, searchRequestCount: searchRequests.length, pageErrors, ...browserDiagnostics, failedResponses };
  } finally {
    await context.close();
  }
}

async function runHomeMenuSearchCase(browser, browserName, baseUrl) {
  const viewport = { width: 390, height: 844 };
  const context = await browser.newContext(contextOptions(viewport, { colorScheme: 'dark', reducedMotion: 'reduce' }));
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const failedResponses = [];
  const searchRequests = [];
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push({ text: message.text(), url: message.location().url || '' }); });
  page.on('response', (response) => { if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() }); });
  page.on('request', (request) => {
    if (/\/js\/search\.js(?:\?|$)/.test(request.url())) searchRequests.push(request.url());
  });

  try {
    const response = await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    assert.ok(response?.ok(), `${browserName} home: route did not load`);
    await page.locator('#hMobileMenuBtn').click();
    await page.locator('#hMobileNav.open').waitFor({ state: 'visible' });
    const searchAction = page.locator('#hMobileNav [data-action="open-search"]');
    await searchAction.click();
    await page.locator('.cp-backdrop.is-open').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForFunction(() => window.GBSearch?.__ready === true);
    await page.screenshot({ path: path.join(REPORT_DIR, 'home-menu-search-open-dark-reduced-mobile.png'), fullPage: false });
    const axe = await auditAxe(page);
    const result = await page.evaluate(() => ({
      menuOpen: document.getElementById('hMobileNav')?.classList.contains('open') === true,
      menuExpanded: document.getElementById('hMobileMenuBtn')?.getAttribute('aria-expanded'),
      activeClass: document.activeElement?.className || '',
      paletteOpen: document.querySelector('.cp-backdrop')?.classList.contains('is-open') === true,
      phase: window.GBSearchBootstrap?.getState().phase,
    }));
    assert.equal(result.menuOpen, false, `${browserName} home: mobile nav stayed open behind search`);
    assert.equal(result.menuExpanded, 'false', `${browserName} home: menu trigger did not settle closed`);
    assert.ok(String(result.activeClass).includes('cp-input'), `${browserName} home: search input did not receive focus`);
    assert.equal(result.paletteOpen, true, `${browserName} home: search did not open from mobile nav`);
    assert.equal(result.phase, 'ready', `${browserName} home: shared bootstrap did not become ready`);
    assert.equal(searchRequests.length, 1, `${browserName} home: mobile-nav open should request search once`);
    assert.deepEqual(pageErrors, [], `${browserName} home: uncaught page errors`);
    const browserDiagnostics = assertCleanBrowserDiagnostics(browserName, '/', consoleErrors, failedResponses);
    return { browser: browserName, route: '/', viewport, theme: 'dark', reducedMotion: 'reduce', result, axe, searchRequestCount: searchRequests.length, pageErrors, ...browserDiagnostics, failedResponses };
  } finally {
    await context.close();
  }
}

async function runFailureRetryCase(browser, browserName, baseUrl) {
  const viewport = { width: 1366, height: 900 };
  const context = await browser.newContext({ ...contextOptions(viewport, { colorScheme: 'dark', reducedMotion: 'reduce' }), serviceWorkers: 'block' });
  const page = await context.newPage();
  const pageErrors = [];
  const failedResponses = [];
  let attempts = 0;
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
  page.on('response', (response) => { if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() }); });
  await page.route('**/*', async (route) => {
    if (!/\/js\/search\.js(?:\?|$)/.test(route.request().url())) return route.continue();
    attempts += 1;
    if (attempts === 1) await route.abort('failed');
    else await route.continue();
  });

  try {
    const response = await page.goto(`${baseUrl}/articles/`, { waitUntil: 'networkidle' });
    assert.ok(response?.ok(), `${browserName} retry route did not load`);
    const trigger = page.locator('#gbSearchBtn');
    await trigger.click();
    await page.waitForFunction(() => window.GBSearchBootstrap?.getState().phase === 'failed', null, { timeout: 8000 }).catch(async (error) => {
      const diagnostic = await page.evaluate(() => ({ bootstrap: window.GBSearchBootstrap?.getState(), bootRequested: window.__gbSearchBootRequested, ready: window.GBSearch?.__ready === true }));
      throw new Error(`${browserName}: failed state was not reached after first open: ${JSON.stringify({ attempts, diagnostic })}; ${error.message}`);
    });
    const failed = await page.evaluate(() => ({
      phase: window.GBSearchBootstrap?.getState().phase,
      pendingOpen: window.GBSearchBootstrap?.getState().pendingOpen,
      bootRequested: window.__gbSearchBootRequested === true,
      paletteOpen: document.querySelector('.cp-backdrop')?.classList.contains('is-open') === true,
    }));
    assert.equal(failed.pendingOpen, false, `${browserName}: failed load left open request pending`);
    assert.equal(failed.bootRequested, false, `${browserName}: failed load left boot latch set`);
    assert.equal(failed.paletteOpen, false, `${browserName}: failed load opened a non-ready palette`);
    assert.equal(attempts, 1, `${browserName}: first runtime request should fail exactly once`);

    await trigger.click();
    await page.locator('.cp-backdrop.is-open').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForFunction(() => window.GBSearch?.__ready === true);
    const recovered = await page.evaluate(() => ({
      phase: window.GBSearchBootstrap?.getState().phase,
      pendingOpen: window.GBSearchBootstrap?.getState().pendingOpen,
    }));
    assert.equal(recovered.phase, 'ready', `${browserName}: retry did not reach ready state`);
    assert.equal(recovered.pendingOpen, false, `${browserName}: retry left pending open set`);
    assert.equal(attempts, 2, `${browserName}: failed bootstrap did not retry once`);
    assert.deepEqual(pageErrors, [], `${browserName}: failed/retry path raised an uncaught error`);
    return { browser: browserName, route: '/articles/', viewport, theme: 'dark', reducedMotion: 'reduce', failed, recovered, attempts, pageErrors, failedResponses };
  } finally {
    await context.close();
  }
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  currentCase = 'negative single-writer guard';
  assertSingleWriterBoundary();
  currentCase = 'production dist availability';
  assert.ok(fs.existsSync(DIST), 'dist missing; build production-like output first');
  const server = await startServer();
  try {
    for (const browserName of browserNames) {
      const browserType = BROWSERS[browserName];
      assert.ok(browserType, `unsupported browser: ${browserName}`);
      const launchOptions = { headless: true };
      if (browserName === 'chromium' && process.env.SEARCH_BOOTSTRAP_CHROMIUM_EXECUTABLE) {
        launchOptions.executablePath = process.env.SEARCH_BOOTSTRAP_CHROMIUM_EXECUTABLE;
      }
      currentCase = `${browserName}: browser launch`;
      const browser = await browserType.launch(launchOptions);
      try {
        for (const viewport of viewports) {
          for (const route of routes) {
            currentCase = `${browserName}: cold/warm ${route} ${viewport.width}x${viewport.height}`;
            completedResults.push(await runColdAndWarmCase(browser, browserName, server.baseUrl, route, viewport));
          }
        }
        currentCase = `${browserName}: HardTexts first-touch preload race`;
        completedResults.push(await runTouchPreloadRace(browser, browserName, server.baseUrl));
        currentCase = `${browserName}: Home mobile menu Search`;
        completedResults.push(await runHomeMenuSearchCase(browser, browserName, server.baseUrl));
        currentCase = `${browserName}: failure and retry`;
        completedResults.push(await runFailureRetryCase(browser, browserName, server.baseUrl));
      } finally { await browser.close(); }
    }
  } finally { await server.close(); }

  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify({ schemaVersion: 2, conclusion: 'success', sha: process.env.SOURCE_SHA || '', browsers: browserNames, routes, viewports, results: completedResults }, null, 2)}\n`);
  console.log(`Search cold-bootstrap browser contract: PASS (${completedResults.length} cases)`);
}

main().catch((error) => {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  emitGithubFailureAnnotation(error);
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify({
    schemaVersion: 2,
    conclusion: 'failure',
    sha: process.env.SOURCE_SHA || '',
    failedCase: currentCase,
    completedResults,
    error: String(error?.stack || error),
  }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
