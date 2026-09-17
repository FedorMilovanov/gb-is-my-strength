#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'data', 'genealogy', 'v2', 'publishable');
const OUT = path.join(ROOT, 'reports', 'genealogy-v2-relation-review');

const readText = file => fs.readFileSync(file, 'utf8');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const compareText = (a, b) => {
  const left = String(a ?? '');
  const right = String(b ?? '');
  return left < right ? -1 : left > right ? 1 : 0;
};
const relationKey = relation =>
  `${relation.kind}:${relation.from}->${relation.to}:${relation.role ?? ''}`;

const personsText = readText(path.join(PUB, 'persons.json'));
const relationsText = readText(path.join(PUB, 'relations.json'));
const textualText = readText(path.join(PUB, 'textual-assertions.json'));
const metaText = readText(path.join(PUB, 'meta.json'));

const persons = JSON.parse(personsText);
const relations = JSON.parse(relationsText);
const textual = JSON.parse(textualText);
const meta = JSON.parse(metaText);

const byId = new Map(persons.map(person => [person.id, person]));
const textualByRelation = new Map();
for (const assertion of textual.assertions ?? []) {
  const key = assertion.relationCrosswalk?.relationKey;
  if (!key) continue;
  textualByRelation.set(key, [...(textualByRelation.get(key) ?? []), assertion]);
}

function tierFor(relation, textualCount) {
  if (textualCount > 0) return 'A_GOSPEL_TEXTUAL_CONTEXT';
  if (relation.authority === 'curated-v1-explicit-field') return 'B_CURATED_EXPLICIT_PARENT';
  if (relation.authority === 'curated-v1-children-index') return 'C_CHILD_INDEX_EVIDENCE';
  if (relation.authority === 'curated-v1-reciprocal-spouse') return 'D_RECIPROCAL_SPOUSE';
  throw new Error(`Unexpected pending relation authority: ${relation.authority}`);
}

const pending = relations.filter(relation =>
  relation.evidence?.refsStatus === 'relation-level-review-pending');
const expectedPending = meta.counts?.relationEvidencePending;
assert(Number.isInteger(expectedPending), 'meta.counts.relationEvidencePending must be an integer');
assert(pending.length === expectedPending,
  `Relation review queue drift: relations=${pending.length}, meta=${expectedPending}`);

const rows = pending.map(relation => {
  const key = relationKey(relation);
  const from = byId.get(relation.from);
  const to = byId.get(relation.to);
  assert(from && to, `Pending relation escaped publishable person set: ${key}`);
  assert(relation.evidence?.directScripture === null,
    `Pending relation must keep directScripture=null: ${key}`);
  assert(Array.isArray(relation.evidence?.refs) && relation.evidence.refs.length === 0,
    `Pending relation must not contain synthesized refs: ${key}`);

  const assertions = textualByRelation.get(key) ?? [];
  const riskFlags = [];
  if (relation.authority === 'curated-v1-children-index') riskFlags.push('DERIVED_FROM_CHILDREN_INDEX');
  if (relation.kind === 'spouse') riskFlags.push('SPOUSE_REQUIRES_RELATION_LEVEL_REF');
  if (assertions.length === 0) riskFlags.push('NO_GOSPEL_TEXTUAL_CONTEXT');
  if (assertions.length > 0) riskFlags.push('TEXTUAL_ADJACENCY_IS_NOT_RELATION_PROOF');

  return {
    tier: tierFor(relation, assertions.length),
    reviewState: 'pending',
    autoApprove: false,
    relationKey: key,
    kind: relation.kind,
    role: relation.role ?? null,
    authority: relation.authority,
    fromId: relation.from,
    fromV1Id: from.v1Id,
    fromName: from.names?.ru ?? null,
    fromPersonRef: from.ref ?? null,
    toId: relation.to,
    toV1Id: to.v1Id,
    toName: to.names?.ru ?? null,
    toPersonRef: to.ref ?? null,
    directScripture: relation.evidence.directScripture,
    refsStatus: relation.evidence.refsStatus,
    textualAssertionCount: assertions.length,
    textualAssertions: assertions.map(assertion => ({
      id: assertion.id,
      sequenceId: assertion.sequenceId,
      fromRef: assertion.source?.fromRef ?? null,
      toRef: assertion.source?.toRef ?? null,
    })),
    riskFlags,
  };
});

const tierOrder = new Map([
  ['A_GOSPEL_TEXTUAL_CONTEXT', 0],
  ['B_CURATED_EXPLICIT_PARENT', 1],
  ['C_CHILD_INDEX_EVIDENCE', 2],
  ['D_RECIPROCAL_SPOUSE', 3],
]);
rows.sort((a, b) =>
  (tierOrder.get(a.tier) - tierOrder.get(b.tier)) ||
  compareText(a.fromName, b.fromName) ||
  compareText(a.toName, b.toName) ||
  compareText(a.relationKey, b.relationKey));

const byTier = {};
const byAuthority = {};
const byKind = {};
const byRisk = {};
for (const row of rows) {
  byTier[row.tier] = (byTier[row.tier] ?? 0) + 1;
  byAuthority[row.authority] = (byAuthority[row.authority] ?? 0) + 1;
  byKind[row.kind] = (byKind[row.kind] ?? 0) + 1;
  for (const flag of row.riskFlags) byRisk[flag] = (byRisk[flag] ?? 0) + 1;
}

assert(rows.every(row =>
  row.reviewState === 'pending' &&
  row.autoApprove === false &&
  row.directScripture === null &&
  row.refsStatus === 'relation-level-review-pending'),
'Relation triage must never approve or upgrade evidence');

const withTextualContext = rows.filter(row => row.textualAssertionCount > 0).length;
const withoutTextualContext = rows.length - withTextualContext;
assert(withTextualContext + withoutTextualContext === rows.length,
  'Pending textual-context split must cover the entire relation review queue');

const summary = {
  schemaVersion: 1,
  status: 'editorial-review-only',
  policy: {
    changesPublicationState: false,
    changesRelations: false,
    changesEvidence: false,
    autoApproves: false,
    textualAdjacencyIsRelationProof: false,
    purpose: 'deterministic prioritization of pending publishable relation-level evidence review',
  },
  inputs: {
    personsSha256: sha256(personsText),
    relationsSha256: sha256(relationsText),
    textualAssertionsSha256: sha256(textualText),
    metaSha256: sha256(metaText),
  },
  counts: {
    total: rows.length,
    withTextualContext,
    withoutTextualContext,
    byTier,
    byAuthority,
    byKind,
    byRisk,
  },
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'queue.json'),
  JSON.stringify({ summary, rows }, null, 2) + '\n');

function csv(value) {
  const text = value == null ? '' : Array.isArray(value)
    ? value.map(item => typeof item === 'string' ? item : JSON.stringify(item)).join('|')
    : String(value);
  return /[",\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
const headers = [
  'tier','reviewState','autoApprove','relationKey','kind','role','authority',
  'fromId','fromV1Id','fromName','fromPersonRef',
  'toId','toV1Id','toName','toPersonRef',
  'directScripture','refsStatus','textualAssertionCount','textualAssertions','riskFlags',
];
fs.writeFileSync(path.join(OUT, 'queue.csv'), [
  headers.join(','),
  ...rows.map(row => headers.map(header => csv(row[header])).join(',')),
].join('\n') + '\n');

const md = [
  '# Genealogy v2 — relation evidence editorial review queue',
  '',
  '> Read-only triage. Gospel textual adjacency is context for review, not automatic proof of a family relation.',
  '',
  `- Pending relation-level review: **${summary.counts.total}**`,
  `- With Gospel textual context: **${withTextualContext}**`,
  `- Without Gospel textual context: **${withoutTextualContext}**`,
  `- Tiers: \`${JSON.stringify(byTier)}\``,
  `- Authorities: \`${JSON.stringify(byAuthority)}\``,
  '',
  '## Review order',
  '',
  '- A: Gospel genealogy places the same certified identities adjacently. Review the actual wording before adding any relation-level refs.',
  '- B: Explicit curated father/mother field, but no Gospel textual adjacency. Verify relation against its controlling Scripture passage.',
  '- C: Relation came only from the curated children index. Confirm role/direction before qualification.',
  '- D: Reciprocal spouse assertion. Verify the marital relation against a direct source.',
  '',
  '## Safety rule',
  '',
  '- Every row remains `directScripture=null` and `relation-level-review-pending` until explicit editorial review.',
  '- This report never writes to publishable data and never auto-approves a relation.',
  '',
].join('\n');
fs.writeFileSync(path.join(OUT, 'summary.md'), md);

console.log(JSON.stringify(summary, null, 2));
