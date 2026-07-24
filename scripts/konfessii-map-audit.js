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
 * После production-like build браузерные проверки обязаны идти через локальный HTTP,
 * а не file://: только так реально исполняются CSP frame-src 'self', относительные URL
 * и тот же origin-контракт, что на GitHub Pages.
 * Без браузера/WebGL — мягкий SKIP (exit 0), если CI явно не требует browser-run.
 *
 * ИНВАРИАНТЫ (если падает — НЕ упрощать тест, а чинить страницу/пересобирать _app):
 *  I1  Обёртка грузится: 0 pageerror, 0 overflow, есть iframe#appframe.
 *  I2  iframe указывает на ./_app/index.html и приложение бутстрапится (React root).
 *  I3  Лоадер обёртки скрывается после load iframe.
 *  I4  Внутри приложения видна навигация (Главная/Истоки/3D Карта/…).
 *  I5  3D-режим активируется → создаётся <canvas> с WebGL-контекстом.
 *  I6  Контент-целостность _app: singlefile (inline script+style), есть мета viewport,
 *      есть CSP, robots=noindex (бандл не индексируется отдельно от обёртки).
 *  I7  Обёртка несёт SEO: canonical, og:image, 1×h1 (sr-only), JSON-LD, theme-color.
 *  I8  3D-режим содержит событийный Timeline (не падает из-за undefined state и не голые годы).
 *  I9  3D-режим содержит нижний роутер «Маршруты и города».
 *  I10 3D-режим содержит тихий learning coach «Как читать карту» для первого входа.
 *  I11 3D-режим не возвращает нативные белые title-tooltip на Timeline и не даёт document-scrollbar мешать zoom.
 *  I14 Физика 3D не откатывается к jitter/tension constants (drag должен быть мягким).
 *  I15 SEO-fallback живёт только в noscript, а stage/iframe занимают весь остаток viewport
 *      на desktop, Android- и iPhone-подобных размерах без внешних полос прокрутки.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH ||
  path.join(process.env.HOME || process.cwd(), '.cache', 'ms-playwright');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const WRAP_REL = path.join('konfessii', 'russkij-baptizm', 'index.html');
const APP_REL = path.join('konfessii', 'russkij-baptizm', '_app', 'index.html');
const SRC_REL = path.join('_build-tools', 'konfessii-baptizm', 'MindMap3D.tsx');
const NAV_SRC_REL = path.join('_build-tools', 'konfessii-baptizm', 'Navigation.tsx');
const NATIVE_BODY_REL = path.join('src', 'components', 'konfessii', 'russkij-baptizm', 'Baptizm3DBody.astro');
const NATIVE_STYLE_REL = path.join('src', 'components', 'konfessii', 'russkij-baptizm', 'Baptizm3DStyles.astro');
const REQUIRE_DIST = process.env.KONFESSII_AUDIT_REQUIRE_DIST === '1';
const REQUIRE_BROWSER = process.env.KONFESSII_AUDIT_REQUIRE_BROWSER === '1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

const fails = [];
const ok = (m) => console.log('  ✔ ' + m);
const bad = (m) => { fails.push(m); console.log('  ❌ ' + m); };

function withoutNoscript(source) {
  return source.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '');
}

function chooseLiveRoot() {
  const explicit = process.env.KONFESSII_AUDIT_ROOT;
  if (explicit) return path.resolve(explicit);
  const distWrap = path.join(DIST, WRAP_REL);
  if (fs.existsSync(distWrap)) return DIST;
  if (REQUIRE_DIST) throw new Error(`production-like dist is required but missing: ${distWrap}`);
  return ROOT;
}

function startStaticServer(rootDir) {
  const absoluteRoot = path.resolve(rootDir);
  const server = http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname);
      let rel = pathname.replace(/^\/+/, '');
      if (!rel || pathname.endsWith('/')) rel = path.join(rel, 'index.html');
      const file = path.resolve(absoluteRoot, rel);
      if (file !== absoluteRoot && !file.startsWith(absoluteRoot + path.sep)) {
        res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('forbidden');
        return;
      }
      const body = fs.readFileSync(file);
      res.writeHead(200, {
        'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, base: `http://127.0.0.1:${address.port}` });
    });
  });
}

// ---------- static checks (always run, no browser) ----------
console.log('\n🌍 KONFESSII 3D-MAP AUDIT (регресс-защита отдела)\n');
const wrap = fs.readFileSync(path.join(ROOT, WRAP_REL), 'utf8');
const app = fs.existsSync(path.join(ROOT, APP_REL)) ? fs.readFileSync(path.join(ROOT, APP_REL), 'utf8') : '';
const src = fs.existsSync(path.join(ROOT, SRC_REL)) ? fs.readFileSync(path.join(ROOT, SRC_REL), 'utf8') : '';
const navSrc = fs.existsSync(path.join(ROOT, NAV_SRC_REL)) ? fs.readFileSync(path.join(ROOT, NAV_SRC_REL), 'utf8') : '';
const nativeBody = fs.existsSync(path.join(ROOT, NATIVE_BODY_REL)) ? fs.readFileSync(path.join(ROOT, NATIVE_BODY_REL), 'utf8') : '';
const nativeStyles = fs.existsSync(path.join(ROOT, NATIVE_STYLE_REL)) ? fs.readFileSync(path.join(ROOT, NATIVE_STYLE_REL), 'utf8') : '';

// I7 wrapper SEO
/rel="canonical"/.test(wrap) ? ok('I7 обёртка: canonical') : bad('I7 обёртка: нет canonical');
/property="og:image"/.test(wrap) ? ok('I7 обёртка: og:image') : bad('I7 обёртка: нет og:image');
(wrap.match(/<h1\b/g) || []).length === 1 ? ok('I7 обёртка: ровно 1 h1') : bad('I7 обёртка: h1 = ' + (wrap.match(/<h1\b/g) || []).length);
/application\/ld\+json/.test(wrap) ? ok('I7 обёртка: JSON-LD') : bad('I7 обёртка: нет JSON-LD');
/name="theme-color"/.test(wrap) ? ok('I7 обёртка: theme-color') : bad('I7 обёртка: нет theme-color');
/frame-src 'self'/.test(wrap) ? ok('I7 обёртка: CSP frame-src self') : bad('I7 обёртка: CSP без frame-src self');
/<iframe[^>]+id="appframe"[^>]+src="\.\/_app\/index\.html"/.test(wrap) ? ok('I2 iframe → ./_app/index.html') : bad('I2 iframe src не указывает на ./_app/index.html');

// I15 shell/layout source contract: the SEO prose must never become a visible flex sibling.
for (const [label, source] of [['legacy', wrap], ['native', nativeBody]]) {
  const noscriptHasSeo = /<noscript\b[^>]*>[\s\S]*?Три истока русского баптизма[\s\S]*?<\/noscript>/i.test(source);
  const visibleHasSeo = /Три истока русского баптизма/.test(withoutNoscript(source));
  noscriptHasSeo ? ok(`I15 ${label}: SEO fallback находится внутри noscript`) : bad(`I15 ${label}: SEO fallback отсутствует внутри noscript`);
  !visibleHasSeo ? ok(`I15 ${label}: SEO prose не участвует в JS-layout`) : bad(`I15 ${label}: SEO prose остался видимым flex-соседом`);
  !/#fafaf9|#e7e5e4/.test(source) ? ok(`I15 ${label}: белые fallback-карточки удалены`) : bad(`I15 ${label}: остались светлые hardcoded-карточки`);
}
/flex:\s*1\s+1\s+0/.test(nativeStyles) && /\.stage\{[^}]*min-width:\s*0[^}]*min-height:\s*0[^}]*overflow:\s*hidden/.test(nativeStyles)
  ? ok('I15 native styles: stage защищён от flex-shrink/overflow')
  : bad('I15 native styles: stage viewport contract отсутствует');
/@supports\s*\(height:\s*100dvh\)/.test(nativeStyles)
  ? ok('I15 native styles: dynamic mobile viewport поддержан')
  : bad('I15 native styles: нет 100dvh mobile viewport fallback');

// I6 app bundle integrity
if (!app) { bad('I6 _app/index.html отсутствует — бандл не собран!'); }
else {
  app.length > 500000 ? ok('I6 _app: singlefile-бандл присутствует (' + (app.length / 1024 / 1024).toFixed(1) + ' МБ)') : bad('I6 _app слишком мал (' + app.length + ' б) — собрался ли бандл?');
  /<meta[^>]+viewport/.test(app) ? ok('I6 _app: viewport') : bad('I6 _app: нет viewport');
  /Content-Security-Policy/.test(app) ? ok('I6 _app: CSP') : bad('I6 _app: нет CSP');
  /name="robots"\s+content="noindex"/.test(app) ? ok('I6 _app: robots=noindex') : bad('I6 _app: нет noindex (бандл не должен индексироваться)');
  /id="root"/.test(app) ? ok('I6 _app: React root present') : bad('I6 _app: нет #root');
  /66\.7K|66 732/.test(app) && !/~144K/.test(app)
    ? ok('I12 _app: modern RSEHB statistic updated from research dossier')
    : bad('I12 _app: outdated ~144K statistic or missing BWA 66 732 update');
  /04\.01\.1919/.test(app) && /Военный вопрос|ОГПУ|Братский Вестник/.test(app)
    ? ok('I12 _app: persecution/conscience timeline events present')
    : bad('I12 _app: new persecution/conscience timeline events missing');
  /1963/.test(app) && /Устав ВСЕХБ|Вестник спасения/.test(app) && /майская делегация|ЦК КПСС/.test(app) && /Совет родственников/.test(app) && /Христианин|Косыгин|Вестник истины/.test(app)
    ? ok('I12 _app: initiative/samizdat timeline events present')
    : bad('I12 _app: initiative/samizdat timeline events missing');
  /Иван Моисеев/.test(app) && /Печатники «Христианина»/.test(app) && /Донченко|психбольницы|отобрание детей/.test(app)
    ? ok('I12 _app: relatives-bulletin events present')
    : bad('I12 _app: relatives-bulletin events missing');
  /Георгий Слесарев/.test(app) && /Иван Шилов/.test(app) && /Николай Хмара/.test(app)
    ? ok('I12 _app: persecution case-index events present')
    : bad('I12 _app: persecution case-index events missing');
  /sourceLevel/.test(app) && /articleKey/.test(app) && /nodeId/.test(app)
    ? ok('I13 _app: timeline carries data-driven article/node metadata')
    : bad('I13 _app: timeline metadata fields missing');
  /Связанная статья/.test(app) && /Открыть статью/.test(app) && /baptisty-rossii\//.test(app)
    ? ok('I13 _app: article previews are wired into timeline/dossier')
    : bad('I13 _app: article previews missing from 3D UI');
  /d3AlphaDecay:\.0165,d3VelocityDecay:\.24,warmupTicks:150,cooldownTicks:220,cooldownTime:7e3/.test(app)
    ? ok('I14 _app: calm idle physics constants present')
    : bad('I14 _app: physics constants откатились к jitter values');
  /strength\*1\.28/.test(app) && /d3AlphaTarget\(\.16\)\.resetCountdown\(\)/.test(app) && /d3AlphaTarget\?\.\(\.1\)/.test(app)
    ? ok('I14 _app: soft anchor/drag alpha constants present')
    : bad('I14 _app: drag/anchor constants too aggressive or missing');
  /d3AlphaDecay:\.0115|warmupTicks:140|cooldownTicks:260|cooldownTime:9e3/.test(app)
    ? bad('I14 _app: old jitter-prone constants returned')
    : ok('I14 _app: old jitter-prone constants absent');
}

// source-level guard for the regression fixed in 7850e0f: ref-based TimelineOverlay must
// not coexist with the removed useState timelineYear/setTimelineYear JSX block.
if (navSrc) {
  /max-w-\[82rem\]/.test(navSrc) && /whitespace-nowrap/.test(navSrc) && !/max-w-6xl/.test(navSrc)
    ? ok('I11 source: top navigation anti-overlap sizing present')
    : bad('I11 source: top navigation may overlap brand/items');
}

if (src) {
  /function\s+TimelineOverlay/.test(src) && /timelineYearRef/.test(src)
    ? ok('I8 source: ref-based TimelineOverlay present')
    : bad('I8 source: TimelineOverlay/timelineYearRef missing');
  /setTimelineYear\b|\btimelineYear\s*\?\?/.test(src)
    ? bad('I8 source: stale timelineYear/setTimelineYear references remain (runtime crash risk)')
    : ok('I8 source: no stale timelineYear state references');
  (src.match(/<TimelineOverlay\b/g) || []).length === 1
    ? ok('I8 source: TimelineOverlay mounted exactly once')
    : bad('I8 source: TimelineOverlay mount count = ' + (src.match(/<TimelineOverlay\b/g) || []).length);
  /onEventSelect=\{handleTimelineEventSelect\}/.test(src) && /aria-label=\{`Перейти к событию/.test(src) && /TIMELINE_TARGETS/.test(src)
    ? ok('I8 source: timeline ticks are clickable and focus-aware')
    : bad('I8 source: timeline ticks are not wired to graph focus');
  /findMapSelectionForNode/.test(src) && /setMapSelection\(selection\)/.test(src)
    ? ok('I8 source: timeline events synchronize map selection')
    : bad('I8 source: timeline events do not synchronize map selection');
  /timelineTicks/.test(src) && /visibleTimelineTicks/.test(src) && /hoveredTick/.test(src) && /timelineTicks\.filter\(\(tick\) => tick\.major\)/.test(src) && !/title=\{`\$\{evt\.year\}:/.test(src)
    ? ok('I8 source: timeline ticks are landmark-only and avoid native title tooltips')
    : bad('I8 source: timeline ticks are noisy or use native title tooltips');
  !/<(?:motion\.)?button[^>]+\s+title=/.test(src) && /displayEvent && !bottomBarExpanded/.test(src)
    ? ok('I11 source: native button title tooltips removed and timeline card avoids route panel')
    : bad('I11 source: native button title tooltips or timeline stacking regression');
  /fill=\{exact && focus \? `\$\{focus\.color\}14`/.test(src) && /opacity=\{exact \? 0\.48/.test(src)
    ? ok('I8 source: map highlight intensity is restrained')
    : bad('I8 source: map highlight may overpower 3D scene');
  /html\.style\.overflow = 'hidden'/.test(src) && /body\.style\.overflow = 'hidden'/.test(src) && /onWheelCapture=\{handleSceneWheel\}/.test(src)
    ? ok('I5 source: 3D fullscreen locks document scroll and captures wheel')
    : bad('I5 source: 3D fullscreen does not lock document scroll/wheel');
  /interactiveHit/.test(src) && /child\.raycast = \(\) => undefined/.test(src)
    ? ok('I5 source: decorative node geometry does not block raycast clicks')
    : bad('I5 source: decorative geometry may block node clicks');
  /onRouteStepTo=\{handleRouteStepTo\}/.test(src) && /Нажмите этап/.test(src)
    ? ok('I9 source: route step chips are clickable')
    : bad('I9 source: route step chips are not clickable');
  /Сейчас в маршруте/.test(src) && /transitionLink/.test(src)
    ? ok('I9 source: active route has storyboard context')
    : bad('I9 source: active route storyboard context missing');
  /function\s+LearningCoach/.test(src) && /Как читать карту/.test(src) && /showLearningCoach/.test(src)
    ? ok('I10 source: first-run learning coach present')
    : bad('I10 source: learning coach missing (onboarding regression risk)');
  /ARTICLE_PREVIEWS/.test(src) && /Связанная статья/.test(src) && /getArticleForEvent/.test(src)
    ? ok('I13 source: article preview cards wired')
    : bad('I13 source: article preview cards missing');
  /event\?\.nodeId/.test(src) && /event\?\.routeId/.test(src) && /event\?\.mapSelectionId/.test(src)
    ? ok('I13 source: Timeline prefers data-driven metadata before regex fallback')
    : bad('I13 source: Timeline still lacks data-driven metadata preference');
  /anchor\.strength \* 1\.28 \* alpha/.test(src) && /d3AlphaDecay=\{0\.0165\} d3VelocityDecay=\{0\.24\}/.test(src) && /warmupTicks=\{150\} cooldownTicks=\{220\} cooldownTime=\{7000\}/.test(src)
    ? ok('I14 source: calm idle physics constants present')
    : bad('I14 source: calm physics constants missing');
  /d3VelocityDecay\?\.\(0\.26\)/.test(src) && /d3AlphaTarget\?\.\(0\.10\)/.test(src) && /\* 0\.006/.test(src)
    ? ok('I14 source: soft rubber drag/release constants present')
    : bad('I14 source: rubber drag constants too tense/bouncy or missing');
}

// ---------- live checks (browser, optional) ----------
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) {
  if (REQUIRE_BROWSER) {
    console.error('\n❌ playwright обязателен для этого CI-run: ' + e.message);
    process.exit(1);
  }
  console.log('\n⏭  live-проверки пропущены: playwright не установлен (статические инварианты пройдены).');
  finish();
}

if (chromium) (async () => {
  const liveRoot = chooseLiveRoot();
  const { server, base } = await startStaticServer(liveRoot);
  const wrapUrl = `${base}/konfessii/russkij-baptizm/`;
  console.log(`\n  ℹ browser source: ${path.relative(ROOT, liveRoot) || '.'} → ${wrapUrl}`);

  let browser;
  try {
    browser = await chromium.launch({
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });
  } catch (e) {
    await new Promise((resolve) => server.close(resolve));
    if (REQUIRE_BROWSER) {
      console.error('\n❌ chromium обязателен для этого CI-run: ' + e.message.split('\n')[0]);
      process.exit(1);
    }
    console.log('\n⏭  live-проверки пропущены: chromium не запускается (' + e.message.split('\n')[0] + ').');
    finish();
    return;
  }

  const viewports = [
    { w: 1366, h: 900, label: 'desktop' },
    { w: 430, h: 932, label: 'android-430', mobile: true },
    { w: 390, h: 844, label: 'iphone-390', mobile: true },
    { w: 360, h: 800, label: 'android-360', mobile: true },
    { w: 320, h: 760, label: 'mobile-320', mobile: true },
  ];

  for (const vp of viewports) {
    const ctx = await browser.newContext(vp.mobile ? {
      viewport: { width: vp.w, height: vp.h },
      isMobile: true,
      hasTouch: true,
    } : { viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('manifest')) errs.push(m.text().slice(0, 140)); });
    const response = await page.goto(wrapUrl, { waitUntil: 'load', timeout: 30000 });
    response?.status() === 200 ? ok(`I1 [${vp.label}] wrapper HTTP 200`) : bad(`I1 [${vp.label}] wrapper HTTP status=${response?.status() || 'none'}`);
    await page.waitForTimeout(3500);

    const shell = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      const bar = document.querySelector('.bar');
      const stage = document.querySelector('.stage');
      const iframe = document.getElementById('appframe');
      const barRect = bar?.getBoundingClientRect();
      const stageRect = stage?.getBoundingClientRect();
      const frameRect = iframe?.getBoundingClientRect();
      const seoVisible = [...document.querySelectorAll('h2')].some((node) => {
        if (!/Три истока русского баптизма/.test(node.textContent || '')) return false;
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      });
      return {
        horizontalOverflow: Math.max(html.scrollWidth, body.scrollWidth) - html.clientWidth,
        verticalOverflow: Math.max(html.scrollHeight, body.scrollHeight) - html.clientHeight,
        viewport: { width: innerWidth, height: innerHeight },
        bar: barRect ? { top: barRect.top, bottom: barRect.bottom, height: barRect.height } : null,
        stage: stageRect ? { left: stageRect.left, top: stageRect.top, right: stageRect.right, bottom: stageRect.bottom, width: stageRect.width, height: stageRect.height } : null,
        frame: frameRect ? { left: frameRect.left, top: frameRect.top, right: frameRect.right, bottom: frameRect.bottom, width: frameRect.width, height: frameRect.height } : null,
        seoVisible,
      };
    });

    shell.horizontalOverflow <= 1 ? ok(`I1 [${vp.label}] 0 h-overflow`) : bad(`I1 [${vp.label}] h-overflow=${shell.horizontalOverflow}`);
    shell.verticalOverflow <= 1 ? ok(`I15 [${vp.label}] 0 outer vertical overflow`) : bad(`I15 [${vp.label}] outer v-overflow=${shell.verticalOverflow}`);
    !shell.seoVisible ? ok(`I15 [${vp.label}] SEO fallback не виден при JS`) : bad(`I15 [${vp.label}] SEO fallback видим поверх приложения`);
    const expectedStageHeight = shell.viewport.height - (shell.bar?.bottom || 0);
    const stageFits = shell.stage && shell.stage.width >= shell.viewport.width - 2 && shell.stage.height >= expectedStageHeight - 2 && shell.stage.bottom <= shell.viewport.height + 2;
    stageFits ? ok(`I15 [${vp.label}] stage заполняет viewport (${Math.round(shell.stage.height)}px)`) : bad(`I15 [${vp.label}] stage geometry=${JSON.stringify(shell.stage)} expectedHeight≈${Math.round(expectedStageHeight)}`);
    const frameFits = shell.stage && shell.frame && Math.abs(shell.frame.left - shell.stage.left) <= 1 && Math.abs(shell.frame.top - shell.stage.top) <= 1 && Math.abs(shell.frame.width - shell.stage.width) <= 1 && Math.abs(shell.frame.height - shell.stage.height) <= 1;
    frameFits ? ok(`I15 [${vp.label}] iframe совпадает со stage`) : bad(`I15 [${vp.label}] iframe/stage mismatch frame=${JSON.stringify(shell.frame)} stage=${JSON.stringify(shell.stage)}`);
    (await page.$('#appframe')) ? ok(`I1 [${vp.label}] iframe#appframe present`) : bad(`I1 [${vp.label}] нет iframe`);
    const loaderHidden = await page.evaluate(() => { const l = document.getElementById('loader'); return !l || l.classList.contains('hidden') || l.style.display === 'none'; });
    loaderHidden ? ok(`I3 [${vp.label}] лоадер скрыт`) : bad(`I3 [${vp.label}] лоадер завис`);

    const frame = page.frames().find(fr => fr.url().includes('/_app/'));
    if (!frame) { bad(`I2 [${vp.label}] iframe-приложение не загрузилось`); }
    else {
      const navTxt = await frame.evaluate(() => document.body.innerText.slice(0, 320));
      const appOk = vp.mobile
        ? (/РУССКИЙ БАПТИЗМ/.test(navTxt) && /Баптизма/.test(navTxt))
        : (/РУССКИЙ БАПТИЗМ/.test(navTxt) && /3D/.test(navTxt));
      appOk ? ok(`I4 [${vp.label}] приложение загрузилось (бренд+контент)`) : bad(`I4 [${vp.label}] приложение не распознано: ${JSON.stringify(navTxt.slice(0, 100))}`);
      if (!vp.mobile) {
        await frame.evaluate(() => { const b = [...document.querySelectorAll('button,a')].find(x => /3D Карта|3D-карта/i.test(x.textContent)); if (b) b.click(); });
        await page.waitForTimeout(2500);
        await frame.evaluate(() => { const b = [...document.querySelectorAll('button,a')].find(x => /Войти в 3D/i.test(x.textContent)); if (b) b.click(); });
        await page.waitForTimeout(6000);
        const gl = await frame.evaluate(() => {
          const c = document.querySelector('canvas');
          if (!c) return false;
          try { return !!(c.getContext('webgl2') || c.getContext('webgl')) || c.width > 100; }
          catch { return c.width > 100; }
        });
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
        /Как\s+читать\s+карту/i.test(uiText)
          ? ok(`I10 [${vp.label}] обучающий coach видим на первом входе`)
          : bad(`I10 [${vp.label}] нет тихой подсказки «Как читать карту»`);
      }
    }
    errs.length === 0 ? ok(`I1 [${vp.label}] 0 pageerror`) : bad(`I1 [${vp.label}] errors: ${errs.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  finish();
})().catch(e => { console.error('konfessii-map-audit ERROR:', e.stack || e.message); process.exit(1); });

function finish() {
  console.log('');
  if (fails.length) { console.log(`❌ KONFESSII 3D-MAP AUDIT: ${fails.length} провал(ов)`); process.exit(1); }
  console.log('✅ KONFESSII 3D-MAP AUDIT passed — все инварианты держатся');
  process.exit(0);
}
