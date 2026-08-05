#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { chromium, webkit } from 'playwright';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, '').split('=');
  return [key, value.join('=') || true];
}));
const dist = path.resolve(String(args.dist || 'dist'));
const reportDir = path.resolve(String(args.report || 'reports/search-modal-contract'));
const jsSource = fs.readFileSync(path.resolve('js/search.js'), 'utf8');
const cssSource = fs.readFileSync(path.resolve('css/command-palette.css'), 'utf8');

function sourceContract() {
  const requiredJs = [
    'role="combobox"',
    'aria-haspopup="listbox"',
    'aria-expanded="false"',
    'aria-activedescendant',
    'class="cp-close"',
    'id="cp-option-\'+t+\'"',
    'Close.addEventListener("click",re)',
    'k.addEventListener("keydown",function(e){if("Tab"!==e.key',
  ];
  for (const marker of requiredJs) assert.ok(jsSource.includes(marker), `missing JS marker: ${marker}`);
  assert.ok(!jsSource.includes(`return'<button class="cp-item"`), 'result options must not be nested button/listbox hybrids');
  assert.ok(!jsSource.includes(`[role="option"]');if(!i.length)break`), 'legacy input-only Tab trap survived');

  const requiredCss = [
    'z-index:2147483000',
    '.cp-clear,.cp-close{',
    'min-height:44px',
    '.cp-scope-chip:focus-visible',
    '.cp-preview-btn:focus-visible',
    '.gb-nav-search-icon:focus-visible',
  ];
  for (const marker of requiredCss) assert.ok(cssSource.includes(marker), `missing CSS marker: ${marker}`);
  assert.ok(!cssSource.includes('z-index:var(--z-modal,10000)'), 'weak modal fallback survived');
  assert.ok(!cssSource.includes('min-height:32px'), '32px scope-chip target survived');
  assert.match(cssSource, /\.gb-nav-search-icon\{[^}]*width:44px;[^}]*height:44px;/, 'navigation search trigger is not 44px');
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
  })[ext] || 'application/octet-stream';
}

function createServer(root) {
  return http.createServer((req, res) => {
    const raw = new URL(req.url || '/', 'http://127.0.0.1').pathname;
    let file = path.join(root, decodeURIComponent(raw).replace(/^\/+/, ''));
    if (raw.endsWith('/')) file = path.join(file, 'index.html');
    if (!path.extname(file) && !fs.existsSync(file)) file = path.join(file, 'index.html');
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'content-type': contentType(file),
      'cache-control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  });
}

async function visibleFocusables(page) {
  return page.locator('.cp-backdrop.is-open input:not([disabled]),.cp-backdrop.is-open button:not([disabled]):not([role="option"]),.cp-backdrop.is-open a[href],.cp-backdrop.is-open [tabindex]:not([tabindex="-1"]):not([role="option"])').evaluateAll((nodes) =>
    nodes.filter((node) => node.getClientRects().length > 0).map((node) => ({
      tag: node.tagName,
      id: node.id,
      cls: node.className,
      label: node.getAttribute('aria-label'),
    })),
  );
}

async function runCase(browserType, browserName, viewport, port, ordinal) {
  const browser = await browserType.launch({ headless: true });
  const page = await browser.newPage({ viewportSize: viewport });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  const url = `http://127.0.0.1:${port}/`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => window.GBSearch && window.GBSearch.__ready === true, null, { timeout: 30_000 });

  await page.evaluate(() => {
    const existing = document.getElementById('search-modal-contract-trigger');
    if (existing) existing.remove();
    const trigger = document.createElement('button');
    trigger.id = 'search-modal-contract-trigger';
    trigger.className = 'gb-nav-search-icon';
    trigger.type = 'button';
    trigger.setAttribute('aria-label', 'Открыть поиск');
    trigger.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-5-5"></path></svg>';
    trigger.addEventListener('click', () => window.GBSearch.open());
    document.body.appendChild(trigger);
    trigger.focus();
    trigger.click();
  });

  const modal = page.locator('.cp-backdrop.is-open');
  const input = page.locator('.cp-input');
  await modal.waitFor({ state: 'visible', timeout: 15_000 });
  await input.waitFor({ state: 'visible', timeout: 15_000 });

  const initial = await page.evaluate(() => {
    const input = document.querySelector('.cp-input');
    const dialog = document.querySelector('.cp-backdrop.is-open');
    const clear = dialog?.querySelector('.cp-clear');
    const close = dialog?.querySelector('.cp-close');
    return {
      dialogCount: document.querySelectorAll('.cp-backdrop.is-open[role="dialog"][aria-modal="true"]').length,
      inputRole: input?.getAttribute('role'),
      hasPopup: input?.getAttribute('aria-haspopup'),
      controls: input?.getAttribute('aria-controls'),
      expanded: input?.getAttribute('aria-expanded'),
      clearVisible: !!clear && clear.getClientRects().length > 0,
      closeVisible: !!close && close.getClientRects().length > 0,
      distinctControls: clear !== close,
      focusClass: document.activeElement?.className || '',
    };
  });
  assert.equal(initial.dialogCount, 1, `${browserName} ${viewport.width}: expected one modal`);
  assert.equal(initial.inputRole, 'combobox');
  assert.equal(initial.hasPopup, 'listbox');
  assert.equal(initial.controls, 'cp-listbox');
  assert.equal(initial.expanded, 'true');
  assert.equal(initial.closeVisible, true);
  assert.equal(initial.distinctControls, true);
  assert.match(initial.focusClass, /cp-input/);

  await input.fill('Нагорная');
  await page.waitForSelector('.cp-item[role="option"]', { timeout: 30_000 });
  await input.press('ArrowDown');

  const ariaState = await page.evaluate(() => {
    const input = document.querySelector('.cp-input');
    const options = [...document.querySelectorAll('.cp-item[role="option"]')];
    const ids = options.map((option) => option.id);
    const activeId = input?.getAttribute('aria-activedescendant') || '';
    return {
      activeId,
      ids,
      uniqueIds: new Set(ids).size,
      selected: options.filter((option) => option.getAttribute('aria-selected') === 'true').map((option) => option.id),
      activeExists: !!document.getElementById(activeId),
      activeRole: document.getElementById(activeId)?.getAttribute('role'),
      activeTag: document.getElementById(activeId)?.tagName,
      inputStillFocused: document.activeElement === input,
    };
  });
  assert.match(ariaState.activeId, /^cp-option-\d+$/);
  assert.equal(ariaState.ids.length, ariaState.uniqueIds, 'option IDs must be unique');
  assert.equal(ariaState.selected.length, 1, 'exactly one option must be selected');
  assert.equal(ariaState.selected[0], ariaState.activeId);
  assert.equal(ariaState.activeExists, true);
  assert.equal(ariaState.activeRole, 'option');
  assert.notEqual(ariaState.activeTag, 'BUTTON');
  assert.equal(ariaState.inputStillFocused, true);

  const focusables = await visibleFocusables(page);
  assert.ok(focusables.length >= 3, 'modal must expose multiple focusable controls');
  await page.evaluate(() => {
    const focusables = [...document.querySelectorAll('.cp-backdrop.is-open input:not([disabled]),.cp-backdrop.is-open button:not([disabled]):not([role="option"]),.cp-backdrop.is-open a[href],.cp-backdrop.is-open [tabindex]:not([tabindex="-1"]):not([role="option"])')].filter((node) => node.getClientRects().length > 0);
    focusables.at(-1)?.focus();
  });
  await page.keyboard.press('Tab');
  assert.equal(await input.evaluate((node) => document.activeElement === node), true, 'Tab from last control must wrap to combobox');
  await input.focus();
  await page.keyboard.press('Shift+Tab');
  const wrappedBackward = await page.evaluate(() => {
    const focusables = [...document.querySelectorAll('.cp-backdrop.is-open input:not([disabled]),.cp-backdrop.is-open button:not([disabled]):not([role="option"]),.cp-backdrop.is-open a[href],.cp-backdrop.is-open [tabindex]:not([tabindex="-1"]):not([role="option"])')].filter((node) => node.getClientRects().length > 0);
    return document.activeElement === focusables.at(-1);
  });
  assert.equal(wrappedBackward, true, 'Shift+Tab from first control must wrap to last');

  const geometry = await page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      const box = node?.getBoundingClientRect();
      return box ? { width: box.width, height: box.height } : null;
    };
    const chips = [...document.querySelectorAll('.cp-scope-chip')].map((node) => {
      const box = node.getBoundingClientRect();
      return { width: box.width, height: box.height };
    });
    const focusTarget = document.querySelector('.cp-scope-chip');
    focusTarget?.focus();
    const style = focusTarget ? getComputedStyle(focusTarget) : null;
    return {
      trigger: rect('#search-modal-contract-trigger'),
      chips,
      focusOutline: style?.outlineStyle,
      focusOutlineWidth: style?.outlineWidth,
      focusShadow: style?.boxShadow,
      viewportOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  assert.ok(geometry.trigger && geometry.trigger.width >= 44 && geometry.trigger.height >= 44, 'search trigger must be at least 44x44');
  assert.ok(geometry.chips.length >= 4 && geometry.chips.every((chip) => chip.height >= 44), 'all scope chips must be at least 44px tall');
  assert.ok(geometry.focusOutline !== 'none' || geometry.focusShadow !== 'none', 'scope chip must expose focus-visible styling');
  assert.ok(geometry.viewportOverflow <= 1, `horizontal overflow: ${geometry.viewportOverflow}`);

  const layer = await page.evaluate(() => {
    const blocker = document.createElement('div');
    blocker.id = 'search-modal-contract-high-layer';
    blocker.style.cssText = 'position:fixed;inset:0;z-index:2147482500;background:rgba(255,0,0,.01);pointer-events:auto';
    document.body.appendChild(blocker);
    const dialog = document.querySelector('.cp-backdrop.is-open');
    const box = document.querySelector('.cp-box');
    const rect = box.getBoundingClientRect();
    const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + 20);
    return {
      modalZ: Number.parseInt(getComputedStyle(dialog).zIndex, 10),
      blockerZ: Number.parseInt(getComputedStyle(blocker).zIndex, 10),
      topInsideModal: !!top?.closest('.cp-backdrop.is-open'),
    };
  });
  assert.ok(layer.modalZ > layer.blockerZ, `modal z-index ${layer.modalZ} must exceed ${layer.blockerZ}`);
  assert.equal(layer.topInsideModal, true, 'modal must remain topmost over known floating layers');
  await page.evaluate(() => document.getElementById('search-modal-contract-high-layer')?.remove());

  const closeButton = page.locator('.cp-close');
  await closeButton.focus();
  const closeFocus = await closeButton.evaluate((node) => {
    const style = getComputedStyle(node);
    return { outline: style.outlineStyle, width: style.outlineWidth, shadow: style.boxShadow };
  });
  assert.ok(closeFocus.outline !== 'none' || closeFocus.shadow !== 'none', 'close button must expose focus-visible styling');
  await closeButton.click();
  await page.waitForFunction(() => !document.querySelector('.cp-backdrop')?.classList.contains('is-open'));
  assert.equal(await input.getAttribute('aria-expanded'), 'false');
  assert.equal(await input.getAttribute('aria-activedescendant'), null);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'search-modal-contract-trigger');

  await page.evaluate(() => {
    document.getElementById('search-modal-contract-trigger')?.focus();
    window.GBSearch.open();
  });
  await modal.waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.cp-backdrop')?.classList.contains('is-open'));
  assert.equal(await input.getAttribute('aria-expanded'), 'false');

  await page.evaluate(() => window.GBSearch.open());
  await modal.waitFor({ state: 'visible' });
  await page.locator('.cp-dim').click({ position: { x: 2, y: 2 } });
  await page.waitForFunction(() => !document.querySelector('.cp-backdrop')?.classList.contains('is-open'));

  assert.deepEqual(pageErrors, [], `${browserName} page errors`);
  assert.deepEqual(consoleErrors, [], `${browserName} console errors`);

  const screenshotPath = path.join(reportDir, `${ordinal}-${browserName}-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await browser.close();

  return {
    browser: browserName,
    viewport,
    initial,
    ariaState: {
      activeId: ariaState.activeId,
      optionCount: ariaState.ids.length,
      selected: ariaState.selected,
    },
    focusableCount: focusables.length,
    geometry,
    layer,
    pageErrors,
    consoleErrors,
  };
}

sourceContract();
assert.ok(fs.existsSync(path.join(dist, 'index.html')), `missing dist/index.html: ${dist}`);
fs.mkdirSync(reportDir, { recursive: true });

const server = createServer(dist);
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
const port = typeof address === 'object' && address ? address.port : 0;
assert.ok(port > 0, 'failed to bind static server');

const cases = [
  [chromium, 'chromium', { width: 1440, height: 900 }],
  [chromium, 'chromium', { width: 390, height: 844 }],
  [webkit, 'webkit', { width: 1440, height: 900 }],
  [webkit, 'webkit', { width: 390, height: 844 }],
];

const results = [];
try {
  for (let index = 0; index < cases.length; index += 1) {
    const [browserType, browserName, viewport] = cases[index];
    results.push(await runCase(browserType, browserName, viewport, port, index + 1));
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

const report = {
  schemaVersion: 1,
  source: {
    js: 'js/search.js',
    css: 'css/command-palette.css',
  },
  assertions: {
    comboboxListbox: true,
    stableActiveDescendant: true,
    distinctCloseControl: true,
    dialogWideFocusTrap: true,
    topLayerAboveKnownFloatingLayers: true,
    touchTargets44px: true,
    focusVisible: true,
    chromiumWebkitDesktopMobile: true,
  },
  results,
};
fs.writeFileSync(path.join(reportDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(
  path.join(reportDir, 'report.md'),
  [
    '# Search modal contract',
    '',
    `- Cases: ${results.length}`,
    '- Engines: Chromium, WebKit',
    '- Viewports: 1440x900, 390x844',
    '- Result: PASS',
    '- Coverage: combobox/listbox ARIA, active descendant, close control, full modal Tab trap, top-layer ordering, 44px targets, focus-visible, focus restoration, Escape/backdrop closure.',
    '',
  ].join('\n'),
);
console.log(`SEARCH MODAL CONTRACT: PASS (${results.length}/${results.length})`);
