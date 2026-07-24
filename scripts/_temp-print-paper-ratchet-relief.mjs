#!/usr/bin/env node
import fs from 'node:fs';

const file = 'css/site.css';
let css = fs.readFileSync(file, 'utf8');
const target = '    background: transparent !important;\n    background-image: none;';
const count = css.split(target).length - 1;
if (count !== 1) throw new Error(`expected one redundant hero background escalation, got ${count}`);
css = css.replace(target, '    background: transparent;\n    background-image: none;');
const marker = '/* GB PRINT CONTRACT v2.4a — terminal hero specificity without escalation. */';
if (css.includes(marker)) throw new Error('ratchet relief already applied');
css += `\n\n${marker}\n@media print {\n  html body [data-gill-v16] .article-body :where(.gbs2-hero, .article-hero, .article-header, .hero, [class*=\"hero-wrap\"]),\n  html body [data-reader-root] .article-body :where(.gbs2-hero, .article-hero, .article-header, .hero, [class*=\"hero-wrap\"]) {\n    background: transparent;\n    background-image: none;\n  }\n}\n`;
const total = (css.match(/!important/g) || []).length;
if (total !== 200) throw new Error(`expected exact site.css ratchet 200 after relief, got ${total}`);
fs.writeFileSync(file, css);
console.log(JSON.stringify({ total, marker }, null, 2));
