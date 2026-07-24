#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, 'scripts/map-archaeology-source-registry-audit.js');
const WRITE = process.argv.includes('--write');
let source = fs.readFileSync(TARGET, 'utf8');

const desired = [
  "'disputed',",
  "const declaredMapScopes = new Set(['avraam'",
  'source-map-scope-unknown',
  'claim-map-scope',
  "['candidate', 'disputed'].includes(claim.status)"
];
if (desired.every((needle) => source.includes(needle))) {
  console.log('PASS multiscope archaeology provenance audit already materialized');
  process.exit(0);
}

function replaceExactlyOnce(oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one occurrence, found ${count}`);
  source = source.replace(oldText, newText);
}

replaceExactlyOnce(
  "  'candidate',\n  'rejected',",
  "  'candidate',\n  'disputed',\n  'rejected',",
  'claim disputed status'
);

replaceExactlyOnce(
  "const sites = provenance.sites || {};\nfor (const [siteId, site] of Object.entries(sites)) {",
  "const sites = provenance.sites || {};\nconst declaredMapScopes = new Set(['avraam', ...(catalog.mapScopes || []).map((scope) => scope?.id).filter(Boolean)]);\nfor (const scope of catalog.mapScopes || []) {\n  if (!scope || !/^[a-z0-9][a-z0-9-]+$/.test(scope.id || '')) fail('map-scope-id', JSON.stringify(scope));\n  if (scope.kind !== 'runtime-scope') fail('map-scope-kind', `${scope?.id}: ${scope?.kind}`);\n}\nfor (const [siteId, site] of Object.entries(sites)) {",
  'declared map scopes'
);

replaceExactlyOnce(
  "  if (!Array.isArray(source.maps) || !source.maps.includes('avraam')) fail('source-map-scope', `${source.id}: expected avraam`);",
  "  if (!Array.isArray(source.maps) || !source.maps.length) fail('source-map-scope', `${source.id}: at least one map scope required`);\n  for (const scope of source.maps || []) if (!declaredMapScopes.has(scope)) fail('source-map-scope-unknown', `${source.id}: ${scope}`);",
  'source map scopes'
);

replaceExactlyOnce(
  "  if (claim.map !== 'avraam') fail('claim-map', `${claim.id}: expected avraam`);",
  "  if (!declaredMapScopes.has(claim.map)) fail('claim-map-scope', `${claim.id}: ${claim.map}`);",
  'claim map scope'
);

replaceExactlyOnce(
  "  if (claim.status === 'candidate' && !/candidate|requires|future|not an identification/i.test(claim.limitations)) fail('candidate-limitation', `${claim.id}: candidate limitation must remain explicit`);",
  "  if (['candidate', 'disputed'].includes(claim.status) && !/candidate|disputed|debate|requires|future|not (?:an )?identification|not settled/i.test(claim.limitations)) fail('candidate-limitation', `${claim.id}: candidate/disputed limitation must remain explicit`);",
  'candidate and disputed limitation'
);

replaceExactlyOnce(
  "  sites: Object.keys(sites).length,\n  claims: claims.length,",
  "  sites: Object.keys(sites).length,\n  mapScopes: declaredMapScopes.size,\n  topics: Object.keys(catalog.topicVocabulary || {}).length,\n  claims: claims.length,",
  'summary scope counts'
);

for (const needle of desired) if (!source.includes(needle)) throw new Error(`postcondition failed: ${needle}`);
if (source.includes("claim.map !== 'avraam'")) throw new Error('stale Avraam-only claim guard remains');
if (source.includes("source.maps.includes('avraam')")) throw new Error('stale Avraam-only source guard remains');

if (WRITE) {
  fs.writeFileSync(TARGET, source, 'utf8');
  console.log('UPDATED archaeology provenance audit for declared multiscope data');
} else {
  console.log('PASS guarded multiscope archaeology audit patch');
}
