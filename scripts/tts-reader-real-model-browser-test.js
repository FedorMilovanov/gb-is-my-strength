#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const REPORTS = path.join(ROOT, 'reports');
const READER = fs.readFileSync(path.join(ROOT, 'src/runtime/reader-tts.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'src/runtime/reader-tts.css'), 'utf8');
const ENGINE = fs.readFileSync(path.join(ROOT, 'js/vosk-tts-engine.js'), 'utf8');
const SAMPLE = 'Джон Гилл жил в Лондоне в восемнадцатом веке. Иисус Христос — центр христианской проповеди. Ковенантное богословие требует внимательной экзегезы Писания.';
fs.mkdirSync(REPORTS, { recursive: true });

const ASSETS = new Map([
  ['/src/runtime/reader-tts.js', { data: READER, type: 'text/javascript; charset=utf-8' }],
  ['/src/runtime/reader-tts.css', { data: CSS, type: 'text/css; charset=utf-8' }],
  ['/js/vosk-tts-engine.js', { data: ENGINE, type: 'text/javascript; charset=utf-8' }],
  ['/js/vosk-tts-core.js', { file: path.join(ROOT, 'js/vosk-tts-core.js'), type: 'text/javascript; charset=utf-8' }],
  ['/js/vosk-stress-lookup.js', { file: path.join(ROOT, 'js/vosk-stress-lookup.js'), type: 'text/javascript; charset=utf-8' }],
  ['/js/vosk-custom-terms.json', { file: path.join(ROOT, 'js/vosk-custom-terms.json'), type: 'application/json; charset=utf-8' }],
  ['/js/vosk-stress-marker.bin', { file: path.join(ROOT, 'js/vosk-stress-marker.bin'), type: 'application/octet-stream' }],
  ['/css/tts-download-notice.css', { file: path.join(ROOT, 'css/tts-download-notice.css'), type: 'text/css; charset=utf-8' }],
]);

function html() {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/runtime/reader-tts.css"></head><body><article class="article-body" data-pagefind-body><h1>Реальная модель</h1><p>${SAMPLE}</p></article><button data-fc-action="play" data-state="idle">PLAY</button><script type="module" src="/src/runtime/reader-tts.js"></script></body></html>`;
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
      const asset = ASSETS.get(pathname);
      if (asset) {
        res.writeHead(200, { 'content-type': asset.type, 'cache-control': 'no-store' });
        if (asset.file) fs.createReadStream(asset.file).pipe(res);
        else res.end(asset.data);
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(html());
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

async function deleteDatabase(page) {
  await page.evaluate(() => new Promise((resolve) => {
    const request = indexedDB.deleteDatabase('gb-vosk-tts');
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  }));
}

async function installHeartbeat(page) {
  await page.addInitScript(() => {
    window.__readerPhase = { last: performance.now(), maxGap: 0, ticks: 0, mediaPlayCalled: false };
    window.__resetReaderHeartbeat = () => {
      window.__readerPhase.last = performance.now();
      window.__readerPhase.maxGap = 0;
      window.__readerPhase.ticks = 0;
    };
    setInterval(() => {
      const now = performance.now();
      window.__readerPhase.maxGap = Math.max(window.__readerPhase.maxGap, now - window.__readerPhase.last);
      window.__readerPhase.last = now;
      window.__readerPhase.ticks += 1;
    }, 25);
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: function play() {
        window.__readerPhase.mediaPlayCalled = true;
        return Promise.resolve();
      },
    });
  });
}

async function wavSnapshot(page) {
  return page.evaluate(async () => {
    const audio = Array.from(document.querySelectorAll('audio')).find((item) => /^blob:/.test(item.currentSrc || item.src || ''));
    if (!audio) throw new Error('reader did not create a Vosk audio blob');
    const buffer = await fetch(audio.src).then((response) => response.arrayBuffer());
    const view = new DataView(buffer);
    const sampleRate = view.getUint32(24, true);
    const sampleCount = view.getUint32(40, true) / 2;
    const pcm = new Int16Array(buffer.slice(44));
    let squareSum = 0;
    let peak = 0;
    for (const value of pcm) {
      squareSum += value * value;
      peak = Math.max(peak, Math.abs(value));
    }
    return {
      bytes: buffer.byteLength,
      duration: sampleCount / sampleRate,
      rms: Math.sqrt(squareSum / Math.max(1, pcm.length)),
      peak,
      mediaPlayCalled: window.__readerPhase.mediaPlayCalled,
    };
  });
}

async function runOne(context, origin, mode) {
  const page = await context.newPage();
  const modelRequests = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('model-quant.zip') || url.includes('aws.cdn.hf.co')) modelRequests.push(url);
  });
  await installHeartbeat(page);
  await page.goto(origin + '/blank', { waitUntil: 'domcontentloaded' });
  if (mode === 'cold') await deleteDatabase(page);
  await page.goto(origin + '/reader', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.GBReaderTTS?.version === 1);

  await page.evaluate(() => { window.__resetReaderHeartbeat(); window.__loadStarted = performance.now(); });
  await page.evaluate(() => window.GBReaderTTS.warmVosk({ retry: true }));
  const load = await page.evaluate(() => ({
    elapsedMs: performance.now() - window.__loadStarted,
    maxGapMs: window.__readerPhase.maxGap,
    ticks: window.__readerPhase.ticks,
    proxy: window.ort?.env?.wasm?.proxy,
    status: window.VoskTTSEngine?.getStatus?.(),
  }));

  await page.evaluate(() => { window.__readerPhase.mediaPlayCalled = false; window.__resetReaderHeartbeat(); window.__synthStarted = performance.now(); });
  await page.locator('[data-fc-action="play"]').click();
  await page.waitForFunction(() => Array.from(document.querySelectorAll('audio')).some((item) => /^blob:/.test(item.currentSrc || item.src || '')), null, { timeout: 15 * 60 * 1000 });
  const synthTiming = await page.evaluate(() => ({ elapsedMs: performance.now() - window.__synthStarted, maxGapMs: window.__readerPhase.maxGap, ticks: window.__readerPhase.ticks, state: window.GBReaderTTS.getState() }));
  const wav = await wavSnapshot(page);
  await page.screenshot({ path: path.join(REPORTS, `tts-reader-real-model-${mode}.png`) });
  await page.close();
  return { mode, modelRequests: modelRequests.length, load, synth: { ...synthTiming, ...wav } };
}

(async () => {
  const { server, origin } = await startServer();
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 760 } });
  try {
    const cold = await runOne(context, origin, 'cold');
    const cached = await runOne(context, origin, 'cached');
    assert.ok(cold.modelRequests > 0, 'cold reader run did not download the model');
    assert.equal(cached.modelRequests, 0, 'cached reader run downloaded the model again');
    for (const result of [cold, cached]) {
      assert.equal(result.load.proxy, true, `${result.mode}: ORT proxy is not active`);
      assert.equal(result.load.status?.ready, true, `${result.mode}: Vosk did not become ready`);
      assert.ok(result.synth.bytes > 10000 && result.synth.duration > 0.5, `${result.mode}: invalid WAV`);
      assert.ok(result.synth.rms > 50 && result.synth.peak > 200, `${result.mode}: silent WAV`);
      assert.equal(result.synth.mediaPlayCalled, true, `${result.mode}: playback was not requested`);
    }
    assert.ok(cached.load.maxGapMs < 5000, `cached model preparation still blocked UI for ${cached.load.maxGapMs.toFixed(1)} ms`);
    assert.ok(cached.synth.maxGapMs < 5000, `cached synthesis still blocked UI for ${cached.synth.maxGapMs.toFixed(1)} ms`);
    assert.ok(cold.synth.maxGapMs < 5000, `cold synthesis still blocked UI for ${cold.synth.maxGapMs.toFixed(1)} ms`);
    const report = { cold, cached };
    fs.writeFileSync(path.join(REPORTS, 'tts-reader-real-model.json'), JSON.stringify(report, null, 2));
    console.log('[TTS-READER-REAL-MODEL]', JSON.stringify(report));
    console.log('Reader TTS real model contract: PASS');
  } finally {
    await context.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
