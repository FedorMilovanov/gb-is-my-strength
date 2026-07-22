#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const ROOT = path.resolve(__dirname, '..');
const READINESS_PATH = '.github/workflows/indexnow.yml';
const DEPLOY_PATH = '.github/workflows/deploy.yml';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function workflowName(text, rel) {
  const match = text.match(/^name:\s*(?:"([^"]+)"|'([^']+)'|(.+?))\s*$/m);
  assert.ok(match, `${rel}: top-level workflow name is missing`);
  return (match[1] || match[2] || match[3] || '').trim();
}

function workflowRunDependencies(text) {
  const block = text.match(/^\s{2}workflow_run:\s*$([\s\S]*?)(?=^\s{2}[A-Za-z_][\w-]*:\s*$|^permissions:\s*$)/m);
  assert.ok(block, `${DEPLOY_PATH}: on.workflow_run block is missing`);
  const workflows = block[1].match(/^\s{4}workflows:\s*\[(.*)\]\s*$/m);
  assert.ok(workflows, `${DEPLOY_PATH}: on.workflow_run.workflows must be an explicit inline list`);
  return Array.from(workflows[1].matchAll(/["']([^"']+)["']/g), (match) => match[1].trim());
}

function assertPushPath(text, rel, expectedPath) {
  const escaped = expectedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^\\s{6}-\\s*["']${escaped}["']\\s*$`, 'm');
  assert.match(text, pattern, `${rel}: push.paths must include ${expectedPath}`);
}

const readiness = read(READINESS_PATH);
const deploy = read(DEPLOY_PATH);
const readinessName = workflowName(readiness, READINESS_PATH);
const dependencies = workflowRunDependencies(deploy);

assert.ok(
  dependencies.includes(readinessName),
  `${DEPLOY_PATH}: workflow_run listens to ${JSON.stringify(dependencies)}, but readiness workflow is named ${JSON.stringify(readinessName)}`,
);
assert.equal(
  dependencies.filter((name) => name === readinessName).length,
  1,
  `${DEPLOY_PATH}: readiness workflow dependency must be declared exactly once`,
);

for (const [rel, text] of [[READINESS_PATH, readiness], [DEPLOY_PATH, deploy]]) {
  assertPushPath(text, rel, 'scripts/**');
}

console.log(`✅ workflow linkage: ${JSON.stringify(readinessName)} → Deploy to GitHub Pages`);
console.log('✅ readiness/deploy script path coverage: scripts/**');
