#!/usr/bin/env node
/** Native archived updates: production-dist visual and interaction smoke. */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, join, sep } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const dist = resolve(root, 'dist');
const report = resolve(root, 'reports', 'editorial-updates-browser');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const uri = decodeURIComponent(url.pathname);
    let pathname = resolve(dist, '.' + uri);
    if (!(pathname === dist || pathname.startsWith(dist + sep))) {
      res.writeHead(403); res.end(); return;
    }
    if (uri.endsWith('/')) pathname = join(pathname, 'index.html');
    const data = await readFile(pathname);
    res.writeHead(200, { 'content-type': mime[extname(pathname)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});
const assert = (condition, message) => {
  if (!condition) throw new Error('ARCHIVE BROWSER FAIL: ' + message);
};
await mkdir(report, { recursive: true });
await new Promise((ok, fail) => server.once('error', fail).listen(0, '127.0.0.1', ok));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless: true });
let assertions = 0;
function check(condition, message) { assertions++; assert(condition, message); }

try {
  for (const width of [320, 390, 750, 760, 768, 1280]) {
    for (const route of ['/', '/updates/']) {
      const mobile = width <= 760;
      const page = await browser.newPage({ viewport: { width, height: 860 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      const runtimeErrors = [];
      page.on('pageerror', error => runtimeErrors.push(error.message));
      const response = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
      check(response?.status() === 200, width + ' ' + route + ' must return 200');
      await page.waitForTimeout(450);
      check(runtimeErrors.length === 0, width + ' ' + route + ' JS errors: ' + runtimeErrors.join(' | '));
      const excess = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      check(excess <= 2, width + ' ' + route + ' horizontal document overflow ' + excess);
      const isHome = route === '/';
      const rootSelector = isHome ? '[data-editorial-carousel]' : '[data-update-archive]';
      const viewportSelector = isHome ? '[data-ed-viewport]' : '[data-update-list]';
      const counterSelector = isHome ? '[data-ed-counter]' : '[data-update-counter]';
      const nextSelector = isHome ? '[data-ed-next]' : '[data-update-next]';
      const allSelector = isHome ? '[data-ed-filter="all"]' : '[data-update-filter="all"]';
      const correctionSelector = isHome ? '[data-ed-filter="correction"]' : '[data-update-filter="correction"]';
      const container = page.locator(rootSelector);
      check(await container.count() === 1, width + ' ' + route + ' archive exists');
      if (!isHome) {
        const bounds = await page.locator('main.astro-main--editorial-updates').boundingBox();
        check(Boolean(bounds) && bounds.x >= -1 && bounds.x + bounds.width <= width + 1,
          width + ' archive main exceeds viewport: ' + JSON.stringify(bounds));
        const headerBounds = await page.locator('.editorial-updates-page header > p:last-child').boundingBox();
        check(Boolean(headerBounds) && headerBounds.x >= -1 && headerBounds.x + headerBounds.width <= width + 1,
          width + ' archive introduction cropped: ' + JSON.stringify(headerBounds));
      }
      await container.scrollIntoViewIfNeeded();
      if (!isHome && process.env.EDITORIAL_ARCHIVE_DEBUG === '1') {
        const geometry = await page.evaluate(() => {
          const keys = [
            '.astro-shell', 'main.astro-main--editorial-updates',
            '.editorial-updates-page', '.editorial-updates-page header',
            '.editorial-updates-page header > p:last-child',
            '.editorial-updates-page__filters', '.editorial-updates-page__list',
            '[data-update-archive]',
          ];
          return keys.map(key => {
            const element = document.querySelector(key);
            const box = element?.getBoundingClientRect();
            const css = element && getComputedStyle(element);
            return {
              key, left: Math.round(box?.left ?? 0), right: Math.round(box?.right ?? 0),
              width: Math.round(box?.width ?? 0),
              client: element?.clientWidth ?? 0, scroll: element?.scrollWidth ?? 0,
              overflow: css?.overflowX, minWidth: css?.minWidth,
            };
          });
        });
        console.log('GEOMETRY ' + width + ' ' + JSON.stringify(geometry));
      }
      await page.locator(rootSelector + ' img').evaluateAll(images =>
        images.forEach(image => { image.loading = 'eager'; }));
      await page.waitForTimeout(320);
      check((await page.locator(rootSelector + ' img').count()) === 2, width + ' ' + route + ' exactly two archive images');
      const okImages = await page.locator(rootSelector + ' img').evaluateAll(imgs =>
        imgs.every(image => image.complete && image.naturalWidth > 0));
      check(okImages, width + ' ' + route + ' archive images load');
      if (!isHome) check(await page.locator('[data-pagefind-body]').count() === 1,
        width + ' archive Pagefind content marker');
      const counter = page.locator(rootSelector + ' ' + counterSelector);
      check((await counter.textContent())?.trim() === '1 / 2',
        width + ' ' + route + ' initial index');
      if (mobile) {
        await page.locator(rootSelector + ' ' + nextSelector).click();
        await page.waitForTimeout(560);
        check((await counter.textContent())?.trim() === '2 / 2',
          width + ' ' + route + ' next button navigates to second');
        const atSecond = await page.locator(rootSelector + ' ' + viewportSelector).evaluate(el =>
          el.scrollLeft > Math.max(30, el.clientWidth / 2));
        check(atSecond, width + ' ' + route + ' scroll position advanced');
        const slideTop = await page.locator(rootSelector + ' ' + viewportSelector).evaluate(el =>
          Math.round(el.getBoundingClientRect().top));
        check(slideTop >= 60 && slideTop <= 245,
          width + ' ' + route + ' next card starts in viewport (top=' + slideTop + ')');
        await page.screenshot({
          path: join(report, (isHome ? 'home' : 'archive') + '-' + width + '-second.png'),
          fullPage: false,
        });
      }
      await page.locator(rootSelector + ' ' + correctionSelector).click();
      check((await counter.textContent())?.trim() === '1 / 1',
        width + ' ' + route + ' filter correction');
      await page.locator(rootSelector + ' ' + allSelector).click();
      check((await counter.textContent())?.trim() === '1 / 2',
        width + ' ' + route + ' filter reset');
      if (width === 390) {
        await page.evaluate(() => document.documentElement.classList.add('dark'));
        check(await page.locator(rootSelector).isVisible(), route + ' dark archive visible');
      }
      await page.screenshot({
        path: join(report, (isHome ? 'home' : 'archive') + '-' + width + '.png'),
        fullPage: false,
      });
      await page.close();
      console.log('PASS ' + width + ' ' + route);
    }
  }
  console.log('EDITORIAL ARCHIVE BROWSER: PASS (' + assertions + ' assertions; 12 viewport-route captures)');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
