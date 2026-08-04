#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const WORKER_PATH = path.join(ROOT, 'js/vosk-tts-worker.js');
const EXPECTED_DIST = "var ORT_DIST = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/';";
const EXPECTED_SCRIPT = "var ORT_SRC = ORT_DIST + 'ort.min.js';";
const EXPECTED_PATH_ASSIGNMENT = 'self.ort.env.wasm.wasmPaths = ORT_DIST;';

function validate(source) {
  const problems = [];
  const dependencyImport = source.indexOf('importScripts(CORE_SRC, STRESS_LOOKUP_SRC, FFLATE_SRC, ORT_SRC);');
  const pathAssignment = source.indexOf(EXPECTED_PATH_ASSIGNMENT);
  const firstSession = source.indexOf('self.ort.InferenceSession.create');

  if (!source.includes(EXPECTED_DIST)) problems.push('ORT distribution base is not pinned to onnxruntime-web@1.19.2/dist/');
  if (!source.includes(EXPECTED_SCRIPT)) problems.push('ORT bootstrap script is not derived from the pinned distribution base');
  if (pathAssignment < 0) problems.push('ort.env.wasm.wasmPaths is not assigned in the Worker');
  if (dependencyImport < 0 || pathAssignment < dependencyImport) problems.push('wasmPaths is assigned before ORT is imported');
  if (firstSession < 0 || pathAssignment > firstSession) problems.push('wasmPaths is assigned after ONNX session creation');
  if (/['"]\/js\/ort-wasm[^'"]*/.test(source)) problems.push('same-origin /js/ ORT sidecar fallback is hardcoded');
  if (/onnxruntime-web@(?!1\.19\.2\/dist\/)/.test(source)) problems.push('multiple ONNX Runtime versions are referenced');

  return problems;
}

const source = fs.readFileSync(WORKER_PATH, 'utf8');
assert.deepEqual(validate(source), [], 'baseline ONNX Worker path contract must pass');

const mutations = [
  source.replace(EXPECTED_PATH_ASSIGNMENT, ''),
  source.replace('onnxruntime-web@1.19.2/dist/', 'onnxruntime-web@latest/dist/'),
  source.replace(
    `${EXPECTED_PATH_ASSIGNMENT}\n    self.ort.env.wasm.numThreads = 1;`,
    'self.ort.env.wasm.numThreads = 1;',
  ) + `\n${EXPECTED_PATH_ASSIGNMENT}\n`,
];

for (const [index, mutation] of mutations.entries()) {
  assert.ok(validate(mutation).length > 0, `ONNX Worker path mutation ${index + 1} must be rejected`);
}

console.log(`TTS ONNX Worker path contract: PASS (${mutations.length} adversarial mutations rejected).`);
