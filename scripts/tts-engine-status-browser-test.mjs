#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATUS = fs.readFileSync(path.join(ROOT, 'js', 'tts-engine-status.mjs'), 'utf8');
const REPORTS = path.join(ROOT, 'reports');
fs.mkdirSync(REPORTS, { recursive: true });

const ENGINE_MOCK = `
(() => {
  let ready = false;
  let loading = null;
  window.__mockEnsureCalls = 0;
  window.__mockCancelCalls = 0;
  window.VoskTTSEngine = {
    isSupported: () => true,
    isReady: () => ready,
    ensureLoaded: () => {
      window.__mockEnsureCalls += 1;
      if (loading) return loading;
      window.dispatchEvent(new CustomEvent('gb:vosk-model-download-start'));
      loading = new Promise((resolve, reject) => {
        setTimeout(() => {
          if (window.__mockEngineMode === 'error-once' && window.__mockEnsureCalls === 1) {
            loading = null;
            const error = new Error('mock model failure');
            window.dispatchEvent(new CustomEvent('gb:vosk-model-download-error', { detail: { message: error.message } }));
            reject(error);
            return;
          }
          ready = true;
          window.dispatchEvent(new CustomEvent('gb:vosk-model-download-complete'));
          resolve();
        }, 80);
      });
      return loading;
    },
    cancelLoading: () => {
      window.__mockCancelCalls += 1;
      localStorage.setItem('gbx-vosk-warmup', 'off');
      window.dispatchEvent(new CustomEvent('gb:vosk-model-download-cancelled'));
      return true;
    },
  };
})();`;

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (url.pathname === '/js/tts-engine-status.mjs') {
        res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
        res.end(STATUS);
        return;
      }
      if (url.pathname === '/js/vosk-tts-engine.js') {
        res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
        res.end(ENGINE_MOCK);
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TTS status fixture</title><script type="module" src="/js/tts-engine-status.mjs?v=test"></script></head><body><main><article><p>Тестовая статья для озвучки.</p></article></main></body></html>`);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

async function waitForApi(page) {
  await page.waitForFunction(() => Boolean(window.GBTtsEngineStatus));
}

async function dispatchPlaying(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('gb:tts-state', { detail: { state: 'playing', progress: 0 } })));
  await page.waitForSelector('#gb-tts-engine-status.is-visible', { state: 'visible' });
}

async function snapshot(page) {
  return page.locator('#gb-tts-engine-status').evaluate((el) => {
    const action = el.querySelector('.gb-tts-engine-status__action');
    const rect = el.getBoundingClientRect();
    return {
      kind: el.dataset.kind,
      title: el.querySelector('.gb-tts-engine-status__title').textContent.trim(),
      meta: el.querySelector('.gb-tts-engine-status__meta').textContent.trim(),
      action: action.hidden ? '' : action.textContent.trim(),
      actionHeight: action.hidden ? 0 : action.getBoundingClientRect().height,
      width: rect.width,
      right: rect.right,
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      ariaLive: el.getAttribute('aria-live'),
    };
  });
}

async function runOptOutRetry(browser, origin, label) {
  console.log(`[scenario] ${label}: desktop opt-out + retry`);
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await waitForApi(page);
  await page.evaluate(() => localStorage.setItem('gbx-vosk-warmup', 'off'));
  await dispatchPlaying(page);
  let state = await snapshot(page);
  assert.equal(state.kind, 'disabled');
  assert.match(state.title, /браузерный голос/i);
  assert.match(state.meta, /ранее был отключён/i);
  assert.equal(state.action, 'Включить');
  assert.equal(state.ariaLive, 'polite');
  assert.ok(state.width <= 370.5);
  assert.ok(state.scrollWidth <= state.viewport);
  await page.screenshot({ path: path.join(REPORTS, `tts-engine-status-${label}-desktop-optout.png`) });

  await page.locator('.gb-tts-engine-status__action').click();
  await page.waitForFunction(() => localStorage.getItem('gbx-vosk-warmup') === null);
  await page.waitForFunction(() => window.VoskTTSEngine && window.VoskTTSEngine.isReady());
  await page.waitForFunction(() => {
    const title = document.querySelector('.gb-tts-engine-status__title');
    return title && /Улучшенный голос готов/.test(title.textContent);
  });
  state = await snapshot(page);
  assert.equal(state.kind, 'ready');
  assert.equal(await page.evaluate(() => window.__mockEnsureCalls), 1);
  await page.close();
}

async function runReady(browser, origin, label) {
  console.log(`[scenario] ${label}: enhanced ready`);
  const page = await browser.newPage({ viewport: { width: 1024, height: 720 } });
  await page.addInitScript(() => {
    window.VoskTTSEngine = { isReady: () => true, isSupported: () => true };
  });
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await waitForApi(page);
  await dispatchPlaying(page);
  const state = await snapshot(page);
  assert.equal(state.kind, 'ready');
  assert.equal(state.title, 'Улучшенный голос включён');
  assert.match(state.meta, /Локальная модель работает/);
  await page.close();
}

async function runMobileSaveData(browser, origin, label) {
  console.log(`[scenario] ${label}: mobile Save-Data`);
  const page = await browser.newPage({ viewport: { width: 360, height: 740 }, hasTouch: true });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } });
  });
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await waitForApi(page);
  await dispatchPlaying(page);
  const state = await snapshot(page);
  assert.equal(state.kind, 'disabled');
  assert.match(state.meta, /экономии трафика/i);
  assert.equal(state.action, 'Загрузить');
  assert.ok(state.actionHeight >= 44, `touch target ${state.actionHeight}px`);
  assert.ok(state.width <= 340.5, `mobile width ${state.width}px`);
  assert.ok(state.scrollWidth <= state.viewport, `overflow ${state.scrollWidth} > ${state.viewport}`);
  assert.ok(state.right <= state.viewport + 0.5);
  await page.screenshot({ path: path.join(REPORTS, `tts-engine-status-${label}-mobile-dark.png`) });
  await page.close();
}

async function runErrorRetry(browser, origin) {
  console.log('[scenario] chromium: error + retry');
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await waitForApi(page);
  await page.evaluate(() => { window.__mockEngineMode = 'error-once'; });
  await dispatchPlaying(page);
  await page.evaluate(() => window.GBTtsEngineStatus.retryEnhanced());
  await page.waitForFunction(() => {
    const el = document.querySelector('#gb-tts-engine-status');
    return el && el.dataset.kind === 'error';
  });
  let state = await snapshot(page);
  assert.equal(state.action, 'Повторить');
  assert.match(state.meta, /продолжает работать/i);
  await page.locator('.gb-tts-engine-status__action').click();
  await page.waitForFunction(() => window.VoskTTSEngine && window.VoskTTSEngine.isReady());
  state = await snapshot(page);
  assert.equal(state.kind, 'ready');
  assert.equal(await page.evaluate(() => window.__mockEnsureCalls), 2);
  await page.close();
}

(async () => {
  const { server, origin } = await startServer();
  const chromiumBrowser = await chromium.launch({ headless: true });
  const webkitBrowser = await webkit.launch({ headless: true });
  try {
    await runOptOutRetry(chromiumBrowser, origin, 'chromium');
    await runReady(chromiumBrowser, origin, 'chromium');
    await runMobileSaveData(chromiumBrowser, origin, 'chromium');
    await runErrorRetry(chromiumBrowser, origin);
    await runOptOutRetry(webkitBrowser, origin, 'webkit');
    await runReady(webkitBrowser, origin, 'webkit');
    await runMobileSaveData(webkitBrowser, origin, 'webkit');
    console.log('TTS engine status browser contract: PASS (Chromium + WebKit, desktop + mobile, opt-out + save-data + retry + ready).');
  } finally {
    await chromiumBrowser.close();
    await webkitBrowser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  const failure = error && error.stack ? error.stack : String(error);
  fs.writeFileSync(path.join(REPORTS, 'tts-engine-status-failure.txt'), failure + '\n', 'utf8');
  console.error(error);
  process.exit(1);
});
