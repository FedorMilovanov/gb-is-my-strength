#!/usr/bin/env node
/**
 * css-layer-validator.js — РЕФАКТОРИНГ 6.0 Phase 2 tool.
 *
 * Validates a CSS file for @layer architecture:
 *   1. A named-layer order statement exists before named layer blocks
 *   2. Every named layer block belongs to that declared layer set
 *   3. Re-opening an already declared named layer is allowed anywhere later
 *      (CSS Cascade Layers append rules without changing layer precedence)
 *   4. No unclosed braces
 *   5. !important count does not exceed ceiling
 *   6. Reports unlayered rules vs layered rules ratio
 *
 * Usage:
 *   node scripts/css-layer-validator.js css/site.css
 *   node scripts/css-layer-validator.js css/site.css --ceiling=202
 */
'use strict';

const fs = require('fs');
const path = require('path');

const LAYERED_TARGET_PCT = 80;
const LAYER_NAME_PATTERN = '[A-Za-z_][\\w-]*(?:\\.[A-Za-z_][\\w-]*)*';

function parseDeclaredLayers(cssText) {
  const orderRegex = new RegExp(`@layer\\s+(${LAYER_NAME_PATTERN}(?:\\s*,\\s*${LAYER_NAME_PATTERN})*)\\s*;`);
  const match = orderRegex.exec(cssText);
  if (!match) return null;
  return {
    names: match[1].split(',').map(s => s.trim()).filter(Boolean),
    pos: match.index,
  };
}

function collectLayerBlocks(cssText) {
  const blockRegex = new RegExp(`@layer\\s+(${LAYER_NAME_PATTERN})\\s*\\{`, 'g');
  const blocks = [];
  let match;
  while ((match = blockRegex.exec(cssText)) !== null) {
    blocks.push({ name: match[1], pos: match.index });
  }
  return blocks;
}

function validateLayerContract(declaration, foundLayers) {
  const errors = [];
  const warnings = [];
  if (!declaration) return { errors, warnings };

  const declared = declaration.names;
  const declaredSet = new Set(declared);
  if (declaredSet.size !== declared.length) {
    errors.push('Duplicate layer name in @layer order declaration');
  }

  const firstBlock = foundLayers[0];
  if (firstBlock && declaration.pos > firstBlock.pos) {
    errors.push(
      `@layer order declaration appears after the first named layer block ` +
      `(declaration pos ${declaration.pos}, first block @layer ${firstBlock.name} at pos ${firstBlock.pos})`
    );
  }

  for (const layer of foundLayers) {
    if (!declaredSet.has(layer.name)) {
      errors.push(`@layer ${layer.name} used but not declared in order (at pos ${layer.pos})`);
    }
  }

  return { errors, warnings };
}

function runInternalContractChecks() {
  const declaration = parseDeclaredLayers('@layer reset, base, components, utilities;');
  const expected = ['reset', 'base', 'components', 'utilities'];
  if (!declaration || JSON.stringify(declaration.names) !== JSON.stringify(expected)) {
    throw new Error('internal contract: declared layer parsing regressed');
  }

  // Once the statement establishes precedence, named layers may be reopened in
  // any later source order without changing layer precedence.
  const reopenedBlocks = collectLayerBlocks(
    '@layer reset, base, components, utilities; ' +
    '@layer reset{} @layer utilities{} @layer components{} @layer base{}'
  );
  const reopened = validateLayerContract(declaration, reopenedBlocks);
  if (reopened.errors.length !== 0 || reopened.warnings.length !== 0) {
    throw new Error('internal contract: legal named-layer reopening was rejected');
  }

  const lateDeclarationText = '@layer base{} @layer reset, base; @layer reset{}';
  const lateDeclaration = parseDeclaredLayers(lateDeclarationText);
  const late = validateLayerContract(lateDeclaration, collectLayerBlocks(lateDeclarationText));
  if (late.errors.length !== 1 || !late.errors[0].includes('appears after the first named layer block')) {
    throw new Error('internal contract: late order declaration was not rejected');
  }

  const hyphenatedText = '@layer reset, base; @layer reset{} @layer base-extra{}';
  const hyphenatedDeclaration = parseDeclaredLayers(hyphenatedText);
  const hyphenatedBlocks = collectLayerBlocks(hyphenatedText);
  const hyphenated = validateLayerContract(hyphenatedDeclaration, hyphenatedBlocks);
  if (hyphenated.errors.length !== 1 || hyphenatedBlocks[1]?.name !== 'base-extra') {
    throw new Error('internal contract: undeclared hyphenated layer was not detected exactly');
  }

  const duplicateText = '@layer reset, base, reset; @layer reset{} @layer base{}';
  const duplicate = validateLayerContract(
    parseDeclaredLayers(duplicateText),
    collectLayerBlocks(duplicateText)
  );
  if (duplicate.errors.length !== 1 || !duplicate.errors[0].includes('Duplicate layer name')) {
    throw new Error('internal contract: duplicate declaration name was not rejected');
  }

  if (parseDeclaredLayers('@layer reset{} @layer base{}') !== null) {
    throw new Error('internal contract: missing order declaration was not detected');
  }

  if (LAYERED_TARGET_PCT !== 80) {
    throw new Error('internal contract: layered coverage target drifted from the published 80% contract');
  }
}

try {
  runInternalContractChecks();
} catch (error) {
  console.error(`CSS layer validator internal contract failed: ${error.message}`);
  process.exit(2);
}

const args = process.argv.slice(2);
const cssFile = args.find(a => !a.startsWith('--'));
const ceilingArg = args.find(a => a.startsWith('--ceiling='));
const ceiling = ceilingArg ? parseInt(ceilingArg.split('=')[1], 10) : null;

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

// 2. Find @layer order declaration and validate the named-layer contract.
const declaration = parseDeclaredLayers(css);
if (!declaration) {
  errors.push('No @layer order declaration found');
} else {
  info.push(`Declared layer order: ${declaration.names.join(' → ')}`);

  const foundLayers = collectLayerBlocks(css);
  const layerResult = validateLayerContract(declaration, foundLayers);
  errors.push(...layerResult.errors);
  warnings.push(...layerResult.warnings);

  info.push(`Layer blocks found: ${foundLayers.length}`);
  const layerNames = [...new Set(foundLayers.map(f => f.name))];
  for (const name of layerNames) {
    const count = foundLayers.filter(f => f.name === name).length;
    if (count > 1) {
      info.push(`  @layer ${name}: ${count} blocks (legal reopen)`);
    }
  }
}

// 3. !important count
const importantCount = (css.match(/!important/g) || []).length;
info.push(`!important count: ${importantCount}`);
if (ceiling !== null && importantCount > ceiling) {
  errors.push(`!important count ${importantCount} exceeds ceiling ${ceiling}`);
} else if (ceiling !== null) {
  info.push(`!important ceiling ${ceiling}: OK (using ${importantCount})`);
}

// 4. Layered vs unlayered ratio
function findMatchingBrace(cssText, start) {
  let d = 0;
  for (let i = start; i < cssText.length; i++) {
    if (cssText[i] === '{') d++;
    else if (cssText[i] === '}') {
      d--;
      if (d === 0) return i;
    }
  }
  return -1;
}

let layeredChars = 0;
const layerBlockRe = new RegExp(`@layer\\s+${LAYER_NAME_PATTERN}\\s*\\{`, 'g');
let m;
while ((m = layerBlockRe.exec(css)) !== null) {
  const end = findMatchingBrace(css, m.index + m[0].length - 1);
  if (end > 0) layeredChars += (end - m.index);
}
const totalChars = css.length;
const unlayeredChars = totalChars - layeredChars;
const layeredPctValue = totalChars > 0 ? layeredChars / totalChars * 100 : 0;
const layeredPct = layeredPctValue.toFixed(1);
info.push(`Layered: ${layeredChars} chars (${layeredPct}%)`);
info.push(`Unlayered: ${unlayeredChars} chars (${(100 - layeredPctValue).toFixed(1)}%)`);

if (layeredPctValue < LAYERED_TARGET_PCT) {
  warnings.push(`Only ${layeredPct}% of CSS is in @layer blocks (target: ≥${LAYERED_TARGET_PCT}%)`);
}

// 5. Report @media queries
const mediaCount = (css.match(/@media/g) || []).length;
info.push(`@media queries: ${mediaCount}`);

// 6. Check for duplicate selectors (cheap heuristic).
// Keep this deliberately linear: site.css is large, and broad regexes over
// minified CSS can become a CI timeout. Architecture validation above is the
// blocking part; duplicate selector reporting is informational only.
if (css.length < 250000) {
  const selectorRegex = /(^|})\s*([^{}@][^{}]{1,120})\{/g;
  const selectors = {};
  let sm;
  while ((sm = selectorRegex.exec(css)) !== null) {
    const sel = sm[2].trim();
    if (sel.length > 2 && sel.length < 80 && !/[;}]/.test(sel)) {
      selectors[sel] = (selectors[sel] || 0) + 1;
    }
  }
  const dupes = Object.entries(selectors).filter(([, c]) => c > 2).sort((a, b) => b[1] - a[1]);
  if (dupes.length > 0) {
    info.push(`Selectors defined >2 times: ${dupes.length}`);
    for (const [sel, count] of dupes.slice(0, 5)) info.push(`  ${sel}: ${count}x`);
  }
} else {
  info.push('Duplicate selector heuristic skipped for large CSS file (non-blocking)');
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
