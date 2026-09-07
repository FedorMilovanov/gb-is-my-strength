#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const REGISTER_JS = fs.readFileSync(path.join(ROOT, 'js', 'sw-register.js'), 'utf8');

const VERSION_A = 'gb-v998-contract-generation-a-20990101';
const VERSION_B = 'gb-v999-contract-generation-b-20990101';
const REV_A = 'aaaaaaaa';
const REV_B = 'bbbbbbbb';
const BYTES_A = 'GENERATION_A_BYTES';
const BYTES_B = 'GENERATION_B_BYTES';

function workerSource(cacheVersion, precacheAssets, marker) {
  const withVersion = BASE_SW.replace(
    /const CACHE_VERSION = '[^']+';/,
    `const CACHE_VERSION = '${cacheVersion}';`,
  );
  const withPrecache = withVersion.replace(
    /const PRECACHE_ASSETS = \[[\s\S]*?\n\];/,
    `const PRECACHE_ASSETS = ${JSON.stringify(precacheAssets, null, 2)};`,
  );
  assert.notEqual(withVersion, BASE_SW, 'contract fixture must replace CACHE_VERSION');
  assert.notEqual(withPrecache, withVersion, 'contract fixture must replace PRECACHE_ASSETS');
  return `${withPrecache}\n// contract-worker:${marker}\n`;
}

const WORKERS = {
  A: workerSource(VERSION_A, [`/asset.js?v=${REV_A}`, '/404.html'], 'A'),
  B_FAIL: workerSource(VERSION_B, [`/asset.js?v=${REV_B}`, '/__forced-precache-failure__.js', '/404.html'], 'B-fail'),
  B_VALID: workerSource(VERSION_B, [`/asset.js?v=${REV_B}`, '/404.html'], 'B-valid'),
};

function html(version, label) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${label}</title></head>
<body data-route="${label}">
<script>window.SITE_CONFIG={version:${JSON.stringify(version)}};</script>
<script src="/js/sw-register.js"></script>
<main>${label}</main>
</body></html>`;
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address()));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function waitForController(page) {
  await page.evaluate(async () => {
    if (navigator.serviceWorker.controller) return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('controllerchange timeout')), 10000);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });
  });
}

async function waitForFailedSuccessor(page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('failed successor timeout')), 10000);
      const onUpdate = () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'redundant') {
            clearTimeout(timer);
            resolve({ state: worker.state, controllerState: navigator.serviceWorker.controller?.state || '' });
          }
        });
      };
      registration.addEventListener('updatefound', onUpdate, { once: true });
      registration.update().catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  });
}

async function waitForSuccessfulSuccessor(page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('successful successor timeout')), 10000);
      const finish = () => {
        clearTimeout(timer);
        resolve({
          controllerUrl: navigator.serviceWorker.controller?.scriptURL || '',
          controllerState: navigator.serviceWorker.controller?.state || '',
        });
      };
      navigator.serviceWorker.addEventListener('controllerchange', finish, { once: true });
      registration.update().catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  });
}

async function cachedBody(page, cacheName, requestUrl) {
  return page.evaluate(async ({ cacheName: name, requestUrl: url }) => {
    const cache = await caches.open(name);
    const response = await cache.match(url);
    return response ? response.text() : null;
  }, { cacheName, requestUrl });
}

async function cacheNames(page) {
  return page.evaluate(() => caches.keys());
}

let workerMode = 'A';
const workerRequests = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  if (url.pathname === '/sw.js') {
    workerRequests.push(url.pathname + url.search);
    res.writeHead(200, {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'no-store',
      'service-worker-allowed': '/',
    });
    res.end(WORKERS[workerMode]);
    return;
  }
  if (url.pathname === '/js/sw-register.js') {
    res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' });
    res.end(REGISTER_JS);
    return;
  }
  if (url.pathname === '/asset.js') {
    const revision = url.searchParams.get('v');
    const body = revision === REV_B ? BYTES_B : BYTES_A;
    res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' });
    res.end(body);
    return;
  }
  if (url.pathname === '/__forced-precache-failure__.js') {
    res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end('forced install failure');
    return;
  }
  if (url.pathname === '/404.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end('<!doctype html><title>offline</title><main>offline</main>');
    return;
  }
  if (url.pathname === '/css/sw-toast.css') {
    res.writeHead(200, { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-store' });
    res.end('#gb-sw-toast{display:none}');
    return;
  }
  if (url.pathname === '/route-a/' || url.pathname === '/route-b/' || url.pathname === '/') {
    const isB = url.pathname === '/route-b/';
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html(isB ? '1781282355' : '1', isB ? 'route-b' : 'route-a'));
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('not found');
});

const address = await listen(server);
assert.equal(typeof address, 'object');
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const serviceWorkers = [];
context.on('serviceworker', (worker) => serviceWorkers.push(worker));
const page = await context.newPage();

try {
  await page.goto(`${origin}/route-a/`, { waitUntil: 'load' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await waitForController(page);

  const initial = await page.evaluate(() => ({
    controllerUrl: navigator.serviceWorker.controller?.scriptURL || '',
    activeUrl: null,
  }));
  const activeUrlA = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.scriptURL || '');
  initial.activeUrl = activeUrlA;
  assert.equal(initial.controllerUrl, `${origin}/sw.js`, 'generation A must be controlled by the single bare root worker URL');
  assert.equal(initial.activeUrl, `${origin}/sw.js`, 'active generation A script identity must be bare /sw.js');
  assert.equal(await cachedBody(page, `${VERSION_A}-static`, `/asset.js?v=${REV_A}`), BYTES_A,
    'generation A exact revision bytes must be staged');

  const workersAfterA = serviceWorkers.length;
  const requestsAfterA = workerRequests.length;
  await page.goto(`${origin}/route-b/`, { waitUntil: 'load' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  const routeBIdentity = await page.evaluate(async () => ({
    controllerUrl: navigator.serviceWorker.controller?.scriptURL || '',
    activeUrl: (await navigator.serviceWorker.ready).active?.scriptURL || '',
    installing: Boolean((await navigator.serviceWorker.ready).installing),
    waiting: Boolean((await navigator.serviceWorker.ready).waiting),
  }));
  assert.equal(routeBIdentity.controllerUrl, `${origin}/sw.js`);
  assert.equal(routeBIdentity.activeUrl, `${origin}/sw.js`);
  assert.equal(routeBIdentity.installing, false, 'route-local SITE_CONFIG metadata must not create an installing worker');
  assert.equal(routeBIdentity.waiting, false, 'route-local SITE_CONFIG metadata must not create a waiting worker');
  assert.equal(serviceWorkers.length, workersAfterA, 'route-local SITE_CONFIG metadata must not create a new worker lifecycle');
  assert.ok(workerRequests.slice(requestsAfterA).every((requestUrl) => requestUrl === '/sw.js'),
    `route B must never request a query-versioned root worker: ${workerRequests.join(', ')}`);

  await context.setOffline(true);
  const crossGeneration = await page.evaluate(async (url) => {
    try {
      const response = await fetch(url);
      return { ok: true, status: response.status, body: await response.text() };
    } catch (error) {
      return { ok: false, error: String(error && error.message || error) };
    }
  }, `/asset.js?v=${REV_B}`);
  await context.setOffline(false);
  assert.equal(crossGeneration.ok, false,
    `A controller must fail closed for unseen B revision, not return A bytes: ${JSON.stringify(crossGeneration)}`);

  workerMode = 'B_FAIL';
  const failed = await waitForFailedSuccessor(page);
  assert.equal(failed.state, 'redundant', 'failed generation B must become redundant');
  assert.equal(failed.controllerState, 'activated', 'generation A must remain the active controller after B install failure');
  const afterFailedNames = await cacheNames(page);
  assert.ok(afterFailedNames.includes(`${VERSION_A}-static`), 'failed B install must preserve A static cache');
  assert.ok(!afterFailedNames.includes(`${VERSION_B}-static`), 'failed B staging cache must be removed');
  assert.equal(await cachedBody(page, `${VERSION_A}-static`, `/asset.js?v=${REV_A}`), BYTES_A,
    'failed B install must preserve A exact cached bytes');

  workerMode = 'B_VALID';
  const successful = await waitForSuccessfulSuccessor(page);
  assert.equal(successful.controllerUrl, `${origin}/sw.js`, 'successful generation B keeps the one root script identity');
  assert.equal(successful.controllerState, 'activated', 'generation B must become active after complete staging');
  const afterBNames = await cacheNames(page);
  assert.ok(afterBNames.includes(`${VERSION_B}-static`), 'generation B static cache must become active');
  assert.ok(!afterBNames.some((name) => name.startsWith(`${VERSION_A}-`)), 'successful B activation must retire A generation caches');
  assert.equal(await cachedBody(page, `${VERSION_B}-static`, `/asset.js?v=${REV_B}`), BYTES_B,
    'generation B exact revision bytes must be staged');

  await context.setOffline(true);
  const offlineB = await page.evaluate(async (url) => {
    const response = await fetch(url);
    return { status: response.status, body: await response.text() };
  }, `/asset.js?v=${REV_B}`);
  await context.setOffline(false);
  assert.equal(offlineB.status, 200);
  assert.equal(offlineB.body, BYTES_B, 'offline B request must return byte-identical B revision, never A canonical bytes');

  assert.ok(workerRequests.length >= 3, 'contract must exercise initial A, failed B and valid B worker fetches');
  assert.ok(workerRequests.every((requestUrl) => requestUrl === '/sw.js'),
    `all worker generations must use one bare root script identity: ${workerRequests.join(', ')}`);

  console.log('✅ SW root generation browser contract passed');
  console.log(`   worker requests: ${workerRequests.join(', ')}`);
  console.log(`   A exact bytes: ${BYTES_A}`);
  console.log(`   B exact bytes: ${BYTES_B}`);
  console.log('   failed successor preserved A; valid successor retired A and served exact B bytes offline');
} finally {
  await context.setOffline(false).catch(() => {});
  await browser.close();
  await close(server);
}
