#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

const auditPath = 'scripts/dist-publication-audit.js';
let audit = fs.readFileSync(auditPath, 'utf8');
if (!audit.includes("const { ASSETS, LAZY_NO_PRECACHE } = require('./cache-bust-assets');")) {
  audit = replaceOnce(
    audit,
    "    const { ASSETS } = require('./cache-bust-assets');",
    "    const { ASSETS, LAZY_NO_PRECACHE } = require('./cache-bust-assets');",
    'dist publication cache policy import'
  );
}
if (!audit.includes('const lazyNoPrecache = new Set(LAZY_NO_PRECACHE);')) {
  audit = replaceOnce(
    audit,
    "    const LAZY_NO_PRECACHE = new Set(['js/search.js', 'js/glossary.js', 'manifest.json', 'data/search-manifest.json']);",
    "    const lazyNoPrecache = new Set(LAZY_NO_PRECACHE);",
    'dist publication canonical lazy set'
  );
}
audit = replaceOnce(
  audit,
  '    const drift = ASSETS.filter(a => !swAssets.has(a) && !LAZY_NO_PRECACHE.has(a));',
  '    const drift = ASSETS.filter(a => !swAssets.has(a) && !lazyNoPrecache.has(a));',
  'dist publication drift policy'
);
audit = replaceOnce(
  audit,
  '    const reintroduced = [...LAZY_NO_PRECACHE].filter(a => swAssets.has(a));',
  '    const reintroduced = [...lazyNoPrecache].filter(a => swAssets.has(a));',
  'dist publication reintroduced policy'
);
if (!audit.includes("const { ASSETS, LAZY_NO_PRECACHE } = require('./cache-bust-assets');")) throw new Error('canonical cache policy import missing');
if (!audit.includes('const lazyNoPrecache = new Set(LAZY_NO_PRECACHE);')) throw new Error('canonical lazy set consumption missing');
if (/const LAZY_NO_PRECACHE = new Set\(\[/.test(audit)) throw new Error('divergent local lazy list remains');
fs.writeFileSync(auditPath, audit, 'utf8');

const contractPath = 'scripts/tts-engine-status-contract-test.js';
let contract = fs.readFileSync(contractPath, 'utf8');
if (!contract.includes('function validateDistPublicationAudit(source)')) {
  const anchor = `const cacheAssets = read('scripts/cache-bust-assets.js');\nassert.deepEqual(validate(engine, controller, css, workflow, cacheAssets), []);`;
  const insertion = `const cacheAssets = read('scripts/cache-bust-assets.js');
const distPublicationAudit = read('scripts/dist-publication-audit.js');
assert.deepEqual(validate(engine, controller, css, workflow, cacheAssets), []);

function validateDistPublicationAudit(source) {
  const problems = [];
  if (!/const \\{ ASSETS, LAZY_NO_PRECACHE \\} = require\\('\.\\/cache-bust-assets'\\);/.test(source)) {
    problems.push('dist publication audit does not import canonical lazy policy');
  }
  if (!/const lazyNoPrecache = new Set\\(LAZY_NO_PRECACHE\\);/.test(source)) {
    problems.push('dist publication audit does not consume canonical lazy policy');
  }
  if (/const LAZY_NO_PRECACHE = new Set\\(\\[/.test(source)) {
    problems.push('dist publication audit keeps a divergent local lazy list');
  }
  return problems;
}

assert.deepEqual(validateDistPublicationAudit(distPublicationAudit), []);
for (const [name, mutation] of [
  ['dist audit lazy export removed', distPublicationAudit.replace('{ ASSETS, LAZY_NO_PRECACHE }', '{ ASSETS }')],
  ['dist audit canonical lazy set bypassed', distPublicationAudit.replace('new Set(LAZY_NO_PRECACHE)', 'new Set([])')],
]) {
  assert.ok(validateDistPublicationAudit(mutation).length > 0, \`\${name}: mutation must be rejected\`);
}`;
  contract = replaceOnce(contract, anchor, insertion, 'dist publication contract insertion');
}
if (!contract.includes('dist audit canonical lazy set bypassed')) throw new Error('dist publication adversarial contract missing');
fs.writeFileSync(contractPath, contract, 'utf8');

for (const file of [auditPath, contractPath]) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
execFileSync(process.execPath, [contractPath], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js'], { stdio: 'inherit' });
console.log('Deploy publication lazy-cache policy materialized.');
