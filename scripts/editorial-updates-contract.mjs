#!/usr/bin/env node
/**
 * Ensure the public update ledger is truthful and synchronized with articles.
 * Runs as part of editorial lint; never infers substantive edits from Git.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const read = (p) => readFileSync(path.join(cwd, p), 'utf8');
const ledger = JSON.parse(read('data/editorial-updates.json'));
const manifest = JSON.parse(read('data/search-manifest.json'));
const articles = new Map(manifest.items.filter(x => x.type === 'article').map(x => [x.url, x]));
const ids = new Set();
const allowed = new Set(['new-evidence', 'correction', 'expanded', 'revised-conclusion']);
let published = 0;

for (const e of ledger.entries) {
  if (ids.has(e.id)) throw Error('Duplicate editorial update id: ' + e.id);
  ids.add(e.id);
  if (!['draft', 'published'].includes(e.status)) throw Error('Unknown update status ' + e.id);
  if (!allowed.has(e.kind)) throw Error('Unknown update kind ' + e.id);
  if (!e.headline?.trim() || !e.summary?.trim()) throw Error('Missing editorial summary ' + e.id);
  if (!Number.isFinite(Date.parse(e.date)) || !/[+Z-]\d{2}:?\d{2}$/.test(e.date)) throw Error('Update without explicit offset ' + e.id);
  if (!Array.isArray(e.sourceUrls) || !e.sourceUrls.length || e.sourceUrls.some(u => !/^https:\/\//.test(u))) {
    throw Error('Update sources missing or not HTTPS ' + e.id);
  }
  if (e.status !== 'published') continue;
  published++;
  const item = articles.get(e.articleUrl);
  if (!item) throw Error('Article missing from published manifest: ' + e.articleUrl);
  const slug = e.articleUrl.split('/').filter(Boolean).pop();
  const p = path.join('src', 'content', 'articles', slug + '.mdx');
  if (!existsSync(path.join(cwd,p))) throw Error('Content source missing: ' + p);
  const article = read(p);
  const anchor = 'id="' + e.anchor + '"';
  if (!article.includes(anchor)) throw Error('Update anchor missing from content: ' + e.id);
  if (!article.includes('updatedAt:')) throw Error('Article has no updatedAt: ' + e.id);
  const modified = Date.parse(item.modifiedTime || '');
  if (!Number.isFinite(modified) || modified < Date.parse(e.date)) {
    throw Error('Search manifest date behind editorial update: ' + e.id);
  }
}
console.log('EDITORIAL UPDATES CONTRACT: PASS — ' + published + ' published meaningful updates, ' + ledger.entries.length + ' ledger entries.');
