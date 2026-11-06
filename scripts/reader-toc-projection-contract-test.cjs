#!/usr/bin/env node
'use strict';

/**
 * Runtime/contract witness for the read-only reader TOC projection.
 * Uses the ACTUAL repo SeriesConfig instances and their existing partToc;
 * bundles TypeScript in memory, without writing dist or modifying data.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const input = [
  "import { projectSeriesReaderToc, projectStandaloneReaderToc } from './src/components/article-pilots/_shared/series/readerTocProjection';",
  "import { GILL_SERIES } from './src/components/article-pilots/_shared/series/seriesConfig';",
  "import { BAPTIST_SERIES } from './src/components/article-pilots/_shared/series/baptistSeriesConfig';",
  'export { projectSeriesReaderToc, projectStandaloneReaderToc, GILL_SERIES, BAPTIST_SERIES };',
].join('\n');
const output = esbuild.buildSync({
  stdin: { contents: input, sourcefile: 'reader-toc-contract-entry.ts', resolveDir: root, loader: 'ts' },
  bundle: true, platform: 'node', format: 'cjs', target: 'node22',
  logLevel: 'silent', write: false,
}).outputFiles[0].text;
const bundled = new Module(path.join(root, '__reader_toc_contract__.cjs'), module);
bundled.filename = path.join(root, '__reader_toc_contract__.cjs');
bundled.paths = Module._nodeModulePaths(root);
bundled._compile(output, bundled.filename);
const { projectSeriesReaderToc, projectStandaloneReaderToc, GILL_SERIES, BAPTIST_SERIES } = bundled.exports;

let checks = 0;
function check(label, run) {
  run();
  checks += 1;
  process.stdout.write('PASS ' + label + '\n');
}
function flatten(items) {
  return items.flatMap((item) => [item, ...flatten(item.children)]);
}

const gillBefore = JSON.stringify(GILL_SERIES);
const baptistBefore = JSON.stringify(BAPTIST_SERIES);

check('actual Gill: all six pages project without changing chronological/menu order', () => {
  for (const pageId of Object.keys(GILL_SERIES.pages)) {
    const result = projectSeriesReaderToc(GILL_SERIES, pageId);
    assert.equal(result.nodes.length, 6);
    assert.equal(result.activePath.length, 1);
    assert.ok(Object.isFrozen(result.nodes));
    assert.ok(flatten(result.nodes).some((row) => row.key === result.currentPageKey));
    assert.deepEqual(result.nodes.map((row) => row.href), GILL_SERIES.items.map((row) => row.href));
    const activeNode = flatten(result.nodes).find((row) => row.key === result.currentPageKey);
    assert.deepEqual(
      flatten(activeNode.children).map((row) => row.href.slice(activeNode.href.length)),
      GILL_SERIES.pages[pageId].partToc.map((row) => row.href),
    );
  }
});

check('historical Gill pre-v16 last-pages anchor and label preserved', () => {
  const page = Object.entries(GILL_SERIES.pages).find(([id, data]) =>
    data.partToc.some((row) => row.href === '#sec-gill-last-pages'));
  assert.ok(page, 'expected Gill witness #sec-gill-last-pages');
  const full = flatten(projectSeriesReaderToc(GILL_SERIES, page[0]).nodes);
  const witness = full.find((row) => row.href.endsWith('#sec-gill-last-pages'));
  assert.ok(witness);
  assert.equal(witness.label, page[1].partToc.find((row) => row.href === '#sec-gill-last-pages').label);
});

check('Gill endpapers are unchanged label marks (Introduction, Reference)', () => {
  const nodes = projectSeriesReaderToc(GILL_SERIES, 'context').nodes;
  const labels = nodes.filter((x) => x.kind === 'endpaper');
  assert.ok(labels.length >= 2);
  assert.equal(labels[0].mark.kind, 'label');
  assert.equal(labels[0].mark.value, 'Введение');
});

check('actual Baptist book: four chapters plus the existing reference endpaper', () => {
  for (const pageId of Object.keys(BAPTIST_SERIES.pages)) {
    const result = projectSeriesReaderToc(BAPTIST_SERIES, pageId);
    assert.equal(result.nodes.filter((node) => node.kind === 'chapter').length, 4);
    assert.equal(result.nodes.length, 5);
    assert.ok(flatten(result.nodes).some((node) => node.key === result.currentPageKey));
    assert.equal(
      flatten(result.nodes).filter((node) => node.kind === 'heading').length,
      BAPTIST_SERIES.pages[pageId].partToc.length,
      'only one active page TOC may be hydrated',
    );
  }
  const soviet = projectSeriesReaderToc(BAPTIST_SERIES, 'sovetskaya-noch');
  assert.equal(soviet.activePath.length, 2);
  assert.equal(soviet.activePath[0], 'series:russian-baptism:chapter:soviet-night-and-one-union');
});

check('book section labels reuse original SeriesConfig roman-prefix policy', () => {
  const cfg = BAPTIST_SERIES;
  const id = 'sovetskaya-noch';
  const source = cfg.pages[id].partToc[0];
  // Synthetic fixture: this published article has no roman H2 prefix today.
  const injected = { ...source, label: 'IV. ' + source.label };
  const fixture = { ...cfg, pages: {
    ...cfg.pages, [id]: { ...cfg.pages[id], partToc: [injected, ...cfg.pages[id].partToc.slice(1)] },
  } };
  const after = flatten(projectSeriesReaderToc(fixture, id).nodes).find((node) => node.href.endsWith(source.href));
  assert.equal(after.label, source.label);
  assert.equal(cfg.pages[id].partToc[0].label, source.label);
});

check('DOM reconciliation admits nested H4-H6 without changing canonical H2/H3', () => {
  const id = 'part2', rows = GILL_SERIES.pages[id].partToc;
  assert.ok(rows.some((r) => r.level === 3));
  const rendered = [];
  let inserted = false;
  for (const row of rows) {
    rendered.push({ id: row.href.slice(1), label: row.label, level: row.level });
    if (!inserted && row.level === 3) {
      rendered.push({ id: 'deep-h4', label: 'Глубокий раздел', level: 4 });
      rendered.push({ id: 'deep-h5', label: 'Подпункт', level: 5 });
      rendered.push({ id: 'deep-h6', label: 'Последний уровень', level: 6 });
      inserted = true;
    }
  }
  const result = projectSeriesReaderToc(GILL_SERIES, id, { renderedHeadings: rendered });
  const all = flatten(result.nodes);
  assert.ok(all.some((r) => r.href.endsWith('#deep-h6')));
  assert.ok(all.find((r) => r.href.endsWith('#deep-h5')).children.some((r) => r.href.endsWith('#deep-h6')));
  assert.equal(all.filter((r) => r.kind === 'heading').length, rows.length + 3);
});

check('no silent reordering of pre-v16 Gill canonical headings', () => {
  const rows = GILL_SERIES.pages.part2.partToc;
  const reversed = [...rows].reverse().map((row) => ({ id: row.href.slice(1), label: row.label, level: row.level }));
  assert.throws(() => projectSeriesReaderToc(GILL_SERIES, 'part2', { renderedHeadings: reversed }), /reorder/);
});

check('missing historical DOM target fails closed', () => {
  const rows = GILL_SERIES.pages.context.partToc;
  const incomplete = rows.slice(1).map((row) => ({ id: row.href.slice(1), label: row.label, level: row.level }));
  assert.throws(() => projectSeriesReaderToc(GILL_SERIES, 'context', { renderedHeadings: incomplete }), /missing/);
});

check('duplicate canonical fragments fail closed', () => {
  const original = GILL_SERIES.pages.context.partToc;
  const broken = { ...GILL_SERIES, pages: { ...GILL_SERIES.pages, context: {
    ...GILL_SERIES.pages.context, partToc: [original[0], original[0], ...original.slice(1)],
  } } };
  assert.throws(() => projectSeriesReaderToc(broken, 'context'), /duplicate canonical/);
});

check('broken percentages, empty fragments and missing active page fail closed', () => {
  const original = GILL_SERIES.pages.context.partToc;
  for (const href of ['#', '#broken%X9', '#%23']) {
    const broken = { ...GILL_SERIES, pages: { ...GILL_SERIES.pages, context: {
      ...GILL_SERIES.pages.context, partToc: [{ ...original[0], href }, ...original.slice(1)],
    } } };
    assert.throws(() => projectSeriesReaderToc(broken, 'context'), /fragment|percent/);
  }
  assert.throws(() => projectSeriesReaderToc(GILL_SERIES, 'not-a-page'), /active page/);
});

check('standalone H2-H6 nested hierarchy with exact Unicode headings', () => {
  const headings = [2, 3, 4, 5, 6].map((level) => ({
    id: 'ru-' + level, label: 'Христоцентричная герменевтика ' + level, level,
  }));
  const nodes = projectStandaloneReaderToc('/articles/hermenevtika/', headings);
  assert.equal(nodes.length, 1);
  assert.equal(flatten(nodes).length, 5);
  assert.equal(nodes[0].children[0].children[0].children[0].children[0].depth, 4);
  assert.equal(nodes[0].href, '/articles/hermenevtika/#ru-2');
  assert.throws(() => projectStandaloneReaderToc('/articles/x/', [headings[1]]), /hierarchy gap/);
  assert.throws(() => projectStandaloneReaderToc('/articles/x/', [headings[0], headings[0]]), /duplicate/);
});

check('satellite rows are not accidentally added to desktop top-level rail', () => {
  const satellite = {
    id: 'satellite-test', title: 'Спутник', shortTitle: 'Спутник',
    mark: { kind: 'letter', value: 'А' }, tier: 'satellite', parent: 'part2',
    href: '/articles/satellite-test/', readingTime: '5 мин',
  };
  const clone = { ...GILL_SERIES, items: [...GILL_SERIES.items, satellite] };
  const result = projectSeriesReaderToc(clone, 'context');
  assert.equal(result.nodes.length, 6);
  assert.equal(flatten(result.nodes).filter((row) => row.href === satellite.href).length, 0);
});

check('series data and published routes remained byte-identical', () => {
  assert.equal(JSON.stringify(GILL_SERIES), gillBefore);
  assert.equal(JSON.stringify(BAPTIST_SERIES), baptistBefore);
});

console.log('READER TOC PROJECTION: ' + checks + '/' + checks + ' PASS (real Gill + Baptist + negative/deep fixtures)');
