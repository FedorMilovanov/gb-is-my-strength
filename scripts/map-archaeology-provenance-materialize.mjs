#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = path.join(ROOT, 'karty/_data/archaeology-source-registry.json');
const PROVENANCE_PATH = path.join(ROOT, 'karty/_data/archaeology-source-provenance.json');
const write = process.argv.includes('--write');

const original = fs.readFileSync(CATALOG_PATH, 'utf8');
const catalog = JSON.parse(original);
const provenance = JSON.parse(fs.readFileSync(PROVENANCE_PATH, 'utf8'));
const sourceById = new Map(catalog.sources.map((source) => [source.id, source]));

const requiredExisting = [
  'mari-excavation-history',
  'harran-department',
  'harran-excavations-2025',
  'harran-fieldwork',
  'leiden-tell-balata',
  'oeaw-tell-balata',
  'scientific-reports-tall-retraction',
];
for (const id of requiredExisting) {
  if (!sourceById.has(id)) throw new Error(`required catalog source missing: ${id}`);
}

catalog.schemaVersion = '1.1.0';
catalog.updatedAt = '2026-07-24';
catalog.sourceBoundary = '184d7ed1b50161ec5fa1418ca24539e33977e2a8';
catalog.provenanceRegistry = 'karty/_data/archaeology-source-provenance.json';

const hierarchy = [
  'primary-excavation',
  'official-collection',
  'peer-reviewed',
  'institutional-synthesis',
  'institutional-notice',
  'institutional-directory',
  'scholarly-reference',
  'conservative-analysis',
  'yec-analysis',
  'visual-archive',
  'retraction-record',
];
catalog.evidenceHierarchy = hierarchy;

const tierCorrections = {
  'mari-excavation-history': 'institutional-synthesis',
  'harran-department': 'institutional-directory',
  'harran-excavations-2025': 'institutional-notice',
  'harran-fieldwork': 'institutional-directory',
  'leiden-tell-balata': 'institutional-synthesis',
  'oeaw-tell-balata': 'institutional-synthesis',
};

for (const source of catalog.sources) {
  const record = provenance.records[source.id];
  if (!record) throw new Error(`provenance missing for existing source: ${source.id}`);
  source.url = record.canonicalUrl;
  source.year = record.publicationYear;
  source.accessedAt = record.accessedAt;
  if (tierCorrections[source.id]) source.tier = tierCorrections[source.id];
}

const newSources = [
  {
    id: 'lloyd-brice-harran-1951',
    title: 'Harran',
    organization: 'Anatolian Studies / British Institute at Ankara; CDLI bibliographic record',
    year: 1951,
    url: provenance.records['lloyd-brice-harran-1951'].canonicalUrl,
    tier: 'peer-reviewed',
    status: 'active',
    verification: 'verified',
    verifiedAt: '2026-07-24',
    accessedAt: '2026-07-24',
    maps: ['avraam'],
    places: ['harran'],
    note: 'Peer-reviewed excavation and topographic study; JSTOR stable identifier 3642359.',
  },
  {
    id: 'harran-plain-survey-2021',
    title: 'Preliminary Assessment on the Archaeological Survey of the Harran Plain in 2020',
    organization: 'Karadeniz Uluslararası Bilimsel Dergi / DergiPark',
    year: 2021,
    url: provenance.records['harran-plain-survey-2021'].canonicalUrl,
    tier: 'peer-reviewed',
    status: 'active',
    verification: 'verified',
    verifiedAt: '2026-07-24',
    accessedAt: '2026-07-24',
    maps: ['avraam'],
    places: ['harran'],
    note: 'Peer-reviewed regional archaeological survey; supports Harran Plain settlement context rather than a traced Abraham itinerary.',
  },
];
for (const source of newSources) {
  if (!sourceById.has(source.id)) catalog.sources.push(source);
}

const claimById = new Map(catalog.claims.map((claim) => [claim.id, claim]));
const corridor = claimById.get('euphrates-corridor-context');
if (!corridor) throw new Error('euphrates-corridor-context claim missing');
corridor.evidenceSources = corridor.evidenceSources
  .filter((id) => !['harran-department', 'harran-excavations-2025'].includes(id))
  .concat(['lloyd-brice-harran-1951', 'harran-plain-survey-2021']);

const noArtifact = claimById.get('no-personal-abraham-artefact');
if (!noArtifact) throw new Error('no-personal-abraham-artefact claim missing');
noArtifact.evidenceSources = noArtifact.evidenceSources.map((id) =>
  id === 'harran-department' ? 'lloyd-brice-harran-1951' : id
);

function compactBlock(key, records, nextKey = null) {
  const lines = records.map((record, index) => `    ${JSON.stringify(record)}${index + 1 < records.length ? ',' : ''}`);
  const tail = nextKey ? `  ],\n  "${nextKey}": [` : '  ]';
  return `  "${key}": [\n${lines.join('\n')}\n${tail}`;
}

let output = original;
output = output.replace(/  "schemaVersion": "[^"]+",/, `  "schemaVersion": "${catalog.schemaVersion}",`);
output = output.replace(/  "sourceBoundary": "[^"]+",/, `  "sourceBoundary": "${catalog.sourceBoundary}",\n  "provenanceRegistry": "${catalog.provenanceRegistry}",`);
output = output.replace(
  /  "evidenceHierarchy": \[[\s\S]*?\n  \],\n  "sources": \[/,
  `  "evidenceHierarchy": [\n${catalog.evidenceHierarchy.map((tier, index) => `    "${tier}"${index + 1 < catalog.evidenceHierarchy.length ? ',' : ''}`).join('\n')}\n  ],\n  "sources": [`
);
output = output.replace(
  /  "sources": \[[\s\S]*?\n  \],\n  "claims": \[/,
  compactBlock('sources', catalog.sources, 'claims')
);
output = output.replace(
  /  "claims": \[[\s\S]*?\n  \]\n\}/,
  `${compactBlock('claims', catalog.claims)}\n}`
);

const reparsed = JSON.parse(output);
const finalIds = new Set(reparsed.sources.map((source) => source.id));
const provenanceIds = new Set(Object.keys(provenance.records));
if (finalIds.size !== provenanceIds.size || [...finalIds].some((id) => !provenanceIds.has(id))) {
  throw new Error(`catalog/provenance id coverage mismatch: catalog=${finalIds.size}, provenance=${provenanceIds.size}`);
}
if (reparsed.sources.find((source) => source.id === 'scientific-reports-tall-retraction')?.url !== 'https://www.nature.com/articles/s41598-025-99265-5') {
  throw new Error('direct Scientific Reports retraction URL was not installed');
}
if (reparsed.sources.find((source) => source.id === 'harran-excavations-2025')?.tier !== 'institutional-notice') {
  throw new Error('Harran festival notice remains misclassified');
}
if (!reparsed.claims.find((claim) => claim.id === 'euphrates-corridor-context')?.evidenceSources.includes('lloyd-brice-harran-1951')) {
  throw new Error('Harran excavation publication was not promoted into corridor evidence');
}

if (write) {
  fs.writeFileSync(CATALOG_PATH, output, 'utf8');
  console.log('UPDATED archaeology catalog to schema 1.1 with provenance-backed source roles');
} else if (output !== original) {
  console.log('READY archaeology provenance migration is required');
} else {
  console.log('PASS archaeology provenance migration already materialized');
}
