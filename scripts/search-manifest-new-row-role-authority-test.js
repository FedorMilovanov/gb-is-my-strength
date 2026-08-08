#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const { buildManifestItem } = require('./search-manifest-policy-normalizer');

const basePolicy = {
  indexPolicy: 'index',
  pagefindPolicy: 'include',
  searchManifestPolicy: 'include',
  sitemapPolicy: 'include',
  rssPolicy: 'include',
  contentKind: 'article',
  librarySection: 'Богословие',
  topicCategory: 'Тест',
};

const ordinaryHtml = `<!doctype html><html><head>
<title>Обычная статья | Господь Бог — Сила Моя</title>
<meta property="og:title" content="Обычная статья">
<meta name="description" content="Обычная авторская статья">
<meta name="author" content="Автор, не редактор">
<meta property="article:author" content="Автор, не редактор">
<meta property="article:section" content="Богословие">
<meta property="article:published_time" content="2026-08-08T00:00:00+03:00">
<meta property="article:modified_time" content="2026-08-08T01:00:00+03:00">
<meta property="og:image" content="https://gospod-bog.ru/images/ordinary-role-fixture.webp">
<script type="application/ld+json">{
  "@context": "https://schema.org",
  "@type": "Article",
  "author": {"@type": "Person", "name": "Автор, не редактор"}
}</script>
<script>window.SITE_CONFIG={page:{readingTime: 11}}</script>
</head><body></body></html>`;

const ordinary = buildManifestItem('/articles/ordinary-role-fixture/', basePolicy, ordinaryHtml);
assert.equal(ordinary.author, 'Автор, не редактор');
assert.equal(Object.hasOwn(ordinary, 'editor'), false, 'author must not be relabelled as editor');
assert.equal(Object.hasOwn(ordinary, 'translator'), false);

const metaOnlyHtml = ordinaryHtml.replace(
  /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
  '<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage"}</script>'
);
const metaOnly = buildManifestItem('/articles/meta-only-role-fixture/', basePolicy, metaOnlyHtml);
assert.equal(Object.hasOwn(metaOnly, 'author'), false, 'meta author must not assign author without structured Article role authority');
assert.equal(Object.hasOwn(metaOnly, 'editor'), false, 'meta author must never assign editor authority');
assert.equal(Object.hasOwn(metaOnly, 'translator'), false);

const translationHtml = `<!doctype html><html><head>
<title>Перевод | Господь Бог — Сила Моя</title>
<meta property="og:title" content="Переводной материал">
<meta name="description" content="Перевод академической статьи">
<meta name="author" content="Абнер Чау">
<meta property="article:author" content="Абнер Чау">
<meta name="translator" content="Фёдор Милованов">
<meta property="article:section" content="Герменевтика">
<meta property="article:published_time" content="2016-09-01T00:00:00+03:00">
<meta property="article:modified_time" content="2026-07-09T02:34:58+03:00">
<meta property="article:tag" content="герменевтика">
<meta property="og:image" content="https://gospod-bog.ru/images/translation-role-fixture.webp">
<script type="application/ld+json">{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ScholarlyArticle",
      "author": {"@type": "Person", "name": "Abner Chou"},
      "translator": {
        "@id": "https://gospod-bog.ru/about/#person",
        "@type": "Person",
        "name": "Фёдор Милованов"
      },
      "editor": {"@id": "https://gospod-bog.ru/about/#person"}
    }
  ]
}</script>
<script>window.SITE_CONFIG={page:{readingTime: 50}}</script>
</head><body></body></html>`;

const translationPolicy = {
  ...basePolicy,
  contentKind: 'translation',
  librarySection: 'Переводы',
};
const translation = buildManifestItem(
  '/articles/translation-role-fixture/',
  translationPolicy,
  translationHtml
);
assert.equal(translation.author, 'Абнер Чау');
assert.equal(translation.translator, 'Фёдор Милованов');
assert.equal(translation.editor, 'Фёдор Милованов');
assert.notEqual(translation.author, translation.editor);

console.log('✅ search manifest new-row role authority');
