#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'reports', 'interactive-audit', 'lot-publication');
const BASE = String(process.env.AUDIT_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');
const ROUTE = '/articles/lot-i-sodom/';
const CANONICAL = 'https://gospod-bog.ru/articles/lot-i-sodom/';
const OG = 'https://gospod-bog.ru/images/articles/lot/og-lot-i-sodom.webp';
const OG_ALT = 'Две дороги расходятся в каменистой пустыне у солёного озера на рассвете — художественный образ выбора Лота.';

const FIGURES = [
  'lot-two-roads',
  'lot-jordan-plain',
  'lot-sodom-gate',
  'lot-sodom-crowd',
  'lot-judgment',
  'lot-wife-back',
  'lot-cave',
  'lot-ruth-naomi',
  'lot-remember-wife',
];

const TOC = [
  '#sec-who-is-lot',
  '#sec-canonical-verdict',
  '#sec-choice',
  '#sec-war',
  '#sec-abraham-lot',
  '#sec-sodom-night',
  '#sec-why-sodom',
  '#sec-hesitation',
  '#sec-lots-wife',
  '#sec-zoar',
  '#sec-cave',
  '#sec-moab-ammon',
  '#sec-ruth',
  '#sec-lot-legacy',
  '#sec-archaeology',
  '#sec-tall-el-hammam',
  '#sec-zoar-tradition',
  '#sec-how-to-read',
  '#sec-main-theology',
  '#sec-conclusion',
  '#sec-quiz',
  '#lot-sources-title',
];

const PROFILES = [
  { id: '390', width: 390, height: 844 },
  { id: '412', width: 412, height: 915 },
  { id: '1024', width: 1024, height: 768 },
  { id: '1366', width: 1366, height: 900 },
];
const THEMES = ['light', 'dark'];
const ENGINES = [
  ['chromium', chromium],
  ['webkit', webkit],
];
const RAW_HEIGHT_BY_WIDTH = new Map([[600, 338], [900, 507], [1200, 675]]);

fs.mkdirSync(OUT, { recursive: true });
const results = [];
const failures = [];

function record(engine, profile, theme, contract, ok, detail = '') {
  const row = { engine, profile, theme, contract, ok: Boolean(ok), detail: String(detail || '') };
  results.push(row);
  if (!ok) failures.push(`${engine}/${profile}/${theme}/${contract}: ${detail}`);
}

function ignoredConsole(text) {
  return /mc\.yandex|ERR_BLOCKED_BY_CLIENT|Failed to load resource|Load failed|interactive-widget.*ignored/i.test(text);
}

async function structuralSnapshot(page) {
  return page.evaluate(async ({ figures, toc, canonical, og, ogAlt }) => {
    const root = document.documentElement;
    const article = document.querySelector('article.article-body[data-pagefind-body]');

    async function rawResourceSize(src) {
      if (!src) return { width: 0, height: 0, error: 'missing currentSrc' };
      return new Promise((resolve) => {
        const probe = new Image();
        let settled = false;
        const finish = (payload) => {
          if (settled) return;
          settled = true;
          resolve(payload);
        };
        probe.onload = () => finish({ width: Number(probe.naturalWidth || 0), height: Number(probe.naturalHeight || 0), error: '' });
        probe.onerror = () => finish({ width: 0, height: 0, error: `failed to load ${src}` });
        probe.src = src;
        if (probe.complete && probe.naturalWidth) {
          finish({ width: Number(probe.naturalWidth), height: Number(probe.naturalHeight), error: '' });
        }
      });
    }

    const figureRows = await Promise.all([...document.querySelectorAll('[data-lot-figure]')].map(async (figure) => {
      const name = figure.getAttribute('data-lot-figure') || '';
      const img = figure.querySelector('img');
      const source = figure.querySelector('source[type="image/webp"]');
      const caption = (figure.querySelector('figcaption')?.textContent || '').replace(/\s+/g, ' ').trim();
      const rect = figure.getBoundingClientRect();
      const currentSrc = img?.currentSrc || '';
      const rawSize = await rawResourceSize(currentSrc);
      return {
        name,
        alt: (img?.getAttribute('alt') || '').trim(),
        caption,
        src: img?.getAttribute('src') || '',
        srcset: source?.getAttribute('srcset') || '',
        sizes: source?.getAttribute('sizes') || '',
        currentSrc,
        complete: Boolean(img?.complete),
        slotNaturalWidth: Number(img?.naturalWidth || 0),
        slotNaturalHeight: Number(img?.naturalHeight || 0),
        rawNaturalWidth: rawSize.width,
        rawNaturalHeight: rawSize.height,
        rawError: rawSize.error,
        rect: { left: rect.left, right: rect.right, width: rect.width },
      };
    }));

    const svgRows = [
      ['family', 'lot-family-title', 'lot-family-desc'],
      ['journey', 'lot-journey-title', 'lot-journey-desc'],
    ].map(([name, titleId, descId]) => {
      const title = document.getElementById(titleId);
      const desc = document.getElementById(descId);
      const svg = title?.closest('svg');
      const rect = svg?.getBoundingClientRect();
      return {
        name,
        role: svg?.getAttribute('role') || '',
        labelledby: svg?.getAttribute('aria-labelledby') || '',
        title: (title?.textContent || '').trim(),
        desc: (desc?.textContent || '').trim(),
        width: rect?.width || 0,
        left: rect?.left || 0,
        right: rect?.right || 0,
      };
    });

    const tables = [...document.querySelectorAll('table.compare-table')].map((table) => ({
      label: table.getAttribute('aria-label') || '',
      rows: table.querySelectorAll('tbody tr').length,
      headers: [...table.querySelectorAll('thead th')].map((node) => (node.textContent || '').trim()),
    }));

    const ids = [...document.querySelectorAll('[id]')].map((node) => node.id).filter(Boolean);
    const idCounts = new Map();
    for (const id of ids) idCounts.set(id, (idCounts.get(id) || 0) + 1);
    const duplicateIds = [...idCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id).sort();

    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((node) => {
        try { return JSON.parse(node.textContent || '{}'); } catch { return null; }
      })
      .filter(Boolean);
    const graph = jsonLd.flatMap((item) => Array.isArray(item?.['@graph']) ? item['@graph'] : [item]);
    const articleLd = graph.find((item) => item?.['@type'] === 'Article') || null;
    const webSiteLd = graph.find((item) => item?.['@type'] === 'WebSite') || null;

    return {
      title: document.title,
      h1: [...document.querySelectorAll('h1')].map((node) => (node.textContent || '').trim()),
      articleCount: document.querySelectorAll('article.article-body[data-pagefind-body]').length,
      articleTextLength: (article?.innerText || '').trim().length,
      bookmarkSelector: window.SITE_CONFIG?.features?.bookmarks?.articleSelector || null,
      quizCount: Array.isArray(window.SITE_CONFIG?.quiz?.questions) ? window.SITE_CONFIG.quiz.questions.length : -1,
      quizVersion: window.GBArticleQuiz?.version || null,
      scriptureFrozen: Object.isFrozen(window.SCRIPTURE_DATA),
      tocTargets: toc.map((href) => ({ href, exists: Boolean(document.querySelector(href)) })),
      figures: figureRows,
      expectedFigures: figures,
      svgs: svgRows,
      tables,
      duplicateIds,
      sourcesCount: document.querySelectorAll('.sources-list > li').length,
      atlasLeak: document.body.innerText.includes('Atlas должен'),
      tallRetraction: document.body.innerText.includes('24 апреля 2025 года') && document.body.innerText.includes('отозвала'),
      canonical: document.querySelector('link[rel="canonical"]')?.href || '',
      ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
      ogAlt: document.querySelector('meta[property="og:image:alt"]')?.content || '',
      twitterAlt: document.querySelector('meta[name="twitter:image:alt"]')?.content || '',
      pagefindImage: document.querySelector('[data-pagefind-meta="image"]')?.textContent?.trim() || '',
      pagefindAlt: document.querySelector('[data-pagefind-meta="image_alt"]')?.textContent?.trim() || '',
      articleLd: articleLd ? {
        url: articleLd.url || '',
        image: typeof articleLd.image === 'object' ? articleLd.image?.url || '' : articleLd.image || '',
        isPartOf: articleLd.isPartOf?.['@id'] || '',
        author: articleLd.author?.name || '',
        editor: articleLd.editor?.['@id'] || '',
      } : null,
      webSiteId: webSiteLd?.['@id'] || '',
      expected: { canonical, og, ogAlt },
      viewport: { width: innerWidth, clientWidth: root.clientWidth, scrollWidth: root.scrollWidth },
    };
  }, { figures: FIGURES, toc: TOC, canonical: CANONICAL, og: OG, ogAlt: OG_ALT });
}

function validateStructure(snapshot) {
  const problems = [];
  if (snapshot.h1.length !== 1 || snapshot.h1[0] !== 'Лот: праведник у ворот Содома') problems.push(`h1=${JSON.stringify(snapshot.h1)}`);
  if (snapshot.articleCount !== 1 || snapshot.articleTextLength < 12000) problems.push(`article semantics/count/text=${snapshot.articleCount}/${snapshot.articleTextLength}`);
  if (snapshot.bookmarkSelector !== 'article') problems.push(`bookmarkSelector=${snapshot.bookmarkSelector}`);
  if (snapshot.quizCount !== 8 || snapshot.quizVersion !== 2) problems.push(`quiz=${snapshot.quizCount}/v${snapshot.quizVersion}`);
  if (!snapshot.scriptureFrozen) problems.push('SCRIPTURE_DATA not frozen');
  if (snapshot.tocTargets.some((row) => !row.exists)) problems.push(`missing TOC=${snapshot.tocTargets.filter((row) => !row.exists).map((row) => row.href).join(',')}`);
  if (snapshot.figures.length !== FIGURES.length) problems.push(`figure count=${snapshot.figures.length}`);
  const names = snapshot.figures.map((row) => row.name);
  if (JSON.stringify(names) !== JSON.stringify(FIGURES)) problems.push(`figure order/names=${JSON.stringify(names)}`);

  for (const row of snapshot.figures) {
    const base = `/images/articles/lot/${row.name}`;
    const allowedCurrent = [`${base}-600w.webp`, `${base}-900w.webp`, `${base}-1200w.webp`];
    const selected = row.currentSrc.match(/-(600|900|1200)w\.webp(?:[?#].*)?$/);
    const expectedRawWidth = Number(selected?.[1] || 0);
    const expectedRawHeight = RAW_HEIGHT_BY_WIDTH.get(expectedRawWidth) || 0;

    if (!row.complete || row.slotNaturalWidth <= 0 || row.slotNaturalHeight <= 0) {
      problems.push(`${row.name}: responsive image did not decode (${row.slotNaturalWidth}x${row.slotNaturalHeight})`);
    }
    if (!allowedCurrent.some((suffix) => row.currentSrc.includes(suffix))) problems.push(`${row.name}: currentSrc=${row.currentSrc}`);
    if (!selected || row.rawError || row.rawNaturalWidth !== expectedRawWidth || row.rawNaturalHeight !== expectedRawHeight) {
      problems.push(`${row.name}: selected raw asset=${row.rawNaturalWidth}x${row.rawNaturalHeight}, expected=${expectedRawWidth}x${expectedRawHeight}${row.rawError ? ` (${row.rawError})` : ''}`);
    }
    for (const width of [600, 900, 1200]) if (!row.srcset.includes(`${base}-${width}w.webp ${width}w`)) problems.push(`${row.name}: srcset missing ${width}`);
    if (row.sizes !== '(max-width: 640px) 92vw, 760px') problems.push(`${row.name}: sizes=${row.sizes}`);
    if (!row.alt || !/иллюстрац|образ/i.test(row.alt)) problems.push(`${row.name}: weak alt`);
    if (!row.caption || !/иллюстрац/i.test(row.caption)) problems.push(`${row.name}: weak caption`);
    if (row.rect.width <= 0 || row.rect.left < -1 || row.rect.right > snapshot.viewport.clientWidth + 1) problems.push(`${row.name}: horizontal clipping ${row.rect.left}/${row.rect.right}/${row.rect.width}`);
  }

  if (snapshot.svgs.length !== 2 || snapshot.svgs.some((row) => row.role !== 'img' || !row.title || !row.desc || row.width <= 0 || row.left < -1 || row.right > snapshot.viewport.clientWidth + 1)) problems.push(`semantic SVG=${JSON.stringify(snapshot.svgs)}`);
  const tableLabels = snapshot.tables.map((row) => row.label).sort();
  const expectedTables = ['Моав и Аммон в линии Лота и Пятикнижии', 'Три уровня доказательств при обсуждении Содома и Лота'].sort();
  if (JSON.stringify(tableLabels) !== JSON.stringify(expectedTables)) problems.push(`tables=${JSON.stringify(snapshot.tables)}`);
  if (snapshot.duplicateIds.length) problems.push(`duplicate ids=${snapshot.duplicateIds.join(',')}`);
  if (snapshot.sourcesCount !== 12) problems.push(`sources=${snapshot.sourcesCount}`);
  if (snapshot.atlasLeak) problems.push('reader-facing Atlas internal copy leaked');
  if (!snapshot.tallRetraction) problems.push('Tall el-Hammam retraction boundary missing');
  if (snapshot.canonical !== CANONICAL) problems.push(`canonical=${snapshot.canonical}`);
  if (snapshot.ogImage !== OG) problems.push(`og=${snapshot.ogImage}`);
  if (snapshot.ogAlt !== OG_ALT || snapshot.twitterAlt !== OG_ALT || snapshot.pagefindAlt !== OG_ALT) problems.push(`image alt mismatch og/twitter/pagefind=${snapshot.ogAlt} | ${snapshot.twitterAlt} | ${snapshot.pagefindAlt}`);
  if (snapshot.pagefindImage !== '/images/articles/lot/og-lot-i-sodom.webp') problems.push(`pagefind image=${snapshot.pagefindImage}`);
  if (!snapshot.articleLd || snapshot.articleLd.url !== CANONICAL || snapshot.articleLd.image !== OG || snapshot.articleLd.isPartOf !== 'https://gospod-bog.ru/#website') problems.push(`Article JSON-LD=${JSON.stringify(snapshot.articleLd)}`);
  if (snapshot.webSiteId !== 'https://gospod-bog.ru/#website') problems.push(`WebSite JSON-LD=${snapshot.webSiteId}`);
  if (snapshot.viewport.scrollWidth > snapshot.viewport.clientWidth + 1) problems.push(`root overflow=${snapshot.viewport.scrollWidth}-${snapshot.viewport.clientWidth}`);
  return problems;
}

async function exerciseToc(page) {
  for (const href of TOC) {
    const ok = await page.evaluate((target) => {
      const link = [...document.querySelectorAll(`a[href="${target}"]`)][0];
      const node = document.querySelector(target);
      if (!link || !node) return false;
      link.click();
      return location.hash === target && document.querySelector(location.hash) === node;
    }, href);
    assert.equal(ok, true, `TOC target did not activate: ${href}`);
  }
}

async function exerciseQuiz(page) {
  await page.locator('#quizLaunch').waitFor({ state: 'visible', timeout: 10000 });
  const authority = await page.evaluate(() => ({
    correct: (window.SITE_CONFIG?.quiz?.questions || []).map((question) => Number(question.correct)),
    firstShort: String(window.SITE_CONFIG?.quiz?.questions?.[0]?.explanation?.short || ''),
    firstFull: String(window.SITE_CONFIG?.quiz?.questions?.[0]?.explanation?.full || ''),
    title: String(window.SITE_CONFIG?.quiz?.scores?.[0]?.title || ''),
    badge: String(window.SITE_CONFIG?.quiz?.scores?.[0]?.badge || ''),
  }));
  assert.equal(authority.correct.length, 8, 'quiz must expose exactly 8 canonical correct indexes');
  assert(authority.correct.every(Number.isInteger), 'quiz correct indexes must be integers');
  assert(authority.firstShort && authority.firstFull, 'first quiz question must expose distinct short/full explanation authority');

  await page.locator('#quizLaunch').click();
  for (let index = 0; index < authority.correct.length; index += 1) {
    await page.locator('.quiz-option').nth(authority.correct[index]).click({ timeout: 5000 });
    await page.locator('.quiz-feedback').waitFor({ state: 'visible', timeout: 5000 });
    if (index === 0) {
      assert.equal((await page.locator('.quiz-explanation--short').textContent())?.trim(), authority.firstShort);
      assert.equal((await page.locator('.quiz-explanation--full').textContent())?.trim(), authority.firstFull);
    }
    await page.locator('.quiz-next').click({ timeout: 5000 });
  }
  await page.waitForFunction(({ title, badge }) =>
    (document.querySelector('#quizQuestion')?.textContent || '').trim() === title &&
    (document.querySelector('.quiz-result-badge')?.textContent || '').trim() === badge,
    { title: authority.title, badge: authority.badge },
    { timeout: 5000 },
  );
  assert.equal((await page.locator('.quiz-progress').textContent())?.trim(), 'Результат: 8 из 8');
}

async function inspectCase(engineName, browserType, profile, theme) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    colorScheme: theme,
    deviceScaleFactor: 1,
  });
  await context.addInitScript((selectedTheme) => {
    try { localStorage.setItem('theme', selectedTheme); } catch {}
  }, theme);
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error?.message || error)));
  page.on('console', (message) => {
    if (message.type() === 'error' && !ignoredConsole(message.text())) consoleErrors.push(message.text());
  });
  await page.route(/mc\.yandex|mc\.yandex\.com/i, (route) => route.abort());

  const label = `${engineName}-${profile.id}-${theme}`;
  try {
    const response = await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'load', timeout: 60000 });
    assert.equal(response?.status(), 200, `HTTP status=${response?.status()}`);
    await page.waitForFunction(() => window.GBArticleQuiz?.version === 2, null, { timeout: 15000 });
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      for (const image of document.images) image.loading = 'eager';
      await Promise.all([...document.images].map((image) => image.decode?.().catch(() => {})));
    });

    const snapshot = await structuralSnapshot(page);
    const problems = validateStructure(snapshot);
    assert.deepEqual(problems, [], problems.join(' | '));
    await exerciseToc(page);
    await exerciseQuiz(page);
    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join(' | ')}`);
    assert.deepEqual(consoleErrors, [], `console errors: ${consoleErrors.join(' | ')}`);
    record(engineName, profile.id, theme, 'complete', true, `${snapshot.figures.length} figures, ${TOC.length} TOC, 8/8 quiz`);
  } catch (error) {
    const screenshot = path.join(OUT, `${label}-failure.png`);
    await page.screenshot({ path: screenshot, fullPage: false }).catch(() => {});
    record(engineName, profile.id, theme, 'complete', false, error.message);
  } finally {
    await context.close();
    await browser.close();
  }
}

for (const [engineName, browserType] of ENGINES) {
  for (const profile of PROFILES) {
    for (const theme of THEMES) {
      await inspectCase(engineName, browserType, profile, theme);
    }
  }
}

const report = {
  schemaVersion: 1,
  route: ROUTE,
  sourceSha: process.env.SOURCE_SHA || '',
  matrix: { engines: ENGINES.map(([name]) => name), profiles: PROFILES.map((item) => item.id), themes: THEMES },
  expectedFigures: FIGURES,
  expectedToc: TOC,
  results,
  failures,
};
fs.writeFileSync(path.join(OUT, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);

if (failures.length) {
  for (const failure of failures) console.error(`LOT BROWSER FAIL: ${failure}`);
  process.exit(1);
}
console.log(`Lot publication browser contract passed: ${results.length}/${results.length} matrix cases.`);
