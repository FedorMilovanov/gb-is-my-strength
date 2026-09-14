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

const heuristicSection = (validationText.split('## v1-скелет: эвристические сопоставления')[1] ?? '')
  .split('\n> Статус')[0];
const heuristicMappings = heuristicSection.split('\n')
  .filter(line => line.startsWith('- ') && line.includes('←'))
  .map(line => {
    const match = /^-\s+(.+?)\s+←\s+(.+)$/u.exec(line);
    if (!match) return null;
    const evidence = match[2].trim();
    return {
      v1Id: match[1].trim(),
      evidence,
      kind: evidence.startsWith('fuzzy:') ? 'fuzzy' : evidence.startsWith('disamb:') ? 'disambiguation' : 'other',
    };
  })
  .filter(Boolean);
const fuzzyMappings = heuristicMappings.filter(mapping => mapping.kind === 'fuzzy');
const unresolvedMatch = /нерезолв:\s*(\d+)/u.exec(validationText);
const unresolvedRefs = unresolvedMatch ? Number(unresolvedMatch[1]) : null;
const reviewQueue = persons.filter(person => person.ru?.review === true).length;
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
if (tableOfNations.counts?.nationsProper !== 70) nationsViewIssues.push('table-of-nations.count');
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
    assertion: 'explicit-textual', directScripture: true, editorialPosition: 'text',
  },
  {
    from: 'heli--luk-3-23', to: 'mary--mat-1-16',
    assertion: 'editorial-harmonization', directScripture: false, editorialPosition: 'preferred',
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

  const generatedEdge = edges.find(edge => edge.from === expected.from && edge.to === expected.to && edge.kind === (annotation.kind ?? 'parent'));
  if (!generatedEdge) {
    relationProvenanceIssues.push({ edge: `${expected.from}→${expected.to}`, issue: 'missing-generated-edge' });
  } else if (meta.pipelineVersion === PIPELINE_VERSION) {
    for (const field of ['assertion', 'confidence', 'directScripture', 'editorialPosition']) {
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
