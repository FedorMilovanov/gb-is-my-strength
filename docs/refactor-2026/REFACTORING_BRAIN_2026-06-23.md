# 🧠 МОЗГ рефакторинга — gb-is-my-strength (gospod-bog.ru)

**Дата среза:** 2026-06-23  
**Роль:** агент-распределитель / интегратор  
**Цель:** закрыть технический долг рефакторинга 6.0 до конца, не откатывая production.

---

## 0. Вердикт за 30 секунд

- **Production уже на Astro/strangler `dist/`**: 51 public route объявлен `astro`-owned в `migration/page-ownership.json`.
- **Но это почти всё ещё «обёртки»**: 51 из 52 `src/pages/*.astro` используют `loadLegacyFullDocument()` для `<head>` и/или `?raw` legacy-фрагментов. Настоящий native-контент есть только в пилотах: `/nagornaya/` landing + `chast-1`, `/articles/kod-da-vinchi/` (часть секций), Gill context/spravochnik, лендинги `/`, `/articles/`, `/biografii/`, `/baptisty-rossii/`, `/karty/`, `/konfessii/`, `/pastor-series/`, `/hard-texts/` (componentized-main, но head и chrome — всё ещё legacy).
- **Рефакторинг 6.0 = довести shadow → native**, удалить `loadLegacyFullDocument` из рендера контента, убрать `_legacy/` и корневые `index.html`, закончить CSS/JS, убрать Tailwind-остров Нагорной.
- **За одну сессию не закрыть**. Нужно 5–8 параллельных/последовательных lane-сессий с жёсткими gates.
- **С учётом gist `AGENT_PROTECTION_SIMPLE_V3_0.md`**: сначала делаем **system lane по упрощению защиты**, потом **system foundation lanes** (head, CSS, JS), потом **route lanes** (Nagornaya, MDX, Baptisty), потом cleanup.

---

## 1. Состояние среза (факты)

| Показатель | Значение | Что означает |
|---|---|---|
| Astro routes | 51 public + 1 dev (`/dev/astro-test/`) | Все важные URL уже в `dist` |
| `loadLegacyFullDocument` в `src/pages` | 51 | Почти каждая страница тащит head/body из legacy HTML |
| `?raw` legacy-фрагменты | 57 | Компоненты собираются из кусков старого HTML |
| Legacy `index.html` в корне | 51 | Fallback/source layer; дублирует Astro output |
| `_legacy/` директорий | 15+ | ~130+ фрагментов, которые ещё нужны |
| MDX в `src/content/articles` | 20 | Черновики/заготовки; публичные страницы пока shadow |
| Astro компонентов | 143 | Много пилотов, но глубина разная |
| `site.css` `!important` | 202 (audit-pro) | Цель 6.0: ≤150 |
| `nagornaya/tw.min.css` | 34 KB | Отдельный Tailwind-слой, требует отдельной сборки |
| `visual:parity:guard` | локально | Ещё не production-ready в CI |
| `validate:static-publication` | ✅ green | Root-level gates проходят |
| `audit-pro.js` | ✅ passed | 159+ проверок прошли |

---

## 2. Спектр оставшихся работ (9 пучков)

### S0. Упрощение системы защиты агентов
**Что:** Внедрить `FAST / LANE / SYSTEM` из gist: укоротить `WORK_MODES.md`, `LANE_LOCK_POLICY.md`, упростить `guard-shared-files.js`, создать `docs/refactor-2026/lanes/README.md` + `TEMPLATE.md`, workflow block-on-main/warn-on-lane.  
**Риск:** MEDIUM (system files).  
**Scope:** `docs/`, `scripts/guard-shared-files.js`, `.github/workflows/shared-files-guard.yml`.

### S1. Native Astro shell — убрать `loadLegacyFullDocument` из рендера
**Что:** Все 51 страница должны строить `<head>` через `src/layouts/`, а не копировать legacy HTML. Body attributes тоже задаются явно.  
**Риск:** HIGH — SEO, OG, canonical, preload, theme-color, CSP.  
**Scope:** 51 route.  
**Главный gate:** `astro:check`, `validate:strict`, `seo-audit`, `visual:parity`.

### S2. Componentized-main — убрать `?raw` фрагменты
**Что:** Лендинги и каталоги (`/`, `/articles/`, `/biografii/`, `/baptisty-rossii/`, `/karty/`, `/konfessii/`, `/pastor-series/`, `/hard-texts/`, `/about/`) уже в componentized-main, но часть фрагментов остаётся. Нужно довести до named Astro components и удалить `_legacy/*.html`.  
**Риск:** MEDIUM-HIGH.  
**Scope:** ~8 routes.

### S3. Нагорная — довести до конца
**Что:** `/nagornaya/` и 8 подстраниц уже Astro-owned, но:
- `chast-2..5`, `index`, `istochniki`, `nakhodki`, `seriya` — всё ещё `MainShell` + `_legacy/main.html`.
- `chast-1` уже разбит на секции — шаблон готов.
- `tw.min.css` — отдельный Tailwind build.
- `nagornaya-mobile-toc.css/js` — отдельные файлы.
- head всё ещё из legacy.
**Риск:** HIGH (много контента, visual parity, мобильный TOC).  
**Scope:** 8 pages.

### S4. MDX-native статьи
**Что:** 20 MDX-файлов уже есть, но публичные страницы — shadow. Нужно переключить `kod-da-vinchi`, Gill 5 страниц, `20-antisоветов`, `hermenevtика` на `ArticleLayout/SeriesArticleLayout`.  
**Риск:** HIGH (контент, glossary, quiz, sources, JSON-LD).  
**Scope:** 8–10 article routes.

### S5. Baptisty-россии — series articles
**Что:** 8 статей серии + лендинг. Лендинг уже componentized-main. Статьи — `full-body-shadow`. Нужно или оставить как legacy-shadow (матрица разрешает) или перевести на MDX/series article layout.  
**Риск:** HIGH (история, источники, длинные статьи).  
**Scope:** 9 pages.

### S6. CSS завершение
**Что:** @layer архитектура, снизить `!important` 202→150, убрать dead vars/classes, интегрировать `nagornaya/tw.min.css` и `css/nagornaya-mobile-toc.css` в единый слой.  
**Риск:** HIGH (visual parity).  
**Scope:** `css/site.css`, `css/site-layered.css`, `nagornaya/tw.min.css`, `css/nagornaya-mobile-toc.css`.

### S7. JS/TypeScript
**Что:** разложить `js/site.js` на модули, убрать утечки listeners, TypeScript для `map-engine.js`, `site.js` модулей.  
**Риск:** HIGH (runtime).  
**Scope:** `js/site.js`, `js/modules/`, `karty/_engine/`.

### S8. Maps & Rodosloviye
**Что:** карты (`karty/*` 10 pages, `/map/`, `/konfessii/russkij-baptizm/`) — legacy-shadow-app. `/rodosloviye/` — React island. Нужно MapEngine v2 с feature flag.  
**Риск:** VERY HIGH (интерактив, данные).  
**Scope:** отдельная большая линия.

### S9. Удаление legacy
**Что:** после завершения S1–S4 удалить корневые `index.html`, `_legacy/` фрагменты, устаревшие скрипты.  
**Риск:** HIGH (нельзя удалить раньше).  
**Scope:** 51 файлов + 15 директорий.

### S10. CI visual parity guard
**Что:** сделать `visual:parity:guard` частью `strangler:deploy-readiness`, добавить Playwright deps, baseline versioning.  
**Риск:** MEDIUM.  
**Scope:** `.github/workflows/`, `scripts/visual-parity-*.js`.

---

## 3. Рекомендуемый план lanes (8 линий) с учётом gist

Политика gist: **FAST / LANE / SYSTEM**. Route lane не трогает SYSTEM files. SYSTEM lane не трогает production routes/content. Интегратор — единственный, кто обновляет `AGENTS.md`.

| # | Lane | Mode | Агент | Задача | Разрешённые файлы | Запретные файлы |
|---|---|---|---|---|---|---|
| 0 | `lane/system-protection-simple-v3-0` | SYSTEM | 1 | Упростить защиту агентов по gist | `docs/WORK_MODES.md`, `docs/LANE_LOCK_POLICY.md`, `docs/refactor-2026/lanes/*`, `scripts/guard-shared-files.js`, `.github/workflows/shared-files-guard.yml` | `AGENTS.md`, `package.json`, `src/`, `css/`, `js/`, `karty/`, `data/`, `migration/` |
| 1 | `lane/system-astro-head-native` | SYSTEM | 2 | Native `<head>` для всех Astro-страниц | `src/layouts/`, `src/components/seo/`, `src/pages/**/*.astro` (только `<head>`) | body/content, `data/`, `css/`, `js/`, `workflows/` (кроме если нужно) |
| 2 | `lane/system-css-layer-cleanup` | SYSTEM | 3 | @layer, !important ≤150, dead vars | `css/`, `scripts/css-layer-validator.js`, `scripts/check-design-tokens.js` | разметка страниц, `nagornaya/tw.min.css` пока lane C не готова |
| 3 | `lane/system-js-decomposition` | SYSTEM | 4 | site.js → модули, listener cleanup, TS map-engine | `js/`, `js/modules/`, `scripts/bundle-modules.js`, `karty/_engine/map-engine.js` | DOM-контракт, `window.SITE_CONFIG`, runtime API |
| 4 | `lane/nagornaya-componentization` | LANE | 5 | Разбить chast-2..5, index, istochniki, nakhodki, seriya на компоненты | `src/components/nagornaya/`, `src/pages/nagornaya/` | head (lane 1), `tw.min.css` (lane 5), `css/nagornaya-mobile-toc.css` (lane 5), copy/URL |
| 5 | `lane/nagornaya-css-unification` | SYSTEM | 6 | Интегрировать Nagornaya CSS в site-layered.css | `css/site-layered.css`, `nagornaya/tw.min.css`, `css/nagornaya-mobile-toc.css`, `js/nagornaya-mobile-toc.js` | разметка Nagornaya (lane 4), copy |
| 6 | `lane/mdx-article-promotion` | LANE | 7 | Переключить 8 статей на MDX + ArticleLayout | `src/content/articles/`, `src/layouts/`, `src/pages/articles/**` | landings, карты, baptisty, Нагорная |
| 7 | `lane/baptisty-series-native` | LANE | 8 | 8 baptisty статей на SeriesArticleLayout/MDX | `src/pages/baptisty-rossii/*`, `src/content/articles/baptisty-*.mdx` | landing `/baptisty-rossii/`, research данные |
| 8 | `lane/system-legacy-cleanup` | SYSTEM | интегратор | Удалить legacy HTML и `_legacy/` после green gates | всё, что больше не нужно | ничего, пока gates не зелёные |
| 9 | `lane/system-visual-parity-ci` | SYSTEM | 9 | CI visual parity guard production-ready | `.github/workflows/`, `scripts/visual-parity-*.js` | routes/content |

**Порядок merge:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 9 → 8.

---

## 4. Промпты для агентов

Полные версии — в секциях ниже. Здесь краткие каркасы для быстрого раздачи.

### Агент 0 — System protection simplification
```
LANE: lane/system-protection-simple-v3-0
MODE: SYSTEM

Цель: упростить защиту агентов до FAST / LANE / SYSTEM по gist AGENT_PROTECTION_SIMPLE_V3_0.

Разрешено:
- docs/WORK_MODES.md
- docs/LANE_LOCK_POLICY.md
- docs/refactor-2026/lanes/README.md
- docs/refactor-2026/lanes/TEMPLATE.md
- scripts/guard-shared-files.js
- .github/workflows/shared-files-guard.yml

Запрещено:
- AGENTS.md, package.json, package-lock.json, src/, css/, js/, karty/, data/*.json, migration/

Сделать:
1. Сократить WORK_MODES.md до FAST / LANE / SYSTEM.
2. Убрать команду обычному агенту обновлять AGENTS.md.
3. LANE_LOCK_POLICY.md оставить только про lane и lane report.
4. Создать lane index (docs/refactor-2026/lanes/README.md).
5. Создать lane report template (docs/refactor-2026/lanes/TEMPLATE.md).
6. Guard:
   - route lane не трогает SYSTEM files;
   - lane/system-* может трогать SYSTEM files;
   - lane/shared-* может трогать shared data;
   - [LANE] не разрешает всё.
7. Workflow: block на main/PR-to-main; warn на lane branches.
8. Не добавлять CODEOWNERS/rulesets/merge queue/full allowed_paths.
9. Не менять сайт.

Проверки:
- npm run guard:shared-files
- npm run workflows:check
```

### Агент 1 — Head native shell
```
LANE: lane/system-astro-head-native
MODE: SYSTEM

Задача: убрать зависимость от loadLegacyFullDocument() для формирования <head> на всех Astro-страницах.

Файлы: src/layouts/*.astro, src/components/seo/*.astro, src/pages/**/*.astro (только <head>).

Что делать:
1. Создать/усилить BaseLayout.astro + Seo.astro, которые принимают title, description, canonical, ogImage, ogImageAlt, article meta, JSON-LD, preload, theme-color, CSP, RSS alternate.
2. Для каждого route в migration/page-ownership.json взять SEO-мета из соответствующего legacy index.html и перенести в frontmatter/Astro props.
3. Заменить <Fragment set:html={headHtml} /> на <BaseLayout ...> с явными пропсами.
4. bodyAttributes (class, id) задавать явно через <body class={...}>.

Что НЕЛЬЗЯ:
- Не менять body-контент, разметку, классы, copy.
- Не удалять loadLegacyFullDocument из контента/сегментов (только head).
- Не трогать data/series.json, data/search-manifest.json, sitemap.xml, feed.xml.

Проверки:
- npm run guard:shared-files
- npm run validate:strict
- npm run seo-audit
- npm run workflows:check
- node scripts/audit-pro.js
- npm run visual:parity:screenshots:landings (warn-only)
```

### Агент 2 — CSS layer cleanup
```
LANE: lane/system-css-layer-cleanup
MODE: SYSTEM

Задача: завершить CSS @layer архитектуру и снизить технический долг site.css.

Файлы: css/site.css, css/site-layered.css, scripts/css-layer-validator.js, scripts/check-design-tokens.js.

Что делать:
1. Перевести css/site.css в @layer архитектуру (reset, base, legacy, gbs2, nagornaya, components, utilities, overrides) или добиться ≤150 !important.
2. Убрать dead CSS-переменные (audit-pro показывает 26 unused, 130 possibly-unused classes).
3. Заменить hardcoded цвета на design tokens.
4. Убедиться, что site-layered.css и site.css не дублируют друг друга (если site-layered.css — пилот, его нужно либо заменить site.css, либо слить).

Что НЕЛЬЗЯ:
- Не трогать Nagornaya Tailwind (lane nagornaya-css-unification).
- Не ломать visual parity.
- Не удалять runtime state классы, которые site.js добавляет динамически.

Проверки:
- npm run guard:shared-files
- npm run css:layer:validate
- npm run tokens:check
- npm run visual:parity:guard (warn-only)
- node scripts/audit-pro.js
- npm run validate:static-publication
```

### Агент 3 — JS decomposition
```
LANE: lane/system-js-decomposition
MODE: SYSTEM

Задача: разложить js/site.js на ES-модули, убрать утечки event listeners, начать TypeScript-миграцию для критичных файлов.

Файлы: js/site.js, js/site-utils.js, js/modules/*.js, scripts/bundle-modules.js, karty/_engine/map-engine.js.

Что делать:
1. Извлечь оставшиеся модули site.js (29 модулей) в js/modules/ с AbortController cleanup.
2. Обновить scripts/bundle-modules.js для сборки js/site-modules.js (или оставить отдельные модули, если Astro bundling).
3. Добавить removeEventListener для всех addEventListener.
4. Переписать karty/_engine/map-engine.js на TypeScript (map-engine.ts) без изменения runtime API.
5. Сохранить window.SITE_CONFIG контракт, все id/class, которые используются runtime.

Что НЕЛЬЗЯ:
- Не менять DOM-контракт (README §7).
- Не ломать quiz, TOC, bookmark, theme, search, share, flip-cards, floating controls.
- Не менять URL/slug.

Проверки:
- npm run guard:shared-files
- npm run validate:static-publication
- npm run interactive-audit
- npm run visual-audit (если есть сервер)
- node scripts/audit-pro.js
- npx tsc --noEmit (если настроен)
```

### Агент 4 — Nagornaya componentization
```
LANE: lane/nagornaya-componentization
MODE: LANE

Задача: довести все страницы /nagornaya/ до named section components, как уже сделано для /nagornaya/chast-1/.

Файлы: src/components/nagornaya/**, src/pages/nagornaya/**.

Что делать:
1. Для /nagornaya/chast-2/, /chast-3/, /chast-4/, /chast-5/ разбить MainShell на HeaderHero + SectionI..X + PostContent + Footer по аналогии с chast-1.
2. Для /nagornaya/, /nagornaya/istochniki/, /nagornaya/nakhodki/, /nagornaya/seriya/ разбить MainShell на named components (IndexMain, IstochnikiMain, NakhodkiMain, SeriyaMain).
3. Удалить _legacy/main.html и body-segment-*.html после того, как весь контент окажется в .astro компонентах.
4. Сохранить data-pagefind-body, pagefind meta, breadcrumbs, quiz mount (#quizPlaceholder), accuracy block, author card, Soli Deo Gloria block, навигацию по частям.

Что НЕЛЬЗЯ:
- Не менять copy, источники, URL, HTML id/class, которые использует site.js или nagornaya-mobile-toc.js.
- Не трогать nagornaya/tw.min.css, css/nagornaya-mobile-toc.css, js/nagornaya-mobile-toc.js (это lane nagornaya-css-unification).
- Не менять head (lane system-astro-head-native).

Проверки:
- npm run guard:shared-files
- npm run nagornaya:visual-parity:audit
- npm run validate:static-publication
- node scripts/audit-pro.js
- npm run content:parity-v2
```

### Агент 5 — Nagornaya CSS unification
```
LANE: lane/nagornaya-css-unification
MODE: SYSTEM

Задача: убрать отдельный Tailwind-слой и mobile-TOC CSS для Нагорной, интегрировать их в единый site-layered.css через @layer nagornaya.

Файлы: css/site-layered.css, nagornaya/tw.min.css, css/nagornaya-mobile-toc.css, js/nagornaya-mobile-toc.js.

Что делать:
1. Проанализировать все классы nagornaya/tw.min.css, которые реально используются на /nagornaya/*.
2. Перенести используемые стили в css/site-layered.css внутри @layer nagornaya (или components + utilities).
3. Перенести стили из css/nagornaya-mobile-toc.css в тот же слой.
4. Сохранить/перенести логику js/nagornaya-mobile-toc.js как отдельный ES-модуль (или в js/modules/), убрать дублирование с site.js.
5. Удалить nagornaya/tw.min.css и css/nagornaya-mobile-toc.css после миграции; обновить ссылки в head.

Что НЕЛЬЗЯ:
- Не менять разметку страниц Нагорной (lane nagornaya-componentization).
- Не менять copy.
- Не ломать мобильный TOC.

Проверки:
- npm run guard:shared-files
- npm run css:layer:validate
- npm run nagornaya:visual-parity:audit
- npm run validate:static-publication
- node scripts/audit-pro.js
```

### Агент 6 — MDX article promotion
```
LANE: lane/mdx-article-promotion
MODE: LANE

Задача: переключить публичные статьи с shadow-обёртки на MDX content + ArticleLayout/SeriesArticleLayout.

Файлы: src/content/articles/*.mdx, src/layouts/ArticleLayout.astro, src/layouts/SeriesArticleLayout.astro, src/pages/articles/**/index.astro.

Приоритет routes (по одному, не все сразу):
1. /articles/kod-da-vinchi/
2. /articles/dzhon-gill-istoricheskiy-kontekst/
3. /articles/dzhon-gill-spravochnik/
4. /articles/dzhon-gill-chast-1-chelovek/
5. /articles/dzhon-gill-chast-2-uchenyi/
6. /articles/dzhon-gill-chast-3-nasledie/
7. /articles/20-antisovetov-pastoru/
8. /articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/

Что делать для каждой статьи:
1. Проверить/обогатить MDX frontmatter: title, description, slug, datePublished, dateModified, author, translator, readingTime, wordCount, section, tags, ogImage, canonical.
2. Убедиться, что MDX body содержит все CSS-классы и data-атрибуты legacy HTML (gbx-tts, data-speakable, fn-marker, gterm, quiz, summary-card, article-img, figcaption и т.д.).
3. Обновить src/pages/<route>/index.astro чтобы рендерить MDX через ArticleLayout.
4. Убрать loadLegacyFullDocument для body.
5. Сохранить SITE_CONFIG, JSON-LD, breadcrumb, sources, glossary, quiz.

Что НЕЛЬЗЯ:
- Не менять landings, карты, baptisty, Нагорную.
- Не публиковать MDX без content parity (check-mdx-html-parity-v2).
- Не менять URL/ slug.

Проверки:
- npm run guard:shared-files
- npm run article-mdx-pilot-audit -- --require-content-parity
- npm run content:parity-v2
- npm run gill:reading-time:audit (для Gill)
- npm run validate:static-publication
- node scripts/audit-pro.js
```

### Агент 7 — Baptisty series native
```
LANE: lane/baptisty-series-native
MODE: LANE

Задача: перевести 8 статей серии baptisty-rossii с full-body-shadow на SeriesArticleLayout/MDX.

Файлы: src/pages/baptisty-rossii/*, src/content/articles/baptisty-*.mdx, src/layouts/SeriesArticleLayout.astro.

Routes:
- /baptisty-rossii/dva-sezda-1884/
- /baptisty-rossii/goneniya-i-sovest/
- /baptisty-rossii/iniciativnaya-gruppa/
- /baptisty-rossii/noch-na-kure/
- /baptisty-rossii/peterburgskaya-liniya/
- /baptisty-rossii/podpolnaya-pechat/
- /baptisty-rossii/sovetskaya-noch/
- /baptisty-rossii/vsehib-1944/
- /baptisty-rossii/spravochnik/

Что делать:
1. Создать/обновить MDX для каждой статьи с frontmatter и полным body.
2. Сохранить специфичные baptisty компоненты: timeline, source cards, maps, series navigation.
3. Обновить страницы на SeriesArticleLayout.
4. Убрать loadLegacyFullDocument для body.

Что НЕЛЬЗЯ:
- Не менять landing /baptisty-rossii/ без согласования (он уже componentized).
- Не трогать данные исследования в baptisty-rossii/research/.

Проверки:
- npm run guard:shared-files
- npm run baptisty-series-shadow-audit
- npm run baptisty-rossii:visual-parity:audit
- npm run content:parity-v2
- npm run validate:static-publication
```

### Агент 8 — CI visual parity guard
```
LANE: lane/system-visual-parity-ci
MODE: SYSTEM

Задача: сделать visual:parity:guard production-ready в CI.

Файлы: .github/workflows/, scripts/visual-parity-*.js.

Что делать:
1. Установить Playwright system deps в GitHub Actions runner (npx playwright install-deps chromium).
2. Создать .github/workflows/visual-parity.yml — weekly + manual trigger.
3. Интегрировать visual:parity:guard в strangler:deploy-readiness.
4. При failure — GitHub Issue с diff PNG attachment.
5. Обновить check-workflows.js guard на новый workflow.
6. Baseline versioning: data/visual-parity-baseline.json версионировать git-ом.

Что НЕЛЬЗЯ:
- Не менять routes/content.
- Не публиковать без green manual run.

Проверки:
- npm run guard:shared-files
- npm run workflows:check
- npm run visual:parity:guard (warn-only)
```

### Интегратор — Legacy cleanup
```
LANE: lane/system-legacy-cleanup
MODE: SYSTEM

Задача: слить завершённые lanes, удалить legacy-файлы и _legacy фрагменты.

Порядок:
1. git fetch && git rebase/merge lanes по очереди: system-protection-simple-v3-0 → system-astro-head-native → system-css-layer-cleanup → system-js-decomposition → nagornaya-componentization → nagornaya-css-unification → mdx-article-promotion → baptisty-series-native → system-visual-parity-ci.
2. После каждого merge: npm run validate:static-publication && npm run visual:parity:guard.
3. После финального merge удалить:
   - все корневые index.html, которые уже покрыты Astro (51 файл);
   - все src/components/*/_legacy/ директории, которые больше не используются;
   - убрать loadLegacyFullDocument из utils, если не осталось потребителей.
4. Обновить migration/page-ownership.json и data/public-content-baseline.json.
5. Обновить README/AGENTS.md — только интегратор, после всех lanes.

Проверки:
- npm run guard:shared-files
- npm run strangler:deploy-readiness
- npm run visual:parity:guard
- npm run source:links:dist
- npm run validate:static-publication
- npm run workflows:check
- node scripts/audit-pro.js
```

---

## 5. Ответ по Нагорной: стоит ли доводить на Astro?

**Факт:** `/nagornaya/` уже Astro-owned. `chast-1` разбита на 12 named section components. Остальные 7 страниц — `MainShell + _legacy/main.html`. Также остался отдельный `nagornaya/tw.min.css` (Tailwind) и `nagornaya-mobile-toc.css/js`.

**Стоит ли доводить?** Да, по трём причинам:
1. **Единообразие:** Нагорная — единственный крупный Tailwind-остров в проекте. Убрав его, получим единый CSS-слой.
2. **Редактируемость:** named components позволят править серию без правки legacy HTML.
3. **Будущее:** MDX/frontmatter для серий, TOC, quiz, sources — всё проще в Astro.

**Но:**
- Это **высокорисковая** работа: много контента, мобильный TOC, сложная навигация.
- Нельзя делать одним PR. Нужно **2 отдельных lanes**: `lane/nagornaya-componentization` (LANE) и `lane/nagornaya-css-unification` (SYSTEM).
- **Не удаляй legacy HTML и tw.min.css**, пока visual parity audit не зелёный.
- **Head** должен делать system lane `lane/system-astro-head-native`, а не агент Нагорной.
- **CSS** должен делать system lane `lane/nagornaya-css-unification`, а не агент componentization.

**Рекомендация:**
1. Запустить `lane/system-astro-head-native` и `lane/nagornaya-componentization` параллельно — они не пересекаются (head vs body).
2. После завершения `lane/nagornaya-componentization` запустить `lane/nagornaya-css-unification`.
3. Только потом удалять `nagornaya/tw.min.css` и `_legacy/main.html`.

---

## 6. Чеклист интегратора (sliv lanes)

```bash
# 1. Перед началом сессии
npm run guard:shared-files
npm run data:consistency

# 2. Fetch всех lanes
git fetch origin
git branch -a | grep lane/

# 3. Merge-order (важен!)
git checkout main
git pull origin main

git merge lane/system-protection-simple-v3-0
npm run guard:shared-files
npm run workflows:check

git merge lane/system-astro-head-native
npm run validate:strict
npm run seo-audit

git merge lane/system-css-layer-cleanup
npm run css:layer:validate
npm run tokens:check
npm run visual:parity:guard

git merge lane/system-js-decomposition
npm run validate:static-publication
npm run interactive-audit

git merge lane/nagornaya-componentization
npm run nagornaya:visual-parity:audit
npm run validate:static-publication

git merge lane/nagornaya-css-unification
npm run css:layer:validate
npm run nagornaya:visual-parity:audit

git merge lane/mdx-article-promotion
npm run article-mdx-pilot-audit -- --require-content-parity
npm run content:parity-v2
npm run validate:static-publication

git merge lane/baptisty-series-native
npm run baptisty-series-shadow-audit
npm run baptisty-rossii:visual-parity:audit
npm run validate:static-publication

git merge lane/system-visual-parity-ci
npm run workflows:check
npm run visual:parity:guard

# 4. Legacy cleanup
npm run strangler:deploy-readiness
npm run source:links:dist
npm run visual:parity:guard

# 5. Push
npm run cache-bust
npm run validate:static-publication
npm run workflows:check
node scripts/audit-pro.js
git push origin main
```

**Правила merge:**
- Никогда не squash lanes, содержащих shared files, чтобы история оставалась читаемой.
- После каждого merge с shared-файлом — `npm run guard:shared-files`.
- Если visual parity guard красный — остановить merge, вернуть lane на доработку.
- Все закрытые lanes документировать в `docs/refactor-2026/lanes/<lane>.md`.
- `AGENTS.md` и `README.md` обновляет только интегратор после финального merge.

---

## 7. Главные риски и как их не допустить

| Риск | Как проявляется | Профилактика |
|---|---|---|
| Visual parity regression | Generic card grid или сломанный layout | `visual:parity:guard` до merge, baseline update |
| SEO regression | Пропал canonical, OG, JSON-LD | `seo-audit` + сравнение legacy head |
| Content drift | MDX не содержит всех классов/атрибутов | `content:parity-v2` |
| CSS cascade break | Сломался layout после @layer | `css:layer:validate` + visual parity |
| Runtime JS break | TOC, quiz, bookmarks не работают | `interactive-audit` |
| Data inconsistency | readTime/readingTime конфликт | `npm run data:consistency` |
| Legacy удалён рано | Страница 404 или сломана | `strangler:deploy-readiness` перед cleanup |
| Lane conflict | Два агента правят один shared файл | Lane lock policy, `guard:shared-files` |
| System file touched by route lane | Regression в shared слое | `guard-shared-files.js` block-on-lane для SYSTEM |

---

## 8. Как отвечать на вопрос "с чего начать?"

**Самый безопасный порядок:**

1. **Агент 0** — `lane/system-protection-simple-v3-0` (1 день). Без этого остальные lanes будут путаться в защите.
2. **Агент 1** — `lane/system-astro-head-native` (2–3 дня). Foundation для всего.
3. **Параллельно Агент 4** — `lane/nagornaya-componentization` (3–4 дня). Нагорная уже почти готова, быстрый win.
4. **Агент 2** — `lane/system-css-layer-cleanup` (2–3 дня). После head, до Nagornaya CSS.
5. **Агент 5** — `lane/nagornaya-css-unification` (1–2 дня). После componentization + CSS cleanup.
6. **Агент 6** — `lane/mdx-article-promotion` (4–5 дней). Самый длинный, но не блокирует остальное.
7. **Агент 3** — `lane/system-js-decomposition` (3–4 дня). Можно параллельно MDX после head.
8. **Агент 7** — `lane/baptisty-series-native` (3–4 дня). Опционально, можно оставить legacy-shadow.
9. **Агент 8** — `lane/system-visual-parity-ci` (1 день). До legacy cleanup.
10. **Интегратор** — `lane/system-legacy-cleanup` (1 день). Только в самом конце.

**Если нужно выбрать 3 первых:**
- `lane/system-protection-simple-v3-0`
- `lane/system-astro-head-native`
- `lane/nagornaya-componentization`

Это даст: чистую защиту, единый head, и самый видимый результат (Нагорная доведена до конца).

---

## 9. Контракт для этого файла

- Этот документ — черновик плана. Перед стартом lanes агенты должны прочитать `AGENTS.md`, `WORK_MODES.md`, `LANE_LOCK_POLICY.md`, `route-migration-matrix.json`, и gist `AGENT_PROTECTION_SIMPLE_V3_0.md`.
- Ни один агент не начинает работу без объявления lane.
- Интегратор — единственный, кто редактирует `AGENTS.md`, `README.md`, `package.json`, `workflows/` после lanes.
- Production deploy только после `strangler:deploy-readiness` green.
