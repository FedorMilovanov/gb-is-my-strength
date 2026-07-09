#!/usr/bin/env node
'use strict';

/*
 * Compatibility entrypoint for the former Git-history metadata writer.
 *
 * Default behavior is now read-only. Editorial dates are registry data, not the
 * timestamp of a mutable legacy HTML commit. Use editorial-metadata-registry.js
 * explicitly for migration/maintenance operations.
 */

if (process.argv.includes('--write')) {
  console.error('❌ update-meta.js no longer writes editorial metadata.');
  console.error('Use: node scripts/editorial-metadata-registry.js --write --build');
  process.exit(2);
}

console.log('ℹ️ update-meta is now a read-only editorial metadata registry check.');
require('./editorial-metadata-registry');
