#!/usr/bin/env node
/**
 * Final production-like dist normalizer.
 *
 * Runs after Astro and legacy-copy, synchronizes asset hashes, materializes the
 * Atlas browser runtime, projects the canonical document security policy,
 * removes transport-only meta pragmas that cannot own HTTP response policy,
 * projects editorial metadata and sitemap images, and executes the canonical
 * build-time relation projector. Every phase is deterministic and fail-closed.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { projectSitemapImages } = require('./lib/sitemap-image-projection');
const { DOCUMENT_CSP } = require('./security-document-policy.js');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ASSETS_MODULE = path.join(ROOT, 'scripts', 'cache-bust-assets.js');
const PROJECTOR = path.join(ROOT, 'scripts', 'project-relations-to-dist.mjs');
const EDITORIAL_PROJECTOR = path.join(ROOT, 'scripts', 'editorial-metadata-registry.js');
const READER_LINEAR_PROJECTOR = path.join(ROOT, 'scripts', 'project-reader-linear-text-to-dist.mjs');
const DRY_RUN = process.argv.includes('--dry-run');

function requirePath(file, message) {
  if (!fs.existsSync(file)) throw new Error(message || `Missing required path: ${file}`);
}
requirePath(DIST, 'dist/ does not exist. Run the Astro build first.');
requirePath(ASSETS_MODULE, 'scripts/cache-bust-assets.js not found.');
requirePath(PROJECTOR, 'scripts/project-relations-to-dist.mjs not found.');
requirePath(EDITORIAL_PROJECTOR, 'scripts/editorial-metadata-registry.js not found.');
requirePath(READER_LINEAR_PROJECTOR, 'scripts/project-reader-linear-text-to-dist.mjs not found.');

const ASSETS = require(ASSETS_MODULE).ASSETS;
if (!Array.isArray(ASSETS) || !ASSETS.length) throw new Error('ASSETS registry is empty');

const md5 = (file) => {
  const absolute = path.join(ROOT, file);
  if (!fs.existsSync(absolute)) return null;
  return crypto.createHash('md5').update(fs.readFileSync(absolute)).digest('hex').slice(0, 8);
};
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const currentHashes = Object.fromEntries(ASSETS.map((asset) => [asset, md5(asset)]));
const RUNTIME_ASSETS = Object.freeze([
  { source: 'src/runtime/atlas-runtime.js', publicPath: 'js/atlas-runtime.js', role: 'atlas-js' },
]);
const runtimeByRole = new Map();
for (const asset of RUNTIME_ASSETS) {
  const hash = md5(asset.source);
  if (!hash) throw new Error(`Governed runtime source is missing: ${asset.source}`);
  runtimeByRole.set(asset.role, { ...asset, hash });
}

function materializeRuntimeAssets() {
  for (const asset of runtimeByRole.values()) {
    const source = path.join(ROOT, asset.source);
    const target = path.join(DIST, asset.publicPath);
    if (!DRY_RUN) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
      if (sha256(source) !== sha256(target)) throw new Error(`Runtime materialization drift: ${asset.source} -> ${asset.publicPath}`);
    }
  }
}

function walk(dir, output = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, output);
    else if (file.endsWith('.html')) output.push(file);
  }
  return output;
}

function runtimeUrl(asset) {
  return `/${asset.publicPath}?v=${asset.hash}`;
}

function normalizeRuntimeReference(html, asset) {
  const re = new RegExp(`/${escapeRe(asset.publicPath)}(?:\\?v=[a-f0-9]{8})?`, 'g');
  return html.replace(re, runtimeUrl(asset));
}

materializeRuntimeAssets();
const atlasJs = runtimeByRole.get('atlas-js');
const htmlFiles = walk(DIST);
let filesTouched = 0;
let replacements = 0;
const atlasFailures = [];

for (const file of htmlFiles) {
  const source = fs.readFileSync(file, 'utf8');
  let updated = source;
  let fileReplacements = 0;
  for (const asset of ASSETS) {
    const current = currentHashes[asset];
    if (!current) continue;
    const re = new RegExp(`((?:\\.\\./)*|/?)${escapeRe(asset)}\\?v=[a-f0-9]{8}`, 'g');
    updated = updated.replace(re, (_match, prefix) => {
      fileReplacements += 1;
      return `${prefix}${asset}?v=${current}`;
    });
  }
  updated = normalizeRuntimeReference(updated, atlasJs);
  const relative = path.relative(DIST, file).replace(/\\/g, '/');
  if (relative === 'map/index.html' && !updated.includes(runtimeUrl(atlasJs))) atlasFailures.push(relative);
  if (updated !== source) {
    filesTouched += 1;
    replacements += fileReplacements;
    if (!DRY_RUN) fs.writeFileSync(file, updated, 'utf8');
  }
}
if (atlasFailures.length) throw new Error(`Atlas runtime normalization failed in ${atlasFailures.join(', ')}`);
if (!DRY_RUN && !fs.existsSync(path.join(DIST, atlasJs.publicPath))) throw new Error(`dist is missing governed runtime asset: ${atlasJs.publicPath}`);

function cspMetaTags(html) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  return tags.filter((tag) => /http-equiv\s*=\s*["']Content-Security-Policy["']/i.test(tag));
}
function transportOnlyMetaTags(html) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  return tags.filter((tag) => /http-equiv\s*=\s*["']X-Content-Type-Options["']/i.test(tag));
}
function stripTransportOnlyMetaPragmas(html) {
  let removed = 0;
  const updated = html.replace(/\s*<meta\b[^>]*\bhttp-equiv\s*=\s*["']X-Content-Type-Options["'][^>]*>\s*/gi, () => {
    removed += 1;
    return '\n';
  });
  return { html: updated, removed };
}
function canonicalCspMetaTag() {
  return `<meta http-equiv="Content-Security-Policy" content="${DOCUMENT_CSP}">`;
}
function cspContent(tag) {
  const content = String(tag).match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i);
  return content ? content[2].trim().replace(/\s+/g, ' ') : '';
}
function hardenCsp(html) {
  const unchanged = { html, changed: false, injected: false, canonicalized: false };
  if (!/<html\b/i.test(html) || !/<head\b/i.test(html)) return unchanged;

  const currentTags = cspMetaTags(html);
  let withoutCsp = html;
  for (const tag of currentTags) withoutCsp = withoutCsp.replace(tag, '');

  const meta = canonicalCspMetaTag();
  const projected = /<meta\s+charset=/i.test(withoutCsp)
    ? withoutCsp.replace(/(<meta\s+charset=[^>]*>)/i, `$1\n${meta}`)
    : withoutCsp.replace(/(<head\b[^>]*>)/i, `$1\n${meta}`);

  if (projected === html) return unchanged;
  return {
    html: projected,
    changed: true,
    injected: currentTags.length === 0,
    canonicalized: currentTags.length > 0,
  };
}

let securityFilesTouched = 0;
let transportMetaRemoved = 0;
let cspInjected = 0;
let cspCanonicalized = 0;
let cspVerified = 0;
const securityFailures = [];
for (const file of htmlFiles) {
  const original = fs.readFileSync(file, 'utf8');
  const transport = stripTransportOnlyMetaPragmas(original);
  const result = hardenCsp(transport.html);
  const finalHtml = result.html;

  transportMetaRemoved += transport.removed;
  if (result.injected) cspInjected += 1;
  if (result.canonicalized) cspCanonicalized += 1;
  if (finalHtml !== original) {
    securityFilesTouched += 1;
    if (!DRY_RUN) fs.writeFileSync(file, finalHtml, 'utf8');
  }

  if (!/<html\b/i.test(finalHtml) || !/<head\b/i.test(finalHtml)) continue;
  const cspTags = cspMetaTags(finalHtml);
  const transportTags = transportOnlyMetaTags(finalHtml);
  const relative = path.relative(DIST, file).replace(/\\/g, '/');
  if (transportTags.length) securityFailures.push(`${relative}: transport-only X-Content-Type-Options meta survived final projection`);
  if (cspTags.length !== 1 || cspContent(cspTags[0]) !== DOCUMENT_CSP.trim().replace(/\s+/g, ' ')) {
    securityFailures.push(`${relative}: canonical CSP projection failed`);
  } else {
    cspVerified += 1;
  }
}
if (securityFailures.length) throw new Error(`Canonical security projection failed:\n${securityFailures.join('\n')}`);

const projector = spawnSync(process.execPath, [PROJECTOR, ...(DRY_RUN ? ['--dry-run'] : [])], { cwd: ROOT, stdio: 'inherit', encoding: 'utf8' });
if (projector.error) throw projector.error;
if (projector.status !== 0) throw new Error(`Relation projector failed with exit code ${projector.status}`);

const editorialProjector = spawnSync(
  process.execPath,
  [EDITORIAL_PROJECTOR, '--project-dist', ...(DRY_RUN ? ['--dry-run'] : [])],
  { cwd: ROOT, stdio: 'inherit', encoding: 'utf8' }
);
if (editorialProjector.error) throw editorialProjector.error;
if (editorialProjector.status !== 0) throw new Error(`Editorial metadata projector failed with exit code ${editorialProjector.status}`);

const readerLinearProjector = spawnSync(
  process.execPath,
  [READER_LINEAR_PROJECTOR, '--root', 'dist', ...(DRY_RUN ? ['--dry-run'] : [])],
  { cwd: ROOT, stdio: 'inherit', encoding: 'utf8' }
);
if (readerLinearProjector.error) throw readerLinearProjector.error;
if (readerLinearProjector.status !== 0) throw new Error(`Reader linear-text projector failed with exit code ${readerLinearProjector.status}`);

const sitemapImages = projectSitemapImages({ root: DIST, htmlFiles, dryRun: DRY_RUN });

console.log(`\n⚡ astro-cache-bust-postbuild.js${DRY_RUN ? ' [DRY RUN]' : ''}\n`);
console.log(`  HTML files scanned:       ${htmlFiles.length}`);
console.log(`  Files touched:            ${filesTouched}`);
console.log(`  Hash replacements:        ${replacements}`);
console.log(`  Governed runtime assets:  ${RUNTIME_ASSETS.length}`);
console.log(`  Security files touched:   ${securityFilesTouched}`);
console.log(`  Transport meta removed:   ${transportMetaRemoved}`);
console.log(`  CSP injected/canonical:   ${cspInjected}/${cspCanonicalized}`);
console.log(`  CSP canonical verified:   ${cspVerified}`);
console.log(`  Sitemap images:           ${sitemapImages.inserted} inserted, ${sitemapImages.replaced} synchronized, ${sitemapImages.unchanged} unchanged`);
console.log(DRY_RUN ? '\n  (dry-run: nothing written)' : '\n✅ dist asset, security, Atlas, relation, editorial metadata, reader semantic projection and sitemap image drift → 0');
