'use strict';

const fs = require('fs');
const path = require('path');
const { loadRouteRecords } = require('./effective-route-registry');
const {
  DEFAULT_SITE_URL,
  PUBLIC_ROUTE_STATUS,
  normalizeRoute,
  routeToUrl,
} = require('./sitemap-route-contract');

const INDEXABLE_SOCIAL_META = Object.freeze([
  Object.freeze({ attr: 'property', name: 'og:image' }),
  Object.freeze({ attr: 'property', name: 'og:image:width' }),
  Object.freeze({ attr: 'property', name: 'og:image:height' }),
  Object.freeze({ attr: 'name', name: 'twitter:image' }),
  Object.freeze({ attr: 'name', name: 'twitter:site' }),
  Object.freeze({ attr: 'name', name: 'twitter:creator' }),
]);

function routeToHtmlFile(route) {
  const normalized = normalizeRoute(route);
  return normalized === '/'
    ? 'index.html'
    : `${normalized.replace(/^\/+|\/+$/g, '')}/index.html`;
}

function isProductionSeoRoute(record) {
  return record?.owner?.status === PUBLIC_ROUTE_STATUS;
}

function expectedSeoRouteEntries(options = {}) {
  const loaded = options.loaded || loadRouteRecords();
  const records = options.records || loaded.records || [];
  const siteUrl = options.siteUrl || DEFAULT_SITE_URL;
  const byRoute = new Map();

  for (const record of records) {
    if (!isProductionSeoRoute(record)) continue;
    const route = normalizeRoute(record.route);
    if (byRoute.has(route)) {
      throw new Error(`duplicate production SEO route in registry: ${route}`);
    }
    byRoute.set(route, {
      route,
      htmlFile: routeToHtmlFile(route),
      canonical: routeToUrl(route, siteUrl),
      indexable: record.profile?.seo?.indexable !== false,
      owner: record.owner?.owner || null,
      profileFile: record.profileFile || null,
    });
  }

  return [...byRoute.values()].sort((a, b) => a.route.localeCompare(b.route));
}

function metaValues(html, attr, name) {
  const wantedAttr = String(attr).toLowerCase();
  const wantedName = String(name).toLowerCase();
  const values = [];

  for (const match of String(html || '').matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = new Map();
    for (const attribute of match[0].matchAll(/\b([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attributes.set(
        attribute[1].toLowerCase(),
        attribute[2] ?? attribute[3] ?? ''
      );
    }
    if ((attributes.get(wantedAttr) || '').toLowerCase() !== wantedName) continue;
    values.push(attributes.has('content') ? attributes.get('content') : '');
  }

  return values;
}

function getMeta(html, attr, name) {
  return metaValues(html, attr, name)[0] ?? '';
}

function getCanonical(html) {
  const re1 = /<link\s+[^>]*rel=["'][^"']*\bcanonical\b[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i;
  const re2 = /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*\bcanonical\b[^"']*["'][^>]*>/i;
  return html.match(re1)?.[1] ?? html.match(re2)?.[1] ?? '';
}

function canonicalCount(html) {
  return [...String(html || '').matchAll(/<link\s+[^>]*rel=["'][^"']*\bcanonical\b[^"']*["'][^>]*>/gi)].length;
}

function hasNoindex(html) {
  return /(?:^|[,\s])noindex(?:$|[,\s])/i.test(getMeta(html, 'name', 'robots'));
}

function auditIndexableSocialMeta(html, route) {
  const errors = [];
  for (const { attr, name } of INDEXABLE_SOCIAL_META) {
    const values = metaValues(html, attr, name);
    const nonEmpty = values.length === 1 && values[0].trim() !== '';
    if (nonEmpty) continue;
    const found = values.length === 1 ? '1 empty value' : `${values.length} values`;
    errors.push(`${route}: expected exactly one non-empty ${name} meta, found ${found}`);
  }
  return errors;
}

function auditSeoRouteFiles(rootDir, options = {}) {
  const entries = options.entries || expectedSeoRouteEntries(options);
  const errors = [];
  const files = [];
  let indexable = 0;
  let noindex = 0;

  for (const entry of entries) {
    const absolute = path.join(rootDir, entry.htmlFile);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      errors.push(`${entry.route}: missing generated route HTML ${entry.htmlFile}`);
      continue;
    }

    const html = fs.readFileSync(absolute, 'utf8');
    const canonical = getCanonical(html);
    const canonicalLinks = canonicalCount(html);
    const pageNoindex = hasNoindex(html);

    files.push({ ...entry, absolute, canonical, canonicalLinks, noindex: pageNoindex });

    if (!/<head\b/i.test(html)) errors.push(`${entry.route}: generated HTML has no <head>`);
    if (canonicalLinks !== 1) {
      errors.push(`${entry.route}: expected exactly one canonical link, found ${canonicalLinks}`);
    }
    if (canonical !== entry.canonical) {
      errors.push(`${entry.route}: canonical ${canonical || '<missing>'} != ${entry.canonical}`);
    }

    if (entry.indexable) {
      indexable += 1;
      if (pageNoindex) errors.push(`${entry.route}: indexable registry route renders noindex`);
      errors.push(...auditIndexableSocialMeta(html, entry.route));
    } else {
      noindex += 1;
      if (!pageNoindex) errors.push(`${entry.route}: seo.indexable=false route must render noindex`);
    }
  }

  return {
    rootDir,
    entries,
    files,
    errors,
    counts: {
      production: entries.length,
      indexable,
      noindex,
      files: files.length,
    },
  };
}

module.exports = {
  INDEXABLE_SOCIAL_META,
  routeToHtmlFile,
  isProductionSeoRoute,
  expectedSeoRouteEntries,
  metaValues,
  getMeta,
  getCanonical,
  canonicalCount,
  hasNoindex,
  auditIndexableSocialMeta,
  auditSeoRouteFiles,
};
