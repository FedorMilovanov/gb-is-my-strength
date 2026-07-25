#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MANIFEST_RELATIVE_PATH = 'fonts/manifest.json';
export const ALLOWED_FONT_CONTENT_TYPES = new Set([
  'font/woff2',
  'application/font-woff2',
  'application/octet-stream',
]);

const TEXT_EXTENSIONS = new Set(['.astro', '.css', '.html', '.js', '.jsx', '.md', '.mdx', '.mjs', '.ts', '.tsx']);
const REFERENCE_EXCLUDED_DIRS = new Set(['.git', '.astro', 'dist', 'fonts', 'images', 'node_modules', 'reports']);
const MAX_REDIRECTS = 5;
const MIN_FONT_BYTES = 1024;
const MAX_FONT_BYTES = 2_000_000;

function normalizeRepoPath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
}

export function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export function walkFiles(directory, { rejectSymlinks = false } = {}) {
  const out = [];
  if (!fs.existsSync(directory)) return out;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) {
      if (rejectSymlinks) throw new Error(`symbolic link is forbidden: ${absolute}`);
      continue;
    }
    if (stat.isDirectory()) out.push(...walkFiles(absolute, { rejectSymlinks }));
    else if (stat.isFile()) out.push(absolute);
  }
  return out;
}

export function validateWoff2Buffer(bytes, label = 'font') {
  assert.ok(Buffer.isBuffer(bytes), `${label}: expected Buffer`);
  assert.ok(bytes.length >= 48, `${label}: truncated WOFF2 header (${bytes.length} bytes)`);
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'wOF2', `${label}: missing wOF2 magic`);
  assert.equal(bytes.readUInt32BE(8), bytes.length, `${label}: WOFF2 declared length mismatch`);
  const numTables = bytes.readUInt16BE(12);
  assert.ok(numTables > 0 && numTables < 256, `${label}: invalid WOFF2 table count ${numTables}`);
  assert.equal(bytes.readUInt16BE(14), 0, `${label}: WOFF2 reserved field must be zero`);
  assert.ok(bytes.readUInt32BE(16) > 0, `${label}: invalid totalSfntSize`);
  const compressedSize = bytes.readUInt32BE(20);
  assert.ok(compressedSize > 0 && compressedSize <= bytes.length, `${label}: invalid totalCompressedSize`);
  const metaOffset = bytes.readUInt32BE(28);
  const metaLength = bytes.readUInt32BE(32);
  const metaOriginalLength = bytes.readUInt32BE(36);
  const privateOffset = bytes.readUInt32BE(40);
  const privateLength = bytes.readUInt32BE(44);
  if (metaOffset === 0) {
    assert.equal(metaLength, 0, `${label}: metadata length exists without offset`);
    assert.equal(metaOriginalLength, 0, `${label}: metadata original length exists without offset`);
  } else {
    assert.ok(metaOffset + metaLength <= bytes.length, `${label}: metadata range exceeds file`);
    assert.ok(metaOriginalLength > 0, `${label}: metadata original length is missing`);
  }
  if (privateOffset === 0) assert.equal(privateLength, 0, `${label}: private length exists without offset`);
  else assert.ok(privateOffset + privateLength <= bytes.length, `${label}: private range exceeds file`);
  assert.ok(bytes.length >= MIN_FONT_BYTES && bytes.length <= MAX_FONT_BYTES, `${label}: implausible WOFF2 size ${bytes.length}`);
  return {
    bytes: bytes.length,
    sha256: sha256(bytes),
    numTables,
    totalSfntSize: bytes.readUInt32BE(16),
    totalCompressedSize: compressedSize,
  };
}

function validateSource(source, assetPath) {
  assert.ok(source && typeof source === 'object' && !Array.isArray(source), `${assetPath}: source metadata is missing`);
  const cssUrl = new URL(source.cssUrl);
  const sourceUrl = new URL(source.url);
  assert.equal(cssUrl.protocol, 'https:', `${assetPath}: CSS source must use HTTPS`);
  assert.equal(cssUrl.hostname, 'fonts.googleapis.com', `${assetPath}: CSS source host drifted`);
  assert.equal(sourceUrl.protocol, 'https:', `${assetPath}: font source must use HTTPS`);
  assert.equal(sourceUrl.hostname, 'fonts.gstatic.com', `${assetPath}: font source host drifted`);
  assert.match(sourceUrl.pathname, /\.woff2$/i, `${assetPath}: source URL must end in .woff2`);
  assert.ok(ALLOWED_FONT_CONTENT_TYPES.has(source.contentType), `${assetPath}: unsupported source content type`);
  assert.ok(Number.isSafeInteger(source.observedBytes) && source.observedBytes >= MIN_FONT_BYTES, `${assetPath}: invalid observed byte size`);
  assert.match(source.observedSha256, /^[a-f0-9]{64}$/, `${assetPath}: invalid observed SHA-256`);
  assert.equal(typeof source.trackedMatch, 'boolean', `${assetPath}: trackedMatch must be boolean`);
  assert.ok(['verified-match', 'upstream-drift'].includes(source.status), `${assetPath}: invalid source status`);
  assert.equal(source.status === 'verified-match', source.trackedMatch, `${assetPath}: source status/trackedMatch mismatch`);
}

export function validateManifestObject(manifest) {
  assert.ok(manifest && typeof manifest === 'object' && !Array.isArray(manifest), 'font manifest must be an object');
  assert.equal(manifest.schemaVersion, 1, 'font manifest schemaVersion must be 1');
  assert.equal(manifest.policy?.production, 'offline-pinned', 'font manifest production policy drifted');
  assert.equal(manifest.policy?.generator, 'exact-source-url-all-or-nothing', 'font generator policy drifted');
  assert.equal(manifest.policy?.upstreamRefreshRequires, '--accept-upstream', 'font refresh acknowledgement drifted');
  assert.ok(Array.isArray(manifest.assets) && manifest.assets.length > 0, 'font manifest assets are missing');

  const seen = new Set();
  let previousPath = '';
  for (const asset of manifest.assets) {
    assert.ok(asset && typeof asset === 'object' && !Array.isArray(asset), 'font manifest asset must be an object');
    asset.path = normalizeRepoPath(asset.path);
    assert.match(asset.path, /^fonts\/[A-Za-z0-9._/-]+\.woff2$/, `${asset.path}: invalid font path`);
    assert.equal(asset.path.includes('..'), false, `${asset.path}: parent traversal is forbidden`);
    assert.equal(seen.has(asset.path), false, `${asset.path}: duplicate manifest path`);
    assert.ok(asset.path.localeCompare(previousPath) >= 0, `${asset.path}: manifest assets must be sorted`);
    seen.add(asset.path);
    previousPath = asset.path;
    assert.ok(typeof asset.family === 'string' && asset.family.trim(), `${asset.path}: family is missing`);
    assert.ok(Number.isInteger(asset.weight) && asset.weight >= 100 && asset.weight <= 900, `${asset.path}: invalid weight`);
    assert.ok(['normal', 'italic'].includes(asset.style), `${asset.path}: invalid style`);
    assert.match(asset.subset, /^[a-z0-9-]+$/, `${asset.path}: invalid subset`);
    assert.ok(Number.isSafeInteger(asset.bytes) && asset.bytes >= MIN_FONT_BYTES && asset.bytes <= MAX_FONT_BYTES, `${asset.path}: invalid byte size`);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/, `${asset.path}: invalid SHA-256`);
    validateSource(asset.source, asset.path);
    const sourceMatchesPinned = asset.source.observedBytes === asset.bytes && asset.source.observedSha256 === asset.sha256;
    assert.equal(asset.source.trackedMatch, sourceMatchesPinned, `${asset.path}: trackedMatch does not reflect observed upstream bytes`);
  }
  return manifest;
}

export function loadFontManifest(root = ROOT) {
  const manifestPath = path.join(root, MANIFEST_RELATIVE_PATH);
  assert.ok(fs.existsSync(manifestPath), `font manifest is missing: ${MANIFEST_RELATIVE_PATH}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return validateManifestObject(manifest);
}

function parseCssFontFaces(root) {
  const faces = new Map();
  for (const absolute of walkFiles(root)) {
    if (path.extname(absolute).toLowerCase() !== '.css') continue;
    const relative = normalizeRepoPath(path.relative(root, absolute));
    if (relative.startsWith('dist/') || relative.startsWith('node_modules/')) continue;
    const source = fs.readFileSync(absolute, 'utf8');
    for (const block of source.match(/@font-face\s*\{[\s\S]*?\}/gi) || []) {
      const urlMatch = block.match(/url\(\s*(['"]?)(\/?fonts\/[A-Za-z0-9._/-]+\.woff2)\1\s*\)/i);
      if (!urlMatch) continue;
      const familyMatch = block.match(/font-family\s*:\s*(['"])(.*?)\1\s*;/i) || block.match(/font-family\s*:\s*([^;]+);/i);
      const weightMatch = block.match(/font-weight\s*:\s*(\d{3})\s*;/i);
      const styleMatch = block.match(/font-style\s*:\s*(normal|italic)\s*;/i);
      const fontPath = normalizeRepoPath(urlMatch[2]);
      const family = familyMatch ? String(familyMatch[2] || familyMatch[1]).trim().replace(/^['"]|['"]$/g, '') : '';
      const record = {
        file: relative,
        family,
        weight: weightMatch ? Number(weightMatch[1]) : null,
        style: styleMatch ? styleMatch[1].toLowerCase() : null,
      };
      if (!faces.has(fontPath)) faces.set(fontPath, []);
      faces.get(fontPath).push(record);
    }
  }
  return faces;
}

export function collectFontReferences(root = ROOT) {
  const references = new Map();
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (REFERENCE_EXCLUDED_DIRS.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        const relative = normalizeRepoPath(path.relative(root, absolute));
        const source = fs.readFileSync(absolute, 'utf8');
        for (const match of source.matchAll(/\/?fonts\/[A-Za-z0-9._/-]+\.woff2/g)) {
          const fontPath = normalizeRepoPath(match[0]);
          if (!references.has(fontPath)) references.set(fontPath, new Set());
          references.get(fontPath).add(relative);
        }
      }
    }
  }
  visit(root);
  return references;
}

export function verifyFontAssets({ root = ROOT, manifest = loadFontManifest(root), scanReferences = true } = {}) {
  validateManifestObject(manifest);
  const fontsDirectory = path.join(root, 'fonts');
  assert.ok(fs.existsSync(fontsDirectory) && fs.statSync(fontsDirectory).isDirectory(), 'fonts directory is missing');
  const actualFiles = walkFiles(fontsDirectory, { rejectSymlinks: true })
    .map((absolute) => normalizeRepoPath(path.relative(root, absolute)))
    .sort();
  const allowedFiles = new Set([MANIFEST_RELATIVE_PATH, ...manifest.assets.map((asset) => asset.path)]);
  const unexpected = actualFiles.filter((relative) => !allowedFiles.has(relative));
  assert.deepEqual(unexpected, [], `undeclared files in fonts directory: ${unexpected.join(', ')}`);
  const missing = [...allowedFiles].filter((relative) => !actualFiles.includes(relative));
  assert.deepEqual(missing, [], `manifest files missing from fonts directory: ${missing.join(', ')}`);

  const verified = [];
  for (const asset of manifest.assets) {
    const bytes = fs.readFileSync(path.join(root, asset.path));
    const header = validateWoff2Buffer(bytes, asset.path);
    assert.equal(header.bytes, asset.bytes, `${asset.path}: byte size mismatch`);
    assert.equal(header.sha256, asset.sha256, `${asset.path}: SHA-256 mismatch`);
    verified.push({ path: asset.path, bytes: header.bytes, sha256: header.sha256, numTables: header.numTables });
  }

  let references = [];
  if (scanReferences) {
    const declared = new Map(manifest.assets.map((asset) => [asset.path, asset]));
    const referenceMap = collectFontReferences(root);
    const unknownReferences = [...referenceMap.keys()].filter((fontPath) => !declared.has(fontPath));
    assert.deepEqual(unknownReferences, [], `font references are not declared in manifest: ${unknownReferences.join(', ')}`);
    const unreferenced = [...declared.keys()].filter((fontPath) => !referenceMap.has(fontPath));
    assert.deepEqual(unreferenced, [], `manifest fonts have no source reference: ${unreferenced.join(', ')}`);

    const faces = parseCssFontFaces(root);
    for (const [fontPath, asset] of declared) {
      const candidates = faces.get(fontPath) || [];
      assert.ok(candidates.length > 0, `${fontPath}: matching @font-face block is missing`);
      assert.ok(candidates.some((face) => face.family === asset.family && face.weight === asset.weight && face.style === asset.style), `${fontPath}: @font-face metadata does not match manifest`);
    }
    references = [...referenceMap.entries()].map(([fontPath, files]) => ({ fontPath, files: [...files].sort() })).sort((a, b) => a.fontPath.localeCompare(b.fontPath));
  }

  return {
    result: 'PASS',
    manifest: MANIFEST_RELATIVE_PATH,
    assets: verified,
    references,
    upstreamDrift: manifest.assets.filter((asset) => !asset.source.trackedMatch).map((asset) => asset.path),
  };
}

function normalizeContentType(value) {
  return String(value || '').split(';')[0].trim().toLowerCase();
}

export async function fetchExactFontSource(url, {
  fetchImpl = globalThis.fetch,
  allowedHosts = new Set(['fonts.gstatic.com']),
  maxRedirects = MAX_REDIRECTS,
  timeoutMs = 30000,
} = {}) {
  assert.equal(typeof fetchImpl, 'function', 'fetch implementation is required');
  let current = new URL(url);
  const redirects = [];
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    assert.equal(current.protocol, 'https:', `font source must use HTTPS: ${current}`);
    assert.ok(allowedHosts.has(current.hostname), `font source host is forbidden: ${current.hostname}`);
    const response = await fetchImpl(current, {
      redirect: 'manual',
      headers: { accept: 'font/woff2,application/font-woff2,application/octet-stream', 'user-agent': 'gb-font-generator/1.0' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      assert.ok(location, `font redirect lacks Location: ${current}`);
      const next = new URL(location, current);
      redirects.push({ status: response.status, from: current.href, to: next.href });
      current = next;
      continue;
    }
    assert.ok(response.status >= 200 && response.status < 300, `font source HTTP ${response.status}: ${current}`);
    const contentType = normalizeContentType(response.headers.get('content-type'));
    assert.ok(ALLOWED_FONT_CONTENT_TYPES.has(contentType), `font source content-type is forbidden: ${contentType || '(missing)'}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const header = validateWoff2Buffer(bytes, current.href);
    return { finalUrl: current.href, redirects, contentType, bytes, sha256: header.sha256 };
  }
  throw new Error(`font source exceeded ${maxRedirects} redirects: ${url}`);
}

function updateManifestForDownloadedAsset(asset, fetched, acceptUpstream) {
  const matchesPinned = fetched.bytes.length === asset.bytes && fetched.sha256 === asset.sha256;
  if (!matchesPinned && !acceptUpstream) {
    throw new Error(`${asset.path}: upstream drift; rerun only after review with --accept-upstream`);
  }
  const next = structuredClone(asset);
  if (acceptUpstream) {
    next.bytes = fetched.bytes.length;
    next.sha256 = fetched.sha256;
  }
  next.source.url = fetched.finalUrl;
  next.source.contentType = fetched.contentType;
  next.source.observedBytes = fetched.bytes.length;
  next.source.observedSha256 = fetched.sha256;
  next.source.trackedMatch = next.bytes === fetched.bytes.length && next.sha256 === fetched.sha256;
  next.source.status = next.source.trackedMatch ? 'verified-match' : 'upstream-drift';
  return next;
}

export async function generateFontAssets({
  root = ROOT,
  manifest = loadFontManifest(root),
  acceptUpstream = false,
  write = false,
  fetchImpl = globalThis.fetch,
} = {}) {
  validateManifestObject(manifest);
  const transactionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-font-generation-'));
  const stagedFonts = path.join(transactionRoot, 'fonts');
  fs.mkdirSync(stagedFonts, { recursive: true });
  const fetchedRecords = [];
  try {
    const nextManifest = structuredClone(manifest);
    for (let index = 0; index < manifest.assets.length; index += 1) {
      const asset = manifest.assets[index];
      const fetched = await fetchExactFontSource(asset.source.url, { fetchImpl });
      const nextAsset = updateManifestForDownloadedAsset(asset, fetched, acceptUpstream);
      nextManifest.assets[index] = nextAsset;
      const stagedPath = path.join(transactionRoot, asset.path);
      fs.mkdirSync(path.dirname(stagedPath), { recursive: true });
      fs.writeFileSync(stagedPath, fetched.bytes);
      fetchedRecords.push({ path: asset.path, bytes: fetched.bytes.length, sha256: fetched.sha256, changed: nextAsset.sha256 !== asset.sha256 });
    }
    validateManifestObject(nextManifest);
    fs.writeFileSync(path.join(stagedFonts, 'manifest.json'), `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
    verifyFontAssets({ root: transactionRoot, manifest: nextManifest, scanReferences: false });

    if (!write) return { result: 'DRY_RUN_PASS', acceptUpstream, files: fetchedRecords, manifest: nextManifest };

    const fontsPath = path.join(root, 'fonts');
    const backupPath = path.join(root, `.fonts-backup-${process.pid}-${Date.now()}`);
    fs.renameSync(fontsPath, backupPath);
    try {
      fs.renameSync(stagedFonts, fontsPath);
      fs.rmSync(backupPath, { recursive: true, force: true });
    } catch (error) {
      if (fs.existsSync(fontsPath)) fs.rmSync(fontsPath, { recursive: true, force: true });
      fs.renameSync(backupPath, fontsPath);
      throw error;
    }
    return { result: 'WRITE_PASS', acceptUpstream, files: fetchedRecords, manifest: nextManifest };
  } finally {
    fs.rmSync(transactionRoot, { recursive: true, force: true });
  }
}
