#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const PRE_WAVE12 = '2273b8c930eebf383d429b917d3636bc28a80bae';
const WAVE12_RELEASE = '8f17085dc8411cffbcb5a4dcd2f8fc5db9c30a97';
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
const gitShow = (ref, path, label) => {
  try {
    return execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8' });
  } catch (error) {
    errors.push(`cannot read ${path} at ${label} ${ref}: ${error.stderr?.toString().trim() || error.message}`);
    return '';
  }
};
const gitShowJson = (ref, path, label) => {
  try { return JSON.parse(gitShow(ref, path, label)); }
  catch (error) { errors.push(`${path} at ${label} ${ref}: invalid JSON: ${error.message}`); return {}; }
};
const routePolicyIsPublic = (policy) => (
  policy?.indexPolicy === 'index'
  && policy?.pagefindPolicy === 'include'
  && policy?.searchManifestPolicy === 'include'
  && policy?.sitemapPolicy === 'include'
  && policy?.rssPolicy === 'include'
);
const searchItemIsWave12 = (item) => (
  item?.url === ROUTE
  && item?.readTime === 35
  && item?.section === 'Служение'
  && item?.seriesId === 'pastor-series'
  && item?.seriesPosition === 2
);
const seriesHasWave12Part = (series) => (
  series?.parts?.some((part) => (
    part.slug === 'diotrefy-nashego-vremeni'
    && part.status === 'published'
  ))
);

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
for (const [key, expected] of Object.entries({
  coreCases: 21,
  faithfulPathways: 15,
  faithfulResponses: 20,
  authoritySources: 181,
  readerLinks: 73,
  newDirectQuotesApproved: 0,
})) {
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
requireValue(routePolicyIsPublic(policy), 'current Wave 12 search policy drift');
const searchItems = searchManifest.items ?? [];
const searchItem = searchItems.find((item) => item.url === ROUTE);
requireValue(Boolean(searchItem), 'search manifest entry missing');
requireValue(searchItemIsWave12(searchItem), 'current Wave 12 search manifest fields drift');
requireValue(seriesText.includes("id: 'diotrophes'"), 'reader series item missing');
requireValue(seriesText.includes(`href: '${ROUTE}'`), 'reader series route missing');
requireValue(seriesText.includes('readingProgressTotalMin: 102'), 'reader series total drift');
requireValue(seriesHasWave12Part(seriesData['pastor-series']), 'data/series.json Part II missing');
requireValue(sitemapText.includes(`<loc>https://gospod-bog.ru${ROUTE}</loc>`), 'series sitemap entry missing');
requireValue(feedText.includes(`<link>https://gospod-bog.ru${ROUTE}</link>`), 'series RSS entry missing');
requireValue(robotsText.includes('Sitemap: https://gospod-bog.ru/sitemap-pastor-series.xml'), 'robots does not advertise sitemap shard');
requireValue(catalogText.includes('data-wave12-catalog-card="true"') && catalogText.includes('diotrefy-nashego-vremeni/'), 'articles catalog card missing');
requireValue(seriesLandingText.includes('data-wave12-series-card="true"') && seriesLandingText.includes('Часть II · 35 мин'), 'series landing Part II missing');
requireValue(seriesHeadText.includes('numberOfItems: 2') && seriesHeadText.includes('diotrefy-nashego-vremeni'), 'series structured data drift');
requireValue(seriesHeadText.includes('feed-pastor-series.xml'), 'series landing does not advertise RSS shard');

// The immutable release snapshot proves the Wave 12-owned publication decisions.
// Unrelated registry entries are owned by their respective lanes and are validated
// by the repository-wide route/search/source contracts, not retroactively by Wave 12.
const releasedOwnership = gitShowJson(WAVE12_RELEASE, paths.ownership, 'Wave12 release');
const releasedMatrix = gitShowJson(WAVE12_RELEASE, paths.matrix, 'Wave12 release');
const releasedPolicy = gitShowJson(WAVE12_RELEASE, paths.searchPolicy, 'Wave12 release');
const releasedSearch = gitShowJson(WAVE12_RELEASE, paths.searchManifest, 'Wave12 release');
const releasedSeries = gitShowJson(WAVE12_RELEASE, paths.seriesData, 'Wave12 release');
const releasedCatalogText = gitShow(WAVE12_RELEASE, paths.catalog, 'Wave12 release');
const releasedSeriesLandingText = gitShow(WAVE12_RELEASE, paths.seriesLanding, 'Wave12 release');
const releasedSeriesHeadText = gitShow(WAVE12_RELEASE, paths.seriesHead, 'Wave12 release');
const releasedSitemapText = gitShow(WAVE12_RELEASE, paths.sitemap, 'Wave12 release');
const releasedFeedText = gitShow(WAVE12_RELEASE, paths.feed, 'Wave12 release');

requireValue(releasedOwnership.routes?.[ROUTE]?.owner === 'astro', 'release snapshot lacks Wave 12 page owner');
requireValue(releasedOwnership.routes?.[ROUTE]?.status === 'production-dist', 'release snapshot Wave 12 ownership status drift');
requireValue(releasedMatrix.routes?.[ROUTE]?.mode === 'strict-native', 'release snapshot Wave 12 migration mode drift');
requireValue(releasedMatrix.routes?.[ROUTE]?.audits?.includes('diotrophes-wave12-release'), 'release snapshot lacks Wave 12 audit');
requireValue(routePolicyIsPublic(releasedPolicy.routes?.[ROUTE]), 'release snapshot Wave 12 search policy drift');

const releasedSearchItem = (releasedSearch.items ?? []).find((item) => item.url === ROUTE);
requireValue(Boolean(releasedSearchItem), 'release snapshot lacks Wave 12 search item');
requireValue(searchItemIsWave12(releasedSearchItem), 'release snapshot Wave 12 search fields drift');
requireValue(seriesHasWave12Part(releasedSeries['pastor-series']), 'release snapshot lacks published Wave 12 series part');
requireValue(releasedCatalogText.includes('data-wave12-catalog-card="true"') && releasedCatalogText.includes('diotrefy-nashego-vremeni/'), 'release snapshot lacks Wave 12 catalog card');
requireValue(releasedSeriesLandingText.includes('data-wave12-series-card="true"') && releasedSeriesLandingText.includes('Часть II · 35 мин'), 'release snapshot lacks Wave 12 series card');
requireValue(releasedSeriesHeadText.includes('numberOfItems: 2') && releasedSeriesHeadText.includes('diotrefy-nashego-vremeni'), 'release snapshot Wave 12 structured data drift');
requireValue(releasedSitemapText.includes(`<loc>https://gospod-bog.ru${ROUTE}</loc>`), 'release snapshot lacks Wave 12 sitemap entry');
requireValue(releasedFeedText.includes(`<link>https://gospod-bog.ru${ROUTE}</link>`), 'release snapshot lacks Wave 12 RSS entry');

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
console.log(`✅ Diotrophes Wave 12 release passed: immutable snapshot ${WAVE12_RELEASE.slice(0, 8)} retains Wave 12-owned registry and public-surface authority; current route remains strict-native; 21 cases, 181 sources, 73 reader links, 0 new direct quotes`);
