#!/usr/bin/env node
'use strict';

/*
 * Compatibility entrypoint for `npm run content:parity`.
 *
 * MDX and root legacy HTML are reference representations unless a route profile
 * explicitly marks MDX canonical. Comparing two reference copies cannot prove
 * production parity. Current parity starts with the declared route source and
 * the imports used by the public strict-native Astro entrypoint.
 *
 * The previous MDX↔HTML report is preserved under scripts/legacy-audits/ and may
 * be run manually for historical migration research, but it is no longer a
 * blocking production-truth gate.
 */

if (!process.argv.includes('--strict')) process.argv.push('--strict');
if (!process.argv.includes('--articles-only')) process.argv.push('--articles-only');
console.log('ℹ️ content:parity now validates declared content sources against actual public route imports.');
require('./route-source-contract-audit');
