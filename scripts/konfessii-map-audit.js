#!/usr/bin/env node
/*
 * Глубокая регресс-защита /konfessii/russkij-baptizm/.
 *
 * Проверяет source-контракты, committed singlefile _app и реальный production-like
 * dist через локальный HTTP. file:// запрещён как ложная среда: он не воспроизводит
 * CSP frame-src 'self', same-origin iframe и относительные URL GitHub Pages.
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

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
const ok = (message) => console.log(`  ✔ ${message}`);
const bad = (message) => { fails.push(message); console.log(`  ❌ ${message}`); };
const assert = (condition, success, failure = success) => condition ? ok(success) : bad(failure);
const read = (relative) => fs.existsSync(path.join(ROOT, relative))
  ? fs.readFileSync(path.join(ROOT, relative), 'utf8')
  : '';

function withoutNoscript(source) {
  return source.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '');
}

function isExternalTelemetryNetworkNoise(text) {
  const value = String(text || '');
  const yandexTelemetryHost = /(?:https?|wss):\/\/(?:[^/\s'"]+\.)?mc\.yandex\.(?:com|ru)(?:[/:]|$)/i.test(value);
  const networkFailure = /(?:WebSocket connection|Failed to load resource|net::ERR_|handshake|response code:\s*[45]\d\d|status(?: code)?[=:]?\s*[45]\d\d)/i.test(value);
  return yandexTelemetryHost && networkFailure;
}

function chooseLiveRoot() {
  if (process.env.KONFESSII_AUDIT_ROOT) return path.resolve(process.env.KONFESSII_AUDIT_ROOT);
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
      let relative = pathname.replace(/^\/+/, '');
      if (!relative || pathname.endsWith('/')) relative = path.join(relative, 'index.html');
      const file = path.resolve(absoluteRoot, relative);
      if (file !== absoluteRoot && !file.startsWith(`${absoluteRoot}${path.sep}`)) {
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
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

function finish() {
  console.log('');
  if (fails.length) {
    console.log(`❌ KONFESSII 3D-MAP AUDIT: ${fails.length} провал(ов)`);
    process.exit(1);
  }
  console.log('✅ KONFESSII 3D-MAP AUDIT passed — все инварианты держатся');
  process.exit(0);
}

console.log('\n🌍 KONFESSII 3D-MAP AUDIT (регресс-защита отдела)\n');

assert(
  isExternalTelemetryNetworkNoise("WebSocket connection to 'wss://mc.yandex.com/solid.ws' failed: Error during WebSocket handshake: Unexpected response code: 504"),
  'I1 audit policy: external Yandex telemetry network failure is classified as noise',
  'I1 audit policy: Yandex telemetry network failure classification is missing',
);
assert(
  !isExternalTelemetryNetworkNoise("Uncaught TypeError: application crashed at https://mc.yandex.com/runtime.js"),
  'I1 audit policy: application errors remain fatal even when text mentions Yandex',
  'I1 audit policy: application error was incorrectly suppressed',
);

const wrap = read(WRAP_REL);
const app = read(APP_REL);
const src = read(SRC_REL);
const navSrc = read(NAV_SRC_REL);
const nativeBody = read(NATIVE_BODY_REL);
const nativeStyles = read(NATIVE_STYLE_REL);

// Wrapper / SEO / iframe.
assert(/rel="canonical"/.test(wrap), 'I7 обёртка: canonical', 'I7 обёртка: нет canonical');
assert(/property="og:image"/.test(wrap), 'I7 обёртка: og:image', 'I7 обёртка: нет og:image');
assert((wrap.match(/<h1\b/g) || []).length === 1, 'I7 обёртка: ровно 1 h1', `I7 обёртка: h1 = ${(wrap.match(/<h1\b/g) || []).length}`);
assert(/application\/ld\+json/.test(wrap), 'I7 обёртка: JSON-LD', 'I7 обёртка: нет JSON-LD');
assert(/name="theme-color"/.test(wrap), 'I7 обёртка: theme-color', 'I7 обёртка: нет theme-color');
assert(/frame-src 'self'/.test(wrap), 'I7 обёртка: CSP frame-src self', 'I7 обёртка: CSP без frame-src self');
assert(/<iframe[^>]+id="appframe"[^>]+src="\.\/_app\/index\.html"/.test(wrap), 'I2 iframe → ./_app/index.html', 'I2 iframe src не указывает на ./_app/index.html');

// SEO fallback must never become a visible flex sibling when JS is enabled.
for (const [label, source] of [['legacy', wrap], ['native', nativeBody]]) {
  assert(
    /<noscript\b[^>]*>[\s\S]*?Три истока русского баптизма[\s\S]*?<\/noscript>/i.test(source),
    `I15 ${label}: SEO fallback находится внутри noscript`,
    `I15 ${label}: SEO fallback отсутствует внутри noscript`,
  );
  assert(
    !/Три истока русского баптизма/.test(withoutNoscript(source)),
    `I15 ${label}: SEO prose не участвует в JS-layout`,
    `I15 ${label}: SEO prose остался видимым flex-соседом`,
  );
  assert(
    !/#fafaf9|#e7e5e4/.test(source),
    `I15 ${label}: белые fallback-карточки удалены`,
    `I15 ${label}: остались светлые hardcoded-карточки`,
  );
}
assert(
  /flex:\s*1\s+1\s+0/.test(nativeStyles) &&
  /\.stage\{[^}]*min-width:\s*0[^}]*min-height:\s*0[^}]*overflow:\s*hidden/.test(nativeStyles),
  'I15 native styles: stage защищён от flex-shrink/overflow',
  'I15 native styles: stage viewport contract отсутствует',
);
assert(
  /@supports\s*\(height:\s*100dvh\)/.test(nativeStyles),
  'I15 native styles: dynamic mobile viewport поддержан',
  'I15 native styles: нет 100dvh mobile viewport fallback',
);

// Committed singlefile application integrity.
assert(Boolean(app), 'I6 _app: singlefile-бандл присутствует', 'I6 _app/index.html отсутствует — бандл не собран!');
if (app) {
  assert(app.length > 500000, `I6 _app: singlefile-бандл присутствует (${(app.length / 1024 / 1024).toFixed(1)} МБ)`, `I6 _app слишком мал (${app.length} б)`);
  assert(/<meta[^>]+viewport/.test(app), 'I6 _app: viewport', 'I6 _app: нет viewport');
  assert(/Content-Security-Policy/.test(app), 'I6 _app: CSP', 'I6 _app: нет CSP');
  assert(/name="robots"\s+content="noindex"/.test(app), 'I6 _app: robots=noindex', 'I6 _app: нет noindex');
  assert(/id="root"/.test(app), 'I6 _app: React root present', 'I6 _app: нет #root');
  assert(/66\.7K|66 732/.test(app) && !/~144K/.test(app), 'I12 _app: modern RSEHB statistic updated from research dossier', 'I12 _app: outdated RSEHB statistic');
  assert(/04\.01\.1919/.test(app) && /Военный вопрос|ОГПУ|Братский Вестник/.test(app), 'I12 _app: persecution/conscience timeline events present', 'I12 _app: persecution/conscience events missing');
  assert(/1963/.test(app) && /Устав ВСЕХБ|Вестник спасения/.test(app) && /майская делегация|ЦК КПСС/.test(app) && /Совет родственников/.test(app) && /Христианин|Косыгин|Вестник истины/.test(app), 'I12 _app: initiative/samizdat timeline events present', 'I12 _app: initiative/samizdat events missing');
  assert(/Иван Моисеев/.test(app) && /Печатники «Христианина»/.test(app) && /Донченко|психбольницы|отобрание детей/.test(app), 'I12 _app: relatives-bulletin events present', 'I12 _app: relatives-bulletin events missing');
  assert(/Георгий Слесарев/.test(app) && /Иван Шилов/.test(app) && /Николай Хмара/.test(app), 'I12 _app: persecution case-index events present', 'I12 _app: persecution case-index missing');
  assert(/sourceLevel/.test(app) && /articleKey/.test(app) && /nodeId/.test(app), 'I13 _app: timeline carries data-driven article/node metadata', 'I13 _app: timeline metadata fields missing');
  assert(/Связанная статья/.test(app) && /Открыть статью/.test(app) && /baptisty-rossii\//.test(app), 'I13 _app: article previews are wired into timeline/dossier', 'I13 _app: article previews missing');
  assert(/d3AlphaDecay:\.0165,d3VelocityDecay:\.24,warmupTicks:150,cooldownTicks:220,cooldownTime:7e3/.test(app), 'I14 _app: calm idle physics constants present', 'I14 _app: calm physics constants missing');
  assert(/strength\*1\.28/.test(app) && /d3AlphaTarget\(\.16\)\.resetCountdown\(\)/.test(app) && /d3AlphaTarget\?\.\(\.1\)/.test(app), 'I14 _app: soft anchor/drag alpha constants present', 'I14 _app: drag/anchor constants missing');
  assert(!/d3AlphaDecay:\.0115|warmupTicks:140|cooldownTicks:260|cooldownTime:9e3/.test(app), 'I14 _app: old jitter-prone constants absent', 'I14 _app: old jitter-prone constants returned');
}

// Source contracts for the live Three.js scene.
if (navSrc) {
  assert(/max-w-\[82rem\]/.test(navSrc) && /whitespace-nowrap/.test(navSrc) && !/max-w-6xl/.test(navSrc), 'I11 source: top navigation anti-overlap sizing present', 'I11 source: top navigation may overlap');
}
if (src) {
  assert(/function\s+TimelineOverlay/.test(src) && /timelineYearRef/.test(src), 'I8 source: ref-based TimelineOverlay present', 'I8 source: TimelineOverlay/timelineYearRef missing');
  assert(!/setTimelineYear\b|\btimelineYear\s*\?\?/.test(src), 'I8 source: no stale timelineYear state references', 'I8 source: stale timelineYear state references remain');
  assert((src.match(/<TimelineOverlay\b/g) || []).length === 1, 'I8 source: TimelineOverlay mounted exactly once', `I8 source: TimelineOverlay mount count = ${(src.match(/<TimelineOverlay\b/g) || []).length}`);
  assert(/onEventSelect=\{handleTimelineEventSelect\}/.test(src) && /aria-label=\{`Перейти к событию/.test(src) && /TIMELINE_TARGETS/.test(src), 'I8 source: timeline ticks are clickable and focus-aware', 'I8 source: timeline ticks are not wired to graph focus');
  assert(/findMapSelectionForNode/.test(src) && /setMapSelection\(selection\)/.test(src), 'I8 source: timeline events synchronize map selection', 'I8 source: timeline events do not synchronize map selection');
  assert(/timelineTicks/.test(src) && /visibleTimelineTicks/.test(src) && /hoveredTick/.test(src) && /timelineTicks\.filter\(\(tick\) => tick\.major\)/.test(src) && !/title=\{`\$\{evt\.year\}:/.test(src), 'I8 source: timeline ticks are landmark-only and avoid native title tooltips', 'I8 source: timeline ticks are noisy or use native title tooltips');
  assert(!/<(?:motion\.)?button[^>]+\s+title=/.test(src) && /displayEvent && !bottomBarExpanded/.test(src), 'I11 source: native button title tooltips removed and timeline card avoids route panel', 'I11 source: title tooltip/stacking regression');
  assert(/fill=\{exact && focus \? `\$\{focus\.color\}14`/.test(src) && /opacity=\{exact \? 0\.48/.test(src), 'I8 source: map highlight intensity is restrained', 'I8 source: map highlight may overpower scene');

  const sceneOwnsScroll =
    /h-\[100dvh\]\s+w-screen/.test(src) &&
    /touchAction:\s*'none'/.test(src) &&
    /overscrollBehavior:\s*'none'/.test(src) &&
    /onWheelCapture=\{handleSceneWheel\}/.test(src) &&
    /event\.preventDefault\(\)/.test(src) &&
    /event\.stopPropagation\(\)/.test(src) &&
    /body\{[^}]*overflow:\s*hidden/.test(nativeStyles);
  assert(sceneOwnsScroll, 'I5 source: full-viewport scene owns touch/overscroll/wheel', 'I5 source: scene scroll-ownership contract incomplete');

  assert(/interactiveHit/.test(src) && /child\.raycast = \(\) => undefined/.test(src), 'I5 source: decorative node geometry does not block raycast clicks', 'I5 source: decorative geometry may block clicks');
  assert(/onRouteStepTo=\{handleRouteStepTo\}/.test(src) && /Нажмите этап/.test(src), 'I9 source: route step chips are clickable', 'I9 source: route steps are not clickable');
  assert(/Сейчас в маршруте/.test(src) && /transitionLink/.test(src), 'I9 source: active route has storyboard context', 'I9 source: active route storyboard context missing');
  assert(/function\s+LearningCoach/.test(src) && /Как читать карту/.test(src) && /showLearningCoach/.test(src), 'I10 source: first-run learning coach present', 'I10 source: learning coach missing');
  assert(/ARTICLE_PREVIEWS/.test(src) && /Связанная статья/.test(src) && /getArticleForEvent/.test(src), 'I13 source: article preview cards wired', 'I13 source: article preview cards missing');
  assert(/event\?\.nodeId/.test(src) && /event\?\.routeId/.test(src) && /event\?\.mapSelectionId/.test(src), 'I13 source: Timeline prefers data-driven metadata before regex fallback', 'I13 source: metadata preference missing');
  assert(/anchor\.strength \* 1\.28 \* alpha/.test(src) && /d3AlphaDecay=\{0\.0165\} d3VelocityDecay=\{0\.24\}/.test(src) && /warmupTicks=\{150\} cooldownTicks=\{220\} cooldownTime=\{7000\}/.test(src), 'I14 source: calm idle physics constants present', 'I14 source: calm physics constants missing');
  assert(/d3VelocityDecay\?\.\(0\.26\)/.test(src) && /d3AlphaTarget\?\.\(0\.10\)/.test(src) && /\* 0\.006/.test(src), 'I14 source: soft rubber drag/release constants present', 'I14 source: rubber drag constants missing');
}

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (error) {
  if (REQUIRE_BROWSER) {
    console.error(`\n❌ playwright обязателен для этого CI-run: ${error.message}`);
    process.exit(1);
  }
  console.log('\n⏭ live-проверки пропущены: playwright не установлен.');
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
  } catch (error) {
    await new Promise((resolve) => server.close(resolve));
    if (REQUIRE_BROWSER) throw error;
    console.log(`\n⏭ live-проверки пропущены: chromium не запускается (${error.message.split('\n')[0]}).`);
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
    const context = await browser.newContext(vp.mobile ? {
      viewport: { width: vp.w, height: vp.h }, isMobile: true, hasTouch: true,
    } : { viewport: { width: vp.w, height: vp.h } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      const text = message.text();
      if (message.type() === 'error' && !text.includes('manifest') && !isExternalTelemetryNetworkNoise(text)) errors.push(text.slice(0, 140));
    });

    const response = await page.goto(wrapUrl, { waitUntil: 'load', timeout: 30000 });
    assert(response?.status() === 200, `I1 [${vp.label}] wrapper HTTP 200`, `I1 [${vp.label}] wrapper HTTP status=${response?.status() || 'none'}`);
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
        bar: barRect ? { bottom: barRect.bottom } : null,
        stage: stageRect ? { left: stageRect.left, top: stageRect.top, bottom: stageRect.bottom, width: stageRect.width, height: stageRect.height } : null,
        frame: frameRect ? { left: frameRect.left, top: frameRect.top, width: frameRect.width, height: frameRect.height } : null,
        seoVisible,
      };
    });

    assert(shell.horizontalOverflow <= 1, `I1 [${vp.label}] 0 h-overflow`, `I1 [${vp.label}] h-overflow=${shell.horizontalOverflow}`);
    assert(shell.verticalOverflow <= 1, `I15 [${vp.label}] 0 outer vertical overflow`, `I15 [${vp.label}] outer v-overflow=${shell.verticalOverflow}`);
    assert(!shell.seoVisible, `I15 [${vp.label}] SEO fallback не виден при JS`, `I15 [${vp.label}] SEO fallback видим поверх приложения`);
    const expectedHeight = shell.viewport.height - (shell.bar?.bottom || 0);
    assert(shell.stage && shell.stage.width >= shell.viewport.width - 2 && shell.stage.height >= expectedHeight - 2 && shell.stage.bottom <= shell.viewport.height + 2, `I15 [${vp.label}] stage заполняет viewport (${Math.round(shell.stage?.height || 0)}px)`, `I15 [${vp.label}] stage geometry=${JSON.stringify(shell.stage)}`);
    assert(shell.stage && shell.frame && Math.abs(shell.frame.left - shell.stage.left) <= 1 && Math.abs(shell.frame.top - shell.stage.top) <= 1 && Math.abs(shell.frame.width - shell.stage.width) <= 1 && Math.abs(shell.frame.height - shell.stage.height) <= 1, `I15 [${vp.label}] iframe совпадает со stage`, `I15 [${vp.label}] iframe/stage mismatch`);
    assert(Boolean(await page.$('#appframe')), `I1 [${vp.label}] iframe#appframe present`, `I1 [${vp.label}] нет iframe`);
    const loaderHidden = await page.evaluate(() => {
      const loader = document.getElementById('loader');
      return !loader || loader.classList.contains('hidden') || loader.style.display === 'none';
    });
    assert(loaderHidden, `I3 [${vp.label}] лоадер скрыт`, `I3 [${vp.label}] лоадер завис`);

    const frame = page.frames().find((candidate) => candidate.url().includes('/_app/'));
    if (!frame) {
      bad(`I2 [${vp.label}] iframe-приложение не загрузилось`);
    } else {
      const text = await frame.evaluate(() => document.body.innerText.slice(0, 320));
      const recognized = vp.mobile
        ? /РУССКИЙ БАПТИЗМ/.test(text) && /Баптизма/.test(text)
        : /РУССКИЙ БАПТИЗМ/.test(text) && /3D/.test(text);
      assert(recognized, `I4 [${vp.label}] приложение загрузилось (бренд+контент)`, `I4 [${vp.label}] приложение не распознано: ${JSON.stringify(text.slice(0, 100))}`);

      if (!vp.mobile) {
        await frame.evaluate(() => [...document.querySelectorAll('button,a')].find((node) => /3D Карта|3D-карта/i.test(node.textContent))?.click());
        await page.waitForTimeout(2500);
        await frame.evaluate(() => [...document.querySelectorAll('button,a')].find((node) => /Войти в 3D/i.test(node.textContent))?.click());
        await page.waitForTimeout(6000);
        const webgl = await frame.evaluate(() => {
          const canvas = document.querySelector('canvas');
          if (!canvas) return false;
          try { return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl')) || canvas.width > 100; }
          catch { return canvas.width > 100; }
        });
        assert(webgl, `I5 [${vp.label}] 3D WebGL canvas активируется`, `I5 [${vp.label}] 3D canvas не создан`);
        await frame.evaluate(() => [...document.querySelectorAll('button,a')].find((node) => /Начать исследование/i.test(node.textContent))?.click());
        await page.waitForTimeout(900);
        const uiText = await frame.evaluate(() => document.body.innerText);
        assert(/Хронология\s+событий/i.test(uiText) && /Современность|РС\s*ЕХБ|Крещение/i.test(uiText), `I8 [${vp.label}] событийный Timeline видим`, `I8 [${vp.label}] Timeline сломан`);
        assert(/МАРШРУТЫ\s+И\s+ГОРОДА/i.test(uiText), `I9 [${vp.label}] нижний роутер маршрутов видим`, `I9 [${vp.label}] нет роутера «Маршруты и города»`);
        assert(/Как\s+читать\s+карту/i.test(uiText), `I10 [${vp.label}] обучающий coach видим на первом входе`, `I10 [${vp.label}] нет подсказки «Как читать карту»`);
      }
    }
    assert(errors.length === 0, `I1 [${vp.label}] 0 pageerror`, `I1 [${vp.label}] errors: ${errors.slice(0, 3).join(' | ')}`);
    await context.close();
  }

  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  finish();
})().catch((error) => {
  console.error('konfessii-map-audit ERROR:', error.stack || error.message);
  process.exit(1);
});
