#!/usr/bin/env node
'use strict';

/*
 * Compatibility entrypoint.
 * Runtime matrix validation covers every production Astro route. Semantic edit
 * protection is explicit profile/matrix scope and never creates a runtime audit
 * exemption based on a route name or prefix.
 */

// The matrix contract audit imports effective-route-registry directly.
console.log('ℹ️ migration:matrix:check uses the effective registry-driven runtime matrix contract.');
require('./route-migration-matrix-contract-audit');
