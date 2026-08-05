#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PAYLOAD_DIR = path.join(ROOT, 'scripts/.legacy-reference-payload');
const ARCHIVE_SHA256 = '072ea567780c0bb6ae86e2227dbba1adf6d37d201178617b9a11d8c066d5f312';
const EXPECTED = new Set([
  'data/legacy-reference-ledger/manifest.json',
  'data/legacy-reference-ledger/references-1.json',
  'data/legacy-reference-ledger/references-2.json',
  'data/legacy-reference-ledger/references-3.json',
  'data/legacy-reference-ledger/references-4.json',
  'scripts/legacy-reference-inventory-audit.mjs',
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function gitBlobSha1(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`);
  return crypto.createHash('sha1').update(Buffer.concat([header, bytes])).digest('hex');
}

function decodeEntities(value) {
  const named = new Map([
    ['amp', '&'], ['lt', '<'], ['gt', '>'], ['quot', '"'], ['apos', "'"], ['nbsp', ' '],
    ['laquo', '«'], ['raquo', '»'], ['ndash', '–'], ['mdash', '—'], ['hellip', '…'],
  ]);
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (full, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const raw = entity.slice(hex ? 2 : 1);
      const code = Number.parseInt(raw, hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    return named.get(entity.toLowerCase()) ?? full;
  });
}

function htmlMetrics(raw, bytes) {
  const h1Count = (raw.match(/<h1\b/gi) || []).length;
  const h2Count = (raw.match(/<h2\b/gi) || []).length;
  const normalizedText = decodeEntities(
    raw
      .replace(/<!--[^]*?-->/g, ' ')
      .replace(/<script\b[^>]*>[^]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[^]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ').trim();
  const words = normalizedText.match(/[0-9A-Za-zА-Яа-яЁё]+(?:[-'’][0-9A-Za-zА-Яа-яЁё]+)*/g) || [];
  return {
    gitBlobSha1: gitBlobSha1(bytes),
    byteSha256: sha256(bytes),
    normalizedTextSha256: sha256(Buffer.from(normalizedText)),
    bytes: bytes.length,
    wordCount: words.length,
    h1Count,
    h2Count,
  };
}

const parts = fs.readdirSync(PAYLOAD_DIR).sort();
const encoded = parts.map((name) => fs.readFileSync(path.join(PAYLOAD_DIR, name), 'utf8')).join('');
const archive = Buffer.from(encoded, 'base64');
const digest = sha256(archive);
if (digest !== ARCHIVE_SHA256) throw new Error(`payload digest mismatch: ${digest}`);

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
  for (const entry of payload.entries) {
    const fullPath = path.join(ROOT, entry.legacyPath);
    const bytes = fs.readFileSync(fullPath);
    const raw = bytes.toString('utf8');
    Object.assign(entry, { sourceCommit: mainSha, ...htmlMetrics(raw, bytes) });
  }
  fs.writeFileSync(shardPath, `${JSON.stringify(payload, null, 2)}\n`);
}

fs.rmSync(archivePath, { force: true });
fs.rmSync(PAYLOAD_DIR, { recursive: true, force: true });

execFileSync(process.execPath, ['scripts/legacy-reference-inventory-audit.mjs'], { cwd: ROOT, stdio: 'inherit' });
execFileSync('npm', ['run', 'workflows:check'], { cwd: ROOT, stdio: 'inherit' });
execFileSync('npm', ['run', 'control-plane:audit'], { cwd: ROOT, stdio: 'inherit' });

execFileSync('git', ['checkout', 'origin/main', '--', 'scripts/article-headline-contract.js', '.github/workflows/shared-files-guard.yml'], { cwd: ROOT, stdio: 'inherit' });

const changed = execFileSync('git', ['diff', '--name-only'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const unexpected = changed.filter((name) => !EXPECTED.has(name) && !name.startsWith('scripts/.legacy-reference-payload/'));
if (unexpected.length) throw new Error(`unexpected materialized paths: ${unexpected.join(', ')}`);
for (const name of EXPECTED) if (!changed.includes(name)) throw new Error(`missing materialized owner: ${name}`);
console.log(`Legacy reference ledger regenerated from exact main ${mainSha} and validated; workflow/helper restored.`);
