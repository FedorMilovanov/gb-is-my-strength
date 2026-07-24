#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, 'karty/_data/archaeology-source-registry.json');
const WRITE = process.argv.includes('--write');
const catalog = JSON.parse(fs.readFileSync(TARGET, 'utf8'));

const EXPECTED = {
  'jericho-archaeology-disputed': 'The destruction chronology remains disputed; the registry preserves excavation data and conventional dating without treating one scholarly reconstruction as settled biblical synchronism.',
  'maccabean-context': 'Both Thamnata and Horbat Ha-Gardi identifications remain candidates and must not be presented as conclusive beyond the reporting sources.'
};

for (const [id, limitations] of Object.entries(EXPECTED)) {
  const claim = (catalog.claims || []).find((item) => item.id === id);
  if (!claim) throw new Error(`missing governed claim ${id}`);
  claim.limitations = limitations;
}

for (const [id, limitations] of Object.entries(EXPECTED)) {
  const claim = catalog.claims.find((item) => item.id === id);
  if (claim.limitations !== limitations) throw new Error(`postcondition failed for ${id}`);
}

if (WRITE) {
  fs.writeFileSync(TARGET, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log('UPDATED explicit disputed/candidate limitations');
} else {
  console.log('PASS explicit disputed/candidate limitation materializer');
}
