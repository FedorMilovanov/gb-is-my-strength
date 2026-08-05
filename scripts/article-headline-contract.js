#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');

const ARTICLES = [
  {
    id: '20-antisovetov-pastoru',
    file: 'src/components/article-pilots/antisovetov/AntisovetovPageHead.astro',
    canonicalHeadline: '20 антисоветов, как пастору разрушить своё служение',
    titleSuffix: ' | Господь Бог',
    breadcrumbPosition: 3,
  },
];

function parseAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gs)) {
    attributes[match[1].toLowerCase()] = match[3];
  }
  return attributes;
}

function metaContent(source, attributeName, attributeValue) {
  for (const match of source.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0]);
    if (attributes[attributeName] === attributeValue) return attributes.content || '';
  }
  return '';
}

function pageTitle(source) {
  return source.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
}

function jsonLdDocuments(source) {
  const documents = [];
  for (const match of source.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      documents.push(JSON.parse(match[1]));
    } catch (error) {
      throw new Error(`invalid JSON-LD: ${error.message}`);
    }
  }
  return documents;
}

function graphNodes(documents) {
  return documents.flatMap((document) => {
    if (Array.isArray(document)) return document;
    if (Array.isArray(document?.['@graph'])) return document['@graph'];
    return document && typeof document === 'object' ? [document] : [];
  });
}

function articleHeadline(source) {
  const article = graphNodes(jsonLdDocuments(source)).find((node) => {
    const type = node?.['@type'];
    return type === 'Article' || (Array.isArray(type) && type.includes('Article'));
  });
  return typeof article?.headline === 'string' ? article.headline : '';
}

function breadcrumbName(source, position) {
  const breadcrumb = graphNodes(jsonLdDocuments(source)).find((node) => node?.['@type'] === 'BreadcrumbList');
  const item = Array.isArray(breadcrumb?.itemListElement)
    ? breadcrumb.itemListElement.find((entry) => Number(entry?.position) === Number(position))
    : null;
  return typeof item?.name === 'string' ? item.name : '';
}

function inspect(source, config) {
  return {
    title: pageTitle(source),
    ogTitle: metaContent(source, 'property', 'og:title'),
    twitterTitle: metaContent(source, 'name', 'twitter:title'),
    articleHeadline: articleHeadline(source),
    breadcrumbName: breadcrumbName(source, config.breadcrumbPosition),
  };
}

function validate(source, config) {
  const actual = inspect(source, config);
  const expectedTitle = `${config.canonicalHeadline}${config.titleSuffix}`;
  const errors = [];
  if (actual.title !== expectedTitle) errors.push(`title expected ${JSON.stringify(expectedTitle)}, got ${JSON.stringify(actual.title)}`);
  for (const key of ['ogTitle', 'twitterTitle', 'articleHeadline', 'breadcrumbName']) {
    if (actual[key] !== config.canonicalHeadline) {
      errors.push(`${key} expected ${JSON.stringify(config.canonicalHeadline)}, got ${JSON.stringify(actual[key])}`);
    }
  }
  return { actual, errors };
}

function writeCanonicalTitle(source, config) {
  const expectedTitle = `${config.canonicalHeadline}${config.titleSuffix}`;
  if (!/<title>[\s\S]*?<\/title>/i.test(source)) throw new Error('missing <title>');
  return source.replace(/<title>[\s\S]*?<\/title>/i, `<title>${expectedTitle}</title>`);
}

function assertSelfContract() {
  const config = {
    canonicalHeadline: 'Канонический заголовок',
    titleSuffix: ' | Сайт',
    breadcrumbPosition: 3,
  };
  const fixture = `
<title>Старый заголовок | Сайт</title>
<meta content="Канонический заголовок" property="og:title">
<meta name="twitter:title" content="Канонический заголовок">
<script type="application/ld+json">{"@graph":[{"@type":"Article","headline":"Канонический заголовок"},{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":3,"name":"Канонический заголовок"}]}]}</script>`;
  assert.equal(validate(fixture, config).errors.length, 1, 'fixture must expose title-only drift');
  const fixed = writeCanonicalTitle(fixture, config);
  assert.deepEqual(validate(fixed, config).errors, [], 'writer must repair only the canonical title drift');
  assert.equal(metaContent(fixed, 'property', 'og:title'), config.canonicalHeadline, 'attribute order must not affect metadata parsing');
}

function main() {
  assertSelfContract();
  const failures = [];
  const changed = [];

  for (const config of ARTICLES) {
    const absolute = path.join(ROOT, config.file);
    const source = fs.readFileSync(absolute, 'utf8');
    const next = WRITE ? writeCanonicalTitle(source, config) : source;
    const report = validate(next, config);

    if (report.errors.length) {
      failures.push(...report.errors.map((error) => `${config.id}: ${error}`));
      continue;
    }

    if (WRITE && next !== source) {
      fs.writeFileSync(absolute, next, 'utf8');
      changed.push(config.file);
    }
    console.log(`✅ ${config.id}: title, Open Graph, Twitter, Article and breadcrumb headline agree`);
  }

  if (changed.length) {
    console.log(`✎ Updated canonical titles: ${changed.join(', ')}`);
  }
  if (failures.length) {
    failures.forEach((failure) => console.error(`❌ ${failure}`));
    process.exit(1);
  }
}

main();
