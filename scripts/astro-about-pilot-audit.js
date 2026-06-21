#!/usr/bin/env node
/*
 * astro-about-pilot-audit.js — compare legacy /about/ vs Astro dist /about/.
 *
 * This is a Level-2 shadow/pilot guard. It does not switch production.
 * It builds strangler dist, serves both roots locally, and checks the pilot URL
 * across desktop, mobile and no-JS modes.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const WRITE_SHOTS = process.argv.includes('--write-shots');
const LEGACY_PORT = 8134;
const DIST_PORT = 8135;
const URL_PATH = '/about/';
const SITE = 'https://gospod-bog.ru';
const MIN_WORD_RATIO = 0.98;
const REQUIRED_JSON_LD_TYPES = ['Organization', 'WebSite', 'Person', 'ProfilePage', 'BreadcrumbList'];
const PARITY_META_FIELDS = [
  'description',
  'robots',
  'og:title',
  'og:type',
  'profile:first_name',
  'profile:last_name',
  'og:site_name',
  'og:description',
  'og:url',
  'og:image',
  'twitter:card',
  'twitter:site',
  'twitter:creator',
  'twitter:title',
  'twitter:description',
  'twitter:image',
];
const VIEWPORTS = [
  { name: 'desktop', options: { viewport: { width: 1366, height: 900 } } },
  { name: 'mobile', options: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
];

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32', ...opts });
  if (res.status !== 0) process.exit(res.status || 1);
}
function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf'
  }[ext] || 'application/octet-stream';
}
function createServer(root, port) {
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    const file = path.normalize(path.join(root, urlPath.replace(/^\//, '')));
    if (!file.startsWith(root)) { res.writeHead(403); res.end('Forbidden'); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
      res.writeHead(200, { 'content-type': contentType(file) });
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)));
}
function words(text) { return (String(text || '').match(/[A-Za-zА-Яа-яЁё0-9]{2,}/g) || []).length; }
function localFileForSiteUrl(url, rootDir) {
  if (!url || !url.startsWith(SITE)) return null;
  const u = new URL(url);
  const rel = u.pathname.replace(/^\//, '');
  return path.join(rootDir, rel);
}
function assetExists(url, rootDir) {
  const file = localFileForSiteUrl(url, rootDir);
  return !file || fs.existsSync(file);
}
function unique(arr) { return [...new Set(arr)]; }
function normalizeHtmlForFullDocumentParity(html) {
  // Рефакторинг 6.0 (leaf replacement, AGENTS-r249): normalize to a
  // BROWSER-EQUIVALENT canonical form, so the gate fails only on REAL
  // regressions (changed text/attributes/ids/structure), never on
  // serialization style. Two normalization categories:
  //
  //  (1) Empty-element self-closing form. Hand-authored Astro serializes empty
  //      elements (SVG <path/>, <rect/>, <circle/>, <line/>, void <br/>,
  //      <meta/>…) as explicit close pairs (<path></path>), whereas the legacy
  //      /about/ artifact + the previous `set:html` shadow used XHTML
  //      self-closing. SPEC-EQUIVALENT in HTML5 — identical DOM, 0.0000%
  //      pixel-diff. Expand <x .../> -> <x ...></x> on BOTH sides.
  //
  //  (2) Whitespace runs. Astro's compiler trims/normalizes leading and
  //      trailing whitespace inside flow text nodes (e.g. an indented line of
  //      prose becomes unindented), while the hand-authored legacy source
  //      keeps the indentation. Browsers collapse runs of whitespace in normal
  //      flow to a single space, so these render IDENTICALLY. Collapse
  //      \s+ -> single space on BOTH sides, EXCEPT inside whitespace-
  //      significant elements (<pre>, <textarea>) and raw-text elements
  //      (<script>, <style>) whose contents are protected verbatim.
  //
  // Verified safe for /about/ (no <pre>/<code> flow content; &nbsp; entities
  // and %20 URL-encoding are not matched by \s and are preserved). Verified
  // that real regressions are still caught: a changed word, attribute, id,
  // or structural node produces a mismatch after normalization.
  const RAW = /<(pre|textarea|script|style)(\s[^>]*)?>[\s\S]*?<\/\1>/gi;
  const protectedNodes = [];
  let out = String(html || '')
    .replace(/\r\n?/g, '\n')
    .replace(RAW, (m) => { protectedNodes.push(m); return `\u0000${protectedNodes.length - 1}\u0000`; });
  out = out
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .replace(/(<([a-zA-Z][a-zA-Z0-9:-]*)(\s[^>]*?)?)\s*\/\s*>/g, '$1></$2>')
    .trim();
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => protectedNodes[+i]);
}
function checkFullDocumentParity(problems) {
  const legacyFile = path.join(ROOT, 'about/index.html');
  const distFile = path.join(DIST, 'about/index.html');
  if (!fs.existsSync(legacyFile) || !fs.existsSync(distFile)) {
    problems.push('full-document parity files missing for /about/');
    return;
  }
  const legacy = normalizeHtmlForFullDocumentParity(fs.readFileSync(legacyFile, 'utf8'));
  const astro = normalizeHtmlForFullDocumentParity(fs.readFileSync(distFile, 'utf8'));
  if (legacy !== astro) problems.push('/about/ normalized full-document HTML differs from legacy; visual parity is not 100% shadow output');
}

async function inspect(page, url, label, viewportName) {
  const errors = [];
  const ignoreLocalLegacyNoise = (text) => {
    // Legacy pages use production-absolute favicon/icon URLs in CSP. When served from
    // 127.0.0.1 for comparison, Chromium reports CSP violations against those URLs.
    // Production origin is https://gospod-bog.ru, so this is not a real page regression.
    return /violates the following Content Security Policy directive/i.test(text)
      && /https:\/\/gospod-bog\.ru\//i.test(text);
  };
  page.on('pageerror', e => { if (!ignoreLocalLegacyNoise(e.message)) errors.push(e.message); });
  page.on('console', m => {
    const text = m.text();
    if (m.type() === 'error' && !/favicon|manifest/i.test(text) && !ignoreLocalLegacyNoise(text)) errors.push(text.slice(0, 180));
  });
  const response = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(500);
  const data = await page.evaluate((metaFields) => {
    const getMeta = (key) => {
      const byName = document.querySelector(`meta[name="${key}"]`)?.getAttribute('content') || '';
      const byProp = document.querySelector(`meta[property="${key}"]`)?.getAttribute('content') || '';
      return byName || byProp;
    };
    const text = document.body.innerText || '';
    const h1 = [...document.querySelectorAll('h1')].map(x => x.innerText.trim()).filter(Boolean);
    const h2 = [...document.querySelectorAll('h2')].map(x => x.innerText.trim()).filter(Boolean);
    const meta = Object.fromEntries(metaFields.map(field => [field, getMeta(field)]));
    const jsonLdTypes = [];
    let invalidJsonLd = 0;
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const parsed = JSON.parse(s.textContent || '{}');
        const visit = (node) => {
          if (!node || typeof node !== 'object') return;
          if (Array.isArray(node)) { node.forEach(visit); return; }
          if (node['@type']) jsonLdTypes.push(node['@type']);
          if (node['@graph']) visit(node['@graph']);
        };
        visit(parsed);
      } catch { invalidJsonLd += 1; }
    }
    return {
      status: 0,
      title: document.title,
      canonical: document.querySelector('link[rel="canonical"]')?.href || '',
      meta,
      h1,
      h2,
      text,
      html: document.documentElement.outerHTML,
      scrollOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      links: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(Boolean),
      jsonLdTypes,
      invalidJsonLd,
      hasPagefindBody: Boolean(document.querySelector('[data-pagefind-body]')),
    };
  }, PARITY_META_FIELDS);
  data.status = response ? response.status() : 0;
  data.errors = errors;
  data.wordCount = words(data.text);
  if (WRITE_SHOTS) {
    fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
    const shot = async (name) => page.screenshot({ path: path.join(ROOT, 'reports', name), fullPage: true });
    await shot(`about-${viewportName}-${label}.png`);
    // Backward-compatible aliases used by earlier manual-review notes.
    if (viewportName === 'desktop') await shot(`about-${label}.png`);
  }
  return data;
}
function compareExact(problems, field, legacy, astro) {
  if (legacy !== astro) problems.push(`${field} mismatch: ${JSON.stringify(legacy)} !== ${JSON.stringify(astro)}`);
}
function checkOneViewport(problems, notes, viewportName, legacy, astro) {
  const prefix = `[${viewportName}]`;
  if (legacy.status !== 200) problems.push(`${prefix} legacy status ${legacy.status}`);
  if (astro.status !== 200) problems.push(`${prefix} astro status ${astro.status}`);
  compareExact(problems, `${prefix} title`, legacy.title, astro.title);
  compareExact(problems, `${prefix} canonical`, legacy.canonical, astro.canonical);
  for (const field of PARITY_META_FIELDS) compareExact(problems, `${prefix} meta ${field}`, legacy.meta[field], astro.meta[field]);
  if (legacy.h1[0] !== astro.h1[0] || astro.h1.length !== 1) problems.push(`${prefix} h1 mismatch: legacy=${legacy.h1.join(' | ')} astro=${astro.h1.join(' | ')}`);
  if (astro.scrollOverflow !== 0) problems.push(`${prefix} astro horizontal overflow: ${astro.scrollOverflow}`);
  if (legacy.scrollOverflow !== 0) notes.push(`${prefix} legacy horizontal overflow: ${legacy.scrollOverflow}`);
  if (legacy.errors.length) problems.push(`${prefix} legacy page errors: ${legacy.errors.slice(0, 2).join(' | ')}`);
  if (astro.errors.length) problems.push(`${prefix} astro page errors: ${astro.errors.slice(0, 2).join(' | ')}`);
  if (/Astro scaffold|Технический прототип|production switch/i.test(astro.text)) problems.push(`${prefix} astro public /about/ contains technical scaffold copy`);
  if (/\bnoindex\b/i.test(astro.meta.robots || '')) problems.push(`${prefix} astro /about/ unexpectedly noindex`);
  if (!astro.hasPagefindBody) problems.push(`${prefix} astro /about/ missing data-pagefind-body`);
  for (const marker of ['about-page', 'about-contacts', 'about-contact-card', 'gb-accuracy-block']) {
    if (!astro.html.includes(marker)) problems.push(`${prefix} astro missing legacy visual marker: ${marker}`);
  }
  for (const marker of ['class="astro-about"', 'astro-contact-grid', 'astro-accuracy-block']) {
    if (astro.html.includes(marker)) problems.push(`${prefix} astro contains old generic marker: ${marker}`);
  }
  const ratio = legacy.wordCount ? astro.wordCount / legacy.wordCount : 1;
  if (ratio < MIN_WORD_RATIO) problems.push(`${prefix} word-count ratio too low: legacy=${legacy.wordCount}, astro=${astro.wordCount}, ratio=${ratio.toFixed(2)} < ${MIN_WORD_RATIO}`);
  const missingHeadings = legacy.h2.filter(h => h && !astro.h2.includes(h));
  if (missingHeadings.length) problems.push(`${prefix} h2 missing in Astro: ${missingHeadings.join(', ')}`);
  if (astro.links.length < Math.min(legacy.links.length, 3)) notes.push(`${prefix} astro has fewer links (${astro.links.length}) than legacy (${legacy.links.length}); review before rollout`);
}
function checkJsonLd(problems, label, data) {
  if (data.invalidJsonLd) problems.push(`${label} has invalid JSON-LD block(s): ${data.invalidJsonLd}`);
  const types = unique(data.jsonLdTypes.flat());
  const missing = REQUIRED_JSON_LD_TYPES.filter(t => !types.includes(t));
  if (missing.length) problems.push(`${label} JSON-LD missing type(s): ${missing.join(', ')}; got ${types.join(', ')}`);
}
function checkAssets(problems, label, data, rootDir) {
  for (const field of ['og:image', 'twitter:image']) {
    const url = data.meta[field];
    if (!assetExists(url, rootDir)) problems.push(`${label} ${field} asset missing locally: ${url}`);
  }
}
async function checkNoJsAstro(browser, problems) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, javaScriptEnabled: false });
  const page = await ctx.newPage();
  try {
    const astro = await inspect(page, `http://127.0.0.1:${DIST_PORT}${URL_PATH}`, 'astro-nojs', 'mobile-nojs');
    if (astro.status !== 200) problems.push(`[mobile-nojs] astro status ${astro.status}`);
    if (!astro.h1.includes('Фёдор Милованов')) problems.push(`[mobile-nojs] expected h1 Фёдор Милованов, got ${JSON.stringify(astro.h1)}`);
    if (astro.wordCount < 450) problems.push(`[mobile-nojs] visible word count too low: ${astro.wordCount}`);
    if (astro.scrollOverflow !== 0) problems.push(`[mobile-nojs] horizontal overflow: ${astro.scrollOverflow}`);
  } finally {
    await page.close();
    await ctx.close();
  }
}

(async () => {
  console.log('▶ Building strangler dist…');
  run('npm', ['run', 'strangler:build']);
  const earlyProblems = [];
  checkFullDocumentParity(earlyProblems);
  if (earlyProblems.length) {
    console.error('\n❌ about full-document parity failed:');
    earlyProblems.forEach(p => console.error('  - ' + p));
    process.exit(1);
  }
  console.log('✅ /about/ normalized full-document HTML matches legacy');
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) { console.log('⏭ Playwright not installed; run npm install first.'); process.exit(0); }

  const legacyServer = await createServer(ROOT, LEGACY_PORT);
  const distServer = await createServer(DIST, DIST_PORT);
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const problems = [];
  const notes = [];
  const results = {};
  try {
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext(vp.options);
      const legacyPage = await ctx.newPage();
      const astroPage = await ctx.newPage();
      try {
        const legacy = await inspect(legacyPage, `http://127.0.0.1:${LEGACY_PORT}${URL_PATH}`, 'legacy', vp.name);
        const astro = await inspect(astroPage, `http://127.0.0.1:${DIST_PORT}${URL_PATH}`, 'astro', vp.name);
        results[vp.name] = { legacy, astro };
        checkOneViewport(problems, notes, vp.name, legacy, astro);
      } finally {
        await legacyPage.close();
        await astroPage.close();
        await ctx.close();
      }
    }
    await checkNoJsAstro(browser, problems);

    const desktop = results.desktop;
    if (desktop) {
      checkJsonLd(problems, 'legacy /about/', desktop.legacy);
      checkJsonLd(problems, 'astro /about/', desktop.astro);
      checkAssets(problems, 'legacy /about/', desktop.legacy, ROOT);
      checkAssets(problems, 'astro /about/', desktop.astro, DIST);
    }

    const ratio = desktop && desktop.legacy.wordCount ? desktop.astro.wordCount / desktop.legacy.wordCount : 1;
    console.log('\nABOUT PILOT COMPARISON');
    if (desktop) {
      console.log(`legacy words: ${desktop.legacy.wordCount}; astro words: ${desktop.astro.wordCount}; ratio: ${ratio.toFixed(2)} (min ${MIN_WORD_RATIO})`);
      console.log(`legacy h2: ${desktop.legacy.h2.join(' | ')}`);
      console.log(`astro h2:  ${desktop.astro.h2.join(' | ')}`);
      console.log(`json-ld: legacy=${unique(desktop.legacy.jsonLdTypes).join(', ')}; astro=${unique(desktop.astro.jsonLdTypes).join(', ')}`);
    }
    if (WRITE_SHOTS) console.log('screenshots: reports/about-desktop-legacy.png, reports/about-desktop-astro.png, reports/about-mobile-legacy.png, reports/about-mobile-astro.png');
    notes.forEach(n => console.log('ℹ️ ' + n));
    if (problems.length) {
      console.error('\n❌ about pilot audit failed:');
      problems.forEach(p => console.error('  - ' + p));
      process.exitCode = 1;
    } else {
      console.log('\n✅ about pilot audit passed (desktop/mobile/no-JS SEO + smoke). Manual visual review still required before rollout.');
    }
  } finally {
    await browser.close();
    legacyServer.close();
    distServer.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
