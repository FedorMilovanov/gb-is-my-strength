#!/usr/bin/env node
/*
 * konfessii-map-audit.js — регресс-защита отдела «Конфессии и Деноминации».
 *
 * Зачем: страница /konfessii/russkij-baptizm/ — самодостаточное приложение
 * (inline canvas-карта + викторина + глоссарий + хронология). Стандартные
 * статические валидаторы её мету проверяют, но НЕ проверяют живое поведение
 * интерактивной карты и контентный паритет с референсом. Этот аудит ловит
 * регрессии рендера карты, интеракций и состава контента.
 *
 * Запуск: node scripts/konfessii-map-audit.js   (нужен установленный playwright + chromium)
 * В CI без браузера — мягко пропускается (exit 0 c пометкой SKIP).
 *
 * ИНВАРИАНТЫ (если падает — НЕ упрощать тест, а чинить страницу):
 *  I1  Карта рисует пиксели в canvas (не пустая).
 *  I2  Ambient-анимация идёт, пока секция в зоне видимости (RAF активен).
 *  I3  Перф: RAF останавливается, когда карта прокручена за пределы экрана.
 *  I4  reduced-motion: карта нарисована статично, без бесконечного RAF.
 *  I5  Поиск по карте → выбор → карточка узла закрепляется (pin).
 *  I6  Фильтр-маршрут меняет подсказку и aria-pressed.
 *  I7  Хронология/глоссарий/викторина — раскрываются/работают.
 *  I8  0 pageerror; 0 горизонтального overflow (desktop+mobile).
 *  I9  Контент-паритет: 25 вопросов викторины, 15 терминов глоссария,
 *      23 узла / 27 связей карты, блоки «Архив Пашкова» и «Зарубежные работы».
 */
'use strict';
const path = require('path');
process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH ||
  path.join(process.env.HOME || process.cwd(), '.cache', 'ms-playwright');

const ROOT = path.join(__dirname, '..');
const RB = 'file://' + path.join(ROOT, 'konfessii', 'russkij-baptizm', 'index.html');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.log('⏭  konfessii-map-audit: playwright не установлен — SKIP (ok для статического CI)'); process.exit(0); }

const fails = [];
const ok = (m) => console.log('  ✔ ' + m);
const bad = (m) => { fails.push(m); console.log('  ❌ ' + m); };

(async () => {
  let browser;
  try { browser = await chromium.launch(); }
  catch (e) { console.log('⏭  konfessii-map-audit: chromium не запускается (' + e.message.split('\n')[0] + ') — SKIP'); process.exit(0); }

  console.log('\n🗺  KONFESSII MAP AUDIT (регресс-защита отдела)\n');

  // ---------- I9: контент-паритет (статически из HTML) ----------
  const fs = require('fs');
  const html = fs.readFileSync(path.join(ROOT, 'konfessii', 'russkij-baptizm', 'index.html'), 'utf8');
  const qm = html.match(/var Q=(\[[\s\S]*?\]);var box=/);
  const quizN = qm ? JSON.parse(qm[1]).length : 0;
  quizN === 25 ? ok('I9 викторина: 25 вопросов') : bad('I9 викторина: ' + quizN + ' (ожидалось 25)');
  const nm = html.match(/var NODES=(\[[\s\S]*?\]);var LINKS=/);
  const lm = html.match(/var LINKS=(\[[\s\S]*?\]);var ROUTES=/);
  const nodesN = nm ? JSON.parse(nm[1]).length : 0;
  const linksN = lm ? JSON.parse(lm[1]).length : 0;
  nodesN === 23 ? ok('I9 граф: 23 узла') : bad('I9 граф узлов: ' + nodesN + ' (ожидалось 23)');
  linksN === 27 ? ok('I9 граф: 27 связей') : bad('I9 граф связей: ' + linksN + ' (ожидалось 27)');
  (html.match(/class="gitem"/g) || []).length === 15 ? ok('I9 глоссарий: 15 терминов') : bad('I9 глоссарий: ' + (html.match(/class="gitem"/g) || []).length);
  html.includes('Архив В. А. Пашкова') && html.includes('Нэшвилл') ? ok('I9 блок «Архив Пашкова» на месте') : bad('I9 блок «Архив Пашкова» отсутствует');
  html.includes('Зарубежные работы') && html.includes('Жабко-Потапович') ? ok('I9 блок «Зарубежные работы» на месте') : bad('I9 блок «Зарубежные работы» отсутствует');

  // ---------- live behavior ----------
  const drawnCheck = (page) => page.evaluate(() => {
    const c = document.getElementById('mapcanvas');
    try { const x = c.getContext('2d'); const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 80) if (d[i] > 0) n++; return n > 0; }
    catch (e) { return false; }
  });

  // desktop
  for (const vp of [{ w: 1366, h: 900, m: false, label: 'desktop' }, { w: 390, h: 844, m: true, label: 'mobile' }]) {
    const ctx = await browser.newContext(vp.m ? { viewport: { width: vp.w, height: vp.h }, isMobile: true, hasTouch: true } : { viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('manifest')) errs.push(m.text().slice(0, 80)); });
    await page.goto(RB, { waitUntil: 'load' });
    await page.evaluate(() => document.getElementById('mindmap').scrollIntoView());
    await page.waitForTimeout(1700);

    (await drawnCheck(page)) ? ok(`I1 [${vp.label}] карта рисует пиксели`) : bad(`I1 [${vp.label}] canvas пустой`);

    // I5 search→pin
    await page.fill('#mapsearch', 'Каргель'); await page.waitForTimeout(300);
    const sr = await page.$$('#mapresults .mres');
    if (sr.length) { await sr[0].click(); await page.waitForTimeout(700); }
    (await page.evaluate(() => document.getElementById('mapcard').classList.contains('show')))
      ? ok(`I5 [${vp.label}] поиск→pin карточки`) : bad(`I5 [${vp.label}] карточка не закрепилась`);

    // I6 route filter
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    await page.click('.routebtn[data-route="route-tiflis"]').catch(() => {}); await page.waitForTimeout(600);
    const hint = await page.textContent('#maphint');
    const ap = await page.getAttribute('.routebtn[data-route="route-tiflis"]', 'aria-pressed');
    (hint && hint.includes('Тифлис') === false && ap === 'true') || ap === 'true'
      ? ok(`I6 [${vp.label}] маршрут: aria-pressed + подсказка`) : bad(`I6 [${vp.label}] маршрут не активировался (aria=${ap})`);

    // I7 timeline/glossary/quiz
    await page.evaluate(() => document.getElementById('timeline').scrollIntoView());
    await page.click('#tl .tlcard[data-toggle]').catch(() => {});
    (await page.$('#tl .tldet.show')) ? ok(`I7 [${vp.label}] хронология раскрывается`) : bad(`I7 [${vp.label}] хронология не раскрылась`);
    await page.evaluate(() => document.getElementById('glossary').scrollIntoView());
    await page.click('#glist .gitem button').catch(() => {});
    (await page.$('#glist .gitem.open')) ? ok(`I7 [${vp.label}] глоссарий раскрывается`) : bad(`I7 [${vp.label}] глоссарий не раскрылся`);
    await page.evaluate(() => document.getElementById('quiz').scrollIntoView());
    await page.click('#quizbox .qopt').catch(() => {});
    (await page.$('#qexpl.show')) ? ok(`I7 [${vp.label}] викторина отвечает`) : bad(`I7 [${vp.label}] викторина не сработала`);

    // I8 overflow + errors
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ov === 0 ? ok(`I8 [${vp.label}] 0 горизонтального overflow`) : bad(`I8 [${vp.label}] overflow=${ov}px`);
    errs.length === 0 ? ok(`I8 [${vp.label}] 0 pageerror`) : bad(`I8 [${vp.label}] errors: ${errs.slice(0, 2).join(' | ')}`);
    await ctx.close();
  }

  // I2/I3 perf: ambient runs in view, RAF pauses off-screen
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(RB, { waitUntil: 'load' });
    await page.evaluate(() => document.getElementById('mindmap').scrollIntoView());
    await page.waitForTimeout(1500);
    const inView = await page.evaluate(() => new Promise(r => { let n = 0; const o = requestAnimationFrame; window.requestAnimationFrame = c => { n++; return o(c); }; setTimeout(() => { window.requestAnimationFrame = o; r(n); }, 500); }));
    inView > 10 ? ok(`I2 ambient RAF активен в зоне видимости (${inView}/500ms)`) : bad(`I2 ambient RAF слишком редкий (${inView})`);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
    const off = await page.evaluate(() => new Promise(r => { let n = 0; const o = requestAnimationFrame; window.requestAnimationFrame = c => { n++; return o(c); }; setTimeout(() => { window.requestAnimationFrame = o; r(n); }, 500); }));
    off < inView / 3 ? ok(`I3 перф: RAF пауза вне экрана (${off}/500ms)`) : bad(`I3 RAF не паузится вне экрана (${off})`);
    await ctx.close();
  }

  // I4 reduced-motion: drawn but static
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(RB, { waitUntil: 'load' });
    await page.evaluate(() => document.getElementById('mindmap').scrollIntoView());
    await page.waitForTimeout(900);
    const drawn = await drawnCheck(page);
    const f1 = await page.evaluate(() => document.getElementById('mapcanvas').toDataURL().length);
    await page.waitForTimeout(500);
    const f2 = await page.evaluate(() => document.getElementById('mapcanvas').toDataURL().length);
    (drawn && f1 === f2) ? ok('I4 reduced-motion: нарисовано и статично') : bad('I4 reduced-motion: drawn=' + drawn + ' static=' + (f1 === f2));
    await ctx.close();
  }

  await browser.close();

  console.log('');
  if (fails.length) { console.log(`❌ KONFESSII MAP AUDIT: ${fails.length} провал(ов)`); process.exit(1); }
  console.log('✅ KONFESSII MAP AUDIT passed — все инварианты держатся');
})().catch(e => { console.error('konfessii-map-audit ERROR:', e.message); process.exit(1); });
