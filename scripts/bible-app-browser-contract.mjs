#!/usr/bin/env node
/**
 * Deep Playwright contract for the Bible App integration.
 * Complements the broad public-surface smoke matrix with real navigation,
 * outbound launch clicks (intercepted locally), keyboard/focus geometry and
 * durable route/component screenshots.
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
const ENGINE = String(process.env.GB_APP_BROWSER || 'chromium').toLowerCase();
const browserType = playwright[ENGINE];
if (!['chromium', 'webkit'].includes(ENGINE) || !browserType) {
  throw new Error(`GB_APP_BROWSER must be chromium or webkit; got ${ENGINE}`);
}

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
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
};
const results = [];

function rec(vp, route, contract, ok, detail = '') {
  results.push({ engine: ENGINE, viewport: vp.id, route, contract, ok: Boolean(ok), detail: String(detail || '') });
}
function slug(route) {
  return route === '/' ? 'home' : route.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9а-яё_-]+/gi, '-').slice(0, 80);
}
function routeFile(pathname) {
  const clean = decodeURIComponent(pathname.split('?')[0]).replace(/^\/+/, '');
  return join(DIST, clean, clean.endsWith('.html') ? '' : 'index.html');
}

async function serve() {
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
      let file = pathname.includes('.') && !pathname.endsWith('/')
        ? join(DIST, pathname.replace(/^\/+/, ''))
        : routeFile(pathname);
      try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); }
      catch { file = join(ROOT, pathname.replace(/^\/+/, '')); }
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
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
  const explicit = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (ENGINE === 'chromium' && explicit && existsSync(explicit)) return browserType.launch({ executablePath: explicit });
  return browserType.launch();
}

async function mkdirFor(vp) {
  const dir = join(REPORTS, ENGINE, vp.id);
  await mkdir(dir, { recursive: true });
  return dir;
}
async function fullShot(page, vp, route, suffix = '') {
  const dir = await mkdirFor(vp);
  await page.screenshot({ path: join(dir, `${slug(route)}${suffix}.png`), fullPage: true, animations: 'disabled' });
}
async function elementShot(locator, vp, route, suffix) {
  const dir = await mkdirFor(vp);
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.screenshot({ path: join(dir, `${slug(route)}-${suffix}.png`), animations: 'disabled' }).catch(() => {});
}

async function setupContext(browser, vp, base) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, locale: 'ru-RU', reducedMotion: 'reduce', serviceWorkers: 'block',
  });
  // Do not contact Telegram during CI. A real click still opens a popup whose
  // requested URL is verified exactly, while the response is fulfilled locally.
  await context.route('https://t.me/**', (route) => route.fulfill({ status: 204, body: '' }));
  const page = await context.newPage();
  const state = { pageErrors: [], consoleErrors: [], badAssets: [] };
  page.on('pageerror', (e) => state.pageErrors.push(String(e).slice(0, 400)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/Failed to load resource: net::ERR_FAILED/i.test(text)) return; // external telemetry blocked by browser/network
    state.consoleErrors.push(text.slice(0, 400));
  });
  page.on('response', (response) => {
    if (!response.url().startsWith(base) || response.status() < 400) return;
    const kind = response.request().resourceType();
    if (['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(kind)) {
      state.badAssets.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  return { context, page, state };
}

async function go(page, state, base, route, vp) {
  state.pageErrors.length = 0; state.consoleErrors.length = 0; state.badAssets.length = 0;
  const response = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(500);
  rec(vp, route, 'document:status', response?.status() === 200, response?.status() ?? 'no response');
}

async function generic(page, state, route, vp) {
  const facts = await page.evaluate(() => {
    const root = document.scrollingElement || document.documentElement;
    const h1 = [...document.querySelectorAll('h1')].find((n) => {
      const r = n.getBoundingClientRect(), s = getComputedStyle(n);
      return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
    });
    return { overflow: Math.max(0, root.scrollWidth - root.clientWidth), title: document.title.trim(), h1: h1?.textContent?.trim() || '' };
  });
  rec(vp, route, 'runtime:pageerror', state.pageErrors.length === 0, state.pageErrors.join(' | '));
  rec(vp, route, 'runtime:console-error', state.consoleErrors.length === 0, state.consoleErrors.join(' | '));
  rec(vp, route, 'assets:same-origin', state.badAssets.length === 0, state.badAssets.join(' | '));
  rec(vp, route, 'layout:no-horizontal-overflow', facts.overflow <= 8, `${facts.overflow}px`);
  rec(vp, route, 'document:title', facts.title.length >= 4, facts.title);
  rec(vp, route, 'document:h1', Boolean(facts.h1), facts.h1 || 'no visible h1');
}

async function targetFacts(locator) {
  return locator.evaluate((node) => {
    const r = node.getBoundingClientRect(), s = getComputedStyle(node);
    return {
      href: node.getAttribute('href') || '', target: node.getAttribute('target') || '',
      rel: (node.getAttribute('rel') || '').split(/\s+/).filter(Boolean),
      visible: r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity || 1) > .05,
      rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height },
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
}

async function verifyLaunch(page, selector, expected, vp, route, name) {
  const loc = page.locator(selector).first();
  if (!(await loc.count())) { rec(vp, route, `${name}:exists`, false, selector); return; }
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const f = await targetFacts(loc);
  rec(vp, route, `${name}:visible`, f.visible, JSON.stringify(f.rect));
  rec(vp, route, `${name}:href`, f.href === expected, f.href);
  rec(vp, route, `${name}:target-blank`, f.target === '_blank', f.target);
  rec(vp, route, `${name}:noopener`, f.rel.includes('noopener'), f.rel.join(' '));
  rec(vp, route, `${name}:noreferrer`, f.rel.includes('noreferrer'), f.rel.join(' '));
  rec(vp, route, `${name}:touch-target`, f.rect.height >= 44, `${f.rect.width}×${f.rect.height}`);
  rec(vp, route, `${name}:inside-viewport`, f.rect.left >= -2 && f.rect.right <= f.viewport.width + 2, JSON.stringify(f.rect));

  await loc.focus();
  const focus = await loc.evaluate((node) => {
    const s = getComputedStyle(node); return { active: document.activeElement === node, outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, boxShadow: s.boxShadow };
  });
  const outlinePx = Number.parseFloat(focus.outlineWidth) || 0;
  rec(vp, route, `${name}:focusable`, focus.active, JSON.stringify(focus));
  rec(vp, route, `${name}:visible-focus`, (focus.outlineStyle !== 'none' && outlinePx >= 2) || (focus.boxShadow && focus.boxShadow !== 'none'), JSON.stringify(focus));

  // Real click contract, but outbound response is intercepted locally above.
  const popupPromise = page.waitForEvent('popup', { timeout: 5000 }).catch(() => null);
  await loc.click({ timeout: 5000 }).catch((e) => rec(vp, route, `${name}:click`, false, e.message));
  const popup = await popupPromise;
  rec(vp, route, `${name}:popup`, Boolean(popup), popup?.url() || 'no popup');
  if (popup) {
    await popup.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
    rec(vp, route, `${name}:popup-url`, popup.url() === expected, popup.url());
    await popup.close().catch(() => {});
  }
}

async function clickInternal(page, base, selector, expectedRoute, vp, source, name) {
  const loc = page.locator(selector).first();
  const visible = (await loc.count()) > 0 && await loc.isVisible().catch(() => false);
  rec(vp, source, `${name}:visible`, visible, selector);
  if (!visible) return;
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  await loc.click({ timeout: 5000 }).catch((e) => rec(vp, source, `${name}:click`, false, e.message));
  await page.waitForURL((u) => u.origin === new URL(base).origin && u.pathname === expectedRoute, { timeout: 8000 }).catch(() => {});
  rec(vp, source, `${name}:route`, new URL(page.url()).pathname === expectedRoute, page.url());
  await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(300);
}

async function auditHome(page, state, base, vp) {
  const route = ROUTES.home;
  await go(page, state, base, route, vp); await generic(page, state, route, vp);
  if (vp.mobile) {
    const trigger = page.locator('#hMobileMenuBtn');
    rec(vp, route, 'home:mobile-menu-trigger', (await trigger.count()) > 0 && await trigger.isVisible().catch(() => false));
    await trigger.click({ timeout: 5000 }).catch((e) => rec(vp, route, 'home:mobile-menu-click', false, e.message));
    await page.waitForTimeout(450);
    const menuState = await page.locator('#hMobileNav').evaluate((node) => ({
      ariaHidden: node.getAttribute('aria-hidden'), open: node.classList.contains('open'), inert: node.hasAttribute('inert'),
      rect: node.getBoundingClientRect().toJSON(),
    })).catch(() => null);
    const expanded = await trigger.getAttribute('aria-expanded').catch(() => null);
    rec(vp, route, 'home:mobile-menu-open', expanded === 'true' && Boolean(menuState?.open), JSON.stringify({ expanded, ...menuState }));
    await fullShot(page, vp, route, '-menu-open');
  }
  const selector = vp.mobile ? '.h-mobile-nav__primary a[href="/app/"]' : '.h-nav-links a[href="/app/"]';
  const link = page.locator(selector).first();
  const visible = (await link.count()) > 0 && await link.isVisible().catch(() => false);
  rec(vp, route, 'home:app-entry-visible', visible, selector);
  if (visible) {
    const r = await link.boundingBox();
    const minHeight = vp.mobile ? 44 : 24;
    rec(vp, route, 'home:app-entry-target-height', Boolean(r && r.height >= minHeight), r ? `${r.width}×${r.height}; minimum=${minHeight}` : 'no rect');
    await elementShot(link, vp, route, 'app-entry');
    await link.click({ timeout: 5000 }).catch(() => {});
    await page.waitForURL((u) => u.origin === new URL(base).origin && u.pathname === ROUTES.app, { timeout: 8000 }).catch(() => {});
    rec(vp, route, 'home:app-entry-route', new URL(page.url()).pathname === ROUTES.app, page.url());
  }
  if (new URL(page.url()).pathname !== ROUTES.home) await page.goto(base + route, { waitUntil: 'domcontentloaded' });
  await fullShot(page, vp, route);
}

async function auditApp(page, state, base, vp) {
  const route = ROUTES.app;
  await go(page, state, base, route, vp); await generic(page, state, route, vp);
  const stage = page.locator('.app-stage');
  rec(vp, route, 'app:preview-visible', (await stage.count()) > 0 && await stage.isVisible().catch(() => false));
  rec(vp, route, 'app:preview-three-modes', await page.locator('.app-mode-row .app-mode').count() === 3, String(await page.locator('.app-mode-row .app-mode').count()));
  await fullShot(page, vp, route);
  if (await stage.count()) await elementShot(stage, vp, route, 'product-preview');
  const bridge = page.locator('.app-bridge'); if (await bridge.count()) await elementShot(bridge, vp, route, 'study-bridge');

  await verifyLaunch(page, '.app-hero .app-primary', TELEGRAM.home, vp, route, 'app:hero-launch');
  await verifyLaunch(page, `.app-study-card a[href="${TELEGRAM.ch3}"]`, TELEGRAM.ch3, vp, route, 'app:chapter3-launch');
  await verifyLaunch(page, `.app-study-card a[href="${TELEGRAM.ch4}"]`, TELEGRAM.ch4, vp, route, 'app:chapter4-launch');
  await clickInternal(page, base, '.app-brand[href="/"]', ROUTES.home, vp, route, 'app:brand-home');
  await clickInternal(page, base, `.app-study-card a[href="${ROUTES.ch3}"]`, ROUTES.ch3, vp, route, 'app:chapter3-research');
  await clickInternal(page, base, `.app-study-card a[href="${ROUTES.ch4}"]`, ROUTES.ch4, vp, route, 'app:chapter4-research');
}

async function auditChapter(page, state, base, vp, chapter) {
  const route = chapter === 3 ? ROUTES.ch3 : ROUTES.ch4;
  const launch = chapter === 3 ? TELEGRAM.ch3 : TELEGRAM.ch4;
  const expectedParam = chapter === 3 ? 'v1_site_ch3__chapter3' : 'v1_site_ch4__chapter4';
  await go(page, state, base, route, vp); await generic(page, state, route, vp);
  const aside = page.locator(`.genesis6-app-cta[data-bible-app-chapter="${chapter}"]`).first();
  const visible = (await aside.count()) > 0 && await aside.isVisible().catch(() => false);
  rec(vp, route, 'chapter:cta-visible', visible, `chapter=${chapter}`);
  if (visible) {
    await aside.scrollIntoViewIfNeeded(); await page.waitForTimeout(250);
    const start = await aside.getAttribute('data-bible-app-start-param');
    rec(vp, route, 'chapter:start-param', start === expectedParam, start || '<missing>');
    const flow = (await aside.locator('.genesis6-app-cta__flow').innerText().catch(() => '')).toLocaleLowerCase('ru-RU');
    rec(vp, route, 'chapter:study-flow-copy', /статья[\s\S]*проверка[\s\S]*возврат к тексту/i.test(flow), flow);
    await elementShot(aside, vp, route, `chapter-${chapter}-cta`);
    await page.screenshot({ path: join(await mkdirFor(vp), `${slug(route)}-chapter-${chapter}-cta-viewport.png`), animations: 'disabled' });
  }
  await verifyLaunch(page, '[data-bible-app-launch]', launch, vp, route, 'chapter:launch');
}

async function runViewport(browser, base, vp) {
  const { context, page, state } = await setupContext(browser, vp, base);
  const tasks = [
    () => auditHome(page, state, base, vp),
    () => auditApp(page, state, base, vp),
    () => auditChapter(page, state, base, vp, 3),
    () => auditChapter(page, state, base, vp, 4),
  ];
  for (const task of tasks) {
    try { await task(); }
    catch (e) { rec(vp, page.url() || '<unknown>', 'audit:uncaught', false, e?.stack || e); }
  }
  await context.close().catch(() => {});
}

if (!existsSync(DIST)) throw new Error('dist/ missing; build production-like dist first');
await mkdir(REPORTS, { recursive: true });
const { server, base } = await serve();
let browser;
try {
  browser = await launchBrowser();
  for (const vp of VIEWPORTS) await runViewport(browser, base, vp);
} finally {
  await browser?.close().catch(() => {});
  await new Promise((resolve) => server.close(resolve));
}

const failures = results.filter((r) => !r.ok);
const passed = results.length - failures.length;
const summary = { schemaVersion: 2, generatedAt: new Date().toISOString(), engine: ENGINE, routes: Object.values(ROUTES), viewports: VIEWPORTS, contracts: results.length, passed, failed: failures.length, failures, results };
await writeFile(join(REPORTS, `bible-app-browser-${ENGINE}.json`), `${JSON.stringify(summary, null, 2)}\n`);
await writeFile(join(REPORTS, `bible-app-browser-${ENGINE}.md`), [
  `# Bible App deep browser contract — ${ENGINE}`, '',
  `- Contracts: **${passed}/${results.length} PASS**`, `- Failures: **${failures.length}**`, '',
  ...(failures.length ? ['## Failures', '', ...failures.map((r) => `- \`${r.viewport}\` · \`${r.route}\` · **${r.contract}** — ${r.detail || 'failed'}`)] : ['✅ Deep navigation, launch, focus and screenshot contract passed.']), '',
].join('\n'));
for (const f of failures) console.error(`FAIL [${f.viewport}] ${f.route} ${f.contract} :: ${f.detail}`);
console.log(`BIBLE APP BROWSER ${ENGINE.toUpperCase()}: ${passed}/${results.length} PASS`);
if (failures.length) process.exitCode = 1;
