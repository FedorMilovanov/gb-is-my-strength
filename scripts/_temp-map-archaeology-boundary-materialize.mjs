#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_FILE = path.join(ROOT, 'karty/_data/archaeology-source-registry.json');
const PROVENANCE_FILE = path.join(ROOT, 'karty/_data/archaeology-source-provenance.json');
const BOUNDARY = '83a13a0755b37296ccec053987654ceefbca349e';
const WRITE = process.argv.includes('--write');
const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
const provenance = JSON.parse(fs.readFileSync(PROVENANCE_FILE, 'utf8'));

if (catalog.sources?.length !== 94 || Object.keys(provenance.records || {}).length !== 94) {
  throw new Error('boundary finalizer requires the completed 94/94 corpus');
}
catalog.sourceBoundary = BOUNDARY;
provenance.catalogBoundary = BOUNDARY;
if (catalog.sourceBoundary !== provenance.catalogBoundary) throw new Error('boundary postcondition drift');

if (WRITE) {
  fs.writeFileSync(CATALOG_FILE, `${JSON.stringify(catalog, null, 2)}\n`);
  fs.writeFileSync(PROVENANCE_FILE, `${JSON.stringify(provenance, null, 2)}\n`);
  console.log(`UPDATED shared archaeology boundary ${BOUNDARY}`);
} else {
  console.log(`PASS shared archaeology boundary ${BOUNDARY}`);
}
