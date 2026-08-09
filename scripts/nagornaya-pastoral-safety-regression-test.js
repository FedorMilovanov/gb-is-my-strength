#!/usr/bin/env node
'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const {
  loadRouteProfile,
  resolveDeclaredLegacyReference,
} = require('./lib/legacy-source-authority');

const ROOT = path.resolve(__dirname, '..');
const CURRENT_ROOTS = ['src'];
const LEGACY_ROUTES = [
  '/nagornaya/',
  '/nagornaya/seriya/',
  '/nagornaya/chast-1/',
  '/nagornaya/chast-2/',
  '/nagornaya/chast-3/',
  '/nagornaya/chast-4/',
  '/nagornaya/chast-5/',
  '/nagornaya/istochniki/',
];
const EXTENSIONS = new Set(['.astro', '.html', '.mdx']);
const banned = ['Полное отсутствие плодов — смертный приговор вере', 'Мф 7:21 относится к нему'];
const required = ['Упорное бесплодие требует серьёзного самоиспытания', 'Окончательный суд о сердце принадлежит Христу', 'нельзя механически применять к сокрушённому верующему'];

function collect(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, files);
    else if (EXTENSIONS.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

function readLegacyRoute(route) {
  const { profile } = loadRouteProfile(route);
  assert.ok(profile, `${route}: route profile missing`);
  assert.equal(profile.legacyStatus, 'reference-only', `${route}: legacy witness must remain reference-only`);
  const reference = resolveDeclaredLegacyReference(profile, { route });
  assert.ok(reference?.absolutePath, `${route}: declared legacy reference missing`);
  return fs.readFileSync(reference.absolutePath, 'utf8');
}

const currentCorpus = CURRENT_ROOTS
  .flatMap((rel) => collect(path.join(ROOT, rel)))
  .map((file) => fs.readFileSync(file, 'utf8'));
const legacyCorpus = LEGACY_ROUTES.map((route) => readLegacyRoute(route));
const corpus = [...currentCorpus, ...legacyCorpus].join('\n');

for (const phrase of banned) assert(!corpus.includes(phrase), `banned pastoral verdict returned: ${phrase}`);
for (const phrase of required) assert(corpus.includes(phrase), `pastoral safeguard missing: ${phrase}`);

const witnesses = [
  ['src/components/nagornaya/chast-5/NagornayaChast5MainShell.astro', fs.readFileSync(path.join(ROOT, 'src/components/nagornaya/chast-5/NagornayaChast5MainShell.astro'), 'utf8')],
  ['/nagornaya/chast-5/ retained reference', readLegacyRoute('/nagornaya/chast-5/')],
];
for (const [label, source] of witnesses) {
  for (const phrase of required) assert(source.includes(phrase), `${label}: safeguard missing: ${phrase}`);
}

console.log('✅ Nagornaya pastoral safety contract passed');
