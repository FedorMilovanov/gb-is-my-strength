#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium, webkit } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const REPORTS = path.join(ROOT, 'reports');
fs.mkdirSync(REPORTS, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' };
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let pathname = decodeURIComponent((req.url || '/').split('?')[0]);
      let target = path.join(DIST, pathname.replace(/^\/+/, ''));
      if (pathname.endsWith('/')) target = path.join(target, 'index.html');
      if (!path.extname(target)) target = path.join(target, 'index.html');
      if (!target.startsWith(DIST) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(target).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: 'http://127.0.0.1:' + server.address().port }));
  });
}

async function makePage(browser, origin, viewport, saveData) {
  const page = await browser.newPage({ viewport, isMobile: viewport.width <= 430, hasTouch: viewport.width <= 430 });
  await page.addInitScript(({ saveDataValue }) => {
    window.__webSpeechCount = 0;
    window.__modelFetchCount = 0;
    window.__modelFetchAborted = false;
    function FakeUtterance(text) { this.text = text; this.rate = 1; this.lang = 'ru-RU'; }
    try { Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance }); } catch (_) { window.SpeechSynthesisUtterance = FakeUtterance; }
    const speech = {
      getVoices: () => [{ name: 'Fixture Russian', lang: 'ru-RU', localService: true }],
      speak: (u) => { window.__webSpeechCount += 1; window.__lastUtterance = u; },
      cancel: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    try { Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: speech }); } catch (_) { window.speechSynthesis = speech; }
    try { Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: saveDataValue } }); } catch (_) {}
    const nativeFetch = window.fetch.bind(window);
    window.fetch = function (url, options) {
      if (String(url).includes('model-quant.zip')) {
        window.__modelFetchCount += 1;
        return new Promise((resolve, reject) => {
          const signal = options && options.signal;
          const abort = () => { window.__modelFetchAborted = true; reject(new DOMException('Aborted', 'AbortError')); };
          if (signal && signal.aborted) abort();
          else if (signal) signal.addEventListener('abort', abort, { once: true });
        });
      }
      return nativeFetch(url, options);
    };
  }, { saveDataValue: !!saveData });
  page.__origin = origin;
  return page;
}

async function resetStorage(page, optout) {
  await page.evaluate(async (off) => {
    if (off) localStorage.setItem('gbx-vosk-warmup', 'off');
    else localStorage.removeItem('gbx-vosk-warmup');
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase('gb-vosk-tts');
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  }, !!optout);
}

async function clickPlay(page) {
  const play = page.locator('.gb-ember:visible').first();
  await play.waitFor({ state: 'visible' });
  await play.click();
  await page.waitForFunction(() => window.__webSpeechCount > 0);
}

async function assertCsp(page) {
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  assert.match(csp || '', /huggingface\.co/);
  assert.match(csp || '', /\*\.aws\.cdn\.hf\.co/);
  assert.match(csp || '', /cdn\.jsdelivr\.net/);
}

async function settledNoticeSnapshot(page) {
  await page.waitForFunction(() => Array.from(document.styleSheets).some((sheet) => String(sheet.href || '').includes('tts-download-notice.css')));
  await page.waitForFunction(() => {
    const el = document.querySelector('.gb-tts-download-notice.is-visible');
    if (!el) return false;
    const style = getComputedStyle(el);
    if (style.visibility !== 'visible' || Number.parseFloat(style.opacity) < 0.99) return false;
    const transform = style.transform;
    if (!transform || transform === 'none') return true;
    const values = transform.match(/matrix\(([^)]+)\)/);
    if (!values) return false;
    const parts = values[1].split(',').map(Number);
    return Math.abs(parts[0] - 1) < 0.002 && Math.abs(parts[3] - 1) < 0.002 && Math.abs(parts[5]) < 0.5;
  }, null, { timeout: 4000 });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return page.locator('.gb-tts-download-notice').evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const viewport = window.visualViewport;
    return {
      title: el.querySelector('.gb-tts-download-notice__title').textContent,
      meta: el.querySelector('.gb-tts-download-notice__meta').textContent,
      action: el.querySelector('.gb-tts-download-notice__action').textContent,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: viewport ? viewport.width : innerWidth,
      height: viewport ? viewport.height : innerHeight,
      innerWidth,
      innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      position: style.position,
      cssLeft: style.left,
      cssBottom: style.bottom,
      transform: style.transform,
      opacity: style.opacity,
      visibility: style.visibility,
    };
  });
}

async function coldScenario(browserType, origin, route, viewport, label) {
  const browser = await browserType.launch({ headless: true });
  const page = await makePage(browser, origin, viewport, false);
  try {
    await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
    await resetStorage(page, false);
    await assertCsp(page);
    await clickPlay(page);
    await page.waitForSelector('.gb-tts-download-notice[data-state="loading"].is-visible');
    const snapshot = await settledNoticeSnapshot(page);
    console.log('[tts-route]', label, JSON.stringify(snapshot));
    await page.screenshot({ path: path.join(REPORTS, 'tts-route-' + label + '.png'), fullPage: false });
    assert.equal(snapshot.title, 'Улучшенный голос загружается');
    assert.match(snapshot.meta, /Системный голос уже работает/);
    assert.equal(snapshot.action, 'Не загружать');
    assert.equal(snapshot.position, 'fixed');
    assert.equal(snapshot.opacity, '1');
    assert.equal(snapshot.visibility, 'visible');
    assert.ok(snapshot.left >= -0.5 && snapshot.right <= snapshot.width + 0.5, `notice horizontal bounds failed: ${JSON.stringify(snapshot)}`);
    assert.ok(snapshot.top >= -0.5 && snapshot.bottom <= snapshot.height + 0.5, `notice vertical bounds failed: ${JSON.stringify(snapshot)}`);
    assert.ok(snapshot.scrollWidth <= snapshot.innerWidth, `horizontal overflow: ${JSON.stringify(snapshot)}`);
    await page.locator('.gb-tts-download-notice__action').click();
    await page.waitForFunction(() => window.__modelFetchAborted === true);
  } finally {
    await browser.close();
  }
}

async function blockedScenario(browserType, origin, kind, label) {
  const browser = await browserType.launch({ headless: true });
  const page = await makePage(browser, origin, { width: 1280, height: 760 }, kind === 'save-data');
  try {
    await page.goto(origin + '/articles/dzhon-gill-chast-1-chelovek/', { waitUntil: 'domcontentloaded' });
    await resetStorage(page, kind === 'disabled');
    await clickPlay(page);
    await page.waitForSelector('.gb-tts-download-notice[data-state="' + kind + '"].is-visible');
    assert.equal(await page.evaluate(() => window.__modelFetchCount), 0);
    const expected = kind === 'disabled' ? 'Включить' : 'Загрузить';
    assert.equal(await page.locator('.gb-tts-download-notice__action').textContent(), expected);
    await page.locator('.gb-tts-download-notice__action').click();
    await page.waitForSelector('.gb-tts-download-notice[data-state="loading"].is-visible');
    assert.equal(await page.evaluate(() => window.__modelFetchCount), 1);
    await page.screenshot({ path: path.join(REPORTS, 'tts-route-' + label + '.png') });
  } finally {
    await browser.close();
  }
}

async function scriptFailure(origin) {
  const browser = await chromium.launch({ headless: true });
  const page = await makePage(browser, origin, { width: 1440, height: 900 }, false);
  await page.addInitScript(() => {
    window.__engineScriptBlocked = 0;
    const nativeAppendChild = HTMLHeadElement.prototype.appendChild;
    HTMLHeadElement.prototype.appendChild = function appendChild(node) {
      if (node && node.tagName === 'SCRIPT' && /\/js\/vosk-tts-engine\.js(?:\?|$)/.test(String(node.src || ''))) {
        window.__engineScriptBlocked += 1;
        setTimeout(() => node.dispatchEvent(new Event('error')), 0);
        return node;
      }
      return nativeAppendChild.call(this, node);
    };
  });
  try {
    await page.goto(origin + '/articles/dzhon-gill-chast-1-chelovek/', { waitUntil: 'domcontentloaded' });
    await resetStorage(page, false);
    await clickPlay(page);
    await page.waitForSelector('.gb-tts-download-notice[data-state="error"].is-visible');
    assert.equal(await page.evaluate(() => window.__engineScriptBlocked), 1);
    assert.equal(await page.locator('.gb-tts-download-notice__action').textContent(), 'Повторить');
    await page.screenshot({ path: path.join(REPORTS, 'tts-route-chromium-script-error.png') });
  } finally {
    await browser.close();
  }
}

(async () => {
  const { server, origin } = await startServer();
  try {
    await coldScenario(chromium, origin, '/articles/dzhon-gill-chast-1-chelovek/', { width: 1440, height: 900 }, 'chromium-gill-desktop');
    await coldScenario(chromium, origin, '/articles/dzhon-gill-chast-1-chelovek/', { width: 390, height: 844 }, 'chromium-gill-mobile390');
    await coldScenario(chromium, origin, '/articles/20-antisovetov-pastoru/', { width: 320, height: 568 }, 'chromium-standalone-mobile320');
    await coldScenario(webkit, origin, '/articles/dzhon-gill-chast-1-chelovek/', { width: 1280, height: 760 }, 'webkit-gill-desktop');
    await coldScenario(webkit, origin, '/articles/dzhon-gill-chast-1-chelovek/', { width: 390, height: 844 }, 'webkit-gill-mobile390');
    await blockedScenario(chromium, origin, 'disabled', 'chromium-optout-retry');
    await blockedScenario(chromium, origin, 'save-data', 'chromium-save-data-manual');
    await blockedScenario(webkit, origin, 'disabled', 'webkit-optout-retry');
    await scriptFailure(origin);
    console.log('TTS route status browser contract: PASS (Gill + standalone, Chromium + WebKit, 320/390/desktop, opt-out, Save-Data, script failure).');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exit(1); });
