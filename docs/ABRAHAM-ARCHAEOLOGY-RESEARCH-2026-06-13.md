# ABRAHAM-ARCHAEOLOGY-RESEARCH — cleaned source index + implementation audit

**Project:** `/karty/avraam/` — интерактивная карта пути Авраама
**Cleaned:** 2026-06-14
**Purpose:** оставить полезную исследовательскую базу и убрать старый мусор вида `research-only`, `0 photos`, `готово к approval`, который уже закрыт кодом.

---

## 1. Текущий статус внедрения

Старые research/proposal-блоки из предыдущих проходов **выполнены** и больше не являются задачами.

В коде сейчас:

| Область | Статус |
|---|---:|
| Места Авраама | 19 |
| Этапы маршрута | 8 |
| Сюжеты | 5 |
| Context-points | 7 |
| Фото / реконструкции | 40 |
| Опорные узлы Ур→Харран | 5 |
| Научные варианты / оговорки | 47 |
| `route.json` | full data |
| `MapEngine.validateRoute()` | green |

Файлы:

- `karty/avraam/index.html` — визуальная карта, panels, SVG, тур, фото, variants UI.
- `karty/avraam/route.json` — full data: `places`, `stages`, `ctx`, `stories`, `verified_waypoints`, `scientific_variants`.
- `karty/_engine/map-engine.js` — validator + reusable core для будущих карт.

---

## 2. Что уже внесено из исследований

### 2.1. Фото / визуальные источники

В карту внесено 40 real/heritage images:

- Wikimedia Commons через `Special:FilePath` — чтобы не зависеть от хрупких `/thumb/hash/...` путей.
- LOC Matson/American Colony — canonical `tile.loc.gov`.
- Ritmeyer Archaeological Design — Mamre reconstruction.
- Все thumbnails проверялись в Chromium: `badCount=0`.

### 2.2. Ур→Харран: исторически верный коридор

В карту добавлен отдельный слой `routeWaypoints`:

1. Урук — `אֶרֶךְ`
2. Ниппур — `נִפּוּר`
3. Вавилон — `בָּבֶל`
4. Мари — `מָרִי`
5. Каркемиш — `כַּרְכְּמִישׁ`

Смысл: читатель видит, что путь не «срезает пустыню», а идёт евфратским караванным коридором.

### 2.3. Научные варианты

Добавлен структурный блок `scientific_variants` для всех 19 мест. Статусы:

- `primary` — основная / сильная идентификация;
- `candidate` — кандидат / традиция;
- `minor` — слабый меньшинственный вариант;
- `caveat` — честная оговорка;
- `rejected` — вариант показан как отвергаемый позицией карты.

В UI блок называется:

> НАУЧНЫЕ ВАРИАНТЫ И ОГОВОРКИ

Показывается во вкладках «Сюжет» и «Археология».

---

## 3. Редакционная позиция карты

Карта честно различает три уровня:

1. **Библейский текст** — высший авторитет для повествовательной линии.
2. **Археологический контекст** — подтверждает эпоху/ландшафт/тип города/дороги, но редко доказывает конкретный эпизод Авраама.
3. **Научная локализация** — для каждого места имеет степень уверенности.

Позиция проекта остаётся консервативной/YEC:

- буквальное Быт 1–11;
- Авраам около 2166 до н.э. в классической хронологии Ашшера; возможны уточнения по ARJ/консервативной ревизии;
- археология интерпретируется через Писание, но без выдуманных «находок Авраама» там, где их нет.

---

## 4. Основные локализационные выводы

| Место | Основная позиция карты | Оговорки / варианты |
|---|---|---|
| Ур | Тель эль-Мукайяр | Урфа как сильная традиция, но слабее археологически |
| Урфа | Северная традиция | не основной Ур карты |
| Харран | Телль Харран | локализация практически бесспорна |
| Дамаск | Оазис Гута / древний Дамаск | конкретный дом/точка не известны |
| Сихем | Телль Балата | дуб Морэ не найден точечно |
| Бет-Эль | Бейтин | эль-Бире / альтернативы слабее |
| Египет | Дельта / Среднее царство | фараон и дворец не идентифицируются |
| Хеврон | Тель Румейда / Махпела | Мамре: Рамат эль-Халиль как сильная традиция |
| Шалем / Мория | Иерусалим / Мория | есть варианты Шалема, но карта держит храмовую традицию |
| Дан | Телль Дан / Лаиш | «Дан» — антиципирующее название |
| Содом | южная котловина, Баб эд-Дра / Нумейра | Талл эль-Хаммам показан как спорный/отвергаемый кандидат |
| Талл эль-Хаммам | северный кандидат | не принят как Содом в позиции карты |
| Цоар | Гор эс-Сафи | точная городская точка могла смещаться |
| Герар | Тель Харор | Тель Джемме — слабый старый вариант |
| Беэр-Шева | зона колодцев | тель в основном железный век |
| Кадеш | Эйн эль-Кудейрат / Эйн Кадис | телль позднее патриархов |
| Шур | северо-западный Синай / дорога к Египту | региональная, не точечная локализация |
| Беэр-лахай-рои | между Кадешем и Бередом | точное место неизвестно |
| Хова | севернее Дамаска | единственное библейское упоминание |

---

## 5. Source index — хорошие источники, которые стоит оставить

> Принцип: в саму карту не грузить десятки ссылок. Карта показывает краткий reader-facing текст, а этот MD хранит рабочую базу для агентов.

### 5.1. BiblePlaces / Pictorial Library

- Haran — https://www.bibleplaces.com/haran/
- Shechem — https://www.bibleplaces.com/shechem/
- Bethel — https://www.bibleplaces.com/bethel/
- Dan — https://www.bibleplaces.com/dan/
- Beersheba — https://www.bibleplaces.com/beersheba/
- Gerar — https://www.bibleplaces.com/gerar/
- Dead Sea — https://www.bibleplaces.com/deadsea/
- Bab edh-Dhra — https://www.bibleplaces.com/babedhdhra/
- Numeira — https://www.bibleplaces.com/numeira/
- Hebron — https://www.bibleplaces.com/hebron/
- Temple Mount — https://www.bibleplaces.com/templemount/
- Negev and Wilderness Vol.5 — https://www.bibleplaces.com/05-negev-and-the-wilderness-revised/
- Egypt and Sinai Vol.7 — https://www.bibleplaces.com/07-egypt-and-sinai-revised/
- Complete Collection — https://www.bibleplaces.com/pictorial-library-complete-collection/

### 5.2. Wikimedia Commons: real photos / categories

- Great Ziggurat of Ur — https://commons.wikimedia.org/wiki/Category:Great_Ziggurat_of_Ur
- Harran — https://commons.wikimedia.org/wiki/Category:Harran
- Tell Balata — https://commons.wikimedia.org/wiki/Category:Tell_Balata
- Beitin / Bethel — https://commons.wikimedia.org/wiki/Category:Beitin
- Tel Dan — https://commons.wikimedia.org/wiki/Category:Tel_Dan
- Canaanite city gate, Tel Dan — https://commons.wikimedia.org/wiki/Category:Canaanite_city_gate,_Tel_Dan
- Bab edh-Dhra — https://commons.wikimedia.org/wiki/Category:Bab_edh-Dhra
- Tall el-Hammam — https://commons.wikimedia.org/wiki/Category:Tall_el-Hammam
- Lot’s wife salt pillar — https://commons.wikimedia.org/wiki/Category:Lot%27s_wife_made_into_a_pillar_of_salt
- Ghor es-Safi — https://commons.wikimedia.org/wiki/Category:Ghor_es-Safi
- Tel Haror — https://commons.wikimedia.org/wiki/Category:Tel_Haror
- Tel Be’er Sheva — https://commons.wikimedia.org/wiki/Category:Tel_Be%27er_Sheva
- Tell el-Qudeirat — https://commons.wikimedia.org/wiki/Category:Tell_el-Qudeirat
- Ein Avdat / Wadi Zin context — https://commons.wikimedia.org/wiki/Category:Ein_Avdat
- Oak of Mamre — https://commons.wikimedia.org/wiki/Category:Oak_of_Mamre
- Elonei Mamre — https://commons.wikimedia.org/wiki/Category:Elonei_Mamre

### 5.3. LOC / Matson / American Colony

- Shur / El Raha Plain image, canonical tile URL — https://tile.loc.gov/storage-services/service/pnp/matpc/01900/01946v.jpg
- Mamre excavations LOC resource — https://www.loc.gov/resource/matpc.22876/
- Southern Palestine Matson/American Colony collection — https://www.lifeintheholyland.com/43_southern_palestine_matson_american_colony/

### 5.4. Ritmeyer / architectural reconstructions

- Mamre and Temple Mount article — https://www.ritmeyer.com/2010/10/12/mamre-and-the-temple-mount-in-jerusalem/
- Mamre image library — https://www.ritmeyer.com/product/image-library/buildings/temples/mamre/
- Moriah / Temple Mount context — https://www.ritmeyer.com/

### 5.5. Conservative / YEC / chronology

- AiG: Have We Found Sodom? — https://answersingenesis.org/archaeology/have-we-found-sodom/
- ARJ: Abraham and the Chronology of Ancient Mesopotamia — https://answersresearchjournal.org/abraham-chronology-ancient-mesopotamia/
- ARJ PDF — https://assets.answersresearchjournal.org/doc/v5/abraham-chronology-ancient-mesopotamia.pdf
- Creation.com: The Times of Abraham — https://creation.com/the-times-of-abraham
- Creation.com: Biblical chronogenealogies — https://creation.com/biblical-chronogenealogies
- ICR biblical age overview — https://www.icr.org/biblical-age

### 5.6. German scholarly sources / WiBiLex

- WiBiLex / Bethel [Ort] — https://www.die-bibel.de/ressourcen/wibilex/altes-testament/bethel-ort
- WiBiLex permanent Bethel link — https://bibelwissenschaft.de/stichwort/10612/
- WiBiLex / Hebron — https://www.die-bibel.de/ressourcen/wibilex/altes-testament/hebron
- WiBiLex permanent Hebron link — https://bibelwissenschaft.de/stichwort/20809/
- WiBiLex / Beerscheba — https://www.die-bibel.de/ressourcen/wibilex/altes-testament/beerscheba
- WiBiLex permanent Beerscheba link — https://bibelwissenschaft.de/stichwort/14780/
- WiBiLex / Bethel [Gott] (для религиозно-исторического контекста имени, не основная локализация) — https://www.die-bibel.de/ressourcen/wibilex/altes-testament/bethel-gott

### 5.7. Jewish / Hebrew tradition sources

- Jewish Encyclopedia: Abraham — https://www.jewishencyclopedia.com/articles/360-abraham
- Sefaria: Genesis 11–25 source text — https://www.sefaria.org/Genesis.11
- Sefaria: Genesis Rabbah (традиции об Аврааме/Ур Касдим, использовать осторожно) — https://www.sefaria.org/Bereshit_Rabbah

### 5.8. NPAPH / Tell Balata archive

- NPAPH Tell Balata / Shechem — https://npaph.com/sites/tell-balata-shechem/

---

## 6. 30+ source recheck — 2026-06-14

Проведён ручной + HTTP/browser pass:

- 39 URL/источников проверены.
- 37 прошли автоматический HTTP-проход.
- 2 Ritmeyer URL дают `307` в Python `urllib`, но успешно читаются через browser/fetch_page, поэтому оставлены.
- Дополнительно добавлены немецкие WiBiLex и еврейский Jewish Encyclopedia / Sefaria source layer.

Старые ошибочные ссылки удалены / заменены:

- ARJ old/bad: `abraham-late-early-bronze-age` → заменено на живую страницу `abraham-chronology-ancient-mesopotamia`.
- CMI old/bad: `biblical-chronology-and-archaeology` → заменено на `the-times-of-abraham` + `biblical-chronogenealogies`.
- LOC Shur image: `cdn.loc.gov` redirect → canonical `tile.loc.gov`.

---

## 7. Что НЕ надо снова делать

- Не возвращать старые research-only блоки.
- Не писать в карту сотни ссылок.
- Не утверждать «найден жертвенник Авраама», если есть только ландшафт/город эпохи.
- Не смешивать CTX-точки и основные места без легенды.
- Не делать Талл эль-Хаммам основным Содомом: он остаётся спорным/отвергаемым кандидатом в позиции карты.
- Не копировать `avraam/index.html` для новых карт — использовать `_engine` + `route.json`.

---

## 8. Следующие полезные шаги

1. Постепенно выносить inline-runtime Авраама в `_engine`, но только маленькими проверяемыми кусками.
2. Для каждой новой карты держать `route.json` как canonical data.
3. Для Авраама можно улучшать UI variants: фильтр «показывать только primary/candidate/caveat».
4. Проверять новые внешние ссылки через `source:links` / ручной browser pass, не добавляя их пачкой в UI.

---

## 9. Verification snapshot

Last known good checks:

```txt
MapEngine.validateRoute(route.json): ok
places: 19
stages: 8
stories: 5
ctx: 7
photos: 40
waypoints: 5
scientific_variants: 47
npm run validate:all: green
node scripts/audit-pro.js: 150 passed, 0 errors
```

END_CLEANED_RESEARCH_INDEX
