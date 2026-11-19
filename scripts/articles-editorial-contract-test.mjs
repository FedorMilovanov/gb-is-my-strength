import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertCatalogImageBudget, documentMetadata, expectedAttribution, inspectCatalogHtml, parseCatalogArguments, projectCatalog } from './articles-editorial-contract.mjs';

const escape = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const article = { type: 'article', url: '/articles/original/', title: 'Текст «с кавычками» — 30 409 и 31 880', description: 'Точное описание: без потерянного пробела.', image: '/images/original.webp', author: 'Фёдор Милованов', editor: 'Фёдор Милованов', readTime: 23 };
const series = { type: 'series', url: '/biografii/#series', title: 'Серия и сборник', description: 'Полное описание серии.', image: '/images/series.webp', readTime: 42 };
const featured = { ...article, url: '/articles/kod-da-vinchi/', title: 'Код да Винчи' };
const manifest = { items: [article, series, featured, { ...article, url: '/held/' }, { type: 'page', url: '/about/' }] };
const ownership = { routes: { '/articles/original/': { status: 'production-dist' }, '/biografii/': { status: 'production-dist' }, '/articles/kod-da-vinchi/': { status: 'production-dist' }, '/held/': { status: 'draft' } } };
function card(item) {
  const role = expectedAttribution(item);
  return `<li class="h-article-card"><a class="articles-entry" data-catalog-${item.type === 'series' ? 'series' : 'route'}="${item.url}" href="${item.url}"><h3>${escape(item.title)}</h3><div class="h-article-meta">${item.type === 'article' ? `<span data-catalog-role="${role.kind}">${role.label}</span>` : ''}<span class="h-meta-time">${item.readTime} мин</span></div><p class="h-article-abstract">${escape(item.description)}</p></a></li>`;
}
function fixture() {
  return `<!doctype html><html lang="ru"><head><title>Статьи</title><link rel="canonical" href="https://gospod-bog.ru/articles/"><meta property="og:image:alt" content="Библиотека"><meta name="twitter:image:alt" content="Библиотека">${[1, 2, 3, 4].map((i) => `<link rel="preload" as="font" href="/font-${i}.woff2">`).join('')}<script type="application/ld+json">{"@graph":[{"@type":"CollectionPage"},{"@type":"BreadcrumbList"}]}</script><script data-gb-search-bootstrap></script></head><body><a class="skip-link" href="#main-content">Содержание</a><header class="je-masthead"><a href="/articles/" aria-current="page">Статьи</a><button data-journal-theme>Тема</button></header><div id="mobileChromePage"></div><main id="main-content"><h1>Статьи</h1><section data-catalog-source="search-manifest+page-ownership"><p class="articles-count"><strong>2</strong> материала<span>1 серия и сборник</span></p><nav data-catalog-topics><a href="#topic">Другие материалы <span class="articles-topic-count">2</span></a><a href="#catalog-series">Серии и сборники</a></nav><section class="articles-topic" aria-labelledby="topic"><h3 id="topic">Другие материалы</h3>${[article, featured].map(card).join('')}</section><section id="catalog-series">${card(series)}</section></section><ul><li class="h-article-card"><a class="articles-entry" data-catalog-featured-repeat="/articles/kod-da-vinchi/" href="/articles/kod-da-vinchi/"><img src="/images/curated.webp" alt="Иллюстрация рекомендации" width="160" height="108">Редакционный выбор</a></li></ul></main></body></html>`;
}
const inspect = (html = fixture(), options = {}) => inspectCatalogHtml(html, { manifest, ownership, ...options });

test('image budget separates the raw no-JS telemetry pixel from the one rendered cover', () => {
  const cover = { url: 'https://catalog.invalid/images/curated.webp', bytes: 12345 }, pixel = { url: 'https://mc.yandex.ru/watch/123', bytes: 0 };
  assert.deepEqual(assertCatalogImageBudget([pixel, cover], [cover.url]), { content: [cover], telemetry: [pixel] });
});
test('image budget rejects an additional same-origin OG even if a telemetry pixel is present', () => {
  assert.throws(() => assertCatalogImageBudget([{ url: 'https://mc.yandex.ru/watch/123' }, { url: 'https://catalog.invalid/images/curated.webp' }, { url: 'https://catalog.invalid/images/og.webp' }], ['https://catalog.invalid/images/curated.webp']), /fetched an image gallery/);
});
test('image budget never treats an unknown external image as telemetry', () => {
  assert.throws(() => assertCatalogImageBudget([{ url: 'https://api.yandex.net/unknown.webp' }], []), /Unexpected catalog image/);
});
test('image budget rejects a rendered gallery even before its lazy requests', () => {
  assert.throws(() => assertCatalogImageBudget([], ['https://catalog.invalid/a.webp', 'https://catalog.invalid/b.webp']), /rendered an image gallery/);
});
test('published projection is dynamically derived, not a hardcoded live count', () => {
  assert.equal(projectCatalog(manifest, ownership).length, 3);
  assert.equal(projectCatalog({ items: [article] }, ownership).length, 1);
});
test('published fragment series remains a separate valid destination', () => assert.ok(projectCatalog(manifest, ownership).some((i) => i.url === '/biografii/#series')));
test('non-production articles and non-article/series rows are excluded', () => assert.ok(!projectCatalog(manifest, ownership).some((i) => i.url === '/held/' || i.type === 'page')));
for (const key of ['status', 'publicationStatus', 'publicationGate']) {
  test(`explicit manifest ${key} HOLD vetoes production ownership`, () => {
    const held = { ...article, [key]: 'PUBLICATION_HOLD' };
    assert.ok(!projectCatalog({ items: [held, series] }, ownership).some((item) => item.url === held.url));
    assert.throws(() => inspect(fixture(), { manifest: { items: manifest.items.map((item) => item === article ? held : item) } }), /published set/);
  });
  test(`explicit route ${key} HOLD vetoes manifest membership`, () => {
    const heldOwnership = { routes: { ...ownership.routes, [article.url]: { status: 'production-dist', [key]: 'PUBLICATION_HOLD' } } };
    assert.ok(!projectCatalog(manifest, heldOwnership).some((item) => item.url === article.url));
    assert.throws(() => inspect(fixture(), { ownership: heldOwnership }), /published set/);
  });
}
test('empty published projection fails closed', () => assert.throws(() => projectCatalog(manifest, { routes: {} }), /empty published/));
test('duplicate authority routes fail closed', () => assert.throws(() => projectCatalog({ items: [article, article] }, ownership), /Duplicate authority/));
test('external and protocol-relative catalog authority is rejected', () => {
  for (const url of ['https://example.org/', '//example.org/']) assert.throws(() => projectCatalog({ items: [{ ...article, url }] }, ownership), /same-site/);
});
test('no-JS SSR preserves exact membership, words, times and roles without index OG downloads', () => {
  const result = inspect(); assert.equal(result.articles, 2); assert.equal(result.series, 1); assert.equal(result.explicitCuratedRepeats, 1);
});
test('HTML entities are reader text, never literal markup or a separator waiver', () => {
  const mutated = { ...article, title: 'Текст <не тег> & точный пробел' };
  const html = fixture().replace(escape(article.title), escape(mutated.title));
  inspect(html, { manifest: { items: manifest.items.map((i) => i === article ? mutated : i) } });
});
for (const [name, from, to, message] of [
  ['missing article', card(article), '', /published set/],
  ['missing series', card(series), '', /published set/],
  ['duplicate card', card(article), card(article) + card(article), /Duplicate rendered/],
  ['hardcoded article count', '<strong>2</strong>', '<strong>999</strong>', /Dynamic article count drift/],
  ['hardcoded series count', '<span>1 серия', '<span>9 серия', /Dynamic series count drift/],
  ['wrong topic count', 'class="articles-topic-count">2', 'class="articles-topic-count">9', /Dynamic topic count drift/],
  ['mismatched topic label', '<h3 id="topic">Другие материалы', '<h3 id="topic">Чужая рубрика', /projected topic/],
  ['lost semantic card container', 'class="h-article-card"', 'class="lost-container"', /semantic catalog card container/],
  ['legacy href-hotfix class returned', 'class="articles-entry"', 'class="articles-entry h-article-card"', /edition entry class/],
  ['changed source word', escape(article.title), 'Сокращённый текст', /Title drift/],
  ['compressed em-dash word boundary', '— 30 409', '—30 409', /Title drift/],
  ['changed abstract', escape(article.description), 'Другое описание', /Description drift/],
  ['changed href', 'href="/articles/original/"', 'href="/wrong/"', /href mismatch/],
  ['changed catalog kind', 'data-catalog-route="/articles/original/"', 'data-catalog-series="/articles/original/"', /kind changed/],
  ['role label promotion', 'Автор-редактор: Фёдор Милованов', 'Автор: Фёдор Милованов', /Role label drift/],
  ['role kind promotion', 'data-catalog-role="author-editor"', 'data-catalog-role="author"', /Role kind drift/],
  ['time drift', '23 мин', '24 мин', /Reading time drift/],
  ['OG thumbnail returned to index', '<h3>', '<img src="/images/original.webp" alt="" width="160" height="108"><h3>', /must not fetch OG thumbnails/],
  ['CSS-hidden picture returned to index', '<h3>', '<picture hidden><source srcset="/images/original.webp"></picture><h3>', /must not fetch OG thumbnails/],
  ['missing curated image alt', ' alt="Иллюстрация рекомендации"', '', /Curated image alt missing/],
  ['missing curated image dimension', 'width="160"', 'width="0"', /dimensions missing/],
  ['orphan native anchor', 'href="#main-content"', 'href="#missing"', /Orphan native anchor/],
  ['duplicate id', '<h1>', '<h1 id="main-content">', /Duplicate DOM id/],
  ['duplicate masthead', '<header class="je-masthead">', '<header class="je-masthead"><div class="je-masthead"></div>', /selected masthead/],
  ['duplicate theme owner', '<button data-journal-theme>', '<button data-journal-theme></button><button data-journal-theme>', /theme adapter/],
  ['duplicate search owner', '<script data-gb-search-bootstrap>', '<script data-gb-search-bootstrap></script><script data-gb-search-bootstrap>', /search bootstrap/],
  ['legacy nav returned', '<main id="main-content">', '<nav id="hNavbar"></nav><main id="main-content">', /Competing legacy/],
  ['wrong active section', 'href="/articles/" aria-current="page"', 'href="/journal/" aria-current="page"', /Active section/],
  ['extra canonical', '</head>', '<link rel="canonical" href="https://gospod-bog.ru/articles/"></head>', /canonical drift/],
  ['CollectionPage Article OG leakage', '</head>', '<meta property="article:modified_time" content="2026-11-18"></head>', /Article timestamps/],
  ['second CollectionPage', '{"@type":"CollectionPage"}', '{"@type":"CollectionPage"},{"@type":"CollectionPage"}', /CollectionPage owner/],
  ['empty image alt metadata', 'content="Библиотека"', 'content=""', /OG alt missing/],
  ['extra font owner', '</head>', '<link rel="preload" as="font" href="/extra.woff2"></head>', /four selected/],
]) test(`negative: ${name}`, () => assert.throws(() => inspect(fixture().replace(from, to)), message));
test('HOLD route cannot leak through a newly rendered card', () => assert.throws(() => inspect(fixture().replace('</main>', card({ ...article, url: '/held/' }) + '</main>')), /published set/));
test('withdrawn publication cannot survive an authority change', () => assert.throws(() => inspect(fixture(), { ownership: { routes: { ...ownership.routes, '/articles/original/': { status: 'draft' } } } }), /published set/));
test('curated repeat is explicit, not a second exhaustive entry', () => assert.throws(() => inspect(fixture().replace('</main>', '<a class="articles-entry" data-catalog-featured-repeat="/articles/kod-da-vinchi/" href="/articles/kod-da-vinchi/">Ещё раз</a></main>')), /Curated repeat/));
test('role expectations keep author, editor, translator and site distinct', () => {
  assert.deepEqual(expectedAttribution({ author: 'Другой автор' }), { kind: 'author', label: 'Автор: Другой автор' });
  assert.equal(expectedAttribution({ author: 'Абнер Чау', editor: 'Фёдор Милованов', translator: 'Фёдор Милованов' }).kind, 'editor');
  assert.equal(expectedAttribution({ translator: 'Переводчик' }).kind, 'translator');
  assert.equal(expectedAttribution({}).kind, 'site');
  for (const item of [{ author: 'Фёдор Милованов' }, { translator: 'Фёдор Милованов' }]) assert.throws(() => expectedAttribution(item), /editor authority/);
});
test('visual work cannot silently alter SEO fields or schema dates', () => {
  const baseline = fixture();
  assert.deepEqual(documentMetadata(baseline), documentMetadata(baseline.replace('Редакционный выбор', 'Подборка')));
  assert.throws(() => inspect(baseline.replace('<title>Статьи</title>', '<title>Новое название</title>'), { baselineHtml: baseline }), /SEO\/date\/JSON-LD changed/);
});

test('native reading order keeps materials before series, not merely the same set', () => {
  const html = fixture().replace(card(series), '').replace(card(article), card(series) + card(article));
  assert.throws(() => inspect(html), /Materials must precede series/);
});
test('CLI fails closed on unknown, duplicate, missing and malformed options', () => {
  assert.deepEqual(parseCatalogArguments(['--source-only', '--output=reports/test'], ['output'], ['source-only']), { 'source-only': true, output: 'reports/test' });
  for (const argv of [['--source-onyl'], ['--output'], ['--output='], ['--output=a', '--output=b'], ['output=x'], ['--source-only=true']]) assert.throws(() => parseCatalogArguments(argv, ['output'], ['source-only']));
});

test('functional guard mode is explicitly unattributed, not fabricated Gitless integration evidence', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./articles-editorial-contract.mjs', import.meta.url)), '--functional-check', '--source-only'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); const report = JSON.parse(result.stdout);
  assert.equal(report.head, null); assert.equal(report.worktree, null); assert.equal(report.unattributedFunctionalCheck, true); assert.equal(report.exactHeadAcceptance, false);
  assert.equal(report.source.selectedShell, true);
});
test('functional and pinned transfer modes cannot be mixed', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./articles-editorial-contract.mjs', import.meta.url)), '--functional-check', '--source-only', '--transfer=not-used.json'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Do not mix pinned transfer provenance/);
});
