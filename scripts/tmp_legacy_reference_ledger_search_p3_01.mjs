#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDITED_COMMIT = '2ec30d22029f2f7e32f13b3d210357554064757f';
const MANIFEST_REL = 'data/legacy-reference-ledger/manifest.json';

if (!process.argv.includes('--write')) {
  throw new Error('explicit --write is required');
}

const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
const writeJson = (relativePath, value) => {
  fs.writeFileSync(path.join(ROOT, relativePath), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const gitBlobSha1 = (bytes) => {
  const header = Buffer.from(`blob ${bytes.length}\0`);
  return crypto.createHash('sha1').update(Buffer.concat([header, bytes])).digest('hex');
};
const decodeEntities = (value) => {
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
};
const metrics = (relativePath) => {
  const bytes = fs.readFileSync(path.join(ROOT, relativePath));
  const raw = bytes.toString('utf8');
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
    h1Count: (raw.match(/<h1\b/gi) || []).length,
    h2Count: (raw.match(/<h2\b/gi) || []).length,
  };
};

const manifest = readJson(MANIFEST_REL);
if (!Array.isArray(manifest.referenceShards) || manifest.referenceShards.length !== 4) {
  throw new Error('expected exactly four legacy reference shards');
}

let updatedEntries = 0;
for (const shardPath of manifest.referenceShards) {
  const shard = readJson(shardPath);
  if (!Array.isArray(shard.entries)) throw new Error(`${shardPath}: entries must be an array`);
  for (const entry of shard.entries) {
    const actual = metrics(entry.legacyPath);
    for (const invariant of ['normalizedTextSha256', 'bytes', 'wordCount', 'h1Count', 'h2Count']) {
      if (entry[invariant] !== actual[invariant]) {
        throw new Error(`${entry.legacyPath}: semantic invariant drifted for ${invariant}`);
      }
    }
    entry.sourceCommit = AUDITED_COMMIT;
    entry.gitBlobSha1 = actual.gitBlobSha1;
    entry.byteSha256 = actual.byteSha256;
    updatedEntries += 1;
  }
  writeJson(shardPath, shard);
}
manifest.auditedAtCommit = AUDITED_COMMIT;
writeJson(MANIFEST_REL, manifest);
console.log(`LEGACY REFERENCE LEDGER RECONCILED: ${updatedEntries} entries at ${AUDITED_COMMIT}`);
