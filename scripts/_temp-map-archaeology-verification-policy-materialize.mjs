#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, 'scripts/map-archaeology-source-registry-audit.js');
const WRITE = process.argv.includes('--write');
let source = fs.readFileSync(TARGET, 'utf8');

const MARKER = "fail('source-imported-unreviewed'";
if (source.includes(MARKER)) {
  console.log('PASS verification queue policy already materialized');
  process.exit(0);
}

const oldText = "  if (!VERIFICATIONS.has(source.verification)) fail('source-verification', `${source.id}: ${source.verification}`);\n  if (!/^https:\\/\\//.test(source.url || '')) fail('source-url', `${source.id}: HTTPS URL required`);";
const newText = "  if (!VERIFICATIONS.has(source.verification)) fail('source-verification', `${source.id}: ${source.verification}`);\n  if (source.verification === 'imported') fail('source-imported-unreviewed', source.id);\n  if (source.verification === 'needs-review') {\n    const reviewRecord = records[source.id];\n    if (!source.note || !/review|unresolved|redirect|metadata|access|recover/i.test(source.note)) fail('source-needs-review-note', source.id);\n    if (reviewRecord?.evidenceUse === 'high') fail('source-needs-review-high', source.id);\n  }\n  if (!/^https:\\/\\//.test(source.url || '')) fail('source-url', `${source.id}: HTTPS URL required`);";
const count = source.split(oldText).length - 1;
if (count !== 1) throw new Error(`verification policy guard expected one occurrence, found ${count}`);
source = source.replace(oldText, newText);

for (const needle of [MARKER, "fail('source-needs-review-note'", "fail('source-needs-review-high'"]) {
  if (!source.includes(needle)) throw new Error(`postcondition failed: ${needle}`);
}

if (WRITE) {
  fs.writeFileSync(TARGET, source, 'utf8');
  console.log('UPDATED fail-closed imported/needs-review policy');
} else {
  console.log('PASS guarded verification queue policy patch');
}
