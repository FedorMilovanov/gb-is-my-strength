#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const ROOT = path.resolve(process.cwd());
const REPORT_DIR = path.join(ROOT, 'reports', 'sw-register-accessibility');
const BROWSERS = { chromium, webkit };
const LEGACY_DISMISS_WINDOW_MS = 8200;

function serveFile(response, relative, type) {
  const file = path.join(ROOT, relative);
  if (!fs.existsSync(file)) {
    response.statusCode = 404;
    response.end('Not found');
    return;
  }
  response.setHeader('Content-Type', type);
  response.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(file).pipe(response);
}

function fixtureHtml() {
  return `<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SW accessibility contract</title></head>
<body>
  <main><h1>SW accessibility contract</h1></main>
  <script>
    window.SITE_CONFIG = { version: 'contract' };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: null,
        register: function () { return Promise.resolve({ addEventListener: function () {}, installing: null }); },
        addEventListener: function () {}
      }
    });
  </script>
  <script src="/js/sw-register.js"></script>
</body>
</html>`;
}

async function startServer() {
  let fixtureRequests = 0;
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (url.pathname === '/' || url.pathname === '/fixture/') {
      fixtureRequests += 1;
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.end(fixtureHtml());
      return;
    }
    if (url.pathname === '/js/sw-register.js') return serveFile(response, 'js/sw-register.js', 'application/javascript; charset=utf-8');
    if (url.pathname === '/css/sw-toast.css') return serveFile(response, 'css/sw-toast.css', 'text/css; charset=utf-8');
    response.statusCode = 404;
    response.end('Not found');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    fixtureRequests: () => fixtureRequests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function waitForReload(page, server, before, action) {
  const navigation = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 });
  await action();
  await navigation;
  await page.waitForFunction(() => typeof window.showToast === 'function');
  assert.ok(server.fixtureRequests() > before, 'native reload action did not reload the fixture');
}

async function runBrowser(browserName, browserType, server) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    const response = await page.goto(`${server.baseUrl}/fixture/`, { waitUntil: 'domcontentloaded' });
    assert.ok(response?.ok(), `${browserName}: fixture failed to load`);
    await page.waitForFunction(() => typeof window.showToast === 'function');

    const status = page.getByRole('status');
    assert.equal(await status.count(), 1, `${browserName}: expected one status live region`);
    const live = await status.evaluate((node) => ({
      role: node.getAttribute('role'),
      live: node.getAttribute('aria-live'),
      atomic: node.getAttribute('aria-atomic'),
      tabIndex: node.tabIndex,
    }));
    assert.deepEqual(live, { role: 'status', live: 'polite', atomic: 'true', tabIndex: -1 }, `${browserName}: status semantics drifted`);

    await page.evaluate(() => window.showToast('Соединение восстановлено', false));
    await status.waitFor({ state: 'visible' });
    assert.equal(await status.getByRole('button').count(), 0, `${browserName}: passive status exposes a fake action`);

    await page.evaluate(() => window.showToast('Доступно обновление сайта', true));
    const reloadButton = status.getByRole('button', { name: 'Обновить' });
    await reloadButton.waitFor({ state: 'visible' });
    assert.equal(await reloadButton.evaluate((node) => node.tagName), 'BUTTON', `${browserName}: reload action is not a native button`);
    assert.equal(await reloadButton.getAttribute('type'), 'button', `${browserName}: reload button type drifted`);
    await reloadButton.focus();
    assert.equal(await reloadButton.evaluate((node) => document.activeElement === node), true, `${browserName}: reload action cannot receive focus`);

    await page.waitForTimeout(LEGACY_DISMISS_WINDOW_MS);
    assert.equal(await reloadButton.isVisible(), true, `${browserName}: actionable update disappeared after the legacy 8-second timeout window`);
    assert.equal(await reloadButton.evaluate((node) => document.activeElement === node), true, `${browserName}: actionable update lost keyboard focus while remaining pending`);

    let before = server.fixtureRequests();
    await waitForReload(page, server, before, () => page.getByRole('button', { name: 'Обновить' }).press('Enter'));

    await page.evaluate(() => window.showToast('Доступно обновление сайта', true));
    const reloadButtonSpace = page.getByRole('button', { name: 'Обновить' });
    await reloadButtonSpace.focus();
    before = server.fixtureRequests();
    await waitForReload(page, server, before, () => page.getByRole('button', { name: 'Обновить' }).press('Space'));

    return {
      browser: browserName,
      liveRegion: live,
      reloadAction: 'native-button',
      persistedPastLegacyTimeout: true,
      enterReload: true,
      spaceReload: true,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const server = await startServer();
  const results = [];
  try {
    for (const [name, type] of Object.entries(BROWSERS)) results.push(await runBrowser(name, type, server));
  } finally {
    await server.close();
  }
  const report = { schemaVersion: 1, conclusion: 'success', browsers: results };
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`SW REGISTER ACCESSIBILITY CONTRACT: PASS (${results.length}/${results.length})`);
}

main().catch((error) => {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify({ schemaVersion: 1, conclusion: 'failure', error: String(error?.stack || error) }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
