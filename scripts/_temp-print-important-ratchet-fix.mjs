#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('css/site.css');
let css = fs.readFileSync(file, 'utf8');
const marker = '/* =========================================================\n   GB PRINT CONTRACT v2.1 — 2026-07-24';
const markerIndex = css.indexOf(marker);
if (markerIndex < 0) throw new Error('GB PRINT CONTRACT marker missing');

let prefix = css.slice(0, markerIndex);
let print = css.slice(markerIndex);

const oldTotal = (css.match(/!important/g) || []).length;
const oldPrint = (print.match(/!important/g) || []).length;

const heavyCleaning = `  .article-end-actions, [data-fc-root], [data-fc-controls] {\n    display: none !important;\n  }`;
if (prefix.split(heavyCleaning).length - 1 !== 1) {
  throw new Error('Expected one early Heavy Cleaning rule');
}
prefix = prefix.replace(heavyCleaning, `  .article-end-actions, [data-fc-root], [data-fc-controls] {\n    display: none;\n  }`);

// The contract is last in site.css. Remove blanket escalation, then restore
// only the declarations that must beat later route styles / inline geometry.
print = print.replace(/ !important/g, '');

function section(start, end, mutator) {
  const startAt = print.indexOf(start);
  if (startAt < 0) throw new Error(`Section start missing: ${start}`);
  const endAt = end ? print.indexOf(end, startAt + start.length) : print.length;
  if (endAt < 0) throw new Error(`Section end missing after ${start}: ${end}`);
  const before = print.slice(0, startAt);
  const body = print.slice(startAt, endAt);
  const after = print.slice(endAt);
  print = before + mutator(body) + after;
}

function importantOnce(block, declaration) {
  const from = `${declaration};`;
  const to = `${declaration} !important;`;
  const count = block.split(from).length - 1;
  if (count !== 1) throw new Error(`Expected one declaration in scoped block, got ${count}: ${declaration}`);
  return block.replace(from, to);
}

section(
  '  /* Interactive chrome never belongs to the document. */',
  '  /* Collapse every screen shell to one normal-flow paper column. */',
  (block) => importantOnce(block, '    display: none'),
);

section(
  '  /* Collapse every screen shell to one normal-flow paper column. */',
  '  .article-body > *,',
  (block) => {
    for (const declaration of [
      '    width: auto',
      '    margin: 0',
      '    padding: 0',
      '    overflow: visible',
    ]) block = importantOnce(block, declaration);
    return block;
  },
);

section(
  '  /* Scroll/reveal states must never produce pale or missing PDF pages. */',
  '  /* Stable media: no fixed/parallax image can bleed across pages. */',
  (block) => {
    for (const declaration of [
      '    opacity: 1',
      '    visibility: visible',
      '    transform: none',
    ]) block = importantOnce(block, declaration);
    return block;
  },
);

section(
  '  /* Stable media: no fixed/parallax image can bleed across pages. */',
  '  figure, .article-img, .article-figure, .article-hero, .gbs2-hero {',
  (block) => {
    for (const declaration of [
      '    position: static',
      '    float: none',
      '    transform: none',
    ]) block = importantOnce(block, declaration);
    return block;
  },
);

section(
  '  figure img, .article-img img, .article-figure img, .article-hero img, .gbs2-hero img {\n    display: block;',
  '  h1, h2, h3, h4, h5, h6 {',
  (block) => {
    for (const declaration of [
      '    height: auto',
      '    max-height: 235mm',
      '    object-fit: contain',
    ]) block = importantOnce(block, declaration);
    return block;
  },
);

section(
  '/* GB PRINT CONTRACT v2.2 — hero normalization after rendered-PDF inspection. */',
  '  .gbs2-hero::before, .gbs2-hero::after,',
  (block) => importantOnce(block, '    background: transparent'),
);

css = prefix + print;
const newTotal = (css.match(/!important/g) || []).length;
const newPrint = (print.match(/!important/g) || []).length;
if (newPrint !== 15) throw new Error(`Expected 15 print-contract !important declarations, got ${newPrint}`);
if (newTotal > 200) throw new Error(`site.css !important ratchet still exceeded: ${newTotal} > 200`);
if (newTotal >= oldTotal) throw new Error(`No ratchet improvement: ${oldTotal} -> ${newTotal}`);

fs.writeFileSync(file, css);
console.log(JSON.stringify({ oldTotal, oldPrint, newTotal, newPrint }, null, 2));
