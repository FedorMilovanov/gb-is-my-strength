# «Карта Русского Баптизма» — сборка 3D-приложения

Отдел `/konfessii/russkij-baptizm/` встраивает **оригинальное** 3D-приложение
из проекта LM Arena Coding Battle (перенос 1-в-1), а не упрощённый порт.

## Архитектура
- `konfessii/russkij-baptizm/index.html` — **нативная обёртка** сайта:
  шапка/хлебные крошки, SEO/OG/JSON-LD/canonical, CSP (`frame-src 'self'`),
  Yandex.Metrika, sr-only `<h1>`, лоадер. Внутри — `<iframe src="./_app/index.html">`.
- `konfessii/russkij-baptizm/_app/` — **собранный singlefile-бандл** приложения
  (React 19 + TypeScript + Vite + Tailwind 4 + Three.js + react-force-graph-3d + d3-geo).
  Папка `_app` исключена из статических валидаторов сайта (skipDirs в
  scripts/validate.js, audit-pro.js, seo-audit.js, readable-audit.js, editorial-lint.js).

## Исходники приложения
Исходный код — отдельный Vite-проект (НЕ в этом репозитории, хранится у владельца:
Google Drive ZIP «react-vite-tailwind»):
https://drive.google.com/file/d/1tSV6l2CVl7MaPBWHNvf0Vt33JKUxDrJQ/view?usp=drive_link
**Важно:** этот ZIP является историческим полным исходником, а не проверенным
текущим release-source. В нём физика 3D старее, чем в выпущенном `_app`
(см. актуальные `warmupTicks=150`, `cooldownTicks=220`, `cooldownTime=7000`).
Не пересобирать из ZIP поверх `_app` без восстановления последующих редакций,
сверки данных/компонентов и полного I1–I15 браузерного аудита.
Структура: `src/components/MindMap3D.tsx`
(~2500 строк настоящей 3D-сцены), `src/data/history/*`, `vite.config.ts` с
`vite-plugin-singlefile`.

## Как пересобрать `_app`
```bash
# в распакованном Vite-проекте приложения:
npm install
# vite.config.ts должен содержать: base: './'  (иначе ассеты не найдутся в подпапке)
npm run build           # → dist/index.html (один самодостаточный файл ~2.2 МБ)
cp dist/index.html  <repo>/konfessii/russkij-baptizm/_app/index.html
```

После копирования ОБЯЗАТЕЛЬНО вернуть в `<head>` бандла (Vite их не ставит):
1. `<meta http-equiv="Content-Security-Policy" content="… script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src … https://fonts.googleapis.com; font-src … https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' data: blob: https://fonts.googleapis.com https://fonts.gstatic.com; worker-src 'self' blob'; …">` (Three.js нужен `unsafe-eval`/`blob:`; шрифты Inter/JetBrains — Google Fonts).
2. `<meta name="robots" content="noindex">` (бандл индексируется только через обёртку).
3. `<link rel="icon" href="/favicon.ico" sizes="any">` (заменить дефолтный `/vite.svg`).
4. `viewport-fit=cover` в meta viewport.

## Регресс-защита
`npm run konfessii:audit` (scripts/konfessii-map-audit.js) — Playwright-аудит I1–I14:
обёртка (SEO/CSP/h1/iframe), бандл (singlefile/CSP/noindex/root), live: загрузка
приложения в iframe + активация 3D WebGL-canvas (desktop+mobile). Последние инварианты
также защищают data-driven Timeline, article previews, кейсы гонений/самиздата,
обучающий coach, роутер «Маршруты и города» и **I14 smooth physics constants**
(`d3AlphaDecay .0165`, `d3VelocityDecay .24`, `warmupTicks 150`, `cooldownTicks 220`,
`cooldownTime 7000`, anchor `*1.28`). Без браузера — SKIP (не считать полноценной live-приёмкой). Прогонять после любой
пересборки `_app`. См. AGENTS §9.23 и `3D-PREMIUM-POLISH-2026-06-14.md`.

На Windows при установленном Chrome можно явно запустить **обязательный** live-аудит,
не полагаясь на иной кэш версий Playwright:

```powershell
$env:KONFESSII_AUDIT_REQUIRE_DIST = '1'
$env:KONFESSII_AUDIT_REQUIRE_BROWSER = '1'
$env:GB_PLAYWRIGHT_CHROMIUM_EXECUTABLE = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm.cmd run konfessii:audit
```

Проверка оболочки и запуска 3D в iframe **не доказывает нулевой overflow внутри**
собранного React-приложения. Для него необходимо исправление актуального
исходника, пересборка и отдельный контроль `iframe.contentDocument.body.scrollWidth`.

### Незакрытый P1 — параллельные временные шкалы 3D

Реальная проверка **внутри iframe** (не внешней оболочки) выявила горизонтальное
переполнение: +22 px при 320/390, +14 px при 768, +6 px при 1024.
Проверка отдельных DOM-transforms локализовала главного владельца:
`ParallelTimelines.tsx` создаёт входные Framer Motion сдвиги
`translateX(-26px/+26px)`, а вложенные элементы используют ±12 px.
Удаление **всех** transforms только в диагностическом браузерном сценарии
сводит overflow к нулю; это не является исправлением действующего бандла.

Для следующей полной сборки подготовлен источник
`source-snapshot/components/ParallelTimelines.tsx`: анимация входа идёт
по вертикали, сетка допускает `min-width:0`; нет глобального
`overflow-x:hidden` и обрезания содержимого. Файл **пока не входит**
в развёрнутый `_app/index.html`. Сохранять существующие данные,
таймлайн, 3D-физику и семантику, проверять сборочный parity с действующим
бандлом перед его заменой. **Не объявлять P1 закрытым** по одному исходнику
или зелёной проверке внешнего iframe.
