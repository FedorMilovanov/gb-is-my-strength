#!/usr/bin/env node
'use strict';

const { buildPublicSurfaceRegistry } = require('./lib/public-surface-registry');

const result = buildPublicSurfaceRegistry();
console.log(`Public surfaces: ${result.entries.length}`);
console.log(`Counts: ${JSON.stringify(result.counts)}`);
console.log(`Series shapes: ${JSON.stringify(result.shapeCounts)}`);
if (result.errors.length) {
  for (const error of result.errors) console.error(`ERROR ${error}`);
  process.exit(1);
}
console.log('✅ public-surface-registry: all ownership routes classified and cross-validated');
