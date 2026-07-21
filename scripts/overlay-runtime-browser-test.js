#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const http = require('http');
const path = require('path');
const playwright = require('playwright');
const browserName = process.env.PW_BROWSER || 'chromium';
const browserType = playwright[browserName];
if (!browserType) throw new Error(`Unsupported PW_BROWSER: ${browserName}`);

const siteUtils = fs.readFileSync(path.join(process.cwd(), 'js/site-utils.js'), 'utf8');
const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
html,body{margin:0;min-height:3000px}.overlay{position:fixed;inset:20px;background:white;padding:20px}.overlay[aria-hidden="true"]{display:none}
</style></head><body>
<main id="background"><button id="openA">Open A</button><button id="openBRoot">Open B root</button><div style="height:3600px"></div></main>
<section id="overlayA" class="overlay" aria-hidden="true"><button id="focusA">A focus</button><button id="openB">Open B</button></section>
<section id="overlayB" class="overlay" aria-hidden="true"><button id="focusB">B focus</button></section>
<script src="/site-utils.js"></script>
</body></html>`;

async function main() {
  const server = http.createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.url === '/site-utils.js') {
      response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      response.end(siteUtils);
      return;
    }
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

  try {
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean(window.OverlayRuntime));
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);

    await page.evaluate(() => {
      document.body.style.overflow = 'auto';
      document.body.style.position = 'relative';
      document.body.style.top = '4px';
      document.body.classList.add('no-scroll');
      document.documentElement.classList.add('cp-scroll-lock');
      document.documentElement.setAttribute('data-scroll-locked', 'legacy');
    });
    await page.evaluate(() => scrollTo(0, 420));
    await page.waitForFunction(() => Math.round(window.scrollY) === 420);
    assert.equal(await page.evaluate(() => Math.round(window.scrollY)), 420, 'precondition: page must be scrolled before opener focus');
    await page.evaluate(() => document.getElementById('openA').focus({ preventScroll: true }));
    assert.equal(await page.evaluate(() => Math.round(window.scrollY)), 420, 'precondition: opener focus must preserve scroll');

    await page.evaluate(() => {
      const runtime = window.OverlayRuntime;
      const background = document.getElementById('background');
      const overlayA = document.getElementById('overlayA');
      const overlayB = document.getElementById('overlayB');
      const closeA = (reason) => runtime.close('browser-a', reason);
      const closeB = (reason) => runtime.close('browser-b', reason);
      runtime.open('browser-a', {
        element: overlayA,
        opener: document.getElementById('openA'),
        focusTarget: document.getElementById('focusA'),
        inertTargets: [background],
        onRequestClose: closeA,
      });
      document.getElementById('openB').focus();
      runtime.open('browser-b', {
        element: overlayB,
        opener: document.getElementById('openB'),
        focusTarget: document.getElementById('focusB'),
        inertTargets: [background, overlayA],
        onRequestClose: closeB,
      });
    });
    await page.waitForTimeout(30);

    let state = await page.evaluate(() => ({
      size: window.OverlayRuntime.size(),
      top: window.OverlayRuntime.topLayer()?.ownerId,
      position: document.body.style.position,
      overflow: document.body.style.overflow,
      backgroundInert: document.getElementById('background').inert,
      overlayAInert: document.getElementById('overlayA').inert,
      active: document.activeElement?.id,
    }));
    assert.deepEqual(state, {
      size: 2,
      top: 'browser-b',
      position: 'fixed',
      overflow: 'hidden',
      backgroundInert: true,
      overlayAInert: true,
      active: 'focusB',
    });

    await page.evaluate(() => window.OverlayRuntime.close('browser-b', 'programmatic'));
    await page.waitForTimeout(30);
    state = await page.evaluate(() => ({
      size: window.OverlayRuntime.size(),
      top: window.OverlayRuntime.topLayer()?.ownerId,
      position: document.body.style.position,
      backgroundInert: document.getElementById('background').inert,
      overlayAInert: document.getElementById('overlayA').inert,
      active: document.activeElement?.id,
    }));
    assert.deepEqual(state, {
      size: 1,
      top: 'browser-a',
      position: 'fixed',
      backgroundInert: true,
      overlayAInert: false,
      active: 'openB',
    });

    await page.evaluate(() => window.OverlayRuntime.close('browser-a', 'programmatic'));
    await page.waitForFunction(() => window.OverlayRuntime.size() === 0 && Math.round(window.scrollY) === 420 && document.activeElement && document.activeElement.id === 'openA');
    state = await page.evaluate(() => ({
      size: window.OverlayRuntime.size(),
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      topStyle: document.body.style.top,
      noScroll: document.body.classList.contains('no-scroll'),
      cpLock: document.documentElement.classList.contains('cp-scroll-lock'),
      lockAttr: document.documentElement.getAttribute('data-scroll-locked'),
      backgroundInert: document.getElementById('background').inert,
      active: document.activeElement?.id,
      scrollY: Math.round(window.scrollY),
    }));
    assert.deepEqual(state, {
      size: 0,
      overflow: 'auto',
      position: 'relative',
      topStyle: '4px',
      noScroll: true,
      cpLock: true,
      lockAttr: 'legacy',
      backgroundInert: false,
      active: 'openA',
      scrollY: 420,
    });

    await page.evaluate(() => {
      const runtime = window.OverlayRuntime;
      const background = document.getElementById('background');
      const overlayA = document.getElementById('overlayA');
      const overlayB = document.getElementById('overlayB');
      document.getElementById('openBRoot').focus({ preventScroll: true });
      runtime.open('reverse-b', {
        element: overlayB,
        opener: document.getElementById('openBRoot'),
        focusTarget: document.getElementById('focusB'),
        inertTargets: [background],
        onRequestClose: (reason) => runtime.close('reverse-b', reason),
      });
      runtime.open('reverse-a', {
        element: overlayA,
        opener: document.getElementById('focusB'),
        focusTarget: document.getElementById('focusA'),
        inertTargets: [background, overlayB],
        onRequestClose: (reason) => runtime.close('reverse-a', reason),
      });
    });
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'focusA');
    await page.evaluate(() => window.OverlayRuntime.close('reverse-a', 'programmatic'));
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'focusB');
    assert.deepEqual(await page.evaluate(() => ({
      b: window.OverlayRuntime.isOpen('reverse-b'),
      a: window.OverlayRuntime.isOpen('reverse-a'),
      top: window.OverlayRuntime.topLayer()?.ownerId,
      position: document.body.style.position,
      overlayBInert: document.getElementById('overlayB').inert,
      active: document.activeElement?.id,
    })), {
      b: true,
      a: false,
      top: 'reverse-b',
      position: 'fixed',
      overlayBInert: false,
      active: 'focusB',
    });
    await page.evaluate(() => window.OverlayRuntime.close('reverse-b', 'programmatic'));
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'openBRoot');
    await page.waitForFunction(() => Math.round(window.scrollY) === 420);
    assert.deepEqual(await page.evaluate(() => ({
      size: window.OverlayRuntime.size(),
      position: document.body.style.position,
      scrollY: Math.round(window.scrollY),
    })), { size: 0, position: 'relative', scrollY: 420 });

    await page.evaluate(() => {
      const runtime = window.OverlayRuntime;
      const background = document.getElementById('background');
      const overlayA = document.getElementById('overlayA');
      const options = { element: overlayA, opener: document.getElementById('openA'), inertTargets: [background] };
      runtime.open('repeat-owner', options);
      runtime.open('repeat-owner', options);
      runtime.close('repeat-owner', 'programmatic');
    });
    await page.waitForTimeout(20);
    assert.deepEqual(await page.evaluate(() => ({
      size: window.OverlayRuntime.size(),
      inert: document.getElementById('background').inert,
      position: document.body.style.position,
    })), { size: 0, inert: false, position: 'relative' });

    await page.evaluate(() => {
      const runtime = window.OverlayRuntime;
      const background = document.getElementById('background');
      const overlayA = document.getElementById('overlayA');
      const overlayB = document.getElementById('overlayB');
      runtime.open('escape-a', {
        element: overlayA,
        inertTargets: [background],
        onRequestClose: (reason) => runtime.close('escape-a', reason),
      });
      runtime.open('escape-b', {
        element: overlayB,
        inertTargets: [background, overlayA],
        onRequestClose: (reason) => runtime.close('escape-b', reason),
      });
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(20);
    assert.deepEqual(await page.evaluate(() => ({
      a: window.OverlayRuntime.isOpen('escape-a'),
      b: window.OverlayRuntime.isOpen('escape-b'),
      top: window.OverlayRuntime.topLayer()?.ownerId,
    })), { a: true, b: false, top: 'escape-a' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(20);
    assert.equal(await page.evaluate(() => window.OverlayRuntime.size()), 0);

    await page.evaluate(() => {
      const runtime = window.OverlayRuntime;
      runtime.open('pagehide-a', { element: document.getElementById('overlayA'), inertTargets: [document.getElementById('background')] });
      runtime.open('pagehide-b', { element: document.getElementById('overlayB'), inertTargets: [document.getElementById('background'), document.getElementById('overlayA')] });
      window.dispatchEvent(new Event('pagehide'));
    });
    await page.waitForTimeout(20);
    assert.deepEqual(await page.evaluate(() => ({
      size: window.OverlayRuntime.size(),
      position: document.body.style.position,
      backgroundInert: document.getElementById('background').inert,
    })), { size: 0, position: 'relative', backgroundInert: false });

    assert.deepEqual(errors, []);
    console.log(`✅ overlay-runtime-browser-test [${browserName}]: forward/reverse nested stack + exact restore + focus + Escape + pagehide + reduced motion`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
