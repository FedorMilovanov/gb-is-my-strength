#!/usr/bin/env node
/**
 * Reproducible browser test for Gill II panel-open viewport-height resize bug:
 * Opening Оглавление (#partTocOverlay) or Настройки (.gill-settings-sheet)
 * at mid-article (~45%) and resizing viewport height 844 -> 720 px corrupts
 * ReaderState range/progress/section and sends "Продолжить" in a new tab
 * to a wrong heading.
 *
 * Usage:
 *   READER_URL=http://127.0.0.1:19078 node research/reader-w57-audit/analytics/gill-panel-resize-state-repro.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE = (process.env.READER_URL || 'http://127.0.0.1:19078').replace(/\/+$/, '');
const URL = `${BASE}/articles/dzhon-gill-chast-2-uchenyi/`;

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

async function waitForScrollSettle(page, maxMs = 2000) {
  const started = Date.now();
  let lastY = await page.evaluate(() => Math.round(window.scrollY));
  let stable = 0;
  while (Date.now() - started < maxMs) {
    await page.waitForTimeout(120);
    const curY = await page.evaluate(() => Math.round(window.scrollY));
    if (Math.abs(curY - lastY) <= 2) {
      stable += 1;
      if (stable >= 3) break;
    } else {
      stable = 0;
      lastY = curY;
    }
  }
}

async function runCase({ name, panel, resizeTo720 }) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
    locale: 'ru-RU',
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(8000);

  await p.goto(URL);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);

  const midY = await p.evaluate(() => Math.round((document.documentElement.scrollHeight - innerHeight) * 0.45));
  await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), midY);
  // Real user scroll UP slightly sets userInteracted=true and keeps mobile top bar visible.
  await p.mouse.wheel(0, -120);
  await p.waitForTimeout(1300);

  const before = await p.evaluate(() => {
    const snap = window.GBReaderState?.getSnapshot?.();
    const saved = window.GBReaderState?.getSaved?.();
    return {
      scrollY: Math.round(window.scrollY),
      progress: snap?.progress ?? null,
      sectionId: snap?.sectionId ?? null,
      sectionTitle: snap?.sectionTitle ?? null,
      savedSectionId: saved?.sectionId ?? null,
      savedSectionTitle: saved?.sectionTitle ?? null,
      savedProgress: saved?.progress ?? null,
    };
  });

  if (panel === 'toc') {
    await p.locator('#mobPartTocBtn').tap();
  } else {
    await p.locator('#mobSettingsBtn').tap();
  }
  await p.waitForTimeout(300);

  if (resizeTo720) {
    await p.setViewportSize({ width: 390, height: 720 });
    await p.waitForTimeout(400);
  }

  if (panel === 'toc') {
    await p.locator('#partTocOverlay .toc-sheet__handle, #partTocOverlay [data-overlay-close]').first().tap();
  } else {
    await p.locator('.gill-settings-sheet button', { hasText: 'Готово' }).tap();
  }
  await p.waitForTimeout(1400); // > saveDelay (900ms)

  const afterSave = await p.evaluate(() => {
    const saved = window.GBReaderState?.getSaved?.();
    const snap = window.GBReaderState?.getSnapshot?.();
    return {
      scrollY: Math.round(window.scrollY),
      snapSectionId: snap?.sectionId ?? null,
      snapSectionTitle: snap?.sectionTitle ?? null,
      snapProgress: snap?.progress ?? null,
      savedSectionId: saved?.sectionId ?? null,
      savedSectionTitle: saved?.sectionTitle ?? null,
      savedProgress: saved?.progress ?? null,
    };
  });

  const p2 = await ctx.newPage();
  p2.setDefaultTimeout(8000);
  await p2.goto(URL);
  await p2.evaluate(() => document.fonts.ready);
  await p2.waitForTimeout(600);

  const resumeBtn = p2.locator('.gbs2-resume-go');
  const hasResumeBtn = (await resumeBtn.count()) > 0 && (await resumeBtn.isVisible());
  let landed = null;
  if (hasResumeBtn) {
    await resumeBtn.tap();
    await waitForScrollSettle(p2);
    landed = await p2.evaluate(() => {
      const snap = window.GBReaderState?.getSnapshot?.();
      const rl = window.GBReaderState?.getReadingLine?.() || 250;
      const hs = [...document.querySelectorAll('article.article-body h2[id], article.article-body h3[id]')].map((h) => ({
        id: h.id,
        title: h.textContent.trim().replace(/\s+/g, ' '),
        top: Math.round(h.getBoundingClientRect().top),
      }));
      const above = hs.filter((h) => h.top <= rl + 10);
      const nearest = above[above.length - 1] || hs[0] || null;
      return {
        scrollY: Math.round(window.scrollY),
        progress: snap?.progress ?? null,
        snapSectionId: snap?.sectionId ?? null,
        snapSectionTitle: snap?.sectionTitle ?? null,
        headingId: nearest?.id ?? null,
        headingTitle: nearest?.title ?? null,
      };
    });
  }

  await ctx.close();

  const savedMatches =
    afterSave.savedSectionId === before.sectionId &&
    Math.abs((afterSave.savedProgress ?? -999) - (before.progress ?? 0)) <= 3;
  const landedMatches =
    hasResumeBtn &&
    landed?.headingId === before.sectionId &&
    landed?.snapSectionId === before.sectionId;
  const pass = savedMatches && landedMatches;

  return { name, panel, resizeTo720, pass, before, afterSave, hasResumeBtn, landed };
}

try {
  const cases = [
    { name: 'toc-control', panel: 'toc', resizeTo720: false },
    { name: 'settings-control', panel: 'settings', resizeTo720: false },
    { name: 'toc-resize', panel: 'toc', resizeTo720: true },
    { name: 'settings-resize', panel: 'settings', resizeTo720: true },
  ];
  const results = [];
  for (const c of cases) {
    const res = await runCase(c);
    results.push(res);
    console.log(JSON.stringify(res));
  }
  const failed = results.filter((r) => !r.pass);
  if (failed.length > 0) {
    console.error(`FAIL: ${failed.length}/${results.length} case(s) failed: ${failed.map((f) => f.name).join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: all ${results.length} cases preserved section and resume destination.`);
  }
} finally {
  await browser.close();
}
