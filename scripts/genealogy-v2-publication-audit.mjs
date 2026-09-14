#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PIPELINE_VERSION } from './genealogy-build/config.mjs';
import { emittedPersonsAsTipnrMap, matchSkeleton } from './genealogy-build/lib/skeleton-matcher.mjs';
import { buildMatthewLuke } from './genealogy-build/lib/layout-l1-lineages.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V1 = path.join(ROOT, 'data', 'genealogy', 'genealogy.json');
const V2 = path.join(ROOT, 'data', 'genealogy', 'v2');
const REPORT_DIR = path.join(ROOT, 'reports');
const STRICT_PUBLISH = process.argv.includes('--strict-publish');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const v1 = readJson(V1);
const persons = readJson(path.join(V2, 'persons.json'));
const edges = readJson(path.join(V2, 'edges.json'));
const groups = readJson(path.join(V2, 'groups.json'));
const views = readJson(path.join(V2, 'views.json'));
const tableOfNations = readJson(path.join(V2, 'table-of-nations.json'));
const meta = readJson(path.join(V2, 'meta.json'));
const spine = readJson(path.join(V2, 'spine.json'));
const edgeAnnotations = readJson(path.join(V2, 'edge-annotations.json'));
const committedMatthewLukeLayout = readJson(path.join(V2, 'build', 'layout-l1-matthew-luke.json'));
const committedMatthewLukeSvg = fs.readFileSync(path.join(V2, 'build', 'genealogy-l1-matthew-luke.svg'), 'utf8');
const committedMatthewLukeDarkSvg = fs.readFileSync(path.join(V2, 'build', 'genealogy-l1-matthew-luke-dark.svg'), 'utf8');
const validationText = fs.readFileSync(path.join(V2, 'VALIDATION.md'), 'utf8');

const v1ById = new Map(v1.persons.map(person => [person.id, person]));
const skeletonMappings = persons.filter(person => person.skeleton?.v1Id);
const genderMismatches = skeletonMappings.flatMap(person => {
  const seed = v1ById.get(person.skeleton.v1Id);
  if (!seed || !['m', 'f'].includes(seed.gender) || !['m', 'f'].includes(person.gender) || seed.gender === person.gender) return [];
  return [{
    v1Id: seed.id,
    v1Name: seed.name?.ru ?? null,
    expectedGender: seed.gender,
    v2Id: person.id,
    v2Key: person.key,
    v2Name: person.en,
    actualGender: person.gender,
    firstRef: person.firstRef?.osis ?? null,
  }];
});

const pipelineCurrent = meta.pipelineVersion === PIPELINE_VERSION;
const publicationEvidence = meta.publicationEvidence ?? null;
const publicationEvidenceIssues = [];
const reviewQueueFromPersons = persons.filter(person => person.ru?.review === true).length;

// Legacy committed v2 artifacts predate machine-readable publicationEvidence.
// They remain useful diagnostics only while PIPELINE_OUTPUT_STALE already blocks publish.
const heuristicSection = (validationText.split('## v1-скелет: эвристические сопоставления')[1] ?? '')
  .split('\n> Статус')[0];
const legacyHeuristicMappings = heuristicSection.split('\n')
  .filter(line => line.startsWith('- ') && line.includes('←'))
  .map(line => {
    const match = /^-\s+(.+?)\s+←\s+(.+)$/u.exec(line);
    if (!match) return null;
    const evidence = match[2].trim();
    return {
      v1Id: match[1].trim(),
      evidence,
      kind: evidence.startsWith('fuzzy:') ? 'fuzzy' : evidence.startsWith('disamb:') ? 'disambiguation' : 'other',
      authority: 'legacy-validation-markdown',
    };
  })
  .filter(Boolean);
const legacyUnresolvedMatch = /нерезолв:\s*(\d+)/u.exec(validationText);
const legacyUnresolvedRefs = legacyUnresolvedMatch ? Number(legacyUnresolvedMatch[1]) : null;

if (pipelineCurrent) {
  if (!publicationEvidence || typeof publicationEvidence !== 'object') {
    publicationEvidenceIssues.push('missing-publicationEvidence');
  } else {
    if (publicationEvidence.schemaVersion !== 1) publicationEvidenceIssues.push('publicationEvidence-schema-version');
    if (!Number.isInteger(publicationEvidence.skeleton?.total)) publicationEvidenceIssues.push('missing-skeleton-total');
    if (!Number.isInteger(publicationEvidence.skeleton?.matched)) publicationEvidenceIssues.push('missing-skeleton-matched');
    if (!Array.isArray(publicationEvidence.skeleton?.decisions)) publicationEvidenceIssues.push('missing-skeleton-decisions');
    if (!Array.isArray(publicationEvidence.skeleton?.soft)) publicationEvidenceIssues.push('missing-skeleton-soft');
    if (!Array.isArray(publicationEvidence.skeleton?.unmatched)) publicationEvidenceIssues.push('missing-skeleton-unmatched');
    if (!Array.isArray(publicationEvidence.skeleton?.collisions)) publicationEvidenceIssues.push('missing-skeleton-collisions');
    if (Number.isInteger(publicationEvidence.skeleton?.total) &&
        publicationEvidence.skeleton.total !== v1.persons.length) {
      publicationEvidenceIssues.push('skeleton-total-drift');
    }
    if (Number.isInteger(publicationEvidence.skeleton?.matched) &&
        Array.isArray(publicationEvidence.skeleton?.decisions) &&
        publicationEvidence.skeleton.decisions.length !== publicationEvidence.skeleton.matched) {
      publicationEvidenceIssues.push('skeleton-decision-count-drift');
    }
    if (Number.isInteger(publicationEvidence.skeleton?.total) &&
        Number.isInteger(publicationEvidence.skeleton?.matched) &&
        Array.isArray(publicationEvidence.skeleton?.unmatched) &&
        publicationEvidence.skeleton.matched + publicationEvidence.skeleton.unmatched.length !== publicationEvidence.skeleton.total) {
      publicationEvidenceIssues.push('skeleton-partition-drift');
    }
    if (!Number.isInteger(publicationEvidence.relations?.unresolvedCount)) publicationEvidenceIssues.push('missing-relations-unresolvedCount');
    if (!Array.isArray(publicationEvidence.relations?.unresolved)) publicationEvidenceIssues.push('missing-relations-unresolved');
    if (!Number.isInteger(publicationEvidence.ruReviewQueue)) publicationEvidenceIssues.push('missing-ruReviewQueue');
    if (Array.isArray(publicationEvidence.relations?.unresolved) &&
        publicationEvidence.relations.unresolved.length !== publicationEvidence.relations.unresolvedCount) {
      publicationEvidenceIssues.push('unresolved-count-drift');
    }
    if (Number.isInteger(publicationEvidence.ruReviewQueue) &&
        publicationEvidence.ruReviewQueue !== reviewQueueFromPersons) {
      publicationEvidenceIssues.push('ru-review-count-drift');
    }
  }
}

const structuredSoft = publicationEvidence?.skeleton?.soft;
const heuristicMappings = pipelineCurrent && Array.isArray(structuredSoft)
  ? structuredSoft.map(item => {
      const evidence = String(item.via ?? '');
      return {
        v1Id: item.id ?? null,
        evidence,
        kind: evidence.startsWith('fuzzy:') ? 'fuzzy'
          : evidence.startsWith('disamb:') || evidence.startsWith('ru-name-similarity:') ? 'disambiguation'
          : 'other',
        authority: 'meta.publicationEvidence',
      };
    })
  : legacyHeuristicMappings;
const fuzzyMappings = heuristicMappings.filter(mapping => mapping.kind === 'fuzzy');
const unresolvedRefs = pipelineCurrent && Number.isInteger(publicationEvidence?.relations?.unresolvedCount)
  ? publicationEvidence.relations.unresolvedCount
  : legacyUnresolvedRefs;
const reviewQueue = pipelineCurrent && Number.isInteger(publicationEvidence?.ruReviewQueue)
  ? publicationEvidence.ruReviewQueue
  : reviewQueueFromPersons;
const prospectiveMapping = matchSkeleton(v1.persons, emittedPersonsAsTipnrMap(persons));
const prospectiveUnexpectedUnmatched = prospectiveMapping.unmatched.filter(item => item.candidates !== 'no-tipnr-counterpart');
const prospectiveMethodCounts = Object.fromEntries(
  Object.entries(prospectiveMapping.decisions.reduce((acc, decision) => {
    acc[decision.method] = (acc[decision.method] ?? 0) + 1;
    return acc;
  }, {})).sort(([a], [b]) => a.localeCompare(b)),
);

const curatedRulePolicy = {
  'matthew-1': ['explicitSequence'],
  'luke-3': ['explicitSequence'],
};
const nationsViewIssues = [];
const nationsView = (views.views ?? []).find(view => view.id === 'nations');
if (!nationsView || nationsView.kind !== 'archetype' || nationsView.target !== 'nations') {
  nationsViewIssues.push('views.nations-routing');
}
const nationsCounts = tableOfNations._meta?.counts;
if (nationsCounts?.nationsProper !== 70) nationsViewIssues.push('table-of-nations.count');
if ((nationsCounts?.japheth ?? 0) + (nationsCounts?.ham ?? 0) + (nationsCounts?.shem ?? 0) !== nationsCounts?.nationsProper) {
  nationsViewIssues.push('table-of-nations.branch-sum');
}
if (!/phase2-verified/u.test(tableOfNations._meta?.status ?? '')) nationsViewIssues.push('table-of-nations.status');

const genericCuratedViews = [];
for (const cluster of groups.clusters ?? []) {
  const allowed = curatedRulePolicy[cluster.id];
  if (!allowed) continue;
  const type = cluster.rule?.type ?? 'missing';
  if (!allowed.includes(type)) {
    genericCuratedViews.push({
      id: cluster.id,
      title: cluster.titleRu,
      ruleType: type,
      allowedRuleTypes: allowed,
      count: cluster.count,
    });
  }
}


const spineProvenanceIssues = [];
const expectedSpinePrefix = ['jesus--isa-7-14', 'mary--mat-1-16', 'heli--luk-3-23'];
if (expectedSpinePrefix.every((id, index) => spine.chain?.[index]?.id === id)) {
  const model = spine.model ?? {};
  if (model.kind !== 'interpretive-projection') spineProvenanceIssues.push('spine.kind');
  if (model.assertion !== 'editorial-harmonization') spineProvenanceIssues.push('spine.assertion');
  if (model.directScripture !== false) spineProvenanceIssues.push('spine.directScripture');
  if (model.editorialPosition !== 'preferred') spineProvenanceIssues.push('spine.editorialPosition');
  if (!Array.isArray(model.refs) || !model.refs.some(ref => /Лк 3:23/u.test(ref))) spineProvenanceIssues.push('spine.refs');
} else {
  spineProvenanceIssues.push('spine.prefix');
}

const requiredRelationAnnotations = [
  {
    from: 'joseph--mat-1-16', to: 'jesus--isa-7-14',
    assertion: 'explicit-qualified-textual', directScripture: true, editorialPosition: 'text',
    required: {
      biology: 'non-biological',
      textualRelation: 'as-supposed-son',
      legal: true,
      legalAssertion: 'source-derived',
    },
  },
  {
    from: 'heli--luk-3-23', to: 'mary--mat-1-16',
    assertion: 'editorial-harmonization', directScripture: false, editorialPosition: 'preferred',
    required: { biology: 'unknown' },
  },
];
const interpretationWordingIssues = (views.views ?? [])
  .filter(view => /кровн[^\n]*через Мари/u.test(view.descRu ?? ''))
  .map(view => ({ id: view.id, descRu: view.descRu }));

const matthewLukeLayout = buildMatthewLuke();
const matthewLukeLayoutIssues = [];
if (matthewLukeLayout.nodes.some(node => node.kind === 'lk' && node.name === 'Мария')) {
  matthewLukeLayoutIssues.push('luke-column-inserts-mary');
}
if (!matthewLukeLayout.nodes.some(node => node.kind === 'lk' && node.name === 'Иосиф' && node.ref === 'Лк 3:23')) {
  matthewLukeLayoutIssues.push('luke-column-missing-joseph-luke-3-23');
}
for (const name of ['Салафиил', 'Зоровавель']) {
  if (matthewLukeLayout.nodes.some(node => node.kind === 'shared' && node.name === name)) {
    matthewLukeLayoutIssues.push(`shared-by-name:${name}`);
  }
}
const layoutCopy = [matthewLukeLayout.subtitle, ...(matthewLukeLayout.notes ?? [])].join('\n');
if (/кровн[^\n]*через Мари/u.test(layoutCopy)) {
  matthewLukeLayoutIssues.push('layout-overstates-mary-harmonization');
}

const committedMatthewLukeArtifactIssues = [];
const semanticNode = node => ({
  name: node.name ?? null,
  ref: node.ref ?? null,
  kind: node.kind ?? null,
  row: node.row ?? null,
  disputed: Boolean(node.disputed),
  note: node.note ?? null,
  sub: node.sub ?? null,
});
if (JSON.stringify(committedMatthewLukeLayout.nodes.map(semanticNode)) !==
    JSON.stringify(matthewLukeLayout.nodes.map(semanticNode))) {
  committedMatthewLukeArtifactIssues.push('layout-json-semantic-drift');
}
if (committedMatthewLukeLayout.subtitle !== matthewLukeLayout.subtitle) {
  committedMatthewLukeArtifactIssues.push('layout-json-subtitle-drift');
}
if (JSON.stringify(committedMatthewLukeLayout.notes ?? []) !== JSON.stringify(matthewLukeLayout.notes ?? [])) {
  committedMatthewLukeArtifactIssues.push('layout-json-notes-drift');
}
for (const [name, svg] of [
  ['light', committedMatthewLukeSvg],
  ['dark', committedMatthewLukeDarkSvg],
]) {
  if (/Лука 3 · кровная/u.test(svg)) committedMatthewLukeArtifactIssues.push(`${name}-svg-overstates-luke`);
  if (/>Мария<\/text>/u.test(svg)) committedMatthewLukeArtifactIssues.push(`${name}-svg-inserts-mary`);
  if (/обе линии/u.test(svg)) committedMatthewLukeArtifactIssues.push(`${name}-svg-shares-occurrence-by-name`);
}

const relationProvenanceIssues = [];
for (const expected of requiredRelationAnnotations) {
  const annotation = (edgeAnnotations.annotations ?? []).find(item => item.from === expected.from && item.to === expected.to);
  if (!annotation) {
    relationProvenanceIssues.push({ edge: `${expected.from}→${expected.to}`, issue: 'missing-annotation' });
    continue;
  }
  const set = annotation.set ?? {};
  for (const field of ['assertion', 'confidence', 'directScripture', 'editorialPosition', 'refs']) {
    if (!(field in set)) relationProvenanceIssues.push({ edge: `${expected.from}→${expected.to}`, issue: `missing-${field}` });
  }
  if (set.assertion !== expected.assertion) relationProvenanceIssues.push({ edge: `${expected.from}→${expected.to}`, issue: 'assertion-mismatch' });
  if (set.directScripture !== expected.directScripture) relationProvenanceIssues.push({ edge: `${expected.from}→${expected.to}`, issue: 'directScripture-mismatch' });
  if (set.editorialPosition !== expected.editorialPosition) relationProvenanceIssues.push({ edge: `${expected.from}→${expected.to}`, issue: 'editorialPosition-mismatch' });
  for (const [field, value] of Object.entries(expected.required ?? {})) {
    if (set[field] !== value) {
      relationProvenanceIssues.push({ edge: `${expected.from}→${expected.to}`, issue: `${field}-mismatch` });
    }
  }

  const generatedEdge = edges.find(edge => edge.from === expected.from && edge.to === expected.to && edge.kind === (annotation.kind ?? 'parent'));
  if (!generatedEdge) {
    relationProvenanceIssues.push({ edge: `${expected.from}→${expected.to}`, issue: 'missing-generated-edge' });
  } else if (meta.pipelineVersion === PIPELINE_VERSION) {
    for (const field of ['assertion', 'confidence', 'directScripture', 'editorialPosition', ...Object.keys(expected.required ?? {})]) {
      if (generatedEdge[field] !== set[field]) {
        relationProvenanceIssues.push({ edge: `${expected.from}→${expected.to}`, issue: `generated-${field}-drift` });
      }
    }
    if (JSON.stringify(generatedEdge.refs ?? []) !== JSON.stringify(set.refs ?? [])) {
      relationProvenanceIssues.push({ edge: `${expected.from}→${expected.to}`, issue: 'generated-refs-drift' });
    }
  }
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(?:astro|tsx?|jsx?|mjs|cjs)$/u.test(entry.name)) out.push(full);
  }
  return out;
}
// Any import from src/ can reach production through an indirect helper/component.
// Scan the whole runtime source tree so draft v2 cannot bypass the guard by moving
// the import outside the genealogy component directory.
const runtimeRoots = [path.join(ROOT, 'src')];
const runtimeV2Refs = walkRuntimeRefs(runtimeRoots);

function walkRuntimeRefs(roots) {
  const refs = [];
  for (const root of roots) {
    for (const file of walk(root)) {
      const text = fs.readFileSync(file, 'utf8');
      if (/data\/genealogy\/v2|genealogy\/v2\//u.test(text)) {
        refs.push(path.relative(ROOT, file).replaceAll(path.sep, '/'));
      }
    }
  }
  return refs.sort();
}

const pipelineVersionMismatch = meta.pipelineVersion !== PIPELINE_VERSION;
const blockers = [];
if (pipelineVersionMismatch) blockers.push({
  code: 'PIPELINE_OUTPUT_STALE',
  expected: PIPELINE_VERSION,
  actual: meta.pipelineVersion ?? null,
});
if (publicationEvidenceIssues.length) blockers.push({
  code: 'PUBLICATION_EVIDENCE_INVALID',
  count: publicationEvidenceIssues.length,
});
if (/phase1-draft|НЕ подключать в рантайм/u.test(meta.status ?? '')) {
  blockers.push({ code: 'DATASET_STATUS_DRAFT', detail: meta.status ?? null });
} else if (!meta.status) {
  blockers.push({ code: 'DATASET_STATUS_MISSING', detail: null });
}
if (genderMismatches.length) blockers.push({ code: 'SKELETON_GENDER_MISMATCH', count: genderMismatches.length });
if (heuristicMappings.length) blockers.push({ code: 'UNAPPROVED_HEURISTIC_MAPPING', count: heuristicMappings.length });
if (fuzzyMappings.length) blockers.push({ code: 'UNAPPROVED_FUZZY_MAPPING', count: fuzzyMappings.length });
if (unresolvedRefs === null || unresolvedRefs > 0) blockers.push({ code: 'UNRESOLVED_RELATIONS', count: unresolvedRefs });
if (reviewQueue > 0) blockers.push({ code: 'RU_REVIEW_QUEUE', count: reviewQueue });
if (prospectiveMapping.soft.length) blockers.push({ code: 'PROSPECTIVE_SOFT_MAPPING', count: prospectiveMapping.soft.length });
if (prospectiveUnexpectedUnmatched.length) blockers.push({ code: 'PROSPECTIVE_UNEXPECTED_UNMATCHED', count: prospectiveUnexpectedUnmatched.length });
if (prospectiveMapping.collisions.length) blockers.push({ code: 'PROSPECTIVE_MAPPING_COLLISION', count: prospectiveMapping.collisions.length });
if (genericCuratedViews.length) blockers.push({ code: 'GENERIC_CURATED_VIEW_RULES', count: genericCuratedViews.length });
if (nationsViewIssues.length) blockers.push({ code: 'NATIONS_VIEW_NOT_CURATED', count: nationsViewIssues.length });
if (spineProvenanceIssues.length) blockers.push({ code: 'SPINE_PROVENANCE_INCOMPLETE', count: spineProvenanceIssues.length });
if (relationProvenanceIssues.length) blockers.push({ code: 'RELATION_PROVENANCE_INCOMPLETE', count: relationProvenanceIssues.length });
if (interpretationWordingIssues.length) blockers.push({ code: 'OVERSTATED_INTERPRETATION_WORDING', count: interpretationWordingIssues.length });
if (matthewLukeLayoutIssues.length) blockers.push({ code: 'MATTHEW_LUKE_LAYOUT_TRUTH_MODEL', count: matthewLukeLayoutIssues.length });
if (committedMatthewLukeArtifactIssues.length) blockers.push({
  code: 'MATTHEW_LUKE_COMMITTED_ARTIFACT_STALE',
  count: committedMatthewLukeArtifactIssues.length,
});

const runtimeViolation = runtimeV2Refs.length > 0 && blockers.length > 0;
const report = {
  schemaVersion: 1,
  status: blockers.length === 0 ? 'publishable' : 'draft-blocked',
  strictPublish: STRICT_PUBLISH,
  dataset: {
    persons: persons.length,
    skeletonMappings: skeletonMappings.length,
    reviewQueue,
    unresolvedRefs,
    pipelineStatus: meta.status ?? null,
    pipelineVersion: meta.pipelineVersion ?? null,
    expectedPipelineVersion: PIPELINE_VERSION,
    prospectiveMappings: prospectiveMapping.matches.size,
    prospectiveSoftMappings: prospectiveMapping.soft.length,
    prospectiveUnexpectedUnmatched: prospectiveUnexpectedUnmatched.length,
    prospectiveCollisions: prospectiveMapping.collisions.length,
  },
  blockers,
  evidence: {
    genderMismatches,
    publicationEvidenceIssues,
    publicationEvidenceAuthority: pipelineCurrent ? 'meta.publicationEvidence' : 'legacy-stale-artifacts',
    prospectiveMapping: {
      methodCounts: prospectiveMethodCounts,
      soft: prospectiveMapping.soft,
      unexpectedUnmatched: prospectiveUnexpectedUnmatched,
      expectedNoCounterpart: prospectiveMapping.unmatched.filter(item => item.candidates === 'no-tipnr-counterpart'),
      collisions: prospectiveMapping.collisions,
    },
    heuristicMappings,
    fuzzyMappings,
    genericCuratedViews,
    nationsViewIssues,
    spineProvenanceIssues,
    relationProvenanceIssues,
    interpretationWordingIssues,
    matthewLukeLayoutIssues,
    committedMatthewLukeArtifactIssues,
    runtimeV2Refs,
  },
  runtimeGuard: {
    ok: !runtimeViolation,
    reason: runtimeViolation ? 'v2 is referenced by runtime while publication blockers remain' : 'draft v2 is not wired into runtime',
  },
};

fs.mkdirSync(REPORT_DIR, { recursive: true });
fs.writeFileSync(path.join(REPORT_DIR, 'genealogy-v2-publication-audit.json'), JSON.stringify(report, null, 2) + '\n');
const md = [
  '# Genealogy v2 publication audit',
  '',
  `- Status: **${report.status}**`,
  `- Persons: ${persons.length}`,
  `- Pipeline: ${meta.pipelineVersion ?? 'missing'} (expected ${PIPELINE_VERSION})`,
  `- Publication evidence: ${pipelineCurrent ? 'meta.publicationEvidence' : 'legacy diagnostics (pipeline stale)'}`,
  `- Publication evidence issues: ${publicationEvidenceIssues.length}`,
  `- RU review queue: ${reviewQueue}`,
  `- Unresolved relations: ${unresolvedRefs ?? 'unknown'}`,
  `- Heuristic skeleton mappings: ${heuristicMappings.length}`,
  `- Fuzzy skeleton mappings: ${fuzzyMappings.length}`,
  `- Seed↔TIPNR gender mismatches: ${genderMismatches.length}`,
  `- Prospective matcher methods: ${JSON.stringify(prospectiveMethodCounts)}`,
  `- Prospective soft mappings: ${prospectiveMapping.soft.length}`,
  `- Prospective unexpected unmatched: ${prospectiveUnexpectedUnmatched.length}`,
  `- Prospective collisions: ${prospectiveMapping.collisions.length}`,
  `- Generic rules in curated views: ${genericCuratedViews.length}`,
  `- Nations curated-view issues: ${nationsViewIssues.length}`,
  `- Spine provenance issues: ${spineProvenanceIssues.length}`,
  `- Relation provenance issues: ${relationProvenanceIssues.length}`,
  `- Overstated interpretation wording: ${interpretationWordingIssues.length}`,
  `- Matthew/Luke layout truth-model issues: ${matthewLukeLayoutIssues.length}`,
  `- Matthew/Luke committed artifact drift: ${committedMatthewLukeArtifactIssues.length}`,
  `- Runtime v2 references: ${runtimeV2Refs.length}`,
  '',
  '## Blockers',
  '',
  ...(blockers.length ? blockers.map(item => `- \`${item.code}\`${item.count == null ? '' : `: ${item.count}`}`) : ['- none']),
  '',
  '## Runtime guard',
  '',
  report.runtimeGuard.ok ? '- PASS: draft v2 is not connected to the genealogy runtime.' : '- FAIL: draft v2 is connected while blockers remain.',
  '',
].join('\n');
fs.writeFileSync(path.join(REPORT_DIR, 'genealogy-v2-publication-audit.md'), md);

console.log(JSON.stringify(report, null, 2));
if (runtimeViolation || (STRICT_PUBLISH && blockers.length > 0)) process.exitCode = 1;
