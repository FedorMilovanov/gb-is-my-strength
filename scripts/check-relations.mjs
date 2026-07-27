#!/usr/bin/env node
/** Fail-closed contracts for the canonical relation compiler. */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileRelations, RELATION_SCHEMA_VERSION } from '../src/lib/relations/engine.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (file) => JSON.parse(await readFile(join(ROOT, file), 'utf8'));
const [graphData, seriesData, catalogData] = await Promise.all([
  readJson('data/links-graph.json'),
  readJson('data/series.json'),
  readJson('data/relations.json'),
]);

const first = compileRelations({ graphData, seriesData, catalogData, strict: true });
const second = compileRelations({ graphData, seriesData, catalogData, strict: true });
const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
};

check('schema version', first.schemaVersion === RELATION_SCHEMA_VERSION);
check('deterministic compiler output', JSON.stringify(first) === JSON.stringify(second));
check('graph nodes retained', first.nodes.length >= (graphData.nodes || []).length, `${first.nodes.length} compiled`);
check('published series order derived', first.stats.seriesRelations > 0, String(first.stats.seriesRelations));
check('verified editorial catalog active', (first.stats.origins.catalog || 0) > 0, String(first.stats.origins.catalog || 0));
check('legacy graph imported only as fallback', first.stats.legacyImported >= 0 && first.stats.legacySuppressed > 0, `${first.stats.legacyImported}/${first.stats.legacySuppressed}`);
check('compiler errors empty', first.stats.errors.length === 0, first.stats.errors.join(' | '));

const nodeMap = new Map(first.nodes.map((node) => [node.id, node]));
const edgeIds = new Set();
const semantics = new Set();
for (const edge of first.edges) {
  const semantic = edge.direction === 'directed'
    ? `${edge.kind}:${edge.source}>${edge.target}`
    : `${edge.kind}:${[edge.source, edge.target].sort().join('~')}`;
  check(`edge endpoints: ${edge.id}`, nodeMap.has(edge.source) && nodeMap.has(edge.target));
  check(`edge id unique: ${edge.id}`, !edgeIds.has(edge.id));
  check(`edge semantics unique: ${edge.id}`, !semantics.has(semantic));
  edgeIds.add(edge.id);
  semantics.add(semantic);
}

let panelCount = 0;
for (const node of first.nodes) {
  const projection = first.projections.byNode[node.id];
  check(`projection exists: ${node.id}`, Boolean(projection));
  if (!projection) continue;
  check(`article projection capped: ${node.id}`, projection.article.length <= 4, String(projection.article.length));
  if (projection.article.length) panelCount += 1;
  const targets = new Set();
  for (const item of projection.article) {
    const target = nodeMap.get(item.targetId);
    check(`article target exists: ${node.id} -> ${item.targetId}`, Boolean(target));
    check(`article target unique: ${node.id} -> ${item.targetId}`, !targets.has(item.targetId));
    check(`series order not duplicated: ${node.id} -> ${item.targetId}`, item.kind !== 'series-next' && !(node.seriesId && node.seriesId === target?.seriesId));
    targets.add(item.targetId);
  }
}
check('panel statistic exact', panelCount === first.stats.articlePanels, `${panelCount}/${first.stats.articlePanels}`);
check('Atlas kinds complete', ['series', 'cluster', 'structure', 'bridge'].every((kind) => first.edgeKinds.some((entry) => entry.id === kind)));

if (failures.length) {
  console.error(`\n❌ relation contracts: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log(`\n✅ relation contracts: ${first.stats.nodes} nodes, ${first.stats.edges} typed edges, ${first.stats.articlePanels} article panels`);
