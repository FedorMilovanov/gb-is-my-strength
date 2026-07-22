#!/usr/bin/env node
/**
 * Breadth Playwright witness for every public route in the canonical surface registry.
 *
 * This complements scripts/engine-sweep.mjs: engine-sweep keeps deep representative
 * PLAY/MediaSession/reader interactions; this matrix proves that no classified route
 * silently misses its expected chrome or ships a route-local browser regression.
 *
 * Prerequisites: production-like dist and Playwright Chromium.
 */
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { buildPublicSurfaceRegistry } = require('./lib/public-surface-registry');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const REPORTS = join(ROOT, 'reports');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
};
const VIEWPORTS = [
  { id: 'mobile-320', width: 320, height: 760, mobile: true },
  { id: 'mobile-390', width: 390, height: 844, mobile: true },
  { id: 'desktop-1440', width: 1440, height: 900, mobile: false },
];
const MAX_WORKERS = Math.max(1, Math.min(4, Number(process.env.GB_MATRIX_WORKERS || 4)));
const PUBLIC_STATUS = new Set(['production-dist']);

function routeFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  return join(DIST, clean, clean.endsWith('.html') ? '' : 'index.html');
}

async function serve() {
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
      let file = routeFile(pathname);
      if (pathname.includes('.') && !pathname.endsWith('/')) file = join(DIST, pathname.replace(/^\/+/, ''));
      try {
        if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      } catch {
        file = join(ROOT, pathname.replace(/^\/+/, ''));
      }
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

async function launchBrowser() {
  const explicit = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const repoImage = '/opt/pw-browsers/chromium';
  if (explicit && existsSync(explicit)) return chromium.launch({ executablePath: explicit });
  if (existsSync(repoImage)) return chromium.launch({ executablePath: repoImage });
  return chromium.launch();
}

const registry = buildPublicSurfaceRegistry();
if (registry.errors.length) {
  registry.errors.forEach((error) => console.error(`REGISTRY ERROR ${error}`));
  process.exit(1);
}
const entries = registry.entries.filter((entry) =>
  PUBLIC_STATUS.has(entry.status) && !entry.route.startsWith('/dev/') && !entry.route.includes('/_app/')
);
const results = [];
function record(entry, viewport, contract, ok, detail = '') {
  results.push({ route: entry.route, surface: entry.surface, seriesShape: entry.seriesShape, viewport: viewport.id, contract, ok: Boolean(ok), detail: String(detail || '') });
}

async function clickVisible(page, selectors) {
  for (const selector of selectors.split(',')) {
    const locator = page.locator(selector.trim()).first();
    if (await locator.count() && await locator.isVisible().catch(() => false)) {
      await locator.click({ timeout: 4000 });
      return selector.trim();
    }
  }
  return null;
}

async function inspectBase(page, entry, viewport, base) {
  const pageErrors = [];
  const badAssets = [];
  page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 240)));
  page.on('response', (response) => {
    const request = response.request();
    if (!response.url().startsWith(base)) return;
    if (response.status() < 400) return;
    if (!['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(request.resourceType())) return;
    badAssets.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    if (!url.startsWith(base) && !url.startsWith('data:') && !url.startsWith('blob:')) return route.abort();
    if (['image', 'media', 'font'].includes(request.resourceType())) return route.abort();
    return route.continue();
  });

  const response = await page.goto(base + entry.route, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(300);
  record(entry, viewport, 'document:status', response?.status() === 200, response?.status() ?? 'no response');

  const baseFacts = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const duplicateInteractiveIds = [];
    const grouped = new Map();
    document.querySelectorAll('[id]').forEach((node) => {
      if (node.closest('svg defs')) return;
      const id = node.id;
      if (!id) return;
      if (!grouped.has(id)) grouped.set(id, []);
      grouped.get(id).push(node);
    });
    for (const [id, nodes] of grouped) {
      if (nodes.length < 2) continue;
      const referenced = document.querySelector(`[aria-controls~="${CSS.escape(id)}"], [aria-labelledby~="${CSS.escape(id)}"], label[for="${CSS.escape(id)}"]`);
      const interactive = nodes.some((node) => node.matches('button,a,input,select,textarea,[role="button"],[role="dialog"]'));
      if (referenced || interactive) duplicateInteractiveIds.push(`${id}×${nodes.length}`);
    }
    const brokenControls = [...document.querySelectorAll('[aria-controls]')]
      .filter((node) => {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        return node.getAttribute('aria-controls').split(/\s+/).some((id) => id && !document.getElementById(id));
      })
      .map((node) => `${node.tagName.toLowerCase()}#${node.id || '-'}→${node.getAttribute('aria-controls')}`)
      .slice(0, 8);
    const canonical = document.querySelector('link[rel="canonical"]')?.href || '';
    const h1Visible = [...document.querySelectorAll('h1')].some((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    });
    return {
      overflow: Math.max(html.scrollWidth, body?.scrollWidth || 0) - innerWidth,
      duplicateInteractiveIds,
      brokenControls,
      canonical,
      h1Visible,
      title: document.title,
    };
  });
  record(entry, viewport, 'runtime:pageerror', pageErrors.length === 0, pageErrors.join(' | '));
  record(entry, viewport, 'assets:same-origin', badAssets.length === 0, badAssets.join(' | '));
  record(entry, viewport, 'layout:no-horizontal-overflow', baseFacts.overflow <= 8, `${baseFacts.overflow}px`);
  record(entry, viewport, 'a11y:no-duplicate-interactive-id', baseFacts.duplicateInteractiveIds.length === 0, baseFacts.duplicateInteractiveIds.join(', '));
  record(entry, viewport, 'a11y:aria-controls-targets', baseFacts.brokenControls.length === 0, baseFacts.brokenControls.join(', '));
  record(entry, viewport, 'document:title', baseFacts.title.trim().length >= 4, baseFacts.title);
  record(entry, viewport, 'document:h1', baseFacts.h1Visible || entry.surface === 'special', baseFacts.h1Visible ? '' : 'no visible h1');
  record(entry, viewport, 'document:canonical', baseFacts.canonical === `https://gospod-bog.ru${entry.route}`, baseFacts.canonical);
}

async function inspectSurface(page, entry, viewport) {
  const facts = await page.evaluate(() => ({
    gillRoot: !!document.querySelector('[data-gill-v16]'),
    seriesRail: !!document.querySelector('.gbs-rail'),
    articleRail: !!document.querySelector('.hrail'),
    mobileTop: !!document.querySelector('.mobile-top-bar'),
    mobileBottom: !!document.querySelector('.mobile-bottom-bar'),
    bookRows: document.querySelectorAll('#partTocOverlay .gbat-art').length,
  }));

  if (entry.surface === 'series') {
    if (entry.facts.importsSeriesFacade) {
      record(entry, viewport, 'series:canonical-root', facts.gillRoot, JSON.stringify(facts));
      record(entry, viewport, viewport.mobile ? 'series:mobile-bars' : 'series:desktop-rail', viewport.mobile ? facts.mobileTop && facts.mobileBottom : facts.seriesRail, JSON.stringify(facts));
      await inspectSeriesSettings(page, entry, viewport);
      if (viewport.id === 'mobile-390') await inspectSeriesToc(page, entry, viewport);
    } else {
      record(entry, viewport, 'series:route-native-no-facade-leak', !facts.seriesRail || facts.gillRoot, JSON.stringify(facts));
    }
  } else {
    record(entry, viewport, 'surface:no-series-facade-leak', !facts.gillRoot && !facts.seriesRail, JSON.stringify(facts));
  }

  if (entry.surface === 'article') {
    record(entry, viewport, 'article:reader-rail', viewport.mobile || facts.articleRail, JSON.stringify(facts));
  }
  if (entry.surface === 'page' || entry.surface === 'special') {
    record(entry, viewport, 'surface:no-article-rail-leak', !facts.articleRail, JSON.stringify(facts));
  }
  if (entry.surface === 'series' && entry.seriesShape === 'flat') {
    record(entry, viewport, 'series:flat-no-book-article-rows', facts.bookRows === 0, `${facts.bookRows}`);
  }
}

async function inspectSeriesSettings(page, entry, viewport) {
  const trigger = await clickVisible(page, viewport.mobile ? '#mobSettingsBtn' : '#railSettingsBtn');
  record(entry, viewport, 'settings:trigger', Boolean(trigger), trigger || 'missing/covered');
  if (!trigger) return;
  await page.waitForTimeout(250);
  const state = await page.evaluate(() => {
    const overlay = document.getElementById('gillSettingsOverlay');
    const sheet = overlay?.querySelector('[class*="sheet"]');
    if (!overlay || !sheet) return null;
    const rect = sheet.getBoundingClientRect();
    const relaxed = overlay.querySelector('[data-line="relaxed"]');
    const rr = relaxed?.getBoundingClientRect();
    const line = relaxed ? parseFloat(getComputedStyle(relaxed).lineHeight) : 0;
    return {
      open: overlay.classList.contains('is-open') && overlay.getAttribute('aria-hidden') === 'false',
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
      viewport: { width: innerWidth, height: innerHeight },
      relaxed: relaxed ? { scrollHeight: relaxed.scrollHeight, height: rr?.height || 0, lineHeight: line, whiteSpace: getComputedStyle(relaxed).whiteSpace } : null,
    };
  });
  record(entry, viewport, 'settings:opens', Boolean(state?.open), JSON.stringify(state));
  const inViewport = state && state.rect.left >= -2 && state.rect.top >= -2 && state.rect.right <= state.viewport.width + 2 && state.rect.bottom <= state.viewport.height + 2;
  record(entry, viewport, 'settings:inside-viewport', Boolean(inViewport), JSON.stringify(state?.rect || null));
  if (viewport.id === 'mobile-320' && state?.relaxed) {
    const oneLine = state.relaxed.whiteSpace === 'nowrap' || state.relaxed.scrollHeight <= Math.max(state.relaxed.height + 2, state.relaxed.lineHeight * 1.55);
    record(entry, viewport, 'settings:320-labels-one-line', oneLine, JSON.stringify(state.relaxed));
  }
  const sepia = page.locator('#gillSettingsOverlay [data-theme="sepia"]').first();
  if (await sepia.count() && await sepia.isVisible().catch(() => false)) {
    await sepia.click();
    await page.waitForTimeout(100);
    const applied = await page.evaluate(() => document.querySelector('[data-gill-v16]')?.getAttribute('data-gill-reader-theme'));
    record(entry, viewport, 'settings:sepia-scoped', applied === 'sepia', applied || '<missing>');
  } else {
    record(entry, viewport, 'settings:sepia-scoped', false, 'sepia control missing');
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const closed = await page.evaluate(() => {
    const overlay = document.getElementById('gillSettingsOverlay');
    return !overlay?.classList.contains('is-open') && overlay?.getAttribute('aria-hidden') !== 'false';
  });
  record(entry, viewport, 'settings:escape-closes', closed);
}

async function inspectSeriesToc(page, entry, viewport) {
  const trigger = await clickVisible(page, '#mobPartTocBtn,[data-mobile-action="part-toc"],[data-gbs-part-toc]');
  record(entry, viewport, 'toc:trigger', Boolean(trigger), trigger || 'missing/covered');
  if (!trigger) return;
  await page.waitForTimeout(250);
  const toc = await page.evaluate(() => {
    const overlay = document.getElementById('partTocOverlay');
    const sheet = overlay?.querySelector('.toc-sheet');
    if (!overlay || !sheet) return null;
    const or = overlay.getBoundingClientRect();
    const sr = sheet.getBoundingClientRect();
    const z = Number.parseInt(getComputedStyle(overlay).zIndex, 10) || 0;
    const article = document.querySelector('main,article,.page-wrap');
    const az = article ? (Number.parseInt(getComputedStyle(article).zIndex, 10) || 0) : 0;
    return {
      open: overlay.classList.contains('is-open') && overlay.getAttribute('aria-hidden') === 'false',
      overlay: { left: or.left, top: or.top, width: or.width, height: or.height, right: or.right, bottom: or.bottom },
      sheet: { left: sr.left, top: sr.top, right: sr.right, bottom: sr.bottom },
      viewport: { width: innerWidth, height: innerHeight },
      parts: overlay.querySelectorAll('.gbat-part').length,
      current: overlay.querySelectorAll('.gbat-part.cur.open').length,
      bookRows: overlay.querySelectorAll('.gbat-art').length,
      trapped: Boolean(overlay.closest('.page-wrap,main,article,[data-scroll-container]')),
      z, az,
    };
  });
  record(entry, viewport, 'toc:opens', Boolean(toc?.open), JSON.stringify(toc));
  const covers = toc && toc.overlay.left <= 2 && toc.overlay.top <= 2 && toc.overlay.right >= toc.viewport.width - 2 && toc.overlay.bottom >= toc.viewport.height - 2;
  record(entry, viewport, 'toc:viewport-cover', Boolean(covers), JSON.stringify(toc?.overlay || null));
  record(entry, viewport, 'toc:not-trapped-in-article-scroll', Boolean(toc && !toc.trapped), JSON.stringify(toc));
  record(entry, viewport, 'toc:parts-and-current', Boolean(toc && toc.parts > 0 && toc.current === 1), JSON.stringify(toc));
  if (entry.seriesShape === 'book') {
    record(entry, viewport, 'toc:book-has-article-tier', Boolean(toc && toc.bookRows > 0), JSON.stringify(toc));
  } else {
    record(entry, viewport, 'toc:flat-no-book-tier', Boolean(toc && toc.bookRows === 0), JSON.stringify(toc));
  }
  await page.keyboard.press('Escape');
}

async function runCase(browser, base, entry, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
    locale: 'ru-RU',
  });
  const page = await context.newPage();
  try {
    await inspectBase(page, entry, viewport, base);
    await inspectSurface(page, entry, viewport);
  } catch (error) {
    record(entry, viewport, 'matrix:uncaught', false, error?.stack || error);
  } finally {
    await context.close().catch(() => {});
  }
}

async function pool(items, worker) {
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_WORKERS, items.length) }, run));
}

if (!existsSync(DIST)) {
  console.error('dist/ missing; run npm run strangler:build:production-like first');
  process.exit(1);
}

const { server, base } = await serve();
let browser;
try {
  browser = await launchBrowser();
  const cases = entries.flatMap((entry) => VIEWPORTS.map((viewport) => ({ entry, viewport })));
  console.log(`Public browser matrix: ${entries.length} routes × ${VIEWPORTS.length} viewports = ${cases.length} cases; workers=${MAX_WORKERS}`);
  await pool(cases, ({ entry, viewport }) => runCase(browser, base, entry, viewport));
} finally {
  await browser?.close().catch(() => {});
  await new Promise((resolve) => server.close(resolve));
}

results.sort((a, b) => a.route.localeCompare(b.route, 'ru') || a.viewport.localeCompare(b.viewport) || a.contract.localeCompare(b.contract));
const failures = results.filter((item) => !item.ok);
const passed = results.length - failures.length;
const summary = {
  generatedAt: new Date().toISOString(),
  registry: { total: registry.entries.length, publicTested: entries.length, counts: registry.counts, seriesShapes: registry.shapeCounts },
  viewports: VIEWPORTS,
  contracts: results.length,
  passed,
  failed: failures.length,
  failures,
  results,
};
await mkdir(REPORTS, { recursive: true });
await writeFile(join(REPORTS, 'public-surface-browser-matrix.json'), `${JSON.stringify(summary, null, 2)}\n`);
const md = [
  '# Public surface browser matrix', '',
  `- Routes tested: **${entries.length}**`,
  `- Viewports: **${VIEWPORTS.map((item) => item.id).join(', ')}**`,
  `- Contracts: **${passed}/${results.length} PASS**`,
  `- Failures: **${failures.length}**`, '',
  ...(failures.length ? ['## Failures', '', ...failures.map((f) => `- \`${f.route}\` · \`${f.viewport}\` · **${f.contract}** — ${f.detail || 'failed'}`)] : ['✅ Every public route passed its browser surface contracts.']),
  '',
];
await writeFile(join(REPORTS, 'public-surface-browser-matrix.md'), `${md.join('\n')}\n`);
for (const item of failures) console.error(`FAIL [${item.viewport}] ${item.route} ${item.contract} :: ${item.detail}`);
console.log(`PUBLIC SURFACE BROWSER MATRIX: ${passed}/${results.length} PASS (${entries.length} routes)`);
if (failures.length) process.exitCode = 1;
