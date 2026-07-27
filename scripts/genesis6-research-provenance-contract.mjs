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
const RESEARCH_ROOT = path.resolve(
  rootArg >= 0 ? args[rootArg + 1] : process.env.GENESIS6_RESEARCH_ROOT || path.join(ROOT, '_external/Research'),
);
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
const parseScalar = (raw) => {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value.replace(/^["']|["']$/g, '');
};
const frontmatterBlock = (source) => {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return match?.[1];
};
const frontmatterValue = (source, key) => {
  const block = frontmatterBlock(source);
  if (block === undefined) return undefined;
  const match = block.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
  return match ? parseScalar(match[1]) : undefined;
};
const frontmatterList = (source, key) => {
  const block = frontmatterBlock(source);
  if (block === undefined) return undefined;
  const lines = block.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trimEnd() === `${key}:`);
  if (start < 0) return undefined;

  const values = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const item = line.match(/^\s{2}-\s+(.+?)\s*$/);
    if (item) {
      values.push(parseScalar(item[1]));
      continue;
    }
    if (/^\s*$/.test(line)) continue;
    break;
  }
  return values;
};
const exactKeys = (value, expected, label) => {
  const actualKeys = Object.keys(value || {}).sort();
  const expectedKeys = [...expected].sort();
  if (!isDeepStrictEqual(actualKeys, expectedKeys)) {
    fail(`${label} keys must be exactly ${expectedKeys.join(', ')}`);
  }
};

if (!fs.existsSync(PROVENANCE_PATH)) {
  fail('missing data/genesis6-research-provenance.json');
  process.exit();
}

const provenance = readJson(PROVENANCE_PATH);
if (provenance.schemaVersion !== 3 || provenance.seriesId !== 'genesis-6') fail('invalid schemaVersion/seriesId');
if (provenance.releaseState !== 'blocked') {
  fail('releaseState must remain blocked until an explicit publication pass closes all named gates');
}
if (!Array.isArray(provenance.articles) || provenance.articles.length !== 4) {
  fail('exactly four legacy article bindings are required');
}
if (!Array.isArray(provenance.draftArticles) || provenance.draftArticles.length !== 2) {
  fail('exactly two extension draft article bindings are required');
}
if (!Array.isArray(provenance.siteArticles) || provenance.siteArticles.length !== 6) {
  fail('exactly six site article contracts are required');
}
if (!isDeepStrictEqual(provenance.readerOrder, ['6', '6A', '6B', '7', '8', '9'])) {
  fail('readerOrder must remain 6 → 6A → 6B → 7 → 8 → 9');
}
if (provenance.publicationPolicy?.defaultState !== 'draft-noindex') fail('safe default must remain draft-noindex');
for (const field of [
  'requiresExactResearchCommit',
  'requiresManifestDigest',
  'requiresExtensionManifestDigest',
  'requiresExactHeadSiteEvidence',
  'productionWitnessSeparate',
  'requiresAllSeriesArticlesDraftNoindex',
  'requiresExactCanonicalOverride',
  'requiresExactRelatedGraph',
  'requiresOrderedForwardLinks',
]) {
  if (provenance.publicationPolicy?.[field] !== true) fail(`publicationPolicy.${field} must be true`);
}

const research = provenance.research || {};
if (research.repository !== 'FedorMilovanov/Research') fail('unexpected Research repository');
if (!/^[0-9a-f]{40}$/.test(research.commit || '')) fail('Research commit must be an exact SHA');
if (!/^[0-9a-f]{64}$/.test(research.manifestSha256 || '')) fail('manifestSha256 must be exact');
if (!/^[0-9a-f]{64}$/.test(research.extension?.manifestSha256 || '')) {
  fail('extension manifestSha256 must be exact');
}
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
  const extensionManifestFile = path.join(RESEARCH_ROOT, research.extension.manifestPath);
  const extensionLedgerFile = path.join(RESEARCH_ROOT, research.extension.ledgerPath);
  const extensionValidatorFile = path.join(RESEARCH_ROOT, research.extension.validatorPath);
  for (const file of [
    manifestFile,
    ledgerFile,
    contractFile,
    extensionManifestFile,
    extensionLedgerFile,
    extensionValidatorFile,
  ]) {
    if (!isFile(file)) fail(`missing pinned Research file: ${path.relative(RESEARCH_ROOT, file)}`);
  }

  if (!process.exitCode) {
    const digest = sha256(manifestFile);
    if (digest !== research.manifestSha256) fail(`manifest digest ${digest} != pinned ${research.manifestSha256}`);
    const extensionDigest = sha256(extensionManifestFile);
    if (extensionDigest !== research.extension.manifestSha256) {
      fail(`extension manifest digest ${extensionDigest} != pinned ${research.extension.manifestSha256}`);
    }

    const manifest = readJson(manifestFile);
    const ledger = readJson(ledgerFile);
    if (manifest.seriesId !== 'genesis-6' || ledger.seriesId !== 'genesis-6') {
      fail('Research manifest/ledger series mismatch');
    }
    if (manifest.authorityBaseCommit !== research.authorityBaseCommit) fail('authorityBaseCommit drift');
    if (ledger.authorityBaseCommit !== research.authorityBaseCommit) fail('ledger authorityBaseCommit drift');
    if (ledger.manifestSha256 !== research.manifestSha256) fail('ledger manifest digest drift');

    const manifestBundles = new Map((manifest.publicationBundles || []).map((bundle) => [bundle.bundleId, bundle]));
    const ledgerBundles = new Map((ledger.bundles || []).map((bundle) => [bundle.bundleId, bundle]));
    const seenArticles = new Set();
    const seenSlugs = new Set();

    for (const binding of provenance.articles) {
      if (![6, 7, 8, 9].includes(binding.article)) fail(`unsupported legacy article ${binding.article}`);
      if (seenArticles.has(binding.article)) fail(`duplicate legacy article binding ${binding.article}`);
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
      for (const [name, bundle] of [
        ['manifest', manifestBundles.get(binding.bundleId)],
        ['ledger', ledgerBundles.get(binding.bundleId)],
      ]) {
        if (!bundle) {
          fail(`${name} is missing bundle ${binding.bundleId}`);
          continue;
        }
        if (!isDeepStrictEqual(bundle, expected)) fail(`${name} bundle drift for ${binding.bundleId}`);
      }
    }
    if ([...seenArticles].sort().join(',') !== '6,7,8,9') fail('legacy article bindings must cover exactly 6-9');

    const extensionManifest = readJson(extensionManifestFile);
    const extensionLedger = readJson(extensionLedgerFile);
    if (extensionManifest.seriesId !== 'genesis-6' || extensionLedger.seriesId !== 'genesis-6') {
      fail('extension manifest/ledger series mismatch');
    }
    if (extensionManifest.extensionId !== 'genesis6-enoch-articles-6a-6b') fail('extension manifest id drift');
    if (extensionLedger.extensionId !== 'genesis6-enoch-articles-6a-6b') fail('extension ledger id drift');
    if (extensionLedger.manifestSha256 !== research.extension.manifestSha256) {
      fail('extension ledger manifest digest drift');
    }

    const extensionManifestBundles = new Map(
      (extensionManifest.draftArticles || []).map((bundle) => [bundle.bundleId, bundle]),
    );
    const extensionLedgerBundles = new Map(
      (extensionLedger.bundles || []).map((bundle) => [bundle.bundleId, bundle]),
    );
    const seenExtensionKeys = new Set();

    for (const binding of provenance.draftArticles) {
      if (!['6A', '6B'].includes(binding.articleKey)) fail(`unsupported extension article ${binding.articleKey}`);
      if (seenExtensionKeys.has(binding.articleKey)) fail(`duplicate extension article ${binding.articleKey}`);
      if (seenSlugs.has(binding.slug)) fail(`duplicate article slug ${binding.slug}`);
      seenExtensionKeys.add(binding.articleKey);
      seenSlugs.add(binding.slug);

      const expected = {
        articleKey: binding.articleKey,
        slug: binding.slug,
        bundleId: binding.bundleId,
        orderedDocumentIds: binding.orderedDocumentIds,
        requiredSiteState: binding.requiredSiteState,
        rightsMode: binding.rightsMode,
        publicationStatus: binding.publicationStatus,
      };
      for (const [name, bundle] of [
        ['extension manifest', extensionManifestBundles.get(binding.bundleId)],
        ['extension ledger', extensionLedgerBundles.get(binding.bundleId)],
      ]) {
        if (!bundle) {
          fail(`${name} is missing bundle ${binding.bundleId}`);
          continue;
        }
        if (!isDeepStrictEqual(bundle, expected)) fail(`${name} bundle drift for ${binding.bundleId}`);
      }
    }
    if ([...seenExtensionKeys].sort().join(',') !== '6A,6B') {
      fail('extension bindings must cover exactly 6A and 6B');
    }
    if (seenSlugs.size !== 6) fail('the combined provenance graph must contain six unique slugs');

    const siteContracts = new Map();
    const siteSlugs = new Set();
    for (const article of provenance.siteArticles) {
      exactKeys(article, ['articleKey', 'slug', 'expectedRelatedSlugs'], `siteArticles.${article.articleKey || '?'}`);
      if (!provenance.readerOrder.includes(article.articleKey)) fail(`unsupported site article key ${article.articleKey}`);
      if (siteContracts.has(article.articleKey)) fail(`duplicate site article key ${article.articleKey}`);
      if (siteSlugs.has(article.slug)) fail(`duplicate site article slug ${article.slug}`);
      if (!Array.isArray(article.expectedRelatedSlugs)) fail(`${article.articleKey} expectedRelatedSlugs must be an array`);
      if (new Set(article.expectedRelatedSlugs).size !== article.expectedRelatedSlugs.length) {
        fail(`${article.articleKey} contains duplicate related slugs`);
      }
      if (article.expectedRelatedSlugs.includes(article.slug)) fail(`${article.articleKey} cannot relate to itself`);
      siteContracts.set(article.articleKey, article);
      siteSlugs.add(article.slug);
    }

    if (!isDeepStrictEqual([...siteContracts.keys()], provenance.readerOrder)) {
      fail('siteArticles must be declared in exact readerOrder');
    }
    if (!isDeepStrictEqual([...siteSlugs].sort(), [...seenSlugs].sort())) {
      fail('site article contracts must match the six Research-bound slugs exactly');
    }

    for (const articleKey of provenance.readerOrder) {
      const article = siteContracts.get(articleKey);
      const articleFile = path.join(ROOT, 'src/content/articles', `${article.slug}.mdx`);
      if (!isFile(articleFile)) {
        fail(`missing site article ${article.slug}`);
        continue;
      }

      const source = fs.readFileSync(articleFile, 'utf8');
      if (frontmatterBlock(source) === undefined) fail(`${articleKey} missing valid frontmatter`);
      const expectedScalars = {
        slug: article.slug,
        section: 'hard-texts',
        author: 'fedor-milovanov',
        series: 'genesis-6',
        draft: true,
        noindex: true,
        sourcesRequired: true,
        canonicalOverride: `https://gospod-bog.ru/hard-texts/${article.slug}/`,
        sourceMode: 'rendered',
      };
      for (const [field, expected] of Object.entries(expectedScalars)) {
        if (frontmatterValue(source, field) !== expected) fail(`${articleKey} ${field} drift`);
      }

      const related = frontmatterList(source, 'related');
      if (!isDeepStrictEqual(related, article.expectedRelatedSlugs)) {
        fail(`${articleKey} related graph drift`);
      }
      for (const relatedSlug of article.expectedRelatedSlugs) {
        if (!siteSlugs.has(relatedSlug)) fail(`${articleKey} related target is outside the series: ${relatedSlug}`);
      }
    }

    for (let index = 0; index < provenance.readerOrder.length - 1; index += 1) {
      const current = siteContracts.get(provenance.readerOrder[index]);
      const next = siteContracts.get(provenance.readerOrder[index + 1]);
      if (!current.expectedRelatedSlugs.includes(next.slug)) {
        fail(`reader-order link missing: ${current.articleKey} → ${next.articleKey}`);
      }
    }
  }
}

if (!process.exitCode) {
  console.log(
    `Genesis 6 Research provenance: PASS (${research.commit}, ` +
      `${provenance.articles.length} legacy bundles, ${provenance.draftArticles.length} extension draft bundles, ` +
      `${provenance.siteArticles.length} site contracts, release ${provenance.releaseState}, ` +
      `manifests ${research.manifestSha256} / ${research.extension.manifestSha256})`,
  );
}
