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
const ENGINE = fs.readFileSync(path.join(ROOT, 'js/vosk-tts-engine.js'), 'utf8');
fs.mkdirSync(REPORTS, { recursive: true });

function listen(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

async function closeServer(server) {
  await new Promise((resolve) => server.close(resolve));
}

async function runLockContract() {
  let active = 0;
  let maxActive = 0;
  let preparations = 0;
  const fixture = '<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body><article><p>Проверка блокировки модели.</p></article><button data-fc-action="play">PLAY</button><script type="module" src="/src/runtime/reader-tts.js"></script></body></html>';
  const { server, origin } = await listen((req, res) => {
    const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
    if (pathname === '/src/runtime/reader-tts.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(READER);
      return;
    }
    if (pathname === '/prepare') {
      active += 1;
      preparations += 1;
      maxActive = Math.max(maxActive, active);
      setTimeout(() => { active -= 1; res.writeHead(204, { 'cache-control': 'no-store' }); res.end(); }, 180);
      return;
    }
    if (pathname === '/probe') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ active, maxActive, preparations }));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(fixture);
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  try {
    await context.addInitScript(() => {
      let ready = false;
      window.VoskTTSEngine = {
        version: 2,
        isSupported: () => true,
        isReady: () => ready,
        ensureLoaded: async () => { await fetch('/prepare'); ready = true; return true; },
        retryLoading: async () => { await fetch('/prepare'); ready = true; return true; },
      };
    });
    const first = await context.newPage();
    const second = await context.newPage();
    await Promise.all([first.goto(`${origin}/first`, { waitUntil: 'domcontentloaded' }), second.goto(`${origin}/second`, { waitUntil: 'domcontentloaded' })]);
    await Promise.all([first.waitForFunction(() => window.GBReaderTTS?.version === 2), second.waitForFunction(() => window.GBReaderTTS?.version === 2)]);
    const started = Date.now();
    await Promise.all([
      first.evaluate(() => window.GBReaderTTS.warmVosk({ retry: true })),
      second.evaluate(() => window.GBReaderTTS.warmVosk({ retry: true })),
    ]);
    const elapsedMs = Date.now() - started;
    const probe = await fetch(`${origin}/probe`).then((response) => response.json());
    assert.equal(probe.preparations, 2, 'both tabs must initialize their own fallback worker session');
    assert.equal(probe.maxActive, 1, 'navigator.locks did not serialize fallback preparation');
    assert.ok(elapsedMs >= 320 && elapsedMs < 2000, `fallback lock timing drifted (${elapsedMs} ms)`);
    return { ...probe, elapsedMs };
  } finally {
    await context.close();
    await browser.close();
    await closeServer(server);
  }
}

const FAKE_WORKER = String.raw`'use strict';
let ready = false;
let initializations = 0;
function wav() {
  const frames = 800;
  const buffer = new ArrayBuffer(44 + frames * 2);
  const view = new DataView(buffer);
  const ascii = (offset, text) => { for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i)); };
  ascii(0, 'RIFF'); view.setUint32(4, 36 + frames * 2, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true); view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, frames * 2, true);
  const pcm = new Int16Array(buffer, 44);
  for (let i = 0; i < pcm.length; i += 1) pcm[i] = Math.round(Math.sin(i / 8) * 1800);
  return buffer;
}
function send(port, type, detail, transfer) { port.postMessage(Object.assign({ type }, detail || {}), transfer || []); }
function attach(port) {
  port.onmessage = (event) => {
    const message = event.data || {};
    if (message.type === 'ensure') {
      if (ready) { send(port, 'status', { phase: 'ready', ready: true }); send(port, 'ready', { id: message.id }); return; }
      initializations += 1;
      send(port, 'status', { phase: 'initializing', ready: false });
      setTimeout(() => { ready = true; send(port, 'status', { phase: 'ready', ready: true }); send(port, 'ready', { id: message.id }); }, 180);
      return;
    }
    if (message.type === 'speak') {
      send(port, 'synth-progress', { id: message.id, value: 0.92 });
      const buffer = wav();
      send(port, 'audio', { id: message.id, wav: buffer }, [buffer]);
    }
  };
  if (typeof port.start === 'function') port.start();
  send(port, 'status', { phase: ready ? 'ready' : 'connected', ready, initializations });
}
if ('onconnect' in self) self.onconnect = (event) => attach(event.ports[0]);
else {
  const port = { postMessage: (payload, transfer) => self.postMessage(payload, transfer || []), start() {} };
  self.onmessage = (event) => port.onmessage(event);
  attach(port);
}`;

async function installMediaStub(page) {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value() { window.__played = true; return Promise.resolve(); },
    });
  });
}

async function warmEngine(page) {
  await page.waitForFunction(() => window.VoskTTSEngine?.version === 2);
  const started = Date.now();
  await page.evaluate(() => window.VoskTTSEngine.retryLoading({ clearOptOut: true }));
  return { elapsedMs: Date.now() - started, status: await page.evaluate(() => window.VoskTTSEngine.getStatus()) };
}

async function runSharedWorkerContract() {
  let workerRequests = 0;
  const html = '<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body><script src="/js/vosk-tts-engine.js"></script></body></html>';
  const { server, origin } = await listen((req, res) => {
    const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
    if (pathname === '/js/vosk-tts-engine.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(ENGINE);
      return;
    }
    if (pathname === '/js/vosk-tts-worker.js') {
      workerRequests += 1;
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(FAKE_WORKER);
      return;
    }
    if (pathname === '/css/tts-download-notice.css') {
      res.writeHead(200, { 'content-type': 'text/css', 'cache-control': 'no-store' });
      res.end('.gb-tts-download-notice{}');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html);
  });

  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const report = {};
  try {
    const context = await browser.newContext();
    const owner = await context.newPage();
    await installMediaStub(owner);
    await owner.goto(`${origin}/owner`, { waitUntil: 'domcontentloaded' });
    report.owner = await warmEngine(owner);
    assert.equal(report.owner.status.workerMode, 'shared', 'SharedWorker was not preferred');
    assert.ok(report.owner.elapsedMs >= 120, `fake first initialization was bypassed (${report.owner.elapsedMs} ms)`);

    const follower = await context.newPage();
    await installMediaStub(follower);
    await follower.goto(`${origin}/follower`, { waitUntil: 'domcontentloaded' });
    report.follower = await warmEngine(follower);
    assert.equal(report.follower.status.workerMode, 'shared', 'second page did not attach to SharedWorker');
    assert.ok(report.follower.elapsedMs < 500, `ready SharedWorker was not reused (${report.follower.elapsedMs} ms)`);
    await follower.evaluate(() => window.VoskTTSEngine.speak('Проверка', 1, 3, () => {}, () => {}));
    await follower.waitForFunction(() => /^blob:/.test(document.querySelector('audio[data-gb-vosk-audio]')?.src || ''));
    assert.equal(await follower.evaluate(() => window.__played === true), true, 'shared-worker WAV was not played');

    await follower.goto(`${origin}/navigated`, { waitUntil: 'domcontentloaded' });
    report.navigation = await warmEngine(follower);
    assert.equal(report.navigation.status.workerMode, 'shared');
    assert.ok(report.navigation.elapsedMs < 500, `SharedWorker did not survive navigation with another active page (${report.navigation.elapsedMs} ms)`);
    report.workerRequests = workerRequests;
    assert.equal(workerRequests, 1, 'SharedWorker script was instantiated more than once');
    await context.close();

    const fallbackContext = await browser.newContext();
    await fallbackContext.addInitScript(() => {
      try { Object.defineProperty(window, 'SharedWorker', { configurable: true, value: undefined }); } catch {}
    });
    const fallback = await fallbackContext.newPage();
    await installMediaStub(fallback);
    await fallback.goto(`${origin}/fallback`, { waitUntil: 'domcontentloaded' });
    report.fallback = await warmEngine(fallback);
    assert.equal(report.fallback.status.workerMode, 'dedicated', 'Dedicated Worker fallback was not selected');
    await fallbackContext.close();
    return report;
  } finally {
    await browser.close();
    await closeServer(server);
  }
}

(async () => {
  const report = {
    fallbackLock: await runLockContract(),
    sharedWorker: await runSharedWorkerContract(),
  };
  fs.writeFileSync(path.join(REPORTS, 'tts-reader-multitab-lock.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log('[TTS-MULTITAB]', JSON.stringify(report));
  console.log('Reader TTS cross-tab lock and SharedWorker persistence contracts: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
