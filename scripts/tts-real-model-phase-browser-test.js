#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const REPORTS = path.join(ROOT, 'reports');
const ENGINE = fs.readFileSync(path.join(ROOT, 'js/vosk-tts-engine.js'), 'utf8');
const MODEL_TOKEN = 'model-quant.zip';
const SAMPLE = 'Джон Гилл жил в Лондоне в восемнадцатом веке. Иисус Христос — центр христианской проповеди. Ковенантное богословие требует внимательной экзегезы Писания.';
fs.mkdirSync(REPORTS, { recursive: true });

const ASSETS = new Map([
  ['/js/vosk-tts-core.js', path.join(ROOT, 'js/vosk-tts-core.js')],
  ['/js/vosk-stress-lookup.js', path.join(ROOT, 'js/vosk-stress-lookup.js')],
  ['/js/vosk-custom-terms.json', path.join(ROOT, 'js/vosk-custom-terms.json')],
  ['/js/vosk-stress-marker.bin', path.join(ROOT, 'js/vosk-stress-marker.bin')],
  ['/css/tts-download-notice.css', path.join(ROOT, 'css/tts-download-notice.css')],
]);

function contentType(file) {
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  return 'application/octet-stream';
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
      if (ASSETS.has(pathname)) {
        const file = ASSETS.get(pathname);
        res.writeHead(200, { 'content-type': contentType(file), 'cache-control': 'no-store' });
        fs.createReadStream(file).pipe(res);
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end('<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main>Vosk phase audit</main></body></html>');
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: 'http://127.0.0.1:' + server.address().port }));
  });
}

async function deleteDb(page) {
  await page.evaluate(async () => new Promise((resolve) => {
    const request = indexedDB.deleteDatabase('gb-vosk-tts');
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  }));
}

async function installProbe(page) {
  await page.addInitScript(() => {
    window.__ttsPhase = {
      events: [],
      lastTick: performance.now(),
      maxGap: 0,
      tickCount: 0,
      mediaPlayCalled: false,
    };
    window.__resetTtsHeartbeat = () => {
      window.__ttsPhase.lastTick = performance.now();
      window.__ttsPhase.maxGap = 0;
      window.__ttsPhase.tickCount = 0;
    };
    setInterval(() => {
      const now = performance.now();
      window.__ttsPhase.maxGap = Math.max(window.__ttsPhase.maxGap, now - window.__ttsPhase.lastTick);
      window.__ttsPhase.lastTick = now;
      window.__ttsPhase.tickCount += 1;
    }, 25);
    addEventListener('gb:vosk-status', (event) => {
      window.__ttsPhase.events.push({
        at: performance.now(),
        phase: event.detail && event.detail.phase,
        reason: event.detail && event.detail.reason || null,
      });
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: function play() {
        window.__ttsPhase.mediaPlayCalled = true;
        return Promise.resolve();
      },
    });
  });
}

async function withTimeout(page, expression, arg, timeoutMs, label) {
  return page.evaluate(async ({ source, value, timeout, name }) => {
    const task = (0, eval)(source)(value);
    const timer = new Promise((_, reject) => setTimeout(() => reject(new Error(name + ' timed out after ' + timeout + ' ms')), timeout));
    return Promise.race([task, timer]);
  }, { source: expression, value: arg, timeout: timeoutMs, name: label });
}

async function wavSnapshot(page) {
  return page.evaluate(async () => {
    const audio = document.querySelector('audio[src^="blob:"]');
    if (!audio) throw new Error('audio blob was not created');
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
      mediaPlayCalled: !!window.__ttsPhase.mediaPlayCalled,
    };
  });
}

async function runOne(context, origin, mode) {
  const page = await context.newPage();
  const modelRequests = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes(MODEL_TOKEN) || url.includes('aws.cdn.hf.co')) modelRequests.push(url);
  });
  await installProbe(page);
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  if (mode === 'cold') await deleteDb(page);
  await page.addScriptTag({ content: ENGINE });

  await page.evaluate(() => {
    window.__ttsPhase.events.length = 0;
    window.__ttsPhase.loadStartedAt = performance.now();
    window.__resetTtsHeartbeat();
  });
  await withTimeout(
    page,
    '(function(){ return window.VoskTTSEngine.ensureLoaded(); })',
    null,
    20 * 60 * 1000,
    mode + ' ensureLoaded'
  );
  const load = await page.evaluate(() => ({
    elapsedMs: performance.now() - window.__ttsPhase.loadStartedAt,
    maxGapMs: window.__ttsPhase.maxGap,
    heartbeatTicks: window.__ttsPhase.tickCount,
    events: window.__ttsPhase.events.slice(),
    status: window.VoskTTSEngine.getStatus(),
  }));

  await page.evaluate(() => {
    window.__ttsPhase.mediaPlayCalled = false;
    window.__ttsPhase.synthStartedAt = performance.now();
    window.__resetTtsHeartbeat();
  });
  await page.evaluate((text) => {
    window.__ttsSynthesisError = null;
    window.VoskTTSEngine.speak(text, 1, 3, () => {}, (error) => {
      window.__ttsSynthesisError = String(error && (error.message || error.error) || error);
    });
  }, SAMPLE);
  await page.waitForFunction(
    () => document.querySelector('audio[src^="blob:"]') || window.__ttsSynthesisError,
    null,
    { timeout: 15 * 60 * 1000 }
  );
  const synthesisError = await page.evaluate(() => window.__ttsSynthesisError);
  if (synthesisError) throw new Error(synthesisError);
  const synthTiming = await page.evaluate(() => ({
    elapsedMs: performance.now() - window.__ttsPhase.synthStartedAt,
    maxGapMs: window.__ttsPhase.maxGap,
    heartbeatTicks: window.__ttsPhase.tickCount,
  }));
  const wav = await wavSnapshot(page);
  await page.screenshot({ path: path.join(REPORTS, 'tts-real-model-phase-' + mode + '.png') });
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

    assert.ok(cold.modelRequests > 0, 'cold run did not request the model');
    assert.equal(cached.modelRequests, 0, 'cached run requested the model again');
    for (const result of [cold, cached]) {
      assert.equal(result.load.status.ready, true, result.mode + ' model did not become ready');
      assert.ok(result.synth.bytes > 10000, result.mode + ' WAV is unexpectedly small');
      assert.ok(result.synth.duration > 0.5, result.mode + ' WAV duration is too short');
      assert.ok(result.synth.rms > 50 && result.synth.peak > 200, result.mode + ' WAV appears silent');
      assert.equal(result.synth.mediaPlayCalled, true, result.mode + ' audio play was not requested');
    }

    const report = { cold, cached };
    fs.writeFileSync(path.join(REPORTS, 'tts-real-model-phase.json'), JSON.stringify(report, null, 2));
    console.log('[TTS-REAL-MODEL-PHASE]', JSON.stringify(report));
    for (const result of [cold, cached]) {
      if (result.load.maxGapMs > 500) {
        console.error('[TTS-PHASE-FINDING]', result.mode + '-load-main-thread-stall', JSON.stringify({ elapsedMs: result.load.elapsedMs, maxGapMs: result.load.maxGapMs, events: result.load.events }));
      }
      if (result.synth.maxGapMs > 500) {
        console.error('[TTS-PHASE-FINDING]', result.mode + '-synthesis-main-thread-stall', JSON.stringify({ elapsedMs: result.synth.elapsedMs, maxGapMs: result.synth.maxGapMs }));
      }
    }
    console.log('TTS real model phase audit: PASS (cold download, cache reuse, ONNX readiness, non-silent WAV).');
  } finally {
    await context.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
