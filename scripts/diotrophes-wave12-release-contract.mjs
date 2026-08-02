#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const PRE_WAVE12 = '2273b8c930eebf383d429b917d3636bc28a80bae';
const ROUTE = '/articles/diotrefy-nashego-vremeni/';
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
  sitemap: 'sitemap-pastor-series.xml',
  feed: 'feed-pastor-series.xml',
  robots: 'robots.txt',
  catalog: 'src/components/articles/ArticlesPublicationsSection.astro',
  seriesLanding: 'src/components/pastor-series/PastorSeriesCardsSection.astro',
  seriesHead: 'src/components/pastor-series/PastorSeriesPageHead.astro',
  report: 'research/WAVE12_DIOTROPHES_PUBLICATION_2026-08-02.md',
};

const errors = [];
const requireValue = (condition, message) => { if (!condition) errors.push(message); };
const text = (path) => existsSync(path) ? readFileSync(path, 'utf8') : '';
const json = (path) => {
  try { return JSON.parse(text(path)); }
  catch (error) { errors.push(`${path}: invalid JSON: ${error.message}`); return {}; }
};
const gitShow = (path) => {
  try {
    return execFileSync('git', ['show', `${PRE_WAVE12}:${path}`], { encoding: 'utf8' });
  } catch (error) {
    errors.push(`cannot read ${path} at pre-Wave12 ${PRE_WAVE12}: ${error.stderr?.toString().trim() || error.message}`);
    return '';
  }
};
const gitShowJson = (path) => {
  try { return JSON.parse(gitShow(path)); }
  catch (error) { errors.push(`${path} at ${PRE_WAVE12}: invalid JSON: ${error.message}`); return {}; }
};
const preserveKeys = (before, after, label) => {
  for (const key of Object.keys(before ?? {})) requireValue(Object.hasOwn(after ?? {}, key), `${label}: pre-Wave12 key disappeared: ${key}`);
};
const hrefs = (value) => new Set([...value.matchAll(/\bhref=["']([^"']+)["']/g)].map((match) => match[1]));

for (const [name, path] of Object.entries(paths)) requireValue(existsSync(path), `${name} missing: ${path}`);

const release = json(paths.manifest);
const wave10 = json(paths.wave10);
const wave11 = json(paths.wave11);
const profile = json(paths.profile);
const ownership = json(paths.ownership);
const matrix = json(paths.matrix);
const searchPolicy = json(paths.searchPolicy);
const searchManifest = json(paths.searchManifest);
const seriesData = json(paths.seriesData);

requireValue(release.authorityId === 'PRODUCT-OSK-WAVE12-PUBLICATION-2026-08-02', 'authority id drift');
requireValue(release.route === ROUTE, 'route drift');
requireValue(release.status === 'PUBLIC_ROUTE_RELEASED_SOURCE_BOUNDARIES_PRESERVED', 'release status drift');
requireValue(release.researchSnapshot === 'f50b21ad6af5dd7aaa53c5be381929b353b26d58', 'Research snapshot drift');
requireValue(release.productBaseSha === PRE_WAVE12, 'pre-Wave12 Product base drift');
requireValue(release.predecessorAuthorityIds?.includes('PRODUCT-OSK-WAVE10-DRAFT-2026-08-01'), 'Wave 10 predecessor missing');
requireValue(release.predecessorAuthorityIds?.includes('PRODUCT-OSK-WAVE11-FAITHFUL-WITNESS-2026-08-01'), 'Wave 11 predecessor missing');
for (const [key, expected] of Object.entries({ coreCases:21, faithfulPathways:15, faithfulResponses:20, authoritySources:181, readerLinks:73, newDirectQuotesApproved:0 })) {
  requireValue(release.counts?.[key] === expected, `${key} count drift: ${release.counts?.[key]} != ${expected}`);
}
requireValue(Object.values(release.publication ?? {}).every(Boolean), 'all declared publication gates must be true');
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
const sitemapText = text(paths.sitemap);
const feedText = text(paths.feed);
const robotsText = text(paths.robots);
const catalogText = text(paths.catalog);
const seriesLandingText = text(paths.seriesLanding);
const seriesHeadText = text(paths.seriesHead);
const reportText = text(paths.report);

requireValue(routeText.includes('<DiotrophesPageHead />'), 'route lost canonical head');
requireValue(routeText.includes('<DiotrophesPublishedPage />'), 'route lost published body');
requireValue(routeText.includes('data-pagefind-body'), 'Pagefind body marker missing');
requireValue(routeText.includes('data-wave12-publication="true"'), 'route publication marker missing');
requireValue(routeText.includes('data-gbs2-total-min="102"'), 'series progress total drift');
requireValue(publishedText.includes('<DiotrophesWave11Draft publicationMode={true} />'), 'published page must compose Wave 10 + Wave 11');
requireValue(wrapperText.includes('publicationMode={publicationMode}'), 'publication state is not forwarded');
requireValue(bodyText.includes("publicationMode ? 'Исследовательская статья · Wave 12'"), 'published body state missing');
requireValue(bodyText.includes('!publicationMode &&'), 'historic Wave 10 hold notice must remain draft-only');
requireValue(!publishedText.includes('<blockquote') && !publishedText.includes('<q'), 'new direct quote markup forbidden');
requireValue(headText.includes('rel="canonical" href={canonical}'), 'canonical metadata missing');
requireValue(headText.includes('feed-pastor-series.xml'), 'article does not advertise series RSS');
requireValue(headText.includes('2026-08-02T00:00:00+03:00'), 'publication timestamp missing');
requireValue(headText.includes('index, follow'), 'indexing metadata missing');

requireValue(profile.route === ROUTE && profile.currentStatus === 'production-dist', 'route profile drift');
requireValue(profile.source === paths.route, 'route profile source drift');
requireValue(ownership.routes?.[ROUTE]?.owner === 'astro', 'page ownership missing');
requireValue(ownership.routes?.[ROUTE]?.status === 'production-dist', 'ownership status drift');
requireValue(matrix.routes?.[ROUTE]?.mode === 'strict-native', 'migration mode drift');
requireValue(matrix.routes?.[ROUTE]?.audits?.includes('diotrophes-wave12-release'), 'release audit absent from migration matrix');

const policy = searchPolicy.routes?.[ROUTE];
for (const field of ['indexPolicy','pagefindPolicy','searchManifestPolicy','sitemapPolicy','rssPolicy']) {
  requireValue(policy?.[field] === (field === 'indexPolicy' ? 'index' : 'include'), `search policy ${field} drift`);
}
const searchItems = searchManifest.items ?? [];
const searchItem = searchItems.find((item) => item.url === ROUTE);
requireValue(Boolean(searchItem), 'search manifest entry missing');
requireValue(searchItem?.readTime === 35, 'search readTime drift');
requireValue(searchItem?.section === 'Служение', 'search section drift');
requireValue(searchItem?.seriesId === 'pastor-series' && searchItem?.seriesPosition === 2, 'search series linkage drift');
requireValue(seriesText.includes("id: 'diotrophes'"), 'reader series item missing');
requireValue(seriesText.includes(`href: '${ROUTE}'`), 'reader series route missing');
requireValue(seriesText.includes('readingProgressTotalMin: 102'), 'reader series total drift');
requireValue(seriesData['pastor-series']?.parts?.some((part) => part.slug === 'diotrefy-nashego-vremeni' && part.status === 'published'), 'data/series.json Part II missing');
requireValue(sitemapText.includes(`<loc>https://gospod-bog.ru${ROUTE}</loc>`), 'series sitemap entry missing');
requireValue(feedText.includes(`<link>https://gospod-bog.ru${ROUTE}</link>`), 'series RSS entry missing');
requireValue(robotsText.includes('Sitemap: https://gospod-bog.ru/sitemap-pastor-series.xml'), 'robots does not advertise sitemap shard');
requireValue(catalogText.includes('data-wave12-catalog-card="true"') && catalogText.includes('diotrefy-nashego-vremeni/'), 'articles catalog card missing');
requireValue(seriesLandingText.includes('data-wave12-series-card="true"') && seriesLandingText.includes('Часть II · 35 мин'), 'series landing Part II missing');
requireValue(seriesHeadText.includes('numberOfItems: 2') && seriesHeadText.includes('diotrefy-nashego-vremeni'), 'series structured data drift');
requireValue(seriesHeadText.includes('feed-pastor-series.xml'), 'series landing does not advertise RSS shard');

// Fail closed if manual registry edits removed any pre-existing route, item or series part.
const previousOwnership = gitShowJson(paths.ownership);
const previousMatrix = gitShowJson(paths.matrix);
const previousPolicy = gitShowJson(paths.searchPolicy);
const previousSearch = gitShowJson(paths.searchManifest);
const previousSeries = gitShowJson(paths.seriesData);
preserveKeys(previousOwnership.routes, ownership.routes, 'page ownership');
preserveKeys(previousMatrix.routes, matrix.routes, 'migration matrix');
preserveKeys(previousPolicy.routes, searchPolicy.routes, 'search policy');

const previousSearchIds = new Set((previousSearch.items ?? []).map((item) => item.id));
const currentSearchIds = new Set(searchItems.map((item) => item.id));
for (const id of previousSearchIds) requireValue(currentSearchIds.has(id), `search manifest lost pre-Wave12 item: ${id}`);
for (const oldItem of previousSearch.items ?? []) {
  const current = searchItems.find((item) => item.id === oldItem.id);
  requireValue(current?.url === oldItem.url, `search manifest URL drift for ${oldItem.id}: ${current?.url} != ${oldItem.url}`);
}
requireValue(currentSearchIds.size === previousSearchIds.size + 1, `search manifest must add exactly one item; before=${previousSearchIds.size}, now=${currentSearchIds.size}`);

preserveKeys(previousSeries, seriesData, 'series registry');
for (const [seriesId, oldSeries] of Object.entries(previousSeries)) {
  const currentParts = seriesData[seriesId]?.parts ?? [];
  for (const oldPart of oldSeries.parts ?? []) {
    requireValue(currentParts.some((part) => part.slug === oldPart.slug), `series registry lost ${seriesId}/${oldPart.slug}`);
  }
}

const previousCatalogHrefs = hrefs(gitShow(paths.catalog));
const currentCatalogHrefs = hrefs(catalogText);
for (const href of previousCatalogHrefs) requireValue(currentCatalogHrefs.has(href), `articles catalog lost pre-Wave12 href: ${href}`);

for (const forbidden of ['Редакционный черновик · PUBLICATION_HOLD', 'ещё не зарегистрирован как публичный маршрут']) {
  requireValue(!publishedText.includes(forbidden), `published wrapper contains draft claim: ${forbidden}`);
}
for (const marker of ['PUBLIC_ROUTE_RELEASED_SOURCE_BOUNDARIES_PRESERVED', '181 authority sources', '73 reader links', '0 new direct quotes']) {
  requireValue(reportText.includes(marker), `release report marker missing: ${marker}`);
}

if (errors.length) {
  console.error(`❌ Diotrophes Wave 12 release failed (${errors.length})`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`✅ Diotrophes Wave 12 release passed: ${previousSearchIds.size} prior search items preserved, 21 cases, 181 sources, 73 reader links, 0 new direct quotes`);
