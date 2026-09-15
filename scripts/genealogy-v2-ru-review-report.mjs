#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V2 = path.join(ROOT, 'data', 'genealogy', 'v2');
const OUT = path.join(ROOT, 'reports', 'genealogy-v2-ru-review');

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const personsText = fs.readFileSync(path.join(V2, 'persons.json'), 'utf8');
const metaText = fs.readFileSync(path.join(V2, 'meta.json'), 'utf8');
const persons = JSON.parse(personsText);
const meta = JSON.parse(metaText);

const tierOrder = [
  'A_PATTERN_STRONG',
  'B_CANDIDATE_VERY_HIGH',
  'C_CANDIDATE_HIGH',
  'D_CANDIDATE_MEDIUM',
  'E_CANDIDATE_LOW',
  'F_TRANSLIT_MANUAL',
];

function tierFor(person) {
  const source = person.ru?.source;
  const confidence = Number(person.ru?.confidence ?? 0);
  if (source === 'pattern') return 'A_PATTERN_STRONG';
  if (source === 'candidate' && confidence >= 0.95) return 'B_CANDIDATE_VERY_HIGH';
  if (source === 'candidate' && confidence >= 0.9) return 'C_CANDIDATE_HIGH';
  if (source === 'candidate' && confidence >= 0.8) return 'D_CANDIDATE_MEDIUM';
  if (source === 'candidate') return 'E_CANDIDATE_LOW';
  if (source === 'translit') return 'F_TRANSLIT_MANUAL';
  throw new Error(`Unexpected review source: ${source} for ${person.key}`);
}

const review = persons.filter(person => person.ru?.review === true);
const expectedReview = meta.publicationEvidence?.ruReviewQueue;
assert(Number.isInteger(expectedReview), 'meta.publicationEvidence.ruReviewQueue must be an integer');
assert(review.length === expectedReview,
  `Review queue drift: persons=${review.length}, meta=${expectedReview}`);

const labelFrequency = new Map();
for (const person of review) {
  const label = person.ru?.name ?? '';
  labelFrequency.set(label, (labelFrequency.get(label) ?? 0) + 1);
}

const rows = review.map(person => {
  const firstRef = person.firstRef?.osis ?? person.firstRef?.ru ?? null;
  const verseRef = person.ru?.verseRef ?? null;
  const confidence = Number(person.ru?.confidence ?? 0);
  const riskFlags = [];

  if (person.ru.source === 'translit') riskFlags.push('TRANSLIT_NO_TEXTUAL_EVIDENCE');
  if (!verseRef) riskFlags.push('NO_VERSE_EVIDENCE');
  if (person.ru.verseForm) riskFlags.push('NORMALIZED_FROM_VERSE_FORM');
  if ((labelFrequency.get(person.ru.name) ?? 0) > 1) riskFlags.push('DUPLICATE_RU_LABEL');
  if (confidence < 0.8) riskFlags.push('LOW_CONFIDENCE');
  if (verseRef && firstRef && verseRef !== firstRef) riskFlags.push('EVIDENCE_REF_DIFFERS_FROM_FIRST_REF');

  return {
    tier: tierFor(person),
    reviewState: 'pending',
    autoApprove: false,
    id: person.id,
    key: person.key,
    en: person.en,
    ruName: person.ru.name,
    source: person.ru.source,
    confidence,
    firstRef,
    verseRef,
    verseForm: person.ru.verseForm ?? null,
    duplicateRuLabelCount: labelFrequency.get(person.ru.name) ?? 1,
    riskFlags,
  };
});

const tierIndex = new Map(tierOrder.map((tier, index) => [tier, index]));
rows.sort((a, b) =>
  (tierIndex.get(a.tier) - tierIndex.get(b.tier)) ||
  b.confidence - a.confidence ||
  String(a.firstRef ?? '').localeCompare(String(b.firstRef ?? '')) ||
  a.key.localeCompare(b.key)
);

const bySource = {};
const byTier = {};
const byRisk = {};
for (const row of rows) {
  bySource[row.source] = (bySource[row.source] ?? 0) + 1;
  byTier[row.tier] = (byTier[row.tier] ?? 0) + 1;
  for (const flag of row.riskFlags) byRisk[flag] = (byRisk[flag] ?? 0) + 1;
}

assert((bySource.pattern ?? 0) + (bySource.candidate ?? 0) + (bySource.translit ?? 0) === rows.length,
  'Unexpected review sources entered queue');
assert(rows.every(row => row.autoApprove === false && row.reviewState === 'pending'),
  'Review report must never auto-approve');

const summary = {
  schemaVersion: 1,
  status: 'editorial-review-only',
  policy: {
    changesPublicationState: false,
    changesOverrides: false,
    autoApproves: false,
    purpose: 'deterministic prioritization of the existing fail-closed RU review queue',
  },
  inputs: {
    personsSha256: sha256(personsText),
    metaSha256: sha256(metaText),
  },
  counts: {
    total: rows.length,
    bySource,
    byTier,
    byRisk,
    withVerseEvidence: rows.filter(row => row.verseRef).length,
    withNormalizedVerseForm: rows.filter(row => row.verseForm).length,
    duplicateLabelEntries: rows.filter(row => row.duplicateRuLabelCount > 1).length,
  },
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'queue.json'), JSON.stringify({ summary, rows }, null, 2) + '\n');

function csv(value) {
  const text = value == null ? '' : Array.isArray(value) ? value.join('|') : String(value);
  return /[",\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
const headers = [
  'tier','reviewState','autoApprove','id','key','en','ruName','source','confidence',
  'firstRef','verseRef','verseForm','duplicateRuLabelCount','riskFlags',
];
const csvRows = [
  headers.join(','),
  ...rows.map(row => headers.map(header => csv(row[header])).join(',')),
];
fs.writeFileSync(path.join(OUT, 'queue.csv'), csvRows.join('\n') + '\n');

const md = [
  '# Genealogy v2 — RU editorial review queue',
  '',
  '> Read-only triage. This report does not approve names, edit ru-overrides, or change publication state.',
  '',
  `- Total pending review: **${summary.counts.total}**`,
  `- Source split: \`${JSON.stringify(bySource)}\``,
  `- Tiers: \`${JSON.stringify(byTier)}\``,
  `- With verse evidence: **${summary.counts.withVerseEvidence}**`,
  `- Pure/no-verse evidence: **${byRisk.NO_VERSE_EVIDENCE ?? 0}**`,
  `- Normalized from verse form: **${summary.counts.withNormalizedVerseForm}**`,
  '',
  '## Review order',
  '',
  '- A/B: strongest textual evidence; still requires explicit editorial approval.',
  '- C/D: textual evidence with lower lexical certainty.',
  '- E: low-confidence candidate; inspect verse and canonical nominative carefully.',
  '- F: transliteration fallback; manual verification required before any approval.',
  '',
  '## Risk flags',
  '',
  ...Object.entries(byRisk).sort().map(([flag, count]) => `- \`${flag}\`: ${count}`),
  '',
].join('\n');
fs.writeFileSync(path.join(OUT, 'summary.md'), md);

console.log(JSON.stringify(summary, null, 2));
