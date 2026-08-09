#!/usr/bin/env node
import fs from 'node:fs';

const path = 'scripts/gill-pre-v16-submenu-regression-audit.js';
let source = fs.readFileSync(path, 'utf8');
const before = `    // Historical witness bcf6389f renders the track INSIDE the ul (first
    // child) so its left:9px resolves against .gbs2-toc and the line runs
    // through the dot centres. A .gbs2-tocscroll-sibling track is offset by
    // the ul inset (dots float ~7.5px right of the line) — that regression
    // was previously enshrined here as "valid track sibling".  [spec §8]
    if(/<ul[^>]+class="gbs2-toc"[^>]*>\\s*<span\\b[^>]+gbs2-track/.test(html))ok(\`${'${route}'} track inside ul (historical placement)\`);else bad(\`${'${route}'} track not first child of ul.gbs2-toc\`);`;
const after = `    // Historical geometry requires the track to remain the first visual child
    // inside .gbs2-toc so left:9px still resolves against the ul and the line
    // runs through dot centres. Current semantic authority additionally requires
    // every rendered ul direct child to be an li. Therefore the decorative track
    // is carried by a first presentation li with display:contents; accepting a
    // raw span direct child here would re-introduce the #1224 list-semantics bug.
    if(/<ul[^>]+class="gbs2-toc"[^>]*>\\s*<li\\b(?=[^>]*\\bgbs2-track-slot\\b)(?=[^>]*\\brole=["']presentation["'])[^>]*>\\s*<span\\b[^>]+gbs2-track/.test(html))ok(\`${'${route}'} track carried by first presentation li\`);else bad(\`${'${route}'} track presentation carrier is not first child of ul.gbs2-toc\`);`;
const first = source.indexOf(before);
if (first < 0) throw new Error('expected historical track assertion not found');
if (source.indexOf(before, first + before.length) >= 0) throw new Error('historical track assertion is not unique');
source = source.slice(0, first) + after + source.slice(first + before.length);
fs.writeFileSync(path, source);
console.log('Gill track contract calibration: PASS');
