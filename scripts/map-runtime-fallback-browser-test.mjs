#!/usr/bin/env node
/**
 * Production-like browser contract for the two live native map routes.
 *
 * Proves four independent states:
 *   1. normal MapEngine render;
 *   2. JavaScript disabled;
 *   3. route.json unavailable;
 *   4. shared engine asset unavailable.
 *
 * The failure scenes must expose a visible recovery alert and must never leave
 * the reader behind an opaque empty stage.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};
const ROUTES = [
  { slug: 'ishod', title: 'Исход', textFallback: false },
  { slug: 'avraam', title: 'Авраам', textFallback: true },
];
const results = [];

function record(route, scene, ok, detail = '') {
  results.push({ route, scene, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${route} · ${scene}${detail ? ` — ${detail}` : ''}`);
}

async function serve() {
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(String(req.url || '/').split('?')[0]);
      let file = join(DIST, pathname);
      try {
        if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      } catch {
        file = join(ROOT, pathname);
      }
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

async function geometry(page) {
  return page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - innerWidth,
    stageState: document.querySelector('[data-map-stage]')?.getAttribute('data-map-state') || '',
    stageBusy: document.querySelector('[data-map-stage]')?.getAttribute('aria-busy') || '',
    canvas: Boolean(document.querySelector('.me-canvas')),
  }));
}

async function normalScene(browser, base, route) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  try {
    await page.goto(`${base}/karty/${route.slug}/`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForSelector('[data-map-stage][data-map-state="ready"]', { timeout: 20_000 });
    const state = await geometry(page);
    record(route.slug, 'normal render',
      state.canvas && state.stageState === 'ready' && state.stageBusy === 'false' && state.overflow <= 2 && pageErrors.length === 0,
      JSON.stringify({ ...state, pageErrors }));
  } catch (error) {
    record(route.slug, 'normal render', false, String(error).slice(0, 240));
  } finally {
    await context.close();
  }
}

async function noJsScene(browser, base, route) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  try {
    await page.goto(`${base}/karty/${route.slug}/`, { waitUntil: 'load', timeout: 30_000 });
    const state = await page.evaluate((needsText) => {
      const stage = document.querySelector('[data-map-stage]');
      const card = document.querySelector('.map-runtime-noscript');
      const text = document.querySelector('.map-text-fallback');
      const stageStyle = stage ? getComputedStyle(stage) : null;
      const cardRect = card?.getBoundingClientRect();
      const textRect = text?.getBoundingClientRect();
      const linkRect = card?.querySelector('a')?.getBoundingClientRect();
      return {
        stageHidden: Boolean(stageStyle && stageStyle.display === 'none'),
        cardVisible: Boolean(cardRect && cardRect.width > 0 && cardRect.height > 0),
        linkTarget: linkRect ? { width: linkRect.width, height: linkRect.height } : null,
        textVisible: !needsText || Boolean(textRect && textRect.width > 0 && textRect.height > 200 && getComputedStyle(text).position === 'static'),
        textLength: text?.textContent?.trim().length || 0,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    }, route.textFallback);
    const targetOk = state.linkTarget && state.linkTarget.width >= 44 && state.linkTarget.height >= 44;
    record(route.slug, 'no-JS readable fallback',
      state.stageHidden && state.cardVisible && targetOk && state.textVisible && state.overflow <= 2,
      JSON.stringify(state));
  } catch (error) {
    record(route.slug, 'no-JS readable fallback', false, String(error).slice(0, 240));
  } finally {
    await context.close();
  }
}

async function failureScene(browser, base, route, kind) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  if (kind === 'route') {
    await page.route(`**/karty/${route.slug}/route.json`, (request) => request.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"error":"forced route failure"}',
    }));
  } else {
    await page.route('**/karty/_engine/map-engine.js', (request) => request.abort('failed'));
  }

  try {
    await page.goto(`${base}/karty/${route.slug}/`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForSelector('[data-map-stage][data-map-state="error"] .me-error[role="alert"]', { timeout: 15_000 });
    const state = await page.evaluate(() => {
      const stage = document.querySelector('[data-map-stage]');
      const alert = stage?.querySelector('.me-error[role="alert"]');
      const retry = alert?.querySelector('.me-error__retry');
      const back = alert?.querySelector('.me-error__back');
      const alertRect = alert?.getBoundingClientRect();
      const retryRect = retry?.getBoundingClientRect();
      const backRect = back?.getBoundingClientRect();
      return {
        state: stage?.getAttribute('data-map-state'),
        busy: stage?.getAttribute('aria-busy'),
        alertVisible: Boolean(alertRect && alertRect.width > 0 && alertRect.height > 0),
        retry: retryRect ? { width: retryRect.width, height: retryRect.height } : null,
        back: backRect ? { width: backRect.width, height: backRect.height, href: back?.getAttribute('href') } : null,
        canvas: Boolean(stage?.querySelector('.me-canvas')),
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    const retryOk = state.retry && state.retry.width >= 44 && state.retry.height >= 44;
    const backOk = state.back && state.back.width >= 44 && state.back.height >= 44 && state.back.href === '/karty/';
    record(route.slug, kind === 'route' ? 'route.json failure recovery' : 'engine asset failure recovery',
      state.state === 'error' && state.busy === 'false' && state.alertVisible && retryOk && backOk && !state.canvas && state.overflow <= 2 && pageErrors.length === 0,
      JSON.stringify({ ...state, pageErrors }));
  } catch (error) {
    record(route.slug, kind === 'route' ? 'route.json failure recovery' : 'engine asset failure recovery', false, String(error).slice(0, 240));
  } finally {
    await context.close();
  }
}

if (!existsSync(DIST)) {
  console.error('❌ dist/ missing; build production-like output before map fallback browser test');
  process.exit(1);
}

const { server, base } = await serve();
let browser;
try {
  const pinned = process.env.GB_PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  browser = await chromium.launch(existsSync(pinned) ? { executablePath: pinned } : {});
  for (const route of ROUTES) {
    await normalScene(browser, base, route);
    await noJsScene(browser, base, route);
    await failureScene(browser, base, route, 'route');
    await failureScene(browser, base, route, 'engine');
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}

const failures = results.filter((result) => !result.ok);
console.log(`\nMap runtime fallback browser contract: ${results.length - failures.length}/${results.length} passed`);
if (failures.length) process.exit(1);
