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
  if (process.env.GB_TOUCH_ONLY !== '1') {
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
      const buttons = await page.locator(rootSelector + ' [data-ed-filter], ' + rootSelector + ' [data-update-filter]').evaluateAll(items =>
        items.map(button => Math.round(button.getBoundingClientRect().height)));
      check(buttons.length > 0 && buttons.every(height => height >= 44),
        width + ' ' + route + ' filter touch targets >=44px: ' + buttons.join(', '));
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
      const evidenceSelector = isHome ? '[data-ed-filter="new-evidence"]' : '[data-update-filter="new-evidence"]';
      await page.locator(rootSelector + ' ' + evidenceSelector).click();
      check((await counter.textContent())?.trim() === '1 / 1',
        width + ' ' + route + ' new evidence filter');
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
  }
  // Regression: crossing the mobile/desktop breakpoint must not leave the
  // counter on the first record while the scroll track displays the second.
  for (const route of ['/', '/updates/']) {
    const isHome = route === '/';
    const root = isHome ? '[data-editorial-carousel]' : '[data-update-archive]';
    const viewportSelector = isHome ? '[data-ed-viewport]' : '[data-update-list]';
    const counterSelector = isHome ? '[data-ed-counter]' : '[data-update-counter]';
    const nextSelector = isHome ? '[data-ed-next]' : '[data-update-next]';
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    try {
      await page.goto(base + route, { waitUntil: 'domcontentloaded' });
      await page.locator(root).scrollIntoViewIfNeeded();
      await page.locator(root + ' ' + nextSelector).click();
      await page.waitForTimeout(160);
      check((await page.locator(root + ' ' + counterSelector).innerText()).trim() === '2 / 2',
        route + ' selected second card before resize');
      await page.setViewportSize({ width: 1000, height: 844 });
      await page.waitForTimeout(170);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(250);
      const result = await page.locator(root + ' ' + viewportSelector).evaluate((el, ctr) => ({
        left: Math.round(el.scrollLeft),
        counter: document.querySelector(ctr)?.textContent.trim(),
      }), root + ' ' + counterSelector);
      check(result.counter === '1 / 2' && result.left <= 3,
        route + ' breakpoint round-trip keeps counter and slide synchronized: ' + JSON.stringify(result));
    } finally {
      await page.close();
    }
  }

  // No-JS visitors must see the archival articles, not inactive filter buttons.
  for (const route of ['/', '/updates/']) {
    const context = await browser.newContext({
      viewport: { width: 320, height: 850 },
      javaScriptEnabled: false,
    });
    try {
      const page = await context.newPage();
      await page.goto(base + route, { waitUntil: 'domcontentloaded' });
      const root = route === '/' ? '[data-editorial-carousel]' : '[data-update-archive]';
      const item = route === '/' ? '[data-ed-entry]' : '[data-update-entry]';
      const first = page.locator(root + ' ' + item).first();
      const filter = page.locator(root + ' [data-ed-filter], ' + root + ' [data-update-filter]').first();
      check(await first.isVisible(), route + ' no-JS content remains visible');
      check(!(await filter.isVisible()), route + ' no-JS inactive filters are hidden');
    } finally {
      await context.close();
    }
  }

  // Real mobile touch input, not a desktop drag or a scrollLeft assignment.
  // The counter may change before the physical slide settles; enforce both.
  for (const width of [320, 390]) {
    for (const route of ['/', '/updates/']) {
      const context = await browser.newContext({
        viewport: { width, height: 850 },
        hasTouch: true, isMobile: true, reducedMotion: 'reduce',
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      const home = route === '/';
      const root = home ? '[data-editorial-carousel]' : '[data-update-archive]';
      const viewportSelector = home ? '[data-ed-viewport]' : '[data-update-list]';
      const entry = home ? '[data-ed-entry]' : '[data-update-entry]';
      const counter = home ? '[data-ed-counter]' : '[data-update-counter]';
      const filter = home ? '[data-ed-filter]' : '[data-update-filter]';
      const name = (home ? 'home' : 'archive') + '-' + width;

      async function swipe(element, direction) {
        const rect = await element.boundingBox();
        check(Boolean(rect), name + ' touch target exists');
        const client = await context.newCDPSession(page);
        const y = rect.y + Math.min(90, rect.height * .3);
        const x1 = rect.x + rect.width * (direction === 'next' ? .82 : .18);
        const x2 = rect.x + rect.width * (direction === 'next' ? .13 : .87);
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchStart', touchPoints: [{ x: x1, y }],
        });
        for (let i = 1; i <= 24; i++) {
          await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove', touchPoints: [{ x: x1 + (x2 - x1) * i / 24, y }],
          });
          await page.waitForTimeout(10);
        }
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchEnd', touchPoints: [],
        });
        await client.detach();
      }

      try {
        await page.goto(base + route, { waitUntil: 'domcontentloaded' });
        await page.locator(root).scrollIntoViewIfNeeded();
        const viewport = page.locator(root + ' ' + viewportSelector);
        await page.evaluate(() => document.activeElement?.blur());
        for (const [direction, expected] of [
          ['next', '2 / 2'], ['previous', '1 / 2'], ['next', '2 / 2'],
        ]) {
          await swipe(viewport, direction);
          await page.waitForTimeout(520);
          const geometry = await viewport.evaluate((el, params) => {
            const visible = Array.from(document.querySelectorAll(
              params.root + ' ' + params.entry + ':not([hidden])'
            ));
            const pos = params.expected === '2 / 2' ? 1 : 0;
            return {
              offset: Math.round(el.scrollLeft),
              desired: Math.round(visible[pos].offsetLeft - visible[0].offsetLeft),
              documentExcess: document.documentElement.scrollWidth - innerWidth,
            };
          }, { root, entry, expected });
          check((await page.locator(root + ' ' + counter).textContent())?.trim() === expected,
            name + ' physical ' + direction + ' counter ' + expected);
          check(Math.abs(geometry.offset - geometry.desired) <= 3,
            name + ' physical ' + direction + ' fully snaps, geometry=' + JSON.stringify(geometry));
          check(geometry.documentExcess <= 2, name + ' no horizontal page overflow');
        }
        await page.screenshot({ path: join(report, name + '-touch-final.png') });

        // Scroll the filter strip by touch when it overflows, then tap an actual
        // button. A programmatic DOM click would conceal hit-target problems.
        const allButton = page.locator(root + ' ' + filter.replace(/]$/, '="all"]'));
        const strip = allButton.locator('..');
        const stripSize = await strip.evaluate(el => ({
          client: el.clientWidth, scroll: el.scrollWidth,
        }));
        if (stripSize.scroll > stripSize.client + 3) {
          await swipe(strip, 'next');
          await page.waitForTimeout(250);
          const shift = await strip.evaluate(el => el.scrollLeft);
          check(shift >= 10, name + ' finger scrolls the filter strip');
        }
        const correction = page.locator(root + ' ' + filter.replace(/]$/, '="correction"]'));
        await correction.scrollIntoViewIfNeeded();
        await page.waitForTimeout(100);
        const rect = await correction.boundingBox();
        check(Boolean(rect), name + ' correction filter hit target exists');
        await page.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height / 2);
        await page.waitForTimeout(200);
        check(await correction.getAttribute('aria-pressed') === 'true',
          name + ' correction filter activated by first touch');
        check((await page.locator(root + ' ' + counter).textContent())?.trim() === '1 / 1',
          name + ' touch filter shows only correction');
        await page.screenshot({ path: join(report, name + '-touch-filtered.png') });
        await allButton.scrollIntoViewIfNeeded();
        const a = await allButton.boundingBox();
        await page.touchscreen.tap(a.x + a.width / 2, a.y + a.height / 2);
        await page.waitForTimeout(200);
        check((await page.locator(root + ' ' + counter).textContent())?.trim() === '1 / 2',
          name + ' touch resets filter');

        const firstEntry = page.locator(root + ' ' + entry + ':not([hidden])').first();
        const link = firstEntry.locator('a[href*="#"]').last();
        await link.scrollIntoViewIfNeeded();
        const linkRect = await link.boundingBox();
        check(Boolean(linkRect), name + ' article link has touch target');
        check(linkRect.height >= 44, name + ' article link touch target >=44px (' + linkRect.height + ')');
        if (home) {
          const archiveLink = page.locator(root + ' .ed-archive-footer > a');
          const archiveLinkHeight = await archiveLink.evaluate(el => el.getBoundingClientRect().height);
          check(archiveLinkHeight >= 44, name + ' full archive link touch target >=44px (' + archiveLinkHeight + ')');
        }
        await page.touchscreen.tap(linkRect.x + linkRect.width / 2, linkRect.y + linkRect.height / 2);
        // Real page navigation can take longer than a fixed 400ms sleep.
        await page.waitForURL(url => url.pathname.startsWith('/articles/') && Boolean(url.hash), {
          timeout: 6000,
        });
        check(page.url().includes('/articles/') && page.url().includes('#'),
          name + ' first touch follows article deep link');
      } finally {
        await context.close();
      }
      console.log('PASS touch ' + width + ' ' + route);
    }
  }
  console.log('EDITORIAL ARCHIVE BROWSER: PASS (' + assertions + ' assertions; 12 viewport-route, 4 native touch, 2 breakpoint, 2 no-JS cases)');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
