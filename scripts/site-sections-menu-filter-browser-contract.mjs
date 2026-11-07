#!/usr/bin/env node
// Product-owned regression: local desktop menu filter over six canonical links.
// Tests built dist, not the Arena or AuditRepo prototype.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const paths = [
  '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/',
  '/articles/dzhon-gill-chast-2-uchenyi/',
  '/baptisty-rossii/sovetskaya-noch/',
  '/biografii/',
];
const routes = paths.filter((route) => {
  const file = path.join(dist, route.slice(1), 'index.html');
  return fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('data-gb-site-menu-variant="rich"');
}).slice(0, 3);
assert.ok(routes.length >= 1, 'Built Product must contain at least one rich real route');

const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json',
  '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png',
  '.jpg':'image/jpeg', '.woff2':'font/woff2' };
const server = http.createServer((req, res) => {
  const uri = decodeURIComponent((req.url || '/').split('?')[0]);
  const pathname = uri.endsWith('/') ? uri + 'index.html' : uri;
  const target = path.resolve(dist, '.' + pathname);
  const relative = path.relative(dist, target);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type': types[path.extname(target)] || 'application/octet-stream', 'cache-control':'no-store' });
  fs.createReadStream(target).pipe(res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
let checks = 0;
const pass = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
try {
  for (const browserType of (process.env.GB_MENU_FILTER_BROWSERS || 'chromium,webkit').split(',').map((name) => {
    const supported = { chromium, firefox, webkit }[name.trim()];
    assert.ok(supported, 'Unsupported browser: ' + name);
    return supported;
  })) {
    const browser = await browserType.launch({ headless:true });
    try {
      for (const route of routes) {
        const context = await browser.newContext({ viewport:{width:1440,height:900}, serviceWorkers:'block' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(origin + route, { waitUntil:'domcontentloaded' });
        await page.waitForFunction(() => document.querySelector('#hMobileMenuBtn')?.dataset.gbSiteMenuOwner === 'canonical-runtime', null, {timeout:10000});
        pass(await page.locator('#hMobileMenuBtn').isVisible(), true, 'desktop trigger visible');
        await page.locator('#hMobileMenuBtn').click();
        const input = page.locator('[data-gb-menu-filter]');
        await input.waitFor({ state:'visible' });
        await page.waitForFunction(() => document.activeElement?.hasAttribute('data-gb-menu-filter'));
        const visibleLinks = page.locator('#hMobileNav a[data-gb-menu-section]:not([hidden])');
        pass(await visibleLinks.count(), 6, 'all six real links on open');
        pass(await page.locator('#hMobileNav a[data-gb-menu-section][href="/biografii/"]').count(), 1, 'canonical biography href');

        await input.fill('БИОГРАФИИ');
        pass(await visibleLinks.count(), 1, 'case-insensitive title match');
        pass(await visibleLinks.first().getAttribute('href'), '/biografii/', 'matched correct href');
        pass(await page.locator('[data-gb-menu-group-title="project"]').getAttribute('hidden'), '', 'empty group hidden');
        await input.fill('книги циклы');
        pass(await visibleLinks.count(), 1, 'multiword description match');
        pass(await visibleLinks.first().getAttribute('href'), '/#publikacii', 'description selects real publications');

        await input.fill('нет такого раздела');
        pass(await visibleLinks.count(), 0, 'no-match hides links');
        pass(await page.locator('[data-gb-menu-empty]').isVisible(), true, 'no-match text visible');
        pass(await page.locator('[data-gb-menu-status]').innerText(), 'Совпадений нет', 'live status');
        await page.locator('[data-gb-menu-clear]').click();
        pass(await visibleLinks.count(), 6, 'clear restores all six');
        pass(await input.inputValue(), '', 'clear resets query');

        await input.fill('о проекте');
        await input.press('ArrowDown');
        pass(await page.locator('#hMobileNav a[data-gb-menu-section]:focus').count(), 1, 'ArrowDown focuses a real link');
        await page.locator('#hMobileNav a[data-gb-menu-section]:focus').press('ArrowUp');
        pass(await input.evaluate((el) => document.activeElement === el), true, 'ArrowUp returns to input');
        await input.press('Escape');
        await page.waitForFunction(() => document.querySelector('#hMobileNav')?.hidden);
        pass(await page.locator('#hMobileMenuBtn').getAttribute('aria-expanded'), 'false', 'Escape closes');
        pass(await page.locator('#hMobileMenuBtn').evaluate((el) => document.activeElement === el), true, 'Escape focus restore');
        await page.locator('#hMobileMenuBtn').click();
        pass(await input.inputValue(), '', 'reopen resets filter');

        await page.setViewportSize({width:390,height:844});
        pass(await input.isVisible(), false, 'mobile has NO filter');
        pass(await visibleLinks.count(), 6, 'mobile preserves six original links');
        await page.waitForFunction(
          () => document.activeElement?.matches('#hMobileNav a[data-gb-menu-section]'),
          null, { timeout: 3000 }
        );
        pass(await page.locator('#hMobileNav a[data-gb-menu-section]:focus').count(), 1,
          'desktop-to-mobile resize preserves focus on a visible menu link');
        pass(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'mobile no overflow');
        await page.keyboard.press('Escape');
        await page.setViewportSize({width:1440,height:300});
        const shortTriggerVisible = await page.locator('#hMobileMenuBtn').isVisible();
        assert.ok(shortTriggerVisible, browserType.name + '/' + route + ': short-desktop menu trigger unavailable');
        await page.locator('#hMobileMenuBtn').click({timeout:5000});
        const geometry = await page.locator('#hMobileNav').evaluate((panel) => {
          const r=panel.getBoundingClientRect(), f=panel.querySelector('[data-gb-menu-filter]').getBoundingClientRect();
          return {inside:r.top >= -1 && r.bottom <= innerHeight+1, filterVisible:f.height>0, usable:panel.clientHeight>=100};
        });
        pass(geometry.inside && geometry.filterVisible && geometry.usable, true, 'short desktop popover stays usable');
        pass(errors, [], 'no JS runtime error');
        await context.close();
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
console.log('Product site-menu filter: PASS (' + checks + ' checks, ' + routes.length + ' real routes; engines=' + (process.env.GB_MENU_FILTER_BROWSERS || 'chromium,webkit') + ').');
