#!/usr/bin/env node
/**
 * css-layer-validator.js — РЕФАКТОРИНГ 6.0 Phase 2 tool.
 *
 * Validates CSS @layer architecture:
 *   1. A named-layer order statement exists before named layer blocks when
 *      more than one distinct named layer is present
 *   2. Every named layer block belongs to that declared layer set
 *   3. Re-opening an already declared named layer is allowed anywhere later
 *      (CSS Cascade Layers append rules without changing layer precedence)
 *   4. No unclosed braces
 *   5. !important count does not exceed explicit per-root ceiling
 *   6. Enforces per-root @layer coverage baseline ratchets toward the 80%
 *      migration target and separates baseline protection from target status
 *   7. Fails closed if an unregistered css/*.css file introduces @layer without
 *      explicit baseline and !important ceiling governance
 *
 * Project coverage:
 *   Invoking this guard for a top-level css/*.css file validates every governed
 *   @layer root and auto-discovers any additional css/*.css file using @layer.
 *
 * Usage:
 *   node scripts/css-layer-validator.js css/site.css
 *   node scripts/css-layer-validator.js css/site.css --ceiling=200
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const LAYERED_TARGET_PCT = 80;
const LAYER_NAME_PATTERN = '[A-Za-z_][\\w-]*(?:\\.[A-Za-z_][\\w-]*)*';
const PROJECT_LAYER_ROOTS = new Map([
  ['css/site.css', Object.freeze({ ceiling: 200, minLayeredPct: 18.8 })],
  ['css/home.css', Object.freeze({ ceiling: 52, minLayeredPct: 35.4 })],
  ['css/floating-cluster.css', Object.freeze({ ceiling: 524, minLayeredPct: 9.9 })],
]);

function stripCssComments(cssText) {
  return cssText.replace(/\/\*[\s\S]*?\*\//g, '');
}

function hasLayerSyntax(cssText) {
  return /@layer\b/.test(stripCssComments(cssText));
}

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

function isValidRootPolicy(policy) {
  return Boolean(
    policy &&
    typeof policy === 'object' &&
    Number.isInteger(policy.ceiling) &&
    policy.ceiling >= 0 &&
    typeof policy.minLayeredPct === 'number' &&
    Number.isFinite(policy.minLayeredPct) &&
    policy.minLayeredPct > 0 &&
    policy.minLayeredPct <= LAYERED_TARGET_PCT
  );
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

  const singleLayerBlocks = collectLayerBlocks('@layer components{} @layer components{}');
  if ([...new Set(singleLayerBlocks.map(layer => layer.name))].length !== 1) {
    throw new Error('internal contract: repeated single-layer blocks must remain unambiguous');
  }

  if (hasLayerSyntax('/* @layer components{} */ .x{}')) {
    throw new Error('internal contract: commented @layer text entered project discovery');
  }

  if (PROJECT_LAYER_ROOTS.size !== 3) {
    throw new Error('internal contract: governed project root count drifted');
  }
  for (const [repoPath, policy] of PROJECT_LAYER_ROOTS.entries()) {
    if (!isValidRootPolicy(policy)) {
      throw new Error(`internal contract: invalid root policy for ${repoPath}`);
    }
  }
  if (
    PROJECT_LAYER_ROOTS.get('css/site.css').ceiling !== 200 ||
    PROJECT_LAYER_ROOTS.get('css/site.css').minLayeredPct !== 18.8 ||
    PROJECT_LAYER_ROOTS.get('css/home.css').ceiling !== 52 ||
    PROJECT_LAYER_ROOTS.get('css/home.css').minLayeredPct !== 35.4 ||
    PROJECT_LAYER_ROOTS.get('css/floating-cluster.css').ceiling !== 524 ||
    PROJECT_LAYER_ROOTS.get('css/floating-cluster.css').minLayeredPct !== 9.9
  ) {
    throw new Error('internal contract: governed project roots, ceilings, or coverage ratchets drifted');
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
const minLayeredArg = args.find(a => a.startsWith('--min-layered-pct='));
const projectRootArg = args.find(a => a.startsWith('--project-root='));
const singleFileMode = args.includes('--single');

let ceiling = ceilingArg ? Number.parseInt(ceilingArg.split('=')[1], 10) : null;
let minLayeredPct = minLayeredArg ? Number.parseFloat(minLayeredArg.split('=')[1]) : null;

if (ceilingArg && (!Number.isInteger(ceiling) || ceiling < 0)) {
  console.error(`Invalid --ceiling value: ${ceilingArg}`);
  process.exit(2);
}
if (minLayeredArg && (!Number.isFinite(minLayeredPct) || minLayeredPct < 0 || minLayeredPct > 100)) {
  console.error(`Invalid --min-layered-pct value: ${minLayeredArg}`);
  process.exit(2);
}

if (!cssFile) {
  console.error('Usage: node scripts/css-layer-validator.js <css-file> [--ceiling=N] [--min-layered-pct=N]');
  process.exit(2);
}

const projectRoot = projectRootArg
  ? path.resolve(projectRootArg.slice('--project-root='.length))
  : process.cwd();
const cssPath = path.isAbsolute(cssFile)
  ? cssFile
  : path.resolve(projectRoot, cssFile);

if (!fs.existsSync(cssPath)) {
  console.error(`File not found: ${cssPath}`);
  process.exit(2);
}

const projectCssDir = path.resolve(projectRoot, 'css');
const inProjectCss =
  cssPath.startsWith(`${projectCssDir}${path.sep}`) &&
  path.extname(cssPath) === '.css';
const requestedRepoPath = inProjectCss
  ? path.relative(projectRoot, cssPath).split(path.sep).join('/')
  : null;

if (requestedRepoPath && PROJECT_LAYER_ROOTS.has(requestedRepoPath)) {
  const governedPolicy = PROJECT_LAYER_ROOTS.get(requestedRepoPath);
  if (ceiling !== null && ceiling !== governedPolicy.ceiling) {
    console.error(
      `Governed !important ceiling mismatch for ${requestedRepoPath}: ` +
      `expected ${governedPolicy.ceiling}, got ${ceiling}`
    );
    process.exit(2);
  }
  if (minLayeredPct !== null && Math.abs(minLayeredPct - governedPolicy.minLayeredPct) > 1e-9) {
    console.error(
      `Governed @layer baseline mismatch for ${requestedRepoPath}: ` +
      `expected ${governedPolicy.minLayeredPct}%, got ${minLayeredPct}%`
    );
    process.exit(2);
  }
  if (ceiling === null) ceiling = governedPolicy.ceiling;
  if (minLayeredPct === null) minLayeredPct = governedPolicy.minLayeredPct;
}

if (!singleFileMode && inProjectCss) {
  const discovered = fs.readdirSync(projectCssDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.css'))
    .map(entry => `css/${entry.name}`)
    .filter(repoPath => hasLayerSyntax(fs.readFileSync(path.resolve(projectRoot, repoPath), 'utf8')))
    .sort();

  const coverageErrors = [];
  for (const [repoPath, policy] of PROJECT_LAYER_ROOTS.entries()) {
    if (!isValidRootPolicy(policy)) {
      coverageErrors.push(`Governed @layer root lacks valid baseline/ceiling policy: ${repoPath}`);
      continue;
    }
    const absolute = path.resolve(projectRoot, repoPath);
    if (!fs.existsSync(absolute)) {
      coverageErrors.push(`Governed @layer root is missing: ${repoPath}`);
    } else if (!hasLayerSyntax(fs.readFileSync(absolute, 'utf8'))) {
      coverageErrors.push(`Governed @layer root lost all @layer syntax: ${repoPath}`);
    }
  }

  for (const repoPath of discovered) {
    if (!PROJECT_LAYER_ROOTS.has(repoPath)) {
      coverageErrors.push(
        `Ungoverned @layer root discovered without explicit baseline and !important ceiling: ${repoPath}`
      );
    }
  }

  if (coverageErrors.length > 0) {
    for (const error of coverageErrors) console.error(`❌ ${error}`);
    process.exit(1);
  }

  const targets = [...PROJECT_LAYER_ROOTS.keys()];

  console.log(
    `CSS @layer project coverage: ${targets.length} file(s) — ` +
    targets.join(', ')
  );

  for (const repoPath of targets) {
    if (repoPath === requestedRepoPath) continue;
    const targetPolicy = PROJECT_LAYER_ROOTS.get(repoPath);
    const childArgs = [
      __filename,
      repoPath,
      '--single',
      `--project-root=${projectRoot}`,
      `--ceiling=${targetPolicy.ceiling}`,
      `--min-layered-pct=${targetPolicy.minLayeredPct}`,
    ];
    const child = spawnSync(process.execPath, childArgs, {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    if (child.error) {
      console.error(`Failed to validate ${repoPath}: ${child.error.message}`);
      process.exit(2);
    }
    if (child.status !== 0) {
      console.error(`❌ Project @layer coverage failed at ${repoPath} (exit ${child.status})`);
      process.exit(child.status ?? 1);
    }
  }
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
const foundLayers = collectLayerBlocks(css);
const declaration = parseDeclaredLayers(css);
if (!declaration) {
  const layerNames = [...new Set(foundLayers.map(layer => layer.name))];
  if (layerNames.length === 1) {
    info.push(`Implicit single-layer order: ${layerNames[0]} (no precedence ambiguity)`);
    info.push(`Layer blocks found: ${foundLayers.length}`);
  } else {
    errors.push('No @layer order declaration found');
  }
} else {
  info.push(`Declared layer order: ${declaration.names.join(' → ')}`);

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
if (ceiling === null) {
  errors.push('Missing explicit !important ceiling governance for CSS @layer target');
} else if (importantCount > ceiling) {
  errors.push(`!important count ${importantCount} exceeds ceiling ${ceiling}`);
} else {
  info.push(`!important ceiling ${ceiling}: OK (using ${importantCount})`);
}

// 4. Layered vs unlayered ratio & baseline ratchet
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
const layeredPctRounded = Number(layeredPctValue.toFixed(1));
const layeredPct = layeredPctRounded.toFixed(1);
info.push(`Layered: ${layeredChars} chars (${layeredPct}%)`);
info.push(`Unlayered: ${unlayeredChars} chars (${(100 - layeredPctValue).toFixed(1)}%)`);

if (minLayeredPct !== null) {
  const minLabel = minLayeredPct.toFixed(1);
  if (layeredPctRounded + 1e-9 < minLayeredPct) {
    errors.push(
      `Layered CSS share ${layeredPct}% regressed below governed baseline ≥${minLabel}% ` +
      `(target: ≥${LAYERED_TARGET_PCT}%)`
    );
  } else {
    info.push(
      `Layered baseline ratchet ≥${minLabel}%: OK (current ${layeredPct}%, migration target ≥${LAYERED_TARGET_PCT}%)`
    );
  }
}

const reachedTarget = layeredPctRounded + 1e-9 >= LAYERED_TARGET_PCT;
if (!reachedTarget) {
  const baselineClause = minLayeredPct !== null
    ? `baseline ≥${minLayeredPct.toFixed(1)}% protected; `
    : '';
  warnings.push(
    `Target gap: ${layeredPct}% of CSS is in @layer blocks ` +
    `(${baselineClause}migration target ≥${LAYERED_TARGET_PCT}% not yet reached)`
  );
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
} else if (!reachedTarget) {
  const baselineBadge = minLayeredPct !== null ? `≥${minLayeredPct.toFixed(1)}%` : 'governed';
  console.log(
    `\n✅ BASELINE RATCHET PASSED (protected ${baselineBadge}; migration target ≥${LAYERED_TARGET_PCT}% pending)`
  );
  process.exit(0);
} else {
  console.log(`\n✅ VALIDATION PASSED (target ≥${LAYERED_TARGET_PCT}% met)`);
  process.exit(0);
}
