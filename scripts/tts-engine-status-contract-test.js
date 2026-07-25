#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function validate(engine, controller, css, workflow) {
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
    ['browser status preserved during automatic warm-up', controller, /showVoskStatus\('browser'\);\s*warmVoskInBackground\(\{ preserveBrowserStatus: true \}\)/],
    ['warm-up supports status preservation', controller, /preserveBrowserStatus\s*=\s*options\.preserveBrowserStatus === true[\s\S]{0,360}if \(!preserveBrowserStatus\) showVoskStatus\('preparing'\)/],
    ['mobile two-row reflow', css, /@media \(max-width:480px\)[\s\S]*grid-template-columns:30px minmax\(0,1fr\)[\s\S]*grid-column:2/],
    ['copy can wrap', css, /gb-tts-download-notice__title[\s\S]{0,260}white-space:normal[\s\S]*gb-tts-download-notice__meta[\s\S]{0,260}white-space:normal/],
    ['workflow owns controller', workflow, /js\/floating-cluster-controller\.js/],
    ['workflow runs lifecycle browser test', workflow, /tts-engine-lifecycle-browser-test\.js/],
    ['workflow runs route integration', workflow, /tts-status-route-browser-test\.js/],
    ['workflow installs WebKit', workflow, /playwright install --with-deps chromium webkit/],
  ];
  for (const [label, source, pattern] of checks) {
    if (!pattern.test(source)) problems.push(label);
  }
  if (/_voskWarmupStarted/.test(controller)) problems.push('obsolete one-shot warm-up latch remains');
  if (/s\.src\s*=\s*'\/js\/vosk-tts-engine\.js'/.test(controller)) problems.push('unversioned lazy engine URL remains');
  return problems;
}

const engine = read('js/vosk-tts-engine.js');
const controller = read('js/floating-cluster-controller.js');
const css = read('css/tts-download-notice.css');
const workflow = read('.github/workflows/tts-download-consent.yml');
assert.deepEqual(validate(engine, controller, css, workflow), []);

const mutations = [
  [engine.replace('retryLoading: retryLoading', 'retryLoading: null'), controller, css, workflow],
  [engine, controller.replace(/vosk-tts-engine\.js\?v=[a-f0-9]{8}/, 'vosk-tts-engine.js'), css, workflow],
  [engine, controller.replace(/gb:vosk-retry-request/g, 'gb:vosk-retry-missing'), css, workflow],
  [engine, controller.replace('preserveBrowserStatus: true', 'preserveBrowserStatus: false'), css, workflow],
  [engine, controller, css.replace('white-space:normal', 'white-space:nowrap'), workflow],
  [engine, controller, css, workflow.replace('chromium webkit', 'chromium')],
];
for (const mutation of mutations) {
  assert.ok(validate(...mutation).length > 0, 'adversarial mutation must be rejected');
}
console.log('TTS engine status contract: PASS (' + mutations.length + ' adversarial mutations rejected).');
