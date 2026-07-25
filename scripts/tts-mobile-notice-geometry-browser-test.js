#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require('playwright');
const css = fs.readFileSync(path.resolve(__dirname, '../css/tts-download-notice.css'), 'utf8');

async function verify(browserType, viewport, transformed) {
  const browser = await browserType.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport, isMobile: true, hasTouch: true });
    await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body><main></main></body></html>');
    assert.equal(await page.evaluate(() => matchMedia('(max-width:480px)').matches), true, 'mobile media query is not active');
    await page.addStyleTag({ content: css });
    await page.evaluate((useTransform) => {
      if (useTransform) {
        document.body.style.width = '253px';
        document.body.style.minHeight = '100vh';
        document.body.style.transform = 'translateZ(0)';
      }
      const el = document.createElement('div');
      el.className = 'gb-tts-download-notice is-visible';
      el.setAttribute('data-state', 'browser');
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-atomic', 'true');
      el.innerHTML = '<span class="gb-tts-download-notice__icon"></span><span class="gb-tts-download-notice__copy"><strong class="gb-tts-download-notice__title">Сейчас системный голос</strong><span class="gb-tts-download-notice__meta">Улучшенный голос проверяется в фоне</span></span><button class="gb-tts-download-notice__action" hidden></button>';
      document.body.appendChild(el);
    }, transformed);
    await page.waitForTimeout(400);
    const snapshot = await page.locator('.gb-tts-download-notice').evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight, cssLeft: style.left, cssRight: style.right, transform: style.transform, scrollWidth: document.documentElement.scrollWidth };
    });
    assert.ok(snapshot.left >= -0.5, JSON.stringify(snapshot));
    assert.ok(snapshot.right <= snapshot.width + 0.5, JSON.stringify(snapshot));
    assert.ok(snapshot.top >= -0.5 && snapshot.bottom <= snapshot.height + 0.5, JSON.stringify(snapshot));
    assert.ok(snapshot.scrollWidth <= snapshot.width, JSON.stringify(snapshot));
    return snapshot;
  } finally { await browser.close(); }
}

(async () => {
  for (const [name, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
    for (const width of [320, 390]) {
      for (const transformed of [false, true]) {
        const result = await verify(browserType, { width, height: width === 320 ? 568 : 844 }, transformed);
        console.log('[tts-mobile-geometry]', name, width, transformed ? 'transformed' : 'viewport', JSON.stringify(result));
      }
    }
  }
  console.log('TTS mobile notice geometry: PASS (Chromium/WebKit, 320/390, viewport/transformed containing block).');
})().catch((error) => { console.error(error); process.exit(1); });
