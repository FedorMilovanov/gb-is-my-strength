#!/usr/bin/env node
import fs from 'node:fs';

const file = 'scripts/_temp-print-tail-fix.mjs';
let source = fs.readFileSync(file, 'utf8');
const from = '\\\\${{';
const to = '\\${{';
const count = source.split(from).length - 1;
if (count !== 2) throw new Error(`expected two double-escaped GitHub expressions, got ${count}`);
source = source.split(from).join(to);
fs.writeFileSync(file, source);
console.log('GitHub expressions in generated workflow now retain exactly one template-literal escape');
