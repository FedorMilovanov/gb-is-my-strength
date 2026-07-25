#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const require = createRequire(import.meta.url);
const { LAZY_NO_PRECACHE } = require('./cache-bust-assets.js');

const commitSha = String(process.env.DEPLOYED_SHA || '').trim().toLowerCase();
const repository = String(process.env.GITHUB_REPOSITORY || 'FedorMilovanov/gb-is-my-strength').trim();
const workflowRunId = String(process.env.GITHUB_RUN_ID || '').trim();
const workflowRunAttempt = String(process.env.GITHUB_RUN_ATTEMPT || '').trim();
const sourceReadinessRunId = String(process.env.SOURCE_READINESS_RUN_ID || '').trim();
const eventName = String(process.env.GITHUB_EVENT_NAME || '').trim();

assert.match(commitSha, /^[a-f0-9]{40}$/, 'DEPLOYED_SHA must be an exact 40-character commit SHA');
assert.match(repository, /^[^/\s]+\/[^/\s]+$/, 'GITHUB_REPOSITORY must be owner/name');
assert.match(workflowRunId, /^\d+$/, 'GITHUB_RUN_ID must be numeric');
assert.match(workflowRunAttempt, /^\d+$/, 'GITHUB_RUN_ATTEMPT must be numeric');
assert.ok(fs.existsSync(DIST) && fs.statSync(DIST).isDirectory(), 'dist must exist before writing deployment provenance');

const runIdentity = `${workflowRunId}-${workflowRunAttempt}`;
const assets = Object.freeze({
  controller: 'js/floating-cluster-controller.js',
  engine: 'js/vosk-tts-engine.js',
  noticeCss: 'css/tts-download-notice.css',
  serviceWorker: 'sw.js',
});

function readDist(relativePath) {
  const absolutePath = path.join(DIST, relativePath);
  assert.ok(fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile(), `dist asset is missing: ${relativePath}`);
  return fs.readFileSync(absolutePath);
}

function md5(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex').slice(0, 8);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function assetRecord(relativePath) {
  const bytes = readDist(relativePath);
  return {
    path: `/${relativePath}`,
    bytes: bytes.length,
    md5: md5(bytes),
    sha256: sha256(bytes),
  };
}

function workflowRecord() {
  return {
    name: 'Deploy to GitHub Pages',
    runId: Number(workflowRunId),
    runAttempt: Number(workflowRunAttempt),
    sourceReadinessRunId: /^\d+$/.test(sourceReadinessRunId) ? Number(sourceReadinessRunId) : null,
    eventName: eventName || null,
  };
}

function buildManifest(immutablePath) {
  return {
    schemaVersion: 2,
    repository,
    commitSha,
    immutablePath,
    generatedAt: new Date().toISOString(),
    workflow: workflowRecord(),
    tts: {
      assets: {
        controller: assetRecord(assets.controller),
        engine: assetRecord(assets.engine),
        noticeCss: assetRecord(assets.noticeCss),
        serviceWorker: assetRecord(assets.serviceWorker),
      },
      lazyNoPrecache: [assets.noticeCss, assets.engine],
    },
  };
}

function buildCurrentPointer(immutablePath) {
  return {
    schemaVersion: 1,
    repository,
    commitSha,
    immutablePath,
    workflow: workflowRecord(),
  };
}

for (const requiredLazyAsset of [assets.engine, assets.noticeCss]) {
  assert.ok(
    LAZY_NO_PRECACHE.includes(requiredLazyAsset),
    `${requiredLazyAsset} must remain in canonical LAZY_NO_PRECACHE policy`,
  );
}

const deploymentsDir = path.join(DIST, 'deployments');
const outputDir = path.join(deploymentsDir, commitSha);
const outputPath = path.join(outputDir, `${runIdentity}.json`);
const currentPointerPath = path.join(deploymentsDir, 'current.json');
const immutablePath = `/${path.relative(DIST, outputPath).split(path.sep).join('/')}`;
const manifest = buildManifest(immutablePath);
const currentPointer = buildCurrentPointer(immutablePath);

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
fs.writeFileSync(currentPointerPath, `${JSON.stringify(currentPointer, null, 2)}\n`, 'utf8');

assert.equal(path.dirname(immutablePath), `/deployments/${commitSha}`, 'run-specific provenance must remain under its exact commit directory');
assert.equal(path.basename(immutablePath, '.json'), runIdentity, 'run-specific provenance basename must equal run ID and attempt');
assert.equal(path.extname(immutablePath), '.json', 'deployment provenance filename must use .json');

const written = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
const pointer = JSON.parse(fs.readFileSync(currentPointerPath, 'utf8'));
assert.equal(written.commitSha, commitSha);
assert.equal(written.immutablePath, immutablePath);
assert.equal(written.workflow.runId, Number(workflowRunId));
assert.equal(written.workflow.runAttempt, Number(workflowRunAttempt));
assert.equal(written.tts.assets.controller.md5, md5(readDist(assets.controller)));
assert.equal(written.tts.assets.engine.md5, md5(readDist(assets.engine)));
assert.equal(written.tts.assets.noticeCss.md5, md5(readDist(assets.noticeCss)));
assert.equal(written.tts.assets.serviceWorker.md5, md5(readDist(assets.serviceWorker)));
assert.deepEqual(written.tts.lazyNoPrecache, [assets.noticeCss, assets.engine]);
assert.equal(pointer.commitSha, commitSha);
assert.equal(pointer.immutablePath, immutablePath);
assert.equal(pointer.workflow.runId, Number(workflowRunId));
assert.equal(pointer.workflow.runAttempt, Number(workflowRunAttempt));

console.log(JSON.stringify({
  result: 'PASS',
  output: path.relative(ROOT, outputPath),
  currentPointer: path.relative(ROOT, currentPointerPath),
  immutablePath,
  commitSha,
  workflowRunId: Number(workflowRunId),
  workflowRunAttempt: Number(workflowRunAttempt),
  ttsRevisions: {
    controller: written.tts.assets.controller.md5,
    engine: written.tts.assets.engine.md5,
    noticeCss: written.tts.assets.noticeCss.md5,
    serviceWorker: written.tts.assets.serviceWorker.md5,
  },
}, null, 2));
