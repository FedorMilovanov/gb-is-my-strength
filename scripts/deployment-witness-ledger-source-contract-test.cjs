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

function countLiteral(source, literal) { return source.split(literal).length - 1; }
function canonicalRunId(value) {
  const requested = String(value || '').trim();
  assert.match(requested, /^\d+$/, 'deploy run ID must contain decimal digits only');
  const requestedNumber = Number(requested);
  assert.ok(Number.isSafeInteger(requestedNumber) && requestedNumber > 0, 'deploy run ID must be a positive safe integer');
  return String(requestedNumber);
}
function writerLock(value) { return `deployment-witness-${canonicalRunId(value)}`; }
function jobSection(workflow, name, nextName = null) {
  const marker = `\n  ${name}:\n`;
  const start = workflow.indexOf(marker);
  if (start === -1) return '';
  const offset = start + marker.length;
  if (!nextName) return workflow.slice(offset);
  const end = workflow.indexOf(`\n  ${nextName}:\n`, offset);
  return end === -1 ? workflow.slice(offset) : workflow.slice(offset, end);
}

function validate({ deploy, ledger, workflow, recorder }) {
  const problems = [];
  const releaseReadiness = jobSection(deploy, 'readiness', 'deploy');
  const releaseDeploy = jobSection(deploy, 'deploy');
  const resolver = jobSection(ledger, 'resolve', 'record');
  const writer = jobSection(ledger, 'record');
  const checks = [
    ['release top-level remains contents read', deploy, /^permissions:\s*\n\s*contents:\s*read\s*$/m],
    ['release readiness remains read-only', releaseReadiness, /permissions:\s*\n\s*contents:\s*read/],
    ['release deploy owns exact promotion permissions', releaseDeploy, /permissions:\s*\n\s*actions:\s*read\s*\n\s*contents:\s*read\s*\n\s*pages:\s*write\s*\n\s*id-token:\s*write/],
    ['release generic evidence upload remains diagnostic', releaseDeploy, /name:\s*Upload generic live release evidence[\s\S]{0,100}if:\s*always\(\)/],
    ['release generic evidence absence is blocking', releaseDeploy, /name:\s*release-live-deployment-\$\{\{ github\.run_id \}\}[\s\S]{0,220}if-no-files-found:\s*error/],
    ['release TTS evidence upload remains diagnostic', releaseDeploy, /name:\s*Upload live TTS capability evidence[\s\S]{0,100}if:\s*always\(\)/],
    ['release TTS evidence absence is blocking', releaseDeploy, /name:\s*tts-live-deployment-\$\{\{ github\.run_id \}\}[\s\S]{0,220}if-no-files-found:\s*error/],
    ['release generic live precedes TTS extension', releaseDeploy, /Verify generic live release contract[\s\S]*Verify live TTS capability extension/],

    ['ledger owns successful Pages workflow_run entry', ledger, /workflow_run:[\s\S]{0,140}workflows:\s*\["Deploy to GitHub Pages"\][\s\S]{0,100}types:\s*\[completed\]/],
    ['ledger owns explicit manual replay', ledger, /workflow_dispatch:[\s\S]{0,180}deploy_run_id:[\s\S]{0,120}required:\s*true/],
    ['ledger workflow defaults to contents read', ledger, /^permissions:\s*\n\s*contents:\s*read\s*$/m],
    ['resolver job exists', ledger, /^  resolve:\s*\n\s*name:\s*Resolve exact deployment witness target$/m],
    ['resolver has read-only capabilities', resolver, /permissions:\s*\n\s*actions:\s*read\s*\n\s*contents:\s*read/],
    ['resolver exports canonical ID', resolver, /outputs:[\s\S]{0,180}run_id:\s*\$\{\{ steps\.resolve\.outputs\.run_id \}\}/],
    ['resolver exports exact SHA', resolver, /outputs:[\s\S]{0,230}head_sha:\s*\$\{\{ steps\.resolve\.outputs\.head_sha \}\}/],
    ['resolver exports trusted source ref', resolver, /outputs:[\s\S]{0,300}recorder_ref:\s*\$\{\{ steps\.resolve\.outputs\.recorder_ref \}\}/],
    ['automatic resolver requires success', resolver, /workflow_run\.conclusion == 'success'/],
    ['automatic resolver requires main', resolver, /workflow_run\.head_branch == 'main'/],
    ['automatic resolver requires same repo', resolver, /workflow_run\.head_repository\.full_name == github\.repository/],
    ['manual resolver is main-only', resolver, /github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/],
    ['resolver trims manual input', resolver, /deploy_run_id \|\| ''\)\.trim\(\)/],
    ['resolver validates decimal syntax', resolver, /assert\.match\(requested, \/\^\\d\+\$\/[\s\S]{0,80}deploy_run_id must be numeric/],
    ['resolver validates positive safe integer', resolver, /Number\.isSafeInteger\(requestedNumber\) && requestedNumber > 0[\s\S]{0,100}positive safe integer/],
    ['manual resolver fetches exact Actions run', resolver, /context\.eventName === 'workflow_dispatch'[\s\S]{0,360}github\.rest\.actions\.getWorkflowRun[\s\S]{0,160}run_id:\s*requestedNumber/],
    ['resolver invokes ID assertion', resolver, /assert\.equal\(Number\(workflowRun\.id\), requestedNumber, 'resolved deploy run ID mismatch'\);/],
    ['resolver invokes workflow assertion', resolver, /assert\.equal\(workflowRun\.name, 'Deploy to GitHub Pages', 'requested run is not the Pages deploy workflow'\);/],
    ['resolver invokes success assertion', resolver, /assert\.equal\(workflowRun\.conclusion, 'success', 'requested deploy run did not succeed'\);/],
    ['resolver invokes repository assertion', resolver, /requested deploy run belongs to a foreign repository/],
    ['resolver invokes SHA assertion', resolver, /requested deploy run lacks an exact SHA/],
    ['resolver emits canonical API ID', resolver, /core\.setOutput\('run_id', String\(workflowRun\.id\)\);/],
    ['manual replay uses current trusted recorder', resolver, /context\.eventName === 'workflow_dispatch' \? context\.sha : workflowRun\.head_sha/],

    ['writer depends on resolver', writer, /needs:\s*resolve/],
    ['writer owns exact repository permissions', writer, /permissions:\s*\n\s*actions:\s*read\s*\n\s*contents:\s*read\s*\n\s*issues:\s*write\s*\n\s*pull-requests:\s*write/],
    ['writer locks by canonical resolver output', writer, /concurrency:\s*\n\s*group:\s*deployment-witness-\$\{\{ needs\.resolve\.outputs\.run_id \}\}/],
    ['writer never cancels evidence projection', writer, /concurrency:[\s\S]{0,140}cancel-in-progress:\s*false/],
    ['writer checkout uses trusted ref', writer, /ref:\s*\$\{\{ needs\.resolve\.outputs\.recorder_ref \}\}/],
    ['writer checkout drops credentials', writer, /persist-credentials:\s*false/],
    ['writer downloads generic live artifact', writer, /name:\s*release-live-deployment-\$\{\{ needs\.resolve\.outputs\.run_id \}\}[\s\S]{0,180}path:\s*\$\{\{ runner\.temp \}\}\/deployment-witness\/release/],
    ['writer downloads TTS capability artifact', writer, /name:\s*tts-live-deployment-\$\{\{ needs\.resolve\.outputs\.run_id \}\}[\s\S]{0,180}path:\s*\$\{\{ runner\.temp \}\}\/deployment-witness\/tts/],
    ['writer pins both downloads to target run', writer, /run-id:\s*\$\{\{ needs\.resolve\.outputs\.run_id \}\}[\s\S]*run-id:\s*\$\{\{ needs\.resolve\.outputs\.run_id \}\}/],
    ['writer refetches exact run', writer, /Revalidate target and record witness[\s\S]{0,1000}github\.rest\.actions\.getWorkflowRun/],
    ['writer invokes exact SHA assertion', writer, /writer target deploy SHA mismatch/],
    ['writer invokes trusted recorder', writer, /require\('\.\/scripts\/record-deployment-witness\.cjs'\)/],

    ['recorder requires candidate artifact', recorder, /pages-release-candidate-\$\{runId\}-\$\{runAttempt\}/],
    ['recorder requires generic live artifact', recorder, /release-live-deployment-\$\{runId\}/],
    ['recorder requires TTS artifact', recorder, /tts-live-deployment-\$\{runId\}/],
    ['recorder rejects expired artifacts', recorder, /artifact\.expired, false/],
    ['recorder requires artifact digests', recorder, /artifact digest is missing or invalid/],
    ['recorder verifies generic PASS', recorder, /generic\.result, 'PASS'/],
    ['recorder verifies generic repo SHA run attempt', recorder, /generic\.repository, repository[\s\S]*generic\.commitSha, sha[\s\S]*generic\.workflowRunId, runId[\s\S]*generic\.workflowRunAttempt, runAttempt/],
    ['recorder binds candidate transport ID and digest', recorder, /transport artifact ID mismatch[\s\S]*transport artifact digest mismatch/],
    ['recorder verifies candidate tree digest', recorder, /generic release candidate digest is missing or invalid[\s\S]*generic release evidence candidate digest mismatch/],
    ['recorder verifies TTS candidate equality', recorder, /TTS witness candidate digest mismatch[\s\S]*TTS discovery candidate digest mismatch[\s\S]*TTS provenance candidate digest mismatch/],
    ['recorder creates generic release envelope', recorder, /kind:\s*'deployment-release-witness'[\s\S]*releaseCandidate:[\s\S]*liveWitnessArtifact:[\s\S]*extensions:[\s\S]*tts:/],
    ['recorder uses exact release comment marker', recorder, /deployment-release-witness:\$\{sha\}:\$\{runId\}:\$\{runAttempt\}:\$\{candidateArtifact\.id\}:\$\{genericArtifact\.id\}:\$\{ttsArtifact\.id\}/],
    ['recorder supports release and legacy target markers', recorder, /deployment-witness-target:release:\$\{sha\}[\s\S]*deployment-witness-target:tts:\$\{sha\}/],
    ['recorder targets exact merge SHA', recorder, /normalize\(pull\.merge_commit_sha\)\.toLowerCase\(\) === sha/],
    ['recorder uses truthful release wording', recorder, /Release candidate witness accepted[\s\S]*same candidate bytes/],

    ['TTS workflow owns recorder source', workflow, /scripts\/record-deployment-witness\.cjs/],
    ['TTS workflow owns recorder unit contract', workflow, /scripts\/record-deployment-witness-contract-test\.cjs/],
    ['TTS workflow owns ledger source contract', workflow, /scripts\/deployment-witness-ledger-source-contract-test\.cjs/],
    ['TTS workflow owns ledger workflow', workflow, /\.github\/workflows\/deployment-witness-ledger\.yml/],
    ['TTS workflow executes recorder unit contract', workflow, /node scripts\/record-deployment-witness-contract-test\.cjs/],
    ['TTS workflow executes ledger source contract', workflow, /node scripts\/deployment-witness-ledger-source-contract-test\.cjs/],
    ['TTS workflow lints ledger workflow', workflow, /run-actionlint\.mjs -no-color \.github\/workflows\/deployment-witness-ledger\.yml/],
  ];
  for (const [label, source, pattern] of checks) if (!pattern.test(source)) problems.push(label);

  if (countLiteral(ledger, CANONICAL_CONCURRENCY_GROUP) !== 1) problems.push(`ledger canonical concurrency drift (${countLiteral(ledger, CANONICAL_CONCURRENCY_GROUP)}/1)`);
  if (/concurrency:[\s\S]{0,160}(?:inputs\.deploy_run_id|github\.event\.workflow_run\.id|github\.run_id)/.test(ledger)) problems.push('writer concurrency uses raw event/input/current run identity');
  if (/^  (?:issues|pull-requests):\s*write/m.test(ledger)) problems.push('ledger workflow grants write permission outside writer job');
  if (/(?:issues|pull-requests):\s*write/.test(resolver)) problems.push('resolver job owns repository write permission');
  if (countLiteral(ledger, ACTION_PINS.githubScript) !== 2) problems.push(`ledger github-script pin drift (${countLiteral(ledger, ACTION_PINS.githubScript)}/2)`);
  if (countLiteral(ledger, ACTION_PINS.checkout) !== 1) problems.push(`ledger checkout pin drift (${countLiteral(ledger, ACTION_PINS.checkout)}/1)`);
  if (countLiteral(ledger, ACTION_PINS.downloadArtifact) !== 2) problems.push(`ledger download-artifact pin drift (${countLiteral(ledger, ACTION_PINS.downloadArtifact)}/2)`);
  if (/uses:\s*actions\/(?:github-script|checkout|download-artifact)@v\d+/i.test(ledger)) problems.push('privileged ledger uses mutable action tag');
  if (/^  issues:\s*write/m.test(deploy) || /^  pull-requests:\s*(?:read|write)/m.test(deploy)) problems.push('release workflow owns repository projection permission');
  if (/Record live deployment acceptance|record-live-deployment-acceptance/.test(deploy)) problems.push('release workflow records repository acceptance inline');
  if (/Production deployment accepted/.test(recorder)) problems.push('recorder overclaims unbounded production acceptance');
  if (/exactAcceptanceTitle|issue\.title ===/.test(recorder)) problems.push('recorder targets mutable human issue title');
  const releaseDeploy = jobSection(deploy, 'deploy');
  if (/actions\/checkout@|\bnpm ci\b|strangler:build/.test(releaseDeploy)) problems.push('privileged Pages deploy rebuilds or checks out source');
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
  ['release repository write introduced', { ...sources, deploy: sources.deploy.replace('  contents: read\n', '  contents: read\n  issues: write\n') }],
  ['release deploy rebuild introduced', { ...sources, deploy: sources.deploy.replace('name: Download exact same-run release candidate', 'run: npm run strangler:build:production-like\n\n      - name: Download exact same-run release candidate') }],
  ['generic evidence missing downgraded', { ...sources, deploy: sources.deploy.replace('if-no-files-found: error', 'if-no-files-found: warn') }],
  ['generic live ordering reversed', { ...sources, deploy: sources.deploy.replace('Verify generic live release contract', '__GENERIC__').replace('Verify live TTS capability extension', 'Verify generic live release contract').replace('__GENERIC__', 'Verify live TTS capability extension') }],
  ['manual replay removed', { ...sources, ledger: sources.ledger.replace(/\n  workflow_dispatch:[\s\S]*?\n\npermissions:/, '\n\npermissions:') }],
  ['resolver repository gate removed', { ...sources, ledger: sources.ledger.replace('requested deploy run belongs to a foreign repository', 'repository unchecked') }],
  ['resolver success gate removed', { ...sources, ledger: sources.ledger.replace("assert.equal(workflowRun.conclusion, 'success', 'requested deploy run did not succeed');", "assert.equal('success', 'success');") }],
  ['canonical concurrency removed', { ...sources, ledger: sources.ledger.replace(/\n    concurrency:[\s\S]*?\n\n    steps:/, '\n\n    steps:') }],
  ['concurrency cancellation enabled', { ...sources, ledger: sources.ledger.replace('cancel-in-progress: false', 'cancel-in-progress: true') }],
  ['concurrency detached from resolver', { ...sources, ledger: sources.ledger.replace('needs.resolve.outputs.run_id', 'github.run_id') }],
  ['resolver gains issue write', { ...sources, ledger: sources.ledger.replace('  resolve:\n', '  resolve:\n    permissions:\n      issues: write\n') }],
  ['writer loses PR write', { ...sources, ledger: sources.ledger.replace('pull-requests: write', 'pull-requests: read') }],
  ['generic evidence download removed', { ...sources, ledger: sources.ledger.replace(/\n      - name: Download exact-run generic release evidence[\s\S]*?github-token: \$\{\{ github\.token \}\}\n/, '\n') }],
  ['TTS evidence download flattened', { ...sources, ledger: sources.ledger.replace('tts-live-deployment-${{ needs.resolve.outputs.run_id }}', 'tts-live-deployment-latest') }],
  ['download run unpinned', { ...sources, ledger: sources.ledger.replace('run-id: ${{ needs.resolve.outputs.run_id }}', 'run-id: ${{ github.run_id }}') }],
  ['writer SHA revalidation removed', { ...sources, ledger: sources.ledger.replace('writer target deploy SHA mismatch', 'writer SHA unchecked') }],
  ['github-script pin made mutable', { ...sources, ledger: sources.ledger.replaceAll(ACTION_PINS.githubScript, 'actions/github-script@v7') }],
  ['checkout pin made mutable', { ...sources, ledger: sources.ledger.replace(ACTION_PINS.checkout, 'actions/checkout@v4') }],
  ['download pins made mutable', { ...sources, ledger: sources.ledger.replaceAll(ACTION_PINS.downloadArtifact, 'actions/download-artifact@v4') }],
  ['candidate artifact identity removed', { ...sources, recorder: sources.recorder.replace('pages-release-candidate-${runId}-${runAttempt}', 'pages-release-candidate-latest') }],
  ['generic PASS check removed', { ...sources, recorder: sources.recorder.replace("assert.equal(generic.result, 'PASS'", "assert.equal('PASS', 'PASS'") }],
  ['candidate transport binding removed', { ...sources, recorder: sources.recorder.replace('generic witness transport artifact ID mismatch', 'transport unchecked') }],
  ['candidate digest equality removed', { ...sources, recorder: sources.recorder.replace('generic release evidence candidate digest mismatch', 'candidate digest unchecked') }],
  ['TTS candidate binding removed', { ...sources, recorder: sources.recorder.replace('TTS witness candidate digest mismatch', 'TTS candidate unchecked') }],
  ['release envelope downgraded', { ...sources, recorder: sources.recorder.replace('deployment-release-witness', 'deployment-capability-witness') }],
  ['release marker shortened', { ...sources, recorder: sources.recorder.replace('deployment-release-witness:${sha}:${runId}:${runAttempt}:${candidateArtifact.id}:${genericArtifact.id}:${ttsArtifact.id}', 'deployment-release-witness:${sha.slice(0, 7)}') }],
  ['workflow recorder execution removed', { ...sources, workflow: sources.workflow.replace('node scripts/record-deployment-witness-contract-test.cjs', 'echo recorder test skipped') }],
  ['workflow ledger actionlint removed', { ...sources, workflow: sources.workflow.replace('node scripts/run-actionlint.mjs -no-color .github/workflows/deployment-witness-ledger.yml', 'echo ledger lint skipped') }],
];
for (const [name, mutated] of mutations) assert.ok(validate(mutated).length > 0, `${name}: mutation must be rejected`);
console.log(`Deployment release ledger source contract: PASS (${mutations.length} named permission/concurrency/artifact/release mutations rejected).`);
