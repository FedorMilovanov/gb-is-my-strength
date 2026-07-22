#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ASSET = 'js/nagornaya-bar-extras.js';
const COMPACT_COMPONENT = 'src/components/nagornaya/_shared/NagornayaCompactBottomBar.astro';
const COMPACT_IMPORT = "import NagornayaCompactBottomBar from '@/components/nagornaya/_shared/NagornayaCompactBottomBar.astro';";
const assetAbs = path.join(ROOT, ASSET);
const expectedHash = crypto.createHash('md5').update(fs.readFileSync(assetAbs)).digest('hex').slice(0, 8);

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function assertPageContract(rel) {
  const source = read(rel);
  const escaped = ASSET.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const refs = [...source.matchAll(new RegExp(`(?:\\.\\.\\/)*${escaped}\\?v=([a-f0-9]{8})`, 'g'))];
  assert.strictEqual(refs.length, 1, `${rel}: expected exactly one canonical ${ASSET} reference`);
  assert.strictEqual(refs[0][1], expectedHash, `${rel}: stale ${ASSET} revision`);
  assert(!source.includes(`${ASSET}?v=1`), `${rel}: legacy v=1 must never return`);

  const mobile = source.indexOf('nagornaya-mobile-toc.js');
  const bar = source.indexOf('nagornaya-bar-extras.js');
  const floating = source.indexOf('floating-cluster-controller.js');
  assert(mobile >= 0 && bar > mobile && floating > bar,
    `${rel}: required order is mobile-toc -> bar-extras -> floating-cluster`);
}

function assertCompactFooterContract(rel) {
  const source = read(rel);
  assert(source.includes(COMPACT_IMPORT), `${rel}: compact bottom-bar component import is missing`);
  assert(source.includes('<NagornayaCompactBottomBar />'), `${rel}: compact bottom-bar component mount is missing`);
}

const compact = read(COMPACT_COMPONENT);
assert.match(compact, /@media\s*\(max-width:\s*359px\)/, `${COMPACT_COMPONENT}: 320px media contract is missing`);
for (const selector of ['.bar-progress', '.bar-divider', '#barUpBtn', '#barShareBtn']) {
  assert(compact.includes(selector), `${COMPACT_COMPONENT}: compact priority rule is missing ${selector}`);
}
assert.match(compact, /#main-content \.group > \.flex > h2[\s\S]*?min-width:\s*0/, `${COMPACT_COMPONENT}: long flex headings must be shrinkable`);
assert.match(compact, /#main-content \.group > \.flex > h2[\s\S]*?overflow-wrap:\s*anywhere/, `${COMPACT_COMPONENT}: long section headings need a narrow-screen wrap fallback`);
assert.match(compact, /\.nag-bar-controls[\s\S]*?padding:\s*0\s*!important/, `${COMPACT_COMPONENT}: cloned controls must shed sidebar padding`);
assert.match(compact, /\.gb-ember-expand[\s\S]*?position:\s*fixed\s*!important/, `${COMPACT_COMPONENT}: narrow speed sheet must be viewport-fixed`);
assert.match(compact, /\.gb-ember-expand[\s\S]*?left:[\s\S]*?right:/, `${COMPACT_COMPONENT}: narrow speed sheet must be bounded on both viewport edges`);
assert.match(compact, /\.gb-ember-expand[\s\S]*?transform:\s*none\s*!important/, `${COMPACT_COMPONENT}: narrow speed sheet must cancel the desktop centering transform`);

for (let part = 1; part <= 5; part += 1) {
  const footer = `src/components/nagornaya/chast-${part}/NagornayaChast${part}PageFooter.astro`;
  assertPageContract(footer);
  assertCompactFooterContract(footer);
  assertPageContract(`nagornaya/chast-${part}/index.html`);
}

const adversarial = path.join(ROOT, 'src', '__nagornaya_bar_revision_adversarial.astro');
try {
  fs.writeFileSync(adversarial, '<script src="/js/nagornaya-bar-extras.js?v=1"></script>\n');
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts/cache-bust.js')], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  assert.notStrictEqual(result.status, 0, 'cache-bust must reject arbitrary stale Astro revisions');
  assert(output.includes('src/__nagornaya_bar_revision_adversarial.astro'),
    'cache-bust negative witness must identify the adversarial Astro source');
} finally {
  fs.rmSync(adversarial, { force: true });
}

const clean = spawnSync(process.execPath, [path.join(ROOT, 'scripts/cache-bust.js')], {
  cwd: ROOT,
  encoding: 'utf8',
});
assert.strictEqual(clean.status, 0, `clean cache-bust failed:\n${clean.stdout}\n${clean.stderr}`);

console.log(`✅ Nagornaya bar asset contract: 10 page sources, revision ${expectedHash}, shared <=359px heading, priority and speed-sheet contracts, adversarial v=1 rejected`);
