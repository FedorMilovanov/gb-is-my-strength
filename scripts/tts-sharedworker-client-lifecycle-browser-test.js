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
const LIFECYCLE = fs.readFileSync(path.join(ROOT, 'src/runtime/reader-tts-lifecycle.js'), 'utf8');
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

async function waitFor(predicate, timeoutMs = 3000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`condition not met within ${timeoutMs}ms`);
}

const FAKE_WORKER = String.raw`'use strict';
let ready = false;
function wav() {
  const frames = 400;
  const buffer = new ArrayBuffer(44 + frames * 2);
  const view = new DataView(buffer);
  const ascii = (offset, text) => { for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i)); };
  ascii(0, 'RIFF'); view.setUint32(4, 36 + frames * 2, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true); view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, frames * 2, true);
  return buffer;
}
function send(port, type, detail, transfer) { port.postMessage(Object.assign({ type }, detail || {}), transfer || []); }
function attach(port) {
  let clientId = '';
  let retired = false;
  port.onmessage = (event) => {
    const message = event.data || {};
    if (message.clientId) clientId = String(message.clientId);
    if (message.type === 'hello' || message.type === 'ping') return;
    if (message.type === 'disconnect') {
      retired = true;
      send(port, 'disconnected', { id: message.id || 0 });
      fetch('/retired?clientId=' + encodeURIComponent(clientId), { method: 'POST' }).catch(() => {});
      try { port.close(); } catch {}
      return;
    }
    if (message.type === 'ensure') {
      ready = true;
      send(port, 'status', { phase: 'ready', ready: true });
      send(port, 'ready', { id: message.id });
      return;
    }
    if (message.type === 'speak') {
      setTimeout(() => {
        if (retired) return;
        const buffer = wav();
        send(port, 'audio', { id: message.id, wav: buffer }, [buffer]);
      }, 40);
      return;
    }
    if (message.type === 'cancel' || message.type === 'cancel-load') return;
  };
  if (typeof port.start === 'function') port.start();
  send(port, 'status', { phase: ready ? 'ready' : 'connected', ready });
}
self.onconnect = (event) => attach(event.ports[0]);`;

async function installMediaStub(page) {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value() { window.__played = (window.__played || 0) + 1; return Promise.resolve(); },
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value() {},
    });
  });
}

async function warm(page) {
  await page.waitForFunction(() => window.VoskTTSEngine?.version === 2);
  await page.evaluate(() => window.VoskTTSEngine.retryLoading({ clearOptOut: true }));
  const status = await page.evaluate(() => window.VoskTTSEngine.getStatus());
  assert.equal(status.workerMode, 'shared', 'SharedWorker was not selected');
  assert.equal(status.ready, true, 'SharedWorker did not become ready');
  return status;
}

async function clickAway(page) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.click('#leave-document'),
  ]);
}

(async () => {
  const retired = [];
  let workerRequests = 0;
  const html = '<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body><main>Lifecycle fixture</main><a id="leave-document" href="/departed">Leave document</a><script src="/js/vosk-tts-engine.js"></script><script src="/src/runtime/reader-tts-lifecycle.js"></script></body></html>';
  const { server, origin } = await listen((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (url.pathname === '/js/vosk-tts-engine.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(ENGINE);
      return;
    }
    if (url.pathname === '/src/runtime/reader-tts-lifecycle.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(LIFECYCLE);
      return;
    }
    if (url.pathname === '/js/vosk-tts-worker.js') {
      workerRequests += 1;
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(FAKE_WORKER);
      return;
    }
    if (url.pathname === '/css/tts-download-notice.css') {
      res.writeHead(200, { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-store' });
      res.end('.gb-tts-download-notice{}');
      return;
    }
    if (url.pathname === '/retired' && req.method === 'POST') {
      retired.push(url.searchParams.get('clientId') || '');
      res.writeHead(204, { 'cache-control': 'no-store' });
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html);
  });

  const browser = await chromium.launch({ headless: true });
  const report = {};
  try {
    const context = await browser.newContext();
    const owner = await context.newPage();
    const departing = await context.newPage();
    await installMediaStub(owner);
    await installMediaStub(departing);

    await Promise.all([
      owner.goto(`${origin}/owner`, { waitUntil: 'domcontentloaded' }),
      departing.goto(`${origin}/departing`, { waitUntil: 'domcontentloaded' }),
    ]);
    report.navigationApi = await departing.evaluate(() => ({
      available: Boolean(window.navigation),
      intercept: Boolean(window.NavigateEvent?.prototype?.intercept),
    }));
    assert.equal(report.navigationApi.available, true, 'Chromium Navigation API unavailable');
    assert.equal(report.navigationApi.intercept, true, 'Chromium NavigateEvent.intercept unavailable');

    report.ownerInitial = await warm(owner);
    report.departingInitial = await warm(departing);
    assert.equal(workerRequests, 1, 'same-origin pages did not share one SharedWorker instance');

    await departing.evaluate(() => window.VoskTTSEngine.speak('Уходящая страница', 1, 3, () => {}, () => {}));
    await clickAway(departing);
    await waitFor(() => retired.length >= 1);
    const firstRetiredClient = retired[0];
    assert.ok(firstRetiredClient, 'ACK-backed document navigation did not retire the client');

    await owner.evaluate(() => window.VoskTTSEngine.speak('Живой клиент', 1, 3, () => {}, () => {}));
    await owner.waitForFunction(() => (window.__played || 0) >= 1);
    report.ownerAfterPeerRetire = await owner.evaluate(() => ({
      status: window.VoskTTSEngine.getStatus(),
      played: window.__played || 0,
    }));
    assert.equal(report.ownerAfterPeerRetire.status.workerMode, 'shared');
    assert.equal(report.ownerAfterPeerRetire.status.ready, true);
    assert.ok(report.ownerAfterPeerRetire.played >= 1, 'surviving page could not synthesize after peer retirement');

    await departing.goBack({ waitUntil: 'domcontentloaded' });
    report.firstRestore = await warm(departing);
    assert.equal(report.firstRestore.workerMode, 'shared', 'restored peer did not reconnect to SharedWorker');
    assert.equal(report.firstRestore.ready, true, 'restored peer did not regain ready SharedWorker state');

    await departing.evaluate(() => window.VoskTTSEngine.speak('Уходящая страница снова', 1, 3, () => {}, () => {}));
    await clickAway(departing);
    await waitFor(() => retired.length >= 2);
    const secondRetiredClient = retired[1];
    assert.ok(secondRetiredClient, 'restored peer did not perform second authoritative retirement');
    assert.notEqual(secondRetiredClient, firstRetiredClient, 'restored document reused retired SharedWorker client identity');

    await owner.evaluate(() => window.VoskTTSEngine.speak('Живой клиент после второго ухода', 1, 3, () => {}, () => {}));
    await owner.waitForFunction(() => (window.__played || 0) >= 2);
    report.ownerAfterSecondPeerRetire = await owner.evaluate(() => ({
      status: window.VoskTTSEngine.getStatus(),
      played: window.__played || 0,
    }));
    assert.equal(report.ownerAfterSecondPeerRetire.status.workerMode, 'shared');
    assert.equal(report.ownerAfterSecondPeerRetire.status.ready, true);
    assert.ok(report.ownerAfterSecondPeerRetire.played >= 2, 'surviving page failed after restored peer retired again');

    report.retiredClientCount = new Set(retired.filter(Boolean)).size;
    report.workerRequests = workerRequests;
    assert.ok(report.retiredClientCount >= 2, 'reconnected document did not receive a fresh retirement identity');
    assert.equal(workerRequests, 1, 'SharedWorker script was re-instantiated while a live owner remained');

    fs.writeFileSync(path.join(REPORTS, 'tts-sharedworker-client-lifecycle-browser.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log('[TTS-SHAREDWORKER-LIFECYCLE-BROWSER]', JSON.stringify(report));
    console.log('SharedWorker document lifecycle browser contract: PASS');
    await context.close();
  } finally {
    await browser.close();
    await closeServer(server);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
