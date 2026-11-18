#!/usr/bin/env node
/**
 * Read-only Journal visual/accessibility contract. No server, route or publication owner.
 * Start a production-like server separately; set JOURNAL_BASE_URL to its origin.
 * JOURNAL_HISTORY_PATH is opt-in and MUST refer to a disposable, noindex DEV adapter.
 * AXE_CORE_PATH may point to an isolated axe-core install; no dependency is vendored here.
 * Browser/axe unavailability is recorded as incomplete acceptance, never as a pass.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium, firefox, webkit } from 'playwright';

const require = createRequire(import.meta.url);
const base = process.env.JOURNAL_BASE_URL || 'http://127.0.0.1:4173';
const out = path.resolve(process.env.JOURNAL_REPORT_DIR || 'reports/g3-editorial/after');
const browserNames = (process.env.JOURNAL_BROWSERS || 'chromium,firefox,webkit').split(',');
const widths = [320, 360, 390, 430, 768, 1024, 1440, 1920];
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
  base, widths, themes: ['light', 'dark'],
  sourceHashes: {}, browsers: [], cases: [], interactions: [], failures: [], unavailable: [],
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
    schemaTypes: graph.map((node) => node['@type']),
    robots: [...document.querySelectorAll('meta[name="robots"]')].map((node) => node.content),
    historyLinks: [...document.querySelectorAll('a[href^="/journal/dossiers/g3/history/"]')].length,
    mobileChromeOwners: document.querySelectorAll('#mobileChromePage').length,
    scriptUrls: [...document.querySelectorAll('script[src]')].map((node) => node.src),
    finance: document.querySelector('#finance > .prose > p')?.textContent.replace(/\s+/g, ' ').trim(),
  };
}

async function keyboardNavigationAudit(page, selector) {
  const count = await page.locator(selector).count();
  if (!count) return [];
  await page.keyboard.press('Tab');
  await page.locator(selector).first().focus();
  const keys = [];
  for (let i = 0; i < count; i++) {
    if (i) await page.keyboard.press('Tab');
    await settle(page);
    keys.push(await page.evaluate(() => {
      const node = document.activeElement, rect = node.getBoundingClientRect(), style = getComputedStyle(node);
      const port = node.closest('[data-journal-scroll-nav]');
      const bounds = port?.scrollWidth > port?.clientWidth ? port.getBoundingClientRect() : { left: 0, right: innerWidth };
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

for (const browserName of browserNames) {
  let browser;
  try {
    const engine = { chromium, firefox, webkit }[browserName];
    if (!engine) throw new Error(`Unknown browser ${browserName}`);
    const options = { headless: true };
    if (browserName === 'chromium' && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) options.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    if (browserName === 'chromium' && process.env.PLAYWRIGHT_CHROMIUM_ARGS) options.args = JSON.parse(process.env.PLAYWRIGHT_CHROMIUM_ARGS);
    browser = await engine.launch(options);
    report.browsers.push({ name: browserName, version: await browser.version() });
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
        await page.screenshot({ path: path.join(out, `${key}.png`) });
        check(audit.h1Count === 1 && audit.mainCount === 1, `${key}: one H1 and main`);
        check(audit.documentOverflow <= 1 && audit.clipped.length === 0, `${key}: overflow / clipped text ${JSON.stringify(audit.clipped)}`);
        check(audit.duplicateIds.length === 0 && audit.brokenAnchors.length === 0, `${key}: duplicate IDs / dead anchors`);
        check(audit.images.every((image) => image.ok && image.declaredWidth && image.declaredHeight), `${key}: loaded dimensioned images`);
        check(audit.theme === theme, `${key}: preference theme not applied`);
        check(audit.historyLinks === 0 && audit.mobileChromeOwners === 1, `${key}: publication / chrome owner boundary`);
        check(new Set(audit.scriptUrls).size === audit.scriptUrls.length, `${key}: duplicate script URL`);
        if (route.canonical) {
          check(audit.canonical.length === 1 && audit.canonical[0] === route.canonical, `${key}: canonical`);
          check(audit.descriptions === 1 && audit.ogImages.length === 1, `${key}: single description and OG image`);
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
            await page.screenshot({ path: path.join(out, `${key}-finance.png`) });
          }
          if (route.name === 'history') {
            await page.locator('.je-article-toc a[href="#g3-speakers"]').click(); await settle(page);
            await page.screenshot({ path: path.join(out, `${key}-chronology.png`) });
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
        await page.screenshot({ path: path.join(out, `${browserName}-${route.name}-${width}-keyboard.png`) });
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
    const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await nojs.newPage();
    await page.goto(base + '/journal/dossiers/g3/');
    await page.locator('.je-article-toc a[href="#finance"]').click();
    const contentsHash = new URL(page.url()).hash;
    check(contentsHash === '#finance', `${browserName}: native no-JS contents`);
    await page.locator('a[href="#src-G3-S002"]').first().click();
    check(await page.locator('#src-G3-S002').isVisible(), `${browserName}: no-JS source visibility`);
    report.interactions.push({ browser: browserName, type: 'javascript-disabled', contents: contentsHash, sourceVisible: await page.locator('#src-G3-S002').isVisible() });
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
console.log(`Journal: ${report.cases.length} matrix cases, ${report.interactions.length} interaction cases, ${report.failures.length} failures, ${report.unavailable.length} unavailable tools.`);
for (const failure of report.failures) console.error(failure);
if (report.failures.length || report.unavailable.length) process.exitCode = 1;
