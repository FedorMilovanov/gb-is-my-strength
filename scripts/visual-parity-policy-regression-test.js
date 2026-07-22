#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'visual-parity-baseline.js');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'visual-parity.yml');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-visual-policy-'));

function write(name, value) {
  const file = path.join(temp, name);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return file;
}

function run(summary, baseline, extra = []) {
  const summaryFile = write(`summary-${Math.random()}.json`, summary);
  const baselineFile = write(`baseline-${Math.random()}.json`, baseline);
  return spawnSync(process.execPath, [SCRIPT, '--summary', summaryFile, '--baseline', baselineFile, ...extra], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

const nativeSummary = {
  routes: [{ route: '/native/', viewports: { desktop: { diffPct: 37.5 }, mobile: { diffPct: 52.25 } } }],
};
const nativeBaseline = {
  tolerancePct: 0.5,
  routeModes: {
    '/native/': {
      mode: 'native-contract',
      reason: 'The retired legacy document is not the production render owner.',
      requiredGuards: ['source-dist-contract', 'public-browser-matrix'],
    },
  },
  routes: { '/native/': { desktop: 0, mobile: 0 } },
};
const native = run(nativeSummary, nativeBaseline);
assert.strictEqual(native.status, 0, `native-contract must delegate instead of failing legacy diff:\n${native.stdout}\n${native.stderr}`);
assert.match(native.stdout, /native-contract; legacy diff is diagnostic only/);

const legacySummary = {
  routes: [{ route: '/legacy/', viewports: { desktop: { diffPct: 2 }, mobile: { diffPct: 0 } } }],
};
const legacyBaseline = { tolerancePct: 0.5, routes: { '/legacy/': { desktop: 0, mobile: 0 } } };
const legacy = run(legacySummary, legacyBaseline);
assert.strictEqual(legacy.status, 1, 'legacy-diff regression above baseline+tolerance must fail');
assert.match(`${legacy.stdout}\n${legacy.stderr}`, /2\.000% > baseline 0\.000%/);

const unknown = run(nativeSummary, {
  tolerancePct: 0.5,
  routeModes: { '/native/': { mode: 'silence-the-test' } },
  routes: { '/native/': { desktop: 0, mobile: 0 } },
});
assert.strictEqual(unknown.status, 1, 'unknown comparison mode must fail');
assert.match(`${unknown.stdout}\n${unknown.stderr}`, /unknown visual comparison mode/);

const newRoute = run(
  { routes: [{ route: '/new/', viewports: { desktop: { diffPct: 0 }, mobile: { diffPct: 0 } } }] },
  { tolerancePct: 0.5, routes: {} },
  ['--strict-new-routes'],
);
assert.strictEqual(newRoute.status, 1, '--strict-new-routes must make missing baselines blocking');
assert.match(`${newRoute.stdout}\n${newRoute.stderr}`, /no legacy-diff baseline entry/);

const updateWithoutApproval = run(nativeSummary, nativeBaseline, ['--update']);
assert.strictEqual(updateWithoutApproval.status, 2, 'baseline update must require explicit owner acknowledgement');
assert.match(`${updateWithoutApproval.stdout}\n${updateWithoutApproval.stderr}`, /OWNER_APPROVED=true/);

const workflow = fs.readFileSync(WORKFLOW, 'utf8');
assert.match(workflow, /visual-parity-screenshots\.js[\s\S]*?--warn-only[\s\S]*?visual-parity-baseline\.js/,
  'workflow must capture screenshots diagnostically before the policy verdict');
assert(!/threshold[^\n]*2(?:\.0)?/.test(workflow), 'workflow must not hide failures by globally raising the raw threshold');

fs.rmSync(temp, { recursive: true, force: true });
console.log('✅ Visual parity policy regression: native delegation, legacy failure, unknown-mode, strict-new-route and owner-update witnesses passed');
