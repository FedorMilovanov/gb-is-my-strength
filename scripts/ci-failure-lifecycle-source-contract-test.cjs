#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

function validate({ workflow, sharedGuard, diagnostic, contract }) {
  const problems = [];
  const must = (label, source, pattern) => {
    if (!pattern.test(source)) problems.push(label);
  };
  const mustNot = (label, source, pattern) => {
    if (pattern.test(source)) problems.push(label);
  };

  for (const name of [
    'Native Source Contract',
    'Route Registry Validators',
    'Metadata & IndexNow Readiness',
    'Search Manifest Policy',
    'Deploy Candidate Contract',
    'Deploy to GitHub Pages',
    'Deployment Witness Ledger',
    'Source Link Audit',
    'Runtime Interactive Audit',
    'Visual Parity Guard — pixel-diff',
    'Dist Strangler Dry Run',
    'Shared Files Guard',
    'Product to Research release witness',
  ]) {
    must(`workflow subscription missing: ${name}`, workflow, new RegExp(`- "${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  }

  must('workflow handles completed runs', workflow, /types:\s*\n\s*- completed/);
  must('actions read permission is explicit', workflow, /^  actions: read$/m);
  must('contents read permission is explicit', workflow, /^  contents: read$/m);
  mustNot('issues write permission is forbidden', workflow, /^\s*issues:\s*write\s*$/m);
  mustNot('pull request write permission is forbidden', workflow, /^\s*pull-requests:\s*write\s*$/m);
  mustNot('workflow must not publish issue receipts', workflow, /github\.rest\.issues\.|product-research-release-witness:v1|Publish durable Product to Research success receipt/);
  must('trusted default branch is selected', workflow, /repository\.default_branch/);
  must('diagnostic module is fetched through Contents API', workflow, /github\.rest\.repos\.getContent/);
  must('trusted diagnostic path is fixed', workflow, /path = 'scripts\/ci-failure-lifecycle\.cjs'/);
  mustNot('triggering branch is checked out or executed', workflow, /actions\/checkout|workflow_run\.head_sha[^\n]*ref:/);

  must('diagnostic lists exact jobs', diagnostic, /listJobsForWorkflowRun/);
  must('diagnostic lists exact artifacts', diagnostic, /listWorkflowRunArtifacts/);
  must('diagnostic reports failed steps', diagnostic, /Failed step/);
  must('diagnostic rejects external repository heads', diagnostic, /ignored-external-repository/);
  must('diagnostic is explicitly read-only', diagnostic, /recorded-read-only/);
  mustNot('diagnostic must never use Issues API', diagnostic, /github\.rest\.issues\./);
  mustNot('diagnostic must never create comments', diagnostic, /createComment/);
  mustNot('legacy lifecycle markers remain', diagnostic, /ci-failure-lifecycle:v1|ci-failure-state:v1/);
  mustNot('legacy issue lifecycle actions remain', diagnostic, /state_reason|issue_number|reconcileRetiredIdentities|reopened|recovered/);

  must('shared guard syntax-checks diagnostic', sharedGuard, /node --check scripts\/ci-failure-lifecycle\.cjs/);
  must('shared guard runs deterministic diagnostic contract', sharedGuard, /node scripts\/ci-failure-lifecycle-contract-test\.cjs/);
  must('shared guard runs source contract', sharedGuard, /node scripts\/ci-failure-lifecycle-source-contract-test\.cjs/);

  must('contract covers read-only failure evidence', contract, /Failure records exact job\/step evidence without repository writes/);
  must('contract covers non-failure suppression', contract, /Non-failure runs are ignored/);
  must('contract covers external repository suppression', contract, /External repository heads are ignored/);
  must('contract covers degraded evidence API behavior', contract, /Evidence API failure is non-fatal/);
  must('contract makes issue API a forbidden regression', contract, /Issue API is a forbidden regression/);

  return problems;
}

const sources = {
  workflow: read('.github/workflows/notify-on-failure.yml'),
  sharedGuard: read('.github/workflows/shared-files-guard.yml'),
  diagnostic: read('scripts/ci-failure-lifecycle.cjs'),
  contract: read('scripts/ci-failure-lifecycle-contract-test.cjs'),
};

const problems = validate(sources);
assert.deepEqual(problems, [], `Silent CI diagnostics source contract failed:\n- ${problems.join('\n- ')}`);

const mutations = [
  {
    label: 'issues write permission regression',
    key: 'workflow',
    mutate: (source) => source.replace('  contents: read\n', '  contents: read\n  issues: write\n'),
  },
  {
    label: 'workflow issue writer regression',
    key: 'workflow',
    mutate: (source) => `${source}\n# github.rest.issues.create\n`,
  },
  {
    label: 'diagnostic issue writer regression',
    key: 'diagnostic',
    mutate: (source) => `${source}\n// github.rest.issues.update\n`,
  },
  {
    label: 'jobs evidence removal',
    key: 'diagnostic',
    mutate: (source) => source.replace('listJobsForWorkflowRun', 'listJobs_REMOVED'),
  },
  {
    label: 'artifact evidence removal',
    key: 'diagnostic',
    mutate: (source) => source.replace('listWorkflowRunArtifacts', 'listArtifacts_REMOVED'),
  },
  {
    label: 'external repository boundary removal',
    key: 'diagnostic',
    mutate: (source) => source.replace("return { action: 'ignored-external-repository' };", "return { action: 'external-allowed' };"),
  },
  {
    label: 'deterministic contract removal',
    key: 'sharedGuard',
    mutate: (source) => source.replace('          node scripts/ci-failure-lifecycle-contract-test.cjs\n', ''),
  },
];

for (const mutation of mutations) {
  const mutated = { ...sources, [mutation.key]: mutation.mutate(sources[mutation.key]) };
  const found = validate(mutated);
  assert.ok(found.length > 0, `${mutation.label} must be rejected`);
}

console.log(`✅ Silent CI diagnostics source contract passed (${mutations.length} adversarial mutations)`);
