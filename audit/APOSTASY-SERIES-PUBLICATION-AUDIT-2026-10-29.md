# Аудит публикации серии «Отступники» I–V — 2026-10-29

**Режим:** только аудит (реализация — после отдельного слова владельца).
**База:** сессионная ветка `arena/37d28a2c-gb-is-my-strength` от `main@54877be`
(обложки уже в ветке: `7891bf0`, `34cad95`; статьи по-прежнему draft).

## 1. Прочитано

- `docs/ARTICLE-STANDARD-CHARTER.md` — 54 стандарта (S1–S54), предпубликационный
  чек-лист, проверки `editorial:lint` / `sources:hygiene` / `article:qa` /
  `content:parity`.
- `docs/CONTENT-QUALITY-STANDARD.md` — глоссарий, квизы, серии, Писание,
  типографика.
- `AGENTS.md` — lane-записи, защищённые пути, инварианты.
- `docs/SERIES-ENGINE-GUIDE.md` — движок серий: `defineSeriesConfig`,
  `SeriesReaderChrome`, `data/series.json`, гейты `engine:contracts/guard/sweep`.
- `docs/TEEN-SERIES-PUBLICATION-CONTRACT.md` — эталонная публикация серии:
  атомарная транзакция, prev/next, медиапакет, TTS/print/a11y-гейты.
- `docs/OWNER-INVARIANTS.md` — 20 инвариантов (в т.ч. глоссарий и Bible tooltips —
  owner-controlled data; свежесть не подделывается; «Автор-редактор»).
- `audit/BAPTISTY-AND-SERIES-BROWSER-AUDIT-2026-10-13.md` — D-1…D-7.
- `audit/DEEP_CODE_AUDIT_2026-06-30.md` — 460+ проверок, реестр костылей.
- `docs/AUDIT-CURRENT-MAIN-2026-10-26.md` — 50 work units матрицы, W1–W47;
  класс `SYS-CONTENT-AUTHORING-PUBLICATION-CONTRACT` (открыт).
- `research/CONTENT_REGRESSION_FINDINGS.md` — orphaned-MDX регрессия.
- Живой эталон: мега-пиллар `/hard-texts/otstuplenie-ot-very-iuda-evreyam-6/`
  (PR #2215) и teen-серия (`teenSeriesConfig.ts`, маршруты `/articles/…`,
  хаб `/podrostok-za-kadrom/`).

## 2. Как агенты ломали ввод других серий (каталог → наш риск)

1. **MDX без маршрута = невидимая статья** (`SYS-CONTENT-AUTHORING-PUBLICATION-CONTRACT`,
   `CONTENT_REGRESSION_FINDINGS`): валидный MDX проходит сборку, но без route page
   не существует для читателя; config-only пункт Pastor давал 30 битых ссылок.
   → У серии сейчас ровно это состояние: 5 MDX, 0 маршрутов, 0 записей в движке.
2. **Расхождение проекций**: конфиг ≠ `data/series.json` ≠ хаб ≠ frontmatter
   (минуты чтения, порядок, статусы) — самая частая красная сборка/аудит
   (SERIES-ENGINE-GUIDE §5). Teen-контракт: «valid registry on one side is not
   sufficient».
3. **Буквенные марки как спутники** (Teen W43): `mark.kind:'letter'` убрал A–D из
   prev/next и рельса; прогресс врал «Часть 3 из 3». У нас части I–V — `roman`,
   риск низкий, но прогресс «Часть N из 5» проверить в браузере обязательно.
4. **Запечённый текст в обложке** (Baptisty D-1): hero-crop 124%/−12% + плашка
   `figcaption` режут подпись. Наши обложки — фото-webp без текста: риск закрыт,
   подписи только в `figcaption`.
5. **Контраст золото-на-белом 2.22:1** (D-2, `.author-card-icon`) и класс
   `GBS-TEXT-CONTRAST-RESIDUAL-BATCH`: любой кастомный хром проверять axe
   light/dark × desktop/mobile, причём после завершения анимаций (settled sweep,
   W46 — ложные контрасты на промежуточных кадрах).
6. **Статичный aria-label при живом тексте** (D-3, W42 `label-content-name-mismatch`:
   7 копий шапки). Если в хроме серии появятся кнопки с меняющейся подписью
   («Сейчас читаете») — имя собирать из содержимого.
7. **Контент вне landmarks** (D-4, axe `region`) и узлы сносок `.fn-marker`
   (D-7 — **не исправлен, ждёт решения владельца**; у нас сносок в серии нет —
   не вводить без решения).
8. **Каскад**: `css/site.css` на ~81% unlayered — правило в `@layer` молча
   проигрывает (D-уроки); тема серии — только токены `--gb-*` под
   `[data-series-theme]`, геометрию движка не трогать (SERIES-ENGINE-GUIDE §3).
9. **Полная материализация реестров из локального dist** — ловушка (урок мега-лейна):
   реестры пополняются хирургически / approved-supplement'ом, не перегенерацией.
10. **Фальшивая свежесть**: технические коммиты не двигают `updatedAt`/`lastmod`
    (Инвариант 2); даты публикации серии — реальная дата релиза.
11. **Quiz dual-write** (S-стандарт): у квиза один semantic owner; teen-прецедент
    для чувствительной темы — `quiz: []` отключён решением контракта.
12. **Глоссарий — owner-controlled data** (Инвариант 6): массовые правки
    `data/glossary.json` агентам запрещены без решения владельца.

## 3. Состояние серии: что есть / чего не хватает

### Есть (проверено ранее + обложки в этой ветке)
- 5 завершённых текстов с разделами «Источники и сверка», выводами; S51-оригиналы
  (греч./евр. с транслитерацией и переводом) в ч. I присутствуют.
- Обложки 1200×630 webp + `ogImage/ogImageAlt` + hero-фигуры; 3 внутристатейных
  кадра 1200×675 (Ахан, ожесточение, Кранмер). `astro sync` — PASS.
- Мега-пиллар опубликован и может быть «главным разбором» темы.

### Не хватает (по владельцам)
| # | Владелец | Что сделать |
|---|---|---|
| 1 | Series engine | data-файл серии + `apostasySeriesConfig.ts` через `defineSeriesConfig`, регистрация в `SERIES_CONFIGS`; `partToc` с реальными `#`якорями H2 каждой части |
| 2 | Routes | 5 маршрутов `/articles/<slug>/` (паттерн teen: MDX-импорт + SeriesPage) |
| 3 | Hub | Лендинг серии (паттерн `/podrostok-za-kadrom/`): список частей, суммарное время (~79 мин: 18/15/17/13/16), обложки |
| 4 | `data/series.json` | Запись серии: порядок I–V, те же минуты, что в конфиге и на хабе |
| 5 | Frontmatter ×5 | `draft:false`, `noindex:false`, реальные `publishedAt/updatedAt`, `readingTime`, `related` (части между собой + мега-пиллар) |
| 6 | «Коротко» ×5 | S17: 4–6 пунктов строго из тела статьи (сейчас отсутствует у всех 5) |
| 7 | Реестры | page-ownership, route-profiles, route-search-policy, editorial-metadata (approved-supplement), search-manifest, feed/sitemap, scripture occurrence index |
| 8 | Discovery | `/articles/` листинг, главная полка (по реальным датам), llms.txt |
| 9 | Перелинковка | Серия → мега («главный разбор Евр. 6»); мега → серия (related/упоминание) |
| 10 | Медиа-реестр | provenance/rights запись по обложкам (AI-генерация, дата, промт-класс) — по teen media-контракту |

### Решения владельца (блокируют пункты выше)
- **D-A. Квизы**: teen-прецедент — отключены для чувствительной темы; Gill-прецедент —
  квиз на часть (5–7 вопросов из текста). Тема серии доктринально-пастырская.
  Варианты: (а) без квизов; (б) по одному квизу на часть из фактического текста.
- **D-B. Глоссарий**: в `data/glossary.json` (130 терминов) нет ни одного по теме.
  Кандидаты: отступничество/апостасия, стойкость святых, временная вера,
  ожесточение, средства благодати, церковная дисциплина, lapsi. Добавление =
  правка owner-controlled data → нужно явное разрешение и список терминов.
  Тултипы Писания при этом работают проекцией из plain-text ссылок (как у мега,
  0 ручной разметки) — проверить интерактивность в QA по teen-контракту.
- **D-C. Тема оформления**: без `theme` серия выглядит как Gill/Teen (дефолт) —
  допустимо; своя тема = отдельный `css/series-<theme>.css` только токенами.
- **D-D. Сноски**: не вводить (D-7 открыт на уровне продукта).

## 4. Гейты перед merge (по WORK_MODES, SYSTEM-лейн)

- Lane-запись до старта: surface owner, protected paths, смежные PR, exact base,
  proof-план; merge только при всех зелёных required checks на том же HEAD.
- `engine:contracts` → `audit-pro` → `engine:guard` (build обязателен);
  `engine:sweep` — добавить представителя новой серии.
- `editorial:lint`, `sources:hygiene`, `article:qa`, `content:parity`.
- Browser: desktop 1440 + mobile 390, light/dark, axe (settled), TTS не читает
  служебное, print без фикс-баров, prev/next I→V, прогресс «Часть N из 5»,
  deep-link по якорям partToc, скриншоты владельцу.
- После merge: post-deploy witness живого прода (5 маршрутов + хаб), как у мега.

## 5. Вердикт

Контент и медиа готовы. Публикация = один SYSTEM-лейн атомарной транзакцией
(по teen-контракту: конфиг → маршруты → хаб → реестры → фронтматтер →
перелинковка → discovery → снятие draft/noindex → browser evidence).
Сначала — решения D-A/D-B (и при желании D-C).
