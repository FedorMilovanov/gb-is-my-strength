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
const REPORTS = path.join(ROOT, 'reports');
fs.mkdirSync(REPORTS, { recursive: true });

function fixture() {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/runtime/reader-tts.css"><style>body{min-height:1200px}.cluster{position:fixed;right:12px;bottom:12px;z-index:20}.gb-ember{width:52px;height:52px}.gb-tts-download-notice{position:fixed;right:0;bottom:92px;z-index:30;width:100%;height:90px;background:#ddd;pointer-events:none}.gb-tts-download-notice__action{pointer-events:auto}.gb-tts-download-notice__meta{position:absolute;inset:0}</style></head><body data-fc-shortcuts="true"><article class="article-body" data-pagefind-body><h1 aria-hidden="true">Тест озвучки</h1><p>Первый длинный абзац нужен для проверки точной паузы и продолжения. Он содержит достаточно слов, чтобы граница речи находилась далеко от начала и изменение скорости не повторяло весь уже произнесённый фрагмент. Дополнительное предложение делает тест устойчивым.</p><ul><li><p>Вложенный пункт должен прозвучать только один раз.</p></li></ul><p>Финальный абзац завершает проверку перехода между частями.</p></article><div class="cluster" data-fc-root data-fc-shortcuts="true"><button class="gb-ember" data-fc-action="play" data-state="idle">PLAY</button></div><script type="module" src="/src/runtime/reader-tts.js"></script></body></html>`;
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
      constructor(text) { this.text = String(text); this.rate = 1; this.lang = ''; this.onboundary = null; this.onend = null; this.onerror = null; }
    }
    const speech = {
      getVoices: () => [{ name: 'Fixture Russian', lang: 'ru-RU', localService: true }],
      speak: (utterance) => { window.__speechProbe.active = utterance; window.__speechProbe.speaks.push({ text: utterance.text, rate: utterance.rate }); },
      cancel: () => { window.__speechProbe.cancels += 1; window.__speechProbe.active = null; },
      pause: () => { window.__speechProbe.pauses += 1; },
      resume: () => { window.__speechProbe.resumes += 1; },
      addEventListener: () => {}, removeEventListener: () => {},
    };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: Utterance });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: speech });
    window.__speechProbe.boundary = (index) => window.__speechProbe.active?.onboundary?.({ charIndex: index, name: 'word' });
  });
}

async function newWebPage(browser, origin, viewport = { width: 1280, height: 760 }) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width <= 430, hasTouch: viewport.width <= 430 });
  await installWebSpeech(context);
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.GBReaderTTS?.version === 2);
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
        assert.equal(await page.evaluate(() => window.GBReaderTTS.getState().phase), 'paused');
        assert.equal(await page.locator('[data-fc-action="play"]').getAttribute('data-state'), 'paused');
      } finally { await context.close(); }
    }

    {
      const { context, page } = await newWebPage(browser, origin);
      try {
        const button = page.locator('[data-fc-action="play"]');
        await button.click();
        await page.waitForFunction(() => window.__speechProbe.speaks.length === 1);
        await page.evaluate(() => window.__speechProbe.boundary(95));
        const offset = await page.evaluate(() => window.GBReaderTTS.getState().offset);
        await button.click();
        await button.click();
        await page.waitForFunction(() => window.GBReaderTTS.getState().phase === 'playing');
        const probe = await page.evaluate(() => ({ ...window.__speechProbe, offset: window.GBReaderTTS.getState().offset, active: null }));
        assert.equal(probe.speaks.length, 1, 'native pause/resume recreated the utterance');
        assert.equal(probe.pauses, 1);
        assert.equal(probe.resumes, 1);
        assert.equal(probe.offset, offset);
      } finally { await context.close(); }
    }

    {
      const { context, page } = await newWebPage(browser, origin);
      try {
        await page.locator('[data-fc-action="play"]').click();
        await page.waitForFunction(() => window.__speechProbe.speaks.length === 1);
        const first = await page.evaluate(() => window.__speechProbe.speaks[0].text);
        assert.ok(first.length > 150, 'fixture did not start inside the long paragraph');
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
      const { context, page } = await newWebPage(browser, origin, { width: 390, height: 844 });
      try {
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
        window.__voskProbe = { speaks: 0, cancels: 0 };
        window.VoskTTSEngine = {
          version: 2,
          isSupported: () => true,
          isReady: () => true,
          ensureLoaded: () => Promise.resolve(),
          retryLoading: () => Promise.resolve(),
          speak: () => {
            const handle = { engine: 'vosk', id: 77, cancelled: false };
            window.__voskProbe.speaks += 1;
            setTimeout(() => dispatchEvent(new CustomEvent('gb:vosk-synthesis-progress', { detail: { id: 77, value: 0.6 } })), 20);
            return handle;
          },
          cancel: () => { window.__voskProbe.cancels += 1; },
        };
      });
      const page = await context.newPage();
      try {
        await page.goto(origin, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.GBReaderTTS?.version === 2);
        await page.locator('[data-fc-action="play"]').click();
        await page.waitForFunction(() => window.__voskProbe.speaks === 1 && window.GBReaderTTS.getState().synthesisProgress > 0);
        const progress = await page.locator('[data-fc-action="play"]').evaluate((element) => parseFloat(getComputedStyle(element).getPropertyValue('--p')) || 0);
        assert.ok(progress > 0, 'worker synthesis progress did not reach the PLAY ring');
        await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
        assert.equal(await page.evaluate(() => window.__voskProbe.cancels), 1, 'pagehide did not cancel the active worker job');
      } finally { await context.close(); }
    }

    console.log('Reader TTS runtime browser contract: PASS');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exit(1); });
