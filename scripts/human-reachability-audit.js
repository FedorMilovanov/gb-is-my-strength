#!/usr/bin/env node
'use strict';

/**
 * Derived CURRENT GOLD human-reachability audit.
 *
 * Authority:
 *   scripts/lib/public-surface-registry.js
 * Evidence:
 *   production-like dist HTML
 *
 * This is deliberately not a second publication registry. Every current
 * reading route is derived from the existing public-surface authority and must
 * have at least one real, static, human-facing inbound <a href> witness from a
 * different public route. Search, sitemap, RSS and self-links do not count.
 */

const fs = require('fs');
const path = require('path');
const { buildPublicSurfaceRegistry } = require('./lib/public-surface-registry');

const ROOT = process.cwd();
const DIST = process.env.DIST_ROOT || path.join(ROOT, 'dist');
const OUT = process.env.HUMAN_REACHABILITY_REPORT || path.join(ROOT, 'reports', 'current-gold', 'human-reachability.json');
const ORIGIN = 'https://gospod-bog.ru';
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

function stripNonDocumentMarkup(html) {
  return String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<template\b[\s\S]*?<\/template>/gi, '');
}

function extractAnchors(html) {
  const clean = stripNonDocumentMarkup(html);
  const anchors = [];
  const re = /<a\b([^>]*?)\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))([^>]*)>/gi;
  let match;
  while ((match = re.exec(clean))) {
    const attrs = `${match[1] || ''} ${match[5] || ''}`;
    const href = match[2] ?? match[3] ?? match[4] ?? '';
    if (/\bhidden\b/i.test(attrs) || /aria-hidden\s*=\s*["']?true/i.test(attrs)) continue;
    anchors.push({ href: String(href).trim(), attrs: attrs.trim() });
  }
  return anchors;
}

function resolvePublicRoute(href, sourceRoute) {
  if (!href || href.startsWith('#')) return null;
  if (/^(?:javascript|mailto|tel|data):/i.test(href)) return null;
  let url;
  try {
    url = new URL(href, `${ORIGIN}${canonicalRoute(sourceRoute)}`);
  } catch {
    return null;
  }
  if (url.origin !== ORIGIN) return null;
  return canonicalRoute(url.pathname);
}

function assertSelfFixtures() {
  const cases = [
    ['/articles/a/', '../b/', '/articles/b/'],
    ['/articles/a/', '/hard-texts/x/?q=1#p', '/hard-texts/x/'],
    ['/', '/articles/a/', '/articles/a/'],
    ['/articles/a/', '#note', null],
    ['/articles/a/', 'https://example.com/x/', null],
  ];
  for (const [source, href, expected] of cases) {
    const actual = resolvePublicRoute(href, source);
    if (actual !== expected) {
      throw new Error(`human-reachability resolver fixture failed: ${source} + ${href} => ${actual}; expected ${expected}`);
    }
  }
}

function main() {
  assertSelfFixtures();
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
  const missingBuiltSources = [];

  for (const source of entries) {
    if (NON_HUMAN_SOURCE_ROUTES.has(source.route)) continue;
    const file = distFileForRoute(source.route);
    if (!fs.existsSync(file)) {
      // Some non-HTML special/application surfaces can legitimately have a
      // different built shape. Reading routes, however, must always exist.
      if (source.routeRole === 'reading') missingBuiltSources.push(source.route);
      continue;
    }
    const html = fs.readFileSync(file, 'utf8');
    for (const anchor of extractAnchors(html)) {
      const target = resolvePublicRoute(anchor.href, source.route);
      if (!target || !readingSet.has(target) || target === source.route) continue;
      if (/\brel\s*=\s*["'][^"']*\bnofollow\b/i.test(anchor.attrs)) continue;
      const witnesses = inbound.get(target);
      if (!witnesses.has(source.route)) {
        witnesses.set(source.route, { source: source.route, href: anchor.href });
      }
    }
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
    schemaVersion: 1,
    authority: 'scripts/lib/public-surface-registry.js',
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
      hiddenAnchorsCount: false,
      nofollowAnchorsCount: false,
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
  console.log('✅ Every current reading route has a distinct public human inbound-link witness.');
}

try {
  main();
} catch (error) {
  console.error(`FATAL ${error?.stack || error}`);
  process.exit(1);
}
