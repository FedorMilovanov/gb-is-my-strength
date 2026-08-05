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
const SLOT_CONFIG = {
  herm: { rail: '.hm-speedrail', alternate: '.hm-slot-search', badge: '.hm-spdbadge', radio: '.hm-spd' },
  gill: { rail: '.mobile-speedrail', alternate: '.mobile-learning-trigger', badge: '.mobile-spdbadge', radio: '.mobile-speed' },
};
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
      res.writeHead(200, { 'content-type': MIME[path.extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(target).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

function add(checks, id, area, description, pass, evidence, severity = 'P2') {
  checks.push({ id, area, description, pass: Boolean(pass), evidence, severity });
}

async function installFixture(context) {
  await context.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem('gbx-vosk-warmup', 'off');
      localStorage.setItem('gb:audio:rate', '1');
    } catch {}
    window.__readerSequencedSpeech = { speaks: 0, cancels: 0, lastText: '' };
    function FakeUtterance(text) {
      this.text = String(text || ''); this.rate = 1; this.lang = 'ru-RU';
      this.onboundary = null; this.onend = null; this.onerror = null;
    }
    const speech = {
      getVoices: () => [{ name: 'Fixture Russian', lang: 'ru-RU', localService: true }],
      speak: (utterance) => {
        window.__readerSequencedSpeech.speaks += 1;
        window.__readerSequencedSpeech.lastText = utterance.text;
        window.__readerSequencedSpeech.active = utterance;
      },
      cancel: () => {
        window.__readerSequencedSpeech.cancels += 1;
        window.__readerSequencedSpeech.active = null;
      },
      pause: () => {}, resume: () => {}, addEventListener: () => {}, removeEventListener: () => {},
    };
    try { Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance }); }
    catch { window.SpeechSynthesisUtterance = FakeUtterance; }
    try { Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: speech }); }
    catch { window.speechSynthesis = speech; }
  });
}

async function inventory(page) {
  return page.evaluate(() => {
    const isVisible = (node) => {
      const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01 && rect.width > 0 && rect.height > 0;
    };
    const ids = Array.from(document.querySelectorAll('[id]')).map((node) => node.id).filter(Boolean);
    const duplicateIds = Array.from(new Set(ids.filter((id, index) => ids.indexOf(id) !== index)));
    const plays = Array.from(document.querySelectorAll('[data-fc-action="play"]'));
    const saves = Array.from(document.querySelectorAll('[data-fc-action="save"], .gb-save'));
    const jsonLd = []; const jsonErrors = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((node, index) => {
      try { jsonLd.push(JSON.parse(node.textContent || '{}')); }
      catch (error) { jsonErrors.push({ index, error: error.message }); }
    });
    const explicitAriaHiddenTabStops = Array.from(document.querySelectorAll('[aria-hidden="true"] button,[aria-hidden="true"] a[href],[aria-hidden="true"] input,[aria-hidden="true"] [tabindex]'))
      .filter((node) => node.tabIndex >= 0 && !node.disabled)
      .map((node) => ({ tag: node.tagName, id: node.id, className: node.className, tabIndex: node.tabIndex }));
    return {
      title: document.title,
      hasTtsApi: Boolean(window.GBReaderTTS),
      ttsVersion: window.GBReaderTTS?.version || null,
      hasProjectionApi: Boolean(window.ReaderProjection || window.GBReaderProjection),
      playCount: plays.length,
      visiblePlayCount: plays.filter(isVisible).length,
      visiblePlayClaims: plays.filter(isVisible).map((node) => ({
        haspopup: node.getAttribute('aria-haspopup'),
        expanded: node.getAttribute('aria-expanded'),
        controls: node.getAttribute('aria-controls'),
        controlledExists: Boolean(node.getAttribute('aria-controls') && document.getElementById(node.getAttribute('aria-controls'))),
      })),
      saveCount: saves.length,
      saveSemantics: saves.every((node) => node.hasAttribute('aria-pressed') && node.hasAttribute('aria-label')),
      legacyOverlay: Boolean(document.querySelector('.gbx-tts')),
      jsonLdCount: jsonLd.length,
      jsonErrors,
      hasArticleSchema: /Article/.test(JSON.stringify(jsonLd)),
      hasSpeakable: /SpeakableSpecification/.test(JSON.stringify(jsonLd)),
      duplicateIds,
      explicitAriaHiddenTabStops,
      projectionMarkers: document.querySelectorAll('[data-reader-include],[data-reader-exclude],[data-reader-section],[data-reader-summary],[data-reader-note-policy],[data-search-policy],[data-speakable-policy]').length,
    };
  });
}

async function slotSnapshot(page, cfg) {
  return page.evaluate((config) => {
    const rail = document.querySelector(config.rail);
    const alternate = document.querySelector(config.alternate);
    const badge = document.querySelector(config.badge);
    const radios = Array.from(document.querySelectorAll(config.radio));
    const snap = (node) => {
      if (!node) return null;
      const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
      return {
        visible: style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01 && rect.width > 0 && rect.height > 0,
        ariaHidden: node.getAttribute('aria-hidden'),
        inert: Boolean(node.inert || node.hasAttribute('inert')),
        tabIndex: node.tabIndex,
      };
    };
    return {
      rail: snap(rail), alternate: snap(alternate), badge: snap(badge),
      badgeControls: badge?.getAttribute('aria-controls') || null,
      badgeExpanded: badge?.getAttribute('aria-expanded') || null,
      radioCount: radios.length,
      radioTabIndices: radios.map((node) => node.tabIndex),
      radioTabStops: radios.filter((node) => node.tabIndex === 0).length,
      checkedIndices: radios.map((node, index) => node.getAttribute('aria-checked') === 'true' ? index : -1).filter((index) => index >= 0),
      focusedIndex: radios.findIndex((node) => node === document.activeElement),
      focusInsideRail: Boolean(rail && rail.contains(document.activeElement)),
      focusOnBadge: document.activeElement === badge,
    };
  }, cfg);
}

async function ensureSlotClosed(page, cfg) {
  let snap = await slotSnapshot(page, cfg);
  if (snap.rail?.visible) {
    const badge = page.locator(cfg.badge).first();
    if (await badge.count()) { await badge.click(); await page.waitForTimeout(100); }
    snap = await slotSnapshot(page, cfg);
  }
  return snap;
}

async function ensureSlotOpen(page, cfg) {
  let snap = await slotSnapshot(page, cfg);
  if (!snap.rail?.visible) {
    const badge = page.locator(cfg.badge).first();
    if (await badge.count()) { await badge.click(); await page.waitForTimeout(100); }
    snap = await slotSnapshot(page, cfg);
  }
  return snap;
}

async function auditSlot(page, routeId, checks) {
  const cfg = SLOT_CONFIG[routeId];
  if (!cfg) return;
  const prefix = `RC-SEQ-${routeId.toUpperCase()}-SLOT`;

  const natural = await slotSnapshot(page, cfg);
  add(checks, `${prefix}-01`, `${routeId}-slot`, 'Speed rail, badge and radios exist', Boolean(natural.rail && natural.badge && natural.radioCount >= 5), natural);
  add(checks, `${prefix}-02`, `${routeId}-slot`, 'Natural initial rail is visually closed before PLAY', natural.rail && !natural.rail.visible, natural, 'P1');
  add(checks, `${prefix}-03`, `${routeId}-slot`, 'Natural initial rail is aria-hidden or inert', natural.rail && (natural.rail.ariaHidden === 'true' || natural.rail.inert), natural, 'P1');
  add(checks, `${prefix}-04`, `${routeId}-slot`, 'Natural initial radios have zero Tab stops', natural.radioTabStops === 0, natural, 'P1');
  add(checks, `${prefix}-05`, `${routeId}-slot`, 'Exactly one natural radio is checked', natural.checkedIndices.length === 1, natural);
  add(checks, `${prefix}-06`, `${routeId}-slot`, 'Badge owns rail with aria-controls', Boolean(natural.badgeControls && document !== null), natural, 'P2');
  add(checks, `${prefix}-07`, `${routeId}-slot`, 'Badge exposes closed aria-expanded', natural.badgeExpanded === 'false', natural, 'P2');

  const closed = await ensureSlotClosed(page, cfg);
  add(checks, `${prefix}-08`, `${routeId}-slot`, 'Forced closed rail is visually closed', closed.rail && !closed.rail.visible, closed, 'P1');
  add(checks, `${prefix}-09`, `${routeId}-slot`, 'Forced closed rail is aria-hidden or inert', closed.rail && (closed.rail.ariaHidden === 'true' || closed.rail.inert), closed, 'P1');
  add(checks, `${prefix}-10`, `${routeId}-slot`, 'Forced closed radios have zero Tab stops', closed.radioTabStops === 0, closed, 'P1');

  const opened = await ensureSlotOpen(page, cfg);
  add(checks, `${prefix}-11`, `${routeId}-slot`, 'Badge opens rail visibly', opened.rail?.visible, opened, 'P1');
  add(checks, `${prefix}-12`, `${routeId}-slot`, 'Opened rail is not aria-hidden/inert', opened.rail && opened.rail.ariaHidden !== 'true' && !opened.rail.inert, opened, 'P1');
  add(checks, `${prefix}-13`, `${routeId}-slot`, 'Opened alternate layer leaves accessibility tree', opened.alternate && (opened.alternate.ariaHidden === 'true' || opened.alternate.inert || opened.alternate.tabIndex < 0), opened, 'P1');
  add(checks, `${prefix}-14`, `${routeId}-slot`, 'Opened radiogroup has one roving Tab stop', opened.radioTabStops === 1, opened, 'P1');
  add(checks, `${prefix}-15`, `${routeId}-slot`, 'Badge exposes open aria-expanded', opened.badgeExpanded === 'true', opened, 'P2');

  const checked = page.locator(`${cfg.radio}[aria-checked="true"]`).first();
  if (await checked.count()) await checked.focus();
  const beforeArrow = await slotSnapshot(page, cfg);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(60);
  const afterArrow = await slotSnapshot(page, cfg);
  add(checks, `${prefix}-16`, `${routeId}-slot`, 'ArrowRight moves focus to another radio', afterArrow.focusedIndex >= 0 && afterArrow.focusedIndex !== beforeArrow.focusedIndex, { beforeArrow, afterArrow }, 'P1');
  add(checks, `${prefix}-17`, `${routeId}-slot`, 'ArrowRight keeps rail open for continued navigation', afterArrow.rail?.visible, afterArrow, 'P1');
  add(checks, `${prefix}-18`, `${routeId}-slot`, 'ArrowRight keeps one roving Tab stop', afterArrow.radioTabStops === 1, afterArrow, 'P1');

  await ensureSlotOpen(page, cfg);
  const current = page.locator(`${cfg.radio}[aria-checked="true"]`).first();
  if (await current.count()) await current.focus();
  await page.keyboard.press('End'); await page.waitForTimeout(50);
  const afterEnd = await slotSnapshot(page, cfg);
  add(checks, `${prefix}-19`, `${routeId}-slot`, 'End moves focus to final radio', afterEnd.focusedIndex === afterEnd.radioCount - 1, afterEnd, 'P2');

  await ensureSlotOpen(page, cfg);
  const endRadio = page.locator(cfg.radio).last();
  if (await endRadio.count()) await endRadio.focus();
  await page.keyboard.press('Home'); await page.waitForTimeout(50);
  const afterHome = await slotSnapshot(page, cfg);
  add(checks, `${prefix}-20`, `${routeId}-slot`, 'Home moves focus to first radio', afterHome.focusedIndex === 0, afterHome, 'P2');

  await ensureSlotOpen(page, cfg);
  const focused = page.locator(cfg.radio).first();
  if (await focused.count()) await focused.focus();
  await page.keyboard.press('Enter'); await page.waitForTimeout(100);
  const afterEnter = await slotSnapshot(page, cfg);
  add(checks, `${prefix}-21`, `${routeId}-slot`, 'Enter activates focused radio', afterEnter.checkedIndices.includes(0), afterEnter, 'P1');
  add(checks, `${prefix}-22`, `${routeId}-slot`, 'Auto-close does not strand focus in hidden rail', !afterEnter.focusInsideRail || afterEnter.rail?.visible, afterEnter, 'P1');

  const finalClosed = await ensureSlotClosed(page, cfg);
  add(checks, `${prefix}-23`, `${routeId}-slot`, 'Final rail closes visibly', finalClosed.rail && !finalClosed.rail.visible, finalClosed, 'P1');
  add(checks, `${prefix}-24`, `${routeId}-slot`, 'Final closed rail is aria-hidden or inert', finalClosed.rail && (finalClosed.rail.ariaHidden === 'true' || finalClosed.rail.inert), finalClosed, 'P1');
  add(checks, `${prefix}-25`, `${routeId}-slot`, 'Final closed radios have zero Tab stops', finalClosed.radioTabStops === 0, finalClosed, 'P1');
}

async function auditSave(page, routeId, checks) {
  const prefix = `RC-SEQ-${routeId.toUpperCase()}-SAVE`;
  const visibleSave = page.locator('[data-fc-action="save"]:visible, .gb-save:visible').first();
  const before = await page.evaluate(() => ({
    count: document.querySelectorAll('.gb-save').length,
    pressed: Array.from(document.querySelectorAll('.gb-save')).map((node) => node.getAttribute('aria-pressed')),
  }));
  add(checks, `${prefix}-01`, `${routeId}-save`, 'At least one save surface exists', before.count > 0, before);
  if (await visibleSave.count()) { await visibleSave.click(); await page.waitForTimeout(80); }
  const state = await page.evaluate(() => {
    let stored = null; let parseError = null;
    try { stored = JSON.parse(localStorage.getItem('gb-favorites') || '[]'); }
    catch (error) { parseError = error.message; }
    const saves = Array.from(document.querySelectorAll('.gb-save'));
    return {
      stored, parseError,
      pressed: saves.map((node) => node.getAttribute('aria-pressed')),
      labels: saves.map((node) => node.getAttribute('aria-label')),
      classes: saves.map((node) => node.classList.contains('is-saved')),
      canonicalApi: Boolean(window.GBFavorites || window.GBFavoriteStore || window.FavoriteStore),
      pageMetadata: window.SITE_CONFIG?.page || null,
    };
  });
  const entry = Array.isArray(state.stored) ? state.stored[0] : null;
  add(checks, `${prefix}-02`, `${routeId}-save`, 'All save surfaces synchronize aria-pressed', state.pressed.length > 0 && state.pressed.every((value) => value === 'true'), state, 'P1');
  add(checks, `${prefix}-03`, `${routeId}-save`, 'All save surfaces synchronize saved class', state.classes.length > 0 && state.classes.every(Boolean), state);
  add(checks, `${prefix}-04`, `${routeId}-save`, 'All save surfaces synchronize accessible label', state.labels.length > 0 && state.labels.every((value) => /убрать|сохранен|избран/i.test(value || '')), state);
  add(checks, `${prefix}-05`, `${routeId}-save`, 'Favorite storage is valid JSON array', !state.parseError && Array.isArray(state.stored), state.parseError || 'valid', 'P1');
  add(checks, `${prefix}-06`, `${routeId}-save`, 'Favorite stores normalized route path', typeof entry?.path === 'string' && entry.path.startsWith('/'), entry);
  add(checks, `${prefix}-07`, `${routeId}-save`, 'Favorite stores a title', typeof entry?.title === 'string' && entry.title.length > 2, entry);
  add(checks, `${prefix}-08`, `${routeId}-save`, 'Favorite stores canonical category/content type', Boolean(entry?.category || entry?.contentType || entry?.type), entry, 'P1');
  add(checks, `${prefix}-09`, `${routeId}-save`, 'Favorite payload declares schema version', Number.isFinite(entry?.schemaVersion) || Number.isFinite(entry?.version), entry, 'P2');
  add(checks, `${prefix}-10`, `${routeId}-save`, 'Canonical favorite store API is exposed', state.canonicalApi, state, 'P1');
}

async function auditCase(browser, origin, routeInfo, viewport) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.mobile, hasTouch: viewport.mobile });
  await installFixture(context);
  const page = await context.newPage();
  const checks = []; const consoleErrors = []; const pageErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message || String(error)));
  const caseId = `${routeInfo.id}-${viewport.id}`;
  try {
    const response = await page.goto(origin + routeInfo.route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(350);
    const base = await inventory(page);
    const prefix = `RC-SEQ-${routeInfo.id.toUpperCase()}-${viewport.mobile ? 'M' : 'D'}`;
    add(checks, `${prefix}-01`, 'route-baseline', 'Route returns successful document', Boolean(response && response.status() < 400), response?.status(), 'P1');
    add(checks, `${prefix}-02`, 'route-baseline', 'No uncaught page errors', pageErrors.length === 0, pageErrors, 'P1');
    add(checks, `${prefix}-03`, 'route-baseline', 'Canonical GBReaderTTS API is ready', base.hasTtsApi && Number(base.ttsVersion) >= 2, base, 'P1');
    add(checks, `${prefix}-04`, 'route-baseline', 'No legacy public TTS overlay is rendered', !base.legacyOverlay, base.legacyOverlay, 'P1');
    add(checks, `${prefix}-05`, 'route-baseline', 'At least one Play owner renders', base.playCount > 0, base.playCount, 'P1');
    add(checks, `${prefix}-06`, 'route-baseline', 'Exactly one Play owner is visible', base.visiblePlayCount === 1, base.visiblePlayCount, 'P1');
    add(checks, `${prefix}-07`, 'route-baseline', 'Save surfaces expose pressed and label semantics', base.saveCount > 0 && base.saveSemantics, base, 'P2');
    add(checks, `${prefix}-08`, 'route-baseline', 'JSON-LD parses without error', base.jsonLdCount > 0 && base.jsonErrors.length === 0, base.jsonErrors, 'P1');
    add(checks, `${prefix}-09`, 'route-baseline', 'Article JSON-LD exists', base.hasArticleSchema, base.jsonLdCount);
    add(checks, `${prefix}-10`, 'route-baseline', 'Speakable exists where route contract requires it', !routeInfo.expectSpeakable || base.hasSpeakable, { expected: routeInfo.expectSpeakable, actual: base.hasSpeakable }, 'P1');
    add(checks, `${prefix}-11`, 'route-baseline', 'No duplicate DOM IDs', base.duplicateIds.length === 0, base.duplicateIds, 'P1');
    add(checks, `${prefix}-12`, 'route-baseline', 'Explicit aria-hidden subtrees do not retain Tab stops', base.explicitAriaHiddenTabStops.length === 0, base.explicitAriaHiddenTabStops.slice(0, 30), 'P1');
    add(checks, `${prefix}-13`, 'projection', 'Rendered article has explicit reader policy markers', base.projectionMarkers > 0, base.projectionMarkers, 'P1');
    add(checks, `${prefix}-14`, 'projection', 'Shared ReaderProjection API is exposed', base.hasProjectionApi, base.hasProjectionApi, 'P1');
    const popupTruth = base.visiblePlayClaims.every((claim) => claim.haspopup !== 'true' || (claim.controls && claim.controlledExists));
    add(checks, `${prefix}-15`, 'popup-semantics', 'Visible Play popup claim controls a real element', popupTruth, base.visiblePlayClaims, 'P1');

    if (viewport.mobile && SLOT_CONFIG[routeInfo.id]) await auditSlot(page, routeInfo.id, checks);

    const beforeSpeech = await page.evaluate(() => window.__readerSequencedSpeech.speaks);
    const play = page.locator('[data-fc-action="play"]:visible').first();
    if (await play.count()) { await play.click(); await page.waitForTimeout(120); }
    const speech = await page.evaluate(() => ({ ...window.__readerSequencedSpeech, phase: window.GBReaderTTS?.getState?.().phase || null }));
    add(checks, `${prefix}-16`, 'tts-owner', 'One Play click starts exactly one speech owner', speech.speaks - beforeSpeech === 1, speech, 'P1');
    add(checks, `${prefix}-17`, 'tts-owner', 'Speech projection emits non-empty text', speech.lastText.length > 1, { length: speech.lastText.length, sample: speech.lastText.slice(0, 100) }, 'P1');

    if (viewport.mobile) await auditSave(page, routeInfo.id, checks);
    if (checks.some((item) => !item.pass)) await page.screenshot({ path: path.join(REPORTS, `reader-controls-sequenced-${caseId}.png`), fullPage: false }).catch(() => {});
    return { caseId, route: routeInfo.route, viewport, base, consoleErrors, pageErrors, checks };
  } catch (error) {
    add(checks, `RC-SEQ-${routeInfo.id.toUpperCase()}-${viewport.mobile ? 'M' : 'D'}-HARNESS`, 'harness', 'Case completed without harness error', false, error.message, 'P1');
    return { caseId, route: routeInfo.route, viewport, consoleErrors, pageErrors, error: error.message, checks };
  } finally {
    await context.close();
  }
}

const { server, origin } = await startServer();
const browser = await chromium.launch({ headless: true });
try {
  const cases = [];
  for (const viewport of VIEWPORTS) for (const route of ROUTES) cases.push(await auditCase(browser, origin, route, viewport));
  const checks = cases.flatMap((item) => item.checks);
  assert.ok(checks.length >= 120, `sequenced browser audit must execute at least 120 checks, got ${checks.length}`);
  assert.equal(new Set(checks.map((item) => item.id)).size, checks.length, 'sequenced check IDs must be unique');
  const summary = {
    auditedAt: new Date().toISOString(), sha: process.env.GITHUB_SHA || null,
    routes: ROUTES.length, viewports: VIEWPORTS.length, cases: cases.length,
    checkCount: checks.length, pass: checks.filter((item) => item.pass).length,
    findings: checks.filter((item) => !item.pass).length,
    harnessErrors: cases.filter((item) => item.error).length,
  };
  fs.writeFileSync(path.join(REPORTS, 'reader-controls-browser-sequenced-audit.json'), JSON.stringify({ summary, cases }, null, 2));
  const md = [
    '# Reader controls sequenced production-like audit', '',
    `- Cases: **${summary.cases}**`, `- Checks: **${summary.checkCount}**`, `- Pass: **${summary.pass}**`,
    `- Findings: **${summary.findings}**`, `- Harness errors: **${summary.harnessErrors}**`, '',
    '| Case | Checks | Pass | Findings | Console errors | Page errors |', '|---|---:|---:|---:|---:|---:|',
    ...cases.map((item) => `| ${item.caseId} | ${item.checks.length} | ${item.checks.filter((c) => c.pass).length} | ${item.checks.filter((c) => !c.pass).length} | ${item.consoleErrors.length} | ${item.pageErrors.length} |`),
    '', '## Findings', '',
    ...checks.filter((item) => !item.pass).map((item) => `- **${item.id}** (${item.severity}, ${item.area}) — ${item.description}; evidence: \`${JSON.stringify(item.evidence).slice(0, 800)}\``),
    '', '> This sequenced pass is authoritative for slot state. It audits speed/search before PLAY and explicitly normalizes every open/close transition.',
  ];
  fs.writeFileSync(path.join(REPORTS, 'reader-controls-browser-sequenced-audit.md'), md.join('\n'));
  for (const item of checks) console.log(`[READER-CONTROLS-SEQUENCED] ${item.pass ? 'PASS' : 'FINDING'} ${item.id} :: ${item.description}`);
  console.log('[READER-CONTROLS-SEQUENCED-SUMMARY]', JSON.stringify(summary));
  console.log('Reader controls sequenced production-like audit: PASS (diagnostic findings recorded).');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
