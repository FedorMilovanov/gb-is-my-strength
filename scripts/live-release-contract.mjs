#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyReleaseCandidate } from './release-candidate-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const REPORTS = path.join(ROOT, 'reports');
const REPORT_PATH = path.join(REPORTS, 'release-live-deployment-contract.json');
const LIVE_BASE_URL = String(process.env.LIVE_BASE_URL || 'https://gospod-bog.ru').replace(/\/+$/, '');
const repository = String(process.env.GITHUB_REPOSITORY || 'FedorMilovanov/gb-is-my-strength').trim();
const releaseSha = String(process.env.RELEASE_SHA || '').trim().toLowerCase();
const controlPlaneSha = String(process.env.CONTROL_PLANE_SHA || '').trim().toLowerCase();
const runId = Number(process.env.GITHUB_RUN_ID || 0);
const runAttempt = Number(process.env.GITHUB_RUN_ATTEMPT || 0);
const expectedDigest = String(process.env.EXPECTED_CANDIDATE_DIGEST || '').trim();
const transportArtifactId = Number(process.env.RELEASE_ARTIFACT_ID || 0) || null;
const rawTransportArtifactDigest = String(process.env.RELEASE_ARTIFACT_DIGEST || '').trim();
const transportArtifactDigest = rawTransportArtifactDigest
  ? (rawTransportArtifactDigest.startsWith('sha256:') ? rawTransportArtifactDigest : `sha256:${rawTransportArtifactDigest}`)
  : null;
const maxAttempts = Number.parseInt(process.env.RELEASE_LIVE_MAX_ATTEMPTS || '36', 10);
const retryDelayMs = Number.parseInt(process.env.RELEASE_LIVE_RETRY_DELAY_MS || '10000', 10);
const timeoutMs = Number.parseInt(process.env.RELEASE_LIVE_REQUEST_TIMEOUT_MS || '30000', 10);
const localHomePath = path.join(DIST, 'index.html');

fs.mkdirSync(REPORTS, { recursive: true });
const report = {
  liveBaseUrl: LIVE_BASE_URL,
  repository,
  releaseSha,
  controlPlaneSha,
  workflowRunId: runId,
  workflowRunAttempt: runAttempt,
  candidate: null,
  transportArtifact: {
    id: transportArtifactId,
    digest: transportArtifactDigest,
  },
  phase: 'preflight',
  startedAt: new Date().toISOString(),
  attempts: [],
};

let local;
let localHomeBuffer;
let localHomeDigest;
let localHomeStylesheets;
let localRefutationsStylesheet;
try {
  assert.match(repository, /^[^/\s]+\/[^/\s]+$/, 'GITHUB_REPOSITORY must be owner/name');
  assert.match(releaseSha, /^[a-f0-9]{40}$/, 'RELEASE_SHA must be exact');
  assert.match(controlPlaneSha, /^[a-f0-9]{40}$/, 'CONTROL_PLANE_SHA must be exact');
  assert.ok(Number.isSafeInteger(runId) && runId > 0, 'GITHUB_RUN_ID must be positive');
  assert.ok(Number.isSafeInteger(runAttempt) && runAttempt > 0, 'GITHUB_RUN_ATTEMPT must be positive');
  assert.match(expectedDigest, /^sha256:[a-f0-9]{64}$/, 'EXPECTED_CANDIDATE_DIGEST must be exact');
  if (transportArtifactDigest) assert.match(transportArtifactDigest, /^sha256:[a-f0-9]{64}$/, 'RELEASE_ARTIFACT_DIGEST must be exact');

  local = verifyReleaseCandidate({
    dist: DIST,
    expectedRepository: repository,
    expectedReleaseSha: releaseSha,
    expectedControlPlaneSha: controlPlaneSha,
    expectedRunId: runId,
    expectedRunAttempt: runAttempt,
  });
  assert.equal(local.manifest.artifact.digest, expectedDigest, 'local candidate digest differs from resolver output');
  assert.equal(fs.existsSync(localHomePath), true, 'local candidate home index is missing');
  localHomeBuffer = fs.readFileSync(localHomePath);
  localHomeDigest = sha256(localHomeBuffer);
  assertHomeContract(localHomeBuffer, 'local candidate home');
  localHomeStylesheets = readLocalStylesheets(localHomeBuffer, 'local candidate home');
  localRefutationsStylesheet = findRefutationsStylesheet(localHomeStylesheets, 'local candidate home');
  report.candidate = {
    id: local.manifest.artifact.candidateId,
    digest: expectedDigest,
    bytes: local.manifest.artifact.bytes,
    files: local.manifest.artifact.files,
    immutablePath: local.manifest.immutablePath,
    home: {
      path: '/index.html',
      bytes: localHomeBuffer.length,
      sha256: localHomeDigest,
      refutationsStylesheet: {
        path: localRefutationsStylesheet.path,
        bytes: localRefutationsStylesheet.buffer.length,
        sha256: localRefutationsStylesheet.sha256,
      },
    },
  };
  report.phase = 'live';
} catch (error) {
  failPreflight(error);
}

function writeReport() {
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
function failPreflight(error) {
  report.result = 'FAIL';
  report.phase = 'preflight';
  report.finishedAt = new Date().toISOString();
  report.error = String(error?.stack || error);
  writeReport();
  console.error(error);
  process.exit(1);
}
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function sha256(buffer) { return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`; }
function extractStylesheetPaths(buffer, label) {
  const html = buffer.toString('utf8');
  const paths = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1] || '';
    if (!rel.split(/\s+/).some((value) => value.toLowerCase() === 'stylesheet')) continue;
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    assert.ok(href, `${label}: stylesheet link is missing href`);
    const url = new URL(href, 'https://candidate.invalid/');
    assert.equal(url.origin, 'https://candidate.invalid', `${label}: external stylesheet is not release-owned (${href})`);
    paths.push(url.pathname);
  }
  assert.ok(paths.length > 0, `${label}: no release-owned stylesheets found`);
  return [...new Set(paths)];
}
function readLocalStylesheets(homeBuffer, label) {
  return extractStylesheetPaths(homeBuffer, label).map((pathname) => {
    const relative = pathname.replace(/^\/+/, '');
    const absolute = path.resolve(DIST, relative);
    assert.equal(absolute.startsWith(`${DIST}${path.sep}`), true, `${label}: stylesheet escapes dist (${pathname})`);
    assert.equal(fs.existsSync(absolute), true, `${label}: stylesheet is missing (${pathname})`);
    const buffer = fs.readFileSync(absolute);
    return { path: pathname, buffer, sha256: sha256(buffer) };
  });
}
function assertRefutationsStylesheet(buffer, label) {
  const css = buffer.toString('utf8');
  assert.match(
    css,
    /\.h-refutation-card(?:[^{}]*)\{[^}]{0,1200}box-sizing\s*:\s*border-box/,
    `${label}: Refutations does not own border-box geometry`,
  );
}
function findRefutationsStylesheet(stylesheets, label) {
  const matches = stylesheets.filter((record) => {
    try {
      assertRefutationsStylesheet(record.buffer, `${label} stylesheet ${record.path}`);
      return true;
    } catch {
      return false;
    }
  });
  assert.equal(matches.length, 1, `${label}: expected exactly one Refutations border-box stylesheet, found ${matches.length}`);
  return matches[0];
}
function assertHomeContract(buffer, label) {
  const html = buffer.toString('utf8');
  for (const marker of [
    'class="h-sacred-word h-sacred-word--name"',
    'class="h-sacred-name-label"',
    'class="h-home-title-part',
    'id="hRefutationsLabel"',
    'class="h-article-card h-article-card--debunk h-refutation-card"',
  ]) assert.equal(html.includes(marker), true, `${label}: missing ${marker}`);
  for (const legacy of ['class="hb-w"', 'class="h-tetra"', 'data-sacred-active']) {
    assert.equal(html.includes(legacy), false, `${label}: legacy Home owner remains (${legacy})`);
  }
  for (const route of ['articles', 'series', 'biographies', 'maps', 'confessions']) {
    assert.equal(html.includes(`data-home-route="${route}"`), true, `${label}: missing library route ${route}`);
  }
  for (let divider = 0; divider < 4; divider += 1) {
    assert.equal(html.includes(`data-home-route-divider="${divider}"`), true, `${label}: missing library divider ${divider}`);
  }
}
function probeUrl(relative, attempt, label) {
  const target = new URL(relative, LIVE_BASE_URL);
  target.searchParams.set('release_contract', `${releaseSha.slice(0, 12)}-${controlPlaneSha.slice(0, 12)}-${attempt}-${label}-${Date.now()}`);
  return target;
}
async function fetchBuffer(relative, attempt, label) {
  const target = probeUrl(relative, attempt, label);
  const response = await fetch(target, {
    cache: 'no-store',
    redirect: 'follow',
    headers: {
      'cache-control': 'no-cache, no-store, max-age=0',
      pragma: 'no-cache',
      'user-agent': 'gb-live-release-contract/2.0',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  assert.equal(response.ok, true, `${label}: HTTP ${response.status}`);
  return {
    url: response.url,
    contentType: response.headers.get('content-type') || '',
    buffer: Buffer.from(await response.arrayBuffer()),
  };
}
function parseJson(response, label) {
  try { return JSON.parse(response.buffer.toString('utf8')); }
  catch (error) { throw new Error(`${label} is not valid JSON: ${error.message || error}`); }
}
function assertPointer(pointer) {
  assert.equal(pointer.schemaVersion, 3, 'live pointer schema drifted');
  assert.equal(pointer.repository, repository, 'live pointer repository mismatch');
  assert.equal(pointer.releaseSha, releaseSha, 'live pointer release SHA mismatch');
  assert.equal(pointer.controlPlaneSha, controlPlaneSha, 'live pointer control-plane SHA mismatch');
  assert.equal(pointer.immutablePath, local.manifest.immutablePath, 'live pointer immutable path mismatch');
  assert.equal(pointer.workflow?.name, 'Deploy to GitHub Pages', 'live pointer workflow mismatch');
  assert.equal(pointer.workflow?.stage, 'readiness', 'live pointer workflow stage mismatch');
  assert.equal(pointer.workflow?.controlPlaneSha, controlPlaneSha, 'live pointer workflow control-plane SHA mismatch');
  assert.equal(pointer.workflow?.runId, runId, 'live pointer run ID mismatch');
  assert.equal(pointer.workflow?.runAttempt, runAttempt, 'live pointer run attempt mismatch');
  assert.equal(pointer.artifact?.candidateId, local.manifest.artifact.candidateId, 'live pointer candidate ID mismatch');
  assert.equal(pointer.artifact?.digest, expectedDigest, 'live pointer candidate digest mismatch');
}
function assertManifest(manifest) {
  assert.equal(manifest.schemaVersion, 4, 'live release manifest schema drifted');
  assert.equal(manifest.repository, repository, 'live release repository mismatch');
  assert.equal(manifest.releaseSha, releaseSha, 'live release SHA mismatch');
  assert.equal(manifest.controlPlaneSha, controlPlaneSha, 'live control-plane SHA mismatch');
  assert.equal(manifest.immutablePath, local.manifest.immutablePath, 'live release immutable path mismatch');
  assert.deepEqual(manifest.workflow, local.manifest.workflow, 'live release workflow identity mismatch');
  assert.deepEqual(manifest.artifact, local.manifest.artifact, 'live release artifact identity mismatch');
  assert.deepEqual(manifest.build, local.manifest.build, 'live release build identity mismatch');
  assert.deepEqual(manifest.criticalAssets, local.manifest.criticalAssets, 'live release critical asset manifest mismatch');
  assert.deepEqual(manifest.extensions?.tts, local.manifest.extensions?.tts, 'live release TTS extension mismatch');
}
async function verifyAttempt(attempt) {
  const pointer = parseJson(await fetchBuffer('/deployments/current.json', attempt, 'current-pointer'), 'current pointer');
  assertPointer(pointer);
  const manifest = parseJson(await fetchBuffer(pointer.immutablePath, attempt, 'release-manifest'), 'release manifest');
  assertManifest(manifest);

  const homeResponse = await fetchBuffer('/', attempt, 'home-index');
  const homeDigest = sha256(homeResponse.buffer);
  assert.equal(homeResponse.buffer.length, localHomeBuffer.length, 'home-index: live byte count mismatch');
  assert.equal(homeDigest, localHomeDigest, 'home-index: live SHA-256 mismatch');
  assertHomeContract(homeResponse.buffer, 'live home');
  const liveRefutationsStyle = await fetchBuffer(localRefutationsStylesheet.path, attempt, 'home-refutations-stylesheet');
  const liveRefutationsStyleDigest = sha256(liveRefutationsStyle.buffer);
  assert.equal(
    liveRefutationsStyle.buffer.length,
    localRefutationsStylesheet.buffer.length,
    'home-refutations-stylesheet: live byte count mismatch',
  );
  assert.equal(
    liveRefutationsStyleDigest,
    localRefutationsStylesheet.sha256,
    'home-refutations-stylesheet: live SHA-256 mismatch',
  );
  assertRefutationsStylesheet(liveRefutationsStyle.buffer, 'live home Refutations stylesheet');

  const assets = {};
  for (const [name, record] of Object.entries(manifest.criticalAssets)) {
    const response = await fetchBuffer(record.path, attempt, `critical-${name}`);
    const digest = sha256(response.buffer);
    assert.equal(response.buffer.length, record.bytes, `${name}: live byte count mismatch`);
    assert.equal(digest, record.sha256, `${name}: live SHA-256 mismatch`);
    assets[name] = { path: record.path, url: response.url, bytes: response.buffer.length, sha256: digest };
  }
  return {
    currentPointer: '/deployments/current.json',
    immutablePath: pointer.immutablePath,
    releaseSha,
    controlPlaneSha,
    candidateId: manifest.artifact.candidateId,
    candidateDigest: manifest.artifact.digest,
    build: manifest.build,
    home: {
      path: '/',
      url: homeResponse.url,
      bytes: homeResponse.buffer.length,
      sha256: homeDigest,
      refutationsStylesheet: {
        path: localRefutationsStylesheet.path,
        url: liveRefutationsStyle.url,
        bytes: liveRefutationsStyle.buffer.length,
        sha256: liveRefutationsStyleDigest,
      },
    },
    criticalAssets: assets,
  };
}

let lastError = null;
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const entry = { attempt, startedAt: new Date().toISOString() };
  report.attempts.push(entry);
  try {
    entry.evidence = await verifyAttempt(attempt);
    entry.result = 'PASS';
    entry.finishedAt = new Date().toISOString();
    report.result = 'PASS';
    report.phase = 'complete';
    report.finishedAt = entry.finishedAt;
    writeReport();
    console.log(`Live release contract: PASS (release ${releaseSha}, control ${controlPlaneSha}, ${expectedDigest}).`);
    process.exit(0);
  } catch (error) {
    lastError = error;
    entry.result = 'FAIL';
    entry.error = String(error?.stack || error);
    entry.finishedAt = new Date().toISOString();
    writeReport();
    console.warn(`[live-release] attempt ${attempt}/${maxAttempts} failed: ${error.message || error}`);
    if (attempt < maxAttempts) await sleep(retryDelayMs);
  }
}
report.result = 'FAIL';
report.phase = 'live';
report.finishedAt = new Date().toISOString();
report.error = String(lastError?.stack || lastError || 'unknown live release failure');
writeReport();
console.error(lastError || new Error('Live release contract failed'));
process.exit(1);
