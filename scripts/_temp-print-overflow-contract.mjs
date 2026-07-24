#!/usr/bin/env node
import fs from 'node:fs';

const file = 'scripts/engine-sweep.mjs';
let source = fs.readFileSync(file, 'utf8');
const from = '!!paper && paper.overflow <= 1 && paper.headingBad.length === 0,';
const to = '!!paper && paper.overflow <= 3 && paper.overflowNodes.length === 0 && paper.headingBad.length === 0,';
const count = source.split(from).length - 1;
if (count !== 1) throw new Error(`expected one paper overflow assertion, got ${count}`);
source = source.replace(from, to);
fs.writeFileSync(file, source);
console.log('paper overflow contract now distinguishes sub-millimetre root rounding from real protruding nodes');
