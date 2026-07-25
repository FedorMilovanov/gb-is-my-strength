#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  sha256,
  validateSupportManifestObject,
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

function assetRecord(fontPath, bytes, { family, subset = 'greek', weight = 400, style = 'normal' }) {
  const digest = sha256(bytes);
  return {
    path: fontPath,
    family,
    weight,
    style,
    subset,
    bytes: bytes.length,
    sha256: digest,
    source: {
      cssUrl: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:ital,wght@0,${weight}&display=swap`,
      url: `https://fonts.gstatic.com/${path.basename(fontPath)}`,
      contentType: 'font/woff2',
      observedBytes: bytes.length,
      observedSha256: digest,
      trackedMatch: true,
      status: 'verified-match',
    },
  };
}

function fontFace(asset, family = asset.family, weight = asset.weight, style = asset.style) {
  return `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};src:url('./${asset.path.slice(6)}') format('woff2');}`;
}

function writeFixture(root, definitions, { aliases = [], renderAliases = true } = {}) {
  const assets = definitions
    .map(({ fontPath, bytes, ...metadata }) => assetRecord(fontPath, bytes, metadata))
    .sort((a, b) => a.path.localeCompare(b.path));
  const manifest = {
    schemaVersion: 1,
    policy: {
      production: 'offline-pinned',
      generator: 'exact-source-url-all-or-nothing',
      upstreamRefreshRequires: '--accept-upstream',
    },
    assets,
  };
  const aliasRecords = aliases
    .map((alias) => ({ ...alias }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const declarations = [
    ...assets.map((asset) => fontFace(asset)),
    ...(renderAliases ? aliasRecords.map((alias) => {
      const asset = assets.find((candidate) => candidate.path === alias.path);
      assert.ok(asset, `fixture alias targets unknown asset: ${alias.path}`);
      return fontFace(asset, alias.family, alias.weight ?? asset.weight, alias.style ?? asset.style);
    }) : []),
  ];
  const registry = Buffer.from(`${declarations.join('\n')}\n`, 'utf8');
  const supportManifest = {
    schemaVersion: 1,
    policy: 'offline-pinned-support',
    fontFaceOverrides: aliasRecords,
    supportAssets: [{
      path: 'fonts/fonts.css',
      kind: 'css',
      role: 'font-face-registry',
      bytes: registry.length,
      sha256: sha256(registry),
    }],
  };

  fs.mkdirSync(path.join(root, 'fonts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'css'), { recursive: true });
  for (const definition of definitions) {
    const absolute = path.join(root, definition.fontPath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, definition.bytes);
  }
  fs.writeFileSync(path.join(root, 'fonts', 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(root, 'fonts', 'support-manifest.json'), `${JSON.stringify(supportManifest, null, 2)}\n`);
  fs.writeFileSync(path.join(root, 'fonts', 'fonts.css'), registry);
  fs.writeFileSync(path.join(root, 'css', 'fonts.css'), registry);
  return { manifest, supportManifest };
}

function replaceRegistry(root, state, declarations) {
  const registry = Buffer.from(`${declarations.join('\n')}\n`, 'utf8');
  fs.writeFileSync(path.join(root, 'fonts', 'fonts.css'), registry);
  fs.writeFileSync(path.join(root, 'css', 'fonts.css'), registry);
  const record = state.supportManifest.supportAssets.find((asset) => asset.role === 'font-face-registry');
  assert.ok(record, 'fixture registry support record is missing');
  record.bytes = registry.length;
  record.sha256 = sha256(registry);
}

async function withFixture(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-font-alias-contract-'));
  try {
    return await callback(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const checks = [];
const check = (name, fn) => checks.push([name, fn]);

check('Noto Sans Greek and Noto Serif Greek aliases pass', async () => withFixture(async (root) => {
  const definitions = [
    {
      fontPath: 'fonts/NotoSansGreek/notosansgreek-400.woff2',
      bytes: makeWoff2(31),
      family: 'Noto Sans',
    },
    {
      fontPath: 'fonts/NotoSerifGreek/notoserifgreek-400.woff2',
      bytes: makeWoff2(32),
      family: 'Noto Serif',
    },
  ];
  const aliases = [
    { path: definitions[0].fontPath, family: 'Noto Sans Greek' },
    { path: definitions[1].fontPath, family: 'Noto Serif Greek' },
  ];
  const state = writeFixture(root, definitions, { aliases });
  const result = verifyFontAssets({ root, ...state });
  assert.equal(result.result, 'PASS');
  assert.equal(result.assets.length, 2);
}));

check('wrong second duplicate declaration fails closed', async () => withFixture(async (root) => {
  const definition = {
    fontPath: 'fonts/Fixture/fixture-greek-400.woff2',
    bytes: makeWoff2(33),
    family: 'Fixture Serif',
  };
  const state = writeFixture(root, [definition]);
  const asset = state.manifest.assets[0];
  replaceRegistry(root, state, [fontFace(asset), fontFace(asset, 'Wrong Family')]);
  assert.throws(
    () => verifyFontAssets({ root, ...state }),
    /every @font-face declaration must match base metadata or an explicit override/,
  );
}));

check('unused and duplicate aliases fail closed', async () => {
  await withFixture(async (root) => {
    const definition = {
      fontPath: 'fonts/Fixture/fixture-greek-400.woff2',
      bytes: makeWoff2(34),
      family: 'Fixture Serif',
    };
    const aliases = [{ path: definition.fontPath, family: 'Unused Alias' }];
    const state = writeFixture(root, [definition], { aliases, renderAliases: false });
    assert.throws(() => verifyFontAssets({ root, ...state }), /font face overrides are stale or unused/);
  });

  const duplicateManifest = {
    schemaVersion: 1,
    policy: 'offline-pinned-support',
    fontFaceOverrides: [
      { path: 'fonts/Fixture/fixture-greek-400.woff2', family: 'Alias One' },
      { path: 'fonts/Fixture/fixture-greek-400.woff2', family: 'Alias Two' },
    ],
    supportAssets: [],
  };
  assert.throws(() => validateSupportManifestObject(duplicateManifest), /duplicate font face override/);
});

for (const [name, fn] of checks) {
  try {
    await fn();
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

console.log(`Font alias contract: PASS (${checks.length} review fixtures).`);
