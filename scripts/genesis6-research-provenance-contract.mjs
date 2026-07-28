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

const EXPECTED_RESEARCH_COMMIT = '11e86a120f212d75cf01667d7d3bfa72ed9c327a';
const EXPECTED_EXTENSION_DIGEST = '8cfdadd344f15a752ee279d1c1122079fcacbbd97650dd39151872e5618099ef';
const EXPECTED_BLOCKING_HOLDS = [
  '1-enoch-70-71-son-of-man',
  'astronomical-book-version-plurality',
];
const EXPECTED_PRESERVED_HOLDS = [
  '1-enoch-10-8-interpretive-scope',
  '1-enoch-15-8-12-version-details-and-demon-identity',
  'parables-date-and-witness-form',
  'animal-apocalypse-decomposition',
  'chapter-108-relation-to-epistle',
  'codex-panopolitanus-editorial-intention',
];
const EXPECTED_EVIDENCE_RESOLUTIONS = [
  {
    id: '1-enoch-10-8-version-control',
    resolution: 'text-established-interpretation-qualified',
    documentId: 'GEN6-ENOCH-10-8-DECISION-LX',
    evidence: "Greek and Ge'ez full clause; Aramaic 4Q202 locus 10:8-12 partial/reconstructed",
  },
  {
    id: '1-enoch-15-8-12-demon-origin',
    resolution: 'core-model-established-canonical-status-qualified',
    documentId: 'GEN6-ENOCH-15-8-12-DECISION-LXI',
    evidence: "Greek Syncellus and Codex Panopolitanus plus full Ge'ez preserve the core model; Aramaic 4Q204 is contextual/partial",
  },
];
const EXPECTED_RESOLVED_HOLDS = [
  {
    id: 'manuscript-image-rights',
    resolution: 'no-manuscript-image-reproduction',
    evidence: 'site main 522f0e1cae4fb9ce5a4631cfe856421f1952f4bc',
  },
];
const EXPECTED_SITE_ACCEPTANCE = {
  acceptedHead: 'b315998937e4fdd68e204d01660adb65707cd0e6',
  mergeCommit: '522f0e1cae4fb9ce5a4631cfe856421f1952f4bc',
  claimLevelGroups: { '6A': 27, '6B': 26 },
};

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
const frontmatterBlock = (source) => source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
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

if (!isFile(PROVENANCE_PATH)) {
  fail('missing data/genesis6-research-provenance.json');
  process.exit();
}

const provenance = readJson(PROVENANCE_PATH);
if (provenance.schemaVersion !== 6 || provenance.seriesId !== 'genesis-6') fail('invalid schemaVersion/seriesId');
if (provenance.releaseState !== 'blocked') fail('releaseState must remain blocked');
if (!isDeepStrictEqual(provenance.readerOrder, ['6', '6A', '6B', '7', '8', '9'])) fail('readerOrder drift');
if (!Array.isArray(provenance.articles) || provenance.articles.length !== 4) fail('four legacy bindings required');
if (!Array.isArray(provenance.draftArticles) || provenance.draftArticles.length !== 2) fail('two extension bindings required');
if (!Array.isArray(provenance.siteArticles) || provenance.siteArticles.length !== 6) fail('six site contracts required');

const policyFields = [
  'requiresExactResearchCommit',
  'requiresManifestDigest',
  'requiresExtensionManifestDigest',
  'requiresExactHeadSiteEvidence',
  'productionWitnessSeparate',
  'requiresAllSeriesArticlesDraftNoindex',
  'requiresExactCanonicalOverride',
  'requiresExactRelatedGraph',
  'requiresOrderedForwardLinks',
  'requiresExactHoldClassification',
  'requiresNoReproductionRightsResolution',
  'requiresEvidenceResolutionBinding',
];
if (provenance.publicationPolicy?.defaultState !== 'draft-noindex') fail('safe default must remain draft-noindex');
for (const field of policyFields) {
  if (provenance.publicationPolicy?.[field] !== true) fail(`publicationPolicy.${field} must be true`);
}

const research = provenance.research || {};
if (research.repository !== 'FedorMilovanov/Research') fail('unexpected Research repository');
if (research.commit !== EXPECTED_RESEARCH_COMMIT) fail('Research commit pin drift');
if (!/^[0-9a-f]{64}$/.test(research.manifestSha256 || '')) fail('legacy manifest digest must be exact');
if (research.extension?.schemaVersion !== 4) fail('extension schemaVersion must be 4');
if (research.extension?.manifestSha256 !== EXPECTED_EXTENSION_DIGEST) fail('extension digest pin drift');
if (!isDeepStrictEqual(research.extension?.blockingHolds, EXPECTED_BLOCKING_HOLDS)) fail('blocking HOLD pin drift');
if (!isDeepStrictEqual(research.extension?.preservedUncertainty, EXPECTED_PRESERVED_HOLDS)) fail('preserved uncertainty pin drift');
if (!isDeepStrictEqual(research.extension?.resolvedByEvidence, EXPECTED_EVIDENCE_RESOLUTIONS)) fail('evidence resolution pin drift');
if (!isDeepStrictEqual(research.extension?.resolvedByPolicy, EXPECTED_RESOLVED_HOLDS)) fail('policy resolution pin drift');
if (!isDeepStrictEqual(research.extension?.siteAcceptance, EXPECTED_SITE_ACCEPTANCE)) fail('site acceptance pin drift');
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
  for (const file of [manifestFile, ledgerFile, contractFile, extensionManifestFile, extensionLedgerFile, extensionValidatorFile]) {
    if (!isFile(file)) fail(`missing pinned Research file: ${path.relative(RESEARCH_ROOT, file)}`);
  }

  if (!process.exitCode) {
    if (sha256(manifestFile) !== research.manifestSha256) fail('legacy manifest digest drift');
    if (sha256(extensionManifestFile) !== research.extension.manifestSha256) fail('extension manifest digest drift');
    try {
      execFileSync('python3', [extensionValidatorFile, '--root', RESEARCH_ROOT], { stdio: 'inherit' });
    } catch (error) {
      fail(`pinned Research extension validator failed: ${error.message}`);
    }

    const manifest = readJson(manifestFile);
    const ledger = readJson(ledgerFile);
    if (manifest.seriesId !== 'genesis-6' || ledger.seriesId !== 'genesis-6') fail('legacy authority series mismatch');
    if (manifest.authorityBaseCommit !== research.authorityBaseCommit) fail('legacy manifest authorityBaseCommit drift');
    if (ledger.authorityBaseCommit !== research.authorityBaseCommit) fail('legacy ledger authorityBaseCommit drift');
    if (ledger.manifestSha256 !== research.manifestSha256) fail('legacy ledger digest drift');

    const manifestBundles = new Map((manifest.publicationBundles || []).map((bundle) => [bundle.bundleId, bundle]));
    const ledgerBundles = new Map((ledger.bundles || []).map((bundle) => [bundle.bundleId, bundle]));
    const seenArticles = new Set();
    const seenSlugs = new Set();
    for (const binding of provenance.articles) {
      if (![6, 7, 8, 9].includes(binding.article)) fail(`unsupported legacy article ${binding.article}`);
      if (seenArticles.has(binding.article)) fail(`duplicate legacy article ${binding.article}`);
      if (seenSlugs.has(binding.slug)) fail(`duplicate slug ${binding.slug}`);
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
      if (!isDeepStrictEqual(manifestBundles.get(binding.bundleId), expected)) fail(`legacy manifest bundle drift ${binding.bundleId}`);
      if (!isDeepStrictEqual(ledgerBundles.get(binding.bundleId), expected)) fail(`legacy ledger bundle drift ${binding.bundleId}`);
    }
    if ([...seenArticles].sort().join(',') !== '6,7,8,9') fail('legacy bindings must cover 6-9');

    const extensionManifest = readJson(extensionManifestFile);
    const extensionLedger = readJson(extensionLedgerFile);
    if (extensionManifest.schemaVersion !== 4 || extensionLedger.schemaVersion !== 4) fail('extension schema mismatch');
    if (extensionManifest.seriesId !== 'genesis-6' || extensionLedger.seriesId !== 'genesis-6') fail('extension series mismatch');
    if (extensionManifest.extensionId !== 'genesis6-enoch-articles-6a-6b') fail('extension manifest id drift');
    if (extensionLedger.extensionId !== 'genesis6-enoch-articles-6a-6b') fail('extension ledger id drift');
    if (extensionLedger.manifestSha256 !== research.extension.manifestSha256) fail('extension ledger digest drift');
    if (!isDeepStrictEqual(extensionManifest.holdRegistry?.blocking, EXPECTED_BLOCKING_HOLDS)) fail('Research blocking HOLD drift');
    if (!isDeepStrictEqual(extensionManifest.holdRegistry?.preservedUncertainty, EXPECTED_PRESERVED_HOLDS)) fail('Research preserved uncertainty drift');
    if (!isDeepStrictEqual(extensionManifest.holdRegistry?.resolvedByEvidence, EXPECTED_EVIDENCE_RESOLUTIONS)) fail('Research evidence resolution drift');
    if (!isDeepStrictEqual(extensionManifest.holdRegistry?.resolvedByPolicy, EXPECTED_RESOLVED_HOLDS)) fail('Research policy resolution drift');

    const documentById = new Map((extensionManifest.documents || []).map((document) => [document.id, document]));
    for (const resolution of EXPECTED_EVIDENCE_RESOLUTIONS) {
      const document = documentById.get(resolution.documentId);
      if (!document) {
        fail(`missing evidence document ${resolution.documentId}`);
        continue;
      }
      if (document.role !== 'locus-version-control-decision') fail(`${resolution.documentId} role drift`);
      if (!isDeepStrictEqual(document.requiredFor, ['6B'])) fail(`${resolution.documentId} requiredFor drift`);
      if (!isFile(path.join(RESEARCH_ROOT, document.path))) fail(`${resolution.documentId} file missing`);
    }

    const acceptance = extensionManifest.siteAcceptance || {};
    const acceptanceSubset = {
      acceptedHead: acceptance.acceptedHead,
      mergeCommit: acceptance.mergeCommit,
      claimLevelGroups: acceptance.claimLevelGroups,
    };
    if (!isDeepStrictEqual(acceptanceSubset, EXPECTED_SITE_ACCEPTANCE)) fail('Research site acceptance drift');
    if (acceptance.publicationAuthorized !== false) fail('Research site acceptance must not publish');

    const release = extensionLedger.releaseDecision || {};
    if (release.state !== 'blocked' || release.mayPublish !== false || release.mayRemoveNoindex !== false) {
      fail('extension release must remain blocked');
    }
    if (!isDeepStrictEqual(release.blockingHolds, EXPECTED_BLOCKING_HOLDS)) fail('ledger blocking HOLD drift');
    if (!isDeepStrictEqual(release.preservedUncertainty, EXPECTED_PRESERVED_HOLDS)) fail('ledger preserved uncertainty drift');
    if (!isDeepStrictEqual(release.resolvedByEvidence, EXPECTED_EVIDENCE_RESOLUTIONS)) fail('ledger evidence resolution drift');
    if (!isDeepStrictEqual(release.resolvedByPolicy, EXPECTED_RESOLVED_HOLDS)) fail('ledger policy resolution drift');

    const extensionManifestBundles = new Map((extensionManifest.draftArticles || []).map((bundle) => [bundle.bundleId, bundle]));
    const extensionLedgerBundles = new Map((extensionLedger.bundles || []).map((bundle) => [bundle.bundleId, bundle]));
    const seenExtensionKeys = new Set();
    for (const binding of provenance.draftArticles) {
      if (!['6A', '6B'].includes(binding.articleKey)) fail(`unsupported extension article ${binding.articleKey}`);
      if (seenExtensionKeys.has(binding.articleKey)) fail(`duplicate extension article ${binding.articleKey}`);
      if (seenSlugs.has(binding.slug)) fail(`duplicate slug ${binding.slug}`);
      seenExtensionKeys.add(binding.articleKey);
      seenSlugs.add(binding.slug);
      if (!isDeepStrictEqual(extensionManifestBundles.get(binding.bundleId), binding)) fail(`extension manifest bundle drift ${binding.bundleId}`);
      if (!isDeepStrictEqual(extensionLedgerBundles.get(binding.bundleId), binding)) fail(`extension ledger bundle drift ${binding.bundleId}`);
    }
    if ([...seenExtensionKeys].sort().join(',') !== '6A,6B') fail('extension bindings must cover 6A and 6B');
    if (seenSlugs.size !== 6) fail('combined provenance must contain six unique slugs');

    const siteContracts = new Map();
    const siteSlugs = new Set();
    for (const article of provenance.siteArticles) {
      exactKeys(article, ['articleKey', 'slug', 'expectedRelatedSlugs'], `siteArticles.${article.articleKey || '?'}`);
      if (!provenance.readerOrder.includes(article.articleKey)) fail(`unsupported site article ${article.articleKey}`);
      if (siteContracts.has(article.articleKey)) fail(`duplicate site article ${article.articleKey}`);
      if (siteSlugs.has(article.slug)) fail(`duplicate site slug ${article.slug}`);
      if (!Array.isArray(article.expectedRelatedSlugs)) fail(`${article.articleKey} related must be an array`);
      if (new Set(article.expectedRelatedSlugs).size !== article.expectedRelatedSlugs.length) fail(`${article.articleKey} duplicate related slug`);
      if (article.expectedRelatedSlugs.includes(article.slug)) fail(`${article.articleKey} cannot relate to itself`);
      siteContracts.set(article.articleKey, article);
      siteSlugs.add(article.slug);
    }
    if (!isDeepStrictEqual([...siteContracts.keys()], provenance.readerOrder)) fail('site contracts must follow readerOrder');
    if (!isDeepStrictEqual([...siteSlugs].sort(), [...seenSlugs].sort())) fail('site contracts must match Research-bound slugs');

    for (const articleKey of provenance.readerOrder) {
      const article = siteContracts.get(articleKey);
      const articleFile = path.join(ROOT, 'src/content/articles', `${article.slug}.mdx`);
      if (!isFile(articleFile)) {
        fail(`missing site article ${article.slug}`);
        continue;
      }
      const source = fs.readFileSync(articleFile, 'utf8');
      if (frontmatterBlock(source) === undefined) fail(`${articleKey} missing frontmatter`);
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
      for (const [key, expected] of Object.entries(expectedScalars)) {
        if (frontmatterValue(source, key) !== expected) fail(`${articleKey} frontmatter ${key} drift`);
      }
      const related = frontmatterList(source, 'related');
      if (!isDeepStrictEqual(related, article.expectedRelatedSlugs)) fail(`${articleKey} related graph drift`);
      for (const relatedSlug of article.expectedRelatedSlugs) {
        if (!siteSlugs.has(relatedSlug)) fail(`${articleKey} related target outside series: ${relatedSlug}`);
      }
    }
    for (let index = 0; index < provenance.readerOrder.length - 1; index += 1) {
      const current = siteContracts.get(provenance.readerOrder[index]);
      const next = siteContracts.get(provenance.readerOrder[index + 1]);
      if (!current.expectedRelatedSlugs.includes(next.slug)) fail(`reader-order link missing: ${current.articleKey} → ${next.articleKey}`);
    }
  }
}

if (!process.exitCode) {
  console.log(
    `Genesis 6 Research provenance: PASS (${research.commit}, ` +
      `${provenance.articles.length} legacy bundles, ${provenance.draftArticles.length} source-audited extension bundles, ` +
      `${research.extension.blockingHolds.length} blocking HOLDs, ${research.extension.resolvedByEvidence.length} evidence resolutions, ` +
      `${provenance.siteArticles.length} site contracts, release ${provenance.releaseState}, ` +
      `manifests ${research.manifestSha256} / ${research.extension.manifestSha256})`,
  );
}
