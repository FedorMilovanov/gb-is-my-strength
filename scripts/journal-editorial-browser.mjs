#!/usr/bin/env node
/**
 * Local Journal acceptance witness; no CI/gate/route/Research mutation.
 * Requires existing Playwright plus an explicit axe-core file (no dependency changes).
 * JOURNAL_CHROMIUM_EXECUTABLE may select a sandbox-compatible Chromium.
 * Example: node scripts/journal-editorial-browser.mjs --origin=http://localhost:4173
 *   --history-origin=http://localhost:4321 --axe=/path/to/axe.min.js
 * --browser=firefox|webkit uses that actual Playwright browser, never Chromium emulation.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium, firefox, webkit } from 'playwright';
const require = createRequire(import.meta.url);
const { monitorRuntime } = require('./lib/browser-runtime-noise.js');
const root = fileURLToPath(new URL('../', import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((arg) => { const i = arg.indexOf('='); return [arg.slice(2, i), arg.slice(i + 1)]; }));
const origin = args.origin || 'http://localhost:4173';
const engine = args.browser || 'chromium';
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine), 'unknown browser engine');
const axePath = args.axe || path.join(root, 'node_modules/axe-core/axe.min.js');
assert.ok(fs.existsSync(axePath), 'provide --axe=<existing axe-core file>; do not silently skip the accessibility audit');
const axeSource = fs.readFileSync(axePath, 'utf8');
const output = path.resolve(root, args.output || 'reports/g3-editorial-local-20261118');
fs.mkdirSync(path.join(output, 'after'), { recursive: true });
const widths = args.widths ? args.widths.split(',').map(Number) : [320, 360, 390, 430, 768, 1024, 1440, 1920];
assert.ok(widths.every((width) => Number.isInteger(width) && width >= 320));
const routes = [{ kind: 'journal', url: origin + '/journal/' }, { kind: 'dossier', url: origin + '/journal/dossiers/g3/' }];
if (args['history-origin']) routes.push({ kind: 'history', url: args['history-origin'] + '/_review/g3-history/' });
const report = { engine, version: null, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  note: 'Local artifact/manuscript only. axe is automated evidence, not full WCAG or artistic signoff. Timings are local lab, not field Core Web Vitals.',
  sourceSha256: {}, cases: [], interactions: [], problems: [] };
const witnessFiles = [
  ...['G3Dossier.astro', 'G3HistoryArticle.astro', 'G3HistoryFeature.astro', 'JournalLanding.astro', 'JournalMasthead.astro', 'JournalArticleHeader.astro', 'JournalContents.astro', 'JournalDataFigure.astro', 'JournalDocumentHead.astro', 'JournalFontPreloads.astro', 'journalEditorial.css', 'g3History.css'].map((name) => `src/components/journal/${name}`),
  ...['g3EditorialMedia.ts', 'g3HistoryDraftSources.ts', 'g3HistoryDraftMetadata.ts', 'g3ProductMetadata.ts', 'g3PublicationHandoff.ts', 'g3SourceBibliography.ts', 'journalProductMetadata.ts'].map((name) => `src/data/journal/${name}`),
  'scripts/journal-editorial-browser.mjs', 'scripts/journal-editorial-contract.mjs', 'scripts/journal-local-review.mjs', 'scripts/fixtures/g3-history-review.astro',
];
for (const name of witnessFiles) {
  report.sourceSha256[name] = createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
}
const browser = await ({ chromium, firefox, webkit })[engine].launch({
  headless: true,
  ...(engine === 'chromium' && process.env.JOURNAL_CHROMIUM_EXECUTABLE ? {
    executablePath: process.env.JOURNAL_CHROMIUM_EXECUTABLE, args: ['--no-sandbox', '--disable-dev-shm-usage'],
  } : {}),
});
report.version = browser.version();
const audit = async (page) => {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    const result = await window.axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
    return { violations: result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })) })),
      incomplete: result.incomplete.map((v) => ({ id: v.id, impact: v.impact,
        nodes: v.nodes.map((n) => ({ target: n.target, html: n.html, summary: n.failureSummary })) })) };
  });
};
const contextFor = (width, theme, options = {}) => browser.newContext({ viewport: { width, height: width <= 430 ? 844 : width === 768 ? 1024 : 1080 },
  colorScheme: theme, deviceScaleFactor: 1, serviceWorkers: 'block', ...options });
const ready = async (page, url) => {
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200, url);
  await page.evaluate(() => document.fonts.ready);
  return response;
};
const settle = async (page) => {
  // Wait for native smooth scrolling + the shared mobile chrome's 280ms transition.
  await page.waitForFunction(() => new Promise((resolve) => {
    let y = scrollY, frames = 0;
    const tick = () => { frames = Math.abs(y - scrollY) < .5 ? frames + 1 : 0; y = scrollY; frames > 12 ? resolve(true) : requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }));
  await page.waitForTimeout(300);
};
const inspect = (page) => page.evaluate(() => {
  const visible = (el) => el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : Boolean(el.getClientRects().length);
  const overflow = [...document.querySelectorAll('.journal-edition *')].filter(visible).map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && (r.left < -1 || r.right > innerWidth + 1)).map(({ el, r }) => ({ tag: el.tagName, class: String(el.className), left: r.left, right: r.right })).slice(0, 12);
  const image = document.querySelector('.je-article-cover img, .lead-context img');
  const body = document.querySelector('.prose > p:not(.source-note-paragraph), .je-history-text > p');
  const metrics = (el) => el ? ({ y: Math.round(el.getBoundingClientRect().top + scrollY), width: Math.round(el.getBoundingClientRect().width) }) : null;
  const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
  const brokenAnchors = [...document.querySelectorAll('a[href^="#"]')].map((el) => el.getAttribute('href'))
    .filter((href) => !document.getElementById(decodeURIComponent(href.slice(1))));
  return { overflow, documentOverflow: document.documentElement.scrollWidth - innerWidth,
    duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index), brokenAnchors,
    h1: document.querySelectorAll('h1').length, contents: document.querySelectorAll('[data-journal-contents]').length,
    theme: document.documentElement.dataset.readerTheme, cover: image ? { ...metrics(image), src: new URL(image.currentSrc).pathname, loaded: image.complete && image.naturalWidth > 0 } : null,
    author: metrics(document.querySelector('.je-article-byline')), body: body ? { ...metrics(body), fontSize: getComputedStyle(body).fontSize, lineHeight: getComputedStyle(body).lineHeight } : null,
    fontFaces: [...document.fonts].filter((face) => face.status === 'loaded').map((face) => `${face.family} ${face.weight}`),
    transferBytes: performance.getEntriesByType('resource').reduce((sum, entry) => sum + entry.transferSize, 0),
    lcp: window.__journalLab?.lcp ?? null, cls: window.__journalLab?.cls ?? null };
});
const shot = (page, name, options) => page.screenshot({ path: path.join(output, `after/${name}.png`), ...options });
try {
  for (const route of routes) for (const width of widths) for (const theme of ['light', 'dark']) {
    const context = await contextFor(width, theme);
    await context.addInitScript(() => {
      window.__journalLab = { lcp: null, cls: null };
      try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__journalLab.lcp = entry.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
      try {
        if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
          window.__journalLab.cls = 0;
          new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__journalLab.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
        }
      } catch { window.__journalLab.cls = null; }
    });
    const page = await context.newPage();
    const item = { kind: route.kind, width, theme, runtime: [] };
    monitorRuntime(page, item.runtime, { isIgnoredConsole: (_, message) => !['error', 'warning'].includes(message.type()) });
    try {
      const response = await ready(page, route.url);
      if (route.kind === 'history') {
        assert.match(response.headers()['x-robots-tag'] || '', /noindex/);
        assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/);
        assert.equal(await page.locator('[data-research-publication-status="PUBLICATION_HOLD"]').count() > 0, true);
        assert.equal(await page.locator('link[rel="canonical"]').count(), 0);
      }
      item.layout = await inspect(page);
      await shot(page, `${route.kind}-${width}-${theme}`);
      assert.equal(item.layout.documentOverflow, 0);
      assert.deepEqual(item.layout.overflow, [], 'visible elements must fit; root overflow:clip alone is not a pass');
      assert.deepEqual(item.layout.duplicateIds, [], 'IDs must be unique, including the held history manuscript');
      assert.deepEqual(item.layout.brokenAnchors, [], 'every local anchor needs a real target');
      assert.equal(item.layout.h1, 1);
      assert.equal(item.layout.theme, theme);
      assert.equal(item.layout.cover?.loaded, true);
      item.axe = await audit(page);
      assert.deepEqual(item.axe.violations, [], 'axe WCAG A/AA violations');
      assert.deepEqual(item.axe.incomplete, [], 'static editorial surfaces must not leave unresolved axe review items');
      if (route.kind !== 'history' && engine === 'chromium') {
        assert.ok(item.layout.cls !== null && item.layout.cls <= .1, `initial-load local CLS budget exceeded: ${item.layout.cls}`);
      }
      if (route.kind !== 'journal') {
        assert.equal(item.layout.contents, 1, 'one TOC, not duplicated desktop/mobile navigation');
        const toc = page.locator('[data-journal-contents]');
        assert.equal(await toc.evaluate((el) => el.open), width >= 1024);
        if (width < 1024) {
          await toc.locator('summary').focus(); await page.keyboard.press('Enter');
          assert.equal(await toc.evaluate((el) => el.open), true);
          await page.keyboard.press('Escape');
          assert.equal(await toc.evaluate((el) => el.open), false);
          assert.equal(await toc.locator('summary').evaluate((el) => el === document.activeElement), true);
          await page.keyboard.press('Enter');
        }
        const id = route.kind === 'dossier' ? 'finance' : 'g3-year-2018';
        await toc.locator(`a[href="#${id}"]`).click();
        await settle(page);
        const anchor = await page.locator(`#${id}`).evaluate((el) => ({
          y: el.getBoundingClientRect().top,
          expected: parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop || '0') + parseFloat(getComputedStyle(el).scrollMarginTop || '0'),
        }));
        const y = anchor.y;
        assert.ok(Math.abs(y - anchor.expected) < 2, `native anchor offset disagrees with shared scroll-padding + local margin: ${JSON.stringify(anchor)}`);
        assert.ok(y >= (width < 1024 ? 110 : 25) && y < 260, `anchor hidden under chrome / excessive offset: y=${y}`);
        assert.equal(new URL(page.url()).hash, `#${id}`);
        if (width < 1024) {
          assert.equal(await toc.evaluate((el) => el.open), false);
          assert.equal(await page.locator(`#${id}`).evaluate((el) => el === document.activeElement), true);
        }
        item.anchor = { id, y, mobileFocusAndClose: width < 1024 };
        if ([390, 1440].includes(width)) {
          await shot(page, `${route.kind}-body-${width}-${theme}`);
          const citation = page.locator(route.kind === 'dossier' ? '.source-note[href^="#src-"]' : '.je-history-footnote a[href^="#history-source-"]').first();
          const hash = await citation.getAttribute('href');
          await citation.click(); await settle(page);
          const source = page.locator(hash);
          assert.equal(await source.locator('h3').isVisible(), true, 'citation must land on an always-visible title');
          await shot(page, `${route.kind}-sources-${width}-${theme}`);
          if (route.kind === 'dossier') {
            const disclosure = source.locator('details');
            await disclosure.locator('summary').focus(); await page.keyboard.press('Space');
            assert.equal(await disclosure.evaluate((el) => el.open), true);
            assert.equal(await disclosure.locator('.biblio-links').isVisible(), true);
          } else {
            await source.locator('.je-source-return').click(); await settle(page);
            assert.equal(new URL(page.url()).hash, '#g3-history');
          }
        }
      }
      assert.deepEqual(item.runtime, [], 'unexpected runtime/network errors');
      console.log(`PASS ${route.kind} ${width} ${theme}`);
    } catch (error) {
      item.failure = error.message; report.problems.push(`${route.kind} ${width} ${theme}: ${error.message}`);
      console.error(`FAIL ${route.kind} ${width} ${theme}: ${error.message.slice(0, 280)}`);
    } finally { report.cases.push(item); await context.close(); }
  }
  for (const route of routes) {
    const result = { kind: route.kind, runtime: [] };
    const context = await contextFor(390, 'light');
    const page = await context.newPage();
    monitorRuntime(page, result.runtime, { isIgnoredConsole: (_, message) => !['error', 'warning'].includes(message.type()) });
    try {
      await ready(page, route.url);
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('.skip-link').evaluate((el) => el === document.activeElement), true);
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#main-content').evaluate((el) => el === document.activeElement), true);
      result.skipLink = true;
      const button = page.locator('[data-journal-theme]');
      await button.click();
      assert.equal(await page.locator('html').getAttribute('data-reader-theme'), 'dark');
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await page.locator('html').getAttribute('data-reader-theme'), 'dark');
      const second = await context.newPage(); await ready(second, route.url);
      await page.locator('[data-journal-theme]').click();
      await second.waitForFunction(() => document.documentElement.dataset.readerTheme === 'light');
      await second.close();
      result.themeTogglePersistenceCrossTab = true;
      await page.evaluate(() => window.GBReaderPreferences.set({ fontScale: 1.4 }, { source: 'journal-qa' }));
      await page.evaluate(() => document.documentElement.style.fontSize = '200%');
      const resized = await inspect(page);
      assert.equal(resized.documentOverflow, 0); assert.deepEqual(resized.overflow, []);
      result.readerScaleAndRootText200 = resized.body;
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; window.GBReaderPreferences.set({ fontScale: 1 }, { source: 'journal-qa' }); });
      await page.emulateMedia({ media: 'print' });
      assert.equal(await page.locator('.je-masthead').isVisible(), false);
      if (route.kind !== 'journal') {
        assert.equal(await page.locator('.je-editorial-rail').isVisible(), false);
        if (route.kind === 'dossier') assert.equal(await page.locator('.bibliography-item').first().locator('.biblio-links').isVisible(), true, 'print must reveal closed source locators');
        if (route.kind === 'history') {
          assert.equal(await page.locator('.je-review-note').isVisible(), true, 'the manuscript must remain visibly unpublished in print');
          result.printYearLabels = await page.locator('.je-history-dateline > span, .je-history-year-mark time').evaluateAll((labels) => labels.map((label) => {
            const range = document.createRange(); range.selectNodeContents(label);
            const rects = [...range.getClientRects()];
            return { year: label.textContent.trim(), lines: new Set(rects.map((r) => r.top)).size,
              textWidth: Math.max(...rects.map((r) => r.width)), available: label.parentElement.getBoundingClientRect().width };
          }));
          assert.ok(result.printYearLabels.every((label) => label.lines === 1 && label.textWidth <= label.available + 1), 'a four-digit printed year must fit on a single line');
        }
      }
      result.print = true;
      if (engine === 'chromium') await page.pdf({ path: path.join(output, `${route.kind}-print.pdf`), format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' } });
      await page.emulateMedia({ media: 'screen' });
      if (route.kind !== 'history') {
        // Exercise a cold keyboard bootstrap before any click has loaded search.
        await page.keyboard.press('Control+k');
        const palette = page.locator('.cp-backdrop.is-open');
        await palette.waitFor();
        assert.equal(await page.locator('.cp-backdrop').count(), 1);
        await page.keyboard.press('Escape');
        await page.locator('.je-masthead [data-action="open-search"]').click();
        await palette.waitFor();
        await page.locator('.cp-input').fill('G3');
        await page.waitForFunction(() => [...document.querySelectorAll('.cp-backdrop a[href]')].some((el) => el.getAttribute('href')?.includes('/journal/dossiers/g3/')), undefined, { timeout: 10000 });
        result.searchAxe = await audit(page);
        assert.deepEqual(result.searchAxe.violations, []);
        // axe 4.11 asks for review of controlsWithinPopup on this shared combobox.
        // Keep the finding visible and verify its actual IDREF/role relationship;
        // never blanket-ignore an incomplete rule or mutate the shared palette.
        result.searchAriaReferencesReview = await page.locator('.cp-input').evaluate((input) => {
          const controls = input.getAttribute('aria-controls');
          const activeId = input.getAttribute('aria-activedescendant');
          const list = document.getElementById(controls || '');
          const active = document.getElementById(activeId || '');
          const unique = (id) => [...document.querySelectorAll('[id]')].filter((el) => el.id === id).length === 1;
          return { controls, uniqueControls: unique(controls), listRole: list?.getAttribute('role'),
            listVisible: Boolean(list?.getClientRects().length), expanded: input.getAttribute('aria-expanded'),
            uniqueActive: unique(activeId), activeInList: Boolean(active && list?.contains(active)),
            activeRole: active?.getAttribute('role'), activeSelected: active?.getAttribute('aria-selected') };
        });
        assert.deepEqual(result.searchAriaReferencesReview, { controls: 'cp-listbox', uniqueControls: true,
          listRole: 'listbox', listVisible: true, expanded: 'true', uniqueActive: true,
          activeInList: true, activeRole: 'option', activeSelected: 'true' });
        for (const review of result.searchAxe.incomplete) {
          assert.equal(review.id, 'aria-valid-attr-value', 'unexpected search accessibility review item');
          for (const node of review.nodes) {
            assert.ok(node.html.includes('class="cp-input"') && node.summary?.includes('aria-controls="cp-listbox"'), 'unexpected search review target');
          }
        }
        const firstOption = await page.locator('.cp-input').getAttribute('aria-activedescendant');
        await page.keyboard.press('ArrowDown');
        assert.notEqual(await page.locator('.cp-input').getAttribute('aria-activedescendant'), firstOption);
        await page.keyboard.press('ArrowUp');
        assert.equal(await page.locator('.cp-input').getAttribute('aria-activedescendant'), firstOption);
        result.searchKeyboardArrows = true;
        await shot(page, `${route.kind}-search-390-light`);
        await page.keyboard.press('Escape');
        assert.equal(await palette.count(), 0);
        assert.equal(await page.locator('.je-masthead [data-action="open-search"]').evaluate((el) => el === document.activeElement), true);
        await page.keyboard.press('Meta+k');
        await page.locator('.cp-backdrop.is-open').waitFor();
        assert.equal(await page.locator('.cp-backdrop').count(), 1);
        await page.keyboard.press('Escape');
        result.searchClickKeyboardQueryEscape = true;
        result.coldControlKAndMetaK = true;
      }
      assert.deepEqual(result.runtime, []);
    } catch (error) { result.failure = error.message; report.problems.push(`${route.kind} interaction: ${error.message}`); }
    finally { await context.close(); report.interactions.push(result); }
    const noJs = await contextFor(390, 'light', { javaScriptEnabled: false });
    try {
      const p = await noJs.newPage(); await ready(p, route.url);
      const layout = await inspect(p);
      assert.equal(layout.documentOverflow, 0); assert.deepEqual(layout.overflow, []);
      assert.equal(await p.locator('h1').isVisible(), true);
      if (route.kind !== 'journal') {
        assert.equal(await p.locator('[data-journal-contents] a').first().isVisible(), true);
        await p.locator('[data-journal-contents] a').first().click();
        assert.ok(new URL(p.url()).hash.length > 1);
      }
      result.noJsReadingAndAnchors = true;
    } catch (error) { report.problems.push(`${route.kind} no-JS: ${error.message}`); }
    finally { await noJs.close(); }
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, `browser-${engine}.json`), JSON.stringify(report, null, 2) + '\n');
}
console.log(`${report.cases.length} responsive cases; ${report.problems.length} problem(s); browser ${engine} ${report.version}`);
if (report.problems.length) { console.error(report.problems.join('\n')); process.exitCode = 1; }
