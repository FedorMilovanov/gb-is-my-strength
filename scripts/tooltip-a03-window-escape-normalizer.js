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
  const before = `  document.addEventListener('keydown', (event) => {\n    const controller = activeController();\n    if (event.key === 'Escape' && controller) {\n      event.preventDefault();\n      controller.close(false, 'escape');\n    }\n  }, true);`;
  const after = `  window.addEventListener('keydown', (event) => {\n    const controller = activeController();\n    if ((event.key === 'Escape' || event.key === 'Esc') && controller) {\n      event.preventDefault();\n      event.stopImmediatePropagation?.();\n      controller.close(false, 'escape');\n    }\n  }, true);`;
  return replaceExact(source, before, after, 'window-capture Escape dispatcher');
}

function normalizeContract(source) {
  const before = `assert.match(nativeTooltips, /event\\.key === 'Escape' && controller/, 'the same active public controller must provide the Escape fallback for desktop and mobile sheets');`;
  const after = `assert.match(nativeTooltips, /window\\.addEventListener\\('keydown',[\\s\\S]*event\\.key === 'Escape'[\\s\\S]*event\\.stopImmediatePropagation\\?\\.\\(\\)[\\s\\S]*controller\\.close\\(false, 'escape'\\)[\\s\\S]*}, true\\);/, 'the same active public controller must consume Escape at window capture above downstream document handlers');\nassert.doesNotMatch(nativeTooltips, /document\\.addEventListener\\('keydown',[\\s\\S]*controller\\.close\\(false, 'escape'\\)/, 'native Escape ownership must not remain below the document propagation boundary');`;
  return replaceExact(source, before, after, 'window-capture Escape owner contract');
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
console.log(`A03 window Escape normalizer: runtime=${runtimeChanged ? 'changed' : 'clean'} contract=${contractChanged ? 'changed' : 'clean'}`);
