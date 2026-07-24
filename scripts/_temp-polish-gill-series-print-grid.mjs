#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const cssPath = 'css/site.css';
const marker = 'GB PRINT CONTRACT v2.9 — balanced Gill series overview grid';
let css = fs.readFileSync(cssPath, 'utf8');

if (!css.includes(marker)) {
  css = `${css.trimEnd()}\n\n/* ${marker}. */\n@media print {\n  html body [data-gill-v16=\"part1\"] .article-body > .note-box:first-child {\n    break-inside: avoid-page;\n    page-break-inside: avoid;\n  }\n\n  html body [data-gill-v16=\"part1\"] .article-body > .note-box:first-child > .grid {\n    display: grid;\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n    gap: 5mm;\n    align-items: stretch;\n  }\n\n  html body [data-gill-v16=\"part1\"] .article-body > .note-box:first-child .gill-card {\n    min-width: 0;\n    min-height: 0;\n    height: auto;\n  }\n}\n`;
  fs.writeFileSync(cssPath, css, 'utf8');
}

execFileSync('node', ['scripts/cache-bust.js', '--write'], { stdio: 'inherit' });
