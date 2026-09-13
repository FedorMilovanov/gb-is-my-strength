#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const LEDGER = path.join(ROOT, 'baptisty-rossii', 'research', 'media-ledger.md');
const SOURCE_DIR = path.join(ROOT, 'src', 'components', 'baptisty-rossii');
const ALLOWED_LICENSES = new Set([
  'Public Domain', 'CC0', 'CC BY', 'CC BY-SA',
  'explicit permission', 'own screenshot with rights',
]);

const problems = [];
const ok = (msg) => console.log('✅ ' + msg);
const bad = (msg) => { problems.push(msg); console.log('❌ ' + msg); };
const cleanCode = (value) => String(value || '').replace(/^\x60|\x60$/g, '').trim();
const splitRow = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((v) => v.trim());
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.astro')) out.push(full);
  }
  return out;
}
const ledgerText = fs.readFileSync(LEDGER, 'utf8');
const rows = [];
for (const line of ledgerText.split(/\r?\n/)) {
  if (!line.startsWith('| \x60')) continue;
  const cells = splitRow(line);
  if (cells.length < 11) continue;
  rows.push({
    evidenceId: cleanCode(cells[0]),
    article: cleanCode(cells[1]),
    localFile: cleanCode(cells[2]),
    sourceUrl: cells[4],
    license: cells[6],
    master: cells[9],
    status: cells[10],
  });
}

const published = rows.filter((row) => row.status.includes('PUBLISHED / VERIFIED'));
const sourceFiles = walk(SOURCE_DIR);
const sourceText = sourceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const usedPublicationFiles = new Set(published.map((row) => row.localFile.replace(/\\/g, '/')));
const usedRawFiles = new Set();

if (sourceText.includes('data-baptist-master-evidence={item.evidenceId}')) {
  ok('generic historical media component emits evidence marker');
} else {
  bad('generic historical media component does not emit evidence marker');
}
for (const row of published) {
  const rel = row.localFile.replace(/\\/g, '/');
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    bad(row.evidenceId + ': missing local file ' + rel);
    continue;
  }
  ok(row.evidenceId + ': local file exists');

  if (/^https:\/\//i.test(row.sourceUrl)) ok(row.evidenceId + ': HTTPS provenance');
  else bad(row.evidenceId + ': provenance URL must be HTTPS');

  if (ALLOWED_LICENSES.has(row.license)) ok(row.evidenceId + ': allowed license ' + row.license);
  else bad(row.evidenceId + ': unsupported license ' + row.license);

  const expected = [...row.master.matchAll(/[a-f0-9]{64}/ig)].map((m) => m[0].toLowerCase());
  if (!expected.length) bad(row.evidenceId + ': SHA-256 missing');
  else if (expected.includes(sha256(full))) ok(row.evidenceId + ': publication SHA-256 matches ledger');
  else bad(row.evidenceId + ': local publication SHA-256 is not recorded in ledger');

  const sourceMeta = row.master.match(/source=`([^`]+)`;[^|]*source-sha256=`([a-f0-9]{64})`/i);
  if (sourceMeta) {
    const sourceRel = sourceMeta[1].replace(/\\/g, '/');
    usedRawFiles.add(sourceRel);
    const sourceFile = path.join(ROOT, sourceRel);
    if (!fs.existsSync(sourceFile)) bad(row.evidenceId + ': archived source byte is missing');
    else if (sha256(sourceFile) !== sourceMeta[2].toLowerCase()) bad(row.evidenceId + ': archived source SHA-256 mismatch');
    else ok(row.evidenceId + ': archived source byte + SHA-256 verified');
  }

  const direct = 'data-baptist-master-evidence="' + row.evidenceId + '"';
  const single = "evidenceId: '" + row.evidenceId + "'";
  const double = 'evidenceId: "' + row.evidenceId + '"';
  if (sourceText.includes(direct) || sourceText.includes(single) || sourceText.includes(double)) {
    ok(row.evidenceId + ': source usage found');
  } else bad(row.evidenceId + ': no Baptist source usage');

  if (sourceText.includes(rel) || sourceText.includes(rel.replace(/^images\//, '../../images/'))) {
    ok(row.evidenceId + ': local asset referenced');
  } else bad(row.evidenceId + ': local asset not referenced');
}
function auditOrphans(dirRel, allowed, label) {
  const dir = path.join(ROOT, dirRel);
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const rel = dirRel + '/' + entry.name;
    if (allowed.has(rel)) ok(label + ': tracked ' + rel);
    else bad(label + ': orphan file ' + rel);
  }
}

auditOrphans('images/baptisty-rossii/historical', usedPublicationFiles, 'publication media');
auditOrphans('baptisty-rossii/research/raw-media/commons', usedRawFiles, 'archived source media');

const sourceEvidenceIds = new Set();
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(/data-baptist-master-evidence=["']([^"']+)["']/g)) sourceEvidenceIds.add(m[1]);
  for (const m of text.matchAll(/evidenceId:\s*["']([^"']+)["']/g)) sourceEvidenceIds.add(m[1]);
}
const ledgerIds = new Set(published.map((row) => row.evidenceId));
for (const evidenceId of sourceEvidenceIds) {
  if (ledgerIds.has(evidenceId)) ok(evidenceId + ': marker resolves to verified ledger row');
  else bad(evidenceId + ': marker has no PUBLISHED / VERIFIED ledger row');
}

const counts = new Map();
for (const row of published) counts.set(row.article, (counts.get(row.article) || 0) + 1);
console.log('\nBAPTIST AUTHENTIC MEDIA COVERAGE');
for (const [article, count] of [...counts.entries()].sort()) console.log('- ' + article + ': ' + count);

if (problems.length) {
  console.log('\n❌ ' + problems.length + ' authentic-media contract problem(s).');
  process.exit(1);
}
console.log('\n✅ ' + published.length + ' PUBLISHED / VERIFIED Baptist media items pass provenance, file, hash and usage checks.');
