#!/usr/bin/env node
/** Browser proof for Atlas filter, detail-count and deep-link state ownership. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const COMPILED = join(DIST, 'data', 'relations.compiled.json');
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

function fail(message, detail = '') {
  console.error(`❌ Atlas state · ${message}${detail ? ` — ${detail}` : ''}`);
  process.exitCode = 1;
}

function pass(message, detail = '') {
  console.log(`✅ Atlas state · ${message}${detail ? ` — ${detail}` : ''}`);
}

async function serve() {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(String(request.url || '/').split('?')[0]);
      let file = join(DIST, pathname);
      try {
        if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      } catch {
        file = join(ROOT, pathname);
      }
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

const compiled = JSON.parse(await readFile(COMPILED, 'utf8'));
const degrees = new Map(compiled.nodes.map((node) => [node.id, []]));
for (const edge of compiled.edges) {
  degrees.get(edge.source)?.push(edge);
  degrees.get(edge.target)?.push(edge);
}
const candidate = compiled.nodes
  .map((node) => ({ node, edges: degrees.get(node.id) || [] }))
  .filter((entry) => new Set(entry.edges.map((edge) => edge.atlasKind)).size >= 2)
  .sort((a, b) => b.edges.length - a.edges.length || a.node.id.localeCompare(b.node.id))[0];

if (!candidate) {
  fail('fixture graph has no multi-kind focus candidate');
  process.exit(1);
}

const kindCounts = new Map();
for (const edge of candidate.edges) kindCounts.set(edge.atlasKind, (kindCounts.get(edge.atlasKind) || 0) + 1);
const disabledKind = [...kindCounts.entries()]
  .filter(([, count]) => candidate.edges.length - count > 0)
  .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0]?.[0];

if (!disabledKind) {
  fail('fixture graph cannot preserve a focused neighbor after filtering');
  process.exit(1);
}

const expectedAll = candidate.edges.length;
const expectedFiltered = expectedAll - kindCounts.get(disabledKind);
const { server, base } = await serve();
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

  await page.goto(`${base}/map/`, { waitUntil: 'networkidle', timeout: 40_000 });
  await page.waitForSelector('#atlasApp[data-runtime-ready="1"]', { timeout: 20_000 });
  await page.locator(`[data-node-id="${candidate.node.id}"]`).click();
  await page.waitForSelector('#atlasDetail.is-open .atlas-detail__content:not([hidden])', { timeout: 10_000 });

  const readFocusState = () => page.evaluate(() => {
    const meta = document.querySelectorAll('#atlasDetailContent .atlas-detail__meta span');
    return {
      url: location.href,
      countText: (meta[1]?.textContent || '').trim(),
      buttons: document.querySelectorAll('#atlasDetailContent [data-detail-focus]').length,
      focusEdges: document.querySelectorAll('.atlas-edge.is-focus:not(.is-filtered-out)').length,
      activeNode: document.querySelector('.atlas-node.is-focus')?.getAttribute('data-node-id') || '',
      hasDetail: document.getElementById('atlasApp')?.classList.contains('has-detail') || false,
    };
  });

  const initial = await readFocusState();
  const initialUrl = new URL(initial.url);
  const initialOk = initialUrl.searchParams.get('focus') === candidate.node.id
    && Number.parseInt(initial.countText, 10) === expectedAll
    && initial.buttons === Math.min(7, expectedAll)
    && initial.focusEdges === expectedAll
    && initial.activeNode === candidate.node.id
    && initial.hasDetail;
  if (initialOk) pass('full detail count is not capped by seven rendered neighbors', JSON.stringify({ node: candidate.node.id, expectedAll, initial }));
  else fail('full detail count/focus contract', JSON.stringify({ node: candidate.node.id, expectedAll, initial }));

  const filter = page.locator(`.atlas-relation-filter input[value="${disabledKind}"]`);
  await filter.uncheck({ force: true });
  await page.waitForFunction(({ nodeId, count }) => {
    const meta = document.querySelectorAll('#atlasDetailContent .atlas-detail__meta span');
    return new URL(location.href).searchParams.get('focus') === nodeId
      && Number.parseInt(meta[1]?.textContent || '', 10) === count;
  }, { nodeId: candidate.node.id, count: expectedFiltered });

  const filtered = await readFocusState();
  const filteredUrl = new URL(filtered.url);
  const filteredOk = filteredUrl.searchParams.get('focus') === candidate.node.id
    && Number.parseInt(filtered.countText, 10) === expectedFiltered
    && filtered.buttons === Math.min(7, expectedFiltered)
    && filtered.focusEdges === expectedFiltered
    && filtered.activeNode === candidate.node.id
    && filtered.hasDetail;
  if (filteredOk) pass('relation filter refreshes active focus and detail semantics', JSON.stringify({ disabledKind, expectedFiltered, filtered }));
  else fail('filtered active-focus contract', JSON.stringify({ disabledKind, expectedFiltered, filtered }));

  await page.locator(`[data-atlas-group="${candidate.node.atlasGroup}"]`).click();
  await page.waitForFunction((group) => {
    const url = new URL(location.href);
    return url.searchParams.get('group') === group
      && !url.searchParams.has('focus')
      && !document.getElementById('atlasApp')?.classList.contains('has-detail');
  }, candidate.node.atlasGroup);

  const grouped = await page.evaluate(() => ({
    url: location.href,
    hasDetail: document.getElementById('atlasApp')?.classList.contains('has-detail') || false,
    focusedNodes: document.querySelectorAll('.atlas-node.is-focus').length,
    detailOpen: document.getElementById('atlasDetail')?.classList.contains('is-open') || false,
  }));
  const groupedUrl = new URL(grouped.url);
  const groupOk = groupedUrl.searchParams.get('group') === candidate.node.atlasGroup
    && !groupedUrl.searchParams.has('focus')
    && !grouped.hasDetail
    && grouped.focusedNodes === 0
    && !grouped.detailOpen;
  if (groupOk) pass('group navigation clears stale focus from DOM and URL', JSON.stringify(grouped));
  else fail('group/focus deep-link contract', JSON.stringify(grouped));

  if (errors.length) fail('browser console remained clean', JSON.stringify(errors));
  else pass('browser console remained clean');
} catch (error) {
  fail('browser contract crashed', String(error?.stack || error).slice(0, 1200));
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`\n✅ Atlas state browser contract completed for ${candidate.node.id}`);
