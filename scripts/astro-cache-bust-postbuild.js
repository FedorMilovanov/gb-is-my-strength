#!/usr/bin/env node
/**
 * Final production-like dist normalizer.
 *
 * Runs after Astro and legacy-copy, synchronizes asset hashes, materializes the
 * Atlas browser runtime, hardens CSP and executes the canonical build-time
 * relation projector. Every phase is deterministic and fail-closed.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ASSETS_MODULE = path.join(ROOT, 'scripts', 'cache-bust-assets.js');
const PROJECTOR = path.join(ROOT, 'scripts', 'project-relations-to-dist.mjs');
const DRY_RUN = process.argv.includes('--dry-run');

function requirePath(file, message) {
  if (!fs.existsSync(file)) throw new Error(message || `Missing required path: ${file}`);
}
requirePath(DIST, 'dist/ does not exist. Run the Astro build first.');
requirePath(ASSETS_MODULE, 'scripts/cache-bust-assets.js not found.');
requirePath(PROJECTOR, 'scripts/project-relations-to-dist.mjs not found.');

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

const WASM_EVAL_SOURCE = "'wasm-unsafe-eval'";
const DEFAULT_DIST_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com https://cdn.jsdelivr.net; img-src 'self' https://gospod-bog.ru https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com https://commons.wikimedia.org https://upload.wikimedia.org https://cdn.loc.gov https://tile.loc.gov https://www.ritmeyer.com https://*.nasa.gov https://bibleplaces.photoshelter.com data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com wss://mc.yandex.ru wss://*.yandex.ru wss://mc.yandex.com wss://*.yandex.com https://huggingface.co https://*.aws.cdn.hf.co https://cdn.jsdelivr.net; frame-src 'self' https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self';";

function cspMetaTag(html) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  return tags.find((tag) => /http-equiv\s*=\s*["']Content-Security-Policy["']/i.test(tag)) || '';
}
function transformCspContent(tag, transform) {
  return tag ? tag.replace(/content\s*=\s*(["])([\s\S]*?)\1/i, (_match, quote, content) => `content=${quote}${transform(content)}${quote}`) : tag;
}
function addWasmUnsafeEval(tag) {
  return transformCspContent(tag, (content) => content.replace(/((?:^|;)\s*script-src\s+)([^;]*)/i, (directive, prefix, sources) => {
    const tokens = sources.trim().split(/\s+/).filter(Boolean);
    return tokens.includes(WASM_EVAL_SOURCE) ? directive : `${prefix}${tokens.concat(WASM_EVAL_SOURCE).join(' ')}`;
  }));
}
function addFormAction(tag) {
  if (!tag || /(?:^|;)\s*form-action\b/i.test(tag)) return tag;
  return transformCspContent(tag, (content) => `${content.trim().replace(/;+\s*$/, '')}; form-action 'self';`);
}
function cspHasScriptSource(tag, source) {
  const content = String(tag).match(/content\s*=\s*(["])([\s\S]*?)\1/i);
  const directive = content && content[2].match(/(?:^|;)\s*script-src\s+([^;]*)/i);
  return Boolean(directive && directive[1].trim().split(/\s+/).includes(source));
}
function hardenCsp(html) {
  const unchanged = { html, changed: false, injected: false, formFixed: false, wasmFixed: false };
  if (!/<html\b/i.test(html) || !/<head\b/i.test(html)) return unchanged;
  const current = cspMetaTag(html);
  if (current) {
    const withWasm = addWasmUnsafeEval(current);
    const next = addFormAction(withWasm);
    return next === current ? unchanged : { html: html.replace(current, next), changed: true, injected: false, formFixed: next !== withWasm, wasmFixed: withWasm !== current };
  }
  const meta = `<meta http-equiv="Content-Security-Policy" content="${DEFAULT_DIST_CSP}">`;
  return /<meta\s+charset=/i.test(html)
    ? { html: html.replace(/(<meta\s+charset=[^>]*>)/i, `$1\n${meta}`), changed: true, injected: true, formFixed: false, wasmFixed: false }
    : { html: html.replace(/(<head\b[^>]*>)/i, `$1\n${meta}`), changed: true, injected: true, formFixed: false, wasmFixed: false };
}

let cspFilesTouched = 0;
let cspInjected = 0;
let cspFormFixed = 0;
let cspWasmFixed = 0;
let cspWasmVerified = 0;
const cspFailures = [];
for (const file of htmlFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const result = hardenCsp(source);
  if (result.changed) {
    cspFilesTouched += 1;
    if (result.injected) cspInjected += 1;
    if (result.formFixed) cspFormFixed += 1;
    if (result.wasmFixed) cspWasmFixed += 1;
    if (!DRY_RUN) fs.writeFileSync(file, result.html, 'utf8');
  }
  if (!/<html\b/i.test(result.html) || !/<head\b/i.test(result.html)) continue;
  if (!cspHasScriptSource(cspMetaTag(result.html), WASM_EVAL_SOURCE)) cspFailures.push(path.relative(DIST, file));
  else cspWasmVerified += 1;
}
if (cspFailures.length) throw new Error(`CSP hardening failed in ${cspFailures.join(', ')}`);

const projector = spawnSync(process.execPath, [PROJECTOR, ...(DRY_RUN ? ['--dry-run'] : [])], { cwd: ROOT, stdio: 'inherit', encoding: 'utf8' });
if (projector.error) throw projector.error;
if (projector.status !== 0) throw new Error(`Relation projector failed with exit code ${projector.status}`);

console.log(`\n⚡ astro-cache-bust-postbuild.js${DRY_RUN ? ' [DRY RUN]' : ''}\n`);
console.log(`  HTML files scanned:       ${htmlFiles.length}`);
console.log(`  Files touched:            ${filesTouched}`);
console.log(`  Hash replacements:        ${replacements}`);
console.log(`  Governed runtime assets:  ${RUNTIME_ASSETS.length}`);
console.log(`  CSP files touched:        ${cspFilesTouched} (injected: ${cspInjected}, form-action fixed: ${cspFormFixed}, wasm fixed: ${cspWasmFixed})`);
console.log(`  CSP WASM verified:        ${cspWasmVerified}`);
console.log(DRY_RUN ? '\n  (dry-run: nothing written)' : '\n✅ dist asset, CSP, Atlas and relation projection drift → 0');
