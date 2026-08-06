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
const OWNER_VERSION = 17;
const OWNED_SELECTORS = ['.gterm', '.fn-marker', '.bref[data-ref]'];
const VIEWPORTS = [390, 768, 1199, 1200, 1280, 1366, 1440, 1920];
const MEASURES = { narrow: 42, normal: 50, wide: 58 };
assert.ok(BASE, 'AUDIT_BASE is required');
fs.mkdirSync(REPORT_DIR, { recursive: true });

const checks = [];
const record = (id, description, pass, evidence = null, area = 'hermenevtika-regression') => checks.push({ id, area, description, pass: Boolean(pass), evidence });
const read = (relativePath) => {
  const filePath = path.join(ROOT, relativePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
};

function sourceContracts() {
  const runtime = read('src/runtime/article-tooltips.js');
  const runtimeCss = read('src/runtime/article-tooltips.css');
  const interactions = read('src/runtime/article-interactions.js');
  const route = read('src/pages/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/index.astro');
  const routeCss = read('src/components/article-pilots/hermenevtika/hermenevtika-footnotes.css');
  const rail = read('src/components/article-pilots/_shared/ReaderRail.astro');
  const settings = read('src/components/article-pilots/_shared/ReaderSettings.astro');
  const lane = rail.match(/\.article-main\.article-main--hrail\s*\{([\s\S]*?)\n\s*\}/)?.[1] || '';
  const assertions = [
    ['HGR-S01', 'canonical tooltip runtime source exists', runtime.length > 0],
    ['HGR-S02', 'canonical tooltip owner stylesheet exists', runtimeCss.length > 0],
    ['HGR-S03', 'canonical tooltip epoch is exactly 17', /const VERSION\s*=\s*17\s*;/.test(runtime)],
    ['HGR-S04', 'canonical owner name is exact', runtime.includes("const OWNER = 'article-inline-tooltip';")],
    ['HGR-S05', 'runtime declares exactly the three legacy selectors', runtime.includes("new Set(['.gterm', '.fn-marker', '.bref[data-ref]'])")],
    ['HGR-S06', 'legacy retirement mutates the original array in place', /controllers\.splice\(index,\s*1\)/.test(runtime)],
    ['HGR-S07', 'runtime never replaces the public legacy-controller array', !/_tooltipControllers\s*=/.test(runtime)],
    ['HGR-S08', 'legacy timers are cleared before retirement', runtime.includes('clearLegacyControllerTimers') && runtime.includes('window.clearTimeout')],
    ['HGR-S09', 'late legacy registration is retired after load', /addEventListener\('load',\s*retireLegacyTooltipOwners/.test(runtime)],
    ['HGR-S10', 'runtime publishes exact owner identity', runtime.includes('dataset.gbArticleTooltipsOwner = OWNER')],
    ['HGR-S11', 'runtime publishes exact owner epoch', runtime.includes('dataset.gbArticleTooltipsVersion = String(VERSION)')],
    ['HGR-S12', 'route has no direct tooltip installer', !route.includes('installArticleTooltips')],
    ['HGR-S13', 'glossary expansion uses the canonical outer class', runtime.includes("tip.classList.toggle('gtip--expanded', expanded)")],
    ['HGR-S14', 'runtime clears stale overflow geometry', runtime.includes("'overflow-y'") && runtime.includes('clearAuthoritativeGeometry')],
    ['HGR-S15', 'overflow is conditional on measured content', runtime.includes('tip.scrollHeight > height + 1')],
    ['HGR-S16', 'bootstrap imports the owner stylesheet', interactions.includes("import './article-tooltips.css';")],
    ['HGR-S17', 'owner stylesheet is scoped to the exact marker', runtimeCss.includes('data-gb-article-tooltips-owner="article-inline-tooltip"')],
    ['HGR-S18', 'owner stylesheet exposes natural popup height', /\.gb-floating-tip\s*\{[\s\S]*?max-height:\s*none;[\s\S]*?overflow:\s*visible;/.test(runtimeCss)],
    ['HGR-S19', 'paper popovers are borderless and rounded', /\.btip\.gb-floating-tip,[\s\S]*?\.tooltip\.gb-floating-tip\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*18px;/.test(runtimeCss)],
    ['HGR-S20', 'boxed open and focus states are retired', /\[aria-expanded="true"\][\s\S]*?:focus-visible[\s\S]*?outline:\s*none;[\s\S]*?box-shadow:\s*none;/.test(runtimeCss)],
    ['HGR-S21', 'dotted text-level focus indicators remain', /\.gterm:focus-visible[\s\S]*?border-bottom-style:\s*dotted;[\s\S]*?\.bref:focus-visible[\s\S]*?text-decoration-style:\s*dotted;/.test(runtimeCss)],
    ['HGR-S22', 'forced-colors keeps an underline fallback', /@media\s*\(forced-colors:\s*active\)[\s\S]*?text-decoration-line:\s*underline;/.test(runtimeCss)],
    ['HGR-S23', 'route stylesheet owns no popup skin', !/gb-floating-tip|\.gterm:focus-visible|\.bref:focus-visible/.test(routeCss)],
    ['HGR-S24', 'one-sided 334px margin floor is gone', !rail.includes('margin-left: max((100vw - min(820px, 92vw)) / 2, 334px)')],
    ['HGR-S25', 'rail breakpoint has no 1200px overlap', rail.includes('@media(max-width:1199px)') && rail.includes('@media(min-width:1200px)')],
    ['HGR-S26', 'rail declares an explicit remaining lane', lane.includes('--hrail-lane-width') && lane.includes('--hrail-lane-left')],
    ['HGR-S27', 'lane balances space without positional shifting', lane.includes('--hrail-lane-balance') && !/(?:^|\n)\s*(?:position|left|transform)\s*:/.test(lane)],
    ['HGR-S28', 'lane uses containing-block width, not scrollbar-inclusive vw', lane.includes('calc(100% -') && !lane.includes('100vw')],
    ['HGR-S29', 'ReaderSettings owns every direct article block measure', settings.includes('[data-reader-root] .article-body > *') && settings.includes('max-width: var(--hm-article-measure)')],
    ['HGR-S30', 'measure modes are exactly 42rem, 50rem and 58rem', /narrow:\s*'42rem'[\s\S]*normal:\s*'50rem'[\s\S]*wide:\s*'58rem'/.test(settings)],
    ['HGR-S31', 'tooltip geometry uses VisualViewport with client-width fallback', runtime.includes('function viewportBounds()') && runtime.includes('window.visualViewport') && runtime.includes('document.documentElement.clientWidth')],
    ['HGR-S32', 'crossing the mobile breakpoint closes the active owner cleanly', runtime.includes("closeTooltip('mode-change')") && runtime.includes('active.mobile !== mobileMode()')],
    ['HGR-S33', 'visual viewport resize and pan use the canonical viewport handler', runtime.includes("visualViewport?.addEventListener('resize', handleViewportChange") && runtime.includes("visualViewport?.addEventListener('scroll', handleViewportChange")],
  ];
  assertions.forEach(([id, description, pass]) => record(id, description, pass, null, 'source'));
}

const twoFrames = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function waitForOwner(page) {
  await page.waitForFunction(({ owner, version }) => {
    const data = document.documentElement.dataset;
    return window.GBArticleTooltips?.version === version && window.GBArticleTooltips?.owner === owner && data.gbArticleTooltipsOwner === owner && data.gbArticleTooltipsVersion === String(version);
  }, { owner: OWNER, version: OWNER_VERSION }, { timeout: 15000 });
}
async function setMeasure(page, measure) {
  await page.evaluate((value) => {
    const api = window.GBReaderPreferences;
    if (!api?.set) throw new Error('GBReaderPreferences.set is unavailable');
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
      const box = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    };
    const rect = (selector) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height, centerX: box.left + box.width / 2 } : null;
    };
    const main = document.querySelector('.article-main.article-main--hrail');
    const resolveVar = (property) => {
      if (!(main instanceof HTMLElement)) return Number.NaN;
      const probe = document.createElement('span');
      probe.style.cssText = `position:fixed;visibility:hidden;height:0;width:var(${property})`;
      main.appendChild(probe);
      const width = probe.getBoundingClientRect().width;
      probe.remove();
      return width;
    };
    const laneLeft = resolveVar('--hrail-lane-left');
    const rightGutter = resolveVar('--hrail-right-gutter');
    const clientWidth = document.documentElement.clientWidth;
    return {
      rootFont: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth,
      railVisible: visible(document.querySelector('.hrail')),
      rail: rect('.hrail'), main: rect('.article-main.article-main--hrail'), summary: rect('.summary-card'), prose: rect('.summary-card + p'),
      expectedLaneCenter: Number.isFinite(laneLeft) && Number.isFinite(rightGutter) ? (clientWidth + laneLeft - rightGutter) / 2 : null,
    };
  });
}
function recordLayout(width, state) {
  const desktop = width >= 1200;
  const id = `HGR-L${width}`;
  record(`${id}-01`, `${width}px rail visibility matches breakpoint`, state.railVisible === desktop, state, 'layout');
  record(`${id}-02`, `${width}px has no horizontal overflow`, state.scrollWidth - state.clientWidth <= 1, state, 'layout');
  record(`${id}-03`, `${width}px main stays in the client viewport`, Boolean(state.main && state.main.width > 300 && state.main.left >= -1 && state.main.right <= state.clientWidth + 1), state, 'layout');
  record(`${id}-04`, `${width}px summary and prose centres differ by at most 2px`, Boolean(state.summary && state.prose && Math.abs(state.summary.centerX - state.prose.centerX) <= 2), state, 'layout');
  record(`${id}-05`, `${width}px summary and prose widths differ by at most 2px`, Boolean(state.summary && state.prose && Math.abs(state.summary.width - state.prose.width) <= 2), state, 'layout');
  if (!desktop) return record(`${id}-06`, `${width}px article stays viewport-centred`, Boolean(state.main && Math.abs(state.main.centerX - state.clientWidth / 2) <= 3), state, 'layout');
  record(`${id}-06`, `${width}px article clears the fixed rail`, Boolean(state.rail && state.main && state.main.left >= state.rail.right + 20), state, 'layout');
  record(`${id}-07`, `${width}px article is centred in the declared lane`, Boolean(state.main && state.expectedLaneCenter != null && Math.abs(state.main.centerX - state.expectedLaneCenter) <= 3), state, 'layout');
  const minimum = width >= 1280 ? 760 : 700;
  record(`${id}-08`, `${width}px normal prose is not pathologically narrow`, Boolean(state.prose && state.prose.width >= minimum), { minimum, state }, 'layout');
}

async function popupState(page, selector) {
  return page.evaluate((value) => {
    const tip = document.querySelector(value);
    if (!(tip instanceof HTMLElement)) return null;
    const style = getComputedStyle(tip);
    const box = tip.getBoundingClientRect();
    const bottoms = Array.from(tip.querySelectorAll('*')).filter((element) => {
      const childStyle = getComputedStyle(element);
      const childBox = element.getBoundingClientRect();
      return childStyle.display !== 'none' && childStyle.visibility !== 'hidden' && childBox.width > 0 && childBox.height > 0;
    }).map((element) => element.getBoundingClientRect().bottom);
    return {
      borderTopWidth: parseFloat(style.borderTopWidth) || 0, borderRadius: parseFloat(style.borderTopLeftRadius) || 0,
      overflowY: style.overflowY, clientHeight: tip.clientHeight, scrollHeight: tip.scrollHeight, height: box.height,
      blankTail: Math.max(0, box.bottom - Math.max(box.top, ...bottoms)),
      inViewport: box.left >= -1 && box.top >= -1 && box.right <= document.documentElement.clientWidth + 1 && box.bottom <= window.innerHeight + 1,
    };
  }, selector);
}
const noFakeScrollbar = (state) => Boolean(state) && (!['auto', 'scroll'].includes(state.overflowY) || state.scrollHeight > state.clientHeight + 1);
async function keyboardFocusState(page, selector) {
  if (!await page.evaluate((value) => {
    const target = document.querySelector(value);
    if (!(target instanceof HTMLElement)) return false;
    if (!target.matches('button,a[href],[tabindex]')) target.tabIndex = 0;
    const sentinel = document.createElement('button');
    sentinel.dataset.hgrFocusSentinel = '1';
    sentinel.style.cssText = 'position:fixed;left:-10000px;top:0';
    target.before(sentinel); sentinel.focus(); return true;
  }, selector)) return null;
  await page.keyboard.press('Tab'); await twoFrames(page);
  return page.evaluate((value) => {
    const target = document.querySelector(value);
    document.querySelector('[data-hgr-focus-sentinel]')?.remove();
    if (!(target instanceof HTMLElement)) return null;
    const style = getComputedStyle(target);
    const background = style.backgroundColor.replace(/\s+/g, '');
    return {
      focused: document.activeElement === target, focusVisible: target.matches(':focus-visible'),
      outlineWidth: parseFloat(style.outlineWidth) || 0, boxShadow: style.boxShadow,
      backgroundVisible: !['rgba(0,0,0,0)', 'transparent'].includes(background),
      borderBottomWidth: parseFloat(style.borderBottomWidth) || 0, borderBottomStyle: style.borderBottomStyle,
      textDecorationLine: style.textDecorationLine, textDecorationStyle: style.textDecorationStyle,
      textDecorationThickness: parseFloat(style.textDecorationThickness) || 0,
    };
  }, selector);
}
async function restoredTooltipState(page) {
  return page.evaluate(() => {
    const anchor = document.querySelector('.bref[data-ref]');
    const tip = anchor?.querySelector('.btip');
    const staleProperties = tip instanceof HTMLElement
      ? ['left', 'top', 'right', 'bottom', 'max-height', 'overflow-y', 'position', 'pointer-events', '--gb-tip-arrow-x'].filter((property) => tip.style.getPropertyValue(property))
      : ['missing-inline-tip'];
    const html = document.documentElement;
    const body = document.body;
    return {
      anchorExpanded: anchor?.getAttribute('aria-expanded') || null,
      openCount: document.querySelectorAll('.gb-floating-tip.is-open').length,
      floatingCount: document.querySelectorAll('.gb-floating-tip').length,
      locked: html.dataset.scrollLocked === '1' || body.classList.contains('no-scroll') || html.style.overflow === 'hidden' || body.style.overflow === 'hidden',
      staleProperties,
    };
  });
}
async function modeTransitionContracts(page) {
  await page.setViewportSize({ width: 769, height: 900 });
  await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'load', timeout: 60000 });
  await waitForOwner(page);
  const trigger = page.locator('.bref[data-ref]').first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await page.waitForSelector('.btip.gb-floating-tip.is-open', { state: 'visible', timeout: 3000 });
  record('HGR-R01', 'desktop popup opens immediately above the mobile boundary', true, { width: 769 }, 'responsive-tooltip');
  await page.setViewportSize({ width: 768, height: 900 });
  await page.waitForFunction(() => !document.querySelector('.gb-floating-tip.is-open'), null, { timeout: 3000 });
  await twoFrames(page);
  const desktopToMobile = await restoredTooltipState(page);
  record('HGR-R02', 'desktop-to-mobile transition closes the active popup', desktopToMobile.openCount === 0 && desktopToMobile.anchorExpanded === 'false', desktopToMobile, 'responsive-tooltip');
  record('HGR-R03', 'desktop-to-mobile transition clears floating state, geometry and lock', desktopToMobile.floatingCount === 0 && desktopToMobile.staleProperties.length === 0 && !desktopToMobile.locked, desktopToMobile, 'responsive-tooltip');

  await trigger.click();
  await page.waitForSelector('.btip.gb-floating-tip.is-open', { state: 'visible', timeout: 3000 });
  record('HGR-R04', 'mobile popup opens immediately below the desktop boundary', true, { width: 768 }, 'responsive-tooltip');
  await page.setViewportSize({ width: 769, height: 900 });
  await page.waitForFunction(() => !document.querySelector('.gb-floating-tip.is-open'), null, { timeout: 3000 });
  await twoFrames(page);
  const mobileToDesktop = await restoredTooltipState(page);
  record('HGR-R05', 'mobile-to-desktop transition closes the active sheet', mobileToDesktop.openCount === 0 && mobileToDesktop.anchorExpanded === 'false', mobileToDesktop, 'responsive-tooltip');
  record('HGR-R06', 'mobile-to-desktop transition clears scroll lock and authoritative geometry', mobileToDesktop.floatingCount === 0 && mobileToDesktop.staleProperties.length === 0 && !mobileToDesktop.locked, mobileToDesktop, 'responsive-tooltip');
}

async function popupContracts(page) {
  await modeTransitionContracts(page);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'load', timeout: 60000 });
  await waitForOwner(page);
  await twoFrames(page);
  const ownerState = await page.evaluate((owned) => ({
    globalVersion: window.GBArticleTooltips?.version || 0, globalOwner: window.GBArticleTooltips?.owner || null,
    markerOwner: document.documentElement.dataset.gbArticleTooltipsOwner || null, markerVersion: document.documentElement.dataset.gbArticleTooltipsVersion || null,
    interactionsReady: document.documentElement.dataset.gbArticleInteractionsReady || null,
    legacyOwners: Array.isArray(window.SiteUtils?._tooltipControllers) ? window.SiteUtils._tooltipControllers.map((item) => item?.anchorSel).filter((selector) => owned.includes(selector)) : [],
  }), OWNED_SELECTORS);
  record('HGR-T01', 'exact owner v17 is published by the owner module', ownerState.globalVersion === OWNER_VERSION && ownerState.globalOwner === OWNER && ownerState.markerOwner === OWNER && ownerState.markerVersion === String(OWNER_VERSION), ownerState, 'tooltip');
  record('HGR-T02', 'shared interaction bootstrap completed after owner installation', ownerState.interactionsReady === '1', ownerState, 'tooltip');
  record('HGR-T03', 'no legacy owner remains after load', ownerState.legacyOwners.length === 0, ownerState, 'tooltip');

  for (const [prefix, selector, decoration] of [['glossary', '.gterm', 'border'], ['Scripture', '.bref[data-ref]', 'underline']]) {
    const state = await keyboardFocusState(page, selector);
    const offset = prefix === 'glossary' ? 1 : 4;
    record(`HGR-F0${offset}`, `${prefix} receives keyboard-visible focus`, Boolean(state?.focused && state?.focusVisible), state, 'focus');
    record(`HGR-F0${offset + 1}`, `${prefix} focus has no rectangular frame`, Boolean(state && state.outlineWidth === 0 && state.boxShadow === 'none'), state, 'focus');
    record(`HGR-F0${offset + 2}`, `${prefix} focus keeps a visible dotted text indicator`, Boolean(state && state.backgroundVisible && (decoration === 'border' ? state.borderBottomStyle === 'dotted' && state.borderBottomWidth >= 1.5 : state.textDecorationLine.includes('underline') && state.textDecorationStyle === 'dotted' && state.textDecorationThickness >= 1.5)), state, 'focus');
    await page.keyboard.press('Escape');
  }

  const testPopup = async (selector, openSelector, startId, label) => {
    const trigger = page.locator(selector).first(); await trigger.scrollIntoViewIfNeeded(); await trigger.click();
    await page.waitForSelector(openSelector, { state: 'visible', timeout: 3000 }); await twoFrames(page);
    const state = await popupState(page, openSelector);
    record(`HGR-T${startId}`, `${label} uses borderless rounded paper treatment`, Boolean(state && state.borderTopWidth === 0 && state.borderRadius >= 16), state, 'tooltip');
    record(`HGR-T${startId + 1}`, `${label} remains inside viewport`, Boolean(state?.inViewport), state, 'tooltip');
    record(`HGR-T${startId + 2}`, `${label} has no fake scrollbar`, noFakeScrollbar(state), state, 'tooltip');
    record(`HGR-T${startId + 3}`, `${label} has no large blank tail`, Boolean(state && state.blankTail <= 48), state, 'tooltip');
    await page.keyboard.press('Escape');
  };
  await testPopup('.bref[data-ref]', '.btip.gb-floating-tip.is-open', 4, 'Scripture popup');

  const footnoteReady = await page.evaluate(() => {
    const marker = Array.from(document.querySelectorAll('.fn-marker')).find((candidate) => Array.from(candidate.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent || '').join('').replace(/\s+/g, '').trim() === '40');
    if (!(marker instanceof HTMLElement)) return false; marker.dataset.hgrFootnote = '40'; return true;
  });
  record('HGR-T08', 'representative footnote 40 exists', footnoteReady, { footnoteReady }, 'tooltip');
  if (footnoteReady) await testPopup('[data-hgr-footnote="40"]', '.tooltip.gb-floating-tip.is-open', 9, 'Footnote popup');
  else for (let id = 9; id <= 12; id += 1) record(`HGR-T${id}`, 'footnote popup contract requires representative footnote 40', false, { footnoteReady }, 'tooltip');

  await page.waitForFunction(() => Array.from(document.querySelectorAll('.gterm')).some((term) => term.querySelector('[data-gtip-expand]')), null, { timeout: 15000 });
  const glossaryReady = await page.evaluate(() => {
    const term = Array.from(document.querySelectorAll('.gterm')).find((candidate) => candidate.querySelector('[data-gtip-expand]'));
    if (!(term instanceof HTMLElement)) return false; term.dataset.hgrGlossary = 'expandable'; return true;
  });
  record('HGR-T13', 'expandable hydrated glossary exists', glossaryReady, { glossaryReady }, 'tooltip');
  if (!glossaryReady) {
    for (let id = 14; id <= 26; id += 1) record(`HGR-T${id}`, 'glossary popup contract requires an expandable hydrated term', false, { glossaryReady }, 'tooltip');
    return;
  }
  const glossary = page.locator('[data-hgr-glossary="expandable"]'); await glossary.scrollIntoViewIfNeeded(); await glossary.click();
  await page.waitForSelector('.gtip.gb-floating-tip.is-open', { state: 'visible', timeout: 3000 }); await twoFrames(page);
  const compact = await popupState(page, '.gtip.gb-floating-tip.is-open');
  const semantic = () => page.evaluate(() => {
    const tip = document.querySelector('.gtip.gb-floating-tip.is-open'); const button = tip?.querySelector('[data-gtip-expand]'); const detail = tip?.querySelector('.gtip-detail-wrap');
    const papyrus = tip?.querySelector('.gtip-papyrus'); const box = papyrus?.getBoundingClientRect(); const style = papyrus ? getComputedStyle(papyrus) : null;
    return { expanded: tip?.classList.contains('gtip--expanded') || false, stale: tip?.querySelector('.gtip-luxury')?.classList.contains('is-expanded') || false,
      aria: button?.getAttribute('aria-expanded') || null, label: button?.getAttribute('aria-label') || null, text: String(button?.textContent || '').replace(/\s+/g, ' ').trim(),
      hidden: detail?.getAttribute('aria-hidden') || null, papyrusVisible: Boolean(box && style && style.display !== 'none' && style.visibility !== 'hidden' && box.height > 10) };
  });
  const compactSemantic = await semantic();
  record('HGR-T14', 'compact glossary is naturally sized', Boolean(compact && compact.height > 50 && compact.height < 360), compact, 'tooltip');
  record('HGR-T15', 'compact glossary has no fake scrollbar', noFakeScrollbar(compact), compact, 'tooltip');
  record('HGR-T16', 'compact glossary has no blank tail', Boolean(compact && compact.blankTail <= 48), compact, 'tooltip');
  record('HGR-T17', 'compact glossary semantics are canonical', !compactSemantic.expanded && !compactSemantic.stale && compactSemantic.aria === 'false' && compactSemantic.hidden === 'true', compactSemantic, 'tooltip');
  await page.locator('.gtip.gb-floating-tip.is-open [data-gtip-expand]').click(); await twoFrames(page);
  const expanded = await popupState(page, '.gtip.gb-floating-tip.is-open'); const expandedSemantic = await semantic();
  record('HGR-T18', 'expanded glossary uses only .gtip--expanded', expandedSemantic.expanded && !expandedSemantic.stale, expandedSemantic, 'tooltip');
  record('HGR-T19', 'expanded ARIA and Кратко label are truthful', expandedSemantic.aria === 'true' && expandedSemantic.hidden === 'false' && expandedSemantic.label === 'Кратко' && expandedSemantic.text.includes('Кратко'), expandedSemantic, 'tooltip');
  record('HGR-T20', 'expanded papyrus is visible', expandedSemantic.papyrusVisible, expandedSemantic, 'tooltip');
  record('HGR-T21', 'expanded glossary grows beyond compact height', Boolean(expanded && compact && expanded.height >= compact.height + 40), { compact, expanded }, 'tooltip');
  record('HGR-T22', 'expanded glossary remains inside viewport', Boolean(expanded?.inViewport), expanded, 'tooltip');
  record('HGR-T23', 'expanded glossary scrolls only on real overflow', noFakeScrollbar(expanded), expanded, 'tooltip');
  record('HGR-T24', 'expanded glossary has no blank white panel', Boolean(expanded && expanded.blankTail <= 64), expanded, 'tooltip');
  await page.locator('.gtip.gb-floating-tip.is-open [data-gtip-expand]').click(); await twoFrames(page);
  const collapsed = await popupState(page, '.gtip.gb-floating-tip.is-open'); const collapsedSemantic = await semantic();
  record('HGR-T25', 'collapse restores canonical semantics', !collapsedSemantic.expanded && collapsedSemantic.aria === 'false' && collapsedSemantic.hidden === 'true', collapsedSemantic, 'tooltip');
  record('HGR-T26', 'collapse restores compact height', Boolean(collapsed && compact && Math.abs(collapsed.height - compact.height) <= 12), { compact, collapsed }, 'tooltip');
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
    await setMeasure(page, 'normal'); recordLayout(width, await layoutState(page));
  }
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.GBReaderPreferences && document.querySelector('.summary-card + p'), null, { timeout: 15000 });
  const measured = {};
  for (const [measure, rem] of Object.entries(MEASURES)) {
    await setMeasure(page, measure); const state = await layoutState(page); measured[measure] = state.prose?.width || 0; const expected = rem * state.rootFont;
    record(`HGR-M-${measure}-01`, `${measure} measure matches rem contract`, Boolean(state.prose && Math.abs(state.prose.width - expected) <= 6), { expected, state }, 'measure');
    record(`HGR-M-${measure}-02`, `${measure} summary and prose remain aligned`, Boolean(state.summary && state.prose && Math.abs(state.summary.centerX - state.prose.centerX) <= 2), state, 'measure');
    record(`HGR-M-${measure}-03`, `${measure} summary and prose share width`, Boolean(state.summary && state.prose && Math.abs(state.summary.width - state.prose.width) <= 2), state, 'measure');
    record(`HGR-M-${measure}-04`, `${measure} has no horizontal overflow`, state.scrollWidth - state.clientWidth <= 1, state, 'measure');
  }
  record('HGR-M-ORDER', 'measure modes grow monotonically', measured.narrow < measured.normal && measured.normal < measured.wide, measured, 'measure');
  await popupContracts(page);
  record('HGR-RUNTIME-ERRORS', 'guard has no uncaught page errors', pageErrors.length === 0, pageErrors, 'runtime');
  await page.screenshot({ path: path.join(REPORT_DIR, 'hermenevtika-regression-guard.png'), fullPage: false });
} finally { await context.close(); await browser.close(); }

assert.equal(new Set(checks.map((item) => item.id)).size, checks.length, 'guard check IDs must be unique');
assert.ok(checks.length >= 143, `Hermenevtika guard requires at least 143 checks, got ${checks.length}`);
const failed = checks.filter((item) => !item.pass);
const summary = { sha: process.env.GITHUB_SHA || null, checks: checks.length, passed: checks.length - failed.length, failed: failed.length };
fs.writeFileSync(path.join(REPORT_DIR, 'report.json'), JSON.stringify({ summary, checks }, null, 2));
fs.writeFileSync(path.join(REPORT_DIR, 'report.md'), ['# Hermenevtika regression guards', '', `- SHA: \`${summary.sha || 'local'}\``, `- Checks: **${summary.checks}**`, `- Passed: **${summary.passed}**`, `- Failed: **${summary.failed}**`, '', '| ID | Result | Description |', '|---|---|---|', ...checks.map((item) => `| ${item.id} | ${item.pass ? 'PASS' : 'FAIL'} | ${item.description.replace(/\|/g, '\\|')} |`)].join('\n'));
checks.forEach((item) => console.log(`[HERMENEVTIKA-GUARD] ${item.pass ? 'PASS' : 'FAIL'} ${item.id} :: ${item.description}`));
console.log('[HERMENEVTIKA-GUARD-SUMMARY]', JSON.stringify(summary));
assert.equal(failed.length, 0, `Hermenevtika regression guards failed: ${failed.map((item) => item.id).join(', ')}`);
console.log('Hermenevtika regression guards: PASS');
