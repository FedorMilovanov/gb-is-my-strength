#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const count = (source, pattern) => (source.match(pattern) || []).length;

const site = read('js/site.js');
const nativeTooltips = read('src/runtime/article-tooltips.js');
const witness = read('scripts/lib/a04-browser-witness.mjs');

const splitRegistry = 'if(window.SiteUtils)for(var a in r)Object.prototype.hasOwnProperty.call(r,a)&&(window.SiteUtils[a]=r[a]);else window.SiteUtils=r;';
const sharedRegistry = 'if(window.SiteUtils){for(var a in r)Object.prototype.hasOwnProperty.call(r,a)&&(window.SiteUtils[a]=r[a]);r=window.SiteUtils}else window.SiteUtils=r;';

assert.equal(site.includes(splitRegistry), false, 'legacy site.js must not register controllers on a private post-copy registry');
assert.equal(count(site, new RegExp(sharedRegistry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')), 1, 'legacy site.js must rebind to the public SiteUtils identity exactly once');
assert.equal(count(site, /makeTooltipController\("\.bref\[data-ref\]","\.btip"/g), 1, 'legacy Bible reference owner must be unique');
assert.equal(count(site, /makeTooltipController\("\.fn-marker","\.tooltip"/g), 1, 'legacy footnote owner must be unique');
assert.equal(count(site, /makeTooltipController\("\.gterm","\.gtip"/g), 1, 'legacy glossary owner must be unique');

assert.doesNotMatch(nativeTooltips, /article-inline-tooltip/, 'native articles must not retain the former standalone tooltip owner');
assert.match(nativeTooltips, /api\._tooltipControllers/, 'native articles must expose active ownership through the public SiteUtils registry');
assert.equal(count(nativeTooltips, /api\.makeTooltipController\('\.bref\[data-ref\]', '\.btip'/g), 1, 'native Bible reference owner must be unique');
assert.equal(count(nativeTooltips, /api\.makeTooltipController\('\.fn-marker', '\.tooltip'/g), 1, 'native footnote owner must be unique');
assert.equal(count(nativeTooltips, /api\.makeTooltipController\('\.gterm', '\.gtip'/g), 1, 'native glossary owner must be unique');
assert.match(nativeTooltips, /controller\.activeEl = anchor/, 'native active anchor must be reflected in the public controller record');
assert.match(nativeTooltips, /controller\.activeTip = tip/, 'native active tooltip must be reflected in the public controller record');
assert.match(nativeTooltips, /return anchor\.matches\(candidate\.anchorSel\)/, 'controller lookup must allow the canonical owner to materialize a lazy scripture tip');
assert.match(nativeTooltips, /window\.addEventListener\('keydown',[\s\S]*event\.key === 'Escape'[\s\S]*closeController\(controller, 'escape'\)[\s\S]*}, true\);/, 'the active public controller must close directly from window-capture Escape');
assert.equal(count(nativeTooltips, /closeOnEscape: false/g), 1, 'OverlayRuntime must not compete with the native tooltip controller for Escape');
assert.equal(count(nativeTooltips, /closeOnEscape: true/g), 0, 'native tooltip overlays must not register a second Escape owner');
assert.doesNotMatch(nativeTooltips, /document\.addEventListener\('keydown',[\s\S]*closeController\(controller, 'escape'\)/, 'native Escape ownership must not remain below the document propagation boundary');
assert.doesNotMatch(nativeTooltips, /controller\.close\(false, 'escape'\)/, 'Escape must not pass through a wrapper whose force semantics vary by controller implementation');
assert.match(nativeTooltips, /onRequestClose:[\s\S]*closeController\(controller, requestedReason, true\);[\s\S]*return true/, 'OverlayRuntime Escape requests must synchronously finalize native tooltip state before the record is closed');
assert.doesNotMatch(nativeTooltips, /onRequestClose:[\s\S]*closeController\(controller, closeReason \|\| 'request'\)[\s\S]*return false/, 'OverlayRuntime requests must not recursively close the same overlay record');
assert.doesNotMatch(nativeTooltips, /close\.addEventListener\(/, 'generated close controls must not add a second local event owner');
assert.match(nativeTooltips, /const TOUCH_SLOP_SQUARED = 144/, 'native mobile touch ownership must preserve the proven 12px slop');
assert.match(nativeTooltips, /window\.addEventListener\('touchstart',[\s\S]*capture: true, passive: true/, 'native touch ownership must begin at window capture before downstream propagation can stop');
assert.match(nativeTooltips, /window\.addEventListener\('touchmove',[\s\S]*TOUCH_SLOP_SQUARED[\s\S]*capture: true, passive: true/, 'native touch ownership must distinguish scrolling from a tap at window capture');
assert.match(nativeTooltips, /window\.addEventListener\('touchend',[\s\S]*closest\('\[data-tooltip-close\]'\)[\s\S]*controller\.close\(true, 'control-touchend'\)[\s\S]*capture: true, passive: false/, 'the canonical window touchend dispatcher must close through the active public controller');
assert.match(nativeTooltips, /controller\.close\(true, 'surface-touchend'\)/, 'the canonical touchend dispatcher must preserve noninteractive surface closure through the public controller');
assert.match(nativeTooltips, /stopImmediatePropagation\?\.\(\)/, 'the canonical window touchend dispatcher must suppress a duplicate compatibility click');
assert.doesNotMatch(nativeTooltips, /document\.addEventListener\('touch(?:start|move|end)'/, 'native touch ownership must not remain below the propagation boundary');

assert.match(witness, /querySelectorAll\('\[data-tooltip-close\]'\)/, 'browser witness must resolve close controls at any authored depth');
assert.match(witness, /multiple tooltip close controls/, 'browser witness must fail closed on duplicate close controls');
assert.doesNotMatch(witness, /\[\.\.\.activeTip\.children\].*data-tooltip-close/s, 'browser witness must not assume the close control is a direct child');

console.log('✅ Tooltip owner contract: one public registry, unique selectors and one window-capture touch close owner');
