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
  validateSfntBuffer,
  validateSupportManifestObject,
  validateWoff2Buffer,
  verifyFontAssets,
} from './font-assets-lib.mjs';

function makeWoff2(seed = 0, length = 2048) {
  const bytes = Buffer.alloc(length, seed & 0xff);
  bytes.write('wOF2', 0, 'ascii');
  bytes.writeUInt32BE(0x00010000, 4);
  bytes.writeUInt32BE(length, 8);
  bytes.writeUInt16BE(1, 12);
  bytes.writeUInt16BE(0, 14);
  bytes.writeUInt32BE(4096, 16);
  bytes.writeUInt32BE(length - 48, 20);
  bytes.writeUInt16BE(1, 24);
  bytes.fill(0, 26, 48);
  return bytes;
}

function makeSfnt(seed = 0, length = 2048) {
  const bytes = Buffer.alloc(length, seed & 0xff);
  bytes.writeUInt32BE(0x00010000, 0);
  bytes.writeUInt16BE(1, 4);
  bytes.writeUInt16BE(16, 6);
  bytes.writeUInt16BE(0, 8);
  bytes.writeUInt16BE(0, 10);
  bytes.write('head', 12, 'ascii');
  bytes.writeUInt32BE(0, 16);
  bytes.writeUInt32BE(28, 20);
  bytes.writeUInt32BE(length - 28, 24);
  return bytes;
}

function assetRecord(fontPath, bytes, overrides = {}) {
  const digest = sha256(bytes);
  return {
    path: fontPath,
    family: 'Fixture Serif',
    weight: 400,
    style: 'normal',
    subset: 'latin',
    bytes: bytes.length,
    sha256: digest,
    source: {
      cssUrl: 'https://fonts.googleapis.com/css2?family=Fixture%20Serif:ital,wght@0,400&display=swap',
      url: `https://fonts.gstatic.com/${path.basename(fontPath)}`,
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

function registryCss(manifest, sfntAssets = []) {
  const records = [
    ...manifest.assets.map((asset) => `@font-face{font-family:'${asset.family}';font-style:${asset.style};font-weight:${asset.weight};src:url('./${asset.path.slice(6)}') format('woff2');}`),
    ...sfntAssets.map((asset) => `@font-face{font-family:'${asset.family}';font-style:${asset.style};font-weight:${asset.weight};src:url('./${asset.path.slice(6)}') format('truetype');}`),
  ];
  return Buffer.from(`${records.join('\n')}\n`, 'utf8');
}

function writeFixture(root, assets, { manifest = null, sfntFiles = [] } = {}) {
  const resolvedManifest = manifest || manifestFor(assets.map(([fontPath, bytes]) => assetRecord(fontPath, bytes)));
  const sfntAssets = sfntFiles.map(({ fontPath, bytes, family = 'Fixture Serif', weight = 400, style = 'normal' }) => ({
    path: fontPath,
    kind: 'sfnt',
    role: 'fixture-fallback',
    family,
    weight,
    style,
    bytes: bytes.length,
    sha256: sha256(bytes),
  }));
  const registry = registryCss(resolvedManifest, sfntAssets);
  const supportManifest = {
    schemaVersion: 1,
    policy: 'offline-pinned-support',
    fontFaceOverrides: [],
    supportAssets: [
      ...sfntAssets,
      { path: 'fonts/fonts.css', kind: 'css', role: 'font-face-registry', bytes: registry.length, sha256: sha256(registry) },
    ].sort((a, b) => a.path.localeCompare(b.path)),
  };

  fs.mkdirSync(path.join(root, 'fonts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'css'), { recursive: true });
  for (const [fontPath, bytes] of assets) {
    const absolute = path.join(root, fontPath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, bytes);
  }
  for (const item of sfntFiles) {
    const absolute = path.join(root, item.fontPath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, item.bytes);
  }
  fs.writeFileSync(path.join(root, 'fonts', 'manifest.json'), `${JSON.stringify(resolvedManifest, null, 2)}\n`);
  fs.writeFileSync(path.join(root, 'fonts', 'support-manifest.json'), `${JSON.stringify(supportManifest, null, 2)}\n`);
  fs.writeFileSync(path.join(root, 'fonts', 'fonts.css'), registry);
  fs.writeFileSync(path.join(root, 'css', 'fonts.css'), registry);
  return { manifest: resolvedManifest, supportManifest };
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

check('valid pinned WOFF2 and registry pass', async () => withFixture(async (root) => {
  const bytes = makeWoff2(1);
  const state = writeFixture(root, [['fonts/Fixture/fixture-latin-400.woff2', bytes]]);
  const result = verifyFontAssets({ root, ...state });
  assert.equal(result.result, 'PASS');
  assert.equal(result.assets.length, 1);
  assert.equal(result.supportAssets.length, 1);
}));

check('valid pinned sfnt fallback passes', async () => withFixture(async (root) => {
  const woff2 = makeWoff2(2);
  const sfnt = makeSfnt(3);
  const state = writeFixture(root, [['fonts/Fixture/fixture-latin-400.woff2', woff2]], {
    sfntFiles: [{ fontPath: 'fonts/Fixture/fixture-fallback.ttf', bytes: sfnt }],
  });
  assert.equal(validateSfntBuffer(sfnt).numTables, 1);
  assert.equal(verifyFontAssets({ root, ...state }).result, 'PASS');
}));

check('missing manifest font fails', async () => withFixture(async (root) => {
  const bytes = makeWoff2(4);
  const state = writeFixture(root, [['fonts/Fixture/fixture-latin-400.woff2', bytes]]);
  fs.rmSync(path.join(root, state.manifest.assets[0].path));
  assert.throws(() => verifyFontAssets({ root, ...state }), /manifest files missing/);
}));

check('undeclared font fails', async () => withFixture(async (root) => {
  const state = writeFixture(root, [['fonts/Fixture/fixture-latin-400.woff2', makeWoff2(5)]]);
  fs.writeFileSync(path.join(root, 'fonts', 'Fixture', 'rogue.woff2'), makeWoff2(6));
  assert.throws(() => verifyFontAssets({ root, ...state }), /undeclared files/);
}));

check('HTML body named woff2 fails magic', async () => {
  assert.throws(() => validateWoff2Buffer(Buffer.from('<!doctype html><title>error</title>'.repeat(80))), /wOF2 magic/);
});

check('truncated WOFF2 fails length', async () => {
  const bytes = makeWoff2(7);
  assert.throws(() => validateWoff2Buffer(bytes.subarray(0, -1)), /declared length mismatch/);
});

check('sfnt table outside file fails', async () => {
  const bytes = makeSfnt(8);
  bytes.writeUInt32BE(bytes.length + 1, 20);
  assert.throws(() => validateSfntBuffer(bytes), /exceeds file/);
});

check('stale WOFF2 hash fails', async () => withFixture(async (root) => {
  const state = writeFixture(root, [['fonts/Fixture/fixture-latin-400.woff2', makeWoff2(9)]]);
  state.manifest.assets[0].sha256 = '0'.repeat(64);
  state.manifest.assets[0].source.trackedMatch = false;
  state.manifest.assets[0].source.status = 'upstream-drift';
  assert.throws(() => verifyFontAssets({ root, ...state }), /SHA-256 mismatch/);
}));

check('stale support hash fails', async () => withFixture(async (root) => {
  const state = writeFixture(root, [['fonts/Fixture/fixture-latin-400.woff2', makeWoff2(10)]]);
  state.supportManifest.supportAssets.at(-1).sha256 = '0'.repeat(64);
  assert.throws(() => verifyFontAssets({ root, ...state }), /support SHA-256 mismatch/);
}));

check('symbolic font link fails', async () => withFixture(async (root) => {
  if (process.platform === 'win32') return;
  const state = writeFixture(root, [['fonts/Fixture/fixture-latin-400.woff2', makeWoff2(11)]]);
  fs.symlinkSync('fixture-latin-400.woff2', path.join(root, 'fonts', 'Fixture', 'linked.woff2'));
  assert.throws(() => verifyFontAssets({ root, ...state }), /symbolic link is forbidden/);
}));

check('unknown font reference fails', async () => withFixture(async (root) => {
  const state = writeFixture(root, [['fonts/Fixture/fixture-latin-400.woff2', makeWoff2(12)]]);
  const unknownPath = '/' + ['fonts', 'Fixture', 'unknown' + '.woff2'].join('/');
  fs.appendFileSync(path.join(root, 'css', 'fonts.css'), `x{src:url('${unknownPath}')}\n`);
  assert.throws(() => verifyFontAssets({ root, ...state }), /references are not declared/);
}));

check('canonical registry family drift fails', async () => withFixture(async (root) => {
  const state = writeFixture(root, [['fonts/Fixture/fixture-latin-400.woff2', makeWoff2(13)]]);
  const wrongRegistry = Buffer.from("@font-face{font-family:'Wrong Family';font-style:normal;font-weight:400;src:url('./Fixture/fixture-latin-400.woff2') format('woff2');}\n");
  fs.writeFileSync(path.join(root, 'fonts', 'fonts.css'), wrongRegistry);
  fs.writeFileSync(path.join(root, 'css', 'fonts.css'), wrongRegistry);
  const record = state.supportManifest.supportAssets.find((asset) => asset.role === 'font-face-registry');
  record.bytes = wrongRegistry.length;
  record.sha256 = sha256(wrongRegistry);
  assert.throws(
    () => verifyFontAssets({ root, ...state }),
    /every @font-face declaration must match base metadata or an explicit override/,
  );
}));

check('registry omission fails', async () => withFixture(async (root) => {
  const state = writeFixture(root, [['fonts/Fixture/fixture-latin-400.woff2', makeWoff2(14)]]);
  const emptyRegistry = Buffer.from("@font-face{font-family:'Other';font-style:normal;font-weight:400;src:url('./Other/other.woff2') format('woff2');}\n");
  fs.writeFileSync(path.join(root, 'fonts', 'fonts.css'), emptyRegistry);
  const record = state.supportManifest.supportAssets.find((asset) => asset.role === 'font-face-registry');
  record.bytes = emptyRegistry.length;
  record.sha256 = sha256(emptyRegistry);
  assert.throws(() => verifyFontAssets({ root, ...state }), /references are not declared|registry omits/);
}));

check('source status must reflect observed bytes', async () => {
  const bytes = makeWoff2(15);
  const manifest = manifestFor([assetRecord('fonts/Fixture/fixture-latin-400.woff2', bytes)]);
  manifest.assets[0].source.observedSha256 = 'f'.repeat(64);
  assert.throws(() => validateManifestObject(manifest), /trackedMatch does not reflect/);
});

check('support manifest rejects unnormalized path', async () => {
  const manifest = {
    schemaVersion: 1,
    policy: 'offline-pinned-support',
    fontFaceOverrides: [],
    supportAssets: [{ path: './fonts/fonts.css', kind: 'css', role: 'font-face-registry', bytes: 10, sha256: '0'.repeat(64) }],
  };
  assert.throws(() => validateSupportManifestObject(manifest), /must be normalized/);
});

check('exact fetch accepts valid WOFF2', async () => {
  const bytes = makeWoff2(16);
  const fetched = await fetchExactFontSource('https://fonts.gstatic.com/fixture.woff2', {
    fetchImpl: async () => response(bytes),
  });
  assert.equal(fetched.sha256, sha256(bytes));
});

for (const [name, status] of [['HTTP 404 fails', 404], ['HTTP 500 fails', 500]]) {
  check(name, async () => {
    await assert.rejects(fetchExactFontSource('https://fonts.gstatic.com/fixture.woff2', {
      fetchImpl: async () => response('error', status, { 'content-type': 'text/plain' }),
    }), new RegExp(`font source HTTP ${status}`));
  });
}

check('HTML content type fails', async () => {
  await assert.rejects(fetchExactFontSource('https://fonts.gstatic.com/fixture.woff2', {
    fetchImpl: async () => response('<html>error</html>', 200, { 'content-type': 'text/html' }),
  }), /content-type is forbidden/);
});

check('HTML disguised as font fails magic', async () => {
  await assert.rejects(fetchExactFontSource('https://fonts.gstatic.com/fixture.woff2', {
    fetchImpl: async () => response(Buffer.from('<html>error</html>'.repeat(100))),
  }), /wOF2 magic/);
});

check('HTTP redirect target fails', async () => {
  await assert.rejects(fetchExactFontSource('https://fonts.gstatic.com/start.woff2', {
    fetchImpl: async () => response(null, 302, { location: 'http://fonts.gstatic.com/fixture.woff2' }),
  }), /must use HTTPS/);
});

check('private redirect target fails', async () => {
  await assert.rejects(fetchExactFontSource('https://fonts.gstatic.com/start.woff2', {
    fetchImpl: async () => response(null, 302, { location: 'https://127.0.0.1/fixture.woff2' }),
  }), /host is forbidden/);
});

check('redirect loop fails closed', async () => {
  const fakeFetch = async (url) => response(null, 302, { location: new URL('/loop.woff2', url).href });
  await assert.rejects(fetchExactFontSource('https://fonts.gstatic.com/start.woff2', {
    fetchImpl: fakeFetch,
    maxRedirects: 2,
  }), /exceeded 2 redirects/);
});

check('upstream drift leaves full directory untouched', async () => withFixture(async (root) => {
  const original = makeWoff2(17);
  const changed = makeWoff2(18);
  const fontPath = 'fonts/Fixture/fixture-latin-400.woff2';
  const state = writeFixture(root, [[fontPath, original]]);
  const registryBefore = fs.readFileSync(path.join(root, 'fonts', 'fonts.css'));
  await assert.rejects(generateFontAssets({
    root,
    ...state,
    write: true,
    fetchImpl: async () => response(changed),
  }), /upstream drift/);
  assert.deepEqual(fs.readFileSync(path.join(root, fontPath)), original);
  assert.deepEqual(fs.readFileSync(path.join(root, 'fonts', 'fonts.css')), registryBefore);
}));

check('one unavailable source aborts whole generation', async () => withFixture(async (root) => {
  const first = makeWoff2(19);
  const second = makeWoff2(20);
  const assets = [
    ['fonts/A/a-latin-400.woff2', first],
    ['fonts/B/b-latin-400.woff2', second],
  ];
  const state = writeFixture(root, assets);
  const fakeFetch = async (url) => String(url).includes('/a-latin')
    ? response(first)
    : response('missing', 404, { 'content-type': 'text/plain' });
  await assert.rejects(generateFontAssets({ root, ...state, write: true, fetchImpl: fakeFetch }), /font source HTTP 404/);
  assert.deepEqual(fs.readFileSync(path.join(root, assets[0][0])), first);
  assert.deepEqual(fs.readFileSync(path.join(root, assets[1][0])), second);
}));

check('accepted refresh updates staged manifest only', async () => withFixture(async (root) => {
  const original = makeWoff2(21);
  const changed = makeWoff2(22);
  const fontPath = 'fonts/Fixture/fixture-latin-400.woff2';
  const state = writeFixture(root, [[fontPath, original]]);
  const result = await generateFontAssets({
    root,
    ...state,
    acceptUpstream: true,
    write: false,
    fetchImpl: async () => response(changed),
  });
  assert.equal(result.result, 'DRY_RUN_PASS');
  assert.equal(result.manifest.assets[0].sha256, sha256(changed));
  assert.deepEqual(fs.readFileSync(path.join(root, fontPath)), original);
}));

check('exact source swaps directory and preserves support', async () => withFixture(async (root) => {
  const woff2 = makeWoff2(23);
  const sfnt = makeSfnt(24);
  const fontPath = 'fonts/Fixture/fixture-latin-400.woff2';
  const ttfPath = 'fonts/Fixture/fixture-fallback.ttf';
  const state = writeFixture(root, [[fontPath, woff2]], {
    sfntFiles: [{ fontPath: ttfPath, bytes: sfnt }],
  });
  const registryBefore = fs.readFileSync(path.join(root, 'fonts', 'fonts.css'));
  const result = await generateFontAssets({ root, ...state, write: true, fetchImpl: async () => response(woff2) });
  assert.equal(result.result, 'WRITE_PASS');
  assert.deepEqual(fs.readFileSync(path.join(root, fontPath)), woff2);
  assert.deepEqual(fs.readFileSync(path.join(root, ttfPath)), sfnt);
  assert.deepEqual(fs.readFileSync(path.join(root, 'fonts', 'fonts.css')), registryBefore);
  assert.equal(verifyFontAssets({ root, scanReferences: false }).result, 'PASS');
}));

check('production verifier has no network path', async () => {
  const source = fs.readFileSync(new URL('./verify-font-assets.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /node:https|node:http|\bfetch\s*\(/);
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
