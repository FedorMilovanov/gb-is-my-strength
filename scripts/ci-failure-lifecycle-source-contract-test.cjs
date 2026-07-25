#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

function validate({ workflow, sharedGuard, notifier, contract }) {
  const problems = [];
  const must = (label, source, pattern) => {
    if (!pattern.test(source)) problems.push(label);
  };
  const mustNot = (label, source, pattern) => {
    if (pattern.test(source)) problems.push(label);
  };

  must('readiness gateway is subscribed', workflow, /- "Metadata & IndexNow Readiness"/);
  must('deploy workflow is subscribed', workflow, /- "Deploy to GitHub Pages"/);
  mustNot('stale standalone IndexNow workflow subscription remains', workflow, /IndexNow — Notify Search Engines/);
  must('workflow handles every completed conclusion', workflow, /types:\s*\n\s*- completed/);
  mustNot('workflow still runs only on failure', workflow, /conclusion\s*==\s*['"]failure['"]/);
  must('actions read permission is explicit', workflow, /^  actions: read$/m);
  must('contents read permission is explicit', workflow, /^  contents: read$/m);
  must('issues write permission is explicit', workflow, /^  issues: write$/m);
  must('lifecycle concurrency is non-cancelling', workflow, /cancel-in-progress:\s*false/);
  must('trusted default branch is selected', workflow, /repository\.default_branch/);
  must('notifier is fetched through Contents API', workflow, /github\.rest\.repos\.getContent/);
  must('trusted notifier path is fixed', workflow, /path = 'scripts\/ci-failure-lifecycle\.cjs'/);
  mustNot('triggering branch is checked out or executed', workflow, /actions\/checkout|workflow_run\.head_sha[^\n]*ref:/);
  mustNot('fake route-impact downloader remains', workflow, /route-impact|route_impact_data|actions\/artifacts\/.*\/zip/);
  mustNot('commit-message route guessing remains', workflow, /affectedHint|commitMsg\.toLowerCase|Подозреваемые route/);
  mustNot('hardcoded root-cause guess remains', workflow, /Вероятно|Диагноз:|copy-legacy|DOM-структура/);

  must('notifier lists exact jobs', notifier, /listJobsForWorkflowRun/);
  must('notifier lists exact artifacts', notifier, /listWorkflowRunArtifacts/);
  must('notifier uses machine lifecycle marker', notifier, /ci-failure-lifecycle:v1/);
  must('notifier stores machine state', notifier, /ci-failure-state:v1/);
  must('notifier separates workflow identity', notifier, /workflowIdentity/);
  must('notifier closes recovered issue as completed', notifier, /state_reason:\s*'completed'/);
  must('notifier rejects external repository heads', notifier, /ignored-external-repository/);
  must('notifier refuses ambiguous duplicate markers', notifier, /Ambiguous CI lifecycle state/);
  mustNot('notifier infers routes from commit message', notifier, /affectedHint|msg\.includes\(|Подозреваемые route/);

  must('shared guard syntax-checks notifier', sharedGuard, /node --check scripts\/ci-failure-lifecycle\.cjs/);
  must('shared guard runs deterministic lifecycle contract', sharedGuard, /node scripts\/ci-failure-lifecycle-contract-test\.cjs/);
  must('shared guard runs source contract', sharedGuard, /node scripts\/ci-failure-lifecycle-source-contract-test\.cjs/);

  must('contract covers failure creation', contract, /Failure creates exactly one lifecycle issue/);
  must('contract covers repeated failure update', contract, /newer failure updates the same issue/);
  must('contract covers branch separation', contract, /different branch has a different lifecycle key/);
  must('contract covers cancelled runs', contract, /Cancelled\/superseded runs never create false failure alerts/);
  must('contract covers stale success', contract, /older success cannot close a newer failure/);
  must('contract covers recovery', contract, /newer success closes the issue/);
  must('contract covers factual failed steps', contract, /Evidence comes from job data/);
  must('contract covers route-impact omission', contract, /Route-impact is explicitly omitted rather than faked/);

  return problems;
}

const sources = {
  workflow: read('.github/workflows/notify-on-failure.yml'),
  sharedGuard: read('.github/workflows/shared-files-guard.yml'),
  notifier: read('scripts/ci-failure-lifecycle.cjs'),
  contract: read('scripts/ci-failure-lifecycle-contract-test.cjs'),
};

const problems = validate(sources);
assert.deepEqual(problems, [], `CI failure lifecycle source contract failed:\n- ${problems.join('\n- ')}`);

const mutations = [
  {
    label: 'readiness subscription removal',
    key: 'workflow',
    mutate: (source) => source.replace('      - "Metadata & IndexNow Readiness"\n', ''),
  },
  {
    label: 'failure-only job regression',
    key: 'workflow',
    mutate: (source) => source.replace('    runs-on: ubuntu-latest', "    if: github.event.workflow_run.conclusion == 'failure'\n    runs-on: ubuntu-latest"),
  },
  {
    label: 'untrusted checkout regression',
    key: 'workflow',
    mutate: (source) => source.replace('    steps:\n', '    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.workflow_run.head_sha }}\n'),
  },
  {
    label: 'recovery state reason removal',
    key: 'notifier',
    mutate: (source) => source.replace("    state_reason: 'completed',\n", ''),
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

console.log(`✅ CI failure lifecycle source contract passed (${mutations.length} adversarial mutations)`);
