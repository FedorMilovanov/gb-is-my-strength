#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const ORIGIN = 'https://gospod-bog.ru';
const EXPECTED_MAIN = '6869e0389c7e0981f002f6471f870230f3cd3c99';
const EXPECTED = {
  controller: '/js/floating-cluster-controller.js?v=e7ba3d29',
  engine: '/js/vosk-tts-engine.js?v=87bfc44a',
  noticeCss: '/css/tts-download-notice.css?v=1cdbee44',
};
const MODEL_MARKER = 'model-quant.zip';
const REPORTS = path.resolve('reports');
fs.mkdirSync(REPORTS, { recursive: true });

const summary = {
  origin: ORIGIN,
  expectedMain: EXPECTED_MAIN,
  expectedAssets: EXPECTED,
  startedAt: new Date().toISOString(),
  scenarios: [],
};

function assetPath(url) {
  const parsed = new URL(url, ORIGIN);
  return parsed.pathname + parsed.search;
}

function assertExactAsset(url, expected, label) {
  assert.equal(assetPath(url), expected, `${label}: expected ${expected}, got ${url}`);
}

async function installHarness(page, options = {}) {
  const {
    saveData = false,
    modelMode = 'pending',
    engineMode = 'delay',
    engineDelayMs = 700,
  } = options;

  await page.addInitScript(({ saveDataValue, modelModeValue, engineModeValue, engineDelay }) => {
    window.__ttsProof = {
      webSpeechCount: 0,
      modelFetchCount: 0,
      modelFetchAborted: false,
      engineAttemptCount: 0,
      engineAttemptSrc: '',
      statusEvents: [],
      noticeStates: [],
    };

    function FakeUtterance(text) {
      this.text = text;
      this.rate = 1;
      this.lang = 'ru-RU';
      this.onend = null;
      this.onerror = null;
    }

    try {
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        configurable: true,
        value: FakeUtterance,
      });
    } catch (_) {
      window.SpeechSynthesisUtterance = FakeUtterance;
    }

    const speech = {
      speaking: false,
      paused: false,
      pending: false,
      getVoices: () => [{ name: 'Production Proof Russian', lang: 'ru-RU', localService: true }],
      speak: (utterance) => {
        window.__ttsProof.webSpeechCount += 1;
        window.__ttsProof.lastUtterance = String(utterance && utterance.text || '');
        speech.speaking = true;
      },
      cancel: () => { speech.speaking = false; },
      pause: () => { speech.paused = true; },
      resume: () => { speech.paused = false; },
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    try {
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: speech });
    } catch (_) {
      window.speechSynthesis = speech;
    }

    try {
      Object.defineProperty(navigator, 'connection', {
        configurable: true,
        value: { saveData: !!saveDataValue, effectiveType: '4g' },
      });
    } catch (_) {}

    window.addEventListener('gb:vosk-status', (event) => {
      const detail = event && event.detail ? event.detail : {};
      window.__ttsProof.statusEvents.push({
        phase: detail.phase || '',
        title: detail.title || '',
        message: detail.message || '',
        action: detail.action || '',
        reason: detail.reason || '',
        at: Date.now(),
      });
    });

    const recordNotice = () => {
      const el = document.querySelector('.gb-tts-download-notice');
      if (!el) return;
      const title = el.querySelector('.gb-tts-download-notice__title');
      const meta = el.querySelector('.gb-tts-download-notice__meta');
      const next = {
        state: el.getAttribute('data-state') || '',
        visible: el.classList.contains('is-visible'),
        title: title ? title.textContent : '',
        meta: meta ? meta.textContent : '',
        at: Date.now(),
      };
      const previous = window.__ttsProof.noticeStates[window.__ttsProof.noticeStates.length - 1];
      if (!previous || previous.state !== next.state || previous.visible !== next.visible || previous.title !== next.title) {
        window.__ttsProof.noticeStates.push(next);
      }
    };

    document.addEventListener('DOMContentLoaded', () => {
      recordNotice();
      const observer = new MutationObserver(recordNotice);
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['class', 'data-state', 'hidden'],
        characterData: true,
      });
    }, { once: true });

    const nativeFetch = window.fetch.bind(window);
    window.fetch = function proofFetch(url, fetchOptions) {
      const href = String(url || '');
      if (!href.includes('model-quant.zip')) return nativeFetch(url, fetchOptions);

      window.__ttsProof.modelFetchCount += 1;
      const attempt = window.__ttsProof.modelFetchCount;
      if (modelModeValue === 'fail-first' && attempt === 1) {
        return Promise.reject(new TypeError('production proof model network failure'));
      }
      if (modelModeValue === 'http-error') {
        return Promise.resolve(new Response('proof failure', { status: 503 }));
      }

      return new Promise((resolve, reject) => {
        const signal = fetchOptions && fetchOptions.signal;
        const abort = () => {
          window.__ttsProof.modelFetchAborted = true;
          reject(new DOMException('Aborted by production proof', 'AbortError'));
        };
        if (signal && signal.aborted) abort();
        else if (signal) signal.addEventListener('abort', abort, { once: true });
      });
    };

    const nativeAppendChild = HTMLHeadElement.prototype.appendChild;
    HTMLHeadElement.prototype.appendChild = function proofAppendChild(node) {
      const src = node && node.tagName === 'SCRIPT' ? String(node.src || '') : '';
      if (/\/js\/vosk-tts-engine\.js(?:\?|$)/.test(src)) {
        window.__ttsProof.engineAttemptCount += 1;
        window.__ttsProof.engineAttemptSrc = src;
        const attempt = window.__ttsProof.engineAttemptCount;
        if (engineModeValue === 'fail-first' && attempt === 1) {
          setTimeout(() => node.dispatchEvent(new Event('error')), 60);
          return node;
        }
        if (engineModeValue === 'delay' || engineModeValue === 'fail-first') {
          const target = this;
          setTimeout(() => nativeAppendChild.call(target, node), engineDelay);
          return node;
        }
      }
      return nativeAppendChild.call(this, node);
    };
  }, {
    saveDataValue: saveData,
    modelModeValue: modelMode,
    engineModeValue: engineMode,
    engineDelay: engineDelayMs,
  });
}

async function resetStorage(page, { optOut = false } = {}) {
  await page.evaluate(async ({ off }) => {
    if (off) localStorage.setItem('gbx-vosk-warmup', 'off');
    else localStorage.removeItem('gbx-vosk-warmup');
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase('gb-vosk-tts');
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  }, { off: optOut });
}

function attachDiagnostics(page, scenario) {
  page.on('pageerror', (error) => scenario.pageErrors.push(String(error && error.stack || error)));
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (url.includes(MODEL_MARKER)) return;
    if (/\.(?:js|css)(?:\?|$)/.test(url) || /cdn\.jsdelivr\.net/.test(url)) {
      scenario.assetFailures.push({ url, error: request.failure() && request.failure().errorText || 'request failed' });
    }
  });
  page.on('response', (response) => {
    const url = response.url();
    if ((/\.(?:js|css)(?:\?|$)/.test(url) || /cdn\.jsdelivr\.net/.test(url)) && response.status() >= 400) {
      scenario.assetFailures.push({ url, status: response.status() });
    }
  });
}

async function gotoRoute(page, route, label) {
  const separator = route.includes('?') ? '&' : '?';
  await page.goto(`${ORIGIN}${route}${separator}tts_proof=${encodeURIComponent(label)}_${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('.gb-ember:visible', { timeout: 30000 });
}

async function clickPlay(page) {
  const play = page.locator('.gb-ember:visible').first();
  await play.click();
  await page.waitForFunction(() => window.__ttsProof && window.__ttsProof.webSpeechCount > 0, null, { timeout: 10000 });
}

async function waitForState(page, state, timeout = 60000) {
  await page.waitForSelector(`.gb-tts-download-notice[data-state="${state}"].is-visible`, { timeout });
}

async function noticeSnapshot(page) {
  return page.locator('.gb-tts-download-notice').evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const action = el.querySelector('.gb-tts-download-notice__action');
    const actionRect = action && !action.hidden ? action.getBoundingClientRect() : null;
    const visual = window.visualViewport;
    return {
      state: el.getAttribute('data-state'),
      role: el.getAttribute('role'),
      ariaLive: el.getAttribute('aria-live'),
      ariaAtomic: el.getAttribute('aria-atomic'),
      title: el.querySelector('.gb-tts-download-notice__title')?.textContent || '',
      meta: el.querySelector('.gb-tts-download-notice__meta')?.textContent || '',
      action: action?.textContent || '',
      actionHidden: !!(action && action.hidden),
      actionAria: action?.getAttribute('aria-label') || '',
      noticeCount: document.querySelectorAll('.gb-tts-download-notice').length,
      engineScriptCount: document.querySelectorAll('script[src*="/js/vosk-tts-engine.js"]').length,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: visual ? visual.width : innerWidth,
      height: visual ? visual.height : innerHeight,
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      actionRect: actionRect ? {
        left: actionRect.left,
        right: actionRect.right,
        top: actionRect.top,
        bottom: actionRect.bottom,
        width: actionRect.width,
        height: actionRect.height,
      } : null,
    };
  });
}

function assertGeometry(snapshot, { mobile = false } = {}) {
  assert.equal(snapshot.role, 'status');
  assert.equal(snapshot.ariaLive, 'polite');
  assert.equal(snapshot.ariaAtomic, 'true');
  assert.equal(snapshot.noticeCount, 1, `duplicate notice: ${JSON.stringify(snapshot)}`);
  assert.ok(snapshot.left >= -1 && snapshot.right <= snapshot.width + 1, `notice horizontal clipping: ${JSON.stringify(snapshot)}`);
  assert.ok(snapshot.top >= -1 && snapshot.bottom <= snapshot.height + 1, `notice vertical clipping: ${JSON.stringify(snapshot)}`);
  assert.ok(snapshot.scrollWidth <= snapshot.innerWidth + 1, `root horizontal overflow: ${JSON.stringify(snapshot)}`);
  if (snapshot.actionRect) {
    assert.ok(snapshot.actionRect.left >= -1 && snapshot.actionRect.right <= snapshot.width + 1, `action clipping: ${JSON.stringify(snapshot)}`);
    assert.ok(snapshot.actionRect.height >= (mobile ? 40 : 32), `action target too small: ${JSON.stringify(snapshot)}`);
  }
}

async function verifyLiveAssets(page) {
  const controllerSrc = await page.locator('script[src*="/js/floating-cluster-controller.js"]').first().getAttribute('src');
  assert.ok(controllerSrc, 'live page does not reference floating-cluster-controller.js');
  assertExactAsset(controllerSrc, EXPECTED.controller, 'controller revision');

  const controllerResponse = await page.request.get(new URL(controllerSrc, ORIGIN).toString(), {
    headers: { 'cache-control': 'no-cache' },
    timeout: 30000,
  });
  assert.equal(controllerResponse.status(), 200, 'controller asset is not HTTP 200');
  const controllerText = await controllerResponse.text();
  assert.ok(controllerText.includes(EXPECTED.engine), 'live controller does not reference expected engine revision');
  assert.ok(controllerText.includes('gb:vosk-switch-request'), 'live controller lacks switch-request recovery contract');
  assert.ok(controllerText.includes('Сейчас системный голос'), 'live controller lacks explicit browser voice status');

  const engineResponse = await page.request.get(`${ORIGIN}${EXPECTED.engine}`, {
    headers: { 'cache-control': 'no-cache' },
    timeout: 30000,
  });
  assert.equal(engineResponse.status(), 200, 'engine asset is not HTTP 200');
  const engineText = await engineResponse.text();
  assert.ok(engineText.includes(EXPECTED.noticeCss), 'live engine does not reference expected notice CSS revision');
  assert.ok(engineText.includes('Улучшенный голос загружается'), 'live engine lacks loading status copy');
  assert.ok(engineText.includes('Улучшенный голос не запустился'), 'live engine lacks recoverable error status copy');

  const cssResponse = await page.request.get(`${ORIGIN}${EXPECTED.noticeCss}`, {
    headers: { 'cache-control': 'no-cache' },
    timeout: 30000,
  });
  assert.equal(cssResponse.status(), 200, 'notice CSS asset is not HTTP 200');
  const cssText = await cssResponse.text();
  assert.ok(cssText.includes('.gb-tts-download-notice'), 'live notice CSS does not contain the status card contract');

  return {
    controllerSrc: new URL(controllerSrc, ORIGIN).toString(),
    engineSrc: `${ORIGIN}${EXPECTED.engine}`,
    cssSrc: `${ORIGIN}${EXPECTED.noticeCss}`,
  };
}

async function createScenario(browser, browserName, config) {
  const scenario = {
    label: config.label,
    browser: browserName,
    route: config.route,
    viewport: config.viewport,
    pageErrors: [],
    assetFailures: [],
    startedAt: new Date().toISOString(),
  };
  summary.scenarios.push(scenario);

  const context = await browser.newContext({
    viewport: config.viewport,
    isMobile: config.viewport.width <= 430,
    hasTouch: config.viewport.width <= 430,
    locale: 'ru-RU',
    colorScheme: config.colorScheme || 'light',
    serviceWorkers: config.serviceWorkers || 'block',
  });
  const page = await context.newPage();
  attachDiagnostics(page, scenario);
  await installHarness(page, config.harness || {});
  return { scenario, context, page };
}

async function finishScenario(scenario, context, page) {
  scenario.harness = await page.evaluate(() => window.__ttsProof || null).catch(() => null);
  scenario.finishedAt = new Date().toISOString();
  assert.deepEqual(scenario.pageErrors, [], `${scenario.label}: page errors: ${JSON.stringify(scenario.pageErrors)}`);
  assert.deepEqual(scenario.assetFailures, [], `${scenario.label}: asset failures: ${JSON.stringify(scenario.assetFailures)}`);
  await context.close();
}

async function loadingScenario(browser, browserName, config) {
  const { scenario, context, page } = await createScenario(browser, browserName, {
    ...config,
    harness: { modelMode: 'pending', engineMode: 'delay', engineDelayMs: 800 },
  });
  try {
    await gotoRoute(page, config.route, config.label);
    await resetStorage(page);
    if (config.verifyAssets) scenario.assets = await verifyLiveAssets(page);
    await clickPlay(page);

    await waitForState(page, 'browser', 5000);
    const browserState = await noticeSnapshot(page);
    assert.equal(browserState.title, 'Сейчас системный голос');
    assert.match(browserState.meta, /Улучшенный голос проверяется/);
    assertGeometry(browserState, { mobile: config.viewport.width <= 430 });

    await waitForState(page, 'loading', 90000);
    const loadingState = await noticeSnapshot(page);
    assert.equal(loadingState.title, 'Улучшенный голос загружается');
    assert.match(loadingState.meta, /Системный голос уже работает/);
    assert.equal(loadingState.action, 'Не загружать');
    assertGeometry(loadingState, { mobile: config.viewport.width <= 430 });

    const harness = await page.evaluate(() => window.__ttsProof);
    assert.ok(harness.webSpeechCount > 0, 'browser speech did not start immediately');
    assert.equal(harness.modelFetchCount, 1, 'cold model request did not start exactly once');
    assertExactAsset(harness.engineAttemptSrc, EXPECTED.engine, 'dynamic engine revision');
    const cssHref = await page.locator('link[data-gb-tts-download-notice]').getAttribute('href');
    assertExactAsset(cssHref, EXPECTED.noticeCss, 'dynamic notice CSS revision');

    await page.screenshot({ path: path.join(REPORTS, `${config.label}.png`), fullPage: false });
    const action = page.locator('.gb-tts-download-notice__action');
    if (config.keyboardCancel) {
      await action.focus();
      await page.keyboard.press('Enter');
    } else {
      await action.click();
    }
    await page.waitForFunction(() => window.__ttsProof.modelFetchAborted === true, null, { timeout: 10000 });
    await waitForState(page, 'cancelled', 5000);
    assert.equal(await page.evaluate(() => localStorage.getItem('gbx-vosk-warmup')), 'off');
    scenario.result = 'PASS';
  } finally {
    await finishScenario(scenario, context, page);
  }
}

async function blockedScenario(browser, browserName, config) {
  const { scenario, context, page } = await createScenario(browser, browserName, {
    ...config,
    harness: {
      saveData: config.kind === 'save-data',
      modelMode: 'pending',
      engineMode: 'delay',
      engineDelayMs: 250,
    },
  });
  try {
    await gotoRoute(page, config.route, config.label);
    await resetStorage(page, { optOut: config.kind === 'disabled' });
    await clickPlay(page);
    await waitForState(page, config.kind, 90000);

    const blocked = await noticeSnapshot(page);
    assert.equal(blocked.title, config.kind === 'disabled' ? 'Улучшенный голос отключён' : 'Включена экономия трафика');
    assert.equal(blocked.action, config.kind === 'disabled' ? 'Включить' : 'Загрузить');
    assertGeometry(blocked, { mobile: config.viewport.width <= 430 });
    assert.equal(await page.evaluate(() => window.__ttsProof.modelFetchCount), 0, 'blocked state fetched model before consent');

    await page.locator('.gb-tts-download-notice__action').click();
    await waitForState(page, 'loading', 90000);
    assert.equal(await page.evaluate(() => window.__ttsProof.modelFetchCount), 1, 'manual enable did not start model request');
    const harness = await page.evaluate(() => window.__ttsProof);
    assertExactAsset(harness.engineAttemptSrc, EXPECTED.engine, 'manual dynamic engine revision');
    await page.screenshot({ path: path.join(REPORTS, `${config.label}.png`), fullPage: false });
    await page.locator('.gb-tts-download-notice__action').click();
    await page.waitForFunction(() => window.__ttsProof.modelFetchAborted === true, null, { timeout: 10000 });
    scenario.result = 'PASS';
  } finally {
    await finishScenario(scenario, context, page);
  }
}

async function modelRetryScenario(browser) {
  const config = {
    label: 'chromium-model-network-retry',
    route: '/articles/dzhon-gill-chast-1-chelovek/',
    viewport: { width: 1440, height: 900 },
  };
  const { scenario, context, page } = await createScenario(browser, 'chromium', {
    ...config,
    harness: { modelMode: 'fail-first', engineMode: 'delay', engineDelayMs: 250 },
  });
  try {
    await gotoRoute(page, config.route, config.label);
    await resetStorage(page);
    await clickPlay(page);
    await waitForState(page, 'error', 90000);
    const errorState = await noticeSnapshot(page);
    assert.equal(errorState.title, 'Улучшенный голос не запустился');
    assert.equal(errorState.action, 'Повторить');
    assertGeometry(errorState);
    assert.equal(await page.evaluate(() => window.__ttsProof.modelFetchCount), 1);

    await page.locator('.gb-tts-download-notice__action').click();
    await waitForState(page, 'loading', 90000);
    assert.equal(await page.evaluate(() => window.__ttsProof.modelFetchCount), 2, 'retry did not issue a second model request');
    await page.screenshot({ path: path.join(REPORTS, `${config.label}.png`), fullPage: false });
    await page.locator('.gb-tts-download-notice__action').click();
    await page.waitForFunction(() => window.__ttsProof.modelFetchAborted === true, null, { timeout: 10000 });
    scenario.result = 'PASS';
  } finally {
    await finishScenario(scenario, context, page);
  }
}

async function engineRetryScenario(browser) {
  const config = {
    label: 'chromium-engine-script-retry',
    route: '/articles/dzhon-gill-chast-1-chelovek/',
    viewport: { width: 1280, height: 760 },
  };
  const { scenario, context, page } = await createScenario(browser, 'chromium', {
    ...config,
    harness: { modelMode: 'pending', engineMode: 'fail-first', engineDelayMs: 250 },
  });
  try {
    await gotoRoute(page, config.route, config.label);
    await resetStorage(page);
    await clickPlay(page);
    await waitForState(page, 'error', 15000);
    const errorState = await noticeSnapshot(page);
    assert.equal(errorState.action, 'Повторить');
    assert.equal(await page.evaluate(() => window.__ttsProof.engineAttemptCount), 1);

    await page.locator('.gb-tts-download-notice__action').click();
    await waitForState(page, 'loading', 90000);
    const harness = await page.evaluate(() => window.__ttsProof);
    assert.equal(harness.engineAttemptCount, 2, 'engine retry did not create a second script attempt');
    assert.equal(harness.modelFetchCount, 1, 'engine retry did not reach the model fetch');
    assertExactAsset(harness.engineAttemptSrc, EXPECTED.engine, 'retried engine revision');
    await page.screenshot({ path: path.join(REPORTS, `${config.label}.png`), fullPage: false });
    await page.locator('.gb-tts-download-notice__action').click();
    await page.waitForFunction(() => window.__ttsProof.modelFetchAborted === true, null, { timeout: 10000 });
    scenario.result = 'PASS';
  } finally {
    await finishScenario(scenario, context, page);
  }
}

async function serviceWorkerScenario(browser) {
  const config = {
    label: 'chromium-service-worker-reload',
    route: '/articles/dzhon-gill-chast-1-chelovek/',
    viewport: { width: 1366, height: 768 },
  };
  const { scenario, context, page } = await createScenario(browser, 'chromium', {
    ...config,
    serviceWorkers: 'allow',
    harness: { modelMode: 'pending', engineMode: 'delay', engineDelayMs: 500 },
  });
  try {
    await gotoRoute(page, config.route, config.label);
    const registration = await page.evaluate(async () => {
      assertServiceWorkerSupport();
      const ready = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('service worker ready timeout')), 15000)),
      ]);
      return { scope: ready.scope, scriptURL: ready.active && ready.active.scriptURL || '' };
      function assertServiceWorkerSupport() {
        if (!('serviceWorker' in navigator)) throw new Error('serviceWorker API unavailable');
      }
    });
    scenario.serviceWorker = registration;
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
    await resetStorage(page);
    scenario.assets = await verifyLiveAssets(page);
    await clickPlay(page);
    await waitForState(page, 'loading', 90000);
    const loading = await noticeSnapshot(page);
    assertGeometry(loading);
    await page.screenshot({ path: path.join(REPORTS, `${config.label}.png`), fullPage: false });
    await page.locator('.gb-tts-download-notice__action').click();
    await page.waitForFunction(() => window.__ttsProof.modelFetchAborted === true, null, { timeout: 10000 });
    scenario.result = 'PASS';
  } finally {
    await finishScenario(scenario, context, page);
  }
}

let chromiumBrowser;
let webkitBrowser;
try {
  chromiumBrowser = await chromium.launch({ headless: true });
  webkitBrowser = await webkit.launch({ headless: true });

  await loadingScenario(chromiumBrowser, 'chromium', {
    label: 'chromium-gill-desktop-loading',
    route: '/articles/dzhon-gill-chast-1-chelovek/',
    viewport: { width: 1440, height: 900 },
    verifyAssets: true,
    keyboardCancel: true,
  });
  await loadingScenario(chromiumBrowser, 'chromium', {
    label: 'chromium-standalone-mobile320-loading',
    route: '/articles/20-antisovetov-pastoru/',
    viewport: { width: 320, height: 568 },
    colorScheme: 'dark',
  });
  await loadingScenario(webkitBrowser, 'webkit', {
    label: 'webkit-gill-mobile390-loading',
    route: '/articles/dzhon-gill-chast-1-chelovek/',
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
  });
  await blockedScenario(chromiumBrowser, 'chromium', {
    label: 'chromium-optout-enable',
    route: '/articles/dzhon-gill-chast-1-chelovek/',
    viewport: { width: 1280, height: 760 },
    kind: 'disabled',
  });
  await blockedScenario(webkitBrowser, 'webkit', {
    label: 'webkit-save-data-manual',
    route: '/articles/dzhon-gill-chast-1-chelovek/',
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
    kind: 'save-data',
  });
  await modelRetryScenario(chromiumBrowser);
  await engineRetryScenario(chromiumBrowser);
  await serviceWorkerScenario(chromiumBrowser);

  summary.result = 'PASS';
  summary.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(REPORTS, 'tts-production-proof.json'), JSON.stringify(summary, null, 2));
  console.log(`TTS production proof: PASS (${summary.scenarios.length} live scenarios, main ${EXPECTED_MAIN}).`);
} catch (error) {
  summary.result = 'FAIL';
  summary.finishedAt = new Date().toISOString();
  summary.error = String(error && error.stack || error);
  fs.writeFileSync(path.join(REPORTS, 'tts-production-proof.json'), JSON.stringify(summary, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  await Promise.allSettled([
    chromiumBrowser ? chromiumBrowser.close() : Promise.resolve(),
    webkitBrowser ? webkitBrowser.close() : Promise.resolve(),
  ]);
}
