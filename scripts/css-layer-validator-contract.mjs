#!/usr/bin/env node
/**
 * Adversarial contract test for SYS-CSS-CASCADE-GOVERNANCE-NONENFORCING.
 *
 * Verifies:
 *   1. Live repository `css/site.css --ceiling=200` passes per-root baseline
 *      ratchets and explicitly separates baseline protection from the 80% target.
 *   2. Coverage regression below any governed root's `minLayeredPct` fails closed.
 *   3. `!important` ceiling breach (including `css/home.css` > 52) fails closed.
 *   4. Unregistered `css/*.css` file introducing `@layer` fails closed on discovery.
 *   5. Standalone fixture reaching >= 80% layered share prints full target pass.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VALIDATOR = path.join(ROOT, 'scripts', 'css-layer-validator.js');

function runValidator(args, cwd = ROOT) {
  return spawnSync(process.execPath, [VALIDATOR, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

function cloneGovernedCssFixture() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-css-layer-gov-'));
  const cssDir = path.join(tempRoot, 'css');
  fs.mkdirSync(cssDir, { recursive: true });
  for (const name of ['site.css', 'home.css', 'floating-cluster.css']) {
    fs.copyFileSync(path.join(ROOT, 'css', name), path.join(cssDir, name));
  }
  return tempRoot;
}

// 1. Live repo run separates baseline ratchet from 80% target and covers all 3 roots.
{
  const live = runValidator(['css/site.css', '--ceiling=200']);
  assert.equal(live.status, 0, `expected live CSS layer validator exit 0, got ${live.status}:\n${live.stdout}\n${live.stderr}`);
  assert.match(live.stdout, /CSS @layer project coverage: 3 file\(s\) — css\/site\.css, css\/home\.css, css\/floating-cluster\.css/);
  assert.match(live.stdout, /!important ceiling 52: OK/);
  assert.match(live.stdout, /!important ceiling 524: OK/);
  assert.match(live.stdout, /!important ceiling 200: OK/);
  assert.match(live.stdout, /BASELINE RATCHET PASSED/);
  assert.doesNotMatch(live.stdout, /✅ VALIDATION PASSED\s*$/m);
}

// 2. Negative fixture: layered coverage regression below baseline fails closed.
{
  const tempRoot = cloneGovernedCssFixture();
  try {
    const homePath = path.join(tempRoot, 'css', 'home.css');
    fs.appendFileSync(homePath, `\n${'.unlayered-regression-probe{color:inherit}\n'.repeat(600)}`, 'utf8');
    const regressed = runValidator(['css/site.css', `--project-root=${tempRoot}`]);
    assert.equal(regressed.status, 1, `expected coverage regression to fail with exit 1, got ${regressed.status}`);
    const combined = `${regressed.stdout}\n${regressed.stderr}`;
    assert.match(combined, /regressed below governed baseline ≥35\.4%/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

// 3. Negative fixture: !important ceiling breach on css/home.css (previously uncapped) fails closed.
{
  const tempRoot = cloneGovernedCssFixture();
  try {
    const homePath = path.join(tempRoot, 'css', 'home.css');
    // Keep layered ratio above baseline while adding 1 extra !important inside @layer components.
    const original = fs.readFileSync(homePath, 'utf8');
    const mutated = original.replace(/@layer\s+components\s*\{/, '@layer components {\n.ceiling-breach-probe{display:block!important}\n');
    assert.notEqual(mutated, original, 'expected @layer components block in home.css');
    fs.writeFileSync(homePath, mutated, 'utf8');
    const breached = runValidator(['css/site.css', `--project-root=${tempRoot}`]);
    assert.equal(breached.status, 1, `expected home.css !important breach to fail with exit 1, got ${breached.status}`);
    const combined = `${breached.stdout}\n${breached.stderr}`;
    assert.match(combined, /!important count 53 exceeds ceiling 52/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

// 4. Negative fixture: unregistered css/*.css file introducing @layer fails closed on discovery.
{
  const tempRoot = cloneGovernedCssFixture();
  try {
    fs.writeFileSync(
      path.join(tempRoot, 'css', 'rogue-layered.css'),
      '@layer reset, components;\n@layer components { .rogue { color: inherit; } }\n',
      'utf8'
    );
    const rogue = runValidator(['css/site.css', `--project-root=${tempRoot}`]);
    assert.equal(rogue.status, 1, `expected unregistered @layer root to fail with exit 1, got ${rogue.status}`);
    const combined = `${rogue.stdout}\n${rogue.stderr}`;
    assert.match(combined, /Ungoverned @layer root discovered without explicit baseline and !important ceiling: css\/rogue-layered\.css/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

// 5. Positive fixture: file meeting >=80% layered share and ceiling reports full target pass.
{
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-css-layer-target-'));
  try {
    const targetFile = path.join(tempRoot, 'fully-layered.css');
    fs.writeFileSync(
      targetFile,
      '@layer reset, base, components;\n' +
      '@layer reset { *, *::before, *::after { box-sizing: border-box; margin: 0; } }\n' +
      '@layer base { body { line-height: 1.6; color: #1c1917; background: #faf8f5; } }\n' +
      '@layer components { .card { padding: 16px; border-radius: 12px; border: 1px solid #d6d3d1; } }\n',
      'utf8'
    );
    const fullPass = runValidator([targetFile, '--single', '--ceiling=0', '--min-layered-pct=80']);
    assert.equal(fullPass.status, 0, `expected >=80% fixture to pass, got ${fullPass.status}:\n${fullPass.stdout}\n${fullPass.stderr}`);
    assert.match(fullPass.stdout, /✅ VALIDATION PASSED \(target ≥80% met\)/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

console.log('✅ CSS cascade governance contract: PASS (5 live + negative/positive adversarial checks)');
