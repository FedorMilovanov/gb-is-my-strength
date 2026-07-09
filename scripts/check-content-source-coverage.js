#!/usr/bin/env node
'use strict';

/*
 * Compatibility entrypoint.
 * This command validates content provenance only. Search/Pagefind/sitemap/RSS
 * membership belongs to the explicit Search & Index Policy contract (#57), not
 * to mutable root HTML or route-name exclusions.
 */

require('./install-effective-route-registry');
console.log('ℹ️ content:sources:check uses effective source provenance; search policy is separate.');
require('./content-source-provenance-audit');
