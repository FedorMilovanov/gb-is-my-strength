#!/usr/bin/env node
/**
 * Unified native navigation browser sweep.
 *
 * Keeps biblical maps, the research Atlas and statically projected article
 * relations as isolated contracts while preserving one CI/workflow entrypoint.
 */
await import('./map-runtime-fallback-browser-core.mjs');
await import('./atlas-browser-contract.mjs');
await import('./relationship-panel-browser-contract.mjs');
