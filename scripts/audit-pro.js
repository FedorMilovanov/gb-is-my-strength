#!/usr/bin/env node
/**
 * gb-is-my-strength — Professional Audit System v1.0 (2026-05-17)
 *
 * Zero-dependency Node.js audit for gospod-bog.ru.
 * It complements existing scripts/validate.js and scripts/seo-audit.js.
 *
 * Focus:
 * - deploy-safety checks for GitHub Pages
 * - strict project structure from AGENTS.md
 * - cache-bust hash integrity
 * - source-shadow contracts; production breadth is delegated to mandatory registry/dist gates
 * - theological attribution guard: Фёдор = редактор, not "Автор"
 *
 * Usage:
 *   node scripts/audit-pro.js
 * CI:
 *   exit 1 if ERROR exists, exit 0 otherwise
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const gzip = require('zlib').gzipSync;
const vm = require('vm');
const { spawnSync } = require('child_process');
const { auditSitemapCoverage, contractProblems } = require('./lib/sitemap-route-contract');
const { buildPublicSurfaceRegistry } = require('./lib/public-surface-registry');
const { buildAuditProSourceCorpus } = require('./lib/audit-pro-source-corpus');

const ROOT = path.resolve(__dirname, '..');
const SITE_URL = 'https://gospod-bog.ru';
const SITE_NAME = 'Господь Бог — Сила Моя';
const REPORT_DIR = path.join(ROOT, 'audit');

const ALLOWED_CSS = new Set([
  'css/site.css',
  'css/home.css',
  'css/command-palette.css',
  'css/mobile-hotfix.css',
  'css/floating-cluster.css',
  'css/enhancements-runtime.css',
  'css/highlights-runtime.css',
  'css/sw-toast.css',
  'css/nagornaya-mobile-toc.css',
  'css/series-samizdat.css',
  'css/reader-preferences.css',
  'css/tts-download-notice.css'
]);

const REQUIRED_EXTRA_CSS = new Set([
  'fonts/fonts.css',
  'nagornaya/tw.min.css'
]);

const ALLOWED_JS = new Set([
  'js/site.js',
  'js/site-utils.js',
  'js/scroll-perf.js',
  'js/search.js',
  'js/enhancements.js',
  'js/highlights.js',
  'js/glossary.js',
  'js/bookmark-engine.js',
  'js/nagornaya-mobile-toc.js',
  'js/nagornaya-bar-extras.js',
  'js/sw-register.js',
  'js/floating-cluster-controller.js',
  'js/reader-preferences-head.js',
  'js/reader-preferences.js',
  'js/reader-state.js',
  'js/print-pagination.js',
  'js/vosk-tts-core.js',
  'js/vosk-tts-engine.js',
  'js/vosk-stress-lookup.js',
]);

// Same list as scripts/cache-bust.js. If cache-bust.js changes, update this list too.
// P1-9 FIX: synced with cache-bust.js ASSETS — single source of truth
// Shared asset list — single source of truth (see scripts/cache-bust-assets.js)
let CACHE_BUST_ASSETS;
try { CACHE_BUST_ASSETS = require('./cache-bust-assets').ASSETS; }
catch (e) {
  console.error('FATAL: scripts/cache-bust-assets.js unreadable (' + e.message + ') — audit-pro cannot run without the canonical asset list.');
  process.exit(1);
}

const MAX_CSS_TOTAL = 425_000; // global core CSS budget; route-scoped/pilot CSS is reported separately
const MAX_JS_TOTAL = 365_000; // includes sw.js + mobile utils; site.js is intentionally large right now
const MAX_HTML = 450_000;
// Anti-regression ceiling for !important in css/site.css. AGENTS §4.10 target is ≤200.
// Ratchet: this number must only ever go DOWN. Current value reflects the safe post-dove state.
// Hard-fail above CEIL; warn when above the long-term GOAL so we keep paying down the debt.
const IMPORTANT_CEIL = 200; // hard ratchet at current safe baseline (200 after portrait-img fix); raising this is a regression
const IMPORTANT_GOAL = 200; // AGENTS §4.10 long-term target
const MIN_DESC = 50;
const MAX_DESC = 180;

// `_legacy` directories under src/components/** carry raw HTML fragments that
// are inlined into Astro components for byte-identical native-shadow pilots
// (РЕФАКТОРИНГ 5.0 Phase 6). They are not standalone publishable pages, so
// audit-pro skips them — pixel parity for the rendered route is guarded by
// scripts/visual-parity-screenshots.js instead.
const skipDirs = new Set(['.git', 'node_modules', 'pagefind', 'audit', '_app', '_build-tools', 'reports', 'dist', 'out', 'build', '.astro', '_legacy']);

const R = {
  errors: [],
  warnings: [],
  passed: [],
  info: [],
  start: Date.now(),
  err(msg) { this.errors.push(msg); },
  warn(msg) { this.warnings.push(msg); },
  ok(msg) { this.passed.push(msg); },
  note(msg) { this.info.push(msg); }
};

function rel(p) { return path.relative(ROOT, p).replace(/\\/g, '/'); }
function exists(relPath) { return fs.existsSync(path.join(ROOT, relPath.replace(/^\//, ''))); }
function read(relPath) { return fs.readFileSync(path.join(ROOT, relPath), 'utf8'); }
function bytes(relPath) { return fs.statSync(path.join(ROOT, relPath)).size; }
function md5short(relPath) {
  return crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, relPath))).digest('hex').slice(0, 8);
}
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const allFiles = walk(ROOT);
const allHtmlFiles = allFiles.filter(p => p.endsWith('.html') && !/[\\/]scripts[\\/]/.test(p)).sort();
const surfaceRegistry = buildPublicSurfaceRegistry();
for (const error of surfaceRegistry.errors) R.err(`Public surface registry: ${error}`);
const sourceCorpus = buildAuditProSourceCorpus({
  root: ROOT,
  entries: surfaceRegistry.entries,
  allHtmlFiles,
});
const htmlFiles = sourceCorpus.sourcePages.map((item) => item.file).sort();
const htmlPages = htmlFiles;

if (sourceCorpus.duplicateRootMappings.length) {
  for (const item of sourceCorpus.duplicateRootMappings) {
    R.err(`Duplicate route-to-root mapping: ${item.routes.join(' + ')} -> ${rel(item.file)}`);
  }
}
if (sourceCorpus.unregisteredRootHtml.length) {
  R.err(`Unregistered root HTML outside the canonical route registry:\n  - ${sourceCorpus.unregisteredRootHtml.map((item) => item.relative).join('\n  - ')}`);
} else {
  R.ok(`Source HTML corpus is registry-owned (${htmlPages.length} committed production shadows)`);
}
R.note(`Production HTML corpus: ${sourceCorpus.productionRoutes} routes = ${htmlPages.length} committed source shadows + ${sourceCorpus.distOnly.length} dist-only routes delegated to mandatory production contracts`);
if (sourceCorpus.registeredNonProduction.length) {
  R.note(`Registered non-production root HTML excluded from public source checks: ${sourceCorpus.registeredNonProduction.map((item) => item.route).join(', ')}`);
}


function getMeta(html, attr, name) {
  const re1 = new RegExp(`<meta\\s+[^>]*${attr}=["']${escapeRe(name)}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i');
  const re2 = new RegExp(`<meta\\s+[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${escapeRe(name)}["'][^>]*>`, 'i');
  return html.match(re1)?.[1] ?? html.match(re2)?.[1] ?? '';
}

function getLink(html, relName) {
  const re1 = new RegExp(`<link\\s+[^>]*rel=["'][^"']*${escapeRe(relName)}[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>`, 'i');
  const re2 = new RegExp(`<link\\s+[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*${escapeRe(relName)}[^"']*["'][^>]*>`, 'i');
  return html.match(re1)?.[1] ?? html.match(re2)?.[1] ?? '';
}

function stripQuery(u) { return decodeURIComponent(String(u).split('#')[0].split('?')[0]); }
function isExternal(u) { return /^(https?:)?\/\//i.test(u) || /^(mailto|tel|javascript|data):/i.test(u); }
function resolveLocal(fromFile, url) {
  const clean = stripQuery(url);
  if (!clean || clean.startsWith('#')) return null;
  if (isExternal(clean)) {
    if (clean.startsWith(SITE_URL + '/')) return path.join(ROOT, clean.slice(SITE_URL.length + 1));
    return null;
  }
  if (clean.startsWith('/')) return path.join(ROOT, clean.slice(1));
  return path.resolve(path.dirname(fromFile), clean);
}
function localTargetExists(abs) {
  if (!abs) return true;
  if (fs.existsSync(abs)) return true;
  if (fs.existsSync(path.join(abs, 'index.html'))) return true;
  if (!path.extname(abs) && fs.existsSync(abs + '.html')) return true;
  if (fs.existsSync(path.join(ROOT, 'src/pages', path.relative(ROOT, abs), 'index.astro'))) return true;
  return false;
}
function jsonLdBlocks(html) {
  return [...html.matchAll(/<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1].trim());
}
function rootsFromLd(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data['@graph'])) return data['@graph'];
  return data ? [data] : [];
}
function extractSiteConfig(html, fileLabel) {
  const sandbox = {
    window: {},
    localStorage: { getItem() { return null; }, setItem() {} },
    document: { documentElement: { classList: { add() {} } } },
    matchMedia() { return { matches: false }; },
    console: { warn() {}, log() {}, error() {} }
  };
  sandbox.window = sandbox;
  sandbox.window.matchMedia = sandbox.matchMedia;
  vm.createContext(sandbox);

  let found = false;
  let idx = 0;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    idx += 1;
    const attrs = match[1] || '';
    const code = match[2] || '';
    if (/\bsrc\s*=\s*/i.test(attrs)) continue;
    if (/type\s*=\s*["']application\/(ld\+json|json)["']/i.test(attrs)) continue;
    if (!code.includes('window.SITE_CONFIG')) continue;
    found = true;
    try {
      new vm.Script(code, { filename: `${fileLabel}#site-config-${idx}` }).runInContext(sandbox, { timeout: 1000 });
    } catch (e) {
      R.err(`SITE_CONFIG runtime parse failed: ${fileLabel} (#${idx}) — ${e.message}`);
      return null;
    }
  }

  return found ? (sandbox.window.SITE_CONFIG || null) : null;
}

// 1. Structure guard
// ... remainder unchanged ...
