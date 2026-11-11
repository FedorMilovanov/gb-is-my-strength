'use strict';

// Single source of truth: route-search-policy governs BOTH public and Astro-generated sitemaps.
const { routes } = require('../data/route-search-policy.json');
const SITE_ORIGIN = 'https://gospod-bog.ru';

function shouldIncludeSitemapUrl(page) {
  if (typeof page !== 'string') return false;
  let url;
  try { url = new URL(page); } catch { return false; }
  if (url.origin !== SITE_ORIGIN || url.search || url.hash) return false;
  const route = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
  return routes[route]?.sitemapPolicy === 'include';
}

module.exports = { shouldIncludeSitemapUrl };
