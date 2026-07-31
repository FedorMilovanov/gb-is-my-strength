#!/usr/bin/env node
/**
 * Cross-browser touch/scroll witness for every production route.
 * Android-like Chromium and iPhone/desktop WebKit run from the same contract.
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
if (!['chromium', 'webkit'].includes(ENGINE)) throw new Error(`Unsupported GB_CROSS_BROWSER=${ENGINE}`);
const WORKERS = Math.max(1, Math.min(4, Number(process.env.GB_CROSS_BROWSER_WORKERS || 2)));
const DIAGNOSTICS = join(REPORTS, 'public-surface-cross-browser-diagnostics', ENGINE);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.ico': 'image/x-icon',
};

const PROFILES = ENGINE === 'chromium' ? [
  {
    id: 'android-360', width: 360, height: 800, mobile: true, scale: 3,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36',
  },
  {
    id: 'android-430', width: 430, height: 932, mobile: true, scale: 3,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36',
  },
] : [
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
  entry.status === 'production-dist' && !entry.route.startsWith('/dev/') && !entry.route.includes('/_app/')
);
const results = [];
function record(entry, profile, contract, ok, detail = '') {
  results.push({
    engine: ENGINE, route: entry.route, surface: entry.surface, profile: profile.id,
    contract, ok: Boolean(ok), detail: String(detail || ''),
  });
}

function safeName(route, profile, label) {
  const routeName = route.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9а-яё_-]+/gi, '-') || 'home';
  return `${routeName}--${profile.id}--${label}.png`;
}

async function capture(page, entry, profile, label) {
  try {
    await mkdir(DIAGNOSTICS, { recursive: true });
    const file = join(DIAGNOSTICS, safeName(entry.route, profile, label));
    await page.screenshot({ path: file, fullPage: false });
    return file.slice(ROOT.length + 1);
  } catch (error) {
    return `screenshot failed: ${error.message}`;
  }
}

function ignoredConsoleError(text) {
  return /mc\.yandex|manifest|ERR_BLOCKED_BY_CLIENT|ERR_FAILED|Failed to load resource|Load failed|NetworkError|Viewport argument key "interactive-widget" not recognized and ignored|Refused to load https:\/\/gospod-bog\.ru\/images\/.*img-src directive/i.test(text);
}

function ignoredPageError(text) {
  return /ResizeObserver loop completed with undelivered notifications/i.test(text);
}

async function findVisible(page, selectors) {
  for (const raw of selectors.split(',')) {
    const locator = page.locator(raw.trim()).first();
    if (await locator.count() && await locator.isVisible().catch(() => false)) return locator;
  }
  return null;
}

async function inspectTrigger(trigger) {
  return trigger.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const top = document.elementFromPoint(point.x, point.y);
    const style = getComputedStyle(node);
    return {
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      point,
      position: style.position,
      fullyInViewport: rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.top >= 0 &&
        rect.right <= innerWidth && rect.bottom <= innerHeight,
      centerInViewport: point.x >= 0 && point.y >= 0 && point.x <= innerWidth && point.y <= innerHeight,
      hitTarget: Boolean(top && (top === node || node.contains(top))),
      top: top ? `${top.tagName.toLowerCase()}#${top.id || ''}.${String(top.className || '').slice(0, 100)}` : null,
    };
  }).catch(() => null);
}

async function inspectOpenOverlay(page, controls = null) {
  return page.evaluate(({ controls }) => {
    const visible = (node) => {
      if (!node) return false;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' &&
        style.visibility !== 'hidden' && Number.parseFloat(style.opacity || '1') > 0.01;
    };
    const target = controls ? document.getElementById(String(controls).split(/\s+/)[0]) : null;
    const fallbacks = [...document.querySelectorAll(
      '[role="dialog"],.mobile-nav,.toc-overlay,.settings-overlay,.cp-backdrop,' +
      '.gill-settings-overlay,.mso-backdrop,.mso-panel'
    )].filter(visible);
    const node = visible(target) ? target : fallbacks.at(-1);
    if (!node) return { found: false, controls };
    const rect = node.getBoundingClientRect();
    return {
      found: true,
      controls,
      descriptor: `${node.tagName.toLowerCase()}#${node.id || ''}.${String(node.className || '').slice(0, 120)}`,
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
    };
  }, { controls }).catch((error) => ({ found: true, controls, inspectionError: error.message }));
}

async function ensureOverlayClean(page, entry, profile, name) {
  const initial = await inspectOpenOverlay(page);
  if (!initial?.found) {
    record(entry, profile, `interaction:${name}:preflight-clean`, true, 'already clean');
    return true;
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(180);
  let state = await inspectOpenOverlay(page);
  let recovery = 'escape';
  let shot = null;
  if (state?.found) {
    shot = await capture(page, entry, profile, `${name}-preflight-open`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(180);
    state = await inspectOpenOverlay(page);
    recovery = 'reload';
  }
  const clean = !state?.found;
  record(entry, profile, `interaction:${name}:preflight-clean`, clean,
    JSON.stringify({ initial, state, recovery, shot }));
  if (!clean) await capture(page, entry, profile, `${name}-preflight-recovery-failure`);
  return clean;
}

async function exerciseOverlay(page, entry, profile, name, selectors) {
  if (!await ensureOverlayClean(page, entry, profile, name)) return;
  const trigger = await findVisible(page, selectors);
  if (!trigger) return;
  const controls = await trigger.getAttribute('aria-controls');
  let hit = await inspectTrigger(trigger);
  let activation = 'locator';
  try {
    const fixedOwner = ['fixed', 'sticky'].includes(hit?.position);
    if (!hit?.fullyInViewport && !fixedOwner) {
      await trigger.scrollIntoViewIfNeeded({ timeout: 3000 });
      await page.waitForTimeout(80);
      hit = await inspectTrigger(trigger);
    }
    try {
      await trigger.click({ timeout: 4000 });
    } catch (locatorError) {
      hit = await inspectTrigger(trigger);
      if (!hit?.centerInViewport || !hit?.hitTarget) throw locatorError;
      activation = 'mouse';
      await page.mouse.click(hit.point.x, hit.point.y);
    }
  } catch (error) {
    hit = await inspectTrigger(trigger);
    const shot = await capture(page, entry, profile, `${name}-click-failure`);
    record(entry, profile, `interaction:${name}:trigger`, false, JSON.stringify({ error: error.message, hit, activation, shot }));
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
    const node = visible(target) ? target : fallbacks.at(-1);
    if (!node) return { found: false, controls };
    const rect = node.getBoundingClientRect();
    return {
      found: true, controls,
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      viewport: { width: innerWidth, height: innerHeight },
    };
  }, { controls });
  record(entry, profile, `interaction:${name}:opens`, Boolean(state?.found), JSON.stringify({ ...state, activation }));
  if (state?.found) {
    const inside = state.rect.left >= -6 && state.rect.top >= -6 &&
      state.rect.right <= state.viewport.width + 6 && state.rect.bottom <= state.viewport.height + 6;
    record(entry, profile, `interaction:${name}:inside-viewport`, inside, JSON.stringify(state.rect));
    if (!inside) await capture(page, entry, profile, `${name}-outside-viewport`);
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(180);
  let closingState = await inspectOpenOverlay(page, controls);
  const closed = !closingState?.found;
  let closeShot = null;
  if (!closed) closeShot = await capture(page, entry, profile, `${name}-close-failure`);
  record(entry, profile, `interaction:${name}:closes`, closed,
    JSON.stringify({ controls, closingState, closeShot }));
  if (!closed) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(180);
    closingState = await inspectOpenOverlay(page, controls);
    const recovered = !closingState?.found;
    record(entry, profile, `interaction:${name}:state-recovered`, recovered,
      JSON.stringify({ controls, closingState, recovery: 'reload' }));
    if (!recovered) await capture(page, entry, profile, `${name}-state-recovery-failure`);
  }
}

async function inspectScroll(page, entry, profile) {
  const candidate = await page.evaluate(() => {
    document.querySelectorAll('[data-gb-cross-scroll-candidate]').forEach((node) =>
      node.removeAttribute('data-gb-cross-scroll-candidate')
    );
    const root = document.scrollingElement || document.documentElement;
    const choices = [root, ...document.querySelectorAll('body *')].map((node) => {
      if (!(node instanceof HTMLElement)) return null;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      const scrollable = node.scrollHeight > node.clientHeight + 32 &&
        (node === root ? style.overflowY !== 'hidden' : /auto|scroll/.test(style.overflowY));
      if (!scrollable || rect.width < 80 || rect.height < 80 || style.display === 'none' ||
          style.visibility === 'hidden' || node.closest('[aria-hidden="true"],.sr-only,[hidden]')) return null;
      return { node, area: rect.width * rect.height };
    }).filter(Boolean).sort((a, b) => b.area - a.area);
    const node = choices[0]?.node;
    if (!node) return null;
    node.setAttribute('data-gb-cross-scroll-candidate', '1');
    return {
      root: node === root, tag: node.tagName.toLowerCase(), id: node.id || '',
      className: String(node.className || '').slice(0, 160),
      clientHeight: node.clientHeight, scrollHeight: node.scrollHeight,
    };
  });
  if (!candidate) {
    record(entry, profile, 'scroll:no-accidental-required-scroll', true, 'viewport-fixed or shorter than viewport');
    return;
  }
  await page.evaluate(() => {
    const node = document.querySelector('[data-gb-cross-scroll-candidate]');
    if (!node) return;
    document.documentElement.style.scrollBehavior = 'auto';
    if (node instanceof HTMLElement) node.style.scrollBehavior = 'auto';
    if (node === (document.scrollingElement || document.documentElement)) window.scrollTo(0, node.scrollHeight);
    else node.scrollTop = node.scrollHeight;
  });
  await page.waitForTimeout(120);
  const state = await page.evaluate(() => {
    const node = document.querySelector('[data-gb-cross-scroll-candidate]');
    if (!node) return null;
    const reached = node.scrollTop;
    const max = node.scrollHeight - node.clientHeight;
    if (node === (document.scrollingElement || document.documentElement)) window.scrollTo(0, 0);
    else node.scrollTop = 0;
    return { reached, max };
  });
  record(entry, profile, 'scroll:reaches-content', Boolean(state && state.reached > 0 && state.reached >= Math.min(20, state.max)), JSON.stringify({ candidate, state }));
  await page.waitForTimeout(80);
}

async function runCase(browser, base, entry, profile) {
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height }, isMobile: profile.mobile,
    hasTouch: profile.mobile, deviceScaleFactor: profile.scale, userAgent: profile.userAgent,
    locale: 'ru-RU', reducedMotion: 'reduce', serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const badAssets = [];
  page.on('pageerror', (error) => {
    const text = String(error).slice(0, 260);
    if (!ignoredPageError(text)) pageErrors.push(text);
  });
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
  await page.route('**/*', (route) => {
    const url = route.request().url();
    return !url.startsWith(base) && !url.startsWith('data:') && !url.startsWith('blob:')
      ? route.abort('blockedbyclient')
      : route.continue();
  });

  try {
    const response = await page.goto(base + entry.route, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(800);
    record(entry, profile, 'document:status', response?.status() === 200, response?.status() ?? 'no response');
    const facts = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      const root = document.scrollingElement || html;
      const visible = (node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' &&
          style.visibility !== 'hidden' && Number.parseFloat(style.opacity || '1') > 0.01 &&
          !node.closest('[aria-hidden="true"],[hidden],.sr-only');
      };
      const selector = (node) => {
        if (node.id) return `#${node.id}`;
        const classes = [...node.classList].slice(0, 3).join('.');
        return `${node.tagName.toLowerCase()}${classes ? `.${classes}` : ''}`;
      };
      const overflow = Math.max(0, root.scrollWidth - root.clientWidth, body.scrollWidth - body.clientWidth);
      const offenders = overflow <= 8 ? [] : [...document.querySelectorAll('body *')].map((node) => {
        if (!(node instanceof HTMLElement) || !visible(node)) return null;
        const rect = node.getBoundingClientRect();
        const excess = Math.max(0, rect.right - innerWidth, -rect.left, node.scrollWidth - node.clientWidth);
        if (excess <= 1) return null;
        const style = getComputedStyle(node);
        return {
          selector: selector(node), text: (node.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 140),
          excess: Math.round(excess * 10) / 10,
          rect: { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) },
          clientWidth: node.clientWidth, scrollWidth: node.scrollWidth,
          position: style.position, whiteSpace: style.whiteSpace, minWidth: style.minWidth,
        };
      }).filter(Boolean).sort((a, b) => b.excess - a.excess).slice(0, 20);
      const brokenControls = [...document.querySelectorAll('[aria-controls]')]
        .filter((node) => visible(node) && node.getAttribute('aria-controls').split(/\s+/)
          .some((id) => id && !document.getElementById(id)))
        .map((node) => `${node.tagName.toLowerCase()}#${node.id || '-'}→${node.getAttribute('aria-controls')}`)
        .slice(0, 12);
      const initialDialogs = [...document.querySelectorAll('[role="dialog"]')]
        .filter((node) => visible(node) && node.getAttribute('aria-hidden') !== 'true')
        .map((node) => node.id || String(node.className || '').slice(0, 100) || node.tagName).slice(0, 8);
      const fixedOutside = [...document.querySelectorAll('a,button,input,select,textarea,[role="button"],[role="dialog"],[tabindex]')]
        .filter((node) => {
          if (!visible(node)) return false;
          const style = getComputedStyle(node);
          if (!['fixed', 'sticky'].includes(style.position)) return false;
          const rect = node.getBoundingClientRect();
          return rect.left < -8 || rect.right > innerWidth + 8 || rect.top < -8 || rect.bottom > innerHeight + 8;
        }).map((node) => selector(node)).slice(0, 12);
      const textLength = (body.innerText || '').replace(/\s+/g, ' ').trim().length;
      const media = [...document.querySelectorAll('canvas,iframe,img,video')].some((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return rect.width > 40 && rect.height > 40 && style.display !== 'none' && style.visibility !== 'hidden';
      });
      return { overflow, offenders, brokenControls, initialDialogs, fixedOutside, textLength, media };
    });

    record(entry, profile, 'layout:no-horizontal-overflow', facts.overflow <= 8, JSON.stringify({ overflow: facts.overflow, offenders: facts.offenders }));
    if (facts.overflow > 8) await capture(page, entry, profile, 'horizontal-overflow');
    record(entry, profile, 'a11y:aria-controls-targets', facts.brokenControls.length === 0, facts.brokenControls.join(', '));
    record(entry, profile, 'overlay:no-unexpected-initial-dialog', facts.initialDialogs.length === 0, facts.initialDialogs.join(', '));
    record(entry, profile, 'layout:fixed-interactives-inside-viewport', facts.fixedOutside.length === 0, facts.fixedOutside.join(', '));
    record(entry, profile, 'render:not-blank', facts.textLength >= 20 || facts.media, `text=${facts.textLength}; media=${facts.media}`);

    await inspectScroll(page, entry, profile);
    if (profile.mobile) {
      await exerciseOverlay(page, entry, profile, 'settings', '#mobSettingsBtn,[aria-controls="gillSettingsOverlay"],[data-mobile-action="settings"]');
      await exerciseOverlay(page, entry, profile, 'toc', '#mobPartTocBtn,[data-mobile-action="part-toc"],[data-gbs-part-toc]');
      await exerciseOverlay(page, entry, profile, 'navigation', '#mobileMenuBtn,.mobile-menu-toggle,[data-menu-toggle]');
    } else {
      await exerciseOverlay(page, entry, profile, 'settings', '#railSettingsBtn,[aria-controls="gillSettingsOverlay"]');
    }
    record(entry, profile, 'runtime:pageerror', pageErrors.length === 0, pageErrors.join(' | '));
    record(entry, profile, 'runtime:console-error', consoleErrors.length === 0, consoleErrors.join(' | '));
    record(entry, profile, 'assets:same-origin', badAssets.length === 0, [...new Set(badAssets)].join(' | '));
    if (pageErrors.length || consoleErrors.length) await capture(page, entry, profile, 'runtime-error');
  } catch (error) {
    const shot = await capture(page, entry, profile, 'uncaught');
    record(entry, profile, 'matrix:uncaught', false, JSON.stringify({ error: error?.stack || error, shot }));
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
  await Promise.all(Array.from({ length: Math.min(WORKERS, items.length) }, run));
}

if (!existsSync(DIST)) {
  console.error('dist/ missing; run npm run strangler:build:production-like first');
  process.exit(1);
}
const { server, base } = await serve();
let browser;
try {
  browser = ENGINE === 'webkit' ? await webkit.launch() : await chromium.launch({ args: ['--disable-dev-shm-usage'] });
  const cases = entries.flatMap((entry) => PROFILES.map((profile) => ({ entry, profile })));
  console.log(`Cross-browser matrix: ${ENGINE}; ${entries.length} routes × ${PROFILES.length} profiles = ${cases.length}; workers=${WORKERS}`);
  await pool(cases, ({ entry, profile }) => runCase(browser, base, entry, profile));
} finally {
  await browser?.close().catch(() => {});
  await new Promise((resolve) => server.close(resolve));
}

results.sort((a, b) => a.route.localeCompare(b.route, 'ru') || a.profile.localeCompare(b.profile) || a.contract.localeCompare(b.contract));
const failures = results.filter((item) => !item.ok);
const passed = results.length - failures.length;
const summary = {
  generatedAt: new Date().toISOString(), engine: ENGINE,
  registry: { total: registry.entries.length, publicTested: entries.length },
  profiles: PROFILES, contracts: results.length, passed, failed: failures.length, failures, results,
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
  ...(failures.length ? ['## Failures', '', ...failures.map((failure) =>
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
