#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const RUNTIME = path.join(ROOT, 'src/runtime/article-tooltips.js');
const CONTRACT = path.join(ROOT, 'scripts/tooltip-owner-contract-test.mjs');
const AUDIT = path.join(ROOT, 'scripts/interactive-audit.js');

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
  const before = `  window.addEventListener('keydown', (event) => {\n    const controller = activeController();\n    if ((event.key === 'Escape' || event.key === 'Esc') && controller) {\n      event.preventDefault();\n      event.stopImmediatePropagation?.();\n      controller.close(false, 'escape');\n    }\n  }, true);`;
  const after = `  window.addEventListener('keydown', (event) => {\n    const controller = activeController();\n    if ((event.key === 'Escape' || event.key === 'Esc') && controller) {\n      event.preventDefault();\n      closeController(controller, 'escape');\n    }\n  }, true);`;
  return replaceExact(source, before, after, 'direct window-capture Escape close');
}

function normalizeContract(source) {
  const before = `assert.match(nativeTooltips, /window\\.addEventListener\\('keydown',[\\s\\S]*event\\.key === 'Escape'[\\s\\S]*event\\.stopImmediatePropagation\\?\\.\\(\\)[\\s\\S]*controller\\.close\\(false, 'escape'\\)[\\s\\S]*}, true\\);/, 'the same active public controller must consume Escape at window capture above downstream document handlers');\nassert.doesNotMatch(nativeTooltips, /document\\.addEventListener\\('keydown',[\\s\\S]*controller\\.close\\(false, 'escape'\\)/, 'native Escape ownership must not remain below the document propagation boundary');`;
  const after = `assert.match(nativeTooltips, /window\\.addEventListener\\('keydown',[\\s\\S]*event\\.key === 'Escape'[\\s\\S]*closeController\\(controller, 'escape'\\)[\\s\\S]*}, true\\);/, 'the active public controller must close directly from window-capture Escape');\nassert.doesNotMatch(nativeTooltips, /document\\.addEventListener\\('keydown',[\\s\\S]*closeController\\(controller, 'escape'\\)/, 'native Escape ownership must not remain below the document propagation boundary');\nassert.doesNotMatch(nativeTooltips, /controller\\.close\\(false, 'escape'\\)/, 'Escape must not pass through a wrapper whose force semantics vary by controller implementation');`;
  return replaceExact(source, before, after, 'direct Escape owner contract');
}

function normalizeAudit(source) {
  const before = `  if (!mobileState.markerOpen || !mobileState.tipOpen || mobileState.generatedClose !== 1 || mobileState.unexpectedInteractive !== 0 || !mobileState.scrollLocked) push('hermenevtika-mobile-footnote-sheet-contract', HERMENEUTIKA_URL, mobileState);\n  await mobile.keyboard.press('Escape');\n  await mobile.waitForTimeout(250);\n  const mobileClosed = await mobile.evaluate(() => ({\n    tipOpen: !!document.querySelector('.gb-floating-tip.is-open'),\n    scrollLocked: document.documentElement.dataset.scrollLocked === '1' || document.body.style.position === 'fixed' || document.documentElement.style.overflow === 'hidden',\n  }));\n  if (mobileClosed.tipOpen || mobileClosed.scrollLocked) push('hermenevtika-mobile-footnote-sheet-did-not-close', HERMENEUTIKA_URL, mobileClosed);`;
  const after = `  if (!mobileState.markerOpen || !mobileState.tipOpen || mobileState.generatedClose !== 1 || mobileState.unexpectedInteractive !== 0 || !mobileState.scrollLocked) push('hermenevtika-mobile-footnote-sheet-contract', HERMENEUTIKA_URL, mobileState);\n  const mobileEscapeReady = await mobile.evaluate(() => {\n    const tip = document.querySelector('.gb-floating-tip.is-open');\n    const close = tip?.querySelector('[data-tooltip-close][data-gb-generated-close="1"]');\n    window.__gbAuditEscapeEvents = [];\n    window.addEventListener('keydown', (event) => {\n      window.__gbAuditEscapeEvents.push({ key: event.key, code: event.code, defaultPrevented: event.defaultPrevented });\n    }, { capture: true, once: true });\n    close?.focus({ preventScroll: true });\n    return {\n      closePresent: !!close,\n      closeFocused: document.activeElement === close,\n      activeTag: document.activeElement?.tagName || '',\n      controller: window.GBArticleTooltips?.snapshot?.() || null,\n      overlayOwner: window.OverlayRuntime?.topLayer?.()?.ownerId || '',\n    };\n  });\n  if (!mobileEscapeReady.closePresent || !mobileEscapeReady.closeFocused) push('hermenevtika-mobile-footnote-escape-focus-unavailable', HERMENEUTIKA_URL, mobileEscapeReady);\n  await mobile.keyboard.press('Escape');\n  await mobile.waitForTimeout(250);\n  const mobileClosed = await mobile.evaluate(() => ({\n    tipOpen: !!document.querySelector('.gb-floating-tip.is-open'),\n    scrollLocked: document.documentElement.dataset.scrollLocked === '1' || document.body.style.position === 'fixed' || document.documentElement.style.overflow === 'hidden',\n    escapeEvents: window.__gbAuditEscapeEvents || [],\n    controller: window.GBArticleTooltips?.snapshot?.() || null,\n    overlayOwner: window.OverlayRuntime?.topLayer?.()?.ownerId || '',\n    activeTag: document.activeElement?.tagName || '',\n  }));\n  if (mobileClosed.tipOpen || mobileClosed.scrollLocked) push('hermenevtika-mobile-footnote-sheet-did-not-close', HERMENEUTIKA_URL, { before: mobileEscapeReady, after: mobileClosed });`;
  return replaceExact(source, before, after, 'mobile Escape delivery witness');
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
const auditChanged = apply(AUDIT, normalizeAudit);
console.log(`A03 Escape delivery normalizer: runtime=${runtimeChanged ? 'changed' : 'clean'} contract=${contractChanged ? 'changed' : 'clean'} audit=${auditChanged ? 'changed' : 'clean'}`);
