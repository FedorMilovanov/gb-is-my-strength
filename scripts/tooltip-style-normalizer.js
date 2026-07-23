#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CSS_FILE = path.join(ROOT, 'css/site.css');
const WRITE = process.argv.includes('--write');
const TARGET_VERTICAL_ALIGN = '.14em';
const TARGET_HOVER_TRANSFORM = 'translateY(-.08em) scale(1.08)';
const CLOSED_TOOLTIP_POINTER_RULE = '.fn-marker:not(.is-open)>.tooltip{pointer-events:none}.fn-marker.is-open>.tooltip{pointer-events:auto}';
const LEGACY_FLOATING_TOOLTIP_POINTER_RULE = '.tooltip.gb-floating-tip,.gtip.gb-floating-tip{pointer-events:none}.tooltip.gb-floating-tip a,.tooltip.gb-floating-tip button,.tooltip.gb-floating-tip input,.tooltip.gb-floating-tip select,.tooltip.gb-floating-tip textarea,.tooltip.gb-floating-tip summary,.tooltip.gb-floating-tip [tabindex],.tooltip.gb-floating-tip [role="button"],.tooltip.gb-floating-tip [contenteditable]:not([contenteditable="false"]),.gtip.gb-floating-tip a,.gtip.gb-floating-tip button,.gtip.gb-floating-tip input,.gtip.gb-floating-tip select,.gtip.gb-floating-tip textarea,.gtip.gb-floating-tip summary,.gtip.gb-floating-tip [tabindex],.gtip.gb-floating-tip [role="button"],.gtip.gb-floating-tip [contenteditable]:not([contenteditable="false"]){pointer-events:auto}';
const PRIORITY_FLOATING_TOOLTIP_POINTER_RULE = '.tooltip.gb-floating-tip,.gtip.gb-floating-tip{pointer-events:none!important}.tooltip.gb-floating-tip a,.tooltip.gb-floating-tip button,.tooltip.gb-floating-tip input,.tooltip.gb-floating-tip select,.tooltip.gb-floating-tip textarea,.tooltip.gb-floating-tip summary,.tooltip.gb-floating-tip [tabindex],.tooltip.gb-floating-tip [role="button"],.tooltip.gb-floating-tip [contenteditable]:not([contenteditable="false"]),.gtip.gb-floating-tip a,.gtip.gb-floating-tip button,.gtip.gb-floating-tip input,.gtip.gb-floating-tip select,.gtip.gb-floating-tip textarea,.gtip.gb-floating-tip summary,.gtip.gb-floating-tip [tabindex],.gtip.gb-floating-tip [role="button"],.gtip.gb-floating-tip [contenteditable]:not([contenteditable="false"]){pointer-events:auto!important}';
const FLOATING_TOOLTIP_POINTER_RULE = '.tooltip.gb-floating-tip,.gtip.gb-floating-tip,body>.tooltip.gb-floating-tip.is-open,body>.gtip.gb-floating-tip.is-open{pointer-events:none!important}.tooltip.gb-floating-tip a,.tooltip.gb-floating-tip button,.tooltip.gb-floating-tip input,.tooltip.gb-floating-tip select,.tooltip.gb-floating-tip textarea,.tooltip.gb-floating-tip summary,.tooltip.gb-floating-tip [tabindex],.tooltip.gb-floating-tip [role="button"],.tooltip.gb-floating-tip [contenteditable]:not([contenteditable="false"]),.gtip.gb-floating-tip a,.gtip.gb-floating-tip button,.gtip.gb-floating-tip input,.gtip.gb-floating-tip select,.gtip.gb-floating-tip textarea,.gtip.gb-floating-tip summary,.gtip.gb-floating-tip [tabindex],.gtip.gb-floating-tip [role="button"],.gtip.gb-floating-tip [contenteditable]:not([contenteditable="false"]){pointer-events:auto!important}';

function normalizeTooltipStyles(source) {
  let changes = 0;
  let verticalMatches = 0;
  let hoverMatches = 0;

  let output = source.replace(/(\.fn-marker--dove\{[^{}]*?vertical-align:)([^;}]+)/g, (full, prefix, value) => {
    verticalMatches += 1;
    if (value.trim() === TARGET_VERTICAL_ALIGN) return full;
    changes += 1;
    return `${prefix}${TARGET_VERTICAL_ALIGN}`;
  });

  output = output.replace(/(\.fn-marker:focus-visible \.fn-dove-icon,\.fn-marker:hover \.fn-dove-icon\{transform:)([^;}]+)(!important;)/g, (full, prefix, value, suffix) => {
    hoverMatches += 1;
    if (value.trim() === TARGET_HOVER_TRANSFORM) return full;
    changes += 1;
    return `${prefix}${TARGET_HOVER_TRANSFORM}${suffix}`;
  });

  if (!output.includes(CLOSED_TOOLTIP_POINTER_RULE)) {
    output = `${output.trimEnd()}\n${CLOSED_TOOLTIP_POINTER_RULE}\n`;
    changes += 1;
  }

  const previousFloatingRule = [PRIORITY_FLOATING_TOOLTIP_POINTER_RULE, LEGACY_FLOATING_TOOLTIP_POINTER_RULE]
    .find((rule) => output.includes(rule));
  if (previousFloatingRule) {
    output = output.replace(previousFloatingRule, FLOATING_TOOLTIP_POINTER_RULE);
    changes += 1;
  } else if (!output.includes(FLOATING_TOOLTIP_POINTER_RULE)) {
    output = `${output.trimEnd()}\n${FLOATING_TOOLTIP_POINTER_RULE}\n`;
    changes += 1;
  }

  if (verticalMatches !== 1) {
    throw new Error(`Expected exactly one .fn-marker--dove vertical-align rule, found ${verticalMatches}.`);
  }
  if (hoverMatches !== 1) {
    throw new Error(`Expected exactly one shared dove hover transform rule, found ${hoverMatches}.`);
  }

  return { output, changes, verticalMatches, hoverMatches };
}

function main() {
  const source = fs.readFileSync(CSS_FILE, 'utf8');
  const result = normalizeTooltipStyles(source);
  console.log(`Tooltip style normalizer: ${result.changes} change(s); vertical-align=${TARGET_VERTICAL_ALIGN}; hover=${TARGET_HOVER_TRANSFORM}; closed-tooltip pointer shield=on; open floating surface pass-through=specific.`);

  if (WRITE && result.output !== source) {
    fs.writeFileSync(CSS_FILE, result.output);
    return;
  }
  if (!WRITE && result.output !== source) process.exitCode = 1;
}

if (require.main === module) main();
else module.exports = {
  normalizeTooltipStyles,
  TARGET_VERTICAL_ALIGN,
  TARGET_HOVER_TRANSFORM,
  CLOSED_TOOLTIP_POINTER_RULE,
  LEGACY_FLOATING_TOOLTIP_POINTER_RULE,
  PRIORITY_FLOATING_TOOLTIP_POINTER_RULE,
  FLOATING_TOOLTIP_POINTER_RULE
};
