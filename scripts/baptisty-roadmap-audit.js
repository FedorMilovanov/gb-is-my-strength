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
const ROOT = path.join(__dirname, '..');
const problems = [];
function fail(msg) { problems.push(msg); console.log('❌ ' + msg); }
function ok(msg) { console.log('✅ ' + msg); }
function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

const series = readJson('data/series.json')['russian-baptism'];
const roadmap = readJson('data/baptisty-rossii-expansion-roadmap.json');

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
  if (!exists(`baptisty-rossii/${part.slug}/index.html`)) fail(`${part.slug}: public article missing`);
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
}

console.log('\nBAPTISTY ROADMAP AUDIT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s). Keep working before deploy.`);
  process.exit(1);
}
ok('Russian Baptists expansion roadmap is guarded');
