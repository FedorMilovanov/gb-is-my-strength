#!/usr/bin/env node
/**
 * Route-local editorial acceptance. No route, fixture, server or dependency writer.
 * Requires production-like HTTP output. The optional history URL MUST be a
 * dev-only/noindex fixture; the public route remains absent.
 *
 * JOURNAL_BASE_URL=http://localhost:4321 JOURNAL_HISTORY_URL=http://localhost:4322/
 * JOURNAL_BROWSER=chromium|firefox|webkit JOURNAL_AXE_PATH=/path/to/axe.min.js
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium (optional sandbox fallback)
 * JOURNAL_REPORT_DIR=reports/g3-editorial-wave/acceptance
 * node scripts/journal-editorial-browser-test.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, firefox, webkit } from 'playwright';

const base = process.env.JOURNAL_BASE_URL;
if (!base) throw new Error('Set JOURNAL_BASE_URL to the production-like HTTP server');
const engine = process.env.JOURNAL_BROWSER || 'chromium';
const browserType = { chromium, firefox, webkit }[engine];
if (!browserType) throw new Error(`Unsupported engine: ${engine}`);
const out = process.env.JOURNAL_REPORT_DIR || 'reports/g3-editorial-wave/acceptance';
const axePath = process.env.JOURNAL_AXE_PATH;
const targets = [
  { id: 'dossier', url: new URL('/journal/dossiers/g3/', base).href, source: 'src-G3-S001' },
  { id: 'journal', url: new URL('/journal/', base).href },
  ...(process.env.JOURNAL_HISTORY_URL ? [{ id: 'history', url: process.env.JOURNAL_HISTORY_URL, source: 'hist-src-challies', held: true }] : []),
];
const widths = [320, 360, 390, 430, 768, 1024, 1440, 1920];
const themes = ['light', 'dark'];
const report = {
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirtyAtStart: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
  engine, browserVersion: null, axeVersion: null,
  history: process.env.JOURNAL_HISTORY_URL ? 'source-only noindex development fixture, not a public route' : 'NOT RUN: no dev-only history URL supplied',
  cases: [], extras: [], unavailable: [],
};
await fs.mkdir(out, { recursive: true });
let browser;
function check(entry, name, ok, detail) {
  entry.checks.push({ name, ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) });
}
async function inspect(page) {
  return page.evaluate(() => {
    const shown = (element) => {
      const box = element.getBoundingClientRect(), style = getComputedStyle(element);
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const edition = document.querySelector('.journal-edition');
    const readableText = (node) => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent;
      if (node.nodeType !== Node.ELEMENT_NODE || node.getAttribute('aria-hidden') === 'true') return '';
      return [...node.childNodes].map(readableText).join('');
    };
    const brand = document.querySelector('.je-masthead__identity');
    const brandVisibleText = readableText(brand).replace(/\s+/g, ' ').trim();
    const landingLead = document.querySelector('.journal-hero');
    const landingFooter = document.querySelector('.journal-footer > a');
    const landingAlignment = landingLead && landingFooter ? {
      contentLeft: landingLead.getBoundingClientRect().left,
      footerLeft: landingFooter.getBoundingClientRect().left,
    } : null;
    const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
    const missingAnchors = [...document.querySelectorAll('.journal-edition a[href^="#"], .skip-link')]
      .filter((element) => !document.getElementById(decodeURIComponent(element.hash.slice(1)))).map((element) => element.hash);
    const nav = [...document.querySelectorAll('.je-masthead__nav a')].map((element) => {
      const box = element.getBoundingClientRect();
      return { text: element.textContent.trim(), left: box.left, right: box.right, height: box.height, clipped: element.scrollWidth > element.clientWidth + 1 };
    });
    const cover = document.querySelector('.journal-feature-media img, .lead-context img');
    const growthEyebrow = document.querySelector('.je-history-growth-eyebrow');
    const growthText = document.querySelector('.je-history-growth-grid > div > p');
    const growthTypography = growthEyebrow && growthText ? {
      captionSize: parseFloat(getComputedStyle(growthEyebrow).fontSize),
      captionFamily: getComputedStyle(growthEyebrow).fontFamily,
      narrativeSize: parseFloat(getComputedStyle(growthText).fontSize),
      narrativeFamily: getComputedStyle(growthText).fontFamily,
    } : null;
    return {
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
      overflowingElements: [...(edition?.querySelectorAll('*') || [])].filter(shown).filter((element) => {
        const box = element.getBoundingClientRect(); return box.right > innerWidth + 1 || box.left < -1;
      }).slice(0, 8).map((element) => `${element.tagName}.${element.className}`),
      duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
      h1: [...document.querySelectorAll('h1')].filter(shown).length,
      main: document.querySelectorAll('main#main-content').length,
      missingAnchors, nav, growthTypography, brandVisibleText, landingAlignment,
      dark: document.documentElement.classList.contains('dark'),
      background: getComputedStyle(edition).backgroundColor,
      seriesBorder: getComputedStyle(document.querySelector('.je-series')).borderTopStyle,
      cover: cover ? { currentSrc: cover.currentSrc, complete: cover.complete && cover.naturalWidth > 0, width: cover.clientWidth, naturalWidth: cover.naturalWidth, sizes: cover.sizes } : null,
      bibliography: document.querySelectorAll('.bibliography-item').length,
      railHidden: ![...document.querySelectorAll('.je-editorial-rail')].some(shown),
      css: [...document.querySelectorAll('link[rel="stylesheet"]')].map((node) => node.href),
      scripts: [...document.querySelectorAll('script[src]')].map((node) => node.src),
    };
  });
}
async function keyboard(page, entry) {
  await page.keyboard.press('Tab');
  check(entry, 'keyboard:skip-first', await page.locator('.skip-link').evaluate((node) => document.activeElement === node));
  await page.keyboard.press('Enter');
  check(entry, 'keyboard:skip-target', await page.locator('#main-content').evaluate((node) => document.activeElement === node));
  const summary = page.locator('.je-contents > summary');
  if (await summary.count()) {
    await summary.focus();
    await summary.press('Enter');
    check(entry, 'keyboard:contents-close', await summary.evaluate((node) => !node.parentElement.open));
    await summary.press('Space');
    check(entry, 'keyboard:contents-open', await summary.evaluate((node) => node.parentElement.open));
    check(entry, 'keyboard:focus-indicator', await summary.evaluate((node) => getComputedStyle(node).outlineStyle !== 'none'));
  }
}
async function sourceNavigation(page, target, entry) {
  if (!target.source) return;
  const source = page.locator(`#${target.source}`);
  await source.evaluate((node) => { node.closest('details').open = false; });
  await page.locator(`a[href="#${target.source}"]`).first().click();
  // Fragment reveal and any native scrolling settle after the click task.
  await page.waitForFunction((id) => {
    const top = document.getElementById(id)?.getBoundingClientRect().top;
    return top >= -1 && top < innerHeight - 40;
  }, target.source, { timeout: 5000 });
  const facts = await source.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const bar = document.querySelector('.mcp-bar');
    return { hash: location.hash, open: node.closest('details').open, top: box.top, height: box.height, viewport: innerHeight, barBottom: bar?.getBoundingClientRect().bottom || 0 };
  });
  check(entry, 'anchors:closed-source-opens-natively', facts.open && facts.hash === `#${target.source}`, facts);
  check(entry, 'anchors:source-in-view', facts.top >= -1 && facts.top < facts.viewport - 40, facts);
  const back = source.locator('.biblio-return');
  const href = await back.getAttribute('href');
  await back.click();
  check(entry, 'anchors:return-to-section', await page.evaluate((hash) => location.hash === hash, href));
}
async function syntheticSafeAreas(page, context, target, entry) {
  if (engine !== 'chromium') {
    entry.safeAreas = 'NOT RUN: synthetic CDP insets are Chromium-only, not a physical-device witness';
    return;
  }
  const client = await context.newCDPSession(page);
  const inspectInsets = () => page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)';
    document.body.append(probe);
    const left = parseFloat(getComputedStyle(probe).paddingLeft);
    const right = parseFloat(getComputedStyle(probe).paddingRight);
    probe.remove();
    const frames = [...document.querySelectorAll('main#main-content, .je-masthead__top, .je-masthead__nav, .journal-footer')].map((node) => {
      const box = node.getBoundingClientRect(), css = getComputedStyle(node);
      return { owner: node.className, contentLeft: box.left + parseFloat(css.paddingLeft), contentRight: box.right - parseFloat(css.paddingRight) };
    });
    return { width: innerWidth, left, right, frames, overflow: document.documentElement.scrollWidth - innerWidth };
  });
  const clear = (facts) => facts.left === 44 && facts.right === 44 && facts.frames.length >= 3 && facts.overflow <= 1 && facts.frames.every((frame) => frame.contentLeft >= facts.left - 1 && frame.contentRight <= facts.width - facts.right + 1);
  try {
    await client.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 44, right: 44, bottom: 21 } });
    const landscape = await inspectInsets();
    check(entry, 'safe-area:844px-landscape-clears-44px-insets', clear(landscape), landscape);
    await page.screenshot({ path: path.join(out, `${target.id}-safe-area-844.png`) });
    await page.setViewportSize({ width: 390, height: 844 });
    const portrait = await inspectInsets();
    check(entry, 'safe-area:390px-portrait-clears-44px-insets', clear(portrait), portrait);
    await page.screenshot({ path: path.join(out, `${target.id}-safe-area-390.png`) });
    entry.safeAreas = { kind: 'Chromium CDP synthetic insets, not a real iOS/device test', landscape, portrait };
  } finally {
    await client.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, right: 0, bottom: 0 } });
    await client.detach();
  }
}
async function axe(page, entry) {
  if (!axePath) { check(entry, 'axe:not-run', false, 'Set JOURNAL_AXE_PATH'); return; }
  await page.addScriptTag({ path: axePath });
  const result = await page.evaluate(async () => {
    const audit = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
    return {
      version: window.axe.version,
      violations: audit.violations.map((item) => ({ id: item.id, impact: item.impact, help: item.help, nodes: item.nodes.map((node) => ({ target: node.target, failureSummary: node.failureSummary })) })),
      incomplete: audit.incomplete.map((item) => ({ id: item.id, nodes: item.nodes.map((node) => node.target) })),
      passes: audit.passes.length,
    };
  });
  report.axeVersion = result.version;
  entry.axe = result;
  check(entry, 'axe:WCAG-A-AA', result.violations.length === 0, result.violations);
}
try {
  browser = await browserType.launch({
    headless: true,
    ...(engine === 'chromium' && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
  });
  report.browserVersion = browser.version();
  for (const target of targets) for (const theme of themes) for (const width of widths) {
    const entry = { target: target.id, width, theme, checks: [] };
    report.cases.push(entry);
    const context = await browser.newContext({ viewport: { width, height: 1100 }, colorScheme: theme, reducedMotion: 'reduce', hasTouch: width <= 430, ...(engine !== 'firefox' ? { isMobile: width <= 430 } : {}), serviceWorkers: 'block' });
    await context.addInitScript((value) => { localStorage.setItem('theme', value); localStorage.setItem('gb:reader-preferences:v1', JSON.stringify({ version: 1, theme: value })); }, theme);
    const page = await context.newPage();
    const errors = [], failedAssets = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('response', (response) => {
      if (new URL(response.url()).origin === new URL(target.url).origin && response.status() >= 400) failedAssets.push(`${response.status()} ${response.url()}`);
    });
    try {
      const response = await page.goto(target.url, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      check(entry, 'document:200', response?.status() === 200);
      const facts = await inspect(page);
      entry.facts = facts;
      check(entry, 'layout:no-horizontal-overflow', facts.overflow <= 1 && facts.overflowingElements.length === 0, facts.overflowingElements);
      check(entry, 'layout:masthead-all-links-fit', facts.nav.length === 4 && facts.nav.every((item) => !item.clipped && item.left >= 0 && item.right <= width + 1 && item.height >= 44), facts.nav);
      const namedBrand = page.getByRole('link', { name: facts.brandVisibleText, exact: true }).and(page.locator('.je-masthead__identity'));
      check(entry, 'masthead:accessible-name-matches-visible-copy', await namedBrand.count() === 1, facts.brandVisibleText);
      if (target.id === 'journal') {
        check(entry, 'layout:landing-footer-shares-content-edge', facts.landingAlignment && Math.abs(facts.landingAlignment.contentLeft - facts.landingAlignment.footerLeft) <= 1, facts.landingAlignment);
      }
      check(entry, 'semantics:one-heading-main-no-duplicate-ids', facts.h1 === 1 && facts.main === 1 && facts.duplicateIds.length === 0);
      check(entry, 'anchors:all-local-targets-exist', facts.missingAnchors.length === 0, facts.missingAnchors);
      check(entry, 'theme:shared-preference-applies', facts.dark === (theme === 'dark'));
      check(entry, 'series:valid-rule', facts.seriesBorder === 'solid');
      check(entry, 'assets:responsive-cover-loaded', facts.cover?.complete && /\.(avif|webp)$/.test(facts.cover.currentSrc), facts.cover);
      check(entry, 'runtime:no-duplicate-scripts', new Set(facts.scripts).size === facts.scripts.length);
      if (target.id === 'dossier') check(entry, 'sources:21-approved-records', facts.bibliography === 21);
      if (target.held) {
        check(entry, 'history:noindex', /noindex/.test(await page.locator('meta[name="robots"]').getAttribute('content')));
        check(entry, 'history:hold-visible', await page.locator('.je-draft-notice').isVisible());
        // A broad narrative selector previously swallowed the service-structure
        // caption. Verify its UI hierarchy at mobile and desktop sizes.
        const type = facts.growthTypography;
        check(entry, 'history:service-caption-keeps-UI-hierarchy', type?.captionSize === 11 && type.captionFamily.includes('Source Sans 3') && type.narrativeSize >= 17 && type.narrativeFamily.includes('Lora'), type);
      }
      if ([390, 1440].includes(width)) {
        const file = `${target.id}-${width}-${theme}.png`;
        await page.screenshot({ path: path.join(out, file) });
        entry.screenshot = file;
      }
      await axe(page, entry);
      if ([390, 1440].includes(width)) {
        await keyboard(page, entry);
        await sourceNavigation(page, target, entry);
      }
      check(entry, 'runtime:no-JS-errors', errors.length === 0, errors);
      check(entry, 'assets:no-local-HTTP-errors', failedAssets.length === 0, failedAssets);
    } catch (error) { check(entry, 'case:exception', false, String(error.stack || error)); }
    finally { await context.close(); }
    console.log(`${engine} ${target.id} ${width} ${theme}: ${entry.checks.every((item) => item.ok) ? 'PASS' : 'FAIL'}`);
  }
  for (const target of targets) {
    const entry = { target: target.id, checks: [] };
    report.extras.push(entry);
    // Native navigation and reading do not depend on a Journal-specific runtime.
    const noJs = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await noJs.newPage();
    await page.goto(target.url, { waitUntil: 'networkidle' });
    check(entry, 'no-JS:heading-readable', await page.locator('h1').isVisible());
    const summary = page.locator('.je-contents > summary');
    if (await summary.count()) {
      await summary.click();
      check(entry, 'no-JS:native-contents-close', await summary.evaluate((node) => !node.parentElement.open));
      await summary.click();
      await sourceNavigation(page, target, entry);
    }
    await noJs.close();
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, colorScheme: 'dark', reducedMotion: 'reduce', serviceWorkers: 'block' });
    const landscape = await context.newPage();
    await landscape.goto(target.url, { waitUntil: 'networkidle' });
    await landscape.evaluate(() => document.fonts.ready);
    check(entry, 'landscape:844x390-reflows', (await inspect(landscape)).overflow <= 1);
    await landscape.screenshot({ path: path.join(out, `${target.id}-landscape.png`) });
    await syntheticSafeAreas(landscape, context, target, entry);
    // 320 CSS px is also the 1280px / 400% reflow case; browser-UI zoom itself is not asserted.
    await landscape.setViewportSize({ width: 640, height: 450 });
    check(entry, 'zoom-equivalent:200pct-reflow-640CSSpx', (await inspect(landscape)).overflow <= 1);
    await landscape.setViewportSize({ width: 320, height: 225 });
    check(entry, 'zoom-equivalent:400pct-reflow-320CSSpx', (await inspect(landscape)).overflow <= 1);
    await landscape.setViewportSize({ width: 1440, height: 1100 });
    if (target.id !== 'journal') {
      await landscape.locator('.bibliography-details').evaluate((node) => { node.open = false; });
      await landscape.emulateMedia({ media: 'print' });
      const print = await landscape.evaluate(() => ({
        paper: getComputedStyle(document.querySelector('.journal-edition')).backgroundColor,
        paperToken: getComputedStyle(document.querySelector('.journal-edition')).getPropertyValue('--je-paper').trim(),
        ink: getComputedStyle(document.querySelector('h1')).color,
        sources: [...document.querySelectorAll('.bibliography-item')].filter((node) => node.getBoundingClientRect().height > 0).length,
        mastheadHidden: getComputedStyle(document.querySelector('.je-masthead')).display === 'none',
        contentsHidden: getComputedStyle(document.querySelector('.je-contents')).display === 'none',
        paragraphBreak: getComputedStyle(document.querySelector('.prose > p')).breakInside,
      }));
      // The existing site print owner intentionally clears backgrounds with
      // transparent !important. Respect that white-paper canvas, do not add a
      // competing !important to the Journal just to satisfy a computed-color assertion.
      check(entry, 'print:light-paper-hidden-navigation-sources-even-when-closed', ['rgb(255, 255, 255)', 'rgba(0, 0, 0, 0)'].includes(print.paper) && print.paperToken === '#fff' && ['rgb(0, 0, 0)', 'rgb(17, 17, 17)'].includes(print.ink) && print.sources > 0 && print.mastheadHidden && print.contentsHidden, print);
      check(entry, 'print:reading-paragraphs-stay-together', print.paragraphBreak === 'avoid', print.paragraphBreak);
      await landscape.screenshot({ path: path.join(out, `${target.id}-print.png`) });
      if (engine === 'chromium') await landscape.pdf({ path: path.join(out, `${target.id}-print.pdf`), format: 'A4', printBackground: true });
    }
    await context.close();
  }
} catch (error) {
  report.unavailable.push(String(error.stack || error));
} finally {
  await browser?.close();
  report.failedChecks = [...report.cases, ...report.extras].flatMap((entry) => entry.checks.filter((item) => !item.ok).map((item) => ({ target: entry.target, width: entry.width, theme: entry.theme, ...item })));
  report.completedCases = report.cases.length;
  await fs.writeFile(path.join(out, `${engine}.json`), JSON.stringify(report, null, 2) + '\n');
  console.log(`Report: ${out}/${engine}.json; ${report.failedChecks.length} failed checks; ${report.unavailable.length} unavailable sections.`);
  if (report.failedChecks.length || report.unavailable.length || report.completedCases !== targets.length * themes.length * widths.length) process.exitCode = 1;
}
