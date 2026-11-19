// Independent no-JS/JS Back lab — read-only, local static server with GitHub-Pages-like headers.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.argv[2];
const PORT = Number(process.argv[3] || 8790);
const OUT = process.argv[4] || '/tmp/back-lab.json';
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg', '.xml': 'application/xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(ROOT, p); if (p === "/articles/" || p === "/articles/index.html") f = process.env.VARIANT;
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  // GitHub Pages-like: cacheable, no no-store, no Vary tricks.
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'max-age=600' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, '127.0.0.1');

const exe = (process.env.CHROMIUM_PATH || '/tmp/chromium');
const base = `http://127.0.0.1:${PORT}`;
const results = [];

async function run({ bfcache, js, width, startHash }) {
  const browser = await chromium.launch({
    executablePath: exe, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    ignoreDefaultArgs: bfcache ? ['--disable-back-forward-cache'] : [],
  });
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, javaScriptEnabled: js, serviceWorkers: 'block', reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Page.enable');
  const notUsed = [];
  cdp.on('Page.backForwardCacheNotUsed', (e) => notUsed.push(...(e.notRestoredExplanations || []).map((x) => `${x.type}:${x.reason}`)));
  // Navigation-safe sampler: poll from Node (works with JS disabled since evaluate uses CDP isolated world).
  await page.goto(base + '/articles/', { waitUntil: 'load' });
  let startUrl = base + '/articles/';
  if (startHash) {
    // Real user path: click the hero link «Все материалы» → #catalog-materials
    const link = page.locator('a[href="#catalog-materials"]').first();
    if (await link.count()) { await link.click(); } else { await page.goto(base + '/articles/#catalog-materials'); }
    await page.waitForTimeout(300);
    startUrl = page.url();
  }
  // Scroll to the bottom entry (last published article link in the library list) and remember position.
  const target = page.locator('#catalog-materials a[href^="/"], #catalog-materials a[href^="../"]').last();
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => Math.round(scrollY));
  const href = await target.getAttribute('href');
  await target.click();
  await page.waitForLoadState('load');
  await page.waitForTimeout(500);
  const t0 = Date.now();
  await page.goBack({ waitUntil: 'commit' });
  const samples = [];
  for (let i = 0; i < 40; i++) {
    try { samples.push([Date.now() - t0, await page.evaluate(() => Math.round(scrollY))]); } catch { samples.push([Date.now() - t0, null]); }
    await page.waitForTimeout(100);
  }
  const final = samples.at(-1)[1];
  const info = await page.evaluate(() => ({ url: location.href, focus: document.activeElement?.tagName + (document.activeElement?.id ? '#' + document.activeElement.id : ''), navType: performance.getEntriesByType('navigation')[0]?.type, persisted: null }));
  // Did a reload happen? navigation timing type 'back_forward' with new timeOrigin => reload from network/cache; BFCache restore keeps old entry.
  const rec = { bfcacheFlagRemoved: bfcache, js, width, startHash, startUrl: startUrl.replace(base, ''), clicked: href, before, final, delta: final == null ? null : final - before, firstSamples: samples.slice(0, 4), jumpAt: samples.find(([, y]) => y != null && Math.abs(y - before) > 1)?.[0] ?? null, bfcacheNotUsed: [...new Set(notUsed)], ...info };
  results.push(rec);
  console.log(JSON.stringify(rec));
  await browser.close();
}

for (const width of [390]) for (const startHash of [true]) for (const js of [false, true]) for (const bfcache of [false]) {
  await run({ bfcache, js, width, startHash });
}
fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
server.close();
