#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const REPORTS = path.join(ROOT, 'reports');
fs.mkdirSync(REPORTS, { recursive: true });
assert.ok(fs.existsSync(DIST), 'production-like dist is required');

const ROUTES = [
  { id: 'herm', route: '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/', expectSpeakable: true },
  { id: 'gill', route: '/articles/dzhon-gill-chast-1-chelovek/', expectSpeakable: false },
  { id: 'antisovetov', route: '/articles/20-antisovetov-pastoru/', expectSpeakable: false },
];
const VIEWPORTS = [
  { id: 'desktop-1440', width: 1440, height: 900, mobile: false },
  { id: 'mobile-390', width: 390, height: 844, mobile: true },
];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.bin': 'application/octet-stream',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
      let target = path.join(DIST, pathname.replace(/^\/+/, ''));
      if (pathname.endsWith('/')) target = path.join(target, 'index.html');
      if (!path.extname(target)) target = path.join(target, 'index.html');
      if (!target.startsWith(DIST) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, {
        'content-type': MIME[path.extname(target)] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      fs.createReadStream(target).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

function addCheck(checks, id, area, description, pass, evidence, severity = 'P2') {
  checks.push({ id, area, description, pass: Boolean(pass), evidence, severity });
}
function visibleSnapshot(element) {
  if (!element) return null;
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return {
    visible: style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01 && rect.width > 0 && rect.height > 0,
    display: style.display,
    visibility: style.visibility,
    opacity: style.opacity,
    hidden: element.hidden,
    inert: Boolean(element.inert || element.hasAttribute('inert')),
    ariaHidden: element.getAttribute('aria-hidden'),
    tabIndex: element.tabIndex,
  };
}

async function installFixture(context) {
  await context.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem('gbx-vosk-warmup', 'off');
      localStorage.setItem('gb:audio:rate', '1');
    } catch {}
    window.__readerAuditSpeech = { speaks: 0, cancels: 0, lastText: '' };
    function FakeUtterance(text) {
      this.text = String(text || '');
      this.rate = 1;
      this.lang = 'ru-RU';
      this.onboundary = null;
      this.onend = null;
      this.onerror = null;
    }
    const speech = {
      getVoices: () => [{ name: 'Fixture Russian', lang: 'ru-RU', localService: true }],
      speak: (utterance) => {
        window.__readerAuditSpeech.speaks += 1;
        window.__readerAuditSpeech.lastText = utterance.text;
        window.__readerAuditSpeech.active = utterance;
      },
      cancel: () => {
        window.__readerAuditSpeech.cancels += 1;
        window.__readerAuditSpeech.active = null;
      },
      pause: () => {}, resume: () => {}, addEventListener: () => {}, removeEventListener: () => {},
    };
    try { Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance }); } catch { window.SpeechSynthesisUtterance = FakeUtterance; }
    try { Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: speech }); } catch { window.speechSynthesis = speech; }
  });
}

async function inventoryPage(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const snap = (() => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01 && rect.width > 0 && rect.height > 0;
      })();
      return snap;
    };
    const ids = Array.from(document.querySelectorAll('[id]')).map((node) => node.id);
    const duplicateIds = ids.filter((id, index) => id && ids.indexOf(id) !== index);
    const plays = Array.from(document.querySelectorAll('[data-fc-action="play"]'));
    const saves = Array.from(document.querySelectorAll('[data-fc-action="save"], .gb-save'));
    const jsonLd = [];
    const jsonErrors = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((node, index) => {
      try { jsonLd.push(JSON.parse(node.textContent || '{}')); }
      catch (error) { jsonErrors.push({ index, error: error.message }); }
    });
    const flattened = JSON.stringify(jsonLd);
    const hiddenFocusable = Array.from(document.querySelectorAll('button,a[href],input,select,textarea,[tabindex]'))
      .filter((node) => {
        if (node.tabIndex < 0 || node.disabled) return false;
        const style = getComputedStyle(node);
        const ownHidden = node.hidden || node.getAttribute('aria-hidden') === 'true' || node.closest('[hidden],[aria-hidden="true"],[inert]');
        const visuallyHidden = style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || 1) <= 0.01;
        return Boolean(ownHidden || visuallyHidden);
      })
      .map((node) => ({ tag: node.tagName, id: node.id, className: node.className, tabIndex: node.tabIndex }));
    return {
      title: document.title,
      ttsReady: document.documentElement.dataset.gbReaderTtsReady || null,
      hasTtsApi: Boolean(window.GBReaderTTS),
      ttsVersion: window.GBReaderTTS?.version || null,
      hasProjectionApi: Boolean(window.ReaderProjection || window.GBReaderProjection),
      playCount: plays.length,
      visiblePlayCount: plays.filter(visible).length,
      playPopupClaims: plays.map((node) => ({
        id: node.id, visible: visible(node), haspopup: node.getAttribute('aria-haspopup'),
        expanded: node.getAttribute('aria-expanded'), controls: node.getAttribute('aria-controls'),
      })),
      saveCount: saves.length,
      visibleSaveCount: saves.filter(visible).length,
      saveSemanticsComplete: saves.every((node) => node.hasAttribute('aria-pressed') && node.hasAttribute('aria-label')),
      legacyTtsOverlay: Boolean(document.querySelector('.gbx-tts')),
      jsonLdCount: jsonLd.length,
      jsonErrors,
      hasArticleSchema: /Article/.test(flattened),
      hasSpeakable: /SpeakableSpecification/.test(flattened),
      duplicateIds: Array.from(new Set(duplicateIds)),
      hiddenFocusable,
      explicitProjectionMarkers: document.querySelectorAll('[data-reader-include],[data-reader-exclude],[data-reader-section],[data-reader-summary],[data-reader-note-policy],[data-search-policy],[data-speakable-policy]').length,
    };
  });
}

async function auditSpeedSlot(page, routeId, checks) {
  const config = routeId === 'herm'
    ? { root: '.hmtop', rail: '.hm-speedrail', inactive: '.hm-slot-search', badge: '.hm-spdbadge', radio: '.hm-spd' }
    : routeId === 'gill'
      ? { root: '.mobile-top-bar', rail: '.mobile-speedrail', inactive: '.mobile-learning-trigger', badge: '.mobile-spdbadge', radio: '.mobile-speed' }
      : null;
  if (!config) return;
  const prefix = `RC-BROWSER-${routeId.toUpperCase()}-SLOT`;
  const initial = await page.evaluate((cfg) => {
    const root = document.querySelector(cfg.root) || document.querySelector('[data-fc-speed-mode="inline"]');
    const rail = document.querySelector(cfg.rail);
    const inactive = document.querySelector(cfg.inactive);
    const badge = document.querySelector(cfg.badge);
    const radios = Array.from(document.querySelectorAll(cfg.radio));
    const snap = (element) => {
      if (!element) return null;
      const style = getComputedStyle(element); const rect = element.getBoundingClientRect();
      return { visible: style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > .01 && rect.width > 0 && rect.height > 0,
        ariaHidden: element.getAttribute('aria-hidden'), inert: Boolean(element.inert || element.hasAttribute('inert')), tabIndex: element.tabIndex };
    };
    return { root: snap(root), rail: snap(rail), inactive: snap(inactive), badge: snap(badge),
      radioTabStops: radios.filter((node) => node.tabIndex === 0).length,
      radioChecked: radios.filter((node) => node.getAttribute('aria-checked') === 'true').length,
      badgeControls: badge?.getAttribute('aria-controls') || null,
      badgeExpanded: badge?.getAttribute('aria-expanded') || null };
  }, config);
  addCheck(checks, `${prefix}-01`, `${routeId}-slot`, 'Speed slot owners exist', initial.rail && initial.badge, initial);
  addCheck(checks, `${prefix}-02`, `${routeId}-slot`, 'Inactive speed rail is not visually exposed', initial.rail && !initial.rail.visible, initial.rail, 'P1');
  addCheck(checks, `${prefix}-03`, `${routeId}-slot`, 'Inactive speed rail is aria-hidden or inert', initial.rail && (initial.rail.ariaHidden === 'true' || initial.rail.inert), initial.rail, 'P1');
  addCheck(checks, `${prefix}-04`, `${routeId}-slot`, 'Inactive speed radios have zero Tab stops', initial.radioTabStops === 0, initial, 'P1');
  addCheck(checks, `${prefix}-05`, `${routeId}-slot`, 'Exactly one radio is selected', initial.radioChecked === 1, initial);
  addCheck(checks, `${prefix}-06`, `${routeId}-slot`, 'Badge owns the rail with aria-controls', Boolean(initial.badgeControls), initial, 'P2');
  addCheck(checks, `${prefix}-07`, `${routeId}-slot`, 'Badge exposes closed aria-expanded', initial.badgeExpanded === 'false', initial, 'P2');

  const badge = page.locator(config.badge).first();
  if (await badge.count()) {
    await badge.click({ timeout: 5000 });
    await page.waitForTimeout(100);
  }
  const opened = await page.evaluate((cfg) => {
    const rail = document.querySelector(cfg.rail); const inactive = document.querySelector(cfg.inactive); const badge = document.querySelector(cfg.badge);
    const radios = Array.from(document.querySelectorAll(cfg.radio));
    const snap = (element) => {
      if (!element) return null;
      const style = getComputedStyle(element); const rect = element.getBoundingClientRect();
      return { visible: style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > .01 && rect.width > 0 && rect.height > 0,
        ariaHidden: element.getAttribute('aria-hidden'), inert: Boolean(element.inert || element.hasAttribute('inert')), tabIndex: element.tabIndex };
    };
    return { rail: snap(rail), inactive: snap(inactive), badgeExpanded: badge?.getAttribute('aria-expanded') || null,
      radioTabStops: radios.filter((node) => node.tabIndex === 0).length,
      checkedIndex: radios.findIndex((node) => node.getAttribute('aria-checked') === 'true') };
  }, config);
  addCheck(checks, `${prefix}-08`, `${routeId}-slot`, 'Opened speed rail is visually exposed', opened.rail?.visible, opened.rail, 'P1');
  addCheck(checks, `${prefix}-09`, `${routeId}-slot`, 'Opened speed rail is not aria-hidden/inert', opened.rail && opened.rail.ariaHidden !== 'true' && !opened.rail.inert, opened.rail, 'P1');
  addCheck(checks, `${prefix}-10`, `${routeId}-slot`, 'Inactive alternate layer leaves accessibility tree', opened.inactive && (opened.inactive.ariaHidden === 'true' || opened.inactive.inert || opened.inactive.tabIndex < 0), opened.inactive, 'P1');
  addCheck(checks, `${prefix}-11`, `${routeId}-slot`, 'Opened radiogroup has exactly one Tab stop', opened.radioTabStops === 1, opened, 'P1');
  addCheck(checks, `${prefix}-12`, `${routeId}-slot`, 'Badge exposes open aria-expanded', opened.badgeExpanded === 'true', opened, 'P2');

  const activeRadio = page.locator(`${config.radio}[aria-checked="true"]`).first();
  if (await activeRadio.count()) {
    await activeRadio.focus();
    const before = await page.evaluate((selector) => Array.from(document.querySelectorAll(selector)).findIndex((node) => node === document.activeElement), config.radio);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(30);
    const afterArrow = await page.evaluate((selector) => ({
      focus: Array.from(document.querySelectorAll(selector)).findIndex((node) => node === document.activeElement),
      checked: Array.from(document.querySelectorAll(selector)).findIndex((node) => node.getAttribute('aria-checked') === 'true'),
    }), config.radio);
    addCheck(checks, `${prefix}-13`, `${routeId}-slot`, 'ArrowRight moves radio focus', afterArrow.focus !== before && afterArrow.focus >= 0, { before, afterArrow }, 'P1');
    addCheck(checks, `${prefix}-14`, `${routeId}-slot`, 'ArrowRight updates selected speed', afterArrow.checked === afterArrow.focus, afterArrow, 'P1');
    await page.keyboard.press('End'); await page.waitForTimeout(30);
    const end = await page.evaluate((selector) => ({ count: document.querySelectorAll(selector).length, focus: Array.from(document.querySelectorAll(selector)).findIndex((node) => node === document.activeElement) }), config.radio);
    addCheck(checks, `${prefix}-15`, `${routeId}-slot`, 'End moves focus to final speed', end.focus === end.count - 1, end, 'P2');
    await page.keyboard.press('Home'); await page.waitForTimeout(30);
    const home = await page.evaluate((selector) => Array.from(document.querySelectorAll(selector)).findIndex((node) => node === document.activeElement), config.radio);
    addCheck(checks, `${prefix}-16`, `${routeId}-slot`, 'Home moves focus to first speed', home === 0, { home }, 'P2');
  } else {
    for (let index = 13; index <= 16; index += 1) addCheck(checks, `${prefix}-${index}`, `${routeId}-slot`, 'Radiogroup keyboard owner exists', false, 'no active radio', 'P1');
  }

  await page.mouse.click(5, Math.floor(page.viewportSize().height / 2));
  await page.waitForTimeout(100);
  const closed = await page.evaluate((cfg) => {
    const rail = document.querySelector(cfg.rail);
    const focusedInside = Boolean(rail && rail.contains(document.activeElement));
    const style = rail ? getComputedStyle(rail) : null; const rect = rail?.getBoundingClientRect();
    return { visible: Boolean(rail && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > .01 && rect.width > 0 && rect.height > 0),
      ariaHidden: rail?.getAttribute('aria-hidden') || null, inert: Boolean(rail?.inert || rail?.hasAttribute('inert')), focusedInside };
  }, config);
  addCheck(checks, `${prefix}-17`, `${routeId}-slot`, 'Outside close hides speed rail', !closed.visible, closed, 'P1');
  addCheck(checks, `${prefix}-18`, `${routeId}-slot`, 'Closed rail is aria-hidden or inert', closed.ariaHidden === 'true' || closed.inert, closed, 'P1');
  addCheck(checks, `${prefix}-19`, `${routeId}-slot`, 'Focus is not stranded inside closed rail', !closed.focusedInside, closed, 'P1');
}

async function auditSave(page, routeId, checks) {
  const prefix = `RC-BROWSER-${routeId.toUpperCase()}-SAVE`;
  const visibleSave = page.locator('[data-fc-action="save"]:visible, .gb-save:visible').first();
  const before = await page.evaluate(() => ({
    count: document.querySelectorAll('.gb-save').length,
    pressed: Array.from(document.querySelectorAll('.gb-save')).map((node) => node.getAttribute('aria-pressed')),
  }));
  addCheck(checks, `${prefix}-01`, `${routeId}-save`, 'At least one save surface exists', before.count > 0, before);
  if (await visibleSave.count()) {
    await visibleSave.click({ timeout: 5000 });
    await page.waitForTimeout(80);
  }
  const after = await page.evaluate(() => {
    let stored = null; let parseError = null;
    try { stored = JSON.parse(localStorage.getItem('gb-favorites') || '[]'); } catch (error) { parseError = error.message; }
    const saves = Array.from(document.querySelectorAll('.gb-save'));
    return {
      pressed: saves.map((node) => node.getAttribute('aria-pressed')),
      labels: saves.map((node) => node.getAttribute('aria-label')),
      classes: saves.map((node) => node.classList.contains('is-saved')),
      stored,
      parseError,
      siteConfigPage: window.SITE_CONFIG?.page || null,
    };
  });
  const entry = Array.isArray(after.stored) ? after.stored[0] : null;
  addCheck(checks, `${prefix}-02`, `${routeId}-save`, 'Save state synchronizes aria-pressed on all surfaces', after.pressed.length > 0 && after.pressed.every((value) => value === 'true'), after, 'P1');
  addCheck(checks, `${prefix}-03`, `${routeId}-save`, 'Save state synchronizes visual class on all surfaces', after.classes.length > 0 && after.classes.every(Boolean), after, 'P2');
  addCheck(checks, `${prefix}-04`, `${routeId}-save`, 'Save state synchronizes accessible label on all surfaces', after.labels.length > 0 && after.labels.every((value) => /убрать|сохранен|избран/i.test(value || '')), after, 'P2');
  addCheck(checks, `${prefix}-05`, `${routeId}-save`, 'Favorites storage remains valid JSON', !after.parseError && Array.isArray(after.stored), after.parseError || 'valid');
  addCheck(checks, `${prefix}-06`, `${routeId}-save`, 'Favorite entry stores normalized path', typeof entry?.path === 'string' && entry.path.startsWith('/'), entry);
  addCheck(checks, `${prefix}-07`, `${routeId}-save`, 'Favorite entry stores title', typeof entry?.title === 'string' && entry.title.length > 2, entry);
  addCheck(checks, `${prefix}-08`, `${routeId}-save`, 'Favorite entry stores canonical category/type metadata', Boolean(entry?.category || entry?.contentType || entry?.type), entry, 'P1');
  addCheck(checks, `${prefix}-09`, `${routeId}-save`, 'Favorite entry declares payload schema version', Number.isFinite(entry?.schemaVersion) || Number.isFinite(entry?.version), entry, 'P2');
  addCheck(checks, `${prefix}-10`, `${routeId}-save`, 'A canonical favorite store API is exposed', await page.evaluate(() => Boolean(window.GBFavorites || window.GBFavoriteStore || window.FavoriteStore)), 'window store API', 'P1');
}

async function auditRoute(browser, origin, routeInfo, viewport) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.mobile, hasTouch: viewport.mobile });
  await installFixture(context);
  const page = await context.newPage();
  const consoleErrors = []; const pageErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message || String(error)));
  const checks = [];
  const caseId = `${routeInfo.id}-${viewport.id}`;
  try {
    const response = await page.goto(origin + routeInfo.route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(350);
    const inventory = await inventoryPage(page);
    const prefix = `RC-BROWSER-${routeInfo.id.toUpperCase()}-${viewport.mobile ? 'M' : 'D'}`;
    addCheck(checks, `${prefix}-01`, 'route-baseline', 'Route returns a successful document', Boolean(response && response.status() < 400), { status: response?.status(), route: routeInfo.route }, 'P1');
    addCheck(checks, `${prefix}-02`, 'route-baseline', 'No uncaught page errors', pageErrors.length === 0, pageErrors, 'P1');
    addCheck(checks, `${prefix}-03`, 'route-baseline', 'Canonical GBReaderTTS is ready', inventory.hasTtsApi && Number(inventory.ttsVersion) >= 2, inventory, 'P1');
    addCheck(checks, `${prefix}-04`, 'route-baseline', 'No public legacy TTS overlay is rendered', !inventory.legacyTtsOverlay, inventory.legacyTtsOverlay, 'P1');
    addCheck(checks, `${prefix}-05`, 'route-baseline', 'At least one Play owner is rendered', inventory.playCount > 0, inventory.playCount, 'P1');
    addCheck(checks, `${prefix}-06`, 'route-baseline', 'Exactly one Play owner is visible', inventory.visiblePlayCount === 1, inventory.visiblePlayCount, 'P1');
    addCheck(checks, `${prefix}-07`, 'route-baseline', 'Save surfaces expose pressed and label semantics', inventory.saveCount > 0 && inventory.saveSemanticsComplete, inventory, 'P2');
    addCheck(checks, `${prefix}-08`, 'route-baseline', 'JSON-LD parses without errors', inventory.jsonLdCount > 0 && inventory.jsonErrors.length === 0, inventory.jsonErrors, 'P1');
    addCheck(checks, `${prefix}-09`, 'route-baseline', 'Article JSON-LD is present', inventory.hasArticleSchema, inventory.jsonLdCount, 'P2');
    addCheck(checks, `${prefix}-10`, 'route-baseline', 'Speakable is present where route contract expects it', !routeInfo.expectSpeakable || inventory.hasSpeakable, { expected: routeInfo.expectSpeakable, actual: inventory.hasSpeakable }, 'P1');
    addCheck(checks, `${prefix}-11`, 'route-baseline', 'No duplicate DOM IDs', inventory.duplicateIds.length === 0, inventory.duplicateIds, 'P1');
    addCheck(checks, `${prefix}-12`, 'route-baseline', 'No hidden controls remain keyboard focusable', inventory.hiddenFocusable.length === 0, inventory.hiddenFocusable.slice(0, 30), 'P1');
    addCheck(checks, `${prefix}-13`, 'route-baseline', 'Explicit reader policy markers exist in rendered article', inventory.explicitProjectionMarkers > 0, inventory.explicitProjectionMarkers, 'P1');
    addCheck(checks, `${prefix}-14`, 'route-baseline', 'A shared ReaderProjection API is exposed', inventory.hasProjectionApi, inventory.hasProjectionApi, 'P1');
    const popupTruth = inventory.playPopupClaims.filter((item) => item.visible).every((item) => item.haspopup !== 'true' || Boolean(item.controls));
    addCheck(checks, `${prefix}-15`, 'popup-semantics', 'Visible Play popup claims name a controlled popup', popupTruth, inventory.playPopupClaims, 'P1');

    const play = page.locator('[data-fc-action="play"]:visible').first();
    const beforeSpeaks = await page.evaluate(() => window.__readerAuditSpeech.speaks);
    if (await play.count()) {
      await play.click({ timeout: 5000 });
      await page.waitForTimeout(120);
    }
    const speech = await page.evaluate(() => ({ ...window.__readerAuditSpeech, phase: window.GBReaderTTS?.getState?.().phase || null }));
    addCheck(checks, `${prefix}-16`, 'tts-owner', 'One Play click starts exactly one speech owner', speech.speaks - beforeSpeaks === 1, speech, 'P1');
    addCheck(checks, `${prefix}-17`, 'tts-owner', 'Speech projection emits non-empty text', speech.lastText.length > 1, { length: speech.lastText.length, sample: speech.lastText.slice(0, 80) }, 'P1');

    if (viewport.mobile && (routeInfo.id === 'herm' || routeInfo.id === 'gill')) await auditSpeedSlot(page, routeInfo.id, checks);
    if (viewport.mobile) await auditSave(page, routeInfo.id, checks);

    const findings = checks.filter((item) => !item.pass);
    if (findings.length) {
      const screenshot = path.join(REPORTS, `reader-controls-${caseId}.png`);
      await page.screenshot({ path: screenshot, fullPage: false }).catch(() => {});
    }
    return { caseId, route: routeInfo.route, viewport, inventory, consoleErrors, pageErrors, checks };
  } catch (error) {
    addCheck(checks, `RC-BROWSER-${routeInfo.id.toUpperCase()}-${viewport.mobile ? 'M' : 'D'}-HARNESS`, 'harness', 'Route audit completed without harness error', false, error.message, 'P1');
    return { caseId, route: routeInfo.route, viewport, consoleErrors, pageErrors, error: error.message, checks };
  } finally {
    await context.close();
  }
}

const { server, origin } = await startServer();
const browser = await chromium.launch({ headless: true });
try {
  const cases = [];
  for (const viewport of VIEWPORTS) {
    for (const route of ROUTES) cases.push(await auditRoute(browser, origin, route, viewport));
  }
  const checks = cases.flatMap((item) => item.checks);
  assert.ok(checks.length >= 100, `browser audit must execute at least 100 named checks, got ${checks.length}`);
  assert.equal(new Set(checks.map((item) => item.id)).size, checks.length, 'browser check IDs must be unique');
  const summary = {
    auditedAt: new Date().toISOString(),
    sha: process.env.GITHUB_SHA || null,
    routes: ROUTES.length,
    viewports: VIEWPORTS.length,
    cases: cases.length,
    checkCount: checks.length,
    pass: checks.filter((item) => item.pass).length,
    findings: checks.filter((item) => !item.pass).length,
    harnessErrors: cases.filter((item) => item.error).length,
  };
  fs.writeFileSync(path.join(REPORTS, 'reader-controls-browser-audit.json'), JSON.stringify({ summary, cases }, null, 2));
  const md = [
    '# Reader controls production-like browser audit', '',
    `- Cases: **${summary.cases}**`, `- Checks: **${summary.checkCount}**`, `- Pass: **${summary.pass}**`, `- Findings: **${summary.findings}**`, `- Harness errors: **${summary.harnessErrors}**`, '',
    '| Case | Checks | Pass | Findings | Console errors | Page errors |', '|---|---:|---:|---:|---:|---:|',
    ...cases.map((item) => `| ${item.caseId} | ${item.checks.length} | ${item.checks.filter((c) => c.pass).length} | ${item.checks.filter((c) => !c.pass).length} | ${item.consoleErrors.length} | ${item.pageErrors.length} |`),
    '', '## Findings', '',
    ...checks.filter((item) => !item.pass).map((item) => `- **${item.id}** (${item.severity}, ${item.area}) — ${item.description}; evidence: \`${JSON.stringify(item.evidence).slice(0, 600)}\``),
    '', '> Product findings are diagnostic in this audit-only lane. Harness integrity, route loading and the 100-check floor are blocking.',
  ];
  fs.writeFileSync(path.join(REPORTS, 'reader-controls-browser-audit.md'), md.join('\n'));
  for (const item of checks) console.log(`[READER-CONTROLS-BROWSER] ${item.pass ? 'PASS' : 'FINDING'} ${item.id} :: ${item.description}`);
  console.log('[READER-CONTROLS-BROWSER-SUMMARY]', JSON.stringify(summary));
  console.log('Reader controls production-like browser audit: PASS (diagnostic findings recorded, harness integrity enforced).');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
