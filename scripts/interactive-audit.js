#!/usr/bin/env node

/* TODO: gill-v16 | gbs2-baptisty | gbs2-hard-texts | astro-series */
/* Gill v16 required: data-gill-v16, .gbs-rail, .gbs-rail-card.is-current, .mobile-bottom-bar, #mobPartTocBtn, #seriesTocOverlay, #partTocOverlay */
/* REMOVE .gbs2-timeline requirement from Gill v16 — prevents false-red */

/**
 * Interactive regression audit for runtime-only bugs that static HTML checks miss.
 * Requires a production-like dist server. Example:
 *   npm run strangler:build:production-like && npm run pagefind:build:dist
 *   python3 -m http.server 8080 --bind 127.0.0.1 -d dist
 *   AUDIT_BASE=http://127.0.0.1:8080 npm run interactive-audit
 */
'use strict';

const path = require('path');
process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH ||
  path.join(process.env.HOME || process.cwd(), '.cache', 'ms-playwright');

const { chromium } = require('playwright');
const BASE = (process.env.AUDIT_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '');

const SERIES_URLS = [
  '/articles/dzhon-gill-istoricheskiy-kontekst/',
  '/articles/dzhon-gill-chast-1-chelovek/',
  '/articles/dzhon-gill-chast-2-uchenyi/',
  '/articles/dzhon-gill-chast-3-nasledie/',
  '/articles/dzhon-gill-spravochnik/',
  '/articles/krajne-li-isporcheno-serdce/',
  '/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/',
  '/baptisty-rossii/noch-na-kure/',
  '/baptisty-rossii/yuzhnaya-shtunda/',
  '/baptisty-rossii/spravochnik/',
];
const QUIZ_URLS = [
  '/articles/dzhon-gill-chast-1-chelovek/',
  '/articles/dzhon-gill-chast-2-uchenyi/',
  '/articles/dzhon-gill-chast-3-nasledie/',
  '/articles/dzhon-gill-spravochnik/',
  '/articles/kod-da-vinchi/',
  '/articles/krajne-li-isporcheno-serdce/',
];
const GLOSSARY_URLS = [
  '/articles/dzhon-gill-istoricheskiy-kontekst/',
  '/articles/dzhon-gill-chast-1-chelovek/',
  '/articles/krajne-li-isporcheno-serdce/',
];
const THEME_URLS = [
  '/',
  '/articles/dzhon-gill-chast-1-chelovek/',
  '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/',
  '/articles/krajne-li-isporcheno-serdce/',
  '/nagornaya/',
  '/nagornaya/chast-1/',
];
const SEARCH_URLS = [
  '/',
  '/articles/dzhon-gill-chast-1-chelovek/',
  '/articles/krajne-li-isporcheno-serdce/',
  '/nagornaya/chast-1/',
];
const MEDIA_URLS = [
  '/articles/dzhon-gill-chast-1-chelovek/',
  '/articles/krajne-li-isporcheno-serdce/',
];
const HERMENEUTIKA_URL = '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const HERMENEUTIKA_STATIC_FOOTNOTES = ['40', '72', '75', '77', '82', '83', '107'];

const issues = [];
const stats = { pages: 0, series: 0, quizzes: 0, glossary: 0, footnotes: 0, theme: 0, search: 0, media: 0 };

function isNoise(text) {
  return /Content Security Policy directive.*https:\/\/gospod-bog\.ru\/(?:favicon|apple-touch-icon|icons|images)|favicon\.ico|mc\.yandex/i.test(text);
}
function push(kind, url, detail) { issues.push({ kind, url, detail }); }

async function openPage(browser, urlPath, viewport = { width: 1200, height: 800 }) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error' && !isNoise(msg.text())) consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('PAGE_ERROR: ' + err.message));
  const resp = await page.goto(BASE + urlPath, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(900);
  stats.pages++;
  if (!resp || !resp.ok()) push('page-status', urlPath, resp ? resp.status() : 'null response');
  if (consoleErrors.length) push('console-error', urlPath, consoleErrors.slice(0, 4));
  return page;
}

async function checkSeries(browser) {
  for (const url of SERIES_URLS) {
    // Production now contains two legitimate series shells:
    // 1) GBS2 shell for the Russian Baptist series;
    // 2) Astro article series nav for MDX article series (Gill / hard-texts).
    const page = await openPage(browser, url, { width: 1366, height: 850 });
    const state = await page.evaluate(() => {
      const rail = document.querySelector('.gbs2-rail, .gbs-rail');
      const railBox = rail ? rail.getBoundingClientRect() : null;
      return {
        gbsWorld: !!document.querySelector('.gbs2-world, .gbs-world') || document.body?.classList.contains('gbs-world'),
        gbsSeries: document.body?.getAttribute('data-gbs2-series') || '',
        gbsRail: !!rail,
        gbsRailVisible: !!(railBox && railBox.width > 160 && railBox.height > 240),
        gbsCurrent: !!document.querySelector('.gbs2-part[aria-current="page"], .gbs2-part--current, .gbs-rail-card[aria-current="page"], .gbs-rail-card.is-current, .gbs2-current[aria-current="page"]'),
        gbsNext: !!document.querySelector('.gbs2-next, .gbs-rail-card[href]:not([aria-current="page"]):not(.is-current)'),
        gbsTimeline: !!document.querySelector('.gbs2-timeline'),
        gbsV16: !!document.querySelector('[data-gill-v16], .mobile-bottom-bar, #seriesTocOverlay, #partTocOverlay'),
        astroArticle: !!document.querySelector('.astro-article'),
        astroSeriesNav: !!document.querySelector('.astro-series-nav'),
        astroSeriesLinks: document.querySelectorAll('.astro-series-nav__link[href]').length,
        astroSeriesDots: document.querySelectorAll('.astro-series-nav__dot').length,
        legacy: ['reading-progress', 'bottomBar', 'btocOverlay', 'tocSidebar'].filter(id => document.getElementById(id)),
        oldSeriesUi: document.querySelectorAll('[data-series-strip],[data-series-nav],.gb-strip,.series-next-cta').length,
      };
    });
    if (state.gbsWorld) {
      if (!state.gbsRail || !state.gbsRailVisible) push('gbs-rail-not-visible', url, state);
      if (!state.gbsCurrent) push('gbs-no-current-part', url, state);
      if (!state.gbsNext) push('gbs-next-nav-missing', url, state);
      // Hard-texts GBS pages intentionally use the compact rail without the
      // chronological timeline used by Gill/Baptisty series.
      if (!state.gbsTimeline && state.gbsSeries !== 'hard-texts') push('gbs-timeline-missing', url, state);
    } else {
      if (!state.astroArticle) push('astro-series-article-missing', url, state);
      if (!state.astroSeriesNav) push('astro-series-nav-missing', url, state);
      if (state.astroSeriesNav && state.astroSeriesLinks < 1) push('astro-series-nav-links-missing', url, state);
      if (state.astroSeriesNav && state.astroSeriesDots < 2) push('astro-series-nav-dots-missing', url, state);
    }
    if (state.legacy.length) push('legacy-series-leftover', url, state.legacy);
    if (state.oldSeriesUi) push('old-series-ui-leftover', url, state.oldSeriesUi);
    await page.close();

    const mob = await openPage(browser, url, { width: 390, height: 844 });
    const mobState = await mob.evaluate(() => ({
      gbsWorld: !!document.querySelector('.gbs2-world, .gbs-world') || document.body?.classList.contains('gbs-world'),
      head: !!document.querySelector('.gbs2-mobile-head'),
      bbar: !!document.querySelector('#gbs2Bbar, .gbs2-bbar'),
      sheet: !!document.querySelector('#gbs2Sheet, .gbs2-sheet'),
      v16Bar: !!document.querySelector('.mobile-bottom-bar'),
      // v4 bar has the section button (#mobPartTocBtn), not the retired
      // «Серия» button (#mobTocBtn).
      v16PartButton: !!document.querySelector('#mobPartTocBtn'),
      v16SeriesOverlay: !!document.querySelector('#seriesTocOverlay'),
      v16PartOverlay: !!document.querySelector('#partTocOverlay'),
      v16Current: !!document.querySelector('.toc-item[aria-current="page"], .toc-item.is-current'),
      astroArticle: !!document.querySelector('.astro-article'),
      astroSeriesNav: !!document.querySelector('.astro-series-nav'),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    if (mobState.gbsWorld) {
      const isV16Mobile = mobState.v16Bar || mobState.v16PartButton || mobState.v16SeriesOverlay || mobState.v16PartOverlay;
      if (isV16Mobile) {
        if (!mobState.v16Bar || !mobState.v16PartButton || !mobState.v16SeriesOverlay || !mobState.v16PartOverlay || !mobState.v16Current) {
          push('gbs-v16-mobile-ui-missing', url, mobState);
          await mob.close();
          continue;
        }
        // v4 flow: section button → part overlay → #backToSeries → series overlay.
        try { await mob.locator('#mobPartTocBtn').first().click({ timeout: 5000 }); }
        catch (e) { push('gbs-v16-toc-open-failed', url, e.message.slice(0, 200)); await mob.close(); continue; }
        await mob.waitForTimeout(350);
        const partOpen = await mob.evaluate(() => document.querySelector('#partTocOverlay')?.classList.contains('is-open'));
        if (!partOpen) push('gbs-v16-part-overlay-did-not-open', url, null);
        try { await mob.locator('#backToSeries').first().click({ timeout: 5000 }); } catch (e) { /* series is optional-reachable */ }
        await mob.waitForTimeout(300);
        const open = await mob.evaluate(() => document.querySelector('#seriesTocOverlay')?.classList.contains('is-open'));
        if (!open) push('gbs-v16-series-overlay-did-not-open', url, null);
        await mob.evaluate(() => { document.querySelector('#seriesTocOverlay')?.classList.remove('is-open'); document.querySelector('#partTocOverlay')?.classList.remove('is-open'); document.body.style.overflow = ''; });
      } else {
        if (!mobState.head || !mobState.bbar || !mobState.sheet) {
          push('gbs-mobile-ui-missing', url, mobState);
          await mob.close();
          continue;
        }
        try { await mob.locator('#gbs2Bbar, .gbs2-bbar').first().click({ timeout: 5000 }); }
        catch (e) { push('gbs-sheet-open-failed', url, e.message.slice(0, 200)); await mob.close(); continue; }
        await mob.waitForTimeout(350);
        const open = await mob.evaluate(() => document.querySelector('#gbs2Sheet, .gbs2-sheet')?.classList.contains('gbs2-open'));
        if (!open) push('gbs-sheet-did-not-open', url, null);
        const tabOk = await mob.evaluate(() => {
          const t = document.querySelector('.gbs2-sheet-tab[data-gbs2-tab="toc"]');
          if (!t) return true; // older GBS sheet without tabs is allowed only if it opens.
          t.click();
          const pane = document.querySelector('.gbs2-sheet-pane[data-gbs2-pane="toc"]');
          return !!(pane && pane.classList.contains('gbs2-on'));
        });
        if (!tabOk) push('gbs-sheet-tab-broken', url, null);
        await mob.evaluate(() => { const c = document.querySelector('[data-gbs2-close], .gbs2-sheet-close'); if (c) c.click(); });
        await mob.waitForTimeout(250);
        const closed = await mob.evaluate(() => !document.querySelector('#gbs2Sheet, .gbs2-sheet')?.classList.contains('gbs2-open'));
        if (!closed) push('gbs-sheet-did-not-close', url, null);
      }
    } else {
      if (!mobState.astroArticle || !mobState.astroSeriesNav) push('astro-mobile-series-ui-missing', url, mobState);
      if (mobState.overflow > 1) push('astro-mobile-series-overflow', url, mobState);
    }
    stats.series++;
    await mob.close();
  }
}

async function checkQuiz(browser) {
  for (const url of QUIZ_URLS) {
    const page = await openPage(browser, url, { width: 1100, height: 800 });
    const cfg = await page.evaluate(() => ({
      placeholder: !!document.getElementById('quizPlaceholder'),
      launch: !!document.getElementById('quizLaunch'),
      questions: window.SITE_CONFIG && window.SITE_CONFIG.quiz && Array.isArray(window.SITE_CONFIG.quiz.questions)
        ? window.SITE_CONFIG.quiz.questions.length
        : 0,
    }));
    if (cfg.questions > 0 && !cfg.placeholder) push('quiz-missing-placeholder', url, cfg);
    if (cfg.questions > 0 && !cfg.launch) push('quiz-missing-launch', url, cfg);
    if (cfg.launch) {
      await page.locator('#quizLaunch').click({ timeout: 5000 });
      await page.waitForTimeout(400);
      const state = await page.evaluate(() => ({
        question: (document.querySelector('#quizQuestion')?.textContent || '').trim(),
        options: document.querySelectorAll('.quiz-option').length,
      }));
      if (!state.question || state.options < 2) push('quiz-question-options-not-rendered', url, state);
    }
    stats.quizzes++;
    await page.close();
  }
}

async function checkGlossary(browser) {
  const selector = 'article .gterm:not(.summary-card .gterm)';
  for (const url of GLOSSARY_URLS) {
    const page = await openPage(browser, url, { width: 900, height: 650 });
    const summaryTerms = await page.locator('.summary-card .gterm, .summary-card .gtip').count();
    if (summaryTerms) push('summary-has-glossary-terms', url, summaryTerms);
    const terms = page.locator(selector);
    const count = await terms.count();
    if (count > 0) {
      let readinessError = null;
      try {
        await page.waitForFunction((termSelector) => {
          const runtime = window.__gbGlossaryRuntime;
          const target = document.querySelector(termSelector);
          return Boolean(
            runtime && runtime.dict && runtime.policy && runtime.aliasToCanonical &&
            window.SiteUtils && typeof window.SiteUtils.initGlossaryTooltips === 'function' &&
            target && target.hasAttribute('aria-expanded') && target.querySelector('.gtip')
          );
        }, selector, { timeout: 5000 });
      } catch (error) {
        readinessError = String(error.message || error).slice(0, 500);
      }

      const target = terms.first();
      if (!readinessError) {
        await target.scrollIntoViewIfNeeded();
        await target.hover();
        try {
          await page.waitForSelector('.gtip.gb-floating-tip.is-open', { state: 'attached', timeout: 2000 });
        } catch (error) {
          readinessError = `open timeout: ${String(error.message || error).slice(0, 400)}`;
        }
      }

      const state = await page.evaluate((termSelector) => {
        const runtime = window.__gbGlossaryRuntime;
        const target = document.querySelector(termSelector);
        const tip = document.querySelector('.gtip.gb-floating-tip.is-open');
        const targetRect = target ? target.getBoundingClientRect() : null;
        const tipRect = tip ? tip.getBoundingClientRect() : null;
        const inner = tip ? tip.querySelector('.gtip-luxury') : null;
        const tipStyle = tip ? getComputedStyle(tip) : null;
        return {
          runtime: {
            initialized: window.__gbGlossaryInitialized === true,
            dict: Boolean(runtime && runtime.dict),
            policy: Boolean(runtime && runtime.policy),
            aliases: Boolean(runtime && runtime.aliasToCanonical),
            initFunction: Boolean(window.SiteUtils && typeof window.SiteUtils.initGlossaryTooltips === 'function'),
          },
          target: target ? {
            term: target.getAttribute('data-term'),
            role: target.getAttribute('role'),
            tabindex: target.getAttribute('tabindex'),
            ariaExpanded: target.getAttribute('aria-expanded'),
            hasInlineTip: Boolean(target.querySelector('.gtip')),
            w: targetRect ? Math.round(targetRect.width) : null,
            h: targetRect ? Math.round(targetRect.height) : null,
          } : null,
          floatingCount: document.querySelectorAll('.gb-floating-tip').length,
          tip: tip ? {
            w: Math.round(tipRect.width),
            h: Math.round(tipRect.height),
            top: Math.round(tipRect.top),
            bottom: Math.round(tipRect.bottom),
            bg: tipStyle.backgroundColor,
            innerDisplay: inner ? getComputedStyle(inner).display : null,
          } : null,
        };
      }, selector);

      if (readinessError) {
        const kind = state.runtime.dict && state.runtime.policy && state.runtime.aliases && state.runtime.initFunction
          ? 'glossary-tooltip-did-not-open'
          : 'glossary-tooltip-runtime-not-ready';
        push(kind, url, { error: readinessError, ...state });
      } else if (!state.tip || state.tip.w < 100 || state.tip.h < 50 || state.tip.top < 0 || state.tip.bottom > 651 || /rgba\(0, 0, 0, 0\)/.test(state.tip.bg) || state.tip.innerDisplay !== 'block') {
        push('glossary-tooltip-bad-layout', url, state);
      }
    }
    stats.glossary++;
    await page.close();
  }
}

async function checkHermenevtikaFootnotes(browser) {
  const desktop = await openPage(browser, HERMENEUTIKA_URL, { width: 1280, height: 850 });
  const staticState = await desktop.evaluate((expected) => {
    function numberOf(marker) {
      return Array.from(marker.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent || '').join('').replace(/\s+/g, '').trim();
    }
    const markers = Array.from(document.querySelectorAll('.fn-marker'));
    const found = {};
    for (const marker of markers) {
      const number = numberOf(marker);
      if (!expected.includes(number)) continue;
      marker.dataset.auditFootnote = number;
      const tip = marker.querySelector('.tooltip');
      found[number] = {
        tooltip: !!tip,
        nestedInteractive: tip ? tip.querySelectorAll('button, a, [tabindex], [role="button"], .bref, [data-ref]').length : -1,
      };
    }
    return {
      found,
      nestedInteractive: document.querySelectorAll('.fn-marker .tooltip button, .fn-marker .tooltip a, .fn-marker .tooltip [tabindex], .fn-marker .tooltip [role="button"], .fn-marker .tooltip .bref, .fn-marker .tooltip [data-ref]').length,
      ordinaryScripture: document.querySelectorAll('article .bref[data-ref]').length,
    };
  }, HERMENEUTIKA_STATIC_FOOTNOTES);
  for (const number of HERMENEUTIKA_STATIC_FOOTNOTES) {
    if (!staticState.found[number]?.tooltip || staticState.found[number]?.nestedInteractive !== 0) push('hermenevtika-static-footnote-contract', HERMENEUTIKA_URL, { number, state: staticState.found[number] || null });
  }
  if (staticState.nestedInteractive !== 0) push('hermenevtika-nested-footnote-interactive', HERMENEUTIKA_URL, staticState);
  if (staticState.ordinaryScripture < 20) push('hermenevtika-ordinary-scripture-missing', HERMENEUTIKA_URL, staticState);

  const hoverMarker = desktop.locator('[data-audit-footnote="40"]');
  await hoverMarker.scrollIntoViewIfNeeded();
  await hoverMarker.hover({ force: true });
  await desktop.waitForTimeout(250);

  const readStaticFootnoteHoverState = () => desktop.evaluate(() => {
    const marker = document.querySelector('[data-audit-footnote="40"]');
    const tip = document.querySelector('.tooltip.gb-floating-tip.is-open');
    const rect = tip ? tip.getBoundingClientRect() : null;
    const style = tip ? getComputedStyle(tip) : null;
    const epsilon = 1;
    return {
      markerOpen: marker?.getAttribute('aria-expanded') === 'true',
      tipOpen: !!tip,
      tip: tip && rect && style ? {
        position: style.position,
        display: style.display,
        visibility: style.visibility,
        opacity: Number(style.opacity),
        textLength: (tip.textContent || '').trim().length,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        inViewport:
          rect.left >= -epsilon &&
          rect.top >= -epsilon &&
          rect.right <= window.innerWidth + epsilon &&
          rect.bottom <= window.innerHeight + epsilon,
      } : null,
    };
  });

  let openState = await readStaticFootnoteHoverState();
  if (!openState.tipOpen) {
    push('hermenevtika-footnote-hover-open-failed', HERMENEUTIKA_URL, openState);
  } else if (
    openState.tip.position !== 'fixed' ||
    openState.tip.display === 'none' ||
    openState.tip.visibility === 'hidden' ||
    openState.tip.opacity < 0.9 ||
    openState.tip.textLength < 20 ||
    openState.tip.width < 80 ||
    openState.tip.height < 20 ||
    !openState.tip.inViewport
  ) {
    push('hermenevtika-footnote-hover-layout-broken', HERMENEUTIKA_URL, openState);
  } else {
    await desktop.mouse.move(openState.tip.centerX, openState.tip.centerY, { steps: 12 });
    try {
      await desktop.waitForFunction(() => {
        const tip = document.querySelector('.tooltip.gb-floating-tip.is-open');
        return Boolean(tip && tip.matches(':hover'));
      }, undefined, { timeout: 2000 });
    } catch (_) {
      // Read the actual state below so the failure keeps useful evidence.
    }
    const heldState = await readStaticFootnoteHoverState();
    if (!heldState.tipOpen || !heldState.tip?.inViewport) {
      push('hermenevtika-footnote-hover-content-closed-parent', HERMENEUTIKA_URL, heldState);
    }
  }
  await desktop.keyboard.press('Escape');
  await desktop.locator('[data-audit-footnote="72"]').focus();
  await desktop.waitForTimeout(220);
  const keyboardState = await desktop.evaluate(() => ({
    markerOpen: document.querySelector('[data-audit-footnote="72"]')?.getAttribute('aria-expanded') === 'true',
    tipOpen: !!document.querySelector('.gb-floating-tip.is-open'),
    nestedFocusable: document.querySelectorAll('.gb-floating-tip.is-open button, .gb-floating-tip.is-open a, .gb-floating-tip.is-open [tabindex], .gb-floating-tip.is-open [role="button"]').length,
  }));
  if (!keyboardState.tipOpen || keyboardState.nestedFocusable !== 0) push('hermenevtika-footnote-keyboard-contract', HERMENEUTIKA_URL, keyboardState);
  await desktop.keyboard.press('Escape');

  const ordinary = desktop.locator('article .bref[data-ref]').first();
  await ordinary.scrollIntoViewIfNeeded();
  await ordinary.click({ force: true });
  await desktop.waitForTimeout(220);
  const ordinaryState = await desktop.evaluate(() => ({
    tipOpen: !!document.querySelector('.gb-floating-tip.is-open'),
    expandedScripture: !!document.querySelector('article .bref[data-ref][aria-expanded="true"]'),
  }));
  if (!ordinaryState.tipOpen || !ordinaryState.expandedScripture) push('hermenevtika-ordinary-scripture-tooltip-broken', HERMENEUTIKA_URL, ordinaryState);
  await desktop.keyboard.press('Escape');
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const resp = await mobile.goto(BASE + HERMENEUTIKA_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await mobile.waitForTimeout(900);
  stats.pages++;
  if (!resp || !resp.ok()) push('hermenevtika-mobile-status', HERMENEUTIKA_URL, resp ? resp.status() : 'null response');
  await mobile.evaluate((expected) => {
    for (const marker of document.querySelectorAll('.fn-marker')) {
      const number = Array.from(marker.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent || '').join('').replace(/\s+/g, '').trim();
      if (expected.includes(number)) marker.dataset.auditFootnote = number;
    }
  }, HERMENEUTIKA_STATIC_FOOTNOTES);
  const mobileMarker = mobile.locator('[data-audit-footnote="75"]');
  await mobileMarker.scrollIntoViewIfNeeded();
  await mobileMarker.tap();
  await mobile.waitForTimeout(300);
  const mobileState = await mobile.evaluate(() => ({
    markerOpen: document.querySelector('[data-audit-footnote="75"]')?.getAttribute('aria-expanded') === 'true',
    tipOpen: !!document.querySelector('.gb-floating-tip.is-open'),
    nestedInteractive: document.querySelectorAll('.gb-floating-tip.is-open button, .gb-floating-tip.is-open a, .gb-floating-tip.is-open [tabindex], .gb-floating-tip.is-open [role="button"], .gb-floating-tip.is-open .bref, .gb-floating-tip.is-open [data-ref]').length,
    scrollLocked: document.documentElement.dataset.scrollLocked === '1' || document.body.style.position === 'fixed' || document.documentElement.style.overflow === 'hidden',
  }));
  if (!mobileState.markerOpen || !mobileState.tipOpen || mobileState.nestedInteractive !== 0 || !mobileState.scrollLocked) push('hermenevtika-mobile-footnote-sheet-contract', HERMENEUTIKA_URL, mobileState);
  await mobile.keyboard.press('Escape');
  await mobile.waitForTimeout(250);
  const mobileClosed = await mobile.evaluate(() => ({
    tipOpen: !!document.querySelector('.gb-floating-tip.is-open'),
    scrollLocked: document.documentElement.dataset.scrollLocked === '1' || document.body.style.position === 'fixed' || document.documentElement.style.overflow === 'hidden',
  }));
  if (mobileClosed.tipOpen || mobileClosed.scrollLocked) push('hermenevtika-mobile-footnote-sheet-did-not-close', HERMENEUTIKA_URL, mobileClosed);
  await mobile.close();
  stats.footnotes++;
}

async function visibleThemeHandle(page) {
  return await page.evaluateHandle(() => {
    const selectors = ['[data-fc-action="theme"]', '.gb-theme-toggle', '.gbs2-mctl[data-gbs2-theme]', '.gbs2-ctl[data-gbs2-theme]', '.gb-fc-theme', '#barThemeBtn', '#themeToggle', '.theme-toggle', '.nag-sidebar-theme-btn'];
    function visible(el) {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) !== 0 &&
        r.width >= 20 && r.height >= 20 && r.bottom >= 0 && r.right >= 0 && r.top <= innerHeight && r.left <= innerWidth;
    }
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        if (visible(el)) return el;
      }
    }
    return null;
  });
}

async function checkMobileTheme(browser) {
  for (const url of THEME_URLS) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    page.on('console', msg => { if (msg.type() === 'error' && !isNoise(msg.text())) push('mobile-theme-console-error', url, msg.text()); });
    page.on('pageerror', err => push('mobile-theme-page-error', url, err.message));
    const resp = await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(900);
    stats.pages++;
    if (!resp || !resp.ok()) push('mobile-theme-page-status', url, resp ? resp.status() : 'null response');
    const enabled = await page.evaluate(() => !(window.SITE_CONFIG && window.SITE_CONFIG.features && window.SITE_CONFIG.features.themeToggle && window.SITE_CONFIG.features.themeToggle.enabled === false));
    if (!enabled) { await page.close(); continue; }
    await page.evaluate(() => { try { localStorage.setItem('theme', 'light'); } catch (_) {} document.documentElement.classList.remove('dark'); });
    const handle = await visibleThemeHandle(page);
    const el = handle.asElement();
    if (!el) {
      push('mobile-theme-control-not-visible', url, 'theme enabled but no visible control');
      await page.close();
      continue;
    }
    const before = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await el.click({ timeout: 5000 });
    await page.waitForTimeout(250);
    const after = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (after === before) push('mobile-theme-click-did-not-toggle', url, { before, after });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    const persisted = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (persisted !== after) push('mobile-theme-not-persisted', url, { after, persisted });
    stats.theme++;
    await page.close();
  }
}

async function checkSearchShortcuts(browser) {
  for (const url of SEARCH_URLS) {
    const page = await openPage(browser, url, { width: 1200, height: 800 });
    await page.evaluate(() => {
      window.__gbKeyAudit = [];
      document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && (String(e.key).toLowerCase() === 'f' || String(e.key).toLowerCase() === 'k')) {
          window.__gbKeyAudit.push({ key: e.key, ctrl: e.ctrlKey, meta: e.metaKey, defaultPrevented: e.defaultPrevented, phase: 'late-bubble' });
        }
      }, false);
    });
    await page.keyboard.press('Control+F');
    await page.waitForTimeout(250);
    const ctrlF = await page.evaluate(() => ({
      events: window.__gbKeyAudit || [],
      cpOpen: !!document.querySelector('.cp-backdrop.is-open'),
      activeTag: document.activeElement && document.activeElement.tagName,
    }));
    const fEvent = ctrlF.events.find(e => String(e.key).toLowerCase() === 'f' && e.ctrl);
    if (!fEvent) push('ctrl-f-not-observed', url, ctrlF);
    else if (fEvent.defaultPrevented || ctrlF.cpOpen) push('ctrl-f-hijacked', url, ctrlF);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    await page.keyboard.press('Control+K');
    await page.waitForTimeout(450);
    const ctrlK = await page.evaluate(() => ({
      cpOpen: !!document.querySelector('.cp-backdrop.is-open'),
      inputFocused: document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('cp-input'),
      activeTag: document.activeElement && document.activeElement.tagName,
      activeClass: document.activeElement && document.activeElement.className,
    }));
    if (!ctrlK.cpOpen || !ctrlK.inputFocused) push('ctrl-k-command-palette-not-open', url, ctrlK);
    if (ctrlK.cpOpen) {
      await page.keyboard.type('Гилл');
      // Pagefind fetch/index hydration on production-like dist can take >450ms
      // under CI load; wait long enough to avoid false negatives while still
      // keeping the runtime audit cheap.
      await page.waitForTimeout(1800);
      const results = await page.evaluate(() => ({ items: document.querySelectorAll('.cp-item').length, empty: !!document.querySelector('.cp-empty') }));
      if (results.items < 1) push('command-palette-no-results-for-gill', url, results);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      const closed = await page.evaluate(() => !document.querySelector('.cp-backdrop.is-open'));
      if (!closed) push('command-palette-escape-did-not-close', url, null);
    }
    stats.search++;
    await page.close();
  }
}

async function checkMediaViewerAndShare(browser) {
  for (const url of MEDIA_URLS) {
    const page = await openPage(browser, url, { width: 1000, height: 800 });
    const imgCount = await page.locator('.article-figure img, .article-img img, .nagornaya-hero-img').count();
    if (imgCount > 0) {
      await page.locator('.article-figure img, .article-img img, .nagornaya-hero-img').first().click({ force: true });
      await page.waitForTimeout(250);
      const opened = await page.evaluate(() => ({
        open: !!document.querySelector('.img-viewer.is-open, .gbx-imgview.gbx-imgview--open'),
        scrollLocked: document.documentElement.dataset.scrollLocked === '1' || document.body.style.position === 'fixed' || document.documentElement.style.overflow === 'hidden'
      }));
      if (!opened.open || !opened.scrollLocked) push('image-viewer-did-not-open-lock-scroll', url, opened);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(420);
      const closed = await page.evaluate(() => ({
        open: !!document.querySelector('.img-viewer.is-open, .gbx-imgview.gbx-imgview--open'),
        scrollLocked: document.documentElement.dataset.scrollLocked === '1' || document.body.style.position === 'fixed' || document.documentElement.style.overflow === 'hidden'
      }));
      if (closed.open || closed.scrollLocked) push('image-viewer-escape-did-not-close', url, closed);
    }
    const endShare = await page.locator('#articleEndShareBtn').count();
    if (endShare > 0) {
      await page.locator('#articleEndShareBtn').scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      await page.locator('#articleEndShareBtn').click({ timeout: 5000 });
      await page.waitForTimeout(250);
      const state = await page.evaluate(() => {
        const ov = document.querySelector('#share-dialog-overlay');
        const canonical = document.querySelector('link[rel="canonical"]')?.href || '';
        return {
          open: !!(ov && (ov.classList.contains('is-open') || ov.getAttribute('aria-hidden') === 'false')),
          hidden: ov && ov.getAttribute('aria-hidden'),
          canonical,
          buttons: document.querySelectorAll('#share-dialog button').length,
        };
      });
      if (!state.open || state.hidden !== 'false' || state.buttons < 3) push('share-dialog-did-not-open', url, state);
      if (state.canonical && /preview|localhost|127\.0\.0\.1/i.test(state.canonical)) push('share-canonical-url-suspicious', url, state.canonical);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      const closed = await page.evaluate(() => ({ open: !!document.querySelector('#share-dialog-overlay.is-open'), hidden: document.querySelector('#share-dialog-overlay')?.getAttribute('aria-hidden') }));
      if (closed.open || closed.hidden !== 'true') push('share-dialog-escape-did-not-close', url, closed);
    }
    stats.media++;
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  try {
    await checkSeries(browser);
    await checkQuiz(browser);
    await checkGlossary(browser);
    await checkHermenevtikaFootnotes(browser);
    await checkMobileTheme(browser);
    await checkSearchShortcuts(browser);
    await checkMediaViewerAndShare(browser);
  } finally {
    await browser.close();
  }
  console.log('\nGB INTERACTIVE AUDIT');
  console.log(`Pages: ${stats.pages} · series: ${stats.series} · quizzes: ${stats.quizzes} · glossary: ${stats.glossary} · footnotes: ${stats.footnotes} · theme: ${stats.theme} · search: ${stats.search} · media: ${stats.media}`);
  if (issues.length) {
    console.log(`❌ ${issues.length} issue(s):`);
    issues.forEach(i => console.log(`- ${i.kind} ${i.url}: ${JSON.stringify(i.detail)}`));
    process.exit(1);
  }
  console.log('✅ Interactive audit passed');
})().catch(err => { console.error('FATAL', err); process.exit(1); });
