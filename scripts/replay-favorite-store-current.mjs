#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORE_REL = 'src/runtime/favorite-store.js';
const CONTROLLER_REL = 'js/floating-cluster-controller.js';
const MANIFEST_REL = 'data/legacy-reference-ledger/manifest.json';
const CACHE_BUST_REL = 'scripts/cache-bust.js';
const OLD_IMAGE = "image: normalizeImage(canonical?.image || value.image || ''),";
const NEW_IMAGE = "image: normalizeImage(value.image || ''),";
const SET_SAVED_EXPORT = 'setSaved: setSaved,';
const SET_SAVED_FUNCTION = 'function setSaved(saved)';
const PLAY_MARKER = '  /* =====================================================\n     PLAY EMBER\n     Управляет data-state и --p переменной.';
const ADAPTER = `  // Backward-compatible public facade. Persistence, metadata and events\n  // remain exclusively owned by GBFavoriteStore; this adapter only maps\n  // the historical Boolean API to canonical mutations.\n  function setSaved(saved) {\n    var store = favoriteStore();\n    if (!store) return null;\n    var path = location.pathname;\n    var options = { source: 'floating-cluster-api' };\n    var result = saved\n      ? (typeof store.add === 'function' ? store.add({ path: path }, options) : null)\n      : (typeof store.remove === 'function' ? store.remove(path, options) : null);\n    if (typeof store.syncButtons === 'function') store.syncButtons();\n    return result;\n  }\n\n`;

function full(relativePath) {
  return path.join(ROOT, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(full(relativePath), 'utf8');
}

function write(relativePath, value) {
  fs.writeFileSync(full(relativePath), value);
}

function count(source, needle) {
  return source.split(needle).length - 1;
}

function patch() {
  const store = read(STORE_REL);
  assert.equal(count(store, OLD_IMAGE), 1, `expected exactly one stale image migration expression in ${STORE_REL}`);
  assert.equal(count(store, NEW_IMAGE), 0, `repaired image migration expression already exists in ${STORE_REL}`);
  write(STORE_REL, store.replace(OLD_IMAGE, NEW_IMAGE));

  const controller = read(CONTROLLER_REL);
  assert.equal(count(controller, SET_SAVED_EXPORT), 2, `expected exactly two historical setSaved exports in ${CONTROLLER_REL}`);
  assert.equal(count(controller, SET_SAVED_FUNCTION), 0, `setSaved adapter already exists in ${CONTROLLER_REL}`);
  assert.equal(count(controller, PLAY_MARKER), 1, `PLAY marker is not unique in ${CONTROLLER_REL}`);
  write(CONTROLLER_REL, controller.replace(PLAY_MARKER, `${ADAPTER}${PLAY_MARKER}`));

  check();
  console.log('Favorite Store bounded runtime repair applied.');
}

function revisions() {
  execFileSync(process.execPath, [full(CACHE_BUST_REL), '--write'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  console.log('Canonical asset revision writer completed.');
}

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
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (all, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const raw = entity.slice(hex ? 2 : 1);
      const code = Number.parseInt(raw, hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : all;
    }
    return named.get(entity.toLowerCase()) ?? all;
  });
}

function htmlMetrics(raw, bytes) {
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
}

function writeJson(relativePath, payload) {
  write(relativePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function ledger(snapshotSha) {
  assert.match(snapshotSha || '', /^[0-9a-f]{40}$/, 'ledger snapshot tree SHA must be exact');
  const manifest = JSON.parse(read(MANIFEST_REL));
  assert.equal(manifest.schemaVersion, '1.0.0');
  assert.equal(manifest.scope, 'inventory-and-immutability-only');
  assert.ok(Array.isArray(manifest.referenceShards));
  assert.equal(manifest.referenceShards.length, 4);

  let entries = 0;
  for (const shardRel of manifest.referenceShards) {
    const shard = JSON.parse(read(shardRel));
    assert.equal(shard.schemaVersion, '1.0.0');
    assert.ok(Array.isArray(shard.entries));
    for (const entry of shard.entries) {
      assert.equal(typeof entry.legacyPath, 'string');
      const bytes = fs.readFileSync(full(entry.legacyPath));
      const metrics = htmlMetrics(bytes.toString('utf8'), bytes);
      entry.sourceCommit = snapshotSha;
      Object.assign(entry, metrics);
      entries += 1;
    }
    writeJson(shardRel, shard);
  }

  assert.equal(entries, manifest.summary.references, 'ledger reference count must remain unchanged');
  manifest.auditedAtCommit = snapshotSha;
  writeJson(MANIFEST_REL, manifest);
  console.log(`Legacy ledger synchronized for ${entries} immutable references at tree ${snapshotSha}.`);
}

function check() {
  const store = read(STORE_REL);
  const controller = read(CONTROLLER_REL);
  assert.equal(count(store, OLD_IMAGE), 0, 'stale canonical-image migration fallback survived');
  assert.equal(count(store, NEW_IMAGE), 1, 'bounded legacy-image normalization is not exact');
  assert.equal(count(controller, SET_SAVED_FUNCTION), 1, 'setSaved adapter must exist exactly once');
  assert.equal(count(controller, SET_SAVED_EXPORT), 2, 'historical setSaved exports must remain exact');
  assert.match(controller, /store\.add\(\{ path: path \}, options\)/, 'setSaved true path must delegate to canonical add');
  assert.match(controller, /store\.remove\(path, options\)/, 'setSaved false path must delegate to canonical remove');
  assert.match(store, /if \(!\/\^https\?\:\$\/\.test\(url\.protocol\)\) return '';/, 'image protocol guard must remain fail-closed');
  assert.match(store, /url\.origin !== location\.origin/, 'same-origin path guard must remain present');
  console.log('Favorite Store bounded runtime repair verified.');
}

const [mode, argument] = process.argv.slice(2);
if (mode === '--write') {
  patch();
  revisions();
} else if (mode === 'patch') patch();
else if (mode === 'revisions') revisions();
else if (mode === 'ledger') ledger(argument);
else if (mode === 'check') check();
else throw new Error('Usage: replay-favorite-store-current.mjs <--write|patch|revisions|ledger SNAPSHOT_TREE_SHA|check>');
