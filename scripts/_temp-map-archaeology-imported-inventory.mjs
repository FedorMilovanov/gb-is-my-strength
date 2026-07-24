#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_FILE = path.join(ROOT, 'karty/_data/archaeology-source-registry.json');
const PROVENANCE_FILE = path.join(ROOT, 'karty/_data/archaeology-source-provenance.json');
const REPORT_FILE = path.join(ROOT, 'reports/map-archaeology-imported-inventory.json');

const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
const provenance = JSON.parse(fs.readFileSync(PROVENANCE_FILE, 'utf8'));
const records = provenance.records || {};
const categories = catalog.runtimeCategories || [];
const claims = catalog.claims || [];

const imported = (catalog.sources || [])
  .filter((source) => source.verification === 'imported')
  .map((source) => {
    const record = records[source.id] || null;
    const categoryIds = categories
      .filter((category) => (category.sourceIds || []).includes(source.id))
      .map((category) => category.id)
      .sort();
    const claimRoles = claims.flatMap((claim) => {
      const roles = [];
      if ((claim.evidenceSources || []).includes(source.id)) roles.push('evidence');
      if ((claim.interpretationSources || []).includes(source.id)) roles.push('interpretation');
      return roles.map((role) => ({ claimId: claim.id, status: claim.status, role }));
    });
    return {
      id: source.id,
      title: source.title,
      organization: source.organization,
      url: source.url,
      tier: source.tier,
      status: source.status,
      verifiedAt: source.verifiedAt,
      accessedAt: source.accessedAt,
      maps: source.maps || [],
      places: source.places || [],
      topics: source.topics || [],
      note: source.note || null,
      provenance: record,
      categoryIds,
      claimRoles,
      reviewPriority: record?.evidenceUse === 'high' ? 'blocker' : categoryIds.length || claimRoles.length ? 'category-supporting' : 'unreferenced-supporting'
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

const counts = {
  imported: imported.length,
  highEvidence: imported.filter((item) => item.provenance?.evidenceUse === 'high').length,
  supporting: imported.filter((item) => item.provenance?.evidenceUse === 'supporting').length,
  interpretation: imported.filter((item) => item.provenance?.evidenceUse === 'interpretation').length,
  none: imported.filter((item) => item.provenance?.evidenceUse === 'none').length,
  categoryLinked: imported.filter((item) => item.categoryIds.length).length,
  claimLinked: imported.filter((item) => item.claimRoles.length).length,
  yec: imported.filter((item) => item.provenance?.perspective === 'yec').length,
  accessLimitedNotes: imported.filter((item) => /access|block|reject|intermittent/i.test(item.note || '')).length
};

const problems = [];
if (imported.length !== 10) problems.push(`expected 10 imported records, found ${imported.length}`);
for (const item of imported) {
  if (!item.provenance) problems.push(`${item.id}: missing provenance record`);
  if (item.provenance?.evidenceUse === 'high') problems.push(`${item.id}: imported record must not be high evidence`);
  if (item.status !== 'active') problems.push(`${item.id}: imported queue contains non-active source`);
  if (item.url !== item.provenance?.canonicalUrl) problems.push(`${item.id}: catalog/provenance URL drift`);
  if (item.accessedAt !== item.provenance?.accessedAt) problems.push(`${item.id}: catalog/provenance accessedAt drift`);
  if (item.provenance?.perspective === 'yec' && !['interpretation', 'none'].includes(item.provenance?.evidenceUse)) {
    problems.push(`${item.id}: YEC imported record has invalid evidence role ${item.provenance?.evidenceUse}`);
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  boundary: catalog.sourceBoundary,
  counts,
  ids: imported.map((item) => item.id),
  records: imported,
  problems
};
fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (problems.length) process.exit(1);
