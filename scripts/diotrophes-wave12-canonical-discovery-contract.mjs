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
const text = (path) => existsSync(path) ? readFileSync(path, 'utf8') : '';
const json = (path) => {
  try { return JSON.parse(text(path)); }
  catch (error) { errors.push(`${path}: invalid JSON: ${error.message}`); return {}; }
};
const occurrences = (value, needle) => value.split(needle).length - 1;
const runCheck = (script) => {
  try {
    return execFileSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
  } catch (error) {
    errors.push(`${script} --check failed: ${error.stderr?.toString().trim() || error.message}`);
    return '';
  }
};

for (const [name, path] of Object.entries(paths)) requireValue(existsSync(path), `${name} missing: ${path}`);
const manifest = json(paths.manifest);
const policy = json(paths.policy);
const rootFeed = text(paths.rootFeed);
const rootSitemap = text(paths.rootSitemap);
const seriesFeed = text(paths.seriesFeed);
const seriesSitemap = text(paths.seriesSitemap);
const item = (manifest.items || []).find((candidate) => candidate.url === ROUTE);
const routePolicy = policy.routes?.[ROUTE];

requireValue(Boolean(item), 'search-manifest item missing');
requireValue(item?.id === 'diotrefy-nashego-vremeni', 'search-manifest item ID drift');
requireValue(item?.seriesId === 'pastor-series' && item?.seriesPosition === 2, 'series linkage drift');
requireValue(routePolicy?.sitemapPolicy === 'include', 'sitemap policy must remain include');
requireValue(routePolicy?.rssPolicy === 'include', 'RSS policy must remain include');
requireValue(occurrences(rootSitemap, `<loc>${CANONICAL}</loc>`) === 1, 'canonical root sitemap must contain the route exactly once');
requireValue(occurrences(rootFeed, `<link>${CANONICAL}</link>`) === 1, 'canonical root RSS must contain the route exactly once');
requireValue(occurrences(rootFeed, `<guid isPermaLink="true">${CANONICAL}</guid>`) === 1, 'canonical root RSS GUID must occur exactly once');
requireValue(rootFeed.includes(`<title>${item?.title || ''}</title>`), 'canonical root RSS title does not match search manifest');
requireValue(rootFeed.includes(`<description><![CDATA[${item?.description || ''}]]></description>`), 'canonical root RSS description does not match search manifest');
requireValue(seriesSitemap.includes(`<loc>${CANONICAL}</loc>`), 'series sitemap shard lost the route');
requireValue(seriesFeed.includes(`<link>${CANONICAL}</link>`), 'series RSS shard lost the route');

const expectedLastBuild = new Date(manifest.generatedAt).toUTCString();
requireValue(rootFeed.includes(`<lastBuildDate>${expectedLastBuild}</lastBuildDate>`), `root RSS lastBuildDate drift: expected ${expectedLastBuild}`);
requireValue(!rootFeed.includes('PUBLICATION_HOLD'), 'root RSS leaked publication hold');
requireValue(!rootSitemap.includes('PUBLICATION_HOLD'), 'root sitemap leaked publication hold');

const rssOutput = runCheck(paths.rssNormalizer);
const sitemapOutput = runCheck(paths.sitemapNormalizer);
requireValue(rssOutput.includes('feed.xml exactly matches route policy and search manifest'), 'RSS normalizer success marker missing');
requireValue(sitemapOutput.includes('sitemap.xml contains every route required by policy'), 'sitemap normalizer success marker missing');

if (errors.length) {
  console.error(`❌ Wave 12 canonical discovery failed (${errors.length})`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log('✅ Wave 12 canonical discovery passed: root RSS + root sitemap + series shards + deterministic normalizers');
