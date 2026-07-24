#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CURRENT = path.join(ROOT, 'karty/_data/archaeology-source-registry.json');
const REPORT_DIR = path.join(ROOT, 'reports');
const REPORT = path.join(REPORT_DIR, 'map-archaeology-expansion-inventory.json');
const STALE_SHA = '7765a4cb216509d9462f6c7ac4fa0999909a424b';
const STALE_URL = `https://raw.githubusercontent.com/FedorMilovanov/gb-is-my-strength/${STALE_SHA}/karty/_data/archaeology-source-registry.json`;

const current = JSON.parse(fs.readFileSync(CURRENT, 'utf8'));
const response = await fetch(STALE_URL, { headers: { 'user-agent': 'gb-map-archaeology-inventory/1.0' } });
if (!response.ok) throw new Error(`failed to fetch fixed expansion registry: ${response.status} ${response.statusText}`);
const stale = await response.json();

const byId = (items) => new Map((items || []).map((item) => [item.id, item]));
const currentSources = byId(current.sources);
const staleSources = byId(stale.sources);
const currentClaims = byId(current.claims);
const staleClaims = byId(stale.claims);

const addedSources = [...staleSources.values()]
  .filter((source) => !currentSources.has(source.id))
  .sort((a, b) => a.id.localeCompare(b.id));
const removedSources = [...currentSources.values()]
  .filter((source) => !staleSources.has(source.id))
  .map((source) => source.id)
  .sort();
const changedExisting = [...staleSources.values()]
  .filter((source) => currentSources.has(source.id))
  .map((source) => {
    const canonical = currentSources.get(source.id);
    const fields = ['title','organization','year','url','tier','status','verification','verifiedAt','accessedAt','maps','places','note'];
    const changes = fields.flatMap((field) => {
      const before = canonical[field] ?? null;
      const after = source[field] ?? null;
      return JSON.stringify(before) === JSON.stringify(after) ? [] : [{ field, canonical: before, stale: after }];
    });
    return changes.length ? { id: source.id, changes } : null;
  })
  .filter(Boolean)
  .sort((a, b) => a.id.localeCompare(b.id));

const addedClaims = [...staleClaims.values()]
  .filter((claim) => !currentClaims.has(claim.id))
  .sort((a, b) => a.id.localeCompare(b.id));
const changedClaims = [...staleClaims.values()]
  .filter((claim) => currentClaims.has(claim.id) && JSON.stringify(currentClaims.get(claim.id)) !== JSON.stringify(claim))
  .map((claim) => ({ id: claim.id, canonical: currentClaims.get(claim.id), stale: claim }))
  .sort((a, b) => a.id.localeCompare(b.id));

const ancientPublicationYears = addedSources
  .filter((source) => Number.isFinite(source.year) && source.year < 1800)
  .map((source) => ({ id: source.id, stalePublicationYear: source.year, title: source.title }));
const undatedAccessYear = addedSources
  .filter((source) => source.year === 2026 && !/2026/.test(String(source.title || '')))
  .map((source) => source.id);
const imported = addedSources.filter((source) => source.verification !== 'verified').map((source) => source.id);
const retractions = addedSources.filter((source) => source.status === 'retracted' || source.tier === 'retraction-record').map((source) => ({ id: source.id, url: source.url }));

const runtimeCategories = Array.isArray(stale.runtimeCategories) ? stale.runtimeCategories : [];
const report = {
  generatedAt: new Date().toISOString(),
  currentBoundary: current.sourceBoundary,
  fixedExpansionSha: STALE_SHA,
  counts: {
    currentSources: current.sources?.length || 0,
    staleSources: stale.sources?.length || 0,
    addedSources: addedSources.length,
    removedSources: removedSources.length,
    changedExisting: changedExisting.length,
    currentClaims: current.claims?.length || 0,
    staleClaims: stale.claims?.length || 0,
    addedClaims: addedClaims.length,
    changedClaims: changedClaims.length,
    runtimeCategories: runtimeCategories.length,
    ancientPublicationYears: ancientPublicationYears.length,
    importedAddedSources: imported.length,
  },
  addedSourceIds: addedSources.map((source) => source.id),
  addedSources,
  removedSources,
  changedExisting,
  addedClaims,
  changedClaims,
  runtimeCategories,
  reviewFlags: {
    ancientPublicationYears,
    probableAccessYearStoredAsPublicationYear: undatedAccessYear,
    importedAddedSources: imported,
    retractions,
    canonicalTallRetraction: currentSources.get('scientific-reports-tall-retraction') || null,
    staleTallRetraction: staleSources.get('scientific-reports-tall-retraction') || null,
  },
};

fs.mkdirSync(REPORT_DIR, { recursive: true });
fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.counts, null, 2));
console.log(`added source IDs (${addedSources.length}): ${report.addedSourceIds.join(', ')}`);

if (runtimeCategories.length !== 12) {
  throw new Error(`expected 12 stale runtime categories, found ${runtimeCategories.length}`);
}
if (!addedSources.length) throw new Error('fixed expansion contains no new sources');
if (!addedClaims.length) throw new Error('fixed expansion contains no new claims');
if (!report.reviewFlags.staleTallRetraction || !report.reviewFlags.canonicalTallRetraction) {
  throw new Error('Tall el-Hammam comparison record is missing');
}
