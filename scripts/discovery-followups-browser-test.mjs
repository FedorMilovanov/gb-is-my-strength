#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { normalizeRoute, parseRss } = require('./lib/rss-route-contract.js');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    dist: 'dist',
    report: 'reports/a15-discovery-followups',
  };
  for (const arg of argv) {
    if (arg.startsWith('--dist=')) options.dist = arg.slice('--dist='.length);
    else if (arg.startsWith('--report=')) options.report = arg.slice('--report='.length);
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function readText(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function canonicalRoute(value, base = 'https://gospod-bog.ru') {
  const pathname = new URL(String(value || '/'), base).pathname.replace(/\/index\.html$/u, '/');
  return normalizeRoute(pathname);
}

function manifestRouteMap(manifest) {
  const routes = new Map();
  for (const item of Array.isArray(manifest?.items) ? manifest.items : []) {
    if (!item?.url || String(item.url).includes('#') || String(item.url).includes('?')) continue;
    const route = canonicalRoute(item.url);
    assert(!routes.has(route), `${route}: duplicate canonical manifest route`);
    routes.set(route, item);
  }
  return routes;
}

function classifyRss(policyRoutes, rssRoutes) {
  return [...policyRoutes.entries()].sort(([left], [right]) => left.localeCompare(right, 'ru')).map(([route, policy]) => {
    const expected = policy?.rssPolicy === 'include';
    const actual = rssRoutes.has(route);
    return {
      route,
      expected: expected ? 'include' : 'exclude',
      actual: actual ? 'included' : 'excluded',
      disposition: expected === actual
        ? (expected ? 'INCLUDED_BY_POLICY' : 'EXCLUDED_BY_POLICY')
        : 'BLOCKING_POLICY_DRIFT',
    };
  });
}

function noindexLeaks(indexedRoutes, noindexRoutes) {
  return [...noindexRoutes].filter((route) => indexedRoutes.has(route)).sort();
}

function scriptureQueryCandidates(scripture) {
  const first = String(scripture || '').split(',')[0].trim();
  assert(first, 'scripture fixture must have a non-empty first reference');
  const bookMap = [
    [/^Мф\b/u, 'Матфея'],
    [/^Лк\b/u, 'Луки'],
    [/^Ин\b/u, 'Иоанна'],
    [/^Рим\b/u, 'Римлянам'],
    [/^1\s+Тим\b/u, '1 Тимофею'],
    [/^2\s+Тим\b/u, '2 Тимофею'],
  ];
  const expand = (value) => {
    for (const [pattern, replacement] of bookMap) {
      if (pattern.test(value)) return value.replace(pattern, replacement);
    }
    return value;
  };
  const chapterOnly = first.replace(/[:–—-].*$/u, '').trim();
  return [...new Set([
    first,
    expand(first),
    chapterOnly,
    expand(chapterOnly),
  ].filter(Boolean))];
}

function sourcePathsForNagornayaRoute(route) {
  const match = route.match(/^\/nagornaya\/chast-([1-5])\/$/u);
  assert(match, `${route}: expected a canonical Nagornaya part route`);
  const part = match[1];
  return {
    part,
    routePath: `src/pages/nagornaya/chast-${part}/index.astro`,
    bodyPath: `src/components/nagornaya/chast-${part}/NagornayaChast${part}MainShell.astro`,
  };
}

function verifyCanonicalScriptureSources(fixtures) {
  const rows = [];
  for (const fixture of fixtures) {
    const paths = sourcePathsForNagornayaRoute(fixture.route);
    const bodySource = readText(paths.bodyPath);
    const routeSource = readText(paths.routePath);
    const combined = `${routeSource}\n${bodySource}`;
    const markerCount = (combined.match(/data-pagefind-meta="scripture"/gu) || []).length;
    assert.equal(markerCount, 1, `${fixture.route}: expected exactly one scripture marker across route and body`);
    if (['4', '5'].includes(paths.part)) {
      const marker = `<span data-pagefind-meta="scripture" hidden>${fixture.scripture}</span>`;
      assert(routeSource.includes(marker), `${fixture.route}: repaired scripture marker must match canonical manifest`);
    }
    rows.push({
      route: fixture.route,
      scripture: fixture.scripture,
      markerOwner: ['4', '5'].includes(paths.part) ? paths.routePath : paths.bodyPath,
      canonicalExact: ['4', '5'].includes(paths.part),
    });
  }
  return rows;
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.wasm': 'application/wasm',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  })[ext] || 'application/octet-stream';
}

async function startStaticServer(distRoot) {
  const root = path.resolve(distRoot);
  assert(fs.existsSync(path.join(root, 'pagefind', 'pagefind.js')), 'Pagefind browser bundle is missing from dist');
  const server = http.createServer((request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (url.pathname === '/__a15-pagefind-probe/') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end('<!doctype html><html lang="ru"><body>A15 Pagefind probe</body></html>');
        return;
      }
      const pathname = decodeURIComponent(url.pathname);
      let target = path.resolve(root, `.${pathname}`);
      if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403).end('forbidden');
        return;
      }
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
      if (!fs.existsSync(target) && !path.extname(target)) target = path.join(target, 'index.html');
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        response.writeHead(404).end('not found');
        return;
      }
      response.writeHead(200, {
        'content-type': mimeType(target),
        'cache-control': 'no-store',
      });
      fs.createReadStream(target).pipe(response);
    } catch (error) {
      response.writeHead(500).end(error.message);
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert(address && typeof address === 'object', 'static server did not expose an address');
  return {
    server,
    origin: `http://127.0.0.1:${address.port}`,
  };
}

async function loadResultData(page, term) {
  return page.evaluate(async (searchTerm) => {
    const response = await window.__A15_PAGEFIND__.search(searchTerm);
    const data = await Promise.all(response.results.map((result) => result.data()));
    return data.map((item) => ({
      url: item.url,
      meta: item.meta || {},
    }));
  }, term);
}

function markdownReport(report) {
  const lines = [
    '# A15 — A02 discovery follow-ups evidence',
    '',
    `- Exact head: \`${report.exactHead || 'local'}\``,
    `- Generated: ${report.generatedAt}`,
    `- Pagefind indexed routes observed: ${report.summary.indexedRoutes}`,
    `- Canonical Nagornaya scripture fixtures: ${report.summary.nagornayaFixtures}`,
    `- Noindex routes checked: ${report.summary.noindexRoutes}`,
    `- Noindex leaks: ${report.summary.noindexLeaks}`,
    `- RSS include / exclude / drift: ${report.summary.rssIncluded} / ${report.summary.rssExcluded} / ${report.summary.rssDrift}`,
    '',
    '## Scripture queries',
    '',
    '| Route | Canonical scripture | Successful real query | Result count |',
    '|---|---|---|---:|',
    ...report.scriptureQueries.map((item) => `| \`${item.route}\` | ${item.scripture} | \`${item.query}\` | ${item.resultCount} |`),
    '',
    '## RSS disposition',
    '',
    `- \`INCLUDED_BY_POLICY\`: ${report.rssDisposition.filter((item) => item.disposition === 'INCLUDED_BY_POLICY').length}`,
    `- \`EXCLUDED_BY_POLICY\`: ${report.rssDisposition.filter((item) => item.disposition === 'EXCLUDED_BY_POLICY').length}`,
    `- \`BLOCKING_POLICY_DRIFT\`: ${report.rssDisposition.filter((item) => item.disposition === 'BLOCKING_POLICY_DRIFT').length}`,
    '',
    '## Result',
    '',
    '- Real Pagefind browser queries resolved every canonical Nagornaya scripture fixture.',
    '- Filter-only Pagefind enumeration contained no route governed as `noindex`.',
    '- RSS membership exactly matched the explicit route policy.',
    '- Negative fixtures proved that a synthetic noindex leak or RSS mismatch is blocking.',
    '',
  ];
  return lines.join('\n');
}

async function main() {
  const options = parseArgs();
  const distRoot = path.resolve(ROOT, options.dist);
  const manifest = readJson('data/search-manifest.json');
  const policyRegistry = readJson('data/route-search-policy.json');
  const manifestRoutes = manifestRouteMap(manifest);
  const policyRoutes = new Map(Object.entries(policyRegistry.routes || {}).map(([route, policy]) => [normalizeRoute(route), policy]));

  const fixtures = [...manifestRoutes.entries()]
    .filter(([route, item]) => /^\/nagornaya\/chast-[1-5]\/$/u.test(route) && item.scripture)
    .map(([route, item]) => ({ route, scripture: item.scripture }))
    .sort((left, right) => left.route.localeCompare(right.route, 'ru'));
  assert.equal(fixtures.length, 5, `expected five canonical Nagornaya scripture fixtures, found ${fixtures.length}`);
  for (const fixture of fixtures) {
    assert.equal(policyRoutes.get(fixture.route)?.pagefindPolicy, 'include', `${fixture.route}: fixture must remain Pagefind-included`);
  }
  const sourceFixtures = verifyCanonicalScriptureSources(fixtures);

  const noindexRoutes = new Set(
    [...policyRoutes.entries()]
      .filter(([, policy]) => policy?.indexPolicy === 'noindex')
      .map(([route, policy]) => {
        assert.equal(policy.pagefindPolicy, 'exclude', `${route}: noindex route must exclude Pagefind`);
        assert.equal(policy.searchManifestPolicy, 'exclude', `${route}: noindex route must exclude search manifest`);
        assert.equal(policy.sitemapPolicy, 'exclude', `${route}: noindex route must exclude sitemap`);
        assert.equal(policy.rssPolicy, 'exclude', `${route}: noindex route must exclude RSS`);
        return route;
      })
  );
  assert(noindexRoutes.size > 0, 'expected at least one governed noindex route');

  const rssRoutes = new Set(
    parseRss(readText('feed.xml')).items
      .map((item) => canonicalRoute(item.link))
  );
  const rssDisposition = classifyRss(policyRoutes, rssRoutes);
  const rssDrift = rssDisposition.filter((item) => item.disposition === 'BLOCKING_POLICY_DRIFT');
  assert.deepEqual(rssDrift, [], `RSS policy drift:\n${rssDrift.map((item) => JSON.stringify(item)).join('\n')}`);

  const syntheticNoindex = noindexRoutes.values().next().value;
  assert.deepEqual(noindexLeaks(new Set([syntheticNoindex]), noindexRoutes), [syntheticNoindex], 'negative noindex fixture must be detected');
  const syntheticRss = new Set(rssRoutes);
  syntheticRss.add(syntheticNoindex);
  assert(
    classifyRss(policyRoutes, syntheticRss).some((item) => item.route === syntheticNoindex && item.disposition === 'BLOCKING_POLICY_DRIFT'),
    'negative RSS fixture must be classified as blocking drift'
  );

  const { server, origin } = await startStaticServer(distRoot);
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`${origin}/__a15-pagefind-probe/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      window.__A15_PAGEFIND__ = await import('/pagefind/pagefind.js');
      if (typeof window.__A15_PAGEFIND__.init === 'function') await window.__A15_PAGEFIND__.init();
    });

    const allResults = await loadResultData(page, null);
    const indexedRoutes = new Set(allResults.map((item) => canonicalRoute(item.url, origin)));
    assert(indexedRoutes.size >= 50, `unexpectedly small Pagefind index: ${indexedRoutes.size} routes`);
    const leaks = noindexLeaks(indexedRoutes, noindexRoutes);
    assert.deepEqual(leaks, [], `noindex route(s) leaked into Pagefind: ${leaks.join(', ')}`);

    const scriptureQueries = [];
    for (const fixture of fixtures) {
      let successful = null;
      for (const query of scriptureQueryCandidates(fixture.scripture)) {
        const results = await loadResultData(page, query);
        const target = results.find((item) => canonicalRoute(item.url, origin) === fixture.route);
        if (target) {
          const scriptureMeta = String(target.meta?.scripture || '').trim();
          assert(scriptureMeta, `${fixture.route}: Pagefind result lost scripture metadata`);
          if (/\/chast-[45]\/$/u.test(fixture.route)) {
            assert.equal(scriptureMeta, fixture.scripture, `${fixture.route}: Pagefind scripture metadata differs from canonical manifest`);
          }
          successful = { query, resultCount: results.length, scriptureMeta };
          break;
        }
      }
      assert(successful, `${fixture.route}: no real Pagefind scripture query returned the canonical route`);
      scriptureQueries.push({ ...fixture, ...successful });
    }

    const report = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      exactHead: process.env.GITHUB_HEAD_SHA || process.env.GITHUB_SHA || null,
      sourceFixtures,
      scriptureQueries,
      noindexRoutes: [...noindexRoutes].sort(),
      noindexLeaks: leaks,
      rssDisposition,
      summary: {
        indexedRoutes: indexedRoutes.size,
        nagornayaFixtures: fixtures.length,
        noindexRoutes: noindexRoutes.size,
        noindexLeaks: leaks.length,
        rssIncluded: rssDisposition.filter((item) => item.disposition === 'INCLUDED_BY_POLICY').length,
        rssExcluded: rssDisposition.filter((item) => item.disposition === 'EXCLUDED_BY_POLICY').length,
        rssDrift: rssDrift.length,
      },
    };

    const reportBase = path.resolve(ROOT, options.report);
    fs.mkdirSync(path.dirname(reportBase), { recursive: true });
    fs.writeFileSync(`${reportBase}.json`, `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(`${reportBase}.md`, `${markdownReport(report)}\n`);
    console.log(
      `A15 DISCOVERY FOLLOW-UPS: PASS (${report.summary.nagornayaFixtures} scripture fixtures; `
      + `${report.summary.indexedRoutes} indexed routes; ${report.summary.noindexRoutes} noindex routes; `
      + `${report.summary.rssDrift} RSS drift)`
    );
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(`A15 DISCOVERY FOLLOW-UPS: FAIL — ${error.stack || error.message}`);
  process.exit(1);
});
