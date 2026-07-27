#!/usr/bin/env node
/**
 * Production-like browser contract for the transitional article relationship
 * panel. Series navigation stays untouched; only external graph neighbors may
 * enter the premium panel.
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
const CASES = [
  {
    id: 'dzhon-gill-chast-1-chelovek',
    route: '/articles/dzhon-gill-chast-1-chelovek/',
    title: 'Контекст и связи',
    forbidden: ['/articles/dzhon-gill-chast-2-uchenyi/', '/articles/dzhon-gill-chast-3-nasledie/', '/articles/dzhon-gill-chast-4-ekzeget/'],
  },
  {
    id: '20-antisovetov-pastoru',
    route: '/articles/20-antisovetov-pastoru/',
    title: 'Продолжить исследование',
    forbidden: [],
  },
];
const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} Relations · ${name}${detail ? ` — ${detail}` : ''}`);
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

async function normalCase(browser, base, spec, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.goto(base + spec.route, { waitUntil: 'networkidle', timeout: 40_000 });
    await page.waitForSelector('.gb-relations-panel', { timeout: 20_000 });
    const state = await page.evaluate(({ expectedTitle, forbidden, id }) => {
      const panel = document.querySelector('.gb-relations-panel');
      const heading = panel?.querySelector('h2')?.textContent?.trim() || '';
      const itemLinks = Array.from(panel?.querySelectorAll('.gb-relations-panel__item[href]') || []);
      const hrefs = itemLinks.map((link) => link.getAttribute('href'));
      const rect = panel?.getBoundingClientRect();
      const firstRect = itemLinks[0]?.getBoundingClientRect();
      const atlasHref = panel?.querySelector('.gb-relations-panel__atlas')?.getAttribute('href') || '';
      const unique = new Set(hrefs).size === hrefs.length;
      const forbiddenFound = forbidden.filter((href) => hrefs.includes(href));
      const oldBlocks = document.querySelectorAll('.gbx-backlinks').length;
      const computed = panel ? getComputedStyle(panel) : null;
      return {
        heading,
        expectedTitle,
        links: hrefs.length,
        hrefs,
        unique,
        forbiddenFound,
        oldBlocks,
        atlasHref,
        atlasCorrect: atlasHref.includes(`/map/?focus=${encodeURIComponent(id)}`),
        panel: rect ? { width: rect.width, left: rect.left, right: rect.right } : null,
        firstTarget: firstRect ? { width: firstRect.width, height: firstRect.height } : null,
        radius: computed?.borderRadius || '',
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    }, { expectedTitle: spec.title, forbidden: spec.forbidden, id: spec.id });

    const widthOk = state.panel && state.panel.left >= -1 && state.panel.right <= viewport.width + 1;
    const targetOk = state.firstTarget && state.firstTarget.width > 180 && state.firstTarget.height >= 44;
    record(`${spec.id} ${viewport.width}px`,
      state.heading === state.expectedTitle && state.links >= 1 && state.links <= 4 && state.unique &&
      state.forbiddenFound.length === 0 && state.oldBlocks === 0 && state.atlasCorrect &&
      widthOk && targetOk && state.overflow <= 2 && state.radius !== '0px' && errors.length === 0,
      JSON.stringify({ ...state, errors }));
  } catch (error) {
    record(`${spec.id} ${viewport.width}px`, false, String(error).slice(0, 350));
  } finally {
    await context.close();
  }
}

async function failureCase(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route('**/data/links-graph.json', (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: '{"error":"forced relation graph failure"}',
  }));
  try {
    await page.goto(`${base}/articles/dzhon-gill-chast-1-chelovek/`, { waitUntil: 'networkidle', timeout: 40_000 });
    await page.waitForTimeout(800);
    const state = await page.evaluate(() => ({
      article: Boolean(document.querySelector('article')),
      panel: Boolean(document.querySelector('.gb-relations-panel')),
      oldBlocks: document.querySelectorAll('.gbx-backlinks').length,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }));
    record('graph failure leaves article intact',
      state.article && !state.panel && state.oldBlocks === 0 && state.overflow <= 2,
      JSON.stringify(state));
  } catch (error) {
    record('graph failure leaves article intact', false, String(error).slice(0, 350));
  } finally {
    await context.close();
  }
}

async function printCase(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto(`${base}/articles/20-antisovetov-pastoru/`, { waitUntil: 'networkidle', timeout: 40_000 });
    await page.waitForSelector('.gb-relations-panel', { timeout: 20_000 });
    await page.emulateMedia({ media: 'print' });
    const display = await page.locator('.gb-relations-panel').evaluate((node) => getComputedStyle(node).display);
    record('print keeps navigation out of canonical PDF', display === 'none', `display=${display}`);
  } catch (error) {
    record('print keeps navigation out of canonical PDF', false, String(error).slice(0, 350));
  } finally {
    await context.close();
  }
}

if (!existsSync(DIST)) {
  console.error('❌ dist/ missing; build production-like output before relationship panel contract');
  process.exit(1);
}

const { server, base } = await serve();
let browser;
try {
  const pinned = process.env.GB_PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  browser = await chromium.launch(existsSync(pinned) ? { executablePath: pinned } : {});
  for (const spec of CASES) {
    await normalCase(browser, base, spec, { width: 1440, height: 950 });
    await normalCase(browser, base, spec, { width: 390, height: 844 });
  }
  await failureCase(browser, base);
  await printCase(browser, base);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}

const failures = results.filter((result) => !result.ok);
console.log(`\nRelationship panel browser contract: ${results.length - failures.length}/${results.length} passed`);
if (failures.length) process.exit(1);
