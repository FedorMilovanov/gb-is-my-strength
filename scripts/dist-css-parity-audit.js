#!/usr/bin/env node
/**
 * dist-css-parity-audit.js — verify every public dist page carries project CSS.
 *
 * This gate exists because a regression (AGENTS-r229, 2026-06-18) shipped 41/50
 * dist pages with ZERO project CSS — Astro layouts never linked css/site.css or
 * fonts/fonts.css, and legacyShadow.ts dropped inline <style> blocks. No existing
 * gate caught it (all checked URL/title/word-count/SEO, never CSS linkage).
 *
 * Rule: every dist HTML page (excluding built-asset _app/) must have at least
 * one of: a <link> to site.css/home.css, OR an inline <style> block. If a page
 * has NEITHER, it is unstyled → FAIL.
 *
 * Run: node scripts/dist-css-parity-audit.js  (after strangler:build)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

if (!fs.existsSync(DIST)) {
  console.error('❌ dist/ not found. Run npm run strangler:build first.');
  process.exit(1);
}

// Pages excluded from CSS check (self-contained bundles with their own CSS).
const EXCLUDE_SUBSTRINGS = ['/_app/'];

const problems = [];

function collectHtml(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectHtml(full, acc);
    } else if (entry.name === 'index.html') {
      acc.push(full);
    }
  }
  return acc;
}

function checkCss(html) {
  const hasSiteCss = /css\/(site|home)\.css/.test(html);
  const hasInlineStyle = /<style\b/i.test(html);
  return hasSiteCss || hasInlineStyle;
}

const pages = collectHtml(DIST).filter(p =>
  !EXCLUDE_SUBSTRINGS.some(s => p.includes(s))
);

let checked = 0;
let okCount = 0;

for (const page of pages) {
  checked++;
  const html = fs.readFileSync(page, 'utf8');
  const rel = path.relative(DIST, page).replace(/\\/g, '/');

  if (checkCss(html)) {
    okCount++;
  } else {
    problems.push(rel);
    console.log(`❌ ${rel}: NO project CSS (no site.css/home.css link and no inline <style>)`);
  }
}

console.log('');
if (problems.length === 0) {
  console.log(`✅ CSS parity audit passed: ${okCount}/${checked} pages carry project CSS.`);
  process.exit(0);
} else {
  console.log(`❌ CSS parity audit FAILED: ${problems.length}/${checked} pages are unstyled.`);
  process.exit(1);
}
