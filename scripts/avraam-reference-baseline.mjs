#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE_URL = process.env.AUDIT_BASE || 'http://127.0.0.1:8090';
const OUT_ROOT = path.resolve(process.env.AVRAAM_BASELINE_OUT || 'reports/atlas/avraam-reference-baseline');
const HEAD_SHA = process.env.GITHUB_SHA || process.env.HEAD_SHA || 'local';
const RUN_ID = process.env.GITHUB_RUN_ID || 'local';
const ROUTE_URL = `${BASE_URL}/karty/avraam/`;

const VIEWPORTS = [
  { id: 'desktop-1920x1080', width: 1920, height: 1080, deviceScaleFactor: 1 },
  { id: 'desktop-1440x900', width: 1440, height: 900, deviceScaleFactor: 1 },
  { id: 'desktop-1366x768', width: 1366, height: 768, deviceScaleFactor: 1 },
  { id: 'tablet-1024x768', width: 1024, height: 768, deviceScaleFactor: 1 },
  { id: 'mobile-430x932', width: 430, height: 932, deviceScaleFactor: 1 },
  { id: 'mobile-390x844', width: 390, height: 844, deviceScaleFactor: 1 },
  { id: 'mobile-360x800', width: 360, height: 800, deviceScaleFactor: 1 },
];

const KEY_PLACES = [
  'ur',
  'harran',
  'shechem',
  'bethel',
  'egypt',
  'hebron',
  'sodom',
  'dan',
  'beersheba',
  'salem',
];

const mkdir = (dir) => fs.mkdirSync(dir, { recursive: true });
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const safeName = (value) => String(value || 'unknown').trim().toLowerCase().replace(/[^a-z0-9а-яё_-]+/giu, '-').replace(/^-+|-+$/g, '');
const round = (value) => Number.isFinite(value) ? Math.round(value * 100) / 100 : value;

function intersectArea(a, b) {
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return x * y;
}

async function waitForMap(page) {
  await page.goto(ROUTE_URL, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForFunction(() => {
    const stage = document.querySelector('[data-map-stage]');
    const map = document.querySelector('.me-map,#mapRoot');
    const svg = document.querySelector('.me-canvas svg,.me-map svg,#mapRoot svg');
    const state = stage?.getAttribute('data-map-state');
    return Boolean(map && svg && (state === 'ready' || !stage));
  }, { timeout: 60_000 });
  await page.addStyleTag({ content: `
    *,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;caret-color:transparent!important}
    html{scroll-behavior:auto!important}
  ` });
  await page.waitForTimeout(400);
}

async function collectGeometry(page, viewportId) {
  return page.evaluate(({ viewportId }) => {
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      };
    };
    const visible = (el) => {
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return !el.hidden && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.02 && r.width > 0.5 && r.height > 0.5;
    };
    const describe = (el) => ({
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      className: typeof el.className === 'string' ? el.className : el.className?.baseVal || null,
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
      placeId: el.getAttribute('data-place-id'),
      story: el.getAttribute('data-story'),
      tab: el.getAttribute('data-tab'),
      ariaLabel: el.getAttribute('aria-label'),
    });

    const width = innerWidth;
    const height = innerHeight;
    const html = document.documentElement;
    const map = document.querySelector('.me-map,#mapRoot');
    const svg = document.querySelector('.me-canvas svg,.me-map svg,#mapRoot svg');
    const allText = [...document.querySelectorAll('svg text')].filter(visible);
    const labels = allText.map((el, index) => ({ index, ...describe(el), box: rect(el) }));
    const offscreen = labels.filter(({ box }) => box.left < -1 || box.top < -1 || box.right > width + 1 || box.bottom > height + 1);

    const overlaps = [];
    for (let i = 0; i < labels.length; i += 1) {
      for (let j = i + 1; j < labels.length; j += 1) {
        const a = labels[i];
        const b = labels[j];
        const area = Math.max(0, Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left)) *
          Math.max(0, Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top));
        if (area >= 8) overlaps.push({ a: { index: a.index, text: a.text, box: a.box }, b: { index: b.index, text: b.text, box: b.box }, area });
      }
    }

    const controls = [...document.querySelectorAll('button,a,[role="button"],[tabindex]:not([tabindex="-1"])')]
      .filter(visible)
      .map((el) => ({ ...describe(el), box: rect(el) }));
    const undersizedControls = controls.filter(({ box }) => box.width < 44 || box.height < 44);
    const controlOffscreen = controls.filter(({ box }) => box.left < -1 || box.top < -1 || box.right > width + 1 || box.bottom > height + 1);

    const markers = [...document.querySelectorAll('[data-place-id]')].filter(visible).map((el) => ({ ...describe(el), box: rect(el) }));
    const routes = [...document.querySelectorAll('.me-route-main,.me-route-underlay,[data-route-segment]')].filter(visible).map((el) => {
      let bbox = null;
      try {
        const b = el.getBBox();
        bbox = { x: b.x, y: b.y, width: b.width, height: b.height };
      } catch {}
      return { ...describe(el), screenBox: rect(el), svgBox: bbox };
    });

    const mapBox = map ? rect(map) : null;
    const svgBox = svg ? rect(svg) : null;
    const viewBox = svg?.getAttribute('viewBox') || null;

    return {
      viewportId,
      url: location.href,
      title: document.title,
      viewport: { width, height, devicePixelRatio },
      document: {
        clientWidth: html.clientWidth,
        scrollWidth: html.scrollWidth,
        horizontalOverflow: html.scrollWidth - html.clientWidth,
        clientHeight: html.clientHeight,
        scrollHeight: html.scrollHeight,
      },
      map: { box: mapBox, svgBox, viewBox },
      counts: {
        labels: labels.length,
        markers: markers.length,
        controls: controls.length,
        routes: routes.length,
        offscreenLabels: offscreen.length,
        labelOverlaps: overlaps.length,
        undersizedControls: undersizedControls.length,
        offscreenControls: controlOffscreen.length,
      },
      offscreenLabels: offscreen.slice(0, 100),
      labelOverlaps: overlaps.sort((a, b) => b.area - a.area).slice(0, 150),
      undersizedControls: undersizedControls.slice(0, 100),
      offscreenControls: controlOffscreen.slice(0, 100),
      markers,
      routes,
    };
  }, { viewportId });
}

async function captureState(page, outDir, fileName, options = {}) {
  const target = options.targetSelector ? page.locator(options.targetSelector).first() : null;
  if (target && await target.count()) {
    await target.screenshot({ path: path.join(outDir, fileName), animations: 'disabled' });
    return;
  }
  await page.screenshot({ path: path.join(outDir, fileName), fullPage: Boolean(options.fullPage), animations: 'disabled' });
}

async function clickAndSettle(locator, delay = 500) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.click({ timeout: 10_000, force: true });
  await locator.page().waitForTimeout(delay);
}

async function runViewport(browser, viewport) {
  const dir = path.join(OUT_ROOT, viewport.id);
  mkdir(dir);
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor,
    reducedMotion: 'reduce',
    colorScheme: 'light',
  });
  const page = await context.newPage();
  const consoleEvents = [];
  const failedRequests = [];
  page.on('console', (message) => consoleEvents.push({ type: message.type(), text: message.text().slice(0, 1000) }));
  page.on('pageerror', (error) => consoleEvents.push({ type: 'pageerror', text: error.message.slice(0, 1000) }));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), method: request.method(), error: request.failure()?.errorText || 'unknown' }));

  const result = {
    viewport,
    route: ROUTE_URL,
    initial: null,
    stories: [],
    places: [],
    tabs: [],
    keyboard: {},
    consoleEvents,
    failedRequests,
    fatal: null,
  };

  try {
    await waitForMap(page);
    await captureState(page, dir, '00-initial.png');
    result.initial = await collectGeometry(page, viewport.id);

    const storyChips = page.locator('.me-story-chip');
    const storyCount = await storyChips.count();
    for (let i = 0; i < storyCount; i += 1) {
      const chip = storyChips.nth(i);
      const label = (await chip.textContent() || `story-${i + 1}`).replace(/\s+/g, ' ').trim();
      const id = safeName(await chip.getAttribute('data-story') || label || `story-${i + 1}`);
      try {
        await clickAndSettle(chip, 900);
        const active = await chip.getAttribute('aria-pressed') || await chip.getAttribute('aria-selected') || String(await chip.evaluate((el) => el.classList.contains('me-story-chip--active')));
        const file = `story-${String(i + 1).padStart(2, '0')}-${id}.png`;
        await captureState(page, dir, file);
        const geometry = await collectGeometry(page, `${viewport.id}:${id}`);
        result.stories.push({ id, label, active, file, geometry });
      } catch (error) {
        result.stories.push({ id, label, error: error.message });
      }
    }

    const allStory = page.locator('.me-story-chip').first();
    if (await allStory.count()) await clickAndSettle(allStory, 500).catch(() => {});

    for (const placeId of KEY_PLACES) {
      const marker = page.locator(`[data-place-id="${placeId}"]`).first();
      if (!(await marker.count())) {
        result.places.push({ id: placeId, present: false });
        continue;
      }
      try {
        await marker.evaluate((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
        await page.waitForTimeout(350);
        const file = `place-${placeId}.png`;
        await captureState(page, dir, file);
        const panel = page.locator('.me-panel,.me-place-panel,[data-map-panel]').first();
        const panelVisible = await panel.isVisible().catch(() => false);
        const tabs = page.locator('.me-tab[data-tab]');
        const tabNames = [];
        for (let t = 0; t < await tabs.count(); t += 1) {
          const tab = tabs.nth(t);
          if (!(await tab.isVisible().catch(() => false))) continue;
          tabNames.push(await tab.getAttribute('data-tab'));
        }
        result.places.push({ id: placeId, present: true, panelVisible, tabs: tabNames, file });
      } catch (error) {
        result.places.push({ id: placeId, present: true, error: error.message });
      }
    }

    const visibleTabs = page.locator('.me-tab[data-tab]:visible');
    for (let i = 0; i < await visibleTabs.count(); i += 1) {
      const tab = visibleTabs.nth(i);
      const id = await tab.getAttribute('data-tab') || `tab-${i + 1}`;
      try {
        await clickAndSettle(tab, 180);
        result.tabs.push({ id, active: await tab.getAttribute('aria-selected') || String(await tab.evaluate((el) => el.classList.contains('me-tab--active'))) });
      } catch (error) {
        result.tabs.push({ id, error: error.message });
      }
    }

    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(120);
    result.keyboard.escapeRestoresMap = await page.evaluate(() => {
      const active = document.activeElement;
      return Boolean(active && (active.closest?.('.me-map,#mapRoot') || active === document.body));
    });

    writeJson(path.join(dir, 'geometry.json'), result.initial);
    writeJson(path.join(dir, 'result.json'), result);
  } catch (error) {
    result.fatal = { message: error.message, stack: error.stack };
    await page.screenshot({ path: path.join(dir, 'FATAL.png'), fullPage: true }).catch(() => {});
    writeJson(path.join(dir, 'result.json'), result);
  } finally {
    await context.close();
  }
  return result;
}

function buildSummary(results) {
  const rows = results.map((r) => {
    const c = r.initial?.counts || {};
    return `| ${r.viewport.id} | ${r.fatal ? 'FATAL' : 'captured'} | ${c.offscreenLabels ?? '—'} | ${c.labelOverlaps ?? '—'} | ${c.undersizedControls ?? '—'} | ${r.consoleEvents.filter((e) => e.type === 'error' || e.type === 'pageerror').length} | ${r.failedRequests.length} |`;
  });
  const fatal = results.filter((r) => r.fatal);
  return `# Avraam reference baseline\n\n- Head SHA: \`${HEAD_SHA}\`\n- Workflow run: \`${RUN_ID}\`\n- Route: \`${ROUTE_URL}\`\n- Captured at: ${new Date().toISOString()}\n- Purpose: current-state evidence only; findings are not silently accepted as golden.\n\n| Viewport | State | Offscreen labels | Label overlaps | Controls <44px | Console errors | Failed requests |\n|---|---:|---:|---:|---:|---:|---:|\n${rows.join('\n')}\n\n## Interpretation\n\n- Overlap counts are broad baseline candidates and require screenshot review before repair.\n- A green workflow means the evidence bundle was captured, not that the map is visually approved.\n- Any fatal viewport blocks the baseline lane.\n\n## Fatal viewports\n\n${fatal.length ? fatal.map((r) => `- ${r.viewport.id}: ${r.fatal.message}`).join('\n') : '- none'}\n`;
}

mkdir(OUT_ROOT);
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of VIEWPORTS) {
    console.log(`Capturing ${viewport.id}...`);
    results.push(await runViewport(browser, viewport));
  }
} finally {
  await browser.close();
}

const summary = {
  headSha: HEAD_SHA,
  runId: RUN_ID,
  route: ROUTE_URL,
  capturedAt: new Date().toISOString(),
  viewports: results.map((r) => ({
    id: r.viewport.id,
    fatal: r.fatal,
    counts: r.initial?.counts || null,
    stories: r.stories.length,
    places: r.places,
    consoleErrors: r.consoleEvents.filter((e) => e.type === 'error' || e.type === 'pageerror'),
    failedRequests: r.failedRequests,
  })),
};
writeJson(path.join(OUT_ROOT, 'summary.json'), summary);
fs.writeFileSync(path.join(OUT_ROOT, 'SUMMARY.md'), buildSummary(results), 'utf8');

const fatalCount = results.filter((r) => r.fatal).length;
console.log(`Avraam baseline captured: ${results.length - fatalCount}/${results.length} viewports; output=${OUT_ROOT}`);
if (fatalCount) process.exitCode = 1;
