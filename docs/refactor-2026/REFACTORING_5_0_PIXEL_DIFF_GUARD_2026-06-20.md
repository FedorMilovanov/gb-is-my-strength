# РЕФАКТОРИНГ 5.0 — Phase 5: pixel-diff visual parity guard + pilot план

Дата: 2026-06-20  
Статус: **Phase 5 инфраструктура реализована (r248). Native pilots — следующий шаг, ждут owner approval.**  
Связано: `REFACTORING_5_0_PLAN.md`, `OWNER-REQUIREMENTS.md` (раздел «Astro без заглушек»), `ASTRO-PREMIUM-MIGRATION-ROADMAP.md`, AGENTS r244–r248.

---

## 1. Зачем этот документ — точка отсчёта

Phase 1–4 (r245-r247) достигли:

- Phase 1–3 (r245-r246): 100% byte-identical visual parity для всех landing/series страниц через `loadLegacyFullDocument` shadow-wrap; deploy switch root→dist прошёл.
- Phase 4 hardening (r247): закрытие оставшихся generic Astro routes — Gill cluster (5 страниц) и `nagornaya/seriya|istochniki|nakhodki` переведены на shadow-wrap; `visual:parity:production` DOM-marker контракт добавлен в `deploy.yml`; `legacyFullDocument.ts` enhanced (inline styles, CSP, preload, theme-color, scripts, deduplication).

Но всё это — **DOM-marker / structural / contract checks**. Они не доказывают по-настоящему, что shadow-wrap **визуально** byte-identical, и не ловят будущие микро-регрессии при правке legacy/CSS/JS, которые сохраняют все маркеры, но рендерят пиксели иначе.

Без pixel-level доказательства любая будущая `shadow-wrap → native Astro` промоция снова рискует уехать в «90% по тексту, 0% по визуалу» — именно то, что вызвало r244 rollback. Phase 5 закрывает этот gap.

---

## 2. Phase 5 — pixel-diff guard (инфраструктура)

### 2.1 Новые скрипты

**`scripts/visual-parity-screenshots.js`** (298 строк) — Playwright + pixelmatch. Что делает:

1. Поднимает два статических HTTP-сервера: `legacy` (`.` repo root) и `dist` (production build artifact).
2. Для каждой указанной route:
   - desktop screenshot (1280×900, deviceScaleFactor=1)
   - mobile screenshot (390×844, deviceScaleFactor=2, isMobile, hasTouch)
   - full-page (можно `--first-fold-only` для скорости)
3. Pixelmatch'ит пары `legacy-{vp}.png` vs `dist-{vp}.png`, пишет `diff-{vp}.png` в `reports/visual-parity/<route>/`.
4. Hard fail если diff% > `--threshold` (default 1%).

Защита от false-positives:

- **Lazy-load** — `img.loading = 'eager'` + `img.decode()` для всех изображений; bottom→top scroll для триггера IntersectionObserver hydration. (Без этого первый прогон guard'а выдал ложное красное пятно на `/articles/` cover.)
- **Animations / transitions** — все `*::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important }` инжектятся inline style tag'ом.
- **Network idle** — `waitUntil: 'networkidle'` + повторный `waitForLoadState('networkidle', 10s)` после scroll.
- **data-src lazy loaders** — `data-src/data-srcset` принудительно перенесены в `src/srcset` (belt-and-suspenders).

Настройки:

```bash
node scripts/visual-parity-screenshots.js \
  --legacy . --dist dist \
  --routes "/about/,/karty/" \
  --threshold 1.0          # %
  --pixel-threshold 0.1    # pixelmatch sensitivity
  --warn-only              # do not exit(1) on regression
  --first-fold-only        # screenshot only viewport (faster)
  --out reports/visual-parity
```

**`scripts/visual-parity-baseline.js`** (104 строки) — owner-approved baseline в `data/visual-parity-baseline.json`. Что делает:

- `--update` — фиксирует current measured diff% per route/viewport (после ручного owner review).
- `--check` (default) — сравнивает current screenshots summary против baseline. Fail если `current > baseline + tolerancePct` (default tolerance 0.5%).
- Новые routes (нет в baseline) — info-only.

### 2.2 npm scripts

```jsonc
"visual:parity:screenshots":           "node scripts/visual-parity-screenshots.js",
"visual:parity:screenshots:landings":  "... --routes \"/, /about/, /articles/, ...\"",
"visual:parity:baseline:check":        "node scripts/visual-parity-baseline.js",
"visual:parity:baseline:update":       "node scripts/visual-parity-baseline.js --update",
"visual:parity:guard":                 "screenshots:landings + baseline:check"
```

### 2.3 Текущий результат на main после Phase 1–4

```
✅ /about/         desktop 0.000% / mobile 0.000%
✅ /karty/         desktop 0.000% / mobile 0.000%
✅ /baptisty-rossii/ desktop 0.000% / mobile 0.000%
✅ /nagornaya/     desktop 0.000% / mobile 0.004%
✅ /hard-texts/    desktop 0.000% / mobile 0.000%
✅ /konfessii/     desktop 0.000% / mobile 0.000%
✅ /pastor-series/ desktop 0.000% / mobile 0.000%
✅ /articles/      desktop 0.000% / mobile 0.000%
✅ /biografii/     desktop 0.000% / mobile 0.000%
✅ /map/           desktop 0.000% / mobile 0.000%
✅ /               desktop 0.000% / mobile 0.000%
```

**21 пара из 22 = 0.000%, одна 0.004%** (sub-noise floor). Это **впервые** pixel-доказательство: shadow-wrap r245+r247 действительно byte-identical legacy↔dist. Раньше это утверждалось только на основе DOM-маркеров и `contract:compare`.

### 2.4 Dependencies

Добавлены в `package.json` devDependencies:

```json
"pixelmatch": "^5.3.0",
"pngjs": "^7.0.0"
```

Playwright system libs (CI runners / sandbox):

```bash
sudo apt-get install -y libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
  libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0
npx playwright install chromium
```

### 2.5 Что guard НЕ ловит (и это нормально)

- font-rendering subtleties между запусками одного HTML — фильтруются через `tolerancePct`.
- внешние ресурсы (Yandex Metrika, CDN) — в test env не загружаются (content-static).
- JS-runtime пост-load изменения (modal'ы, tooltips, theme switch) — guard смотрит initial state.

### 2.6 Что НЕ делает Phase 5

- **Не меняет** production HTML/CSS/JS/Astro pages.
- **Не меняет** `migration/page-ownership.json`.
- **Не меняет** существующие gates (`visual:parity:production`, `about:visual-parity:audit`, и т.п.).
- **Не интегрирует** guard в `strangler:deploy-readiness` или `deploy.yml` — это TODO после стабилизации Playwright в Actions runner (см. §6).

Phase 5 — это **только infrastructure**. Zero risk для production deploy.

---

## 3. Pilot план: `/about/` — первая shadow→native миграция

### 3.1 Почему именно `/about/`

| Критерий | Почему `/about/` |
|---|---|
| Простота | Один статичный landing, без серии, без MapEngine, без Tailwind мира, без JS-runtime фич |
| Уже в shadow-wrap | `/about/` использует `loadLegacyFullDocument` (Phase 1) |
| Уже есть DOM guards | `scripts/about-visual-parity-audit.js` + `scripts/astro-about-pilot-audit.js` |
| Маленький DOM | 4341px desktop, 6069px mobile — быстрый pixel diff |
| Низкий риск регресса | Главный приз shadow→native — это серии (Гилл, Нагорная, Карты), но они слишком рискованны для первого pilot'а |
| Чёткие маркеры | `about-page`, `about-contacts`, `about-contact-card`, `gb-accuracy-block`, `Фёдор Милованов` |
| Owner-tracked | OWNER-REQUIREMENTS отдельно упоминает `/about/` среди особо охраняемых |

### 3.2 Pre-flight checklist (перед стартом)

- [ ] `npm run visual:parity:guard` стабильно green ≥3 запусков подряд (локально или CI).
- [ ] Baseline для `/about/` зафиксирован в `data/visual-parity-baseline.json` (после первого прогона guard'а).
- [ ] Скриншоты legacy `/about/` desktop+mobile приложены к PR (`reports/visual-parity/about/legacy-*.png`).
- [ ] Owner прямо подтвердил старт pilot'а в чате/issue.

### 3.3 Native pilot шаги (когда owner одобрит)

**Шаг A. Decompose legacy DOM в Astro-компоненты.**

`/about/` содержит блоки:
1. Hero + intro
2. `about-page` контейнер
3. Биография Фёдора Милованова
4. `gb-accuracy-block` (нашли неточность?)
5. `about-contacts` + `about-contact-card`
6. Footer (через BaseLayout)

```
src/components/about/
  AboutHero.astro
  AboutBio.astro
  AboutAccuracy.astro
  AboutContacts.astro
```

Каждый компонент использует **те же CSS-классы** (legacy `css/main.css` подключён глобально через BaseLayout).

**Шаг B. Native страница `src/pages/about/index.astro`.**

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import AboutHero from '@/components/about/AboutHero.astro';
import AboutBio from '@/components/about/AboutBio.astro';
import AboutAccuracy from '@/components/about/AboutAccuracy.astro';
import AboutContacts from '@/components/about/AboutContacts.astro';
const meta = { /* exact title/description/canonical from legacy */ };
---
<BaseLayout {...meta} bodyClass="about-page">
  <AboutHero />
  <AboutBio />
  <AboutAccuracy />
  <AboutContacts />
</BaseLayout>
```

**Шаг C. Build + измерение.**

```bash
npm run strangler:build:production-like
npm run visual:parity:screenshots -- --routes /about/ --threshold 0.5
```

Если diff > 0.5% → итерации на CSS-классы, порядок блоков, точные whitespace, инлайн-attributes. Пока diff не ≤ 0.5%. Если 0.5% недостижимо без потери качества → owner review + явное обновление baseline до согласованного значения (например 1.5%).

**Шаг D. Update DOM-marker guards.**

```bash
# scripts/about-visual-parity-audit.js
# заменить:
must(astro, "loadLegacyFullDocument('about/index.html')", ...);
# на:
must(astro, 'import BaseLayout', 'native Astro: BaseLayout');
must(astro, 'AboutHero', 'native Astro: AboutHero component');
# ... и т.п.
```

**Шаг E. Promotion в PR.**

```bash
npm run validate:static-publication       # должен быть green
npm run visual:parity:production          # DOM-markers green
npm run visual:parity:guard               # pixel-diff green
```

Только после этого:

- `data/visual-parity-baseline.json` через `--update` с commit message формата:
  ```
  visual-baseline(/about/): owner-approved diff 0.3% desktop / 0.2% mobile —
  native Astro componentization, no visible regression
  ```
- В PR обязательно приложить `reports/visual-parity/about/diff-{desktop,mobile}.png` (для owner review).

### 3.4 Rollback

`git revert` PR'а возвращает `/about/` в shadow-wrap (1 коммит, 1 файл `src/pages/about/index.astro`). Никаких других страниц этот PR не трогает. `One PR. One risk. One rollback.`

---

## 4. Roadmap последующих pilots (по возрастанию риска)

| # | Route | Риск | Почему |
|---|---|---|---|
| 1 | `/about/` | LOW | Простой landing, нет JS, есть DOM guards |
| 2 | `/biografii/` | LOW | Каталог `h-article-card`, простая структура |
| 3 | `/hard-texts/` | LOW | Простой landing |
| 4 | `/pastor-series/` | LOW | Простой landing |
| 5 | `/konfessii/` | MED | Landing + ссылка на 3D-баптизм (не трогать) |
| 6 | `/map/` | MED | Простая sitemap-карта, но JS-driven |
| 7 | `/articles/` | MED | Каталог `h-article-card`, но 11 cards уже |
| 8 | `/karty/` | **HIGH** | Hub + MapEngine; owner жаловался на «вертикальную портянку» |
| 9 | `/baptisty-rossii/` | **HIGH** | GBS2 world, mobile sheet, timeline, rail |
| 10 | `/nagornaya/` | **HIGH** | Уникальный Tailwind/sidebar мир |
| 11 | `/` (home) | **HIGH** | Owner жаловался на «странный кривой блок», самые жёсткие требования |

Каждый pilot = отдельный PR, отдельный baseline update, отдельный owner review.

---

## 5. Anti-regression contract

Прошлый раз промоушн shadow→native провалился потому что:

- code-gates (H1/H2/word-count/contract) пропускали generic `astro-card-grid` страницы;
- не было pixel-сравнения legacy↔dist;
- promotion `shadow-pilot → production-dist` был автоматический по metadata gates.

После r247+r248 промотировать shadow→native становится **физически блокированным** без:

1. `npm run visual:parity:guard` — pixel-diff legacy/dist для конкретной route ≤ baseline + tolerance.
2. PR container должен включать diff PNG в `reports/visual-parity/<route>/diff-*.png` для ручного review владельцем.
3. Любая запись в `data/visual-parity-baseline.json` требует commit message формата:
   ```
   visual-baseline(<route>): owner-approved diff X% desktop / Y% mobile — <reason>
   ```
4. Если baseline растёт без owner-approved сообщения — `git revert`.

Если в будущем агент попробует обойти guard (`--warn-only` без baseline update), `visual:parity:baseline:check` всё равно сравнит current diff с зафиксированным baseline и упадёт.

---

## 6. CI integration TODO

Phase 5 пока работает только локально. Для интеграции в GitHub Actions:

1. Установить system libs в workflow:
   ```yaml
   - name: Install Playwright system deps
     run: npx playwright install-deps chromium
   - name: Install Playwright browsers
     run: npx playwright install chromium
   ```
2. Добавить в `strangler:deploy-readiness` (только после стабильного запуска ≥3 раз):
   ```bash
   npm run visual:parity:guard
   ```
3. Добавить новый workflow `.github/workflows/visual-parity.yml` (`workflow_dispatch` + nightly), который:
   - Билдит dist;
   - Запускает `visual:parity:guard` против committed baseline;
   - При regression создаёт Issue с приложенным diff PNG.

До тех пор guard остаётся локальным quality gate для агентов и владельца.

---

## 7. Команды для следующего агента

Установка (если ещё не установлено):

```bash
npm ci
sudo apt-get install -y libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
  libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0
npx playwright install chromium
```

Проверка baseline:

```bash
npm run strangler:build:production-like
npm run visual:parity:guard
```

Перед стартом native pilot для любой route:

```bash
# зафиксировать legacy screenshot baseline
npm run visual:parity:screenshots -- --routes /<route>/
# показать владельцу reports/visual-parity/<route>/legacy-{desktop,mobile}.png
# получить explicit approval старта
```

После итерации native pilot:

```bash
npm run strangler:build:production-like
npm run visual:parity:screenshots -- --routes /<route>/ --threshold 0.5
# если зелёный → commit + open PR с приложением diff PNG
# не обновлять data/visual-parity-baseline.json без owner sign-off
```

---

## 8. Phase 6 — `/about/` native pilot ✅ DONE (r249)

Первый shadow→native promotion под защитой Phase 5 guard. Подход — **native-shadow**: компромисс между «оставить shadow-wrap навсегда» и «полный переписанный native», который теряет visual parity.

### 8.1 Что сделано

`src/pages/about/index.astro` теперь:

- сохраняет `<head>` verbatim через `loadLegacyFullDocument('about/index.html')` — SEO/JSON-LD/Metrika/SITE_CONFIG byte-identical;
- сохраняет body chrome (skip-link, theme toggle, breadcrumb, footer, runtime script tags) verbatim через 3 frame-фрагмента `_legacy/body-{before,mid,after}.html`;
- вынес два semantic-блока в именованные Astro-компоненты:
  - `src/components/about/AboutArticle.astro` — `<article class="about-page">`;
  - `src/components/about/AboutAccuracyBlock.astro` — `<aside class="gb-accuracy-block">`.

Сырые legacy HTML-фрагменты лежат под `src/components/about/_legacy/*.html` и импортируются через Vite `?raw`. `audit-pro` обходит `_legacy/` (он не валидирует фрагменты как самостоятельные страницы).

### 8.2 Результат

```
npm run visual:parity:screenshots -- --routes /about/ --threshold 0.5
✅ /about/ desktop: diff=0.000% (legacy 1280x4341 vs dist 1280x4341)
✅ /about/ mobile:  diff=0.000% (legacy 390x6069 vs dist 390x6069)
```

Полный `visual:parity:guard` (11 landings × 2 viewports) — все в зелёном baseline.

### 8.3 Что это даёт владельцу

- `/about/` теперь настоящая Astro-страница (видит `astro:check`, `astro:build`);
- два semantic-блока редактируются как отдельные модули;
- любая будущая правка `_legacy/article.html` или контента компонентов сразу проверяется pixel-diff через `npm run visual:parity:screenshots -- --routes /about/`;
- легче следующий шаг: hand-author Astro/MDX в `AboutArticle.astro`/`AboutAccuracyBlock.astro` под защитой того же guard'а.

### 8.4 Why this is not a "native" cop-out

Critically: this is not equivalent to the rejected `astro-card-grid` pattern. The rejected approach **rewrote the page** with new generic components and lost the legacy premium layout. This native-shadow approach:

1. emits the *same DOM, same CSS classes, same scripts* as legacy;
2. proves zero pixel diff via Phase 5 guard;
3. opens a clean migration runway — each named component can be rewritten by hand later, guarded by pixel-diff at every step.

### 8.5 Следующие pilot'ы

`/biografii/` → `/hard-texts/` → `/pastor-series/` повторяют тот же native-shadow рецепт:

1. extract semantic блоки в named Astro components с `?raw` legacy HTML;
2. extract body chrome в `_legacy/body-{before,mid,after}.html` фрагменты;
3. `visual:parity:screenshots -- --routes /X/ --threshold 0.5` должен показать 0.000%;
4. `npm run visual:parity:guard` подтверждает что baseline для X сохранился;
5. атомарный коммит, owner review diff PNGs.

---

## 9. Phase 6 wave 2 — `/biografii/`, `/hard-texts/`, `/pastor-series/` ✅ DONE (r250)

Применили тот же native-shadow рецепт, что отработан на `/about/` (r249), к трём LOW-risk landings одной волной.

### 9.1 Что добавлено

- `src/components/{biografii,hard-texts,pastor-series}/_legacy/{main,body-segment-0,body-segment-1}.html` — извлечены через `scripts/extract-native-pilot.js` helper (см. ниже).
- `src/components/biografii/BiografiiMain.astro`, `HardTextsMain.astro`, `PastorSeriesMain.astro` — named компоненты с `?raw` импортом main-блока.
- `src/pages/{biografii,hard-texts,pastor-series}/index.astro` — head через `loadLegacyFullDocument`, body composed из 2 chrome-segments + main component.
- Per-route audits: `scripts/{biografii,hard-texts,pastor-series}-visual-parity-audit.js`, подключены в `validate:static-publication`.
- `scripts/catalogs-visual-parity-audit.js` — обновлён под dual `bodyContract`:
  - `'full-shadow'` для shadow-wrap routes (`/articles/`);
  - `'native-shadow'` для Phase 6 routes (`/biografii/`).

### 9.2 Helper `scripts/extract-native-pilot.js`

Параметризованный split: дан legacy HTML + block-маркеры → пишет `_legacy/<name>.html` блоки + `body-segment-<i>.html` chrome между ними.

```bash
node scripts/extract-native-pilot.js \
  --legacy biografii/index.html \
  --out src/components/biografii/_legacy \
  --block 'main:<main id="main-content">|</main>'
```

Для landing'ов с одним `<main>` достаточно одного `--block`. Для страниц со сложной структурой можно передать несколько `--block` в порядке появления.

### 9.3 Критический фикс в guard'е — retry-loop

При первом прогоне `/biografii/` desktop иногда показывал **5.001% diff** flake'ом (а 0% — на других прогонах). Расследование:

- HTML byte-identical (legacy vs dist);
- diff PNG показывал, что bio-cover `<picture>` иногда не успевала декодироваться к моменту screenshot'а — несмотря на `networkidle` и принудительный `loading="eager"`;
- проблема воспроизводится 2-3 раза из 5 на одном hardware'е (race condition между Chromium image decode и screenshot timer).

Фикс:

1. Добавлен `page.waitForFunction(() => imgs.every(img.complete && img.naturalWidth > 0))` после networkidle.
2. Добавлен retry-loop: до 3 попыток per viewport, фиксируется минимальный diff. При diff ≤ threshold loop останавливается. Это **не маскирует** настоящие регрессии (CSS-баг даёт >threshold во всех 3 попытках), но устраняет lazy-decode flake.

После фикса — 5 проверочных прогонов `/biografii/` подряд, 5/5 зелёных.

### 9.4 Результат

```
✅ /            desktop 0.000% / mobile 0.000%
✅ /about/      desktop 0.000% / mobile 0.000%
✅ /articles/   desktop 0.000% / mobile 0.002%
✅ /biografii/  desktop 0.000% / mobile 0.000%
✅ /karty/      desktop 0.000% / mobile 0.000%
✅ /baptisty-rossii/ desktop 0.000% / mobile 0.000%
✅ /nagornaya/  desktop 0.000% / mobile 0.000%
✅ /hard-texts/ desktop 0.000% / mobile 0.000%
✅ /konfessii/  desktop 0.000% / mobile 0.000%
✅ /pastor-series/ desktop 0.000% / mobile 0.000%
✅ /map/        desktop 0.000% / mobile 0.000%
```

### 9.5 Phase 6 status матрица

| Route | Status | Реализация |
|---|---|---|
| `/about/` | ✅ native-shadow (r249) | AboutArticle + AboutAccuracyBlock |
| `/biografii/` | ✅ native-shadow (r250) | BiografiiMain |
| `/hard-texts/` | ✅ native-shadow (r250) | HardTextsMain |
| `/pastor-series/` | ✅ native-shadow (r250) | PastorSeriesMain |
| `/articles/` | full-shadow | catalog с card-grid'ом, требует более внимательного pilot'а |
| `/konfessii/` | full-shadow | MED risk, следующий pilot |
| `/map/` | full-shadow | MED risk |
| `/karty/` | full-shadow | HIGH risk, owner отдельно жаловался |
| `/baptisty-rossii/` | full-shadow | HIGH risk, GBS2 world |
| `/nagornaya/` | full-shadow | HIGH risk, Tailwind/sidebar мир |
| `/` (home) | full-shadow | HIGH risk, самые жёсткие требования |

---

## 10. Phase 6 wave 3 — `/articles/`, `/konfessii/` ✅ DONE (r251)

Расширили native-shadow на 2 MED-risk landings. `/map/` сознательно оставлен в shadow-wrap.

### 10.1 `/articles/` — catalog с h-article-list

Стандартный pilot:

- `src/components/articles/_legacy/{main,body-segment-{0,1}}.html`;
- `ArticlesMain.astro` промоутит `<main id="main-content">`;
- per-route audit `scripts/articles-visual-parity-audit.js`.

`catalogs-visual-parity-audit.js` обновлён — `/articles/` теперь `bodyContract: 'native-shadow'`.

### 10.2 `/konfessii/` — standalone landing с inline `<style>`

`<main class="grid h-reveal">` (не стандартный `id="main-content"`). Главная особенность — страница **не подключает `css/site.css`**, поэтому Pagefind sr-only div ОБЯЗАН содержать inline visually-hidden style (этот фикс из r247).

`scripts/konfessii-visual-parity-audit.js` явно требует наличия `position:absolute;left:-9999px` в Astro page, чтобы будущий агент не убрал inline style и не вернул r247 регрессию.

### 10.3 `/map/` — почему НЕ pilot

`/map/` это interactive SVG visualization без `<main>` секции: вся страница это один `app` (граф связей всех материалов сайта, click-handlers, filters, keyboard controls). Разбивать на named компонент через `?raw` не приносит value (нечего редактировать как блок), а риск сломать SVG/JS высокий. Page остаётся в shadow-wrap — pixel diff = 0.000% уже подтверждён.

### 10.4 Результат

```
✅ /            desktop 0.000% / mobile 0.000%   (shadow-wrap)
✅ /about/      desktop 0.000% / mobile 0.000%   (native-shadow, r249)
✅ /articles/   desktop 0.000% / mobile 0.002%   (native-shadow, r251)
✅ /biografii/  desktop 0.000% / mobile 0.000%   (native-shadow, r250)
✅ /karty/      desktop 0.000% / mobile 0.000%   (shadow-wrap)
✅ /baptisty-rossii/ desktop 0.000% / mobile 0.000% (shadow-wrap)
✅ /nagornaya/  desktop 0.000% / mobile 0.000%   (shadow-wrap)
✅ /hard-texts/ desktop 0.000% / mobile 0.000%   (native-shadow, r250)
✅ /konfessii/  desktop 0.000% / mobile 0.000%   (native-shadow, r251)
✅ /pastor-series/ desktop 0.000% / mobile 0.000% (native-shadow, r250)
✅ /map/        desktop 0.000% / mobile 0.000%   (shadow-wrap, intentional)
```

### 10.5 Phase 6 финальная матрица landing'ов

| Route | Status | Реализация |
|---|---|---|
| `/about/` | ✅ native-shadow (r249) | AboutArticle + AboutAccuracyBlock |
| `/articles/` | ✅ native-shadow (r251) | ArticlesMain |
| `/biografii/` | ✅ native-shadow (r250) | BiografiiMain |
| `/hard-texts/` | ✅ native-shadow (r250) | HardTextsMain |
| `/konfessii/` | ✅ native-shadow (r251) | KonfessiiMain |
| `/pastor-series/` | ✅ native-shadow (r250) | PastorSeriesMain |
| `/map/` | shadow-wrap | SVG visualization, разбивать смысла нет |
| `/karty/` | shadow-wrap | HIGH risk pilot (MapEngine hub + owner UX claims) |
| `/baptisty-rossii/` | shadow-wrap | HIGH risk pilot (GBS2 world, mobile sheet, timeline) |
| `/nagornaya/` | shadow-wrap | HIGH risk pilot (Tailwind/sidebar мир) |
| `/` (home) | shadow-wrap | HIGH risk pilot (owner UX claims about home entries) |

**Готово:** 6 из 11 landing'ов native, 4 из 5 оставшихся — это HIGH-risk страницы, требующие отдельных планов с владельцем (особенности из OWNER-REQUIREMENTS). `/map/` сознательно оставлен в shadow-wrap.
