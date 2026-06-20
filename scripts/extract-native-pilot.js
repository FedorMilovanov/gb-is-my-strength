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
 *
 * DEPTH-AWARE end-marker matching (since r252): for nested structures
 * (e.g. <div class="karty-hub"><div>...</div></div>), the simple
 * `body.indexOf(endMarker)` finds the FIRST `</div>` after the start, which
 * is a nested close. This script now walks the markup counting opening and
 * closing tags of the same type and only matches when the depth returns to
 * the same level as at the start. Supports `<div>`, `<section>`, `<aside>`,
 * `<article>`, `<main>`, `<nav>`, `<header>`, `<footer>`, `<form>`,
 * `<figure>`. For other tag types (e.g. `<p>`, `<span>`), the legacy
 * `indexOf` matching is used.
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

// Block tags whose depth we track for nested matching.
const BLOCK_TAGS = ['div', 'section', 'aside', 'article', 'main', 'nav', 'header', 'footer', 'form', 'figure'];

/**
 * Find the matching close tag for a start marker by walking the markup and
 * tracking the depth of the same tag type. Returns the index immediately
 * AFTER the matched end marker.
 */
function findMatchingEnd(body, startMarker, endMarker) {
  const startIdx = body.indexOf(startMarker);
  if (startIdx === -1) return -1;

  // Determine the tag name from the start marker (e.g. <div class="..."> → 'div')
  const tagMatch = startMarker.match(/^<([a-z][a-z0-9]*)/i);
  if (!tagMatch) {
    // Non-block tag (rare) — fall back to plain indexOf.
    const endIdx = body.indexOf(endMarker, startIdx + startMarker.length);
    return endIdx === -1 ? -1 : endIdx + endMarker.length;
  }
  const tag = tagMatch[1].toLowerCase();
  if (!BLOCK_TAGS.includes(tag)) {
    const endIdx = body.indexOf(endMarker, startIdx + startMarker.length);
    return endIdx === -1 ? -1 : endIdx + endMarker.length;
  }

  // Depth-aware: walk from end of start marker until depth returns to 0.
  const openTag = new RegExp('<' + tag + '(?:\\s[^>]*?)?(?<!/)>', 'gi');
  const closeTag = new RegExp('</' + tag + '\\s*>', 'gi');
  let depth = 1;
  let pos = startIdx + startMarker.length;
  while (depth > 0 && pos < body.length) {
    openTag.lastIndex = pos;
    closeTag.lastIndex = pos;
    const openMatch = openTag.exec(body);
    const closeMatch = closeTag.exec(body);
    if (!closeMatch) return -1;
    if (openMatch && openMatch.index < closeMatch.index) {
      depth++;
      pos = openMatch.index + openMatch[0].length;
    } else {
      depth--;
      pos = closeMatch.index + closeMatch[0].length;
      if (depth === 0) return pos;
    }
  }
  return -1;
}

const blocks = blockSpecs.map((spec) => {
  const [name, markers] = spec.split(':');
  if (!name || !markers) throw new Error(`Bad --block spec: ${spec}`);
  const [startMarker, endMarker] = markers.split('|');
  if (!startMarker || !endMarker) throw new Error(`Bad --block spec markers: ${spec}`);
  const startIdx = body.indexOf(startMarker);
  if (startIdx === -1) throw new Error(`Start marker not found in body: ${startMarker}`);
  const endIdx = findMatchingEnd(body, startMarker, endMarker);
  if (endIdx === -1) throw new Error(`End marker not found after start (depth-aware search): ${endMarker}`);
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
