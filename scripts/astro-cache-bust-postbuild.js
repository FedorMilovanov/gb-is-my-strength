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
for (const asset of ASSETS) {
  currentHashes[asset] = md5(asset);
}

const RELATIONSHIP_CSS = 'css/relationship-panel.css';
const RELATIONSHIP_JS = 'js/relationship-panel.js';
const relationshipCssHash = currentHashes[RELATIONSHIP_CSS];
const relationshipJsHash = currentHashes[RELATIONSHIP_JS];
if (!relationshipCssHash || !relationshipJsHash) {
  throw new Error('Relationship assets are registered but missing from the repository');
}

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

function injectRelationshipAssets(html) {
  if (!isRelationshipArticle(html)) return { html, changed: false, eligible: false };
  let updated = html;
  let changed = false;

  const cssHref = `/${RELATIONSHIP_CSS}?v=${relationshipCssHash}`;
  const jsSrc = `/${RELATIONSHIP_JS}?v=${relationshipJsHash}`;

  if (!updated.includes(RELATIONSHIP_CSS)) {
    const tag = `<link id="gbRelationshipPanelCss" rel="stylesheet" href="${cssHref}">`;
    updated = updated.replace(/<\/head>/i, `${tag}\n</head>`);
    changed = updated !== html;
  }

  if (!updated.includes(RELATIONSHIP_JS)) {
    const before = updated;
    const tag = `<script id="gbRelationshipPanelJs" defer src="${jsSrc}"></script>`;
    updated = updated.replace(/<\/body>/i, `${tag}\n</body>`);
    changed = changed || updated !== before;
  }

  return { html: updated, changed, eligible: true };
}

function hasExactRelationshipAssets(html) {
  if (!isRelationshipArticle(html)) return true;
  return html.includes(`/${RELATIONSHIP_CSS}?v=${relationshipCssHash}`)
    && html.includes(`/${RELATIONSHIP_JS}?v=${relationshipJsHash}`);
}

const htmlFiles = walk(DIST);
let filesTouched = 0;
let replacements = 0;
let relationshipEligible = 0;
let relationshipInjected = 0;
const relationshipFailures = [];

for (const fp of htmlFiles) {
  let src = fs.readFileSync(fp, 'utf8');
  let updated = src;
  let fileReplacements = 0;

  for (const asset of ASSETS) {
    const current = currentHashes[asset];
    if (!current) continue;
    const escaped = escapeRe(asset);

    const re = new RegExp(
      `((?:\\.\\./)*|/?)${escaped}\\?v=[a-f0-9]{8}`,
      'g'
    );
    updated = updated.replace(re, (match, prefix) => {
      fileReplacements++;
      return `${prefix}${asset}?v=${current}`;
    });
  }

  const relationResult = injectRelationshipAssets(updated);
  updated = relationResult.html;
  if (relationResult.eligible) relationshipEligible++;
  if (relationResult.changed) relationshipInjected++;
  if (!hasExactRelationshipAssets(updated)) {
    relationshipFailures.push(path.relative(DIST, fp));
  }

  if (updated !== src) {
    filesTouched++;
    replacements += fileReplacements;
    if (!DRY_RUN) fs.writeFileSync(fp, updated, 'utf8');
  }
}

if (relationshipFailures.length > 0) {
  throw new Error(`Relationship asset injection failed in ${relationshipFailures.join(', ')}`);
}

// ── 4. Harden dist CSP meta consistently (NEW-68/NEW-69) ───────────────
// Astro-owned pages can be emitted from many PageHead components. Keep the
// deploy artifact safe even while source heads are gradually deduplicated.
// ONNX Runtime Web compiles its WASM backend in the browser. Permit only that
// narrow capability; do not widen the site to the general 'unsafe-eval'.
const WASM_EVAL_SOURCE = "'wasm-unsafe-eval'";
const DEFAULT_DIST_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com https://cdn.jsdelivr.net; img-src 'self' https://gospod-bog.ru https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com https://commons.wikimedia.org https://upload.wikimedia.org https://cdn.loc.gov https://tile.loc.gov https://www.ritmeyer.com https://*.nasa.gov https://bibleplaces.photoshelter.com data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com wss://mc.yandex.ru wss://*.yandex.ru wss://mc.yandex.com wss://*.yandex.com https://huggingface.co https://*.aws.cdn.hf.co https://cdn.jsdelivr.net; frame-src 'self' https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self';";

function cspMetaTag(html) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  return tags.find((tag) => /http-equiv\s*=\s*["']Content-Security-Policy["']/i.test(tag)) || '';
}
function transformCspContent(tag, transform) {
  if (!tag) return tag;
  return tag.replace(/content\s*=\s*(["])([\s\S]*?)\1/i, (_m, q, content) => {
    return `content=${q}${transform(content)}${q}`;
  });
}
function addWasmUnsafeEvalToCspTag(tag) {
  return transformCspContent(tag, (content) => {
    return content.replace(/((?:^|;)\s*script-src\s+)([^;]*)/i, (directive, prefix, sources) => {
      const tokens = sources.trim().split(/\s+/).filter(Boolean);
      if (tokens.includes(WASM_EVAL_SOURCE)) return directive;
      return `${prefix}${tokens.concat(WASM_EVAL_SOURCE).join(' ')}`;
    });
  });
}
function addFormActionToCspTag(tag) {
  if (!tag || /(?:^|;)\s*form-action\b/i.test(tag)) return tag;
  return transformCspContent(tag, (content) => {
    const trimmed = content.trim().replace(/;+\s*$/, '');
    return `${trimmed}; form-action 'self';`;
  });
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
    if (next !== tag) {
      return { html: html.replace(tag, next), changed: true, injected: false, formFixed, wasmFixed };
    }
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
  if (!cspTagHasScriptSource(finalTag, WASM_EVAL_SOURCE)) {
    cspWasmFailures.push(path.relative(DIST, fp));
  } else {
    cspWasmVerified++;
  }
}

if (cspWasmFailures.length > 0) {
  throw new Error(`CSP hardening failed: script-src lacks ${WASM_EVAL_SOURCE} in ${cspWasmFailures.join(', ')}`);
}

console.log(`\n⚡  astro-cache-bust-postbuild.js${DRY_RUN ? ' [DRY RUN]' : ''}\n`);
console.log(`  HTML files scanned:       ${htmlFiles.length}`);
console.log(`  Files touched:            ${filesTouched}`);
console.log(`  Hash replacements:        ${replacements}`);
console.log(`  Relationship articles:    ${relationshipEligible}`);
console.log(`  Relationship injections:  ${relationshipInjected}`);
console.log(`  CSP files touched:         ${cspFilesTouched} (injected: ${cspInjected}, form-action fixed: ${cspFormFixed}, wasm fixed: ${cspWasmFixed})`);
console.log(`  CSP WASM verified:         ${cspWasmVerified}`);

if (DRY_RUN) {
  console.log('\n  (dry-run: nothing written)');
} else {
  console.log('\n✅  dist/ asset and relationship drift → 0');
}
