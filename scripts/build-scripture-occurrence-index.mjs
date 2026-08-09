#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_REPOSITORY_ROOT,
  loadBibleCorpus,
  loadBibleRegistry,
  normalizeBookAlias,
  normalizeVerseKey,
  parseBibleReference,
  resolveBibleReference,
} from '../src/lib/bible-reference-core.mjs';

const require = createRequire(import.meta.url);
const { loadRouteRecords } = require('./lib/route-source-contract.js');

export const ROOT = DEFAULT_REPOSITORY_ROOT;
export const OUTPUT_FILE = path.join(ROOT, 'data/scripture-search-index.json');
const MANIFEST_FILE = path.join(ROOT, 'data/search-manifest.json');
const SOURCE_EXTENSIONS = new Set(['.astro', '.mdx', '.html']);
const SAFE_ANCHOR = /^[A-Za-zА-Яа-яЁё0-9][A-Za-zА-Яа-яЁё0-9_:.-]{0,127}$/u;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function repoRelative(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function normalizeRoute(value) {
  const raw = String(value || '').trim();
  const [withoutHash, hash = ''] = raw.split('#', 2);
  let route = withoutHash || '/';
  if (!route.startsWith('/')) route = `/${route}`;
  if (!path.posix.extname(route) && !route.endsWith('/')) route += '/';
  return { route, anchor: hash && SAFE_ANCHOR.test(hash) ? hash : null };
}

function replaceWithSpaces(value) {
  return String(value || '').replace(/[^\n]/g, ' ');
}

function maskRange(source, start, end) {
  return source.slice(0, start) + replaceWithSpaces(source.slice(start, end)) + source.slice(end);
}

function maskCommentsAndCode(source, extension) {
  let masked = String(source || '').replace(/\r\n/g, '\n');
  if (extension === '.astro' || extension === '.mdx') {
    const frontmatter = masked.match(/^---\n[\s\S]*?\n---\n?/);
    if (frontmatter) masked = maskRange(masked, 0, frontmatter[0].length);
  }

  const blockPatterns = [
    /<!--[\s\S]*?-->/g,
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    /<style\b[^>]*>[\s\S]*?<\/style>/gi,
  ];
  if (extension === '.mdx') {
    blockPatterns.push(/```[\s\S]*?```/g, /~~~[\s\S]*?~~~/g, /`[^`\n]*`/g);
  }
  for (const pattern of blockPatterns) {
    masked = masked.replace(pattern, (match) => replaceWithSpaces(match));
  }

  // S1 indexes only literal prose that can become visible route text. Imports,
  // component props, HTML/JSX attributes and Astro/MDX expressions remain
  // provenance inputs, but they are not occurrences until a dedicated carrier
  // contract proves that they render text on the current route.
  masked = masked
    .replace(/<[^>]*>/g, (match) => replaceWithSpaces(match))
    .replace(/\{[\s\S]*?\}/g, (match) => replaceWithSpaces(match));
  return masked;
}

function aliasPattern(alias) {
  const clean = String(alias || '').trim().replace(/\.$/, '');
  let output = '';
  for (const char of clean) {
    if (/\s/u.test(char)) output += '\\s*';
    else if (/[‐‑‒–—−-]/u.test(char)) output += '[‐‑‒–—−-]';
    else output += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return output + '\\.?';
}

function createReferenceRegex(registry) {
  const aliases = [];
  for (const book of Object.values(registry.books || {})) aliases.push(...(book.aliases || []));
  const unique = [...new Set(aliases.map((alias) => String(alias).trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length || a.localeCompare(b, 'ru'));
  const books = unique.map(aliasPattern).join('|');
  return new RegExp(
    `(?<![\\p{L}\\p{N}])(?<alias>${books})\\s+(?<chapter>\\d{1,3})(?:(?::\\s*(?<start>\\d{1,3}[а-яa-z]?)(?:\\s*[‐‑‒–—−-]\\s*(?<end>\\d{1,3}[а-яa-z]?))?)|(?:\\s*[‐‑‒–—−-]\\s*(?<chapterEnd>\\d{1,3})))?`,
    'giu',
  );
}

function parseCandidate(match, registry) {
  const raw = match[0].replace(/\s+/g, ' ').trim();
  const groups = match.groups || {};
  if (groups.chapterEnd) {
    const startParsed = parseBibleReference(`${groups.alias} ${groups.chapter}`, registry);
    const endParsed = parseBibleReference(`${groups.alias} ${groups.chapterEnd}`, registry);
    if (!startParsed.ok || !endParsed.ok || startParsed.bookId !== endParsed.bookId) return null;
    if (endParsed.chapter < startParsed.chapter) return null;
    return {
      raw,
      parsed: startParsed,
      bookId: startParsed.bookId,
      key: normalizeVerseKey(`${startParsed.chapter}–${endParsed.chapter}`),
      kind: 'chapter-range',
      chapterEnd: endParsed.chapter,
    };
  }

  const parsed = parseBibleReference(raw, registry);
  if (!parsed.ok) return null;
  return {
    raw,
    parsed,
    bookId: parsed.bookId,
    key: parsed.key,
    kind: parsed.wholeChapter ? 'chapter' : parsed.end ? 'verse-range' : 'verse',
    chapterEnd: null,
  };
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

function cleanContext(value) {
  return decodeEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/[{}[\]`]/g, ' ')
    .replace(/\b(?:class|data-[\w-]+|aria-[\w-]+|href|src|id)\s*=\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function contextAround(source, start, end) {
  const before = Math.max(0, start - 180);
  const after = Math.min(source.length, end + 220);
  let context = cleanContext(source.slice(before, after));
  if (context.length > 360) context = `${context.slice(0, 357).trimEnd()}…`;
  return context;
}

function nearestExplicitAnchor(source, offset, extension) {
  if (!['.astro', '.mdx', '.html'].includes(extension)) return null;
  const start = Math.max(0, offset - 1800);
  const prefix = source.slice(start, offset);
  const pattern = /\bid\s*=\s*["']([^"']+)["']/giu;
  let match;
  let last = null;
  while ((match = pattern.exec(prefix))) last = match;
  if (!last) return null;
  const value = last[1].trim();
  if (!SAFE_ANCHOR.test(value)) return null;
  if (prefix.length - (last.index + last[0].length) > 1200) return null;
  return value;
}

function sourceKind(file) {
  const extension = path.extname(file).toLowerCase();
  if (extension === '.astro') return 'astro-source';
  if (extension === '.mdx') return 'mdx-source';
  if (extension === '.html') return 'html-source';
  return 'module-source';
}

function canonicalLabel(candidate, registry) {
  const book = registry.books[candidate.bookId];
  const alias = (book.aliases || []).find((value) => !String(value).endsWith('.')) || book.aliases?.[0] || candidate.bookId;
  return `${alias} ${candidate.key}`;
}

function canonicalPayload(candidate, corpus) {
  if (candidate.kind === 'chapter-range' || candidate.parsed.wholeChapter) return { text: null, source: null };
  const record = resolveBibleReference(candidate.parsed, corpus);
  if (!record) return { text: null, source: null };
  return {
    text: record.text || null,
    source: {
      translation: record.translation || null,
      source: record.source || null,
      sourceUrl: record.sourceUrl || null,
      rights: record.rights || null,
      rightsState: record.rightsState || null,
      publicationState: record.publicationState || null,
      holds: record.holds || [],
      completeness: record.completeness || null,
      file: record.file || null,
    },
  };
}

function referenceSortKey(reference, bookOrder) {
  const chapter = Number(String(reference.key).match(/^\d+/)?.[0] || 0);
  const verse = Number(String(reference.key).match(/:(\d+)/)?.[1] || 0);
  return [bookOrder.get(reference.bookId) ?? 999, chapter, verse, reference.key];
}

function compareTuples(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const a = left[index];
    const b = right[index];
    if (a === b) continue;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a ?? '').localeCompare(String(b ?? ''), 'ru');
  }
  return 0;
}

function addOccurrence(grouped, candidate, occurrence, registry, corpus) {
  const id = `${candidate.bookId}:${candidate.key}`;
  let entry = grouped.get(id);
  if (!entry) {
    const canonical = canonicalPayload(candidate, corpus);
    entry = {
      id,
      bookId: candidate.bookId,
      testament: candidate.parsed.book.testament,
      key: candidate.key,
      kind: candidate.kind,
      label: canonicalLabel(candidate, registry),
      canonicalText: canonical.text,
      canonicalSource: canonical.source,
      occurrences: [],
    };
    grouped.set(id, entry);
  }
  const dedupeKey = [occurrence.url, occurrence.anchor || '', occurrence.sourceOwner, occurrence.raw, occurrence.context].join('\u0000');
  if (!entry._dedupe) entry._dedupe = new Set();
  if (entry._dedupe.has(dedupeKey)) return;
  entry._dedupe.add(dedupeKey);
  entry.occurrences.push(occurrence);
}

function splitManifestReferences(value) {
  return String(value || '')
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function exactCandidate(reference, registry, referenceRegex) {
  referenceRegex.lastIndex = 0;
  const match = referenceRegex.exec(reference);
  if (!match || match.index !== 0 || match[0].trim().length !== reference.trim().length) return null;
  return parseCandidate(match, registry);
}

export function buildScriptureOccurrenceIndex(root = ROOT) {
  if (root !== ROOT) throw new Error('custom roots are not supported by the current route-source contract');
  const manifest = readJson(MANIFEST_FILE);
  const routeData = loadRouteRecords();
  const registry = loadBibleRegistry(ROOT);
  const { corpus } = loadBibleCorpus(registry, ROOT);
  const referenceRegex = createReferenceRegex(registry);
  const routeMap = new Map(routeData.records.map((record) => [record.route, record]));
  const grouped = new Map();
  const scannedFiles = new Set();
  const indexedRoutes = new Set();
  let manifestOccurrences = 0;

  for (const item of manifest.items || []) {
    const normalized = normalizeRoute(item.url);
    const record = routeMap.get(normalized.route);
    if (!record || record.owner?.status !== 'production-dist' || !record.inspection?.exists) continue;
    indexedRoutes.add(normalized.route);
    const topics = [...new Set([item.section, ...(item.tags || [])].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));

    for (const reference of splitManifestReferences(item.scripture)) {
      const candidate = exactCandidate(reference, registry, referenceRegex);
      if (!candidate) continue;
      addOccurrence(grouped, candidate, {
        url: normalized.route,
        title: item.title,
        context: `Материал помечен ссылкой: ${reference}`,
        anchor: normalized.anchor,
        raw: reference,
        topics,
        sourceOwner: 'data/search-manifest.json',
        sourceKind: 'manifest-metadata',
      }, registry, corpus);
      manifestOccurrences += 1;
    }

    for (const fileRel of record.inspection.files || []) {
      const extension = path.extname(fileRel).toLowerCase();
      if (!SOURCE_EXTENSIONS.has(extension)) continue;
      const absolute = path.join(ROOT, fileRel);
      if (!fs.existsSync(absolute)) continue;
      scannedFiles.add(fileRel);
      const original = fs.readFileSync(absolute, 'utf8').replace(/\r\n/g, '\n');
      const masked = maskCommentsAndCode(original, extension);
      referenceRegex.lastIndex = 0;
      let match;
      while ((match = referenceRegex.exec(masked))) {
        const candidate = parseCandidate(match, registry);
        if (!candidate) continue;
        const context = contextAround(original, match.index, match.index + match[0].length);
        if (!context) continue;
        addOccurrence(grouped, candidate, {
          url: normalized.route,
          title: item.title,
          context,
          anchor: nearestExplicitAnchor(original, match.index, extension),
          raw: candidate.raw,
          topics,
          sourceOwner: fileRel,
          sourceKind: sourceKind(fileRel),
        }, registry, corpus);
      }
    }
  }

  const bookOrder = new Map(Object.keys(registry.books || {}).map((bookId, index) => [bookId, index]));
  const references = [...grouped.values()];
  for (const reference of references) {
    delete reference._dedupe;
    reference.occurrences.sort((a, b) => compareTuples(
      [a.url, a.anchor || '', a.sourceOwner, a.raw, a.context],
      [b.url, b.anchor || '', b.sourceOwner, b.raw, b.context],
    ));
  }
  references.sort((a, b) => compareTuples(referenceSortKey(a, bookOrder), referenceSortKey(b, bookOrder)));

  const occurrenceCount = references.reduce((sum, reference) => sum + reference.occurrences.length, 0);
  const canonicalTextRecords = references.filter((reference) => reference.canonicalText).length;
  const chapterRanges = references.filter((reference) => reference.kind === 'chapter-range').length;

  return {
    schemaVersion: 1,
    contract: 'SEARCH-P1-04-S1-source-owned-occurrence-index',
    inputs: {
      searchManifest: 'data/search-manifest.json',
      pageOwnership: 'migration/page-ownership.json',
      bibleRegistry: 'data/bible/books.json',
      bibleResolver: 'src/lib/bible-reference-core.mjs',
      routeSourceContract: 'scripts/lib/route-source-contract.js',
    },
    stats: {
      manifestItems: (manifest.items || []).length,
      indexedRoutes: indexedRoutes.size,
      scannedSourceFiles: scannedFiles.size,
      references: references.length,
      occurrences: occurrenceCount,
      canonicalTextRecords,
      referencesWithoutCanonicalText: references.length - canonicalTextRecords,
      chapterRanges,
      manifestOccurrences,
    },
    references,
  };
}

export function serializeScriptureOccurrenceIndex(index) {
  return `${JSON.stringify(index, null, 2)}\n`;
}

function main() {
  const write = process.argv.includes('--write');
  const check = process.argv.includes('--check') || !write;
  if (write && process.argv.includes('--check')) throw new Error('choose either --write or --check');
  const index = buildScriptureOccurrenceIndex();
  const serialized = serializeScriptureOccurrenceIndex(index);

  if (write) {
    fs.writeFileSync(OUTPUT_FILE, serialized, 'utf8');
    console.log(`Wrote ${repoRelative(OUTPUT_FILE)}: ${index.stats.references} references, ${index.stats.occurrences} occurrences, ${index.stats.indexedRoutes} routes.`);
    return;
  }

  if (check) {
    if (!fs.existsSync(OUTPUT_FILE)) {
      console.error(`SCRIPTURE OCCURRENCE INDEX FAILED: missing ${repoRelative(OUTPUT_FILE)}; run with --write`);
      process.exit(1);
    }
    const current = fs.readFileSync(OUTPUT_FILE, 'utf8');
    if (current !== serialized) {
      console.error(`SCRIPTURE OCCURRENCE INDEX FAILED: ${repoRelative(OUTPUT_FILE)} is stale; run with --write`);
      process.exit(1);
    }
    console.log(`Scripture occurrence index is current: ${index.stats.references} references, ${index.stats.occurrences} occurrences, ${index.stats.indexedRoutes} routes.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
