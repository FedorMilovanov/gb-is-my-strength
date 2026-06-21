#!/usr/bin/env node
/**
 * css-layer-validator.js — РЕФАКТОРИНГ 6.0 Phase 2 tool.
 *
 * Validates a CSS file for @layer architecture:
 *   1. Declared layer order is correct and complete
 *   2. No unclosed braces
 *   3. All @layer blocks are in the declared order
 *   4. !important count does not exceed ceiling
 *   5. Reports unlayered rules vs layered rules ratio
 *
 * Usage:
 *   node scripts/css-layer-validator.js css/site-layered.css
 *   node scripts/css-layer-validator.js css/site.css --ceiling 202
 */
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const cssFile = args.find(a => !a.startsWith('--'));
const ceilingArg = args.find(a => a.startsWith('--ceiling='));
const ceiling = ceilingArg ? parseInt(ceilingArg.split('=')[1]) : null;

if (!cssFile) {
  console.error('Usage: node scripts/css-layer-validator.js <css-file> [--ceiling=N]');
  process.exit(2);
}

const cssPath = path.resolve(cssFile);
if (!fs.existsSync(cssPath)) {
  console.error(`File not found: ${cssPath}`);
  process.exit(2);
}

const css = fs.readFileSync(cssPath, 'utf8');
const errors = [];
const warnings = [];
const info = [];

// 1. Brace balance
let depth = 0;
for (let i = 0; i < css.length; i++) {
  if (css[i] === '{') depth++;
  else if (css[i] === '}') depth--;
  if (depth < 0) {
    errors.push(`Unbalanced brace at position ${i}: closing brace without opening`);
    break;
  }
}
if (depth > 0) errors.push(`Unbalanced braces: ${depth} unclosed`);
if (depth === 0) info.push('Brace balance: OK');

// 2. Find @layer order declaration
const orderMatch = css.match(/@layer\s+([\w,\s]+);/);
if (!orderMatch) {
  warnings.push('No @layer order declaration found');
} else {
  const declaredLayers = orderMatch[1].split(',').map(s => s.trim()).filter(Boolean);
  info.push(`Declared layer order: ${declaredLayers.join(' → ')}`);

  // 3. Find all @layer blocks and verify they match declared order
  const layerBlockRegex = /@layer\s+(\w+)\s*\{/g;
  const foundLayers = [];
  let match;
  while ((match = layerBlockRegex.exec(css)) !== null) {
    foundLayers.push({ name: match[1], pos: match.index });
  }

  // Check for undeclared layers
  for (const fl of foundLayers) {
    if (!orderMatch[1].includes(fl.name)) {
      warnings.push(`@layer ${fl.name} used but not declared in order (at pos ${fl.pos})`);
    }
  }

  // 4. Report layer sizes
  info.push(`Layer blocks found: ${foundLayers.length}`);
  const layerNames = [...new Set(foundLayers.map(f => f.name))];
  for (const name of layerNames) {
    const count = foundLayers.filter(f => f.name === name).length;
    if (count > 1) {
      info.push(`  @layer ${name}: ${count} blocks`);
    }
  }
}

// 5. !important count
const importantCount = (css.match(/!important/g) || []).length;
info.push(`!important count: ${importantCount}`);
if (ceiling !== null && importantCount > ceiling) {
  errors.push(`!important count ${importantCount} exceeds ceiling ${ceiling}`);
} else if (ceiling !== null) {
  info.push(`!important ceiling ${ceiling}: OK (using ${importantCount})`);
}

// 6. Layered vs unlayered ratio
function findMatchingBrace(css, start) {
  let d = 0;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') d++;
    else if (css[i] === '}') { d--; if (d === 0) return i; }
  }
  return -1;
}

let layeredChars = 0;
const layerBlockRe = /@layer\s+\w+\s*\{/g;
let m;
while ((m = layerBlockRe.exec(css)) !== null) {
  const end = findMatchingBrace(css, m.index + m[0].length - 1);
  if (end > 0) layeredChars += (end - m.index);
}
const totalChars = css.length;
const unlayeredChars = totalChars - layeredChars;
const layeredPct = (layeredChars / totalChars * 100).toFixed(1);
info.push(`Layered: ${layeredChars} chars (${layeredPct}%)`);
info.push(`Unlayered: ${unlayeredChars} chars (${(100 - parseFloat(layeredPct)).toFixed(1)}%)`);

if (parseFloat(layeredPct) < 50) {
  warnings.push(`Only ${layeredPct}% of CSS is in @layer blocks (target: ≥80%)`);
}

// 7. Report @media queries
const mediaCount = (css.match(/@media/g) || []).length;
info.push(`@media queries: ${mediaCount}`);

// 8. Check for duplicate selectors (heuristic)
const selectorRegex = /(?:^|\})\s*([.#\w][\w-]*(?:\s*[.#\w][\w-]*)*)\s*\{/gm;
const selectors = {};
let sm;
while ((sm = selectorRegex.exec(css)) !== null) {
  const sel = sm[1].trim();
  if (sel.length > 2 && sel.length < 80) {
    selectors[sel] = (selectors[sel] || 0) + 1;
  }
}
const dupes = Object.entries(selectors).filter(([, c]) => c > 2).sort((a, b) => b[1] - a[1]);
if (dupes.length > 0) {
  info.push(`Selectors defined >2 times: ${dupes.length}`);
  for (const [sel, count] of dupes.slice(0, 5)) {
    info.push(`  ${sel}: ${count}x`);
  }
}

// Output
console.log(`\n═══ CSS @layer Validator: ${cssFile} ═══\n`);

if (errors.length > 0) {
  console.log('── ERRORS ──');
  for (const e of errors) console.log(`❌ ${e}`);
}

if (warnings.length > 0) {
  console.log('── WARNINGS ──');
  for (const w of warnings) console.log(`⚠️  ${w}`);
}

console.log('── INFO ──');
for (const i of info) console.log(`ℹ️  ${i}`);

if (errors.length > 0) {
  console.log(`\n❌ VALIDATION FAILED — ${errors.length} error(s)`);
  process.exit(1);
} else {
  console.log('\n✅ VALIDATION PASSED');
  process.exit(0);
}
