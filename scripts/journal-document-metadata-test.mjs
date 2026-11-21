#!/usr/bin/env node
/** Isolated Journal head contract. No package/global validate or publication mutation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { assertJournalDocumentMetadata } from '../src/components/journal/journalDocumentMetadata.ts';

const valid = {
  kind: 'Article', publishedAt: '2026-09-09T00:00:00+03:00',
  modifiedAt: '2026-11-18T00:00:00+03:00',
  socialImage: 'https://gospod-bog.ru/images/journal/g3-ministries-og-1200x630.webp',
  socialImageAlt: 'Иллюстративная обложка G3 Ministries.',
};
for (const kind of ['Article', 'CollectionPage']) {
  test(`${kind}: explicit route metadata accepted without mutation`, () => {
    const input = Object.freeze({ ...valid, kind });
    assert.equal(assertJournalDocumentMetadata(input), undefined);
    assert.deepEqual(input, { ...valid, kind });
  });
}
for (const [name, patch, reason] of [
  ['missing kind', { kind: undefined }, /kind/],
  ['unknown kind', { kind: 'WebPage' }, /kind/],
  ['missing publishedAt', { publishedAt: undefined }, /publishedAt/],
  ['missing modifiedAt', { modifiedAt: undefined }, /modifiedAt/],
  ['date without timezone', { publishedAt: '2026-09-09T00:00:00' }, /publishedAt/],
  ['invalid date', { publishedAt: 'not-a-date' }, /publishedAt/],
  ['impossible calendar date', { publishedAt: '2026-02-30T00:00:00+03:00' }, /publishedAt/],
  ['non-leap February29', { publishedAt: '2025-02-29T00:00:00Z' }, /publishedAt/],
  ['invalid modifiedAt', { modifiedAt: '2026-13-01T00:00:00Z' }, /modifiedAt/],
  ['backdated modifiedAt', { modifiedAt: '2026-09-08T23:59:59+03:00' }, /must not precede/],
  ['missing image', { socialImage: undefined }, /socialImage/],
  ['missing alt', { socialImageAlt: undefined }, /socialImageAlt/],
  ['empty alt', { socialImageAlt: '  ' }, /socialImageAlt/],
]) {
  test(`fail closed: ${name}`, () => assert.throws(() => assertJournalDocumentMetadata({ ...valid, ...patch }), reason));
}
test('timezone-equivalent dates are chronological equals', () => {
  assert.doesNotThrow(() => assertJournalDocumentMetadata({ ...valid, modifiedAt: '2026-09-08T21:00:00Z' }));
});
test('head uses the runtime assertion and retains exactly one critical hint owner', () => {
  const source = fs.readFileSync(new URL('../src/components/journal/JournalDocumentHead.astro', import.meta.url), 'utf8');
  assert.match(source, /assertJournalDocumentMetadata\(\{ kind, publishedAt, modifiedAt, socialImage, socialImageAlt \}\)/);
  assert.doesNotMatch(source, /kind\s*=\s*'Article'|publishedAt\s*=\s*'\d|modifiedAt\s*=\s*publishedAt/);
  for (const field of ['published_time', 'modified_time']) {
    assert.match(source, new RegExp(`\\{kind === 'Article' && <meta property="article:${field}"`));
  }
  assert.equal((source.match(/<JournalFontPreloads\s*\/>/g) || []).length, 1);
  assert.equal((source.match(/property="og:image:alt"/g) || []).length, 1);
  assert.equal((source.match(/name="twitter:image:alt"/g) || []).length, 1);
});
