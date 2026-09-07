#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT, readRegistry } = require('./lib/editorial-metadata');

function outputPath() {
  const arg = process.argv.find((value) => value.startsWith('--out='));
  if (!arg) throw new Error('usage: node scripts/editorial-metadata-snapshot.js --out=<path>');
  return path.resolve(ROOT, arg.slice('--out='.length));
}

function main() {
  const registry = readRegistry();
  if (!registry?.records || typeof registry.records !== 'object') {
    throw new Error('effective editorial metadata registry is unavailable');
  }
  const out = outputPath();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  console.log(`Editorial metadata effective snapshot: ${Object.keys(registry.records).length} record(s) -> ${path.relative(ROOT, out)}`);
}

try {
  main();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
