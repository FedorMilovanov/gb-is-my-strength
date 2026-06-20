#!/usr/bin/env node
/**
 * extract-native-pilot.js — РЕФАКТОРИНГ 5.0 Phase 6 helper.
 *
 * Given a legacy HTML route and a set of semantic block selectors (start/end
 * markers), splits the legacy body into:
 *   _legacy/<block>.html       — verbatim block markup
 *   _legacy/body-segment-<i>.html — the chrome between blocks
 *
 * The caller writes the actual Astro page + named components that consume
 * these fragments via Vite ?raw imports, then runs:
 *   npm run visual:parity:screenshots -- --routes /ROUTE/ --threshold 0.5
 * to prove byte-identical pixel parity before committing.
 *
 * Usage:
 *   node scripts/extract-native-pilot.js \
 *     --legacy biografii/index.html \
 *     --out src/components/biografii/_legacy \
 *     --block 'main:<main id="main-content">|</main>'
 *
 * Multiple --block flags split sequential blocks. Order matters — blocks
 * must appear in the source in the same order they are passed.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ARGS = process.argv.slice(2);
function arg(name) {
  const i = ARGS.indexOf(name);
  if (i === -1) return null;
  return ARGS[i + 1];
}
function flags(name) {
  const out = [];
  for (let i = 0; i < ARGS.length; i++) {
    if (ARGS[i] === name && ARGS[i + 1]) out.push(ARGS[i + 1]);
  }
  return out;
}

const ROOT = path.resolve(__dirname, '..');
const legacyRel = arg('--legacy');
const outRel = arg('--out');
const blockSpecs = flags('--block');

if (!legacyRel || !outRel || blockSpecs.length === 0) {
  console.error('Usage: --legacy <html> --out <dir> --block <name>:<startMarker>|<endMarker> [--block ...]');
  process.exit(2);
}

const legacyAbs = path.join(ROOT, legacyRel);
const outAbs = path.join(ROOT, outRel);
fs.mkdirSync(outAbs, { recursive: true });

const html = fs.readFileSync(legacyAbs, 'utf8');
const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '';
if (!body) { console.error('No <body> in', legacyRel); process.exit(1); }

const blocks = blockSpecs.map((spec) => {
  const [name, markers] = spec.split(':');
  if (!name || !markers) throw new Error(`Bad --block spec: ${spec}`);
  const [startMarker, endMarker] = markers.split('|');
  if (!startMarker || !endMarker) throw new Error(`Bad --block spec markers: ${spec}`);
  const startIdx = body.indexOf(startMarker);
  if (startIdx === -1) throw new Error(`Start marker not found in body: ${startMarker}`);
  const endStart = body.indexOf(endMarker, startIdx + startMarker.length);
  if (endStart === -1) throw new Error(`End marker not found after start: ${endMarker}`);
  const endIdx = endStart + endMarker.length;
  return { name, startIdx, endIdx };
});

// Validate ordering and non-overlap.
for (let i = 1; i < blocks.length; i++) {
  if (blocks[i].startIdx < blocks[i - 1].endIdx) {
    throw new Error(`Blocks overlap or out of order at ${blocks[i].name}`);
  }
}

// Extract block content + the segments between them.
let cursor = 0;
const written = [];
blocks.forEach((b, i) => {
  const segment = body.slice(cursor, b.startIdx);
  const segFile = path.join(outAbs, `body-segment-${i}.html`);
  fs.writeFileSync(segFile, segment);
  written.push(['body-segment-' + i + '.html', segment.length]);
  const blockHtml = body.slice(b.startIdx, b.endIdx);
  const blockFile = path.join(outAbs, `${b.name}.html`);
  fs.writeFileSync(blockFile, blockHtml);
  written.push([b.name + '.html', blockHtml.length]);
  cursor = b.endIdx;
});
const tail = body.slice(cursor);
const tailFile = path.join(outAbs, `body-segment-${blocks.length}.html`);
fs.writeFileSync(tailFile, tail);
written.push(['body-segment-' + blocks.length + '.html', tail.length]);

console.log(`Wrote ${written.length} files to ${outRel}:`);
for (const [name, size] of written) console.log(`  ${size.toString().padStart(8)}  ${name}`);
