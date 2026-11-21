#!/usr/bin/env node
/** node --test scripts/journal-integrator-acceptance-test.mjs */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { readingExpectation, assertReadingParity, citationInventory, seedJournalAcceptanceTheme } from './lib/journal-reading-parity.mjs';

const options = { sections: ['reading'] };
const source = (body) => `---\nconst neverEvaluateThis = () => { throw Error('do not evaluate Astro'); };\n---\n<section id="reading">${body}</section>`;
const built = (body) => `<section id="reading">${body}</section>`;
const parity = (a, b, extra = {}) => assertReadingParity(readingExpectation(source(a), { ...options, ...extra }), built(b));

test('joins inline text nodes before whitespace collapse', () => {
  assert.equal(parity('<p>one <strong>two</strong>\n three</p>', '<p>one <strong>two</strong> three</p>').checked, 1);
});
test('detects the selected contract whitespace-removal blind spot', () => {
  const a = '<p>word <strong>two</strong> next</p>', b = '<p>word <strong>two</strong>next</p>';
  assert.equal(a.replace(/\s+/g, ''), b.replace(/\s+/g, ''), 'negative control really defeats all-whitespace removal');
  assert.throws(() => parity(a, b), /word boundaries\/order changed/);
});
test('explicit Astro space literals are real expected separators', () => {
  assert.equal(parity('<p><a href="#a">one</a>{\' \'}two</p>', '<p><a href="#a">one</a> two</p>').checked, 1);
  assert.throws(() => parity('<p><b>one</b>{" "}two</p>', '<p><b>one</b>two</p>'), /word boundaries/);
});
test('NBSP / Unicode grouped numbers normalize to spaces without joining words', () => {
  parity('<p>1 061 800 долларов</p>', '<p>1&#160;061&#8239;800 долларов</p>');
});
test('entities decode once and inline comments do not create separators', () => {
  parity('<p>A &amp; B<!-- no invented space -->.</p>', '<p>A &amp; B.</p>');
  assert.throws(() => parity('<p>A &amp; B.</p>', '<p>A &amp;amp; B.</p>'));
});
test('order is checked, not unordered paragraph membership', () => {
  assert.throws(() => parity('<p>first</p><p>second</p>', '<p>second</p><p>first</p>'), /word boundaries\/order/);
});
test('multiplicity is checked even if duplicate text still includes the expected paragraph', () => {
  assert.throws(() => parity('<p>same</p><p>same</p>', '<p>same</p>'), /count changed/);
  assert.throws(() => parity('<p>first</p><p>second</p>', '<p>first</p><p>first</p>'), /word boundaries\/order/);
});
test('an additional rendered paragraph fails', () => {
  assert.throws(() => parity('<p>one</p>', '<p>one</p><p>extra</p>'), /count changed/);
});
test('empty paragraphs do not shift real reading indices', () => {
  assert.equal(parity('<p> </p><p>one</p><p>two</p>', '<p>one</p><p> </p><p>two</p>').checked, 2);
});
test('generated figure UI does not masquerade as a missing source-owned reading paragraph', () => {
  assert.equal(parity('<p>reading</p><JournalDataFigure />', '<p>reading</p><figure><p>Generated unit</p></figure>').checked, 1);
});
test('missing or duplicate source/rendered section fails closed', () => {
  assert.throws(() => readingExpectation('---\n---\n<p>x</p>', options), /source section/);
  assert.throws(() => readingExpectation(source('<p>x</p>') + '<section id="reading"><p>x</p></section>', options), /source section/);
  const e = readingExpectation(source('<p>x</p>'), options);
  assert.throws(() => assertReadingParity(e, '<p>x</p>'), /rendered section/);
  assert.throws(() => assertReadingParity(e, built('<p>x</p>') + built('<p>x</p>')), /rendered section/);
});
test('unknown dynamic paragraphs are explicitly reported, not evaluated or called literal PASS', () => {
  const e = readingExpectation(source('<p>literal</p><p>{neverEvaluateThis()}</p>'), options);
  const r = assertReadingParity(e, built('<p>literal</p><p>rendered slot</p>'));
  assert.equal(r.checked, 1); assert.equal(r.excluded.length, 1);
  assert.equal(r.excluded[0].index, 1);
  assert.throws(() => readingExpectation(source('<p>{unknown}</p>'), options), /no literal reading/);
});
test('explicit plain-text expression projections preserve position and number boundaries', () => {
  const a = '<p>Above by <b>{formatNumber(financeDeltas[0].value)} dollars</b>{\' \'}today.</p>';
  const extra = { expressions: { 'formatNumber(financeDeltas[0].value)': '1\u00a0061\u00a0800' } };
  assert.equal(parity(a, '<p>Above by <b>1 061 800 dollars</b> today.</p>', extra).checked, 1);
  assert.throws(() => parity(a, '<p>Above by <b>1 061 800 dollars</b>today.</p>', extra), /word boundaries/);
});
test('expression values cannot introduce HTML or another dynamic expression', () => {
  for (const value of ['<b>bad</b>', '{other}', 'a>b']) assert.throws(() => readingExpectation(source('<p>x</p>'), { ...options, expressions: { value: value } }), /plain text/);
});

const sourceIds = ['src-G3-S001', 'src-G3-S002'];
const citationHTML = () => `<main data-journal-source-navigation>
<details data-journal-contents><summary>Contents</summary><nav><a href="#documents">Method</a></nav></details>
<section id="documents" tabindex="-1"><p>Method.</p></section>
<a id="cite-first" data-journal-citation href="#src-G3-S001">first citation</a>
<a id="cite-repeat" data-journal-citation href="#src-G3-S001">repeat citation</a>
<ol>${sourceIds.map((id) => `<li id="${id}" class="bibliography-item" tabindex="-1"><h3>Source</h3><a data-journal-source-return data-pagefind-ignore href="#documents">Method</a></li>`).join('')}</ol>
</main>`;
const inventory = (html = citationHTML()) => citationInventory(html, { expectedSources: sourceIds });
test('inventory preserves all citations including repeated source uses and honest SSR fallbacks', () => {
  const r = inventory(); assert.equal(r.citations.length, 2); assert.equal(r.sources.length, 2);
  assert.equal(r.citations[0].href, r.citations[1].href); assert.notEqual(r.citations[0].id, r.citations[1].id);
});
test('missing stable ID or adapter marker fails', () => {
  assert.throws(() => inventory(citationHTML().replace('id="cite-first"', '')), /Stable SSR/);
  assert.throws(() => inventory(citationHTML().replace(' data-journal-citation', '')), /one adapter/);
});
test('unknown citation source / duplicate IDs / missing approved source fail', () => {
  assert.throws(() => inventory(citationHTML().replace('href="#src-G3-S001"', 'href="#src-G3-S999"')), /approved source/);
  assert.throws(() => inventory(citationHTML().replace('id="cite-repeat"', 'id="cite-first"')), /Duplicate DOM/);
  assert.throws(() => inventory(citationHTML().replace('id="src-G3-S002"', 'id="other"')), /bibliography targets/);
});
test('a second source return control or second navigation owner fails', () => {
  assert.throws(() => inventory(citationHTML().replace('</li>', '<a data-journal-source-return href="#documents">second</a></li>')), /One existing return/);
  assert.throws(() => inventory(citationHTML() + '<main data-journal-source-navigation></main>'), /One source-navigation/);
});
test('wrong SSR fallback, un-focusable source or search pollution fails', () => {
  assert.throws(() => inventory(citationHTML().replace('data-pagefind-ignore href="#documents"', 'data-pagefind-ignore href="#cite-first"')), /honest/);
  assert.throws(() => inventory(citationHTML().replace('class="bibliography-item" tabindex="-1"', 'class="bibliography-item"')), /focus target/);
  assert.throws(() => inventory(citationHTML().replace(' data-pagefind-ignore', '')), /pollute search/);
});
test('second TOC owner / non-native TOC / broken TOC target fails', () => {
  assert.throws(() => inventory(citationHTML() + '<details data-journal-contents></details>'), /One native contents/);
  assert.throws(() => inventory(citationHTML().replace('<details data-journal-contents>', '<div data-journal-contents>').replace('</details>', '</div>')), /native TOC/);
  assert.throws(() => inventory(citationHTML().replace('href="#documents">Method</a></nav>', 'href="#missing">Method</a></nav>')), /Broken TOC/);
});

test('theme init skips opaque/foreign documents without hiding matching-origin storage errors', () => {
  const code = `(${seedJournalAcceptanceTheme.toString()})(payload)`;
  const payload = { origin: 'https://preview.example', theme: 'dark' };
  for (const location of [{ protocol: 'about:', origin: 'null' }, { protocol: 'about:', origin: payload.origin }, { protocol: 'https:', origin: 'https://other.example' }]) {
    runInNewContext(code, { payload, location, get localStorage() { throw Error('storage must not be touched'); } });
  }
  const writes = [];
  runInNewContext(code, { payload, location: { protocol: 'https:', origin: payload.origin }, localStorage: { setItem: (key, value) => writes.push([key, value]) } });
  assert.deepEqual(writes, [['theme', 'dark'], ['gb:reader-preferences:v1', '{"version":1,"theme":"dark"}']]);
  assert.throws(() => runInNewContext(code, { payload, location: { protocol: 'https:', origin: payload.origin }, localStorage: { setItem() { throw Error('real storage denial'); } } }), /real storage denial/);
});

test('CLI rejects unknown flags instead of silently dropping a requested check', () => {
  const runner = fileURLToPath(new URL('./journal-integrator-acceptance.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [runner, '--unknown=true'], { encoding: 'utf8', timeout: 3000 });
  assert.ifError(result.error); assert.notEqual(result.status, 0); assert.match(result.stderr, /Unknown option/);
});
test('CLI output containment reaches normalized repo root without an infinite dirname loop', () => {
  const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
  const temporary = fs.mkdtempSync(path.join(tmpdir(), 'journal-acceptance-unit-'));
  const out = `reports/g3-editorial-wave/unit-integrator-cli-${process.pid}`;
  assert.ok(!fs.existsSync(path.join(root, out)));
  try {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const receipt = path.join(temporary, 'receipt.json');
    fs.writeFileSync(receipt, JSON.stringify({ runtimeSourceSha: head, scope: 'UNIT_INCOMPLETE_ARTIFACT' }));
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/journal-integrator-acceptance.mjs'), '--origin=http://127.0.0.1:1', `--runtime-sha=${head}`, `--artifact-root=${temporary}`, `--provenance=${receipt}`, `--out=${out}`], { cwd: root, encoding: 'utf8', timeout: 3000 });
    assert.ifError(result.error); assert.notEqual(result.status, 0, 'incomplete artifact must not PASS');
    assert.ok(fs.existsSync(path.join(root, out)), 'containment reached output creation before expected missing-artifact failure');
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
    fs.rmSync(path.join(root, out), { recursive: true, force: true });
  }
});
