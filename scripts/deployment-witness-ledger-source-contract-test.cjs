'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const PINS = Object.freeze({
  githubScript: 'actions/github-script@f28e40c7f34bde8b3046d885e986cb6290c5673b # v7',
  checkout: 'actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4',
  download: 'actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093 # v4',
});
const LOCK = 'group: deployment-witness-${{ needs.resolve.outputs.run_id }}';

function countLiteral(source, literal) { return source.split(literal).length - 1; }
function canonicalRunId(value) {
  const requested = String(value || '').trim();
  assert.match(requested, /^\d+$/);
  const number = Number(requested);
  assert.ok(Number.isSafeInteger(number) && number > 0);
  return String(number);
}
function writerLock(value) { return `deployment-witness-${canonicalRunId(value)}`; }
function jobSection(workflow, name, nextName = null) {
  const marker = `\n  ${name}:\n`;
  const start = workflow.indexOf(marker);
  if (start < 0) return '';
  const offset = start + marker.length;
  if (!nextName) return workflow.slice(offset);
  const end = workflow.indexOf(`\n  ${nextName}:\n`, offset);
  return end < 0 ? workflow.slice(offset) : workflow.slice(offset, end);
}

function validate({ deploy, ledger, workflow, recorder }) {
  const problems = [];
  const releaseReadiness = jobSection(deploy, 'readiness', 'deploy');
  const releaseDeploy = jobSection(deploy, 'deploy');
  const resolver = jobSection(ledger, 'resolve', 'record');
  const writer = jobSection(ledger, 'record');
  const checks = [
    ['release top-level read only', deploy, /^permissions:\s*\n\s*contents:\s*read\s*$/m],
    ['release candidate job read only', releaseReadiness, /permissions:\s*\n\s*contents:\s*read/],
    ['release promotion permissions exact', releaseDeploy, /permissions:\s*\n\s*actions:\s*read\s*\n\s*contents:\s*read\s*\n\s*pages:\s*write\s*\n\s*id-token:\s*write/],
    ['generic live artifact fail closed', releaseDeploy, /release-live-deployment-\$\{\{ github\.run_id \}\}[\s\S]{0,240}if-no-files-found:\s*error/],
    ['TTS live artifact fail closed', releaseDeploy, /tts-live-deployment-\$\{\{ github\.run_id \}\}[\s\S]{0,240}if-no-files-found:\s*error/],
    ['generic live precedes TTS', releaseDeploy, /Verify generic live release contract[\s\S]*Verify live TTS capability extension/],

    ['ledger automatic entry exact', ledger, /workflow_run:[\s\S]{0,160}workflows:\s*\["Deploy to GitHub Pages"\][\s\S]{0,100}types:\s*\[completed\]/],
    ['ledger manual replay exact', ledger, /workflow_dispatch:[\s\S]{0,180}deploy_run_id:[\s\S]{0,120}required:\s*true/],
    ['ledger top-level read only', ledger, /^permissions:\s*\n\s*contents:\s*read\s*$/m],
    ['resolver read only', resolver, /permissions:\s*\n\s*actions:\s*read\s*\n\s*contents:\s*read/],
    ['resolver exports canonical identity', resolver, /outputs:[\s\S]*run_id:\s*\$\{\{ steps\.resolve\.outputs\.run_id \}\}[\s\S]*head_sha:\s*\$\{\{ steps\.resolve\.outputs\.head_sha \}\}[\s\S]*recorder_ref:\s*\$\{\{ steps\.resolve\.outputs\.recorder_ref \}\}/],
    ['automatic resolver gates exact run', resolver, /workflow_run\.conclusion == 'success'[\s\S]*workflow_run\.head_branch == 'main'[\s\S]*workflow_run\.head_repository\.full_name == github\.repository/],
    ['manual resolver main only', resolver, /github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/],
    ['resolver canonicalizes decimal ID', resolver, /deploy_run_id \|\| ''\)\.trim\(\)[\s\S]*assert\.match\(requested, \/\^\\d\+\$\/[\s\S]*Number\.isSafeInteger\(requestedNumber\) && requestedNumber > 0/],
    ['resolver fetches exact run', resolver, /github\.rest\.actions\.getWorkflowRun[\s\S]{0,180}run_id:\s*requestedNumber/],
    ['resolver asserts workflow identity', resolver, /assert\.equal\(workflowRun\.name, 'Deploy to GitHub Pages'/],
    ['resolver asserts success', resolver, /assert\.equal\(workflowRun\.conclusion, 'success'/],
    ['resolver asserts repository', resolver, /requested deploy run belongs to a foreign repository/],
    ['resolver asserts full SHA', resolver, /requested deploy run lacks an exact SHA/],
    ['resolver emits API canonical ID', resolver, /core\.setOutput\('run_id', String\(workflowRun\.id\)\);/],
    ['manual uses trusted current recorder', resolver, /context\.eventName === 'workflow_dispatch' \? context\.sha : workflowRun\.head_sha/],

    ['writer depends on resolver', writer, /needs:\s*resolve/],
    ['writer permissions exact', writer, /permissions:\s*\n\s*actions:\s*read\s*\n\s*contents:\s*read\s*\n\s*issues:\s*write\s*\n\s*pull-requests:\s*write/],
    ['writer canonical lock', writer, /concurrency:\s*\n\s*group:\s*deployment-witness-\$\{\{ needs\.resolve\.outputs\.run_id \}\}[\s\S]{0,100}cancel-in-progress:\s*false/],
    ['writer trusted checkout', writer, /ref:\s*\$\{\{ needs\.resolve\.outputs\.recorder_ref \}\}[\s\S]{0,80}persist-credentials:\s*false/],
    ['writer downloads generic evidence', writer, /release-live-deployment-\$\{\{ needs\.resolve\.outputs\.run_id \}\}[\s\S]{0,180}deployment-witness\/release/],
    ['writer downloads TTS evidence', writer, /tts-live-deployment-\$\{\{ needs\.resolve\.outputs\.run_id \}\}[\s\S]{0,180}deployment-witness\/tts/],
    ['writer pins exact run twice', writer, /run-id:\s*\$\{\{ needs\.resolve\.outputs\.run_id \}\}[\s\S]*run-id:\s*\$\{\{ needs\.resolve\.outputs\.run_id \}\}/],
    ['writer revalidates run and SHA', writer, /github\.rest\.actions\.getWorkflowRun[\s\S]*writer target deploy SHA mismatch/],
    ['writer invokes trusted recorder', writer, /require\('\.\/scripts\/record-deployment-witness\.cjs'\)/],

    ['recorder lists exact-run artifacts', recorder, /actions\.listWorkflowRunArtifacts/],
    ['recorder requires candidate artifact', recorder, /pages-release-candidate-\$\{runId\}-\$\{runAttempt\}/],
    ['recorder requires generic artifact', recorder, /release-live-deployment-\$\{runId\}/],
    ['recorder requires TTS artifact', recorder, /tts-live-deployment-\$\{runId\}/],
    ['recorder validates expiry and digest', recorder, /artifact\.expired, false[\s\S]*artifact digest is missing or invalid/],
    ['recorder validates generic PASS identity', recorder, /generic\.result, 'PASS'[\s\S]*generic\.repository, repository[\s\S]*generic\.commitSha, sha[\s\S]*generic\.workflowRunId, runId[\s\S]*generic\.workflowRunAttempt, runAttempt/],
    ['recorder binds candidate transport', recorder, /transport artifact ID mismatch[\s\S]*transport artifact digest mismatch/],
    ['recorder binds generic tree digest', recorder, /generic release candidate digest is missing or invalid[\s\S]*generic release evidence candidate digest mismatch/],
    ['recorder binds TTS to candidate digest', recorder, /TTS witness candidate digest mismatch[\s\S]*TTS discovery candidate digest mismatch[\s\S]*TTS provenance candidate digest mismatch/],
    ['recorder generic envelope exact', recorder, /kind:\s*'deployment-release-witness'[\s\S]*releaseCandidate:[\s\S]*liveWitnessArtifact:[\s\S]*extensions:[\s\S]*tts:/],
    ['recorder marker binds all artifact IDs', recorder, /deployment-release-witness:\$\{sha\}:\$\{runId\}:\$\{runAttempt\}:\$\{candidateArtifact\.id\}:\$\{genericArtifact\.id\}:\$\{ttsArtifact\.id\}/],
    ['recorder supports generic and legacy targets', recorder, /deployment-witness-target:release:\$\{sha\}[\s\S]*deployment-witness-target:tts:\$\{sha\}/],
    ['recorder exact merge SHA only', recorder, /normalize\(pull\.merge_commit_sha\)\.toLowerCase\(\) === sha/],
    ['recorder truthful release wording', recorder, /Release candidate witness accepted[\s\S]*same candidate bytes/],

    ['source workflow owns recorder', workflow, /scripts\/record-deployment-witness\.cjs/],
    ['source workflow owns recorder test', workflow, /scripts\/record-deployment-witness-contract-test\.cjs/],
    ['source workflow owns ledger test', workflow, /scripts\/deployment-witness-ledger-source-contract-test\.cjs/],
    ['source workflow owns ledger YAML', workflow, /\.github\/workflows\/deployment-witness-ledger\.yml/],
    ['source workflow executes recorder test', workflow, /node scripts\/record-deployment-witness-contract-test\.cjs/],
    ['source workflow executes ledger test', workflow, /node scripts\/deployment-witness-ledger-source-contract-test\.cjs/],
    ['source workflow lints ledger YAML', workflow, /run-actionlint\.mjs -no-color \.github\/workflows\/deployment-witness-ledger\.yml/],
  ];
  for (const [label, source, pattern] of checks) if (!pattern.test(source)) problems.push(label);

  if (countLiteral(ledger, LOCK) !== 1) problems.push(`ledger lock count drift (${countLiteral(ledger, LOCK)}/1)`);
  if (countLiteral(ledger, PINS.githubScript) !== 2) problems.push('github-script pin/count drift');
  if (countLiteral(ledger, PINS.checkout) !== 1) problems.push('checkout pin/count drift');
  if (countLiteral(ledger, PINS.download) !== 2) problems.push('download-artifact pin/count drift');
  if (/uses:\s*actions\/(?:github-script|checkout|download-artifact)@v\d+/i.test(ledger)) problems.push('mutable privileged ledger action');
  if (/(?:issues|pull-requests):\s*write/.test(resolver)) problems.push('resolver owns repository write');
  if (/^  (?:issues|pull-requests):\s*write/m.test(ledger)) problems.push('top-level ledger owns repository write');
  if (/^  (?:issues|pull-requests):\s*(?:read|write)/m.test(deploy)) problems.push('release workflow owns repository projection permission');
  if (/actions\/checkout@|\bnpm ci\b|strangler:build/.test(releaseDeploy)) problems.push('privileged Pages job rebuilds or checks out source');
  return problems;
}

const sources = {
  deploy: read('.github/workflows/deploy.yml'),
  ledger: read('.github/workflows/deployment-witness-ledger.yml'),
  workflow: read('.github/workflows/tts-download-consent.yml'),
  recorder: read('scripts/record-deployment-witness.cjs'),
};
assert.deepEqual(validate(sources), []);
assert.equal(writerLock('30169443420'), writerLock(' 30169443420 '));
assert.equal(writerLock('30169443420'), writerLock('030169443420'));
assert.notEqual(writerLock('30169443420'), writerLock('30169443421'));
for (const invalid of ['', '0', '-1', '1e3', String(Number.MAX_SAFE_INTEGER + 1)]) assert.throws(() => writerLock(invalid));

const mutations = [
  ['release gains issue write', { ...sources, deploy: sources.deploy.replace('  contents: read\n', '  contents: read\n  issues: write\n') }],
  ['release deploy rebuilds', { ...sources, deploy: sources.deploy.replace('name: Download exact same-run release candidate', 'run: npm run strangler:build:production-like\n\n      - name: Download exact same-run release candidate') }],
  ['generic evidence downgraded', { ...sources, deploy: sources.deploy.replace('if-no-files-found: error', 'if-no-files-found: warn') }],
  ['generic and TTS order reversed', { ...sources, deploy: sources.deploy.replace('Verify generic live release contract', '__GENERIC__').replace('Verify live TTS capability extension', 'Verify generic live release contract').replace('__GENERIC__', 'Verify live TTS capability extension') }],
  ['manual replay removed', { ...sources, ledger: sources.ledger.replace(/\n  workflow_dispatch:[\s\S]*?\n\npermissions:/, '\n\npermissions:') }],
  ['resolver success assertion bypassed', { ...sources, ledger: sources.ledger.replace("assert.equal(workflowRun.conclusion, 'success', 'requested deploy run did not succeed');", "assert.equal('success', 'success');") }],
  ['resolver repository assertion removed', { ...sources, ledger: sources.ledger.replace('requested deploy run belongs to a foreign repository', 'repository unchecked') }],
  ['canonical lock removed', { ...sources, ledger: sources.ledger.replace(/\n    concurrency:[\s\S]*?\n\n    steps:/, '\n\n    steps:') }],
  ['canonical lock detached', { ...sources, ledger: sources.ledger.replace('needs.resolve.outputs.run_id', 'github.run_id') }],
  ['writer cancellation enabled', { ...sources, ledger: sources.ledger.replace('cancel-in-progress: false', 'cancel-in-progress: true') }],
  ['writer loses PR write', { ...sources, ledger: sources.ledger.replace('pull-requests: write', 'pull-requests: read') }],
  ['generic download removed', { ...sources, ledger: sources.ledger.replace(/\n      - name: Download exact-run generic release evidence[\s\S]*?github-token: \$\{\{ github\.token \}\}\n/, '\n') }],
  ['TTS artifact name flattened', { ...sources, ledger: sources.ledger.replace('tts-live-deployment-${{ needs.resolve.outputs.run_id }}', 'tts-live-deployment-latest') }],
  ['download run unpinned', { ...sources, ledger: sources.ledger.replace('run-id: ${{ needs.resolve.outputs.run_id }}', 'run-id: ${{ github.run_id }}') }],
  ['github-script mutable', { ...sources, ledger: sources.ledger.replaceAll(PINS.githubScript, 'actions/github-script@v7') }],
  ['checkout mutable', { ...sources, ledger: sources.ledger.replace(PINS.checkout, 'actions/checkout@v4') }],
  ['download mutable', { ...sources, ledger: sources.ledger.replaceAll(PINS.download, 'actions/download-artifact@v4') }],
  ['candidate artifact flattened', { ...sources, recorder: sources.recorder.replace('pages-release-candidate-${runId}-${runAttempt}', 'pages-release-candidate-latest') }],
  ['generic PASS bypassed', { ...sources, recorder: sources.recorder.replace("assert.equal(generic.result, 'PASS'", "assert.equal('PASS', 'PASS'") }],
  ['candidate transport ID unchecked', { ...sources, recorder: sources.recorder.replace('generic witness transport artifact ID mismatch', 'transport unchecked') }],
  ['generic digest unchecked', { ...sources, recorder: sources.recorder.replace('generic release evidence candidate digest mismatch', 'candidate unchecked') }],
  ['TTS candidate unchecked', { ...sources, recorder: sources.recorder.replace('TTS witness candidate digest mismatch', 'TTS candidate unchecked') }],
  ['envelope downgraded', { ...sources, recorder: sources.recorder.replace('deployment-release-witness', 'deployment-capability-witness') }],
  ['comment marker shortened', { ...sources, recorder: sources.recorder.replace('deployment-release-witness:${sha}:${runId}:${runAttempt}:${candidateArtifact.id}:${genericArtifact.id}:${ttsArtifact.id}', 'deployment-release-witness:${sha.slice(0, 7)}') }],
  ['recorder test skipped', { ...sources, workflow: sources.workflow.replace('node scripts/record-deployment-witness-contract-test.cjs', 'echo recorder skipped') }],
  ['ledger lint skipped', { ...sources, workflow: sources.workflow.replace('node scripts/run-actionlint.mjs -no-color .github/workflows/deployment-witness-ledger.yml', 'echo ledger lint skipped') }],
];
for (const [name, mutated] of mutations) assert.ok(validate(mutated).length > 0, `${name}: mutation must be rejected`);
console.log(`Deployment release ledger source contract: PASS (${mutations.length} named mutations rejected).`);
