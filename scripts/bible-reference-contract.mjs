#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BIBLE_PUBLICATION_STATES,
  BIBLE_RIGHTS_STATES,
  DEFAULT_REPOSITORY_ROOT,
  createBibleResolver,
  isBibleRecordPublicationEligible,
  mergeBiblePublicationMeta,
  normalizeBibleRecord
} from '../src/lib/bible-reference-core.mjs';

const ROOT = DEFAULT_REPOSITORY_ROOT;
const STRICT = process.argv.includes('--strict');
const CONTRACT_FILE = fileURLToPath(import.meta.url);
const LEGACY_VERSES_RELATIVE = ['data', 'verses.json'].join('/');
const LEGACY_VERSES_FILE = path.join(ROOT, ...LEGACY_VERSES_RELATIVE.split('/'));
const errors = [];
const warnings = [];

function fail(message) { errors.push(message); }
function warn(message) { warnings.push(message); }
function rel(file) { return path.relative(ROOT, file).split(path.sep).join('/'); }
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

function inspectRegistry(resolver) {
  const books = Object.entries(resolver.registry.books || {});
  if (books.length !== 66) fail(`canonical Protestant book registry must contain 66 books, found ${books.length}`);
  for (const [bookId, book] of books) {
    if (!book.testament) fail(`registry book ${bookId} lacks testament`);
    if (!Array.isArray(book.aliases) || !book.aliases.length) fail(`registry book ${bookId} lacks aliases`);
    if (!book.file) {
      fail(`registry book ${bookId} lacks corpus file path`);
      continue;
    }
    const corpusFile = path.join(ROOT, 'data/bible', book.file);
    if (!fs.existsSync(corpusFile)) warn(`registry book ${bookId}: corpus file is not populated yet (${rel(corpusFile)})`);
  }
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
          payloads.push({ file: rel(file), value: JSON.parse(raw) });
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
      if (!/^\d+(?::\d+[а-яa-z]?(?:–\d+[а-яa-z]?)?)?$/iu.test(entry.key)) fail(`${entry.file}: invalid verse key ${entry.key}`);
      if (!entry.text) fail(`${entry.file} ${entry.key}: empty text`);
      if (/\.\.\.|…/.test(entry.text) && entry.completeness !== 'excerpt') fail(`${entry.file} ${entry.key}: ellipsis requires completeness=excerpt`);
      if (entry.completeness === 'excerpt' && !entry.note) fail(`${entry.file} ${entry.key}: excerpt requires explanatory note`);
      if (entry.translation && meta.translation && entry.translation !== meta.translation) fail(`${entry.file} ${entry.key}: record translation differs from book metadata`);
      if (!book.testament) fail(`${entry.file}: registry book ${bookId} lacks testament`);
      if (isBibleRecordPublicationEligible(entry)) {
        if (!entry.source || !entry.sourceUrl || !entry.rights || !entry.translation) {
          fail(`${entry.file} ${entry.key}: publication-eligible record lacks exact provenance`);
        }
        if (entry.holds.length) fail(`${entry.file} ${entry.key}: publication-eligible record must not carry holds`);
      }
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
      if (inline.text && inline.text !== record.text) fail(`${payload.file}: inline text conflicts with canonical ${reference}`);
      if (inline.translation && record.translation && inline.translation !== record.translation) fail(`${payload.file}: inline translation conflicts with canonical ${reference}`);
      if (/\.\.\.|…/.test(inline.text) && inline.completeness !== 'excerpt') fail(`${payload.file}: inline ellipsis for ${reference} requires completeness=excerpt`);
    }
  }
}

function inspectLegacyAuthority(files) {
  if (fs.existsSync(LEGACY_VERSES_FILE)) {
    fail(`${LEGACY_VERSES_RELATIVE}: legacy verse authority must remain absent; only governed data/bible records may own canonical text`);
  }

  const forbiddenTokens = [LEGACY_VERSES_RELATIVE, `/${LEGACY_VERSES_RELATIVE}`];
  const sourceExtensions = new Set(['.astro', '.html', '.js', '.mjs', '.ts', '.tsx']);
  const markupExtensions = new Set(['.astro', '.html']);
  for (const file of files) {
    const extension = path.extname(file).toLowerCase();
    if (!sourceExtensions.has(extension) || path.resolve(file) === path.resolve(CONTRACT_FILE)) continue;
    const relative = rel(file);
    const source = fs.readFileSync(file, 'utf8');
    if (forbiddenTokens.some((token) => source.includes(token))) {
      fail(`${relative}: forbidden consumer of removed legacy verse authority ${LEGACY_VERSES_RELATIVE}`);
    }
    if (relative.startsWith('src/') && markupExtensions.has(extension) && /<script\b[^>]*\bid=["']bibleRefs["'][^>]*>/iu.test(source)) {
      fail(`${relative}: forbidden retained public #bibleRefs Scripture payload; route text must flow only through the rights-gated canonical projection`);
    }
    if (markupExtensions.has(extension) && /(?:class\s*=\s*["'][^"']*\bgbx-verse\b|\bdata-verse\s*=)/iu.test(source)) {
      fail(`${relative}: forbidden public legacy verse trigger; use canonical .bref/.btip projection`);
    }
  }
}

function runPublicationEligibilityFixtures(resolver) {
  const unknown = normalizeBibleRecord({
    text: 'fixture',
    translation: 'Fixture',
    source: 'Fixture source',
    sourceUrl: 'https://example.test/source',
    rights: 'Fixture rights',
  }, {}, '1:1');
  if (unknown.publicationState !== BIBLE_PUBLICATION_STATES.BLOCKED) fail('publication fixture: absent state must default to BLOCKED');
  if (unknown.rightsState !== BIBLE_RIGHTS_STATES.UNKNOWN) fail('publication fixture: absent rights state must default to RIGHTS_UNKNOWN');
  if (isBibleRecordPublicationEligible(unknown)) fail('publication fixture: provenance text alone must never imply eligibility');

  const blockedWithRights = normalizeBibleRecord({
    text: 'fixture',
    translation: 'Fixture',
    source: 'Fixture source',
    sourceUrl: 'https://example.test/source',
    rights: 'Public Domain',
    rightsState: BIBLE_RIGHTS_STATES.ELIGIBLE,
    publicationState: BIBLE_PUBLICATION_STATES.BLOCKED,
  }, {}, '1:2');
  if (isBibleRecordPublicationEligible(blockedWithRights)) fail('publication fixture: rights eligibility without Product approval must remain blocked');

  const approved = normalizeBibleRecord({
    text: 'fixture',
    translation: 'Fixture',
    source: 'Exact acquired fixture source',
    sourceUrl: 'https://example.test/source',
    rights: 'Public Domain',
    rightsState: BIBLE_RIGHTS_STATES.ELIGIBLE,
    publicationState: BIBLE_PUBLICATION_STATES.APPROVED,
    holds: [],
  }, {}, '1:3');
  if (!isBibleRecordPublicationEligible(approved)) fail('publication fixture: explicit approved exact provenance must be eligible');

  const held = normalizeBibleRecord({
    ...approved,
    publicationState: BIBLE_PUBLICATION_STATES.APPROVED,
    rightsState: BIBLE_RIGHTS_STATES.ELIGIBLE,
    holds: ['PUBLICATION_HOLD'],
  }, {}, '1:4');
  if (isBibleRecordPublicationEligible(held)) fail('publication fixture: any hold must fail closed');

  const inheritedHold = normalizeBibleRecord({
    ...approved,
    holds: [],
  }, {
    holds: ['RIGHTS_HOLD'],
  }, '1:5');
  if (!inheritedHold.holds.includes('RIGHTS_HOLD')) fail('publication fixture: record-level empty holds must not clear inherited RIGHTS_HOLD');
  if (isBibleRecordPublicationEligible(inheritedHold)) fail('publication fixture: inherited translation/book hold must remain blocking');

  const mergedMeta = mergeBiblePublicationMeta({
    rightsState: BIBLE_RIGHTS_STATES.ELIGIBLE,
    publicationState: BIBLE_PUBLICATION_STATES.APPROVED,
    holds: ['RIGHTS_HOLD'],
  }, {
    holds: [],
  });
  if (!mergedMeta.holds.includes('RIGHTS_HOLD')) fail('publication fixture: file _meta holds=[] must not clear translation-policy RIGHTS_HOLD');

  const cassian = resolver.resolve('2 Тимофею 2:14–15').record;
  if (!cassian?.text) fail('publication fixture: current Cassian negative witness must resolve internally');
  else {
    if (cassian.publicationState !== BIBLE_PUBLICATION_STATES.BLOCKED) fail('publication fixture: current Cassian witness must remain BLOCKED without Product approval');
    if (isBibleRecordPublicationEligible(cassian)) fail('publication fixture: current Cassian witness must remain reference-only');
  }
}

function runFixtures(resolver) {
  const parsed = resolver.parse('Бытие 1:26–28');
  if (!parsed.ok || parsed.bookId !== 'bytie' || parsed.key !== '1:26–28') fail('parser fixture failed for Бытие 1:26–28');

  const abbreviated = resolver.parse('2 Цар. 12:11-14');
  if (!abbreviated.ok || abbreviated.bookId !== '2tsarstv' || abbreviated.key !== '12:11–14') fail('parser fixture failed for 2 Цар. 12:11-14');

  const excerpt = resolver.resolve('2 Царств 12:11–14').record;
  if (!excerpt || excerpt.completeness !== 'excerpt' || !excerpt.note) fail('resolver fixture failed to preserve excerpt semantics');

  for (const [reference, expectedBook] of [['Руфь 1:1', 'ruf'], ['Есф. 1:1', 'esfir'], ['Плач 1:1', 'plach-ieremii']]) {
    const fixture = resolver.parse(reference);
    if (!fixture.ok || fixture.bookId !== expectedBook) fail(`registry/parser fixture failed for ${reference}`);
  }

  runPublicationEligibilityFixtures(resolver);
}

let resolver;
try {
  resolver = createBibleResolver(ROOT);
} catch (error) {
  fail(error.message);
}

if (resolver) {
  inspectRegistry(resolver);
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
  inspectLegacyAuthority(walk(ROOT));
  runFixtures(resolver);

  console.log(`Bible reference registry: ${Object.keys(resolver.registry.books || {}).length} books`);
  console.log(`Bible reference corpus: ${resolver.corpus.size} canonical records`);
  console.log(`Inline payload blocks: ${payloads.length}`);
}

for (const message of warnings) console.warn(`WARN: ${message}`);
for (const message of errors) console.error(`ERROR: ${message}`);
console.log(`Bible reference contract: ${errors.length} error(s), ${warnings.length} warning(s)`);
if (errors.length && STRICT) process.exit(1);
