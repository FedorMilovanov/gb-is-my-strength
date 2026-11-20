#!/usr/bin/env node
/*
 * TTS recovery/status ownership browser witness (SYS-TTS-RECOVERY-STATUS-OWNERSHIP).
 *
 * Real worker-race witness over a stubbed SharedWorker (stub technique per
 * Agent №11's adversarial witness, PR #2348 comment 7037314152):
 *
 *   NEGATIVE (F1 regression): ensureLoaded() → cancel DURING busy init with
 *     persisted opt-out → late in-flight `ready` from the dead generation must
 *     NOT flip the engine: ready=false, optedOut=true, phase stays cancelled,
 *     and a repeated ensureLoaded() rejects AbortError.
 *   POSITIVE adopt: a second document attaching to an already-ready shared
 *     worker adopts readiness via the status broadcast (no owned load).
 *   POSITIVE retry: after a deliberate clearOptOut, retryLoading() reaches
 *     ready=true through a fresh generation.
 *
 * Launches the sandboxed @sparticuz/chromium recipe (full Chromium, not
 * playwright's package stubs) under its documented LD_LIBRARY_PATH.
 * Deliberately NO --disable-web-security / --single-process: those flags
 * distort worker origin and lifetime semantics and would invalidate the
 * witness.
 *
 * Serves the SOURCE tree (not the built dist): ?v= revision literals are baked
 * at build time, so a fresh engine edit served from a stale dist would make
 * the witness observe stale code.
 */
'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
// The real worker contract requires the SOURCE tree, not the built dist:
// asset revision literals (?v=hex8) are baked at build time, so a fresh engine
// edit served from a stale dist would break witness isolation.
const PORT = 18713;

// Stub mirrors the real worker contract: status(connected) on attach;
// ensure → broadcast initializing + 600ms busy init → broadcast ready +
// per-port ready; disconnect → disconnected + port.close().
const STUB_WORKER = `
var clients=new Map(),seq=0,ready=false;
function bc(p){clients.forEach(function(e){try{e.port.postMessage(p)}catch(_){}})}
function busy(ms){var t=Date.now();while(Date.now()-t<ms){}}
self.onconnect=function(ev){var port=ev.ports[0],key='c'+(++seq);clients.set(key,{port:port});
 port.onmessage=function(e){var m=e.data||{};
  if(m.type==='disconnect'){port.postMessage({type:'disconnected',id:m.id||0});clients.delete(key);port.close();return;}
  if(m.type==='cancel-load'){return;}
  if(m.type==='ping'){return;}
  if(m.type==='ensure'){ if(ready){port.postMessage({type:'ready',id:m.id});return;}
   bc({type:'status',phase:'initializing',ready:false,clients:clients.size});
   setTimeout(function(){busy(600);ready=true;bc({type:'status',phase:'ready',ready:true,clients:clients.size});port.postMessage({type:'ready',id:m.id});},50);}};
 port.start();port.postMessage({type:'status',phase:(ready?'ready':'connected'),ready:ready,clients:clients.size,epoch:1});};
`;

const MIME = { '.js': 'text/javascript', '.html': 'text/html' };

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      if (url === '/js/vosk-tts-worker.js') {
        res.writeHead(200, { 'content-type': 'text/javascript' });
        res.end(STUB_WORKER);
        return;
      }
      if (url === '/js/vosk-tts-engine.js') {
        res.writeHead(200, { 'content-type': 'text/javascript' });
        res.end(fs.readFileSync(path.join(ROOT, 'js', 'vosk-tts-engine.js')));
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><html><head><title>witness</title></head><body><p>witness</p></body></html>');
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function launchBrowser() {
  // Real SharedWorker semantics required: use the sandboxed @sparticuz
  // chromium (full Chromium, not playwright's package stubs) under its
  // documented LD_LIBRARY_PATH. Do NOT pass --disable-web-security /
  // --single-process: those flags collapse worker process/origin isolation
  // and would invalidate any conclusion about SharedWorker ownership.
  const { createRequire } = require('node:module');
  const require2 = createRequire('/tmp/arena-browser/');
  const chromiumMod = require2('/tmp/arena-browser/node_modules/@sparticuz/chromium/build/index.js');
  const sparticuz = chromiumMod.default || chromiumMod;
  const { chromium } = require2('/tmp/arena-browser/node_modules/playwright/index.js');
  return chromium.launch({
    executablePath: await sparticuz.executablePath(),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
}

async function newEnginePage(browser) {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/witness.html`, { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ url: `http://127.0.0.1:${PORT}/js/vosk-tts-engine.js` });
  await page.waitForFunction(() => !!window.VoskTTSEngine);
  return page;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const server = await serve();
  const browser = await launchBrowser();
  try {
    // ── NEGATIVE (F1): cancel during busy init must survive late ready ──
    const page = await newEnginePage(browser);
    await page.evaluate(() => {
      window.__events = [];
      window.addEventListener('gb:vosk-status', (e) => window.__events.push(e.detail && e.detail.phase));
      window.VoskTTSEngine.ensureLoaded().catch(() => {});
    });
    // wait for the stub's initializing broadcast to arrive
    await page.waitForFunction(() => window.__events.includes('initializing'), null, { timeout: 5000 });
    await sleep(250); // cancel lands while the stub is inside its 600ms busy init
    await page.evaluate(() => { window.VoskTTSEngine.cancelLoading({ persist: true }); });
    await sleep(1400); // late ready from the dead generation arrives here
    const after = await page.evaluate(() => window.VoskTTSEngine.getStatus());
    assert.equal(after.ready, false, `late ready must not flip state: ${JSON.stringify(after)}`);
    assert.equal(after.optedOut, true, 'persisted opt-out must survive');
    assert.notEqual(after.phase, 'ready', `notice must not flip to ready: ${after.phase}`);
    const reensure = await page.evaluate(async () => {
      try { await window.VoskTTSEngine.ensureLoaded(); return 'resolved'; }
      catch (e) { return e.name; }
    });
    assert.equal(reensure, 'AbortError', `ensure after persisted cancel must reject AbortError, got ${reensure}`);
    await page.close();

    // ── POSITIVE retry: deliberate clearOptOut + retry reaches ready ──
    const page2 = await newEnginePage(browser);
    await page2.evaluate(() => {
      window.VoskTTSEngine.clearModelDownloadOptOut();
      window.__retry = window.VoskTTSEngine.retryLoading().catch((e) => e.name);
    });
    await page2.waitForFunction(() => window.VoskTTSEngine.isReady(), null, { timeout: 8000 });
    const retryStatus = await page2.evaluate(async () => {
      const settled = await window.__retry;
      return { settled, ready: window.VoskTTSEngine.isReady(), phase: window.VoskTTSEngine.getStatus().phase };
    });
    assert.equal(retryStatus.settled, true, `retry must resolve true, got ${retryStatus.settled}`);
    assert.equal(retryStatus.ready, true);
    assert.equal(retryStatus.phase, 'ready');

    // ── POSITIVE adopt: fresh document adopts shared ready via broadcast ──
    // (the stub worker process is shared across pages in this browser context
    // and stays alive/ready while page2 holds it open)
    const page3 = await newEnginePage(browser);
    await page3.evaluate(() => { window.VoskTTSEngine.ensureLoaded(); });
    await page3.waitForFunction(() => window.VoskTTSEngine.isReady(), null, { timeout: 5000 });
    const adopt = await page3.evaluate(() => {
      const s = window.VoskTTSEngine.getStatus();
      return { ready: s.ready, loading: s.loading, mode: s.workerMode };
    });
    assert.equal(adopt.ready, true, 'fresh document must adopt shared readiness');
    assert.equal(adopt.loading, false, 'adoption must not claim an owned load');
    await page3.close();
    await page2.close();

    console.log('✅ TTS recovery/status ownership witness: PASS (negative F1 cancel-race + positive retry + positive shared-adopt)');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
