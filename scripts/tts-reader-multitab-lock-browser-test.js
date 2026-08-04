#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const READER = fs.readFileSync(path.join(ROOT, 'src/runtime/reader-tts.js'), 'utf8');

function fixture() {
  return '<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body><article><p>Проверка блокировки модели.</p></article><button data-fc-action="play">PLAY</button><script type="module" src="/src/runtime/reader-tts.js"></script></body></html>';
}

function startServer() {
  let active = 0;
  let maxActive = 0;
  let preparations = 0;
  const server = http.createServer((req, res) => {
    const pathname = (req.url || '/').split('?')[0];
    if (pathname === '/src/runtime/reader-tts.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(READER);
      return;
    }
    if (pathname === '/prepare') {
      active += 1;
      preparations += 1;
      maxActive = Math.max(maxActive, active);
      setTimeout(() => {
        active -= 1;
        res.writeHead(204, { 'cache-control': 'no-store' });
        res.end();
      }, 180);
      return;
    }
    if (pathname === '/probe') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ active, maxActive, preparations }));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(fixture());
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({
      server,
      origin: `http://127.0.0.1:${server.address().port}`,
    }));
  });
}

(async () => {
  const { server, origin } = await startServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  try {
    await context.addInitScript(() => {
      let ready = false;
      window.VoskTTSEngine = {
        version: 2,
        isSupported: () => true,
        isReady: () => ready,
        ensureLoaded: async () => {
          await fetch('/prepare');
          ready = true;
          return true;
        },
        retryLoading: async () => {
          await fetch('/prepare');
          ready = true;
          return true;
        },
      };
    });

    const first = await context.newPage();
    const second = await context.newPage();
    await Promise.all([
      first.goto(origin + '/first', { waitUntil: 'domcontentloaded' }),
      second.goto(origin + '/second', { waitUntil: 'domcontentloaded' }),
    ]);
    await Promise.all([
      first.waitForFunction(() => window.GBReaderTTS?.version === 2),
      second.waitForFunction(() => window.GBReaderTTS?.version === 2),
    ]);

    const started = Date.now();
    await Promise.all([
      first.evaluate(() => window.GBReaderTTS.warmVosk({ retry: true })),
      second.evaluate(() => window.GBReaderTTS.warmVosk({ retry: true })),
    ]);
    const elapsedMs = Date.now() - started;
    const probe = await fetch(origin + '/probe').then((response) => response.json());

    assert.equal(probe.preparations, 2, 'both tabs must initialize their own worker session');
    assert.equal(probe.maxActive, 1, 'navigator.locks did not serialize model preparation across tabs');
    assert.ok(elapsedMs >= 320, `preparations overlapped unexpectedly (${elapsedMs} ms)`);
    assert.ok(elapsedMs < 2000, `serialized preparation took unexpectedly long (${elapsedMs} ms)`);

    console.log('Reader TTS cross-tab model lock contract: PASS', JSON.stringify({ ...probe, elapsedMs }));
  } finally {
    await context.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
