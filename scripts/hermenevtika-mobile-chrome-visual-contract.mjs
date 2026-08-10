#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const require = createRequire(import.meta.url);
const { buildPublicSurfaceRegistry } = require('./lib/public-surface-registry.js');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const REPORTS = path.join(ROOT, 'reports');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.bin': 'application/octet-stream',
};
const VIEWPORTS = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-412', width: 412, height: 915 },
  { name: 'legacy-pill-edge-899', width: 899, height: 900 },
  { name: 'tablet-900', width: 900, height: 900 },
  { name: 'tablet-1199', width: 1199, height: 900 },
  { name: 'desktop-1200', width: 1200, height: 900 },
  { name: 'desktop-1440', width: 1440, height: 900 },
];

fs.mkdirSync(REPORTS, { recursive: true });
assert.ok(fs.existsSync(DIST), 'production-like dist is required');

function distHtmlPath(route) {
  return route === '/'
    ? path.join(DIST, 'index.html')
    : path.join(DIST, route.replace(/^\/+|\/+$/g, ''), 'index.html');
}

const registry = buildPublicSurfaceRegistry();
assert.deepEqual(registry.errors, [], `public surface registry must be green: ${registry.errors.join('; ')}`);
const entries = registry.entries.filter((entry) => {
  if (entry.status !== 'production-dist' || entry.routeRole !== 'reading') return false;
  const file = distHtmlPath(entry.route);
  if (!fs.existsSync(file)) return false;
  const html = fs.readFileSync(file, 'utf8');
  return html.includes('data-hm-reader')
    && html.includes('gb-floater--hermeneutics')
    && html.includes('class="hmtop')
    && html.includes('class="hmbar');
});
assert.ok(entries.length >= 1, 'no production Hermenevtika mobile-chrome route found');

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
      let target = path.join(DIST, pathname.replace(/^\/+/, ''));
      if (pathname.endsWith('/')) target = path.join(target, 'index.html');
      if (!path.extname(target)) target = path.join(target, 'index.html');
      if (!target.startsWith(DIST) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(target).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

const checks = [];
function check(engine, viewport, route, id, pass, evidence) {
  checks.push({ engine, viewport, route, id, pass: Boolean(pass), evidence });
  assert.ok(pass, `${engine}/${viewport} ${route}: ${id} :: ${JSON.stringify(evidence)}`);
}

async function waitForStable(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => document.readyState !== 'loading');
  await page.waitForTimeout(350);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const visible = (node) => {
      if (!node) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || 1) > .01
        && rect.width > 0
        && rect.height > 0;
    };
    const rectOf = (node) => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    };
    const floater = document.getElementById('gbFloatingControls');
    const top = document.querySelector('.hmtop');
    const bottom = document.querySelector('.hmbar');
    const rail = document.querySelector('.hrail');
    const fab = document.getElementById('gb-hl-fab');
    const share = document.getElementById('hmShareBtn');
    return {
      viewport: { width: innerWidth, height: innerHeight },
      scrollWidth: document.documentElement.scrollWidth,
      floater: { visible: visible(floater), rect: rectOf(floater), display: floater ? getComputedStyle(floater).display : null },
      top: { visible: visible(top), rect: rectOf(top) },
      bottom: { visible: visible(bottom), rect: rectOf(bottom) },
      rail: { visible: visible(rail), rect: rectOf(rail) },
      fab: {
        exists: Boolean(fab), visible: visible(fab), rect: rectOf(fab),
        docked: Boolean(fab?.classList.contains('gb-hl-fab--docked')),
        hostClass: Boolean(fab?.classList.contains('hmbar-btn')),
        parentIsBottom: fab?.parentElement === bottom,
        nextIsShare: fab?.nextElementSibling === share,
      },
      share: { exists: Boolean(share), visible: visible(share), rect: rectOf(share) },
    };
  });
}

function approx(a, b, tolerance = 1) {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
}

async function assertHighlightsGeometry(page, engine, viewport, route) {
  await page.waitForFunction(() => document.getElementById('gb-hl-fab')?.classList.contains('visible'), null, { timeout: 5000 });
  await page.waitForTimeout(80);
  const state = await snapshot(page);
  const fab = state.fab.rect;
  const share = state.share.rect;
  const bar = state.bottom.rect;
  const geometryOk = state.fab.visible
    && state.fab.docked
    && state.fab.hostClass
    && state.fab.parentIsBottom
    && state.fab.nextIsShare
    && state.share.visible
    && fab && share && bar
    && approx(fab.width, share.width)
    && approx(fab.height, share.height)
    && approx(fab.cy, share.cy)
    && fab.top >= bar.top - 1
    && fab.bottom <= bar.bottom + 1;
  check(engine, viewport, route, 'saved-quotes control inherits exact bottom-bar geometry', geometryOk, state);
}

async function exerciseHighlights(page, engine, viewport, route) {
  const fab = page.locator('#gb-hl-fab');
  await fab.focus();
  await fab.click();
  await page.waitForTimeout(120);
  const opened = await page.evaluate(() => {
    const backdrop = document.getElementById('gb-hl-backdrop');
    const panel = document.getElementById('gb-hl-panel');
    const visible = (node) => {
      if (!node) return false;
      const s = getComputedStyle(node); const r = node.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    };
    return {
      open: Boolean(backdrop?.classList.contains('is-open')),
      ariaHidden: backdrop?.getAttribute('aria-hidden'),
      panelVisible: visible(panel),
      focusInside: Boolean(backdrop?.contains(document.activeElement)),
    };
  });
  check(engine, viewport, route, 'saved-quotes panel opens above mobile chrome with focus inside', opened.open && opened.ariaHidden === 'false' && opened.panelVisible && opened.focusInside, opened);
  await page.locator('#gb-hl-close').click();
  await page.waitForTimeout(80);
  const closed = await page.evaluate(() => ({
    open: document.getElementById('gb-hl-backdrop')?.classList.contains('is-open'),
    ariaHidden: document.getElementById('gb-hl-backdrop')?.getAttribute('aria-hidden'),
    focusReturned: document.activeElement === document.getElementById('gb-hl-fab'),
  }));
  check(engine, viewport, route, 'saved-quotes close restores opener focus', !closed.open && closed.ariaHidden === 'true' && closed.focusReturned, closed);
}

const { server, origin } = await startServer();
try {
  for (const [engine, launcher] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await launcher.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      await context.addInitScript(() => {
        const seeded = [{
          id: 'contract-seed',
          text: 'Проверочная сохранённая цитата для геометрии мобильной панели.',
          articleTitle: 'Contract seed',
          url: location.origin + location.pathname + '#contract-seed',
          savedAt: Date.now(),
        }];
        localStorage.setItem('gb-highlights-v1', JSON.stringify(seeded));
      });
      const page = await context.newPage();
      for (const entry of entries) {
        for (const viewport of VIEWPORTS) {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await page.goto(origin + entry.route, { waitUntil: 'domcontentloaded' });
          await waitForStable(page);
          const state = await snapshot(page);
          check(engine, viewport.name, entry.route, 'reader chrome never creates horizontal overflow', state.scrollWidth <= state.viewport.width + 1, state);

          if (viewport.width <= 1199) {
            check(engine, viewport.name, entry.route, 'Hermenevtika mobile bars own <=1199 and desktop floater is absent', state.top.visible && state.bottom.visible && !state.floater.visible && !state.rail.visible, state);
            await assertHighlightsGeometry(page, engine, viewport.name, entry.route);
          } else {
            check(engine, viewport.name, entry.route, 'desktop rail/floater own >=1200 and mobile bars are absent', state.floater.visible && state.rail.visible && !state.top.visible && !state.bottom.visible, state);
          }

          if (viewport.width === 390) {
            await exerciseHighlights(page, engine, viewport.name, entry.route);
          }

          if (engine === 'chromium' && [390, 900, 1199, 1200].includes(viewport.width)) {
            const safeRoute = entry.route.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '-');
            await page.screenshot({ path: path.join(REPORTS, `hermenevtika-mobile-chrome-${safeRoute}-${viewport.width}.png`), fullPage: false });
          }
        }
      }
      await context.close();
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

const report = {
  sha: process.env.GITHUB_SHA || null,
  routeAuthority: 'scripts/lib/public-surface-registry.js#buildPublicSurfaceRegistry + built data-hm-reader/gb-floater--hermeneutics markers',
  routes: entries.map((entry) => entry.route),
  viewports: VIEWPORTS,
  browsers: ['chromium', 'webkit'],
  passed: checks.filter((row) => row.pass).length,
  failed: checks.filter((row) => !row.pass).length,
  checks,
};
fs.writeFileSync(path.join(REPORTS, 'hermenevtika-mobile-chrome-visual-contract.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(REPORTS, 'hermenevtika-mobile-chrome-visual-contract.md'), [
  '# Hermenevtika mobile chrome visual contract', '',
  `- SHA: ${report.sha || 'local'}`,
  `- Routes: ${report.routes.join(', ')}`,
  `- Browsers: Chromium + WebKit`,
  `- Breakpoints: ${VIEWPORTS.map((row) => row.width).join(', ')}`,
  `- Saved quote seeded: yes`,
  `- Checks: ${report.passed}/${checks.length} PASS`,
  `- Failures: ${report.failed}`,
].join('\n') + '\n');
console.log(`Hermenevtika mobile chrome visual contract: PASS (${report.passed}/${checks.length}; ${entries.length} route(s); Chromium + WebKit)`);
