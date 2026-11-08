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
      for (const width of [320, 390, 480, 768, 1024, 1359, 1360, 1440]) {
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
              if (width <= 480) {
                // Shared series hit targets must not overlap Play or shrink the
                // choices into the narrow Learning slot at 320px. Real browser
                // geometry + a touchscreen gesture exercise each theme/series.
                await page.waitForFunction(() => typeof window.__gillCloseSpeedRail === 'function',
                  null, { timeout: 8000 });
                const hit = await page.evaluate(() => {
                  const play = document.querySelector('.mobile-playwrap .gb-ember');
                  const badge = document.getElementById('mobSpdBadge');
                  const learning = document.querySelector('.mobile-learning-trigger');
                  const r = (el) => el?.getBoundingClientRect();
                  const isHit = (el) => {
                    const rect = r(el);
                    if (!rect) return false;
                    const at = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
                    return at === el || el.contains(at);
                  };
                  const p = r(play), b = r(badge), l = r(learning);
                  const overlap = p && b ?
                    Math.max(0, Math.min(p.right, b.right) - Math.max(p.left, b.left)) *
                    Math.max(0, Math.min(p.bottom, b.bottom) - Math.max(p.top, b.top)) : -1;
                  return {
                    play: p ? { w: p.width, h: p.height, hit: isHit(play) } : null,
                    badge: b ? { w: b.width, h: b.height, hit: isHit(badge) } : null,
                    learning: l ? { w: l.width, h: l.height, hit: isHit(learning) } : null,
                    overlap,
                  };
                });
                assert.ok(hit.play && hit.badge && hit.learning, 'missing shared speed/Play/Learning controls');
                assert.ok(hit.play.w >= 43 && hit.play.h >= 43 && hit.play.hit, 'Play hit target lost');
                assert.ok(hit.badge.w >= 43 && hit.badge.h >= 43 && hit.badge.hit, 'speed hit target too small');
                assert.ok(hit.learning.w >= 35 && hit.learning.h >= 39, 'Learning slot collapsed');
                assert.ok(hit.overlap <= .5, 'speed target overlaps Play by ' + hit.overlap + 'px²');
                await page.locator('#mobSpdBadge').tap();
                await page.waitForTimeout(80);
                const chooser = await page.evaluate(() => {
                  const badge = document.getElementById('mobSpdBadge');
                  const rail = document.getElementById('mobileSpeedrail');
                  const rect = rail?.getBoundingClientRect();
                  const header = document.querySelector('.mobile-top-bar')?.getBoundingClientRect();
                  const choices = [...(rail?.querySelectorAll('[data-speed]') || [])].map((el) => {
                    const r = el.getBoundingClientRect();
                    return { w: r.width, h: r.height, x: r.x, right: r.right, y: r.y };
                  });
                  return {
                    expanded: badge?.getAttribute('aria-expanded'),
                    controls: badge?.getAttribute('aria-controls'),
                    hidden: rail?.hidden, ariaHidden: rail?.getAttribute('aria-hidden'),
                    panel: rect ? { x: rect.x, right: rect.right, y: rect.y, width: rect.width } : null,
                    headerBottom: header?.bottom,
                    learningAccessible: (() => {
                      const el = document.querySelector('.mobile-learning-trigger');
                      return Boolean(el && el.getAttribute('aria-hidden') !== 'true' && !el.inert);
                    })(),
                    background: getComputedStyle(rail).backgroundColor, choices,
                  };
                });
                assert.equal(chooser.expanded, 'true', 'speed trigger ARIA did not open');
                assert.equal(chooser.controls, 'mobileSpeedrail', 'speed trigger has no owned picker');
                assert.equal(chooser.hidden, false, 'speed picker remains hidden');
                assert.equal(chooser.ariaHidden, 'false', 'speed picker remains inert to a11y');
                assert.equal(chooser.learningAccessible, true, 'visible Learning control became inert while speed is open');
                assert.ok(chooser.panel && chooser.panel.x >= 0 &&
                  chooser.panel.right <= width + 1 && chooser.panel.y >= chooser.headerBottom + 4,
                  'speed picker outside viewport or overlaps top bar');
                const bgAlpha = /rgba\([^)]*,\s*([.\d]+)\)$/.exec(chooser.background)?.[1];
                assert.ok(!bgAlpha || Number(bgAlpha) >= .98,
                  'speed popover must have opaque theme background: ' + chooser.background);
                const darkSurface = await page.evaluate(() => {
                  const html = document.documentElement, before = html.classList.contains('dark');
                  html.classList.add('dark');
                  const bg = getComputedStyle(document.getElementById('mobileSpeedrail')).backgroundColor;
                  html.classList.toggle('dark', before);
                  return bg;
                });
                const darkAlpha = /rgba\([^)]*,\s*([.\d]+)\)$/.exec(darkSurface)?.[1];
                assert.ok(!darkAlpha || Number(darkAlpha) >= .98,
                  'dark speed popover must be opaque: ' + darkSurface);
                assert.equal(chooser.choices.length, 6, 'speed choices lost');
                assert.ok(chooser.choices.every((x) => x.w >= 43 && x.h >= 43 &&
                  x.x >= 0 && x.right <= width + 1), 'speed choice hit target too narrow');
                const uniqueY = new Set(chooser.choices.map((x) => Math.round(x.y)));
                assert.equal(uniqueY.size, width === 320 ? 2 : 1,
                  'speed choices do not use the correct adaptive row count');
                await page.keyboard.press('Escape');
                const escaped = await page.evaluate(() => ({
                  expanded: document.getElementById('mobSpdBadge')?.getAttribute('aria-expanded'),
                  hidden: document.getElementById('mobileSpeedrail')?.hidden,
                  focus: document.activeElement?.id,
                }));
                assert.deepEqual(escaped, { expanded: 'false', hidden: true, focus: 'mobSpdBadge' },
                  'Escape did not close speed chooser and restore trigger focus');
              }
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
    console.log(engine + ': ' + routes.length * 8 + ' cases complete');
  }
} finally { await new Promise((resolve) => server.close(resolve)); }
if (covers === 0) failures.push({ error: 'No lettered artwork cover tested (data-reader-cover-fit=contain)' });
console.log(JSON.stringify({
  total: passed + failures.length, passed, failed: failures.length,
  series: [...readerBySeries.keys()], landings: landingRoutes,
  coverCases: covers, failures,
}, null, 2));
if (failures.length) process.exitCode = 1;
