import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, 'MANIFEST.json'), 'utf8'));
assert.equal(manifest.files.length, 12, 'W57 source owner count');
for (const file of manifest.files) {
  const bytes = readFileSync(join(root, 'assets', file.name));
  assert.equal(bytes.length, file.bytes, file.name + ' length changed');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256,
    file.name + ' differs from accepted local W57');
}
const css = readFileSync(join(root, 'assets', 'reader_w57.css'), 'utf8');
const js = readFileSync(join(root, 'assets', 'reader_w57.js'), 'utf8');
const shell = readFileSync(join(root, 'preview.py'), 'utf8');
assert.match(css, /W57 VISUAL CLOSURE 2026-11-20/, 'source alignment wave absent');
assert.match(css, /--np-w57-axis-x:\s*calc\(95vw - 20px\)/, 'viewport-defined axis required');
assert.match(js, /setProperty\('--np-w57-axis-x','calc\(95vw - 20px\)'\)/,
  'remove geometry feedback into the axis');
assert.doesNotMatch(js, /ResizeObserver\(schedule\)/, 'avoid per-frame toggle-derived geometry');
assert.match(css, /W57 MOBILE LIBRARY PLAIN SVG 2026-11-20/, 'unframed mobile book required');
assert.match(css, /W57 mobile FAB source specificity: 2026-11-20/, 'two-ID legacy mobile plate must be overridden');
assert.match(css, /#npURightEdgeRail::after/, 'fold/reading-tool separator required');
assert.match(css, /#gb-hl-fab:is\(:hover,:active,:focus-visible\)/,
  'no moving or painted library hover');
assert.match(css, /#npUEdgeToggle:is\(:hover,:focus-visible,:active\)/,
  'no giant circular hover on panel fold control');
assert.match(shell, /reader-pilot/, 'preview must be explicit opt-in');
assert.match(shell, /127\.0\.0\.1/, 'preview must bind to localhost');
assert.match(shell, /No production mutation/, 'draft-only safety banner required');
console.log('Reader W57 source/manifests/axis/pilot contracts: PASS (12 assets)');
