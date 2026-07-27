#!/usr/bin/env node
/**
 * Production-like browser contract for statically projected article relations.
 * No graph fetch or relationship JavaScript is allowed on article routes.
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
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2',
};
const CASES = [
  {
    id: 'dzhon-gill-chast-1-chelovek',
    route: '/articles/dzhon-gill-chast-1-chelovek/',
    title: 'Контекст и связи',
    forbidden: [
      '/articles/dzhon-gill-chast-2-uchenyi/',
      '/articles/dzhon-gill-chast-3-nasledie/',
      '/articles/dzhon-gill-chast-4-ekzeget/',
      '/articles/dzhon-gill-spravochnik/',
    ],
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
      try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); }
      catch { file = join(ROOT, pathname); }
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

async function inspectPanel(page, spec, viewport) {
  return page.evaluate(({ expectedTitle, forbidden, id, viewportWidth }) => {
    const panels = Array.from(document.querySelectorAll('.gb-relations-panel'));
    const panel = panels[0];
    const heading = panel?.querySelector('h2')?.textContent?.trim() || '';
    const itemLinks = Array.from(panel?.querySelectorAll('.gb-relations-panel__item[href]') || []);
    const hrefs = itemLinks.map((link) => link.getAttribute('href'));
    const kinds = itemLinks.map((link) => link.getAttribute('data-relation-kind'));
    const edgeIds = itemLinks.map((link) => link.getAttribute('data-relation-edge'));
    const rect = panel?.getBoundingClientRect();
    const firstRect = itemLinks[0]?.getBoundingClientRect();
    const atlasHref = panel?.querySelector('.gb-relations-panel__atlas')?.getAttribute('href') || '';
    const stylesheet = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).filter((link) => String(link.getAttribute('href')).includes('/css/relationship-panel.css'));
    const runtimeScripts = Array.from(document.scripts).filter((script) => String(script.src || '').includes('/js/relationship-panel.js'));
    return {
      panels: panels.length,
      staticMarker: panel?.getAttribute('data-relation-engine') || '',
      sourceMarker: panel?.getAttribute('data-relation-source') || '',
      heading,
      expectedTitle,
      links: hrefs.length,
      hrefs,
      kinds,
      edgeIds,
      uniqueTargets: new Set(hrefs).size === hrefs.length,
      uniqueEdges: new Set(edgeIds).size === edgeIds.length,
      forbiddenFound: forbidden.filter((href) => hrefs.includes(href)),
      oldBlocks: document.querySelectorAll('.gbx-backlinks').length,
      atlasHref,
      atlasCorrect: atlasHref === `/map/?focus=${encodeURIComponent(id)}`,
      panel: rect ? { width: rect.width, left: rect.left, right: rect.right } : null,
      firstTarget: firstRect ? { width: firstRect.width, height: firstRect.height } : null,
      stylesheetCount: stylesheet.length,
      runtimeScripts: runtimeScripts.length,
      radius: panel ? getComputedStyle(panel).borderRadius : '',
      overflow: document.documentElement.scrollWidth - viewportWidth,
    };
  }, { expectedTitle: spec.title, forbidden: spec.forbidden, id: spec.id, viewportWidth: viewport.width });
}

function panelStateOk(state, viewport) {
  const widthOk = state.panel && state.panel.left >= -1 && state.panel.right <= viewport.width + 1;
  const targetOk = state.firstTarget && state.firstTarget.width > 180 && state.firstTarget.height >= 44;
  return state.panels === 1 && state.staticMarker === '1' && state.sourceMarker
    && state.heading === state.expectedTitle && state.links >= 1 && state.links <= 4
    && state.uniqueTargets && state.uniqueEdges && state.kinds.every(Boolean)
    && state.forbiddenFound.length === 0 && state.oldBlocks === 0
    && state.atlasCorrect && state.stylesheetCount === 1 && state.runtimeScripts === 0
    && widthOk && targetOk && state.overflow <= 2 && state.radius !== '0px';
}

async function normalCase(browser, base, spec, viewport, javaScriptEnabled) {
  const context = await browser.newContext({ viewport, javaScriptEnabled });
  const page = await context.newPage();
  const errors = [];
  const forbiddenRequests = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', (request) => {
    const url = request.url();
    if (/\/data\/(?:links-graph|series|relations\.compiled)\.json/.test(url) || /\/js\/relationship-panel\.js/.test(url)) {
      forbiddenRequests.push(url);
    }
  });
  try {
    await page.goto(base + spec.route, { waitUntil: javaScriptEnabled ? 'networkidle' : 'load', timeout: 40_000 });
    await page.waitForSelector('.gb-relations-panel', { timeout: 10_000 });
    const state = await inspectPanel(page, spec, viewport);
    const mode = javaScriptEnabled ? 'JS' : 'no-JS';
    record(`${spec.id} ${viewport.width}px ${mode}`,
      panelStateOk(state, viewport) && errors.length === 0 && forbiddenRequests.length === 0,
      JSON.stringify({ ...state, errors, forbiddenRequests }));
  } catch (error) {
    record(`${spec.id} ${viewport.width}px ${javaScriptEnabled ? 'JS' : 'no-JS'}`, false, String(error).slice(0, 400));
  } finally {
    await context.close();
  }
}

async function staticFailureIsolation(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route('**/data/*.json', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"forced data failure"}' }));
  await page.route('**/js/relationship-panel.js*', (route) => route.abort('failed'));
  try {
    await page.goto(`${base}/articles/dzhon-gill-chast-1-chelovek/`, { waitUntil: 'networkidle', timeout: 40_000 });
    const state = await inspectPanel(page, CASES[0], { width: 390, height: 844 });
    record('data/runtime failure cannot remove static panel', panelStateOk(state, { width: 390, height: 844 }), JSON.stringify(state));
  } catch (error) {
    record('data/runtime failure cannot remove static panel', false, String(error).slice(0, 400));
  } finally {
    await context.close();
  }
}

async function printCase(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto(`${base}/articles/20-antisovetov-pastoru/`, { waitUntil: 'networkidle', timeout: 40_000 });
    await page.waitForSelector('.gb-relations-panel', { timeout: 10_000 });
    await page.emulateMedia({ media: 'print' });
    const display = await page.locator('.gb-relations-panel').evaluate((node) => getComputedStyle(node).display);
    record('print keeps navigation out of canonical PDF', display === 'none', `display=${display}`);
  } catch (error) {
    record('print keeps navigation out of canonical PDF', false, String(error).slice(0, 400));
  } finally {
    await context.close();
  }
}

if (!existsSync(DIST)) {
  console.error('❌ dist/ missing; build production-like output before relationship panel contract');
  process.exit(1);
}
if (existsSync(join(DIST, 'js', 'relationship-panel.js'))) {
  console.error('❌ obsolete dist/js/relationship-panel.js exists');
  process.exit(1);
}

const { server, base } = await serve();
let browser;
try {
  const pinned = process.env.GB_PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  browser = await chromium.launch(existsSync(pinned) ? { executablePath: pinned } : {});
  for (const spec of CASES) {
    await normalCase(browser, base, spec, { width: 1440, height: 950 }, true);
    await normalCase(browser, base, spec, { width: 390, height: 844 }, true);
    await normalCase(browser, base, spec, { width: 390, height: 844 }, false);
  }
  await staticFailureIsolation(browser, base);
  await printCase(browser, base);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}

const failures = results.filter((result) => !result.ok);
console.log(`\nStatic relationship panel contract: ${results.length - failures.length}/${results.length} passed`);
if (failures.length) process.exit(1);
