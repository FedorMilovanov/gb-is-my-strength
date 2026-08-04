#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium, webkit } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const ENGINE = fs.readFileSync(path.join(ROOT, 'js/vosk-tts-engine.js'), 'utf8');
const CONTROLLER = fs.readFileSync(path.join(ROOT, 'js/floating-cluster-controller.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'css/tts-download-notice.css'), 'utf8');
const REPORTS = path.join(ROOT, 'reports');
const MODEL_URL = 'https://huggingface.co/CurtMil/gb-vosk-tts-model/resolve/main/model-quant.zip';
const REAL_SAMPLE = 'Джон Гилл жил в Лондоне в XVIII веке. Иисус Христос — центр христианской проповеди. Ковенантное богословие требует внимательной экзегезы Писания.';
fs.mkdirSync(REPORTS, { recursive: true });

const auditFindings = [];
function finding(id, evidence) {
  auditFindings.push({ id, evidence });
  console.error('[TTS-DEEP-AUDIT]', id, JSON.stringify(evidence));
}

const ASSETS = new Map([
  ['/js/vosk-tts-core.js', path.join(ROOT, 'js/vosk-tts-core.js')],
  ['/js/vosk-stress-lookup.js', path.join(ROOT, 'js/vosk-stress-lookup.js')],
  ['/js/vosk-custom-terms.json', path.join(ROOT, 'js/vosk-custom-terms.json')],
  ['/js/vosk-stress-marker.bin', path.join(ROOT, 'js/vosk-stress-marker.bin')],
]);

function fixtureHtml() {
  return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>.gb-ember{width:44px;height:44px}.controls{position:fixed;right:10px;bottom:10px}.article-body{max-width:760px}</style></head><body>' +
    '<main><article class="article-body"><h1>Главный тестовый заголовок</h1><h2>Первый раздел</h2>' +
    '<p>Первый длинный абзац нужен для проверки непрерывности воспроизведения. Он содержит достаточно слов, чтобы событие границы возникло далеко от начала фразы, а пауза и смена скорости не заставляли читателя снова слушать уже произнесённый текст. Дополнительное предложение делает тестовый фрагмент устойчиво длинным.</p>' +
    '<ul><li><p>Уникальный вложенный тестовый пункт должен прозвучать ровно один раз.</p></li></ul>' +
    '<h3>Второй раздел</h3><p>Второй абзац продолжает статью и проверяет переход между частями текста.</p></article></main>' +
    '<div class="controls" data-fc-root data-fc-mode="single"><button class="gb-ember" data-fc-action="play" data-state="idle">PLAY A</button><button class="gb-ember" data-fc-action="play" data-state="idle">PLAY B</button></div>' +
    '<script src="/js/floating-cluster-controller.js"></script></body></html>';
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const pathname = (req.url || '/').split('?')[0];
      if (pathname.startsWith('/css/tts-download-notice.css')) {
        res.writeHead(200, { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-store' }); res.end(CSS); return;
      }
      if (pathname === '/js/vosk-tts-engine.js') {
        res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' }); res.end(ENGINE); return;
      }
      if (pathname === '/js/floating-cluster-controller.js') {
        res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' }); res.end(CONTROLLER); return;
      }
      if (ASSETS.has(pathname)) {
        const file = ASSETS.get(pathname);
        const type = pathname.endsWith('.js') ? 'text/javascript; charset=utf-8' : pathname.endsWith('.json') ? 'application/json' : 'application/octet-stream';
        res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }); fs.createReadStream(file).pipe(res); return;
      }
      if (pathname === '/controller/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(fixtureHtml()); return;
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
    window.VoskTTSCore = { parseDictionary: () => new Map(), WordPieceTokenizer: function WordPieceTokenizer() {} };
    window.VoskStressLookup = { StressLookup: function StressLookup() {} };
    window.fflate = { unzipSync: () => ({}) };
    window.ort = { env: { wasm: {} }, InferenceSession: { create: () => mode === 'reject' ? Promise.reject(new Error('fixture session failure')) : Promise.resolve({ inputNames: [], outputNames: [] }) } };
  }, sessionMode);
}

async function putCachedModel(page) {
  await page.evaluate(async (modelUrl) => {
    const enc = new TextEncoder();
    const files = { 'model.onnx': new Uint8Array([1, 2, 3]), dictionary: enc.encode(''), 'config.json': enc.encode('{"model_type":"multistream_v1"}') };
    await new Promise((resolve, reject) => {
      const open = indexedDB.open('gb-vosk-tts', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('files');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction('files', 'readwrite');
        tx.objectStore('files').put(files, modelUrl);
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      };
    });
  }, MODEL_URL);
}

async function cachedFailure(browserType, origin, name) {
  const browser = await browserType.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } }); page.__origin = origin;
  try {
    await reset(page); await installDependencies(page, 'reject'); await putCachedModel(page); await page.addScriptTag({ content: ENGINE });
    await page.evaluate(() => window.VoskTTSEngine.ensureLoaded().catch(() => null));
    await page.waitForSelector('.gb-tts-download-notice[data-state="error"].is-visible');
    const snap = await page.locator('.gb-tts-download-notice').evaluate((el) => ({ title: el.querySelector('.gb-tts-download-notice__title').textContent, action: el.querySelector('.gb-tts-download-notice__action').textContent, status: window.VoskTTSEngine.getStatus() }));
    assert.match(snap.title, /не запустился/i); assert.equal(snap.action, 'Повторить'); assert.equal(snap.status.phase, 'error');
    await page.screenshot({ path: path.join(REPORTS, 'tts-lifecycle-' + name + '-cached-error.png') });
  } finally { await browser.close(); }
}

async function cachedReady(browserType, origin, name) {
  const browser = await browserType.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); page.__origin = origin;
  try {
    await reset(page); await installDependencies(page, 'resolve'); await putCachedModel(page); await page.addScriptTag({ content: ENGINE });
    await page.evaluate(() => window.VoskTTSEngine.ensureLoaded());
    await page.waitForSelector('.gb-tts-download-notice[data-state="ready"].is-visible');
    const before = await page.locator('.gb-tts-download-notice').evaluate((el) => ({ title: el.querySelector('.gb-tts-download-notice__title').textContent, action: el.querySelector('.gb-tts-download-notice__action').textContent, width: el.getBoundingClientRect().width, viewport: innerWidth, status: window.VoskTTSEngine.getStatus() }));
    assert.equal(before.title, 'Улучшенный голос готов'); assert.equal(before.action, 'Включить сейчас'); assert.equal(before.status.ready, true); assert.ok(before.width <= before.viewport - 18);
    await page.evaluate(() => { window.__switchRequested = false; addEventListener('gb:vosk-switch-request', () => { window.__switchRequested = true; }, { once: true }); });
    await page.locator('.gb-tts-download-notice__action').click(); assert.equal(await page.evaluate(() => window.__switchRequested), true);
    await page.screenshot({ path: path.join(REPORTS, 'tts-lifecycle-' + name + '-mobile-ready.png') });
  } finally { await browser.close(); }
}

async function delayedRafFirstPaint(browserType, origin, name) {
  const browser = await browserType.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); page.__origin = origin;
  try {
    await reset(page);
    await page.evaluate(() => { window.__queuedTtsRaf = []; window.requestAnimationFrame = (callback) => { window.__queuedTtsRaf.push(callback); return window.__queuedTtsRaf.length; }; });
    await page.addScriptTag({ content: ENGINE });
    const snap = await page.evaluate(() => { const notice = window.VoskTTSEngine.showStatus('browser'); return { visible: notice.classList.contains('is-visible'), state: notice.getAttribute('data-state'), queuedRaf: window.__queuedTtsRaf.length }; });
    assert.equal(snap.state, 'browser'); assert.equal(snap.visible, true, name + ': browser status must be visible before any RAF callback'); assert.equal(snap.queuedRaf, 0);
  } finally { await browser.close(); }
}

function installSpeechFixture(context, useVosk) {
  return context.addInitScript(({ vosk }) => {
    window.__ttsProbe = { speaks: [], cancels: 0, active: null, voskSpeaks: [], voskCancels: 0 };
    class U { constructor(text) { this.text = String(text); this.rate = 1; this.lang = ''; this.onboundary = null; this.onend = null; this.onerror = null; } }
    const speech = {
      getVoices: () => [{ name: 'Fixture Russian', lang: 'ru-RU', localService: true }],
      speak: (u) => { window.__ttsProbe.active = u; window.__ttsProbe.speaks.push({ text: u.text, rate: u.rate }); },
      cancel: () => { const u = window.__ttsProbe.active; window.__ttsProbe.active = null; window.__ttsProbe.cancels += 1; if (u && u.onend) queueMicrotask(() => u.onend({ synthetic: true })); },
      addEventListener: () => {}, removeEventListener: () => {}
    };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: U });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: speech });
    localStorage.setItem('gbx-vosk-warmup', 'off');
    window.__ttsProbe.boundary = (i) => { const u = window.__ttsProbe.active; if (u && u.onboundary) u.onboundary({ charIndex: i, name: 'word' }); };
    window.__ttsProbe.error = () => { const u = window.__ttsProbe.active; window.__ttsProbe.active = null; if (u && u.onerror) u.onerror({ error: 'fixture' }); };
    if (vosk) {
      window.VoskTTSEngine = {
        isSupported: () => true, isReady: () => true, getStatus: () => ({ phase: 'ready', ready: true }), showStatus: () => null, ensureLoaded: () => Promise.resolve(), cancelLoading: () => {},
        speak: (text, rate, speaker, onend, onerror) => { const h = { text, rate, speaker, onend, onerror }; window.__ttsProbe.voskSpeaks.push({ text, rate, speaker }); window.__ttsProbe.voskActive = h; return h; },
        cancel: () => { window.__ttsProbe.voskCancels += 1; window.__ttsProbe.voskActive = null; }
      };
    }
  }, { vosk: !!useVosk });
}

async function controllerPage(browser, origin, useVosk) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 760 } });
  await installSpeechFixture(context, useVosk);
  const page = await context.newPage();
  await page.goto(origin + '/controller/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__gbCluster);
  return { context, page };
}

async function runControllerAudit(origin) {
  const browser = await chromium.launch({ headless: true });
  async function check(id, fn) {
    try { await fn(); console.log('[TTS-DEEP-AUDIT PASS]', id); } catch (error) { finding(id, { message: error.message }); }
  }
  try {
    await check('rapid-double-toggle', async () => {
      const { context, page } = await controllerPage(browser, origin, false);
      try {
        await page.evaluate(() => { const b = document.querySelector('.gb-ember'); b.click(); b.click(); }); await page.waitForTimeout(80);
        const snap = await page.evaluate(() => ({ state: document.querySelector('.gb-ember').dataset.state, speaks: window.__ttsProbe.speaks.length, cancels: window.__ttsProbe.cancels }));
        await page.screenshot({ path: path.join(REPORTS, 'tts-lifecycle-deep-rapid-toggle.png') });
        assert.equal(snap.state, 'paused', 'two toggle clicks in one task ended ' + JSON.stringify(snap));
      } finally { await context.close(); }
    });

    await check('pause-resume-offset', async () => {
      const { context, page } = await controllerPage(browser, origin, false);
      try {
        const b = page.locator('.gb-ember').first(); await b.click(); await page.waitForFunction(() => window.__ttsProbe.speaks.length === 1);
        const first = await page.evaluate(() => window.__ttsProbe.speaks[0].text); const boundary = Math.min(130, first.length - 30);
        await page.evaluate((i) => window.__ttsProbe.boundary(i), boundary); await b.click(); await b.click(); await page.waitForFunction(() => window.__ttsProbe.speaks.length === 2);
        const second = await page.evaluate(() => window.__ttsProbe.speaks[1].text);
        assert.notEqual(second, first, 'resume replayed the complete active chunk'); assert.ok(second.length < first.length, 'resume did not continue from spoken boundary');
      } finally { await context.close(); }
    });

    await check('rate-change-offset', async () => {
      const { context, page } = await controllerPage(browser, origin, false);
      try {
        const b = page.locator('.gb-ember').first(); await b.click(); await page.waitForFunction(() => window.__ttsProbe.speaks.length === 1);
        const first = await page.evaluate(() => window.__ttsProbe.speaks[0].text); await page.evaluate(() => { window.__ttsProbe.boundary(120); localStorage.setItem('gb:audio:rate', '1.5'); dispatchEvent(new CustomEvent('gb:tts-rate-change')); });
        await page.waitForFunction(() => window.__ttsProbe.speaks.length === 2); const second = await page.evaluate(() => window.__ttsProbe.speaks[1]);
        assert.notEqual(second.text, first, 'rate change replayed the complete active chunk'); assert.equal(second.rate, 1.5);
      } finally { await context.close(); }
    });

    await check('nested-li-projection', async () => {
      const { context, page } = await controllerPage(browser, origin, false);
      try {
        await page.locator('.gb-ember').first().click(); await page.waitForFunction(() => window.__ttsProbe.speaks.length === 1);
        const text = await page.evaluate(() => window.__ttsProbe.speaks.map((x) => x.text).join(' ')); const phrase = 'Уникальный вложенный тестовый пункт должен прозвучать ровно один раз.';
        assert.equal(text.split(phrase).length - 1, 1, 'nested li/p content is duplicated in speech projection');
      } finally { await context.close(); }
    });

    await check('pagehide-cleanup', async () => {
      const { context, page } = await controllerPage(browser, origin, false);
      try {
        await page.locator('.gb-ember').first().click(); await page.waitForFunction(() => window.__ttsProbe.speaks.length === 1); const before = await page.evaluate(() => window.__ttsProbe.cancels);
        await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))); await page.waitForTimeout(40);
        const after = await page.evaluate(() => ({ cancels: window.__ttsProbe.cancels, state: document.querySelector('.gb-ember').dataset.state }));
        assert.ok(after.cancels > before, 'pagehide did not cancel speech'); assert.notEqual(after.state, 'playing');
      } finally { await context.close(); }
    });

    await check('vosk-active-progress', async () => {
      const { context, page } = await controllerPage(browser, origin, true);
      try {
        await page.locator('.gb-ember').first().click(); await page.waitForFunction(() => window.__ttsProbe.voskSpeaks.length === 1); await page.waitForTimeout(350);
        const progress = await page.locator('.gb-ember').first().evaluate((el) => getComputedStyle(el).getPropertyValue('--p').trim());
        await page.screenshot({ path: path.join(REPORTS, 'tts-lifecycle-deep-vosk-progress.png') });
        assert.ok(parseFloat(progress || '0') > 0, 'Vosk progress ring remains frozen for the whole active chunk');
      } finally { await context.close(); }
    });
  } finally { await browser.close(); }
}

async function realModelAudit(origin) {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 760 } });
  await context.addInitScript(() => {
    window.__heartbeat = { last: performance.now(), maxGap: 0 };
    setInterval(() => { const now = performance.now(); window.__heartbeat.maxGap = Math.max(window.__heartbeat.maxGap, now - window.__heartbeat.last); window.__heartbeat.last = now; }, 50);
    Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: function () { window.__mediaPlayCalled = true; return Promise.resolve(); } });
  });
  async function synth(page, deleteDb) {
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    if (deleteDb) await page.evaluate(async () => new Promise((resolve) => { const r = indexedDB.deleteDatabase('gb-vosk-tts'); r.onsuccess = r.onerror = r.onblocked = resolve; }));
    await page.addScriptTag({ content: ENGINE });
    const started = Date.now();
    await page.evaluate(async (text) => { await window.VoskTTSEngine.ensureLoaded(); window.VoskTTSEngine.speak(text, 1, 3, () => {}, (e) => { window.__realError = String(e && (e.message || e.error) || e); }); }, REAL_SAMPLE);
    await page.waitForFunction(() => document.querySelector('audio[src^="blob:"]') || window.__realError, null, { timeout: 25 * 60 * 1000 });
    const err = await page.evaluate(() => window.__realError || null); if (err) throw new Error(err);
    const wav = await page.evaluate(async () => {
      const a = document.querySelector('audio[src^="blob:"]'); const ab = await fetch(a.src).then((r) => r.arrayBuffer()); const v = new DataView(ab); const sr = v.getUint32(24, true); const n = v.getUint32(40, true) / 2; const pcm = new Int16Array(ab.slice(44)); let ss = 0, peak = 0;
      for (const x of pcm) { ss += x * x; peak = Math.max(peak, Math.abs(x)); }
      return { bytes: ab.byteLength, duration: n / sr, rms: Math.sqrt(ss / Math.max(1, pcm.length)), peak, maxGap: window.__heartbeat.maxGap, playCalled: !!window.__mediaPlayCalled };
    });
    wav.elapsedMs = Date.now() - started; return wav;
  }
  try {
    const coldPage = await context.newPage(); const coldRequests = []; coldPage.on('request', (r) => { if (r.url().includes('model-quant.zip') || r.url().includes('aws.cdn.hf.co')) coldRequests.push(r.url()); });
    const cold = await synth(coldPage, true); await coldPage.screenshot({ path: path.join(REPORTS, 'tts-lifecycle-real-model-cold.png') }); await coldPage.close();
    assert.ok(coldRequests.length > 0, 'cold run did not request model'); assert.ok(cold.bytes > 10000 && cold.duration > 0.5 && cold.rms > 50 && cold.peak > 200 && cold.playCalled, 'real WAV failed sanity: ' + JSON.stringify(cold));
    const cachedPage = await context.newPage(); const cachedRequests = []; cachedPage.on('request', (r) => { if (r.url().includes('model-quant.zip') || r.url().includes('aws.cdn.hf.co')) cachedRequests.push(r.url()); });
    const cached = await synth(cachedPage, false); await cachedPage.close(); assert.equal(cachedRequests.length, 0, 'cached run re-downloaded model');
    console.log('[TTS-REAL-MODEL PASS]', JSON.stringify({ cold, cached, coldRequests: coldRequests.length }));
    if (cold.maxGap > 500) finding('real-model-main-thread-stall', { maxGapMs: cold.maxGap, coldElapsedMs: cold.elapsedMs });
  } catch (error) {
    finding('real-model-browser-e2e', { message: error.message, stack: error.stack });
  } finally { await context.close(); await browser.close(); }
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
    await runControllerAudit(origin);
    await realModelAudit(origin);
    console.log('TTS engine lifecycle browser contract: PASS (original Chromium/WebKit lifecycle preserved).');
    console.log('TTS deep audit findings:', JSON.stringify(auditFindings));
  } finally { await new Promise((resolve) => server.close(resolve)); }
})().catch((error) => { console.error(error); process.exit(1); });
