#!/usr/bin/env node
/* Guard for future 2D SVG atlas work in the Russian Baptists series. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const problems = [];
function ok(msg){ console.log('✅ ' + msg); }
function bad(msg){ problems.push(msg); console.log('❌ ' + msg); }
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function json(rel){ return JSON.parse(read(rel)); }
function exists(rel){ return fs.existsSync(path.join(ROOT, rel)); }

const series = json('data/series.json')['russian-baptism'];
const atlas = json('data/baptisty-rossii-visual-atlas.json');
if (atlas.series !== 'russian-baptism') bad('atlas series mismatch');
if (!atlas.policy) bad('atlas policy missing');
else {
  if (atlas.policy.remoteSvgAllowed !== false) bad('remote SVG must stay forbidden');
  if (atlas.policy.externalRasterInsideSvgAllowed !== false) bad('external raster inside SVG must stay forbidden');
  if (atlas.policy.aiHistoricalPhotoAllowed !== false) bad('AI historical-photo pretending must stay forbidden');
  if (!atlas.policy.accessibilityRequired) bad('SVG accessibility must be required');
  if (!atlas.policy.sourceConfidenceRequired) bad('source confidence must be required');
  if (!atlas.policy.mapSyncRequired) bad('map sync must be required');
  if (!atlas.policy.mobileFirstRequired) bad('mobile-first must be required');
}
const diagrams = atlas.diagrams || [];
if (diagrams.length !== 10) bad(`expected 10 diagrams, got ${diagrams.length}`);
const bySlug = new Map(diagrams.map(d => [d.slug, d]));
for (const part of series.parts || []) {
  const d = bySlug.get(part.slug);
  if (!d) { bad(`missing diagram for ${part.slug}`); continue; }
  for (const key of ['id','type','status','priority','title','purpose']) {
    if (!d[key]) bad(`${part.slug}: missing ${key}`);
  }
  if (!Array.isArray(d.nodes) || d.nodes.length < 4) bad(`${part.slug}: diagram needs >=4 nodes`);
  if (!Array.isArray(d.sourceFiles) || !d.sourceFiles.length) bad(`${part.slug}: diagram needs source files`);
  if (!Array.isArray(d.mapSync) || !d.mapSync.length) bad(`${part.slug}: diagram needs mapSync`);
  if (!Array.isArray(d.visualRisks) || !d.visualRisks.length) bad(`${part.slug}: diagram needs visualRisks`);
  for (const f of d.sourceFiles || []) if (!exists(`baptisty-rossii/research/${f}`)) bad(`${part.slug}: missing source ${f}`);
}
if (!exists('baptisty-rossii/research/32-2d-svg-visual-atlas-plan-2026-06-19.md')) bad('human SVG atlas plan missing');
else {
  const doc = read('baptisty-rossii/research/32-2d-svg-visual-atlas-plan-2026-06-19.md').toLowerCase();
  for (const marker of ['2d svg', 'не remote hotlink', 'title/desc', '375px', '3d-картой']) {
    if (!doc.includes(marker.toLowerCase())) bad(`human SVG plan missing marker: ${marker}`);
  }
}
console.log('\nBAPTISTY 2D SVG VISUAL ATLAS AUDIT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s).`);
  process.exit(1);
}
ok('2D SVG atlas plan is guarded');
