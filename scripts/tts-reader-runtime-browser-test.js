#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const RUNTIME = fs.readFileSync(path.join(ROOT, 'src/runtime/reader-tts.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'src/runtime/reader-tts.css'), 'utf8');
const CUSTOM = fs.readFileSync(path.join(ROOT, 'js/vosk-custom-terms.json'), 'utf8');
const REPORTS = path.join(ROOT, 'reports');
fs.mkdirSync(REPORTS, { recursive: true });

function fixture() {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/runtime/reader-tts.css"><style>
  body{min-height:1200px}.cluster{position:fixed;right:12px;bottom:12px;z-index:20}.gb-ember{width:52px;height:52px}.article-body{max-width:760px}.gb-tts-download-notice{position:fixed;right:0;bottom:0;z-index:30;width:100%;height:90px;background:#ddd}.gb-tts-download-notice__meta{position:absolute;inset:0}
  </style></head><body data-fc-shortcuts="true">
  <article class="article-body" data-pagefind-body><h1>Тест озвучки</h1><p>Первый длинный абзац нужен для проверки точной паузы и продолжения. Он содержит достаточно слов, чтобы граница речи находилась далеко от начала и изменение скорости не повторяло весь уже произнесённый фрагмент. Дополнительное предложение делает тест устойчивым.</p><ul><li><p>Вложенный пункт должен прозвучать только один раз.</p></li></ul><p>Финальный абзац завершает проверку перехода между частями.</p></article>
  <div class="cluster" data-fc-root data-fc-shortcuts="true"><button class="gb-ember" data-fc-action="play" data-state="idle">PLAY</button></div>
  <script type="module" src="/src/runtime/reader-tts.js"></script></body></html>`;
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const pathname = (req.url || '/').split('?')[0];
      if (pathname === '/src/runtime/reader-tts.js') {
        res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
        res.end(RUNTIME);
        return;
      }
      if (pathname === '/src/runtime/reader-tts.css') {
        res.writeHead(200, { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-store' });
        res.end(CSS);
        return;
      }
      if (pathname === '/js/vosk-custom-terms.json') {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(CUSTOM);
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(fixture());
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

async function installWebSpeech(context) {
  await context.addInitScript(() => {
    window.__speechProbe = { speaks: [], cancels: 0, pauses: 0, resumes: 0, active: null };
    class Utterance {
      constructor(text) {
        this.text = String(text);
        this.rate = 1;
        this.lang = '';
        this.onboundary = null;
        this.onend = null;
        this.onerror = null;
      }
    }
    const speech = {
      getVoices: () => [{ name: 'Fixture Russian', lang: 'ru-RU', localService: true }],
      speak: (utterance) => {
        window.__speechProbe.active = utterance;
        window.__speechProbe.speaks.push({ text: utterance.text, rate: utterance.rate });
      },
      cancel: () => {
        window.__speechProbe.cancels += 1;
        window.__speechProbe.active = null;
      },
      pause: () => { window.__speechProbe.pauses += 1; },
      resume: () => { window.__speechProbe.resumes += 1; },
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: Utterance });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: speech });
    window.__speechProbe.boundary = (index) => {
      const utterance = window.__speechProbe.active;
      if (utterance?.onboundary) utterance.onboundary({ charIndex: index, name: 'word' });
    };
  });
}

async function newWebPage(browser, origin, viewport = { width: 1280, height: 760 }) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width <= 430, hasTouch: viewport.width <= 430 });
  await installWebSpeech(context);
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.GBReaderTTS?.version === 1);
  return { context, page };
}

(async () => {
  const { server, origin } = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    {
      const { context, page } = await newWebPage(browser, origin);
      try {
        await page.evaluate(() => { const button = document.querySelector('[data-fc-action="play"]'); button.click(); button.click(); });
        await page.waitForTimeout(80);
        const snap = await page.evaluate(() => ({ state: window.GBReaderTTS.getState(), speaks: window.__speechProbe.speaks.length, button: document.querySelector('[data-fc-action="play"]').dataset.state }));
        assert.equal(snap.state.phase, 'paused', JSON.stringify(snap));
        assert.equal(snap.button, 'paused');
      } finally { await context.close(); }
    }

    {
      const { context, page } = await newWebPage(browser, origin);
      try {
        const button = page.locator('[data-fc-action="play"]');
        await button.click();
        await page.waitForFunction(() => window.__speechProbe.speaks.length === 1);
        await page.evaluate(() => window.__speechProbe.boundary(95));
        const before = await page.evaluate(() => window.GBReaderTTS.getState().offset);
        await button.click();
        await page.waitForFunction(() => window.GBReaderTTS.getState().phase === 'paused');
        await button.click();
        await page.waitForFunction(() => window.GBReaderTTS.getState().phase === 'playing');
        const probe = await page.evaluate(() => ({ speaks: window.__speechProbe.speaks.length, pauses: window.__speechProbe.pauses, resumes: window.__speechProbe.resumes, offset: window.GBReaderTTS.getState().offset }));
        assert.equal(probe.speaks, 1, 'native pause/resume must not create a replacement utterance');
        assert.equal(probe.pauses, 1);
        assert.equal(probe.resumes, 1);
        assert.equal(probe.offset, before);
      } finally { await context.close(); }
    }

    {
      const { context, page } = await newWebPage(browser, origin);
      try {
        await page.locator('[data-fc-action="play"]').click();
        await page.waitForFunction(() => window.__speechProbe.speaks.length === 1);
        const first = await page.evaluate(() => window.__speechProbe.speaks[0].text);
        await page.evaluate(() => {
          window.__speechProbe.boundary(105);
          localStorage.setItem('gb:audio:rate', '1.5');
          dispatchEvent(new CustomEvent('gb:tts-rate-change'));
        });
        await page.waitForFunction(() => window.__speechProbe.speaks.length === 2);
        const second = await page.evaluate(() => window.__speechProbe.speaks[1]);
        assert.ok(second.text.length < first.length, 'speed change replayed the full active chunk');
        assert.notEqual(second.text, first);
        assert.equal(second.rate, 1.5);
      } finally { await context.close(); }
    }

    {
      const { context, page } = await newWebPage(browser, origin);
      try {
        await page.locator('[data-fc-action="play"]').click();
        await page.waitForFunction(() => window.__speechProbe.speaks.length === 1);
        const before = await page.evaluate(() => window.__speechProbe.cancels);
        await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
        await page.waitForTimeout(40);
        const snap = await page.evaluate(() => ({ phase: window.GBReaderTTS.getState().phase, cancels: window.__speechProbe.cancels }));
        assert.equal(snap.phase, 'idle');
        assert.ok(snap.cancels > before, 'pagehide did not cancel speech');
      } finally { await context.close(); }
    }

    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await installWebSpeech(context);
      const page = await context.newPage();
      try {
        await page.goto(origin, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.GBReaderTTS?.version === 1);
        await page.evaluate(() => {
          const notice = document.createElement('div');
          notice.className = 'gb-tts-download-notice is-visible';
          notice.innerHTML = '<span class="gb-tts-download-notice__meta">Сейчас используется системный голос</span><button class="gb-tts-download-notice__action">Включить</button>';
          document.body.appendChild(notice);
        });
        await page.locator('[data-fc-action="play"]').click();
        await page.waitForFunction(() => window.GBReaderTTS.getState().phase === 'playing');
        const pointer = await page.locator('.gb-tts-download-notice').evaluate((element) => ({ root: getComputedStyle(element).pointerEvents, action: getComputedStyle(element.querySelector('button')).pointerEvents, bottom: getComputedStyle(element).bottom }));
        assert.equal(pointer.root, 'none');
        assert.equal(pointer.action, 'auto');
        assert.notEqual(pointer.bottom, '0px');
        await page.screenshot({ path: path.join(REPORTS, 'tts-reader-mobile-notice-click.png') });
      } finally { await context.close(); }
    }

    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 760 } });
      await context.addInitScript(() => {
        window.__voskProbe = { speaks: 0, locks: 0 };
        window.ort = { env: { wasm: { proxy: false } } };
        window.VoskTTSCore = {
          parseDictionary: () => new Map([['оуэн', ['fixture']], ['обычное', ['fixture']]]),
        };
        window.VoskTTSEngine = {
          isSupported: () => true,
          isReady: () => true,
          ensureLoaded: () => Promise.resolve(),
          retryLoading: () => Promise.resolve(),
          speak: () => { window.__voskProbe.speaks += 1; return { engine: 'vosk', cancelled: false }; },
          cancel: () => {},
        };
      });
      const page = await context.newPage();
      try {
        await page.goto(origin, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.GBReaderTTS?.version === 1);
        await page.waitForTimeout(150);
        const contract = await page.evaluate(() => {
          const dictionary = window.VoskTTSCore.parseDictionary('fixture');
          return { proxy: window.ort.env.wasm.proxy, hasManual: dictionary.has('оуэн'), hasNormal: dictionary.has('обычное') };
        });
        assert.equal(contract.proxy, true, 'ORT proxy was not enabled');
        assert.equal(contract.hasManual, false, 'manual pronunciation did not override model dictionary membership');
        assert.equal(contract.hasNormal, true);
        await page.locator('[data-fc-action="play"]').click();
        await page.waitForFunction(() => window.__voskProbe.speaks === 1);
        await page.waitForTimeout(350);
        const progress = await page.locator('[data-fc-action="play"]').evaluate((element) => parseFloat(getComputedStyle(element).getPropertyValue('--p')) || 0);
        assert.ok(progress > 0, 'Vosk generation progress remained frozen');
      } finally { await context.close(); }
    }

    console.log('Reader TTS runtime browser contract: PASS');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
