#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

function replaceOnce(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(oldText, newText);
}

const files = {
  controller: 'js/floating-cluster-controller.js',
  contract: 'scripts/tts-engine-status-contract-test.js',
  routeTest: 'scripts/tts-status-route-browser-test.js',
};

let controller = fs.readFileSync(files.controller, 'utf8');
controller = replaceOnce(
  controller,
  `    _registeredListeners = [];
  };`,
  `    _registeredListeners = [];
    cancelScheduledVoskWarmup();
  };`,
  'controller cleanup cancels scheduled warm-up',
);
controller = replaceOnce(
  controller,
  `  var _voskEngineScriptPromise = null;
  var VOSK_ENGINE_SRC = '/js/vosk-tts-engine.js?v=9ca1685a';
  var TTS_NOTICE_CSS_SRC = '/css/tts-download-notice.css?v=475abd4b';
  var fallbackTtsNoticeTimer = null;`,
  `  var _voskEngineScriptPromise = null;
  var VOSK_ENGINE_SRC = '/js/vosk-tts-engine.js?v=9ca1685a';
  var TTS_NOTICE_CSS_SRC = '/css/tts-download-notice.css?v=475abd4b';
  var fallbackTtsNoticeTimer = null;
  var fallbackTtsNoticeStylesPromise = null;
  var _voskWarmupStartPromise = null;
  var _voskWarmupStartTimer = null;
  var _voskWarmupScheduleId = 0;
  var VOSK_BROWSER_STATUS_DWELL_MS = 800;
  var TTS_NOTICE_STYLE_TIMEOUT_MS = 5000;
  var TTS_NOTICE_PAINT_TIMEOUT_MS = 2200;`,
  'controller scheduling state',
);
controller = replaceOnce(
  controller,
  `  function ensureFallbackTtsNoticeStyles() {
    if (document.querySelector('link[data-gb-tts-download-notice]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = TTS_NOTICE_CSS_SRC;
    link.setAttribute('data-gb-tts-download-notice', 'true');
    document.head.appendChild(link);
  }`,
  `  function fallbackTtsNoticeStylesApplied(link) {
    if (!(link && link.sheet)) return false;
    try { return link.sheet.cssRules.length > 0; }
    catch (_) { return true; }
  }

  function ensureFallbackTtsNoticeStyles() {
    var existing = document.querySelector('link[data-gb-tts-download-notice]');
    if (fallbackTtsNoticeStylesApplied(existing)) return Promise.resolve(true);
    if (fallbackTtsNoticeStylesPromise) return fallbackTtsNoticeStylesPromise;

    fallbackTtsNoticeStylesPromise = new Promise(function (resolve) {
      var link = existing || document.createElement('link');
      var settled = false;
      var timeout = null;

      function finish(applied) {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        if (!applied) fallbackTtsNoticeStylesPromise = null;
        resolve(applied);
      }
      function probe() {
        if (settled) return;
        if (fallbackTtsNoticeStylesApplied(link)) {
          finish(true);
          return;
        }
        setTimeout(probe, 32);
      }

      link.addEventListener('load', probe, { once: true });
      link.addEventListener('error', function () { finish(false); }, { once: true });
      if (!existing) {
        link.rel = 'stylesheet';
        link.href = TTS_NOTICE_CSS_SRC;
        link.setAttribute('data-gb-tts-download-notice', 'true');
        document.head.appendChild(link);
      }
      timeout = setTimeout(function () { finish(false); }, TTS_NOTICE_STYLE_TIMEOUT_MS);
      probe();
    });
    return fallbackTtsNoticeStylesPromise;
  }`,
  'notice stylesheet readiness promise',
);
controller = replaceOnce(
  controller,
  `  function showVoskStatus(stateName, options) {
    if (window.VoskTTSEngine && typeof window.VoskTTSEngine.showStatus === 'function') {
      return window.VoskTTSEngine.showStatus(stateName, options || {});
    }
    return showFallbackTtsStatus(stateName, options || {});
  }

  function loadVoskEngineScript() {`,
  `  function showVoskStatus(stateName, options) {
    if (window.VoskTTSEngine && typeof window.VoskTTSEngine.showStatus === 'function') {
      return window.VoskTTSEngine.showStatus(stateName, options || {});
    }
    return showFallbackTtsStatus(stateName, options || {});
  }

  function fallbackBrowserStatusPainted() {
    var el = qs('.gb-tts-download-notice[data-state="browser"].is-visible');
    if (!el) return false;
    var style;
    try { style = getComputedStyle(el); } catch (_) { return false; }
    return style.position === 'fixed' &&
      style.visibility === 'visible' &&
      Number.parseFloat(style.opacity || '0') >= 0.99;
  }

  function waitForFallbackTtsNoticePaint() {
    return ensureFallbackTtsNoticeStyles().then(function () {
      return new Promise(function (resolve) {
        var settled = false;
        var timeout = setTimeout(function () { finish(false); }, TTS_NOTICE_PAINT_TIMEOUT_MS);
        function finish(painted) {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve(painted);
        }
        function probe() {
          if (settled) return;
          if (fallbackBrowserStatusPainted()) {
            requestAnimationFrame(function () { finish(true); });
            return;
          }
          requestAnimationFrame(probe);
        }
        requestAnimationFrame(probe);
      });
    });
  }

  function cancelScheduledVoskWarmup() {
    _voskWarmupScheduleId += 1;
    if (_voskWarmupStartTimer) clearTimeout(_voskWarmupStartTimer);
    _voskWarmupStartTimer = null;
    _voskWarmupStartPromise = null;
  }

  function scheduleVoskWarmupAfterBrowserStatus() {
    if (_voskWarmupPromise || _voskWarmupStartPromise || _voskWarmupStartTimer) return;
    var scheduleId = ++_voskWarmupScheduleId;
    function beginDwell() {
      if (scheduleId !== _voskWarmupScheduleId) return;
      _voskWarmupStartPromise = null;
      _voskWarmupStartTimer = setTimeout(function () {
        if (scheduleId !== _voskWarmupScheduleId) return;
        _voskWarmupStartTimer = null;
        warmVoskInBackground({ preserveBrowserStatus: true });
      }, VOSK_BROWSER_STATUS_DWELL_MS);
    }
    _voskWarmupStartPromise = waitForFallbackTtsNoticePaint().then(beginDwell, beginDwell);
  }

  function loadVoskEngineScript() {`,
  'paint-aware automatic warm-up scheduler',
);
controller = replaceOnce(
  controller,
  `    var manual = options.manual === true;
    var retry = options.retry === true;
    var preserveBrowserStatus = options.preserveBrowserStatus === true;`,
  `    var manual = options.manual === true;
    var retry = options.retry === true;
    var preserveBrowserStatus = options.preserveBrowserStatus === true;
    if (manual || retry) cancelScheduledVoskWarmup();`,
  'manual warm-up cancels scheduled automatic start',
);
controller = replaceOnce(
  controller,
  `    if ('speechSynthesis' in window) {
      showVoskStatus('browser');
      warmVoskInBackground({ preserveBrowserStatus: true });
      return Promise.resolve('webspeech');
    }`,
  `    if ('speechSynthesis' in window) {
      showVoskStatus('browser');
      if (voskWarmupBlockReason()) warmVoskInBackground({ preserveBrowserStatus: true });
      else scheduleVoskWarmupAfterBrowserStatus();
      return Promise.resolve('webspeech');
    }`,
  'automatic warm-up waits for painted system-voice status',
);
controller = replaceOnce(
  controller,
  `  function stopTts() {
    if (!ttsAvailable()) return;
    ttsState.runId += 1;`,
  `  function stopTts() {
    if (!ttsAvailable()) return;
    cancelScheduledVoskWarmup();
    ttsState.runId += 1;`,
  'stop cancels scheduled warm-up',
);
fs.writeFileSync(files.controller, controller);

let contract = fs.readFileSync(files.contract, 'utf8');
contract = replaceOnce(
  contract,
  `    ['browser status preserved during automatic warm-up', controller, /showVoskStatus\('browser'\);\s*warmVoskInBackground\(\{ preserveBrowserStatus: true \}\)/],`,
  `    ['browser status schedules painted warm-up', controller, /showVoskStatus\('browser'\);[\s\S]{0,180}else scheduleVoskWarmupAfterBrowserStatus\(\)/],
    ['notice stylesheet readiness promise', controller, /function ensureFallbackTtsNoticeStyles\(\)[\s\S]{0,1200}fallbackTtsNoticeStylesApplied\(link\)[\s\S]{0,500}TTS_NOTICE_STYLE_TIMEOUT_MS/],
    ['browser paint gate', controller, /function waitForFallbackTtsNoticePaint\(\)[\s\S]{0,1000}fallbackBrowserStatusPainted\(\)[\s\S]{0,420}requestAnimationFrame/],
    ['post-paint browser dwell', controller, /VOSK_BROWSER_STATUS_DWELL_MS\s*=\s*(?:[7-9]\d{2}|1\d{3})[\s\S]{0,2600}setTimeout\([\s\S]{0,420}warmVoskInBackground\(\{ preserveBrowserStatus: true \}\)[\s\S]{0,160}VOSK_BROWSER_STATUS_DWELL_MS/],
    ['scheduled warm-up cancellation', controller, /function cancelScheduledVoskWarmup\(\)[\s\S]{0,360}clearTimeout\(_voskWarmupStartTimer\)[\s\S]*function stopTts\(\)[\s\S]{0,120}cancelScheduledVoskWarmup\(\)/],`,
  'source checks for painted browser status',
);
contract = replaceOnce(
  contract,
  `  ['browser status preservation removed', engine, controller.replace('preserveBrowserStatus: true', 'preserveBrowserStatus: false'), css, workflow, cacheAssets],`,
  `  ['browser status preservation removed', engine, controller.replace('preserveBrowserStatus: true', 'preserveBrowserStatus: false'), css, workflow, cacheAssets],
  ['painted warm-up scheduler bypassed', engine, controller.replace('else scheduleVoskWarmupAfterBrowserStatus();', 'else warmVoskInBackground({ preserveBrowserStatus: true });'), css, workflow, cacheAssets],
  ['stylesheet readiness bypassed', engine, controller.replace('return ensureFallbackTtsNoticeStyles().then(function () {', 'return Promise.resolve().then(function () {'), css, workflow, cacheAssets],
  ['post-paint dwell removed', engine, controller.replace('VOSK_BROWSER_STATUS_DWELL_MS = 800', 'VOSK_BROWSER_STATUS_DWELL_MS = 0'), css, workflow, cacheAssets],`,
  'adversarial mutations for WebKit paint gate',
);
fs.writeFileSync(files.contract, contract);

let routeTest = fs.readFileSync(files.routeTest, 'utf8');
routeTest = replaceOnce(
  routeTest,
  `async function makePage(browser, origin, viewport, saveData) {`,
  `async function makePage(browser, origin, viewport, saveData, noticeCssDelayMs = 0) {`,
  'route fixture accepts delayed notice stylesheet',
);
routeTest = replaceOnce(
  routeTest,
  `    window.__webSpeechCount = 0;
    window.__modelFetchCount = 0;
    window.__modelFetchAborted = false;`,
  `    window.__webSpeechCount = 0;
    window.__modelFetchCount = 0;
    window.__modelFetchAborted = false;
    window.__engineScriptAppendCount = 0;
    const nativeHeadAppendChild = HTMLHeadElement.prototype.appendChild;
    HTMLHeadElement.prototype.appendChild = function appendChild(node) {
      if (node && node.tagName === 'SCRIPT' && /\/js\/vosk-tts-engine\.js(?:\?|$)/.test(String(node.src || ''))) {
        window.__engineScriptAppendCount += 1;
      }
      return nativeHeadAppendChild.call(this, node);
    };`,
  'route fixture tracks engine script start',
);
routeTest = replaceOnce(
  routeTest,
  `  }, { saveDataValue: !!saveData });
  page.__origin = origin;`,
  `  }, { saveDataValue: !!saveData });
  if (noticeCssDelayMs > 0) {
    await page.route(/\/css\/tts-download-notice\.css(?:\?|$)/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, noticeCssDelayMs));
      await route.continue();
    });
  }
  page.__origin = origin;`,
  'route fixture delays notice stylesheet request',
);
routeTest = replaceOnce(
  routeTest,
  `async function scriptFailure(origin) {`,
  `async function delayedNoticeStylesScenario(origin) {
  const browser = await webkit.launch({ headless: true });
  const page = await makePage(browser, origin, { width: 390, height: 844 }, false, 1600);
  try {
    await page.goto(origin + '/articles/dzhon-gill-chast-1-chelovek/', { waitUntil: 'domcontentloaded' });
    await resetStorage(page, false);
    await clickPlay(page);
    await page.waitForSelector('.gb-tts-download-notice[data-state="browser"]');
    await page.waitForTimeout(500);
    assert.ok(await page.evaluate(() => window.__webSpeechCount > 0), 'Web Speech did not start immediately');
    assert.equal(await page.evaluate(() => window.__engineScriptAppendCount), 0, 'Vosk engine started before delayed notice CSS painted');
    assert.equal(await page.evaluate(() => window.__modelFetchCount), 0, 'model fetch started before delayed notice CSS painted');

    await page.waitForFunction(() => {
      const el = document.querySelector('.gb-tts-download-notice[data-state="browser"].is-visible');
      if (!el) return false;
      const style = getComputedStyle(el);
      return style.position === 'fixed' && style.visibility === 'visible' && Number.parseFloat(style.opacity) >= 0.99;
    }, null, { timeout: 10000 });
    const paintedAt = Date.now();
    const browserSnapshot = await settledNoticeSnapshot(page);
    assert.equal(browserSnapshot.title, 'Сейчас системный голос');
    assert.match(browserSnapshot.meta, /Улучшенный голос проверяется/);
    assert.equal(await page.evaluate(() => window.__engineScriptAppendCount), 0, 'engine started before browser status dwell');

    await page.waitForFunction(() => window.__engineScriptAppendCount > 0, null, { timeout: 10000 });
    const postPaintDelay = Date.now() - paintedAt;
    assert.ok(postPaintDelay >= 650, 'post-paint dwell was only ' + postPaintDelay + 'ms');
    await page.waitForSelector('.gb-tts-download-notice[data-state="loading"].is-visible', { timeout: 15000 });
    assert.equal(await page.evaluate(() => window.__modelFetchCount), 1);
    await page.screenshot({ path: path.join(REPORTS, 'tts-route-webkit-delayed-notice-css.png') });
    await page.locator('.gb-tts-download-notice__action').click();
    await page.waitForFunction(() => window.__modelFetchAborted === true);
    console.log('[tts-route] webkit-delayed-notice-css', JSON.stringify({ postPaintDelay, browserSnapshot }));
  } finally {
    await browser.close();
  }
}

async function scriptFailure(origin) {`,
  'WebKit delayed stylesheet scenario',
);
routeTest = replaceOnce(
  routeTest,
  `    await coldScenario(webkit, origin, '/articles/dzhon-gill-chast-1-chelovek/', { width: 390, height: 844 }, 'webkit-gill-mobile390');
    await blockedScenario(chromium, origin, 'disabled', 'chromium-optout-retry');`,
  `    await coldScenario(webkit, origin, '/articles/dzhon-gill-chast-1-chelovek/', { width: 390, height: 844 }, 'webkit-gill-mobile390');
    await delayedNoticeStylesScenario(origin);
    await blockedScenario(chromium, origin, 'disabled', 'chromium-optout-retry');`,
  'invoke WebKit delayed stylesheet scenario',
);
routeTest = replaceOnce(
  routeTest,
  `    console.log('TTS route status browser contract: PASS (Gill + standalone, Chromium + WebKit, 320/390/desktop, opt-out, Save-Data, script failure).');`,
  `    console.log('TTS route status browser contract: PASS (Gill + standalone, Chromium + WebKit, delayed WebKit CSS, 320/390/desktop, opt-out, Save-Data, script failure).');`,
  'route contract summary',
);
fs.writeFileSync(files.routeTest, routeTest);

for (const file of Object.values(files)) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
execFileSync(process.execPath, [files.contract], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js', '--write'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js'], { stdio: 'inherit' });

console.log(JSON.stringify({
  changedProductFiles: Object.values(files),
  browserStatusDwellMs: 800,
  noticeStyleTimeoutMs: 5000,
  noticePaintTimeoutMs: 2200,
  delayedWebKitCssMs: 1600,
  revisionProjection: 'cache-bust --write',
}, null, 2));
