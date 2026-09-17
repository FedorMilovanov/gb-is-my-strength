#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPublishableProjection } from './lib/publishable-projection.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const V1_PATH = path.join(ROOT, 'data', 'genealogy', 'genealogy.json');
const V2 = path.join(ROOT, 'data', 'genealogy', 'v2');
const OUT = path.join(V2, 'publishable');

const sha256 = value => createHash('sha256').update(value).digest('hex');
const parse = value => JSON.parse(value);
const stableJson = value => JSON.stringify(value, null, 2) + '\n';

const inputs = {
  v1: await readFile(V1_PATH, 'utf8'),
  persons: await readFile(path.join(V2, 'persons.json'), 'utf8'),
  gospel: await readFile(path.join(V2, 'gospel-sequences.json'), 'utf8'),
  annotations: await readFile(path.join(V2, 'edge-annotations.json'), 'utf8'),
  rawMeta: await readFile(path.join(V2, 'meta.json'), 'utf8'),
};

const projection = buildPublishableProjection({
  v1: parse(inputs.v1),
  persons: parse(inputs.persons),
  gospelSequences: parse(inputs.gospel),
  edgeAnnotations: parse(inputs.annotations),
  rawMeta: parse(inputs.rawMeta),
  sourceHashes: {
    curatedV1: sha256(inputs.v1),
    v2Persons: sha256(inputs.persons),
    v2GospelSequences: sha256(inputs.gospel),
    v2EdgeAnnotations: sha256(inputs.annotations),
    v2Meta: sha256(inputs.rawMeta),
  },
});

await mkdir(OUT, { recursive: true });
await Promise.all([
  writeFile(path.join(OUT, 'meta.json'), stableJson(projection.meta)),
  writeFile(path.join(OUT, 'persons.json'), stableJson(projection.persons)),
  writeFile(path.join(OUT, 'relations.json'), stableJson(projection.relations)),
  writeFile(path.join(OUT, 'gospel-sequences.json'), stableJson(projection.gospelSequences)),
  writeFile(path.join(OUT, 'textual-assertions.json'), stableJson(projection.textualAssertions)),
]);

console.log(JSON.stringify({
  status: projection.meta.status,
  counts: projection.meta.counts,
  diagnostics: {
    externalRefs: projection.meta.diagnostics.externalRefs.length,
    childIndexConflicts: projection.meta.diagnostics.childIndexConflicts.length,
    asymmetricSpouses: projection.meta.diagnostics.asymmetricSpouses.length,
    orphanAnnotations: projection.meta.diagnostics.orphanAnnotations.length,
  },
}, null, 2));
