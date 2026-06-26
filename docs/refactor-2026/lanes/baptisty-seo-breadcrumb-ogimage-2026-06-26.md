# Lane: baptisty-seo-breadcrumb-ogimage-2026-06-26

**Date:** 2026-06-26
**Mode:** LANE (SEO, baptisty-rossii archetype, 11 PageHeads + 11 assets)
**Branch:** `lane/baptisty-seo-breadcrumb-ogimage-2026-06-26`
**Base:** `106f98d`
**Goal:** закрыть две SEO-дыры серии «Баптисты России» (AuditRepo: S3-N1, S3-N2 / PFV-004).

## Проблема

1. **S3-N1 — нет `BreadcrumbList` в JSON-LD.** На всех 11 страницах (хаб + 10 статей) были
   DOM-хлебные крошки (`.breadcrumb`), но не было structured-data `BreadcrumbList`. Google/Яндекс
   используют именно JSON-LD для навигационных rich-результатов → ни одна страница серии не
   получала хлебные крошки в выдаче.
2. **S3-N2 — `og:image` в формате SVG.** Все 11 указывали `og:image` на `cover-*.svg`
   (`og:image:type=image/svg+xml`). Ни одна соцсеть (Telegram, VK, Facebook, WhatsApp, X) не
   рендерит SVG в превью ссылки → при шеринге превью было без картинки. Растровых версий не было.

## Исправление

### BreadcrumbList (все 11 PageHead-компонентов)
Добавлен отдельный `<script type="application/ld+json">` с `BreadcrumbList` сразу после
Article/CollectionPage блока:
- 10 статей: 3 уровня — Главная → Баптисты России → <заголовок статьи> (leaf = headline без
  суффикса « — Баптисты России», совпадает с DOM-крошкой).
- хаб: 2 уровня — Главная → Баптисты России.

### og:image → WebP (все 11)
- Сгенерированы растровые обложки 1200×630 из существующих SVG-дизайнов через `sharp`
  (`density:144`, webp q82, 14–19 KB каждая). Дизайн полностью сохранён: градиент, крест/символ,
  кириллический текст читаем (проверено визуально).
- Обновлены `og:image` (URL `.svg`→`.webp`), `og:image:type` (`image/svg+xml`→`image/webp`) и
  поле `image` в Article/CollectionPage JSON-LD.

> In-page декоративные `<img>`-миниатюры (рейл/герой/sheet) в `*Body.astro` оставлены как SVG —
> они корректно рендерятся в браузере; проблема SVG касается только соц-крауллеров (og:image).
> WebP-версии теперь существуют, миграцию миниатюр можно сделать отдельной косметической lane.

## Проверки (source + build + dist)

- JSON-LD всех 11 PageHead: парсится; типы `[Article|CollectionPage, BreadcrumbList, SpeakableSpecification]`.
- WebP-обложка 01 проверена визуально — текст и графика чёткие.
- `strangler:build:production-like` — ✅ 52 pages; 11 webp в `dist/images/baptisty-rossii/`.
- dist `og:image` = `cover-*.webp`, `og:image:type=image/webp`; `BreadcrumbList=1` на хабе и статьях.
- Полный свип baptisty dist JSON-LD — **0** ошибок.
- `npm run data:consistency` ✅ · `npm run seo-audit` ✅ 0/0 · `npm run content:parity` ✅

## Scope guard
11 `*PageHead.astro` (BreadcrumbList + og:image) + 11 новых `.webp`. Контент статей, JS, CSS,
другие маршруты — не тронуты.

## FULL gate
`validate:static-publication` целиком не гонялся (ресурсы песочницы). Build + targeted gates зелёные.
Рекомендуется финальный полный прогон на CI.
