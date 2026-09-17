#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PATHS, SOURCES } from './genealogy-build/config.mjs';
import { SynodalText } from './genealogy-build/lib/refs.mjs';
import {
  capitalizedTokens,
  normalizeRuCandidate,
  similarity,
  translitEnRu,
} from './genealogy-build/lib/ru-extract.mjs';

const ROOT = PATHS.repoRoot;
const OUT = path.join(ROOT, 'reports', 'genealogy-editorial-proof');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sha256 = text => createHash('sha256').update(text).digest('hex');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const personsPath = path.join(ROOT, 'data', 'genealogy', 'v2', 'persons.json');
const relationsPath = path.join(ROOT, 'data', 'genealogy', 'v2', 'publishable', 'relations.json');
const assertionsPath = path.join(ROOT, 'data', 'genealogy', 'v2', 'publishable', 'textual-assertions.json');
const gospelPath = path.join(ROOT, 'data', 'genealogy', 'gospel-sequences.json');
const synodalPath = path.join(PATHS.cache, SOURCES.synodal.file);

for (const file of [personsPath, relationsPath, assertionsPath, gospelPath, synodalPath]) {
  assert(fs.existsSync(file), `Missing required editorial proof input: ${file}`);
}

const persons = readJson(personsPath);
const relations = readJson(relationsPath);
const textual = readJson(assertionsPath);
const gospel = readJson(gospelPath);
const synodal = new SynodalText(readJson(synodalPath));

function lexemeKeys(person) {
  const keys = new Set();
  for (const form of person.names ?? []) {
    if (form.strong) keys.add(`${form.lang ?? ''}:strong:${form.strong}`);
    if (form.original) keys.add(`${form.lang ?? ''}:original:${form.original}`);
  }
  return [...keys].sort();
}

function localSynodalProof(person) {
  const ru = person.ru;
  if (!ru?.review || !ru.name || !ru.verseRef) return null;
  if (!['candidate', 'pattern'].includes(ru.source)) return null;

  const text = synodal.verse(ru.verseRef);
  if (!text) return null;
  const tokens = capitalizedTokens(text).map(item => item.token);
  if (!tokens.length) return null;

  const evidenceForm = ru.verseForm ?? ru.name;
  if (!tokens.includes(evidenceForm)) return null;
  const normalized = normalizeRuCandidate(person.en, evidenceForm);
  if (normalized !== ru.name) return null;

  // A bare syntactic pattern can capture an inflected object (e.g. «родил X-а»).
  // Accept pattern results only when the extractor preserved a distinct source form;
  // candidate results may already be nominative and therefore need no verseForm.
  if (ru.source === 'pattern' && !ru.verseForm) return null;

  const approx = translitEnRu(person.en);
  const scored = tokens
    .map(token => ({ token, score: similarity(approx, token) }))
    .sort((a, b) => b.score - a.score || a.token.localeCompare(b.token, 'ru'));
  const target = scored.find(row => row.token === evidenceForm);
  if (!target || target.score < 0.72) return null;
  const competitor = scored.find(row => row.token !== evidenceForm);
  const margin = target.score - (competitor?.score ?? 0);
  if (margin < 0.08 && target.score < 0.95) return null;

  return {
    proof: ru.verseForm ? 'synodal-local-normalized' : 'synodal-local-exact',
    verseRef: ru.verseRef,
    verseForm: evidenceForm,
    canonical: ru.name,
    lexicalScore: Number(target.score.toFixed(4)),
    margin: Number(margin.toFixed(4)),
  };
}

const certifications = new Map();
const anchorReason = new Map();
for (const person of persons) {
  if (person.ru?.name && person.ru.review === false) {
    certifications.set(person.id, { proof: 'existing-reviewed', canonical: person.ru.name });
    anchorReason.set(person.id, person.ru.source ?? 'reviewed');
  }
}
for (const person of persons) {
  const proof = localSynodalProof(person);
  if (proof) certifications.set(person.id, proof);
}

// Propagate only through an exact original-language lexeme/Strong key whose
// already-certified anchors unanimously agree on one Russian canonical form.
let changed = true;
let passes = 0;
while (changed) {
  changed = false;
  passes += 1;
  const namesByLexeme = new Map();
  for (const person of persons) {
    const cert = certifications.get(person.id);
    if (!cert) continue;
    for (const key of lexemeKeys(person)) {
      if (!namesByLexeme.has(key)) namesByLexeme.set(key, new Set());
      namesByLexeme.get(key).add(cert.canonical);
    }
  }

  for (const person of persons) {
    if (certifications.has(person.id) || !person.ru?.review || !person.ru?.name) continue;
    const unanimous = new Set();
    const supportingKeys = [];
    for (const key of lexemeKeys(person)) {
      const names = namesByLexeme.get(key);
      if (names?.size === 1) {
        unanimous.add([...names][0]);
        supportingKeys.push(key);
      }
    }
    if (unanimous.size !== 1) continue;
    const canonical = [...unanimous][0];
    if (canonical !== person.ru.name) continue;
    certifications.set(person.id, {
      proof: 'original-lexeme-propagation',
      canonical,
      supportingKeys: supportingKeys.sort(),
    });
    changed = true;
  }
  assert(passes < 20, 'Name proof propagation failed to converge');
}

// Detect strong/original lexeme conflicts and safe correction candidates, but do
// not silently fix them in this report.
const certifiedNamesByLexeme = new Map();
for (const person of persons) {
  const cert = certifications.get(person.id);
  if (!cert) continue;
  for (const key of lexemeKeys(person)) {
    if (!certifiedNamesByLexeme.has(key)) certifiedNamesByLexeme.set(key, new Set());
    certifiedNamesByLexeme.get(key).add(cert.canonical);
  }
}

const corrections = [];
for (const person of persons) {
  if (!person.ru?.review || !person.ru?.name || certifications.has(person.id)) continue;
  const proposals = new Map();
  for (const key of lexemeKeys(person)) {
    const names = certifiedNamesByLexeme.get(key);
    if (names?.size !== 1) continue;
    const name = [...names][0];
    if (!proposals.has(name)) proposals.set(name, []);
    proposals.get(name).push(key);
  }
  if (proposals.size === 1) {
    const [recommendedName, keys] = [...proposals.entries()][0];
    if (recommendedName !== person.ru.name) {
      corrections.push({
        personId: person.id,
        en: person.en,
        currentName: person.ru.name,
        recommendedName,
        source: person.ru.source,
        keys: keys.sort(),
      });
    }
  }
}

const pendingBefore = persons.filter(person => person.ru?.review === true).length;
const newlyCertifiable = persons.filter(person => person.ru?.review === true && certifications.has(person.id));
const residualNames = persons.filter(person => person.ru?.review === true && !certifications.has(person.id));
const byProof = {};
const bySource = {};
for (const person of newlyCertifiable) {
  const proof = certifications.get(person.id).proof;
  byProof[proof] = (byProof[proof] ?? 0) + 1;
  bySource[person.ru.source] = (bySource[person.ru.source] ?? 0) + 1;
}
const residualBySource = {};
for (const person of residualNames) residualBySource[person.ru?.source ?? 'none'] = (residualBySource[person.ru?.source ?? 'none'] ?? 0) + 1;

const relationByKey = new Map(relations.map(relation => [
  `${relation.kind}:${relation.from}->${relation.to}:${relation.role ?? ''}`,
  relation,
]));
const pendingRelations = relations.filter(relation => relation.evidence?.refsStatus === 'relation-level-review-pending');
const matthewEntries = gospel.sequences.find(sequence => sequence.id === 'matthew')?.entries ?? [];
const matthewLastPerson = matthewEntries.at(-1)?.personId;
const relationProofs = [];

for (const assertion of textual.assertions ?? []) {
  if (assertion.sequenceId !== 'matthew') continue;
  const crosswalk = assertion.relationCrosswalk;
  if (crosswalk?.status !== 'matched-publishable-relation') continue;
  const relation = relationByKey.get(crosswalk.relationKey);
  if (!relation || relation.evidence?.refsStatus !== 'relation-level-review-pending') continue;
  if (relation.kind !== 'parent' || relation.role !== 'father') continue;
  // Matthew 1:16 explicitly avoids saying that Joseph begat Jesus; the source
  // sequence notes preserve this exception and that edge is handled separately.
  if (relation.to === matthewLastPerson) continue;
  relationProofs.push({
    relationKey: crosswalk.relationKey,
    from: relation.from,
    to: relation.to,
    proof: 'matthew-explicit-begat-sequence',
    refs: [...new Set([assertion.source?.fromRef, assertion.source?.toRef].filter(Boolean))],
    assertionId: assertion.id,
  });
}

const provedRelationKeys = new Set(relationProofs.map(row => row.relationKey));
const residualRelations = pendingRelations.filter(relation => !provedRelationKeys.has(
  `${relation.kind}:${relation.from}->${relation.to}:${relation.role ?? ''}`,
));

const summary = {
  schemaVersion: 1,
  status: 'read-only-proof-report',
  inputs: {
    personsSha256: sha256(fs.readFileSync(personsPath, 'utf8')),
    relationsSha256: sha256(fs.readFileSync(relationsPath, 'utf8')),
    textualAssertionsSha256: sha256(fs.readFileSync(assertionsPath, 'utf8')),
    gospelSequencesSha256: sha256(fs.readFileSync(gospelPath, 'utf8')),
    synodalPinnedSha256: SOURCES.synodal.sha256,
  },
  names: {
    totalPersons: persons.length,
    pendingBefore,
    newlyCertifiable: newlyCertifiable.length,
    residual: residualNames.length,
    correctionsSuggested: corrections.length,
    propagationPasses: passes,
    byProof,
    bySource,
    residualBySource,
  },
  relations: {
    pendingBefore: pendingRelations.length,
    newlyCertifiable: relationProofs.length,
    residual: residualRelations.length,
    proof: 'matthew-explicit-begat-sequence',
  },
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'name-certifications.json'), JSON.stringify(
  newlyCertifiable.map(person => ({
    personId: person.id,
    en: person.en,
    currentName: person.ru.name,
    source: person.ru.source,
    proof: certifications.get(person.id),
  })), null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'name-corrections.json'), JSON.stringify(corrections, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'name-residual.json'), JSON.stringify(
  residualNames.map(person => ({
    personId: person.id,
    en: person.en,
    ru: person.ru,
    firstRef: person.firstRef,
    lexemeKeys: lexemeKeys(person),
  })), null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'relation-certifications.json'), JSON.stringify(relationProofs, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'relation-residual.json'), JSON.stringify(residualRelations, null, 2) + '\n');

console.log(JSON.stringify(summary, null, 2));
