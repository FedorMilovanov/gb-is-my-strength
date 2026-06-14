#!/usr/bin/env node
/*
 * astro-about-pilot-audit.js — compare legacy /about/ vs Astro dist /about/.
 *
 * This is a Level-2 shadow/pilot guard. It does not switch production.
 * It builds strangler dist, serves both roots locally, and checks the pilot URL.
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
async function inspect(page, url, label) {
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
    if (m.type() === 'error' && !/favicon|manifest/i.test(text) && !ignoreLocalLegacyNoise(text)) errors.push(text.slice(0, 160));
  });
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(500);
  const data = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const h1 = [...document.querySelectorAll('h1')].map(x => x.innerText.trim());
    const h2 = [...document.querySelectorAll('h2')].map(x => x.innerText.trim());
    return {
      title: document.title,
      canonical: document.querySelector('link[rel="canonical"]')?.href || '',
      robots: document.querySelector('meta[name="robots"]')?.content || '',
      h1,
      h2,
      text,
      scrollOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      links: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')),
      jsonLdTypes: [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(s => {
        try {
          const parsed = JSON.parse(s.textContent || '{}');
          const out = [];
          const visit = (node) => {
            if (!node || typeof node !== 'object') return;
            if (Array.isArray(node)) { node.forEach(visit); return; }
            if (node['@type']) out.push(node['@type']);
            if (node['@graph']) visit(node['@graph']);
          };
          visit(parsed);
          return out.flat();
        } catch { return ['INVALID_JSON_LD']; }
      }),
    };
  });
  data.errors = errors;
  data.wordCount = words(data.text);
  if (WRITE_SHOTS) {
    fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
    await page.screenshot({ path: path.join(ROOT, 'reports', `about-${label}.png`), fullPage: true });
  }
  return data;
}

(async () => {
  console.log('▶ Building strangler dist…');
  run('npm', ['run', 'strangler:build']);
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) { console.log('⏭ Playwright not installed; run npm install first.'); process.exit(0); }

  const legacyServer = await createServer(ROOT, LEGACY_PORT);
  const distServer = await createServer(DIST, DIST_PORT);
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const legacyPage = await ctx.newPage();
  const astroPage = await ctx.newPage();
  try {
    const legacy = await inspect(legacyPage, `http://127.0.0.1:${LEGACY_PORT}${URL_PATH}`, 'legacy');
    const astro = await inspect(astroPage, `http://127.0.0.1:${DIST_PORT}${URL_PATH}`, 'astro');
    const problems = [];
    const notes = [];
    if (legacy.title !== astro.title) problems.push(`title mismatch: ${legacy.title} !== ${astro.title}`);
    if (legacy.canonical !== astro.canonical) problems.push(`canonical mismatch: ${legacy.canonical} !== ${astro.canonical}`);
    if (legacy.h1[0] !== astro.h1[0] || astro.h1.length !== 1) problems.push(`h1 mismatch: legacy=${legacy.h1.join(' | ')} astro=${astro.h1.join(' | ')}`);
    if (astro.scrollOverflow !== 0) problems.push(`astro horizontal overflow: ${astro.scrollOverflow}`);
    if (legacy.errors.length) problems.push(`legacy page errors: ${legacy.errors.slice(0, 2).join(' | ')}`);
    if (astro.errors.length) problems.push(`astro page errors: ${astro.errors.slice(0, 2).join(' | ')}`);
    const ratio = legacy.wordCount ? astro.wordCount / legacy.wordCount : 1;
    if (ratio < 0.72) problems.push(`word-count ratio too low: legacy=${legacy.wordCount}, astro=${astro.wordCount}, ratio=${ratio.toFixed(2)}`);
    if (!astro.jsonLdTypes.includes('ProfilePage') || !astro.jsonLdTypes.includes('Person')) problems.push(`astro JSON-LD missing ProfilePage/Person: ${astro.jsonLdTypes.join(', ')}`);
    const missingHeadings = legacy.h2.filter(h => h && !astro.h2.includes(h));
    if (missingHeadings.length) notes.push(`headings not yet visually/content-identical: ${missingHeadings.join(', ')}`);
    if (astro.links.length < Math.min(legacy.links.length, 3)) notes.push(`astro has fewer links (${astro.links.length}) than legacy (${legacy.links.length}); acceptable for shadow pilot but review before rollout`);

    console.log('\nABOUT PILOT COMPARISON');
    console.log(`legacy words: ${legacy.wordCount}; astro words: ${astro.wordCount}; ratio: ${ratio.toFixed(2)}`);
    console.log(`legacy h2: ${legacy.h2.join(' | ')}`);
    console.log(`astro h2:  ${astro.h2.join(' | ')}`);
    if (WRITE_SHOTS) console.log('screenshots: reports/about-legacy.png, reports/about-astro.png');
    notes.forEach(n => console.log('ℹ️ ' + n));
    if (problems.length) {
      console.error('\n❌ about pilot audit failed:');
      problems.forEach(p => console.error('  - ' + p));
      process.exitCode = 1;
    } else {
      console.log('\n✅ about pilot audit passed (contract + smoke). Manual visual review still required before rollout.');
    }
  } finally {
    await browser.close();
    legacyServer.close();
    distServer.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
