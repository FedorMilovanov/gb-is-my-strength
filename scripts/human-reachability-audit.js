#!/usr/bin/env node
'use strict';

/**
 * Derived CURRENT GOLD human-reachability audit.
 *
 * Authority:
 *   scripts/lib/public-surface-registry.js
 * Evidence:
 *   production-like dist rendered in Chromium
 *
 * This is deliberately not a second publication registry. Every current
 * reading route is derived from the existing public-surface authority and must
 * have at least one real, rendered, human-facing inbound <a href> witness from
 * a different public route. Search, sitemap, RSS and self-links do not count.
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');
const { buildPublicSurfaceRegistry } = require('./lib/public-surface-registry');

const ROOT = process.cwd();
const DIST = process.env.DIST_ROOT || path.join(ROOT, 'dist');
const OUT = process.env.HUMAN_REACHABILITY_REPORT || path.join(ROOT, 'reports', 'current-gold', 'human-reachability.json');
const PRODUCTION_ORIGIN = 'https://gospod-bog.ru';
const NON_HUMAN_SOURCE_ROUTES = new Set(['/search/']);

function canonicalRoute(route) {
  let pathname = String(route || '/').split(/[?#]/, 1)[0] || '/';
  try { pathname = decodeURI(pathname); } catch {}
  pathname = pathname.replace(/\/index\.html$/i, '/');
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  if (pathname !== '/' && !pathname.endsWith('/')) pathname += '/';
  return pathname.replace(/\/{2,}/g, '/');
}

function distFileForRoute(route) {
  const clean = canonicalRoute(route).replace(/^\/+|\/+$/g, '');
  return clean ? path.join(DIST, clean, 'index.html') : path.join(DIST, 'index.html');
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.woff2': 'font/woff2',
  })[ext] || 'application/octet-stream';
}

function requestFile(urlPath) {
  let pathname;
  try { pathname = decodeURIComponent(String(urlPath || '/').split(/[?#]/, 1)[0]); }
  catch { return null; }
  const normalized = path.posix.normalize(pathname).replace(/^\/+/, '');
  if (normalized.startsWith('../') || normalized.includes('/../')) return null;
  const relative = normalized && !normalized.endsWith('/') ? normalized : `${normalized}index.html`;
  const absolute = path.resolve(DIST, relative || 'index.html');
  const rootPrefix = `${path.resolve(DIST)}${path.sep}`;
  if (absolute !== path.resolve(DIST) && !absolute.startsWith(rootPrefix)) return null;
  return absolute;
}

async function startDistServer() {
  const server = http.createServer((req, res) => {
    const file = requestFile(req.url);
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType(file));
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  return {
    server,
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function resolvePublicRoute(href, sourceRoute, localOrigin) {
  if (!href || href.startsWith('#')) return null;
  if (/^(?:javascript|mailto|tel|data):/i.test(href)) return null;
  let url;
  try { url = new URL(href, `${localOrigin}${canonicalRoute(sourceRoute)}`); }
  catch { return null; }
  if (url.origin !== localOrigin && url.origin !== PRODUCTION_ORIGIN) return null;
  return canonicalRoute(url.pathname);
}

async function renderedAnchors(page) {
  return page.locator('a[href]').evaluateAll((anchors) => {
    function meaningful(anchor) {
      const text = String(anchor.textContent || '').replace(/\s+/g, ' ').trim();
      const aria = String(anchor.getAttribute('aria-label') || '').trim();
      const title = String(anchor.getAttribute('title') || '').trim();
      const imageAlt = [...anchor.querySelectorAll('img[alt]')]
        .map((image) => String(image.getAttribute('alt') || '').trim())
        .filter(Boolean)
        .join(' ');
      return Boolean(text || aria || title || imageAlt);
    }

    function rendered(anchor) {
      if (anchor.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
      if (!meaningful(anchor)) return false;

      for (let node = anchor; node && node instanceof Element; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === 'none') return false;
        if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
        if (Number.parseFloat(style.opacity || '1') <= 0.001) return false;
        if (style.contentVisibility === 'hidden') return false;
        if (style.pointerEvents === 'none') return false;
      }

      const rects = [...anchor.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
      if (!rects.length) return false;
      const doc = document.documentElement;
      const maxX = Math.max(doc.scrollWidth, doc.clientWidth);
      const maxY = Math.max(doc.scrollHeight, doc.clientHeight);
      return rects.some((rect) => rect.right > 0 && rect.left < maxX && rect.bottom > 0 && rect.top < maxY);
    }

    return anchors
      .filter(rendered)
      .map((anchor) => ({
        href: anchor.getAttribute('href') || '',
        rel: anchor.getAttribute('rel') || '',
        text: String(anchor.textContent || anchor.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      }));
  });
}

async function assertBrowserFixtures(page) {
  await page.setContent(`<!doctype html><html><head><style>
    .display-none { display:none }
    .visibility-hidden { visibility:hidden }
    .opacity-zero { opacity:0 }
    .pointer-none { pointer-events:none }
    .off-canvas { position:absolute; left:-10000px; top:0 }
  </style></head><body>
    <a href="/visible/">Visible witness</a>
    <div hidden><a href="/hidden-parent/">Hidden parent</a></div>
    <div aria-hidden="true"><a href="/aria-hidden-parent/">ARIA hidden parent</a></div>
    <div inert><a href="/inert-parent/">Inert parent</a></div>
    <div class="display-none"><a href="/display-none/">Display none</a></div>
    <div class="visibility-hidden"><a href="/visibility-hidden/">Visibility hidden</a></div>
    <div class="opacity-zero"><a href="/opacity-zero/">Opacity zero</a></div>
    <div class="pointer-none"><a href="/pointer-none/">Pointer none</a></div>
    <a class="off-canvas" href="/off-canvas/">Off canvas</a>
    <a href="/empty/"></a>
  </body></html>`);
  const hrefs = (await renderedAnchors(page)).map((item) => item.href).sort();
  const expected = ['/visible/'];
  if (JSON.stringify(hrefs) !== JSON.stringify(expected)) {
    throw new Error(`rendered-anchor adversarial fixtures failed: got ${JSON.stringify(hrefs)}, expected ${JSON.stringify(expected)}`);
  }
}

async function main() {
  if (!fs.existsSync(DIST)) throw new Error(`production-like dist is missing: ${DIST}`);

  const registry = buildPublicSurfaceRegistry();
  if (registry.errors.length) {
    throw new Error(`public-surface registry is invalid:\n${registry.errors.join('\n')}`);
  }

  const entries = registry.entries.map((entry) => ({ ...entry, route: canonicalRoute(entry.route) }));
  const entryByRoute = new Map(entries.map((entry) => [entry.route, entry]));
  const readingRoutes = entries
    .filter((entry) => entry.routeRole === 'reading')
    .map((entry) => entry.route)
    .sort();
  const readingSet = new Set(readingRoutes);
  const inbound = new Map(readingRoutes.map((route) => [route, new Map()]));
  const missingBuiltSources = readingRoutes.filter((route) => !fs.existsSync(distFileForRoute(route)));

  const server = await startDistServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1280, height: 900 },
    });
    await context.route('**/*', async (route) => {
      const type = route.request().resourceType();
      if (['image', 'font', 'media'].includes(type)) return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(12_000);
    await assertBrowserFixtures(page);

    for (const source of entries) {
      if (NON_HUMAN_SOURCE_ROUTES.has(source.route)) continue;
      const file = distFileForRoute(source.route);
      if (!fs.existsSync(file)) continue;

      const response = await page.goto(`${server.origin}${source.route}`, { waitUntil: 'domcontentloaded' });
      if (!response || !response.ok()) {
        throw new Error(`cannot render public source route ${source.route}: HTTP ${response?.status() ?? '<no response>'}`);
      }

      for (const anchor of await renderedAnchors(page)) {
        if (/\bnofollow\b/i.test(anchor.rel)) continue;
        const target = resolvePublicRoute(anchor.href, source.route, server.origin);
        if (!target || !readingSet.has(target) || target === source.route) continue;
        const witnesses = inbound.get(target);
        if (!witnesses.has(source.route)) {
          witnesses.set(source.route, { source: source.route, href: anchor.href, text: anchor.text });
        }
      }
    }

    await context.close();
  } finally {
    await browser.close();
    await server.close();
  }

  const routes = readingRoutes.map((route) => {
    const entry = entryByRoute.get(route);
    const witnesses = [...inbound.get(route).values()].sort((a, b) => a.source.localeCompare(b.source));
    return {
      route,
      surface: entry?.surface || null,
      routeType: entry?.routeType || null,
      section: entry?.section || null,
      inboundCount: witnesses.length,
      witnesses,
      status: witnesses.length ? 'GOLD' : 'BLOCKED',
    };
  });

  const orphans = routes.filter((item) => item.inboundCount === 0).map((item) => item.route);
  const report = {
    schemaVersion: 2,
    authority: 'scripts/lib/public-surface-registry.js',
    evidenceMode: 'rendered-chromium-static-navigation',
    productSha: process.env.GITHUB_SHA || null,
    readingRoutes: routes.length,
    reachableRoutes: routes.length - orphans.length,
    orphanRoutes: orphans,
    missingBuiltReadingRoutes: missingBuiltSources.sort(),
    excludedSourceRoutes: [...NON_HUMAN_SOURCE_ROUTES].sort(),
    rules: {
      selfLinksCount: false,
      searchCounts: false,
      sitemapCounts: false,
      rssCounts: false,
      externalLinksCount: false,
      hiddenOrAriaHiddenAncestorsCount: false,
      cssHiddenOrNonRenderedAnchorsCount: false,
      pointerDisabledAnchorsCount: false,
      emptyUnlabelledAnchorsCount: false,
      nofollowAnchorsCount: false,
      javascriptEnabled: false,
    },
    routes,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Human reachability: ${report.reachableRoutes}/${report.readingRoutes}`);
  if (missingBuiltSources.length) {
    console.error(`❌ Built reading routes missing: ${missingBuiltSources.join(', ')}`);
  }
  if (orphans.length) {
    console.error(`❌ Human-orphan reading routes: ${orphans.join(', ')}`);
  }
  if (missingBuiltSources.length || orphans.length) process.exit(1);
  console.log('✅ Every current reading route has a distinct rendered public human inbound-link witness.');
}

main().catch((error) => {
  console.error(`FATAL ${error?.stack || error}`);
  process.exit(1);
});
