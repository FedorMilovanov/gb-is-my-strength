#!/usr/bin/env node
/** Fail-closed static contract for the Pihahiroth uncertainty projection. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const paths = {
  authority: 'karty/ishod/pihahiroth-authority.json',
  historicalRoute: 'karty/ishod/route.json',
  adapter: 'src/components/karty/ishod/IshodMap.astro',
};
const errors = [];
const requireValue = (condition, message) => { if (!condition) errors.push(message); };
const text = (path) => existsSync(path) ? readFileSync(path, 'utf8') : '';
const json = (path) => {
  try { return JSON.parse(text(path)); }
  catch (error) { errors.push(`${path}: invalid JSON: ${error.message}`); return {}; }
};
const gitBlobSha = (content) => createHash('sha1')
  .update(`blob ${Buffer.byteLength(content)}\0`)
  .update(content)
  .digest('hex');

for (const [name, path] of Object.entries(paths)) requireValue(existsSync(path), `${name} missing: ${path}`);

const authority = json(paths.authority);
const historicalText = text(paths.historicalRoute);
const historicalRoute = json(paths.historicalRoute);
const adapter = text(paths.adapter);
const expectedCorridors = ['PH-CAND-NORTH', 'PH-CAND-BALLAH', 'PH-CAND-BITTER'];
const expectedConstraints = Array.from({ length: 8 }, (_, index) => `PH-T${String(index + 1).padStart(2, '0')}`);
const expectedSources = Array.from({ length: 9 }, (_, index) => `PH-S${String(index + 1).padStart(2, '0')}`);

requireValue(authority.schemaVersion === 1, 'authority schemaVersion drift');
requireValue(authority.authorityId === 'PRODUCT-ATLAS-PIHAHIROTH-UNCERTAINTY-2026-08-02', 'authority ID drift');
requireValue(authority.researchAuthorityId === 'ATLAS-PIHAHIROTH-AUTHORITY-2026-08-02', 'Research authority ID drift');
requireValue(authority.researchSnapshot === 'bd1617782796dc9a56b2791b3d07351dc42a245e', 'Research current-authority snapshot drift');
requireValue(authority.researchRegistrySnapshot === 'a0bc169f735444da661a9a7348c99e467a715991', 'Research registry snapshot drift');
requireValue(authority.historicalRoutePath === paths.historicalRoute, 'historical route path drift');
requireValue(authority.historicalRouteBlobSha === 'f1cb58be907efb0fb9cfa8bc344b07b5cf84edb2', 'declared historical route blob drift');
requireValue(gitBlobSha(historicalText) === authority.historicalRouteBlobSha, 'historical route bytes no longer match the pinned Git blob');
requireValue(authority.route === '/karty/ishod/', 'public route drift');
requireValue(authority.placeId === 'pihahiroth', 'place ID drift');
requireValue(authority.status === 'PUBLIC_UNCERTAINTY_CORRIDORS_NO_AUTHORITATIVE_POINT', 'publication status drift');
requireValue(authority.exactCoordinateStatus === 'UNRESOLVED', 'exact coordinate must remain unresolved');
requireValue(authority.renderSinglePoint === false, 'single authoritative point must remain forbidden');
requireValue(authority.readerLabel === 'Точное место Пи-Гахирофа и перехода не установлено; показаны исследовательские коридоры, а не найденная точка.', 'reader label drift');
requireValue(authority.palaeowaterDisclaimer.includes('нельзя автоматически переносить'), 'palaeowater disclaimer missing');

const corridors = Array.isArray(authority.corridors) ? authority.corridors : [];
requireValue(corridors.length === 3, 'exactly three corridors required');
requireValue(JSON.stringify(corridors.map((item) => item.featureId)) === JSON.stringify(expectedCorridors), 'corridor ID/order drift');
const corridorDigests = new Set();
for (const corridor of corridors) {
  requireValue(['CANDIDATE', 'ALTERNATIVE'].includes(corridor.status), `${corridor.featureId}: invalid status`);
  requireValue(['LOW', 'MODERATE_LOW'].includes(corridor.confidence), `${corridor.featureId}: invalid confidence`);
  requireValue(corridor.geometryType === 'SCHEMATIC_UNCERTAINTY_CORRIDOR', `${corridor.featureId}: geometry type drift`);
  requireValue(corridor.rights === 'ORIGINAL_SCHEMATIC_GEOMETRY', `${corridor.featureId}: rights drift`);
  requireValue(corridor.evidenceClass === 'A1_A3_SYNTHESIS', `${corridor.featureId}: evidence class drift`);
  requireValue(typeof corridor.d === 'string' && /^M[\d,.\sCLZ-]+$/i.test(corridor.d), `${corridor.featureId}: invalid SVG path`);
  requireValue(Array.isArray(corridor.centroid) && corridor.centroid.length === 2, `${corridor.featureId}: centroid missing`);
  requireValue(Array.isArray(corridor.labelPos) && corridor.labelPos.length === 2, `${corridor.featureId}: label position missing`);
  requireValue(Array.isArray(corridor.sourceIds) && corridor.sourceIds.length >= 5, `${corridor.featureId}: source bindings missing`);
  requireValue(corridor.sourceIds.every((id) => expectedSources.includes(id)), `${corridor.featureId}: unknown source ID`);
  requireValue(/^#[0-9a-f]{6}$/i.test(corridor.fill) && /^#[0-9a-f]{6}$/i.test(corridor.stroke), `${corridor.featureId}: color contract drift`);
  corridorDigests.add(createHash('sha256').update(corridor.d).digest('hex'));
}
requireValue(corridorDigests.size === 3, 'corridor geometries must be distinct');

requireValue(JSON.stringify(authority.sourceContract?.textualConstraintIds) === JSON.stringify(expectedConstraints), 'textual constraint set drift');
requireValue(JSON.stringify(authority.sourceContract?.sourceIds) === JSON.stringify(expectedSources), 'source ID set drift');
requireValue(authority.sourceContract?.directQuotesApproved === false, 'direct quotation must remain unapproved');
requireValue(authority.sourceContract?.authoritativePoints === 0, 'authoritative point count must remain zero');
requireValue(authority.rightsContract?.geometry === 'ORIGINAL_SCHEMATIC_GEOMETRY', 'geometry rights drift');
requireValue(authority.rightsContract?.externalScholarMapReproduced === false, 'external scholar map reproduction must remain false');
requireValue(authority.rightsContract?.externalImageRequired === false, 'external image dependency must remain false');
requireValue(authority.rightsContract?.publicationState === 'APPROVED_FOR_SCHEMATIC_UNCERTAINTY_RENDERING', 'rights publication state drift');
requireValue(authority.counts?.corridors === 3, 'corridor count drift');
requireValue(authority.counts?.textualConstraints === 8, 'textual constraint count drift');
requireValue(authority.counts?.sources === 9, 'source count drift');
requireValue(authority.counts?.authoritativePoints === 0, 'authority count exposes a point');
requireValue(authority.counts?.directQuotesApproved === 0, 'authority count exposes a direct quote');

const publicAuthoritySurface = JSON.stringify({
  readerLabel: authority.readerLabel,
  palaeowaterDisclaimer: authority.palaeowaterDisclaimer,
  panel: authority.panel,
  corridors: corridors.map(({ label, shortLabel }) => ({ label, shortLabel })),
});
for (const forbidden of authority.forbiddenRuntimeClaims || []) {
  requireValue(!publicAuthoritySurface.includes(forbidden), `forbidden claim leaked into public authority surface: ${forbidden}`);
  requireValue(!adapter.includes(forbidden), `forbidden claim leaked into adapter: ${forbidden}`);
}
requireValue(!publicAuthoritySurface.includes('<blockquote') && !publicAuthoritySurface.includes('<q'), 'direct-quote markup forbidden in Product authority');
requireValue(!/https?:\/\//.test(publicAuthoritySurface), 'public authority surface must not embed external media or copied map URLs');

const oldPlace = (historicalRoute.places || []).find((item) => item.id === 'pihahiroth');
requireValue(Boolean(oldPlace), 'historical point record missing');
requireValue(oldPlace?.x === 360 && oldPlace?.y === 970 && oldPlace?.stage === 1, 'historical point coordinates unexpectedly changed');
requireValue((historicalRoute.verified_waypoints || []).some((item) => item.id === 'wp-suez'), 'historical wp-suez control missing');
requireValue(historicalRoute.signature?.type === 'water-split' && historicalRoute.signature?.origin === 'pihahiroth', 'historical point signature control missing');
requireValue(JSON.stringify(historicalRoute.scientific_variants?.pihahiroth || []).includes('Нувейба'), 'historical fringe-claim control missing');

for (const marker of [
  "fetch('pihahiroth-authority.json')",
  "place.stage = null",
  "place.photos = []",
  "item.id !== 'wp-suez'",
  'delete route.signature',
  "route.scientific_variants.pihahiroth = authority.corridors.map",
  "id: 'pihahiroth-uncertainty'",
  "selector: '[data-pihahiroth-corridor]'",
  "[data-place-id=\"pihahiroth\"]{display:none!important}",
  "path.setAttribute('data-pihahiroth-corridor', corridor.featureId)",
  "path.setAttribute('data-confidence', corridor.confidence)",
  "path.setAttribute('data-rights', corridor.rights)",
  "path.addEventListener('pointerdown'",
  "mapInstance.open('pihahiroth')",
  "container.setAttribute('data-pihahiroth-corridor-count', String(authority.corridors.length))",
]) requireValue(adapter.includes(marker), `adapter contract marker missing: ${marker}`);
requireValue(!adapter.includes("mapInstance.openPlace('pihahiroth')"), 'stale map instance API returned to adapter');

for (const corridor of corridors) {
  requireValue(adapter.includes(corridor.label), `no-JS/adapter surface missing corridor label: ${corridor.featureId}`);
}
requireValue(adapter.includes('<noscript>') && adapter.includes('data-pihahiroth-noscript'), 'no-JS fallback missing');
requireValue(adapter.includes('точное место не установлено'), 'no-JS uncertainty statement missing');
requireValue((adapter.match(/data-pihahiroth-corridor/g) || []).length >= 8, 'corridor rendering and CSS markers incomplete');

if (errors.length) {
  console.error(`❌ Pihahiroth uncertainty release failed (${errors.length})`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log('✅ Pihahiroth uncertainty release passed: 3 corridors, 8 textual constraints, 9 sources, 0 authoritative points, 0 direct quotes');
