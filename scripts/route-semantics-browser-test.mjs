#!/usr/bin/env node
/**
 * Browser witness for non-reading public route roles and retained reader
 * runtime-to-markup coverage across every canonical production route.
 *
 * Proves that landing/reference routes stay navigational and never inherit
 * article/series reader chrome merely because they share the `series` surface.
 * It also classifies retained feature runtimes against actual production-like
 * markup without reviving dormant features or treating runtime presence as use.
 */
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { buildPublicSurfaceRegistry } = require('./lib/public-surface-registry');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const REPORT = join(ROOT, 'reports', 'route-semantics-browser.json');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};
const TARGETS = new Map([
  ['/nagornaya/', { role: 'landing', adapter: 'series-landing' }],
  ['/baptisty-rossii/', { role: 'landing', adapter: 'series-landing' }],
  ['/nagornaya/seriya/', { role: 'landing', adapter: 'series-landing' }],
  ['/nagornaya/istochniki/', { role: 'reference', adapter: 'series-reference' }],
  ['/nagornaya/nakhodki/', { role: 'reference', adapter: 'series-reference' }],
  ['/karty/', { role: 'landing', adapter: 'default-page' }],
  ['/konfessii/', { role: 'landing', adapter: 'default-page' }],
]);
const VIEWPORTS = [
  { id: 'mobile-320', width: 320, height: 760 },
  { id: 'mobile-390', width: 390, height: 844 },
  { id: 'desktop-1440', width: 1440, height: 900 },
];
const COVERAGE_VIEWPORT = { width: 390, height: 844 };
const FEATURE_CONTRACTS = Object.freeze([
  Object.freeze({ id: 'offline-series', token: 'data-gbs2-offline', selectors: ['[data-gbs2-offline]'] }),
  Object.freeze({ id: 'story-map', token: 'gbx-storymap', selectors: ['.gbx-storymap'] }),
  Object.freeze({ id: 'juxtapose', token: 'gbx-jux', selectors: ['.gbx-jux'] }),
  Object.freeze({ id: 'read-history', token: 'Вы читали', textMarker: 'Вы читали' }),
  Object.freeze({ id: 'verse-popover', token: 'gbx-verse', selectors: ['.gbx-verse'] }),
  Object.freeze({ id: 'original-word', token: 'gbx-ow', selectors: ['.gbx-ow'] }),
]);

function routeFile(pathname) {
  const clean = decodeURIComponent(pathname.split('?')[0]).replace(/^\/+/, '');
  return join(DIST, clean, clean.endsWith('.html') ? '' : 'index.html');
}

function distRelative(file) {
  return relative(DIST, file).replace(/\\/g, '/');
}

async function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) await walkFiles(file, out);
    else if (entry.isFile()) out.push(file);
  }
  return out;
}

async function scanFeatureAssets() {
  const files = (await walkFiles(DIST)).filter((file) => /\.(?:css|m?js)$/i.test(file));
  const assets = Object.fromEntries(FEATURE_CONTRACTS.map((feature) => [feature.id, {
    runtimeFiles: [],
    styleFiles: [],
  }]));
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    for (const feature of FEATURE_CONTRACTS) {
      if (!text.includes(feature.token)) continue;
      const target = /\.css$/i.test(file) ? assets[feature.id].styleFiles : assets[feature.id].runtimeFiles;
      target.push(distRelative(file));
    }
  }
  for (const value of Object.values(assets)) {
    value.runtimeFiles.sort();
    value.styleFiles.sort();
  }
  return assets;
}

async function serve() {
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
      let file = pathname.includes('.') && !pathname.endsWith('/')
        ? join(DIST, pathname.replace(/^\/+/, ''))
        : routeFile(pathname);
      try {
        if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      } catch {}
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

async function launchBrowser() {
  const explicit = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (explicit && existsSync(explicit)) return chromium.launch({ executablePath: explicit });
  return chromium.launch();
}

async function createCoverageContext(browser, base) {
  const context = await browser.newContext({
    viewport: COVERAGE_VIEWPORT,
    serviceWorkers: 'block',
  });
  await context.addInitScript(() => {
    const original = EventTarget.prototype.addEventListener;
    const targets = new WeakMap();
    window.__gbDuplicateListenerRegistrations = [];
    EventTarget.prototype.addEventListener = function addEventListener(type, listener, options) {
      if (listener && (typeof listener === 'function' || typeof listener.handleEvent === 'function')) {
        const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
        let byKey = targets.get(this);
        if (!byKey) {
          byKey = new Map();
          targets.set(this, byKey);
        }
        const key = `${type}:${capture ? 'capture' : 'bubble'}`;
        let listeners = byKey.get(key);
        if (!listeners) {
          listeners = new WeakSet();
          byKey.set(key, listeners);
        }
        if (listeners.has(listener)) window.__gbDuplicateListenerRegistrations.push(key);
        else listeners.add(listener);
      }
      return original.call(this, type, listener, options);
    };
  });
  await context.route('**/*', async (requestRoute) => {
    const request = requestRoute.request();
    const url = request.url();
    if (!url.startsWith(base) && !url.startsWith('data:') && !url.startsWith('blob:')) return requestRoute.abort();
    if (['image', 'media', 'font'].includes(request.resourceType())) return requestRoute.abort();
    return requestRoute.continue();
  });
  return context;
}

function normalizeAssetPath(url, base) {
  if (!url || !url.startsWith(base)) return null;
  return new URL(url).pathname.replace(/^\/+/, '');
}

function featureState({ markupRoutes, runtimeLoadedRoutes, runtimeFiles, styleFiles }) {
  if (markupRoutes.length && markupRoutes.every((route) => runtimeLoadedRoutes.includes(route))) return 'active';
  if (markupRoutes.length) return 'markup-without-runtime';
  if (runtimeLoadedRoutes.length) return 'runtime-unwired';
  if (runtimeFiles.length) return 'runtime-not-loaded';
  if (styleFiles.length) return 'style-only';
  return 'absent';
}

const registry = buildPublicSurfaceRegistry();
if (registry.errors.length) {
  registry.errors.forEach((error) => console.error(`REGISTRY ERROR ${error}`));
  process.exit(1);
}
const entries = new Map(registry.entries.map((entry) => [entry.route, entry]));
const productionEntries = registry.entries
  .filter((entry) => entry.status === 'production-dist')
  .sort((a, b) => a.route.localeCompare(b.route));
const results = [];
const record = (route, viewport, contract, ok, detail = '') => {
  results.push({ route, viewport, contract, ok: Boolean(ok), detail: String(detail || '') });
};

for (const [route, expected] of TARGETS) {
  const entry = entries.get(route);
  record(route, 'registry', 'role', entry?.routeRole === expected.role, entry?.routeRole || '<missing>');
  record(route, 'registry', 'adapter', entry?.chrome?.adapter === expected.adapter, entry?.chrome?.adapter || '<missing>');
  record(route, 'registry', 'settings', entry?.settingsCapability === 'global-preferences', entry?.settingsCapability || '<missing>');
}

const featureAssets = await scanFeatureAssets();
const coverageRoutes = [];
const { server, base } = await serve();
const browser = await launchBrowser();
try {
  for (const [route, expected] of TARGETS) {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 240)));
      await page.route('**/*', async (requestRoute) => {
        const request = requestRoute.request();
        const url = request.url();
        if (!url.startsWith(base) && !url.startsWith('data:') && !url.startsWith('blob:')) return requestRoute.abort();
        if (['image', 'media', 'font'].includes(request.resourceType())) return requestRoute.abort();
        return requestRoute.continue();
      });
      const response = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(200);
      const facts = await page.evaluate(() => {
        const root = document.scrollingElement || document.documentElement;
        return {
          overflow: Math.max(0, root.scrollWidth - root.clientWidth),
          gillRoot: Boolean(document.querySelector('[data-gill-v16]')),
          seriesRail: Boolean(document.querySelector('.gbs-rail')),
          articleRail: Boolean(document.querySelector('.hrail')),
          readerSettings: Boolean(document.querySelector('#railSettingsBtn, #mobSettingsBtn, #gillSettingsOverlay')),
          h1: [...document.querySelectorAll('h1')].some((node) => {
            const rect = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
          }),
        };
      });
      record(route, viewport.id, 'document:status', response?.status() === 200, response?.status() ?? 'no response');
      record(route, viewport.id, 'runtime:no-pageerror', pageErrors.length === 0, pageErrors.join(' | '));
      record(route, viewport.id, 'layout:no-horizontal-overflow', facts.overflow <= 8, `${facts.overflow}px`);
      record(route, viewport.id, 'document:visible-h1', facts.h1, JSON.stringify(facts));
      record(
        route,
        viewport.id,
        `semantics:${expected.role}-no-reader-chrome`,
        !facts.gillRoot && !facts.seriesRail && !facts.articleRail && !facts.readerSettings,
        JSON.stringify(facts),
      );
      await context.close();
    }
  }

  for (const entry of productionEntries) {
    const context = await createCoverageContext(browser, base);
    const page = await context.newPage();
    const pageErrors = [];
    const badResponses = [];
    const failedRequests = [];
    let navigationError = '';
    let response = null;
    let facts = {
      scripts: [],
      styles: [],
      features: Object.fromEntries(FEATURE_CONTRACTS.map((feature) => [feature.id, {
        markupCount: 0,
        inlineRuntime: false,
        inlineStyle: false,
      }])),
      duplicateListeners: [],
    };
    page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 240)));
    page.on('response', (routeResponse) => {
      if (routeResponse.url().startsWith(base) && routeResponse.status() >= 400) {
        badResponses.push({ url: routeResponse.url().slice(base.length), status: routeResponse.status() });
      }
    });
    page.on('requestfailed', (request) => {
      if (!request.url().startsWith(base)) return;
      if (['image', 'media', 'font'].includes(request.resourceType())) return;
      failedRequests.push({ url: request.url().slice(base.length), error: request.failure()?.errorText || 'failed' });
    });

    try {
      response = await page.goto(base + entry.route, { waitUntil: 'commit', timeout: 15000 });
      await page.waitForFunction(() => document.readyState !== 'loading', undefined, { timeout: 15000 });
      await page.waitForTimeout(80);
      facts = await page.evaluate((features) => {
        const scripts = [...document.scripts].map((node) => node.src).filter(Boolean);
        const styles = [...document.querySelectorAll('link[rel~="stylesheet"]')].map((node) => node.href).filter(Boolean);
        const inlineScripts = [...document.scripts].filter((node) => !node.src).map((node) => node.textContent || '');
        const inlineStyles = [...document.querySelectorAll('style')].map((node) => node.textContent || '');
        const bodyText = document.body?.textContent || '';
        const featureFacts = {};
        for (const feature of features) {
          let markupCount = 0;
          for (const selector of feature.selectors || []) markupCount += document.querySelectorAll(selector).length;
          if (feature.textMarker && bodyText.includes(feature.textMarker)) markupCount += 1;
          featureFacts[feature.id] = {
            markupCount,
            inlineRuntime: inlineScripts.some((text) => text.includes(feature.token)),
            inlineStyle: inlineStyles.some((text) => text.includes(feature.token)),
          };
        }
        return {
          scripts,
          styles,
          features: featureFacts,
          duplicateListeners: [...new Set(window.__gbDuplicateListenerRegistrations || [])],
        };
      }, FEATURE_CONTRACTS);
    } catch (error) {
      navigationError = String(error?.message || error).slice(0, 500);
    }

    const scripts = facts.scripts.map((url) => normalizeAssetPath(url, base)).filter(Boolean);
    const styles = facts.styles.map((url) => normalizeAssetPath(url, base)).filter(Boolean);
    const features = {};
    for (const feature of FEATURE_CONTRACTS) {
      const assets = featureAssets[feature.id];
      const runtimeLoadedFiles = assets.runtimeFiles.filter((file) => scripts.includes(file));
      const styleLoadedFiles = assets.styleFiles.filter((file) => styles.includes(file));
      const runtimeLoaded = facts.features[feature.id].inlineRuntime || runtimeLoadedFiles.length > 0;
      features[feature.id] = {
        markupCount: facts.features[feature.id].markupCount,
        runtimeLoaded,
        runtimeLoadedFiles,
        styleLoaded: facts.features[feature.id].inlineStyle || styleLoadedFiles.length > 0,
        styleLoadedFiles,
      };
      record(
        entry.route,
        'coverage',
        `feature:${feature.id}:runtime-for-markup`,
        features[feature.id].markupCount === 0 || runtimeLoaded,
        JSON.stringify(features[feature.id]),
      );
    }

    record(
      entry.route,
      'coverage',
      'document:navigation',
      navigationError === '',
      navigationError || 'committed and DOM parsed',
    );
    record(entry.route, 'coverage', 'document:status', response?.status() === 200, response?.status() ?? 'no response');
    record(entry.route, 'coverage', 'runtime:no-pageerror', pageErrors.length === 0, pageErrors.join(' | '));
    record(entry.route, 'coverage', 'runtime:no-dead-local-request', badResponses.length === 0 && failedRequests.length === 0, JSON.stringify({ badResponses, failedRequests }));
    record(entry.route, 'coverage', 'runtime:no-duplicate-listener-registration', facts.duplicateListeners.length === 0, facts.duplicateListeners.join(', '));
    coverageRoutes.push({
      route: entry.route,
      surface: entry.surface,
      routeRole: entry.routeRole,
      owner: entry.owner,
      source: entry.source,
      responseStatus: response?.status() ?? null,
      navigationError,
      pageErrors,
      badResponses,
      failedRequests,
      duplicateListeners: facts.duplicateListeners,
      scripts,
      styles,
      features,
    });
    await page.close();
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

const featureCoverage = Object.fromEntries(FEATURE_CONTRACTS.map((feature) => {
  const markupRoutes = coverageRoutes
    .filter((row) => row.features[feature.id].markupCount > 0)
    .map((row) => row.route);
  const runtimeLoadedRoutes = coverageRoutes
    .filter((row) => row.features[feature.id].runtimeLoaded)
    .map((row) => row.route);
  const styleLoadedRoutes = coverageRoutes
    .filter((row) => row.features[feature.id].styleLoaded)
    .map((row) => row.route);
  const assets = featureAssets[feature.id];
  return [feature.id, {
    token: feature.token,
    selectors: feature.selectors || [],
    textMarker: feature.textMarker || null,
    state: featureState({ markupRoutes, runtimeLoadedRoutes, ...assets }),
    markupRoutes,
    runtimeLoadedRoutes,
    styleLoadedRoutes,
    runtimeFiles: assets.runtimeFiles,
    styleFiles: assets.styleFiles,
  }];
}));
record('*', 'coverage', 'registry:all-production-routes-scanned', coverageRoutes.length === productionEntries.length, `${coverageRoutes.length}/${productionEntries.length}`);

const failures = results.filter((item) => !item.ok);
await mkdir(dirname(REPORT), { recursive: true });
await writeFile(REPORT, JSON.stringify({
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  total: results.length,
  passed: results.length - failures.length,
  failed: failures.length,
  results,
  runtimeMarkupCoverage: {
    productionRoutes: productionEntries.length,
    scannedRoutes: coverageRoutes.length,
    featureCoverage,
    routes: coverageRoutes,
  },
}, null, 2));
console.log(`Route semantics browser: ${results.length - failures.length}/${results.length} passed`);
console.log(`Runtime↔markup coverage: ${coverageRoutes.length}/${productionEntries.length} production routes scanned`);
for (const [id, coverage] of Object.entries(featureCoverage)) {
  console.log(`COVERAGE ${id}: ${coverage.state}; markup=${coverage.markupRoutes.length}; runtime-loaded=${coverage.runtimeLoadedRoutes.length}; runtime-files=${coverage.runtimeFiles.join(',') || '—'}; style-files=${coverage.styleFiles.join(',') || '—'}`);
}
if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL ${failure.route} ${failure.viewport} ${failure.contract}: ${failure.detail}`));
  process.exit(1);
}
