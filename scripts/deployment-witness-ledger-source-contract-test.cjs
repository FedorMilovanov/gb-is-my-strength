'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const ACTION_PINS = Object.freeze({
  githubScript: 'actions/github-script@f28e40c7f34bde8b3046d885e986cb6290c5673b # v7',
  checkout: 'actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4',
  downloadArtifact: 'actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093 # v4',
});

const CONCURRENCY_GROUP = "group: deployment-witness-${{ github.event_name == 'workflow_run' && github.event.workflow_run.id || inputs.deploy_run_id }}";

function countLiteral(source, literal) {
  return source.split(literal).length - 1;
}

function resolveDeploymentWitnessConcurrency({ eventName, workflowRunId, deployRunId }) {
  const targetRunId = eventName === 'workflow_run' && workflowRunId || deployRunId;
  assert.match(String(targetRunId || ''), /^\d+$/, 'target deploy run ID must be numeric');
  return `deployment-witness-${targetRunId}`;
}

function validate({ deploy, ledger, workflow, recorder }) {
  const problems = [];
  const checks = [
    ['deploy keeps contents read', deploy, /^  contents: read\s+# читаем репозиторий$/m],
    ['deploy keeps Pages write', deploy, /^  pages: write\s+# заливаем артефакт на Pages$/m],
    ['deploy keeps OIDC write', deploy, /^  id-token: write\s+# OIDC-токен для actions\/deploy-pages$/m],
    ['deploy evidence upload remains diagnostic', deploy, /- name: Upload live TTS deployment evidence[\s\S]{0,120}if: always\(\)/],
    ['deploy evidence upload fails when report is absent', deploy, /name: tts-live-deployment-\$\{\{ github\.run_id \}\}[\s\S]{0,200}if-no-files-found: error/],

    ['ledger triggers completed deploy workflow', ledger, /workflow_run:[\s\S]{0,140}workflows: \["Deploy to GitHub Pages"\][\s\S]{0,100}types: \[completed\]/],
    ['ledger exposes explicit manual replay input', ledger, /workflow_dispatch:[\s\S]{0,180}deploy_run_id:[\s\S]{0,120}required: true/],
    ['ledger has actions read', ledger, /^  actions: read\s+# resolve and download the exact deploy-run artifact$/m],
    ['ledger has contents read', ledger, /^  contents: read\s+# checkout trusted recorder source$/m],
    ['ledger owns issue projection', ledger, /^  issues: write\s+# comment\/close only a full-SHA machine-marked issue$/m],
    ['ledger owns exact PR comment projection', ledger, /^  pull-requests: write\s+# comment the exact merged PR after verified deployment$/m],
    ['ledger serializes automatic and manual projection by target deploy run', ledger, /concurrency:\s*\n\s*group: deployment-witness-\$\{\{ github\.event_name == 'workflow_run' && github\.event\.workflow_run\.id \|\| inputs\.deploy_run_id \}\}/],
    ['ledger never cancels an evidence writer in progress', ledger, /concurrency:[\s\S]{0,180}cancel-in-progress: false/],

    ['automatic ledger requires successful deploy', ledger, /workflow_run\.conclusion == 'success'/],
    ['automatic ledger requires main branch', ledger, /workflow_run\.head_branch == 'main'/],
    ['automatic ledger requires same repository', ledger, /workflow_run\.head_repository\.full_name == github\.repository/],
    ['manual replay is restricted to main', ledger, /github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/],
    ['manual replay resolves run through Actions API', ledger, /actions\.getWorkflowRun/],
    ['resolved run ID is exact', ledger, /resolved deploy run ID mismatch/],
    ['resolved run must be Pages deploy', ledger, /workflowRun\.name, 'Deploy to GitHub Pages'/],
    ['resolved run must be completed', ledger, /workflowRun\.status, 'completed'/],
    ['resolved run must be successful', ledger, /workflowRun\.conclusion, 'success'/],
    ['resolved run must be main', ledger, /workflowRun\.head_branch, 'main'/],
    ['resolved run must be same repository', ledger, /requested deploy run belongs to a foreign repository/],
    ['resolved run must have exact SHA', ledger, /requested deploy run lacks an exact SHA/],
    ['manual replay executes current trusted recorder', ledger, /context\.eventName === 'workflow_dispatch' \? context\.sha : workflowRun\.head_sha/],

    ['ledger checkout uses resolved trusted ref', ledger, /ref: \$\{\{ steps\.resolve\.outputs\.recorder_ref \}\}/],
    ['ledger checkout drops credentials', ledger, /persist-credentials: false/],
    ['ledger downloads exact resolved artifact', ledger, /name: tts-live-deployment-\$\{\{ steps\.resolve\.outputs\.run_id \}\}/],
    ['ledger downloads into runner temp', ledger, /path: \$\{\{ runner\.temp \}\}\/deployment-witness/],
    ['ledger pins exact resolved run ID', ledger, /run-id: \$\{\{ steps\.resolve\.outputs\.run_id \}\}/],
    ['ledger supplies scoped token', ledger, /github-token: \$\{\{ github\.token \}\}/],
    ['run record is stored only in runner temp', ledger, /DEPLOYMENT_RUN_RECORD: \$\{\{ runner\.temp \}\}\/deployment-workflow-run\.json/],
    ['ledger invokes trusted recorder', ledger, /require\('\.\/scripts\/record-deployment-witness\.cjs'\)/],
    ['ledger passes resolved workflow run', ledger, /workflowRun,\s*\n\s*witnessDirectory:/],

    ['recorder lists exact-run artifacts', recorder, /actions\.listWorkflowRunArtifacts/],
    ['recorder requires exactly one named artifact', recorder, /matchingArtifacts\.length, 1/],
    ['recorder rejects expired artifact', recorder, /artifact\.expired, false/],
    ['recorder requires artifact ID and bytes', recorder, /artifact ID is missing[\s\S]*artifact is empty/],
    ['recorder requires SHA-256 artifact digest', recorder, /assert\.match\(normalize\(artifact\.digest\), DIGEST_RE,[\s\S]{0,120}artifact digest is missing or invalid/],
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

  if (countLiteral(ledger, CONCURRENCY_GROUP) !== 1) {
    problems.push(`ledger concurrency identity drift (${countLiteral(ledger, CONCURRENCY_GROUP)}/1)`);
  }
  if (countLiteral(ledger, ACTION_PINS.githubScript) !== 2) {
    problems.push(`ledger github-script pin drift (${countLiteral(ledger, ACTION_PINS.githubScript)}/2)`);
  }
  if (countLiteral(ledger, ACTION_PINS.checkout) !== 1) {
    problems.push(`ledger checkout pin drift (${countLiteral(ledger, ACTION_PINS.checkout)}/1)`);
  }
  if (countLiteral(ledger, ACTION_PINS.downloadArtifact) !== 1) {
    problems.push(`ledger download-artifact pin drift (${countLiteral(ledger, ACTION_PINS.downloadArtifact)}/1)`);
  }
  if (/uses:\s*actions\/(?:github-script|checkout|download-artifact)@v\d+/i.test(ledger)) {
    problems.push('privileged ledger uses a mutable action major tag');
  }

  if (/^  issues:\s*write/m.test(deploy)) problems.push('deploy owns issue write permission');
  if (/^  pull-requests:\s*(?:read|write)/m.test(deploy)) problems.push('deploy owns PR permission');
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
assert.equal(
  resolveDeploymentWitnessConcurrency({ eventName: 'workflow_run', workflowRunId: '30169443420' }),
  resolveDeploymentWitnessConcurrency({ eventName: 'workflow_dispatch', deployRunId: '30169443420' }),
  'automatic and manual entry paths must serialize on the same target deploy run',
);
assert.notEqual(
  resolveDeploymentWitnessConcurrency({ eventName: 'workflow_run', workflowRunId: '30169443420' }),
  resolveDeploymentWitnessConcurrency({ eventName: 'workflow_dispatch', deployRunId: '30169443421' }),
  'different target deploy runs must not share one writer lock',
);

const mutations = [
  ['deploy issue permission reintroduced', { ...sources, deploy: sources.deploy.replace('  pages: write', '  issues: write\n  pages: write') }],
  ['deploy evidence absence downgraded', { ...sources, deploy: sources.deploy.replace('if-no-files-found: error', 'if-no-files-found: warn') }],
  ['ledger PR projection downgraded to read', { ...sources, ledger: sources.ledger.replace('  pull-requests: write', '  pull-requests: read') }],
  ['ledger concurrency removed', { ...sources, ledger: sources.ledger.replace(/\nconcurrency:[\s\S]*?\n\njobs:/, '\n\njobs:') }],
  ['ledger concurrency cancellation enabled', { ...sources, ledger: sources.ledger.replace('  cancel-in-progress: false', '  cancel-in-progress: true') }],
  ['ledger manual replay lock detached from deploy run', { ...sources, ledger: sources.ledger.replace('inputs.deploy_run_id', 'github.run_id') }],
  ['github-script pin made mutable', { ...sources, ledger: sources.ledger.replaceAll(ACTION_PINS.githubScript, 'actions/github-script@v7') }],
  ['checkout pin made mutable', { ...sources, ledger: sources.ledger.replace(ACTION_PINS.checkout, 'actions/checkout@v4') }],
  ['download-artifact pin made mutable', { ...sources, ledger: sources.ledger.replace(ACTION_PINS.downloadArtifact, 'actions/download-artifact@v4') }],
  ['manual replay removed', { ...sources, ledger: sources.ledger.replace(/\n  workflow_dispatch:[\s\S]*?\n\npermissions:/, '\n\npermissions:') }],
  ['manual replay main guard removed', { ...sources, ledger: sources.ledger.replace("github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'", "github.event_name == 'workflow_dispatch'") }],
  ['manual replay run lookup bypassed', { ...sources, ledger: sources.ledger.replace('github.rest.actions.getWorkflowRun', 'Promise.resolve') }],
  ['resolved workflow identity check removed', { ...sources, ledger: sources.ledger.replace("assert.equal(workflowRun.name, 'Deploy to GitHub Pages'", "assert.equal('Deploy to GitHub Pages', 'Deploy to GitHub Pages'") }],
  ['resolved success check removed', { ...sources, ledger: sources.ledger.replace("assert.equal(workflowRun.conclusion, 'success'", "assert.equal('success', 'success'") }],
  ['resolved repository check removed', { ...sources, ledger: sources.ledger.replace('requested deploy run belongs to a foreign repository', 'repository unchecked') }],
  ['manual recorder trust downgraded', { ...sources, ledger: sources.ledger.replace("context.eventName === 'workflow_dispatch' ? context.sha : workflowRun.head_sha", 'workflowRun.head_sha') }],
  ['automatic success gate removed', { ...sources, ledger: sources.ledger.replace("github.event.workflow_run.conclusion == 'success' &&\n", '') }],
  ['automatic main gate removed', { ...sources, ledger: sources.ledger.replace("github.event.workflow_run.head_branch == 'main' &&\n", '') }],
  ['automatic same-repo gate removed', { ...sources, ledger: sources.ledger.replace('github.event.workflow_run.head_repository.full_name == github.repository', 'true') }],
  ['ledger artifact name flattened', { ...sources, ledger: sources.ledger.replace('tts-live-deployment-${{ steps.resolve.outputs.run_id }}', 'tts-live-deployment-latest') }],
  ['ledger run ID unpinned', { ...sources, ledger: sources.ledger.replace('run-id: ${{ steps.resolve.outputs.run_id }}', 'run-id: ${{ github.run_id }}') }],
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
