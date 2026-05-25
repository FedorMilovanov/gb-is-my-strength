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

const MAX_CSS_TOTAL = 370_000; // v12 + a11y + v9 premium underline/stacked-table/vp; gzip ~67KB
const MAX_JS_TOTAL = 365_000; // includes sw.js + mobile utils; site.js is intentionally large right now
const MAX_HTML = 450_000;
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

// 4. JSON validity
(function jsonValidity() {
  const jsonFiles = allFiles.filter(p => p.endsWith('.json')).map(rel).sort();
  let bad = 0;
  for (const f of jsonFiles) {
    try { JSON.parse(read(f)); }
    catch (e) { bad++; R.err(`Invalid JSON: ${f}: ${e.message}`); }
  }
  if (!bad) R.ok(`JSON valid (${jsonFiles.length} files)`);
})();

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
(function attributionGuard() {
  let bad = 0;
  for (const p of htmlPages) {
    const file = rel(p);
    const html = fs.readFileSync(p, 'utf8');
    if (/Автор\s*:\s*Ф[её]дор\s+Милованов/i.test(html)) { bad++; R.err(`Attribution violation in ${file}: "Автор: Фёдор Милованов"`); }
    if (/author-card-label[^>]*>\s*Автор\s*</i.test(html)) { bad++; R.err(`Attribution violation in ${file}: author-card-label is "Автор"`); }
    if (/^articles\/[^/]+\/index\.html$/.test(file)) {
      const byline = html.match(/<span\s+class=["']article-byline__strong["']>([^<]+)<\/span>/i)?.[1]?.trim() || '';
      if (!/^(Редактор:|Редакция перевода:)\s*Ф[её]дор\s+Милованов/.test(byline)) {
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
      const abs = path.join(ROOT, url.replace(/^\//, ''));
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
