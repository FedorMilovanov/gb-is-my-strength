#!/usr/bin/env node
import fs from 'node:fs';

const file = 'src/components/article-pilots/krajne/KrajnePageHead.astro';
let source = fs.readFileSync(file, 'utf8');
const anchor = '"url": "https://gospod-bog.ru/images/og-krajne-isporcheno.webp"';
const anchorIndex = source.indexOf(anchor);
if (anchorIndex < 0) throw new Error('Krajne Article ImageObject URL anchor missing');
if (source.indexOf(anchor, anchorIndex + anchor.length) >= 0) throw new Error('Krajne Article ImageObject URL anchor is not unique');

const windowEnd = Math.min(source.length, anchorIndex + 1200);
let block = source.slice(anchorIndex, windowEnd);
if ((block.match(/"width":\s*900/g) || []).length !== 1) throw new Error('expected exactly one width=900 near Krajne ImageObject URL');
if ((block.match(/"height":\s*600/g) || []).length !== 1) throw new Error('expected exactly one height=600 near Krajne ImageObject URL');
block = block.replace(/"width":\s*900/, '"width": 1200');
block = block.replace(/"height":\s*600/, '"height": 630');
source = source.slice(0, anchorIndex) + block + source.slice(windowEnd);
fs.writeFileSync(file, source);
console.log('Krajne ImageObject dimensions patched to 1200x630');
