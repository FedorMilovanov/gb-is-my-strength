import fs from 'node:fs';

const harnessPath = 'scripts/visual-parity-screenshots.js';
let source = fs.readFileSync(harnessPath, 'utf8');

const requireLine = "const pixelmatch = require('pixelmatch');";
if (!source.includes(requireLine)) {
  throw new Error('expected CommonJS pixelmatch import was not found');
}
source = source.replace(requireLine,
  "// Pixelmatch 6+ is ESM; load it once inside the existing async main.\nlet pixelmatch;");

const mainStart = "(async () => {\n  console.log(`[visual-parity] Starting at ${new Date().toISOString()}`);";
if (!source.includes(mainStart)) {
  throw new Error('visual parity async main anchor was not found');
}
source = source.replace(mainStart,
  "(async () => {\n  ({ default: pixelmatch } = await import('pixelmatch'));\n  console.log(`[visual-parity] Starting at ${new Date().toISOString()}`);");

const optionsAnchor = "    diffMask: false,\n  });";
if (!source.includes(optionsAnchor)) {
  throw new Error('pixelmatch options anchor was not found');
}
source = source.replace(optionsAnchor,
  "    diffMask: false,\n    // Preserve the v5 white-background alpha semantics for existing baselines.\n    checkerboard: false,\n  });");
fs.writeFileSync(harnessPath, source);

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.scripts ||= {};
pkg.scripts['visual:pixelmatch:contract'] = 'node scripts/pixelmatch7-contract.mjs';
fs.writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);

fs.writeFileSync('scripts/pixelmatch7-contract.mjs', `import assert from 'node:assert/strict';
import fs from 'node:fs';
import pixelmatch from 'pixelmatch';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
assert.equal(pkg.devDependencies?.pixelmatch, '^7.2.0');
assert.equal(lock.packages?.['node_modules/pixelmatch']?.version, '7.2.0');

const harness = fs.readFileSync('scripts/visual-parity-screenshots.js', 'utf8');
assert.doesNotMatch(harness, /require\\(['\"]pixelmatch['\"]\\)/,
  'Pixelmatch 7 must not be loaded through CommonJS require');
assert.match(harness, /await import\\(['\"]pixelmatch['\"]\\)/,
  'the CommonJS harness must use a controlled dynamic import');
assert.match(harness, /checkerboard:\\s*false/,
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
  'the fixture must prove that v7 default semantics differ');

console.log('PIXELMATCH 7 ESM AND ALPHA CONTRACT: PASS');
`);

fs.mkdirSync('docs/dependency-migrations', { recursive: true });
fs.writeFileSync('docs/dependency-migrations/PIXELMATCH_7.md', `# Pixelmatch 7 migration

Pixelmatch 6 and newer are ESM-only. The existing CommonJS screenshot harness
therefore loads Pixelmatch through one controlled dynamic import inside its
existing async main function.

Pixelmatch 7 changes semi-transparent pixel comparison by blending against a
checkerboard by default. This lane explicitly sets \`checkerboard: false\` to
preserve measurements and owner-approved baselines produced by Pixelmatch 5.
A later baseline-policy change must be a separate visual decision, never an
incidental dependency update.

\`npm run visual:pixelmatch:contract\` verifies the package, import path,
explicit option and a one-pixel fixture proving the semantic difference.
`);

console.log('Pixelmatch 7 compatibility files written.');
