#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_REPOSITORY_ROOT,
  createBibleResolver,
  normalizeBibleRecord,
  normalizeVerseKey
} from '../src/lib/bible-reference-core.mjs';

const ROOT = DEFAULT_REPOSITORY_ROOT;
const REPORTS = path.join(ROOT, 'reports');
const STRICT = process.argv.includes('--strict');
const SOURCE_EXTENSIONS = new Set(['.astro', '.html', '.md', '.mdx', '.jsx', '.tsx']);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'out', 'build', 'coverage', 'reports', 'pagefind', '.astro']);
const errors = [];
const warnings = [];

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function normalizeText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[«»„“”"']/g, '')
    .replace(/ё/g, 'е')
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function rangeCount(key) {
  const match = normalizeVerseKey(key).match(/^(\d+):(\d+)–(\d+)$/);
  if (!match) return 1;
  const start = Number(match[2]);
  const end = Number(match[3]);
  return end >= start ? end - start + 1 : 1;
}

function hasEllipsis(value) {
  return /\.\.\.|…|\[\.\.\.\]/.test(String(value || ''));
}

function inspectCorpus(resolver) {
  const records = [];
  for (const book of resolver.books) {
    const expectedTranslationId = resolver.registry.defaultTranslations[book.book.testament];
    const expectedTranslationLabel = resolver.registry.translations[expectedTranslationId]?.label || '';
    const actualFolder = path.dirname(book.book.file).split('/').pop();
    if (actualFolder !== expectedTranslationId) {
      errors.push(`${rel(book.file)}: ${book.book.testament} must use ${expectedTranslationId}`);
    }
    if (book.meta.translation !== expectedTranslationLabel) {
      errors.push(`${rel(book.file)}: translation metadata differs from registry`);
    }
    if (!book.meta.source) warnings.push(`${rel(book.file)}: missing _meta.source`);
    if (!book.meta.sourceUrl) warnings.push(`${rel(book.file)}: missing _meta.sourceUrl`);
    if (!book.meta.rights) warnings.push(`${rel(book.file)}: missing _meta.rights`);

    const json = readJson(book.file);
    for (const [rawKey, rawValue] of Object.entries(json)) {
      if (rawKey === '_meta') continue;
      const key = normalizeVerseKey(rawKey);
      if (!/^\d+:\d+[а-яa-z]?(?:–\d+[а-яa-z]?)?$/iu.test(key)) {
        errors.push(`${rel(book.file)}:${rawKey}: invalid verse key`);
      }
      const record = normalizeBibleRecord(rawValue, book.meta, key);
      if (!record.text) errors.push(`${rel(book.file)}:${key}: empty verse text`);
      if (record.completeness === 'full' && hasEllipsis(record.text)) {
        errors.push(`${rel(book.file)}:${key}: full record contains an ellipsis`);
      }
      if (record.completeness === 'excerpt' && !record.note) {
        errors.push(`${rel(book.file)}:${key}: excerpt requires an explanatory note`);
      }
      const count = rangeCount(key);
      if (record.completeness === 'full' && count > 1 && record.text.length < count * 35) {
        warnings.push(`${rel(book.file)}:${key}: unusually short full range (${record.text.length} chars/${count} verses)`);
      }
      records.push({ file: rel(book.file), key, ...record });
    }
  }
  return records;
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'));
  return match ? match[1] : '';
}

function inspectSources(resolver) {
  const references = [];
  const inlinePayloads = [];
  let legacyGbxUsage = 0;

  for (const file of walk(ROOT)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/<(?:button|span|a)\b[^>]*>/gi)) {
      const tag = match[0];
      const className = attr(tag, 'class');
      if (/\bbref\b/.test(className)) {
        const value = attr(tag, 'data-ref');
        if (value) references.push({ kind: 'bref', file: rel(file), value });
      }
      if (/\bgbx-verse\b/.test(className)) {
        legacyGbxUsage += 1;
        const value = attr(tag, 'data-verse');
        if (value) references.push({ kind: 'gbx-verse', file: rel(file), value });
      }
    }
    for (const match of source.matchAll(/<script\b[^>]*id=["']bibleRefs["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        inlinePayloads.push({ file: rel(file), payload: JSON.parse(match[1].trim() || '{}') });
      } catch (error) {
        errors.push(`${rel(file)}: invalid inline #bibleRefs JSON: ${error.message}`);
      }
    }
  }

  if (legacyGbxUsage) errors.push(`legacy .gbx-verse usage remains in ${legacyGbxUsage} source location(s)`);

  const sourceRefs = references.map((item) => {
    const { parsed, record } = resolver.resolve(item.value);
    if (!parsed.ok) warnings.push(`${item.file}: ${item.value}: ${parsed.reason}`);
    else if (parsed.wholeChapter) warnings.push(`${item.file}: ${item.value}: whole chapter must not open a tooltip`);
    else if (!record) warnings.push(`${item.file}: ${item.value}: missing central record`);
    return {
      ...item,
      parsed: parsed.ok ? { bookId: parsed.bookId, key: parsed.key, wholeChapter: parsed.wholeChapter } : { error: parsed.reason },
      resolved: Boolean(record),
      completeness: record?.completeness || ''
    };
  });

  const inline = [];
  for (const item of inlinePayloads) {
    for (const [reference, value] of Object.entries(item.payload)) {
      const incoming = typeof value === 'string' ? { text: value } : value || {};
      const { parsed, record } = resolver.resolve(reference);
      let status = 'ok';
      if (!parsed.ok) status = 'unparsed';
      else if (!record) status = 'missing-central';
      else if (normalizeText(incoming.text) !== normalizeText(record.text)) status = 'drift';
      else if (incoming.translation && incoming.translation !== record.translation) status = 'translation-drift';
      else if (incoming.completeness && incoming.completeness !== record.completeness) status = 'completeness-drift';

      if (status === 'drift' || status === 'translation-drift' || status === 'completeness-drift') {
        errors.push(`${item.file}: inline ${reference}: ${status}`);
      } else if (status !== 'ok') {
        warnings.push(`${item.file}: inline ${reference}: ${status}`);
      }
      inline.push({ file: item.file, reference, status, resolvedFile: record?.file || '' });
    }
  }

  return { references: sourceRefs, inline, legacyGbxUsage };
}

function inspectLegacyVerses(resolver) {
  const file = path.join(ROOT, 'data/verses.json');
  if (!fs.existsSync(file)) return { entries: [], used: false };
  const data = readJson(file);
  const entries = [];

  for (const [reference, text] of Object.entries(data)) {
    const { parsed, record } = resolver.resolve(reference);
    let status = 'ok';
    if (!parsed.ok) status = 'unparsed';
    else if (!record) status = 'second-source-only';
    else if (normalizeText(text) !== normalizeText(record.text)) status = 'translation-drift';
    entries.push({ reference, status, resolvedFile: record?.file || '' });
  }

  warnings.push(`data/verses.json is a deprecated second source of truth (${entries.length} entries; no supported .gbx-verse consumers)`);
  return { entries, used: false };
}

function main() {
  const resolver = createBibleResolver(ROOT);
  const corpusRecords = inspectCorpus(resolver);
  const sourceUsage = inspectSources(resolver);
  const legacyVerses = inspectLegacyVerses(resolver);
  const report = {
    generatedAt: new Date().toISOString(),
    registry: {
      books: Object.keys(resolver.registry.books || {}).length,
      aliases: resolver.registry.aliasMap.size,
      defaultTranslations: resolver.registry.defaultTranslations
    },
    corpus: { recordCount: corpusRecords.length, records: corpusRecords },
    sourceUsage,
    legacyVerses,
    errors,
    warnings
  };

  fs.mkdirSync(REPORTS, { recursive: true });
  fs.writeFileSync(path.join(REPORTS, 'bible-reference-audit.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(REPORTS, 'bible-reference-audit.md'), [
    '# Bible reference contract', '',
    `- Central records: ${corpusRecords.length}`,
    `- Source references: ${sourceUsage.references.length}`,
    `- Inline payload entries: ${sourceUsage.inline.length}`,
    `- Errors: ${errors.length}`,
    `- Warnings: ${warnings.length}`,
    '', '## Errors', '', ...(errors.length ? errors.map((item) => `- ${item}`) : ['- none']),
    '', '## Warnings', '', ...(warnings.length ? warnings.map((item) => `- ${item}`) : ['- none'])
  ].join('\n') + '\n');

  console.log(`Bible reference contract: ${corpusRecords.length} central records, ${sourceUsage.references.length} source refs, ${errors.length} errors, ${warnings.length} warnings.`);
  if (STRICT && errors.length) process.exit(1);
}

main();
