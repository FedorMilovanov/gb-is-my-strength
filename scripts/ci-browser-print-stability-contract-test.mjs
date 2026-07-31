#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const browser = fs.readFileSync('scripts/public-surface-cross-browser-matrix.mjs', 'utf8');
assert.match(browser, /interaction:\$\{name\}:preflight-clean/);
assert.match(browser, /interaction:\$\{name\}:closes/);
assert.match(browser, /\.mso-backdrop/);
assert.match(browser, /page\.reload\(\{ waitUntil: 'domcontentloaded' \}\)/);
assert.doesNotMatch(browser, /force:\s*true/);

const print = fs.readFileSync('scripts/print-pagination-contract.mjs', 'utf8');
assert.match(print, /image\.loading = 'eager'/);
assert.match(print, /image\.decode\(\)/);
assert.match(print, /PRINT IMAGE READINESS failed/);
assert.match(print, /naturalWidth === 0/);
console.log('CI BROWSER/PRINT STABILITY CONTRACT: PASS');
