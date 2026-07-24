#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const REPORT_DIR = path.join(ROOT, 'reports', 'visual-parity', 'home-progressive-enhancement');
const HEAD_SOURCE = fs.readFileSync(path.join(ROOT, 'src/components/home/HomePageHead.astro'), 'utf8');
const WORKFLOW_SOURCE = fs.readFileSync(path.join(ROOT, '.github/workflows/visual-parity.yml'), 'utf8');

fs.mkdirSync(REPORT_DIR, { recursive: true });

assert.match(HEAD_SOURCE, /<noscript>[\s\S]*?\.home-page \.h-reveal[\s\S]*?opacity:\s*1\s*!important/, 'no-JS source must force home reveal content visible');
assert.match(HEAD_SOURCE, /@media print[\s\S]*?\.home-page \.h-reveal[\s\S]*?opacity:\s*1\s*!important/, 'print source must force home reveal content visible');
assert.match(WORKFLOW_SOURCE, /node scripts\/home-progressive-enhancement-browser-test\.js/, 'Visual Parity workflow must run the home progressive-enhancement browser contract');

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
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
  };
  return types[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function startServer() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    throw new Error('dist/index.html is missing — run npm run strangler:build:production-like first');
  }

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
        if (requestPath.endsWith('/')) requestPath += 'index.html';
        const filePath = path.normalize(path.join(DIST, requestPath));
        if (!filePath.startsWith(DIST)) {
          res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('forbidden');
          return;
        }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('not found');
          return;
        }
        res.writeHead(200, {
          'content-type': contentType(filePath),
          'cache-control': 'no-store',
        });
        fs.createReadStream(filePath).pipe(res);
      } catch (error) {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        res.end(String(error));
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, origin: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

async function revealSnapshot(page) {
  return page.locator('.h-reveal').evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const heading = element.querySelector('h2, h3, [aria-labelledby]')?.textContent?.trim() || element.id || element.className;
    return {
      heading: String(heading).replace(/\s+/g, ' ').slice(0, 100),
      opacity: Number.parseFloat(style.opacity || '1'),
      visibility: style.visibility,
      display: style.display,
      contentVisibility: style.contentVisibility,
      width: rect.width,
      height: rect.height,
    };
  }));
}

function assertRevealVisible(snapshot, label) {
  assert.ok(snapshot.length >= 6, `${label}: expected at least 6 home reveal sections, got ${snapshot.length}`);
  const hidden = snapshot.filter((item) => (
    item.opacity < 0.98
    || item.visibility === 'hidden'
    || item.display === 'none'
    || item.contentVisibility === 'hidden'
    || item.width <= 0
    || item.height <= 0
  ));
  assert.deepEqual(hidden, [], `${label}: hidden reveal sections: ${JSON.stringify(hidden, null, 2)}`);
}

async function collectPageHealth(page) {
  return page.evaluate(() => ({
    viewport: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    title: document.title,
    bodyTextLength: document.body.innerText.length,
  }));
}

async function warmScroll(page) {
  await page.evaluate(async () => {
    const height = document.documentElement.scrollHeight;
    for (let y = 0; y <= height; y += Math.max(320, Math.floor(innerHeight * 0.72))) {
      scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 45));
    }
    scrollTo(0, 0);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.waitForTimeout(250);
}

function monitorRuntime(page, bucket) {
  page.on('pageerror', (error) => bucket.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') bucket.push(`console: ${message.text()}`);
  });
}

async function runNormal(browser, origin, report) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const runtimeErrors = [];
  monitorRuntime(page, runtimeErrors);
  await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  await warmScroll(page);
  const reveals = await revealSnapshot(page);
  assertRevealVisible(reveals, 'normal JS after full warm scroll');
  const health = await collectPageHealth(page);
  assert.ok(health.scrollWidth <= health.viewport, `normal JS horizontal overflow: ${health.scrollWidth} > ${health.viewport}`);
  assert.ok(health.bodyTextLength > 4000, `normal JS body text unexpectedly short: ${health.bodyTextLength}`);
  assert.deepEqual(runtimeErrors, [], `normal JS runtime errors: ${runtimeErrors.join('\n')}`);
  const screenshot = path.join(REPORT_DIR, 'normal-mobile-full.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  report.normal = { reveals, health, screenshot: path.relative(ROOT, screenshot) };
  await context.close();
}

async function runNoJavaScript(browser, origin, report) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  await page.goto(`${origin}/`, { waitUntil: 'load' });

  const reveals = await revealSnapshot(page);
  assertRevealVisible(reveals, 'no-JS');

  const controls = await page.evaluate(() => {
    const display = (selector) => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element).display : null;
    };
    const menu = document.querySelector('.h-nojs-nav');
    const links = Array.from(document.querySelectorAll('.h-nojs-nav__links a'));
    return {
      search: display('#gbSearchBtn'),
      theme: display('#themeToggle'),
      burger: display('#hMobileMenuBtn'),
      fallback: menu ? getComputedStyle(menu).display : null,
      linkCount: links.length,
      linkHeights: links.map((link) => link.getBoundingClientRect().height),
    };
  });
  assert.equal(controls.search, 'none', 'no-JS search control must be hidden');
  assert.equal(controls.theme, 'none', 'no-JS theme control must be hidden');
  assert.equal(controls.burger, 'none', 'no-JS burger control must be hidden');
  assert.notEqual(controls.fallback, 'none', 'native no-JS navigation must be visible');
  assert.equal(controls.linkCount, 8, 'native no-JS navigation must expose eight routes');
  assert.ok(controls.linkHeights.every((height) => height >= 44), `no-JS link targets below 44px: ${controls.linkHeights.join(', ')}`);

  await page.locator('.h-nojs-nav > summary').click();
  assert.equal(await page.locator('.h-nojs-nav').getAttribute('open'), '', 'native details menu must open without JavaScript');
  const sheetVisible = await page.locator('.h-nojs-nav__sheet').isVisible();
  assert.equal(sheetVisible, true, 'no-JS navigation sheet must become visible');
  await page.locator('.h-nojs-nav > summary').click();

  const health = await collectPageHealth(page);
  assert.ok(health.scrollWidth <= health.viewport, `no-JS horizontal overflow: ${health.scrollWidth} > ${health.viewport}`);
  assert.ok(health.bodyTextLength > 4000, `no-JS body text unexpectedly short: ${health.bodyTextLength}`);
  const screenshot = path.join(REPORT_DIR, 'no-js-mobile-full.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  report.noJavaScript = { reveals, controls, health, screenshot: path.relative(ROOT, screenshot) };
  await context.close();
}

async function runPrint(browser, origin, report) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const runtimeErrors = [];
  monitorRuntime(page, runtimeErrors);
  await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(100);
  const reveals = await revealSnapshot(page);
  assertRevealVisible(reveals, 'print media before scrolling');
  assert.deepEqual(runtimeErrors, [], `print runtime errors: ${runtimeErrors.join('\n')}`);
  const screenshot = path.join(REPORT_DIR, 'print-desktop-full.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  report.print = { reveals, health: await collectPageHealth(page), screenshot: path.relative(ROOT, screenshot) };
  await context.close();
}

async function runWithoutIntersectionObserver(browser, origin, report) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  monitorRuntime(page, runtimeErrors);
  await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const reveals = await revealSnapshot(page);
  assertRevealVisible(reveals, 'IntersectionObserver unavailable');
  assert.deepEqual(runtimeErrors, [], `observer fallback runtime errors: ${runtimeErrors.join('\n')}`);
  report.noIntersectionObserver = { reveals, health: await collectPageHealth(page) };
  await context.close();
}

(async () => {
  const { server, origin } = await startServer();
  const browser = await chromium.launch({ headless: true });
  const report = { generatedAt: new Date().toISOString(), origin };
  try {
    await runNormal(browser, origin, report);
    await runNoJavaScript(browser, origin, report);
    await runPrint(browser, origin, report);
    await runWithoutIntersectionObserver(browser, origin, report);
    fs.writeFileSync(path.join(REPORT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    console.log('Home progressive-enhancement browser contract: PASS (normal, no-JS, print, no IntersectionObserver).');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
