#!/usr/bin/env node
/**
 * Production-like browser contract for /map/ — «Атлас исследований».
 *
 * Proves:
 *   1. desktop runtime, semantic zoom, focus URL and list parity;
 *   2. mobile controls, filter drawer, touch-safe geometry and focus sheet;
 *   3. no-JS server-rendered list fallback;
 *   4. graph-data failure recovery to the same accessible list.
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
const results = [];

function record(scene, ok, detail = '') {
  results.push({ scene, ok, detail });
  console.log(`${ok ? '✅' : '❌'} Atlas · ${scene}${detail ? ` — ${detail}` : ''}`);
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

function viewBoxWidth(value) {
  const parts = String(value || '').trim().split(/\s+/).map(Number);
  return parts.length === 4 && parts.every(Number.isFinite) ? parts[2] : NaN;
}

async function desktopScene(browser, base) {
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

    const firstNode = page.locator('.atlas-node:not(.is-filtered-out)').first();
    await firstNode.click();
    await page.waitForSelector('#atlasDetail.is-open .atlas-detail__content:not([hidden])', { timeout: 10_000 });
    const focusParam = new URL(page.url()).searchParams.get('focus');

    await page.locator('[data-atlas-view="list"]').click();
    const state = await page.evaluate(() => {
      const app = document.getElementById('atlasApp');
      const list = document.getElementById('atlasListView');
      const detail = document.getElementById('atlasDetail');
      return {
        runtimeNodes: Number(app?.dataset.runtimeNodes || 0),
        runtimeEdges: Number(app?.dataset.runtimeEdges || 0),
        listVisible: Boolean(list && !list.hidden && getComputedStyle(list).display !== 'none'),
        listLinks: list?.querySelectorAll('[data-list-node] a[href]').length || 0,
        detailOpen: detail?.classList.contains('is-open') || false,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });

    record('desktop zoom/focus/list',
      Number.isFinite(before) && Number.isFinite(after) && after < before &&
      Boolean(focusParam) && state.runtimeNodes >= 28 && state.runtimeEdges >= 20 &&
      state.listVisible && state.listLinks >= 28 && state.overflow <= 2 && errors.length === 0,
      JSON.stringify({ before, after, focusParam, ...state, errors }));
  } catch (error) {
    record('desktop zoom/focus/list', false, String(error).slice(0, 350));
  } finally {
    await context.close();
  }
}

async function mobileScene(browser, base) {
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
    const targets = [state.zoomIn, state.zoomOut, state.center, state.filter];
    const targetsOk = targets.every((target) => target && target.width >= 38 && target.height >= 38);
    record('mobile controls/filter/focus sheet',
      targetsOk && state.sheetVisible && state.overflow <= 2 && errors.length === 0,
      JSON.stringify({ ...state, errors }));
  } catch (error) {
    record('mobile controls/filter/focus sheet', false, String(error).slice(0, 350));
  } finally {
    await context.close();
  }
}

async function noJsScene(browser, base) {
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
    record('no-JS list fallback',
      state.graphHidden && state.listVisible && state.links >= 28 &&
      state.firstLink && state.firstLink.width > 180 && state.firstLink.height >= 44 && state.overflow <= 2,
      JSON.stringify(state));
  } catch (error) {
    record('no-JS list fallback', false, String(error).slice(0, 350));
  } finally {
    await context.close();
  }
}

async function dataFailureScene(browser, base) {
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
    record('graph-data failure recovery',
      state.graphHidden && state.listVisible && state.links >= 28 && state.overflow <= 2,
      JSON.stringify(state));
  } catch (error) {
    record('graph-data failure recovery', false, String(error).slice(0, 350));
  } finally {
    await context.close();
  }
}

if (!existsSync(DIST)) {
  console.error('❌ dist/ missing; build production-like output before Atlas browser contract');
  process.exit(1);
}

const { server, base } = await serve();
let browser;
try {
  const pinned = process.env.GB_PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  browser = await chromium.launch(existsSync(pinned) ? { executablePath: pinned } : {});
  await desktopScene(browser, base);
  await mobileScene(browser, base);
  await noJsScene(browser, base);
  await dataFailureScene(browser, base);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}

const failures = results.filter((result) => !result.ok);
console.log(`\nAtlas browser contract: ${results.length - failures.length}/${results.length} passed`);
if (failures.length) process.exit(1);
