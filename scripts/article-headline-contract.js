#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const EXPECTED = new Set([
  'data/legacy-reference-ledger/manifest.json',
  'data/legacy-reference-ledger/references-1.json',
  'data/legacy-reference-ledger/references-2.json',
  'data/legacy-reference-ledger/references-3.json',
  'data/legacy-reference-ledger/references-4.json',
  'scripts/legacy-reference-inventory-audit.mjs',
]);

const mainSha = execFileSync('git', ['rev-parse', 'origin/main'], { cwd: ROOT, encoding: 'utf8' }).trim();
const manifestPath = path.join(ROOT, 'data/legacy-reference-ledger/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.auditedAtCommit = mainSha;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

for (const shard of manifest.referenceShards) {
  const shardPath = path.join(ROOT, shard);
  const payload = JSON.parse(fs.readFileSync(shardPath, 'utf8'));
  for (const entry of payload.entries) entry.sourceCommit = mainSha;
  fs.writeFileSync(shardPath, `${JSON.stringify(payload, null, 2)}\n`);
}

execFileSync('git', ['checkout', 'origin/main', '--', 'scripts/article-headline-contract.js'], { cwd: ROOT, stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/legacy-reference-inventory-audit.mjs'], { cwd: ROOT, stdio: 'inherit' });
execFileSync('npm', ['run', 'workflows:check'], { cwd: ROOT, stdio: 'inherit' });
execFileSync('npm', ['run', 'control-plane:audit'], { cwd: ROOT, stdio: 'inherit' });
execFileSync('git', ['checkout', 'origin/main', '--', '.github/workflows/shared-files-guard.yml'], { cwd: ROOT, stdio: 'inherit' });

const changed = execFileSync('git', ['diff', '--name-only'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const unexpected = changed.filter((name) => !EXPECTED.has(name));
if (unexpected.length) throw new Error(`unexpected provenance paths: ${unexpected.join(', ')}`);
for (const name of EXPECTED) if (!changed.includes(name)) throw new Error(`missing provenance owner: ${name}`);
console.log(`Legacy reference provenance rebound to exact main ${mainSha}; permanent contracts passed.`);
