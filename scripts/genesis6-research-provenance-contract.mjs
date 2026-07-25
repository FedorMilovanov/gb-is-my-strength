#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const rootArg = args.indexOf('--research-root');
const RESEARCH_ROOT = path.resolve(rootArg >= 0 ? args[rootArg + 1] : process.env.GENESIS6_RESEARCH_ROOT || path.join(ROOT, '_external/Research'));
const PROVENANCE_PATH = path.join(ROOT, 'data/genesis6-research-provenance.json');

const fail = (message) => {
  console.error(`ERROR genesis6 research provenance: ${message}`);
  process.exitCode = 1;
};
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const isFile = (file) => {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
};

if (!fs.existsSync(PROVENANCE_PATH)) {
  fail('missing data/genesis6-research-provenance.json');
  process.exit();
}

const provenance = readJson(PROVENANCE_PATH);
if (provenance.schemaVersion !== 1 || provenance.seriesId !== 'genesis-6') fail('invalid schemaVersion/seriesId');
if (!Array.isArray(provenance.articles) || provenance.articles.length !== 4) fail('exactly four article bindings are required');
if (provenance.publicationPolicy?.defaultState !== 'draft-noindex') fail('safe default must remain draft-noindex');
for (const field of ['requiresExactResearchCommit', 'requiresManifestDigest', 'requiresExactHeadSiteEvidence', 'productionWitnessSeparate']) {
  if (provenance.publicationPolicy?.[field] !== true) fail(`publicationPolicy.${field} must be true`);
}

const research = provenance.research || {};
if (research.repository !== 'FedorMilovanov/Research') fail('unexpected Research repository');
if (!/^[0-9a-f]{40}$/.test(research.commit || '')) fail('Research commit must be an exact SHA');
if (!/^[0-9a-f]{64}$/.test(research.manifestSha256 || '')) fail('manifestSha256 must be exact');
if (!fs.existsSync(RESEARCH_ROOT)) fail(`Research checkout is missing: ${RESEARCH_ROOT}`);

if (!process.exitCode) {
  let actualCommit = '';
  try {
    actualCommit = execFileSync('git', ['-C', RESEARCH_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch (error) {
    fail(`cannot resolve Research checkout HEAD: ${error.message}`);
  }
  if (actualCommit && actualCommit !== research.commit) fail(`Research HEAD ${actualCommit} != pinned ${research.commit}`);

  const manifestFile = path.join(RESEARCH_ROOT, research.manifestPath);
  const ledgerFile = path.join(RESEARCH_ROOT, research.ledgerPath);
  const contractFile = path.join(RESEARCH_ROOT, research.contractPath);
  for (const file of [manifestFile, ledgerFile, contractFile]) {
    if (!isFile(file)) fail(`missing pinned Research file: ${path.relative(RESEARCH_ROOT, file)}`);
  }

  if (!process.exitCode) {
    const digest = sha256(manifestFile);
    if (digest !== research.manifestSha256) fail(`manifest digest ${digest} != pinned ${research.manifestSha256}`);
    const manifest = readJson(manifestFile);
    const ledger = readJson(ledgerFile);
    if (manifest.seriesId !== 'genesis-6' || ledger.seriesId !== 'genesis-6') fail('Research manifest/ledger series mismatch');
    if (manifest.authorityBaseCommit !== research.authorityBaseCommit) fail('authorityBaseCommit drift');
    if (ledger.authorityBaseCommit !== research.authorityBaseCommit) fail('ledger authorityBaseCommit drift');
    if (ledger.manifestSha256 !== research.manifestSha256) fail('ledger manifest digest drift');

    const manifestBundles = new Map((manifest.publicationBundles || []).map((bundle) => [bundle.bundleId, bundle]));
    const ledgerBundles = new Map((ledger.bundles || []).map((bundle) => [bundle.bundleId, bundle]));
    const seenArticles = new Set();
    const seenSlugs = new Set();
    for (const binding of provenance.articles) {
      if (![6, 7, 8, 9].includes(binding.article)) fail(`unsupported article ${binding.article}`);
      if (seenArticles.has(binding.article)) fail(`duplicate article binding ${binding.article}`);
      if (seenSlugs.has(binding.slug)) fail(`duplicate article slug ${binding.slug}`);
      seenArticles.add(binding.article);
      seenSlugs.add(binding.slug);
      const expected = {
        bundleId: binding.bundleId,
        article: binding.article,
        readerBaseId: binding.readerBaseId,
        orderedDocumentIds: binding.orderedDocumentIds,
        rightsDecisionIds: binding.rightsDecisionIds,
        publicationStatus: 'eligible-after-site-technical-gates',
      };
      for (const [name, bundle] of [['manifest', manifestBundles.get(binding.bundleId)], ['ledger', ledgerBundles.get(binding.bundleId)]]) {
        if (!bundle) {
          fail(`${name} is missing bundle ${binding.bundleId}`);
          continue;
        }
        if (!isDeepStrictEqual(bundle, expected)) fail(`${name} bundle drift for ${binding.bundleId}`);
      }
    }
    if ([...seenArticles].sort().join(',') !== '6,7,8,9') fail('article bindings must cover exactly 6-9');
  }
}

if (!process.exitCode) {
  console.log(`Genesis 6 Research provenance: PASS (${research.commit}, ${provenance.articles.length} article bundles, manifest ${research.manifestSha256})`);
}
