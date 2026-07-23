#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DATA_ROOT = path.join(ROOT, 'data/bible');
const REPORTS = path.join(ROOT, 'reports');
const STRICT = process.argv.includes('--strict');
const SOURCE_EXTENSIONS = new Set(['.astro', '.html', '.md', '.mdx', '.jsx', '.tsx']);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'out', 'build', 'coverage', 'reports', 'pagefind', '.astro']);

const errors = [];
const warnings = [];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function normalizeText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[«»„“”"']/g, '')
    .replace(/ё/g, 'е')
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeAlias(value) {
  return String(value || '')
    .replace(/ё/g, 'е')
    .replace(/[.]/g, '')
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.github') continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) out.push(abs);
  }
  return out;
}

function loadRegistry() {
  const file = path.join(DATA_ROOT, 'books.json');
  const registry = readJson(file);
  const aliasMap = new Map();
  for (const [id, book] of Object.entries(registry.books || {})) {
    for (const alias of book.aliases || []) {
      const key = normalizeAlias(alias);
      const prior = aliasMap.get(key);
      if (prior && prior !== id) errors.push(`book alias collision: ${alias} → ${prior}/${id}`);
      else aliasMap.set(key, id);
    }
  }
  return { ...registry, aliasMap };
}

function parseReference(input, registry) {
  const original = String(input || '').trim();
  const clean = original
    .replace(/\u00a0/g, ' ')
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  const match = clean.match(/^(.+?)\s+(\d+)(?::(\d+[а-яa-z]?)(?:-(\d+[а-яa-z]?))?)?$/i);
  if (!match) return { ok: false, original, reason: 'unparsed' };
  const bookInput = normalizeAlias(match[1]);
  const bookId = registry.aliasMap.get(bookInput);
  if (!bookId) return { ok: false, original, reason: `unknown book: ${match[1]}` };
  const chapter = Number(match[2]);
  const start = match[3] || null;
  const end = match[4] || null;
  const key = start ? `${chapter}:${start}${end ? `–${end}` : ''}` : String(chapter);
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

function rangeCount(key) {
  const match = String(key).match(/^(\d+):(\d+)[–—-](\d+)$/);
  if (!match) return 1;
  const start = Number(match[2]);
  const end = Number(match[3]);
  return end >= start ? end - start + 1 : 1;
}

function looksAbridged(text) {
  return /\.\.\.|…|\[\.\.\.\]|<abbr\b/i.test(String(text || ''));
}

function loadCorpus(registry) {
  const corpus = new Map();
  const books = [];
  for (const [bookId, book] of Object.entries(registry.books || {})) {
    const file = path.join(DATA_ROOT, book.file);
    if (!fs.existsSync(file)) {
      errors.push(`registry file missing: ${bookId} → ${book.file}`);
      continue;
    }
    let json;
    try { json = readJson(file); }
    catch (error) {
      errors.push(`${rel(file)}: invalid JSON: ${error.message}`);
      continue;
    }
    const expectedTranslation = registry.defaultTranslations[book.testament];
    const actualTranslation = path.dirname(book.file).split('/').pop();
    if (actualTranslation !== expectedTranslation) {
      errors.push(`${rel(file)}: ${book.testament} must use ${expectedTranslation}, found ${actualTranslation}`);
    }
    const meta = json._meta || {};
    const expectedLabel = registry.translations[expectedTranslation]?.label || '';
    if (expectedLabel && meta.translation !== expectedLabel) {
      errors.push(`${rel(file)}: _meta.translation="${meta.translation || ''}", expected "${expectedLabel}"`);
    }
    if (!meta.source) warnings.push(`${rel(file)}: missing _meta.source`);
    else if (/веб-поиск|выверено в статье|открытым публикациям/i.test(meta.source)) {
      warnings.push(`${rel(file)}: source provenance is too vague: ${meta.source}`);
    }
    const entries = [];
    for (const [key, value] of Object.entries(json)) {
      if (key === '_meta') continue;
      if (typeof value !== 'string' || !value.trim()) {
        errors.push(`${rel(file)}:${key}: empty/non-string verse text`);
        continue;
      }
      if (!/^\d+:\d+[а-яa-z]?(?:[–—-]\d+[а-яa-z]?)?$/i.test(key)) {
        errors.push(`${rel(file)}:${key}: invalid verse key`);
      }
      const canonicalKey = key.replace(/[—-]/g, '–');
      const count = rangeCount(canonicalKey);
      if (count > 1 && looksAbridged(value)) {
        errors.push(`${rel(file)}:${canonicalKey}: range is marked as full but contains an ellipsis`);
      }
      if (count > 1 && value.length < count * 35) {
        warnings.push(`${rel(file)}:${canonicalKey}: unusually short text for ${count} verses (${value.length} chars)`);
      }
      const record = {
        bookId,
        testament: book.testament,
        translation: expectedTranslation,
        translationLabel: expectedLabel,
        source: meta.source || '',
        key: canonicalKey,
        text: value,
        file: rel(file),
        completeness: looksAbridged(value) ? 'excerpt' : 'full'
      };
      corpus.set(`${bookId}:${canonicalKey}`, record);
      entries.push(record);
    }
    books.push({ bookId, file: rel(file), meta, entryCount: entries.length, entries });
  }
  return { corpus, books };
}

function resolveReference(parsed, corpus) {
  if (!parsed.ok || parsed.wholeChapter) return null;
  const exact = corpus.get(`${parsed.bookId}:${parsed.key}`);
  if (exact) return exact;
  if (!parsed.end) return null;
  const start = Number(String(parsed.start).replace(/\D/g, ''));
  const end = Number(String(parsed.end).replace(/\D/g, ''));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const parts = [];
  for (let verse = start; verse <= end; verse += 1) {
    const record = corpus.get(`${parsed.bookId}:${parsed.chapter}:${verse}`);
    if (!record) return null;
    parts.push(record);
  }
  return {
    bookId: parsed.bookId,
    testament: parsed.book.testament,
    translation: parts[0].translation,
    translationLabel: parts[0].translationLabel,
    source: parts.map((item) => item.source).filter(Boolean).join('; '),
    key: parsed.key,
    text: parts.map((item) => item.text).join(' '),
    file: parts.map((item) => item.file).join(', '),
    completeness: parts.every((item) => item.completeness === 'full') ? 'full' : 'excerpt'
  };
}

function extractAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'));
  return match ? match[1] : '';
}

function scanSources(registry, corpus) {
  const refs = [];
  const inlinePayloads = [];
  for (const file of walk(ROOT)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/<(?:button|span|a)\b[^>]*>/gi)) {
      const tag = match[0];
      const className = extractAttribute(tag, 'class');
      if (/\bbref\b/.test(className)) {
        const value = extractAttribute(tag, 'data-ref');
        if (value) refs.push({ kind: 'bref', file: rel(file), value });
      }
      if (/\bgbx-verse\b/.test(className)) {
        const value = extractAttribute(tag, 'data-verse');
        if (value) refs.push({ kind: 'gbx-verse', file: rel(file), value });
      }
    }
    for (const match of source.matchAll(/<script\b[^>]*id=["']bibleRefs["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      const raw = match[1].trim();
      try {
        const payload = JSON.parse(raw || '{}');
        inlinePayloads.push({ file: rel(file), payload });
      } catch (error) {
        errors.push(`${rel(file)}: invalid inline #bibleRefs JSON: ${error.message}`);
      }
    }
  }

  const resolvedRefs = refs.map((item) => {
    const parsed = parseReference(item.value, registry);
    const resolved = resolveReference(parsed, corpus);
    if (!parsed.ok) warnings.push(`${item.file}: ${item.kind} ${item.value}: ${parsed.reason}`);
    else if (!parsed.wholeChapter && !resolved) warnings.push(`${item.file}: ${item.kind} ${item.value}: missing central text`);
    return { ...item, parsed, resolved: Boolean(resolved) };
  });

  const inline = [];
  for (const item of inlinePayloads) {
    for (const [reference, value] of Object.entries(item.payload)) {
      const text = typeof value === 'string' ? value : value && value.text;
      const parsed = parseReference(reference, registry);
      const resolved = resolveReference(parsed, corpus);
      let status = 'ok';
      if (!parsed.ok) {
        status = 'unparsed';
        warnings.push(`${item.file}: inline ${reference}: ${parsed.reason}`);
      } else if (!resolved) {
        status = 'missing-central';
        warnings.push(`${item.file}: inline ${reference}: missing central text`);
      } else if (normalizeText(text) !== normalizeText(resolved.text)) {
        status = 'drift';
        errors.push(`${item.file}: inline ${reference}: differs from ${resolved.file}`);
      }
      inline.push({ file: item.file, reference, status, resolvedFile: resolved?.file || '' });
    }
  }
  return { refs: resolvedRefs, inline };
}

function auditLegacyVerses(registry, corpus) {
  const file = path.join(ROOT, 'data/verses.json');
  if (!fs.existsSync(file)) return [];
  const data = readJson(file);
  const records = [];
  for (const [reference, text] of Object.entries(data)) {
    const parsed = parseReference(reference, registry);
    const resolved = resolveReference(parsed, corpus);
    let status = 'ok';
    if (!parsed.ok) {
      status = 'unparsed';
      warnings.push(`data/verses.json:${reference}: ${parsed.reason}`);
    } else if (!resolved) {
      status = 'second-source-only';
      warnings.push(`data/verses.json:${reference}: not present in central corpus`);
    } else if (normalizeText(text) !== normalizeText(resolved.text)) {
      status = 'translation-drift';
      errors.push(`data/verses.json:${reference}: differs from ${resolved.translationLabel} central text`);
    }
    if (parsed.ok && parsed.end && looksAbridged(text)) {
      errors.push(`data/verses.json:${reference}: range contains ellipsis`);
    }
    records.push({ reference, status, testament: parsed.ok ? parsed.book.testament : '', resolvedFile: resolved?.file || '' });
  }
  return records;
}

function main() {
  const registry = loadRegistry();
  const { corpus, books } = loadCorpus(registry);
  const sourceUsage = scanSources(registry, corpus);
  const legacyVerses = auditLegacyVerses(registry, corpus);
  const report = {
    generatedAt: new Date().toISOString(),
    registry: {
      books: Object.keys(registry.books || {}).length,
      aliases: registry.aliasMap.size,
      defaultTranslations: registry.defaultTranslations
    },
    corpus: {
      books: books.map(({ entries, ...book }) => book),
      entryCount: corpus.size
    },
    sourceUsage,
    legacyVerses,
    errors,
    warnings
  };

  fs.mkdirSync(REPORTS, { recursive: true });
  fs.writeFileSync(path.join(REPORTS, 'bible-reference-audit.json'), JSON.stringify(report, null, 2) + '\n');
  const md = [
    '# Bible reference audit', '',
    `- Registry books: ${report.registry.books}`,
    `- Registry aliases: ${report.registry.aliases}`,
    `- Central verse/range records: ${report.corpus.entryCount}`,
    `- Source references: ${sourceUsage.refs.length}`,
    `- Inline bibleRefs entries: ${sourceUsage.inline.length}`,
    `- Legacy verses entries: ${legacyVerses.length}`,
    `- Errors: ${errors.length}`,
    `- Warnings: ${warnings.length}`,
    '', '## Errors', '',
    ...(errors.length ? errors.map((item) => `- ${item}`) : ['- none']),
    '', '## Warnings', '',
    ...(warnings.length ? warnings.map((item) => `- ${item}`) : ['- none'])
  ];
  fs.writeFileSync(path.join(REPORTS, 'bible-reference-audit.md'), md.join('\n') + '\n');

  console.log(`Bible reference audit: ${report.corpus.entryCount} central records, ${sourceUsage.refs.length} source refs, ${errors.length} errors, ${warnings.length} warnings.`);
  if (STRICT && errors.length) process.exit(1);
}

main();
