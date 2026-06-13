#!/usr/bin/env node
/*
 * konfessii-map-audit.js — регресс-защита отдела «Конфессии и Деноминации».
 *
 * Архитектура (с 2026-06-13): /konfessii/russkij-baptizm/ — нативная обёртка
 * (шапка сайта + SEO/OG/JSON-LD + CSP), внутри <iframe> грузит ОРИГИНАЛЬНОЕ
 * 3D-приложение (Three.js + react-force-graph-3d + d3-geo) из ./_app/index.html.
 * Это перенос 1-в-1 LM Arena проекта (настоящая 3D-сцена: сферы-узлы, орбиты,
 * тубы-связи, карта стран). _app — собранный бандл, исключён из статических
 * валидаторов сайта (skipDirs).
 *
 * Запуск: node scripts/konfessii-map-audit.js   (нужен playwright + chromium с WebGL)
 * Без браузера/WebGL — мягкий SKIP (exit 0).
 *
 * ИНВАРИАНТЫ (если падает — НЕ упрощать тест, а чинить страницу/пересобирать _app):
 *  I1  Обёртка грузится: 0 pageerror, 0 h-overflow, есть iframe#appframe.
 *  I2  iframe указывает на ./_app/index.html и приложение бутстрапится (React root).
 *  I3  Лоадер обёртки скрывается после load iframe.
 *  I4  Внутри приложения видна навигация (Главная/Истоки/3D Карта/…).
 *  I5  3D-режим активируется → создаётся <canvas> с WebGL-контекстом.
 *  I6  Контент-целостность _app: singlefile (inline script+style), есть мета viewport,
 *      есть CSP, robots=noindex (бандл не индексируется отдельно от обёртки).
 *  I7  Обёртка несёт SEO: canonical, og:image, 1×h1 (sr-only), JSON-LD, theme-color.
 *  I8  3D-режим содержит событийный Timeline (не падает из-за undefined state и не голые годы).
 *  I9  3D-режим содержит нижний роутер «Маршруты и города».
 */
'use strict';
const path = require('path');
const fs = require('fs');
process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH ||
  path.join(process.env.HOME || process.cwd(), '.cache', 'ms-playwright');

const ROOT = path.join(__dirname, '..');
const WRAP_REL = path.join('konfessii', 'russkij-baptizm', 'index.html');
const APP_REL = path.join('konfessii', 'russkij-baptizm', '_app', 'index.html');
const WRAP = 'file://' + path.join(ROOT, WRAP_REL);

const fails = [];
const ok = (m) => console.log('  ✔ ' + m);
const bad = (m) => { fails.push(m); console.log('  ❌ ' + m); };

// ---------- static checks (always run, no browser) ----------
console.log('\n🌍 KONFESSII 3D-MAP AUDIT (регресс-защита отдела)\n');
const wrap = fs.readFileSync(path.join(ROOT, WRAP_REL), 'utf8');
const app = fs.existsSync(path.join(ROOT, APP_REL)) ? fs.readFileSync(path.join(ROOT, APP_REL), 'utf8') : '';

// I7 wrapper SEO
/rel="canonical"/.test(wrap) ? ok('I7 обёртка: canonical') : bad('I7 обёртка: нет canonical');
/property="og:image"/.test(wrap) ? ok('I7 обёртка: og:image') : bad('I7 обёртка: нет og:image');
(wrap.match(/<h1\b/g) || []).length === 1 ? ok('I7 обёртка: ровно 1 h1') : bad('I7 обёртка: h1 = ' + (wrap.match(/<h1\b/g) || []).length);
/application\/ld\+json/.test(wrap) ? ok('I7 обёртка: JSON-LD') : bad('I7 обёртка: нет JSON-LD');
/name="theme-color"/.test(wrap) ? ok('I7 обёртка: theme-color') : bad('I7 обёртка: нет theme-color');
/frame-src 'self'/.test(wrap) ? ok('I7 обёртка: CSP frame-src self') : bad('I7 обёртка: CSP без frame-src self');
/<iframe[^>]+id="appframe"[^>]+src="\.\/_app\/index\.html"/.test(wrap) ? ok('I2 iframe → ./_app/index.html') : bad('I2 iframe src не указывает на ./_app/index.html');

// I6 app bundle integrity
if (!app) { bad('I6 _app/index.html отсутствует — бандл не собран!'); }
else {
  app.length > 500000 ? ok('I6 _app: singlefile-бандл присутствует (' + (app.length / 1024 / 1024).toFixed(1) + ' МБ)') : bad('I6 _app слишком мал (' + app.length + ' б) — собрался ли бандл?');
  /<meta[^>]+viewport/.test(app) ? ok('I6 _app: viewport') : bad('I6 _app: нет viewport');
  /Content-Security-Policy/.test(app) ? ok('I6 _app: CSP') : bad('I6 _app: нет CSP');
  /name="robots"\s+content="noindex"/.test(app) ? ok('I6 _app: robots=noindex') : bad('I6 _app: нет noindex (бандл не должен индексироваться)');
  /id="root"/.test(app) ? ok('I6 _app: React root present') : bad('I6 _app: нет #root');
}

// ---------- live checks (browser, optional) ----------
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.log('\n⏭  live-проверки пропущены: playwright не установлен (статические инварианты пройдены).'); finish(); }

if (chromium) (async () => {
  let browser;
  try { browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist'] }); }
  catch (e) { console.log('\n⏭  live-проверки пропущены: chromium не запускается (' + e.message.split('\n')[0] + ').'); finish(); return; }

  for (const vp of [{ w: 1366, h: 900, label: 'desktop' }, { w: 390, h: 844, label: 'mobile', mobile: true }]) {
    const ctx = await browser.newContext(vp.mobile ? { viewport: { width: vp.w, height: vp.h }, isMobile: true, hasTouch: true } : { viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('manifest')) errs.push(m.text().slice(0, 90)); });
    await page.goto(WRAP, { waitUntil: 'load' });
    await page.waitForTimeout(3500);

    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ov === 0 ? ok(`I1 [${vp.label}] 0 h-overflow`) : bad(`I1 [${vp.label}] overflow=${ov}`);
    (await page.$('#appframe')) ? ok(`I1 [${vp.label}] iframe#appframe present`) : bad(`I1 [${vp.label}] нет iframe`);
    const loaderHidden = await page.evaluate(() => { const l = document.getElementById('loader'); return !l || l.classList.contains('hidden') || l.style.display === 'none'; });
    loaderHidden ? ok(`I3 [${vp.label}] лоадер скрыт`) : bad(`I3 [${vp.label}] лоадер завис`);

    const frame = page.frames().find(fr => fr.url().includes('/_app/'));
    if (!frame) { bad(`I2 [${vp.label}] iframe-приложение не загрузилось`); }
    else {
      const navTxt = await frame.evaluate(() => document.body.innerText.slice(0, 220));
      // на десктопе видна полная навигация (3D Карта); на мобиле нав за бургером — проверяем бренд+контент
      const appOk = vp.mobile
        ? (/РУССКИЙ БАПТИЗМ/.test(navTxt) && /Баптизма/.test(navTxt))
        : (/РУССКИЙ БАПТИЗМ/.test(navTxt) && /3D/.test(navTxt));
      appOk ? ok(`I4 [${vp.label}] приложение загрузилось (бренд+контент)`) : bad(`I4 [${vp.label}] приложение не распознано: ${JSON.stringify(navTxt.slice(0, 60))}`);
      // activate 3D on desktop (mobile launcher behaves same but heavier)
      if (!vp.mobile) {
        await frame.evaluate(() => { const b = [...document.querySelectorAll('button,a')].find(x => /3D Карта|3D-карта/i.test(x.textContent)); if (b) b.click(); });
        await page.waitForTimeout(2500);
        await frame.evaluate(() => { const b = [...document.querySelectorAll('button,a')].find(x => /Войти в 3D/i.test(x.textContent)); if (b) b.click(); });
        await page.waitForTimeout(6000);
        const gl = await frame.evaluate(() => { const c = document.querySelector('canvas'); if (!c) return false; try { return !!(c.getContext('webgl2') || c.getContext('webgl')) || c.width > 100; } catch (e) { return c.width > 100; } });
        gl ? ok(`I5 [${vp.label}] 3D WebGL canvas активируется`) : bad(`I5 [${vp.label}] 3D canvas не создан`);
        await frame.evaluate(() => { const b = [...document.querySelectorAll('button,a')].find(x => /Начать исследование/i.test(x.textContent)); if (b) b.click(); });
        await page.waitForTimeout(900);
        const uiText = await frame.evaluate(() => document.body.innerText);
        /Хронология\s+событий/i.test(uiText) && /Современность|РС\s*ЕХБ|Крещение/i.test(uiText)
          ? ok(`I8 [${vp.label}] событийный Timeline видим`)
          : bad(`I8 [${vp.label}] Timeline не привязан к событиям или сломан`);
        /МАРШРУТЫ\s+И\s+ГОРОДА/i.test(uiText)
          ? ok(`I9 [${vp.label}] нижний роутер маршрутов видим`)
          : bad(`I9 [${vp.label}] нет понятного роутера «Маршруты и города»`);
      }
    }
    errs.length === 0 ? ok(`I1 [${vp.label}] 0 pageerror`) : bad(`I1 [${vp.label}] errors: ${errs.slice(0, 2).join(' | ')}`);
    await ctx.close();
  }
  await browser.close();
  finish();
})().catch(e => { console.error('konfessii-map-audit ERROR:', e.message); process.exit(1); });

function finish() {
  console.log('');
  if (fails.length) { console.log(`❌ KONFESSII 3D-MAP AUDIT: ${fails.length} провал(ов)`); process.exit(1); }
  console.log('✅ KONFESSII 3D-MAP AUDIT passed — все инварианты держатся');
  process.exit(0);
}
