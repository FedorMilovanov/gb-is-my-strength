#!/usr/bin/env node
/**
 * SEO/AEO/GEO audit for gospod-bog.ru.
 *
 * Source/repository mode (backward compatible):
 *   node scripts/seo-audit.js
 *
 * Production-dist mode (canonical route registry):
 *   node scripts/seo-audit.js --root dist --registry
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  canonicalUrlForRoute,
  collectProductionHtmlTargets,
} = require('./lib/seo-route-targets');

const SOURCE_ROOT = path.resolve(__dirname, '..');
const BASE = 'https://gospod-bog.ru';
const ORG_ID = `${BASE}/#organization`;
const WEBSITE_ID = `${BASE}/#website`;
const args = process.argv.slice(2);

function argValue(name, fallback = '') {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const REGISTRY_MODE = args.includes('--registry');
const AUDIT_ROOT = path.resolve(SOURCE_ROOT, argValue('--root', '.'));

let errors = 0;
let warnings = 0;

function read(file) { return fs.readFileSync(path.join(AUDIT_ROOT, file), 'utf8'); }
function rel(p) { return path.relative(AUDIT_ROOT, p).replace(/\\/g, '/'); }
function err(file, msg) { console.log(`❌ ${file}: ${msg}`); errors++; }
function warn(file, msg) { console.log(`⚠️  ${file}: ${msg}`); warnings++; }
function ok(msg) { console.log(`✅ ${msg}`); }

function walk(dir, out = []) {
  const skipped = new Set(['.git', 'node_modules', '.next', '.npm', '_app', 'out', 'build', 'coverage', 'reports', '.astro']);
  if (!REGISTRY_MODE) skipped.add('dist');
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipped.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function getMeta(html, attr, name) {
  const re1 = new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${name}["'][^>]*>`, 'i');
  return html.match(re1)?.[1] || html.match(re2)?.[1] || '';
}
function getLink(html, relName) {
  return html.match(new RegExp(`<link[^>]+rel=["']${relName}["'][^>]+href=["']([^"']+)["']`, 'i'))?.[1]
      || html.match(new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]+rel=["']${relName}["']`, 'i'))?.[1]
      || '';
}
function stripTags(s) {
  return s.replace(/<span class="gtip">[\s\S]*?<\/span>/g, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
}
function extractFaq(html) {
  const pat = /<div class="faq-accordion__item[^>]*">\s*<button[^>]*class="faq-accordion__q"[^>]*>([\s\S]*?)<\/button>\s*<div class="faq-accordion__body"[^>]*>\s*<div class="faq-accordion__body-inner"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
  const out = [];
  let m;
  while ((m = pat.exec(html))) {
    const q = stripTags(m[1]).replace(/^Q\d+\s+/, '');
    const a = stripTags(m[2]);
    if (q && a) out.push({ q, a, words: a.split(/\s+/).filter(Boolean).length });
  }
  return out;
}

if (!fs.existsSync(AUDIT_ROOT)) {
  console.error(`SEO audit root does not exist: ${AUDIT_ROOT}`);
  process.exit(1);
}

let htmlEntries;
if (REGISTRY_MODE) {
  const targets = collectProductionHtmlTargets(AUDIT_ROOT);
  htmlEntries = targets.filter((target) => {
    if (!target.exists) err(target.route, `production HTML missing: ${target.htmlRelative}`);
    return target.exists;
  }).map((target) => ({
    absolute: target.absolute,
    file: target.htmlRelative,
    route: target.route,
    indexable: target.indexable,
  }));
  ok(`registry selected ${targets.length} production routes (${htmlEntries.length} HTML files present)`);
} else {
  htmlEntries = walk(AUDIT_ROOT)
    .filter((p) => p.endsWith('.html') && !/google|yandex/.test(rel(p)))
    .map((absolute) => ({ absolute, file: rel(absolute), route: null, indexable: null }));
}

const allTextFiles = REGISTRY_MODE
  ? [
      ...htmlEntries.map((entry) => entry.absolute),
      ...['robots.txt', 'sitemap.xml']
        .map((file) => path.join(AUDIT_ROOT, file))
        .filter((file) => fs.existsSync(file)),
    ]
  : walk(AUDIT_ROOT).filter((p) => /\.(html|js|css|json|xml|md|txt)$/.test(p));

// SEO-01: no repository base path leakage.
for (const p of [...new Set(allTextFiles)]) {
  const file = rel(p);
  const text = fs.readFileSync(p, 'utf8');
  if (!REGISTRY_MODE && (p.endsWith('.md') || p.endsWith('.txt'))) continue; // DOCS-01
  if (text.includes('/gb-' + 'is-my-strength/')) err(file, 'contains repository base path');
}

for (const entry of htmlEntries) {
  const file = REGISTRY_MODE ? `${entry.route} (${entry.file})` : entry.file;
  const html = fs.readFileSync(entry.absolute, 'utf8');
  if (!html.includes('<head')) {
    if (REGISTRY_MODE) err(file, 'production route HTML lacks <head>');
    continue;
  }
  const canonical = getLink(html, 'canonical');
  if (REGISTRY_MODE) {
    const expectedCanonical = canonicalUrlForRoute(entry.route, BASE);
    if (!canonical) err(file, 'canonical link missing');
    else if (canonical !== expectedCanonical) err(file, `canonical mismatch: ${canonical} != ${expectedCanonical}`);
    const robotsMeta = getMeta(html, 'name', 'robots').toLowerCase();
    const hasNoindex = /(^|[\s,])noindex([\s,]|$)/.test(robotsMeta);
    if (entry.indexable && hasNoindex) err(file, 'indexable route renders noindex');
    if (!entry.indexable && !hasNoindex) err(file, 'profile seo.indexable=false but rendered robots lacks noindex');
  } else {
    if (canonical && !canonical.startsWith(`${BASE}/`)) err(file, `canonical is not production origin: ${canonical}`);
  }
  if ((html.match(/rel="canonical"/g) || []).length > 1) err(file, 'more than one canonical link');

  // Asset base path consistency: icons/manifest are production absolute, not GitHub subpath.
  for (const href of [...html.matchAll(/<link[^>]+href="([^"]+)"[^>]*>/g)].map((m) => m[1])) {
    if (href.includes('/gb-' + 'is-my-strength/')) err(file, `asset href uses repository path: ${href}`);
  }

  const ogType = getMeta(html, 'property', 'og:type');
  const ogImage = getMeta(html, 'property', 'og:image');
  const twitterCard = getMeta(html, 'name', 'twitter:card');
  if (ogType && ogType !== 'profile') {
    for (const tag of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
      if (!getMeta(html, 'name', tag)) err(file, `missing ${tag}`);
    }
  }
  if (twitterCard) {
    for (const tag of ['twitter:site', 'twitter:creator']) {
      if (!getMeta(html, 'name', tag)) err(file, `missing ${tag}`);
    }
  }

  if (html.includes('ecommerce:"dataLayer"') && !html.includes('window.dataLayer')) {
    err(file, 'Yandex Metrika ecommerce uses dataLayer, but window.dataLayer is not initialized');
  }
  if (ogImage) {
    const w = getMeta(html, 'property', 'og:image:width');
    const h = getMeta(html, 'property', 'og:image:height');
    const type = getMeta(html, 'property', 'og:image:type');
    if (!w || !h) err(file, 'og:image width/height missing');
    if (!type) warn(file, 'og:image:type missing');
    if ((w && w !== '1200') || (h && h !== '630')) warn(file, `og:image dimensions are ${w}x${h}, recommended 1200x630`);
    if (ogImage.startsWith(`${BASE}/`)) {
      const imgPath = path.join(AUDIT_ROOT, ogImage.slice(BASE.length + 1));
      if (!fs.existsSync(imgPath)) err(file, `og:image file missing: ${ogImage}`);
    }
  }

  // JSON-LD checks.
  const ldBlocks = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const [idx, block] of ldBlocks.entries()) {
    let data;
    try { data = JSON.parse(block[1]); } catch (e) { err(file, `JSON-LD block ${idx + 1} invalid JSON: ${e.message}`); continue; }
    const roots = data['@graph'] || [data];
    if (data['@type'] === 'BreadcrumbList') err(file, 'standalone BreadcrumbList JSON-LD; put it into @graph');
    const ids = new Map();
    for (const obj of roots) {
      if (!obj || typeof obj !== 'object') continue;
      if (obj['@id']) {
        if (ids.has(obj['@id'])) err(file, `duplicate JSON-LD @id ${obj['@id']}`);
        ids.set(obj['@id'], true);
      }
      const pub = obj.publisher;
      if (pub && pub['@type'] === 'Person') err(file, 'publisher uses Person; use Organization node');
      if (pub && pub['@id'] && ![ORG_ID, WEBSITE_ID].includes(pub['@id'])) warn(file, `publisher @id is not site graph id: ${pub['@id']}`);
    }
    if (ldBlocks.length && data['@graph']) {
      const hasOrg = data['@graph'].some((o) => o && o['@id'] === ORG_ID);
      const hasWeb = data['@graph'].some((o) => o && o['@id'] === WEBSITE_ID);
      if (!hasOrg) err(file, 'JSON-LD @graph lacks #organization node');
      if (!hasWeb) err(file, 'JSON-LD @graph lacks #website node');
    }
  }

  const faq = extractFaq(html);
  if (faq.length) {
    if (!/"@type"\s*:\s*"FAQPage"/.test(html)) err(file, 'visible FAQ without FAQPage JSON-LD');
    for (const item of faq) {
      if (item.words < 60) warn(file, `FAQ answer too short (${item.words} words): ${item.q}`);
      if (item.words > 220) warn(file, `FAQ answer too long (${item.words} words): ${item.q}`);
    }
    if (!/aria-controls=/.test(html)) err(file, 'FAQ buttons lack aria-controls');
  }
}

for (const required of ['robots.txt', 'sitemap.xml']) {
  if (!fs.existsSync(path.join(AUDIT_ROOT, required))) err(required, `missing from audit root ${rel(AUDIT_ROOT) || '.'}`);
}

// robots policy.
if (fs.existsSync(path.join(AUDIT_ROOT, 'robots.txt'))) {
  const robots = read('robots.txt');
  for (const ua of ['OAI-SearchBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot']) {
    const block = robots.match(new RegExp(`User-agent:\\s*${ua}[\\s\\S]*?(?=\\nUser-agent:|\\nSitemap:|$)`, 'i'))?.[0] || '';
    if (!/Allow:\s*\//i.test(block)) err('robots.txt', `${ua} is not explicitly allowed for retrieval`);
  }
  for (const ua of ['GPTBot', 'Bytespider', 'Applebot-Extended', 'ClaudeBot', 'Meta-ExternalAgent']) {
    const block = robots.match(new RegExp(`User-agent:\\s*${ua}[\\s\\S]*?(?=\\nUser-agent:|\\nSitemap:|$)`, 'i'))?.[0] || '';
    if (!/Disallow:\s*\//i.test(block)) err('robots.txt', `${ua} is not blocked as training/bulk crawler`);
  }
}

// sitemap image namespace and unique loc.
if (fs.existsSync(path.join(AUDIT_ROOT, 'sitemap.xml'))) {
  const sitemap = read('sitemap.xml');
  if (!/xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/.test(sitemap)) err('sitemap.xml', 'missing image namespace');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const dupLocs = [...new Set(locs.filter((x, i) => locs.indexOf(x) !== i))];
  if (dupLocs.length) err('sitemap.xml', `duplicate loc entries: ${dupLocs.join(', ')}`);
  for (const block of sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = block[1].match(/<loc>([^<]+)<\/loc>/)?.[1];
    if (!loc) continue;
    if (!/<image:image>/.test(block[1])) warn('sitemap.xml', `URL without image:image: ${loc}`);
  }
}

const mode = REGISTRY_MODE ? `registry dist (${rel(AUDIT_ROOT) || '.'})` : 'source/root';
if (errors) {
  console.log(`\nSEO audit failed [${mode}]: ${errors} errors, ${warnings} warnings.`);
  process.exit(1);
}
console.log(`\nSEO audit passed [${mode}]: ${htmlEntries.length} HTML routes, 0 errors, ${warnings} warnings.`);
