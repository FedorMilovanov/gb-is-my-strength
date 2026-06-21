# Production Route Taxonomy — Verified 2026-06-21

**Дата:** 2026-06-21  
**Источник истины:** `src/pages/**/*.astro` + `src/components/**/*_legacy/*.html` + `scripts/route-shadow-taxonomy.js`  
**Команда:** `npm run route:taxonomy`

---

## 1. Executive summary

На 2026-06-21 production-архитектура проекта **неоднородна**.

Да, **все 51 production route** используют `loadLegacyFullDocument`, но это не означает, что все 51 одинаково рендерят body.

Фактическая разбивка:

| Слой | Count | Что это означает |
|---|---:|---|
| **Pure full-body shadow** | **33** | page file получает `bodyHtml` и вставляет его verbatim через `<Fragment set:html={bodyHtml} />` |
| **Hybrid page-segment shadow** | **9** | page file сам собирает body из raw `_legacy/*.html` fragments + Astro wrappers |
| **Hybrid delegated-component shadow** | **9** | page file делегирует body-компоновку компоненту (`NagornayaPageMain`) |
| **True native production routes** | **0** | ни одна production page не рендерит hand-authored Astro/MDX body |
| **Dev-only native** | **1** | `/dev/astro-test/` |

**Ключевой вывод:**

> Репозиторий находится не в состоянии «100% pure verbatim shadow», а в состоянии **33 pure + 18 componentized shadow + 0 native production**.

---

## 2. Route categories

## 2.1 Pure full-body shadow — 33 routes

Это страницы следующего типа:

```astro
const { headHtml, bodyHtml, bodyAttributes } = loadLegacyFullDocument(...)
...
<body {...bodyAttributes}>
  <Fragment set:html={bodyHtml} />
</body>
```

### Routes
- `/articles/20-antisovetov-pastoru/`
- `/articles/dzhon-gill-chast-1-chelovek/`
- `/articles/dzhon-gill-chast-2-uchenyi/`
- `/articles/dzhon-gill-chast-3-nasledie/`
- `/articles/dzhon-gill-istoricheskiy-kontekst/`
- `/articles/dzhon-gill-spravochnik/`
- `/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/`
- `/articles/kod-da-vinchi/`
- `/articles/krajne-li-isporcheno-serdce/`
- `/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/`
- `/baptisty-rossii/dva-sezda-1884/`
- `/baptisty-rossii/goneniya-i-sovest/`
- `/baptisty-rossii/iniciativnaya-gruppa/`
- `/baptisty-rossii/noch-na-kure/`
- `/baptisty-rossii/peterburgskaya-liniya/`
- `/baptisty-rossii/podpolnaya-pechat/`
- `/baptisty-rossii/sovetskaya-noch/`
- `/baptisty-rossii/spravochnik/`
- `/baptisty-rossii/vsehib-1944/`
- `/baptisty-rossii/yuzhnaya-shtunda/`
- `/karty/avraam/`
- `/karty/early-church/`
- `/karty/ishod/`
- `/karty/maccabim/`
- `/karty/melachim/`
- `/karty/pavel/`
- `/karty/revelation/`
- `/karty/shoftim/`
- `/karty/shvatim/`
- `/karty/yeshua/`
- `/konfessii/russkij-baptizm/`
- `/map/`
- `/rodosloviye/`

### Значение для roadmap
- Это самый «тяжёлый» тип rollback-safe shadow routes.
- Здесь extraction seams ещё почти не видны.
- Такие pages хуже всего подходят для shell-first migration и лучше подходят для **content/layout-first breakout** или **special-app rewrite**.

---

## 2.2 Hybrid page-segment shadow — 9 routes

Это страницы, где **page file** уже собирает body из сегментов:
- raw `_legacy/body-segment-*.html`
- raw `_legacy/main.html`
- или leaf Astro wrappers (`AboutArticle`, `HomeMain`, `ArticlesMain` и т.д.)

### Routes
- `/about/`
- `/articles/`
- `/baptisty-rossii/`
- `/biografii/`
- `/hard-texts/`
- `/`
- `/karty/`
- `/konfessii/`
- `/pastor-series/`

### Что важно
Это **не** native Astro content. Но это уже **не pure full-body shadow**.

У этих routes есть явные extraction seams:
- `segBefore` / `segAfter`
- `bodyBefore` / `bodyMid` / `bodyAfter`
- отдельные компоненты `*Main.astro`

### Значение для roadmap
Это лучший материал для **shell-first migration**:
- можно постепенно заменять raw-fragments hand-authored Astro markup’ом,
- не переписывая сразу всю страницу,
- и сохраняя pixel-parity discipline.

---

## 2.3 Hybrid delegated-component shadow — 9 routes

Это кластер `/nagornaya/*`.

Page files здесь выглядят почти «чисто», но реальная body-сборка скрыта внутри `NagornayaPageMain.astro`, который импортирует:
- `./*/_legacy/body-segment-0.html`
- `./*/_legacy/main.html`
- `./*/_legacy/body-segment-1.html`

### Routes
- `/nagornaya/`
- `/nagornaya/chast-1/`
- `/nagornaya/chast-2/`
- `/nagornaya/chast-3/`
- `/nagornaya/chast-4/`
- `/nagornaya/chast-5/`
- `/nagornaya/seriya/`
- `/nagornaya/istochniki/`
- `/nagornaya/nakhodki/`

### Значение для roadmap
Это не pure shadow, но и не real semantic component system.

Это отдельный класс: **delegated hybrid**.

Он уже ближе к native, чем 33 pure routes, но требует:
- сначала распилить `NagornayaPageMain` на субкомпоненты,
- потом переносить tailwind-specific и TOC-specific поведение,
- и только затем говорить о настоящем native rollout.

---

## 3. Какие production components реально используются

Статическая проверка page imports даёт **11 production-used components**:

- `AboutAccuracyBlock.astro`
- `AboutArticle.astro`
- `ArticlesMain.astro`
- `BaptistyRossiiMain.astro`
- `BiografiiMain.astro`
- `HardTextsMain.astro`
- `HomeMain.astro`
- `KartyMain.astro`
- `KonfessiiMain.astro`
- `NagornayaPageMain.astro`
- `PastorSeriesMain.astro`

### Но важно различать 3 уровня

| Уровень | Что внутри | Реальный статус |
|---|---|---|
| Semantic leaf split | about article + accuracy block | ближе всего к «редактируемому Astro» |
| Raw wrapper component | `*Main.astro` with `?raw` HTML | это именованный контейнер, но не hand-authored content |
| Delegated fragment assembler | `NagornayaPageMain.astro` | body-компоновщик, а не semantic page system |

То есть фраза «components orphaned» для всех `*Main.astro` неверна. Но и фраза «native page already exists» тоже неверна.

---

## 4. Почему ошибка классификации была опасной

Если считать проект «51 одинаковых verbatim routes», roadmap искажался в худшую сторону:
- казалось, что **все pages одинаково далеки от native**,
- недооценивалась ценность уже существующих extraction seams,
- `/about/`, `/articles/`, `/` и `/nagornaya/*` выглядели как такие же «трубы», как `/rodosloviye/` или `/karty/avraam/`.

На практике это не так.

### Migration priority should be split

#### A. Shell-first candidates
- `/about/`
- `/articles/`
- `/biografii/`
- `/hard-texts/`
- `/pastor-series/`
- `/konfessii/`
- `/`

#### B. MDX/layout-first candidates
- `/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/`
- `/articles/dzhon-gill-istoricheskiy-kontekst/`
- `/baptisty-rossii/spravochnik/`

#### C. Special-app / last-wave candidates
- `/rodosloviye/`
- `/karty/*`
- `/konfessii/russkij-baptizm/`

---

## 5. Canonical wording for future docs

Вместо неточной формулы:

> «51/52 страниц в full-document shadow-wrap»

использовать расширенную формулу:

> «Все 51 production route используют `loadLegacyFullDocument`, но это не единый класс: 33 routes — pure full-body shadow, 18 routes — componentized/hybrid shadow, true native production routes отсутствуют.»

Это сохраняет правду о shadow-wrap, но не стирает уже проделанную extraction work.

---

## 6. Bottom line

Production-архитектура сейчас — это не zero-native monolith и не успешная Astro migration.

Это:
- **router/head modernization сверху**,
- **legacy body transport снизу**,
- **partial extraction seams посередине**,
- **orphaned native layer сбоку**.

Именно поэтому следующий этап должен быть не «рефакторим всё одинаково», а **разный migration strategy для трёх классов routes**.
