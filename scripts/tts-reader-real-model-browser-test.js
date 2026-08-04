#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { Readable } = require('node:stream');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const REPORTS = path.join(ROOT, 'reports');
const DEFAULTS = fs.readFileSync(path.join(ROOT, 'src/runtime/reader-tts-defaults.js'), 'utf8');
const READER = fs.readFileSync(path.join(ROOT, 'src/runtime/reader-tts.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'src/runtime/reader-tts.css'), 'utf8');
const ENGINE = fs.readFileSync(path.join(ROOT, 'js/vosk-tts-engine.js'), 'utf8');
const WORKER = fs.readFileSync(path.join(ROOT, 'js/vosk-tts-worker.js'), 'utf8');
const MODEL_URL = 'https://huggingface.co/CurtMil/gb-vosk-tts-model/resolve/main/model-quant.zip';
const SAMPLE = 'Джон Гилл жил в Лондоне в восемнадцатом веке. Иисус Христос — центр христианской проповеди. Ковенантное богословие требует внимательной экзегезы Писания.';
const WARM_TIMEOUT_MS = 15 * 60 * 1000;
const SYNTH_TIMEOUT_MS = 10 * 60 * 1000;
fs.mkdirSync(REPORTS, { recursive: true });

const ASSETS = new Map([
  ['/src/runtime/reader-tts-defaults.js', { data: DEFAULTS, type: 'text/javascript; charset=utf-8' }],
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
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/runtime/reader-tts.css"></head><body><article class="article-body" data-pagefind-body><h1>Реальная модель</h1><p>${SAMPLE}</p></article><button data-fc-action="play" data-state="idle">PLAY</button><script type="module" src="/src/runtime/reader-tts-defaults.js"></script><script type="module" src="/src/runtime/reader-tts.js"></script></body></html>`;
}

function startServer() {
  return new Promise((resolve) => {
    let modelRequests = 0;
    let modelBytes = 0;
    const server = http.createServer(async (req, res) => {
      const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
      try {
        if (pathname === '/model-quant.zip') {
          modelRequests += 1;
          const upstream = await fetch(MODEL_URL, { redirect: 'follow' });
          if (!upstream.ok || !upstream.body) throw new Error(`model proxy HTTP ${upstream.status}`);
          const headers = { 'content-type': upstream.headers.get('content-type') || 'application/zip', 'cache-control': 'no-store' };
          const length = upstream.headers.get('content-length');
          if (length) headers['content-length'] = length;
          res.writeHead(200, headers);
          const stream = Readable.fromWeb(upstream.body);
          stream.on('data', (chunk) => { modelBytes += chunk.length; });
          stream.on('error', (error) => res.destroy(error));
          stream.pipe(res);
          return;
        }
        if (pathname === '/js/vosk-tts-worker.js') {
          const origin = `http://127.0.0.1:${server.address().port}`;
          const proxiedWorker = WORKER.replace(MODEL_URL, `${origin}/model-quant.zip`);
          res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
          res.end(proxiedWorker);
          return;
        }
        const asset = ASSETS.get(pathname);
        if (asset) {
          res.writeHead(200, { 'content-type': asset.type, 'cache-control': 'no-store' });
          if (asset.file) fs.createReadStream(asset.file).pipe(res);
          else res.end(asset.data);
          return;
        }
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        res.end(html());
      } catch (error) {
        res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
        res.end(error.stack || String(error));
      }
    });
    server.listen(0, '127.0.0.1', () => resolve({
      server,
      origin: `http://127.0.0.1:${server.address().port}`,
      metrics: () => ({ modelRequests, modelBytes }),
    }));
  });
}

async function installInstrumentation(page) {
  await page.addInitScript(() => {
    window.__phase = { last: performance.now(), maxGap: 0, ticks: 0, played: false, statuses: [], progress: [] };
    window.__resetPhase = () => {
      window.__phase.last = performance.now();
      window.__phase.maxGap = 0;
      window.__phase.ticks = 0;
    };
    setInterval(() => {
      const now = performance.now();
      window.__phase.maxGap = Math.max(window.__phase.maxGap, now - window.__phase.last);
      window.__phase.last = now;
      window.__phase.ticks += 1;
    }, 25);
    window.addEventListener('gb:vosk-status', (event) => window.__phase.statuses.push({ at: performance.now(), detail: event.detail }));
    window.addEventListener('gb:vosk-synthesis-progress', (event) => window.__phase.progress.push({ at: performance.now(), detail: event.detail }));
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value() { window.__phase.played = true; return Promise.resolve(); },
    });
  });
}

async function deleteDatabase(page) {
  await page.evaluate(() => new Promise((resolve) => {
    const request = indexedDB.deleteDatabase('gb-vosk-tts');
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  }));
}

async function preparePage(context, origin, route, disableShared = false) {
  if (disableShared) {
    await context.addInitScript(() => {
      try { Object.defineProperty(window, 'SharedWorker', { configurable: true, value: undefined }); } catch {}
    });
  }
  const page = await context.newPage();
  await installInstrumentation(page);
  await page.goto(`${origin}/${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.GBReaderTTS?.version === 2);
  const defaults = await page.evaluate(() => ({
    rate: localStorage.getItem('gb:audio:rate'),
    speaker: localStorage.getItem('gb:audio:speaker'),
    readerRate: window.GBReaderTTS.getState().rate,
    mainThreadOrt: typeof window.ort,
    nativeFetch: !/readerVoskFetch/.test(String(window.fetch)),
  }));
  assert.deepEqual(defaults, { rate: '1', speaker: '3', readerRate: 1, mainThreadOrt: 'undefined', nativeFetch: true });
  return page;
}

async function warm(page, label) {
  await page.evaluate(() => { window.__resetPhase(); window.__warmStarted = performance.now(); });
  await Promise.race([
    page.evaluate(() => window.GBReaderTTS.warmVosk({ retry: true })),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}: warm-up timed out`)), WARM_TIMEOUT_MS)),
  ]);
  const result = await page.evaluate(() => ({
    elapsedMs: performance.now() - window.__warmStarted,
    maxGapMs: window.__phase.maxGap,
    ticks: window.__phase.ticks,
    status: window.VoskTTSEngine.getStatus(),
    reader: window.GBReaderTTS.getState(),
    statuses: window.__phase.statuses,
  }));
  console.log(`[real-model:${label}] warm=${result.elapsedMs.toFixed(1)}ms mode=${result.status.workerMode} gap=${result.maxGapMs.toFixed(1)}ms`);
  return result;
}

async function synthesize(page, label) {
  await page.evaluate(() => { window.__phase.played = false; window.__phase.progress = []; window.__resetPhase(); window.__synthStarted = performance.now(); });
  await page.locator('[data-fc-action="play"]').click();
  await page.waitForFunction(() => /^blob:/.test(document.querySelector('audio[data-gb-vosk-audio]')?.currentSrc || document.querySelector('audio[data-gb-vosk-audio]')?.src || ''), null, { timeout: SYNTH_TIMEOUT_MS });
  const result = await page.evaluate(async () => {
    const audio = document.querySelector('audio[data-gb-vosk-audio]');
    const buffer = await fetch(audio.src).then((response) => response.arrayBuffer());
    const view = new DataView(buffer);
    const pcm = new Int16Array(buffer.slice(44));
    let square = 0;
    let peak = 0;
    for (const value of pcm) { square += value * value; peak = Math.max(peak, Math.abs(value)); }
    return {
      elapsedMs: performance.now() - window.__synthStarted,
      maxGapMs: window.__phase.maxGap,
      ticks: window.__phase.ticks,
      bytes: buffer.byteLength,
      duration: (view.getUint32(40, true) / 2) / view.getUint32(24, true),
      rms: Math.sqrt(square / Math.max(1, pcm.length)),
      peak,
      played: window.__phase.played,
      progressEvents: window.__phase.progress.length,
      reader: window.GBReaderTTS.getState(),
    };
  });
  console.log(`[real-model:${label}] synth=${result.elapsedMs.toFixed(1)}ms gap=${result.maxGapMs.toFixed(1)}ms bytes=${result.bytes} rms=${result.rms.toFixed(1)}`);
  assert.ok(result.bytes > 10000 && result.duration > 0.5, `${label}: invalid WAV`);
  assert.ok(result.rms > 50 && result.peak > 200, `${label}: silent WAV`);
  assert.equal(result.played, true, `${label}: playback was not requested`);
  assert.ok(result.progressEvents > 0 && result.reader.synthesisProgress > 0, `${label}: synthesis progress missing`);
  assert.ok(result.maxGapMs < 500, `${label}: synthesis blocked UI for ${result.maxGapMs} ms`);
  return result;
}

(async () => {
  const { server, origin, metrics } = await startServer();
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 760 } });
  const report = {};
  try {
    const blank = await context.newPage();
    await blank.goto(`${origin}/blank`, { waitUntil: 'domcontentloaded' });
    await deleteDatabase(blank);
    await blank.close();

    const owner = await preparePage(context, origin, 'owner');
    report.cold = await warm(owner, 'cold-shared-owner');
    assert.equal(report.cold.status.workerMode, 'shared', 'cold run did not prefer SharedWorker');
    assert.equal(report.cold.status.ready, true, 'cold SharedWorker did not become ready');
    assert.ok(report.cold.maxGapMs < 1000, `cold preparation blocked UI for ${report.cold.maxGapMs} ms`);
    assert.equal(metrics().modelRequests, 1, 'cold run did not request the model exactly once');

    const follower = await preparePage(context, origin, 'follower');
    report.shared = await warm(follower, 'shared-follower');
    assert.equal(report.shared.status.workerMode, 'shared', 'follower did not attach to SharedWorker');
    assert.equal(report.shared.status.ready, true, 'follower did not observe ready sessions');
    assert.ok(report.shared.elapsedMs < 2000, `ready ONNX sessions were not reused (${report.shared.elapsedMs} ms)`);
    assert.ok(report.shared.maxGapMs < 500, `SharedWorker attachment blocked UI for ${report.shared.maxGapMs} ms`);
    assert.equal(metrics().modelRequests, 1, 'SharedWorker follower requested the model again');
    report.sharedSynth = await synthesize(follower, 'shared-follower');

    await follower.goto(`${origin}/navigated`, { waitUntil: 'domcontentloaded' });
    await follower.waitForFunction(() => window.GBReaderTTS?.version === 2);
    report.navigation = await warm(follower, 'shared-navigation');
    assert.equal(report.navigation.status.workerMode, 'shared');
    assert.ok(report.navigation.elapsedMs < 2000, `ready sessions did not survive navigation with an active owner (${report.navigation.elapsedMs} ms)`);
    assert.equal(metrics().modelRequests, 1, 'navigation requested the model again');

    await follower.close();
    await owner.close();

    const cached = await preparePage(context, origin, 'cached-dedicated', true);
    report.cached = await warm(cached, 'cached-dedicated');
    assert.equal(report.cached.status.workerMode, 'dedicated', 'fresh cached run did not exercise Dedicated Worker fallback');
    assert.equal(report.cached.status.ready, true, 'cached Dedicated Worker did not become ready');
    assert.ok(report.cached.maxGapMs < 1000, `cached preparation blocked UI for ${report.cached.maxGapMs} ms`);
    assert.equal(metrics().modelRequests, 1, 'cached run downloaded the model again');
    report.cachedSynth = await synthesize(cached, 'cached-dedicated');
    await cached.screenshot({ path: path.join(REPORTS, 'tts-reader-real-model-cached.png') });
    await cached.close();

    report.model = metrics();
    assert.ok(report.model.modelBytes > 200 * 1024 * 1024, `model proxy transferred too little data (${report.model.modelBytes})`);
    fs.writeFileSync(path.join(REPORTS, 'tts-reader-real-model.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log('[TTS-READER-REAL-MODEL]', JSON.stringify(report));
    console.log('Reader TTS real model, SharedWorker reuse and cache fallback contract: PASS');
  } finally {
    await browser.close().catch(() => {});
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 2000);
      server.close(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
