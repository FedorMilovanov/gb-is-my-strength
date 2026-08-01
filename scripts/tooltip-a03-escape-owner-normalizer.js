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
  const nested = after.includes(before);
  if (afterCount === 1 && beforeCount === (nested ? 1 : 0)) return { output: source, changed: false };
  if (beforeCount !== 1 || afterCount !== 0) {
    throw new Error(`${label} refused input: before=${beforeCount}, after=${afterCount}`);
  }
  return { output: source.replace(before, after), changed: true };
}

function normalizeRuntime(source) {
  return replaceExact(
    source,
    '        closeOnEscape: true,',
    '        closeOnEscape: false,',
    'single native tooltip Escape owner',
  );
}

function normalizeContract(source) {
  const anchor = `assert.match(nativeTooltips, /window\\.addEventListener\\('keydown',[\\s\\S]*event\\.key === 'Escape'[\\s\\S]*closeController\\(controller, 'escape'\\)[\\s\\S]*}, true\\);/, 'the active public controller must close directly from window-capture Escape');`;
  const replacement = `${anchor}\nassert.equal(count(nativeTooltips, /closeOnEscape: false/g), 1, 'OverlayRuntime must not compete with the native tooltip controller for Escape');\nassert.equal(count(nativeTooltips, /closeOnEscape: true/g), 0, 'native tooltip overlays must not register a second Escape owner');`;
  return replaceExact(source, anchor, replacement, 'single Escape owner contract');
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
console.log(`A03 Escape owner normalizer: runtime=${runtimeChanged ? 'changed' : 'clean'} contract=${contractChanged ? 'changed' : 'clean'}`);
