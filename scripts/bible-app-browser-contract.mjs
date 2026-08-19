#!/usr/bin/env node
/**
 * Deep Playwright contract for the Bible App integration surface.
 *
 * Scope: Home → /app/ → contextual 1 Peter 3/4 bridges.
 * This intentionally complements the broad public-surface matrix with clicks,
 * exact Telegram startapp contracts, keyboard focus, touch-target geometry and
 * durable screenshots across desktop/mobile viewports.
 *
 * Prerequisites: production-like dist and Playwright browser selected through
 * GB_APP_BROWSER=chromium|webkit.
 */
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const playwright = require('playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const REPORTS = join(ROOT, 'reports', 'bible-app-browser');
const ENGINE = String(process.env.GB_APP_BROWSER || 'chromium').trim().toLowerCase();
const browserType = playwright[ENGINE];
if (!browserType || !['chromium', 'webkit'].includes(ENGINE)) {
  throw new Error(`Unsupported GB_APP_BROWSER=${ENGINE}; expected chromium or webkit`);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
};

const VIEWPORTS = [
  { id: 'mobile-320', width: 320, height: 760, mobile: true },
  { id: 'mobile-390', width: 390, height: 844, mobile: true },
  { id: 'desktop-1440', width: 1440, height: 900, mobile: false },
];

const ROUTES = {
  home: '/',
  app: '/app/',
  ch3: '/hard-texts/duhi-v-temnice-noi-kreshchenie-pobeda/',
  ch4: '/hard-texts/blagovestie-mertvym-1-petra-4-5-6/',
};

const TELEGRAM = {
  home: 'https://t.me/milovanovaibot?startapp=v1_site_app__home',
  ch3: 'https://t.me/milovanovaibot?startapp=v1_site_ch3__chapter3',
  ch4: 'https://t.me/milovanovaibot?startapp=v1_site_ch4__chapter4',
};

const results = [];
function record(viewport, route, contract, ok, detail = '') {
  results.push({ engine: ENGINE, viewport: viewport.id, route, contract, ok: Boolean(ok), detail: String(detail || '') });
}

function routeFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  return join(DIST, clean, clean.endsWith('.html') ? '' : 'index.html');
}

async function serve() {
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
      let file = routeFile(pathname);
      if (pathname.includes('.') && !pathname.endsWith('/')) file = join(DIST, pathname.replace(/^\/+/, ''));
      try {
        if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      } catch {
        file = join(ROOT, pathname.replace(/^\/+/, ''));
      }
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

async function launchBrowser() {
  if (ENGINE === 'chromium') {
    const explicit = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    const repoImage = '/opt/pw-browsers/chromium';
    if (explicit && existsSync(explicit)) return browserType.launch({ executablePath: explicit });
    if (existsSync(repoImage)) return browserType.launch({ executablePath: repoImage });
  }
  return browserType.launch();
}

function slugFor(route) {
  if (route === '/') return 'home';
  return route.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9а-яё_-]+/gi, '-').slice(0, 80) || 'route';
}

async function installNetworkGuards(page, base, state) {
  page.on('pageerror', (error) => state.pageErrors.push(String(error).slice(0, 400)));
  page.on('console', (message) => {
    if (message.type() === 'error') state.consoleErrors.push(message.text().slice(0, 400));
  });
  page.on('response', (response) => {
    const request = response.request();
    if (!response.url().startsWith(base)) return;
    if (response.status() < 400) return;
    if (!['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(request.resourceType())) return;
    state.badAssets.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith(base) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    return route.abort();
  });
}

async function gotoLocal(page, base, route, viewport, state) {
  state.pageErrors.length = 0;
  state.consoleErrors.length = 0;
  state.badAssets.length = 0;
  const response = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(350);
  record(viewport, route, 'document:status', response?.status() === 200, response?.status() ?? 'no response');
  return response;
}

async function inspectGeneric(page, route, viewport, state) {
  const facts = await page.evaluate(() => {
    const root = document.scrollingElement || document.documentElement;
    const h1 = [...document.querySelectorAll('h1')].find((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    });
    const clippedInteractive = [...document.querySelectorAll('a[href],button,input,select,textarea')]
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || rect.width <= 0 || rect.height <= 0) return false;
        return rect.left < -3 || rect.right > innerWidth + 3;
      })
      .slice(0, 12)
      .map((node) => `${node.tagName.toLowerCase()}#${node.id || '-'} .${String(node.className || '').replace(/\s+/g, '.').slice(0, 80)}`);
    return {
      overflow: Math.max(0, root.scrollWidth - root.clientWidth),
      h1: h1?.textContent?.trim() || '',
      title: document.title,
      clippedInteractive,
    };
  });

  record(viewport, route, 'runtime:pageerror', state.pageErrors.length === 0, state.pageErrors.join(' | '));
  record(viewport, route, 'runtime:console-error', state.consoleErrors.length === 0, state.consoleErrors.join(' | '));
  record(viewport, route, 'assets:same-origin', state.badAssets.length === 0, state.badAssets.join(' | '));
  record(viewport, route, 'layout:no-horizontal-overflow', facts.overflow <= 8, `${facts.overflow}px`);
  record(viewport, route, 'layout:no-clipped-interactive', facts.clippedInteractive.length === 0, facts.clippedInteractive.join(' | '));
  record(viewport, route, 'document:title', facts.title.trim().length >= 4, facts.title);
  record(viewport, route, 'document:h1', Boolean(facts.h1), facts.h1 || 'no visible h1');
}

async function screenshot(page, route, viewport) {
  const dir = join(REPORTS, ENGINE, viewport.id);
  await mkdir(dir, { recursive: true });
  await page.screenshot({
    path: join(dir, `${slugFor(route)}.png`),
    fullPage: true,
    animations: 'disabled',
  });
}

async function assertTelegramAnchor(page, selector, expectedHref, viewport, route, contract) {
  const locator = page.locator(selector).first();
  const count = await locator.count();
  if (!count) {
    record(viewport, route, `${contract}:exists`, false, selector);
    return;
  }
  const facts = await locator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      href: node.getAttribute('href') || '',
      target: node.getAttribute('target') || '',
      rel: (node.getAttribute('rel') || '').split(/\s+/).filter(Boolean),
      visible: rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== 'hidden',
      rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
  record(viewport, route, `${contract}:visible`, facts.visible, JSON.stringify(facts.rect));
  record(viewport, route, `${contract}:href`, facts.href === expectedHref, facts.href);
  record(viewport, route, `${contract}:target-blank`, facts.target === '_blank', facts.target);
  record(viewport, route, `${contract}:noopener`, facts.rel.includes('noopener'), facts.rel.join(' '));
  record(viewport, route, `${contract}:noreferrer`, facts.rel.includes('noreferrer'), facts.rel.join(' '));
  record(viewport, route, `${contract}:touch-target`, facts.rect.height >= 44, `${facts.rect.width}×${facts.rect.height}`);
  const inside = facts.rect.left >= -2 && facts.rect.right <= facts.viewport.width + 2;
  record(viewport, route, `${contract}:inside-viewport`, inside, JSON.stringify(facts.rect));
}

async function assertKeyboardFocus(page, selector, viewport, route, contract) {
  const locator = page.locator(selector).first();
  if (!(await locator.count())) {
    record(viewport, route, `${contract}:focusable`, false, selector);
    return;
  }
  await page.keyboard.press('Tab').catch(() => {});
  await locator.focus();
  const facts = await locator.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      active: document.activeElement === node,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineColor: style.outlineColor,
      boxShadow: style.boxShadow,
    };
  });
  record(viewport, route, `${contract}:focusable`, facts.active, JSON.stringify(facts));
  const width = Number.parseFloat(facts.outlineWidth) || 0;
  const visibleFocus = (facts.outlineStyle !== 'none' && width >= 2) || (facts.boxShadow && facts.boxShadow !== 'none');
  record(viewport, route, `${contract}:visible-focus`, visibleFocus, JSON.stringify(facts));
}

async function clickInternalAndReturn(page, base, selector, expectedRoute, viewport, sourceRoute, contract) {
  const locator = page.locator(selector).first();
  if (!(await locator.count()) || !(await locator.isVisible().catch(() => false))) {
    record(viewport, sourceRoute, `${contract}:visible`, false, selector);
    return;
  }
  record(viewport, sourceRoute, `${contract}:visible`, true, selector);
  await locator.click({ timeout: 5000 });
  await page.waitForURL((url) => url.origin === new URL(base).origin && url.pathname === expectedRoute, { timeout: 10000 });
  record(viewport, sourceRoute, `${contract}:click-route`, new URL(page.url()).pathname === expectedRoute, page.url());
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(250);
}

async function inspectHome(page, base, viewport, state) {
  const route = ROUTES.home;
  await gotoLocal(page, base, route, viewport, state);
  await inspectGeneric(page, route, viewport, state);

  let selector = '.h-nav-links a[href="/app/"]';
  if (viewport.mobile) {
    const button = page.locator('#hMobileMenuBtn');
    record(viewport, route, 'home:mobile-menu-trigger', (await button.count()) > 0 && await button.isVisible().catch(() => false));
    await button.click({ timeout: 5000 });
    await page.waitForFunction(() => document.getElementById('hMobileNav')?.getAttribute('aria-hidden') === 'false', null, { timeout: 5000 });
    selector = '.h-mobile-nav__primary a[href="/app/"]';
  }

  const appLink = page.locator(selector).first();
  const visible = (await appLink.count()) > 0 && await appLink.isVisible().catch(() => false);
  record(viewport, route, 'home:app-entry-visible', visible, selector);
  if (visible) {
    const rect = await appLink.boundingBox();
    record(viewport, route, 'home:app-entry-touch-target', Boolean(rect && rect.height >= 44), rect ? `${rect.width}×${rect.height}` : 'no rect');
    await screenshot(page, route, viewport);
    await appLink.click({ timeout: 5000 });
    await page.waitForURL((url) => url.origin === new URL(base).origin && url.pathname === ROUTES.app, { timeout: 10000 });
    record(viewport, route, 'home:app-entry-click-route', new URL(page.url()).pathname === ROUTES.app, page.url());
  } else {
    await screenshot(page, route, viewport);
  }
}

async function inspectApp(page, base, viewport, state) {
  const route = ROUTES.app;
  await gotoLocal(page, base, route, viewport, state);
  await inspectGeneric(page, route, viewport, state);

  const stage = page.locator('.app-stage');
  record(viewport, route, 'app:preview-visible', (await stage.count()) > 0 && await stage.isVisible().catch(() => false));
  const modeCount = await page.locator('.app-mode-row .app-mode').count();
  record(viewport, route, 'app:preview-three-modes', modeCount === 3, `${modeCount}`);

  await assertTelegramAnchor(page, '.app-hero .app-primary', TELEGRAM.home, viewport, route, 'app:hero-launch');
  await assertTelegramAnchor(page, `.app-study-card a[href="${TELEGRAM.ch3}"]`, TELEGRAM.ch3, viewport, route, 'app:chapter3-launch');
  await assertTelegramAnchor(page, `.app-study-card a[href="${TELEGRAM.ch4}"]`, TELEGRAM.ch4, viewport, route, 'app:chapter4-launch');
  await assertKeyboardFocus(page, '.app-hero .app-primary', viewport, route, 'app:hero-launch');

  await screenshot(page, route, viewport);

  await clickInternalAndReturn(
    page,
    base,
    '.app-brand[href="/"]',
    ROUTES.home,
    viewport,
    route,
    'app:brand-home',
  );
  await clickInternalAndReturn(
    page,
    base,
    `.app-study-card a[href="${ROUTES.ch3}"]`,
    ROUTES.ch3,
    viewport,
    route,
    'app:chapter3-research',
  );
  await clickInternalAndReturn(
    page,
    base,
    `.app-study-card a[href="${ROUTES.ch4}"]`,
    ROUTES.ch4,
    viewport,
    route,
    'app:chapter4-research',
  );
}

async function inspectChapter(page, base, viewport, state, chapter) {
  const route = chapter === 3 ? ROUTES.ch3 : ROUTES.ch4;
  const expected = chapter === 3 ? TELEGRAM.ch3 : TELEGRAM.ch4;
  await gotoLocal(page, base, route, viewport, state);
  await inspectGeneric(page, route, viewport, state);

  const aside = page.locator(`.genesis6-app-cta[data-bible-app-chapter="${chapter}"]`).first();
  const visible = (await aside.count()) > 0 && await aside.isVisible().catch(() => false);
  record(viewport, route, 'chapter:cta-visible', visible, `chapter=${chapter}`);
  if (visible) {
    const startParam = await aside.getAttribute('data-bible-app-start-param');
    const expectedParam = chapter === 3 ? 'v1_site_ch3__chapter3' : 'v1_site_ch4__chapter4';
    record(viewport, route, 'chapter:start-param', startParam === expectedParam, startParam || '<missing>');
    const flow = await aside.locator('.genesis6-app-cta__flow').innerText().catch(() => '');
    record(viewport, route, 'chapter:study-flow-copy', /Статья[\s\S]*Проверка[\s\S]*Возврат к тексту/.test(flow), flow);
  }
  await assertTelegramAnchor(page, '[data-bible-app-launch]', expected, viewport, route, 'chapter:launch');
  await assertKeyboardFocus(page, '[data-bible-app-launch]', viewport, route, 'chapter:launch');
  await screenshot(page, route, viewport);
}

async function runViewport(browser, base, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    locale: 'ru-RU',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const state = { pageErrors: [], consoleErrors: [], badAssets: [] };
  await installNetworkGuards(page, base, state);
  try {
    await inspectHome(page, base, viewport, state);
    await inspectApp(page, base, viewport, state);
    await inspectChapter(page, base, viewport, state, 3);
    await inspectChapter(page, base, viewport, state, 4);
  } catch (error) {
    record(viewport, page.url() || '<unknown>', 'audit:uncaught', false, error?.stack || error);
  } finally {
    await context.close().catch(() => {});
  }
}

if (!existsSync(DIST)) {
  console.error('dist/ missing; run npm run strangler:build:production-like first');
  process.exit(1);
}

await mkdir(REPORTS, { recursive: true });
const { server, base } = await serve();
let browser;
try {
  browser = await launchBrowser();
  for (const viewport of VIEWPORTS) await runViewport(browser, base, viewport);
} finally {
  await browser?.close().catch(() => {});
  await new Promise((resolve) => server.close(resolve));
}

const failures = results.filter((item) => !item.ok);
const passed = results.length - failures.length;
const summary = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  engine: ENGINE,
  routes: Object.values(ROUTES),
  viewports: VIEWPORTS,
  contracts: results.length,
  passed,
  failed: failures.length,
  failures,
  results,
};

await writeFile(join(REPORTS, `bible-app-browser-${ENGINE}.json`), `${JSON.stringify(summary, null, 2)}\n`);
const md = [
  `# Bible App deep browser contract — ${ENGINE}`,
  '',
  `- Routes: **${Object.values(ROUTES).length}**`,
  `- Viewports: **${VIEWPORTS.map((item) => item.id).join(', ')}**`,
  `- Contracts: **${passed}/${results.length} PASS**`,
  `- Failures: **${failures.length}**`,
  '',
  ...(failures.length
    ? ['## Failures', '', ...failures.map((item) => `- \`${item.viewport}\` · \`${item.route}\` · **${item.contract}** — ${item.detail || 'failed'}`)]
    : ['✅ Home, /app/, 1 Peter 3 and 1 Peter 4 passed the deep browser contract.']),
  '',
];
await writeFile(join(REPORTS, `bible-app-browser-${ENGINE}.md`), `${md.join('\n')}\n`);
for (const item of failures) console.error(`FAIL [${item.viewport}] ${item.route} ${item.contract} :: ${item.detail}`);
console.log(`BIBLE APP BROWSER ${ENGINE.toUpperCase()}: ${passed}/${results.length} PASS`);
if (failures.length) process.exitCode = 1;
