#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function validate(engine, controller, css, workflow, cacheAssets) {
  const problems = [];
  const checks = [
    ['engine status API', engine, /getStatus:\s*getStatus[\s\S]{0,180}showStatus:\s*showStatus/],
    ['engine retry API', engine, /retryLoading:\s*retryLoading/],
    ['engine post-session ready', engine, /InferenceSession\.create[\s\S]*state\.ready\s*=\s*true[\s\S]*finishModelDownloadNotice\('ready'\)/],
    ['engine cache read fallback', engine, /IndexedDB read unavailable, continuing without warm cache/],
    ['engine cache write fallback', engine, /current session can still use the model/],
    ['all visible states', engine, /'browser'[\s\S]*'preparing'[\s\S]*'loading'[\s\S]*'initializing'[\s\S]*'ready'[\s\S]*'selected'[\s\S]*'disabled'[\s\S]*'save-data'[\s\S]*'cancelled'/],
    ['versioned engine lazy URL', controller, /VOSK_ENGINE_SRC\s*=\s*'\/js\/vosk-tts-engine\.js\?v=[a-f0-9]{8}'/],
    ['versioned notice CSS URL', controller, /TTS_NOTICE_CSS_SRC\s*=\s*'\/css\/tts-download-notice\.css\?v=[a-f0-9]{8}'/],
    ['retry event contract', controller, /gb:vosk-retry-request[\s\S]*warmVoskInBackground\(\{ manual: true, retry: true \}\)/],
    ['switch event contract', controller, /gb:vosk-switch-request[\s\S]*switchCurrentSessionToVosk/],
    ['retryable promise, no one-shot latch', controller, /var _voskWarmupPromise = null/],
    ['system voice disclosed', controller, /showVoskStatus\('browser'\)/],
    ['controller first status reveal is synchronous', controller, /function showFallbackTtsStatus\([\s\S]{0,5000}el\.classList\.add\('is-visible'\);[\s\S]{0,700}return el;/],
    ['engine first status reveal is synchronous', engine, /function showStatus\([\s\S]{0,5000}setNoticeAction\(el, actionMode, actionLabel, actionAria\);[\s\S]{0,700}el\.classList\.add\('is-visible'\);[\s\S]{0,700}dispatchEngineStatus/],
    ['browser status preserved during automatic warm-up', controller, /showVoskStatus\('browser'\);\s*warmVoskInBackground\(\{ preserveBrowserStatus: true \}\)/],
    ['warm-up supports status preservation', controller, /preserveBrowserStatus\s*=\s*options\.preserveBrowserStatus === true[\s\S]{0,360}if \(!preserveBrowserStatus\) showVoskStatus\('preparing'\)/],
    ['mobile two-row reflow', css, /@media \(max-width:480px\)[\s\S]*grid-template-columns:30px minmax\(0,1fr\)[\s\S]*grid-column:2/],
    ['mobile viewport anchoring', css, /@media \(max-width:480px\)[\s\S]*left:max\(10px,env\(safe-area-inset-left,0px\)\)[\s\S]*right:max\(10px,env\(safe-area-inset-right,0px\)\)[\s\S]*width:auto[\s\S]*translateY\(14px\)[\s\S]*is-visible\{transform:translateY\(0\) scale\(1\)\}/],
    ['copy can wrap', css, /gb-tts-download-notice__title[\s\S]{0,260}white-space:normal[\s\S]*gb-tts-download-notice__meta[\s\S]{0,260}white-space:normal/],
    ['workflow owns controller', workflow, /js\/floating-cluster-controller\.js/],
    ['workflow runs lifecycle browser test', workflow, /tts-engine-lifecycle-browser-test\.js/],
    ['workflow runs route integration', workflow, /tts-status-route-browser-test\.js/],
    ['workflow executes mobile geometry gate', workflow, /- name:\s*Run mobile notice viewport geometry[\s\S]{0,220}run:\s*\|[\s\S]{0,220}node scripts\/tts-mobile-notice-geometry-browser-test\.js/],
    ['workflow installs WebKit', workflow, /playwright install --with-deps chromium webkit/],
    ['cache registry owns notice CSS', cacheAssets, /const ASSETS = \[[\s\S]*'css\/tts-download-notice\.css'[\s\S]*?\];/],
    ['cache registry owns Vosk engine', cacheAssets, /const ASSETS = \[[\s\S]*'js\/vosk-tts-engine\.js'[\s\S]*?\];/],
    ['cache policy exports lazy no-precache set', cacheAssets, /const LAZY_NO_PRECACHE = Object\.freeze\(\[[\s\S]*?\]\);[\s\S]*module\.exports = \{ ASSETS, LAZY_NO_PRECACHE \}/],
    ['notice CSS remains lazy', cacheAssets, /const LAZY_NO_PRECACHE = Object\.freeze\(\[[\s\S]*'css\/tts-download-notice\.css'[\s\S]*?\]\);/],
    ['Vosk engine remains lazy', cacheAssets, /const LAZY_NO_PRECACHE = Object\.freeze\(\[[\s\S]*'js\/vosk-tts-engine\.js'[\s\S]*?\]\);/],
  ];
  for (const [label, source, pattern] of checks) {
    if (!pattern.test(source)) problems.push(label);
  }
  const noticeRevision = crypto.createHash('md5').update(css).digest('hex').slice(0, 8);
  const engineRevision = crypto.createHash('md5').update(engine).digest('hex').slice(0, 8);
  if (!engine.includes('/css/tts-download-notice.css?v=' + noticeRevision)) {
    problems.push('engine notice CSS revision drift');
  }
  if (!controller.includes('/css/tts-download-notice.css?v=' + noticeRevision)) {
    problems.push('controller notice CSS revision drift');
  }
  if (!controller.includes('/js/vosk-tts-engine.js?v=' + engineRevision)) {
    problems.push('controller Vosk engine revision drift');
  }
  if (/_voskWarmupStarted/.test(controller)) problems.push('obsolete one-shot warm-up latch remains');
  if (/s\.src\s*=\s*'\/js\/vosk-tts-engine\.js'/.test(controller)) problems.push('unversioned lazy engine URL remains');
  const deferredReveal = /requestAnimationFrame\(function \(\) \{ el\.classList\.add\('is-visible'\); \}\);/;
  if (deferredReveal.test(controller)) problems.push('controller first status reveal still depends on RAF');
  if (deferredReveal.test(engine)) problems.push('engine first status reveal still depends on RAF');
  return problems;
}

const engine = read('js/vosk-tts-engine.js');
const controller = read('js/floating-cluster-controller.js');
const css = read('css/tts-download-notice.css');
const workflow = read('.github/workflows/tts-download-consent.yml');
const cacheAssets = read('scripts/cache-bust-assets.js');
const distPublicationAudit = read('scripts/dist-publication-audit.js');
assert.deepEqual(validate(engine, controller, css, workflow, cacheAssets), []);

function validateDistPublicationAudit(source) {
  const problems = [];
  if (!/const \{ ASSETS, LAZY_NO_PRECACHE \} = require\('.\/cache-bust-assets'\);/.test(source)) {
    problems.push('dist publication audit does not import canonical lazy policy');
  }
  if (!/const lazyNoPrecache = new Set\(LAZY_NO_PRECACHE\);/.test(source)) {
    problems.push('dist publication audit does not consume canonical lazy policy');
  }
  if (/const LAZY_NO_PRECACHE = new Set\(\[/.test(source)) {
    problems.push('dist publication audit keeps a divergent local lazy list');
  }
  return problems;
}

assert.deepEqual(validateDistPublicationAudit(distPublicationAudit), []);
for (const [name, mutation] of [
  ['dist audit lazy export removed', distPublicationAudit.replace('{ ASSETS, LAZY_NO_PRECACHE }', '{ ASSETS }')],
  ['dist audit canonical lazy set bypassed', distPublicationAudit.replace('new Set(LAZY_NO_PRECACHE)', 'new Set([])')],
]) {
  assert.ok(validateDistPublicationAudit(mutation).length > 0, `${name}: mutation must be rejected`);
}

const mutations = [
  ['retry API removed', engine.replace('retryLoading: retryLoading', 'retryLoading: null'), controller, css, workflow, cacheAssets],
  ['engine URL unversioned', engine, controller.replace(/vosk-tts-engine\.js\?v=[a-f0-9]{8}/, 'vosk-tts-engine.js'), css, workflow, cacheAssets],
  ['retry event removed', engine, controller.replace(/gb:vosk-retry-request/g, 'gb:vosk-retry-missing'), css, workflow, cacheAssets],
  ['browser status preservation removed', engine, controller.replace('preserveBrowserStatus: true', 'preserveBrowserStatus: false'), css, workflow, cacheAssets],
  ['controller synchronous reveal deferred', engine, controller.replace("el.classList.add('is-visible');", "requestAnimationFrame(function () { el.classList.add('is-visible'); });"), css, workflow, cacheAssets],
  ['engine synchronous reveal deferred', engine.replace("el.classList.add('is-visible');", "requestAnimationFrame(function () { el.classList.add('is-visible'); });"), controller, css, workflow, cacheAssets],
  ['notice copy forced nowrap', engine, controller, css.replace('white-space:normal', 'white-space:nowrap'), workflow, cacheAssets],
  ['mobile right inset removed', engine, controller, css.replace('right:max(10px,env(safe-area-inset-right,0px));', 'right:auto;'), workflow, cacheAssets],
  ['engine CSS revision corrupted', engine.replace(/DOWNLOAD_NOTICE_CSS_URL = '\/css\/tts-download-notice\.css\?v=[a-f0-9]{8}'/, "DOWNLOAD_NOTICE_CSS_URL = '/css/tts-download-notice.css?v=00000000'"), controller, css, workflow, cacheAssets],
  ['controller CSS revision corrupted', engine, controller.replace(/TTS_NOTICE_CSS_SRC = '\/css\/tts-download-notice\.css\?v=[a-f0-9]{8}'/, "TTS_NOTICE_CSS_SRC = '/css/tts-download-notice.css?v=00000000'"), css, workflow, cacheAssets],
  ['controller engine revision corrupted', engine, controller.replace(/VOSK_ENGINE_SRC = '\/js\/vosk-tts-engine\.js\?v=[a-f0-9]{8}'/, "VOSK_ENGINE_SRC = '/js/vosk-tts-engine.js?v=00000000'"), css, workflow, cacheAssets],
  ['WebKit install removed', engine, controller, css, workflow.replace('chromium webkit', 'chromium'), cacheAssets],
  ['mobile geometry execution removed', engine, controller, css, workflow.replace(/\n\s*- name: Run mobile notice viewport geometry[\s\S]*?node scripts\/tts-mobile-notice-geometry-browser-test\.js[^\n]*\n/, '\n'), cacheAssets],
  ['notice CSS cache registry entry removed', engine, controller, css, workflow, cacheAssets.replace(/(const ASSETS = \[[\s\S]*?)  'css\/tts-download-notice\.css',\n/, '$1')],
  ['Vosk engine cache registry entry removed', engine, controller, css, workflow, cacheAssets.replace(/(const ASSETS = \[[\s\S]*?)  'js\/vosk-tts-engine\.js',\n/, '$1')],
  ['notice CSS lazy policy entry removed', engine, controller, css, workflow, cacheAssets.replace(/(const LAZY_NO_PRECACHE = Object\.freeze\(\[[\s\S]*?)  'css\/tts-download-notice\.css',\n/, '$1')],
  ['Vosk engine lazy policy entry removed', engine, controller, css, workflow, cacheAssets.replace(/(const LAZY_NO_PRECACHE = Object\.freeze\(\[[\s\S]*?)  'js\/vosk-tts-engine\.js',\n/, '$1')],
];
for (const [name, ...mutation] of mutations) {
  const problems = validate(...mutation);
  assert.ok(problems.length > 0, `${name}: mutation must be rejected`);
}
console.log('TTS engine status contract: PASS (' + mutations.length + ' named adversarial mutations rejected).');
