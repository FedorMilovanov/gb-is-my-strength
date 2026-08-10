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
<h2 id="alpha">Alpha</h2>
<p>Alpha <span class="fn-marker">[1]<span class="tooltip">First <em>note</em>.</span></span></p>
<p>Map <button class="fn-marker map-trigger"><span class="tooltip">Map UI only</span></button></p>
<h2 id="beta">Beta</h2>
<p>Beta <span class="fn-marker">[2]<span class="tooltip">Second note.</span></span></p>
</main><script src="/js/site.js"></script></body></html>`;

const projected = collectAndProjectHtml(source, route, { cssHref: '/css/note-registry.css?v=1234abcd' });
assert.deepEqual(projected.errors, []);
assert.equal(projected.notes.length, 2);
assert.equal(new Set(projected.notes.map((note) => note.id)).size, 2);
assert.ok(projected.notes.every((note) => note.interactionOwner === 'SiteUtils.makeTooltipController'));
assert.match(projected.html, /data-note-registry-endnotes data-speakable data-pagefind-body data-print-policy="include"/);
assert.match(projected.html, /data-pagefind-ignore="" data-note-registry-tooltip=""/);
assert.match(projected.html, /aria-describedby="note-end-/);
assert.match(projected.html, /aria-controls="note-tip-/);
assert.deepEqual(
  [...projected.html.matchAll(/aria-label="Показать сноску (\d+)"/g)].map((match) => match[1]),
  ['1', '2'],
  'generic footnote labels must become distinguishable canonical ordinals'
);
assert.match(projected.html, /data-note-registry-stylesheet/);
assert.match(projected.html, /note-registry\.css\?v=1234abcd/);
assert.doesNotMatch(projected.html, /<style\b/i, 'projection must not duplicate the stylesheet inline');
assert.equal(
  collectAndProjectHtml(projected.html, route, { cssHref: '/css/note-registry.css?v=1234abcd' }).html,
  projected.html,
  'projection must be idempotent'
);

const inlineMarkup = collectAndProjectHtml(`<!doctype html><html><head></head><body><main data-pagefind-body>
<h2 id="source">Source</h2><p>Inline <span class="fn-marker">1<span class="tooltip">См.: <a href="#source">Rippon, <em>A Brief Memoir</em></a>.</span></span></p>
</main></body></html>`, route);
assert.deepEqual(inlineMarkup.errors, []);
assert.equal(inlineMarkup.notes[0].text, 'См.: Rippon, A Brief Memoir.');
assert.match(inlineMarkup.html, /gb-note-endnotes__content">См\.: <a href="#source">/);

const authoredLabel = collectAndProjectHtml(`<!doctype html><html><head></head><body><main data-pagefind-body>
<h2 id="source-label">Source label</h2><p><span class="fn-marker" aria-label="Источник: Rippon">1<span class="tooltip">Specific source note.</span></span></p>
</main></body></html>`, route);
assert.deepEqual(authoredLabel.errors, []);
assert.match(authoredLabel.html, /aria-label="Источник: Rippon"/, 'specific authored accessible names must be preserved');

const articleProjection = collectAndProjectHtml(`<!doctype html><html><head></head><body><main>
<article data-pagefind-body><h2 id="section">Section</h2><p>Searchable <span class="fn-marker">1<span class="tooltip">Indexed note.</span></span></p></article>
</main></body></html>`, route);
assert.deepEqual(articleProjection.errors, []);
assert.match(
  articleProjection.html,
  /<article data-pagefind-body>[\s\S]*<\/article>\s*<!--[ ]?NOTE_REGISTRY:START/,
  'endnotes must follow the authored article instead of inheriting route-local clipping'
);
assert.match(
  articleProjection.html,
  /data-note-registry-endnotes[^>]*data-print-policy="include"/,
  'publication endnotes must explicitly opt into physical print output'
);
assert.doesNotMatch(
  articleProjection.html,
  /<article data-pagefind-body>[\s\S]*data-note-registry-endnotes[\s\S]*<\/article>/,
  'endnotes must be a separate Pagefind body'
);

const stableBefore = collectAndProjectHtml(`<!doctype html><html><head></head><body><main>
<h2 id="stable">Stable section</h2><p>Before text <span class="fn-marker">1<span class="tooltip">Stable note.</span></span> after text.</p>
</main></body></html>`, route);
const stableAfter = collectAndProjectHtml(`<!doctype html><html><head></head><body><main>
<h2 id="stable">Renamed visible heading</h2><p>Completely edited surrounding paragraph <span class="fn-marker">9<span class="tooltip">Stable note.</span></span> with a new tail.</p>
</main></body></html>`, route);
assert.deepEqual(stableBefore.errors, []);
assert.deepEqual(stableAfter.errors, []);
assert.equal(stableBefore.notes[0].id, stableAfter.notes[0].id, 'heading anchor and note text must survive surrounding edits and renumbering');

const reordered = collectAndProjectHtml(`<!doctype html><html><head></head><body><main>
<h2 id="beta">Beta</h2><p><span class="fn-marker">2<span class="tooltip">Second note.</span></span></p>
<h2 id="alpha">Alpha</h2><p><span class="fn-marker">1<span class="tooltip">First <em>note</em>.</span></span></p>
</main></body></html>`, route);
assert.deepEqual(reordered.errors, []);
assert.deepEqual(
  reordered.notes.map((note) => note.id).sort(),
  projected.notes.map((note) => note.id).sort(),
  'stable IDs must not depend on document ordinal'
);

const duplicate = collectAndProjectHtml(`<!doctype html><html><head></head><body><main><h2 id="same">Same</h2>
<p><span class="fn-marker">1<span class="tooltip">Same note.</span></span></p>
<p><span class="fn-marker">2<span class="tooltip">Same note.</span></span></p>
</main></body></html>`, route);
assert.match(duplicate.errors.join('\n'), /duplicate stable note id/);

const authoredDuplicate = collectAndProjectHtml(`<!doctype html><html><head></head><body><main><h2 id="same">Same</h2>
<p><span class="fn-marker" data-note-id="fixture-source-a">1<span class="tooltip">Same note.</span></span></p>
<p><span class="fn-marker" data-note-id="fixture-source-b">2<span class="tooltip">Same note.</span></span></p>
</main></body></html>`, route);
assert.deepEqual(authoredDuplicate.errors, []);
assert.deepEqual(authoredDuplicate.notes.map((note) => note.id), ['fixture-source-a', 'fixture-source-b']);

const orphan = collectAndProjectHtml('<html><head></head><body><main><span class="fn-marker">[1]</span></main></body></html>', route);
assert.match(orphan.errors.join('\n'), /expected one direct \.tooltip child, found 0/);
const indirect = collectAndProjectHtml('<html><head></head><body><main><span class="fn-marker"><span><span class="tooltip">Indirect</span></span></span></main></body></html>', route);
assert.match(indirect.errors.join('\n'), /expected one direct \.tooltip child, found 0/);
const ordinal = collectAndProjectHtml('<html><head></head><body><main><span class="fn-marker" data-note-ordinal="7">1<span class="tooltip">Ordinal</span></span></main></body></html>', route);
assert.match(ordinal.errors.join('\n'), /ordinal drift/);
const nested = collectAndProjectHtml('<html><head></head><body><main><span class="fn-marker"><button>bad</button><span class="tooltip">Nested</span></span></main></body></html>', route);
assert.match(nested.errors.join('\n'), /nested interactive control outside tooltip/);
assert.throws(() => collectAndProjectHtml(`${GENERATED_START}<main></main>`, route), /generated block is malformed/);

const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'a03-note-registry-'));
try {
  const file = path.join(dist, 'articles', 'fixture', 'index.html');
  const reportDir = path.join(dist, 'reports');
  const styleSource = path.join(dist, 'note-registry.css');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source, 'utf8');
  fs.writeFileSync(styleSource, fs.readFileSync(path.join(ROOT, 'src', 'runtime', 'note-registry.css')));

  const report = projectNoteRegistry({ distRoot: dist, reportDir, styleSource, sourceCommit: 'fixture' });
  assert.equal(report.registry.routeCount, 1);
  assert.equal(report.registry.noteCount, 2);
  assert.equal(report.registry.identityStrategy, 'authored-data-note-id-or-route-note-heading-hash');
  assert.match(report.registry.stylesheet, /^\/css\/note-registry\.css\?v=[a-f0-9]{8}$/);
  assert.ok(fs.existsSync(path.join(dist, 'data', 'note-registry.json')));
  assert.ok(fs.existsSync(path.join(dist, 'css', 'note-registry.css')));
  assert.ok(fs.existsSync(path.join(reportDir, 'a03-note-registry.json')));
  assert.equal(
    projectNoteRegistry({ distRoot: dist, reportDir, styleSource, dryRun: true, sourceCommit: 'fixture' }).filesChanged,
    0,
    'projected dist must remain idempotent'
  );
} finally {
  fs.rmSync(dist, { recursive: true, force: true });
}

const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'note-registry.schema.json'), 'utf8'));
assert.equal(schema.properties.interactionOwner.const, 'SiteUtils.makeTooltipController');
assert.equal(schema.properties.identityStrategy.const, 'authored-data-note-id-or-route-note-heading-hash');
assert.match(schema.properties.stylesheet.pattern, /note-registry/);
const moduleSource = fs.readFileSync(path.join(ROOT, 'scripts', 'lib', 'note-registry.mjs'), 'utf8');
assert.doesNotMatch(moduleSource, /addEventListener\s*\(/, 'NoteRegistry core must not create a second interaction runtime');
assert.doesNotMatch(moduleSource, /data-note-registry-style>/, 'NoteRegistry core must not inline the complete stylesheet into every route');
const stylesheetSource = fs.readFileSync(path.join(ROOT, 'src', 'runtime', 'note-registry.css'), 'utf8');
assert.match(
  stylesheetSource,
  /html body \[data-print-policy="include"\]\[data-print-terminal-follower\]/,
  'explicit publication print policy must outrank the generic terminal-follower mask'
);
assert.match(stylesheetSource, /display: revert !important;/, 'print-policy override must restore publication descendants');

console.log('✅ A03 NoteRegistry core: stable IDs, distinguishable accessibility, explicit print projection, external stylesheet and unified projections passed');
