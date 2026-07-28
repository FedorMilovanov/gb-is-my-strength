#!/usr/bin/env node
/**
 * Browser and corpus contracts for compiler-owned static article relations.
 *
 * The relation surface must be independent from every browser runtime. Some
 * transitional reader routes still load site.js for unrelated footnote/share
 * duties; those routes are inventoried, not misclassified as relation defects.
 */
import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const COMPILED_PATH = join(DIST, 'data', 'relations.compiled.json');
const PROJECTION_REPORT_PATH = join(ROOT, 'reports', 'relation-projection.json');
const PUBLIC_REPORT_DIR = join(DIST, 'reports');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2',
};
const CASES = [
  {
    id: 'dzhon-gill-chast-1-chelovek',
    route: '/articles/dzhon-gill-chast-1-chelovek/',
    forbidden: [
      '/articles/dzhon-gill-chast-2-uchenyi/',
      '/articles/dzhon-gill-chast-3-nasledie/',
      '/articles/dzhon-gill-chast-4-ekzeget/',
      '/articles/dzhon-gill-spravochnik/',
    ],
  },
  { id: '20-antisovetov-pastoru', route: '/articles/20-antisovetov-pastoru/', forbidden: [] },
];
const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} Relations · ${name}${detail ? ` — ${detail}` : ''}`);
}

function relevantConsoleError(message) {
  const value = String(message || '');
  const localOriginProductionIcon = /Loading the image 'https:\/\/gospod-bog\.ru\/(?:favicon|apple-touch-icon|icons\/icon-)/.test(value)
    && /Content Security Policy directive/.test(value);
  return !localOriginProductionIcon;
}

function normalizeRoute(value) {
  let route = String(value || '/').split(/[?#]/)[0].replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  if (!route.startsWith('/')) route = `/${route}`;
  return route.length > 1 && !route.endsWith('/') ? `${route}/` : route || '/';
}

function routeForFile(file) {
  let route = relative(DIST, file).split(sep).join('/');
  if (route === 'index.html') return '/';
  if (route.endsWith('/index.html')) route = route.slice(0, -'index.html'.length);
  return normalizeRoute(`/${route}`);
}

async function walkHtml(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const target = join(dir, entry.name);
    if (entry.isDirectory()) await walkHtml(target, out);
    else if (target.endsWith('.html')) out.push(target);
  }
  return out;
}

function matchesAll(value, pattern) {
  return Array.from(String(value || '').matchAll(pattern));
}

async function staticCorpusScene(compiled, nodeMap) {
  const issues = [];
  const sources = new Set();
  const transitionalReaderRuntimes = [];
  const files = await walkHtml(DIST);
  const report = JSON.parse(await readFile(PROJECTION_REPORT_PATH, 'utf8'));
  let panelFiles = 0;

  for (const file of files) {
    const html = await readFile(file, 'utf8');
    if (!html.includes('gb-relations-panel')) continue;
    panelFiles += 1;
    const route = routeForFile(file);
    const panelStarts = matchesAll(html, /<nav\b[^>]*\bclass=["'][^"']*\bgb-relations-panel\b[^"']*["'][^>]*>/gi);
    if (panelStarts.length !== 1) {
      issues.push(`${route}: ${panelStarts.length} relation panels`);
      continue;
    }
    const panelStart = panelStarts[0].index;
    const panelEnd = html.indexOf('</nav>', panelStart);
    if (panelEnd < panelStart) {
      issues.push(`${route}: unclosed relation panel`);
      continue;
    }
    const panel = html.slice(panelStart, panelEnd + '</nav>'.length);
    const source = panel.match(/\bdata-relation-source=["']([^"']+)["']/i)?.[1] || '';
    const engine = panel.match(/\bdata-relation-engine=["']([^"']+)["']/i)?.[1] || '';
    const node = nodeMap.get(source);
    const projection = compiled.projections?.byNode?.[source];
    const hrefs = matchesAll(panel, /<a\b[^>]*\bclass=["'][^"']*\bgb-relations-panel__item\b[^"']*["'][^>]*\bhref=["']([^"']+)["']/gi)
      .map((match) => normalizeRoute(match[1]));
    const edges = matchesAll(panel, /\bdata-relation-edge=["']([^"']+)["']/gi).map((match) => match[1]);
    const kinds = matchesAll(panel, /\bdata-relation-kind=["']([^"']+)["']/gi).map((match) => match[1]);
    const atlas = panel.match(/<a\b[^>]*\bclass=["'][^"']*\bgb-relations-panel__atlas\b[^"']*["'][^>]*\bhref=["']([^"']+)["']/i)?.[1] || '';
    const cssRefs = matchesAll(html, /<link\b[^>]*\bhref=["'][^"']*\/css\/relationship-panel\.css(?:\?[^"']*)?["'][^>]*>/gi).length;
    const siteScripts = matchesAll(html, /<script\b[^>]*\bsrc=["'][^"']*\/js\/site\.js(?:\?[^"']*)?["'][^>]*>/gi).length;
    const relationScripts = matchesAll(html, /<script\b[^>]*\bsrc=["'][^"']*\/js\/relationship-panel\.js(?:\?[^"']*)?["'][^>]*>/gi).length;
    const oldBlocks = matchesAll(html, /\bclass=["'][^"']*\bgbx-backlinks\b[^"']*["']/gi).length;
    const rawGraphReferences = matchesAll(html, /\/data\/(?:links-graph|series)\.json/gi).length;
    const sameSeriesUrls = node?.seriesId
      ? new Set(compiled.nodes.filter((item) => item.id !== source && item.seriesId === node.seriesId).map((item) => normalizeRoute(item.url)))
      : new Set();
    const sameSeriesTargets = hrefs.filter((href) => sameSeriesUrls.has(href));

    if (!source || !node || sources.has(source)) issues.push(`${route}: invalid or duplicate source ${source || '<missing>'}`);
    else sources.add(source);
    if (engine !== '1') issues.push(`${route}: engine=${engine || '<missing>'}`);
    if (node && normalizeRoute(node.url) !== route) issues.push(`${route}: source ${source} owns ${node.url}`);
    if (!projection || projection.article.length < 1 || projection.article.length > 4) issues.push(`${route}: invalid compiler projection`);
    if (hrefs.length < 1 || hrefs.length > 4) issues.push(`${route}: ${hrefs.length} visible targets`);
    if (new Set(hrefs).size !== hrefs.length) issues.push(`${route}: duplicate targets`);
    if (edges.length !== hrefs.length || new Set(edges).size !== edges.length) issues.push(`${route}: edge identity mismatch`);
    if (kinds.length !== hrefs.length) issues.push(`${route}: relation kind mismatch`);
    if (sameSeriesTargets.length) issues.push(`${route}: same-series targets ${sameSeriesTargets.join(', ')}`);
    if (atlas !== `/map/?focus=${encodeURIComponent(source)}`) issues.push(`${route}: invalid Atlas focus ${atlas}`);
    if (cssRefs !== 1) issues.push(`${route}: ${cssRefs} relation stylesheets`);
    if (siteScripts) transitionalReaderRuntimes.push({ route, siteScripts });
    if (relationScripts) issues.push(`${route}: obsolete relationship runtime loaded`);
    if (oldBlocks) issues.push(`${route}: ${oldBlocks} legacy backlink blocks`);
    if (rawGraphReferences) issues.push(`${route}: ${rawGraphReferences} raw graph references`);
  }

  if (panelFiles !== Number(report.projectedPanels)) {
    issues.push(`corpus count ${panelFiles} != projector report ${report.projectedPanels}`);
  }
  if (sources.size !== panelFiles) issues.push(`unique sources ${sources.size} != panel files ${panelFiles}`);
  if (panelFiles < 1) issues.push('no projected relation panels found');

  record('entire projected HTML corpus', issues.length === 0,
    JSON.stringify({
      panelFiles,
      uniqueSources: sources.size,
      projectorPanels: report.projectedPanels,
      transitionalReaderRuntimes,
      issues: issues.slice(0, 30),
    }));
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

async function inspect(page, spec, node, viewport) {
  return page.evaluate(({ spec, expectedTitle, viewportWidth }) => {
    const panels = Array.from(document.querySelectorAll('.gb-relations-panel'));
    const panel = panels[0];
    const links = Array.from(panel?.querySelectorAll('.gb-relations-panel__item[href]') || []);
    const hrefs = links.map((link) => link.getAttribute('href'));
    const edges = links.map((link) => link.getAttribute('data-relation-edge'));
    const panelRect = panel?.getBoundingClientRect();
    const targetRect = links[0]?.getBoundingClientRect();
    const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .filter((link) => String(link.getAttribute('href')).includes('/css/relationship-panel.css'));
    const runtimeScripts = Array.from(document.scripts)
      .filter((script) => String(script.src || '').includes('/js/relationship-panel.js'));
    const legacySiteScripts = Array.from(document.scripts)
      .filter((script) => new URL(script.src || location.href).pathname === '/js/site.js');
    const legacyBlocks = Array.from(document.querySelectorAll('.gbx-backlinks')).map((block) => ({
      tag: block.tagName.toLowerCase(),
      className: block.className,
      id: block.id,
      parent: block.parentElement?.className || block.parentElement?.tagName?.toLowerCase() || '',
      heading: block.querySelector('h2,h3,h4')?.textContent?.trim() || '',
      text: block.textContent?.replace(/\s+/g, ' ').trim().slice(0, 180) || '',
    }));
    return {
      panels: panels.length,
      source: panel?.getAttribute('data-relation-source') || '',
      engine: panel?.getAttribute('data-relation-engine') || '',
      heading: panel?.querySelector('h2')?.textContent?.trim() || '',
      expectedTitle,
      links: links.length,
      uniqueTargets: new Set(hrefs).size === hrefs.length,
      uniqueEdges: new Set(edges).size === edges.length,
      kindsComplete: links.every((link) => Boolean(link.getAttribute('data-relation-kind'))),
      forbidden: spec.forbidden.filter((href) => hrefs.includes(href)),
      oldBlocks: legacyBlocks.length,
      legacyBlocks,
      atlas: panel?.querySelector('.gb-relations-panel__atlas')?.getAttribute('href') || '',
      panelRect: panelRect ? { left: panelRect.left, right: panelRect.right, width: panelRect.width } : null,
      targetRect: targetRect ? { width: targetRect.width, height: targetRect.height } : null,
      stylesheets: stylesheets.length,
      runtimeScripts: runtimeScripts.length,
      legacySiteScripts: legacySiteScripts.length,
      scripts: Array.from(document.scripts).map((script) => script.src || '[inline]').filter((src, index, all) => all.indexOf(src) === index),
      radius: panel ? getComputedStyle(panel).borderRadius : '',
      overflow: document.documentElement.scrollWidth - viewportWidth,
    };
  }, {
    spec,
    expectedTitle: node.seriesId ? 'Контекст и связи' : 'Продолжить исследование',
    viewportWidth: viewport.width,
  });
}

function valid(state, spec, viewport) {
  return state.panels === 1 && state.engine === '1' && state.source === spec.id
    && state.heading === state.expectedTitle && state.links >= 1 && state.links <= 4
    && state.uniqueTargets && state.uniqueEdges && state.kindsComplete
    && state.forbidden.length === 0 && state.oldBlocks === 0
    && state.atlas === `/map/?focus=${encodeURIComponent(spec.id)}`
    && state.panelRect && state.panelRect.left >= -1 && state.panelRect.right <= viewport.width + 1
    && state.targetRect && state.targetRect.width > 180 && state.targetRect.height >= 44
    && state.stylesheets === 1 && state.runtimeScripts === 0 && state.legacySiteScripts === 0
    && state.radius !== '0px' && state.overflow <= 2;
}

async function scene(browser, base, spec, node, viewport, javaScriptEnabled) {
  const context = await browser.newContext({ viewport, javaScriptEnabled });
  const page = await context.newPage();
  const errors = [];
  const forbiddenRequests = [];
  const initiators = [];
  let cdp;
  if (javaScriptEnabled) {
    cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    cdp.on('Network.requestWillBeSent', (event) => {
      const pathname = new URL(event.request.url).pathname;
      if (/^\/data\/(?:links-graph|series|relations\.compiled)\.json$/.test(pathname)
        || pathname === '/js/relationship-panel.js' || pathname === '/js/site.js') {
        initiators.push({
          pathname,
          type: event.initiator?.type || '',
          url: event.initiator?.url || '',
          stack: (event.initiator?.stack?.callFrames || []).slice(0, 6).map((frame) => ({
            functionName: frame.functionName,
            url: frame.url,
            lineNumber: frame.lineNumber,
            columnNumber: frame.columnNumber,
          })),
        });
      }
    });
  }
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error' && relevantConsoleError(message.text())) errors.push(message.text());
  });
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (/^\/data\/(?:links-graph|series|relations\.compiled)\.json$/.test(pathname)
      || pathname === '/js/relationship-panel.js' || pathname === '/js/site.js') forbiddenRequests.push(pathname);
  });
  const label = `${spec.id} ${viewport.width}px ${javaScriptEnabled ? 'JS' : 'no-JS'}`;
  try {
    await page.goto(base + spec.route, { waitUntil: javaScriptEnabled ? 'networkidle' : 'load', timeout: 40_000 });
    await page.waitForSelector('.gb-relations-panel', { timeout: 10_000 });
    const state = await inspect(page, spec, node, viewport);
    record(label, valid(state, spec, viewport) && errors.length === 0 && forbiddenRequests.length === 0,
      JSON.stringify({ ...state, errors, forbiddenRequests, initiators }));
  } catch (error) { record(label, false, String(error).slice(0, 500)); }
  finally {
    await cdp?.detach().catch(() => {});
    await context.close();
  }
}

async function failureIsolation(browser, base, spec, node) {
  const viewport = { width: 390, height: 844 };
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.route('**/data/*.json', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"forced"}' }));
  await page.route('**/js/relationship-panel.js*', (route) => route.abort('failed'));
  try {
    await page.goto(base + spec.route, { waitUntil: 'networkidle', timeout: 40_000 });
    const state = await inspect(page, spec, node, viewport);
    record('data/runtime failure isolation', valid(state, spec, viewport), JSON.stringify(state));
  } catch (error) { record('data/runtime failure isolation', false, String(error).slice(0, 500)); }
  finally { await context.close(); }
}

async function printScene(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto(`${base}/articles/20-antisovetov-pastoru/`, { waitUntil: 'networkidle', timeout: 40_000 });
    await page.waitForSelector('.gb-relations-panel');
    await page.emulateMedia({ media: 'print' });
    const display = await page.locator('.gb-relations-panel').evaluate((node) => getComputedStyle(node).display);
    record('print exclusion', display === 'none', `display=${display}`);
  } catch (error) { record('print exclusion', false, String(error).slice(0, 500)); }
  finally { await context.close(); }
}

if (!existsSync(DIST) || !existsSync(COMPILED_PATH) || !existsSync(PROJECTION_REPORT_PATH)) {
  console.error('❌ production-like dist, compiled relation endpoint or private projection report missing');
  process.exit(1);
}
if (existsSync(PUBLIC_REPORT_DIR)) {
  console.error('❌ private relation diagnostics leaked into dist/reports');
  process.exit(1);
}
if (existsSync(join(DIST, 'js', 'relationship-panel.js'))) {
  console.error('❌ obsolete dist/js/relationship-panel.js exists');
  process.exit(1);
}
const compiled = JSON.parse(await readFile(COMPILED_PATH, 'utf8'));
const nodeMap = new Map(compiled.nodes.map((node) => [node.id, node]));
await staticCorpusScene(compiled, nodeMap);

const { server, base } = await serve();
let browser;
try {
  const pinned = process.env.GB_PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  browser = await chromium.launch(existsSync(pinned) ? { executablePath: pinned } : {});
  for (const spec of CASES) {
    const node = nodeMap.get(spec.id);
    if (!node) { record(`${spec.id} compiled node`, false, 'missing'); continue; }
    await scene(browser, base, spec, node, { width: 1440, height: 950 }, true);
    await scene(browser, base, spec, node, { width: 390, height: 844 }, true);
    await scene(browser, base, spec, node, { width: 390, height: 844 }, false);
  }
  await failureIsolation(browser, base, CASES[0], nodeMap.get(CASES[0].id));
  await printScene(browser, base);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}

const failures = results.filter((result) => !result.ok);
console.log(`\nStatic relationship panel contract: ${results.length - failures.length}/${results.length} passed`);
if (failures.length) process.exit(1);
