# AGENTS.md — gb-is-my-strength (gospod-bog.ru)

> **Этот файл — договор между владельцем (Фёдор Милованов) и любым ИИ-агентом.**
> **Обязательно к прочтению ДО любой правки.** Нарушение = регрессия на проде.

---

## 🚦 Читать перед работой — единый pre-flight

> Этот раздел определяет порядок входа в задачу. Подробные правила находятся в
> `docs/WORK_MODES.md`, `docs/LANE_LOCK_POLICY.md` и `docs/OWNER-INVARIANTS.md`.
> При расхождении старой формулировки с этими документами действует более новый
> owner-approved контракт и текущий `main`.

### Обязательная последовательность

Перед любой правкой агент обязан:

1. **Проверить живое состояние GitHub:** открытые issues/PR, активные ветки, текущий
   `main`, точные файлы пересечения и rollback SHA. Старое имя ветки, закрытый PR или
   сохранённый lane-report сами по себе не означают активное владение.
2. **Прочитать `docs/WORK_MODES.md`.** Канонические режимы: `FAST`, `LANE`, `SYSTEM`.
   Любая mutation выполняется в отдельной ветке и PR; FAST определяет объём проверки,
   а не разрешение писать прямо в `main`.
3. **Прочитать `AGENTS.md` полностью.** Особенно архитектурные ограничения,
   protected-подсистемы и владельческие инварианты.
4. **Прочитать `docs/LANE_LOCK_POLICY.md`.** Объявить владельца, разрешённые и
   запрещённые файлы, проверки, зависимости и rollback point.
5. **Прочитать `docs/OWNER-INVARIANTS.md`.** Owner-sensitive контент, данные и UI
   нельзя переопределять по историческому снимку или личному вкусу агента.
6. **Для route/registry-задачи проверить первичные источники:**
   `migration/page-ownership.json` и соответствующий `data/route-profiles/*.json`.
   `migration/route-migration-matrix.json` — производный артефакт; его не редактируют
   вручную для добавления или изменения route.
7. **Для внешних проверок прочитать `audit/external-checks/README.md`.** Текущий
   `npm run workflows:lint` с checksum-verified actionlint является каноническим
   blocking gate; решения по другим инструментам берутся из актуального registry.
8. **Проверить среду фактически.** Версия Node, доступные CPU/RAM/диск, сеть,
   Playwright-браузеры, сохранность файлов и возможности редактора определяются
   live-discovery в текущей сессии. `SANDBOX-ENV-2026-06-21.md` — исторический
   справочник по известным ловушкам, а не универсальная спецификация любой среды.

### Минимальная декларация lane

```md
Mode: FAST | LANE | SYSTEM
Lane: <branch>
Issue/PR: <number>
Routes: <bounded list or none>
Files allowed: <bounded list>
Files forbidden: <list>
Source of truth: <current files / exact SHA>
Required checks: <commands / browser profiles>
Rollback point: <exact main SHA>
Dependencies: <open PRs / owner decisions>
```

### Три уровня доказательства

1. **Iteration evidence** — `git diff --check` и релевантные быстрые контракты.
2. **Exact-head PR evidence** — обязательные checks именно на финальном SHA PR.
3. **Production witness** — отдельное подтверждение deploy/live SHA; зелёный PR не
   является автоматически доказательством продакшена.

Для docs-only SYSTEM PR допустим суженный final barrier, если diff не может влиять
на runtime/build. При этом обязательны Shared Files Guard, проверка ссылок/согласованности
политик и явное описание границы проверки в PR.

---

| **AGENTS-r324** | 2026-07-24 | **Owner governance reconciliation (#219).** Установлен единый контракт FAST/LANE/SYSTEM с обязательными branch+PR, live GitHub ownership discovery, первичностью `page-ownership` + route profiles над производной route matrix, live-discovery среды, checksum-verified actionlint и разделением iteration / exact-head CI / production witness. Исторические sandbox-снимки и pre-v16 UI-детали больше не трактуются как универсальная текущая архитектура; owner-sensitive защиты и data hard-lock сохранены. |

| **AGENTS-r323** | 2026-07-09 | **Derived route-registry stack merged + doc drift fixed.** Влиты 3 системных лейна (`native-source-contract-v1` + `route-registry-validators-v2` + `editorial-metadata-v3`): `route-migration-matrix.json` теперь **материализуется** из `page-ownership.json` + `route-profiles/*` (движок `scripts/lib/effective-route-registry.js`); режимы свёрнуты 8→3 (`strict-native`/`strict-native-app`/`legacy-shadow-app`); registry-driven чекеры заменили прямые (оригиналы → `scripts/legacy-audits/*`); добавлен editorial-freeze baseline `data/editorial-metadata.json`. Закрывает **AUDIT-P2-MATRIX-DRIFT**. Doc-drift из r322 исправлен: JS-файлов **14** (11 базовых + 3 vosk-TTS), не 11/12; §0/§2 синхронизированы. `izbrannoe`/`BaseLayout` рантайм переведён на нативные `<script>` (strict-native clean, мёртвые `headHtml`/`bodyEndHtml` пропсы удалены). См. блок «Матрица теперь ПРОИЗВОДНАЯ» в Work Modes. |
| **AGENTS-r322** | 2026-07-06 | **Super-audit sync.** «Верификационная дисциплина» дополнена п.8–12: канон системного бэклога — AuditRepo `verified/SUPER_AUDIT_2026-07-06_14a49be8.md` (волны W0–W10 + опровергнутые формулировки); три идентичности релиза (FUNCTIONAL/BOT/DEPLOYED SHA); «паритет ≠ правда»; in-flight зоны (PremiumControls, глоссарий); создан `docs/OWNER-INVARIANTS.md`. Известный doc-drift для будущей правки: §0/§2 расходятся «11 vs 12 JS-файлов» (факт на 14a49be8: 11); README §1.1 shadow-wrap описание — HISTORICAL (см. page-ownership.json). |
| **AGENTS-r321** | 2026-07-03 | **CSS inventory reconciled.** Section 2 updated from 8→9 CSS files (added `enhancements-runtime.css`, `highlights-runtime.css`, `sw-toast.css` extracted from CSS-in-JS in Pass 24). Dead exports removed from `floating-cluster-ui.ts` (5 dead: `FloatingClusterMode`, `FloatingClusterUiConfig`, `floatingClusterUi`, `floatingClusterRoutes`, `getSeriesParts`). §0 and §4 CSS table updated (renumbered from r312 — was duplicate of r312). |

---

## Work Modes — определи режим перед работой

Канонические документы:

- [docs/WORK_MODES.md](docs/WORK_MODES.md) — режимы и объём проверок;
- [docs/LANE_LOCK_POLICY.md](docs/LANE_LOCK_POLICY.md) — владение, пересечения,
  merge/cleanup и forensic disposition;
- [docs/OWNER-INVARIANTS.md](docs/OWNER-INVARIANTS.md) — неизменяемые без решения
  владельца требования;
- [docs/refactor-2026/lanes/README.md](docs/refactor-2026/lanes/README.md) — навигация,
  но не самостоятельный backlog;
- открытые GitHub issues/PR и текущий `main` — живая операционная правда.

### Режимы

| Mode | Назначение | Branch/PR | Минимальная граница |
|---|---|---|---|
| **FAST** | Одна ограниченная low-risk правка без shared runtime ownership | обязательно | `git diff --check` + целевой контракт |
| **LANE** | Route/feature/refactor с именованным владельцем | обязательно | targeted checks + route/browser/visual evidence |
| **SYSTEM** | Shared/global/control-plane/governance | обязательно, отдельно от контента | shared/control-plane gates + exact-head barrier |

Прямой push в `main` не является обычным FAST-путём. Он допустим только как явно
разрешённая владельцем emergency-операция с немедленной exact-head проверкой и
последующей reconciliation-записью.

### Перед началом

```text
□ Проверить открытые PR/issues и пересекающиеся файлы
□ Зафиксировать текущий main и rollback SHA
□ Объявить allowed / forbidden files
□ Выбрать FAST, LANE или SYSTEM
□ Указать первичный source of truth
□ Назначить iteration checks и final exact-head barrier
□ Отделить source completion от production witness
```

### Route authority

Для route-режима первичны `migration/page-ownership.json` и
`data/route-profiles/*.json`. `migration/route-migration-matrix.json` генерируется
через `node scripts/sync-route-migration-matrix.js --write` и не правится вручную.
Канонический набор migration modes: `strict-native`, `strict-native-app`,
`legacy-shadow-app`.

### Проверки

```bash
# FAST iteration

git diff --check
# + один или несколько релевантных контрактов

# LANE / shared iteration

git diff --check
npm run guard:shared-files
npm run data:consistency
npm run migration:metadata:check
# + route/browser/visual/source checks

# SYSTEM / control plane

git diff --check
npm run guard:shared-files
npm run workflows:check
npm run control-plane:audit
npm run workflows:lint

# Final barrier для production/shared/refactor/system impact
npm run validate:static-publication
npm run guard:shared-files
```

Docs-only SYSTEM PR может не запускать полный production build, когда это технически
не связано с diff. Тогда PR обязан доказать отсутствие runtime/workflow изменений,
пройти Shared Files Guard и все применимые governance/control-plane checks.

### Shared / High-Risk поверхность

К SYSTEM относятся как минимум:

```text
AGENTS.md
README.md
package.json / package-lock.json
.github/workflows/**
docs/WORK_MODES.md
docs/LANE_LOCK_POLICY.md
docs/OWNER-INVARIANTS.md
docs/AGENT_PUSH_MODEL.md
migration/**
data/series.json
data/search-manifest.json
data/public-content-baseline.json
src/layouts/**
css/** / js/**
sw.js
karty/_engine/**
scripts, определяющие repository/release policy
```

Каталог `docs/` не является автоматически свободной зоной: устаревшая инструкция
может направить следующих агентов на разрушительную операцию.

### Пересечения и cleanup

- Один route/shared surface — один активный владелец.
- Второй агент берёт непересекающийся sub-lane или ждёт.
- Out-of-lane дефект фиксируется в issue/forensic register, а не чинится попутно.
- Перед удалением ветки её содержимое классифицируется: represented, diagnostic,
  superseded with verified chain, archive-worthy или selective recovery.
- В финальном дереве не остаются временные workflow, trigger, writer или patcher.
- `AGENTS.md` меняется только в owner-authorized SYSTEM lane, а не после каждой задачи.

Older changelog rows **AGENTS-r77–r131** and older 2026-06-13 map-wave rows **r131–r139** archived to `docs/AGENTS-CHANGELOG-ARCHIVE-2026-06-14.md` to keep this instruction file scannable; normative rules below remain authoritative.

**Владелец:** Фёдор Милованов (редактор/автор-редактор, не «автор»)
**Прод:** https://gospod-bog.ru · GitHub Pages workflow artifact `dist` из ветки `main`
**Node:** требуется `>=22.12.0` (Astro 6 scaffold; legacy scripts также проверены на Node 22 в CI)

---

## 0. TLDR — что СРАЗУ нельзя делать

1. ❌ **Создавать новые CSS/JS файлы.** Архитектурный максимум: **9 CSS + 1 шрифтовой + 14 JS** (11 базовых + 3 vosk-TTS: `vosk-tts-engine`/`vosk-tts-core`/`vosk-stress-lookup`). Список фиксирован, см. §2.
2. ❌ **Менять byline на «Автор: Фёдор Милованов».** Только `Автор-редактор:` (тип A/B) или `Редактор:` (тип C — переводы). См. §3.1.
3. ❌ **Возвращать `AI-disclosure`.** Удалён 2026-06-02 (`AGENTS-r11`), повторно удалён в PLAN-04 (CSS-остатки). Об ИИ — только на `/about/`.
4. ❌ **Запускать `prettier --write .` или `eslint --fix .`** по всему дереву. Только точечно.
5. ❌ **Обновлять зависимости в `package.json`** без явного запроса.
6. ❌ **Удалять/переименовывать `?v=...` хеши.** Они генерируются `scripts/cache-bust.js`. После любой правки CSS/JS — запусти `npm run cache-bust`.
7. ❌ **Удалять заголовки `<header class="article-header">` или `<aside class="author-card">`.** Это контракт разметки.
8. ❌ **Создавать мусорные root-артефакты** (`.patch`, одноразовые `*.py`, `*.tsx` в корне). `src/**` теперь production Astro-слой: новые `src/pages/**`/`src/components/**` допустимы только по существующей Astro-архитектуре, с записью в `migration/page-ownership.json` для routes.
9. ❌ **Дублировать `<meta og:*>`.** Один `og:image` per page. JPG-fallback — только если `.jpg` файл реально есть на диске.
10. ❌ **Создавать legacy-кнопки** `.theme-float-btn`, `#themeFloat`, `#gbSearchFloat`, `.nag-theme-btn`. Удалены в PLAN-04 P5. Единственный canonical блок плавающих контролов — `gbFloatingControls` (`js/site.js` модуль 29), классы `.gb-fc-theme` / `.gb-fc-search`.
11. ❌ **Добавлять новые `!important` без анализа конкурента.** См. §4.2 — обязательный 5-шаговый чеклист.
12. ✅ **После любой правки CSS/JS** → `npm run cache-bust`.
13. ✅ **Перед коммитом** → `npm run validate:all` + `node scripts/audit-pro.js`. Оба должны быть PASS. Эти проверки теперь включают Russian quote policy guard; подробные правила — в `docs/EDITORIAL-SOURCE-POLICY.md`.
14. ❌ **Не оставлять английские прямые цитаты в русских статьях.** Названия книг/статей, URL, DOI и библиографические данные могут быть на английском; цитируемые мысли, прямые речи и сильные фразы автора в теле русской статьи должны быть переведены на русский. Оригинал можно давать только ссылкой на источник, не вставляя англоязычную цитату в текст.

---

## 1. О проекте

Христианский богословский сайт со статьями, биографиями, серией «Нагорная проповедь» (5 частей), серией «Тёмная сторона кафедры» (pastor-series), серией о Джоне Гилле (5 текстов), статьями о Коде да Винчи / герменевтике / Иеремии и др.

**Стек:** production = статический artifact `dist/`, собранный Astro 6 + MDX/content collections + build-time strangler; runtime остаётся HTML + handcrafted CSS + vanilla JS.
**Хостинг:** GitHub Pages, автодеплой через `.github/workflows/deploy.yml`, artifact path: `dist`.
**Поисковая индексация:** `.github/workflows/indexnow.yml` уведомляет Яндекс/Bing при push в main.
**Алерты на падение CI:** `.github/workflows/notify-on-failure.yml` открывает GitHub issue (label `ci-failure`).

### 1.1 Целевые браузеры

| Платформа | Браузер | Минимальная версия |
|---|---|---|
| Desktop | Chrome / Edge | 90+ |
| Desktop | Firefox | 90+ |
| Desktop | Safari | 15+ |
| Mobile | iOS Safari | 15+ |
| Mobile | Android Chrome | 90+ |
| Mobile | Samsung Internet | 16+ |

CSS-фичи, не поддерживаемые в этих версиях (`color-mix()`, `grid-template-rows: 0fr`, `:has()`), **обязаны** иметь `@supports`-fallback или каскадный fallback (`property: rgb(...); property: color-mix(...);`).

### 1.2 Метрики качества

| Метрика | Цель |
|---|---|
| Lighthouse Performance (mobile) | ≥ 90 |
| Lighthouse Accessibility | ≥ 95 |
| Core Web Vitals LCP | < 2.5s |
| Core Web Vitals CLS | < 0.1 |
| `audit-pro` | ✅ PASSED, errors = 0 |
| `validate:all` | ✅ 0 errors, 0 warnings |
| `tokens:check` | ✅ 0 / 0 |
| `visual-audit` (Playwright) | server required; 0 console-errors, 0 network-errors, 0 unsuppressed HIGH/CRITICAL bugs |
| CSS `!important` в `site.css` | цель **≤ 200**; авто-потолок в `audit-pro.js` (сейчас 202, ratchet вниз) |

---

## 2. Архитектура — единственно верная

**Важно после refactoring 4.5:** живой сайт публикуется из generated `dist/`. Корень репозитория остаётся legacy/source/rollback layer; `src/**` — Astro production source. `dist/`, `reports/`, `pagefind/` не коммитить.

```
/
├── index.html                      ← главная
├── 404.html                        ← страница ошибки
├── sw.js                           ← Service Worker
├── manifest.json                   ← PWA
├── feed.xml                        ← RSS
├── robots.txt, sitemap.xml         ← SEO
├── llms.txt                        ← правила для LLM
├── AGENTS.md                       ← ⭐ ЭТОТ файл
├── README.md                       ← пользовательская архитектурная документация
├── AUDIT_HISTORY.md                ← консолидированный changelog аудитов
├── CNAME                           ← gospod-bog.ru
│
├── package.json                    ← build-скрипты + Astro/tooling devDependencies
├── astro.config.mjs, tsconfig.json  ← Astro static build config
├── src/                             ← Astro/MDX production source (pages/content/layouts/components)
├── migration/page-ownership.json    ← ownership manifest для dist
├── .github/workflows/              ← deploy.yml + indexnow.yml + source-links + notify-on-failure
│
├── css/                            ← РОВНО 9 ФАЙЛОВ. БОЛЬШЕ НЕ СОЗДАВАТЬ.
│   ├── site.css                    ← основной слой (статьи, шапка, тёмная тема)
│   ├── home.css                    ← главная + каталоги (home-правки строго через body.home-page)
│   ├── command-palette.css         ← поиск (Ctrl+K)
│   ├── mobile-hotfix.css           ← мобильные производительные hotfix-правки
│   └── nagornaya-mobile-toc.css    ← мобильное оглавление Нагорной проповеди
│   └── floating-cluster.css        ← runtime PremiumControls (загружается + SW precache)
│   ├── enhancements-runtime.css    ← извлечён из enhancements.js (CSS-in-JS → файл)
│   ├── highlights-runtime.css      ← извлечён из highlights.js (CSS-in-JS → файл)
│   └── sw-toast.css                ← извлечён из sw-register.js (CSS-in-JS → файл)
│
├── fonts/
│   └── fonts.css                   ← @font-face деклараты, не трогать
│
├── js/                             ← РОВНО 14 ФАЙЛОВ. БОЛЬШЕ НЕ СОЗДАВАТЬ.
│   ├── site.js                     ← главное (theme, nav, quiz, tooltips, gbFloatingControls)
│   ├── site-utils.js               ← утилиты, доступные отдельным страницам
│   ├── scroll-perf.js              ← производительность scroll/observers
│   ├── search.js                   ← Ctrl+K поиск (CommandPalette)
│   ├── enhancements.js             ← scroll-эффекты, lazy load, ambient phrases
│   ├── highlights.js               ← подсветка текста, заметки
│   ├── glossary.js                 ← глоссарий богословских терминов
│   ├── bookmark-engine.js          ← закладки (localStorage)
│   ├── nagornaya-mobile-toc.js     ← мобильное TOC для проповеди
│   ├── sw-register.js              ← регистрация Service Worker
│   ├── floating-cluster-controller.js ← PremiumControls runtime controller (TTS, speed morph, favorites)
│   ├── vosk-tts-engine.js          ← neural TTS engine (VITS+BERT, model on HF, IndexedDB cache)
│   ├── vosk-tts-core.js            ← vosk-tts inference core (chunking, synthesis)
│   └── vosk-stress-lookup.js       ← русское ударение для TTS (словарь + эвристика)
│
├── data/                           ← JSON-данные (рантайм + derived-registry входы; ~16 файлов, список иллюстративный)
│   ├── glossary.json               ← термины глоссария
│   ├── search-manifest.json        ← индекс поиска
│   ├── series.json                 ← карточки серий
│   ├── strategic-map-antisovetov.json  ← MAP_DATA для 20-antisovetov-pastoru
│   ├── route-profiles/*.json       ← профиль каждого route (вход derived-registry, ~54 файла)
│   └── editorial-metadata.json     ← замороженный baseline editorial-проекций (freeze-audit)
│
├── articles/                       ← статьи (каждая = папка с index.html)
│   ├── index.html                  ← каталог всех статей
│   ├── 20-antisovetov-pastoru/
│   ├── dzhon-gill-chast-1-chelovek/
│   ├── dzhon-gill-chast-2-uchenyi/
│   ├── dzhon-gill-chast-3-nasledie/
│   ├── dzhon-gill-istoricheskiy-kontekst/
│   ├── dzhon-gill-spravochnik/
│   ├── hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/
│   ├── kod-da-vinchi/
│   └── krajne-li-isporcheno-serdce/
│
├── nagornaya/                      ← серия «Нагорная проповедь»
│   ├── chast-1/ ... chast-5/       ← 5 частей
│   ├── istochniki/                 ← библиография
│   ├── nakhodki/                   ← находки
│   ├── seriya/                     ← обзор серии
│   ├── tw.min.css                  ← Tailwind (НЕ ТРОГАТЬ — отдельная генерация)
│   └── index.html                  ← обзор серии
│
├── about/, pastor-series/, biografii/   ← статичные разделы
│
├── scripts/                        ← build-инструменты (Node.js)
│   ├── cache-bust.js               ← ⭐ генерит ?v=... хеши
│   ├── validate.js                 ← валидация HTML/JSON/манифестов
│   ├── audit-pro.js                ← главный аудит (запускать перед каждым push)
│   ├── seo-audit.js                ← SEO-проверки
│   ├── visual-audit.js             ← Playwright скриншоты + console/network errors
│   ├── update-meta.js              ← обновление meta-тегов
│   ├── check-design-tokens.js      ← валидация дизайн-токенов
│   ├── deep-check.js, _audit-deep.js  ← глубокий аудит (внутренние)
│   ├── download-fonts.js           ← скачка шрифтов
│   ├── build-avif.sh               ← конвертация в AVIF
│   └── resize_og.py                ← рескейл OG-картинок (Pillow)
│
├── audit/                          ← последние audit-pro отчёты + AUDIT_CLEANUP_PLAN
└── images/                         ← все изображения
```

### Запрещено создавать новые CSS-файлы

У сайта **ровно 9 CSS + 1 шрифтовой**. Каждый файл = отдельный HTTP-запрос на статическом хостинге без bundler'а. Новая правка идёт в существующий файл по таблице:

| Что правишь | В какой CSS |
|---|---|
| Общие компоненты, статьи, шапка, тёмная тема | `site.css` |
| Главная + каталоги (только то, чего нет на других страницах) | `home.css` |
| Поиск (Ctrl+K, всплывашка) | `command-palette.css` |
| Мобильные hotfix touch-pointer overrides | `mobile-hotfix.css` |
| Мобильное оглавление Нагорной проповеди | `nagornaya-mobile-toc.css` |
| PremiumControls runtime | `floating-cluster.css` |
| Runtime-стили enhancements (scroll-эффекты) | `enhancements-runtime.css` |
| Runtime-стили highlights (подсветка) | `highlights-runtime.css` |
| Runtime-стили SW toast | `sw-toast.css` |
| @font-face декларации | `fonts/fonts.css` |
| Tailwind для Нагорной | `nagornaya/tw.min.css` (НЕ ТРОГАТЬ) |

### 2.1 Tailwind policy — локальное исключение, не курс всего проекта

- Tailwind **не является** основной styling-стратегией сайта. Базовый путь проекта: существующий handcrafted CSS (`site.css`, `home.css`, `mobile-hotfix.css` и т.д.) + Astro/build-time ownership layer.
- Допустимые контексты для Tailwind в будущем:
  1. уже существующие route-scoped legacy зоны вроде `nagornaya/tw.min.css`;
  2. изолированные subapps / iframe-apps / built artifacts, где UI живёт как отдельный мини-проект;
  3. новые большие self-contained interactive sections, если владелец явно согласует именно такой путь.
- Недопустимо без отдельного решения владельца:
  - тащить Tailwind в глобальный shell сайта;
  - переводить `/`, обычные article pages, shared Astro layouts или legacy-faithful wrappers на utility-first слой;
  - плодить новые глобальные compiled Tailwind CSS в `/css/`.
- Если Tailwind где-то допускается, он должен быть:
  - **route-scoped или app-scoped**, а не global;
  - собран в уже существующий допустимый asset-слой, не увеличивая core-count CSS-файлов в `/css/`;
  - подчинён visual-parity задаче: не делать «другой сайт» там, где owner хочет 1:1 continuity.
- Коротко: **Astro — да, Tailwind — только локально и по делу.** Главный курс миграции = сохранить visual language сайта, а не переписать его под новый utility stack.

### Запрещено создавать новые JS-файлы в `js/`

Все 14 файлов — фиксированный набор (11 базовых + 3 vosk-TTS). Новая логика идёт **внутрь существующего** файла по теме (если ничего не подходит — в `enhancements.js`).

---

## 3. PROTECTED — не трогать без письменного разрешения

### 3.1 Атрибуция авторства (КРИТИЧНО)

Фёдор Милованов на сайте — **автор-редактор** оригинальных статей и **редактор** переводов. **НЕ «автор»** в традиционном смысле. Он задаёт направление, редактирует, исправляет неточности и собирает материал при помощи ИИ.

#### Правило: нигде не писать «Автор: Фёдор Милованов».

| Тип контента | Byline в `<header>` | `.author-card-label` | Карточки в каталогах |
|---|---|---|---|
| Тип A — авторская статья | `Автор-редактор: Фёдор Милованов` | `Автор-редактор` | `Автор-редактор: Фёдор Милованов` |
| Тип B — авторская серия / разбор | `Автор-редактор: Фёдор Милованов` | `Автор-редактор` | `Автор-редактор: Фёдор Милованов` |
| Тип C — перевод зарубежной статьи | `Редактор: Фёдор Милованов` | `Редактор` | `Ред.: Фёдор Милованов` |

#### Meta-теги:

- **Тип A/B:** `<meta name="author" content="Фёдор Милованов">` + `<meta property="article:author" content="Фёдор Милованов">`.
- **Тип C:** `<meta name="author" content="Имя оригинального автора">` + `<meta name="translator" content="Фёдор Милованов">` + `<meta property="article:author" content="Имя оригинального автора">`.

#### feed.xml для всех типов:

```xml
<dc:creator>Фёдор Милованов</dc:creator>
```

### 3.2 JSON-LD структура

В каждой статье есть `<script type="application/ld+json">` с `Article` (или `ScholarlyArticle` для переводов) + `BreadcrumbList` + `Person` (автор оригинала или Фёдор как редактор). **Не упрощать, не «оптимизировать», не удалять.** Это критично для SEO.

Для переводов:
```json
"@type": "ScholarlyArticle",
"author": { "@type": "Person", "name": "Имя Автора Оригинала" },
"translator": { "@id": "https://gospod-bog.ru/about/#person" }
```

### 3.3 OpenGraph + Twitter Card теги

В каждой `index.html` статьи есть полный набор `<meta property="og:*">`. Не удалять, не сокращать «для чистоты». **Один `og:image` per page.** JPG-fallback можно ставить ТОЛЬКО если файл `images/<name>.jpg` реально существует.

### 3.4 Service Worker и cache-bust

Версии файлов в HTML:
```html
<link rel="stylesheet" href="css/site.css?v=2223865f">
<script src="js/site.js?v=54e3f377"></script>
```

Хеши — **CRC32 содержимого файлов**, генерируются `scripts/cache-bust.js`. **Не трогать руками.** После правки CSS/JS — обязательно `npm run cache-bust`.

`CACHE_NAME` в `sw.js` также пересчитывается автоматически.

### 3.5 Структура Нагорной проповеди

Серия = 5 частей + 3 вспомогательных страницы (`istochniki`, `nakhodki`, `seriya`). Внутри каждой части — `<aside class="article-toc">`. **Не упрощать TOC, не сжимать вёрстку, не удалять подключение `tw.min.css`** в Нагорной.

`tw.min.css` — минифицированный Tailwind, генерируется отдельно от основного проекта. Если нужен новый Tailwind-класс в `nagornaya/chast-*` — обратись к владельцу для регенерации.

### 3.6 Изображения

| Правило | Подробнее |
|---|---|
| **Формат** | `.webp` основной; `.png/.jpg` — backup, не для `<img>` напрямую |
| **Размеры** | Обязательно 3 ширины: `600w`, `900w`, `1200w` |
| **Именование** | `images/<name>.webp`, `images/<name>-600w.webp`, ... |
| **Качество WebP** | 82–85% |
| **OG** | один `og:image` per page; JPG-fallback только если файл реален |

### 3.7 Создание новой статьи — требования к качеству (ОБЯЗАТЕЛЬНО)

> **Полная премиум-планка контента (статьи, серии, квизы, глоссарий+тултипы, картинки,
> типографика) — в [`docs/CONTENT-QUALITY-STANDARD.md`](docs/CONTENT-QUALITY-STANDARD.md).**
> Читать перед созданием новой статьи или **новой серии**, чтобы контент не оказался
> скудным или «не по формату». Ниже — краткая выжимка.

При создании новой статьи (или значительном обновлении существующей) **обязательно** соблюдать следующие правила качества:

#### 3.7.1 Тултипы и глоссарий
- **Все** исторические названия (города, территории, законы, институты, события) должны быть обёрнуты в `<span class="gterm" data-term="..." data-term-title="...">...</span>`.
- **Все** сложные богословские, герменевтические, раввинистические и апологетические термины должны иметь тултип.
- Пояснения должны быть **не поверхностными** — минимум 1–2 предложения, понятных рядовому читателю, без упрощения до примитива.
- Примеры исторических терминов, требующих тултипа: Кеттеринг, Хорслидаун, Саутварк, Акт о корпорациях, Gin Craze, Банхилл-Филдс, Приорат Сиона, Никейский собор, гностики и т.д.

#### 3.7.2 Квизы
- Каждый квиз должен содержать **минимум 1–2 вопроса по терминологии и понятиям** (не только по фактам и сюжету).
- Все вопросы обязаны иметь `explanation.short` + `explanation.full`.
- `explanation.full` должен давать **глубокое богословское/историческое/методологическое объяснение**, а не просто «верно/неверно».
- Вопросы должны быть **адаптированы под тематику статьи**:
  - Биографии → акцент на личность, решения, контекст.
  - Экзегетика/герменевтика → акцент на метод, термины, аргументацию.
  - Апологетика → акцент на факты, критерий затруднения, контраргументы.
  - Антропология/доктрина → акцент на понятия, различения, богословские нюансы.

#### 3.7.3 Общий принцип
- Статья должна быть **самодостаточной** для читателя без богословского образования.
- Если термин или историческая реалия встречается в статье — читатель должен иметь возможность понять его значение **не выходя из статьи** (через тултип).
| **figcaption** | НЕ вставлять `<span class="ai-note">` или «Изображение сгенерировано ИИ». Прозрачность — только на `/about/`. |

#### Шаблон `<picture>`:

```html
<figure class="article-img wide reveal">
  <picture>
    <source srcset="../../images/<name>-600w.webp 600w,
                    ../../images/<name>-900w.webp 900w,
                    ../../images/<name>-1200w.webp 1200w"
            sizes="(max-width: 640px) 92vw, 1200px" type="image/webp">
    <img src="../../images/<name>.webp" alt="…"
         width="1200" height="630" loading="lazy" decoding="async">
  </picture>
  <figcaption>Подпись без упоминания ИИ.</figcaption>
</figure>
```

### 3.10 PremiumControls / Floating Cluster (protected subsystem)

**PremiumControls / Floating Cluster — Protected Subsystem Truths & Forbids**
**Source of truth:** current `main`, current owner decision and exact-head browser/visual guards. AuditRepo and VR history provide provenance and reverify evidence; they do not override newer owner-approved source contracts.

#### Core Truths (never violate)
- Roman numerals **MUST** use `<RomanNumeral value="II" />` (`src/components/ui/floating-cluster/RomanNumeral.astro`) → renders `<span class="gb-roman">` (`css/floating-cluster.css`).
  - Gold italic serif, `--color-accent-gold`.
  - Applies to: all Gill rails, series TOCs, part TOCs, sheets, bbars.
- Hermeneutics floater position (breadcrumb-level, not top-right):
  ```css
  .gb-floater--hermeneutics {
    top: calc(clamp(24px, 3.5vw, 44px) - 4px);
    right: max(8.5vw, env(safe-area-inset-right, 0px));
  }

  @media (max-width: 899px) {
    .gb-floater--hermeneutics {
      top: calc(clamp(24px, 3.5vw, 44px) - 4px);
      right: max(4.5vw, env(safe-area-inset-right, 0px));
    }
  }
  ```
  (`floating-cluster.css`; matches canonical v16 `.theme-toggle` lineage; the older `-28px` centered-calc formula is retired).
- All PremiumControls scoped with `data-fc-root` or `data-fc-controls="gill-rail"`.
- Gill v16 series-level marks are not the same as chapter-level TOC numerals: `context` = label `Введение`, `part1` = Roman `I`, `part2` = Roman `II`, `part3` = Roman `III`, `spravochnik` = label `Справ.`. Use `SeriesMark` / `RomanNumeral`; never make intro Roman `I` or spravochnik Roman `V` at series level.
- Controller (`js/floating-cluster-controller.js` — 1051 lines) handles TTS chunking, speed morph, `gb:tts-rate-change`, favorites, keyboard, Gill/GBS2 init.
- TTS engine = vosk-tts neural (VITS+BERT) via `js/vosk-tts-engine.js`, model on Hugging Face, cached in IndexedDB; Web Speech is the instant/fallback path. CSP `connect-src` must keep `https://huggingface.co https://*.aws.cdn.hf.co` (the model's real bytes come from HF's Xet CDN redirect — without the `*.aws.cdn.hf.co` entry the browser blocks it and Vosk silently never plays; root-caused 2026-07-08, fix `932230d`). First "Слушать" click plays Web Speech and warms the ~280MB model in the background for next time — this implicit download is **intentional but pending an owner UX decision** (consent gate), do NOT remove or "fix" it unilaterally. Delivery-architecture audit (verified, over-scoping deliberately declined): AuditRepo `incoming/tts-delivery-architecture-verification-2026-07-08/REPORT.md`.
- No double CSS delivery (PC-004).
- 4 archetypes supported (single, series-lite, series-rich, Nagornaya special).
- Visual parity + rollout-audit (28/28 + PC-007) is blocking gate.

#### Explicit Forbids (high-regression history)
**DO NOT without a dedicated owner-authorized LANE/SYSTEM PR and exact-head visual/browser evidence:**
- Change any calc/position/top/right on `.gb-floater`, `.gb-floater--hermeneutics`, `.gb-floater--series-lite`.
- Touch speed panel morph, viewport guard, tab trap, stagger, pill sizes (360-390px mobile).
- Edit `floating-cluster.css` sizes, icon 40px, ember ring, or add new rules for `.gb-roman` / `.gb-icon`.
- Introduce new CSS/JS files for controls (use existing only).
- Split or refactor `floating-cluster-controller.js` without dedicated lane.
- Allow raw `<div class="...__num">I</div>` or hardcoded romans in any Gill context / part / sheet (closes "самодел колхоз").
- Apply legacy `gbs2-rail` / `gbs2-sheet` bleed to gill-context pages (Part 1+ must stay v16).
- Override `data-fc-*` scoping or `fc-single-active` / `fc-series-active`.
- Change Play/Save (36px transparent, no white circle — R9 revert history).
- Break TTS click path, chunking, rate change, or favorites separate path.
- Touch Nagornaya special variant without its own visual audit.
- Change controller init for Gill rail (`initGillRail` that iterates ALL containers).

#### Audit & Gates
- `scripts/premium-controls-rollout-audit.js` (PC-006 + PC-007)
- `npm run strangler:build:production-like` + rollout-audit (blocking)
- `visual-parity` on Gill + Herm (`gill-context-visual-parity-audit` etc.)
- После owner sign-off защищается точный одобренный baseline и текущие guards; дальнейшее изменение требует новой доказательной серии, а не ожидания произвольного календарного срока.

**Owner note (verbatim):** "PremiumControls и т п не доделано... углублись в него еще серьезно... много регрессий было, пришлось откатывать снова... будь аккуратен"

---

## 4. CSS-правила

### 4.1 Каскад

Порядок подключения CSS в `<head>` (не менять):

1. `fonts/fonts.css` (preload + stylesheet)
2. `css/site.css`
3. `css/home.css` (на главной и каталогах)
4. `css/command-palette.css`
5. На Нагорной — **сначала** `nagornaya/tw.min.css`, **потом** `site.css` (Tailwind обязан грузиться раньше — site.css перебивает его по каскаду).

### 4.2 `!important` — обязательный чеклист перед добавлением

**Текущее состояние (2026-06-04, после PLAN-04):**

| Файл | `!important` | Назначение |
|---|---:|---|
| `site.css` | **202** ⚠️ | цель ≤200; потолок `IMPORTANT_CEIL` в audit-pro (только вниз) |
| `home.css` | 20 | OK |
| `command-palette.css` | 7 | OK |
| `mobile-hotfix.css` | 74 | touch / pointer:coarse overrides — легитимно |
| `nagornaya-mobile-toc.css` | 122 | Tailwind override на nagornaya-page — легитимно |

**Корректный подсчёт:** `grep -o '!important' file | wc -l` (НЕ `grep -c` — он считает строки).

#### 5-шаговый чеклист перед добавлением нового `!important`:

1. **Найди конкурента.** `grep -nE 'твой-селектор' css/*.css`.
2. **Рассчитай specificity** обоих правил (id=100, class=10, element=1).
3. **Если твоё выше** → `!important` не нужен; используй каскад.
4. **Если ниже** → увеличь специфичность через дополнительный класс/id/атрибут (например, `body.your-page .selector` или `.parent .selector`).
5. **`!important` оправдан ТОЛЬКО для:**
   - `@media print`
   - `@media (prefers-reduced-motion: reduce)`
   - `@media (forced-colors: active)`
   - `@media (scripting: none)` — no-JS fallback
   - Tailwind override на nagornaya (если selectivity не помогает)
   - Defensive disable (`display: none !important`) для скрытия legacy/повреждённого элемента
   - Внутри `@layer components/utilities` — для перебивания правил вне layer (правила вне `@layer` имеют выше priority по spec)

**Если уже есть `!important` на том же селекторе/свойстве — исправь существующий, не добавляй второй.**

### 4.3 Тёмная тема

Используется класс `html.dark` на `<html>` (переключается JS в `site.js`).

| Правило | Пример |
|---|---|
| ✅ Используй переменные | `color: var(--color-text)`, `background: var(--color-bg)` |
| ❌ Не хардкодить `#fff`, `#000` | искл.: фолбэки в `color-mix(in srgb, ... var(--color-x, #fff))` |
| ✅ `html.dark` всегда | НЕ просто `.dark` — JS выставляет именно `html.dark` |
| ✅ `color-mix()` fallback | Сначала простое значение, потом `color-mix` ниже — каскад перебивает |

### 4.4 CSS Integrity Rules — анти-регрессия

Эти правила введены после серии регрессий май-июнь 2026 (см. AUDIT_HISTORY).

1. **`html.dark` — всегда, никогда просто `.dark`.** Класс `.dark` на body не используется.

2. **Дублирование top-level селекторов запрещено.** Перед добавлением правила для `.foo` — `grep ".foo"` по файлу. Найдено → расширяй существующее, не добавляй новый блок. PLAN-04 P1+P1b слили 9 настоящих дублей.

3. **Пустые правила `{}` — мусор, удалять.** Допустимо только намеренное `:empty` с пояснительным комментарием.

4. **Двойное свойство в одном блоке — первое мёртво.** Два `box-shadow`, два `color` в одном `{}` — первый всегда перебивается. Удаляй его. **Исключение:** color-mix fallback pattern (`color: #fff; color: color-mix(...);`) — это намеренно.

5. **`:hover` с важным эффектом — только внутри `@media (hover: hover) and (pointer: fine)`.** Без guard — срабатывает на тапе (iOS/Android). Исключение: декоративные opacity/color, не меняющие layout.

6. **Переключатель темы — singleton.** Три канонических места:
   - `.theme-toggle` (absolute, в статьях рядом с breadcrumbs)
   - `.gb-fc-theme` (FAB через `gbFloatingControls` site.js модуль 29)
   - `.bar-icon-btn[data-action=theme]` (bottom-bar, mobile)

   ❌ Не создавать четвёртую: `.theme-float-btn`, `#themeFloat`, `.nag-theme-btn` — всё удалено в PLAN-04 P5.

7. **Tooltip — три канонических вида, один контроллер.**
   - `.gterm > .gtip` (глоссарий)
   - `.fn-marker > .tooltip` (академические сноски)
   - `.bref > .btip` (Библейские ссылки)

   Контроллер: `SiteUtils.makeTooltipController()` (единственная реализация).
   ❌ Не добавлять четвёртый тип tooltip с другими классами/позиционированием.

   **Модификатор `.fn-marker--dove`** — это НЕ четвёртый тип, а вариант `fn-marker`
   (та же `.tooltip`, тот же контроллер), у которого числовой маркер заменён на иконку
   голубя. Глиф рисует JS: функция `e()` в `js/site.js` инжектит inline-SVG
   `<svg class="fn-dove-icon">` (тело `.fn-dove-body` + отдельное крыло `.fn-dove-wing`).
   `::before` в CSS — это no-JS фолбэк (статический голубь), он скрывается, когда JS
   проставил `data-gb-dove-ready`. Крыло машет на hover (`@keyframes fn-dove-flap`,
   только `@media (hover:hover) and (pointer:fine)`, отключается при `prefers-reduced-motion`).
   ❌ Не возвращать инлайновый `<svg class="fn-dove-icon">` в HTML статей — JS инжектит его сам
   (audit-pro это проверяет и упадёт).
   ⚠️ **Все inline-маркеры закрывай явно** (`<span ...></span>`). `.fn-marker--dove` —
   `display:inline-flex`; незакрытый `<span>` «проглатывает» следующие `<p>/<h4>`, делая их
   flex-детьми → горизонтальный overflow. То же с «eyebrow»-лейблами `<span style="display:inline-flex">`.
   После правок контента/CSS прогоняй **visual-audit** (Playwright) — он ловит overflow и контраст:
   `python3 -m http.server 8080 --bind 127.0.0.1 -d dist & ; npx playwright install-deps chromium ; AUDIT_BASE=http://127.0.0.1:8080 npm run visual-audit` → сервер обязателен; отсутствие сервера и любые unsuppressed HIGH/CRITICAL теперь дают exit 1. Массовые low/medium false positives могут быть suppressed, но crash не suppress-ится.

8. **CSS-переменные — не объявлять «про запас».** Объявленная в `:root` переменная без `var(--...)` нигде = мёртвый код, удалить.

9. **Мёртвый компонент = удалить.** Если класс нигде в HTML/JS не используется (включая динамическую конкатенацию в JS `'class--' + variant`) — удалить CSS-правила. PLAN-04 P5-P7 удалил `.theme-float-btn`, `.ai-disclosure`, `.fx-lift`, `.epilogue-*`, `.float-fallback`, `.sd-url-strip/divider/copy/label-default`, `.article-img--portrait-wide`, `.card.fx-lift` и др.

10. **`!important` лимит для `site.css` — цель ≤ 200, жёсткий потолок задан в `audit-pro.js`.**
    Теперь это **автоматическая проверка** (`IMPORTANT_CEIL` / `IMPORTANT_GOAL` в `scripts/audit-pro.js`):
    - выше `IMPORTANT_CEIL` → **ERROR** (audit падает, push блокируется);
    - выше `IMPORTANT_GOAL` (200) но в пределах потолка → **WARNING** (продолжай гасить долг).
    Потолок — храповик: **только вниз**. Снизил `!important` — снизь и `IMPORTANT_CEIL`.
    Ручная проверка: `grep -o '!important' css/site.css | wc -l`.
    История: PLAN-04 342 → 199; затем dove/tooltip-серия дала регрессию 194 → 295,
    после чистки (унификация tooltip-компонентов) → 202.

    **ПРИЧИНА большого числа `!important`** (важно понимать): `css/site.css` исторически
    собран из НЕзакрытых `@media`/`@supports`/`@layer` блоков — на 2026-06-08 в файле был
    дисбаланс **+151** открывающей скобки (браузер закрывал их на EOF). Из-за этого многие
    правила оказывались «погребены» на глубине вложенности ~151 и применялись только при
    накопленных media-условиях — поэтому их и заставляли работать через `!important`.
    Блок `fn-marker--dove` был восстановлен **плоским, на глубине 0, в конце файла** (после
    явного закрытия всех скобок) — и там `!important` ему уже НЕ нужен (un-layered правило
    бьёт любой `@layer`). Дальнейшее снижение к 200 — тем же приёмом: чинить вложенность,
    а не добавлять `!important`. **Проверяй баланс скобок:**
    `python3 -c "s=open('css/site.css').read();print(s.count('{')-s.count('}'))"` → должно быть 0.
    **`!important` сам по себе не «зло», но >50 в одном файле — запах: каскадные слои
    (`@layer reset,base,components,utilities`) решают специфичность без него.**

---

## 5. JS-правила

### 5.1 Архитектура

Каждый JS-файл — самодостаточный, под одну тему. **НЕ создавать общий `utils.js`** — это сломает текущую модульность (`site-utils.js` существует, но имеет узкую роль). Подробная карта 27 модулей внутри `site.js` — в `README.md`.

### 5.2 Запреты

- ❌ `eval()`, `Function()`, `innerHTML = userInput`
- ❌ `addEventListener` без `removeEventListener` (память)
- ❌ CDN-зависимости (jQuery, Lodash) — проект bessebt (vanilla)
- ❌ ES2024+ фичи без проверки на Safari 15+
- ❌ Переход на TypeScript / Vite / любой bundler — архитектурный выбор vanilla

### 5.3 Обязательные проверки перед коммитом

```bash
# Синтаксис JS — все 14 файлов + sw.js + scripts
node --check js/*.js
node --check scripts/*.js
node --check sw.js

# Хеши cache-bust свежие
npm run cache-bust

# Полная валидация (HTML, JSON, manifest, SEO)
npm run validate:all

# Дизайн-токены
npm run tokens:check

# Главный аудит (38 проверок)
node scripts/audit-pro.js
# Должно: ✅ PASSED, errors = 0
```

Если хоть одна — FAIL, **не коммитить**.

#### Visual audit (Playwright, опционально но рекомендовано перед крупными CSS-правками)

```bash
# 1. Локальный HTTP-сервер (отдельная вкладка)
python3 -m http.server 8080 --bind 127.0.0.1

# 2. Playwright + chromium (один раз)
npm install --no-save playwright
npx playwright install chromium

# 3. Аудит (52 контекста / 156 скринов в shots/)
AUDIT_BASE=http://127.0.0.1:8080 npm run visual-audit
```

Должно: `0 console errors, 0 network errors` и `0` unsuppressed HIGH/CRITICAL bugs. Скрипт fail-fast падает без HTTP-сервера; `crash` не suppress-ится.

---

## 6. Статьи — как добавлять

### 6.1 Структура

```
articles/<slug>/
└── index.html
```

slug — строчные латинские буквы и дефисы, без слэша в начале.

### 6.2 Обязательные блоки в `<head>`

См. [`README.md` § «Добавление новой статьи»](README.md) — полный шаблон с meta-тегами, JSON-LD, OG/Twitter, SITE_CONFIG, breadcrumb JSON-LD.

### 6.3 Runtime-компоненты

| Компонент | Поведение |
|---|---|
| `<header class="article-header">` | h1, byline (см. §3.1), метаданные (дата, ≈мин чтения) |
| `<aside class="author-card">` | Перед `.sources-block` / `.reading-list` |
| `<aside class="article-toc">` | Для длинных статей (>20мин) |
| Глоссарий `<span class="gterm">термин<span class="gtip">…</span></span>` | luxury tooltip, mobile bottom-sheet |
| Академические сноски `<span class="fn-marker">N<span class="tooltip">…</span></span>` | mobile bottom-sheet |
| Библейские ссылки `<button class="bref" data-ref="Иер 17:9">` | tooltip с переводами |
| `.gb-accuracy-btn--email` | mailto: только `viktorcoy2012@gmail.com`, subject/body формируются JS из h1 + URL |

### 6.4 SITE_CONFIG — обязательная часть HTML

См. README.md § «Контракт `window.SITE_CONFIG`».

### 6.5 Quiz Engine v3+

Если `features.quiz.enabled === true` и в `window.SITE_CONFIG.quiz.questions` есть вопросы, HTML обязан содержать канонический mount `<div id="quizPlaceholder"></div>`. **Не вставлять вручную legacy `#quizWrapper`**: runtime сам генерирует `#quizWrapper`, `#quizLaunch`, `#quizQuestion`, `.quiz-option` и bonus-блоки. Ручной wrapper уже ломал Da Vinci / Krajne: overlay открывался, но вопрос и варианты не рендерились.

Вопросы могут содержать `sourceRef` для академического feedback:

```js
{
  id: 'q1',
  type: 'single',
  category: 'theology',
  difficulty: 'medium',
  question: 'Вопрос...',
  options: ['...', '...', '...'],
  correct: 1,
  explanation: {
    short: 'Короткий вывод.',
    full: 'Развёрнутое объяснение ответа.',
    anchor: 'sec-intro'
  },
  sourceRef: { label: 'Иер. 17:9', href: '#sec-intro' }
}
```

`sourceRef` — строка, объект `{ label, href }` или массив. Результаты квиза сохраняются в `localStorage` как `quiz-result-v2:{page.id}`. Legacy-формат `q / answer / ok / err / focus` поддерживается только для старых страниц; новые вопросы писать в новом формате.

### 6.6 Share API (для цитат, результатов квизов)

```js
window.SiteShare.open(button, {
  dialogTitle: 'Поделиться цитатой',
  title: document.title,
  text: '«цитата» — Название статьи',
  url: 'https://gospod-bog.ru/article/#:~:text=...'
});
```

НЕ подменять заголовок диалога через DOM. Все платформы (TG/WA/VK/MAX/OK/Copy) используют `activeShareUrl/Title/Text` из payload.

### 6.7 Язык статей и цитат

Русскоязычная статья должна читаться как цельный русский текст. Это правило закреплено не только документально, но и технически: `scripts/validate.js` и `scripts/audit-pro.js` блокируют английские прямые цитаты в читательском русском тексте и quiz-строках. Полная редакционно-источниковая политика — `docs/EDITORIAL-SOURCE-POLICY.md`.

- ✅ Основной текст, прямые речи, сильные цитаты, цитаты в quiz/explanation, подписи к иллюстрациям и callout-блоки — **на русском**.
- ✅ Английские названия книг, статей, журналов, издательств, URL, DOI, `href`, библиографические записи и технические термины в скобках допустимы, если они нужны для идентификации источника.
- ❌ Не вставлять в тело русской статьи английскую прямую цитату ради «солидности».
- ✅ Если важно показать, что формулировка верифицирована, дать русский перевод и рядом ссылку на оригинал: `МакАртур формулирует: «…» <a href="...">GTY transcript</a>`.
- ✅ Если перевод спорный или авторский, можно добавить: «перевод наш» / «смысловой перевод», но сам цитируемый текст остаётся русским.
- ❌ Не заменять русскую цитату машинным калькированным английским термином. Сначала русский эквивалент, затем при необходимости оригинальный термин в скобках: «различный отбор материала (variant selections)» — допустимо как термин; «variant selections» как самостоятельная цитата — нет.

### 6.8 После добавления статьи

1. Обновить `sitemap.xml` (ISO8601 lastmod с +03:00)
2. Обновить `feed.xml` (`<item>` в начало `<channel>` + `<lastBuildDate>`)
3. Обновить `data/series.json` (если статья входит в серию)
   — статья В СЕРИИ (часть/форзац/спутник)? Сначала прочитай **docs/SERIES-ENGINE-GUIDE.md** — единый контракт движка серий (ярусы roman/label/letter, defineSeriesConfig, темы, гейты). Не копируй компоненты движка.
4. Обновить `data/search-manifest.json` (для Ctrl+K)
5. Добавить карточку на `/articles/index.html` и (если уместно) на `/index.html`
6. Подготовить OG-картинку (1200×630, `.webp` или `.jpg`)
7. `npm run cache-bust`
8. `npm run validate:all` + `node scripts/audit-pro.js`

IndexNow при `git push main` сам уведомит Яндекс/Bing.

---

## 7. Красные флаги

| Если ты собираешься… | …почему НЕТ |
|---|---|
| «Создать новый CSS для article-share-buttons.css» | См. §2. Используй `site.css`. |
| «Создать `utils.js` для общих функций» | См. §5.1. У каждого JS своя тема. |
| «Заменить "Редактор" на "Автор" — короче» | См. §3.1. Это намеренно. |
| «Упростить JSON-LD — слишком много свойств» | См. §3.2. Это для SEO. |
| «Удалить старые AUDIT_*.md — лишний мусор» | Оставлять `AUDIT_HISTORY.md`. `audit/AUDIT_CLEANUP_PLAN_*.md` оставлять до завершения плана. |
| «Обновлю pretty каждый файл — для красоты» | НЕТ. Diff нечитаем. |
| «Прогоню `eslint --fix` — улучшит код» | НЕТ. Только точечно. |
| «Поправил CSS — забыл `cache-bust`» | Запусти. SW не подхватит правки. |
| «Перепишу legacy runtime на TypeScript/React для надёжности» | НЕТ. Astro/TS допустимы в `src/**` build layer; публичный runtime остаётся static HTML + handcrafted CSS + vanilla JS. |
| «Верну AI-disclosure для прозрачности» | См. §0 п.3. Об ИИ — только на `/about/`. |
| «Добавлю `!important` на всякий случай» | См. §4.2 чеклист. |
| «Перепишу `summary-card` с `!important` для надёжности» | НЕТ. PLAN-04 P8-P10 сняли 39 ненужных. Конкурентов в каскаде нет (компонент только на 2 не-nagornaya страницах). |

---

## 8. Service Worker — что важно

`sw.js` — версионируется автоматически (`scripts/cache-bust.js` обновляет `CACHE_VERSION`). При правке `sw.js` руками — **не править version-строку**, скрипт это сделает.

Precache список — в самом `sw.js`. При добавлении нового шрифта/JS-файла — добавь в precache.

---

## 9. Безопасность / гигиена

- ❌ Не добавлять `http://` ссылки в контент — `audit-pro` ругается на mixed-content. Используй `https://` или (для умерших источников) `https://web.archive.org/web/2025/http://...`.
- ❌ Не хранить ключи / токены в репозитории. `INDEXNOW_KEY` — только в GitHub Secrets.
- ❌ Не использовать `eval` / `Function` / `innerHTML = userInput`.

---

## 10. Что из корня репо никогда не коммитить

| Файл / маска | Почему нельзя |
|---|---|
| `*.patch` | git-артефакты, не контент |
| `*.py` в корне | Статический сайт. Python — только в `scripts/` (build-tools) |
| `*.tsx`, `*.ts` в корне | Root-мусор/одноразовые компоненты; TypeScript живёт только в `src/**` или `scripts/` по архитектуре |
| случайные `src/components/*` без использования | `src/**` — production Astro layer; компонент должен быть подключён, задокументирован и не нарушать ownership/gates |
| `README-<что-то>.txt`, `README.txt` | Дубли `README.md` |
| `PATCH-V*-SUMMARY.md`, `AUDIT_REPORT_*.md`, `*_PLAN_*.md` (в корне) | Истёкшие планы; история — в git log и `AUDIT_HISTORY.md`. План в `audit/` — оставлять до завершения. |
| `apply_*.py`, `fix_*.py`, `final_*.py`, `split_*.py` | Одноразовые костыли. Нужен скрипт — в `scripts/` + `package.json` |
| `shots/`, `visual-audit-report.json`, `deep-check.json`, `node_modules/`, `.playwright-browsers/` | Уже в `.gitignore` |
| `<INDEXNOW_KEY>.txt` | Генерируется `deploy.yml` только в Pages-артефакте |

Если AI-агент создал такой файл во время работы — обязан удалить перед коммитом.

---

## 11. История документа (свёрнуто)

Полная история r1..r110 — в `git log` (`git log --oneline --grep="AGENTS-r"`).
Детальные changelog'и r68–r110 свёрнуты при r115 (были занимали >400 строк).

Последние 5 значимых вех (полная таблица r111+ — выше):

Полная история r1..r62 — в `git log` (`git log --oneline --grep="AGENTS-r"`).

Сохранены здесь только последние 5 значимых вех:

| Версия | Дата | Главное |
|---|---|---|

---

## 12. Раздел «Карты» (/karty/) — архитектура и правила

Полная документация: **`docs/MAPS-ARCHITECTURE.md`**.

### 12.1 Ключевые принципы

1. **ОДНА базовая карта** — единая SVG-география Ближнего Востока (viewBox `0 0 1900 1430`). Маршруты = слои данных поверх неё.
2. **Вторая карта = триггер рефакторинга** — вынести base-geo, map-engine.js и route.json. НЕ выносить заранее.
3. **era-теги** — каждое место несёт `era:["bronze"]` (или `["iron"]`, `["roman"]`). При второй карте — фильтрация по эпохе.
4. **Standalone inline** — karty/avraam/ (129 KB, 852 LOC script) автономен от site.js. Лимит inline-JS: warning >500 LOC.

### 12.2 Текущее состояние карты Авраама

| Метрика | Значение |
|---|---|
| Места (PLACES) | 19 (с era-тегами) |
| Контекстные точки (CTX) | 7 (Вавилон, Мари, Эбла, Ниневия, Мегиддо, Пещера Лота, Хацор) |
| Этапы кинотура (STAGES) | 8 (с km дистанциями) |
| Слои (LAYERS) | 9 (abr, lot, war, cand, ctx, trades, waypoints, mounts, debate) |
| Торговые пути | Via Maris, Царская дорога, Дорога Сура (SVG + иврит) |
| Горы | Геризим (גְּרִזִּים), Гевал (עֵיבָל) |
| Археология | 13/19 мест верифицировано по академическим источникам |

### 12.3 URL — НЕ менять

| URL | Что | Почему |
|---|---|---|
| `/karty/` | Хаб библейских карт | Кириллица = SEO под русские запросы |
| `/karty/<slug>/` | Конкретная карта | Слаг = имя героя (avraam, ishod, pavel) |
| `/map/` | Карта связей статей | Служебная, другой тип, НЕ переименовывать |

### 12.4 Запрещено

- ❌ Копипастить avraam/ целиком для новой карты — вынос базы обязателен
- ❌ Растровые подложки / тайлы / спутник — только SVG-вектор
- ❌ Leaflet / MapLibre — оверкилл для стилизованной исторической карты
- ❌ Отдельный «поддомен» / SPA на карту — хаб /karty/ единый


---

> **Если правило кажется глупым — спроси, ПОЧЕМУ оно появилось.**
> Большинство «странных» правил появилось после реальных регрессий.
> Прежде чем менять контракт — открой `AUDIT_HISTORY.md`.


---

## 12.5. MapEngine — архитектура движка (КРИТИЧНО: читать перед любой правкой)

### 12.5.1 Структура файлов

```
karty/_engine/
├── map-engine.js          (~2590 строк) — ОСНОВНОЙ ФАЙЛ. Все карты грузят его.
│                            Самодостаточный: данные, рендеринг, CSS, события, таймлайн.
│                            НЕ импортирует модули.
├── modules/
│   └── timeline-integrated.js (67 строк) — интегрированный таймлайн (только pavel)
│                            ⚠️ выставляет container.style.position='relative' →
│                            контейнер карты обязан иметь explicit height (фикс 60c9bca6)
├── base-geo.svg           (38KB) — базовая география для всех карт
└── base-geo-premium.svg   (5KB) — расширенная версия
```

> Ранее в `modules/` лежали `map-data.js`, `map-render.js`, `timeline.js` (346 строк
> мёртвого кода от провального модульного рефакторинга). Удалены 2026-06-18.

### 12.5.2 ИСТОРИЯ РЕГРЕССИЙ (ЗАПРЕЩЕНО ПОВТОРЯТЬ)

**Критический инцидент (2026-06-16):**
При попытке «модульной» реорганизации движка (`9315a510`, `8f1e172c`) были
СЛОМАНЫ карты Авраама и Исхода:
- `route.json` данные были «выпотрошены» (gutted)
- Авраам перестал работать и был восстановлен как монолит (`2dfa1b3e`)
- Аудит Авраама сломался (`22abf658`, `72807e3d`)
- Модули `map-render.js`, `map-data.js` были созданы, но НЕ интегрированы
  в `map-engine.js` — они существуют мёртвым кодом

**УРОК:**
- ❌ НЕЛЬЗЯ рефакторить `map-engine.js` без предварительного полного понимания
  как он используется во ВСЕХ 10 картах
- ❌ НЕЛЬЗЯ удалять функции из `map-engine.js` — только добавлять новые
- ❌ НЕЛЬЗЯ трогать Авраама (`karty/avraam/index.html`, 4792 строк extracted (2385+2407)) —
  это отдельное приложение, которое использует движок только для ДАННЫХ
- ✅ Перед ЛЮБОЙ правкой движка: запустить `npm run maps:validate` и
  `npm run avraam:audit` (23/23 проверок)
- ✅ После правки: все 10 карт должны проходить maps:validate

### 12.5.3 Как работает движок СЕЙЧАС

**map-engine.js (~2590 строк) — самодостаточный:**
- Не импортирует модули (0 references to modules/)
- Содержит ВСЮ логику: данные, рендеринг, CSS, события
- `MapEngine.createMap(container, route, opts)` — главная точка входа
- 43 addEventListener (большинство через `_on()` с трекингом), `destroy()` вызывает `_cleanupAll()` для освобождения. Часть сырых addEventListener на element-scoped слушателях (маркеры) собирается GC вместе с элементом.
- Встроенный CSS (~103 строки) через `me-base-css` style element

**Какие карты как используют движок:**

| Карта | Способ | Примечание |
|---|---|---|
| avraam | `MapEngine.loadRoute()` + `MapEngine.validateRoute()` + `MapEngine.compareRouteData()` | Только DATA API. Весь рендеринг свой (68 функций). |
| ishod | `MapEngine.createMap()` | Полностью на движке |
| pavel | `MapEngine.createMap()` | Полностью на движке + timeline-integrated |
| shoftim...revelation | `MapEngine.createMap()` | Полностью на движке |

#### ⚠️ HAZARD: ДВОЙНОЙ ПУТЬ РЕНДЕРИНГА (читать перед любой правкой движка)

В проекте **ДВЕ независимые реализации** визуального слоя карт:

1. **MapEngine (`karty/_engine/map-engine.js`)** — рендерит 9 карт (ishod, pavel, shoftim,
   melachim, shvatim, yeshua, maccabim, early-church, revelation) через `createMap()`.
   Здесь живут `renderMarkers`, `renderPanel`, `open`, `setTab`, `flyTo`, `openPhoto`,
   `startTour`, `updateMinimap` и т.д.
2. **Авраам (`karty/avraam/avraam-app.js`, 2404 строки + index.html 2385 строк)** —
   флагман-карта со своим собственным рендерингом: `openPlace`, `setTab`, `renderPhotos`,
   `renderVariants`, `startTour`, `flyTo`, `updateMinimap`, ночные звёзды, караван, GSAP,
   ambient-аккорды. Использует MapEngine ТОЛЬКО для data-хелперов (`getPlaceVisual`,
   `getStoryState`, `getPanelModel`, `validateRoute`, `compareRouteData`).

**Это значит:**
- ❌ Правка `renderPanel`/`flyTo`/`open`/`setTab` в MapEngine **НЕ влияет на Авраам**.
  Авраам останется как был. И наоборот: правка `avraam-app.js` **НЕ влияет** на 9 других карт.
- ✅ Если нужно изменить визуал **везде** — править надо в ДВУХ местах (engine + avraam-app)
  и проверять оба: `npm run maps:validate` (10 карт) + `npm run avraam:audit` (23/23).
- ✅ Это намеренная архитектура (см. §12.5.6): Авраам = эталон, фичи ИЗВЛЕКАЮТСЯ из него
  в движок, а не наоборот. Портить Авраам ради «унификации» — повторение катастрофы
  `c94a3298`–`22abf658` (см. §12.5.2). Когда движок накопит ≥80% фич Авраама — можно
  портировать; до тех пор два пути сосуществуют.

**Перед правкой движка ВСЕГДА отвечай:** «Эта правка должна затронуть и Авраам?»
Если да — редактируй и `map-engine.js`, и `avraam-app.js`. Если правишь только движок —
проверь, что Авраам не сломался (`avraam:audit 23/23`), и задокументируй рассинхрон в
AGENTS changelog.

### 12.5.4 ПРАВИЛА создания новой карты

```bash
# 1. Создать route.json
# 2. Создать index.html (шаблон ниже)
# 3. Создать src/pages/karty/{slug}/index.astro
# 4. Обновить migration/page-ownership.json
# 5. Обновить data/public-content-baseline.json
# 6. Обновить karty/index.html (карточка в хабе)
# 7. npm run maps:validate
# 8. npm run contract:compare
```

### 12.5.5 ПРАВИЛА правки движка

1. **Никогда не удалять функции из map-engine.js** — только добавлять
2. **Перед правкой:** `npm run maps:validate && npm run avraam:audit`
3. **После правки:** то же самое + `node --check karty/_engine/map-engine.js`
4. **Avraam НЕ трогать** — он использует движок только для validate/compare
5. **Новые фичи добавлять в конец файла** — не переставлять существующий код
6. **Модули в modules/ использовать ТОЛЬКО если они уже интегрированы в engine.js**
   (сейчас они НЕ интегрированы — не импортировать их)

### 12.5.6 Правило извлечения фич из Авраама в движок

**Авраам — эталонная карта. Движок — общий фундамент.**

1. **Авраам НЕ трогать.** Он защищён аудитом 23/23. Любое изменение визуала = регресс.
2. **Извлекать фичи ИЗ Авраама В движок.** Анализировать код Авраама, понять паттерн,
   реализовать в движке как универсальный API.
3. **Тестировать на ishod, потом pavel.** Эти карты простые и используют движок.
4. **avraam:audit должен оставаться 23/23.** Никаких изменений в Аврааме.
5. **Не копировать — переосмысливать.** Код Авраама написан под конкретный дизайн.
   В движке фича должна быть универсальной, с опциями.

**Извлечено (v0.8→v0.9):**
- v0.8: фото-модалка (openPhoto) + интро-экран (me-intro)
- v0.9: timeline (me-timeline) + layer toggles (me-layers)

**Очередь на извлечение:**
- v1.0: контекстные маркеры (CTX), поиск по контенту (bible/arch)
- v1.1: миникарта (minimap), караван-анимация (опционально)
- v1.2+: портировать Авраама на движок (когда ≥80% фич)

### 12.5.7 Статус извлечения (2026-06-17)

**100% извлекаемых фич Авраама → движок.** 60/60 функций перенесено.

Авраам структурно очищен: JS вынесен в `karty/avraam/avraam-app.js` (2404 строки),
`index.html` сокращён с 4792 до 2385 строк (extracted). Движок остаётся чистым и универсальным.

Оставшиеся 12 визуально-декоративных фич (ночные звёзды, караван, GSAP,
ambient-аккорды и др.) являются дизайн-специфичными и НЕ извлекаются.

**Структура карт после реструктуризации:**
```
karty/
├── _engine/map-engine.js     ← ДВИЖОК (~2590 строк)
├── _engine/base-geo.svg      ← общая география
├── _engine/modules/          ← МЁРТВЫЙ КОД (не использовать)
├── avraam/
│   ├── index.html            ← HTML+SVG+CSS (2385 строк)
│   └── avraam-app.js         ← JS приложения (2404 строки)
├── ishod/index.html          ← 50 строк (createMap)
├── pavel/index.html          ← 50 строк (createMap)
└── ...                       ← все на createMap()
```

### 12.5.8 Известные долги движка

Состояние на 2026-06-20 (РЕФАКТОРИНГ 5.0 closing hole #2):

| Долг | Приоритет | Статус |
|---|---|---|
| 19 event listeners без removeEventListener | HIGH | ✅ Исправлено — 25 listener calls routed через `_on()` helper, document-level listeners (panel resize) тоже tracked. Только element-scoped addEventListener остались raw (GC с элементами). |
| Нет destroy() метода | HIGH | ✅ Исправлено — `destroy()` существует с r157; `_cleanupAll()` удаляет listeners, timers, rafId, tourTimer, injected CSS, body.overflow. `avraam:audit` 28/28 проверяет все 4 lifecycle guards. |
| Модули не интегрированы | MEDIUM | Созданы но не подключены |
| Авраам не на движке (свой рендеринг) | LOW | Намеренно, не трогать |
| CSS встроен в JS | LOW | Работает, не ломать |


## 13. Генеалогия — «Библейский атлас родословий» (курс застолблён 2026-07-14)

**Парадигма УТВЕРЖДЕНА владельцем: карточный АТЛАС по референс-макетам.**
Force-граф с кружками-медальонами — НЕ основное направление (страницы
`genealogy-interactive.html` / `nations-interactive.html` остаются как
дополнительные виды, но новая UI-работа по генеалогии продолжает атлас).

### 13.1 Визуальный язык атласа (не менять без владельца)

- **Карточки-узлы**, не кружки: скруглённый прямоугольник, иконка в круге
  слева, имя (bold), строка роли, строка стихов (Синодальные ссылки —
  «Быт 12:1–4 · 15:6»). Герой-карточка Христа — с крестом и усиленной рамкой.
- **Мессианский хребет** — вертикаль по центру (Адам → Ной → Авраам → Исаак
  → Иаков → Иуда → Давид → Соломон → Иисус Христос), связи — золотые бусины
  (line + stroke-dasharray «0.1 13» + round cap).
- **Кластеры-свитки** по бокам с ЧЕСТНЫМИ счётчиками (см. 13.2), за ними —
  декоративная «россыпь» нераскрытых имён (точки + тонкие линии, opacity ≤.34).
- **Карточки-списки**: 12 колен, Матфей 1 (42 поколения, 3×14), Лука 3
  (77 поколений), футер «⚭ Иосиф, муж Марии»; связь к Христу — пунктиром
  (пунктир = связь между линиями, см. легенду).
- **Три семантических масштаба**: обзорный (<0.5: ключевые узлы) / средний
  (<0.9: больше имён) / ближний (роли и ссылки). Чип масштаба в шапке сцены.
- **Обвязка**: слева — эпохи-главы (Сотворение → Потоп → Патриархи → Царство
  → Плен → Исполнение); справа — мини-карта, зум ±/⛶/◎ с %, поиск, фильтры,
  быстрые ссылки; внизу — легенда линий; тур на 8 шагов; Поделиться /
  Сохранить вид (deep-link #карточка и #view=x,y,k).
- Палитра/типографика — токены сайта (Georgia, паперно-золотая гамма,
  обе темы через data-theme + prefers-color-scheme). Без внешних шрифтов/CDN.

### 13.2 Данные — железные правила

- **Счётчики только честные** — из TIPNR-вычислений (layout-l0.json:
  cluster--*) либо канонические (70 народов, 12 колен, 12 князей, 42/77
  поколений). Выдуманных чисел не публиковать.
- **Отождествления народов** — с confidence (certain/probable/disputed/
  obscure), справкой, источниками и mythWatch (защита от мифов: Магог≠Россия,
  Фарсис≠Британия и т.п.). См. data/genealogy/v2/table-of-nations.json.
- Имена — синодальная орфография; структура родословий — прямо из текста.

### 13.3 Файлы и сборка

```bash
# движок атласа (ОСНОВНОЙ):
scripts/genealogy-build/atlas-template.html   # рендер + интеракции
scripts/genealogy-build/build-atlas.mjs       # сцена (карточки/связи/тур)
# дополнительные виды (force-граф, вторично):
scripts/genealogy-build/interactive-template.html + build-interactive.mjs
# данные: data/genealogy/v2/ (table-of-nations.json, research/, build/)

node scripts/genealogy-build/build-atlas.mjs        # → build/atlas-interactive.html
node scripts/genealogy-build/build-nations-graph.mjs
node scripts/genealogy-build/build-interactive.mjs
```

- Pure Node 22, ноль npm-зависимостей, детерминизм (никаких Date.now()/
  Math.random() в build-скриптах).
- Верификация UI — скриншоты Playwright (обе темы, макро + микро-кропы,
  мобильные шторки, пинч) ПЕРЕД каждым пушем; JS-ошибок в консоли — 0.

## 9. Железобетонные UI-правила (НИКОГДА не нарушать)

### 9.1 Имена Бога на главной странице
- `js/enhancements.js` содержит блок ambient-фраз (42 фразы: иврит/греческий/латинский (35 боковых + 7 центральных))
- **Страж запуска**: `if (!document.getElementById('hScriptureBg')) return;`
- НЕ менять на проверку `.h-phrase--ambient` — элемента в статическом HTML нет
- При любых правках `js/enhancements.js` — проверить что `document.querySelectorAll('.h-phrase').length >= 35`

### 9.1b Главная — единая адаптивная библиотека без дублирующего dock
- Главная сохраняет один контент и один визуальный язык на desktop/mobile; на малой ширине меняются порядок, плотность и размеры, а не создаётся отдельный движок.
- Фирменный интерактив Аввакума 3:19 обязателен: нажатие на еврейское слово заменяет его переводом на том же месте; источник остаётся под строкой.
- Боковые ambient-фразы и `#hScriptureBg` сохраняются как часть идентичности desktop-главной.
- Если у пользователя есть сохранённый прогресс, resume-блок (`#resumeReadingBlock` / `#resumeListBlock`) остаётся сразу после hero и показывается только при реальных данных.
- Единственный первичный вход в материалы — адаптивный `.h-home-gateway` с ровно четырьмя свободно стоящими SVG-направлениями; не оборачивать знаки в dashboard-плитки.
- Минимальный набор ссылок gateway:
  - `/articles/`
  - `/nagornaya/`
  - `/biografii/`
  - `/karty/`
- Опубликованные материалы и ключевые серии идут выше roadmap/«В планах».
- На главной запрещены отвергнутые владельцем `.h-mobile-hero-hub`, `.h-mobile-dashboard`, `.h-mobile-rail`, `.h-mobile-paths` и `.h-mobile-dock`: они дублировали до 19 точек навигации и перекрывали контент.
- На главной не использовать BTOC или движки статей/серий/карт: route остаётся на `HomePageChrome + HomeMain`.
- Нижняя браузерная панель исчезает только в установленном PWA `display: standalone`; страница не должна имитировать её своей фиксированной панелью.
- `#main-content` на `/` обязан оставаться `data-pagefind-body`, чтобы домашняя страница индексировалась поиском как точка входа, а не выпадала из discoverability.
- Проверять 320/360/390/430 px, safe-area iPhone, landscape, desktop, обе темы и `prefers-reduced-motion`; интерактивные цели должны быть не меньше 44×44 px.

### 9.2 FC-controls (плавающие кнопки тема/поиск)
- Компактный пилл-контейнер с `backdrop-filter`, `border-radius:24px`, `padding:3px`
- Кнопки `36x36px`, NO `border-radius:50%`, NO `background-color` на hover
- Hover: ТОЛЬКО `transform:translateY(-2px)` — никаких кругов, никакого фона
- Высота контейнера ≤ 110px (две кнопки + padding)
- Класс `.gb-floating-controls` в `css/site.css`
- На mobile, если `features.themeToggle.enabled !== false`, должен быть видимый theme control: `.gb-fc-theme`, `#barThemeBtn`, `#themeToggle` или Нагорная sidebar/bottom-bar equivalent. Не скрывать `.gb-fc-theme` только потому, что есть bottom-bar: это уже приводило к отсутствию темы на статьях.

### 9.3 bio-cover в статьях о Гилле
- `articles/dzhon-gill-chast-1-chelovek/index.html` ДОЛЖЕН содержать `.bio-cover` с изображением `gill-authentic-study-cover`
- Это 16:9 кабинетный портрет Гилла в библиотеке — НЕ city-view, НЕ portrait 3:4, НЕ кафедра
- `aspect-ratio` в `.bio-cover` = `16/9` (не 21/9)

### 9.4 Карточки-thumbnails серии Гилла на главной
- Часть 1 (`dzhon-gill-chast-1`): thumbnail = `gill-authentic-study-cover` (широкоформатный кабинетный портрет)
- НЕ использовать `og-gill-authentic-study-cover` как thumbnail-картинку карточки: это social-share OG, а не компактный карточный ресурс

### 9.5 Запрет дублирования контента
- В `chast-1` — НЕ должно быть двух одинаковых портретов Гилла
- `biography-portrait` / малый 3:4 `dzhon-gill-portret` в шапке — НЕ возвращать
- На первом экране Части I должен остаться один главный образ: `.bio-cover` с `gill-authentic-study-cover`

### 9.6 Playwright-регрессионные проверки
`scripts/visual-audit.js` содержит автоматические проверки:
- `ambientPhrases === 0` на `/` → CRITICAL bug
- `fcControlsH > 110` → HIGH bug
- отсутствует текущий Gill Part I cover marker (`.bio-cover` или GBS2 cover/header) → HIGH bug

Запуск перед каждым коммитом: `npm run validate:all && node scripts/audit-pro.js`

### 9.7 Theme-toggle / search-icon — ЧИСТЫЙ SVG БЕЗ РАМОК
**Никогда не добавлять** `background`, `border`, `border-radius`, `box-shadow`, `backdrop-filter` к иконкам переключения темы и поиска. Это:
- `.theme-toggle` (absolute, в статьях)
- `.gb-fc-theme`, `.gb-fc-search` (FAB, `js/site.js` модуль 29)
- `.h-cp-btn`, `.gb-nav-search-icon` (в шапке home)
- `.bar-icon-btn` (bottom-bar, mobile)

Должно быть: **только сам SVG** (stroke=currentColor), `background:transparent`, `border:none`, никаких pill/circle обводок. Hover-эффект только `transform:translateY(-2px) scale(1.08)` + изменение `color`, без opacity-флипа (иначе оба `.icon-sun` и `.icon-moon` могут показаться одновременно — баг от 2026-06-08).

**Исключение:** серия «Нагорная проповедь» (`body.nagornaya-page`) — там своя система с Tailwind-классами, не трогать.

**Search keyboard contract:** `Ctrl/⌘+F` — всегда нативный поиск браузера; сайт не должен делать `preventDefault()` и не должен открывать command palette. Command Palette открывается только `Ctrl/⌘+K` (case-insensitive: Chromium/Playwright может дать `key="K"`). `Escape` внутри palette должен закрывать palette, а не только чистить строку. Это защищено `audit-pro` G112 и `npm run interactive-audit`.

**Media/share runtime contract:** image viewer должен открываться по клику на article image, ставить scroll-lock (`html.style.overflow='hidden'`) и закрываться по Escape с восстановлением overflow. Share dialog должен открываться через `#articleEndShareBtn`, иметь `aria-hidden="false"`, закрываться по Escape и опираться на canonical URL, не на preview/local URL. Это проверяет `npm run interactive-audit`.


**Map publication status contract:** temporary map placeholders are allowed to be reachable, but never indexable/search-promoted. If `route.json` has `publication.status=temporary-placeholder`, the page must be `noindex, follow`, excluded from sitemap/llms/search-manifest/public baseline, and must not carry `data-pagefind-body`. This is guarded by `npm run maps:publication-status` and included in `npm run maps:validate`.

**Search fallback contract:** hardcoded command-palette fallback recommendations in `js/search.js` must match `data/search-manifest.json` read times. `npm run data:consistency` blocks drift.

**Readable/publication contract:** декоративные номера summary (`.summary-card__num`) не должны быть читательским текстом: span пустой, `aria-hidden="true"`, номер хранится в `data-num` и рисуется CSS `content:attr(data-num)`. Главный H1 на `/` в `innerText` обязан читаться как `Господь Бог — Сила Моя`. В публичном тексте не должно быть внутренних enum labels (`Book`, `Confession`, `ChicagoDoc`, `Warning`, `Father`, `Academic`) и overclaim-бейджа `Проверено историками`. Это защищает `npm run readable-audit`.

**Data/source contract:** после изменения карточек, серий или article meta запускать `npm run data:consistency` (readTime/title/search-manifest/series drift). Для внешних источников production-проверка — `npm run source:links:dist` (строит production-like `dist` и проверяет именно публикуемый artifact). Root-only `npm run source:links` остаётся быстрым source-layer audit. TLS/404/bad-host — ошибка; 403/429/timeout — предупреждение с ручной проверкой, потому академические сайты часто режут ботов.

**Workflow/CI contract:** `indexnow.yml` и `deploy.yml` обязаны запускать `npm run validate:static-publication`; `source-links.yml` и `interactive-audit.yml` должны быть manual+scheduled; `notify-on-failure.yml` должен слушать оба этих workflow. Это защищено `npm run workflows:check`. Локальный `npm run ci:check` теперь = cache-bust + static publication gates + workflow policy.

### 9.8 article-topnav — УДАЛЁН
Sticky шапка `.article-topnav` (показывалась при скролле статьи с «← Господь Бог — Сила Моя | TITLE | поиск») **удалена из всех 8 статей** по запросу владельца 2026-06-08. **Не возвращать.** Хлебных крошек (`.breadcrumb`) достаточно для навигации.

CSS-правила `.article-topnav*` пока остаются в site.css как dead code (для возможного восстановления). При полной чистке можно удалить через PLAN; до этого не реанимировать в HTML.

### 9.9 Hover на ссылках-карточках в тёмной теме — НЕ розовый
`.h-article-card:hover .h-article-title` в светлой теме = `--h-accent` (#8b2626 темно-красный — ок). В **тёмной** теме `--h-accent` = #d97a6c — это **розово-красный**, плохо контрастирующий с золотисто-палевым телом. Поэтому в `html.dark` hover-цвет переопределён на **золотистый `#e8c97a`** (`css/home.css`). Не возвращать на `var(--h-accent)`.

### 9.10 FOUC шрифтов на главной
Кроме `Lora-cyrillic-400`, **обязательно preload** для:
- `Inter-cyrillic-600` (используется в `.h-sacred-ref` — «АВВАКУМ 3:19»)
- `PlayfairDisplay-cyrillic-700` (используется в `.h-section-title`, hero и др.)

Иначе виден FOUC: сначала рендерится fallback Times New Roman, потом подмена. Это видно на главной при перезагрузке.



### 9.13 Изображения владельца — НЕ ЗАМЕНЯТЬ генерациями

**НИКОГДА** не заменять изображения, которые загрузил владелец, на AI-генерации.
Если изображение визуально не устраивает — спроси владельца, а не генерируй замену.

Конкретно:
- `whitefield-preaching.*` — картинка Уайтфилда на Кеннингтон-Коммон. Загружена владельцем.
  Это ВТОРАЯ картинка Уайтфилда в gill-kontekst. НЕ удалять, НЕ заменять.
- `whitefield-field.*` — картинка Уайтфилда в поле. ПЕРВАЯ в gill-kontekst. НЕ удалять.
- Между двумя Уайтфилдами должен быть текст (не ставить подряд).

### 9.12 Голуби (fn-marker--dove) vs Цифры (fn-marker) — РАЗДЕЛЕНИЕ ТИПОВ СНОСОК

Два типа сносок — **железобетонное правило**, не смешивать:

| Тип | Класс | Иконка | Когда использовать |
|---|---|---|---|
| **Цифровая сноска** | `fn-marker` (без `--dove`) | Число (1, 2, 3…) | Ссылки на источники, библиографические сноски, переводческие ссылки на оригинал |
| **Голубь-сноска** | `fn-marker fn-marker--dove` | 🕊️ SVG-голубь | Пояснения редактора, справочная информация, терминологические справки, контекстные примечания |

**По статьям:**
- **Переводы** (герменевтика Чау и др.) → **ТОЛЬКО ЦИФРЫ**. В оригинале были цифровые сноски.
- **Авторские статьи** (20 антисоветов и др.) → **ГОЛУБИ** для авторских/редакторских комментариев.
- **Биографии Гилла** → цифры для ссылок на источники, голуби для пояснительных вставок (†, ‡ и т.д.).
- **Код да Винчи, Иеремия, Римлянам** → цифры (ссылки на источники).

**Запрещено:** ставить голубей на ВСЕ сноски подряд. Голубь — это визуальный маркер «здесь пояснение», а не «здесь источник».

CSS поддерживает оба типа:
- `.fn-marker` — цифра в суперскрипте, hover показывает tooltip
- `.fn-marker.fn-marker--dove` — SVG-голубь с машущим крылом, hover показывает tooltip

JS `site.js` функция `e()` инжектит SVG тело голубя только в `.fn-marker--dove`.

### 9.11 Series World (GBS) — единый канон для серий статей (с 2026-06-11, r96–r99)

Все многочастные серии статей используют **GBS** («мир серии»):
тёмный левый рельс (desktop) + sticky-шапка и нижняя капсула со шторкой (mobile),
weighted-прогресс серии по минутам, живой TOC, hero+kinetic, prev/next-карточки,
era-timeline. Живые эталоны: 5 страниц Гилла + 2 hard-texts.

- Стили: `css/site.css`, секция `body.gbs-world` / `gbs2-*` (минифицировано, ~строки 369–373).
- Поведение: `js/enhancements.js`, 3 IIFE «GBS reference pilot v2».
- Анатомия миграции страницы, плейсхолдеры и грабли: **`docs/GBS-PATTERN.md`**.
- `data/series.json` остаётся источником данных серий (тайтлы/slug'и/минуты/status); формат прежний:
```json
{
  "<series-key>": {
    "title": "Название серии",
    "baseUrl": "/articles/",
    "parts": [
      {"n": 1, "slug": "url-slug-of-part", "title": "Часть I. Заголовок", "status": "published", "readingTime": 25}
    ]
  }
}
```
- Прогресс серии в рельсе — data-атрибуты на body: `data-gbs2-done-min` (сумма минут предыдущих частей), `data-gbs2-part-min`, `data-gbs2-total-min`. При добавлении части — пересчитать на ВСЕХ страницах серии + series.json.
- Для встраивания gbs2-компонентов (timeline, next-card) на страницы БЕЗ `body.gbs-world` (лендинги серий, каталоги) — класс **`.gbs2-scope`** на секции-контейнере (даёт переменные light+dark). Пример: `/hard-texts/`.
- `status: "planned"` части показываются приглушёнными (`opacity:.55`, без href) в рельсе/шторке/next-картах.

**Запрещено:**
- Возвращать legacy series-UI: `data-series-strip` / `data-series-nav` / `.gb-strip` / `.gb-snav` / `.series-next-cta` — удалены со всех страниц в r96–r97; рендереры strip/nav и CSS `.gb-snav` ВЫЧИЩЕНЫ из кода в r107 (по «да» владельца на тотальную чистку). В `js/series-cards.js` остался только режим `data-series-cards` (каталоги); к article-страницам файл не подключается (r99).
- Дублировать inline-карточки «Часть I / II / III» вручную в HTML.
- Создавать новые CSS/JS-файлы под серию — GBS живёт в существующих файлах.
- Оставлять при миграции legacy-блоки `#reading-progress`, `#section-label`, старый `#themeToggle`, `#tocSidebar`, `#bottomBar`, `#btocOverlay` — именно так упал агент до r96 (двойная полоса прогресса).

**Нагорная проповедь** — историческое исключение (свой Tailwind-sidebar + nagornaya-mobile-toc.js). Не трогать; новые серии делать на GBS.

Перед изменением GBS-кода обязательно прогнать `npm run interactive-audit`: он проверяет на всех 7 series-страницах рельс/aria-current/toc/ring, отсутствие legacy-UI, клик по TOC (скролл, не навигация), а на мобиле — открытие шторки, переключение вкладок и закрытие.

**Инварианты дизайна GBS (решения владельца, фаза 2; нарушение = регресс):**
- Все направляющие линии — от реальных центров элементов (getBoundingClientRect), без магических отступов.
- Scroll-spy: кэш позиций + инвалидация на resize/шрифты; низ страницы → последняя секция; гистерезис ~12px.
- Автоподскролл активного пункта TOC — только scrollTop контейнера, НИКОГДА scrollIntoView.
- Один rAF-тик на скролл; классы перекрашиваются только при смене секции.
- view-transition-name не в статическом CSS — только на время перехода (JS вешает/снимает).
- Resume-позиция пишется только после реального скролла пользователя (wheel/touch/клавиши) и y>120.
- prefers-reduced-motion отключает параллакс/кинетику/зерно/отсчёты/VT — функциональность остаётся.
- У каждой картинки интерфейса — дизайн-фолбэк (onerror → градиент + номер части).

**Анти-фичи — владелец ЯВНО отклонил, не возвращать:**
- ❌ чекбокс «Отметить прочитанным» (прогресс только автоматический);
- ❌ «Дочитаете к ЧЧ:ММ» (допустим только тихий «осталось ~N мин»);
- ❌ минуты у пунктов оглавления ЧАСТИ (в списках частей — можно);
- ❌ кикер «СЕРИЯ … — N ИЗ M» над H1 (дублирует hero-подпись);
- ❌ автопереход на следующую часть по таймеру (только подсветка + клик);
- ❌ геймификация с бейджами.

**Ожидает решения владельца (без «да» не делать):** Popover API для тултипов; 3D-карта связей (three.js, этап «в» §2.4); hover-карточки внутренних ссылок / Tufte-сноски / режим фокуса; GBS для pastor-series (осмыслен при ≥2 частях); миграция «Римлянам 8» по docs/GBS-PATTERN.md когда статья будет написана (total пересчитать, обновить series.json + сестринские страницы).


### 9.17 John Gill image system — final editorial lock

  * Часть 1 bio-cover и thumbnail = `gill-authentic-study-cover`: монументальный кабинетный портрет Джона Гилла в библиотеке, 16:9.
  * Малый 3:4 портрет `dzhon-gill-portret` в верхней карточке Части I не использовать: он создаёт дублирование и непремиальную белую рамку.
  * На первом экране Части I должен быть один главный визуальный образ, а не два портрета подряд.
  * В Части I после рассказа о крещении и гимна должна быть иллюстрация `gill-baptism-scene`; не ставить её перед обращением на Быт. 3:9.
  * В Части II в блоке о раввинистике/Талмуде использовать только `gill-talmud-study-authentic`; старую `gill-engraving-talmud-study` не возвращать.
  * Книжная лавка Кеттеринга в историческом контексте = `gill-bookshop-strip` как узкая горизонтальная полоса. Не возвращать вертикальный `gill-context-scroll`.
  * Кафедра Гилла в тексте = `gill-pulpit-strip` как узкая горизонтальная полоса.
  * В Частях I–III не возвращать interstitial-блок `context-bridge` с текстом «Исторический фон серии…». После owner-review 2026-06-10 он признан лишним дублем навигации.
  * Слот скорби/пастырского утешения в Части I = `gill-funeral-sermon`: погребальная проповедь Гилла в капелле XVIII века, а не сцена с одной женщиной и не типография.
  * `gill-pastoral-succession` не трогать: владелец отдельно попросил оставить эту схему как есть. Если файл временно не используется в HTML, не удалять его без отдельного подтверждения.
  * Защищённые исходники схемы преемственности: `images/gill-pastoral-succession.webp`, `images/gill-pastoral-succession.jpg`, `images/gill-pastoral-succession-600w.webp`, `images/gill-pastoral-succession-900w.webp`, `images/gill-pastoral-succession-1200w.webp`.

### 9.18 John Gill grief/consolation slot

  * В Части I слот скорби/пастырского утешения должен использовать `gill-funeral-sermon`.
  * Сцена должна показывать исторически правдоподобную погребальную проповедь: кафедра, открытая Библия, траурное собрание, скорбящая община, а не частную сцену утешения одной девушки.
  * Старую семью `gill-pastoral-consolation` после замены не возвращать.

### 9.19 John Gill image truth-lock — описывать реальное изображение, а не только filename

  * После self-audit 2026-06-10 зафиксировано: у части Gill-asset families filename исторически неточен. **Нельзя слепо писать alt/figcaption по имени файла. Сначала открыть картинку и описать то, что реально видно.**
  * `gill-kettering-1697` = ранняя кеттерингская бытовая/ремесленная среда, дом и дорога под вечерним небом. Это **не** funeral scene и не обязательно «суконные мастерские крупным планом».
  * `gill-spurgeon-succession` = символическая сцена преемственности кафедры (кафедра, Библия, молитва), а **не** буквальный портрет/репортаж со Спердженом. Если используется, подпись должна быть о символе преемственности, не о «фото Сперджена».
  * `gill-bunhill-fields` = погребальная процессия / memorial engraving в Банхилл-Филдс, а не просто пустой вид кладбища. Подпись должна это отражать.
  * `gill-young-boy-shop` в текущей approved-family визуально является still-life с чернильницей и пером. Если используется — подпись о письме/чернилах/инструментах труда, а не о «мальчике в книжной лавке».
  * Если image family кажется семантически неидеальной, **не возвращать старые удалённые семьи автоматически**. Сначала проверь, можно ли честно переписать alt/figcaption под реальный approved image. Старое «restore ради совпадения filename→caption» запрещено без отдельного подтверждения владельца.

### 9.20 John Gill historical-restore lock

  * Если восстанавливаешь Gill-текст из старого git history, после вставки **обязательно** перепроверь `fn-marker` / `fn-marker--dove` вручную. Старые коммиты могли содержать формально «сбалансированные», но семантически сломанные span-обёртки, когда outer-marker проглатывает абзац.
  * После любого history-restore для Gill-страниц: (1) grep по `<figure class="article-img` + captions, (2) browser-check desktop+mobile, (3) verify no stale preload remains for removed/replaced image family.

### 9.21 Glossary/tooltips in summaries — HARD LOCK

  * `.summary-card` / блок «Коротко» — **только краткий plain-text summary**. Внутри summary-card запрещены `.gterm`, `.gtip`, всплывающие glossary-карточки, dotted underline и любые interactive tooltip terms. Термины и всплывающие пояснения допустимы в основном тексте статьи, но не в summary.
  * `js/glossary.js` обязан пропускать `.summary-card` и при авто-hydration текста, и при `hydrateGlossaryTerms()`. Не возвращать glossary auto-markup в summary ради “обогащения”: владелец явно попросил минималистичные summary без пунктирных терминов.
  * Glossary popup desktop-карточка должна быть цельной, без урезанного внутреннего layout: `.gtip-luxury` — block layout, header/title/body не должны вести себя как inline-flow, нормальные короткие определения не должны получать внутренний scrollbar. Mobile bottom-sheet может скроллиться только когда контент реально длинный.
  * Перед любыми правками tooltip/glossary: Playwright smoke на Gill context + Gill part + Krajne: hover/tap `.gterm`, проверить видимую карточку, непрозрачный фон, non-zero width/height, no clipping, no `.summary-card .gterm`.
  * Source-footnote tooltips must be flat DOM: запрещены `.tooltip .fn-marker`, `.tooltip .tooltip`, `.fn-marker .fn-marker`. Это уже ломало статью Chou/hermeneutics: основной текст был проглочен внутрь tooltip. После любых массовых правок сносок прогонять audit-pro G104 и browser hover на статье.
  * `audit-pro.js` guards G104/G106/G107 защищают эти правила. Если они падают — не обходить, а чинить tooltip/summary contract.

### 9.22 Регистр названий отделов/разделов — Title Case (с 2026-06-12)

  * **Названия ОТДЕЛОВ библиотеки** (бренд-лейблы разделов) пишутся в Title Case:
    значимые слова — с заглавной, служебные (предлоги/союзы/частицы) — строчными,
    кроме первого слова. Образец-эталон: **«Конфессии и Деноминации»**.
    Служебные строчными: *и, а, но, или, в, на, по, с, о, об, от, до, для, к, у,
    за, из, под, над, при, без, через*.
  * Это касается именно **имён разделов** (как они звучат в навигации, на карточке
    отдела на главной, в H1 хаба и хлебных крошках нового раздела). Новые отделы
    создавать сразу в этом регистре.
  * **НЕ распространять Title Case на:** заголовки статей, описательные заголовки
    секций, цитаты, имена собственные, ссылки на Писание, ambient-фразы. В русском
    это обычный регистр предложения (sentence case) — он остаётся как есть, иначе
    текст становится неидиоматичным. Слепая массовая «капитализация каждого слова»
    запрещена.
  * Легаси-идентификаторы, уже зашитые в structured data (`articleSection`,
    breadcrumb JSON-LD, `SITE_CONFIG.section`), менять только если меняется ВЕЗДЕ
    согласованно (видимый текст + JSON-LD + breadcrumbs + SITE_CONFIG на всех
    страницах раздела) — иначе не трогать ради косметики.

### 9.23 Отдел «Конфессии и Деноминации» — 3D-карта (iframe-приложение) и регресс-защита (с 2026-06-13)

### 9.24 OG image alignment — выделенные og:image НЕ обязаны совпадать с LCP (с 2026-06-15)

Аудит-про выдал INFO-level notice: 5 страниц имеют `og:image` ≠ LCP-priority изображению.
Это **намеренно** для страниц с выделенным social-share изображением (custom og:image с
кастомным `og:image:alt` для читаемого описания в соцсетях). Страницы: `/`, `/articles/20-antisovetov-pastoru/`, `/articles/kod-da-vinchi/`, `/articles/krajne-li-isporcheno-serdce/`, `/pastor-series/`. Правило: если у страницы есть dedicated og-изображение с кастомным alt — keep it, не выравнивать по LCP.

Документировать OG alignment decision в AGENTS.md §9.24 вместо изменения изображений.

  * `/konfessii/russkij-baptizm/` — **нативная обёртка сайта** (шапка/крошки,
    SEO/OG/JSON-LD/canonical, sr-only `<h1>`, CSP `frame-src 'self'`, Yandex, лоадер),
    внутри `<iframe src="./_app/index.html">`.
  * **Внутри iframe — ОРИГИНАЛЬНОЕ 3D-приложение** из LM Arena (перенос 1-в-1):
    React 19 + TypeScript + Vite + Tailwind 4 + **Three.js + react-force-graph-3d + d3-geo**.
    Настоящая 3D-сцена: сферы-узлы со свечением, торы-орбиты, тубы-связи, карта стран
    (d3-geo Mercator + world-atlas), режимы «граф/карта», маршруты, инспектор, лоадер,
    AI-ассистент (Gemini, без ключа graceful-null). Это собранный singlefile-бандл ~2.2 МБ.
    **Почему так:** ранний vanilla-порт (2D canvas) сильно упрощал оригинал — владелец
    потребовал точное 1-в-1; согласовано встроить оригинал как изолированный iframe-ассет.
  * **`_app/` — built-asset, исключён из статических валидаторов** (skipDirs/EXCLUDE_DIRS
    в validate.js, audit-pro.js, seo-audit.js, readable-audit.js, editorial-lint.js).
    НЕ редактировать бандл руками (кроме обязательных мета — см. README); пересобирать
    из исходников приложения.
  * **CSP бандла** (своя, в `_app/index.html`): Three.js требует `script-src 'unsafe-eval'
    blob:` и `worker-src blob:`; шрифты Inter/JetBrains — `style-src/font-src/connect-src`
    с `fonts.googleapis.com`/`fonts.gstatic.com`. Бандл несёт `robots=noindex` (индексируется
    только обёртка). Обёртка остаётся в строгой CSP сайта + `frame-src 'self'`.
  * **Регресс-защита:** `npm run konfessii:audit` (`scripts/konfessii-map-audit.js`,
    Playwright) — инварианты I1–I14 на desktop+mobile: обёртка (canonical/og/h1/JSON-LD/
    theme-color/CSP/iframe-src), бандл (singlefile/viewport/CSP/noindex/root), live
    (загрузка приложения в iframe, скрытие лоадера, **активация 3D WebGL-canvas**,
    0 pageerror, 0 overflow). I8–I13 защищают событийный data-driven Timeline,
    route-router, learning coach, article previews, BWA-статистику и кейсы гонений/самиздата;
    **I14** защищает smooth physics constants против возврата jitter/tension (`d3AlphaDecay .0165`,
    `d3VelocityDecay .24`, `warmupTicks 150`, `cooldownTicks 220`, `cooldownTime 7000`,
    anchor `*1.28`). Без браузера/WebGL — мягкий SKIP (exit 0). Прогонять после любой
    пересборки `_app`. Если падает — чинить страницу/пересобрать бандл, не упрощать тест.
  * **Сборка/пересборка:** инструкция в `_build-tools/konfessii-baptizm/README.md`
    (исходники приложения — отдельный Vite-проект у владельца; `base:'./'`,
    `vite-plugin-singlefile`, после сборки вернуть CSP/noindex/favicon в `<head>`).


### 9.25 Astro migration — premium visual parity only (2026-06-19)

Главная цель миграции: перейти на Astro **премиально, без заглушек и без потери визуала**. Подробный план: `docs/ASTRO-PREMIUM-MIGRATION-ROADMAP.md`.

Жёсткое правило владельца: H1/H2/SEO/word-count не считаются визуальным переносом. Если визуал сломан, страница получает 0% visual parity, даже если текст и мета совпали.

До production допускается только Astro-страница, которая прошла:

- desktop screenshot legacy vs Astro;
- mobile screenshot legacy vs Astro;
- route-specific DOM/CSS markers;
- отсутствие generic `astro-card`/`astro-page` вместо авторского layout;
- owner visual review первого экрана.

Нельзя повторять ошибку `shadow-pilot → production-dist` без визуального gate. Production остаётся legacy root, пока конкретный URL не доказал 95%+ визуального совпадения.

### 9.26 «Баптисты России» — long-term deepening pipeline (2026-06-19)

Серия будет постоянно пополняться research `.md`-файлами другими агентами. Нельзя относиться к текущим HTML как к финалу или закрывать задачу косметическими костылями.

Канонический roadmap:

- `data/baptisty-rossii-expansion-roadmap.json`
- `baptisty-rossii/research/31-editorial-expansion-roadmap-2026-06-19.md`
- `baptisty-rossii/research/media-ledger.md`

Guard:

- `npm run baptisty:roadmap:audit`

Правила:

- статьи серии должны углубляться по структуре, источникам, тексту, изображениям и связи с 3D-картой;
- реальные фото/портреты/факсимиле добавлять только после проверки прав;
- production не hotlink-ит чужие изображения;
- каждое изображение должно иметь запись в media ledger: source URL, лицензия, автор/архив, attribution, дата проверки;
- AI-картинку нельзя выдавать за историческое фото;
- visual polish серии не должен заменять работу по глубине текста.

### 9.27 «Баптисты России» — 2D SVG visual atlas (2026-06-19)

В серии могут появляться 2D SVG-схемы: маршруты, сети влияния, split-timeline, source-confidence matrix, publication-flow. Это не заменяет 3D-карту и не является декоративной заглушкой; это редакционный слой внутри статей.

Канонические файлы:

- `data/baptisty-rossii-visual-atlas.json`
- `baptisty-rossii/research/32-2d-svg-visual-atlas-plan-2026-06-19.md`

Guard:

- `npm run baptisty:visual-atlas:audit`

Правила:

- SVG локальный или inline; remote SVG/hotlink запрещён;
- внутри SVG не тянуть внешние raster images;
- обязательны title/desc или figure+figcaption;
- схема должна читаться на 375px;
- каждый узел связан с источником или source-confidence уровнем;
- если SVG повторяет узлы 3D-карты, обновлять mapSync;
- не рисовать псевдоточность для спорных данных.

### 9.28 `/about/` — first visual-first Astro migration route (2026-06-19)

`/about/` is the first route selected for near-100% visual parity migration. Current rule: Astro emits the legacy document directly from `about/index.html` (full-document shadow: legacy head + legacy body, no BaseLayout and no extra global Astro CSS) until a hand-built Astro version passes screenshot parity.

Guard:

- `npm run about:visual-parity:audit`
- `npm run astro:audit:about` (Node 22+ / CI)

Forbidden regressions for `/about/`:

- `class="astro-about"` generic article;
- `astro-contact-grid` generic contacts;
- `astro-accuracy-block` generic feedback card;
- adding BaseLayout generic header/footer around the legacy page;
- claiming visual parity from SEO/H1/H2 only.

Required legacy visual markers:

- `about-page`
- `about-contacts`
- `about-contact-card`
- `gb-accuracy-block`

### 9.29 Concurrent GitHub agents — sync protocol (2026-06-19)

Multiple agents may work on this repository at the same time. Before every edit/push:

1. `git fetch origin main` and `git pull --rebase origin main`.
2. If local mode-only changes appear after tooling (`100755 => 100644`), restore executable bits instead of committing chmod noise.
3. Never force-push to `main`.
4. Keep commits small and route-scoped.
5. Re-run route-specific guards for touched areas.
6. If another agent lands research files while you work, rebase and preserve their files; do not delete new research `.md`/raw-source files unless explicitly asked.
7. If a push is followed by an auto `update-meta/cache-bust [skip ci]` commit, pull again before the next change.

This matters especially for `/baptisty-rossii/research/**`, where other agents continuously add source dossiers.

### 9.30 `/articles/` — visual-first Astro migration route (2026-06-19)

`/articles/` must preserve the legacy premium catalog before any component refactor. The old generic Astro catalog (`astro-card`, `astro-card-grid`, manually recreated `const cards`) is forbidden because it produced a non-premium replacement instead of visual parity.

Guard:

- `npm run catalogs:visual-parity:audit`

Current rule: `src/pages/articles/index.astro` emits `articles/index.html` through `loadLegacyFullDocument('articles/index.html')` and keeps legacy markers:

- `articles-index-page`
- `home-v20`
- `h-hero-title`
- `h-article-card`

A hand-built Astro catalog is allowed only after desktop+mobile screenshot parity and owner approval.

### 9.31 `/biografii/` — visual-first Astro migration route (2026-06-19)

`/biografii/` follows the same practical rule as `/articles/`: protect the main legacy visual first, do not reintroduce generic `astro-card-grid` landings. Gill must remain visually strong as a series entry, not flattened into loose technical cards.

Guard:

- `npm run catalogs:visual-parity:audit`

Current rule: `src/pages/biografii/index.astro` emits `biografii/index.html` through `loadLegacyFullDocument('biografii/index.html')` and keeps legacy markers:

- `home-v20`
- `h-hero-title`
- `h-article-card`
- `Биографии служителей`
- `Джон Гилл`

A hand-built Astro biography catalog is allowed only after desktop+mobile screenshot parity and owner approval. Avoid accumulating throwaway generic code; once a shared visual migration guard covers a route, remove route-specific duplicate guards.

---

## Верификационная дисциплина (обновлено 2026-07-06) — читай перед правкой по чужому отчёту

Много агентов правят один source-репозиторий одновременно. Чтобы не плодить ложные
находки, ложные «fix» и рассинхрон матрицы — соблюдай:

1. **SHA-first.** Любой баг/исправление — с конкретным SHA. Перед правкой сверься с
   текущим `main`: описанное может быть уже закрыто (история рассинхрона реальна —
   `AUDIT_HISTORY.md` фиксирует 7 «race», 7 «conflict», 12 «duplicate»).
2. **Не «исправляй» уже исправленное.** Пример: `deploy.yml` шаг
   `Gill pre-v16 submenu regression audit` уже имеет по одному `run:` на шаг (исправлено
   `8a8211ea`). Не добавляй «fix duplicate run key» поверх — это churn.
3. **Никаких false-green.** Не пиши «all green» / «fixed» без удалённого CI-прогона или
   browser-доказательства. Если матрица говорит «P0/P1 closed» — это верно, пока
   `reverify/` не докажет обратное. Не вводи фальшивые «correction banner».
4. **Каноническая матрица — в AuditRepo** (`FedorMilovanov/AuditRepo`,
   `verified/MASTER_BUG_MATRIX.md` (проект `gb-is-my-strength`), см. `START_HERE.md` там).
   Архивные копии матриц в `archive/` — история, не текущая правда.
5. **Lane-дисциплина.** Тяжёлые правки (особенно фронтенд/Gill) делай в ветке
   `lane/*` или `agent/*`; в `main` они триггерят деплой. Не деплой непроверенный контент.
6. **IndexNow/деплой.** `baptisty-rossii/**` теперь покрыт path-фильтрами `deploy.yml` и
   `indexnow.yml`. `deploy.yml` НЕ деплоит, если IndexNow упал (нет `== 'failure'` клаузы) —
   не добавляй её обратно.
7. **Gill submenu-аудит теперь строгий:** отвергает дубликаты href/label, делает полный
   перебор по всем пунктам и проверяет геометрию рамки. Если он падает — это настоящий
   дефект, а не шум.
8. **Канон системного бэклога (2026-07-06):** AuditRepo (проект `gb-is-my-strength`) →
   `verified/SUPER_AUDIT_2026-07-06_14a49be8.md` — единый
   верифицированный аудит (CI/даты/SW/security/Bible/семантика) + план волн W0–W10 и
   список ОПРОВЕРГНУТЫХ старых формулировок (§1). Не воспроизводи опровергнутое.
9. **Три идентичности релиза.** Различай FUNCTIONAL_SHA / BOT_SHA (`[skip ci]`
   auto-meta) / DEPLOYED_SHA. `[skip ci]`-HEAD не считается проверенным сам по себе;
   зелёный шаг IndexNow — не доказательство (в workflow `continue-on-error` + `|| true`).
10. **Паритет ≠ правда.** Байтовый паритет Astro↔legacy не доказывает фактическую
    правду контента (квизы/числа/цитаты). Семантических гейтов пока НЕТ — не закрывай
    контентные классы «паритетом» (см. SUPER_AUDIT, волна W7 и `docs/CONTENT-QUALITY-STANDARD.md`).
11. **In-flight зоны владельца:** PremiumControls/Gill-визуал (§3.10 freeze) и
    глоссарий/Библия-тултипы (данные обновляет владелец). Не менять без явного запроса;
    инфраструктурные фиксы вокруг них (санитайзер, версия кэша данных, Bible-корпус)
    координируй с этими треками.
12. **Owner-инварианты собраны в `docs/OWNER-INVARIANTS.md`** — короткий канонический
    список; при конфликте докам этого файла и AGENTS §9 верить им, не пересказам.
