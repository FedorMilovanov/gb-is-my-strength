#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const GENERIC_REPORT_BASENAME = 'release-live-deployment-contract.json';
const DEFAULT_ROUTE = '/articles/diotrefy-nashego-vremeni/';
const FULL_SHA_RE = /^[a-f0-9]{40}$/;
const DIGEST_RE = /^sha256:[a-f0-9]{64}$/;

function normalize(value) {
  return String(value ?? '').trim();
}

function findFiles(root, basename) {
  const matches = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name === basename) matches.push(absolute);
    }
  };
  visit(root);
  return matches;
}

function readGenericReport(witnessDirectory) {
  assert.ok(fs.existsSync(witnessDirectory), 'generic witness directory is missing');
  const matches = findFiles(witnessDirectory, GENERIC_REPORT_BASENAME);
  assert.equal(matches.length, 1, `expected exactly one ${GENERIC_REPORT_BASENAME}, found ${matches.length}`);
  return JSON.parse(fs.readFileSync(matches[0], 'utf8'));
}

function decodeHtml(value) {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function stripTags(value) {
  return decodeHtml(String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function parseAttributes(tag) {
  const attributes = new Map();
  const attributeRe = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = attributeRe.exec(tag))) {
    attributes.set(match[1].toLowerCase(), decodeHtml(match[2] ?? match[3] ?? ''));
  }
  return attributes;
}

function findTag(html, name, predicate = () => true) {
  const re = new RegExp(`<${name}\\b[^>]*>`, 'gi');
  let match;
  while ((match = re.exec(html))) {
    const attributes = parseAttributes(match[0]);
    if (predicate(attributes, match[0])) return { tag: match[0], attributes, index: match.index };
  }
  return null;
}

function extractElementById(html, id) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const openingRe = new RegExp(`<([a-z][\\w:-]*)\\b[^>]*\\bid=(?:"${escapedId}"|'${escapedId}')[^>]*>`, 'i');
  const opening = openingRe.exec(html);
  assert.ok(opening, `missing #${id}`);
  const tagName = opening[1];
  const tokenRe = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  tokenRe.lastIndex = opening.index;
  let depth = 0;
  let token;
  while ((token = tokenRe.exec(html))) {
    const closing = /^<\//.test(token[0]);
    if (closing) depth -= 1;
    else if (!/\/>$/.test(token[0])) depth += 1;
    if (depth === 0) return html.slice(opening.index, tokenRe.lastIndex);
  }
  throw new Error(`unterminated #${id}`);
}

function externalLinks(fragment) {
  const links = [];
  const re = /<a\b[^>]*\bhref\s*=\s*(?:"(https:\/\/[^"#]+(?:#[^"]*)?)"|'(https:\/\/[^'#]+(?:#[^']*)?)')[^>]*>/gi;
  let match;
  while ((match = re.exec(fragment))) links.push(decodeHtml(match[1] ?? match[2]));
  return links;
}

function sha256(buffer) {
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}

async function fetchResponse(baseUrl, relative, label, timeoutMs, cacheToken) {
  const target = new URL(relative, baseUrl);
  target.searchParams.set('diotrophes_release_contract', cacheToken);
  const response = await fetch(target, {
    cache: 'no-store',
    redirect: 'follow',
    headers: {
      'cache-control': 'no-cache, no-store, max-age=0',
      pragma: 'no-cache',
      'user-agent': 'gb-diotrophes-live-release-contract/1.0',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  assert.equal(response.ok, true, `${label}: HTTP ${response.status}`);
  return {
    url: response.url,
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    buffer: Buffer.from(await response.arrayBuffer()),
  };
}

function parseJson(response, label) {
  try {
    return JSON.parse(response.buffer.toString('utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message || error}`);
  }
}

function expectedFromGeneric(generic) {
  const passAttempts = Array.isArray(generic.attempts)
    ? generic.attempts.filter((attempt) => attempt?.result === 'PASS')
    : [];
  assert.equal(generic.result, 'PASS', 'generic live witness did not finish with PASS');
  assert.equal(passAttempts.length, 1, `expected exactly one generic PASS attempt, found ${passAttempts.length}`);
  const evidence = passAttempts[0].evidence;
  assert.ok(evidence, 'generic PASS attempt lacks evidence');
  const expected = {
    repository: normalize(generic.repository),
    releaseSha: normalize(generic.releaseSha).toLowerCase(),
    controlPlaneSha: normalize(generic.controlPlaneSha).toLowerCase(),
    runId: Number(generic.workflowRunId),
    runAttempt: Number(generic.workflowRunAttempt),
    candidateId: normalize(generic.candidate?.id),
    candidateDigest: normalize(generic.candidate?.digest),
    immutablePath: normalize(generic.candidate?.immutablePath),
  };
  assert.match(expected.repository, /^[^/\s]+\/[^/\s]+$/, 'generic repository is invalid');
  assert.match(expected.releaseSha, FULL_SHA_RE, 'generic release SHA is invalid');
  assert.match(expected.controlPlaneSha, FULL_SHA_RE, 'generic control-plane SHA is invalid');
  assert.ok(Number.isSafeInteger(expected.runId) && expected.runId > 0, 'generic run ID is invalid');
  assert.ok(Number.isSafeInteger(expected.runAttempt) && expected.runAttempt > 0, 'generic run attempt is invalid');
  assert.match(expected.candidateDigest, DIGEST_RE, 'generic candidate digest is invalid');
  assert.equal(evidence.releaseSha, expected.releaseSha, 'generic evidence release SHA mismatch');
  assert.equal(evidence.controlPlaneSha, expected.controlPlaneSha, 'generic evidence control-plane SHA mismatch');
  assert.equal(evidence.candidateId, expected.candidateId, 'generic evidence candidate ID mismatch');
  assert.equal(evidence.candidateDigest, expected.candidateDigest, 'generic evidence candidate digest mismatch');
  assert.equal(evidence.immutablePath, expected.immutablePath, 'generic evidence immutable path mismatch');
  return expected;
}

function assertPointer(pointer, expected, label) {
  assert.equal(pointer.schemaVersion, 3, `${label}: pointer schema drifted`);
  assert.equal(pointer.repository, expected.repository, `${label}: repository mismatch`);
  assert.equal(pointer.releaseSha, expected.releaseSha, `${label}: release SHA mismatch`);
  assert.equal(pointer.controlPlaneSha, expected.controlPlaneSha, `${label}: control-plane SHA mismatch`);
  assert.equal(pointer.immutablePath, expected.immutablePath, `${label}: immutable path mismatch`);
  assert.equal(pointer.workflow?.name, 'Deploy to GitHub Pages', `${label}: workflow mismatch`);
  assert.equal(pointer.workflow?.runId, expected.runId, `${label}: run ID mismatch`);
  assert.equal(pointer.workflow?.runAttempt, expected.runAttempt, `${label}: run attempt mismatch`);
  assert.equal(pointer.artifact?.candidateId, expected.candidateId, `${label}: candidate ID mismatch`);
  assert.equal(pointer.artifact?.digest, expected.candidateDigest, `${label}: candidate digest mismatch`);
}

function inspectHtml(html, route) {
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const h1Match = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  assert.ok(titleMatch, 'live route lacks <title>');
  assert.ok(h1Match, 'live route lacks <h1>');
  const title = stripTags(titleMatch[1]);
  const h1 = stripTags(h1Match[1]);
  assert.ok(title.includes('Диотрефы нашего времени'), `unexpected title: ${title}`);
  assert.equal(h1, 'Диотрефы нашего времени', `unexpected H1: ${h1}`);

  const body = findTag(html, 'body');
  assert.ok(body, 'live route lacks <body>');
  assert.equal(body.attributes.get('data-wave12-publication'), 'true', 'publication marker mismatch');

  const authority = findTag(html, '[a-z][\\w:-]*', (attributes) => attributes.has('data-source-authority'));
  assert.ok(authority, 'source authority marker is missing');
  assert.equal(authority.attributes.get('data-source-authority'), '148', 'source authority marker mismatch');

  const canonical = findTag(html, 'link', (attributes) => attributes.get('rel')?.split(/\s+/).includes('canonical'));
  assert.ok(canonical, 'canonical link is missing');
  const canonicalUrl = new URL(canonical.attributes.get('href'), 'https://gospod-bog.ru');
  assert.equal(canonicalUrl.pathname, route, 'canonical route mismatch');

  const robots = findTag(html, 'meta', (attributes) => attributes.get('name')?.toLowerCase() === 'robots');
  assert.ok(robots, 'robots meta is missing');
  assert.match(robots.attributes.get('content') || '', /(?:^|,)\s*index(?:\s*,|$)/i, 'route is not indexable');

  assert.doesNotMatch(html, /PUBLICATION_HOLD|ещё не зарегистрирован как публичный маршрут/i, 'draft/hold text leaked to live route');
  assert.match(html, /\bid=(?:"|')faithful-witness-under-pressure(?:"|')/i, 'faithful witness section is missing');
  assert.match(html, /\bid=(?:"|')twenty-faithful-responses(?:"|')/i, 'twenty responses section is missing');

  const baseLinks = externalLinks(extractElementById(html, 'sources'));
  const supplementLinks = externalLinks(extractElementById(html, 'faithful-witness-sources'));
  const allLinks = [...baseLinks, ...supplementLinks];
  assert.equal(baseLinks.length, 40, `base source occurrence count mismatch: ${baseLinks.length}`);
  assert.equal(supplementLinks.length, 33, `supplement source occurrence count mismatch: ${supplementLinks.length}`);
  assert.equal(allLinks.length, 73, `source occurrence total mismatch: ${allLinks.length}`);
  assert.equal(new Set(allLinks).size, 70, `unique source count mismatch: ${new Set(allLinks).size}`);

  return {
    title,
    h1,
    publicationMarker: body.attributes.get('data-wave12-publication'),
    sourceAuthority: authority.attributes.get('data-source-authority'),
    canonical: canonicalUrl.href,
    robots: robots.attributes.get('content'),
    sourceLinks: {
      base: baseLinks.length,
      supplement: supplementLinks.length,
      total: allLinks.length,
      unique: new Set(allLinks).size,
    },
    faithfulSections: true,
    draftLeak: false,
  };
}

export async function verifyDiotrophesLiveRelease(options = {}) {
  const witnessDirectory = path.resolve(options.witnessDirectory || process.env.WITNESS_DIRECTORY || '');
  assert.notEqual(witnessDirectory, path.resolve(''), 'WITNESS_DIRECTORY is required');
  const liveBaseUrl = normalize(options.liveBaseUrl || process.env.LIVE_BASE_URL || 'https://gospod-bog.ru').replace(/\/+$/, '');
  const route = normalize(options.route || process.env.DIOTROPHES_LIVE_ROUTE || DEFAULT_ROUTE);
  const timeoutMs = Number.parseInt(String(options.timeoutMs || process.env.DIOTROPHES_LIVE_REQUEST_TIMEOUT_MS || '30000'), 10);
  const reportPath = path.resolve(options.reportPath || process.env.DIOTROPHES_LIVE_REPORT_PATH || path.join(process.cwd(), 'reports', 'diotrophes-live-release-contract.json'));
  assert.ok(route.startsWith('/') && route.endsWith('/'), 'route must be an absolute trailing-slash path');
  assert.ok(Number.isSafeInteger(timeoutMs) && timeoutMs > 0, 'request timeout must be positive');

  const generic = readGenericReport(witnessDirectory);
  const expected = expectedFromGeneric(generic);
  if (process.env.EXPECTED_DEPLOY_RUN_ID) assert.equal(expected.runId, Number(process.env.EXPECTED_DEPLOY_RUN_ID), 'deploy run ID differs from workflow target');
  if (process.env.EXPECTED_CONTROL_PLANE_SHA) assert.equal(expected.controlPlaneSha, normalize(process.env.EXPECTED_CONTROL_PLANE_SHA).toLowerCase(), 'control-plane SHA differs from workflow target');

  const report = {
    schemaVersion: 1,
    kind: 'diotrophes-live-release-extension',
    liveBaseUrl,
    repository: expected.repository,
    releaseSha: expected.releaseSha,
    controlPlaneSha: expected.controlPlaneSha,
    workflowRunId: expected.runId,
    workflowRunAttempt: expected.runAttempt,
    candidateId: expected.candidateId,
    candidateDigest: expected.candidateDigest,
    route,
    startedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const writeReport = () => fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  try {
    const token = `${expected.releaseSha.slice(0, 12)}-${expected.runId}-${Date.now()}`;
    const pointerBeforeResponse = await fetchResponse(liveBaseUrl, '/deployments/current.json', 'pointer-before', timeoutMs, `${token}-before`);
    const pointerBefore = parseJson(pointerBeforeResponse, 'pointer-before');
    assertPointer(pointerBefore, expected, 'pointer-before');

    const routeResponse = await fetchResponse(liveBaseUrl, route, 'diotrophes-route', timeoutMs, `${token}-route`);
    assert.match(routeResponse.contentType, /text\/html/i, `unexpected route content type: ${routeResponse.contentType}`);
    const html = routeResponse.buffer.toString('utf8');
    const content = inspectHtml(html, route);

    const pointerAfterResponse = await fetchResponse(liveBaseUrl, '/deployments/current.json', 'pointer-after', timeoutMs, `${token}-after`);
    const pointerAfter = parseJson(pointerAfterResponse, 'pointer-after');
    assertPointer(pointerAfter, expected, 'pointer-after');
    assert.deepEqual(
      {
        releaseSha: pointerAfter.releaseSha,
        controlPlaneSha: pointerAfter.controlPlaneSha,
        immutablePath: pointerAfter.immutablePath,
        candidateId: pointerAfter.artifact?.candidateId,
        candidateDigest: pointerAfter.artifact?.digest,
      },
      {
        releaseSha: pointerBefore.releaseSha,
        controlPlaneSha: pointerBefore.controlPlaneSha,
        immutablePath: pointerBefore.immutablePath,
        candidateId: pointerBefore.artifact?.candidateId,
        candidateDigest: pointerBefore.artifact?.digest,
      },
      'deployment pointer changed while route evidence was collected',
    );

    report.result = 'PASS';
    report.evidence = {
      pointer: {
        path: '/deployments/current.json',
        immutablePath: pointerBefore.immutablePath,
        releaseSha: pointerBefore.releaseSha,
        controlPlaneSha: pointerBefore.controlPlaneSha,
        workflowRunId: pointerBefore.workflow?.runId,
        workflowRunAttempt: pointerBefore.workflow?.runAttempt,
        candidateId: pointerBefore.artifact?.candidateId,
        candidateDigest: pointerBefore.artifact?.digest,
        stableAcrossRouteRead: true,
      },
      route: {
        url: routeResponse.url,
        status: routeResponse.status,
        contentType: routeResponse.contentType,
        bytes: routeResponse.buffer.length,
        sha256: sha256(routeResponse.buffer),
        ...content,
      },
    };
    report.finishedAt = new Date().toISOString();
    writeReport();
    return report;
  } catch (error) {
    report.result = 'FAIL';
    report.error = String(error?.stack || error);
    report.finishedAt = new Date().toISOString();
    writeReport();
    throw error;
  }
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  verifyDiotrophesLiveRelease()
    .then((report) => {
      console.log(`Diotrophes live release extension: PASS (${report.releaseSha}, ${report.candidateDigest}).`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
