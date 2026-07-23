#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { buildPublicSurfaceRegistry } = require('./lib/public-surface-registry');
const { auditProductionSurfaces } = require('./lib/html-surface-contract');

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const root = path.resolve(process.cwd(), argValue('--root', 'dist'));
const strict = process.argv.includes('--strict');
const reportPath = argValue('--report', '');

if (!fs.existsSync(root)) {
  console.error(`❌ HTML surface root does not exist: ${root}`);
  process.exit(1);
}

const registry = buildPublicSurfaceRegistry();
if (registry.errors.length) {
  registry.errors.forEach((error) => console.error(`❌ REGISTRY ${error}`));
  process.exit(1);
}

const { entries, issues } = auditProductionSurfaces({ root, registry });
const errors = issues.filter((issue) => issue.severity === 'error');
const warnings = issues.filter((issue) => issue.severity === 'warning');

console.log(`HTML SURFACE CONTRACT (${path.relative(process.cwd(), root) || '.'})`);
console.log(`Production routes: ${entries.length}`);
for (const issue of issues) {
  const icon = issue.severity === 'error' ? '❌' : '⚠️';
  console.log(`${icon} ${issue.route} [${issue.contract}] ${issue.detail}`);
}
console.log(`\n${errors.length ? '❌' : '✅'} ${errors.length} error(s), ${warnings.length} warning(s)`);

if (reportPath) {
  const output = path.resolve(process.cwd(), reportPath);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify({
    generatedAt: new Date().toISOString(),
    root: path.relative(process.cwd(), root) || '.',
    productionRoutes: entries.length,
    errors: errors.length,
    warnings: warnings.length,
    issues,
  }, null, 2) + '\n');
}

if (strict && errors.length) process.exit(1);
