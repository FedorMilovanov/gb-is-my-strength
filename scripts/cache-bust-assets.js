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
  'css/reader-preferences.css',
  'css/home.css',
  'css/command-palette.css',
  'css/mobile-hotfix.css',
  'css/nagornaya-mobile-toc.css',
  'css/series-samizdat.css',
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
  'js/floating-cluster-controller.js',
];

module.exports = { ASSETS };
