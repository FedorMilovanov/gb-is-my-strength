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

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };
const ROUTES = [
  {
    id: 'herm',
    route: '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/',
    slot: { root: '.hmtop', rail: '.hm-speedrail', badge: '.hm-spdbadge', alternate: '.hm-slot-search', chip: '.hm-spd' },
    mobileSurfaces: [
      { id: 'toc', trigger: '#hmSectionBtn', target: '#hmSheet', popup: 'dialog' },
      { id: 'settings', trigger: '#hmSettingsBtn', target: '#hmSettings', popup: 'dialog' },
    ],
    desktopSurfaces: [
      { id: 'settings', trigger: '#hrailSettingsBtn', target: '#hmSettings', popup: 'dialog' },
    ],
  },
  {
    id: 'gill',
    route: '/articles/dzhon-gill-chast-1-chelovek/',
    slot: { root: '[data-fc-speed-mode="inline"]', rail: '.mobile-speedrail', badge: '.mobile-spdbadge', alternate: '.mobile-learning-trigger', chip: '.mobile-speed' },
    mobileSurfaces: [
      { id: 'part-toc', trigger: '#mobPartTocBtn', target: '#partTocOverlay', popup: 'dialog' },
      { id: 'settings', trigger: '#mobSettingsBtn', target: '#gillSettingsOverlay', popup: 'dialog' },
      { id: 'learning', trigger: '#mobLearningBtn', target: '#gillLearningOverlay', popup: 'dialog' },
    ],
    desktopSurfaces: [
      { id: 'settings', trigger: '[data-gill-settings-open]:visible', target: '#gillSettingsOverlay', popup: 'dialog' },
    ],
  },
  { id: 'antisovetov', route: '/articles/20-antisovetov-pastoru/' },
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
      res.writeHead(200, { 'content-type': MIME[path.extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(target).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

function record(checks, id, description, pass, evidence = null) {
  checks.push({ id, description, pass: Boolean(pass), evidence });
}

async function installSpeechFixture(context) {
  await context.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem('gbx-vosk-warmup', 'off');
      localStorage.setItem('gb:audio:rate', '1');
    } catch {}
    window.__controlsA11ySpeech = { speaks: 0, cancels: 0, lastText: '' };
    function FakeUtterance(text) {
      this.text = String(text || ''); this.rate = 1; this.lang = 'ru-RU';
      this.onboundary = null; this.onend = null; this.onerror = null;
    }
    const speech = {
      getVoices: () => [{ name: 'Fixture Russian', lang: 'ru-RU', localService: true }],
      speak: (utterance) => {
        window.__controlsA11ySpeech.speaks += 1;
        window.__controlsA11ySpeech.lastText = utterance.text;
        window.__controlsA11ySpeech.active = utterance;
      },
      cancel: () => {
        window.__controlsA11ySpeech.cancels += 1;
        window.__controlsA11ySpeech.active = null;
      },
      pause: () => {}, resume: () => {}, addEventListener: () => {}, removeEventListener: () => {},
    };
    try { Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance }); }
    catch { window.SpeechSynthesisUtterance = FakeUtterance; }
    try { Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: speech }); }
    catch { window.speechSynthesis = speech; }
  });
}

async function slotSnapshot(page, selectors) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel.root);
    const rail = document.querySelector(sel.rail);
    const badge = document.querySelector(sel.badge);
    const alternate = document.querySelector(sel.alternate);
    const chips = Array.from(document.querySelectorAll(sel.chip));
    const visible = (node) => {
      if (!node) return false;
      const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01 && rect.width > 0 && rect.height > 0;
    };
    return {
      rootExists: Boolean(root), railExists: Boolean(rail), badgeExists: Boolean(badge), alternateExists: Boolean(alternate),
      railVisible: visible(rail), railAriaHidden: rail?.getAttribute('aria-hidden') || null,
      railInert: Boolean(rail?.inert || rail?.hasAttribute('inert')),
      alternateAriaHidden: alternate?.getAttribute('aria-hidden') || null,
      alternateInert: Boolean(alternate?.inert || alternate?.hasAttribute('inert')),
      badgeControls: badge?.getAttribute('aria-controls') || null,
      badgeExpanded: badge?.getAttribute('aria-expanded') || null,
      controlledExists: Boolean(badge?.getAttribute('aria-controls') && document.getElementById(badge.getAttribute('aria-controls'))),
      chipCount: chips.length,
      tabIndices: chips.map((chip) => chip.tabIndex),
      tabStops: chips.filter((chip) => chip.tabIndex === 0).length,
      checked: chips.map((chip, index) => chip.getAttribute('aria-checked') === 'true' ? index : -1).filter((index) => index >= 0),
      focused: chips.findIndex((chip) => chip === document.activeElement),
      focusOnBadge: document.activeElement === badge,
      focusInsideRail: Boolean(rail && rail.contains(document.activeElement)),
      rate: (() => { try { return localStorage.getItem('gb:audio:rate'); } catch { return null; } })(),
    };
  }, selectors);
}

async function auditSlot(page, routeId, selectors, checks) {
  const prefix = `${routeId}-slot`;
  await page.waitForFunction(() => Number(window.GBReaderControlsA11y?.version) >= 2, null, { timeout: 10000 });
  await page.evaluate(() => window.GBReaderControlsA11y.refresh());
  await page.waitForTimeout(80);

  const closed = await slotSnapshot(page, selectors);
  record(checks, `${prefix}-01`, 'slot owners exist', closed.rootExists && closed.railExists && closed.badgeExists && closed.alternateExists, closed);
  record(checks, `${prefix}-02`, 'closed rail is aria-hidden', closed.railAriaHidden === 'true', closed);
  record(checks, `${prefix}-03`, 'closed rail is inert', closed.railInert, closed);
  record(checks, `${prefix}-04`, 'closed rail has zero Tab stops', closed.tabStops === 0, closed);
  record(checks, `${prefix}-05`, 'exactly one radio remains selected', closed.checked.length === 1, closed);
  record(checks, `${prefix}-06`, 'badge owns existing rail', Boolean(closed.badgeControls && closed.controlledExists), closed);
  record(checks, `${prefix}-07`, 'badge reports collapsed state', closed.badgeExpanded === 'false', closed);
  record(checks, `${prefix}-08`, 'alternate layer is exposed while closed', closed.alternateAriaHidden !== 'true' && !closed.alternateInert, closed);

  await page.locator(selectors.badge).click();
  await page.waitForTimeout(120);
  const opened = await slotSnapshot(page, selectors);
  record(checks, `${prefix}-09`, 'badge opens rail', opened.railVisible, opened);
  record(checks, `${prefix}-10`, 'open rail is exposed to AT', opened.railAriaHidden === 'false' && !opened.railInert, opened);
  record(checks, `${prefix}-11`, 'open rail has one roving Tab stop', opened.tabStops === 1, opened);
  record(checks, `${prefix}-12`, 'badge reports expanded state', opened.badgeExpanded === 'true', opened);
  record(checks, `${prefix}-13`, 'alternate layer is hidden and inert while open', opened.alternateAriaHidden === 'true' && opened.alternateInert, opened);

  const selected = page.locator(`${selectors.chip}[aria-checked="true"]`).first();
  await selected.focus();
  const before = await slotSnapshot(page, selectors);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(80);
  const arrow = await slotSnapshot(page, selectors);
  record(checks, `${prefix}-14`, 'ArrowRight moves focus', arrow.focused >= 0 && arrow.focused !== before.focused, { before, arrow });
  record(checks, `${prefix}-15`, 'ArrowRight changes selected rate', arrow.checked.length === 1 && arrow.checked[0] === arrow.focused, arrow);
  record(checks, `${prefix}-16`, 'ArrowRight preserves one Tab stop', arrow.tabStops === 1, arrow);
  record(checks, `${prefix}-17`, 'ArrowRight keeps rail open', arrow.railAriaHidden === 'false', arrow);
  record(checks, `${prefix}-18`, 'ArrowRight persists audio rate', arrow.rate !== before.rate, { before: before.rate, after: arrow.rate });

  await page.keyboard.press('End');
  await page.waitForTimeout(50);
  const end = await slotSnapshot(page, selectors);
  record(checks, `${prefix}-19`, 'End moves to final radio', end.focused === end.chipCount - 1 && end.checked[0] === end.chipCount - 1, end);

  await page.keyboard.press('Home');
  await page.waitForTimeout(50);
  const home = await slotSnapshot(page, selectors);
  record(checks, `${prefix}-20`, 'Home moves to first radio', home.focused === 0 && home.checked[0] === 0, home);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(360);
  const afterEnter = await slotSnapshot(page, selectors);
  record(checks, `${prefix}-21`, 'Enter closes rail after activation', afterEnter.railAriaHidden === 'true' && !afterEnter.railVisible, afterEnter);
  record(checks, `${prefix}-22`, 'closed rail again has zero Tab stops', afterEnter.tabStops === 0, afterEnter);
  record(checks, `${prefix}-23`, 'focus returns to speed badge', afterEnter.focusOnBadge && !afterEnter.focusInsideRail, afterEnter);
  record(checks, `${prefix}-24`, 'alternate layer is restored', afterEnter.alternateAriaHidden !== 'true' && !afterEnter.alternateInert, afterEnter);
}

async function surfaceSnapshot(page, spec) {
  return page.evaluate(({ trigger, target }) => {
    const triggerNode = document.querySelector(trigger);
    const targetNode = document.querySelector(target);
    const targetId = targetNode?.id || '';
    const open = Boolean(targetNode) && (
      targetNode.getAttribute('aria-hidden') === 'false'
      || targetNode.classList.contains('is-open')
      || targetNode.classList.contains('open')
      || targetNode.classList.contains('active')
    );
    return {
      triggerExists: Boolean(triggerNode),
      targetExists: Boolean(targetNode),
      targetId,
      controls: triggerNode?.getAttribute('aria-controls') || null,
      expanded: triggerNode?.getAttribute('aria-expanded') || null,
      haspopup: triggerNode?.getAttribute('aria-haspopup') || null,
      controlledExists: Boolean(triggerNode?.getAttribute('aria-controls') && document.getElementById(triggerNode.getAttribute('aria-controls'))),
      open,
    };
  }, spec);
}

async function auditSurface(page, routeId, viewportId, spec, checks) {
  const prefix = `${routeId}-${viewportId}-surface-${spec.id}`;
  await page.evaluate(() => window.GBReaderControlsA11y.refresh());
  await page.waitForTimeout(80);
  const closed = await surfaceSnapshot(page, spec);
  record(checks, `${prefix}-01`, 'trigger and controlled surface exist', closed.triggerExists && closed.targetExists, closed);
  record(checks, `${prefix}-02`, 'trigger points to the exact surface', Boolean(closed.targetId && closed.controls === closed.targetId && closed.controlledExists), closed);
  record(checks, `${prefix}-03`, 'closed surface reports collapsed trigger state', !closed.open && closed.expanded === 'false', closed);
  if (spec.popup) record(checks, `${prefix}-04`, 'dialog trigger exposes popup semantics', closed.haspopup === spec.popup, closed);

  const trigger = page.locator(spec.trigger).first();
  await trigger.click();
  await page.waitForTimeout(160);
  const opened = await surfaceSnapshot(page, spec);
  record(checks, `${prefix}-05`, 'trigger opens its declared surface', opened.open, opened);
  record(checks, `${prefix}-06`, 'open surface reports expanded trigger state', opened.expanded === 'true', opened);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(160);
  const afterEscape = await surfaceSnapshot(page, spec);
  record(checks, `${prefix}-07`, 'Escape closes surface and restores collapsed state', !afterEscape.open && afterEscape.expanded === 'false', afterEscape);
}

async function auditMobile(browser, origin, routeInfo) {
  const context = await browser.newContext({ viewport: MOBILE, isMobile: true, hasTouch: true });
  await installSpeechFixture(context);
  const page = await context.newPage();
  const checks = []; const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message || String(error)));
  try {
    const response = await page.goto(origin + routeInfo.route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(400);
    record(checks, `${routeInfo.id}-mobile-01`, 'route loads', Boolean(response && response.status() < 400), response?.status());
    record(checks, `${routeInfo.id}-mobile-02`, 'no uncaught page errors', pageErrors.length === 0, pageErrors);
    const base = await page.evaluate(() => ({
      controlsApi: window.GBReaderControlsA11y?.version || null,
      ttsApi: window.GBReaderTTS?.version || null,
      visiblePlay: Array.from(document.querySelectorAll('[data-fc-action="play"]')).filter((node) => {
        const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      }).map((node) => ({ haspopup: node.getAttribute('aria-haspopup'), controls: node.getAttribute('aria-controls') })),
    }));
    record(checks, `${routeInfo.id}-mobile-03`, 'a11y controller API v2 is ready', Number(base.controlsApi) >= 2, base);
    record(checks, `${routeInfo.id}-mobile-04`, 'canonical TTS API remains ready', Number(base.ttsApi) >= 2, base);
    record(checks, `${routeInfo.id}-mobile-05`, 'exactly one Play is visible', base.visiblePlay.length === 1, base.visiblePlay);
    record(checks, `${routeInfo.id}-mobile-06`, 'mobile Play makes no false popup claim', base.visiblePlay.every((item) => item.haspopup !== 'true'), base.visiblePlay);

    if (routeInfo.slot) await auditSlot(page, routeInfo.id, routeInfo.slot, checks);
    for (const surface of routeInfo.mobileSurfaces || []) await auditSurface(page, routeInfo.id, 'mobile', surface, checks);

    const play = page.locator('[data-fc-action="play"]:visible').first();
    const before = await page.evaluate(() => window.__controlsA11ySpeech.speaks);
    await play.click();
    await page.waitForTimeout(150);
    const speech = await page.evaluate(() => ({ ...window.__controlsA11ySpeech, state: window.GBReaderTTS?.getState?.() || null }));
    record(checks, `${routeInfo.id}-mobile-07`, 'one Play click starts one speech owner', speech.speaks - before === 1, speech);
    record(checks, `${routeInfo.id}-mobile-08`, 'speech projection remains non-empty', speech.lastText.length > 1, { length: speech.lastText.length });
    record(checks, `${routeInfo.id}-mobile-09`, 'no page errors after interaction', pageErrors.length === 0, pageErrors);

    if (checks.some((item) => !item.pass)) await page.screenshot({ path: path.join(REPORTS, `reader-controls-a11y-${routeInfo.id}-mobile.png`), fullPage: false });
    return { caseId: `${routeInfo.id}-mobile`, checks, pageErrors };
  } finally {
    await context.close();
  }
}

async function auditDesktop(browser, origin, routeInfo) {
  const context = await browser.newContext({ viewport: DESKTOP });
  await installSpeechFixture(context);
  const page = await context.newPage();
  const checks = []; const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message || String(error)));
  try {
    const response = await page.goto(origin + routeInfo.route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(350);
    const state = await page.evaluate(() => {
      const visible = Array.from(document.querySelectorAll('[data-fc-action="play"]')).filter((node) => {
        const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      });
      return {
        controlsApi: window.GBReaderControlsA11y?.version || null,
        plays: visible.map((node) => {
          const controls = node.getAttribute('aria-controls');
          return { haspopup: node.getAttribute('aria-haspopup'), controls, target: Boolean(controls && document.getElementById(controls)) };
        }),
      };
    });
    record(checks, `${routeInfo.id}-desktop-01`, 'desktop route loads', Boolean(response && response.status() < 400), response?.status());
    record(checks, `${routeInfo.id}-desktop-02`, 'desktop controller API v2 is ready', Number(state.controlsApi) >= 2, state);
    record(checks, `${routeInfo.id}-desktop-03`, 'desktop has one visible Play', state.plays.length === 1, state.plays);
    record(checks, `${routeInfo.id}-desktop-04`, 'desktop popup claim remains truthful', state.plays.every((item) => item.haspopup !== 'true' || (item.controls && item.target)), state.plays);
    record(checks, `${routeInfo.id}-desktop-05`, 'desktop has no page errors', pageErrors.length === 0, pageErrors);
    for (const surface of routeInfo.desktopSurfaces || []) await auditSurface(page, routeInfo.id, 'desktop', surface, checks);
    return { caseId: `${routeInfo.id}-desktop`, checks, pageErrors };
  } finally {
    await context.close();
  }
}

const { server, origin } = await startServer();
const browser = await chromium.launch({ headless: true });
try {
  const cases = [];
  for (const route of ROUTES) cases.push(await auditMobile(browser, origin, route));
  for (const route of ROUTES.slice(0, 2)) cases.push(await auditDesktop(browser, origin, route));
  const checks = cases.flatMap((item) => item.checks);
  const failures = checks.filter((item) => !item.pass);
  const summary = {
    sha: process.env.GITHUB_SHA || null,
    cases: cases.length,
    checks: checks.length,
    pass: checks.length - failures.length,
    failures: failures.length,
  };
  assert.ok(checks.length >= 100, `expected at least 100 named checks, got ${checks.length}`);
  assert.equal(new Set(checks.map((item) => item.id)).size, checks.length, 'check IDs must be unique');
  fs.writeFileSync(path.join(REPORTS, 'reader-controls-a11y-browser-contract.json'), JSON.stringify({ summary, cases }, null, 2));
  const lines = [
    '# Reader controls accessibility browser contract', '',
    `- SHA: \`${summary.sha}\``, `- Cases: **${summary.cases}**`, `- Checks: **${summary.checks}**`,
    `- Pass: **${summary.pass}**`, `- Failures: **${summary.failures}**`, '',
    '| Case | Checks | Pass | Fail |', '|---|---:|---:|---:|',
    ...cases.map((item) => `| ${item.caseId} | ${item.checks.length} | ${item.checks.filter((check) => check.pass).length} | ${item.checks.filter((check) => !check.pass).length} |`),
    '', '## Failures', '',
    ...(failures.length ? failures.map((item) => `- **${item.id}** — ${item.description}; evidence: \`${JSON.stringify(item.evidence).slice(0, 700)}\``) : ['None.']),
  ];
  fs.writeFileSync(path.join(REPORTS, 'reader-controls-a11y-browser-contract.md'), lines.join('\n'));
  for (const item of checks) console.log(`[READER-CONTROLS-A11Y] ${item.pass ? 'PASS' : 'FAIL'} ${item.id} :: ${item.description}`);
  console.log('[READER-CONTROLS-A11Y-SUMMARY]', JSON.stringify(summary));
  assert.equal(failures.length, 0, `${failures.length} reader controls accessibility checks failed`);
  console.log('Reader controls accessibility browser contract: PASS.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
