#!/usr/bin/env node
import fs from 'node:fs';

const file = 'scripts/_temp-print-paper-contract.mjs';
let source = fs.readFileSync(file, 'utf8');
const from = 'increasing the repository !important ratchet.';
const to = 'increasing the repository priority ratchet.';
const count = source.split(from).length - 1;
if (count !== 1) throw new Error(`expected one materializer comment token, got ${count}`);
source = source.replace(from, to);
fs.writeFileSync(file, source);
console.log('materializer comment no longer contaminates the CSS ratchet count');
