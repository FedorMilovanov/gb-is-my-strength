#!/usr/bin/env node
/**
 * bundle-modules.js — РЕФАКТОРИНГ 6.0 Phase 3
 * 
 * Bundles extracted JS modules into a single file.
 * This is a SEPARATE bundle from site.js — it runs alongside it.
 * 
 * Usage:
 *   node scripts/bundle-modules.js
 *   # Output: js/site-modules.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const modulesDir = path.join(ROOT, 'js/modules');
const outputFile = path.join(ROOT, 'js/site-modules.js');

// Collect all module files
const modules = fs.readdirSync(modulesDir)
  .filter(f => f.endsWith('.js'))
  .sort()
  .map(f => path.join(modulesDir, f));

console.log(`Bundling ${modules.length} modules:`);
for (const m of modules) {
  const size = fs.statSync(m).size;
  console.log(`  ${path.basename(m)}: ${size} bytes`);
}

// Simple concatenation with headers (no esbuild needed for IIFE modules)
const parts = [
  '/* ═══════════════════════════════════════════════════════════════',
  '   site-modules.js — РЕФАКТОРИНГ 6.0 Phase 3',
  '   Extracted modules from site.js, bundled separately.',
  '   Each module is an IIFE with AbortController cleanup.',
  '   Load AFTER site.js (modules override specific handlers).',
  '   ═══════════════════════════════════════════════════════════════ */\n',
];

for (const mod of modules) {
  const name = path.basename(mod);
  const content = fs.readFileSync(mod, 'utf8');
  parts.push(`/* ── ${name} ── */`);
  parts.push(content);
  parts.push('');
}

const output = parts.join('\n');
fs.writeFileSync(outputFile, output);
console.log(`\nOutput: ${outputFile} (${output.length} bytes)`);

// Syntax check
try {
  new Function(output);
  console.log('✅ Syntax check: OK');
} catch (e) {
  console.error(`❌ Syntax error: ${e.message}`);
  process.exit(1);
}
