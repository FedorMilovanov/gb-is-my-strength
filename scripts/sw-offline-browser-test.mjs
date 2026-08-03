#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const REPORT_DIR = path.join(ROOT, 'reports');
const swSource = fs.readFileSync(path.join(DIST, 'sw.js'), 'utf8');
const currentVersion = swSource.match(/\bCACHE_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1];
assert.ok(currentVersion, 'dist/sw.js must expose CACHE_VERSION');
const oldVersion = 'gb-v192-a07-fixture-20260731';
const pagefindDataFile = findFirst(path.join(DIST, 'pagefind'), (file) => /[\\/](?:fragment|index)[\\/]/.test(file));
assert.ok(pagefindDataFile, 'production-like dist must contain Pagefind index/fragment data');
const pagefindDataPath = `/${path.relative(DIST, pagefindDataFile).replace(/\\/g, '/')}`;

const state = {
  release: 'old',
  failPrecachePath: '',
  dataValue: 'old',
  requestCounts: new Map(),
};

function findFirst(root, predicate) {
  if (!fs.existsSync(root)) return null;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const found = findFirst(file, predicate);
      if (found) return found;
    } else if (entry.isFile() && predicate(file)) return file;
  }
  return null;
}

function count(pathname) {
  state.requestCounts.set(pathname, (state.requestCounts.get(pathname) || 0) + 1);
}

function contentType(file) {
  const extension = path.extname(file).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ico': 'image/x-icon',
    '.wasm': 'application/wasm',
  })[extension] || 'application/octet-stream';
}

function fixtureHtml(release) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>A07 ${release}</title><meta name="a07-release" content="${release}"></head><body><main><h1>A07 ${release}</h1></main></body></html>`;
}

function send(response, status, type, body, headers = {}) {
  response.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
    ...headers,
  });
  response.end(body);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const pathname = decodeURIComponent(url.pathname);
  count(pathname);

  if (state.failPrecachePath && pathname === state.failPrecachePath) {
    send(response, 503, 'text/plain; charset=utf-8', 'A07 forced precache failure');
    return;
  }
  if (pathname === '/sw.js') {
    const source = state.release === 'old' ? swSource.replaceAll(currentVersion, oldVersion) : swSource;
    send(response, 200, 'application/javascript; charset=utf-8', source, { 'service-worker-allowed': '/' });
    return;
  }
  if (pathname === '/__a07_fixture__/' || pathname === '/__a07_fixture__/index.html') {
    send(response, 200, 'text/html; charset=utf-8', fixtureHtml(state.release));
    return;
  }
  if (pathname === '/data/a07-offline-fixture.json') {
    send(response, 200, 'application/json; charset=utf-8', JSON.stringify({ value: state.dataValue }));
    return;
  }
  if (pathname === '/audio/a07-model.bin') {
    send(response, 200, 'application/octet-stream', Buffer.from(`audio-${state.release}`));
    return;
  }
  if (pathname === '/404.html') {
    send(response, 200, 'text/html; charset=utf-8', '<!doctype html><html><head><title>A07 offline fallback</title></head><body><h1>A07_OFFLINE_FALLBACK</h1></body></html>');
    return;
  }

  const relative = pathname.replace(/^\/+/, '');
  const requested = path.resolve(DIST, relative || 'index.html');
  if (!requested.startsWith(path.resolve(DIST) + path.sep) && requested !== path.resolve(DIST, 'index.html')) {
    send(response, 403, 'text/plain; charset=utf-8', 'forbidden');
    return;
  }
  let file = requested;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    send(response, 404, 'text/plain; charset=utf-8', 'not found');
    return;
  }
  send(response, 200, contentType(file), fs.readFileSync(file));
});

async function registerAndControl(page) {
  await page.goto(`${baseUrl}/__a07_fixture__/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js?fixture=1', { scope: '/' });
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  // clients.claim() can control the registration document without routing that
  // already-finished navigation through fetch. Reload once under the active
  // worker so the cold route cache witness is deterministic and production-real.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
}

async function releaseMarker(page) {
  return page.locator('meta[name="a07-release"]').getAttribute('content');
}

async function responseDigest(page, url) {
  return page.evaluate(async (target) => {
    const response = await fetch(target);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { status: response.status, length: bytes.length, text: new TextDecoder().decode(bytes.slice(0, 200)) };
  }, url);
}

const results = [];
function pass(name, detail = '') {
  results.push({ name, status: 'pass', detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`);
}

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });

try {
  state.release = 'new';
  state.failPrecachePath = '/css/site.css';
  const partialContext = await browser.newContext({ serviceWorkers: 'allow' });
  const partialPage = await partialContext.newPage();
  await partialPage.goto(`${baseUrl}/__a07_fixture__/`, { waitUntil: 'domcontentloaded' });
  const partial = await partialPage.evaluate(async () => {
    const registration = await navigator.serviceWorker.register('/sw.js?partial=1', { scope: '/' });
    const worker = registration.installing || registration.waiting || registration.active;
    if (worker && !['redundant', 'activated'].includes(worker.state)) {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 10000);
        worker.addEventListener('statechange', () => {
          if (!['redundant', 'activated'].includes(worker.state)) return;
          clearTimeout(timer);
          resolve();
        });
      });
    }
    return {
      state: worker && worker.state,
      active: Boolean(registration.active),
      controller: Boolean(navigator.serviceWorker.controller),
      caches: await caches.keys(),
    };
  });
  assert.equal(partial.state, 'redundant');
  assert.equal(partial.active, false);
  assert.equal(partial.controller, false);
  assert.equal(partial.caches.some((name) => name.startsWith(currentVersion)), false);
  pass('partial precache failure cannot activate', 'worker redundant; staged cache removed');
  await partialContext.close();
  state.failPrecachePath = '';

  state.release = 'old';
  state.dataValue = 'old';
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  await registerAndControl(page);
  assert.equal(await releaseMarker(page), 'old');
  const coldCaches = await page.evaluate(() => caches.keys());
  assert.ok(coldCaches.includes(`${oldVersion}-static`));
  assert.ok(coldCaches.includes(`${oldVersion}-content`));
  const staticKeys = await page.evaluate(async (cacheName) => (await (await caches.open(cacheName)).keys()).map((request) => new URL(request.url).pathname), `${oldVersion}-static`);
  for (const required of ['/css/site.css', '/js/site-utils.js', '/pagefind/pagefind.js', '/404.html']) assert.ok(staticKeys.includes(required), required);
  pass('cold atomic install', `${staticKeys.length} complete precache entries`);

  await context.setOffline(true);
  const revisionedOffline = await responseDigest(page, '/js/site-utils.js?v=a07-offline');
  assert.equal(revisionedOffline.status, 200);
  assert.ok(revisionedOffline.length > 100);
  pass('revisioned static offline fallback', 'exact miss resolved through canonical current precache');
  await context.setOffline(false);

  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(await releaseMarker(page), 'old');
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(await releaseMarker(page), 'old');
  pass('online first load then offline reload', 'latest successful route response preserved');

  await page.goto(`${baseUrl}/__a07_missing__/`, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('h1').textContent(), 'A07_OFFLINE_FALLBACK');
  pass('missing route offline fallback', 'explicit 404 response');
  await context.setOffline(false);
  await page.goto(`${baseUrl}/__a07_fixture__/`, { waitUntil: 'domcontentloaded' });

  let data = await page.evaluate(async () => (await fetch('/data/a07-offline-fixture.json')).json());
  assert.equal(data.value, 'old');
  state.dataValue = 'new';
  data = await page.evaluate(async () => (await fetch('/data/a07-offline-fixture.json')).json());
  assert.equal(data.value, 'new');
  await context.setOffline(true);
  data = await page.evaluate(async () => (await fetch('/data/a07-offline-fixture.json')).json());
  assert.equal(data.value, 'new');
  pass('mutable JSON freshness', 'network value replaced cached value; latest value works offline');
  await context.setOffline(false);

  const pagefindOnline = await responseDigest(page, pagefindDataPath);
  assert.equal(pagefindOnline.status, 200);
  assert.ok(pagefindOnline.length > 0);
  await context.setOffline(true);
  const pagefindOffline = await responseDigest(page, pagefindDataPath);
  assert.equal(pagefindOffline.status, 200);
  assert.equal(pagefindOffline.length, pagefindOnline.length);
  const pagefindBootstrap = await responseDigest(page, '/pagefind/pagefind.js');
  assert.equal(pagefindBootstrap.status, 200);
  assert.ok(pagefindBootstrap.length > 0);
  pass('Pagefind boundary', 'bootstrap precached; visited data available offline');
  await context.setOffline(false);

  const audioOnline = await responseDigest(page, '/audio/a07-model.bin');
  assert.equal(audioOnline.status, 200);
  await context.setOffline(true);
  const audioOffline = await page.evaluate(async () => {
    try { await fetch('/audio/a07-model.bin'); return 'resolved'; }
    catch (_) { return 'rejected'; }
  });
  assert.equal(audioOffline, 'rejected');
  const audioCached = await page.evaluate(async () => Boolean(await caches.match('/audio/a07-model.bin')));
  assert.equal(audioCached, false);
  pass('TTS/audio boundary', 'network-only and absent from CacheStorage');
  await context.setOffline(false);

  state.release = 'new';
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration('/');
    await new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('controllerchange timeout')), 15000);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      await registration.update();
    });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(await releaseMarker(page), 'new');
  const updatedCaches = await page.evaluate(() => caches.keys());
  assert.equal(updatedCaches.some((name) => name.startsWith(oldVersion)), false);
  assert.ok(updatedCaches.includes(`${currentVersion}-static`));
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(await releaseMarker(page), 'new');
  pass('release update over old cache', 'old caches removed; new route response survives offline');

  await context.close();

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const report = {
    contract: 'A07-honest-offline-pwa',
    browser: 'chromium',
    cacheVersion: currentVersion,
    oldFixtureVersion: oldVersion,
    pagefindDataPath,
    scenarios: results,
    requestCounts: Object.fromEntries([...state.requestCounts.entries()].sort()),
  };
  fs.writeFileSync(path.join(REPORT_DIR, 'a07-offline-pwa-browser.json'), `${JSON.stringify(report, null, 2)}\n`);
  const digest = crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex');
  fs.writeFileSync(path.join(REPORT_DIR, 'a07-offline-pwa-browser.md'), [
    '# A07 Offline/PWA Chromium witness', '',
    `- Cache version: \`${currentVersion}\``,
    `- Scenarios: **${results.length}/${results.length} passed**`,
    `- Evidence digest: \`sha256:${digest}\``, '',
    ...results.map((item) => `- ✅ **${item.name}** — ${item.detail}`),
    '',
  ].join('\n'));
  console.log(`✅ A07 offline/PWA browser contract passed (${results.length} scenarios, sha256:${digest})`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
