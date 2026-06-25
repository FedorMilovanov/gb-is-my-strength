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
 *   3. astro-cache-bust-postbuild   → dist HTML (sync all hashes) ← NEW
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

// ── 1. Read current ASSETS list from cache-bust.js ──────────────────────────
const cbSrc = fs.readFileSync(CB_SCRIPT, 'utf8');
const assetsMatch = cbSrc.match(/const\s+ASSETS\s*=\s*\[([\s\S]*?)\];/);
if (!assetsMatch) {
  console.error('❌ Could not parse ASSETS array from cache-bust.js');
  process.exit(1);
}
const ASSETS = [...assetsMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

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

// ── 3. Walk dist/**/*.html, rewrite ?v=STALE → ?v=CURRENT ──────────────────
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

const htmlFiles = walk(DIST);
let filesTouched = 0;
let replacements = 0;

for (const fp of htmlFiles) {
  let src = fs.readFileSync(fp, 'utf8');
  let updated = src;
  let fileReplacements = 0;

  for (const asset of ASSETS) {
    const current = currentHashes[asset];
    if (!current) continue;
    const escaped = escapeRe(asset);

    // Match: <asset>?v=<any 8-hex>  →  <asset>?v=<current>
    // Asset can be preceded by ../ or / etc.
    const re = new RegExp(
      `((?:\\.\\./)*|/?)${escaped}\\?v=[a-f0-9]{8}`,
      'g'
    );
    updated = updated.replace(re, (match, prefix) => {
      fileReplacements++;
      return `${prefix}${asset}?v=${current}`;
    });
  }

  if (updated !== src) {
    filesTouched++;
    replacements += fileReplacements;
    if (!DRY_RUN) fs.writeFileSync(fp, updated, 'utf8');
  }
}

console.log(`\n⚡  astro-cache-bust-postbuild.js${DRY_RUN ? ' [DRY RUN]' : ''}\n`);
console.log(`  HTML files scanned: ${htmlFiles.length}`);
console.log(`  Files touched:      ${filesTouched}`);
console.log(`  Hash replacements:  ${replacements}`);

if (DRY_RUN) {
  console.log('\n  (dry-run: nothing written)');
} else {
  console.log('\n✅  dist/ hash drift → 0 (next cache-bust legacy pass will converge)');
}
