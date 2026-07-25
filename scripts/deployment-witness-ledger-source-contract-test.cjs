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

function countLiteral(source, literal) {
  return source.split(literal).length - 1;
}

function splitJobs(ledger) {
  const resolverStart = ledger.indexOf('\n  resolve:');
  const writerStart = ledger.indexOf('\n  record:');
  return {
    resolver: resolverStart >= 0 && writerStart > resolverStart
      ? ledger.slice(resolverStart, writerStart)
      : '',
    writer: writerStart >= 0 ? ledger.slice(writerStart) : '',
  };
}

function validate({ deploy, ledger, workflow, recorder }) {
  const problems = [];
  const { resolver, writer } = splitJobs(ledger);
  const must = (label, source, pattern) => {
    if (!pattern.test(source)) problems.push(label);
  };

  must('deploy keeps contents read', deploy, /^  contents: read\s+# читаем репозиторий$/m);
  must('deploy keeps Pages write', deploy, /^  pages: write\s+# заливаем артефакт на Pages$/m);
  must('deploy keeps OIDC write', deploy, /^  id-token: write\s+# OIDC-токен для actions\/deploy-pages$/m);
  must('deploy evidence upload remains diagnostic', deploy, /- name: Upload live TTS deployment evidence[\s\S]{0,120}if: always\(\)/);
  must('deploy evidence upload fails when report is absent', deploy, /name: tts-live-deployment-\$\{\{ github\.run_id \}\}[\s\S]{0,200}if-no-files-found: error/);

  must('ledger triggers completed deploy workflow', ledger, /workflow_run:[\s\S]{0,140}workflows: \["Deploy to GitHub Pages"\][\s\S]{0,100}types: \[completed\]/);
  must('ledger exposes explicit manual replay input', ledger, /workflow_dispatch:[\s\S]{0,180}deploy_run_id:[\s\S]{0,120}required: true/);
  must('ledger top-level permissions stay read-only', ledger, /permissions:\s*\n  actions: read\s*\n  contents: read\s*\n\njobs:/);
  must('resolver job exists', resolver, /^\n  resolve:/);
  must('writer job exists', writer, /^\n  record:/);

  must('resolver is read-only', resolver, /permissions:\s*\n      actions: read\s*\n      contents: read\s*\n    outputs:/);
  must('resolver exports canonical run ID', resolver, /run_id: \$\{\{ steps\.resolve\.outputs\.run_id \}\}/);
  must('resolver exports exact head SHA', resolver, /head_sha: \$\{\{ steps\.resolve\.outputs\.head_sha \}\}/);
  must('resolver exports trusted recorder ref', resolver, /recorder_ref: \$\{\{ steps\.resolve\.outputs\.recorder_ref \}\}/);
  must('resolver gates automatic success', resolver, /workflow_run\.conclusion == 'success'/);
  must('resolver gates automatic main', resolver, /workflow_run\.head_branch == 'main'/);
  must('resolver gates automatic same repository', resolver, /workflow_run\.head_repository\.full_name == github\.repository/);
  must('resolver gates manual replay to main', resolver, /github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/);
  must('resolver uses Actions API for manual replay', resolver, /context\.eventName === 'workflow_dispatch'[\s\S]*?github\.rest\.actions\.getWorkflowRun/);
  must('resolver normalizes positive safe integer', resolver, /const requestedNumber = Number\(requested\);[\s\S]*?Number\.isSafeInteger\(requestedNumber\) && requestedNumber > 0/);
  must('resolver emits canonical numeric output', resolver, /core\.setOutput\('run_id', String\(requestedNumber\)\)/);
  must('resolver requires exact run ID', resolver, /resolved deploy run ID mismatch/);
  must('resolver requires Pages workflow', resolver, /workflowRun\.name, 'Deploy to GitHub Pages'/);
  must('resolver requires completed run', resolver, /workflowRun\.status, 'completed'/);
  must('resolver requires successful run', resolver, /workflowRun\.conclusion, 'success'/);
  must('resolver requires main run', resolver, /workflowRun\.head_branch, 'main'/);
  must('resolver requires same repository', resolver, /requested deploy run belongs to a foreign repository/);
  must('resolver requires exact SHA', resolver, /requested deploy run lacks an exact SHA/);
  must('manual replay executes current trusted recorder', resolver, /context\.eventName === 'workflow_dispatch' \? context\.sha : workflowRun\.head_sha/);

  must('writer depends on resolver', writer, /needs: resolve/);
  must('writer requires resolver success', writer, /if: needs\.resolve\.result == 'success'/);
  must('writer owns exact issue and PR projection', writer, /permissions:\s*\n      actions: read\s*\n      contents: read\s*\n      issues: write\s*\n      pull-requests: write/);
  must('writer lock uses canonical resolver output', writer, /concurrency:\s*\n      group: deployment-witness-\$\{\{ needs\.resolve\.outputs\.run_id \}\}\s*\n      cancel-in-progress: false/);
  must('writer re-fetches exact run', writer, /- name: Re-fetch and persist exact deploy run[\s\S]*?github\.rest\.actions\.getWorkflowRun/);
  must('writer validates canonical run ID', writer, /Number\.isSafeInteger\(runId\) && runId > 0/);
  must('writer rechecks workflow identity', writer, /resolved run is not the Pages deploy workflow/);
  must('writer rechecks same repository', writer, /resolved deploy run belongs to a foreign repository/);
  must('writer rechecks SHA between jobs', writer, /resolved deploy SHA changed between jobs/);
  must('writer checks out trusted recorder ref', writer, /ref: \$\{\{ needs\.resolve\.outputs\.recorder_ref \}\}/);
  must('writer checkout drops credentials', writer, /persist-credentials: false/);
  must('writer downloads exact named artifact', writer, /name: tts-live-deployment-\$\{\{ needs\.resolve\.outputs\.run_id \}\}/);
  must('writer downloads into runner temp', writer, /path: \$\{\{ runner\.temp \}\}\/deployment-witness/);
  must('writer pins exact target run ID', writer, /run-id: \$\{\{ needs\.resolve\.outputs\.run_id \}\}/);
  must('writer supplies scoped token', writer, /github-token: \$\{\{ github\.token \}\}/);
  must('writer stores run record in runner temp', writer, /DEPLOYMENT_RUN_RECORD: \$\{\{ runner\.temp \}\}\/deployment-workflow-run\.json/);
  must('writer invokes trusted recorder', writer, /require\('\.\/scripts\/record-deployment-witness\.cjs'\)/);
  must('writer passes exact run record', writer, /workflowRun,\s*\n\s*witnessDirectory:/);

  if (/group:\s*deployment-witness-\$\{\{\s*(?:inputs\.deploy_run_id|github\.run_id|github\.event\.workflow_run\.id)/.test(writer)) {
    problems.push('writer lock bypasses canonical resolver output');
  }

  must('recorder lists exact-run artifacts', recorder, /actions\.listWorkflowRunArtifacts/);
  must('recorder requires one named artifact', recorder, /matchingArtifacts\.length, 1/);
  must('recorder rejects expired artifact', recorder, /artifact\.expired, false/);
  must('recorder requires artifact ID and bytes', recorder, /artifact ID is missing[\s\S]*artifact is empty/);
  must('recorder requires SHA-256 digest', recorder, /assert\.match\(normalize\(artifact\.digest\), DIGEST_RE/);
  must('recorder verifies report PASS', recorder, /report\.result, 'PASS'/);
  must('recorder verifies report SHA and attempt', recorder, /report\.deployedSha, sha[\s\S]*report\.workflowRunAttempt, runAttempt/);
  must('recorder builds capability envelope', recorder, /kind: 'deployment-capability-witness'[\s\S]*extensions:[\s\S]*tts:/);
  must('recorder uses full-SHA target marker', recorder, /deployment-witness-target:tts:\$\{sha\}/);
  must('recorder uses exact merge SHA', recorder, /normalize\(pull\.merge_commit_sha\)\.toLowerCase\(\) === sha/);
  must('recorder labels truthful capability scope', recorder, /TTS capability witness accepted/);
  must('recorder states whole-artifact limitation', recorder, /does not claim whole-Pages release-artifact identity/);

  must('TTS workflow owns recorder source', workflow, /scripts\/record-deployment-witness\.cjs/);
  must('TTS workflow owns recorder unit contract', workflow, /scripts\/record-deployment-witness-contract-test\.cjs/);
  must('TTS workflow owns ledger source contract', workflow, /scripts\/deployment-witness-ledger-source-contract-test\.cjs/);
  must('TTS workflow owns ledger workflow', workflow, /\.github\/workflows\/deployment-witness-ledger\.yml/);
  must('TTS workflow executes recorder unit contract', workflow, /node scripts\/record-deployment-witness-contract-test\.cjs/);
  must('TTS workflow executes ledger source contract', workflow, /node scripts\/deployment-witness-ledger-source-contract-test\.cjs/);
  must('TTS workflow lints ledger workflow', workflow, /run-actionlint\.mjs -no-color \.github\/workflows\/deployment-witness-ledger\.yml/);

  if (countLiteral(ledger, ACTION_PINS.githubScript) !== 3) problems.push(`ledger github-script pin drift (${countLiteral(ledger, ACTION_PINS.githubScript)}/3)`);
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

const mutations = [
  ['deploy issue permission reintroduced', { ...sources, deploy: sources.deploy.replace('  pages: write', '  issues: write\n  pages: write') }],
  ['deploy evidence absence downgraded', { ...sources, deploy: sources.deploy.replace('if-no-files-found: error', 'if-no-files-found: warn') }],
  ['writer PR projection downgraded', { ...sources, ledger: sources.ledger.replace('      pull-requests: write', '      pull-requests: read') }],
  ['github-script pins made mutable', { ...sources, ledger: sources.ledger.replaceAll(ACTION_PINS.githubScript, 'actions/github-script@v7') }],
  ['checkout pin made mutable', { ...sources, ledger: sources.ledger.replace(ACTION_PINS.checkout, 'actions/checkout@v4') }],
  ['download pin made mutable', { ...sources, ledger: sources.ledger.replace(ACTION_PINS.downloadArtifact, 'actions/download-artifact@v4') }],
  ['manual replay removed', { ...sources, ledger: sources.ledger.replace(/\n  workflow_dispatch:[\s\S]*?\n\npermissions:/, '\n\npermissions:') }],
  ['manual main gate removed', { ...sources, ledger: sources.ledger.replace("github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'", "github.event_name == 'workflow_dispatch'") }],
  ['resolver Actions lookup bypassed', { ...sources, ledger: sources.ledger.replace('github.rest.actions.getWorkflowRun', 'Promise.resolve') }],
  ['safe integer normalization removed', { ...sources, ledger: sources.ledger.replace('Number.isSafeInteger(requestedNumber) && requestedNumber > 0', 'requestedNumber > 0') }],
  ['canonical output changed to raw input', { ...sources, ledger: sources.ledger.replace("core.setOutput('run_id', String(requestedNumber))", "core.setOutput('run_id', requested") }],
  ['resolver workflow identity check removed', { ...sources, ledger: sources.ledger.replace("assert.equal(workflowRun.name, 'Deploy to GitHub Pages'", "assert.equal('Deploy to GitHub Pages', 'Deploy to GitHub Pages'") }],
  ['resolver success check removed', { ...sources, ledger: sources.ledger.replace("assert.equal(workflowRun.conclusion, 'success'", "assert.equal('success', 'success'") }],
  ['resolver repository check removed', { ...sources, ledger: sources.ledger.replace('requested deploy run belongs to a foreign repository', 'repository unchecked') }],
  ['manual recorder trust downgraded', { ...sources, ledger: sources.ledger.replace("context.eventName === 'workflow_dispatch' ? context.sha : workflowRun.head_sha", 'workflowRun.head_sha') }],
  ['automatic success gate removed', { ...sources, ledger: sources.ledger.replace("github.event.workflow_run.conclusion == 'success' &&\n", '') }],
  ['automatic main gate removed', { ...sources, ledger: sources.ledger.replace("github.event.workflow_run.head_branch == 'main' &&\n", '') }],
  ['automatic repository gate removed', { ...sources, ledger: sources.ledger.replace('github.event.workflow_run.head_repository.full_name == github.repository', 'true') }],
  ['writer dependency removed', { ...sources, ledger: sources.ledger.replace('    needs: resolve\n', '') }],
  ['writer concurrency removed', { ...sources, ledger: sources.ledger.replace(/\n    concurrency:\n      group: deployment-witness-\$\{\{ needs\.resolve\.outputs\.run_id \}\}\n      cancel-in-progress: false\n/, '\n') }],
  ['writer cancellation enabled', { ...sources, ledger: sources.ledger.replace('      cancel-in-progress: false', '      cancel-in-progress: true') }],
  ['writer lock uses raw input', { ...sources, ledger: sources.ledger.replace('group: deployment-witness-${{ needs.resolve.outputs.run_id }}', 'group: deployment-witness-${{ inputs.deploy_run_id }}') }],
  ['writer lock uses recorder run', { ...sources, ledger: sources.ledger.replace('group: deployment-witness-${{ needs.resolve.outputs.run_id }}', 'group: deployment-witness-${{ github.run_id }}') }],
  ['writer SHA recheck removed', { ...sources, ledger: sources.ledger.replace('resolved deploy SHA changed between jobs', 'SHA unchecked') }],
  ['artifact name flattened', { ...sources, ledger: sources.ledger.replace('tts-live-deployment-${{ needs.resolve.outputs.run_id }}', 'tts-live-deployment-latest') }],
  ['artifact run ID unpinned', { ...sources, ledger: sources.ledger.replace('run-id: ${{ needs.resolve.outputs.run_id }}', 'run-id: ${{ github.run_id }}') }],
  ['artifact extracted into workspace', { ...sources, ledger: sources.ledger.replace('${{ runner.temp }}/deployment-witness', './deployment-witness') }],
  ['recorder uniqueness bypassed', { ...sources, recorder: sources.recorder.replace('matchingArtifacts.length, 1', '1, 1') }],
  ['recorder digest validation removed', { ...sources, recorder: sources.recorder.replace('assert.match(normalize(artifact.digest), DIGEST_RE', 'assert.match("sha256:" + "a".repeat(64), DIGEST_RE') }],
  ['recorder PASS validation removed', { ...sources, recorder: sources.recorder.replace("assert.equal(report.result, 'PASS'", "assert.equal('PASS', 'PASS'") }],
  ['recorder issue marker shortened', { ...sources, recorder: sources.recorder.replace('deployment-witness-target:tts:${sha}', 'deployment-witness-target:tts:${sha.slice(0, 7)}') }],
  ['recorder overclaims global acceptance', { ...sources, recorder: sources.recorder.replace('TTS capability witness accepted', 'Production deployment accepted') }],
  ['workflow ledger ownership removed', { ...sources, workflow: sources.workflow.replace(/^      - "\.github\/workflows\/deployment-witness-ledger\.yml"\n/gm, '') }],
  ['workflow ledger contract skipped', { ...sources, workflow: sources.workflow.replace('node scripts/deployment-witness-ledger-source-contract-test.cjs', 'echo skipped') }],
];

for (const [name, mutated] of mutations) {
  assert.ok(validate(mutated).length > 0, `${name}: mutation must be rejected`);
}

console.log(`Deployment witness ledger source contract: PASS (${mutations.length} named adversarial mutations rejected).`);
