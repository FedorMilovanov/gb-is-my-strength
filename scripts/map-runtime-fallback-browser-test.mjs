#!/usr/bin/env node
/**
 * Unified native-map browser sweep.
 *
 * Keep the established biblical map contract isolated from the research Atlas
 * contract while preserving the existing npm/workflow entrypoint.
 */
await import('./map-runtime-fallback-browser-core.mjs');
await import('./atlas-browser-contract.mjs');
