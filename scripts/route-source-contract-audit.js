#!/usr/bin/env node
'use strict';

const {
  loadRouteRecords,
  validateRecord,
} = require('./lib/effective-route-registry');

const strict = process.argv.includes('--strict');
const articleOnly = process.argv.includes('--articles-only');
const { records, matrixDiagnostics } = loadRouteRecords();

const errors = [];
const warnings = [];
let checked = 0;
let articleContracts = 0;
let strictNative = 0;

console.log('=== Route Source Contract Audit ===');
console.log(`Mode: ${strict ? 'STRICT' : 'WARN'}`);
console.log(`Scope: ${articleOnly ? 'article routes' : 'all owned routes'}`);
console.log(`Derived runtime contracts: ${matrixDiagnostics.derivedRoutes.length}`);
console.log(`Normalized source-only markers: ${matrixDiagnostics.removedMarkers.length}`);
console.log('');

for (const record of records) {
  const result = validateRecord(record, { strict });
  if (articleOnly && !result.isArticle) continue;
  checked++;
  if (result.isStrictNative) strictNative++;
  if (result.isStrictNative && result.isArticle) articleContracts++;
  errors.push(...result.errors);
  warnings.push(...result.warnings);
}

console.log(`Routes checked: ${checked}`);
console.log(`Strict-native routes: ${strictNative}`);
console.log(`Strict-native article contracts: ${articleContracts}`);

if (warnings.length) {
  console.log('');
  console.log(`⚠️  Warnings (${warnings.length}):`);
  warnings.slice(0, 40).forEach((warning) => console.log(`  ⚠️  ${warning}`));
  if (warnings.length > 40) console.log(`  …and ${warnings.length - 40} more`);
}

if (errors.length) {
  console.log('');
  console.error(`❌ Route source contract audit failed (${errors.length} error(s)):`);
  errors.slice(0, 60).forEach((error) => console.error(`  ❌ ${error}`));
  if (errors.length > 60) console.error(`  …and ${errors.length - 60} more`);
  process.exit(1);
}

console.log('');
console.log('✅ Effective route source contracts are coherent with actual Astro entrypoints');
