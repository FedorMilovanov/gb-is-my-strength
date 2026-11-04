#!/usr/bin/env node
'use strict';

// Exercise the actual visible article share trigger in Chromium/WebKit.
// Only platform APIs are mocked: the reader action handler and DOM are real.
// The legacy throw case is a red witness on Product main before its cleanup fix.
const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');

const BASE = String(process.env.AUDIT_BASE || 'https://gospod-bog.ru').replace(/\/$/, '');
const ARTICLE = '/articles/dzhon-gill-chast-1-chelovek/';
const BROWSERS = String(process.env.GB_SHARE_BROWSERS || 'chromium,webkit').split(',').map(x => x.trim()).filter(Boolean);
const VIEWPORTS = [
  { label: 'desktop', width: 1280, height: 900 },
  { label: 'mobile', width: 390, height: 850 },
];
const CASES = [
  { api: 'webShare', outcome: 'success', status: 'shared' },
  { api: 'webShare', outcome: 'cancel', status: null },
  { api: 'webShare', outcome: 'reject', status: 'failed' },
  { api: 'clipboard', outcome: 'success', status: 'copied' },
  { api: 'clipboard', outcome: 'reject', status: 'failed' },
  { api: 'legacy', outcome: 'true', status: 'copied' },
  { api: 'legacy', outcome: 'false', status: 'failed' },
  { api: 'legacy', outcome: 'throw', status: 'failed' },
  { api: 'legacy', outcome: 'selectThrow', status: 'failed' },
];

async function installPlatformOutcomes(page, test) {
  await page.evaluate(({ api, outcome }) => {
    window.__gbShareOutcomeCalls = [];
    if (window.SiteUtils && typeof window.SiteUtils.copyText === 'function') {
      // The native reader must use its own documented fallback owner here.
      // A newly introduced shared copy delegate belongs in a separate test.
      throw new Error('Unexpected SiteUtils.copyText delegate on Gill article');
    }
    const fault = (kind) => {
      const error = new Error('share browser contract: ' + kind);
      if (kind === 'cancel') error.name = 'AbortError';
      throw error;
    };
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    if (api === 'webShare') {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async payload => {
          window.__gbShareOutcomeCalls.push({ api: 'webShare', value: payload?.url });
          if (outcome === 'cancel' || outcome === 'reject') fault(outcome);
        },
      });
    } else if (api === 'clipboard') {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async value => {
            window.__gbShareOutcomeCalls.push({ api: 'clipboard', value });
            if (outcome === 'reject') fault(outcome);
          },
        },
      });
    } else if (api === 'legacy') {
      document.execCommand = (command) => {
        window.__gbShareOutcomeCalls.push({ api: 'legacy', value: command });
        if (outcome === 'throw') fault(outcome);
        return outcome === 'true';
      };
      if (outcome === 'selectThrow') {
        HTMLTextAreaElement.prototype.select = () => fault('select');
      }
    } else {
      throw new Error('Unsupported platform outcome mode: ' + api);
    }
  }, test);
}

async function checkOne(browser, browserName, viewport, test) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  const identifier = [browserName, viewport.label, test.api, test.outcome].join('/');
  try {
    const response = await page.goto(BASE + ARTICLE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    assert.equal(response?.status(), 200, identifier + ': article HTTP');
    await page.waitForFunction(() => window.GBReaderActions?.version === 1, null, { timeout: 18000 });
    const button = page.locator('button.gb-icon[data-action="share"]:visible').first();
    await button.waitFor({ state: 'visible', timeout: 12000 });
    const baseline = await page.locator('textarea').count();
    await installPlatformOutcomes(page, test);
    await button.click({ timeout: 8000 });

    if (test.status) {
      await page.waitForFunction(
        expected => document.querySelector('button.gb-icon[data-action="share"]')?.dataset.shareStatus === expected,
        test.status, { timeout: 6000 },
      );
    } else {
      // AbortError deliberately leaves the trigger unchanged: no false failure
      // or false success feedback. The abort is resolved asynchronously.
      await page.waitForTimeout(160);
    }
    const status = await button.getAttribute('data-share-status');
    assert.equal(status, test.status, identifier + ': truthful status');

    const remaining = await page.locator('textarea').count();
    assert.equal(remaining, baseline, identifier + ': no leaked temporary textarea');

    const calls = await page.evaluate(() => window.__gbShareOutcomeCalls);
    const expectedCalls = test.outcome === 'selectThrow' ? 0 : 1;
    assert.equal(calls.length, expectedCalls, identifier + ': platform call count');
    if (calls.length && test.api === 'legacy') {
      assert.equal(calls[0].value, 'copy', identifier + ': legacy command');
    } else if (calls.length) {
      assert.equal(calls[0].value, page.url(), identifier + ': supplied URL');
    }

    if (test.status === 'copied' || test.status === 'failed') {
      const toast = page.locator('.gb-fc-toast span').first();
      await toast.waitFor({ state: 'attached', timeout: 3000 });
      const message = (await toast.textContent()) || '';
      if (test.status === 'copied') assert.equal(message.trim(), 'Ссылка скопирована', identifier + ': copy success copy');
      else assert.match(message, /Не удалось/, identifier + ': failure feedback');
    } else {
      const toast = await page.locator('.gb-fc-toast.is-open').count();
      assert.equal(toast, 0, identifier + ': no false toast on native share/cancel');
    }
    console.log('PASS ' + identifier + ' status=' + (status || 'unset'));
    return { identifier, status, pass: true };
  } catch (error) {
    console.error('FAIL ' + identifier + ': ' + String(error.message).slice(0, 800));
    return { identifier, pass: false, reason: String(error.message).slice(0, 800) };
  } finally {
    await page.close();
  }
}

(async () => {
  const results = [];
  for (const name of BROWSERS) {
    const engine = { chromium, webkit }[name];
    if (!engine) throw new Error('Unsupported browser: ' + name);
    const browser = await engine.launch({ headless: true });
    try {
      for (const viewport of VIEWPORTS) {
        for (const test of CASES) {
          results.push(await checkOne(browser, name, viewport, test));
        }
      }
    } finally {
      await browser.close();
    }
  }
  const passed = results.filter(result => result.pass).length;
  console.log('Reader share browser outcome contract: ' + passed + '/' + results.length + ' PASS');
  if (passed !== results.length) {
    console.error('Failing cases: ' + JSON.stringify(results.filter(result => !result.pass)));
    process.exitCode = 1;
  }
})().catch(error => {
  console.error('Reader share browser contract setup failed', error);
  process.exitCode = 1;
});
