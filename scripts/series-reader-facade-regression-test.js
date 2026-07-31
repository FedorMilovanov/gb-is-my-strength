#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { auditSeriesFragments } = require('./series-reader-fragment-audit');

const ROOT = path.resolve(__dirname, '..');
const FACADE = path.join(ROOT, 'src/components/article-pilots/_shared/series/SeriesReaderChrome.astro');
const DIST = path.join(ROOT, 'dist');
const IMPLEMENTATION_IMPORT = "import GillSeriesChrome from '../../gill-series/GillSeriesChrome.astro';";
const DIRECT_IMPORT_RE = /import\s+[A-Za-z_$][\w$]*\s+from\s+['"][^'"]*GillSeriesChrome\.astro['"]/;
const FACADE_IMPORT_RE = /import\s+SeriesReaderChrome\s+from\s+['"][^'"]*SeriesReaderChrome\.astro['"]/g;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const facade = fs.readFileSync(FACADE, 'utf8');
assert.ok(facade.includes(IMPLEMENTATION_IMPORT), 'façade must be the only implementation importer');
assert.ok(facade.includes('<GillSeriesChrome pageId={pageId} config={config}>'), 'façade must forward pageId/config');
assert.ok(facade.includes('<slot />'), 'façade must forward the default slot');
assert.equal(typeof auditSeriesFragments, 'function', 'series fragment audit must expose its reusable contract');

const sourceFiles = walk(path.join(ROOT, 'src')).filter((file) => /\.(?:astro|ts|tsx|js|jsx|mjs|cjs)$/.test(file));
const illegal = [];
let facadeImports = 0;
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (file !== FACADE && DIRECT_IMPORT_RE.test(text)) illegal.push(path.relative(ROOT, file));
  const matches = text.match(FACADE_IMPORT_RE);
  if (matches) facadeImports += matches.length;
}

assert.deepEqual(illegal, [], `direct GillSeriesChrome imports outside façade: ${illegal.join(', ')}`);
assert.ok(facadeImports >= 41, `expected at least 41 SeriesReaderChrome consumers, found ${facadeImports}`);

if (fs.existsSync(DIST)) {
  const report = auditSeriesFragments({ dist: DIST, failOnMissingDist: false });
  assert.equal(report.result, 'PASS', `rendered series fragment contract failed: ${report.errors.join('; ')}`);
}

console.log(`✅ series-reader-facade: ${facadeImports} consumers; implementation import isolated to façade; fragment audit registered`);
