#!/usr/bin/env node
'use strict';

/*
 * Compatibility entrypoint for the historical Baptist-series shadow audit.
 *
 * The routes are now strict-native Astro routes. Legacy HTML is retained as a
 * reference and immutable content-floor witness, not as current production
 * truth. This command therefore delegates to the production-like native route
 * audit for series articles.
 */

if (!process.argv.includes('--series-only')) process.argv.push('--series-only');
console.log('ℹ️ astro:audit:baptisty-series now runs the strict-native series article contract audit.');
require('./article-native-contract-audit');
