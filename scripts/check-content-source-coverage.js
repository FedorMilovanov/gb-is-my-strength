#!/usr/bin/env node
'use strict';

/*
 * Compatibility entrypoint.
 * This command now validates content provenance only. Search/Pagefind/sitemap/
 * RSS membership belongs to the explicit Search & Index Policy contract (#57),
 * not to mutable root HTML or route-name exclusions.
 */

console.log('ℹ️ content:sources:check uses explicit source provenance; search policy is separate.');
require('./content-source-provenance-audit');
