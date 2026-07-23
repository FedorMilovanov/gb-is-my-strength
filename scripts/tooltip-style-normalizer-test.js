#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const {
  normalizeTooltipStyles,
  TARGET_VERTICAL_ALIGN,
  TARGET_HOVER_TRANSFORM,
  CLOSED_TOOLTIP_POINTER_RULE
} = require('./tooltip-style-normalizer.js');

const fixture = [
  '.fn-marker--dove{display:inline-flex;vertical-align:.04em}',
  '.fn-marker:focus-visible .fn-dove-icon,.fn-marker:hover .fn-dove-icon{transform:scale(1.15) translateY(-1.5px)!important;filter:none}'
].join('\n');

const first = normalizeTooltipStyles(fixture);
assert.equal(first.changes, 3);
assert.match(first.output, new RegExp(`vertical-align:${TARGET_VERTICAL_ALIGN.replace('.', '\\.')}`));
assert.ok(first.output.includes(`transform:${TARGET_HOVER_TRANSFORM}!important;`));
assert.ok(first.output.includes(CLOSED_TOOLTIP_POINTER_RULE));

const second = normalizeTooltipStyles(first.output);
assert.equal(second.changes, 0, 'style normalization must be idempotent');
assert.equal(second.output, first.output);

console.log('Tooltip style normalizer test: OK');
