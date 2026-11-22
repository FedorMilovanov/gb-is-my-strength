#!/usr/bin/env node
/** Isolated Journal head contract. No package/global validate or publication mutation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { assertJournalDocumentMetadata } from '../src/components/journal/journalDocumentMetadata.ts';
import { G3_PRODUCT_METADATA } from '../src/data/journal/g3ProductMetadata.ts';

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

test('G3 public discovery dates and titles agree with route-owned correction metadata', () => {
  const g3 = G3_PRODUCT_METADATA;
  const stamp = new Date(g3.modifiedAt).toISOString();
  const manifest = JSON.parse(fs.readFileSync(new URL('../data/search-manifest.json', import.meta.url), 'utf8'));
  const records = manifest.items.filter((item) => item.id === 'g3' && item.url === '/journal/dossiers/g3/');
  assert.equal(records.length, 1, 'one public G3 search entry');
  assert.equal(records[0].title, g3.title);
  assert.equal(records[0].description, g3.description);
  assert.equal(records[0].publishedTime, g3.publishedAt);
  assert.equal(records[0].modifiedTime, g3.modifiedAt);
  assert.ok(Date.parse(manifest.generatedAt) >= Date.parse(g3.modifiedAt), 'index snapshot cannot predate the correction');

  const xml = fs.readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8');
  const locator = `<loc>${g3.canonical}</loc>`;
  assert.equal(xml.split(locator).length - 1, 1, 'one sitemap canonical');
  const tail = xml.slice(xml.indexOf(locator) + locator.length);
  const lastmod = tail.match(/^\s*<lastmod>([^<]+)<\/lastmod>/);
  assert.ok(lastmod, 'G3 sitemap lastmod exists');
  assert.equal(new Date(lastmod[1]).toISOString(), stamp);
  assert.ok(tail.includes(`<image:title>${g3.title}</image:title>`), 'sitemap caption matches route headline');

  const feed = fs.readFileSync(new URL('../feed.xml', import.meta.url), 'utf8');
  const lastBuild = feed.match(/<lastBuildDate>([^<]+)<\/lastBuildDate>/);
  assert.ok(lastBuild, 'RSS lastBuildDate exists');
  assert.ok(Date.parse(lastBuild[1]) >= Date.parse(g3.modifiedAt), 'RSS snapshot cannot predate changed G3 data');
});
