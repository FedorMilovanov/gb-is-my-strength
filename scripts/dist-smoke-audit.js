#!/usr/bin/env node
/*
 * dist-smoke-audit.js — local smoke test for build-time strangler dist.
 *
 * It builds dist via `npm run strangler:build`, serves dist from a local static
 * server, and checks representative URLs for status/canonical/H1/overflow/pageerrors.
 * This is intentionally not a production deploy switch.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.DIST_SMOKE_PORT || 8146);
const BASE = `http://127.0.0.1:${PORT}`;
const WRITE_SHOTS = process.argv.includes('--write-shots');
const NO_BUILD = process.argv.includes('--no-build');
const PRODUCTION_LIKE = process.argv.includes('--production-like') || process.argv.includes('--forbid-dev');

const BASE_ROUTES = [
  { path: '/', kind: 'legacy', canonical: 'https://gospod-bog.ru/', h1: 'Господь Бог — Сила Моя' },
  { path: '/about/', kind: 'astro', canonical: 'https://gospod-bog.ru/about/', h1: 'Фёдор Милованов', forbidText: /Astro scaffold|production switch|Технический прототип/i },
  { path: '/articles/', kind: 'legacy', canonical: 'https://gospod-bog.ru/articles/' },
  { path: '/articles/kod-da-vinchi/', kind: 'legacy', canonical: 'https://gospod-bog.ru/articles/kod-da-vinchi/' },
  { path: '/karty/', kind: 'legacy', canonical: 'https://gospod-bog.ru/karty/' },
  { path: '/karty/avraam/', kind: 'legacy-map', canonical: 'https://gospod-bog.ru/karty/avraam/' },
  { path: '/konfessii/', kind: 'legacy', canonical: 'https://gospod-bog.ru/konfessii/' },
  { path: '/konfessii/russkij-baptizm/', kind: 'iframe-app-wrapper', canonical: 'https://gospod-bog.ru/konfessii/russkij-baptizm/' },
  { path: '/map/', kind: 'legacy-map', canonical: 'https://gospod-bog.ru/map/' },
  { path: '/404.html', kind: 'system', canonical: 'https://gospod-bog.ru/404.html', allowNoindex: true },
  { path: '/dev/astro-test/', kind: 'astro-dev', canonical: 'https://gospod-bog.ru/dev/astro-test/', mustNoindex: true, h1: 'Astro test', buildOnly: true },
];
const ROUTES = PRODUCTION_LIKE ? BASE_ROUTES.filter(route => !route.buildOnly) : BASE_ROUTES;

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
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
function createServer() {
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    const file = path.normalize(path.join(DIST, urlPath.replace(/^\//, '')));
    if (!file.startsWith(DIST)) { res.writeHead(403); res.end('Forbidden'); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
      res.writeHead(200, { 'content-type': contentType(file) });
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}
function ignoreLocalNoise(text) {
  return (/violates the following Content Security Policy directive/i.test(text) && /https:\/\/gospod-bog\.ru\//i.test(text))
    || /Failed to load resource.*mc\.yandex/i.test(text)
    || /favicon/i.test(text);
}
function safeName(routePath) {
  return routePath === '/' ? 'root' : routePath.replace(/^\//, '').replace(/\/$/, '').replace(/[^a-z0-9_-]+/gi, '-');
}
async function inspect(page, route, viewportName) {
  const seenErrors = [];
  page.on('pageerror', e => { if (!ignoreLocalNoise(e.message)) seenErrors.push(e.message); });
  page.on('console', m => {
    const text = m.text();
    if (m.type() === 'error' && !ignoreLocalNoise(text)) seenErrors.push(text.slice(0, 180));
  });
  const response = await page.goto(BASE + route.path, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(route.kind.includes('map') ? 900 : 350);
  const data = await page.evaluate(() => ({
    title: document.title,
    canonical: document.querySelector('link[rel="canonical"]')?.href || '',
    robots: document.querySelector('meta[name="robots"]')?.content || '',
    h1: [...document.querySelectorAll('h1')].map(h => h.innerText.trim()).filter(Boolean),
    text: document.body.innerText || '',
    overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    iframeCount: document.querySelectorAll('iframe').length,
    canvasCount: document.querySelectorAll('canvas').length,
  }));
  if (WRITE_SHOTS) {
    fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
    await page.screenshot({ path: path.join(ROOT, 'reports', `dist-${viewportName}-${safeName(route.path)}.png`), fullPage: false });
  }
  return { status: response ? response.status() : 0, errors: seenErrors, ...data };
}

(async () => {
  if (!NO_BUILD) {
    console.log(`▶ Building ${PRODUCTION_LIKE ? 'production-like ' : ''}strangler dist…`);
    run('npm', ['run', PRODUCTION_LIKE ? 'strangler:build:production-like' : 'strangler:build']);
  }
  if (!fs.existsSync(DIST)) {
    console.error('❌ dist/ does not exist. Run npm run strangler:build first.');
    process.exit(1);
  }
  if (PRODUCTION_LIKE && fs.existsSync(path.join(DIST, 'dev/astro-test/index.html'))) {
    console.error('❌ production-like dist smoke found build-only route: /dev/astro-test/');
    process.exit(1);
  }
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (_) { console.log('⏭ Playwright not installed; skipping dist smoke.'); process.exit(0); }

  const server = await createServer();
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const viewports = [
    { name: 'desktop', options: { viewport: { width: 1366, height: 900 } } },
    { name: 'mobile', options: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ];
  const problems = [];
  try {
    for (const vp of viewports) {
      const context = await browser.newContext(vp.options);
      for (const route of ROUTES) {
        const page = await context.newPage();
        const r = await inspect(page, route, vp.name).catch(e => ({ status: 0, errors: [e.message], title: '', canonical: '', h1: [], text: '', overflow: 0, iframeCount: 0, canvasCount: 0, robots: '' }));
        await page.close();
        const label = `[${vp.name}] ${route.path}`;
        if (r.status !== 200) problems.push(`${label}: status ${r.status}`);
        if (route.canonical && r.canonical !== route.canonical) problems.push(`${label}: canonical ${JSON.stringify(r.canonical)} != ${route.canonical}`);
        if (route.h1 && !r.h1.includes(route.h1)) problems.push(`${label}: expected h1 ${JSON.stringify(route.h1)}, got ${JSON.stringify(r.h1)}`);
        if (r.overflow !== 0) problems.push(`${label}: horizontal overflow ${r.overflow}`);
        if (route.forbidText && route.forbidText.test(r.text)) problems.push(`${label}: forbidden technical text present`);
        if (route.mustNoindex && !/\bnoindex\b/i.test(r.robots)) problems.push(`${label}: expected noindex robots, got ${JSON.stringify(r.robots)}`);
        if (!route.allowNoindex && !route.mustNoindex && /\bnoindex\b/i.test(r.robots)) problems.push(`${label}: unexpected noindex`);
        if (route.kind === 'iframe-app-wrapper' && r.iframeCount < 1) problems.push(`${label}: iframe missing`);
        if (r.errors.length) problems.push(`${label}: page/console errors: ${r.errors.slice(0, 2).join(' | ')}`);
        console.log(`✔ ${label} status=${r.status} h1=${r.h1[0] || '-'} overflow=${r.overflow}`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log('');
  if (problems.length) {
    console.error(`❌ dist smoke failed: ${problems.length} issue(s)`);
    problems.slice(0, 40).forEach(p => console.error('  - ' + p));
    if (problems.length > 40) console.error(`  …and ${problems.length - 40} more`);
    process.exit(1);
  }
  console.log(`✅ dist smoke passed — representative ${PRODUCTION_LIKE ? 'production-like ' : ''}strangler output is healthy`);
})().catch(e => { console.error(e); process.exit(1); });
