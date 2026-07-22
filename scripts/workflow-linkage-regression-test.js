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

function eventBlock(text, rel, eventName) {
  const escaped = eventName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^\\s{2}${escaped}:\\s*$([\\s\\S]*?)(?=^\\s{2}[A-Za-z_][\\w-]*:\\s*$|^permissions:\\s*$)`, 'm');
  const match = text.match(pattern);
  assert.ok(match, `${rel}: on.${eventName} block is missing`);
  return match[1];
}

function hasEvent(text, eventName) {
  const escaped = eventName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^\\s{2}${escaped}:\\s*$`, 'm').test(text);
}

function workflowRunDependencies(text) {
  const block = eventBlock(text, DEPLOY_PATH, 'workflow_run');
  const workflows = block.match(/^\s{4}workflows:\s*\[(.*)\]\s*$/m);
  assert.ok(workflows, `${DEPLOY_PATH}: on.workflow_run.workflows must be an explicit inline list`);
  return Array.from(workflows[1].matchAll(/["']([^"']+)["']/g), (match) => match[1].trim());
}

function pushPaths(text, rel) {
  const block = eventBlock(text, rel, 'push');
  const paths = Array.from(block.matchAll(/^\s{6}-\s*["']([^"']+)["']\s*$/gm), (match) => match[1]);
  assert.ok(paths.length > 0, `${rel}: on.push.paths is empty or unparsable`);
  assert.equal(new Set(paths).size, paths.length, `${rel}: on.push.paths contains duplicates`);
  return paths;
}

const readiness = read(READINESS_PATH);
const deploy = read(DEPLOY_PATH);
const readinessName = workflowName(readiness, READINESS_PATH);
const dependencies = workflowRunDependencies(deploy);
const readinessPaths = pushPaths(readiness, READINESS_PATH);

assert.ok(
  dependencies.includes(readinessName),
  `${DEPLOY_PATH}: workflow_run listens to ${JSON.stringify(dependencies)}, but readiness workflow is named ${JSON.stringify(readinessName)}`,
);
assert.equal(
  dependencies.filter((name) => name === readinessName).length,
  1,
  `${DEPLOY_PATH}: readiness workflow dependency must be declared exactly once`,
);

const documentedProductionPaths = [
  'src/**', 'data/**', 'baptisty-rossii/**', 'scripts/**', 'css/**', 'js/**',
  'sitemap.xml', 'feed.xml', 'astro.config.mjs', 'tsconfig.json', 'migration/**',
  'package.json', 'package-lock.json', 'images/**', 'fonts/**', 'icons/**',
  'konfessii/**', 'karty/**', 'map/**', 'biografii/**', 'hard-texts/**',
  '.nojekyll', 'favicon*', 'apple-touch-icon.png', 'CNAME',
  '.github/workflows/deploy.yml', '.github/workflows/indexnow.yml',
];
for (const glob of documentedProductionPaths) {
  assert.ok(readinessPaths.includes(glob), `${READINESS_PATH}: push.paths must include ${glob}`);
}
assert.ok(
  readinessPaths.includes('**'),
  `${READINESS_PATH}: push.paths must include ** so mixed commits and new route families cannot bypass readiness`,
);

assert.equal(
  hasEvent(deploy, 'push'),
  false,
  `${DEPLOY_PATH}: on.push is forbidden; all automatic deploys must follow successful readiness`,
);
assert.doesNotMatch(
  deploy,
  /github\.event_name\s*==\s*['"]push['"]/,
  `${DEPLOY_PATH}: deploy job condition must not accept direct push events`,
);

console.log(`✅ workflow linkage: every main push → ${JSON.stringify(readinessName)} → Deploy to GitHub Pages`);
console.log(`✅ readiness documented paths: ${documentedProductionPaths.length}; exhaustive catch-all: **`);
console.log('✅ direct automatic Pages push entry: absent');
