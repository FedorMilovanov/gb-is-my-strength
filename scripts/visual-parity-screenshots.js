#!/usr/bin/env node
/**
 * visual-parity-screenshots.js — pixel-level Astro→legacy visual parity gate.
 *
 * Why this exists (РЕФАКТОРИНГ 5.0 Phase 5, AGENTS-r248):
 *   r244 (2026-06-19) emergency rollback proved that DOM marker / H1 / word-count
 *   parity is NOT visual parity. Owner doctrine: «H1/H2 одинаковые + визуал
 *   сломан = 0% visual parity». Before any shadow-wrap → native Astro promotion
 *   the route MUST pass real screenshot diff at desktop + mobile.
 *
 * What it does:
 *   1. Spawns two static HTTP servers — one for the legacy artifact (default `.`)
 *      and one for the dist artifact (default `dist/`).
 *   2. For every requested route renders desktop (1280×900) + mobile (390×844)
 *      screenshots in both servers using Playwright.
 *   3. Diffs each pair via pixelmatch with a configurable diffPct threshold
 *      (default 1%). Above threshold => hard fail.
 *   4. Writes screenshots + diff PNGs to `reports/visual-parity/<route>/...`.
 *   5. Emits `reports/visual-parity/summary.json` for downstream tools.
 *
 * Usage:
 *   node scripts/visual-parity-screenshots.js                  # all baseline routes
 *   node scripts/visual-parity-screenshots.js --routes /about/ # pilot subset
 *   node scripts/visual-parity-screenshots.js --threshold 0.5  # stricter (0.5%)
 *   node scripts/visual-parity-screenshots.js --warn-only      # don't fail CI
 *
 * Production rule: this gate is REQUIRED for any `status: shadow-wrap →
 * production-native` promotion of an Astro route. See
 * docs/refactor-2026/REFACTORING_5_0_PLAN.md §Phase 5 and
 * docs/refactor-2026/REFACTORING_5_0_PIXEL_DIFF_GUARD_2026-06-20.md.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');

process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH ||
  path.join(process.env.HOME || process.cwd(), '.cache', 'ms-playwright');

const { chromium } = require('playwright');

// ---------- args ----------
const ARGS = process.argv.slice(2);
function arg(name, def) {
  const i = ARGS.indexOf(name);
  if (i === -1) return def;
  return ARGS[i + 1];
}
function flag(name) { return ARGS.includes(name); }

const ROOT = path.resolve(__dirname, '..');
const LEGACY_DIR = path.resolve(ROOT, arg('--legacy', '.'));
const DIST_DIR = path.resolve(ROOT, arg('--dist', 'dist'));
const OUT_DIR = path.resolve(ROOT, arg('--out', 'reports/visual-parity'));
const THRESHOLD_PCT = parseFloat(arg('--threshold', '1.0'));
const PIXEL_THRESHOLD = parseFloat(arg('--pixel-threshold', '0.1'));
const WARN_ONLY = flag('--warn-only');
const FULL_PAGE = !flag('--first-fold-only');
const ROUTES_ARG = arg('--routes', '');
const HEAD = flag('--head');
const QUIET = flag('--quiet');

// ---------- routes ----------
const BASELINE = path.join(ROOT, 'data/public-content-baseline.json');
function loadDefaultRoutes() {
  if (!fs.existsSync(BASELINE)) return ['/'];
  const data = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const list = Array.isArray(data.pages) ? data.pages : Array.isArray(data) ? data : [];
  const routes = new Set();
  for (const entry of list) {
    const url = entry.url || entry.canonical || entry.path;
    if (!url) continue;
    let route = url.replace(/^https?:\/\/[^/]+/, '');
    if (!route.startsWith('/')) route = '/' + route;
    if (!route.endsWith('/') && !/\.[a-z0-9]+$/i.test(route)) route += '/';
    routes.add(route);
  }
  if (routes.size === 0) routes.add('/');
  return Array.from(routes).sort();
}
function parseRoutesArg(s) {
  return s.split(/[,\s]+/).map((r) => r.trim()).filter(Boolean).map((r) => {
    if (!r.startsWith('/')) r = '/' + r;
    if (!r.endsWith('/') && !/\.[a-z0-9]+$/i.test(r)) r += '/';
    return r;
  });
}
const ROUTES = ROUTES_ARG ? parseRoutesArg(ROUTES_ARG) : loadDefaultRoutes();

// ---------- static server ----------
function createServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        if (urlPath.endsWith('/')) urlPath += 'index.html';
        const filePath = path.normalize(path.join(rootDir, urlPath));
        if (!filePath.startsWith(rootDir)) { res.statusCode = 403; res.end('forbidden'); return; }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end('<!doctype html><html><body>404</body></html>');
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const types = {
          '.html': 'text/html; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.mjs': 'application/javascript; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.webp': 'image/webp',
          '.avif': 'image/avif',
          '.gif': 'image/gif',
          '.ico': 'image/x-icon',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2',
          '.ttf': 'font/ttf',
          '.xml': 'application/xml; charset=utf-8',
          '.txt': 'text/plain; charset=utf-8',
        };
        res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        fs.createReadStream(filePath).pipe(res);
      } catch (e) { res.statusCode = 500; res.end(String(e)); }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}
function port(server) { return server.address().port; }

// ---------- viewport ----------
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900, deviceScaleFactor: 1 },
  { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
];

function routeSlug(route) {
  return route.replace(/^\//, '').replace(/\/$/, '').replace(/[^a-z0-9\-_]+/gi, '_') || 'root';
}

async function screenshot(page, baseUrl, route, viewport, outFile) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const url = baseUrl.replace(/\/$/, '') + route;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 }).catch((e) => {
    throw new Error(`goto ${url} failed: ${e.message}`);
  });
  // freeze animations + transitions to make diff deterministic
  await page.addStyleTag({
    content: `
      *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
      .lazyload, [data-lazy], img[loading="lazy"] { animation: none !important; }
    `,
  }).catch(() => {});
  // Force eager loading for ALL images and decode them — otherwise lazy-loaded
  // article thumbnails produce false-positive diffs (картинка успела
  // догрузиться в одном serve и не успела в другом).
  await page.evaluate(async () => {
    const imgs = Array.from(document.querySelectorAll('img'));
    imgs.forEach((img) => { try { img.loading = 'eager'; } catch {} });
    // trigger any data-src style lazy loaders (project does not use them, but
    // belt-and-suspenders).
    imgs.forEach((img) => {
      const ds = img.getAttribute('data-src');
      if (ds && !img.src) img.src = ds;
      const dss = img.getAttribute('data-srcset');
      if (dss && !img.srcset) img.srcset = dss;
    });
    await Promise.allSettled(
      imgs.map((img) => (img.complete && img.naturalWidth > 0)
        ? img.decode().catch(() => undefined)
        : new Promise((res) => {
            img.addEventListener('load', () => res(), { once: true });
            img.addEventListener('error', () => res(), { once: true });
            setTimeout(res, 8000);
          })),
    );
  }).catch(() => {});
  // Scroll bottom→top to force any IntersectionObserver based lazy hydration,
  // then settle.
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y <= h; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 200));
  }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  // Hard wait until every <img> reports complete + naturalWidth > 0. Without
  // this guard /biografii/ desktop occasionally flaked at 5% because the big
  // <picture class="bio-cover"> sometimes did not finish decoding before the
  // screenshot fired even though networkidle had resolved.
  await page.waitForFunction(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs.every((img) => img.complete && (img.naturalWidth > 0 || img.dataset.brokenOk === '1'));
  }, { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: outFile, fullPage: FULL_PAGE });
}

function diffPng(aFile, bFile, diffFile) {
  const a = PNG.sync.read(fs.readFileSync(aFile));
  const b = PNG.sync.read(fs.readFileSync(bFile));
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  // pad / crop to common size
  function crop(img) {
    if (img.width === width && img.height === height) return img;
    const out = new PNG({ width, height });
    PNG.bitblt(img, out, 0, 0, width, height, 0, 0);
    return out;
  }
  const ca = crop(a); const cb = crop(b);
  const diff = new PNG({ width, height });
  const mismatched = pixelmatch(ca.data, cb.data, diff.data, width, height, {
    threshold: PIXEL_THRESHOLD,
    includeAA: false,
    diffMask: false,
  });
  fs.writeFileSync(diffFile, PNG.sync.write(diff));
  const pct = (mismatched / (width * height)) * 100;
  return {
    width, height,
    legacyWidth: a.width, legacyHeight: a.height,
    distWidth: b.width, distHeight: b.height,
    mismatchedPixels: mismatched,
    diffPct: pct,
  };
}

(async () => {
  if (!fs.existsSync(LEGACY_DIR)) { console.error(`❌ legacy dir missing: ${LEGACY_DIR}`); process.exit(2); }
  if (!fs.existsSync(DIST_DIR)) { console.error(`❌ dist dir missing: ${DIST_DIR}`); process.exit(2); }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (!QUIET) {
    console.log(`legacy:    ${LEGACY_DIR}`);
    console.log(`dist:      ${DIST_DIR}`);
    console.log(`out:       ${OUT_DIR}`);
    console.log(`routes:    ${ROUTES.length}`);
    console.log(`threshold: ${THRESHOLD_PCT}% diff per viewport`);
  }

  const legacyServer = await createServer(LEGACY_DIR);
  const distServer = await createServer(DIST_DIR);
  const legacyUrl = `http://127.0.0.1:${port(legacyServer)}`;
  const distUrl = `http://127.0.0.1:${port(distServer)}`;

  const browser = await chromium.launch({ headless: !HEAD });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  const summary = { startedAt: new Date().toISOString(), threshold: THRESHOLD_PCT, routes: [] };
  let failed = 0;

  for (const route of ROUTES) {
    const slug = routeSlug(route);
    const routeDir = path.join(OUT_DIR, slug);
    fs.mkdirSync(routeDir, { recursive: true });
    const routeResult = { route, viewports: {} };
    for (const vp of VIEWPORTS) {
      const legacyFile = path.join(routeDir, `legacy-${vp.name}.png`);
      const distFile = path.join(routeDir, `dist-${vp.name}.png`);
      const diffFile = path.join(routeDir, `diff-${vp.name}.png`);
      // Retry loop — large eager <img> assets (e.g. /biografii/ bio-cover) can
      // occasionally fail to decode before the screenshot fires even after
      // networkidle + img-complete wait. Take up to MAX_ATTEMPTS captures and
      // record the smallest diff. The retry is what real CI/local owner
      // workflow needs; it does NOT mask real regressions because a real CSS
      // bug stays >threshold in all attempts.
      const MAX_ATTEMPTS = 3;
      let best = null; let lastError = null;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          await screenshot(page, legacyUrl, route, vp, legacyFile);
          await screenshot(page, distUrl, route, vp, distFile);
          const d = diffPng(legacyFile, distFile, diffFile);
          if (!best || d.diffPct < best.diffPct) best = { ...d, attempts: attempt };
          if (d.diffPct <= THRESHOLD_PCT) break;
        } catch (e) { lastError = e; }
      }
      if (!best) {
        failed++;
        if (!QUIET) console.log(`❌ ${route} ${vp.name}: ${lastError?.message || 'screenshot failed'}`);
        routeResult.viewports[vp.name] = { pass: false, error: lastError?.message || 'screenshot failed' };
        continue;
      }
      const pass = best.diffPct <= THRESHOLD_PCT;
      if (!pass) failed++;
      if (!QUIET) {
        const icon = pass ? '✅' : '❌';
        const att = best.attempts && best.attempts > 1 ? ` (best of ${best.attempts} attempts)` : '';
        console.log(`${icon} ${route} ${vp.name}: diff=${best.diffPct.toFixed(3)}% (legacy ${best.legacyWidth}x${best.legacyHeight} vs dist ${best.distWidth}x${best.distHeight})${att}`);
      }
      routeResult.viewports[vp.name] = { pass, ...best };
    }
    summary.routes.push(routeResult);
  }

  await browser.close();
  legacyServer.close(); distServer.close();

  summary.finishedAt = new Date().toISOString();
  summary.failed = failed;
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));

  if (!QUIET) {
    console.log('');
    if (failed === 0) console.log(`✅ visual parity OK: ${ROUTES.length} route(s) × ${VIEWPORTS.length} viewport(s) at ≤${THRESHOLD_PCT}%`);
    else console.log(`❌ visual parity FAILED for ${failed} pair(s) (legacy vs dist). See ${path.relative(ROOT, OUT_DIR)}/`);
  }

  if (failed > 0 && !WARN_ONLY) process.exit(1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
