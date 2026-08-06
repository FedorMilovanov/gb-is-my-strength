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

assert.ok(BASE, 'AUDIT_BASE is required');
fs.mkdirSync(REPORT_DIR, { recursive: true });

const checks = [];
const record = (id, description, pass, evidence = null, area = 'hermenevtika-tooltip') => {
  checks.push({ id, area, description, pass: Boolean(pass), evidence });
};
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
  const assertions = [
    ['HGT-S01', 'canonical tooltip runtime source exists', runtime.length > 0],
    ['HGT-S02', 'canonical tooltip owner stylesheet exists', runtimeCss.length > 0],
    ['HGT-S03', 'canonical tooltip epoch is exactly 17', /const VERSION\s*=\s*17\s*;/.test(runtime)],
    ['HGT-S04', 'canonical owner name is exact', runtime.includes("const OWNER = 'article-inline-tooltip';")],
    ['HGT-S05', 'runtime claims exactly the three inline selectors', runtime.includes("new Set(['.gterm', '.fn-marker', '.bref[data-ref]'])")],
    ['HGT-S06', 'legacy retirement mutates the original controller array', /controllers\.splice\(index,\s*1\)/.test(runtime)],
    ['HGT-S07', 'runtime never replaces the public legacy-controller array', !/_tooltipControllers\s*=/.test(runtime)],
    ['HGT-S08', 'legacy hover and sticky timers are cleared', runtime.includes('clearLegacyControllerTimers') && runtime.includes('window.clearTimeout')],
    ['HGT-S09', 'late legacy registration is retired after load', /addEventListener\('load',\s*retireLegacyTooltipOwners/.test(runtime)],
    ['HGT-S10', 'runtime publishes exact owner identity', runtime.includes('dataset.gbArticleTooltipsOwner = OWNER')],
    ['HGT-S11', 'runtime publishes exact owner epoch', runtime.includes('dataset.gbArticleTooltipsVersion = String(VERSION)')],
    ['HGT-S12', 'Hermenevtika route has no direct tooltip installer', !route.includes('installArticleTooltips')],
    ['HGT-S13', 'shared bootstrap imports the canonical owner stylesheet', interactions.includes("import './article-tooltips.css';")],
    ['HGT-S14', 'owner stylesheet is scoped to the exact owner marker', runtimeCss.includes('data-gb-article-tooltips-owner="article-inline-tooltip"')],
    ['HGT-S15', 'owner stylesheet exposes natural unconstrained popup height', /\.gb-floating-tip\s*\{[\s\S]*?max-height:\s*none;[\s\S]*?overflow:\s*visible;/.test(runtimeCss)],
    ['HGT-S16', 'paper popovers are borderless and rounded', /\.btip\.gb-floating-tip,[\s\S]*?\.tooltip\.gb-floating-tip\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*18px;/.test(runtimeCss)],
    ['HGT-S17', 'mobile paper popovers release fixed width', /@media\s*\(max-width:\s*768px\)[\s\S]*?\.btip\.gb-floating-tip,[\s\S]*?\.tooltip\.gb-floating-tip\s*\{[\s\S]*?width:\s*auto;[\s\S]*?max-width:\s*none;/.test(runtimeCss)],
    ['HGT-S18', 'boxed open and focus states are retired', /\[aria-expanded="true"\][\s\S]*?:focus-visible[\s\S]*?outline:\s*none;[\s\S]*?box-shadow:\s*none;/.test(runtimeCss)],
    ['HGT-S19', 'glossary keeps a dotted text-level focus indicator', /\.gterm:focus-visible[\s\S]*?border-bottom-style:\s*dotted;/.test(runtimeCss)],
    ['HGT-S20', 'Scripture keeps a dotted underline focus indicator', /\.bref:focus-visible[\s\S]*?text-decoration-style:\s*dotted;/.test(runtimeCss)],
    ['HGT-S21', 'forced-colors keeps an explicit underline fallback', /@media\s*\(forced-colors:\s*active\)[\s\S]*?text-decoration-line:\s*underline;/.test(runtimeCss)],
    ['HGT-S22', 'route stylesheet owns no popup skin or focus override', !/gb-floating-tip|\.gterm:focus-visible|\.bref:focus-visible/.test(routeCss)],
    ['HGT-S23', 'glossary expansion uses only the canonical outer class', runtime.includes("tip.classList.toggle('gtip--expanded', expanded)")],
    ['HGT-S24', 'legacy inner expansion class is removed transactionally', runtime.includes("frame.classList.remove('is-expanded')")],
    ['HGT-S25', 'close resets glossary expansion state', runtime.includes('resetGlossaryTip(tip)') && runtime.includes('setGlossaryExpanded(tip, frame, expand, detail, false)')],
    ['HGT-S26', 'close clears authoritative size and position geometry', runtime.includes('clearAuthoritativeGeometry(tip)') && runtime.includes("'overflow-y'")],
    ['HGT-S27', 'scrolling is enabled only for measured overflow', runtime.includes('tip.scrollHeight > height + 1')],
    ['HGT-S28', 'geometry uses VisualViewport with client-width fallback', runtime.includes('function viewportBounds()') && runtime.includes('window.visualViewport') && runtime.includes('document.documentElement.clientWidth')],
    ['HGT-S29', 'crossing 768px closes the active owner cleanly', runtime.includes("closeTooltip('mode-change')") && runtime.includes('active.mobile !== mobileMode()')],
    ['HGT-S30', 'VisualViewport resize and pan use one canonical handler', runtime.includes("visualViewport?.addEventListener('resize', handleViewportChange") && runtime.includes("visualViewport?.addEventListener('scroll', handleViewportChange")],
  ];
  assertions.forEach(([id, description, pass]) => record(id, description, pass, null, 'source'));
}

const twoFrames = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function waitForOwner(page) {
  await page.waitForFunction(({ owner, version }) => {
    const data = document.documentElement.dataset;
    return window.GBArticleTooltips?.version === version &&
      window.GBArticleTooltips?.owner === owner &&
      data.gbArticleTooltipsOwner === owner &&
      data.gbArticleTooltipsVersion === String(version);
  }, { owner: OWNER, version: OWNER_VERSION }, { timeout: 15000 });
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
    const clientWidth = document.documentElement.clientWidth;
    return {
      borderTopWidth: parseFloat(style.borderTopWidth) || 0,
      borderRadius: parseFloat(style.borderTopLeftRadius) || 0,
      overflowY: style.overflowY,
      clientHeight: tip.clientHeight,
      scrollHeight: tip.scrollHeight,
      width: box.width,
      height: box.height,
      left: box.left,
      right: box.right,
      top: box.top,
      bottom: box.bottom,
      clientWidth,
      blankTail: Math.max(0, box.bottom - Math.max(box.top, ...bottoms)),
      inViewport: box.left >= -1 && box.top >= -1 && box.right <= clientWidth + 1 && box.bottom <= window.innerHeight + 1,
    };
  }, selector);
}
const noFakeScrollbar = (state) => Boolean(state) && (!['auto', 'scroll'].includes(state.overflowY) || state.scrollHeight > state.clientHeight + 1);

async function keyboardFocusState(page, selector) {
  const prepared = await page.evaluate((value) => {
    const target = document.querySelector(value);
    if (!(target instanceof HTMLElement)) return false;
    if (!target.matches('button,a[href],[tabindex]')) target.tabIndex = 0;
    const sentinel = document.createElement('button');
    sentinel.dataset.hgtFocusSentinel = '1';
    sentinel.style.cssText = 'position:fixed;left:-10000px;top:0';
    target.before(sentinel);
    sentinel.focus();
    return true;
  }, selector);
  if (!prepared) return null;
  await page.keyboard.press('Tab');
  await twoFrames(page);
  return page.evaluate((value) => {
    const target = document.querySelector(value);
    document.querySelector('[data-hgt-focus-sentinel]')?.remove();
    if (!(target instanceof HTMLElement)) return null;
    const style = getComputedStyle(target);
    const background = style.backgroundColor.replace(/\s+/g, '');
    return {
      focused: document.activeElement === target,
      focusVisible: target.matches(':focus-visible'),
      outlineWidth: parseFloat(style.outlineWidth) || 0,
      boxShadow: style.boxShadow,
      backgroundVisible: !['rgba(0,0,0,0)', 'transparent'].includes(background),
      borderBottomWidth: parseFloat(style.borderBottomWidth) || 0,
      borderBottomStyle: style.borderBottomStyle,
      textDecorationLine: style.textDecorationLine,
      textDecorationStyle: style.textDecorationStyle,
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
  await twoFrames(page);
  const desktop = await popupState(page, '.btip.gb-floating-tip.is-open');
  record('HGT-R01', 'desktop popup opens above the mobile boundary', Boolean(desktop), desktop, 'responsive');
  record('HGT-R02', 'desktop popup remains a bounded card, not a full-width sheet', Boolean(desktop && desktop.width < desktop.clientWidth - 32 && desktop.inViewport), desktop, 'responsive');
  record('HGT-R10', 'desktop boundary popup has no fake scrollbar', noFakeScrollbar(desktop), desktop, 'responsive');

  await page.setViewportSize({ width: 768, height: 900 });
  await page.waitForFunction(() => !document.querySelector('.gb-floating-tip.is-open'), null, { timeout: 3000 });
  await twoFrames(page);
  const desktopToMobile = await restoredTooltipState(page);
  record('HGT-R03', 'desktop-to-mobile transition closes the active popup', desktopToMobile.openCount === 0 && desktopToMobile.anchorExpanded === 'false', desktopToMobile, 'responsive');
  record('HGT-R04', 'desktop-to-mobile transition clears floating geometry and lock', desktopToMobile.floatingCount === 0 && desktopToMobile.staleProperties.length === 0 && !desktopToMobile.locked, desktopToMobile, 'responsive');

  await trigger.click();
  await page.waitForSelector('.btip.gb-floating-tip.is-open', { state: 'visible', timeout: 3000 });
  await twoFrames(page);
  const mobile = await popupState(page, '.btip.gb-floating-tip.is-open');
  record('HGT-R05', 'mobile Scripture sheet opens below the desktop boundary', Boolean(mobile), mobile, 'responsive');
  record('HGT-R06', 'mobile Scripture sheet spans the client viewport', Boolean(mobile && Math.abs(mobile.width - mobile.clientWidth) <= 2 && Math.abs(mobile.left) <= 1 && Math.abs(mobile.right - mobile.clientWidth) <= 2), mobile, 'responsive');
  record('HGT-R07', 'mobile Scripture sheet has no fake scrollbar', noFakeScrollbar(mobile), mobile, 'responsive');
  record('HGT-R11', 'mobile Scripture sheet remains inside viewport with rounded top corners', Boolean(mobile && mobile.inViewport && mobile.borderRadius >= 20), mobile, 'responsive');
  record('HGT-R12', 'mobile Scripture sheet has no large blank tail', Boolean(mobile && mobile.blankTail <= 48), mobile, 'responsive');

  await page.setViewportSize({ width: 769, height: 900 });
  await page.waitForFunction(() => !document.querySelector('.gb-floating-tip.is-open'), null, { timeout: 3000 });
  await twoFrames(page);
  const mobileToDesktop = await restoredTooltipState(page);
  record('HGT-R08', 'mobile-to-desktop transition closes the active sheet', mobileToDesktop.openCount === 0 && mobileToDesktop.anchorExpanded === 'false', mobileToDesktop, 'responsive');
  record('HGT-R09', 'mobile-to-desktop transition clears scroll lock and geometry', mobileToDesktop.floatingCount === 0 && mobileToDesktop.staleProperties.length === 0 && !mobileToDesktop.locked, mobileToDesktop, 'responsive');
}

async function popupContracts(page) {
  await modeTransitionContracts(page);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'load', timeout: 60000 });
  await waitForOwner(page);
  await twoFrames(page);

  const ownerState = await page.evaluate((owned) => ({
    globalVersion: window.GBArticleTooltips?.version || 0,
    globalOwner: window.GBArticleTooltips?.owner || null,
    markerOwner: document.documentElement.dataset.gbArticleTooltipsOwner || null,
    markerVersion: document.documentElement.dataset.gbArticleTooltipsVersion || null,
    interactionsReady: document.documentElement.dataset.gbArticleInteractionsReady || null,
    legacyOwners: Array.isArray(window.SiteUtils?._tooltipControllers)
      ? window.SiteUtils._tooltipControllers.map((item) => item?.anchorSel).filter((selector) => owned.includes(selector))
      : [],
  }), OWNED_SELECTORS);
  record('HGT-T01', 'exact owner v17 is published by the owner module', ownerState.globalVersion === OWNER_VERSION && ownerState.globalOwner === OWNER && ownerState.markerOwner === OWNER && ownerState.markerVersion === String(OWNER_VERSION), ownerState, 'tooltip');
  record('HGT-T02', 'shared interaction bootstrap completes after owner installation', ownerState.interactionsReady === '1', ownerState, 'tooltip');
  record('HGT-T03', 'no legacy owner remains after load', ownerState.legacyOwners.length === 0, ownerState, 'tooltip');

  for (const [prefix, selector, decoration] of [['glossary', '.gterm', 'border'], ['Scripture', '.bref[data-ref]', 'underline']]) {
    const state = await keyboardFocusState(page, selector);
    const offset = prefix === 'glossary' ? 1 : 4;
    record(`HGT-F0${offset}`, `${prefix} receives keyboard-visible focus`, Boolean(state?.focused && state?.focusVisible), state, 'focus');
    record(`HGT-F0${offset + 1}`, `${prefix} focus has no rectangular frame`, Boolean(state && state.outlineWidth === 0 && state.boxShadow === 'none'), state, 'focus');
    record(`HGT-F0${offset + 2}`, `${prefix} focus keeps a visible dotted text indicator`, Boolean(state && state.backgroundVisible && (decoration === 'border'
      ? state.borderBottomStyle === 'dotted' && state.borderBottomWidth >= 1.5
      : state.textDecorationLine.includes('underline') && state.textDecorationStyle === 'dotted' && state.textDecorationThickness >= 1.5)), state, 'focus');
    await page.keyboard.press('Escape');
  }

  const testPopup = async (selector, openSelector, startId, label) => {
    const trigger = page.locator(selector).first();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await page.waitForSelector(openSelector, { state: 'visible', timeout: 3000 });
    await twoFrames(page);
    const state = await popupState(page, openSelector);
    record(`HGT-T${startId}`, `${label} uses borderless rounded paper treatment`, Boolean(state && state.borderTopWidth === 0 && state.borderRadius >= 16), state, 'tooltip');
    record(`HGT-T${startId + 1}`, `${label} remains inside viewport`, Boolean(state?.inViewport), state, 'tooltip');
    record(`HGT-T${startId + 2}`, `${label} has no fake scrollbar`, noFakeScrollbar(state), state, 'tooltip');
    record(`HGT-T${startId + 3}`, `${label} has no large blank tail`, Boolean(state && state.blankTail <= 48), state, 'tooltip');
    await page.keyboard.press('Escape');
  };
  await testPopup('.bref[data-ref]', '.btip.gb-floating-tip.is-open', 4, 'Scripture popup');

  const footnoteReady = await page.evaluate(() => {
    const marker = Array.from(document.querySelectorAll('.fn-marker')).find((candidate) => {
      const text = Array.from(candidate.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent || '').join('').replace(/\s+/g, '').trim();
      return text === '40';
    });
    if (!(marker instanceof HTMLElement)) return false;
    marker.dataset.hgtFootnote = '40';
    return true;
  });
  record('HGT-T08', 'representative footnote 40 exists', footnoteReady, { footnoteReady }, 'tooltip');
  if (footnoteReady) await testPopup('[data-hgt-footnote="40"]', '.tooltip.gb-floating-tip.is-open', 9, 'Footnote popup');
  else for (let id = 9; id <= 12; id += 1) record(`HGT-T${id}`, 'footnote popup contract requires representative footnote 40', false, { footnoteReady }, 'tooltip');

  await page.waitForFunction(() => Array.from(document.querySelectorAll('.gterm')).some((term) => term.querySelector('[data-gtip-expand]')), null, { timeout: 15000 });
  const glossaryReady = await page.evaluate(() => {
    const term = Array.from(document.querySelectorAll('.gterm')).find((candidate) => candidate.querySelector('[data-gtip-expand]'));
    if (!(term instanceof HTMLElement)) return false;
    term.dataset.hgtGlossary = 'expandable';
    return true;
  });
  record('HGT-T13', 'expandable hydrated glossary exists', glossaryReady, { glossaryReady }, 'tooltip');
  if (!glossaryReady) {
    for (let id = 14; id <= 26; id += 1) record(`HGT-T${id}`, 'glossary contract requires an expandable hydrated term', false, { glossaryReady }, 'tooltip');
    return;
  }

  const glossary = page.locator('[data-hgt-glossary="expandable"]');
  await glossary.scrollIntoViewIfNeeded();
  await glossary.click();
  await page.waitForSelector('.gtip.gb-floating-tip.is-open', { state: 'visible', timeout: 3000 });
  await twoFrames(page);
  const compact = await popupState(page, '.gtip.gb-floating-tip.is-open');
  const semantic = () => page.evaluate(() => {
    const tip = document.querySelector('.gtip.gb-floating-tip.is-open');
    const button = tip?.querySelector('[data-gtip-expand]');
    const detail = tip?.querySelector('.gtip-detail-wrap');
    const papyrus = tip?.querySelector('.gtip-papyrus');
    const box = papyrus?.getBoundingClientRect();
    const style = papyrus ? getComputedStyle(papyrus) : null;
    return {
      expanded: tip?.classList.contains('gtip--expanded') || false,
      stale: tip?.querySelector('.gtip-luxury')?.classList.contains('is-expanded') || false,
      aria: button?.getAttribute('aria-expanded') || null,
      label: button?.getAttribute('aria-label') || null,
      text: String(button?.textContent || '').replace(/\s+/g, ' ').trim(),
      hidden: detail?.getAttribute('aria-hidden') || null,
      papyrusVisible: Boolean(box && style && style.display !== 'none' && style.visibility !== 'hidden' && box.height > 10),
    };
  });
  const compactSemantic = await semantic();
  record('HGT-T14', 'compact glossary is naturally sized', Boolean(compact && compact.height > 50 && compact.height < 360), compact, 'tooltip');
  record('HGT-T15', 'compact glossary has no fake scrollbar', noFakeScrollbar(compact), compact, 'tooltip');
  record('HGT-T16', 'compact glossary has no blank tail', Boolean(compact && compact.blankTail <= 48), compact, 'tooltip');
  record('HGT-T17', 'compact glossary semantics are canonical', !compactSemantic.expanded && !compactSemantic.stale && compactSemantic.aria === 'false' && compactSemantic.hidden === 'true', compactSemantic, 'tooltip');

  await page.locator('.gtip.gb-floating-tip.is-open [data-gtip-expand]').click();
  await twoFrames(page);
  const expanded = await popupState(page, '.gtip.gb-floating-tip.is-open');
  const expandedSemantic = await semantic();
  record('HGT-T18', 'expanded glossary uses only .gtip--expanded', expandedSemantic.expanded && !expandedSemantic.stale, expandedSemantic, 'tooltip');
  record('HGT-T19', 'expanded ARIA and Кратко label are truthful', expandedSemantic.aria === 'true' && expandedSemantic.hidden === 'false' && expandedSemantic.label === 'Кратко' && expandedSemantic.text.includes('Кратко'), expandedSemantic, 'tooltip');
  record('HGT-T20', 'expanded papyrus is visible', expandedSemantic.papyrusVisible, expandedSemantic, 'tooltip');
  record('HGT-T21', 'expanded glossary grows beyond compact height', Boolean(expanded && compact && expanded.height >= compact.height + 40), { compact, expanded }, 'tooltip');
  record('HGT-T22', 'expanded glossary remains inside viewport', Boolean(expanded?.inViewport), expanded, 'tooltip');
  record('HGT-T23', 'expanded glossary scrolls only on real overflow', noFakeScrollbar(expanded), expanded, 'tooltip');
  record('HGT-T24', 'expanded glossary has no blank white panel', Boolean(expanded && expanded.blankTail <= 64), expanded, 'tooltip');

  await page.locator('.gtip.gb-floating-tip.is-open [data-gtip-expand]').click();
  await twoFrames(page);
  const collapsed = await popupState(page, '.gtip.gb-floating-tip.is-open');
  const collapsedSemantic = await semantic();
  record('HGT-T25', 'collapse restores canonical semantics', !collapsedSemantic.expanded && collapsedSemantic.aria === 'false' && collapsedSemantic.hidden === 'true', collapsedSemantic, 'tooltip');
  record('HGT-T26', 'collapse restores compact height', Boolean(collapsed && compact && Math.abs(collapsed.height - compact.height) <= 12), { compact, collapsed }, 'tooltip');
}

sourceContracts();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
try {
  await popupContracts(page);
  record('HGT-RUNTIME-ERRORS', 'Hermenevtika tooltip guard has no uncaught page errors', pageErrors.length === 0, pageErrors, 'runtime');
  await page.screenshot({ path: path.join(REPORT_DIR, 'hermenevtika-tooltip-guard.png'), fullPage: false });
} finally {
  await context.close();
  await browser.close();
}

assert.equal(new Set(checks.map((item) => item.id)).size, checks.length, 'tooltip guard check IDs must be unique');
assert.ok(checks.length >= 75, `Hermenevtika tooltip guard requires at least 75 checks, got ${checks.length}`);
const failed = checks.filter((item) => !item.pass);
const summary = { sha: process.env.GITHUB_SHA || null, checks: checks.length, passed: checks.length - failed.length, failed: failed.length };
fs.writeFileSync(path.join(REPORT_DIR, 'report.json'), JSON.stringify({ summary, checks }, null, 2));
fs.writeFileSync(path.join(REPORT_DIR, 'report.md'), ['# Hermenevtika tooltip regression guards', '', `- SHA: \`${summary.sha || 'local'}\``, `- Checks: **${summary.checks}**`, `- Passed: **${summary.passed}**`, `- Failed: **${summary.failed}**`, '', '| ID | Result | Description |', '|---|---|---|', ...checks.map((item) => `| ${item.id} | ${item.pass ? 'PASS' : 'FAIL'} | ${item.description.replace(/\|/g, '\\|')} |`)].join('\n'));
checks.forEach((item) => console.log(`[HERMENEVTIKA-TOOLTIP] ${item.pass ? 'PASS' : 'FAIL'} ${item.id} :: ${item.description}`));
console.log('[HERMENEVTIKA-TOOLTIP-SUMMARY]', JSON.stringify(summary));
assert.equal(failed.length, 0, `Hermenevtika tooltip guards failed: ${failed.map((item) => item.id).join(', ')}`);
console.log('Hermenevtika tooltip guards: PASS');
