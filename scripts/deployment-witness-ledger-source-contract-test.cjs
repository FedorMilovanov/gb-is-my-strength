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
const CANONICAL_CONCURRENCY_GROUP = 'group: deployment-witness-${{ needs.resolve.outputs.run_id }}';

function countLiteral(source, literal) {
  return source.split(literal).length - 1;
}

function canonicalRunId(value) {
  const requested = String(value || '').trim();
  assert.match(requested, /^\d+$/, 'deploy run ID must contain decimal digits only');
  const requestedNumber = Number(requested);
  assert.ok(Number.isSafeInteger(requestedNumber) && requestedNumber > 0, 'deploy run ID must be a positive safe integer');
  return String(requestedNumber);
}

function writerLock(value) {
  return `deployment-witness-${canonicalRunId(value)}`;
}

function validate({ deploy, ledger, workflow, recorder }) {
  const problems = [];
  const checks = [
    ['deploy keeps contents read', deploy, /^  contents: read\s+# читаем репозиторий$/m],
    ['deploy keeps Pages write', deploy, /^  pages: write\s+# заливаем артефакт на Pages$/m],
    ['deploy keeps OIDC write', deploy, /^  id-token: write\s+# OIDC-токен для actions\/deploy-pages$/m],
    ['deploy evidence upload remains diagnostic', deploy, /- name: Upload live TTS deployment evidence[\s\S]{0,120}if: always\(\)/],
    ['deploy evidence absence is blocking', deploy, /name: tts-live-deployment-\$\{\{ github\.run_id \}\}[\s\S]{0,200}if-no-files-found: error/],

    ['ledger owns workflow-run entry', ledger, /workflow_run:[\s\S]{0,140}workflows: \["Deploy to GitHub Pages"\][\s\S]{0,100}types: \[completed\]/],
    ['ledger owns explicit manual replay', ledger, /workflow_dispatch:[\s\S]{0,180}deploy_run_id:[\s\S]{0,120}required: true/],
    ['workflow defaults to contents read only', ledger, /^permissions:\s*\n  contents: read\s*$/m],

    ['resolver job exists', ledger, /^  resolve:\s*\n    name: Resolve exact deployment witness target$/m],
    ['resolver has read-only capabilities', ledger, /  resolve:[\s\S]{0,700}permissions:\s*\n      actions: read\s*\n      contents: read/],
    ['resolver exports canonical ID', ledger, /outputs:[\s\S]{0,180}run_id: \$\{\{ steps\.resolve\.outputs\.run_id \}\}/],
    ['resolver exports exact SHA', ledger, /outputs:[\s\S]{0,230}head_sha: \$\{\{ steps\.resolve\.outputs\.head_sha \}\}/],
    ['resolver exports trusted source ref', ledger, /outputs:[\s\S]{0,300}recorder_ref: \$\{\{ steps\.resolve\.outputs\.recorder_ref \}\}/],
    ['automatic resolver requires success', ledger, /workflow_run\.conclusion == 'success'/],
    ['automatic resolver requires main', ledger, /workflow_run\.head_branch == 'main'/],
    ['automatic resolver requires same repo', ledger, /workflow_run\.head_repository\.full_name == github\.repository/],
    ['manual resolver is main-only', ledger, /github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/],
    ['resolver trims manual input', ledger, /deploy_run_id \|\| ''\)\.trim\(\)/],
    ['resolver validates decimal syntax', ledger, /assert\.match\(requested, \/\^\\d\+\$\/[\s\S]{0,80}deploy_run_id must be numeric/],
    ['resolver validates positive safe integer', ledger, /assert\.ok\([\s\S]{0,100}Number\.isSafeInteger\(requestedNumber\) && requestedNumber > 0[\s\S]{0,100}positive safe integer/],
    ['manual resolver fetches exact Actions run', ledger, /context\.eventName === 'workflow_dispatch'[\s\S]{0,320}github\.rest\.actions\.getWorkflowRun[\s\S]{0,150}run_id: requestedNumber/],
    ['resolver invokes ID assertion', ledger, /assert\.equal\(Number\(workflowRun\.id\), requestedNumber, 'resolved deploy run ID mismatch'\);/],
    ['resolver invokes workflow assertion', ledger, /assert\.equal\(workflowRun\.name, 'Deploy to GitHub Pages', 'requested run is not the Pages deploy workflow'\);/],
    ['resolver invokes completed assertion', ledger, /assert\.equal\(workflowRun\.status, 'completed', 'requested deploy run is not completed'\);/],
    ['resolver invokes success assertion', ledger, /assert\.equal\(workflowRun\.conclusion, 'success', 'requested deploy run did not succeed'\);/],
    ['resolver invokes main assertion', ledger, /assert\.equal\(workflowRun\.head_branch, 'main', 'requested deploy run is not from main'\);/],
    ['resolver invokes repository assertion', ledger, /assert\.equal\([\s\S]{0,180}workflowRun\.head_repository && workflowRun\.head_repository\.full_name[\s\S]{0,180}requested deploy run belongs to a foreign repository/],
    ['resolver invokes SHA assertion', ledger, /assert\.match\(String\(workflowRun\.head_sha \|\| ''\), \/\^\[a-f0-9\]\{40\}\$\/[\s\S]{0,100}requested deploy run lacks an exact SHA/],
    ['resolver emits canonical API ID', ledger, /core\.setOutput\('run_id', String\(workflowRun\.id\)\);/],
    ['manual replay uses current trusted recorder', ledger, /context\.eventName === 'workflow_dispatch' \? context\.sha : workflowRun\.head_sha/],

    ['writer depends on resolver', ledger, /^  record:[\s\S]{0,140}needs: resolve/m],
    ['writer owns actions read', ledger, /  record:[\s\S]{0,360}permissions:[\s\S]{0,100}actions: read/],
    ['writer owns contents read', ledger, /  record:[\s\S]{0,360}permissions:[\s\S]{0,130}contents: read/],
    ['writer alone owns issues write', ledger, /  record:[\s\S]{0,400}permissions:[\s\S]{0,170}issues: write/],
    ['writer alone owns PR write', ledger, /  record:[\s\S]{0,420}permissions:[\s\S]{0,200}pull-requests: write/],
    ['writer locks by canonical resolver output', ledger, /concurrency:\s*\n      group: deployment-witness-\$\{\{ needs\.resolve\.outputs\.run_id \}\}/],
    ['writer never cancels evidence projection', ledger, /concurrency:[\s\S]{0,140}cancel-in-progress: false/],
    ['writer checkout uses trusted ref', ledger, /ref: \$\{\{ needs\.resolve\.outputs\.recorder_ref \}\}/],
    ['writer checkout drops credentials', ledger, /persist-credentials: false/],
    ['writer downloads canonical artifact', ledger, /name: tts-live-deployment-\$\{\{ needs\.resolve\.outputs\.run_id \}\}/],
    ['writer downloads into runner temp', ledger, /path: \$\{\{ runner\.temp \}\}\/deployment-witness/],
    ['writer pins canonical target run', ledger, /run-id: \$\{\{ needs\.resolve\.outputs\.run_id \}\}/],
    ['writer supplies scoped token', ledger, /github-token: \$\{\{ github\.token \}\}/],
    ['writer receives target ID', ledger, /TARGET_DEPLOY_RUN_ID: \$\{\{ needs\.resolve\.outputs\.run_id \}\}/],
    ['writer receives target SHA', ledger, /EXPECTED_DEPLOY_HEAD_SHA: \$\{\{ needs\.resolve\.outputs\.head_sha \}\}/],
    ['writer refetches exact run', ledger, /Revalidate target and record witness[\s\S]{0,900}github\.rest\.actions\.getWorkflowRun/],
    ['writer invokes safe-ID assertion', ledger, /assert\.ok\(Number\.isSafeInteger\(targetRunId\) && targetRunId > 0, 'canonical deploy run ID is invalid'\);/],
    ['writer invokes ID assertion', ledger, /assert\.equal\(Number\(workflowRun\.id\), targetRunId, 'writer deploy run ID mismatch'\);/],
    ['writer invokes workflow assertion', ledger, /assert\.equal\(workflowRun\.name, 'Deploy to GitHub Pages', 'writer target is not the Pages deploy workflow'\);/],
    ['writer invokes completed assertion', ledger, /assert\.equal\(workflowRun\.status, 'completed', 'writer target deploy run is not completed'\);/],
    ['writer invokes success assertion', ledger, /assert\.equal\(workflowRun\.conclusion, 'success', 'writer target deploy run did not succeed'\);/],
    ['writer invokes main assertion', ledger, /assert\.equal\(workflowRun\.head_branch, 'main', 'writer target deploy run is not from main'\);/],
    ['writer invokes repository assertion', ledger, /assert\.equal\([\s\S]{0,180}workflowRun\.head_repository && workflowRun\.head_repository\.full_name[\s\S]{0,180}writer target deploy run belongs to a foreign repository/],
    ['writer invokes SHA assertion', ledger, /assert\.equal\(workflowRun\.head_sha, process\.env\.EXPECTED_DEPLOY_HEAD_SHA, 'writer target deploy SHA mismatch'\);/],
    ['writer invokes trusted recorder', ledger, /require\('\.\/scripts\/record-deployment-witness\.cjs'\)/],
    ['writer passes exact workflow run', ledger, /workflowRun,\s*\n\s*witnessDirectory:/],

    ['recorder lists exact-run artifacts', recorder, /actions\.listWorkflowRunArtifacts/],
    ['recorder requires one named artifact', recorder, /matchingArtifacts\.length, 1/],
    ['recorder rejects expiry', recorder, /artifact\.expired, false/],
    ['recorder requires ID and bytes', recorder, /artifact ID is missing[\s\S]*artifact is empty/],
    ['recorder requires SHA-256 digest', recorder, /assert\.match\(normalize\(artifact\.digest\), DIGEST_RE,[\s\S]{0,120}artifact digest is missing or invalid/],
    ['recorder verifies PASS report', recorder, /report\.result, 'PASS'/],
    ['recorder verifies SHA and attempt', recorder, /report\.deployedSha, sha[\s\S]*report\.workflowRunAttempt, runAttempt/],
    ['recorder keeps capability envelope', recorder, /kind: 'deployment-capability-witness'[\s\S]*witnessArtifact:[\s\S]*extensions:[\s\S]*tts:/],
    ['recorder keeps full-SHA issue marker', recorder, /deployment-witness-target:tts:\$\{sha\}/],
    ['recorder targets marker in issue body', recorder, /normalize\(issue\.body\)\.includes\(issueTargetMarker\)/],
    ['recorder uses exact merge SHA', recorder, /normalize\(pull\.merge_commit_sha\)\.toLowerCase\(\) === sha/],
    ['recorder keeps capability wording', recorder, /TTS capability witness accepted/],
    ['recorder keeps whole-artifact limitation', recorder, /does not claim whole-Pages release-artifact identity/],

    ['TTS workflow owns recorder source', workflow, /scripts\/record-deployment-witness\.cjs/],
    ['TTS workflow owns recorder unit contract', workflow, /scripts\/record-deployment-witness-contract-test\.cjs/],
    ['TTS workflow owns ledger source contract', workflow, /scripts\/deployment-witness-ledger-source-contract-test\.cjs/],
    ['TTS workflow owns ledger workflow', workflow, /\.github\/workflows\/deployment-witness-ledger\.yml/],
    ['TTS workflow executes recorder unit contract', workflow, /node scripts\/record-deployment-witness-contract-test\.cjs/],
    ['TTS workflow executes ledger source contract', workflow, /node scripts\/deployment-witness-ledger-source-contract-test\.cjs/],
    ['TTS workflow lints ledger workflow', workflow, /run-actionlint\.mjs -no-color \.github\/workflows\/deployment-witness-ledger\.yml/],
  ];

  for (const [label, source, pattern] of checks) {
    if (!pattern.test(source)) problems.push(label);
  }

  if (countLiteral(ledger, CANONICAL_CONCURRENCY_GROUP) !== 1) {
    problems.push(`ledger canonical concurrency drift (${countLiteral(ledger, CANONICAL_CONCURRENCY_GROUP)}/1)`);
  }
  if (/concurrency:[\s\S]{0,160}(?:inputs\.deploy_run_id|github\.event\.workflow_run\.id|github\.run_id)/.test(ledger)) {
    problems.push('writer concurrency uses raw event/input/current run identity');
  }
  if (/^  (?:issues|pull-requests):\s*write/m.test(ledger)) {
    problems.push('ledger workflow grants write permission outside writer job');
  }
  if (/  resolve:[\s\S]{0,800}permissions:[\s\S]{0,220}(?:issues|pull-requests): write/.test(ledger)) {
    problems.push('resolver job owns repository write permission');
  }

  if (countLiteral(ledger, ACTION_PINS.githubScript) !== 2) problems.push(`ledger github-script pin drift (${countLiteral(ledger, ACTION_PINS.githubScript)}/2)`);
  if (countLiteral(ledger, ACTION_PINS.checkout) !== 1) problems.push(`ledger checkout pin drift (${countLiteral(ledger, ACTION_PINS.checkout)}/1)`);
  if (countLiteral(ledger, ACTION_PINS.downloadArtifact) !== 1) problems.push(`ledger download-artifact pin drift (${countLiteral(ledger, ACTION_PINS.downloadArtifact)}/1)`);
  if (/uses:\s*actions\/(?:github-script|checkout|download-artifact)@v\d+/i.test(ledger)) problems.push('privileged ledger uses mutable action tag');

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
assert.equal(canonicalRunId('30169443420'), '30169443420');
assert.equal(canonicalRunId(' 30169443420 '), '30169443420');
assert.equal(canonicalRunId('030169443420'), '30169443420');
assert.equal(writerLock('30169443420'), writerLock(' 030169443420 '));
assert.notEqual(writerLock('30169443420'), writerLock('30169443421'));
assert.throws(() => canonicalRunId(''), /decimal digits/);
assert.throws(() => canonicalRunId('0'), /positive safe integer/);
assert.throws(() => canonicalRunId('-1'), /decimal digits/);
assert.throws(() => canonicalRunId('3.016944342e10'), /decimal digits/);
assert.throws(() => canonicalRunId('99999999999999999999'), /positive safe integer/);

const mutations = [
  ['deploy issue permission reintroduced', { ...sources, deploy: sources.deploy.replace('  pages: write', '  issues: write\n  pages: write') }],
  ['deploy evidence absence downgraded', { ...sources, deploy: sources.deploy.replace('if-no-files-found: error', 'if-no-files-found: warn') }],
  ['workflow-level PR write reintroduced', { ...sources, ledger: sources.ledger.replace('permissions:\n  contents: read', 'permissions:\n  contents: read\n  pull-requests: write') }],
  ['resolver write permission introduced', { ...sources, ledger: sources.ledger.replace('      contents: read\n    outputs:', '      contents: read\n      issues: write\n    outputs:') }],
  ['writer PR projection downgraded', { ...sources, ledger: sources.ledger.replace('      pull-requests: write', '      pull-requests: read') }],
  ['writer concurrency removed', { ...sources, ledger: sources.ledger.replace(/\n    concurrency:[\s\S]*?\n\n    steps:/, '\n\n    steps:') }],
  ['writer cancellation enabled', { ...sources, ledger: sources.ledger.replace('      cancel-in-progress: false', '      cancel-in-progress: true') }],
  ['writer lock uses raw manual input', { ...sources, ledger: sources.ledger.replace(CANONICAL_CONCURRENCY_GROUP, 'group: deployment-witness-${{ inputs.deploy_run_id }}') }],
  ['writer lock uses current workflow run', { ...sources, ledger: sources.ledger.replace(CANONICAL_CONCURRENCY_GROUP, 'group: deployment-witness-${{ github.run_id }}') }],
  ['resolver output uses raw request', { ...sources, ledger: sources.ledger.replace("core.setOutput('run_id', String(workflowRun.id))", "core.setOutput('run_id', requested)") }],
  ['resolver safe-integer check removed', { ...sources, ledger: sources.ledger.replace('Number.isSafeInteger(requestedNumber) && requestedNumber > 0', 'requestedNumber > 0') }],
  ['manual replay removed', { ...sources, ledger: sources.ledger.replace(/\n  workflow_dispatch:[\s\S]*?\n\npermissions:/, '\n\npermissions:') }],
  ['manual main guard removed', { ...sources, ledger: sources.ledger.replace("github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'", "github.event_name == 'workflow_dispatch'") }],
  ['manual Actions lookup bypassed', { ...sources, ledger: sources.ledger.replace(/(context\.eventName === 'workflow_dispatch'[\s\S]*?)github\.rest\.actions\.getWorkflowRun/, '$1Promise.resolve') }],
  ['resolver ID assertion bypassed', { ...sources, ledger: sources.ledger.replace("assert.equal(Number(workflowRun.id), requestedNumber", "assert.equal(requestedNumber, requestedNumber") }],
  ['resolver workflow assertion bypassed', { ...sources, ledger: sources.ledger.replace("assert.equal(workflowRun.name, 'Deploy to GitHub Pages'", "assert.equal('Deploy to GitHub Pages', 'Deploy to GitHub Pages'") }],
  ['resolver completed assertion bypassed', { ...sources, ledger: sources.ledger.replace("assert.equal(workflowRun.status, 'completed'", "assert.equal('completed', 'completed'") }],
  ['resolver success assertion bypassed', { ...sources, ledger: sources.ledger.replace("assert.equal(workflowRun.conclusion, 'success'", "assert.equal('success', 'success'") }],
  ['resolver main assertion bypassed', { ...sources, ledger: sources.ledger.replace("assert.equal(workflowRun.head_branch, 'main'", "assert.equal('main', 'main'") }],
  ['resolver repository assertion removed', { ...sources, ledger: sources.ledger.replace('requested deploy run belongs to a foreign repository', 'repository unchecked') }],
  ['resolver SHA assertion removed', { ...sources, ledger: sources.ledger.replace('requested deploy run lacks an exact SHA', 'SHA unchecked') }],
  ['manual recorder trust downgraded', { ...sources, ledger: sources.ledger.replace("context.eventName === 'workflow_dispatch' ? context.sha : workflowRun.head_sha", 'workflowRun.head_sha') }],
  ['automatic success gate removed', { ...sources, ledger: sources.ledger.replace("github.event.workflow_run.conclusion == 'success' &&\n", '') }],
  ['automatic main gate removed', { ...sources, ledger: sources.ledger.replace("github.event.workflow_run.head_branch == 'main' &&\n", '') }],
  ['automatic same-repo gate removed', { ...sources, ledger: sources.ledger.replace('github.event.workflow_run.head_repository.full_name == github.repository', 'true') }],
  ['writer run refetch removed', { ...sources, ledger: sources.ledger.replace(/(Revalidate target and record witness[\s\S]*?)github\.rest\.actions\.getWorkflowRun/, '$1github.rest.actions.listWorkflowRunsForRepo') }],
  ['writer ID assertion bypassed', { ...sources, ledger: sources.ledger.replace("assert.equal(Number(workflowRun.id), targetRunId", "assert.equal(targetRunId, targetRunId") }],
  ['writer workflow assertion bypassed', { ...sources, ledger: sources.ledger.replace("assert.equal(workflowRun.name, 'Deploy to GitHub Pages', 'writer", "assert.equal('Deploy to GitHub Pages', 'Deploy to GitHub Pages', 'writer") }],
  ['writer completed assertion bypassed', { ...sources, ledger: sources.ledger.replace("assert.equal(workflowRun.status, 'completed', 'writer", "assert.equal('completed', 'completed', 'writer") }],
  ['writer success assertion bypassed', { ...sources, ledger: sources.ledger.replace("assert.equal(workflowRun.conclusion, 'success', 'writer", "assert.equal('success', 'success', 'writer") }],
  ['writer main assertion bypassed', { ...sources, ledger: sources.ledger.replace("assert.equal(workflowRun.head_branch, 'main', 'writer", "assert.equal('main', 'main', 'writer") }],
  ['writer repository assertion removed', { ...sources, ledger: sources.ledger.replace('writer target deploy run belongs to a foreign repository', 'writer repository unchecked') }],
  ['writer SHA assertion bypassed', { ...sources, ledger: sources.ledger.replace("assert.equal(workflowRun.head_sha, process.env.EXPECTED_DEPLOY_HEAD_SHA", "assert.equal(process.env.EXPECTED_DEPLOY_HEAD_SHA, process.env.EXPECTED_DEPLOY_HEAD_SHA") }],
  ['github-script pin made mutable', { ...sources, ledger: sources.ledger.replaceAll(ACTION_PINS.githubScript, 'actions/github-script@v7') }],
  ['checkout pin made mutable', { ...sources, ledger: sources.ledger.replace(ACTION_PINS.checkout, 'actions/checkout@v4') }],
  ['download-artifact pin made mutable', { ...sources, ledger: sources.ledger.replace(ACTION_PINS.downloadArtifact, 'actions/download-artifact@v4') }],
  ['artifact name flattened', { ...sources, ledger: sources.ledger.replace('tts-live-deployment-${{ needs.resolve.outputs.run_id }}', 'tts-live-deployment-latest') }],
  ['artifact run ID unpinned', { ...sources, ledger: sources.ledger.replace('run-id: ${{ needs.resolve.outputs.run_id }}', 'run-id: ${{ github.run_id }}') }],
  ['artifact extracted into workspace', { ...sources, ledger: sources.ledger.replace('${{ runner.temp }}/deployment-witness', './deployment-witness') }],
  ['recorder artifact uniqueness bypassed', { ...sources, recorder: sources.recorder.replace('matchingArtifacts.length, 1', '1, 1') }],
  ['recorder digest validation removed', { ...sources, recorder: sources.recorder.replace('assert.match(normalize(artifact.digest), DIGEST_RE', 'assert.match("sha256:" + "a".repeat(64), DIGEST_RE') }],
  ['recorder PASS validation removed', { ...sources, recorder: sources.recorder.replace("assert.equal(report.result, 'PASS'", "assert.equal('PASS', 'PASS'") }],
  ['recorder marker shortened', { ...sources, recorder: sources.recorder.replace('deployment-witness-target:tts:${sha}', 'deployment-witness-target:tts:${sha.slice(0, 7)}') }],
  ['recorder overclaims production acceptance', { ...sources, recorder: sources.recorder.replace('TTS capability witness accepted', 'Production deployment accepted') }],
  ['workflow ownership removed', { ...sources, workflow: sources.workflow.replace(/^      - "\.github\/workflows\/deployment-witness-ledger\.yml"\n/gm, '') }],
  ['source contract execution removed', { ...sources, workflow: sources.workflow.replace('node scripts/deployment-witness-ledger-source-contract-test.cjs', 'echo ledger source contract skipped') }],
];

for (const [name, mutated] of mutations) {
  assert.ok(validate(mutated).length > 0, `${name}: mutation must be rejected`);
}

console.log(`Deployment witness ledger source contract: PASS (${mutations.length} named adversarial mutations rejected; canonical lock fixtures PASS).`);
