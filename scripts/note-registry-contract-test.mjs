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
assert.match(site, /\.fn-marker:not\(\.map-trigger\)/);
const moduleSource = fs.readFileSync(path.join(ROOT, 'scripts', 'lib', 'note-registry.mjs'), 'utf8');
assert.doesNotMatch(moduleSource, /addEventListener\s*\(/, 'NoteRegistry must not create a second interaction runtime');

console.log('A03 NoteRegistry stable IDs, mutations and unified projections passed');
