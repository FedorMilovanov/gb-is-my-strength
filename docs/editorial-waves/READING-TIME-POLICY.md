# Единая политика времени чтения (решение владельца)

**Решение:** одна политика для всего сайта — **180 русских слов в минуту, округление вверх, минимум 1 минута**.
**Статус:** политика принята и зашита в код; массовое применение значений — отдельным шагом, чтобы не столкнуться с параллельными ветками.
**Ветка:** `arena/4786e4e2-gb-is-my-strength`.

## 1. Где живёт правило

`scripts/lib/reading-time-policy.js` — единственное место с числом `180` и правилами подсчёта:

- `readerWordCount(mdxSource)` — читательские слова;
- `minutesForWords(words)` — `max(1, ceil(words / 180))`;
- `impliedWpm(words, minutes)` — какая скорость на самом деле заложена в текущем значении.

Второго независимого источника значений нет: скрипт ничего не хранит, он вычисляет то, что должно стоять в существующих SSOT.

## 2. Что считается читательским текстом

Считается: видимый текст тела — абзацы, заголовки, подписи, цитаты, списки, таблицы, видимый текст инлайн-кнопок ссылок (`Исх. 20:12`), инлайн-код внутри предложения.

Не считается: YAML frontmatter, MDX-комментарии `{/* … */}`, HTML-комментарии, имена тегов и все атрибуты (`class`, `id`, `data-ref`, `src`, `href`), блоки `<script>/<style>/<template>`, огороженный код ```…```, строки `import`/`export`, скрытые элементы (`hidden`, `aria-hidden="true"`, `display:none`, `sr-only`/`visually-hidden`) и `<details>` (закрыты по умолчанию).

## 3. Карта поверхностей, где сейчас лежит «N мин»

| # | Поверхность | Роль | Кто обновляет |
|---|---|---|---|
| 1 | `src/content/articles/*.mdx` → `readingTime` | SSOT статьи | `reading:time:audit --write` |
| 2 | `data/series.json` → `parts[].readingTime` | SSOT серии | `reading:time:audit --write` |
| 3 | `src/components/article-pilots/_shared/series/*.ts` → `readingTime: 'N мин'` | витрина серии | `reading:time:audit --write` (строчно, по slug) |
| 4 | `data/search-manifest.json` → `readTime` | поиск | существующий `search-manifest-policy-normalizer` |
| 5 | `data/links-graph.json` → `readTime` | граф связей | `links-graph-read-time-normalizer --write` |
| 6 | `js/search.js` → аварийные рекомендации | офлайн-фолбэк | страж `search-js-fallback-read-time-drift` |
| 7 | legacy-зеркала `articles/*/index.html` | исторические маршруты | только для маршрутов, где зеркало признано авторитетным |

Для маршрутов strict-native (в том числе вся teen-series, включая Companion C) legacy-зеркала отсутствуют: `routeProfile` показывает `legacyStatus: absent`, `mdxStatus: canonical`, `metadataSourceMode: content-frontmatter`. Поэтому изменение frontmatter там не ломает HTML-оракул — страница собирается из MDX.

## 4. Механизм

```bash
node scripts/reading-time-audit.js            # проверка (exit 1 при расхождении)
node scripts/reading-time-audit.js --list     # весь список расхождений
node scripts/reading-time-audit.js --json     # машинный отчёт
node scripts/reading-time-audit.js --write    # переписать SSOT из расчёта
node scripts/reading-time-audit.js --write --only sovershennoletie-roditelskaya-vlast-chto-menyaetsya
```

Свойства механизма: детерминированный (тот же MDX → то же число), идемпотентный (повторный `--write` ничего не меняет), без ручных правок значений, с явными исключениями.

Исключения на запись:

- `serdce-spravochnik` — файл в открытом PR другого агента (`WRITE_SKIP`);
- 6 файлов Gill-серии — тело живёт в Astro-компонентах (`GillPart1…/GillPart1Section*.astro`), MDX содержит только метаданные. Для них скрипт резолвит страницу → каталог пилота → секционные компоненты (кроме `PageHead`/`PageChrome`), считает слова и показывает результат как **справку** (`advisory`), но не переписывает: автоматическая запись по компонентному телу требует отдельного решения;
- записи `data/series.json` без MDX — `no-mdx`, только справка.

## 5. Замер на сегодня (`--check`)

- статей MDX: 70; соответствуют политике: **2**; требуют пересчёта: **62**; тело вне MDX (только справка): **6**;
- `data/series.json`: 54 записи, расходятся **52**;
- производные поверхности: `search-manifest` — 51, `links-graph` — 10, витрины серий `*.ts` — 3, `js/search.js` — 3;
- фактическая скорость, заложенная в текущих значениях: от **39** до **253** слов/мин (`yuzhnaya-shtunda` 783 слова при 20 мин = 39; `anatomiya-padeniya-pyat-stadiy` 2198 слов при 9 мин = 244). Это и есть та неоднородность, из-за которой понадобилось решение;
- справка по компонентным статьям Gill: 155–208 сл/мин у пяти частей и 58 у `dzhon-gill-chast-4-ekzeget` — сигнал, что в этой части читательский объём распределён иначе (крупные таблицы/цитаты), а не что её надо сокращать втрое.

## 6. Почему массовый пересчёт не влит этой же волной

1. **Параллельные ветки.** Семь `origin/arena/*` одновременно правят те же MDX, `data/series.json` и витрины серий. Перезапись 62 frontmatter-значений и 46 записей серии в общей волне даст конфликты именно в тех файлах, которые другие агенты переписывают целиком.
2. **Порядок пересборки.** Значения SSOT должны дойти до производных поверхностей (`search-manifest`, `links-graph`, `js/search.js`) и до HTML, иначе `data:consistency` покажет дрейф между manifest и HTML на авторитетных маршрутах. Это одна связная операция на всю репозиторию, а не редакторская правка одной статьи.
3. **Приоритет.** Решение владельца: политика — второстепенная задача, главное — литературное качество и достоверность. Поэтому волна 14 осталась редакторской, а политика зафиксирована кодом и этим документом.

## 7. Точная последовательность применения (одна операция, отдельный коммит)

```bash
# 1. SSOT: MDX + data/series.json + витрины серий + js/search.js
node scripts/reading-time-audit.js --write
# 2. HTML и pagefind-мета из новых значений
npm run astro:build
# 3. поисковый манифест (читает собранный HTML) и граф связей
node scripts/search-manifest-policy-normalizer.js --write --dist dist
node scripts/links-graph-read-time-normalizer.js --write
# 4. стражы и финальная сборка
npm run data:consistency
npm run gill:reading-time:audit && npm run gill:series:data:consistency:audit
npm run strangler:build:production-like
```

Проверка перед коммитом: повторный `node scripts/reading-time-audit.js` должен дать `требуют пересчёта: 0` и `0` по всем четырём производным поверхностям — это и есть доказательство идемпотентности.

Пока этого не сделано, `reading:time:audit` **не входит** в `validate:all`: иначе гейт покраснеет на всей репозитории и заблокирует чужие ветки. Скрипт вызывается вручную и читается как отчёт, а не как блокирующий страж.
