#!/usr/bin/env node
'use strict';

const { buildPublicSurfaceRegistry } = require('./lib/public-surface-registry');
const {
  runSeriesCapabilityMutationSuite,
  validateSeriesCapabilityContract,
} = require('./lib/series-capability-contract');

const result = buildPublicSurfaceRegistry();
const capability = validateSeriesCapabilityContract({ registry: result });
const mutationFailures = runSeriesCapabilityMutationSuite();

console.log(`Public surfaces: ${result.entries.length}`);
console.log(`Counts: ${JSON.stringify(result.counts)}`);
console.log(`Series shapes: ${JSON.stringify(result.shapeCounts)}`);
console.log(`Governed reading-series routes: ${capability.governedReadingRoutes.length}`);
console.log(`Explicit native exceptions: ${capability.exceptionRoutes.length}`);

const errors = [
  ...result.errors,
  ...capability.errors,
  ...mutationFailures.map((failure) => `series capability mutation failed: ${failure}`),
];
if (errors.length) {
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exit(1);
}
console.log('✅ public-surface-registry: ownership, shared reader capabilities and generic series configs verified');
