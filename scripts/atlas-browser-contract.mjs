#!/usr/bin/env node
/** Production-like browser contract for the compiled-data research Atlas. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const COMPILED = join(DIST, 'data', 'relations.compiled.json');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2',
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
      try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); }
      catch { file = join(ROOT, pathname); }
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

function observeDataRequests(page) {
  const requests = [];
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith('/data/')) requests.push(pathname);
  });
  return requests;
}

async function desktopScene(browser, base, compiled) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();
  const errors = [];
  const dataRequests = observeDataRequests(page);
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

    await page.locator('#atlasSearchInput').fill(compiled.nodes.at(-1).title.slice(0, 8));
    await page.waitForSelector('#atlasSearchResults:not([hidden]) [role="option"]');
    await page.locator('#atlasSearchInput').press('ArrowDown');
    await page.locator('#atlasSearchInput').press('Enter');
    await page.waitForFunction(() => Boolean(new URL(location.href).searchParams.get('focus')));
    const searchFocus = new URL(page.url()).searchParams.get('focus');

    await page.locator('[data-atlas-view="list"]').click();
    const state = await page.evaluate(() => {
      const app = document.getElementById('atlasApp');
      const list = document.getElementById('atlasListView');
      return {
        runtimeNodes: Number(app?.dataset.runtimeNodes || 0),
        runtimeEdges: Number(app?.dataset.runtimeEdges || 0),
        runtimeEngine: app?.dataset.runtimeEngine || '',
        listVisible: Boolean(list && !list.hidden && getComputedStyle(list).display !== 'none'),
        listLinks: list?.querySelectorAll('[data-list-node] a[href]').length || 0,
        activeDescendantCleared: !document.getElementById('atlasSearchInput')?.hasAttribute('aria-activedescendant'),
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    const requestContract = dataRequests.length === 1 && dataRequests[0] === '/data/relations.compiled.json';
    record('desktop zoom/focus/search/list/compiled-source',
      Number.isFinite(before) && Number.isFinite(after) && after < before && Boolean(focusParam) && Boolean(searchFocus)
      && state.runtimeNodes === compiled.nodes.length && state.runtimeEdges === compiled.edges.length
      && state.runtimeEngine === compiled.engineVersion && state.listVisible
      && state.listLinks === compiled.nodes.length && state.activeDescendantCleared && state.overflow <= 2
      && requestContract && errors.length === 0,
      JSON.stringify({ before, after, focusParam, searchFocus, ...state, dataRequests, errors }));
  } catch (error) {
    record('desktop zoom/focus/search/list/compiled-source', false, String(error).slice(0, 500));
  } finally { await context.close(); }
}

async function mobileScene(browser, base, compiled) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = [];
  const dataRequests = observeDataRequests(page);
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
    await page.waitForFunction(() => {
      const sheet = document.getElementById('atlasDetail');
      if (!sheet?.classList.contains('is-open')) return false;
      const rect = sheet.getBoundingClientRect();
      const style = getComputedStyle(sheet);
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && rect.width > 0
        && rect.height > 180
        && rect.top < innerHeight
        && rect.bottom <= innerHeight + 2;
    }, null, { timeout: 8_000 });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const state = await page.evaluate(() => {
      const target = (selector) => {
        const rect = document.querySelector(selector)?.getBoundingClientRect();
        return rect ? { width: rect.width, height: rect.height } : null;
      };
      const sheet = document.getElementById('atlasDetail')?.getBoundingClientRect();
      return {
        zoomIn: target('#atlasZoomIn'), zoomOut: target('#atlasZoomOut'),
        center: target('#atlasCenter'), filter: target('#atlasFilterTrigger'),
        close: target('#atlasDetailClose'), filterClose: target('#atlasFilterClose'),
        sheet: sheet ? { top: sheet.top, bottom: sheet.bottom, width: sheet.width, height: sheet.height } : null,
        sheetVisible: Boolean(sheet && sheet.width > 0 && sheet.height > 180 && sheet.top < innerHeight && sheet.bottom <= innerHeight + 2),
        runtimeNodes: Number(document.getElementById('atlasApp')?.dataset.runtimeNodes || 0),
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    const targetsOk = [state.zoomIn, state.zoomOut, state.center, state.filter, state.close, state.filterClose]
      .every((target) => target && target.width >= 44 && target.height >= 44);
    record('mobile 44px controls/filter/focus sheet',
      targetsOk && state.sheetVisible && state.runtimeNodes === compiled.nodes.length
      && dataRequests.length === 1 && dataRequests[0] === '/data/relations.compiled.json'
      && state.overflow <= 2 && errors.length === 0,
      JSON.stringify({ ...state, dataRequests, errors }));
  } catch (error) {
    record('mobile 44px controls/filter/focus sheet', false, String(error).slice(0, 500));
  } finally { await context.close(); }
}

async function noJsScene(browser, base, compiled) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  const page = await context.newPage();
  const dataRequests = observeDataRequests(page);
  try {
    await page.goto(`${base}/map/`, { waitUntil: 'load', timeout: 30_000 });
    const state = await page.evaluate(() => {
      const app = document.getElementById('atlasApp');
      const list = document.getElementById('atlasNoScriptList');
      const firstLink = list?.querySelector('[data-list-node] a[href]');
      const rect = firstLink?.getBoundingClientRect();
      return {
        appHidden: Boolean(app && getComputedStyle(app).display === 'none'),
        listVisible: Boolean(list && getComputedStyle(list).display !== 'none' && list.getBoundingClientRect().height > 300),
        links: list?.querySelectorAll('[data-list-node] a[href]').length || 0,
        firstLink: rect ? { width: rect.width, height: rect.height } : null,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    record('no-JS compiler-backed list fallback',
      state.appHidden && state.listVisible && state.links === compiled.nodes.length
      && state.firstLink && state.firstLink.width > 180 && state.firstLink.height >= 44
      && state.overflow <= 2 && dataRequests.length === 0,
      JSON.stringify({ ...state, dataRequests }));
  } catch (error) {
    record('no-JS compiler-backed list fallback', false, String(error).slice(0, 500));
  } finally { await context.close(); }
}

async function assertRecoveryScene(page, compiled, scene) {
  await page.waitForSelector('#atlasApp[data-runtime-error="1"][data-view="list"]', { timeout: 15_000 });
  const state = await page.evaluate(() => {
    const graph = document.getElementById('atlasGraphView');
    const list = document.getElementById('atlasListView');
    const disabled = ['#atlasZoomIn', '#atlasZoomOut', '#atlasCenter', '[data-atlas-view="graph"]']
      .every((selector) => document.querySelector(selector)?.getAttribute('aria-disabled') === 'true');
    return {
      runtimeReady: document.getElementById('atlasApp')?.dataset.runtimeReady || '',
      graphHidden: Boolean(graph && (graph.hidden || getComputedStyle(graph).display === 'none')),
      listVisible: Boolean(list && !list.hidden && getComputedStyle(list).display !== 'none' && list.getBoundingClientRect().height > 300),
      links: list?.querySelectorAll('[data-list-node] a[href]').length || 0,
      disabled,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  record(scene,
    !state.runtimeReady && state.graphHidden && state.listVisible && state.links === compiled.nodes.length
    && state.disabled && state.overflow <= 2,
    JSON.stringify(state));
}

async function dataFailureScene(browser, base, compiled) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route('**/data/relations.compiled.json', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"forced compiled relation failure"}' }));
  try {
    await page.goto(`${base}/map/`, { waitUntil: 'networkidle', timeout: 30_000 });
    await assertRecoveryScene(page, compiled, 'HTTP failure recovers to complete SSR list');
  } catch (error) {
    record('HTTP failure recovers to complete SSR list', false, String(error).slice(0, 500));
  } finally { await context.close(); }
}

async function corruptPayloadScene(browser, base, compiled) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const corrupted = structuredClone(compiled);
  corrupted.stats.edges = corrupted.edges.length + 1;
  corrupted.edges[0] = { ...corrupted.edges[0], target: 'missing-node' };
  await page.route('**/data/relations.compiled.json', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(corrupted),
  }));
  try {
    await page.goto(`${base}/map/`, { waitUntil: 'networkidle', timeout: 30_000 });
    await assertRecoveryScene(page, compiled, 'corrupt payload is rejected without partial graph');
  } catch (error) {
    record('corrupt payload is rejected without partial graph', false, String(error).slice(0, 500));
  } finally { await context.close(); }
}

if (!existsSync(DIST) || !existsSync(COMPILED)) {
  console.error('❌ production-like dist or compiled relation endpoint missing');
  process.exit(1);
}
const compiled = JSON.parse(await readFile(COMPILED, 'utf8'));
if (Number(compiled.schemaVersion) !== 1 || !Array.isArray(compiled.nodes) || !Array.isArray(compiled.edges)) {
  console.error('❌ invalid compiled relation endpoint');
  process.exit(1);
}

const { server, base } = await serve();
let browser;
try {
  const pinned = process.env.GB_PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  browser = await chromium.launch(existsSync(pinned) ? { executablePath: pinned } : {});
  await desktopScene(browser, base, compiled);
  await mobileScene(browser, base, compiled);
  await noJsScene(browser, base, compiled);
  await dataFailureScene(browser, base, compiled);
  await corruptPayloadScene(browser, base, compiled);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}

const failures = results.filter((result) => !result.ok);
console.log(`\nCompiled Atlas browser contract: ${results.length - failures.length}/${results.length} passed`);
if (failures.length) process.exit(1);
