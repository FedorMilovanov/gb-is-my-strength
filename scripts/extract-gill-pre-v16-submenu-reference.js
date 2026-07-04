#!/usr/bin/env node
'use strict';
// Extracts the canonical pre-v16 GBS desktop submenu design from a historical
// commit and writes an immutable reference manifest. This manifest is the
// authoritative EXPECTED for scripts/gill-pre-v16-submenu-regression-audit.js.
//
// Usage: node scripts/extract-gill-pre-v16-submenu-reference.js [<commit>]
// Requires full git history (the historical commit must be fetchable).
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SHA = process.argv[2] || 'bcf6389f29ee0c89e9e96e7587e0226ecf251ae0';
const ROUTES = [
  'articles/dzhon-gill-istoricheskiy-kontekst',
  'articles/dzhon-gill-chast-1-chelovek',
  'articles/dzhon-gill-chast-2-uchenyi',
  'articles/dzhon-gill-chast-3-nasledie',
  'articles/dzhon-gill-spravochnik'
];

function show(rel) {
  try {
    return execSync(`git show ${SHA}:${rel}/index.html`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    console.error('skip (not found at ' + SHA + '): ' + rel);
    return '';
  }
}

function extract(html) {
  const ul = html.match(/<ul[^>]+class="gbs2-toc"[^>]*>[\s\S]*?<\/ul>/)?.[0] || '';
  const items = [...ul.matchAll(/<li([^>]*)>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<span[^>]+gbs2-dot[^>]*>[\s\S]*?<\/span>([\s\S]*?)<\/a>[\s\S]*?<\/li>/g)];
  return items.map((m, i) => ({
    order: i + 1,
    level: /gbs2-sub/.test(m[1]) ? 3 : 2,
    href: m[2],
    label: String(m[3] || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }));
}

const routes = {};
for (const r of ROUTES) {
  const html = show(r);
  if (!html) continue;
  routes[r + '/index.html'] = extract(html);
}

// fatal: any duplicate href inside the historical witness itself
const dup = {};
for (const [rel, items] of Object.entries(routes)) {
  const seen = new Set();
  for (const it of items) {
    if (seen.has(it.href)) (dup[rel] = dup[rel] || []).push(it.href);
    seen.add(it.href);
  }
}
if (Object.keys(dup).length) {
  console.error('FATAL: duplicate hrefs in historical witness: ' + JSON.stringify(dup));
  process.exit(1);
}

const out = {
  sourceCommit: SHA,
  generatedBy: 'scripts/extract-gill-pre-v16-submenu-reference.js',
  note: 'Immutable historical design witness for the pre-v16 GBS desktop submenu. Do not hand-edit; regenerate from the canonical commit.',
  routes
};
const dest = path.resolve(__dirname, '..', 'data', 'gill-pre-v16-submenu-reference.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log('wrote ' + dest + ' (' + Object.keys(routes).length + ' routes)');
