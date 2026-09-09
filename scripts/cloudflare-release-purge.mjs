#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { purgeCloudflareReleaseCache } from './cloudflare-release-purge-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORTS = path.join(ROOT, 'reports');
const REPORT_PATH = path.join(REPORTS, 'cloudflare-release-purge.json');
const apiToken = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
const zoneId = String(process.env.CLOUDFLARE_ZONE_ID || '').trim();
const zoneName = String(process.env.CLOUDFLARE_ZONE_NAME || 'gospod-bog.ru').trim();
const releaseSha = String(process.env.RELEASE_SHA || '').trim().toLowerCase();
const controlPlaneSha = String(process.env.CONTROL_PLANE_SHA || '').trim().toLowerCase();
const workflowRunId = Number(process.env.GITHUB_RUN_ID || 0) || null;
const workflowRunAttempt = Number(process.env.GITHUB_RUN_ATTEMPT || 0) || null;
const timeoutMs = Number.parseInt(process.env.CLOUDFLARE_PURGE_TIMEOUT_MS || '30000', 10);

fs.mkdirSync(REPORTS, { recursive: true });

function redact(value) {
  let text = String(value || '');
  for (const secret of [apiToken, zoneId]) {
    if (secret) text = text.split(secret).join('[REDACTED]');
  }
  return text;
}

const report = {
  provider: 'cloudflare',
  zoneName,
  releaseSha,
  controlPlaneSha,
  workflowRunId,
  workflowRunAttempt,
  startedAt: new Date().toISOString(),
};

try {
  const evidence = await purgeCloudflareReleaseCache({
    apiToken,
    zoneId,
    zoneName,
    signal: AbortSignal.timeout(timeoutMs),
  });
  Object.assign(report, evidence, {
    finishedAt: new Date().toISOString(),
  });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Cloudflare release cache purge: PASS (${evidence.zoneName}).`);
} catch (error) {
  Object.assign(report, {
    result: 'FAIL',
    finishedAt: new Date().toISOString(),
    error: redact(error?.stack || error),
  });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.error(redact(error?.message || error));
  process.exit(1);
}
