#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const paths = {
  manifest: 'data/diotrophes-wave12-release-manifest.json',
  wave10: 'data/diotrophes-wave10-product-draft.json',
  wave11: 'data/diotrophes-wave11-faithful-witness-manifest.json',
  route: 'src/pages/articles/diotrefy-nashego-vremeni/index.astro',
  body: 'src/components/article-pilots/diotrophes/DiotrophesDraft.astro',
  wrapper: 'src/components/article-pilots/diotrophes/DiotrophesWave11Draft.astro',
  published: 'src/components/article-pilots/diotrophes/DiotrophesPublishedPage.astro',
  head: 'src/components/article-pilots/diotrophes/DiotrophesPageHead.astro',
  profile: 'data/route-profiles/articles-diotrefy-nashego-vremeni.json',
  ownership: 'migration/page-ownership.json',
  matrix: 'migration/route-migration-matrix.json',
  searchPolicy: 'data/route-search-policy.json',
  searchManifest: 'data/search-manifest.json',
  series: 'src/components/article-pilots/_shared/series/pastorSeriesConfig.ts',
  seriesData: 'data/series.json',
  sitemap: 'sitemap.xml',
  feed: 'feed.xml',
};

const errors = [];
const requireValue = (condition, message) => { if (!condition) errors.push(message); };
const text = (path) => existsSync(path) ? readFileSync(path, 'utf8') : '';
const json = (path) => {
  try { return JSON.parse(text(path)); }
  catch (error) { errors.push(`${path}: invalid JSON: ${error.message}`); return {}; }
};

for (const [name, path] of Object.entries(paths)) requireValue(existsSync(path), `${name} missing: ${path}`);

const release = json(paths.manifest);
const wave10 = json(paths.wave10);
const wave11 = json(paths.wave11);
const profile = json(paths.profile);
const ownership = json(paths.ownership);
const matrix = json(paths.matrix);
const searchPolicy = json(paths.searchPolicy);
const searchManifest = json(paths.searchManifest);

const route = release.route;
requireValue(release.authorityId === 'PRODUCT-OSK-WAVE12-PUBLICATION-2026-08-02', 'authority id drift');
requireValue(route === '/articles/diotrefy-nashego-vremeni/', 'route drift');
requireValue(release.status === 'PUBLIC_ROUTE_RELEASED_SOURCE_BOUNDARIES_PRESERVED', 'release status drift');
requireValue(release.researchSnapshot === 'f50b21ad6af5dd7aaa53c5be381929b353b26d58', 'Research snapshot drift');
requireValue(release.counts?.coreCases === 21, 'core case count drift');
requireValue(release.counts?.faithfulPathways === 15, 'pathway count drift');
requireValue(release.counts?.faithfulResponses === 20, 'response count drift');
requireValue(release.counts?.authoritySources === 181, 'authority source count drift');
requireValue(release.counts?.readerLinks === 73, 'reader-link count drift');
requireValue(release.counts?.newDirectQuotesApproved === 0, 'direct quote count must remain zero');
requireValue(Object.values(release.publication ?? {}).every(Boolean), 'all publication gates must be declared required');
requireValue(release.safety?.directQuotesApproved === false, 'direct quotation boundary drift');
requireValue(release.safety?.existingWave10AndWave11EvidenceBytesRemainAuthoritative === true, 'predecessor evidence authority drift');

requireValue(wave10.counts?.researchAuthoritySources === 148, 'Wave 10 authority source count drift');
requireValue(wave10.counts?.approvedDirectQuotes === 0, 'Wave 10 quote boundary drift');
requireValue(wave11.counts?.totalAuthoritySources === 181, 'Wave 11 source count drift');
requireValue(wave11.counts?.totalReaderLinks === 73, 'Wave 11 reader links drift');
requireValue(wave11.directQuotesApproved === false, 'Wave 11 quote boundary drift');

const routeText = text(paths.route);
const bodyText = text(paths.body);
const wrapperText = text(paths.wrapper);
const publishedText = text(paths.published);
const headText = text(paths.head);
const seriesText = text(paths.series);
const seriesDataText = text(paths.seriesData);
const sitemapText = text(paths.sitemap);
const feedText = text(paths.feed);

requireValue(routeText.includes('<DiotrophesPageHead />'), 'route lost canonical head');
requireValue(routeText.includes('<DiotrophesPublishedPage />'), 'route lost published body');
requireValue(routeText.includes('data-gbs2-total-min="102"'), 'series progress total drift');
requireValue(publishedText.includes('data-wave12-publication="true"'), 'Wave 12 publication marker missing');
requireValue(publishedText.includes('<DiotrophesWave11Draft publicationMode={true} />'), 'published wrapper must compose Wave 10 + Wave 11');
requireValue(wrapperText.includes('publicationMode={publicationMode}'), 'publication state is not forwarded');
requireValue(bodyText.includes("publicationMode ? 'Исследовательская статья · Wave 12'"), 'published body state missing');
requireValue(bodyText.includes("!publicationMode &&"), 'Wave 10 hold notice must remain available only in draft mode');
requireValue(!publishedText.includes('<blockquote') && !publishedText.includes('<q'), 'new direct quote markup forbidden');
requireValue(headText.includes(`rel=\"canonical\" href={canonical}`), 'canonical metadata missing');
requireValue(headText.includes('2026-08-02T00:00:00+03:00'), 'publication timestamp missing');
requireValue(headText.includes('index, follow'), 'indexing metadata missing');

requireValue(profile.route === route && profile.currentStatus === 'production-dist', 'route profile drift');
requireValue(profile.source === paths.route, 'route profile source drift');
requireValue(ownership.routes?.[route]?.owner === 'astro', 'page ownership missing');
requireValue(ownership.routes?.[route]?.status === 'production-dist', 'ownership status drift');
requireValue(matrix.routes?.[route]?.mode === 'strict-native', 'migration mode drift');
requireValue(matrix.routes?.[route]?.audits?.includes('diotrophes-wave12-release'), 'release audit absent from migration matrix');

const policy = searchPolicy.routes?.[route];
for (const field of ['indexPolicy','pagefindPolicy','searchManifestPolicy','sitemapPolicy','rssPolicy']) {
  requireValue(policy?.[field] === (field === 'indexPolicy' ? 'index' : 'include'), `search policy ${field} drift`);
}
const searchItem = searchManifest.items?.find((item) => item.url === route);
requireValue(Boolean(searchItem), 'search manifest entry missing');
requireValue(searchItem?.readTime === 35, 'search readTime drift');
requireValue(searchItem?.section === 'Служение', 'search section drift');
requireValue(seriesText.includes("id: 'diotrophes'"), 'series config item missing');
requireValue(seriesText.includes("href: '/articles/diotrefy-nashego-vremeni/'"), 'series route missing');
requireValue(seriesText.includes('readingProgressTotalMin: 102'), 'series total drift');
requireValue(seriesDataText.includes(route), 'data/series.json entry missing');
requireValue(sitemapText.includes(`<loc>https://gospod-bog.ru${route}</loc>`), 'sitemap entry missing');
requireValue(feedText.includes(`<link>https://gospod-bog.ru${route}</link>`), 'RSS entry missing');

for (const forbidden of ['Редакционный черновик · PUBLICATION_HOLD', 'ещё не зарегистрирован как публичный маршрут']) {
  requireValue(!publishedText.includes(forbidden), `published wrapper contains draft claim: ${forbidden}`);
}

if (errors.length) {
  console.error(`❌ Diotrophes Wave 12 release failed (${errors.length})`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log('✅ Diotrophes Wave 12 release passed: public route, 181-source authority, 73 reader links, 0 new direct quotes');
