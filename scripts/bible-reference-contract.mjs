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
const STRICT = process.argv.includes('--strict');
const errors = [];
const warnings = [];

function fail(message) { errors.push(message); }
function warn(message) { warnings.push(message); }
function rel(file) { return path.relative(ROOT, file).split(path.sep).join('/'); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function walk(directory, output = []) {
  if (!fs.existsSync(directory)) return output;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'dist', 'reports', 'public'].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, output);
    else if (/\.(?:astro|html|md|mdx|js|mjs|ts|tsx)$/i.test(entry.name)) output.push(full);
  }
  return output;
}

function extractFrontmatter(source) {
  const match = String(source || '').replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : '';
}

function inspectInlinePayloads(files) {
  const payloads = [];
  const patterns = [
    /<script\b[^>]*\bid=["']bibleData["'][^>]*>([\s\S]*?)<\/script>/gi,
    /<script\b[^>]*\bid=["']bible-data["'][^>]*>([\s\S]*?)<\/script>/gi
  ];

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(source))) {
        const raw = match[1].trim();
        if (!raw) continue;
        try {
          const value = JSON.parse(raw);
          payloads.push({ file: rel(file), value });
        } catch (error) {
          fail(`${rel(file)}: invalid inline Bible JSON (${error.message})`);
        }
      }
    }
  }
  return payloads;
}

function inspectCorpus(resolver) {
  for (const { bookId, book, meta, file, entries } of resolver.books) {
    if (!meta.translation) warn(`${rel(file)}: missing _meta.translation`);
    if (!meta.source) warn(`${rel(file)}: missing _meta.source`);
    if (!meta.sourceUrl) warn(`${rel(file)}: missing _meta.sourceUrl`);
    if (!meta.rights) warn(`${rel(file)}: missing _meta.rights`);

    for (const entry of entries) {
      if (!/^\d+(?::\d+[а-яa-z]?(?:–\d+[а-яa-z]?)?)?$/iu.test(entry.key)) {
        fail(`${entry.file}: invalid verse key ${entry.key}`);
      }
      if (!entry.text) fail(`${entry.file} ${entry.key}: empty text`);
      if (/\.\.\.|…/.test(entry.text) && entry.completeness !== 'excerpt') {
        fail(`${entry.file} ${entry.key}: ellipsis requires completeness=excerpt`);
      }
      if (entry.completeness === 'excerpt' && !entry.note) {
        fail(`${entry.file} ${entry.key}: excerpt requires explanatory note`);
      }
      if (entry.translation && meta.translation && entry.translation !== meta.translation) {
        fail(`${entry.file} ${entry.key}: record translation differs from book metadata`);
      }
      if (!book.testament) fail(`${entry.file}: registry book ${bookId} lacks testament`);
    }
  }
}

function compareInlinePayloads(resolver, payloads) {
  for (const payload of payloads) {
    for (const [reference, value] of Object.entries(payload.value || {})) {
      const { parsed, record } = resolver.resolve(reference);
      if (!parsed.ok) {
        warn(`${payload.file}: unparsed inline reference ${reference}`);
        continue;
      }
      if (!record) {
        warn(`${payload.file}: no canonical record for ${reference}`);
        continue;
      }
      const inline = normalizeBibleRecord(value, {}, parsed.key);
      if (inline.text && inline.text !== record.text) {
        fail(`${payload.file}: inline text conflicts with canonical ${reference}`);
      }
      if (inline.translation && record.translation && inline.translation !== record.translation) {
        fail(`${payload.file}: inline translation conflicts with canonical ${reference}`);
      }
      if (/\.\.\.|…/.test(inline.text) && inline.completeness !== 'excerpt') {
        fail(`${payload.file}: inline ellipsis for ${reference} requires completeness=excerpt`);
      }
    }
  }
}

function inspectLegacyVerses(resolver) {
  const file = path.join(ROOT, 'data/verses.json');
  if (!fs.existsSync(file)) return;
  const legacy = readJson(file);
  for (const [reference, text] of Object.entries(legacy || {})) {
    const { parsed, record } = resolver.resolve(reference);
    if (!parsed.ok) {
      warn(`data/verses.json: unparsed legacy reference ${reference}`);
      continue;
    }
    if (!record) {
      warn(`data/verses.json: no canonical record for ${reference}`);
      continue;
    }
    if (String(text || '').trim() !== record.text) {
      warn(`data/verses.json: deprecated value differs from canonical ${reference}`);
    }
  }
}

function runFixtures(resolver) {
  const parsed = resolver.parse('Бытие 1:26–28');
  if (!parsed.ok || parsed.bookId !== 'bytie' || parsed.key !== '1:26–28') {
    fail('parser fixture failed for Бытие 1:26–28');
  }
  const abbreviated = resolver.parse('2 Цар. 12:11-14');
  if (!abbreviated.ok || abbreviated.bookId !== '2tsarstv' || abbreviated.key !== '12:11–14') {
    fail('parser fixture failed for 2 Цар. 12:11-14');
  }
  const excerpt = resolver.resolve('2 Царств 12:11–14').record;
  if (!excerpt || excerpt.completeness !== 'excerpt' || !excerpt.note) {
    fail('resolver fixture failed to preserve excerpt semantics');
  }
  const escaped = JSON.stringify({ html: '</script><x>&' });
  if (!escaped.includes('</script>')) fail('JSON fixture precondition failed');
}

let resolver;
try {
  resolver = createBibleResolver(ROOT);
} catch (error) {
  fail(error.message);
}

if (resolver) {
  inspectCorpus(resolver);
  const sourceFiles = [
    path.join(ROOT, 'src'),
    path.join(ROOT, 'articles'),
    path.join(ROOT, 'biografii'),
    path.join(ROOT, 'hard-texts'),
    path.join(ROOT, 'baptisty-rossii'),
    path.join(ROOT, 'nagornaya')
  ].flatMap((directory) => walk(directory));
  const payloads = inspectInlinePayloads(sourceFiles);
  compareInlinePayloads(resolver, payloads);
  inspectLegacyVerses(resolver);
  runFixtures(resolver);

  console.log(`Bible reference registry: ${Object.keys(resolver.registry.books || {}).length} books`);
  console.log(`Bible reference corpus: ${resolver.corpus.size} canonical records`);
  console.log(`Inline payload blocks: ${payloads.length}`);
}

for (const message of warnings) console.warn(`WARN: ${message}`);
for (const message of errors) console.error(`ERROR: ${message}`);
console.log(`Bible reference contract: ${errors.length} error(s), ${warnings.length} warning(s)`);

if (errors.length && STRICT) process.exit(1);
