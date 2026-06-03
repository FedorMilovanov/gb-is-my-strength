# Audit Cleanup Plan — 2026-06-04

> **Цель:** Профессиональная глубокая чистка CSS и JS без потери функционала и визуала.
> Качество и визуальная целостность — приоритет №1. Размер — приятный побочный эффект.
>
> **Автор плана:** Arena Agent (по запросу владельца Фёдора Милованова).
> **Контракт для следующих агентов:** этот файл — единый источник правды для волны чистки. Каждый коммит должен ссылаться на пункт из таблицы ниже (`PLAN-04` § N).
>
> **НЕ путать с бюджетами** из `scripts/audit-pro.js` (375K CSS / 365K JS). Бюджеты — следствие, а не цель. Если после грамотной чистки качество выше, а размер всё ещё больше бюджета — это нормально. **Не повышать бюджеты ради зелёного PASS.** Только если измеренная чистая база реально требует — пересмотрим в самом конце.

---

## 0. Текущее состояние (baseline, 2026-06-04)

> **ВАЖНО — fix baseline:** в v1 этого файла цифры `!important` были занижены
> (использовался `grep -c` — считает строки, а не вхождения). Корректный счёт
> через `grep -o '!important' file | wc -l`. AGENTS-r42 цитирует именно такой
> счёт; AUDIT_HISTORY также. Пересчитано:

| Файл | Размер | `!important` (true) | Заметки |
|------|--------|--------------------:|---------|
| `css/site.css` | ~267 KB | **342** | Лимит AGENTS-r42: ≤200. **Регрессия +142.** |
| `css/home.css` | 49 944 b | 20 | OK |
| `css/command-palette.css` | 38 132 b | 7 | OK |
| `css/mobile-hotfix.css` | 12 220 b | 74 | По дизайну (touch-overrides) — большая часть легитимна |
| `css/nagornaya-mobile-toc.css` | 22 957 b | 122 | Tailwind override — легитимно |
| **CSS итого** | **432 851 b** (gzip 84 K) | **565** | Audit-pro warning: > 375 K |
| `js/site.js` | 236 231 b (5121 строк) | — | Один монолит 27 модулей |
| `js/search.js` | 72 269 b | — | |
| `js/enhancements.js` | 35 799 b | — | |
| **JS итого** | **452 107 b** (gzip 112 K) | — | Audit-pro warning: > 365 K |
| `audit-pro` | ✅ PASSED 29 / 2 warn / 0 err | — | Warning: только бюджеты |
| `validate:all`, `tokens:check` | ✅ PASS | — | |

### Дублирующиеся top-level селекторы в `site.css` (11 групп)
`.reveal` ×3, `article p` ×2, `blockquote` ×2, `.section-title::after` ×2,
`.card.fx-lift` ×2, `.bottom-bar` ×2, `#back-to-top svg` ×2,
`.heading-anchor` ×2, `.related-articles__list` ×2, `[data-series-cards] .series-card` ×2,
`.summary-card__item:hover` ×2.

### `!important` per-media в `site.css` — топ источников
| `!important` | `@media` |
|-:|---|
| 50 | `(max-width: 640px)` |
| 45 | `(pointer: coarse)` |
| 44 | `(max-width: 768px)` |
| 41 | `(prefers-reduced-motion: reduce)` *(легитимно)* |
| 23 | `(max-width: 380px)` |
| 21 | `(hover: none), (max-width: 640px)` |
| 17 | `(max-width: 600px)` |
| 16 | `(forced-colors: active)` *(легитимно)* |
| 15 | `@media print` *(легитимно)* |
| 14 | `(hover: hover) and (pointer: fine)` |

**Легитимные категории (≈ 72 шт.)** — `print`, `prefers-reduced-motion`, `forced-colors`, Tailwind-override в `nagornaya-mobile-toc.css`. Их **не трогаем**.

**Кандидаты на чистку (≈ 250+ шт.)** — мобильные оверрайды, hover-guards, повторные правила.

---

## 1. Стратегия

### 1.1 Принципы

1. **Сначала измерь, потом режь.** Перед каждой партией — снимок `!important`-числа и веса. После — diff и визуальный аудит.
2. **Один коммит — одна тема.** Не смешивать «дубли селекторов» с «удалением !important».
3. **Визуальный аудит обязателен** после каждой партии: `npm run visual-audit` (96 скринов). Если хоть один регресс — откат.
4. **Каскад > !important.** Поднимай специфичность через id/cascade-layer, не через `!important`.
5. **CSS-переменные.** Не оставлять «мёртвых» переменных в `:root`, но и не агрессивно сжимать живые.
6. **Никаких новых файлов** CSS/JS. Это контракт AGENTS.md §2.
7. **Совместимость браузеров** — AGENTS.md §1.1: Chrome/Edge 90+, Safari 15+. Никакого CSS, который их ломает.
8. **Атрибуция и текст** — не трогаем (AGENTS.md §3.1).

### 1.2 Что НЕ делаем (контракт)

- ❌ Не понижаем бюджет аудита ради «зелёного PASS».
- ❌ Не сливаем `mobile-hotfix.css` в `site.css` — это вынесено намеренно (см. AGENTS.md §2).
- ❌ Не переписываем `nagornaya/tw.min.css` (Tailwind, не наш).
- ❌ Не вводим Sass/PostCSS/bundler.
- ❌ Не разделяем `site.js` на новые файлы (контракт «ровно 11 JS»).
- ❌ Не запускаем `prettier --write .` и `eslint --fix` по всему.

### 1.3 Что делаем

| Партия | Тема | Файлы | Ожидаемый эффект |
|---|---|---|---|
| **P1** | Дубль-селекторы в `site.css` (11 групп) | `css/site.css` | Слить → ~−200 b, читабельность ↑↑ |
| **P2** | `!important` в `@media (hover: hover) and (pointer: fine)` (14 шт) | `css/site.css` | Уже под guard → почти все можно снять |
| **P3** | `!important` в `@media (max-width: 640px)` (50 шт) — аудит каждого | `css/site.css` | Снять там, где нет реального конкурента; повысить специфичность через `body.X` |
| **P4** | `!important` в `@media (max-width: 768px)` (44 шт) | `css/site.css` | Аналогично P3 |
| **P5** | `!important` в `@media (pointer: coarse)` (45 шт) | `css/site.css` | Многие — touch-overrides без конкурента |
| **P6** | `!important` в `@media (max-width: 380px)` (23 шт) | `css/site.css` | Узкая ниша, обычно нет конкурента |
| **P7** | `!important` в `@media (hover: none), (max-width: 640px)` (21 шт) + `(max-width: 600px)` (17 шт) | `css/site.css` | Аналогично |
| **P8** | Мёртвые CSS-переменные в `:root` (если найдутся после P1-P7) | `css/site.css` | |
| **P9** | `js/site.js`: разбор по модулям, чистка дубль-helper'ов, dead code | `js/site.js` | Цель: −5..−10 КБ без потери |
| **P10** | `js/enhancements.js`, `js/search.js`, `js/highlights.js`, `js/bookmark-engine.js` — точечная dead-code чистка | различные | По мере находок |
| **P11** | `css/home.css`, `css/command-palette.css` — точечная чистка | различные | Опционально, если осталось время |
| **P12** | `notify-on-failure.yml` workflow | `.github/workflows/` | Алерты на падение CI/деплоя |
| **P13** | Финальный отчёт + обновление `AGENTS.md` §4.2 актуальными цифрами | `AGENTS.md`, `AUDIT_HISTORY.md` | |

**Каждая партия = отдельный коммит** с тегом `PLAN-04 P<N>: <описание>`.

---

## 2. Метод аудита `!important` (одинаковый для P2–P7)

Для каждого `!important` в партии:

1. **Зачем он стоит?** Скачать историю строки: `git blame -L <line>,<line> css/site.css`.
2. **Есть ли конкурент?** В этом же файле и в других CSS — что перебивает это правило без `!important`?
   - Грубо: `grep -n "<property>" css/*.css | grep "<selector>"`
3. **Решение:**
   - **(a) Удалить `!important`.** Если нет конкурента в каскаде.
   - **(b) Поднять специфичность.** Добавить `body.X` / `html.dark` / `#id` к селектору.
   - **(c) Объединить с базовым правилом.** Если оверрайд на ту же ширину/брейкпойнт.
   - **(d) Оставить `!important`.** Если есть законный конкурент. Добавить **inline-комментарий**, ПОЧЕМУ.
4. **После каждой партии:**
   ```bash
   node --check js/*.js scripts/*.js sw.js
   npm run cache-bust
   npm run validate:all
   npm run tokens:check
   node scripts/audit-pro.js
   ```
5. **Перед каждым `git push`:** обязательно `node scripts/audit-pro.js` → PASSED (warnings про бюджет — допустимы пока).
6. **Раз в 2–3 партии:** `npm run visual-audit` (требует Playwright; запускать локально, не в CI этого чата).

---

## 3. Метод чистки `js/site.js`

> 5121 строка, один IIFE. Структура из 27 модулей описана в верхнем комментарии.

### 3.1 Что искать

1. **Дубль-helper'ы.** Часто `clamp`, `throttle`, `debounce`, `closest`, `on/off` пишут заново внутри модуля, хотя есть `SiteUtils`.
2. **Мёртвый код.** Удалённые фичи (например, AI-disclosure модуль удалён 2026-06-02), но остатки могут жить.
3. **Двойные `addEventListener`** без `removeEventListener` (AGENTS §5.2).
4. **`console.log` на проде.** Должны быть только под `debug: true`.
5. **Магические числа.** В `SITE_CONFIG` уже есть многое — выносить туда.

### 3.2 Что НЕ делаем

- ❌ Не выносим модули в новые файлы.
- ❌ Не меняем публичный API `SiteUtils`, `SiteShare`, `GBSearch` — статьи на это завязаны.
- ❌ Не «модернизируем» `var → let/const` ради эстетики. Только когда правим окружающий код.

---

## 4. Метод проверки перед коммитом

Жёсткий минимум (каждый коммит):

```bash
# Структурные проверки
node --check js/*.js scripts/*.js sw.js

# Хеши cache-bust
npm run cache-bust

# Дизайн-токены
npm run tokens:check

# Полная валидация
npm run validate:all

# Финальный аудит-про
node scripts/audit-pro.js
# Ожидаем: ✅ PASSED, errors=0
```

Если **`!important`-счётчик вырос** — коммит **запрещён**.

---

## 5. Чеклист «когда останавливаться»

Останавливаемся, если:
- `audit-pro` ушёл из PASSED.
- Появился console.error в `npm run visual-audit`.
- Любая страница визуально изменилась нежелательно (даже на 1 px в важном месте).
- Появилась регрессия в тёмной теме.

В этом случае: `git revert HEAD`, описание проблемы в этот файл, переход к следующему пункту партии.

---

## 6. Целевые числа после полной волны чистки (ориентиры, не догма)

| Метрика | Сейчас | Цель |
|---|-:|-:|
| `site.css` !important | 323 | ≤ 200 (AGENTS §4.2 контракт) |
| `site.css` дубль-селекторы | 11 групп | 0 групп |
| `site.css` размер | 268 КБ | ≤ 250 КБ (без потери функционала) |
| `site.js` размер | 236 КБ | ≤ 220 КБ (без потери функционала) |
| `audit-pro` | ✅ PASSED 29/2/0 | ✅ PASSED 29/0–2/0 |
| `notify-on-failure.yml` | не установлен | установлен |

---

## 7. Изменения в `AGENTS.md` (после каждой партии)

В §4.2 («`!important`») держать актуальные цифры. После завершения всей волны добавить запись `AGENTS-r62`.

---

## 8. История этого плана

| Версия | Дата | Что |
|---|---|---|
| v1 | 2026-06-04 | Создан, baseline зафиксирован (с неверным счётом `!important`) |
| v2 | 2026-06-04 | Fix baseline: `!important` в site.css — 342, не 323 (grep -c считает строки) |

## 9. Журнал партий (фактическое выполнение)

| Партия | Коммит | Дата | Результат |
|--------|--------|------|-----------|
| hotfix | `d0a7193` | 2026-06-03 | Замена мёртвой ссылки anglicanbooksrevitalized.us на web.archive.org |
| P1 | `2108bc7` | 2026-06-03 | 3 настоящих top-level дубль-селектора (blockquote, .bottom-bar, article p) → слиты |
| P1b | `56367d3` | 2026-06-03 | 6 premium-section дублей (body font-features, h1, h1-large, article a, .pq-scripture, #reading-progress, .pullquote::before) → слиты |
| P2 | `ce6af68` | 2026-06-03 | `.fn-marker .tooltip:hover` — 2 `!important` сняты (псевдокласс выше специфичностью) |
| P3 | `af7f3c5` | 2026-06-03 | `.h-hero-title:hover` архитектурный фикс: значения из site.css `!important`-block перенесены в home.css без `!important` (источник правды один). site.css −13 `!important`. Удалён также соседний `@media (hover: none), (max-width: 640px)` reset-блок (тоже без `!important` в home.css). |
| P4 | `61713f5` | 2026-06-03 | (a) `@media (orientation: landscape) and (max-height: 500px)` перемещён ПОСЛЕ базового `.bottom-bar, #share-dialog, .btoc-panel` padding-правила — `!important` больше не нужен (каскад). −2. (b) 4 мёртвых правила `.sd-url-strip / .sd-divider / .sd-url-copy / .sd-label-default { display: none !important }` удалены — классы нигде в HTML/JS не используются. −4. ИТОГО: −6 |
| P5 | `d683088` | 2026-06-03 | Удалён legacy `.theme-float-btn` (AGENTS-r17 — заменён на `gb-fc-theme` в gbFloatingControls). 10 правил, ~110 строк CSS, ~1.2 КБ. Из 5 разных мест: nagornaya-page hide, touch-target list, main block, prefers-reduced-motion list, body.gb-fc-active hide-list. Заодно удалены `#themeFloat` и `#gbSearchFloat` из CSS hide-list (тоже legacy). −1 `!important`, но `−110 строк` мёртвого кода. |
| P6 | `1ee834c` | 2026-06-03 | Удалены 4 мёртвых селектора: `.epilogue-caption`, `.epilogue-prose`, `.h-section-link:hover` (внутри no-hover группы), `.article-img.float-fallback` (base + mobile override), `.card.fx-lift` (base + :hover + dark + reduced-motion + premium polish). Все 4 проверены `grep -rn` по `.html`/`.js` — ни одного использования. −7 `!important`, −900 байт. |
| P7 | `c141f36` | 2026-06-03 | Тщательный поиск мёртвых классов (60 кандидатов через парсер CSS). Удалено: (a) `.ai-disclosure` + `.ai-disclosure__icon` (4 правила, ~25 строк CSS) — DEAD по AGENTS-r11 (JS-модуль удалён), AGENTS §0 п.9 запрещает возвращать; (b) `.article-img--portrait-wide img` (1 правило, −1 `!important`); (c) `.bg-stone-950` и `.border-stone-800` убраны из nagornaya Tailwind-override списков (не используются в HTML/nagornaya/, проверено grep). −1 `!important`, −195 b. |
| P8 | `fd732b0` | 2026-06-03 | `.summary-card__check svg` — 6 `!important` сняты. Контекст: `.summary-card` используется только в 2 не-nagornaya статьях (hermenevticheskaya..., 20-antisovetov...) — нет Tailwind конкурентов. Селектор descendant `.summary-card__check svg` имеет специфичность 0,2,1 — никто не перебивает. AUDIT-FIXES inline 2026-05-21 ставил `!important` массово без анализа конкурентов. −6 `!important`. |
| P9 | `54bce49` | 2026-06-03 | `.summary-card` массовая чистка `!important`: `.summary-card__item` (−6), `.summary-card__item:hover` (−1), `html.dark .summary-card__item` (−2), `.summary-card__check` (−12), `html.dark .summary-card__check` (−3). Те же обоснования что и P8: компонент только на 2 не-nagornaya страницах, нет Tailwind. Все color-mix fallback паттерны сохранены (`property: rgb-fallback; property: color-mix(...);`). −23 `!important`. |
| P10 | `945cd4b` | 2026-06-03 | `.summary-card` финальная чистка: `.summary-card__text strong` (−3), `@media (max-width: 560px)` 6 `!important` (padding, border-radius, width, height, font-size, padding-left), `@media (max-width: 380px)` 1 (padding-left). Также удалено пустое правило `.summary-card__text.drop-cap {}`. ОСТАВЛЕН `!important` блок `.summary-card__text::first-letter` (7 шт) — это легитимный override `.drop-cap::first-letter` той же специфичности (`КРИТИЧНО: drop-cap НЕ должен трогать summary-card`). −10 `!important`. |
| P11 | `db3860c` | 2026-06-03 | (a) `.gb-accuracy-title` / `.gb-accuracy-desc` color + `html.dark` варианты (4 `!important`) — конкурент `body.nagornaya-page .gb-accuracy-*` имеет ВЫШЕ специфичность (0,2,0 vs 0,1,0/0,2,0); `!important` лишний. (b) `.heading-anchor.copied` + `html.dark` вариант (2 `!important`) — конкурент `:hover` имеет 0,1,1 vs 0,2,0 у `.copied`; `!important` лишний. −6 `!important`. |
| P12 | ⏳ | — | Добавлен `.github/workflows/notify-on-failure.yml` — слушает завершение `deploy.yml` и `indexnow.yml`; при `conclusion == 'failure'` открывает GitHub issue с тегом `ci-failure` + `bug`. Дубликаты предотвращаются (поиск открытого issue с тем же title → коммент вместо нового issue). audit-pro теперь даёт ✅ `notify-on-failure.yml present` вместо ℹ️ info-warning. |

---

> **Для следующего агента, если этот контекст упал:**
> Открой этот файл, посмотри последний выполненный пункт партии (по `git log --grep "PLAN-04"`), продолжи со следующего. Не начинай заново.
