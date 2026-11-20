#!/usr/bin/env node
/*
 * head-asset-authority-contract-test.js — regression contract for
 * SYS-HEAD-ASSET-PROLIFERATION.
 *
 * Head asset versioning has ONE authority: src/lib/asset-version.js
 * (ASSET_VERSIONS + assetUrl). Hardcoded `?v=<hash>` literals in .astro
 * sources were the proliferation bug: every asset bump rewrote ~80 files and
 * literals silently drifted. This contract fails if a literal reappears or
 * if a registry asset is referenced in markup without assetUrl().
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const helper = fs.readFileSync(path.join(SRC, 'lib', 'asset-version.js'), 'utf8');
const REGISTRY = [];
for (const m of helper.matchAll(/'([^']+)': '[a-f0-9]{8}'/g)) REGISTRY.push(m[1]);
assert.ok(REGISTRY.length >= 30, `registry must cover the governed asset set, got ${REGISTRY.length}`);

const LITERAL_RE = /\?v=[a-f0-9]{8}/;
const BARE_REF_RE = /(href|src)="((?:\.{0,2}\/|\/)*((?:css|js|fonts|nagornaya)\/[^"?]*\.(?:css|js)))"/;

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (e.name.endsWith('.astro')) acc.push(full);
  }
  return acc;
}
const astroFiles = walk(SRC, []);

// 1. No `?v=<hex>` literal anywhere in .astro sources (attributes or comments).
//    Explicit holdover exceptions (owner directive 7038165755, PR #2348):
//    these files belong to other PRs that already own the same content;
//    their migration to assetUrl() is deferred to those PRs and must not
//    be re-implemented here.
const LITERAL_HOLDINGS = new Set([
  // No open merge-candidate PR owns the articles route head assets; the
  // migration is deferred by PR #2348 merge-prep (owner directive
  // 7038165755: minimize exclusive-path surface vs earlier same-base PRs).
  'src/components/articles/ArticlesPageChrome.astro',
  'src/components/articles/ArticlesPageFooter.astro',
  'src/components/journal/JournalDocumentHead.astro', // PR #2345 (journal head SEO authority)
]);
const offenders = astroFiles.filter((file) => LITERAL_RE.test(fs.readFileSync(file, 'utf8')))
  .map((file) => path.relative(ROOT, file))
  .filter((file) => !LITERAL_HOLDINGS.has(file));
assert.deepEqual(offenders, [], `?v= hash literals must not exist in .astro sources (use assetUrl): ${offenders.join(', ')}`);

// 2. Registry assets referenced in markup must go through assetUrl()
const bare = [];
for (const file of astroFiles) {
  const rel = path.relative(ROOT, file);
  if (LITERAL_HOLDINGS.has(rel)) continue; // handoff to owning PR
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(new RegExp(BARE_REF_RE.source, 'g'))) {
    if (REGISTRY.includes(m[3])) bare.push(`${rel}: ${m[2]}`);
  }
}
assert.deepEqual(bare, [], `registry assets must be referenced via assetUrl(), not bare literals: ${bare.join(', ')}`);

// 3. assetUrl() helper contract: versioned for registry, bare otherwise
assert.ok(helper.includes('export function assetUrl('), 'assetUrl helper must exist');
assert.ok(helper.includes('`/${clean}?v=${v}`'), 'assetUrl must emit /<path>?v=<hash> for registry assets');
assert.ok(helper.includes('`/${clean}`'), 'assetUrl must fall back to /<path> for unregistered assets');

// 4. Negative witnesses on the detectors themselves
const witnessLiteral = '<link rel="stylesheet" href="/css/site.css?v=511fb678">';
assert.ok(LITERAL_RE.test(witnessLiteral), 'negative witness: literal detector must fire');
const witnessBare = '<script src="../../js/site.js"></script>';
const bareMatch = new RegExp(BARE_REF_RE.source).exec(witnessBare);
assert.ok(bareMatch && REGISTRY.includes(bareMatch[3]), 'negative witness: bare-ref detector must fire');
const cleanUsage = "<script src={assetUrl('js/site.js')}></script>";
assert.ok(!LITERAL_RE.test(cleanUsage), 'assetUrl usage must not trip the literal detector');

console.log(`✅ head asset authority contract: PASS (${REGISTRY.length} governed assets, ${astroFiles.length} astro files, 2 negative witnesses)`);
