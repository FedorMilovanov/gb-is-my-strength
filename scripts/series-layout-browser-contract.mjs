#!/usr/bin/env node
/**
 * Shared responsive contract across every built series family and all book
 * landings. Run only after a production-like build. Does not rewrite source.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium, webkit } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
assert.ok(fs.existsSync(dist), 'Build dist first');
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css',
  '.js': 'text/javascript', '.woff2': 'font/woff2',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.json': 'application/json',
};
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const f = path.join(dir, e.name);
    return e.isDirectory() ? walk(f) : e.name === 'index.html' ? [f] : [];
  });
}
function routeFor(file) {
  const rel = path.relative(dist, file).replaceAll('\\', '/');
  return '/' + rel.replace(/(?:^|\/)index\.html$/, '').replace(/^\/|\/$/g, '') + (rel === 'index.html' ? '' : '/');
}
const readerBySeries = new Map(), discoveredLandings = new Set();
const missingSemanticOwners = [];
let readerPages = 0;
for (const file of walk(dist)) {
  const html = fs.readFileSync(file, 'utf8'), route = routeFor(file);
  if (html.includes('data-reader-landing="book"')) discoveredLandings.add(route);
  if (!html.includes('data-gill-v16=')) continue;
  readerPages++;
  if (!html.includes('data-reader-engine="series"') ||
      !/data-reader-shape="(?:flat|book)"/.test(html)) missingSemanticOwners.push(route);
  const series = html.match(/<body[^>]*\bdata-gbs2-series="([^"]+)"/)?.[1];
  if (series && !readerBySeries.has(series)) readerBySeries.set(series, route);
}
assert.ok(readerPages >= 68, 'Expected full shared series corpus; found ' + readerPages);
assert.deepEqual(missingSemanticOwners, [], 'Every shared series reader needs semantic owner/shape');
assert.ok(readerBySeries.size >= 7, 'Expected all seven shared series families; found ' + readerBySeries.size);
// Existing public book landings remain mandatory fixtures. New landing routes
// join the same contract automatically through data-reader-landing="book".
const landingRoutes = [...new Set(['/hard-texts/', '/baptisty-rossii/', ...discoveredLandings])];
const routes = [
  ...[...readerBySeries].map(([series, route]) => ({ kind: 'reader', series, route })),
  ...landingRoutes.map((route) => ({ kind: 'landing', route })),
];
const server = http.createServer((req, res) => {
  try {
    const url = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    const file = path.resolve(dist, '.' + (url.endsWith('/') ? url + 'index.html' : url));
    const rel = path.relative(dist, file);
    if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end(); return;
    }
    res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (error) { res.writeHead(500).end(String(error)); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const drivers = { chromium, webkit };
const selectedEngines = (process.env.GB_LAYOUT_ENGINES || 'chromium,webkit').split(',').map((name) => name.trim());
assert.ok(selectedEngines.length > 0 && selectedEngines.every((name) => name in drivers),
  'GB_LAYOUT_ENGINES must list chromium and/or webkit');
let passed = 0, covers = 0;
const failures = [];
try {
  for (const engine of selectedEngines) {
    const driver = drivers[engine];
    const browser = await driver.launch({ headless: true });
    try {
      for (const width of [320, 390, 768, 1024, 1359, 1360, 1440]) {
        const context = await browser.newContext({
          viewport: { width, height: 880 }, isMobile: width <= 768,
          hasTouch: width <= 768, serviceWorkers: 'block', reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        await page.route('**/*', (r) =>
          r.request().url().startsWith(origin) ? r.continue() : r.abort());
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));
        for (const candidate of routes) {
          try {
            const response = await page.goto(origin + candidate.route, { waitUntil: 'domcontentloaded', timeout: 13000 });
            assert.equal(response?.status(), 200, 'HTTP status');
            await page.waitForTimeout(50);
            const state = await page.evaluate(() => {
              const visible = (el) => {
                if (!el) return false;
                const style = getComputedStyle(el), rect = el.getBoundingClientRect();
                return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 2 && rect.height > 2;
              };
              const rail = document.querySelector('[data-gill-v16] .gbs-rail, .gbs2-world:not([data-gill-v16]) .gbs2-rail');
              const art = document.querySelector('.gbs2-hero[data-reader-cover-fit="contain"]');
              const img = art?.querySelector('img'), style = img ? getComputedStyle(img) : null;
              return {
                docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                railVisible: visible(rail),
                topVisible: visible(document.querySelector('.mobile-top-bar')),
                bottomVisible: visible(document.querySelector('.mobile-bottom-bar')),
                landingRail: !!document.querySelector('.gbs2-rail'),
                compactLandingHeader: visible(document.querySelector('.gbs2-mobile-head')),
                landingShape: document.body.dataset.readerShape,
                landingRole: document.body.dataset.readerLanding,
                media: style ? {
                  fit: style.objectFit, height: img.getBoundingClientRect().height,
                  frameHeight: art.getBoundingClientRect().height, transform: style.transform,
                } : null,
              };
            });
            assert.ok(state.docOverflow <= 2, 'horizontal overflow ' + state.docOverflow + 'px');
            const desktop = width >= 1360;
            if (candidate.kind === 'reader') {
              assert.equal(state.railVisible, desktop, 'shared series rail breakpoint');
              assert.equal(state.topVisible, !desktop, 'shared series top-bar breakpoint');
              assert.equal(state.bottomVisible, !desktop, 'shared series bottom-bar breakpoint');
            } else {
              // Check the visual invariant first, before semantic metadata, so
              // the red regression names the actual breakpoint divergence.
              if (state.landingRail) {
                assert.equal(state.railVisible, desktop, 'book landing / reader rail breakpoint mismatch');
                assert.equal(state.compactLandingHeader, !desktop, 'book landing compact header mismatch');
              }
              assert.equal(state.landingRole, 'book', 'book landing semantic owner');
              assert.equal(state.landingShape, 'book', 'book landing canonical shape');
            }
            if (state.media) {
              covers++;
              assert.equal(state.media.fit, 'contain', 'lettered artwork is cropped');
              assert.ok(Math.abs(state.media.height - state.media.frameHeight) <= 2, 'artwork frame is clipped');
              assert.equal(state.media.transform, 'none', 'parallax crops lettered artwork');
            }
            assert.deepEqual(pageErrors, [], 'browser errors');
            passed++;
          } catch (error) {
            failures.push({ engine, width, ...candidate, error: String(error.message || error).slice(0, 230) });
          }
          pageErrors.length = 0;
        }
        await context.close();
      }
    } finally { await browser.close(); }
    console.log(engine + ': ' + routes.length * 5 + ' cases complete');
  }
} finally { await new Promise((resolve) => server.close(resolve)); }
if (covers === 0) failures.push({ error: 'No lettered artwork cover tested (data-reader-cover-fit=contain)' });
console.log(JSON.stringify({
  total: passed + failures.length, passed, failed: failures.length,
  series: [...readerBySeries.keys()], landings: landingRoutes,
  coverCases: covers, failures,
}, null, 2));
if (failures.length) process.exitCode = 1;
