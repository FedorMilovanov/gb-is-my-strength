#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const REPORTS = path.join(ROOT, 'reports');
const REPORT_PATH = path.join(REPORTS, 'tts-live-deployment-contract.json');
const LIVE_BASE_URL = String(process.env.LIVE_BASE_URL || 'https://gospod-bog.ru').replace(/\/+$/, '');
const DEPLOYED_SHA = String(process.env.DEPLOYED_SHA || process.env.GITHUB_SHA || 'unknown').trim().toLowerCase();
const EXPECTED_REPOSITORY = String(process.env.GITHUB_REPOSITORY || 'FedorMilovanov/gb-is-my-strength').trim();
const MAX_ATTEMPTS = Number.parseInt(process.env.TTS_LIVE_MAX_ATTEMPTS || '36', 10);
const RETRY_DELAY_MS = Number.parseInt(process.env.TTS_LIVE_RETRY_DELAY_MS || '10000', 10);
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.TTS_LIVE_REQUEST_TIMEOUT_MS || '30000', 10);

assert.match(DEPLOYED_SHA, /^[a-f0-9]{40}$/, 'DEPLOYED_SHA must be an exact 40-character commit SHA');
assert.match(EXPECTED_REPOSITORY, /^[^/\s]+\/[^/\s]+$/, 'GITHUB_REPOSITORY must be owner/name');
assert.ok(fs.existsSync(DIST) && fs.statSync(DIST).isDirectory(), 'dist must exist before live deployment verification');

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

fs.mkdirSync(REPORTS, { recursive: true });

function readDeployedBuffer(relativePath) {
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

const deployed = {
  controller: readDeployedBuffer(PUBLIC_ASSETS.controller),
  engine: readDeployedBuffer(PUBLIC_ASSETS.engine),
  noticeCss: readDeployedBuffer(PUBLIC_ASSETS.noticeCss),
  serviceWorker: readDeployedBuffer(PUBLIC_ASSETS.serviceWorker),
};

const expected = Object.freeze({
  controllerRevision: md5(deployed.controller),
  engineRevision: md5(deployed.engine),
  noticeCssRevision: md5(deployed.noticeCss),
  serviceWorkerRevision: md5(deployed.serviceWorker),
  controllerSha256: sha256(deployed.controller),
  engineSha256: sha256(deployed.engine),
  noticeCssSha256: sha256(deployed.noticeCss),
  serviceWorkerSha256: sha256(deployed.serviceWorker),
  controllerPath: `/js/floating-cluster-controller.js?v=${md5(deployed.controller)}`,
  enginePath: `/js/vosk-tts-engine.js?v=${md5(deployed.engine)}`,
  noticeCssPath: `/css/tts-download-notice.css?v=${md5(deployed.noticeCss)}`,
  provenancePath: `/deployments/${DEPLOYED_SHA}.json`,
});

const report = {
  liveBaseUrl: LIVE_BASE_URL,
  deployedSha: DEPLOYED_SHA,
  expectedRepository: EXPECTED_REPOSITORY,
  expected,
  startedAt: new Date().toISOString(),
  attempts: [],
};

function writeReport() {
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtmlAttribute(value) {
  return String(value || '')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&');
}

function getAttribute(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(tag).match(new RegExp(`\\b${escaped}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
  return match ? decodeHtmlAttribute(match[2]) : '';
}

function extractCsp(html) {
  const tags = String(html).match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    if (getAttribute(tag, 'http-equiv').toLowerCase() === 'content-security-policy') {
      return getAttribute(tag, 'content');
    }
  }
  return '';
}

function extractDirective(csp, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(csp).match(new RegExp(`(?:^|;)\\s*${escaped}\\s+([^;]+)`, 'i'));
  return match ? match[1].trim() : '';
}

function extractControllerSrc(html) {
  const scripts = String(html).match(/<script\b[^>]*>/gi) || [];
  for (const tag of scripts) {
    const src = getAttribute(tag, 'src');
    if (/floating-cluster-controller\.js\?v=[a-f0-9]{8}(?:&|$)/i.test(src)) return src;
  }
  return '';
}

function withProbe(url, attempt, label) {
  const target = new URL(url, LIVE_BASE_URL);
  target.searchParams.set('tts_deploy_contract', `${DEPLOYED_SHA.slice(0, 12)}-${attempt}-${label}-${Date.now()}`);
  return target;
}

async function fetchBuffer(url, attempt, label) {
  const target = withProbe(url, attempt, label);
  const response = await fetch(target, {
    cache: 'no-store',
    redirect: 'follow',
    headers: {
      'cache-control': 'no-cache, no-store, max-age=0',
      pragma: 'no-cache',
      'user-agent': 'gb-tts-live-deployment-contract/2.0',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  assert.equal(response.ok, true, `${label}: HTTP ${response.status} for ${target}`);
  return {
    url: response.url,
    contentType: response.headers.get('content-type') || '',
    buffer: Buffer.from(await response.arrayBuffer()),
  };
}

function assertDistRevisionChain() {
  const controllerText = deployed.controller.toString('utf8');
  const engineText = deployed.engine.toString('utf8');
  assert.ok(controllerText.includes(expected.enginePath), `dist controller does not own ${expected.enginePath}`);
  assert.ok(controllerText.includes(expected.noticeCssPath), `dist controller does not own ${expected.noticeCssPath}`);
  assert.ok(engineText.includes(expected.noticeCssPath), `dist engine does not own ${expected.noticeCssPath}`);
}

function assertCsp(csp, route) {
  assert.ok(csp, `${route}: Content-Security-Policy meta is missing`);
  const connectSrc = extractDirective(csp, 'connect-src');
  const mediaSrc = extractDirective(csp, 'media-src');
  const workerSrc = extractDirective(csp, 'worker-src');
  assert.match(connectSrc, /https:\/\/huggingface\.co(?:\s|$)/, `${route}: connect-src lacks huggingface.co`);
  assert.match(connectSrc, /https:\/\/\*\.aws\.cdn\.hf\.co(?:\s|$)/, `${route}: connect-src lacks *.aws.cdn.hf.co`);
  assert.match(connectSrc, /https:\/\/cdn\.jsdelivr\.net(?:\s|$)/, `${route}: connect-src lacks cdn.jsdelivr.net`);
  assert.match(mediaSrc, /(?:^|\s)'self'(?:\s|$)/, `${route}: media-src lacks 'self'`);
  assert.match(mediaSrc, /(?:^|\s)blob:(?:\s|$)/, `${route}: media-src lacks blob:`);
  assert.match(workerSrc, /(?:^|\s)'self'(?:\s|$)/, `${route}: worker-src lacks 'self'`);
  assert.match(workerSrc, /(?:^|\s)blob:(?:\s|$)/, `${route}: worker-src lacks blob:`);
  return { connectSrc, mediaSrc, workerSrc };
}

function assertProvenance(manifest) {
  assert.equal(manifest.schemaVersion, 1, 'deployment provenance schema drifted');
  assert.equal(manifest.repository, EXPECTED_REPOSITORY, 'deployment provenance repository mismatch');
  assert.equal(manifest.commitSha, DEPLOYED_SHA, 'deployment provenance commit SHA mismatch');
  assert.equal(manifest.immutablePath, expected.provenancePath, 'deployment provenance path mismatch');
  assert.equal(manifest.workflow && manifest.workflow.name, 'Deploy to GitHub Pages', 'deployment provenance workflow mismatch');
  assert.ok(Number.isInteger(manifest.workflow && manifest.workflow.runId) && manifest.workflow.runId > 0, 'deployment provenance run ID is missing');
  assert.ok(Number.isInteger(manifest.workflow && manifest.workflow.runAttempt) && manifest.workflow.runAttempt > 0, 'deployment provenance run attempt is missing');

  const assets = manifest.tts && manifest.tts.assets;
  assert.ok(assets, 'deployment provenance TTS assets are missing');
  assert.equal(assets.controller.path, '/js/floating-cluster-controller.js');
  assert.equal(assets.controller.md5, expected.controllerRevision);
  assert.equal(assets.controller.sha256, expected.controllerSha256);
  assert.equal(assets.engine.path, '/js/vosk-tts-engine.js');
  assert.equal(assets.engine.md5, expected.engineRevision);
  assert.equal(assets.engine.sha256, expected.engineSha256);
  assert.equal(assets.noticeCss.path, '/css/tts-download-notice.css');
  assert.equal(assets.noticeCss.md5, expected.noticeCssRevision);
  assert.equal(assets.noticeCss.sha256, expected.noticeCssSha256);
  assert.equal(assets.serviceWorker.path, '/sw.js');
  assert.equal(assets.serviceWorker.md5, expected.serviceWorkerRevision);
  assert.equal(assets.serviceWorker.sha256, expected.serviceWorkerSha256);
  assert.deepEqual(manifest.tts.lazyNoPrecache, [PUBLIC_ASSETS.noticeCss, PUBLIC_ASSETS.engine]);
}

async function verifyAttempt(attempt) {
  assertDistRevisionChain();

  const provenanceResponse = await fetchBuffer(`${LIVE_BASE_URL}${expected.provenancePath}`, attempt, 'deployment-provenance');
  assert.match(provenanceResponse.contentType, /(?:application\/json|text\/plain|octet-stream)/i, `deployment provenance: unexpected content-type ${provenanceResponse.contentType}`);
  let provenance;
  try {
    provenance = JSON.parse(provenanceResponse.buffer.toString('utf8'));
  } catch (error) {
    throw new Error(`deployment provenance is not valid JSON: ${error.message || error}`);
  }
  assertProvenance(provenance);

  const routeEvidence = [];
  for (const route of ROUTES) {
    const page = await fetchBuffer(`${LIVE_BASE_URL}${route}`, attempt, `html-${route.replace(/\W+/g, '-')}`);
    assert.match(page.contentType, /text\/html/i, `${route}: unexpected content-type ${page.contentType}`);
    const html = page.buffer.toString('utf8');
    const csp = extractCsp(html);
    const directives = assertCsp(csp, route);
    const controllerSrc = extractControllerSrc(html);
    assert.ok(controllerSrc, `${route}: floating-cluster-controller.js is missing`);
    const resolvedController = new URL(controllerSrc, `${LIVE_BASE_URL}${route}`);
    assert.equal(
      resolvedController.pathname + resolvedController.search,
      expected.controllerPath,
      `${route}: stale controller projection`,
    );
    routeEvidence.push({ route, controllerSrc: resolvedController.pathname + resolvedController.search, directives });
  }

  const controller = await fetchBuffer(`${LIVE_BASE_URL}${expected.controllerPath}`, attempt, 'controller');
  assert.match(controller.contentType, /(?:javascript|ecmascript|text\/plain)/i, `controller: unexpected content-type ${controller.contentType}`);
  assert.equal(md5(controller.buffer), expected.controllerRevision, 'live controller bytes do not match deployed revision');
  assert.equal(sha256(controller.buffer), expected.controllerSha256, 'live controller SHA-256 does not match deployed revision');
  const controllerText = controller.buffer.toString('utf8');
  assert.ok(controllerText.includes(expected.enginePath), 'live controller references a stale Vosk engine');
  assert.ok(controllerText.includes(expected.noticeCssPath), 'live controller references stale notice CSS');
  assert.ok(controllerText.includes('Сейчас системный голос'), 'live controller lacks the browser-voice status');

  const engine = await fetchBuffer(`${LIVE_BASE_URL}${expected.enginePath}`, attempt, 'engine');
  assert.match(engine.contentType, /(?:javascript|ecmascript|text\/plain)/i, `engine: unexpected content-type ${engine.contentType}`);
  assert.equal(md5(engine.buffer), expected.engineRevision, 'live Vosk engine bytes do not match deployed revision');
  assert.equal(sha256(engine.buffer), expected.engineSha256, 'live Vosk engine SHA-256 does not match deployed revision');
  const engineText = engine.buffer.toString('utf8');
  assert.ok(engineText.includes(expected.noticeCssPath), 'live Vosk engine references stale notice CSS');
  assert.match(engineText, /MODEL_URL\s*=\s*'https:\/\/huggingface\.co\//, 'live Vosk engine model host drifted');
  assert.ok(engineText.includes('Улучшенный голос загружается'), 'live Vosk engine lacks loading status copy');

  const noticeCss = await fetchBuffer(`${LIVE_BASE_URL}${expected.noticeCssPath}`, attempt, 'notice-css');
  assert.match(noticeCss.contentType, /text\/css/i, `notice CSS: unexpected content-type ${noticeCss.contentType}`);
  assert.equal(md5(noticeCss.buffer), expected.noticeCssRevision, 'live notice CSS bytes do not match deployed revision');
  assert.equal(sha256(noticeCss.buffer), expected.noticeCssSha256, 'live notice CSS SHA-256 does not match deployed revision');
  const noticeCssText = noticeCss.buffer.toString('utf8');
  assert.match(noticeCssText, /@media \(max-width:480px\)[\s\S]*left:max\(10px,env\(safe-area-inset-left,0px\)\)[\s\S]*right:max\(10px,env\(safe-area-inset-right,0px\)\)/, 'live notice CSS lost mobile viewport insets');

  const sw = await fetchBuffer(`${LIVE_BASE_URL}/sw.js`, attempt, 'service-worker');
  assert.match(sw.contentType, /(?:javascript|ecmascript|text\/plain)/i, `sw.js: unexpected content-type ${sw.contentType}`);
  assert.equal(md5(sw.buffer), expected.serviceWorkerRevision, 'live Service Worker bytes do not match deployment provenance');
  assert.equal(sha256(sw.buffer), expected.serviceWorkerSha256, 'live Service Worker SHA-256 does not match deployment provenance');
  const swText = sw.buffer.toString('utf8');
  assert.equal(swText.includes('/css/tts-download-notice.css'), false, 'live Service Worker precaches lazy TTS notice CSS');
  assert.equal(swText.includes('/js/vosk-tts-engine.js'), false, 'live Service Worker precaches lazy Vosk engine');

  return {
    provenance: {
      path: expected.provenancePath,
      commitSha: provenance.commitSha,
      workflowRunId: provenance.workflow.runId,
      workflowRunAttempt: provenance.workflow.runAttempt,
      sourceReadinessRunId: provenance.workflow.sourceReadinessRunId,
    },
    routeEvidence,
    assets: {
      controller: { path: expected.controllerPath, revision: md5(controller.buffer), sha256: sha256(controller.buffer) },
      engine: { path: expected.enginePath, revision: md5(engine.buffer), sha256: sha256(engine.buffer) },
      noticeCss: { path: expected.noticeCssPath, revision: md5(noticeCss.buffer), sha256: sha256(noticeCss.buffer) },
      serviceWorker: { url: sw.url, revision: md5(sw.buffer), sha256: sha256(sw.buffer), lazyTtsPrecache: false },
    },
  };
}

let lastError = null;
for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  const attemptRecord = { attempt, startedAt: new Date().toISOString() };
  report.attempts.push(attemptRecord);
  try {
    const evidence = await verifyAttempt(attempt);
    attemptRecord.result = 'PASS';
    attemptRecord.finishedAt = new Date().toISOString();
    attemptRecord.evidence = evidence;
    report.result = 'PASS';
    report.finishedAt = new Date().toISOString();
    writeReport();
    console.log(`TTS live deployment contract: PASS on attempt ${attempt} (${DEPLOYED_SHA}).`);
    process.exit(0);
  } catch (error) {
    lastError = error;
    attemptRecord.result = 'FAIL';
    attemptRecord.finishedAt = new Date().toISOString();
    attemptRecord.error = String(error && error.stack || error);
    writeReport();
    console.warn(`[tts-live-deployment] attempt ${attempt}/${MAX_ATTEMPTS} failed: ${error.message || error}`);
    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
  }
}

report.result = 'FAIL';
report.finishedAt = new Date().toISOString();
report.error = String(lastError && lastError.stack || lastError || 'unknown live deployment failure');
writeReport();
console.error(lastError || new Error('TTS live deployment contract failed'));
process.exit(1);
