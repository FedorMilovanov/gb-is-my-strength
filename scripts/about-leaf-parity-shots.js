#!/usr/bin/env node
/*
 * Visual proof for /about/ leaf replacement (Рефакторинг 6.0 pilot).
 * Serves legacy (about/) and Astro dist (dist/about/) side by side and
 * screenshots desktop + mobile for both, so the owner can SEE parity.
 * Independent of astro-about-pilot-audit.js (which exits early on the
 * SVG self-closing byte check before reaching screenshots).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.xml':'application/xml; charset=utf-8','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf' }[ext] || 'application/octet-stream';
}
function serve(root, port) {
  const srv = http.createServer((req, res) => {
    let u = decodeURIComponent((req.url||'/').split('?')[0]);
    if (u.endsWith('/')) u += 'index.html';
    const file = path.normalize(path.join(root, u.replace(/^\//,'')));
    if (!file.startsWith(root)) { res.writeHead(403); res.end('forbidden'); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('404 '+u); return; }
      res.writeHead(200, { 'content-type': contentType(file) }); res.end(data);
    });
  });
  return new Promise(r => srv.listen(port,'127.0.0.1',()=>r(srv)));
}
(async () => {
  const { chromium } = require('playwright');
  const legSrv = await serve(ROOT, 8204);
  const distSrv = await serve(DIST, 8205);
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const shots = path.join(ROOT, 'reports');
  fs.mkdirSync(shots, { recursive: true });
  const viewports = [
    { name: 'desktop', vp: { width: 1366, height: 900 } },
    { name: 'mobile', vp: { width: 390, height: 844 }, mobile: true },
  ];
  const targets = [
    { label: 'legacy', url: 'http://127.0.0.1:8204/about/' },
    { label: 'astro', url: 'http://127.0.0.1:8205/about/' },
  ];
  try {
    for (const vp of viewports) {
      for (const t of targets) {
        const ctx = await browser.newContext({ viewport: vp.vp, isMobile: !!vp.mobile, hasTouch: !!vp.mobile });
        const page = await ctx.newPage();
        const errs = [];
        page.on('pageerror', e => errs.push(String(e).slice(0,120)));
        await page.goto(t.url, { waitUntil: 'load', timeout: 30000 });
        await page.waitForTimeout(800);
        const file = path.join(shots, `about-${vp.name}-${t.label}.png`);
        await page.screenshot({ path: file, fullPage: true });
        const px = fs.statSync(file).size;
        console.log(`📸 about-${vp.name}-${t.label}.png  (${(px/1024).toFixed(0)} KB)  pageerrors:${errs.length}`);
        await ctx.close();
      }
    }
    // Pixel diff desktop legacy vs astro using sharp-free pixelmatch if present
    console.log('\nVisual proof screenshots written to reports/');
  } finally {
    await browser.close(); legSrv.close(); distSrv.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
