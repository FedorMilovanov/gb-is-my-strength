#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const REPORTS = path.join(ROOT, 'reports');
const REPORT_PATH = path.join(REPORTS, 'tts-reader-real-model.json');
const DEFAULTS = fs.readFileSync(path.join(ROOT, 'src/runtime/reader-tts-defaults.js'), 'utf8');
const READER = fs.readFileSync(path.join(ROOT, 'src/runtime/reader-tts.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'src/runtime/reader-tts.css'), 'utf8');
const ENGINE = fs.readFileSync(path.join(ROOT, 'js/vosk-tts-engine.js'), 'utf8');
const WORKER = fs.readFileSync(path.join(ROOT, 'js/vosk-tts-worker.js'), 'utf8');
const SAMPLE = 'Джон Гилл жил в Лондоне в восемнадцатом веке. Иисус Христос — центр христианской проповеди. Ковенантное богословие требует внимательной экзегезы Писания.';
const WARM_TIMEOUT_MS = 15 * 60 * 1000;
const SYNTH_TIMEOUT_MS = 10 * 60 * 1000;
const POLL_MS = 10 * 1000;
fs.mkdirSync(REPORTS, { recursive: true });

const ASSETS = new Map([
  ['/src/runtime/reader-tts-defaults.js', { data: DEFAULTS, type: 'text/javascript; charset=utf-8' }],
  ['/src/runtime/reader-tts.js', { data: READER, type: 'text/javascript; charset=utf-8' }],
  ['/src/runtime/reader-tts.css', { data: CSS, type: 'text/css; charset=utf-8' }],
  ['/js/vosk-tts-engine.js', { data: ENGINE, type: 'text/javascript; charset=utf-8' }],
  ['/js/vosk-tts-worker.js', { data: WORKER, type: 'text/javascript; charset=utf-8' }],
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

function writeReport(report) {
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function compactError(error) {
  return {
    name: error?.name || 'Error',
    message: error?.message || String(error || 'unknown error'),
    stack: String(error?.stack || '').slice(0, 6000),
  };
}

function relevantUrl(url) {
  return /vosk|onnxruntime|fflate|huggingface|aws\.cdn\.hf\.co|jsdelivr|stress-marker/i.test(String(url || ''));
}

async function deleteDatabase(page) {
  await page.evaluate(() => new Promise((resolve) => {
    const request = indexedDB.deleteDatabase('gb-vosk-tts');
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  }));
}

async function installDiagnostics(page) {
  await page.addInitScript(() => {
    window.__readerPhase = { last: performance.now(), maxGap: 0, ticks: 0, mediaPlayCalled: false };
    window.__voskEvidence = {
      createdAt: performance.now(),
      statuses: [],
      progress: [],
      errors: [],
      rejections: [],
      plays: [],
    };
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
    window.addEventListener('gb:vosk-status', (event) => {
      window.__voskEvidence.statuses.push({ at: performance.now(), detail: event.detail || null });
    });
    window.addEventListener('gb:vosk-synthesis-progress', (event) => {
      window.__voskEvidence.progress.push({ at: performance.now(), detail: event.detail || null });
    });
    window.addEventListener('error', (event) => {
      window.__voskEvidence.errors.push({
        at: performance.now(),
        message: event.message || String(event.error || 'window error'),
        filename: event.filename || '',
        line: event.lineno || 0,
        column: event.colno || 0,
      });
    });
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      window.__voskEvidence.rejections.push({
        at: performance.now(),
        name: reason?.name || '',
        message: reason?.message || String(reason || 'unhandled rejection'),
      });
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: function play() {
        window.__readerPhase.mediaPlayCalled = true;
        window.__voskEvidence.plays.push({ at: performance.now(), src: this.currentSrc || this.src || '' });
        return Promise.resolve();
      },
    });
  });
}

function attachPageDiagnostics(page, mode, diagnostics) {
  page.on('console', (message) => {
    const entry = { at: Date.now(), type: message.type(), text: message.text().slice(0, 4000) };
    diagnostics.console.push(entry);
    console.log(`[real-model:${mode}:console:${entry.type}] ${entry.text}`);
  });
  page.on('pageerror', (error) => {
    const entry = { at: Date.now(), ...compactError(error) };
    diagnostics.pageErrors.push(entry);
    console.error(`[real-model:${mode}:pageerror] ${entry.message}`);
  });
  page.on('worker', (worker) => {
    const entry = { at: Date.now(), url: worker.url() };
    diagnostics.workers.push(entry);
    console.log(`[real-model:${mode}:worker] ${entry.url}`);
    worker.on('close', () => diagnostics.workerCloses.push({ at: Date.now(), url: entry.url }));
  });
  page.on('request', (request) => {
    const url = request.url();
    if (!relevantUrl(url)) return;
    diagnostics.network.push({ at: Date.now(), event: 'request', method: request.method(), url });
  });
  page.on('response', (response) => {
    const url = response.url();
    if (!relevantUrl(url)) return;
    diagnostics.network.push({ at: Date.now(), event: 'response', status: response.status(), url });
    console.log(`[real-model:${mode}:response:${response.status()}] ${url}`);
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (!relevantUrl(url)) return;
    const failure = request.failure();
    diagnostics.network.push({ at: Date.now(), event: 'requestfailed', error: failure?.errorText || '', url });
    console.error(`[real-model:${mode}:requestfailed] ${failure?.errorText || ''} ${url}`);
  });
}

async function pageSnapshot(page) {
  if (page.isClosed()) return { closed: true };
  return page.evaluate(() => ({
    reader: window.GBReaderTTS?.getState?.() || null,
    engine: window.VoskTTSEngine?.getStatus?.() || null,
    engineVersion: window.VoskTTSEngine?.version || 0,
    warmOutcome: window.__warmOutcome || null,
    heartbeat: window.__readerPhase || null,
    evidence: window.__voskEvidence || null,
    audio: (() => {
      const element = document.querySelector('audio[data-gb-vosk-audio]');
      return element ? {
        src: element.currentSrc || element.src || '',
        paused: element.paused,
        readyState: element.readyState,
        networkState: element.networkState,
      } : null;
    })(),
  }));
}

async function pollWarm(page, mode) {
  const deadline = Date.now() + WARM_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const snapshot = await pageSnapshot(page);
    const phase = snapshot.engine?.phase || 'no-engine';
    console.log(`[real-model:${mode}:warm] phase=${phase} ready=${!!snapshot.engine?.ready} done=${!!snapshot.warmOutcome?.done}`);
    if (snapshot.warmOutcome?.done) return snapshot;
    await page.waitForTimeout(POLL_MS);
  }
  throw new Error(`${mode}: Vosk warm-up did not settle within ${WARM_TIMEOUT_MS} ms`);
}

async function pollAudio(page, mode) {
  const deadline = Date.now() + SYNTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const snapshot = await pageSnapshot(page);
    const blobReady = /^blob:/.test(snapshot.audio?.src || '');
    console.log(`[real-model:${mode}:synth] reader=${snapshot.reader?.phase || 'missing'} engine=${snapshot.engine?.phase || 'missing'} progress=${snapshot.reader?.synthesisProgress || 0} blob=${blobReady}`);
    if (blobReady) return snapshot;
    if (snapshot.reader?.phase === 'error') {
      throw new Error(`${mode}: reader entered error phase before Vosk audio was delivered`);
    }
    await page.waitForTimeout(POLL_MS);
  }
  throw new Error(`${mode}: Vosk audio was not delivered within ${SYNTH_TIMEOUT_MS} ms`);
}

async function wavSnapshot(page) {
  return page.evaluate(async () => {
    const audio = document.querySelector('audio[data-gb-vosk-audio]');
    if (!audio || !/^blob:/.test(audio.currentSrc || audio.src || '')) throw new Error('reader did not create a Vosk audio blob');
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
  const diagnostics = {
    mode,
    startedAt: new Date().toISOString(),
    console: [],
    pageErrors: [],
    workers: [],
    workerCloses: [],
    network: [],
    stages: [],
  };
  attachPageDiagnostics(page, mode, diagnostics);
  await installDiagnostics(page);

  try {
    diagnostics.stages.push({ name: 'blank', at: Date.now() });
    await page.goto(origin + '/blank', { waitUntil: 'domcontentloaded' });
    if (mode === 'cold') await deleteDatabase(page);

    diagnostics.stages.push({ name: 'reader', at: Date.now() });
    await page.goto(origin + '/reader', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.GBReaderTTS?.version === 2);
    const defaults = await page.evaluate(() => ({
      rate: localStorage.getItem('gb:audio:rate'),
      speaker: localStorage.getItem('gb:audio:speaker'),
      state: window.GBReaderTTS.getState(),
      mainThreadOrt: typeof window.ort,
      nativeFetch: !/readerVoskFetch/.test(String(window.fetch)),
    }));
    assert.equal(defaults.rate, '1', `${mode}: production default rate was not initialized`);
    assert.equal(defaults.speaker, '3', `${mode}: production default speaker was not initialized`);
    assert.equal(defaults.state.rate, 1, `${mode}: reader did not consume the default rate`);
    assert.equal(defaults.mainThreadOrt, 'undefined', `${mode}: ONNX leaked into the document thread`);
    assert.equal(defaults.nativeFetch, true, `${mode}: global fetch was intercepted`);

    diagnostics.stages.push({ name: 'warm-start', at: Date.now() });
    await page.evaluate(() => {
      window.__resetReaderHeartbeat();
      window.__loadStarted = performance.now();
      window.__warmOutcome = { done: false, returnedEngine: false, ready: false, error: null };
      window.GBReaderTTS.warmVosk({ retry: true }).then((engine) => {
        window.__warmOutcome = {
          done: true,
          returnedEngine: !!engine,
          ready: !!engine?.isReady?.(),
          error: null,
        };
      }).catch((error) => {
        window.__warmOutcome = {
          done: true,
          returnedEngine: false,
          ready: false,
          error: { name: error?.name || '', message: error?.message || String(error || '') },
        };
      });
    });
    const warmSnapshot = await pollWarm(page, mode);
    const load = await page.evaluate(() => ({
      elapsedMs: performance.now() - window.__loadStarted,
      maxGapMs: window.__readerPhase.maxGap,
      ticks: window.__readerPhase.ticks,
      status: window.VoskTTSEngine?.getStatus?.(),
      engineVersion: window.VoskTTSEngine?.version,
      outcome: window.__warmOutcome,
    }));
    assert.equal(load.outcome?.returnedEngine, true, `${mode}: warmVosk returned fallback/null\n${JSON.stringify(warmSnapshot, null, 2)}`);
    assert.equal(load.outcome?.ready, true, `${mode}: warmVosk returned before Vosk was ready\n${JSON.stringify(warmSnapshot, null, 2)}`);
    assert.equal(load.status?.ready, true, `${mode}: Vosk did not become ready\n${JSON.stringify(warmSnapshot, null, 2)}`);

    diagnostics.stages.push({ name: 'synth-start', at: Date.now() });
    await page.evaluate(() => {
      window.__readerPhase.mediaPlayCalled = false;
      window.__resetReaderHeartbeat();
      window.__synthStarted = performance.now();
    });
    await page.locator('[data-fc-action="play"]').click();
    await pollAudio(page, mode);
    const synthTiming = await page.evaluate(() => ({
      elapsedMs: performance.now() - window.__synthStarted,
      maxGapMs: window.__readerPhase.maxGap,
      ticks: window.__readerPhase.ticks,
      state: window.GBReaderTTS.getState(),
    }));
    const wav = await wavSnapshot(page);
    const finalSnapshot = await pageSnapshot(page);
    await page.screenshot({ path: path.join(REPORTS, `tts-reader-real-model-${mode}.png`) });
    diagnostics.finishedAt = new Date().toISOString();
    diagnostics.finalSnapshot = finalSnapshot;

    return {
      mode,
      modelRequests: diagnostics.network.filter((entry) => entry.event === 'request' && (entry.url.includes('model-quant.zip') || entry.url.includes('aws.cdn.hf.co'))).length,
      workerRequests: diagnostics.network.filter((entry) => entry.event === 'request' && entry.url.includes('/js/vosk-tts-worker.js')).length,
      load,
      synth: { ...synthTiming, ...wav },
      diagnostics,
    };
  } catch (error) {
    diagnostics.finishedAt = new Date().toISOString();
    diagnostics.failure = compactError(error);
    try { diagnostics.finalSnapshot = await pageSnapshot(page); } catch (snapshotError) { diagnostics.snapshotError = compactError(snapshotError); }
    try { await page.screenshot({ path: path.join(REPORTS, `tts-reader-real-model-${mode}-failure.png`), fullPage: true }); } catch {}
    error.realModelDiagnostics = diagnostics;
    throw error;
  } finally {
    await page.close().catch(() => {});
  }
}

(async () => {
  const report = { startedAt: new Date().toISOString(), cold: null, cached: null, failure: null };
  writeReport(report);
  const { server, origin } = await startServer();
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 760 } });
  try {
    report.cold = await runOne(context, origin, 'cold');
    writeReport(report);
    report.cached = await runOne(context, origin, 'cached');
    writeReport(report);

    const { cold, cached } = report;
    assert.ok(cold.modelRequests > 0, 'cold reader run did not download the model');
    assert.equal(cached.modelRequests, 0, 'cached reader run downloaded the model again');
    for (const result of [cold, cached]) {
      assert.ok(result.workerRequests > 0, `${result.mode}: persistent worker was not requested`);
      assert.equal(result.load.engineVersion, 2, `${result.mode}: thin Vosk client v2 was not active`);
      assert.equal(result.load.status?.ready, true, `${result.mode}: Vosk did not become ready`);
      assert.ok(result.synth.bytes > 10000 && result.synth.duration > 0.5, `${result.mode}: invalid WAV`);
      assert.ok(result.synth.rms > 50 && result.synth.peak > 200, `${result.mode}: silent WAV`);
      assert.equal(result.synth.mediaPlayCalled, true, `${result.mode}: playback was not requested`);
      assert.equal(result.synth.state.rate, 1, `${result.mode}: synthesis did not run at the canonical default rate`);
      assert.ok(result.synth.state.synthesisProgress > 0, `${result.mode}: worker synthesis progress was not observed`);
    }
    assert.ok(cold.load.maxGapMs < 1000, `cold worker preparation blocked UI for ${cold.load.maxGapMs.toFixed(1)} ms`);
    assert.ok(cached.load.maxGapMs < 1000, `cached worker preparation blocked UI for ${cached.load.maxGapMs.toFixed(1)} ms`);
    assert.ok(cached.synth.maxGapMs < 500, `cached worker synthesis blocked UI for ${cached.synth.maxGapMs.toFixed(1)} ms`);
    assert.ok(cold.synth.maxGapMs < 500, `cold worker synthesis blocked UI for ${cold.synth.maxGapMs.toFixed(1)} ms`);
    report.finishedAt = new Date().toISOString();
    report.result = 'PASS';
    writeReport(report);
    console.log('[TTS-READER-REAL-MODEL]', JSON.stringify({ cold: report.cold, cached: report.cached }));
    console.log('Reader TTS persistent-worker real model contract: PASS');
  } catch (error) {
    report.finishedAt = new Date().toISOString();
    report.result = 'FAIL';
    report.failure = {
      ...compactError(error),
      diagnostics: error.realModelDiagnostics || null,
    };
    writeReport(report);
    throw error;
  } finally {
    await context.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
