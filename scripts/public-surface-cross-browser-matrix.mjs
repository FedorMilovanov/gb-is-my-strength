#!/usr/bin/env node
/**
 * Cross-browser touch/scroll witness for every production route.
 *
 * This complements public-surface-browser-matrix.mjs with true mobile contexts,
 * loaded local assets, real scrolling and WebKit/Safari-like rendering.
 */
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium, webkit } = require('playwright');
const { buildPublicSurfaceRegistry } = require('./lib/public-surface-registry');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const REPORTS = join(ROOT, 'reports');
const ENGINE = String(process.env.GB_CROSS_BROWSER || 'webkit').toLowerCase();
if (!['chromium', 'webkit'].includes(ENGINE)) {
  throw new Error(`Unsupported GB_CROSS_BROWSER=${ENGINE}`);
}
const MAX_WORKERS = Math.max(
  1,
  Math.min(4, Number(process.env.GB_CROSS_BROWSER_WORKERS || (ENGINE === 'webkit' ? 2 : 3))),
);

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
  '.ico': 'image/x-icon',
};

const PROFILES = ENGINE === 'chromium'
  ? [
      {
        id: 'android-360', width: 360, height: 800, mobile: true, scale: 3,
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36',
      },
      {
        id: 'android-430', width: 430, height: 932, mobile: true, scale: 3,
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36',
      },
    ]
  : [
      {
        id: 'iphone-320-webkit', width: 320, height: 760, mobile: true, scale: 2,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
      },
      {
        id: 'iphone-390-webkit', width: 390, height: 844, mobile: true, scale: 3,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
      },
      {
        id: 'desktop-webkit-1440', width: 1440, height: 900, mobile: false, scale: 1,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
      },
    ];

function routeFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  return join(DIST, clean, clean.endsWith('.html') ? '' : 'index.html');
}

async function serve() {
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
      let file = routeFile(pathname);
      if (pathname.includes('.') && !pathname.endsWith('/')) {
        file = join(DIST, pathname.replace(/^\/+/, ''));
      }
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
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

const registry = buildPublicSurfaceRegistry();
if (registry.errors.length) {
  registry.errors.forEach((error) => console.error(`REGISTRY ERROR ${error}`));
  process.exit(1);
}
const entries = registry.entries.filter((entry) =>
  entry.status === 'production-dist' &&
  !entry.route.startsWith('/dev/') &&
  !entry.route.includes('/_app/')
);

const results = [];
function record(entry, profile, contract, ok, detail = '') {
  results.push({
    engine: ENGINE,
    route: entry.route,
    surface: entry.surface,
    profile: profile.id,
    contract,
    ok: Boolean(ok),
    detail: String(detail || ''),
  });
}

function ignoredConsoleError(text) {
  return /mc\.yandex|manifest|ERR_BLOCKED_BY_CLIENT|ERR_FAILED|Failed to load resource|Load failed|NetworkError/i.test(text);
}

async function findVisible(page, selectors) {
  for (const raw of selectors.split(',')) {
    const locator = page.locator(raw.trim()).first();
    if (await locator.count() && await locator.isVisible().catch(() => false)) return locator;
  }
  return null;
}

async function exerciseControlledOverlay(page, entry, profile, name, selectors) {
  const trigger = await findVisible(page, selectors);
  if (!trigger) return;

  const controls = await trigger.getAttribute('aria-controls');
  let clicked = true;
  await trigger.click({ timeout: 4000 }).catch(() => { clicked = false; });
  if (!clicked) {
    record(entry, profile, `interaction:${name}:trigger`, false, 'visible trigger could not be clicked');
    return;
  }
  await page.waitForTimeout(180);

  const state = await page.evaluate(({ controls }) => {
    const visible = (node) => {
      if (!node) return false;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' &&
        style.visibility !== 'hidden' && Number.parseFloat(style.opacity || '1') > 0.01;
    };
    const target = controls ? document.getElementById(controls.split(/\s+/)[0]) : null;
    const fallbacks = [...document.querySelectorAll(
      '[role="dialog"],.mobile-nav,.toc-overlay,.settings-overlay,.cp-backdrop,.gill-settings-overlay'
    )].filter(visible);
    const node = visible(target) ? target : (fallbacks.at(-1) || null);
    if (!node) return { found: false, controls };
    const rect = node.getBoundingClientRect();
    return {
      found: true,
      controls,
      rect: {
        left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
        width: rect.width, height: rect.height,
      },
      viewport: { width: innerWidth, height: innerHeight },
      ariaHidden: node.getAttribute('aria-hidden'),
    };
  }, { controls });

  record(entry, profile, `interaction:${name}:opens`, Boolean(state?.found), JSON.stringify(state));
  if (state?.found) {
    const inside = state.rect.left >= -6 && state.rect.top >= -6 &&
      state.rect.right <= state.viewport.width + 6 && state.rect.bottom <= state.viewport.height + 6;
    record(entry, profile, `interaction:${name}:inside-viewport`, inside, JSON.stringify(state.rect));
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(100);
}

async function inspectScroll(page, entry, profile) {
  const candidate = await page.evaluate(() => {
    document.querySelectorAll('[data-gb-cross-scroll-candidate]').forEach((node) =>
      node.removeAttribute('data-gb-cross-scroll-candidate')
    );
    const root = document.scrollingElement || document.documentElement;
    const nodes = [root, ...document.querySelectorAll('body *')];
    const choices = nodes.map((node) => {
      if (!(node instanceof HTMLElement)) return null;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      const canScroll = node.scrollHeight > node.clientHeight + 32 &&
        (node === root ? style.overflowY !== 'hidden' : /auto|scroll/.test(style.overflowY));
      if (!canScroll || rect.width < 80 || rect.height < 80 ||
          style.display === 'none' || style.visibility === 'hidden' ||
          node.closest('[aria-hidden="true"],.sr-only,[hidden]')) return null;
      return { node, area: rect.width * rect.height };
    }).filter(Boolean).sort((a, b) => b.area - a.area);
    const selected = choices[0]?.node || null;
    if (!selected) return null;
    selected.setAttribute('data-gb-cross-scroll-candidate', '1');
    return {
      root: selected === root,
      clientHeight: selected.clientHeight,
      scrollHeight: selected.scrollHeight,
      tag: selected.tagName.toLowerCase(),
      id: selected.id || '',
      className: String(selected.className || '').slice(0, 160),
    };
  });

  if (!candidate) {
    record(entry, profile, 'scroll:no-accidental-required-scroll', true, 'viewport-fixed or shorter than viewport');
    return;
  }

  const before = await page.evaluate(() => {
    const node = document.querySelector('[data-gb-cross-scroll-candidate]');
    if (!node) return null;
    const root = document.scrollingElement || document.documentElement;
    const oldBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    if (node instanceof HTMLElement) node.style.scrollBehavior = 'auto';
    if (node === root) window.scrollTo(0, node.scrollHeight);
    else node.scrollTop = node.scrollHeight;
    return { oldBehavior, initial: node.scrollTop, max: node.scrollHeight - node.clientHeight };
  });
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => {
    const node = document.querySelector('[data-gb-cross-scroll-candidate]');
    if (!node) return null;
    const root = document.scrollingElement || document.documentElement;
    const reached = node.scrollTop;
    if (node === root) window.scrollTo(0, 0);
    else node.scrollTop = 0;
    return { reached, max: node.scrollHeight - node.clientHeight };
  });

  const moved = Boolean(before && after && after.reached > 0 && after.reached >= Math.min(20, after.max));
  record(entry, profile, 'scroll:reaches-content', moved, JSON.stringify({ candidate, before, after }));
}

async function runCase(browser, base, entry, profile) {
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    isMobile: profile.mobile,
    hasTouch: profile.mobile,
    deviceScaleFactor: profile.scale,
    userAgent: profile.userAgent,
    locale: 'ru-RU',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const badAssets = [];

  page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 260)));
  page.on('console', (message) => {
    if (message.type() === 'error' && !ignoredConsoleError(message.text())) {
      consoleErrors.push(message.text().slice(0, 260));
    }
  });
  page.on('response', (response) => {
    if (response.url().startsWith(base) && response.status() >= 400) {
      badAssets.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (!url.startsWith(base) && !url.startsWith('data:') && !url.startsWith('blob:')) {
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });

  try {
    const response = await page.goto(base + entry.route, {
      waitUntil: 'domcontentloaded',
      timeout: 25000,
    });
    await page.waitForTimeout(800);
    record(entry, profile, 'document:status', response?.status() === 200, response?.status() ?? 'no response');

    const facts = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      const root = document.scrollingElement || html;
      const isVisible = (node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' &&
          style.visibility !== 'hidden' && Number.parseFloat(style.opacity || '1') > 0.01 &&
          !node.closest('[aria-hidden="true"],[hidden],.sr-only');
      };
      const brokenControls = [...document.querySelectorAll('[aria-controls]')]
        .filter((node) => isVisible(node) && node.getAttribute('aria-controls').split(/\s+/)
          .some((id) => id && !document.getElementById(id)))
        .map((node) => `${node.tagName.toLowerCase()}#${node.id || '-'}→${node.getAttribute('aria-controls')}`)
        .slice(0, 12);
      const initialDialogs = [...document.querySelectorAll('[role="dialog"]')]
        .filter((node) => isVisible(node) && node.getAttribute('aria-hidden') !== 'true')
        .map((node) => node.id || String(node.className || '').slice(0, 100) || node.tagName)
        .slice(0, 8);
      const fixedOutside = [...document.querySelectorAll(
        'a,button,input,select,textarea,[role="button"],[role="dialog"],[tabindex]'
      )].filter((node) => {
        if (!isVisible(node)) return false;
        const style = getComputedStyle(node);
        if (!['fixed', 'sticky'].includes(style.position)) return false;
        const rect = node.getBoundingClientRect();
        return rect.left < -8 || rect.right > innerWidth + 8 || rect.top < -8 || rect.bottom > innerHeight + 8;
      }).map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          tag: node.tagName.toLowerCase(), id: node.id,
          className: String(node.className || '').slice(0, 120),
          rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
        };
      }).slice(0, 12);
      const textLength = (body.innerText || '').replace(/\s+/g, ' ').trim().length;
      const visibleMedia = [...document.querySelectorAll('canvas,iframe,img,video')].some((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return rect.width > 40 && rect.height > 40 && style.display !== 'none' && style.visibility !== 'hidden';
      });
      return {
        overflow: Math.max(0, root.scrollWidth - root.clientWidth, body.scrollWidth - body.clientWidth),
        brokenControls,
        initialDialogs,
        fixedOutside,
        textLength,
        visibleMedia,
      };
    });

    record(entry, profile, 'layout:no-horizontal-overflow', facts.overflow <= 8, `${facts.overflow}px`);
    record(entry, profile, 'a11y:aria-controls-targets', facts.brokenControls.length === 0, facts.brokenControls.join(', '));
    record(entry, profile, 'overlay:no-unexpected-initial-dialog', facts.initialDialogs.length === 0, facts.initialDialogs.join(', '));
    record(entry, profile, 'layout:fixed-interactives-inside-viewport', facts.fixedOutside.length === 0, JSON.stringify(facts.fixedOutside));
    record(entry, profile, 'render:not-blank', facts.textLength >= 20 || facts.visibleMedia, `text=${facts.textLength}; media=${facts.visibleMedia}`);

    await inspectScroll(page, entry, profile);
    if (profile.mobile) {
      await exerciseControlledOverlay(page, entry, profile, 'settings', '#mobSettingsBtn,[aria-controls="gillSettingsOverlay"],[data-mobile-action="settings"]');
      await exerciseControlledOverlay(page, entry, profile, 'toc', '#mobPartTocBtn,[data-mobile-action="part-toc"],[data-gbs-part-toc]');
      await exerciseControlledOverlay(page, entry, profile, 'navigation', '#mobileMenuBtn,.mobile-menu-toggle,[data-menu-toggle]');
    } else {
      await exerciseControlledOverlay(page, entry, profile, 'settings', '#railSettingsBtn,[aria-controls="gillSettingsOverlay"]');
    }

    record(entry, profile, 'runtime:pageerror', pageErrors.length === 0, pageErrors.join(' | '));
    record(entry, profile, 'runtime:console-error', consoleErrors.length === 0, consoleErrors.join(' | '));
    record(entry, profile, 'assets:same-origin', badAssets.length === 0, [...new Set(badAssets)].join(' | '));
  } catch (error) {
    record(entry, profile, 'matrix:uncaught', false, error?.stack || error);
  } finally {
    await context.close().catch(() => {});
  }
}

async function pool(items, worker) {
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_WORKERS, items.length) }, run));
}

if (!existsSync(DIST)) {
  console.error('dist/ missing; run npm run strangler:build:production-like first');
  process.exit(1);
}

const { server, base } = await serve();
let browser;
try {
  browser = ENGINE === 'webkit'
    ? await webkit.launch()
    : await chromium.launch({ args: ['--disable-dev-shm-usage'] });
  const cases = entries.flatMap((entry) => PROFILES.map((profile) => ({ entry, profile })));
  console.log(`Cross-browser matrix: ${ENGINE}; ${entries.length} routes × ${PROFILES.length} profiles = ${cases.length}; workers=${MAX_WORKERS}`);
  await pool(cases, ({ entry, profile }) => runCase(browser, base, entry, profile));
} finally {
  await browser?.close().catch(() => {});
  await new Promise((resolve) => server.close(resolve));
}

results.sort((a, b) =>
  a.route.localeCompare(b.route, 'ru') ||
  a.profile.localeCompare(b.profile) ||
  a.contract.localeCompare(b.contract)
);
const failures = results.filter((item) => !item.ok);
const passed = results.length - failures.length;
const summary = {
  generatedAt: new Date().toISOString(),
  engine: ENGINE,
  registry: { total: registry.entries.length, publicTested: entries.length },
  profiles: PROFILES,
  contracts: results.length,
  passed,
  failed: failures.length,
  failures,
  results,
};
await mkdir(REPORTS, { recursive: true });
const stem = `public-surface-cross-browser-${ENGINE}`;
await writeFile(join(REPORTS, `${stem}.json`), `${JSON.stringify(summary, null, 2)}\n`);
const markdown = [
  `# Public surface cross-browser matrix — ${ENGINE}`, '',
  `- Routes tested: **${entries.length}**`,
  `- Profiles: **${PROFILES.map((profile) => profile.id).join(', ')}**`,
  `- Contracts: **${passed}/${results.length} PASS**`,
  `- Failures: **${failures.length}**`, '',
  ...(failures.length
    ? ['## Failures', '', ...failures.map((failure) =>
        `- \`${failure.route}\` · \`${failure.profile}\` · **${failure.contract}** — ${failure.detail || 'failed'}`)]
    : [`✅ Every public route passed the ${ENGINE} touch/scroll/resource contracts.`]),
  '',
];
await writeFile(join(REPORTS, `${stem}.md`), `${markdown.join('\n')}\n`);
for (const failure of failures) {
  console.error(`FAIL [${ENGINE}/${failure.profile}] ${failure.route} ${failure.contract} :: ${failure.detail}`);
}
console.log(`PUBLIC SURFACE CROSS-BROWSER ${ENGINE.toUpperCase()}: ${passed}/${results.length} PASS (${entries.length} routes)`);
if (failures.length) process.exitCode = 1;
