#!/usr/bin/env node
/**
 * SEO/AEO/GEO audit for gospod-bog.ru
 *
 * Checks production canonical consistency, social cards, JSON-LD publisher graph,
 * FAQPage parity, sitemap image extensions, and AI bot robots policy.
 *
 * Run:
 *   node scripts/seo-audit.js
 *   node scripts/seo-audit.js --root dist --registry
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { auditSeoRouteFiles } = require('./lib/seo-route-contract');
const {
  approvedSocialImageProfileLabel,
  auditSitemapImages,
  isApprovedSocialImageDimensions,
  readImageDimensions,
} = require('./lib/sitemap-image-projection');

const REPO_ROOT = path.resolve(__dirname, '..');
const BASE = 'https://gospod-bog.ru';
const ORG_ID = `${BASE}/#organization`;
const WEBSITE_ID = `${BASE}/#website`;

function parseArgs(argv) {
  let root = REPO_ROOT;
  let registry = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--registry') {
      registry = true;
      continue;
    }
    if (arg === '--root') {
      const value = argv[index + 1];
      if (!value) throw new Error('--root requires a path');
      root = path.resolve(REPO_ROOT, value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--root=')) {
      root = path.resolve(REPO_ROOT, arg.slice('--root='.length));
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return { root, registry };
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(`SEO audit argument error: ${error.message}`);
  process.exit(2);
}

const AUDIT_ROOT = options.root;
if (!fs.existsSync(AUDIT_ROOT) || !fs.statSync(AUDIT_ROOT).isDirectory()) {
  console.error(`SEO audit root does not exist: ${AUDIT_ROOT}`);
  process.exit(2);
}

let errors = 0;
let warnings = 0;

function read(file) { return fs.readFileSync(path.join(AUDIT_ROOT, file), 'utf8'); }
function rel(p) { return path.relative(AUDIT_ROOT, p).replace(/\\/g, '/'); }
function err(file, msg) { console.log(`❌ ${file}: ${msg}`); errors++; }
function warn(file, msg) { console.log(`⚠️  ${file}: ${msg}`); warnings++; }
function ok(msg) { console.log(`✅ ${msg}`); }

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.next', '.npm', '_app', 'dist', 'out', 'build', 'coverage', 'reports', '.astro'].includes(ent.name)) continue;
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

const walkedFiles = walk(AUDIT_ROOT);
let htmlFiles;
let routeAudit = null;
if (options.registry) {
  routeAudit = auditSeoRouteFiles(AUDIT_ROOT);
  for (const problem of routeAudit.errors) err('route-registry', problem);
  htmlFiles = routeAudit.files.map((entry) => entry.absolute);
  if (!routeAudit.errors.length) {
    ok(`registry covers ${routeAudit.counts.production} production routes (${routeAudit.counts.indexable} indexable, ${routeAudit.counts.noindex} noindex)`);
  }
} else {
  htmlFiles = walkedFiles.filter(p => p.endsWith('.html') && !/google|yandex/.test(rel(p)));
}
const allTextFiles = walkedFiles.filter(p => /\.(html|js|css|json|xml|md|txt)$/.test(p));

// SEO-01: no repository base path leakage.
for (const p of allTextFiles) {
  const file = rel(p);
  const text = fs.readFileSync(p, 'utf8');
  if (p.endsWith('.md') || p.endsWith('.txt')) continue; // DOCS-01: skip documentation
  if (text.includes('/gb-' + 'is-my-strength/')) err(file, 'contains repository base path');
}

for (const p of htmlFiles) {
  const file = rel(p);
  const html = fs.readFileSync(p, 'utf8');
  if (!html.includes('<head')) continue;
  const canonical = getLink(html, 'canonical');
  if (canonical && !canonical.startsWith(`${BASE}/`)) err(file, `canonical is not production origin: ${canonical}`);
  if ((html.match(/rel="canonical"/g) || []).length > 1) err(file, 'more than one canonical link');

  // Asset base path consistency: icons/manifest are production absolute, not GitHub subpath.
  for (const href of [...html.matchAll(/<link[^>]+href="([^"]+)"[^>]*>/g)].map(m => m[1])) {
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
    if (w && h && !isApprovedSocialImageDimensions(w, h)) {
      const message = `og:image dimensions are ${w}x${h}; approved profiles: ${approvedSocialImageProfileLabel()}`;
      if (options.registry) err(file, message); else warn(file, message);
    }
    if (ogImage.startsWith(`${BASE}/`)) {
      const imgPath = path.join(AUDIT_ROOT, ogImage.slice(BASE.length + 1));
      if (!fs.existsSync(imgPath)) {
        err(file, `og:image file missing: ${ogImage}`);
      } else if (options.registry) {
        try {
          const actual = readImageDimensions(imgPath);
          if (String(actual.width) !== w || String(actual.height) !== h) {
            err(file, `og:image metadata ${w}x${h} does not match file ${actual.width}x${actual.height}: ${ogImage}`);
          }
          if (type && type !== actual.type) err(file, `og:image:type ${type} does not match file type ${actual.type}`);
        } catch (error) {
          err(file, error.message);
        }
      }
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
      const hasOrg = data['@graph'].some(o => o && o['@id'] === ORG_ID);
      const hasWeb = data['@graph'].some(o => o && o['@id'] === WEBSITE_ID);
      if (!hasOrg) err(file, 'JSON-LD @graph lacks #organization node');
      if (!hasWeb) err(file, 'JSON-LD @graph lacks #website node');
    }
  }

  const faq = extractFaq(html);
  if (faq.length) {
    if (!/\"@type\"\s*:\s*\"FAQPage\"/.test(html)) err(file, 'visible FAQ without FAQPage JSON-LD');
    for (const item of faq) {
      if (item.words < 60) warn(file, `FAQ answer too short (${item.words} words): ${item.q}`);
      if (item.words > 220) warn(file, `FAQ answer too long (${item.words} words): ${item.q}`);
    }
    if (!/aria-controls=/.test(html)) err(file, 'FAQ buttons lack aria-controls');
  }
}

// robots policy.
if (!fs.existsSync(path.join(AUDIT_ROOT, 'robots.txt'))) {
  err('robots.txt', 'missing');
} else {
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

// sitemap image namespace, uniqueness, ownership and byte parity.
if (!fs.existsSync(path.join(AUDIT_ROOT, 'sitemap.xml'))) {
  err('sitemap.xml', 'missing');
} else {
  const sitemap = read('sitemap.xml');
  if (!/xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/.test(sitemap)) err('sitemap.xml', 'missing image namespace');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const dupLocs = [...new Set(locs.filter((x, i) => locs.indexOf(x) !== i))];
  if (dupLocs.length) err('sitemap.xml', `duplicate loc entries: ${dupLocs.join(', ')}`);
  if (options.registry) {
    const sitemapAudit = auditSitemapImages({ root: AUDIT_ROOT, htmlFiles });
    for (const problem of sitemapAudit.errors) err('sitemap.xml', problem);
    if (!sitemapAudit.errors.length) ok(`sitemap images match ${sitemapAudit.counts.entries} canonical page OG owners`);
  } else {
    ok('source sitemap image projection is finalized and verified by the production-like postbuild');
  }
}

const mode = options.registry ? 'registry/dist' : 'root';
if (errors) {
  console.log(`\nSEO audit failed (${mode}, ${rel(AUDIT_ROOT) || '.'}): ${errors} errors, ${warnings} warnings.`);
  process.exit(1);
}
console.log(`\nSEO audit passed (${mode}, ${rel(AUDIT_ROOT) || '.'}): 0 errors, ${warnings} warnings.`);
