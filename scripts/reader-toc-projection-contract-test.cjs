#!/usr/bin/env node
'use strict';

/**
 * Runtime/contract witness for the read-only reader TOC projection.
 * Uses the ACTUAL repo SeriesConfig instances and their existing partToc;
 * bundles TypeScript in memory, without writing dist or modifying data.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
// TypeScript is a DIRECT declared devDependency. Do not rely on a transitive
// bundler just to exercise the real SeriesConfig module graph in this test.
require.extensions['.ts'] = (mod, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const result = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => root,
    getNewLine: () => '\n',
  }));
  mod._compile(result.outputText, filename);
};
const { projectSeriesReaderToc, projectStandaloneReaderToc } =
  require(path.join(root, 'src/components/article-pilots/_shared/series/readerTocProjection.ts'));
const { GILL_SERIES } =
  require(path.join(root, 'src/components/article-pilots/_shared/series/seriesConfig.ts'));
const { BAPTIST_SERIES } =
  require(path.join(root, 'src/components/article-pilots/_shared/series/baptistSeriesConfig.ts'));
const { GENESIS6_SERIES } =
  require(path.join(root, 'src/components/article-pilots/_shared/series/genesis6SeriesConfig.ts'));
const { HARD_TEXTS_SERIES } =
  require(path.join(root, 'src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts'));
const { PASTOR_SERIES } =
  require(path.join(root, 'src/components/article-pilots/_shared/series/pastorSeriesConfig.ts'));
const { APOSTASY_SERIES } =
  require(path.join(root, 'src/components/article-pilots/_shared/series/apostasySeriesConfig.ts'));
const { TEEN_DOUBLE_LIFE_SERIES } =
  require(path.join(root, 'src/components/article-pilots/_shared/series/teenSeriesConfig.ts'));

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

check('all seven real series families project every published page', () => {
  const series = [
    GILL_SERIES, BAPTIST_SERIES, GENESIS6_SERIES, HARD_TEXTS_SERIES,
    PASTOR_SERIES, APOSTASY_SERIES, TEEN_DOUBLE_LIFE_SERIES,
  ];
  for (const cfg of series) {
    for (const id of Object.keys(cfg.pages)) {
      const result = projectSeriesReaderToc(cfg, id);
      assert.equal(result.actualPageId, id);
      assert.ok(result.activePath.length >= 1);
      assert.ok(flatten(result.nodes).some((node) => node.key === result.currentPageKey));
    }
  }
});

check('actual Genesis 6 satellite pages retain parent ownership, not duplicate rail items', () => {
  const satellites = GENESIS6_SERIES.items.filter((item) => item.tier === 'satellite');
  assert.equal(satellites.length, 2);
  for (const item of satellites) {
    const result = projectSeriesReaderToc(GENESIS6_SERIES, item.id);
    assert.equal(result.satellitePageId, item.id);
    assert.equal(result.currentPageKey, 'series:' + GENESIS6_SERIES.seriesId + ':page:' + item.parent);
    assert.equal(result.activePath[result.activePath.length - 1], result.currentPageKey);
    assert.equal(flatten(result.nodes).filter((node) => node.kind === 'heading').length, 0);
    assert.ok(!flatten(result.nodes).some((node) => node.href === item.href), 'satellite kept in own part accordion');
  }
});

check('series data and published routes remained byte-identical', () => {
  assert.equal(JSON.stringify(GILL_SERIES), gillBefore);
  assert.equal(JSON.stringify(BAPTIST_SERIES), baptistBefore);
});

console.log('READER TOC PROJECTION: ' + checks + '/' + checks + ' PASS (real Gill + Baptist + negative/deep fixtures)');
