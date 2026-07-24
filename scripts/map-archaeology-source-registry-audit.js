#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'karty/_data/archaeology-source-registry.json');
const PROVENANCE_PATH = path.join(ROOT, 'karty/_data/archaeology-source-provenance.json');
const ROUTE_PATH = path.join(ROOT, 'karty/avraam/route.json');
const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const provenance = JSON.parse(fs.readFileSync(PROVENANCE_PATH, 'utf8'));
const route = JSON.parse(fs.readFileSync(ROUTE_PATH, 'utf8'));
const problems = [];
const warnings = [];
const fail = (code, detail) => problems.push({ code, detail });
const warn = (code, detail) => warnings.push({ code, detail });

const LEGACY_TIERS = new Set([
  'primary-excavation',
  'official-collection',
  'peer-reviewed',
  'institutional-synthesis',
  'institutional-notice',
  'institutional-directory',
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
  'disputed',
  'rejected',
  'project-interpretation',
  'methodological-guardrail',
]);
const ACCEPTED = new Set(['accepted-context', 'primary-identification', 'methodological-guardrail']);
const FORBIDDEN_HIGH_LOCATORS = new Set(['news-item', 'department-page']);
const FORBIDDEN_HIGH_WORKS = new Set(['institutional-directory', 'event-notice', 'bibliographic-index', 'theological-analysis', 'visual-document', 'retraction-notice']);
const EVIDENCE_ROLES = new Set(['high', 'supporting']);
const INTERPRETATION_ROLES = new Set(['interpretation']);

if (catalog.schemaVersion !== '1.1.0') fail('catalog-schema-version', `expected 1.1.0, got ${catalog.schemaVersion}`);
if (provenance.schemaVersion !== '1.0.0') fail('provenance-schema-version', `expected 1.0.0, got ${provenance.schemaVersion}`);
if (catalog.provenanceRegistry !== 'karty/_data/archaeology-source-provenance.json') fail('provenance-pointer', 'catalog must point to the canonical provenance ledger');
if (catalog.worldview?.position !== 'young-earth-creationism') fail('worldview-position', 'catalog must preserve the declared YEC project position');
if (!String(catalog.worldview?.evidencePolicy || '').includes('may not replace')) fail('worldview-separation', 'YEC interpretation must not replace excavation evidence');
if (!String(provenance.policy?.verifiedMeaning || '').includes('does not make a source primary')) fail('verification-separation', 'verified must remain distinct from evidence strength');
if (!Array.isArray(catalog.worldview?.prohibitions) || catalog.worldview.prohibitions.length < 4) fail('worldview-prohibitions', 'methodological prohibitions are incomplete');
if (!Array.isArray(provenance.policy?.prohibitions) || provenance.policy.prohibitions.length < 4) fail('provenance-prohibitions', 'provenance prohibitions are incomplete');
if (JSON.stringify(catalog.evidenceHierarchy) !== JSON.stringify([...LEGACY_TIERS])) fail('legacy-hierarchy-order', 'catalog evidenceHierarchy must remain explicit and ordered');

const dimensionSets = {};
for (const [name, values] of Object.entries(provenance.dimensions || {})) {
  if (!Array.isArray(values) || !values.length || new Set(values).size !== values.length) fail('dimension-shape', `${name} must be a unique non-empty array`);
  dimensionSets[name] = new Set(values || []);
}
for (const required of ['locatorTypes', 'workTypes', 'authorities', 'reviews', 'perspectives', 'evidenceUses']) {
  if (!dimensionSets[required]) fail('dimension-missing', required);
}

const routeCollections = {
  places: new Set((route.places || []).map((item) => item.id)),
  verified_waypoints: new Set((route.verified_waypoints || []).map((item) => item.id)),
  ctx_index: new Set((route.ctx_index || []).map((item) => item.id)),
  scientific_variants: new Set(Object.keys(route.scientific_variants || {})),
};
const sites = provenance.sites || {};
const declaredMapScopes = new Set(['avraam', ...(catalog.mapScopes || []).map((scope) => scope?.id).filter(Boolean)]);
for (const scope of catalog.mapScopes || []) {
  if (!scope || !/^[a-z0-9][a-z0-9-]+$/.test(scope.id || '')) fail('map-scope-id', JSON.stringify(scope));
  if (scope.kind !== 'runtime-scope') fail('map-scope-kind', `${scope?.id}: ${scope?.kind}`);
}
for (const [siteId, site] of Object.entries(sites)) {
  if (!/^[a-z0-9][a-z0-9-]+$/.test(siteId)) fail('site-id', siteId);
  const ref = site?.routeRef;
  if (!ref || !routeCollections[ref.collection]) {
    fail('site-route-collection', `${siteId}: ${JSON.stringify(ref)}`);
    continue;
  }
  if (!routeCollections[ref.collection].has(ref.id)) fail('site-route-id', `${siteId}: ${ref.collection}/${ref.id}`);
}

const sources = Array.isArray(catalog.sources) ? catalog.sources : [];
const claims = Array.isArray(catalog.claims) ? catalog.claims : [];
const records = provenance.records && typeof provenance.records === 'object' ? provenance.records : {};
if (sources.length < 50) fail('source-floor', `expected at least 50 catalog sources, got ${sources.length}`);
if (claims.length < 10) fail('claim-floor', `expected at least 10 governed claims, got ${claims.length}`);

const sourceById = new Map();
const catalogUrls = new Map();
for (const [index, source] of sources.entries()) {
  const label = `sources[${index}]`;
  if (!/^[a-z0-9][a-z0-9-]+$/.test(source.id || '')) fail('source-id', `${label}: ${JSON.stringify(source.id)}`);
  if (sourceById.has(source.id)) fail('source-id-duplicate', source.id);
  sourceById.set(source.id, source);
  if (!source.title || !source.organization) fail('source-metadata', `${source.id}: title/organization required`);
  if (!LEGACY_TIERS.has(source.tier)) fail('source-tier', `${source.id}: ${source.tier}`);
  if (!STATUSES.has(source.status)) fail('source-status', `${source.id}: ${source.status}`);
  if (!VERIFICATIONS.has(source.verification)) fail('source-verification', `${source.id}: ${source.verification}`);
  if (source.verification === 'imported') fail('source-imported-unreviewed', source.id);
  if (source.verification === 'needs-review') {
    const reviewRecord = records[source.id];
    if (!source.note || !/review|unresolved|redirect|metadata|access|recover/i.test(source.note)) fail('source-needs-review-note', source.id);
    if (reviewRecord?.evidenceUse === 'high') fail('source-needs-review-high', source.id);
  }
  if (!/^https:\/\//.test(source.url || '')) fail('source-url', `${source.id}: HTTPS URL required`);
  if (catalogUrls.has(source.url)) fail('source-url-duplicate', `${source.id} duplicates ${catalogUrls.get(source.url)}`);
  catalogUrls.set(source.url, source.id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(source.verifiedAt || '')) fail('source-verified-at', `${source.id}: invalid verifiedAt`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(source.accessedAt || '')) fail('source-accessed-at', `${source.id}: invalid accessedAt`);
  if (!Array.isArray(source.maps) || !source.maps.length) fail('source-map-scope', `${source.id}: at least one map scope required`);
  for (const scope of source.maps || []) if (!declaredMapScopes.has(scope)) fail('source-map-scope-unknown', `${source.id}: ${scope}`);
  if (!Array.isArray(source.places)) fail('source-place-tags', `${source.id}: places must be an array`);
  for (const place of source.places || []) if (!sites[place]) fail('source-place-unknown', `${source.id}: ${place}`);
  if (source.tier === 'retraction-record' && source.status !== 'retracted') fail('retraction-status', `${source.id}: retraction record must be retracted`);
  if (source.status === 'retracted' && source.tier !== 'retraction-record') fail('retraction-tier', `${source.id}: retracted source must use retraction-record tier`);

  const record = records[source.id];
  if (!record) {
    fail('provenance-record-missing', source.id);
    continue;
  }
  if (source.url !== record.canonicalUrl) fail('canonical-url-drift', `${source.id}: catalog=${source.url}, provenance=${record.canonicalUrl}`);
  if (source.accessedAt !== record.accessedAt) fail('access-date-drift', `${source.id}: catalog=${source.accessedAt}, provenance=${record.accessedAt}`);
  if (source.year !== record.publicationYear) fail('publication-year-drift', `${source.id}: catalog=${source.year}, provenance=${record.publicationYear}`);
  if (!dimensionSets.locatorTypes?.has(record.locatorType)) fail('locator-type', `${source.id}: ${record.locatorType}`);
  if (!dimensionSets.workTypes?.has(record.workType)) fail('work-type', `${source.id}: ${record.workType}`);
  if (!dimensionSets.authorities?.has(record.authority)) fail('authority', `${source.id}: ${record.authority}`);
  if (!dimensionSets.reviews?.has(record.review)) fail('review', `${source.id}: ${record.review}`);
  if (!dimensionSets.perspectives?.has(record.perspective)) fail('perspective', `${source.id}: ${record.perspective}`);
  if (!dimensionSets.evidenceUses?.has(record.evidenceUse)) fail('evidence-use', `${source.id}: ${record.evidenceUse}`);
  if (!record.identifiers || typeof record.identifiers !== 'object' || Array.isArray(record.identifiers)) fail('identifiers-shape', source.id);
  if (record.publicationYear !== null && (!Number.isInteger(record.publicationYear) || record.publicationYear < 1800 || record.publicationYear > 2026)) fail('publication-year', `${source.id}: ${record.publicationYear}`);
  if (record.evidenceUse === 'high' && (FORBIDDEN_HIGH_LOCATORS.has(record.locatorType) || FORBIDDEN_HIGH_WORKS.has(record.workType))) fail('false-high-evidence', `${source.id}: ${record.locatorType}/${record.workType}`);
  if (record.evidenceUse === 'high' && source.verification !== 'verified') fail('unverified-high-evidence', source.id);
  if (record.perspective === 'yec' && !['interpretation', 'none'].includes(record.evidenceUse)) fail('yec-evidence-role', `${source.id}: ${record.evidenceUse}`);
  if (source.tier === 'primary-excavation' && !(record.workType === 'excavation-report' && record.authority === 'primary' && record.evidenceUse === 'high')) fail('legacy-primary-mismatch', source.id);
  if (source.tier === 'peer-reviewed' && !(record.review === 'peer-reviewed' && record.evidenceUse === 'high')) fail('legacy-peer-review-mismatch', source.id);
  if (source.tier === 'institutional-notice' && !(record.locatorType === 'news-item' && record.evidenceUse === 'none')) fail('legacy-notice-mismatch', source.id);
  if (source.tier === 'institutional-directory' && !(record.locatorType === 'department-page' && record.evidenceUse === 'none')) fail('legacy-directory-mismatch', source.id);
  if (source.tier === 'yec-analysis' && record.perspective !== 'yec') fail('legacy-yec-mismatch', source.id);
  if (source.tier === 'visual-archive' && record.evidenceUse !== 'visual') fail('legacy-visual-mismatch', source.id);
  if (source.tier === 'retraction-record' && record.evidenceUse !== 'negative') fail('legacy-retraction-mismatch', source.id);
}

for (const id of Object.keys(records)) if (!sourceById.has(id)) fail('orphan-provenance-record', id);
if (Object.keys(records).length !== sourceById.size) fail('provenance-coverage-count', `catalog=${sourceById.size}, provenance=${Object.keys(records).length}`);

const verified = sources.filter((source) => source.verification === 'verified');
const highEvidence = sources.filter((source) => source.status === 'active' && records[source.id]?.evidenceUse === 'high');
const supportingEvidence = sources.filter((source) => source.status === 'active' && records[source.id]?.evidenceUse === 'supporting');
const yecSources = sources.filter((source) => source.status === 'active' && records[source.id]?.perspective === 'yec');
const yecInterpretation = yecSources.filter((source) => records[source.id]?.evidenceUse === 'interpretation');
const negative = sources.filter((source) => records[source.id]?.evidenceUse === 'negative');
if (verified.length < 40) fail('verified-floor', `expected at least 40 verified records, got ${verified.length}`);
if (highEvidence.length < 25) fail('high-evidence-floor', `expected at least 25 active provenance-high records, got ${highEvidence.length}`);
if (yecSources.length < 6) fail('yec-source-floor', `expected at least 6 YEC records, got ${yecSources.length}`);
if (yecInterpretation.length < 5) fail('yec-interpretation-floor', `expected at least 5 active YEC interpretation records, got ${yecInterpretation.length}`);
if (negative.length < 2) fail('negative-evidence-floor', `expected at least two negative/retraction witnesses, got ${negative.length}`);

const natureRetraction = records['scientific-reports-tall-retraction'];
if (natureRetraction?.canonicalUrl !== 'https://www.nature.com/articles/s41598-025-99265-5') fail('nature-retraction-url', natureRetraction?.canonicalUrl);
if (natureRetraction?.identifiers?.doi !== '10.1038/s41598-025-99265-5') fail('nature-retraction-doi', natureRetraction?.identifiers?.doi);
const pubmedRetraction = records['pubmed-tall-retraction'];
if (pubmedRetraction?.identifiers?.pmid !== '40275027' || pubmedRetraction?.identifiers?.doi !== '10.1038/s41598-025-99265-5') fail('pubmed-retraction-identifiers', JSON.stringify(pubmedRetraction?.identifiers));
for (const id of ['harran-department', 'harran-excavations-2025', 'harran-fieldwork']) {
  if (records[id]?.evidenceUse !== 'none') fail('harran-non-evidence', `${id}: ${records[id]?.evidenceUse}`);
}
for (const id of ['lloyd-brice-harran-1951', 'harran-plain-survey-2021']) {
  if (!(sourceById.has(id) && records[id]?.evidenceUse === 'high' && records[id]?.review === 'peer-reviewed')) fail('harran-publication-missing', id);
}
if (records['lloyd-brice-harran-1951']?.identifiers?.jstor !== '3642359') fail('harran-jstor', records['lloyd-brice-harran-1951']?.identifiers?.jstor);

const claimIds = new Set();
for (const [index, claim] of claims.entries()) {
  const label = `claims[${index}]`;
  if (!/^[a-z0-9][a-z0-9-]+$/.test(claim.id || '')) fail('claim-id', `${label}: invalid id`);
  if (claimIds.has(claim.id)) fail('claim-id-duplicate', claim.id);
  claimIds.add(claim.id);
  if (!declaredMapScopes.has(claim.map)) fail('claim-map-scope', `${claim.id}: ${claim.map}`);
  if (!CLAIM_STATUSES.has(claim.status)) fail('claim-status', `${claim.id}: ${claim.status}`);
  if (!claim.statement || !claim.limitations) fail('claim-text', `${claim.id}: statement and limitations are required`);
  if (!Array.isArray(claim.places) || !Array.isArray(claim.evidenceSources) || !Array.isArray(claim.interpretationSources)) fail('claim-arrays', `${claim.id}: places/evidenceSources/interpretationSources must be arrays`);
  for (const place of claim.places || []) if (!sites[place]) fail('claim-place-unknown', `${claim.id}: ${place}`);
  for (const id of [...(claim.evidenceSources || []), ...(claim.interpretationSources || [])]) if (!sourceById.has(id)) fail('claim-source-missing', `${claim.id}: ${id}`);
  if (new Set(claim.evidenceSources).size !== claim.evidenceSources.length) fail('claim-evidence-duplicate', claim.id);
  if (new Set(claim.interpretationSources).size !== claim.interpretationSources.length) fail('claim-interpretation-duplicate', claim.id);
  if (claim.evidenceSources.some((id) => claim.interpretationSources.includes(id))) fail('claim-layer-overlap', `${claim.id}: source used as evidence and interpretation`);

  const evidence = (claim.evidenceSources || []).map((id) => ({ source: sourceById.get(id), record: records[id], id }));
  const interpretation = (claim.interpretationSources || []).map((id) => ({ source: sourceById.get(id), record: records[id], id }));
  if (ACCEPTED.has(claim.status)) {
    if (!evidence.some(({ source, record }) => source?.status === 'active' && source.verification === 'verified' && record?.evidenceUse === 'high')) fail('accepted-without-high-evidence', claim.id);
    for (const { source, record, id } of evidence) {
      if (!source || !record || source.status !== 'active' || !EVIDENCE_ROLES.has(record.evidenceUse)) fail('accepted-evidence-role', `${claim.id}: ${id}/${record?.evidenceUse}`);
    }
  }
  if (['candidate', 'disputed'].includes(claim.status) && !/candidate|disputed|debate|requires|future|not (?:an )?identification|not settled/i.test(claim.limitations)) fail('candidate-limitation', `${claim.id}: candidate/disputed limitation must remain explicit`);
  if (claim.status === 'project-interpretation') {
    if (claim.evidenceSources.length) fail('project-interpretation-evidence', `${claim.id}: YEC chronology must not masquerade as excavation evidence`);
    if (!interpretation.some(({ record }) => record?.perspective === 'yec' && record.evidenceUse === 'interpretation')) fail('project-interpretation-yec', claim.id);
  }
  for (const { record, id } of interpretation) if (!record || !INTERPRETATION_ROLES.has(record.evidenceUse)) fail('claim-interpretation-role', `${claim.id}: ${id}/${record?.evidenceUse}`);
  if (claim.status === 'rejected') {
    if (!evidence.some(({ source, record }) => source?.status === 'retracted' && record?.evidenceUse === 'negative')) fail('rejected-without-negative-evidence', claim.id);
  } else if (evidence.some(({ source, record }) => source?.status === 'retracted' || record?.evidenceUse === 'negative')) {
    fail('positive-use-of-negative-source', claim.id);
  }
}

const corridor = claims.find((claim) => claim.id === 'euphrates-corridor-context');
if (!corridor || !['lloyd-brice-harran-1951', 'harran-plain-survey-2021'].every((id) => corridor.evidenceSources.includes(id))) fail('corridor-harran-primary', 'accepted corridor claim must use real Harran publications');
if (corridor?.evidenceSources.some((id) => ['harran-department', 'harran-excavations-2025', 'harran-fieldwork'].includes(id))) fail('corridor-harran-notice', 'accepted corridor claim still cites Harran directory/news pages');
const tallClaim = claims.find((claim) => claim.id === 'tall-el-hammam-airburst-rejected');
if (!tallClaim || tallClaim.status !== 'rejected' || tallClaim.evidenceSources.length < 2) fail('tall-retraction-guard', 'Tall el-Hammam airburst must remain rejected with two retraction witnesses');
const noArtifact = claims.find((claim) => claim.id === 'no-personal-abraham-artefact');
if (!noArtifact || noArtifact.status !== 'methodological-guardrail') fail('no-artifact-guard', 'personal Abraham artefact prohibition is missing');

const summary = {
  catalogSchema: catalog.schemaVersion,
  provenanceSchema: provenance.schemaVersion,
  updatedAt: catalog.updatedAt,
  catalogSources: sources.length,
  provenanceRecords: Object.keys(records).length,
  verified: verified.length,
  imported: sources.filter((source) => source.verification === 'imported').length,
  highEvidence: highEvidence.length,
  supportingEvidence: supportingEvidence.length,
  yecSources: yecSources.length,
  yecInterpretation: yecInterpretation.length,
  negativeEvidence: negative.length,
  sites: Object.keys(sites).length,
  mapScopes: declaredMapScopes.size,
  topics: Object.keys(catalog.topicVocabulary || {}).length,
  claims: claims.length,
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
console.log(`PASS archaeology provenance: ${summary.catalogSources} sources, ${summary.highEvidence} high, ${summary.yecInterpretation} YEC interpretations, ${summary.claims} claims, ${summary.sites} route-linked sites`);
