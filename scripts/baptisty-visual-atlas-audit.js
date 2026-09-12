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
const allowedStatuses = new Set(['planned', 'production']);
for (const part of series.parts || []) {
  const d = bySlug.get(part.slug);
  if (!d) { bad(`missing diagram for ${part.slug}`); continue; }
  for (const key of ['id','type','status','priority','title','purpose']) {
    if (!d[key]) bad(`${part.slug}: missing ${key}`);
  }
  if (!allowedStatuses.has(d.status)) bad(`${part.slug}: unsupported status ${d.status}`);
  if (!Array.isArray(d.nodes) || d.nodes.length < 4) bad(`${part.slug}: diagram needs >=4 nodes`);
  if (!Array.isArray(d.sourceFiles) || !d.sourceFiles.length) bad(`${part.slug}: diagram needs source files`);
  if (!Array.isArray(d.mapSync) || !d.mapSync.length) bad(`${part.slug}: diagram needs mapSync`);
  if (!Array.isArray(d.visualRisks) || !d.visualRisks.length) bad(`${part.slug}: diagram needs visualRisks`);
  for (const f of d.sourceFiles || []) if (!exists(`baptisty-rossii/research/${f}`)) bad(`${part.slug}: missing source ${f}`);

  if (d.status === 'production') {
    for (const key of ['assetPath','articleComponent','articleAnchor','implementedAt','caption','sourceConfidence']) {
      if (!d[key]) bad(`${part.slug}: production diagram missing ${key}`);
    }
    if (d.assetPath && !exists(d.assetPath)) bad(`${part.slug}: production SVG missing at ${d.assetPath}`);
    if (d.articleComponent && !exists(d.articleComponent)) bad(`${part.slug}: article component missing at ${d.articleComponent}`);
    if (d.assetPath && exists(d.assetPath)) {
      const svg = read(d.assetPath);
      if (!/<svg\b/i.test(svg)) bad(`${part.slug}: asset is not SVG`);
      if (!/<title\b[^>]*>/i.test(svg)) bad(`${part.slug}: SVG title missing`);
      if (!/<desc\b[^>]*>/i.test(svg)) bad(`${part.slug}: SVG desc missing`);
      if (/<image\b[^>]*(?:href|xlink:href)=[\"']https?:/i.test(svg)) bad(`${part.slug}: remote raster inside SVG forbidden`);
      if (Buffer.byteLength(svg) > (atlas.policy.maxSvgBytesPreferred || 45000)) bad(`${part.slug}: SVG exceeds preferred byte ceiling`);
    }
    if (d.articleComponent && exists(d.articleComponent)) {
      const article = read(d.articleComponent);
      if (d.assetPath && !article.includes(path.basename(d.assetPath))) bad(`${part.slug}: article does not reference production SVG`);
      if (d.articleAnchor && !article.includes(`id="${d.articleAnchor}"`)) bad(`${part.slug}: article anchor missing`);
      if (!article.includes('<figcaption')) bad(`${part.slug}: visible figure caption missing`);
    }
  }
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
ok(`${diagrams.filter(d => d.status === 'production').length}/${diagrams.length} production atlas diagrams guarded`);
