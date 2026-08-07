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
 * Route profiles are the current legacy/reference authority. HTML declared
 * legacyStatus=reference-only is immutable snapshot evidence and is therefore
 * intentionally excluded from both drift checking and source rewriting. Active,
 * authoritative and unprofiled HTML remain conservatively covered.
 *
 * The long-term target is a generated asset manifest (#56/#64), not permanent
 * source rewriting. Historical implementation is archived under
 * scripts/legacy-generators/.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  classifyLegacyAuthority,
  validateLegacyAuthorityProfile,
} = require('./lib/legacy-source-authority');
const { loadRouteRecords } = require('./lib/route-source-contract');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const { ASSETS } = require('./cache-bust-assets');

function md5short(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return null;
  return crypto.createHash('md5').update(fs.readFileSync(abs)).digest('hex').slice(0, 8);
}

function repoRel(abs) {
  return path.relative(ROOT, abs).replace(/\\/g, '/');
}

function resolveRepoHtml(value) {
  const rel = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel || !rel.endsWith('.html')) return null;
  const abs = path.resolve(ROOT, rel);
  if (abs === ROOT || !abs.startsWith(`${ROOT}${path.sep}`)) return null;
  return { rel, abs };
}

function deriveReferenceOnlyHtmlPaths(entries, options = {}) {
  const protectedPaths = new Set();
  const claimedBy = new Map();
  const pathExists = typeof options.pathExists === 'function'
    ? options.pathExists
    : (rel) => {
        const target = resolveRepoHtml(rel);
        return Boolean(target && fs.existsSync(target.abs));
      };

  for (const entry of entries) {
    const name = entry.name || 'route-profile';
    const profile = entry.profile;
    const profileLabel = entry.label || name;

    // Validate every production profile BEFORE branching on authority.
    // Otherwise missing/unknown legacyStatus could silently fall through and a
    // retained HTML file would re-enter the mutable cache-bust corpus.
    const issues = validateLegacyAuthorityProfile(profile, { pathExists });
    if (issues.length) {
      throw new Error(`cache-bust legacy authority invalid for ${profileLabel}: ${issues.join(' | ')}`);
    }

    const authority = classifyLegacyAuthority(profile);
    if (authority.status === 'absent') continue;

    const target = resolveRepoHtml(profile.legacyPath);
    if (!target) {
      throw new Error(`cache-bust legacyPath must be repository HTML for ${profileLabel}: ${profile.legacyPath || '(missing)'}`);
    }

    // Uniqueness is global across every explicit non-absent claimant. A
    // reference-only profile must never be able to hide an active canonical or
    // runtime-required HTML source from revision checking.
    const previous = claimedBy.get(target.abs);
    if (previous && previous !== name) {
      throw new Error(`cache-bust duplicate legacyPath ${target.rel}: ${previous}, ${name}`);
    }
    claimedBy.set(target.abs, name);

    if (authority.status === 'reference-only') {
      if (target.abs === path.join(ROOT, '404.html')) {
        throw new Error('cache-bust 404.html must remain an active utility surface, not reference-only');
      }
      protectedPaths.add(target.abs);
    }
  }

  return protectedPaths;
}

function collectReferenceOnlyHtmlPaths() {
  // Reuse the same effective registry definition of production routes as the
  // canonical route-profile contract. Build-only/dev fixtures and built apps are
  // not production Astro profiles and must not become a second authority policy
  // merely because a JSON fixture lives under data/route-profiles/.
  const { records } = loadRouteRecords();
  const entries = records
    .filter((record) => record.owner?.owner === 'astro' && record.owner?.status === 'production-dist')
    .map((record) => ({
      name: record.route,
      label: record.profileFile || record.route,
      profile: record.profile,
    }));

  return deriveReferenceOnlyHtmlPaths(entries);
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

function assertAuthorityMutationContract() {
  const syntacticHtmlExists = (rel) => Boolean(resolveRepoHtml(rel));
  const derive = (entries) => deriveReferenceOnlyHtmlPaths(entries, { pathExists: syntacticHtmlExists });
  const expectFailure = (label, entries, pattern) => {
    let failure = null;
    try {
      derive(entries);
    } catch (error) {
      failure = error;
    }
    if (!failure) throw new Error(`cache-bust mutation survived: ${label}`);
    if (pattern && !pattern.test(String(failure.message))) {
      throw new Error(`cache-bust mutation failed for wrong reason (${label}): ${failure.message}`);
    }
  };

  expectFailure(
    'missing legacyStatus',
    [{ name: 'missing.json', profile: { legacyPath: 'index.html' } }],
    /missing explicit legacyStatus/
  );
  expectFailure(
    'unknown legacyStatus',
    [{ name: 'unknown.json', profile: { legacyStatus: 'mystery', legacyPath: 'index.html' } }],
    /unknown legacyStatus/
  );
  expectFailure(
    'path traversal',
    [{ name: 'traversal.json', profile: { legacyStatus: 'reference-only', legacyPath: '../outside.html' } }],
    /declared legacyPath not found/
  );
  expectFailure(
    'non-HTML legacyPath',
    [{ name: 'non-html.json', profile: { legacyStatus: 'reference-only', legacyPath: 'legacy/data.json' } }],
    /declared legacyPath not found/
  );
  expectFailure(
    'active-vs-reference duplicate claim',
    [
      { name: 'active.json', profile: { legacyStatus: 'runtime-required', legacyPath: 'legacy/shared/index.html' } },
      { name: 'reference.json', profile: { legacyStatus: 'reference-only', legacyPath: 'legacy/shared/index.html' } },
    ],
    /duplicate legacyPath/
  );
  expectFailure(
    '404 reference-only claim',
    [{ name: '404.json', profile: { legacyStatus: 'reference-only', legacyPath: '404.html' } }],
    /404\.html must remain an active utility surface/
  );

  const valid = derive([
    { name: 'home-reference.json', profile: { legacyStatus: 'reference-only', legacyPath: '/index.html' } },
    { name: 'active.json', profile: { legacyStatus: 'runtime-required', legacyPath: 'legacy/active/index.html' } },
    { name: 'absent.json', profile: { legacyStatus: 'absent' } },
  ]);
  if (!valid.has(path.join(ROOT, 'index.html'))) {
    throw new Error('cache-bust contract: leading-slash reference path was not normalized/protected');
  }
  if (valid.has(path.join(ROOT, 'legacy/active/index.html'))) {
    throw new Error('cache-bust contract: runtime-required HTML must remain in mutable revision coverage');
  }

  console.log('  ✔ cache-bust authority mutation contract: 8/8 checks');
}

function assertReferenceOnlyBoundaryContract(referenceOnlyHtml, htmlFiles) {
  if (!referenceOnlyHtml.size) {
    throw new Error('cache-bust authority contract expected at least one reference-only HTML snapshot');
  }

  const collected = new Set(htmlFiles.map((file) => path.resolve(file)));
  const protectedInCorpus = [...referenceOnlyHtml].filter((file) => collected.has(file));
  if (!protectedInCorpus.length) {
    throw new Error('cache-bust authority contract found no reference-only HTML inside rewrite corpus');
  }

  for (const file of protectedInCorpus) {
    if (!fs.existsSync(file)) throw new Error(`cache-bust protected snapshot missing: ${repoRel(file)}`);
  }

  const utility404 = path.join(ROOT, '404.html');
  if (referenceOnlyHtml.has(utility404)) {
    throw new Error('cache-bust authority contract must not classify 404.html as reference-only');
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
  assertAuthorityMutationContract();

  const referenceOnlyHtml = collectReferenceOnlyHtmlPaths();
  const htmlFiles = collectHTML(ROOT);
  assertReferenceOnlyBoundaryContract(referenceOnlyHtml, htmlFiles);

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

  let protectedCount = 0;
  for (const file of htmlFiles) {
    if (referenceOnlyHtml.has(path.resolve(file))) {
      protectedCount += 1;
      continue;
    }
    inspectFile(file, rewriteHTML, hashes, changes);
  }
  for (const file of collectAstro(path.join(ROOT, 'src'))) inspectFile(file, rewriteAstro, hashes, changes);

  console.log(`  ↪ preserved reference-only HTML snapshots: ${protectedCount}`);
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