#!/usr/bin/env node
/**
 * Local Journal acceptance witness; no CI/gate/route/Research mutation.
 * Requires existing Playwright plus an explicit axe-core file (no dependency changes).
 * JOURNAL_CHROMIUM_EXECUTABLE may select a sandbox-compatible Chromium.
 * Example: node scripts/journal-editorial-browser.mjs --origin=http://localhost:4173
 *   --history-origin=http://localhost:4321 --axe=/path/to/axe.min.js
 * --browser=firefox|webkit uses that actual Playwright browser, never Chromium emulation.
 * --suite=print runs only the actual-PDF matrix (Chromium + Python/PyMuPDF).
 * --suite=mobile exercises native compact-TOC focus; --mobile-heights=390,844.
 * --pdf-python=/path/to/python selects that environment; --print-baseline=/path/to/capture.json
 * additionally checks earlier text/styles and unchanged public print geometry.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
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
const suite = args.suite || 'full';
const visibleScrollbars = args['visible-scrollbars'] === 'true';
const publicOnly = args['public-only'] === 'true';
assert.ok(!publicOnly || !args['history-origin'], 'Public-only acceptance must not activate a held-history fixture');
const transfer = args.transfer ? JSON.parse(fs.readFileSync(args.transfer, 'utf8')) : null;
assert.ok(!transfer || publicOnly, 'A gitless composite must explicitly use --public-only=true');
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine), 'unknown browser engine');
assert.ok(['full', 'short', 'mobile', 'print'].includes(suite), 'use --suite=full|short|mobile|print');
assert.ok(suite !== 'print' || engine === 'chromium', 'actual PDF generation requires Chromium; do not substitute an emulated print DOM');
const axePath = args.axe || path.join(root, 'node_modules/axe-core/axe.min.js');
assert.ok(suite === 'print' || fs.existsSync(axePath), 'provide --axe=<existing axe-core file>; do not silently skip the accessibility audit');
const axeSource = suite === 'print' ? '' : fs.readFileSync(axePath, 'utf8');
const output = path.resolve(root, args.output || 'reports/g3-editorial-local-20261118');
fs.mkdirSync(path.join(output, 'after'), { recursive: true });
const widths = args.widths ? args.widths.split(',').map(Number) : [320, 360, 390, 430, 768, 1024, 1440, 1920];
const shortHeights = args.heights ? args.heights.split(',').map(Number) : [390, 480, 600];
const mobileWidths = args.widths ? widths.filter((width) => width <= 1023) : [320, 360, 390, 430, 768, 1023];
const mobileHeights = args['mobile-heights'] ? args['mobile-heights'].split(',').map(Number) : [390, 844];
assert.ok(mobileHeights.every((height) => Number.isInteger(height) && height >= 320 && height <= 1080));
assert.ok(suite !== 'mobile' || mobileWidths.length > 0, 'the mobile suite needs a compact width');
assert.ok(widths.every((width) => Number.isInteger(width) && width >= 320));
assert.ok(shortHeights.every((height) => Number.isInteger(height) && height >= 320 && height <= 600));
assert.ok(suite !== 'short' || widths.some((width) => width >= 1024), 'the short suite needs at least one desktop width');
const routes = [{ kind: 'journal', url: origin + '/journal/' }, { kind: 'dossier', url: origin + '/journal/dossiers/g3/' }];
if (args['history-origin']) routes.push({ kind: 'history', url: args['history-origin'] + '/_review/g3-history/' });
const report = { engine, suite, version: null, head: transfer ? null : execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  worktree: transfer ? null : execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
  publicOnly, composite: transfer ? { base: transfer.base, source: transfer.source, notCanonicalGitCommit: true } : null,
  visibleScrollbars,
  note: 'Local artifact/manuscript only. axe is automated evidence, not full WCAG or artistic signoff. Timings are local lab, not field Core Web Vitals. Short-window theme is the browser color preference; no-JS retains the existing SSR palette.',
  sourceSha256: {}, cases: [], interactions: [], shortViewports: [], mobileFocus: [], printCases: [], problems: [] };
const witnessFiles = [
  ...['G3Dossier.astro', 'G3HistoryArticle.astro', 'G3HistoryFeature.astro', 'JournalLanding.astro', 'JournalMasthead.astro', 'JournalArticleHeader.astro', 'JournalContents.astro', 'JournalDataFigure.astro', 'JournalSourceReturn.astro', 'JournalDocumentHead.astro', 'JournalFontPreloads.astro', 'journalEditorial.css', 'g3History.css'].map((name) => `src/components/journal/${name}`),
  ...['g3EditorialMedia.ts', 'g3HistoryDraftSources.ts', 'g3HistoryDraftMetadata.ts', 'g3ProductMetadata.ts', 'g3PublicationHandoff.ts', 'g3SourceBibliography.ts', 'journalProductMetadata.ts'].map((name) => `src/data/journal/${name}`),
  'src/components/journal/journalDocumentMetadata.ts', 'src/pages/journal/index.astro', 'src/pages/journal/dossiers/g3/index.astro',
  'scripts/journal-editorial-browser.mjs', 'scripts/lib/journal-print-pdf.py', 'scripts/journal-editorial-contract.mjs', 'scripts/journal-local-review.mjs', 'scripts/fixtures/g3-history-review.astro',
];
if (transfer) {
  assert.equal(transfer.version, 2);
  assert.match(transfer.base, /^[a-f0-9]{40}$/); assert.match(transfer.source, /^[a-f0-9]{40}$/);
  for (const entry of transfer.files) {
    const bytes = fs.readFileSync(path.join(root, entry.path));
    assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), entry.after.blob, `Runtime source differs from transferred public file: ${entry.path}`);
  }
}
for (const name of witnessFiles) {
  if (publicOnly && ['src/data/journal/g3HistoryDraftSources.ts', 'scripts/journal-local-review.mjs', 'scripts/fixtures/g3-history-review.astro'].includes(name)) continue;
  report.sourceSha256[name] = createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
}
const browser = await ({ chromium, firefox, webkit })[engine].launch({
  headless: true,
  ...(visibleScrollbars ? { ignoreDefaultArgs: ['--hide-scrollbars'] } : {}),
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
// Page timers/rAF do not run when scripting is disabled. Poll from the test
// process instead, still waiting for the real native smooth-scroll destination.
const settleWithoutScripts = async (page) => {
  let previous = await page.evaluate(() => scrollY), stable = 0;
  for (let attempt = 0; attempt < 60; attempt++) {
    await page.waitForTimeout(80);
    const current = await page.evaluate(() => scrollY);
    stable = Math.abs(current - previous) < .5 ? stable + 1 : 0;
    previous = current;
    if (stable >= 5) return;
  }
  throw new Error('native no-JS scroll did not settle');
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
const citationFor = (page, kind, second = false) => page.locator(kind === 'dossier'
  ? second ? '#finance .je-data-figure [data-journal-citation]' : '#finance .source-note[data-journal-citation]'
  : second ? '#g3-history [data-journal-citation]' : '#g3-growth [data-journal-citation][href="#history-source-challies"]');
const sourceRoundTrip = async (page, citation, keyboard, onSource) => {
  const id = await citation.getAttribute('id');
  const hash = await citation.getAttribute('href');
  assert.ok(id && hash, 'the citation must have a stable SSR ID and source destination');
  if (keyboard) { await citation.focus(); await page.keyboard.press('Enter'); } else await citation.click();
  await settle(page);
  assert.equal(new URL(page.url()).hash, hash, 'native source navigation must retain its fragment');
  const source = page.locator(hash);
  assert.equal(await source.evaluate((el) => el === document.activeElement), true, 'native source destination must receive focus');
  assert.equal(await source.locator('h3').isVisible(), true);
  const back = source.locator('[data-journal-source-return]');
  assert.equal(await back.getAttribute('href'), `#${id}`, 'return to this citation, not the first use of a repeated source');
  const label = (await citation.textContent()).replace(/\s+/gu, ' ').trim();
  assert.equal(await back.getAttribute('aria-label'), `К месту чтения: ${label}`);
  if (onSource) await onSource(source);
  if (keyboard) await back.click(); else { await back.focus(); await page.keyboard.press('Enter'); }
  await settle(page);
  assert.equal(new URL(page.url()).hash, `#${id}`);
  assert.equal(await citation.evaluate((el) => el === document.activeElement), true, 'return must restore keyboard focus to the citation');
  const position = await citation.evaluate((el) => ({ y: el.getBoundingClientRect().top,
    expected: parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop || '0') + parseFloat(getComputedStyle(el).scrollMarginTop || '0') }));
  assert.ok(Math.abs(position.y - position.expected) < 2, `citation hidden or offset from its native fragment destination: ${JSON.stringify(position)}`);
  return { id, source: hash, keyboardOutbound: keyboard, keyboardReturn: !keyboard, focusRestored: true, position };
};
// axe reports contrast review items for rows clipped by a native scrollport.
// Retain every item; accept only this measured case, with a flat opaque paper
// background and independently computed >=4.5:1 foreground contrast. Anything
// outside this exact relationship remains a failing/unresolved review item.
const reviewClippedContrast = async (page, reviews) => {
  const witnesses = [];
  for (const review of reviews) {
    assert.equal(review.id, 'color-contrast', 'unexpected compact-TOC accessibility review');
    for (const node of review.nodes) {
      assert.ok(node.summary?.includes("Element's background color could not be determined because it's partially obscured by another element"));
      assert.equal(node.target.length, 1);
      const state = await page.evaluate((selector) => {
        const matches = document.querySelectorAll(selector), el = matches[0];
        const nav = el?.closest('[data-journal-contents] nav'), link = el?.closest('a');
        if (matches.length !== 1 || !nav || !link || !nav.contains(link)) return { validTarget: false };
        const rgb = (color) => /^rgba?\(/u.test(color) ? color.match(/[\d.]+/gu).map(Number) : [];
        const fg = rgb(getComputedStyle(el).color);
        let parent = el, bg = [], flat = true;
        while (parent && bg.length === 0) {
          const style = getComputedStyle(parent), color = rgb(style.backgroundColor);
          flat &&= style.backgroundImage === 'none' && Number(style.opacity) === 1 && style.filter === 'none' && style.mixBlendMode === 'normal';
          if (color.length >= 3 && (color[3] ?? 1) > 0) bg = color;
          parent = parent.parentElement;
        }
        const luminance = (color) => color.slice(0, 3).map((c) => c / 255).map((c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
          .reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
        const a = luminance(fg), b = luminance(bg), r = nav.getBoundingClientRect();
        const clip = { left: r.left + nav.clientLeft, top: r.top + nav.clientTop,
          right: r.left + nav.clientLeft + nav.clientWidth, bottom: r.top + nav.clientTop + nav.clientHeight };
        const inside = (r) => r.left >= clip.left - 1 && r.right <= clip.right + 1 && r.top >= clip.top - 1 && r.bottom <= clip.bottom + 1;
        const rect = el.getBoundingClientRect().toJSON(), linkRect = link.getBoundingClientRect().toJSON();
        return { validTarget: true, foreground: fg, background: bg, flat,
          opaque: fg.length >= 3 && bg.length >= 3 && (fg[3] ?? 1) === 1 && (bg[3] ?? 1) === 1,
          contrastRatio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), clip, rect, linkRect,
          clipped: !inside(rect) || !inside(linkRect) };
      }, node.target[0]);
      assert.ok(state.validTarget && state.flat && state.opaque && state.clipped && state.contrastRatio >= 4.5,
        `unresolved contrast review: ${JSON.stringify({ target: node.target, state })}`);
      witnesses.push({ target: node.target, ...state });
    }
  }
  return witnesses;
};
try {
  if (suite === 'full') for (const route of routes) for (const width of widths) for (const theme of ['light', 'dark']) {
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
        item.citationMarkup = await page.locator('[data-journal-source-navigation]').evaluate((article) => {
          const links = [...article.querySelectorAll('a[href^="#src-"], a[href^="#history-source-"]')];
          const sources = [...article.querySelectorAll('.bibliography-item')];
          return { count: links.length, ids: links.map((link) => link.id),
            allMarked: links.every((link) => link.hasAttribute('data-journal-citation') && Boolean(link.id)),
            sources: sources.length, returns: article.querySelectorAll('[data-journal-source-return]').length,
            oneReturnPerSource: sources.every((source) => source.querySelectorAll('[data-journal-source-return]').length === 1) };
        });
        assert.ok(item.citationMarkup.count > 0 && item.citationMarkup.allMarked);
        assert.equal(new Set(item.citationMarkup.ids).size, item.citationMarkup.count);
        assert.equal(item.citationMarkup.returns, item.citationMarkup.sources);
        assert.equal(item.citationMarkup.oneReturnPerSource, true);
        item.citationRoundTrip = await sourceRoundTrip(page, citationFor(page, route.kind), theme === 'light');
        if ([390, 1440].includes(width)) {
          await shot(page, `${route.kind}-body-${width}-${theme}`);
          item.repeatedSourceRoundTrip = await sourceRoundTrip(page, citationFor(page, route.kind, true), theme !== 'light', async (source) => {
            assert.equal(await source.locator('h3').isVisible(), true, 'citation must land on an always-visible title');
            await shot(page, `${route.kind}-sources-${width}-${theme}`);
            item.citationAxe = await audit(page);
            assert.deepEqual(item.citationAxe.violations, []);
            assert.deepEqual(item.citationAxe.incomplete, []);
            if (route.kind === 'dossier') {
              const disclosure = source.locator('details');
              await disclosure.locator('summary').focus(); await page.keyboard.press('Space');
              assert.equal(await disclosure.evaluate((el) => el.open), true);
              assert.equal(await disclosure.locator('.biblio-links').isVisible(), true);
            }
          });
          assert.equal(item.repeatedSourceRoundTrip.source, item.citationRoundTrip.source);
          assert.notEqual(item.repeatedSourceRoundTrip.id, item.citationRoundTrip.id);
          await shot(page, `${route.kind}-returned-${width}-${theme}`);
        }
      }
      assert.deepEqual(item.runtime, [], 'unexpected runtime/network errors');
      console.log(`PASS ${route.kind} ${width} ${theme}`);
    } catch (error) {
      item.failure = error.message; item.stack = error.stack; report.problems.push(`${route.kind} ${width} ${theme}: ${error.message}`);
      console.error(`FAIL ${route.kind} ${width} ${theme}: ${error.message.slice(0, 280)}`);
    } finally { report.cases.push(item); await context.close(); }
  }
  if (suite === 'full') for (const route of routes) {
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
      if (route.kind !== 'journal') {
        const citationId = await citationFor(page, route.kind).getAttribute('id');
        const sourceHash = await citationFor(page, route.kind).getAttribute('href');
        // A copied citation URL is tested in a genuinely new tab, not a
        // same-document goto (no response) or artificial about:blank detour.
        const bookmark = await context.newPage();
        monitorRuntime(bookmark, result.runtime, { isIgnoredConsole: (_, message) => !['error', 'warning'].includes(message.type()) });
        await ready(bookmark, `${route.url}#${citationId}`); await settle(bookmark);
        const citation = citationFor(bookmark, route.kind);
        assert.equal(await citation.evaluate((el) => el === document.activeElement), true);
        await citation.click(); await settle(bookmark);
        const back = bookmark.locator(`${sourceHash} [data-journal-source-return]`);
        const expected = `#${citationId}`;
        assert.equal(await back.getAttribute('href'), expected);
        // Modified/middle activation must not retarget the original tab's return.
        result.ignoredModifiedCitations = await citationFor(bookmark, route.kind, true).evaluate((link) => {
          const variants = [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }];
          return variants.map((modifiers) => {
            const cancelDefault = (event) => event.preventDefault();
            document.addEventListener('click', cancelDefault, { once: true });
            link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...modifiers }));
            const source = document.getElementById(link.hash.slice(1));
            return source.querySelector('[data-journal-source-return]').getAttribute('href');
          });
        });
        assert.deepEqual(result.ignoredModifiedCitations, Array(5).fill(expected));
        await bookmark.goBack(); await settle(bookmark);
        assert.equal(new URL(bookmark.url()).hash, expected);
        await bookmark.goForward(); await settle(bookmark);
        assert.equal(new URL(bookmark.url()).hash, sourceHash);
        assert.equal(await back.getAttribute('href'), expected);
        result.nativeCitationBackForward = true;
        const fallback = route.kind === 'dossier' ? '#documents' : '#g3-history';
        await bookmark.reload({ waitUntil: 'networkidle' }); await settle(bookmark);
        assert.equal(await back.getAttribute('href'), fallback, 'reload must use its honest SSR fallback, not stale cross-load state');
        const direct = await context.newPage();
        await ready(direct, route.url + sourceHash);
        assert.equal(await direct.locator(`${sourceHash} [data-journal-source-return]`).getAttribute('href'), fallback);
        await direct.close();
        result.stableCitationBookmarkAndDirectSourceFallback = true;
        await bookmark.close();
      }
      await page.emulateMedia({ media: 'print' });
      assert.equal(await page.locator('.je-masthead').isVisible(), false);
      if (route.kind !== 'journal') {
        assert.equal(await page.locator('.je-editorial-rail').isVisible(), false);
        assert.equal(await page.locator('[data-journal-source-return]').evaluateAll((links) => links.every((link) => getComputedStyle(link).display === 'none')), true, 'paper must not contain screen-only return controls');
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
    } catch (error) { result.failure = error.message; result.stack = error.stack; report.problems.push(`${route.kind} interaction: ${error.message}`); }
    finally { await context.close(); report.interactions.push(result); }
    const noJs = await contextFor(390, 'light', { javaScriptEnabled: false });
    try {
      const p = await noJs.newPage(); await ready(p, route.url);
      const layout = await inspect(p);
      assert.equal(layout.documentOverflow, 0); assert.deepEqual(layout.overflow, []);
      assert.equal(await p.locator('h1').isVisible(), true);
      if (route.kind !== 'journal') {
        assert.equal(await p.locator('[data-journal-contents] a').first().isVisible(), true);
        await p.locator('[data-journal-contents] a').first().click(); await settleWithoutScripts(p);
        assert.ok(new URL(p.url()).hash.length > 1);
        const citation = citationFor(p, route.kind);
        assert.ok(await citation.getAttribute('id'), 'stable citation IDs must not depend on JavaScript');
        const sourceHash = await citation.getAttribute('href');
        await citation.click(); await settleWithoutScripts(p);
        const back = p.locator(`${sourceHash} [data-journal-source-return]`);
        const fallback = route.kind === 'dossier' ? '#documents' : '#g3-history';
        assert.equal(await back.getAttribute('href'), fallback);
        assert.equal(await back.getAttribute('aria-label'), null, 'no-JS must not promise a remembered exact citation');
        await back.click(); await settleWithoutScripts(p);
        assert.equal(new URL(p.url()).hash, fallback);
        assert.equal(await p.locator(fallback).evaluate((el) => el === document.activeElement), true);
        result.noJsSourceFallback = { source: sourceHash, destination: fallback };
      }
      result.noJsReadingAndAnchors = true;
    } catch (error) { report.problems.push(`${route.kind} no-JS: ${error.message}`); }
    finally { await noJs.close(); }
  }
  // The same native disclosure must remain usable when desktop width no longer
  // implies desktop height. Exercise the actual scroll container, not forced clicks.
  if (['full', 'short'].includes(suite)) for (const route of routes.filter((route) => route.kind !== 'journal'))
    for (const width of widths.filter((width) => width >= 1024)) for (const height of shortHeights)
      for (const theme of ['light', 'dark']) for (const javaScriptEnabled of [true, false]) {
        const context = await contextFor(width, theme, { viewport: { width, height }, javaScriptEnabled });
        const page = await context.newPage();
        const item = { kind: route.kind, width, height, theme, javaScriptEnabled, runtime: [] };
        const name = `${route.kind}-short-${width}x${height}-${theme}-${javaScriptEnabled ? 'js' : 'nojs'}`;
        monitorRuntime(page, item.runtime, { isIgnoredConsole: (_, message) => !['error', 'warning'].includes(message.type()) });
        const rail = page.locator('.je-editorial-rail');
        const toc = page.locator('[data-journal-contents]');
        const summary = toc.locator('summary');
        const last = toc.locator('li:last-child a');
        const middle = page.locator(route.kind === 'dossier' ? '#finance' : '#g3-growth');
        const railState = () => rail.evaluate((el) => ({ y: scrollY, rect: el.getBoundingClientRect().toJSON(),
          clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, scrollTop: el.scrollTop,
          horizontalOverflow: el.scrollWidth - el.clientWidth, overflow: getComputedStyle(el).overflowY,
          clearance: { top: parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop),
            bottom: parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom) },
          paper: getComputedStyle(el).getPropertyValue('--je-paper').trim() }));
        try {
          await ready(page, route.url);
          await middle.scrollIntoViewIfNeeded(); await settleWithoutScripts(page);
          item.before = await railState();
          assert.ok(item.before.rect.top >= item.before.clearance.top - 1 && item.before.rect.bottom <= height - item.before.clearance.bottom + 1,
            `sticky rail exceeds the document's focus-safe viewport: ${JSON.stringify(item.before)}`);
          assert.equal(item.before.horizontalOverflow, 0);
          assert.ok(item.before.scrollHeight > item.before.clientHeight, 'short desktop rail must have a native scroll range');
          await rail.hover({ position: { x: 80, y: 80 } });
          await page.mouse.wheel(0, 1500); await page.waitForTimeout(160);
          item.afterWheel = await railState();
          assert.ok(item.afterWheel.scrollTop > 0, 'wheel must reveal the end of the rail');
          assert.ok(Math.abs(item.afterWheel.y - item.before.y) < 1, 'scrolling the rail must not displace the reading position');
          const links = await rail.locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
          const focused = async (expected) => {
            const state = await rail.evaluate((el) => {
              const active = document.activeElement, style = getComputedStyle(active);
              return { href: active.getAttribute('href'), inside: el.contains(active), y: scrollY,
                rect: active.getBoundingClientRect().toJSON(), clip: el.getBoundingClientRect().toJSON(),
                scrollbar: el.offsetWidth - el.clientWidth,
                outline: (parseFloat(style.outlineWidth) || 0) + (parseFloat(style.outlineOffset) || 0),
                focusVisible: active.matches(':focus-visible') };
            });
            assert.equal(state.inside, true); assert.equal(state.href, expected);
            assert.equal(state.focusVisible, true, 'keyboard focus must have a visible indicator');
            assert.ok(state.outline >= 2, 'the focus-visible state must actually paint an outline');
            assert.ok(state.rect.top - state.outline >= state.clip.top - 1 && state.rect.bottom + state.outline <= state.clip.bottom + 1,
              `vertical focus outline clipped: ${JSON.stringify(state)}`);
            assert.ok(state.rect.left - state.outline >= state.clip.left - 1 && state.rect.right + state.outline <= state.clip.right - state.scrollbar + 1,
              `horizontal focus outline clipped: ${JSON.stringify(state)}`);
            assert.ok(Math.abs(state.y - item.before.y) < 1, 'native Tab traversal must scroll the rail, not the article');
            return { href: state.href, y: state.rect.top, bottom: state.rect.bottom, outline: state.outline };
          };
          await summary.focus();
          item.keyboardForward = [];
          for (const href of links) { await page.keyboard.press('Tab'); item.keyboardForward.push(await focused(href)); }
          if (width === 1440 && height === 480) {
            await shot(page, name);
            if (javaScriptEnabled) {
              item.axe = await audit(page);
              assert.deepEqual(item.axe.violations, []); assert.deepEqual(item.axe.incomplete, []);
            }
          }
          item.keyboardBackward = [];
          for (const href of links.slice(0, -1).reverse()) { await page.keyboard.press('Shift+Tab'); item.keyboardBackward.push(await focused(href)); }
          await page.keyboard.press('Shift+Tab');
          assert.equal(await summary.evaluate((el) => el === document.activeElement), true);
          // Native focus may leave the 2px disclosure border scrolled away.
          // Require the entire summary outline + a stable article, not scrollTop=0.
          item.summaryReturn = await focused(null);
          item.summaryScrollTop = (await railState()).scrollTop;
          await rail.hover({ position: { x: 80, y: 80 } });
          await page.mouse.wheel(0, 1500); await page.waitForTimeout(160);
          const href = await last.getAttribute('href');
          const lastRect = await last.boundingBox();
          assert.ok(lastRect.y >= 0 && lastRect.y + lastRect.height <= height, 'last TOC entry must be visible before pointer activation');
          await last.click(); await settleWithoutScripts(page);
          assert.equal(new URL(page.url()).hash, href);
          assert.equal(await page.locator(href).evaluate((el) => el === document.activeElement), true);
          item.nativeTarget = await page.locator(href).evaluate((el) => ({ id: el.id, y: el.getBoundingClientRect().top }));
          assert.ok(item.nativeTarget.y >= 25 && item.nativeTarget.y < height / 2, 'native section heading must stay visible');
          if (width === 1440 && height === 480 && theme === 'light') {
            await page.setViewportSize({ width: 844, height: 390 }); await settleWithoutScripts(page);
            item.mobileResize = await rail.evaluate((el) => ({ overflow: getComputedStyle(el).overflowY,
              maxHeight: getComputedStyle(el).maxHeight, position: getComputedStyle(el).position }));
            assert.equal(item.mobileResize.overflow, 'visible'); assert.equal(item.mobileResize.maxHeight, 'none');
            assert.equal(item.mobileResize.position, javaScriptEnabled ? 'sticky' : 'static');
            assert.equal(await toc.evaluate((el) => el.open), !javaScriptEnabled);
            if (javaScriptEnabled) await summary.click();
            await last.click(); await settleWithoutScripts(page);
            assert.equal(new URL(page.url()).hash, href);
            assert.equal(await page.locator(href).evaluate((el) => el === document.activeElement), true);
            assert.equal(await toc.evaluate((el) => el.open), !javaScriptEnabled);
            const layout = await inspect(page);
            assert.equal(layout.documentOverflow, 0); assert.deepEqual(layout.overflow, []);
            await shot(page, `${route.kind}-resize-844x390-${javaScriptEnabled ? 'js' : 'nojs'}`);
            await page.setViewportSize({ width: 1440, height: 1080 });
            await middle.scrollIntoViewIfNeeded(); await settleWithoutScripts(page);
            item.tallResize = await railState();
            assert.equal(await toc.evaluate((el) => el.open), true);
            assert.equal(item.tallResize.scrollHeight, item.tallResize.clientHeight, 'tall window must not get an unnecessary scroll range');
            assert.equal(item.tallResize.scrollTop, 0);
            await rail.hover({ position: { x: 80, y: 80 } });
            await page.mouse.wheel(0, 200); await settleWithoutScripts(page);
            assert.ok((await railState()).y > item.tallResize.y + 100, 'native wheel must still reach the article when the rail fits');
          }
          assert.deepEqual(item.runtime, []);
          console.log(`PASS ${name}`);
        } catch (error) {
          item.failure = error.message; item.stack = error.stack; report.problems.push(`${name}: ${error.message}`);
          console.error(`FAIL ${name}: ${error.message.slice(0, 280)}`);
          await shot(page, `${name}-failure`).catch(() => {});
        } finally { report.shortViewports.push(item); await context.close(); }
      }
  // Compact TOC has its own scrollport. Real native Tab must leave room for
  // the painted outline, not merely the link's border box. Sample from the
  // driver so no-JS and smooth-scroll/transform transitions actually settle.
  if (['full', 'mobile'].includes(suite)) for (const route of routes.filter((route) => route.kind !== 'journal'))
    for (const width of mobileWidths) for (const height of mobileHeights)
      for (const theme of ['light', 'dark']) for (const javaScriptEnabled of [true, false]) {
        const context = await contextFor(width, theme, { viewport: { width, height }, javaScriptEnabled });
        const page = await context.newPage();
        const item = { kind: route.kind, width, height, theme, javaScriptEnabled, runtime: [] };
        const name = `${route.kind}-mobile-${width}x${height}-${theme}-${javaScriptEnabled ? 'js' : 'nojs'}`;
        monitorRuntime(page, item.runtime, { isIgnoredConsole: (_, message) => !['error', 'warning'].includes(message.type()) });
        const toc = page.locator('[data-journal-contents]'), summary = toc.locator('summary'), nav = toc.locator('nav');
        const selected = [390, 844].includes(width);
        const settleMobile = async () => {
          let previous, stable = 0;
          for (let attempt = 0; attempt < 90; attempt++) {
            const current = await toc.evaluate((el) => [scrollY, el.querySelector('nav').scrollTop,
              el.getBoundingClientRect().top, document.querySelector('.mcp-top')?.getBoundingClientRect().bottom ?? 0]);
            stable = previous && current.every((value, i) => Math.abs(value - previous[i]) < .5) ? stable + 1 : 0;
            if (stable >= 5) return;
            previous = current;
            await page.waitForTimeout(50);
          }
          throw new Error('native compact-TOC/root/header scrolling did not settle');
        };
        const focused = async (expected) => {
          await settleMobile();
          const state = await toc.evaluate((el) => {
            const active = document.activeElement, style = getComputedStyle(active), nav = el.querySelector('nav');
            const r = nav.getBoundingClientRect(), header = document.querySelector('.mcp-top');
            const headerRect = header?.getBoundingClientRect(), headerStyle = header && getComputedStyle(header);
            return { href: active.getAttribute('href'), inside: el.contains(active), rect: active.getBoundingClientRect().toJSON(),
              clip: { left: r.left + nav.clientLeft, right: r.left + nav.clientLeft + nav.clientWidth,
                top: r.top + nav.clientTop, bottom: r.top + nav.clientTop + nav.clientHeight },
              scrollbar: nav.offsetWidth - nav.clientWidth, scrollTop: nav.scrollTop, y: scrollY,
              usableViewportWidth: document.documentElement.clientWidth,
              outline: Math.max(0, (parseFloat(style.outlineWidth) || 0) + (parseFloat(style.outlineOffset) || 0)),
              outlineWidth: parseFloat(style.outlineWidth) || 0, outlineOffset: parseFloat(style.outlineOffset) || 0,
              outlineStyle: style.outlineStyle,
              textRects: active.matches('summary') ? (() => {
                const walker = document.createTreeWalker(active, NodeFilter.SHOW_TEXT), rects = [];
                while (walker.nextNode()) if (walker.currentNode.textContent.trim()) {
                  const range = document.createRange(); range.selectNodeContents(walker.currentNode);
                  rects.push(...[...range.getClientRects()].map((r) => r.toJSON()));
                }
                return rects;
              })() : [],
              focusVisible: active.matches(':focus-visible'),
              headerBottom: headerStyle?.display !== 'none' && headerStyle?.visibility !== 'hidden' && Number(headerStyle?.opacity) > 0
                ? Math.max(0, headerRect.bottom) : 0 };
          });
          assert.equal(state.inside, true); assert.equal(state.href, expected);
          assert.equal(state.focusVisible, true);
          assert.ok(state.outlineWidth >= 2 && state.outlineStyle === 'solid', 'the indicator must really paint, even when fully inset');
          const { rect: r, outline: o, clip: c } = state;
          const inset = Math.max(0, -state.outlineOffset);
          assert.ok(state.textRects.every((text) => text.left >= r.left + inset - 1 && text.right <= r.right - inset + 1
            && text.top >= r.top + inset - 1 && text.bottom <= r.bottom - inset + 1), 'an inset summary indicator must not cover text');
          assert.ok(r.left - o >= -1 && r.right + o <= state.usableViewportWidth + 1 && r.top - o >= state.headerBottom - 1 && r.bottom + o <= height + 1,
            `focus outline outside usable viewport / under visible shared header: ${JSON.stringify(state)}`);
          if (expected !== null) {
            assert.ok(r.left - o >= c.left - 1 && r.right + o <= c.right + 1 && r.top - o >= c.top - 1 && r.bottom + o <= c.bottom + 1,
              `compact nav clips the focus outline: ${JSON.stringify(state)}`);
            if (visibleScrollbars) assert.ok(state.scrollbar > 0, 'visible-scrollbar run needs a real native gutter');
          }
          return state;
        };
        try {
          const response = await ready(page, route.url);
          if (route.kind === 'history') {
            assert.match(response.headers()['x-robots-tag'] || '', /noindex/);
            assert.equal(await page.locator('link[rel="canonical"]').count(), 0);
            assert.ok(await page.locator('[data-research-publication-status="PUBLICATION_HOLD"]').count() > 0);
          }
          assert.equal(await page.locator('[data-journal-contents]').count(), 1);
          assert.equal(await toc.evaluate((el) => el.open), !javaScriptEnabled);
          await summary.focus();
          item.summaryEntry = await focused(null);
          if (!javaScriptEnabled) { await page.keyboard.press('Space'); assert.equal(await toc.evaluate((el) => el.open), false); }
          await page.keyboard.press('Enter'); assert.equal(await toc.evaluate((el) => el.open), true);
          await settleMobile();
          await page.locator(route.kind === 'dossier' ? '#finance' : '#g3-growth').scrollIntoViewIfNeeded();
          await settleMobile();
          const links = await nav.locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
          item.keyboardForward = [];
          for (const [index, href] of links.entries()) {
            await page.keyboard.press('Tab'); item.keyboardForward.push(await focused(href));
            if (selected && (index === 0 || index === links.length - 1)) await shot(page, `${name}-${index === 0 ? 'first' : 'last'}`);
          }
          item.keyboardBackward = [];
          for (const href of links.slice(0, -1).reverse()) {
            await page.keyboard.press('Shift+Tab'); item.keyboardBackward.push(await focused(href));
          }
          await page.keyboard.press('Shift+Tab'); item.summaryReturn = await focused(null);
          if (selected) await shot(page, `${name}-summary`);
          await page.keyboard.press('Escape');
          assert.equal(await toc.evaluate((el) => el.open), !javaScriptEnabled, 'Escape belongs to the existing JS adapter, not native no-JS details');
          assert.equal(await summary.evaluate((el) => el === document.activeElement), true);
          await page.keyboard.press('Space'); assert.equal(await toc.evaluate((el) => el.open), javaScriptEnabled);
          if (!javaScriptEnabled) await page.keyboard.press('Enter');
          assert.equal(await toc.evaluate((el) => el.open), true);
          if (selected && javaScriptEnabled) {
            item.axe = await audit(page);
            assert.deepEqual(item.axe.violations, []);
            item.clippedContrastReview = await reviewClippedContrast(page, item.axe.incomplete);
          }
          for (const href of links) await page.keyboard.press('Tab');
          item.lastActivation = await focused(links.at(-1));
          await page.keyboard.press('Enter'); await settleMobile();
          assert.equal(new URL(page.url()).hash, links.at(-1));
          assert.equal(await toc.evaluate((el) => el.open), !javaScriptEnabled);
          assert.equal(await page.locator(links.at(-1)).evaluate((el) => el === document.activeElement), true);
          item.nativeTarget = await page.locator(links.at(-1)).evaluate((el) => ({ id: el.id, y: el.getBoundingClientRect().top }));
          assert.ok(item.nativeTarget.y >= 25 && item.nativeTarget.y < height - 25, 'last native target must remain on screen');
          item.layout = await inspect(page);
          // A classic root scrollbar makes scrollWidth - innerWidth = -15px.
          // Compare against the actual usable viewport; never hide positive
          // overflow by calling the legitimate gutter a product failure.
          item.viewport = await page.evaluate(() => ({ outerWidth: innerWidth,
            usableWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
          assert.equal(item.viewport.scrollWidth, item.viewport.usableWidth);
          assert.deepEqual(item.layout.overflow, []);
          assert.deepEqual(item.runtime, []);
          console.log(`PASS ${name}`);
        } catch (error) {
          item.failure = error.message; item.stack = error.stack; report.problems.push(`${name}: ${error.message}`);
          console.error(`FAIL ${name}: ${error.message.slice(0, 280)}`);
          await shot(page, `${name}-failure`).catch(() => {});
        } finally { report.mobileFocus.push(item); await context.close(); }
      }
  if (['full', 'print'].includes(suite) && engine === 'chromium') {
    const printDirectory = path.join(output, 'print');
    fs.mkdirSync(printDirectory, { recursive: true });
    // Fresh contexts retain real JS/no-JS behavior and browser color preference.
    // DOM checks cannot see page breaks; the separate analyzer reads these PDFs.
    for (const route of routes) for (const paper of ['A4', 'Letter'])
      for (const theme of ['light', 'dark']) for (const javaScriptEnabled of [true, false]) {
        const context = await contextFor(1440, theme, { javaScriptEnabled });
        const page = await context.newPage();
        const name = `${route.kind}-${paper}-${theme}-${javaScriptEnabled ? 'js' : 'nojs'}`;
        const item = { kind: route.kind, paper, theme, javaScriptEnabled, pdf: path.join(printDirectory, `${name}.pdf`), runtime: [] };
        monitorRuntime(page, item.runtime, { isIgnoredConsole: (_, message) => !['error', 'warning'].includes(message.type()) });
        try {
          const response = await ready(page, route.url);
          if (route.kind === 'history') {
            assert.match(response.headers()['x-robots-tag'] || '', /noindex/);
            assert.equal(await page.locator('link[rel="canonical"]').count(), 0);
            assert.ok(await page.locator('[data-research-publication-status="PUBLICATION_HOLD"]').count() > 0);
          }
          await page.emulateMedia({ media: 'print' });
          item.dom = await page.evaluate(() => {
            const next = document.querySelector('.je-next-story');
            const title = next?.querySelector('a').cloneNode(true);
            title?.querySelectorAll('[aria-hidden]').forEach((element) => element.remove());
            const normalize = (element) => element.textContent.replace(/\s+/gu, ' ').trim();
            return { heading: normalize(document.querySelector('h1')),
              sourceTitles: [...document.querySelectorAll('.bibliography-item h3')].map(normalize),
              companion: next ? { label: normalize(next.querySelector('p')), title: normalize(title), breakInside: getComputedStyle(next).breakInside } : null,
              reviewWarning: document.querySelector('.je-review-note') ? normalize(document.querySelector('.je-review-note')) : null,
              // The shared skip link is off-canvas, not display:none; prove its
              // omission from actual PDF text instead of assuming its CSS owner.
              screenOnlyLabels: [...new Set([...document.querySelectorAll('.skip-link, [data-journal-source-return]')].map(normalize))],
              screenControlsHidden: [...document.querySelectorAll('.je-masthead, .je-editorial-rail, .je-source-return')].every((element) => getComputedStyle(element).display === 'none'),
              paper: getComputedStyle(document.querySelector('.journal-edition')).getPropertyValue('--je-paper').trim() };
          });
          assert.equal(item.dom.screenControlsHidden, true, 'print must omit only screen navigation, not bibliography');
          assert.equal(item.dom.paper, '#fff', 'print must use white paper in either browser preference');
          await page.pdf({ path: item.pdf, format: paper, printBackground: true,
            margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' } });
          assert.deepEqual(item.runtime, []);
        } catch (error) {
          item.failure = error.message; item.stack = error.stack;
          report.problems.push(`${name} print capture: ${error.message}`);
        } finally { report.printCases.push(item); await context.close(); }
      }
    const capture = path.join(printDirectory, 'capture.json');
    fs.writeFileSync(capture, JSON.stringify({ head: report.head, worktree: report.worktree, sourceSha256: report.sourceSha256,
      engine, version: report.version, cases: report.printCases }, null, 2) + '\n');
    const analyzerArgs = [path.join(root, 'scripts/lib/journal-print-pdf.py'), '--capture', capture, '--output', path.join(printDirectory, 'pagination.json')];
    if (args['print-baseline']) analyzerArgs.push('--baseline', path.resolve(root, args['print-baseline']));
    const analysis = spawnSync(args['pdf-python'] || 'python3', analyzerArgs, { cwd: root, encoding: 'utf8' });
    report.printAnalysis = { executable: args['pdf-python'] || 'python3', args: analyzerArgs, exit: analysis.status,
      signal: analysis.signal, stdout: analysis.stdout, stderr: analysis.stderr, error: analysis.error?.message ?? null };
    console.log(analysis.stdout || '');
    if (analysis.stderr) console.error(analysis.stderr);
    if (analysis.status !== 0) report.problems.push(`actual PDF analysis exit ${analysis.status}: see print/pagination.json and printAnalysis`);
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, `browser-${engine}.json`), JSON.stringify(report, null, 2) + '\n');
}
console.log(`${report.cases.length} responsive + ${report.shortViewports.length} short-window + ${report.mobileFocus.length} mobile-focus + ${report.printCases.length} print cases; ${report.problems.length} problem(s); browser ${engine} ${report.version}`);
if (report.problems.length) { console.error(report.problems.join('\n')); process.exitCode = 1; }
