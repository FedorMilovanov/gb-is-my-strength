#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const ROOT = path.resolve(process.cwd());
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'reports', 'home-design-audit-pro');
const ENGINE = String(process.env.HOME_DESIGN_BROWSER || 'chromium').toLowerCase();
const BROWSERS = { chromium, webkit };
const browserType = BROWSERS[ENGINE];
if (!browserType) throw new Error(`Unsupported HOME_DESIGN_BROWSER=${ENGINE}`);
fs.mkdirSync(OUT, { recursive: true });

const checks = [];
const failures = [];
let fatalError = null;

function serialise(value) {
  if (value == null) return value;
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  try { return JSON.parse(JSON.stringify(value)); } catch { return String(value); }
}

function record(name, ok, detail = null) {
  const item = { name, ok: Boolean(ok), detail: serialise(detail) };
  checks.push(item);
  if (!item.ok) failures.push(item);
}

function mime(file) {
  return ({
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.xml': 'application/xml; charset=utf-8',
  })[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function resolveDist(urlValue) {
  const pathname = decodeURIComponent(new URL(urlValue || '/', 'http://127.0.0.1').pathname);
  const relative = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  const candidate = path.resolve(DIST, `.${relative}`);
  if (!(candidate === DIST || candidate.startsWith(`${DIST}${path.sep}`))) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  const index = path.join(candidate, 'index.html');
  return fs.existsSync(index) && fs.statSync(index).isFile() ? index : null;
}

async function startServer() {
  assert.ok(fs.existsSync(path.join(DIST, 'index.html')), 'dist/index.html is missing');
  const server = http.createServer((request, response) => {
    const file = resolveDist(request.url);
    response.setHeader('cache-control', 'no-store');
    if (!file) {
      response.statusCode = 404;
      response.end('Not found');
      return;
    }
    response.setHeader('content-type', mime(file));
    fs.createReadStream(file).pipe(response);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function setTheme(page, dark) {
  const changed = await page.evaluate((expected) => {
    const root = document.documentElement;
    if (root.classList.contains('dark') === expected) return false;
    const toggle = document.getElementById('themeToggle');
    if (!toggle) throw new Error('#themeToggle is missing');
    toggle.click();
    return true;
  }, dark);
  await page.waitForFunction(
    (expected) => document.documentElement.classList.contains('dark') === expected,
    dark,
    { timeout: 5000 },
  );
  if (changed) await page.waitForTimeout(100);
}

async function revealPage(page) {
  await page.evaluate(async () => {
    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const settle = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const resetHorizontalPosition = () => {
      const root = document.scrollingElement;
      if (root) root.scrollLeft = 0;
      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;
      for (const scroller of document.querySelectorAll('[data-home-routes], .h-home-routes')) {
        scroller.scrollLeft = 0;
      }
      scrollTo({ top: 0, left: 0, behavior: 'auto' });
    };

    for (const node of document.querySelectorAll('.h-reveal')) {
      node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
      await settle();
      await pause(18);
    }

    // WebKit may preserve the horizontal position chosen while revealing cards
    // inside the governed scroll-snap catalogue. Reset both the root viewport
    // and owned horizontal scrollers before any geometry is sampled.
    resetHorizontalPosition();
    await settle();
    resetHorizontalPosition();
  });
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    const root = document.scrollingElement;
    if (root) root.scrollLeft = 0;
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
    scrollTo({ top: 0, left: 0, behavior: 'auto' });
  });
  await page.waitForTimeout(40);
}

async function readViewportState(page) {
  return page.evaluate(() => {
    const rect = (node) => {
      if (!node) return null;
      const value = node.getBoundingClientRect();
      return {
        left: value.left, right: value.right, top: value.top, bottom: value.bottom,
        width: value.width, height: value.height,
      };
    };
    const style = (node) => node ? getComputedStyle(node) : null;
    const visible = (node) => Boolean(node && style(node).display !== 'none' && style(node).visibility !== 'hidden' && rect(node)?.width > 0 && rect(node)?.height > 0);
    const overlap = (a, b) => Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
    const lineCount = (node) => {
      if (!node) return 0;
      const lineHeight = Number.parseFloat(style(node).lineHeight);
      return Number.isFinite(lineHeight) && lineHeight > 0
        ? Math.max(1, Math.round(rect(node).height / lineHeight))
        : 1;
    };

    const sections = ['#issledovat', '#publikacii', '.h-about', '.h-quote-section', '.article-end-sdg-wrap', '.h-footer']
      .map((selector) => ({ selector, node: document.querySelector(selector) }))
      .map(({ selector, node }) => ({ selector, visible: visible(node), rect: rect(node) }));
    const ordered = sections.every((item, index) => index === 0 || !item.rect || !sections[index - 1].rect || item.rect.top >= sections[index - 1].rect.top);
    const headerControls = [...document.querySelectorAll('#gbSearchBtn, #themeToggle, #hMobileMenuBtn')]
      .filter(visible)
      .map((node) => ({ id: node.id, ...rect(node) }));
    const routeLabels = [...document.querySelectorAll('#issledovat .h-home-route__eyebrow, #issledovat .h-home-route__copy strong')]
      .map((node) => ({ text: node.textContent?.trim(), lines: lineCount(node), rect: rect(node), parent: rect(node.closest('.h-home-route__copy')) }));
    const publicationCards = [...document.querySelectorAll('#publikacii .h-article-card')].map((card) => {
      const title = card.querySelector('.h-article-title');
      const thumb = card.querySelector('.h-article-thumb');
      return { rect: rect(card), title: title?.textContent?.trim(), titleLines: lineCount(title), thumb: rect(thumb) };
    });
    const images = [...document.images].map((image) => ({
      src: image.currentSrc || image.src,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      rect: rect(image),
    }));
    const content = rect(document.querySelector('.home-content'));
    const footer = rect(document.querySelector('.h-footer'));
    const visibleAmbient = [...document.querySelectorAll('.h-ambient-word')].filter(visible).length;
    const searchShape = document.querySelector('#gbSearchBtn svg circle');
    const themeShape = document.querySelector(document.documentElement.classList.contains('dark') ? '#themeToggle .icon-sun circle' : '#themeToggle .icon-moon path');
    return {
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      sections,
      ordered,
      headerControls,
      routeLabels,
      publicationCards,
      images,
      content,
      footer,
      visibleAmbient,
      searchStroke: searchShape ? Number.parseFloat(style(searchShape).strokeWidth) : null,
      themeStroke: themeShape ? Number.parseFloat(style(themeShape).strokeWidth) : null,
      cardsOverlap: publicationCards.some((card, index) => publicationCards.slice(index + 1).some((other) => overlap(card.rect, other.rect))),
    };
  });
}

function judgeViewport(name, state, theme) {
  const prefix = `${ENGINE}:${name}:${theme}`;
  record(`${prefix}:no-horizontal-overflow`, !state.overflow, { scrollWidth: state.scrollWidth, width: state.width });
  record(`${prefix}:all-major-sections-visible`, state.sections.every((item) => item.visible), state.sections);
  record(`${prefix}:section-order`, state.ordered, state.sections.map((item) => [item.selector, item.rect?.top]));
  record(`${prefix}:images-decoded`, state.images.every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0), state.images.filter((image) => !image.complete || image.naturalWidth < 1));
  record(`${prefix}:publication-surfaces-do-not-overlap`, !state.cardsOverlap);
  record(`${prefix}:thin-header-icon-family`, state.searchStroke !== null && state.themeStroke !== null && state.searchStroke <= 1.2 && state.themeStroke <= 1.14 && Math.abs(state.searchStroke - state.themeStroke) <= .2, { search: state.searchStroke, theme: state.themeStroke });
  record(`${prefix}:content-within-viewport`, Boolean(state.content && state.content.left >= -1 && state.content.right <= state.width + 1), state.content);
  record(`${prefix}:footer-safe-inset`, Boolean(state.footer && state.footer.left >= 17 && state.width - state.footer.right >= 17), state.footer);

  if (state.width <= 760) {
    record(`${prefix}:mobile-route-labels-unbroken`, state.routeLabels.every((label) => label.lines === 1), state.routeLabels.filter((label) => label.lines !== 1));
    record(`${prefix}:mobile-header-targets`, state.headerControls.every((control) => control.width >= 40 && control.height >= 40), state.headerControls);
  }
  if (state.width >= 761 && state.width <= 920) {
    record(`${prefix}:tablet-publication-title-measure`, state.publicationCards.every((card) => card.titleLines <= 5), state.publicationCards.map((card) => ({ title: card.title, lines: card.titleLines })));
    record(`${prefix}:tablet-publication-stacked-art`, state.publicationCards.every((card) => card.thumb && card.rect && card.thumb.width >= card.rect.width - 36), state.publicationCards.map((card) => ({ card: card.rect?.width, thumb: card.thumb?.width })));
  }
  if (state.width >= 1480) {
    const ratio = state.content ? state.content.width / state.width : 0;
    record(`${prefix}:wide-reading-measure`, ratio >= .60 && ratio <= .76, { content: state.content?.width, viewport: state.width, ratio });
    record(`${prefix}:wide-marginalia-present`, state.visibleAmbient >= (state.width >= 1600 ? 24 : 14), { visibleAmbient: state.visibleAmbient });
  }
}

async function searchOpen(page) {
  return page.evaluate(() => {
    const node = document.querySelector('.cp-backdrop');
    return Boolean(node && node.classList.contains('is-open') && getComputedStyle(node).display !== 'none');
  });
}

async function waitSearch(page, open) {
  await page.waitForFunction((expected) => {
    const node = document.querySelector('.cp-backdrop');
    return Boolean(node && node.classList.contains('is-open') && getComputedStyle(node).display !== 'none') === expected;
  }, open, { timeout: 10000 });
}

async function openSearch(page, method) {
  await page.evaluate(() => scrollTo(0, 0));
  if (method === 'header') await page.locator('#gbSearchBtn').click();
  else if (method === 'hero') await page.locator('#heroSearchBar').click();
  else if (method === 'shortcut') await page.keyboard.press('Control+K');
  else if (method === 'menu') {
    await page.locator('#hMobileMenuBtn').click();
    await page.waitForFunction(() => document.getElementById('hMobileNav')?.classList.contains('open'));
    await page.locator('#hMobileNav [data-action="open-search"]').click();
  }
  await waitSearch(page, true);
  const input = page.locator('.cp-input');
  await input.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('.cp-input') === document.activeElement, undefined, { timeout: 5000 });
  return input;
}

async function closeSearch(page) {
  await page.locator('.cp-home-close').click();
  await waitSearch(page, false);
}

function queryStateSettled(state, query, expectedTitle = '') {
  if (!state || state.inputValue !== query || state.loading) return false;
  const titleNeedle = expectedTitle.toLocaleLowerCase('ru-RU');
  if (state.empty) {
    return !titleNeedle
      && state.optionCount === 0
      && state.selectedIds.length === 0
      && !state.activeDescendant;
  }
  if (state.optionCount < 1) return false;
  if (titleNeedle && !state.titles.some((title) => title.includes(titleNeedle))) return false;
  if (state.selectedIds.length !== 1) return false;
  if (!state.activeDescendant || state.activeDescendant !== state.selectedIds[0]) return false;
  return state.optionIds.includes(state.activeDescendant);
}

function queryStateInvalidated(state, query) {
  return Boolean(
    state
      && state.inputValue === query
      && !state.loading
      && state.optionCount === 0
      && state.selectedIds.length === 0
      && !state.activeDescendant,
  );
}

function assertQueryStateContract() {
  const settled = {
    inputValue: 'Нагорная проповедь',
    loading: false,
    empty: false,
    optionCount: 2,
    optionIds: ['cp-option-0', 'cp-option-1'],
    titles: ['нагорная проповедь — серия', 'другая статья'],
    selectedIds: ['cp-option-0'],
    activeDescendant: 'cp-option-0',
  };
  assert.equal(queryStateSettled(settled, 'Нагорная проповедь', 'Нагорная проповедь'), true);
  assert.equal(queryStateSettled({ ...settled, loading: true }, 'Нагорная проповедь', 'Нагорная проповедь'), false);
  assert.equal(queryStateSettled({ ...settled, inputValue: 'Джон Гилл' }, 'Нагорная проповедь', 'Нагорная проповедь'), false);
  assert.equal(queryStateSettled({ ...settled, titles: ['старый результат'] }, 'Нагорная проповедь', 'Нагорная проповедь'), false);
  assert.equal(queryStateSettled({ ...settled, selectedIds: [] }, 'Нагорная проповедь', 'Нагорная проповедь'), false);
  assert.equal(queryStateSettled({ ...settled, activeDescendant: 'cp-option-1' }, 'Нагорная проповедь', 'Нагорная проповедь'), false);
  assert.equal(queryStateInvalidated(settled, 'Нагорная проповедь'), false, 'stale rendered results must not satisfy invalidation');
  assert.equal(queryStateInvalidated({
    ...settled,
    optionCount: 0,
    optionIds: [],
    titles: [],
    selectedIds: [],
    activeDescendant: '',
  }, 'Нагорная проповедь'), true, 'query mutation must expose the canonical cleared interactive state');
}

assertQueryStateContract();

async function readQueryState(page) {
  return page.evaluate(() => {
    const input = document.querySelector('.cp-input');
    const options = [...document.querySelectorAll('.cp-item[role="option"]')];
    const selected = options.filter((option) => option.getAttribute('aria-selected') === 'true' || option.classList.contains('is-active'));
    return {
      inputValue: input?.value || '',
      loading: Boolean(document.querySelector('.cp-loading')),
      empty: Boolean(document.querySelector('.cp-empty')),
      optionCount: options.length,
      optionIds: options.map((option) => option.id || ''),
      titles: options.map((option) => (option.querySelector('.cp-item-title')?.textContent || '').toLocaleLowerCase('ru-RU')),
      groupHeadings: [...document.querySelectorAll('.cp-group-hd > span:first-child')].map((node) => node.textContent?.trim() || ''),
      selectedIds: selected.map((option) => option.id || ''),
      activeDescendant: input?.getAttribute('aria-activedescendant') || '',
      status: document.querySelector('.cp-status')?.textContent?.trim() || '',
    };
  });
}

async function waitQuery(page, query, expectedTitle = '') {
  const deadline = Date.now() + 15000;
  let state = await readQueryState(page);
  while (Date.now() < deadline) {
    if (queryStateSettled(state, query, expectedTitle)) return state;
    await page.waitForTimeout(40);
    state = await readQueryState(page);
  }
  throw new Error(`Search query did not settle: ${JSON.stringify({ query, expectedTitle, state })}`);
}

async function fillQueryAndWait(page, input, query, expectedTitle = '') {
  await input.fill(query);
  const invalidated = await readQueryState(page);
  if (!queryStateInvalidated(invalidated, query)) {
    throw new Error(`Search query mutation did not invalidate stale results: ${JSON.stringify({ query, expectedTitle, state: invalidated })}`);
  }
  return waitQuery(page, query, expectedTitle);
}

async function searchAudit(page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await setTheme(page, false);

  for (const method of ['header', 'hero', 'shortcut']) {
    const input = await openSearch(page, method);
    record(`${ENGINE}:search-open-${method}`, await input.evaluate((node) => node === document.activeElement));
    record(`${ENGINE}:search-single-overlay-${method}`, await page.locator('.cp-backdrop').count() === 1);
    await closeSearch(page);
  }

  let input = await openSearch(page, 'header');
  record(`${ENGINE}:search-empty-state`, (await input.inputValue()) === '');
  if (ENGINE === 'chromium') await page.screenshot({ path: path.join(OUT, 'search-empty-desktop.png') });

  const allScope = page.locator('.cp-scope-chip[data-scope="all"]');
  await allScope.click();
  const queries = [
    { name: 'canonical-title', value: 'Нагорная проповедь', needle: 'Нагорная проповедь', expect: /Нагорная\s+проповедь/i },
    { name: 'scripture-reference', value: 'Иер 17:9', needle: 'Иер 17:9', expect: /Иер\s*17:9|сердц/i },
    { name: 'partial-cyrillic', value: 'герменевтик', needle: 'герменевтик', expect: /герменевтик/i },
    { name: 'trimmed-query', value: '  Джон Гилл  ', needle: 'Джон Гилл', expect: /Джон\s+Гилл/i },
  ];
  for (const query of queries) {
    await fillQueryAndWait(page, input, query.value, query.needle);
    const results = await page.locator('.cp-item').evaluateAll((items) => items.map((item) => ({
      title: item.querySelector('.cp-item-title')?.textContent?.trim() || '',
      snippet: item.querySelector('.cp-item-snippet')?.textContent?.trim() || '',
    })));
    const corpus = results.map((item) => `${item.title} ${item.snippet}`).join('\n');
    const matching = results.filter((item) => query.expect.test(`${item.title} ${item.snippet}`)).map((item) => item.title);
    record(`${ENGINE}:search-query-${query.name}`, results.length > 0 && query.expect.test(corpus), { count: results.length, first: results[0]?.title || '', matching });
  }

  const noResultQuery = 'zzzz-no-such-page-493821';
  await input.fill(noResultQuery);
  const noResultInvalidated = await readQueryState(page);
  if (!queryStateInvalidated(noResultInvalidated, noResultQuery)) {
    throw new Error(`Search no-result mutation did not invalidate stale results: ${JSON.stringify({ query: noResultQuery, state: noResultInvalidated })}`);
  }
  await page.waitForFunction((expected) => {
    const input = document.querySelector('.cp-input');
    const empty = document.querySelector('.cp-empty');
    return input?.value === expected && Boolean(empty) && !document.querySelector('.cp-loading');
  }, noResultQuery, { timeout: 15000 });
  const noResultCount = await page.locator('.cp-item').count();
  const noResultText = await page.locator('.cp-empty').textContent().catch(() => '');
  record(`${ENGINE}:search-no-results`, noResultCount === 0 && Boolean(noResultText?.trim()), { count: noResultCount, text: noResultText });
  if (ENGINE === 'chromium') await page.screenshot({ path: path.join(OUT, 'search-no-results-desktop.png') });

  await input.fill('Н');
  await input.type('агорная проповедь', { delay: 5 });
  const rapidInvalidated = await readQueryState(page);
  if (!queryStateInvalidated(rapidInvalidated, 'Нагорная проповедь')) {
    throw new Error(`Rapid search mutation did not invalidate stale results: ${JSON.stringify({ query: 'Нагорная проповедь', state: rapidInvalidated })}`);
  }
  await waitQuery(page, 'Нагорная проповедь', 'Нагорная проповедь');
  record(`${ENGINE}:search-rapid-input`, await page.locator('.cp-item').count() > 0);

  const chips = page.locator('.cp-scope-chip');
  const chipCount = await chips.count();
  record(`${ENGINE}:search-scope-count`, chipCount >= 4, chipCount);
  for (let index = 0; index < chipCount; index += 1) {
    await chips.nth(index).click();
    const selected = await chips.nth(index).evaluate((node) => node.matches('[aria-pressed="true"], [aria-selected="true"], .is-active, .active'));
    record(`${ENGINE}:search-scope-${index + 1}`, selected);
  }
  await allScope.click();

  // Force a genuinely different completed result set before re-running the
  // canonical-title query. Reusing the already-rendered query let WebKit
  // observe stale DOM during the 180 ms debounce window and made the audit
  // race the real search lifecycle instead of testing arrow navigation.
  await fillQueryAndWait(page, input, 'Джон Гилл', 'Джон Гилл');
  await fillQueryAndWait(page, input, 'Нагорная проповедь', 'Нагорная проповедь');
  const beforeArrow = await page.locator('.cp-item[aria-selected="true"], .cp-item.is-active').count();
  await page.keyboard.press('ArrowDown');
  const selectedCount = await page.locator('.cp-item[aria-selected="true"], .cp-item.is-active').count();
  record(`${ENGINE}:search-arrow-navigation`, beforeArrow === 1 && selectedCount === 1, { beforeArrow, selectedCount });

  await setTheme(page, true);
  record(`${ENGINE}:search-survives-theme-toggle`, await searchOpen(page));
  if (ENGINE === 'chromium') await page.screenshot({ path: path.join(OUT, 'search-query-desktop-dark.png') });
  await setTheme(page, false);

  await page.setViewportSize({ width: 390, height: 844 });
  record(`${ENGINE}:search-survives-live-resize`, await searchOpen(page));
  const mobileGeometry = await page.evaluate(() => {
    const dialog = document.querySelector('.cp-box')?.getBoundingClientRect();
    const row = document.querySelector('.cp-scope-row')?.getBoundingClientRect();
    return { dialog: dialog && { left: dialog.left, right: dialog.right, top: dialog.top, bottom: dialog.bottom }, row: row && { left: row.left, right: row.right } };
  });
  record(`${ENGINE}:search-mobile-safe-geometry`, Boolean(mobileGeometry.dialog && mobileGeometry.dialog.left >= 0 && mobileGeometry.dialog.right <= 390 && mobileGeometry.dialog.top >= 0 && mobileGeometry.dialog.bottom <= 845), mobileGeometry);
  if (ENGINE === 'chromium') await page.screenshot({ path: path.join(OUT, 'search-query-mobile-light.png') });

  const clear = page.locator('.cp-clear');
  await clear.click();
  record(`${ENGINE}:search-clear-control`, (await input.inputValue()) === '');
  record(`${ENGINE}:search-clear-distinct-from-close`, await clear.locator('svg').evaluate((node) => getComputedStyle(node).display === 'none').catch(() => true));

  await page.keyboard.press('Escape');
  await waitSearch(page, false);
  record(`${ENGINE}:search-escape-close`, true);

  input = await openSearch(page, 'menu');
  const menuClosed = !await page.locator('#hMobileNav').evaluate((node) => node.classList.contains('open'));
  record(`${ENGINE}:mobile-menu-to-search`, await input.evaluate((node) => node === document.activeElement) && menuClosed);
  await closeSearch(page);

  for (let cycle = 1; cycle <= 5; cycle += 1) {
    await openSearch(page, 'header');
    const single = await page.locator('.cp-backdrop').count() === 1;
    await closeSearch(page);
    const lock = await page.evaluate(() => Number(window.SiteUtils?._scrollLockCount || 0));
    record(`${ENGINE}:search-reopen-cycle-${cycle}`, single && lock === 0, { single, lock });
  }
}

async function interactionAudit(page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => scrollTo(0, 0));
  await setTheme(page, false);
  const themeToggle = page.locator('#themeToggle');
  const themeBox = await themeToggle.boundingBox();
  await themeToggle.click();
  record(`${ENGINE}:theme-real-click`, Boolean(themeBox) && await page.evaluate(() => document.documentElement.classList.contains('dark')), themeBox);
  await themeToggle.click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  const menu = page.locator('#hMobileMenuBtn');
  await menu.click();
  await page.waitForFunction(() => document.getElementById('hMobileNav')?.classList.contains('open'));
  record(`${ENGINE}:mobile-menu-opens`, await menu.getAttribute('aria-expanded') === 'true');
  record(`${ENGINE}:mobile-menu-focus-inside`, await page.evaluate(() => document.getElementById('hMobileNav')?.contains(document.activeElement)));
  if (ENGINE === 'chromium') await page.screenshot({ path: path.join(OUT, 'mobile-menu-open.png') });
  await page.keyboard.press('Escape');
  record(`${ENGINE}:mobile-menu-escape`, await menu.getAttribute('aria-expanded') === 'false');

  const word = page.locator('.h-sacred-block--hero button.h-sacred-word').first();
  await word.click();
  record(`${ENGINE}:hebrew-click-toggle`, await word.getAttribute('aria-pressed') === 'true');
  await word.focus();
  await page.keyboard.press('Enter');
  record(`${ENGINE}:hebrew-keyboard-toggle`, await word.getAttribute('aria-pressed') === 'false');

  await page.evaluate(() => scrollTo(0, 1100));
  await page.waitForTimeout(150);
  const top = page.locator('#hScrollTop');
  record(`${ENGINE}:scroll-top-visible`, await top.isVisible());
  const box = await top.boundingBox();
  record(`${ENGINE}:scroll-top-circular-target`, Boolean(box && Math.abs(box.width - box.height) < 1 && box.width >= 44), box);
  await top.click();
  await page.waitForFunction(() => Math.round(scrollY) === 0);
  record(`${ENGINE}:scroll-top-returns-home`, true);
}

async function captureFullEvidence(page) {
  if (ENGINE !== 'chromium') return;
  const scenes = [
    ['mobile', 390, 844],
    ['tablet', 820, 1180],
    ['desktop', 1280, 900],
    ['wide', 1720, 980],
  ];
  for (const [name, width, height] of scenes) {
    await page.setViewportSize({ width, height });
    await revealPage(page);
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme === 'dark');
      await page.screenshot({ path: path.join(OUT, `index-${name}-${theme}-full.png`), fullPage: true });
    }
  }
}

const viewports = [
  ['phone-320', 320, 568], ['phone-360', 360, 800], ['phone-390', 390, 844],
  ['phone-412', 412, 915], ['phone-430', 430, 932], ['small-tablet-600', 600, 960],
  ['mobile-boundary-760', 760, 900], ['desktop-boundary-761', 761, 900],
  ['tablet-820', 820, 1180], ['tablet-920', 920, 1080], ['landscape-1024', 1024, 768],
  ['laptop-1180', 1180, 820], ['desktop-1280', 1280, 900], ['laptop-1366', 1366, 768],
  ['desktop-1440', 1440, 900], ['rail-boundary-1479', 1479, 900],
  ['rail-boundary-1480', 1480, 900], ['wide-1600', 1600, 1000],
  ['wide-1720', 1720, 980], ['full-hd-1920', 1920, 1080],
];
const darkScenes = new Set([
  'phone-320', 'phone-390', 'phone-430', 'mobile-boundary-760', 'desktop-boundary-761',
  'tablet-820', 'landscape-1024', 'desktop-1280', 'rail-boundary-1480', 'wide-1720', 'full-hd-1920',
]);

let server;
let browser;
let context;
const runtimeErrors = [];
const badResponses = [];

try {
  server = await startServer();
  browser = await browserType.launch({ headless: true });
  context = await browser.newContext({ locale: 'ru-RU', colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (ENGINE === 'webkit' && text === 'Viewport argument key "interactive-widget" not recognized and ignored.') return;
    runtimeErrors.push(`console: ${text}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) badResponses.push({ status: response.status(), url: response.url() });
  });

  const response = await page.goto(`${server.url}/`, { waitUntil: 'networkidle', timeout: 60000 });
  record(`${ENGINE}:document-status`, response?.status() === 200, response?.status());
  await revealPage(page);

  const selected = ENGINE === 'chromium'
    ? viewports
    : viewports.filter(([name]) => ['phone-320', 'phone-390', 'mobile-boundary-760', 'desktop-boundary-761', 'tablet-820', 'desktop-1280', 'rail-boundary-1480', 'wide-1720'].includes(name));
  for (const [name, width, height] of selected) {
    await page.setViewportSize({ width, height });
    await setTheme(page, false);
    judgeViewport(name, await readViewportState(page), 'light');
    if (darkScenes.has(name)) {
      await setTheme(page, true);
      judgeViewport(name, await readViewportState(page), 'dark');
    }
  }

  await searchAudit(page);
  await interactionAudit(page);
  await captureFullEvidence(page);

  record(`${ENGINE}:no-runtime-errors`, runtimeErrors.length === 0, runtimeErrors);
  record(`${ENGINE}:no-broken-local-responses`, badResponses.length === 0, badResponses);
  record(`${ENGINE}:minimum-50-variants`, checks.length >= 50, checks.length);
} catch (error) {
  fatalError = serialise(error);
  record(`${ENGINE}:audit-completed-without-fatal-error`, false, fatalError);
} finally {
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  await server?.close().catch(() => {});
}

const result = {
  generatedAt: new Date().toISOString(),
  engine: ENGINE,
  fatalError,
  summary: {
    total: checks.length,
    passed: checks.filter((item) => item.ok).length,
    failed: failures.length,
  },
  checks,
};
fs.writeFileSync(path.join(OUT, `result-${ENGINE}.json`), `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync(path.join(OUT, `summary-${ENGINE}.md`), [
  `# Home Design Audit Pro — ${ENGINE}`,
  '',
  `- Total named variants: **${result.summary.total}**`,
  `- Passed: **${result.summary.passed}**`,
  `- Failed: **${result.summary.failed}**`,
  `- Fatal error: **${fatalError ? 'yes' : 'no'}**`,
  '',
  ...failures.map((item) => `- ❌ ${item.name}: \`${JSON.stringify(item.detail)}\``),
].join('\n'));

if (failures.length) {
  console.error(JSON.stringify(result.summary));
  for (const failure of failures) console.error(`FAIL ${failure.name}`, failure.detail ?? '');
  process.exitCode = 1;
} else {
  console.log(`HOME DESIGN AUDIT PRO ${ENGINE}: ${result.summary.total}/${result.summary.total} named variants PASS`);
}
