#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const RUNTIME = path.join(ROOT, 'src/runtime/article-tooltips.js');
const CONTRACT = path.join(ROOT, 'scripts/tooltip-owner-contract-test.mjs');

function count(source, needle) {
  return source.split(needle).length - 1;
}

function replaceExact(source, before, after, label) {
  const beforeCount = count(source, before);
  const afterCount = count(source, after);
  if (afterCount === 1 && beforeCount === 0) return { output: source, changed: false };
  if (beforeCount !== 1 || afterCount !== 0) {
    throw new Error(`${label} refused input: before=${beforeCount}, after=${afterCount}`);
  }
  return { output: source.replace(before, after), changed: true };
}

function normalizeRuntime(source) {
  const before = `        onRequestClose: (closeReason) => {\n          const requestedReason = closeReason || 'request';\n          window.queueMicrotask(() => closeController(controller, requestedReason, true));\n          return true;\n        },`;
  const after = `        onRequestClose: (closeReason) => {\n          const requestedReason = closeReason || 'request';\n          closeController(controller, requestedReason, true);\n          return true;\n        },`;
  return replaceExact(source, before, after, 'native synchronous OverlayRuntime request close');
}

function normalizeContract(source) {
  const before = `assert.match(nativeTooltips, /onRequestClose:[\\s\\S]*queueMicrotask\\(\\(\\) => closeController\\(controller, requestedReason, true\\)\\)[\\s\\S]*return true/, 'OverlayRuntime Escape requests must close their record before native tooltip state is finalized');`;
  const after = `assert.match(nativeTooltips, /onRequestClose:[\\s\\S]*closeController\\(controller, requestedReason, true\\);[\\s\\S]*return true/, 'OverlayRuntime Escape requests must synchronously finalize native tooltip state before the record is closed');`;
  return replaceExact(source, before, after, 'synchronous OverlayRuntime owner contract');
}

function apply(file, normalizer) {
  const source = fs.readFileSync(file, 'utf8');
  const result = normalizer(source);
  if (WRITE && result.changed) fs.writeFileSync(file, result.output);
  if (!WRITE && result.changed) process.exitCode = 1;
  return result.changed;
}

const runtimeChanged = apply(RUNTIME, normalizeRuntime);
const contractChanged = apply(CONTRACT, normalizeContract);
console.log(`A03 Escape sync normalizer: runtime=${runtimeChanged ? 'changed' : 'clean'} contract=${contractChanged ? 'changed' : 'clean'}`);
