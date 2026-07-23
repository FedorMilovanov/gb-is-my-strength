'use strict';

const { loadRouteRecords } = require('./effective-route-registry');

const DEFAULT_SITE_URL = 'https://gospod-bog.ru';
const PUBLIC_ROUTE_STATUS = 'production-dist';

function normalizeRoute(value) {
  let route = String(value || '').trim();
  if (!route) return '/';
  if (/^https?:\/\//i.test(route)) route = new URL(route).pathname;
  route = route.split('#')[0].split('?')[0];
  route = '/' + route.replace(/^\/+/, '').replace(/\/{2,}/g, '/');
  if (route !== '/' && !route.endsWith('/')) route += '/';
  return route;
}

function routeToUrl(route, siteUrl = DEFAULT_SITE_URL) {
  const base = String(siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '');
  return base + normalizeRoute(route);
}

function isIndexableProductionRoute(record) {
  return record.owner?.status === PUBLIC_ROUTE_STATUS && record.profile?.seo?.indexable !== false;
}

function expectedSitemapRoutes(options = {}) {
  const loaded = options.loaded || loadRouteRecords();
  const records = options.records || loaded.records || [];
  return [...new Set(records
    .filter(isIndexableProductionRoute)
    .map((record) => normalizeRoute(record.route)))]
    .sort();
}

function decodeXmlText(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseSitemapLocations(xml) {
  return [...String(xml || '').matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => decodeXmlText(match[1]).trim())
    .filter(Boolean);
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

function auditSitemapCoverage(xml, options = {}) {
  const siteUrl = options.siteUrl || DEFAULT_SITE_URL;
  const siteOrigin = new URL(siteUrl).origin;
  const expectedRoutes = options.expectedRoutes || expectedSitemapRoutes(options);
  const expectedSet = new Set(expectedRoutes.map(normalizeRoute));
  const locations = parseSitemapLocations(xml);
  const invalidUrls = [];
  const foreignUrls = [];
  const nonCanonicalUrls = [];
  const localRoutes = [];

  for (const location of locations) {
    let parsed;
    try {
      parsed = new URL(location);
    } catch {
      invalidUrls.push(location);
      continue;
    }
    if (parsed.origin !== siteOrigin) {
      foreignUrls.push(location);
      continue;
    }
    const route = normalizeRoute(parsed.pathname);
    localRoutes.push(route);
    if (parsed.search || parsed.hash || routeToUrl(route, siteUrl) !== parsed.origin + parsed.pathname) {
      nonCanonicalUrls.push(location);
    }
  }

  const localSet = new Set(localRoutes);
  return {
    siteUrl,
    expectedRoutes: [...expectedSet].sort(),
    locations,
    localRoutes,
    missingRoutes: [...expectedSet].filter((route) => !localSet.has(route)).sort(),
    unexpectedRoutes: [...localSet].filter((route) => !expectedSet.has(route)).sort(),
    duplicateUrls: duplicateValues(locations),
    duplicateRoutes: duplicateValues(localRoutes),
    invalidUrls: [...new Set(invalidUrls)].sort(),
    foreignUrls: [...new Set(foreignUrls)].sort(),
    nonCanonicalUrls: [...new Set(nonCanonicalUrls)].sort(),
  };
}

function contractProblems(result) {
  return [
    ...result.invalidUrls.map((url) => `invalid sitemap URL: ${url}`),
    ...result.foreignUrls.map((url) => `foreign sitemap URL: ${url}`),
    ...result.nonCanonicalUrls.map((url) => `non-canonical sitemap URL: ${url}`),
    ...result.duplicateUrls.map((url) => `duplicate sitemap URL: ${url}`),
    ...result.duplicateRoutes.map((route) => `duplicate sitemap route: ${route}`),
    ...result.missingRoutes.map((route) => `missing canonical indexable production route: ${route}`),
    ...result.unexpectedRoutes.map((route) => `unregistered sitemap route: ${route}`),
  ];
}

module.exports = {
  DEFAULT_SITE_URL,
  PUBLIC_ROUTE_STATUS,
  normalizeRoute,
  routeToUrl,
  isIndexableProductionRoute,
  expectedSitemapRoutes,
  parseSitemapLocations,
  auditSitemapCoverage,
  contractProblems,
};
