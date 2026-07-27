#!/usr/bin/env node
/*
 * astro-cache-bust-postbuild.js — P0-10 fix.
 *
 * Astro builds dist HTML files with hardcoded `?v=HASH` from component sources.
 * cache-bust.js only updates root HTML (articles/, baptisty-rossii/, etc.),
 * NOT dist/. So Astro-owned pages serve stale CSS/JS hashes forever.
 *
 * This script runs AFTER `astro:build` + AFTER `copy-legacy-to-dist`,
 * reads current ASSETS hashes from cache-bust.js source, and rewrites
 * dist HTML ?v=HASH values to match.
 *
 * Run order in strangler:build:production-like:
 *   1. astro:build                  → dist HTML files (stale hashes)
 *   2. copy-legacy-to-dist          → dist (legacy HTML, has fresh hashes)
 *   3. astro-cache-bust-postbuild   → dist HTML (sync all hashes)
 *
 * Usage: node scripts/astro-cache-bust-postbuild.js [--dry-run]
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const CB_SCRIPT = path.join(ROOT, 'scripts', 'cache-bust.js');
const DRY_RUN = process.argv.includes('--dry-run');

if (!fs.existsSync(DIST)) {
  console.error('❌ dist/ does not exist. Run npm run astro:build first.');
  process.exit(1);
}
if (!fs.existsSync(CB_SCRIPT)) {
  console.error('❌ scripts/cache-bust.js not found.');
  process.exit(1);
}

// ── 1. Read current ASSETS list from shared cache-bust-assets module ────────
const ASSETS_MODULE = path.join(ROOT, 'scripts', 'cache-bust-assets.js');
if (!fs.existsSync(ASSETS_MODULE)) {
  console.error('❌ scripts/cache-bust-assets.js not found.');
  process.exit(1);
}
const ASSETS = require(ASSETS_MODULE).ASSETS;
if (!Array.isArray(ASSETS) || ASSETS.length === 0) {
  console.error('❌ Could not load ASSETS from cache-bust-assets.js');
  process.exit(1);
}

// ── 2. Compute current hash for each asset ──────────────────────────────────
const md5 = relPath => {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return null;
  return crypto.createHash('md5').update(fs.readFileSync(abs)).digest('hex').slice(0, 8);
};

const currentHashes = {};
for (const asset of ASSETS) currentHashes[asset] = md5(asset);

// Relationship and Atlas source assets live under src/runtime so the root
// css/js allowlists remain intentionally closed. They are materialized only
// into the generated dist tree and receive deterministic content hashes here.
const RUNTIME_ASSETS = Object.freeze([
  {
    source: 'src/runtime/relationship-panel.css',
    publicPath: 'css/relationship-panel.css',
    role: 'relationship-css',
  },
  {
    source: 'src/runtime/relationship-panel.js',
    publicPath: 'js/relationship-panel.js',
    role: 'relationship-js',
  },
  {
    source: 'src/runtime/atlas-runtime.js',
    publicPath: 'js/atlas-runtime.js',
    role: 'atlas-js',
  },
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
    if (DRY_RUN) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    const sourceDigest = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
    const targetDigest = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
    if (sourceDigest !== targetDigest) throw new Error(`Runtime materialization drift: ${asset.source} -> ${asset.publicPath}`);
  }
}

materializeRuntimeAssets();

const relationshipCss = runtimeByRole.get('relationship-css');
const relationshipJs = runtimeByRole.get('relationship-js');
const atlasJs = runtimeByRole.get('atlas-js');

// ── 3. Walk dist/**/*.html, rewrite asset hashes and inject article panel ──
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}

function isRelationshipArticle(html) {
  return /<html\b/i.test(html) && /<head\b/i.test(html) && /<article\b/i.test(html);
}

function runtimeUrl(asset) {
  return `/${asset.publicPath}?v=${asset.hash}`;
}

function normalizeRuntimeReference(html, asset) {
  const escaped = escapeRe(asset.publicPath);
  const re = new RegExp(`/${escaped}(?:\\?v=[a-f0-9]{8})?`, 'g');
  return html.replace(re, runtimeUrl(asset));
}

function injectRelationshipAssets(html) {
  if (!isRelationshipArticle(html)) return { html, changed: false, eligible: false };
  let updated = html;
  let changed = false;

  const cssHref = runtimeUrl(relationshipCss);
  const jsSrc = runtimeUrl(relationshipJs);

  const normalized = normalizeRuntimeReference(normalizeRuntimeReference(updated, relationshipCss), relationshipJs);
  changed = normalized !== updated;
  updated = normalized;

  if (!updated.includes(relationshipCss.publicPath)) {
    const before = updated;
    const tag = `<link id="gbRelationshipPanelCss" rel="stylesheet" href="${cssHref}">`;
    updated = updated.replace(/<\/head>/i, `${tag}\n</head>`);
    changed = changed || updated !== before;
  }

  if (!updated.includes(relationshipJs.publicPath)) {
    const before = updated;
    const tag = `<script id="gbRelationshipPanelJs" defer src="${jsSrc}"></script>`;
    updated = updated.replace(/<\/body>/i, `${tag}\n</body>`);
    changed = changed || updated !== before;
  }

  return { html: updated, changed, eligible: true };
}

function hasExactRelationshipAssets(html) {
  if (!isRelationshipArticle(html)) return true;
  return html.includes(runtimeUrl(relationshipCss)) && html.includes(runtimeUrl(relationshipJs));
}

function hasExactAtlasRuntime(html, file) {
  if (path.relative(DIST, file).replace(/\\/g, '/') !== 'map/index.html') return true;
  return html.includes(runtimeUrl(atlasJs));
}

const htmlFiles = walk(DIST);
let filesTouched = 0;
let replacements = 0;
let relationshipEligible = 0;
let relationshipInjected = 0;
const relationshipFailures = [];
const atlasFailures = [];

for (const fp of htmlFiles) {
  const src = fs.readFileSync(fp, 'utf8');
  let updated = src;
  let fileReplacements = 0;

  for (const asset of ASSETS) {
    const current = currentHashes[asset];
    if (!current) continue;
    const escaped = escapeRe(asset);
    const re = new RegExp(`((?:\\.\\./)*|/?)${escaped}\\?v=[a-f0-9]{8}`, 'g');
    updated = updated.replace(re, (_match, prefix) => {
      fileReplacements++;
      return `${prefix}${asset}?v=${current}`;
    });
  }

  updated = normalizeRuntimeReference(updated, atlasJs);
  const relationResult = injectRelationshipAssets(updated);
  updated = relationResult.html;
  if (relationResult.eligible) relationshipEligible++;
  if (relationResult.changed) relationshipInjected++;
  if (!hasExactRelationshipAssets(updated)) relationshipFailures.push(path.relative(DIST, fp));
  if (!hasExactAtlasRuntime(updated, fp)) atlasFailures.push(path.relative(DIST, fp));

  if (updated !== src) {
    filesTouched++;
    replacements += fileReplacements;
    if (!DRY_RUN) fs.writeFileSync(fp, updated, 'utf8');
  }
}

if (relationshipFailures.length > 0) {
  throw new Error(`Relationship asset injection failed in ${relationshipFailures.join(', ')}`);
}
if (atlasFailures.length > 0) {
  throw new Error(`Atlas runtime normalization failed in ${atlasFailures.join(', ')}`);
}
for (const asset of runtimeByRole.values()) {
  if (!DRY_RUN && !fs.existsSync(path.join(DIST, asset.publicPath))) {
    throw new Error(`dist is missing governed runtime asset: ${asset.publicPath}`);
  }
}

// ── 4. Harden dist CSP meta consistently (NEW-68/NEW-69) ───────────────
const WASM_EVAL_SOURCE = "'wasm-unsafe-eval'";
const DEFAULT_DIST_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com https://cdn.jsdelivr.net; img-src 'self' https://gospod-bog.ru https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com https://commons.wikimedia.org https://upload.wikimedia.org https://cdn.loc.gov https://tile.loc.gov https://www.ritmeyer.com https://*.nasa.gov https://bibleplaces.photoshelter.com data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com wss://mc.yandex.ru wss://*.yandex.ru wss://mc.yandex.com wss://*.yandex.com https://huggingface.co https://*.aws.cdn.hf.co https://cdn.jsdelivr.net; frame-src 'self' https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self';";

function cspMetaTag(html) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  return tags.find(tag => /http-equiv\s*=\s*["']Content-Security-Policy["']/i.test(tag)) || '';
}
function transformCspContent(tag, transform) {
  if (!tag) return tag;
  return tag.replace(/content\s*=\s*(["])([\s\S]*?)\1/i, (_m, q, content) => `content=${q}${transform(content)}${q}`);
}
function addWasmUnsafeEvalToCspTag(tag) {
  return transformCspContent(tag, content => content.replace(/((?:^|;)\s*script-src\s+)([^;]*)/i, (directive, prefix, sources) => {
    const tokens = sources.trim().split(/\s+/).filter(Boolean);
    if (tokens.includes(WASM_EVAL_SOURCE)) return directive;
    return `${prefix}${tokens.concat(WASM_EVAL_SOURCE).join(' ')}`;
  }));
}
function addFormActionToCspTag(tag) {
  if (!tag || /(?:^|;)\s*form-action\b/i.test(tag)) return tag;
  return transformCspContent(tag, content => `${content.trim().replace(/;+\s*$/, '')}; form-action 'self';`);
}
function cspTagHasScriptSource(tag, source) {
  const contentMatch = String(tag).match(/content\s*=\s*(["])([\s\S]*?)\1/i);
  if (!contentMatch) return false;
  const directiveMatch = contentMatch[2].match(/(?:^|;)\s*script-src\s+([^;]*)/i);
  if (!directiveMatch) return false;
  return directiveMatch[1].trim().split(/\s+/).includes(source);
}
function hardenCsp(html) {
  const emptyResult = { html, changed: false, injected: false, formFixed: false, wasmFixed: false };
  if (!/<html\b/i.test(html) || !/<head\b/i.test(html)) return emptyResult;
  const tag = cspMetaTag(html);
  if (tag) {
    const withWasm = addWasmUnsafeEvalToCspTag(tag);
    const next = addFormActionToCspTag(withWasm);
    const wasmFixed = withWasm !== tag;
    const formFixed = next !== withWasm;
    if (next !== tag) return { html: html.replace(tag, next), changed: true, injected: false, formFixed, wasmFixed };
    return emptyResult;
  }
  const meta = `<meta http-equiv="Content-Security-Policy" content="${DEFAULT_DIST_CSP}">`;
  if (/<meta\s+charset=/i.test(html)) {
    return { html: html.replace(/(<meta\s+charset=[^>]*>)/i, `$1\n${meta}`), changed: true, injected: true, formFixed: false, wasmFixed: false };
  }
  return { html: html.replace(/(<head\b[^>]*>)/i, `$1\n${meta}`), changed: true, injected: true, formFixed: false, wasmFixed: false };
}

let cspFilesTouched = 0;
let cspInjected = 0;
let cspFormFixed = 0;
let cspWasmFixed = 0;
let cspWasmVerified = 0;
const cspWasmFailures = [];
for (const fp of htmlFiles) {
  const src = fs.readFileSync(fp, 'utf8');
  const result = hardenCsp(src);
  if (result.changed) {
    cspFilesTouched++;
    if (result.injected) cspInjected++;
    if (result.formFixed) cspFormFixed++;
    if (result.wasmFixed) cspWasmFixed++;
    if (!DRY_RUN) fs.writeFileSync(fp, result.html, 'utf8');
  }
  if (!/<html\b/i.test(result.html) || !/<head\b/i.test(result.html)) continue;
  const finalTag = cspMetaTag(result.html);
  if (!cspTagHasScriptSource(finalTag, WASM_EVAL_SOURCE)) cspWasmFailures.push(path.relative(DIST, fp));
  else cspWasmVerified++;
}

if (cspWasmFailures.length > 0) {
  throw new Error(`CSP hardening failed: script-src lacks ${WASM_EVAL_SOURCE} in ${cspWasmFailures.join(', ')}`);
}

console.log(`\n⚡  astro-cache-bust-postbuild.js${DRY_RUN ? ' [DRY RUN]' : ''}\n`);
console.log(`  HTML files scanned:       ${htmlFiles.length}`);
console.log(`  Files touched:            ${filesTouched}`);
console.log(`  Hash replacements:        ${replacements}`);
console.log(`  Governed runtime assets:  ${RUNTIME_ASSETS.length}`);
console.log(`  Relationship articles:    ${relationshipEligible}`);
console.log(`  Relationship injections:  ${relationshipInjected}`);
console.log(`  CSP files touched:         ${cspFilesTouched} (injected: ${cspInjected}, form-action fixed: ${cspFormFixed}, wasm fixed: ${cspWasmFixed})`);
console.log(`  CSP WASM verified:         ${cspWasmVerified}`);

if (DRY_RUN) console.log('\n  (dry-run: nothing written)');
else console.log('\n✅  dist/ asset, runtime and relationship drift → 0');
