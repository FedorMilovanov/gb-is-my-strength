#!/usr/bin/env node
/**
 * schema-rich-results-audit.js
 *
 * Semantic JSON-LD / rich-results guard for static HTML output.
 * This complements `dist-jsonld-audit` (syntax parse) and `seo-audit`
 * by checking required Article/Breadcrumb/FAQ fields that have regressed before.
 * Local Article ImageObject dimensions are verified against the referenced
 * published binary and, when the same URL is used, the Open Graph projection.
 *
 * Usage:
 *   node scripts/schema-rich-results-audit.js [--root .]
 *   node scripts/schema-rich-results-audit.js --root dist
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const rootArg = process.argv.includes('--root')
  ? process.argv[process.argv.indexOf('--root') + 1]
  : '.';
const auditRoot = path.resolve(ROOT, rootArg || '.');
const BASE = 'https://gospod-bog.ru/';
const ARTICLE_TYPES = new Set(['Article', 'NewsArticle', 'BlogPosting', 'ScholarlyArticle']);
const errors = [];
const warnings = [];
const stats = { html: 0, blocks: 0, articles: 0, breadcrumbs: 0, faqs: 0, graphs: 0, imageChecks: 0 };

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'reports', '.astro', 'dist'].includes(ent.name) && path.resolve(dir, ent.name) !== auditRoot) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && p.endsWith('.html')) out.push(p);
  }
  return out;
}

function rel(file) {
  return path.relative(auditRoot, file).replace(/\\/g, '/') || '.';
}

function addErr(file, msg) { errors.push(`${file}: ${msg}`); }
function addWarn(file, msg) { warnings.push(`${file}: ${msg}`); }
function asArray(v) { return Array.isArray(v) ? v : (v == null ? [] : [v]); }
function typeList(node) { return asArray(node && node['@type']).filter(Boolean); }
function hasType(node, wanted) { return typeList(node).some(t => t === wanted); }
function hasAnyType(node, set) { return typeList(node).some(t => set.has(t)); }
function isAbsUrl(v) { return typeof v === 'string' && /^https?:\/\//i.test(v); }
function propId(v) { return v && typeof v === 'object' ? v['@id'] : ''; }
function finitePositiveNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function metaContent(html, key) {
  const tags = html.match(/<meta\s+[^>]*>/gi) || [];
  for (const tag of tags) {
    const property = tag.match(/\b(?:property|name)=["']([^"']+)["']/i)?.[1];
    if (property !== key) continue;
    return tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] || '';
  }
  return '';
}

function ogImageProjection(html) {
  return {
    url: metaContent(html, 'og:image'),
    width: finitePositiveNumber(metaContent(html, 'og:image:width')),
    height: finitePositiveNumber(metaContent(html, 'og:image:height')),
  };
}

function localAssetPath(urlValue) {
  if (!isAbsUrl(urlValue)) return null;
  let parsed;
  try { parsed = new URL(urlValue); } catch (_) { return null; }
  if (!/^(?:www\.)?gospod-bog\.ru$/i.test(parsed.hostname)) return null;
  const relative = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
  if (!relative || relative.includes('..')) return null;
  const candidates = [
    path.join(auditRoot, relative),
    path.join(ROOT, relative),
    path.join(ROOT, 'public', relative),
  ];
  return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

function readUInt24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function imageDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), format: 'png' };
  }

  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buffer.toString('ascii', 12, 16);
    if (chunk === 'VP8X' && buffer.length >= 30) {
      return { width: 1 + readUInt24LE(buffer, 24), height: 1 + readUInt24LE(buffer, 27), format: 'webp' };
    }
    if (chunk === 'VP8 ' && buffer.length >= 30 && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff, format: 'webp' };
    }
    if (chunk === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
      const b0 = buffer[21], b1 = buffer[22], b2 = buffer[23], b3 = buffer[24];
      return {
        width: 1 + b0 + ((b1 & 0x3f) << 8),
        height: 1 + ((b1 & 0xc0) >> 6) + (b2 << 2) + ((b3 & 0x0f) << 10),
        format: 'webp',
      };
    }
  }

  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      offset += 2;
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (offset + 2 > buffer.length) break;
      const length = buffer.readUInt16BE(offset);
      if (length < 2 || offset + length > buffer.length) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && length >= 7) {
        return { width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3), format: 'jpeg' };
      }
      offset += length;
    }
  }
  return null;
}

function validateArticleImage(file, img, context) {
  if (typeof img === 'string') {
    if (!isAbsUrl(img)) addErr(file, `Article image is not absolute URL: ${img}`);
    return;
  }
  if (!img || typeof img !== 'object') return;
  if (img.url && !isAbsUrl(img.url)) addErr(file, `Article ImageObject.url is not absolute URL: ${img.url}`);
  const url = img.url || img.contentUrl;
  if (!url || !isAbsUrl(url)) return;

  const declaredWidth = finitePositiveNumber(img.width);
  const declaredHeight = finitePositiveNumber(img.height);
  const og = context.ogImage;
  if (og.url === url) {
    if (declaredWidth && og.width && declaredWidth !== og.width) {
      addErr(file, `Article ImageObject.width ${declaredWidth} contradicts og:image:width ${og.width} for ${url}`);
    }
    if (declaredHeight && og.height && declaredHeight !== og.height) {
      addErr(file, `Article ImageObject.height ${declaredHeight} contradicts og:image:height ${og.height} for ${url}`);
    }
  }

  const asset = localAssetPath(url);
  if (!asset || (!declaredWidth && !declaredHeight)) return;
  const actual = imageDimensions(asset);
  if (!actual) {
    addWarn(file, `could not decode local Article image header: ${path.relative(ROOT, asset)}`);
    return;
  }
  stats.imageChecks++;
  if (declaredWidth && declaredWidth !== actual.width) {
    addErr(file, `Article ImageObject.width ${declaredWidth} does not match local ${actual.format} width ${actual.width}: ${url}`);
  }
  if (declaredHeight && declaredHeight !== actual.height) {
    addErr(file, `Article ImageObject.height ${declaredHeight} does not match local ${actual.format} height ${actual.height}: ${url}`);
  }
}

function validateArticle(file, node, context) {
  stats.articles++;
  for (const key of ['headline', 'datePublished', 'dateModified', 'author', 'publisher']) {
    if (!node[key]) addErr(file, `Article missing ${key}`);
  }
  if (node.headline && String(node.headline).length > 115) addWarn(file, `Article headline is long (${String(node.headline).length} chars)`);
  if (node.datePublished && !/^\d{4}-\d{2}-\d{2}/.test(String(node.datePublished))) addErr(file, `Article datePublished is not ISO-like: ${node.datePublished}`);
  if (node.dateModified && !/^\d{4}-\d{2}-\d{2}/.test(String(node.dateModified))) addErr(file, `Article dateModified is not ISO-like: ${node.dateModified}`);

  const authors = asArray(node.author);
  if (!authors.length) addErr(file, 'Article author is empty');
  for (const a of authors) {
    if (!a || typeof a !== 'object') addErr(file, 'Article author is not an object');
    else if (!a.name && !a['@id']) addErr(file, 'Article author lacks name/@id');
  }

  const pub = node.publisher;
  if (pub) {
    if (typeof pub !== 'object') addErr(file, 'Article publisher is not an object/@id object');
    else if (!pub.name && !pub['@id']) addErr(file, 'Article publisher lacks name/@id');
  }

  const images = asArray(node.image);
  if (!images.length) addWarn(file, 'Article lacks image');
  for (const img of images) validateArticleImage(file, img, context);

  if (node.mainEntityOfPage && typeof node.mainEntityOfPage === 'object') {
    const id = node.mainEntityOfPage['@id'];
    if (id && !String(id).startsWith(BASE)) addWarn(file, `Article mainEntityOfPage @id outside production base: ${id}`);
  }
}

function validateBreadcrumb(file, node) {
  stats.breadcrumbs++;
  const els = node.itemListElement;
  if (!Array.isArray(els) || !els.length) {
    addErr(file, 'BreadcrumbList itemListElement is empty/not array');
    return;
  }
  els.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return addErr(file, `Breadcrumb item ${idx + 1} is not object`);
    if (item['@type'] !== 'ListItem') addErr(file, `Breadcrumb item ${idx + 1} @type is not ListItem`);
    if (item.position !== idx + 1) addErr(file, `Breadcrumb item ${idx + 1} position is ${item.position}`);
    if (!item.name) addErr(file, `Breadcrumb item ${idx + 1} missing name`);
    if (idx < els.length - 1 && !item.item) addErr(file, `Breadcrumb item ${idx + 1} missing item URL`);
    if (item.item && !isAbsUrl(item.item)) addErr(file, `Breadcrumb item ${idx + 1} item is not absolute URL: ${item.item}`);
  });
}

function validateFAQ(file, node) {
  stats.faqs++;
  const items = asArray(node.mainEntity);
  if (!items.length) addErr(file, 'FAQPage mainEntity is empty');
  items.forEach((q, idx) => {
    if (!q || typeof q !== 'object') return addErr(file, `FAQ question ${idx + 1} is not object`);
    if (q['@type'] !== 'Question') addErr(file, `FAQ question ${idx + 1} @type is not Question`);
    if (!q.name) addErr(file, `FAQ question ${idx + 1} missing name`);
    if (!q.acceptedAnswer || q.acceptedAnswer['@type'] !== 'Answer') addErr(file, `FAQ question ${idx + 1} missing acceptedAnswer Answer`);
    if (q.acceptedAnswer && !q.acceptedAnswer.text) addErr(file, `FAQ answer ${idx + 1} missing text`);
  });
}

if (!fs.existsSync(auditRoot)) {
  console.error(`❌ schema audit root missing: ${path.relative(ROOT, auditRoot)}`);
  process.exit(1);
}

for (const filePath of walk(auditRoot)) {
  stats.html++;
  const file = rel(filePath);
  const html = fs.readFileSync(filePath, 'utf8');
  const context = { html, filePath, ogImage: ogImageProjection(html) };
  if (/\{jsonLd\}/.test(html)) addErr(file, 'contains literal {jsonLd} placeholder');
  const blocks = [...html.matchAll(/<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [idx, m] of blocks.entries()) {
    stats.blocks++;
    let data;
    try { data = JSON.parse(m[1].trim()); }
    catch (e) { addErr(file, `JSON-LD block ${idx + 1} invalid JSON: ${e.message}`); continue; }
    const nodes = data['@graph'] || [data];
    if (data['@graph']) stats.graphs++;
    const ids = new Set();
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const id = node['@id'];
      if (id) {
        if (ids.has(id)) addErr(file, `duplicate @id in JSON-LD graph: ${id}`);
        ids.add(id);
      }
      if (hasAnyType(node, ARTICLE_TYPES)) validateArticle(file, node, context);
      if (hasType(node, 'BreadcrumbList')) validateBreadcrumb(file, node);
      if (hasType(node, 'FAQPage')) validateFAQ(file, node);

      const publisherId = propId(node.publisher);
      if (publisherId && !ids.has(publisherId) && data['@graph']) addWarn(file, `publisher @id not present as node in same graph: ${publisherId}`);
    }
  }
}

console.log(`SCHEMA RICH RESULTS AUDIT (${path.relative(ROOT, auditRoot) || '.'})`);
console.log(`HTML files: ${stats.html}`);
console.log(`JSON-LD blocks: ${stats.blocks}`);
console.log(`Graphs: ${stats.graphs}`);
console.log(`Articles: ${stats.articles}`);
console.log(`BreadcrumbLists: ${stats.breadcrumbs}`);
console.log(`FAQPages: ${stats.faqs}`);
console.log(`Local Article image dimension checks: ${stats.imageChecks}`);

if (warnings.length) {
  console.log(`\nWarnings: ${warnings.length}`);
  warnings.slice(0, 60).forEach(w => console.log(`⚠️  ${w}`));
  if (warnings.length > 60) console.log(`... ${warnings.length - 60} more warning(s)`);
}
if (errors.length) {
  console.error(`\n❌ Schema rich-results audit failed: ${errors.length} issue(s)`);
  errors.forEach(e => console.error(`- ${e}`));
  process.exit(1);
}
console.log('\n✅ Schema rich-results audit passed');
