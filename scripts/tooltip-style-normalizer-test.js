#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const {
  normalizeTooltipStyles,
  TARGET_VERTICAL_ALIGN,
  TARGET_HOVER_TRANSFORM,
  CLOSED_TOOLTIP_POINTER_RULE,
  LEGACY_FLOATING_TOOLTIP_POINTER_RULE,
  PRIORITY_FLOATING_TOOLTIP_POINTER_RULE,
  FLOATING_TOOLTIP_POINTER_RULE,
  LEGACY_MOBILE_TOOLTIP_CLOSE_RULE,
  MOBILE_TOOLTIP_CLOSE_RULE
} = require('./tooltip-style-normalizer.js');

const fixture = [
  '.fn-marker--dove{display:inline-flex;vertical-align:.04em}',
  '.fn-marker:focus-visible .fn-dove-icon,.fn-marker:hover .fn-dove-icon{transform:scale(1.15) translateY(-1.5px)!important;filter:none}'
].join('\n');

const first = normalizeTooltipStyles(fixture);
assert.equal(first.changes, 5);
assert.match(first.output, new RegExp(`vertical-align:${TARGET_VERTICAL_ALIGN.replace('.', '\\.')}`));
assert.ok(first.output.includes(`transform:${TARGET_HOVER_TRANSFORM}!important;`));
assert.ok(first.output.includes(CLOSED_TOOLTIP_POINTER_RULE));
assert.ok(first.output.includes(FLOATING_TOOLTIP_POINTER_RULE));
assert.ok(first.output.includes(MOBILE_TOOLTIP_CLOSE_RULE));
assert.match(FLOATING_TOOLTIP_POINTER_RULE, /body>\.tooltip\.gb-floating-tip\.is-open/);
assert.match(FLOATING_TOOLTIP_POINTER_RULE, /body>\.gtip\.gb-floating-tip\.is-open/);
assert.match(FLOATING_TOOLTIP_POINTER_RULE, /pointer-events:none!important/);
assert.match(FLOATING_TOOLTIP_POINTER_RULE, /pointer-events:auto!important/);
assert.match(FLOATING_TOOLTIP_POINTER_RULE, /\.tooltip\.gb-floating-tip a/);
assert.match(FLOATING_TOOLTIP_POINTER_RULE, /\[role="button"\]/);
assert.match(MOBILE_TOOLTIP_CLOSE_RULE, /@media\(max-width:768px\)/);
assert.match(MOBILE_TOOLTIP_CLOSE_RULE, /padding-right:3\.25rem}/);
assert.doesNotMatch(MOBILE_TOOLTIP_CLOSE_RULE, /padding-right:3\.25rem!important/);
assert.match(MOBILE_TOOLTIP_CLOSE_RULE, /\.gb-floating-tip>\.gb-tooltip-close/);
assert.match(MOBILE_TOOLTIP_CLOSE_RULE, /width:2\.35rem/);
assert.match(MOBILE_TOOLTIP_CLOSE_RULE, /height:2\.35rem/);
assert.match(MOBILE_TOOLTIP_CLOSE_RULE, /touch-action:manipulation/);
assert.match(MOBILE_TOOLTIP_CLOSE_RULE, /:focus-visible/);

const second = normalizeTooltipStyles(first.output);
assert.equal(second.changes, 0, 'style normalization must be idempotent');
assert.equal(second.output, first.output);

for (const priorRule of [LEGACY_FLOATING_TOOLTIP_POINTER_RULE, PRIORITY_FLOATING_TOOLTIP_POINTER_RULE]) {
  const priorFixture = first.output.replace(FLOATING_TOOLTIP_POINTER_RULE, priorRule);
  const upgraded = normalizeTooltipStyles(priorFixture);
  assert.equal(upgraded.changes, 1, 'prior pointer rule must be upgraded exactly once');
  assert.ok(upgraded.output.includes(FLOATING_TOOLTIP_POINTER_RULE));
  assert.ok(upgraded.output.includes(MOBILE_TOOLTIP_CLOSE_RULE));
  assert.ok(!upgraded.output.includes(priorRule));
  assert.equal(normalizeTooltipStyles(upgraded.output).changes, 0, 'upgraded rule must remain idempotent');
}

const legacyCloseFixture = first.output.replace(MOBILE_TOOLTIP_CLOSE_RULE, LEGACY_MOBILE_TOOLTIP_CLOSE_RULE);
const upgradedCloseRule = normalizeTooltipStyles(legacyCloseFixture);
assert.equal(upgradedCloseRule.changes, 1, 'legacy mobile close priority must be removed exactly once');
assert.ok(upgradedCloseRule.output.includes(MOBILE_TOOLTIP_CLOSE_RULE));
assert.ok(!upgradedCloseRule.output.includes(LEGACY_MOBILE_TOOLTIP_CLOSE_RULE));
assert.equal(normalizeTooltipStyles(upgradedCloseRule.output).changes, 0, 'canonical mobile close rule must remain idempotent');

const missingCloseRule = first.output.replace(`\n${MOBILE_TOOLTIP_CLOSE_RULE}\n`, '\n');
const restoredCloseRule = normalizeTooltipStyles(missingCloseRule);
assert.equal(restoredCloseRule.changes, 1, 'missing mobile close rule must be restored exactly once');
assert.ok(restoredCloseRule.output.includes(MOBILE_TOOLTIP_CLOSE_RULE));
assert.equal(normalizeTooltipStyles(restoredCloseRule.output).changes, 0, 'restored mobile close rule must remain idempotent');

console.log('Tooltip style normalizer test: OK');
