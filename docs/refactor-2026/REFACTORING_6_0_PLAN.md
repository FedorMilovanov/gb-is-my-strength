# РЕФАКТОРИНГ 6.0 — Тотальная подготовка. Без костылей. Без откатов.

**Дата:** 2026-06-21  
**Проект:** gb-is-my-strength (gospod-bog.ru)  
**Предыдущие попытки:** Рефакторинг 5.0 (Phase 1-6) — 6 волн, 30+ коммитов, 2 отката  
**Цель 6.0:** Закрыть технический долг так, чтобы больше не откатывать. Перевести проект на рельсы, где костыли невозможны архитектурно, а не только «по договорённости».

---

## 0. КОНТЕКСТ: почему откатывали прошлые рефакторинги

Проанализировав 1335 коммитов, 237KB AGENTS.md, историю AUDIT_HISTORY.md и все рефакторинг-документы, выявлены 5 коренных причин откатов:

| # | Причина | Проявление | Сколько раз |
|---|---------|-----------|:---:|
| 1 | **Отсутствие pixel-level guard при промоции** | r244: deploy switch выкатил generic astro-card-grid заглушки, хотя text/SEO gates проходили | 1 крупный + микро-регрессии |
| 2 | **Двойная архитектура рендеринга** | Правка MapEngine ломала Авраам (авраам — свой рендеринг, 9 карт — engine) | 2 (c94a3298, 22abf658) |
| 3 | **CSS-каскад без страховки** | unclosed brackets, duplicate selectors, !important как костыль | 3+ (v26, v49, v50) |
| 4 | **Generic заглушки вместо visual parity** | Astro-страницы с astro-card-grid вместо премиального legacy layout | 1 крупный |
| 5 | **Файловая избыточность** | 464 unclosed span, node_modules, patch-скрипты, мёртвые модули | постоянно |

---

## 1. ФУНДАМЕНТАЛЬНЫЕ ПРИНЦИПЫ 6.0

### 1.1 «Strangler Fig — не навсегда»

У вас уже есть strangler pattern (legacy → shadow-wrap → native-shadow → native). Проблема: **3 из 4 этапов — это «костыль»** (shadow-wrap не native). Рефакторинг 6.0 должен довести каждый route до native, а не застревать на полпути.

### 1.2 «Никакого двойного рендеринга»

MapEngine v0.x (shared engine, 9 карт) vs Avraam (monolith, 1 карта) vs MapEngine v2 (планируется). **Три** пути — это «архитектура выживания», а не стратегия. К концу 6.0 — один движок.

### 1.3 «Правильная цена абстракции»

У вас 5 CSS-файлов, 11 JS-файлов — это хорошо (бюджет). Но `site.js` = 569 строк (165 KB minified), `site.css` = 202 !important (после 40c80dc). Абстракция «единый файл» перешла в «монолит». 6.0 — расщепить, не увеличивая HTTP-запросы (через Astro bundling).

### 1.4 «Костыль = архитектурная дыра»

Если fix требует `!important` — это не fix, это debt. Если fix требует `loadLegacyFullDocument` — это не migration, это временная мера. 6.0 запрещает костыли без плана их удаления.

---

## 2. 30+ ПОИСКОВ: что мы взяли из индустрии

Ниже — ключевые инсайты из 30+ web searches (strangler pattern, Astro migration, CSS refactoring, CWV, CSP, TypeScript migration, CI/CD):

| # | Инсайт | Откуда | Применение в 6.0 |
|---|--------|--------|------------------|
| 1 | **Strangler Pattern успешен только с конечной датой.** Полу-миграция на годы — «Frankenstein». | designgurus.io, swimm.io | Каждый shadow-wrap route получает deadline native-промоции |
| 2 | **Pixel-diff guard в CI — единственный надёжный gate.** DOM-маркеры и SEO-контракты не ловят visual регрессии. | REFACTORING_5_0_PIXEL_DIFF_GUARD.md | CI-интеграция visual:parity:guard — **первый приоритет 6.0** |
| 3 | **CSS `!important` >50 в одном файле = architectural smell.** Правильный fix — слои каскада, не важность. | Smashing Magazine, codelucky.com | Completion PLAN-04: снизить site.css !important с 270 до ≤150 |
| 4 | **Высокая специфичность CSS = невозможность переиспользования.** Каждый `!important` блокирует future component extraction. | stackoverflow css refactoring | Ввести audit-pro guard на max specificity score |
| 5 | **TypeScript migration: `allowJs: true` + `checkJs: false` → постепенно.** Airbnb, Stripe так делали. | tech-insider.org, reddit TS migrate | Начать TS-миграцию с MapEngine (наиболее критичный JS) |
| 6 | **Core Web Vitals 2026: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1.** INP заменил FID в марте 2024. Статика Astro даёт преимущество, но MapEngine JS-бандлы могут быть узким местом. | corewebvitals.io, skyseodigital.com | Performance audit MapEngine, code-splitting inline CSS |
| 7 | **CSP `strict-dynamic` + nonces — современный стандарт.** `'unsafe-inline'` — legacy. | reflectiz.com, betterstack.com | Усилить CSP для всех страниц, устранить unsafe-inline где возможно |
| 8 | **Incremental migration = feature flags, не ветки.** Feature toggle позволяет A/B тестировать миграцию. | wireapps.co.uk, circleci.com | Добавить feature flag для MapEngine v2 переключения |
| 9 | **CSS Custom Properties — ключ к maintainability.** Hardcoded значения — debt. | codelucky.com | Вынести цвета, отступы, шрифты в CSS-переменные |
| 10 | **Semantic versioning baseline для visual diff.** Baseline = commit, не файл. | REFACTORING_5_0_PIXEL_DIFF_GUARD.md | Baseline data/visual-parity-baseline.json версионировать git-ом |
| 11 | **CI должен включать Playwright system deps.** Иначе flaky тесты. | REFACTORING_5_0_PIXEL_DIFF_GUARD.md | Установить system deps в workflow как обязательный шаг |
| 12 | **No `document.write`, no `innerHTML = userInput`, no `eval`.** База, но проверять. | HTML spec security | audit-pro guard на runtime injection |
| 13 | **Одна карта = отдельная SEO-страница. Не iframe, не modal.** | MAPS-DESIGN-CONTRACT.md | Сохранено (хорошо) |
| 14 | **Route.json — единый контракт. Не inline data constants.** | MAPS-DESIGN-CONTRACT.md | Сохранено (хорошо) |
| 15 | **Migrate data before logic.** Behaviour легче заменить, чем данные. | Swimm.io | Сначала route.json → validate → store, потом render |
| 16 | **Observability during migration: мониторинг обоих путей.** | designgurus.io | Ввести production console.warn при загрузке legacy shadow |
| 17 | **Удалять legacy код после миграции — нельзя копить «скелеты».** | wireapps.co.uk | После native-промоции: удалить legacy HTML + _legacy/ |
| 18 | **Rollback plan не должен быть «revert commit».** Должен быть toggle. | circleci.com | Feature flag на каждый shadow-wrap route |
| 19 | **One PR. One route. One rollback.** | REFACTORING_5_0_PIXEL_DIFF_GUARD.md | Каждая native-промоция = отдельный PR |
| 20 | **Документировать каждую миграционную фазу: scope, risk, rollback.** | swimm.io | ADR для каждой фазы 6.0 |
| 21 | **Containerization облегчает strangler pattern.** Docker image = versioned artifact. | swimm.io | Для будущей миграции хостинга |
| 22 | **`@layer` в CSS решает специфичность без `!important`.** | AGENTS.md §4.2 | Использовать @layer для GBS, nagornaya, site.css |
| 23 | **SVG `use` для map icons — уменьшает размер в 10x.** | heavymap viz fundamentals | Рефакторинг MapEngine markers через `<use>` |
| 24 | **Google рекомендует единые URL для кешируемых ресурсов.** | Google crawl budget | Astro build output хэширует имена — это хорошо, сохранить |
| 25 | **axe-core + Playwright — только часть a11y. Нужен manual smoke.** | QUALITY_GATES.md | Добавить keyboard smoke checklist |
| 26 | **Dynamic content должен резервировать место (CLS).** | CWV guide | Все img обязаны иметь width/height |
| 27 | **Astro islands — zero JS by default.** React/MapEngine = острова, остальное — статика. | astro docs | MapEngine v2 как Astro island |
| 28 | **Pagefind — работает без сервера, на статике.** | pagefind docs | Уже используется (хорошо) |
| 29 | **Третья сторона (Google Fonts, Metrika) = CLS риск.** Нужен preconnect + preload. | betterstack.com | Уже preload (проверить полноту) |
| 30 | **Feature toggle + percentage-based routing = безопасный rollout.** | wireapps.co.uk | Для MapEngine v2 A/B тест |

---

## 3. ИНВЕНТАРИЗАЦИЯ КОСТЫЛЕЙ (что сейчас мешает)

### 3.1 😱 CRITICAL — архитектурные проблемы

| Костыль | Где | Почему это костыль | Цена |
|---------|-----|-------------------|:----:|
| **Двойной рендеринг карт** | Avraam (monolith) vs MapEngine (9 карт) vs v2 (planned) | 3 пути = тройная поддержка, тройной риск регресса | 4792 строк avraam (extracted) + 2590 engine + dead modules (FIXED) |
| **Shadow-wrap 30+ страниц** | 30 из 52 production routes | Не native, не редактируются, не используют Astro преимущества | 30 `loadLegacyFullDocument` вызовов |
| **CSS `!important` 270** | site.css | Блокирует рефакторинг, затрудняет вынос компонентов | 270 костылей в одном файле |
| **JS 130+ addEventListener без remove** | site.js | Memory leak при SPA-like navigation (если появится) | 130 potential leaks |
| **MapEngine CSS встроен в JS** | map-engine.js ~103 строк CSS | Нельзя переиспользовать, нельзя tree-shake | 103 строки inline |

### 3.2 ⚠️ HIGH — проблемы качества

| Костыль | Где | Почему | Цена |
|---------|-----|--------|:----:|
| **Avraam extracted 4792 строк** | karty/avraam/index.html + avraam-app.js | JS extracted (9115253), но всё ещё high-risk | 4792 строк |
| **5 Gill страниц в shadow** | articles/dzhon-gill-* | GBS2 world не перенесён в Astro native | 5 routes в limbo |
| **Nagornaya Tailwind отдельно** | nagornaya/tw.min.css + nagornaya-mobile-toc.css | Дополнительный слой технологий, отдельная сборка | 2 CSS файла + отдельный build step |
| **Dead code modules/** | karty/_engine/modules/ | Мёртвый код от провального рефакторинга | 3 файла, ~413 строк |
| **Visual parity guard не в CI** | visual-parity-screenshots.js | Только локально, не защищает production | Нет CI gate для визуала |
| **Отсутствие TypeScript в runtime** | js/*.js (11 файлов) | Нет типов, нет safety net для рефакторинга | 11 untrusted files |

### 3.3 🔸 MEDIUM — операционные проблемы

| Костыль | Где | Почему | Цена |
|---------|-----|--------|:----:|
| **site.js 569 lines (165 KB minified)** | js/site.js | Reverse-engineer required | 29 модулей в одном бандле |
| **site.css 202 !important** | css/site.css | Barrier to component extraction | 202 overrides |
| **Inline style 20-antisovetov** | articles/20-antisovetov-pastoru/ | 12KB inline CSS — единственный оставшийся inline island | ~12KB |
| **Multiple agents sync** | baptisty-rossii/research/** | Конкурирующие агенты могут конфликтовать | ~70 research .md файлов |
| **Нет production observability** | нет мониторинга реальных пользователей | Не знаем реальный CWV, ошибки | Слепое пятно |

---

## 4. ПЛАН 6.0 — 8 ФАЗ, 30+ ЗАДАЧ

### Фаза 0: CI/gate интеграция (неделя 1) — 5 задач

**Цель:** Сделать visual parity guard частью CI, чтобы все следующие фазы были защищены.

| # | Задача | Проверка | Риск |
|---|--------|----------|:----:|
| 0.1 | Установить Playwright system deps в GitHub Actions runner | `npx playwright install-deps chromium` ✅ | Низкий |
| 0.2 | Интегрировать `visual:parity:guard` в `strangler:deploy-readiness` | CI green ✅ | Средний (flaky) |
| 0.3 | Создать `.github/workflows/visual-parity.yml` — weekly + manual trigger | Workflow runs ✅ | Низкий |
| 0.4 | При failure — GitHub Issue с diff PNG аттачем | Issue created ✅ | Низкий |
| 0.5 | Обновить `check-workflows.js` guard на новый workflow | `workflows:check` ✅ | Низкий |

**Критерий успеха:** `npm run visual:parity:guard` запускается в CI и валит pipeline при diff > baseline.

**Rollback:** `git revert` изменений workflow + package.json.

---

### Фаза 1: CSS-завершение (неделя 1-2) — 5 задач

**Цель:** ✅ site.css !important ≤150, ❌ без generic card-grid заглушек.

| # | Задача | Костыль | Метод |
|---|--------|---------|-------|
| 1.1 | Аудит всех 202 !important: specificity расчёт для каждого | G270 audit | `grep -n '!important' site.css` → per-rule analysis |
| 1.2 | `@layer reset, base, components, utilities` — перевести site.css в слои | ~100 !important | CSS @layer — unlayered rules бьют любой @layer |
| 1.3 | Вынести GBS2 стили в отдельный @layer | ~30 !important | `@layer gbs2 { ... }` |
| 1.4 | Вынести Nagornaya стили в @layer | ~25 !important | `@layer nagornaya { ... }` |
| 1.5 | Проверить баланс скобок, убрать дубликаты | 0 unclosed | `python3 -c "s=open('css/site.css').read();print(s.count('{')-s.count('}'))"` |

**Gate:** `npm run tokens:check && node scripts/audit-pro.js` — ✅ 0 errors, !important ≤ 150.

**Rollback:** git revert per-task commit.

---

### Фаза 2: Shadow-wrap → Native-shadow для HIGH-risk (неделя 2-3) — 4 задачи

**Цель:** Авраам, Карты, Баптисты, Нагорная, Главная — перевести с full-document shadow на native-shadow (как `/about/` в r249).

| # | Задача | Route | Метод |
|---|--------|-------|-------|
| 2.1 | `/karty/` — извлечь semantic блоки в Astro компоненты | HIGH | Extract hub + card-grid через extract-native-pilot.js |
| 2.2 | `/baptisty-rossii/` — извлечь GBS2 landing | HIGH | GBS2 components + _legacy/ body segments |
| 2.3 | `/nagornaya/` — извлечь Tailwind-мир | HIGH | NagornayaPageMain → named sub-components |
| 2.4 | `/` (home) — извлечь home компоненты | HIGH | HomeMain → Hero, MobileHub, Dashboard, Rail, Paths, Dock |

**Gate:** `npm run visual:parity:guard` — 0.000% desktop+mobile для каждого route.

**Rollback:** `git revert` — возврат к full-document shadow.

---

### Фаза 3: MapEngine v2 MVP (неделя 2-4) — 6 задач

**Цель:** Создать MapEngine v2, перевести 1 карту (ishod) как proof of concept. Avraam не трогать.

| # | Задача | Что делаем |
|---|--------|-----------|
| 3.1 | Создать структуру `karty/_engine/v2/` (см. MAPS-ADR-2026-06-21.md) | TypeScript modules |
| 3.2 | `loadMapData.ts` + `normalizeMapData.ts` + `validateMapData.ts` | Pure data pipeline |
| 3.3 | `SvgMapRenderer.ts` — base geo + routes + markers + labels | SVG renderer via shared `<use>` |
| 3.4 | `MapShell.tsx` — Astro island (React) | UI shell с panel/timeline/layers |
| 3.5 | `isod/index.html` → перейти на MapEngine v2 | Первая карта на новом движке |
| 3.6 | Feature flag: `opts.engineVersion: 'v1' | 'v2'` | Rollback toggle |

**Gate:** `npm run maps:validate` — 10/10 (v1 maps + v2 ishod). `npm run avraam:audit` — 28/28 (avraam unchanged).

**Rollback:** Feature flag `engineVersion: 'v1'`. Ноль риска для production.

---

### Фаза 4: Gill GBS2 → Native Astro (неделя 3-4) — 3 задачи

**Цель:** 5 Gill страниц перевести с full-document shadow на GBS2-native Astro компоненты.

| # | Задача | Что делаем |
|---|--------|-----------|
| 4.1 | Создать `Gbs2SeriesLayout.astro` (извлечь из SeriesArticleLayout + legacy shadow) | Единый layout для всех серий |
| 4.2 | GBS2 components: `Gbs2Rail`, `Gbs2MobileSheet`, `Gbs2Timeline`, `Gbs2ProgressRing` | Named Astro components |
| 4.3 | 5 Gill MDX → обновить frontmatter под GBS2 | `series: 'gill'` + series-specific props |

**Gate:** `npm run visual:parity:screenshots -- --routes /articles/dzhon-gill-*/` — ≤0.5% diff.

**Rollback:** git revert.

---

### Фаза 5: Native page promotion (неделя 3-5) — 8 задач

**Цель:** Все 30+ shadow-wrap routes → native-shadow (готовят почву для полного native).

По приоритету (см. REFACTORING_5_0_PIXEL_DIFF_GUARD.md roadmap):

| # | Route | Текущий статус | Целевой статус |
|---|-------|---------------|----------------|
| 5.1 | `/karty/` | full-shadow | native-shadow ✅ |
| 5.2 | `/baptisty-rossii/` | full-shadow | native-shadow ✅ |
| 5.3 | `/nagornaya/` | full-shadow | native-shadow ✅ |
| 5.4 | `/` (home) | full-shadow | native-shadow ✅ |
| 5.5 | `/nagornaya/chast-1..5/` | full-shadow | native-shadow ✅ |
| 5.6 | `/nagornaya/seriya/` | full-shadow | native-shadow ✅ |
| 5.7 | `/nagornaya/istochniki/` | full-shadow | native-shadow ✅ |
| 5.8 | `/nagornaya/nakhodki/` | full-shadow | native-shadow ✅ |

**Gate:** `npm run visual:parity:guard` — все 52 routes green, каждый с individual baseline update.

---

### Фаза 6: Удаление legacy (неделя 4-6) — 3 задачи

**Цель:** После native-промоции — удалить legacy HTML и _legacy/ фрагменты.

| # | Задача | Что удаляем |
|---|--------|------------|
| 6.1 | Legacy HTML files | `about/index.html`, `biografii/index.html`, `karty/index.html`, ... |
| 6.2 | `_legacy/` directories | `src/components/*/_legacy/` — больше не нужны |
| 6.3 | Dead MapEngine modules | `karty/_engine/modules/` — мёртвый код |

**Gate:** `npm run validate:static-publication` — ✅. `npm run visual:parity:guard` — ✅.

---

### Фаза 7: TypeScript постепенная миграция (неделя 5-8) — 4 задачи

**Цель:** Перевести критические JS-файлы в TypeScript.

| # | Что мигрируем | Почему первым |
|---|--------------|---------------|
| 7.1 | `karty/_engine/map-engine.js` → `map-engine.ts` | Самый критичный JS, данные + рендеринг |
| 7.2 | `src/utils/legacyShadow.ts`, `legacyFullDocument.ts` | Уже .ts, усилить типы |
| 7.3 | `js/site.js` наиболее стабильные модули → TypeScript | Выборочно, модули с чёткими API |
| 7.4 | `scripts/` — audit scripts | Уже Node.js, низкий риск |

**Gate:** `tsc --noEmit` + `node --check *.js` — все проходят.

---

### Фаза 8: Performance + CSP (неделя 6-8) — 4 задачи

**Цель:** LCP ≤2.0s, CLS ≤0.05, INP ≤150ms. CSP — strict-dynamic.

| # | Задача | Метод |
|---|--------|-------|
| 8.1 | Performance audit MapEngine | Code-split inline CSS, lazy-load non-critical |
| 8.2 | CSP upgrade: `strict-dynamic` вместо `unsafe-inline` | Для новых страниц; legacy — transitional |
| 8.3 | Image optimization pass | AVIF для hero, webp responsive для остальных |
| 8.4 | Font loading optimization | `font-display: optional` для не-критических шрифтов |

**Gate:** Lighthouse mobile ≥95 Performance, ≥95 Accessibility.

---

## 5. ДОРОЖНАЯ КАРТА (Timeline)

```
Неделя 1         Неделя 2         Неделя 3-4        Неделя 5-6        Неделя 7-8
┌────────────────┬────────────────┬──────────────────┬────────────────┬────────────────┐
│ Фаза 0: CI     │ Фаза 1: CSS    │ Фаза 2: Native   │ Фаза 4: Gill   │ Фаза 6:        │
│ visual guard   │ !important     │ shadow HIGH-risk │ GBS2 native    │ Cleanup legacy │
│                │ 270→150        │ Karty/Bapt/      │                ├────────────────┤
│                │                │ Nagornaya/Home   │ Фаза 5: Native │ Фаза 7:        │
│                │                ├──────────────────┤ promotion      │ TypeScript     │
│                │                │ Фаза 3:          │ (8 routes)     │ migration      │
│                │                │ MapEngine v2     │                ├────────────────┤
│                │                │ ishod proof      │                │ Фаза 8:        │
│                │                │                  │                │ Perf + CSP     │
└────────────────┴────────────────┴──────────────────┴────────────────┴────────────────┘
```

---

## 6. ГЛОССАРИЙ РИСКОВ (как не упасть снова)

| Ситуация | Как избежали в 6.0 |
|----------|-------------------|
| Deploy switch без visual gate | Фаза 0: visual:parity:guard в CI |
| Generic astro-card-grid | Фаза 2: native-shadow рецепт с pixel-diff |
| Правка движка ломает Avraam | Фаза 3: Feature flag v1/v2 + avraam:audit 28/28 |
| CSS каскад ломает layout | Фаза 1: @layer + !important ≤150 |
| Нельзя откатить коммит | Каждая фаза = отдельный PR, feature toggle |
| Конфликт нескольких агентов | sync protocol (AGENTS §9.29) + rebase policy |
| Visual flaky тесты | retry-loop (r250) + pixelmatch tolerancePct |

---

## 7. ЧЕКЛИСТ ПЕРЕД КАЖДЫМ PUSH

```bash
# 1. Обязательно
npm run validate:static-publication     # 0 errors
node scripts/audit-pro.js               # ✅ PASSED
npm run visual:parity:guard             # ≤ baseline + tolerance
npm run workflows:check                 # ✅

# 2. Если трогал CSS/JS
npm run cache-bust

# 3. Если трогал карты
npm run maps:validate                   # 10/10
npm run avraam:audit                    # 28/28

# 4. Если трогал MapEngine
node --check karty/_engine/map-engine.js
npm run visual:parity:screenshots -- --routes /karty/

# 5. Если промоутил route
npm run visual:parity:baseline:update -- --route /<route>/
# commit message: "visual-baseline(<route>): owner-approved diff X% — reason"
```

---

## 8. ЗАКЛЮЧЕНИЕ

**Рефакторинг 6.0** — это не очередная «волна правок». Это изменение правил игры.

1. **Visual parity guard в CI** — больше никаких «текст совпал → deploy».
2. **CSS @layer + !important ≤150** — больше никакого каскадного хаоса.
3. **MapEngine v2 с feature flag** — больше никаких сломанных карт.
4. **Native-shadow для всех routes** — каждая страница редактируема.
5. **TypeScript для критического кода** — safety net для будущих агентов.

После 6.0 проект становится **не костыльным**, а **инженерным**: каждая правка защищена, каждый баг — событие, каждый откат — аномалия.

**Начни с Фазы 0. Пока CI не защищён — все остальное может сломаться снова.**
