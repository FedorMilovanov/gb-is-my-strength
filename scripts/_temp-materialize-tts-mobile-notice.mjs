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

function replaceRegexOnce(source, pattern, replacement, label) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const globalPattern = new RegExp(pattern.source, flags);
  const matches = source.match(globalPattern) || [];
  if (matches.length !== 1) throw new Error(`${label}: expected one match, found ${matches.length}`);
  return source.replace(pattern, replacement);
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

const enginePath = 'js/vosk-tts-engine.js';
let engine = fs.readFileSync(enginePath, 'utf8');
engine = replaceRegexOnce(
  engine,
  /var DOWNLOAD_NOTICE_CSS_URL = '\/css\/tts-download-notice\.css\?v=[a-f0-9]{8}';/,
  `var DOWNLOAD_NOTICE_CSS_URL = '/css/tts-download-notice.css?v=${noticeRevision}';`,
  'engine notice CSS URL'
);
fs.writeFileSync(enginePath, engine);
const engineRevision = revision(engine);

const controllerPath = 'js/floating-cluster-controller.js';
let controller = fs.readFileSync(controllerPath, 'utf8');
controller = replaceRegexOnce(
  controller,
  /var TTS_NOTICE_CSS_SRC = '\/css\/tts-download-notice\.css\?v=[a-f0-9]{8}';/,
  `var TTS_NOTICE_CSS_SRC = '/css/tts-download-notice.css?v=${noticeRevision}';`,
  'controller notice CSS URL'
);
controller = replaceRegexOnce(
  controller,
  /var VOSK_ENGINE_SRC = '\/js\/vosk-tts-engine\.js\?v=[a-f0-9]{8}';/,
  `var VOSK_ENGINE_SRC = '/js/vosk-tts-engine.js?v=${engineRevision}';`,
  'controller engine URL'
);
fs.writeFileSync(controllerPath, controller);

const cacheAssetsPath = 'scripts/cache-bust-assets.js';
let cacheAssets = fs.readFileSync(cacheAssetsPath, 'utf8');
if (!cacheAssets.includes("  'css/tts-download-notice.css',")) {
  cacheAssets = replaceOnce(
    cacheAssets,
    "  'css/site.css',\n",
    "  'css/site.css',\n  'css/tts-download-notice.css',\n",
    'register notice CSS in cache-bust assets'
  );
}
if (!cacheAssets.includes("  'js/vosk-tts-engine.js',")) {
  cacheAssets = replaceOnce(
    cacheAssets,
    "  'js/floating-cluster-controller.js',\n",
    "  'js/vosk-tts-engine.js',\n  'js/floating-cluster-controller.js',\n",
    'register Vosk engine in cache-bust assets'
  );
}
fs.writeFileSync(cacheAssetsPath, cacheAssets);

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
if (!contract.includes('engine notice CSS revision drift')) {
  contract = replaceOnce(contract,
`  for (const [label, source, pattern] of checks) {
    if (!pattern.test(source)) problems.push(label);
  }`,
`  for (const [label, source, pattern] of checks) {
    if (!pattern.test(source)) problems.push(label);
  }
  const noticeRevision = crypto.createHash('sha256').update(css).digest('hex').slice(0, 8);
  const engineRevision = crypto.createHash('sha256').update(engine).digest('hex').slice(0, 8);
  if (!engine.includes('/css/tts-download-notice.css?v=' + noticeRevision)) {
    problems.push('engine notice CSS revision drift');
  }
  if (!controller.includes('/css/tts-download-notice.css?v=' + noticeRevision)) {
    problems.push('controller notice CSS revision drift');
  }
  if (!controller.includes('/js/vosk-tts-engine.js?v=' + engineRevision)) {
    problems.push('controller Vosk engine revision drift');
  }`,
'exact lazy asset revision contracts');
}
if (!contract.includes("css.replace('right:max(10px,env(safe-area-inset-right,0px));', 'right:auto;')")) {
  contract = replaceOnce(contract,
`  [engine, controller, css.replace('white-space:normal', 'white-space:nowrap'), workflow],`,
`  [engine, controller, css.replace('white-space:normal', 'white-space:nowrap'), workflow],
  [engine, controller, css.replace('right:max(10px,env(safe-area-inset-right,0px));', 'right:auto;'), workflow],`,
'mobile adversarial contract');
}
if (!contract.includes("DOWNLOAD_NOTICE_CSS_URL = '/css/tts-download-notice.css?v=00000000'")) {
  contract = replaceOnce(contract,
`  [engine, controller, css, workflow.replace('chromium webkit', 'chromium')],`,
`  [engine.replace(/DOWNLOAD_NOTICE_CSS_URL = '\\/css\\/tts-download-notice\\.css\\?v=[a-f0-9]{8}'/, "DOWNLOAD_NOTICE_CSS_URL = '/css/tts-download-notice.css?v=00000000'"), controller, css, workflow],
  [engine, controller.replace(/TTS_NOTICE_CSS_SRC = '\\/css\\/tts-download-notice\\.css\\?v=[a-f0-9]{8}'/, "TTS_NOTICE_CSS_SRC = '/css/tts-download-notice.css?v=00000000'"), css, workflow],
  [engine, controller.replace(/VOSK_ENGINE_SRC = '\\/js\\/vosk-tts-engine\\.js\\?v=[a-f0-9]{8}'/, "VOSK_ENGINE_SRC = '/js/vosk-tts-engine.js?v=00000000'"), css, workflow],
  [engine, controller, css, workflow.replace('chromium webkit', 'chromium')],`,
'lazy asset revision adversarial mutations');
}
fs.writeFileSync(contractPath, contract);

const geometryPath = 'scripts/tts-mobile-notice-geometry-browser-test.js';
if (!fs.existsSync(geometryPath)) throw new Error('permanent mobile geometry test is missing');

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

for (const file of [enginePath, controllerPath, cacheAssetsPath, contractPath, geometryPath]) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}
execFileSync(process.execPath, [contractPath], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/tts-download-consent-contract-test.js'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js', '--write'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js'], { stdio: 'inherit' });

console.log(JSON.stringify({
  css: cssPath,
  cssRevision: noticeRevision,
  engine: enginePath,
  engineRevision,
  controller: controllerPath,
  cacheAssets: cacheAssetsPath,
  contract: contractPath,
  geometry: geometryPath,
  workflow: workflowPath,
}, null, 2));
