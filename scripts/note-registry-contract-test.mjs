#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GENERATED_START,
  collectAndProjectHtml,
  projectNoteRegistry,
} from './lib/note-registry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const route = '/articles/fixture/';
const source = `<!doctype html><html><head><title>Fixture</title></head><body><main data-pagefind-body>
<p>Alpha <span class="fn-marker">[1]<span class="tooltip">First <em>note</em>.</span></span></p>
<p>Map <button class="fn-marker map-trigger"><span class="tooltip">Map UI only</span></button></p>
<p>Beta <span class="fn-marker">[2]<span class="tooltip">Second note.</span></span></p>
</main><script src="/js/site.js"></script></body></html>`;

const projected = collectAndProjectHtml(source, route);
assert.deepEqual(projected.errors, []);
assert.equal(projected.notes.length, 2);
assert.equal(new Set(projected.notes.map((note) => note.id)).size, 2);
assert.ok(projected.notes.every((note) => note.interactionOwner === 'SiteUtils.makeTooltipController'));
assert.match(projected.html, /data-note-registry-endnotes data-speakable/);
assert.match(projected.html, /data-pagefind-ignore="" data-note-registry-tooltip=""/);
assert.match(projected.html, /aria-describedby="note-end-/);
assert.match(projected.html, /aria-controls="note-tip-/);
assert.match(projected.html, /<noscript data-note-registry-noscript>/);
assert.match(projected.html, /@media print/);
assert.equal(collectAndProjectHtml(projected.html, route).html, projected.html, 'projection must be idempotent');

const searchableProjection = collectAndProjectHtml(`<!doctype html><html><body><main>
<article data-pagefind-body><p>Searchable <span class="fn-marker">1<span class="tooltip">Indexed note.</span></span></p></article>
</main></body></html>`, route);
assert.deepEqual(searchableProjection.errors, []);
assert.match(
  searchableProjection.html,
  /<article data-pagefind-body>[\s\S]*data-note-registry-endnotes[\s\S]*<\/article>/,
  'generated endnotes must remain inside the common Pagefind body'
);

const reordered = source.replace(
  '<p>Alpha <span class="fn-marker">[1]<span class="tooltip">First <em>note</em>.</span></span></p>\n<p>Map',
  '<p>Beta <span class="fn-marker">[2]<span class="tooltip">Second note.</span></span></p>\n<p>Map'
).replace(
  '<p>Beta <span class="fn-marker">[2]<span class="tooltip">Second note.</span></span></p>\n</main>',
  '<p>Alpha <span class="fn-marker">[1]<span class="tooltip">First <em>note</em>.</span></span></p>\n</main>'
);
assert.deepEqual(
  collectAndProjectHtml(reordered, route).notes.map((note) => note.id).sort(),
  projected.notes.map((note) => note.id).sort(),
  'stable IDs must not depend on document ordinal'
);

const repeatedPrefix = 'same-prefix '.repeat(120);
const longContext = collectAndProjectHtml(`<main><h2 id="section">Section</h2>
<p>${repeatedPrefix}first authored clause <span class="fn-marker">1<span class="tooltip">Same note.</span></span> first tail</p>
<p>${repeatedPrefix}second authored clause <span class="fn-marker">2<span class="tooltip">Same note.</span></span> second tail</p>
</main>`, route);
assert.deepEqual(longContext.errors, [], 'immediate authored context must disambiguate notes after a long shared prefix');
assert.equal(new Set(longContext.notes.map((note) => note.id)).size, 2);

const rawTextPoison = collectAndProjectHtml(`<main><h2 id="section">Section</h2>
<p><script>const template = "</main>";</script>
Achan authored clause <span class="fn-marker">30<span class="tooltip">Ibid., 311.</span></span> Achan tail.
${'middle '.repeat(180)}
Bribe authored clause <span class="fn-marker">38<span class="tooltip">Ibid., 311.</span></span> Bribe tail.</p>
</main>`, route);
assert.deepEqual(rawTextPoison.errors, [], 'raw-text HTML strings must not corrupt authored note context');
assert.equal(new Set(rawTextPoison.notes.map((note) => note.id)).size, 2);

const ambiguous = collectAndProjectHtml(`<main><h2 id="section">Section</h2>
<p>Same clause <span class="fn-marker">1<span class="tooltip">Same note.</span></span> same tail</p>
<p>Same clause <span class="fn-marker">2<span class="tooltip">Same note.</span></span> same tail</p>
</main>`, route);
assert.match(ambiguous.errors.join('\n'), /duplicate note id/, 'truly ambiguous notes must fail closed');

const authoredAmbiguous = collectAndProjectHtml(`<main><h2 id="section">Section</h2>
<p>Same clause <span class="fn-marker" data-note-id="fixture-source-a">1<span class="tooltip">Same note.</span></span> same tail</p>
<p>Same clause <span class="fn-marker" data-note-id="fixture-source-b">2<span class="tooltip">Same note.</span></span> same tail</p>
</main>`, route);
assert.deepEqual(authoredAmbiguous.errors, []);
assert.deepEqual(authoredAmbiguous.notes.map((note) => note.id), ['fixture-source-a', 'fixture-source-b']);

const authoredAmbiguousReordered = collectAndProjectHtml(`<main><h2 id="section">Section</h2>
<p>Same clause <span class="fn-marker" data-note-id="fixture-source-b">2<span class="tooltip">Same note.</span></span> same tail</p>
<p>Same clause <span class="fn-marker" data-note-id="fixture-source-a">1<span class="tooltip">Same note.</span></span> same tail</p>
</main>`, route);
assert.deepEqual(authoredAmbiguousReordered.errors, []);
assert.deepEqual(
  authoredAmbiguousReordered.notes.map((note) => note.id).sort(),
  authoredAmbiguous.notes.map((note) => note.id).sort(),
  'authored IDs must remain stable when ambiguous notes are reordered'
);

const orphan = collectAndProjectHtml('<main><span class="fn-marker">[1]</span></main>', route);
assert.match(orphan.errors.join('\n'), /expected one \.tooltip, found 0/);
const duplicate = collectAndProjectHtml('<main><span class="fn-marker">1<span class="tooltip">Same</span></span><span class="fn-marker">2<span class="tooltip">Same</span></span></main>', route);
assert.match(duplicate.errors.join('\n'), /duplicate note id/);
const ordinal = collectAndProjectHtml('<main><span class="fn-marker" data-note-ordinal="7">1<span class="tooltip">Ordinal</span></span></main>', route);
assert.match(ordinal.errors.join('\n'), /ordinal drift/);
const nested = collectAndProjectHtml('<main><span class="fn-marker"><button>bad</button><span class="tooltip">Nested</span></span></main>', route);
assert.match(nested.errors.join('\n'), /nested interactive controls outside tooltip/);
assert.throws(() => collectAndProjectHtml(`${GENERATED_START}<main></main>`, route), /generated block is malformed/);

const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'a03-note-registry-'));
try {
  const file = path.join(dist, 'articles', 'fixture', 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source, 'utf8');
  const report = projectNoteRegistry({ distRoot: dist, reportDir: path.join(dist, 'reports'), sourceCommit: 'fixture' });
  assert.equal(report.registry.routeCount, 1);
  assert.equal(report.registry.noteCount, 2);
  assert.ok(fs.existsSync(path.join(dist, 'data', 'note-registry.json')));
  assert.equal(projectNoteRegistry({ distRoot: dist, reportDir: path.join(dist, 'reports'), dryRun: true }).filesChanged, 0);
} finally {
  fs.rmSync(dist, { recursive: true, force: true });
}

const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'note-registry.schema.json'), 'utf8'));
assert.equal(schema.properties.interactionOwner.const, 'SiteUtils.makeTooltipController');
const site = fs.readFileSync(path.join(ROOT, 'js', 'site.js'), 'utf8');
assert.match(site, /makeTooltipController:function/);
const a04Contract = fs.readFileSync(path.join(ROOT, 'scripts', 'lib', 'a04-contract.mjs'), 'utf8');
assert.match(a04Contract, /id:\s*'footnote',\s*trigger:\s*'\.fn-marker',\s*tip:\s*'\.tooltip',\s*exception:\s*'\.map-trigger'/);
const moduleSource = fs.readFileSync(path.join(ROOT, 'scripts', 'lib', 'note-registry.mjs'), 'utf8');
assert.doesNotMatch(moduleSource, /addEventListener\s*\(/, 'NoteRegistry must not create a second interaction runtime');

console.log('✅ A03 NoteRegistry stable IDs, mutations and unified projections passed');
