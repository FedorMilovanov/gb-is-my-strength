#!/usr/bin/env node
'use strict';

/*
 * Compatibility entrypoint.
 * Route profile validation is registry-driven. Historical path/name exclusions
 * are archived under scripts/legacy-audits/ and are not production policy.
 */

// The route-profile audit imports effective-route-registry directly.
console.log('ℹ️ route:profiles:check uses the effective registry-driven route profile contract.');
require('./route-profile-contract-audit');
