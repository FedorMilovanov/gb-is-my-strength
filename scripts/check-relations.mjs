#!/usr/bin/env node
/** Fail-closed contracts for the canonical relation compiler and catalog schema. */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compileRelations,
  RELATION_SCHEMA_VERSION,
  RELATION_TYPES,
} from '../src/lib/relations/engine.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (file) => JSON.parse(await readFile(join(ROOT, file), 'utf8'));
const [graphData, seriesData, catalogData, catalogSchema] = await Promise.all([
  readJson('data/links-graph.json'),
  readJson('data/series.json'),
  readJson('data/relations.json'),
  readJson('data/relations.schema.json'),
]);

const failures = [];
function check(name, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

const schemaKinds = catalogSchema?.$defs?.relation?.properties?.kind?.enum || [];
const engineKinds = Object.keys(RELATION_TYPES);
check('catalog schema version', catalogData.schemaVersion === RELATION_SCHEMA_VERSION && catalogSchema.properties?.schemaVersion?.const === RELATION_SCHEMA_VERSION);
check('catalog schema kind enum matches engine', JSON.stringify([...schemaKinds].sort()) === JSON.stringify([...engineKinds].sort()), `${schemaKinds.length}/${engineKinds.length}`);
check('catalog is a relation array', Array.isArray(catalogData.relations));

const allowedKeys = new Set(['id', 'source', 'target', 'kind', 'weight', 'label', 'inverseLabel', 'rationale', 'editorialStatus']);
const catalogIds = new Set();
const catalogIssues = [];
for (const [index, relation] of (catalogData.relations || []).entries()) {
  const prefix = relation?.id || `index:${index}`;
  if (!relation || typeof relation !== 'object' || Array.isArray(relation)) {
    catalogIssues.push(`${prefix}: not an object`);
    continue;
  }
  const unknown = Object.keys(relation).filter((key) => !allowedKeys.has(key));
  if (unknown.length) catalogIssues.push(`${prefix}: unknown keys ${unknown.join(',')}`);
  if (!/^[a-z0-9][a-z0-9:_-]{2,119}$/.test(String(relation.id || ''))) catalogIssues.push(`${prefix}: invalid id`);
  if (catalogIds.has(relation.id)) catalogIssues.push(`${prefix}: duplicate id`);
  catalogIds.add(relation.id);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(String(relation.source || ''))) catalogIssues.push(`${prefix}: invalid source`);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(String(relation.target || ''))) catalogIssues.push(`${prefix}: invalid target`);
  if (!engineKinds.includes(relation.kind)) catalogIssues.push(`${prefix}: unknown kind`);
  if (!['verified', 'draft', 'deprecated'].includes(relation.editorialStatus)) catalogIssues.push(`${prefix}: invalid status`);
  if (relation.weight != null && (!Number.isInteger(relation.weight) || relation.weight < 1 || relation.weight > 100)) catalogIssues.push(`${prefix}: invalid weight`);
  if (relation.editorialStatus === 'verified' && String(relation.rationale || '').trim().length < 20) catalogIssues.push(`${prefix}: verified relation requires rationale`);
}
check('editorial catalog shape', catalogIssues.length === 0, catalogIssues.slice(0, 8).join(' | '));

const first = compileRelations({ graphData, seriesData, catalogData, strict: true });
const second = compileRelations({ graphData, seriesData, catalogData, strict: true });
check('compiler schema version', first.schemaVersion === RELATION_SCHEMA_VERSION);
check('deterministic compiler output', JSON.stringify(first) === JSON.stringify(second));
check('graph nodes retained', first.nodes.length >= (graphData.nodes || []).length, `${first.nodes.length} compiled`);
check('published series order derived', first.stats.seriesRelations > 0, String(first.stats.seriesRelations));
check('verified editorial catalog active', (first.stats.origins.catalog || 0) === catalogData.relations.filter((relation) => relation.editorialStatus === 'verified').length, `${first.stats.origins.catalog || 0} compiled`);
check('legacy graph is fallback only', first.stats.legacyImported >= 0 && first.stats.legacySuppressed > 0, `${first.stats.legacyImported} imported / ${first.stats.legacySuppressed} suppressed`);
check('compiler errors empty', first.stats.errors.length === 0, first.stats.errors.join(' | '));

const statusFixtureGraph = {
  nodes: [
    { id: 'fixture-a', title: 'Fixture A', url: '/fixture-a/', group: 'standalone' },
    { id: 'fixture-b', title: 'Fixture B', url: '/fixture-b/', group: 'standalone' },
  ],
  edges: [['fixture-a', 'fixture-b']],
};
const statusRelation = (editorialStatus) => ({
  schemaVersion: 1,
  relations: [{
    id: `fixture-${editorialStatus}`,
    source: 'fixture-a',
    target: 'fixture-b',
    kind: 'related',
    rationale: 'Проверочная связь для контракта статусов редакционного каталога.',
    editorialStatus,
  }],
});
const draftFixture = compileRelations({
  graphData: statusFixtureGraph,
  seriesData: {},
  catalogData: statusRelation('draft'),
  strict: true,
});
const deprecatedFixture = compileRelations({
  graphData: statusFixtureGraph,
  seriesData: {},
  catalogData: statusRelation('deprecated'),
  strict: true,
});
check(
  'draft relation does not suppress live legacy fallback',
  draftFixture.stats.catalogDrafts === 1
    && draftFixture.stats.legacyImported === 1
    && draftFixture.stats.legacySuppressed === 0
    && draftFixture.edges.length === 1
    && draftFixture.edges[0].origin === 'legacy-import',
  JSON.stringify(draftFixture.stats),
);
check(
  'deprecated relation explicitly suppresses legacy fallback',
  deprecatedFixture.stats.catalogDeprecated === 1
    && deprecatedFixture.stats.legacyImported === 0
    && deprecatedFixture.stats.legacySuppressed === 1
    && deprecatedFixture.edges.length === 0,
  JSON.stringify(deprecatedFixture.stats),
);

const nodeMap = new Map(first.nodes.map((node) => [node.id, node]));
const edgeIds = new Set();
const semantics = new Set();
const edgeIssues = [];
for (const edge of first.edges) {
  const semantic = edge.direction === 'directed'
    ? `${edge.kind}:${edge.source}>${edge.target}`
    : `${edge.kind}:${[edge.source, edge.target].sort().join('~')}`;
  if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) edgeIssues.push(`${edge.id}: missing endpoint`);
  if (edgeIds.has(edge.id)) edgeIssues.push(`${edge.id}: duplicate id`);
  if (semantics.has(semantic)) edgeIssues.push(`${edge.id}: duplicate semantic relation`);
  if (!['series', 'cluster', 'structure', 'bridge'].includes(edge.atlasKind)) edgeIssues.push(`${edge.id}: invalid Atlas kind`);
  edgeIds.add(edge.id);
  semantics.add(semantic);
}
check('compiled edge integrity', edgeIssues.length === 0, edgeIssues.slice(0, 8).join(' | '));

let panelCount = 0;
const projectionIssues = [];
for (const node of first.nodes) {
  const projection = first.projections.byNode[node.id];
  if (!projection) {
    projectionIssues.push(`${node.id}: missing projection`);
    continue;
  }
  if (projection.article.length > 4) projectionIssues.push(`${node.id}: ${projection.article.length} article targets`);
  if (projection.article.length) panelCount += 1;
  const targets = new Set();
  for (const item of projection.article) {
    const target = nodeMap.get(item.targetId);
    if (!target) projectionIssues.push(`${node.id}: missing target ${item.targetId}`);
    if (targets.has(item.targetId)) projectionIssues.push(`${node.id}: duplicate target ${item.targetId}`);
    if (item.kind === 'series-next') projectionIssues.push(`${node.id}: series-next leaked into article`);
    if (node.seriesId && node.seriesId === target?.seriesId) projectionIssues.push(`${node.id}: same-series target ${item.targetId}`);
    targets.add(item.targetId);
  }
}
check('article projection integrity', projectionIssues.length === 0, projectionIssues.slice(0, 8).join(' | '));
check('panel statistic exact', panelCount === first.stats.articlePanels, `${panelCount}/${first.stats.articlePanels}`);
check('Atlas kinds complete', ['series', 'cluster', 'structure', 'bridge'].every((kind) => first.edgeKinds.some((entry) => entry.id === kind)));

if (failures.length) {
  console.error(`\n❌ relation contracts: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log(`\n✅ relation contracts: ${first.stats.nodes} nodes, ${first.stats.edges} edges, ${first.stats.articlePanels} article panels, ${catalogData.relations.length} editorial relations`);
