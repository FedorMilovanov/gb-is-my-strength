#!/usr/bin/env node
'use strict';

/*
 * Compatibility entrypoint.
 * Route profile validation is registry-driven. Historical path/name exclusions
 * are archived under scripts/legacy-audits/ and are not production policy.
 */

console.log('ℹ️ route:profiles:check uses the registry-driven route profile contract.');
require('./route-profile-contract-audit');
