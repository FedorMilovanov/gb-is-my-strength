#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const CATALOG_FILE = path.join(ROOT, 'karty/_data/archaeology-source-registry.json');
const PROVENANCE_FILE = path.join(ROOT, 'karty/_data/archaeology-source-provenance.json');
const REPORT_FILE = path.join(ROOT, 'reports/map-archaeology-category-coverage.json');
const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
const provenance = JSON.parse(fs.readFileSync(PROVENANCE_FILE, 'utf8'));
const problems = [];
const warnings = [];
const fail = (message, details = null) => problems.push({ message, details });
const warn = (message, details = null) => warnings.push({ message, details });

const EXPECTED_CATEGORIES = [
  'babylonian_exile','davidic_kingdom','dead_sea_scrolls','early_church','exodus_route','jericho_ai',
  'jerusalem_first_temple','jesus_ministry','judges_period','kings_period','maccabees','persian_return'
].sort();
const EXPANSION_IDS = [
  'biu-gath-final-report','biu-gath-overview','biu-gath-project','biu-hurbat-husham-thamnata',
  'bm-babylonian-chronicle-21946','bm-cyrus-cylinder-object','bm-kenyon-jericho-publication','bm-lachish-relief',
  'bm-nebusarsekim-tablet','bm-papyrus-anastasi-v','bm-taylor-prism','brooklyn-elephantine-marriage',
  'custodia-capernaum','egypt-sinai-fortifications','elephantine-yaho-tax-list','elephantine-yaho-temple-letter',
  'hu-qeiyafa-project','hu-qeiyafa-vol1','hu-qeiyafa-vol2','iaa-dss-digital-library','iaa-dss-discovery-sites',
  'iaa-givati-2017-2018','iaa-givati-2019-2020','iaa-horbat-ha-gardi','iaa-migdal-2013','iaa-migdal-2015',
  'iaa-siloam-silwan-2014','imj-cradle-christianity','imj-great-isaiah-scroll','imj-heliodorus-stele',
  'imj-shrine-book','imj-temple-scroll','louvre-mesha-stele','oeai-ephesos-branch','oeai-forschungen-ephesos',
  'pcma-retaba-2011','pcma-retaba-pam23','sapienza-jericho-2019-2023','sapienza-jericho-project',
  'sapienza-jericho-urban-diversity'
].sort();

if (catalog.coverageSchemaVersion !== '1.0.0') fail('catalog coverageSchemaVersion must be 1.0.0');
if (provenance.coverageSchemaVersion !== '1.0.0') fail('provenance coverageSchemaVersion must be 1.0.0');
if (catalog.worldview?.position !== 'young-earth-creationism') fail('project worldview must remain YEC');
if (!String(catalog.worldview?.evidencePolicy || '').includes('stored separately')) fail('evidence/interpretation separation policy missing');

const sources = new Map();
for (const source of catalog.sources || []) {
  if (!source?.id) { fail('source without id'); continue; }
  if (sources.has(source.id)) fail(`duplicate source id ${source.id}`);
  sources.set(source.id, source);
}
const records = provenance.records || {};
const sourceIds = [...sources.keys()].sort();
const recordIds = Object.keys(records).sort();
if (JSON.stringify(sourceIds) !== JSON.stringify(recordIds)) fail('catalog/provenance source ID coverage is not exact 1:1', {sourceIds:sourceIds.length,recordIds:recordIds.length});
if (sourceIds.length !== 94) fail(`expected 94 catalog sources, found ${sourceIds.length}`);
for (const id of EXPANSION_IDS) {
  if (!sources.has(id)) fail(`missing expansion source ${id}`);
  if (!records[id]) fail(`missing expansion provenance ${id}`);
}

const topicVocabulary = catalog.topicVocabulary || {};
const mapScopes = new Map((catalog.mapScopes || []).map((scope) => [scope.id, scope]));
for (const source of sources.values()) {
  const record = records[source.id];
  if (!record) continue;
  if (source.url !== record.canonicalUrl) fail(`${source.id}: catalog/provenance URL drift`);
  if ((source.year ?? null) !== (record.publicationYear ?? null)) fail(`${source.id}: publication year drift`, {catalog:source.year,provenance:record.publicationYear});
  if (source.accessedAt !== record.accessedAt) fail(`${source.id}: accessedAt drift`);
  if (Number.isFinite(source.year) && (source.year < 1800 || source.year > 2026)) fail(`${source.id}: invalid publication year ${source.year}`);
  if (record.subjectDate) {
    const date = record.subjectDate;
    if (!date.label || !Number.isFinite(date.startYear) || !Number.isFinite(date.endYear) || date.startYear > date.endYear) fail(`${source.id}: malformed subjectDate`, date);
    if (date.convention !== 'conventional-archaeological') fail(`${source.id}: subjectDate convention must be explicit`);
  }
  for (const topic of source.topics || []) if (!topicVocabulary[topic]) fail(`${source.id}: undeclared topic ${topic}`);
  for (const scope of source.maps || []) if (!mapScopes.has(scope) && scope !== 'avraam') fail(`${source.id}: undeclared map scope ${scope}`);
  if (EXPANSION_IDS.includes(source.id) && (source.places || []).length) fail(`${source.id}: new cross-map source must use topics, not unverified route places`);
  if (record.perspective === 'yec' && !['interpretation','none'].includes(record.evidenceUse)) fail(`${source.id}: YEC source cannot be evidenceUse=${record.evidenceUse}`);
  if (source.status === 'retracted' && record.evidenceUse !== 'negative') fail(`${source.id}: retracted source must be negative evidence`);
}

const claims = new Map((catalog.claims || []).map((claim) => [claim.id, claim]));
const categories = catalog.runtimeCategories || [];
const categoryIds = categories.map((category) => category.id).sort();
if (JSON.stringify(categoryIds) !== JSON.stringify(EXPECTED_CATEGORIES)) fail('runtime category set drift', {expected:EXPECTED_CATEGORIES,actual:categoryIds});
const categorySourceUnion = new Set();
for (const category of categories) {
  if (!category.label) fail(`${category.id}: missing label`);
  if (!Array.isArray(category.mapScopes) || !category.mapScopes.length) fail(`${category.id}: missing mapScopes`);
  for (const scope of category.mapScopes || []) if (!mapScopes.has(scope)) fail(`${category.id}: undeclared map scope ${scope}`);
  const ids = [...new Set(category.sourceIds || [])];
  if (ids.length < 3) fail(`${category.id}: fewer than three sources`);
  const active = ids.filter((id) => sources.get(id)?.status === 'active');
  const high = ids.filter((id) => records[id]?.evidenceUse === 'high' && sources.get(id)?.status === 'active');
  if (active.length !== ids.length) fail(`${category.id}: category includes inactive/retracted source`);
  if (high.length < 2) fail(`${category.id}: fewer than two active high-evidence records`, {high});
  if (!ids.some((id) => records[id]?.authority === 'primary' && records[id]?.evidenceUse === 'high')) fail(`${category.id}: no primary high-evidence record`);
  for (const id of ids) {
    if (!sources.has(id)) fail(`${category.id}: unknown source ${id}`);
    categorySourceUnion.add(id);
  }
  if (!Array.isArray(category.claimIds) || !category.claimIds.length) fail(`${category.id}: no governed claim`);
  for (const claimId of category.claimIds || []) {
    const claim = claims.get(claimId);
    if (!claim) { fail(`${category.id}: unknown claim ${claimId}`); continue; }
    if (claim.category !== category.id) fail(`${claimId}: category backlink drift`);
    if (!claim.limitations || String(claim.limitations).length < 40) fail(`${claimId}: limitations are missing or too weak`);
    for (const evidenceId of claim.evidenceSources || []) {
      if (!ids.includes(evidenceId)) fail(`${claimId}: evidence source ${evidenceId} is outside its category bundle`);
      if (records[evidenceId]?.evidenceUse === 'negative' || sources.get(evidenceId)?.status === 'retracted') fail(`${claimId}: negative/retracted source used positively`);
      if (records[evidenceId]?.perspective === 'yec') fail(`${claimId}: YEC interpretation used as excavation evidence`);
    }
    for (const interpretationId of claim.interpretationSources || []) {
      if (records[interpretationId]?.evidenceUse !== 'interpretation') fail(`${claimId}: interpretation source ${interpretationId} lacks interpretation provenance`);
    }
    for (const topic of claim.topics || []) if (!topicVocabulary[topic]) fail(`${claimId}: undeclared topic ${topic}`);
  }
}
for (const id of EXPANSION_IDS) if (!categorySourceUnion.has(id)) warn(`${id}: imported source is not in a runtime category bundle`);

const tall = sources.get('scientific-reports-tall-retraction');
const tallRecord = records['scientific-reports-tall-retraction'];
const pubmedRecord = records['pubmed-tall-retraction'];
if (tall?.url !== 'https://www.nature.com/articles/s41598-025-99265-5') fail('Tall el-Hammam retraction URL drift');
if (tallRecord?.identifiers?.doi !== '10.1038/s41598-025-99265-5') fail('Tall el-Hammam DOI drift');
if (pubmedRecord?.identifiers?.pmid !== '40275027') fail('Tall el-Hammam PMID drift');
if (tallRecord?.evidenceUse !== 'negative' || pubmedRecord?.evidenceUse !== 'negative') fail('Tall el-Hammam retraction must remain negative evidence');

const report = {
  generatedAt:new Date().toISOString(),
  sources:sourceIds.length,
  provenance:recordIds.length,
  expansionSources:EXPANSION_IDS.length,
  claims:claims.size,
  categories:categories.length,
  topics:Object.keys(topicVocabulary).length,
  categoryCoverage:Object.fromEntries(categories.map((category) => [category.id,{
    sources:category.sourceIds.length,
    high:category.sourceIds.filter((id) => records[id]?.evidenceUse === 'high').length,
    primaryHigh:category.sourceIds.filter((id) => records[id]?.evidenceUse === 'high' && records[id]?.authority === 'primary').length,
    claims:category.claimIds.length
  }])),
  problems,
  warnings
};
fs.mkdirSync(path.dirname(REPORT_FILE), {recursive:true});
fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report,null,2)}\n`);
if (problems.length) {
  console.error(JSON.stringify(report,null,2));
  process.exit(1);
}
console.log(JSON.stringify(report,null,2));
