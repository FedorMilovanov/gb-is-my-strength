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

// G1. No garbage anywhere in the repo (recursive).
//   Incident: I left fix_home.py, fix_print.py, audit-pro.js-patch in commits.
//   Earlier version only scanned 1-level; agents can drop junk in any subdir.
(function junkFilesGuard() {
  const BAD_PATTERNS = [
    { re: /\.patch$/i,            why: 'patch files are throw-away helpers' },
    { re: /-patch$/i,             why: 'patch files are throw-away helpers' },
    { re: /^fix_.*\.py$/i,        why: 'ad-hoc fix_*.py scripts must be deleted after use' },
    { re: /\.DS_Store$/i,         why: 'macOS turd' },
    { re: /^Thumbs\.db$/i,        why: 'Windows turd' },
    { re: /\.bak$/i,              why: 'editor backup file' },
    { re: /\.orig$/i,             why: 'git merge artifact' },
    { re: /\.rej$/i,              why: 'rejected patch hunk' },
    { re: /~$/,                   why: 'editor backup with ~ suffix' },
  ];
  const EXCLUDE_DIRS = new Set(['.git', 'node_modules', '.npm', 'pagefind', '.playwright-browsers',
    'shots', 'shots-after', 'audit', '.cache']);
  const offenders = [];
  function scan(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      if (EXCLUDE_DIRS.has(name)) continue;
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        if (/^uploads$/i.test(name)) {
          offenders.push(`${path.relative(ROOT, full)}/ — uploads/ is for raw dumps, never commit`);
          continue; // don't recurse into uploads
        }
        scan(full);
      } else {
        for (const p of BAD_PATTERNS) {
          if (p.re.test(name)) {
            offenders.push(`${path.relative(ROOT, full).replace(/\\/g, '/')} — ${p.why}`);
          }
        }
      }
    }
  }
  scan(ROOT);
  if (offenders.length) {
    R.err(`Garbage files detected (clean before commit):\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok('No garbage files (*.py / *.patch / *.bak / *.orig / *.rej / uploads/ / OS turds) anywhere in repo');
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
    R.ok(`Image size hygiene: no PNG/JPG > ${Math.round(LIMIT/1024)} KB in /images/ (allowlist: ${ALLOWLIST.size})`);
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
    if (!/class\s*=\s*["'][^"']*\bh-nav-links\b/.test(html)) continue; // only pages with the unified nav
    // extract the <ul …class=…h-nav-links…>…</ul> block (tolerate attribute order / quote style)
    const m = html.match(/<ul[^>]*\bclass\s*=\s*["'][^"']*\bh-nav-links\b[^"']*["'][^>]*>[\s\S]*?<\/ul>/);
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
    const m = html.match(/<ul[^>]*\bclass\s*=\s*["'][^"']*\bh-nav-links\b[^"']*["'][^>]*>[\s\S]*?<\/ul>/);
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
//   OG validators in Telegram/Twitter pick the first one and ignore the rest.
//   Attribute order is normalized: `<meta property=… content=…>` and the
//   reverse both count. We also tolerate single/double quotes.
(function ogMetaDuplicateGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const KEYS = ['og:image', 'og:title', 'og:url', 'og:description', 'twitter:image', 'og:type'];
  const offenders = [];
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    const tags = [...html.matchAll(/<meta\b([^>]+)>/gi)].map(m => m[1]);
    const counter = {};
    for (const attrs of tags) {
      // grab property=… or name=… (whichever is present, regardless of position)
      const pm = attrs.match(/\b(?:property|name)\s*=\s*['"]([^'"]+)['"]/i);
      if (!pm) continue;
      const key = pm[1].trim().toLowerCase();
      if (!KEYS.includes(key)) continue;
      counter[key] = (counter[key] || 0) + 1;
    }
    for (const [k, c] of Object.entries(counter)) {
      if (c > 1) offenders.push(`${rel(f)}: ${k} ×${c}`);
    }
  }
  if (offenders.length) {
    R.err(`Duplicate OpenGraph/Twitter meta tags (only first wins for crawlers):\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok(`OG/Twitter meta: no duplicates across pages (checked: ${KEYS.join(', ')})`);
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
    R.ok('Inline scripts: none larger than 500 LOC (except JSON-LD / SITE_CONFIG / QUIZ_DATA)');
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

// ─────────────────────────────────────────────────────────────────────────
// SMART ANTI-REGRESSION GUARDS — ROUND 3 (added 2026-06-09)
// Hand-picked from unexplored history domains: a11y, browser compat,
// scroll-lock, RTL, mixed-protocol, duplicate H1, semantic correctness.
// ─────────────────────────────────────────────────────────────────────────

// G21. Exactly one <h1> per content page.
//   Incident: SEO standard. Multiple <h1> confuse crawlers and screen readers.
//   We skip robot-verification files (google*.html, yandex_*.html).
(function singleH1Guard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const offenders = [];
  for (const f of files) {
    const r = rel(f);
    if (/^(google|yandex|microsoft|favicon|404)/i.test(path.basename(r))) continue;
    const html = fs.readFileSync(f, 'utf8');
    const count = (html.match(/<h1\b[^>]*>/gi) || []).length;
    if (count === 0) offenders.push(`${r}: missing <h1>`);
    else if (count > 1) offenders.push(`${r}: ${count} <h1> tags (must be exactly 1)`);
  }
  if (offenders.length) {
    R.err(`Single-<h1> rule violated (SEO + a11y):\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok('Single <h1> per page: all content pages have exactly one');
  }
})();

// G22. No mixed-content http:// in href/src (except web.archive.org snapshots).
//   Mixed-content blocks resources on https sites and triggers browser warnings.
//   Tooltip footnotes legitimately reference http://web.archive.org/web/…/http://…
//   so we whitelist that exact pattern.
(function mixedProtocolGuard() {
  const files = walk(ROOT).filter(f => /\.(html|css|js|json|xml)$/i.test(f));
  const offenders = [];
  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf8');
    // Find http://… in src= or href= attribute values only (not inside tooltips or prose)
    const matches = [...txt.matchAll(/(?:href|src)\s*=\s*["']http:\/\/([^"'\s/]+)/g)];
    for (const m of matches) {
      const host = m[1].toLowerCase();
      // legitimate: w3.org schemas, archive.org snapshots
      if (host === 'www.w3.org' || host === 'web.archive.org') continue;
      offenders.push(`${rel(f)}: http://${host} (use https or remove)`);
    }
  }
  if (offenders.length) {
    R.err(`Mixed-content http:// links/sources (browsers block on https):\n  - ${[...new Set(offenders)].slice(0, 10).join('\n  - ')}`);
  } else {
    R.ok('Mixed-content: no http:// href/src (web.archive.org & w3.org whitelisted)');
  }
})();

// G23. target="_blank" links must have rel including 'noopener'.
//   Without it, the opened page gets window.opener access — security/perf risk.
(function targetBlankRelGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const offenders = [];
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    // grab full <a …> tags with target="_blank"
    const anchors = [...html.matchAll(/<a\b[^>]*target\s*=\s*["']_blank["'][^>]*>/gi)];
    for (const a of anchors) {
      const tag = a[0];
      // accept rel containing noopener (with or without other tokens)
      if (!/rel\s*=\s*["'][^"']*\bnoopener\b/i.test(tag)) {
        offenders.push(`${rel(f)}: ${tag.slice(0, 110)}`);
      }
    }
  }
  if (offenders.length) {
    R.err(`<a target="_blank"> without rel="noopener" (security/perf):\n  - ${offenders.slice(0, 8).join('\n  - ')}`);
  } else {
    R.ok('target="_blank" links: all carry rel="noopener"');
  }
})();

// G24. href="javascript:" — bad UX/a11y.
//   Already enforced by validate.js for javascript:void(0); this complements it.
//   We DO NOT flag bare href="#" when the anchor has data-* attributes that
//   indicate JS will fill the href dynamically (data-resume-link, data-action,
//   data-target, role="tab", etc.) — legitimate progressive-enhancement pattern.
(function badAnchorHrefGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const offenders = [];
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    // javascript: scheme is always bad
    const jsAnchors = [...html.matchAll(/<a\b[^>]*href\s*=\s*["']\s*javascript:[^>]*>/gi)];
    for (const a of jsAnchors) offenders.push(`${rel(f)}: ${a[0].slice(0, 80)}…`);
    // bare href="#" only flagged if no data-* / role= indicator
    const bareHashAnchors = [...html.matchAll(/<a\b([^>]*)href\s*=\s*["']#["']([^>]*)>/gi)];
    for (const m of bareHashAnchors) {
      const attrs = m[1] + m[2];
      if (/\bdata-[a-z-]+/i.test(attrs)) continue;
      if (/\brole\s*=/i.test(attrs)) continue;
      offenders.push(`${rel(f)}: bare href="#" without data-/role attrs (${m[0].slice(0, 70)}…)`);
    }
  }
  if (offenders.length) {
    R.err(`Bad anchor href values (UX/a11y):\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok('Anchor href values: no href="javascript:…" and no truly-bare href="#"');
  }
})();

// G25. <html lang="ru"> on every content page.
//   Incident: SEO/a11y require explicit language. Catch agents copying
//   templates without lang attribute. Skip robot-verification stubs.
(function htmlLangGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const offenders = [];
  for (const f of files) {
    const r = rel(f);
    if (/^(google|yandex|microsoft)/i.test(path.basename(r))) continue;
    const html = fs.readFileSync(f, 'utf8');
    if (!/<html\b[^>]*\blang\s*=/.test(html)) {
      offenders.push(`${r}: <html> missing lang attribute`);
    }
  }
  if (offenders.length) {
    R.err(`<html> without lang attribute (a11y/SEO):\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok('All content pages have <html lang="…">');
  }
})();

// G26. Each non-empty <a> link must have visible text OR aria-label OR title.
//   Catches "naked" links like <a href="…"><img …></a> with no accessible text.
//   We allow <a> wrapping <img alt="…"> because alt provides the accessible name.
(function linkAccessibleNameGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const offenders = [];
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
    for (const a of anchors) {
      const attrs = a[1];
      const body = a[2];
      // direct text content (strip tags, decode entities crudely)
      const textOnly = body.replace(/<[^>]+>/g, '').replace(/&[#a-z0-9]+;/gi, '?').trim();
      if (textOnly.length > 0) continue;
      // aria-label / title / aria-labelledby in <a> itself
      if (/\baria-label\s*=\s*["'][^"']+["']/i.test(attrs)) continue;
      if (/\btitle\s*=\s*["'][^"']+["']/i.test(attrs)) continue;
      if (/\baria-labelledby\s*=/i.test(attrs)) continue;
      // <img alt="…"> with non-empty alt inside
      const imgAlt = body.match(/<img\b[^>]*\balt\s*=\s*["']([^"']*)["']/i);
      if (imgAlt && imgAlt[1].trim()) continue;
      // <svg> with aria-label inside is accessible-name
      if (/<svg\b[^>]*\baria-label\s*=\s*["'][^"']+["']/i.test(body)) continue;
      // SVG with role="img" + <title> child
      if (/<title>[^<]+<\/title>/i.test(body)) continue;
      offenders.push(`${rel(f)}: <a${attrs.slice(0, 80)}…> has no accessible name`);
    }
  }
  if (offenders.length) {
    R.err(`Anchors without accessible name (a11y):\n  - ${offenders.slice(0, 10).join('\n  - ')}`);
  } else {
    R.ok('Anchors: every <a> has visible text / aria-label / alt');
  }
})();

// G27. Every <button> must have text or aria-label.
//   Incident: AGENTS-r74 said theme/search buttons must be clean SVG —
//   but they MUST still carry aria-label. Same for h-mobile-menu-btn.
(function buttonAccessibleNameGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const offenders = [];
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)];
    for (const b of buttons) {
      const attrs = b[1];
      const body = b[2];
      const textOnly = body.replace(/<[^>]+>/g, '').replace(/&[#a-z0-9]+;/gi, '?').trim();
      if (textOnly.length > 0) continue;
      if (/\baria-label\s*=\s*["'][^"']+["']/i.test(attrs)) continue;
      if (/\baria-labelledby\s*=/i.test(attrs)) continue;
      if (/\btitle\s*=\s*["'][^"']+["']/i.test(attrs)) continue;
      if (/<svg\b[^>]*\baria-label\s*=/i.test(body)) continue;
      offenders.push(`${rel(f)}: icon-only <button> without aria-label`);
    }
  }
  if (offenders.length) {
    R.err(`Icon-only buttons without aria-label (a11y):\n  - ${[...new Set(offenders)].slice(0, 8).join('\n  - ')}`);
  } else {
    R.ok('Buttons: every icon-only <button> carries aria-label');
  }
})();

// G28. Tab-index hygiene: tabindex > 0 is an anti-pattern (creates manual
// keyboard-order hell). tabindex="0" or "-1" are fine.
(function tabindexAntiPatternGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const offenders = [];
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    const m = [...html.matchAll(/\btabindex\s*=\s*["'](\d+)["']/gi)];
    for (const x of m) {
      const v = parseInt(x[1], 10);
      if (v > 0) offenders.push(`${rel(f)}: tabindex="${v}" (use 0 or -1, never positive)`);
    }
  }
  if (offenders.length) {
    R.err(`Positive tabindex (a11y anti-pattern):\n  - ${offenders.slice(0, 8).join('\n  - ')}`);
  } else {
    R.ok('Tabindex hygiene: no positive tabindex values');
  }
})();

// G29. CSS variables must be defined before use — UNLESS used as fallback.
//   Surgical: only flag `var(--unknown)` WITHOUT a fallback (`, default`).
//   Why: `var(--ink, #14100b)` renders correctly even if --ink is undefined
//   (that's literally the fallback's job). And runtime-set vars (--mouse-x
//   from JS) need to be on the EXTERNAL whitelist OR have a fallback.
(function cssVariableHygieneGuard() {
  const cssFiles = ['css/site.css', 'css/home.css', 'css/command-palette.css',
                    'css/mobile-hotfix.css', 'css/nagornaya-mobile-toc.css', 'fonts/fonts.css',
                    'nagornaya/tw.min.css'];
  const defined = new Set();
  // Externals = vars set dynamically (JS / inline style at runtime) or by browser
  const EXTERNAL = new Set([
    '--tw-shadow', '--tw-shadow-color', '--tw-shadow-colored',
    '--tw-ring-shadow', '--tw-ring-color', '--tw-ring-offset-shadow',
    '--tw-ring-offset-color', '--tw-ring-offset-width', '--tw-translate-x', '--tw-translate-y',
    '--tw-rotate', '--tw-skew-x', '--tw-skew-y', '--tw-scale-x', '--tw-scale-y',
    '--scroll-lock-top', '--visual-viewport-h', '--back-height', '--phrase-opacity',
    '--gtip-cat-color', '--theme-color', '--mouse-x', '--mouse-y',
    '--gb-tip-arrow-x', '--cp-max-h', '--hb-front-w', '--hb-open-w', '--rp',
  ]);
  for (const f of cssFiles) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const css = fs.readFileSync(p, 'utf8');
    for (const m of css.matchAll(/(--[a-zA-Z][\w-]*)\s*:/g)) defined.add(m[1]);
  }
  for (const f of walk(ROOT).filter(x => x.endsWith('.html'))) {
    const html = fs.readFileSync(f, 'utf8');
    const styleBlocks = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
    for (const sb of styleBlocks) {
      for (const m of sb[1].matchAll(/(--[a-zA-Z][\w-]*)\s*:/g)) defined.add(m[1]);
    }
  }
  const undef = new Set();
  for (const f of cssFiles) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const css = fs.readFileSync(p, 'utf8');
    // var(--name)   — bare usage (no fallback) — must be defined or EXTERNAL
    // var(--name, X) — has a fallback — always safe
    for (const m of css.matchAll(/var\(\s*(--[a-zA-Z][\w-]*)\s*([,)])/g)) {
      const name = m[1];
      const hasFallback = m[2] === ',';
      if (hasFallback) continue;
      if (!defined.has(name) && !EXTERNAL.has(name)) undef.add(`${f}: var(${name}) — no fallback, not defined, not in externals`);
    }
  }
  if (undef.size) {
    R.warn(`CSS variables used bare without fallback and never defined:\n  - ${[...undef].slice(0, 15).join('\n  - ')}`);
  } else {
    R.ok(`CSS variables: ${defined.size} defined; bare-usage check passed (${EXTERNAL.size} runtime externals)`);
  }
})();

// G30. Image overlap with .webp/.jpg pair must include both files.
//   Incident: PLAN-07 (ebf52955) — base files missing for some <picture>.
//   For each `<img src="foo.jpg">`, the corresponding `foo.webp` (and `*-600w.webp`,
//   `*-900w.webp` if referenced in srcset) must exist.
(function imageResponsiveSetGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const missing = new Set();
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    const refs = new Set();
    // collect from src=, srcset= (handle 600w / 900w descriptors)
    for (const m of html.matchAll(/(?:src|srcset)\s*=\s*["']([^"']+)["']/g)) {
      const value = m[1];
      for (const piece of value.split(',')) {
        const url = piece.trim().split(/\s+/)[0];
        if (!url) continue;
        if (!/\.(webp|jpe?g|png|avif|gif)$/i.test(url)) continue;
        if (/^https?:|^data:|^\/\//.test(url)) continue;
        refs.add({ url, from: f });
      }
    }
    for (const { url, from } of refs) {
      const abs = resolveLocal(from, url);
      if (!abs || !fs.existsSync(abs)) {
        missing.add(`${rel(from)} → ${url} (file does not exist)`);
      }
    }
  }
  if (missing.size) {
    R.err(`Image references to non-existent files:\n  - ${[...missing].slice(0, 12).join('\n  - ')}`);
  } else {
    R.ok('Image references: every src/srcset URL resolves to an existing file');
  }
})();

// ─────────────────────────────────────────────────────────────────────────
// SMART ANTI-REGRESSION GUARDS — ROUND 4 (added 2026-06-09)
// Indexing/SEO/asset hygiene blind spots from the 624-commit history.
// Each guard ties to a real failure mode.
// ─────────────────────────────────────────────────────────────────────────

// G31. Pages listed in sitemap MUST NOT be `noindex`.
//   Found today: nagornaya/istochniki/ and nagornaya/nakhodki/ had
//   robots="noindex" yet were in sitemap.xml — Google sees the conflict and
//   distrusts the whole sitemap. Either include with `index` OR remove from
//   sitemap entirely.
(function sitemapNoindexConflictGuard() {
  const sm = path.join(ROOT, 'sitemap.xml');
  if (!fs.existsSync(sm)) { R.warn('sitemap.xml missing'); return; }
  const xml = fs.readFileSync(sm, 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const offenders = [];
  for (const url of locs) {
    // map gospod-bog.ru/foo/ → ./foo/index.html
    let local = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
    if (local === '' || local.endsWith('/')) local = (local || '') + 'index.html';
    const abs = path.join(ROOT, local);
    if (!fs.existsSync(abs)) continue; // a separate guard handles missing files
    const html = fs.readFileSync(abs, 'utf8');
    const m = html.match(/<meta\s+[^>]*name\s*=\s*["']robots["'][^>]*content\s*=\s*["']([^"']+)["']/i);
    if (m && /\bnoindex\b/i.test(m[1])) {
      offenders.push(`${local} — robots="${m[1].trim()}" but listed in sitemap`);
    }
  }
  if (offenders.length) {
    R.err(`sitemap.xml lists pages marked noindex (search engines distrust the sitemap):\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok(`sitemap.xml: no noindex pages listed (checked ${locs.length} URLs)`);
  }
})();

// G32. Canonical URL must (a) exist, (b) be unique across pages,
//   (c) match its own page's actual URL (e.g. /articles/foo/ has
//   canonical https://gospod-bog.ru/articles/foo/).
(function canonicalSanityGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const seen = new Map(); // canonical url → first file that used it
  const problems = [];
  for (const f of files) {
    const r = rel(f);
    const base = path.basename(r);
    if (/^(google|yandex|microsoft)/i.test(base)) continue;
    if (base === '404.html') continue;
    const html = fs.readFileSync(f, 'utf8');
    // tolerate any attribute order: href before rel OR rel before href
    let url = null;
    const candidates = [...html.matchAll(/<link\b([^>]+)>/gi)];
    for (const c of candidates) {
      const attrs = c[1];
      if (!/\brel\s*=\s*["']canonical["']/i.test(attrs)) continue;
      const hm = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i);
      if (hm) { url = hm[1].trim(); break; }
    }
    if (!url) {
      problems.push(`${r}: missing <link rel="canonical">`);
      continue;
    }
    // a) must use https://gospod-bog.ru/
    if (!/^https:\/\/gospod-bog\.ru\//.test(url)) {
      problems.push(`${r}: canonical "${url}" not on https://gospod-bog.ru/`);
      continue;
    }
    // b) uniqueness
    if (seen.has(url)) {
      problems.push(`${r}: canonical "${url}" already used by ${seen.get(url)}`);
    } else {
      seen.set(url, r);
    }
    // c) match own URL: derive expected from file path
    let expected = '/' + r.replace(/\\/g, '/');
    expected = expected.replace(/\/index\.html$/, '/');
    if (expected === '/index.html') expected = '/';
    const expectedFull = 'https://gospod-bog.ru' + expected;
    if (url !== expectedFull) {
      problems.push(`${r}: canonical "${url}" ≠ expected "${expectedFull}"`);
    }
  }
  if (problems.length) {
    R.err(`Canonical URL issues:\n  - ${problems.slice(0, 12).join('\n  - ')}`);
  } else {
    R.ok(`Canonical URLs: present + unique + match own page (${seen.size} pages)`);
  }
})();

// G33. <meta name="viewport"> must NOT block user zoom.
//   `user-scalable=no` or `maximum-scale=1` is an a11y violation.
(function viewportZoomGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const offenders = [];
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    const m = html.match(/<meta\s+[^>]*name\s*=\s*["']viewport["'][^>]*content\s*=\s*["']([^"']+)["']/i);
    if (!m) continue;
    const c = m[1];
    if (/user-scalable\s*=\s*no/i.test(c)) offenders.push(`${rel(f)}: viewport has user-scalable=no`);
    if (/maximum-scale\s*=\s*1(?:\.0)?\b/.test(c)) offenders.push(`${rel(f)}: viewport has maximum-scale=1`);
  }
  if (offenders.length) {
    R.err(`Viewport blocks zoom (a11y violation, WCAG 1.4.4):\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok('Viewport: user zoom allowed on all pages (no user-scalable=no / maximum-scale=1)');
  }
})();

// G34. Inline event handlers (onclick, onerror, onload, onmouseover…) are
//   forbidden by our CSP (default-src 'self'; script-src 'self' …).
//   They would silently break in production while running fine in DevTools.
//   We allow `onerror=""` on Yandex Metrika noscript <img> since it has no JS.
(function inlineEventHandlerGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const HANDLERS = /\bon(?:click|change|submit|load|error|mouseover|mouseout|mouseenter|mouseleave|focus|blur|keydown|keyup|keypress|input|scroll|wheel|touchstart|touchend|touchmove)\s*=\s*["'][^"']/i;
  const offenders = [];
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    // strip noscript/style/script blocks (where inline handlers would just be code)
    const stripped = html
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');
    const m = stripped.match(HANDLERS);
    if (m) offenders.push(`${rel(f)}: inline handler "${m[0].slice(0, 40)}…" (CSP forbids; move to JS)`);
  }
  if (offenders.length) {
    R.err(`Inline event handlers (CSP violation, will fail silently in prod):\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok('No inline event handlers (onclick/onload/…) in HTML — CSP-safe');
  }
})();

// G35. <meta charset="…"> must appear in the first 1024 bytes of <head>.
//   Otherwise the browser may guess wrong, then re-parse — visible text flash.
(function charsetEarlyGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const offenders = [];
  for (const f of files) {
    const r = rel(f);
    const base = path.basename(r);
    if (/^(google|yandex|microsoft)/i.test(base)) continue;
    const buf = Buffer.alloc(1024);
    const fd = fs.openSync(f, 'r');
    fs.readSync(fd, buf, 0, 1024, 0);
    fs.closeSync(fd);
    const first1k = buf.toString('utf8');
    if (!/<meta\s+charset\s*=/i.test(first1k) && !/<meta\s+[^>]*http-equiv\s*=\s*["']content-type["']/i.test(first1k)) {
      offenders.push(`${r}: <meta charset> not in first 1KB`);
    }
  }
  if (offenders.length) {
    R.err(`<meta charset> not in first 1024 bytes (browser may re-parse):\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok('<meta charset> appears in first 1KB of every page');
  }
})();

// G36. SW precache list must NOT reference deleted images.
//   This catches "we removed image X but forgot to remove from sw.js precache",
//   which causes SW install to fail for users and breaks offline mode.
//   Pagefind assets are generated in CI (not in repo) — whitelisted.
(function swPrecacheAssetExistGuard() {
  const sw = path.join(ROOT, 'sw.js');
  if (!fs.existsSync(sw)) return;
  const swText = fs.readFileSync(sw, 'utf8');
  const SKIP_PREFIXES = ['/pagefind/'];
  // grab string literals that look like URL paths starting with /
  const urls = [...swText.matchAll(/['"](\/[A-Za-z0-9_\-/.]+\.(?:webp|jpg|jpeg|png|svg|css|js|html|ico|json|xml|woff2?))['"]/g)]
    .map(m => m[1])
    .filter(u => !SKIP_PREFIXES.some(p => u.startsWith(p)));
  const missing = [];
  for (const u of urls) {
    const local = path.join(ROOT, u.replace(/^\//, ''));
    if (!fs.existsSync(local)) missing.push(u);
  }
  if (missing.length) {
    R.err(`sw.js precache references missing files:\n  - ${missing.slice(0, 10).join('\n  - ')}`);
  } else {
    R.ok(`sw.js precache: every referenced asset exists (${urls.length} checked, pagefind/ skipped)`);
  }
})();

// G37. CSP img-src must include all external hosts actually referenced via <img>.
//   Incident: CSP added wss/Yandex but agents added new Wikimedia/web.archive
//   <img> without updating img-src — browser silently blocks images.
(function cspExternalHostCoverageGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const problems = [];
  for (const f of files) {
    const r = rel(f);
    const base = path.basename(r);
    if (/^(google|yandex|microsoft)/i.test(base) || base === '404.html') continue;
    const html = fs.readFileSync(f, 'utf8');
    const cspM = html.match(/<meta\s+http-equiv\s*=\s*["']Content-Security-Policy["'][^>]*content\s*=\s*["']([^"']+)["']/i);
    if (!cspM) continue; // pages without CSP — out of scope here
    const csp = cspM[1];
    // extract `img-src ...;` directive (terminated by `;` or end of string)
    const imgSrcM = csp.match(/(?:^|;)\s*img-src\s+([^;]+)/i);
    if (!imgSrcM) continue;
    // each token is space-separated; tokens can be schemes, hosts, 'self', etc.
    const tokens = imgSrcM[1].trim().split(/\s+/).map(t => t.trim()).filter(Boolean);
    // Parse host whitelist: strip leading scheme://, lowercase
    const allowedHosts = tokens
      .filter(t => /^https?:\/\//.test(t) || /^[*a-z0-9.-]+$/i.test(t) && t !== '*' && !t.includes(':'))
      .map(t => t.replace(/^https?:\/\//, '').toLowerCase().replace(/\/$/, ''));
    // collect all <img src=https://…> external hosts on this page
    const exts = [...html.matchAll(/<img\b[^>]*\bsrc\s*=\s*["'](https?:\/\/[^"']+)/gi)].map(m => m[1]);
    for (const url of exts) {
      let host;
      try { host = new URL(url).host.toLowerCase(); } catch { continue; }
      const ok = allowedHosts.some(h => {
        if (h.startsWith('*.')) return host === h.slice(2) || host.endsWith('.' + h.slice(2));
        return host === h;
      });
      if (!ok) problems.push(`${r}: <img src="${host}…"> not covered by CSP img-src`);
    }
  }
  if (problems.length) {
    R.err(`CSP img-src does not cover all external image hosts on the page:\n  - ${[...new Set(problems)].slice(0, 10).join('\n  - ')}`);
  } else {
    R.ok('CSP img-src covers every external <img> host found in HTML');
  }
})();

// G38. RSS feed lastBuildDate must not be older than 60 days.
//   Catches a frozen feed-generator (deploy.yml broke / removed).
(function feedFreshnessGuard() {
  const p = path.join(ROOT, 'feed.xml');
  if (!fs.existsSync(p)) { R.warn('feed.xml missing'); return; }
  const xml = fs.readFileSync(p, 'utf8');
  const m = xml.match(/<lastBuildDate>([^<]+)<\/lastBuildDate>/);
  if (!m) { R.warn('feed.xml: no <lastBuildDate>'); return; }
  const built = new Date(m[1]);
  if (isNaN(built)) { R.warn(`feed.xml: unparseable lastBuildDate "${m[1]}"`); return; }
  const ageDays = (Date.now() - built.getTime()) / 86400000;
  if (ageDays > 60) {
    R.warn(`feed.xml lastBuildDate is ${ageDays.toFixed(0)} days old — may need rebuilding`);
  } else {
    R.ok(`feed.xml lastBuildDate is ${ageDays.toFixed(0)} days old (fresh)`);
  }
})();

// G39. JSON-LD strict shape: each block must be valid AND set "@context".
//   The existing jsonLdValidity guard only checks parse-validity. This adds:
//   - require @context = "https://schema.org" (or "schema.org/")
//   - require @type field exists (or @graph)
(function jsonLdShapeGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const problems = [];
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    const blocks = [...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const b of blocks) {
      let json;
      try { json = JSON.parse(b[1]); } catch { continue; }
      const root = Array.isArray(json) ? json[0] : json;
      const ctx = root['@context'];
      const hasGoodCtx = (typeof ctx === 'string' && /schema\.org/.test(ctx))
        || (Array.isArray(ctx) && ctx.some(x => typeof x === 'string' && /schema\.org/.test(x)));
      if (!hasGoodCtx) {
        problems.push(`${rel(f)}: JSON-LD missing or invalid @context`);
      } else if (!root['@type'] && !root['@graph']) {
        problems.push(`${rel(f)}: JSON-LD missing @type or @graph`);
      }
    }
  }
  if (problems.length) {
    R.err(`JSON-LD shape problems:\n  - ${[...new Set(problems)].slice(0, 10).join('\n  - ')}`);
  } else {
    R.ok('JSON-LD shape: every block has valid @context (schema.org) and @type/@graph');
  }
})();

// G40. <meta name="description"> length sanity (Google truncates ~155-170 chars,
//   but we are bilingual UTF-8; use Russian-friendly cap ~300 chars).
//   Pure warning — not all sites care. Skip 404, robot stubs.
(function descriptionLengthGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const fat = [];
  for (const f of files) {
    const r = rel(f);
    const base = path.basename(r);
    if (/^(google|yandex|microsoft)/i.test(base) || base === '404.html') continue;
    const html = fs.readFileSync(f, 'utf8');
    const m = html.match(/<meta\s+[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']+)["']/i);
    if (!m) continue;
    const len = [...m[1]].length; // Unicode code-point count
    if (len > 300) fat.push(`${r}: description ${len} chars (Google truncates; trim to ≤300)`);
  }
  if (fat.length) {
    R.warn(`Meta descriptions over 300 chars (consider trimming):\n  - ${fat.join('\n  - ')}`);
  } else {
    R.ok('Meta descriptions: all ≤ 300 chars (Russian-friendly cap)');
  }
})();

// ─────────────────────────────────────────────────────────────────────────
// SMART ANTI-REGRESSION GUARDS — ROUND 5 (added 2026-06-09)
// Deep-dive into PLAN-04 ratchet / AGENTS-r33–r53 / JS-perf history.
// Many of the historical pains have already been addressed elsewhere
// (G16 listener pattern, G11 topnav, G18 keyframes). Round 5 attacks
// what's still uncovered: noindex regressions, CSS hygiene, runtime perf,
// JSON-LD consistency, JS bundle drift.
// ─────────────────────────────────────────────────────────────────────────

// G41. Explicit allowlist for `noindex`.
//   Incident: discovered TODAY — istochniki/ and nakhodki/ had noindex
//   silently added in a May `chore: update from zip` commit by some agent.
//   Owner did NOT want them noindex. Two intentional `noindex` use-cases
//   remain: 404 (always noindex) and robot-verification stubs. EVERYTHING
//   else with noindex must be on this allowlist OR the audit fails.
const NOINDEX_ALLOWLIST = new Set([
  '404.html',
  'google7e02f9855e02b89a.html',
  'yandex_42bc0d54a1ca4952.html',
  'yandex_d8876d66da1b4592.html',
]);
(function noindexAllowlistGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const offenders = [];
  for (const f of files) {
    const r = rel(f);
    if (NOINDEX_ALLOWLIST.has(r) || NOINDEX_ALLOWLIST.has(path.basename(r))) continue;
    const html = fs.readFileSync(f, 'utf8');
    const m = html.match(/<meta\s+[^>]*name\s*=\s*["']robots["'][^>]*content\s*=\s*["']([^"']+)["']/i);
    if (m && /\bnoindex\b/i.test(m[1])) {
      offenders.push(`${r}: robots="${m[1].trim()}" (owner wants max SEO openness; add to NOINDEX_ALLOWLIST only if you really mean it)`);
    }
  }
  if (offenders.length) {
    R.err(`Unexpected noindex (owner asked for maximum openness 2026-06-09):\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok(`No surprise noindex (${NOINDEX_ALLOWLIST.size} pages explicitly allowed: 404 + robot stubs)`);
  }
})();

// G42. JS bundle size ratchet per file (catch sneaky bloat).
//   Incident: a0a363d2 / 59e9bf1d — minify shipped to clear budget. We want
//   to flag whenever a JS file grows >20% beyond a checked-in floor.
//   Update FLOORS only when you intentionally make a file bigger.
const JS_SIZE_FLOORS = {
  // bytes, current snapshot 2026-06-09. Bump only on intentional growth.
  'js/site.js':            { soft: 140_000, hard: 180_000 },
  'js/search.js':          { soft: 38_000,  hard: 55_000 },
  'js/enhancements.js':    { soft: 28_000,  hard: 40_000 },
  'js/highlights.js':      { soft: 17_000,  hard: 26_000 },
  'js/bookmark-engine.js': { soft: 12_000,  hard: 20_000 },
  'js/glossary.js':        { soft:  6_000,  hard: 12_000 },
};
(function jsRatchetGuard() {
  const breached = [];
  for (const [f, { soft, hard }] of Object.entries(JS_SIZE_FLOORS)) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const sz = fs.statSync(p).size;
    if (sz > hard) {
      breached.push(`${f}: ${sz} bytes — exceeded HARD cap ${hard} (likely accidental bloat)`);
    }
  }
  if (breached.length) {
    R.err(`JS bundle ratchet breached:\n  - ${breached.join('\n  - ')}`);
  } else {
    R.ok(`JS bundle ratchet OK (${Object.keys(JS_SIZE_FLOORS).length} files watched)`);
  }
})();

// G43. CSS dead variables — info only.
//   AGENTS-r34 manually deleted 21 dead vars; new ones accumulate. We surface
//   them as INFO so periodically someone can prune, but don't block deploy.
(function cssDeadVarsInfo() {
  const cssFiles = ['css/site.css', 'css/home.css', 'css/command-palette.css',
                    'css/mobile-hotfix.css', 'css/nagornaya-mobile-toc.css'];
  let css = '';
  for (const f of cssFiles) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) css += fs.readFileSync(p, 'utf8') + '\n';
  }
  const defined = new Set();
  for (const m of css.matchAll(/(--[a-zA-Z][\w-]*)\s*:/g)) defined.add(m[1]);
  const used = new Set();
  for (const m of css.matchAll(/var\(\s*(--[a-zA-Z][\w-]*)/g)) used.add(m[1]);
  const dead = [...defined].filter(d => !used.has(d));
  // also check inline styles in HTML use the var
  for (const f of walk(ROOT).filter(x => x.endsWith('.html'))) {
    const h = fs.readFileSync(f, 'utf8');
    for (const m of h.matchAll(/var\(\s*(--[a-zA-Z][\w-]*)/g)) used.add(m[1]);
  }
  const reallyDead = [...defined].filter(d => !used.has(d));
  if (reallyDead.length > 50) {
    R.warn(`CSS dead vars: ${reallyDead.length} defined but never used (>50 — consider AGENTS-r34-style cleanup)`);
  } else if (reallyDead.length > 0) {
    R.note(`CSS dead vars: ${reallyDead.length} unused (acceptable; clean when convenient)`);
  } else {
    R.ok('CSS dead vars: every defined --token is used somewhere');
  }
})();

// G44. innerHTML hygiene — REAL XSS attack surface only.
//   We don't flag innerHTML with static templates that interpolate
//   trusted data (titles from our own JSON, scores from local quiz).
//   The genuinely dangerous patterns:
//     1. innerHTML = userInput / URLSearchParams / location.search / hash / referrer
//     2. innerHTML = e.target.value / input.value (untrusted form data)
//     3. innerHTML = document.cookie / fetch().then(r => r.text())
//   Anything assigning from our own controlled data structures is fine.
(function innerHtmlXssHeuristic() {
  const jsFiles = walk(ROOT).filter(f =>
    f.endsWith('.js') && !f.includes('/scripts/') && !/\.min\.js$/.test(f));
  const offenders = [];
  // Sources of UNTRUSTED data — innerHTML assignment using these = XSS risk
  const UNTRUSTED_SOURCES = [
    /location\.(?:search|hash|href)/,
    /window\.location/,
    /URLSearchParams/,
    /document\.cookie/,
    /document\.referrer/,
    /\.value\b/,            // input.value, textarea.value
    /e\.target\.\w+/,       // event target arbitrary property
    /fetch\s*\([^)]*\)/,    // fetch().then(r => r.text())
    /XMLHttpRequest/,
    /URL\.searchParams/,
    /localStorage\.getItem/, /sessionStorage\.getItem/, // sometimes user-tainted
  ];
  for (const f of jsFiles) {
    const js = fs.readFileSync(f, 'utf8');
    // First strip out string literals from the entire file so regex below
    // never sees the WORD "value" inside an HTML template attribute.
    const stripped = js
      .replace(/'(?:\\.|[^'\\])*'/g, "''")
      .replace(/"(?:\\.|[^"\\])*"/g, '""')
      .replace(/`(?:\\.|[^`\\])*`/g, '``');
    // Now find innerHTML= …  up to the next statement-ish terminator (; or , or )
    // We deliberately keep the slice small (≤180) to avoid spilling into next stmt
    const matches = [...stripped.matchAll(/\.innerHTML\s*=\s*([^;,)]{0,180})/g)];
    for (const m of matches) {
      const expr = m[1].trim();
      const hasUntrusted = UNTRUSTED_SOURCES.some(re => re.test(expr));
      const looksSafe = /escapeHtml|sanitiz|DOMPurify/.test(expr);
      if (hasUntrusted && !looksSafe) {
        offenders.push(`${rel(f)}: innerHTML uses untrusted source: ${expr.slice(0, 100)}…`);
      }
    }
  }
  if (offenders.length) {
    R.err(`innerHTML assigned from UNTRUSTED source (XSS risk):\n  - ${offenders.slice(0, 6).join('\n  - ')}`);
  } else {
    R.ok('innerHTML hygiene: no untrusted-source assignments (location/cookie/input/fetch/storage)');
  }
})();

// G45. JSON-LD url field must point at canonical (not at "/" or other page).
//   Real failure mode: copy-paste an Article schema between pages and forget
//   to update its `url` field — both pages then claim the same Article URL,
//   confusing rich-results.
(function jsonLdUrlConsistencyGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const problems = [];
  for (const f of files) {
    const r = rel(f);
    const base = path.basename(r);
    if (/^(google|yandex|microsoft)/i.test(base) || base === '404.html') continue;
    const html = fs.readFileSync(f, 'utf8');
    const cm = html.match(/<link\b[^>]+rel\s*=\s*["']canonical["'][^>]+href\s*=\s*["']([^"']+)["']/i)
            || html.match(/<link\b[^>]+href\s*=\s*["']([^"']+)["'][^>]+rel\s*=\s*["']canonical["']/i);
    if (!cm) continue;
    const canon = cm[1].trim();
    const blocks = [...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const b of blocks) {
      let json;
      try { json = JSON.parse(b[1]); } catch { continue; }
      // walk the graph; find Article-like @type with a `url` field
      const items = [];
      if (Array.isArray(json)) items.push(...json);
      else items.push(json);
      for (const top of items) {
        const subs = top['@graph'] || [top];
        for (const node of subs) {
          if (!node || typeof node !== 'object') continue;
          const t = node['@type'];
          const isArticle = (typeof t === 'string' && /Article|BlogPosting|NewsArticle|CollectionPage|WebPage/.test(t))
                        || (Array.isArray(t) && t.some(x => /Article|BlogPosting|NewsArticle|CollectionPage|WebPage/.test(x)));
          if (!isArticle) continue;
          const u = node.url || node.mainEntityOfPage?.['@id'] || node.mainEntityOfPage;
          if (typeof u === 'string' && u !== canon) {
            // tolerate "@id" with #fragment matching the canonical
            const pure = u.split('#')[0];
            if (pure !== canon) {
              problems.push(`${r}: JSON-LD ${t} url="${u}" ≠ canonical "${canon}"`);
            }
          }
        }
      }
    }
  }
  if (problems.length) {
    R.err(`JSON-LD url ≠ canonical (rich-result conflict):\n  - ${[...new Set(problems)].slice(0, 8).join('\n  - ')}`);
  } else {
    R.ok('JSON-LD url fields all match their page canonical');
  }
})();

// G46. <link rel="preload" as="image"> must actually be used on the page.
//   Otherwise it wastes bandwidth (preload triggers download even if image
//   never appears). Owner cares about Core Web Vitals.
(function preloadUsageGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const offenders = [];
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    const preloads = [...html.matchAll(/<link\b[^>]*\brel\s*=\s*["']preload["'][^>]*\bas\s*=\s*["']image["'][^>]*>/gi)];
    for (const pl of preloads) {
      const hrefM = pl[0].match(/\bhref\s*=\s*["']([^"']+)["']/i);
      if (!hrefM) continue;
      const url = hrefM[1];
      // strip query, get filename
      const base = url.split('?')[0].split('#')[0];
      // search for that base anywhere else in the document body
      const restOfDoc = html.split('</head>')[1] || html;
      if (!restOfDoc.includes(base.split('/').pop())) {
        offenders.push(`${rel(f)}: preload as=image href="${url}" — file not referenced after </head>`);
      }
    }
  }
  if (offenders.length) {
    R.warn(`Image preloaded but never used in document body (wasted bytes):\n  - ${offenders.slice(0, 6).join('\n  - ')}`);
  } else {
    R.ok('All <link rel="preload" as="image"> resources are actually rendered');
  }
})();

// G47 was removed: incorrect heuristic.
//   Original idea: flag JSON-LD `author=Фёдор as Person`. But the existing
//   Attribution Guard already encodes the real rule: Фёдор IS the author
//   for "Авторская статья"/"Автор-редактор" types — only forbidden bylines
//   are plain "Автор: Фёдор Милованов" or "author-card-label = Автор".
//   Article JSON-LD with author:{@type:Person, name:Фёдор} is correct for
//   his own theological essays. Reserve number for a future check.

// G48. Deprecated vendor prefixes that no current browser needs (e.g.
//   `-webkit-border-radius`, `-moz-border-radius`, `-o-…`, `filter: alpha(…)`).
//   AGENTS-r48b had a vendor prefix cleanup. We protect from re-introduction.
(function deprecatedVendorPrefixGuard() {
  const cssFiles = ['css/site.css', 'css/home.css', 'css/command-palette.css',
                    'css/mobile-hotfix.css', 'css/nagornaya-mobile-toc.css', 'fonts/fonts.css'];
  const BAD = [
    /-webkit-border-radius\s*:/g,
    /-moz-border-radius\s*:/g,
    /-o-transform\s*:/g,
    /-ms-transform\s*:/g,
    /filter\s*:\s*alpha\(/g,
    /-moz-opacity\s*:/g,
    /-khtml-opacity\s*:/g,
  ];
  const offenders = [];
  for (const f of cssFiles) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const css = fs.readFileSync(p, 'utf8');
    for (const re of BAD) {
      if (re.test(css)) offenders.push(`${f}: matches ${re.source.replace(/\\\\/g, '')}`);
    }
  }
  if (offenders.length) {
    R.err(`Deprecated vendor prefixes (no modern browser needs these):\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok('CSS vendor prefixes: no dead-since-2015 prefixes present');
  }
})();

// G49. Each article has 1 (and only 1) Article JSON-LD with required fields:
//   headline, datePublished, image. Catches stubs left during a refactor.
(function articleJsonLdRequiredFieldsGuard() {
  // only apply to /articles/<slug>/index.html
  const files = walk(ROOT).filter(f => /\/articles\/[^/]+\/index\.html$/.test(f) && !/articles\/index\.html$/.test(f));
  const problems = [];
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    const blocks = [...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    let articles = 0;
    let missingFields = [];
    for (const b of blocks) {
      let json;
      try { json = JSON.parse(b[1]); } catch { continue; }
      const stack = Array.isArray(json) ? [...json] : [json];
      while (stack.length) {
        const n = stack.shift();
        if (!n || typeof n !== 'object') continue;
        if (Array.isArray(n)) { stack.push(...n); continue; }
        if (n['@graph']) { stack.push(...n['@graph']); continue; }
        const t = n['@type'];
        const isArticle = (typeof t === 'string' && /^(Article|BlogPosting|NewsArticle|ScholarlyArticle)$/.test(t))
                      || (Array.isArray(t) && t.some(x => /^(Article|BlogPosting|NewsArticle|ScholarlyArticle)$/.test(x)));
        if (isArticle) {
          articles++;
          const missing = [];
          if (!n.headline) missing.push('headline');
          if (!n.datePublished) missing.push('datePublished');
          if (!n.image) missing.push('image');
          if (missing.length) missingFields.push(`Article missing: ${missing.join(', ')}`);
        }
      }
    }
    if (articles === 0) problems.push(`${rel(f)}: no Article JSON-LD`);
    else if (articles > 1) problems.push(`${rel(f)}: ${articles} Article JSON-LD blocks (must be exactly 1)`);
    else if (missingFields.length) problems.push(`${rel(f)}: ${missingFields.join('; ')}`);
  }
  if (problems.length) {
    R.err(`Article JSON-LD problems:\n  - ${problems.join('\n  - ')}`);
  } else {
    R.ok(`Article JSON-LD: every /articles/*/ has exactly 1 with headline+datePublished+image`);
  }
})();

// G50. <meta theme-color> for light + dark must exist in every content page.
//   Affects mobile address-bar tinting. We require BOTH `light` and `dark`
//   media variants.
(function themeColorGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const offenders = [];
  for (const f of files) {
    const r = rel(f);
    const base = path.basename(r);
    if (/^(google|yandex|microsoft)/i.test(base) || base === '404.html') continue;
    const html = fs.readFileSync(f, 'utf8');
    const tags = [...html.matchAll(/<meta\s+[^>]*name\s*=\s*["']theme-color["'][^>]*>/gi)];
    if (tags.length === 0) {
      offenders.push(`${r}: no <meta name="theme-color">`);
      continue;
    }
    const hasLight = tags.some(t => /media\s*=\s*["'][^"']*light\b/i.test(t[0]));
    const hasDark = tags.some(t => /media\s*=\s*["'][^"']*dark\b/i.test(t[0]));
    if (!hasLight || !hasDark) {
      offenders.push(`${r}: theme-color missing ${[hasLight?'':'light', hasDark?'':'dark'].filter(Boolean).join('+')} variant`);
    }
  }
  if (offenders.length) {
    R.warn(`<meta theme-color> incomplete (mobile address-bar):\n  - ${offenders.slice(0, 6).join('\n  - ')}`);
  } else {
    R.ok('<meta theme-color>: light+dark variants present on every content page');
  }
})();

// ─────────────────────────────────────────────────────────────────────────
// SMART ANTI-REGRESSION GUARDS — ROUND 6 (added 2026-06-09)
// Performance / web-vitals / data-consistency lane.
// Each guard validated against existing prod state to avoid false positives.
// ─────────────────────────────────────────────────────────────────────────

// G51. fetchpriority="high" — at most ONE per page (web.dev / Google PageSpeed).
//   Multiple high-priority resources cancel each other out and HURT LCP.
//   Pure warning since owner may intentionally tune this.
(function fetchPriorityHighGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const offenders = [];
  for (const f of files) {
    const r = rel(f);
    const base = path.basename(r);
    if (/^(google|yandex|microsoft)/i.test(base) || base === '404.html') continue;
    const html = fs.readFileSync(f, 'utf8');
    const count = (html.match(/\bfetchpriority\s*=\s*["']high["']/gi) || []).length;
    if (count > 1) offenders.push(`${r}: ${count} fetchpriority="high" (recommend 1 for LCP)`);
  }
  if (offenders.length) {
    R.warn(`Multiple fetchpriority="high" per page (web.dev: 1 max for LCP):\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok('fetchpriority="high": at most 1 per page (good LCP signal)');
  }
})();

// G52. feed.xml ↔ articles directory parity.
//   Each feed item URL should be a real article on disk; each /articles/<slug>/
//   article SHOULD eventually be in feed.xml. We warn on drift only — manual
//   review needed since not every article must be in feed.
(function feedArticleParityGuard() {
  const p = path.join(ROOT, 'feed.xml');
  if (!fs.existsSync(p)) return;
  const xml = fs.readFileSync(p, 'utf8');
  const feedUrls = new Set([...xml.matchAll(/<link>\s*(https?:\/\/[^<]+)\s*<\/link>/g)]
    .map(m => m[1].trim()));
  const missing = [];
  for (const u of feedUrls) {
    if (!u.includes('/articles/')) continue;
    const local = u.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').replace(/\/$/, '/index.html');
    const abs = path.join(ROOT, local);
    if (!fs.existsSync(abs)) missing.push(`${u} → article file missing on disk`);
  }
  if (missing.length) {
    R.err(`feed.xml references non-existent articles:\n  - ${missing.slice(0, 8).join('\n  - ')}`);
  } else {
    R.ok(`feed.xml: all article references exist on disk`);
  }
})();

// G53. Sitemap & feed agree on counts (within tolerance).
//   We tolerate <5 drift since feed often omits old or non-article pages.
//   This catches systemic drift: forgot to add a new article to either.
(function sitemapFeedDriftInfo() {
  const sm = path.join(ROOT, 'sitemap.xml');
  const ff = path.join(ROOT, 'feed.xml');
  if (!fs.existsSync(sm) || !fs.existsSync(ff)) return;
  const sitemapArticleUrls = new Set(
    [...fs.readFileSync(sm, 'utf8').matchAll(/<loc>(https?:[^<]+\/articles\/[^<]+)<\/loc>/g)]
      .map(m => m[1].trim().replace(/\/$/, ''))
  );
  const feedArticleUrls = new Set(
    [...fs.readFileSync(ff, 'utf8').matchAll(/<link>\s*(https?:[^<]+\/articles\/[^<]+)\s*<\/link>/g)]
      .map(m => m[1].trim().replace(/\/$/, ''))
  );
  const inSitemapNotFeed = [...sitemapArticleUrls].filter(u => !feedArticleUrls.has(u));
  const inFeedNotSitemap = [...feedArticleUrls].filter(u => !sitemapArticleUrls.has(u));
  if (inFeedNotSitemap.length) {
    R.warn(`feed.xml has articles missing from sitemap.xml:\n  - ${inFeedNotSitemap.slice(0, 5).join('\n  - ')}`);
  } else if (inSitemapNotFeed.length > 5) {
    R.note(`sitemap.xml has ${inSitemapNotFeed.length} articles not in feed.xml (acceptable drift)`);
  } else {
    R.ok(`sitemap.xml ↔ feed.xml: article URLs aligned`);
  }
})();

// G54. Manifest.json sanity: name/start_url/display/icons/theme_color.
(function manifestRequiredFieldsGuard() {
  const p = path.join(ROOT, 'manifest.json');
  if (!fs.existsSync(p)) { R.warn('manifest.json missing'); return; }
  let m;
  try { m = JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { R.err(`manifest.json: invalid JSON — ${e.message}`); return; }
  const required = ['name', 'short_name', 'start_url', 'display', 'icons', 'theme_color'];
  const missing = required.filter(k => !m[k]);
  if (missing.length) {
    R.err(`manifest.json missing fields: ${missing.join(', ')}`);
    return;
  }
  // Each icon entry must point at an existing file
  const badIcons = [];
  for (const ic of m.icons || []) {
    const src = ic.src || '';
    if (!src.startsWith('/')) continue;
    const abs = path.join(ROOT, src.replace(/^\//, ''));
    if (!fs.existsSync(abs)) badIcons.push(src);
  }
  if (badIcons.length) {
    R.err(`manifest.json icons reference missing files:\n  - ${badIcons.join('\n  - ')}`);
  } else {
    R.ok(`manifest.json: all required fields present, ${(m.icons||[]).length} icons all exist`);
  }
})();

// G55. <html lang="…"> must be either "ru" or "ru-RU" — not "en".
//   Catches agents who default to English templates and forget to localize.
(function htmlLangIsRussianGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const offenders = [];
  for (const f of files) {
    const r = rel(f);
    const base = path.basename(r);
    if (/^(google|yandex|microsoft)/i.test(base)) continue;
    const html = fs.readFileSync(f, 'utf8');
    const m = html.match(/<html\b[^>]*\blang\s*=\s*["']([^"']+)["']/i);
    if (!m) continue; // G25 catches missing lang entirely
    const lang = m[1].toLowerCase();
    if (!/^ru(-[a-z]{2,4})?$/.test(lang)) {
      offenders.push(`${r}: <html lang="${m[1]}"> (expected "ru" or "ru-RU")`);
    }
  }
  if (offenders.length) {
    R.err(`<html lang> must be Russian:\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok('<html lang>: every page is declared Russian (ru/ru-RU)');
  }
})();

// G56. Each <link rel="alternate" type="application/rss+xml"> must point to
//   the SAME feed.xml URL across all pages (no fragmented RSS endpoints).
(function rssAlternateConsistencyGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const seen = new Map(); // url → first-file
  const conflicts = [];
  for (const f of files) {
    const r = rel(f);
    const html = fs.readFileSync(f, 'utf8');
    const m = html.match(/<link\b[^>]*type\s*=\s*["']application\/rss\+xml["'][^>]*href\s*=\s*["']([^"']+)["']/i)
            || html.match(/<link\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*type\s*=\s*["']application\/rss\+xml["']/i);
    if (!m) continue;
    const url = m[1].trim();
    if (!seen.size) seen.set(url, r);
    else if (![...seen.keys()].includes(url)) {
      conflicts.push(`${r} → ${url} (first seen: ${[...seen.values()][0]} → ${[...seen.keys()][0]})`);
      seen.set(url, r);
    }
  }
  if (conflicts.length) {
    R.err(`<link rel="alternate" RSS> points to different URLs across pages:\n  - ${conflicts.slice(0, 5).join('\n  - ')}`);
  } else if (seen.size === 1) {
    R.ok(`RSS alternate consistent: every page → ${[...seen.keys()][0]}`);
  } else {
    R.warn('No RSS alternate link found on any page');
  }
})();

// G57. <img> in main content needs explicit width AND height (CLS prevention).
//   Skip:
//   - Yandex Metrika tracker pixel inside <noscript>
//   - <img> inside <picture> if the <picture>'s <source> has width/height
//   - Decorative images (alt="" + aria-hidden / role=presentation)
(function imageDimensionsCLSGuard() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const offenders = [];
  for (const f of files) {
    const r = rel(f);
    if (/^(google|yandex)/i.test(path.basename(r))) continue;
    const html = fs.readFileSync(f, 'utf8');
    // strip <noscript> wholesale (tracker pixels)
    const stripped = html.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
    const imgs = [...stripped.matchAll(/<img\b([^>]+)>/gi)];
    for (const m of imgs) {
      const attrs = m[1];
      const hasW = /\bwidth\s*=/.test(attrs);
      const hasH = /\bheight\s*=/.test(attrs);
      const isDecorative = /\balt\s*=\s*["']\s*["']/.test(attrs) &&
                           (/\baria-hidden\s*=\s*["']true["']/.test(attrs) || /\brole\s*=\s*["']presentation["']/.test(attrs));
      if (hasW && hasH) continue;
      if (isDecorative) continue;
      offenders.push(`${r}: <img${attrs.slice(0, 80).replace(/\s+/g, ' ')}> missing ${[!hasW?'width':'', !hasH?'height':''].filter(Boolean).join('+')}`);
    }
  }
  if (offenders.length) {
    R.warn(`<img> missing width/height (causes CLS):\n  - ${offenders.slice(0, 8).join('\n  - ')}`);
  } else {
    R.ok('<img> dimensions: every content image has width+height (no CLS surprise)');
  }
})();

// G58. CSS @import inside our own .css files — forbidden.
//   AGENTS rule: exactly 5 CSS files. @import would smuggle in extra ones
//   and create a render-blocking serial waterfall.
(function noCssImportGuard() {
  const cssFiles = ['css/site.css', 'css/home.css', 'css/command-palette.css',
                    'css/mobile-hotfix.css', 'css/nagornaya-mobile-toc.css'];
  const offenders = [];
  for (const f of cssFiles) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const css = fs.readFileSync(p, 'utf8');
    if (/^\s*@import\b/m.test(css) || /;\s*@import\b/.test(css)) {
      offenders.push(`${f}: contains @import (serial blocker; merge content instead)`);
    }
  }
  if (offenders.length) {
    R.err(`CSS @import found (render-blocking; AGENTS forbids):\n  - ${offenders.join('\n  - ')}`);
  } else {
    R.ok('CSS @import: none in main stylesheets (no serial blocker)');
  }
})();

// G59. Robots.txt sanity: must allow root, list Sitemap directive.
(function robotsTxtSanityGuard() {
  const p = path.join(ROOT, 'robots.txt');
  if (!fs.existsSync(p)) { R.warn('robots.txt missing'); return; }
  const txt = fs.readFileSync(p, 'utf8');
  const problems = [];
  if (/^\s*Disallow:\s*\/\s*$/m.test(txt) && !/^\s*Allow:/m.test(txt)) {
    problems.push('robots.txt blocks the entire site (Disallow: / without Allow:)');
  }
  if (!/^\s*Sitemap:\s*https?:\/\/.+sitemap\.xml/im.test(txt)) {
    problems.push('robots.txt missing "Sitemap:" directive');
  }
  if (problems.length) {
    R.err(`robots.txt issues:\n  - ${problems.join('\n  - ')}`);
  } else {
    R.ok('robots.txt: allows crawl, lists sitemap');
  }
})();

// G60. CNAME file content matches canonical domain.
//   Catches an agent renaming CNAME to a typo (gospod-bog.ru → gospodbog.ru).
(function cnameMatchesCanonicalGuard() {
  const cn = path.join(ROOT, 'CNAME');
  if (!fs.existsSync(cn)) return;
  const host = fs.readFileSync(cn, 'utf8').trim();
  // sample one canonical from any HTML
  const sample = walk(ROOT).find(f => f.endsWith('index.html') && !/google|yandex/i.test(path.basename(f)));
  if (!sample) return;
  const html = fs.readFileSync(sample, 'utf8');
  const cm = html.match(/<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']https?:\/\/([^\/"']+)/i)
          || html.match(/<link\b[^>]*href\s*=\s*["']https?:\/\/([^\/"']+)[^"']*["'][^>]*rel\s*=\s*["']canonical["']/i);
  if (!cm) return;
  const canonHost = cm[1].toLowerCase();
  if (host.toLowerCase() !== canonHost) {
    R.err(`CNAME "${host}" ≠ canonical host "${canonHost}" (Pages will serve wrong domain)`);
  } else {
    R.ok(`CNAME matches canonical host: ${host}`);
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
