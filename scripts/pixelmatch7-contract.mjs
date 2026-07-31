import assert from 'node:assert/strict';
import fs from 'node:fs';
import pixelmatch from 'pixelmatch';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
assert.equal(pkg.devDependencies?.pixelmatch, '^7.2.0');
assert.equal(lock.packages?.['node_modules/pixelmatch']?.version, '7.2.0');

const harness = fs.readFileSync('scripts/visual-parity-screenshots.js', 'utf8');
assert.doesNotMatch(harness, /require\(['"]pixelmatch['"]\)/,
  'Pixelmatch 7 must not be loaded through CommonJS require');
assert.match(harness, /await import\(['"]pixelmatch['"]\)/,
  'the CommonJS harness must use a controlled dynamic import');
assert.match(harness, /checkerboard:\s*false/,
  'existing visual baselines require pre-v7 white alpha blending');

const transparentBlack = new Uint8Array([0, 0, 0, 0]);
const opaqueWhite = new Uint8Array([255, 255, 255, 255]);
const legacyOutput = new Uint8Array(4);
const modernOutput = new Uint8Array(4);

const legacyLike = pixelmatch(
  transparentBlack,
  opaqueWhite,
  legacyOutput,
  1,
  1,
  { threshold: 0.1, checkerboard: false },
);
const modernDefault = pixelmatch(
  transparentBlack,
  opaqueWhite,
  modernOutput,
  1,
  1,
  { threshold: 0.1, checkerboard: true },
);

assert.equal(legacyLike, 0,
  'checkerboard:false must preserve the v5 transparent-vs-white result');
assert.equal(modernDefault, 1,
  'the contract fixture must prove that v7 default semantics differ');

console.log('PIXELMATCH 7 ESM AND ALPHA CONTRACT: PASS');
