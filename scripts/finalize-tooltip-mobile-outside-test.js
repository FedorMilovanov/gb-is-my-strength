#!/usr/bin/env node
'use strict';

// Temporary deterministic mutator; removed before merge.
const fs = require('node:fs');
const path = require('node:path');

const file = path.resolve(__dirname, 'tooltip-marker-browser-test.js');
const write = process.argv.includes('--write');
const source = fs.readFileSync(file, 'utf8');
const before = "  await page.tap('#outside');";
const after = "  await page.touchscreen.tap(20, 300);";

if (source.includes(after)) {
  console.log('Mobile outside-tap fixture is already canonical.');
  process.exit(0);
}
if (!source.includes(before)) throw new Error('Expected locator-based outside tap not found.');
if (!write) {
  console.error('Mobile outside-tap fixture requires normalization.');
  process.exit(1);
}
fs.writeFileSync(file, source.replace(before, after));
console.log('Mobile outside-tap fixture normalized.');
