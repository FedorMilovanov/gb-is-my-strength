# Последние пуши и анализы — верифицированный разбор

**Дата:** 2026-06-21  
**Метод:** локальный git clone + просмотр commit history + статическая проверка `src/pages`, `src/components`, `research`, `docs`, `audit`.  
**Важно:** в этой сессии я **не** прогонял полный Astro/Playwright runtime; выводы ниже верифицированы по исходникам и git-истории.

---

## 1. Короткий вывод

Последние пуши после `87fcc7b2` почти полностью состоят из:
- исправления аналитики,
- правки guard-скриптов,
- корректировки метрик,
- sandbox/documentation notes.

**Новых production-архитектурных изменений после `87fcc7b2` не было.**

Главная ошибка в текущих анализах: они слишком грубо свели архитектуру к формуле **«51/52 страниц = verbatim full-document shadow-wrap»**. Это **неполно и местами неверно**.

### Более точная картина

Из **51 production Astro route**:
- **33 route** = **pure verbatim full-document shadow**  
  (`loadLegacyFullDocument` + `<Fragment set:html={bodyHtml} />`)
- **18 route** = **componentized / hybrid shadow**  
  (`loadLegacyFullDocument` для head/body attrs + body собирается из raw fragments и/или Astro components)
- **0 production route** = **true hand-authored native Astro/MDX body**
- **1 route** = dev-only native page (`src/pages/dev/astro-test.astro`)

Именно поэтому тезис **«0 настоящих native production страниц»** остаётся верным, а тезис **«все production страницы verbatim bodyHtml»** — уже нет.

---

## 2. Что реально сделали последние важные пуши

## 2.1 Архитектурные пуши

### `e116bec6` — 2026-06-21 07:43 UTC
**Что сделал:** перевёл 20 individual article routes в pure full-document shadow.

Затронуто:
- 10 `src/pages/articles/*`
- 10 `src/pages/baptisty-rossii/*`

### `87fcc7b2` — 2026-06-21 08:12 UTC
**Что сделал:** перевёл в pure full-document shadow ещё 12 special routes.

Затронуто:
- 10 `src/pages/karty/*`
- `src/pages/konfessii/russkij-baptizm/index.astro`
- `src/pages/rodosloviye/index.astro`

### Что важно
Эти два коммита **не** трогали уже существующие Phase 6 hybrid pages:
- `/about/`
- `/articles/`
- `/baptisty-rossii/`
- `/biografii/`
- `/hard-texts/`
- `/`
- `/karty/`
- `/konfessii/`
- `/pastor-series/`
- весь кластер `/nagornaya/*`

То есть они не сделали архитектуру «однородно verbatim». Они сделали её **двухслойной**:
1. 33 pure verbatim routes
2. 18 hybrid/componentized shadow routes

---

## 2.2 Что делали пуши после `87fcc7b2`

После `87fcc7b2` шли в основном **meta-пуши**, а не изменения production pages:

- `1cb1a649` — новый health audit v2 + reality plan + новые guards
- `ef6325ba` — исправления багов в нескольких аналитических файлах
- `552f4a26` — fixes для parity-v2 и config
- `2894b0ce`, `3b7bd2fc`, `71633afa`, `b6c75209`, `20766a5a`, `080431e3` — исправление устаревших метрик в docs/AGENTS
- `59b71057`, `9f006cec`, `c041c54c`, `8ff89285` — регистрация/фиксы guard scripts
- `28ccc3f2` — sandbox references only

**Вывод:** после глобального rollback шла в основном **коррекция нарратива**, а не новая архитектурная работа.

---

## 3. Верифицированная архитектурная таксономия

## 3.1 Итоговые числа

| Категория | Кол-во | Смысл |
|---|---:|---|
| Production Astro routes | 51 | соответствует `data/public-content-baseline.json` |
| Всего `.astro` files в `src/pages` | 52 | + 1 dev-only route |
| Pure verbatim full-document shadow | 33 | `bodyHtml` вставляется целиком |
| Hybrid/componentized shadow | 18 | body собирается из fragments/components |
| True native production pages | 0 | нет hand-authored Astro/MDX body в production |
| Dev-only native page | 1 | `src/pages/dev/astro-test.astro` |

---

## 3.2 Pure verbatim full-document shadow — 33 routes

Это страницы вида:

```astro
const { headHtml, bodyHtml, bodyAttributes } = loadLegacyFullDocument(...)
...
<body {...bodyAttributes}>
  <Fragment set:html={bodyHtml} />
</body>
```

### В эту группу входят
- 10 `articles/*` individual pages
- 10 `baptisty-rossii/*` individual pages
- 10 `karty/*` individual map pages
- `konfessii/russkij-baptizm/`
- `/map/`
- `/rodosloviye/`

Это и есть настоящий **verbatim body shadow**.

---

## 3.3 Hybrid/componentized shadow — 18 routes

Это страницы, где:
- `<head>` остаётся legacy через `loadLegacyFullDocument`,
- но `<body>` **не** приходит одной строкой `bodyHtml`,
- вместо этого он собирается из raw `_legacy/*.html` fragments и Astro wrappers.

### Подгруппа A — page-level hybrid (9 routes)

- `/about/`
- `/articles/`
- `/baptisty-rossii/`
- `/biografii/`
- `/hard-texts/`
- `/`
- `/karty/`
- `/konfessii/`
- `/pastor-series/`

Типовой паттерн:

```astro
<Fragment set:html={segBefore} />
<SomeMainComponent />
<Fragment set:html={segAfter} />
```

### Подгруппа B — component-internal hybrid (9 routes)

Весь кластер:
- `/nagornaya/`
- `/nagornaya/chast-1/`
- `/nagornaya/chast-2/`
- `/nagornaya/chast-3/`
- `/nagornaya/chast-4/`
- `/nagornaya/chast-5/`
- `/nagornaya/seriya/`
- `/nagornaya/istochniki/`
- `/nagornaya/nakhodki/`

Снаружи page file выглядит почти как простой компонент:

```astro
<body {...bodyAttributes}>
  <NagornayaPageMain slug="..." />
</body>
```

Но сам `NagornayaPageMain.astro` собирает страницу из:
- `body-segment-0.html`
- `main.html`
- `body-segment-1.html`

То есть это **не** pure verbatim bodyHtml и **не** true native page.

---

## 3.4 Почему `/about/` и другие «native pilot» страницы не являются настоящими native pages

Например:
- `AboutArticle.astro` делает `import legacyHtml from './_legacy/article.html?raw'`
- `AboutAccuracyBlock.astro` делает `import legacyHtml from './_legacy/accuracy-block.html?raw'`
- `ArticlesMain.astro`, `HomeMain.astro`, `KartyMain.astro`, `BaptistyRossiiMain.astro`, `KonfessiiMain.astro` тоже в основном просто рендерят raw legacy HTML

То есть сейчас это не «переписанные Astro-компоненты», а **named wrappers around extracted legacy fragments**.

Это важно, потому что:
- с точки зрения **пиксельного паритета** это почти идеальный компромисс;
- с точки зрения **реальной миграции контента в Astro/MDX** это ещё не победа.

---

## 4. Где текущие анализы ошибаются

Ниже перечислены файлы, где архитектура описана слишком грубо или неверно.

## 4.1 `audit/visual-parity-evidence-2026-06-21-full-coverage.md`

Проблемные тезисы:
- «Все 52 production `.astro` файлов теперь используют `loadLegacyFullDocument` (full-document shadow-wrap)»
- «Astro emits ровно тот же `<head>` и `<body>`»
- «`loadLegacyFullDocument` verbatim» для всех 51 route

### Что неверно
- production routes не 52, а **51**; 52-й `.astro` — это dev-only `astro-test`
- не все route emit'ят **тот же body как одну verbatim строку**
- для 18 routes body собирается из fragments/components, а не `bodyHtml`

### Что остаётся верным
- все 51 production routes действительно используют **`loadLegacyFullDocument`**
- все production routes действительно ушли от `BaseLayout` / `loadLegacyShadowPage`
- визуальный baseline мог остаться нулевым, но архитектурное описание в файле всё равно слишком грубое

---

## 4.2 `research/PROJECT_HEALTH_AUDIT_2026-06-21.md`

Проблемные тезисы:
- «All 52 production pages emit verbatim legacy HTML via loadLegacyFullDocument.»
- «51/52 pages in full shadow-wrap»
- «All src/components/*Main.astro components ... do NOT render»

### Что неверно
- production pages не 52, а 51
- `*Main.astro` компоненты как раз **рендерятся** на 18 hybrid routes
- неверно говорить, что все production pages рендерят body одинаковым verbatim способом

---

## 4.3 `research/PROJECT_HEALTH_AUDIT_v2_2026-06-21.md`

Это уже более сильный документ, но в нём сохранилась ключевая архитектурная сверх-редукция:
- «51/52 (98%) full-document shadow» в смысле будто все они одинаково verbatim
- «100% shadow-wrap» без деления на pure vs componentized shadow

### Что в v2 полезно и остаётся сильным
- верно зафиксированы обновлённые метрики CSS/JS
- верно отмечено, что `ArticleLayout`, `SeriesArticleLayout`, `BaseLayout` и MDX-файлы не участвуют в production rendering
- верно, что **true native production content сейчас отсутствует**

### Что нужно уточнить
- архитектура не однородна; она уже содержит **18 route-level extraction points**
- это важно для planning: не все 51 страницы одинаково далеки от реального Astro

---

## 4.4 `docs/refactor-2026/REFACTORING_6_0_REALITY_PLAN.md`

Тезис «51/52 страниц в full-document shadow-wrap» технически можно защитить, если под ним понимать только факт использования `loadLegacyFullDocument`.

Но для roadmap этого недостаточно.

### Для planning нужна более полезная формула:
- **33 pure full-body shadow routes**
- **18 componentized shadow routes**
- **0 native production routes**

Это намного лучше отражает:
- сложность миграции,
- очередность работ,
- стоимость выхода из shadow,
- то, какие routes уже имеют semantic extraction seams.

---

## 5. Где прошлый агент был прав, а где нет

## Правильно
- он заметил, что `/about/` не является simple full-body verbatim route
- он заметил, что есть routes с body fragments + Astro wrappers
- он фактически поймал ошибку в overly broad claims текущих аналитик

## Неправильно / неполно
- цифра **16 hybrid / 35 pure** по текущему дереву исходников не подтверждается
- статическая проверка даёт **18 hybrid / 33 pure**

### Почему могла возникнуть ошибка 16
Скорее всего, были:
- недосчитаны 2 route из landing/hub family,
- или `NagornayaPageMain` интерпретировали как «один компонент» вместо componentized body assembler.

---

## 6. Более глубокий вывод: сейчас в репозитории не одна, а три стадии миграции

## Stage A — pure legacy body shadow (33)
Самые «сырые» production pages. Там extraction ещё не начат или почти не начат.

## Stage B — extracted legacy fragments in Astro shell (18)
Это **не native**, но уже есть seams для замены кусков разметки.

Признаки:
- `_legacy/main.html`
- `_legacy/body-segment-0.html`
- `_legacy/body-segment-1.html`
- Astro wrappers типа `HomeMain.astro`, `ArticlesMain.astro`, `NagornayaPageMain.astro`

## Stage C — orphaned true native layer (layouts + MDX)
- `BaseLayout.astro`
- `ArticleLayout.astro`
- `SeriesArticleLayout.astro`
- `src/content/articles/*.mdx` (20 файлов)
- `GenealogyTree.tsx`

Эта стадия существует в кодовой базе, но **не подключена к production route rendering**.

**Вот настоящий architectural picture:**
production уже не completely flat legacy dump, но ещё и не live Astro app.
Это **strangler-in-progress, застывший на середине**.

---

## 7. Что это меняет для рефакторинга

## 7.1 Не все страницы одинаково сложны

### Быстрее всего двигать дальше
**18 hybrid routes**, потому что там уже есть extraction seams.

Наиболее готовые кандидаты shell-first:
- `/about/`
- `/articles/`
- `/biografii/`
- `/hard-texts/`
- `/pastor-series/`
- `/konfessii/`

### Отдельный трек
**20 article/series routes**, потому что у них уже есть MDX + orphaned layouts, но нет page-level extraction в текущем production output.

Здесь возможен content-first breakout:
- `/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/`
- `/articles/dzhon-gill-istoricheskiy-kontekst/`
- `/baptisty-rossii/spravochnik/`

### Самые дорогие
- `/rodosloviye/`
- `karty/*`
- `/konfessii/russkij-baptizm/`

---

## 7.2 Надо разделить два понятия, которые в анализах смешались

### A. “shadow route”
Да, сейчас **все 51 production routes** — shadow routes в широком смысле.

### B. “verbatim body route”
Нет, таких routes **не 51**, а **33**.

Эта разница критична для честного planning.

---

## 8. Практические рекомендации по исправлению аналитики

## Минимальный corrective wording
Во всех новых документах заменить грубую формулу:

> «51/52 страниц в full-document shadow-wrap»

на более точную:

> «Все 51 production routes используют `loadLegacyFullDocument`, но архитектура split'ится на 33 pure verbatim full-body routes и 18 componentized/hybrid shadow routes. True native production rendering отсутствует.»

## Что стоит обновить в первую очередь
1. `audit/visual-parity-evidence-2026-06-21-full-coverage.md`
2. `research/PROJECT_HEALTH_AUDIT_2026-06-21.md`
3. `research/PROJECT_HEALTH_AUDIT_v2_2026-06-21.md`
4. `docs/refactor-2026/REFACTORING_6_0_REALITY_PLAN.md`
5. `docs/refactor-2026/REFACTORING_6_0_DEEP_PLAN.md`

---

## 9. Финальный verdict

### Что подтверждено
- последние большие production-пуши: `e116bec6` и `87fcc7b2`
- после них шли в основном doc/guard/meta fixes
- все production routes действительно используют `loadLegacyFullDocument`
- true native production rendering сейчас отсутствует
- MDX/layout layer в production не активен

### Что опровергнуто
- что все production pages одинаково рендерят body как один verbatim `bodyHtml`
- что `*Main.astro` wrappers не используются
- что production pages = 52

### Самая точная формула состояния на сейчас

> **51 production routes = 33 pure full-body shadow + 18 componentized shadow + 0 true native production pages.**

Это и есть базовая формула, от которой надо строить дальнейший Refactoring 6.0.
