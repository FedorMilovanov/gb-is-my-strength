'use strict';

const fs = require('fs');
const path = require('path');

// This is a source-kind contract, not a route allowlist. Product code is
// discovered from the repository tree; only root tooling/evidence/build outputs
// are excluded. A product-owned nested directory must never disappear merely
// because it happens to be named "docs", "audit", "build", etc.
const EXCLUDED_DIR_NAMES = new Set([
  '.git', '.github', '.astro', 'node_modules', 'dist', 'out', 'build', 'coverage',
  'reports', 'audit', 'scripts', 'docs', 'migration', 'tools', 'pagefind',
]);

const CONTROL_EXTENSIONS = new Set([
  '.html', '.astro', '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mdx',
]);

const RESOURCE_EXTENSIONS = new Set([
  ...CONTROL_EXTENSIONS,
  '.json', '.css',
]);

const DOCUMENTATION_EXTENSIONS = new Set(['.md', '.txt', '.rst', '.adoc']);
const CONTROL_SIGNAL_RE = /<button\b|(?:document\s*\.\s*)?createElement\s*\(\s*['"`]button['"`]\s*\)/i;
const STREAM_PROBE_CHUNK_BYTES = 64 * 1024;

function repoRel(root, file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function shouldExcludeRelative(relative) {
  const [rootSegment] = String(relative || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean);
  return Boolean(rootSegment && EXCLUDED_DIR_NAMES.has(rootSegment));
}

function isInsideRoot(root, candidate) {
  const normalizedRoot = path.resolve(root);
  const normalizedCandidate = path.resolve(candidate);
  return normalizedCandidate === normalizedRoot
    || normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`);
}

function validateInternalSymlink(root, link, relative) {
  let resolved;
  try { resolved = fs.realpathSync(link); }
  catch (error) {
    throw new Error(`source-surface symlink is broken (${relative}): ${error.message}`);
  }
  if (!isInsideRoot(root, resolved)) {
    throw new Error(`source-surface symlink escapes repository root: ${relative} -> ${resolved}`);
  }
  const targetRelative = repoRel(root, resolved);
  if (shouldExcludeRelative(targetRelative)) {
    throw new Error(`source-surface symlink aliases excluded root: ${relative} -> ${targetRelative}`);
  }
  return targetRelative;
}

function walkRepository(root, dir = root, output = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const relative = repoRel(root, full);
    if (entry.isDirectory()) {
      if (!shouldExcludeRelative(relative)) walkRepository(root, full, output);
      continue;
    }
    if (shouldExcludeRelative(relative)) continue;
    if (entry.isSymbolicLink()) {
      // Internal tracked aliases are valid repository structure, but following
      // them here would double-count the canonical target and can create cycles.
      // Validate containment/authority and let the real target be visited once
      // through its canonical repository path.
      validateInternalSymlink(root, full, relative);
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(`source-surface corpus requires regular files: ${relative}`);
    }
    output.push(full);
  }
  return output;
}

function sourceKind(file) {
  return path.extname(file).toLowerCase();
}

function isDocumentationOnly(root, file) {
  const extension = sourceKind(file);
  if (!DOCUMENTATION_EXTENSIONS.has(extension)) return false;
  const relative = repoRel(root, file);
  // src/**/*.md is a potential published-content class and must not be
  // dismissed as documentation without an explicit source-kind decision.
  return !relative.startsWith('src/');
}

function collectProductSourceSurfaces(root) {
  const files = walkRepository(root);
  return {
    controlFiles: files.filter((file) => CONTROL_EXTENSIONS.has(sourceKind(file))).sort(),
    resourceFiles: files.filter((file) => RESOURCE_EXTENSIONS.has(sourceKind(file))).sort(),
    allFiles: files.sort(),
  };
}

function readDeclaredTextSource(file, relative = file) {
  let stat;
  try { stat = fs.statSync(file); }
  catch (error) {
    throw new Error(`declared source unreadable (${relative}): ${error.message}`);
  }
  if (!stat.isFile()) throw new Error(`declared source is not a regular file: ${relative}`);

  let value;
  try { value = fs.readFileSync(file, 'utf8'); }
  catch (error) {
    throw new Error(`declared source cannot be decoded (${relative}): ${error.message}`);
  }
  if (value.includes('\u0000')) {
    throw new Error(`declared source contains NUL/binary data: ${relative}`);
  }
  return value;
}

function createChunkPatternProbe(pattern, overlap = 512) {
  const flags = pattern.flags.replace(/g/g, '');
  const stablePattern = new RegExp(pattern.source, flags);
  let carry = '';
  return (chunk) => {
    const text = carry + String(chunk || '');
    stablePattern.lastIndex = 0;
    const matched = stablePattern.test(text);
    carry = text.slice(-Math.max(1, overlap));
    return matched;
  };
}

function streamFileHasPattern(file, pattern, options = {}) {
  const relative = options.relative || file;
  const overlap = options.overlap || 512;
  let stat;
  try { stat = fs.statSync(file); }
  catch (error) {
    throw new Error(`unclassified source probe unreadable (${relative}): ${error.message}`);
  }
  if (!stat.isFile()) throw new Error(`unclassified source probe is not a regular file: ${relative}`);

  let fd;
  try { fd = fs.openSync(file, 'r'); }
  catch (error) {
    throw new Error(`unclassified source probe cannot open (${relative}): ${error.message}`);
  }

  const buffer = Buffer.allocUnsafe(STREAM_PROBE_CHUNK_BYTES);
  const probe = createChunkPatternProbe(pattern, overlap);
  try {
    while (true) {
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (!bytesRead) return false;
      // All producer sentinels are ASCII. latin1 keeps byte identity across
      // arbitrary UTF-8/binary chunks without allocating the whole file.
      const chunk = buffer.subarray(0, bytesRead).toString('latin1');
      if (probe(chunk)) return true;
      // A NUL proves this is binary for our text-source purposes. Stop after
      // checking the same chunk so a signal immediately before NUL is not lost.
      if (chunk.includes('\u0000')) return false;
    }
  } catch (error) {
    throw new Error(`unclassified source probe failed (${relative}): ${error.message}`);
  } finally {
    try { fs.closeSync(fd); } catch { /* best-effort close after deterministic result */ }
  }
}

function countControlSignals(source) {
  const text = String(source || '');
  const staticButtons = (text.match(/<button\b/gi) || []).length;
  const dynamicButtonFactories = (text.match(/(?:document\s*\.\s*)?createElement\s*\(\s*['"`]button['"`]\s*\)/gi) || []).length;
  return {
    staticButtons,
    dynamicButtonFactories,
    total: staticButtons + dynamicButtonFactories,
  };
}

function auditControlSurfaceCorpus(root, surfaces = collectProductSourceSurfaces(root)) {
  const included = new Set(surfaces.controlFiles.map((file) => path.resolve(file)));
  const producerFiles = [];
  const unclassified = [];
  let staticButtons = 0;
  let dynamicButtonFactories = 0;
  let jsFamilyControls = 0;

  for (const file of surfaces.allFiles) {
    const resolved = path.resolve(file);
    const isIncluded = included.has(resolved);
    const relative = repoRel(root, file);
    const extension = sourceKind(file);

    if (!isIncluded) {
      // JSON/CSS are already explicitly classified as resource-only source
      // kinds. A literal "<button" inside data or CSS text is not evidence of
      // an omitted DOM producer class. Only genuinely unknown source kinds are
      // probed for producer sentinels here.
      if (RESOURCE_EXTENSIONS.has(extension)) continue;
      if (isDocumentationOnly(root, file)) continue;
      if (streamFileHasPattern(file, CONTROL_SIGNAL_RE, { relative })) {
        unclassified.push({ file, relative, extension, signal: 'button-producer' });
      }
      continue;
    }

    const source = readDeclaredTextSource(file, relative);
    if (!CONTROL_SIGNAL_RE.test(source)) continue;
    const counts = countControlSignals(source);
    const record = { file, relative, extension, ...counts };
    producerFiles.push(record);
    staticButtons += counts.staticButtons;
    dynamicButtonFactories += counts.dynamicButtonFactories;
    if (['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'].includes(extension)) {
      jsFamilyControls += counts.total;
    }
  }

  return {
    producerFiles,
    unclassified,
    staticButtons,
    dynamicButtonFactories,
    jsFamilyControls,
    totalControls: staticButtons + dynamicButtonFactories,
  };
}

function escapeRe(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function versionLiteralPattern(asset, captureValue = false) {
  const token = "[^\\s\"'`&}>),;]+";
  return new RegExp(
    `${escapeRe(asset)}\\?v=${captureValue ? `(${token})` : token}`,
    'gi',
  );
}

function governedVersionProducerPattern(assets) {
  const values = [...new Set(assets.filter(Boolean))];
  if (!values.length) return /$a/;
  return new RegExp(`(?:${values.map(escapeRe).join('|')})\\?v=`, 'i');
}

function scanGovernedVersionLiterals(source, assets, expectedHashes) {
  const findings = [];
  const text = String(source || '');
  for (const asset of assets) {
    const expected = expectedHashes[asset];
    if (!expected) continue;
    const pattern = versionLiteralPattern(asset, true);
    for (const match of text.matchAll(pattern)) {
      const actual = String(match[1]).toLowerCase();
      if (actual !== String(expected).toLowerCase()) {
        findings.push({ asset, expected, actual, index: match.index });
      }
    }
  }
  return findings;
}

function countGovernedVersionLiterals(source, assets) {
  const text = String(source || '');
  let count = 0;
  for (const asset of assets) count += (text.match(versionLiteralPattern(asset)) || []).length;
  return count;
}

function auditGovernedResourceVersions(
  root,
  assets,
  expectedHashes,
  surfaces = collectProductSourceSurfaces(root),
  options = {},
) {
  const included = new Set(surfaces.resourceFiles.map((file) => path.resolve(file)));
  const skipExtensions = new Set(options.skipExtensions || []);
  const stale = [];
  const unclassified = [];
  let checkedVersionedLiterals = 0;
  const unknownPattern = governedVersionProducerPattern(assets);
  const unknownOverlap = Math.max(64, ...assets.map((asset) => String(asset).length + 32));

  for (const file of surfaces.allFiles) {
    const extension = sourceKind(file);
    if (skipExtensions.has(extension)) continue;
    const resolved = path.resolve(file);
    const isIncluded = included.has(resolved);
    const relative = repoRel(root, file);

    if (!isIncluded) {
      if (isDocumentationOnly(root, file)) continue;
      if (streamFileHasPattern(file, unknownPattern, { relative, overlap: unknownOverlap })) {
        unclassified.push({ file, relative, extension, signal: 'governed-version-producer' });
      }
      continue;
    }

    const source = readDeclaredTextSource(file, relative);
    const literalCount = countGovernedVersionLiterals(source, assets);
    if (!literalCount) continue;
    checkedVersionedLiterals += literalCount;
    for (const finding of scanGovernedVersionLiterals(source, assets, expectedHashes)) {
      stale.push({ ...finding, file, relative, extension });
    }
  }

  return { stale, unclassified, checkedVersionedLiterals };
}

function assertSourceSurfaceMutationContract() {
  const requiredControlKinds = ['.html', '.astro', '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mdx'];
  const missingKinds = requiredControlKinds.filter((ext) => !CONTROL_EXTENSIONS.has(ext));
  if (missingKinds.length) throw new Error(`source-surface contract omitted control source kinds: ${missingKinds.join(', ')}`);

  for (const rel of ['scripts/tool.js', 'docs/audit.md', '.github/workflows/check.yml']) {
    if (!shouldExcludeRelative(rel)) throw new Error(`source-surface root tooling boundary leaked: ${rel}`);
  }
  for (const rel of ['src/docs/runtime.js', 'src/components/audit/Button.astro', 'src/build/widget.ts']) {
    if (shouldExcludeRelative(rel)) throw new Error(`source-surface nested Product directory was hidden: ${rel}`);
  }

  if (!isInsideRoot('/repo', '/repo/public/images/example.webp')) {
    throw new Error('source-surface internal symlink containment contract rejected an in-repo target');
  }
  if (isInsideRoot('/repo', '/outside/example.webp')) {
    throw new Error('source-surface symlink containment contract accepted an external target');
  }

  for (const extension of ['.json', '.css']) {
    if (!RESOURCE_EXTENSIONS.has(extension) || CONTROL_EXTENSIONS.has(extension)) {
      throw new Error(`source-surface resource-only classification regressed for ${extension}`);
    }
  }
  if (RESOURCE_EXTENSIONS.has('.svelte') || CONTROL_EXTENSIONS.has('.svelte')) {
    throw new Error('source-surface unknown producer class was silently preclassified');
  }

  const controls = [
    '<button type="button">A</button>',
    'const a = `<button type="button">B</button>`;',
    "const b = document.createElement('button');",
    'const c = createElement("button");',
    'const d = document.createElement(`button`);',
  ].join('\n');
  const counts = countControlSignals(controls);
  if (counts.staticButtons !== 2 || counts.dynamicButtonFactories !== 3 || counts.total !== 5) {
    throw new Error(`source-surface control mutation survived: ${JSON.stringify(counts)}`);
  }

  const splitControl = createChunkPatternProbe(CONTROL_SIGNAL_RE, 128);
  if (splitControl('document.createEle')) {
    throw new Error('source-surface chunk probe produced an early control false positive');
  }
  if (!splitControl("ment('button')")) {
    throw new Error('source-surface chunk boundary hid an omitted control source class');
  }

  const assets = ['js/search.js'];
  const hashes = { 'js/search.js': '1234abcd' };
  const stale = scanGovernedVersionLiterals("script.src='/js/search.js?v=deadbeef'", assets, hashes);
  if (stale.length !== 1 || stale[0].actual !== 'deadbeef') {
    throw new Error('source-surface stale JS resource mutation survived');
  }
  const malformed = scanGovernedVersionLiterals("script.src='/js/search.js?v=oops'", assets, hashes);
  if (malformed.length !== 1 || malformed[0].actual !== 'oops') {
    throw new Error('source-surface malformed revision mutation survived');
  }
  const exact = scanGovernedVersionLiterals("script.src='/js/search.js?v=1234abcd'", assets, hashes);
  if (exact.length) throw new Error('source-surface exact JS resource literal was rejected');

  const splitResource = createChunkPatternProbe(governedVersionProducerPattern(assets), 128);
  if (splitResource('prefix /js/sea')) {
    throw new Error('source-surface chunk probe produced an early resource false positive');
  }
  if (!splitResource('rch.js?v=deadbeef')) {
    throw new Error('source-surface chunk boundary hid an omitted resource source class');
  }

  const helperInput = "assetUrl('js/search.js')";
  if (scanGovernedVersionLiterals(helperInput, assets, hashes).length) {
    throw new Error('source-surface scanner confused canonical helper input with a versioned public URL');
  }

  if (!isDocumentationOnly('/repo', '/repo/AGENTS-REFERENCE.md')) {
    throw new Error('source-surface contract failed to distinguish root documentation');
  }
  if (isDocumentationOnly('/repo', '/repo/src/content/example.md')) {
    throw new Error('source-surface contract silently exempted src Markdown publishing source');
  }

  const originalRead = fs.readFileSync;
  const originalStat = fs.statSync;
  try {
    fs.statSync = () => ({ isFile: () => true, size: 64 });
    fs.readFileSync = (file) => {
      if (file.includes('binary')) return 'prefix\u0000suffix';
      if (file.endsWith('.astro')) return '<script src="/js/search.js?v=deadbeef"></script>';
      return "script.src='/js/search.js?v=deadbeef'; document.createElement('button')";
    };

    const syntheticSurfaces = {
      resourceFiles: ['/repo/page.astro', '/repo/js/runtime.js'],
      allFiles: ['/repo/page.astro', '/repo/js/runtime.js'],
    };
    const additive = auditGovernedResourceVersions(
      '/repo', assets, hashes, syntheticSurfaces, { skipExtensions: ['.html', '.astro'] },
    );
    if (additive.stale.length !== 1 || additive.stale[0].extension !== '.js') {
      throw new Error('source-surface additive resource ownership mutation survived');
    }

    let binaryFailure = null;
    try {
      auditControlSurfaceCorpus('/repo', {
        controlFiles: ['/repo/js/binary-runtime.js'],
        allFiles: ['/repo/js/binary-runtime.js'],
      });
    } catch (error) {
      binaryFailure = error;
    }
    if (!binaryFailure || !/contains NUL\/binary data/.test(String(binaryFailure.message))) {
      throw new Error('source-surface binary declared source mutation survived');
    }
  } finally {
    fs.readFileSync = originalRead;
    fs.statSync = originalStat;
  }
}

module.exports = {
  EXCLUDED_DIR_NAMES,
  CONTROL_EXTENSIONS,
  RESOURCE_EXTENSIONS,
  DOCUMENTATION_EXTENSIONS,
  CONTROL_SIGNAL_RE,
  STREAM_PROBE_CHUNK_BYTES,
  shouldExcludeRelative,
  isInsideRoot,
  validateInternalSymlink,
  isDocumentationOnly,
  collectProductSourceSurfaces,
  readDeclaredTextSource,
  createChunkPatternProbe,
  streamFileHasPattern,
  countControlSignals,
  auditControlSurfaceCorpus,
  scanGovernedVersionLiterals,
  countGovernedVersionLiterals,
  auditGovernedResourceVersions,
  assertSourceSurfaceMutationContract,
};