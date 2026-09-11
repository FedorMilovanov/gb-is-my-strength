#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const COMPILED = join(DIST, 'data', 'relations.compiled.json');
const ROUTES = [
  ['/articles/podrostok-za-kadrom-dvoynaya-zhizn/', 3],
  ['/articles/podrostok-za-kadrom-roditelyam-posle-razoblacheniya/', 2],
  ['/articles/podrostok-za-kadrom-chto-delat-tserkvi/', 3],
  ['/articles/vzroslyy-rebenok-ushel-kontakt-pokayanie-vozvrashchenie/', 2],
  ['/articles/vzroslyy-rebenok-doma-dengi-pomoshch-posledstviya/', 3],
  ['/articles/sovershennoletie-roditelskaya-vlast-chto-menyaetsya/', 2],
  ['/articles/vzroslaya-doch-otets-brak-soglasie-granitsy-vlasti/', 3],
];
const REQUIRED_LATERAL_EDGES = [
  ['teen-part-i-heart-anthropology', '/articles/podrostok-za-kadrom-dvoynaya-zhizn/', '/articles/krajne-li-isporcheno-serdce/'],
  ['teen-part-iii-church-leadership', '/articles/podrostok-za-kadrom-chto-delat-tserkvi/', '/articles/20-antisovetov-pastoru/'],
  ['teen-companion-d-hermeneutics', '/articles/vzroslaya-doch-otets-brak-soglasie-granitsy-vlasti/', '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/'],
];
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

function routeFile(route) {
  return join(DIST, route.replace(/^\//, ''), 'index.html');
}
function openTagHas(tag, name) {
  return new RegExp(`\\b${name}(?:\\s*=|\\s|>)`, 'i').test(tag);
}
function attr(tag, name) {
  return tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1] || '';
}
function classes(tag) {
  return new Set(attr(tag, 'class').split(/\s+/).filter(Boolean));
}
function buttonRefs(html) {
  const out = [];
  for (const match of html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/gi)) {
    const open = match[0].match(/^<button\b[^>]*>/i)?.[0] || '';
    if (!classes(open).has('bref')) continue;
    out.push({
      ref: attr(open, 'data-ref'),
      visible: match[0].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    });
  }
  return out;
}
function sectionSlice(html, className) {
  const re = new RegExp(`<section\\b[^>]*\\bclass=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>`, 'i');
  const match = re.exec(html);
  if (!match) return null;
  const end = html.indexOf('</section>', match.index);
  if (end < 0) return null;
  return { open: match[0], html: html.slice(match.index, end + '</section>'.length) };
}
function normalizeRoute(value) {
  let route = String(value || '/').split(/[?#]/)[0];
  if (!route.startsWith('/')) route = `/${route}`;
  return route.length > 1 && !route.endsWith('/') ? `${route}/` : route;
}

if (!existsSync(DIST) || !existsSync(COMPILED)) throw new Error('production-like dist or compiled relations missing');

const compiled = JSON.parse(await readFile(COMPILED, 'utf8'));
const teenNodes = compiled.nodes
  .filter((node) => node.seriesId === 'teen-double-life')
  .sort((a, b) => a.seriesIndex - b.seriesIndex);
assert.equal(teenNodes.length, 7, 'compiled graph must expose exactly seven teen-series nodes');
assert.deepEqual(teenNodes.map((node) => normalizeRoute(node.url)), ROUTES.map(([route]) => route),
  'compiled teen node order must equal I -> II -> III -> A -> B -> C -> D');
assert.deepEqual(teenNodes.map((node) => node.seriesIndex), [1, 2, 3, 4, 5, 6, 7],
  'compiled teen seriesIndex must be contiguous 1..7');

const teenIds = new Set(teenNodes.map((node) => node.id));
const chain = compiled.edges
  .filter((edge) => edge.kind === 'series-next' && teenIds.has(edge.source) && teenIds.has(edge.target));
assert.equal(chain.length, 6, 'teen series must compile exactly six series-next edges');
for (let i = 0; i < 6; i += 1) {
  assert(chain.some((edge) => edge.source === teenNodes[i].id && edge.target === teenNodes[i + 1].id),
    `missing teen series-next edge ${i + 1} -> ${i + 2}`);
}

for (const [edgeId, sourceRoute, targetRoute] of REQUIRED_LATERAL_EDGES) {
  const sourceNode = compiled.nodes.find((node) => normalizeRoute(node.url) === sourceRoute);
  const targetNode = compiled.nodes.find((node) => normalizeRoute(node.url) === targetRoute);
  assert(sourceNode, `${edgeId}: source node missing`);
  assert(targetNode, `${edgeId}: target node missing`);
  const edge = compiled.edges.find((item) => item.id === edgeId);
  assert(edge, `${edgeId}: required lateral catalog edge missing`);
  assert.equal(edge.origin, 'catalog', `${edgeId}: lateral edge must come from canonical editorial catalog`);
  assert.equal(edge.editorialStatus, 'verified', `${edgeId}: lateral edge must be verified`);
  assert.equal(edge.source, sourceNode.id, `${edgeId}: source identity drifted`);
  assert.equal(edge.target, targetNode.id, `${edgeId}: target identity drifted`);
  const projection = compiled.projections?.byNode?.[sourceNode.id]?.article || [];
  assert(projection.some((item) => item.edgeId === edgeId && item.targetId === targetNode.id),
    `${edgeId}: required lateral edge missing from article projection`);
}

let totalRefs = 0;
for (const [route, expectedRefs] of ROUTES) {
  const html = await readFile(routeFile(route), 'utf8');
  const refs = buttonRefs(html);
  totalRefs += refs.length;
  assert.equal(refs.length, expectedRefs, `${route}: unexpected bounded Bible-reference count`);
  assert(refs.every((entry) => entry.ref && entry.visible), `${route}: empty Bible reference identity`);

  const sources = sectionSlice(html, 'sources-block');
  assert(sources, `${route}: static bibliography boundary missing`);
  assert(openTagHas(sources.open, 'data-reader-exclude'), `${route}: bibliography missing data-reader-exclude`);
  assert(openTagHas(sources.open, 'data-pagefind-ignore'), `${route}: bibliography missing data-pagefind-ignore`);
  assert.equal(buttonRefs(sources.html).length, 0, `${route}: Bible tooltip trigger leaked into bibliography`);

  const correction = sectionSlice(html, 'teen-correction-boundary');
  assert(correction, `${route}: correction boundary missing`);
  assert(openTagHas(correction.open, 'data-reader-exclude'), `${route}: correction boundary missing reader exclusion`);
  assert(openTagHas(correction.open, 'data-pagefind-ignore'), `${route}: correction boundary missing Pagefind exclusion`);
  assert(correction.html.includes('Это не линия экстренной помощи и не служба защиты.'),
    `${route}: safeguarding disclaimer missing`);
  assert(/class=["'][^"']*\bgb-accuracy-block\b/.test(correction.html),
    `${route}: shared correction owner missing`);
  assert(/href=["']mailto:/.test(correction.html), `${route}: editorial email action missing`);
  assert(/href=["']https:\/\/t\.me\//.test(correction.html), `${route}: editorial Telegram action missing`);

  const node = teenNodes.find((item) => normalizeRoute(item.url) === route);
  assert(node, `${route}: compiled node missing`);
  const projection = compiled.projections?.byNode?.[node.id];
  assert(projection, `${route}: compiled projection missing`);
  const sameSeries = new Set(teenNodes.filter((item) => item.id !== node.id).map((item) => normalizeRoute(item.url)));
  const panelCount = (html.match(/class=["'][^"']*\bgb-relations-panel\b/g) || []).length;
  if (!projection.article?.length) {
    assert.equal(panelCount, 0, `${route}: stale relation panel exists without compiler projection`);
  } else {
    assert.equal(panelCount, 1, `${route}: compiler projection must produce exactly one relation panel`);
    const hrefs = [...html.matchAll(/<a\b[^>]*\bclass=["'][^"']*\bgb-relations-panel__item\b[^"']*["'][^>]*\bhref=["']([^"']+)["']/gi)]
      .map((match) => normalizeRoute(match[1]));
    assert.equal(new Set(hrefs).size, hrefs.length, `${route}: duplicate relation targets`);
    for (const href of hrefs) assert(!sameSeries.has(href), `${route}: relation panel duplicates series rail ${href}`);
  }
}
assert.equal(totalRefs, 18, 'teen series must expose exactly 18 bounded Bible-reference triggers');

const partThree = await readFile(routeFile('/articles/podrostok-za-kadrom-chto-delat-tserkvi/'), 'utf8');
assert(partThree.includes('data-ref="Псалтирь 49:16–21"'), 'Psalm 49 Synodal machine identity missing');
assert(partThree.includes('>Пс. 49:16–21</button>'), 'Psalm 49 Synodal visible numbering drifted');

async function serve() {
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(String(req.url || '/').split('?')[0]);
      let file = join(DIST, pathname.replace(/^\//, ''));
      try {
        if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      } catch {}
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

const { server, base } = await serve();
let browser;
try {
  const pinned = process.env.GB_PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  browser = await chromium.launch(existsSync(pinned) ? { executablePath: pinned } : {});

  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(base + ROUTES[0][0], { waitUntil: 'networkidle', timeout: 40_000 });
    const trigger = page.locator('.bref[data-ref]').first();
    await trigger.focus();
    const tip = page.locator('.btip.is-open').last();
    await tip.waitFor({ state: 'visible', timeout: 10_000 });
    const expectedRef = await trigger.getAttribute('data-ref');
    assert.equal((await tip.locator('.btip__reference').textContent())?.trim(), expectedRef,
      'desktop tooltip reference identity drifted');
    const bounds = await tip.boundingBox();
    assert(bounds && bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= 1281 && bounds.y + bounds.height <= 801,
      'desktop Bible tooltip escapes viewport');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelectorAll('.btip.is-open').length === 0);
    await context.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const route = '/articles/vzroslaya-doch-otets-brak-soglasie-granitsy-vlasti/';
    await page.goto(base + route, { waitUntil: 'networkidle', timeout: 40_000 });
    const trigger = page.locator('.bref[data-ref="1 Коринфянам 7:36–38"]');
    assert.equal(await trigger.count(), 1, 'mobile disputed-text Bible trigger missing');
    await trigger.click();
    const tip = page.locator('.btip.is-open').last();
    await tip.waitFor({ state: 'visible', timeout: 10_000 });
    assert.equal((await tip.locator('.btip__reference').textContent())?.trim(), '1 Коринфянам 7:36–38',
      'mobile disputed-text tooltip identity drifted');
    assert.equal(await page.locator('html').getAttribute('data-gb-article-tooltips-owner'),
      'article-inline-tooltip', 'shared tooltip owner not claimed');
    const bounds = await tip.boundingBox();
    assert(bounds && bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= 391 && bounds.y + bounds.height <= 845,
      'mobile Bible tooltip escapes viewport');
    const correction = page.locator('.teen-correction-boundary');
    assert.equal(await correction.count(), 1, 'mobile correction boundary missing');
    assert(await correction.locator('.gb-accuracy-btn--email').isVisible(), 'mobile correction email action hidden');
    assert(await correction.locator('.gb-accuracy-btn--tg').isVisible(), 'mobile correction Telegram action hidden');
    await trigger.click();
    await page.waitForFunction(() => document.querySelectorAll('.btip.is-open').length === 0);
    await context.close();
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log('✅ Teen runtime closure PASS');
console.log('  compiled relations: 7 teen nodes / 6 series-next edges / 3 verified lateral catalog edges');
console.log('  correction boundary: 7/7 shared owner + safeguarding disclaimer');
console.log('  Scripture UX: 18 bounded .bref[data-ref] triggers; desktop + mobile interaction');
console.log('  Psalm guard: visible Пс. 49:16–21 / machine Псалтирь 49:16–21');
