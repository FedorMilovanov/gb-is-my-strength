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
const REPORT_PATH = path.join(REPORTS, 'tts-live-deployment-contract.json');
const LIVE_BASE_URL = String(process.env.LIVE_BASE_URL || 'https://gospod-bog.ru').replace(/\/+$/, '');
const RELEASE_SHA = String(process.env.RELEASE_SHA || '').trim().toLowerCase();
const CONTROL_PLANE_SHA = String(process.env.CONTROL_PLANE_SHA || '').trim().toLowerCase();
const EXPECTED_REPOSITORY = String(process.env.GITHUB_REPOSITORY || 'FedorMilovanov/gb-is-my-strength').trim();
const WORKFLOW_RUN_ID = Number(process.env.GITHUB_RUN_ID || 0);
const WORKFLOW_RUN_ATTEMPT = Number(process.env.GITHUB_RUN_ATTEMPT || 0);
const EXPECTED_CANDIDATE_DIGEST = String(process.env.EXPECTED_CANDIDATE_DIGEST || '').trim();
const MAX_ATTEMPTS = Number.parseInt(process.env.TTS_LIVE_MAX_ATTEMPTS || '36', 10);
const RETRY_DELAY_MS = Number.parseInt(process.env.TTS_LIVE_RETRY_DELAY_MS || '10000', 10);
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.TTS_LIVE_REQUEST_TIMEOUT_MS || '30000', 10);

assert.match(RELEASE_SHA, /^[a-f0-9]{40}$/, 'RELEASE_SHA must be an exact 40-character commit SHA');
assert.match(CONTROL_PLANE_SHA, /^[a-f0-9]{40}$/, 'CONTROL_PLANE_SHA must be an exact 40-character commit SHA');
assert.match(EXPECTED_REPOSITORY, /^[^/\s]+\/[^/\s]+$/, 'GITHUB_REPOSITORY must be owner/name');
assert.ok(Number.isSafeInteger(WORKFLOW_RUN_ID) && WORKFLOW_RUN_ID > 0, 'GITHUB_RUN_ID must be positive');
assert.ok(Number.isSafeInteger(WORKFLOW_RUN_ATTEMPT) && WORKFLOW_RUN_ATTEMPT > 0, 'GITHUB_RUN_ATTEMPT must be positive');
assert.match(EXPECTED_CANDIDATE_DIGEST, /^sha256:[a-f0-9]{64}$/, 'EXPECTED_CANDIDATE_DIGEST must be exact');

const local = verifyReleaseCandidate({
  dist: DIST,
  expectedRepository: EXPECTED_REPOSITORY,
  expectedReleaseSha: RELEASE_SHA,
  expectedControlPlaneSha: CONTROL_PLANE_SHA,
  expectedRunId: WORKFLOW_RUN_ID,
  expectedRunAttempt: WORKFLOW_RUN_ATTEMPT,
});
assert.equal(local.manifest.artifact.digest, EXPECTED_CANDIDATE_DIGEST, 'local TTS candidate digest mismatch');

const ROUTES = Object.freeze([
  '/articles/dzhon-gill-chast-1-chelovek/',
  '/articles/20-antisovetov-pastoru/',
]);
const PUBLIC_ASSETS = Object.freeze({
  controller: 'js/floating-cluster-controller.js',
  engine: 'js/vosk-tts-engine.js',
  noticeCss: 'css/tts-download-notice.css',
  serviceWorker: 'sw.js',
});
const ttsManifest = local.manifest.extensions?.tts;
assert.ok(ttsManifest?.assets, 'release candidate lacks extensions.tts assets');
assert.deepEqual(ttsManifest.lazyNoPrecache, [PUBLIC_ASSETS.noticeCss, PUBLIC_ASSETS.engine]);

function readDist(relativePath) {
  const absolute = path.join(DIST, relativePath);
  assert.ok(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), `dist asset is missing: ${relativePath}`);
  return fs.readFileSync(absolute);
}
function md5(buffer) { return crypto.createHash('md5').update(buffer).digest('hex').slice(0, 8); }
function sha256(buffer) { return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`; }

const deployed = Object.fromEntries(Object.entries(PUBLIC_ASSETS).map(([name, relative]) => [name, readDist(relative)]));
const runIdentity = `${WORKFLOW_RUN_ID}-${WORKFLOW_RUN_ATTEMPT}`;
const expected = Object.freeze({
  currentPointerPath: '/deployments/current.json',
  provenancePath: `/deployments/${RELEASE_SHA}/${runIdentity}.json`,
  candidateDigest: EXPECTED_CANDIDATE_DIGEST,
  controllerPath: `/js/floating-cluster-controller.js?v=${md5(deployed.controller)}`,
  enginePath: `/js/vosk-tts-engine.js?v=${md5(deployed.engine)}`,
  noticeCssPath: `/css/tts-download-notice.css?v=${md5(deployed.noticeCss)}`,
});

fs.mkdirSync(REPORTS, { recursive: true });
const report = {
  liveBaseUrl: LIVE_BASE_URL,
  releaseSha: RELEASE_SHA,
  controlPlaneSha: CONTROL_PLANE_SHA,
  expectedRepository: EXPECTED_REPOSITORY,
  workflowRunId: WORKFLOW_RUN_ID,
  workflowRunAttempt: WORKFLOW_RUN_ATTEMPT,
  candidateDigest: EXPECTED_CANDIDATE_DIGEST,
  expected,
  startedAt: new Date().toISOString(),
  attempts: [],
};
function writeReport() { fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8'); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function decodeHtmlAttribute(value) {
  return String(value || '').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&amp;/gi, '&');
}
function getAttribute(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(tag).match(new RegExp(`\\b${escaped}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
  return match ? decodeHtmlAttribute(match[2]) : '';
}
function extractCsp(html) {
  for (const tag of String(html).match(/<meta\b[^>]*>/gi) || []) {
    if (getAttribute(tag, 'http-equiv').toLowerCase() === 'content-security-policy') return getAttribute(tag, 'content');
  }
  return '';
}
function extractDirective(csp, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(csp).match(new RegExp(`(?:^|;)\\s*${escaped}\\s+([^;]+)`, 'i'));
  return match ? match[1].trim() : '';
}
function extractControllerSrc(html) {
  for (const tag of String(html).match(/<script\b[^>]*>/gi) || []) {
    const src = getAttribute(tag, 'src');
    if (/floating-cluster-controller\.js\?v=[a-f0-9]{8}(?:&|$)/i.test(src)) return src;
  }
  return '';
}
function assertCsp(csp, route) {
  assert.ok(csp, `${route}: Content-Security-Policy meta is missing`);
  const connectSrc = extractDirective(csp, 'connect-src');
  const mediaSrc = extractDirective(csp, 'media-src');
  const workerSrc = extractDirective(csp, 'worker-src');
  assert.match(connectSrc, /https:\/\/huggingface\.co(?:\s|$)/, `${route}: connect-src lacks huggingface.co`);
  assert.match(connectSrc, /https:\/\/\*\.aws\.cdn\.hf\.co(?:\s|$)/, `${route}: connect-src lacks *.aws.cdn.hf.co`);
  assert.match(connectSrc, /https:\/\/cdn\.jsdelivr\.net(?:\s|$)/, `${route}: connect-src lacks cdn.jsdelivr.net`);
  assert.match(mediaSrc, /(?:^|\s)'self'(?:\s|$)/, `${route}: media-src lacks self`);
  assert.match(mediaSrc, /(?:^|\s)blob:(?:\s|$)/, `${route}: media-src lacks blob`);
  assert.match(workerSrc, /(?:^|\s)'self'(?:\s|$)/, `${route}: worker-src lacks self`);
  assert.match(workerSrc, /(?:^|\s)blob:(?:\s|$)/, `${route}: worker-src lacks blob`);
  return { connectSrc, mediaSrc, workerSrc };
}
function probeUrl(relative, attempt, label) {
  const target = new URL(relative, LIVE_BASE_URL);
  target.searchParams.set('tts_deploy_contract', `${RELEASE_SHA.slice(0, 12)}-${CONTROL_PLANE_SHA.slice(0, 12)}-${attempt}-${label}-${Date.now()}`);
  return target;
}
async function fetchBuffer(relative, attempt, label) {
  const target = probeUrl(relative, attempt, label);
  const response = await fetch(target, {
    cache: 'no-store', redirect: 'follow',
    headers: { 'cache-control': 'no-cache, no-store, max-age=0', pragma: 'no-cache', 'user-agent': 'gb-tts-live-deployment-contract/5.0' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  assert.equal(response.ok, true, `${label}: HTTP ${response.status} for ${target}`);
  return { url: response.url, contentType: response.headers.get('content-type') || '', buffer: Buffer.from(await response.arrayBuffer()) };
}
function parseJson(response, label) {
  try { return JSON.parse(response.buffer.toString('utf8')); }
  catch (error) { throw new Error(`${label} is not valid JSON: ${error.message || error}`); }
}
function assertPointer(pointer) {
  assert.equal(pointer.schemaVersion, 3, 'deployment current pointer schema drifted');
  assert.equal(pointer.repository, EXPECTED_REPOSITORY, 'deployment current pointer repository mismatch');
  assert.equal(pointer.releaseSha, RELEASE_SHA, 'deployment current pointer release SHA mismatch');
  assert.equal(pointer.controlPlaneSha, CONTROL_PLANE_SHA, 'deployment current pointer control-plane SHA mismatch');
  assert.equal(pointer.immutablePath, expected.provenancePath, 'deployment current pointer path mismatch');
  assert.equal(pointer.workflow?.name, 'Deploy to GitHub Pages', 'deployment current pointer workflow mismatch');
  assert.equal(pointer.workflow?.stage, 'readiness', 'deployment current pointer stage mismatch');
  assert.equal(pointer.workflow?.controlPlaneSha, CONTROL_PLANE_SHA, 'deployment current pointer workflow control-plane SHA mismatch');
  assert.equal(pointer.workflow?.runId, WORKFLOW_RUN_ID, 'deployment current pointer run ID mismatch');
  assert.equal(pointer.workflow?.runAttempt, WORKFLOW_RUN_ATTEMPT, 'deployment current pointer run attempt mismatch');
  assert.equal(pointer.artifact?.digest, EXPECTED_CANDIDATE_DIGEST, 'deployment current pointer candidate digest mismatch');
}
function assertProvenance(manifest) {
  assert.equal(manifest.schemaVersion, 4, 'deployment provenance schema drifted');
  assert.equal(manifest.repository, EXPECTED_REPOSITORY, 'deployment provenance repository mismatch');
  assert.equal(manifest.releaseSha, RELEASE_SHA, 'deployment provenance release SHA mismatch');
  assert.equal(manifest.controlPlaneSha, CONTROL_PLANE_SHA, 'deployment provenance control-plane SHA mismatch');
  assert.equal(manifest.immutablePath, expected.provenancePath, 'deployment provenance path mismatch');
  assert.equal(manifest.workflow?.controlPlaneSha, CONTROL_PLANE_SHA, 'deployment provenance workflow control-plane SHA mismatch');
  assert.equal(manifest.workflow?.runId, WORKFLOW_RUN_ID, 'deployment provenance run ID mismatch');
  assert.equal(manifest.workflow?.runAttempt, WORKFLOW_RUN_ATTEMPT, 'deployment provenance run attempt mismatch');
  assert.equal(manifest.artifact?.digest, EXPECTED_CANDIDATE_DIGEST, 'deployment provenance candidate digest mismatch');
  assert.deepEqual(manifest.extensions?.tts, ttsManifest, 'deployment provenance TTS extension mismatch');
}
async function verifyAttempt(attempt) {
  const pointer = parseJson(await fetchBuffer(expected.currentPointerPath, attempt, 'deployment-current-pointer'), 'deployment current pointer');
  assertPointer(pointer);
  const provenance = parseJson(await fetchBuffer(expected.provenancePath, attempt, 'deployment-provenance'), 'deployment provenance');
  assertProvenance(provenance);

  const routeEvidence = [];
  for (const route of ROUTES) {
    const page = await fetchBuffer(route, attempt, `html-${route.replace(/\W+/g, '-')}`);
    assert.match(page.contentType, /text\/html/i, `${route}: unexpected content-type ${page.contentType}`);
    const html = page.buffer.toString('utf8');
    const directives = assertCsp(extractCsp(html), route);
    const controllerSrc = extractControllerSrc(html);
    assert.ok(controllerSrc, `${route}: floating-cluster-controller.js is missing`);
    const resolved = new URL(controllerSrc, `${LIVE_BASE_URL}${route}`);
    assert.equal(resolved.pathname + resolved.search, expected.controllerPath, `${route}: stale controller projection`);
    routeEvidence.push({ route, controllerSrc: resolved.pathname + resolved.search, directives });
  }

  const controller = await fetchBuffer(expected.controllerPath, attempt, 'controller');
  assert.equal(sha256(controller.buffer), ttsManifest.assets.controller.sha256, 'live controller SHA-256 mismatch');
  const controllerText = controller.buffer.toString('utf8');
  assert.ok(controllerText.includes(expected.enginePath), 'live controller references stale Vosk engine');
  assert.ok(controllerText.includes(expected.noticeCssPath), 'live controller references stale notice CSS');
  assert.ok(controllerText.includes('Сейчас системный голос'), 'live controller lacks browser-voice status');

  const engine = await fetchBuffer(expected.enginePath, attempt, 'engine');
  assert.equal(sha256(engine.buffer), ttsManifest.assets.engine.sha256, 'live Vosk engine SHA-256 mismatch');
  const engineText = engine.buffer.toString('utf8');
  assert.ok(engineText.includes(expected.noticeCssPath), 'live Vosk engine references stale notice CSS');
  assert.match(engineText, /MODEL_URL\s*=\s*'https:\/\/huggingface\.co\//, 'live Vosk engine model host drifted');
  assert.ok(engineText.includes('Улучшенный голос загружается'), 'live Vosk engine lacks loading status copy');

  const noticeCss = await fetchBuffer(expected.noticeCssPath, attempt, 'notice-css');
  assert.equal(sha256(noticeCss.buffer), ttsManifest.assets.noticeCss.sha256, 'live notice CSS SHA-256 mismatch');
  assert.match(noticeCss.buffer.toString('utf8'), /@media \(max-width:480px\)[\s\S]*left:max\(10px,env\(safe-area-inset-left,0px\)\)[\s\S]*right:max\(10px,env\(safe-area-inset-right,0px\)\)/, 'live notice CSS lost mobile viewport insets');

  const sw = await fetchBuffer('/sw.js', attempt, 'service-worker');
  assert.equal(sha256(sw.buffer), ttsManifest.assets.serviceWorker.sha256, 'live Service Worker SHA-256 mismatch');
  const swText = sw.buffer.toString('utf8');
  assert.equal(swText.includes('/css/tts-download-notice.css'), false, 'live Service Worker precaches lazy TTS notice CSS');
  assert.equal(swText.includes('/js/vosk-tts-engine.js'), false, 'live Service Worker precaches lazy Vosk engine');

  return {
    discovery: {
      path: expected.currentPointerPath,
      immutablePath: pointer.immutablePath,
      releaseSha: pointer.releaseSha,
      controlPlaneSha: pointer.controlPlaneSha,
      workflowRunId: pointer.workflow.runId,
      workflowRunAttempt: pointer.workflow.runAttempt,
      candidateDigest: pointer.artifact.digest,
    },
    provenance: {
      path: expected.provenancePath,
      releaseSha: provenance.releaseSha,
      controlPlaneSha: provenance.controlPlaneSha,
      workflowRunId: provenance.workflow.runId,
      workflowRunAttempt: provenance.workflow.runAttempt,
      candidateDigest: provenance.artifact.digest,
    },
    routeEvidence,
    assets: {
      controller: { path: expected.controllerPath, revision: md5(controller.buffer), sha256: sha256(controller.buffer).slice('sha256:'.length) },
      engine: { path: expected.enginePath, revision: md5(engine.buffer), sha256: sha256(engine.buffer).slice('sha256:'.length) },
      noticeCss: { path: expected.noticeCssPath, revision: md5(noticeCss.buffer), sha256: sha256(noticeCss.buffer).slice('sha256:'.length) },
      serviceWorker: { url: sw.url, revision: md5(sw.buffer), sha256: sha256(sw.buffer).slice('sha256:'.length), lazyTtsPrecache: false },
    },
  };
}

let lastError = null;
for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  const entry = { attempt, startedAt: new Date().toISOString() };
  report.attempts.push(entry);
  try {
    entry.evidence = await verifyAttempt(attempt);
    entry.result = 'PASS';
    entry.finishedAt = new Date().toISOString();
    report.result = 'PASS';
    report.finishedAt = entry.finishedAt;
    writeReport();
    console.log(`TTS live deployment contract: PASS (release ${RELEASE_SHA}, control ${CONTROL_PLANE_SHA}, run ${runIdentity}, candidate ${EXPECTED_CANDIDATE_DIGEST}).`);
    process.exit(0);
  } catch (error) {
    lastError = error;
    entry.result = 'FAIL';
    entry.error = String(error?.stack || error);
    entry.finishedAt = new Date().toISOString();
    writeReport();
    console.warn(`[tts-live-deployment] attempt ${attempt}/${MAX_ATTEMPTS} failed: ${error.message || error}`);
    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
  }
}
report.result = 'FAIL';
report.finishedAt = new Date().toISOString();
report.error = String(lastError?.stack || lastError || 'unknown live deployment failure');
writeReport();
console.error(lastError || new Error('TTS live deployment contract failed'));
process.exit(1);
