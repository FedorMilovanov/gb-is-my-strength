#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const REPORTS = path.join(ROOT, 'reports');
fs.mkdirSync(REPORTS, { recursive: true });
assert.ok(fs.existsSync(DIST), 'production-like dist is required');

const ROUTES = [
  { id: 'herm', route: '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/', legacySection: 'Главная' },
  { id: 'gill', route: '/articles/dzhon-gill-chast-1-chelovek/', legacySection: '⌂ Главная' },
  { id: 'antisovetov', route: '/articles/20-antisovetov-pastoru/', legacySection: '⌂ Главная' },
];
const VIEWPORTS = [
  { id: 'desktop-1440', width: 1440, height: 900 },
  { id: 'mobile-390', width: 390, height: 844 },
];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.bin': 'application/octet-stream',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
      let target = path.join(DIST, pathname.replace(/^\/+/, ''));
      if (pathname.endsWith('/')) target = path.join(target, 'index.html');
      if (!path.extname(target)) target = path.join(target, 'index.html');
      if (!target.startsWith(DIST) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(target).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

const checks = [];
function check(id, area, description, pass, evidence = null) {
  checks.push({ id, area, description, pass: Boolean(pass), evidence });
}
function snapshotButtons() {
  return Array.from(document.querySelectorAll('[data-fc-action="save"], .gb-save')).map((button) => ({
    visible: (() => { const style = getComputedStyle(button); const rect = button.getBoundingClientRect(); return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0; })(),
    pressed: button.getAttribute('aria-pressed'),
    label: button.getAttribute('aria-label'),
    savedClass: button.classList.contains('is-saved'),
    state: button.getAttribute('data-favorite-state'),
  }));
}

async function installEventLedger(context, legacyRecord = null) {
  await context.addInitScript(({ legacyRecord }) => {
    window.__favoriteEvents = [];
    window.addEventListener('gb:favorites-changed', (event) => {
      window.__favoriteEvents.push(JSON.parse(JSON.stringify(event.detail || {})));
    });
    if (legacyRecord) localStorage.setItem('gb-favorites', JSON.stringify([legacyRecord]));
    else localStorage.removeItem('gb-favorites');
  }, { legacyRecord });
}

async function articleCase(browser, origin, routeInfo, viewport) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const legacyRecord = {
    path: routeInfo.route,
    title: `Legacy ${routeInfo.id}`,
    description: 'legacy description',
    image: 'javascript:alert(1)',
    section: routeInfo.legacySection,
    addedAt: 1700000000000,
  };
  await installEventLedger(context, legacyRecord);
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(`${origin}${routeInfo.route}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.GBFavoriteStore?.version === 1 && document.documentElement.dataset.gbFavoriteStoreReady === '1');
  await page.waitForTimeout(100);

  const initial = await page.evaluate(snapshotButtons);
  const state = await page.evaluate(() => {
    const pageConfig = window.SITE_CONFIG?.page || {};
    const item = window.GBFavoriteStore.get(location.pathname);
    return {
      apiVersion: window.GBFavoriteStore.version,
      schemaVersion: window.GBFavoriteStore.schemaVersion,
      storageKey: window.GBFavoriteStore.storageKey,
      item,
      pageConfig,
      stored: JSON.parse(localStorage.getItem('gb-favorites') || '[]'),
      events: window.__favoriteEvents,
    };
  });
  const prefix = `FAV-${routeInfo.id.toUpperCase()}-${viewport.id.toUpperCase()}`;
  const canonicalCategory = String(state.pageConfig.favoriteCategory || state.pageConfig.category || state.pageConfig.section || state.pageConfig.taxonomy?.primary || '').trim();

  check(`${prefix}-01`, 'article-migration', 'canonical API is ready', state.apiVersion === 1 && state.schemaVersion === 1, state);
  check(`${prefix}-02`, 'article-migration', 'legacy key remains canonical transport key', state.storageKey === 'gb-favorites', state.storageKey);
  check(`${prefix}-03`, 'article-migration', 'legacy item migrated to schema v1', state.item?.schemaVersion === 1, state.item);
  check(`${prefix}-04`, 'article-migration', 'current path normalized', state.item?.path === routeInfo.route.replace(/\/$/, ''), state.item?.path);
  check(`${prefix}-05`, 'article-migration', 'type comes from canonical page config', state.item?.type === state.pageConfig.type && Boolean(state.item?.type), { item: state.item, page: state.pageConfig });
  check(`${prefix}-06`, 'article-migration', 'category comes from canonical page metadata', Boolean(canonicalCategory) && state.item?.category === canonicalCategory, { canonicalCategory, item: state.item });
  check(`${prefix}-07`, 'article-migration', 'breadcrumb presentation is not persisted as category', state.item?.category !== routeInfo.legacySection, state.item);
  check(`${prefix}-08`, 'article-migration', 'canonical section replaces breadcrumb presentation', state.item?.section === (String(state.pageConfig.section || canonicalCategory).trim()), state.item);
  check(`${prefix}-09`, 'article-migration', 'unsafe legacy image is removed', state.item?.image === '', state.item?.image);
  check(`${prefix}-10`, 'article-migration', 'migrated storage contains only schema-v1 item', state.stored.length === 1 && state.stored[0]?.schemaVersion === 1, state.stored);
  check(`${prefix}-11`, 'button-sync', 'save surfaces exist', initial.length > 0, initial);
  check(`${prefix}-12`, 'button-sync', 'every surface is pressed after migration', initial.every((button) => button.pressed === 'true' && button.savedClass), initial);
  check(`${prefix}-13`, 'button-sync', 'every saved surface has truthful remove label', initial.every((button) => button.label === 'Убрать из Избранного'), initial);
  check(`${prefix}-14`, 'button-sync', 'every saved surface publishes saved state', initial.every((button) => button.state === 'saved'), initial);

  const visibleSave = page.locator('[data-fc-action="save"]:visible, .gb-save:visible').first();
  await visibleSave.waitFor({ state: 'visible' });
  await visibleSave.click();
  await page.waitForFunction(() => !window.GBFavoriteStore.has(location.pathname));
  const afterRemove = await page.evaluate(snapshotButtons);
  check(`${prefix}-15`, 'toggle', 'click removes canonical item', !(await page.evaluate(() => window.GBFavoriteStore.has(location.pathname))), null);
  check(`${prefix}-16`, 'toggle', 'every surface clears pressed/class state', afterRemove.every((button) => button.pressed === 'false' && !button.savedClass), afterRemove);
  check(`${prefix}-17`, 'toggle', 'every unsaved surface has truthful add label', afterRemove.every((button) => button.label === 'Добавить в Избранное'), afterRemove);

  await visibleSave.click();
  await page.waitForFunction(() => window.GBFavoriteStore.has(location.pathname));
  const afterAdd = {
    buttons: await page.evaluate(snapshotButtons),
    ...(await page.evaluate(() => ({ item: window.GBFavoriteStore.get(location.pathname), events: window.__favoriteEvents }))),
  };
  check(`${prefix}-18`, 'toggle', 'second click adds one canonical item', afterAdd.item?.schemaVersion === 1 && afterAdd.item?.metadataSource === 'site-config', afterAdd.item);
  check(`${prefix}-19`, 'toggle', 'added item owns explicit routeId/type/category', Boolean(afterAdd.item?.routeId && afterAdd.item?.type && afterAdd.item?.category), afterAdd.item);
  check(`${prefix}-20`, 'events', 'remove and add mutations emit versioned events', afterAdd.events.some((event) => event.action === 'remove' && event.version === 1) && afterAdd.events.some((event) => event.action === 'add' && event.schemaVersion === 1), afterAdd.events);
  check(`${prefix}-21`, 'errors', 'no page errors', pageErrors.length === 0, pageErrors);

  if (routeInfo.id === 'herm' && viewport.id === 'mobile-390') {
    await page.screenshot({ path: path.join(REPORTS, 'favorite-store-herm-mobile.png'), fullPage: false });
  }
  await context.close();
}

async function crossTabCase(browser, origin) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  await installEventLedger(context, null);
  const home = await context.newPage();
  const article = await context.newPage();
  const errors = [];
  for (const page of [home, article]) page.on('pageerror', (error) => errors.push(error.message));

  await home.goto(`${origin}/`, { waitUntil: 'networkidle' });
  await home.waitForFunction(() => window.GBFavoriteStore?.version === 1);
  check('FAV-XTAB-01', 'cross-tab', 'Home starts without favorite cards', await home.locator('.favorites-card').count() === 0, null);

  await article.goto(`${origin}${ROUTES[1].route}`, { waitUntil: 'networkidle' });
  await article.waitForFunction(() => window.GBFavoriteStore?.version === 1);
  const save = article.locator('[data-fc-action="save"]:visible, .gb-save:visible').first();
  await save.waitFor({ state: 'visible' });
  await save.click();
  await home.waitForFunction(() => document.querySelectorAll('.favorites-card').length === 1);
  const homeCard = await home.evaluate(() => ({
    count: document.querySelectorAll('.favorites-card').length,
    path: document.querySelector('.favorites-card')?.getAttribute('data-fav-path'),
    section: document.querySelector('.favorites-card__section')?.textContent?.trim(),
    hidden: document.getElementById('favoritesBlock')?.hidden,
  }));
  check('FAV-XTAB-02', 'cross-tab', 'Home renders storage mutation from another tab', homeCard.count === 1 && homeCard.hidden === false, homeCard);
  check('FAV-XTAB-03', 'cross-tab', 'Home card uses normalized canonical path', homeCard.path === ROUTES[1].route.replace(/\/$/, ''), homeCard);
  check('FAV-XTAB-04', 'cross-tab', 'Home card displays canonical section', Boolean(homeCard.section) && !/Главная/.test(homeCard.section), homeCard);
  check('FAV-XTAB-05', 'cross-tab', 'cross-tab flow has no page errors', errors.length === 0, errors);
  await home.screenshot({ path: path.join(REPORTS, 'favorite-store-home-cross-tab.png'), fullPage: false });
  await context.close();
}

async function favoritesPageCase(browser, origin) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  await context.addInitScript(() => {
    localStorage.setItem('gb-favorites', JSON.stringify([
      { schemaVersion: 1, path: '/articles/dzhon-gill-chast-1-chelovek', routeId: 'gill', type: 'article', category: 'Биографии служителей', section: 'Биографии служителей', title: 'Джон Гилл', description: 'Описание', image: '', addedAt: 1800000000000, metadataSource: 'site-config' },
      { path: 'javascript:alert(1)', title: 'Unsafe', section: 'Главная', addedAt: 1700000000000 },
    ]));
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/izbrannoe/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.GBFavoriteStore?.version === 1 && document.querySelectorAll('.izbrannoe-card').length === 1);
  const initial = await page.evaluate(() => ({
    cards: document.querySelectorAll('.izbrannoe-card').length,
    stored: window.GBFavoriteStore.list(),
    count: document.getElementById('izbrannoeCount')?.textContent,
  }));
  check('FAV-PAGE-01', 'favorites-page', 'page consumes canonical store', initial.cards === 1 && initial.stored.length === 1, initial);
  check('FAV-PAGE-02', 'favorites-page', 'unsafe legacy path fails closed', initial.stored.every((item) => item.path.startsWith('/')), initial.stored);
  check('FAV-PAGE-03', 'favorites-page', 'count reflects canonical list', /1 статья/.test(initial.count || ''), initial.count);

  await page.locator('.izbrannoe-card__remove').click();
  await page.waitForFunction(() => document.querySelectorAll('.izbrannoe-card').length === 0 && !window.GBFavoriteStore.list().length);
  check('FAV-PAGE-04', 'favorites-page', 'remove delegates to store', await page.locator('.izbrannoe-card').count() === 0, null);
  check('FAV-PAGE-05', 'favorites-page', 'empty state is shown after remove', await page.locator('#izbrannoeEmpty').isVisible(), null);

  await page.evaluate(() => {
    window.GBFavoriteStore.add({ path: '/articles/one/', routeId: 'one', type: 'article', category: 'Категория', section: 'Категория', title: 'Один', metadataSource: 'test' });
    window.GBFavoriteStore.add({ path: '/articles/two/', routeId: 'two', type: 'article', category: 'Категория', section: 'Категория', title: 'Два', metadataSource: 'test' });
  });
  await page.waitForFunction(() => document.querySelectorAll('.izbrannoe-card').length === 2);
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#izbrannoeClear').click();
  await page.waitForFunction(() => window.GBFavoriteStore.list().length === 0 && document.querySelectorAll('.izbrannoe-card').length === 0);
  check('FAV-PAGE-06', 'favorites-page', 'clear delegates to store', await page.evaluate(() => window.GBFavoriteStore.list().length === 0), null);
  check('FAV-PAGE-07', 'favorites-page', 'page has no direct-render errors', errors.length === 0, errors);
  await page.screenshot({ path: path.join(REPORTS, 'favorite-store-page-empty.png'), fullPage: false });
  await context.close();
}

const { server, origin } = await startServer();
const browser = await chromium.launch({ headless: true });
try {
  for (const route of ROUTES) {
    for (const viewport of VIEWPORTS) await articleCase(browser, origin, route, viewport);
  }
  await crossTabCase(browser, origin);
  await favoritesPageCase(browser, origin);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

const failed = checks.filter((entry) => !entry.pass);
const sha = process.env.GITHUB_SHA || null;
const summary = { sha, cases: ROUTES.length * VIEWPORTS.length + 2, checks: checks.length, passed: checks.length - failed.length, failed: failed.length, results: checks };
fs.writeFileSync(path.join(REPORTS, 'favorite-store-browser-contract.json'), `${JSON.stringify(summary, null, 2)}\n`);
fs.writeFileSync(path.join(REPORTS, 'favorite-store-browser-contract.md'), [
  '# Favorite Store Browser Contract', '',
  `- SHA: \`${sha || 'local'}\``,
  `- Cases: **${summary.cases}**`,
  `- Checks: **${summary.checks}**`,
  `- Passed: **${summary.passed}**`,
  `- Failed: **${summary.failed}**`, '',
  ...checks.map((entry) => `- ${entry.pass ? 'PASS' : 'FAIL'} \`${entry.id}\` — ${entry.description}`), '',
].join('\n'));
for (const entry of checks) console.log(`${entry.pass ? 'PASS' : 'FAIL'} ${entry.id} ${entry.description}`);
console.log(JSON.stringify({ sha, cases: summary.cases, checks: summary.checks, passed: summary.passed, failed: summary.failed }));
if (failed.length) process.exitCode = 1;
