#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const playwright = require('playwright');

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:8090';
const BROWSER_NAME = process.env.MAP_PANEL_BROWSER || 'chromium';
const ROUTES = (process.env.MAP_PANEL_ROUTES || 'ishod,maccabim')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const VIEWPORTS = [
  { width: 320, height: 568, id: 'iphone-320' },
  { width: 390, height: 844, id: 'mobile-390' },
];
const EVIDENCE = process.env.MAP_PANEL_EVIDENCE || '/tmp/map-panel-evidence';
const browserType = playwright[BROWSER_NAME];

if (!browserType) {
  throw new Error(`Unsupported MAP_PANEL_BROWSER=${BROWSER_NAME}`);
}

fs.mkdirSync(EVIDENCE, { recursive: true });

function assert(condition, message, details = {}) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

async function panelSnapshot(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('.me-panel.me-panel--open');
    const content = panel?.querySelector('.me-content');
    const head = panel?.querySelector('.me-panel__head');
    const close = panel?.querySelector('.me-panel__close');
    const tabs = panel?.querySelector('.me-tabs');
    const nav = panel?.querySelector('.me-nav');
    const rect = (node) => {
      if (!node) return null;
      const value = node.getBoundingClientRect();
      return {
        top: value.top,
        right: value.right,
        bottom: value.bottom,
        left: value.left,
        width: value.width,
        height: value.height,
      };
    };
    const panelStyle = panel ? getComputedStyle(panel) : null;
    const contentStyle = content ? getComputedStyle(content) : null;
    return {
      viewport: { width: innerWidth, height: innerHeight },
      panel: rect(panel),
      head: rect(head),
      close: rect(close),
      tabs: rect(tabs),
      content: rect(content),
      nav: rect(nav),
      maxHeight: panelStyle?.maxHeight || '',
      panelOverflow: panelStyle?.overflow || '',
      contentOverflowY: contentStyle?.overflowY || '',
      contentMinHeight: contentStyle?.minHeight || '',
      scrollHeight: content?.scrollHeight || 0,
      clientHeight: content?.clientHeight || 0,
      scrollTop: content?.scrollTop || 0,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

function assertBounded(snapshot, label, { requireScroll = false } = {}) {
  const { panel, head, close, tabs, content, nav, viewport } = snapshot;
  assert(panel, `${label}: open panel was not found`, snapshot);
  assert(panel.top >= -1, `${label}: panel escaped above viewport`, snapshot);
  assert(panel.bottom <= viewport.height + 1, `${label}: panel escaped below viewport`, snapshot);
  assert(panel.height <= viewport.height + 1, `${label}: panel height exceeds viewport`, snapshot);
  assert(snapshot.maxHeight && snapshot.maxHeight !== 'none', `${label}: panel max-height is not active`, snapshot);
  assert(snapshot.panelOverflow === 'hidden' || snapshot.panelOverflow === 'clip', `${label}: panel does not contain overflow`, snapshot);
  assert(['auto', 'scroll'].includes(snapshot.contentOverflowY), `${label}: content is not internally scrollable`, snapshot);
  assert(snapshot.contentMinHeight === '0px', `${label}: flex scroll child lacks min-height:0`, snapshot);
  assert(snapshot.documentOverflow <= 1, `${label}: page has horizontal overflow`, snapshot);

  for (const [name, rect] of [['head', head], ['close', close], ['tabs', tabs], ['content', content], ['nav', nav]]) {
    if (!rect) continue;
    assert(rect.top >= panel.top - 1, `${label}: ${name} starts above panel`, snapshot);
    assert(rect.bottom <= panel.bottom + 1, `${label}: ${name} extends below panel`, snapshot);
    assert(rect.top >= -1, `${label}: ${name} is outside viewport`, snapshot);
  }

  assert(close && close.width >= 44 && close.height >= 44, `${label}: close target is smaller than 44px`, snapshot);
  if (requireScroll) {
    assert(snapshot.scrollHeight > snapshot.clientHeight + 20, `${label}: long content did not overflow internally`, snapshot);
    assert(snapshot.scrollTop > 0, `${label}: internal content did not scroll`, snapshot);
  }
}

async function openPlace(page, id) {
  const opened = await page.evaluate((placeId) => {
    const marker = document.querySelector(`[data-place-id="${CSS.escape(placeId)}"]`);
    if (!marker) return false;
    marker.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  }, id);
  assert(opened, `marker ${id} is missing`);
  await page.waitForFunction(() => document.querySelector('.me-panel')?.classList.contains('me-panel--open'), null, { timeout: 5000 });
  await page.waitForFunction(() => {
    const panel = document.querySelector('.me-panel.me-panel--open');
    if (!panel) return false;
    const rect = panel.getBoundingClientRect();
    return rect.bottom <= innerHeight + 1;
  }, null, { timeout: 2000 });
  await page.waitForTimeout(40);
}

async function waitForMapDom(page, route, viewport, runtimeErrors) {
  try {
    await page.waitForFunction(() => {
      const map = document.querySelector('.me-map');
      const panel = document.querySelector('.me-panel');
      const marker = document.querySelector('.me-map [data-place-id]');
      return Boolean(map && panel && marker);
    }, null, { timeout: 20000 });
  } catch (error) {
    const readiness = await page.evaluate(() => ({
      readyState: document.readyState,
      stageChildren: document.querySelector('#stage')?.childElementCount || 0,
      mapCount: document.querySelectorAll('.me-map').length,
      panelCount: document.querySelectorAll('.me-panel').length,
      markerCount: document.querySelectorAll('.me-map [data-place-id]').length,
      stageText: (document.querySelector('#stage')?.textContent || '').trim().slice(0, 300),
      scripts: [...document.scripts].map((script) => script.src || '[inline]').slice(-8),
    }));
    const screenshot = path.join(EVIDENCE, `${BROWSER_NAME}-${route}-${viewport.id}-readiness-failure.png`);
    await page.screenshot({ path: screenshot, fullPage: false }).catch(() => {});
    error.details = { readiness, runtimeErrors: [...runtimeErrors] };
    throw error;
  }
}

async function runScenario(browser, route, viewport) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  await context.route('**/*', async (requestRoute) => {
    const url = new URL(requestRoute.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') await requestRoute.continue();
    else await requestRoute.abort();
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/Failed to load resource|ERR_FAILED|ERR_BLOCKED_BY_CLIENT/.test(text)) return;
    runtimeErrors.push(`console: ${text}`);
  });

  const result = {
    browser: BROWSER_NAME,
    route,
    viewport,
    places: 0,
    worstTop: Infinity,
    worstHeight: 0,
    runtimeErrors,
  };

  try {
    await page.goto(`${BASE}/karty/${route}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForMapDom(page, route, viewport, runtimeErrors);
    await page.evaluate(() => {
      document.querySelector('.me-intro')?.remove();
      document.querySelector('.me-loading')?.remove();
    });

    const ids = await page.evaluate(() => [...new Set(
      [...document.querySelectorAll('.me-map [data-place-id]')]
        .map((node) => node.getAttribute('data-place-id'))
        .filter(Boolean)
    )]);
    assert(ids.length > 0, `${route}: no place markers found`);
    result.places = ids.length;

    for (const id of ids) {
      await openPlace(page, id);
      const snapshot = await panelSnapshot(page);
      assertBounded(snapshot, `${route}/${viewport.id}/${id}`);
      result.worstTop = Math.min(result.worstTop, snapshot.panel.top);
      result.worstHeight = Math.max(result.worstHeight, snapshot.panel.height);
    }

    await page.evaluate(() => {
      const content = document.querySelector('.me-panel.me-panel--open .me-content');
      if (!content) return;
      const probe = document.createElement('div');
      probe.setAttribute('data-map-panel-overflow-probe', '');
      probe.style.height = '1500px';
      probe.style.minHeight = '1500px';
      probe.style.pointerEvents = 'none';
      content.appendChild(probe);
      content.scrollTop = content.scrollHeight;
    });
    await page.waitForTimeout(120);
    const longSnapshot = await panelSnapshot(page);
    assertBounded(longSnapshot, `${route}/${viewport.id}/forced-long-content`, { requireScroll: true });

    const reducedHeight = Math.min(480, viewport.height - 40);
    await page.setViewportSize({ width: viewport.width, height: reducedHeight });
    await page.waitForTimeout(180);
    await page.evaluate(() => {
      const content = document.querySelector('.me-panel.me-panel--open .me-content');
      if (content) content.scrollTop = content.scrollHeight;
    });
    await page.waitForTimeout(80);
    const resizedSnapshot = await panelSnapshot(page);
    assertBounded(resizedSnapshot, `${route}/${viewport.id}/resized-${reducedHeight}`, { requireScroll: true });

    const screenshot = path.join(EVIDENCE, `${BROWSER_NAME}-${route}-${viewport.id}.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
    result.long = longSnapshot;
    result.resized = resizedSnapshot;

    assert(runtimeErrors.length === 0, `${route}/${viewport.id}: runtime errors detected`, { runtimeErrors });
    console.log(`PASS ${BROWSER_NAME} ${route} ${viewport.width}x${viewport.height}: places=${ids.length}, worstTop=${result.worstTop.toFixed(1)}, worstHeight=${result.worstHeight.toFixed(1)}, resized=${reducedHeight}`);
    return result;
  } finally {
    await context.close();
  }
}

(async () => {
  const launchOptions = {};
  if (BROWSER_NAME === 'chromium' && process.env.GB_PLAYWRIGHT_CHROMIUM && fs.existsSync(process.env.GB_PLAYWRIGHT_CHROMIUM)) {
    launchOptions.executablePath = process.env.GB_PLAYWRIGHT_CHROMIUM;
  }
  const browser = await browserType.launch(launchOptions);
  const results = [];
  const failures = [];
  try {
    for (const route of ROUTES) {
      for (const viewport of VIEWPORTS) {
        try {
          results.push(await runScenario(browser, route, viewport));
        } catch (error) {
          failures.push({
            browser: BROWSER_NAME,
            route,
            viewport,
            message: error.message,
            details: error.details || null,
            stack: error.stack,
          });
          console.error(`FAIL ${BROWSER_NAME} ${route} ${viewport.width}x${viewport.height}: ${error.message}`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  const report = { browser: BROWSER_NAME, base: BASE, results, failures };
  fs.writeFileSync(path.join(EVIDENCE, `${BROWSER_NAME}-report.json`), JSON.stringify(report, null, 2));
  if (failures.length) {
    console.error(JSON.stringify(failures, null, 2));
    process.exit(1);
  }
  console.log(`PASS map panel viewport contract: ${results.length}/${ROUTES.length * VIEWPORTS.length} scenarios`);
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
