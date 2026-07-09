#!/usr/bin/env node
'use strict';

/*
 * Compatibility entrypoint for the historical Baptist-series shadow audit.
 *
 * The routes are strict-native Astro routes. Legacy HTML is a reference and
 * immutable content-floor witness, not production truth. This command delegates
 * to the effective production-like native route audit for series articles.
 */

if (!process.argv.includes('--series-only')) process.argv.push('--series-only');
console.log('ℹ️ astro:audit:baptisty-series now runs the effective strict-native series article contract audit.');
require('./article-native-effective-contract-audit');
