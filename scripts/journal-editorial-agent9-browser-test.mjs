#!/usr/bin/env node
/**
 * Agent 9 — read-only Journal visual/accessibility contract. No server, route or publication owner.
 * Start a production-like server separately; set JOURNAL_BASE_URL to its origin.
 * JOURNAL_HISTORY_PATH is opt-in and MUST refer to a disposable, noindex DEV adapter.
 * AXE_CORE_PATH and JOURNAL_PLAYWRIGHT_MODULE may point to separately installed tools.
 * Chromium defaults to minimal sandbox args, never the full Chromium.args bundle.
 * CDP safe-area cases are synthetic Chromium evidence, not physical-device/browser-zoom proof.
 * JOURNAL_SCREENSHOTS=representative|none reduces saved images, never widths or assertions.
 * Cold-load CLS is a local regression sample, not field Web Vitals or a network guarantee.
 * Browser/axe/protocol unavailability is recorded as incomplete acceptance, never as a pass.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const playwrightModule = process.env.JOURNAL_PLAYWRIGHT_MODULE || 'playwright';
const { chromium, firefox, webkit } = await import(playwrightModule);

const require = createRequire(import.meta.url);
const base = process.env.JOURNAL_BASE_URL || 'http://127.0.0.1:4173';
const out = path.resolve(process.env.JOURNAL_REPORT_DIR || 'reports/g3-editorial/agent-9/after');
const browserNames = (process.env.JOURNAL_BROWSERS || 'chromium,firefox,webkit').split(',');
const widths = [320, 360, 390, 430, 768, 1024, 1440, 1920];
const screenshotMode = process.env.JOURNAL_SCREENSHOTS || 'all';
if (!['all','representative','none'].includes(screenshotMode)) throw new Error('Unknown JOURNAL_SCREENSHOTS mode');
const screenshot = async (page, name, representative = false) => {
  if (screenshotMode === 'all' || (screenshotMode === 'representative' && representative)) await page.screenshot({ path: path.join(out, name) });
};
const criticalFonts = [
  '/fonts/SourceSans3/sourcesans3-cyrillic-600.woff2',
  '/fonts/PlayfairDisplay/playfairdisplay-cyrillic-600.woff2',
  '/fonts/Lora/lora-cyrillic-400.woff2',
];
const routes = [
  { name: 'journal', route: '/journal/', canonical: 'https://gospod-bog.ru/journal/', schemaType: 'CollectionPage' },
  { name: 'dossier', route: '/journal/dossiers/g3/', canonical: 'https://gospod-bog.ru/journal/dossiers/g3/', schemaType: 'Article' },
];
if (process.env.JOURNAL_HISTORY_PATH) {
  if (!process.env.JOURNAL_HISTORY_PATH.startsWith('/__local/')) throw new Error('History review requires an explicitly local DEV-only path');
  routes.push({ name: 'history', route: process.env.JOURNAL_HISTORY_PATH });
}
await fs.mkdir(out, { recursive: true });
const report = {
  createdAt: new Date().toISOString(),
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
  base, widths, themes: ['light', 'dark'], tooling: { playwrightModule }, screenshotMode,
  sourceHashes: {}, browsers: [], cases: [], interactions: [], safeAreas: [], safeAreaCapabilities: [], initialLoads: [], fontControls: [], failures: [], unavailable: [],
};
for (const dir of ['src/components/journal', 'src/data/journal']) {
  for (const name of (await fs.readdir(dir)).sort()) {
    const file = path.join(dir, name);
    if ((await fs.stat(file)).isFile()) report.sourceHashes[file] = crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
  }
}
const check = (condition, message) => { if (!condition) report.failures.push(message); };
const settle = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
let axePath = process.env.AXE_CORE_PATH;
if (!axePath) { try { axePath = require.resolve('axe-core/axe.min.js'); } catch {} }
if (!axePath) report.unavailable.push({ tool: 'axe-core', reason: 'Set AXE_CORE_PATH to an installed axe.min.js' });
const axe = async (page) => {
  if (!axePath) return { unavailable: true };
  if (!await page.evaluate(() => Boolean(window.axe))) await page.addScriptTag({ path: axePath });
  return page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
    return {
      version: result.testEngine.version,
      violations: result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })),
      incomplete: result.incomplete.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, any, all, none }) => ({ target, reasons: [...any, ...all, ...none].map(({ message, data }) => ({ message, data })) })) })),
      passes: result.passes.length,
    };
  });
};

async function open(context, route, theme) {
  const page = await context.newPage();
  const errors = { javascript: [], console: [], failedRequests: [], http: [] };
  page.on('pageerror', (error) => errors.javascript.push(error.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.console.push(msg.text()); });
  page.on('requestfailed', (request) => errors.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('response', (response) => { if (response.status() >= 400) errors.http.push({ url: response.url(), status: response.status() }); });
  await page.addInitScript((value) => localStorage.setItem('gb:reader-preferences:v1', JSON.stringify({ version: 1, theme: value })), theme);
  await page.addInitScript(() => {
    const supported = typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('layout-shift');
    window.__journalInitialLoad = { supported, cls: supported ? 0 : null, shifts: [] };
    if (supported) new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) {
        window.__journalInitialLoad.cls += entry.value;
        window.__journalInitialLoad.shifts.push({ time: entry.startTime, value: entry.value });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const response = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 60000 });
  check(response?.status() === 200, `${route}: HTTP ${response?.status()}`);
  await page.evaluate(() => document.fonts.ready);
  return { page, errors };
}

function documentAudit() {
  const clipped = [...document.querySelectorAll('main :is(h1,h2,h3,h4,p,img,dd,.bibliography-item)')].filter((node) => {
    if (node.closest('.je-article-toc, .je-masthead__nav')) return false;
    const box = node.getBoundingClientRect();
    return box.width && box.height && (box.left < -1 || box.right > innerWidth + 1 || node.scrollWidth > node.clientWidth + 2);
  }).map((node) => ({ tag: node.tagName, id: node.id, class: node.className, text: node.textContent.trim().slice(0, 90) }));
  const ids = [...document.querySelectorAll('[id]')].map((node) => node.id);
  const graph = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((node) => { const object = JSON.parse(node.textContent); return object['@graph'] || [object]; });
  return {
    title: document.querySelector('h1')?.textContent.trim(),
    h1Count: document.querySelectorAll('h1').length,
    mainCount: document.querySelectorAll('main').length,
    documentOverflow: document.documentElement.scrollWidth - innerWidth,
    clipped,
    duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
    brokenAnchors: [...document.querySelectorAll('a[href^="#"]')].filter((link) => link.hash && !document.getElementById(decodeURIComponent(link.hash.slice(1)))).map((link) => link.hash),
    images: [...document.querySelectorAll('main img')].map((image) => ({ src: image.currentSrc, ok: image.complete && image.naturalWidth > 0, width: image.width, naturalWidth: image.naturalWidth, declaredWidth: image.getAttribute('width'), declaredHeight: image.getAttribute('height'), priority: image.getAttribute('fetchpriority') })),
    tocCount: document.querySelectorAll('.je-article-toc a').length,
    sourceCount: document.querySelectorAll('.bibliography-item').length,
    readingWidth: document.querySelector('.journal-story-column')?.getBoundingClientRect().width,
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    canonical: [...document.querySelectorAll('link[rel="canonical"]')].map((node) => node.href),
    descriptions: document.querySelectorAll('meta[name="description"]').length,
    ogImages: [...document.querySelectorAll('meta[property="og:image"]')].map((node) => node.content),
    fontPreloads: [...document.querySelectorAll('link[rel="preload"][as="font"]')].map((node) => ({ path: new URL(node.href).pathname, type: node.type, crossOrigin: node.crossOrigin })),
    schemaTypes: graph.map((node) => node['@type']),
    robots: [...document.querySelectorAll('meta[name="robots"]')].map((node) => node.content),
    historyLinks: [...document.querySelectorAll('a[href^="/journal/dossiers/g3/history/"]')].length,
    mobileChromeOwners: document.querySelectorAll('#mobileChromePage').length,
    mastheadControls: [...document.querySelectorAll('.je-masthead button')].map((node) => {
      const rect = node.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return { id: node.id, name: node.getAttribute('aria-label'), pressed: node.getAttribute('aria-pressed'), width: rect.width, height: rect.height, visible: !node.hidden && rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && (hit === node || node.contains(hit)) };
    }),
    mastheadClipped: [...document.querySelectorAll('.je-masthead__name,.je-masthead__publication,.je-masthead__series')].filter((node) => node.scrollWidth > node.clientWidth + 1).map((node) => node.className),
    scriptUrls: [...document.querySelectorAll('script[src]')].map((node) => node.src),
    finance: document.querySelector('#finance > .prose > p')?.textContent.replace(/\s+/g, ' ').trim(),
  };
}

async function keyboardNavigationAudit(page, selector, reverse = false) {
  const count = await page.locator(selector).count();
  if (!count) return [];
  await page.keyboard.press('Tab');
  await (reverse ? page.locator(selector).last() : page.locator(selector).first()).focus();
  const keys = [];
  for (let i = 0; i < count; i++) {
    if (i) await page.keyboard.press(reverse ? 'Shift+Tab' : 'Tab');
    await settle(page);
    keys.push(await page.evaluate(() => {
      const node = document.activeElement, rect = node.getBoundingClientRect(), style = getComputedStyle(node);
      const port = node.closest('[data-journal-scroll-nav]');
      const bounds = { left: 0, right: innerWidth };
      if (port?.scrollWidth > port?.clientWidth) {
        const box = port.getBoundingClientRect(), padding = getComputedStyle(port);
        bounds.left = box.left + (Number.parseFloat(padding.scrollPaddingLeft) || 0);
        bounds.right = box.right - (Number.parseFloat(padding.scrollPaddingRight) || 0);
      }
      const hit = document.elementFromPoint(Math.max(1, Math.min(innerWidth - 1, rect.x + rect.width / 2)), Math.max(1, Math.min(innerHeight - 1, rect.y + rect.height / 2)));
      return { href: node.getAttribute('href'), left: rect.left, right: rect.right, portLeft: bounds.left, portRight: bounds.right, visible: rect.left >= bounds.left && rect.right <= bounds.right + 1 && rect.top >= 0 && rect.bottom <= innerHeight + 1 && (node === hit || node.contains(hit)), outline: style.outlineStyle };
    }));
  }
  return keys;
}

async function anchorAudit(page, selector) {
  const links = await page.locator(selector).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
  const observations = [];
  for (const href of [...new Set(links)]) {
    await page.locator(`${selector}[href="${href}"]`).first().click();
    await settle(page);
    observations.push(await page.evaluate((hash) => {
      const target = document.getElementById(hash.slice(1));
      const heading = target?.querySelector('h2,h3,h4') || target;
      const rect = heading.getBoundingClientRect();
      const blockers = [...document.querySelectorAll('.mcp-top,.je-editorial-rail')].filter((node) => {
        const style = getComputedStyle(node), box = node.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && ['sticky','fixed'].includes(style.position) && box.top >= -1 && box.top < innerHeight / 2 && box.left < rect.right && box.right > rect.left;
      }).map((node) => node.getBoundingClientRect().bottom);
      const obstruction = Math.max(0, ...blockers);
      return { href: hash, headingTop: rect.top, headingBottom: rect.bottom, obstruction, visible: rect.top >= obstruction - 1 && rect.bottom <= innerHeight + 1, active: document.activeElement.id };
    }, href));
  }
  return observations;
}

async function mastheadServiceAudit(browser, browserName, route, width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, locale: 'ru-RU', colorScheme: 'light', reducedMotion: 'reduce' });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const key = `${browserName}/${route.name}/${width}/masthead-services`;
  const observe = () => page.evaluate(() => {
    window.__journalThemeEvents = [];
    document.addEventListener('gb:reader-preferences-change', (event) => window.__journalThemeEvents.push(event.detail));
  });
  const state = () => page.evaluate(() => ({
    root: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    preference: window.GBReaderPreferences.get().theme,
    persisted: JSON.parse(localStorage.getItem('gb:reader-preferences:v1')).theme,
    legacy: localStorage.getItem('theme'),
    pressed: document.getElementById('themeToggle').getAttribute('aria-pressed'),
    events: window.__journalThemeEvents || [],
  }));
  const searchState = () => page.evaluate(() => ({
    dialogs: document.querySelectorAll('.cp-backdrop').length,
    runtimeScripts: [...document.scripts].filter((script) => script.src && new URL(script.src).pathname === '/js/search.js').length,
    focused: document.activeElement.id || document.activeElement.className,
    locked: document.documentElement.classList.contains('cp-scroll-lock'),
    scrollY,
  }));
  try {
    // Do not seed storage on every navigation: that would invalidate persistence tests.
    await page.goto(base + route.route, { waitUntil: 'networkidle' });
    await observe();
    const initial = await state();
    check(initial.root === 'light' && initial.pressed === 'false', `${key}: initial shared state`);
    await page.locator('#themeToggle').focus();
    await page.keyboard.press('Space');
    const space = await state();
    check(space.root === 'dark' && space.preference === 'dark' && space.persisted === 'dark' && space.legacy === 'dark' && space.pressed === 'true', `${key}: Space updates canonical state/persistence ${JSON.stringify(space)}`);
    check(space.events.length === 1 && space.events[0].source === 'journal-masthead', `${key}: exactly one theme mutation per activation ${JSON.stringify(space.events)}`);
    await page.reload({ waitUntil: 'networkidle' });
    const reloaded = await state();
    check(reloaded.root === 'dark' && reloaded.preference === 'dark' && reloaded.pressed === 'true', `${key}: reload persistence`);
    await observe();
    await page.locator('#themeToggle').focus();
    await page.keyboard.press('Enter');
    const enter = await state();
    check(enter.root === 'light' && enter.persisted === 'light' && enter.pressed === 'false' && enter.events.length === 1, `${key}: Enter activates once ${JSON.stringify(enter)}`);
    await page.evaluate(() => window.GBReaderPreferences.setTheme('dark', { source: 'qa-external-owner' }));
    const external = await state();
    check(external.root === 'dark' && external.pressed === 'true' && external.events.length === 2, `${key}: subscribe reflects external canonical owner`);
    const other = await context.newPage();
    await other.goto(base + (route.name === 'journal' ? '/journal/dossiers/g3/' : '/journal/'), { waitUntil: 'networkidle' });
    check(await other.locator('#themeToggle').getAttribute('aria-pressed') === 'true', `${key}: persisted across Journal routes`);
    await other.locator('#themeToggle').click();
    await page.waitForFunction(() => !document.documentElement.classList.contains('dark') && document.getElementById('themeToggle').getAttribute('aria-pressed') === 'false');
    const crossTab = await state();
    check(crossTab.preference === 'light' && crossTab.persisted === 'light' && crossTab.events.filter((event) => event.source === 'journal-masthead').length === 1, `${key}: cross-tab sync without a competing theme owner`);
    await other.close();

    const cold = await searchState();
    check(cold.runtimeScripts === 0 && cold.dialogs === 0, `${key}: search remains lazy before use`);
    const searches = [];
    for (let cycle = 0; cycle < 2; cycle++) {
      await page.locator('#gbSearchBtn').focus();
      await page.keyboard.press(cycle ? 'Space' : 'Enter');
      await page.locator('.cp-backdrop.is-open .cp-input').waitFor({ state: 'visible' });
      await page.locator('.cp-input').fill('G3');
      await page.waitForFunction(() => document.querySelector('.cp-list')?.textContent.includes('G3'));
      const opened = await searchState();
      check(opened.dialogs === 1 && opened.runtimeScripts === 1 && opened.focused === 'cp-input', `${key}: cold/warm single search runtime ${JSON.stringify(opened)}`);
      if (!cycle) await screenshot(page, `${browserName}-${route.name}-${width}-search.png`, route.name === 'dossier' && width === 390);
      await page.keyboard.press('Escape');
      await page.locator('.cp-backdrop.is-open').waitFor({ state: 'hidden' });
      await settle(page);
      const closed = await searchState();
      check(closed.focused === 'gbSearchBtn' && !closed.locked && closed.scrollY === 0, `${key}: visible masthead opener focus/scroll restored ${JSON.stringify(closed)}`);
      searches.push({ cycle, opened, closed });
    }
    check(errors.length === 0, `${key}: JavaScript errors ${JSON.stringify(errors)}`);
    report.interactions.push({ browser: browserName, route: route.name, width, type: 'masthead-services', initial, space, reloaded, enter, external, crossTab, cold, searches, errors });
  } catch (error) { report.failures.push(`${key}: ${error.stack || error}`); }
  finally { await context.close(); }
}

async function criticalFontAudits(browser, browserName) {
  const measure = async (page) => {
    await settle(page);
    return page.evaluate(() => ({
      ...window.__journalInitialLoad,
      devServer: Boolean(document.querySelector('script[src*="/@vite/client"]')),
      preloads: [...document.querySelectorAll('link[rel="preload"][as="font"]')].map((node) => ({ path: new URL(node.href).pathname, type: node.type, crossOrigin: node.crossOrigin })),
      fonts: performance.getEntriesByType('resource').filter((entry) => new URL(entry.name).pathname.endsWith('.woff2')).map((entry) => ({ path: new URL(entry.name).pathname, initiator: entry.initiatorType, start: entry.startTime, end: entry.responseEnd })),
    }));
  };
  let devServer = false;
  for (const route of routes.filter((route) => route.canonical)) for (const width of [390,1440]) for (let sample = 0; sample < 3; sample++) {
    const key = `${browserName}/${route.name}/${width}/${sample}/cold-fonts`;
    const context = await browser.newContext({ viewport: { width, height: 1000 }, locale: 'ru-RU', colorScheme: 'light', reducedMotion: 'reduce' });
    try {
      const { page, errors } = await open(context, route.route, 'light');
      const metrics = await measure(page);
      devServer ||= metrics.devServer;
      check(metrics.preloads.length === criticalFonts.length && criticalFonts.every((font) => metrics.preloads.filter((hint) => hint.path === font && hint.type === 'font/woff2' && hint.crossOrigin === 'anonymous').length === 1), `${key}: three matching anonymous critical-font hints`);
      check(criticalFonts.every((font) => metrics.fonts.filter((request) => request.path === font).length === 1 && metrics.fonts.find((request) => request.path === font)?.initiator === 'link'), `${key}: early, deduplicated font requests ${JSON.stringify(metrics.fonts)}`);
      if (metrics.supported) check(metrics.cls <= 0.1, `${key}: local cold-load CLS ${metrics.cls}`);
      else report.unavailable.push({ tool: `${browserName} cold-load CLS`, reason: 'Layout Instability API unavailable; font hint assertions still executed.' });
      check(Object.values(errors).flat().length === 0, `${key}: browser errors ${JSON.stringify(errors)}`);
      report.initialLoads.push({ key, metrics, errors });
    } catch (error) { report.failures.push(`${key}: ${error.stack || error}`); }
    finally { await context.close(); }
  }
  if (devServer) {
    report.fontControls.push({ browser: browserName, state: 'not-run', reason: 'Document-response negative control targets the static server: fulfilling a Vite document confounds its HMR WebSocket with sandbox local-network/CSP checks. No security/HMR settings or error assertions are disabled.' });
    return;
  }
  // Remove only the three local document hints. Font/CSS bytes remain unchanged.
  // Structural detection is deterministic; observed CLS is retained, not forced by delays.
  const context = await browser.newContext({ viewport: { width: 390, height: 1000 }, locale: 'ru-RU', reducedMotion: 'reduce' });
  let removed = 0;
  try {
    await context.route(base + '/journal/dossiers/g3/', async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(/<link\b(?=[^>]*\brel="preload")(?=[^>]*\bas="font")[^>]*>/g, (tag) => {
        if (!criticalFonts.some((font) => tag.includes(`href="${font}"`))) return tag;
        removed++; return '';
      });
      await route.fulfill({ response, body });
    });
    const { page, errors } = await open(context, '/journal/dossiers/g3/', 'light');
    const metrics = await measure(page), missingHintsDetected = criticalFonts.every((font) => !metrics.preloads.some((hint) => hint.path === font));
    check(removed === criticalFonts.length && missingHintsDetected, `${browserName}: critical-font negative control did not detect missing hints`);
    check(Object.values(errors).flat().length === 0, `${browserName}: critical-font negative control browser errors ${JSON.stringify(errors)}`);
    report.fontControls.push({ browser: browserName, state: 'executed', method: 'Only local dossier HTML response: remove the three critical hints, no font-byte/global CSS/resource substitution and no artificial delay.', removed, missingHintsDetected, observedThresholdFailure: metrics.supported ? metrics.cls > 0.1 : null, metrics, errors });
  } catch (error) { report.failures.push(`${browserName}: critical-font negative control ${error.stack || error}`); }
  finally { await context.close(); }
}

async function safeAreaAudits(browser, browserName) {
  if (browserName !== 'chromium') {
    report.safeAreaCapabilities.push({ browser: browserName, state: 'not-run', reason: 'This supplementary adapter uses Chromium CDP, not a cross-engine safe-area simulation.' });
    return;
  }
  const profiles = [
    { name: 'portrait-320', width: 320, height: 844, insets: { top: 24, left: 44, right: 44, bottom: 34 } },
    { name: 'portrait-360', width: 360, height: 844, insets: { top: 24, left: 44, right: 44, bottom: 34 } },
    { name: 'portrait-390', width: 390, height: 844, insets: { top: 24, left: 44, right: 44, bottom: 34 } },
    { name: 'portrait-430', width: 430, height: 844, insets: { top: 24, left: 44, right: 44, bottom: 34 } },
    { name: 'asymmetric-right-430', width: 430, height: 844, insets: { top: 59, left: 0, right: 44, bottom: 34 } },
    { name: 'asymmetric-left-430', width: 430, height: 844, insets: { top: 59, left: 44, right: 0, bottom: 34 } },
    { name: 'landscape-740', width: 740, height: 390, insets: { top: 0, left: 44, right: 44, bottom: 21 } },
    { name: 'landscape-844', width: 844, height: 390, insets: { top: 0, left: 44, right: 44, bottom: 21 } },
  ];
  for (const route of routes) for (const profile of profiles) for (const theme of ['light','dark']) {
    const key = `${browserName}/${route.name}/${profile.name}/${theme}/safe-area`;
    const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, locale: 'ru-RU', colorScheme: theme, reducedMotion: 'reduce' });
    try {
      const { page, errors } = await open(context, route.route, theme);
      const cdp = await context.newCDPSession(page);
      try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: profile.insets }); }
      catch (error) { report.unavailable.push({ tool: 'Chromium CDP safe-area', reason: error.message }); return; }
      await settle(page);
      const geometry = await page.evaluate(() => {
        // Read actual env() values; do not substitute a custom CSS gutter variable.
        const probe = document.createElement('div');
        probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
        document.documentElement.append(probe);
        const ps = getComputedStyle(probe);
        const env = { top: parseFloat(ps.paddingTop), right: parseFloat(ps.paddingRight), bottom: parseFloat(ps.paddingBottom), left: parseFloat(ps.paddingLeft) };
        probe.remove();
        const contentEdges = (selector) => {
          const node = document.querySelector(selector), rect = node.getBoundingClientRect(), style = getComputedStyle(node);
          return { left: rect.left + parseFloat(style.paddingLeft), right: rect.right - parseFloat(style.paddingRight) };
        };
        return { env, main: contentEdges('main'), footer: contentEdges('.journal-footer,.dossier-footer'), overflow: document.documentElement.scrollWidth - innerWidth, controls: [...document.querySelectorAll('.je-masthead button')].map((node) => { const r = node.getBoundingClientRect(); return { id: node.id, left: r.left, right: r.right, width: r.width, height: r.height }; }) };
      });
      check(Object.entries(profile.insets).every(([edge, value]) => geometry.env[edge] === value), `${key}: CDP insets did not reach CSS env ${JSON.stringify(geometry.env)}`);
      check(geometry.overflow <= 1 && geometry.main.left >= profile.insets.left && geometry.main.right <= profile.width - profile.insets.right + 1, `${key}: safe main gutters ${JSON.stringify(geometry)}`);
      check(Math.abs(geometry.main.left - geometry.footer.left) <= 1 && Math.abs(geometry.main.right - geometry.footer.right) <= 1, `${key}: footer/content alignment`);
      check(geometry.controls.length === 2 && geometry.controls.every((control) => control.left >= profile.insets.left && control.right <= profile.width - profile.insets.right + 1 && control.width >= 44 && control.height >= 44), `${key}: safe 44px controls`);
      const forward = await keyboardNavigationAudit(page, '.je-masthead__nav a');
      const reverse = await keyboardNavigationAudit(page, '.je-masthead__nav a', true);
      const isSafe = (item) => item.visible && item.outline !== 'none' && item.left >= profile.insets.left && item.right <= profile.width - profile.insets.right + 1;
      check(forward.length === 4 && reverse.length === 4 && [...forward,...reverse].every(isSafe), `${key}: safe masthead forward/reverse focus ${JSON.stringify({ forward, reverse })}`);
      let negativeControl;
      if (route.name === 'dossier' && profile.name === 'portrait-390' && theme === 'light') {
        // Reintroduce the old computed scroll-padding without changing source.
        await page.locator('.je-masthead__nav').evaluate((node) => { node.style.scrollPaddingInline = '0px'; node.scrollLeft = 0; });
        const keys = await keyboardNavigationAudit(page, '.je-masthead__nav a');
        negativeControl = { temporaryStyle: 'scroll-padding-inline: 0px', keys, unsafeFocusDetected: keys.some((item) => !isSafe(item)) };
        check(negativeControl.unsafeFocusDetected, `${key}: negative control did not detect the pre-fix defect`);
        await page.locator('.je-masthead__nav').evaluate((node) => { node.style.removeProperty('scroll-padding-inline'); node.scrollLeft = 0; });
      }
      if (profile.name === 'portrait-390' || profile.name === 'landscape-844') {
        await page.locator('.je-masthead__nav').evaluate((node) => { node.scrollLeft = 0; });
        await page.locator('.je-masthead__nav a').first().focus();
        await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await settle(page);
        await screenshot(page, `${browserName}-${route.name}-${profile.name}-${theme}-safe-focus.png`, route.name === 'dossier' && profile.name === 'portrait-390');
      }
      const tocKeys = await keyboardNavigationAudit(page, '.je-article-toc a');
      check(tocKeys.every(isSafe), `${key}: safe TOC focus ${JSON.stringify(tocKeys.filter((item) => !isSafe(item)))}`);
      const anchors = await anchorAudit(page, '.je-article-toc a');
      check(anchors.every((item) => item.visible), `${key}: safe-area anchor obstruction ${JSON.stringify(anchors.filter((item) => !item.visible))}`);
      check(Object.values(errors).flat().length === 0, `${key}: browser errors ${JSON.stringify(errors)}`);
      report.safeAreas.push({ key, profile, geometry, forward, reverse, tocKeys, anchors, negativeControl, errors });
    } catch (error) { report.failures.push(`${key}: ${error.stack || error}`); }
    finally { await context.close(); }
  }
  report.safeAreaCapabilities.push({ browser: browserName, state: 'executed', method: 'Emulation.setSafeAreaInsetsOverride + computed CSS env; no physical-device claim' });
}

for (const browserName of browserNames) {
  let browser;
  try {
    const engine = { chromium, firefox, webkit }[browserName];
    if (!engine) throw new Error(`Unknown browser ${browserName}`);
    const options = { headless: true };
    if (browserName === 'chromium') {
      if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) options.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
      options.args = process.env.PLAYWRIGHT_CHROMIUM_ARGS ? JSON.parse(process.env.PLAYWRIGHT_CHROMIUM_ARGS) : ['--no-sandbox', '--disable-dev-shm-usage'];
      if (!Array.isArray(options.args) || options.args.some((arg) => typeof arg !== 'string' || /^--(?:disable-web-security|allow-running-insecure-content)(?:=|$)/.test(arg))) throw new Error('Unsafe or invalid Chromium args; web security must remain enabled');
    }
    browser = await engine.launch(options);
    report.browsers.push({ name: browserName, version: await browser.version(), launchOptions: options });
  } catch (error) {
    report.unavailable.push({ tool: browserName, reason: error.message });
    continue;
  }
  try {
    for (const route of routes) for (const width of widths) for (const theme of ['light','dark']) {
      const key = `${browserName}-${route.name}-${width}-${theme}`;
      const context = await browser.newContext({ viewport: { width, height: width >= 1024 ? 1000 : 844 }, locale: 'ru-RU', colorScheme: theme, reducedMotion: 'reduce' });
      try {
        const { page, errors } = await open(context, route.route, theme);
        const audit = await page.evaluate(documentAudit);
        await screenshot(page, `${key}.png`, width === 390 || width === 1440);
        check(audit.h1Count === 1 && audit.mainCount === 1, `${key}: one H1 and main`);
        check(audit.documentOverflow <= 1 && audit.clipped.length === 0, `${key}: overflow / clipped text ${JSON.stringify(audit.clipped)}`);
        check(audit.duplicateIds.length === 0 && audit.brokenAnchors.length === 0, `${key}: duplicate IDs / dead anchors`);
        check(audit.images.every((image) => image.ok && image.declaredWidth && image.declaredHeight), `${key}: loaded dimensioned images`);
        check(audit.theme === theme, `${key}: preference theme not applied`);
        check(audit.historyLinks === 0 && audit.mobileChromeOwners === 1, `${key}: publication / chrome owner boundary`);
        check(new Set(audit.scriptUrls).size === audit.scriptUrls.length, `${key}: duplicate script URL`);
        check(audit.mastheadControls.length === 2 && audit.mastheadControls.every((control) => control.visible && control.name && control.width >= 44 && control.height >= 44), `${key}: visible, named 44px masthead controls ${JSON.stringify(audit.mastheadControls)}`);
        check(audit.mastheadControls.find((control) => control.id === 'themeToggle')?.pressed === String(theme === 'dark'), `${key}: shared theme state reflected in control`);
        check(audit.mastheadClipped.length === 0, `${key}: masthead text clipping ${audit.mastheadClipped}`);
        if (route.canonical) {
          check(audit.canonical.length === 1 && audit.canonical[0] === route.canonical, `${key}: canonical`);
          check(audit.descriptions === 1 && audit.ogImages.length === 1, `${key}: single description and OG image`);
          check(audit.fontPreloads.length === criticalFonts.length && criticalFonts.every((font) => audit.fontPreloads.filter((hint) => hint.path === font && hint.type === 'font/woff2' && hint.crossOrigin === 'anonymous').length === 1), `${key}: three matching critical-font preloads`);
          check(audit.schemaTypes.filter((type) => type === route.schemaType).length === 1, `${key}: one schema content owner`);
        } else check(audit.robots.some((value) => value.includes('noindex')), `${key}: draft must be noindex`);
        if (route.name !== 'journal') {
          check(audit.readingWidth <= 741, `${key}: reading measure >740px`);
          check(audit.tocCount === (route.name === 'history' ? 6 : 11), `${key}: incomplete contents`);
          check(audit.sourceCount === (route.name === 'history' ? 20 : 21), `${key}: bibliography count`);
        }
        if (route.name === 'dossier') check(audit.finance.includes('долларов выше'), `${key}: Astro financial whitespace regression`);
        const mastheadKeyboard = await keyboardNavigationAudit(page, '.je-masthead__nav a');
        check(mastheadKeyboard.length === 4 && mastheadKeyboard.every((item) => item.visible && item.outline !== 'none'), `${key}: masthead keyboard clipping ${JSON.stringify(mastheadKeyboard)}`);
        await page.locator('.je-masthead__nav').evaluate((node) => { node.scrollLeft = 0; });
        const accessibility = await axe(page);
        check(!accessibility.violations?.length, `${key}: axe violations ${JSON.stringify(accessibility.violations)}`);
        const anchors = await anchorAudit(page, '.je-article-toc a');
        check(anchors.every((item) => item.visible), `${key}: covered anchor ${JSON.stringify(anchors.filter((item) => !item.visible))}`);
        const citations = await anchorAudit(page, route.name === 'history' ? '.je-history-footnote a' : '.source-note-paragraph a[href^="#"]');
        check(citations.every((item) => item.visible && item.active === item.href.slice(1)), `${key}: source anchor/focus ${JSON.stringify(citations.filter((item) => !item.visible || item.active !== item.href.slice(1)))}`);
        if (width === 390 || width === 1440) {
          if (route.name === 'dossier') {
            await page.locator('.je-article-toc a[href="#finance"]').click(); await settle(page);
            await screenshot(page, `${key}-finance.png`, true);
          }
          if (route.name === 'history') {
            await page.locator('.je-article-toc a[href="#g3-speakers"]').click(); await settle(page);
            await screenshot(page, `${key}-chronology.png`, true);
          }
        }
        const allErrors = Object.values(errors).flat();
        check(allErrors.length === 0, `${key}: browser errors ${JSON.stringify(errors)}`);
        report.cases.push({ key, ...audit, accessibility, mastheadKeyboard, anchors, citations, errors });
        console.log(`${key}: overflow ${audit.documentOverflow}, axe ${accessibility.violations?.length ?? 'unavailable'}, anchors ${anchors.length}, citations ${citations.length}`);
      } catch (error) { report.failures.push(`${key}: ${error.stack || error}`); }
      finally { await context.close(); }
    }

    // Keyboard and magnified/landscape reflow are additional cases, not screenshot-matrix claims.
    for (const route of routes) for (const width of [390,1440]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      const { page } = await open(context, route.route, 'light');
      await page.keyboard.press('Tab');
      const skip = await page.evaluate(() => ({ href: document.activeElement.getAttribute('href'), outline: getComputedStyle(document.activeElement).outlineStyle }));
      check(skip.href === '#main-content' && skip.outline !== 'none', `${browserName}/${route.name}/${width}: visible first skip link`);
      await page.keyboard.press('Enter');
      check(await page.evaluate(() => document.activeElement.id) === 'main-content', `${browserName}/${route.name}/${width}: skip target focus`);
      const keys = route.name === 'journal' ? [] : await keyboardNavigationAudit(page, '.je-article-toc a');
      if (route.name !== 'journal') {
        check(keys.every((item) => item.visible && item.outline !== 'none'), `${browserName}/${route.name}/${width}: keyboard TOC clipping ${JSON.stringify(keys)}`);
        await screenshot(page, `${browserName}-${route.name}-${width}-keyboard.png`, true);
      }
      await page.setViewportSize({ width: 844, height: 390 });
      await page.evaluate(() => window.scrollTo(0, 0)); await settle(page);
      const landscape = await page.evaluate(documentAudit);
      check(landscape.documentOverflow <= 1 && !landscape.clipped.length, `${browserName}/${route.name}: landscape reflow`);
      await page.setViewportSize({ width: 320, height: 844 });
      await page.evaluate(() => { window.scrollTo(0, 0); document.documentElement.style.fontSize = '200%'; }); await settle(page);
      const enlarged = await page.evaluate(documentAudit);
      check(enlarged.documentOverflow <= 1 && !enlarged.clipped.length, `${browserName}/${route.name}: 200% root text reflow ${JSON.stringify(enlarged.clipped)}`);
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(() => { document.documentElement.style.removeProperty('font-size'); window.scrollTo(0, document.body.scrollHeight); });
      await settle(page);
      await page.emulateMedia({ media: 'print' });
      const print = await page.evaluate(() => ({
        chromeHidden: [...document.querySelectorAll('.je-masthead,.je-editorial-rail,.mcp-top')].every((node) => node.getClientRects().length === 0),
        sourcesVisible: !document.querySelector('.bibliography-item') || document.querySelector('.bibliography-item').getBoundingClientRect().height > 0,
        ink: getComputedStyle(document.querySelector('main')).color,
        methodInk: document.querySelector('.journal-method p') ? getComputedStyle(document.querySelector('.journal-method p')).color : null,
      }));
      check(print.chromeHidden && print.sourcesVisible && print.ink === 'rgb(0, 0, 0)' && (!print.methodInk || print.methodInk === 'rgb(0, 0, 0)'), `${browserName}/${route.name}/${width}: print boundary ${JSON.stringify(print)}`);
      report.interactions.push({ browser: browserName, route: route.name, width, skip, keys, landscape: { overflow: landscape.documentOverflow, clipped: landscape.clipped }, enlarged: { overflow: enlarged.documentOverflow, clipped: enlarged.clipped }, print });
      await context.close();
    }
    for (const route of routes) for (const width of [390,1440]) await mastheadServiceAudit(browser, browserName, route, width);
    await safeAreaAudits(browser, browserName);
    await criticalFontAudits(browser, browserName);

    const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await nojs.newPage();
    await page.goto(base + '/journal/dossiers/g3/');
    const nojsControlsHidden = await page.locator('.je-masthead button').evaluateAll((nodes) => nodes.length === 2 && nodes.every((node) => node.hidden && !node.getClientRects().length));
    check(nojsControlsHidden, `${browserName}: no nonfunctional masthead controls without JavaScript`);
    await page.locator('.je-article-toc a[href="#finance"]').click();
    const contentsHash = new URL(page.url()).hash;
    check(contentsHash === '#finance', `${browserName}: native no-JS contents`);
    await page.locator('a[href="#src-G3-S002"]').first().click();
    check(await page.locator('#src-G3-S002').isVisible(), `${browserName}: no-JS source visibility`);
    report.interactions.push({ browser: browserName, type: 'javascript-disabled', contents: contentsHash, sourceVisible: await page.locator('#src-G3-S002').isVisible(), nojsControlsHidden });
    const withheldPaths = ['/journal/dossiers/g3/history/'];
    if (!process.env.JOURNAL_HISTORY_PATH) withheldPaths.push('/__local/g3-history/');
    for (const withheld of withheldPaths) {
      const response = await page.request.get(base + withheld);
      check(response.status() === 404, `${browserName}: withheld history route ${withheld} returned ${response.status()}`);
      report.interactions.push({ browser: browserName, type: 'publication-hold', route: withheld, status: response.status() });
    }
    await nojs.close();
  } finally { await browser.close(); }
}
await fs.writeFile(path.join(out, 'acceptance.json'), JSON.stringify(report, null, 2));
console.log(`Journal: ${report.cases.length} matrix cases, ${report.interactions.length} interaction cases, ${report.safeAreas.length} synthetic safe-area cases, ${report.initialLoads.length} cold-font cases, ${report.fontControls.length} font negative controls, ${report.failures.length} failures, ${report.unavailable.length} unavailable tools.`);
for (const failure of report.failures) console.error(failure);
if (report.failures.length || report.unavailable.length) process.exitCode = 1;
