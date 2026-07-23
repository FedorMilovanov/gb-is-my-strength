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

async function createDesktopCssSession(page) {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setEmulatedMedia', {
    media: 'screen',
    features: [
      { name: 'hover', value: 'hover' },
      { name: 'pointer', value: 'fine' },
      { name: 'any-hover', value: 'hover' },
      { name: 'any-pointer', value: 'fine' }
    ]
  });
  await session.send('DOM.enable');
  await session.send('CSS.enable');
  return session;
}

async function forcePseudoHover(session, selector, enabled) {
  const { root } = await session.send('DOM.getDocument', { depth: -1, pierce: true });
  const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  assert.ok(nodeId, `${selector} must resolve through CDP`);
  await session.send('CSS.forcePseudoState', {
    nodeId,
    forcedPseudoClasses: enabled ? ['hover'] : []
  });
}

async function openByPointer(page, selector) {
  await page.dispatchEvent(selector, 'pointerover', { pointerType: 'mouse', bubbles: true });
  await page.waitForFunction((target) => document.querySelector(target)?.classList.contains('is-open'), selector);
  return page.evaluate((target) => {
    const anchor = document.querySelector(target);
    const tip = document.querySelector('body > .tooltip.gb-floating-tip.is-open, body > .gtip.gb-floating-tip.is-open');
    const rect = tip.getBoundingClientRect();
    return {
      expanded: anchor.getAttribute('aria-expanded'),
      open: anchor.classList.contains('is-open'),
      pointerEvents: getComputedStyle(tip).pointerEvents,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      vw: innerWidth,
      vh: innerHeight
    };
  }, selector);
}

async function closeWithEscape(page, selector) {
  await page.keyboard.press('Escape');
  await page.waitForFunction((target) => document.querySelector(target)?.getAttribute('aria-expanded') === 'false', selector);
}

async function desktopAssertions(browser, origin) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const cssSession = await createDesktopCssSession(page);

  try {
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
        hoverMedia: matchMedia('(hover:hover) and (pointer:fine)').matches,
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
    assert.equal(initial.hoverMedia, true, 'desktop fixture must emulate hover:hover and pointer:fine');
    assert.equal(initial.doveIcons, 1, 'unnumbered note must render exactly one dove SVG');
    assert.equal(initial.numberedDoveIcons, 0, 'numbered note must not render a dove');
    assert.equal(initial.numberedText, '7', 'numbered marker must retain its visible number');
    assert.equal(initial.triggerText, '', 'dove trigger must not retain a dagger/cross glyph');
    assert.ok(initial.verticalDelta <= 0.5, `dove sits too low (${initial.verticalDelta.toFixed(2)}px)`);
    assert.ok(initial.verticalDelta >= -4, `dove sits too high (${initial.verticalDelta.toFixed(2)}px)`);
    assert.ok(initial.doveWidth >= 11 && initial.doveWidth <= 24, `unexpected dove width ${initial.doveWidth}`);

    await forcePseudoHover(cssSession, '#dove', true);
    await page.waitForTimeout(80);
    const hoverStyle = await page.evaluate(() => ({
      animationName: getComputedStyle(document.querySelector('#dove .fn-dove-wing')).animationName,
      transform: getComputedStyle(document.querySelector('#dove .fn-dove-icon')).transform
    }));
    console.log(`desktop hover style: ${JSON.stringify(hoverStyle)}`);
    assert.match(hoverStyle.animationName, /fn-dove-flap/, 'dove wing must react on desktop hover');
    assert.notEqual(hoverStyle.transform, 'none', 'dove SVG must move subtly on hover');
    await forcePseudoHover(cssSession, '#dove', false);

    const doveTip = await openByPointer(page, '#dove');
    console.log(`desktop dove tooltip: ${JSON.stringify(doveTip)}`);
    assert.equal(doveTip.expanded, 'true');
    assert.equal(doveTip.open, true);
    assert.equal(doveTip.pointerEvents, 'none', 'portaled dove tooltip surface must not intercept adjacent clicks');
    assert.ok(doveTip.left >= 0 && doveTip.right <= doveTip.vw + 1);
    assert.ok(doveTip.top >= 0 && doveTip.bottom <= doveTip.vh + 1);
    await page.screenshot({ path: path.join(REPORTS, 'tooltip-marker-desktop.png'), fullPage: false });
    await closeWithEscape(page, '#dove');

    const numberedTip = await openByPointer(page, '#numbered');
    console.log(`desktop numbered tooltip: ${JSON.stringify(numberedTip)}`);
    assert.equal(numberedTip.pointerEvents, 'none', 'portaled numbered tooltip surface must not intercept its trigger click');
    await closeWithEscape(page, '#numbered');

    const target = await page.evaluate(() => {
      const anchor = document.querySelector('#numbered');
      const rect = anchor.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    await page.mouse.move(target.x, target.y);
    await page.waitForTimeout(80);
    const hit = await page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      const anchor = document.querySelector('#numbered');
      const tip = document.querySelector('body > .tooltip.gb-floating-tip.is-open, body > .gtip.gb-floating-tip.is-open');
      return {
        reachesAnchor: Boolean(element && (element === anchor || anchor.contains(element))),
        hitId: element?.id || '',
        hitClass: typeof element?.className === 'string' ? element.className : '',
        tipPointerEvents: tip ? getComputedStyle(tip).pointerEvents : 'absent'
      };
    }, target);
    console.log(`desktop hit target before click: ${JSON.stringify(hit)}`);
    assert.equal(hit.tipPointerEvents, 'none', 'hover-open floating surface must remain pointer transparent');
    if (!hit.reachesAnchor) assert.match(hit.hitClass, /\bgb-floating-tip\b/, 'non-anchor hit must be the verified pointer-transparent portal');
    await page.mouse.down();
    await page.mouse.up();
    const numberedOpen = await page.evaluate(() => ({
      expanded: document.querySelector('#numbered').getAttribute('aria-expanded'),
      hasDove: Boolean(document.querySelector('#numbered .fn-dove-icon')),
      visibleNumber: Array.from(document.querySelector('#numbered').childNodes).find((node) => node.nodeType === Node.TEXT_NODE)?.textContent.trim()
    }));
    assert.equal(numberedOpen.expanded, 'true', 'numbered source must still open through a real browser click');
    assert.equal(numberedOpen.hasDove, false);
    assert.equal(numberedOpen.visibleNumber, '7');
    assert.deepEqual(errors, [], `desktop page errors: ${errors.join('; ')}`);
  } finally {
    await cssSession.detach();
    await context.close();
  }
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
    const tip = document.querySelector('body > .tooltip.gb-floating-tip.is-open, body > .gtip.gb-floating-tip.is-open');
    const rect = tip.getBoundingClientRect();
    return {
      expanded: anchor.getAttribute('aria-expanded'),
      open: anchor.classList.contains('is-open'),
      pointerEvents: getComputedStyle(tip).pointerEvents,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      vw: innerWidth,
      vh: innerHeight
    };
  });

  console.log(`mobile tooltip: ${JSON.stringify(opened)}`);
  assert.equal(opened.expanded, 'true', 'mobile tap must open the dove tooltip');
  assert.equal(opened.open, true);
  assert.equal(opened.pointerEvents, 'none', 'mobile floating surface must not block outside dismissal');
  assert.ok(opened.left >= -1 && opened.right <= opened.vw + 1);
  assert.ok(opened.top >= -1 && opened.bottom <= opened.vh + 1);

  await page.touchscreen.tap(20, 300);
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => document.querySelector('#dove').getAttribute('aria-expanded')), 'false');
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
