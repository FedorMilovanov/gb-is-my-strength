# Agent 6db558d0 — W1 no-JS Back: root-cause анализ + transfer-gap inventory

**Дата:** 2026-11-19 · **Режим:** read-only диагностика, без mutation чужих веток, canonical и main
**Ветка агента:** `arena/6db558d0-gb-is-my-strength` (base `main@9edef94e`)
**Объект:** exact `36e69c4d822f752d4f99914a55a6de798f7164e3` (ветка №8), production-like `dist`, собранный локально
**Статус:** SUPPORT ONLY. Ничего не пушилось в чужие ветки; все патчи — только в одноразовом `/tmp`-worktree

---

## 0. Среда (воспроизводимый рецепт для всех агентов Arena)

Свежий sandbox имеет Node **22.22.3**, а контракт требует **>=22.23.4** (`astro7-satteri-contract.mjs` FAIL, Astro CLI сам отказывает). nodejs.org и release-assets.githubusercontent.com вне egress. Решение без обхода контракта:

```bash
npm install --prefix /tmp/node22 --no-audit --no-fund node-linux-x64@22.23.4   # бинарь внутри npm-тарболла
export PATH=/tmp/node22/node_modules/node-linux-x64/bin:$PATH                  # ровно 22.23.4, как в CI
```

Chromium 153.0.8010.0 — по owner-инструкции (`@sparticuz/chromium@153.0.0` + `playwright@1.64.1` в `/tmp/arena-browser`, распаковать `bin/al2023.tar.br` → `libs`, `LD_LIBRARY_PATH=.../libs/lib`, args `--no-sandbox --disable-dev-shm-usage`; API: `require('.../build/index.js').default.executablePath()`).

**Сборка exact 36e69c4d: `npm run strangler:build:production-like` — PASS на 22.23.4, включая satteri-контракт, CSP, pastor-guards. Отклонений от контракта нет.**

## 1. W1: воспроизведение блокера (JS OFF, viewport 390×844)

Сценарий owner/№1: `/articles/#catalog-materials` → скролл вглубь каталога → клик по последней записи (`/articles/lot-i-sodom/`) → нативный Back. Замеры скролла через CDP `Page.getLayoutMetrics` каждые 40 мс (работает без page-JS).

| Прогон | Условия | До клика | После Back | Drift | Вердикт |
|---|---|---|---|---|---|
| A2 | clean `/articles/`, JS off | 24233 | 24233 @90мс, стабильно | **0** | PASS |
| B2 | `#catalog-materials`, JS off | 24233 | 24233 @70мс → **плавный 1.9-секундный animated-уход** → 969 | **−23264** | **FAIL (воспроизведён)** |
| C2 | `#catalog-materials`, JS **on** | 24233 | 24233 @105мс, стабильно | **0** | PASS |

B2 = отчёт №1 (27506→969): restore сначала **точный**, затем страницу анимирует к фрагменту. «Lands at ~1655ms» у №1 = конец CSS-анимации, не отложенный скачок.

## 2. Контроль без единой строчки Product-кода (toy-страницы)

| Прогон | Страница | Результат |
|---|---|---|
| T1 | toy, `#tgt`, `html{scroll-behavior:smooth}` | **FAIL**: restore 26745 @43мс → animated уход к якорю, drift −26774 |
| T2 | toy, `#tgt`, без smooth | **PASS**, drift 0, стабильно |
| T3 | toy, clean URL, smooth | PASS, drift 0 |

**Вывод 1:** платформенный баг Chromium: на history-traversal по URL с фрагментом restore позиции конкурирует с отложенным fragment-scroll; `scroll-behavior:smooth` (a) сам достаточен для триггера (T1), (b) превращает потерю позиции в 1.5–2-секундный видимый захват скролла.

## 3. Реальная страница сложнее toy: два механизма

Патч `@media (prefers-reduced-motion: no-preference){html{scroll-behavior:smooth}}` → удалён из одноразового `dist/css/site.css` (источник: **legacy `css/site.css`, строка 2** — shared surface, НЕ патчил в репозитории):

- анимация исчезла, но Back всё равно прилетает на фрагмент **мгновенно** (969 @64мс, сразу после `load` @59мс). FAIL сохраняется.
- Триггер гонки на реальной странице — **тайминг поздних ресурсов** (блокировки через Playwright route):

| Блокировка | Drift |
|---|---|
| images only | **0 (PASS)** |
| fonts only | **0 (PASS)** |
| images+fonts+media | −26187 (FAIL) |
| stylesheets | −21 (~PASS) |
| ничего (как есть) | −23264 (FAIL) |

То есть на реальной странице restore и fragment-scroll **гоняются**; исход зависит от того, что успело загрузиться. Гонка, а не детерминированный код.

**Вывод 2 (граница причинности):** продуктового JS-вины нет (JS off воспроизводится), продуктового CSS-вины частично есть (global smooth rule усугубляет и самодостаточно триггерит на toy). JS-on защищает не scrollRestoration (в 5 загружаемых скриптах его нет), а собственные hash/scroll-хендлеры `reader-state.js`/`reader-preferences.js` (`scrollIntoView behavior:'auto'`), выигрывающие гонку у deferred fragment-scroll.

## 4. Опции для решения №1/owner (не решение — вход для него)

| # | Опция | Эффект | Границы |
|---|---|---|---|
| F1 | Убрать/ограничить global `html{scroll-behavior:smooth}` (legacy `css/site.css:2`), например гейтить за `html.js` | Убирает 2-секундный animated hijack; no-JS Back становится мгновенным «в начало секции» | 1 строка, но **shared legacy CSS** → SYSTEM/owner approval; меняет anchor-UX всего сайта для no-JS |
| F2 | Documented acceptance: для history-entries с фрагментом принять browser-native «back→section start» (мгновенный), ≤1px gate оставить для clean URL | W1 freeze без фейковых гарантий | Требует явной подписи owner; toy T1/T2 — доказательство платформенности |
| F3 | Оставить как есть | JS-пользователи не затронуты; no-JS теряют позицию на 20–27k px с анимацией | Не рекомендуется: худший из режимов |

Рекомендуемая связка: **F1 (harm reduction, bounded) + F2 (честный критерий приёмки остаточного поведения)**. Это не «ослабление теста молча»: F2 предлагается с приложенным доказательным пакетом платформенного воспроизведения.

## 5. Transfer-gap `36e69c4d` → canonical #2338 (`b2ae614`) — инвентарь

- **`merge-base(b2ae614, 36e69c4d) = b2ae614`**: ветка №8 — **линейный потомок canonical, +23 коммита**. Перенос = **чистый fast-forward**, конфликтная поверхность нулевая. «Selective transfer» сводится к выбору целевого SHA + revalidation.
- 47 файлов, +4847/−997. Всё внутри: `src/components/articles|journal` (22), `src/pages` (3), `src/data/journal` (3), `scripts/*` (12, включая новые контракт-тесты №8), `docs/reviews` (2).
- Restricted surfaces: **нет** `.github`, `package*.json`, `css/`, `js/`, `public/`, `sw.js`, `migration/`. Единственный shared-data файл: `data/scripture-search-index.json` — дельта это счётчик `scannedSourceFiles 545→550` (derived артефакт; writer'у регенерировать пост-перенос, не доверять diff).
- Права записи в canonical по-прежнему требуют owner-назначенного writer'а. Я готов выполнить FF-перенос с полным post-transfer набором (build exact Node 22.23.4 + contracts + browser re-validation на pushed SHA) **только по явному приказу владельца**.

## 6. Замеченные слабые места процесса (системные, не по людям)

1. **Node floor ломает сборку у свежих агентов** (22.22.3 в sandbox vs >=22.23.4 в контракте). Рецепт §0 закрывает без ослабления контракта; стоит зафиксировать в `docs/arena-browser-sandbox` (PR #2311).
2. **Каноникал отстаёт от проверенного кода на 23 коммита** — весь риск накоплен в одном переносе. FF-характер ветки это полностью разрешает: переносить можно любым промежуточным SHA, а не только HEAD.
3. **Полные независимые прогоны каждого SHA тремя агентами** дороги; для CSS/print-only дельт между прогонами (16d0→36e) достаточно таргетированных проверок — уже отражено в owner-директиве про event-driven cadence.

## 7. Чем готов быть полезен (ожидаю назначение MAX/owner)

- **A. Диагностика навигационных/исторических багов** — инструментарий поднят, W1-матрица воспроизводима за ~2 мин.
- **B. Инженер/исполнитель transfer'а 36e→#2338** — манифест готов (§5), конфликтов нет, нужен только письменный writer-мандат.
- **C. Независимая приёмка integrated candidate** на новом exact SHA (smoke + W1-регресс) в дополнение к №9 (print) и №6 (SEO).

**Границы, которые соблюдаю без напоминания:** не пишу в чужие ветки, canonical, main; не трогаю shared CSS/JS/SW без SYSTEM-режима; не создаю параллельный UI/сайт; Research/publication HOLD не мой.
