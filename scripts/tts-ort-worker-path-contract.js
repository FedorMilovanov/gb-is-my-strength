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
  const firstSession = source.indexOf('self.ort.InferenceSession.create');
  // Structural, whitespace-independent scan: every wasmPaths assignment in
  // the file, wherever it sits. The previous indexOf-only check let a
  // duplicate appended at EOF pass, and mutation 3 matched a whitespace-
  // exact two-line string that no longer exists in the worker, so the
  // "relocation" fixture never relocated anything (false red locally while
  // CI masked it through tee without pipefail).
  const assignments = [...source.matchAll(/self\.ort\.env\.wasm\.wasmPaths\s*=\s*([^;]+);/g)];

  if (!source.includes(EXPECTED_DIST)) problems.push('ORT distribution base is not pinned to onnxruntime-web@1.19.2/dist/');
  if (!source.includes(EXPECTED_SCRIPT)) problems.push('ORT bootstrap script is not derived from the pinned distribution base');
  if (assignments.length === 0) problems.push('ort.env.wasm.wasmPaths is not assigned in the Worker');
  if (assignments.length > 1) problems.push('ort.env.wasm.wasmPaths is assigned more than once');
  for (const assignment of assignments) {
    if (assignment[1].trim() !== 'ORT_DIST') problems.push('ort.env.wasm.wasmPaths is not pinned to ORT_DIST');
    if (dependencyImport < 0 || assignment.index < dependencyImport) problems.push('wasmPaths is assigned before ORT is imported');
    if (firstSession < 0 || assignment.index > firstSession) problems.push('wasmPaths is assigned after ONNX session creation');
  }
  if (/['"]\/js\/ort-wasm[^'"]*/.test(source)) problems.push('same-origin /js/ ORT sidecar fallback is hardcoded');
  if (/onnxruntime-web@(?!1\.19\.2\/dist\/)/.test(source)) problems.push('multiple ONNX Runtime versions are referenced');

  return problems;
}

const source = fs.readFileSync(WORKER_PATH, 'utf8');
assert.deepEqual(validate(source), [], 'baseline ONNX Worker path contract must pass');

const withoutAssignment = source.replace(EXPECTED_PATH_ASSIGNMENT, '');
const versionDrift = source.replace('onnxruntime-web@1.19.2/dist/', 'onnxruntime-web@latest/dist/');
const relocated = `${withoutAssignment}\n${EXPECTED_PATH_ASSIGNMENT}\n`;

// Every fixture must first prove it actually changed the source in the
// intended way; a silent no-op replace is what made mutation 3 a false red.
assert.notEqual(withoutAssignment, source, 'mutation 1 precondition: baseline assignment must be removable');
assert.ok(!withoutAssignment.includes(EXPECTED_PATH_ASSIGNMENT), 'mutation 1 precondition: assignment must be gone');
assert.ok(versionDrift.includes('onnxruntime-web@latest/dist/'), 'mutation 2 precondition: version must drift');
assert.notEqual(withoutAssignment, source, 'mutation 3 precondition: baseline assignment must be removable');
assert.ok(
  relocated.indexOf(EXPECTED_PATH_ASSIGNMENT) > relocated.indexOf('self.ort.InferenceSession.create'),
  'mutation 3 precondition: assignment must land after session creation',
);

const mutations = [withoutAssignment, versionDrift, relocated];

for (const [index, mutation] of mutations.entries()) {
  assert.ok(validate(mutation).length > 0, `ONNX Worker path mutation ${index + 1} must be rejected`);
}

console.log(`TTS ONNX Worker path contract: PASS (${mutations.length} adversarial mutations rejected).`);
