'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const workflow = fs.readFileSync('.github/workflows/notify-on-failure.yml', 'utf8');
const implementation = fs.readFileSync('scripts/ci-failure-lifecycle.cjs', 'utf8');
const contract = fs.readFileSync('scripts/ci-failure-lifecycle-contract-test.cjs', 'utf8');

for (const name of [
  'Metadata & IndexNow Readiness',
  'Deploy to GitHub Pages',
  'Deployment Witness Ledger',
  'Source Link Audit',
  'Runtime Interactive Audit',
  'Visual Parity Guard — pixel-diff',
  'Dist Strangler Dry Run',
  'Shared Files Guard',
]) {
  assert.ok(workflow.includes(`- "${name}"`), `notifier must listen to ${name}`);
}

assert.ok(!workflow.includes('IndexNow — Notify Search Engines'), 'obsolete standalone IndexNow owner must not be watched');
assert.match(workflow, /pull_request:\s*\n\s*paths:/, 'PR contract trigger is required');
assert.match(workflow, /^permissions:\s*\n\s+contents:\s*read\s*$/m, 'top-level permissions must be explicit and read-only');
assert.match(workflow, /contract:\s*\n/, 'workflow must have a read-only contract job');
assert.match(workflow, /lifecycle:\s*\n/, 'workflow must have a lifecycle job');
assert.match(workflow, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/, 'privileged lifecycle must execute trusted default-branch code');
assert.match(workflow, /persist-credentials: false/, 'privileged checkout must not persist credentials');
assert.match(workflow, /actions: read/, 'lifecycle requires read-only Actions evidence');
assert.match(workflow, /issues: write/, 'lifecycle issue transition permission is explicit');
assert.match(workflow, /require\('\.\/scripts\/ci-failure-lifecycle\.cjs'\)/, 'workflow must delegate to tested module');
assert.ok(!workflow.includes("conclusion == 'failure'"), 'workflow must receive successes for recovery');
assert.ok(!workflow.includes('curl '), 'workflow must not fake artifact retrieval with shell token parsing');
assert.ok(!workflow.toLowerCase().includes('route-impact'), 'route impact must be parsed genuinely or omitted');
assert.ok(!workflow.includes('copy-legacy-to-dist.js'), 'workflow-specific guessed diagnosis is forbidden');
assert.ok(!workflow.includes('affectedHint'), 'commit-message route guessing is forbidden');

for (const pattern of [
  /state: 'all'/,
  /listJobsForWorkflowRun/,
  /listWorkflowRunArtifacts/,
  /ci-failure-key:v2:/,
  /ci-failure-state:v2:/,
  /compareRuns/,
  /state_reason: 'completed'/,
  /No root cause is inferred/,
  /multiple lifecycle issues/,
]) {
  assert.match(implementation, pattern);
}
assert.ok(!implementation.includes('copy-legacy'), 'implementation must not guess deploy root cause');
assert.ok(!implementation.toLowerCase().includes('route-impact'), 'implementation must not claim fake route impact');

for (const phrase of [
  'failure creates one issue',
  'newer failure updates the same machine-key issue',
  'different workflow/branch identity does not collapse',
  'cancelled run creates no false alert',
  'older success cannot close newer failure',
  'newer success closes alert',
  'older failure after recovery is ignored',
  'newer failure reopens the same lifecycle issue',
  'failed step comes from job data',
  'fake route-impact claim is absent',
  'ambiguous machine identity fails closed',
]) {
  assert.ok(contract.includes(phrase), `fixture must prove: ${phrase}`);
}

console.log('CI FAILURE LIFECYCLE SOURCE CONTRACT: PASS');
