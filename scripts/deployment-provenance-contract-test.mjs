#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

function validate({ writer, live, deploy, workflow }) {
  const problems = [];
  const checks = [
    ['writer requires exact SHA', writer, /DEPLOYED_SHA must be an exact 40-character commit SHA/],
    ['writer hashes dist files', writer, /function readDist\([\s\S]{0,260}path\.join\(DIST, relativePath\)/],
    ['writer rejects missing dist asset', writer, /dist asset is missing:/],
    ['writer never hashes root asset helper', writer, /function readDist/],
    ['writer stores immutable SHA filename', writer, /path\.join\(outputDir, `\$\{commitSha\}\.json`\)/],
    ['writer publishes under dist deployments', writer, /path\.join\(DIST, 'deployments'\)/],
    ['writer records MD5 and SHA-256', writer, /createHash\('md5'\)[\s\S]*createHash\('sha256'\)/],
    ['writer records exact TTS asset set', writer, /floating-cluster-controller\.js[\s\S]*vosk-tts-engine\.js[\s\S]*tts-download-notice\.css[\s\S]*sw\.js/],
    ['writer imports canonical lazy policy', writer, /LAZY_NO_PRECACHE[\s\S]{0,220}cache-bust-assets\.js/],
    ['writer requires lazy engine and CSS', writer, /LAZY_NO_PRECACHE\.includes\(requiredLazyAsset\)/],
    ['live verifier requires built dist', live, /dist must exist before live deployment verification/],
    ['live verifier hashes dist files', live, /function readDeployedBuffer\([\s\S]{0,300}path\.join\(DIST, relativePath\)/],
    ['live verifier requests immutable SHA path', live, /provenancePath:\s*`\/deployments\/\$\{DEPLOYED_SHA\}\.json`/],
    ['live verifier validates provenance object', live, /function assertProvenance\([\s\S]{0,5000}deployment provenance commit SHA mismatch/],
    ['live verifier invokes provenance assertion', live, /assertProvenance\(provenance\);/],
    ['live verifier compares SHA-256 chain', live, /controllerSha256[\s\S]*engineSha256[\s\S]*noticeCssSha256[\s\S]*serviceWorkerSha256/],
    ['live verifier checks SW no-precache', live, /live Service Worker precaches lazy TTS notice CSS[\s\S]*live Service Worker precaches lazy Vosk engine/],
    ['deploy writes provenance before upload', deploy, /- name: Write immutable deployment provenance[\s\S]{0,420}node scripts\/write-deployment-provenance\.mjs[\s\S]{0,300}- name: Upload Pages artifact/],
    ['deploy passes verified commit SHA', deploy, /DEPLOYED_SHA:[^\n]*workflow_run\.head_sha/],
    ['deploy preserves readiness run ID', deploy, /SOURCE_READINESS_RUN_ID:[^\n]*workflow_run\.id/],
    ['deploy verifies live after Pages', deploy, /- name: Deploy to GitHub Pages[\s\S]{0,900}- name: Verify live TTS deployment contract/],
    ['workflow owns provenance contract', workflow, /scripts\/deployment-provenance-contract-test\.mjs/],
    ['workflow owns provenance writer', workflow, /scripts\/write-deployment-provenance\.mjs/],
    ['workflow executes provenance contract', workflow, /node scripts\/deployment-provenance-contract-test\.mjs/],
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

  for (const ownedPath of [
    'scripts/deployment-provenance-contract-test.mjs',
    'scripts/write-deployment-provenance.mjs',
    'scripts/tts-live-deployment-contract.mjs',
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
  deploy: read('.github/workflows/deploy.yml'),
  workflow: read('.github/workflows/tts-download-consent.yml'),
};

assert.deepEqual(validate(sources), []);

const mutations = [
  ['writer switched to root bytes', { ...sources, writer: sources.writer.replace('path.join(DIST, relativePath)', 'path.join(ROOT, relativePath)') }],
  ['writer immutable filename flattened', { ...sources, writer: sources.writer.replace('`${commitSha}.json`', "'deployment.json'") }],
  ['writer SHA-256 removed', { ...sources, writer: sources.writer.replace("crypto.createHash('sha256')", "crypto.createHash('md5')") }],
  ['writer lazy policy bypassed', { ...sources, writer: sources.writer.replace('LAZY_NO_PRECACHE.includes(requiredLazyAsset)', 'true') }],
  ['live verifier switched to root bytes', { ...sources, live: sources.live.replace('path.join(DIST, relativePath)', 'path.join(ROOT, relativePath)') }],
  ['live immutable path flattened', { ...sources, live: sources.live.replace('`/deployments/${DEPLOYED_SHA}.json`', "'/deployment.json'") }],
  ['live provenance assertion removed', { ...sources, live: sources.live.replace('assertProvenance(provenance);', 'void provenance;') }],
  ['live Service Worker check removed', { ...sources, live: sources.live.replace('live Service Worker precaches lazy Vosk engine', 'unchecked Service Worker') }],
  ['deploy provenance generation removed', { ...sources, deploy: sources.deploy.replace('node scripts/write-deployment-provenance.mjs', 'echo provenance skipped') }],
  ['deploy provenance moved after upload', { ...sources, deploy: sources.deploy.replace(/(\s+- name: Write immutable deployment provenance[\s\S]*?run: node scripts\/write-deployment-provenance\.mjs\n)([\s\S]*?)(\s+- name: Upload Pages artifact[\s\S]*?path: dist\n)/, '$2$3$1') }],
  ['workflow contract execution removed', { ...sources, workflow: sources.workflow.replace('node scripts/deployment-provenance-contract-test.mjs', 'echo provenance contract skipped') }],
  ['workflow writer ownership removed', { ...sources, workflow: sources.workflow.replace(/^      - "scripts\/write-deployment-provenance\.mjs"\n/gm, '') }],
];

for (const [name, mutated] of mutations) {
  assert.ok(validate(mutated).length > 0, `${name}: mutation must be rejected`);
}

console.log(`Deployment provenance contract: PASS (${mutations.length} named adversarial mutations rejected).`);
