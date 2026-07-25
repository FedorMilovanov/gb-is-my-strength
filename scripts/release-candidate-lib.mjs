import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const ZERO_DIGEST = `sha256:${'0'.repeat(64)}`;
export const POINTER_RELATIVE_PATH = 'deployments/current.json';
export const TREE_ALGORITHM = 'sha256-canonical-pages-tree-v1';

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function sha256File(filePath) {
  return `sha256:${sha256Buffer(fs.readFileSync(filePath))}`;
}

function uint64(value) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(value));
  return buffer;
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function walkFiles(root) {
  assert.ok(fs.existsSync(root) && fs.statSync(root).isDirectory(), `directory is missing: ${root}`);
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const stat = fs.lstatSync(absolute);
      assert.equal(stat.isSymbolicLink(), false, `release candidate must not contain symlinks: ${absolute}`);
      if (stat.isDirectory()) visit(absolute);
      else if (stat.isFile()) files.push(toPosix(path.relative(root, absolute)));
      else throw new Error(`unsupported release-candidate entry: ${absolute}`);
    }
  };
  visit(root);
  return files.sort((a, b) => a.localeCompare(b, 'en'));
}

function isSelfReferentialProvenance(relativePath) {
  return relativePath === POINTER_RELATIVE_PATH || /^deployments\/[a-f0-9]{40}\/\d+-\d+\.json$/.test(relativePath);
}

function normalizeSelfDigest(relativePath, bytes) {
  if (!isSelfReferentialProvenance(relativePath)) return bytes;
  const text = bytes.toString('utf8');
  const pattern = /("artifact"\s*:\s*\{[\s\S]{0,800}?"digest"\s*:\s*")sha256:[a-f0-9]{64}(")/;
  const matches = text.match(pattern);
  assert.ok(matches, `${relativePath}: artifact.digest self-reference is missing`);
  const normalized = text.replace(pattern, `$1${ZERO_DIGEST}$2`);
  assert.equal(normalized.match(/sha256:[a-f0-9]{64}/g)?.includes(ZERO_DIGEST), true, `${relativePath}: artifact.digest normalization failed`);
  return Buffer.from(normalized, 'utf8');
}

export function canonicalTreeStats(root) {
  const files = walkFiles(root);
  const hash = crypto.createHash('sha256');
  let bytes = 0;
  for (const relativePath of files) {
    const absolute = path.join(root, ...relativePath.split('/'));
    const raw = fs.readFileSync(absolute);
    const normalized = normalizeSelfDigest(relativePath, raw);
    const pathBytes = Buffer.from(relativePath, 'utf8');
    hash.update(uint64(pathBytes.length));
    hash.update(pathBytes);
    hash.update(uint64(normalized.length));
    hash.update(normalized);
    bytes += raw.length;
  }
  return {
    algorithm: TREE_ALGORITHM,
    digest: `sha256:${hash.digest('hex')}`,
    bytes,
    files: files.length,
    paths: files,
  };
}

export function directoryDigest(root) {
  const stats = canonicalTreeStats(root);
  return { digest: stats.digest, bytes: stats.bytes, files: stats.files };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function fileRecord(root, relativePath, publicPath = `/${relativePath}`) {
  const absolute = path.join(root, ...relativePath.split('/'));
  assert.ok(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), `release asset is missing: ${relativePath}`);
  const bytes = fs.readFileSync(absolute);
  return {
    path: publicPath,
    bytes: bytes.length,
    sha256: `sha256:${sha256Buffer(bytes)}`,
  };
}

function countHtmlRoutes(dist) {
  return walkFiles(dist).filter((relativePath) => relativePath === 'index.html' || relativePath.endsWith('/index.html')).length;
}

function countSitemapUrls(dist) {
  const sitemap = fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8');
  return (sitemap.match(/<loc>/g) || []).length;
}

function readToolchain(root) {
  const configPath = path.join(root, 'data', 'release-toolchain.json');
  assert.ok(fs.existsSync(configPath), 'data/release-toolchain.json is missing');
  const toolchain = readJson(configPath);
  assert.equal(toolchain.schemaVersion, 1, 'release toolchain schema drifted');
  assert.match(String(toolchain.node || ''), /^\d+\.\d+\.\d+$/, 'release toolchain must pin Node exactly');
  assert.match(String(toolchain.npm || ''), /^\d+\.\d+\.\d+$/, 'release toolchain must pin npm exactly');
  return { node: toolchain.node, npm: toolchain.npm };
}

function assertExactIdentity({ repository, commitSha, runId, runAttempt }) {
  assert.match(repository, /^[^/\s]+\/[^/\s]+$/, 'repository must be owner/name');
  assert.match(commitSha, /^[a-f0-9]{40}$/, 'release SHA must be exact');
  assert.ok(Number.isSafeInteger(runId) && runId > 0, 'release run ID must be a positive safe integer');
  assert.ok(Number.isSafeInteger(runAttempt) && runAttempt > 0, 'release run attempt must be a positive safe integer');
}

export function prepareReleaseCandidate({
  root,
  dist,
  repository,
  commitSha,
  runId,
  runAttempt,
  eventName,
  actualNodeVersion,
  actualNpmVersion,
  generatedAt = new Date().toISOString(),
}) {
  assertExactIdentity({ repository, commitSha, runId, runAttempt });
  assert.ok(fs.existsSync(dist) && fs.statSync(dist).isDirectory(), 'dist must exist before release-candidate preparation');

  const toolchain = readToolchain(root);
  assert.equal(actualNodeVersion.replace(/^v/, ''), toolchain.node, 'runtime Node version does not match pinned toolchain');
  assert.equal(actualNpmVersion, toolchain.npm, 'runtime npm version does not match pinned toolchain');

  const runIdentity = `${runId}-${runAttempt}`;
  const candidateId = `${commitSha}:${runIdentity}`;
  const immutablePath = `/deployments/${commitSha}/${runIdentity}.json`;
  const immutableRelativePath = immutablePath.replace(/^\//, '');
  const manifestPath = path.join(dist, ...immutableRelativePath.split('/'));
  const pointerPath = path.join(dist, ...POINTER_RELATIVE_PATH.split('/'));
  const routeProfilesDir = path.join(root, 'data', 'route-profiles');
  const pagefindDir = path.join(dist, 'pagefind');

  const routeProfiles = directoryDigest(routeProfilesDir);
  const pagefind = directoryDigest(pagefindDir);
  const workflow = {
    name: 'Deploy to GitHub Pages',
    stage: 'readiness',
    runId,
    runAttempt,
    eventName: eventName || null,
  };

  const criticalAssets = {
    home: fileRecord(dist, 'index.html', '/'),
    sitemap: fileRecord(dist, 'sitemap.xml'),
    feed: fileRecord(dist, 'feed.xml'),
    pagefind: fileRecord(dist, 'pagefind/pagefind.js'),
    serviceWorker: fileRecord(dist, 'sw.js'),
  };
  const ttsAssets = {
    controller: fileRecord(dist, 'js/floating-cluster-controller.js'),
    engine: fileRecord(dist, 'js/vosk-tts-engine.js'),
    noticeCss: fileRecord(dist, 'css/tts-download-notice.css'),
    serviceWorker: criticalAssets.serviceWorker,
  };

  const manifest = {
    schemaVersion: 3,
    repository,
    commitSha,
    immutablePath,
    generatedAt,
    workflow,
    artifact: {
      candidateId,
      algorithm: TREE_ALGORITHM,
      digest: ZERO_DIGEST,
      bytes: 0,
      files: 0,
    },
    build: {
      node: toolchain.node,
      npm: toolchain.npm,
      packageLockDigest: sha256File(path.join(root, 'package-lock.json')),
      routeRegistryDigest: routeProfiles.digest,
      routeCounts: {
        profiles: routeProfiles.files,
        html: countHtmlRoutes(dist),
        sitemap: countSitemapUrls(dist),
      },
      pagefindDigest: pagefind.digest,
      pagefindFiles: pagefind.files,
      sitemapDigest: criticalAssets.sitemap.sha256,
      feedDigest: criticalAssets.feed.sha256,
    },
    criticalAssets,
    extensions: {
      tts: {
        assets: ttsAssets,
        lazyNoPrecache: ['css/tts-download-notice.css', 'js/vosk-tts-engine.js'],
      },
    },
  };
  const pointer = {
    schemaVersion: 2,
    repository,
    commitSha,
    immutablePath,
    workflow,
    artifact: {
      candidateId,
      digest: ZERO_DIGEST,
    },
  };

  for (let iteration = 0; iteration < 8; iteration += 1) {
    writeJson(manifestPath, manifest);
    writeJson(pointerPath, pointer);
    const stats = canonicalTreeStats(dist);
    if (manifest.artifact.bytes === stats.bytes && manifest.artifact.files === stats.files) break;
    manifest.artifact.bytes = stats.bytes;
    manifest.artifact.files = stats.files;
    if (iteration === 7) throw new Error('release-candidate byte/file metadata did not converge');
  }

  writeJson(manifestPath, manifest);
  writeJson(pointerPath, pointer);
  const beforeDigest = canonicalTreeStats(dist);
  manifest.artifact.bytes = beforeDigest.bytes;
  manifest.artifact.files = beforeDigest.files;
  manifest.artifact.digest = beforeDigest.digest;
  pointer.artifact.digest = beforeDigest.digest;
  writeJson(manifestPath, manifest);
  writeJson(pointerPath, pointer);

  const verified = verifyReleaseCandidate({
    dist,
    expectedRepository: repository,
    expectedCommitSha: commitSha,
    expectedRunId: runId,
    expectedRunAttempt: runAttempt,
  });
  return { manifest: verified.manifest, pointer: verified.pointer, stats: verified.stats, manifestPath, pointerPath };
}

export function verifyReleaseCandidate({
  dist,
  expectedRepository = null,
  expectedCommitSha = null,
  expectedRunId = null,
  expectedRunAttempt = null,
}) {
  const pointerPath = path.join(dist, ...POINTER_RELATIVE_PATH.split('/'));
  assert.ok(fs.existsSync(pointerPath), 'release current pointer is missing');
  const pointer = readJson(pointerPath);
  assert.equal(pointer.schemaVersion, 2, 'release current pointer schema drifted');
  assert.match(String(pointer.commitSha || ''), /^[a-f0-9]{40}$/, 'release pointer commit SHA is invalid');
  assert.match(String(pointer.immutablePath || ''), /^\/deployments\/[a-f0-9]{40}\/\d+-\d+\.json$/, 'release pointer immutable path is invalid');
  assert.match(String(pointer.artifact?.digest || ''), /^sha256:[a-f0-9]{64}$/, 'release pointer digest is invalid');
  assert.match(String(pointer.artifact?.candidateId || ''), /^[a-f0-9]{40}:\d+-\d+$/, 'release pointer candidate ID is invalid');

  const manifestPath = path.join(dist, ...pointer.immutablePath.replace(/^\//, '').split('/'));
  assert.ok(fs.existsSync(manifestPath), 'release immutable manifest is missing');
  const manifest = readJson(manifestPath);
  assert.equal(manifest.schemaVersion, 3, 'release manifest schema drifted');
  assert.equal(manifest.repository, pointer.repository, 'release repository pointer/manifest mismatch');
  assert.equal(manifest.commitSha, pointer.commitSha, 'release SHA pointer/manifest mismatch');
  assert.equal(manifest.immutablePath, pointer.immutablePath, 'release immutable path pointer/manifest mismatch');
  assert.equal(manifest.artifact?.candidateId, pointer.artifact?.candidateId, 'release candidate ID pointer/manifest mismatch');
  assert.equal(manifest.artifact?.digest, pointer.artifact?.digest, 'release digest pointer/manifest mismatch');
  assert.equal(manifest.artifact?.algorithm, TREE_ALGORITHM, 'release tree algorithm drifted');
  assert.equal(manifest.workflow?.name, 'Deploy to GitHub Pages', 'release workflow identity drifted');
  assert.equal(manifest.workflow?.stage, 'readiness', 'release workflow stage drifted');

  const stats = canonicalTreeStats(dist);
  assert.equal(stats.digest, manifest.artifact.digest, 'release candidate tree digest mismatch');
  assert.equal(stats.bytes, manifest.artifact.bytes, 'release candidate byte count mismatch');
  assert.equal(stats.files, manifest.artifact.files, 'release candidate file count mismatch');

  if (expectedRepository) assert.equal(manifest.repository, expectedRepository, 'release repository mismatch');
  if (expectedCommitSha) assert.equal(manifest.commitSha, expectedCommitSha, 'release commit SHA mismatch');
  if (expectedRunId !== null) assert.equal(manifest.workflow.runId, Number(expectedRunId), 'release run ID mismatch');
  if (expectedRunAttempt !== null) assert.equal(manifest.workflow.runAttempt, Number(expectedRunAttempt), 'release run attempt mismatch');

  for (const record of Object.values(manifest.criticalAssets || {})) {
    const relative = record.path === '/' ? 'index.html' : String(record.path).replace(/^\//, '');
    assert.deepEqual(fileRecord(dist, relative, record.path), record, `critical asset mismatch: ${record.path}`);
  }
  const tts = manifest.extensions?.tts;
  assert.ok(tts?.assets, 'release TTS extension is missing');
  assert.deepEqual(tts.lazyNoPrecache, ['css/tts-download-notice.css', 'js/vosk-tts-engine.js']);
  for (const record of Object.values(tts.assets)) {
    const relative = String(record.path).replace(/^\//, '');
    assert.deepEqual(fileRecord(dist, relative, record.path), record, `TTS asset mismatch: ${record.path}`);
  }

  return { manifest, pointer, stats, manifestPath, pointerPath };
}
