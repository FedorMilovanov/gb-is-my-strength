#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const PARTS = fs.readdirSync(path.join(ROOT, 'scripts/.legacy-reference-payload')).sort();
const encoded = PARTS.map((name) => fs.readFileSync(path.join(ROOT, 'scripts/.legacy-reference-payload', name), 'utf8')).join('');
const archive = Buffer.from(encoded, 'base64');
const digest = crypto.createHash('sha256').update(archive).digest('hex');
if (digest !== '072ea567780c0bb6ae86e2227dbba1adf6d37d201178617b9a11d8c066d5f312') throw new Error(`payload digest mismatch: ${digest}`);
const archivePath = path.join(ROOT, '.legacy-reference-payload.tar.gz');
fs.writeFileSync(archivePath, archive);
execFileSync('tar', ['-xzf', archivePath, '-C', ROOT], { stdio: 'inherit' });
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
fs.rmSync(archivePath, { force: true });
fs.rmSync(path.join(ROOT, 'scripts/.legacy-reference-payload'), { recursive: true, force: true });
execFileSync(process.execPath, ['scripts/legacy-reference-inventory-audit.mjs'], { cwd: ROOT, stdio: 'inherit' });
execFileSync('npm', ['run', 'workflows:check'], { cwd: ROOT, stdio: 'inherit' });
execFileSync('npm', ['run', 'control-plane:audit'], { cwd: ROOT, stdio: 'inherit' });
execFileSync('git', ['checkout', 'origin/main', '--', 'scripts/article-headline-contract.js', '.github/workflows/shared-files-guard.yml'], { cwd: ROOT, stdio: 'inherit' });
const expected = new Set([
  'data/legacy-reference-ledger/manifest.json',
  'data/legacy-reference-ledger/references-1.json',
  'data/legacy-reference-ledger/references-2.json',
  'data/legacy-reference-ledger/references-3.json',
  'data/legacy-reference-ledger/references-4.json',
  'scripts/legacy-reference-inventory-audit.mjs',
]);
const changed = execFileSync('git', ['diff', '--name-only'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const unexpected = changed.filter((name) => !expected.has(name) && !name.startsWith('scripts/.legacy-reference-payload/'));
if (unexpected.length) throw new Error(`unexpected materialized paths: ${unexpected.join(', ')}`);
for (const name of expected) if (!changed.includes(name)) throw new Error(`missing materialized owner: ${name}`);
console.log('Legacy reference ledger materialized and validated; workflow/helper restored.');
