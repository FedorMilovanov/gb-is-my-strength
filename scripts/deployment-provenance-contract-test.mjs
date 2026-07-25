#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

function validate({ writer, live, recorder, deploy, workflow }) {
  const problems = [];
  const checks = [
    ['writer requires exact SHA', writer, /DEPLOYED_SHA must be an exact 40-character commit SHA/],
    ['writer requires exact run ID', writer, /GITHUB_RUN_ID must be numeric/],
    ['writer requires exact run attempt', writer, /GITHUB_RUN_ATTEMPT must be numeric/],
    ['writer hashes dist files', writer, /function readDist\([\s\S]{0,260}path\.join\(DIST, relativePath\)/],
    ['writer rejects missing dist asset', writer, /dist asset is missing:/],
    ['writer never hashes root asset helper', writer, /function readDist/],
    ['writer stores run-addressed filename', writer, /path\.join\(outputDir, `\$\{runIdentity\}\.json`\)/],
    ['writer nests run object under commit SHA', writer, /path\.join\(deploymentsDir, commitSha\)/],
    ['writer publishes current discovery pointer', writer, /path\.join\(deploymentsDir, 'current\.json'\)/],
    ['writer records MD5 and SHA-256', writer, /createHash\('md5'\)[\s\S]*createHash\('sha256'\)/],
    ['writer records exact TTS asset set', writer, /floating-cluster-controller\.js[\s\S]*vosk-tts-engine\.js[\s\S]*tts-download-notice\.css[\s\S]*sw\.js/],
    ['writer imports canonical lazy policy', writer, /LAZY_NO_PRECACHE[\s\S]{0,220}cache-bust-assets\.js/],
    ['writer requires lazy engine and CSS', writer, /LAZY_NO_PRECACHE\.includes\(requiredLazyAsset\)/],
    ['live verifier requires built dist', live, /dist must exist before live deployment verification/],
    ['live verifier requires current run identity', live, /GITHUB_RUN_ID must be numeric[\s\S]*GITHUB_RUN_ATTEMPT must be numeric/],
    ['live verifier hashes dist files', live, /function readDeployedBuffer\([\s\S]{0,300}path\.join\(DIST, relativePath\)/],
    ['live verifier requests current pointer', live, /currentPointerPath:\s*'\/deployments\/current\.json'/],
    ['live verifier requests run-addressed object', live, /provenancePath:\s*`\/deployments\/\$\{DEPLOYED_SHA\}\/\$\{runIdentity\}\.json`/],
    ['live verifier validates current pointer', live, /function assertCurrentPointer\([\s\S]{0,2600}deployment current pointer run attempt mismatch/],
    ['live verifier invokes current pointer assertion', live, /assertCurrentPointer\(pointer\);/],
    ['live verifier validates provenance object', live, /function assertProvenance\([\s\S]{0,5000}deployment provenance commit SHA mismatch/],
    ['live verifier invokes provenance assertion', live, /assertProvenance\(provenance\);/],
    ['live verifier compares SHA-256 chain', live, /controllerSha256[\s\S]*engineSha256[\s\S]*noticeCssSha256[\s\S]*serviceWorkerSha256/],
    ['live verifier checks SW no-precache', live, /live Service Worker precaches lazy TTS notice CSS[\s\S]*live Service Worker precaches lazy Vosk engine/],
    ['recorder requires exact SHA', recorder, /deployedSha must be an exact 40-character SHA/],
    ['recorder requires canonical current pointer', recorder, /assert\.equal\(currentPointer, 'https:\/\/gospod-bog\.ru\/deployments\/current\.json'/],
    ['recorder requires run-addressed provenance', recorder, /provenance URL must be run-addressed under the exact SHA/],
    ['recorder uses idempotent run-attempt marker', recorder, /deployment-acceptance:\$\{sha\}:\$\{runId\}:\$\{runAttempt\}/],
    ['recorder targets exact acceptance title', recorder, /issue\.title === expectedTitle/],
    ['recorder targets exact merge SHA', recorder, /normalize\(pull\.merge_commit_sha\)\.toLowerCase\(\) === sha/],
    ['recorder rejects ambiguous PRs', recorder, /multiple merged pull requests claim exact deployment SHA/],
    ['recorder rejects ambiguous issues', recorder, /multiple acceptance issues match exact title/],
    ['recorder closes completed acceptance issue', recorder, /state: 'closed'[\s\S]{0,100}state_reason: 'completed'/],
    ['recorder comments through issue API', recorder, /issues\.createComment/],
    ['deploy writes provenance before upload', deploy, /- name: Write immutable deployment provenance[\s\S]{0,420}node scripts\/write-deployment-provenance\.mjs[\s\S]{0,300}- name: Upload Pages artifact/],
    ['deploy checks out the same exact SHA', deploy, /ref:\s*\$\{\{\s*github\.event_name == 'workflow_run' && github\.event\.workflow_run\.head_sha \|\| github\.sha\s*\}\}/],
    ['deploy passes verified commit SHA', deploy, /DEPLOYED_SHA:[^\n]*workflow_run\.head_sha/],
    ['deploy preserves readiness run ID', deploy, /SOURCE_READINESS_RUN_ID:[^\n]*workflow_run\.id/],
    ['deploy verifies live after Pages', deploy, /- name: Deploy to GitHub Pages[\s\S]{0,900}- name: Verify live TTS deployment contract/],
    ['deploy grants issue write for exact acceptance', deploy, /^  issues: write\s+# фиксируем exact-SHA acceptance и закрываем точную задачу$/m],
    ['deploy grants PR read for merge SHA lookup', deploy, /^  pull-requests: read\s+# находим PR, породивший опубликованный merge SHA$/m],
    ['deploy records acceptance after evidence upload', deploy, /- name: Upload live TTS deployment evidence[\s\S]{0,900}- name: Record live deployment acceptance/],
    ['deploy invokes acceptance recorder', deploy, /require\('\.\/scripts\/record-live-deployment-acceptance\.cjs'\)/],
    ['deploy passes canonical current pointer', deploy, /CURRENT_POINTER_URL:\s*https:\/\/gospod-bog\.ru\/deployments\/current\.json/],
    ['deploy passes run-addressed provenance URL', deploy, /PROVENANCE_URL:\s*https:\/\/gospod-bog\.ru\/deployments\/\$\{\{[^\n]+\}\}\/\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}\.json/],
    ['deploy passes run-scoped artifact name', deploy, /ARTIFACT_NAME:\s*tts-live-deployment-\$\{\{ github\.run_id \}\}/],
    ['workflow owns provenance contract', workflow, /scripts\/deployment-provenance-contract-test\.mjs/],
    ['workflow owns provenance writer', workflow, /scripts\/write-deployment-provenance\.mjs/],
    ['workflow owns acceptance recorder', workflow, /scripts\/record-live-deployment-acceptance\.cjs/],
    ['workflow owns acceptance recorder test', workflow, /scripts\/record-live-deployment-acceptance-contract-test\.cjs/],
    ['workflow executes provenance contract', workflow, /node scripts\/deployment-provenance-contract-test\.mjs/],
    ['workflow executes acceptance recorder contract', workflow, /node scripts\/record-live-deployment-acceptance-contract-test\.cjs/],
  ];

  for (const [label, source, pattern] of checks) {
    if (!pattern.test(source)) problems.push(label);
  }

  if (/function read\(relativePath\)[\s\S]{0,160}path\.join\(ROOT, relativePath\)/.test(writer)) {
    problems.push('writer still hashes root files');
  }
  if (/function readBuffer\(relativePath\)[\s\S]{0,160}path\.join\(ROOT, relativePath\)/.test(live)) {
    problems.push('live verifier still hashes root files');
  }
  if (/ref:\s*\$\{\{[^\n]*\|\|\s*'main'\s*\}\}/.test(deploy)) {
    problems.push('deploy still checks out moving main');
  }
  if (/issue\.title\.includes\(expectedTitle\)/.test(recorder)) {
    problems.push('recorder accepts partial issue title matches');
  }

  for (const ownedPath of [
    'scripts/deployment-provenance-contract-test.mjs',
    'scripts/write-deployment-provenance.mjs',
    'scripts/tts-live-deployment-contract.mjs',
    'scripts/record-live-deployment-acceptance.cjs',
    'scripts/record-live-deployment-acceptance-contract-test.cjs',
    '.github/workflows/deploy.yml',
    '.github/workflows/tts-download-consent.yml',
  ]) {
    const escaped = ownedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const count = (workflow.match(new RegExp(`^      - "${escaped}"$`, 'gm')) || []).length;
    if (count !== 2) problems.push(`workflow ownership drift: ${ownedPath} (${count}/2)`);
  }

  return problems;
}

const sources = {
  writer: read('scripts/write-deployment-provenance.mjs'),
  live: read('scripts/tts-live-deployment-contract.mjs'),
  recorder: read('scripts/record-live-deployment-acceptance.cjs'),
  deploy: read('.github/workflows/deploy.yml'),
  workflow: read('.github/workflows/tts-download-consent.yml'),
};

assert.deepEqual(validate(sources), []);

const mutations = [
  ['writer switched to root bytes', { ...sources, writer: sources.writer.replace('path.join(DIST, relativePath)', 'path.join(ROOT, relativePath)') }],
  ['writer run-addressed filename flattened', { ...sources, writer: sources.writer.replace('`${runIdentity}.json`', "'deployment.json'") }],
  ['writer commit directory flattened', { ...sources, writer: sources.writer.replace('path.join(deploymentsDir, commitSha)', 'deploymentsDir') }],
  ['writer current pointer renamed', { ...sources, writer: sources.writer.replace("path.join(deploymentsDir, 'current.json')", "path.join(deploymentsDir, 'latest.json')") }],
  ['writer SHA-256 removed', { ...sources, writer: sources.writer.replace("crypto.createHash('sha256')", "crypto.createHash('md5')") }],
  ['writer lazy policy bypassed', { ...sources, writer: sources.writer.replace('LAZY_NO_PRECACHE.includes(requiredLazyAsset)', 'true') }],
  ['live verifier switched to root bytes', { ...sources, live: sources.live.replace('path.join(DIST, relativePath)', 'path.join(ROOT, relativePath)') }],
  ['live run-addressed path flattened', { ...sources, live: sources.live.replace('`/deployments/${DEPLOYED_SHA}/${runIdentity}.json`', "'/deployment.json'") }],
  ['live current pointer assertion removed', { ...sources, live: sources.live.replace('assertCurrentPointer(pointer);', 'void pointer;') }],
  ['live provenance assertion removed', { ...sources, live: sources.live.replace('assertProvenance(provenance);', 'void provenance;') }],
  ['live Service Worker check removed', { ...sources, live: sources.live.replace('live Service Worker precaches lazy Vosk engine', 'unchecked Service Worker') }],
  ['recorder exact issue match weakened', { ...sources, recorder: sources.recorder.replace('issue.title === expectedTitle', 'issue.title.includes(expectedTitle)') }],
  ['recorder exact merge SHA removed', { ...sources, recorder: sources.recorder.replace('normalize(pull.merge_commit_sha).toLowerCase() === sha', 'true') }],
  ['recorder issue close removed', { ...sources, recorder: sources.recorder.replace("state: 'closed'", "state: 'open'") }],
  ['recorder idempotency marker flattened', { ...sources, recorder: sources.recorder.replace('${sha}:${runId}:${runAttempt}', '${sha}') }],
  ['recorder current pointer flattened', { ...sources, recorder: sources.recorder.replace('https://gospod-bog.ru/deployments/current.json', 'https://gospod-bog.ru/deployments/latest.json') }],
  ['deploy provenance generation removed', { ...sources, deploy: sources.deploy.replace('node scripts/write-deployment-provenance.mjs', 'echo provenance skipped') }],
  ['deploy provenance moved after upload', { ...sources, deploy: sources.deploy.replace(/(\s+- name: Write immutable deployment provenance[\s\S]*?run: node scripts\/write-deployment-provenance\.mjs\n)([\s\S]*?)(\s+- name: Upload Pages artifact[\s\S]*?path: dist\n)/, '$2$3$1') }],
  ['deploy manual checkout moved to main', { ...sources, deploy: sources.deploy.replace('|| github.sha }}', "|| 'main' }}") }],
  ['deploy issue write permission removed', { ...sources, deploy: sources.deploy.replace(/^  issues: write.*\n/m, '') }],
  ['deploy PR read permission removed', { ...sources, deploy: sources.deploy.replace(/^  pull-requests: read.*\n/m, '') }],
  ['deploy acceptance recorder removed', { ...sources, deploy: sources.deploy.replace("const recordAcceptance = require('./scripts/record-live-deployment-acceptance.cjs');", 'const recordAcceptance = async () => {};') }],
  ['deploy acceptance provenance flattened', { ...sources, deploy: sources.deploy.replace('/${{ github.run_id }}-${{ github.run_attempt }}.json', '.json') }],
  ['workflow contract execution removed', { ...sources, workflow: sources.workflow.replace('node scripts/deployment-provenance-contract-test.mjs', 'echo provenance contract skipped') }],
  ['workflow recorder test execution removed', { ...sources, workflow: sources.workflow.replace('node scripts/record-live-deployment-acceptance-contract-test.cjs', 'echo acceptance contract skipped') }],
  ['workflow writer ownership removed', { ...sources, workflow: sources.workflow.replace(/^      - "scripts\/write-deployment-provenance\.mjs"\n/gm, '') }],
  ['workflow recorder ownership removed', { ...sources, workflow: sources.workflow.replace(/^      - "scripts\/record-live-deployment-acceptance\.cjs"\n/gm, '') }],
];

for (const [name, mutated] of mutations) {
  assert.ok(validate(mutated).length > 0, `${name}: mutation must be rejected`);
}

const fixtureSha = 'a'.repeat(40);
const fixtureRunId = '123456789';
const fixtureRunAttempt = '2';
const fixtureAssets = [
  'js/floating-cluster-controller.js',
  'js/vosk-tts-engine.js',
  'css/tts-download-notice.css',
  'sw.js',
];

fs.rmSync(DIST, { recursive: true, force: true });
try {
  for (const relativePath of fixtureAssets) {
    const sourcePath = path.join(ROOT, relativePath);
    const targetPath = path.join(DIST, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }

  execFileSync(process.execPath, [path.join(ROOT, 'scripts/write-deployment-provenance.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      DEPLOYED_SHA: fixtureSha,
      GITHUB_REPOSITORY: 'FedorMilovanov/gb-is-my-strength',
      GITHUB_RUN_ID: fixtureRunId,
      GITHUB_RUN_ATTEMPT: fixtureRunAttempt,
      SOURCE_READINESS_RUN_ID: '987654321',
      GITHUB_EVENT_NAME: 'workflow_run',
    },
  });

  const exactPath = path.join(DIST, 'deployments', fixtureSha, `${fixtureRunId}-${fixtureRunAttempt}.json`);
  const pointerPath = path.join(DIST, 'deployments', 'current.json');
  const obsoleteFlatPath = path.join(DIST, 'deployments', `${fixtureSha}.json`);
  assert.equal(fs.existsSync(exactPath), true, 'writer fixture did not create the run-addressed object');
  assert.equal(fs.existsSync(pointerPath), true, 'writer fixture did not create current.json');
  assert.equal(fs.existsSync(obsoleteFlatPath), false, 'writer fixture recreated the mutable flat SHA object');

  const manifest = JSON.parse(fs.readFileSync(exactPath, 'utf8'));
  const pointer = JSON.parse(fs.readFileSync(pointerPath, 'utf8'));
  const expectedPath = `/deployments/${fixtureSha}/${fixtureRunId}-${fixtureRunAttempt}.json`;
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.commitSha, fixtureSha);
  assert.equal(manifest.immutablePath, expectedPath);
  assert.equal(manifest.workflow.runId, Number(fixtureRunId));
  assert.equal(manifest.workflow.runAttempt, Number(fixtureRunAttempt));
  assert.equal(pointer.schemaVersion, 1);
  assert.equal(pointer.commitSha, fixtureSha);
  assert.equal(pointer.immutablePath, expectedPath);
  assert.equal(pointer.workflow.runId, Number(fixtureRunId));
  assert.equal(pointer.workflow.runAttempt, Number(fixtureRunAttempt));
} finally {
  fs.rmSync(DIST, { recursive: true, force: true });
}

console.log(`Deployment provenance contract: PASS (${mutations.length} named adversarial mutations rejected; writer fixture PASS).`);
