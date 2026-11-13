#!/usr/bin/env node
/**
 * Contract test for Wave 28:
 *   - GBS-SUMMARY-MICROHEADING-READABILITY (all 50 .summary-card__head routes)
 *   - GBS-TEXT-CONTRAST-RESIDUAL-BATCH (.article-byline__updated opacity/AA contrast)
 *   - GBS-CUSTOM-FONT-MATRIX-MIXED-FAMILY-RENDERING (Wave-46 P0 preload/registry hygiene)
 *   - GBS-NAGORNAYA-MENU-ICON-MISSING-FORCED-COLORS (8 Nagornaya #menuBtn vector bars)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

assert.equal(fs.existsSync(DIST), true, 'dist/ must exist before running wave28 contract');

function walkHtml(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'pagefind') continue;
      walkHtml(full, out);
    } else if (entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

const cssCache = new Map();
function readDistStylesheet(fromHtmlPath, href) {
  const cleanHref = href.split('?')[0].split('#')[0];
  const resolved = cleanHref.startsWith('/')
    ? cleanHref.slice(1)
    : path.posix.normalize(
        path.posix.join(path.relative(DIST, path.dirname(fromHtmlPath)).split(path.sep).join('/'), cleanHref)
      );
  if (!cssCache.has(resolved)) {
    const abs = path.join(DIST, resolved);
    cssCache.set(resolved, fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '');
  }
  return cssCache.get(resolved);
}

function combinedCssForPage(htmlPath, html) {
  const chunks = [];
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    chunks.push(match[1]);
  }
  for (const match of html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    chunks.push(readDistStylesheet(htmlPath, match[1]));
  }
  for (const match of html.matchAll(/<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi)) {
    chunks.push(readDistStylesheet(htmlPath, match[1]));
  }
  return chunks.join('\n');
}

// 1. Verify css/mobile-hotfix.css !important ceiling (<= 142) is respected.
{
  const hotfix = fs.readFileSync(path.join(ROOT, 'css', 'mobile-hotfix.css'), 'utf8');
  const importantCount = (hotfix.match(/!important/g) || []).length;
  assert.equal(importantCount <= 142, true, `mobile-hotfix.css !important count ${importantCount} exceeds 142`);
}

// 2. Verify all .summary-card__head routes in dist/ receive the shared readable token.
const htmlFiles = walkHtml(DIST);
let summaryRoutes = 0;
for (const htmlPath of htmlFiles) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  if (!html.includes('summary-card__head')) continue;
  summaryRoutes += 1;
  const css = combinedCssForPage(htmlPath, html);
  const rel = path.relative(DIST, htmlPath);
  assert.match(
    css,
    /--gb-summary-head-font-size\s*:\s*0\.75rem/,
    `${rel}: missing --gb-summary-head-font-size: 0.75rem token`
  );
  assert.match(
    css,
    /article-byline__updated[\s\S]{0,120}?opacity\s*:\s*1/,
    `${rel}: missing .article-byline__updated opacity:1 contrast guard`
  );
}
assert.equal(summaryRoutes >= 50, true, `expected >= 50 .summary-card__head routes, found ${summaryRoutes}`);

// 3. Verify Wave-46 P0 preload/registry alignment on standalone map & konfessii routes.
for (const rel of ['karty/avraam/index.html', 'karty/ishod/index.html']) {
  const html = fs.readFileSync(path.join(DIST, rel), 'utf8');
  assert.doesNotMatch(html, /sourcesans3-cyrillic-400\.woff2/, `${rel}: dead SourceSans3 preload remained`);
  assert.match(html, /fonts\/fonts\.css/, `${rel}: missing fonts/fonts.css registry for Noto Sans Hebrew`);
}
for (const rel of ['konfessii/index.html', 'konfessii/russkij-baptizm/index.html']) {
  const html = fs.readFileSync(path.join(DIST, rel), 'utf8');
  assert.doesNotMatch(html, /rel=["']preload["'][^>]*as=["']font["']/, `${rel}: dead font preload remained on system-typography route`);
}

// 4. Verify all 8 Nagornaya #menuBtn routes render vector SVG lines + forced-colors outline.
const nagornayaMenuRoutes = [
  'nagornaya/index.html',
  'nagornaya/chast-1/index.html',
  'nagornaya/chast-2/index.html',
  'nagornaya/chast-3/index.html',
  'nagornaya/chast-4/index.html',
  'nagornaya/chast-5/index.html',
  'nagornaya/istochniki/index.html',
  'nagornaya/nakhodki/index.html',
];
for (const rel of nagornayaMenuRoutes) {
  const html = fs.readFileSync(path.join(DIST, rel), 'utf8');
  const btnMatch = html.match(/<button\b[^>]*id=["']menuBtn["'][^>]*>([\s\S]*?)<\/button>/i);
  assert.ok(btnMatch, `${rel}: #menuBtn missing`);
  const barMatches = [...btnMatch[1].matchAll(/class=["'][^"']*\bbar\b[^"']*["']/g)];
  assert.equal(barMatches.length, 3, `${rel}: expected 3 .bar elements inside #menuBtn`);
  const svgLines = [...btnMatch[1].matchAll(/<line\b[^>]*stroke=["']currentColor["']/g)];
  assert.equal(svgLines.length, 3, `${rel}: expected 3 vector <line stroke="currentColor"> inside #menuBtn`);
  assert.match(html, /@media\s*\(\s*forced-colors\s*:\s*active\s*\)[\s\S]{0,160}#menuBtn/, `${rel}: missing forced-colors #menuBtn rule`);
}

console.log(`✅ Wave 28 contract: PASS (${summaryRoutes} summary routes, 4 preload/registry routes, 8 Nagornaya forced-colors menu routes)`);
