#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  fetchExactFontSource,
  generateFontAssets,
  sha256,
  validateManifestObject,
  validateWoff2Buffer,
  verifyFontAssets,
} from './font-assets-lib.mjs';

function makeWoff2(seed = 0, length = 96) {
  const bytes = Buffer.alloc(length, seed & 0xff);
  bytes.write('wOF2', 0, 'ascii');
  bytes.writeUInt32BE(0x00010000, 4);
  bytes.writeUInt32BE(length, 8);
  bytes.writeUInt16BE(1, 12);
  bytes.writeUInt16BE(0, 14);
  bytes.writeUInt32BE(128, 16);
  bytes.writeUInt32BE(Math.max(1, length - 48), 20);
  bytes.writeUInt16BE(1, 24);
  bytes.writeUInt16BE(0, 26);
  bytes.writeUInt32BE(0, 28);
  bytes.writeUInt32BE(0, 32);
  bytes.writeUInt32BE(0, 36);
  bytes.writeUInt32BE(0, 40);
  bytes.writeUInt32BE(0, 44);
  return bytes;
}

function assetRecord(relativePath, bytes, overrides = {}) {
  const digest = sha256(bytes);
  return {
    path: relativePath,
    family: 'Fixture Serif',
    weight: 400,
    style: 'normal',
    subset: 'latin',
    bytes: bytes.length,
    sha256: digest,
    source: {
      cssUrl: 'https://fonts.googleapis.com/css2?family=Fixture%20Serif:ital,wght@0,400&display=swap',
      url: `https://fonts.gstatic.com/${path.basename(relativePath)}`,
      contentType: 'font/woff2',
      observedBytes: bytes.length,
      observedSha256: digest,
      trackedMatch: true,
      status: 'verified-match',
    },
    ...overrides,
  };
}

function manifestFor(assets) {
  return {
    schemaVersion: 1,
    policy: {
      production: 'offline-pinned',
      generator: 'exact-source-url-all-or-nothing',
      upstreamRefreshRequires: '--accept-upstream',
    },
    assets: [...assets].sort((a, b) => a.path.localeCompare(b.path)),
  };
}

function writeFixture(root, assets, manifest = manifestFor(assets.map(([fontPath, bytes]) => assetRecord(fontPath, bytes)))) {
  fs.mkdirSync(path.join(root, 'fonts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'css'), { recursive: true });
  for (const [fontPath, bytes] of assets) {
    const absolute = path.join(root, fontPath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, bytes);
  }
  fs.writeFileSync(path.join(root, 'fonts', 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const faces = manifest.assets.map((asset) => `@font-face{font-family:'${asset.family}';font-style:${asset.style};font-weight:${asset.weight};src:url('/${asset.path}') format('woff2');}`).join('\n');
  fs.writeFileSync(path.join(root, 'css', 'fonts.css'), `${faces}\n`);
  return manifest;
}

async function withFixture(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-font-contract-'));
  try {
    return await callback(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function response(body, status = 200, headers = { 'content-type': 'font/woff2' }) {
  return new Response(body, { status, headers });
}

const checks = [];
const check = (name, fn) => checks.push([name, fn]);

check('valid pinned local set passes offline verification', async () => withFixture(async (root) => {
  const bytes = makeWoff2(1);
  const manifest = writeFixture(root, [['fonts/Fixture/fixture-latin-400.woff2', bytes]]);
  assert.equal(verifyFontAssets({ root, manifest }).result, 'PASS');
}));

check('missing manifest font fails', async () => withFixture(async (root) => {
  const bytes = makeWoff2(2);
  const manifest = writeFixture(root, [['fonts/Fixture/fixture-latin-400.woff2', bytes]]);
  fs.rmSync(path.join(root, manifest.assets[0].path));
  assert.throws(() => verifyFontAssets({ root, manifest }), /manifest files missing/);
}));

check('undeclared font fails', async () => withFixture(async (root) => {
  const bytes = makeWoff2(3);
  const manifest = writeFixture(root, [['fonts/Fixture/fixture-latin-400.woff2', bytes]]);
  fs.writeFileSync(path.join(root, 'fonts', 'Fixture', 'rogue.woff2'), makeWoff2(4));
  assert.throws(() => verifyFontAssets({ root, manifest }), /undeclared files/);
}));

check('HTML body named woff2 fails magic', async () => {
  assert.throws(() => validateWoff2Buffer(Buffer.from('<!doctype html><title>error</title>'.repeat(40)), 'html-error.woff2'), /wOF2 magic/);
});

check('truncated WOFF2 fails declared length', async () => {
  const bytes = makeWoff2(5);
  assert.throws(() => validateWoff2Buffer(bytes.subarray(0, bytes.length - 1), 'truncated.woff2'), /declared length mismatch/);
});

check('stale tracked hash fails', async () => withFixture(async (root) => {
  const bytes = makeWoff2(6);
  const manifest = writeFixture(root, [['fonts/Fixture/fixture-latin-400.woff2', bytes]]);
  manifest.assets[0].sha256 = '0'.repeat(64);
  manifest.assets[0].source.trackedMatch = false;
  manifest.assets[0].source.status = 'upstream-drift';
  assert.throws(() => verifyFontAssets({ root, manifest }), /SHA-256 mismatch/);
}));

check('symbolic font link fails', async () => withFixture(async (root) => {
  if (process.platform === 'win32') return;
  const bytes = makeWoff2(7);
  const manifest = writeFixture(root, [['fonts/Fixture/fixture-latin-400.woff2', bytes]]);
  fs.symlinkSync('fixture-latin-400.woff2', path.join(root, 'fonts', 'Fixture', 'linked.woff2'));
  assert.throws(() => verifyFontAssets({ root, manifest }), /symbolic link is forbidden/);
}));

check('unknown source reference fails', async () => withFixture(async (root) => {
  const bytes = makeWoff2(8);
  const manifest = writeFixture(root, [['fonts/Fixture/fixture-latin-400.woff2', bytes]]);
  fs.appendFileSync(path.join(root, 'css', 'fonts.css'), "x{src:url('/fonts/Fixture/unknown.woff2')}\n");
  assert.throws(() => verifyFontAssets({ root, manifest }), /references are not declared/);
}));

check('font-face family metadata drift fails', async () => withFixture(async (root) => {
  const bytes = makeWoff2(9);
  const manifest = writeFixture(root, [['fonts/Fixture/fixture-latin-400.woff2', bytes]]);
  fs.writeFileSync(path.join(root, 'css', 'fonts.css'), "@font-face{font-family:'Wrong Family';font-style:normal;font-weight:400;src:url('/fonts/Fixture/fixture-latin-400.woff2') format('woff2');}\n");
  assert.throws(() => verifyFontAssets({ root, manifest }), /metadata does not match manifest/);
}));

check('manifest source status must reflect observed bytes', async () => {
  const bytes = makeWoff2(10);
  const manifest = manifestFor([assetRecord('fonts/Fixture/fixture-latin-400.woff2', bytes)]);
  manifest.assets[0].source.observedSha256 = 'f'.repeat(64);
  assert.throws(() => validateManifestObject(manifest), /trackedMatch does not reflect/);
});

check('exact font fetch accepts valid WOFF2', async () => {
  const bytes = makeWoff2(11);
  const fetched = await fetchExactFontSource('https://fonts.gstatic.com/fixture.woff2', { fetchImpl: async () => response(bytes) });
  assert.equal(fetched.sha256, sha256(bytes));
});

check('HTTP 404 fails', async () => {
  await assert.rejects(fetchExactFontSource('https://fonts.gstatic.com/fixture.woff2', { fetchImpl: async () => response('error', 404, { 'content-type': 'text/plain' }) }), /font source HTTP 404/);
});

check('HTTP 500 fails', async () => {
  await assert.rejects(fetchExactFontSource('https://fonts.gstatic.com/fixture.woff2', { fetchImpl: async () => response('error', 500, { 'content-type': 'text/plain' }) }), /font source HTTP 500/);
});

check('HTML 200 content type fails', async () => {
  await assert.rejects(fetchExactFontSource('https://fonts.gstatic.com/fixture.woff2', { fetchImpl: async () => response('<html>error</html>', 200, { 'content-type': 'text/html' }) }), /content-type is forbidden/);
});

check('HTML 200 disguised as font fails magic', async () => {
  await assert.rejects(fetchExactFontSource('https://fonts.gstatic.com/fixture.woff2', { fetchImpl: async () => response(Buffer.from('<html>error</html>'.repeat(100))) }), /wOF2 magic/);
});

check('redirect to plain HTTP fails', async () => {
  const fakeFetch = async () => response(null, 302, { location: 'http://fonts.gstatic.com/fixture.woff2' });
  await assert.rejects(fetchExactFontSource('https://fonts.gstatic.com/start.woff2', { fetchImpl: fakeFetch }), /must use HTTPS/);
});

check('redirect to private host fails', async () => {
  const fakeFetch = async () => response(null, 302, { location: 'https://127.0.0.1/fixture.woff2' });
  await assert.rejects(fetchExactFontSource('https://fonts.gstatic.com/start.woff2', { fetchImpl: fakeFetch }), /host is forbidden/);
});

check('redirect loop fails closed', async () => {
  const fakeFetch = async (url) => response(null, 302, { location: new URL('/loop.woff2', url).href });
  await assert.rejects(fetchExactFontSource('https://fonts.gstatic.com/start.woff2', { fetchImpl: fakeFetch, maxRedirects: 2 }), /exceeded 2 redirects/);
});

check('upstream drift leaves tracked directory untouched', async () => withFixture(async (root) => {
  const original = makeWoff2(12);
  const changed = makeWoff2(13);
  const fontPath = 'fonts/Fixture/fixture-latin-400.woff2';
  const manifest = writeFixture(root, [[fontPath, original]]);
  await assert.rejects(generateFontAssets({ root, manifest, write: true, fetchImpl: async () => response(changed) }), /upstream drift/);
  assert.deepEqual(fs.readFileSync(path.join(root, fontPath)), original);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'fonts', 'manifest.json'), 'utf8')).assets[0].sha256, sha256(original));
}));

check('one unavailable source aborts the whole generation', async () => withFixture(async (root) => {
  const first = makeWoff2(14);
  const second = makeWoff2(15);
  const assets = [
    ['fonts/A/a-latin-400.woff2', first],
    ['fonts/B/b-latin-400.woff2', second],
  ];
  const manifest = writeFixture(root, assets);
  const fakeFetch = async (url) => String(url).includes('/a-latin') ? response(first) : response('missing', 404, { 'content-type': 'text/plain' });
  await assert.rejects(generateFontAssets({ root, manifest, write: true, fetchImpl: fakeFetch }), /font source HTTP 404/);
  assert.deepEqual(fs.readFileSync(path.join(root, assets[0][0])), first);
  assert.deepEqual(fs.readFileSync(path.join(root, assets[1][0])), second);
}));

check('explicit accepted upstream refresh updates staged manifest only', async () => withFixture(async (root) => {
  const original = makeWoff2(16);
  const changed = makeWoff2(17);
  const fontPath = 'fonts/Fixture/fixture-latin-400.woff2';
  const manifest = writeFixture(root, [[fontPath, original]]);
  const result = await generateFontAssets({ root, manifest, acceptUpstream: true, write: false, fetchImpl: async () => response(changed) });
  assert.equal(result.result, 'DRY_RUN_PASS');
  assert.equal(result.manifest.assets[0].sha256, sha256(changed));
  assert.deepEqual(fs.readFileSync(path.join(root, fontPath)), original);
}));

check('matching exact source performs transactional directory swap', async () => withFixture(async (root) => {
  const bytes = makeWoff2(18);
  const fontPath = 'fonts/Fixture/fixture-latin-400.woff2';
  const manifest = writeFixture(root, [[fontPath, bytes]]);
  const result = await generateFontAssets({ root, manifest, write: true, fetchImpl: async () => response(bytes) });
  assert.equal(result.result, 'WRITE_PASS');
  assert.deepEqual(fs.readFileSync(path.join(root, fontPath)), bytes);
  assert.equal(verifyFontAssets({ root, scanReferences: true }).result, 'PASS');
}));

const verifierSource = fs.readFileSync(new URL('./verify-font-assets.mjs', import.meta.url), 'utf8');
check('production verifier has no network code path', async () => {
  assert.doesNotMatch(verifierSource, /node:https|node:http|\bfetch\s*\(/, 'production verifier must not own network access');
});

for (const [name, fn] of checks) {
  try {
    await fn();
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

console.log(`Font assets contract: PASS (${checks.length} named adversarial checks).`);
