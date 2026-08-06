#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const ROUTE = '/konfessii/russkij-baptizm/_app/';
const OUT = process.argv.includes('--out')
  ? path.resolve(process.argv[process.argv.indexOf('--out') + 1])
  : path.join(ROOT, 'reports', 'baptists-built-app-browser-measure.json');
const RUNS = Number(process.argv.includes('--runs') ? process.argv[process.argv.indexOf('--runs') + 1] : 3);

function contentType(filePath) {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };
  return types[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function createServer(root) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      try {
        const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
        const relative = pathname.endsWith('/') ? `${pathname.slice(1)}index.html` : pathname.slice(1);
        const filePath = path.resolve(root, relative);
        const prefix = `${root}${path.sep}`;
        if (!(filePath === root || filePath.startsWith(prefix))) {
          response.statusCode = 403;
          response.end('forbidden');
          return;
        }
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          response.statusCode = 404;
          response.end('not found');
          return;
        }
        response.setHeader('Content-Type', contentType(filePath));
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('Content-Length', fs.statSync(filePath).size);
        fs.createReadStream(filePath).pipe(response);
      } catch (error) {
        response.statusCode = 500;
        response.end(String(error));
      }
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function rounded(value) {
  return Number.isFinite(value) ? +value.toFixed(2) : null;
}

function summarize(samples) {
  const fields = ['fcpMs', 'domContentLoadedMs', 'loadMs', 'mainEncodedBytes', 'resourceEncodedBytes', 'longTaskCount', 'longTaskTotalMs', 'longestTaskMs', 'domNodes'];
  const summary = {};
  for (const field of fields) summary[`median${field[0].toUpperCase()}${field.slice(1)}`] = rounded(median(samples.map((sample) => Number(sample[field] || 0))));
  const severeMainThread = summary.medianLongestTaskMs >= 200 || summary.medianLongTaskTotalMs >= 500;
  const slowLocalBoot = summary.medianFcpMs >= 1500 || summary.medianLoadMs >= 2500;
  const monolithicTransfer = summary.medianMainEncodedBytes >= 1_000_000;
  summary.recommendation = monolithicTransfer && (severeMainThread || slowLocalBoot)
    ? 'SPLIT_WORTHWHILE_EXTRACT_CACHEABLE_JS_CSS_FIRST'
    : monolithicTransfer
      ? 'SPLIT_OPTIONAL_FOR_CACHEABILITY_NOT_CURRENT_RUNTIME_P0'
      : 'KEEP_CURRENT';
  summary.splitAuthorized = false;
  summary.reason = summary.recommendation.startsWith('SPLIT_WORTHWHILE')
    ? 'The monolithic entry combines a large transfer with measurable boot/main-thread cost; extraction should target cacheable JS/CSS without redesigning the app.'
    : summary.recommendation.startsWith('SPLIT_OPTIONAL')
      ? 'The entry is monolithic, but local browser boot evidence does not show a user-visible P0; split only as a bounded cacheability improvement.'
      : 'Neither transfer size nor browser boot evidence justifies structural work.';
  return summary;
}

if (!Number.isInteger(RUNS) || RUNS < 1 || RUNS > 7) throw new Error('--runs must be an integer from 1 to 7');

const server = await createServer(ROOT);
const port = server.address().port;
const browser = await chromium.launch({ headless: true });
const samples = [];

try {
  for (let run = 1; run <= RUNS; run += 1) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    const failedRequests = [];
    page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' }));
    await page.addInitScript(() => {
      window.__GB_LONG_TASKS = [];
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) window.__GB_LONG_TASKS.push({ startTime: entry.startTime, duration: entry.duration });
        }).observe({ type: 'longtask', buffered: true });
      } catch {}
    });

    const startedAt = Date.now();
    const response = await page.goto(`http://127.0.0.1:${port}${ROUTE}`, { waitUntil: 'load', timeout: 45_000 });
    await page.waitForTimeout(1200);
    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      const paint = performance.getEntriesByType('paint');
      const fcp = paint.find((entry) => entry.name === 'first-contentful-paint');
      const longTasks = window.__GB_LONG_TASKS || [];
      return {
        title: document.title,
        bodyTextLength: document.body?.innerText?.trim().length || 0,
        domNodes: document.querySelectorAll('*').length,
        scriptTags: document.scripts.length,
        styleTags: document.querySelectorAll('style,link[rel="stylesheet"]').length,
        canvasCount: document.querySelectorAll('canvas').length,
        svgCount: document.querySelectorAll('svg').length,
        fcpMs: fcp?.startTime || 0,
        domContentLoadedMs: nav?.domContentLoadedEventEnd || 0,
        loadMs: nav?.loadEventEnd || 0,
        mainTransferBytes: nav?.transferSize || 0,
        mainEncodedBytes: nav?.encodedBodySize || 0,
        mainDecodedBytes: nav?.decodedBodySize || 0,
        resourceCount: resources.length,
        resourceTransferBytes: resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
        resourceEncodedBytes: resources.reduce((sum, entry) => sum + (entry.encodedBodySize || 0), 0),
        longTaskCount: longTasks.length,
        longTaskTotalMs: longTasks.reduce((sum, entry) => sum + entry.duration, 0),
        longestTaskMs: longTasks.reduce((max, entry) => Math.max(max, entry.duration), 0),
        scrollHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      };
    });
    samples.push({
      run,
      status: response?.status() || null,
      wallClockMs: Date.now() - startedAt,
      ...metrics,
      pageErrors,
      consoleErrors,
      failedRequests,
    });
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

const report = {
  schemaVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  route: ROUTE,
  environment: { chromium: true, viewport: '1440x1000', serviceWorkers: 'blocked', cache: 'new context per run', runs: RUNS },
  summary: summarize(samples),
  samples,
  validity: {
    allHttp200: samples.every((sample) => sample.status === 200),
    allBodiesNonEmpty: samples.every((sample) => sample.bodyTextLength > 100),
    horizontalOverflowObserved: samples.some((sample) => sample.scrollWidth > sample.viewportWidth + 1),
    pageErrorCount: samples.reduce((sum, sample) => sum + sample.pageErrors.length, 0),
    failedRequestCount: samples.reduce((sum, sample) => sum + sample.failedRequests.length, 0),
  },
  decisionBoundary: 'Advisory measurement only. A split requires a separate bounded Product PR with before/after browser evidence and no route, search, offline or visual regression.',
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
if (!report.validity.allHttp200 || !report.validity.allBodiesNonEmpty) {
  console.error(`❌ invalid built-app browser measurement: ${JSON.stringify(report.validity)}`);
  process.exit(1);
}
console.log(`✅ Baptists built app browser measured: ${report.summary.recommendation}`);
