#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const ROOT = path.resolve(process.cwd());
const DIST = path.join(ROOT, 'dist');
const REPORT_DIR = path.join(ROOT, 'reports', 'konfessii-reduced-motion');
const BROWSERS = { chromium, webkit };
const browserNames = String(process.env.KONFESSII_MOTION_BROWSERS || 'chromium,webkit')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

function contentType(filePath) {
  return {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
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
  assert.ok(fs.existsSync(path.join(DIST, 'konfessii', 'index.html')), 'dist/konfessii/index.html is missing; build production-like dist first');
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
      response.end(String(error?.message || error));
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function snapshot(page) {
  return page.evaluate(() => {
    const card = document.querySelector('.card.live');
    const dot = card?.querySelector('.live i');
    if (!(card instanceof HTMLElement) || !(dot instanceof HTMLElement)) throw new Error('live Konfessii card/status dot missing');
    const cardStyle = getComputedStyle(card);
    const dotStyle = getComputedStyle(dot);
    return {
      cardAnimationName: cardStyle.animationName,
      cardAnimationDuration: cardStyle.animationDuration,
      cardTransitionDuration: cardStyle.transitionDuration,
      dotAnimationName: dotStyle.animationName,
      dotAnimationDuration: dotStyle.animationDuration,
      inlineBoxShadow: card.style.boxShadow,
      inlineTransition: card.style.transition,
      inlineTransform: card.style.transform,
    };
  });
}

async function runMode(browserName, browserType, baseUrl, reducedMotion) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    reducedMotion,
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));

  try {
    const response = await page.goto(`${baseUrl}/konfessii/`, { waitUntil: 'networkidle' });
    assert.ok(response?.ok(), `${browserName}/${reducedMotion}: /konfessii/ failed to load`);
    await page.locator('.card.live').waitFor({ state: 'visible' });
    await page.waitForTimeout(250);
    const initial = await snapshot(page);

    if (reducedMotion === 'reduce') {
      assert.equal(initial.cardAnimationName, 'none', `${browserName}: live-card animation still active under reduced motion`);
      assert.equal(initial.dotAnimationName, 'none', `${browserName}: live-dot pulse still active under reduced motion`);
      assert.ok(initial.cardTransitionDuration.split(',').every((value) => value.trim() === '0s'), `${browserName}: card transition remains animated under reduced motion: ${initial.cardTransitionDuration}`);
      await page.waitForTimeout(4800);
      const delayed = await snapshot(page);
      assert.equal(delayed.inlineBoxShadow, '', `${browserName}: JS shimmer mutated inline box-shadow under reduced motion`);
      assert.equal(delayed.inlineTransform, '', `${browserName}: JS tilt mutated inline transform under reduced motion`);
      assert.deepEqual(pageErrors, [], `${browserName}: page errors under reduced motion`);
      return { browser: browserName, mode: reducedMotion, initial, delayed, pageErrors };
    }

    assert.ok(initial.cardAnimationName.split(',').map((value) => value.trim()).includes('liveShimmer'), `${browserName}: normal live-card shimmer missing`);
    assert.ok(initial.dotAnimationName.split(',').map((value) => value.trim()).includes('liv'), `${browserName}: normal live-dot pulse missing`);
    await page.waitForFunction(() => {
      const card = document.querySelector('.card.live');
      return card instanceof HTMLElement && card.style.boxShadow !== '';
    }, null, { timeout: 6200 });
    const delayed = await snapshot(page);
    assert.notEqual(delayed.inlineBoxShadow, '', `${browserName}: normal JS shimmer did not run`);
    assert.deepEqual(pageErrors, [], `${browserName}: page errors under normal motion`);
    return { browser: browserName, mode: reducedMotion, initial, delayed, pageErrors };
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
      results.push(await runMode(browserName, browserType, server.baseUrl, 'reduce'));
      results.push(await runMode(browserName, browserType, server.baseUrl, 'no-preference'));
    }
  } finally {
    await server.close();
  }

  const report = {
    schemaVersion: 1,
    conclusion: 'success',
    sha: process.env.SOURCE_SHA || '',
    route: '/konfessii/',
    browsers: browserNames,
    modes: ['reduce', 'no-preference'],
    results,
  };
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log('Konfessii reduced-motion browser contract: PASS');
}

main().catch((error) => {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify({
    schemaVersion: 1,
    conclusion: 'failure',
    sha: process.env.SOURCE_SHA || '',
    route: '/konfessii/',
    error: String(error?.stack || error),
  }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});