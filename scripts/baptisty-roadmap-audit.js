#!/usr/bin/env node
/*
 * baptisty-roadmap-audit.js
 *
 * Guards the long-term editorial expansion pipeline for the Russian Baptists
 * series. The owner explicitly said this series will be filled by many agents
 * over time; this audit prevents "quick patch" work from erasing the deeper
 * plan for sources, images, structure, text depth and map sync.
 *
 * v4 also guards the boundary between the current published surface and the
 * future book planning graph. A planned chapter is not a route, Research
 * evidence class is not Product source-confidence, and registry presence is
 * not publication proof.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { buildPublicSurfaceRegistry } = require('./lib/public-surface-registry');
const ROOT = path.join(__dirname, '..');
const problems = [];
function fail(msg) { problems.push(msg); console.log('❌ ' + msg); }
function ok(msg) { console.log('✅ ' + msg); }
function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function sameMembers(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && expected.every((value) => actual.includes(value));
}

const series = readJson('data/series.json')['russian-baptism'];
const roadmap = readJson('data/baptisty-rossii-expansion-roadmap.json');
const publicSurface = buildPublicSurfaceRegistry();
for (const error of publicSurface.errors || []) fail(`public surface registry: ${error}`);
const publicByRoute = new Map((publicSurface.entries || []).map((entry) => [entry.route, entry]));

if (!series) fail('series.json missing russian-baptism');
const seriesBaseUrl = String(series?.baseUrl || '').trim();
if (!/^\/[^?#]*\/$/.test(seriesBaseUrl)) fail(`series.json russian-baptism.baseUrl must be a canonical root-relative directory route, got ${seriesBaseUrl || '<missing>'}`);
if (roadmap.series !== 'russian-baptism') fail('roadmap series key mismatch');

// ── Book Authority v2 / roadmap v4 boundary ────────────────────────────────
if (roadmap.version !== '2026-08-20.v4') fail(`roadmap version must be 2026-08-20.v4, got ${roadmap.version || '<missing>'}`);
if (roadmap.authorityDocument !== 'docs/BAPTISTY-ROSSII-BOOK-AUTHORITY-V2.md') fail('roadmap authorityDocument must point to Book Authority v2');
if (!exists(roadmap.authorityDocument || '')) fail(`Book Authority document missing: ${roadmap.authorityDocument || '<missing>'}`);
if (roadmap.currentArchitectureDocument !== 'docs/BAPTISTY-ROSSII-EDITORIAL-ARCHITECTURE.md') fail('currentArchitectureDocument must preserve the current published architecture authority');
if (!exists(roadmap.currentArchitectureDocument || '')) fail(`current architecture document missing: ${roadmap.currentArchitectureDocument || '<missing>'}`);

const published = roadmap.currentPublishedSurface || {};
if (published.landing !== '/baptisty-rossii/') fail('currentPublishedSurface.landing must stay /baptisty-rossii/');
if (published.historicalArticleCount !== 9) fail(`current published historicalArticleCount must be 9, got ${published.historicalArticleCount}`);
if (published.referenceCount !== 1) fail(`current published referenceCount must be 1, got ${published.referenceCount}`);
if (published.totalContentRoutes !== 10) fail(`current published totalContentRoutes must be 10, got ${published.totalContentRoutes}`);
if (published.currentBookChapterCount !== 4) fail(`current published chapter count must be 4, got ${published.currentBookChapterCount}`);

if (roadmap.legacyRouteGrowth?.targetTotalWords !== 47400) {
  fail(`legacy route target must remain 47400 for historical audit comparability, got ${roadmap.legacyRouteGrowth?.targetTotalWords}`);
}
const bookTarget = roadmap.bookTargetWords || {};
if (bookTarget.min !== 90000 || bookTarget.max !== 120000 || bookTarget.min >= bookTarget.max) {
  fail(`book target must remain the explicit 90000–120000 editorial range, got ${bookTarget.min}–${bookTarget.max}`);
}
const chapterTarget = roadmap.chapterTargetWords || {};
if (chapterTarget.typicalMin !== 4500 || chapterTarget.typicalMax !== 7000 || chapterTarget.typicalMin >= chapterTarget.typicalMax) {
  fail(`typical chapter target must remain 4500–7000, got ${chapterTarget.typicalMin}–${chapterTarget.typicalMax}`);
}

const expectedEvidenceClasses = ['A1', 'A2', 'A3', 'B1', 'C', 'D'];
const expectedStateAxes = ['accessState', 'locatorState', 'rightsState', 'publicationState'];
const expectedHolds = ['EVIDENCE_HOLD', 'LOCATOR_HOLD', 'ARCHIVE_HOLD', 'RIGHTS_HOLD', 'PUBLICATION_HOLD'];
if (!sameMembers(roadmap.researchEvidenceModel?.classes, expectedEvidenceClasses)) fail('Research evidence classes must stay A1/A2/A3/B1/C/D');
if (!sameMembers(roadmap.researchEvidenceModel?.stateAxes, expectedStateAxes)) fail('Research state axes must stay access/locator/rights/publication');
if (!sameMembers(roadmap.researchEvidenceModel?.holds, expectedHolds)) fail('Research HOLD set drifted from Book Authority v2');
if (roadmap.productConfidenceAxis?.status !== 'not-yet-centralized') fail('Product Baptist source-confidence must stay explicitly not-yet-centralized until a dedicated publication lane creates a real SSOT');
if (roadmap.productConfidenceAxis?.registry !== null) fail('Product Baptist source-confidence registry must stay null while no canonical registry exists');
if (roadmap.productConfidenceAxis?.separateFromResearchEvidenceClass !== true) fail('Product confidence must stay independent from Research evidenceClass');
if (roadmap.productConfidenceAxis?.mechanicalMappingForbidden !== true) fail('mechanical Research→Product confidence mapping must remain forbidden');

const requiredReady = [
  'independentHistoricalQuestion',
  'sourceToClaimMatrix',
  'strongClaimsCalibratedToEvidence',
  'directQuotesHaveVerifiedLocatorAndContext',
  'noBlockingResearchHold',
  'mediaRightsCheckedSeparately',
  'currentRouteRelationshipDeclared',
  'narrativeAndVisualBrief',
  'noPlaceholderRoute',
  'targetedChecksDeclared',
];
if (!sameMembers(roadmap.publicationDefinitionOfReady, requiredReady)) fail('publication Definition of Ready drifted from Book Authority v2');

const architecture = roadmap.targetArchitecture || [];
if (architecture.length !== 5) fail(`future book planning graph must contain exactly 5 parts, got ${architecture.length}`);
const plannedChapters = architecture.flatMap((part) => part.chapters || []);
if (plannedChapters.length !== 20) fail(`future book planning graph must contain exactly 20 chapters, got ${plannedChapters.length}`);
const plannedIds = plannedChapters.map((chapter) => chapter.id);
if (new Set(plannedIds).size !== plannedIds.length) fail('future book planning graph has duplicate chapter ids');
for (let id = 1; id <= 20; id += 1) {
  if (!plannedIds.includes(id)) fail(`future book planning graph missing chapter id ${id}`);
}
for (const part of architecture) {
  if (!Number.isInteger(part.part) || part.part < 1 || part.part > 5) fail(`invalid future book part id: ${part.part}`);
  if (!String(part.title || '').trim()) fail(`future book part ${part.part}: title missing`);
  for (const chapter of part.chapters || []) {
    if (!String(chapter.title || '').trim()) fail(`future chapter ${chapter.id}: title missing`);
    if (chapter.status !== 'planned') fail(`future chapter ${chapter.id}: status must be planned until a dedicated publication lane promotes it`);
    for (const forbiddenKey of ['href', 'route', 'slug', 'url', 'path']) {
      if (Object.prototype.hasOwnProperty.call(chapter, forbiddenKey)) {
        fail(`future chapter ${chapter.id}: planning graph must not create ${forbiddenKey}; no placeholder routes`);
      }
    }
  }
}

// Preserve the old Research binding only as provenance. New transfers must not
// mistake it for current publication authority.
if (roadmap.legacyResearchBinding?.status !== 'legacy-review-required') fail('legacy Research binding must remain explicitly review-required');
if (!String(roadmap.legacyResearchBinding?.sourceRepo || '').includes('FedorMilovanov/Research')) fail('legacy Research repo provenance missing');

// ── Existing route-growth and media contracts ──────────────────────────────
if (!roadmap.globalTargets || roadmap.globalTargets.minimumWordsPerArticle < 2500) fail('minimumWordsPerArticle must be >= 2500');
if (roadmap.globalTargets.remoteImagesAllowed !== false) fail('remoteImagesAllowed must stay false — no production hotlinking');
if (!roadmap.globalTargets.mediaLedgerRequired) fail('media ledger must be required');
if (!roadmap.globalTargets.mapSyncRequired) fail('map sync must be required');
if (roadmap.mediaPolicy?.articleReadyIsSiteReady !== false) fail('article-ready archive status must not equal site-ready publication status');

const expectedPipeline = ['candidate', 'identity', 'provenance', 'rights', 'exact caption', 'local binary', 'SHA / integrity', 'responsive derivatives where applicable', 'media ledger', 'publication'];
if (!sameMembers(roadmap.mediaPolicy?.pipeline, expectedPipeline)) fail('rights-first media publication pipeline drifted');

const allowed = new Set(['Public Domain', 'CC0', 'CC BY', 'CC BY-SA', 'own screenshot with rights', 'explicit permission']);
for (const license of roadmap.mediaPolicy?.allowedLicenses || []) {
  if (!allowed.has(license)) fail(`unexpected allowed license: ${license}`);
}
for (const forbidden of ['unknown license', 'remote hotlink', 'AI-generated historical photo pretending to be real', 'mass import']) {
  const allForbidden = JSON.stringify(roadmap.mediaPolicy?.forbidden || []);
  if (!allForbidden.toLowerCase().includes(forbidden.toLowerCase().slice(0, 12))) {
    fail(`media policy should forbid ${forbidden}`);
  }
}

const parts = roadmap.parts || [];
if (parts.length !== 10) fail(`roadmap must cover 10 current content parts, got ${parts.length}`);
const bySlug = new Map(parts.map((p) => [p.slug, p]));
let legacyWordSum = 0;
for (const part of series?.parts || []) {
  const p = bySlug.get(part.slug);
  if (!p) { fail(`roadmap missing part: ${part.slug}`); continue; }
  if (p.n !== part.n) fail(`${part.slug}: part number mismatch`);
  if ((p.targetWordCount || 0) < 2800) fail(`${part.slug}: targetWordCount must be >= 2800`);
  legacyWordSum += Number(p.targetWordCount || 0);
  if (!Array.isArray(p.mustDeepen) || p.mustDeepen.length < 4) fail(`${part.slug}: needs at least 4 mustDeepen items`);
  if (!Array.isArray(p.mediaSlots) || p.mediaSlots.length < 3) fail(`${part.slug}: needs at least 3 mediaSlots`);
  if (!Array.isArray(p.sourceFiles) || p.sourceFiles.length < 1) fail(`${part.slug}: needs sourceFiles`);
  if (!Array.isArray(p.mapSync) || p.mapSync.length < 1) fail(`${part.slug}: needs mapSync items`);
  if (p.referenceEndpaper !== true) {
    if (!Array.isArray(p.feedsPlannedChapters) || p.feedsPlannedChapters.length < 1) fail(`${part.slug}: current article must declare which future planning chapters it feeds`);
    for (const id of p.feedsPlannedChapters || []) {
      if (!plannedIds.includes(id)) fail(`${part.slug}: feeds unknown planned chapter ${id}`);
    }
  } else if (p.slug !== 'spravochnik') {
    fail(`${part.slug}: only spravochnik may be the reference endpaper`);
  }
  for (const f of p.sourceFiles || []) {
    if (!exists(`baptisty-rossii/research/${f}`)) fail(`${part.slug}: source file missing: ${f}`);
  }
  const route = `${seriesBaseUrl}${part.slug}/`;
  const publishedEntry = publicByRoute.get(route);
  if (!publishedEntry) fail(`${part.slug}: public article missing from publication authority (${route})`);
  else {
    if (publishedEntry.status !== 'production-dist') fail(`${part.slug}: publication authority status must be production-dist, got ${publishedEntry.status || '<missing>'}`);
    if (publishedEntry.routeRole !== 'reading') fail(`${part.slug}: publication authority routeRole must be reading, got ${publishedEntry.routeRole || '<missing>'}`);
  }
}
if (legacyWordSum !== roadmap.legacyRouteGrowth?.targetTotalWords) {
  fail(`legacy route target sum ${legacyWordSum} must equal declared ${roadmap.legacyRouteGrowth?.targetTotalWords}`);
}

if (!exists('baptisty-rossii/research/31-editorial-expansion-roadmap-2026-06-19.md')) fail('human editorial roadmap missing');
else {
  const doc = read('baptisty-rossii/research/31-editorial-expansion-roadmap-2026-06-19.md');
  const docLower = doc.toLowerCase();
  for (const marker of ['hotlink', 'media ledger', 'ai-картинку', '3d-карту']) {
    if (!docLower.includes(marker)) fail(`human roadmap missing marker: ${marker}`);
  }
}

if (!exists('baptisty-rossii/research/media-ledger.md')) fail('media ledger file missing');
else {
  const ledger = read('baptisty-rossii/research/media-ledger.md');
  for (const marker of ['Public Domain', 'CC BY-SA', 'unknown license', 'AI-generated image']) {
    if (!ledger.includes(marker)) fail(`media ledger missing policy marker: ${marker}`);
  }

  const ledgerRows = new Map();
  for (const line of ledger.split(/\r?\n/)) {
    if (!line.startsWith('| `')) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 11) {
      fail(`media ledger evidence row has ${cells.length} columns; expected 11`);
      continue;
    }
    const evidenceId = cells[0].replace(/^`|`$/g, '');
    if (!evidenceId) continue;
    if (ledgerRows.has(evidenceId)) {
      fail(`media ledger duplicate evidence id: ${evidenceId}`);
      continue;
    }
    ledgerRows.set(evidenceId, {
      article: cells[1].replace(/^`|`$/g, ''),
      localPath: cells[2].replace(/^`|`$/g, ''),
      sourceUrl: cells[4],
      license: cells[6],
      masterProof: cells[9],
      status: cells[10],
    });
  }

  const evidenceMarkers = new Map();
  const componentDir = path.join(ROOT, 'src/components/baptisty-rossii');
  for (const name of fs.readdirSync(componentDir).filter((entry) => entry.endsWith('.astro'))) {
    const rel = `src/components/baptisty-rossii/${name}`;
    const source = read(rel);
    const markerRe = /data-baptist-master-evidence="([^"]+)"/g;
    for (const match of source.matchAll(markerRe)) {
      const evidenceId = match[1];
      if (evidenceMarkers.has(evidenceId)) fail(`duplicate published Baptist evidence id: ${evidenceId}`);
      else evidenceMarkers.set(evidenceId, rel);
    }
  }

  for (const [evidenceId, sourceFile] of evidenceMarkers) {
    const row = ledgerRows.get(evidenceId);
    if (!row) {
      fail(`${sourceFile}: published evidence ${evidenceId} is missing from media ledger`);
      continue;
    }
    if (!row.article) fail(`${evidenceId}: media ledger article is empty`);
    if (!row.localPath || !exists(row.localPath)) fail(`${evidenceId}: registered local media file is missing: ${row.localPath || '(empty)'}`);
    if (!/^https:\/\//.test(row.sourceUrl)) fail(`${evidenceId}: Source URL must be an https provenance URL`);
    if (!allowed.has(row.license)) fail(`${evidenceId}: published evidence has disallowed license: ${row.license}`);
    if (!/[a-f0-9]{64}/i.test(row.masterProof)) fail(`${evidenceId}: MASTER proof must include a SHA-256`);
    if (!/PUBLISHED/i.test(row.status) || !/VERIFIED/i.test(row.status)) fail(`${evidenceId}: production evidence must be PUBLISHED / VERIFIED`);
  }

  for (const [evidenceId, row] of ledgerRows) {
    if (/PUBLISHED/i.test(row.status) && !evidenceMarkers.has(evidenceId)) {
      fail(`${evidenceId}: ledger says PUBLISHED but no production data-baptist-master-evidence marker exists`);
    }
  }
}

console.log('\nBAPTISTY ROADMAP AUDIT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s). Keep working before deploy.`);
  process.exit(1);
}
ok('Russian Baptists Book Authority v2 roadmap is guarded');
