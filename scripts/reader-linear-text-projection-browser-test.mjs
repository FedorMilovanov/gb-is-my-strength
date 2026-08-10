#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const ROOT = path.resolve(process.cwd());
const DIST = path.join(ROOT, 'dist');
const REPORT_DIR = path.join(ROOT, 'reports', 'reader-linear-text-projection');
const ROUTES = [
  '/articles/krajne-li-isporcheno-serdce/',
  '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/',
  '/articles/dzhon-gill-chast-2-uchenyi/',
];
const BROWSERS = { chromium, webkit };

function contentType(file) {
  return {
    '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.webp': 'image/webp',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2',
  }[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function resolveRequest(value) {
  const url = new URL(value || '/', 'http://127.0.0.1');
  const pathname = decodeURIComponent(url.pathname);
  const relative = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  const candidate = path.resolve(DIST, `.${relative}`);
  assert.ok(candidate === DIST || candidate.startsWith(`${DIST}${path.sep}`), 'request escaped dist root');
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  const index = path.join(candidate, 'index.html');
  return fs.existsSync(index) && fs.statSync(index).isFile() ? index : null;
}

async function startServer() {
  for (const route of ROUTES) assert.ok(resolveRequest(route), `built route missing: ${route}`);
  assert.ok(fs.existsSync(path.join(DIST, 'pagefind', 'pagefind.js')), 'Pagefind output missing; run pagefind:build:dist first');
  const server = http.createServer((request, response) => {
    try {
      const file = resolveRequest(request.url);
      response.setHeader('Cache-Control', 'no-store');
      if (!file) { response.statusCode = 404; response.end('Not found'); return; }
      response.setHeader('Content-Type', contentType(file));
      fs.createReadStream(file).pipe(response);
    } catch (error) {
      response.statusCode = 400;
      response.end(String(error?.message || error));
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

async function inspectNoJs(browserType, browserName, baseUrl, route) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
    assert.ok(response?.ok(), `${browserName} ${route}: route failed to load`);
    const state = await page.evaluate(() => {
      const article = document.querySelector('article[data-pagefind-body]');
      if (!(article instanceof HTMLElement)) throw new Error('article[data-pagefind-body] missing');
      const popups = [...article.querySelectorAll('.gtip,.tooltip,.btip')];
      return {
        text: String(article.textContent || '').replace(/\s+/g, ' ').trim(),
        articleMetaCount: article.querySelectorAll('[data-pagefind-meta]').length,
        projectedMetaCount: document.head.querySelectorAll('meta[data-reader-meta-projected="true"][data-pagefind-meta]').length,
        popupCount: popups.length,
        popupStates: popups.map((popup) => ({
          ignored: popup.hasAttribute('data-pagefind-ignore'),
          kind: popup.getAttribute('data-reader-linear-aux'),
          startBoundary: Boolean(popup.querySelector('[data-reader-linear-boundary="start"]')),
          endBoundary: Boolean(popup.querySelector('[data-reader-linear-boundary="end"]')),
        })),
      };
    });
    assert.equal(state.articleMetaCount, 0, `${browserName} ${route}: Pagefind metadata still pollutes article text tree`);
    assert.ok(state.projectedMetaCount >= 3, `${browserName} ${route}: projected head metadata missing`);
    assert.ok(state.popupCount > 0, `${browserName} ${route}: representative popup family missing`);
    assert.ok(state.popupStates.every((popup) => popup.ignored && popup.kind && popup.startBoundary && popup.endBoundary), `${browserName} ${route}: popup payload lacks semantic projection ownership`);
    assert.ok(!state.text.startsWith('/images/'), `${browserName} ${route}: article text still begins with raw local image path`);
    assert.ok(state.text.includes('⟦') && state.text.includes('⟧'), `${browserName} ${route}: auxiliary payloads remain lexically unbounded`);
    if (route.includes('krajne-li-isporcheno')) assert.ok(!state.text.includes('КархемишеБитва'), `${browserName}: Krajne glossary payload still glues to prose`);
    if (route.includes('dzhon-gill-chast-2')) assert.ok(!state.text.includes('вечный совет искупленияPactum'), `${browserName}: Gill glossary payload still glues to prose`);
    return { browser: browserName, route, state };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function pagefindMetadata(page, baseUrl, route) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
  assert.ok(response?.ok(), `${route}: route failed before Pagefind metadata check`);
  const result = await page.evaluate(async (targetRoute) => {
    const h1 = String(document.querySelector('h1')?.textContent || '').replace(/\s+/g, ' ').trim();
    if (!h1) throw new Error('H1 missing for Pagefind query');
    const pagefind = await import('/pagefind/pagefind.js');
    const search = await pagefind.search(h1);
    const items = await Promise.all((search.results || []).slice(0, 40).map((item) => item.data()));
    const normalize = (value) => {
      const url = new URL(value, location.origin);
      let pathname = decodeURIComponent(url.pathname).replace(/\/index\.html$/, '/').replace(/\.html$/, '/');
      if (!pathname.endsWith('/')) pathname += '/';
      return pathname.replace(/\/{2,}/g, '/');
    };
    return items.find((item) => normalize(item.url || '') === normalize(targetRoute)) || null;
  }, route);
  assert.ok(result?.url, `${route}: article missing from Pagefind result for its H1`);
  assert.ok(typeof result.meta?.image === 'string' && result.meta.image.length > 0, `${route}: projected Pagefind image metadata missing`);
  return { route, url: result.url, meta: result.meta };
}

async function glossaryUi(page, baseUrl, route) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
  assert.ok(response?.ok(), `${route}: route failed before glossary UI check`);
  const term = page.locator('.gterm').first();
  if (!await term.count()) return { route, skipped: true };
  await term.waitFor({ state: 'visible' });
  await term.click();
  const tip = page.locator('.gtip.is-open,.gtip.gb-floating-tip').first();
  await tip.waitFor({ state: 'visible' });
  const state = await tip.evaluate((node) => ({
    innerText: node.innerText,
    textContent: node.textContent,
    boundaryDisplays: [...node.querySelectorAll('[data-reader-linear-boundary]')].map((boundary) => getComputedStyle(boundary).display),
  }));
  assert.ok(String(state.textContent).includes('⟦') && String(state.textContent).includes('⟧'), `${route}: runtime glossary lost semantic boundaries`);
  assert.ok(!String(state.innerText).includes('⟦') && !String(state.innerText).includes('⟧'), `${route}: semantic boundary leaked into visible tooltip copy`);
  assert.ok(state.boundaryDisplays.length >= 2 && state.boundaryDisplays.every((display) => display === 'none'), `${route}: semantic boundaries are visually rendered`);
  return { route, skipped: false, state };
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  assert.ok(fs.existsSync(DIST), 'dist missing; run production-like build first');
  const server = await startServer();
  const noJs = [];
  const pagefind = [];
  const ui = [];
  try {
    for (const [browserName, browserType] of Object.entries(BROWSERS)) {
      for (const route of ROUTES) noJs.push(await inspectNoJs(browserType, browserName, server.baseUrl, route));
    }
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    try {
      for (const route of ROUTES) pagefind.push(await pagefindMetadata(page, server.baseUrl, route));
      for (const route of [ROUTES[0], ROUTES[2]]) ui.push(await glossaryUi(page, server.baseUrl, route));
    } finally {
      await context.close();
      await browser.close();
    }
  } finally {
    await server.close();
  }
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify({ schemaVersion: 1, conclusion: 'success', sha: process.env.SOURCE_SHA || '', routes: ROUTES, browsers: Object.keys(BROWSERS), noJs, pagefind, ui }, null, 2)}\n`);
  console.log(`Reader linear-text projection contract: PASS (${noJs.length} no-JS cases, ${pagefind.length} Pagefind cases)`);
}

main().catch((error) => {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify({ schemaVersion: 1, conclusion: 'failure', error: String(error?.stack || error) }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
