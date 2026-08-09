#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ROADMAP_REL = 'data/baptisty-rossii-expansion-roadmap.json';
const LEDGER_REL = 'baptisty-rossii/research/media-ledger.md';
const COMPONENT_DIR_REL = 'src/components/baptisty-rossii';
const EVIDENCE_RE = /data-baptist-master-evidence="([^"]+)"/g;
const COVER_RE = /(?:\.\.\/)+images\/baptisty-rossii\/cover-[^"'\s>]+\.svg/g;

function argValue(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}
function hasFlag(name) { return process.argv.includes(name); }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function readJson(rel) { return JSON.parse(read(rel)); }
function writeJson(rel, value) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}
function writeText(rel, value) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}
function parseLedgerRows(markdown) {
  const rows = new Map();
  const problems = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.startsWith('| `')) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 11) {
      problems.push(`ledger row has ${cells.length} columns; expected 11: ${line.slice(0, 120)}`);
      continue;
    }
    const evidenceId = cells[0].replace(/^`|`$/g, '');
    if (!evidenceId) continue;
    if (rows.has(evidenceId)) {
      problems.push(`duplicate ledger evidence id: ${evidenceId}`);
      continue;
    }
    rows.set(evidenceId, {
      evidenceId,
      article: cells[1].replace(/^`|`$/g, ''),
      localPath: cells[2].replace(/^`|`$/g, ''),
      description: cells[3],
      sourceUrl: cells[4],
      authorOrArchive: cells[5],
      license: cells[6],
      attribution: cells[7],
      checkedAt: cells[8],
      masterProof: cells[9],
      status: cells[10],
    });
  }
  return { rows, problems };
}
function collectComponentEvidence() {
  const dir = path.join(ROOT, COMPONENT_DIR_REL);
  const markerOwners = new Map();
  const coverRefs = [];
  const problems = [];
  for (const name of fs.readdirSync(dir).filter((entry) => entry.endsWith('.astro')).sort()) {
    const rel = `${COMPONENT_DIR_REL}/${name}`;
    const source = read(rel);
    for (const match of source.matchAll(EVIDENCE_RE)) {
      const evidenceId = match[1];
      if (markerOwners.has(evidenceId)) {
        problems.push(`duplicate production evidence marker ${evidenceId}: ${markerOwners.get(evidenceId)} + ${rel}`);
      } else {
        markerOwners.set(evidenceId, rel);
      }
    }
    for (const match of source.matchAll(COVER_RE)) coverRefs.push({ file: rel, src: match[0] });
  }
  return { markerOwners, coverRefs, problems };
}
function markdownReport(report) {
  const lines = [
    '# Baptist media coverage',
    '',
    `Status: **${report.status}**`,
    '',
    `- Series parts: ${report.summary.parts}`,
    `- Minimum local historical evidence target: ${report.summary.minimumPerArticle} per article`,
    `- Published + verified evidence nodes: ${report.summary.publishedEvidence}`,
    `- Minimum target total: ${report.summary.minimumTargetTotal}`,
    `- Deficit to minimum: ${report.summary.minimumDeficit}`,
    `- Decorative cover SVG references excluded from evidence count: ${report.summary.decorativeCoverRefs}`,
    '',
    '| Part | Published evidence | Minimum | Deficit | Evidence IDs |',
    '|---|---:|---:|---:|---|',
  ];
  for (const part of report.parts) {
    lines.push(`| ${part.n}. ${part.slug} | ${part.publishedEvidence} | ${part.minimumTarget} | ${part.deficit} | ${part.evidenceIds.length ? part.evidenceIds.map((id) => `\`${id}\``).join(', ') : '—'} |`);
  }
  if (report.integrityProblems.length) {
    lines.push('', '## Integrity problems', '');
    for (const item of report.integrityProblems) lines.push(`- ${item}`);
  }
  lines.push('', '> Decorative series covers are navigation/editorial artwork and do not satisfy the historical-media target. Only ledger-backed `PUBLISHED / VERIFIED` nodes with a production `data-baptist-master-evidence` marker count.', '');
  return lines.join('\n');
}

const strict = hasFlag('--strict');
const outJson = argValue('--out-json');
const outMd = argValue('--out-md');
const roadmap = readJson(ROADMAP_REL);
const minimumPerArticle = Number(roadmap.globalTargets?.minimumLocalImagesPerArticle ?? 0);
const parts = Array.isArray(roadmap.parts) ? roadmap.parts : [];
const { rows: ledgerRows, problems: ledgerProblems } = parseLedgerRows(read(LEDGER_REL));
const { markerOwners, coverRefs, problems: markerProblems } = collectComponentEvidence();
const integrityProblems = [...ledgerProblems, ...markerProblems];
const verifiedByArticle = new Map();

for (const [evidenceId, ownerFile] of markerOwners) {
  const row = ledgerRows.get(evidenceId);
  if (!row) {
    integrityProblems.push(`${ownerFile}: evidence marker ${evidenceId} has no ledger row`);
    continue;
  }
  if (!/PUBLISHED/i.test(row.status) || !/VERIFIED/i.test(row.status)) {
    integrityProblems.push(`${evidenceId}: production marker requires PUBLISHED / VERIFIED ledger status`);
    continue;
  }
  if (!row.article) {
    integrityProblems.push(`${evidenceId}: ledger article slug is empty`);
    continue;
  }
  if (!verifiedByArticle.has(row.article)) verifiedByArticle.set(row.article, []);
  verifiedByArticle.get(row.article).push(evidenceId);
}

for (const [evidenceId, row] of ledgerRows) {
  if (/PUBLISHED/i.test(row.status) && /VERIFIED/i.test(row.status) && !markerOwners.has(evidenceId)) {
    integrityProblems.push(`${evidenceId}: ledger says PUBLISHED / VERIFIED but no production evidence marker exists`);
  }
}

const partReports = parts.map((part) => {
  const evidenceIds = [...(verifiedByArticle.get(part.slug) || [])].sort();
  return {
    n: part.n,
    slug: part.slug,
    title: part.title,
    priority: part.priority,
    publishedEvidence: evidenceIds.length,
    minimumTarget: minimumPerArticle,
    preferredTarget: Number(roadmap.globalTargets?.preferredLocalImagesPerArticle ?? minimumPerArticle),
    deficit: Math.max(0, minimumPerArticle - evidenceIds.length),
    evidenceIds,
    mediaSlots: Array.isArray(part.mediaSlots) ? part.mediaSlots : [],
  };
});
const publishedEvidence = partReports.reduce((sum, part) => sum + part.publishedEvidence, 0);
const minimumTargetTotal = parts.length * minimumPerArticle;
const minimumDeficit = partReports.reduce((sum, part) => sum + part.deficit, 0);
const status = integrityProblems.length ? 'INVALID' : minimumDeficit ? 'NOT_READY' : 'READY';
const report = {
  schemaVersion: 1,
  status,
  generatedFrom: { roadmap: ROADMAP_REL, ledger: LEDGER_REL, components: COMPONENT_DIR_REL },
  summary: {
    parts: parts.length,
    minimumPerArticle,
    preferredPerArticle: Number(roadmap.globalTargets?.preferredLocalImagesPerArticle ?? minimumPerArticle),
    publishedEvidence,
    minimumTargetTotal,
    minimumDeficit,
    decorativeCoverRefs: coverRefs.length,
  },
  parts: partReports,
  integrityProblems,
};

if (outJson) writeJson(outJson, report);
if (outMd) writeText(outMd, markdownReport(report));

console.log(`BAPTISTY_MEDIA_COVERAGE ${status}; published=${publishedEvidence}/${minimumTargetTotal}; deficit=${minimumDeficit}; coversExcluded=${coverRefs.length}`);
for (const part of partReports) {
  console.log(`${part.slug}: evidence=${part.publishedEvidence}; minimum=${part.minimumTarget}; deficit=${part.deficit}`);
}
for (const problem of integrityProblems) console.error(`❌ ${problem}`);

if (integrityProblems.length) process.exit(1);
if (strict && minimumDeficit > 0) process.exit(1);
