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

function isInsideDist(target) {
  const relative = path.relative(DIST, target);
  return relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative);
}

assert.equal(isInsideDist(path.join(DIST, 'index.html')), true, 'dist containment accepts owned file');
assert.equal(isInsideDist(path.resolve(DIST, '..', 'outside.html')), false, 'dist containment rejects traversal');

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

// Static fail-safe authority. Rich shared-reader menus must be harmless before
// any stylesheet or runtime has a chance to run: closed native hidden/inert,
// natively hidden backdrop, and bounded, non-filled SVG chevrons. This blocks
// both the historical 300x150 black-triangle failure and a full-screen orphan
// backdrop if authored presentation is missing or broken.
for (const entry of entries) {
  const html = fs.readFileSync(distHtmlPath(entry.route), 'utf8');
  if (!html.includes('data-gb-site-menu-variant="rich"')) continue;
  const nav = html.match(/<div\b[^>]*\bid="hMobileNav"[^>]*>/i)?.[0] || '';
  const backdrop = html.match(/<div\b[^>]*\bid="hMobileBackdrop"[^>]*>/i)?.[0] || '';
  assert.match(nav, /\bhidden(?:\s|>|=)/i, `${entry.route}: rich menu must be natively hidden at SSR`);
  assert.match(nav, /\binert(?:\s|>|=)/i, `${entry.route}: rich menu must be inert at SSR`);
  assert.match(backdrop, /\bhidden(?:\s|>|=)/i, `${entry.route}: rich menu backdrop must be natively hidden at SSR`);
  const chevrons = [...html.matchAll(/<svg\b[^>]*\bclass="[^"]*gbs-menu-chevron[^"]*"[^>]*>/gi)].map((match) => match[0]);
  assert.equal(chevrons.length, 5, `${entry.route}: expected five rich menu chevrons`);
  for (const svg of chevrons) {
    assert.match(svg, /\bwidth="13"/i, `${entry.route}: chevron missing native width`);
    assert.match(svg, /\bheight="13"/i, `${entry.route}: chevron missing native height`);
    assert.match(svg, /\bfill="none"/i, `${entry.route}: chevron must not default to black fill`);
    assert.match(svg, /\bstroke="currentColor"/i, `${entry.route}: chevron missing native stroke`);
  }
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
      let target = path.join(DIST, pathname.replace(/^\/+/, ''));
      if (pathname.endsWith('/')) target = path.join(target, 'index.html');
      if (!path.extname(target)) target = path.join(target, 'index.html');
      if (!isInsideDist(target) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
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

async function waitForRuntime(page) {
  await page.waitForFunction(
    () => document.getElementById('hMobileMenuBtn')?.getAttribute('data-gb-site-menu-owner') === 'canonical-runtime',
    null,
    { timeout: 5000 },
  );
}

async function snapshot(page) {
  return page.evaluate(() => {
    const trigger = document.getElementById('hMobileMenuBtn');
    const panel = document.getElementById('hMobileNav');
    const backdrop = document.getElementById('hMobileBackdrop');
    const rect = panel?.getBoundingClientRect();
    const backdropRect = backdrop?.getBoundingClientRect();
    const style = panel ? getComputedStyle(panel) : null;
    const backdropStyle = backdrop ? getComputedStyle(backdrop) : null;
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
      panelAriaHidden: panel?.getAttribute('aria-hidden') || null,
      triggerVisible: visible(trigger),
      hidden: Boolean(panel?.hidden),
      inert: Boolean(panel?.hasAttribute('inert') || panel?.inert),
      backdropHidden: backdrop ? Boolean(backdrop.hidden) : null,
      backdropVisible: visible(backdrop),
      backdropDisplay: backdropStyle?.display || null,
      backdropRect: backdropRect ? { width: backdropRect.width, height: backdropRect.height } : null,
      position: style?.position || null,
      display: style?.display || null,
      visibility: style?.visibility || null,
      opacity: style ? Number(style.opacity || 1) : null,
      rect: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null,
      visibleLinks: links.filter(visible).length,
      focusInsidePanel: Boolean(panel?.contains(document.activeElement)),
      activeElementId: document.activeElement?.id || null,
      chevrons: chevrons.map((node) => {
        const r = node.getBoundingClientRect();
        return {
          width: r.width,
          height: r.height,
          attrWidth: node.getAttribute('width'),
          attrHeight: node.getAttribute('height'),
          attrFill: node.getAttribute('fill'),
          attrStroke: node.getAttribute('stroke'),
        };
      }),
      maxSvgWidth: svgs.reduce((max, node) => Math.max(max, node.getBoundingClientRect().width), 0),
      maxSvgHeight: svgs.reduce((max, node) => Math.max(max, node.getBoundingClientRect().height), 0),
      viewport: { width: innerWidth, height: innerHeight },
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
}

function closedSafe(state) {
  if (state.open || state.visibleLinks !== 0) return false;
  const semanticsClosed = state.expanded === 'false' && state.panelAriaHidden === 'true';
  if (state.variant === 'rich') {
    return semanticsClosed
      && state.hidden && state.inert && state.backdropHidden
      && state.display === 'none'
      && state.rect?.width === 0 && state.rect?.height === 0
      && state.backdropDisplay === 'none'
      && state.backdropRect?.width === 0 && state.backdropRect?.height === 0;
  }
  return semanticsClosed && (state.visibility === 'hidden' || state.display === 'none' || state.opacity === 0);
}

async function assertClosed(page, engine, viewport, route, id) {
  await page.waitForTimeout(300);
  const state = await snapshot(page);
  check(engine, viewport, route, id, closedSafe(state), state);
  return state;
}

async function auditRoute(page, engine, origin, route) {
  // Always inspect the actual mobile rendering first. Do not silently switch to
  // desktop merely because the trigger is hidden: that old fallback is exactly
  // how an orphan mobile menu could leak gigantic SVGs while the test stayed green.
  await page.setViewportSize(MOBILE);
  await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
  await waitForRuntime(page);
  const mobileClosed = await assertClosed(page, engine, 'mobile', route, 'closed menu and backdrop cannot leak into mobile viewport');

  // Native fallback remains safe even if authored stylesheets are unavailable.
  if (mobileClosed.variant === 'rich') {
    const noCss = await page.evaluate(() => {
      document.querySelectorAll('style,link[rel="stylesheet"]').forEach((node) => node.remove());
      const panel = document.getElementById('hMobileNav');
      const backdrop = document.getElementById('hMobileBackdrop');
      const rect = panel?.getBoundingClientRect();
      const backdropRect = backdrop?.getBoundingClientRect();
      return {
        hidden: Boolean(panel?.hidden),
        inert: Boolean(panel?.hasAttribute('inert') || panel?.inert),
        display: panel ? getComputedStyle(panel).display : null,
        rect: rect ? { width: rect.width, height: rect.height } : null,
        backdropHidden: backdrop ? Boolean(backdrop.hidden) : null,
        backdropDisplay: backdrop ? getComputedStyle(backdrop).display : null,
        backdropRect: backdropRect ? { width: backdropRect.width, height: backdropRect.height } : null,
      };
    });
    check(
      engine,
      'mobile-no-css',
      route,
      'native closed-state survives stylesheet loss for panel and backdrop',
      noCss.hidden && noCss.inert && noCss.display === 'none'
        && noCss.rect?.width === 0 && noCss.rect?.height === 0
        && noCss.backdropHidden && noCss.backdropDisplay === 'none'
        && noCss.backdropRect?.width === 0 && noCss.backdropRect?.height === 0,
      noCss,
    );

    const noCssLifecycle = await page.evaluate(() => {
      const trigger = document.getElementById('hMobileMenuBtn');
      const panel = document.getElementById('hMobileNav');
      const backdrop = document.getElementById('hMobileBackdrop');
      trigger?.click();
      const opened = Boolean(panel?.classList.contains('open')) && panel?.hidden === false;
      trigger?.click();
      return {
        opened,
        closed: !panel?.classList.contains('open'),
        hidden: Boolean(panel?.hidden),
        inert: Boolean(panel?.hasAttribute('inert') || panel?.inert),
        backdropHidden: backdrop ? Boolean(backdrop.hidden) : null,
        expanded: trigger?.getAttribute('aria-expanded') || null,
        ariaHidden: panel?.getAttribute('aria-hidden') || null,
      };
    });
    check(
      engine,
      'mobile-no-css',
      route,
      'runtime close restores native safety immediately when no transition exists',
      noCssLifecycle.opened
        && noCssLifecycle.closed
        && noCssLifecycle.hidden
        && noCssLifecycle.inert
        && noCssLifecycle.backdropHidden
        && noCssLifecycle.expanded === 'false'
        && noCssLifecycle.ariaHidden === 'true',
      noCssLifecycle,
    );
  }

  // Reload after the destructive no-CSS probe, then choose the first viewport in
  // which the real opener is supported. Closed-state assertions are repeated on
  // desktop before any interaction so both breakpoints are independently covered.
  await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
  await waitForRuntime(page);
  await page.waitForTimeout(300);
  let supportedViewport = 'mobile';
  let state = await snapshot(page);
  if (!state.triggerVisible) {
    await page.setViewportSize(DESKTOP);
    await page.waitForTimeout(300);
    supportedViewport = 'desktop';
    state = await snapshot(page);
  }
  check(engine, supportedViewport, route, 'trigger visible in supported viewport', state.triggerVisible, state);
  if (supportedViewport === 'desktop') {
    check(engine, 'desktop', route, 'closed menu cannot leak before desktop interaction', closedSafe(state), state);
  }

  const trigger = page.locator('#hMobileMenuBtn');
  await trigger.click();
  await page.waitForTimeout(160);
  const opened = await snapshot(page);
  check(
    engine,
    supportedViewport,
    route,
    'open menu exposes live focusable surface',
    opened.open && opened.expanded === 'true' && opened.panelAriaHidden === null
      && opened.position === 'fixed' && opened.visibleLinks >= 5
      && !opened.hidden && !opened.inert && opened.focusInsidePanel,
    opened,
  );
  check(engine, supportedViewport, route, 'menu never creates horizontal document overflow', opened.scrollWidth <= opened.viewport.width + 1, opened);
  check(engine, supportedViewport, route, 'menu rectangle stays inside viewport', opened.rect && opened.rect.left >= -1 && opened.rect.right <= opened.viewport.width + 1 && opened.rect.top >= -1 && opened.rect.bottom <= opened.viewport.height + 1, opened);

  if (opened.variant === 'rich') {
    const bounded = opened.rect && opened.rect.width >= 180 && opened.rect.width <= 320 && opened.rect.height >= 150 && opened.rect.height <= 520;
    check(engine, supportedViewport, route, 'rich reader menu has bounded canonical card geometry', bounded, opened);
    const chevronsBounded = opened.chevrons.length === 5 && opened.chevrons.every((row) =>
      row.width >= 8 && row.width <= 20 && row.height >= 8 && row.height <= 20
      && row.attrWidth === '13' && row.attrHeight === '13'
      && row.attrFill === 'none' && row.attrStroke === 'currentColor'
    );
    check(engine, supportedViewport, route, 'rich reader menu chevrons cannot escape native or CSS icon geometry', chevronsBounded && opened.maxSvgWidth <= 20 && opened.maxSvgHeight <= 20, opened);
    if (supportedViewport === 'mobile') {
      check(engine, supportedViewport, route, 'rich mobile menu exposes its backdrop while open', opened.backdropVisible, opened);
    }
  }

  await page.keyboard.press('Escape');
  const escaped = await assertClosed(page, engine, supportedViewport, route, 'Escape restores native hidden closed-state');
  check(engine, supportedViewport, route, 'Escape restores focus to the menu trigger', escaped.activeElementId === 'hMobileMenuBtn', escaped);

  if (opened.variant === 'rich' && supportedViewport === 'mobile') {
    await trigger.click();
    await page.waitForTimeout(160);
    await page.locator('#hMobileBackdrop').click({ position: { x: 5, y: 5 } });
    const backdropClosed = await assertClosed(page, engine, supportedViewport, route, 'backdrop click restores native hidden closed-state');
    check(engine, supportedViewport, route, 'backdrop click restores focus to the menu trigger', backdropClosed.activeElementId === 'hMobileMenuBtn', backdropClosed);
  }
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
  `- Mobile closed-state: always checked before viewport fallback`,
  `- Native no-CSS fail-safe: panel + backdrop on rich menus, including immediate runtime close`,
  `- Close semantics: hidden/inert + aria-expanded/aria-hidden + Escape/backdrop focus restore`,
  `- Evidence server path containment: traversal-rejecting`,
  `- Checks: ${report.passed}/${checks.length} PASS`,
  `- Failures: ${report.failed}`,
].join('\n') + '\n');
console.log(`Site sections menu visual contract: PASS (${report.passed}/${checks.length}; ${entries.length} routes; Chromium + WebKit)`);
