# РЕФАКТОРИНГ 6.0 — ПЛАН РАБОТЫ С РЕАЛЬНОСТЬЮ (REALITY PLAN)

**Дата:** 2026-06-21  
**Версия:** 1.0 (post-verification)  
**Статус:** все 51 production route сидят на `loadLegacyFullDocument`, но это не один implementation-класс: 33 pure full-body shadow + 18 componentized/hybrid shadow. MDX orphaned from production. Native layouts orphaned from live rendering.
**Принцип:** Не мечтать о том, что было до 20 июня. Строить из того, что есть, и различать pure-shadow и hybrid-shadow lanes.

---

## 0. ДИАГНОСТИКА: ПОЧЕМУ ПРЕДЫДУЩИЙ ПЛАН НЕРАБОТОСПОСОБЕН

См. также:
- `research/PRODUCTION_ROUTE_TAXONOMY_2026-06-21.md`
- `research/MIGRATION_LANE_PRIORITY_2026-06-21.md`
- `research/EXTERNAL_MIGRATION_CONSTRAINTS_2026-06-21.md`
- `docs/refactor-2026/PILOT_DOSSIER_ABOUT_2026-06-21.md`
- `docs/refactor-2026/PILOT_DOSSIER_KOD_DA_VINCHI_2026-06-21.md`

### 0.1 Архитектурный deadlock

| Предположение старого плана | Реальность |
|----------------------------|------------|
| "6 native-shadow pages" | 0 true native production pages. Но есть 18 componentized/hybrid shadow routes, их нельзя смешивать с 33 pure routes. |
| "CSS @layer через Astro bundling" | Astro не бандлит CSS для production shadow-страниц; они подгружают `/css/site.css` напрямую из legacy head. |
| "MDX migration в Phase 5" | MDX-код orphaned от production; рендерится только через native Astro path, который сейчас не live. |
| "TypeScript migration Phase 9" | Нет production entry point для TS-компонентов, кроме build/dev scaffolding. |

### 0.2 Единственный путь: Shadow-breakout pilot + split lanes

Нельзя мигрировать 51 route одновременно и нельзя планировать их как один класс. Нужно:
1. Разделить production на **2 migration lanes**: 18 hybrid/componentized routes и 33 pure full-body routes.
2. Выбрать **1 pilot-страницу** с минимальным риском в pure/content lane.
3. Отдельно выбрать **1 shell-first candidate** в hybrid lane.
4. Пройти через **все гейты** (visual parity, audit-pro, interactive-audit).
5. Только потом — массовый rollout.

---

## 1. ВЫБОР PILOT-СТРАНИЦЫ

### 1.1 Критерии (по убыванию приоритета)

| # | Критерий | Почему |
|---|----------|--------|
| 1 | **Минимум interactive JS** | Меньше site.js зависимостей = меньше риск regression |
| 2 | **Есть MDX-файл** | Чтобы не создавать контент с нуля |
| 3 | **Есть working native layout** | `ArticleLayout.astro` или `SeriesArticleLayout.astro` уже существуют (orphaned) |
| 4 | **Нет карт / genealogy / complex JS** | Исключить специальные рендереры |
| 5 | **Низкий трафик** | Если что-то пойдёт не так — минимум пользователей пострадает |
| 6 | **Есть visual parity baseline** | Можно сравнить до/после |

### 1.2 Рейтинг кандидатов

| Страница | MDX | Live route class | Interactive JS | Карты | Трафик | Score |
|----------|-----|------------------|----------------|-------|--------|-------|
| `/about/` | ❌ | hybrid page-segment shadow | Низкий | Нет | Средний | ⭐⭐⭐⭐ (shell-first lane) |
| `/articles/kod-da-vinchi/` | ✅ | pure full-body shadow (`body.gbs-paper`) | Средний | Нет | Средний | ⭐⭐⭐⭐⭐ **WINNER (content-lane)** |
| `/articles/20-antisovetov-pastoru/` | ✅ | pure full-body shadow (`pastor-series`) | Высокий | Нет | Высокий | ⭐⭐⭐ |
| `/articles/rimlyanam-7/` | ✅ | pure full-body shadow (`hard-texts` / GBS2 chrome) | Средний–высокий | Нет | Низкий | ⭐⭐⭐ |
| `/baptisty-rossii/spravochnik/` | ✅ | pure full-body shadow (`russian-baptism`) | Средний | Нет | Низкий | ⭐⭐⭐⭐ |

**Pilot content-lane:** `/articles/kod-da-vinchi/`
- MDX: `src/content/articles/kod-da-vinchi.mdx` ✅
- Route class: pure full-body shadow ✅
- Legacy shell: standard `gbs-paper`, не GBS2 series chrome ✅
- Нет `gbs2-rail`, mobile sheet и series progress runtime ✅
- Лучше подходит для first standard-article breakout, чем `rimlyanam-7`
- Visual parity baseline: есть

**Pilot shell-lane:** `/about/`
- Route class: hybrid page-segment shadow ✅
- Уже имеет extraction seams: `body-before`, `body-mid`, `body-after`, `AboutArticle`, `AboutAccuracyBlock`
- Не имеет MDX, зато идеально подходит для доказательства постепенной замены raw fragments на real Astro markup

---

## 2. ФАЗЫ: РЕАЛИСТИЧНАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ

### ФАЗА 0: FOUNDATION (день 1, 2-4 часа)

**Цель:** Подготовить инфраструктуру, чтобы breakout был возможен.

| # | Задача | Результат | Гейт |
|---|--------|-----------|------|
| 0.1 | **Проверить `ArticleLayout.astro`** — работает ли он с Astro 6, собирается ли с MDX | Build без ошибок | `npm run strangler:build:production-like` exit 0 |
| 0.2 | **Создать `/dev/pilot-kod-da-vinchi.astro`** | Dev-страница с MDX рендером для standard article path | localhost visual check |
| 0.3 | **Подтвердить content route wiring** | `src/content.config.ts` уже знает про `kod-da-vinchi`; проверить `getEntry()+render()` path | `npx astro sync` без ошибок |
| 0.4 | **Проверить `site.js` в native-контексте** | Footnotes/tooltips/highlights работают в Astro-bundled странице | Interactive-audit PASS |

**Rollback:** удалить `/dev/pilot-rimlyanam.astro`.

---

### ФАЗА 1: SHADOW-BREAKOUT PILOT (дни 1-3)

**Цель:** Первая production-страница выходит из shadow-wrap. Остальные 50 — не трогаем.

| # | Задача | Детали | Риск |
|---|--------|--------|------|
| 1.1 | **Реверт `src/pages/articles/kod-da-vinchi/index.astro` в pilot branch** | Удалить pure `bodyHtml` transport и собрать standard article breakout | Medium |
| 1.2 | **Не использовать `ArticleLayout` как есть без доказательства parity** | Сначала проверить разницу между legacy `gbs-paper` shell и current `ArticleLayout`/`BaseLayout` output | Medium |
| 1.3 | **Сделать first breakout через extracted shell** | Использовать `extract-native-pilot.js`: legacy head + body-segments + MDX `Content` inside standard article shell | Low |
| 1.4 | **Проверить CSS/JS contract** | `site.css`, `command-palette.css`, `mobile-hotfix.css`, `site.js`, `search.js` должны остаться через legacy-compatible includes | Medium |
| 1.5 | **Visual parity screenshot** | Сравнить `/articles/kod-da-vinchi/` (pilot) vs legacy root | Medium |
| 1.6 | **audit-pro** | Проверить single-h1, meta-tags, canonical, OG | Low |
| 1.7 | **Interactive-audit** | Footnotes, tooltips, theme toggle, mobile nav | Low |

**Гейты:**
```
visual parity: ≤0.5% diff desktop + mobile
audit-pro: 0 errors
interactive-audit: 0 console errors
build: exit 0
```

**Rollback:** `git revert` одним коммитом. Все 50 shadow-страниц не тронуты.

---

### ФАЗА 2: CSS @layer — НЕЗАВИСИМО ОТ ASTRO (дни 2-5, параллельно с 1)

**Цель:** Создать `css/site-layered.css` — новый CSS-файл с @layer архитектурой. Не трогать `site.css`.

**Почему независимо от Astro:** shadow-wrap страницы подгружают `/css/site.css` напрямую. Мы не можем заменить его, пока не уверены, что @layer-версия работает. Решение: **двойная загрузка**.

| # | Задача | Детали |
|---|--------|--------|
| 2.1 | Создать `css/site-layered.css` | `@layer reset, base, gbs2, nagornaya, components, utilities, overrides;` |
| 2.2 | Мигрировать `site.css` → `site-layered.css` по частям | Сначала base + utilities (безопасно), потом components, потом gbs2/nagornaya |
| 2.3 | Создать `scripts/css-layer-validator.js` | Проверяет: нет unclosed braces, layer order правильный, !important count |
| 2.4 | Pilot-страница `kod-da-vinchi` подключает `site-layered.css` вместо `site.css` | Только после parity-proof для extracted standard-article shell |
| 2.5 | Visual parity для pilot | ≤0.5% diff |

**Гейт:** `node scripts/css-layer-validator.js` + visual parity pilot.

**Rollback:** вернуть `site.css` в `<link>`.

---

### ФАЗА 3: SITE.JS DECOMPOSITION (дни 3-7, параллельно)

**Цель:** Разбить `site.js` (569 строк / 165 KB минимизированного) на модули с `AbortController` cleanup.

**Проблема:** site.js — минимизированный бандл. Нет source map. Нужен reverse-engineering.

| # | Задача | Метод | Гейт |
|---|--------|-------|------|
| 3.1 | **Препарировать site.js** | `js-beautify` или Prettier → readable формат. Сохранить в `js/site.prettified.js` (не в git) | Читаемость |
| 3.2 | **Идентифицировать модули** | Поискать паттерны: `function t(e){...}` (theme?), `function n(e){...}` (nav?), tooltip controller | Список модулей |
| 3.3 | **Извлечь Theme модуль** | `js/modules/theme.js` — dark/light toggle, `localStorage`, `matchMedia` | `node --check` |
| 3.4 | **Извлечь Tooltip/Popover модуль** | `js/modules/tooltip.js` — всё, что связано с `gb-floating-tip`, `data-tooltip` | `node --check` |
| 3.5 | **Извлечь Footnote/Reader модуль** | `js/modules/footnotes.js` — hover footnotes, sidenotes | `node --check` |
| 3.6 | **Извлечь Navigation модуль** | `js/modules/nav.js` — mobile nav, scroll spy, TOC | `node --check` |
| 3.7 | **Создать `js/site-v2.js` (бандл)** | `esbuild` или `rollup` — собирает модули в один файл, но с source map | build OK |
| 3.8 | **Пилотная страница подключает `site-v2.js`** | Проверяем, что все интерактивные элементы работают | interactive-audit PASS |

**Гейт:** interactive-audit pilot = 0 errors. memory leak check: Chrome DevTools Performance → listener count до/после 5 переходов.

---

### ФАЗА 4: PILOT EXPANSION (дни 5-10)

**Цель:** 3-5 страниц в native Astro. Проверить масштабируемость.

| # | Страница | Почему | Phase |
|---|----------|--------|-------|
| 4.1 | `/about/` | Нет MDX, но простейший контент. Проверяет native layout без MDX. | 4.1 |
| 4.2 | `/articles/20-antisovetov-pastoru/` | Самый большой MDX. Проверяет performance и memory. | 4.2 |
| 4.3 | `/articles/dzhon-gill-istoricheskiy-kontekst/` | MDX richer than HTML (+129 words). Проверяет, что MDX-улучшения доходят до production. | 4.3 |
| 4.4 | `/baptisty-rossii/spravochnik/` | Series layout. Проверяет `SeriesArticleLayout`. | 4.4 |
| 4.5 | `/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/` | HTML richer than MDX (footnotes). Проверяет edge case. | 4.5 |

**Гейт для каждой:** visual parity ≤0.5%, audit-pro 0 errors, interactive-audit 0 errors.

---

### ФАЗА 5: MDX NATIVE RENDERING + CONTENT PARITY (дни 7-14)

**Цель:** Убедиться, что MDX-улучшения (новые заголовки, alt, figure) отображаются в production.

| # | Задача | Метод |
|---|--------|-------|
| 5.1 | **Улучшить `check-mdx-html-parity.js`** | Добавить semantic check: `<h2>` count, `<img alt>` count, `<figure>` count, `<a>` count. Не только word count. |
| 5.2 | **Исправить shallow-clone trap** | Записать `data/content-versions.json` с timestamp последнего редактирования MDX и HTML. Или использовать `git log --follow --diff-filter=M`. |
| 5.3 | **Port MDX improvements back to HTML** | Для страниц, где MDX richer, но страница ещё в shadow-wrap: скрипт `scripts/sync-mdx-to-html.js` — извлекает MDX body, конвертирует в HTML, вставляет в legacy `index.html`. |
| 5.4 | **Проверить на pilot-страницах** | `kod-da-vinchi` и другие pilot routes должны показывать MDX content verbatim внутри legacy-compatible shell. |

**Гейт:** `node scripts/check-mdx-html-parity.js` — 0 errors, 0 warnings. Semantic check: 0 mismatches.

---

### ФАЗА 6: CI/CD BLOCKING GUARD (дни 10-14)

**Цель:** Visual parity + audit-pro становятся **blocking** в `deploy.yml`.

| # | Задача | Детали | Риск |
|---|--------|--------|------|
| 6.1 | **Добавить `visual-parity:guard` в `deploy.yml`** | Перед `upload-pages-artifact`. Если diff > 0.5% — CI red, deploy blocked. | Medium — может быть flake |
| 6.2 | **Настроить threshold profiles** | `critical` (0.1%), `standard` (0.5%), `lenient` (1.0%) per route. `/about/` = critical, `/articles/` = standard. | Low |
| 6.3 | **Добавить `mask` для dynamic content** | Yandex Metrika, random phrases, date/time. | Low |
| 6.4 | **Lighthouse CI gate** | Performance ≥95, Accessibility ≥95, Best Practices ≥95. | Medium |
| 6.5 | **CSP report-uri endpoint** | Для будущего strict-dynamic. Сейчас — мониторинг. | Low |

**Гейт:** `deploy.yml` в PR должен проходить parity + Lighthouse + audit-pro. Если red — нет merge.

---

### ФАЗА 7: MASS MIGRATION (дни 14-30)

**Цель:** 20 статей + 5 landings → native Astro. Остальные 25 (карты, родословие, специальные) — остаются в shadow.

| # | Группа | Страницы | Метод |
|---|--------|----------|-------|
| 7.1 | Articles (main) | 10 | `ArticleLayout` + MDX |
| 7.2 | Articles (baptisty) | 10 | `SeriesArticleLayout` + MDX |
| 7.3 | Landings | `/`, `/about/`, `/articles/`, `/biografii/`, `/hard-texts/`, `/konfessii/`, `/pastor-series/` | Native Astro layouts |
| 7.4 | Nagornaya | 8 страниц | Special handling — Tailwind + custom TOC |

**Гейт:** каждая страница — visual parity ≤0.5%, audit-pro 0 errors.
**Rollback:** per-page `git revert`.

---

### ФАЗА 8: MAPENGINE + SPECIAL PAGES (дни 21-60)

**Цель:** Карты, родословие, интерактивные приложения — последние выходят из shadow.

| # | Страница | Почему последняя | Риск |
|---|----------|------------------|------|
| 8.1 | `/karty/ishod/` | MapEngine v2 pilot. Feature flag. | Medium |
| 8.2 | `/karty/avraam/` | Avraam — самый сложный, 4789 строк. Последний. | High |
| 8.3 | `/rodosloviye/` | GenealogyTree — React Flow, 156 persons. | High |
| 8.4 | `/konfessii/russkij-baptizm/` | Three.js app — iframe, CSP `unsafe-eval`. | Medium |

**Гейт:** `maps:validate` 10/10, `avraam:audit` 28/28, interactive-audit 0 errors.

---

## 3. ЕЖЕДНЕВНЫЙ ЧЕКЛИСТ (перед каждым коммитом)

```bash
# 1. Build
export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH
npm run strangler:build:production-like
# exit 0?

# 2. Audit (всегда)
node scripts/audit-pro.js | tail -3
# ✅ 0 errors

# 3. Parity (если трогал MDX или HTML)
node scripts/check-mdx-html-parity.js
# ✅ 0 errors, 0 warnings

# 4. Visual parity (если трогал pilot)
node scripts/visual-parity-screenshots.js --routes /articles/kod-da-vinchi/
# ≤0.5%

# 5. CSS validator (если трогал CSS)
node scripts/css-layer-validator.js
# brace balance OK, !important ≤ target

# 6. Interactive (если трогал JS)
python3 -m http.server 8090 --directory dist &
node scripts/interactive-audit.js
# 0 console errors

# 7. Только теперь git add + commit + push
```

---

## 4. КЛЮЧЕВЫЕ ИНСАЙТЫ ИЗ ПОИСКА (2026)

### 4.1 Strangler Fig + Feature Flags [1](https://findskill.ai/skills/claude-code/legacy-code-modernizer/)
- **Branch by Abstraction:** Создать proxy layer, который выбирает между legacy и modern handler по feature flag.
- **Kill switch:** Не toggle для включения, а toggle для мгновенного отключения.
- **Применение:** Pilot-страницы могут иметь `?native=1` query param или cookie для forced legacy mode.

### 4.2 Zero-Downtime Refactoring [2](https://www.in-com.com/blog/zero-downtime-refactoring-how-to-refactor-systems-without-taking-them-offline/)
- **Read parity → Write parity → Migrate reads → Migrate writes → Decommission.**
- Для контента: убедиться, что MDX содержит всё, что HTML (read parity), потом писать только в MDX (write parity), потом переключить рендеринг.

### 4.3 CSS @layer Practical [3](https://www.smashingmagazine.com/2025/09/integrating-css-cascade-layers-existing-project/)
- **Unlayered styles beat any @layer.** Это позволяет инкрементальную миграцию: wrap старый CSS в `@layer legacy`, а новый CSS — unlayered (высший приоритет).
- **!important инвертирует порядок слоёв.** Если в `legacy` слое есть `!important`, он будет сильнее, чем `!important` в новых слоях. Нужно избавляться от `!important` ДО миграции.

### 4.4 Playwright Visual Regression [4](https://testquality.com/playwright-visual-regression-guide/)
- **Cross-OS rendering breaks pixel diffs.** Решение: Docker container (`mcr.microsoft.com/playwright`) для CI.
- **Component snapshots > full-page.** Меньше scope = меньше flake.
- **Git cannot diff images inline.** Нужен dashboard или PR comment с diff images.
- **Threshold profiles:** critical (0.1%), standard (0.5%), lenient (1.0%) per page type.

### 4.5 Astro 6 Content Layer [5](https://inhaq.com/blog/getting-started-with-astro-content-collections)
- **Astro 6 требует `loader` для каждой коллекции.** Нельзя использовать `type: 'content'` (deprecated).
- **MDX в content collections:** `import { render } from 'astro:content'; const { Content } = await render(entry);`.
- **Zero JS by default:** Astro не ship-ит клиентский JS, если не запросить `client:load`/`client:idle`.

### 4.6 TypeScript Migration [6](https://dev.to/oluwatosinolamilekan/migrating-a-legacy-codebase-across-15-modules-without-downtime-an-engineering-transformation-story-776)
- **`allowJs: true` + `checkJs: false` → постепенно.**
- **JSDoc аннотации перед полной миграцией.**
- **`npx tsc --noEmit` в CI gate.**

---

## 5. ОСОБЕННОСТИ И ЛАЙФХАКИ (SANDBOX + PROJECT)

### 5.1 Sandbox survival (verified)
- `bash` + `cat > file` надёжнее `write_file` для больших файлов.
- `edit_file` часто падает — использовать `sed -i`.
- `read_file` на файлах >500 KB может упасть — использовать `head -100`/`grep`.
- `web_search depth=2` достаточно; `depth=3` → 50-100 KB, переполняет context.
- **>3 tool calls за ответ = риск сброса сессии.**

### 5.2 Project quirks
- `site.js` — минимизированный бандл. Для декомпозиции нужен `js-beautify` или reverse-engineering.
- `karty/_engine/modules/` — удалён (83ae4a8). Не искать.
- Avraam JS вынесен в `avraam-app.js` (9115253). Не трогать без owner-approval.
- `nagornaya/tw.min.css` — Tailwind, но не интегрирован в Astro build. Подключается через `<link>`.
- `konfessii/_app/index.html` — CSP `unsafe-eval` для Three.js. НЕ ТРОГАТЬ.

### 5.3 CSS @layer migration path
```
Текущий: site.css (270 KB, 202 !important, unlayered, highest priority)

Шаг 1: Создать site-layered.css:
  @layer reset, base, gbs2, nagornaya, components, utilities, overrides;
  @layer base { /* все base styles из site.css */ }
  @layer components { /* все .h-*, .card, .tooltip */ }
  @layer gbs2 { /* body.gbs-world */ }
  @layer nagornaya { /* nagornaya-specific */ }
  @layer utilities { /* .text-center, .hidden */ }
  @layer overrides { /* !important mobile hotfixes */ }

Шаг 2: Pilot-страница подключает site-layered.css вместо site.css.

Шаг 3: Если в site-layered.css что-то сломано — unlayered styles в конце файла
        (или отдельный site-fix.css) fix-ят без !important.

Шаг 4: Когда все страницы на site-layered.css — удалить site.css.
```

### 5.4 Pilot gating на текущем хостинге

**Важно:** текущий production — это `output: 'static'` + GitHub Pages. Поэтому server-side gating через `Astro.cookies`, request headers или middleware **на текущем хостинге не работает**.

Что реально возможно сейчас:
- отдельный `dev/` preview route;
- отдельный production-dist artifact для ручного smoke review;
- client-side query/localStorage toggle только как UX-эксперимент, но не как настоящий server-side rollout gate.

Что станет возможно только после смены hosting model:
- SSR / on-demand route gating;
- cookie-based opt-in;
- header-based shadow routing.

