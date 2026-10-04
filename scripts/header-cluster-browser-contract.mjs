#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=');
  return [key, rest.join('=') || true];
}));
const dist = path.resolve(String(args.dist || 'dist'));
const reportDir = path.resolve(String(args.report || 'reports/search-modal-contract/header-cluster'));

function mime(file) {
  return ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
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

const routeMatrix = [
  { path: '/izbrannoe/', widths: [360, 390, 414, 768] },
  { path: '/hard-texts/genesis-6/', widths: [360, 390, 414, 768] },
  { path: '/', widths: [768] },
];
const contexts = [
  { id: 'plain', extra: {} },
  { id: 'mobile-touch', extra: { isMobile: true, hasTouch: true } },
];

function boxInsideViewport(box, width, label) {
  assert.ok(box, `${label}: missing box`);
  assert.ok(box.width >= 44 && box.height >= 44, `${label}: target smaller than 44x44 (${box.width}x${box.height})`);
  assert.ok(box.left >= -0.5, `${label}: left clipped (${box.left})`);
  assert.ok(box.right <= width + 0.5, `${label}: right clipped (${box.right} > ${width})`);
  assert.ok(box.top >= -0.5, `${label}: top clipped (${box.top})`);
}

async function geometryCase(browser, base, route, width, contextSpec) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, ...contextSpec.extra });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  try {
    const response = await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    assert.ok(response && response.status() < 400, `${route} returned ${response?.status() ?? 'no response'}`);
    await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; }).catch(() => {});

    const metrics = await page.evaluate(() => {
      const box = (element) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      };
      const search = document.querySelector('#hCpBtnNav, #gbSearchBtn');
      const theme = document.getElementById('themeToggle');
      const searchBox = box(search);
      const themeBox = box(theme);
      const centerOwner = (element, rect) => {
        if (!element || !rect) return false;
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return hit === element || Boolean(hit?.closest(`#${element.id}`));
      };
      const overlap = searchBox && themeBox
        ? Math.max(0, Math.min(searchBox.right, themeBox.right) - Math.max(searchBox.left, themeBox.left))
          * Math.max(0, Math.min(searchBox.bottom, themeBox.bottom) - Math.max(searchBox.top, themeBox.top))
        : Number.POSITIVE_INFINITY;
      return {
        searchBox,
        themeBox,
        searchHit: centerOwner(search, searchBox),
        themeHit: centerOwner(theme, themeBox),
        overlap,
        rootOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    const label = `${contextSpec.id}:${route}:${width}`;
    boxInsideViewport(metrics.searchBox, width, `${label}:search`);
    boxInsideViewport(metrics.themeBox, width, `${label}:theme`);
    assert.equal(metrics.searchHit, true, `${label}: search centre does not hit search control`);
    assert.equal(metrics.themeHit, true, `${label}: theme centre does not hit theme control`);
    assert.equal(metrics.overlap, 0, `${label}: search/theme target overlap area ${metrics.overlap}`);
    assert.ok(metrics.rootOverflow <= 1, `${label}: root horizontal overflow ${metrics.rootOverflow}px`);
    assert.deepEqual(pageErrors, [], `${label}: page errors`);

    return { context: contextSpec.id, route, width, ...metrics };
  } finally {
    await context.close();
  }
}

async function interactionCase(browser, base, contextSpec) {
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, ...contextSpec.extra });
  const page = await context.newPage();
  try {
    await page.goto(`${base}/izbrannoe/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.evaluate(() => {
      window.__gbHeaderOpenEvents = 0;
      window.addEventListener('gb:openSearch', () => { window.__gbHeaderOpenEvents += 1; });
    });

    const focusEvidence = [];
    const collectFocusEvidence = async (target, label, selectors) => {
      for (const dark of [false, true]) {
        await target.evaluate((enabled) => document.documentElement.classList.toggle('dark', enabled), dark);
        for (const selector of selectors) {
          const control = target.locator(selector);
          if ((await control.count()) === 0) continue;
          await control.focus();
          // Sample the rendered focus state instead of the frame the focus was
          // set in: a focus ring that only appears part-way through a
          // transition is still reported at its real (thin) width, because two
          // frames cover ~32ms of the 300ms the legacy sheet would animate.
          await target.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const style = await control.evaluate((node) => {
            const computed = getComputedStyle(node);
            return {
              outlineStyle: computed.outlineStyle,
              outlineWidth: computed.outlineWidth,
              outlineOffset: computed.outlineOffset,
              borderRadius: computed.borderRadius,
            };
          });
          assert.notEqual(style.outlineStyle, 'none', `${label}:${selector}:${dark ? 'dark' : 'light'} focus outline missing`);
          assert.ok(Number.parseFloat(style.outlineWidth) >= 2, `${label}:${selector}:${dark ? 'dark' : 'light'} focus outline too thin (${style.outlineWidth})`);
          focusEvidence.push({ label, dark, selector, style });
        }
      }
      await target.evaluate(() => document.documentElement.classList.remove('dark'));
    };

    await collectFocusEvidence(page, `${contextSpec.id}:/izbrannoe/`, ['#hCpBtnNav', '#themeToggle']);

    // Home renders its own control cluster (HomePageChrome.astro). The theme
    // toggle focus indicator was reported missing site-wide, so the same
    // requirement is measured against the home cluster too — on its own page,
    // so the non-home activation flow below keeps its loaded state.
    const homePage = await context.newPage();
    try {
      await homePage.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await collectFocusEvidence(homePage, `${contextSpec.id}:/`, ['#gbSearchBtn', '#themeToggle']);
    } finally {
      await homePage.close();
    }

    await page.locator('#hCpBtnNav').click();
    await page.waitForFunction(() => window.GBSearch?.__ready === true && document.querySelectorAll('.cp-backdrop.is-open[role="dialog"]').length === 1, null, { timeout: 30_000 });
    assert.equal(await page.evaluate(() => window.__gbHeaderOpenEvents), 1, `${contextSpec.id}: first click dispatched search more than once`);
    assert.equal(await page.locator('.cp-backdrop.is-open[role="dialog"]').count(), 1, `${contextSpec.id}: first click opened duplicate dialogs`);
    await page.locator('.cp-close').click();
    await page.waitForFunction(() => document.querySelectorAll('.cp-backdrop.is-open').length === 0);

    await page.evaluate(() => { window.__gbHeaderOpenEvents = 0; });
    await page.keyboard.press('Control+K');
    await page.waitForFunction(() => document.querySelectorAll('.cp-backdrop.is-open[role="dialog"]').length === 1, null, { timeout: 30_000 });
    assert.equal(await page.evaluate(() => window.__gbHeaderOpenEvents), 1, `${contextSpec.id}: Ctrl+K dispatched search more than once`);
    assert.equal(await page.locator('.cp-backdrop.is-open[role="dialog"]').count(), 1, `${contextSpec.id}: Ctrl+K opened duplicate dialogs`);

    return { context: contextSpec.id, clickOpenEvents: 1, shortcutOpenEvents: 1, focusEvidence };
  } finally {
    await context.close();
  }
}

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
const base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ headless: true });
const geometry = [];
const interactions = [];
try {
  for (const contextSpec of contexts) {
    for (const route of routeMatrix) {
      for (const width of route.widths) geometry.push(await geometryCase(browser, base, route.path, width, contextSpec));
    }
    interactions.push(await interactionCase(browser, base, contextSpec));
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

const report = {
  schemaVersion: 1,
  source: 'actual Astro Header.astro in production-like dist',
  assertions: {
    widths: [360, 390, 414, 768],
    routes: ['/izbrannoe/', '/hard-texts/genesis-6/', '/'],
    plainAndMobileTouchContexts: true,
    targets44px: true,
    insideViewport: true,
    centreHitTest: true,
    zeroSearchThemeOverlap: true,
    focusVisibleLightDark: true,
    homeClusterFocusVisibleLightDark: true,
    firstClickOpensExactlyOnce: true,
    ctrlKOpensExactlyOnce: true,
  },
  geometry,
  interactions,
};
fs.writeFileSync(path.join(reportDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`HEADER CLUSTER BROWSER CONTRACT: PASS (${geometry.length} geometry cases, ${interactions.length} interaction contexts)`);
