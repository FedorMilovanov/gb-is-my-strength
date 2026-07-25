#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const ROOT = path.resolve(__dirname, '..');
const DIAGNOSTICS_PATH = '.github/workflows/indexnow.yml';
const RELEASE_PATH = '.github/workflows/deploy.yml';
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

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
function pushPaths(text, rel) {
  const block = eventBlock(text, rel, 'push');
  const paths = Array.from(block.matchAll(/^\s{6}-\s*["']([^"']+)["']\s*$/gm), (match) => match[1]);
  assert.ok(paths.length > 0, `${rel}: on.push.paths is empty or unparsable`);
  assert.equal(new Set(paths).size, paths.length, `${rel}: on.push.paths contains duplicates`);
  return paths;
}
function jobSection(workflow, name, nextName = null) {
  const marker = `\n  ${name}:\n`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `${RELEASE_PATH}: jobs.${name} is missing`);
  const offset = start + marker.length;
  if (!nextName) return workflow.slice(offset);
  const end = workflow.indexOf(`\n  ${nextName}:\n`, offset);
  assert.notEqual(end, -1, `${RELEASE_PATH}: jobs.${nextName} is missing`);
  return workflow.slice(offset, end);
}

const diagnostics = read(DIAGNOSTICS_PATH);
const release = read(RELEASE_PATH);
const readiness = jobSection(release, 'readiness', 'deploy');
const deploy = jobSection(release, 'deploy');
const releasePaths = pushPaths(release, RELEASE_PATH);
const diagnosticPaths = pushPaths(diagnostics, DIAGNOSTICS_PATH);

assert.equal(hasEvent(release, 'workflow_dispatch'), true, `${RELEASE_PATH}: manual rollback/recovery entry is missing`);
assert.equal(hasEvent(release, 'workflow_run'), false, `${RELEASE_PATH}: release must not depend on a second workflow build`);
assert.ok(releasePaths.includes('**'), `${RELEASE_PATH}: push.paths must include **`);
assert.ok(diagnosticPaths.includes('**'), `${DIAGNOSTICS_PATH}: diagnostics must retain catch-all coverage`);
assert.match(readiness, /permissions:\s*\n\s*contents:\s*read/, `${RELEASE_PATH}: candidate job must remain read-only`);
assert.match(readiness, /name:\s*Check source asset revisions without writing[\s\S]{0,180}node scripts\/cache-bust\.js/, `${RELEASE_PATH}: candidate revision check is missing`);
assert.match(readiness, /npm run strangler:build:production-like/, `${RELEASE_PATH}: candidate build is missing`);
assert.match(readiness, /name:\s*Upload immutable release candidate/, `${RELEASE_PATH}: candidate artifact publication is missing`);
assert.match(deploy, /needs:\s*readiness/, `${RELEASE_PATH}: privileged promotion must depend on readiness`);
assert.match(deploy, /permissions:\s*\n\s*actions:\s*read\s*\n\s*contents:\s*read\s*\n\s*pages:\s*write\s*\n\s*id-token:\s*write/, `${RELEASE_PATH}: deploy permissions are incomplete or widened`);
assert.match(deploy, /name:\s*Download exact same-run release candidate/, `${RELEASE_PATH}: candidate download is missing`);
assert.match(deploy, /name:\s*Verify downloaded candidate identity[\s\S]*name:\s*Upload exact candidate as Pages artifact/, `${RELEASE_PATH}: downloaded candidate must be verified before Pages upload`);
assert.match(deploy, /actions\/upload-pages-artifact@[a-f0-9]{40}\s+# v3/, `${RELEASE_PATH}: Pages packaging action must be pinned`);
assert.match(deploy, /actions\/deploy-pages@[a-f0-9]{40}\s+# v4/, `${RELEASE_PATH}: Pages deployment action must be pinned`);
assert.doesNotMatch(deploy, /actions\/checkout@|\bnpm ci\b|strangler:build|cache-bust\.js|validate:static-publication/, `${RELEASE_PATH}: privileged deploy job must not checkout, validate or rebuild source`);
assert.equal((release.match(/actions\/checkout@/g) || []).length, 1, `${RELEASE_PATH}: exactly one checkout is allowed`);
assert.equal((release.match(/\bnpm ci\b/g) || []).length, 1, `${RELEASE_PATH}: exactly one npm ci is allowed`);
assert.equal((release.match(/npm run strangler:build:production-like/g) || []).length, 1, `${RELEASE_PATH}: exactly one production build is allowed`);
assert.equal((release.match(/actions\/deploy-pages@/g) || []).length, 1, `${RELEASE_PATH}: exactly one Pages promotion is allowed`);
assert.doesNotMatch(diagnostics, /\bnpm ci\b|strangler:build|pagefind:build|dist-publication-audit/, `${DIAGNOSTICS_PATH}: diagnostics must not duplicate the release build`);
assert.doesNotMatch(diagnostics, /pages:\s*write|id-token:\s*write|actions\/deploy-pages|actions\/upload-pages-artifact/, `${DIAGNOSTICS_PATH}: diagnostic workflow must not own production publication`);

console.log('✅ workflow linkage: one direct-push release workflow owns candidate readiness and Pages promotion');
console.log('✅ build-once: one checkout, one npm ci, one production build, one deploy-pages');
console.log('✅ privileged deploy: exact pinned Pages actions, no source checkout/rebuild');
console.log('✅ metadata workflow remains read-only and build-free');
