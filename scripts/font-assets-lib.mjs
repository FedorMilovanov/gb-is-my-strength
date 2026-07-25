#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MANIFEST_RELATIVE_PATH = 'fonts/manifest.json';
export const SUPPORT_MANIFEST_RELATIVE_PATH = 'fonts/support-manifest.json';
export const ALLOWED_FONT_CONTENT_TYPES = new Set([
  'font/woff2',
  'application/font-woff2',
  'application/octet-stream',
]);

const TEXT_EXTENSIONS = new Set(['.astro', '.css', '.html', '.js', '.jsx', '.md', '.mdx', '.mjs', '.ts', '.tsx']);
const REFERENCE_EXCLUDED_DIRS = new Set(['.git', '.astro', 'dist', 'images', 'node_modules', 'reports']);
const MAX_REDIRECTS = 5;
const MIN_FONT_BYTES = 1024;
const MAX_FONT_BYTES = 2_000_000;

function normalizeRepoPath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
}

function normalizeManifestPath(value) {
  const normalized = normalizeRepoPath(value);
  assert.equal(normalized, value, `${value}: manifest path must be normalized`);
  assert.equal(normalized.includes('..'), false, `${normalized}: parent traversal is forbidden`);
  return normalized;
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

export function validateSfntBuffer(bytes, label = 'sfnt font') {
  assert.ok(Buffer.isBuffer(bytes), `${label}: expected Buffer`);
  assert.ok(bytes.length >= 12, `${label}: truncated sfnt header`);
  const signature = bytes.subarray(0, 4);
  const isTrueType = signature.equals(Buffer.from([0x00, 0x01, 0x00, 0x00]));
  const isOpenType = signature.toString('ascii') === 'OTTO';
  assert.ok(isTrueType || isOpenType, `${label}: unsupported sfnt signature`);
  const numTables = bytes.readUInt16BE(4);
  assert.ok(numTables > 0 && numTables < 256, `${label}: invalid sfnt table count ${numTables}`);
  assert.ok(12 + numTables * 16 <= bytes.length, `${label}: truncated sfnt table directory`);
  const tags = new Set();
  for (let index = 0; index < numTables; index += 1) {
    const recordOffset = 12 + index * 16;
    const tag = bytes.subarray(recordOffset, recordOffset + 4).toString('ascii');
    const tableOffset = bytes.readUInt32BE(recordOffset + 8);
    const tableLength = bytes.readUInt32BE(recordOffset + 12);
    assert.match(tag, /^[\x20-\x7e]{4}$/, `${label}: invalid sfnt table tag`);
    assert.equal(tags.has(tag), false, `${label}: duplicate sfnt table ${tag}`);
    tags.add(tag);
    assert.ok(tableOffset <= bytes.length && tableLength <= bytes.length - tableOffset, `${label}: sfnt table ${tag} exceeds file`);
  }
  assert.ok(bytes.length >= MIN_FONT_BYTES && bytes.length <= MAX_FONT_BYTES, `${label}: implausible sfnt size ${bytes.length}`);
  return { bytes: bytes.length, sha256: sha256(bytes), numTables, flavor: isOpenType ? 'OTTO' : 'TrueType' };
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
    const assetPath = normalizeManifestPath(asset.path);
    assert.match(assetPath, /^fonts\/[A-Za-z0-9._/-]+\.woff2$/, `${assetPath}: invalid font path`);
    assert.equal(seen.has(assetPath), false, `${assetPath}: duplicate manifest path`);
    assert.ok(assetPath.localeCompare(previousPath) >= 0, `${assetPath}: manifest assets must be sorted`);
    seen.add(assetPath);
    previousPath = assetPath;
    assert.ok(typeof asset.family === 'string' && asset.family.trim(), `${assetPath}: family is missing`);
    assert.ok(Number.isInteger(asset.weight) && asset.weight >= 100 && asset.weight <= 900, `${assetPath}: invalid weight`);
    assert.ok(['normal', 'italic'].includes(asset.style), `${assetPath}: invalid style`);
    assert.match(asset.subset, /^[a-z0-9-]+$/, `${assetPath}: invalid subset`);
    assert.ok(Number.isSafeInteger(asset.bytes) && asset.bytes >= MIN_FONT_BYTES && asset.bytes <= MAX_FONT_BYTES, `${assetPath}: invalid byte size`);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/, `${assetPath}: invalid SHA-256`);
    validateSource(asset.source, assetPath);
    const sourceMatchesPinned = asset.source.observedBytes === asset.bytes && asset.source.observedSha256 === asset.sha256;
    assert.equal(asset.source.trackedMatch, sourceMatchesPinned, `${assetPath}: trackedMatch does not reflect observed upstream bytes`);
  }
  return manifest;
}

export function validateSupportManifestObject(manifest) {
  assert.ok(manifest && typeof manifest === 'object' && !Array.isArray(manifest), 'font support manifest must be an object');
  assert.equal(manifest.schemaVersion, 1, 'font support manifest schemaVersion must be 1');
  assert.equal(manifest.policy, 'offline-pinned-support', 'font support manifest policy drifted');
  assert.ok(Array.isArray(manifest.fontFaceOverrides), 'font face overrides must be an array');
  assert.ok(Array.isArray(manifest.supportAssets), 'font support assets must be an array');

  const overridePaths = new Set();
  let previousOverridePath = '';
  for (const override of manifest.fontFaceOverrides) {
    assert.ok(override && typeof override === 'object' && !Array.isArray(override), 'font face override must be an object');
    const overridePath = normalizeManifestPath(override.path);
    assert.match(overridePath, /^fonts\/[A-Za-z0-9._/-]+\.woff2$/, `${overridePath}: invalid font face override path`);
    assert.equal(overridePaths.has(overridePath), false, `${overridePath}: duplicate font face override`);
    assert.ok(overridePath.localeCompare(previousOverridePath) >= 0, `${overridePath}: font face overrides must be sorted`);
    overridePaths.add(overridePath);
    previousOverridePath = overridePath;
    assert.ok(typeof override.family === 'string' && override.family.trim(), `${overridePath}: override family is missing`);
  }

  const seen = new Set();
  let previousPath = '';
  for (const asset of manifest.supportAssets) {
    assert.ok(asset && typeof asset === 'object' && !Array.isArray(asset), 'font support asset must be an object');
    const assetPath = normalizeManifestPath(asset.path);
    assert.match(assetPath, /^fonts\/[A-Za-z0-9._/-]+\.(?:css|ttf|otf)$/, `${assetPath}: invalid support path`);
    assert.equal(seen.has(assetPath), false, `${assetPath}: duplicate support path`);
    assert.ok(assetPath.localeCompare(previousPath) >= 0, `${assetPath}: support assets must be sorted`);
    seen.add(assetPath);
    previousPath = assetPath;
    assert.ok(['css', 'sfnt'].includes(asset.kind), `${assetPath}: invalid support kind`);
    assert.ok(typeof asset.role === 'string' && asset.role.trim(), `${assetPath}: support role is missing`);
    assert.ok(Number.isSafeInteger(asset.bytes) && asset.bytes > 0 && asset.bytes <= MAX_FONT_BYTES, `${assetPath}: invalid support byte size`);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/, `${assetPath}: invalid support SHA-256`);
    if (asset.kind === 'sfnt') {
      assert.ok(typeof asset.family === 'string' && asset.family.trim(), `${assetPath}: sfnt family is missing`);
      assert.ok(Number.isInteger(asset.weight) && asset.weight >= 100 && asset.weight <= 900, `${assetPath}: invalid sfnt weight`);
      assert.ok(['normal', 'italic'].includes(asset.style), `${assetPath}: invalid sfnt style`);
    }
  }
  return manifest;
}

export function loadFontManifest(root = ROOT) {
  const manifestPath = path.join(root, MANIFEST_RELATIVE_PATH);
  assert.ok(fs.existsSync(manifestPath), `font manifest is missing: ${MANIFEST_RELATIVE_PATH}`);
  return validateManifestObject(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
}

export function loadFontSupportManifest(root = ROOT) {
  const manifestPath = path.join(root, SUPPORT_MANIFEST_RELATIVE_PATH);
  assert.ok(fs.existsSync(manifestPath), `font support manifest is missing: ${SUPPORT_MANIFEST_RELATIVE_PATH}`);
  return validateSupportManifestObject(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
}

function resolveLocalReference(rawValue, sourceRelativePath) {
  const raw = String(rawValue || '').trim().replace(/[?#].*$/, '');
  if (!raw || /^(?:data:|https?:|\/\/)/i.test(raw)) return null;
  const resolved = raw.startsWith('/')
    ? normalizeRepoPath(raw)
    : normalizeRepoPath(path.posix.normalize(path.posix.join(path.posix.dirname(sourceRelativePath), raw)));
  return resolved.startsWith('fonts/') ? resolved : null;
}

function parseCssFontFaces(root) {
  const faces = new Map();
  for (const absolute of walkFiles(root)) {
    if (path.extname(absolute).toLowerCase() !== '.css') continue;
    const relative = normalizeRepoPath(path.relative(root, absolute));
    if (relative.startsWith('dist/') || relative.startsWith('node_modules/')) continue;
    const source = fs.readFileSync(absolute, 'utf8');
    for (const block of source.match(/@font-face\s*\{[\s\S]*?\}/gi) || []) {
      const familyMatch = block.match(/font-family\s*:\s*(['"])(.*?)\1\s*;/i) || block.match(/font-family\s*:\s*([^;]+);/i);
      const weightMatch = block.match(/font-weight\s*:\s*(\d{3})\s*;/i);
      const styleMatch = block.match(/font-style\s*:\s*(normal|italic)\s*;/i);
      const family = familyMatch ? String(familyMatch[2] || familyMatch[1]).trim().replace(/^['"]|['"]$/g, '') : '';
      for (const urlMatch of block.matchAll(/url\(\s*(['"]?)([^)'"\s]+\.(?:woff2|ttf|otf)(?:[?#][^)'"\s]*)?)\1\s*\)/gi)) {
        const assetPath = resolveLocalReference(urlMatch[2], relative);
        if (!assetPath) continue;
        const record = {
          file: relative,
          family,
          weight: weightMatch ? Number(weightMatch[1]) : null,
          style: styleMatch ? styleMatch[1].toLowerCase() : null,
        };
        if (!faces.has(assetPath)) faces.set(assetPath, []);
        faces.get(assetPath).push(record);
      }
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
        for (const match of source.matchAll(/(['"])([^'"\s)]+\.(?:woff2|ttf|otf)(?:[?#][^'"\s)]*)?)\1/g)) {
          const assetPath = resolveLocalReference(match[2], relative);
          if (!assetPath) continue;
          if (!references.has(assetPath)) references.set(assetPath, new Set());
          references.get(assetPath).add(relative);
        }
      }
    }
  }
  visit(root);
  return references;
}

function validateCssSupport(bytes, label) {
  const text = bytes.toString('utf8');
  assert.equal(text.includes('\uFFFD'), false, `${label}: invalid UTF-8 replacement character`);
  assert.match(text, /@font-face\s*\{/i, `${label}: font-face registry is empty`);
  assert.doesNotMatch(text, /url\(\s*['"]?https?:/i, `${label}: remote font URL is forbidden`);
  return { bytes: bytes.length, sha256: sha256(bytes), fontFaceCount: (text.match(/@font-face\s*\{/gi) || []).length };
}

export function verifyFontAssets({
  root = ROOT,
  manifest = loadFontManifest(root),
  supportManifest = loadFontSupportManifest(root),
  scanReferences = true,
} = {}) {
  validateManifestObject(manifest);
  validateSupportManifestObject(supportManifest);
  const fontsDirectory = path.join(root, 'fonts');
  assert.ok(fs.existsSync(fontsDirectory) && fs.statSync(fontsDirectory).isDirectory(), 'fonts directory is missing');
  const actualFiles = walkFiles(fontsDirectory, { rejectSymlinks: true })
    .map((absolute) => normalizeRepoPath(path.relative(root, absolute)))
    .sort();
  const allowedFiles = new Set([
    MANIFEST_RELATIVE_PATH,
    SUPPORT_MANIFEST_RELATIVE_PATH,
    ...manifest.assets.map((asset) => asset.path),
    ...supportManifest.supportAssets.map((asset) => asset.path),
  ]);
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
    verified.push({ path: asset.path, kind: 'woff2', bytes: header.bytes, sha256: header.sha256, numTables: header.numTables });
  }

  const verifiedSupport = [];
  for (const asset of supportManifest.supportAssets) {
    const bytes = fs.readFileSync(path.join(root, asset.path));
    const result = asset.kind === 'sfnt' ? validateSfntBuffer(bytes, asset.path) : validateCssSupport(bytes, asset.path);
    assert.equal(result.bytes, asset.bytes, `${asset.path}: support byte size mismatch`);
    assert.equal(result.sha256, asset.sha256, `${asset.path}: support SHA-256 mismatch`);
    verifiedSupport.push({ path: asset.path, kind: asset.kind, ...result });
  }

  let references = [];
  if (scanReferences) {
    const declaredFonts = new Map(manifest.assets.map((asset) => [asset.path, asset]));
    const declaredSupportFonts = new Map(supportManifest.supportAssets.filter((asset) => asset.kind === 'sfnt').map((asset) => [asset.path, asset]));
    const declaredAllFonts = new Map([...declaredFonts, ...declaredSupportFonts]);
    const overrideFamilies = new Map(supportManifest.fontFaceOverrides.map((override) => [override.path, override.family]));
    const unknownOverrides = [...overrideFamilies.keys()].filter((fontPath) => !declaredFonts.has(fontPath));
    assert.deepEqual(unknownOverrides, [], `font face overrides target undeclared WOFF2 assets: ${unknownOverrides.join(', ')}`);

    const referenceMap = collectFontReferences(root);
    const unknownReferences = [...referenceMap.keys()].filter((fontPath) => !declaredAllFonts.has(fontPath));
    assert.deepEqual(unknownReferences, [], `font references are not declared in manifests: ${unknownReferences.join(', ')}`);
    const unreferenced = [...declaredAllFonts.keys()].filter((fontPath) => !referenceMap.has(fontPath));
    assert.deepEqual(unreferenced, [], `manifest fonts have no source reference: ${unreferenced.join(', ')}`);

    const faces = parseCssFontFaces(root);
    for (const [fontPath, asset] of declaredAllFonts) {
      const candidates = faces.get(fontPath) || [];
      const expectedFamily = overrideFamilies.get(fontPath) || asset.family;
      assert.ok(candidates.length > 0, `${fontPath}: matching @font-face block is missing`);
      assert.ok(candidates.some((face) => face.family === expectedFamily && face.weight === asset.weight && face.style === asset.style), `${fontPath}: @font-face metadata does not match manifest`);
    }

    const registryAssets = supportManifest.supportAssets.filter((asset) => asset.role === 'font-face-registry');
    assert.equal(registryAssets.length, 1, 'exactly one font-face registry support asset is required');
    const registryPath = registryAssets[0].path;
    const registryFaces = [...faces.entries()].filter(([, candidates]) => candidates.some((candidate) => candidate.file === registryPath));
    const registryPaths = new Set(registryFaces.map(([fontPath]) => fontPath));
    const missingFromRegistry = [...declaredAllFonts.keys()].filter((fontPath) => !registryPaths.has(fontPath));
    assert.deepEqual(missingFromRegistry, [], `font-face registry omits manifest fonts: ${missingFromRegistry.join(', ')}`);

    references = [...referenceMap.entries()]
      .map(([fontPath, files]) => ({ fontPath, files: [...files].sort() }))
      .sort((a, b) => a.fontPath.localeCompare(b.fontPath));
  }

  return {
    result: 'PASS',
    manifest: MANIFEST_RELATIVE_PATH,
    supportManifest: SUPPORT_MANIFEST_RELATIVE_PATH,
    assets: verified,
    supportAssets: verifiedSupport,
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
  supportManifest = loadFontSupportManifest(root),
  acceptUpstream = false,
  write = false,
  fetchImpl = globalThis.fetch,
} = {}) {
  validateManifestObject(manifest);
  validateSupportManifestObject(supportManifest);
  const transactionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gb-font-generation-'));
  const stagedFonts = path.join(transactionRoot, 'fonts');
  fs.mkdirSync(stagedFonts, { recursive: true });
  const fetchedRecords = [];
  try {
    const nextManifest = structuredClone(manifest);

    for (const supportAsset of supportManifest.supportAssets) {
      const sourcePath = path.join(root, supportAsset.path);
      const bytes = fs.readFileSync(sourcePath);
      const verified = supportAsset.kind === 'sfnt' ? validateSfntBuffer(bytes, supportAsset.path) : validateCssSupport(bytes, supportAsset.path);
      assert.equal(verified.bytes, supportAsset.bytes, `${supportAsset.path}: support byte size mismatch before staging`);
      assert.equal(verified.sha256, supportAsset.sha256, `${supportAsset.path}: support SHA-256 mismatch before staging`);
      const stagedPath = path.join(transactionRoot, supportAsset.path);
      fs.mkdirSync(path.dirname(stagedPath), { recursive: true });
      fs.writeFileSync(stagedPath, bytes);
    }

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
    fs.writeFileSync(path.join(stagedFonts, 'support-manifest.json'), `${JSON.stringify(supportManifest, null, 2)}\n`, 'utf8');
    verifyFontAssets({ root: transactionRoot, manifest: nextManifest, supportManifest, scanReferences: false });

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
