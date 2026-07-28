#!/usr/bin/env node
/**
 * Unified native navigation browser sweep.
 *
 * Keeps biblical maps, the research Atlas and statically projected article
 * relations as isolated contracts while preserving one CI/workflow entrypoint.
 * A synchronous transcript survives process.exit() inside any imported
 * fail-closed contract and is collected by the existing browser artifact.
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspect } from 'node:util';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_DIR = join(ROOT, 'reports', 'public-surface-browser-diagnostics');
const TRANSCRIPT = join(REPORT_DIR, 'navigation-engine-sweep.log');
mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(TRANSCRIPT, `Navigation engine sweep\nstarted=${new Date().toISOString()}\nnode=${process.version}\n\n`, 'utf8');

function serialize(value) {
  return typeof value === 'string' ? value : inspect(value, { depth: 8, colors: false, breakLength: 180 });
}

for (const method of ['log', 'info', 'warn', 'error']) {
  const original = console[method].bind(console);
  console[method] = (...args) => {
    original(...args);
    appendFileSync(TRANSCRIPT, `${args.map(serialize).join(' ')}\n`, 'utf8');
  };
}

process.on('uncaughtExceptionMonitor', (error, origin) => {
  appendFileSync(TRANSCRIPT, `\nUNCAUGHT (${origin})\n${error?.stack || error}\n`, 'utf8');
});
process.on('unhandledRejection', (reason) => {
  appendFileSync(TRANSCRIPT, `\nUNHANDLED REJECTION\n${serialize(reason)}\n`, 'utf8');
});
process.on('exit', (code) => {
  appendFileSync(TRANSCRIPT, `\nfinished=${new Date().toISOString()}\nexit=${code}\n`, 'utf8');
});

console.log('=== Biblical map recovery contract ===');
await import('./map-runtime-fallback-browser-core.mjs');
console.log('\n=== Compiled research Atlas contract ===');
await import('./atlas-browser-contract.mjs');
console.log('\n=== Atlas state ownership contract ===');
await import('./atlas-state-browser-contract.mjs');
console.log('\n=== Static article relation contract ===');
await import('./relationship-panel-browser-contract.mjs');
console.log('\n✅ Unified navigation engine sweep completed');
