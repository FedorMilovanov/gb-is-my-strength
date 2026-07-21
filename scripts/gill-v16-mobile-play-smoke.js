#!/usr/bin/env node
'use strict';

/**
 * Canonical Gill v16 mobile TOC + PlayEmber smoke.
 *
 * Default mode self-serves production-like dist/ on a random localhost port.
 * Optional AUDIT_BASE=http://host can be provided by external runners.
 *
 * Required precondition:
 *   npm run strangler:build:production-like
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'reports', 'gill-v16-mobile-play-smoke-2026-06-28');
fs.mkdirSync(OUT, { recursive: true });

process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(process.env.HOME || ROOT, '.cache', 'ms-playwright');

let BASE = (process.env.AUDIT_BASE || '').replace(/\/$/, '');
const INTRO = '/articles/dzhon-gill-istoricheskiy-kontekst/';
const PART1 = '/articles/dzhon-gill-chast-1-chelovek/';
// Display order: Введение → I Человек → II Учёный → III Экзегет → IV Наследие
// → Справочник. NB the slugs intentionally decouple from display numbers
// (owner kept the live /chast-3-nasledie/ URL): chast-4-ekzeget renders mark
// III, chast-3-nasledie renders mark IV. Source of truth: gillSeriesData.ts,
// enforced by gill:series:data:consistency:audit — keep these in sync with it
// (the fully data-driven derivation is tracked as GATE-MARKER-DATA-DRIFT).
const ROUTES = [
  INTRO,
  PART1,
  '/articles/dzhon-gill-chast-2-uchenyi/',
  '/articles/dzhon-gill-chast-4-ekzeget/',
  '/articles/dzhon-gill-chast-3-nasledie/',
  '/articles/dzhon-gill-spravochnik/',
];

// Desktop rail: 'Введение' and 'Справочник' render as the full leather-bookmark
// word (GillLeatherRibbon), not the abbreviated 'Справ.' used on the compact
// mobile TOC overlay (GillSeriesOverlay, still plain SeriesMark) — the leather
// port deliberately spelled the word out in full once the ribbon was widened to
// fit it (owner spec: mute glow, shrink font, keep the full word legible).
const expectedSeriesMarks = ['Введение', 'I', 'II', 'III', 'IV', 'Справочник'];
// Flow-rail (PR#45, witness bcf6389f): the CURRENT part's compact card is
// replaced in-list by the expanded .gbs2-current card, so its mark is
// legitimately absent from .gbs-rail-card__num — each route expects the
// other four marks, and the expanded card must be present as the witness.
const currentMarkByRoute = {
  '/articles/dzhon-gill-istoricheskiy-kontekst/': 'Введение',
  '/articles/dzhon-gill-chast-1-chelovek/': 'I',
  '/articles/dzhon-gill-chast-2-uchenyi/': 'II',
  '/articles/dzhon-gill-chast-4-ekzeget/': 'III',
  '/articles/dzhon-gill-chast-3-nasledie/': 'IV',
  '/articles/dzhon-gill-spravochnik/': 'Справочник',
};
const failures = [];
const proof = {
  generatedAt: new Date().toISOString(),
  base: '',
  screenshotsDir: OUT,
  series: [],
  mobileOverlays: [],
  play: [],
  failures,
};

const ok = (msg) => console.log('✅ ' + msg);
const fail = (msg, detail = '') => {
  failures.push({ msg, detail });
  console.error('❌ ' + msg + (detail ? ' — ' + detail : ''));
};
function assert(cond, msg, detail) { if (cond) ok(msg); else fail(msg, detail); }

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  if (file.endsWith('.webp')) return 'image/webp';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg';
  if (file.endsWith('.woff2')) return 'font/woff2';
  return 'application/octet-stream';
}

function startDistServer() {
  if (!fs.existsSync(DIST)) {
    console.error('❌ dist/ missing. Run npm run strangler:build:production-like first.');
    process.exit(2);
  }
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    let file = path.join(DIST, rel);
    if (!path.normalize(file).startsWith(DIST)) { res.writeHead(403); res.end('forbidden'); return; }
    if (url.pathname.endsWith('/')) file = path.join(file, 'index.html');
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': contentType(file) });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

async function addFakeTts(context) {
  await context.addInitScript(() => {
    window.__ttsFake = { speakCalls: 0, cancelCalls: 0, spokenRates: [], events: [] };
    try {
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        value: function SpeechSynthesisUtterance(text) {
          this.text = text || '';
          this.rate = 1;
          this.lang = '';
          this.voice = null;
          this.onend = null;
          this.onerror = null;
        },
        configurable: true,
      });
    } catch (_) {}
    const fake = {
      speaking: false,
      paused: false,
      getVoices() { return [{ lang: 'ru-RU', name: 'Fake RU', default: true }]; },
      addEventListener() {},
      speak(u) {
        this.speaking = true;
        this.paused = false;
        window.__ttsFake.speakCalls += 1;
        window.__ttsFake.spokenRates.push(Number(u.rate || 1));
        window.__ttsFake.lastText = u.text || '';
        window.__ttsFake.events.push({ type: 'speak', rate: Number(u.rate || 1) });
      },
      cancel() {
        this.speaking = false;
        this.paused = false;
        window.__ttsFake.cancelCalls += 1;
        window.__ttsFake.events.push({ type: 'cancel' });
      },
      pause() { this.paused = true; window.__ttsFake.events.push({ type: 'pause' }); },
      resume() { this.paused = false; this.speaking = true; window.__ttsFake.events.push({ type: 'resume' }); },
    };
    try {
      Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
    } catch (_) {
      try {
        window.speechSynthesis.getVoices = fake.getVoices.bind(fake);
        window.speechSynthesis.addEventListener = fake.addEventListener.bind(fake);
        window.speechSynthesis.speak = fake.speak.bind(fake);
        window.speechSynthesis.cancel = fake.cancel.bind(fake);
        window.speechSynthesis.pause = fake.pause.bind(fake);
        window.speechSynthesis.resume = fake.resume.bind(fake);
      } catch (_) { window.speechSynthesis = fake; }
    }
  });
}

// Gill's rail/mobile-bar Play embers no longer opt out via
// [data-gb-speed-custom] — they use the same canonical .gb-ember-wrap/
// .gb-ember-expand speed bloom as single articles, so clickSpeedNearEmber()
// below takes its non-custom branch for Gill. Hermenevtika's rail/mobile bar
// still runs its own custom speed slot (.hm-spdbadge/.hm-spd), so that branch
// stays exercised too. All are driven by the same TTS engine via
// data-fc-action="play" click delegation — setEmberState() still updates
// every .gb-ember in the DOM (the mobile bar's node exists even when hidden
// by CSS on desktop viewports), so allEmberStates() below keeps reading real
// engine state regardless of which control is visible.
async function visibleEmber(page, mobile) {
  const selector = mobile
    ? '.mobile-top-bar .gb-ember'
    // Desktop play ember moved from the horizontal .gbs-rail-topbar into the
    // vertical .gbs-theme-corner cluster (theme→search→play→save) in the rail
    // reorg; keep the old topbar/foot selectors alongside so this smoke stays
    // layout-tolerant across either generation.
    : '.gbs-theme-corner .gb-ember, .gbs-rail-topbar .gb-ember, .gbs-rail-foot .gb-ember, .gbs-rail-foot .gbmini-play';
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: 'visible', timeout: 8000 });
  return loc;
}
async function emberIsGoo(ember) { return ember.evaluate(el => el.classList.contains('gbmini-play')); }
async function emberIsCustomSpeedSlot(ember) { return ember.evaluate(el => !!el.closest('[data-gb-speed-custom]')); }
// Gill mobile v5 top bar: ember opts out of the bloom-pill entirely (no
// .gb-ember-wrap is ever created for it) in favor of the inline
// .mobile-speedrail slot-swap — see initGillInlineSpeedRail() in
// floating-cluster-controller.js and data-fc-speed-mode="inline" in
// GillSeriesMobileBar.astro.
async function emberIsInlineSpeedMode(ember) { return ember.evaluate(el => !!el.closest('[data-fc-speed-mode="inline"]')); }
async function allEmberStates(page) { return page.$$eval('.gb-ember', els => els.map(el => el.getAttribute('data-state') || '')); }
async function clickSpeedNearEmber(ember, speed) {
  const isCustom = await emberIsCustomSpeedSlot(ember);
  if (isCustom) {
    const clicked = await ember.evaluate((el, targetSpeed) => {
      const topbar = el.closest('[data-gb-speed-custom]');
      // Only Hermenevtika still opts out via [data-gb-speed-custom] — Gill's
      // rail/mobile bar use the canonical speed bloom (non-custom branch above).
      const badge = topbar && topbar.querySelector('.hm-spdbadge');
      if (badge) badge.click();
      const btn = topbar && topbar.querySelector(`.hm-spd[data-speed="${targetSpeed}"]`);
      if (!btn) return false;
      btn.click();
      return true;
    }, String(speed));
    if (!clicked) throw new Error(`speed button ${speed} not found in custom speed slot`);
    return;
  }
  const isInline = await emberIsInlineSpeedMode(ember);
  if (isInline) {
    const clicked = await ember.evaluate((el, targetSpeed) => {
      const root = el.closest('[data-fc-speed-mode="inline"]');
      const btn = root && root.querySelector(`.mobile-speedrail [data-speed="${targetSpeed}"]`);
      if (!btn) return false;
      btn.click();
      return true;
    }, String(speed));
    if (!clicked) throw new Error(`speed button ${speed} not found in inline speed rail`);
    return;
  }
  const clicked = await ember.evaluate((el, targetSpeed) => {
    const wrap = el.closest('.gb-ember-wrap') || el.closest('.gbmini');
    const btn = wrap && wrap.querySelector(`[data-speed="${targetSpeed}"]`);
    if (!btn) return false;
    btn.click();
    return true;
  }, String(speed));
  if (!clicked) throw new Error(`speed button ${speed} not found near visible ember`);
}
async function clickStopNearEmber(ember) {
  const clicked = await ember.evaluate((el) => {
    const wrap = el.closest('.gb-ember-wrap');
    const btn = wrap && wrap.querySelector('.gb-ember-expand__stop');
    if (!btn) return false;
    btn.click();
    return true;
  });
  if (!clicked) throw new Error('stop button not found near visible ember');
}

async function labelFit(page) {
  return page.evaluate(() => {
    const labels = [...document.querySelectorAll('.gb-series-mark--label')];
    return labels.map(el => {
      const r = el.getBoundingClientRect();
      return {
        text: (el.textContent || '').trim(),
        width: r.width,
        scrollWidth: el.scrollWidth,
        ok: el.scrollWidth <= Math.ceil(r.width) + 1,
      };
    });
  });
}

async function testSeriesModel(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    const facts = await page.evaluate((introRoute) => ({
      marks: [...document.querySelectorAll('.gbs-rail-card__num')].map(el => (el.textContent || '').trim()),
      hasGillV16: !!document.querySelector('[data-gill-v16]'),
      labelCount: document.querySelectorAll('.gb-series-mark--label').length,
      rawRailNums: [...document.querySelectorAll('.gbs-rail-card__num, .toc-item__num, .toc-part-item__num, .gbs2-kinetic')]
        .filter(el => !el.classList.contains('gb-roman') && !el.classList.contains('gb-series-mark--label'))
        .map(el => (el.textContent || '').trim()),
      introBadPart1: document.body.textContent.includes('Часть 1 из 5'),
      introBadPart0: document.body.textContent.includes('Часть 0'),
      introGoodUpper: document.body.textContent.toUpperCase().includes('СЕРИЯ «ДЖОН ГИЛЛ» · ВВЕДЕНИЕ'),
      isIntro: location.pathname === introRoute,
      hasCurrentCard: !!document.querySelector('.gbs2-current[aria-current="page"]'),
    }), INTRO);
    const fit = await labelFit(page);
    proof.series.push({ route, ...facts, labelFit: fit });
    assert(facts.hasGillV16, `${route} has data-gill-v16`);
    const expectedFlowMarks = expectedSeriesMarks.filter(m => m !== currentMarkByRoute[route]);
    assert(JSON.stringify(facts.marks) === JSON.stringify(expectedFlowMarks), `${route} series marks are the non-current parts (flow-rail)`, JSON.stringify(facts.marks));
    assert(facts.hasCurrentCard, `${route} expanded current-part card replaces the compact card (flow-rail)`);
    assert(facts.labelCount > 0, `${route} has gb-series-mark--label in built output`, String(facts.labelCount));
    assert(facts.rawRailNums.length === 0, `${route} no raw visual-canon Gill mark nodes`, JSON.stringify(facts.rawRailNums));
    assert(!facts.introBadPart1, `${route} does not contain forbidden Часть 1 из 5`);
    assert(!facts.introBadPart0, `${route} does not contain forbidden Часть 0`);
    if (facts.isIntro) assert(facts.introGoodUpper, `${route} contains СЕРИЯ «ДЖОН ГИЛЛ» · ВВЕДЕНИЕ (case-normalized)`);
    assert(fit.length > 0 && fit.every(x => x.ok), `${route} label badges fit without text overflow`, JSON.stringify(fit));
  }
  await ctx.close();
}

async function testMobileOverlays(browser) {
  for (const width of [390, 360]) {
    for (const mode of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      await page.goto(BASE + INTRO, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(900);
      if (mode === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark'));
      const prefix = `mobile_${width}_${mode}`;
      const shot1 = path.join(OUT, `${prefix}_1_closed.png`);
      await page.screenshot({ path: shot1, fullPage: false });
      const overflow0 = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        bar: (() => { const el = document.querySelector('.mobile-bottom-bar'); if (!el) return null; const r = el.getBoundingClientRect(); return Math.max(0, r.right - innerWidth, -r.left); })(),
        labelFit: [...document.querySelectorAll('.gb-series-mark--label')].map(el => ({ text: el.textContent.trim(), width: el.getBoundingClientRect().width, scrollWidth: el.scrollWidth, ok: el.scrollWidth <= Math.ceil(el.getBoundingClientRect().width) + 1 })),
      }));
      assert(overflow0.page <= 1 && (overflow0.bar || 0) <= 1, `${prefix}: no horizontal overflow when closed`, JSON.stringify(overflow0));
      assert(overflow0.labelFit.every(x => x.ok), `${prefix}: label badges fit when closed`, JSON.stringify(overflow0.labelFit));

      const beforeUrl = page.url();
      // v4 mobile bar (gbs_series_mobile_v4_refined): the bottom bar no longer
      // has a dedicated «Серия» button (#mobTocBtn) — the reference bar is
      // dual-progress ring + «Сейчас читаете» section button + theme/font/share.
      // The section button (#mobPartTocBtn) opens the PART overlay directly;
      // the series list is reached one level up via the part overlay's
      // #backToSeries arrow. This test now drives that verified v4 flow
      // (section → part → back → series → Escape) instead of the retired
      // «Серия»-button-first flow, keeping every overflow/label-fit/scroll-lock
      // assertion intact.
      await page.locator('#mobPartTocBtn').click();
      await page.waitForTimeout(250);
      const shot2 = path.join(OUT, `${prefix}_2_part_overlay.png`);
      await page.screenshot({ path: shot2, fullPage: false });
      let state = await page.evaluate(() => ({
        seriesOpen: document.querySelector('#seriesTocOverlay')?.classList.contains('is-open'),
        partOpen: document.querySelector('#partTocOverlay')?.classList.contains('is-open'),
        overflow: document.body.style.overflow,
        scrollLocked: document.documentElement.hasAttribute('data-scroll-locked') || document.body.style.overflow === 'hidden' || document.body.style.position === 'fixed',
        partTitle: document.querySelector('#partTocOverlay .toc-head-txt')?.textContent?.replace(/\s+/g, ' ').trim(),
        xOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      assert(state.partOpen && !state.seriesOpen, `${prefix}: #mobPartTocBtn opens part overlay`, JSON.stringify(state));
      assert(page.url() === beforeUrl, `${prefix}: URL unchanged after section-button tap`, `${beforeUrl} -> ${page.url()}`);
      assert(['Джон Гилл', 'Исторический контекст', 'Оглавление части'].every((part) => (state.partTitle || '').includes(part)), `${prefix}: part overlay identifies intro article and TOC`, state.partTitle);
      assert(state.scrollLocked, `${prefix}: body scroll locked while part overlay open`, { overflow: state.overflow, scrollLocked: state.scrollLocked });
      assert(state.xOverflow <= 1, `${prefix}: no horizontal overflow in part overlay`, String(state.xOverflow));

      await page.locator('#backToSeries').click();
      await page.waitForTimeout(250);
      const shot3 = path.join(OUT, `${prefix}_3_series_overlay.png`);
      await page.screenshot({ path: shot3, fullPage: false });
      state = await page.evaluate(() => ({
        seriesOpen: document.querySelector('#seriesTocOverlay')?.classList.contains('is-open'),
        partOpen: document.querySelector('#partTocOverlay')?.classList.contains('is-open'),
        overflow: document.body.style.overflow,
        scrollLocked: document.documentElement.hasAttribute('data-scroll-locked') || document.body.style.overflow === 'hidden' || document.body.style.position === 'fixed',
        currentText: document.querySelector('#seriesTocOverlay .toc-item.is-current')?.textContent?.replace(/\s+/g, ' ').trim(),
        xOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        labelFit: [...document.querySelectorAll('#seriesTocOverlay .gb-series-mark--label')].map(el => ({ text: el.textContent.trim(), width: el.getBoundingClientRect().width, scrollWidth: el.scrollWidth, ok: el.scrollWidth <= Math.ceil(el.getBoundingClientRect().width) + 1 })),
      }));
      assert(state.seriesOpen && !state.partOpen, `${prefix}: part back arrow opens series overlay`, JSON.stringify(state));
      assert(state.scrollLocked, `${prefix}: body scroll remains locked while series overlay open`, { overflow: state.overflow, scrollLocked: state.scrollLocked });
      assert((state.currentText || '').includes('Введение') && (state.currentText || '').includes('Исторический контекст'), `${prefix}: current intro item labelled as Введение`, state.currentText);
      assert(state.xOverflow <= 1, `${prefix}: no horizontal overflow in series overlay`, String(state.xOverflow));
      assert(state.labelFit.every(x => x.ok), `${prefix}: label badges fit in series overlay`, JSON.stringify(state.labelFit));

      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      state = await page.evaluate(() => ({ seriesOpen: document.querySelector('#seriesTocOverlay')?.classList.contains('is-open'), partOpen: document.querySelector('#partTocOverlay')?.classList.contains('is-open'), overflow: document.body.style.overflow }));
      assert(!state.seriesOpen && !state.partOpen, `${prefix}: Escape closes overlays`, JSON.stringify(state));
      proof.mobileOverlays.push({ width, mode, screenshots: [shot1, shot2, shot3] });
      await ctx.close();
    }
  }
}

// PC-CURRENT-06 guard: #mobPartTocBtn must exist and open #partTocOverlay on ALL 5 Gill routes.
async function testMobPartTocBtn(browser) {
  for (const route of ROUTES) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const prefix = `mobPartTocBtn_${route.replace(/\//g, '_').replace(/^_|_$/g, '')}`;
    const has = await page.evaluate(() => ({
      partBtn: !!document.querySelector('#mobPartTocBtn'),
      partBtnType: document.querySelector('#mobPartTocBtn')?.getAttribute('type') || '',
      // v4 bar shows a dual concentric progress ring (article %/series %),
      // not the old flat .mobile-btoc-meter track.
      hasProgress: !!document.querySelector('.bar-progress.dual-progress'),
      hasGillMobileBar: document.querySelector('.mobile-bottom-bar')?.hasAttribute('data-gill-mobile-bar') || false,
    }));
    assert(has.partBtn, `${prefix}: #mobPartTocBtn present`, JSON.stringify(has));
    assert(has.partBtnType === 'button', `${prefix}: #mobPartTocBtn type=button`, JSON.stringify(has));
    assert(has.hasProgress, `${prefix}: dual-progress ring present`, JSON.stringify(has));
    assert(has.hasGillMobileBar, `${prefix}: data-gill-mobile-bar attr present`, JSON.stringify(has));
    if (has.partBtn) {
      const beforeUrl = page.url();
      await page.click('#mobPartTocBtn');
      await page.waitForTimeout(250);
      const state = await page.evaluate(() => ({
        partOpen: document.querySelector('#partTocOverlay')?.classList.contains('is-open') || false,
        seriesOpen: document.querySelector('#seriesTocOverlay')?.classList.contains('is-open') || false,
        url: location.href,
        ariaHidden: document.querySelector('#partTocOverlay')?.getAttribute('aria-hidden'),
      }));
      assert(state.partOpen, `${prefix}: #mobPartTocBtn click opens #partTocOverlay`, JSON.stringify(state));
      assert(!state.seriesOpen, `${prefix}: #mobPartTocBtn closes #seriesTocOverlay`, JSON.stringify(state));
      assert(state.url === beforeUrl, `${prefix}: no URL change after #mobPartTocBtn click`, `${beforeUrl} -> ${state.url}`);
      assert(state.ariaHidden === 'false', `${prefix}: #partTocOverlay aria-hidden=false when open`, JSON.stringify(state));
      // Канон владельца 2026-07-13 (аккордеон v5): футер part-TOC —
      // [▶ Слушать][Продолжить →][⎙ Распечатать·PDF]. Кнопки Save в листе
      // больше нет (Save живёт в барах) — смоук проверяет актуальный футер.
      const footState = await page.evaluate(() => ({
        listen: !!document.querySelector('#partTocOverlay [data-gbat-listen]'),
        cont: !!document.querySelector('#partTocOverlay [data-gbat-continue]'),
        print: !!document.querySelector('#partTocOverlay .gbat-foot [data-action="print"]'),
      }));
      assert(footState.listen && footState.cont && footState.print,
        `${prefix}: part TOC canon footer (listen/continue/print)`, JSON.stringify(footState));
    }
    await ctx.close();
  }
}

async function testPlayState(browser, mobile) {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  await addFakeTts(ctx);
  const page = await ctx.newPage();
  await page.goto(BASE + PART1, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const label = mobile ? 'mobile 390' : 'desktop 1440';
  const ember = await visibleEmber(page, mobile);
  const isGoo = await emberIsGoo(ember);
  const isCustom = await emberIsCustomSpeedSlot(ember);
  const isInline = await emberIsInlineSpeedMode(ember);

  await ember.click();
  await page.waitForTimeout(150);
  assert((await allEmberStates(page)).every(s => s === 'playing'), `${label}: first play tap -> playing`, JSON.stringify(await allEmberStates(page)));
  await ember.click();
  await page.waitForTimeout(150);
  assert((await allEmberStates(page)).every(s => s === 'paused'), `${label}: second play tap -> paused`, JSON.stringify(await allEmberStates(page)));
  await ember.click();
  await page.waitForTimeout(150);
  assert((await allEmberStates(page)).every(s => s === 'playing'), `${label}: third play tap -> resumed playing`, JSON.stringify(await allEmberStates(page)));

  const callsBeforeSpeed = await page.evaluate(() => window.__ttsFake.speakCalls);
  if (!mobile) await ember.hover();
  await clickSpeedNearEmber(ember, '1.75');
  await page.waitForTimeout(200);
  const speedFacts = await page.evaluate(() => ({ calls: window.__ttsFake.speakCalls, rates: window.__ttsFake.spokenRates }));
  assert(speedFacts.calls === callsBeforeSpeed + 1, `${label}: speed change while playing restarts exactly once`, JSON.stringify(speedFacts));
  assert(speedFacts.rates.at(-1) === 1.75, `${label}: speed change uses selected 1.75×`, JSON.stringify(speedFacts.rates));

  // Custom speed slots (GooPlayMini + Hermenevtika bars, [data-gb-speed-custom])
  // and the Gill mobile v5 inline speed rail ([data-fc-speed-mode="inline"])
  // have no bloom-pill STOP BUTTON — the desktop-only stop/idle-speed
  // assertions below stay gated to neither. (Touch long-press-to-stop IS
  // restored on both via initCustomSlotLongPressStop() — exercised in the
  // mobile block further down, no longer gated out.)
  if (!isGoo && !isCustom && !isInline) {
    await clickStopNearEmber(ember);
    await page.waitForTimeout(150);
    assert((await allEmberStates(page)).every(s => s === 'idle'), `${label}: stop/reset -> idle`, JSON.stringify(await allEmberStates(page)));
    const progress = await page.$$eval('.gb-ember', els => els.map(el => el.style.getPropertyValue('--p') || ''));
    assert(progress.every(p => p === '0'), `${label}: stop/reset clears progress`, JSON.stringify(progress));
  }

  if (!mobile && !isGoo && !isCustom) {
    const beforeIdleSpeed = await page.evaluate(() => window.__ttsFake.speakCalls);
    await ember.hover();
    await clickSpeedNearEmber(ember, '1.25');
    await page.waitForTimeout(200);
    const idleFacts = await page.evaluate(() => ({ calls: window.__ttsFake.speakCalls, rates: window.__ttsFake.spokenRates }));
    assert(idleFacts.calls === beforeIdleSpeed + 1, `${label}: speed select from idle starts once`, JSON.stringify(idleFacts));
    assert(idleFacts.rates.at(-1) === 1.25, `${label}: speed select from idle uses chosen 1.25×`, JSON.stringify(idleFacts.rates));
  }

  if (mobile) {
    await ember.click();
    await page.waitForTimeout(150);
    const beforeLong = await page.evaluate(() => window.__ttsFake.speakCalls);
    await ember.dispatchEvent('pointerdown');
    await page.waitForTimeout(700);
    await ember.dispatchEvent('pointerup');
    await ember.click({ force: true }); // emulate the follow-up click generated after long press
    await page.waitForTimeout(250);
    const longPress = await page.evaluate(() => ({ calls: window.__ttsFake.speakCalls, states: [...document.querySelectorAll('.gb-ember')].map(el => el.dataset.state), cancels: window.__ttsFake.cancelCalls }));
    assert(longPress.states.every(s => s === 'idle'), `${label}: long press stop/reset stays idle after pointerup/click cycle`, JSON.stringify(longPress));
    assert(longPress.calls === beforeLong, `${label}: long press stop does not restart speech`, JSON.stringify({ beforeLong, longPress }));
  }

  const beforeRapid = await page.evaluate(() => window.__ttsFake.speakCalls);
  for (let i = 0; i < 5; i++) await ember.click({ force: true });
  await page.waitForTimeout(300);
  const afterRapid = await page.evaluate(() => ({ calls: window.__ttsFake.speakCalls, states: [...document.querySelectorAll('.gb-ember')].map(el => el.dataset.state), events: window.__ttsFake.events }));
  assert(afterRapid.calls <= beforeRapid + 3, `${label}: rapid taps do not create runaway duplicate utterances`, JSON.stringify(afterRapid));
  assert(afterRapid.states.every(s => ['idle', 'playing', 'paused', 'complete'].includes(s)), `${label}: rapid taps leave valid ember states`, JSON.stringify(afterRapid.states));
  proof.play.push({ label, speedFacts, afterRapid });
  await ctx.close();
}

function writeReport() {
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(proof, null, 2));
  const shotList = proof.mobileOverlays.flatMap(p => p.screenshots.map(s => `- ${path.relative(ROOT, s)}`)).join('\n');
  const md = `# Gill v16 mobile TOC / PlayEmber smoke — 2026-06-28\n\n` +
    `Status: ${failures.length ? 'FAIL' : 'PASS'}\n\n` +
    `Base: ${BASE}\n\n` +
    `## Screenshots\n\n${shotList}\n\n` +
    `## Summary\n\nSee \`summary.json\` for series model, overlay, label-fit, TTS event, speed, stop/reset, long-press, and rapid-tap proof.\n`;
  fs.writeFileSync(path.join(OUT, 'REPORT.md'), md);
}

(async () => {
  let server = null;
  if (!BASE) {
    const started = await startDistServer();
    server = started.server;
    BASE = `http://127.0.0.1:${started.port}`;
  }
  proof.base = BASE;
  const browser = await chromium.launch({ chromiumSandbox: false });
  try {
    await testSeriesModel(browser);
    await testMobileOverlays(browser);
    await testMobPartTocBtn(browser);
    await testPlayState(browser, false);
    await testPlayState(browser, true);
  } finally {
    await browser.close();
    if (server) server.close();
  }
  writeReport();
  if (failures.length) {
    console.error(`\nGill v16 mobile/play smoke failed: ${failures.length} issue(s). See ${OUT}`);
    process.exit(1);
  }
  console.log(`\n✅ Gill v16 mobile/play smoke passed. Report: ${path.join(OUT, 'REPORT.md')}`);
})();
