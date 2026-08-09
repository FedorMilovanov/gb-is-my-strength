#!/usr/bin/env node
/* TODO: move route contracts to data/visual-route-contracts.json */
/* Prefer stable data markers over string literals like "Desktop sidebar" */

/*
 * visual-parity-contract.js — hard stop for future root→dist production switch.
 *
 * Text/SEO parity is not visual parity. This gate checks route-specific DOM
 * markers that represent the legacy premium layouts. It intentionally fails the
 * current generic Astro rewrites for Nagornaya, Gill, articles/biographies/about
 * if they are promoted into dist without preserving the old visual contract.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  listReferenceRoutes,
  resolveReferenceForRoute,
} = require('../migration/legacy-reference-path.js');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const REFERENCE_ROUTES = new Set(listReferenceRoutes());
const problems = [];

function relToFile(root, rel) { return path.join(root, rel); }
function read(file) { return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''; }
function bad(msg) { problems.push(msg); console.log('❌ ' + msg); }
function ok(msg) { console.log('✅ ' + msg); }
function routeLabel(rel) { return rel.replace(/\/index\.html$/, '/').replace(/^index\.html$/, '/'); }
function legacyFileFor(rel) {
  const route = routeLabel(rel);
  if (!REFERENCE_ROUTES.has(route)) return relToFile(ROOT, rel);
  return resolveReferenceForRoute(route, { root: ROOT }).absolutePath;
}

const CONTRACTS = [
  {
    rel: 'index.html',
    require: ['home-v20', 'h-hero-title'],
    forbid: ['h-home-entry-strip'],
  },
  {
    rel: 'articles/index.html',
    require: ['articles-index-page', 'home-v20', 'h-hero-title', 'h-article-card'],
    forbid: ['astro-page', 'astro-card-grid'],
  },
  {
    rel: 'biografii/index.html',
    require: ['home-v20', 'h-hero-title', 'h-article-card', 'Джон Гилл'],
    forbid: ['astro-page', 'astro-card-grid'],
  },
  {
    rel: 'about/index.html',
    require: ['about-page', 'about-resources', 'about-contact-card', 'Фёдор Милованов'],
    forbid: ['astro-page__header', 'astro-card-grid'],
  },
  {
    rel: 'nagornaya/index.html',
    require: ['nagornaya-page', 'Desktop sidebar', 'Нагорная проповедь'],
    forbid: ['astro-nagornaya-index', 'astro-card-grid'],
  },
  {
    rel: 'nagornaya/seriya/index.html',
    require: ['nagornaya-page nagornaya-series-page', 'home-v20', 'h-hero-title', 'h-article-card'],
    forbid: ['astro-series-page', 'astro-card-grid'],
  },
  ...['chast-1', 'chast-2', 'chast-3', 'chast-4', 'chast-5'].map((part) => ({
    rel: `nagornaya/${part}/index.html`,
    require: ['nagornaya-page', 'Desktop sidebar', 'nag-sidebar-controls'],
    forbid: ['astro-article', 'astro-card-grid'],
  })),
  ...[
    'dzhon-gill-istoricheskiy-kontekst',
    'dzhon-gill-chast-1-chelovek',
    'dzhon-gill-chast-2-uchenyi',
    'dzhon-gill-chast-3-nasledie',
    'dzhon-gill-chast-4-ekzeget',
    'dzhon-gill-spravochnik',
  ].map((slug) => ({
    rel: `articles/${slug}/index.html`,
    require: ['gbs-world', 'data-gbs2-series="dzhon-gill"', 'gbs2-hero'],
    forbid: ['astro-article', 'astro-series-nav'],
  })),
];

if (!fs.existsSync(DIST)) {
  bad('dist/ missing; run production-like dist build before visual parity contract');
} else {
  for (const contract of CONTRACTS) {
    const route = routeLabel(contract.rel);
    const legacy = read(legacyFileFor(contract.rel));
    const dist = read(relToFile(DIST, contract.rel));
    if (!legacy) { bad(`${route}: legacy source missing (${contract.rel})`); continue; }
    if (!dist) { bad(`${route}: dist output missing (${contract.rel})`); continue; }

    for (const marker of contract.require) {
      if (!dist.includes(marker)) bad(`${route}: dist missing required visual marker: ${marker}`);
      else ok(`${route}: marker present: ${marker}`);
      if (!legacy.includes(marker)) console.log(`ℹ️ ${route}: marker is not in legacy source; review contract marker: ${marker}`);
    }
    for (const marker of contract.forbid || []) {
      if (dist.includes(marker)) bad(`${route}: dist contains forbidden generic/regression marker: ${marker}`);
      else ok(`${route}: forbidden marker absent: ${marker}`);
    }
  }
}

console.log('\nVISUAL PARITY CONTRACT');
if (problems.length) {
  console.log(`❌ ${problems.length} problem(s). This is NOT production-ready visual parity.`);
  process.exit(1);
}
console.log('✅ Visual parity contract passed');
