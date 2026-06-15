#!/usr/bin/env node
/*
 * article-mdx-pilot-audit.js — shadow ownership audit for article MDX.
 * Compares the Astro-generated article in dist against the legacy baseline.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SITE = 'https://gospod-bog.ru';
const LEGACY_REL = 'articles/dzhon-gill-spravochnik/index.html';
const ASTRO_REL = 'articles/dzhon-gill-spravochnik/index.html';
const LEGACY_CANONICAL = `${SITE}/articles/dzhon-gill-spravochnik/`;
const NO_BUILD = process.argv.includes('--no-build');

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
  console.log('▶ Building strangler dist for MDX shadow pilot audit…');
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
  console.log(`ARTICLE MDX SHADOW AUDIT (${NO_BUILD ? 'no-build' : 'build'}, content parity required)`);
  runBuild();

  const legacyPath = file(LEGACY_REL);
  const astroPath = distFile(ASTRO_REL);
  if (!fs.existsSync(legacyPath)) bad(`legacy article missing: ${LEGACY_REL}`);
  if (!fs.existsSync(astroPath)) bad(`Astro article missing in dist: ${ASTRO_REL}`);
  if (problems.length) return finish();

  const legacy = read(legacyPath);
  const astroHtml = read(astroPath);

  if (legacy === astroHtml) bad('dist article is byte-identical to legacy; expected Astro shadow ownership');
  else ok('dist article has been successfully taken over by Astro (shadow ownership)');
  
  if (/class="astro-article"/.test(astroHtml)) ok('dist article path contains Astro article output');
  else bad('dist article path lacks Astro article output marker');

  const legacyTitle = title(legacy);
  const legacyDescription = meta(legacy, 'description');
  const legacyCanonical = canonical(legacy);
  const legacyH1 = h1(legacy);
  const legacyOgImage = normalizeUrl(meta(legacy, 'og:image'));
  const legacyPublished = meta(legacy, 'article:published_time');
  const legacyModified = meta(legacy, 'article:modified_time');
  const legacyWords = wordCount(articleHtml(legacy, 'article-body'));
  const astroWords = wordCount(articleHtml(astroHtml, 'astro-article'));

  mustEqual('legacy canonical baseline', legacyCanonical, LEGACY_CANONICAL);
  mustEqual('Astro canonical stays public canonical', canonical(astroHtml), LEGACY_CANONICAL);
  mustContain('Astro robots', meta(astroHtml, 'robots'), 'index, follow');
  mustContain('Astro title', title(astroHtml), legacyTitle);
  mustEqual('Astro meta description mirrors legacy', meta(astroHtml, 'description'), legacyDescription);
  mustEqual('Astro visible h1 mirrors legacy', h1(astroHtml), legacyH1);
  mustEqual('Astro og:image mirrors legacy', normalizeUrl(meta(astroHtml, 'og:image')), legacyOgImage);
  mustContain('Astro article slug marker', astroHtml, 'data-article-slug="dzhon-gill-spravochnik"');

  const nodes = jsonLdNodes(astroHtml);
  const article = firstNode(nodes, 'Article');
  if (!article) bad('Astro JSON-LD missing Article node');
  else {
    ok('Astro JSON-LD Article node exists');
    mustEqual('Article headline mirrors legacy title', article.headline || '', legacyTitle);
    mustEqual('Article description mirrors legacy', article.description || '', legacyDescription);
    mustEqual('Article @id uses intended public canonical', article['@id'] || '', `${LEGACY_CANONICAL}#article`);
    mustEqual('Article datePublished mirrors legacy instant', iso(article.datePublished), iso(legacyPublished));
    mustEqual('Article dateModified mirrors legacy instant', iso(article.dateModified), iso(legacyModified));
  }

  const legacyH2 = headings(legacy);
  const astroH2 = headings(astroHtml);
  console.log(`legacy words: ${legacyWords}; astro words: ${astroWords}; ratio: ${(astroWords / Math.max(1, legacyWords)).toFixed(2)}`);
  console.log(`legacy h2 count: ${legacyH2.length}; astro h2 count: ${astroH2.length}`);
  const ratio = astroWords / Math.max(1, legacyWords);
  if (ratio < 0.72) {
    bad(`MDX body is not content-complete yet (${astroWords}/${legacyWords} words, ratio ${ratio.toFixed(2)})`);
  } else ok('MDX body word-count parity is within migration threshold');

  finish();
}
function finish() {
  console.log('');
  if (problems.length) {
    console.log(`❌ article MDX shadow audit failed: ${problems.length} issue(s)`);
    process.exit(1);
  }
  console.log('✅ article MDX shadow audit passed');
  if (warnings.length) console.log('ℹ️ Advisory warnings remain.');
}

main();
