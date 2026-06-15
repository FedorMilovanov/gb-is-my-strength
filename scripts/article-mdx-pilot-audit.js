#!/usr/bin/env node
/*
 * article-mdx-pilot-audit.js — compare the build-only MDX article preview
 * against its legacy article source without promoting the public URL.
 *
 * Default mode checks metadata/parity-critical contracts and treats body parity
 * as advisory because /dev/article-mdx-pilot/ is still a schema/layout pilot.
 * Add --require-content-parity only when the MDX body has been fully migrated.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SITE = 'https://gospod-bog.ru';
const LEGACY_REL = 'articles/dzhon-gill-spravochnik/index.html';
const DIST_LEGACY_REL = 'articles/dzhon-gill-spravochnik/index.html';
const PREVIEW_REL = 'dev/article-mdx-pilot/index.html';
const PREVIEW_CANONICAL = `${SITE}/dev/article-mdx-pilot/`;
const LEGACY_CANONICAL = `${SITE}/articles/dzhon-gill-spravochnik/`;
const NO_BUILD = process.argv.includes('--no-build');
const REQUIRE_CONTENT_PARITY = true; // body migrated, now required

const problems = [];
const warnings = [];

function ok(msg) { console.log(`✅ ${msg}`); }
function warn(msg) { warnings.push(msg); console.log(`ℹ️ ${msg}`); }
function bad(msg) { problems.push(msg); console.log(`❌ ${msg}`); }
function file(rel) { return path.join(ROOT, rel); }
function distFile(rel) { return path.join(DIST, rel); }
function read(abs) { return fs.readFileSync(abs, 'utf8'); }
function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function ownText(html, tag, attrs = '') {
  const re = new RegExp(`<${tag}\\b${attrs}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  return stripTags(html.match(re)?.[1] || '');
}
function title(html) { return ownText(html, 'title'); }
function h1(html) { return ownText(html, 'h1'); }
function meta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<meta\\b([^>]*\\b(?:name|property)=["']${escaped}["'][^>]*)>`, 'i');
  const m = html.match(re);
  return m?.[1]?.match(/\bcontent=["']([^"']*)["']/i)?.[1]?.trim() || '';
}
function canonical(html) {
  const links = [...html.matchAll(/<link\b([^>]+)>/gi)];
  for (const link of links) {
    const attrs = link[1];
    if (!/\brel=["']canonical["']/i.test(attrs)) continue;
    return attrs.match(/\bhref=["']([^"']+)["']/i)?.[1]?.trim() || '';
  }
  return '';
}
function headings(html) {
  return [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => stripTags(m[1])).filter(Boolean);
}
function bodyHtml(html) {
  return html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
}
function articleHtml(html, className) {
  const re = new RegExp(`<article\\b([^>]*class=["'][^"']*${className}[^"']*["'][^>]*)>([\\s\\S]*?)<\\/article>`, 'i');
  return html.match(re)?.[2] || bodyHtml(html);
}
function wordCount(html) {
  const text = stripTags(html);
  return (text.match(/[A-Za-zА-Яа-яЁё0-9]{2,}/g) || []).length;
}
function jsonLdNodes(html) {
  const nodes = [];
  for (const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = m[1].trim();
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) nodes.push(...parsed);
      else if (parsed && Array.isArray(parsed['@graph'])) nodes.push(...parsed['@graph']);
      else if (parsed) nodes.push(parsed);
    } catch (e) {
      bad(`invalid JSON-LD block: ${e.message}`);
    }
  }
  return nodes;
}
function firstNode(nodes, type) {
  return nodes.find((node) => {
    const t = node && node['@type'];
    return Array.isArray(t) ? t.includes(type) : t === type;
  });
}
function normalizeUrl(url) {
  return (url || '').replace(/^https:\/\/gospod-bog\.ru/, SITE);
}
function iso(value) {
  const d = new Date(value);
  return Number.isFinite(d.valueOf()) ? d.toISOString() : '';
}
function runBuild() {
  if (NO_BUILD) return;
  console.log('▶ Building strangler dist for MDX article pilot audit…');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const res = spawnSync(npm, ['run', 'strangler:build'], { cwd: ROOT, stdio: 'inherit' });
  if (res.status !== 0) process.exit(res.status || 1);
}
function mustEqual(label, actual, expected) {
  if (actual === expected) ok(`${label}: ${expected}`);
  else bad(`${label}: expected "${expected}", got "${actual}"`);
}
function mustContain(label, actual, needle) {
  if (String(actual || '').includes(needle)) ok(`${label}: contains "${needle}"`);
  else bad(`${label}: missing "${needle}"`);
}

function main() {
  console.log(`ARTICLE MDX PILOT AUDIT (${NO_BUILD ? 'no-build' : 'build'}, content parity ${REQUIRE_CONTENT_PARITY ? 'required' : 'advisory'})`);
  runBuild();

  const legacyPath = file(LEGACY_REL);
  const distLegacyPath = distFile(DIST_LEGACY_REL);
  const previewPath = distFile(PREVIEW_REL);
  if (!fs.existsSync(legacyPath)) bad(`legacy article missing: ${LEGACY_REL}`);
  if (!fs.existsSync(distLegacyPath)) bad(`dist legacy article missing: ${DIST_LEGACY_REL}`);
  if (!fs.existsSync(previewPath)) bad(`MDX preview missing: ${PREVIEW_REL}`);
  if (problems.length) return finish();

  const legacy = read(legacyPath);
  const distLegacy = read(distLegacyPath);
  const preview = read(previewPath);

  if (legacy === distLegacy) ok('public legacy article remains byte-identical in dist');
  else bad('public legacy article in dist differs from repository root; do not promote MDX article accidentally');
  if (/class="astro-article"/.test(distLegacy)) bad('public legacy article path contains Astro article output');
  else ok('public legacy article path is still legacy-owned');

  const legacyTitle = title(legacy);
  const legacyDescription = meta(legacy, 'description');
  const legacyCanonical = canonical(legacy);
  const legacyH1 = h1(legacy);
  const legacyOgImage = normalizeUrl(meta(legacy, 'og:image'));
  const legacyPublished = meta(legacy, 'article:published_time');
  const legacyModified = meta(legacy, 'article:modified_time');
  const legacyWords = wordCount(articleHtml(legacy, 'article-body'));
  const previewWords = wordCount(articleHtml(preview, 'astro-article'));

  mustEqual('legacy canonical baseline', legacyCanonical, LEGACY_CANONICAL);
  mustEqual('preview canonical stays dev/noindex', canonical(preview), PREVIEW_CANONICAL);
  mustContain('preview robots', meta(preview, 'robots'), 'noindex');
  mustContain('preview title', title(preview), legacyTitle);
  mustEqual('preview meta description mirrors legacy', meta(preview, 'description'), legacyDescription);
  mustEqual('preview visible h1 mirrors legacy', h1(preview), legacyH1);
  mustEqual('preview og:image mirrors legacy', normalizeUrl(meta(preview, 'og:image')), legacyOgImage);
  mustContain('preview pilot note', preview, 'Build-only MDX pilot');
  mustContain('preview intended canonical note', preview, LEGACY_CANONICAL);
  mustContain('preview article slug marker', preview, 'data-article-slug="dzhon-gill-spravochnik"');

  const nodes = jsonLdNodes(preview);
  const article = firstNode(nodes, 'Article');
  if (!article) bad('preview JSON-LD missing Article node');
  else {
    ok('preview JSON-LD Article node exists');
    mustEqual('Article headline mirrors legacy title', article.headline || '', legacyTitle);
    mustEqual('Article description mirrors legacy', article.description || '', legacyDescription);
    mustEqual('Article @id uses intended public canonical', article['@id'] || '', `${LEGACY_CANONICAL}#article`);
    mustEqual('Article datePublished mirrors legacy instant', iso(article.datePublished), iso(legacyPublished));
    mustEqual('Article dateModified mirrors legacy instant', iso(article.dateModified), iso(legacyModified));
  }

  const legacyH2 = headings(legacy);
  const previewH2 = headings(preview);
  console.log(`legacy words: ${legacyWords}; preview words: ${previewWords}; ratio: ${(previewWords / Math.max(1, legacyWords)).toFixed(2)}`);
  console.log(`legacy h2 count: ${legacyH2.length}; preview h2 count: ${previewH2.length}`);
  const ratio = previewWords / Math.max(1, legacyWords);
  if (ratio < 0.72) {
    const msg = `MDX body is not content-complete yet (${previewWords}/${legacyWords} words, ratio ${ratio.toFixed(2)})`;
    if (REQUIRE_CONTENT_PARITY) bad(msg);
    else warn(`${msg}; acceptable for build-only schema/layout pilot, not acceptable for public URL promotion`);
  } else ok('MDX body word-count parity is within migration threshold');

  finish();
}
function finish() {
  console.log('');
  if (problems.length) {
    console.log(`❌ article MDX pilot audit failed: ${problems.length} issue(s)`);
    process.exit(1);
  }
  console.log('✅ article MDX pilot audit passed');
  if (warnings.length) console.log('ℹ️ Advisory warnings remain until the MDX body is fully migrated.');
}

main();
