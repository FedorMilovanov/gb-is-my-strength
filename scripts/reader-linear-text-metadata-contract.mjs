#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const SOURCE = path.join(ROOT, 'src/components/article-pilots/krajne/KrajneBody.astro');
const DIST = path.join(ROOT, 'dist/articles/krajne-li-isporcheno-serdce/index.html');
const REPORT_DIR = path.join(ROOT, 'reports', 'reader-linear-text-projection');
const REQUIRED_KEYS = ['image', 'author', 'readTime', 'category', 'scripture'];

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, number) => String.fromCodePoint(parseInt(number, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(new RegExp(`\\b${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match?.slice(1).find((value) => value !== undefined) ?? '';
}

function sourceMetadata() {
  assert.ok(fs.existsSync(SOURCE), `canonical Krajne source missing: ${path.relative(ROOT, SOURCE)}`);
  const source = fs.readFileSync(SOURCE, 'utf8');
  const entries = new Map();
  const pattern = /<span\b([^>]*\bdata-pagefind-meta\s*=\s*(?:"[^"]+"|'[^']+'|[^\s>]+)[^>]*)>([\s\S]*?)<\/span>/gi;
  let match;
  while ((match = pattern.exec(source))) {
    const tag = `<span${match[1]}>`;
    const key = attr(tag, 'data-pagefind-meta');
    const value = decodeHtml(match[2].replace(/<[^>]*>/g, ''));
    if (key) entries.set(key, value);
  }
  return entries;
}

function projectedMetadata() {
  assert.ok(fs.existsSync(DIST), `built Krajne route missing: ${path.relative(ROOT, DIST)}`);
  const html = fs.readFileSync(DIST, 'utf8');
  const entries = new Map();
  const tags = html.match(/<meta\b[^>]*\bdata-reader-meta-projected\s*=\s*(?:"true"|'true'|true)[^>]*>/gi) || [];
  for (const tag of tags) {
    const spec = attr(tag, 'data-pagefind-meta');
    const value = decodeHtml(attr(tag, 'content'));
    assert.match(spec, /\[content\]$/, `projected metadata must capture the content attribute: ${tag}`);
    const key = spec.replace(/\[content\]$/, '');
    assert.ok(key, `projected metadata key missing: ${tag}`);
    assert.ok(value, `projected metadata value missing for ${key}`);
    assert.ok(!entries.has(key), `duplicate projected metadata key: ${key}`);
    entries.set(key, value);
  }
  return { html, entries };
}

function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const source = sourceMetadata();
  const { html, entries: projected } = projectedMetadata();

  assert.deepEqual([...source.keys()].filter((key) => REQUIRED_KEYS.includes(key)).sort(), [...REQUIRED_KEYS].sort(), 'canonical Krajne source metadata key set drifted');
  assert.equal(projected.size, REQUIRED_KEYS.length, `expected exactly ${REQUIRED_KEYS.length} projected Krajne metadata fields, got ${projected.size}`);

  for (const key of REQUIRED_KEYS) {
    assert.ok(source.has(key), `canonical source metadata missing ${key}`);
    assert.ok(projected.has(key), `projected metadata missing ${key}`);
    assert.equal(projected.get(key), source.get(key), `projected ${key} value differs from canonical source`);
  }

  const articleMatch = html.match(/<article\b[^>]*\bdata-pagefind-body\b[^>]*>([\s\S]*?)<\/article>/i);
  assert.ok(articleMatch, 'built Krajne article[data-pagefind-body] missing');
  assert.ok(!/\bdata-pagefind-meta\s*=/.test(articleMatch[1]), 'projected metadata still remains inside article[data-pagefind-body]');

  const result = {
    schemaVersion: 1,
    conclusion: 'success',
    source: path.relative(ROOT, SOURCE),
    dist: path.relative(ROOT, DIST),
    metadata: Object.fromEntries(REQUIRED_KEYS.map((key) => [key, projected.get(key)])),
  };
  fs.writeFileSync(path.join(REPORT_DIR, 'metadata-contract.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Reader metadata source→dist contract: PASS (${REQUIRED_KEYS.length} exact fields)`);
}

try {
  main();
} catch (error) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, 'metadata-contract.json'), `${JSON.stringify({ schemaVersion: 1, conclusion: 'failure', error: String(error?.stack || error) }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
}
