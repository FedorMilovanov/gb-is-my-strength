#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { verifyDiotrophesLiveRelease } from './diotrophes-live-release-contract.mjs';

const RELEASE_SHA = 'a'.repeat(40);
const CONTROL_SHA = 'b'.repeat(40);
const RUN_ID = 30850000001;
const RUN_ATTEMPT = 1;
const CANDIDATE_DIGEST = `sha256:${'c'.repeat(64)}`;
const CANDIDATE_ID = `${RELEASE_SHA}:${RUN_ID}-${RUN_ATTEMPT}`;
const IMMUTABLE_PATH = `/deployments/${RELEASE_SHA}/${RUN_ID}-${RUN_ATTEMPT}.json`;
const ROUTE = '/articles/diotrefy-nashego-vremeni/';

function pointer(overrides = {}) {
  return {
    schemaVersion: 3,
    repository: 'FedorMilovanov/gb-is-my-strength',
    releaseSha: RELEASE_SHA,
    controlPlaneSha: CONTROL_SHA,
    immutablePath: IMMUTABLE_PATH,
    workflow: {
      name: 'Deploy to GitHub Pages',
      stage: 'readiness',
      controlPlaneSha: CONTROL_SHA,
      runId: RUN_ID,
      runAttempt: RUN_ATTEMPT,
    },
    artifact: {
      candidateId: CANDIDATE_ID,
      digest: CANDIDATE_DIGEST,
    },
    ...overrides,
  };
}

function genericReport(overrides = {}) {
  return {
    liveBaseUrl: 'https://gospod-bog.ru',
    repository: 'FedorMilovanov/gb-is-my-strength',
    releaseSha: RELEASE_SHA,
    controlPlaneSha: CONTROL_SHA,
    workflowRunId: RUN_ID,
    workflowRunAttempt: RUN_ATTEMPT,
    candidate: {
      id: CANDIDATE_ID,
      digest: CANDIDATE_DIGEST,
      bytes: 123456,
      files: 999,
      immutablePath: IMMUTABLE_PATH,
    },
    result: 'PASS',
    attempts: [{
      attempt: 1,
      result: 'PASS',
      evidence: {
        currentPointer: '/deployments/current.json',
        immutablePath: IMMUTABLE_PATH,
        releaseSha: RELEASE_SHA,
        controlPlaneSha: CONTROL_SHA,
        candidateId: CANDIDATE_ID,
        candidateDigest: CANDIDATE_DIGEST,
        build: {},
        criticalAssets: {},
      },
    }],
    ...overrides,
  };
}

function link(href) {
  return `<a href="${href}">source</a>`;
}

function validHtml(overrides = {}) {
  const baseLinks = Array.from({ length: 40 }, (_, index) => link(`https://example.test/source-${index}`)).join('');
  const supplementLinks = [
    ...Array.from({ length: 3 }, (_, index) => link(`https://example.test/source-${index}`)),
    ...Array.from({ length: 30 }, (_, index) => link(`https://example.test/source-${index + 40}`)),
  ].join('');
  const values = {
    bodyMarker: 'true',
    authority: '148',
    title: 'Диотрефы нашего времени — Господь Бог',
    h1: 'Диотрефы нашего времени',
    robots: 'index,follow',
    canonical: 'https://gospod-bog.ru/articles/diotrefy-nashego-vremeni/',
    draftText: '',
    ...overrides,
  };
  return `<!doctype html>
<html lang="ru">
<head>
  <title>${values.title}</title>
  <link rel="canonical" href="${values.canonical}">
  <meta content="${values.robots}" name="robots">
</head>
<body data-wave12-publication="${values.bodyMarker}">
  <main data-source-authority="${values.authority}">
    <h1>${values.h1}</h1>
    <section id="faithful-witness-under-pressure"></section>
    <section id="twenty-faithful-responses"></section>
    <section id="sources"><div>${baseLinks}</div></section>
    <section id="faithful-witness-sources"><div>${supplementLinks}</div></section>
    ${values.draftText}
  </main>
</body>
</html>`;
}

function makeWitnessDirectory(root, report = genericReport()) {
  const directory = path.join(root, 'witness');
  fs.mkdirSync(path.join(directory, 'release', 'reports'), { recursive: true });
  fs.writeFileSync(
    path.join(directory, 'release', 'reports', 'release-live-deployment-contract.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  return directory;
}

async function withServer({ html = validHtml(), pointerFactory = () => pointer() }, callback) {
  let pointerReads = 0;
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
    if (pathname === '/deployments/current.json') {
      pointerReads += 1;
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify(pointerFactory(pointerReads)));
      return;
    }
    if (pathname === ROUTE) {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      response.end(html);
      return;
    }
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('not found');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

const roots = [];
try {
  {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'diotrophes-live-pass-'));
    roots.push(root);
    const witnessDirectory = makeWitnessDirectory(root);
    const report = await withServer({}, (liveBaseUrl) => verifyDiotrophesLiveRelease({
      witnessDirectory,
      liveBaseUrl,
      reportPath: path.join(root, 'report.json'),
      timeoutMs: 5000,
    }));
    assert.equal(report.result, 'PASS');
    assert.equal(report.releaseSha, RELEASE_SHA);
    assert.equal(report.controlPlaneSha, CONTROL_SHA);
    assert.equal(report.candidateDigest, CANDIDATE_DIGEST);
    assert.equal(report.evidence.pointer.stableAcrossRouteRead, true);
    assert.equal(report.evidence.route.status, 200);
    assert.equal(report.evidence.route.publicationMarker, 'true');
    assert.equal(report.evidence.route.sourceAuthority, '148');
    assert.deepEqual(report.evidence.route.sourceLinks, { base: 40, supplement: 33, total: 73, unique: 70 });
  }

  {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'diotrophes-live-authority-'));
    roots.push(root);
    const witnessDirectory = makeWitnessDirectory(root);
    await assert.rejects(
      withServer({ html: validHtml({ authority: '147' }) }, (liveBaseUrl) => verifyDiotrophesLiveRelease({
        witnessDirectory,
        liveBaseUrl,
        reportPath: path.join(root, 'report.json'),
        timeoutMs: 5000,
      })),
      /source authority marker mismatch/,
    );
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'report.json'), 'utf8')).result, 'FAIL');
  }

  {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'diotrophes-live-draft-'));
    roots.push(root);
    const witnessDirectory = makeWitnessDirectory(root);
    await assert.rejects(
      withServer({ html: validHtml({ draftText: 'PUBLICATION_HOLD' }) }, (liveBaseUrl) => verifyDiotrophesLiveRelease({
        witnessDirectory,
        liveBaseUrl,
        reportPath: path.join(root, 'report.json'),
        timeoutMs: 5000,
      })),
      /draft\/hold text leaked/,
    );
  }

  {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'diotrophes-live-pointer-'));
    roots.push(root);
    const witnessDirectory = makeWitnessDirectory(root);
    await assert.rejects(
      withServer({ pointerFactory: (read) => read === 1 ? pointer() : pointer({ releaseSha: 'd'.repeat(40) }) }, (liveBaseUrl) => verifyDiotrophesLiveRelease({
        witnessDirectory,
        liveBaseUrl,
        reportPath: path.join(root, 'report.json'),
        timeoutMs: 5000,
      })),
      /pointer-after: release SHA mismatch/,
    );
  }

  {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'diotrophes-live-generic-'));
    roots.push(root);
    const witnessDirectory = makeWitnessDirectory(root, genericReport({ result: 'FAIL' }));
    await assert.rejects(
      withServer({}, (liveBaseUrl) => verifyDiotrophesLiveRelease({
        witnessDirectory,
        liveBaseUrl,
        reportPath: path.join(root, 'report.json'),
        timeoutMs: 5000,
      })),
      /generic live witness did not finish with PASS/,
    );
  }

  console.log('Diotrophes live release contract tests: PASS');
} finally {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
}
