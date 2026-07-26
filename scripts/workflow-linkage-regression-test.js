#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const ROOT = path.resolve(__dirname, '..');
const DIAGNOSTICS_PATH = '.github/workflows/indexnow.yml';
const RELEASE_PATH = '.github/workflows/deploy.yml';
const PINS = Object.freeze({
  checkout: 'actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4',
  downloadArtifact: 'actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093 # v4',
  uploadPages: 'actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa # v3',
  deployPages: 'actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e # v4',
});
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
assert.match(release, /CONTROL_PLANE_SHA:\s*\$\{\{ github\.sha \}\}/, `${RELEASE_PATH}: control-plane SHA must be the workflow source SHA`);
assert.match(release, /RELEASE_SHA:\s*\$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.release_sha \|\| github\.sha \}\}/, `${RELEASE_PATH}: release SHA selection is missing`);
assert.match(readiness, /permissions:\s*\n\s*contents:\s*read/, `${RELEASE_PATH}: candidate job must remain read-only`);
assert.match(readiness, new RegExp(PINS.checkout.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${RELEASE_PATH}: release checkout action identity drifted`);
assert.match(readiness, /ref:\s*\$\{\{ env\.RELEASE_SHA \}\}[\s\S]{0,100}fetch-depth:\s*0[\s\S]{0,100}persist-credentials:\s*false/, `${RELEASE_PATH}: release checkout boundary is incomplete`);
assert.match(readiness, /git fetch --no-tags origin "\+main:refs\/remotes\/origin\/main"/, `${RELEASE_PATH}: current main control plane is not fetched`);
assert.match(readiness, /git merge-base --is-ancestor "\$RELEASE_SHA" "\$CONTROL_PLANE_SHA"/, `${RELEASE_PATH}: release/control ancestry proof is missing`);
assert.match(readiness, /name:\s*Check source asset revisions without writing[\s\S]{0,180}node scripts\/cache-bust\.js/, `${RELEASE_PATH}: candidate revision check is missing`);
assert.match(readiness, /npm run strangler:build:production-like/, `${RELEASE_PATH}: candidate build is missing`);
assert.match(readiness, /Stage immutable verification tools from trusted control plane[\s\S]*git show "\$\{CONTROL_PLANE_SHA\}:scripts\/\$\{file\}"/, `${RELEASE_PATH}: verification tools are not sourced from the control plane`);
assert.match(readiness, /release_sha:\s*\$\{\{ steps\.provenance\.outputs\.release_sha \}\}[\s\S]*control_plane_sha:\s*\$\{\{ steps\.provenance\.outputs\.control_plane_sha \}\}/, `${RELEASE_PATH}: readiness must expose both identities`);
assert.match(readiness, /name:\s*Upload immutable release candidate/, `${RELEASE_PATH}: candidate artifact publication is missing`);
assert.match(deploy, /needs:\s*readiness/, `${RELEASE_PATH}: privileged promotion must depend on readiness`);
assert.match(deploy, /permissions:\s*\n\s*actions:\s*read\s*\n\s*contents:\s*read\s*\n\s*pages:\s*write\s*\n\s*id-token:\s*write/, `${RELEASE_PATH}: deploy permissions are incomplete or widened`);
assert.ok(deploy.includes(PINS.downloadArtifact), `${RELEASE_PATH}: candidate download action identity drifted`);
assert.match(deploy, /name:\s*Download exact same-run release candidate/, `${RELEASE_PATH}: candidate download is missing`);
assert.match(deploy, /EXPECTED_RELEASE_SHA:\s*\$\{\{ needs\.readiness\.outputs\.release_sha \}\}[\s\S]*EXPECTED_CONTROL_PLANE_SHA:\s*\$\{\{ needs\.readiness\.outputs\.control_plane_sha \}\}/, `${RELEASE_PATH}: deploy verification does not consume both identities`);
assert.match(deploy, /name:\s*Verify downloaded candidate identity[\s\S]*name:\s*Upload exact candidate as Pages artifact/, `${RELEASE_PATH}: downloaded candidate must be verified before Pages upload`);
assert.ok(deploy.includes(PINS.uploadPages), `${RELEASE_PATH}: Pages packaging action identity drifted`);
assert.ok(deploy.includes(PINS.deployPages), `${RELEASE_PATH}: Pages deployment action identity drifted`);
assert.match(deploy, /Verify generic live release contract[\s\S]*RELEASE_SHA:\s*\$\{\{ needs\.readiness\.outputs\.release_sha \}\}[\s\S]*CONTROL_PLANE_SHA:\s*\$\{\{ needs\.readiness\.outputs\.control_plane_sha \}\}/, `${RELEASE_PATH}: live proof is not bound to both identities`);
assert.doesNotMatch(deploy, /actions\/checkout@|\bnpm ci\b|strangler:build|cache-bust\.js|validate:static-publication/, `${RELEASE_PATH}: privileged deploy job must not checkout, validate or rebuild source`);
assert.equal((release.match(/actions\/checkout@/g) || []).length, 1, `${RELEASE_PATH}: exactly one checkout is allowed`);
assert.equal((release.match(/\bnpm ci\b/g) || []).length, 1, `${RELEASE_PATH}: exactly one npm ci is allowed`);
assert.equal((release.match(/npm run strangler:build:production-like/g) || []).length, 1, `${RELEASE_PATH}: exactly one production build is allowed`);
assert.equal((release.match(/actions\/deploy-pages@/g) || []).length, 1, `${RELEASE_PATH}: exactly one Pages promotion is allowed`);
assert.doesNotMatch(release, /uses:\s*actions\/(?:checkout|download-artifact|upload-pages-artifact|deploy-pages)@v\d+/i, `${RELEASE_PATH}: mutable release action remains`);
assert.doesNotMatch(diagnostics, /\bnpm ci\b|strangler:build|pagefind:build|dist-publication-audit/, `${DIAGNOSTICS_PATH}: diagnostics must not duplicate the release build`);
assert.doesNotMatch(diagnostics, /pages:\s*write|id-token:\s*write|actions\/deploy-pages|actions\/upload-pages-artifact/, `${DIAGNOSTICS_PATH}: diagnostic workflow must not own production publication`);

console.log('✅ workflow linkage: one direct-push control plane owns readiness and Pages promotion');
console.log('✅ two-SHA boundary: release candidate identity is independent from trusted workflow identity');
console.log('✅ build-once: one checkout, one npm ci, one production build, one deploy-pages');
console.log('✅ privileged deploy: exact approved action identities, no source checkout/rebuild');
console.log('✅ metadata workflow remains read-only and build-free');
