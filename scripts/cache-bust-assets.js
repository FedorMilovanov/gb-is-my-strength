#!/usr/bin/env node
'use strict';

/**
 * Shared asset list for cache-bust.js and audit-pro.js.
 *
 * Single source of truth — both scripts import from here,
 * eliminating manual sync drift.
 *
 * Usage:
 *   const { ASSETS } = require('./cache-bust-assets');
 */

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
  'js/reader-library-presenter.js',
  'js/reader-library-v3.js',
  'js/reader-library-dock.js',
  'js/search.js',
  'js/sw-register.js',
  'js/nagornaya-mobile-toc.js',
  'js/nagornaya-bar-extras.js',
  'js/glossary.js',
  'js/vosk-tts-engine.js',
  'js/vosk-tts-worker.js',
  'js/vosk-tts-core.js',
  'js/vosk-stress-lookup.js',
  // Spoken-vocabulary data is fetched by the TTS worker itself; without a
  // revision the worker's force-cache fetch would keep an old stress dictionary
  // alive forever after a dictionary update ships.
  'js/vosk-custom-terms.json',
  'js/vosk-stress-marker.bin',
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
  'js/vosk-tts-core.js',
  'js/vosk-stress-lookup.js',
  'js/vosk-custom-terms.json',
  'js/vosk-stress-marker.bin',
  'manifest.json',
  'data/search-manifest.json',
]);

module.exports = { ASSETS, LAZY_NO_PRECACHE };
