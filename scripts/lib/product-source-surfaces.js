'use strict';

const fs = require('fs');
const path = require('path');

// This is a source-kind contract, not a route allowlist. Product code is
// discovered from the repository tree; only tooling/evidence/build outputs are
// excluded. New files in product-owned directories enter the census
// automatically.
const EXCLUDED_DIR_NAMES = new Set([
  '.git', '.astro', 'node_modules', 'dist', 'out', 'build', 'coverage',
  'reports', 'audit', 'scripts', 'docs', 'migration', 'tools', 'pagefind',
]);

const CONTROL_EXTENSIONS = new Set([
  '.html', '.astro', '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mdx',
]);

const RESOURCE_EXTENSIONS = new Set([
  ...CONTROL_EXTENSIONS,
  '.json', '.css',
]);

// Plain documentation may legitimately mention implementation URLs or markup
// as evidence. It is not a runtime producer. Markdown under src/ is treated
// differently: if it ever starts producing controls/resources, the census
// fails until that source class is explicitly admitted rather than silently
// ignoring a new publishing path.
const DOCUMENTATION_EXTENSIONS = new Set(['.md', '.txt', '.rst', '.adoc']);
const CONTROL_SIGNAL_RE = /<button\b|(?:document\s*\.\s*)?createElement\s*\(\s*['"]button['"]\s*\)/i;

function repoRel(root, file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function shouldExcludeRelative(relative) {
  const parts = String(relative || '').replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.some((part) => EXCLUDED_DIR_NAMES.has(part));
}

function walkRepository(root, dir = root, output = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const relative = repoRel(root, full);
    if (entry.isDirectory()) {
      if (!shouldExcludeRelative(relative)) walkRepository(root, full, output);
      continue;
    }
    if (!shouldExcludeRelative(relative)) output.push(full);
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

function readTextIfReasonable(file) {
  let stat;
  try { stat = fs.statSync(file); }
  catch { return null; }
  // Source producers should not be multi-megabyte opaque blobs. Keep the
  // classifier deterministic and avoid decoding archives/media.
  if (!stat.isFile() || stat.size > 2_000_000) return null;
  let value;
  try { value = fs.readFileSync(file, 'utf8'); }
  catch { return null; }
  if (value.includes('\u0000')) return null;
  return value;
}

function countControlSignals(source) {
  const text = String(source || '');
  const staticButtons = (text.match(/<button\b/gi) || []).length;
  const dynamicButtonFactories = (text.match(/(?:document\s*\.\s*)?createElement\s*\(\s*['"]button['"]\s*\)/gi) || []).length;
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
    const source = readTextIfReasonable(file);
    if (!source || !CONTROL_SIGNAL_RE.test(source)) continue;
    if (!included.has(path.resolve(file)) && isDocumentationOnly(root, file)) continue;

    const counts = countControlSignals(source);
    const record = {
      file,
      relative: repoRel(root, file),
      extension: sourceKind(file),
      ...counts,
    };
    if (!included.has(path.resolve(file))) {
      unclassified.push(record);
      continue;
    }
    producerFiles.push(record);
    staticButtons += counts.staticButtons;
    dynamicButtonFactories += counts.dynamicButtonFactories;
    if (['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'].includes(record.extension)) {
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

function versionLiteralPattern(asset, captureHash = false) {
  return new RegExp(
    `${escapeRe(asset)}\\?v=${captureHash ? '([a-f0-9]{8})' : '[a-f0-9]{8}'}(?![a-f0-9])`,
    'gi',
  );
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

function auditGovernedResourceVersions(root, assets, expectedHashes, surfaces = collectProductSourceSurfaces(root)) {
  const included = new Set(surfaces.resourceFiles.map((file) => path.resolve(file)));
  const stale = [];
  const unclassified = [];
  let checkedVersionedLiterals = 0;

  for (const file of surfaces.allFiles) {
    const source = readTextIfReasonable(file);
    if (!source) continue;
    const literalCount = countGovernedVersionLiterals(source, assets);
    if (!literalCount) continue;

    const isIncluded = included.has(path.resolve(file));
    if (!isIncluded && isDocumentationOnly(root, file)) continue;
    if (!isIncluded) {
      unclassified.push({ file, relative: repoRel(root, file), extension: sourceKind(file) });
      continue;
    }

    checkedVersionedLiterals += literalCount;
    for (const finding of scanGovernedVersionLiterals(source, assets, expectedHashes)) {
      stale.push({ ...finding, file, relative: repoRel(root, file) });
    }
  }

  return { stale, unclassified, checkedVersionedLiterals };
}

function assertSourceSurfaceMutationContract() {
  const requiredControlKinds = ['.html', '.astro', '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mdx'];
  const missingKinds = requiredControlKinds.filter((ext) => !CONTROL_EXTENSIONS.has(ext));
  if (missingKinds.length) throw new Error(`source-surface contract omitted control source kinds: ${missingKinds.join(', ')}`);

  const controls = [
    '<button type="button">A</button>',
    'const a = `<button type="button">B</button>`;',
    "const b = document.createElement('button');",
    'const c = createElement("button");',
  ].join('\n');
  const counts = countControlSignals(controls);
  if (counts.staticButtons !== 2 || counts.dynamicButtonFactories !== 2 || counts.total !== 4) {
    throw new Error(`source-surface control mutation survived: ${JSON.stringify(counts)}`);
  }

  const assets = ['js/search.js'];
  const hashes = { 'js/search.js': '1234abcd' };
  const stale = scanGovernedVersionLiterals("script.src='/js/search.js?v=deadbeef'", assets, hashes);
  if (stale.length !== 1 || stale[0].actual !== 'deadbeef') {
    throw new Error('source-surface stale JS resource mutation survived');
  }
  const exact = scanGovernedVersionLiterals("script.src='/js/search.js?v=1234abcd'", assets, hashes);
  if (exact.length) throw new Error('source-surface exact JS resource literal was rejected');

  const helperInput = "assetUrl('js/search.js')";
  if (scanGovernedVersionLiterals(helperInput, assets, hashes).length) {
    throw new Error('source-surface scanner confused canonical helper input with a versioned public URL');
  }

  // A root governance Markdown file is documentary evidence even when it
  // quotes a versioned URL. A Markdown source moved under src/ is not silently
  // exempt: it becomes an unclassified potential publishing source until the
  // source-kind contract explicitly owns it.
  if (!isDocumentationOnly('/repo', '/repo/AGENTS-REFERENCE.md')) {
    throw new Error('source-surface contract failed to distinguish root documentation');
  }
  if (isDocumentationOnly('/repo', '/repo/src/content/example.md')) {
    throw new Error('source-surface contract silently exempted src Markdown publishing source');
  }
}

module.exports = {
  EXCLUDED_DIR_NAMES,
  CONTROL_EXTENSIONS,
  RESOURCE_EXTENSIONS,
  DOCUMENTATION_EXTENSIONS,
  CONTROL_SIGNAL_RE,
  shouldExcludeRelative,
  isDocumentationOnly,
  collectProductSourceSurfaces,
  countControlSignals,
  auditControlSurfaceCorpus,
  scanGovernedVersionLiterals,
  countGovernedVersionLiterals,
  auditGovernedResourceVersions,
  assertSourceSurfaceMutationContract,
};
