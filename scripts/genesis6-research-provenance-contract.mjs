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
const SERIES_DATA_PATH = path.join(
  ROOT,
  'src/components/article-pilots/_shared/series/genesis6SeriesData.ts',
);
const IMAGE_MANIFEST_PATH = path.join(ROOT, 'public/images/articles/genesis6/manifest.json');

const EXPECTED_RESEARCH_COMMIT = '753e09027d4a33af5659ce1221ef8371e9dfae22';
const EXPECTED_LEGACY_DIGEST = '95320cc56c678fcacf4f24985f96150c231b1d91338349c19005e277b16125dd';
const EXPECTED_EXTENSION_DIGEST = '947e7b86705fd1729f86f0f99c60afee9b850f794d439729698be7d2f1edaaf7';
const EXPECTED_READER_ORDER = ['6', '6A', '6B', '7', '8', '9'];
const EXPECTED_TOTAL_MINUTES = 170;
const EXPECTED_BLOCKING_HOLDS = [];
const EXPECTED_PRESERVED_UNCERTAINTY = [
  '1-enoch-10-8-interpretive-scope',
  '1-enoch-15-8-12-version-details-and-demon-identity',
  '1-enoch-70-71-composition-and-figure-identity',
  'astronomical-book-reconstruction-direction-and-joins',
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
  {
    id: '1-enoch-70-71-son-of-man',
    resolution: 'direct-address-established-composition-and-identity-qualified',
    documentId: 'GEN6-ENOCH-70-71-DECISION-LXV',
    evidence: 'LXII evidence chain plus modern critical translation support second-person 71:14; Charles third-person is an emendation; composition and total identity remain qualified',
  },
  {
    id: 'astronomical-book-version-plurality',
    resolution: 'textual-plurality-established-evolution-model-qualified',
    documentId: 'GEN6-ENOCH-ASTRONOMICAL-DECISION-LXVI',
    evidence: "4Q208/4Q209 continuity and scheme-level plurality are established by Ratzon's full reconstruction; direction of adaptation and exact joins remain qualified",
  },
];
const EXPECTED_POLICY_RESOLUTIONS = [
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
const DECISION_DOCUMENTS = new Map([
  [
    'GEN6-ENOCH-10-8-DECISION-LX',
    {
      path: 'ТРУДНЫЕ ТЕКСТЫ/1_ENOCH_LX_10_8_VERSION_CONTROL_DECISION.md',
      requiredFor: ['6B'],
    },
  ],
  [
    'GEN6-ENOCH-15-8-12-DECISION-LXI',
    {
      path: 'ТРУДНЫЕ ТЕКСТЫ/1_ENOCH_LXI_15_8_12_DEMON_ORIGIN_VERSION_CONTROL_DECISION.md',
      requiredFor: ['6B'],
    },
  ],
  [
    'GEN6-ENOCH-70-71-DECISION-LXV',
    {
      path: 'ТРУДНЫЕ ТЕКСТЫ/1_ENOCH_LXV_70_71_SON_OF_MAN_AUTHORITY_DECISION.md',
      requiredFor: ['6B'],
    },
  ],
  [
    'GEN6-ENOCH-ASTRONOMICAL-DECISION-LXVI',
    {
      path: 'ТРУДНЫЕ ТЕКСТЫ/1_ENOCH_LXVI_ASTRONOMICAL_BOOK_VERSION_PLURALITY_AUTHORITY_DECISION.md',
      requiredFor: ['6A', '6B'],
    },
  ],
]);
const EXPECTED_ASSET_IDS = new Map([
  ['6', '06-enoch-prophesied-and-apostolic-witness'],
  ['6A', '03-what-is-first-enoch'],
  ['6B', '04-book-of-watchers'],
  ['7', '07-angels-kept-under-darkness'],
  ['8', '08-spirits-in-prison'],
  ['9', '09-gospel-preached-to-the-dead'],
]);

const failures = [];
const fail = (message) => failures.push(message);
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
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
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
const requireEqual = (actual, expected, label) => {
  if (!isDeepStrictEqual(actual, expected)) fail(`${label} drift`);
};
const countFootnoteDefinitions = (source) => source.match(/^\[\^\d+\]:/gm)?.length || 0;
const parseSeriesItems = (source) => {
  const items = [];
  const pattern = /\{\s*id:\s*'([^']+)',[\s\S]*?slug:\s*'([^']+)',[\s\S]*?minutes:\s*(\d+),[\s\S]*?cover:\s*'([^']+)',[\s\S]*?coverAvif:\s*'([^']+)',[\s\S]*?coverAlt:\s*'([^']+)',[\s\S]*?\n\s*\},/g;
  for (const match of source.matchAll(pattern)) {
    items.push({
      id: match[1],
      slug: match[2],
      minutes: Number(match[3]),
      cover: match[4],
      coverAvif: match[5],
      coverAlt: match[6],
    });
  }
  return items;
};

for (const [label, file] of [
  ['provenance', PROVENANCE_PATH],
  ['Genesis series data', SERIES_DATA_PATH],
  ['Genesis image manifest', IMAGE_MANIFEST_PATH],
]) {
  if (!isFile(file)) fail(`missing ${label}: ${file}`);
}
if (failures.length) {
  for (const message of failures) console.error(`ERROR genesis6 research provenance: ${message}`);
  process.exit(1);
}

const provenance = readJson(PROVENANCE_PATH);
if (provenance.schemaVersion !== 6 || provenance.seriesId !== 'genesis-6') {
  fail('invalid provenance schemaVersion/seriesId');
}
if (provenance.releaseState !== 'blocked') fail('releaseState must remain blocked');
requireEqual(provenance.readerOrder, EXPECTED_READER_ORDER, 'readerOrder');
if (provenance.publicationPolicy?.defaultState !== 'draft-noindex') fail('defaultState must be draft-noindex');
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
  'requiresExactHoldClassification',
  'requiresNoReproductionRightsResolution',
  'requiresEvidenceResolutionBinding',
]) {
  if (provenance.publicationPolicy?.[field] !== true) fail(`publicationPolicy.${field} must be true`);
}

const research = provenance.research || {};
if (research.repository !== 'FedorMilovanov/Research') fail('unexpected Research repository');
if (research.commit !== EXPECTED_RESEARCH_COMMIT) fail('Research commit pin drift');
if (research.manifestSha256 !== EXPECTED_LEGACY_DIGEST) fail('legacy manifest digest pin drift');
if (research.extension?.schemaVersion !== 6) fail('extension schemaVersion must be 6');
if (research.extension?.manifestSha256 !== EXPECTED_EXTENSION_DIGEST) fail('extension manifest digest pin drift');
requireEqual(research.extension?.blockingHolds, EXPECTED_BLOCKING_HOLDS, 'blocking HOLD classification');
requireEqual(
  research.extension?.preservedUncertainty,
  EXPECTED_PRESERVED_UNCERTAINTY,
  'preserved uncertainty classification',
);
requireEqual(research.extension?.resolvedByEvidence, EXPECTED_EVIDENCE_RESOLUTIONS, 'evidence resolutions');
requireEqual(research.extension?.resolvedByPolicy, EXPECTED_POLICY_RESOLUTIONS, 'policy resolutions');
requireEqual(research.extension?.siteAcceptance, EXPECTED_SITE_ACCEPTANCE, 'site acceptance');

if (!fs.existsSync(RESEARCH_ROOT)) fail(`Research checkout is missing: ${RESEARCH_ROOT}`);

let actualResearchCommit = '';
if (!failures.length) {
  try {
    actualResearchCommit = execFileSync('git', ['-C', RESEARCH_ROOT, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
  } catch (error) {
    fail(`cannot resolve Research checkout HEAD: ${error.message}`);
  }
}
if (actualResearchCommit && actualResearchCommit !== EXPECTED_RESEARCH_COMMIT) {
  fail(`Research HEAD ${actualResearchCommit} != pinned ${EXPECTED_RESEARCH_COMMIT}`);
}

const researchFiles = {
  legacyManifest: path.join(RESEARCH_ROOT, research.manifestPath || ''),
  legacyLedger: path.join(RESEARCH_ROOT, research.ledgerPath || ''),
  legacyContract: path.join(RESEARCH_ROOT, research.contractPath || ''),
  extensionManifest: path.join(RESEARCH_ROOT, research.extension?.manifestPath || ''),
  extensionLedger: path.join(RESEARCH_ROOT, research.extension?.ledgerPath || ''),
  extensionValidator: path.join(RESEARCH_ROOT, research.extension?.validatorPath || ''),
};
for (const [label, file] of Object.entries(researchFiles)) {
  if (!isFile(file)) fail(`missing pinned Research file ${label}: ${file}`);
}

let legacyManifest;
let legacyLedger;
let extensionManifest;
let extensionLedger;
if (!failures.length) {
  if (sha256(researchFiles.legacyManifest) !== EXPECTED_LEGACY_DIGEST) fail('legacy manifest digest mismatch');
  if (sha256(researchFiles.extensionManifest) !== EXPECTED_EXTENSION_DIGEST) fail('extension manifest digest mismatch');
  legacyManifest = readJson(researchFiles.legacyManifest);
  legacyLedger = readJson(researchFiles.legacyLedger);
  extensionManifest = readJson(researchFiles.extensionManifest);
  extensionLedger = readJson(researchFiles.extensionLedger);
  try {
    execFileSync('python3', [researchFiles.extensionValidator, '--root', RESEARCH_ROOT], { stdio: 'inherit' });
  } catch (error) {
    fail(`pinned Research extension validator failed: ${error.message}`);
  }
}

if (legacyManifest && legacyLedger) {
  if (legacyManifest.seriesId !== 'genesis-6' || legacyLedger.seriesId !== 'genesis-6') {
    fail('legacy manifest/ledger series mismatch');
  }
  if (legacyManifest.authorityBaseCommit !== research.authorityBaseCommit) fail('legacy authorityBaseCommit drift');
  if (legacyLedger.authorityBaseCommit !== research.authorityBaseCommit) fail('legacy ledger authorityBaseCommit drift');
  if (legacyLedger.manifestSha256 !== EXPECTED_LEGACY_DIGEST) fail('legacy ledger digest drift');

  const manifestBundles = new Map((legacyManifest.publicationBundles || []).map((item) => [item.bundleId, item]));
  const ledgerBundles = new Map((legacyLedger.bundles || []).map((item) => [item.bundleId, item]));
  if (!Array.isArray(provenance.articles) || provenance.articles.length !== 4) fail('exactly four legacy bindings required');
  for (const binding of provenance.articles || []) {
    const expected = {
      bundleId: binding.bundleId,
      article: binding.article,
      readerBaseId: binding.readerBaseId,
      orderedDocumentIds: binding.orderedDocumentIds,
      rightsDecisionIds: binding.rightsDecisionIds,
      publicationStatus: 'eligible-after-site-technical-gates',
    };
    requireEqual(manifestBundles.get(binding.bundleId), expected, `legacy manifest bundle ${binding.bundleId}`);
    requireEqual(ledgerBundles.get(binding.bundleId), expected, `legacy ledger bundle ${binding.bundleId}`);
  }
}

if (extensionManifest && extensionLedger) {
  if (extensionManifest.schemaVersion !== 6 || extensionLedger.schemaVersion !== 6) {
    fail('extension manifest/ledger schemaVersion must be 6');
  }
  if (extensionManifest.seriesId !== 'genesis-6' || extensionLedger.seriesId !== 'genesis-6') {
    fail('extension manifest/ledger series mismatch');
  }
  if (extensionLedger.manifestSha256 !== EXPECTED_EXTENSION_DIGEST) fail('extension ledger digest drift');
  requireEqual(extensionManifest.holdRegistry?.blocking, EXPECTED_BLOCKING_HOLDS, 'extension manifest blockers');
  requireEqual(extensionLedger.releaseDecision?.blockingHolds, EXPECTED_BLOCKING_HOLDS, 'extension ledger blockers');
  requireEqual(
    extensionManifest.holdRegistry?.preservedUncertainty,
    EXPECTED_PRESERVED_UNCERTAINTY,
    'extension manifest preserved uncertainty',
  );
  requireEqual(
    extensionLedger.releaseDecision?.preservedUncertainty,
    EXPECTED_PRESERVED_UNCERTAINTY,
    'extension ledger preserved uncertainty',
  );
  requireEqual(extensionManifest.holdRegistry?.resolvedByEvidence, EXPECTED_EVIDENCE_RESOLUTIONS, 'manifest evidence resolutions');
  requireEqual(extensionLedger.releaseDecision?.resolvedByEvidence, EXPECTED_EVIDENCE_RESOLUTIONS, 'ledger evidence resolutions');
  requireEqual(extensionManifest.holdRegistry?.resolvedByPolicy, EXPECTED_POLICY_RESOLUTIONS, 'manifest policy resolutions');
  requireEqual(extensionLedger.releaseDecision?.resolvedByPolicy, EXPECTED_POLICY_RESOLUTIONS, 'ledger policy resolutions');
  if (extensionManifest.siteAcceptance?.publicationAuthorized !== false) fail('site acceptance must not authorize publication');
  if (
    extensionLedger.releaseDecision?.state !== 'blocked' ||
    extensionLedger.releaseDecision?.mayPublish !== false ||
    extensionLedger.releaseDecision?.mayRemoveNoindex !== false ||
    extensionLedger.releaseDecision?.researchBlockersClosed !== true ||
    extensionLedger.releaseDecision?.siteImplementationRequired !== true ||
    extensionLedger.releaseDecision?.explicitPublicationPassRequired !== true
  ) {
    fail('extension release must remain fail-closed after Research blocker closure');
  }

  const documents = new Map((extensionManifest.documents || []).map((item) => [item.id, item]));
  for (const resolution of EXPECTED_EVIDENCE_RESOLUTIONS) {
    const document = documents.get(resolution.documentId);
    const decision = DECISION_DOCUMENTS.get(resolution.documentId);
    requireEqual(
      document,
      {
        id: resolution.documentId,
        path: decision?.path,
        role: 'locus-version-control-decision',
        requiredFor: decision?.requiredFor,
      },
      `decision binding ${resolution.documentId}`,
    );
    if (!decision || !isFile(path.join(RESEARCH_ROOT, decision.path))) fail(`missing decision file ${resolution.documentId}`);
  }

  const manifestBundles = new Map((extensionManifest.draftArticles || []).map((item) => [item.bundleId, item]));
  const ledgerBundles = new Map((extensionLedger.bundles || []).map((item) => [item.bundleId, item]));
  if (!Array.isArray(provenance.draftArticles) || provenance.draftArticles.length !== 2) {
    fail('exactly two extension bindings required');
  }
  for (const binding of provenance.draftArticles || []) {
    const expected = {
      articleKey: binding.articleKey,
      slug: binding.slug,
      bundleId: binding.bundleId,
      orderedDocumentIds: binding.orderedDocumentIds,
      requiredSiteState: binding.requiredSiteState,
      rightsMode: binding.rightsMode,
      publicationStatus: binding.publicationStatus,
    };
    requireEqual(manifestBundles.get(binding.bundleId), expected, `extension manifest bundle ${binding.bundleId}`);
    requireEqual(ledgerBundles.get(binding.bundleId), expected, `extension ledger bundle ${binding.bundleId}`);
  }
}

if (!Array.isArray(provenance.siteArticles) || provenance.siteArticles.length !== 6) {
  fail('exactly six site article contracts required');
}
const siteContracts = new Map((provenance.siteArticles || []).map((item) => [item.articleKey, item]));
requireEqual([...siteContracts.keys()], EXPECTED_READER_ORDER, 'site article declaration order');
const expectedSiteSlugs = new Set([
  ...(provenance.articles || []).map((item) => item.slug),
  ...(provenance.draftArticles || []).map((item) => item.slug),
]);
if (expectedSiteSlugs.size !== 6) fail('Research bindings must resolve to six unique slugs');

const articleSources = new Map();
for (const articleKey of EXPECTED_READER_ORDER) {
  const contract = siteContracts.get(articleKey);
  if (!contract) {
    fail(`missing site contract ${articleKey}`);
    continue;
  }
  const articleFile = path.join(ROOT, 'src/content/articles', `${contract.slug}.mdx`);
  if (!isFile(articleFile)) {
    fail(`missing site article ${contract.slug}`);
    continue;
  }
  const source = fs.readFileSync(articleFile, 'utf8');
  articleSources.set(articleKey, source);
  const expectedScalars = {
    slug: contract.slug,
    section: 'hard-texts',
    author: 'fedor-milovanov',
    series: 'genesis-6',
    draft: true,
    noindex: true,
    sourcesRequired: true,
    canonicalOverride: `https://gospod-bog.ru/hard-texts/${contract.slug}/`,
    sourceMode: 'rendered',
  };
  for (const [key, expected] of Object.entries(expectedScalars)) {
    if (frontmatterValue(source, key) !== expected) fail(`${articleKey} frontmatter ${key} drift`);
  }
  requireEqual(frontmatterList(source, 'related'), contract.expectedRelatedSlugs, `${articleKey} related graph`);
  for (const relatedSlug of contract.expectedRelatedSlugs || []) {
    if (!expectedSiteSlugs.has(relatedSlug)) fail(`${articleKey} related target outside series: ${relatedSlug}`);
  }
}

for (let index = 0; index < EXPECTED_READER_ORDER.length - 1; index += 1) {
  const current = siteContracts.get(EXPECTED_READER_ORDER[index]);
  const next = siteContracts.get(EXPECTED_READER_ORDER[index + 1]);
  if (!current?.expectedRelatedSlugs?.includes(next?.slug)) {
    fail(`reader-order link missing: ${EXPECTED_READER_ORDER[index]} → ${EXPECTED_READER_ORDER[index + 1]}`);
  }
}

const seriesItems = parseSeriesItems(fs.readFileSync(SERIES_DATA_PATH, 'utf8'));
if (seriesItems.length !== EXPECTED_READER_ORDER.length) fail('Genesis series data must contain exactly six reader items');
const imageManifest = readJson(IMAGE_MANIFEST_PATH);
if (imageManifest.seriesId !== 'genesis-6' || imageManifest.visualReview?.status !== 'approved') {
  fail('Genesis image manifest must remain the approved series manifest');
}
const manifestAssets = new Map((imageManifest.assets || []).map((asset) => [asset.id, asset]));
let completedMinutes = 0;
for (let index = 0; index < EXPECTED_READER_ORDER.length; index += 1) {
  const articleKey = EXPECTED_READER_ORDER[index];
  const contract = siteContracts.get(articleKey);
  const item = seriesItems[index];
  const source = articleSources.get(articleKey);
  if (!contract || !item || !source) continue;
  if (item.slug !== contract.slug) fail(`${articleKey} series item order/slug drift`);
  const frontmatterMinutes = frontmatterValue(source, 'readingTime');
  if (item.minutes !== frontmatterMinutes) {
    fail(`${articleKey} reading time drift: series ${item.minutes}, frontmatter ${frontmatterMinutes}`);
  }
  completedMinutes += item.minutes;
  if (completedMinutes > EXPECTED_TOTAL_MINUTES) {
    fail(`${articleKey} reading progress exceeds 100%: ${completedMinutes}/${EXPECTED_TOTAL_MINUTES}`);
  }

  const assetId = EXPECTED_ASSET_IDS.get(articleKey);
  const asset = manifestAssets.get(assetId);
  if (!asset) {
    fail(`${articleKey} missing approved manifest asset ${assetId}`);
    continue;
  }
  if (!item.cover.endsWith(`/images/articles/genesis6/${assetId}.webp`)) fail(`${articleKey} WebP cover drift`);
  if (!item.coverAvif.endsWith(`/images/articles/genesis6/${assetId}.avif`)) fail(`${articleKey} AVIF cover drift`);
  if (item.coverAlt !== asset.alt) fail(`${articleKey} rendered cover alt differs from approved manifest`);
  if (asset.variants?.webp?.file !== `${assetId}.webp` || asset.variants?.avif?.file !== `${assetId}.avif`) {
    fail(`${articleKey} manifest variant filename drift`);
  }
}
if (completedMinutes !== EXPECTED_TOTAL_MINUTES) {
  fail(`Genesis series total minutes ${completedMinutes} != ${EXPECTED_TOTAL_MINUTES}`);
}

const article6A = articleSources.get('6A') || '';
const article6B = articleSources.get('6B') || '';
if (countFootnoteDefinitions(article6A) !== 27) fail('article 6A must retain exactly 27 footnote groups');
if (countFootnoteDefinitions(article6B) !== 26) fail('article 6B must retain exactly 26 footnote groups');

for (const marker of [
  'GEN6-ENOCH-ASTRONOMICAL-DECISION-LXVI',
  'SAME-COMPOSITION / GENUINE-TEXTUAL-PLURALITY',
  'astronomical-book-reconstruction-direction-and-joins',
]) {
  if (!article6A.includes(marker)) fail(`article 6A missing LXVI authority marker: ${marker}`);
}
for (const marker of [
  'DIFFICULT-TO-HARMONIZE / INTERNAL-TENSION / TEXT-ESTABLISHED / INTERPRETATION-QUALIFIED',
  'TEXT-DIRECT / HISTORICAL-BACKGROUND / UNSUPPORTED-ELABORATION',
  'GEN6-ENOCH-10-8-DECISION-LX',
  'GEN6-ENOCH-15-8-12-DECISION-LXI',
  'GEN6-ENOCH-70-71-DECISION-LXV',
  'GEN6-ENOCH-ASTRONOMICAL-DECISION-LXVI',
  'DIRECT-ADDRESS-ESTABLISHED / COMPOSITION-AND-IDENTITY-QUALIFIED',
  'TEXTUAL-PLURALITY-ESTABLISHED / EVOLUTION-MODEL-QUALIFIED',
  '1-enoch-70-71-composition-and-figure-identity',
  'astronomical-book-reconstruction-direction-and-joins',
]) {
  if (!article6B.includes(marker)) fail(`article 6B missing final authority marker: ${marker}`);
}
for (const staleMarker of [
  'окончательное сопоставление всех версионных форм locus остаётся `HOLD`',
  'POTENTIAL-CHRISTOLOGICAL-CONFLICT / TEXT-VARIANT / HOLD',
  'DIFFICULT-TO-HARMONIZE / VERSION-HOLD',
  'окончательный христологический вердикт по 70–71 должен оставаться `HOLD`',
]) {
  if (article6B.includes(staleMarker)) fail(`article 6B retains stale authority wording: ${staleMarker}`);
}

if (failures.length) {
  for (const message of failures) console.error(`ERROR genesis6 research provenance: ${message}`);
  process.exit(1);
}

console.log(
  `Genesis 6 Research provenance: PASS (${EXPECTED_RESEARCH_COMMIT}, ` +
    `${provenance.articles.length} legacy bundles, ${provenance.draftArticles.length} extension bundles, ` +
    `${EXPECTED_BLOCKING_HOLDS.length} blocking HOLDs, ${EXPECTED_EVIDENCE_RESOLUTIONS.length} evidence resolutions, ` +
    `${provenance.siteArticles.length} site contracts, ${EXPECTED_TOTAL_MINUTES} total minutes, release ${provenance.releaseState})`,
);
