#!/usr/bin/env node
/**
 * ЗАЩИТА ОТ РЕГРЕССИЙ: функциональный прогон трёх движков (Playwright).
 *
 * Геометрия + функции на реальном dist: серия-движок (Гилл/Сердце/Баптисты/
 * пастор) деск+мобила, одиночный (Герменевтика/kod-da-vinchi), page-движок
 * (6 каталогов), плюс живой PLAY: стаб speechSynthesis → состояние playing,
 * follow-скролл ведёт страницу, Media Session (метаданные, playbackState,
 * фоновый якорь), пауза.
 *
 * Требует собранный dist (npx astro build && node scripts/copy-legacy-to-dist.js
 * && cp css/series-samizdat.css dist/css/). Сервер поднимает сам.
 * Запуск: npm run engine:sweep   (входит в npm run engine:guard)
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' };

async function serve() {
  const srv = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(req.url.split('?')[0]);
      let file = join(DIST, p);
      try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); }
      catch { file = join(ROOT, p); } // легаси-ассеты вне dist (fonts/images)
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end('nf'); }
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { srv, base: `http://127.0.0.1:${srv.address().port}` };
}

/* Стаб Web Speech: honest-но проигрывает chunk'и по таймеру с boundary-событиями,
   чтобы движок прошёл настоящий цикл playing→progress→end. */
const SPEECH_STUB = `
  (() => {
    const utts = [];
    window.__spokenChunks = utts;
    class FakeUtterance {
      constructor(text) { this.text = text; this.rate = 1; this.lang = ''; this.voice = null; }
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true });
    const fakeSynth = {
      getVoices: () => [{ name: 'Fake RU', lang: 'ru-RU', localService: true }],
      cancel() { this._cur = null; },
      speak(u) {
        this._cur = u; utts.push(u.text);
        let i = 0;
        const step = () => {
          if (this._cur !== u) return;
          i += 60;
          if (i < u.text.length) {
            u.onboundary && u.onboundary({ charIndex: i });
            setTimeout(step, 40);
          } else { this._cur = null; u.onend && u.onend(); }
        };
        setTimeout(step, 40);
      },
      addEventListener() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { value: fakeSynth, configurable: true });
  })();
`;

const results = [];
const R = (page, name, ok, detail) => results.push({ page, name, ok, detail: detail || '' });

const SERIES = [
  ['gill3', '/articles/dzhon-gill-chast-3-nasledie/'],
  ['heart', '/articles/novoe-serdce/'],
  ['baptist', '/baptisty-rossii/podpolnaya-pechat/'],
  ['antisov', '/articles/20-antisovetov-pastoru/'],
];
const SINGLES = [
  ['herm', '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/'],
  ['kdv', '/articles/kod-da-vinchi/'],
];
const CATALOGS = ['/articles/', '/biografii/', '/karty/', '/konfessii/', '/hard-texts/', '/rodosloviye/'];

const { srv, base } = await serve();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function newPage(vp, { speech = false } = {}) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  await page.route(/gospod-bog\.ru|mc\.yandex/, (r) => r.abort());
  page.on('pageerror', (e) => R('JS', 'pageerror', false, String(e).slice(0, 120)));
  if (speech) await page.addInitScript(SPEECH_STUB);
  return { ctx, page };
}

/* ============ СЕРИЯ-ДВИЖОК — ДЕСКТОП ============ */
for (const [id, url] of SERIES) {
  const { ctx, page } = await newPage({ width: 1440, height: 900 });
  await page.goto(base + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  R(id, 'desk: rail', !!(await page.$('[data-gill-v16] .gbs-rail')));
  R(id, 'desk: rail ⚙', !!(await page.$('#railSettingsBtn')));

  const ring = await page.evaluate(() => {
    const svg = document.querySelector('.gbs-theme-corner .gb-ember__ring-svg');
    const track = document.querySelector('.gbs-theme-corner .gb-ember__ring-track');
    return svg && track ? { op: getComputedStyle(svg).opacity, tr: getComputedStyle(track).opacity } : null;
  });
  R(id, 'desk: контур PLAY в покое', !!ring && +ring.op === 1 && +ring.tr > 0.3, JSON.stringify(ring));

  const badge = await page.evaluate(() => {
    const e = (document.querySelector('.gbs-theme-corner .gbs-rail-playwrap') || document.querySelector('.gbs-theme-corner .gb-ember'))?.getBoundingClientRect();
    const b = document.querySelector('.gbs-theme-corner .gbs-rail-spdbadge')?.getBoundingClientRect();
    return e && b ? { br: Math.round(b.right - e.right), bb: Math.round(b.bottom - e.bottom) } : null;
  });
  R(id, 'desk: «1×» в круге', !!badge && badge.br <= 4 && badge.bb <= 4, JSON.stringify(badge));

  await page.click('#railSettingsBtn');
  await page.waitForTimeout(450);
  const pop = await page.evaluate(() => {
    const p = document.querySelector('[data-gill-v16] .gill-settings-overlay [class*="sheet"]');
    const ov = document.querySelector('#gillSettingsOverlay');
    if (!p) return null;
    const r = p.getBoundingClientRect();
    return { cx: Math.round(r.x + r.width / 2), vw: innerWidth, vis: ov && getComputedStyle(ov).visibility !== 'hidden' };
  });
  R(id, 'desk: настройки поповером слева-снизу', !!pop && pop.vis && pop.cx < pop.vw / 2 - 60, JSON.stringify(pop));

  const sepiaBtn = await page.$('#gillSettingsOverlay [data-theme="sepia"]');
  if (sepiaBtn) {
    await sepiaBtn.click(); await page.waitForTimeout(250);
    const sep = await page.evaluate(() => document.querySelector('[data-gill-v16]').getAttribute('data-gill-reader-theme'));
    R(id, 'desk: сепия', sep === 'sepia', String(sep));
  } else R(id, 'desk: сепия', false, 'кнопка не найдена');
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);

  await page.evaluate(() => document.querySelector('.gbs-theme-corner .gb-theme-toggle')?.click());
  await page.waitForTimeout(350);
  R(id, 'desk: тумблер → dark', await page.evaluate(() => document.documentElement.classList.contains('dark')));

  if (id === 'baptist') {
    R(id, 'desk: samizdat активна',
      (await page.evaluate(() => document.querySelector('.gbs2-world')?.getAttribute('data-series-theme'))) === 'samizdat');
  }
  await ctx.close();
}

/* ============ СЕРИЯ-ДВИЖОК — МОБИЛА ============ */
for (const [id, url] of SERIES) {
  const { ctx, page } = await newPage({ width: 390, height: 844 });
  await page.goto(base + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const crumbs = await page.evaluate(() => {
    const n = document.querySelector('nav.breadcrumb');
    return n ? getComputedStyle(n).display : 'absent';
  });
  R(id, 'mob: крошки скрыты', crumbs === 'absent' || crumbs === 'none', crumbs);

  R(id, 'mob: бары', await page.evaluate(() =>
    !!document.querySelector('.mobile-top-bar') && !!document.querySelector('.mobile-bottom-bar')));

  const mb = await page.evaluate(() => {
    const e = document.querySelector('.mobile-top-bar .gb-ember')?.getBoundingClientRect();
    const b = document.querySelector('.mobile-top-bar .mobile-spdbadge, .mobile-top-bar .gbs-rail-spdbadge')?.getBoundingClientRect();
    return e && b ? { br: Math.round(b.right - e.right), bb: Math.round(b.bottom - e.bottom) } : null;
  });
  R(id, 'mob: «1×» в круге', !!mb && mb.br <= 4 && mb.bb <= 4, JSON.stringify(mb));

  const gear = await page.$('#mobSettingsBtn');
  if (gear) {
    await gear.click(); await page.waitForTimeout(450);
    const sheet = await page.evaluate(() => {
      const p = document.querySelector('#gillSettingsOverlay [class*="sheet"]');
      if (!p) return null;
      const r = p.getBoundingClientRect();
      return { w: Math.round(r.width), gap: Math.round(innerHeight - r.bottom), vw: innerWidth };
    });
    R(id, 'mob: настройки bottom-sheet', !!sheet && sheet.w >= sheet.vw * 0.9 && sheet.gap <= 8, JSON.stringify(sheet));
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  } else R(id, 'mob: настройки bottom-sheet', false, '#mobSettingsBtn нет');

  await page.evaluate(() => (document.querySelector('#mobPartTocBtn') || document.querySelector('.mobile-bottom-bar'))?.click());
  await page.waitForTimeout(500);
  const toc = await page.evaluate(() => {
    const ov = document.getElementById('partTocOverlay');
    return {
      open: !!ov && ov.classList.contains('is-open') && ov.getAttribute('aria-hidden') === 'false',
      parts: ov ? ov.querySelectorAll('.gbat-part').length : 0,
      cur: !!ov?.querySelector('.gbat-part.cur.open'),
    };
  });
  R(id, 'mob: part-TOC аккордеон', toc.open && toc.parts > 0 && toc.cur, JSON.stringify(toc));
  await ctx.close();
}

/* ============ ОДИНОЧНЫЙ ДВИЖОК ============ */
for (const [id, url] of SINGLES) {
  let { ctx, page } = await newPage({ width: 1440, height: 900 });
  await page.goto(base + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  R(id, 'desk: ReaderRail', !!(await page.$('.hrail')));
  await page.evaluate(() => document.querySelector('.hrail [data-hm-settings], .hrail button[aria-label*="астрой"]')?.click());
  await page.waitForTimeout(450);
  const hs = await page.evaluate(() => {
    const s = document.getElementById('hmSettings');
    const p = s?.querySelector('.hmsheet-panel');
    if (!p) return null;
    const r = p.getBoundingClientRect();
    return { open: s.classList.contains('is-open'), pos: getComputedStyle(p).position, w: Math.round(r.width) };
  });
  R(id, 'desk: настройки из рельса', !!hs && hs.open && hs.pos === 'fixed' && hs.w > 200, JSON.stringify(hs));
  const sep = await page.evaluate(() => {
    const b = document.querySelector('.hmsheet-panel [data-hm-theme="sepia"], .hmsheet-panel [data-reader-theme="sepia"]');
    if (!b) return 'no-btn';
    b.click();
    return document.querySelector('[data-reader-root]')?.getAttribute('data-hm-reader-theme');
  });
  R(id, 'desk: сепия на reader-root', sep === 'sepia', String(sep));
  await ctx.close();

  ({ ctx, page } = await newPage({ width: 390, height: 844 }));
  await page.goto(base + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const opened = await page.evaluate(() => {
    const btn = document.querySelector('#hmSettingsBtn, #gbFcSettings, [data-fc-action="settings"]');
    if (!btn) return false; btn.click(); return true;
  });
  await page.waitForTimeout(450);
  const msheet = await page.evaluate(() => {
    const s = document.getElementById('hmSettings');
    const p = s?.querySelector('.hmsheet-panel');
    if (!p) return null;
    const r = p.getBoundingClientRect();
    return { open: s.classList.contains('is-open'), w: Math.round(r.width), gap: Math.round(innerHeight - r.bottom), vw: innerWidth };
  });
  R(id, 'mob: настройки bottom-sheet', opened && !!msheet && msheet.open && msheet.w >= msheet.vw * 0.9 && msheet.gap <= 8, JSON.stringify(msheet));
  await ctx.close();
}

/* ============ PAGE-ДВИЖОК — МОБИЛА ============ */
for (const url of CATALOGS) {
  const { ctx, page } = await newPage({ width: 390, height: 844 });
  await page.goto(base + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(650);
  const bar = await page.evaluate(() => {
    const b = document.querySelector('.mcp-top');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { y: Math.round(r.y), shown: r.y >= -2 && r.height > 30 && getComputedStyle(b).visibility !== 'hidden' };
  });
  R(url, 'mob: page-бар на скролле', !!bar && bar.shown, JSON.stringify(bar));
  const pal = await page.evaluate(async () => {
    const s = document.querySelector('.mcp-search');
    if (!s) return 'no-btn';
    s.click();
    await new Promise((r) => setTimeout(r, 2500));
    return document.querySelector('[class*="cp-"]') ? 'open' : 'not-open';
  });
  R(url, 'mob: поиск → палитра', pal === 'open', pal);
  await ctx.close();
}

/* ============ PLAY: живой цикл (стаб Web Speech) ============ */
for (const [id, url, emberSel] of [
  ['gill3', SERIES[0][1], '.gbs-theme-corner .gb-ember'],
  ['baptist', SERIES[2][1], '.gbs-theme-corner .gb-ember'],
  ['herm', SINGLES[0][1], '.gb-floater .gb-ember, .gbs-theme-corner .gb-ember'],
]) {
  const { ctx, page } = await newPage({ width: 1440, height: 900 }, { speech: true });
  await page.goto(base + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const y0 = await page.evaluate(() => scrollY);
  await page.evaluate((sel) => document.querySelector(sel)?.click(), emberSel);
  await page.waitForTimeout(2500);

  const st = await page.evaluate((sel) => {
    const ember = document.querySelector(sel);
    const anchor = [...document.querySelectorAll('audio')].find((a) => a.loop && a.volume <= 0.05);
    return {
      state: ember?.dataset.state,
      chunks: (window.__spokenChunks || []).length,
      ms: 'mediaSession' in navigator ? navigator.mediaSession.playbackState : 'unsupported',
      msTitle: 'mediaSession' in navigator ? (navigator.mediaSession.metadata?.title || '') : '',
      anchor: !!anchor, anchorPlaying: !!anchor && !anchor.paused,
      progress: parseFloat(ember?.style.getPropertyValue('--p') || '0'),
      y: scrollY,
    };
  }, emberSel);

  R(id, 'PLAY: состояние playing', st.state === 'playing', st.state);
  R(id, 'PLAY: озвучка идёт (chunks>0, прогресс>0)', st.chunks > 0 && st.progress > 0, JSON.stringify({ c: st.chunks, p: st.progress }));
  R(id, 'PLAY: follow-скролл ведёт страницу', st.y > y0, `y ${y0}→${st.y}`);
  R(id, 'PLAY: mediaSession playing + метаданные', st.ms === 'playing' && st.msTitle.length > 3, JSON.stringify({ ms: st.ms, t: st.msTitle.slice(0, 40) }));
  R(id, 'PLAY: фоновый якорь играет', st.anchor && st.anchorPlaying, JSON.stringify({ a: st.anchor, ap: st.anchorPlaying }));

  await page.evaluate((sel) => document.querySelector(sel)?.click(), emberSel); // пауза
  await page.waitForTimeout(400);
  const paused = await page.evaluate((sel) => {
    const ember = document.querySelector(sel);
    const anchor = [...document.querySelectorAll('audio')].find((a) => a.loop && a.volume <= 0.05);
    return { state: ember?.dataset.state, ms: navigator.mediaSession?.playbackState, anchorPaused: !anchor || anchor.paused };
  }, emberSel);
  R(id, 'PLAY: пауза (state+mediaSession+якорь)',
    paused.state === 'paused' && paused.ms === 'paused' && paused.anchorPaused, JSON.stringify(paused));
  await ctx.close();
}

await browser.close();
srv.close();

const fails = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  [${r.page}] ${r.name}${r.ok ? '' : '  ' + r.detail}`);
console.log(`\nTOTAL: ${results.length - fails.length}/${results.length} PASS`);
if (fails.length) { console.error('❌ engine:sweep — регрессия движка. Скрины/замеры выше.'); process.exit(1); }
console.log('✅ engine:sweep — все движки соответствуют канону.');
