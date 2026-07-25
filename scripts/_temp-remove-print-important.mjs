#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const cssPath = 'css/site.css';
const runtimePath = 'js/reader-preferences-head.js';
const marker = '/* GB PRINT CONTRACT v2.9 — progress chrome isolation and reversible-card flow. */';
const cascadeComment = '/* Terminal unlayered print rules intentionally outrank layered screen CSS without priority flags. */';
const redundantTooltipPriority = '.tooltip.gb-floating-tip,.gtip.gb-floating-tip,body>.tooltip.gb-floating-tip.is-open,body>.gtip.gb-floating-tip.is-open{pointer-events:none!important}';
const convergedTooltipRule = '.tooltip.gb-floating-tip,.gtip.gb-floating-tip,body>.tooltip.gb-floating-tip.is-open,body>.gtip.gb-floating-tip.is-open{pointer-events:none}';
let css = fs.readFileSync(cssPath, 'utf8');
const markerIndex = css.indexOf(marker);
if (markerIndex < 0 || css.indexOf(marker, markerIndex + marker.length) >= 0) {
  throw new Error('v2.9 print marker must exist exactly once');
}
const prefix = css.slice(0, markerIndex);
let block = css.slice(markerIndex);
const blockImportantBefore = (block.match(/!important/g) || []).length;
block = block.replace(/\s*!important/g, '');
const blockImportantAfter = (block.match(/!important/g) || []).length;
if (blockImportantAfter !== 0) throw new Error(`v2.9 print block still has ${blockImportantAfter} priority flags`);
if (!block.includes(cascadeComment)) block = block.replace(marker, `${marker}\n${cascadeComment}`);
css = `${prefix}${block}`;
const tooltipPriorityCount = css.split(redundantTooltipPriority).length - 1;
const tooltipConvergedCount = css.split(convergedTooltipRule).length - 1;
if (tooltipPriorityCount === 1) css = css.replace(redundantTooltipPriority, convergedTooltipRule);
else if (tooltipPriorityCount !== 0 || tooltipConvergedCount !== 1) {
  throw new Error(`legacy tooltip convergence mismatch: priority=${tooltipPriorityCount}, converged=${tooltipConvergedCount}`);
}
css = css.replace(/\s+$/, '') + '\n';
fs.writeFileSync(cssPath, css, 'utf8');
const totalImportant = (css.match(/!important/g) || []).length;
if (totalImportant > 200) throw new Error(`site.css priority ratchet still fails: ${totalImportant} > 200`);

let runtime = fs.readFileSync(runtimePath, 'utf8');
const runtimeMarker = "      '  /* GB_PRINT_REVERSIBLE_CARD_CASCADE_V1 */',";
if (!runtime.includes(runtimeMarker)) {
  const anchor = "      '  html body [data-print-flow=\"atomic\"].table-scroll { overflow: visible !important; max-height: none !important; }',";
  const insert = [
    anchor,
    runtimeMarker,
    "      '  html body :is(.flip-card,.heart-flip-card,.error-flip-card) { perspective: none !important; min-height: 0 !important; height: auto !important; cursor: default !important; break-inside: avoid-page !important; page-break-inside: avoid !important; }',",
    "      '  html body :is(.flip-card,.heart-flip-card,.error-flip-card) > :is(.flip-card-inner,.heart-flip-inner,.error-flip-inner) { position: static !important; min-height: 0 !important; height: auto !important; transform: none !important; transform-style: flat !important; transition: none !important; }',",
    "      '  html body :is(.flip-card,.heart-flip-card,.error-flip-card) > :is(.flip-card-inner,.heart-flip-inner,.error-flip-inner) > :is(.flip-card-front,.heart-flip-front,.error-flip-front,.flip-card-back,.heart-flip-back,.error-flip-back) { position: static !important; inset: auto !important; width: 100% !important; min-height: 0 !important; height: auto !important; transform: none !important; backface-visibility: visible !important; -webkit-backface-visibility: visible !important; break-inside: avoid-page !important; page-break-inside: avoid !important; }',",
    "      '  html body :is(.flip-card,.heart-flip-card,.error-flip-card) > :is(.flip-card-inner,.heart-flip-inner,.error-flip-inner) > :is(.flip-card-front,.heart-flip-front,.error-flip-front) { display: flex !important; }',",
    "      '  html body :is(.flip-card,.heart-flip-card,.error-flip-card) > :is(.flip-card-inner,.heart-flip-inner,.error-flip-inner) > :is(.flip-card-back,.heart-flip-back,.error-flip-back) { display: none !important; }',",
    "      '  html body :is(.flip-card.flipped,.heart-flip-card.flipped,.error-flip-card.flipped) > :is(.flip-card-inner,.heart-flip-inner,.error-flip-inner) > :is(.flip-card-front,.heart-flip-front,.error-flip-front) { display: none !important; }',",
    "      '  html body :is(.flip-card.flipped,.heart-flip-card.flipped,.error-flip-card.flipped) > :is(.flip-card-inner,.heart-flip-inner,.error-flip-inner) > :is(.flip-card-back,.heart-flip-back,.error-flip-back) { display: flex !important; }',"
  ].join('\n');
  const count = runtime.split(anchor).length - 1;
  if (count !== 1) throw new Error(`runtime card-style anchor: expected 1, found ${count}`);
  runtime = runtime.replace(anchor, insert);
}
fs.writeFileSync(runtimePath, runtime, 'utf8');
execFileSync(process.execPath, ['--check', runtimePath], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js', '--write'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js'], { stdio: 'inherit' });

console.log(JSON.stringify({
  cssPath,
  runtimePath,
  blockImportantBefore,
  blockImportantAfter,
  convergedLegacyPriority: 'floating tooltip pointer-events',
  runtimeCascade: 'GB_PRINT_REVERSIBLE_CARD_CASCADE_V1',
  totalImportant
}, null, 2));
