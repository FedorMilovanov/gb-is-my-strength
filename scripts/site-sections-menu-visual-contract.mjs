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
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.bin': 'application/octet-stream',
};

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
  if (entry.status !== 'production-dist') return false;
  const file = distHtmlPath(entry.route);
  if (!fs.existsSync(file)) return false;
  const html = fs.readFileSync(file, 'utf8');
  return html.includes('id="hMobileMenuBtn"') && html.includes('id="hMobileNav"');
});
assert.ok(entries.length > 0, 'no canonical site-menu routes found');

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
function check(engine, route, id, pass, evidence) {
  checks.push({ engine, route, id, pass: Boolean(pass), evidence });
  assert.ok(pass, `${engine} ${route}: ${id} :: ${JSON.stringify(evidence)}`);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const trigger = document.getElementById('hMobileMenuBtn');
    const panel = document.getElementById('hMobileNav');
    const rect = panel?.getBoundingClientRect();
    const style = panel ? getComputedStyle(panel) : null;
    const links = panel ? [...panel.querySelectorAll('a[href]')] : [];
    const chevrons = panel ? [...panel.querySelectorAll('.gbs-menu-chevron')] : [];
    const svgs = panel ? [...panel.querySelectorAll('svg')] : [];
    const visible = (node) => {
      if (!node) return false;
      const s = getComputedStyle(node); const r = node.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > .01 && r.width > 0 && r.height > 0;
    };
    return {
      variant: panel?.getAttribute('data-gb-site-menu-variant') || null,
      open: Boolean(panel?.classList.contains('open')),
      expanded: trigger?.getAttribute('aria-expanded') || null,
      position: style?.position || null,
      visibility: style?.visibility || null,
      opacity: style ? Number(style.opacity || 1) : null,
      rect: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null,
      visibleLinks: links.filter(visible).length,
      chevrons: chevrons.map((node) => { const r = node.getBoundingClientRect(); return { width: r.width, height: r.height }; }),
      maxSvgWidth: svgs.reduce((max, node) => Math.max(max, node.getBoundingClientRect().width), 0),
      maxSvgHeight: svgs.reduce((max, node) => Math.max(max, node.getBoundingClientRect().height), 0),
      viewport: { width: innerWidth, height: innerHeight },
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
}

async function auditRoute(page, engine, origin, route) {
  await page.setViewportSize(MOBILE);
  await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(180);
  const trigger = page.locator('#hMobileMenuBtn');
  if (!(await trigger.isVisible().catch(() => false))) {
    await page.setViewportSize(DESKTOP);
    await page.waitForTimeout(100);
  }
  check(engine, route, 'trigger visible in supported viewport', await trigger.isVisible().catch(() => false), await snapshot(page));

  const before = await snapshot(page);
  if (before.variant === 'rich') {
    check(engine, route, 'closed rich menu is visually hidden', before.visibility === 'hidden' && before.opacity === 0, before);
  }

  await trigger.click();
  await page.waitForTimeout(140);
  const opened = await snapshot(page);
  check(engine, route, 'open menu is fixed and five links are visible', opened.open && opened.expanded === 'true' && opened.position === 'fixed' && opened.visibleLinks >= 5, opened);
  check(engine, route, 'menu never creates horizontal document overflow', opened.scrollWidth <= opened.viewport.width + 1, opened);
  check(engine, route, 'menu rectangle stays inside viewport', opened.rect && opened.rect.left >= -1 && opened.rect.right <= opened.viewport.width + 1 && opened.rect.top >= -1 && opened.rect.bottom <= opened.viewport.height + 1, opened);

  if (opened.variant === 'rich') {
    const bounded = opened.rect && opened.rect.width >= 180 && opened.rect.width <= 320 && opened.rect.height >= 150 && opened.rect.height <= 520;
    check(engine, route, 'rich reader menu has bounded canonical card geometry', bounded, opened);
    const chevronsBounded = opened.chevrons.length === 5 && opened.chevrons.every((r) => r.width >= 8 && r.width <= 20 && r.height >= 8 && r.height <= 20);
    check(engine, route, 'rich reader menu chevrons cannot escape icon geometry', chevronsBounded && opened.maxSvgWidth <= 20 && opened.maxSvgHeight <= 20, opened);
  }

  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
}

const { server, origin } = await startServer();
try {
  for (const [engine, launcher] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await launcher.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: MOBILE, serviceWorkers: 'block' });
      const page = await context.newPage();
      for (const entry of entries) await auditRoute(page, engine, origin, entry.route);
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
  routeAuthority: 'scripts/lib/public-surface-registry.js#buildPublicSurfaceRegistry',
  routeCount: entries.length,
  routes: entries.map((entry) => entry.route),
  passed: checks.filter((row) => row.pass).length,
  failed: checks.filter((row) => !row.pass).length,
  checks,
};
fs.writeFileSync(path.join(REPORTS, 'site-sections-menu-visual-contract.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(REPORTS, 'site-sections-menu-visual-contract.md'), [
  '# Site sections menu visual contract', '',
  `- SHA: ${report.sha || 'local'}`,
  `- Registry-derived menu routes: ${report.routeCount}`,
  `- Browsers: Chromium + WebKit`,
  `- Checks: ${report.passed}/${checks.length} PASS`,
  `- Failures: ${report.failed}`,
].join('\n') + '\n');
console.log(`Site sections menu visual contract: PASS (${report.passed}/${checks.length}; ${entries.length} routes; Chromium + WebKit)`);
