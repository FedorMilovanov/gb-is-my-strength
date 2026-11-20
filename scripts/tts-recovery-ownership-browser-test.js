#!/usr/bin/env node
/**
 * Real worker-race witness over a stubbed SharedWorker (stub technique per
 * scripts/tts-shared-worker-multi-tab-test.cjs). Serves js/vosk-tts-engine.js
 * as-is from the repo and proves, against the CURRENT engine:
 *
 *   1. cancelLoading() while a load is in flight cancels the worker fetch,
 *      clears its own waiters and shows the cancelled phase (F1 fix), and
 *   2. a second page connected to the SAME stub worker (same BrowserContext,
 *      genuinely shared worker) adopts readiness via the status broadcast
 *      with NO owned load — no ensure, no loadRequests entry, timeline
 *      connected > foreign-status-ignored > ready (F2 fix), and the worker
 *      sees exactly one ensure/init across all tabs (one-init counter).
 *
 * Witness discipline (owner review 2026-11-20): all pages are created from
 * ONE BrowserContext — Playwright's browser.newPage() would open a separate
 * context per page, and a SharedWorker is only shared within a context, so
 * the old test never observed a foreign ready at all. The late page connects
 * via hasCachedModel() (a cache probe that registers no load), so its ready
 * can only arrive through adoption of the broadcast, not as an answer to its
 * own request.
 *
 * Run: node scripts/tts-recovery-ownership-browser-test.js
 */
const http = require('node:http');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
// The real worker contract requires the SOURCE tree, not the built dist:
// asset revision literals (?v=hex8) are baked at build time, so a fresh engine
// edit served from a stale dist would break witness isolation.
const PORT = 18713;

// Stub mirrors the real worker contract: status(connected) on attach;
// ensure → broadcast initializing + 600ms busy init → broadcast ready +
// per-port ready; disconnect → disconnected + port.close(). Two witness-only
// extensions: a 'cache-status' query handler (hasCachedModel) and an init
// counter so the harness can assert exactly one engine-initiated load across
// all connected pages.
const STUB_WORKER = `
var clients=new Map(),seq=0,ready=false,initCount=0;
function bc(p){clients.forEach(function(e){try{e.port.postMessage(p)}catch(_){}})}
function busy(ms){var t=Date.now();while(Date.now()-t<ms){}}
self.onconnect=function(ev){var port=ev.ports[0],key='c'+(++seq);clients.set(key,{port:port});
 port.onmessage=function(e){var m=e.data||{};
  if(m.type==='disconnect'){port.postMessage({type:'disconnected',id:m.id||0});clients.delete(key);port.close();return;}
  if(m.type==='cancel-load'){return;}
  if(m.type==='ping'){return;}
  if(m.type==='cache-status'){port.postMessage({type:'cache-status',id:m.id,cached:false});return;}
  if(m.type==='dump-counters'){port.postMessage({type:'counters',initCount:initCount});return;}
  if(m.type==='ensure'){ if(ready){port.postMessage({type:'ready',id:m.id});return;}
   initCount+=1;
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
  const errors = [];
  // CI path: playwright's own bundled chromium (installed by the workflow via
  // `npx playwright install chromium`). Plain headless launch, no distorting
  // flags — the same recipe as tts-reader-runtime-browser-test.js.
  try {
    const { chromium } = require('playwright');
    return await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  } catch (e) { errors.push(`playwright: ${e.message.split('\n')[0]}`); }
  // Sandbox path: @sparticuz full Chromium under its documented
  // LD_LIBRARY_PATH (repo playwright has no browser binary there).
  try {
    const { createRequire } = require('node:module');
    const require2 = createRequire('/tmp/arena-browser/');
    const chromiumMod = require2('/tmp/arena-browser/node_modules/@sparticuz/chromium/build/index.js');
    const sparticuz = chromiumMod.default || chromiumMod;
    const { chromium } = require2('/tmp/arena-browser/node_modules/playwright/index.js');
    return await chromium.launch({
      executablePath: await sparticuz.executablePath(),
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
  } catch (e) { errors.push(`sparticuz: ${e.message.split('\n')[0]}`); }
  throw new Error('No chromium available — ' + errors.join(' | '));
}

async function newEnginePage(context) {
  // One BrowserContext for the whole witness: SharedWorker is shared within a
  // context, and only a same-context second page can observe the foreign
  // ready broadcast this test exists for.
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/witness.html`);
  await page.addScriptTag({ url: `http://127.0.0.1:${PORT}/js/vosk-tts-engine.js` });
  await page.waitForFunction(() => !!window.VoskTTSEngine);
  return page;
}

async function readWorkerInitCount(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { port.close(); reject(new Error('counters timeout')); }, 3000);
    // Chromium keys SharedWorker instances by the FULL script URL, query
    // included: the engine opens '/js/vosk-tts-worker.js?v=<hex8>', so a bare
    // '/js/vosk-tts-worker.js' connection spawns a second worker and would
    // read a fresh zero counter. Mirror the engine's ?v= URL exactly.
    const port = new SharedWorker('/js/vosk-tts-worker.js?v=d5850c06', 'gb-vosk-tts').port;
    port.onmessage = (event) => {
      if (event.data && event.data.type === 'counters') {
        clearTimeout(timeout);
        port.close();
        resolve(event.data.initCount);
      }
    };
    port.postMessage({ type: 'dump-counters' });
  }));
}

(async () => {
  const server = await serve();
  const browser = await launchBrowser();
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    // F1: cancel during the in-flight load must reject the load promise with
    // AbortError (the engine's canonical cancel contract — cancelLoading
    // terminates the worker with a cancelled error and settles its load
    // requests with it), drop the load request and surface the cancelled
    // phase.
    {
      const page = await newEnginePage(context);
      const result = await page.evaluate(() => {
        const engine = window.VoskTTSEngine;
        const pending = engine.ensureLoaded().then(
          () => ({ settled: 'resolved' }),
          (error) => ({ settled: 'rejected', name: String(error && error.name || ''), message: String(error && error.message || error) }));
        // wait for the stub's initializing broadcast to arrive
        return new Promise((resolve) => setTimeout(async () => {
          engine.cancelLoading();
          const outcome = await pending;
          const status = engine.getStatus();
          resolve({
            outcome,
            phase: status.phase,
            ready: status.ready,
            loading: status.loading,
          });
        }, 250)); // cancel lands while the stub is inside its 600ms busy init
      });
      assert.equal(result.outcome.settled, 'rejected',
        `cancel must reject the in-flight ensure, got ${result.outcome.settled}`);
      assert.equal(result.outcome.name, 'AbortError',
        `cancel rejection must be AbortError, got ${result.outcome.name}: ${result.outcome.message}`);
      assert.equal(result.phase, 'cancelled', `cancel phase expected, got ${result.phase}`);
      assert.equal(result.loading, false, 'loading flag must clear after cancel');
      assert.equal(result.ready, false, 'cancelled load must not leave the engine ready');
      await page.close();
    }
    // F2: readiness is shared across pages in ONE browser context — the late
    // page connects with only a cache probe (no owned load), observes the
    // initializing broadcast as a foreign-status-ignored timeline entry, then
    // adopts the ready broadcast. The stub must see exactly ONE ensure across
    // both pages.
    {
      const page2 = await newEnginePage(context);
      const page3 = await newEnginePage(context);
      await page3.evaluate(() => window.VoskTTSEngine.hasCachedModel());
      await page2.evaluate(() => {
        // F1 persists a model-download opt-out; clear it so this load starts.
        window.VoskTTSEngine.clearModelDownloadOptOut();
        window.__p2 = window.VoskTTSEngine.ensureLoaded().then(() => 'resolved', (e) => 'rejected:' + (e && e.name));
      });
      const settled2 = await page2.evaluate(() => window.__p2);
      assert.equal(settled2, 'resolved', `page2 ensure must resolve, got ${settled2}`);
      assert.equal(await page2.evaluate(() => window.VoskTTSEngine.isReady()), true, 'page2 ready');
      const adopted = await page3.evaluate(() => {
        const engine = window.VoskTTSEngine;
        return {
          ready: engine.isReady(),
          status: engine.getStatus(),
        };
      });
      assert.equal(adopted.ready, true,
        'page3 must adopt the shared ready broadcast (no owned load of its own)');
      assert.equal(adopted.status.loading, false, 'page3 never entered its own loading state');
      const reasons = (adopted.status.workerTimeline || []).map((entry) => entry.reason);
      assert.ok(reasons.includes('foreign-status-ignored'),
        `page3 timeline must record the foreign initializing broadcast, got ${JSON.stringify(reasons)}`);
      assert.equal(await readWorkerInitCount(page3), 1,
        'exactly one ensure must reach the worker across both pages (one-init counter)');
      await page2.close();
      await page3.close();
    }
    console.log('PASS tts recovery/ownership witness: cancel owns its load; shared ready is adopted without a second init');
  } finally {
    await context.close();
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error('FAIL tts recovery/ownership witness:', error.message);
  process.exitCode = 1;
});
