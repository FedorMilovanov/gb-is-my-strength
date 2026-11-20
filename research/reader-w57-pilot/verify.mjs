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
const annotations = readFileSync(join(root, 'assets', 'reader_w57_annotations.js'), 'utf8');
const shell = readFileSync(join(root, 'preview.py'), 'utf8');
const preview = readFileSync(join(root, 'assets', 'reader_universal_preview.js'), 'utf8');
assert.match(preview, /const initiallyFolded=previewPanel!=='open'/,
  'right research panel must start folded on desktop by default');
assert.match(preview, /const previewPanel=new URLSearchParams\(location\.search\)\.get\('panel'\)/,
  'explicit preview-state deep link owner required');
assert.match(preview, /let manualRightChoice=!isMobile\(\)&&\['open','closed'\]\.includes\(previewPanel\)/,
  'panel=open/closed deep links must override width defaults on desktop');

assert.match(css, /W57 VISUAL CLOSURE 2026-11-20/, 'source alignment wave absent');
assert.match(css, /premium left reading settings/, 'left settings popup missing');
assert.doesNotMatch(js, /npW57ReadingDetails|fontPanel\.addEventListener\('click'/, 'no second settings owner/right card');
assert.doesNotMatch(preview, /fontPanel\.closest\('#npW57ReadingDetails'\)/, 'left Escape/outside close must be operative');
assert.match(preview, /data-np-u-type-width="narrow"/, 'narrow width missing');
assert.match(js, /width:v\.measure==='narrow'\?'narrow'/, 'narrow persisted state mismatches');
assert.match(preview, /one top-level right research card at a time/, 'exclusive right cards missing');
assert.match(preview, /openResearchForAnnotation\(\)/,'right research owner must expose opening action');
assert.match(preview, /positionFontPanel\(\)/, 'font popup must have breakpoint-aware modal ownership');
assert.match(preview, /querySelector\('#npUOutline'\):root/, 'mobile TOC dialog must contain its focused popup');
assert.doesNotMatch(preview, /root\.append\(fontPanel\)/, 'no unconditional out-of-modal popup');
assert.match(preview, /closeResearchForAnnotation\(\)/,'right research owner must expose closing action');
assert.match(css, /np-w57-note-actions/, 'note cancel/confirm row missing');
assert.match(css, /np-w57-note-preview-text/, 'linked note preview style missing');
assert.match(annotations, /const existingNote=linkedNote\(record\)/, 'saved notes must be shown next to their excerpts');
assert.ok(annotations.includes('repaint();\n      say(result.message);'), 'successful note changes must refresh immediately');
assert.match(annotations, /Мягкий лаймовый/, 'palette label must describe toned-down citron');
assert.ok(preview.includes('event.preventDefault();event.stopImmediatePropagation();'),
  'Escape must only dismiss the settings popup, without closing mobile TOC');
assert.ok(preview.includes("if(event.key==='Tab'){"),
  'Tab must remain in the active settings popup');
assert.ok(preview.includes('if(isMobile()&&!fontPanel.hidden)setFontOpen(false);'),
  'Mobile panel close must not leave the settings popup visible');
assert.match(css, /right:calc\(5vw - 2px\)!important/,
  'fold SVG and Library use the same right edge as the 40px reading toolbar');
assert.doesNotMatch(css, /left:calc\(var\(--np-w57-axis-x/,
  'do not mix vw-based left position with right-aligned native controls');
assert.doesNotMatch(js, /setProperty\('--np-w57-axis-x'/,
  'no obsolete JS left-axis that ignores classic vertical scrollbar width');
assert.doesNotMatch(js, /ResizeObserver\(schedule\)/, 'avoid per-frame toggle-derived geometry');
assert.match(css, /W57 MOBILE LIBRARY PLAIN SVG 2026-11-20/, 'unframed mobile book required');
assert.match(css, /W57 mobile FAB source specificity: 2026-11-20/, 'two-ID legacy mobile plate must be overridden');
assert.match(css, /W57 SINGLE COLUMN 2026-11-20/, 'fold button and divider must share reading actions axis');
assert.match(css, /W57 SERIES PLAY ON-AXIS 2026-11-20/, 'series Play circle must be centered in 40px rail');
assert.match(css, /gbs-rail-playwrap\s*>\s*\.gb-ember-wrap\s*>\s*\.gb-ember\.gbs-rail-ember\s*\{\s*left:4px!important;/, '32px Play circle should offset 4px inside 40px rail');
assert.match(css, /#npURightEdgeRail::after/, 'fold/reading-tool separator required');
assert.match(css, /#gb-hl-fab:is\(:hover,:active,:focus-visible\)/,
  'no moving or painted library hover');
assert.match(css, /#npUEdgeToggle:is\(:hover,:focus-visible,:active\)/,
  'no giant circular hover on panel fold control');
assert.match(shell, /reader-pilot/, 'preview must be explicit opt-in');
assert.match(shell, /127\.0\.0\.1/, 'preview must bind to localhost');
assert.match(shell, /No production mutation/, 'draft-only safety banner required');
await import(new URL('../../scripts/reader-w57-annotations-regression-test.mjs', import.meta.url));
console.log('Reader W57 source/manifests/axis/pilot and annotation contracts: PASS (12 assets)');
