#!/usr/bin/env node
/** Canonical root discovery contract for the Diotrophes Wave 12 route. */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const ROUTE = '/articles/diotrefy-nashego-vremeni/';
const CANONICAL = `https://gospod-bog.ru${ROUTE}`;
const paths = {
  manifest: 'data/search-manifest.json',
  policy: 'data/route-search-policy.json',
  rootFeed: 'feed.xml',
  rootSitemap: 'sitemap.xml',
  seriesFeed: 'feed-pastor-series.xml',
  seriesSitemap: 'sitemap-pastor-series.xml',
  rssNormalizer: 'scripts/rss-feed-normalizer.js',
  sitemapNormalizer: 'scripts/sitemap-policy-normalizer.js',
};

const errors = [];
const requireValue = (condition, message) => { if (!condition) errors.push(message); };
const text = (file) => existsSync(file) ? readFileSync(file, 'utf8') : '';
const json = (file) => {
  try { return JSON.parse(text(file)); }
  catch (error) { errors.push(`${file}: invalid JSON: ${error.message}`); return {}; }
};
const occurrences = (value, needle) => value.split(needle).length - 1;
const xmlEscape = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');
const cdata = (value) => String(value ?? '').replace(/]]>/g, ']]]]><![CDATA[>');
const blockContaining = (xml, tag, needle) => {
  const pattern = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'g');
  return [...String(xml).matchAll(pattern)]
    .map((match) => match[0])
    .filter((block) => block.includes(needle));
};
const runCheck = (script) => {
  try {
    const stdout = execFileSync(process.execPath, [script, '--check'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024,
    });
    return { ok: true, stdout };
  } catch (error) {
    const stderr = error.stderr?.toString().trim();
    const stdout = error.stdout?.toString().trim();
    errors.push(`${script} --check failed: ${stderr || stdout || error.message}`);
    return { ok: false, stdout: stdout || '' };
  }
};

for (const [name, file] of Object.entries(paths)) {
  requireValue(existsSync(file), `${name} missing: ${file}`);
}

const manifest = json(paths.manifest);
const policy = json(paths.policy);
const rootFeedBefore = text(paths.rootFeed);
const rootSitemapBefore = text(paths.rootSitemap);
const seriesFeed = text(paths.seriesFeed);
const seriesSitemap = text(paths.seriesSitemap);
const item = (manifest.items || []).find((candidate) => candidate.url === ROUTE);
const routePolicy = policy.routes?.[ROUTE];

requireValue(Boolean(item), 'search-manifest item missing');
requireValue(item?.id === 'diotrefy-nashego-vremeni', 'search-manifest item ID drift');
requireValue(item?.type === 'article', 'search-manifest item type drift');
requireValue(item?.seriesId === 'pastor-series' && item?.seriesPosition === 2, 'series linkage drift');
for (const field of ['indexPolicy', 'pagefindPolicy', 'searchManifestPolicy', 'sitemapPolicy', 'rssPolicy']) {
  const expected = field === 'indexPolicy' ? 'index' : 'include';
  requireValue(routePolicy?.[field] === expected, `${field} must remain ${expected}`);
}

const rootSitemapBlocks = blockContaining(rootSitemapBefore, 'url', `<loc>${CANONICAL}</loc>`);
const rootFeedBlocks = blockContaining(rootFeedBefore, 'item', `<link>${CANONICAL}</link>`);
const seriesSitemapBlocks = blockContaining(seriesSitemap, 'url', `<loc>${CANONICAL}</loc>`);
const seriesFeedBlocks = blockContaining(seriesFeed, 'item', `<link>${CANONICAL}</link>`);

requireValue(rootSitemapBlocks.length === 1, 'canonical root sitemap must contain exactly one route block');
requireValue(rootFeedBlocks.length === 1, 'canonical root RSS must contain exactly one route item');
requireValue(seriesSitemapBlocks.length === 1, 'series sitemap shard must contain exactly one route block');
requireValue(seriesFeedBlocks.length === 1, 'series RSS shard must contain exactly one route item');

const rootSitemapBlock = rootSitemapBlocks[0] || '';
const rootFeedBlock = rootFeedBlocks[0] || '';
const expectedModified = new Date(item?.modifiedTime || item?.publishedTime || '').toISOString();
const expectedPublished = new Date(item?.publishedTime || '').toUTCString();
const expectedCreator = String(item?.author || item?.editor || manifest?.project?.curator || '').trim();

requireValue(rootSitemapBlock.includes(`<lastmod>${expectedModified}</lastmod>`), 'canonical root sitemap lastmod does not match search manifest');
requireValue(rootSitemapBlock.includes('<priority>0.85</priority>'), 'canonical root sitemap article priority drift');
requireValue(rootFeedBlock.includes(`<guid isPermaLink="true">${CANONICAL}</guid>`), 'canonical root RSS GUID drift');
requireValue(rootFeedBlock.includes(`<title>${xmlEscape(item?.title || '')}</title>`), 'canonical root RSS title does not match search manifest');
requireValue(rootFeedBlock.includes(`<pubDate>${expectedPublished}</pubDate>`), 'canonical root RSS pubDate does not match search manifest');
requireValue(rootFeedBlock.includes(`<dc:creator>${xmlEscape(expectedCreator)}</dc:creator>`), 'canonical root RSS creator does not match search manifest');
requireValue(rootFeedBlock.includes(`<category>${xmlEscape(item?.section || '')}</category>`), 'canonical root RSS category does not match search manifest');
requireValue(rootFeedBlock.includes(`<description><![CDATA[${cdata(item?.description || '')}]]></description>`), 'canonical root RSS description does not match search manifest');

const expectedLastBuild = new Date(manifest.generatedAt).toUTCString();
requireValue(rootFeedBefore.includes(`<lastBuildDate>${expectedLastBuild}</lastBuildDate>`), `root RSS lastBuildDate drift: expected ${expectedLastBuild}`);
for (const [label, value] of [
  ['root RSS', rootFeedBefore],
  ['root sitemap', rootSitemapBefore],
  ['series RSS', seriesFeed],
  ['series sitemap', seriesSitemap],
]) {
  requireValue(!value.includes('PUBLICATION_HOLD'), `${label} leaked publication hold`);
}

const rssCheck = runCheck(paths.rssNormalizer);
const sitemapCheck = runCheck(paths.sitemapNormalizer);
requireValue(rssCheck.ok, 'RSS normalizer did not complete successfully');
requireValue(sitemapCheck.ok, 'sitemap normalizer did not complete successfully');
requireValue(text(paths.rootFeed) === rootFeedBefore, 'RSS normalizer --check mutated feed.xml');
requireValue(text(paths.rootSitemap) === rootSitemapBefore, 'sitemap normalizer --check mutated sitemap.xml');

if (errors.length) {
  console.error(`❌ Wave 12 canonical discovery failed (${errors.length})`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log('✅ Wave 12 canonical discovery passed: exact root RSS/sitemap fields, exact series shards, successful immutable normalizer checks');
