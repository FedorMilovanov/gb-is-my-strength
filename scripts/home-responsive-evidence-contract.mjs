#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const REPORT_DIR = path.join(ROOT, 'reports', 'home-browser-contract');

async function setThemeForEvidence(page, dark) {
  const current = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if (current === dark) return;

  const dispatched = await page.evaluate(() => {
    const toggle = document.getElementById('themeToggle');
    if (!(toggle instanceof HTMLButtonElement)) return false;
    toggle.click();
    return true;
  });
  assert.equal(dispatched, true, 'theme toggle is missing from the evidence page');
  await page.waitForFunction((expected) => document.documentElement.classList.contains('dark') === expected, dark);
}

async function assertDirectionObjects(page, label) {
  const images = page.locator('img.h-route-object');
  assert.equal(await images.count(), 5, `${label}: direction object count changed`);
  await images.first().scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const nodes = [...document.querySelectorAll('img.h-route-object')];
    return nodes.length === 5 && nodes.every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
  });
  await images.evaluateAll((nodes) => Promise.all(nodes.map((image) => image.decode())));

  const state = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('img.h-route-object')];
    return {
      svgCount: document.querySelectorAll('.h-home-routes svg').length,
      sources: nodes.map((image) => new URL(image.currentSrc || image.src, location.href).pathname),
      dimensions: nodes.map((image) => [image.naturalWidth, image.naturalHeight]),
      keys: nodes.map((image) => [...image.classList].find((name) => name.startsWith('h-route-object--')) || ''),
      loading: nodes.map((image) => image.getAttribute('loading')),
      fetchPriorities: nodes.map((image) => image.getAttribute('fetchpriority')),
      visibleCoverage: nodes.map((image) => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return 0;
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let visible = 0;
        for (let index = 3; index < pixels.length; index += 4) {
          if (pixels[index] > 16) visible += 1;
        }
        return visible / (canvas.width * canvas.height);
      }),
    };
  });

  assert.equal(state.svgCount, 0, `${label}: obsolete SVG remains in gateway`);
  assert.equal(new Set(state.keys).size, 5, `${label}: object identities are not unique`);
  assert.deepEqual(state.sources, [
    '/images/home/directions/articles-scroll.png',
    '/images/home/directions/series-documents.png',
    '/images/home/directions/biographies-theologian.png',
    '/images/home/directions/maps-biblical-atlas.png',
    '/images/home/directions/confessions-dossier.png',
  ], `${label}: direction asset order or URLs changed`);
  for (const [width, height] of state.dimensions) {
    assert.ok(width >= 200 && height >= 200, `${label}: PNG did not decode at expected resolution`);
  }
  assert.deepEqual(state.loading, ['eager', 'eager', 'eager', 'eager', 'eager'], `${label}: direction art must load deterministically`);
  assert.deepEqual(state.fetchPriorities, ['low', 'low', 'low', 'low', 'low'], `${label}: direction art must not compete with first-view content`);
  for (const coverage of state.visibleCoverage) {
    assert.ok(coverage >= 0.08, `${label}: direction PNG is decoded but visually empty (${(coverage * 100).toFixed(1)}% coverage)`);
  }
}

async function assertVisualRegressionContracts(page, width, height) {
  await page.setViewportSize({ width, height });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);

  const state = await page.evaluate(() => {
    const rect = (element) => {
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return {
        left: value.left,
        right: value.right,
        top: value.top,
        bottom: value.bottom,
        width: value.width,
        height: value.height,
      };
    };
    const overlaps = (first, second) => Boolean(first && second
      && first.left < second.right
      && first.right > second.left
      && first.top < second.bottom
      && first.bottom > second.top);

    const contentSurfaces = [...document.querySelectorAll('.home-content > :not(.h-ambient-native)')]
      .map(rect)
      .filter((surface) => surface && surface.width > 0 && surface.height > 0);
    const visiblePhrases = [...document.querySelectorAll('.h-ambient-word')]
      .filter((node) => getComputedStyle(node).display !== 'none');
    const phraseState = visiblePhrases.map((node) => {
      const phraseRect = rect(node);
      const side = node.classList.contains('h-ambient-word--left') ? 'left' : 'right';
      return {
        side,
        pointerEvents: getComputedStyle(node).pointerEvents,
        rect: phraseRect,
        intrudesIntoContent: contentSurfaces.some((surface) => overlaps(phraseRect, surface)),
      };
    });

    const searchShape = document.querySelector('#gbSearchBtn svg circle');
    const moonShape = document.querySelector('#themeToggle .icon-moon path');
    const routeDividers = [...document.querySelectorAll('.h-home-route__divider')];

    const featured = [...document.querySelectorAll('#publikacii .h-featured-shelf--lead .h-featured-series')];
    const featuredRects = featured.map(rect);
    const publicationCards = [...document.querySelectorAll('#publikacii .h-articles-group .h-article-card')];
    const publicationRects = publicationCards.slice(0, 2).map(rect);

    const endBlock = document.querySelector('.article-end-sdg-wrap');
    const footer = document.querySelector('.h-footer');
    const endBeforeFooter = Boolean(endBlock && footer
      && (endBlock.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING));

    const scrollTop = document.querySelector('.h-scroll-top');
    const progressRing = document.querySelector('.h-scroll-top .h-progress-ring');
    const quoteMirror = document.querySelector('.h-quote-mirror');
    const quote = document.querySelector('.h-blockquote--mirror');
    const quoteLeft = document.querySelector('.h-quote-left');
    const ornaments = [...document.querySelectorAll('.h-quote-section .h-ornament')];

    return {
      searchStroke: searchShape ? Number.parseFloat(getComputedStyle(searchShape).strokeWidth) : NaN,
      moonStroke: moonShape ? Number.parseFloat(getComputedStyle(moonShape).strokeWidth) : NaN,
      ambientVisible: visiblePhrases.length,
      phraseState,
      routeDividerWidths: routeDividers.map((node) => Number.parseFloat(getComputedStyle(node).width)),
      routeDividerDisplays: routeDividers.map((node) => getComputedStyle(node).display),
      featuredTransformStyles: featured.map((node) => getComputedStyle(node).transformStyle),
      featuredTransforms: featured.map((node) => getComputedStyle(node).transform),
      featuredOverlap: featuredRects.length >= 2 ? overlaps(featuredRects[0], featuredRects[1]) : false,
      publicationTransforms: publicationCards.slice(0, 2).map((node) => getComputedStyle(node).transform),
      publicationGap: publicationRects.length >= 2 && Math.abs(publicationRects[0].top - publicationRects[1].top) < 4
        ? publicationRects[1].left - publicationRects[0].right
        : null,
      publicationOverlap: publicationRects.length >= 2 ? overlaps(publicationRects[0], publicationRects[1]) : false,
      endBeforeFooter,
      scrollTop: rect(scrollTop),
      progressRing: rect(progressRing),
      scrollTopRightGap: scrollTop ? innerWidth - scrollTop.getBoundingClientRect().right : null,
      scrollTopBottomGap: scrollTop ? innerHeight - scrollTop.getBoundingClientRect().bottom : null,
      quoteInset: quoteMirror && quote
        ? quote.getBoundingClientRect().left - quoteMirror.getBoundingClientRect().left
        : null,
      quoteBorderTop: quoteLeft ? getComputedStyle(quoteLeft).borderTopWidth : null,
      ornamentDisplays: ornaments.map((node) => getComputedStyle(node).display),
      footer: rect(footer),
    };
  });

  assert.ok(Number.isFinite(state.searchStroke) && state.searchStroke <= 1.5, `${width}px: search icon became optically heavy`);
  assert.ok(Number.isFinite(state.moonStroke) && state.moonStroke <= 1.5, `${width}px: moon icon became optically heavy`);
  assert.ok(Math.abs(state.searchStroke - state.moonStroke) <= 0.2, `${width}px: search and moon icon weights diverged`);
  assert.equal(state.endBeforeFooter, true, `${width}px: terminal SDG signature must precede the footer`);

  if (width >= 1480) {
    const expectedPhrases = width >= 1600 ? 32 : 16;
    assert.equal(state.ambientVisible, expectedPhrases, `${width}px: marginalia density changed`);
    assert.equal(state.phraseState.every((phrase) => phrase.pointerEvents === 'auto'), true, `${width}px: visible marginalia are not interactive`);
    assert.equal(state.phraseState.some((phrase) => phrase.intrudesIntoContent), false, `${width}px: marginalia overlap a rendered Home section`);
  }

  assert.equal(state.routeDividerWidths.length, 4, `${width}px: gateway must render exactly four internal dividers`);
  assert.equal(
    state.routeDividerWidths.every((value) => Number.isFinite(value) && Math.abs(value - 1) <= 0.01),
    true,
    `${width}px: gateway dividers are not uniformly 1px`,
  );
  assert.equal(
    state.routeDividerDisplays.every((value) => value !== 'none'),
    true,
    `${width}px: a gateway divider is hidden`,
  );

  if (width >= 761) {
    assert.equal(state.featuredTransformStyles.every((value) => value === 'flat'), true, `${width}px: featured cards retained a 3D overlap plane`);
    assert.equal(state.featuredTransforms.every((value) => value === 'none'), true, `${width}px: featured cards are transformed at rest`);
    assert.equal(state.featuredOverlap, false, `${width}px: featured cards overlap`);
    assert.equal(state.publicationTransforms.every((value) => value === 'none'), true, `${width}px: publication cards are transformed at rest`);
    assert.equal(state.publicationOverlap, false, `${width}px: publication cards overlap`);
    if (state.publicationGap !== null) assert.ok(state.publicationGap >= 12, `${width}px: publication card gap is too narrow`);
  }

  if (width <= 760) {
    assert.ok(state.scrollTop && Math.abs(state.scrollTop.width - state.scrollTop.height) <= 0.5, `${width}px: scroll control is not circular`);
    assert.ok(state.progressRing && state.scrollTop
      && Math.abs(state.progressRing.width - state.scrollTop.width) <= 0.5
      && Math.abs(state.progressRing.height - state.scrollTop.height) <= 0.5,
    `${width}px: progress ring does not fit the scroll control`);
    assert.ok(state.scrollTopRightGap >= 17, `${width}px: scroll control is too close to the right edge`);
    assert.ok(state.scrollTopBottomGap >= 21, `${width}px: scroll control is too close to the bottom edge`);
    assert.ok(state.quoteInset >= 24, `${width}px: mobile quotation lacks a readable inner inset`);
    assert.equal(state.quoteBorderTop, '0px', `${width}px: redundant mobile quote divider remains`);
    assert.equal(state.ornamentDisplays.every((value) => value === 'none'), true, `${width}px: redundant mobile ornaments remain`);
    assert.ok(state.footer && state.footer.left >= 17 && width - state.footer.right >= 17, `${width}px: footer touches a viewport edge`);
  }

  if (width >= 1480) {
    const visibleIndex = await page.locator('.h-ambient-word').evaluateAll((nodes) => nodes.findIndex((node) => getComputedStyle(node).display !== 'none'));
    assert.ok(visibleIndex >= 0, `${width}px: no marginalia available for hover evidence`);
    const phrase = page.locator('.h-ambient-word').nth(visibleIndex);
    await phrase.hover();
    await page.waitForTimeout(120);
    const tooltip = await phrase.locator('.h-ambient-word__tooltip').evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        opacity: Number.parseFloat(style.opacity),
        borderTopWidth: style.borderTopWidth,
        backgroundColor: style.backgroundColor,
        boxShadow: style.boxShadow,
        color: style.color,
      };
    });
    assert.ok(tooltip.opacity >= 0.9, `${width}px: marginalia translation does not reveal on hover`);
    assert.equal(tooltip.borderTopWidth, '0px', `${width}px: marginalia translation regained a frame`);
    assert.equal(tooltip.backgroundColor, 'rgba(0, 0, 0, 0)', `${width}px: marginalia translation regained a panel background`);
    assert.equal(tooltip.boxShadow, 'none', `${width}px: marginalia translation regained a panel shadow`);
    assert.equal(tooltip.color, 'rgb(23, 20, 17)', `${width}px: light-theme marginalia translation is not ink-black`);
  }
}

async function assertResponsiveLayout(page, width, height) {
  await page.setViewportSize({ width, height });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);

  const state = await page.evaluate(() => {
    const routes = document.querySelector('.h-home-routes');
    const gateway = document.getElementById('issledovat');
    const menu = document.getElementById('hMobileMenuBtn');
    const style = routes ? getComputedStyle(routes) : null;
    const rect = gateway?.getBoundingClientRect();
    const cards = routes ? [...routes.querySelectorAll('.h-home-route')] : [];
    const dividers = routes ? [...routes.querySelectorAll('.h-home-route__divider')] : [];
    return {
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      display: style?.display || '',
      columns: style?.gridTemplateColumns?.split(' ').filter(Boolean).length || 0,
      overflowX: style?.overflowX || '',
      scrollSnapType: style?.scrollSnapType || '',
      scrollWidth: routes?.scrollWidth || 0,
      clientWidth: routes?.clientWidth || 0,
      routeCount: cards.length,
      dividerCount: dividers.length,
      dividerWidths: dividers.map((node) => Number.parseFloat(getComputedStyle(node).width)),
      cardWidths: cards.map((node) => node.getBoundingClientRect().width),
      menuDisplay: menu ? getComputedStyle(menu).display : '',
      gatewayWidth: rect?.width || 0,
      left: rect?.left || 0,
      right: rect ? innerWidth - rect.right : 0,
      ambientVisible: [...document.querySelectorAll('.h-ambient-word')]
        .filter((node) => getComputedStyle(node).display !== 'none').length,
    };
  });

  const compactCatalogue = width <= 900;
  assert.equal(state.overflow, false, `${width}×${height}: page-level horizontal overflow`);
  assert.equal(state.routeCount, 5, `${width}×${height}: route count changed`);
  assert.equal(state.dividerCount, 4, `${width}×${height}: divider count changed`);
  assert.equal(
    state.dividerWidths.every((value) => Number.isFinite(value) && Math.abs(value - 1) <= 0.01),
    true,
    `${width}×${height}: divider widths are not uniformly 1px`,
  );

  if (compactCatalogue) {
    assert.equal(state.display, 'flex', `${width}×${height}: compact gateway is not a horizontal catalogue`);
    assert.ok(['auto', 'scroll'].includes(state.overflowX), `${width}×${height}: compact gateway is not horizontally scrollable`);
    assert.match(state.scrollSnapType, /^x\s+mandatory$/, `${width}×${height}: compact gateway lost mandatory x scroll-snap`);
    assert.ok(state.scrollWidth > state.clientWidth + 1, `${width}×${height}: compact gateway has no scrollable overflow`);
    assert.equal(
      state.cardWidths.every((value) => value > 0 && value < state.clientWidth),
      true,
      `${width}×${height}: compact gateway card width is invalid`,
    );
  } else {
    assert.equal(state.display, 'grid', `${width}×${height}: desktop gateway is not a grid`);
    assert.equal(state.columns, 9, `${width}×${height}: desktop gateway must expose five cards and four 1px tracks`);
    assert.ok(state.scrollWidth <= state.clientWidth + 1, `${width}×${height}: desktop gateway unexpectedly scrolls`);
  }

  if (width <= 760) assert.notEqual(state.menuDisplay, 'none', `${width}px: mobile menu hidden`);
  else assert.equal(state.menuDisplay, 'none', `${width}px: mobile menu visible above boundary`);
  if (width >= 1600) {
    assert.ok(state.gatewayWidth <= 1481, `${width}px: gateway exceeded 1480px cap`);
    assert.ok(state.left >= 100 && state.right >= 100, `${width}px: side marginalia safe fields were lost`);
    assert.equal(state.ambientVisible, 32, `${width}px: ambient phrases are not fully visible`);
  } else if (width >= 1480) {
    assert.equal(state.ambientVisible, 16, `${width}px: intermediate marginalia set changed`);
  }
  await assertDirectionObjects(page, `${width}×${height}`);
  await assertVisualRegressionContracts(page, width, height);
}

async function waitForSearchState(page, open) {
  await page.waitForFunction((expected) => {
    const overlay = document.querySelector('.cp-backdrop');
    const actual = Boolean(overlay?.classList.contains('is-open') && getComputedStyle(overlay).display !== 'none');
    return actual === expected;
  }, open);
}

async function waitForProcessedSearch(page, query, expectedTitle) {
  await page.waitForFunction(({ query: expectedQuery, expectedTitle: titleNeedle }) => {
    const input = document.querySelector('.cp-input');
    if (input?.value.trim() !== expectedQuery || document.querySelector('.cp-loading')) return false;
    const headings = [...document.querySelectorAll('.cp-group-hd > span:first-child')]
      .map((node) => node.textContent?.trim() || '');
    const staleHeadings = new Set(['Рекомендуемое', 'Новое', 'Недавние запросы', 'Популярные исследования']);
    const processed = headings.some((heading) => heading && !staleHeadings.has(heading));
    const empty = Boolean(document.querySelector('.cp-empty'));
    const titles = [...document.querySelectorAll('.cp-item-title')]
      .map((node) => (node.textContent || '').toLocaleLowerCase('ru-RU'));
    const titleMatched = !titleNeedle || titles.some((title) => title.includes(titleNeedle.toLocaleLowerCase('ru-RU')));
    return (processed || empty) && titleMatched;
  }, { query, expectedTitle });
}

async function assertSearchUnlocked(page, label) {
  const state = await page.evaluate(() => ({
    lockCount: Number(window.SiteUtils?._scrollLockCount || 0),
    bodyPosition: getComputedStyle(document.body).position,
    bodyOverflow: getComputedStyle(document.body).overflow,
    homeInert: document.querySelector('.home-v20')?.hasAttribute('inert') || false,
    navbarInert: document.querySelector('.h-navbar')?.hasAttribute('inert') || false,
  }));
  assert.equal(state.lockCount, 0, `${label}: search lock count remained non-zero`);
  assert.notEqual(state.bodyPosition, 'fixed', `${label}: body position remained fixed`);
  assert.notEqual(state.bodyOverflow, 'hidden', `${label}: body overflow remained hidden`);
  assert.equal(state.homeInert, false, `${label}: Home content remained inert`);
  assert.equal(state.navbarInert, false, `${label}: navbar remained inert`);
}

async function openSearch(page, selector) {
  await page.locator(selector).click();
  await waitForSearchState(page, true);
  const input = page.locator('.cp-input');
  await input.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('.cp-input') === document.activeElement);
  return input;
}

async function assertSearchLifecycle(page, browserName) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await setThemeForEvidence(page, false);
  await page.evaluate(() => window.scrollTo(0, 0));

  const input = await openSearch(page, '#gbSearchBtn');
  const dialogState = await page.locator('.cp-backdrop').evaluate((overlay) => ({
    id: overlay.id,
    role: overlay.getAttribute('role'),
    modal: overlay.getAttribute('aria-modal'),
    hidden: overlay.getAttribute('aria-hidden'),
    count: document.querySelectorAll('.cp-backdrop').length,
    homeInert: document.querySelector('.home-v20')?.hasAttribute('inert') || false,
    navbarInert: document.querySelector('.h-navbar')?.hasAttribute('inert') || false,
    triggerExpanded: document.getElementById('gbSearchBtn')?.getAttribute('aria-expanded'),
    triggerControls: document.getElementById('gbSearchBtn')?.getAttribute('aria-controls'),
    lockCount: Number(window.SiteUtils?._scrollLockCount || 0),
  }));
  assert.equal(dialogState.id, 'gbCommandPalette', `${browserName}: search dialog id is unstable`);
  assert.equal(dialogState.role, 'dialog', `${browserName}: search is not exposed as a dialog`);
  assert.equal(dialogState.modal, 'true', `${browserName}: search is not modal`);
  assert.equal(dialogState.hidden, 'false', `${browserName}: open search is hidden from accessibility tree`);
  assert.equal(dialogState.count, 1, `${browserName}: search initialized more than once`);
  assert.equal(dialogState.homeInert, true, `${browserName}: Home content is not isolated behind search`);
  assert.equal(dialogState.navbarInert, true, `${browserName}: navbar is not isolated behind search`);
  assert.equal(dialogState.triggerExpanded, 'true', `${browserName}: search trigger state is stale`);
  assert.equal(dialogState.triggerControls, 'gbCommandPalette', `${browserName}: search trigger is not connected to dialog`);
  assert.ok(dialogState.lockCount >= 1, `${browserName}: search did not lock page scroll`);

  const closeControl = page.locator('.cp-home-close');
  await closeControl.waitFor({ state: 'visible' });
  const closeBox = await closeControl.boundingBox();
  assert.ok(closeBox && closeBox.width >= 43 && closeBox.height >= 43, `${browserName}: search close target is smaller than 44px`);

  await input.fill('Нагорная проповедь');
  await waitForProcessedSearch(page, 'Нагорная проповедь', 'Нагорная проповедь');
  const resultCount = await page.locator('.cp-item').count();
  assert.ok(resultCount > 0, `${browserName}: canonical query returned no results`);
  assert.match((await page.locator('.cp-status').textContent()) || '', /\d+\s+рез\./, `${browserName}: result status is missing`);
  assert.match((await page.locator('.cp-item-title').first().textContent()) || '', /Нагорная\s+проповедь/i, `${browserName}: exact title query is not ranked first`);
  assert.equal(await page.locator('.cp-item.is-active').first().getAttribute('aria-selected'), 'true', `${browserName}: active search result is not announced`);

  const focusables = page.locator('#gbCommandPalette :is(input, button, a[href], [tabindex]:not([tabindex="-1"])):visible');
  const focusableCount = await focusables.count();
  assert.ok(focusableCount >= 5, `${browserName}: search exposes too few focusable controls`);
  await focusables.last().focus();
  await page.keyboard.press('Tab');
  assert.equal(await focusables.first().evaluate((element) => element === document.activeElement), true, `${browserName}: Tab escaped search dialog`);
  await focusables.first().focus();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await focusables.last().evaluate((element) => element === document.activeElement), true, `${browserName}: Shift+Tab escaped search dialog`);

  await closeControl.click();
  await waitForSearchState(page, false);
  await assertSearchUnlocked(page, `${browserName} desktop close`);
  assert.equal(await page.locator('#gbSearchBtn').getAttribute('aria-expanded'), 'false', `${browserName}: closed search trigger remained expanded`);

  await page.setViewportSize({ width: 390, height: 844 });
  const menuButton = page.locator('#hMobileMenuBtn');
  await menuButton.click();
  await page.waitForFunction(() => document.getElementById('hMobileNav')?.classList.contains('open'));
  await page.locator('#hMobileNav [data-action="open-search"]').click();
  await waitForSearchState(page, true);
  await page.waitForFunction(() => !document.getElementById('hMobileNav')?.classList.contains('open'));
  assert.equal(await page.locator('#hMobileNav').getAttribute('aria-hidden'), 'true', `${browserName}: mobile menu remained exposed behind search`);
  assert.equal(await page.locator('.cp-input').evaluate((element) => element === document.activeElement), true, `${browserName}: menu-to-search transition lost input focus`);
  assert.equal(await page.locator('.cp-backdrop').count(), 1, `${browserName}: menu transition duplicated search`);

  const scopeGeometry = await page.evaluate(() => {
    const row = document.querySelector('.cp-scope-row')?.getBoundingClientRect();
    const first = document.querySelector('.cp-scope-chip:first-child')?.getBoundingClientRect();
    const last = document.querySelector('.cp-scope-chip:last-child')?.getBoundingClientRect();
    return row && first && last ? {
      rowLeft: row.left,
      rowRight: row.right,
      firstLeft: first.left,
      lastRight: last.right,
    } : null;
  });
  assert.ok(scopeGeometry
    && scopeGeometry.firstLeft >= scopeGeometry.rowLeft - 1
    && scopeGeometry.lastRight <= scopeGeometry.rowRight + 1,
  `${browserName}: mobile search scopes are clipped at rest`);

  await page.locator('.cp-input').fill('Иер 17:9');
  await waitForProcessedSearch(page, 'Иер 17:9', 'сердц');
  assert.ok(await page.locator('.cp-item').count() > 0, `${browserName}: scripture query returned no material`);
  await page.locator('.cp-home-close').click();
  await waitForSearchState(page, false);
  await assertSearchUnlocked(page, `${browserName} mobile close`);

  for (let cycle = 0; cycle < 3; cycle += 1) {
    await openSearch(page, '#gbSearchBtn');
    assert.equal(await page.locator('.cp-backdrop').count(), 1, `${browserName}: search duplicated during reopen cycle ${cycle + 1}`);
    await page.locator('.cp-home-close').click();
    await waitForSearchState(page, false);
    await assertSearchUnlocked(page, `${browserName} reopen cycle ${cycle + 1}`);
  }
}

async function settleForEvidence(page) {
  await page.evaluate(async () => {
    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    for (const element of document.querySelectorAll('.h-reveal')) {
      element.scrollIntoView({ behavior: 'auto', block: 'center' });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await pause(55);
    }
    window.scrollTo(0, 0);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await pause(300);
  });
}

async function captureCompactEvidence(page, browserName) {
  if (browserName !== 'chromium') return [];
  const captures = [];
  const shot = async (file) => {
    await page.screenshot({ path: path.join(REPORT_DIR, file), fullPage: false });
    captures.push(file);
  };

  await page.setViewportSize({ width: 1280, height: 900 });
  await setThemeForEvidence(page, false);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(180);
  await shot('chromium-home-hero-light.png');

  await page.locator('#issledovat').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -84));
  await page.waitForTimeout(160);
  await shot('chromium-home-directions-light.png');

  await page.locator('#publikacii').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -84));
  await page.waitForTimeout(160);
  await shot('chromium-home-publications-light.png');

  await page.locator('.h-about').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -70));
  await page.waitForTimeout(160);
  await shot('chromium-home-terminal-light.png');

  await page.evaluate(() => window.scrollTo(0, 0));
  let input = await openSearch(page, '#gbSearchBtn');
  await input.fill('Нагорная проповедь');
  await waitForProcessedSearch(page, 'Нагорная проповедь', 'Нагорная проповедь');
  await shot('chromium-search-desktop-light.png');
  await page.locator('.cp-home-close').click();
  await waitForSearchState(page, false);

  await setThemeForEvidence(page, true);
  input = await openSearch(page, '#gbSearchBtn');
  await input.fill('Нагорная проповедь');
  await waitForProcessedSearch(page, 'Нагорная проповедь', 'Нагорная проповедь');
  await shot('chromium-search-desktop-dark.png');
  await page.locator('.cp-home-close').click();
  await waitForSearchState(page, false);

  await setThemeForEvidence(page, false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(160);
  await shot('chromium-home-mobile-light.png');

  input = await openSearch(page, '#gbSearchBtn');
  await input.fill('Иер 17:9');
  await waitForProcessedSearch(page, 'Иер 17:9', 'сердц');
  await shot('chromium-search-mobile-light.png');
  await page.locator('.cp-home-close').click();
  await waitForSearchState(page, false);
  await assertSearchUnlocked(page, 'compact evidence cleanup');

  return captures;
}

async function captureEvidence(page, browserName) {
  if (browserName !== 'chromium') return [];
  const captures = [];
  for (const viewport of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet', width: 820, height: 1180 },
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'wide', width: 1720, height: 980 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await settleForEvidence(page);
    await assertDirectionObjects(page, `${viewport.name} evidence`);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
      true,
      `${viewport.name} evidence has horizontal overflow`,
    );
    for (const theme of ['light', 'dark']) {
      await setThemeForEvidence(page, theme === 'dark');
      await page.waitForTimeout(180);
      const file = `${browserName}-${viewport.name}-${theme}.png`;
      await page.screenshot({ path: path.join(REPORT_DIR, file), fullPage: true });
      captures.push(file);
    }
  }
  await setThemeForEvidence(page, false);
  return captures;
}

export async function runResponsiveEvidence(browserName, browserType, baseUrl) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
    locale: 'ru-RU',
    colorScheme: 'light',
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    const knownWebKitDiagnostic = browserName === 'webkit'
      && text === 'Viewport argument key "interactive-widget" not recognized and ignored.';
    if (!knownWebKitDiagnostic) runtimeErrors.push(`console: ${text}`);
  });

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    for (const spec of [
      [320, 568],
      [390, 844],
      [760, 900],
      [761, 900],
      [820, 1180],
      [900, 900],
      [901, 900],
      [1024, 450],
      [1280, 900],
      [1480, 900],
      [1720, 980],
    ]) await assertResponsiveLayout(page, ...spec);

    await assertSearchLifecycle(page, browserName);
    const compactEvidence = await captureCompactEvidence(page, browserName);
    const evidence = [...await captureEvidence(page, browserName), ...compactEvidence];
    assert.deepEqual(runtimeErrors, [], `responsive evidence runtime errors: ${runtimeErrors.join(' | ')}`);
    return { browser: `${browserName}-responsive-evidence`, result: 'PASS', evidence };
  } finally {
    await context.close();
    await browser.close();
  }
}

export async function runResponsiveNoJavaScript(browserName, browserType, baseUrl) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: false,
    locale: 'ru-RU',
  });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'load' });
    await assertDirectionObjects(page, `${browserName} no-JS evidence`);
    for (const [width, height] of [[320, 568], [390, 844], [820, 1180], [1024, 450], [1480, 900], [1720, 980]]) {
      await page.setViewportSize({ width, height });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
        true,
        `no-JS overflow at ${width}×${height}`,
      );
    }
    return { browser: `${browserName}-responsive-no-js`, result: 'PASS' };
  } finally {
    await context.close();
    await browser.close();
  }
}
