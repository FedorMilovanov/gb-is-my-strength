#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { loadRouteRecords } = require('./lib/effective-route-registry');
const { normalizeRoute, parseRss } = require('./lib/rss-route-contract');
const {
  POLICY_FIELDS,
  normalizePolicyRoutes,
  auditSearchIndexPolicy,
} = require('./lib/search-index-policy-contract');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv = process.argv.slice(2)) {
  const options = { dist: 'dist', strict: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--strict') options.strict = true;
    else if (arg === '--dist') options.dist = argv[++index];
    else if (arg.startsWith('--dist=')) options.dist = arg.slice('--dist='.length);
  }
  return options;
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function readText(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function routeToDistFile(route, distRoot) {
  const clean = normalizeRoute(route).replace(/^\/+|\/+$/g, '');
  return path.join(distRoot, clean, 'index.html');
}

function sameOriginRoute(value, siteOrigin = 'https://gospod-bog.ru') {
  try {
    const url = new URL(value, siteOrigin);
    if (url.origin !== new URL(siteOrigin).origin) return null;
    return normalizeRoute(url.pathname);
  } catch {
    return null;
  }
}

function parseSitemapRoutes(xml) {
  return new Set(
    [...String(xml || '').matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
      .map((match) => sameOriginRoute(match[1].trim()))
      .filter(Boolean)
  );
}

function parseManifest(manifest) {
  const routes = new Map();
  const anchored = [];
  for (const item of Array.isArray(manifest?.items) ? manifest.items : []) {
    if (!item?.url) continue;
    if (String(item.url).includes('#')) {
      anchored.push({ id: item.id || null, url: item.url, type: item.type || null });
      continue;
    }
    routes.set(normalizeRoute(item.url), item);
  }
  return { routes, anchored };
}

function extractMetaContent(html, name) {
  const tags = String(html || '').match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const nameMatch = tag.match(/\bname\s*=\s*["']([^"']+)["']/i);
    if (!nameMatch || nameMatch[1].toLowerCase() !== String(name).toLowerCase()) continue;
    const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
    return contentMatch ? contentMatch[1].trim() : '';
  }
  return '';
}

function countMatches(value, re) {
  return (String(value || '').match(re) || []).length;
}

function currentStateForRoute(record, context) {
  const route = normalizeRoute(record.route);
  const distFile = routeToDistFile(route, context.distRoot);
  const exists = fs.existsSync(distFile);
  const html = exists ? fs.readFileSync(distFile, 'utf8') : '';
  const robots = extractMetaContent(html, 'robots');
  const manifestItem = context.manifest.routes.get(route) || null;
  const profile = record.profile || {};

  return {
    route,
    owner: record.owner?.owner || null,
    ownerStatus: record.owner?.status || null,
    source: record.sourceRel || record.owner?.source || null,
    profileFile: record.profileFile || null,
    routeType: profile.routeType || null,
    surface: profile.surface || null,
    seriesShape: profile.seriesShape || null,
    section: profile.section || null,
    migrationMode: profile.migrationMode || record.matrix?.mode || null,
    semanticScope: profile.scope || null,
    publicationContract: profile.publicationContract || null,
    policy: context.policyRoutes.get(route) || null,
    dist: {
      file: path.relative(ROOT, distFile).replace(/\\/g, '/'),
      exists,
      robots,
      noindex: /(?:^|[,\s])noindex(?:$|[,\s])/i.test(robots),
      pagefindBodyCount: countMatches(html, /\bdata-pagefind-body\b/gi),
      pagefindIgnoreCount: countMatches(html, /\bdata-pagefind-ignore\b/gi),
      pagefindMetaCount: countMatches(html, /\bdata-pagefind-meta\b/gi),
      pagefindFilterCount: countMatches(html, /\bdata-pagefind-filter\b/gi),
    },
    membership: {
      searchManifest: Boolean(manifestItem),
      sitemap: context.sitemapRoutes.has(route),
      rss: context.rssRoutes.has(route),
    },
    manifest: manifestItem ? {
      id: manifestItem.id || null,
      type: manifestItem.type || null,
      title: manifestItem.title || null,
      section: manifestItem.section || null,
      publishedTime: manifestItem.publishedTime || null,
      modifiedTime: manifestItem.modifiedTime || null,
    } : null,
  };
}

function summarize(routes, audit) {
  const count = (fn) => routes.filter(fn).length;
  return {
    productionRoutes: routes.length,
    policyRoutes: audit.policyRouteCount,
    contractProblems: audit.problems.length,
    distMissing: count((item) => !item.dist.exists),
    explicitNoindexInDist: count((item) => item.dist.noindex),
    pagefindBodyRoutes: count((item) => item.dist.pagefindBodyCount > 0),
    searchManifestMembers: count((item) => item.membership.searchManifest),
    sitemapMembers: count((item) => item.membership.sitemap),
    rssMembers: count((item) => item.membership.rss),
  };
}

function markdownReport(report) {
  const problemsByRoute = new Map(report.audit.routeResults.map((item) => [item.route, item.problems]));
  const lines = [
    '# Search & Index Policy contract',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    '| Metric | Count |',
    '|---|---:|',
    ...Object.entries(report.summary).map(([key, value]) => `| ${key} | ${value} |`),
    '',
    '## Routes',
    '',
    '| Route | Kind | Index | Pagefind | Manifest | Sitemap | RSS | Problems |',
    '|---|---|---|---|---|---|---|---|',
    ...report.routes.map((item) => {
      const policy = item.policy || {};
      const observed = item.membership;
      const problems = problemsByRoute.get(item.route) || [];
      return [
        `| \`${item.route}\``,
        policy.contentKind || '—',
        `${policy.indexPolicy || '—'} / ${item.dist.noindex ? 'noindex' : 'index'}`,
        `${policy.pagefindPolicy || '—'} / body:${item.dist.pagefindBodyCount}`,
        `${policy.searchManifestPolicy || '—'} / ${observed.searchManifest ? 'in' : 'out'}`,
        `${policy.sitemapPolicy || '—'} / ${observed.sitemap ? 'in' : 'out'}`,
        `${policy.rssPolicy || '—'} / ${observed.rss ? 'in' : 'out'}`,
        problems.length ? problems.join('<br>') : '—',
      ].join(' | ') + ' |';
    }),
    '',
    '## Contract problems',
    '',
    ...(report.audit.problems.length ? report.audit.problems.map((problem) => `- ${problem}`) : ['- none']),
    '',
    '## Anchored search-manifest entries',
    '',
    ...(report.anchoredManifestEntries.length
      ? report.anchoredManifestEntries.map((item) => `- \`${item.url}\` (${item.type || 'unknown'}, ${item.id || 'no id'})`)
      : ['- none']),
    '',
  ];
  return lines.join('\n');
}

function buildReport(options = parseArgs()) {
  const distRoot = path.resolve(ROOT, options.dist);
  const loaded = loadRouteRecords();
  const policyRegistry = readJson('data/route-search-policy.json');
  const policyRoutes = normalizePolicyRoutes(policyRegistry);
  const manifest = parseManifest(readJson('data/search-manifest.json'));
  const sitemapRoutes = parseSitemapRoutes(readText('sitemap.xml'));
  const rssRoutes = new Set(
    parseRss(readText('feed.xml')).items
      .map((item) => sameOriginRoute(item.link))
      .filter(Boolean)
  );

  const records = loaded.records
    .filter((record) => record.owner?.status === 'production-dist')
    .sort((a, b) => normalizeRoute(a.route).localeCompare(normalizeRoute(b.route), 'ru'));
  const context = { distRoot, manifest, sitemapRoutes, rssRoutes, policyRoutes };
  const routes = records.map((record) => currentStateForRoute(record, context));
  const audit = auditSearchIndexPolicy({
    registry: policyRegistry,
    productionRecords: records,
    observations: routes,
  });

  return {
    generatedAt: new Date().toISOString(),
    exactHead: process.env.GITHUB_HEAD_SHA || process.env.GITHUB_SHA || null,
    distRoot: path.relative(ROOT, distRoot).replace(/\\/g, '/'),
    policyFields: POLICY_FIELDS,
    policyVersion: policyRegistry.version || null,
    summary: summarize(routes, audit),
    anchoredManifestEntries: manifest.anchored,
    audit,
    routes,
  };
}

function main() {
  const options = parseArgs();
  const report = buildReport(options);
  const reportsDir = path.join(ROOT, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, 'search-index-policy-inventory.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(reportsDir, 'search-index-policy-inventory.md'), markdownReport(report) + '\n');

  console.log(
    `✅ Search/index policy: ${report.summary.productionRoutes} production routes, `
    + `${report.summary.policyRoutes} policies, ${report.summary.contractProblems} problem(s)`
  );

  if (options.strict) {
    const problems = [...report.audit.problems];
    if (report.summary.distMissing) {
      problems.push(`${report.summary.distMissing} production route(s) missing dist output`);
    }
    if (problems.length) {
      for (const problem of problems) console.error(`❌ ${problem}`);
      process.exit(1);
    }
  }
}

if (require.main === module) main();

module.exports = {
  parseArgs,
  parseSitemapRoutes,
  parseManifest,
  extractMetaContent,
  currentStateForRoute,
  summarize,
  buildReport,
  markdownReport,
};
