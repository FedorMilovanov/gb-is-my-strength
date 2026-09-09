#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ensureNosniffResponseHeader,
  verifyLiveNosniff,
} from './cloudflare-response-header-owner-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORTS = path.join(ROOT, 'reports');
const REPORT_PATH = path.join(REPORTS, 'cloudflare-response-header-owner.json');
const apiToken = String(process.env.CLOUDFLARE_TRANSFORM_API_TOKEN || '').trim();
const zoneId = String(process.env.CLOUDFLARE_ZONE_ID || '').trim();
const zoneName = String(process.env.CLOUDFLARE_ZONE_NAME || 'gospod-bog.ru').trim().toLowerCase();
const sourceSha = String(process.env.SOURCE_SHA || process.env.GITHUB_SHA || '').trim().toLowerCase();
const workflowRunId = Number(process.env.GITHUB_RUN_ID || 0) || null;
const workflowRunAttempt = Number(process.env.GITHUB_RUN_ATTEMPT || 0) || null;
const apiTimeoutMs = Number.parseInt(process.env.CLOUDFLARE_TRANSFORM_TIMEOUT_MS || '30000', 10);
const liveTimeoutMs = Number.parseInt(process.env.CLOUDFLARE_LIVE_WITNESS_TIMEOUT_MS || '90000', 10);

fs.mkdirSync(REPORTS, { recursive: true });

function redact(value) {
  let text = String(value || '');
  for (const secret of [apiToken, zoneId]) {
    if (secret) text = text.split(secret).join('[REDACTED]');
  }
  return text;
}

function sanitizedEvidence(error) {
  if (!Array.isArray(error?.evidence)) return undefined;
  return error.evidence.map((entry) => ({
    path: entry.path,
    status: entry.status,
    header: entry.header,
    passed: entry.passed,
    ...(entry.error ? { error: redact(entry.error) } : {}),
  }));
}

const report = {
  provider: 'cloudflare',
  owner: 'x-content-type-options-nosniff',
  zoneName,
  sourceSha,
  workflowRunId,
  workflowRunAttempt,
  startedAt: new Date().toISOString(),
};

try {
  const mutation = await ensureNosniffResponseHeader({
    apiToken,
    zoneId,
    zoneName,
    signal: AbortSignal.timeout(apiTimeoutMs),
  });
  const live = await verifyLiveNosniff({
    zoneName,
    signal: AbortSignal.timeout(liveTimeoutMs),
  });

  Object.assign(report, {
    result: 'PASS',
    mutation: {
      phase: mutation.phase,
      ruleRef: mutation.ruleRef,
      operation: mutation.operation,
    },
    live,
    finishedAt: new Date().toISOString(),
  });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Cloudflare nosniff transport owner: PASS (${mutation.operation}; ${live.evidence.length} live routes).`);
} catch (error) {
  Object.assign(report, {
    result: 'FAIL',
    finishedAt: new Date().toISOString(),
    error: redact(error?.stack || error),
    ...(sanitizedEvidence(error) ? { liveEvidence: sanitizedEvidence(error) } : {}),
  });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.error(redact(error?.message || error));
  process.exit(1);
}
