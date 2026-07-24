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

const tailMarker = '/* GB PRINT CONTRACT v2.6 — compact terminal signature without phantom sheet. */';
if (css.includes(tailMarker)) throw new Error('v2.6 tail fix already present');
css += `

${tailMarker}
@media print {
  html body .article-end-sdg-wrap {
    display: block;
    min-height: 0;
    height: auto;
    margin: 0;
    padding: 0;
    break-inside: avoid-page;
    page-break-inside: avoid;
    break-after: auto;
    page-break-after: auto;
  }

  html body .article-end-sdg {
    display: block;
    min-height: 0;
    height: auto;
    margin: 10mm auto 0;
    padding: 4mm 0 0;
    line-height: 1.2;
    break-inside: avoid-page;
    page-break-inside: avoid;
    break-after: auto;
    page-break-after: auto;
  }

  html body .article-end-sdg span {
    display: block;
    margin: 0 0 2mm;
  }

  html body .article-end-sdg svg {
    display: block;
    width: 22pt;
    height: 28pt;
    margin: 0 auto;
    overflow: visible;
  }

  html body :where(.gbs2-world, .page-wrap, main, article, .article-body) > :last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    break-after: auto;
    page-break-after: auto;
  }
}
`;

const marker = '/* GB PRINT CONTRACT v2.7 — balanced A4 margins, no phantom trailing sheet. */';
css += `\n${marker}\n`;

fs.writeFileSync(cssPath, css);

const important = (css.match(/!important/g) || []).length;
if (important > 200) {
  throw new Error(`site.css priority ratchet exceeded: ${important} > 200`);
}

console.log(JSON.stringify({
  oldPage,
  newPage,
  tailMarker,
  marker,
  important,
}, null, 2));
