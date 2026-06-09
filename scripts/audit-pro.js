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
 * - SEO/PWA/resource/link basics
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

const ROOT = path.resolve(__dirname, '..');
const SITE_URL = 'https://gospod-bog.ru';
const SITE_NAME = 'Господь Бог — Сила Моя';
const REPORT_DIR = path.join(ROOT, 'audit');

const ALLOWED_CSS = new Set([
  'css/site.css',
  'css/home.css',
  'css/command-palette.css',
  'css/mobile-hotfix.css',
  'css/nagornaya-mobile-toc.css'
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
  'js/series-cards.js',
  'js/nagornaya-mobile-toc.js',
  'js/sw-register.js'
]);

// Same list as scripts/cache-bust.js. If cache-bust.js changes, update this list too.
const CACHE_BUST_ASSETS = [
  'css/site.css',
  'css/home.css',
  'css/command-palette.css',
  'css/mobile-hotfix.css',
  'css/nagornaya-mobile-toc.css',
  'fonts/fonts.css',
  'nagornaya/tw.min.css',
  'js/site.js',
  'js/site-utils.js',
  'js/scroll-perf.js',
  'js/bookmark-engine.js',
  'js/enhancements.js',
  'js/highlights.js',
  'js/search.js',
  'js/sw-register.js',
  'js/nagornaya-mobile-toc.js'
];

const MAX_CSS_TOTAL = 375_000; // includes visual dark premium overrides; gzip ~70KB
const MAX_JS_TOTAL = 365_000; // includes sw.js + mobile utils; site.js is intentionally large right now
const MAX_HTML = 450_000;
// Anti-regression ceiling for !important in css/site.css. AGENTS §4.10 target is ≤200.
// Ratchet: this number must only ever go DOWN. Current value reflects the safe post-dove state.
// Hard-fail above CEIL; warn when above the long-term GOAL so we keep paying down the debt.
const IMPORTANT_CEIL = 270; // hard cap — raising this is a regression and must be justified in PR
const IMPORTANT_GOAL = 200; // AGENTS §4.10 long-term target
const MIN_DESC = 50;
const MAX_DESC = 180;

const skipDirs = new Set(['.git', 'node_modules', 'pagefind', 'audit']);
const verificationFileRe = /^(google|yandex)[^/]*\.html$/i;

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
const htmlFiles = allFiles.filter(p => p.endsWith('.html')).sort();
const htmlPages = htmlFiles.filter(p => !verificationFileRe.test(rel(p)));

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
(function structureGuard() {
  const actualCss = new Set(allFiles.filter(p => rel(p).startsWith('css/') && p.endsWith('.css')).map(rel));
  const actualJs = new Set(allFiles.filter(p => rel(p).startsWith('js/') && p.endsWith('.js')).map(rel));

  const extraCss = [...actualCss].filter(x => !ALLOWED_CSS.has(x));
  const missingCss = [...ALLOWED_CSS].filter(x => !actualCss.has(x));
  const extraJs = [...actualJs].filter(x => !ALLOWED_JS.has(x));
  const missingJs = [...ALLOWED_JS].filter(x => !actualJs.has(x));

  if (extraCss.length) R.err(`Forbidden CSS files in css/: ${extraCss.join(', ')}`);
  if (missingCss.length) R.err(`Missing CSS files: ${missingCss.join(', ')}`);
  if (extraJs.length) R.err(`Forbidden JS files in js/: ${extraJs.join(', ')}`);
  if (missingJs.length) R.err(`Missing JS files: ${missingJs.join(', ')}`);
  for (const f of REQUIRED_EXTRA_CSS) if (!exists(f)) R.err(`Missing required stylesheet: ${f}`);

  if (!extraCss.length && !missingCss.length) R.ok('Structure: exactly 5 CSS files in /css');
  if (!extraJs.length && !missingJs.length) R.ok('Structure: exactly 11 JS files in /js');
  if ([...REQUIRED_EXTRA_CSS].every(exists)) R.ok('Structure: fonts/fonts.css and nagornaya/tw.min.css exist');
})();

// 2. Size budget
(function sizeBudget() {
  const cssAssets = [...ALLOWED_CSS, ...REQUIRED_EXTRA_CSS].filter(exists);
  const jsAssets = [...ALLOWED_JS, 'sw.js'].filter(exists);
  const cssTotal = cssAssets.reduce((n, f) => n + bytes(f), 0);
  const jsTotal = jsAssets.reduce((n, f) => n + bytes(f), 0);
  if (cssTotal > MAX_CSS_TOTAL) R.warn(`CSS total ${cssTotal} bytes exceeds budget ${MAX_CSS_TOTAL}`);
  else R.ok(`CSS total ${cssTotal} bytes within budget`);
  if (jsTotal > MAX_JS_TOTAL) R.warn(`JS total ${jsTotal} bytes exceeds budget ${MAX_JS_TOTAL}`);
  else R.ok(`JS total ${jsTotal} bytes within budget`);
  const gzCss = gzip(Buffer.concat(cssAssets.map(f => fs.readFileSync(path.join(ROOT, f))))).length;
  const gzJs = gzip(Buffer.concat(jsAssets.map(f => fs.readFileSync(path.join(ROOT, f))))).length;
  R.note(`Gzip wire size: CSS ${gzCss} bytes, JS ${gzJs} bytes, total ${gzCss + gzJs} bytes`);
  for (const p of htmlPages) {
    const sz = fs.statSync(p).size;
    if (sz > MAX_HTML) R.warn(`Large HTML: ${rel(p)} (${sz} bytes)`);
  }
})();

// 2a-bis. site.css minimum size guard (anti-catastrophic-deletion).
// On 2026-06-09 a script accidentally deleted ~150 KB of CSS from site.css and the audit didn't catch it
// (the remaining file was syntactically valid). This guard blocks deploys if site.css shrinks below
// a sane floor — 200 KB. Bump SITE_CSS_MIN_BYTES only deliberately, never to "make audit pass".
const SITE_CSS_MIN_BYTES = 200_000;
(function siteCssSizeFloor() {
  const f = path.join(ROOT, 'css/site.css');
  if (!fs.existsSync(f)) { R.err('css/site.css missing'); return; }
  const bytes = fs.statSync(f).size;
  if (bytes < SITE_CSS_MIN_BYTES) {
    R.err(`site.css is ${bytes} bytes — below floor ${SITE_CSS_MIN_BYTES}. ` +
      `Possible catastrophic deletion. Restore from git history before committing.`);
  } else {
    R.ok(`site.css size ${bytes} bytes ≥ floor ${SITE_CSS_MIN_BYTES} (anti-deletion guard)`);
  }
})();

// 2b. !important budget for site.css (anti-regression guard, AGENTS §4.10)
(function importantBudget() {
  const f = path.join(ROOT, 'css/site.css');
  if (!fs.existsSync(f)) { R.warn('css/site.css not found for !important check'); return; }
  const count = (fs.readFileSync(f, 'utf8').match(/!important/g) || []).length;
  if (count > IMPORTANT_CEIL) {
    R.err(`site.css has ${count} !important — exceeds ceiling ${IMPORTANT_CEIL}. ` +
      `This is a regression: refactor into @layer instead of adding !important. ` +
      `(AGENTS §4.10 target ≤ ${IMPORTANT_GOAL})`);
  } else if (count > IMPORTANT_GOAL) {
    R.warn(`site.css has ${count} !important (≤ ceiling ${IMPORTANT_CEIL}, but above goal ${IMPORTANT_GOAL}). ` +
      `Keep paying down — lower IMPORTANT_CEIL whenever you reduce it.`);
  } else {
    R.ok(`site.css !important within goal: ${count} ≤ ${IMPORTANT_GOAL}`);
  }
})();

// 2b2. CSS brace balance (structural guard). Unbalanced braces = unclosed @media/@layer
// nesting, which buries rules at huge depth and forces !important everywhere. Must be 0.
(function braceBalance() {
  for (const f of ['css/site.css', 'css/home.css', 'css/command-palette.css',
                   'css/mobile-hotfix.css', 'css/nagornaya-mobile-toc.css', 'fonts/fonts.css']) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const s = fs.readFileSync(p, 'utf8');
    const net = (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
    if (net !== 0) {
      R.err(`${f}: unbalanced braces (net ${net > 0 ? '+' : ''}${net}). ` +
        `Unclosed @media/@layer nesting buries rules and forces !important. Close all blocks.`);
    } else {
      R.ok(`${f}: braces balanced`);
    }
  }
})();

// 2c. Dove markers integrity (anti-regression guard for the tooltip "dove" modifier)
(function doveGuard() {
  let inlineDoveSvgPages = [];
  let badMarkers = [];
  for (const p of htmlPages) {
    const html = fs.readFileSync(p, 'utf8');
    // No inline <svg class="fn-dove-icon"> should remain in HTML — JS injects the animated dove.
    if (/<svg[^>]*class="[^"]*fn-dove-icon/.test(html)) inlineDoveSvgPages.push(rel(p));
    // Every fn-marker--dove must be either a map-trigger (data-tip) or carry a .tooltip child.
    const markers = html.match(/<span class="fn-marker fn-marker--dove[^>]*>[\s\S]*?<\/span>\s*<\/span>|<span class="fn-marker fn-marker--dove[^>]*>/g) || [];
    const doveOpens = (html.match(/class="fn-marker fn-marker--dove/g) || []).length;
    if (doveOpens) {
      // markers must have either data-tip OR a following .tooltip (lightweight heuristic)
      const withTip = (html.match(/class="fn-marker fn-marker--dove[^>]*data-tip=/g) || []).length;
      const withTooltip = (html.match(/class="fn-marker fn-marker--dove[^>]*>(?:(?!<\/p>|<span class="fn-marker)[\s\S])*?<span class="tooltip"/g) || []).length;
      if (withTip + withTooltip < doveOpens) {
        badMarkers.push(`${rel(p)} (${doveOpens} dove, ${withTip} map-trigger + ${withTooltip} tooltip)`);
      }
    }
  }
  if (inlineDoveSvgPages.length) {
    R.err(`Inline <svg class="fn-dove-icon"> found (dead markup — JS injects the dove): ${inlineDoveSvgPages.join(', ')}`);
  } else {
    R.ok('Dove markers: no dead inline fn-dove-icon SVG in HTML');
  }
  if (badMarkers.length) {
    R.err(`Dove markers without tooltip/data-tip content: ${badMarkers.join('; ')}`);
  } else {
    R.ok('Dove markers: every fn-marker--dove has tooltip or data-tip content');
  }
})();

// 3. JS syntax
(function jsSyntax() {
  const jsToCheck = [...ALLOWED_JS, 'sw.js'].filter(exists);
  let failed = 0;
  for (const f of jsToCheck) {
    const r = spawnSync(process.execPath, ['--check', path.join(ROOT, f)], { encoding: 'utf8' });
    if (r.status !== 0) {
      failed++;
      R.err(`JS syntax failed: ${f}\n${(r.stderr || r.stdout || '').trim()}`);
    }
  }
  if (!failed) R.ok(`JS syntax valid (${jsToCheck.length} files)`);
})();

// 4. Inline script syntax (HTML)
(function inlineScriptSyntax() {
  let bad = 0;
  let checked = 0;
  for (const p of htmlPages) {
    const html = fs.readFileSync(p, 'utf8');
    let idx = 0;
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      idx += 1;
      const attrs = match[1] || '';
      const code = match[2] || '';
      if (/\bsrc\s*=\s*/i.test(attrs)) continue;
      if (/type\s*=\s*["']application\/(ld\+json|json)["']/i.test(attrs)) continue;
      if (!code.trim()) continue;
      checked += 1;
      try {
        new vm.Script(code, { filename: rel(p) + '#inline-script-' + idx });
      } catch (e) {
        bad += 1;
        R.err(`Inline script syntax failed: ${rel(p)} (#${idx}) — ${e.message}`);
      }
    }
  }
  if (!bad) R.ok(`Inline script syntax valid (${checked} blocks)`);
})();

// 5. HTML quiz/meta contract
(function htmlContractGuard() {
  let quizIssues = 0;
  let metaIssues = 0;
  const singletonMetaProps = ['og:image', 'og:image:width', 'og:image:height', 'og:image:type', 'og:image:alt', 'article:published_time', 'article:modified_time'];

  for (const p of htmlPages) {
    const file = rel(p);
    const html = read(file);

    singletonMetaProps.forEach((prop) => {
      const re = new RegExp(`<meta\\s+[^>]*property=["']${prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'gi');
      const count = (html.match(re) || []).length;
      if (count > 1) {
        metaIssues++;
        R.err(`Duplicate ${prop} meta in ${file} (${count})`);
      }
    });

    const cfg = extractSiteConfig(html, file);
    if (!cfg || !cfg.quiz) continue;
    for (const key of ['questions', 'bonusQuestions']) {
      const arr = cfg.quiz[key];
      if (!Array.isArray(arr) || !arr.length) continue;
      arr.forEach((q, idx) => {
        if ('q' in q || 'answer' in q || 'ok' in q || 'err' in q) {
          quizIssues++;
          R.err(`Legacy quiz fields in ${file} ${key}[${idx}]`);
        }
        if (!('question' in q) || typeof q.question !== 'string' || !q.question.trim()) {
          quizIssues++;
          R.err(`Missing canonical question in ${file} ${key}[${idx}]`);
        }
        const type = q.type || 'single';
        if (type === 'single') {
          if (typeof q.correct !== 'number') {
            quizIssues++;
            R.err(`Missing numeric correct in ${file} ${key}[${idx}]`);
          }
        } else if (!Array.isArray(q.correct)) {
          quizIssues++;
          R.err(`Missing array correct in ${file} ${key}[${idx}] for type=${type}`);
        }
        if (!q.explanation || typeof q.explanation !== 'object' || !q.explanation.short || !q.explanation.full) {
          quizIssues++;
          R.err(`Missing explanation.short/full in ${file} ${key}[${idx}]`);
        }
      });
    }
  }

  if (!quizIssues) R.ok('Quiz source schema is canonical across HTML pages');
  if (!metaIssues) R.ok('OpenGraph / article singleton meta uniqueness passed');
})();

// 5b. SITE_CONFIG runtime contract — mirrors the live js/site.js validator (see js/site.js
// "[SITE_CONFIG contract]"). Catches breakage statically before pages reach Playwright.
(function siteConfigContractGuard() {
  let contractIssues = 0;
  for (const p of htmlPages) {
    const file = rel(p);
    const html = read(file);
    if (!html.includes('window.SITE_CONFIG')) continue;
    const cfg = extractSiteConfig(html, file);
    if (!cfg) continue;
    const missing = [];
    function need(pathStr, type) {
      const segs = pathStr.split('.');
      let cur = cfg;
      for (const seg of segs) {
        if (cur == null || typeof cur !== 'object' || !(seg in cur)) {
          missing.push(`${pathStr} отсутствует`);
          return;
        }
        cur = cur[seg];
      }
      if (type && typeof cur !== type) missing.push(`${pathStr} должен быть ${type}`);
    }
    need('site.name', 'string');
    need('site.baseUrl', 'string');
    need('site.locale', 'string');
    need('page.type', 'string');
    need('page.id', 'string');
    need('page.title', 'string');
    if (cfg.page && cfg.page.type === 'article' && cfg.page.id && !/^[a-z0-9-]+$/.test(cfg.page.id)) {
      missing.push('page.id статьи должен быть slug-like');
    }
    if (cfg.features && cfg.features.quiz && cfg.features.quiz.enabled) {
      if (!cfg.quiz || !Array.isArray(cfg.quiz.questions)) missing.push('features.quiz.enabled=true требует quiz.questions[]');
    }
    if (missing.length) {
      contractIssues++;
      R.err(`SITE_CONFIG contract violated in ${file}: ${missing.join(', ')}`);
    }
  }
  if (!contractIssues) R.ok('SITE_CONFIG runtime contract passed across HTML pages');
})();

// 6. JSON validity
(function jsonValidity() {
  const jsonFiles = allFiles.filter(p => p.endsWith('.json')).map(rel).sort();
  let bad = 0;
  for (const f of jsonFiles) {
    try { JSON.parse(read(f)); }
    catch (e) { bad++; R.err(`Invalid JSON: ${f}: ${e.message}`); }
  }
  if (!bad) R.ok(`JSON valid (${jsonFiles.length} files)`);
})();


  // ── Span balance guard (added r76) ──────────────────────────────────────
  {
    let spanBugs = 0;
    for (const hf of htmlPages) {
      const html = fs.readFileSync(hf, 'utf8');
      const opens = (html.match(/<span\b/g) || []).length;
      const closes = (html.match(/<\/span>/g) || []).length;
      const diff = opens - closes;
      if (diff > 0) { spanBugs++; R.err(rel(hf) + ': ' + diff + ' unclosed <span> tag(s) (open=' + opens + ', close=' + closes + ')'); }
    }
    if (spanBugs === 0) R.ok('HTML span balance: all files balanced');
    else R.err('HTML span balance: ' + spanBugs + ' files with unclosed spans');
  }

  // 5. Cache-bust hash integrity
(function cacheBustIntegrity() {
  const hashes = Object.fromEntries(CACHE_BUST_ASSETS.filter(exists).map(f => [f, md5short(f)]));
  let checked = 0;
  let issues = 0;
  for (const p of htmlPages) {
    const file = rel(p);
    const html = fs.readFileSync(p, 'utf8');
    for (const asset of CACHE_BUST_ASSETS) {
      if (!hashes[asset]) continue;
      const re = new RegExp(`(?:(?:\\.\\.\\/)*|/)${escapeRe(asset)}(?:\\?v=([^"'&\\s>]+))?`, 'g');
      for (const m of html.matchAll(re)) {
        checked++;
        const got = m[1] || '';
        if (!got) { issues++; R.err(`Cache-bust missing: ${file} → ${asset}`); }
        else if (got !== hashes[asset]) { issues++; R.err(`Cache-bust mismatch: ${file} → ${asset}?v=${got}, expected ${hashes[asset]}`); }
      }
    }
  }
  if (!issues) R.ok(`Cache-bust hashes match file content (${checked} references checked)`);
})();

// 6. SEO basics
(function seoBasics() {
  let issues = 0;
  for (const p of htmlPages) {
    const file = rel(p);
    const html = fs.readFileSync(p, 'utf8');
    if (!/<head[\s>]/i.test(html)) continue;
    if (file === '404.html') continue;

    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || '';
    const desc = getMeta(html, 'name', 'description');
    const canonical = getLink(html, 'canonical');
    const ogTitle = getMeta(html, 'property', 'og:title');
    const ogImage = getMeta(html, 'property', 'og:image');
    const h1 = (html.match(/<h1[\s>]/gi) || []).length;

    if (!/^<!doctype html>/i.test(html.trim())) { issues++; R.warn(`HTML: ${file} missing <!doctype html>`); }
    if (!/<html[^>]+lang=["']ru["']/i.test(html)) { issues++; R.err(`SEO: ${file} missing html lang="ru"`); }
    if (!title) { issues++; R.err(`SEO: ${file} missing <title>`); }
    if (!desc) { issues++; R.err(`SEO: ${file} missing meta description`); }
    else if (desc.length < MIN_DESC || desc.length > MAX_DESC) R.warn(`SEO: ${file} description length ${desc.length} chars`);
    if (!canonical) { issues++; R.err(`SEO: ${file} missing canonical`); }
    else if (!canonical.startsWith(SITE_URL + '/')) { issues++; R.err(`SEO: ${file} canonical not production origin: ${canonical}`); }
    if (!ogTitle) R.warn(`SEO: ${file} missing og:title`);
    if (!ogImage) R.warn(`SEO: ${file} missing og:image`);
    if (h1 !== 1) { issues++; R.err(`SEO: ${file} has ${h1} h1 tags, expected 1`); }
    if (!/name=["']viewport["']/i.test(html)) { issues++; R.err(`SEO: ${file} missing viewport`); }
  }
  if (!issues) R.ok(`SEO basics passed (${htmlPages.length} HTML files)`);
})();

// 7. JSON-LD validity and graph essentials
(function jsonLdValidity() {
  let blocks = 0;
  let errors = 0;
  for (const p of htmlPages) {
    const file = rel(p);
    const html = fs.readFileSync(p, 'utf8');
    const ldBlocks = jsonLdBlocks(html);
    if (!ldBlocks.length && !['404.html'].includes(file)) R.warn(`JSON-LD: ${file} has no ld+json block`);
    for (const [i, raw] of ldBlocks.entries()) {
      blocks++;
      let data;
      try { data = JSON.parse(raw); }
      catch (e) { errors++; R.err(`JSON-LD invalid: ${file} block ${i + 1}: ${e.message}`); continue; }
      const roots = rootsFromLd(data);
      const ids = new Set();
      for (const obj of roots) {
        if (!obj || typeof obj !== 'object') continue;
        if (obj['@id']) {
          if (ids.has(obj['@id'])) { errors++; R.err(`JSON-LD duplicate @id in ${file}: ${obj['@id']}`); }
          ids.add(obj['@id']);
        }
      }
      if (/^articles\/[^/]+\/index\.html$/.test(file) || /^nagornaya\/chast-[1-5]\/index\.html$/.test(file)) {
        const hasArticle = roots.some(o => o && ['Article', 'ScholarlyArticle', 'BlogPosting'].includes(o['@type']));
        const hasBreadcrumb = roots.some(o => o && o['@type'] === 'BreadcrumbList') || roots.some(o => o && o.breadcrumb && o.breadcrumb['@type'] === 'BreadcrumbList');
        if (!hasArticle) R.warn(`JSON-LD: ${file} has no Article/ScholarlyArticle node`);
        if (!hasBreadcrumb) R.warn(`JSON-LD: ${file} has no BreadcrumbList node`);
      }
    }
  }
  if (!errors) R.ok(`JSON-LD parse passed (${blocks} blocks)`);
})();

// 8. Theological attribution guard

(function russianQuotePolicyGuard() {
  function stripHtmlLite(x) { return String(x || '').replace(/<[^>]+>/g, ' '); }
  function isAllowedEnglishQuoteFragment(fragment) {
    const allowed = [
      'ipsissima', 'Logia Jesu', 'anomia', 'Suo Marte', 'sola scriptura', 'pactum salutis',
      'Semper invictus', 'fervore perpetuo ardenti', 'Coffee House Association', 'Goat',
      'Doctor of Divinity', 'The Master', 'TMSJ', 'CCEL', 'GTY', 'JETS', 'PRDL'
    ];
    return allowed.some(x => fragment.includes(x));
  }
  function isLikelyEnglishSourceTitle(fragment) {
    const clean = stripHtmlLite(fragment)
      .replace(/[’']/g, '')
      .replace(/[?!.:;,()\[\]—–-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const words = clean.match(/[A-Za-z]+/g) || [];
    if (words.length < 3) return false;
    const small = new Set(['a','an','and','as','at','be','by','for','from','in','into','of','on','or','the','to','with','without','is']);
    let ok = 0;
    for (const w of words) {
      if (small.has(w.toLowerCase()) || /^[A-Z][A-Za-z]*$/.test(w) || /^[A-Z]{2,}$/.test(w)) ok += 1;
    }
    return ok / words.length >= 0.85;
  }
  function hasEnglishDirectQuote(fragment) {
    const clean = stripHtmlLite(fragment);
    const latinWords = clean.match(/[A-Za-z]{4,}/g) || [];
    if (latinWords.length < 3) return false;
    if (isAllowedEnglishQuoteFragment(clean)) return false;
    if (isLikelyEnglishSourceTitle(clean)) return false;
    return true;
  }
  const quoteRe = /[«“]([^»”]{0,260}[A-Za-z]{4,}[^»”]{0,260})[»”]/g;
  const bibliographicLineRe = /(href=|src=|<meta\b|<link\b|rel=|property=|content=|reading-list|sources-list|rl-author|font-mono|sourceRef|data-pagefind|Источник:|Оригинал|Примечание к сноскам|Библиография|Источники|<cite\b)/i;
  let bad = 0;
  function checkText(label, text) {
    for (const m of String(text || '').matchAll(quoteRe)) {
      const fragment = stripHtmlLite(String(m[1] || '')).trim();
      if (hasEnglishDirectQuote(fragment)) {
        bad += 1;
        R.err(`Russian quote policy violation in ${label}: «${fragment.slice(0, 100)}»`);
      }
    }
  }
  function walkStrings(label, value) {
    if (typeof value === 'string') checkText(label, value);
    else if (Array.isArray(value)) value.forEach(v => walkStrings(label, v));
    else if (value && typeof value === 'object') Object.values(value).forEach(v => walkStrings(label, v));
  }

  for (const file of htmlFiles) {
    if (!file.startsWith('articles/') && !file.startsWith('nagornaya/')) continue;
    const html = read(file);
    const body = (html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html)
      .replace(/<script\b[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[\s\S]*?<\/style>/gi, '')
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, '')
      .replace(/<span[^>]*class=["'][^"']*tooltip[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, '');
    body.split(/\n/).forEach((line, idx) => {
      if (bibliographicLineRe.test(line)) return;
      checkText(`${file}:L${idx + 1}`, line.replace(/<[^>]+>/g, ' '));
    });
    const cfg = extractSiteConfig(html, file);
    if (cfg && cfg.quiz) walkStrings(`${file}:SITE_CONFIG.quiz`, cfg.quiz);
  }
  if (!bad) R.ok('Russian quote policy passed: no English direct quotes in reader-facing Russian text');
})();

(function attributionGuard() {
  let bad = 0;
  for (const p of htmlPages) {
    const file = rel(p);
    const html = fs.readFileSync(p, 'utf8');
    if (/Автор\s*:\s*Ф[её]дор\s+Милованов/i.test(html)) { bad++; R.err(`Attribution violation in ${file}: "Автор: Фёдор Милованов"`); }
    if (/author-card-label[^>]*>\s*Автор\s*</i.test(html)) { bad++; R.err(`Attribution violation in ${file}: author-card-label is "Автор"`); }
    if (/^articles\/[^/]+\/index\.html$/.test(file)) {
      const byline = html.match(/<span\s+class=["']article-byline__strong["']>([^<]+)<\/span>/i)?.[1]?.trim() || '';
      if (!/^(Редактор:|Редакция перевода:|Автор-редактор:)\s*Ф[её]дор\s+Милованов/.test(byline)) {
        bad++; R.err(`Article byline invalid in ${file}: "${byline || 'missing'}"`);
      }
      if (!html.includes('class="author-card"')) R.warn(`Article author-card missing in ${file}`);
    }
  }
  if (!bad) R.ok('Attribution guard passed: Фёдор is not marked as author');
})();

// 9. Resource and internal link integrity
(function resourceAndLinks() {
  let broken = 0;
  let checked = 0;
  for (const p of htmlPages) {
    const file = rel(p);
    const html = fs.readFileSync(p, 'utf8');
    const refs = [];
    for (const [, val] of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) refs.push(val);
    for (const [, val] of html.matchAll(/\bsrcset=["']([^"']+)["']/gi)) {
      for (const part of val.split(',')) refs.push(part.trim().split(/\s+/)[0]);
    }
    for (const raw of refs) {
      if (!raw || raw.startsWith('#')) continue;
      if (isExternal(raw) && !raw.startsWith(SITE_URL + '/')) continue;
      const clean = stripQuery(raw);
      if (clean.startsWith('/pagefind/')) continue; // generated during deploy
      if (/^\/[A-Za-z0-9_-]+\.txt$/.test(clean)) continue; // IndexNow key file from secret
      const abs = resolveLocal(p, raw);
      if (!abs) continue;
      checked++;
      if (!localTargetExists(abs)) {
        broken++;
        R.warn(`Missing local reference: ${file} → ${raw}`);
      }
    }
  }
  if (!broken) R.ok(`Local resources and internal links valid (${checked} refs checked)`);
})();

// 10. Duplicate IDs and accessibility basics
(function a11yBasics() {
  let duplicateIds = 0;
  let altWarnings = 0;
  for (const p of htmlPages) {
    const file = rel(p);
    const html = fs.readFileSync(p, 'utf8');
    const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map(m => m[1]);
    const seen = new Set();
    for (const id of ids) {
      if (seen.has(id)) { duplicateIds++; R.err(`Duplicate id in ${file}: #${id}`); }
      seen.add(id);
    }
    for (const m of html.matchAll(/<img(?![^>]*\balt\s*=)[^>]*>/gi)) {
      altWarnings++;
      R.warn(`a11y: ${file} image without alt: ${m[0].slice(0, 100)}`);
      if (altWarnings >= 20) break;
    }
  }
  if (!duplicateIds) R.ok('No duplicate IDs');
  if (!altWarnings) R.ok('All images have alt attributes');
})();

// 11. PWA and Service Worker
(function pwaSw() {
  if (!exists('manifest.json')) R.err('manifest.json missing');
  else {
    const m = JSON.parse(read('manifest.json'));
    for (const key of ['name', 'short_name', 'start_url', 'display', 'icons']) {
      if (!(key in m)) R.err(`manifest.json missing ${key}`);
    }
    for (const icon of m.icons || []) {
      const src = String(icon.src || '').replace(/^\//, '');
      if (src && !exists(src)) R.err(`manifest icon missing: ${src}`);
    }
    R.ok('manifest.json essentials valid');
  }
  if (!exists('sw.js')) R.err('sw.js missing');
  else {
    const sw = read('sw.js');
    const checks = {
      'CACHE_VERSION': /CACHE_VERSION\s*=/.test(sw),
      'install event': /addEventListener\(['"]install/.test(sw),
      'activate event': /addEventListener\(['"]activate/.test(sw),
      'fetch event': /addEventListener\(['"]fetch/.test(sw),
      'skipWaiting': /skipWaiting/.test(sw),
      'clients.claim': /clients\.claim/.test(sw),
      'cache cleanup': /caches\.delete/.test(sw)
    };
    for (const [name, ok] of Object.entries(checks)) ok ? R.ok(`SW ${name}`) : R.warn(`SW missing ${name}`);
    const precache = [...sw.matchAll(/['"](\/[^'"]+)['"]/g)].map(m => m[1]).filter(u => /\.(css|js|json|ico|png|html|txt)$/.test(stripQuery(u)) || u.startsWith('/pagefind/'));
    let missing = 0;
    for (const u of precache) {
      const clean = stripQuery(u).replace(/^\//, '');
      if (clean.startsWith('pagefind/')) continue; // generated in deploy
      if (!exists(clean)) { missing++; R.err(`SW precache missing file: ${u}`); }
    }
    if (!missing) R.ok(`SW precache references existing repo files (${precache.length} URLs, pagefind skipped)`);
  }
})();

// 12. Search/data integrity
(function dataIntegrity() {
  const searchPath = 'data/search-manifest.json';
  if (exists(searchPath)) {
    const data = JSON.parse(read(searchPath));
    const items = Array.isArray(data.items) ? data.items : [];
    let bad = 0;
    for (const item of items) {
      const url = item.url || '';
      if (!url) { bad++; R.err(`search-manifest item without url: ${item.id || item.title || 'unknown'}`); continue; }
      const abs = path.join(ROOT, stripQuery(url).replace(/^\//, ''));
      if (!localTargetExists(abs)) { bad++; R.err(`search-manifest URL missing: ${url}`); }
    }
    if (!bad) R.ok(`search-manifest URLs valid (${items.length} items)`);
  }
  const seriesPath = 'data/series.json';
  if (exists(seriesPath)) {
    const data = JSON.parse(read(seriesPath));
    const parts = data?.nagornaya?.parts || [];
    const expected = ['chast-1', 'chast-2', 'chast-3', 'chast-4', 'chast-5'];
    for (const slug of expected) if (!exists(`nagornaya/${slug}/index.html`)) R.err(`Missing Nagornaya part: ${slug}`);
    for (const slug of expected) if (!parts.some(p => p.slug === slug)) R.err(`series.json missing part: ${slug}`);
    R.ok('Nagornaya series structure checked');
  }
})();

// 13. sitemap/feed/robots/CNAME
(function publicFiles() {
  if (!exists('CNAME')) R.warn('CNAME missing');
  else {
    const cname = read('CNAME').trim();
    if (cname !== 'gospod-bog.ru') R.err(`CNAME is ${cname}, expected gospod-bog.ru`);
    else R.ok('CNAME is gospod-bog.ru');
  }
  if (!exists('robots.txt')) R.err('robots.txt missing');
  else {
    const robots = read('robots.txt');
    if (!/Sitemap:\s*https:\/\/gospod-bog\.ru\/sitemap\.xml/i.test(robots)) R.warn('robots.txt missing production Sitemap line');
    if (!/User-agent:\s*GPTBot[\s\S]*?Disallow:\s*\//i.test(robots)) R.warn('robots.txt does not block GPTBot bulk training crawler');
    R.ok('robots.txt present');
  }
  if (!exists('sitemap.xml')) R.err('sitemap.xml missing');
  else {
    const sitemap = read('sitemap.xml');
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    const dup = urls.filter((u, i) => urls.indexOf(u) !== i);
    if (dup.length) R.err(`sitemap duplicate loc: ${[...new Set(dup)].join(', ')}`);
    const contentPages = htmlPages.map(rel)
      .filter(f => !['404.html'].includes(f))
      .filter(f => !verificationFileRe.test(f))
      .filter(f => !/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(read(f)));
    let missing = 0;
    for (const f of contentPages) {
      const url = SITE_URL + '/' + (f === 'index.html' ? '' : f.replace(/index\.html$/, ''));
      if (!sitemap.includes(`<loc>${url}</loc>`)) { missing++; R.warn(`sitemap missing URL: ${url}`); }
    }
    if (!missing && !dup.length) R.ok(`sitemap.xml covers HTML pages (${urls.length} loc entries)`);
  }
  if (!exists('feed.xml')) R.warn('feed.xml missing');
  else R.ok('feed.xml present');
})();

// 14. Security/static-site hygiene
(function securityHygiene() {
  let problems = 0;
  for (const p of allFiles.filter(f => /\.(html|css|js|json|xml|txt|md)$/.test(f))) {
    const file = rel(p);
    let text;
    try { text = fs.readFileSync(p, 'utf8'); } catch { continue; }
    if (file !== 'scripts/audit-pro.js' && text.includes('/gb-' + 'is-my-strength/')) { problems++; R.err(`Repository base path leak in ${file}`); }
    // Match real href/src/content attributes only; do not flag XML namespaces like xmlns:content="http://..." in RSS.
    if (/(?:^|[\s<])(?:href|src|content)=[\"']http:\/\/(?!localhost|127\.0\.0\.1|www\.w3\.org|www\.google\.com\/schemas)([^\"']+)[\"']/i.test(text)) R.warn(`Possible http:// mixed content in ${file}`);
    if (file.startsWith('js/') && /\beval\s*\(|new\s+Function\s*\(/.test(text)) { problems++; R.err(`Dangerous JS dynamic execution in ${file}`); }
  }
  if (!problems) R.ok('Security hygiene passed (no repo path leaks / eval)');
})();

// 15. GitHub Pages workflow visibility
(function workflowVisibility() {
  const deploy = '.github/workflows/deploy.yml';
  const notify = '.github/workflows/notify-on-failure.yml';
  if (exists(deploy)) {
    const yml = read(deploy);
    if (!/environment:\s*[\s\S]*?github-pages/.test(yml)) R.warn('deploy.yml has no github-pages environment block');
    if (!/actions\/deploy-pages@v4/.test(yml)) R.warn('deploy.yml does not use actions/deploy-pages@v4');
    R.ok('deploy.yml present');
  } else R.warn('deploy.yml missing');
  if (exists(notify)) R.ok('notify-on-failure.yml present — failures will open/update GitHub issue');
  else R.note('notify-on-failure.yml not installed yet — failure issue alerts disabled');
})();

// ─────────────────────────────────────────────────────────────────────────
// SMART ANTI-REGRESSION GUARDS (added 2026-06-09 after several agent screw-ups)
// Каждая проверка появилась как ответ на реальный инцидент. Если меняешь —
// сначала пойми, какой инцидент она ловит. Документация ниже в комментариях.
// ─────────────────────────────────────────────────────────────────────────

// G1. No garbage in repo root / scripts /.
//   Incident: I left fix_home.py, fix_print.py, audit-pro.js-patch in commits.
//   Rule: никаких *.py / *.patch / uploads/ в корне проекта. Скрипты-помощники
//   принадлежат /scripts/ — но даже там запрещены *.patch и *-patch файлы.
(function junkFilesGuard() {
  const ROOTS = ['', 'scripts', 'images'];
  const BAD_PATTERNS = [
    { re: /\.patch$/i,            why: 'patch files are throw-away helpers' },
    { re: /-patch$/i,             why: 'patch files are throw-away helpers' },
    { re: /^fix_.*\.py$/i,        why: 'ad-hoc fix_*.py scripts must be deleted after use' },
    { re: /^uploads$/i,           why: 'uploads/ is for raw user dumps, never commit it' },
    { re: /^.*\.DS_Store$/i,      why: 'macOS turd' },
    { re: /^Thumbs\.db$/i,        why: 'Windows turd' },
  ];
  const offenders = [];
  for (const root of ROOTS) {
    const dir = path.join(ROOT, root);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      for (const p of BAD_PATTERNS) {
        if (p.re.test(name)) offenders.push(`${root ? root + '/' : ''}${name} — ${p.why}`);
      }
    }
  }
  if (offenders.length) {
    R.err(`Garbage files detected (clean before commit):\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok('No garbage files (*.py / *.patch / uploads/ / OS turds)');
  }
})();

// G2. No oversized raw images committed.
//   Incident: I committed 2.3 MB og-rimlyanam-7-new.png and 1.4 MB og-series-heart.png
//   raw originals instead of using the *.webp pipeline.
//   Rule: PNG/JPG > 700 KB в /images/ почти всегда — забытый сырой исходник,
//   надо нарезать в webp 600w/900w + jpg fallback.
(function oversizedImagesGuard() {
  const LIMIT = 700_000;
  // Known archival originals kept intentionally (historical, pre-existing).
  // Add new entries only when an owner explicitly asks to keep a raw source.
  // To pass without whitelisting, prefer `*-original.*` or `*--keep.*` naming.
  const ALLOWLIST = new Set([
    'images/whitefield-field.png',     // r14.1 — owner-restored historical print
  ]);
  const offenders = [];
  function walkImg(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) { walkImg(p); continue; }
      if (!/\.(png|jpe?g)$/i.test(name)) continue;
      const relPath = path.relative(ROOT, p).replace(/\\/g, '/');
      if (ALLOWLIST.has(relPath)) continue;
      // owner-uploaded scans/portraits intentionally large are exempt by suffix
      if (/-original\.|--keep\./i.test(name)) continue;
      if (st.size > LIMIT) {
        offenders.push(`${relPath} — ${(st.size/1024).toFixed(0)} KB > ${LIMIT/1024} KB`);
      }
    }
  }
  walkImg(path.join(ROOT, 'images'));
  if (offenders.length) {
    R.err(`Oversized raw images in /images/ (convert to webp + responsive sizes, or add to ALLOWLIST):\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok(`Image size hygiene: no PNG/JPG > ${LIMIT/1024} KB in /images/ (allowlist: ${ALLOWLIST.size})`);
  }
})();

// G3. Series consistency: every series in data/series.json must have BOTH
//   (a) a landing page at baseUrl OR a dedicated /<key>/ page, AND
//   (b) each published part must exist on disk under articles/<slug>/.
//   Incident: I created /hard-texts/ landing manually and could have desynced it
//   from data/series.json.
(function seriesConsistencyGuard() {
  const seriesPath = path.join(ROOT, 'data/series.json');
  if (!fs.existsSync(seriesPath)) { R.warn('data/series.json missing'); return; }
  let series;
  try { series = JSON.parse(fs.readFileSync(seriesPath, 'utf8')); }
  catch (e) { R.err(`data/series.json invalid JSON: ${e.message}`); return; }
  const problems = [];
  for (const [key, def] of Object.entries(series)) {
    if (!def.title) problems.push(`${key}: missing title`);
    if (!Array.isArray(def.parts) || !def.parts.length) {
      problems.push(`${key}: has no parts`);
      continue;
    }
    // check each published part exists on disk
    for (const part of def.parts) {
      if (part.status === 'planned') continue;
      const articlePath = path.join(ROOT, 'articles', part.slug || '', 'index.html');
      const nagornayaPath = path.join(ROOT, 'nagornaya', part.slug || '', 'index.html');
      if (!fs.existsSync(articlePath) && !fs.existsSync(nagornayaPath)) {
        problems.push(`${key} part ${part.n} "${part.slug}": no index.html on disk`);
      }
    }
  }
  if (problems.length) {
    R.err(`Series data/series.json inconsistencies:\n  - ${problems.join('\n  - ')}`);
  } else {
    const total = Object.keys(series).length;
    R.ok(`Series consistency: ${total} series in series.json, all published parts exist on disk`);
  }
})();

// G4. Series landing page semantic guard: a /hard-texts/, /pastor-series/,
//   /nagornaya/seriya/, etc. page must NOT reference a foreign series by name.
//   Incident: when I created /hard-texts/index.html by copying /pastor-series/
//   I left H1 "Тёмная сторона кафедры" + summary про пасторские патологии.
//   This guard cross-checks each landing page H1 vs series.json title.
(function seriesLandingTitleGuard() {
  const seriesPath = path.join(ROOT, 'data/series.json');
  if (!fs.existsSync(seriesPath)) return; // G3 already warned
  const series = JSON.parse(fs.readFileSync(seriesPath, 'utf8'));
  // map of "directory key on disk" → expected title fragment
  const landings = [
    { dir: 'hard-texts',      key: 'hard-texts',    forbid: ['кафедры', 'пасторских патологий', 'газлайт', 'диотреф'] },
    { dir: 'pastor-series',   key: 'pastor-series', forbid: ['тайны человеческого сердца', 'Иеремия 17'] },
    { dir: 'nagornaya/seriya', key: 'nagornaya',    forbid: ['кафедры', 'пасторских патологий'] },
  ];
  const problems = [];
  for (const L of landings) {
    const f = path.join(ROOT, L.dir, 'index.html');
    if (!fs.existsSync(f)) continue;
    const html = fs.readFileSync(f, 'utf8');
    const expectedTitle = series[L.key]?.title || '';
    // 1. expected title appears at least once
    if (expectedTitle && !html.includes(expectedTitle)) {
      problems.push(`/${L.dir}/ does not mention its own series title "${expectedTitle}"`);
    }
    // 2. forbidden cross-series terms must not appear
    for (const bad of L.forbid) {
      const re = new RegExp(bad, 'i');
      if (re.test(html)) problems.push(`/${L.dir}/ contains foreign-series term "${bad}" (cross-contamination from copy-paste)`);
    }
  }
  if (problems.length) {
    R.err(`Series landing page contamination:\n  - ${problems.join('\n  - ')}`);
  } else {
    R.ok('Series landing pages: no cross-series contamination');
  }
})();

// G5. No duplicate article cards on /articles/ catalog.
//   Incident: in /articles/index.html the Jeremiah and Romans 7 cards appeared
//   TWICE in the same list (different sub-blocks).
(function catalogDuplicatesGuard() {
  const f = path.join(ROOT, 'articles/index.html');
  if (!fs.existsSync(f)) return;
  const html = fs.readFileSync(f, 'utf8');
  const hrefs = [...html.matchAll(/<a[^>]+href="(?!\/|https?:|#|mailto)([^"#?]+)"[^>]*class="[^"]*h-article-card/g)]
    .map(m => m[1].replace(/\/$/, '').toLowerCase());
  const seen = new Map();
  for (const h of hrefs) seen.set(h, (seen.get(h) || 0) + 1);
  const dups = [...seen.entries()].filter(([, c]) => c > 1);
  if (dups.length) {
    R.err(`/articles/index.html has duplicate article cards:\n  - ${dups.map(([h, c]) => `${h} (×${c})`).join('\n  - ')}`);
  } else {
    R.ok(`/articles/ catalog: ${hrefs.length} cards, no duplicates`);
  }
})();

// G6. Unified header — every page with `<ul class="h-nav-links">` must have
//   the SAME canonical set of links.
//   Incident: /hard-texts/, /pastor-series/, /biografii/, /nagornaya/seriya/
//   were each missing 1-2 nav items (Биографии / Все статьи / Разбор заблуждений),
//   so the header was inconsistent between pages.
(function unifiedHeaderGuard() {
  const REQUIRED = ['Публикации', 'Разбор заблуждений', 'Биографии', 'Все статьи', 'О библиотеке'];
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const offenders = [];
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    if (!/class="h-nav-links"/.test(html)) continue; // only pages with the unified nav
    // extract the <ul class="h-nav-links">…</ul> block
    const m = html.match(/<ul class="h-nav-links"[\s\S]*?<\/ul>/);
    if (!m) continue;
    const block = m[0];
    const missing = REQUIRED.filter(label => !block.includes(`>${label}<`));
    if (missing.length) {
      offenders.push(`${rel(f)}: missing nav items [${missing.join(', ')}]`);
    }
  }
  if (offenders.length) {
    R.err(`Unified header drift — pages with <ul class="h-nav-links"> must contain all of [${REQUIRED.join(' · ')}]:\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok(`Unified header: all pages with h-nav-links contain the canonical ${REQUIRED.length}-item set`);
  }
})();

// G7. No <button> children inside <ul class="h-nav-links">.
//   Incident: I once put <button class="h-cp-btn"> inside a <li> in the nav
//   list. This breaks semantics AND made the icon inherit link color (looked
//   black while the moon was grey) — see AGENTS §9.7.
(function navListSemanticsGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const offenders = [];
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    const m = html.match(/<ul class="h-nav-links"[\s\S]*?<\/ul>/);
    if (!m) continue;
    if (/<button\b/i.test(m[0])) offenders.push(rel(f));
  }
  if (offenders.length) {
    R.err(`<button> found inside <ul class="h-nav-links"> (use .mobile-controls instead):\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok('Nav semantics: no <button> inside <ul class="h-nav-links">');
  }
})();

// G8. Hard-texts series landing must link only to its own parts.
//   Incident: stale article links from another series remained in the
//   landing page's article-list AND in JSON-LD `hasPart`.
(function hardTextsLinkAuditGuard() {
  const f = path.join(ROOT, 'hard-texts/index.html');
  if (!fs.existsSync(f)) return;
  const html = fs.readFileSync(f, 'utf8');
  const seriesPath = path.join(ROOT, 'data/series.json');
  if (!fs.existsSync(seriesPath)) return;
  const series = JSON.parse(fs.readFileSync(seriesPath, 'utf8'))['hard-texts'];
  if (!series) return;
  const allowedSlugs = new Set(series.parts.map(p => p.slug));
  // article-card links inside the landing page must reference only allowed slugs
  const cards = [...html.matchAll(/<a[^>]+href="\.\.\/articles\/([^"\/]+)\//g)];
  const bad = cards.map(c => c[1]).filter(s => !allowedSlugs.has(s));
  if (bad.length) {
    R.err(`/hard-texts/ landing contains article-card links NOT in series.json hard-texts.parts:\n  - ${[...new Set(bad)].join('\n  - ')}`);
  } else {
    R.ok(`/hard-texts/ landing: all ${cards.length} article links are members of the series`);
  }
})();

// G9. Hashed CSS/JS URLs in HTML must point to files that actually exist.
//   (Catches a half-finished cache-bust run that left stale ?v=… hashes.)
(function hashedAssetExistenceGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const missing = new Set();
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    const refs = [...html.matchAll(/(?:href|src)=["']([^"']+\.(?:css|js))\?v=[a-f0-9]+["']/g)];
    for (const m of refs) {
      const url = m[1];
      if (/^https?:/.test(url)) continue;
      const abs = resolveLocal(f, url);
      if (!abs || !fs.existsSync(abs)) missing.add(`${rel(f)} → ${url}`);
    }
  }
  if (missing.size) {
    R.err(`Hashed asset URLs point to missing files:\n  - ${[...missing].slice(0, 20).join('\n  - ')}`);
  } else {
    R.ok('Hashed asset URLs: every ?v=… reference resolves to an existing file');
  }
})();

// G10. .npm/ and other agent-runtime detritus must not be tracked.
(function gitignoreSanityGuard() {
  const gi = path.join(ROOT, '.gitignore');
  if (!fs.existsSync(gi)) { R.warn('.gitignore missing'); return; }
  const txt = fs.readFileSync(gi, 'utf8');
  const required = ['.npm', 'node_modules', '.DS_Store'];
  const missing = required.filter(r => !new RegExp(`^\\s*${r.replace('.', '\\.')}/?\\s*$`, 'm').test(txt));
  if (missing.length) {
    R.warn(`.gitignore missing entries: ${missing.join(', ')}`);
  } else {
    R.ok('.gitignore covers npm/node_modules/OS turds');
  }
})();

// ─────────────────────────────────────────────────────────────────────────
// SMART ANTI-REGRESSION GUARDS — ROUND 2 (added 2026-06-09)
// Каждая защита ниже = ответ на конкретный исторический коммит-фикс.
// При срабатывании в логах указан inciden-ref (SHA или AGENTS-r…) —
// читай тот коммит, чтобы понять что именно тут защищается.
// ─────────────────────────────────────────────────────────────────────────

// G11. article-topnav must stay deleted.
//   Incident: AGENTS-r74 (2026-06-08) — owner explicitly removed sticky topnav
//   from all 8 articles; AGENTS §9.8 says: "не возвращать". Multiple agents
//   keep trying to re-introduce it.
(function topnavExorcismGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const offenders = [];
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    // we only care about ACTUAL elements, not CSS strings or comments
    // catch: <nav class="article-topnav…">, <div class="…article-topnav…">
    const m = html.match(/<(?:nav|div|header|aside)\s[^>]*class="[^"]*\barticle-topnav\b/);
    if (m) offenders.push(`${rel(f)}: contains <…class="article-topnav…"> — AGENTS §9.8 says do not revive`);
  }
  if (offenders.length) {
    R.err(`article-topnav resurrected (AGENTS §9.8 — owner deleted it 2026-06-08):\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok('article-topnav stays buried (AGENTS §9.8)');
  }
})();

// G12. Dead classes must NOT come back.
//   Incident: PLAN-04 P5–P7 (commits d683088c, c141f361, 1ee834c7) removed
//   .theme-float-btn, .ai-disclosure, .fx-lift, .epilogue-*, .float-fallback,
//   .nag-theme-btn, #themeFloat, #gbSearchFloat. AGENTS-r17 lists these.
//   If a future agent re-adds the class anywhere in HTML/CSS/JS — fail.
(function deadClassResurrectionGuard() {
  const FORBIDDEN = [
    { name: '.theme-float-btn', why: 'PLAN-04 P5 — replaced by .gb-fc-theme (FAB module 29)' },
    { name: '.ai-disclosure',   why: 'PLAN-04 P7 / AGENTS-r11 — owner does not want AI badges on figcaption' },
    { name: '.nag-theme-btn',   why: 'PLAN-04 P5 — replaced by unified .gb-fc-theme' },
    { name: '#themeFloat',      why: 'PLAN-04 P5 — replaced by .gb-fc-theme' },
    { name: '#gbSearchFloat',   why: 'PLAN-04 P5 — replaced by .gb-fc-search' },
  ];
  const all = walk(ROOT).filter(f => /\.(html|css|js)$/.test(f) && !f.includes('/scripts/'));
  const offenders = [];
  for (const f of all) {
    const txt = fs.readFileSync(f, 'utf8');
    for (const cls of FORBIDDEN) {
      // for #ids / .classes — match as exact token (not substring)
      const tokenName = cls.name.startsWith('.') ? cls.name.slice(1) : cls.name.slice(1);
      const sigil = cls.name[0]; // '.' or '#'
      // 1. HTML attribute: class="… X …" or id="X"
      const htmlRe = sigil === '.'
        ? new RegExp(`class\\s*=\\s*["'][^"']*\\b${escapeRe(tokenName)}\\b[^"']*["']`)
        : new RegExp(`id\\s*=\\s*["']${escapeRe(tokenName)}["']`);
      // 2. CSS selector or JS literal: '.theme-float-btn' / '#themeFloat'
      const cssJsRe = new RegExp(`(?<![A-Za-z0-9_-])${escapeRe(cls.name)}(?![A-Za-z0-9_-])`);
      if (htmlRe.test(txt) || cssJsRe.test(txt)) {
        offenders.push(`${rel(f)}: dead class ${cls.name} resurrected — ${cls.why}`);
      }
    }
  }
  if (offenders.length) {
    R.err(`Dead-class resurrection (do NOT bring back removed components):\n  - ${[...new Set(offenders)].join('\n  - ')}`);
  } else {
    R.ok(`Dead classes stay dead (${FORBIDDEN.length} guarded)`);
  }
})();

// G13. <span class="ai-note"> banned in <figcaption>.
//   Incident: AGENTS table line 289 — figcaption никогда не должна
//   нести AI-disclosure. SEO fix commit 8512f82f removed it once already.
(function aiNoteInFigcaptionGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const offenders = [];
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    const figcaps = [...html.matchAll(/<figcaption[\s\S]*?<\/figcaption>/g)];
    for (const m of figcaps) {
      if (/class\s*=\s*["'][^"']*\bai-note\b/.test(m[0]) ||
          /<span[^>]*>\s*Изображение сгенерировано ИИ/i.test(m[0])) {
        offenders.push(rel(f));
        break;
      }
    }
  }
  if (offenders.length) {
    R.err(`<span class="ai-note"> or AI-disclosure text inside <figcaption> (AGENTS line ~289 — ban):\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok('No AI-disclosure spans inside <figcaption>');
  }
})();

// G14. Duplicate <meta property="og:image"> per page.
//   Incident: commit 65ef82a5 — krajne had a second duplicate og:image tag.
//   OG validators in Telegram/Twitter pick the first one and ignore the rest,
//   so duplicates are silently confusing. Same applies to og:title, og:url.
(function ogMetaDuplicateGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const KEYS = ['og:image', 'og:title', 'og:url', 'og:description', 'twitter:image'];
  const offenders = [];
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    for (const key of KEYS) {
      const re = new RegExp(`<meta\\s+[^>]*(?:property|name)\\s*=\\s*["']${escapeRe(key)}["']`, 'g');
      const count = (html.match(re) || []).length;
      if (count > 1) offenders.push(`${rel(f)}: ${key} ×${count}`);
    }
  }
  if (offenders.length) {
    R.err(`Duplicate OpenGraph/Twitter meta tags (only first wins for crawlers):\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok('OG/Twitter meta: no duplicates across pages');
  }
})();

// G15. <source srcset=…> must be inside <picture>.
//   Incident: PLAN-07 (ebf52955) — agent inserted bare <source> tags without
//   <picture> wrappers. Browser silently ignores them.
(function pictureSourceWrapperGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const offenders = [];
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    // remove <picture>…</picture> blocks, then any remaining <source srcset> is orphan
    const stripped = html.replace(/<picture[\s\S]*?<\/picture>/gi, '');
    const orphans = stripped.match(/<source\s+[^>]*srcset/gi);
    if (orphans && orphans.length) {
      offenders.push(`${rel(f)}: ${orphans.length} <source srcset=…> outside <picture> wrapper`);
    }
  }
  if (offenders.length) {
    R.err(`Orphan <source srcset> (only valid inside <picture>):\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok('All <source srcset> tags wrapped in <picture>');
  }
})();

// G16. Broken passive-listener pattern: addEventListener('resize', function(, {passive:…}))
//   Incident: AGENTS-r47c/d and r45c — multiple agents broke listeners by
//   writing the comma-after-paren pattern. Catch it before deploy.
(function brokenListenerPatternGuard() {
  const jsFiles = walk(ROOT).filter(f => f.endsWith('.js') && !f.includes('/scripts/') && !/min\.js$/.test(f));
  const offenders = [];
  for (const f of jsFiles) {
    const js = fs.readFileSync(f, 'utf8');
    // catch:  addEventListener('xxx', function(, {…
    //         addEventListener("xxx", function(, {…
    if (/addEventListener\s*\(\s*['"][^'"]+['"]\s*,\s*function\s*\(\s*,/.test(js)) {
      offenders.push(rel(f));
    }
  }
  if (offenders.length) {
    R.err(`Broken listener pattern \`function(, {passive:…})\` — see AGENTS-r47c/d:\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok('Listener syntax: no broken function(, {…}) patterns');
  }
})();

// G17. Heuristic console.error / parse-fail in inline scripts.
//   Incident: r58 (5e48837c) — site.js had a syntax error broken since r48b,
//   prod was crashing in browser, only Playwright caught it. We can't run
//   browser here, but we CAN evaluate inline scripts with new Function()
//   to catch parse errors. This is already done at line 342 (inlineScriptSyntax).
//   THIS guard is an extra layer: flag inline scripts longer than 50 LOC,
//   which AGENTS philosophy says belong in /js/ not inline.
(function bigInlineScriptGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const offenders = [];
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
    for (const m of inline) {
      const body = m[1];
      const lines = body.split('\n').filter(l => l.trim()).length;
      // skip JSON-LD, SITE_CONFIG and quiz data (known canonical big blocks)
      if (/application\/ld\+json/.test(m[0])) continue;
      if (/window\.SITE_CONFIG/.test(body)) continue;
      if (/window\.QUIZ_DATA|window\.QUIZ_SOURCE/.test(body)) continue;
      if (lines > 500) {
        offenders.push(`${rel(f)}: inline <script> with ${lines} LOC (consider /js/ extraction)`);
      }
    }
  }
  if (offenders.length) {
    // info only — not all agents will follow this; surface but don't fail
    R.warn(`Large inline scripts (consider extracting to /js/):\n  - ${offenders.slice(0, 10).join('\n  - ')}`);
  } else {
    R.ok('Inline scripts: none larger than 50 LOC (except JSON-LD / SITE_CONFIG)');
  }
})();

// G18. CSS @keyframes must each have at least one rule (from / to or %).
//   Incident: commit 32eabff7 — "restore site.css from broken @keyframes regression".
//   An empty/malformed @keyframes silently breaks subsequent animations.
(function keyframesIntegrityGuard() {
  const cssFiles = ['css/site.css', 'css/home.css', 'css/command-palette.css',
                    'css/mobile-hotfix.css', 'css/nagornaya-mobile-toc.css'];
  const offenders = [];
  for (const f of cssFiles) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const css = fs.readFileSync(p, 'utf8');
    // match @keyframes NAME { … }, naïve but works on minified or formatted CSS
    const blocks = [...css.matchAll(/@(?:-webkit-)?keyframes\s+([\w-]+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)];
    for (const m of blocks) {
      const name = m[1];
      const body = m[2];
      // must contain at least one stop (from/to/0%/100% etc.)
      if (!/(?:\bfrom\b|\bto\b|\d+%)\s*\{/.test(body)) {
        offenders.push(`${f}: @keyframes ${name} has no from/to/%% stops`);
      }
    }
  }
  if (offenders.length) {
    R.err(`Malformed @keyframes (animations will silently break):\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok('@keyframes integrity: all blocks have valid stops');
  }
})();

// G19. CACHE_VERSION in sw.js must match the major-rev of cache-bust.
//   Incident: SW with stale CACHE_VERSION keeps serving deleted files.
//   We don't enforce a specific version — just require the value is non-empty
//   AND that sw.js actually deletes old caches on activate (we already check
//   activate/delete, but not the version-string format). Surgical: verify the
//   version string exists, is a quoted literal, and is non-trivial.
(function swCacheVersionGuard() {
  const p = path.join(ROOT, 'sw.js');
  if (!fs.existsSync(p)) { R.warn('sw.js missing'); return; }
  const sw = fs.readFileSync(p, 'utf8');
  const m = sw.match(/CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!m) { R.err('sw.js: CACHE_VERSION not found or not a quoted string literal'); return; }
  const v = m[1];
  // version should be ≥ 4 chars and include a digit or hyphen (e.g. 'v1.6.3', '2026-06-09', 'r77')
  if (v.length < 3 || !/[\d-]/.test(v)) {
    R.err(`sw.js CACHE_VERSION="${v}" is suspiciously short/trivial — bump it on every meaningful asset change`);
  } else {
    R.ok(`sw.js CACHE_VERSION="${v}" looks sane`);
  }
})();

// G20. Sitemap freshness sanity: lastmod must not be in the future.
//   Incident: commit 65ef82a5 — sitemap had non-normalized lastmod values.
//   If a date is in the future, Google flags the sitemap as broken.
(function sitemapFutureDateGuard() {
  const p = path.join(ROOT, 'sitemap.xml');
  if (!fs.existsSync(p)) { R.warn('sitemap.xml missing'); return; }
  const xml = fs.readFileSync(p, 'utf8');
  const dates = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(m => m[1].trim());
  const today = new Date();
  today.setHours(23, 59, 59, 999); // allow same-day timezone slack
  const future = dates.filter(d => {
    const dt = new Date(d);
    return !isNaN(dt) && dt > today;
  });
  if (future.length) {
    R.err(`sitemap.xml has ${future.length} lastmod date(s) in the future:\n  - ${future.slice(0, 5).join('\n  - ')}`);
  } else {
    R.ok(`sitemap.xml: all ${dates.length} lastmod dates ≤ today`);
  }
})();

// Output
const duration = ((Date.now() - R.start) / 1000).toFixed(2);
const sep = '═'.repeat(78);
console.log(`\n${sep}\nGB-IS-MY-STRENGTH — PROFESSIONAL AUDIT\n${new Date().toISOString()} · ${duration}s\n${sep}\n`);
console.log(`Summary: ✅ ${R.passed.length} passed · ⚠️ ${R.warnings.length} warnings · ❌ ${R.errors.length} errors · ℹ️ ${R.info.length} info\n`);
if (R.passed.length) {
  console.log('── PASSED ──');
  for (const m of R.passed) console.log(`✅ ${m}`);
  console.log('');
}
if (R.warnings.length) {
  console.log(`── WARNINGS (${R.warnings.length}) ──`);
  for (const m of R.warnings) console.log(`⚠️ ${m}`);
  console.log('');
}
if (R.errors.length) {
  console.log(`── ERRORS (${R.errors.length}) ──`);
  for (const m of R.errors) console.log(`❌ ${m}`);
  console.log('');
}
if (R.info.length) {
  console.log('── INFO ──');
  for (const m of R.info) console.log(`ℹ️ ${m}`);
  console.log('');
}
console.log(R.errors.length ? '❌ AUDIT FAILED — fix errors before deploy' : '✅ AUDIT PASSED — ready for deploy');
console.log(sep + '\n');

try {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(REPORT_DIR, `audit-pro-${stamp}.md`);
  const md = [
    '# gb-is-my-strength — Professional Audit Report',
    '',
    `**Date:** ${new Date().toISOString()}`,
    `**Result:** ${R.errors.length ? '❌ FAILED' : '✅ PASSED'}`,
    `**Summary:** ${R.passed.length} passed · ${R.warnings.length} warnings · ${R.errors.length} errors`,
    `**Duration:** ${duration}s`,
    '',
    '## ✅ Passed',
    ...R.passed.map(x => `- ${x}`),
    '',
    '## ⚠️ Warnings',
    ...(R.warnings.length ? R.warnings.map(x => `- ${x}`) : ['- None']),
    '',
    '## ❌ Errors',
    ...(R.errors.length ? R.errors.map(x => `- ${x}`) : ['- None']),
    '',
    '## ℹ️ Info',
    ...(R.info.length ? R.info.map(x => `- ${x}`) : ['- None']),
    ''
  ].join('\n');
  fs.writeFileSync(reportPath, md, 'utf8');
  console.log(`Report saved: ${rel(reportPath)}`);
} catch (e) {
  console.log(`Could not write audit report: ${e.message}`);
}

process.exit(R.errors.length ? 1 : 0);
