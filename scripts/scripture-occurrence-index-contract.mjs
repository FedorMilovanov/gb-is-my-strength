#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  ROOT,
  OUTPUT_FILE,
  buildScriptureOccurrenceIndex,
  contextAroundVisible,
  nearestExplicitAnchor,
  projectVisibleSource,
  serializeScriptureOccurrenceIndex,
} from './build-scripture-occurrence-index.mjs';
import {
  loadBibleCorpus,
  loadBibleRegistry,
  normalizeVerseKey,
  parseBibleReference,
  resolveBibleReference,
} from '../src/lib/bible-reference-core.mjs';

const require = createRequire(import.meta.url);
const { loadRouteRecords } = require('./lib/route-source-contract.js');
const SAFE_ANCHOR = /^[A-Za-zА-Яа-яЁё0-9][A-Za-zА-Яа-яЁё0-9_:.-]{0,127}$/u;
const DIST_ARGUMENT = process.argv.find((argument) => argument.startsWith('--dist='));
const DIST_ROOT = DIST_ARGUMENT ? path.resolve(ROOT, DIST_ARGUMENT.slice('--dist='.length)) : null;
const errors = [];

function fail(message) {
  errors.push(message);
  if (errors.length <= 80) console.error(`SCRIPTURE OCCURRENCE CONTRACT FAILED: ${message}`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function normalizeRoute(value) {
  const [withoutHash] = String(value || '').split('#', 1);
  let route = withoutHash || '/';
  if (!route.startsWith('/')) route = `/${route}`;
  if (!path.posix.extname(route) && !route.endsWith('/')) route += '/';
  return route;
}

function stableSorted(values) {
  return [...values].sort((a, b) => String(a).localeCompare(String(b), 'ru'));
}

function sameArray(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function parseIndexReference(reference, registry) {
  if (reference.kind === 'chapter-range') {
    const match = String(reference.key).match(/^(\d+)–(\d+)$/);
    if (!match) return null;
    const book = registry.books[reference.bookId];
    const alias = book?.aliases?.[0];
    if (!alias) return null;
    const start = parseBibleReference(`${alias} ${match[1]}`, registry);
    const end = parseBibleReference(`${alias} ${match[2]}`, registry);
    if (!start.ok || !end.ok || start.bookId !== reference.bookId || end.bookId !== reference.bookId) return null;
    return { parsed: start, endChapter: end.chapter };
  }
  const parsed = parseBibleReference(reference.label, registry);
  if (!parsed.ok || parsed.bookId !== reference.bookId || parsed.key !== reference.key) return null;
  return { parsed, endChapter: null };
}

function decodeEntities(value) {
  const named = new Map([
    ['nbsp', ' '], ['amp', '&'], ['lt', '<'], ['gt', '>'], ['quot', '"'], ['apos', "'"],
    ['laquo', '«'], ['raquo', '»'], ['ndash', '–'], ['mdash', '—'],
  ]);
  return String(value || '')
    .replace(/&#(\d+);/g, (_m, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, number) => String.fromCodePoint(Number.parseInt(number, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named.get(name.toLowerCase()) ?? match);
}

function normalizeWitnessText(value) {
  return decodeEntities(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.]/g, '')
    .replace(/[‐‑‒–—−-]/g, '–')
    .replace(/\s*([:–])\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function routeDistFile(route) {
  const clean = route.replace(/^\/+/, '');
  if (!clean) return path.join(DIST_ROOT, 'index.html');
  if (path.posix.extname(clean)) return path.join(DIST_ROOT, clean);
  return path.join(DIST_ROOT, clean, 'index.html');
}

function tagHasLiteralId(tag, expected) {
  let index = 1;
  while (index < tag.length && !/[\s/>]/u.test(tag[index])) index += 1;
  while (index < tag.length) {
    while (index < tag.length && /\s/u.test(tag[index])) index += 1;
    if (index >= tag.length || tag[index] === '>' || (tag[index] === '/' && tag[index + 1] === '>')) break;

    const nameStart = index;
    while (index < tag.length && !/[\s=/>]/u.test(tag[index])) index += 1;
    const name = tag.slice(nameStart, index).toLowerCase();
    while (index < tag.length && /\s/u.test(tag[index])) index += 1;

    let value = null;
    if (tag[index] === '=') {
      index += 1;
      while (index < tag.length && /\s/u.test(tag[index])) index += 1;
      const quote = tag[index];
      if (quote === '"' || quote === "'") {
        index += 1;
        const valueStart = index;
        while (index < tag.length && tag[index] !== quote) index += 1;
        value = tag.slice(valueStart, index);
        if (index < tag.length) index += 1;
      } else {
        const valueStart = index;
        while (index < tag.length && !/[\s>]/u.test(tag[index])) index += 1;
        value = tag.slice(valueStart, index);
      }
    }

    if (name === 'id' && value === expected) return true;
  }
  return false;
}

function htmlHasLiteralId(html, expected) {
  const tags = String(html || '').match(/<[A-Za-z][^<>]*>/gu) || [];
  return tags.some((tag) => tagHasLiteralId(tag, expected));
}

function contextHasSourceSyntax(value) {
  const context = String(value || '');
  return /<\/?[A-Za-z][^>]*>|\b(?:class|data-[\w-]+|aria-[\w-]+|href|src|id)\s*=\s*["'{]|!\[[^\]]*\]\(|\]\([^)]*\)|```|`|[{}]/iu.test(context);
}

function runRepresentationOracleFixtures() {
  const astro = '<section data-note-id="false-anchor"><h2 id="real-anchor">Тема</h2><p>До Рим. 8:28 после.</p></section>';
  const offset = astro.indexOf('Рим. 8:28');
  const end = offset + 'Рим. 8:28'.length;
  if (nearestExplicitAnchor(astro, offset, '.astro') !== 'real-anchor') {
    fail('producer fixture: real id attribute was not selected structurally');
  }

  const falseOnly = '<section data-note-id="false-anchor"><p>Рим. 8:28</p></section>';
  if (nearestExplicitAnchor(falseOnly, falseOnly.indexOf('Рим. 8:28'), '.astro') !== null) {
    fail('producer fixture: data-note-id was accepted as a real id attribute');
  }

  const projected = projectVisibleSource(astro, '.astro');
  const context = contextAroundVisible(projected, offset, end, '.astro');
  if (!context.includes('До Рим. 8:28 после.') || contextHasSourceSyntax(context) || context.includes('false-anchor')) {
    fail(`producer fixture: context is not visible-prose clean: ${context}`);
  }

  const mdx = '[Рим. 8:28](https://example.invalid/raw-source)\n\n![2 Кор. 5:17](https://example.invalid/image)';
  const projectedMdx = projectVisibleSource(mdx, '.mdx');
  if (!projectedMdx.includes('Рим. 8:28') || projectedMdx.includes('raw-source') || projectedMdx.includes('2 Кор. 5:17')) {
    fail('producer fixture: MDX projection did not keep visible link prose while masking non-visible destinations/image syntax');
  }

  if (htmlHasLiteralId('<div data-note-id="false-anchor"></div>', 'false-anchor')) {
    fail('independent dist fixture: data-note-id was accepted as a real id attribute');
  }
  if (!htmlHasLiteralId('<div data-note-id="false-anchor" id="real-anchor"></div>', 'real-anchor')) {
    fail('independent dist fixture: real id attribute was not recognized');
  }
}

runRepresentationOracleFixtures();

if (!fs.existsSync(OUTPUT_FILE)) {
  fail('data/scripture-search-index.json is missing');
} else {
  const source = fs.readFileSync(OUTPUT_FILE, 'utf8');
  const index = JSON.parse(source);
  const generated = buildScriptureOccurrenceIndex();
  const expected = serializeScriptureOccurrenceIndex(generated);
  if (source !== expected) fail('generated index is stale or nondeterministic');
  if ('generatedAt' in index || 'timestamp' in index) fail('volatile timestamp fields are forbidden');
  if (index.schemaVersion !== 1) fail(`unexpected schemaVersion: ${index.schemaVersion}`);
  if (index.contract !== 'SEARCH-P1-04-S1-source-owned-occurrence-index') fail('contract identifier drifted');

  const registry = loadBibleRegistry(ROOT);
  const { corpus } = loadBibleCorpus(registry, ROOT);
  const manifest = readJson(path.join(ROOT, 'data/search-manifest.json'));
  const routeData = loadRouteRecords();
  const routeRecords = new Map(routeData.records.map((record) => [record.route, record]));
  const manifestTitles = new Map();
  for (const item of manifest.items || []) {
    const route = normalizeRoute(item.url);
    const titles = manifestTitles.get(route) || new Set();
    titles.add(item.title);
    manifestTitles.set(route, titles);
  }

  if (!Array.isArray(index.references)) fail('references must be an array');
  const references = Array.isArray(index.references) ? index.references : [];
  if (references.length < 20) fail(`reference coverage unexpectedly small: ${references.length}`);
  if ((index.stats?.occurrences || 0) < 100) fail(`occurrence coverage unexpectedly small: ${index.stats?.occurrences || 0}`);
  if ((index.stats?.indexedRoutes || 0) < 20) fail(`route coverage unexpectedly small: ${index.stats?.indexedRoutes || 0}`);

  const ids = new Set();
  const occurrenceKeys = new Set();
  let occurrenceCount = 0;
  let canonicalTextCount = 0;
  const witnessedRoutes = new Map();

  for (const reference of references) {
    if (!reference || typeof reference !== 'object') {
      fail('reference entry must be an object');
      continue;
    }
    if (ids.has(reference.id)) fail(`duplicate reference id: ${reference.id}`);
    ids.add(reference.id);
    if (reference.id !== `${reference.bookId}:${reference.key}`) fail(`reference id/key mismatch: ${reference.id}`);
    if (!registry.books[reference.bookId]) fail(`unknown bookId: ${reference.bookId}`);
    if (normalizeVerseKey(reference.key) !== reference.key) fail(`noncanonical key: ${reference.id}`);
    const parsedIndex = parseIndexReference(reference, registry);
    if (!parsedIndex) fail(`reference label does not round-trip through canonical registry: ${reference.id}`);

    if (reference.canonicalText !== null) {
      canonicalTextCount += 1;
      if (typeof reference.canonicalText !== 'string' || !reference.canonicalText.trim()) fail(`empty canonicalText: ${reference.id}`);
      if (!reference.canonicalSource || typeof reference.canonicalSource !== 'object') fail(`missing canonicalSource: ${reference.id}`);
      if (reference.kind === 'chapter-range' || parsedIndex?.parsed?.wholeChapter) fail(`chapter reference must not invent canonicalText: ${reference.id}`);
      const record = parsedIndex ? resolveBibleReference(parsedIndex.parsed, corpus) : null;
      if (!record || record.text !== reference.canonicalText) fail(`canonicalText does not match curated corpus: ${reference.id}`);
    } else if (reference.canonicalSource !== null) {
      fail(`canonicalSource must be null when canonicalText is null: ${reference.id}`);
    }

    if (!Array.isArray(reference.occurrences) || !reference.occurrences.length) {
      fail(`reference has no occurrences: ${reference.id}`);
      continue;
    }

    for (const occurrence of reference.occurrences) {
      occurrenceCount += 1;
      const route = normalizeRoute(occurrence.url);
      const routeRecord = routeRecords.get(route);
      if (!routeRecord || routeRecord.owner?.status !== 'production-dist') fail(`occurrence route is not a published owner: ${reference.id} ${route}`);
      const allowedTitles = manifestTitles.get(route);
      if (!allowedTitles?.has(occurrence.title)) fail(`occurrence title is not manifest-owned: ${reference.id} ${route}`);
      if (!occurrence.context || typeof occurrence.context !== 'string') fail(`missing context: ${reference.id} ${route}`);
      if (!occurrence.raw || typeof occurrence.raw !== 'string') fail(`missing raw reference: ${reference.id} ${route}`);
      if (occurrence.sourceKind !== 'manifest-metadata' && contextHasSourceSyntax(occurrence.context)) {
        fail(`source syntax leaked into context: ${reference.id} ${route} ${occurrence.sourceOwner}`);
      }
      if (!Array.isArray(occurrence.topics) || !sameArray(occurrence.topics, stableSorted(new Set(occurrence.topics)))) {
        fail(`topics must be unique and sorted: ${reference.id} ${route}`);
      }
      if (occurrence.anchor !== null && !SAFE_ANCHOR.test(occurrence.anchor)) fail(`unsafe anchor: ${reference.id} ${route}#${occurrence.anchor}`);

      if (occurrence.sourceKind === 'manifest-metadata') {
        if (occurrence.sourceOwner !== 'data/search-manifest.json') fail(`manifest occurrence owner drift: ${reference.id} ${route}`);
      } else {
        const sourceFiles = new Set(routeRecord?.inspection?.files || []);
        if (!sourceFiles.has(occurrence.sourceOwner)) fail(`source owner is outside route import graph: ${reference.id} ${route} ${occurrence.sourceOwner}`);
      }

      const occurrenceKey = [reference.id, route, occurrence.anchor || '', occurrence.sourceOwner, occurrence.raw, occurrence.context].join('\u0000');
      if (occurrenceKeys.has(occurrenceKey)) fail(`duplicate occurrence: ${reference.id} ${route}`);
      occurrenceKeys.add(occurrenceKey);

      if (DIST_ROOT) {
        const file = routeDistFile(route);
        if (!fs.existsSync(file)) {
          fail(`dist route missing: ${route}`);
          continue;
        }
        let witness = witnessedRoutes.get(route);
        if (!witness) {
          const html = fs.readFileSync(file, 'utf8');
          witness = { html, text: normalizeWitnessText(html) };
          witnessedRoutes.set(route, witness);
        }
        if (occurrence.anchor && !htmlHasLiteralId(witness.html, occurrence.anchor)) {
          fail(`dist anchor missing: ${reference.id} ${route}#${occurrence.anchor}`);
        }
        if (occurrence.sourceKind !== 'manifest-metadata') {
          const needle = normalizeWitnessText(occurrence.raw);
          if (needle && !witness.text.includes(needle)) fail(`source occurrence has no dist text witness: ${reference.id} ${route} raw=${occurrence.raw}`);
        }
      }
    }
  }

  if (occurrenceCount !== index.stats?.occurrences) fail(`occurrence stats mismatch: ${occurrenceCount} != ${index.stats?.occurrences}`);
  if (references.length !== index.stats?.references) fail(`reference stats mismatch: ${references.length} != ${index.stats?.references}`);
  if (canonicalTextCount !== index.stats?.canonicalTextRecords) fail(`canonicalText stats mismatch: ${canonicalTextCount} != ${index.stats?.canonicalTextRecords}`);
  if (references.length - canonicalTextCount !== index.stats?.referencesWithoutCanonicalText) fail('missing-canonical stats mismatch');

  if (!errors.length) {
    const suffix = DIST_ROOT ? `; dist witnessed ${witnessedRoutes.size} routes` : '';
    console.log(`Scripture occurrence index contract passed: ${references.length} references, ${occurrenceCount} occurrences, ${canonicalTextCount} curated text records${suffix}.`);
  }
}

if (errors.length) {
  if (errors.length > 80) console.error(`...and ${errors.length - 80} more errors`);
  process.exit(1);
}