#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const ROOT = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function grep(args) {
  try { return cp.execFileSync('git', ['grep', ...args], { cwd: ROOT, encoding: 'utf8' }).trim(); }
  catch (error) { return error.status === 1 ? '' : (() => { throw error; })(); }
}
const legacy = grep(['-n', 'foliant-mark', '--', ':!docs/**', ':!scripts/editorial-dateline-contract-test.js']);
assert.equal(legacy, '', `legacy foliant-mark remains:\n${legacy}`);
const listed = grep(['-l', 'class="editorial-dateline"', '--', '*.html', '*.astro']);
assert.ok(listed, 'no editorial dateline markup found');
const files = listed.split(/\r?\n/).filter(Boolean);
let total = 0;
let htmlCount = 0;
let sourceCount = 0;
for (const rel of files) {
  const source = read(rel);
  const matches = [...source.matchAll(/<p class="editorial-dateline">([\s\S]*?)<\/p>/g)];
  assert.ok(matches.length > 0, `${rel}: dateline must use a semantic p element`);
  total += matches.length;
  if (rel.endsWith('.html')) htmlCount += matches.length;
  if (rel.endsWith('.astro')) sourceCount += matches.length;
  for (const match of matches) {
    assert.ok(!/<h[1-6]\b/i.test(match[1]), `${rel}: dateline may not contain a heading`);
    assert.ok(/editorial-dateline__(?:place|date)/.test(match[1]), `${rel}: dateline lacks structured metadata spans`);
  }
  assert.ok(!/class="editorial-dateline"[^>]*(?:role="heading"|aria-level=)/i.test(source), `${rel}: dateline was promoted to heading semantics`);
}
assert.ok(htmlCount >= 11, `expected published datelines, found ${htmlCount}`);
assert.ok(sourceCount >= 10, `expected canonical source datelines, found ${sourceCount}`);
assert.ok(total >= 21, `expected the full migrated corpus, found ${total}`);
const css = read('css/site.css');
const rule = css.match(/\.editorial-dateline\s*\{([\s\S]*?)\}/);
assert.ok(rule, 'editorial dateline CSS rule missing');
for (const forbidden of [/\bfloat\s*:/, /border-radius\s*:/, /box-shadow\s*:/, /position\s*:\s*(?:absolute|fixed)/]) {
  assert.ok(!forbidden.test(rule[1]), `editorial dateline regained card/float styling: ${forbidden}`);
}
assert.match(rule[1], /background\s*:\s*transparent/, 'dateline must not have a card background');
assert.match(rule[1], /font-size\s*:\s*clamp\(13px[^;]*15px\)/, 'dateline must stay typographically subordinate');
assert.match(rule[1], /break-after\s*:\s*avoid-page/, 'dateline must stay with following content in print');
assert.ok(!/\.editorial-dateline::before\s*\{[^}]*content\s*:\s*["'][^·"']/s.test(css), 'dateline may not introduce a visible label-heading');
const runtime = read('js/reader-preferences-head.js');
assert.match(runtime, /\.editorial-dateline/, 'print pagination runtime does not keep datelines with next content');
assert.ok(!runtime.includes('.foliant-mark'), 'runtime still contains the legacy selector');
console.log(`✅ Editorial dateline contract passed (${total} synchronized occurrences across ${files.length} files)`);
