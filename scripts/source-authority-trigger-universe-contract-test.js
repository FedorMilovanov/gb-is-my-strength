#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WORKFLOW_REL = '.github/workflows/source-authority-contract.yml';
const MANIFEST_REL = 'data/source-authority-trigger-inputs.json';
const CONTRACT_REL = 'scripts/source-authority-trigger-universe-contract-test.js';
const LIGHT_SCRIPT = 'validate:static-publication:light';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function indentation(line) {
  return line.match(/^\s*/)[0].length;
}

function extractEventPaths(workflow, eventName, issues) {
  const lines = workflow.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `  ${eventName}:`);
  if (start < 0) {
    issues.push(`${WORKFLOW_REL}: on.${eventName} missing`);
    return [];
  }
  let pathsLine = -1;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    const indent = indentation(line);
    if (line.trim() && indent <= 2) break;
    if (indent === 4 && line.trim() === 'paths:') {
      pathsLine = i;
      break;
    }
  }
  if (pathsLine < 0) {
    issues.push(`${WORKFLOW_REL}: on.${eventName}.paths missing`);
    return [];
  }
  const paths = [];
  for (let i = pathsLine + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    const indent = indentation(line);
    if (indent <= 4) break;
    const match = line.match(/^\s{6}-\s+(['"]?)(.+?)\1\s*$/);
    if (!match) {
      issues.push(`${WORKFLOW_REL}: unsupported ${eventName}.paths entry: ${line.trim()}`);
      continue;
    }
    paths.push(match[2]);
  }
  return paths;
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function sameSet(a, b) {
  const aa = sortedUnique(a);
  const bb = sortedUnique(b);
  return aa.length === bb.length && aa.every((value, index) => value === bb[index]);
}

function validate({ workflow, manifestText, packageText }) {
  const issues = [];
  let manifest = {};
  let pkg = {};
  try { manifest = JSON.parse(manifestText); }
  catch (error) { issues.push(`${MANIFEST_REL}: invalid JSON: ${error.message}`); }
  try { pkg = JSON.parse(packageText); }
  catch (error) { issues.push(`package.json: invalid JSON: ${error.message}`); }

  if (manifest.schemaVersion !== 1) issues.push(`${MANIFEST_REL}: schemaVersion must be 1`);
  if (manifest.workflow !== WORKFLOW_REL) issues.push(`${MANIFEST_REL}: workflow must be ${WORKFLOW_REL}`);
  if (manifest.rootScript !== LIGHT_SCRIPT) issues.push(`${MANIFEST_REL}: rootScript must be ${LIGHT_SCRIPT}`);
  if (manifest.coverageModel !== 'publication-file-class-and-authority-root') {
    issues.push(`${MANIFEST_REL}: unexpected coverageModel`);
  }
  if (!pkg.scripts || typeof pkg.scripts[LIGHT_SCRIPT] !== 'string') {
    issues.push(`package.json: scripts.${LIGHT_SCRIPT} missing`);
  }

  const required = Array.isArray(manifest.requiredPatterns) ? manifest.requiredPatterns : [];
  if (!required.length) issues.push(`${MANIFEST_REL}: requiredPatterns must not be empty`);
  if (required.includes('**') || required.includes('/**')) {
    issues.push(`${MANIFEST_REL}: repository catch-all ** is forbidden; declare bounded file classes/authority roots`);
  }
  if (!required.includes('scripts/**')) issues.push(`${MANIFEST_REL}: scripts/** validator-self class missing`);
  if (!required.includes('src/**')) issues.push(`${MANIFEST_REL}: src/** publication-source class missing`);
  if (!required.includes('data/**')) issues.push(`${MANIFEST_REL}: data/** manifest/registry class missing`);
  if (!required.includes('migration/**')) issues.push(`${MANIFEST_REL}: migration/** route-authority class missing`);
  if (!required.includes(WORKFLOW_REL)) issues.push(`${MANIFEST_REL}: workflow-self path missing`);

  const pullPaths = extractEventPaths(workflow, 'pull_request', issues);
  const pushPaths = extractEventPaths(workflow, 'push', issues);
  if (!sameSet(pullPaths, pushPaths)) {
    issues.push(`${WORKFLOW_REL}: pull_request.paths and push.paths must be symmetric`);
  }

  for (const pattern of required) {
    if (!pullPaths.includes(pattern)) issues.push(`${WORKFLOW_REL}: pull_request.paths misses authoritative pattern ${pattern}`);
    if (!pushPaths.includes(pattern)) issues.push(`${WORKFLOW_REL}: push.paths misses authoritative pattern ${pattern}`);
  }

  const contractAt = workflow.indexOf(`node ${CONTRACT_REL}`);
  const lightAt = workflow.indexOf(`npm run ${LIGHT_SCRIPT}`);
  if (contractAt < 0) issues.push(`${WORKFLOW_REL}: must execute ${CONTRACT_REL}`);
  if (lightAt < 0) issues.push(`${WORKFLOW_REL}: must execute npm run ${LIGHT_SCRIPT}`);
  if (contractAt >= 0 && lightAt >= 0 && contractAt > lightAt) {
    issues.push(`${WORKFLOW_REL}: input-universe contract must run before ${LIGHT_SCRIPT}`);
  }

  return { issues, required, pullPaths, pushPaths };
}

function removePath(workflow, eventName, target) {
  const lines = workflow.split(/\r?\n/);
  let event = null;
  return lines.filter((line) => {
    const eventMatch = line.match(/^  (pull_request|push):$/);
    if (eventMatch) event = eventMatch[1];
    const pathMatch = line.match(/^\s{6}-\s+(['"]?)(.+?)\1\s*$/);
    return !(event === eventName && pathMatch && pathMatch[2] === target);
  }).join('\n');
}

function expectFailure(label, base, mutate, fragment) {
  const input = mutate({ ...base });
  const result = validate(input);
  if (!result.issues.some((issue) => issue.includes(fragment))) {
    throw new Error(`${label} did not fail closed for ${fragment}; issues=${result.issues.join(' | ') || 'none'}`);
  }
}

function runMutationSuite(base, required) {
  const representative = [
    'src/**',
    'data/**',
    'migration/**',
    '**/*.html',
    '**/*.json',
    '**/*.css',
    '**/*.png',
    WORKFLOW_REL,
  ].filter((pattern) => required.includes(pattern));

  for (const pattern of representative) {
    expectFailure(`pull removal ${pattern}`, base, (input) => {
      input.workflow = removePath(input.workflow, 'pull_request', pattern);
      return input;
    }, `pull_request.paths misses authoritative pattern ${pattern}`);
  }

  expectFailure('push divergence', base, (input) => {
    input.workflow = removePath(input.workflow, 'push', required[0]);
    return input;
  }, 'must be symmetric');

  expectFailure('future manifest class absent from workflow', base, (input) => {
    const manifest = JSON.parse(input.manifestText);
    manifest.requiredPatterns = [...manifest.requiredPatterns, '**/*.future-publication-input'];
    input.manifestText = JSON.stringify(manifest, null, 2);
    return input;
  }, 'misses authoritative pattern **/*.future-publication-input');

  expectFailure('lazy repository catch-all', base, (input) => {
    const manifest = JSON.parse(input.manifestText);
    manifest.requiredPatterns = ['**'];
    input.manifestText = JSON.stringify(manifest, null, 2);
    return input;
  }, 'repository catch-all ** is forbidden');

  expectFailure('contract step removed', base, (input) => {
    input.workflow = input.workflow.replace(
      new RegExp(`^\\s*run:\\s*node\\s+${CONTRACT_REL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm'),
      '        run: echo input-universe-contract-removed',
    );
    return input;
  }, `must execute ${CONTRACT_REL}`);
}

const base = {
  workflow: read(WORKFLOW_REL),
  manifestText: read(MANIFEST_REL),
  packageText: read('package.json'),
};
const result = validate(base);
if (result.issues.length) {
  console.error('❌ Source Authority input-universe contract failed:');
  for (const issue of result.issues) console.error(`- ${issue}`);
  process.exit(1);
}

try { runMutationSuite(base, result.required); }
catch (error) {
  console.error(`❌ Source Authority input-universe mutation suite failed: ${error.message}`);
  process.exit(1);
}

console.log('✅ Source Authority authoritative input-universe contract passed');
console.log(`✅ PR/push trigger sets are symmetric (${result.pullPaths.length} paths each)`);
console.log(`✅ ${result.required.length} bounded file-class/authority-root patterns are machine-covered`);
console.log('✅ Representative removals, future-class drift, PR/push divergence and catch-all weakening fail closed');
