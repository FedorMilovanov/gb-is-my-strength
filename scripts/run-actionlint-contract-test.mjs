#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  TARGET_KEYS,
  TOOL_TAG_COMMIT,
  TOOL_VERSION,
  actionlintArgs,
  prepareActionlint,
  targetKey,
  validateManifest,
  verifyFile,
  verifyManifestSupplyChain,
} from './run-actionlint.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = path.join(ROOT, 'scripts', 'run-actionlint.mjs');
const TOOL_DIR = path.join(ROOT, 'tools', 'actionlint', `v${TOOL_VERSION}`);
const MANIFEST_PATH = path.join(TOOL_DIR, 'manifest.json');
const EXPECTED_KEYS = [
  'darwin-x64',
  'darwin-arm64',
  'linux-x64',
  'linux-arm64',
  'win32-x64',
  'win32-arm64',
];

function expectThrows(callback, pattern, label) {
  assert.throws(callback, pattern, label);
}

function runRunner(args, { cacheDir, preload } = {}) {
  const nodeArgs = preload ? ['--require', preload, RUNNER, ...args] : [RUNNER, ...args];
  return spawnSync(process.execPath, nodeArgs, {
    cwd: ROOT,
    env: {
      ...process.env,
      ACTIONLINT_CACHE_DIR: cacheDir,
      HTTP_PROXY: 'http://127.0.0.1:1',
      HTTPS_PROXY: 'http://127.0.0.1:1',
      ALL_PROXY: 'http://127.0.0.1:1',
      NO_PROXY: '',
    },
    encoding: 'utf8',
    shell: false,
  });
}

function outputOf(result) {
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'actionlint-contract-'));
try {
  const manifest = validateManifest(JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')));
  assert.equal(manifest.version, '1.7.7');
  assert.equal(manifest.upstream.tagCommit, TOOL_TAG_COMMIT);
  assert.deepEqual(TARGET_KEYS, EXPECTED_KEYS);
  assert.deepEqual(Object.keys(manifest.targets), EXPECTED_KEYS);
  verifyManifestSupplyChain(TOOL_DIR, manifest);

  for (const key of EXPECTED_KEYS) {
    const target = manifest.targets[key];
    assert.equal(targetKey(target.platform, target.arch), key);
    verifyFile(
      path.join(TOOL_DIR, target.archive),
      target.archiveSize,
      target.archiveSha256,
      `${key} archive fixture`,
    );
  }

  assert.deepEqual(actionlintArgs([]), ['-color']);
  assert.deepEqual(
    actionlintArgs(['-no-color', 'one.yml', '--shellcheck=']),
    ['-no-color', 'one.yml', '--shellcheck='],
  );
  expectThrows(() => targetKey('freebsd', 'x64'), /Unsupported actionlint platform/, 'unsupported platform must fail');
  expectThrows(() => targetKey('linux', 'riscv64'), /Unsupported actionlint platform/, 'unsupported architecture must fail');

  const runnerSource = fs.readFileSync(RUNNER, 'utf8');
  for (const [pattern, label] of [
    [/\bfetch\s*\(/, 'fetch'],
    [/node:https|node:http|node:net|node:tls/, 'Node network module'],
    [/\b(?:curl|wget|npx)\b/, 'network installer command'],
    [/releases\/download|api\.github\.com/, 'release endpoint'],
  ]) assert.doesNotMatch(runnerSource, pattern, `runner must not contain ${label}`);

  const preload = path.join(scratch, 'forbid-network.cjs');
  fs.writeFileSync(preload, `
const deny = () => { throw new Error('NETWORK_FORBIDDEN_BY_ACTIONLINT_CONTRACT'); };
globalThis.fetch = deny;
for (const name of ['node:http', 'node:https']) {
  const mod = require(name);
  mod.request = deny;
  mod.get = deny;
}
for (const name of ['node:net', 'node:tls']) {
  const mod = require(name);
  mod.connect = deny;
  mod.createConnection = deny;
}
require('node:dns').lookup = deny;
`);

  const coldCache = path.join(scratch, 'cold-cache');
  const version = runRunner(['-version'], { cacheDir: coldCache, preload });
  assert.equal(version.status, 0, outputOf(version));
  assert.match(outputOf(version), /^1\.7\.7$/m, 'actual checked-in binary must report version 1.7.7');
  assert.doesNotMatch(outputOf(version), /NETWORK_FORBIDDEN_BY_ACTIONLINT_CONTRACT/);

  const defaultLint = runRunner([], { cacheDir: coldCache, preload });
  assert.equal(defaultLint.status, 0, `zero-argument default must lint the repository workflows with -color\n${outputOf(defaultLint)}`);

  const validWorkflow = path.join(scratch, 'valid.yml');
  fs.writeFileSync(validWorkflow, `name: valid\non:\n  push:\npermissions:\n  contents: read\njobs:\n  verify:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n`);
  const valid = runRunner(['-no-color', validWorkflow], { cacheDir: coldCache, preload });
  assert.equal(valid.status, 0, outputOf(valid));

  const invalidWorkflow = path.join(scratch, 'invalid.yml');
  fs.writeFileSync(invalidWorkflow, `name: invalid\non: [push\njobs: {}\n`);
  const invalid = runRunner(['-no-color', invalidWorkflow], { cacheDir: coldCache, preload });
  assert.notEqual(invalid.status, 0, 'syntactically invalid workflow must fail');

  const fixtureRoot = path.join(scratch, 'fixture-root');
  fs.mkdirSync(fixtureRoot);
  fs.cpSync(path.join(ROOT, 'tools'), path.join(fixtureRoot, 'tools'), { recursive: true });
  const fixtureToolDir = path.join(fixtureRoot, 'tools', 'actionlint', `v${TOOL_VERSION}`);
  const fixtureManifestPath = path.join(fixtureToolDir, 'manifest.json');
  const fixtureCache = path.join(scratch, 'fixture-cache');
  const selected = manifest.targets[targetKey()];
  const selectedArchive = path.join(fixtureToolDir, selected.archive);
  const originalArchive = fs.readFileSync(selectedArchive);
  const originalManifest = fs.readFileSync(fixtureManifestPath, 'utf8');

  const prepared = prepareActionlint({ root: fixtureRoot, cacheRoot: fixtureCache });
  const cachedBytes = fs.readFileSync(prepared.binaryPath);
  cachedBytes[0] ^= 0xff;
  fs.writeFileSync(prepared.binaryPath, cachedBytes);
  expectThrows(
    () => prepareActionlint({ root: fixtureRoot, cacheRoot: fixtureCache }),
    /cached actionlint binary SHA-256 mismatch/,
    'warm cache corruption must fail closed',
  );
  fs.rmSync(fixtureCache, { recursive: true, force: true });
  prepareActionlint({ root: fixtureRoot, cacheRoot: fixtureCache });

  const corruptedArchive = Buffer.from(originalArchive);
  corruptedArchive[0] ^= 0xff;
  fs.writeFileSync(selectedArchive, corruptedArchive);
  expectThrows(
    () => prepareActionlint({ root: fixtureRoot, cacheRoot: fixtureCache }),
    /checked-in actionlint archive SHA-256 mismatch/,
    'a corrupt checked-in archive must fail before a warm cache is trusted',
  );
  fs.writeFileSync(selectedArchive, originalArchive);

  fs.renameSync(selectedArchive, `${selectedArchive}.missing`);
  expectThrows(
    () => prepareActionlint({ root: fixtureRoot, cacheRoot: fixtureCache }),
    /checked-in actionlint archive is missing or unreadable/,
    'a missing checked-in archive must fail closed',
  );
  fs.renameSync(`${selectedArchive}.missing`, selectedArchive);

  const badSize = clone(manifest);
  badSize.targets[targetKey()].archiveSize += 1;
  fs.writeFileSync(fixtureManifestPath, `${JSON.stringify(badSize, null, 2)}\n`);
  expectThrows(
    () => prepareActionlint({ root: fixtureRoot, cacheRoot: fixtureCache }),
    /checked-in actionlint archive size mismatch/,
    'manifest size corruption must fail closed',
  );

  const badHash = clone(manifest);
  badHash.targets[targetKey()].archiveSha256 = '0'.repeat(64);
  fs.writeFileSync(fixtureManifestPath, `${JSON.stringify(badHash, null, 2)}\n`);
  expectThrows(
    () => prepareActionlint({ root: fixtureRoot, cacheRoot: fixtureCache }),
    /upstream checksum asset does not bind/,
    'manifest hash corruption must fail closed against the upstream checksum asset',
  );
  fs.writeFileSync(fixtureManifestPath, originalManifest);

  const missingManifestTarget = clone(manifest);
  delete missingManifestTarget.targets['linux-arm64'];
  expectThrows(
    () => validateManifest(missingManifestTarget),
    /manifest\.targets keys must be exactly/,
    'all six manifest target mappings are mandatory',
  );

  console.log('ACTIONLINT OFFLINE CONTRACT: PASS');
  console.log(`version=${manifest.version} tagCommit=${manifest.upstream.tagCommit}`);
  console.log(`targets=${EXPECTED_KEYS.length} current=${targetKey()}`);
  console.log('network-forbidden cold cache, warm-cache corruption, manifest corruption and semantic lint fixtures: PASS');
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
