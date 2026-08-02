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
  let result = replaceExact(
    source,
    `    _gbState: null,\n    isDesktop() {`,
    `    _gbState: null,\n    _gbSuppressFocusOpen: false,\n    _gbSuppressFocusTimer: 0,\n    isDesktop() {`,
    'controller focus-return state',
  );

  result = replaceExact(
    result.output,
    `  anchor.classList.remove('is-open');\n  anchor.setAttribute('aria-expanded', 'false');\n  if (state.mobileSheet && !overlayManaged) {`,
    `  anchor.classList.remove('is-open');\n  anchor.setAttribute('aria-expanded', 'false');\n  if (state.mobileSheet && /^escape/.test(reason)) {\n    controller._gbSuppressFocusOpen = true;\n    if (controller._gbSuppressFocusTimer) window.clearTimeout(controller._gbSuppressFocusTimer);\n    controller._gbSuppressFocusTimer = window.setTimeout(() => {\n      controller._gbSuppressFocusOpen = false;\n      controller._gbSuppressFocusTimer = 0;\n    }, 500);\n  }\n  if (state.mobileSheet && !overlayManaged) {`,
    'Escape focus-return suppression',
  );

  result = replaceExact(
    result.output,
    `  anchor.addEventListener('focus', () => openController(controller, anchor, 'focus'));`,
    `  anchor.addEventListener('focus', () => {\n    if (controller._gbSuppressFocusOpen) {\n      controller._gbSuppressFocusOpen = false;\n      if (controller._gbSuppressFocusTimer) window.clearTimeout(controller._gbSuppressFocusTimer);\n      controller._gbSuppressFocusTimer = 0;\n      return;\n    }\n    openController(controller, anchor, 'focus');\n  });`,
    'one-shot focus-return consumer',
  );

  return result;
}

function normalizeContract(source) {
  const anchor = `assert.doesNotMatch(nativeTooltips, /controller\\.close\\(false, 'escape'\\)/, 'Escape must not pass through a wrapper whose force semantics vary by controller implementation');`;
  const replacement = `${anchor}\nassert.match(nativeTooltips, /_gbSuppressFocusOpen: false/, 'the public controller record must own one-shot focus-return suppression');\nassert.match(nativeTooltips, /state\\.mobileSheet && \/\\^escape\/[\\s\\S]*controller\\._gbSuppressFocusOpen = true[\\s\\S]*setTimeout[\\s\\S]*500/, 'mobile Escape must arm a bounded focus-return suppressor before OverlayRuntime restores focus');\nassert.match(nativeTooltips, /anchor\\.addEventListener\\('focus',[\\s\\S]*controller\\._gbSuppressFocusOpen[\\s\\S]*return;[\\s\\S]*openController\\(controller, anchor, 'focus'\\)/, 'the restored opener focus must be consumed once without disabling ordinary keyboard focus');`;
  return replaceExact(source, anchor, replacement, 'focus-return owner contract');
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
console.log(`A03 focus-return normalizer: runtime=${runtimeChanged ? 'changed' : 'clean'} contract=${contractChanged ? 'changed' : 'clean'}`);
