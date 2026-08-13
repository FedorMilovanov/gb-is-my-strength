#!/usr/bin/env node
/**
 * Verify, extract and run the repository-owned actionlint v1.7.7 archive.
 *
 * This path is deliberately offline: release acquisition is a reviewed source
 * change, while every invocation re-verifies the selected checked-in archive
 * before it trusts a digest-keyed extracted-binary cache.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
export const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
export const TOOL_VERSION = '1.7.7';
export const TOOL_TAG_COMMIT = '03d0035246f3e81f36aed592ffb4bebf33a03106';
export const TARGET_KEYS = Object.freeze([
  'darwin-x64',
  'darwin-arm64',
  'linux-x64',
  'linux-arm64',
  'win32-x64',
  'win32-arm64',
]);

const HEX_SHA256 = /^[a-f0-9]{64}$/;
const EXPECTED_ARCHIVE_NAMES = Object.freeze({
  'darwin-x64': 'actionlint_1.7.7_darwin_amd64.tar.gz',
  'darwin-arm64': 'actionlint_1.7.7_darwin_arm64.tar.gz',
  'linux-x64': 'actionlint_1.7.7_linux_amd64.tar.gz',
  'linux-arm64': 'actionlint_1.7.7_linux_arm64.tar.gz',
  'win32-x64': 'actionlint_1.7.7_windows_amd64.zip',
  'win32-arm64': 'actionlint_1.7.7_windows_arm64.zip',
});

function fail(message) {
  throw new Error(message);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value) fail(`${label} must be a non-empty string`);
  return value;
}

function requireInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) fail(`${label} must be a positive integer`);
  return value;
}

function requireSha256(value, label) {
  if (typeof value !== 'string' || !HEX_SHA256.test(value)) fail(`${label} must be a lowercase SHA-256 digest`);
  return value;
}

function requireBasename(value, label) {
  requireString(value, label);
  if (path.basename(value) !== value || value === '.' || value === '..') fail(`${label} must be a plain filename`);
  return value;
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(requireObject(value, label)).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((item, index) => item !== wanted[index])) {
    fail(`${label} keys must be exactly: ${wanted.join(', ')}`);
  }
}

export function validateManifest(manifest) {
  requireExactKeys(manifest, ['schemaVersion', 'tool', 'version', 'upstream', 'targets'], 'manifest');
  if (manifest.schemaVersion !== 1) fail('manifest.schemaVersion must equal 1');
  if (manifest.tool !== 'actionlint') fail('manifest.tool must equal actionlint');
  if (manifest.version !== TOOL_VERSION) fail(`manifest.version must equal ${TOOL_VERSION}`);

  const upstream = requireObject(manifest.upstream, 'manifest.upstream');
  requireExactKeys(upstream, ['repository', 'tag', 'tagCommit', 'releaseId', 'license', 'checksums'], 'manifest.upstream');
  if (upstream.repository !== 'rhysd/actionlint') fail('manifest.upstream.repository must equal rhysd/actionlint');
  if (upstream.tag !== `v${TOOL_VERSION}`) fail(`manifest.upstream.tag must equal v${TOOL_VERSION}`);
  if (upstream.tagCommit !== TOOL_TAG_COMMIT) fail(`manifest.upstream.tagCommit must equal ${TOOL_TAG_COMMIT}`);
  requireInteger(upstream.releaseId, 'manifest.upstream.releaseId');

  const license = requireObject(upstream.license, 'manifest.upstream.license');
  requireExactKeys(license, ['spdx', 'file', 'size', 'sha256'], 'manifest.upstream.license');
  if (license.spdx !== 'MIT') fail('manifest.upstream.license.spdx must equal MIT');
  requireBasename(license.file, 'manifest.upstream.license.file');
  requireInteger(license.size, 'manifest.upstream.license.size');
  requireSha256(license.sha256, 'manifest.upstream.license.sha256');

  const checksums = requireObject(upstream.checksums, 'manifest.upstream.checksums');
  requireExactKeys(checksums, ['file', 'assetId', 'size', 'sha256'], 'manifest.upstream.checksums');
  requireBasename(checksums.file, 'manifest.upstream.checksums.file');
  requireInteger(checksums.assetId, 'manifest.upstream.checksums.assetId');
  requireInteger(checksums.size, 'manifest.upstream.checksums.size');
  requireSha256(checksums.sha256, 'manifest.upstream.checksums.sha256');

  requireExactKeys(manifest.targets, TARGET_KEYS, 'manifest.targets');
  for (const key of TARGET_KEYS) {
    const target = requireObject(manifest.targets[key], `manifest.targets.${key}`);
    requireExactKeys(target, [
      'platform', 'arch', 'archive', 'format', 'assetId', 'archiveSize',
      'archiveSha256', 'binary', 'binarySize', 'binarySha256',
    ], `manifest.targets.${key}`);

    const [platform, arch] = key.split('-');
    if (target.platform !== platform || target.arch !== arch) {
      fail(`manifest.targets.${key} platform/arch do not match its key`);
    }
    if (target.archive !== EXPECTED_ARCHIVE_NAMES[key]) {
      fail(`manifest.targets.${key}.archive must equal ${EXPECTED_ARCHIVE_NAMES[key]}`);
    }
    requireBasename(target.archive, `manifest.targets.${key}.archive`);
    const expectedFormat = platform === 'win32' ? 'zip' : 'tar.gz';
    const expectedBinary = platform === 'win32' ? 'actionlint.exe' : 'actionlint';
    if (target.format !== expectedFormat) fail(`manifest.targets.${key}.format must equal ${expectedFormat}`);
    if (target.binary !== expectedBinary) fail(`manifest.targets.${key}.binary must equal ${expectedBinary}`);
    requireInteger(target.assetId, `manifest.targets.${key}.assetId`);
    requireInteger(target.archiveSize, `manifest.targets.${key}.archiveSize`);
    requireSha256(target.archiveSha256, `manifest.targets.${key}.archiveSha256`);
    requireInteger(target.binarySize, `manifest.targets.${key}.binarySize`);
    requireSha256(target.binarySha256, `manifest.targets.${key}.binarySha256`);
  }
  return manifest;
}

export function targetKey(platform = process.platform, arch = process.arch) {
  const key = `${platform}-${arch}`;
  if (!TARGET_KEYS.includes(key)) fail(`Unsupported actionlint platform: ${platform}/${arch}`);
  return key;
}

export function actionlintArgs(args) {
  if (!Array.isArray(args) || args.some((item) => typeof item !== 'string')) fail('actionlint arguments must be strings');
  return args.length ? [...args] : ['-color'];
}

export function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function verifyFile(filePath, expectedSize, expectedSha256, label = filePath) {
  let value;
  try {
    value = fs.readFileSync(filePath);
  } catch (error) {
    fail(`${label} is missing or unreadable: ${error.message}`);
  }
  if (value.length !== expectedSize) {
    fail(`${label} size mismatch: expected ${expectedSize}, got ${value.length}`);
  }
  const actualSha256 = sha256(value);
  if (actualSha256 !== expectedSha256) {
    fail(`${label} SHA-256 mismatch: expected ${expectedSha256}, got ${actualSha256}`);
  }
  return value;
}

function readManifest(toolDir) {
  const manifestPath = path.join(toolDir, 'manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    fail(`actionlint manifest is missing or invalid: ${error.message}`);
  }
  return validateManifest(manifest);
}

function parseUpstreamChecksums(value) {
  const checksums = new Map();
  for (const line of value.toString('utf8').split(/\r?\n/)) {
    const match = line.trim().match(/^([a-f0-9]{64})\s+\*?([^\s]+)$/i);
    if (match) checksums.set(match[2], match[1].toLowerCase());
  }
  return checksums;
}

export function verifyManifestSupplyChain(toolDir, manifest) {
  const { license, checksums } = manifest.upstream;
  verifyFile(path.join(toolDir, license.file), license.size, license.sha256, 'actionlint upstream license');
  const checksumBytes = verifyFile(
    path.join(toolDir, checksums.file),
    checksums.size,
    checksums.sha256,
    'actionlint upstream checksum asset',
  );
  const published = parseUpstreamChecksums(checksumBytes);
  for (const key of TARGET_KEYS) {
    const target = manifest.targets[key];
    if (published.get(target.archive) !== target.archiveSha256) {
      fail(`upstream checksum asset does not bind ${target.archive} to the manifest digest`);
    }
  }
}

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, {
    shell: false,
    encoding: 'utf8',
    ...options,
  });
  if (result.error) fail(`${command} failed to start: ${result.error.message}`);
  if (result.status !== 0) {
    const details = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
    fail(`${command} failed with exit ${result.status ?? 'unknown'}${details ? `: ${details}` : ''}`);
  }
  return result;
}

function verifyCachedBinary(binaryPath, target) {
  return verifyFile(binaryPath, target.binarySize, target.binarySha256, 'cached actionlint binary');
}

function extractArchive(archivePath, target, destination) {
  if (target.format === 'zip') {
    const escapedArchive = archivePath.replace(/'/g, "''");
    const escapedTarget = destination.replace(/'/g, "''");
    runChecked('powershell.exe', [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
      `Expand-Archive -LiteralPath '${escapedArchive}' -DestinationPath '${escapedTarget}' -Force`,
    ]);
    return;
  }

  const args = ['-xzf', archivePath, '-C', destination, target.binary];
  if (target.platform === 'linux') args.unshift('--no-same-owner');
  runChecked('tar', args);
}

export function prepareActionlint({
  root = ROOT,
  platform = process.platform,
  arch = process.arch,
  cacheRoot = process.env.ACTIONLINT_CACHE_DIR
    ? path.resolve(root, process.env.ACTIONLINT_CACHE_DIR)
    : path.join(root, '.cache', 'actionlint'),
} = {}) {
  const toolDir = path.join(root, 'tools', 'actionlint', `v${TOOL_VERSION}`);
  const manifest = readManifest(toolDir);
  verifyManifestSupplyChain(toolDir, manifest);

  const key = targetKey(platform, arch);
  const target = manifest.targets[key];
  const archivePath = path.join(toolDir, target.archive);

  // The source archive is the authority. Verify it on every invocation before
  // consulting even a previously verified digest-keyed extraction cache.
  verifyFile(archivePath, target.archiveSize, target.archiveSha256, 'checked-in actionlint archive');

  const cacheDir = path.join(cacheRoot, `v${manifest.version}`, key, target.archiveSha256);
  const binaryPath = path.join(cacheDir, target.binary);
  if (fs.existsSync(cacheDir)) {
    verifyCachedBinary(binaryPath, target);
    return { binaryPath, key, manifest, target };
  }

  const cacheParent = path.dirname(cacheDir);
  fs.mkdirSync(cacheParent, { recursive: true });
  const temporaryDir = fs.mkdtempSync(path.join(cacheParent, '.extract-'));
  try {
    extractArchive(archivePath, target, temporaryDir);
    const temporaryBinary = path.join(temporaryDir, target.binary);
    verifyCachedBinary(temporaryBinary, target);
    if (target.platform !== 'win32') fs.chmodSync(temporaryBinary, 0o755);

    try {
      fs.renameSync(temporaryDir, cacheDir);
    } catch (error) {
      if (!['EEXIST', 'ENOTEMPTY'].includes(error.code)) throw error;
      fs.rmSync(temporaryDir, { recursive: true, force: true });
    }
    verifyCachedBinary(binaryPath, target);
    return { binaryPath, key, manifest, target };
  } finally {
    fs.rmSync(temporaryDir, { recursive: true, force: true });
  }
}

export function runActionlint(args = process.argv.slice(2), options = {}) {
  const { binaryPath } = prepareActionlint(options);
  const result = spawnSync(binaryPath, actionlintArgs(args), {
    cwd: options.root || ROOT,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) fail(`actionlint failed to start: ${result.error.message}`);
  return result.status ?? 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SCRIPT_PATH);
if (isMain) {
  try {
    process.exitCode = runActionlint();
  } catch (error) {
    console.error(`actionlint runner error: ${error.message}`);
    process.exitCode = 1;
  }
}
