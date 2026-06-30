#!/usr/bin/env node
'use strict';

/**
 * Gill mobile reference layout audit.
 *
 * Verifies the actual Android/Yandex regression:
 * - bottom bar must be readable and nearly opaque in light/dark;
 * - article text must not leak through or under it;
 * - old root-static one-level bar must be upgraded by JS;
 * - explicit Part TOC trigger must exist and open #partTocOverlay;
 * - Series TOC trigger must open #seriesTocOverlay;
 * - generic fallback controls must not float over Gill mobile content;
 * - no horizontal overflow on 360/390px.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'reports', 'gill-mobile-layout-audit-2026-06-29');
fs.mkdirSync(OUT, { recursive: true });

const ROUTE = '/articles/dzhon-gill-chast-1-chelovek/';
let BASE = (process.env.AUDIT_BASE || '').replace(/\/$/, '');
const failures = [];
const proof = { generatedAt: new Date().toISOString(), base: '', checks: [], failures };

function ok(name, detail = {}) {
  proof.checks.push({ ok: true, name, detail });
  console.log('✅ ' + name);
}
function fail(name, detail = {}) {
  const item = { ok: false, name, detail };
  proof.checks.push(item);
  failures.push(item);
  console.error('❌ ' + name + (detail ? ' — ' + JSON.stringify(detail) : ''));
}
function assert(cond, name, detail = {}) { cond ? ok(name, detail) : fail(name, detail); }

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

function serveDist() {
  if (!fs.existsSync(DIST)) {
    throw new Error('dist/ not found. Run `npm run strangler:build:production-like` first.');
  }
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url, 'http://127.0.0.1');
        let pathname = decodeURIComponent(url.pathname);
        if (pathname.endsWith('/')) pathname += 'index.html';
        const file = path.join(DIST, pathname.replace(/^\//, ''));
        if (!file.startsWith(DIST)) { res.writeHead(403); res.end('Forbidden'); return; }
        if (!fs.existsSync(file)) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': contentType(file), 'Cache-Control': 'no-store' });
        fs.createReadStream(file).pipe(res);
      } catch (err) {
        res.writeHead(500); res.end(String(err && err.stack || err));
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function alphaFromColor(value) {
  const str = String(value || '').trim();
  if (str.startsWith('rgba(')) {
    const parts = str.slice(5, -1).split(',').map(s => s.trim());
    return Number(parts[3]);
  }
  if (str.startsWith('rgb(')) return 1;
  if (str === 'transparent') return 0;
  return 1;
}

function rgbTriplet(value) {
  const str = String(value || '').trim();
  const m = str.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(',').map(s => Number(String(s).trim()));
  if (parts.length < 3 || parts.slice(0, 3).some(n => Number.isNaN(n))) return null;
  return parts.slice(0, 3);
}
function relLum(rgb) {
  return rgb.map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrastRatio(a, b) {
  const ra = rgbTriplet(a), rb = rgbTriplet(b);
  if (!ra || !rb) return null;
  const l1 = relLum(ra), l2 = relLum(rb);
  const high = Math.max(l1, l2), low = Math.min(l1, l2);
  return (high + 0.05) / (low + 0.05);
}

async function runCase(browser, viewport, dark) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: dark ? 'dark' : 'light',
  });
  const page = await context.newPage();
  const mode = dark ? 'dark' : 'light';
  const tag = `${viewport.width}x${viewport.height}-${mode}`;

  page.on('console', msg => { if (msg.type() === 'error') fail(`console error ${tag}`, { text: msg.text() }); });
  page.on('pageerror', err => fail(`page error ${tag}`, { message: err.message }));

  await page.addInitScript(isDark => {
    try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch (_) {}
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, dark);

  await page.goto(BASE + ROUTE, { waitUntil: 'networkidle' });
  await page.evaluate(isDark => {
    document.documentElement.classList.toggle('dark', isDark);
    try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch (_) {}
  }, dark);
  await page.waitForTimeout(300);

  const facts = await page.evaluate(() => {
    const bar = document.querySelector('.mobile-bottom-bar');
    const partBtn = document.querySelector('#mobPartTocBtn');
    const seriesBtn = document.querySelector('#mobTocBtn');
    const fallback = document.querySelector('.gb-mobile-fallback-controls');
    const root = document.querySelector('[data-gill-v16]');
    const label = document.querySelector('.mobile-btoc-section__main, #gbs2MobSec');
    const style = bar ? getComputedStyle(bar) : null;
    const labelStyle = label ? getComputedStyle(label) : null;
    const partStyle = partBtn ? getComputedStyle(partBtn) : null;
    const barRect = bar ? bar.getBoundingClientRect() : null;
    const doc = document.documentElement;
    const centerEl = barRect ? document.elementFromPoint(Math.round(barRect.left + barRect.width / 2), Math.round(barRect.top + barRect.height / 2)) : null;
    const fallbackRect = fallback ? fallback.getBoundingClientRect() : null;
    const articleCandidate = [...document.querySelectorAll('article p, article h2, .article-body p, main p')]
      .map(el => ({ el, r: el.getBoundingClientRect(), text: (el.textContent || '').trim() }))
      .find(x => x.text && x.r.width > 20 && x.r.height > 8 && barRect && x.r.top < barRect.bottom && x.r.bottom > barRect.top);
    return {
      hasRoot: !!root,
      hasBar: !!bar,
      hasPartBtn: !!partBtn,
      hasSeriesBtn: !!seriesBtn,
      upgradedOldRoot: !!(bar && bar.hasAttribute('data-gill-mobile-bar') && partBtn),
      barText: bar ? bar.textContent.replace(/\s+/g, ' ').trim() : '',
      barRect: barRect ? { left: barRect.left, top: barRect.top, right: barRect.right, bottom: barRect.bottom, width: barRect.width, height: barRect.height } : null,
      barBg: style ? style.backgroundColor : '',
      barDisplay: style ? style.display : '',
      barPosition: style ? style.position : '',
      barOverflow: style ? style.overflow : '',
      bodyPaddingBottom: Number.parseFloat(getComputedStyle(document.body).paddingBottom || '0'),
      labelOpacity: labelStyle ? Number(labelStyle.opacity) : null,
      labelColor: labelStyle ? labelStyle.color : '',
      labelBg: partStyle ? partStyle.backgroundColor : '',
      docWidth: doc.scrollWidth,
      viewportWidth: window.innerWidth,
      centerInsideBar: !!(bar && centerEl && (centerEl === bar || bar.contains(centerEl))),
      fallbackVisible: !!(fallback && fallbackRect && fallbackRect.width > 20 && fallbackRect.height > 20 && getComputedStyle(fallback).display !== 'none' && getComputedStyle(fallback).visibility !== 'hidden'),
      articleIntersectsBar: !!articleCandidate,
      articleLeakCandidate: articleCandidate ? { text: articleCandidate.text.slice(0, 80), rect: { top: articleCandidate.r.top, bottom: articleCandidate.r.bottom } } : null,
    };
  });

  const alpha = alphaFromColor(facts.barBg);
  const contrast = contrastRatio(facts.labelColor, facts.barBg) || contrastRatio(facts.labelColor, facts.labelBg);
  assert(facts.hasRoot, `Gill root present ${tag}`);
  assert(facts.hasBar, `Gill mobile bar present ${tag}`, facts);
  assert(facts.hasPartBtn, `Explicit Part TOC button present ${tag}`, facts);
  assert(facts.hasSeriesBtn, `Explicit Series TOC button present ${tag}`, facts);
  assert(facts.upgradedOldRoot, `Old/static Gill bar upgraded or native V3 bar present ${tag}`, facts);
  assert(facts.barPosition === 'fixed', `Bottom bar fixed ${tag}`, facts);
  assert(alpha >= 0.94, `Bottom bar background alpha >= .94 ${tag}`, { alpha, bg: facts.barBg });
  assert(facts.centerInsideBar, `Bottom bar center is controlled by bar, not article text ${tag}`, facts);
  assert(!facts.fallbackVisible, `No generic fallback controls over Gill mobile ${tag}`, facts);
  assert(facts.docWidth <= facts.viewportWidth + 1, `No horizontal overflow ${tag}`, facts);
  assert(facts.labelOpacity === null || facts.labelOpacity >= 0.85, `Mobile section label opacity readable ${tag}`, facts);
  assert(contrast === null || contrast >= 4.0, `Mobile section label contrast >= 4.0 ${tag}`, { contrast, color: facts.labelColor, bg: facts.barBg, labelBg: facts.labelBg });
  assert(!facts.articleIntersectsBar, `Article text does not run under bottom bar ${tag}`, facts.articleLeakCandidate || {});
  assert(/Оглавление части/.test(facts.barText), `Bottom bar exposes Part TOC label ${tag}`, facts);
  assert(/Серия/.test(facts.barText), `Bottom bar exposes Series label ${tag}`, facts);

  await page.click('#mobPartTocBtn');
  await page.waitForTimeout(250);
  const partOpen = await page.evaluate(() => {
    const el = document.querySelector('#partTocOverlay');
    if (!el) return null;
    const s = getComputedStyle(el);
    return { className: el.className, ariaHidden: el.getAttribute('aria-hidden'), display: s.display, opacity: s.opacity, visible: s.display !== 'none' && Number(s.opacity) > 0.5 };
  });
  assert(partOpen && partOpen.visible, `Part TOC opens from bottom bar ${tag}`, partOpen || {});

  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  await page.click('#mobTocBtn');
  await page.waitForTimeout(250);
  const seriesOpen = await page.evaluate(() => {
    const el = document.querySelector('#seriesTocOverlay');
    if (!el) return null;
    const s = getComputedStyle(el);
    return { className: el.className, ariaHidden: el.getAttribute('aria-hidden'), display: s.display, opacity: s.opacity, visible: s.display !== 'none' && Number(s.opacity) > 0.5 };
  });
  assert(seriesOpen && seriesOpen.visible, `Series TOC opens from bottom bar ${tag}`, seriesOpen || {});

  await context.close();
}

(async () => {
  let server = null;
  try {
    if (!BASE) {
      server = await serveDist();
      const address = server.address();
      BASE = `http://127.0.0.1:${address.port}`;
    }
    proof.base = BASE;

    const browser = await chromium.launch();
    for (const viewport of [{ width: 360, height: 740 }, { width: 390, height: 844 }]) {
      await runCase(browser, viewport, false);
      await runCase(browser, viewport, true);
    }
    await browser.close();
  } catch (err) {
    fail('fatal', { message: err.message, stack: err.stack });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(proof, null, 2));
    if (failures.length) {
      console.error(`\nGill mobile layout audit failed: ${failures.length} issue(s). See ${OUT}/summary.json`);
      process.exit(1);
    }
    console.log(`\nGill mobile layout audit passed. See ${OUT}/summary.json`);
  }
})();
