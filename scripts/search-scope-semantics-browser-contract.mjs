#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const ROOT = path.resolve(process.cwd());
const DIST = path.join(ROOT, 'dist');
const REPORT_DIR = path.join(ROOT, 'reports', 'search-modal-contract', 'scope-semantics');
const ROUTE = '/articles/';
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
  assert.ok(resolveRequest(ROUTE), `built route missing: ${ROUTE}`);
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

async function openSearch(page, baseUrl) {
  const response = await page.goto(`${baseUrl}${ROUTE}`, { waitUntil: 'domcontentloaded' });
  assert.ok(response?.ok(), `${ROUTE}: route failed to load`);
  await page.waitForFunction(() => document.readyState !== 'loading');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('gb:openSearch')));
  const dialog = page.getByRole('dialog', { name: 'Поиск по сайту' });
  await dialog.waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('.cp-scope-chip').first().waitFor({ state: 'visible' });
}

async function runCase(name, browserType, viewport, baseUrl) {
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

    return { name, viewport, conclusion: 'success' };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  assert.ok(fs.existsSync(DIST), 'dist missing; run production-like build first');
  const server = await startServer();
  const results = [];
  try {
    for (const [name, browserType, viewport] of CASES) {
      results.push(await runCase(name, browserType, viewport, server.baseUrl));
    }
  } finally {
    await server.close();
  }
  const report = { schemaVersion: 1, conclusion: 'success', route: ROUTE, results };
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`SEARCH SCOPE SEMANTICS CONTRACT: PASS (${results.length}/${results.length})`);
}

main().catch((error) => {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify({ schemaVersion: 1, conclusion: 'failure', error: String(error?.stack || error) }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
