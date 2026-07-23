'use strict';

const fs = require('fs');
const path = require('path');
const { loadRouteRecords } = require('./effective-route-registry');

const PUBLIC_ROUTE_STATUS = 'production-dist';

function normalizeRoute(value) {
  let route = String(value || '').trim();
  if (!route) return '/';
  if (/^https?:\/\//i.test(route)) route = new URL(route).pathname;
  route = '/' + route.split('#')[0].split('?')[0].replace(/^\/+/, '').replace(/\/{2,}/g, '/');
  if (route !== '/' && !route.endsWith('/')) route += '/';
  return route;
}

function routeToHtmlRelative(route) {
  const normalized = normalizeRoute(route);
  return normalized === '/' ? 'index.html' : normalized.slice(1) + 'index.html';
}

function canonicalUrlForRoute(route, baseUrl) {
  return String(baseUrl || '').replace(/\/+$/, '') + normalizeRoute(route);
}

function productionRouteRecords(options = {}) {
  const loaded = options.loaded || loadRouteRecords();
  const records = options.records || loaded.records || [];
  return records
    .filter((record) => record.owner?.status === PUBLIC_ROUTE_STATUS)
    .map((record) => ({
      ...record,
      route: normalizeRoute(record.route),
      htmlRelative: routeToHtmlRelative(record.route),
      indexable: record.profile?.seo?.indexable !== false,
    }))
    .sort((a, b) => a.route.localeCompare(b.route));
}

function collectProductionHtmlTargets(rootDir, options = {}) {
  const records = productionRouteRecords(options);
  return records.map((record) => {
    const absolute = path.join(rootDir, record.htmlRelative);
    return {
      ...record,
      absolute,
      exists: fs.existsSync(absolute),
    };
  });
}

module.exports = {
  PUBLIC_ROUTE_STATUS,
  normalizeRoute,
  routeToHtmlRelative,
  canonicalUrlForRoute,
  productionRouteRecords,
  collectProductionHtmlTargets,
};
