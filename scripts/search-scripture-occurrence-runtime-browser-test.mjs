#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv = process.argv.slice(2)) {
  const options = { dist: 'dist', report: 'reports/scripture-occurrence-runtime' };
  for (const argument of argv) {
    if (argument.startsWith('--dist=')) options.dist = argument.slice('--dist='.length);
    else if (argument.startsWith('--report=')) options.report = argument.slice('--report='.length);
    else throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

function mimeType(filePath) {
  return ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.wasm': 'application/wasm',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
  })[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

async function startStaticServer(distRoot) {
  const root = path.resolve(distRoot);
  assert(fs.existsSync(path.join(root, 'data', 'scripture-search-index.json')), 'dist Scripture occurrence index is missing');
  const server = http.createServer((request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const pathname = decodeURIComponent(url.pathname);
      let target = path.resolve(root, `.${pathname}`);
      if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403).end('forbidden');
        return;
      }
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
      if (!fs.existsSync(target) && !path.extname(target)) target = path.join(target, 'index.html');
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        response.writeHead(404).end('not found');
        return;
      }
      response.writeHead(200, {
        'content-type': mimeType(target),
        'cache-control': 'no-store',
      });
      fs.createReadStream(target).pipe(response);
    } catch (error) {
      response.writeHead(500).end(error.message);
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert(address && typeof address === 'object', 'static server did not expose an address');
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

function readFixture() {
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/scripture-search-index.json'), 'utf8'));
  const references = Array.isArray(index.references) ? index.references : [];
  assert(references.length >= 200, 'S2 fixture requires the canonical S1 index');
  const preferred = references.find((reference) => /(?:^|:)17:9$/u.test(reference.id) && /иер/u.test(reference.label.toLowerCase()))
    || references.find((reference) => reference.occurrences?.length)
    || null;
  assert(preferred, 'no exact-reference fixture exists');
  const anchored = references.find((reference) => reference.occurrences?.some((occurrence) => occurrence.anchor)) || preferred;
  return { preferred, anchored };
}

function normalizeLocation(value) {
  const url = new URL(value, 'http://fixture.invalid');
  return `${url.pathname}${url.hash}`;
}

function isExpectedLocalOriginIconCsp(message) {
  return /^Loading the image 'https:\/\/gospod-bog\.ru\/(?:favicon\.ico|apple-touch-icon\.png|favicon-(?:48|120)\.png|icons\/icon-192\.png)' violates the following Content Security Policy directive:/u.test(String(message || ''));
}

async function openSearch(page) {
  await page.goto('/articles/krajne-li-isporcheno-serdce/', { waitUntil: 'domcontentloaded' });
  await page.keyboard.press('Control+K');
  await page.waitForFunction(() => (
    window.GBSearch?.__ready === true
    && document.querySelector('.cp-backdrop')?.classList.contains('is-open')
    && document.querySelector('.cp-input') instanceof HTMLInputElement
  ));
  await page.locator('[data-scope="scripture"]').click();
  await page.locator('.cp-input').focus();
}

async function exactBeforePagefind(origin, browser, fixture, report) {
  const context = await browser.newContext({ baseURL: origin, viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  const pagefindRequests = [];
  const indexRequests = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' && !isExpectedLocalOriginIconCsp(text)) errors.push(`console: ${text}`);
  });
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.includes('/pagefind/')) pagefindRequests.push(pathname);
    if (pathname === '/data/scripture-search-index.json') indexRequests.push(pathname);
  });
  await page.route('**/pagefind/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2600));
    await route.continue();
  });

  await openSearch(page);
  assert.equal(indexRequests.length, 0, 'Scripture occurrence index must stay lazy before a query');
  const started = Date.now();
  await page.locator('.cp-input').fill(fixture.label);
  await page.locator('.cp-group-hd').filter({ hasText: 'Точные вхождения' }).waitFor({ timeout: 1800 });
  const elapsedMs = Date.now() - started;
  assert(elapsedMs < 2200, `exact occurrences waited for Pagefind (${elapsedMs}ms)`);
  assert.equal(indexRequests.length, 1, 'exact query must fetch the occurrence index once');

  const groupNames = await page.locator('.cp-group-hd > span:first-child').allTextContents();
  assert.equal(groupNames[0], 'Точные вхождения', `exact group must render first: ${groupNames.join(', ')}`);
  const itemCount = await page.locator('.cp-item').count();
  assert(itemCount > 0 && itemCount <= 12, `unexpected exact result count: ${itemCount}`);
  const status = await page.locator('#cp-status').textContent();
  assert(/\d+\s+вх\./u.test(status || ''), `exact occurrence status missing: ${status}`);

  const previewHref = await page.locator('#cp-read-btn').getAttribute('href');
  assert(previewHref, 'exact occurrence preview link is absent');
  const allowed = new Set((fixture.occurrences || []).map((occurrence) => normalizeLocation(`${occurrence.url}${occurrence.anchor ? `#${encodeURIComponent(occurrence.anchor)}` : ''}`)));
  assert(allowed.has(normalizeLocation(previewHref)), `preview target is not an indexed occurrence: ${previewHref}`);

  await page.locator('.cp-input').fill(fixture.label.replace(/^([^\s.]+)(?=\s)/u, '$1.'));
  await page.locator('.cp-group-hd').filter({ hasText: 'Точные вхождения' }).waitFor({ timeout: 1800 });
  assert.equal(indexRequests.length, 1, 'alias-equivalent exact query must reuse the loaded index');
  assert.equal(errors.length, 0, errors.join('\n'));

  report.exact = {
    reference: fixture.label,
    occurrenceCount: fixture.occurrences.length,
    renderedCount: itemCount,
    elapsedMs,
    pagefindRequestsObserved: pagefindRequests.length,
    indexRequests: indexRequests.length,
    previewHref,
  };
  await context.close();
}

async function indexFailureFallsBack(origin, browser, fixture, report) {
  const context = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  let failedIndexRequests = 0;
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    const text = message.text();
    const expectedInjected503 = text === 'Failed to load resource: the server responded with a status of 503 (Service Unavailable)';
    if (message.type() === 'error' && !isExpectedLocalOriginIconCsp(text) && !expectedInjected503) errors.push(`console: ${text}`);
  });
  await page.route('**/data/scripture-search-index.json', (route) => {
    failedIndexRequests += 1;
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"fixture"}' });
  });

  await openSearch(page);
  await page.locator('.cp-input').fill(fixture.label);
  await page.waitForFunction(() => {
    const loading = document.querySelector('.cp-loading');
    const groups = document.querySelectorAll('.cp-group-hd').length;
    const empty = document.querySelector('.cp-empty-title');
    return !loading && (groups > 0 || Boolean(empty));
  }, null, { timeout: 12000 });
  assert.equal(failedIndexRequests, 1, 'failure fixture must intercept exactly one Scripture occurrence index request');
  const exactGroups = await page.locator('.cp-group-hd').filter({ hasText: 'Точные вхождения' }).count();
  assert.equal(exactGroups, 0, 'failed index request must not invent exact results');
  assert.equal(errors.length, 0, errors.join('\n'));

  report.fallback = {
    reference: fixture.label,
    failedIndexRequests,
    groupNames: await page.locator('.cp-group-hd > span:first-child').allTextContents(),
    emptyTitle: await page.locator('.cp-empty-title').textContent().catch(() => null),
  };
  await context.close();
}

async function keyboardNavigation(origin, browser, fixture, report) {
  const context = await browser.newContext({ baseURL: origin, viewport: { width: 1024, height: 768 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  await openSearch(page);
  await page.locator('.cp-input').fill(fixture.label);
  await page.locator('.cp-group-hd').filter({ hasText: 'Точные вхождения' }).waitFor({ timeout: 3000 });
  const expected = await page.locator('#cp-read-btn').getAttribute('href');
  assert(expected, 'keyboard fixture preview target is absent');
  await Promise.all([
    page.waitForURL((url) => normalizeLocation(url.href) === normalizeLocation(expected), { timeout: 8000 }),
    page.locator('.cp-input').press('Enter'),
  ]);
  report.keyboard = { reference: fixture.label, navigatedTo: normalizeLocation(page.url()) };
  await context.close();
}

async function main() {
  const options = parseArgs();
  const distRoot = path.resolve(ROOT, options.dist);
  const reportRoot = path.resolve(ROOT, options.report);
  fs.mkdirSync(reportRoot, { recursive: true });
  const fixture = readFixture();
  const { server, origin } = await startStaticServer(distRoot);
  const browser = await chromium.launch({ headless: true });
  const report = {
    exactHead: process.env.GITHUB_SHA || null,
    fixture: { preferred: fixture.preferred.id, anchored: fixture.anchored.id },
  };

  try {
    await exactBeforePagefind(origin, browser, fixture.preferred, report);
    await indexFailureFallsBack(origin, browser, fixture.preferred, report);
    await keyboardNavigation(origin, browser, fixture.anchored, report);
    fs.writeFileSync(path.join(reportRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`Scripture occurrence runtime browser contract passed: ${fixture.preferred.label}; exact results rendered before Pagefind and fallback remained usable.`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});