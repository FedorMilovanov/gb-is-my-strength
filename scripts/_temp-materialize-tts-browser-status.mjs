#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function replaceExactOrVerify(rel, before, after, label) {
  const file = path.join(ROOT, rel);
  const source = fs.readFileSync(file, 'utf8');
  const beforeCount = source.split(before).length - 1;
  const afterCount = source.split(after).length - 1;

  if (beforeCount === 1 && afterCount === 0) {
    fs.writeFileSync(file, source.replace(before, after));
    console.log(`materialized: ${label}`);
    return true;
  }
  if (beforeCount === 0 && afterCount === 1) {
    console.log(`already materialized: ${label}`);
    return false;
  }
  throw new Error(`${label}: expected exactly one before anchor or one after anchor; got before=${beforeCount}, after=${afterCount}`);
}

let changed = 0;

changed += Number(replaceExactOrVerify(
  'js/floating-cluster-controller.js',
  "    var manual = options.manual === true;\n    var retry = options.retry === true;\n    var blockReason = voskWarmupBlockReason();",
  "    var manual = options.manual === true;\n    var retry = options.retry === true;\n    var preserveBrowserStatus = options.preserveBrowserStatus === true;\n    var blockReason = voskWarmupBlockReason();",
  'declare preserveBrowserStatus option',
));

changed += Number(replaceExactOrVerify(
  'js/floating-cluster-controller.js',
  "\n    showVoskStatus('preparing');\n    _voskWarmupPromise = loadVoskEngineScript().then(function () {",
  "\n    if (!preserveBrowserStatus) showVoskStatus('preparing');\n    _voskWarmupPromise = loadVoskEngineScript().then(function () {",
  'preserve visible browser status during automatic warm-up',
));

changed += Number(replaceExactOrVerify(
  'js/floating-cluster-controller.js',
  "      showVoskStatus('browser');\n      warmVoskInBackground();\n      return Promise.resolve('webspeech');",
  "      showVoskStatus('browser');\n      warmVoskInBackground({ preserveBrowserStatus: true });\n      return Promise.resolve('webspeech');",
  'request status preservation from Web Speech fallback',
));

changed += Number(replaceExactOrVerify(
  'scripts/tts-engine-status-contract-test.js',
  "    ['system voice disclosed', controller, /showVoskStatus\\('browser'\\)/],\n    ['mobile two-row reflow', css, /@media \\(max-width:480px\\)[\\s\\S]*grid-template-columns:30px minmax\\(0,1fr\\)[\\s\\S]*grid-column:2/],",
  "    ['system voice disclosed', controller, /showVoskStatus\\('browser'\\)/],\n    ['browser status preserved during automatic warm-up', controller, /showVoskStatus\\('browser'\\);\\s*warmVoskInBackground\\(\\{ preserveBrowserStatus: true \\}\\)/],\n    ['warm-up supports status preservation', controller, /preserveBrowserStatus\\s*=\\s*options\\.preserveBrowserStatus === true[\\s\\S]{0,360}if \\(!preserveBrowserStatus\\) showVoskStatus\\('preparing'\\)/],\n    ['mobile two-row reflow', css, /@media \\(max-width:480px\\)[\\s\\S]*grid-template-columns:30px minmax\\(0,1fr\\)[\\s\\S]*grid-column:2/],",
  'strengthen source contract for visible browser state',
));

changed += Number(replaceExactOrVerify(
  'scripts/tts-engine-status-contract-test.js',
  "  [engine, controller.replace(/gb:vosk-retry-request/g, 'gb:vosk-retry-missing'), css, workflow],\n  [engine, controller, css.replace('white-space:normal', 'white-space:nowrap'), workflow],",
  "  [engine, controller.replace(/gb:vosk-retry-request/g, 'gb:vosk-retry-missing'), css, workflow],\n  [engine, controller.replace('preserveBrowserStatus: true', 'preserveBrowserStatus: false'), css, workflow],\n  [engine, controller, css.replace('white-space:normal', 'white-space:nowrap'), workflow],",
  'add adversarial status-preservation mutation',
));

console.log(`TTS browser-status materializer complete; changed anchors=${changed}`);
