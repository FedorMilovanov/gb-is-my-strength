#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const cssPath = 'css/site.css';
const marker = '/* GB PRINT CONTRACT v2.9 — progress chrome isolation and reversible-card flow. */';
let css = fs.readFileSync(cssPath, 'utf8');
const markerIndex = css.indexOf(marker);
if (markerIndex < 0 || css.indexOf(marker, markerIndex + marker.length) >= 0) {
  throw new Error('v2.9 print marker must exist exactly once');
}
const prefix = css.slice(0, markerIndex);
let block = css.slice(markerIndex);
const blockImportantBefore = (block.match(/!important/g) || []).length;
if (blockImportantBefore < 1) {
  throw new Error('v2.9 print block has no !important flags to converge');
}
block = block.replace(/\s*!important/g, '');
const blockImportantAfter = (block.match(/!important/g) || []).length;
if (blockImportantAfter !== 0) throw new Error(`v2.9 print block still has ${blockImportantAfter} !important flags`);
if (!block.includes('Terminal unlayered print rules intentionally outrank layered screen CSS without !important.')) {
  block = block.replace(
    marker,
    `${marker}\n/* Terminal unlayered print rules intentionally outrank layered screen CSS without !important. */`,
  );
}
css = `${prefix}${block}`.replace(/\s+$/, '') + '\n';
fs.writeFileSync(cssPath, css, 'utf8');

const totalImportant = (css.match(/!important/g) || []).length;
if (totalImportant > 200) throw new Error(`site.css !important ratchet still fails: ${totalImportant} > 200`);

execFileSync(process.execPath, ['scripts/cache-bust.js', '--write'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js'], { stdio: 'inherit' });

console.log(JSON.stringify({
  cssPath,
  blockImportantBefore,
  blockImportantAfter,
  totalImportant,
  cascade: 'terminal unlayered print block'
}, null, 2));
