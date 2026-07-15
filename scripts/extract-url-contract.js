#!/usr/bin/env node
/*
 * extract-url-contract.js — migration URL/SEO contract extractor.
 *
 * Safe Level-0 tool for future Astro/strangler migration. It can inspect the
 * current legacy root or a future build output directory (dist/) and write JSON
 * + Markdown reports. It does not mutate production files.
 *
 * Usage:
 *   node scripts/extract-url-contract.js
 *   node scripts/extract-url-contract.js --root dist --out-json reports/dist-url-contract.json --out-md reports/dist-url-contract.md
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const SITE = 'https://gospod-bog.ru';
const DEFAULT_OUT_JSON = 'reports/url-contract-draft.json';
const DEFAULT_OUT_MD = 'reports/url-contract-draft.md';
const DEFAULT_SKIP = new Set(['.git', 'node_modules', 'pagefind', 'audit', '_app', '_build-tools', 'reports', 'dist', 'out', 'build', '.astro', '_legacy', 'scripts']);
const verificationFileRe = /^(google|yandex|microsoft)[^/]*\.html$/i;

function argValue(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] || fallback;
}
function hasArg(name) { return process.argv.includes(name); }
function usage() {
  console.log(`Usage: node scripts/extract-url-contract.js [--root DIR] [--out-json FILE] [--out-md FILE] [--include-noindex]\n\nOptions:\n  --root DIR        Directory to inspect (default: repo root). Future use: --root dist\n  --out-json FILE   JSON output path (default: ${DEFAULT_OUT_JSON})\n  --out-md FILE     Markdown output path (default: ${DEFAULT_OUT_MD})\n  --include-noindex Include noindex pages in content pages section\n  --help            Show this help`);
}
if (hasArg('--help') || hasArg('-h')) { usage(); process.exit(0); }

const rootArg = argValue('--root', '.');
const scanRoot = path.resolve(REPO_ROOT, rootArg);
const outJson = path.resolve(REPO_ROOT, argValue('--out-json', DEFAULT_OUT_JSON));
const outMd = path.resolve(REPO_ROOT, argValue('--out-md', DEFAULT_OUT_MD));
const includeNoindex = hasArg('--include-noindex');

function fail(msg) { console.error('❌ ' + msg); process.exit(1); }
if (!fs.existsSync(scanRoot) || !fs.statSync(scanRoot).isDirectory()) fail(`--root directory does not exist: ${path.relative(REPO_ROOT, scanRoot) || scanRoot}`);

function rel(abs, base = scanRoot) { return path.relative(base, abs).replace(/\\/g, '/'); }
function repoRel(abs) { return path.relative(REPO_ROOT, abs).replace(/\\/g, '/'); }
function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (DEFAULT_SKIP.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
function stripTags(html) {
  return String(html || '')
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
function getTitle(html) { return stripTags(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''); }
function getH1s(html) { return [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => stripTags(m[1])); }
function getMeta(html, key) {
  const metaTags = [...html.matchAll(/<meta\b([^>]+)>/gi)];
  for (const tag of metaTags) {
    const attrs = tag[1];
    const name = attrs.match(/\b(?:name|property)=["']([^"']+)["']/i)?.[1];
    if (name !== key) continue;
    return attrs.match(/\bcontent=["']([^"']*)["']/i)?.[1]?.trim() || '';
  }
  return '';
}
function getCanonical(html, file) {
  const links = [...html.matchAll(/<link\b([^>]+)>/gi)];
  for (const link of links) {
    const attrs = link[1];
    if (!/\brel=["']canonical["']/i.test(attrs)) continue;
    return attrs.match(/\bhref=["']([^"']+)["']/i)?.[1]?.trim() || '';
  }
  return '';
}
function urlFromFile(file) {
  let urlPath = '/' + file.replace(/\/index\.html$/, '/');
  if (urlPath === '/index.html') urlPath = '/';
  return SITE + urlPath;
}
function jsonLdTypes(html) {
  const types = new Set();
  for (const block of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(block[1].trim());
      const visit = (node) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(visit); return; }
        const t = node['@type'];
        if (Array.isArray(t)) t.forEach(x => types.add(String(x)));
        else if (t) types.add(String(t));
        if (Array.isArray(node['@graph'])) node['@graph'].forEach(visit);
      };
      visit(parsed);
    } catch (_) {
      types.add('INVALID_JSON_LD');
    }
  }
  return [...types].sort();
}
function localRefs(html) {
  const refs = new Set();
  for (const [, val] of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
    if (!val || val.startsWith('#') || /^https?:\/\//i.test(val) || /^mailto:|^tel:|^data:/i.test(val) || /\$\{/.test(val)) continue;
    refs.add(val.split('#')[0].split('?')[0]);
  }
  for (const [, val] of html.matchAll(/\bsrcset=["']([^"']+)["']/gi)) {
    for (const part of val.split(',')) {
      const u = part.trim().split(/\s+/)[0];
      if (u && !/^https?:\/\//i.test(u) && !/^data:/i.test(u) && !/\$\{/.test(u)) refs.add(u.split('?')[0]);
    }
  }
  return [...refs].sort();
}
function isSystem(file) {
  return file === '404.html' || verificationFileRe.test(path.basename(file));
}
function extract() {
  const htmlFiles = walk(scanRoot).filter(f => f.endsWith('.html')).sort();
  const pages = [];
  for (const abs of htmlFiles) {
    const file = rel(abs);
    const html = fs.readFileSync(abs, 'utf8');
    const canonical = getCanonical(html, file);
    const robots = getMeta(html, 'robots');
    const h1s = getH1s(html);
    const system = isSystem(file);
    const noindex = /\bnoindex\b/i.test(robots);
    const publicPage = !system && (includeNoindex || !noindex);
    pages.push({
      file,
      url: canonical || urlFromFile(file),
      expectedUrl: urlFromFile(file),
      title: getTitle(html),
      description: getMeta(html, 'description'),
      canonical,
      robots,
      h1: h1s[0] || '',
      h1Count: h1s.length,
      ogTitle: getMeta(html, 'og:title'),
      ogUrl: getMeta(html, 'og:url'),
      ogImage: getMeta(html, 'og:image'),
      jsonLdTypes: jsonLdTypes(html),
      wordCount: wordCount(html),
      localRefs: localRefs(html),
      system,
      noindex,
      publicPage,
    });
  }
  const publicPages = pages.filter(p => p.publicPage);
  const issues = [];
  for (const p of publicPages) {
    if (!p.title) issues.push(`${p.file}: missing title`);
    if (!p.description) issues.push(`${p.file}: missing description`);
    if (!p.canonical) issues.push(`${p.file}: missing canonical`);
    if (p.canonical && p.canonical !== p.expectedUrl) issues.push(`${p.file}: canonical ${p.canonical} != expected ${p.expectedUrl}`);
    if (p.h1Count !== 1) issues.push(`${p.file}: h1Count=${p.h1Count}`);
    if (p.noindex) issues.push(`${p.file}: public page has noindex`);
  }
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    root: repoRel(scanRoot) || '.',
    site: SITE,
    summary: {
      htmlFiles: pages.length,
      publicPages: publicPages.length,
      systemPages: pages.filter(p => p.system).length,
      noindexPages: pages.filter(p => p.noindex).length,
      issues: issues.length,
    },
    issues,
    pages,
  };
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
function mdEscape(s) { return String(s || '').replace(/\|/g, '\\|').replace(/\n/g, ' '); }
function writeMd(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const publicPages = data.pages.filter(p => p.publicPage);
  const lines = [];
  lines.push('# URL contract draft');
  lines.push('');
  lines.push(`Generated: ${data.generatedAt}`);
  lines.push(`Root: \`${data.root}\``);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- HTML files: ${data.summary.htmlFiles}`);
  lines.push(`- Public pages: ${data.summary.publicPages}`);
  lines.push(`- System pages: ${data.summary.systemPages}`);
  lines.push(`- Noindex pages: ${data.summary.noindexPages}`);
  lines.push(`- Issues: ${data.summary.issues}`);
  lines.push('');
  if (data.issues.length) {
    lines.push('## Issues');
    lines.push('');
    data.issues.forEach(i => lines.push(`- ${i}`));
    lines.push('');
  }
  lines.push('## Public pages');
  lines.push('');
  lines.push('| URL | File | Title | H1 | Words | JSON-LD |');
  lines.push('|---|---|---|---|---:|---|');
  for (const p of publicPages) {
    lines.push(`| ${mdEscape(p.url)} | \`${p.file}\` | ${mdEscape(p.title)} | ${mdEscape(p.h1)} | ${p.wordCount} | ${mdEscape(p.jsonLdTypes.join(', '))} |`);
  }
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

const data = extract();
writeJson(outJson, data);
writeMd(outMd, data);
console.log(`✅ URL contract extracted from ${data.root}: ${data.summary.publicPages} public pages, ${data.summary.issues} issue(s)`);
console.log(`   JSON: ${repoRel(outJson)}`);
console.log(`   MD:   ${repoRel(outMd)}`);
if (data.summary.issues) process.exitCode = 1;
