#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium, webkit } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const ENGINE = fs.readFileSync(path.join(ROOT, 'js/vosk-tts-engine.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'css/tts-download-notice.css'), 'utf8');
const REPORTS = path.join(ROOT, 'reports');
fs.mkdirSync(REPORTS, { recursive: true });
const MODEL_URL = 'https://huggingface.co/CurtMil/gb-vosk-tts-model/resolve/main/model-quant.zip';

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url.startsWith('/css/tts-download-notice.css')) {
        res.writeHead(200, { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-store' });
        res.end(CSS);
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main>fixture</main></body></html>');
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: 'http://127.0.0.1:' + server.address().port }));
  });
}

async function reset(page) {
  await page.goto(page.__origin, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    localStorage.removeItem('gbx-vosk-warmup');
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase('gb-vosk-tts');
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  });
}

async function installDependencies(page, sessionMode) {
  await page.evaluate((mode) => {
    window.VoskTTSCore = {
      parseDictionary: () => new Map(),
      WordPieceTokenizer: function WordPieceTokenizer() {},
    };
    window.VoskStressLookup = { StressLookup: function StressLookup() {} };
    window.fflate = { unzipSync: () => ({}) };
    window.ort = {
      env: { wasm: {} },
      InferenceSession: {
        create: () => mode === 'reject'
          ? Promise.reject(new Error('fixture session failure'))
          : Promise.resolve({ inputNames: [], outputNames: [] }),
      },
    };
  }, sessionMode);
}

async function putCachedModel(page) {
  await page.evaluate(async (modelUrl) => {
    const enc = new TextEncoder();
    const files = {
      'model.onnx': new Uint8Array([1, 2, 3]),
      'dictionary': enc.encode(''),
      'config.json': enc.encode('{"model_type":"multistream_v1"}'),
    };
    await new Promise((resolve, reject) => {
      const open = indexedDB.open('gb-vosk-tts', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('files');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction('files', 'readwrite');
        tx.objectStore('files').put(files, modelUrl);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      };
    });
  }, MODEL_URL);
}

async function cachedFailure(browserType, origin, name) {
  const browser = await browserType.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  page.__origin = origin;
  try {
    await reset(page);
    await installDependencies(page, 'reject');
    await putCachedModel(page);
    await page.addScriptTag({ content: ENGINE });
    await page.evaluate(() => window.VoskTTSEngine.ensureLoaded().catch(() => null));
    await page.waitForSelector('.gb-tts-download-notice[data-state="error"].is-visible');
    const snap = await page.locator('.gb-tts-download-notice').evaluate((el) => ({
      title: el.querySelector('.gb-tts-download-notice__title').textContent,
      action: el.querySelector('.gb-tts-download-notice__action').textContent,
      status: window.VoskTTSEngine.getStatus(),
    }));
    assert.match(snap.title, /не запустился/i);
    assert.equal(snap.action, 'Повторить');
    assert.equal(snap.status.phase, 'error');
    await page.screenshot({ path: path.join(REPORTS, 'tts-lifecycle-' + name + '-cached-error.png') });
  } finally {
    await browser.close();
  }
}

async function cachedReady(browserType, origin, name) {
  const browser = await browserType.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  page.__origin = origin;
  try {
    await reset(page);
    await installDependencies(page, 'resolve');
    await putCachedModel(page);
    await page.addScriptTag({ content: ENGINE });
    await page.evaluate(() => window.VoskTTSEngine.ensureLoaded());
    await page.waitForSelector('.gb-tts-download-notice[data-state="ready"].is-visible');
    const before = await page.locator('.gb-tts-download-notice').evaluate((el) => ({
      title: el.querySelector('.gb-tts-download-notice__title').textContent,
      action: el.querySelector('.gb-tts-download-notice__action').textContent,
      width: el.getBoundingClientRect().width,
      viewport: innerWidth,
      status: window.VoskTTSEngine.getStatus(),
    }));
    assert.equal(before.title, 'Улучшенный голос готов');
    assert.equal(before.action, 'Включить сейчас');
    assert.equal(before.status.ready, true);
    assert.ok(before.width <= before.viewport - 18);
    await page.evaluate(() => {
      window.__switchRequested = false;
      addEventListener('gb:vosk-switch-request', () => { window.__switchRequested = true; }, { once: true });
    });
    await page.locator('.gb-tts-download-notice__action').click();
    assert.equal(await page.evaluate(() => window.__switchRequested), true);
    await page.screenshot({ path: path.join(REPORTS, 'tts-lifecycle-' + name + '-mobile-ready.png') });
  } finally {
    await browser.close();
  }
}


async function delayedRafFirstPaint(browserType, origin, name) {
  const browser = await browserType.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  page.__origin = origin;
  try {
    await reset(page);
    await page.evaluate(() => {
      window.__queuedTtsRaf = [];
      window.requestAnimationFrame = (callback) => {
        window.__queuedTtsRaf.push(callback);
        return window.__queuedTtsRaf.length;
      };
    });
    await page.addScriptTag({ content: ENGINE });
    const snap = await page.evaluate(() => {
      const notice = window.VoskTTSEngine.showStatus('browser');
      return {
        visible: notice.classList.contains('is-visible'),
        state: notice.getAttribute('data-state'),
        queuedRaf: window.__queuedTtsRaf.length,
      };
    });
    assert.equal(snap.state, 'browser');
    assert.equal(snap.visible, true, name + ': browser status must be visible before any RAF callback');
    assert.equal(snap.queuedRaf, 0, name + ': first status visibility must not enqueue RAF');
  } finally {
    await browser.close();
  }
}

(async () => {
  const { server, origin } = await startServer();
  try {
    await delayedRafFirstPaint(chromium, origin, 'chromium');
    await delayedRafFirstPaint(webkit, origin, 'webkit');
    await cachedFailure(chromium, origin, 'chromium');
    await cachedReady(chromium, origin, 'chromium');
    await cachedFailure(webkit, origin, 'webkit');
    await cachedReady(webkit, origin, 'webkit');
    console.log('TTS engine lifecycle browser contract: PASS (Chromium + WebKit, synchronous first paint + cached error + ready/switch).');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exit(1); });
