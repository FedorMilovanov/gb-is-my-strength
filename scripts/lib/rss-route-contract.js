'use strict';

const DEFAULT_SITE_URL = 'https://gospod-bog.ru';
const PUBLIC_ROUTE_STATUS = 'production-dist';
const EDITORIAL_MANIFEST_TYPES = new Set(['article', 'series']);

function decodeXmlText(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripCdata(value) {
  return String(value || '')
    .replace(/^\s*<!\[CDATA\[/, '')
    .replace(/\]\]>\s*$/, '')
    .trim();
}

function elementText(xml, name) {
  const match = String(xml || '').match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match ? decodeXmlText(stripCdata(match[1])).trim() : '';
}

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
  return String(siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '') + normalizeRoute(route);
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

function parseRss(xml) {
  const source = String(xml || '');
  const channelMatch = source.match(/<channel(?:\s[^>]*)?>([\s\S]*?)<\/channel>/i);
  const channel = channelMatch ? channelMatch[1] : '';
  const items = [...channel.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map((match, index) => {
    const itemXml = match[1];
    return {
      index,
      title: elementText(itemXml, 'title'),
      link: elementText(itemXml, 'link'),
      guid: elementText(itemXml, 'guid'),
      pubDate: elementText(itemXml, 'pubDate'),
      creator: elementText(itemXml, 'dc:creator'),
      description: elementText(itemXml, 'description'),
    };
  });

  return {
    channelTitle: elementText(channel, 'title'),
    channelLink: elementText(channel, 'link'),
    lastBuildDate: elementText(channel, 'lastBuildDate'),
    selfLink: (() => {
      const match = channel.match(/<atom:link\b[^>]*\brel=["']self["'][^>]*\bhref=["']([^"']+)["'][^>]*\/?\s*>/i)
        || channel.match(/<atom:link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']self["'][^>]*\/?\s*>/i);
      return match ? decodeXmlText(match[1]).trim() : '';
    })(),
    items,
  };
}

function manifestItems(manifest) {
  return Array.isArray(manifest?.items) ? manifest.items : [];
}

function auditRssContract(xml, options = {}) {
  const siteUrl = options.siteUrl || DEFAULT_SITE_URL;
  const siteOrigin = new URL(siteUrl).origin;
  const loaded = options.loaded || { records: [] };
  const manifest = options.manifest || { items: [] };
  const parsed = parseRss(xml);
  const records = loaded.records || [];
  const recordsByRoute = new Map(records.map((record) => [normalizeRoute(record.route), record]));
  const manifestByRoute = new Map(
    manifestItems(manifest)
      .filter((item) => item?.url && !String(item.url).includes('#'))
      .map((item) => [normalizeRoute(item.url), item])
  );

  const missingFields = [];
  const invalidUrls = [];
  const foreignUrls = [];
  const nonCanonicalUrls = [];
  const guidMismatches = [];
  const invalidDates = [];
  const localRoutes = [];
  const itemLinks = [];
  const itemGuids = [];
  const datedItems = [];

  for (const item of parsed.items) {
    for (const field of ['title', 'link', 'guid', 'pubDate', 'description']) {
      if (!item[field]) missingFields.push(`item ${item.index + 1}: missing ${field}`);
    }

    if (item.link) itemLinks.push(item.link);
    if (item.guid) itemGuids.push(item.guid);
    if (item.link && item.guid && item.link !== item.guid) {
      guidMismatches.push(`${item.link} != ${item.guid}`);
    }

    if (item.pubDate) {
      const timestamp = Date.parse(item.pubDate);
      if (Number.isNaN(timestamp)) invalidDates.push(`${item.link || `item ${item.index + 1}`}: ${item.pubDate}`);
      else datedItems.push({ route: item.link ? normalizeRoute(item.link) : '', timestamp, pubDate: item.pubDate });
    }

    if (!item.link) continue;
    let parsedUrl;
    try {
      parsedUrl = new URL(item.link);
    } catch {
      invalidUrls.push(item.link);
      continue;
    }
    if (parsedUrl.origin !== siteOrigin) {
      foreignUrls.push(item.link);
      continue;
    }
    const route = normalizeRoute(parsedUrl.pathname);
    localRoutes.push(route);
    if (parsedUrl.search || parsedUrl.hash || routeToUrl(route, siteUrl) !== parsedUrl.origin + parsedUrl.pathname) {
      nonCanonicalUrls.push(item.link);
    }
  }

  const localSet = new Set(localRoutes);
  const unregisteredRoutes = [...localSet].filter((route) => !recordsByRoute.has(route)).sort();
  const nonProductionRoutes = [...localSet]
    .filter((route) => recordsByRoute.has(route) && recordsByRoute.get(route)?.owner?.status !== PUBLIC_ROUTE_STATUS)
    .sort();
  const explicitNoindexRoutes = [...localSet]
    .filter((route) => recordsByRoute.get(route)?.profile?.seo?.indexable === false)
    .sort();
  const feedRoutesMissingFromManifest = [...localSet]
    .filter((route) => !manifestByRoute.has(route))
    .sort();
  const feedRoutesWithNonEditorialManifestType = [...localSet]
    .filter((route) => manifestByRoute.has(route) && !EDITORIAL_MANIFEST_TYPES.has(manifestByRoute.get(route)?.type))
    .sort();

  const latestItemTimestamp = datedItems.reduce((max, item) => Math.max(max, item.timestamp), Number.NEGATIVE_INFINITY);
  const lastBuildTimestamp = parsed.lastBuildDate ? Date.parse(parsed.lastBuildDate) : Number.NaN;
  const invalidLastBuildDate = !parsed.lastBuildDate || Number.isNaN(lastBuildTimestamp) ? [parsed.lastBuildDate || '(missing)'] : [];
  const staleLastBuildDate = !invalidLastBuildDate.length
    && Number.isFinite(latestItemTimestamp)
    && lastBuildTimestamp < latestItemTimestamp
    ? [{ lastBuildDate: parsed.lastBuildDate, latestItemDate: new Date(latestItemTimestamp).toUTCString() }]
    : [];

  const chronologicalInversions = [];
  for (let i = 1; i < datedItems.length; i += 1) {
    if (datedItems[i].timestamp > datedItems[i - 1].timestamp) {
      chronologicalInversions.push({
        previous: datedItems[i - 1],
        current: datedItems[i],
      });
    }
  }

  return {
    siteUrl,
    parsed,
    itemCount: parsed.items.length,
    localRoutes: [...localSet].sort(),
    duplicateLinks: duplicateValues(itemLinks),
    duplicateGuids: duplicateValues(itemGuids),
    duplicateRoutes: duplicateValues(localRoutes),
    missingFields,
    invalidUrls: [...new Set(invalidUrls)].sort(),
    foreignUrls: [...new Set(foreignUrls)].sort(),
    nonCanonicalUrls: [...new Set(nonCanonicalUrls)].sort(),
    guidMismatches: [...new Set(guidMismatches)].sort(),
    invalidDates: [...new Set(invalidDates)].sort(),
    invalidLastBuildDate,
    staleLastBuildDate,
    unregisteredRoutes,
    nonProductionRoutes,
    explicitNoindexRoutes,
    feedRoutesMissingFromManifest,
    feedRoutesWithNonEditorialManifestType,
    chronologicalInversions,
  };
}

function contractProblems(result) {
  return [
    ...(result.itemCount ? [] : ['RSS contains no items']),
    ...result.missingFields,
    ...result.invalidUrls.map((url) => `invalid RSS item URL: ${url}`),
    ...result.foreignUrls.map((url) => `foreign RSS item URL: ${url}`),
    ...result.nonCanonicalUrls.map((url) => `non-canonical RSS item URL: ${url}`),
    ...result.duplicateLinks.map((url) => `duplicate RSS link: ${url}`),
    ...result.duplicateGuids.map((url) => `duplicate RSS guid: ${url}`),
    ...result.duplicateRoutes.map((route) => `duplicate RSS route: ${route}`),
    ...result.guidMismatches.map((value) => `RSS guid mismatch: ${value}`),
    ...result.invalidDates.map((value) => `invalid RSS pubDate: ${value}`),
    ...result.invalidLastBuildDate.map((value) => `invalid RSS lastBuildDate: ${value}`),
    ...result.staleLastBuildDate.map((value) => `RSS lastBuildDate ${value.lastBuildDate} is older than latest item ${value.latestItemDate}`),
    ...result.unregisteredRoutes.map((route) => `unregistered RSS route: ${route}`),
    ...result.nonProductionRoutes.map((route) => `non-production RSS route: ${route}`),
    ...result.explicitNoindexRoutes.map((route) => `explicit noindex route present in RSS: ${route}`),
  ];
}

function inventoryWarnings(result) {
  return [
    ...result.feedRoutesMissingFromManifest.map((route) => `RSS route missing from search manifest: ${route}`),
    ...result.feedRoutesWithNonEditorialManifestType.map((route) => `RSS route has non-editorial manifest type: ${route}`),
    ...result.chronologicalInversions.map((pair) => `RSS order inversion: ${pair.current.route} (${pair.current.pubDate}) appears after ${pair.previous.route} (${pair.previous.pubDate})`),
  ];
}

module.exports = {
  DEFAULT_SITE_URL,
  PUBLIC_ROUTE_STATUS,
  EDITORIAL_MANIFEST_TYPES,
  decodeXmlText,
  elementText,
  normalizeRoute,
  routeToUrl,
  duplicateValues,
  parseRss,
  auditRssContract,
  contractProblems,
  inventoryWarnings,
};
