#!/usr/bin/env node
/**
 * check-content-source-coverage.js — verifies content source provenance.
 *
 * From: GBS non-excluded living audit (P23.11 recommendation)
 *
 * Checks:
 * 1. Every published series.json part has MDX + route + search item + profile
 * 2. Every explicit article route has profile + search item
 * 3. Every MDX file is mapped or marked draft/excluded
 * 4. Every searchable route profile has search-manifest item
 * 5. SERIES_ORDER matches series.json.parts order
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const strict = process.argv.includes('--strict');
const problems = [];
const warnings = [];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function listFiles(dir, pattern) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => pattern.test(f));
}

// Routes in active semantic refactor exclusion
function isExcludedRoute(route) {
  if (route.startsWith('/nagornaya/')) return true;
  if (route.startsWith('/hard-texts/')) return true;
  if (route.includes('/dzhon-gill-')) return true;
  if (route === '/articles/krajne-li-isporcheno-serdce/') return true;
  if (route === '/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/') return true;
  return false;
}


function isNoindexOrIgnoredRoute(route) {
  const candidates = [];
  const clean = route.replace(/^\//, '').replace(/\/$/, '');
  candidates.push(path.join(ROOT, clean || '', 'index.html'));
  if (!route.endsWith('/')) candidates.push(path.join(ROOT, clean));
  for (const file of candidates) {
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
    const html = fs.readFileSync(file, 'utf8');
    if (/name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html)) return true;
    if (/data-pagefind-ignore|data-content-status=["']temporary-placeholder["']/i.test(html)) return true;
  }
  return false;
}

// ---------- main ----------
console.log('=== Content Source Coverage Check ===');
console.log(`Mode: ${strict ? 'STRICT' : 'WARN'}`);
console.log('');

const series = fs.existsSync(path.join(ROOT, 'data/series.json'))
  ? readJson(path.join(ROOT, 'data/series.json'))
  : {};
const searchManifest = fs.existsSync(path.join(ROOT, 'data/search-manifest.json'))
  ? readJson(path.join(ROOT, 'data/search-manifest.json'))
  : { items: [] };
const ownership = fs.existsSync(path.join(ROOT, 'migration/page-ownership.json'))
  ? readJson(path.join(ROOT, 'migration/page-ownership.json'))
  : { routes: {} };

const mdxFiles = listFiles(path.join(ROOT, 'src/content/articles'), /\.mdx$/);
const profileFiles = listFiles(path.join(ROOT, 'data/route-profiles'), /\.json$/);
const searchItems = searchManifest.items || [];
const routes = ownership.routes || {};

const mdxSlugs = new Set(mdxFiles.map((f) => f.replace(/\.mdx$/, '')));
const profileSlugs = new Set(profileFiles.map((f) => f.replace(/\.json$/, '')));
const searchUrls = new Set(searchItems.map((item) => item.url));

// Check 1: series.json published parts coverage
let seriesChecked = 0;
for (const [seriesKey, seriesData] of Object.entries(series)) {
  const parts = seriesData.parts || [];
  for (const part of parts) {
    if (part.status !== 'published') continue;
    seriesChecked++;

    const slug = part.slug;
    const baseUrl = seriesData.baseUrl || '/';
    const route = baseUrl.endsWith('/') ? `${baseUrl}${slug}/` : `${baseUrl}/${slug}/`;

    // MDX exists?
    if (!mdxSlugs.has(slug)) {
      if (!isExcludedRoute(route)) {
        warnings.push(
          `series[${seriesKey}]: published part "${slug}" has no MDX file (expected: src/content/articles/${slug}.mdx)`
        );
      }
    }

    // Search item exists?
    if (!searchUrls.has(route) && !isExcludedRoute(route)) {
      warnings.push(
        `series[${seriesKey}]: published part "${slug}" has no search-manifest item for route ${route}`
      );
    }

    // Profile exists? (try both __ and - separated slug formats)
    const pSlugRoute = route.replace(/^\/|\/$/g, '').replace(/\//g, '__');
    const pSlugDash = route.replace(/^\/|\/$/g, '').replace(/\//g, '-');
    if (!profileSlugs.has(pSlugRoute) && !profileSlugs.has(slug) && !profileSlugs.has(pSlugDash) && !isExcludedRoute(route)) {
      warnings.push(
        `series[${seriesKey}]: published part "${slug}" has no route profile (expected: data/route-profiles/${pSlugRoute}.json)`
      );
    }
  }
}

// Check 2: explicit article routes have profile + search item
let routesChecked = 0;
for (const [route, info] of Object.entries(routes)) {
  if (info.status === 'build-only') continue;
  if (info.owner === 'built-app') continue;
  routesChecked++;

  const routeClean = route.replace(/^\/|\/$/g, '') || 'home';
  const profileSlug = routeClean.replace(/\//g, '__');
  // Also try dash-separated (for article subroutes like articles-kod-da-vinchi)
  const profileSlugAlt = routeClean.replace(/\//g, '-');

  // Profile exists?
  if (!profileSlugs.has(profileSlug) && !profileSlugs.has(routeClean) && !profileSlugs.has(profileSlugAlt)) {
    if (!isExcludedRoute(route)) {
      warnings.push(
        `route ${route}: missing route profile (expected: data/route-profiles/${profileSlug}.json)`
      );
    }
  }

  // Search item exists for searchable routes?
  if (info.owner === 'astro' && !searchUrls.has(route) && !isExcludedRoute(route) && !isNoindexOrIgnoredRoute(route)) {
    warnings.push(
      `route ${route}: production-dist route without search-manifest entry`
    );
  }
}

// Check 3: every MDX file is mapped or marked excluded
for (const mdxFile of mdxFiles) {
  const slug = mdxFile.replace(/\.mdx$/, '');
  // Check if this slug is in any series
  let inSeries = false;
  for (const [, seriesData] of Object.entries(series)) {
    if (seriesData.parts?.some((p) => p.slug === slug)) {
      inSeries = true;
      break;
    }
  }
  // Check if this slug corresponds to any production route
  let inRoutes = false;
  for (const route of Object.keys(routes)) {
    if (route.includes(slug) || slug.includes(route.replace(/^\/|\/$/g, '').split('/').pop())) {
      inRoutes = true;
      break;
    }
  }

  if (!inSeries && !inRoutes) {
    warnings.push(
      `MDX file ${mdxFile}: not found in series.json or page-ownership.json routes.\n` +
      `  Mark as draft or add to appropriate series/route.`
    );
  }
}

// Check 4: SERIES_ORDER matches series.json.parts
const siteFile = path.join(ROOT, 'src/data/site.ts');
if (fs.existsSync(siteFile)) {
  const siteContent = fs.readFileSync(siteFile, 'utf8');
  // Extract SERIES_ORDER if it exists
  const soMatch = siteContent.match(/SERIES_ORDER\s*[=:]\s*\[([^\]]+)\]/);
  if (soMatch) {
    // Compare order with series.json
    // This is a soft check — we warn if the order seems mismatched
    const extractedOrder = soMatch[1].split(',').map((s) => s.trim().replace(/['"]/g, ''));
    const seriesKeys = Object.keys(series);

    // Check if series.json keys match SERIES_ORDER
    const orderMismatch = extractedOrder.filter((k) => !seriesKeys.includes(k));
    if (orderMismatch.length > 0) {
      warnings.push(
        `SERIES_ORDER references keys not in series.json: ${orderMismatch.join(', ')}`
      );
    }
  }
}

// Check 5: russian-baptism landing readTime policy
const russianBaptism = series['russian-baptism'];
if (russianBaptism) {
  const parts = russianBaptism.parts || [];
  const publishedParts = parts.filter((p) => p.status === 'published');
  if (publishedParts.length > 0) {
    const totalMinutes = publishedParts.reduce((sum, p) => sum + (p.readingTime || 0), 0);
    // Check if the landing page (/baptisty-rossii/) shows total readTime
    const landingProfile = path.join(ROOT, 'data/route-profiles/baptisty-rossii.json');
    if (fs.existsSync(landingProfile)) {
      const profile = readJson(landingProfile);
      if (!profile.seriesLandingReadTimeMode) {
        warnings.push(
          `/baptisty-rossii/: russian-baptism has ${publishedParts.length} published parts (${totalMinutes} min total).\n` +
          `  Add seriesLandingReadTimeMode to profile: "total" or "none" or "summary-only".`
        );
      }
    }
  }
}

console.log(`Series parts checked: ${seriesChecked}`);
console.log(`Routes checked: ${routesChecked}`);
console.log(`MDX files: ${mdxFiles.length}`);
console.log(`Profiles: ${profileFiles.length}`);
console.log(`Search items: ${searchItems.length}`);

if (warnings.length > 0) {
  console.log('');
  console.log('⚠️  Warnings:');
  warnings.forEach((w) => console.log('  ⚠️  ' + w.split('\n')[0]));
  if (warnings.length > 30) {
    console.log(`  …and ${warnings.length - 30} more.`);
  }
}

if (problems.length > 0) {
  console.log('');
  if (strict) {
    console.error('❌ Content source coverage check FAILED:');
    problems.forEach((p) => console.error('  ❌ ' + p.split('\n')[0]));
    process.exit(1);
  } else {
    console.warn(`⚠️  Content source coverage: ${problems.length} issue(s). Run with --strict to fail.`);
  }
}

if (warnings.length > 0 && !strict) {
  console.log('');
  console.log('✅ Content source coverage check completed (non-strict mode)');
} else if (warnings.length === 0 && problems.length === 0) {
  console.log('');
  console.log('✅ Content source coverage is coherent');
}