#!/usr/bin/env node
/**
 * Browser witness for non-reading public route roles.
 *
 * Proves that landing/reference routes stay navigational and never inherit
 * article/series reader chrome merely because they share the `series` surface.
 */
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { buildPublicSurfaceRegistry } = require('./lib/public-surface-registry');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const REPORT = join(ROOT, 'reports', 'route-semantics-browser.json');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};
const TARGETS = new Map([
  ['/nagornaya/', { role: 'landing', adapter: 'series-landing' }],
  ['/baptisty-rossii/', { role: 'landing', adapter: 'series-landing' }],
  ['/nagornaya/seriya/', { role: 'landing', adapter: 'series-landing' }],
  ['/nagornaya/istochniki/', { role: 'reference', adapter: 'series-reference' }],
  ['/nagornaya/nakhodki/', { role: 'reference', adapter: 'series-reference' }],
  ['/karty/', { role: 'landing', adapter: 'default-page' }],
  ['/konfessii/', { role: 'landing', adapter: 'default-page' }],
]);
const VIEWPORTS = [
  { id: 'mobile-320', width: 320, height: 760 },
  { id: 'mobile-390', width: 390, height: 844 },
  { id: 'desktop-1440', width: 1440, height: 900 },
];

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
      try {
        if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      } catch {}
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

async function launchBrowser() {
  const explicit = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (explicit && existsSync(explicit)) return chromium.launch({ executablePath: explicit });
  return chromium.launch();
}

const registry = buildPublicSurfaceRegistry();
if (registry.errors.length) {
  registry.errors.forEach((error) => console.error(`REGISTRY ERROR ${error}`));
  process.exit(1);
}
const entries = new Map(registry.entries.map((entry) => [entry.route, entry]));
const results = [];
const record = (route, viewport, contract, ok, detail = '') => {
  results.push({ route, viewport, contract, ok: Boolean(ok), detail: String(detail || '') });
};

for (const [route, expected] of TARGETS) {
  const entry = entries.get(route);
  record(route, 'registry', 'role', entry?.routeRole === expected.role, entry?.routeRole || '<missing>');
  record(route, 'registry', 'adapter', entry?.chrome?.adapter === expected.adapter, entry?.chrome?.adapter || '<missing>');
  record(route, 'registry', 'settings', entry?.settingsCapability === 'global-preferences', entry?.settingsCapability || '<missing>');
}

const { server, base } = await serve();
const browser = await launchBrowser();
try {
  for (const [route, expected] of TARGETS) {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 240)));
      await page.route('**/*', async (requestRoute) => {
        const request = requestRoute.request();
        const url = request.url();
        if (!url.startsWith(base) && !url.startsWith('data:') && !url.startsWith('blob:')) return requestRoute.abort();
        if (['image', 'media', 'font'].includes(request.resourceType())) return requestRoute.abort();
        return requestRoute.continue();
      });
      const response = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(200);
      const facts = await page.evaluate(() => {
        const root = document.scrollingElement || document.documentElement;
        return {
          overflow: Math.max(0, root.scrollWidth - root.clientWidth),
          gillRoot: Boolean(document.querySelector('[data-gill-v16]')),
          seriesRail: Boolean(document.querySelector('.gbs-rail')),
          articleRail: Boolean(document.querySelector('.hrail')),
          readerSettings: Boolean(document.querySelector('#railSettingsBtn, #mobSettingsBtn, #gillSettingsOverlay')),
          h1: [...document.querySelectorAll('h1')].some((node) => {
            const rect = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
          }),
        };
      });
      record(route, viewport.id, 'document:status', response?.status() === 200, response?.status() ?? 'no response');
      record(route, viewport.id, 'runtime:no-pageerror', pageErrors.length === 0, pageErrors.join(' | '));
      record(route, viewport.id, 'layout:no-horizontal-overflow', facts.overflow <= 8, `${facts.overflow}px`);
      record(route, viewport.id, 'document:visible-h1', facts.h1, JSON.stringify(facts));
      record(
        route,
        viewport.id,
        `semantics:${expected.role}-no-reader-chrome`,
        !facts.gillRoot && !facts.seriesRail && !facts.articleRail && !facts.readerSettings,
        JSON.stringify(facts),
      );
      await context.close();
    }
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

const failures = results.filter((item) => !item.ok);
await mkdir(dirname(REPORT), { recursive: true });
await writeFile(REPORT, JSON.stringify({ generatedAt: new Date().toISOString(), total: results.length, passed: results.length - failures.length, failed: failures.length, results }, null, 2));
console.log(`Route semantics browser: ${results.length - failures.length}/${results.length} passed`);
if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL ${failure.route} ${failure.viewport} ${failure.contract}: ${failure.detail}`));
  process.exit(1);
}
