#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');

function count(source, needle) {
  return source.split(needle).length - 1;
}

function replaceExact(source, before, after, label) {
  const beforeCount = count(source, before);
  const afterCount = count(source, after);
  const nested = after.includes(before);
  if (afterCount === 1 && beforeCount === (nested ? 1 : 0)) return source;
  if (beforeCount !== 1 || afterCount !== 0) {
    throw new Error(`${label} refused input: before=${beforeCount}, after=${afterCount}`);
  }
  if (!WRITE) throw new Error(`${label} is stale; rerun with --write`);
  const next = source.replace(before, after);
  if (count(next, after) !== 1 || count(next, before) !== (nested ? 1 : 0)) {
    throw new Error(`${label} verification failed`);
  }
  return next;
}

function normalize(relative, transforms) {
  const file = path.join(ROOT, relative);
  const source = fs.readFileSync(file, 'utf8');
  let next = source;
  for (const transform of transforms) next = replaceExact(next, transform.before, transform.after, transform.label);
  if (WRITE && next !== source) fs.writeFileSync(file, next);
  return next !== source;
}

const runtimeChanged = normalize('src/runtime/article-tooltips.js', [
  {
    label: 'Tooltip runtime version',
    before: 'const VERSION = 14;',
    after: 'const VERSION = 15;',
  },
  {
    label: 'Overlay-managed close signature',
    before: "function closeController(controller, reason = 'close') {",
    after: "function closeController(controller, reason = 'close', overlayManaged = false) {",
  },
  {
    label: 'Overlay-managed close branch',
    before: `  if (state.mobileSheet) {
    if (overlayRuntime()) overlayRuntime().close(OWNER, reason);
    else window.SiteUtils?.unlockScroll?.(\`overlay:\${OWNER}\`);
  }`,
    after: `  if (state.mobileSheet && !overlayManaged) {
    if (overlayRuntime()) overlayRuntime().close(OWNER, reason);
    else window.SiteUtils?.unlockScroll?.(\`overlay:\${OWNER}\`);
  }`,
  },
  {
    label: 'Overlay Escape request handoff',
    before: `        onRequestClose: (closeReason) => {
          closeController(controller, closeReason || 'request');
          return false;
        },`,
    after: `        onRequestClose: (closeReason) => {
          const requestedReason = closeReason || 'request';
          window.queueMicrotask(() => closeController(controller, requestedReason, true));
          return true;
        },`,
  },
]);

const contractChanged = normalize('scripts/tooltip-owner-contract-test.mjs', [
  {
    label: 'Overlay Escape ownership contract',
    before: `assert.match(nativeTooltips, /event\\.key === 'Escape' && controller/, 'the same active public controller must provide the Escape fallback for desktop and mobile sheets');`,
    after: `assert.match(nativeTooltips, /event\\.key === 'Escape' && controller/, 'the same active public controller must provide the Escape fallback for desktop and mobile sheets');
assert.match(nativeTooltips, /onRequestClose:[\\s\\S]*queueMicrotask\\(\\(\\) => closeController\\(controller, requestedReason, true\\)\\)[\\s\\S]*return true/, 'OverlayRuntime Escape requests must close their record before native tooltip state is finalized');
assert.doesNotMatch(nativeTooltips, /onRequestClose:[\\s\\S]*closeController\\(controller, closeReason \\|\\| 'request'\\)[\\s\\S]*return false/, 'OverlayRuntime requests must not recursively close the same overlay record');`,
  },
]);

console.log(`A03 Escape ownership normalizer: runtime=${runtimeChanged ? 'changed' : 'clean'}; contract=${contractChanged ? 'changed' : 'clean'}.`);
