#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, 'karty/_engine/map-engine.js');
const write = process.argv.includes('--write');
let source = fs.readFileSync(TARGET, 'utf8');

const desired = [
  "const fallback=STAGE_COLORS[stageIndex]||STAGE_COLORS[0];",
  ":'me-arrow-'+(STAGE_COLORS[stageIndex]?stageIndex:0);",
  "version:'0.55.0',buildDate:'2026-07-24'"
];
if (desired.every((needle) => source.includes(needle))) {
  console.log('PASS MapEngine v0.55 version and legacy fallback semantics already synchronized');
  process.exit(0);
}

function replaceExactlyOnce(oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one occurrence, found ${count}`);
  source = source.replace(oldText, newText);
}

replaceExactlyOnce(
  'const fallback=STAGE_COLORS[stageIndex%STAGE_COLORS.length]||STAGE_COLORS[0];',
  'const fallback=STAGE_COLORS[stageIndex]||STAGE_COLORS[0];',
  'legacy stage color fallback'
);
replaceExactlyOnce(
  ":'me-arrow-'+(stageIndex%STAGE_COLORS.length);",
  ":'me-arrow-'+(STAGE_COLORS[stageIndex]?stageIndex:0);",
  'legacy stage arrow fallback'
);
replaceExactlyOnce(
  "version:'0.54.0',buildDate:'2026-07-21'",
  "version:'0.55.0',buildDate:'2026-07-24'",
  'public engine version'
);

for (const needle of desired) {
  if (!source.includes(needle)) throw new Error(`postcondition failed: ${needle}`);
}
if (source.includes('stageIndex%STAGE_COLORS.length')) {
  throw new Error('stale modulo fallback remains in MapEngine');
}

if (write) {
  fs.writeFileSync(TARGET, source, 'utf8');
  console.log('UPDATED MapEngine v0.55 public version and legacy fallback semantics');
} else {
  console.log('PASS guarded MapEngine v0.55 synchronization transaction');
}
