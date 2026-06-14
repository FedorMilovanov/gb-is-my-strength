#!/usr/bin/env node
/*
 * compare-url-contract.js — compare migration URL contracts.
 *
 * Supports both:
 * - data/public-content-baseline.json created by check-public-content-baseline.js
 * - reports/*.json created by extract-url-contract.js
 *
 * Default: compare data/public-content-baseline.json vs reports/url-contract-draft.json.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEFAULT_BASELINE = 'data/public-content-baseline.json';
const DEFAULT_CURRENT = 'reports/url-contract-draft.json';

function argValue(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] || fallback;
}
function hasArg(name) { return process.argv.includes(name); }
function usage() {
  console.log(`Usage: node scripts/compare-url-contract.js [--baseline FILE] [--current FILE] [--only-url URL] [--no-new] [--strict-title]\n\nDefaults:\n  --baseline ${DEFAULT_BASELINE}\n  --current  ${DEFAULT_CURRENT}\n\nRules:\n  - baseline public URLs must exist in current contract\n  - current canonical must remain self-referencing\n  - title/description/h1 must not become empty\n  - public page must not become noindex\n  - word count must not drop below 72% for substantial pages\n  - new current URLs are allowed by default unless --no-new is passed\n  - --only-url URL can compare one pilot page, e.g. /about/`);
}
if (hasArg('--help') || hasArg('-h')) { usage(); process.exit(0); }

const baselineFile = path.resolve(ROOT, argValue('--baseline', DEFAULT_BASELINE));
const currentFile = path.resolve(ROOT, argValue('--current', DEFAULT_CURRENT));
const noNew = hasArg('--no-new');
const strictTitle = hasArg('--strict-title');
const onlyUrls = process.argv.flatMap((arg, idx, arr) => arg === '--only-url' && arr[idx + 1] ? [arr[idx + 1]] : []);

function fail(msg) { console.error('❌ ' + msg); process.exit(1); }
if (!fs.existsSync(baselineFile)) fail(`baseline file not found: ${path.relative(ROOT, baselineFile)}`);
if (!fs.existsSync(currentFile)) fail(`current contract file not found: ${path.relative(ROOT, currentFile)} (run npm run contract:extract first)`);

function load(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function normalizePages(contract, role) {
  const pages = Array.isArray(contract.pages) ? contract.pages : [];
  return pages
    .filter((p) => p && p.url)
    .filter((p) => role === 'baseline' ? true : p.publicPage !== false)
    .map((p) => ({
      url: p.url,
      file: p.file || '',
      title: p.title || '',
      description: p.description || '',
      canonical: p.canonical || p.url || '',
      expectedUrl: p.expectedUrl || p.url || '',
      h1: p.h1 || '',
      h1Count: Number.isFinite(p.h1Count) ? p.h1Count : (p.h1 ? 1 : 0),
      robots: p.robots || '',
      noindex: Boolean(p.noindex) || /\bnoindex\b/i.test(p.robots || ''),
      wordCount: Number(p.wordCount ?? p.words ?? 0),
      jsonLdTypes: Array.isArray(p.jsonLdTypes) ? p.jsonLdTypes : [],
    }));
}

let baseline = normalizePages(load(baselineFile), 'baseline');
let current = normalizePages(load(currentFile), 'current');
const errors = [];
const warnings = [];
if (onlyUrls.length) {
  const allow = new Set(onlyUrls);
  baseline = baseline.filter(p => allow.has(p.url));
  current = current.filter(p => allow.has(p.url));
  for (const url of allow) {
    if (!baseline.some(p => p.url === url)) errors.push(`--only-url not found in baseline: ${url}`);
  }
}
const currentByUrl = new Map(current.map((p) => [p.url, p]));
const baselineByUrl = new Map(baseline.map((p) => [p.url, p]));
for (const old of baseline) {
  const now = currentByUrl.get(old.url);
  if (!now) {
    errors.push(`missing baseline URL: ${old.url} (${old.file})`);
    continue;
  }
  if (!now.title) errors.push(`empty title: ${old.url}`);
  if (!now.h1 || now.h1Count !== 1) errors.push(`bad h1: ${old.url} h1Count=${now.h1Count}`);
  if (now.noindex) errors.push(`public URL became noindex: ${old.url}`);
  if (now.canonical && now.expectedUrl && now.canonical !== now.expectedUrl) {
    errors.push(`canonical mismatch: ${old.url} canonical=${now.canonical} expected=${now.expectedUrl}`);
  }
  if (old.title && now.title && old.title !== now.title) {
    const msg = `title changed: ${old.url} — "${old.title}" → "${now.title}"`;
    strictTitle ? errors.push(msg) : warnings.push(msg);
  }
  const oldWords = Number(old.wordCount || 0);
  const newWords = Number(now.wordCount || 0);
  if (oldWords >= 80) {
    const floor = Math.max(25, Math.floor(oldWords * 0.72));
    if (newWords < floor) errors.push(`word-count drop: ${old.url} ${oldWords} → ${newWords} (floor ${floor})`);
  }
}

const newUrls = current.filter((p) => !baselineByUrl.has(p.url));
if (noNew && newUrls.length) errors.push(`unexpected new URLs:\n  - ${newUrls.map(p => p.url).join('\n  - ')}`);
else if (newUrls.length) warnings.push(`new URLs not in baseline: ${newUrls.length}`);

if (errors.length) {
  console.error(`❌ URL contract compare failed (${errors.length} error(s))`);
  errors.slice(0, 40).forEach(e => console.error('  - ' + e));
  if (errors.length > 40) console.error(`  …and ${errors.length - 40} more`);
  if (warnings.length) {
    console.error(`\nWarnings (${warnings.length}):`);
    warnings.slice(0, 12).forEach(w => console.error('  - ' + w));
  }
  process.exit(1);
}

console.log(`✅ URL contract compare OK: ${baseline.length} baseline pages, ${current.length} current public pages, ${newUrls.length} new URL(s)`);
if (warnings.length) {
  console.log(`ℹ️ Warnings (${warnings.length}):`);
  warnings.slice(0, 12).forEach(w => console.log('  - ' + w));
  if (warnings.length > 12) console.log(`  …and ${warnings.length - 12} more`);
}
