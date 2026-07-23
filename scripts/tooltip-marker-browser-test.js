#!/usr/bin/env node
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const REPORTS = path.join(ROOT, 'reports');
fs.mkdirSync(REPORTS, { recursive: true });

function fixtureHtml() {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Tooltip marker contract</title>
  <link rel="stylesheet" href="/css/site.css">
  <style>
    body { min-height: 160vh; }
    article { width: min(720px, 88vw); margin: 80px auto; }
    #line { font-size: 20px; line-height: 1.75; }
    #outside { height: 220px; }
  </style>
</head>
<body>
  <article>
    <p id="line"><span id="reference-text">Проверяем пояснение</span><span id="dove" class="fn-marker fn-marker--dove" role="button" tabindex="0" aria-label="Показать пояснение"><span class="tooltip">Ненумерованная пояснительная справка.</span></span>, а затем источник<span id="numbered" class="fn-marker" role="button" tabindex="0" aria-label="Показать сноску">7<span class="tooltip">Нумерованный источник.</span></span>.</p>
    <div id="outside" tabindex="0">Вне подсказки</div>
  </article>
  <script>
    window.SITE_CONFIG = {
      site: { name: 'Fixture', baseUrl: '/', locale: 'ru' },
      page: { type: 'article', id: 'tooltip-marker-fixture', title: 'Tooltip marker fixture' },
      features: { toc: false, share: false, quiz: { enabled: false } }
    };
  </script>
  <script src="/js/site-utils.js"></script>
  <script src="/js/site.js"></script>
</body>
</html>`;
}

function contentType(filePath) {
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

function startServer() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/fixture/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      response.end(fixtureHtml());
      return;
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const filePath = path.resolve(ROOT, relative);
    if (!filePath.startsWith(ROOT + path.sep) || !fs.existsSync(filePath)) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': contentType(filePath), 'cache-control': 'no-store' });
    fs.createReadStream(filePath).pipe(response);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, origin: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

async function waitForRuntime(page) {
  await page.waitForFunction(() => {
    const dove = document.querySelector('#dove');
    return dove && dove.querySelector('.fn-dove-icon') && dove.dataset.gbDoveReady === '1';
  });
}

async function movePointerTo(page, selector) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, `${selector} must have a bounding box`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

async function desktopAssertions(browser, origin) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/fixture/`, { waitUntil: 'networkidle' });
  await waitForRuntime(page);

  const initial = await page.evaluate(() => {
    const dove = document.querySelector('#dove');
    const numbered = document.querySelector('#numbered');
    const reference = document.querySelector('#reference-text');
    const doveRect = dove.getBoundingClientRect();
    const referenceRect = reference.getBoundingClientRect();
    const triggerText = Array.from(dove.childNodes)
      .filter((node) => !(node.nodeType === Node.ELEMENT_NODE && node.matches('.tooltip,.fn-dove-icon,.fn-num')))
      .map((node) => node.textContent || '')
      .join('')
      .trim();
    return {
      doveIcons: dove.querySelectorAll('.fn-dove-icon').length,
      numberedDoveIcons: numbered.querySelectorAll('.fn-dove-icon').length,
      numberedText: Array.from(numbered.childNodes).find((node) => node.nodeType === Node.TEXT_NODE)?.textContent.trim(),
      triggerText,
      verticalDelta: (doveRect.top + doveRect.height / 2) - (referenceRect.top + referenceRect.height / 2),
      doveWidth: doveRect.width,
      doveHeight: doveRect.height
    };
  });

  console.log(`desktop metrics: ${JSON.stringify(initial)}`);
  assert.equal(initial.doveIcons, 1, 'unnumbered note must render exactly one dove SVG');
  assert.equal(initial.numberedDoveIcons, 0, 'numbered note must not render a dove');
  assert.equal(initial.numberedText, '7', 'numbered marker must retain its visible number');
  assert.equal(initial.triggerText, '', 'dove trigger must not retain a dagger/cross glyph');
  assert.ok(initial.verticalDelta <= 1.5, `dove sits too low (${initial.verticalDelta.toFixed(2)}px)`);
  assert.ok(initial.verticalDelta >= -8, `dove sits too high (${initial.verticalDelta.toFixed(2)}px)`);
  assert.ok(initial.doveWidth >= 11 && initial.doveWidth <= 24, `unexpected dove width ${initial.doveWidth}`);

  // Direct pointer movement avoids Playwright retrying hover after the tooltip opens over the anchor.
  await movePointerTo(page, '#dove');
  await page.waitForTimeout(80);
  await page.screenshot({ path: path.join(REPORTS, 'tooltip-marker-desktop.png'), fullPage: false });
  const hover = await page.evaluate(() => {
    const wing = document.querySelector('#dove .fn-dove-wing');
    const svg = document.querySelector('#dove .fn-dove-icon');
    return {
      animationName: getComputedStyle(wing).animationName,
      transform: getComputedStyle(svg).transform,
      tooltipOpen: document.querySelector('#dove').classList.contains('is-open'),
      anchorHovered: document.querySelector('#dove').matches(':hover')
    };
  });
  console.log(`desktop hover: ${JSON.stringify(hover)}`);
  assert.equal(hover.anchorHovered, true, 'pointer must physically hover the dove anchor');
  assert.match(hover.animationName, /fn-dove-flap/, 'dove wing must react on desktop hover');
  assert.notEqual(hover.transform, 'none', 'dove SVG must move subtly on hover');
  assert.equal(hover.tooltipOpen, true, 'hover must open the standalone tooltip');

  const desktopTip = await page.evaluate(() => {
    const tip = document.querySelector('#dove .tooltip') || document.querySelector('body > .tooltip.gb-floating-tip');
    const rect = tip.getBoundingClientRect();
    return { open: tip.classList.contains('is-open') || document.querySelector('#dove').classList.contains('is-open'), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, vw: innerWidth, vh: innerHeight };
  });
  console.log(`desktop tooltip: ${JSON.stringify(desktopTip)}`);
  assert.ok(desktopTip.left >= 0 && desktopTip.right <= desktopTip.vw + 1, 'desktop tooltip must remain inside viewport horizontally');
  assert.ok(desktopTip.top >= 0 && desktopTip.bottom <= desktopTip.vh + 1, 'desktop tooltip must remain inside viewport vertically');

  await page.keyboard.press('Escape');
  await page.click('#numbered');
  const numberedOpen = await page.evaluate(() => ({
    expanded: document.querySelector('#numbered').getAttribute('aria-expanded'),
    hasDove: Boolean(document.querySelector('#numbered .fn-dove-icon')),
    visibleNumber: Array.from(document.querySelector('#numbered').childNodes).find((node) => node.nodeType === Node.TEXT_NODE)?.textContent.trim()
  }));
  assert.equal(numberedOpen.expanded, 'true', 'numbered source must still open');
  assert.equal(numberedOpen.hasDove, false);
  assert.equal(numberedOpen.visibleNumber, '7');
  assert.deepEqual(errors, [], `desktop page errors: ${errors.join('; ')}`);
  await page.close();
}

async function mobileAssertions(browser, origin) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/fixture/`, { waitUntil: 'networkidle' });
  await waitForRuntime(page);
  await page.tap('#dove');
  await page.waitForTimeout(80);
  await page.screenshot({ path: path.join(REPORTS, 'tooltip-marker-mobile.png'), fullPage: false });

  const opened = await page.evaluate(() => {
    const anchor = document.querySelector('#dove');
    const tip = document.querySelector('#dove .tooltip') || document.querySelector('body > .tooltip.gb-floating-tip');
    const rect = tip.getBoundingClientRect();
    return {
      expanded: anchor.getAttribute('aria-expanded'),
      open: anchor.classList.contains('is-open'),
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      vw: innerWidth,
      vh: innerHeight,
      scrollLocked: document.documentElement.classList.contains('gb-scroll-locked') || document.body.style.position === 'fixed'
    };
  });

  console.log(`mobile tooltip: ${JSON.stringify(opened)}`);
  assert.equal(opened.expanded, 'true', 'mobile tap must open the dove tooltip');
  assert.equal(opened.open, true);
  assert.ok(opened.left >= -1 && opened.right <= opened.vw + 1, 'mobile tooltip must fit viewport width');
  assert.ok(opened.top >= -1 && opened.bottom <= opened.vh + 1, 'mobile tooltip must fit viewport height');

  await page.tap('#outside');
  await page.waitForTimeout(50);
  const closed = await page.evaluate(() => document.querySelector('#dove').getAttribute('aria-expanded'));
  assert.equal(closed, 'false', 'outside tap must close mobile tooltip');
  assert.deepEqual(errors, [], `mobile page errors: ${errors.join('; ')}`);
  await context.close();
}

(async () => {
  const { server, origin } = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    await desktopAssertions(browser, origin);
    await mobileAssertions(browser, origin);
    console.log('Tooltip marker desktop/mobile browser contract passed.');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
