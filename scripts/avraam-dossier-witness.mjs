#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE_URL = process.env.AUDIT_BASE || 'http://127.0.0.1:8090';
const ROUTE_URL = `${BASE_URL}/karty/avraam/`;
const OUT_ROOT = path.resolve(process.env.AVRAAM_DOSSIER_OUT || 'reports/atlas/avraam-dossier-witness');
const HEAD_SHA = process.env.HEAD_SHA || process.env.GITHUB_SHA || 'local';
const RUN_ID = process.env.GITHUB_RUN_ID || 'local';
const SOURCE_ROUTE = JSON.parse(fs.readFileSync(path.resolve('karty/avraam/route.json'), 'utf8'));
const VARIANTS = SOURCE_ROUTE.scientific_variants || SOURCE_ROUTE.variants || {};
const VIEWPORTS = [
  { id: 'desktop-1440x900', width: 1440, height: 900 },
  { id: 'mobile-390x844', width: 390, height: 844 },
];
const TAB_SPEC = [
  ['story', place => Boolean(place.story)],
  ['bible', place => Boolean(place.bible)],
  ['arch', place => Boolean(place.arch)],
  ['he', place => Boolean(place.he_deep)],
  ['dispute', place => Boolean(place.dispute)],
  ['sci', place => Boolean(VARIANTS[place.id])],
  ['photos', place => Array.isArray(place.photos) && place.photos.length > 0],
  ['extra', place => Boolean(place.bible_extra)],
];
const ROUTE_PLACES = SOURCE_ROUTE.places.filter(place => Number.isInteger(place.stage));
const CONTEXT_PLACES = SOURCE_ROUTE.places.filter(place => !Number.isInteger(place.stage));

fs.mkdirSync(OUT_ROOT, { recursive: true });
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const safeName = value => String(value || 'unknown').toLowerCase().replace(/[^a-z0-9а-яё_-]+/giu, '-').replace(/^-+|-+$/g, '');
const failures = [];
const warnings = [];
const records = [];
const fail = (scope, message) => failures.push(`${scope}: ${message}`);
const warn = (scope, message) => warnings.push(`${scope}: ${message}`);

function expectedTabs(place) {
  return TAB_SPEC.filter(([, available]) => available(place)).map(([id]) => id);
}

function sourceAudit() {
  const issues = [];
  if (ROUTE_PLACES.length !== 19) issues.push(`route places ${ROUTE_PLACES.length} != 19`);
  if (CONTEXT_PLACES.length !== 3) issues.push(`context places ${CONTEXT_PLACES.length} != 3`);
  for (const place of ROUTE_PLACES) {
    const tabs = expectedTabs(place);
    if (tabs.length !== 8) issues.push(`${place.id}: expected 8 tabs, found ${tabs.length} (${tabs.join(',')})`);
  }
  for (const place of CONTEXT_PLACES) {
    if (expectedTabs(place).length) issues.push(`${place.id}: context point unexpectedly has dossier tabs`);
  }
  return {
    counts: {
      routePlaces: ROUTE_PLACES.length,
      contextPlaces: CONTEXT_PLACES.length,
      tabsPerRoutePlace: [...new Set(ROUTE_PLACES.map(place => expectedTabs(place).length))],
      expectedStatesPerViewport: ROUTE_PLACES.reduce((sum, place) => sum + expectedTabs(place).length, 0),
    },
    issues,
  };
}

async function verifyStaticNavigation(page, scope) {
  const contract = await page.evaluate(() => {
    const skip = document.querySelector('[data-map-skip-link]');
    const lifecycleHeading = document.querySelector('h1.sr-only[data-pagefind-body]');
    const fallback = document.querySelector('[data-map-static-projection]');
    const stage = document.querySelector('[data-map-stage]');
    const precedes = (a, b) => Boolean(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
    return {
      skipCount: document.querySelectorAll('[data-map-skip-link]').length,
      href: skip?.getAttribute('href') || null,
      text: (skip?.textContent || '').replace(/\s+/g, ' ').trim(),
      lifecycleHeadingPresent: Boolean(lifecycleHeading),
      stageTabIndex: stage?.tabIndex ?? null,
      stageTabIndexAttribute: stage?.getAttribute('tabindex') || null,
      order: {
        skipBeforeFallback: precedes(skip, fallback),
        fallbackBeforeStage: precedes(fallback, stage),
      },
    };
  });
  if (contract.skipCount !== 1) fail(scope, `skip-link count ${contract.skipCount}`);
  if (contract.href !== '#stage') fail(scope, `skip-link href ${contract.href}`);
  if (!contract.text) fail(scope, 'skip-link has no accessible text');
  if (contract.stageTabIndex !== -1 || contract.stageTabIndexAttribute !== '-1') fail(scope, `stage tabindex ${contract.stageTabIndexAttribute}/${contract.stageTabIndex}`);
  if (!Object.values(contract.order).every(Boolean)) fail(scope, `static reading order ${JSON.stringify(contract.order)}`);

  await page.evaluate(() => {
    document.body.setAttribute('tabindex', '-1');
    document.body.focus({ preventScroll: true });
    document.body.removeAttribute('tabindex');
  });
  await page.keyboard.press('Tab');
  const focusedSkip = await page.evaluate(() => document.activeElement?.hasAttribute?.('data-map-skip-link') || false);
  if (!focusedSkip) fail(scope, 'first keyboard Tab did not reach the skip link');
  const focusedGeometry = await page.locator('[data-map-skip-link]').evaluate(node => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return { width: rect.width, height: rect.height, top: rect.top, left: rect.left, visibility: style.visibility, display: style.display };
  });
  if (focusedGeometry.width < 44 || focusedGeometry.height < 44 || focusedGeometry.top < -1 || focusedGeometry.left < -1 || focusedGeometry.visibility === 'hidden' || focusedGeometry.display === 'none') {
    fail(scope, `focused skip-link is not a visible 44px target ${JSON.stringify(focusedGeometry)}`);
  }
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement?.id === 'stage');
  const focusedAfterActivation = await page.evaluate(() => ({ id: document.activeElement?.id || null, hash: location.hash }));
  if (focusedAfterActivation.id !== 'stage' || focusedAfterActivation.hash !== '#stage') fail(scope, `skip activation ${JSON.stringify(focusedAfterActivation)}`);
  await page.evaluate(() => history.replaceState(null, '', location.pathname + location.search));
  return { ...contract, focusedSkip, focusedGeometry, focusedAfterActivation };
}

async function waitForMap(page, scope) {
  page.setDefaultTimeout(8000);
  await page.goto(ROUTE_URL, { waitUntil: 'networkidle', timeout: 120000 });
  await page.addStyleTag({ content: '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;scroll-behavior:auto!important;caret-color:transparent!important}' });
  const staticNavigation = await verifyStaticNavigation(page, `${scope}/static-navigation`);
  await page.waitForFunction(() => {
    const stage = document.querySelector('[data-map-stage]');
    return Boolean(document.querySelector('.me-map,#mapRoot') && document.querySelector('.me-canvas svg,.me-map svg,#mapRoot svg') && (stage?.getAttribute('data-map-state') === 'ready' || !stage));
  }, { timeout: 60000 });
  const introStart = page.getByRole('button', { name: /Начать изучение/i });
  if (await introStart.isVisible().catch(() => false)) {
    await introStart.click({ force: true });
    await page.locator('.me-intro').waitFor({ state: 'detached', timeout: 2500 }).catch(() => {});
  }
  const mainStory = page.locator('[data-story="main"]');
  if (await mainStory.count()) {
    await mainStory.first().click({ force: true }).catch(() => mainStory.first().evaluate(node => node.click()));
    await page.waitForTimeout(120);
  }

  // The dossier inventory covers every route place, including places on
  // default-off candidate/war layers. Enable those layers through their real
  // controls before exercising markers; do not synthesize clicks on hidden DOM.
  const layerSummary = page.locator('.me-layers__summary');
  const disabledLayers = page.locator('.me-layers__toggle[aria-pressed="false"]');
  if (await disabledLayers.count()) {
    if (await layerSummary.count()) await layerSummary.click();
    while (await disabledLayers.count()) {
      await disabledLayers.first().click();
      await page.waitForTimeout(40);
    }
  }
  return staticNavigation;
}

async function closePanel(page) {
  if (await page.locator('.me-panel--open').count()) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(80);
  }
  if (await page.locator('.me-panel--open').count()) {
    await page.locator('.me-panel__close:visible').click({ force: true }).catch(() => {});
    await page.waitForTimeout(80);
  }
}

async function inspectPanel(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('.me-panel--open');
    const tablist = panel?.querySelector('.me-tabs[role="tablist"]');
    const content = panel?.querySelector('.me-content[role="tabpanel"]');
    const isVisible = node => {
      if (!node) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    };
    const rect = node => node ? node.getBoundingClientRect().toJSON() : null;
    const parseCssColor = value => {
      value = String(value || '').trim().toLowerCase();
      if (!value || value === 'transparent') return [0, 0, 0, 0];
      let match = value.match(/^rgba?\((.+)\)$/);
      if (match) {
        const parts = match[1].replace(/\//g, ' ').split(/[\s,]+/).filter(Boolean);
        const channel = token => token.endsWith('%') ? Math.max(0, Math.min(255, parseFloat(token) * 2.55)) : Math.max(0, Math.min(255, parseFloat(token)));
        const alpha = parts[3] === undefined ? 1 : (parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]));
        return [channel(parts[0]), channel(parts[1]), channel(parts[2]), Math.max(0, Math.min(1, alpha))];
      }
      match = value.match(/^color\(srgb\s+(.+)\)$/);
      if (match) {
        const parts = match[1].replace(/\//g, ' ').split(/\s+/).filter(Boolean);
        const channel = token => token.endsWith('%') ? parseFloat(token) * 2.55 : parseFloat(token) * 255;
        const alpha = parts[3] === undefined ? 1 : (parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]));
        return [channel(parts[0]), channel(parts[1]), channel(parts[2]), Math.max(0, Math.min(1, alpha))];
      }
      return null;
    };
    const composite = (foreground, background) => {
      const fa = foreground[3], ba = background[3], alpha = fa + ba * (1 - fa);
      if (alpha <= 0) return [0, 0, 0, 0];
      return [
        (foreground[0] * fa + background[0] * ba * (1 - fa)) / alpha,
        (foreground[1] * fa + background[1] * ba * (1 - fa)) / alpha,
        (foreground[2] * fa + background[2] * ba * (1 - fa)) / alpha,
        alpha,
      ];
    };
    const effectiveBackground = node => {
      const chain = [];
      for (let current = node?.parentElement; current; current = current.parentElement) chain.push(current);
      let background = [255, 255, 255, 1];
      for (const current of chain.reverse()) {
        const parsed = parseCssColor(getComputedStyle(current).backgroundColor);
        if (parsed && parsed[3] > 0) background = composite(parsed, background);
      }
      return background;
    };
    const luminance = rgb => {
      const linear = rgb.slice(0, 3).map(channel => {
        const value = channel / 255;
        return value <= .04045 ? value / 12.92 : Math.pow((value + .055) / 1.055, 2.4);
      });
      return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
    };
    const contrastSample = node => {
      const declared = getComputedStyle(node).color;
      const foreground = parseCssColor(declared);
      const background = effectiveBackground(node);
      if (!foreground) return { text: (node.textContent || '').trim().slice(0, 160), className: node.className, declared, valid: false, contrast: null };
      const painted = composite(foreground, background);
      const l1 = luminance(painted), l2 = luminance(background);
      const contrast = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
      return {
        text: (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
        className: node.className,
        declared,
        foreground: painted.slice(0, 3).map(value => Number(value.toFixed(2))),
        background: background.slice(0, 3).map(value => Number(value.toFixed(2))),
        valid: Number.isFinite(contrast),
        contrast: Number(contrast.toFixed(3)),
      };
    };
    const tabs = tablist ? Array.from(tablist.querySelectorAll('.me-tab[data-tab]')).map(node => ({
      id: node.id,
      tab: node.getAttribute('data-tab'),
      selected: node.getAttribute('aria-selected'),
      controls: node.getAttribute('aria-controls'),
      tabIndex: node.tabIndex,
      focused: document.activeElement === node,
      rect: rect(node),
      visible: isVisible(node),
    })) : [];
    const selected = tabs.filter(tab => tab.selected === 'true');
    const controls = panel ? Array.from(panel.querySelectorAll('button,[role="button"],[role="tab"]')).filter(isVisible).map(node => ({
      tag: node.tagName.toLowerCase(),
      text: (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      tab: node.getAttribute('data-tab'),
      rect: rect(node),
    })) : [];
    const links = content ? Array.from(content.querySelectorAll('a[href]')).filter(isVisible).map(node => ({
      text: (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      href: node.getAttribute('href') || '',
    })) : [];
    const panelRect = rect(panel);
    const contentRect = rect(content);
    const activeTabRect = selected[0]?.rect || null;
    const tablistRect = rect(tablist);
    const images = content ? Array.from(content.querySelectorAll('img')).map(img => ({
      alt: img.alt,
      src: img.getAttribute('src'),
      complete: img.complete,
      naturalWidth: img.naturalWidth,
    })) : [];
    const archMetadata = content ? Array.from(content.querySelectorAll('.map-arch-source__meta')).filter(isVisible).map(contrastSample) : [];
    return {
      viewport: { width: innerWidth, height: innerHeight },
      panel: panel ? {
        rect: panelRect,
        scrollWidth: panel.scrollWidth,
        clientWidth: panel.clientWidth,
        scrollHeight: panel.scrollHeight,
        clientHeight: panel.clientHeight,
      } : null,
      heading: panel?.querySelector('.me-panel__name')?.textContent?.trim() || '',
      tablist: tablist ? {
        rect: tablistRect,
        scrollWidth: tablist.scrollWidth,
        clientWidth: tablist.clientWidth,
        role: tablist.getAttribute('role'),
        ariaLabel: tablist.getAttribute('aria-label'),
      } : null,
      tabs,
      selected,
      content: content ? {
        id: content.id,
        labelledBy: content.getAttribute('aria-labelledby'),
        role: content.getAttribute('role'),
        tabIndex: content.tabIndex,
        textLength: (content.innerText || '').trim().length,
        htmlLength: content.innerHTML.length,
        rect: contentRect,
        scrollWidth: content.scrollWidth,
        clientWidth: content.clientWidth,
        scrollHeight: content.scrollHeight,
        clientHeight: content.clientHeight,
        scrollTop: content.scrollTop,
      } : null,
      activeTabFullyVisible: Boolean(activeTabRect && tablistRect && activeTabRect.left >= tablistRect.left - 1 && activeTabRect.right <= tablistRect.right + 1),
      controls,
      links,
      images,
      archMetadata,
      variantRows: content?.querySelectorAll('.me-sci-item').length || 0,
      photoLabels: content?.querySelectorAll('.me-photo-label').length || 0,
      documentActive: {
        tag: document.activeElement?.tagName?.toLowerCase() || null,
        id: document.activeElement?.id || null,
        tab: document.activeElement?.getAttribute?.('data-tab') || null,
        placeId: document.activeElement?.getAttribute?.('data-place-id') || null,
      },
    };
  });
}

function validatePanel(scope, state, place, tabId, expected, viewport) {
  if (!state.panel) return fail(scope, 'panel missing');
  const p = state.panel.rect;
  if (p.left < -2 || p.top < -2 || p.right > viewport.width + 2 || p.bottom > viewport.height + 2) fail(scope, `panel outside viewport ${JSON.stringify(p)}`);
  if (state.panel.scrollWidth > state.panel.clientWidth + 2) fail(scope, `panel horizontal overflow ${state.panel.scrollWidth}/${state.panel.clientWidth}`);
  if (state.heading !== place.name) fail(scope, `heading mismatch ${JSON.stringify(state.heading)} != ${JSON.stringify(place.name)}`);
  if (!state.tablist || state.tablist.role !== 'tablist') fail(scope, 'tablist missing or invalid');
  const actualTabs = state.tabs.map(tab => tab.tab);
  if (JSON.stringify(actualTabs) !== JSON.stringify(expected)) fail(scope, `tab inventory ${actualTabs.join(',')} != ${expected.join(',')}`);
  if (new Set(state.tabs.map(tab => tab.id)).size !== state.tabs.length) fail(scope, 'duplicate tab ids');
  if (state.selected.length !== 1 || state.selected[0].tab !== tabId) fail(scope, `selected tab mismatch ${state.selected.map(tab => tab.tab).join(',')} != ${tabId}`);
  const selected = state.selected[0];
  if (selected?.tabIndex !== 0) fail(scope, `selected tabindex ${selected?.tabIndex}`);
  for (const tab of state.tabs.filter(item => item.tab !== tabId)) if (tab.tabIndex !== -1) fail(scope, `inactive tab ${tab.tab} tabindex ${tab.tabIndex}`);
  if (!state.content || state.content.role !== 'tabpanel') fail(scope, 'tabpanel missing');
  if (state.content?.labelledBy !== selected?.id) fail(scope, `tabpanel aria-labelledby ${state.content?.labelledBy} != ${selected?.id}`);
  if (selected?.controls !== state.content?.id) fail(scope, `aria-controls ${selected?.controls} != ${state.content?.id}`);
  if (!state.activeTabFullyVisible) fail(scope, 'active tab is clipped in horizontal tab strip');
  if (state.content && state.content.scrollWidth > state.content.clientWidth + 2) fail(scope, `content horizontal overflow ${state.content.scrollWidth}/${state.content.clientWidth}`);
  if (tabId === 'photos') {
    const expectedPhotos = place.photos?.length || 0;
    if (state.images.length !== expectedPhotos) fail(scope, `photo count ${state.images.length} != ${expectedPhotos}`);
    if (state.images.some(image => !image.alt?.trim())) fail(scope, 'photo without alt text');
    if (state.photoLabels !== expectedPhotos) fail(scope, `photo labels ${state.photoLabels} != ${expectedPhotos}`);
  } else if (tabId === 'sci') {
    const expectedRows = Array.isArray(VARIANTS[place.id]) ? VARIANTS[place.id].length : 0;
    if (state.variantRows !== expectedRows) fail(scope, `scientific rows ${state.variantRows} != ${expectedRows}`);
  } else if ((state.content?.textLength || 0) < 20) {
    fail(scope, `content too short (${state.content?.textLength || 0})`);
  }
  if (tabId === 'arch') {
    for (const sample of state.archMetadata || []) {
      if (!sample.valid || !Number.isFinite(sample.contrast)) fail(scope, `unparseable archaeology metadata color ${JSON.stringify(sample)}`);
      else if (sample.contrast < 4.5) fail(scope, `archaeology metadata contrast ${sample.contrast}:1 < 4.5:1 :: ${sample.text}`);
    }
  }
  for (const control of state.controls) {
    if (control.rect.width < 44 - .5 || control.rect.height < 44 - .5) fail(scope, `undersized control ${control.tab || control.text || control.tag}: ${control.rect.width.toFixed(1)}x${control.rect.height.toFixed(1)}`);
  }
  for (const link of state.links || []) if (!link.href.trim()) fail(scope, `content link without href: ${link.text}`);
}

async function verifyKeyboard(page, placeScope, expectedTabs) {
  const first = page.locator('.me-tab[data-tab]').first();
  if (!(await first.count())) return fail(placeScope, 'keyboard: no first tab');
  await first.focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(40);
  let state = await inspectPanel(page);
  if (state.selected[0]?.tab !== expectedTabs[1]) fail(placeScope, `keyboard ArrowRight selected ${state.selected[0]?.tab}`);
  if (state.documentActive.tab !== expectedTabs[1]) fail(placeScope, `keyboard ArrowRight focus ${state.documentActive.tab}`);
  await page.keyboard.press('End');
  await page.waitForTimeout(40);
  state = await inspectPanel(page);
  if (state.selected[0]?.tab !== expectedTabs.at(-1)) fail(placeScope, `keyboard End selected ${state.selected[0]?.tab}`);
  await page.keyboard.press('Home');
  await page.waitForTimeout(40);
  state = await inspectPanel(page);
  if (state.selected[0]?.tab !== expectedTabs[0]) fail(placeScope, `keyboard Home selected ${state.selected[0]?.tab}`);
}

async function verifyContentScroll(page, scope) {
  const content = page.locator('.me-content[role="tabpanel"]');
  const geometry = await content.evaluate(node => ({ max: Math.max(0, node.scrollHeight - node.clientHeight), top: node.scrollTop }));
  if (geometry.max > 24) {
    await content.evaluate(node => { node.scrollTop = node.scrollHeight; });
    await page.waitForTimeout(30);
    const bottom = await content.evaluate(node => ({ top: node.scrollTop, max: Math.max(0, node.scrollHeight - node.clientHeight) }));
    if (bottom.top < bottom.max - 2) fail(scope, `content did not reach bottom ${bottom.top}/${bottom.max}`);
    await content.evaluate(node => { node.scrollTop = 0; });
  }
  return geometry.max;
}

async function runViewport(browser, viewport) {
  const viewportDir = path.join(OUT_ROOT, viewport.id);
  fs.mkdirSync(viewportDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, colorScheme: 'dark', reducedMotion: 'reduce' });
  const page = await context.newPage();
  const consoleEvents = [];
  const failedRequests = [];
  page.on('console', message => { if (message.type() === 'error') consoleEvents.push(message.text()); });
  page.on('pageerror', error => consoleEvents.push(`pageerror: ${error.message}`));
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText || 'failed' }));
  const result = { viewport, staticNavigation: null, places: [], contextPoints: [], stateCount: 0, failures: [], warnings: [] };
  const failureStart = failures.length;
  const warningStart = warnings.length;
  try {
    result.staticNavigation = await waitForMap(page, viewport.id);
    for (const place of ROUTE_PLACES) {
      const placeScope = `${viewport.id}/${place.id}`;
      const placeDir = path.join(viewportDir, safeName(place.id));
      fs.mkdirSync(placeDir, { recursive: true });
      await closePanel(page);
      const marker = page.locator(`[data-place-id="${place.id}"]`).first();
      if (!(await marker.count())) { fail(placeScope, 'marker missing'); continue; }
      await marker.focus();
      const markerEntry = await marker.evaluate(node => ({
        focused: document.activeElement === node,
        role: node.getAttribute('role'),
        tabIndex: node.tabIndex,
        ariaHidden: node.getAttribute('aria-hidden'),
        layerHidden: node.getAttribute('data-me-layer-hidden'),
      }));
      if (!markerEntry.focused || markerEntry.role !== 'button' || markerEntry.tabIndex !== 0 || markerEntry.ariaHidden === 'true' || markerEntry.layerHidden === '1') {
        fail(placeScope, `marker is not keyboard-reachable ${JSON.stringify(markerEntry)}`);
        continue;
      }
      await page.keyboard.press('Enter');
      await page.locator('.me-panel--open').waitFor({ state: 'visible', timeout: 5000 });
      await page.waitForTimeout(70);
      const expected = expectedTabs(place);
      const actual = await page.locator('.me-tab[data-tab]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-tab')));
      if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(placeScope, `initial tab inventory ${actual.join(',')} != ${expected.join(',')}`);
      await verifyKeyboard(page, placeScope, expected);
      const states = [];
      for (const tabId of expected) {
        const scope = `${placeScope}/${tabId}`;
        const tab = page.locator(`.me-tab[data-tab="${tabId}"]`);
        if (!(await tab.count())) { fail(scope, 'tab missing'); continue; }
        await tab.evaluate(node => node.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' }));
        await page.waitForFunction(node => {
          const strip = node.closest('.me-tabs');
          if (!strip) return false;
          const tabRect = node.getBoundingClientRect();
          const stripRect = strip.getBoundingClientRect();
          return tabRect.left >= stripRect.left - 1 && tabRect.right <= stripRect.right + 1;
        }, await tab.elementHandle());
        await tab.click();
        // renderTabContent enters at translateX(4px) and settles on the next
        // animation frame. Geometry must describe the steady panel, not a
        // transient four-pixel entrance transform on a busy CI runner.
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.waitForFunction(() => {
          const content = document.querySelector('.me-content[role="tabpanel"]');
          if (!content) return false;
          const transform = getComputedStyle(content).transform;
          if (transform === 'none') return true;
          try { return Math.abs(new DOMMatrixReadOnly(transform).m41) < 0.25; }
          catch { return false; }
        });
        const state = await inspectPanel(page);
        validatePanel(scope, state, place, tabId, expected, viewport);
        const contentMaxScroll = await verifyContentScroll(page, scope);
        const screenshot = path.join(placeDir, `${safeName(tabId)}.jpg`);
        await page.locator('.me-panel--open').screenshot({ path: screenshot, type: 'jpeg', quality: 82, animations: 'disabled' });
        states.push({ tab: tabId, screenshot: path.relative(OUT_ROOT, screenshot), state, contentMaxScroll });
        result.stateCount += 1;
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(70);
      const closed = !(await page.locator('.me-panel--open').count());
      if (!closed) fail(placeScope, 'Escape did not close panel');
      const focusedPlace = await page.evaluate(() => document.activeElement?.getAttribute?.('data-place-id') || null);
      if (focusedPlace !== place.id) fail(placeScope, `focus was not restored to marker (${focusedPlace})`);
      result.places.push({ id: place.id, name: place.name, expectedTabs: expected, states, closed, focusedPlace });
    }

    for (const place of CONTEXT_PLACES) {
      const scope = `${viewport.id}/context/${place.id}`;
      await closePanel(page);
      const marker = page.locator(`[data-place-id="${place.id}"]`).first();
      const present = Boolean(await marker.count());
      let panelOpened = false;
      let markerState = null;
      if (present) {
        markerState = await marker.evaluate(node => ({
          role: node.getAttribute('role'),
          tabIndex: node.getAttribute('tabindex'),
          ariaHidden: node.getAttribute('aria-hidden'),
        }));
        if (markerState.role || markerState.tabIndex !== null || markerState.ariaHidden !== 'true') {
          fail(scope, `context point is unexpectedly interactive ${JSON.stringify(markerState)}`);
        }
        await marker.evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
        await page.waitForTimeout(100);
        panelOpened = Boolean(await page.locator('.me-panel--open').count());
      }
      if (panelOpened) fail(scope, 'context point opened a route dossier');
      result.contextPoints.push({ id: place.id, present, panelOpened, markerState });
    }
  } catch (error) {
    fail(viewport.id, `fatal: ${error.message}`);
    result.fatal = { message: error.message, stack: error.stack };
    await page.screenshot({ path: path.join(viewportDir, 'FATAL.png'), fullPage: true }).catch(() => {});
  } finally {
    const blockingRequests = failedRequests.filter(item => {
      try {
        const url = new URL(item.url);
        return url.origin === new URL(BASE_URL).origin || item.resourceType !== 'image';
      } catch {
        return true;
      }
    });
    const remoteImageFailures = failedRequests.filter(item => !blockingRequests.includes(item));
    for (const item of blockingRequests) fail(viewport.id, `failed request ${item.resourceType}: ${item.url} :: ${item.error}`);
    for (const item of remoteImageFailures) warn(viewport.id, `remote image failed: ${item.url} :: ${item.error}`);
    for (const message of consoleEvents) fail(viewport.id, `console: ${message}`);
    result.consoleEvents = consoleEvents;
    result.failedRequests = failedRequests;
    result.failures = failures.slice(failureStart);
    result.warnings = warnings.slice(warningStart);
    await context.close();
  }
  return result;
}

const audit = sourceAudit();
for (const issue of audit.issues) fail('source', issue);
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of VIEWPORTS) records.push(await runViewport(browser, viewport));
} finally {
  await browser.close();
}

const expectedStates = audit.counts.expectedStatesPerViewport * VIEWPORTS.length;
const actualStates = records.reduce((sum, record) => sum + record.stateCount, 0);
if (actualStates !== expectedStates) fail('summary', `state count ${actualStates} != ${expectedStates}`);
const contrastSamples = records.flatMap(record => record.places.flatMap(place => place.states.flatMap(entry => entry.state.archMetadata || [])));
if (!contrastSamples.length) fail('summary', 'no visible archaeology metadata contrast samples were captured');
const invalidContrastSamples = contrastSamples.filter(sample => !sample.valid || !Number.isFinite(sample.contrast) || sample.contrast < 4.5);
if (invalidContrastSamples.length) fail('summary', `${invalidContrastSamples.length} archaeology metadata samples fail 4.5:1`);
const contrastSummary = {
  samples: contrastSamples.length,
  minimum: contrastSamples.length ? Math.min(...contrastSamples.map(sample => sample.contrast)) : null,
  maximum: contrastSamples.length ? Math.max(...contrastSamples.map(sample => sample.contrast)) : null,
  invalid: invalidContrastSamples.length,
};
const result = {
  headSha: HEAD_SHA,
  runId: RUN_ID,
  route: ROUTE_URL,
  capturedAt: new Date().toISOString(),
  sourceAudit: audit,
  expectedStates,
  actualStates,
  contrastSummary,
  records,
  failures,
  warnings,
};
writeJson(path.join(OUT_ROOT, 'result.json'), result);

const rows = records.map(record => `| ${record.viewport.id} | ${record.places.length} | ${record.stateCount} | ${record.contextPoints.length} | ${record.failures.length} | ${record.warnings.length} |`).join('\n');
const summary = `# Avraam dossier witness\n\n- Head SHA: \`${HEAD_SHA}\`\n- Run: \`${RUN_ID}\`\n- Route places: ${audit.counts.routePlaces}\n- Context points: ${audit.counts.contextPlaces}\n- Tabs per route place: ${audit.counts.tabsPerRoutePlace.join(', ')}\n- Expected tab states: ${expectedStates}\n- Captured tab states: ${actualStates}\n- Archaeology metadata contrast samples: ${contrastSummary.samples}\n- Minimum archaeology metadata contrast: ${contrastSummary.minimum ?? '—'}:1\n\n| Viewport | Places | Tab states | Context points | Failures | Warnings |\n|---|---:|---:|---:|---:|---:|\n${rows}\n\n## Failures\n\n${failures.length ? failures.map(item => `- ${item}`).join('\n') : '- none'}\n\n## Warnings\n\n${warnings.length ? warnings.map(item => `- ${item}`).join('\n') : '- none'}\n`;
fs.writeFileSync(path.join(OUT_ROOT, 'SUMMARY.md'), summary, 'utf8');

console.log(`Avraam dossier witness: ${actualStates}/${expectedStates} states; failures=${failures.length}; warnings=${warnings.length}`);
if (failures.length) process.exitCode = 1;
