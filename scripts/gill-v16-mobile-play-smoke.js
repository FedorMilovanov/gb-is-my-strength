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
const ROUTES = [
  INTRO,
  PART1,
  '/articles/dzhon-gill-chast-2-uchenyi/',
  '/articles/dzhon-gill-chast-3-nasledie/',
  '/articles/dzhon-gill-spravochnik/',
];

const expectedSeriesMarks = ['Введение', 'I', 'II', 'III', 'Справ.'];
// Flow-rail (PR#45, witness bcf6389f): the CURRENT part's compact card is
// replaced in-list by the expanded .gbs2-current card, so its mark is
// legitimately absent from .gbs-rail-card__num — each route expects the
// other four marks, and the expanded card must be present as the witness.
const currentMarkByRoute = {
  '/articles/dzhon-gill-istoricheskiy-kontekst/': 'Введение',
  '/articles/dzhon-gill-chast-1-chelovek/': 'I',
  '/articles/dzhon-gill-chast-2-uchenyi/': 'II',
  '/articles/dzhon-gill-chast-3-nasledie/': 'III',
  '/articles/dzhon-gill-spravochnik/': 'Справ.',
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

async function visibleEmber(page, mobile) {
  const selector = mobile ? '.mobile-bottom-bar .gb-ember' : '.gbs-rail-foot .gb-ember';
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: 'visible', timeout: 8000 });
  return loc;
}
async function allEmberStates(page) { return page.$$eval('.gb-ember', els => els.map(el => el.getAttribute('data-state') || '')); }
async function clickSpeedNearEmber(ember, speed) {
  const clicked = await ember.evaluate((el, targetSpeed) => {
    const wrap = el.closest('.gb-ember-wrap');
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
    assert(JSON.stringify(facts.marks) === JSON.stringify(expectedFlowMarks), `${route} series marks are the four non-current parts (flow-rail)`, JSON.stringify(facts.marks));
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
      await page.locator('#mobTocBtn').click();
      await page.waitForTimeout(250);
      const shot2 = path.join(OUT, `${prefix}_2_series_overlay.png`);
      await page.screenshot({ path: shot2, fullPage: false });
      let state = await page.evaluate(() => ({
        seriesOpen: document.querySelector('#seriesTocOverlay')?.classList.contains('is-open'),
        partOpen: document.querySelector('#partTocOverlay')?.classList.contains('is-open'),
        overflow: document.body.style.overflow,
        scrollLocked: document.documentElement.hasAttribute('data-scroll-locked') || document.body.style.overflow === 'hidden' || document.body.style.position === 'fixed',
        currentText: document.querySelector('#seriesTocOverlay .toc-item.is-current')?.textContent?.replace(/\s+/g, ' ').trim(),
        xOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        labelFit: [...document.querySelectorAll('#seriesTocOverlay .gb-series-mark--label')].map(el => ({ text: el.textContent.trim(), width: el.getBoundingClientRect().width, scrollWidth: el.scrollWidth, ok: el.scrollWidth <= Math.ceil(el.getBoundingClientRect().width) + 1 })),
      }));
      assert(state.seriesOpen && !state.partOpen, `${prefix}: #mobTocBtn opens series overlay`, JSON.stringify(state));
      assert(state.scrollLocked, `${prefix}: body scroll locked while series overlay open`, { overflow: state.overflow, scrollLocked: state.scrollLocked });
      assert((state.currentText || '').includes('Введение') && (state.currentText || '').includes('Исторический контекст'), `${prefix}: current intro item labelled as Введение`, state.currentText);
      assert(state.xOverflow <= 1, `${prefix}: no horizontal overflow in series overlay`, String(state.xOverflow));
      assert(state.labelFit.every(x => x.ok), `${prefix}: label badges fit in series overlay`, JSON.stringify(state.labelFit));

      await page.locator('#seriesTocOverlay .toc-item.is-current').click();
      await page.waitForTimeout(250);
      const shot3 = path.join(OUT, `${prefix}_3_part_overlay.png`);
      await page.screenshot({ path: shot3, fullPage: false });
      state = await page.evaluate(() => ({
        seriesOpen: document.querySelector('#seriesTocOverlay')?.classList.contains('is-open'),
        partOpen: document.querySelector('#partTocOverlay')?.classList.contains('is-open'),
        overflow: document.body.style.overflow,
        scrollLocked: document.documentElement.hasAttribute('data-scroll-locked') || document.body.style.overflow === 'hidden' || document.body.style.position === 'fixed',
        partTitle: document.querySelector('#partTocOverlay .toc-head-txt')?.textContent?.replace(/\s+/g, ' ').trim(),
        xOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      assert(!state.seriesOpen && state.partOpen, `${prefix}: current series item opens part overlay instead of reload`, JSON.stringify(state));
      assert(page.url() === beforeUrl, `${prefix}: URL unchanged after current item tap`, `${beforeUrl} -> ${page.url()}`);
      assert((state.partTitle || '').includes('Введение'), `${prefix}: part overlay is intro TOC`, state.partTitle);
      assert(state.scrollLocked, `${prefix}: body scroll remains locked while part overlay open`, { overflow: state.overflow, scrollLocked: state.scrollLocked });
      assert(state.xOverflow <= 1, `${prefix}: no horizontal overflow in part overlay`, String(state.xOverflow));

      await page.locator('#backToSeries').click();
      await page.waitForTimeout(200);
      state = await page.evaluate(() => ({ seriesOpen: document.querySelector('#seriesTocOverlay')?.classList.contains('is-open'), partOpen: document.querySelector('#partTocOverlay')?.classList.contains('is-open') }));
      assert(state.seriesOpen && !state.partOpen, `${prefix}: part back button returns to series overlay`, JSON.stringify(state));
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
      hasMeter: !!document.querySelector('.mobile-btoc-meter'),
      hasGillMobileBar: document.querySelector('.mobile-bottom-bar')?.hasAttribute('data-gill-mobile-bar') || false,
    }));
    assert(has.partBtn, `${prefix}: #mobPartTocBtn present`, JSON.stringify(has));
    assert(has.partBtnType === 'button', `${prefix}: #mobPartTocBtn type=button`, JSON.stringify(has));
    assert(has.hasMeter, `${prefix}: .mobile-btoc-meter present`, JSON.stringify(has));
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
      const saveState = await page.evaluate(() => {
        const btn = document.querySelector('#partTocOverlay .gb-save[data-fc-action="save"]');
        if (!btn) return { exists: false };
        const beforePressed = btn.getAttribute('aria-pressed');
        const beforeSaved = btn.classList.contains('is-saved');
        btn.click();
        return {
          exists: true,
          beforePressed,
          beforeSaved,
          afterPressed: btn.getAttribute('aria-pressed'),
          afterSaved: btn.classList.contains('is-saved'),
        };
      });
      assert(saveState.exists, `${prefix}: part TOC save button present`, JSON.stringify(saveState));
      assert(saveState.afterPressed === 'true' || saveState.afterSaved, `${prefix}: part TOC save button toggles`, JSON.stringify(saveState));
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

  await clickStopNearEmber(ember);
  await page.waitForTimeout(150);
  assert((await allEmberStates(page)).every(s => s === 'idle'), `${label}: stop/reset -> idle`, JSON.stringify(await allEmberStates(page)));
  const progress = await page.$$eval('.gb-ember', els => els.map(el => el.style.getPropertyValue('--p') || ''));
  assert(progress.every(p => p === '0'), `${label}: stop/reset clears progress`, JSON.stringify(progress));

  if (!mobile) {
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
