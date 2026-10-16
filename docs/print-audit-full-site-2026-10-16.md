# Печать всего сайта: сплошной прогон 2026-10-16

Сплошная проверка печатной проекции всех опубликованных маршрутов после
точечных правок печати (карты, римские цифры, печать примечаний). Документ
фиксирует протокол, семантику ворот, найденные дефекты, их корневые причины и
остаточные пробелы — чтобы следующий прогон не начинался с нуля.

## 1. Протокол

Маршруты берутся из собранного `dist/` (`os.walk`, 104 маршрута). Для каждого
маршрута прогон `reports/print-audit.mjs` делает две печати — с JS и без JS —
и сравнивает текст PDF (pypdf) с DOM в медиа `print`:

| Метрика | Что означает |
| --- | --- |
| `pages`, `chars` | страницы и символы PDF (JS / no-JS) |
| `ratio` | `chars_js / chars_nojs` — JS не должен терять текст относительно no-JS |
| `visibleChars` | текст, видимый в печатной проекции (DOM, медиа `print`) |
| `coverage` | `chars_js / visibleChars` — что видно на бумаге из видимого в проекции |
| `screenVisibleChars`, `screenCoverage` | текст, видимый на экране до печати, и его доля в PDF |
| `headings`, `missing` | видимые заголовки и те, которых нет в PDF |

Ворота (три контракта, зашиты в `reports/print-audit.mjs`):

* **text** — статья: ни один видимый заголовок не потерян, `coverage ≥ 0.9`,
  `screenCoverage ≥ 0.85`.
* **app-shell** — у страницы нет текстовой проекции статьи (`/map/` печатает
  собственный список атласа): проверяется, что JS не теряет текст относительно
  no-JS (`ratio ≥ 0.9`), PDF не пуст и нет JS-ошибок.
* **map-only** — живая карта без статической проекции (`/karty/ishod/`):
  «печатается хотя бы страница», остальное — открытый контентный пробел.

Команда: `ROUTES="$(python3 -c "import json;print(';'.join(json.load(open('/tmp/all-routes.json'))))")" node reports/print-audit.mjs`
(104 маршрута, ≈ 8 минут).

## 2. Исправления самого аудита (ложные срабатывания)

Первый сплошной прогон дал `ok=97 failed=7`. Четыре из семи «пропавших»
заголовков в PDF **были** — их терял не сайт, а сопоставление текста:

* **лигатуры**: pypdf отдаёт `ﬁ` (U+FB01) и `ﬀ` (U+FB00), поэтому
  `primary-verified`, `Official` не находились (`primaryveriﬁed`, `oﬀicial`);
* **разрывы строк и ячеек таблиц**: «Соборы в Гиппоне и Карфагене» печатается
  двумя ячейками, «Путь Авраама אַבְרָהָם אָבִינוּ» переносится по строкам —
  сплошной подстроки в PDF нет, слова есть все;
* **маркер сноски, приклеенный к слову** (`…традиции.14`) и служебная аннотация
  `⟦сноска: …⟧`, которую печатный рантайм добавляет для скринридеров и на бумагу
  не выводит.

Поэтому в аудите: лигатуры сворачиваются перед сравнением, заголовок считается
напечатанным, если в PDF есть он целиком **или** все его слова (длиной > 1),
маркеры сносок и `⟦…⟧` из текста заголовка удаляются на этапе сбора. Порог не
ослаблен: маска терминальной печати, из-за которой пропадали шаги `/app/`,
удаляла **все** слова заголовка одновременно, и такой случай по-прежнему падает.

## 3. Настоящие дефекты и их корневые причины

| Маршрут | Симптом | Корневая причина | Исправление |
| --- | --- | --- | --- |
| `/app/` | в PDF нет шагов 02–04 («Вспоминайте», «Разбирайте») | `resolveRoot()` в `js/reader-preferences-head.js` принимал за корень чтения карточку `<article class="app-flow-item">` (селектор-fallback `article`), а `scope = root.parentElement` позволял печати помечать соседей; правило `[data-print-terminal-follower]{display:none}` их удаляло (15 узлов) | общий селектор годится в корень только если он единственный и держит ≥ 50 % текста `<main>`; иначе поиск продолжается и корня нет |
| `/articles/kod-da-vinchi/` | пропали «Примечания» (5 007 симв.) | общая маска снимала `.gb-note-endnotes[data-print-policy="include"]`, хотя `src/runtime/note-registry.css` уже объявляет их печатными | узлы под `[data-print-policy="include"]` больше не помечаются follower-маской |
| `/hard-texts/…-enohu-kanonicheskiy-audit/` | вторая строка заголовка начинала следующий лист | не было правила о неразрывности заголовков | `html body h1..h4 { break-inside: avoid-page }` в печатном блоке рантайма |
| `/hard-texts/genesis-6/`, `/rodosloviye/`, `/journal/`, `/journal/dossiers/g3/` | та же маска прятала 302–4 245 символов карточек | тот же `resolveRoot()` | то же исправление |
| `/konfessii/russkij-baptizm/` | печать с JS отдавала только hero (1 стр./486 симв.), 17 разделов истории отсутствовали | контент живёт в `<iframe>`, а Chromium не пагинирует фреймы | текст фолбэка вынесен в `Baptizm3DStaticProjection.astro`; та же разметка печатается как проекция, когда страница живая (`html.app-live`); печатный блок снимает фиксированную высоту оболочки |
| `/map/` | ворота не могли измерить покрытие (нет текста статьи) | страница печатает собственный список атласа (9 стр./8 609 симв.) | введён контракт **app-shell**: JS не должен терять текст относительно no-JS |

SHAs: `0b154d7` — корень чтения и приоритет print-policy; `d0d3ef6` — заголовки
не разрываются; `84d6845` — печатная проекция 3D-карты.

## 4. Результат

* Итоговый сплошной прогон: **104 маршрута, ok=104, failed=0** (было 97/104).
* Контрольные маршруты: `/app/` 1 стр./2 547 симв. → 7 стр./3 177;
  `/hard-texts/genesis-6/` 1/2 547 → 6/3 636; `/articles/kod-da-vinchi/`
  29 стр./49 617 (примечания на месте); `/karty/avraam/` 5 стр./11 444;
  `/konfessii/russkij-baptizm/` 1/486 → 1/1 006 (js/nojs = 1);
  `/karty/ishod/` 1 стр./892 симв. (было пусто).
* Экран не изменился: `reports/print-fix-screen-check.mjs` — 6/6, axe 0,
  битых изображений 0, консольных ошибок 0; `reports/konf-screen-check.mjs` —
  проекция `display:none`, iframe 1240×835 / 390×779, `docScroll === innerHeight`.
* Локальный аналог CI: `node scripts/audit-pro.js` → ✅ AUDIT PASSED;
  `npm run cache-bust` (readonly) — чисто.

## 5. Остаточные пробелы (не потеря печати, нужен владелец)

* **Испорченный исходный текст серии «Баптисты России»**: 9 маршрутов,
  31 заголовок с `?`-масками (`iniciativnaya-gruppa` 6, `podpolnaya-pechat` 6,
  `peterburgskaya-liniya` 5, `noch-na-kure` 3, `spravochnik` 3,
  `yuzhnaya-shtunda` 3, `dva-sezda-1884` 2, `vsehib-1944` 2,
  `goneniya-i-sovest` 1). Печатается ровно то, что стоит в исходнике;
  восстановление — по `audit/BAPTISTY-MOJIBAKE-RECOVERY-PACK-2026-10-13.md`
  (уровень A — метаданные Commons; из песочницы недоступно, нужен владелец).
* **`/karty/ishod/`**: живая карта без статической текстовой проекции —
  `gate:'map-only'`, содержимое существует только как SVG-подписи. Честное
  решение (проекция из `karty/ishod/route.json`) остаётся за владельцем.

## 6. Воспроизведение

```
npm ci
npm i --no-save @sparticuz/chromium playwright-core @achingbrain/nss   # браузер песочницы
npm run strangler:build:production-like
export CHROME_PATH=/tmp/chrome-gl.sh LD_LIBRARY_PATH=/tmp:$PWD/node_modules/@achingbrain/nss/linux \
       LD_PRELOAD=/tmp/nss_stub.so VK_ICD_FILENAMES=/tmp/vk_swiftshader_icd.json
ROUTES="/app/;/articles/kod-da-vinchi/" node reports/print-audit.mjs
node reports/print-fix-screen-check.mjs
```

Пробники лежат в `reports/` (каталог вне git): `print-audit.mjs`,
`print-loss-explain.mjs`, `print-triage.mjs`, `app-flow-geom.mjs`,
`why-hidden.mjs`, `terminal-seal-probe.mjs`, `konf-screen-check.mjs`.

## 7. Follow-up: красные CI, вскрытые этим раундом

Сплошной прогон печати не единственная проверка, которая смотрит на эти файлы.
После правок CI дал три новых красных (на предыдущем tip их не было) — все три
разобраны и закрыты, потому что «зелёный печатный прогон при красном CI» — это не
готовый результат.

| Проверка | Что случилось | Корневая причина | Исправление |
| --- | --- | --- | --- |
| Route Registry Validators → `public-surface-browser-matrix` | `I15 native: SEO fallback отсутствует внутри noscript` | инвариант искал текст фолбэка **литералом внутри `<noscript>`**, а текст переехал в `Baptizm3DStaticProjection.astro` (рендерится дважды: noscript + печатная проекция) | инвариант проверяет компонент и оба его подключения, плюс новые утверждения о печатной проекции: один источник текста, `data-print-static-projection` + `data-pagefind-ignore`, `display:none` на экране и раскрытие только у `html.app-live`. Проверка стала строже, а не мягче: `npm run konfessii:audit` с `REQUIRE_DIST=1 REQUIRE_BROWSER=1` проходит локально, включая браузерную матрицу |
| Scripture Occurrence Index Contract | `generated index is stale or nondeterministic` | новый файл фолбэка вошёл в корпус: `scannedSourceFiles` 509 → 510, а `data/scripture-search-index.json` коммитится и сверяется байт-в-байт | индекс пересобран `--write`; ссылок и вхождений не прибавилось (1222 / 3071) |
| Search Scripture Occurrence Runtime | падал на шаге `build-scripture-occurrence-index.mjs --check` в «Validate source contracts» | тот же stale-индекс | тот же |

Замечание по процессу: коммит с расширением инварианта I15 (`fba6d52`) получил
испорченное сообщение — heredoc в одной команде съел текст второго сообщения,
а коммит уже был отправлен; перезапись истории (force push) запрещена правилами
сессии, поэтому содержание коммита описано здесь и в PR. Содержимое коммита —
только `scripts/konfessii-map-audit.js` и корректно.

## 8. Раунд 3: статическая печатная проекция `/karty/ishod/` (MAP-ONLY закрыт)

### Что было

`/karty/ishod/` держал последний остаточный тег отчёта — `gate=map-only`:
страница печатала **1 страницу / 892 символа** (проба `ROUTE=/karty/ishod/ node
reports/karty-print-verify.mjs` → `pdf 1 892`, `print sheets []`), а читатель без
JavaScript получал только короткий аварийный блок. Причина не в движке: движок,
регистратура и привязка `archaeologyMapId="ishod"` были уже подключены
(проекция строится, 2 411 B, `mapCards: 1`, claim `exodus-route-context`). Не
хватало того, что есть у `/karty/avraam/`: авторской статической текстовой
секции `section.sr-only.map-text-fallback[data-map-static-projection]`, которую
`MapRuntimeFallback` показывает в печати и прячет на экране.

### Что сделано

* `src/components/karty/ishod/IshodStaticProjection.astro` — текстовая версия
  маршрута; смонтирована в `IshodMap.astro` тем же контрактом, что у Авраама
  (`data-pagefind-body`, `aria-label`, релиз `body:has(.map-text-fallback.sr-only)`
  + `@media print` из `MapRuntimeFallback`).
* Проекция строится из тех же данных, что читает рантайм
  (`karty/ishod/route.json` + `karty/ishod/pihahiroth-authority.json`) и повторяет
  его преобразования, поэтому не может «досочинить» содержание: наложение
  authority-панели на историческую запись `pihahiroth`, коридоры неопределённости
  вместо исторических вариантов локализации, снятие точки `wp-suez`, `signature`
  не печатается.
* `forbiddenRuntimeClaims` применены и к бумаге: ни один запрещённый фрагмент не
  попадает в разметку проекции (проверено: 0 вхождений в dist), текст при этом не
  подменяется — в конце проекции сказано, что такие фрагменты остаются в
  интерактивной панели. Данные не «вычищены» сознательно: `route.json` —
  историческая запись, её неизменность зафиксирована релизным контрактом
  (`scientific_variants.pihahiroth` с «Нувейба» — контрольная точка), а живой
  рантайм применяет тот же фильтр к панели Пи-Гахирофа.
* Заголовки мест печатаются по-русски, оригинальные формы (иврит/транслит) идут
  следующей строкой `Оригинал:` — RTL-строка внутри заголовка ломала сверку с
  PDF и читалась бы как «Раамсес (…; Раамсес)».
* Проза маршрута хранится HTML-фрагментами: любой тег приводится к границе слова
  (по данным теги не разрывают слов — проверено), иначе печать давала
  `…мужчин».ИСХОД 12:37` вместо отдельного фрагмента ссылки.

### Дельта по отчёту

| | было | стало |
| --- | --- | --- |
| `/karty/ishod/` JS | 1 стр. / 892 симв. | **7 стр. / 15 805 симв.** |
| `/karty/ishod/` no-JS | аварийный блок | 7 стр. / 18 571 симв. |
| gate | `map-only` | **`text`** (coverage 1.0, headings 17, missing 0) |
| строка `MAP-ONLY` в отчёте | `/karty/ishod/` | **исчезла** |

Сплошной прогон 104 маршрутов — `PRINT-AUDIT routes=104 ok=104 failed=0`
(417 s), лог `reports/print-audit/sweep-104-final-ishod.log`. Сравнение с
эталоном `/karty/avraam/`: 5 стр. / 11 444 симв. (не изменилось).

### Гейты (локально)

* `npm run astro:audit:ishod:no-build` — PASS; добавлено 4 проверки: проекция есть
  в `dist` и в компоненте, заголовок маршрута на месте, authority-врезка
  совпадает со строкой, которую подставляет рантайм (дрейф одного места без
  другого теперь валит гейт).
* `map-archaeology-projection-contract-test.mjs` PASS (13 runtimeScopes / 13
  runtimeCards / 40 источников), `map-archaeology-source-registry-audit.js` PASS,
  `map-archaeology-category-coverage-audit.js` PASS (0 problems),
  `avraam-static-projection-witness.mjs` PASS (5 записей),
  `map-archaeology-projection-browser-test.mjs` PASS (`directEngine`, `mapCards`,
  `placeCards`, errors 0).
* Браузерная проверка `reports/ishod-screen-quality.mjs` — 4 профиля (экран
  светлый/тёмный, мобильный тёмный, печать): 0 нарушений axe, 0 ошибок консоли,
  0 битых изображений, шрифты загружены; на экране проекция занимает 1×1 (места не
  занимает), в печати 900×5708.
* `node scripts/audit-pro.js` ✅, `npm run cache-bust` — без изменений,
  `build-scripture-occurrence-index.mjs --check` — актуален.

### CI-следствие

Новый компонент вошёл в корпус мест Писания: `data/scripture-search-index.json`
пересобран штатным `--write` (`scannedSourceFiles` 510 → 511; 1222 ссылки,
3071 вхождение, 94 маршрута) — без этого краснели Scripture Occurrence Index
Contract и Search Scripture Occurrence Runtime.

### Уточнение метрики SOURCE-DAMAGE

Харнесс различает два счётчика, и в отчётах фигурировали оба:

* `damaged` — заголовок с `??`, которого **нет** в PDF: 3 заголовка на 2
  маршрутах (`/baptisty-rossii/podpolnaya-pechat/` 2, `/baptisty-rossii/vsehib-1944/` 1)
  — ровно то, что было записано в §4/§5;
* `sourceMasked` — **любой** заголовок с `??`, видимый в печатной проекции: 31
  заголовок на 9 маршрутах `/baptisty-rossii/*`.

Расширение списка — не рост потерь: `ok=104` в обоих прогонах, а испорченный
текст — это исходник (`src/components/baptisty-rossii/*.astro`; инвентарь —
`audit/BAPTISTY-MOJIBAKE-RECOVERY-PACK-2026-10-13.md`), а не печать. Отчёт печатает
расширенный инвентарь, чтобы испорченные заголовки не оставались вне поля зрения.

### Осталось владельцу

1. Восстановить испорченные `?`-фрагменты в 9 компонентах `/baptisty-rossii/*`
   (текст потерян в исходнике; придумывать его агент не имеет права).
2. Низкоприоритетный класс обрезки `div.ctw-body { overflow:auto }` (таблица
   «Гиппон/Карфаген» печатается целиком, слова находятся на странице — это
   порядок извлечения PDF, не потеря).
