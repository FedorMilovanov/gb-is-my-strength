#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const ROOT_COLLECTION_ID = 'https://gospod-bog.ru/nagornaya/#collectionpage';
const SERIES_COLLECTION_ID = 'https://gospod-bog.ru/nagornaya/seriya/#collectionpage';
const ARTICLE_IDS = Array.from({ length: 5 }, (_, index) =>
  `https://gospod-bog.ru/nagornaya/chast-${index + 1}/#article`,
);

const LANDINGS = [
  {
    route: '/nagornaya/',
    source: 'src/components/nagornaya/index/NagornayaIndexPageHead.astro',
    collectionId: ROOT_COLLECTION_ID,
  },
  {
    route: '/nagornaya/seriya/',
    source: 'src/components/nagornaya/seriya/NagornayaSeriyaPageHead.astro',
    collectionId: SERIES_COLLECTION_ID,
  },
];

const ARTICLES = ARTICLE_IDS.map((articleId, index) => ({
  route: `/nagornaya/chast-${index + 1}/`,
  source: `src/components/nagornaya/chast-${index + 1}/NagornayaChast${index + 1}PageHead.astro`,
  articleId,
}));

function fail(message) {
  throw new Error(`NAGORNAYA SCHEMA IDENTITY CONTRACT: ${message}`);
}

function read(relativePath) {
  const file = path.join(ROOT, relativePath);
  if (!fs.existsSync(file)) fail(`missing file: ${relativePath}`);
  return fs.readFileSync(file, 'utf8');
}

function asArray(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function hasType(node, wanted) {
  return Boolean(node && typeof node === 'object' && asArray(node['@type']).includes(wanted));
}

function parseJsonLd(html, label) {
  const matches = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (!matches.length) fail(`${label}: no JSON-LD blocks found`);
  return matches.map((match, index) => {
    const raw = match[1].trim();
    try {
      return JSON.parse(raw);
    } catch (error) {
      fail(`${label}: JSON-LD block ${index + 1} is invalid JSON: ${error.message}`);
    }
  });
}

function graphNodes(blocks) {
  return blocks.flatMap((data) => Array.isArray(data?.['@graph']) ? data['@graph'] : [data]);
}

function walkObjects(value, visit) {
  if (Array.isArray(value)) {
    for (const item of value) walkObjects(item, visit);
    return;
  }
  if (!value || typeof value !== 'object') return;
  visit(value);
  for (const child of Object.values(value)) walkObjects(child, visit);
}

function findNodesById(blocks, id) {
  const found = [];
  for (const block of blocks) {
    walkObjects(block, (node) => {
      if (node['@id'] === id) found.push(node);
    });
  }
  return found;
}

function requireCanonicalMeta(html, route, label) {
  const canonical = `https://gospod-bog.ru${route}`;
  if (!html.includes(`<link rel="canonical" href="${canonical}">`)) {
    fail(`${label}: canonical must remain ${canonical}`);
  }
  if (!/<meta\s+name=["']robots["']\s+content=["'][^"']*\bindex\b[^"']*\bfollow\b[^"']*["']/.test(html)) {
    fail(`${label}: index/follow robots metadata missing`);
  }
}

function requireExactReferences(parts, label) {
  if (!Array.isArray(parts)) fail(`${label}: hasPart must be an array`);
  if (parts.length !== ARTICLE_IDS.length) {
    fail(`${label}: hasPart must contain exactly ${ARTICLE_IDS.length} references`);
  }
  const ids = [];
  for (const [index, part] of parts.entries()) {
    if (!part || typeof part !== 'object' || Array.isArray(part)) {
      fail(`${label}: hasPart[${index}] must be a node reference object`);
    }
    const keys = Object.keys(part).sort();
    if (keys.length !== 1 || keys[0] !== '@id') {
      fail(`${label}: hasPart[${index}] must contain only @id, found ${keys.join(', ') || '(none)'}`);
    }
    ids.push(part['@id']);
  }
  if (JSON.stringify(ids) !== JSON.stringify(ARTICLE_IDS)) {
    fail(`${label}: hasPart Article identity/order drifted`);
  }
}

function requireNoAnonymousArticles(blocks, label) {
  const offenders = [];
  for (const block of blocks) {
    walkObjects(block, (node) => {
      if (hasType(node, 'Article') && !node['@id']) offenders.push(node.url || node.name || '(anonymous Article)');
    });
  }
  if (offenders.length) {
    fail(`${label}: anonymous Article node(s) remain: ${offenders.join(', ')}`);
  }
}

function validateLanding(html, target, label) {
  requireCanonicalMeta(html, target.route, label);
  const blocks = parseJsonLd(html, label);
  const nodes = findNodesById(blocks, target.collectionId);
  if (nodes.length !== 1) {
    fail(`${label}: expected exactly one ${target.collectionId} node, found ${nodes.length}`);
  }
  const collection = nodes[0];
  if (!hasType(collection, 'CollectionPage')) fail(`${label}: collection authority is not CollectionPage`);
  if (collection.url !== `https://gospod-bog.ru${target.route}`) {
    fail(`${label}: CollectionPage.url must match route`);
  }
  requireExactReferences(collection.hasPart, label);
  requireNoAnonymousArticles(blocks, label);
  return { collectionId: target.collectionId, hasPart: collection.hasPart.length };
}

function validateArticle(html, target, label) {
  requireCanonicalMeta(html, target.route, label);
  const blocks = parseJsonLd(html, label);
  const nodes = findNodesById(blocks, target.articleId);
  if (nodes.length !== 1) {
    fail(`${label}: expected exactly one canonical Article ${target.articleId}, found ${nodes.length}`);
  }
  const article = nodes[0];
  if (!hasType(article, 'Article')) fail(`${label}: canonical child node is not Article`);
  if (article.url !== `https://gospod-bog.ru${target.route}`) fail(`${label}: canonical Article.url drifted`);
  if (typeof article.headline !== 'string' || !article.headline.trim()) fail(`${label}: canonical Article.headline missing`);
  if (typeof article.datePublished !== 'string' || !article.datePublished.trim()) fail(`${label}: canonical Article.datePublished missing`);
  if (typeof article.dateModified !== 'string' || !article.dateModified.trim()) fail(`${label}: canonical Article.dateModified missing`);
  if (!article.speakable || !hasType(article.speakable, 'SpeakableSpecification')) {
    fail(`${label}: canonical Article speakable authority missing`);
  }
  if (!article.isPartOf || article.isPartOf['@id'] !== ROOT_COLLECTION_ID) {
    fail(`${label}: canonical Article must remain isPartOf ${ROOT_COLLECTION_ID}`);
  }
  return { articleId: target.articleId, rootCollection: article.isPartOf['@id'] };
}

function distRelativeForRoute(route) {
  const segments = String(route).split('/').filter(Boolean);
  return segments.length ? path.join(...segments, 'index.html') : 'index.html';
}

function validateSource() {
  const result = { landings: {}, articles: {} };
  for (const target of LANDINGS) {
    result.landings[target.route] = validateLanding(read(target.source), target, `source ${target.route}`);
  }
  for (const target of ARTICLES) {
    result.articles[target.route] = validateArticle(read(target.source), target, `source ${target.route}`);
  }
  return result;
}

function validateDist() {
  const distRoot = path.join(ROOT, 'dist');
  if (!fs.existsSync(distRoot)) fail('dist directory missing');
  const result = { landings: {}, articles: {} };
  for (const target of LANDINGS) {
    const relative = distRelativeForRoute(target.route);
    const file = path.join(distRoot, relative);
    if (!fs.existsSync(file)) fail(`dist missing for route ${target.route}: ${relative}`);
    result.landings[target.route] = validateLanding(fs.readFileSync(file, 'utf8'), target, `dist ${target.route}`);
  }
  for (const target of ARTICLES) {
    const relative = distRelativeForRoute(target.route);
    const file = path.join(distRoot, relative);
    if (!fs.existsSync(file)) fail(`dist missing for route ${target.route}: ${relative}`);
    result.articles[target.route] = validateArticle(fs.readFileSync(file, 'utf8'), target, `dist ${target.route}`);
  }
  return result;
}

const output = {
  ok: true,
  rootCollectionId: ROOT_COLLECTION_ID,
  secondaryCollectionId: SERIES_COLLECTION_ID,
  articleIds: ARTICLE_IDS,
  source: validateSource(),
  dist: process.argv.includes('--require-dist') ? validateDist() : null,
};

console.log(JSON.stringify(output, null, 2));
