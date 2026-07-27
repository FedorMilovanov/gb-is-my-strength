#!/usr/bin/env node
/**
 * Production-like browser contract for native map surfaces.
 *
 * Biblical map routes prove normal rendering plus route/engine/no-JS recovery.
 * The research Atlas additionally proves semantic zoom, focus deep links,
 * list parity, mobile controls and graph-data failure recovery.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};
const ROUTES = [
  { slug: 'ishod', title: 'Исход', textFallback: false },
  { slug: 'avraam', title: 'Авраам', textFallback: true },
];
const results = [];

function record(route, scene, ok, detail = '') {
  results.push({ route, scene, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${route} · ${scene}${detail ? ` — ${detail}` : ''}`);
}

async function serve() {
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(String(req.url || '/').split('?')[0]);
      let file = join(DIST, pathname);
      try {
        if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      } catch {
        file = join(ROOT, pathname);
      }
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

async function geometry(page) {
  return page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - innerWidth,
    stageState: document.querySelector('[data-map-stage]')?.getAttribute('data-map-state') || '',
    stageBusy: document.querySelector('[data-map-stage]')?.getAttribute('aria-busy') || '',
    canvas: Boolean(document.querySelector('.me-canvas')),
  }));
}

async function normalScene(browser, base, route) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  try {
    await page.goto(`${base}/karty/${route.slug}/`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForSelector('[data-map-stage][data-map-state="ready"]', { timeout: 20_000 });
    const state = await geometry(page);
    record(route.slug, 'normal render',
      state.canvas && state.stageState === 'ready' && state.stageBusy === 'false' && state.overflow <= 2 && pageErrors.length === 0,
      JSON.stringify({ ...state, pageErrors }));
  } catch (error) {
    record(route.slug, 'normal render', false, String(error).slice(0, 240));
  } finally {
    await context.close();
  }
}

async function noJsScene(browser, base, route) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  try {
    await page.goto(`${base}/karty/${route.slug}/`, { waitUntil: 'load', timeout: 30_000 });
    const state = await page.evaluate((needsText) => {
      const stage = document.querySelector('[data-map-stage]');
      const card = document.querySelector('.map-runtime-noscript');
      const text = document.querySelector('.map-text-fallback');
      const stageStyle = stage ? getComputedStyle(stage) : null;
      const cardRect = card?.getBoundingClientRect();
      const textRect = text?.getBoundingClientRect();
      const linkRect = card?.querySelector('a')?.getBoundingClientRect();
      return {
        stageHidden: Boolean(stageStyle && stageStyle.display === 'none'),
        cardVisible: Boolean(cardRect && cardRect.width > 0 && cardRect.height > 0),
        linkTarget: linkRect ? { width: linkRect.width, height: linkRect.height } : null,
        textVisible: !needsText || Boolean(textRect && textRect.width > 0 && textRect.height > 200 && getComputedStyle(text).position === 'static'),
        textLength: text?.textContent?.trim().length || 0,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    }, route.textFallback);
    const targetOk = state.linkTarget && state.linkTarget.width >= 44 && state.linkTarget.height >= 44;
    record(route.slug, 'no-JS readable fallback',
      state.stageHidden && state.cardVisible && targetOk && state.textVisible && state.overflow <= 2,
      JSON.stringify(state));
  } catch (error) {
    record(route.slug, 'no-JS readable fallback', false, String(error).slice(0, 240));
  } finally {
    await context.close();
  }
}

async function failureScene(browser, base, route, kind) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  if (kind === 'route') {
    await page.route(`**/karty/${route.slug}/route.json`, (request) => request.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"error":"forced route failure"}',
    }));
  } else {
    await page.route('**/karty/_engine/map-engine.js', (request) => request.abort('failed'));
  }

  try {
    await page.goto(`${base}/karty/${route.slug}/`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForSelector('[data-map-stage][data-map-state="error"] .me-error[role="alert"]', { timeout: 15_000 });
    const state = await page.evaluate(() => {
      const stage = document.querySelector('[data-map-stage]');
      const alert = stage?.querySelector('.me-error[role="alert"]');
      const retry = alert?.querySelector('.me-error__retry');
      const back = alert?.querySelector('.me-error__back');
      const alertRect = alert?.getBoundingClientRect();
      const retryRect = retry?.getBoundingClientRect();
      const backRect = back?.getBoundingClientRect();
      return {
        state: stage?.getAttribute('data-map-state'),
        busy: stage?.getAttribute('aria-busy'),
        alertVisible: Boolean(alertRect && alertRect.width > 0 && alertRect.height > 0),
        retry: retryRect ? { width: retryRect.width, height: retryRect.height } : null,
        back: backRect ? { width: backRect.width, height: backRect.height, href: back?.getAttribute('href') } : null,
        canvas: Boolean(stage?.querySelector('.me-canvas')),
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    const retryOk = state.retry && state.retry.width >= 44 && state.retry.height >= 44;
    const backOk = state.back && state.back.width >= 44 && state.back.height >= 44 && state.back.href === '/karty/';
    record(route.slug, kind === 'route' ? 'route.json failure recovery' : 'engine asset failure recovery',
      state.state === 'error' && state.busy === 'false' && state.alertVisible && retryOk && backOk && !state.canvas && state.overflow <= 2 && pageErrors.length === 0,
      JSON.stringify({ ...state, pageErrors }));
  } catch (error) {
    record(route.slug, kind === 'route' ? 'route.json failure recovery' : 'engine asset failure recovery', false, String(error).slice(0, 240));
  } finally {
    await context.close();
  }
}

function viewBoxWidth(value) {
  const parts = String(value || '').trim().split(/\s+/).map(Number);
  return parts.length === 4 && parts.every(Number.isFinite) ? parts[2] : NaN;
}

async function atlasDesktopScene(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.goto(`${base}/map/`, { waitUntil: 'networkidle', timeout: 40_000 });
    await page.waitForSelector('#atlasApp[data-runtime-ready="1"]', { timeout: 20_000 });

    const before = viewBoxWidth(await page.locator('#atlasCanvas').getAttribute('viewBox'));
    await page.locator('#atlasZoomIn').click();
    await page.waitForTimeout(450);
    const after = viewBoxWidth(await page.locator('#atlasCanvas').getAttribute('viewBox'));

    await page.locator('.atlas-node:not(.is-filtered-out)').first().click();
    await page.waitForSelector('#atlasDetail.is-open .atlas-detail__content:not([hidden])', { timeout: 10_000 });
    const focusParam = new URL(page.url()).searchParams.get('focus');

    await page.locator('[data-atlas-view="list"]').click();
    const state = await page.evaluate(() => {
      const app = document.getElementById('atlasApp');
      const list = document.getElementById('atlasListView');
      return {
        runtimeNodes: Number(app?.dataset.runtimeNodes || 0),
        runtimeEdges: Number(app?.dataset.runtimeEdges || 0),
        listVisible: Boolean(list && !list.hidden && getComputedStyle(list).display !== 'none'),
        listLinks: list?.querySelectorAll('[data-list-node] a[href]').length || 0,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });

    record('atlas', 'desktop zoom/focus/list',
      Number.isFinite(before) && Number.isFinite(after) && after < before && Boolean(focusParam) &&
      state.runtimeNodes >= 28 && state.runtimeEdges >= 20 && state.listVisible &&
      state.listLinks >= 28 && state.overflow <= 2 && errors.length === 0,
      JSON.stringify({ before, after, focusParam, ...state, errors }));
  } catch (error) {
    record('atlas', 'desktop zoom/focus/list', false, String(error).slice(0, 350));
  } finally {
    await context.close();
  }
}

async function atlasMobileScene(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.goto(`${base}/map/`, { waitUntil: 'networkidle', timeout: 40_000 });
    await page.waitForSelector('#atlasApp[data-runtime-ready="1"]', { timeout: 20_000 });
    await page.locator('#atlasFilterTrigger').click();
    await page.waitForSelector('#atlasSidebar.is-open');
    await page.locator('#atlasFilterClose').click();
    await page.locator('.atlas-node:not(.is-filtered-out)').first().tap();
    await page.waitForSelector('#atlasDetail.is-open');

    const state = await page.evaluate(() => {
      const target = (selector) => {
        const rect = document.querySelector(selector)?.getBoundingClientRect();
        return rect ? { width: rect.width, height: rect.height } : null;
      };
      const sheet = document.getElementById('atlasDetail')?.getBoundingClientRect();
      return {
        zoomIn: target('#atlasZoomIn'),
        zoomOut: target('#atlasZoomOut'),
        center: target('#atlasCenter'),
        filter: target('#atlasFilterTrigger'),
        sheetVisible: Boolean(sheet && sheet.width > 0 && sheet.height > 180 && sheet.bottom <= innerHeight + 2),
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    const targetsOk = [state.zoomIn, state.zoomOut, state.center, state.filter]
      .every((target) => target && target.width >= 38 && target.height >= 38);
    record('atlas', 'mobile controls/filter/focus sheet',
      targetsOk && state.sheetVisible && state.overflow <= 2 && errors.length === 0,
      JSON.stringify({ ...state, errors }));
  } catch (error) {
    record('atlas', 'mobile controls/filter/focus sheet', false, String(error).slice(0, 350));
  } finally {
    await context.close();
  }
}

async function atlasNoJsScene(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto(`${base}/map/`, { waitUntil: 'load', timeout: 30_000 });
    const state = await page.evaluate(() => {
      const graph = document.getElementById('atlasGraphView');
      const list = document.getElementById('atlasListView');
      const firstLink = list?.querySelector('[data-list-node] a[href]');
      const rect = firstLink?.getBoundingClientRect();
      return {
        graphHidden: Boolean(graph && getComputedStyle(graph).display === 'none'),
        listVisible: Boolean(list && getComputedStyle(list).display !== 'none' && list.getBoundingClientRect().height > 300),
        links: list?.querySelectorAll('[data-list-node] a[href]').length || 0,
        firstLink: rect ? { width: rect.width, height: rect.height } : null,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    record('atlas', 'no-JS list fallback',
      state.graphHidden && state.listVisible && state.links >= 28 && state.firstLink &&
      state.firstLink.width > 180 && state.firstLink.height >= 44 && state.overflow <= 2,
      JSON.stringify(state));
  } catch (error) {
    record('atlas', 'no-JS list fallback', false, String(error).slice(0, 350));
  } finally {
    await context.close();
  }
}

async function atlasFailureScene(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route('**/data/links-graph.json', (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: '{"error":"forced graph failure"}',
  }));
  try {
    await page.goto(`${base}/map/`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForSelector('#atlasApp[data-runtime-error="1"]', { timeout: 15_000 });
    const state = await page.evaluate(() => {
      const graph = document.getElementById('atlasGraphView');
      const list = document.getElementById('atlasListView');
      return {
        graphHidden: Boolean(graph && getComputedStyle(graph).display === 'none'),
        listVisible: Boolean(list && getComputedStyle(list).display !== 'none' && list.getBoundingClientRect().height > 300),
        links: list?.querySelectorAll('[data-list-node] a[href]').length || 0,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    record('atlas', 'graph-data failure recovery',
      state.graphHidden && state.listVisible && state.links >= 28 && state.overflow <= 2,
      JSON.stringify(state));
  } catch (error) {
    record('atlas', 'graph-data failure recovery', false, String(error).slice(0, 350));
  } finally {
    await context.close();
  }
}

if (!existsSync(DIST)) {
  console.error('❌ dist/ missing; build production-like output before map browser test');
  process.exit(1);
}

const { server, base } = await serve();
let browser;
try {
  const pinned = process.env.GB_PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  browser = await chromium.launch(existsSync(pinned) ? { executablePath: pinned } : {});
  for (const route of ROUTES) {
    await normalScene(browser, base, route);
    await noJsScene(browser, base, route);
    await failureScene(browser, base, route, 'route');
    await failureScene(browser, base, route, 'engine');
  }
  await atlasDesktopScene(browser, base);
  await atlasMobileScene(browser, base);
  await atlasNoJsScene(browser, base);
  await atlasFailureScene(browser, base);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}

const failures = results.filter((result) => !result.ok);
console.log(`\nNative map browser contract: ${results.length - failures.length}/${results.length} passed`);
if (failures.length) process.exit(1);
