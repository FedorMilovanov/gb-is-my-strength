#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2',
};

function routeFile(pathname) {
  const clean = decodeURIComponent(pathname.split('?')[0]).replace(/^\/+/, '');
  return join(DIST, clean, clean.endsWith('.html') ? '' : 'index.html');
}

async function serve() {
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
      let file = pathname.includes('.') && !pathname.endsWith('/')
        ? join(DIST, pathname.replace(/^\/+/, ''))
        : routeFile(pathname);
      try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch {}
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`✅ ${name}`);
    return;
  }
  console.error(`❌ ${name}${detail ? `\n   → ${detail}` : ''}`);
  process.exitCode = 1;
}

const { server, base } = await serve();
const explicit = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch(explicit && existsSync(explicit) ? { executablePath: explicit } : {});
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const assetResponses = new Map();
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('response', (response) => {
    const pathname = new URL(response.url()).pathname;
    if (pathname === '/karty/ishod/base.svg' || pathname === '/karty/avraam/base.svg') {
      assetResponses.set(pathname, response.status());
    }
  });

  const response = await page.goto(base + '/karty/ishod/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#stage[data-map-state="ready"]', { timeout: 20000 });
  await page.waitForSelector('#me-base-geo image', { timeout: 10000 });
  await page.waitForFunction(() => {
    const image = document.querySelector('#me-base-geo image');
    const rect = image?.getBoundingClientRect();
    return !!rect && rect.width > 100 && rect.height > 100;
  }, null, { timeout: 10000 });
  await page.waitForFunction(() => document.querySelectorAll('[data-pihahiroth-corridor]').length === 3, null, { timeout: 10000 });
  await page.waitForTimeout(250);

  const facts = await page.evaluate(() => {
    const stage = document.querySelector('#stage');
    const base = document.querySelector('#me-base-geo');
    const image = base?.querySelector('image');
    const rect = image?.getBoundingClientRect();
    const historicalPoint = stage?.querySelector('[data-place-id="pihahiroth"]');
    return {
      mapState: stage?.getAttribute('data-map-state') || '',
      basePresent: !!base,
      imageHref: image?.getAttribute('href') || image?.getAttribute('xlink:href') || '',
      imageWidth: rect?.width || 0,
      imageHeight: rect?.height || 0,
      coordinateStatus: stage?.getAttribute('data-pihahiroth-coordinate-status') || '',
      corridorCountAttr: stage?.getAttribute('data-pihahiroth-corridor-count') || '',
      corridorCount: document.querySelectorAll('[data-pihahiroth-corridor]').length,
      historicalPointDisplay: historicalPoint ? getComputedStyle(historicalPoint).display : '<absent>',
    };
  });

  check('Ishod route returns HTTP 200', response?.status() === 200, String(response?.status()));
  check('Ishod reaches ready map state', facts.mapState === 'ready', JSON.stringify(facts));
  check('Route-owned basemap wrapper is fetched', assetResponses.get('/karty/ishod/base.svg') === 200, JSON.stringify(Object.fromEntries(assetResponses)));
  check('Self-contained atlas geography is fetched', assetResponses.get('/karty/avraam/base.svg') === 200, JSON.stringify(Object.fromEntries(assetResponses)));
  check('MapEngine mounts #me-base-geo', facts.basePresent, JSON.stringify(facts));
  check('Mounted geography points to the atlas base asset', facts.imageHref === '/karty/avraam/base.svg', JSON.stringify(facts));
  check('Mounted geography has nonzero rendered geometry', facts.imageWidth > 100 && facts.imageHeight > 100, JSON.stringify(facts));
  check('Pihahiroth remains unresolved', facts.coordinateStatus === 'UNRESOLVED', JSON.stringify(facts));
  check('Exactly three Pihahiroth uncertainty corridors remain', facts.corridorCount === 3 && facts.corridorCountAttr === '3', JSON.stringify(facts));
  check('Historical Pihahiroth point stays non-authoritative', facts.historicalPointDisplay === 'none' || facts.historicalPointDisplay === '<absent>', JSON.stringify(facts));
  check('No page errors', pageErrors.length === 0, pageErrors.join(' | '));
  check('No console errors', consoleErrors.length === 0, consoleErrors.join(' | '));

  if (process.exitCode) throw new Error('Ishod basemap browser contract failed');
  console.log('✅ Ishod basemap browser contract passed');
  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
