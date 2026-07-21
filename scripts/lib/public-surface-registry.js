'use strict';

const fs = require('fs');
const path = require('path');
const { loadRouteRecords } = require('./effective-route-registry');

const SURFACES = new Set(['series', 'article', 'page', 'special']);
const SERIES_SHAPES = new Set(['flat', 'book']);
const SERIES_ROUTE_TYPES = new Set(['series-article', 'series-chapter']);
const SPECIAL_ROUTE_TYPES = new Set(['map', 'map-landing', 'confession', 'genealogy']);
const SERIES_FACADE = 'src/components/article-pilots/_shared/series/SeriesReaderChrome.astro';
const HISTORICAL_SERIES_IMPL = 'src/components/article-pilots/gill-series/GillSeriesChrome.astro';
const BOOK_CONFIG = 'src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts';
const GILL_DEFAULT_CONFIG = 'src/components/article-pilots/_shared/series/seriesConfig.ts#GILL_SERIES';
const MOBILE_REGISTRY_FILE = path.join(
  process.cwd(),
  'src/components/article-pilots/_shared/mobileChromeRegistry.ts'
);

function parseMobileChromeRegistry(source = fs.readFileSync(MOBILE_REGISTRY_FILE, 'utf8')) {
  const entries = new Map();
  const routeRe = /['"](\/[^'"]+\/)['"]\s*:\s*\{([^}]+)\}/g;
  let match;
  while ((match = routeRe.exec(source))) {
    const route = match[1];
    const body = match[2];
    const value = (name) => {
      const field = body.match(new RegExp(name + "\\s*:\\s*['\"]([^'\"]+)['\"]"));
      return field ? field[1] : null;
    };
    entries.set(route, {
      engine: value('engine'),
      adapter: value('adapter'),
      mount: value('mount'),
    });
  }
  return entries;
}

function resolvedImports(record) {
  return (record.inspection?.imports || []).filter((item) => item.resolved);
}

function hasResolvedImport(record, target) {
  return resolvedImports(record).some((item) => item.resolved === target);
}

function historicalImplementationLeaks(record) {
  return resolvedImports(record).filter(
    (item) => item.resolved === HISTORICAL_SERIES_IMPL && item.importer !== SERIES_FACADE
  );
}

function seriesConfigSources(record) {
  const sources = [...new Set(resolvedImports(record)
    .filter((item) => item.importer !== SERIES_FACADE)
    .map((item) => item.resolved)
    .filter((resolved) => /\/series\/[^/]*(?:SeriesConfig|seriesConfig)\.(?:ts|js)$/.test(resolved || ''))
  )].sort();
  if (hasResolvedImport(record, SERIES_FACADE) && !sources.some((item) => !item.endsWith('/seriesConfig.ts'))) {
    return [GILL_DEFAULT_CONFIG];
  }
  return sources;
}

function deriveChrome(record, mobileEntries) {
  const profile = record.profile || {};
  const surface = profile.surface;
  const mobile = profile.mobileChrome || mobileEntries.get(record.route) || null;
  if (mobile) return { ...mobile, owner: 'mobile-registry' };
  if (surface === 'series' && hasResolvedImport(record, SERIES_FACADE)) {
    return { engine: 'series', adapter: 'series-reader', mount: 'static', owner: 'SeriesReaderChrome' };
  }
  if (surface === 'series') {
    return { engine: 'series', adapter: 'route-native', mount: 'static', owner: 'route-profile' };
  }
  if (surface === 'article') {
    return { engine: 'article', adapter: 'route-native', mount: 'static', owner: 'route-profile' };
  }
  if (surface === 'page') {
    return { engine: 'page', adapter: 'route-native', mount: 'static', owner: 'route-profile' };
  }
  return {
    engine: 'special',
    adapter: record.owner?.owner === 'built-app' ? 'built-app' : (profile.routeType || 'route-native-app'),
    mount: record.owner?.owner === 'built-app' ? 'built-app' : 'static',
    owner: record.owner?.owner === 'built-app' ? 'built-app' : 'route-profile',
  };
}

function settingsCapability(record, chrome) {
  const surface = record.profile?.surface;
  if (surface === 'special') return 'global-preferences+special-bridge';
  if (hasResolvedImport(record, SERIES_FACADE) || chrome.engine === 'series' || chrome.engine === 'article') {
    return 'reader-ui';
  }
  return 'global-preferences';
}

function derivePublicSurfaceEntry(record, mobileEntries = parseMobileChromeRegistry()) {
  const profile = record.profile || {};
  const chrome = deriveChrome(record, mobileEntries);
  return {
    route: record.route,
    surface: profile.surface || null,
    seriesShape: profile.seriesShape || null,
    routeType: profile.routeType || null,
    owner: record.owner?.owner || null,
    status: record.owner?.status || null,
    source: record.sourceRel || record.owner?.source || null,
    profileFile: record.profileFile || null,
    chrome,
    settingsCapability: settingsCapability(record, chrome),
    configSources: profile.surface === 'series' ? seriesConfigSources(record) : [],
    facts: {
      importsSeriesFacade: hasResolvedImport(record, SERIES_FACADE),
      importsBookConfig: hasResolvedImport(record, BOOK_CONFIG),
      historicalImplementationLeaks: historicalImplementationLeaks(record).map(
        (item) => `${item.importer} -> ${item.resolved}`
      ),
    },
  };
}

function validatePublicSurfaceRecord(record, entry, mobileEntries) {
  const errors = [];
  const profile = record.profile || {};
  const surface = profile.surface;
  const shape = profile.seriesShape;
  const routeType = profile.routeType || null;
  const issue = (message) => errors.push(`${record.route}: ${message}`);

  if (profile.surfaceContractVersion !== 1) issue('surfaceContractVersion must be 1');
  if (!SURFACES.has(surface)) issue(`invalid or missing surface: ${surface || '<missing>'}`);
  if (surface === 'series') {
    if (!SERIES_SHAPES.has(shape)) issue(`series requires seriesShape flat|book, got ${shape || '<missing>'}`);
  } else if (shape != null) {
    issue(`non-series surface must not declare seriesShape (${shape})`);
  }

  if (entry.facts.importsSeriesFacade && surface !== 'series') {
    issue('SeriesReaderChrome import requires surface=series');
  }
  if (entry.facts.importsBookConfig && !(surface === 'series' && shape === 'book')) {
    issue('hardTextsSeriesConfig import requires surface=series and seriesShape=book');
  }
  if (surface === 'series' && shape === 'book' && !entry.facts.importsBookConfig) {
    issue('seriesShape=book requires resolved hardTextsSeriesConfig import');
  }
  if (entry.facts.historicalImplementationLeaks.length) {
    issue(`direct GillSeriesChrome import outside façade: ${entry.facts.historicalImplementationLeaks.join(', ')}`);
  }

  if (SERIES_ROUTE_TYPES.has(routeType) && surface !== 'series') {
    issue(`routeType=${routeType} requires surface=series`);
  }
  if (SPECIAL_ROUTE_TYPES.has(routeType) && surface !== 'special') {
    issue(`routeType=${routeType} requires surface=special`);
  }
  if (record.owner?.owner === 'built-app' && surface !== 'special') {
    issue('built-app owner requires surface=special');
  }
  if (surface === 'article' && routeType !== 'article') {
    issue(`surface=article requires routeType=article, got ${routeType || '<missing>'}`);
  }
  if ((surface === 'page' || surface === 'special') && entry.facts.importsSeriesFacade) {
    issue(`${surface} surface must not import SeriesReaderChrome`);
  }

  const mobile = profile.mobileChrome || mobileEntries.get(record.route) || null;
  if (mobile?.engine === 'series' && surface !== 'series') issue('mobile engine=series requires surface=series');
  if (mobile?.engine === 'article' && surface !== 'article') issue('mobile engine=article requires surface=article');
  if (mobile?.engine === 'page' && !['page', 'special'].includes(surface)) {
    issue(`mobile engine=page is incompatible with surface=${surface}`);
  }

  if (profile.route && profile.route !== record.route) issue(`profile.route drift: ${profile.route}`);
  if (profile.source && record.owner?.source && profile.source !== record.owner.source) {
    issue(`profile.source drift: ${profile.source} != ${record.owner.source}`);
  }
  return errors;
}

function buildPublicSurfaceRegistry(options = {}) {
  const loaded = options.loaded || loadRouteRecords();
  const records = options.records || loaded.records;
  const mobileEntries = options.mobileEntries || parseMobileChromeRegistry();
  const expectedRoutes = options.expectedRoutes || Object.keys(loaded.ownership?.routes || {});
  const entries = records.map((record) => derivePublicSurfaceEntry(record, mobileEntries));
  const errors = [];
  const routeSet = new Set(entries.map((entry) => entry.route));

  for (let index = 0; index < records.length; index += 1) {
    errors.push(...validatePublicSurfaceRecord(records[index], entries[index], mobileEntries));
  }
  for (const route of expectedRoutes) {
    if (!routeSet.has(route)) errors.push(`${route}: missing from public surface registry`);
  }
  for (const route of routeSet) {
    if (!expectedRoutes.includes(route)) errors.push(`${route}: registry route absent from page ownership`);
  }
  for (const route of mobileEntries.keys()) {
    if (!routeSet.has(route)) errors.push(`${route}: mobile registry route absent from public surface registry`);
  }

  const counts = entries.reduce((acc, entry) => {
    acc[entry.surface || '<missing>'] = (acc[entry.surface || '<missing>'] || 0) + 1;
    return acc;
  }, {});
  const shapeCounts = entries
    .filter((entry) => entry.surface === 'series')
    .reduce((acc, entry) => {
      acc[entry.seriesShape || '<missing>'] = (acc[entry.seriesShape || '<missing>'] || 0) + 1;
      return acc;
    }, {});

  return { entries, errors, counts, shapeCounts, mobileEntries };
}

module.exports = {
  SURFACES,
  SERIES_SHAPES,
  SERIES_FACADE,
  HISTORICAL_SERIES_IMPL,
  BOOK_CONFIG,
  parseMobileChromeRegistry,
  derivePublicSurfaceEntry,
  validatePublicSurfaceRecord,
  buildPublicSurfaceRegistry,
};
