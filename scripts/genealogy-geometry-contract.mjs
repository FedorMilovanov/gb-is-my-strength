#!/usr/bin/env node
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { buildLayout } from '../src/components/genealogy/layout.ts';
import { projectGenealogy, overviewIds, fitGenealogyView, centerOf, boxesOverlap, getDetailLevel, MIN_ZOOM } from '../src/components/genealogy/semanticGraph.ts';
import { NODE_W, NODE_H } from '../src/components/genealogy/theme.ts';
import { readGenealogyRuntimePersons } from './genealogy-runtime-fixture.mjs';

export function assertGenealogyGeometryContract() {
  const persons = readGenealogyRuntimePersons();
  const full = buildLayout(persons, { showGolden: true, showLineage: 'all' });
  const positions = new Map(full.nodes.map(node => [node.id, node.position]));
  for (const lineage of ['all', 'messianic', 'cainite', 'neutral']) {
    const layout = buildLayout(persons, { showGolden: true, showLineage: lineage });
    for (const node of layout.nodes) {
      assert.deepEqual(node.position, positions.get(node.id), `${node.id} moved under filter ${lineage}`);
      assert.ok(Number.isFinite(node.position.x) && Number.isFinite(node.position.y));
    }
    for (let i = 0; i < layout.nodes.length; i++) for (let j = i + 1; j < layout.nodes.length; j++) {
      const a = layout.nodes[i], b = layout.nodes[j];
      assert.equal(boxesOverlap({ ...a.position, width: NODE_W, height: NODE_H },
        { ...b.position, width: NODE_W, height: NODE_H }), false, `${lineage}: overlapping ${a.id}/${b.id}`);
    }
    for (const edge of layout.edges) {
      const parent = layout.nodes.find(n => n.id === edge.source), child = layout.nodes.find(n => n.id === edge.target);
      assert.ok(child.position.y >= parent.position.y + NODE_H, `${edge.id}: child must follow parent with a card gap`);
    }
  }
  const withoutChronology = buildLayout(persons.map(person => ({ ...person, chronology: null })), { showGolden: true, showLineage: 'all' });
  assert.deepEqual(withoutChronology.nodes.map(n => n.position), full.nodes.map(n => n.position), 'Unknown birth dates must not move families');
  const edgeSet = new Set(full.edges.map(e => `${e.source}->${e.target}`));
  const anchors = ['adam', 'noah', 'abram', 'david', 'jesus'];
  for (const size of [{ width: 320, height: 430 }, { width: 390, height: 550 }, { width: 1440, height: 700 }]) {
    const camera = fitGenealogyView(full.nodes.filter(n => overviewIds(full.nodes).has(n.id)), size.width, size.height);
    assert.ok(camera.zoom >= MIN_ZOOM && getDetailLevel(camera.zoom) === 0, 'Overview is not reachable');
    const projection = projectGenealogy(full.nodes, full.edges, camera.zoom, [], full.goldenPath);
    assert.deepEqual([...projection.visibleIds], anchors, 'Overview must retain the five story anchors');
    assert.equal(projection.edges.length, 4, 'Overview must connect consecutive story anchors');
    for (const id of anchors) {
      const center = centerOf(full.nodes.find(n => n.id === id));
      const x = center.x * camera.zoom + camera.x, y = center.y * camera.zoom + camera.y;
      assert.ok(x >= 72 && x <= size.width - 72 && y >= 26 && y <= size.height - 26, `${id}: overview label cropped`);
    }
    for (const edge of projection.edges) {
      assert.equal(edge.data.collapsed, true);
      assert.equal(edge.data.hiddenCount, edge.data.pathIds.length - 2);
      for (let i = 1; i < edge.data.pathIds.length; i++) {
        assert.ok(edgeSet.has(`${edge.data.pathIds[i - 1]}->${edge.data.pathIds[i]}`), 'Folded path invented a relationship');
      }
    }
  }
  for (const zoom of [0.3, 0.45, 0.69, 0.7, 1, 3]) {
    const p = projectGenealogy(full.nodes, full.edges, zoom, [], full.goldenPath);
    const selected = full.nodes.filter(n => p.visibleIds.has(n.id)).map(centerOf);
    for (let i = 0; i < selected.length; i++) for (let j = i + 1; j < selected.length; j++) {
      const box = c => ({ x: c.x - p.width / 2, y: c.y - p.height / 2, width: p.width, height: p.height });
      assert.equal(boxesOverlap(box(selected[i]), box(selected[j])), false, `Semantic labels collide at zoom ${zoom}`);
    }
    if (zoom >= 0.7) assert.equal(p.visibleIds.size, persons.length);
  }
  const noGold = buildLayout(persons, { showGolden: false, showLineage: 'all' });
  assert.deepEqual([...projectGenealogy(noGold.nodes, noGold.edges, 0.04, [], noGold.goldenPath).visibleIds], anchors);
  assert.equal(buildLayout([], { showGolden: true, showLineage: 'all' }).nodes.length, 0);
  return { persons: persons.length, overlapPairs: 0, overviewAnchors: anchors.length };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('Genealogy geometry contract: PASS', assertGenealogyGeometryContract());
}
