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

const registry = buildPublicSurfaceRegistry();
assert.deepEqual(registry.errors, [], `public surface registry must be green: ${registry.errors.join('; ')}`);
const reading = registry.entries.filter((entry) => entry.routeRole === 'reading');
const articleRoutes = reading.filter((entry) => entry.surface === 'article').map((entry) => entry.route);
const flatSeries = reading.find((entry) => entry.surface === 'series' && entry.seriesShape === 'flat');
const bookSeries = reading.find((entry) => entry.surface === 'series' && entry.seriesShape === 'book');
assert.ok(articleRoutes.length > 0, 'public authority must expose standalone reading articles');
assert.ok(flatSeries, 'public authority must expose a flat reading series representative');
assert.ok(bookSeries, 'public authority must expose a book reading series representative');

function distHtmlPath(route) {
  if (route === '/') return path.join(DIST, 'index.html');
  return path.join(DIST, route.replace(/^\/+|\/+$/g, ''), 'index.html');
}

const menuEntries = registry.entries.filter((entry) => {
  if (entry.status !== 'production-dist') return false;
  const file = distHtmlPath(entry.route);
  if (!fs.existsSync(file)) return false;
  const html = fs.readFileSync(file, 'utf8');
  return html.includes('id="hMobileMenuBtn"') && html.includes('id="hMobileNav"');
});
const menuRoutes = menuEntries.map((entry) => entry.route);
assert.ok(menuRoutes.length > 0, 'public authority must expose site-menu routes');
for (const entry of menuEntries) {
  const html = fs.readFileSync(distHtmlPath(entry.route), 'utf8');
  const hasNoJsFallback = entry.route === '/'
    ? html.includes('class="h-nojs-nav"')
    : html.includes('data-gb-site-menu-nojs');
  assert.ok(hasNoJsFallback, `${entry.route}: site menu has no truthful no-JS fallback`);
}

const longLockRoutes = new Set([
  '/', '/articles/', '/biografii/', '/hard-texts/', '/pastor-series/',
  articleRoutes[0], '/articles/dzhon-gill-chast-1-chelovek/', flatSeries.route, bookSeries.route,
].filter(Boolean));
const screenshotRoutes = new Map([
  ['/', 'home'],
  ['/articles/', 'articles-landing'],
  ['/biografii/', 'biografii-landing'],
  ['/hard-texts/', 'hard-texts-landing'],
  ['/pastor-series/', 'pastor-series-landing'],
  ['/nagornaya/seriya/', 'nagornaya-series-landing'],
  ['/baptisty-rossii/', 'baptisty-landing'],
  ['/articles/dzhon-gill-chast-1-chelovek/', 'gill-reader'],
  [articleRoutes[0], 'standalone-reader'],
  [flatSeries.route, 'flat-series-reader'],
  [bookSeries.route, 'book-series-reader'],
].filter(([route]) => Boolean(route)));

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
function check(engine, viewport, route, id, pass, evidence = null) {
  checks.push({ engine, viewport, route, id, pass: Boolean(pass), evidence });
  assert.ok(pass, `${engine}/${viewport} ${route}: ${id}${evidence ? ` :: ${JSON.stringify(evidence)}` : ''}`);
}

async function waitForReader(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !document.readyState || document.readyState !== 'loading');
  await page.waitForTimeout(180);
}

async function relationAudit(page) {
  return page.evaluate(() => {
    const missing = [];
    for (const attr of ['aria-controls', 'aria-labelledby', 'aria-describedby']) {
      document.querySelectorAll(`[${attr}]`).forEach((node) => {
        const ids = String(node.getAttribute(attr) || '').trim().split(/\s+/).filter(Boolean);
        ids.forEach((id) => { if (!document.getElementById(id)) missing.push({ attr, id, owner: node.id || node.className || node.tagName }); });
      });
    }
    return missing;
  });
}

async function menuSnapshot(page) {
  return page.evaluate(() => {
    const trigger = document.getElementById('hMobileMenuBtn');
    const panel = document.getElementById('hMobileNav');
    const html = document.documentElement;
    const body = document.body;
    const searchOpen = Boolean(
      document.querySelector('.cp-backdrop.is-open, .cp-panel[aria-hidden="false"], #gbCommandPalette.is-open, #gbCommandPalette[aria-hidden="false"]')
    );
    return {
      owner: trigger?.getAttribute('data-gb-site-menu-owner') || null,
      controls: trigger?.getAttribute('aria-controls') || null,
      expanded: trigger?.getAttribute('aria-expanded') || null,
      label: trigger?.getAttribute('aria-label') || null,
      panelHidden: panel?.getAttribute('aria-hidden') || null,
      panelOpen: Boolean(panel?.classList.contains('open')),
      panelInert: Boolean(panel?.hasAttribute('inert') || panel?.inert),
      focusInside: Boolean(panel?.contains(document.activeElement)),
      focusReturned: document.activeElement === trigger,
      overlayTop: html.getAttribute('data-overlay-top'),
      overlayCount: html.getAttribute('data-overlay-count'),
      scrollLocked: html.getAttribute('data-scroll-locked') === '1'
        && body.style.position === 'fixed'
        && body.style.overflow === 'hidden',
      searchOpen,
    };
  });
}

async function auditSiteMenuRoute(page, engine, origin, entry) {
  const route = entry.route;
  await page.setViewportSize(MOBILE);
  await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
  await waitForReader(page);

  const trigger = page.locator('#hMobileMenuBtn');
  let viewport = 'mobile';
  if (!(await trigger.isVisible().catch(() => false))) {
    await page.setViewportSize(DESKTOP);
    await page.waitForTimeout(100);
    viewport = 'desktop';
  }
  check(engine, viewport, route, 'site-menu trigger visible in a supported viewport', await trigger.isVisible().catch(() => false));

  const closedBefore = await menuSnapshot(page);
  check(engine, viewport, route, 'site-menu uses canonical shared runtime owner', closedBefore.owner === 'canonical-runtime', closedBefore);
  check(engine, viewport, route, 'site-menu controls canonical panel', closedBefore.controls === 'hMobileNav', closedBefore);
  check(engine, viewport, route, 'site-menu starts closed and Search stays separate', closedBefore.expanded === 'false' && closedBefore.panelHidden === 'true' && !closedBefore.panelOpen && !closedBefore.searchOpen, closedBefore);

  await trigger.focus();
  await trigger.click();
  await page.waitForTimeout(150);
  const opened = await menuSnapshot(page);
  check(engine, viewport, route, 'site-menu opens exact sections panel', opened.expanded === 'true' && opened.panelHidden !== 'true' && opened.panelOpen && !opened.panelInert, opened);
  check(engine, viewport, route, 'site-menu enters canonical overlay stack and locks scroll', opened.overlayTop === 'site-sections-menu' && opened.scrollLocked, opened);
  check(engine, viewport, route, 'site-menu moves focus into panel', opened.focusInside, opened);
  check(engine, viewport, route, 'hamburger never opens Search', !opened.searchOpen, opened);

  if (engine === 'chromium' && screenshotRoutes.has(route)) {
    const safe = screenshotRoutes.get(route);
    await page.screenshot({
      path: path.join(REPORTS, `reader-controls-a11y-menu-${safe}.png`),
      fullPage: false,
    });
  }

  if (longLockRoutes.has(route)) {
    await page.waitForTimeout(3350);
    const held = await menuSnapshot(page);
    check(engine, viewport, route, 'site-menu keeps lock beyond emergency cycle', held.panelOpen && held.expanded === 'true' && held.overlayTop === 'site-sections-menu' && held.scrollLocked, held);
  }

  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const closed = await menuSnapshot(page);
  check(engine, viewport, route, 'Escape closes menu, unlocks and restores opener focus', closed.expanded === 'false' && closed.panelHidden === 'true' && !closed.panelOpen && closed.panelInert && !closed.scrollLocked && closed.focusReturned, closed);
}

async function auditNoJsFallback(browser, engine, origin, routes) {
  const context = await browser.newContext({ viewport: MOBILE, javaScriptEnabled: false, serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    for (const route of routes) {
      await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
      const state = await page.evaluate(() => {
        const fallback = document.querySelector('[data-gb-site-menu-nojs], .h-nojs-nav');
        if (fallback instanceof HTMLDetailsElement) fallback.open = true;
        const links = fallback ? Array.from(fallback.querySelectorAll('a[href]')) : [];
        const visible = (node) => {
          if (!node) return false;
          const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };
        return { exists: Boolean(fallback), visible: visible(fallback), links: links.length, visibleLinks: links.filter(visible).length };
      });
      check(engine, 'mobile-nojs', route, 'primary navigation survives without JavaScript', state.exists && state.visible && state.links >= 5 && state.visibleLinks >= 5, state);
    }
  } finally {
    await context.close();
  }
}

async function auditStandaloneDesktop(page, engine, origin, route) {
  await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
  await waitForReader(page);
  const snap = await page.evaluate(() => {
    const visible = (node) => {
      if (!node) return false;
      const s = getComputedStyle(node); const r = node.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > 0.01 && r.width > 0 && r.height > 0;
    };
    const menu = document.getElementById('hMobileMenuBtn');
    const nav = document.getElementById('hMobileNav');
    const search = Array.from(document.querySelectorAll('[data-fc-action="search"], #gbSearchBtn, [data-gbs2-search]')).find(visible) || null;
    const settings = Array.from(document.querySelectorAll('#hrailSettingsBtn, #gbFcSettings, [data-gill-settings-open]')).filter(visible);
    const listChildren = Array.from(document.querySelectorAll('ul.hrail-toc')).flatMap((list) => Array.from(list.children).map((node) => node.tagName));
    return {
      railVisible: visible(document.querySelector('.hrail')),
      menuExists: Boolean(menu), navExists: Boolean(nav), searchExists: Boolean(search),
      menuAction: menu?.getAttribute('data-fc-action') || null,
      menuLabel: menu?.getAttribute('aria-label') || null,
      menuControls: menu?.getAttribute('aria-controls') || null,
      settingsCount: settings.length,
      listChildren,
    };
  });
  check(engine, 'desktop', route, 'standalone rail rendered', snap.railVisible, snap);
  check(engine, 'desktop', route, 'hamburger is truthful Menu action with real target', snap.menuExists && snap.navExists && snap.menuAction !== 'search' && /меню/i.test(snap.menuLabel || '') && snap.menuControls === 'hMobileNav', snap);
  check(engine, 'desktop', route, 'Search remains a separate action', snap.searchExists, snap);
  check(engine, 'desktop', route, 'exactly one standalone desktop Settings action', snap.settingsCount === 1, snap);
  check(engine, 'desktop', route, 'standalone TOC direct children are list items', snap.listChildren.length > 0 && snap.listChildren.every((tag) => tag === 'LI'), snap.listChildren);
  const missing = await relationAudit(page);
  check(engine, 'desktop', route, 'ARIA references resolve', missing.length === 0, missing.slice(0, 10));

  await page.locator('#hMobileMenuBtn').click();
  await page.waitForTimeout(120);
  const opened = await page.evaluate(() => ({
    expanded: document.getElementById('hMobileMenuBtn')?.getAttribute('aria-expanded'),
    hidden: document.getElementById('hMobileNav')?.getAttribute('aria-hidden'),
    open: document.getElementById('hMobileNav')?.classList.contains('open'),
  }));
  check(engine, 'desktop', route, 'Menu opens exact site-sections surface', opened.expanded === 'true' && opened.hidden !== 'true' && opened.open, opened);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  const closed = await page.evaluate(() => ({
    expanded: document.getElementById('hMobileMenuBtn')?.getAttribute('aria-expanded'),
    hidden: document.getElementById('hMobileNav')?.getAttribute('aria-hidden'),
    open: document.getElementById('hMobileNav')?.classList.contains('open'),
  }));
  check(engine, 'desktop', route, 'Escape closes Menu and synchronizes trigger', closed.expanded === 'false' && closed.hidden === 'true' && !closed.open, closed);
}

async function auditStandaloneMobile(page, engine, origin, route) {
  await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
  await waitForReader(page);
  const missing = await relationAudit(page);
  check(engine, 'mobile', route, 'ARIA references resolve', missing.length === 0, missing.slice(0, 10));
}

async function openPartToc(page) {
  const trigger = page.locator('#mobPartTocBtn');
  if (await trigger.isVisible().catch(() => false)) {
    await trigger.click();
    await page.waitForTimeout(140);
  }
}

async function auditSeries(page, engine, origin, entry, viewport) {
  const route = entry.route;
  await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
  await waitForReader(page);
  const listChildren = await page.evaluate(() => Array.from(document.querySelectorAll('ul.gbs2-toc')).flatMap((list) => Array.from(list.children).map((node) => node.tagName)));
  check(engine, viewport, route, 'series TOC direct children are list items', listChildren.length > 0 && listChildren.every((tag) => tag === 'LI'), listChildren);
  const missingBefore = await relationAudit(page);
  check(engine, viewport, route, 'ARIA references resolve', missingBefore.length === 0, missingBefore.slice(0, 10));

  if (viewport === 'desktop') {
    const menu = await page.evaluate(() => ({
      controls: document.getElementById('hMobileMenuBtn')?.getAttribute('aria-controls') || null,
      target: Boolean(document.getElementById('hMobileNav')),
    }));
    check(engine, viewport, route, 'series Menu relation remains intact', menu.controls === 'hMobileNav' && menu.target, menu);
    return;
  }

  await openPartToc(page);
  const partRelations = await page.evaluate(() => Array.from(document.querySelectorAll('.gbat-hd')).map((button) => ({
    controls: button.getAttribute('aria-controls'),
    target: Boolean(button.getAttribute('aria-controls') && document.getElementById(button.getAttribute('aria-controls'))),
  })));
  check(engine, viewport, route, 'Part-TOC headers expose controlled regions', partRelations.length > 0 && partRelations.every((row) => row.controls && row.target), partRelations.slice(0, 8));
  const partButton = page.locator('.gbat-hd').first();
  const before = await partButton.getAttribute('aria-expanded');
  await partButton.click();
  await page.waitForTimeout(90);
  const after = await partButton.getAttribute('aria-expanded');
  check(engine, viewport, route, 'Part-TOC header expanded state changes on activation', before !== after, { before, after });

  if (entry.seriesShape === 'book') {
    const articleRelations = await page.evaluate(() => Array.from(document.querySelectorAll('.gbat-art-chev')).map((button) => ({
      controls: button.getAttribute('aria-controls'),
      target: Boolean(button.getAttribute('aria-controls') && document.getElementById(button.getAttribute('aria-controls'))),
    })));
    check(engine, viewport, route, 'book article chevrons expose controlled regions', articleRelations.length > 0 && articleRelations.every((row) => row.controls && row.target), articleRelations.slice(0, 8));

    const chevronParent = await page.evaluate(() => {
      for (const button of document.querySelectorAll('.gbat-hd')) {
        const controls = button.getAttribute('aria-controls');
        const region = controls ? document.getElementById(controls) : null;
        if (region?.querySelector('.gbat-art-chev')) return { controls, expanded: button.getAttribute('aria-expanded') };
      }
      return null;
    });
    check(engine, viewport, route, 'book chevron belongs to a declared part region', Boolean(chevronParent?.controls), chevronParent);

    const chevronPartButton = page.locator(`.gbat-hd[aria-controls="${chevronParent.controls}"]`);
    if ((await chevronPartButton.getAttribute('aria-expanded')) !== 'true') {
      await chevronPartButton.click();
      await page.waitForTimeout(90);
    }
    const reopened = await chevronPartButton.getAttribute('aria-expanded');
    check(engine, viewport, route, 'book article chevron parent part is expanded before pointer activation', reopened === 'true', { before: chevronParent.expanded, reopened });

    const chev = page.locator(`[id="${chevronParent.controls}"] .gbat-art-chev`).first();
    await chev.waitFor({ state: 'visible' });
    const artBefore = await chev.getAttribute('aria-expanded');
    await chev.click();
    await page.waitForTimeout(90);
    const artAfter = await chev.getAttribute('aria-expanded');
    check(engine, viewport, route, 'book article chevron expanded state changes on activation', artBefore !== artAfter, { artBefore, artAfter });
  }
}

const { server, origin } = await startServer();
try {
  for (const [engine, launcher] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await launcher.launch({ headless: true });
    try {
      const menuContext = await browser.newContext({ viewport: MOBILE, serviceWorkers: 'block' });
      const menuPage = await menuContext.newPage();
      for (const entry of menuEntries) await auditSiteMenuRoute(menuPage, engine, origin, entry);
      await menuContext.close();

      await auditNoJsFallback(browser, engine, origin, [
        '/', '/articles/', '/biografii/', '/hard-texts/', '/pastor-series/',
        articleRoutes[0], '/articles/dzhon-gill-chast-1-chelovek/', flatSeries.route, bookSeries.route,
      ].filter((route, index, all) => route && menuRoutes.includes(route) && all.indexOf(route) === index));

      const desktop = await browser.newContext({ viewport: DESKTOP, serviceWorkers: 'block' });
      const desktopPage = await desktop.newPage();
      for (const route of articleRoutes) await auditStandaloneDesktop(desktopPage, engine, origin, route);
      await auditSeries(desktopPage, engine, origin, flatSeries, 'desktop');
      await auditSeries(desktopPage, engine, origin, bookSeries, 'desktop');
      await desktop.close();

      const mobile = await browser.newContext({ viewport: MOBILE, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
      const mobilePage = await mobile.newPage();
      for (const route of articleRoutes) await auditStandaloneMobile(mobilePage, engine, origin, route);
      await auditSeries(mobilePage, engine, origin, flatSeries, 'mobile');
      await auditSeries(mobilePage, engine, origin, bookSeries, 'mobile');
      await mobile.close();
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
  articleRoutes,
  flatSeries: flatSeries.route,
  bookSeries: bookSeries.route,
  menuRoutes,
  menuRouteCount: menuRoutes.length,
  checks,
  passed: checks.filter((item) => item.pass).length,
  failed: checks.filter((item) => !item.pass).length,
};
fs.writeFileSync(path.join(REPORTS, 'reader-controls-residual-browser-contract.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(REPORTS, 'reader-controls-residual-browser-contract.md'), [
  '# Reader controls residual browser contract', '',
  `- SHA: ${report.sha || 'local'}`,
  `- Route authority: ${report.routeAuthority}`,
  `- Standalone reading routes: ${articleRoutes.length}`,
  `- Flat series representative: ${flatSeries.route}`,
  `- Book series representative: ${bookSeries.route}`,
  `- Canonical site-menu routes: ${report.menuRouteCount}`,
  `- Site-menu authority: SiteSectionsMenuRuntime -> OverlayRuntime`,
  `- Checks: ${report.passed}/${checks.length} PASS`,
  `- Failures: ${report.failed}`,
].join('\n') + '\n');
console.log(`Reader controls residual browser contract: PASS (${report.passed}/${checks.length}; Chromium + WebKit; mobile + desktop)`);
