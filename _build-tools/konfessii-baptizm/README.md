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
`npm run konfessii:audit` (scripts/konfessii-map-audit.js) — Playwright-аудит I1–I7:
обёртка (SEO/CSP/h1/iframe), бандл (singlefile/CSP/noindex/root), live: загрузка
приложения в iframe + активация 3D WebGL-canvas (desktop+mobile). Без браузера — SKIP.
Прогонять после любой пересборки `_app`. См. AGENTS §9.23.
