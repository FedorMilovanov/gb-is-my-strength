#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const ROOT = path.resolve(process.cwd());
const DIST = path.join(ROOT, 'dist');
const REPORT_DIR = path.join(ROOT, 'reports', 'atlas-focus-state');
const ROUTE = '/map/';
const BROWSERS = { chromium, webkit };
const WIDTHS = [390, 680, 681, 980, 981, 1440];
const HEIGHT = 900;

function contentType(file) {
  return {
    '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2',
  }[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function resolveRequest(value) {
  const url = new URL(value || '/', 'http://127.0.0.1');
  const pathname = decodeURIComponent(url.pathname);
  const relative = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  const candidate = path.resolve(DIST, `.${relative}`);
  assert.ok(candidate === DIST || candidate.startsWith(`${DIST}${path.sep}`), 'request escaped dist root');
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  const index = path.join(candidate, 'index.html');
  return fs.existsSync(index) && fs.statSync(index).isFile() ? index : null;
}

async function startServer() {
  assert.ok(resolveRequest(ROUTE), `built route missing: ${ROUTE}`);
  const server = http.createServer((request, response) => {
    try {
      const file = resolveRequest(request.url);
      response.setHeader('Cache-Control', 'no-store');
      if (!file) { response.statusCode = 404; response.end('Not found'); return; }
      response.setHeader('Content-Type', contentType(file));
      fs.createReadStream(file).pipe(response);
    } catch (error) {
      response.statusCode = 400;
      response.end(String(error?.message || error));
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

async function activeState(page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    return {
      tag: active?.tagName || '',
      id: active?.id || '',
      className: active?.className?.baseVal || active?.className || '',
      nodeId: active?.dataset?.nodeId || '',
      insideHidden: Boolean(active?.closest?.('[hidden],[inert],[aria-hidden="true"]')),
      rendered: active instanceof Element ? active.getClientRects().length > 0 : false,
    };
  });
}

async function assertSafeFocus(page, label, predicate) {
  const state = await activeState(page);
  assert.notEqual(state.tag, 'BODY', `${label}: focus fell to BODY`);
  assert.notEqual(state.tag, 'HTML', `${label}: focus fell to HTML`);
  assert.equal(state.insideHidden, false, `${label}: active element is inside hidden/inert surface: ${JSON.stringify(state)}`);
  assert.equal(state.rendered, true, `${label}: active element has no rendered geometry: ${JSON.stringify(state)}`);
  if (predicate) assert.ok(predicate(state), `${label}: unexpected focus destination: ${JSON.stringify(state)}`);
  return state;
}

async function activateFirstNode(page) {
  const node = page.locator('.atlas-node:not(.is-filtered-out)[tabindex="0"]').first();
  await node.waitFor({ state: 'visible' });
  await node.focus();
  await page.keyboard.press('Enter');
  await page.locator('#atlasDetail.is-open').waitFor({ state: 'visible' });
  return node;
}

async function assertClosedSurfaceState(page, compact) {
  const state = await page.evaluate(() => ({
    sidebarInert: document.getElementById('atlasSidebar')?.hasAttribute('inert'),
    sidebarAria: document.getElementById('atlasSidebar')?.getAttribute('aria-hidden'),
    detailInert: document.getElementById('atlasDetail')?.hasAttribute('inert'),
    detailAria: document.getElementById('atlasDetail')?.getAttribute('aria-hidden'),
    filterVisible: document.getElementById('atlasFilterTrigger')?.getClientRects().length > 0,
  }));
  assert.equal(state.detailInert, true, 'closed detail must be inert');
  assert.equal(state.detailAria, 'true', 'closed detail must be aria-hidden');
  if (compact) {
    assert.equal(state.sidebarInert, true, 'closed compact drawer must be inert');
    assert.equal(state.sidebarAria, 'true', 'closed compact drawer must be aria-hidden');
    assert.equal(state.filterVisible, true, 'compact filter trigger must be visible');
  } else {
    assert.equal(state.sidebarInert, false, 'desktop sidebar must remain interactive');
    assert.notEqual(state.sidebarAria, 'true', 'desktop sidebar must not be aria-hidden');
  }
  return state;
}

async function resetThroughVisibleUi(page, compact, label) {
  const reset = page.locator('#atlasReset');
  if (await reset.isVisible()) {
    await reset.click();
    return assertSafeFocus(page, `${label}/reset`, (state) => state.id === 'atlasReset');
  }

  const cleanInputs = await page.evaluate(() => ({
    search: document.getElementById('atlasSearchInput')?.value || '',
    relationsChecked: Array.from(document.querySelectorAll('.atlas-relation-filter input')).every((input) => input.checked),
  }));
  assert.equal(cleanInputs.search, '', `${label}: hidden reset fallback requires an empty search`);
  assert.equal(cleanInputs.relationsChecked, true, `${label}: hidden reset fallback requires all relation filters enabled`);

  const allGroup = page.locator('[data-atlas-group="all"]');
  if (compact) {
    const trigger = page.locator('#atlasFilterTrigger');
    if (!(await page.locator('#atlasSidebar').evaluate((sidebar) => sidebar.classList.contains('is-open')))) {
      await trigger.click();
      await page.waitForFunction(() => document.getElementById('atlasSidebar')?.classList.contains('is-open'));
    }
    await allGroup.waitFor({ state: 'visible' });
    await allGroup.focus();
    await allGroup.click();
    await page.waitForFunction(() => !document.getElementById('atlasSidebar')?.classList.contains('is-open'));
    return assertSafeFocus(page, `${label}/compact-all`, (state) => state.id === 'atlasFilterTrigger');
  }

  await allGroup.waitFor({ state: 'visible' });
  await allGroup.focus();
  await allGroup.click();
  return assertSafeFocus(page, `${label}/desktop-all`, (state) => String(state.className).includes('atlas-theme'));
}

async function runCase(browserName, browserType, baseUrl, width) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width, height: HEIGHT } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error?.stack || error)));
  const compact = width <= 980;
  const result = { browser: browserName, width, compact, steps: {} };

  try {
    const response = await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: 'networkidle' });
    assert.ok(response?.ok(), `${browserName}/${width}: route failed to load`);
    await page.waitForFunction(() => document.getElementById('atlasApp')?.dataset.runtimeReady === '1');
    result.steps.initial = await assertClosedSurfaceState(page, compact);

    if (compact) {
      const trigger = page.locator('#atlasFilterTrigger');
      await trigger.click();
      await page.waitForFunction(() => document.getElementById('atlasSidebar')?.classList.contains('is-open'));
      result.steps.drawerOpen = await assertSafeFocus(page, `${browserName}/${width}/drawer-open`, (state) => state.id === 'atlasFilterClose');
      const drawerState = await page.evaluate(() => ({
        inert: document.getElementById('atlasSidebar')?.hasAttribute('inert'),
        aria: document.getElementById('atlasSidebar')?.getAttribute('aria-hidden'),
      }));
      assert.equal(drawerState.inert, false, `${browserName}/${width}: open drawer remains inert`);
      assert.equal(drawerState.aria, 'false', `${browserName}/${width}: open drawer remains aria-hidden`);

      const group = page.locator('[data-atlas-group]:not([data-atlas-group="all"])').first();
      await group.focus();
      await group.click();
      await page.waitForFunction(() => !document.getElementById('atlasSidebar')?.classList.contains('is-open'));
      result.steps.groupClose = await assertSafeFocus(page, `${browserName}/${width}/group-close`, (state) => state.id === 'atlasFilterTrigger');
      await assertClosedSurfaceState(page, true);

      await trigger.click();
      await page.waitForFunction(() => document.getElementById('atlasSidebar')?.classList.contains('is-open'));
      await page.keyboard.press('Escape');
      result.steps.drawerEscape = await assertSafeFocus(page, `${browserName}/${width}/drawer-escape`, (state) => state.id === 'atlasFilterTrigger');
    }

    result.steps.resetSetup = await resetThroughVisibleUi(page, compact, `${browserName}/${width}/reset-setup`);
    await activateFirstNode(page);
    await page.locator('#atlasDetailClose').focus();
    await page.locator('#atlasDetailClose').click();
    await page.waitForFunction(() => !document.getElementById('atlasDetail')?.classList.contains('is-open'));
    result.steps.detailClose = await assertSafeFocus(page, `${browserName}/${width}/detail-close`, (state) => String(state.className).includes('atlas-node'));
    await assertClosedSurfaceState(page, compact);

    await activateFirstNode(page);
    const related = page.locator('[data-detail-focus]').first();
    if (await related.count()) {
      await related.focus();
      await related.click();
      result.steps.relatedReplacement = await assertSafeFocus(page, `${browserName}/${width}/related-replacement`, (state) =>
        String(state.className).includes('atlas-detail__primary') || state.id === 'atlasDetailClose');
      await page.keyboard.press('Escape');
      result.steps.detailEscape = await assertSafeFocus(page, `${browserName}/${width}/detail-escape`, (state) => String(state.className).includes('atlas-node'));
    }

    await page.locator('[data-atlas-view="list"]').click();
    await page.waitForFunction(() => !document.getElementById('atlasListView')?.hidden);
    const listFocus = page.locator('[data-list-focus]:visible').first();
    await listFocus.focus();
    await listFocus.click();
    await page.waitForFunction(() => !document.getElementById('atlasGraphView')?.hidden);
    result.steps.listToGraph = await assertSafeFocus(page, `${browserName}/${width}/list-to-graph`, (state) => String(state.className).includes('atlas-node'));

    const historyNode = page.locator('.atlas-node:not(.is-filtered-out)[tabindex="0"]').first();
    await historyNode.focus();
    await page.keyboard.press('Enter');
    await page.locator('#atlasDetail.is-open').waitFor({ state: 'visible' });
    await page.locator('.atlas-detail__primary').focus();
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(120);
    result.steps.history = await assertSafeFocus(page, `${browserName}/${width}/history`);

    if (width === 680 || width === 681 || width === 980 || width === 981) {
      result.steps.resizeResetSetup = await resetThroughVisibleUi(page, compact, `${browserName}/${width}/resize-reset-setup`);
      const resizeNode = page.locator('.atlas-node:not(.is-filtered-out)[tabindex="0"]').first();
      await resizeNode.focus();
      const resizeTarget = width === 680 ? 681 : width === 681 ? 680 : width === 980 ? 981 : 980;
      await page.setViewportSize({ width: resizeTarget, height: HEIGHT });
      await page.waitForTimeout(180);
      result.steps.resize = await assertSafeFocus(page, `${browserName}/${width}/resize`, (state) =>
        String(state.className).includes('atlas-node') || state.id === 'atlasFilterTrigger');
    }

    assert.deepEqual(errors, [], `${browserName}/${width}: uncaught page errors`);
    result.errors = errors;
    return result;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  assert.ok(fs.existsSync(DIST), 'dist missing; build production-like output first');
  const server = await startServer();
  const results = [];
  try {
    for (const [browserName, browserType] of Object.entries(BROWSERS)) {
      for (const width of WIDTHS) results.push(await runCase(browserName, browserType, server.baseUrl, width));
    }
  } finally {
    await server.close();
  }

  const report = {
    schemaVersion: 1,
    conclusion: 'success',
    sha: process.env.SOURCE_SHA || '',
    route: ROUTE,
    browsers: Object.keys(BROWSERS),
    widths: WIDTHS,
    cases: results.length,
    results,
  };
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Atlas focus-state contract: PASS (${results.length} cases)`);
}

main().catch((error) => {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify({
    schemaVersion: 1,
    conclusion: 'failure',
    sha: process.env.SOURCE_SHA || '',
    error: String(error?.stack || error),
  }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});