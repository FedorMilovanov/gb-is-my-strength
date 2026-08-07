#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { chromium, webkit } from 'playwright';

const options = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...value] = argument.replace(/^--/, '').split('=');
  return [key, value.join('=') || true];
}));
const dist = path.resolve(String(options.dist || 'dist'));
const reportDir = path.resolve(String(options.report || 'reports/search-modal-contract/app-surfaces'));

const routes = [
  { path: '/karty/avraam/', local: '.me-search', avoid: ['.me-search', '.me-theme-btn', '.me-share-btn'], family: 'map' },
  { path: '/karty/ishod/', local: '.me-search', avoid: ['.me-search', '.me-theme-btn', '.me-share-btn'], family: 'map' },
  { path: '/konfessii/russkij-baptizm/', local: '#appframe', avoid: ['.bar .back', '.bar .crumb'], family: 'baptizm' },
  { path: '/map/', local: '#atlasSearchInput', avoid: ['#atlasSearchInput', '.atlas-filter-trigger', '.atlas-view-switch'], family: 'atlas' },
];
const viewports = [
  { name: 'mobile-320', width: 320, height: 568 },
  { name: 'desktop-1440', width: 1440, height: 900 },
];

function mime(file) {
  return ({
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.woff2': 'font/woff2',
  })[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function staticServer(root) {
  return http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
    let file = path.join(root, pathname.replace(/^\/+/, ''));
    if (pathname.endsWith('/')) file = path.join(file, 'index.html');
    if (!path.extname(file) && !fs.existsSync(file)) file = path.join(file, 'index.html');
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': mime(file), 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(response);
  });
}

function overlap(a, b) {
  if (!a || !b) return 0;
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

function ignorableConsoleError(text) {
  return /Failed to load resource|ERR_|mc\.yandex|Content Security Policy|Refused to (connect|load|frame)/i.test(text);
}

async function runCase(browserType, browserName, route, viewport, port) {
  const browser = await browserType.launch({ headless: true });
  const platformScenario = browserName === 'webkit'
    ? { platform: 'MacIntel', uaPlatform: 'macOS', expectedShortcut: '⌘+K', shortcutPress: 'Meta+K' }
    : { platform: 'Win32', uaPlatform: 'Windows', expectedShortcut: 'Ctrl+K', shortcutPress: 'Control+K' };
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  await page.addInitScript(({ platform, uaPlatform }) => {
    Object.defineProperty(navigator, 'platform', { configurable: true, get: () => platform });
    Object.defineProperty(navigator, 'userAgentData', {
      configurable: true,
      get: () => ({ platform: uaPlatform }),
    });
  }, platformScenario);
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (!ignorableConsoleError(text)) consoleErrors.push(text);
  });

  const id = `${browserName}-${viewport.name}-${route.path.replace(/\W+/g, '-').replace(/^-|-$/g, '')}`;
  try {
    await page.goto(`http://127.0.0.1:${port}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const trigger = page.locator('#gbSearchBtn');
    await trigger.waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForFunction(({ expectedShortcut }) => {
      const node = document.getElementById('gbSearchBtn');
      return node?.getAttribute('data-search-label-ready') === expectedShortcut
        && node?.getAttribute('aria-label') === `Поиск по всему сайту (${expectedShortcut})`
        && node?.getAttribute('title') === `Поиск по всему сайту ${expectedShortcut}`;
    }, platformScenario, { timeout: 30_000 });
    await page.locator(route.local).first().waitFor({ state: 'visible', timeout: 30_000 });

    const geometry = await page.evaluate(({ avoid, family }) => {
      const box = (node) => {
        const rect = node?.getBoundingClientRect();
        return rect && node.getClientRects().length ? {
          left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
          width: rect.width, height: rect.height,
        } : null;
      };
      const triggerNode = document.getElementById('gbSearchBtn');
      const triggerBox = box(triggerNode);
      const avoidBoxes = avoid.flatMap((selector) => [...document.querySelectorAll(selector)])
        .map((node) => ({ selector: node.matches('#gbSearchBtn') ? 'self' : node.className || node.id, box: box(node) }))
        .filter((entry) => entry.box && entry.selector !== 'self');
      return {
        family,
        trigger: triggerBox,
        avoid: avoidBoxes,
        triggerCount: document.querySelectorAll('#gbSearchBtn').length,
        label: triggerNode?.getAttribute('aria-label') || '',
        title: triggerNode?.getAttribute('title') || '',
        readiness: triggerNode?.getAttribute('data-search-label-ready') || '',
        localMapSearchCount: document.querySelectorAll('.me-search').length,
        atlasSearchCount: document.querySelectorAll('#atlasSearchInput').length,
        iframeCount: document.querySelectorAll('#appframe').length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    }, { avoid: route.avoid, family: route.family });

    assert.equal(geometry.triggerCount, 1, `${id}: exactly one global trigger`);
    assert.ok(geometry.trigger && geometry.trigger.width >= 44 && geometry.trigger.height >= 44, `${id}: 44px trigger`);
    assert.equal(geometry.label, `Поиск по всему сайту (${platformScenario.expectedShortcut})`, `${id}: exact platform aria label`);
    assert.equal(geometry.title, `Поиск по всему сайту ${platformScenario.expectedShortcut}`, `${id}: exact platform title`);
    assert.equal(geometry.readiness, platformScenario.expectedShortcut, `${id}: label readiness`);
    assert.ok(geometry.overflow <= 1, `${id}: horizontal overflow ${geometry.overflow}`);
    for (const entry of geometry.avoid) {
      assert.equal(overlap(geometry.trigger, entry.box), 0, `${id}: trigger overlaps ${entry.selector}`);
    }
    if (route.family === 'map') assert.equal(geometry.localMapSearchCount, 1, `${id}: local map search retained`);
    if (route.family === 'atlas') assert.equal(geometry.atlasSearchCount, 1, `${id}: local atlas search retained`);
    if (route.family === 'baptizm') assert.equal(geometry.iframeCount, 1, `${id}: iframe retained`);

    await trigger.click();
    await page.waitForFunction(
      () => window.GBSearch?.__ready === true && document.querySelector('.cp-backdrop')?.classList.contains('is-open'),
      null,
      { timeout: 30_000 },
    );
    const input = page.locator('.cp-input');
    await input.waitFor({ state: 'visible', timeout: 15_000 });
    const focusStartedAt = Date.now();
    await page.waitForFunction(
      () => { const field = document.querySelector('.cp-input'); return Boolean(field && document.activeElement === field); },
      null,
      { timeout: 1500 },
    );
    const focusElapsedMs = Date.now() - focusStartedAt;
    console.log(`${id}: click focus settled in ${focusElapsedMs}ms`);
    assert.equal(await input.evaluate((node) => document.activeElement === node), true, `${id}: input focus after click`);
    assert.equal(await page.locator('.cp-backdrop.is-open[role="dialog"][aria-modal="true"]').count(), 1, `${id}: one dialog`);

    const modalGeometry = await page.locator('.cp-box').evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    });
    assert.ok(modalGeometry.left >= -1 && modalGeometry.top >= -1, `${id}: modal starts in viewport`);
    const actualViewport = await page.evaluate(() => ({ innerWidth: window.innerWidth, innerHeight: window.innerHeight, visualWidth: window.visualViewport?.width ?? null, visualHeight: window.visualViewport?.height ?? null, devicePixelRatio: window.devicePixelRatio }));
    console.log(`${id}: requested=${viewport.width}x${viewport.height} actual=${JSON.stringify(actualViewport)} modal=${JSON.stringify(modalGeometry)}`);
    assert.equal(actualViewport.innerWidth, viewport.width, `${id}: actual viewport width`);
    assert.equal(actualViewport.innerHeight, viewport.height, `${id}: actual viewport height`);
    assert.ok(modalGeometry.right <= actualViewport.innerWidth + 1 && modalGeometry.bottom <= actualViewport.innerHeight + 1, `${id}: modal ends in viewport`);

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.cp-backdrop')?.classList.contains('is-open'));
    assert.equal(await trigger.evaluate((node) => document.activeElement === node), true, `${id}: trigger focus restored`);

    const assertShortcutClosed = async (label, press) => {
      await press();
      await page.waitForTimeout(80);
      assert.equal(await page.locator('.cp-backdrop.is-open').count(), 0, `${id}: ${label} must not open Search`);
    };
    const invalidAlt = browserName === 'webkit' ? 'Alt+Meta+K' : 'Alt+Control+K';
    const invalidShift = browserName === 'webkit' ? 'Shift+Meta+K' : 'Shift+Control+K';
    await assertShortcutClosed('Alt-modified shortcut', () => page.keyboard.press(invalidAlt));
    await assertShortcutClosed('Shift-modified shortcut', () => page.keyboard.press(invalidShift));
    await assertShortcutClosed('Ctrl+Meta+K', () => page.keyboard.press('Control+Meta+K'));
    await page.evaluate(() => {
      const editor = document.createElement('div');
      editor.id = 'app-search-contract-textbox';
      editor.tabIndex = 0;
      editor.setAttribute('role', 'textbox');
      editor.textContent = 'editor';
      document.body.appendChild(editor);
      editor.focus();
    });
    await assertShortcutClosed('role=textbox shortcut', () => page.keyboard.press(platformScenario.shortcutPress));
    await page.evaluate(() => {
      const editor = document.createElement('div');
      editor.id = 'app-search-contract-contenteditable';
      editor.contentEditable = 'true';
      editor.tabIndex = 0;
      editor.textContent = 'editable';
      document.body.appendChild(editor);
      editor.focus();
    });
    await assertShortcutClosed('contenteditable shortcut', () => page.keyboard.press(platformScenario.shortcutPress));
    await page.locator('#gbSearchBtn').focus();
    await assertShortcutClosed('IME composing shortcut', () => page.evaluate(({ isMac }) => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: !isMac,
        metaKey: isMac,
        bubbles: true,
        cancelable: true,
      });
      try { Object.defineProperty(event, 'isComposing', { configurable: true, value: true }); } catch {}
      document.activeElement?.dispatchEvent(event);
    }, { isMac: browserName === 'webkit' }));

    await page.keyboard.press(platformScenario.shortcutPress);
    await page.waitForFunction(() => document.querySelector('.cp-backdrop')?.classList.contains('is-open'));
    await page.keyboard.press(platformScenario.shortcutPress);
    await page.waitForTimeout(80);
    assert.equal(await page.locator('.cp-backdrop.is-open').count(), 1, `${id}: canonical shortcut must be idempotent-open while Search is already open`);
    const shortcutFocusStartedAt = Date.now();
    await page.waitForFunction(
      () => { const field = document.querySelector('.cp-input'); const modal = document.querySelector('.cp-backdrop'); return Boolean(field && modal?.classList.contains('is-open') && document.activeElement === field); },
      null,
      { timeout: 1500 },
    );
    const shortcutFocusElapsedMs = Date.now() - shortcutFocusStartedAt;
    console.log(`${id}: shortcut focus settled in ${shortcutFocusElapsedMs}ms`);
    assert.equal(await input.evaluate((node) => document.activeElement === node), true, `${id}: input focus after shortcut`);
    await page.locator('.cp-close').click();
    await page.waitForFunction(() => !document.querySelector('.cp-backdrop')?.classList.contains('is-open'));

    assert.deepEqual(pageErrors, [], `${id}: page errors`);
    assert.deepEqual(consoleErrors, [], `${id}: console errors`);
    return { id, browser: browserName, viewport: viewport.name, route: route.path, expectedShortcut: platformScenario.expectedShortcut, geometry, modalGeometry, pageErrors, consoleErrors, status: 'PASS' };
  } catch (error) {
    fs.mkdirSync(reportDir, { recursive: true });
    await page.screenshot({ path: path.join(reportDir, `${id}.png`), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
}

assert.ok(fs.existsSync(dist), `dist missing: ${dist}`);
fs.mkdirSync(reportDir, { recursive: true });
const server = staticServer(dist);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const results = [];
try {
  for (const [browserName, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
    for (const viewport of viewports) {
      for (const route of routes) results.push(await runCase(browserType, browserName, route, viewport, port));
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
fs.writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify({ schemaVersion: 1, results }, null, 2));
console.log(`APP SEARCH SURFACE BROWSER CONTRACT: ${results.length}/${results.length} PASS`);
