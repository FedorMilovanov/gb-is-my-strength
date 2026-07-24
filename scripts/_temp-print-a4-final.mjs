#!/usr/bin/env node
import fs from 'node:fs';

const cssPath = 'css/site.css';
let css = fs.readFileSync(cssPath, 'utf8');

const oldPage = '@page { size: A4; margin: 15mm 14mm 17mm; }';
const newPage = '@page { size: A4; margin: 14mm; }';
const occurrences = css.split(oldPage).length - 1;
if (occurrences !== 1) {
  throw new Error(`expected exactly one legacy A4 page contract, found ${occurrences}`);
}
if (css.includes(newPage)) {
  throw new Error('final A4 page contract is already present');
}

css = css.replace(oldPage, newPage);

const marker = '/* GB PRINT CONTRACT v2.7 — balanced A4 margins, no phantom trailing sheet. */';
css += `\n\n${marker}\n`;

fs.writeFileSync(cssPath, css);

const important = (css.match(/!important/g) || []).length;
if (important > 200) {
  throw new Error(`site.css priority ratchet exceeded: ${important} > 200`);
}

console.log(JSON.stringify({
  oldPage,
  newPage,
  marker,
  important,
}, null, 2));
