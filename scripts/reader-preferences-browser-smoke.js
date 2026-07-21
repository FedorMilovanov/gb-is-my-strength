#!/usr/bin/env node
'use strict';

const { chromium } = require('playwright');

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:8090';
const ROUTES = {
  gill: '/articles/dzhon-gill-chast-1-chelovek/',
  book: '/articles/chto-bibliya-nazyvaet-serdcem/',
  baptist: '/baptisty-rossii/dva-sezda-1884/',
  hermenevtika: '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/',
  kod: '/articles/kod-da-vinchi/',
  page: '/articles/',
  map: '/karty/avraam/',
};
const WIDTHS = [320, 360, 390, 430];
const OVERFLOW_ROUTES = [ROUTES.gill, ROUTES.book, ROUTES.hermenevtika, ROUTES.page, ROUTES.map];
const results = [];

function result(name, ok, detail = {}) {
  results.push({ name, ok, detail });
}

function visiblePaletteChanged(before, after) {
  return Boolean(before && after) && (
    before.bodyBackground !== after.bodyBackground ||
    before.bodyColor !== after.bodyColor ||
    before.surfaceBackground !== after.surfaceBackground ||
    before.surfaceColor !== after.surfaceColor
  );
}

async function seedLegacy(context) {
  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => {
    localStorage.removeItem('gb:reader-preferences:v1');
    localStorage.setItem('gb:gill-reader-theme:v1', 'sepia');
    localStorage.setItem('gb:hm-line-height:v1', 'relaxed');
    localStorage.setItem('gb:gill-measure:v1', 'wide');
    localStorage.setItem('gb:font-scale', '1.05');
    localStorage.setItem('theme', 'light');
  });
  await page.close();
}

async function openSurface(context, route, width = 390) {
  const page = await context.newPage();
  await page.setViewportSize({ width, height: 844 });
  const errors = [];
  const failed = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', (request) => failed.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'failed'}`));
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const firstPaint = await page.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-reader-theme'),
    ready: document.documentElement.style.getPropertyValue('--gb-reader-theme-ready'),
  }));
  await page.waitForFunction(() => window.GBReaderPreferences && window.GBReaderPreferences.version === 1, null, { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(220);
  return { page, errors, failed, firstPaint };
}

async function snapshot(page) {
  return page.evaluate(() => {
    const prefs = window.GBReaderPreferences?.get?.() || null;
    const html = document.documentElement;
    const gill = document.querySelector('[data-gill-v16]');
    const standalone = document.querySelector('[data-reader-root]');
    const surface = gill || standalone || document.querySelector('.page-wrap, .article-main, main') || document.body;
    const style = getComputedStyle(html);
    const bodyStyle = document.body ? getComputedStyle(document.body) : null;
    const surfaceStyle = surface ? getComputedStyle(surface) : null;
    const media = document.querySelector('img, video, canvas, .me-canvas svg');
    return {
      prefs,
      theme: html.getAttribute('data-reader-theme'),
      darkClass: html.classList.contains('dark'),
      gillTheme: gill?.getAttribute('data-gill-reader-theme') || null,
      standaloneTheme: standalone?.getAttribute('data-hm-reader-theme') || null,
      line: style.getPropertyValue('--gb-reader-line-height').trim(),
      measure: style.getPropertyValue('--gb-reader-measure').trim(),
      fontScale: style.getPropertyValue('--gb-reader-font-scale').trim(),
      canonical: localStorage.getItem('gb:reader-preferences:v1'),
      styleSheet: [...document.styleSheets].some((sheet) => String(sheet.href || '').includes('reader-preferences.css')),
      bootstrapScript: [...document.scripts].some((script) => String(script.src || '').includes('reader-preferences-head.js')),
      runtimeScript: [...document.scripts].some((script) => String(script.src || '').includes('reader-preferences.js')),
      overflow: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) - window.innerWidth,
      mediaFilter: media ? getComputedStyle(media).filter : null,
      bodyBackground: bodyStyle?.backgroundColor || null,
      bodyColor: bodyStyle?.color || null,
      surfaceBackground: surfaceStyle?.backgroundColor || null,
      surfaceColor: surfaceStyle?.color || null,
    };
  });
}

async function clickAndWait(page, selector) {
  await page.waitForSelector(selector, { state: 'attached', timeout: 12000 });
  await page.evaluate((value) => document.querySelector(value)?.click(), selector);
  await page.waitForTimeout(120);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await seedLegacy(context);

    // 1. Gill flat series: legacy migration + existing settings adapters.
    {
      const { page, errors, failed, firstPaint } = await openSurface(context, ROUTES.gill);
      const migrated = await snapshot(page);
      await clickAndWait(page, '[data-gill-theme-btn][data-theme="light"]');
      const light = await snapshot(page);
      await clickAndWait(page, '[data-gill-theme-btn][data-theme="sepia"]');
      await clickAndWait(page, '#gillLineHeightGroup [data-line="compact"]');
      await clickAndWait(page, '#gillLineHeightGroup [data-line="relaxed"]');
      await clickAndWait(page, '#gillMeasureGroup [data-measure="narrow"]');
      await clickAndWait(page, '#gillMeasureGroup [data-measure="wide"]');
      const fontBefore = Number((await page.evaluate(() => window.GBReaderPreferences.get().fontScale)) || 1);
      await clickAndWait(page, '#gillSettingsOverlay [data-fc-action="font-up"]');
      const after = await snapshot(page);
      result(
        'Gill migrates legacy preferences and existing settings write canonical state',
        errors.length === 0 && failed.length === 0 &&
          firstPaint.theme === 'sepia' && firstPaint.ready === '1' &&
          migrated.theme === 'sepia' && migrated.gillTheme === 'sepia' &&
          migrated.prefs?.lineHeight === 'relaxed' && migrated.prefs?.measure === 'wide' &&
          light.theme === 'light' && visiblePaletteChanged(light, after) &&
          after.theme === 'sepia' && after.gillTheme === 'sepia' &&
          after.prefs?.lineHeight === 'relaxed' && after.prefs?.measure === 'wide' &&
          Number(after.prefs?.fontScale) > fontBefore &&
          after.styleSheet && after.bootstrapScript && after.runtimeScript && after.overflow <= 1,
        { firstPaint, migrated, light, after, errors, failed },
      );
      await page.close();
    }

    // 2. Book-shaped series and another flat series inherit the same state.
    for (const [name, route] of [['Heart book', ROUTES.book], ['Baptist flat series', ROUTES.baptist]]) {
      const { page, errors, failed, firstPaint } = await openSurface(context, route);
      const state = await snapshot(page);
      result(
        `${name} inherits global reader state`,
        errors.length === 0 && failed.length === 0 &&
          firstPaint.theme === 'sepia' && state.theme === 'sepia' && state.gillTheme === 'sepia' &&
          state.prefs?.lineHeight === 'relaxed' && state.prefs?.measure === 'wide' &&
          Number(state.prefs?.fontScale) > 1.05 && state.overflow <= 1,
        { firstPaint, state, errors, failed },
      );
      await page.close();
    }

    // 3. Standalone article adapter receives state and can change it globally.
    {
      const { page, errors, failed, firstPaint } = await openSurface(context, ROUTES.hermenevtika);
      const before = await snapshot(page);
      await clickAndWait(page, '[data-hm-theme="dark"]');
      await clickAndWait(page, '[data-hm-line="compact"]');
      await clickAndWait(page, '[data-hm-measure="narrow"]');
      const after = await snapshot(page);
      result(
        'Standalone settings adapter reads and updates canonical state',
        errors.length === 0 && failed.length === 0 &&
          firstPaint.theme === 'sepia' && before.standaloneTheme === 'sepia' &&
          visiblePaletteChanged(before, after) &&
          after.theme === 'dark' && after.darkClass && after.standaloneTheme === null &&
          after.prefs?.lineHeight === 'compact' && after.prefs?.measure === 'narrow' && after.overflow <= 1,
        { firstPaint, before, after, errors, failed },
      );
      await page.close();
    }

    // 4. Another standalone article and an ordinary page see the update.
    for (const [name, route] of [['Kod Da Vinci standalone', ROUTES.kod], ['Articles ordinary page', ROUTES.page]]) {
      const { page, errors, failed, firstPaint } = await openSurface(context, route);
      const state = await snapshot(page);
      result(
        `${name} inherits standalone preference update`,
        errors.length === 0 && failed.length === 0 &&
          firstPaint.theme === 'dark' && state.theme === 'dark' && state.darkClass &&
          state.prefs?.lineHeight === 'compact' && state.prefs?.measure === 'narrow' && state.overflow <= 1,
        { firstPaint, state, errors, failed },
      );
      await page.close();
    }

    // 5. Ordinary page visibly renders Sepia; special media keeps its own filter.
    {
      const ordinary = await openSurface(context, ROUTES.page);
      const darkPage = await snapshot(ordinary.page);
      await ordinary.page.evaluate(() => window.GBReaderPreferences.setTheme('sepia', { source: 'browser-smoke' }));
      await ordinary.page.waitForTimeout(180);
      const sepiaPage = await snapshot(ordinary.page);
      result(
        'Ordinary page renders a visible Sepia palette',
        ordinary.errors.length === 0 && ordinary.failed.length === 0 &&
          darkPage.theme === 'dark' && sepiaPage.theme === 'sepia' &&
          visiblePaletteChanged(darkPage, sepiaPage) && sepiaPage.overflow <= 1,
        { darkPage, sepiaPage, errors: ordinary.errors, failed: ordinary.failed },
      );
      await ordinary.page.close();

      const { page, errors, failed, firstPaint } = await openSurface(context, ROUTES.map);
      await page.waitForSelector('.me-map', { timeout: 15000 });
      const state = await snapshot(page);
      const map = await page.evaluate(() => ({
        svgFilter: getComputedStyle(document.querySelector('.me-canvas svg')).filter,
        containerTheme: document.querySelector('.me-map')?.getAttribute('data-map-theme'),
      }));
      result(
        'Global Sepia reaches special page chrome without filtering map media',
        errors.length === 0 && failed.length === 0 &&
          firstPaint.theme === 'sepia' && state.theme === 'sepia' &&
          !String(map.svgFilter).includes('sepia') && state.overflow <= 1,
        { firstPaint, state, map, errors, failed },
      );
      await page.close();
    }

    // 6. Canonical Sepia survives the compatibility `theme=light` storage
    // event and remains synchronized across two simultaneously open tabs.
    {
      const left = await openSurface(context, ROUTES.page);
      const right = await openSurface(context, ROUTES.gill);
      await left.page.evaluate(() => window.GBReaderPreferences.setTheme('dark', { source: 'cross-tab-precondition' }));
      await right.page.waitForFunction(() => window.GBReaderPreferences?.get?.().theme === 'dark', null, { timeout: 8000 });
      await left.page.evaluate(() => window.GBReaderPreferences.setTheme('sepia', { source: 'cross-tab-sepia' }));
      await right.page.waitForFunction(() => window.GBReaderPreferences?.get?.().theme === 'sepia', null, { timeout: 8000 });
      await left.page.waitForTimeout(250);
      const leftState = await snapshot(left.page);
      const rightState = await snapshot(right.page);
      result(
        'Canonical Sepia remains synchronized across tabs',
        left.errors.length === 0 && right.errors.length === 0 &&
          left.failed.length === 0 && right.failed.length === 0 &&
          leftState.theme === 'sepia' && rightState.theme === 'sepia' &&
          leftState.prefs?.theme === 'sepia' && rightState.prefs?.theme === 'sepia' &&
          JSON.parse(leftState.canonical || '{}').theme === 'sepia' &&
          JSON.parse(rightState.canonical || '{}').theme === 'sepia',
        { leftState, rightState, leftErrors: left.errors, rightErrors: right.errors, leftFailed: left.failed, rightFailed: right.failed },
      );
      await left.page.close();
      await right.page.close();
    }

    // 7. Representative mobile width matrix.
    for (const width of WIDTHS) {
      for (const route of OVERFLOW_ROUTES) {
        const { page, errors, failed, firstPaint } = await openSurface(context, route, width);
        const state = await snapshot(page);
        result(
          `No horizontal overflow ${width}px ${route}`,
          errors.length === 0 && failed.length === 0 && firstPaint.ready === '1' && state.overflow <= 1,
          { width, route, firstPaint, overflow: state.overflow, errors, failed },
        );
        await page.close();
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  for (const entry of results) {
    console.log(`${entry.ok ? '✅' : '❌'} ${entry.name}: ${JSON.stringify(entry.detail)}`);
  }
  const failed = results.filter((entry) => !entry.ok);
  console.log(failed.length ? `❌ ${failed.length} reader preference witness(es) failed` : '✅ reader preference browser matrix passed');
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
