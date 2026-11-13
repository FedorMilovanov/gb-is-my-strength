#!/usr/bin/env node
/**
 * Print Exclusion Policy Parity & Linked-Card Atomicity Contract
 * (SYS-READER-PRINT-EXCLUSION-POLICY-PARITY + SYS-PRINT-LINKED-CARD-ATOMICITY)
 *
 * Verifies:
 * 1. All 7 Teen and 5 Apostasy correction/feedback boundaries declare explicit
 *    `data-print-policy="exclude"` alongside `data-reader-exclude`, matching
 *    `GBReaderProjection.getPrintNodes()` and `@media print { display: none !important }`.
 * 2. `GBReaderProjection` (`src/runtime/reader-projection.js`) evaluates explicit
 *    `data-print-policy="include"` / `data-print-policy="exclude"` before generic
 *    `EXCLUDE_SELECTOR` when `policy === 'print'`.
 * 3. Every built `dist/` hub and article route with linked cards (`.h-article-card`,
 *    `.series-card`, `.teen-series-card`, `.apostasy-series-card`, `.genesis6-card`,
 *    `.outline-card`, `.related-articles__link`, `.context-links > a`) loads CSS
 *    with `@media print` `break-inside: avoid-page` atomicity.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
assert.ok(fs.existsSync(DIST), 'dist/ missing; build dist before running print-policy-card-atomicity-contract');

const projectionJs = fs.readFileSync(path.join(ROOT, 'src/runtime/reader-projection.js'), 'utf8');
assert.match(
  projectionJs,
  /if \(policy === 'print'\)[\s\S]*?data-print-policy="exclude"[\s\S]*?data-print-policy="include"[\s\S]*?if \(element\.closest\(EXCLUDE_SELECTOR\)\)/,
  'reader-projection.js must evaluate explicit data-print-policy overrides before generic EXCLUDE_SELECTOR'
);

for (const rel of ['src/runtime/article-capabilities.css', 'src/runtime/summary-card-readability.css']) {
  const css = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  assert.match(
    css,
    /@media print\s*\{[\s\S]*?\[data-print-policy="exclude"\][\s\S]*?\.teen-correction-boundary[\s\S]*?\.apostasy-correction-boundary[\s\S]*?display:\s*none\s*!important/,
    `${rel}: missing @media print exclusion rule for [data-print-policy="exclude"] and correction boundaries`
  );
  for (const selector of ['.h-article-card', '.series-card', '.teen-series-card', '.apostasy-series-card', '.genesis6-card', '.outline-card', '.related-articles__link']) {
    assert.ok(css.includes(selector), `${rel}: missing linked-card print atomicity selector ${selector}`);
  }
}

function walkHtml(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'pagefind') continue;
      walkHtml(full, out);
    } else if (entry.name === 'index.html') {
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

function combinedCss(htmlPath, html) {
  const parts = [];
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) parts.push(m[1]);
  for (const m of html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    parts.push(readDistStylesheet(htmlPath, m[1]));
  }
  for (const m of html.matchAll(/<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi)) {
    parts.push(readDistStylesheet(htmlPath, m[1]));
  }
  return parts.join('\n');
}

let teenBoundaries = 0;
let apostasyBoundaries = 0;
let cardBearingRoutesChecked = 0;

for (const htmlPath of walkHtml(DIST)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const route = '/' + path.relative(DIST, path.dirname(htmlPath)).split(path.sep).filter(Boolean).join('/') + '/';
  const normalizedRoute = route === '//' ? '/' : route;

  for (const m of html.matchAll(/<section\b[^>]*class=["'][^"']*\b(teen-correction-boundary|apostasy-correction-boundary)\b[^"']*["'][^>]*>/gi)) {
    assert.match(
      m[0],
      /\bdata-print-policy=["']exclude["']/i,
      `${normalizedRoute}: ${m[1]} missing data-print-policy="exclude"`
    );
    if (m[1] === 'teen-correction-boundary') teenBoundaries += 1;
    else apostasyBoundaries += 1;
  }

  if (/\bclass=["'][^"']*\b(?:h-article-card|series-card|teen-series-card|apostasy-series-card|genesis6-card|outline-card|related-articles__link|gb-series-link)\b/i.test(html)) {
    const css = combinedCss(htmlPath, html);
    assert.match(css, /break-inside:\s*avoid-page/, `${normalizedRoute}: linked-card route missing print break-inside: avoid-page CSS`);
    cardBearingRoutesChecked += 1;
  }
}

assert.equal(teenBoundaries, 7, `expected 7 teen-correction-boundary sections in dist/, got ${teenBoundaries}`);
assert.equal(apostasyBoundaries, 5, `expected 5 apostasy-correction-boundary sections in dist/, got ${apostasyBoundaries}`);
assert.ok(cardBearingRoutesChecked >= 12, `expected >= 12 card-bearing routes checked, got ${cardBearingRoutesChecked}`);

console.log(`✅ Print exclusion parity & linked-card atomicity contract passed (${teenBoundaries} Teen + ${apostasyBoundaries} Apostasy boundaries, ${cardBearingRoutesChecked} card-bearing routes)`);
