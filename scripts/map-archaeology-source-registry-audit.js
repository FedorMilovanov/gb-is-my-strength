#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'karty/_data/archaeology-source-registry.json');
const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
const problems = [];
const warnings = [];
const fail = (code, detail) => problems.push({ code, detail });
const warn = (code, detail) => warnings.push({ code, detail });

const TIERS = new Set([
  'primary-excavation',
  'official-collection',
  'peer-reviewed',
  'institutional-synthesis',
  'scholarly-reference',
  'conservative-analysis',
  'yec-analysis',
  'visual-archive',
  'retraction-record',
]);
const STATUSES = new Set(['active', 'retracted', 'superseded', 'reference-only']);
const VERIFICATIONS = new Set(['verified', 'imported', 'needs-review']);
const CLAIM_STATUSES = new Set([
  'accepted-context',
  'primary-identification',
  'candidate',
  'rejected',
  'project-interpretation',
  'methodological-guardrail',
]);
const HIGH_EVIDENCE = new Set([
  'primary-excavation',
  'official-collection',
  'peer-reviewed',
  'institutional-synthesis',
]);
const INTERPRETIVE = new Set(['scholarly-reference', 'conservative-analysis', 'yec-analysis', 'visual-archive']);
const YEC = new Set(['yec-analysis']);
const ACCEPTED = new Set(['accepted-context', 'primary-identification', 'methodological-guardrail']);
const EXPECTED_CATEGORIES = [
  'babylonian_exile',
  'davidic_kingdom',
  'dead_sea_scrolls',
  'early_church',
  'exodus_route',
  'jericho_ai',
  'jerusalem_first_temple',
  'jesus_ministry',
  'judges_period',
  'kings_period',
  'maccabees',
  'persian_return',
];

if (registry.schemaVersion !== '1.1.0') fail('schema-version', `expected 1.1.0, got ${registry.schemaVersion}`);
if (!/^[0-9a-f]{40}$/.test(registry.sourceBoundary || '')) fail('source-boundary', 'sourceBoundary must be a full 40-character SHA');
if (registry.worldview?.position !== 'young-earth-creationism') fail('worldview-position', 'registry must preserve the declared YEC project position');
if (!String(registry.worldview?.evidencePolicy || '').includes('may not replace')) fail('worldview-separation', 'evidence policy must explicitly prevent interpretation replacing excavation evidence');
if (!Array.isArray(registry.worldview?.prohibitions) || registry.worldview.prohibitions.length < 4) fail('worldview-prohibitions', 'methodological prohibitions are incomplete');
if (JSON.stringify(registry.evidenceHierarchy) !== JSON.stringify([...TIERS])) fail('hierarchy-order', 'evidenceHierarchy must remain explicit and ordered');
if (!String(registry.expansionPolicy?.offlinePolicy || '').includes('must not require network access')) fail('offline-policy', 'runtime migration must remain local/offline');
if (!String(registry.expansionPolicy?.displayPolicy || '').includes('only in archaeology context')) fail('display-policy', 'registry must forbid repeated archaeology footers outside archaeology context');
if (!String(registry.expansionPolicy?.yecPolicy || '').includes('separate from field evidence')) fail('expanded-yec-policy', 'expanded registry must preserve YEC/evidence separation');

const sources = Array.isArray(registry.sources) ? registry.sources : [];
const claims = Array.isArray(registry.claims) ? registry.claims : [];
const categories = Array.isArray(registry.runtimeCategories) ? registry.runtimeCategories : [];
if (sources.length < 88) fail('source-floor', `expected at least 88 source records, got ${sources.length}`);
if (claims.length < 23) fail('claim-floor', `expected at least 23 governed claims, got ${claims.length}`);
if (categories.length !== EXPECTED_CATEGORIES.length) fail('category-count', `expected ${EXPECTED_CATEGORIES.length} categories, got ${categories.length}`);

const sourceById = new Map();
const urls = new Map();
for (const [index, source] of sources.entries()) {
  const label = `sources[${index}]`;
  if (!/^[a-z0-9][a-z0-9-]+$/.test(source.id || '')) fail('source-id', `${label}: invalid id ${JSON.stringify(source.id)}`);
  if (sourceById.has(source.id)) fail('source-id-duplicate', `${source.id}`);
  else sourceById.set(source.id, source);
  if (!source.title || !source.organization) fail('source-metadata', `${source.id}: title/organization required`);
  if (!TIERS.has(source.tier)) fail('source-tier', `${source.id}: ${source.tier}`);
  if (!STATUSES.has(source.status)) fail('source-status', `${source.id}: ${source.status}`);
  if (!VERIFICATIONS.has(source.verification)) fail('source-verification', `${source.id}: ${source.verification}`);
  if (!/^https:\/\//.test(source.url || '')) fail('source-url', `${source.id}: HTTPS URL required`);
  if (urls.has(source.url)) fail('source-url-duplicate', `${source.id} duplicates ${urls.get(source.url)}`);
  else urls.set(source.url, source.id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(source.verifiedAt || '')) fail('source-verified-at', `${source.id}: invalid verifiedAt`);
  if (!Array.isArray(source.maps) || source.maps.length === 0 || source.maps.some((map) => typeof map !== 'string' || !map.trim())) fail('source-map-scope', `${source.id}: maps must contain at least one non-empty scope`);
  if (!Array.isArray(source.places)) fail('source-place-tags', `${source.id}: places must be an array`);
  if (source.tier === 'retraction-record' && source.status !== 'retracted') fail('retraction-status', `${source.id}: retraction record must be retracted`);
  if (source.status === 'retracted' && source.tier !== 'retraction-record') fail('retraction-tier', `${source.id}: retracted source must use retraction-record tier`);
  if (source.verification === 'verified' && source.verifiedAt !== registry.updatedAt) warn('verification-age', `${source.id}: verified record date differs from registry update date`);
}

const verified = sources.filter((source) => source.verification === 'verified');
const highEvidence = sources.filter((source) => source.status === 'active' && HIGH_EVIDENCE.has(source.tier));
const yecSources = sources.filter((source) => source.status === 'active' && YEC.has(source.tier));
const retractions = sources.filter((source) => source.tier === 'retraction-record');
if (verified.length < 78) fail('verified-floor', `expected at least 78 verified records, got ${verified.length}`);
if (highEvidence.length < 60) fail('high-evidence-floor', `expected at least 60 active high-evidence records, got ${highEvidence.length}`);
if (yecSources.length < 6) fail('yec-source-floor', `expected at least 6 YEC interpretation records, got ${yecSources.length}`);
if (retractions.length < 2) fail('retraction-floor', `expected at least two independent retraction records, got ${retractions.length}`);

const claimById = new Map();
for (const [index, claim] of claims.entries()) {
  const label = `claims[${index}]`;
  if (!/^[a-z0-9][a-z0-9-]+$/.test(claim.id || '')) fail('claim-id', `${label}: invalid id`);
  if (claimById.has(claim.id)) fail('claim-id-duplicate', claim.id);
  claimById.set(claim.id, claim);
  if (typeof claim.map !== 'string' || !claim.map.trim()) fail('claim-map', `${claim.id}: map scope is required`);
  if (!CLAIM_STATUSES.has(claim.status)) fail('claim-status', `${claim.id}: ${claim.status}`);
  if (!claim.statement || !claim.limitations) fail('claim-text', `${claim.id}: statement and limitations are required`);
  if (!Array.isArray(claim.places) || !Array.isArray(claim.evidenceSources) || !Array.isArray(claim.interpretationSources)) fail('claim-arrays', `${claim.id}: places/evidenceSources/interpretationSources must be arrays`);

  const evidence = (claim.evidenceSources || []).map((id) => sourceById.get(id));
  const interpretation = (claim.interpretationSources || []).map((id) => sourceById.get(id));
  for (const id of [...(claim.evidenceSources || []), ...(claim.interpretationSources || [])]) {
    if (!sourceById.has(id)) fail('claim-source-missing', `${claim.id}: ${id}`);
  }
  if (new Set(claim.evidenceSources).size !== claim.evidenceSources.length) fail('claim-evidence-duplicate', claim.id);
  if (new Set(claim.interpretationSources).size !== claim.interpretationSources.length) fail('claim-interpretation-duplicate', claim.id);
  if (claim.evidenceSources.some((id) => claim.interpretationSources.includes(id))) fail('claim-layer-overlap', `${claim.id}: source used as both evidence and interpretation`);

  if (ACCEPTED.has(claim.status)) {
    if (!evidence.some((source) => source && source.status === 'active' && HIGH_EVIDENCE.has(source.tier))) fail('accepted-without-high-evidence', claim.id);
    if (evidence.some((source) => source && (INTERPRETIVE.has(source.tier) || source.tier === 'retraction-record'))) fail('accepted-evidence-tier', `${claim.id}: interpretive/retraction source placed in evidenceSources`);
  }
  if (claim.status === 'candidate' && !/candidate|requires|future|not an identification|disputed/i.test(claim.limitations)) fail('candidate-limitation', `${claim.id}: candidate limitation must remain explicit`);
  if (claim.status === 'project-interpretation') {
    if (claim.evidenceSources.length) fail('project-interpretation-evidence', `${claim.id}: project chronology must not masquerade as excavation evidence`);
    if (!interpretation.some((source) => source && YEC.has(source.tier))) fail('project-interpretation-yec', claim.id);
  }
  if (claim.status === 'rejected') {
    if (!evidence.some((source) => source && source.tier === 'retraction-record')) fail('rejected-without-retraction', claim.id);
  } else if (evidence.some((source) => source && source.status === 'retracted')) {
    fail('positive-use-of-retracted-source', claim.id);
  }
  if (interpretation.some((source) => source && source.tier === 'retraction-record')) fail('retraction-as-interpretation', claim.id);
}

const categoryIds = categories.map((category) => category.id).sort();
if (JSON.stringify(categoryIds) !== JSON.stringify(EXPECTED_CATEGORIES)) fail('category-coverage', `expected ${EXPECTED_CATEGORIES.join(', ')}, got ${categoryIds.join(', ')}`);
const categoryCoverage = [];
for (const category of categories) {
  if (category.status !== 'registry-ready') fail('category-status', `${category.id}: expected registry-ready`);
  if (!category.title || !category.limitations) fail('category-text', `${category.id}: title and limitations required`);
  if (!Array.isArray(category.sourceIds) || !Array.isArray(category.claimIds)) fail('category-arrays', `${category.id}: sourceIds and claimIds must be arrays`);
  if (new Set(category.sourceIds).size !== category.sourceIds.length) fail('category-source-duplicate', category.id);
  if (new Set(category.claimIds).size !== category.claimIds.length) fail('category-claim-duplicate', category.id);
  const categorySources = category.sourceIds.map((id) => sourceById.get(id));
  const categoryClaims = category.claimIds.map((id) => claimById.get(id));
  for (const id of category.sourceIds) if (!sourceById.has(id)) fail('category-source-missing', `${category.id}: ${id}`);
  for (const id of category.claimIds) if (!claimById.has(id)) fail('category-claim-missing', `${category.id}: ${id}`);
  const categoryHigh = categorySources.filter((source) => source && source.status === 'active' && source.verification === 'verified' && HIGH_EVIDENCE.has(source.tier));
  if (categoryHigh.length < 3) fail('category-high-evidence-floor', `${category.id}: expected at least 3 verified active high-evidence sources, got ${categoryHigh.length}`);
  if (categoryClaims.length < 1) fail('category-claim-floor', `${category.id}: at least one governed claim required`);
  if (categorySources.some((source) => source && source.status === 'retracted')) fail('category-retracted-source', `${category.id}: retracted source cannot be a runtime-category source`);
  for (const claim of categoryClaims) {
    if (!claim) continue;
    if (!claim.evidenceSources.some((id) => category.sourceIds.includes(id))) fail('category-claim-evidence-link', `${category.id}/${claim.id}: claim has no evidence source in category`);
  }
  categoryCoverage.push({id:category.id,sources:category.sourceIds.length,highEvidence:categoryHigh.length,claims:category.claimIds.length});
}

const tallClaim = claimById.get('tall-el-hammam-airburst-rejected');
if (!tallClaim || tallClaim.status !== 'rejected' || tallClaim.evidenceSources.length < 2) fail('tall-retraction-guard', 'Tall el-Hammam airburst must remain explicitly rejected with two retraction records');
const tallRetraction = sourceById.get('scientific-reports-tall-retraction');
if (!tallRetraction || tallRetraction.url !== 'https://www.nature.com/articles/s41598-025-99290-6') fail('tall-direct-retraction', 'Scientific Reports entry must point to the direct 2025 retraction notice');
const noArtifact = claimById.get('no-personal-abraham-artefact');
if (!noArtifact || noArtifact.status !== 'methodological-guardrail') fail('no-artifact-guard', 'personal Abraham artefact prohibition is missing');
const jerichoClaim = claimById.get('jericho-conquest-chronology-disputed');
if (!jerichoClaim || jerichoClaim.status !== 'candidate' || !/disputed/i.test(jerichoClaim.statement + ' ' + jerichoClaim.limitations)) fail('jericho-dispute-guard', 'Jericho conquest chronology must remain explicitly disputed');

const summary = {
  schemaVersion: registry.schemaVersion,
  updatedAt: registry.updatedAt,
  sourceBoundary: registry.sourceBoundary,
  sources: sources.length,
  verified: verified.length,
  imported: sources.filter((source) => source.verification === 'imported').length,
  highEvidence: highEvidence.length,
  yecSources: yecSources.length,
  retractions: retractions.length,
  claims: claims.length,
  categories: categories.length,
  categoryCoverage,
  problems: problems.length,
  warnings: warnings.length,
};

fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports/map-archaeology-source-registry.json'), `${JSON.stringify({ summary, problems, warnings }, null, 2)}\n`);

for (const warning of warnings) console.warn(`WARN ${warning.code}: ${warning.detail}`);
if (problems.length) {
  for (const problem of problems) console.error(`FAIL ${problem.code}: ${problem.detail}`);
  console.error(JSON.stringify(summary));
  process.exit(1);
}
console.log(`PASS archaeology registry: ${summary.sources} sources, ${summary.verified} verified, ${summary.highEvidence} high-evidence, ${summary.categories}/${EXPECTED_CATEGORIES.length} categories, ${summary.claims} claims`);
