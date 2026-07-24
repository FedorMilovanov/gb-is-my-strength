#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, 'scripts/map-archaeology-source-registry-audit.js');
const WRITE = process.argv.includes('--write');
let source = fs.readFileSync(TARGET, 'utf8');

const installed = "needsReview: sources.filter((source) => source.verification === 'needs-review').length,";
if (source.includes(installed)) {
  console.log('PASS needs-review summary counter already installed');
  process.exit(0);
}
const oldText = "  verified: verified.length,\n  imported: sources.filter((source) => source.verification === 'imported').length,";
const newText = "  verified: verified.length,\n  needsReview: sources.filter((source) => source.verification === 'needs-review').length,\n  imported: sources.filter((source) => source.verification === 'imported').length,";
const count = source.split(oldText).length - 1;
if (count !== 1) throw new Error(`summary guard expected one occurrence, found ${count}`);
source = source.replace(oldText, newText);
if (!source.includes(installed)) throw new Error('needs-review summary postcondition failed');

if (WRITE) {
  fs.writeFileSync(TARGET, source, 'utf8');
  console.log('UPDATED explicit needs-review summary counter');
} else {
  console.log('PASS guarded needs-review summary patch');
}
