#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');

const files = {
  runtime: path.join(ROOT, 'src', 'runtime', 'article-tooltips.js'),
  interactive: path.join(ROOT, 'scripts', 'interactive-audit.js'),
  ownerContract: path.join(ROOT, 'scripts', 'tooltip-owner-contract-test.mjs'),
};

function count(source, needle) {
  return source.split(needle).length - 1;
}

function replaceExact(source, before, after, label) {
  const beforeCount = count(source, before);
  const afterCount = count(source, after);
  const afterContainsBefore = after.includes(before);
  if (afterCount === 1 && beforeCount === (afterContainsBefore ? 1 : 0)) return source;
  if (beforeCount !== 1 || afterCount !== 0) {
    throw new Error(`${label} normalizer refused input: before=${beforeCount}, after=${afterCount}`);
  }
  if (!WRITE) throw new Error(`${label} is stale; rerun with --write`);
  const next = source.replace(before, after);
  const validBeforeCount = afterContainsBefore ? 1 : 0;
  if (count(next, before) !== validBeforeCount || count(next, after) !== 1) {
    throw new Error(`${label} target verification failed`);
  }
  return next;
}

function normalizeFile(file, transforms) {
  const source = fs.readFileSync(file, 'utf8');
  let next = source;
  for (const transform of transforms) {
    next = replaceExact(next, transform.before, transform.after, transform.label);
  }
  if (WRITE && next !== source) fs.writeFileSync(file, next);
  return next !== source;
}

const runtimeChanged = normalizeFile(files.runtime, [
  {
    label: 'Article tooltip runtime version',
    before: 'const VERSION = 13;',
    after: 'const VERSION = 14;',
  },
  {
    label: 'Lazy scripture controller lookup',
    before: `function controllerFor(anchor) {
  return siteUtils()._tooltipControllers.find((candidate) => {
    try {
      return anchor.matches(candidate.anchorSel) && Boolean(inlineTip(anchor, false, candidate.tipSel));
    } catch {
      return false;
    }
  }) || null;
}`,
    after: `function controllerFor(anchor) {
  return siteUtils()._tooltipControllers.find((candidate) => {
    try {
      return anchor.matches(candidate.anchorSel);
    } catch {
      return false;
    }
  }) || null;
}`,
  },
  {
    label: 'Shared Escape fallback',
    before: `  document.addEventListener('keydown', (event) => {
    const controller = activeController();
    if (event.key === 'Escape' && controller && !controller._gbState?.mobileSheet) {
      event.preventDefault();
      controller.close(false, 'escape');
    }
  }, true);`,
    after: `  document.addEventListener('keydown', (event) => {
    const controller = activeController();
    if (event.key === 'Escape' && controller) {
      event.preventDefault();
      controller.close(false, 'escape');
    }
  }, true);`,
  },
]);

const interactiveChanged = normalizeFile(files.interactive, [
  {
    label: 'Mobile footnote close-control audit',
    before: `  const mobileState = await mobile.evaluate(() => ({
    markerOpen: document.querySelector('[data-audit-footnote="75"]')?.getAttribute('aria-expanded') === 'true',
    tipOpen: !!document.querySelector('.gb-floating-tip.is-open'),
    nestedInteractive: document.querySelectorAll('.gb-floating-tip.is-open button, .gb-floating-tip.is-open a, .gb-floating-tip.is-open [tabindex], .gb-floating-tip.is-open [role="button"], .gb-floating-tip.is-open .bref, .gb-floating-tip.is-open [data-ref]').length,
    scrollLocked: document.documentElement.dataset.scrollLocked === '1' || document.body.style.position === 'fixed' || document.documentElement.style.overflow === 'hidden',
  }));
  if (!mobileState.markerOpen || !mobileState.tipOpen || mobileState.nestedInteractive !== 0 || !mobileState.scrollLocked) push('hermenevtika-mobile-footnote-sheet-contract', HERMENEUTIKA_URL, mobileState);`,
    after: `  const mobileState = await mobile.evaluate(() => {
    const tip = document.querySelector('.gb-floating-tip.is-open');
    const generatedClose = tip?.querySelectorAll('[data-tooltip-close][data-gb-generated-close="1"]').length || 0;
    const unexpectedInteractive = tip
      ? Array.from(tip.querySelectorAll('button, a, [tabindex], [role="button"], .bref, [data-ref]'))
          .filter((node) => !node.matches('[data-tooltip-close][data-gb-generated-close="1"]')).length
      : 0;
    return {
      markerOpen: document.querySelector('[data-audit-footnote="75"]')?.getAttribute('aria-expanded') === 'true',
      tipOpen: !!tip,
      generatedClose,
      unexpectedInteractive,
      scrollLocked: document.documentElement.dataset.scrollLocked === '1' || document.body.style.position === 'fixed' || document.documentElement.style.overflow === 'hidden',
    };
  });
  if (!mobileState.markerOpen || !mobileState.tipOpen || mobileState.generatedClose !== 1 || mobileState.unexpectedInteractive !== 0 || !mobileState.scrollLocked) push('hermenevtika-mobile-footnote-sheet-contract', HERMENEUTIKA_URL, mobileState);`,
  },
]);

const ownerChanged = normalizeFile(files.ownerContract, [
  {
    label: 'Physical close-control owner assertion',
    before: `assert.match(nativeTooltips, /window\\.addEventListener\\('touchend',[\\s\\S]*closest\\('\\[data-tooltip-close\\]'\\)[\\s\\S]*closeTooltip\\('control-touchend'\\)[\\s\\S]*capture: true, passive: false/, 'the canonical window touchend dispatcher must own physical mobile closure');`,
    after: `assert.match(nativeTooltips, /window\\.addEventListener\\('touchend',[\\s\\S]*closest\\('\\[data-tooltip-close\\]'\\)[\\s\\S]*controller\\.close\\(true, 'control-touchend'\\)[\\s\\S]*capture: true, passive: false/, 'the canonical window touchend dispatcher must close through the active public controller');`,
  },
  {
    label: 'Physical surface owner assertion',
    before: `assert.match(nativeTooltips, /closeTooltip\\('surface-touchend'\\)/, 'the canonical touchend dispatcher must preserve noninteractive surface closure');`,
    after: `assert.match(nativeTooltips, /controller\\.close\\(true, 'surface-touchend'\\)/, 'the canonical touchend dispatcher must preserve noninteractive surface closure through the public controller');`,
  },
  {
    label: 'Lazy scripture and Escape ownership assertions',
    before: `assert.match(nativeTooltips, /controller\\.activeTip = tip/, 'native active tooltip must be reflected in the public controller record');`,
    after: `assert.match(nativeTooltips, /controller\\.activeTip = tip/, 'native active tooltip must be reflected in the public controller record');
assert.match(nativeTooltips, /return anchor\\.matches\\(candidate\\.anchorSel\\)/, 'controller lookup must allow the canonical owner to materialize a lazy scripture tip');
assert.match(nativeTooltips, /event\\.key === 'Escape' && controller/, 'the same active public controller must provide the Escape fallback for desktop and mobile sheets');`,
  },
]);

console.log(`A03 final tooltip normalizer: runtime=${runtimeChanged ? 'changed' : 'clean'}; interactive=${interactiveChanged ? 'changed' : 'clean'}; owner-contract=${ownerChanged ? 'changed' : 'clean'}.`);
