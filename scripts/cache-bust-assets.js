#!/usr/bin/env node
'use strict';

/**
 * Shared asset list for cache-bust.js and audit-pro.js.
 *
 * Single source of truth — both scripts import from here,
 * eliminating manual sync drift. Loading the policy also performs the
 * read-only source-surface revision census so JS/MJS/TS/TSX/MDX constructors
 * cannot sit outside the canonical asset-revision evidence.
 *
 * Usage:
 *   const { ASSETS } = require('./cache-bust-assets');
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  collectProductSourceSurfaces,
  auditGovernedResourceVersions,
  assertSourceSurfaceMutationContract,
} = require('./lib/product-source-surfaces');

const ASSETS = [
  'css/site.css',
  'css/tts-download-notice.css',
  'css/reader-preferences.css',
  'css/home.css',
  'css/command-palette.css',
  'css/mobile-hotfix.css',
  'css/nagornaya-mobile-toc.css',
  'css/series-samizdat.css',
  'css/series-manuscript.css',
  'css/floating-cluster.css',
  'css/enhancements-runtime.css',
  'css/highlights-runtime.css',
  'css/sw-toast.css',
  'fonts/fonts.css',
  'nagornaya/tw.min.css',
  'js/site.js',
  'js/reader-preferences-head.js',
  'js/reader-preferences.js',
  'js/reader-state.js',
  'js/site-utils.js',
  'js/scroll-perf.js',
  'js/bookmark-engine.js',
  'js/enhancements.js',
  'js/highlights.js',
  'js/search.js',
  'js/sw-register.js',
  'js/nagornaya-mobile-toc.js',
  'js/nagornaya-bar-extras.js',
  'js/glossary.js',
  'js/vosk-tts-engine.js',
  'js/vosk-tts-worker.js',
  'js/floating-cluster-controller.js',
];

// Assets that are version-governed but intentionally fetched only on first use.
// Keep this policy beside ASSETS so cache revision ownership and SW download
// strategy cannot drift into contradictory hand-maintained lists.
// A dormant series theme stays lazy until a route opts into it through defineSeriesConfig.
const LAZY_NO_PRECACHE = Object.freeze([
  'js/search.js',
  'js/glossary.js',
  'css/tts-download-notice.css',
  'css/series-manuscript.css',
  'js/vosk-tts-engine.js',
  'js/vosk-tts-worker.js',
  'manifest.json',
  'data/search-manifest.json',
]);

function md5short(root, relPath) {
  const absolute = path.join(root, relPath);
  if (!fs.existsSync(absolute)) return null;
  return crypto.createHash('md5').update(fs.readFileSync(absolute)).digest('hex').slice(0, 8);
}

function assertGovernedResourceSourceSurfaces() {
  const root = path.resolve(__dirname, '..');
  assertSourceSurfaceMutationContract();
  const hashes = Object.fromEntries(ASSETS.map((asset) => [asset, md5short(root, asset)]));
  const surfaces = collectProductSourceSurfaces(root);
  const result = auditGovernedResourceVersions(root, ASSETS, hashes, surfaces);

  if (result.unclassified.length) {
    throw new Error(
      'asset revision source corpus omitted resource-producing source classes:\n  - '
      + result.unclassified
        .map((item) => `${item.relative} (${item.extension || 'no extension'})`)
        .join('\n  - ')
    );
  }
  if (result.stale.length) {
    throw new Error(
      'stale governed asset revision literal(s) outside the old HTML/Astro-only audit:\n  - '
      + result.stale
        .map((item) => `${item.relative}: ${item.asset}?v=${item.actual} (expected ${item.expected})`)
        .join('\n  - ')
    );
  }

  return Object.freeze({
    resourceFiles: surfaces.resourceFiles.length,
    checkedVersionedLiterals: result.checkedVersionedLiterals,
  });
}

const SOURCE_SURFACE_REVISION_AUDIT = assertGovernedResourceSourceSurfaces();

module.exports = {
  ASSETS,
  LAZY_NO_PRECACHE,
  SOURCE_SURFACE_REVISION_AUDIT,
  assertGovernedResourceSourceSurfaces,
};
