#!/usr/bin/env node
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = String(process.env.GB_LIVE_BASE || 'https://gospod-bog.ru').replace(/\/+$/, '');
const OUT = 'reports/bible-app-live-browser';
const VIEWPORTS = [
  { id: 'mobile-390', width: 390, height: 844 },
  { id: 'desktop-1440', width: 1440, height: 900 },
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
const rows = [];
function add(vp, route, check, ok, detail = '') {
  rows.push({ viewport: vp.id, route, check, ok: Boolean(ok), detail: String(detail || '') });
}
function slug(route) {
  return route === '/' ? 'home' : route.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9а-яё_-]+/gi, '-').slice(0, 80);
}
function isSameOrigin(url) {
  return url === BASE || url.startsWith(`${BASE}/`);
}
function isCoreResource(kind) {
  return ['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(kind);
}
async function shot(page, vp, route, suffix = '') {
  const dir = join(OUT, vp.id);
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${slug(route)}${suffix}.png`), fullPage: true, animations: 'disabled' });
}
async function elementShot(locator, vp, route, suffix) {
  const dir = join(OUT, vp.id);
  await mkdir(dir, { recursive: true });
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.screenshot({ path: join(dir, `${slug(route)}-${suffix}.png`), animations: 'disabled' }).catch(() => {});
}
async function generic(page, vp, route, state) {
  const facts = await page.evaluate(() => {
    const root = document.scrollingElement || document.documentElement;
    const h1 = [...document.querySelectorAll('h1')].find((node) => {
      const r = node.getBoundingClientRect(), s = getComputedStyle(node);
      return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
    });
    return {
      title: document.title.trim(),
      h1: h1?.textContent?.trim() || '',
      overflow: Math.max(0, root.scrollWidth - root.clientWidth),
      canonical: document.querySelector('link[rel="canonical"]')?.href || '',
    };
  });
  add(vp, route, 'runtime:pageerror', state.pageErrors.length === 0, state.pageErrors.join(' | '));
  add(vp, route, 'runtime:console-error', state.consoleErrors.length === 0, state.consoleErrors.join(' | '));
  add(vp, route, 'assets:same-origin', state.badAssets.length === 0, state.badAssets.join(' | '));
  add(vp, route, 'layout:no-horizontal-overflow', facts.overflow <= 8, `${facts.overflow}px`);
  add(vp, route, 'document:title', facts.title.length > 3, facts.title);
  add(vp, route, 'document:h1', Boolean(facts.h1), facts.h1 || 'missing h1');
  add(vp, route, 'document:canonical-live-origin', facts.canonical.startsWith(`${BASE}/`), facts.canonical);
}
async function go(page, vp, route, state) {
  state.pageErrors.length = 0;
  state.consoleErrors.length = 0;
  state.badAssets.length = 0;
  const response = await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(700);
  add(vp, route, 'http:200', response?.status() === 200, response?.status() ?? 'no response');
  await generic(page, vp, route, state);
}
async function verifyAnchor(page, vp, route, selector, href, name) {
  const a = page.locator(selector).first();
  if (!(await a.count())) { add(vp, route, `${name}:exists`, false, selector); return; }
  await a.scrollIntoViewIfNeeded().catch(() => {});
  const f = await a.evaluate((node) => {
    const r = node.getBoundingClientRect();
    return { href: node.getAttribute('href') || '', target: node.getAttribute('target') || '', rel: node.getAttribute('rel') || '', width: r.width, height: r.height };
  });
  add(vp, route, `${name}:href`, f.href === href, f.href);
  add(vp, route, `${name}:target`, f.target === '_blank', f.target);
  add(vp, route, `${name}:rel`, /\bnoopener\b/.test(f.rel) && /\bnoreferrer\b/.test(f.rel), f.rel);
  add(vp, route, `${name}:target-height`, f.height >= 44, `${f.width}×${f.height}`);
  await a.focus();
  add(vp, route, `${name}:focusable`, await a.evaluate((n) => document.activeElement === n));
}
async function clickInternal(page, vp, sourceRoute, selector, targetRoute, name) {
  const a = page.locator(selector).first();
  const visible = (await a.count()) > 0 && await a.isVisible().catch(() => false);
  add(vp, sourceRoute, `${name}:visible`, visible, selector);
  if (!visible) return;
  await a.click({ timeout: 8000 }).catch((e) => add(vp, sourceRoute, `${name}:click`, false, e.message));
  await page.waitForURL((url) => url.origin === new URL(BASE).origin && url.pathname === targetRoute, { timeout: 12000 }).catch(() => {});
  add(vp, sourceRoute, `${name}:route`, new URL(page.url()).pathname === targetRoute, page.url());
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'ru-RU', reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.route('https://t.me/**', (route) => route.fulfill({ status: 204, body: '' }));
  // Telemetry is not part of product correctness and can be blocked by CI networks.
  await context.route('https://mc.yandex.**/**', (route) => route.abort());
  const page = await context.newPage();
  const state = { pageErrors: [], consoleErrors: [], badAssets: [] };
  page.on('pageerror', (e) => state.pageErrors.push(String(e).slice(0, 400)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    const sourceUrl = String(m.location()?.url || '');
    if (/mc\.yandex/i.test(sourceUrl) || /mc\.yandex/i.test(text)) return;
    // Chromium can emit an anonymous network console line without the failed
    // resource URL. Same-origin network failures are tracked fail-closed below
    // via response/requestfailed events, so an unattributed browser line is not
    // allowed to masquerade as a product-owned runtime exception.
    if (/^Failed to load resource:/i.test(text) && !sourceUrl) return;
    state.consoleErrors.push(sourceUrl ? `${text.slice(0, 300)} @ ${sourceUrl.slice(0, 300)}` : text.slice(0, 400));
  });
  page.on('response', (response) => {
    const url = response.url();
    const status = response.status();
    const kind = response.request().resourceType();
    if (!isSameOrigin(url) || status < 400 || !isCoreResource(kind)) return;
    state.badAssets.push(`${status} ${new URL(url).pathname} [${kind}]`);
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    const kind = request.resourceType();
    if (!isSameOrigin(url) || !isCoreResource(kind)) return;
    state.badAssets.push(`FAILED ${new URL(url).pathname} [${kind}] ${request.failure()?.errorText || ''}`.trim());
  });

  try {
    await go(page, vp, ROUTES.home, state);
    if (vp.width < 700) {
      const trigger = page.locator('#hMobileMenuBtn');
      await trigger.click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(400);
      add(vp, ROUTES.home, 'home:mobile-menu-open', (await trigger.getAttribute('aria-expanded')) === 'true');
      await shot(page, vp, ROUTES.home, '-menu');
      await clickInternal(page, vp, ROUTES.home, '.h-mobile-nav__primary a[href="/app/"]', ROUTES.app, 'home:app-click');
    } else {
      const homeApp = page.locator('.h-nav-links a[href="/app/"]').first();
      const rect = await homeApp.boundingBox();
      add(vp, ROUTES.home, 'home:desktop-app-target-height', Boolean(rect && rect.height >= 24), rect ? `${rect.width}×${rect.height}` : 'missing');
      await elementShot(homeApp, vp, ROUTES.home, 'app-entry');
      await clickInternal(page, vp, ROUTES.home, '.h-nav-links a[href="/app/"]', ROUTES.app, 'home:app-click');
    }

    await go(page, vp, ROUTES.app, state);
    await shot(page, vp, ROUTES.app);
    await verifyAnchor(page, vp, ROUTES.app, '.app-hero .app-primary', TELEGRAM.home, 'app:hero-launch');
    await verifyAnchor(page, vp, ROUTES.app, `.app-study-card a[href="${TELEGRAM.ch3}"]`, TELEGRAM.ch3, 'app:ch3-launch');
    await verifyAnchor(page, vp, ROUTES.app, `.app-study-card a[href="${TELEGRAM.ch4}"]`, TELEGRAM.ch4, 'app:ch4-launch');
    await clickInternal(page, vp, ROUTES.app, `.app-study-card a[href="${ROUTES.ch3}"]`, ROUTES.ch3, 'app:ch3-research');

    await go(page, vp, ROUTES.ch3, state);
    const cta3 = page.locator('[data-bible-app-chapter="3"]').first();
    add(vp, ROUTES.ch3, 'ch3:cta-visible', (await cta3.count()) > 0 && await cta3.isVisible().catch(() => false));
    add(vp, ROUTES.ch3, 'ch3:start-param', await cta3.getAttribute('data-bible-app-start-param') === 'v1_site_ch3__chapter3', await cta3.getAttribute('data-bible-app-start-param') || '');
    await elementShot(cta3, vp, ROUTES.ch3, 'cta');
    await verifyAnchor(page, vp, ROUTES.ch3, '[data-bible-app-launch]', TELEGRAM.ch3, 'ch3:launch');

    await go(page, vp, ROUTES.ch4, state);
    const cta4 = page.locator('[data-bible-app-chapter="4"]').first();
    add(vp, ROUTES.ch4, 'ch4:cta-visible', (await cta4.count()) > 0 && await cta4.isVisible().catch(() => false));
    add(vp, ROUTES.ch4, 'ch4:start-param', await cta4.getAttribute('data-bible-app-start-param') === 'v1_site_ch4__chapter4', await cta4.getAttribute('data-bible-app-start-param') || '');
    await elementShot(cta4, vp, ROUTES.ch4, 'cta');
    await verifyAnchor(page, vp, ROUTES.ch4, '[data-bible-app-launch]', TELEGRAM.ch4, 'ch4:launch');
  } catch (e) {
    add(vp, page.url() || '<unknown>', 'audit:uncaught', false, e?.stack || e);
  }
  await context.close();
}
await browser.close();

const failures = rows.filter((r) => !r.ok);
const summary = { schemaVersion: 1, base: BASE, generatedAt: new Date().toISOString(), checks: rows.length, passed: rows.length - failures.length, failed: failures.length, failures, results: rows };
await writeFile(join(OUT, 'live-browser.json'), `${JSON.stringify(summary, null, 2)}\n`);
await writeFile(join(OUT, 'live-browser.md'), [
  '# Bible App live Playwright witness', '',
  `- Base: ${BASE}`, `- Checks: **${summary.passed}/${summary.checks} PASS**`, `- Failures: **${summary.failed}**`, '',
  ...(failures.length ? ['## Failures', '', ...failures.map((f) => `- \`${f.viewport}\` · \`${f.route}\` · **${f.check}** — ${f.detail}`)] : ['✅ Live integration passed.']), '',
].join('\n'));
for (const f of failures) console.error(`LIVE FAIL [${f.viewport}] ${f.route} ${f.check} :: ${f.detail}`);
console.log(`BIBLE APP LIVE: ${summary.passed}/${summary.checks} PASS`);
if (failures.length) process.exitCode = 1;
