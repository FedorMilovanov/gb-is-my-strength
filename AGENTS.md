# AGENTS.md — gb-is-my-strength (gospod-bog.ru)

> **Этот файл — договор между владельцем (Фёдор Милованов) и любым ИИ-агентом.**
> Перед правкой прочитай этот pre-flight и разделы, относящиеся к затронутой поверхности.
> Полное перечитывание исторического changelog и несвязанных разделов для каждой задачи не требуется.

---

## 🚦 Перед работой — короткий pre-flight

Канонический операционный вход — `docs/WORK_MODES.md`. При расхождении старой
формулировки с более новым owner-approved контрактом действует текущий контракт и
текущий `main`.

Перед mutation:

1. Проверь текущую инструкцию владельца, `main`, rollback SHA и только те открытые
   PR/ветки, которые могут пересекаться с планируемыми файлами или поверхностью.
2. Выбери `FAST`, `LANE` или `SYSTEM` по `docs/WORK_MODES.md`.
3. Найди текущий source of truth и прочитай в этом файле только TLDR и разделы,
   управляющие затронутой архитектурой, контентом или данными.
4. Подключай дополнительные документы условно:
   - `docs/LANE_LOCK_POLICY.md` — параллельные агенты, shared surface или overlap;
   - `docs/OWNER-INVARIANTS.md` — owner-sensitive контент, данные или UI;
   - `docs/GIT_WORKTREE_POLICY.md` — worktree/checkpoint mechanics;
   - `docs/BRANCH_LIFECYCLE_V4.md` — recovery, successor или cleanup;
   - `audit/external-checks/README.md` — только когда меняется или запускается внешний check.
5. Проверяй версии, сеть, CPU/RAM/диск и Playwright только когда выбранные команды
   действительно зависят от этих возможностей. Для wording-only FAST полный env audit не нужен.

Для route/registry-задачи первичны `migration/page-ownership.json` и соответствующий
`data/route-profiles/*.json`; `migration/route-migration-matrix.json` производный и
не редактируется вручную для добавления или переопределения route.

### Минимальная декларация lane

```md
Mode: FAST | LANE | SYSTEM
Lane / owner:
Purpose and bounded scope:
Base / rollback SHA:
Allowed files or surfaces:
Adjacent active work / overlap:
Source of truth:
Required checks:
```

Статус, handoff, recovery, successor и production witness добавляются только когда
применимы. GitHub уже хранит commits, diff, checks и текущий head SHA.

### Три уровня доказательства

1. **Iteration evidence** — только проверки, которые непосредственно покрывают diff.
2. **Exact-head PR evidence** — обязательные checks на финальном SHA PR.
3. **Production witness** — отдельное подтверждение deploy/live SHA только когда
   заявляется состояние продакшена.

Для docs-only SYSTEM PR полный production build не нужен, если diff не влияет на
runtime/build. Нужны reference integrity и exact-head Shared Files Guard.

---

| **AGENTS-r325** | 2026-07-28 | **Governance v4.3 polish (#487).** Blanket full-file/full-environment pre-flight заменён коротким условным входом; универсальные наборы checks уступили proportionate verification; intake/report helpers упрощены без ослабления active-branch protection. |
| **AGENTS-r324** | 2026-07-24 | **Owner governance reconciliation (#219).** Установлен единый контракт FAST/LANE/SYSTEM с обязательными branch+PR, live GitHub ownership discovery, первичностью `page-ownership` + route profiles над производной route matrix, live-discovery среды, checksum-verified actionlint и разделением iteration / exact-head CI / production witness. Исторические sandbox-снимки и pre-v16 UI-детали больше не трактуются как универсальная текущая архитектура; owner-sensitive защиты и data hard-lock сохранены. |

| **AGENTS-r323** | 2026-07-09 | **Derived route-registry stack merged + doc drift fixed.** Влиты 3 системных лейна (`native-source-contract-v1` + `route-registry-validators-v2` + `editorial-metadata-v3`): `route-migration-matrix.json` теперь **материализуется** из `page-ownership.json` + `route-profiles/*` (движок `scripts/lib/effective-route-registry.js`); режимы свёрнуты 8→3 (`strict-native`/`strict-native-app`/`legacy-shadow-app`); registry-driven чекеры заменили прямые (оригиналы → `scripts/legacy-audits/*`); добавлен editorial-freeze baseline `data/editorial-metadata.json`. Закрывает **AUDIT-P2-MATRIX-DRIFT**. Doc-drift из r322 исправлен: JS-файлов **14** (11 базовых + 3 vosk-TTS), не 11/12; §0/§2 синхронизированы. `izbrannoe`/`BaseLayout` рантайм переведён на нативные `<script>` (strict-native clean, мёртвые `headHtml`/`bodyEndHtml` пропсы удалены). См. блок «Матрица теперь ПРОИЗВОДНАЯ» в Work Modes. |
| **AGENTS-r322** | 2026-07-06 | **Super-audit sync.** «Верификационная дисциплина» дополнена п.8–12: канон системного бэклога — AuditRepo `verified/SUPER_AUDIT_2026-07-06_14a49be8.md` (волны W0–W10 + опровергнутые формулировки); три идентичности релиза (FUNCTIONAL/BOT/DEPLOYED SHA); «паритет ≠ правда»; in-flight зоны (PremiumControls, глоссарий); создан `docs/OWNER-INVARIANTS.md`. Известный doc-drift для будущей правки: §0/§2 расходятся «11 vs 12 JS-файлов» (факт на 14a49be8: 11); README §1.1 shadow-wrap описание — HISTORICAL (см. page-ownership.json). |
| **AGENTS-r321** | 2026-07-03 | **CSS inventory reconciled.** Section 2 updated from 8→9 CSS files (added `enhancements-runtime.css`, `highlights-runtime.css`, `sw-toast.css` extracted from CSS-in-JS in Pass 24). Dead exports removed from `floating-cluster-ui.ts` (5 dead: `FloatingClusterMode`, `FloatingClusterUiConfig`, `floatingClusterUi`, `floatingClusterRoutes`, `getSeriesParts`). §0 and §4 CSS table updated (renumbered from r312 — was duplicate of r312). |

---

## Work Modes — единый операционный контракт

Режимы, минимальная декларация, proportionate verification и merge barrier определены
в [docs/WORK_MODES.md](docs/WORK_MODES.md). Не поддерживай здесь вторую копию таблиц
и command bundles: она неизбежно дрейфует.

- Все обычные изменения идут через branch + PR; direct `main` — только явный emergency.
- Один independently mergeable lane имеет одного owner, одну branch и один PR.
- Route authority, проверки и production witness выбираются по затронутой поверхности.
- Cleanup и recovery выполняются только по `docs/BRANCH_LIFECYCLE_V4.md`.

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
13. ✅ **Перед merge** → запусти только проверки, применимые к diff по `docs/WORK_MODES.md`. `validate:all` и `audit-pro.js` обязательны для затрагивающих их production/content/runtime поверхностей, но не для несвязанного docs-only FAST/SYSTEM diff.
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
|---|---|
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
├── robots.txt, sitemap.xml, feed.xml
│
├── css/                            ← ровно 9 файлов + 1 шрифтовой
│   ├── site.css                    ← ВСЯ глобальная визуальная система (tokens, components, responsive)
│   ├── enhancements.css            ← progressive enhancements
│   ├── enhancements-runtime.css    ← shared enhancements runtime (extracted from JS)
│   ├── highlights-runtime.css      ← article highlights runtime (extracted from JS)
│   ├── book.css                    ← движок книги
│   ├── series.css                  ← страницы серий
│   ├── notes.css                   ← сноски/примечания
│   ├── sw-toast.css                ← service-worker update toast (extracted from JS)
│   ├── map.css                     ← карта проекта
│   └── fonts.css                   ← шрифты @font-face
│
├── js/                             ← ровно 14 файлов (11 базовых + 3 vosk-TTS)
│   ├── site-utils.js               ← shared helpers
│   ├── bible-data.js               ← библейские данные
│   ├── bible-refs.js               ← парсинг ссылок
│   ├── glosses.js                  ← глоссарий
│   ├── footnotes.js                ← сноски
│   ├── reader.js                   ← ридер
│   ├── highlighter.js              ← выделение текста
│   ├── quiz.js                     ← quiz engine
│   ├── series.js                   ← series runtime
│   ├── site.js                     ← global UI runtime (27 модулей)
│   ├── map.js                      ← карта проекта
│   ├── vosk-tts-engine.js          ← Vosk TTS orchestration
│   ├── vosk-tts-core.js            ← Vosk TTS core
│   └── vosk-stress-lookup.js       ← Vosk stress dictionary lookup
│
├── assets/
│   ├── fonts/                      ← локальные woff2
│   ├── audio/
│   └── video/
│
├── images/                         ← общие изображения
├── og/                             ← OG-картинки 1200×630
│
├── articles/                       ← статичные статьи (legacy/source)
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
│   ├── audit-pro.js                ← главный аудит затрагиваемых production/content поверхностей
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
├── docs/                           ← документация
└── .github/workflows/              ← CI/CD
```

### 2.1 CSS-файлы — РОВНО 9 + fonts.css

**Запрещено создавать новые CSS-файлы.** Используй существующие:

| Файл | Назначение |
|---|---|
| `site.css` | Глобальная визуальная система, компоненты, tokens, responsive |
| `enhancements.css` | Progressive enhancements, decorative |
| `enhancements-runtime.css` | Shared enhancements runtime styles, extracted from JS |
| `highlights-runtime.css` | Article highlights runtime styles, extracted from JS |
| `book.css` | Книга/ридер |
| `series.css` | Страницы серий |
| `notes.css` | Сноски |
| `sw-toast.css` | Service worker update toast styles, extracted from JS |
| `map.css` | Карта |
| `fonts.css` | @font-face only |

> Если нужен стиль для нового компонента — добавь в `site.css` в соответствующий `@layer`.

### 2.2 JS-файлы — РОВНО 14

**Запрещено создавать новые JS-файлы.** Используй существующие. Для модуля — добавь функцию/объект в подходящий файл.

### 2.3 HTML-страницы

- Каждая статья — `articles/<slug>/index.html`
- Серии — `nagornaya/`, `pastor-series/`, `dark-side/`
- **НЕ создавать страницы в корне**, кроме согласованных системных (`404.html`)
- Все новые страницы: обязательные `<meta>` + `SITE_CONFIG` + canonical + OG

### 2.4 Source-of-truth (ОБЯЗАТЕЛЬНО)

После Astro production cutover любой route имеет **ровно один primary production source**. Этот источник фиксируется в `migration/page-ownership.json` и компилируется в `migration/route-migration-matrix.json`.

**Запрещено:**

- одновременно считать `src/pages/**` и root/legacy HTML равноправными production-source для одного route;
- добавлять `.github/workflows/**`, которые materialize/patch runtime source перед deploy;
- держать legacy source «на всякий случай» как неявный fallback без явного статуса в ownership/matrix;
- делать root-шаблон source-of-truth только потому, что он старше Astro-route.

**Разрешено:**

- legacy source как rollback/reference слой, если это явно указано в ownership/matrix;
- build-time projection в `dist/` из primary source;
- controlled generator для derived registry/artifact, если output помечен как derived и проверяется guard-ом;
- отдельный SYSTEM-PR для смены ownership одного route.

### 2.5 Protected root/source zones

Следующие пути изменяются только в SYSTEM lane с отдельным PR, explicit ownership и exact-head проверкой:

```text
AGENTS.md
README.md
package.json
package-lock.json
.github/workflows/**
migration/**
data/series.json
data/search-manifest.json
data/public-content-baseline.json
src/layouts/**
css/**
js/**
sw.js
karty/_engine/**
```

---

## 3. Контент-правила

### 3.1 Byline — КРИТИЧНО

**Владелец — редактор/автор-редактор, НЕ «автор».**

Допустимо:

```html
Автор-редактор: Фёдор Милованов
```

или для переводов:

```html
Редактор: Фёдор Милованов
```

Запрещено:

```html
Автор: Фёдор Милованов
```

### 3.2 AI-disclosure — ЗАПРЕЩЕНО

**Не возвращать** блоки/текст вида:

```text
Этот материал создан/подготовлен с помощью ИИ
AI-generated content
С использованием искусственного интеллекта
```

ИИ описывается только на `/about/`.

### 3.3 Author-card — ОБЯЗАТЕЛЬНА

Каждая статья/биография должна иметь `<aside class="author-card">` перед блоком источников/дальнейшего чтения.

### 3.4 Заголовок статьи — ОБЯЗАТЕЛЕН

Не удалять `<header class="article-header">`. Структура:

```html
<header class="article-header">
  <h1>Заголовок</h1>
  <p class="article-meta">...</p>
</header>
```

### 3.5 English quote policy — русский читательский текст

- В русской статье читательский текст, прямые речи, сильные фразы и цитируемые мысли автора должны быть на русском.
- Английскими могут оставаться: названия книг/статей, URL/DOI, библиографические данные, короткие термины/названия технологий и кодовые фрагменты.
- Прямая английская цитата в теле русской статьи запрещена; вместо неё дать русский перевод и рядом ссылку на оригинальный источник.
- Не использовать английскую цитату в UI/quiz-feedback, если у неё есть естественный русский эквивалент.
- Полный контракт: [`docs/EDITORIAL-SOURCE-POLICY.md`](docs/EDITORIAL-SOURCE-POLICY.md).

---

## 4. CSS-правила

### 4.1 Design tokens — ВСЕГДА

Цвета, отступы, радиусы — только через токены в `:root`:

```css
:root {
  --bg: #050505;
  --surface: #0d0d0d;
  --text: #f2efe8;
  --muted: #9a968e;
  --accent: #d4af37;
  --accent-2: #2ed8ff;
  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 22px;
}
```

**Не хардкодить** `#d4af37` и т.п. внутри компонентов — используй `var(--accent)`.

### 4.2 `!important` — ТОЛЬКО С ОБОСНОВАНИЕМ

**Перед добавлением нового `!important`:**

1. Найди конкурирующее правило (`rg 'selector' css/`).
2. Проверь порядок `@layer` — `@layer utilities` побеждает `@layer components`.
3. Попробуй переместить правило в правильный слой.
4. Попробуй увеличить специфичность без ID.
5. Только если 1–4 не помогли — добавь `!important` с комментарием `/* why */`.

**Строгий лимит:** не больше **50 `!important` на файл**. Проверка `npm run validate:all` падает при превышении.

### 4.3 Мобильная адаптация — ОБЯЗАТЕЛЬНА

Каждый новый компонент должен иметь стили для:

```css
@media (max-width: 768px) { /* tablet */ }
@media (max-width: 480px) { /* phone */ }
```

### 4.4 Не создавать новые файлы

Добавляй стили в подходящий `@layer` внутри существующего `site.css` или тематического файла.

### 4.5 Anti-CSS-in-JS — НИКАКИХ `style.textContent`

**Запрещено** добавлять runtime-стили из JavaScript через `style.textContent`, `innerHTML`, `insertAdjacentHTML`, шаблонные строки `<style>…</style>` или создание `<style>`-узлов (`document.createElement('style')`). Любые новые селекторы/классы должны жить только в канонических CSS-файлах из §2.1. JS имеет право **только переключать уже существующие классы/атрибуты**.

> Исключение: уже существующий `site.js` модуль `30` (`mountCacheBustControlPlane`) генерирует только internal admin overlay styles; это не reader-facing runtime и не расширяется без отдельного owner-approved SYSTEM lane.

### 4.6 Anti-fragmented-CSS — не создавать мелкие файлы

Новые runtime-компоненты используют существующий `site.css` или один из тематических файлов. Никаких `component-name.css`, `widget.css`, `temp-fix.css` и т.п.

### 4.7 Shared route CSS contract

Любой CSS-фикс, который затрагивает несколько routes, обязан:

- иметь один канонический селектор/класс, а не копии на каждой странице;
- иметь минимальный browser/visual contract на представительных routes;
- не расширять scope до unrelated routes;
- не ломать owner-sensitive вид/иерархию.

### 4.8 Current CSS inventory

| Файл | `!important` | Статус |
|---|---:|---|
| `site.css` | **202** ⚠️ | цель ≤200; потолок `IMPORTANT_CEIL` в audit-pro (только вниз) |
| `enhancements.css` | 0 | ✅ |
| `enhancements-runtime.css` | 0 | ✅ |
| `highlights-runtime.css` | 0 | ✅ |
| `book.css` | 0 | ✅ |
| `series.css` | 0 | ✅ |
| `notes.css` | 0 | ✅ |
| `sw-toast.css` | 0 | ✅ |
| `map.css` | 0 | ✅ |
| `fonts.css` | 0 | ✅ |

> Не «нормализовать» inventory массово. Снижение `!important` — отдельные маленькие lanes с visual evidence.

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

### 5.3 Проверки для JS/CSS-изменений

Выбирай проверки по реально затронутой поверхности:

```bash
# Синтаксис изменённых JS-файлов
node --check <changed-js-files>

# После CSS/JS — обновить и проверить asset revisions
npm run cache-bust

# Когда diff влияет на shared/runtime/content publication
npm run validate:all
npm run tokens:check        # если затронуты design tokens/CSS
node scripts/audit-pro.js   # если затронуты покрываемые аудитом поверхности
```

Не запускай все 14 JS-файлов, полный publication audit и design-token check для
несвязанной документационной правки. Применимый FAIL блокирует merge, а не создание
recoverable checkpoint.

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
  explanation: 'Почему ответ верный',
  sourceRef: 'Источник / раздел'
}
```

`sourceRef` показывается в `#quizSourceRef` после ответа.

### 6.6 Footnotes / source tooltips — structural safety

- `.fn-marker` and `.tooltip` must remain flat siblings in the source contract; nested marker/tooltip structures are prohibited.
- Не переносить body-параграфы внутрь `.tooltip` во время массовой обработки MDX/HTML.
- После массовой правки footnotes прогнать structural audit + representative browser hover/tap.

### 6.7 Russian reader-language contract

Русскоязычная статья должна читаться как цельный русский текст. Это правило закреплено не только документально, но и технически: `scripts/validate.js` и `scripts/audit-pro.js` блокируют английские прямые цитаты в читательском русском тексте и quiz-строках. Полная редакционно-источниковая политика — `docs/EDITORIAL-SOURCE-POLICY.md`.

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

### 7.1 Мусорные root-файлы

**Запрещены:**

```
*.patch
*.diff
one-off-*.py
temp-*.tsx
fix-*.js
```

Временные файлы — в системный tmp, не в репо.

### 7.2 Дублированные мета-теги

Проверяй:

```bash
rg '<meta property="og:' -n articles/<slug>/index.html
```

Каждый property — ровно 1 раз.

### 7.3 Дублированный runtime

Нельзя подключать `site.js` дважды или добавлять локальные копии глобальных обработчиков.

### 7.4 Потеря заголовка/author-card

После любой массовой правки HTML:

```bash
rg 'article-header' articles/ | wc -l
rg 'author-card' articles/ | wc -l
```

Сравни с количеством статей.

### 7.5 Broken `SITE_CONFIG`

JSON внутри `<script>` должен быть валидным. Не оставлять trailing comma.

### 7.6 Mixed content

- ❌ Не добавлять `http://` ссылки в контент — `audit-pro` ругается на mixed-content. Используй `https://` или (для умерших источников) `https://web.archive.org/web/2025/http://...`.

### 7.7 Accessibility regressions

- Не убирать `aria-label` с icon-only кнопок.
- Не использовать `<div onclick>` вместо `<button>`.
- Focus ring должен быть видимым.
- `prefers-reduced-motion` обязателен для анимаций.

---

## 8. Git / workflow

### 8.1 Ветки и PR

- Branch naming: `lane/<scope>-YYYY-MM-DD`, `agent/<bounded-lane>`, `hotfix/<bounded-lane>`.
- Один independently mergeable lane — один owner, одна canonical branch и один PR.
- Не создавать empty remote branch до первого meaningful checkpoint.
- Draft PR открывается после первого meaningful push.
- Checkpoints event-driven, не по таймеру.
- Не force-push/close/delete чужие active branches.
- Direct `main` — только owner-approved emergency с rollback SHA.

### 8.2 Commit messages

Conventional commits:

```
feat(scope): description
fix(scope): description
docs(scope): description
refactor(scope): description
test(scope): description
chore(scope): description
```

### 8.3 Перед merge

- exact-head checks соответствуют diff;
- review threads обработаны;
- временные workflow/writer/patcher, введённые lane, удалены;
- production status не выводится только из source merge.

### 8.4 Branch cleanup

Следовать `docs/BRANCH_LIFECYCLE_V4.md`. Возраст, имя или closed PR сами по себе не разрешают delete.

---

## 9. Специальные контракты

### 9.1 Home ambient phrases

Главная использует ambient phrases. `ambientPhrases === 0` — CRITICAL regression.

### 9.2 Floating controls

Canonical floating controls: `#gbFloatingControls`, `.gb-fc-theme`, `.gb-fc-search`.

### 9.3 Gill Part I cover

Current marker: `.bio-cover` / GBS2 cover/header. Не возвращать старый `biography-portrait`.

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

Для изменений главной, Gill-карточек или связанных runtime-контрактов: `npm run validate:all && node scripts/audit-pro.js`

### 9.7 Theme-toggle / search-icon — ЧИСТЫЙ SVG БЕЗ РАМОК

**Никогда не добавлять** `background`, `border`, `border-radius`, `box-shadow`, `backdrop-filter` к иконкам переключения темы и поиска. Это:

- `.theme-toggle` (absolute, в статьях)
- `.gb-fc-theme`, `.gb-fc-search` (FAB, `js/site.js` модуль 29)
- `.h-cp-btn`, `.gb-nav-search-icon` (в шапке home)
- `.bar-icon-btn` (bottom-bar, mobile)

Должно быть: **только сам SVG** (stroke=currentColor), `background:transparent`, `border:none`, никаких pill/circle обводок. Hover-эффект только `transform:translateY(-2px) scale(1.08)` + изменение `color`, без opacity-флипа (иначе оба `.icon-sun` и `.icon-moon` могут показаться одновременно — баг от 2026-06-08).

**Search keyboard contract:** `Ctrl/⌘+F` — всегда нативный поиск браузера; сайт не должен делать `preventDefault()` и не должен открывать command palette. Command Palette открывается только `Ctrl/⌘+K` (case-insensitive: Chromium/Playwright может дать `key="K"`). `Escape` внутри palette должен закрывать palette, а не только чистить строку. Это защищено `audit-pro` G112 и `npm run interactive-audit`.

### 9.8 Owner-sensitive typography

Не менять core typography scale, article width, heading hierarchy и signature decorative treatment без owner decision.

---

## 10. Data contracts

### 10.1 `data/series.json`

- unique `id`, `slug`, `order`;
- no dangling route;
- series config соответствует engine guide.

### 10.2 `data/search-manifest.json`

- route exists;
- title/description актуальны;
- no duplicate URL.

### 10.3 Route registries

- primary: `migration/page-ownership.json` + `data/route-profiles/*.json`;
- derived: `migration/route-migration-matrix.json`;
- не редактировать derived matrix вручную.

### 10.4 Protected baseline data

`data/public-content-baseline.json` и owner-sensitive registries меняются только с explicit SYSTEM scope.

---

## 11. Доступность / UI contracts

### 11.1 Buttons

- icon-only button: `aria-label` обязателен;
- touch target ≥44×44;
- keyboard activation;
- visible focus.

### 11.2 Modals / sheets

- focus trap;
- Escape closes;
- backdrop click contract;
- body scroll restored;
- no nested interactive controls.

### 11.3 Reduced motion

Все non-essential animations должны выключаться/сокращаться через `prefers-reduced-motion`.

---

## 12. Protected engines / subsystems

### 12.1 Series engine

Перед изменением серии прочитать `docs/SERIES-ENGINE-GUIDE.md`. Не копировать движок по routes.

### 12.2 Book engine

Изменения `book.css`, reader runtime и book registry — отдельный LANE/SYSTEM с representative browser contracts.

### 12.3 Overlay / tooltip / footnote

- flat DOM;
- no nested `.tooltip` / `.fn-marker`;
- representative hover/tap tests;
- owner-sensitive visual behavior preserved.

### 12.4 MapEngine

Перед изменением `karty/_engine/**`, `map.js`, `map.css` или map routes прочитать MapEngine-специфичные разделы/README и проверить representative map routes. Не применять generic route assumptions к движку карты.

### 12.5 MapEngine — архитектура движка (КРИТИЧНО: читать перед любой правкой)

MapEngine — shared subsystem. Перед его mutation:

1. inspect active map/Atlas PRs;
2. read current engine source + local README/spec;
3. declare route/file boundary;
4. run map contracts + representative browser checks;
5. do not mix engine changes with unrelated content.

#### ⚠️ HAZARD: ДВОЙНОЙ ПУТЬ РЕНДЕРИНГА (читать перед любой правкой движка)

Если route имеет legacy и native representation, primary source определяется только ownership registry. Нельзя чинить обе копии «для надёжности» без explicit migration scope.

---

## 13. Editorial / source integrity

### 13.1 Source claims

- factual claim должен иметь current source;
- source must support exact wording;
- quote language follows §3.5;
- do not inflate certainty.

### 13.2 Footnote structure

- source markers map to valid bibliography/source entries;
- flat DOM;
- no body text swallowed into tooltip;
- mass footnote changes require structural + browser evidence.

### 13.3 Russian quote policy

Russian-facing quote/quiz text must be Russian; original-language titles/terms/bibliography are allowed where natural.

---

## 14. Temporary files / generated output

Do not commit:

```text
dist/
reports/
pagefind/
shots/
*.patch
*.diff
one-off scripts in root
```

Если AI-агент создал такой файл во время работы — обязан удалить перед коммитом.

Generated registries are updated only through their canonical generator and verified diff.

---

## 15. Deployment truth

- source SHA, candidate artifact SHA and deployed/live witness are distinct identities;
- green PR ≠ production;
- source merge ≠ live bytes;
- exact production claims require deploy/live evidence;
- no temporary deploy patcher/materializer survives final tree.

---

## 16. Definition of done

A lane is done when:

- diff matches scope;
- exact-head applicable checks pass;
- active adjacent branches were not modified;
- review threads are handled;
- temporary automation introduced by lane is removed;
- recovery/cleanup disposition recorded if applicable;
- production witness recorded only if claimed.

---

## 17. Historical notes

Historical rows, old environment snapshots, closed PR descriptions and previous lane reports are evidence, not current operational authority. Use them only after current owner instruction, current `main`, current source registries and open PRs.
