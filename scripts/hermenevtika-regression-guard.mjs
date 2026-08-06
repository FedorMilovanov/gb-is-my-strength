#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_DIR = path.join(ROOT, 'reports', 'hermenevtika-regression-guards');
const ROUTE = '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const BASE = String(process.env.AUDIT_BASE || '').trim().replace(/\/$/, '');
const OWNER = 'article-inline-tooltip';
const OWNER_VERSION = 16;
const OWNED_SELECTORS = ['.gterm', '.fn-marker', '.bref[data-ref]'];
const VIEWPORTS = [390, 768, 1199, 1200, 1280, 1366, 1440, 1920];
const MEASURES = { narrow: 42, normal: 50, wide: 58 };

assert.ok(BASE, 'AUDIT_BASE is required');
fs.mkdirSync(REPORT_DIR, { recursive: true });

const checks = [];
function record(id, description, pass, evidence = null, area = 'hermenevtika-regression') {
  checks.push({ id, area, description, pass: Boolean(pass), evidence });
}
function readOptional(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}
function sourceContracts() {
  const runtime = readOptional('src/runtime/article-tooltips.js');
  const runtimeCss = readOptional('src/runtime/article-tooltips.css');
  const interactions = readOptional('src/runtime/article-interactions.js');
  const route = readOptional('src/pages/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/index.astro');
  const routeCss = readOptional('src/components/article-pilots/hermenevtika/hermenevtika-footnotes.css');
  const rail = readOptional('src/components/article-pilots/_shared/ReaderRail.astro');
  const settings = readOptional('src/components/article-pilots/_shared/ReaderSettings.astro');

  record('HGR-S01', 'canonical tooltip runtime source exists', runtime.length > 0);
  record('HGR-S02', 'canonical tooltip owner stylesheet exists', runtimeCss.length > 0);
  record('HGR-S03', 'canonical tooltip epoch is exactly 16', /const VERSION\s*=\s*16\s*;/.test(runtime));
  record('HGR-S04', 'canonical owner name is exact', runtime.includes("const OWNER = 'article-inline-tooltip';"));
  record('HGR-S05', 'runtime declares exactly the three legacy selectors it retires', runtime.includes("new Set(['.gterm', '.fn-marker', '.bref[data-ref]'])"));
  record('HGR-S06', 'legacy controller retirement mutates the original array in place', /controllers\.splice\(index,\s*1\)/.test(runtime));
  record('HGR-S07', 'runtime does not replace the public legacy-controller array', !/_tooltipControllers\s*=/.test(runtime));
  record('HGR-S08', 'legacy hover and sticky timers are cleared before retirement', runtime.includes('clearLegacyControllerTimers') && runtime.includes('window.clearTimeout'));
  record('HGR-S09', 'late legacy registration is retired after window load', /addEventListener\('load',\s*retireLegacyTooltipOwners/.test(runtime));
  record('HGR-S10', 'runtime publishes exact owner identity', runtime.includes('dataset.gbArticleTooltipsOwner = OWNER'));
  record('HGR-S11', 'runtime publishes exact owner epoch', runtime.includes('dataset.gbArticleTooltipsVersion = String(VERSION)'));
  record('HGR-S12', 'Hermenevtika route has no direct tooltip installer', !route.includes('installArticleTooltips'));
  record('HGR-S13', 'glossary expansion uses the canonical outer class', runtime.includes("tip.classList.toggle('gtip--expanded', expanded)"));
  record('HGR-S14', 'runtime clears stale overflow-y geometry', runtime.includes("'overflow-y'") && runtime.includes('clearAuthoritativeGeometry'));
  record('HGR-S15', 'overflow is conditional on measured content', runtime.includes('tip.scrollHeight > height + 1'));
  record('HGR-S16', 'canonical bootstrap imports the owner stylesheet', interactions.includes("import './article-tooltips.css';"));
  record('HGR-S17', 'owner stylesheet is scoped to the exact owner marker', runtimeCss.includes('data-gb-article-tooltips-owner="article-inline-tooltip"'));
  record('HGR-S18', 'owner stylesheet exposes an unconstrained natural popup state', /\.gb-floating-tip\s*\{[\s\S]*?max-height:\s*none;[\s\S]*?overflow:\s*visible;/.test(runtimeCss));
  record('HGR-S19', 'owner stylesheet removes rectangular paper-popover borders', /\.btip\.gb-floating-tip,[\s\S]*?\.tooltip\.gb-floating-tip\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*18px;/.test(runtimeCss));
  record('HGR-S20', 'owner stylesheet retires boxed open and focus states', /\[aria-expanded="true"\][\s\S]*?:focus-visible[\s\S]*?outline:\s*none;[\s\S]*?box-shadow:\s*none;/.test(runtimeCss));
  record('HGR-S21', 'owner stylesheet preserves dotted text-level focus indicators', /\.gterm:focus-visible[\s\S]*?border-bottom-style:\s*dotted;[\s\S]*?\.bref:focus-visible[\s\S]*?text-decoration-style:\s*dotted;/.test(runtimeCss));
  record('HGR-S22', 'forced-colors keeps an explicit underline fallback', /@media\s*\(forced-colors:\s*active\)[\s\S]*?text-decoration-line:\s*underline;/.test(runtimeCss));
  record('HGR-S23', 'route stylesheet owns no popup skin or focus override', !/gb-floating-tip|\.gterm:focus-visible|\.bref:focus-visible/.test(routeCss));
  record('HGR-S24', 'rail no longer uses the one-sided 334px margin floor', !rail.includes('margin-left: max((100vw - min(820px, 92vw)) / 2, 334px)'));
  record('HGR-S25', 'desktop rail breakpoint has no 1200px overlap', rail.includes('@media(max-width:1199px)') && rail.includes('@media(min-width:1200px)'));
  record('HGR-S26', 'rail declares an explicit remaining reading lane', rail.includes('--hrail-lane-width') && rail.includes('--hrail-lane-left'));
  record('HGR-S27', 'rail balances free lane space without positional shifting', rail.includes('--hrail-lane-balance') && !/position:\s*relative;[\s\S]*?left:calc\(/.test(rail));
  record('HGR-S28', 'reader settings own one measure for every direct article block', settings.includes('[data-reader-root] .article-body > *') && settings.includes('max-width: var(--hm-article-measure)'));
  record('HGR-S29', 'desktop measure modes are 42rem, 50rem and 58rem', /narrow:\s*'42rem'[\s\S]*normal:\s*'50rem'[\s\S]*wide:\s*'58rem'/.test(settings));
}

async function twoFrames(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function setMeasure(page, measure) {
  await page.evaluate((value) => {
    const api = window.GBReaderPreferences;
    if (!api || typeof api.set !== 'function') throw new Error('GBReaderPreferences.set is unavailable');
    api.set({ measure: value }, { source: 'hermenevtika-regression-guard' });
  }, measure);
  await twoFrames(page);
  await page.waitForFunction((value) => window.GBReaderPreferences?.get?.()?.measure === value, measure, { timeout: 3000 });
}
async function layoutState(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      if (!(element instanceof Element)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const rect = (selector) => {
      const element = document.querySelector(selector);
      const value = element?.getBoundingClientRect();
      return value ? { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height, centerX: value.left + value.width / 2 } : null;
    };
    const main = document.querySelector('.article-main.article-main--hrail');
    const mainStyle = main ? getComputedStyle(main) : null;
    const resolveCustomLength = (property) => {
      if (!(main instanceof HTMLElement)) return Number.NaN;
      const probe = document.createElement('span');
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;height:0;width:var(${property});`;
      main.appendChild(probe);
      const width = probe.getBoundingClientRect().width;
      probe.remove();
      return width;
    };
    const laneLeft = resolveCustomLength('--hrail-lane-left');
    const rightGutter = resolveCustomLength('--hrail-right-gutter');
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      rootFont: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      railVisible: visible(document.querySelector('.hrail')),
      rail: rect('.hrail'),
      main: rect('.article-main.article-main--hrail'),
      summary: rect('.summary-card'),
      prose: rect('.summary-card + p'),
      expectedLaneCenter: Number.isFinite(laneLeft) && Number.isFinite(rightGutter) ? (window.innerWidth + laneLeft - rightGutter) / 2 : null,
      measureToken: mainStyle?.getPropertyValue('--hm-article-measure').trim() || '',
      shellToken: mainStyle?.getPropertyValue('--hm-article-shell').trim() || '',
    };
  });
}
function recordLayout(width, state) {
  const desktop = width >= 1200;
  const prefix = `HGR-L${width}`;
  const overflow = state.scrollWidth - state.clientWidth;
  record(`${prefix}-01`, `${width}px rail visibility matches breakpoint`, state.railVisible === desktop, state, 'layout');
  record(`${prefix}-02`, `${width}px has no horizontal document overflow`, overflow <= 1, { overflow, state }, 'layout');
  record(`${prefix}-03`, `${width}px article main has real in-viewport geometry`, Boolean(state.main && state.main.width > 300 && state.main.left >= -1 && state.main.right <= width + 1), state, 'layout');
  record(`${prefix}-04`, `${width}px summary and prose share a horizontal axis`, Boolean(state.summary && state.prose && Math.abs(state.summary.centerX - state.prose.centerX) <= 2), state, 'layout');
  record(`${prefix}-05`, `${width}px summary and prose share the same measure`, Boolean(state.summary && state.prose && Math.abs(state.summary.width - state.prose.width) <= 2), state, 'layout');
  if (desktop) {
    record(`${prefix}-06`, `${width}px article does not overlap the fixed rail`, Boolean(state.rail && state.main && state.main.left >= state.rail.right + 20), state, 'layout');
    record(`${prefix}-07`, `${width}px article is centred in the declared remaining lane`, Boolean(state.main && state.expectedLaneCenter != null && Math.abs(state.main.centerX - state.expectedLaneCenter) <= 3), state, 'layout');
    const minimum = width >= 1280 ? 760 : 700;
    record(`${prefix}-08`, `${width}px normal desktop prose is not pathologically narrow`, Boolean(state.prose && state.prose.width >= minimum), { minimum, state }, 'layout');
  } else {
    record(`${prefix}-06`, `${width}px article remains centred in the viewport`, Boolean(state.main && Math.abs(state.main.centerX - width / 2) <= 3), state, 'layout');
  }
}

async function popupState(page, selector) {
  return page.evaluate((tipSelector) => {
    const tip = document.querySelector(tipSelector);
    if (!(tip instanceof HTMLElement)) return null;
    const style = getComputedStyle(tip);
    const rect = tip.getBoundingClientRect();
    const descendants = Array.from(tip.querySelectorAll('*')).filter((element) => {
      const childStyle = getComputedStyle(element);
      const childRect = element.getBoundingClientRect();
      return childStyle.display !== 'none' && childStyle.visibility !== 'hidden' && childRect.width > 0 && childRect.height > 0;
    });
    const lastBottom = descendants.reduce((max, element) => Math.max(max, element.getBoundingClientRect().bottom), rect.top);
    return {
      borderTopWidth: parseFloat(style.borderTopWidth) || 0,
      borderRadius: parseFloat(style.borderTopLeftRadius) || 0,
      overflowY: style.overflowY,
      maxHeight: style.maxHeight,
      clientHeight: tip.clientHeight,
      scrollHeight: tip.scrollHeight,
      width: rect.width,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      blankTail: Math.max(0, rect.bottom - lastBottom),
      inViewport: rect.left >= -1 && rect.top >= -1 && rect.right <= window.innerWidth + 1 && rect.bottom <= window.innerHeight + 1,
    };
  }, selector);
}
function noFakeScrollbar(state) {
  if (!state) return false;
  const scrollable = state.overflowY === 'auto' || state.overflowY === 'scroll';
  return !scrollable || state.scrollHeight > state.clientHeight + 1;
}
async function keyboardFocusState(page, selector) {
  const prepared = await page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector);
    if (!(target instanceof HTMLElement)) return false;
    if (!target.matches('button, a[href], input, select, textarea, [tabindex]')) target.tabIndex = 0;
    const sentinel = document.createElement('button');
    sentinel.type = 'button';
    sentinel.dataset.hgrFocusSentinel = '1';
    sentinel.textContent = 'focus sentinel';
    sentinel.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;';
    target.before(sentinel);
    sentinel.focus();
    return document.activeElement === sentinel;
  }, selector);
  if (!prepared) return null;
  await page.keyboard.press('Tab');
  await twoFrames(page);
  return page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector);
    const sentinel = document.querySelector('[data-hgr-focus-sentinel="1"]');
    if (!(target instanceof HTMLElement)) return null;
    const style = getComputedStyle(target);
    const background = style.backgroundColor.replace(/\s+/g, '');
    const value = {
      focused: document.activeElement === target,
      focusVisible: target.matches(':focus-visible'),
      outlineWidth: parseFloat(style.outlineWidth) || 0,
      boxShadow: style.boxShadow,
      backgroundVisible: background !== 'rgba(0,0,0,0)' && background !== 'transparent',
      borderBottomWidth: parseFloat(style.borderBottomWidth) || 0,
      borderBottomStyle: style.borderBottomStyle,
      textDecorationLine: style.textDecorationLine,
      textDecorationStyle: style.textDecorationStyle,
      textDecorationThickness: parseFloat(style.textDecorationThickness) || 0,
    };
    sentinel?.remove();
    return value;
  }, selector);
}

async function popupContracts(page) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction((expected) => {
    const root = document.documentElement.dataset;
    return window.GBArticleTooltips?.version === expected.version &&
      window.GBArticleTooltips?.owner === expected.owner &&
      root.gbArticleTooltipsOwner === expected.owner &&
      root.gbArticleTooltipsVersion === String(expected.version);
  }, { owner: OWNER, version: OWNER_VERSION }, { timeout: 15000 });
  await twoFrames(page);

  const ownerState = await page.evaluate((ownedSelectors) => ({
    globalVersion: window.GBArticleTooltips?.version || 0,
    globalOwner: window.GBArticleTooltips?.owner || null,
    markerOwner: document.documentElement.dataset.gbArticleTooltipsOwner || null,
    markerVersion: document.documentElement.dataset.gbArticleTooltipsVersion || null,
    interactionsReady: document.documentElement.dataset.gbArticleInteractionsReady || null,
    legacyOwners: Array.isArray(window.SiteUtils?._tooltipControllers)
      ? window.SiteUtils._tooltipControllers.map((controller) => controller?.anchorSel).filter((selector) => ownedSelectors.includes(selector))
      : [],
  }), OWNED_SELECTORS);
  record('HGR-T01', 'exact tooltip owner v16 is installed and published by the owner module', ownerState.globalVersion === OWNER_VERSION && ownerState.globalOwner === OWNER && ownerState.markerOwner === OWNER && ownerState.markerVersion === String(OWNER_VERSION), ownerState, 'tooltip');
  record('HGR-T02', 'shared interaction bootstrap completed after owner installation', ownerState.interactionsReady === '1', ownerState, 'tooltip');
  record('HGR-T03', 'no legacy controller remains after the load boundary', ownerState.legacyOwners.length === 0, ownerState, 'tooltip');

  const glossaryFocus = await keyboardFocusState(page, '.gterm');
  record('HGR-F01', 'glossary receives real keyboard-visible focus', Boolean(glossaryFocus?.focused && glossaryFocus?.focusVisible), glossaryFocus, 'focus');
  record('HGR-F02', 'glossary focus has no rectangular outline or box-shadow', Boolean(glossaryFocus && glossaryFocus.outlineWidth === 0 && glossaryFocus.boxShadow === 'none'), glossaryFocus, 'focus');
  record('HGR-F03', 'glossary focus remains visible through tint and dotted border', Boolean(glossaryFocus && glossaryFocus.backgroundVisible && glossaryFocus.borderBottomStyle === 'dotted' && glossaryFocus.borderBottomWidth >= 1.5), glossaryFocus, 'focus');
  await page.keyboard.press('Escape');

  const scriptureFocus = await keyboardFocusState(page, '.bref[data-ref]');
  record('HGR-F04', 'Scripture receives real keyboard-visible focus', Boolean(scriptureFocus?.focused && scriptureFocus?.focusVisible), scriptureFocus, 'focus');
  record('HGR-F05', 'Scripture focus has no rectangular outline or box-shadow', Boolean(scriptureFocus && scriptureFocus.outlineWidth === 0 && scriptureFocus.boxShadow === 'none'), scriptureFocus, 'focus');
  record('HGR-F06', 'Scripture focus remains visible through tint and dotted underline', Boolean(scriptureFocus && scriptureFocus.backgroundVisible && scriptureFocus.textDecorationLine.includes('underline') && scriptureFocus.textDecorationStyle === 'dotted' && scriptureFocus.textDecorationThickness >= 1.5), scriptureFocus, 'focus');
  await page.keyboard.press('Escape');

  const scripture = page.locator('.bref[data-ref]').first();
  await scripture.scrollIntoViewIfNeeded();
  await scripture.click();
  await page.waitForSelector('.btip.gb-floating-tip.is-open', { state: 'visible', timeout: 3000 });
  await twoFrames(page);
  const scriptureState = await popupState(page, '.btip.gb-floating-tip.is-open');
  record('HGR-T04', 'Scripture popup uses the borderless paper treatment', Boolean(scriptureState && scriptureState.borderTopWidth === 0 && scriptureState.borderRadius >= 16), scriptureState, 'tooltip');
  record('HGR-T05', 'Scripture popup remains inside the viewport', Boolean(scriptureState?.inViewport), scriptureState, 'tooltip');
  record('HGR-T06', 'Scripture popup has no fake scrollbar', noFakeScrollbar(scriptureState), scriptureState, 'tooltip');
  record('HGR-T07', 'Scripture popup has no large blank tail', Boolean(scriptureState && scriptureState.blankTail <= 48), scriptureState, 'tooltip');
  await page.keyboard.press('Escape');

  const footnoteReady = await page.evaluate(() => {
    const marker = Array.from(document.querySelectorAll('.fn-marker')).find((candidate) => {
      const text = Array.from(candidate.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent || '').join('').replace(/\s+/g, '').trim();
      return text === '40';
    });
    if (!(marker instanceof HTMLElement)) return false;
    marker.dataset.hgrFootnote = '40';
    return true;
  });
  const footnote = page.locator('[data-hgr-footnote="40"]');
  record('HGR-T08', 'representative footnote 40 exists', footnoteReady && await footnote.count() === 1, { footnoteReady }, 'tooltip');
  if (footnoteReady) {
    await footnote.scrollIntoViewIfNeeded();
    await footnote.click();
    await page.waitForSelector('.tooltip.gb-floating-tip.is-open', { state: 'visible', timeout: 3000 });
    await twoFrames(page);
    const state = await popupState(page, '.tooltip.gb-floating-tip.is-open');
    record('HGR-T09', 'footnote popup uses the borderless paper treatment', Boolean(state && state.borderTopWidth === 0 && state.borderRadius >= 16), state, 'tooltip');
    record('HGR-T10', 'footnote popup remains inside the viewport', Boolean(state?.inViewport), state, 'tooltip');
    record('HGR-T11', 'footnote popup has no fake scrollbar', noFakeScrollbar(state), state, 'tooltip');
    record('HGR-T12', 'footnote popup has no large blank tail', Boolean(state && state.blankTail <= 48), state, 'tooltip');
    await page.keyboard.press('Escape');
  }

  await page.waitForFunction(() => Array.from(document.querySelectorAll('.gterm')).some((term) => term.querySelector('[data-gtip-expand]')), null, { timeout: 15000 });
  const glossaryReady = await page.evaluate(() => {
    const term = Array.from(document.querySelectorAll('.gterm')).find((candidate) => candidate.querySelector('[data-gtip-expand]'));
    if (!(term instanceof HTMLElement)) return false;
    term.dataset.hgrGlossary = 'expandable';
    return true;
  });
  const glossary = page.locator('[data-hgr-glossary="expandable"]');
  record('HGR-T13', 'an expandable hydrated glossary term exists', glossaryReady && await glossary.count() === 1, { glossaryReady }, 'tooltip');
  if (!glossaryReady) return;

  await glossary.scrollIntoViewIfNeeded();
  await glossary.click();
  await page.waitForSelector('.gtip.gb-floating-tip.is-open', { state: 'visible', timeout: 3000 });
  await twoFrames(page);
  const compactState = await popupState(page, '.gtip.gb-floating-tip.is-open');
  const compactSemantic = await page.evaluate(() => {
    const tip = document.querySelector('.gtip.gb-floating-tip.is-open');
    const button = tip?.querySelector('[data-gtip-expand]');
    const detail = tip?.querySelector('.gtip-detail-wrap');
    return {
      expandedClass: tip?.classList.contains('gtip--expanded') || false,
      staleInnerClass: tip?.querySelector('.gtip-luxury')?.classList.contains('is-expanded') || false,
      ariaExpanded: button?.getAttribute('aria-expanded') || null,
      detailHidden: detail?.getAttribute('aria-hidden') || null,
    };
  });
  record('HGR-T14', 'compact glossary remains naturally sized', Boolean(compactState && compactState.height > 50 && compactState.height < 360), compactState, 'tooltip');
  record('HGR-T15', 'compact glossary has no fake scrollbar', noFakeScrollbar(compactState), compactState, 'tooltip');
  record('HGR-T16', 'compact glossary has no large blank tail', Boolean(compactState && compactState.blankTail <= 48), compactState, 'tooltip');
  record('HGR-T17', 'compact glossary semantic state is collapsed and canonical', !compactSemantic.expandedClass && !compactSemantic.staleInnerClass && compactSemantic.ariaExpanded === 'false' && compactSemantic.detailHidden === 'true', compactSemantic, 'tooltip');

  await page.locator('.gtip.gb-floating-tip.is-open [data-gtip-expand]').click();
  await twoFrames(page);
  const expandedState = await popupState(page, '.gtip.gb-floating-tip.is-open');
  const expandedSemantic = await page.evaluate(() => {
    const tip = document.querySelector('.gtip.gb-floating-tip.is-open');
    const button = tip?.querySelector('[data-gtip-expand]');
    const detail = tip?.querySelector('.gtip-detail-wrap');
    const papyrus = tip?.querySelector('.gtip-papyrus');
    const papyrusRect = papyrus?.getBoundingClientRect();
    const papyrusStyle = papyrus ? getComputedStyle(papyrus) : null;
    return {
      expandedClass: tip?.classList.contains('gtip--expanded') || false,
      staleInnerClass: tip?.querySelector('.gtip-luxury')?.classList.contains('is-expanded') || false,
      ariaExpanded: button?.getAttribute('aria-expanded') || null,
      label: button?.getAttribute('aria-label') || null,
      buttonText: String(button?.textContent || '').replace(/\s+/g, ' ').trim(),
      detailHidden: detail?.getAttribute('aria-hidden') || null,
      papyrusVisible: Boolean(papyrusRect && papyrusStyle && papyrusStyle.display !== 'none' && papyrusStyle.visibility !== 'hidden' && papyrusRect.height > 10),
    };
  });
  record('HGR-T18', 'expanded glossary uses .gtip--expanded and no stale inner class', expandedSemantic.expandedClass && !expandedSemantic.staleInnerClass, expandedSemantic, 'tooltip');
  record('HGR-T19', 'expanded glossary ARIA state and button label are truthful', expandedSemantic.ariaExpanded === 'true' && expandedSemantic.detailHidden === 'false' && expandedSemantic.label === 'Кратко' && expandedSemantic.buttonText.includes('Кратко'), expandedSemantic, 'tooltip');
  record('HGR-T20', 'expanded papyrus detail is visibly rendered', expandedSemantic.papyrusVisible, expandedSemantic, 'tooltip');
  record('HGR-T21', 'expanded glossary grows beyond its compact height', Boolean(expandedState && compactState && expandedState.height >= compactState.height + 40), { compactState, expandedState }, 'tooltip');
  record('HGR-T22', 'expanded glossary remains inside the viewport', Boolean(expandedState?.inViewport), expandedState, 'tooltip');
  record('HGR-T23', 'expanded glossary scrolls only on real overflow', noFakeScrollbar(expandedState), expandedState, 'tooltip');
  record('HGR-T24', 'expanded glossary has no blank white panel', Boolean(expandedState && expandedState.blankTail <= 64), expandedState, 'tooltip');

  await page.locator('.gtip.gb-floating-tip.is-open [data-gtip-expand]').click();
  await twoFrames(page);
  const collapsedAgain = await popupState(page, '.gtip.gb-floating-tip.is-open');
  const collapsedSemantic = await page.evaluate(() => {
    const tip = document.querySelector('.gtip.gb-floating-tip.is-open');
    return {
      expandedClass: tip?.classList.contains('gtip--expanded') || false,
      ariaExpanded: tip?.querySelector('[data-gtip-expand]')?.getAttribute('aria-expanded') || null,
      detailHidden: tip?.querySelector('.gtip-detail-wrap')?.getAttribute('aria-hidden') || null,
    };
  });
  record('HGR-T25', 'collapsing restores compact semantic state', !collapsedSemantic.expandedClass && collapsedSemantic.ariaExpanded === 'false' && collapsedSemantic.detailHidden === 'true', collapsedSemantic, 'tooltip');
  record('HGR-T26', 'collapsing restores approximately compact height', Boolean(collapsedAgain && compactState && Math.abs(collapsedAgain.height - compactState.height) <= 12), { compactState, collapsedAgain }, 'tooltip');
}

sourceContracts();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
try {
  for (const width of VIEWPORTS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.GBReaderPreferences && document.querySelector('.summary-card + p'), null, { timeout: 15000 });
    await setMeasure(page, 'normal');
    recordLayout(width, await layoutState(page));
  }

  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.GBReaderPreferences && document.querySelector('.summary-card + p'), null, { timeout: 15000 });
  const measured = {};
  for (const [measure, rem] of Object.entries(MEASURES)) {
    await setMeasure(page, measure);
    const state = await layoutState(page);
    measured[measure] = state.prose?.width || 0;
    const expected = rem * state.rootFont;
    record(`HGR-M-${measure}-01`, `${measure} measure matches its rem contract`, Boolean(state.prose && Math.abs(state.prose.width - expected) <= 6), { expected, state }, 'measure');
    record(`HGR-M-${measure}-02`, `${measure} summary and prose remain aligned`, Boolean(state.summary && state.prose && Math.abs(state.summary.centerX - state.prose.centerX) <= 2), state, 'measure');
    record(`HGR-M-${measure}-03`, `${measure} summary and prose share width`, Boolean(state.summary && state.prose && Math.abs(state.summary.width - state.prose.width) <= 2), state, 'measure');
    record(`HGR-M-${measure}-04`, `${measure} mode has no horizontal overflow`, state.scrollWidth - state.clientWidth <= 1, state, 'measure');
  }
  record('HGR-M-ORDER', 'narrow, normal and wide measures grow monotonically', measured.narrow < measured.normal && measured.normal < measured.wide, measured, 'measure');

  await popupContracts(page);
  record('HGR-RUNTIME-ERRORS', 'Hermenevtika regression guard has no uncaught page errors', pageErrors.length === 0, pageErrors, 'runtime');
  await page.screenshot({ path: path.join(REPORT_DIR, 'hermenevtika-regression-guard.png'), fullPage: false });
} finally {
  await context.close();
  await browser.close();
}

assert.equal(new Set(checks.map((item) => item.id)).size, checks.length, 'guard check IDs must be unique');
assert.ok(checks.length >= 120, `Hermenevtika guard requires at least 120 checks, got ${checks.length}`);
const failed = checks.filter((item) => !item.pass);
const summary = { sha: process.env.GITHUB_SHA || null, checks: checks.length, passed: checks.length - failed.length, failed: failed.length };
fs.writeFileSync(path.join(REPORT_DIR, 'report.json'), JSON.stringify({ summary, checks }, null, 2));
const markdown = [
  '# Hermenevtika regression guards',
  '',
  `- SHA: \`${summary.sha || 'local'}\``,
  `- Checks: **${summary.checks}**`,
  `- Passed: **${summary.passed}**`,
  `- Failed: **${summary.failed}**`,
  '',
  '| ID | Result | Description |',
  '|---|---|---|',
  ...checks.map((item) => `| ${item.id} | ${item.pass ? 'PASS' : 'FAIL'} | ${item.description.replace(/\|/g, '\\|')} |`),
].join('\n');
fs.writeFileSync(path.join(REPORT_DIR, 'report.md'), markdown);
checks.forEach((item) => console.log(`[HERMENEVTIKA-GUARD] ${item.pass ? 'PASS' : 'FAIL'} ${item.id} :: ${item.description}`));
console.log('[HERMENEVTIKA-GUARD-SUMMARY]', JSON.stringify(summary));
assert.equal(failed.length, 0, `Hermenevtika regression guards failed: ${failed.map((item) => item.id).join(', ')}`);
console.log('Hermenevtika regression guards: PASS');
