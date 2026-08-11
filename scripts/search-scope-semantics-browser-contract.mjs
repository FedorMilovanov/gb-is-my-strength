#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const ROOT = path.resolve(process.cwd());
const DIST = path.join(ROOT, 'dist');
const REPORT_DIR = path.join(ROOT, 'reports', 'search-modal-contract', 'scope-semantics');
const SCOPE_ROUTE = '/articles/';
const OVERLAY_ROUTE = '/karty/avraam/';
const SEARCH_OVERLAY_OWNER = 'search:command-palette';
const EXPECTED_SCOPES = ['all', 'articles', 'scripture', 'authors'];
const EXPECTED_LABELS = ['Все', 'Статьи', 'Ссылки', 'Авторы'];
const CASES = [
  ['chromium', chromium, { width: 1366, height: 900 }],
  ['chromium-mobile', chromium, { width: 390, height: 844 }],
  ['webkit', webkit, { width: 1366, height: 900 }],
  ['webkit-mobile', webkit, { width: 390, height: 844 }],
];

function contentType(file) {
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
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
  assert.ok(resolveRequest(SCOPE_ROUTE), `built route missing: ${SCOPE_ROUTE}`);
  assert.ok(resolveRequest(OVERLAY_ROUTE), `built route missing: ${OVERLAY_ROUTE}`);
  assert.ok(fs.existsSync(path.join(DIST, 'pagefind', 'pagefind.js')), 'Pagefind output missing');
  const server = http.createServer((request, response) => {
    try {
      const file = resolveRequest(request.url);
      response.setHeader('Cache-Control', 'no-store');
      if (!file) {
        response.statusCode = 404;
        response.end('Not found');
        return;
      }
      response.setHeader('Content-Type', contentType(file));
      fs.createReadStream(file).pipe(response);
    } catch (error) {
      response.statusCode = 400;
      response.end(String(error?.message || error));
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function pressedState(page) {
  return page.locator('.cp-scope-chip').evaluateAll((buttons) => buttons.map((button) => ({
    scope: button.getAttribute('data-scope'),
    pressed: button.getAttribute('aria-pressed'),
    selected: button.getAttribute('aria-selected'),
    active: button.classList.contains('active'),
    tag: button.tagName,
    type: button.getAttribute('type'),
    text: String(button.textContent || '').replace(/\s+/g, ' ').trim(),
  })));
}

function assertSinglePressed(states, expectedScope, label) {
  assert.deepEqual(states.map((state) => state.scope), EXPECTED_SCOPES, `${label}: scope order drifted`);
  assert.deepEqual(states.map((state) => state.text), EXPECTED_LABELS, `${label}: scope labels drifted`);
  assert.ok(states.every((state) => state.tag === 'BUTTON' && state.type === 'button'), `${label}: scopes are not native type=button controls`);
  assert.ok(states.every((state) => state.selected === null), `${label}: obsolete aria-selected remains on filter controls`);
  const pressed = states.filter((state) => state.pressed === 'true');
  const active = states.filter((state) => state.active);
  assert.equal(pressed.length, 1, `${label}: expected exactly one aria-pressed=true control`);
  assert.equal(active.length, 1, `${label}: expected exactly one visual active control`);
  assert.equal(pressed[0].scope, expectedScope, `${label}: aria-pressed owner is wrong`);
  assert.equal(active[0].scope, expectedScope, `${label}: visual active owner is wrong`);
  assert.equal(pressed[0].scope, active[0].scope, `${label}: semantic and visual selected scope disagree`);
}

async function openSearch(page, baseUrl, route = SCOPE_ROUTE) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
  assert.ok(response?.ok(), `${route}: route failed to load`);
  await page.waitForFunction(() => document.readyState !== 'loading');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('gb:openSearch')));
  const dialog = page.getByRole('dialog', { name: 'Поиск по сайту' });
  await dialog.waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('.cp-scope-chip').first().waitFor({ state: 'visible' });
  return dialog;
}

async function runScopeCase(name, browserType, viewport, baseUrl) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  try {
    await openSearch(page, baseUrl);

    const group = page.locator('.cp-scope-chips');
    assert.equal(await group.getAttribute('role'), 'group', `${name}: scope container is not a truthful group`);
    assert.equal(await group.getAttribute('aria-label'), 'Область поиска', `${name}: group label drifted`);
    assert.equal(await page.getByRole('tablist').count(), 0, `${name}: obsolete tablist role remains`);
    assert.equal(await page.getByRole('tab').count(), 0, `${name}: obsolete tab role remains`);
    assert.equal(await page.locator('.cp-scope-chip').count(), 4, `${name}: expected four scope buttons`);
    assert.equal(await page.getByRole('combobox', { name: 'Поиск' }).count(), 1, `${name}: combobox ownership regressed`);
    assert.equal(await page.getByRole('listbox', { name: 'Результаты поиска' }).count(), 1, `${name}: result listbox ownership regressed`);

    assertSinglePressed(await pressedState(page), 'all', `${name} initial`);

    const buttons = page.locator('.cp-scope-chip');
    await buttons.nth(0).focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-scope')), 'articles', `${name}: native Tab sequence does not enter the next scope button`);
    await page.keyboard.press('Space');
    assertSinglePressed(await pressedState(page), 'articles', `${name} Space articles`);

    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-scope')), 'scripture', `${name}: native Tab sequence does not reach scripture scope`);
    await page.keyboard.press('Enter');
    assertSinglePressed(await pressedState(page), 'scripture', `${name} Enter scripture`);

    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-scope')), 'authors', `${name}: native Tab sequence does not reach authors scope`);
    await page.keyboard.press('Space');
    assertSinglePressed(await pressedState(page), 'authors', `${name} Space authors`);

    await buttons.nth(0).click();
    assertSinglePressed(await pressedState(page), 'all', `${name} click all`);

    return { name, kind: 'scope', route: SCOPE_ROUTE, viewport, conclusion: 'success' };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function overlaySnapshot(page) {
  return page.evaluate(() => ({
    top: window.OverlayRuntime?.topLayer?.()?.ownerId || null,
    size: window.OverlayRuntime?.size?.() ?? null,
    htmlTop: document.documentElement.getAttribute('data-overlay-top'),
    htmlCount: document.documentElement.getAttribute('data-overlay-count'),
  }));
}

async function runOverlayCase(name, browserType, viewport, baseUrl) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  try {
    const response = await page.goto(`${baseUrl}${OVERLAY_ROUTE}`, { waitUntil: 'domcontentloaded' });
    assert.ok(response?.ok(), `${name}: ${OVERLAY_ROUTE} failed to load`);
    await page.waitForFunction(() => Boolean(window.OverlayRuntime?.topLayer?.()?.ownerId?.endsWith(':intro')), null, { timeout: 15000 });
    await page.locator('.me-intro').waitFor({ state: 'visible', timeout: 15000 });

    const beforeSearch = await overlaySnapshot(page);
    assert.ok(beforeSearch.top?.endsWith(':intro'), `${name}: MapEngine intro is not the initial top overlay`);
    assert.equal(beforeSearch.htmlTop, beforeSearch.top, `${name}: overlay diagnostics disagree before Search`);
    assert.equal(beforeSearch.size, 1, `${name}: expected one initial MapEngine overlay owner`);
    assert.equal(beforeSearch.htmlCount, '1', `${name}: initial overlay diagnostic count drifted`);

    const trigger = page.locator('[data-app-search-trigger]');
    await trigger.waitFor({ state: 'attached', timeout: 10000 });
    await trigger.focus();
    assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-app-search-trigger')), true, `${name}: Search trigger could not receive focus before open`);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('gb:openSearch', { detail: { source: 'keyboard' } })));

    const dialog = page.getByRole('dialog', { name: 'Поиск по сайту' });
    await dialog.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForFunction((owner) => window.OverlayRuntime?.topLayer?.()?.ownerId === owner, SEARCH_OVERLAY_OWNER, { timeout: 10000 });

    const searchOpen = await overlaySnapshot(page);
    assert.equal(searchOpen.top, SEARCH_OVERLAY_OWNER, `${name}: Search did not become the shared top overlay owner`);
    assert.equal(searchOpen.htmlTop, SEARCH_OVERLAY_OWNER, `${name}: Search overlay diagnostics drifted`);
    assert.equal(searchOpen.size, 2, `${name}: Search did not stack over MapEngine intro`);
    assert.equal(searchOpen.htmlCount, '2', `${name}: stacked overlay diagnostic count drifted`);
    assert.equal(await page.locator('.cp-backdrop').getAttribute('data-overlay-owner'), SEARCH_OVERLAY_OWNER, `${name}: Search dialog is not bound to its shared overlay owner`);

    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden', timeout: 10000 });
    await page.waitForFunction(() => Boolean(window.OverlayRuntime?.topLayer?.()?.ownerId?.endsWith(':intro')), null, { timeout: 10000 });

    const afterSearchEscape = await overlaySnapshot(page);
    assert.ok(afterSearchEscape.top?.endsWith(':intro'), `${name}: first Escape consumed the underlying MapEngine intro`);
    assert.equal(afterSearchEscape.size, 1, `${name}: first Escape did not remove exactly the Search layer`);
    assert.equal(afterSearchEscape.htmlCount, '1', `${name}: overlay count after Search Escape drifted`);
    assert.equal(await page.locator('.me-intro').count(), 1, `${name}: MapEngine intro disappeared with Search`);
    assert.equal(await page.locator('.me-intro').getAttribute('data-overlay-open'), '1', `${name}: underlying intro is no longer live after Search Escape`);
    assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-app-search-trigger')), true, `${name}: Search focus was not restored to its opener`);

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => (window.OverlayRuntime?.size?.() ?? -1) === 0, null, { timeout: 10000 });
    await page.locator('.me-intro').waitFor({ state: 'detached', timeout: 10000 });

    const afterIntroEscape = await overlaySnapshot(page);
    assert.equal(afterIntroEscape.top, null, `${name}: second Escape left a stale overlay owner`);
    assert.equal(afterIntroEscape.size, 0, `${name}: second Escape did not close the underlying MapEngine intro`);
    assert.equal(afterIntroEscape.htmlTop, null, `${name}: stale data-overlay-top remained after stack drained`);
    assert.equal(afterIntroEscape.htmlCount, '0', `${name}: final overlay diagnostic count drifted`);

    return { name, kind: 'overlay-order', route: OVERLAY_ROUTE, viewport, conclusion: 'success' };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  assert.ok(fs.existsSync(DIST), 'dist missing; run production-like build first');
  const server = await startServer();
  const scopeResults = [];
  const overlayResults = [];
  try {
    for (const [name, browserType, viewport] of CASES) {
      scopeResults.push(await runScopeCase(name, browserType, viewport, server.baseUrl));
    }
    for (const [name, browserType, viewport] of CASES) {
      overlayResults.push(await runOverlayCase(name, browserType, viewport, server.baseUrl));
    }
  } finally {
    await server.close();
  }
  const report = {
    schemaVersion: 2,
    conclusion: 'success',
    scopeRoute: SCOPE_ROUTE,
    overlayRoute: OVERLAY_ROUTE,
    scopeResults,
    overlayResults,
  };
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`SEARCH SCOPE + OVERLAY CONTRACT: PASS (${scopeResults.length + overlayResults.length}/${scopeResults.length + overlayResults.length})`);
}

main().catch((error) => {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify({ schemaVersion: 2, conclusion: 'failure', error: String(error?.stack || error) }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
