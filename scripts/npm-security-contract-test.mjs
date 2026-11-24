#!/usr/bin/env node
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT = path.join(ROOT, 'scripts/npm-security-contract.mjs');

function makeReport(vulnerabilities) {
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
  for (const entry of Object.values(vulnerabilities)) {
    counts[entry.severity] += 1;
    counts.total += 1;
  }
  return { auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: counts } };
}

function moderateRow(name, url) {
  return {
    name,
    severity: 'moderate',
    isDirect: false,
    range: '1.0.0 - 1.2.3',
    nodes: [`node_modules/${name}`],
    fixAvailable: false,
    via: [{ source: 1234567, title: 'Fixture advisory', severity: 'moderate', range: '1.0.0 - 1.2.3', url }],
  };
}

function disposition(overrides = {}) {
  return {
    package: 'left-pad-fixture',
    advisoryUrl: 'https://github.com/advisories/GHSA-fixture-moderate',
    severity: 'moderate',
    decision: 'accept-risk',
    reason: 'Fixture: dev-only transitive, no runtime surface',
    owner: 'owner',
    decidedAt: '2026-11-01',
    expiresAt: '2027-02-01',
    ...overrides,
  };
}

function run(report, dispositions, env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-security-contract-'));
  const reportPath = path.join(dir, 'audit.json');
  fs.writeFileSync(reportPath, JSON.stringify(makeReport(report)));
  const args = [CONTRACT, reportPath];
  if (dispositions !== null) {
    const dispositionsPath = path.join(dir, 'dispositions.json');
    fs.writeFileSync(dispositionsPath, typeof dispositions === 'string' ? dispositions : JSON.stringify({ schemaVersion: 1, dispositions }));
    args.push(dispositionsPath);
  }
  return cp.spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...process.env, ...env } });
}

// 1. Clean report, no dispositions file → PASS
let result = run({}, null);
assert.equal(result.status, 0, `clean report must pass: ${result.stderr}`);
assert.match(result.stdout, /PASS \(0 moderate\/high\/critical vulnerabilities\)/);

// 2. Undispositioned moderate advisory → FAIL (negative witness)
result = run({ 'left-pad-fixture': moderateRow('left-pad-fixture', 'https://github.com/advisories/GHSA-fixture-moderate') }, []);
assert.equal(result.status, 1, `undispositioned moderate must fail: ${result.stdout}`);
assert.match(result.stderr, /undispositioned moderate\/high\/critical/);

// 3. Valid disposition covers the advisory → PASS
result = run(
  { 'left-pad-fixture': moderateRow('left-pad-fixture', 'https://github.com/advisories/GHSA-fixture-moderate') },
  [disposition()],
  { SECURITY_CONTRACT_TODAY: '2026-11-19' },
);
assert.equal(result.status, 0, `valid disposition must pass: ${result.stderr}`);
assert.match(result.stdout, /covered by valid dispositions/);

// 4. Expired disposition → FAIL, forces owner re-decision (negative witness)
result = run(
  { 'left-pad-fixture': moderateRow('left-pad-fixture', 'https://github.com/advisories/GHSA-fixture-moderate') },
  [disposition()],
  { SECURITY_CONTRACT_TODAY: '2027-03-01' },
);
assert.equal(result.status, 1, `expired disposition must fail: ${result.stdout}`);
assert.match(result.stderr, /disposition expired 2027-02-01/);

// 5. Disposition for a different advisory URL does not cover → FAIL (negative witness)
result = run(
  { 'left-pad-fixture': moderateRow('left-pad-fixture', 'https://github.com/advisories/GHSA-fixture-moderate') },
  [disposition({ advisoryUrl: 'https://github.com/advisories/GHSA-other-advisory' })],
  { SECURITY_CONTRACT_TODAY: '2026-11-19' },
);
assert.equal(result.status, 1, `mismatched advisoryUrl must not cover: ${result.stdout}`);

// 6. Malformed dispositions JSON → usage error exit 2
result = run({}, '{ not json');
assert.equal(result.status, 2, `malformed JSON must exit 2: ${result.stdout}`);

// 7. Disposition missing required field → exit 2
result = run({}, [disposition({ reason: '' })]);
assert.equal(result.status, 2, `empty reason must exit 2: ${result.stdout}`);

// 8. decidedAt after expiresAt → exit 2
result = run({}, [disposition({ decidedAt: '2027-03-01' })]);
assert.equal(result.status, 2, `inverted dates must exit 2: ${result.stdout}`);

// 9. Stale disposition (advisory gone) → PASS with stale warning
result = run({}, [disposition()], { SECURITY_CONTRACT_TODAY: '2026-11-19' });
assert.equal(result.status, 0, `stale disposition alone must pass: ${result.stderr}`);
assert.match(result.stdout, /stale disposition for left-pad-fixture/);

// 10. Invalid SECURITY_CONTRACT_TODAY override → exit 2
result = run({}, null, { SECURITY_CONTRACT_TODAY: '19.11.2026' });
assert.equal(result.status, 2, `invalid date override must exit 2: ${result.stdout}`);

console.log('✅ npm security contract test passed (10 cases, incl. 4 negative witnesses)');
