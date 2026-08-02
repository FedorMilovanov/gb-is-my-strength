#!/usr/bin/env node
/** Browser, interaction and no-JS witness for the Pihahiroth uncertainty projection. */
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const REPORTS = join(ROOT, 'reports', 'pihahiroth-uncertainty');
const ROUTE = '/karty/ishod/';
const EXPECTED_IDS = ['PH-CAND-NORTH', 'PH-CAND-BALLAH', 'PH-CAND-BITTER'];
const FORBIDDEN = ['Археологи нашли точное место перехода.', 'Рон Уайатт', 'Ron Wyatt', 'Нувейба', 'Nuweiba', 'точка привязана к маршрутной гипотезе'];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

function routeFile(pathname) {
  const clean = decodeURIComponent(pathname.split('?')[0]).replace(/^\/+/, '');
  if (!clean) return join(DIST, 'index.html');
  if (extname(clean)) return join(DIST, clean);
  return join(DIST, clean, 'index.html');
}

async function serve() {
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
      let file = routeFile(pathname);
      try {
        if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      } catch {}
      const body = await readFile(file);
      response.writeHead(200, {
        'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      response.end(body);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

const results = [];
const failures = [];
function check(profile, contract, condition, detail = '') {
  const row = { profile, contract, ok: Boolean(condition), detail: String(detail || '') };
  results.push(row);
  if (!condition) failures.push(row);
}

function errorDetail(error) {
  return error instanceof Error ? (error.stack || error.message) : String(error);
}

async function blockExternal(page, base) {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(base) || url.startsWith('data:') || url.startsWith('blob:')) route.continue();
    else route.abort();
  });
}

async function inspectEmptyLegacyContainer(page, selector) {
  const locator = page.locator(selector);
  const count = await locator.count();
  if (count === 0) return { count, empty: true, text: '', childElementCount: 0, dataAttributes: [] };
  const state = await locator.first().evaluate((node) => ({
    text: (node.textContent || '').trim(),
    childElementCount: node.childElementCount,
    dataAttributes: [...node.attributes]
      .filter((attribute) => attribute.name.startsWith('data-') && attribute.value.trim())
      .map((attribute) => `${attribute.name}=${attribute.value}`),
  }));
  return {
    count,
    ...state,
    empty: count === 1 && state.text === '' && state.childElementCount === 0 && state.dataAttributes.length === 0,
  };
}

async function inspectInteractive(browser, base, profile) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    isMobile: profile.mobile,
    hasTouch: profile.mobile,
    deviceScaleFactor: profile.mobile ? 2 : 1,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  try {
    page.on('console', (message) => {
      if (message.type() === 'error' && !/yandex|Failed to load resource|ERR_FAILED/i.test(message.text())) consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    await blockExternal(page, base);
    await page.goto(base + ROUTE, { waitUntil: 'domcontentloaded' });
    await page.locator('#stage[data-map-state="ready"]').waitFor({ state: 'attached', timeout: 20_000 });

    const stage = page.locator('#stage');
    check(profile.id, 'authority:id', await stage.getAttribute('data-pihahiroth-authority') === 'PRODUCT-ATLAS-PIHAHIROTH-UNCERTAINTY-2026-08-02');
    check(profile.id, 'authority:coordinate-status', await stage.getAttribute('data-pihahiroth-coordinate-status') === 'UNRESOLVED');
    check(profile.id, 'authority:corridor-count', await stage.getAttribute('data-pihahiroth-corridor-count') === '3');

    const corridors = page.locator('[data-pihahiroth-corridor]');
    const count = await corridors.count();
    check(profile.id, 'corridors:count', count === 3, `count=${count}`);
    const inspected = await corridors.evaluateAll((nodes) => nodes.map((node) => ({
      id: node.getAttribute('data-feature-id'),
      contractId: node.getAttribute('data-pihahiroth-corridor'),
      confidence: node.getAttribute('data-confidence'),
      status: node.getAttribute('data-status'),
      evidenceClass: node.getAttribute('data-evidence-class'),
      rights: node.getAttribute('data-rights'),
      sources: (node.getAttribute('data-source-ids') || '').split(/\s+/).filter(Boolean),
      length: typeof node.getTotalLength === 'function' ? node.getTotalLength() : 0,
      pointerEvents: getComputedStyle(node).pointerEvents,
      visibility: getComputedStyle(node).visibility,
      display: getComputedStyle(node).display,
      role: node.getAttribute('role'),
      tabIndex: node.getAttribute('tabindex'),
    })));
    check(profile.id, 'corridors:ids', JSON.stringify(inspected.map((item) => item.id)) === JSON.stringify(EXPECTED_IDS), JSON.stringify(inspected));
    check(profile.id, 'corridors:geometry', inspected.every((item) => item.length > 80), JSON.stringify(inspected.map((item) => item.length)));
    check(profile.id, 'corridors:interactive', inspected.every((item) => item.pointerEvents !== 'none' && item.visibility !== 'hidden' && item.display !== 'none' && item.role === 'button' && item.tabIndex === '0'));
    check(profile.id, 'corridors:rights', inspected.every((item) => item.rights === 'ORIGINAL_SCHEMATIC_GEOMETRY' && item.evidenceClass === 'A1_A3_SYNTHESIS'));
    check(profile.id, 'corridors:sources', inspected.every((item) => item.sources.length >= 5 && item.sources.every((id) => /^PH-S0[1-9]$/.test(id))));
    check(profile.id, 'corridors:confidence', inspected[0]?.confidence === 'LOW' && inspected.slice(1).every((item) => item.confidence === 'MODERATE_LOW'));

    const oldMarker = page.locator('[data-place-id="pihahiroth"]');
    const oldCount = await oldMarker.count();
    const oldDisplay = oldCount ? await oldMarker.first().evaluate((node) => getComputedStyle(node).display) : 'missing';
    check(profile.id, 'single-point:hidden', oldCount === 1 && oldDisplay === 'none', `count=${oldCount}; display=${oldDisplay}`);

    const signature = await inspectEmptyLegacyContainer(page, '#me-signature');
    check(profile.id, 'single-point:signature-removed', signature.empty, JSON.stringify(signature));
    const waypoints = await inspectEmptyLegacyContainer(page, '#me-waypoints');
    check(profile.id, 'single-point:waypoint-removed', waypoints.empty, JSON.stringify(waypoints));

    const beforeText = await page.locator('body').innerText();
    for (const forbidden of FORBIDDEN) check(profile.id, `forbidden:before:${forbidden}`, !beforeText.includes(forbidden));

    await corridors.nth(1).click({ timeout: 5_000 });
    await page.locator('.me-panel.me-panel--open').waitFor({ state: 'visible', timeout: 5_000 });
    const panelName = await page.locator('.me-panel__name').innerText();
    check(profile.id, 'panel:name', panelName.includes('Пи-Гахироф: коридоры неопределённости'), panelName);
    const panelHead = await page.locator('.me-panel__head').innerText();
    check(profile.id, 'panel:uncertainty-label', panelHead.includes('Точное место не установлено'));

    const disputeTab = page.locator('.me-tab').filter({ hasText: 'Дискуссия' }).first();
    check(profile.id, 'panel:dispute-tab-present', await disputeTab.count() === 1);
    if (await disputeTab.count()) await disputeTab.click();
    const panelText = await page.locator('.me-content').innerText();
    check(profile.id, 'panel:three-corridors', ['Северный прибрежный', 'Озёра Баллах', 'Тимсах / Горькие'].every((label) => panelText.includes(label)), panelText.slice(0, 600));
    check(profile.id, 'panel:no-certain-point', panelText.includes('ни одной доказанной точки') && panelText.includes('не ранжирует ни один коридор'));
    for (const forbidden of FORBIDDEN) check(profile.id, `forbidden:panel:${forbidden}`, !panelText.includes(forbidden));

    check(profile.id, 'runtime:no-console-errors', consoleErrors.length === 0, consoleErrors.join(' | '));
    await page.screenshot({ path: join(REPORTS, `${profile.id}.png`), fullPage: false });
  } catch (error) {
    try {
      await page.screenshot({ path: join(REPORTS, `${profile.id}-failure.png`), fullPage: false });
    } catch {}
    throw error;
  } finally {
    await context.close();
  }
}

async function inspectNoJs(browser, base) {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  try {
    await blockExternal(page, base);
    await page.goto(base + ROUTE, { waitUntil: 'domcontentloaded' });
    const fallback = page.locator('[data-pihahiroth-noscript]');
    check('no-js-mobile', 'fallback:present', await fallback.count() === 1);
    check('no-js-mobile', 'fallback:visible', await fallback.isVisible());
    const box = await fallback.boundingBox();
    check('no-js-mobile', 'fallback:viewport', Boolean(box && box.width > 250 && box.height > 200 && box.x >= 0 && box.y >= 0), JSON.stringify(box));
    const text = await fallback.innerText();
    check('no-js-mobile', 'fallback:uncertainty', text.includes('точное место не установлено') && text.includes('не найденная точка'));
    check('no-js-mobile', 'fallback:corridors', ['Северный прибрежный', 'Озёра Баллах', 'Озеро Тимсах'].every((label) => text.includes(label)), text);
    for (const forbidden of FORBIDDEN) check('no-js-mobile', `fallback:forbidden:${forbidden}`, !text.includes(forbidden));
    await page.screenshot({ path: join(REPORTS, 'no-js-mobile.png'), fullPage: false });
  } catch (error) {
    try {
      await page.screenshot({ path: join(REPORTS, 'no-js-mobile-failure.png'), fullPage: false });
    } catch {}
    throw error;
  } finally {
    await context.close();
  }
}

await mkdir(REPORTS, { recursive: true });
let server;
let browser;
let base;
try {
  if (!existsSync(DIST)) throw new Error('dist missing; run production-like build first');
  ({ server, base } = await serve());
  browser = await chromium.launch();
  const profiles = [
    {
      id: 'desktop-1440',
      run: () => inspectInteractive(browser, base, { id: 'desktop-1440', viewport: { width: 1440, height: 900 }, mobile: false }),
    },
    {
      id: 'mobile-390',
      run: () => inspectInteractive(browser, base, { id: 'mobile-390', viewport: { width: 390, height: 844 }, mobile: true }),
    },
    { id: 'no-js-mobile', run: () => inspectNoJs(browser, base) },
  ];
  for (const profile of profiles) {
    try {
      await profile.run();
    } catch (error) {
      check(profile.id, 'execution:completed', false, errorDetail(error));
    }
  }
} catch (error) {
  check('harness', 'execution:setup', false, errorDetail(error));
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
}

const report = {
  authorityId: 'PRODUCT-ATLAS-PIHAHIROTH-UNCERTAINTY-2026-08-02',
  route: ROUTE,
  generatedAt: new Date().toISOString(),
  results,
  failures,
};
await writeFile(join(REPORTS, 'browser-contract.json'), JSON.stringify(report, null, 2) + '\n');

if (failures.length) {
  console.error(`❌ Pihahiroth browser contract failed (${failures.length})`);
  for (const failure of failures) console.error(`  - ${failure.profile} :: ${failure.contract} :: ${failure.detail}`);
  process.exit(1);
}
console.log(`✅ Pihahiroth browser contract passed (${results.length} checks; desktop, mobile, no-JS)`);
