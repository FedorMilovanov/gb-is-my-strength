#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const ROOT = path.resolve(process.cwd());
const DIST = path.join(ROOT, 'dist');
const REPORT_DIR = path.join(ROOT, 'reports', 'article-capability');
const BROWSERS = { chromium, webkit };
const browserNames = String(process.env.ARTICLE_CAPABILITY_BROWSERS || 'chromium,webkit')
  .split(',').map((value) => value.trim()).filter(Boolean);
const routes = [
  { id: 'antisovetov', path: '/articles/20-antisovetov-pastoru/' },
  { id: 'krajne', path: '/articles/krajne-li-isporcheno-serdce/' },
];
const viewports = [{ width: 390, height: 844 }, { width: 1366, height: 900 }];

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
  for (const route of routes) assert.ok(resolveRequestPath(route.path), `built route missing: ${route.path}`);
  const server = http.createServer((request, response) => {
    try {
      const filePath = resolveRequestPath(request.url);
      response.setHeader('Cache-Control', 'no-store');
      if (!filePath) { response.statusCode = 404; response.end('Not found'); return; }
      response.setHeader('Content-Type', contentType(filePath));
      if (request.method === 'HEAD') { response.statusCode = 200; response.end(); return; }
      fs.createReadStream(filePath).pipe(response);
    } catch (error) {
      response.statusCode = 400;
      response.end(String(error?.message || error));
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

async function exerciseFaq(page, label) {
  const button = page.locator('.faq-accordion__q[data-gb-faq-owner="native-v1"]').first();
  await button.waitFor({ state: 'visible' });
  const before = await button.getAttribute('aria-expanded');
  await button.click();
  const after = await button.getAttribute('aria-expanded');
  assert.notEqual(after, before, `${label}: FAQ click did not toggle aria-expanded`);
  const itemOpen = await button.evaluate((node) => node.closest('.faq-accordion__item')?.classList.contains('is-open') === true);
  assert.equal(itemOpen, after === 'true', `${label}: FAQ visual/open state diverges from aria-expanded`);
  await button.click();
  assert.equal(await button.getAttribute('aria-expanded'), before, `${label}: FAQ second click did not restore state`);
}

async function exerciseHeadingAnchor(page, label) {
  const anchors = page.locator('.heading-anchor[data-gb-heading-anchor-owner="native-v1"]');
  const count = await anchors.count();
  assert.ok(count > 0, `${label}: no owned heading anchors found`);

  let anchor = null;
  const diagnostics = [];
  for (let index = 0; index < count; index += 1) {
    const candidate = anchors.nth(index);
    const href = await candidate.getAttribute('href');
    if (!href?.startsWith('#')) continue;
    if (await page.locator(href).count() === 0) continue;

    try {
      await candidate.scrollIntoViewIfNeeded({ timeout: 3000 });
    } catch {
      // Keep searching; diagnostics below explain why a retained target did not materialize.
    }
    if (await candidate.isVisible()) {
      anchor = candidate;
      break;
    }

    if (diagnostics.length < 5) {
      diagnostics.push(await candidate.evaluate((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        let ancestor = node.parentElement;
        let blocker = null;
        while (ancestor && ancestor !== document.documentElement) {
          const ancestorStyle = getComputedStyle(ancestor);
          const ancestorRect = ancestor.getBoundingClientRect();
          if (ancestor.hidden || ancestorStyle.display === 'none' || ancestorStyle.visibility === 'hidden' || ancestorRect.width === 0 || ancestorRect.height === 0) {
            blocker = {
              tag: ancestor.tagName,
              id: ancestor.id || '',
              className: typeof ancestor.className === 'string' ? ancestor.className : '',
              hidden: ancestor.hidden,
              display: ancestorStyle.display,
              visibility: ancestorStyle.visibility,
              width: ancestorRect.width,
              height: ancestorRect.height,
              contentVisibility: ancestorStyle.contentVisibility,
            };
            break;
          }
          ancestor = ancestor.parentElement;
        }
        return {
          href: node.getAttribute('href'),
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          width: rect.width,
          height: rect.height,
          contentVisibility: style.contentVisibility,
          blocker,
        };
      }));
    }
  }

  assert.ok(anchor, `${label}: no user-visible retained heading anchor with a live fragment target after normal scroll; ${JSON.stringify(diagnostics)}`);
  const href = await anchor.getAttribute('href');
  assert.ok(href?.startsWith('#'), `${label}: heading anchor missing fragment href`);
  assert.equal(await anchor.getAttribute('aria-label'), 'Скопировать ссылку на раздел', `${label}: heading anchor accessibility label drift`);

  const expectedUrl = await page.evaluate((fragment) => new URL(fragment, window.location.href).toString(), href);
  await anchor.click();
  await page.waitForFunction((fragment) => {
    const toast = document.getElementById('anchor-copy-toast');
    return toast?.classList.contains('is-visible') === true || window.location.hash === fragment;
  }, href);

  const feedback = await page.evaluate(() => ({
    toast: document.getElementById('anchor-copy-toast')?.classList.contains('is-visible') === true,
    hash: window.location.hash,
  }));
  assert.equal(feedback.toast, true, `${label}: heading-anchor activation produced no user feedback`);

  const clipboard = await page.evaluate(async () => {
    try {
      if (!navigator.clipboard?.readText) return { readable: false, value: '', error: 'readText unavailable' };
      return { readable: true, value: await navigator.clipboard.readText(), error: '' };
    } catch (error) {
      return { readable: false, value: '', error: String(error?.message || error) };
    }
  });

  if (clipboard.readable) {
    assert.equal(clipboard.value, expectedUrl, `${label}: heading-anchor clipboard value drift`);
  } else {
    assert.equal(feedback.hash, href, `${label}: clipboard was unreadable and hash fallback did not activate (${clipboard.error})`);
  }
}

async function exerciseStrategicMap(page, label) {
  const trigger = page.locator('.map-trigger[data-gb-strategic-map-owner="native-v1"]').first();
  await trigger.waitFor({ state: 'visible' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const popover = page.locator('#gb-strategic-map-popover');
  await popover.waitFor({ state: 'visible' });
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true', `${label}: strategic map did not expose expanded state`);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('gb-strategic-map-popover')?.hidden === true);
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false', `${label}: strategic map Escape did not collapse trigger`);
  assert.equal(await trigger.evaluate((node) => document.activeElement === node), true, `${label}: strategic map Escape did not restore focus`);
}

async function exerciseReversibleCard(page, label) {
  const card = page.locator('.heart-flip-card[data-gb-reversible-card-owner="native-v1"]').first();
  await card.waitFor({ state: 'visible' });
  await card.focus();
  const before = await card.evaluate((node) => node.classList.contains('flipped'));
  await page.keyboard.press('Enter');
  const afterEnter = await card.evaluate((node) => node.classList.contains('flipped'));
  assert.notEqual(afterEnter, before, `${label}: reversible card Enter did not toggle exactly once`);
  assert.equal(await card.getAttribute('aria-expanded'), String(afterEnter), `${label}: reversible card aria-expanded drift after Enter`);
  await page.keyboard.press('Space');
  const afterSpace = await card.evaluate((node) => node.classList.contains('flipped'));
  assert.equal(afterSpace, before, `${label}: reversible card Space did not restore state`);
  assert.equal(await card.getAttribute('aria-expanded'), String(afterSpace), `${label}: reversible card aria-expanded drift after Space`);
}

async function runCase(browser, browserName, baseUrl, route, viewport, { clipboardMode = 'normal' } = {}) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript((mode) => {
    let clipboardValue = '';
    const clipboard = {
      writeText: mode === 'hang'
        ? async () => new Promise(() => {})
        : async (value) => { clipboardValue = String(value); },
      readText: mode === 'hang'
        ? async () => { throw new Error('clipboard read disabled for hanging-write regression'); }
        : async () => clipboardValue,
    };
    Object.defineProperty(Navigator.prototype, 'clipboard', {
      configurable: true,
      get: () => clipboard,
    });
  }, clipboardMode);
  const page = await context.newPage();
  const pageErrors = [];
  const legacyRequests = [];
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
  page.on('request', (request) => {
    if (/\/js\/(?:enhancements|site)\.js(?:\?|$)/.test(request.url())) legacyRequests.push(request.url());
  });

  const label = `${browserName} ${route.path} ${viewport.width}${clipboardMode === 'normal' ? '' : ` clipboard=${clipboardMode}`}`;
  try {
    const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'networkidle' });
    assert.ok(response?.ok(), `${label}: route did not load`);
    await page.waitForFunction(() => document.documentElement.dataset.gbArticleInteractionsReady === '1');

    const baseline = await page.evaluate(() => ({
      version: window.GBArticleInteractions?.version,
      strategicMap: window.GBArticleInteractions?.strategicMap,
      faq: window.GBArticleInteractions?.faq,
      headingAnchors: window.GBArticleInteractions?.headingAnchors,
      reversibleCards: window.GBArticleInteractions?.reversibleCards,
      legacyScriptNodes: [...document.scripts].map((node) => node.src).filter((src) => /\/js\/(?:enhancements|site)\.js(?:\?|$)/.test(src)),
    }));

    assert.equal(baseline.version, 3, `${label}: article capability composer version mismatch`);
    assert.equal(baseline.faq?.enabled, true, `${label}: FAQ owner not enabled`);
    assert.ok((baseline.headingAnchors?.anchors || 0) > 0, `${label}: heading-anchor owner has zero retained targets`);
    assert.deepEqual(baseline.legacyScriptNodes, [], `${label}: legacy enhancements/site transport restored`);
    assert.deepEqual(legacyRequests, [], `${label}: browser requested legacy enhancements/site transport`);

    if (route.id === 'antisovetov') {
      assert.equal(baseline.strategicMap?.enabled, true, `${label}: strategic-map owner not enabled`);
      assert.equal(baseline.strategicMap?.unresolved, 0, `${label}: strategic-map data has unresolved triggers`);
      const counts = await page.evaluate(() => ({
        all: document.querySelectorAll('.map-trigger[data-tip]').length,
        owned: document.querySelectorAll('.map-trigger[data-gb-strategic-map-owner="native-v1"]').length,
      }));
      assert.ok(counts.all > 0, `${label}: no strategic-map triggers found`);
      assert.equal(counts.owned, counts.all, `${label}: strategic-map ownership cardinality mismatch`);
      await exerciseStrategicMap(page, label);
    }

    if (route.id === 'krajne') {
      assert.equal(baseline.reversibleCards?.enabled, true, `${label}: reversible-card owner not enabled`);
      assert.ok((baseline.reversibleCards?.cards || 0) > 0, `${label}: reversible-card owner has zero targets`);
      await exerciseReversibleCard(page, label);
    }

    await exerciseFaq(page, label);
    await exerciseHeadingAnchor(page, label);
    assert.deepEqual(pageErrors, [], `${label}: uncaught page errors`);

    return { browser: browserName, route: route.path, viewport, clipboardMode, baseline, legacyRequests, pageErrors };
  } finally {
    await context.close();
  }
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  assert.ok(fs.existsSync(DIST), 'dist missing; build production-like output first');
  const server = await startServer();
  const results = [];
  try {
    for (const browserName of browserNames) {
      const browserType = BROWSERS[browserName];
      assert.ok(browserType, `unsupported browser: ${browserName}`);
      const browser = await browserType.launch({ headless: true });
      try {
        for (const viewport of viewports) {
          for (const route of routes) results.push(await runCase(browser, browserName, server.baseUrl, route, viewport));
        }
        if (browserName === 'chromium') {
          results.push(await runCase(
            browser,
            browserName,
            server.baseUrl,
            routes[0],
            viewports[0],
            { clipboardMode: 'hang' },
          ));
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    await server.close();
  }

  const report = { schemaVersion: 1, conclusion: 'success', sha: process.env.SOURCE_SHA || '', browsers: browserNames, routes, viewports, results };
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Article capability browser contract: PASS (${results.length} cases, including bounded hanging-clipboard fallback)`);
}

main().catch((error) => {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify({ schemaVersion: 1, conclusion: 'failure', error: String(error?.stack || error) }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
