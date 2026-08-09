#!/usr/bin/env node
/*
 * baptisty-roadmap-audit.js
 *
 * Guards the long-term editorial expansion pipeline for the Russian Baptists
 * series. The owner explicitly said this series will be filled by many agents
 * over time; this audit prevents "quick patch" work from erasing the deeper
 * plan for sources, images, structure, text depth and map sync.
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

const series = readJson('data/series.json')['russian-baptism'];
const roadmap = readJson('data/baptisty-rossii-expansion-roadmap.json');
const publicSurface = buildPublicSurfaceRegistry();
for (const error of publicSurface.errors || []) fail(`public surface registry: ${error}`);
const publicByRoute = new Map((publicSurface.entries || []).map((entry) => [entry.route, entry]));

if (!series) fail('series.json missing russian-baptism');
if (roadmap.series !== 'russian-baptism') fail('roadmap series key mismatch');
if (!roadmap.globalTargets || roadmap.globalTargets.minimumWordsPerArticle < 2500) fail('minimumWordsPerArticle must be >= 2500');
if (roadmap.globalTargets.remoteImagesAllowed !== false) fail('remoteImagesAllowed must stay false — no production hotlinking');
if (!roadmap.globalTargets.mediaLedgerRequired) fail('media ledger must be required');
if (!roadmap.globalTargets.mapSyncRequired) fail('map sync must be required');

const allowed = new Set(['Public Domain', 'CC0', 'CC BY', 'CC BY-SA', 'own screenshot with rights', 'explicit permission']);
for (const license of roadmap.mediaPolicy?.allowedLicenses || []) {
  if (!allowed.has(license)) fail(`unexpected allowed license: ${license}`);
}
for (const forbidden of ['unknown license', 'remote hotlink', 'AI-generated historical photo pretending to be real']) {
  const allForbidden = JSON.stringify(roadmap.mediaPolicy?.forbidden || []);
  if (!allForbidden.toLowerCase().includes(forbidden.toLowerCase().slice(0, 12))) {
    fail(`media policy should forbid ${forbidden}`);
  }
}

const parts = roadmap.parts || [];
if (parts.length !== 10) fail(`roadmap must cover 10 parts, got ${parts.length}`);
const bySlug = new Map(parts.map((p) => [p.slug, p]));
for (const part of series.parts || []) {
  const p = bySlug.get(part.slug);
  if (!p) { fail(`roadmap missing part: ${part.slug}`); continue; }
  if (p.n !== part.n) fail(`${part.slug}: part number mismatch`);
  if ((p.targetWordCount || 0) < 2800) fail(`${part.slug}: targetWordCount must be >= 2800`);
  if (!Array.isArray(p.mustDeepen) || p.mustDeepen.length < 4) fail(`${part.slug}: needs at least 4 mustDeepen items`);
  if (!Array.isArray(p.mediaSlots) || p.mediaSlots.length < 3) fail(`${part.slug}: needs at least 3 mediaSlots`);
  if (!Array.isArray(p.sourceFiles) || p.sourceFiles.length < 1) fail(`${part.slug}: needs sourceFiles`);
  if (!Array.isArray(p.mapSync) || p.mapSync.length < 1) fail(`${part.slug}: needs mapSync items`);
  for (const f of p.sourceFiles || []) {
    if (!exists(`baptisty-rossii/research/${f}`)) fail(`${part.slug}: source file missing: ${f}`);
  }
  const route = `/baptisty-rossii/${part.slug}/`;
  const published = publicByRoute.get(route);
  if (!published) fail(`${part.slug}: public article missing from publication authority (${route})`);
  else {
    if (published.status !== 'production-dist') fail(`${part.slug}: publication authority status must be production-dist, got ${published.status || '<missing>'}`);
    if (published.routeRole !== 'reading') fail(`${part.slug}: publication authority routeRole must be reading, got ${published.routeRole || '<missing>'}`);
  }
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
ok('Russian Baptists expansion roadmap is guarded');
