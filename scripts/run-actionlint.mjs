#!/usr/bin/env node
/**
 * Download, verify and run the repository-pinned actionlint release.
 * Node 22 is the only runtime dependency; extraction uses the platform tools
 * already present on GitHub-hosted runners and normal developer systems.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = '1.7.7';
const platformMap = { linux: 'linux', darwin: 'darwin', win32: 'windows' };
const archMap = { x64: 'amd64', arm64: 'arm64' };
const platform = platformMap[process.platform];
const arch = archMap[process.arch];
if (!platform || !arch) {
  throw new Error(`Unsupported actionlint platform: ${process.platform}/${process.arch}`);
}

const isWindows = process.platform === 'win32';
const extension = isWindows ? 'zip' : 'tar.gz';
const archiveName = `actionlint_${VERSION}_${platform}_${arch}.${extension}`;
const releaseRoot = `https://github.com/rhysd/actionlint/releases/download/v${VERSION}`;
const cacheDir = path.join(ROOT, '.cache', 'actionlint', `v${VERSION}`, `${platform}-${arch}`);
const binary = path.join(cacheDir, isWindows ? 'actionlint.exe' : 'actionlint');

async function download(url) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Download failed ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function install() {
  fs.mkdirSync(cacheDir, { recursive: true });
  const [archive, checksums] = await Promise.all([
    download(`${releaseRoot}/${archiveName}`),
    download(`${releaseRoot}/checksums.txt`),
  ]);
  const checksumText = checksums.toString('utf8');
  const line = checksumText.split(/\r?\n/).find((item) => item.trim().endsWith(archiveName));
  if (!line) throw new Error(`No checksum published for ${archiveName}`);
  const expected = line.trim().split(/\s+/)[0].toLowerCase();
  const actual = crypto.createHash('sha256').update(archive).digest('hex');
  if (actual !== expected) {
    throw new Error(`Checksum mismatch for ${archiveName}: expected ${expected}, got ${actual}`);
  }

  const archivePath = path.join(os.tmpdir(), `${process.pid}-${archiveName}`);
  fs.writeFileSync(archivePath, archive);
  try {
    if (isWindows) {
      const escapedArchive = archivePath.replace(/'/g, "''");
      const escapedTarget = cacheDir.replace(/'/g, "''");
      run('powershell.exe', [
        '-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
        `Expand-Archive -LiteralPath '${escapedArchive}' -DestinationPath '${escapedTarget}' -Force`,
      ]);
    } else {
      run('tar', ['-xzf', archivePath, '-C', cacheDir, isWindows ? 'actionlint.exe' : 'actionlint']);
      fs.chmodSync(binary, 0o755);
    }
  } finally {
    fs.rmSync(archivePath, { force: true });
  }
  if (!fs.existsSync(binary)) throw new Error(`actionlint binary was not extracted to ${binary}`);
}

if (!fs.existsSync(binary)) await install();
const args = process.argv.slice(2);
run(binary, args.length ? args : ['-color']);
