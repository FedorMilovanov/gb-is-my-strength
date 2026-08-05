#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium, webkit } from 'playwright';

const ROOT = resolve(process.cwd());
const args = new Map(process.argv.slice(2).map((argument) => {
  const [key, ...value] = argument.split('=');
  return [key, value.join('=')];
}));
const DIST = resolve(ROOT, args.get('--dist') || 'dist');
const REPORT_DIR = resolve(ROOT, args.get('--report') || 'reports/home-search-action');
const SEARCH_QUERY = 'Нагорная проповедь';
const SEARCH_QUERY_WITH_SPACES = '  Нагорная   проповедь  ';
const failures = [];
const results = [];

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

function record(browser, profile, contract, ok, detail = '') {
  const row = { browser, profile, contract, ok: Boolean(ok), detail: String(detail || '') };
  results.push(row);
  if (!row.ok) failures.push(`${browser}/${profile}/${contract}: ${row.detail}`);
}

function assertSourceContract() {
  const head = readFileSync(join(ROOT, 'src/components/home/HomePageHead.astro'), 'utf8');
  const page = readFileSync(join(ROOT, 'src/pages/index.astro'), 'utf8');

  assert.match(
    head,
    /https:\/\/gospod-bog\.ru\/\?q=\{search_term_string\}/,
    'WebSite SearchAction target changed',
  );
  assert.match(page, /new URLSearchParams\(window\.location\.search\)\.get\('q'\)/, 'q parameter is not read through URLSearchParams');
  assert.match(page, /window\.dispatchEvent\(new CustomEvent\('gb:openSearch'/, 'adapter bypasses the canonical search-open event');
  assert.match(page, /input\.dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/, 'adapter does not enter the query through the canonical input contract');
  assert.ok(
    page.indexOf('</HomePageChrome>') < page.indexOf("new URLSearchParams(window.location.search).get('q')"),
    'SearchAction adapter must run after the Home search shell binds its lazy loader',
  );
}

function fileForRequest(url) {
  const pathname = decodeURIComponent(new URL(url || '/', 'http://127.0.0.1').pathname);
  const clean = pathname.replace(/^\/+/, '');
  if (!clean || pathname.endsWith('/')) return join(DIST, clean, 'index.html');
  return join(DIST, clean);
}

function startServer() {
  const server = createServer((request, response) => {
    try {
      let file = fileForRequest(request.url);
      if (statSync(file).isDirectory()) file = join(file, 'index.html');
      const body = readFileSync(file);
      response.writeHead(200, {
        'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      response.end(body);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('not found');
    }
  });
  return new Promise((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => resolvePromise(server));
  });
}

async function waitForSearchResult(page, query) {
  await page.waitForFunction((expected) => {
    const overlay = document.querySelector('.cp-backdrop');
    const input = document.querySelector('.cp-input');
    if (!overlay?.classList.contains('is-open')) return false;
    if (!(input instanceof HTMLInputElement) || input.value !== expected) return false;
    if (document.querySelector('.cp-loading')) return false;
    const titles = [...document.querySelectorAll('.cp-item-title')]
      .map((node) => (node.textContent || '').toLocaleLowerCase('ru-RU'));
    return titles.some((title) => title.includes('нагорная проповедь'));
  }, query, { timeout: 20_000 });
}

async function inspectQueryEntry(browserName, browserType, baseUrl, profile) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    isMobile: profile.mobile,
    hasTouch: profile.mobile,
    locale: 'ru-RU',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    const knownWebKitViewportWarning = browserName === 'webkit'
      && text === 'Viewport argument key "interactive-widget" not recognized and ignored.';
    if (!knownWebKitViewportWarning && !/mc\.yandex|Failed to load resource|Load failed/i.test(text)) {
      runtimeErrors.push(`console: ${text}`);
    }
  });
  await page.route(/mc\.yandex/, (route) => route.abort());

  try {
    const requested = `${baseUrl}/?q=${encodeURIComponent(SEARCH_QUERY_WITH_SPACES)}`;
    const response = await page.goto(requested, { waitUntil: 'domcontentloaded' });
    record(browserName, profile.id, 'http-200', response?.status() === 200, `status=${response?.status()}`);

    await waitForSearchResult(page, SEARCH_QUERY);
    const state = await page.evaluate(() => {
      const overlay = document.querySelector('.cp-backdrop');
      const input = document.querySelector('.cp-input');
      const trigger = document.getElementById('gbSearchBtn');
      const resultTitles = [...document.querySelectorAll('.cp-item-title')]
        .map((node) => node.textContent?.trim() || '')
        .filter(Boolean);
      return {
        overlayCount: document.querySelectorAll('.cp-backdrop').length,
        open: overlay?.classList.contains('is-open') || false,
        ariaHidden: overlay?.getAttribute('aria-hidden'),
        inputValue: input instanceof HTMLInputElement ? input.value : '',
        inputFocused: input === document.activeElement,
        resultCount: document.querySelectorAll('.cp-item').length,
        resultTitles,
        triggerExpanded: trigger?.getAttribute('aria-expanded'),
        triggerControls: trigger?.getAttribute('aria-controls'),
        receipt: document.documentElement.dataset.searchActionQuery || '',
        horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    record(browserName, profile.id, 'single-open-dialog', state.overlayCount === 1 && state.open, JSON.stringify(state));
    record(browserName, profile.id, 'dialog-accessible', state.ariaHidden === 'false', JSON.stringify(state));
    record(browserName, profile.id, 'query-normalized', state.inputValue === SEARCH_QUERY, JSON.stringify(state));
    record(browserName, profile.id, 'input-focused', state.inputFocused, JSON.stringify(state));
    record(
      browserName,
      profile.id,
      'matching-result-rendered',
      state.resultCount > 0 && state.resultTitles.some((title) => /Нагорная\s+проповедь/i.test(title)),
      JSON.stringify(state),
    );
    record(browserName, profile.id, 'trigger-truthful', state.triggerExpanded === 'true' && state.triggerControls === 'gbCommandPalette', JSON.stringify(state));
    record(browserName, profile.id, 'adapter-receipt', state.receipt === 'applied', JSON.stringify(state));
    record(browserName, profile.id, 'no-horizontal-overflow', state.horizontalOverflow <= 1, `overflow=${state.horizontalOverflow}`);
    record(
      browserName,
      profile.id,
      'query-preserved-in-url',
      new URL(page.url()).searchParams.get('q') === SEARCH_QUERY_WITH_SPACES,
      page.url(),
    );
    record(browserName, profile.id, 'runtime-clean', runtimeErrors.length === 0, runtimeErrors.join(' | '));

    const shot = join(REPORT_DIR, `${browserName}-${profile.id}-search-action.png`);
    await page.screenshot({ path: shot, fullPage: false });
    record(browserName, profile.id, 'evidence-written', existsSync(shot) && statSync(shot).size > 10_000, `bytes=${existsSync(shot) ? statSync(shot).size : 0}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function inspectNoQueryNoOp(baseUrl) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ru-RU' });
  const page = await context.newPage();
  await page.route(/mc\.yandex/, (route) => route.abort());
  try {
    for (const suffix of ['?q=%20%20%20', '?utm_source=contract']) {
      await page.goto(`${baseUrl}/${suffix}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(450);
      const state = await page.evaluate(() => ({
        overlayCount: document.querySelectorAll('.cp-backdrop').length,
        bootRequested: Boolean(window.__gbSearchBootRequested),
        receipt: document.documentElement.dataset.searchActionQuery || '',
      }));
      record('chromium', suffix, 'no-op-without-usable-q', state.overlayCount === 0 && !state.bootRequested && !state.receipt, JSON.stringify(state));
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

assert.ok(existsSync(join(DIST, 'index.html')), `Built Home page is missing: ${join(DIST, 'index.html')}`);
mkdirSync(REPORT_DIR, { recursive: true });
assertSourceContract();

const server = await startServer();
const baseUrl = `http://127.0.0.1:${server.address().port}`;
try {
  await inspectQueryEntry('chromium', chromium, baseUrl, { id: 'desktop-1280', width: 1280, height: 900, mobile: false });
  await inspectQueryEntry('chromium', chromium, baseUrl, { id: 'mobile-390', width: 390, height: 844, mobile: true });
  await inspectQueryEntry('webkit', webkit, baseUrl, { id: 'desktop-1280', width: 1280, height: 900, mobile: false });
  await inspectQueryEntry('webkit', webkit, baseUrl, { id: 'mobile-390', width: 390, height: 844, mobile: true });
  await inspectNoQueryNoOp(baseUrl);
} finally {
  server.close();
}

writeFileSync(join(REPORT_DIR, 'contract.json'), JSON.stringify({ results, failures }, null, 2));
if (failures.length) {
  console.error(`❌ Home SearchAction contract failed (${failures.length})`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✅ Home SearchAction contract passed (${results.length} checks)`);
