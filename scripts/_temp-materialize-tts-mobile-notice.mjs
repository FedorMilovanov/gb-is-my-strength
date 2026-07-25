#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const BASE_SHA = '8a26fd7ea45a7124217f779f78def8fd0f17a0aa';

function revision(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 8);
}

function replaceOnce(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(oldText, newText);
}

function insertAfterUniqueLine(source, marker, line, label) {
  const lines = source.split('\n');
  const matches = lines.map((value, index) => value.includes(marker) ? index : -1).filter((index) => index >= 0);
  if (matches.length !== 1) throw new Error(`${label}: expected one marker line, found ${matches.length}`);
  lines.splice(matches[0] + 1, 0, line);
  return lines.join('\n');
}

const cssPath = 'css/tts-download-notice.css';
const baseCss = execFileSync('git', ['show', `${BASE_SHA}:${cssPath}`], { encoding: 'utf8' });
if (revision(baseCss) !== '1cdbee44') {
  throw new Error(`baseline notice CSS revision mismatch: ${revision(baseCss)}`);
}

const oldMobileBlock = `  .gb-tts-download-notice{
    width:calc(100vw - 20px);
    grid-template-columns:30px minmax(0,1fr);
    gap:8px 10px;
    padding:10px;
    border-radius:14px;
  }`;
const newMobileBlock = `  .gb-tts-download-notice{
    left:max(10px,env(safe-area-inset-left,0px));
    right:max(10px,env(safe-area-inset-right,0px));
    width:auto;
    grid-template-columns:30px minmax(0,1fr);
    gap:8px 10px;
    padding:10px;
    border-radius:14px;
    transform:translateY(14px) scale(.985);
    transform-origin:center bottom;
  }
  .gb-tts-download-notice.is-visible{transform:translateY(0) scale(1)}`;

let css = fs.readFileSync(cssPath, 'utf8');
if (css.includes(oldMobileBlock)) css = replaceOnce(css, oldMobileBlock, newMobileBlock, 'mobile notice viewport anchoring');
if (!css.includes(newMobileBlock)) throw new Error('mobile notice viewport block missing after materialization');
fs.writeFileSync(cssPath, css);
const noticeRevision = revision(css);
if (noticeRevision === '1cdbee44') throw new Error('notice CSS revision did not change');

const controllerPath = 'js/floating-cluster-controller.js';
let controller = fs.readFileSync(controllerPath, 'utf8');
const controllerLine = /var TTS_NOTICE_CSS_SRC = '\/css\/tts-download-notice\.css\?v=[a-f0-9]{8}';/g;
const controllerMatches = controller.match(controllerLine) || [];
if (controllerMatches.length !== 1) throw new Error(`notice CSS controller URL: expected one match, found ${controllerMatches.length}`);
controller = controller.replace(controllerLine, `var TTS_NOTICE_CSS_SRC = '/css/tts-download-notice.css?v=${noticeRevision}';`);
fs.writeFileSync(controllerPath, controller);

const contractPath = 'scripts/tts-engine-status-contract-test.js';
let contract = fs.readFileSync(contractPath, 'utf8');
if (!contract.includes("const crypto = require('node:crypto');")) {
  contract = insertAfterUniqueLine(contract, "const assert = require('node:assert/strict');", "const crypto = require('node:crypto');", 'contract crypto import');
}
if (!contract.includes("['mobile viewport anchoring', css,")) {
  contract = insertAfterUniqueLine(
    contract,
    "['mobile two-row reflow', css,",
    String.raw`    ['mobile viewport anchoring', css, /@media \(max-width:480px\)[\s\S]*left:max\(10px,env\(safe-area-inset-left,0px\)\)[\s\S]*right:max\(10px,env\(safe-area-inset-right,0px\)\)[\s\S]*width:auto[\s\S]*translateY\(14px\)[\s\S]*is-visible\{transform:translateY\(0\) scale\(1\)\}/],`,
    'mobile source contract'
  );
}
if (!contract.includes('notice CSS revision matches source')) {
  contract = replaceOnce(contract,
`  for (const [label, source, pattern] of checks) {
    if (!pattern.test(source)) problems.push(label);
  }`,
`  for (const [label, source, pattern] of checks) {
    if (!pattern.test(source)) problems.push(label);
  }
  const noticeRevision = crypto.createHash('sha256').update(css).digest('hex').slice(0, 8);
  if (!controller.includes('/css/tts-download-notice.css?v=' + noticeRevision)) {
    problems.push('notice CSS revision matches source');
  }`,
'notice revision source contract');
}
if (!contract.includes("css.replace('right:max(10px,env(safe-area-inset-right,0px));', 'right:auto;')")) {
  contract = replaceOnce(contract,
`  [engine, controller, css.replace('white-space:normal', 'white-space:nowrap'), workflow],`,
`  [engine, controller, css.replace('white-space:normal', 'white-space:nowrap'), workflow],
  [engine, controller, css.replace('right:max(10px,env(safe-area-inset-right,0px));', 'right:auto;'), workflow],`,
'mobile adversarial contract');
}
fs.writeFileSync(contractPath, contract);

const geometryPath = 'scripts/tts-mobile-notice-geometry-browser-test.js';
fs.writeFileSync(geometryPath, `#!/usr/bin/env node
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
`);

const workflowPath = '.github/workflows/tts-download-consent.yml';
let workflow = fs.readFileSync(workflowPath, 'utf8');
if (!workflow.includes('Run mobile notice viewport geometry')) {
  workflow = replaceOnce(workflow,
`      - name: Run real-route status matrix
        run: |
          set -o pipefail
          node scripts/tts-status-route-browser-test.js 2>&1 | tee reports/tts-route-status.log

      - name: Upload interaction evidence`,
`      - name: Run real-route status matrix
        run: |
          set -o pipefail
          node scripts/tts-status-route-browser-test.js 2>&1 | tee reports/tts-route-status.log

      - name: Run mobile notice viewport geometry
        run: node scripts/tts-mobile-notice-geometry-browser-test.js

      - name: Upload interaction evidence`,
'workflow geometry gate');
}
fs.writeFileSync(workflowPath, workflow);

for (const file of [controllerPath, contractPath, geometryPath]) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
execFileSync(process.execPath, [contractPath], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js', '--write'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js'], { stdio: 'inherit' });
console.log(JSON.stringify({ css: cssPath, cssRevision: noticeRevision, controller: controllerPath, contract: contractPath, geometry: geometryPath, workflow: workflowPath }, null, 2));
