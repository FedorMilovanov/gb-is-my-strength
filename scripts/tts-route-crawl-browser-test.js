#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const REPORTS = path.join(ROOT, 'reports');
fs.mkdirSync(REPORTS, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2', '.bin': 'application/octet-stream',
};
const PLAY_SELECTOR = '[data-fc-action="play"]:visible, .gb-ember:visible, [data-tts-action="play"]:visible, #gbxTtsPlay:visible, .gbx-tts button:visible';

function walk(dir, output) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, output);
    else if (entry.isFile() && entry.name === 'index.html') output.push(full);
  }
}

function routeFromFile(file) {
  const relative = path.relative(DIST, file).split(path.sep).join('/');
  return relative === 'index.html' ? '/' : '/' + relative.replace(/index\.html$/, '');
}

function discoverCandidateRoutes() {
  const files = [];
  walk(DIST, files);
  const marker = /data-fc-action=["']play|\bgb-ember\b|data-fc-root|data-gbs2-theme|floating-cluster-controller\.js|\bgbx-tts\b/i;
  return files
    .filter((file) => marker.test(fs.readFileSync(file, 'utf8')))
    .map(routeFromFile)
    .sort();
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let pathname = decodeURIComponent((req.url || '/').split('?')[0]);
      let target = path.join(DIST, pathname.replace(/^\/+/, ''));
      if (pathname.endsWith('/')) target = path.join(target, 'index.html');
      if (!path.extname(target)) target = path.join(target, 'index.html');
      if (!target.startsWith(DIST) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(target).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: 'http://127.0.0.1:' + server.address().port }));
  });
}

async function installFixture(context) {
  await context.addInitScript(() => {
    try { localStorage.setItem('gbx-vosk-warmup', 'off'); } catch (_) {}
    window.__ttsCrawl = { speaks: 0, cancels: 0, lastText: '', pageErrors: [] };
    function FakeUtterance(text) {
      this.text = String(text || '');
      this.rate = 1;
      this.lang = 'ru-RU';
      this.onboundary = null;
      this.onend = null;
      this.onerror = null;
    }
    const speech = {
      getVoices: () => [{ name: 'Fixture Russian', lang: 'ru-RU', localService: true }],
      speak: (utterance) => {
        window.__ttsCrawl.speaks += 1;
        window.__ttsCrawl.lastText = utterance.text;
        window.__ttsCrawl.active = utterance;
      },
      cancel: () => {
        window.__ttsCrawl.cancels += 1;
        window.__ttsCrawl.active = null;
      },
      pause: () => {}, resume: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
    };
    try { Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance }); } catch (_) { window.SpeechSynthesisUtterance = FakeUtterance; }
    try { Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: speech }); } catch (_) { window.speechSynthesis = speech; }
  });
}

async function inspectRoute(page, origin, route, viewportName, screenshotBudget) {
  const consoleErrors = [];
  const pageErrors = [];
  const onConsole = (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); };
  const onPageError = (error) => pageErrors.push(error.message || String(error));
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  const result = { route, viewport: viewportName, status: 'unknown', consoleErrors, pageErrors };
  try {
    await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(250);
    const inventory = await page.evaluate(() => {
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
      };
      const all = Array.from(document.querySelectorAll('[data-fc-action="play"], .gb-ember, [data-tts-action="play"], #gbxTtsPlay, .gbx-tts button'));
      return {
        visiblePlayCount: all.filter(visible).length,
        totalPlayCount: all.length,
        fcRoots: document.querySelectorAll('[data-fc-root]').length,
        visibleFcRoots: Array.from(document.querySelectorAll('[data-fc-root]')).filter(visible).length,
        clusterOwner: !!window.__gbCluster,
        legacyOverlay: !!document.querySelector('.gbx-tts'),
      };
    });
    Object.assign(result, inventory);
    if (!inventory.visiblePlayCount) {
      result.status = 'no-visible-play';
      return result;
    }

    const play = page.locator(PLAY_SELECTOR).first();
    const before = await page.evaluate(() => ({ speaks: window.__ttsCrawl.speaks, cancels: window.__ttsCrawl.cancels }));
    await play.click({ timeout: 5000 });
    await page.waitForFunction((count) => window.__ttsCrawl.speaks > count, before.speaks, { timeout: 5000 });
    const afterStart = await page.evaluate((selector) => {
      const button = document.querySelector(selector);
      return {
        state: button && button.getAttribute('data-state'),
        speaks: window.__ttsCrawl.speaks,
        cancels: window.__ttsCrawl.cancels,
        textLength: window.__ttsCrawl.lastText.length,
      };
    }, '[data-fc-action="play"], .gb-ember, [data-tts-action="play"], #gbxTtsPlay, .gbx-tts button');
    result.afterStart = afterStart;

    await play.click({ timeout: 5000 });
    await page.waitForTimeout(100);
    result.afterPause = await play.getAttribute('data-state');

    await play.click({ timeout: 5000 });
    await page.waitForTimeout(100);
    result.afterResume = await play.getAttribute('data-state');

    const cancelBeforePagehide = await page.evaluate(() => window.__ttsCrawl.cancels);
    await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    await page.waitForTimeout(80);
    result.pagehideCancelDelta = await page.evaluate((beforeCount) => window.__ttsCrawl.cancels - beforeCount, cancelBeforePagehide);

    const stateProblems = [];
    if (afterStart.textLength < 2) stateProblems.push('empty-speech-text');
    if (afterStart.state && afterStart.state !== 'playing') stateProblems.push('start-state-' + afterStart.state);
    if (result.afterPause && result.afterPause !== 'paused') stateProblems.push('pause-state-' + result.afterPause);
    if (result.afterResume && result.afterResume !== 'playing') stateProblems.push('resume-state-' + result.afterResume);
    if (result.pagehideCancelDelta < 1) stateProblems.push('pagehide-not-cancelled');
    result.problems = stateProblems;
    result.status = stateProblems.length ? 'product-finding' : 'pass';
    if (stateProblems.length && screenshotBudget.remaining > 0) {
      screenshotBudget.remaining -= 1;
      const safe = (viewportName + '-' + route).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 120);
      await page.screenshot({ path: path.join(REPORTS, 'tts-crawl-' + safe + '.png'), fullPage: false });
    }
    return result;
  } catch (error) {
    result.status = 'harness-or-route-error';
    result.error = error.message;
    if (screenshotBudget.remaining > 0) {
      screenshotBudget.remaining -= 1;
      const safe = (viewportName + '-' + route).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 120);
      await page.screenshot({ path: path.join(REPORTS, 'tts-crawl-' + safe + '.png'), fullPage: false }).catch(() => {});
    }
    return result;
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  }
}

async function runViewport(browser, origin, routes, viewportName, viewport) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width <= 430, hasTouch: viewport.width <= 430 });
  await installFixture(context);
  const page = await context.newPage();
  const screenshotBudget = { remaining: 20 };
  const results = [];
  try {
    for (const route of routes) {
      const result = await inspectRoute(page, origin, route, viewportName, screenshotBudget);
      results.push(result);
      console.log('[TTS-ROUTE-CRAWL]', viewportName, route, JSON.stringify({ status: result.status, problems: result.problems || [], visiblePlayCount: result.visiblePlayCount, fcRoots: result.fcRoots, visibleFcRoots: result.visibleFcRoots, clusterOwner: result.clusterOwner, legacyOverlay: result.legacyOverlay, error: result.error || null }));
    }
  } finally {
    await context.close();
  }
  return results;
}

(async () => {
  const routes = discoverCandidateRoutes();
  assert.ok(routes.length > 0, 'no TTS candidate routes were discovered in production-like dist');
  const { server, origin } = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const desktop = await runViewport(browser, origin, routes, 'desktop-1440', { width: 1440, height: 900 });
    const mobile = await runViewport(browser, origin, routes, 'mobile-390', { width: 390, height: 844 });
    const report = { routes, desktop, mobile };
    fs.writeFileSync(path.join(REPORTS, 'tts-route-crawl.json'), JSON.stringify(report, null, 2));

    const all = desktop.concat(mobile);
    const summary = {
      candidateRoutes: routes.length,
      checks: all.length,
      pass: all.filter((item) => item.status === 'pass').length,
      productFindings: all.filter((item) => item.status === 'product-finding').length,
      noVisiblePlay: all.filter((item) => item.status === 'no-visible-play').length,
      routeErrors: all.filter((item) => item.status === 'harness-or-route-error').length,
      pagehideFailures: all.filter((item) => (item.problems || []).includes('pagehide-not-cancelled')).length,
      consoleErrorChecks: all.filter((item) => item.consoleErrors && item.consoleErrors.length).length,
      pageErrorChecks: all.filter((item) => item.pageErrors && item.pageErrors.length).length,
    };
    assert.ok(all.some((item) => item.afterStart && item.afterStart.speaks > 0), 'crawler did not start speech on any route');
    console.log('[TTS-ROUTE-CRAWL-SUMMARY]', JSON.stringify(summary));
    console.log('TTS production-like route crawl: PASS (inventory and diagnostic findings recorded; product findings remain non-blocking in audit-only PR).');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
