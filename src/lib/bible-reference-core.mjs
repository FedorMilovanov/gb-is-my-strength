import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPOSITORY_ROOT = path.resolve(MODULE_DIR, '../..');

export const BIBLE_RIGHTS_STATES = Object.freeze({
  UNKNOWN: 'RIGHTS_UNKNOWN',
  PERMISSION_REQUIRED: 'PERMISSION_REQUIRED',
  ELIGIBLE: 'PUBLICATION_ELIGIBLE',
});

export const BIBLE_PUBLICATION_STATES = Object.freeze({
  BLOCKED: 'BLOCKED',
  REFERENCE: 'REFERENCE',
  APPROVED: 'PUBLICATION_APPROVED',
});

const KNOWN_RIGHTS_STATES = new Set(Object.values(BIBLE_RIGHTS_STATES));
const KNOWN_PUBLICATION_STATES = new Set(Object.values(BIBLE_PUBLICATION_STATES));

function normalizeRightsState(value) {
  const state = String(value || '').trim().toUpperCase();
  return KNOWN_RIGHTS_STATES.has(state) ? state : BIBLE_RIGHTS_STATES.UNKNOWN;
}

function normalizePublicationState(value) {
  const state = String(value || '').trim().toUpperCase();
  return KNOWN_PUBLICATION_STATES.has(state) ? state : BIBLE_PUBLICATION_STATES.BLOCKED;
}

function normalizeHolds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || '').trim().toUpperCase()).filter(Boolean))].sort();
}

export function isBibleRecordPublicationEligible(record = {}) {
  if (record.publicationState !== BIBLE_PUBLICATION_STATES.APPROVED) return false;
  if (record.rightsState !== BIBLE_RIGHTS_STATES.ELIGIBLE) return false;
  if ((record.holds || []).length > 0) return false;
  return Boolean(
    String(record.translation || '').trim()
    && String(record.source || '').trim()
    && String(record.sourceUrl || '').trim()
    && String(record.rights || '').trim()
  );
}

export function normalizeBookAlias(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.]/g, '')
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeVerseKey(value) {
  return String(value || '')
    .replace(/[‐‑‒–—−-]/g, '–')
    .replace(/\s+/g, '')
    .trim();
}

export function loadBibleRegistry(root = DEFAULT_REPOSITORY_ROOT) {
  const file = path.join(root, 'data/bible/books.json');
  const registry = JSON.parse(fs.readFileSync(file, 'utf8'));
  const aliasMap = new Map();

  for (const [bookId, book] of Object.entries(registry.books || {})) {
    for (const alias of book.aliases || []) {
      const normalized = normalizeBookAlias(alias);
      if (!normalized) continue;
      const prior = aliasMap.get(normalized);
      if (prior && prior !== bookId) {
        throw new Error(`Bible book alias collision: ${alias} → ${prior}/${bookId}`);
      }
      aliasMap.set(normalized, bookId);
    }
  }

  return { ...registry, aliasMap, file };
}

export function parseBibleReference(input, registry) {
  const original = String(input || '').trim();
  const normalized = original
    .replace(/\u00a0/g, ' ')
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  const match = normalized.match(/^(.+?)\s+(\d+)(?::(\d+[а-яa-z]?)(?:-(\d+[а-яa-z]?))?)?$/iu);
  if (!match) return { ok: false, original, reason: 'unparsed reference' };

  const bookId = registry.aliasMap.get(normalizeBookAlias(match[1]));
  if (!bookId) return { ok: false, original, reason: `unknown book: ${match[1]}` };

  const chapter = Number(match[2]);
  const start = match[3] || null;
  const end = match[4] || null;
  const key = start
    ? normalizeVerseKey(`${chapter}:${start}${end ? `-${end}` : ''}`)
    : String(chapter);

  return {
    ok: true,
    original,
    bookId,
    book: registry.books[bookId],
    chapter,
    start,
    end,
    key,
    wholeChapter: !start
  };
}

export function normalizeBibleRecord(value, bookMeta = {}, key = '') {
  const record = typeof value === 'string'
    ? { text: value }
    : value && typeof value === 'object'
      ? value
      : { text: '' };

  const text = String(record.text || '').trim();
  const completeness = record.completeness === 'excerpt' ? 'excerpt' : 'full';

  return {
    key: normalizeVerseKey(key),
    text,
    completeness,
    note: String(record.note || '').trim(),
    translation: String(record.translation || bookMeta.translation || '').trim(),
    source: String(record.source || bookMeta.source || '').trim(),
    sourceUrl: String(record.sourceUrl || bookMeta.sourceUrl || '').trim(),
    rights: String(record.rights || bookMeta.rights || '').trim(),
    rightsState: normalizeRightsState(record.rightsState || bookMeta.rightsState),
    publicationState: normalizePublicationState(record.publicationState || bookMeta.publicationState),
    holds: normalizeHolds(record.holds ?? bookMeta.holds),
  };
}

export function loadBibleCorpus(registry, root = DEFAULT_REPOSITORY_ROOT) {
  const corpus = new Map();
  const books = [];

  for (const [bookId, book] of Object.entries(registry.books || {})) {
    const file = path.join(root, 'data/bible', book.file);
    if (!fs.existsSync(file)) continue;

    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    const translationId = String(book.translation || registry.defaultTranslationByTestament?.[book.testament] || '').trim();
    const translationPolicy = registry.translations?.[translationId] || {};
    const meta = { ...translationPolicy, ...(json._meta || {}) };
    if (!meta.translation && translationPolicy.label) meta.translation = translationPolicy.label;
    const entries = [];

    for (const [rawKey, value] of Object.entries(json)) {
      if (rawKey === '_meta') continue;
      const record = {
        ...normalizeBibleRecord(value, meta, rawKey),
        bookId,
        testament: book.testament,
        file: path.relative(root, file).split(path.sep).join('/')
      };
      corpus.set(`${bookId}:${record.key}`, record);
      entries.push(record);
    }

    books.push({ bookId, book, meta, file, entries });
  }

  return { corpus, books };
}

function numericVerse(value) {
  const match = String(value || '').match(/^\d+/);
  return match ? Number(match[0]) : null;
}

export function resolveBibleReference(parsed, corpus) {
  if (!parsed || !parsed.ok || parsed.wholeChapter) return null;

  const exact = corpus.get(`${parsed.bookId}:${parsed.key}`);
  if (exact) return { ...exact, reference: parsed.original };

  if (!parsed.end) return null;
  const start = numericVerse(parsed.start);
  const end = numericVerse(parsed.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;

  const records = [];
  for (let verse = start; verse <= end; verse += 1) {
    const record = corpus.get(`${parsed.bookId}:${parsed.chapter}:${verse}`);
    if (!record) return null;
    records.push(record);
  }

  const rightsStates = [...new Set(records.map((record) => record.rightsState))];
  const publicationStates = [...new Set(records.map((record) => record.publicationState))];

  return {
    reference: parsed.original,
    key: parsed.key,
    bookId: parsed.bookId,
    testament: parsed.book.testament,
    text: records.map((record) => record.text).join(' '),
    completeness: records.every((record) => record.completeness === 'full') ? 'full' : 'excerpt',
    note: records.map((record) => record.note).filter(Boolean).join(' '),
    translation: records[0]?.translation || '',
    source: [...new Set(records.map((record) => record.source).filter(Boolean))].join('; '),
    sourceUrl: [...new Set(records.map((record) => record.sourceUrl).filter(Boolean))].join('; '),
    rights: [...new Set(records.map((record) => record.rights).filter(Boolean))].join('; '),
    rightsState: rightsStates.length === 1 ? rightsStates[0] : BIBLE_RIGHTS_STATES.UNKNOWN,
    publicationState: publicationStates.length === 1 ? publicationStates[0] : BIBLE_PUBLICATION_STATES.BLOCKED,
    holds: [...new Set(records.flatMap((record) => record.holds || []))].sort(),
    file: [...new Set(records.map((record) => record.file))].join(', ')
  };
}

export function createBibleResolver(root = DEFAULT_REPOSITORY_ROOT) {
  const registry = loadBibleRegistry(root);
  const { corpus, books } = loadBibleCorpus(registry, root);

  return {
    registry,
    corpus,
    books,
    parse(reference) {
      return parseBibleReference(reference, registry);
    },
    resolve(reference) {
      const parsed = parseBibleReference(reference, registry);
      return { parsed, record: resolveBibleReference(parsed, corpus) };
    },
    payload(references, options = {}) {
      const output = {};
      const missing = [];
      for (const reference of [...new Set(references || [])]) {
        const { parsed, record } = this.resolve(reference);
        if (!record) {
          missing.push({ reference, parsed });
          continue;
        }
        output[reference] = options.legacyStrings
          ? record.text
          : {
              text: record.text,
              translation: record.translation,
              completeness: record.completeness,
              rightsState: record.rightsState,
              publicationState: record.publicationState,
              holds: record.holds,
              ...(record.note ? { note: record.note } : {}),
              ...(record.source ? { source: record.source } : {}),
              ...(record.sourceUrl ? { sourceUrl: record.sourceUrl } : {}),
              ...(record.rights ? { rights: record.rights } : {})
            };
      }
      return { output, missing };
    }
  };
}

export function escapeJsonForHtml(value) {
  return JSON.stringify(value, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
