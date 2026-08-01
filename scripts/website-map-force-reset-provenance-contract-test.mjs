#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const ledgerPath = new URL('../data/website-map-force-reset-provenance.json', import.meta.url);
const reportPath = new URL('../research/A08_WEBSITE_MAP_FORCE_RESET_FORENSICS_2026-08-01.md', import.meta.url);
const SHA = /^[0-9a-f]{40}$/;

function fail(message) { throw new Error(message); }
function validate(record) {
  if (record.schemaVersion !== 1) fail('schemaVersion must be 1');
  if (record.branch !== 'claude/website-map-audit-ik3ypo') fail('unexpected branch');
  if (!['BLOCKED_PROVENANCE', 'RECOVERED_EXACT_HEAD'].includes(record.status)) fail('invalid status');
  if (!SHA.test(record.currentMainAtInvestigation)) fail('invalid investigation main SHA');
  if (record.productionClaim !== false) fail('production claim must be false');

  const reset = record.observations?.postResetRemoteRef;
  if (!reset || !SHA.test(reset.sha)) fail('missing exact post-reset SHA');
  if (!/^[0-9a-f]{64}$/.test(reset.driveEvidence?.evidenceLineSha256 || '')) fail('missing evidence-line digest');
  if (!reset.driveEvidence?.fileId || !reset.driveEvidence?.name) fail('missing Drive chain of custody');

  const candidates = record.candidates || [];
  if (candidates.length < 2) fail('candidate ledger is incomplete');
  if (new Set(candidates.map((item) => item.sha)).size !== candidates.length) fail('duplicate candidate SHA');
  for (const candidate of candidates) {
    if (!SHA.test(candidate.sha)) fail(`invalid candidate SHA: ${candidate.sha}`);
    if (candidate.acceptedAsExact !== false) fail('no candidate may be exact while status is blocked');
    if (!candidate.blockingGap) fail(`candidate ${candidate.sha} lacks blocking gap`);
  }

  if (record.status === 'BLOCKED_PROVENANCE') {
    if (record.exactHead !== null) fail('blocked record must keep exactHead null');
    if (!/direct pre-reset ref|reflog|PR-head|immutable artifact/i.test(record.decision?.promotionRule || '')) {
      fail('promotion rule must require direct immutable provenance');
    }
  } else {
    if (!SHA.test(record.exactHead || '')) fail('recovered record requires exactHead');
    if (!record.observations?.directPreResetRef) fail('recovered record requires directPreResetRef');
  }
}

const record = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
validate(record);

const report = fs.readFileSync(reportPath, 'utf8');
for (const required of ['BLOCKED_PROVENANCE', record.branch, record.observations.postResetRemoteRef.sha, record.candidates[0].sha]) {
  if (!report.includes(required)) fail(`report missing ${required}`);
}

// Negative mutation: candidate ordering alone may never become exact provenance.
const invalid = structuredClone(record);
invalid.status = 'RECOVERED_EXACT_HEAD';
invalid.exactHead = invalid.candidates[0].sha;
let rejected = false;
try { validate(invalid); } catch { rejected = true; }
if (!rejected) fail('negative mutation unexpectedly promoted a candidate');

if (!process.argv.includes('--no-git')) {
  const candidate = record.candidates[0].sha;
  for (const args of [['cat-file', '-e', `${candidate}^{commit}`], ['merge-base', '--is-ancestor', candidate, 'HEAD']]) {
    const result = spawnSync('git', args, { encoding: 'utf8' });
    if (result.status !== 0) fail(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
}

console.log(`WEBSITE MAP FORCE-RESET PROVENANCE: PASS (${record.status}; ${record.candidates.length} candidates; exactHead=null)`);
