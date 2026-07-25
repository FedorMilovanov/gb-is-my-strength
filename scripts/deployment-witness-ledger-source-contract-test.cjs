'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

function validate({ deploy, ledger, workflow, recorder }) {
  const problems = [];
  const checks = [
    ['deploy keeps contents read', deploy, /^  contents: read\s+# читаем репозиторий$/m],
    ['deploy keeps Pages write', deploy, /^  pages: write\s+# заливаем артефакт на Pages$/m],
    ['deploy keeps OIDC write', deploy, /^  id-token: write\s+# OIDC-токен для actions\/deploy-pages$/m],
    ['deploy evidence upload remains diagnostic', deploy, /- name: Upload live TTS deployment evidence[\s\S]{0,100}if: always\(\)/],
    ['deploy evidence upload fails when report is absent', deploy, /name: tts-live-deployment-\$\{\{ github\.run_id \}\}[\s\S]{0,180}if-no-files-found: error/],
    ['ledger triggers completed deploy workflow', ledger, /workflow_run:[\s\S]{0,120}workflows: \["Deploy to GitHub Pages"\][\s\S]{0,80}types: \[completed\]/],
    ['ledger has actions read', ledger, /^  actions: read\s+# читаем exact-run artifact metadata and bytes$/m],
    ['ledger has contents read', ledger, /^  contents: read\s+# checkout trusted recorder from the deployed main SHA$/m],
    ['ledger owns issue projection', ledger, /^  issues: write\s+# comment\/close only a full-SHA machine-marked issue$/m],
    ['ledger has PR lookup read', ledger, /^  pull-requests: read\s+# locate the PR whose merge SHA exactly matches deployment$/m],
    ['ledger requires successful deploy', ledger, /workflow_run\.conclusion == 'success'/],
    ['ledger requires main branch', ledger, /workflow_run\.head_branch == 'main'/],
    ['ledger requires same repository', ledger, /workflow_run\.head_repository\.full_name == github\.repository/],
    ['ledger checks out exact deployed SHA', ledger, /ref: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/],
    ['ledger checkout drops credentials', ledger, /persist-credentials: false/],
    ['ledger downloads exact run artifact', ledger, /name: tts-live-deployment-\$\{\{ github\.event\.workflow_run\.id \}\}/],
    ['ledger downloads into runner temp', ledger, /path: \$\{\{ runner\.temp \}\}\/deployment-witness/],
    ['ledger pins triggering run ID', ledger, /run-id: \$\{\{ github\.event\.workflow_run\.id \}\}/],
    ['ledger supplies scoped token', ledger, /github-token: \$\{\{ github\.token \}\}/],
    ['ledger invokes trusted recorder', ledger, /require\('\.\/scripts\/record-deployment-witness\.cjs'\)/],
    ['recorder lists exact-run artifacts', recorder, /actions\.listWorkflowRunArtifacts/],
    ['recorder requires exactly one named artifact', recorder, /matchingArtifacts\.length, 1/],
    ['recorder rejects expired artifact', recorder, /artifact\.expired, false/],
    ['recorder requires artifact ID and bytes', recorder, /artifact ID is missing[\s\S]*artifact is empty/],
    ['recorder requires SHA-256 artifact digest', recorder, /assert\.match\(normalize\(artifact\.digest\), DIGEST_RE,[\s\S]{0,100}artifact digest is missing or invalid/],
    ['recorder verifies downloaded report PASS', recorder, /report\.result, 'PASS'/],
    ['recorder verifies report SHA and run attempt', recorder, /report\.deployedSha, sha[\s\S]*report\.workflowRunAttempt, runAttempt/],
    ['recorder builds generic envelope', recorder, /kind: 'deployment-capability-witness'[\s\S]*witnessArtifact:[\s\S]*extensions:[\s\S]*tts:/],
    ['recorder uses full-SHA issue marker', recorder, /deployment-witness-target:tts:\$\{sha\}/],
    ['recorder targets marker in issue body', recorder, /normalize\(issue\.body\)\.includes\(issueTargetMarker\)/],
    ['recorder uses exact merge SHA', recorder, /normalize\(pull\.merge_commit_sha\)\.toLowerCase\(\) === sha/],
    ['recorder labels capability scope', recorder, /TTS capability witness accepted/],
    ['recorder states whole-artifact limitation', recorder, /does not claim whole-Pages release-artifact identity/],
    ['workflow owns recorder source', workflow, /scripts\/record-deployment-witness\.cjs/],
    ['workflow owns recorder unit contract', workflow, /scripts\/record-deployment-witness-contract-test\.cjs/],
    ['workflow owns ledger source contract', workflow, /scripts\/deployment-witness-ledger-source-contract-test\.cjs/],
    ['workflow owns ledger workflow', workflow, /\.github\/workflows\/deployment-witness-ledger\.yml/],
    ['workflow executes recorder unit contract', workflow, /node scripts\/record-deployment-witness-contract-test\.cjs/],
    ['workflow executes ledger source contract', workflow, /node scripts\/deployment-witness-ledger-source-contract-test\.cjs/],
    ['workflow lints ledger workflow', workflow, /run-actionlint\.mjs -no-color \.github\/workflows\/deployment-witness-ledger\.yml/],
  ];

  for (const [label, source, pattern] of checks) {
    if (!pattern.test(source)) problems.push(label);
  }

  if (/^  issues:\s*write/m.test(deploy)) problems.push('deploy owns issue write permission');
  if (/^  pull-requests:\s*read/m.test(deploy)) problems.push('deploy owns PR read permission');
  if (/Record live deployment acceptance|record-live-deployment-acceptance/.test(deploy)) problems.push('deploy still records repository acceptance');
  if (/Production deployment accepted/.test(recorder)) problems.push('recorder overclaims global production acceptance');
  if (/exactAcceptanceTitle|issue\.title ===/.test(recorder)) problems.push('recorder targets mutable human issue title');
  if (fs.existsSync(path.join(ROOT, 'scripts/record-live-deployment-acceptance.cjs'))) problems.push('obsolete in-deploy recorder remains');
  if (fs.existsSync(path.join(ROOT, 'scripts/record-live-deployment-acceptance-contract-test.cjs'))) problems.push('obsolete in-deploy recorder test remains');

  for (const ownedPath of [
    'scripts/record-deployment-witness.cjs',
    'scripts/record-deployment-witness-contract-test.cjs',
    'scripts/deployment-witness-ledger-source-contract-test.cjs',
    '.github/workflows/deployment-witness-ledger.yml',
  ]) {
    const escaped = ownedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const count = (workflow.match(new RegExp(`^      - "${escaped}"$`, 'gm')) || []).length;
    if (count !== 2) problems.push(`workflow ownership drift: ${ownedPath} (${count}/2)`);
  }

  return problems;
}

const sources = {
  deploy: read('.github/workflows/deploy.yml'),
  ledger: read('.github/workflows/deployment-witness-ledger.yml'),
  workflow: read('.github/workflows/tts-download-consent.yml'),
  recorder: read('scripts/record-deployment-witness.cjs'),
};

assert.deepEqual(validate(sources), []);

const mutations = [
  ['deploy issue permission reintroduced', { ...sources, deploy: sources.deploy.replace('  pages: write', '  issues: write\n  pages: write') }],
  ['deploy evidence absence downgraded', { ...sources, deploy: sources.deploy.replace('if-no-files-found: error', 'if-no-files-found: warn') }],
  ['ledger success gate removed', { ...sources, ledger: sources.ledger.replace("github.event.workflow_run.conclusion == 'success' &&\n", '') }],
  ['ledger main gate removed', { ...sources, ledger: sources.ledger.replace("github.event.workflow_run.head_branch == 'main' &&\n", '') }],
  ['ledger same-repo gate removed', { ...sources, ledger: sources.ledger.replace('github.event.workflow_run.head_repository.full_name == github.repository', 'true') }],
  ['ledger artifact name flattened', { ...sources, ledger: sources.ledger.replace('tts-live-deployment-${{ github.event.workflow_run.id }}', 'tts-live-deployment-latest') }],
  ['ledger run ID unpinned', { ...sources, ledger: sources.ledger.replace('run-id: ${{ github.event.workflow_run.id }}', 'run-id: ${{ github.run_id }}') }],
  ['ledger artifact extracted into workspace', { ...sources, ledger: sources.ledger.replace('${{ runner.temp }}/deployment-witness', './deployment-witness') }],
  ['recorder artifact uniqueness bypassed', { ...sources, recorder: sources.recorder.replace('matchingArtifacts.length, 1', '1, 1') }],
  ['recorder digest validation removed', { ...sources, recorder: sources.recorder.replace('assert.match(normalize(artifact.digest), DIGEST_RE', 'assert.match("sha256:" + "a".repeat(64), DIGEST_RE') }],
  ['recorder report PASS validation removed', { ...sources, recorder: sources.recorder.replace("assert.equal(report.result, 'PASS'", "assert.equal('PASS', 'PASS'") }],
  ['recorder issue marker shortened', { ...sources, recorder: sources.recorder.replace('deployment-witness-target:tts:${sha}', 'deployment-witness-target:tts:${sha.slice(0, 7)}') }],
  ['recorder global acceptance overclaim', { ...sources, recorder: sources.recorder.replace('TTS capability witness accepted', 'Production deployment accepted') }],
  ['workflow ledger ownership removed', { ...sources, workflow: sources.workflow.replace(/^      - "\.github\/workflows\/deployment-witness-ledger\.yml"\n/gm, '') }],
  ['workflow source contract execution removed', { ...sources, workflow: sources.workflow.replace('node scripts/deployment-witness-ledger-source-contract-test.cjs', 'echo ledger source contract skipped') }],
];

for (const [name, mutated] of mutations) {
  assert.ok(validate(mutated).length > 0, `${name}: mutation must be rejected`);
}

console.log(`Deployment witness ledger source contract: PASS (${mutations.length} named adversarial mutations rejected).`);
