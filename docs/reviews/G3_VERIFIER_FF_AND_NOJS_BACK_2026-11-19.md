# G3 / Journal — независимая проверка перемотки и no-JS Back (19.11.2026)

```md
Mode: LANE (read-only verification, docs-only evidence)
Lane / owner: Независимый проверяющий, Arena-сессия `arena/29aa651f-gb-is-my-strength` (новый агент, без роли в Product)
Purpose and bounded scope: (1) GO/NO-GO на перемотку canonical `lane/journal-editorial-premium-20261118` до выбранного №8;
                           (2) root cause открытого W1-блокера «no-JS hash → статья → Back»
Base / rollback SHA: main 9edef94ece08012223c1364bec7ddcd561cf5713
Anchors: canonical #2338 b2ae614730b0c2e164d3b07453797074253d9698 · №8 36e69c4d822f752d4f99914a55a6de798f7164e3 · №1 8bccc701de78f53b1546672e0104c4b652745702
Allowed files: только этот отчёт и docs/reviews/g3-verifier-2026-11-19/** (lab + raw results)
Adjacent active work / overlap: #2338, #2339, #2340, #2341, #2343, #2345 — не изменялись; Product/shared/scripts/CI/Research не изменялись
Source of truth: exact SHA выше, собственные сборки
```

**Не merge.** Это evidence-пакет для MAX/владельца, а не кандидат в Product. В чужие ветки ничего не писалось, комментариев в PR нет.

## 0. Коротко

| Вопрос | Вердикт |
|---|---|
| Перемотка `b2ae614` → `36e69c4` | **Технически GO.** Это чистая fast-forward перемотка: `b2ae614` — предок `36e69c4`, +23 коммита, 0 расхождений. Selective-transfer пакет и манифест не нужны |
| Кто может её выполнить | Только владелец: Arena-агенты (включая №1, №8 и меня) не могут писать в чужие ветки. Отсюда `BLOCKED_CANONICAL_WRITE` у всех |
| Что требует решения владельца до merge в main | (а) смена навигации сайта на `/articles/`; (б) политика no-JS Back |
| no-JS Back | **CONFIRMED-CURRENT**, но это **не** «нативное поведение браузера». Триггер — сочетание новых якорных ссылок и общего `html{scroll-behavior:smooth}` из `css/site.css`. С JS возврат точный (Δ=0) во всех сценариях |

Команда для перемотки (только fast-forward, без переписывания истории; выполняет владелец):

```sh
git push origin 36e69c4d822f752d4f99914a55a6de798f7164e3:refs/heads/lane/journal-editorial-premium-20261118
```

Draft #2338 при этом не сливается и не публикуется. Зато 22+ канонических workflow впервые прогонятся на **новом** интерфейсе: нынешние зелёные проверки относятся к `b2ae614`.

## 1. Проверка перед перемоткой (`36e69c4` против `b2ae614`)

Обе ревизии собраны с нуля: `npm ci`, `strangler:build:production-like`, `pagefind:build:dist`. Node 22.23.5 (`engines` требует ≥22.23.4).

| Проверка | `36e69c4` |
|---|---|
| production-like build + Pagefind | exit 0 (у `b2ae614` тоже) |
| Собственные тесты ветки | `journal-document-metadata-test` 17/17 · `journal-editorial-transfer-test` 34/34 · `articles-editorial-contract-test` 64/64 · `journal-editorial-contract` PASS (37 абзацев без изменений, 16 утверждений / 21 источник, история HOLD) · `articles-editorial-contract` PASS · `seo-route-contract-test` PASS (112 маршрутов) · `validate` PASS · `dist-publication-audit --require-pagefind` PASS |
| **Утечка истории на HOLD** (`lab/holdscan.mjs`) | **0 совпадений** в 878 файлах dist, включая распакованные фрагменты Pagefind: маршрут `/journal/dossiers/g3/history`, заголовок рукописи, `G3-HIST-PUB-*`, заголовки разделов, все 20 URL из `g3HistoryDraftSources.ts`. Единственное совпадение «Pray’s Mill» — в уже опубликованном досье, оно есть и в `main` |
| Набор маршрутов | 117 HTML = 117, список идентичен |
| sitemap.xml / robots.txt / llms.txt | идентичны |
| feed.xml | отличается только `lastBuildDate` |
| Изменённые файлы dist | ровно 3 страницы (`/articles/`, `/journal/`, `/journal/dossiers/g3/`), CSS журнала и новый CSS каталога. Общие CSS/JS, шрифты, SW, изображения **не меняются** |
| Метаданные (`lab/pagediff.mjs`) | `/journal/`: убраны `article:published_time/modified_time` у CollectionPage, добавлены `og:image:alt`/`twitter:image:alt`; досье: добавлены alt. Типы JSON-LD не изменились |
| Браузер (`lab/surface.mjs`, Chromium 153, 320/390/768/1440/1920 × светлая/тёмная) | горизонтальное переполнение 0; битых внутренних ссылок 0 (93/5/5); отсутствующих ресурсов 0; **axe WCAG 2.2 AA: 0 нарушений** (390/1440 × 2 темы × 3 страницы). Одна ошибка консоли `ERR_CONNECTION_CLOSED` — внешний ресурс, отрезанный песочницей, одинаково в обеих сборках |

### Решения владельца (не дефекты)

1. **На `/articles/` меняется навигация сайта** (`lab/nav.mjs`). В `b2ae614` шапка такая: Публикации · Разбор заблуждений · Биографии · Все статьи · О проекте. В `36e69c4` это шапка Журнала: логотип ведёт на `/journal/`, дальше «Основной сайт ↗» · Журнал · Досье и исследования · Богословские статьи · Об издании. Ссылки на `/app/` («Приложение») на странице больше нет. Все 80 статей и 10 серий на месте. Главный каталог сайта становится частью «Журнала» — это нужно явно одобрить.
2. В 23 коммитах есть около 150 строк исходников истории на HOLD (`g3HistoryDraftSources.ts`). В dist они не попадают, маршрута нет, такая рукопись уже лежит в `b2ae614`.

## 2. no-JS Back: причина

Сценарий: `/articles/` → клик по якорю → последняя статья раздела → «Назад». Сервер статический, заголовки как у GitHub Pages (`cache-control: max-age=600`), SW заблокирован.

**Матрица на `36e69c4`** (`lab/back-lab.mjs`, `results/back-matrix-36e69c4.json`; 2 ширины × hash/без hash × JS вкл/выкл × BFCache-флаг): провал **только** при «hash + JS выключен». 390: 24610 → 969; 1440: 11192 → 712; фокус `SECTION#catalog-materials`. Это совпадает с цифрами №1. Остальные 12 комбинаций дают Δ=0.

**BFCache в автоматизированном Chromium не включается**, даже если убрать `--disable-back-forward-cache`. CDP `Page.backForwardCacheNotUsed` отвечает `BackForwardCacheDisabledForDelegate` и `BrowsingInstanceNotSwapped`. Утверждения про BFCache тестами Playwright ни доказать, ни опровергнуть.

**Изоляция** (`lab/make-variants.py`, `lab/variant-lab.mjs`, 390, переход через hash; Product не меняется — варианты подставляются сервером):

| Вариант | без JS | с JS | Вывод |
|---|---|---|---|
| v0 оригинал | −23641 | 0 | воспроизведено |
| v2 оригинал без `<script>` | −23641 | **−23641** | точный возврат с JS даёт скрипт продукта (`js/reader-state.js` — единственный кандидат с логикой скролла), а не браузер |
| v1 без `tabindex=-1` | −23641 | 0 | tabindex влияет только на фокус |
| v3 синтетика: тот же якорь, 90 пунктов, без CSS | **0** | 0 | у Chromium нет такого бага на простой странице |
| v5 синтетика + `tabindex=-1` | 0 | 0 | — |
| **v9 синтетика + `html{scroll-behavior:smooth}`** | **−20846** | **−20846** | **одной строки `smooth` достаточно для воспроизведения** |
| v10 v9 + `scroll-margin-top` | −20910 | −20910 | — |
| v8 оригинал + `prefers-reduced-motion: reduce` (выключает `smooth` из `site.css`) | 0 | 0 | — |

Диагностика по времени (`lab/diag.mjs`): при `smooth` позиция сначала восстанавливается точно (24610 на 63 мс), затем идёт **плавная прокрутка к якорю** до 969 примерно за 1,6 с. Это и есть «прыжок через ~1,6 с», который видел №1.

**Повторяемость, 6 прогонов каждый (Δ после возврата):**

- оригинал: всегда большой прыжок (6/6);
- оригинал + reduced motion: −23641, −205, −205, −205, −23641, −205;
- `auto !important`: −205 ×5, 0 ×1;
- `auto` + без `scroll-margin`: −205 ×5, 0 ×1;
- синтетика: 0 ×6;
- синтетика + smooth: ≈ −17000 ×6 (замер на ~1,1 с, прокрутка ещё шла).

Без `smooth` большой прыжок становится редким, но остаются стабильное смещение около −205 px и гонка между восстановлением позиции и переходом к якорю. **Строгий критерий ≤1 px одной CSS-правкой не выполнить.** Причина смещения −205 px не установлена.

**Масштаб** (`lab/topic-lab.mjs`): на `/articles/` в `36e69c4` 17 якорных ссылок (`#catalog-materials`, `#catalog-series`, 11 × `#catalog-topic-*`, `#razbor`, `#main-content`). В `b2ae614` — только `#main-content`. Рубрика «Биографии служителей»: без JS −1401 (390) / −73 (1440); с JS 0 / 0. Значит, это класс сценариев новой якорной навигации, а не одна кнопка.

### Варианты для решения (за владельцем и №1/№8)

1. **Рекомендую:** записать «hash + JS выключен + Back» как известное ограничение. Строгий критерий ≤1 px оставить для JS-сценариев, где он проходит 16/16. Тест не удалять, а перевести в документированное ограничение с этими доказательствами.
2. Частично: точечно `html:has(.journal-edition--articles){scroll-behavior:auto}` только для `/articles/` (без правки общего `site.css`, это SYSTEM). Большой прыжок станет редким, ~205 px останется. Нужна отдельная проверка на точном SHA.
3. Убрать якорную навигацию рубрик — не рекомендую: это потеря навигации.

Нельзя: добавлять JS-обходы ради no-JS теста или глобально убирать `smooth` из `site.css` без SYSTEM-решения.

## 3. Ограничения

Только Chromium 153.0.8010.0 без окна (`@sparticuz/chromium@153.0.0` + `playwright@1.64.1`). WebKit, Firefox и реальные устройства не проверялись. CLS и PDF не перепроверялись: это уже сделали №1, №4 и №9 на тех же SHA. Node 22.23.5 взят из npm-пакета `node-linux-x64`, потому что системный 22.22.3 ниже `engines`.

## 4. Как воспроизвести

```sh
npm install --prefix /tmp/arena-browser --no-audit --no-fund @sparticuz/chromium@153.0.0 playwright@1.64.1 axe-core@4
# распаковать chromium (Chromium.executablePath()) и bin/al2023.tar.br → /tmp/arena-browser/libs
cp docs/reviews/g3-verifier-2026-11-19/lab/*.mjs /tmp/arena-browser/   # чтобы резолвился playwright
git worktree add --detach /tmp/w8 36e69c4d822f752d4f99914a55a6de798f7164e3   # npm ci + build + pagefind
cd /tmp/arena-browser && LD_LIBRARY_PATH=/tmp/arena-browser/libs/lib node back-lab.mjs /tmp/w8/dist 8791 /tmp/back.json
python3 make-variants.py /tmp/w8/dist /tmp/variants
VARIANT=/tmp/variants/v9-synthetic-smooth.html LD_LIBRARY_PATH=/tmp/arena-browser/libs/lib node variant-lab.mjs /tmp/w8/dist 8792 /tmp/v9.json
```

Переменные: `CHROMIUM_PATH` (по умолчанию `/tmp/chromium`), `AXE_PATH`, `DIST`, `REDUCED=1`. Сырые результаты лежат в `docs/reviews/g3-verifier-2026-11-19/results/`.

## 5. Что могу делать дальше (по заданию MAX)

- Проверить на точном SHA после перемотки: CI #2338 и паритет `lane` с `36e69c4`.
- Независимо принять следующий SHA №8 (например, вариант 2 выше): одна матрица, один GO/NO-GO.
- Проверять W2 (newsroom) только на публичных данных: утечки HOLD, маршруты, sitemap/RSS/Pagefind.
- Не создаю альтернативный дизайн и не пишу в чужие ветки.
