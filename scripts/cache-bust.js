#!/usr/bin/env node
/**
 * Asset revision drift checker / explicit source rewriter.
 *
 * Default mode is READ-ONLY CHECK. It computes content hashes and reports every
 * stale source reference without writing. Any drift exits non-zero.
 *
 * Explicit write mode is retained only as a migration bridge:
 *   node scripts/cache-bust.js --write
 *
 * The long-term target is a generated asset manifest (#56/#64), not permanent
 * source rewriting. Historical implementation is archived under
 * scripts/legacy-generators/.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const CHECK = !WRITE;
const { ASSETS } = require('./cache-bust-assets');

function md5short(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return null;
  return crypto.createHash('md5').update(fs.readFileSync(abs)).digest('hex').slice(0, 8);
}

function collectHTML(dir, acc = []) {
  const SKIP_DIRS = new Set([
    'node_modules', 'dist', 'out', 'build', 'coverage', 'reports', 'audit',
    '_build-tools', 'src', 'scripts', 'docs', 'migration'
  ]);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectHTML(full, acc);
    else if (entry.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

function collectAstro(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectAstro(full, acc);
    else if (entry.name.endsWith('.astro')) acc.push(full);
  }
  return acc;
}

function rewriteAstro(source, hashes) {
  let updated = source;
  for (const [asset, hash] of Object.entries(hashes)) {
    if (!hash) continue;
    const escapedAsset = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const versionedRe = new RegExp(`((?:\\.\\.\\/)*|/?)${escapedAsset}\\?v=[^\\s"'&}>]+`, 'g');
    updated = updated.replace(versionedRe, (_match, prefix) => `${prefix}${asset}?v=${hash}`);

    // Only static HTML-like href/src attributes are upgraded from an
    // unversioned reference. Calls such as assetUrl('js/site.js') are code,
    // not source URLs, and must remain untouched.
    const directAttrRe = new RegExp(`(\\b(?:href|src)\\s*=\\s*["'])((?:\\.\\.\\/)*|/?)${escapedAsset}(["'])`, 'g');
    updated = updated.replace(
      directAttrRe,
      (_match, open, prefix, close) => `${open}${prefix}${asset}?v=${hash}${close}`
    );
  }
  return updated;
}

function rewriteHTML(source, hashes) {
  let updated = source;
  for (const [asset, hash] of Object.entries(hashes)) {
    if (!hash) continue;
    const escapedAsset = asset.replace(/\./g, '\\.').replace(/\//g, '\\/');
    const re = new RegExp(`((?:\\.\\.\\/)*${escapedAsset})(?:\\?v=[^\\s"&]+)?`, 'g');
    updated = updated.replace(re, `$1?v=${hash}`);
  }
  return updated;
}

function expectedAssetVersionHelper(source, hashes) {
  const body = Object.keys(hashes)
    .filter((asset) => hashes[asset])
    .sort()
    .map((asset) => `  '${asset}': '${hashes[asset]}',`)
    .join('\n');
  return source.replace(
    /export const ASSET_VERSIONS = \{[\s\S]*?\n\};/,
    `export const ASSET_VERSIONS = {\n${body}\n};`
  );
}

function assertRewriteAstroContract() {
  const fixture = [
    '<link rel="stylesheet" href="/css/site.css">',
    '<script src="../../js/site.js"></script>',
    "<script>assetUrl('js/site.js')</script>",
  ].join('\n');
  const expected = [
    '<link rel="stylesheet" href="/css/site.css?v=11111111">',
    '<script src="../../js/site.js?v=22222222"></script>',
    "<script>assetUrl('js/site.js')</script>",
  ].join('\n');
  const actual = rewriteAstro(fixture, {
    'css/site.css': '11111111',
    'js/site.js': '22222222',
  });
  if (actual !== expected) {
    throw new Error(`Astro asset rewrite contract failed\nEXPECTED:\n${expected}\nACTUAL:\n${actual}`);
  }
}

function inspectFile(file, transform, hashes, changes) {
  const source = fs.readFileSync(file, 'utf8');
  const expected = transform(source, hashes);
  if (expected === source) return;
  changes.push(path.relative(ROOT, file).replace(/\\/g, '/'));
  if (WRITE) fs.writeFileSync(file, expected, 'utf8');
}

function main() {
  console.log(`\n⚡ asset revision ${WRITE ? 'WRITE' : 'READ-ONLY CHECK'}\n`);
  assertRewriteAstroContract();
  const hashes = {};
  const missingAssets = [];
  for (const asset of ASSETS) {
    const hash = md5short(asset);
    hashes[asset] = hash;
    if (hash) console.log(`  ✔ ${asset.padEnd(30)} → ?v=${hash}`);
    else {
      missingAssets.push(asset);
      console.log(`  ❌ ${asset}: asset missing`);
    }
  }

  const changes = [];
  const helper = path.join(ROOT, 'src/lib/asset-version.js');
  if (fs.existsSync(helper)) inspectFile(helper, expectedAssetVersionHelper, hashes, changes);

  for (const file of collectHTML(ROOT)) inspectFile(file, rewriteHTML, hashes, changes);
  for (const file of collectAstro(path.join(ROOT, 'src'))) inspectFile(file, rewriteAstro, hashes, changes);

  console.log('\n' + '─'.repeat(60));
  if (missingAssets.length) {
    console.error(`❌ Missing declared assets: ${missingAssets.join(', ')}`);
  }
  if (!changes.length && !missingAssets.length) {
    console.log('✅ Asset revisions are synchronized; repository was not modified.\n');
    return;
  }

  if (changes.length) {
    console.log(`${WRITE ? '✎ Updated' : '❌ Stale'} files: ${changes.length}`);
    changes.slice(0, 100).forEach((file) => console.log(`  - ${file}`));
    if (changes.length > 100) console.log(`  …and ${changes.length - 100} more`);
  }

  if (WRITE && !missingAssets.length) {
    console.log('✅ Explicit asset revision write completed. Review and commit the diff.\n');
    return;
  }

  console.error('Run explicitly to regenerate: node scripts/cache-bust.js --write');
  process.exit(1);
}

main();
