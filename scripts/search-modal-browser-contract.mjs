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
const reportDir = path.resolve(String(options.report || 'reports/search-modal-contract'));
const jsSource = fs.readFileSync(path.resolve('js/search.js'), 'utf8');
const cssSource = fs.readFileSync(path.resolve('css/command-palette.css'), 'utf8');

function validateSource() {
  for (const marker of [
    'role="combobox"',
    'aria-haspopup="listbox"',
    'aria-expanded="false"',
    'aria-activedescendant',
    'class="cp-close"',
    'id="cp-option-\'+t+\'"',
    'Close.addEventListener("click",re)',
    'k.addEventListener("keydown",function(e){if("Tab"!==e.key',
  ]) assert.ok(jsSource.includes(marker), `missing JS marker: ${marker}`);

  assert.ok(!jsSource.includes(`return'<button class="cp-item"`), 'button/option hybrid survived');
  assert.ok(!jsSource.includes(`[role="option"]');if(!i.length)break`), 'input-only Tab trap survived');

  for (const marker of [
    'z-index:2147483000',
    '.cp-clear,.cp-close{',
    'min-height:44px',
    '.cp-scope-chip:focus-visible',
    '.cp-preview-btn:focus-visible',
    '.gb-nav-search-icon:focus-visible',
  ]) assert.ok(cssSource.includes(marker), `missing CSS marker: ${marker}`);

  assert.ok(!cssSource.includes('z-index:var(--z-modal,10000)'), 'weak modal layer survived');
  assert.ok(!cssSource.includes('min-height:32px'), '32px scope target survived');
  assert.match(cssSource, /\.gb-nav-search-icon\{[^}]*width:44px;[^}]*height:44px;/, '44px search trigger missing');
  for (const marker of ['id=\"cp-more-wrap\"', 'class=\"cp-more\"', 'Показано ']) assert.ok(jsSource.includes(marker), 'missing continuation JS marker: ' + marker);
  assert.ok(!jsSource.includes('i.results.slice(0,10)'), 'Pagefind pre-hydration cap survived');
  for (const marker of ['.cp-more-wrap:empty', '.cp-more:focus-visible']) assert.ok(cssSource.includes(marker), 'missing continuation CSS marker: ' + marker);
}

function mime(file) {
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

const focusableSelector = [
  '.cp-backdrop.is-open input:not([disabled])',
  '.cp-backdrop.is-open button:not([disabled]):not([role="option"])',
  '.cp-backdrop.is-open a[href]',
  '.cp-backdrop.is-open [tabindex]:not([tabindex="-1"]):not([role="option"])',
].join(',');

async function runCase(browserType, browserName, viewport, port, ordinal) {
  const browser = await browserType.launch({ headless: true });
  const page = await browser.newPage({ viewportSize: viewport });
  const consoleErrors = [];
  const engineWarnings = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    const expectedWebKitViewportWarning =
      text === 'Viewport argument key "interactive-widget" not recognized and ignored.';
    if (browserName === 'webkit' && expectedWebKitViewportWarning) {
      engineWarnings.push(text);
      return;
    }
    consoleErrors.push(text);
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.evaluate(() => {
      document.getElementById('search-modal-contract-trigger')?.remove();
      const trigger = document.createElement('button');
      trigger.id = 'search-modal-contract-trigger';
      trigger.className = 'gb-nav-search-icon';
      trigger.type = 'button';
      trigger.setAttribute('aria-label', 'Открыть поиск');
      trigger.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-5-5"></path></svg>';
      trigger.addEventListener('click', () => window.dispatchEvent(new CustomEvent('gb:openSearch')));
      document.body.appendChild(trigger);
      trigger.focus();
      trigger.click();
    });
    await page.waitForFunction(
      () => window.GBSearch?.__ready === true && document.querySelector('.cp-backdrop')?.classList.contains('is-open'),
      null,
      { timeout: 30_000 },
    );

    const modal = page.locator('.cp-backdrop.is-open');
    const input = page.locator('.cp-input');
    await modal.waitFor({ state: 'visible', timeout: 15_000 });
    await input.waitFor({ state: 'visible', timeout: 15_000 });

    const initial = await page.evaluate(() => {
      const field = document.querySelector('.cp-input');
      const dialog = document.querySelector('.cp-backdrop.is-open');
      const clear = dialog?.querySelector('.cp-clear');
      const close = dialog?.querySelector('.cp-close');
      return {
        dialogCount: document.querySelectorAll('.cp-backdrop.is-open[role="dialog"][aria-modal="true"]').length,
        role: field?.getAttribute('role'),
        popup: field?.getAttribute('aria-haspopup'),
        controls: field?.getAttribute('aria-controls'),
        expanded: field?.getAttribute('aria-expanded'),
        closeVisible: !!close && close.getClientRects().length > 0,
        controlsDistinct: clear !== close,
        focusedInput: document.activeElement === field,
      };
    });
    assert.deepEqual(initial, {
      dialogCount: 1,
      role: 'combobox',
      popup: 'listbox',
      controls: 'cp-listbox',
      expanded: 'true',
      closeVisible: true,
      controlsDistinct: true,
      focusedInput: true,
    });

    await input.fill('Нагорная');
    await page.waitForSelector('.cp-item[role="option"]', { timeout: 30_000 });
    await input.press('ArrowDown');

    const aria = await page.evaluate(() => {
      const field = document.querySelector('.cp-input');
      const options = [...document.querySelectorAll('.cp-item[role="option"]')];
      const ids = options.map((option) => option.id);
      const activeId = field?.getAttribute('aria-activedescendant') || '';
      const active = document.getElementById(activeId);
      return {
        activeId,
        optionCount: options.length,
        uniqueCount: new Set(ids).size,
        selectedIds: options.filter((option) => option.getAttribute('aria-selected') === 'true').map((option) => option.id),
        activeRole: active?.getAttribute('role'),
        activeTag: active?.tagName,
        focusedInput: document.activeElement === field,
      };
    });
    assert.match(aria.activeId, /^cp-option-\d+$/);
    assert.ok(aria.optionCount > 0);
    assert.equal(aria.uniqueCount, aria.optionCount);
    assert.deepEqual(aria.selectedIds, [aria.activeId]);
    assert.equal(aria.activeRole, 'option');
    assert.notEqual(aria.activeTag, 'BUTTON');
    assert.equal(aria.focusedInput, true);

    const focusableCount = await page.locator(focusableSelector).evaluateAll((nodes) =>
      nodes.filter((node) => node.getClientRects().length > 0).length,
    );
    assert.ok(focusableCount >= 3, 'modal must contain multiple focusable controls');

    await page.evaluate((selector) => {
      const nodes = [...document.querySelectorAll(selector)].filter((node) => node.getClientRects().length > 0);
      nodes.at(-1)?.focus();
    }, focusableSelector);
    await page.keyboard.press('Tab');
    assert.equal(await input.evaluate((node) => document.activeElement === node), true, 'forward Tab must wrap');

    await input.focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate((selector) => {
      const nodes = [...document.querySelectorAll(selector)].filter((node) => node.getClientRects().length > 0);
      return document.activeElement === nodes.at(-1);
    }, focusableSelector), true, 'reverse Tab must wrap');

    const geometry = await page.evaluate(() => {
      const rect = (selector) => {
        const box = document.querySelector(selector)?.getBoundingClientRect();
        return box ? { width: box.width, height: box.height } : null;
      };
      const chips = [...document.querySelectorAll('.cp-scope-chip')].map((node) => {
        const box = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return {
          width: box.width,
          height: box.height,
          computedHeight: Number.parseFloat(style.height),
          computedMinHeight: Number.parseFloat(style.minHeight),
          boxSizing: style.boxSizing,
        };
      });
      const chip = document.querySelector('.cp-scope-chip');
      chip?.focus();
      const chipStyle = chip ? getComputedStyle(chip) : null;
      const chipCascade = [];
      const visitRules = (rules, href, context = []) => {
        for (const rule of rules) {
          if (rule.type === CSSRule.STYLE_RULE) {
            let matches = false;
            try { matches = Boolean(chip?.matches(rule.selectorText)); } catch {}
            if (matches && (rule.style.height || rule.style.minHeight || rule.style.minBlockSize)) {
              chipCascade.push({
                href,
                context,
                selector: rule.selectorText,
                height: rule.style.height || null,
                minHeight: rule.style.minHeight || null,
                minBlockSize: rule.style.minBlockSize || null,
                heightPriority: rule.style.getPropertyPriority('height') || null,
                minHeightPriority: rule.style.getPropertyPriority('min-height') || null,
                minBlockSizePriority: rule.style.getPropertyPriority('min-block-size') || null,
                cssText: rule.cssText,
              });
            }
            continue;
          }
          if (!('cssRules' in rule)) continue;
          if (rule.type === CSSRule.MEDIA_RULE && !matchMedia(rule.conditionText).matches) continue;
          const label = rule.conditionText || rule.name || rule.cssText.split('{', 1)[0].trim();
          visitRules(rule.cssRules, href, [...context, label]);
        }
      };
      for (const sheet of document.styleSheets) {
        try { visitRules(sheet.cssRules, sheet.href || 'inline'); } catch {}
      }
      return {
        trigger: rect('#search-modal-contract-trigger'),
        chips,
        chipCascade,
        outline: chipStyle?.outlineStyle,
        shadow: chipStyle?.boxShadow,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    assert.ok(geometry.trigger?.width >= 44 && geometry.trigger?.height >= 44, 'search trigger must be 44x44');
    assert.ok(
      geometry.chips.length >= 4 && geometry.chips.every((chip) =>
        chip.computedHeight === 44 &&
        chip.computedMinHeight === 44 &&
        chip.boxSizing === 'border-box' &&
        chip.height >= 43
      ),
      `scope chips must author exact 44px geometry with <=1px engine quantization: ${JSON.stringify({ chips: geometry.chips, chipCascade: geometry.chipCascade })}`,
    );
    assert.ok(geometry.outline !== 'none' || geometry.shadow !== 'none', 'scope chip focus style missing');
    assert.ok(geometry.overflow <= 1, `horizontal overflow: ${geometry.overflow}`);

    const layer = await page.evaluate(() => {
      const blocker = document.createElement('div');
      blocker.id = 'search-modal-contract-high-layer';
      blocker.style.cssText = 'position:fixed;inset:0;z-index:2147482500;background:rgba(255,0,0,.01);pointer-events:auto';
      document.body.appendChild(blocker);
      const dialog = document.querySelector('.cp-backdrop.is-open');
      const box = document.querySelector('.cp-box').getBoundingClientRect();
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + 20);
      return {
        modalZ: Number.parseInt(getComputedStyle(dialog).zIndex, 10),
        blockerZ: Number.parseInt(getComputedStyle(blocker).zIndex, 10),
        modalTopmost: !!top?.closest('.cp-backdrop.is-open'),
      };
    });
    assert.ok(layer.modalZ > layer.blockerZ);
    assert.equal(layer.modalTopmost, true);
    await page.evaluate(() => document.getElementById('search-modal-contract-high-layer')?.remove());

    const close = page.locator('.cp-close');
    await close.focus();
    const closeFocus = await close.evaluate((node) => {
      const style = getComputedStyle(node);
      return { outline: style.outlineStyle, shadow: style.boxShadow };
    });
    assert.ok(closeFocus.outline !== 'none' || closeFocus.shadow !== 'none', 'close focus style missing');
    await close.click();
    await page.waitForFunction(() => !document.querySelector('.cp-backdrop')?.classList.contains('is-open'));
    assert.equal(await input.getAttribute('aria-expanded'), 'false');
    assert.equal(await input.getAttribute('aria-activedescendant'), null);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'search-modal-contract-trigger');

    await page.evaluate(() => window.GBSearch.open());
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

    fs.mkdirSync(reportDir, { recursive: true });
    await page.screenshot({ path: path.join(reportDir, `${ordinal}-${browserName}-${viewport.width}x${viewport.height}.png`), fullPage: true });

    return { browser: browserName, viewport, aria, focusableCount, geometry, layer, engineWarnings };
  } catch (error) {
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(
      path.join(reportDir, `failure-${ordinal}-${browserName}-${viewport.width}x${viewport.height}.json`),
      `${JSON.stringify({
        browser: browserName,
        viewport,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
        consoleErrors,
        engineWarnings,
        pageErrors,
      }, null, 2)}\n`,
    );
    throw error;
  } finally {
    await browser.close();
  }
}

validateSource();
assert.ok(fs.existsSync(path.join(dist, 'index.html')), `missing dist/index.html: ${dist}`);
fs.mkdirSync(reportDir, { recursive: true });
const server = staticServer(dist);
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
const port = typeof address === 'object' && address ? address.port : 0;
assert.ok(port > 0, 'failed to bind static server');


async function runContinuationContract(browserType, browserName, port) {
  const browser = await browserType.launch({ headless: true });
  const summary = { browser: browserName, pagefind: null, fallback: null, scripture: null };

  async function openFixture(configure) {
    const context = await browser.newContext({ viewport: { width: 960, height: 760 } });
    const page = await context.newPage();
    if (configure) await configure(page);
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => window.GBSearch && typeof window.GBSearch.open === 'function');
    await page.evaluate(() => window.GBSearch.open());
    await page.waitForFunction(
      () => window.GBSearch?.__ready === true && document.querySelector('.cp-backdrop')?.classList.contains('is-open'),
      null,
      { timeout: 30_000 },
    );
    return { context, page, input: page.locator('.cp-input') };
  }

  async function assertPaged(page, total, label) {
    await page.waitForFunction(({ total, label }) => {
      const status = document.getElementById('cp-status')?.textContent || '';
      return document.querySelectorAll('.cp-item[role="option"]').length === 12 &&
        status === 'Показано 12 из ' + total + ' ' + label &&
        !!document.querySelector('#cp-more-wrap > .cp-more');
    }, { total, label }, { timeout: 30_000 });
    assert.equal(await page.locator('#cp-listbox .cp-more').count(), 0, 'continuation button must stay outside listbox');
    await page.locator('#cp-more-wrap > .cp-more').click();
    await page.waitForFunction(({ total, label }) => {
      const status = document.getElementById('cp-status')?.textContent || '';
      return document.querySelectorAll('.cp-item[role="option"]').length === total &&
        status === String(total) + ' ' + label &&
        !document.querySelector('#cp-more-wrap > .cp-more');
    }, { total, label }, { timeout: 30_000 });
    const ids = await page.locator('.cp-item[role="option"]').evaluateAll((nodes) => nodes.map((node) => node.id));
    assert.equal(new Set(ids).size, total, 'continued options must keep unique ids');
    return { initial: 12, total };
  }

  try {
    {
      const { context, page, input } = await openFixture();
      await page.evaluate(() => {
        const urls = Array.from({ length: 16 }, (_, index) => index < 2 ? '/fixture/pagefind-duplicate/' : '/fixture/pagefind-' + index + '/');
        window.__pagefind__ = {
          search: async () => ({
            results: urls.map((url, index) => ({
              data: async () => ({
                url,
                meta: { title: 'Fixture Pagefind ' + index, author: '', readTime: '1', category: 'Fixture', scripture: '' },
                excerpt: 'Fixture Pagefind excerpt ' + index,
              }),
            })),
          }),
        };
        window.__pagefindReady__ = true;
        window.__pagefindFailed__ = false;
      });
      await input.fill('fixture-pagefind');
      summary.pagefind = await assertPaged(page, 15, 'рез.');
      await context.close();
    }

    {
      const manifest = {
        items: Array.from({ length: 16 }, (_, index) => ({
          id: 'fallback-' + index,
          type: 'article',
          url: '/fixture/fallback-' + index + '/',
          title: 'fixturefallback ' + index,
          description: 'fixturefallback material ' + index,
          section: 'Fixture',
          author: 'Fixture Author',
          priority: 100 - index,
          tags: ['fixturefallback'],
        })),
      };
      const { context, page, input } = await openFixture(async (fixturePage) => {
        await fixturePage.route('**/pagefind/pagefind.js', async (route) => {
          await route.fulfill({ status: 404, contentType: 'text/plain', body: 'missing in fallback fixture' });
        });
        await fixturePage.route('**/data/search-manifest.json', async (route) => {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(manifest) });
        });
      });
      await input.fill('fixturefallback');
      summary.fallback = await assertPaged(page, 16, 'рез.');
      await context.close();
    }

    {
      const scriptureIndex = {
        schemaVersion: 1,
        references: [{
          id: 'jer-17-9-fixture',
          label: 'Иер 17:9',
          occurrences: Array.from({ length: 15 }, (_, index) => ({
            url: '/fixture/scripture-' + index + '/',
            anchor: 'fixture-' + index,
            title: 'Fixture Scripture ' + index,
            context: 'Fixture context ' + index,
            topics: ['fixture'],
          })),
        }],
      };
      const { context, page, input } = await openFixture(async (fixturePage) => {
        await fixturePage.route('**/data/scripture-search-index.json', async (route) => {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(scriptureIndex) });
        });
      });
      await page.locator('[data-scope="scripture"]').click();
      await input.fill('Иер 17:9');
      summary.scripture = await assertPaged(page, 15, 'вх.');
      await context.close();
    }

    return { continuation: summary };
  } finally {
    await browser.close();
  }
}

const matrix = [
  [chromium, 'chromium', { width: 1440, height: 900 }],
  [chromium, 'chromium', { width: 390, height: 844 }],
  [webkit, 'webkit', { width: 1440, height: 900 }],
  [webkit, 'webkit', { width: 390, height: 844 }],
];
const results = [];
try {
  for (let index = 0; index < matrix.length; index += 1) {
    const [browserType, browserName, viewport] = matrix[index];
    results.push(await runCase(browserType, browserName, viewport, port, index + 1));
  }
  results.push(await runContinuationContract(chromium, 'chromium', port));
  results.push(await runContinuationContract(webkit, 'webkit', port));
} finally {
  await new Promise((resolve) => server.close(resolve));
}

const report = {
  schemaVersion: 1,
  source: { js: 'js/search.js', css: 'css/command-palette.css' },
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
fs.writeFileSync(path.join(reportDir, 'report.md'), [
  '# Search modal contract',
  '',
  `- Cases: ${results.length}`,
  '- Engines: Chromium, WebKit',
  '- Viewports: 1440x900, 390x844',
  '- Result: PASS',
  '- Coverage: combobox/listbox ARIA, active descendant, close control, full modal Tab trap, top-layer ordering, 44px targets, focus-visible, focus restoration, Escape/backdrop closure.',
  '',
].join('\n'));
console.log(`SEARCH MODAL CONTRACT: PASS (${results.length}/${results.length})`);
