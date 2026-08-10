#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const ROOT = path.resolve(process.cwd());
const DIST = path.join(ROOT, 'dist');
const REPORT_DIR = path.join(ROOT, 'reports', 'search-cold-bootstrap');
const BROWSERS = { chromium, webkit };
const browserNames = String(process.env.SEARCH_BOOTSTRAP_BROWSERS || 'chromium,webkit')
  .split(',').map((value) => value.trim()).filter(Boolean);
const routes = ['/articles/', '/biografii/', '/pastor-series/'];
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
      response.setHeader('Cache-Control', 'no-store');
      if (!filePath) { response.statusCode = 404; response.end('Not found'); return; }
      response.setHeader('Content-Type', contentType(filePath));
      fs.createReadStream(filePath).pipe(response);
    } catch (error) {
      response.statusCode = 400;
      response.end(String(error?.message || error));
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

async function runCase(browser, browserName, baseUrl, route, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const pageErrors = [];
  const searchRequests = [];
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
  page.on('request', (request) => {
    if (/\/js\/search\.js(?:\?|$)/.test(request.url())) searchRequests.push(request.url());
  });

  try {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    assert.ok(response?.ok(), `${browserName} ${route} ${viewport.width}: route did not load`);

    const trigger = page.locator('#gbSearchBtn');
    await trigger.waitFor({ state: 'visible' });
    const cold = await page.evaluate(() => ({
      bound: window.__gbSearchColdBootstrapBound === true,
      ready: window.GBSearch?.__ready === true,
      paletteExists: Boolean(document.querySelector('.cp-backdrop')),
      triggerFocusable: document.getElementById('gbSearchBtn')?.tabIndex === 0,
    }));
    assert.equal(cold.bound, true, `${browserName} ${route}: route-scoped cold bootstrap missing`);
    assert.equal(cold.ready, false, `${browserName} ${route}: full search runtime was eagerly ready before interaction`);
    assert.equal(cold.paletteExists, false, `${browserName} ${route}: palette existed before cold interaction`);
    assert.equal(cold.triggerFocusable, true, `${browserName} ${route}: search opener is not keyboard-focusable`);
    assert.equal(searchRequests.length, 0, `${browserName} ${route}: search runtime requested before cold interaction`);

    await page.keyboard.press('Control+K');
    await page.locator('.cp-backdrop.is-open').waitFor({ state: 'visible' });
    await page.waitForFunction(() => window.GBSearch?.__ready === true);
    const opened = await page.evaluate(() => ({ activeClass: document.activeElement?.className || '' }));
    assert.ok(String(opened.activeClass).includes('cp-input'), `${browserName} ${route}: Ctrl+K did not focus search input`);
    assert.ok(searchRequests.length >= 1, `${browserName} ${route}: cold shortcut did not request search runtime`);

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.cp-backdrop')?.classList.contains('is-open'));
    assert.deepEqual(pageErrors, [], `${browserName} ${route}: uncaught page errors`);
    return { browser: browserName, route, viewport, cold, opened, searchRequestCount: searchRequests.length, pageErrors };
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
        for (const viewport of viewports) for (const route of routes) results.push(await runCase(browser, browserName, server.baseUrl, route, viewport));
      } finally { await browser.close(); }
    }
  } finally { await server.close(); }

  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify({ schemaVersion: 1, conclusion: 'success', sha: process.env.SOURCE_SHA || '', browsers: browserNames, routes, viewports, results }, null, 2)}\n`);
  console.log(`Search cold-bootstrap browser contract: PASS (${results.length} cases)`);
}

main().catch((error) => {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify({ schemaVersion: 1, conclusion: 'failure', error: String(error?.stack || error) }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
