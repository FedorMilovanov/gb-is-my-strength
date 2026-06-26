#!/usr/bin/env node
/**
 * check-route-migration-matrix.js — guards against migration mode violations.
 *
 * From: GBS non-excluded living audit (P0.2 recommendation)
 *
 * Checks:
 * 1. Route's current source file matches declared migration mode
 * 2. No forbidden patterns (plain-loadLegacyFullDocument-only, blanket shadow-wrap)
 * 3. Excluded routes (nagornaya, Gill, hard-texts) stay in exclusion scope
 * 4. MDX-native routes don't have loadLegacyFullDocument in their source
 * 5. legacy-shadow-app routes don't get simplified to mdx-native
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MATRIX_FILE = path.join(ROOT, 'migration/route-migration-matrix.json');
const OWNERSHIP_FILE = path.join(ROOT, 'migration/page-ownership.json');

const strict = process.argv.includes('--strict');
const problems = [];
const warnings = [];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function matchesGlob(filepath, patterns) {
  return patterns.some((p) => {
    // simple glob: convert ** to .*, * to [^/]+
    const re = new RegExp('^' + p.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '.') + '$');
    return re.test(filepath);
  });
}

function readSource(route, sourcePath) {
  if (!sourcePath) return '';
  const fullPath = path.join(ROOT, sourcePath);
  if (!fs.existsSync(fullPath)) return '';
  return fs.readFileSync(fullPath, 'utf8');
}

function stripComments(source) {
  return String(source || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function findImports(source) {
  const imports = [];
  const re = /import\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(source))) imports.push(m[1]);
  return imports;
}

function resolveImport(fromFile, spec) {
  if (!spec || spec.startsWith('node:') || /^[a-zA-Z@][^/:]*$/.test(spec)) return null;
  if (spec.startsWith('@astrojs/') || spec.startsWith('astro:')) return null;
  let clean = spec.replace(/\?raw$/, '');
  let base;
  if (clean.startsWith('@/')) base = path.join(ROOT, 'src', clean.slice(2));
  else if (clean.startsWith('./') || clean.startsWith('../')) base = path.resolve(path.dirname(fromFile), clean);
  else return null;
  const candidates = [base];
  for (const ext of ['.astro','.mdx','.js','.mjs','.ts','.tsx','.jsx','.json','.html']) candidates.push(base + ext);
  for (const idx of ['index.astro','index.mdx','index.js','index.ts']) candidates.push(path.join(base, idx));
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}


function findLegacyFullDocumentTargets(source) {
  const targets = [];
  const re = /loadLegacyFullDocument\(\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(source))) targets.push(m[1]);
  return targets;
}

function collectClosure(sourcePath) {
  if (!sourcePath) return [];
  const entry = path.join(ROOT, sourcePath);
  if (!fs.existsSync(entry)) return [];
  const files = [];
  const seen = new Set();
  const stack = [entry];
  while (stack.length) {
    const file = stack.pop();
    if (!file || seen.has(file) || !fs.existsSync(file)) continue;
    seen.add(file);
    files.push(file);
    const src = fs.readFileSync(file, 'utf8');
    for (const spec of findImports(src)) {
      const resolved = resolveImport(file, spec);
      if (!resolved) continue;
      const rel = path.relative(ROOT, resolved).replace(/\\/g, '/');
      if (rel.startsWith('src/components/') || rel.startsWith('src/layouts/') || rel.startsWith('src/pages/') || rel.startsWith('src/content/')) stack.push(resolved);
    }

    // Matrix marker checks are source-closure checks, not only Astro-source checks.
    // For intentional legacy-shadow-app wrappers the real public markers may live
    // in the legacy full-document target (for example iframe#appframe in the
    // Russian Baptism 3D wrapper). Follow literal loadLegacyFullDocument('...')
    // targets so the guard verifies the actual wrapped contract instead of
    // forcing marker-comment hacks into route files.
    for (const target of findLegacyFullDocumentTargets(src)) {
      const legacyFile = path.join(ROOT, target);
      if (fs.existsSync(legacyFile) && fs.statSync(legacyFile).isFile()) stack.push(legacyFile);
    }
  }
  return files;
}

function readSourceClosure(route, sourcePath) {
  const files = collectClosure(sourcePath);
  return files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
}

// Routes that are in active refactor exclusion
const EXCLUDED_PATTERNS = [
  'nagornaya/**',
  'articles/dzhon-gill-*',
  'articles/krajne-li-isporcheno-serdce',
  'articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy',
  'hard-texts/**',
];

function isExcludedRoute(route) {
  // Check exact first (no glob needed for full route match)
  if (route === '/articles/krajne-li-isporcheno-serdce/') return true;
  if (route === '/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/') return true;
  // Check by prefix/pattern
  if (route.startsWith('/nagornaya/')) return true;
  if (route.startsWith('/hard-texts/')) return true;
  if (route.includes('/dzhon-gill-')) return true;
  return false;
}

function checkRouteMigration(route, contract, ownership) {
  const source = contract.source;
  if (!source) return;

  const sourceContent = stripComments(readSource(route, source));
  const sourceClosureRaw = readSourceClosure(route, source);
  const sourceClosureContent = stripComments(sourceClosureRaw);

  // Check 0: strict-native should not retain loader/raw legacy transport
  if (contract.mode === 'strict-native') {
    if (sourceClosureContent.includes('loadLegacyFullDocument') || sourceClosureContent.includes('bodyHtml') || sourceClosureContent.includes('headHtml') || sourceClosureContent.includes('bodyAttributes') || sourceClosureContent.includes('?raw') || sourceClosureContent.includes('set:html') || sourceClosureContent.includes('_legacy/')) {
      problems.push(`${route}: strict-native route still retains legacy transport in its source closure.\n  Remove loadLegacyFullDocument/headHtml/bodyAttributes/?raw/set:html/_legacy from ${source}.`);
    }
  }

  // Check 1: mdx-native-article should NOT have loadLegacyFullDocument
  if (contract.mode === 'mdx-native-article') {
    if (sourceContent.includes('loadLegacyFullDocument') ||
        sourceContent.includes('bodyHtml') ||
        sourceContent.includes('legacyFullDocument')) {
      problems.push(
        `${route}: mdx-native-article route uses legacy shadow transport.\n` +
        `  Remove loadLegacyFullDocument/bodyHtml from ${source}.\n` +
        `  Promote to hand-authored MDX + ArticleLayout.`
      );
    }
  }

  // Check 2: native-main-with-legacy-chrome should NOT be a full monolith import
  if (contract.mode === 'native-main-with-legacy-chrome') {
    if (sourceContent.includes("loadLegacyFullDocument('") ||
        sourceContent.includes('loadLegacyFullDocument("')) {
      // It's OK to have loadLegacyFullDocument for the HEAD (legacy SEO), 
      // but the body should be composable
      if (sourceContent.includes('_legacy/main.html?raw') ||
          sourceContent.includes('_legacy/article-body.html?raw') ||
          sourceContent.includes('_legacy/hub.html?raw')) {
        // This is the old blanket-wrap pattern
        const forbid = contract.forbid || [];
        if (forbid.includes('plain-loadLegacyFullDocument-only')) {
          problems.push(
            `${route}: native-main route uses monolithic legacy body import.\n` +
            `  Replace _legacy/main.html?raw / _legacy/hub.html?raw with named fragment imports.\n` +
            `  Promote semantic main to named Astro component.`
          );
        }
      }
    }
  }

  // Check 3: excluded routes should be marked with scope:excluded-semantic-lane
  if (isExcludedRoute(route)) {
    if (contract.scope !== 'excluded-semantic-lane' &&
        contract.mode !== 'excluded-semantic-lane') {
      problems.push(
        `${route}: excluded semantic lane route missing scope:"excluded-semantic-lane".\n` +
        `  This route is in Nagornaya/Gill/hard-texts exclusion zone.\n` +
        `  Do not treat as a regular migration target.`
      );
    }
  }

  // Check 4: legacy-shadow-app should NOT be migrated to mdx-native-article
  if (contract.mode === 'legacy-shadow-app') {
    // OK if it uses loadLegacyFullDocument, but NOT OK if it uses mdx-native layout
    const forbid = contract.forbid || [];
    if (forbid.includes('astro-native-article-layout')) {
      // Check if the source has ArticleLayout without proper runtime checks
      if (sourceContent.includes('ArticleLayout') &&
          !sourceContent.includes('loadLegacyFullDocument') &&
          !sourceContent.includes('MapEngine') &&
          !sourceContent.includes('three')) {
        warnings.push(
          `${route}: legacy-shadow-app may have been accidentally converted to MDX article.\n` +
          `  Verify: if this is an interactive/map/WebGL route, it should use legacy-shadow-app mode.`
        );
      }
    }
  }

  // Check 5: routes with requiredMarkers should have those in dist
  // (This is a soft check — we check if the marker text exists in source as a hint)
  const markers = contract.requiredMarkers || [];
  for (const marker of markers) {
    // Simple string check — marker should appear in source
    if (!sourceClosureRaw.includes(marker) && !sourceClosureRaw.includes(`'${marker}'`) && !sourceClosureRaw.includes(`\"${marker}\"`)) {
      warnings.push(
        `${route}: required marker "${marker}" not found in source ${source}.\n` +
        `  After build, verify dist contains this marker.`
      );
    }
  }
}

// ---------- main ----------
console.log('=== Route Migration Matrix Check ===');
console.log(`Mode: ${strict ? 'STRICT' : 'WARN'}`);
console.log('');

if (!fs.existsSync(MATRIX_FILE)) {
  console.error('❌ migration/route-migration-matrix.json not found');
  if (strict) process.exit(1);
  return;
}

if (!fs.existsSync(OWNERSHIP_FILE)) {
  console.error('❌ migration/page-ownership.json not found');
  if (strict) process.exit(1);
  return;
}

const matrix = readJson(MATRIX_FILE);
const ownership = readJson(OWNERSHIP_FILE);
const routes = ownership.routes || {};

// ── Guard: every route in matrix MUST use a mode defined in matrix.modes.
// Closes BUG-A5 / AuditRepo PFV-007: previously 13 routes used the undefined
// mode `strict-native-app` and this validator silently passed. The matrix
// declared its own enum and then violated it.
const definedModes = new Set(Object.keys(matrix.modes || {}));
const matrixUndef = [];
for (const [route, contract] of Object.entries(matrix.routes || {})) {
  if (!definedModes.has(contract.mode)) {
    matrixUndef.push(`${route}: matrix.mode="${contract.mode}" is NOT in matrix.modes (defined: ${[...definedModes].join(', ')})`);
  }
}
if (matrixUndef.length) {
  console.error('❌ Route migration matrix: undefined modes used');
  matrixUndef.forEach((m) => console.error('  ❌ ' + m));
  process.exit(1);
}

let checked = 0;

for (const [route, info] of Object.entries(routes)) {
  // Skip build-only and built-app routes
  if (info.status === 'build-only') continue;
  if (info.owner === 'built-app') continue;

  const contract = matrix.routes[route];
  if (!contract) {
    // No contract yet — this is expected for excluded routes and new routes
    if (isExcludedRoute(route)) {
      // OK — excluded route, no contract needed
      continue;
    }
    warnings.push(`${route}: no entry in route-migration-matrix.json (add it before migration)`);
    continue;
  }

  checked++;
  checkRouteMigration(route, contract, info);
}

console.log(`Routes checked against matrix: ${checked}`);
console.log(`Matrix entries: ${Object.keys(matrix.routes).length}`);

if (warnings.length > 0) {
  console.log('');
  console.log('⚠️  Warnings:');
  warnings.forEach((w) => console.log('  ⚠️  ' + w.split('\n')[0]));
}

if (problems.length > 0) {
  console.log('');
  if (strict) {
    console.error('❌ Route migration matrix check FAILED:');
    problems.forEach((p) => console.error('  ❌ ' + p.split('\n')[0]));
    if (problems.length > 20) {
      console.error(`  …and ${problems.length - 20} more`);
    }
    process.exit(1);
  } else {
    console.warn(`⚠️  Route migration matrix: ${problems.length} issue(s) found. Run with --strict to fail.`);
    console.log('');
    console.log('✅ Route migration matrix check completed (non-strict mode)');
  }
} else {
  console.log('');
  console.log('✅ Route migration modes are coherent with matrix');
}