#!/usr/bin/env node
/**
 * ЗАЩИТА ОТ РЕГРЕССИЙ: статические контракты трёх движков.
 *
 * Быстрый (без сборки и браузера) страж инвариантов, которые мы уже теряли
 * и восстанавливали (см. auditrepo/references/gb-ui-canon-2026-07-13/
 * BRANCH_AUDIT_2026-07-14.md). Каждая проверка — конкретная регрессия из
 * истории проекта; НЕ ослаблять проверку ради «зелёного», чинить причину.
 *
 * Запуск: npm run engine:contracts   (входит в npm run engine:guard)
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let fails = 0;
function check(name, ok, hint) {
  if (ok) { console.log('✅ ' + name); }
  else { fails++; console.error('❌ ' + name + (hint ? '\n   → ' + hint : '')); }
}

/* ---------- floating-cluster.css ---------- */
const css = read('css/floating-cluster.css');

// Регрессия 2026-07-14: снятие префикса превращало поповер настроек серий
// в центр-модалку с блюром. Каждый селектор .gill-settings-overlay обязан
// жить под [data-gill-v16].
const badOverlay = css.split('\n').filter((l) =>
  /^\s*\.gill-settings-overlay/.test(l) || /,\s*\.gill-settings-overlay/.test(l));
check('CSS: все правила .gill-settings-overlay под [data-gill-v16]',
  badOverlay.length === 0,
  'непрефиксованные селекторы: ' + badOverlay.slice(0, 3).join(' | '));

// Регрессия «двойная рамка» таб-кнопок Обучения (lane 3ee57f7): у .gill-tab
// уже есть своя рамка; отдельное focus-visible-кольцо с offset рисует вторую.
const tabIdx = css.indexOf('.gill-tab:focus-visible');
const tabCtx = tabIdx === -1 ? '' : css.slice(tabIdx, tabIdx + 200);
check('CSS: нет двойной рамки .gill-tab (focus-visible без outline-offset)',
  tabIdx === -1 || !/outline-offset/.test(tabCtx),
  'вернулся outline-offset у .gill-tab:focus-visible');

// Канон: крошки скрыты на мобиле у серия-движка (владелец: «их не должно быть!»)
check('CSS: мобильные крошки скрыты ([data-gill-v16] .page-wrap > nav.breadcrumb)',
  /\[data-gill-v16\]\s*\.page-wrap\s*>\s*nav\.breadcrumb\s*\{[^}]*display:\s*none/.test(css));

// Канон: тонкий контур PLAY виден В ПОКОЕ на десктопе — у обоих кластеров.
check('CSS: контур PLAY в покое — .gbs-theme-corner',
  /\.gbs-theme-corner \.gb-ember__ring-svg\s*\{\s*opacity:\s*1/.test(css));
check('CSS: контур PLAY в покое — .gb-floater (одиночные статьи)',
  /\.gb-floater \.gb-ember__ring-svg\s*\{\s*opacity:\s*1/.test(css));

// Канон: бейдж «N×» СИДИТ В КРУГЕ (right:-2px;bottom:-2px), деск = мобила.
const badgeRules = [
  /\[data-gill-v16\] \.gbs-rail-spdbadge\s*\{[^}]*right:\s*-2px;\s*bottom:\s*-2px/,
  /\.gb-floater \.gbs-rail-spdbadge\s*\{[^}]*right:\s*-2px;\s*bottom:\s*-2px/,
  /\.mobile-spdbadge\s*\{[^}]*right:\s*-2px;\s*bottom:\s*-2px/,
];
check('CSS: бейдж скорости в круге (3 места, -2px/-2px)',
  badgeRules.every((re) => re.test(css)));

/* ---------- floating-cluster-controller.js ---------- */
const js = read('js/floating-cluster-controller.js');

check('JS: follow-скролл озвучки (buildFollowMap/followReading)',
  js.includes('function buildFollowMap') && js.includes('function followReading') &&
  js.includes('followReading(ttsState.spokenChars)'));

check('JS: Media Session + фоновый якорь (mediaSessionMeta/Set, silentWavUrl)',
  js.includes('function mediaSessionMeta') && js.includes('function mediaSessionSet') &&
  js.includes('function silentWavUrl') && js.includes("navigator.mediaSession.setActionHandler('play'"));

check('JS: перемотка по chunk (skipChunk для seekforward/backward)',
  js.includes('function skipChunk') && js.includes("setActionHandler('seekforward'"));

check('JS: единая привязка настроек ([data-gill-settings-open])',
  js.includes('[data-gill-settings-open]'));

/* ---------- изоляция движков ---------- */
const readerRail = read('src/components/article-pilots/_shared/ReaderRail.astro');
const readerSettings = read('src/components/article-pilots/_shared/ReaderSettings.astro');
check('Изоляция: одиночный движок не импортирует gill-series/',
  !/from ['"][^'"]*gill-series\//.test(readerRail) &&
  !/from ['"][^'"]*gill-series\//.test(readerSettings));

const gillSheet = read('src/components/article-pilots/gill-series/GillReaderSettingsSheet.astro');
check('Изоляция: Gill-лист без fallback на [data-reader-root]',
  !gillSheet.includes('data-reader-root'));

/* ---------- покрытие page-движка (восстановление rollout-v1) ---------- */
const registry = read('src/components/article-pilots/_shared/mobileChromeRegistry.ts');
const catalogRoutes = ['/articles/', '/biografii/', '/hard-texts/', '/rodosloviye/', '/karty/', '/konfessii/'];
check('Page-движок: 6 каталогов в MOBILE_CHROME_ROUTES',
  catalogRoutes.every((r) => registry.includes("'" + r + "'")),
  'потерян маршрут из: ' + catalogRoutes.join(', '));

/* ---------- серия-движок: все тела серий на SeriesReaderChrome ---------- */
const seriesBodies = [
  'src/components/baptisty-rossii',
  'src/components/article-pilots/novoe-serdce',
  'src/components/article-pilots/krajne',
  'src/components/article-pilots/rimlyanam7',
  'src/components/article-pilots/serdce-iduh',
  'src/components/article-pilots/serdce-spravochnik',
  'src/components/article-pilots/chto-bibliya-nazyvaet-serdcem',
  'src/components/article-pilots/antisovetov',
];
const missing = [];
for (const dir of seriesBodies) {
  const bodies = fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('Body.astro'));
  for (const b of bodies) {
    const content = read(path.join(dir, b));
    // Хаб /baptisty-rossii/ — лендинг серии, не статья: SeriesReaderChrome не обязан.
    if (b === 'BaptistyRossiiBody.astro') continue;
    if (!content.includes('SeriesReaderChrome')) missing.push(path.join(dir, b));
  }
}
check('Серия-движок: все статьи серий на SeriesReaderChrome', missing.length === 0,
  'вне движка: ' + missing.join(', '));

/* ---------- контент ↔ движок: счётчики Баптистов ---------- */
const baptDir = 'src/components/baptisty-rossii';
const stale = fs.readdirSync(path.join(ROOT, baptDir))
  .filter((f) => f.endsWith('Body.astro'))
  .filter((f) => /из 10</.test(read(path.join(baptDir, f))));
check('Контент: счётчики Баптистов = канон движка (9 частей, нет «из 10»)',
  stale.length === 0, 'устаревшие счётчики в: ' + stale.join(', '));

/* ---------- конфиги серий: только через defineSeriesConfig ---------- */
const seriesDir = 'src/components/article-pilots/_shared/series';
const cfgFiles = fs.readdirSync(path.join(ROOT, seriesDir)).filter((f) => f.endsWith('SeriesConfig.ts'));
const rawCfgs = cfgFiles.filter((f) => !read(path.join(seriesDir, f)).includes('defineSeriesConfig('));
check('Серии: каждый *SeriesConfig.ts объявлен через defineSeriesConfig()',
  rawCfgs.length === 0 && read(path.join(seriesDir, 'seriesConfig.ts')).includes('defineSeriesConfig('),
  'сырые конфиги (валидатор их не проверит): ' + rawCfgs.join(', '));

check('Серии: гид для агентов docs/SERIES-ENGINE-GUIDE.md на месте',
  fs.existsSync(path.join(ROOT, 'docs/SERIES-ENGINE-GUIDE.md')));

// Каждая заявленная theme обязана иметь css/series-<theme>.css
const themes = [];
for (const f of cfgFiles.concat(['seriesConfig.ts'])) {
  const m = read(path.join(seriesDir, f)).match(/theme:\s*'([a-z0-9-]+)'/g) || [];
  for (const t of m) themes.push(t.match(/'([a-z0-9-]+)'/)[1]);
}
const missingThemes = themes.filter((t) => !fs.existsSync(path.join(ROOT, `css/series-${t}.css`)));
check('Серии: у каждой theme есть css/series-<theme>.css', missingThemes.length === 0,
  'нет файла темы: ' + missingThemes.join(', '));

// Спутники: аккордеон обязан уметь их рендерить (satellitesOf подключён)
check('Серии: аккордеон рендерит спутники (satellitesOf в GillPartTocOverlay)',
  read('src/components/article-pilots/gill-series/GillPartTocOverlay.astro').includes('satellitesOf('));

/* ---------- CSS: структурная целостность (AST, не только скобки) ---------- */
// Регрессия AUDIT-CSS-FLOATCLUSTER-COMMENT-CORRUPTION (arena 2026-07-14):
// незакрытый баннер-комментарий превращал следующий rule в мусорный селектор
// и молча глотал 19 деклараций .mobile-bottom-bar. Скобочный валидатор это
// не видит — проверяем настоящим парсером + балансом комментариев.
try {
  const csstree = require('css-tree');
  for (const f of ['css/site.css', 'css/floating-cluster.css', 'css/mobile-hotfix.css',
                   'css/series-samizdat.css', 'css/series-manuscript.css', 'css/nagornaya-mobile-toc.css', 'css/home.css']) {
    const txt = read(f);
    const errs = [];
    csstree.parse(txt, { onParseError: (e) => errs.push(e.message) });
    check('CSS AST: ' + f + ' парсится без ошибок', errs.length === 0, errs.slice(0, 2).join(' | '));
  }
} catch (e) {
  check('CSS AST: css-tree доступен', false, e.message);
}

/* ---------- артефакты ---------- */
check('SVG-обложка медиа-шторки images/tts-artwork.svg',
  fs.existsSync(path.join(ROOT, 'images/tts-artwork.svg')));

/* ---------- нет осиротевших компонентов в _shared ---------- */
function grepImports(dir) {
  let acc = '';
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) acc += grepImports(p);
    else if (/\.(astro|ts|tsx)$/.test(e.name)) acc += fs.readFileSync(p, 'utf8');
  }
  return acc;
}
const allSrc = grepImports(path.join(ROOT, 'src'));
const orphans = fs.readdirSync(path.join(ROOT, 'src/components/article-pilots/_shared'))
  .filter((f) => f.endsWith('.astro'))
  .filter((f) => {
    const name = f.replace('.astro', '');
    const refs = allSrc.split(name).length - 1;
    // 1 вхождение = только собственное имя файла в импортах самого себя нет,
    // поэтому 0 ссылок извне → сирота (файл сам в allSrc не совпадает по имени).
    return refs === 0;
  });
check('Нет осиротевших компонентов в _shared', orphans.length === 0,
  'сироты: ' + orphans.join(', '));

console.log('');
if (fails) {
  console.error('❌ engine:contracts — ' + fails + ' контракт(ов) нарушено. НЕ ослаблять проверки — чинить причину.');
  process.exit(1);
}
console.log('✅ engine:contracts — все контракты движков целы.');
