#!/usr/bin/env node
/*
 * check-public-content-baseline.js — migration safety guard.
 *
 * Purpose: before/after a platform migration, make sure public content URLs and
 * substantial text are not accidentally lost. The baseline is intentionally
 * conservative: it stores canonical URL, title, H1 and visible word count for
 * public indexable HTML pages. New pages are allowed; missing baseline URLs or
 * severe word-count drops are blockers.
 *
 * Usage:
 *   node scripts/check-public-content-baseline.js --write   # update baseline intentionally
 *   node scripts/check-public-content-baseline.js           # verify current tree against it
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://gospod-bog.ru';
const BASELINE_REL = 'data/public-content-baseline.json';
const BASELINE = path.join(ROOT, BASELINE_REL);
const WRITE = process.argv.includes('--write');
const skipDirs = new Set(['.git', 'node_modules', 'pagefind', 'audit', '_app', '_build-tools', 'reports', 'dist', 'out', 'build', '.astro']);
const verificationFileRe = /^(google|yandex|microsoft)[^/]*\.html$/i;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
function rel(abs) { return path.relative(ROOT, abs).replace(/\\/g, '/'); }
function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function wordCount(html) {
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
  const text = stripTags(body);
  return (text.match(/[A-Za-zА-Яа-яЁё0-9]{2,}/g) || []).length;
}
function ownUrl(file) {
  let u = '/' + file.replace(/\/index\.html$/, '/');
  if (u === '/index.html') u = '/';
  return SITE + u;
}
function getMeta(html, name) {
  const re = new RegExp(`<meta\\b([^>]*\\b(?:name|property)=["']${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*)>`, 'i');
  const m = html.match(re);
  if (!m) return '';
  return m[1].match(/\bcontent=["']([^"']*)["']/i)?.[1]?.trim() || '';
}
function getCanonical(html, file) {
  const links = [...html.matchAll(/<link\b([^>]+)>/gi)];
  for (const link of links) {
    const attrs = link[1];
    if (!/\brel=["']canonical["']/i.test(attrs)) continue;
    return attrs.match(/\bhref=["']([^"']+)["']/i)?.[1]?.trim() || '';
  }
  return ownUrl(file);
}
function getTitle(html) {
  return stripTags(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
}
function getH1(html) {
  return stripTags(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '').trim();
}
function isIndexable(html) {
  const robots = getMeta(html, 'robots');
  return !/\bnoindex\b/i.test(robots);
}
function collect() {
  return walk(ROOT)
    .filter((p) => p.endsWith('.html'))
    .map((p) => ({ abs: p, file: rel(p) }))
    .filter(({ file }) => !verificationFileRe.test(path.basename(file)))
    .map(({ abs, file }) => ({ file, html: fs.readFileSync(abs, 'utf8') }))
    .filter(({ html }) => isIndexable(html))
    .map(({ file, html }) => ({
      file,
      url: getCanonical(html, file) || ownUrl(file),
      title: getTitle(html),
      h1: getH1(html),
      words: wordCount(html),
    }))
    .sort((a, b) => a.url.localeCompare(b.url));
}

function main() {
  const current = collect();
  if (WRITE || !fs.existsSync(BASELINE)) {
    const payload = {
      version: 1,
      updated: new Date().toISOString(),
      note: 'Migration baseline: public indexable HTML pages. Update intentionally before a platform migration only after review.',
      pages: current,
    };
    fs.writeFileSync(BASELINE, JSON.stringify(payload, null, 2) + '\n');
    console.log(`✅ Wrote ${BASELINE_REL}: ${current.length} public pages`);
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const pages = Array.isArray(baseline.pages) ? baseline.pages : [];
  const byUrl = new Map(current.map((p) => [p.url, p]));
  const problems = [];
  const warnings = [];

  for (const old of pages) {
    const now = byUrl.get(old.url);
    if (!now) {
      problems.push(`missing URL: ${old.url} (${old.file})`);
      continue;
    }
    if (old.h1 && now.h1 && old.h1 !== now.h1) warnings.push(`H1 changed: ${old.url} — "${old.h1}" → "${now.h1}"`);
    const floor = Math.max(25, Math.floor((old.words || 0) * 0.72));
    if ((old.words || 0) >= 80 && now.words < floor) {
      problems.push(`word-count drop: ${old.url} ${old.words} → ${now.words} (floor ${floor})`);
    }
  }

  const extra = current.length - pages.length;
  if (problems.length) {
    console.error('❌ Public content baseline failed:');
    for (const p of problems.slice(0, 30)) console.error('  - ' + p);
    if (problems.length > 30) console.error(`  …and ${problems.length - 30} more`);
    process.exit(1);
  }
  console.log(`✅ Public content baseline OK: ${pages.length} baseline pages, ${extra >= 0 ? '+' + extra : extra} current delta`);
  if (warnings.length) {
    console.log('ℹ️ Non-blocking content metadata changes:');
    for (const w of warnings.slice(0, 12)) console.log('  - ' + w);
    if (warnings.length > 12) console.log(`  …and ${warnings.length - 12} more`);
  }
}

main();
