#!/usr/bin/env node
/** Synthetic fixtures only: no repository content/registry is rewritten. */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { catalogOptions, catalogReportDirectory, assertCatalogBuildReceipt, verifiedCatalogRoute } from './articles-catalog-coverage.mjs';
import {
  catalogAttribution, catalogDestination, catalogExpectation, assertCatalogHtml,
  assertCatalogDestination, assertBrowserCatalog,
} from './lib/articles-catalog-coverage.mjs';

const OWNER = 'Фёдор Милованов';
const curatedSource = `---
// Synthetic curated source, deliberately different from manifest copy/role.
---
<section id="razbor"><a href="kod-da-vinchi/">
<h2>Код: отдельный редакционный выбор</h2>
<span class="h-meta-author">Автор-редактор: ${OWNER}</span>
<p>Описание кураторской карточки — с пробелами.</p></a></section>`;
const baseItems = [
  { type: 'series', url: '/nagornaya/', title: 'Одинаковое название', description: 'Обзор серии.', editor: OWNER },
  { type: 'series', url: '/nagornaya/seriya/#parts', title: 'Одинаковое название', description: 'Последовательность чтения.', editor: OWNER },
  { type: 'article', url: '/articles/original/', title: 'Начало — продолжение', description: 'Любовь, любовь: слово — слово.', author: OWNER, editor: OWNER },
  { type: 'article', url: '/articles/translation/', title: 'Перевод', description: 'Точный перевод.', author: 'Другой автор', editor: OWNER, translator: OWNER },
  { type: 'article', url: '/articles/kod-da-vinchi/', title: 'Код: название из манифеста', description: 'Описание из манифеста.', editor: OWNER },
  { type: 'article', url: '/articles/site/', title: 'Материал библиотеки', description: 'Без именного byline.' },
];
const labels = {
  '/articles/original/': ['author-editor', `Автор-редактор: ${OWNER}`],
  '/articles/translation/': ['editor', `Ред.: ${OWNER}`],
  '/articles/kod-da-vinchi/': ['editor', `Ред.: ${OWNER}`],
  '/articles/site/': ['site', 'Господь Бог — Сила Моя'],
};
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function card(i) {
  const role = i.type === 'article' ? `<span data-catalog-role="${labels[i.url][0]}">${labels[i.url][1]}</span>` : '';
  return `<a href="${esc(i.url)}" data-catalog-${i.type === 'series' ? 'series' : 'route'}="${esc(i.url)}"><h2>${esc(i.title)}</h2>${role}<p>${esc(i.description)}</p></a>`;
}
function fixture() {
  const manifest = { items: structuredClone(baseItems) };
  const ownership = { routes: Object.fromEntries(baseItems.map((i) => [i.url.split('#')[0], { status: 'production-dist' }])) };
  const expectation = catalogExpectation({ manifest, ownership, curatedSource });
  const html = `<html><body><main><section data-catalog-source="search-manifest+page-ownership"><nav><a href="#topic">Тема</a></nav><h2 id="topic">Рубрика</h2>${baseItems.map(card).join('')}</section>${curatedSource.replace(/^---[\s\S]*?---/, '')}</main></body></html>`;
  return { manifest, ownership, expectation, html };
}
function rejectHtml(name, mutate, pattern) {
  test(name, () => {
    const f = fixture();
    assert.throws(() => assertCatalogHtml(f.expectation, mutate(f.html)), pattern);
  });
}

test('dynamic authority counts; equal series titles retain separate route/fragment intent; curated is a repeat', () => {
  const f = fixture(), result = assertCatalogHtml(f.expectation, f.html);
  assert.deepEqual(result.counts, { article: 4, series: 2 });
  assert.equal(result.published.length, 6);
  assert.equal(result.curated.length, 1);
  assert.equal(result.published.find((r) => r.href === '/articles/kod-da-vinchi/').role.kind, 'editor');
  assert.equal(result.curated[0].role.kind, 'author-editor');
  assert.notEqual(result.curated[0].title, result.published.find((r) => r.href === result.curated[0].href).title);
});
test('new manifest ∩ production series automatically raises the count without a static inventory', () => {
  const f = fixture(), item = { type: 'series', url: '/new-series/', title: 'Новая серия', description: 'Новый обзор.' };
  f.manifest.items.push(item); f.ownership.routes[item.url] = { status: 'production-dist' };
  const e = catalogExpectation({ ...f, curatedSource });
  const html = f.html.replace('</nav>', `</nav>${card(item)}`);
  assert.deepEqual(assertCatalogHtml(e, html).counts, { article: 4, series: 3 });
});
test('manifest-only, ownership-only, nonproduction and non-publication types cannot grant publication', () => {
  const f = fixture();
  f.manifest.items.push({ type: 'article', url: '/draft/', title: 'Черновик' }, { type: 'series', url: '/copy/', title: 'Копия' }, { type: 'tool', url: '/tool/' });
  f.ownership.routes['/copy/'] = { status: 'copy-as-built-asset' };
  f.ownership.routes['/ownership-only/'] = { status: 'production-dist' };
  f.ownership.routes['/tool/'] = { status: 'production-dist' };
  const e = catalogExpectation({ ...f, curatedSource });
  assert.equal(e.published.length, 6); assert.equal(e.excluded.length, 2);
  assertCatalogHtml(e, f.html);
});
for (const where of ['route-status', 'route-gate', 'manifest-gate', 'manifest-status']) test(`PUBLICATION_HOLD veto: ${where}`, () => {
  const f = fixture(), item = { type: 'article', url: '/held/', title: 'Удержано' };
  const owner = { status: 'production-dist' };
  if (where === 'route-status') owner.status = 'PUBLICATION_HOLD';
  if (where === 'route-gate') owner.publicationStatus = 'PUBLICATION_HOLD';
  if (where === 'manifest-gate') item.publicationGate = 'PUBLICATION_HOLD';
  if (where === 'manifest-status') item.publicationStatus = 'PUBLICATION_HOLD';
  f.manifest.items.push(item); f.ownership.routes[item.url] = owner;
  const e = catalogExpectation({ ...f, curatedSource });
  assert.equal(e.published.length, 6); assert.equal(e.excluded.at(-1).reason, 'PUBLICATION_HOLD');
  const injected = f.html.replace('href="/articles/site/" data-catalog-route="/articles/site/"', 'href="/held/" data-catalog-route="/held/"');
  assert.throws(() => assertCatalogHtml(e, injected), /extra\/unpublished\/HOLD/);
});
test('duplicate canonical URLs are errors, not silently deduplicated', () => {
  const f = fixture(); f.manifest.items.push({ ...f.manifest.items[0], title: 'Другое имя' });
  assert.throws(() => catalogExpectation({ ...f, curatedSource }), /Duplicate published destination/);
});
for (const value of ['https://elsewhere.invalid/a/', '//elsewhere.invalid/a/', 'javascript:alert(1)', '/a/?draft=1', '/a', '/a/#', '/a/../b/', '/%2e%2e/b/', '/a%2fb/', '/a%5cb/', '/a%00b/', ' /a/', '/a/\n']) {
  test(`reject invalid/noncanonical URL ${JSON.stringify(value)}`, () => assert.throws(() => catalogDestination(value)));
}
test('native relative curated href resolves honestly, including a destination fragment', () => {
  assert.deepEqual(catalogDestination('kod-da-vinchi/#sources', { relative: true }), { href: '/articles/kod-da-vinchi/#sources', route: '/articles/kod-da-vinchi/', fragment: 'sources' });
});
test('role states do not promote translator/author to editor and preserve author-editor/Ред.', () => {
  for (const [input, expected] of [
    [{ author: OWNER, editor: OWNER }, { kind: 'author-editor', label: `Автор-редактор: ${OWNER}` }],
    [{ author: 'Другой', editor: OWNER, translator: OWNER }, { kind: 'editor', label: `Ред.: ${OWNER}` }],
    [{ author: 'Другой' }, { kind: 'author', label: 'Автор: Другой' }],
    [{ translator: 'Переводчик' }, { kind: 'translator', label: 'Перевод: Переводчик' }],
    [{}, { kind: 'site', label: 'Господь Бог — Сила Моя' }],
  ]) assert.deepEqual(catalogAttribution(input), expected);
  assert.throws(() => catalogAttribution({ author: OWNER }), /missing editor authority/);
  assert.throws(() => catalogAttribution({ translator: OWNER }), /missing editor authority/);
});
rejectHtml('an omitted published card fails', (h) => h.replace(card(baseItems[3]), ''), /card count/);
rejectHtml('duplicated card cannot compensate for omitted destination', (h) => h.replace(card(baseItems[3]), card(baseItems[2])), /Omitted\/duplicated/);
rejectHtml('extra unmarked anchor is not hidden from the membership test', (h) => h.replace('</nav>', '</nav><a href="/unpublished/">Неопубликовано</a>'), /Unmarked\/extra/);
rejectHtml('a matching marker with wrong href fails', (h) => h.replace('href="/articles/site/"', 'href="/unpublished/"'), /actual href differ/);
rejectHtml('a marker on a div is not a native link', (h) => h.replace('<a href="/articles/site/"', '<div href="/articles/site/"').replace(`${esc(baseItems[5].description)}</p></a>`, `${esc(baseItems[5].description)}</p></div>`), /native anchor/);
rejectHtml('wrong publication type fails', (h) => h.replace('data-catalog-route="/articles/site/"', 'data-catalog-series="/articles/site/"'), /wrong-type/);
rejectHtml('both series and article markers on one anchor fail', (h) => h.replace('data-catalog-route="/articles/site/"', 'data-catalog-route="/articles/site/" data-catalog-series="/articles/site/"'), /One publication type/);
rejectHtml('missing title inline separator fails despite all words being present', (h) => h.replace('Начало — продолжение', 'Начало —продолжение'), /title word boundaries/);
rejectHtml('description repetition and order are not treated as an unordered set', (h) => h.replace('Любовь, любовь: слово — слово.', 'Любовь: слово — слово.'), /description word boundaries/);
rejectHtml('omitted description fails', (h) => h.replace('<p>Точный перевод.</p>', ''), /description: expected one/);
rejectHtml('duplicate description fails', (h) => h.replace('<p>Точный перевод.</p>', '<p>Точный перевод.</p><p>Точный перевод.</p>'), /description: expected one/);
rejectHtml('plain owner Автор label is forbidden', (h) => h.replace(`Автор-редактор: ${OWNER}`, `Автор: ${OWNER}`), /forbidden owner-as-author/);
rejectHtml('label drift fails even if role data marker is unchanged', (h) => h.replace(`>Ред.: ${OWNER}<`, `>Редактор: ${OWNER}<`), /attribution text drift/);
rejectHtml('role marker drift fails even if label is unchanged', (h) => h.replace('data-catalog-role="author-editor"', 'data-catalog-role="author"'), /attribution role drift/);
rejectHtml('missing role fails', (h) => h.replace(`<span data-catalog-role="author-editor">Автор-редактор: ${OWNER}</span>`, ''), /missing attribution/);
for (const flag of ['hidden', 'inert', 'aria-hidden="true"', 'aria-disabled="true"', 'style="display:none"', 'style="visibility: hidden !important"', 'style="opacity:0.00"', 'style="content-visibility:hidden"', 'tabindex="-1"', 'role="button"']) {
  rejectHtml(`SSR hidden/non-native link rejected: ${flag}`, (h) => h.replace('href="/articles/site/"', `${flag} href="/articles/site/"`), /hidden|Tab order|native link role/);
}
rejectHtml('hidden exact title text does not satisfy visible integrity', (h) => h.replace('Начало — продолжение', '<span hidden>Начало — продолжение</span>'), /hidden/);
rejectHtml('topic navigation must have a real unique SSR fragment', (h) => h.replace('href="#topic"', 'href="#missing"'), /unique SSR target/);
rejectHtml('curated repeat is preserved rather than deleted as a duplicate', (h) => h.replace(/<section id="razbor">[\s\S]*?<\/section>/, ''), /Curated repeat section/);
rejectHtml('curated source copy is compared separately, not to manifest marketing copy', (h) => h.replace('Код: отдельный редакционный выбор', 'Код: название из манифеста'), /title word boundaries/);
rejectHtml('curated owner role drift fails', (h) => h.replace(`<span class="h-meta-author">Автор-редактор: ${OWNER}</span>`, `<span class="h-meta-author">Ред.: ${OWNER}</span>`), /attribution text drift/);
rejectHtml('curated card cannot be counted as another exhaustive article', (h) => h.replace('href="kod-da-vinchi/"', 'data-catalog-route="/articles/kod-da-vinchi/" href="kod-da-vinchi/"'), /card count/);
test('unpublished curated source cannot create a new publication', () => {
  const f = fixture();
  assert.throws(() => catalogExpectation({ ...f, curatedSource: curatedSource.replace('kod-da-vinchi/', 'held/') }), /curated repeat must reference a published destination/);
});
test('unknown dynamic curated expressions are rejected, never evaluated or silently excluded', () => {
  const f = fixture();
  assert.throws(() => catalogExpectation({ ...f, curatedSource: curatedSource.replace('Код: отдельный редакционный выбор', '{unknown.title}') }), /Unsupported dynamic curated expression/);
});
test('HTML entities and ordinary whitespace collapse are supported without removing word boundaries', () => {
  const f = fixture();
  assertCatalogHtml(f.expectation, f.html.replace('Начало — продолжение', 'Начало\n — &nbsp;продолжение'));
});

const target = catalogDestination('/biografii/#gill');
const okResponse = { status: 200, responsePath: '/biografii/', contentType: 'text/html; charset=utf-8', html: '<section id="gill">Биография</section>' };
test('actual HTTP and real destination fragment pass', () => assert.equal(assertCatalogDestination(target, okResponse).status, 200));
for (const [name, change] of [
  ['404', { status: 404 }], ['redirect', { redirected: true }], ['wrong route', { responsePath: '/404/' }],
  ['non HTML', { contentType: 'application/json' }], ['missing fragment', { html: '<h1>Есть страница, нет якоря</h1>' }],
  ['duplicate fragment', { html: '<i id="gill"></i><b id="gill"></b>' }], ['hidden fragment', { html: '<section id="gill" hidden></section>' }],
]) test(`reject destination ${name}`, () => assert.throws(() => assertCatalogDestination(target, { ...okResponse, ...change })));

function browserFixture() {
  const f = fixture(), snapshot = assertCatalogHtml(f.expectation, f.html);
  const facts = Object.fromEntries(['published', 'curated'].map((scope) => [scope, snapshot[scope].map((r) => ({ ...r, role: r.role?.label ?? null,
    available: true, nativeTabbable: true, titleAvailable: true, descriptionAvailable: true, roleAvailable: true }))]));
  return { snapshot, facts };
}
test('same browser contract applies with and without product JavaScript', () => {
  const { snapshot, facts } = browserFixture(); assert.deepEqual(assertBrowserCatalog(snapshot, facts), { published: 6, curated: 1 });
});
for (const key of ['available', 'nativeTabbable', 'titleAvailable', 'descriptionAvailable', 'roleAvailable']) test(`browser computed ${key} false is rejected`, () => {
  const { snapshot, facts } = browserFixture(); facts.published[0][key] = false;
  assert.throws(() => assertBrowserCatalog(snapshot, facts), /failed/);
});
test('browser omission, text drift and attribution drift are independently rejected', () => {
  for (const mutate of [(f) => f.published.pop(), (f) => { f.published[0].title += '!'; }, (f) => { f.curated[0].role = `Автор: ${OWNER}`; }]) {
    const { snapshot, facts } = browserFixture(); mutate(facts); assert.throws(() => assertBrowserCatalog(snapshot, facts));
  }
});

const validArgs = ['--origin=http://127.0.0.1:4339', `--runtime-sha=${'a'.repeat(40)}`, '--artifact-root=/build/dist', '--provenance=/receipt.json', '--out=reports/g3-editorial-wave/new-report'];
test('CLI pins exact runtime separately from runner and accepts supported unique widths', () => {
  const args = catalogOptions([...validArgs, '--widths=320,390,768,1440']);
  assert.equal(args['runtime-sha'], 'a'.repeat(40)); assert.deepEqual(args.widths, [320, 390, 768, 1440]);
});
for (const [name, transform] of [
  ['missing required input', (a) => a.filter((v) => !v.startsWith('--provenance='))],
  ['branch label', (a) => a.map((v) => v.startsWith('--runtime-sha=') ? '--runtime-sha=main' : v)],
  ['URL credentials', (a) => a.map((v) => v.startsWith('--origin=') ? '--origin=https://name:secret@example.invalid/' : v)],
  ['URL path', (a) => a.map((v) => v.startsWith('--origin=') ? '--origin=https://example.invalid/articles/' : v)],
  ['duplicate widths', (a) => [...a, '--widths=390,390']],
  ['unknown width', (a) => [...a, '--widths=999']],
]) test(`reject CLI ${name}`, () => assert.throws(() => catalogOptions(transform(validArgs))));
test('report output is contained and refuses source/root/escape destinations', () => {
  assert.match(catalogReportDirectory(`reports/g3-editorial-wave/catalog-unused-test-${process.pid}`), /catalog-unused-test-/);
  for (const out of ['/', '/tmp/catalog-out', '.', 'scripts/catalog-out', 'reports/g3-editorial-wave/../../outside']) assert.throws(() => catalogReportDirectory(out));
});
test('receipt rejects mismatched source SHA, build exit, input/artifact bytes and output root', () => {
  const artifact = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-receipt-')));
  try {
    const hash = (b) => createHash('sha256').update(b).digest('hex');
    const sources = Object.fromEntries(['data/search-manifest.json', 'migration/page-ownership.json', 'src/components/articles/ArticlesRefutationsSection.astro'].map((n) => [n, Buffer.from(n)]));
    const html = Buffer.from('<main>Build bytes</main>'), runtimeSha = 'b'.repeat(40);
    const receipt = { runtimeSourceSha: runtimeSha, scope: 'SYNTHETIC_TEST_NOT_A_BUILD', buildExitCode: 0, artifactRoot: artifact, catalogHtmlSha256: hash(html), sourceFiles: Object.fromEntries(Object.entries(sources).map(([n, b]) => [n, hash(b)])) };
    const inputs = { runtimeSha, artifact, html, sources };
    assertCatalogBuildReceipt(receipt, inputs);
    for (const change of [{ runtimeSourceSha: 'c'.repeat(40) }, { buildExitCode: 1 }, { scope: '' }, { artifactRoot: os.tmpdir() }, { catalogHtmlSha256: '0'.repeat(64) }, { sourceFiles: {} }]) {
      assert.throws(() => assertCatalogBuildReceipt({ ...receipt, ...change }, inputs));
    }
  } finally { fs.rmdirSync(artifact); }
});


function assetFixture({ status = 200, body = 'actual HTTP bytes', type = 'stylesheet', url = 'https://candidate.invalid/css/edition.css?v=pin' } = {}) {
  const calls = [], response = { status: () => status, body: async () => Buffer.from(body) };
  const route = { request: () => ({ url: () => url, resourceType: () => type }),
    fetch: async (options) => { calls.push(['fetch', options]); return response; },
    fulfill: async (options) => { calls.push(['fulfill', options]); },
    abort: async () => { calls.push(['abort']); }, continue: async () => { calls.push(['continue']); } };
  const pins = [], options = { origin: 'https://candidate.invalid', readArtifact: (name) => { assert.equal(name, 'css/edition.css'); return Buffer.from('actual HTTP bytes'); }, onPin: (pin) => pins.push(pin) };
  return { route, options, calls, pins };
}
test('asset witness uses bounded API fetch/body BEFORE fulfill, not navigation-sensitive CDP response bodies', async () => {
  const f = assetFixture(); await verifiedCatalogRoute(f.route, f.options);
  assert.deepEqual(f.calls.map((c) => c[0]), ['fetch', 'fulfill']);
  assert.deepEqual(f.calls[0][1], { timeout: 15000, maxRedirects: 0 });
  assert.equal(f.calls[1][1].body.toString(), 'actual HTTP bytes');
  assert.equal(f.pins.length, 1); assert.equal(f.pins[0].url, '/css/edition.css?v=pin');
});
for (const [name, fixtureOptions] of [['body drift', { body: 'wrong artifact' }], ['404', { status: 404 }], ['redirect', { status: 302 }]]) {
  test(`bad HTTP asset ${name} never reaches browser as a verified fulfill`, async () => {
    const f = assetFixture(fixtureOptions); await assert.rejects(() => verifiedCatalogRoute(f.route, f.options));
    assert.equal(f.pins.length, 0); assert.equal(f.calls.some((c) => c[0] === 'fulfill'), false);
  });
}
test('asset request failure/timeout is propagated, not converted to a pin PASS', async () => {
  const f = assetFixture(); f.route.fetch = async () => { throw new Error('synthetic bounded timeout'); };
  await assert.rejects(() => verifiedCatalogRoute(f.route, f.options), /bounded timeout/);
  assert.equal(f.pins.length, 0);
});
test('external analytics are blocked; native document requests are not synthesized by asset pinning', async () => {
  for (const [change, expected] of [[{ url: 'https://external.invalid/analytics.js' }, 'abort'], [{ type: 'document' }, 'continue']]) {
    const f = assetFixture(change); await verifiedCatalogRoute(f.route, f.options);
    assert.deepEqual(f.calls.map((c) => c[0]), [expected]); assert.equal(f.pins.length, 0);
  }
});
