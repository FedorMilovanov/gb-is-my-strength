#!/usr/bin/env node
/**
 * dist-css-parity-audit.js — verify every public dist page carries project CSS.
 *
 * This gate exists because a regression (AGENTS-r229, 2026-06-18) shipped 41/50
 * dist pages with ZERO project CSS — Astro layouts never linked project CSS and
 * legacyShadow.ts dropped inline <style> blocks. No existing gate caught it
 * (all checked URL/title/word-count/SEO, never CSS linkage).
 *
 * Rule: every dist HTML page (excluding built-asset _app/) must have at least
 * one repository-local stylesheet link (including Astro /_astro/*.css output)
 * or an inline <style> block. If a page has NEITHER, it is unstyled → FAIL.
 *
 * Run: node scripts/dist-css-parity-audit.js  (after strangler:build)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PROJECT_ORIGIN = 'https://gospod-bog.ru';

// Pages excluded from CSS check (self-contained bundles with their own CSS).
const EXCLUDE_SUBSTRINGS = ['/_app/'];

function readAttribute(tag, name) {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = pattern.exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : '';
}

function localStylesheetPath(href) {
  const raw = String(href || '').trim();
  if (!raw) return '';

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (url.origin !== PROJECT_ORIGIN) return '';
      return url.pathname;
    } catch {
      return '';
    }
  }

  if (raw.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(raw)) return '';
  return raw.split(/[?#]/, 1)[0];
}

function hasLocalStylesheetLink(html) {
  const links = String(html || '').match(/<link\b[^>]*>/gi) || [];
  return links.some((tag) => {
    const rel = readAttribute(tag, 'rel').toLowerCase().split(/\s+/).filter(Boolean);
    if (!rel.includes('stylesheet')) return false;
    const stylesheetPath = localStylesheetPath(readAttribute(tag, 'href'));
    return /\.css$/i.test(stylesheetPath);
  });
}

function checkCss(html) {
  return hasLocalStylesheetLink(html) || /<style\b/i.test(html);
}

function runInternalContractChecks() {
  const accepted = [
    '<link rel="stylesheet" href="/css/site.css?v=1">',
    "<link href='../css/home.css#publication' rel='stylesheet'>",
    '<link href="/_astro/index.AbC123.css" rel="stylesheet">',
    '<link rel=stylesheet href=../../_astro/chunk.4f91.css>',
    '<link href="https://gospod-bog.ru/_astro/app.hash.css" rel="stylesheet">',
    '<style>.page{display:block}</style>',
  ];
  for (const html of accepted) {
    if (!checkCss(html)) throw new Error(`internal contract rejected valid project CSS: ${html}`);
  }

  const rejected = [
    '<link rel="preload" href="/_astro/app.hash.css">',
    '<link rel="stylesheet" href="https://cdn.example.com/_astro/app.hash.css">',
    '<link rel="stylesheet" href="//cdn.example.com/app.css">',
    '<link rel="stylesheet" href="/assets/app.js">',
    '<main>unstyled</main>',
  ];
  for (const html of rejected) {
    if (checkCss(html)) throw new Error(`internal contract admitted non-project CSS evidence: ${html}`);
  }
}

try {
  runInternalContractChecks();
} catch (error) {
  console.error(`❌ CSS parity validator internal contract failed: ${error.message}`);
  process.exit(2);
}

if (!fs.existsSync(DIST)) {
  console.error('❌ dist/ not found. Run npm run strangler:build first.');
  process.exit(1);
}

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
    console.log(`❌ ${rel}: NO project CSS (no local stylesheet link and no inline <style>)`);
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
