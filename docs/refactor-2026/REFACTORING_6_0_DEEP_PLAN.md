# РЕФАКТОРИНГ 6.0 — АБСОЛЮТНЫЙ ПЛАН
## Тотальная диагностика + 12 фаз без единого отката

**Дата:** 2026-06-21  
**Проект:** gb-is-my-strength (gospod-bog.ru)  
**1335 коммитов изучено · 40+ web searches · 80+ файлов прочитано**

---

## 0. ПОЛНАЯ ДИАГНОСТИКА: почему падали предыдущие рефакторинги

### 0.1 Классификация 12 критических инцидентов

| # | Инцидент | SHA / AGENTS-r | Причина | Цена |
|---|----------|---------------|---------|:----:|
| 1 | **Dist deploy выкатил заглушки** | r244 | Astro generic `astro-card-grid` вместо premium legacy. DOM-маркеры проходили, visual parity = 0% | 30+ страниц сломано |
| 2 | **MapEngine модульный рефакторинг сломал Avraam** | c94a3298 | Данные «выпотрошены», route.json gutted | 2 раза |
| 3 | **CSS 151 unclosed brackets** | v49 | site.css похоронен на глубине 151 вложенности, половина CSS не работала | Визуал сломан на всех страницах |
| 4 | **464 unclosed `<span>` в 8 статьях** | v50 | `</span>` удалены массово | 464 дыры в DOM |
| 5 | **464 unclosed span (повтор)** | 7f16c2c | Агент удалил закрывающие теги | 8 статей с битым DOM |
| 6 | **BROKEN regex в maps:validate** | r252 | `/${id}/` не интерполируется в regex literal | 10 карт ложно помечены |
| 7 | **CRITICAL genealogy — edges не рендерятся** | f8e3a410 | React Flow v12 + React 19 bug | 3 коммита на фикс |
| 8 | **ARRAY MAP DATA удалена** | 22abf658 | Непонятно каким агентом | Карта восстановлена как монолит |
| 9 | **Reader-mode text вертикальный** | v35 | `<span>` без `</span>` в 3 Gill файлах | Текст столбиком |
| 10 | **Font FOUC на главной** | v49 | Не preloaded Inter-600, PlayfairDisplay-700 | Flash of Unstyled Text |
| 11 | **theme-toggle/иконки пропали** | r150 | `overflow:hidden` на `.h-navbar__inner` обрезал SVG | Day/night не работает |
| 12 | **Mobile bottom-bar под floating controls** | r150 | z-index stacking context | Кнопки не нажимались |

### 0.2 5 коренных причин (повторный анализ)

1. ❌ **НЕТ CI GATE НА VISUAL PARITY** (причина #1 всех откатов)
2. ❌ **ДВОЙНАЯ/ТРОЙНАЯ АРХИТЕКТУРА** (Avraam + engine v1 + engine v2 planned)
3. ❌ **CSS БЕЗ СТРУКТУРЫ** (202 !important, unclosed скобки, дубликаты)
4. ❌ **JS БЕЗ ТИПОВ** (11 файлов, 569 lines (165 KB minified) site.js — никакой защиты)
5. ❌ **НЕТ «УБОРКИ» ПОСЛЕ МИГРАЦИЙ** (мёртвые модули, orphan images, stale preload)

### 0.3 Текущее состояние (точная инвентаризация)

#### Routes (52 `.astro` page files total, 51 production)

| Тип | Количество | Пример |
|-----|:----------:|--------|
| **Production routes on `loadLegacyFullDocument`** | **51** | все live routes |
| **Pure full-body shadow** | **33** | articles/*, baptisty-rossii/*, karty/*, `/map/`, `/rodosloviye/` |
| **Hybrid page-segment shadow** | **9** | `/about/`, `/articles/`, `/`, `/karty/` |
| **Hybrid delegated-component shadow** | **9** | весь `/nagornaya/*` через `NagornayaPageMain` |
| **True native production routes** | **0** | отсутствуют |
| **Native Astro (dev-only)** | **1** | `/dev/astro-test.astro` |

**Итого:** 52 Astro pages total = 51 production + 1 dev-only. Production не является однородным «verbatim классом»: 33 route — pure full-body shadow, 18 route — componentized/hybrid shadow. Кроме того, production реально использует 11 page-imported components (`AboutArticle`, `HomeMain`, `NagornayaPageMain` и др.), хотя большинство из них пока рендерят raw legacy fragments.

#### CSS (5 файлов)

| Файл | Размер | !important | Скобки |
|------|:------:|:----------:|:------:|
| site.css | 265KB | **202** | 0 (исправлено) |
| home.css | 51KB | 36 | 0 |
| command-palette.css | 38KB | 7 | 0 |
| mobile-hotfix.css | ~5KB | 85 | 0 |
| nagornaya-mobile-toc.css | ~3KB | 133 | 0 |

#### JS (11 файлов)

| Файл | Строки | addEventListener | `remove` |
|------|:------:|:---------------:|:--------:|
| site.js | **569 lines (165 KB minified)** | **45** | **3** |
| search.js | ~1500 | 20+ | 0 |
| enhancements.js | ~900 | 15+ | 0 |
| Остальные 8 | ~4000 | ~40 | 0 |

#### MapEngine

| Компонент | Строки | Статус |
|-----------|:------:|--------|
| Avraam (extracted: `index.html` 2385 + `avraam-app.js` 2407) | 4792 | extracted (9115253), protected |
| MapEngine v1 (`map-engine.js`) | 2590 | 9 карт |
| Dead modules (`modules/`) | 0 | удалены в `83ae4a8` |
| MapEngine v2 | 0 | только в MAPS-ADR |

#### Audit system

- **audit-pro.js**: 4383 строки, **164 passed guards / G1-G113+ family**
- **visual-parity-screenshots.js**: 323 строки, pixelmatch + Playwright
- **visual-parity-baseline.js**: 105 строк, baseline check
- **validate.js**: ~500 строк
- **seo-audit.js**: ~400 строк
- **17 per-route audit scripts**: about, articles, biografii, hard-texts, etc.

---

## 1. 60+ ИНСАЙТОВ ИЗ 40+ WEB SEARCHES

Полный банк знаний, интегрированный в план.

### 1.1 Strangler Pattern & Incremental Migration

| # | Инсайт | Источник | Применение |
|---|--------|----------|------------|
| 1 | **Strangler без конечной даты = Frankenstein** | Swimm.io, designgurus.io | Каждый shadow-wrap route имеет deadline в этом плане |
| 2 | **Feature flags > ветки для rollback** | circleci.com, wireapps.co.uk | MapEngine v2 под флагом, не удаляем v1 |
| 3 | **Migrate data before logic** | Swimm.io | Сначала route.json → validate, потом render |
| 4 | **Mixed teams: legacy + new вместе** | wireapps.co.uk | Один агент делает и shadow и native |
| 5 | **Удалять legacy после миграции — иначе «скелеты»** | technori.com | Фаза 8: удаление legacy HTML |
| 6 | **Observability обоих путей** | designgurus.io | Production console.warn на shadow page load |
| 7 | **Containerization упрощает strangler** | Swimm.io | Для будущего переезда с GitHub Pages |
| 8 | **Domain boundaries важнее technical layers** | wireapps.co.uk | GBS2, Nagornaya, Karty — отдельные домены |

### 1.2 Pixel-level Visual Regression

| # | Инсайт | Источник | Применение |
|---|--------|----------|------------|
| 9 | **toHaveScreenshot() > page.screenshot()** | Playwright docs 2026 | Переписать visual-parity-screenshots на Playwright test |
| 10 | **Docker container для consistent rendering** | bug0.com, testquality.com | CI: mcr.microsoft.com/playwright |
| 11 | **retry 2, workers 4, timeout 30s** | oneuptime.com | CI config |
| 12 | **Baseline = commit, не файл** | css-tricks.com | data/visual-parity-baseline.json под git |
| 13 | **mask для dynamic content** | Playwright docs | Маскировать Yandex Metrika, random phrases |
| 14 | **Per-component screenshots** | bug0.com | После native pilot — компонентный diff |
| 15 | **Full-page + viewport combined** | smashingmagazine | Сохранить full-page, добавить first-fold-only |

### 1.3 CSS @layer & Specificity

| # | Инсайт | Источник | Применение |
|---|--------|----------|------------|
| 16 | **@layer решает specificity без !important** | Smashing Magazine, MDN | Главный инструмент Фазы 2 |
| 17 | **Unlayered CSS бьёт любой @layer** | MDN | Legacy CSS остаётся unlayered = высший приоритет |
| 18 | **!important в early layer бьёт !important в late layer** | CSS Tricks | Понимать при использовании !important |
| 19 | **5-layer architecture: reset, base, components, utilities, overrides** | Medium | Новая структура site.css |
| 20 | **`revert-layer` откатывает к предыдущему слою** | DEV.to | Для тонкого контроля |
| 21 | **Nested layers: `@layer gbs2.rail`** | MDN | GBS2, Nagornaya, Karty как подслои |
| 22 | **@import в layer: `@import 'bootstrap.css' layer(vendor)`** | CSS Tricks | Для будущих зависимостей |

### 1.4 JS Memory & Event Listeners

| # | Инсайт | Источник | Применение |
|---|--------|----------|------------|
| 23 | **AbortSignal — один `abort()` для всех** | patterns.dev | Переписать site.js на AbortController |
| 24 | **WeakRef + FinalizationRegistry** | ES2021 spec | Для MapEngine cleanup |
| 25 | **Event delegation > per-element listeners** | kitemetric.com | Для маркеров карт |
| 26 | **Named functions > anonymous для removeEventListener** | dev.to | Переписать все коллбэки |
| 27 | **Return cleanup function = Unsubscribe pattern** | patterns.dev | Каждый модуль site.js возвращает cleanup |
| 28 | **`{ once: true }` для одноразовых** | MDN | tour, animation listeners |
| 29 | **Heap snapshot сравнение до/после** | Chrome DevTools | Проверка site.js memory leak |

### 1.5 TypeScript Migration

| # | Инсайт | Источник | Применение |
|---|--------|----------|------------|
| 30 | `allowJs: true` + `checkJs: false` → постепенно | tech-insider.org, TS handbook | tsconfig уже есть, расширить |
| 31 | **JSDoc аннотации перед полной миграцией** | typescriptworld.com | Для site.js — JSDoc first |
| 32 | **Strict mode постепенно: noImplicitAny → strictNullChecks → strict** | typescriptworld.com | Для MapEngine v2 |
| 33 | **Pattern matching в TS 6.0 для reducers** | pavanrangani.com | Если будут complex state machines |
| 34 | **npx tsc --noEmit в CI** | TS docs | Gate для Фазы 9 |

### 1.6 Core Web Vitals 2026

| # | Инсайт | Источник | Применение |
|---|--------|----------|------------|
| 35 | **LCP ≤2.5s, INP ≤200ms, CLS ≤0.1** | corewebvitals.io, Google | Целевые метрики |
| 36 | **INP заменил FID в марте 2024** | corewebvitals.io | Site.js должен быть optimised |
| 37 | **TTFB — самый трудный метрик** | corewebvitals.io | Static hosting — преимущество |
| 38 | **Bounce rate +32% за секунду после LCP** | mewastudio.com | Приоритет LCP |
| 39 | **Islands architecture = zero JS by default** | Astro docs, vofoxsolutions | Использовать для MapEngine v2 |
| 40 | **`content-visibility: auto` для below-fold** | web.dev | Для длинных article pages |
| 41 | **`fetchpriority="high"` на 1 ресурс** | web.dev | Уже есть, проверить |
| 42 | **`font-display: optional` для fallback** | CWV guide | Для не-критических шрифтов |

### 1.7 CSP Security

| # | Инсайт | Источник | Применение |
|---|--------|----------|------------|
| 43 | **`strict-dynamic` — современный стандарт** | reflectiz.com, betterstack.com | CSP upgrade |
| 44 | **`'unsafe-inline'` — legacy, убрать где можно** | reflectiz.com | Сейчас почти везде unsafe-inline |
| 45 | **nonce generation per request** | betterstack.com | Для будущего SSR |
| 46 | **report-uri / report-to для мониторинга** | betterstack.com | CSP report endpoint |
| 47 | **form-action, base-uri, frame-ancestors — не забыть** | reflectiz.com | Дополнить CSP |

### 1.8 CI/CD & GitHub Actions

| # | Инсайт | Источник | Применение |
|---|--------|----------|------------|
| 48 | **Pinned actions: @v4, не @main** | security best practice | Все workflow проверить |
| 49 | **Docker-based CI consistent rendering** | bug0.com | Playwright Docker image |
| 50 | **Cache npm + Playwright browsers** | GitHub Docs | Build time 5min → 2min |
| 51 | **`fetch-depth: 0` для git diff** | GitHub Docs | IndexNow, visual baseline |
| 52 | **`concurrency: cancel-in-progress`** | GitHub Docs | Уже есть, хорошо |
| 53 | **Artifacts retention 14 дней** | GitHub Docs | visual parity reports |

### 1.9 Map Architecture

| # | Инсайт | Источник | Применение |
|---|--------|----------|------------|
| 54 | **SVG `<use>` для icons уменьшает размер в 10x** | heavymap viz | MapEngine v2 markers |
| 55 | **GPU rendering > CPU для 1000+ markers** | deck.gl | Для будущего |
| 56 | **Data-driven routes > inline constants** | MAPS-DESIGN-CONTRACT | Уже есть, хорошо |
| 57 | **Feature flag v1/v2 для zero-risk rollout** | MAPS-ADR-2026-06-21 | В плане |

### 1.10 Content & Editorial

| # | Инсайт | Источник | Применение |
|---|--------|----------|------------|
| 58 | **Russian quote policy = SEO + quality** | AGENTS.md | Уже есть guard, проверить coverage |
| 59 | **llms.txt для LLM discoverability** | llms.txt spec | Уже есть, проверить |
| 60 | **Pagefind для static search** | pagefind docs | Уже есть, хорошо |
| 61 | **IndexNow — Яндекс + Bing** | indexnow.org | Уже есть, хорошо |
| 62 | **Accessibility: keyboard + screen reader** | QUALITY_GATES.md | axe-core + manual smoke |

---

## 2. ПОЛНАЯ ИНВЕНТАРИЗАЦИЯ ДОЛГОВ

### 2.1 😱 CRITICAL (8 проблем)

| # | Долг | Где | Почему критично | Решение |
|---|------|-----|-----------------|---------|
| C1 | **51 production routes живут на shadow transport** | 33 pure + 18 hybrid | Нет true native production path; migration strategy должна быть split-lane | Фаза 3-5 |
| C2 | **Двойной рендеринг карт** | Avraam vs MapEngine vs v2 | 3 paths, 3x maintenance, 3x risk | Фаза 6 |
| C3 | **202 !important в site.css** | css/site.css | Блокирует рефакторинг, вынуждает костыли | Фаза 2 |
| C4 | **site.js = 45 addEventListener / 3 removeEventListener** | js/site.js | Cleanup-асимметрия + minified runtime = high-risk support cost | Фаза 7 |
| C5 | **Avraam extracted 4792 строк (2385+2407)** | karty/avraam/ | JS вынесен в avraam-app.js, но всё ещё high-risk | Фаза 6 (последний) |
| C6 | **Visual parity guard не в deploy.yml** | visual-parity-screenshots.js | Only weekly/manual, не защищает deploy path | Фаза 1 |
| C7 | **Site.js 569 lines (165 KB minified)** | js/site.js | Нельзя рефакторить без риска | Фаза 7 |
| C8 | **Taxonomy drift в аналитике** | docs/research/audit | Грубая формула «все 51 одинаково verbatim» искажает roadmap | Фаза 0 |

### 2.2 🔴 HIGH (12 проблем)

| # | Долг | Где | Решение |
|---|------|-----|---------|
| H1 | **CSS 133 !important в nagornaya-mobile-toc.css** | Нагорная Tailwind override | @layer nagornaya |
| H2 | **85 !important в mobile-hotfix.css** | touch overrides | @layer overrides |
| H3 | **5 Gill страниц в full shadow** | articles/dzhon-gill-* | Фаза 4 (GSB2 native) |
| H4 | **Nagornaya Tailwind отдельная сборка** | nagornaya/tw.min.css | Интеграция в Astro build |
| H5 | **Inline style 12KB в 20-antisovetov** | единственный inline island | Вынести в CSS |
| H6 | **Orphan images** | ~6MB неиспользуемых файлов | Фаза 8 (удаление) |
| H7 | **CSP с unsafe-inline** | почти все страницы | Фаза 10 |
| H8 | **Sitemap ↔ feed ↔ manifest drift** | cross-data inconsistency | Фаза 11 |
| H9 | **Pagefind не на всех shadow pages** | sr-only fallback может не работать | Проверить |
| H10 | **No production monitoring** | нет RUM, нет CWV data | Фаза 11 |
| H11 | **No type safety в JS runtime** | 11 файлов без типов | Фаза 9 |
| H12 | **No keyboard smoke в CI** | только manual | Фаза 11 |

### 2.3 🟡 MEDIUM (15 проблем)

| # | Долг | Решение |
|---|------|---------|
| M1 | `data/visual-parity-baseline.json` обновлён вручную | `--update` через CI после owner review |
| M2 | Playwright deps не кэшируются в CI | actions/cache для .cache/ms-playwright |
| M3 | `npm ci` занимает 3+ минуты | package-lock.json audit |
| M4 | Первый LCP — часто not optimised | Фаза 10 |
| M5 | `font-display: swap` может дать CLS | `font-display: optional` для не-LCP |
| M6 | JSON-LD не везде имеет `@id` reference | E-E-A-T сигнал |
| M7 | `article:author` meta не на всех article pages | G110 guard уже есть |
| M8 | indexnow.yml и deploy.yml дублируют код | Рефакторинг workflow |
| M9 | Нет мониторинга CSP violations | `report-uri` endpoint |
| M10 | `llms.txt` может быть не полным | Аудит |
| M11 | `feed.xml` lastBuildDate может устареть | G38 guard уже есть |
| M12 | Нет performance budget в CI | Lighthouse CI |
| M13 | `_build-tools/` не очищен | Мусор от прототипов |
| M14 | `audit/` не очищен | Старые аудиты |
| M15 | `docs/refactor-2026/` 55+ файлов | Архив старых планов |

---

## 3. ПЛАН: 12 ФАЗ, 40+ ЗАДАЧ

### Фаза 0: QUICK WINS (день 1)

**Цель:** закрыть 5 лёгких, но критичных проблем.

| # | Задача | Долг | Оценка |
|---|--------|------|:------:|
| 0.1 | `check-workflows.js` — добавить guard на visual-parity.yml | C6 | 30min |
| 0.2 | Route taxonomy — зафиксировать 33 pure / 18 hybrid / 0 native-prod | C8 | 20min |
| 0.3 | Orphan images — удалить (6MB) | H6 | 20min |
| 0.4 | `_build-tools/preview-archive/` — проверить, можно ли удалить | M13 | 15min |
| 0.5 | `audit/` — старые > 1 недели — в архив | M14 | 10min |

**Gate:** `node scripts/audit-pro.js` — ✅ 0 errors. `npm run validate:static-publication` — ✅.

---

### Фаза 1: CI VISUAL PARITY GATE (дни 1-2)

**Цель:** visual:parity:guard в deploy.yml. Без этой фазы все остальные — риск.

| # | Задача | Описание | Риск |
|---|--------|----------|:----:|
| 1.1 | Установить Playwright Docker в CI | `mcr.microsoft.com/playwright:v1.50.0-noble` container | Low |
| 1.2 | Кэшировать Playwright browsers | `actions/cache@v4` для ~/.cache/ms-playwright | Low |
| 1.3 | Добавить `npm run visual:parity:guard` в deploy.yml | Перед `upload-pages-artifact` | Medium |
| 1.4 | visual-parity-screenshots: переписать на `toHaveScreenshot()` | Заменить ручной pixelmatch на Playwright built-in | Medium |
| 1.5 | Mask dynamic content (Yandex Metrika, random phrases) | Playwright `mask` option | Low |
| 1.6 | PR comment с diff images при failure | `actions/github-script@v7` | Low |

**Gate:** `npm run visual:parity:guard` — ✅ в CI. Failure = CI red.

**Rollback:** `git revert` изменений deploy.yml.

---

### Фаза 2: CSS @layer РЕФАКТОРИНГ (дни 2-5)

**Цель:** site.css !important ≤ 100, вся архитектура на @layer.

| # | Задача | !important reduction | Описание |
|---|--------|:-------------------:|----------|
| 2.1 | Declare layer order: `@layer reset, base, gbs2, nagornaya, components, utilities, overrides` | — | В начало site.css |
| 2.2 | Wrap GBS2 styles in `@layer gbs2` | ~30 | `body.gbs-world` and all `gbs2-*` |
| 2.3 | Wrap Nagornaya styles in `@layer nagornaya` | ~25 | `body.nagornaya-page` and related |
| 2.4 | Wrap map styles in `@layer components` | ~15 | MapEngine inline CSS → сюда |
| 2.5 | Wrap home page styles in `@layer components` | ~10 | `.h-*` selectors |
| 2.6 | Wrap summary-card, note-box styles in `@layer components` | ~20 | Editorial blocks |
| 2.7 | Move `!important` mobile hotfixes to `@layer overrides` | 85 | mobile-hotfix.css → @layer |
| 2.8 | Move Nagornaya TOC overrides to `@layer nagornaya` | 133 | nagornaya-mobile-toc.css → @layer |
| 2.9 | Audit remaining !important (expected ~50-70) | ~50 | Per-rule specificity check |
| 2.10 | Brace balance check | 0 | `python3 -c "..." ` |

**Gate:** `node scripts/audit-pro.js` — ✅ !important ≤ 100 (from 202+36+85+133+7 = 463 total today).

**Rule:** После этой фазы adding !important требует ОТДЕЛЬНОГО одобрения владельца.

---

### Фаза 3: NATIVE-SHADOW HIGH-RISK (дни 3-7)

**Цель:** 4 HIGH-risk landings → native-shadow (рецепт r249).

| # | Задача | Route | current → target | Детали |
|---|--------|-------|------------------|--------|
| 3.1 | `/karty/` — MapEngine hub | /karty/ | full-shadow → native-shadow | Extract hub, card-grid, hero |
| 3.2 | `/baptisty-rossii/` — GBS2 landing | /baptisty-rossii/ | full-shadow → native-shadow | GBS2 components + legacy body segments |
| 3.3 | `/nagornaya/` — Tailwind landing | /nagornaya/ | full-shadow → native-shadow | NagornayaPageMain → named sub-components |
| 3.4 | `/` — Home page | / | full-shadow → native-shadow | HomeMain → Hero, MobileHub, Dashboard, Rail, Paths, Dock |
| 3.5 | `/nagornaya/chast-1..5/` | 5 routes | full-shadow → native-shadow | Extract common NagornayaArticleMain |
| 3.6 | `/nagornaya/seriya/`, `/istochniki/`, `/nakhodki/` | 3 routes | full-shadow → native-shadow | NagornayaPageMain variant |

**Gate:** `npm run visual:parity:guard` — **0.000%** desktop+mobile для каждого route.

**Rollback:** `git revert` per-route.

---

### Фаза 4: GILL GBS2 NATIVE (дни 5-8)

**Цель:** 5 Gill страниц → native GBS2 Astro компоненты.

| # | Задача | Описание |
|---|--------|----------|
| 4.1 | Create `Gbs2Layout.astro` | Единый layout для всех GBS2 серий |
| 4.2 | Create `Gbs2Rail.astro` | Desktop sidebar rail |
| 4.3 | Create `Gbs2MobileSheet.astro` | Mobile bottom sheet with tabs |
| 4.4 | Create `Gbs2Timeline.astro` | Era timeline |
| 4.5 | Create `Gbs2ProgressRing.astro` | Reading progress ring |
| 4.6 | Create `Gbs2SeriesNav.astro` | Prev/next navigation |
| 4.7 | 5 Gill pages → use Gbs2Layout | Replace `loadLegacyFullDocument` |

**Gate:** `npm run visual:parity:screenshots -- --routes /articles/dzhon-gill-*/` — ≤0.5% diff.

---

### Фаза 5: ARTICLE MDX MIGRATION (дни 6-10)

**Цель:** 20 article pages → native MDX + Astro content collections.

| # | Задача | Описание |
|---|--------|----------|
| 5.1 | Проверить legacy article content — MDX-ready? | Content audit |
| 5.2 | Create MDX files for 20 articles | `src/content/articles/*.mdx` |
| 5.3 | Create `ArticleLayout.astro` final version | На основе существующего, доработать |
| 5.4 | Create `SeriesArticleLayout.astro` final version | Для baptisty-rossii статей |
| 5.5 | 20 article pages → native MDX | Replace shadow |
| 5.6 | Проверить visual parity | screenshots |

**Gate:** `npm run visual:parity:guard` — ✅.

---

### Фаза 6: MapEngine v2 MVP (дни 7-14)

**Цель:** Создать MapEngine v2, перевести ishod, feature flag не ломает v1.

| # | Задача | Файл |
|---|--------|------|
| 6.1 | Create `karty/_engine/v2/` structure | TypeScript modules |
| 6.2 | `loadMapData.ts` + `normalizeMapData.ts` | Data pipeline |
| 6.3 | `SvgMapRenderer.ts` | SVG renderer |
| 6.4 | `RouteRenderer.ts`, `MarkerRenderer.ts`, `LabelRenderer.ts` | Sub-renderers |
| 6.5 | `MapShell.astro` | Astro island (client:load) |
| 6.6 | `MapToolbar.astro`, `MapPanel.astro`, `MapTimeline.astro` | UI components |
| 6.7 | `ishod/index.astro` → use v2 | First v2 map |
| 6.8 | Feature flag: `opts.engineVersion` | Rollback toggle |

**Gate:** `npm run maps:validate` — 10/10 ✅ (v2 ishod + 9 v1 maps). `npm run avraam:audit` — 28/28 ✅.

**Rollback:** Feature flag `v1`. 0 risk.

---

### Фаза 7: SITE.JS DECOMPOSITION (дни 10-16)

**Цель:** site.js 569 lines (165 KB minified) → reverse-engineer → 8 отдельных модулей с clean API и cleanup.

| # | Задача | Новый файл | Из site.js строк |
|---|--------|------------|:---------------:|
| 7.1 | Theme module | `js/theme.js` | ~400 |
| 7.2 | Navigation module | `js/nav.js` | ~600 |
| 7.3 | Quiz engine | `js/quiz.js` | ~800 |
| 7.4 | Flip cards | `js/flip-cards.js` | ~300 |
| 7.5 | Footnotes/tooltips | `js/footnotes.js` | ~500 |
| 7.6 | Series/interactive | `js/interactive.js` | ~400 |
| 7.7 | GBS2 runtime | `js/gbs2.js` | ~600 |
| 7.8 | Share/utilities | `js/share.js` | ~300 |
| 7.9 | Site.js → import + delegate | `js/site.js` | 569 → ~200 (bundled from modules) |
| 7.10 | Каждый модуль: AbortController cleanup | All | Cleanup function exported |

**Gate:** `npm run visual:audit` — ✅ 0 console errors, 0 network errors. Interactive-audit — ✅.

**Note:** Новые JS-файлы — исключение из правила AGENTS §2 (11 files max). Правило будет обновлено: **11 runtime files → ~18 files**, но через Astro bundling (build-time, не HTTP).

---

### Фаза 8: CLEANUP LEGACY (дни 12-16)

**Цель:** Удалить всё, что больше не нужно.

| # | Задача | Что удаляем |
|---|--------|------------|
| 8.1 | Legacy HTML for migrated routes | about/index.html, biografii/index.html, karty/index.html, etc. |
| 8.2 | `_legacy/` directories | src/components/*/_legacy/ |
| 8.3 | Dead MapEngine modules | karty/_engine/modules/ |
| 8.4 | Orphan images | ~6MB unused files |
| 8.5 | Old audit files | audit/ > 2 weeks |
| 8.6 | Old refactor docs | docs/refactor-2026/ → archive |
| 8.7 | Stale preload (Gill removed images) | Check sw.js, sitemap, feed |

**Gate:** `npm run validate:static-publication` — ✅.

---

### Фаза 9: TYPESCRIPT MIGRATION (дни 14-21)

**Цель:** Критические JS → TypeScript.

| # | Что мигрируем | Зачем | Риск |
|---|--------------|-------|:----:|
| 9.1 | MapEngine v2 | Самый критичный JS + data | Low (зелёное поле) |
| 9.2 | `src/utils/legacyShadow.ts` | Уже .ts, усилить типы | Low |
| 9.3 | `src/utils/legacyFullDocument.ts` | Уже .ts, усилить типы | Low |
| 9.4 | Theme module (js/theme.js) | Чёткий API | Medium |
| 9.5 | Quiz engine (js/quiz.js) | Complex logic | Medium |
| 9.6 | Search (js/search.js) | Ctrl+K, Pagefind | Medium |
| 9.7 | Остальные JS модули | По одному | Low-Medium |

**Gate:** `tsc --noEmit` + `node --check *.js` — ✅.

---

### Фаза 10: PERFORMANCE + CSP (дни 16-22)

**Цель:** LCP ≤2.0s, CLS ≤0.05, CSP strict-dynamic.

| # | Задача | Метрика | Метод |
|---|--------|---------|-------|
| 10.1 | LCP audit | LCP ≤ 2.0s | Lighthouse CI, optimize hero images |
| 10.2 | CLS audit | CLS ≤ 0.05 | Проверить все изображения на width/height |
| 10.3 | INP audit | INP ≤ 150ms | Long task splitting, code-split MapEngine |
| 10.4 | CSP upgrade: strict-dynamic | Security | Remove unsafe-inline, add nonces |
| 10.5 | Image optimization: AVIF for hero | Size | Hero images → AVIF + WebP fallback |
| 10.6 | Font optimization: `display: optional` | CLS | Non-critical fonts |
| 10.7 | Performance budget in CI | Budget | Lighthouse CI gate |
| 10.8 | `content-visibility: auto` on long articles | LCP | Below-fold sections |

**Gate:** Lighthouse mobile ≥95 Performance, ≥95 Accessibility.

---

### Фаза 11: MONITORING + GAPS (дни 20-25)

**Цель:** Production monitoring, accessibility, cross-data consistency.

| # | Задача | Что делаем |
|---|--------|-----------|
| 11.1 | CSP report-uri | Настроить endpoint для violation reports |
| 11.2 | Production RUM | Yandex Metrika + Core Web Vitals tracking |
| 11.3 | axe-core + Playwright accessibility | CI gate |
| 11.4 | Keyboard smoke checklist | Automation |
| 11.5 | sitemap ↔ feed ↔ manifest ↔ llms.txt sync audit | Cross-data consistency |
| 11.6 | data/series.json ↔ HTML reading time sync | Consistency |
| 11.7 | JSON-LD @id references completeness | E-E-A-T audit |
| 11.8 | Image sitemap audit | Google Images SEO |

---

### Фаза 12: AVRAAM MIGRATION (дни 21-30)

**Цель:** Самая рискованная задача — последняя. Avraam → MapEngine v2.

| # | Задача | Риск | Метод |
|---|--------|:----:|-------|
| 12.1 | Extract Avraam data to route.json | Low | Route.json уже есть, проверить полноту |
| 12.2 | MapEngine v2: port Avraam features | HIGH | Feature-by-feature: stars, caravan, GSAP, ambient |
| 12.3 | Avraam → v2 with feature flag | HIGH | `opts.engineVersion: 'avraam'` vs `'v2'` |
| 12.4 | A/B test: v1 vs v2 Avraam | HIGH | Run both, compare screenshots |
| 12.5 | Owner visual review | Critical | Обязателен |
| 12.6 | Delete avraam-app.js + legacy HTML | MEDIUM | После утверждения |

**Gate:** `npm run avraam:audit` — 28/28 ✅ (для v1). Для v2 — новый audit.

---

## 4. ROADMAP (дорожная карта)

```
Неделя 1          Неделя 2          Неделя 3          Неделя 4
┌────────────────┬────────────────┬──────────────────┬────────────────────┐
│ Фаза 0: Quick  │ Фаза 3:        │ Фаза 5:          │ Фаза 8: Cleanup    │
│ Wins           │ Native-shadow  │ Article MDX      │ legacy             │
│                │ HIGH-risk      │ migration        ├────────────────────┤
│ Фаза 1:        ├────────────────┤                  │ Фаза 9:            │
│ CI visual      │ Фаза 4:        │ Фаза 6:          │ TypeScript         │
│ gate           │ Gill GBS2      │ MapEngine v2     │ migration          │
│                │ native         │ MVP              ├────────────────────┤
│ Фаза 2:        │                │                  │ Фаза 10:           │
│ CSS @layer     │                │ Фаза 7:          │ Perf + CSP         │
│ !important     │                │ Site.js          ├────────────────────┤
│ 202→100        │                │ decomposition    │ Фаза 11:           │
│                │                │                  │ Monitoring + gaps  │
│                │                │                  ├────────────────────┤
│                │                │                  │ Фаза 12:           │
│                │                │                  │ Avraam migration   │
└────────────────┴────────────────┴──────────────────┴────────────────────┘
```

---

## 5. ЕЖЕДНЕВНЫЙ ЧЕКЛИСТ (перед каждым коммитом)

```bash
# УНИВЕРСАЛЬНЫЙ CI-GATE
npm run validate:static-publication     # 0 errors
node scripts/audit-pro.js               # ✅ PASSED
npm run visual:parity:guard             # ≤ baseline + tolerance
npm run workflows:check                 # ✅

# ЕСЛИ ТРОГАЛ CSS
npm run cache-bust
node scripts/audit-pro.js | grep "!important"  # ≤ 100 после Фазы 2

# ЕСЛИ ТРОГАЛ JS
node --check js/*.js scripts/*.js sw.js
npm run interactive-audit               # ✅

# ЕСЛИ ТРОГАЛ КАРТЫ
npm run maps:validate                   # 10/10
npm run avraam:audit                    # 28/28

# ЕСЛИ ПРОМОУТИЛ ROUTE (shadow→native)
npm run visual:parity:screenshots -- --routes /<route>/ --threshold 0.5
npm run visual:parity:baseline:update -- --route /<route>/
git add data/visual-parity-baseline.json
git commit -m "visual-baseline(<route>): owner-approved diff X% — reason"
```

---

## 6. АНТИ-РЕГРЕССИОННЫЙ КОНТРАКТ

### 6.1 Что НИКОГДА нельзя делать

1. ❌ **Deploy на `dist` без visual:parity:guard в CI.** Фаза 1 делает это невозможным.
2. ❌ **Править Avraam для «унификации».** Avraam защищён audit 28/28 до Фазы 12.
3. ❌ **Добавлять !important без двух approvals.** После Фазы 2 — только через owner.
4. ❌ **Создавать generic astro-card-grid.** Любая новая страница = native-shadow или native.
5. ❌ **Оставлять shadow-wrap без плана промоции.** Каждый shadow-wrap route имеет deadline.

### 6.2 Что всегда нужно делать

1. ✅ **Одна промоция = один PR.** Никогда не мигрировать 2+ routes в одном коммите.
2. ✅ **Feature flag для高风险 изменений.** MapEngine v2, Avraam v2, новый CSP.
3. ✅ **Visual baseline update с причиной.** `commit message visual-baseline(...): reason`.
4. ✅ **После миграции — удалять legacy.** Иначе «скелеты» накапливаются.
5. ✅ **Sync protocol для нескольких агентов.** `git fetch && git pull --rebase` перед каждым edit.

---

## 7. ФИНАЛЬНАЯ ЦЕЛЬ (конец Фазы 12)

| Метрика | Сегодня | Цель 6.0 |
|---------|:-------:|:--------:|
| Native Astro pages | 6/52 | **52/52** |
| site.css !important | 202 | **≤100** |
| Всего !important (5 files) | 493 | **≤200** |
| MapEngine paths | 3 (Avraam/v1/v2) | **1 (v2)** |
| site.js строк | 569 (165 KB minified) | **~200** (bundled from modules) |
| JS файлов runtime | 11 | **18** (через Astro build) |
| TypeScript мигрирован | 0% | **70%** (критические модули) |
| CI visual gate | Нет | **Есть** |
| Performance LCP | unknown | **≤2.0s** |
| CSP | unsafe-inline | **strict-dynamic** |
| Monitoring | None | **RUM + CSP report** |

---

## 8. ЗАКЛЮЧЕНИЕ

**Рефакторинг 6.0** — это не очередная «волна». Это перестройка правил игры:

1. **Фаза 1** (CI visual gate) — защита от повторения r244
2. **Фаза 2** (CSS @layer) — конец эпохи !important
3. **Фазы 3-6** (Native promotion) — 52/52 страниц становятся настоящими
4. **Фаза 7** (Site.js decomposition) — конец монолита 569 строк (165 KB minified)
5. **Фаза 9** (TypeScript) — safety net для будущих агентов
6. **Фаза 10** (Performance) — реальные цифры, а не догадки
7. **Фаза 12** (Avraam) — самая рискованная, самая последняя

**Главный принцип:** костыли запрещены архитектурно, а не договорённостью.