#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_DIST = path.join(ROOT, 'dist');
const DEFAULT_REPORT = path.join(ROOT, 'reports', 'series-reader-fragment-audit.json');
const SERIES_MARKERS = [/\bgbs2-toc\b/, /\bgbat-subs\b/];

function decodeEntity(value) {
  return String(value || '')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)));
}

function decodeFragment(value) {
  const decoded = decodeEntity(value);
  try { return decodeURIComponent(decoded); }
  catch (_) { return decoded; }
}

function walkHtml(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkHtml(full));
    else if (entry.isFile() && entry.name === 'index.html') out.push(full);
  }
  return out;
}

function routeForFile(dist, file) {
  const rel = path.relative(dist, file).replace(/\\/g, '/');
  return rel === 'index.html' ? '/' : `/${rel.replace(/index\.html$/, '')}`;
}

function auditSeriesFragments(options = {}) {
  const dist = path.resolve(options.dist || DEFAULT_DIST);
  const reportPath = path.resolve(options.reportPath || DEFAULT_REPORT);
  const failOnMissingDist = options.failOnMissingDist !== false;

  if (!fs.existsSync(dist)) {
    const message = `series reader fragment audit: dist missing: ${path.relative(ROOT, dist)}`;
    if (failOnMissingDist) throw new Error(message);
    return { schemaVersion: 1, result: 'SKIP', dist, pages: [], errors: [], message };
  }

  const pages = [];
  const errors = [];
  for (const file of walkHtml(dist)) {
    const html = fs.readFileSync(file, 'utf8');
    if (!SERIES_MARKERS.some((marker) => marker.test(html))) continue;

    const ids = new Set();
    for (const match of html.matchAll(/\bid=["']([^"']+)["']/gi)) ids.add(decodeEntity(match[1]));
    for (const match of html.matchAll(/\bname=["']([^"']+)["']/gi)) ids.add(decodeEntity(match[1]));

    const links = new Map();
    for (const match of html.matchAll(/<a\b[^>]*\bhref=["']#([^"']*)["'][^>]*>/gi)) {
      const fragment = decodeFragment(match[1]);
      if (!fragment) continue;
      links.set(fragment, (links.get(fragment) || 0) + 1);
    }

    const missing = [...links.entries()]
      .filter(([fragment]) => !ids.has(fragment))
      .map(([fragment, occurrences]) => ({ fragment, occurrences }))
      .sort((a, b) => a.fragment.localeCompare(b.fragment, 'ru'));

    const route = routeForFile(dist, file);
    pages.push({
      route,
      file: path.relative(ROOT, file).replace(/\\/g, '/'),
      fragmentLinks: [...links.values()].reduce((sum, count) => sum + count, 0),
      uniqueFragments: links.size,
      missing,
    });
    for (const item of missing) {
      errors.push(`${route}#${item.fragment} (${item.occurrences} link${item.occurrences === 1 ? '' : 's'})`);
    }
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    dist: path.relative(ROOT, dist).replace(/\\/g, '/') || '.',
    pages,
    totals: {
      pages: pages.length,
      fragmentLinks: pages.reduce((sum, page) => sum + page.fragmentLinks, 0),
      uniqueFragments: pages.reduce((sum, page) => sum + page.uniqueFragments, 0),
      brokenUniqueFragments: errors.length,
    },
    errors,
    result: errors.length ? 'FAIL' : 'PASS',
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

function main() {
  const distArg = process.argv.find((arg) => arg.startsWith('--dist='));
  const reportArg = process.argv.find((arg) => arg.startsWith('--report='));
  const report = auditSeriesFragments({
    dist: distArg ? distArg.slice('--dist='.length) : DEFAULT_DIST,
    reportPath: reportArg ? reportArg.slice('--report='.length) : DEFAULT_REPORT,
  });

  if (report.result !== 'PASS') {
    console.error(`❌ Series reader fragment audit failed (${report.errors.length} broken unique fragment(s))`);
    report.errors.slice(0, 80).forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
  }
  console.log(`✅ Series reader fragments: ${report.totals.pages} page(s), ${report.totals.uniqueFragments} unique target(s), 0 broken`);
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    console.error(`❌ ${error.message || error}`);
    process.exit(1);
  }
}

module.exports = { auditSeriesFragments };
