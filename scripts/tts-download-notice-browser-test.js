#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const ENGINE = fs.readFileSync(path.join(ROOT, 'js/vosk-tts-engine.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'css/tts-download-notice.css'), 'utf8');
const REPORTS = path.join(ROOT, 'reports');
fs.mkdirSync(REPORTS, { recursive: true });

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url && req.url.startsWith('/css/tts-download-notice.css')) {
        res.writeHead(200, { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-store' });
        res.end(CSS);
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TTS notice fixture</title></head><body><main>Fixture</main></body></html>');
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, origin: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

async function installFixture(page, dark) {
  await page.goto(page.__origin, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async (darkMode) => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.removeItem('gbx-vosk-warmup');
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase('gb-vosk-tts');
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });

    window.VoskTTSCore = {};
    window.VoskStressLookup = { StressLookup: function StressLookup() {} };
    window.fflate = { unzipSync: function unzipSync() { throw new Error('not reached'); } };
    window.ort = {
      env: { wasm: {} },
      InferenceSession: { create: function create() { throw new Error('not reached'); } },
    };

    window.__modelFetchCount = 0;
    window.__modelFetchAborted = false;
    window.__engineError = null;
    window.fetch = function mockedFetch(url, options) {
      const target = String(url);
      if (target.indexOf('model-quant.zip') !== -1) {
        window.__modelFetchCount += 1;
        return new Promise((resolve, reject) => {
          const signal = options && options.signal;
          if (!signal) {
            reject(new Error('missing AbortSignal'));
            return;
          }
          const abort = () => {
            window.__modelFetchAborted = true;
            reject(new DOMException('Aborted', 'AbortError'));
          };
          if (signal.aborted) abort();
          else signal.addEventListener('abort', abort, { once: true });
        });
      }
      if (target.indexOf('vosk-custom-terms.json') !== -1) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      if (target.indexOf('vosk-stress-marker.bin') !== -1) {
        return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });
      }
      return Promise.reject(new Error(`unexpected fetch: ${target}`));
    };
  }, dark);

  await page.addScriptTag({ content: ENGINE });
  await page.evaluate(() => {
    window.__loadPromise = window.VoskTTSEngine.ensureLoaded().catch((error) => {
      window.__engineError = { name: error && error.name, userCancelled: !!(error && error.userCancelled) };
    });
  });
  await page.waitForSelector('.gb-tts-download-notice.is-visible', { state: 'visible' });
}

async function verifyCard(page, expectedWidth) {
  const snapshot = await page.locator('.gb-tts-download-notice').evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const action = el.querySelector('.gb-tts-download-notice__action');
    return {
      title: el.querySelector('.gb-tts-download-notice__title').textContent.trim(),
      meta: el.querySelector('.gb-tts-download-notice__meta').textContent.trim(),
      action: action.textContent.trim(),
      actionLabel: action.getAttribute('aria-label'),
      ariaLive: el.getAttribute('aria-live'),
      width: rect.width,
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      actionHeight: action.getBoundingClientRect().height,
    };
  });
  assert.equal(snapshot.title, 'Улучшенный голос загружается');
  assert.match(snapshot.meta, /Обычный голос уже работает/);
  assert.match(snapshot.meta, /280 МБ/);
  assert.equal(snapshot.action, 'Не загружать');
  assert.match(snapshot.actionLabel, /Остановить загрузку/);
  assert.equal(snapshot.ariaLive, 'polite');
  assert.ok(snapshot.width <= expectedWidth, `notice width ${snapshot.width} exceeds ${expectedWidth}`);
  assert.ok(snapshot.scrollWidth <= snapshot.viewport, `horizontal overflow ${snapshot.scrollWidth} > ${snapshot.viewport}`);
  return snapshot;
}

async function runDesktop(browser, origin) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  page.__origin = origin;
  await installFixture(page, false);
  const snapshot = await verifyCard(page, 430.5);
  assert.ok(snapshot.actionHeight >= 38, 'desktop cancel target must be at least 38px high');
  await page.screenshot({ path: path.join(REPORTS, 'tts-download-notice-desktop.png') });

  await page.locator('.gb-tts-download-notice__action').click();
  await page.waitForFunction(() => window.__modelFetchAborted === true);
  await page.waitForFunction(() => localStorage.getItem('gbx-vosk-warmup') === 'off');
  await page.waitForFunction(() => {
    const title = document.querySelector('.gb-tts-download-notice__title');
    return title && title.textContent.indexOf('Загрузка остановлена') !== -1;
  });
  await page.evaluate(() => window.__loadPromise);
  const state = await page.evaluate(() => ({
    count: window.__modelFetchCount,
    aborted: window.__modelFetchAborted,
    error: window.__engineError,
    optout: localStorage.getItem('gbx-vosk-warmup'),
  }));
  assert.deepEqual(state, {
    count: 1,
    aborted: true,
    error: { name: 'AbortError', userCancelled: true },
    optout: 'off',
  });

  await page.evaluate(async () => {
    window.__secondError = null;
    await window.VoskTTSEngine.ensureLoaded().catch((error) => {
      window.__secondError = { name: error && error.name, userCancelled: !!(error && error.userCancelled) };
    });
  });
  const retry = await page.evaluate(() => ({
    count: window.__modelFetchCount,
    error: window.__secondError,
  }));
  assert.equal(retry.count, 1, 'opted-out retry must not start another model fetch');
  assert.deepEqual(retry.error, { name: 'AbortError', userCancelled: true });
  await page.close();
}

async function runMobileDark(browser, origin) {
  const page = await browser.newPage({
    viewport: { width: 360, height: 740 },
    isMobile: true,
    hasTouch: true,
  });
  page.__origin = origin;
  await installFixture(page, true);
  const snapshot = await verifyCard(page, 340.5);
  assert.ok(snapshot.actionHeight >= 44, `coarse-pointer target is ${snapshot.actionHeight}px`);
  await page.screenshot({ path: path.join(REPORTS, 'tts-download-notice-mobile-dark.png') });

  await page.locator('.gb-tts-download-notice__action').focus();
  const focusedBefore = await page.evaluate(() => document.activeElement && document.activeElement.className);
  assert.match(String(focusedBefore), /gb-tts-download-notice__action/);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__modelFetchAborted === true);
  const hiddenFocusAfter = await page.evaluate(() => !!(document.activeElement && document.activeElement.hidden));
  assert.equal(hiddenFocusAfter, false, 'keyboard cancellation must not trap focus on a hidden control');
  await page.close();
}

(async () => {
  const { server, origin } = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    await runDesktop(browser, origin);
    await runMobileDark(browser, origin);
    console.log('TTS download notice browser contract: PASS (desktop + mobile dark, pointer + keyboard cancellation).');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
