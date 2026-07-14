# VALIDATION — data/genealogy/v2 (генерируется build.mjs)

Пайплайн: 0.1.0-phase1 · 2026-07-11T22:57:52.153Z

## Жёсткие инварианты — ✅ OK

| Инвариант | Значение | Лимит |
|---|---:|---:|
| Дубликаты id | 0 | 0 |
| Битые ссылки рёбер | 0 | 0 |
| Циклы родительского графа | 0 | 0 |

## Счётчики

| Метрика | Значение |
|---|---:|
| Персон | 3056 |
| Рёбер всего | 2053 |
| — parent | 1908 |
| — ancestor (a) | 1 |
| — spouse | 144 |
| Изолированных персон (без рёбер) | 982 |
| Русское имя есть | 3056 (100%) |
| Слито из v1-скелета | 153 / 156 |

## Русские имена по источникам

| source | персон |
|---|---:|
| override (курировано) | 29 |
| seed (v1-скелет) | 153 |
| structural (безымянные узлы) | 13 |
| pattern (стих) | 118 |
| candidate (стих+транслит) | 2113 |
| translit (fallback) | 630 |
| none | 0 |
| **review-очередь** | **1591** |

## TIPNR-парсер

- Топ-строк: 6292; персон (M/F): 3056; битых топ-строк: 12661
- Типы: {"":2,"Male":2856,"Female":200,"Group":76,"Place":10}
- Дубликаты ключей: 0
- Связей резолвнуто: 9215; нерезолв: 69; (d)-народы пропущены: 0

### Нерезолвнутые ссылки (первые 20 — вход для Phase 1 доводки)
- Abiel@1Sa.9.1 · offspring: `Gibeon@Jos.9.3-Ezk(f)`
- Ashhur@1Ch.2.24 · offspring: `Tekoa@2Sa.14.2-Amo(f)`
- Canaan@Gen.9.18 · offspring: `Jebusites@Gen.10.16-Zec`
- Canaan@Gen.9.18 · offspring: `Amorites@Gen.10.16-Amo`
- Canaan@Gen.9.18 · offspring: `Girgashites@Gen.10.16-Neh`
- Canaan@Gen.9.18 · offspring: `Hivites@Gen.10.17-2Ch`
- Canaan@Gen.9.18 · offspring: `Arkites@Gen.10.17-1Ch`
- Canaan@Gen.9.18 · offspring: `Sinites@Gen.10.17-1Ch`
- Canaan@Gen.9.18 · offspring: `Arvadites@Gen.10.18-1Ch`
- Canaan@Gen.9.18 · offspring: `Zemarites@Gen.10.18-1Ch`
- Canaan@Gen.9.18 · offspring: `Hamathites@Gen.10.18-1Ch`
- Dedan@Gen.25.3 · offspring: `Asshurim@Gen.25.3`
- Dedan@Gen.25.3 · offspring: `Letushim@Gen.25.3`
- Dedan@Gen.25.3 · offspring: `Leummim@Gen.25.3`
- Egypt@Gen.10.6 · offspring: `Ludim@Gen.10.13-1Ch`
- Egypt@Gen.10.6 · offspring: `Anamim@Gen.10.13-1Ch`
- Egypt@Gen.10.6 · offspring: `Lehabim@Gen.10.13-1Ch`
- Egypt@Gen.10.6 · offspring: `Naphtuhim@Gen.10.13-1Ch`
- Egypt@Gen.10.6 · offspring: `Pathrusim@Gen.10.14-1Ch`
- Egypt@Gen.10.6 · offspring: `Casluhim@Gen.10.14-1Ch`

## Золотой хребет (Христос→Адам) — ✅ СВЯЗАН

Длина цепи: 76 узлов. Все контрольные якоря на месте.

Иисус Христос → Мария → Илий → Матфат → Левий (Лк) → Мелхий (Лк) → Ианнай (Лк) → Иосиф (Лк) → Маттафия (Лк) → Амос (Лк) → Наум (Лк) → Если (Лк) → Наггесий (Лк) → Мааф (Лк) → Маттафия (Лк) → Семеин (Лк) → Иосиев (Лк) → Иода (Лк) → Иоанан (Лк) → Риса (Лк) → Зоровавель (Лк) → Салафиил (Лк) → Нири → Мелхий → Аддин → Косам → Елмодам → Ер (Лк) → Иисус (Лк) → Елиезер (Лк) → Иорим → Матфат → Левий (Лк) → Симеон (Лк) → Иуда (Лк) → Иосиф (Лк) → Ионан → Елиаким → Мелеа → Менна → Маттафа → Нафан → Давид → Иессей → Овид → Вооз → Салмон → Наасон → Аминадав → Арам → Есром → Фарес → Иуда → Иаков → Исаак → Авраам → Фарра → Нахор → Серуг → Рагав → Фалек → Евер → Сала → Каинан (Лк 3:36) → Арфаксад → Сим → Ной → Ламеха → Мафусал → Еноха → Иаред → Малелеил → Каинан → Енос → Сиф → Адам

## Кластеры генеалогии (14) и народы (76)

- **Допотопные патриархи** (antediluvian-patriarchs): 25 · правило: `{"type":"refRange","books":["Gen"],"chapters":[4,5,6]}`
- **Народы от Ноя** (nations-of-noah): 63 · правило: `{"type":"refRange","books":["Gen"],"chapters":[10,11]}`
- **Потомки Авраама** (abraham-descendants): 764 · правило: `{"type":"descendants","rootKey":"Abraham@Gen.11.26"}`
- **Измаильтяне** (ishmaelites): 19 · правило: `{"type":"descendants","rootKey":"Ishmael@Gen.16.11","includeRoot":true}`
- **Исав / Едом** (esau-edom): 17 · правило: `{"type":"descendants","rootKey":"Esau@Gen.25.25","includeRoot":true}`
- **12 колен Израиля** (tribes-12): 12 · правило: `{"type":"childrenOf","rootKey":"Israel@Gen.25.26","gender":"m"}`
- **Левиты** (levites): 266 · правило: `{"type":"tribe","equals":"Tribe of Levi"}`
- **Священники** (priests): 61 · правило: `{"type":"description","re":"\\bpriest\\b"}`
- **Дом Давида** (house-of-david): 173 · правило: `{"type":"descendants","rootKey":"David@Rut.4.17","includeRoot":true}`
- **Возвращение из плена** (return-from-exile): 583 · правило: `{"type":"refBooks","books":["Ezr","Neh"]}`
- **Родословие по Матфею** (matthew-1): 74 · правило: `{"type":"ancestorsVia","rootKey":"Joseph@Mat.1.16","role":"father","includeRoot":true}`
- **Родословие по Луке** (luke-3): 75 · правило: `{"type":"ancestorsVia","rootKey":"Mary@Mat.1.16","role":"father","includeRoot":true}`
- **Родственники Господа** (lords-relatives): 4 · правило: `{"type":"siblingsOf","rootKey":"Jesus@Isa.7.14"}`
- **Ученики и апостолы** (disciples-apostles): 14 · правило: `{"type":"description","re":"apostle|disciple"}`

Народов из TIPNR Group-записей: 76, из них с известным
прародителем-персоной: 25.

## Зеркальность offspring↔parents (информационно): 0 расхождений
- нет

## v1-скелет: немэпнутые (3)
- simeon_lk2 (Симеон (Лк); Лк 3:26-30; кандидатов no-tipnr-counterpart)
- judah_lk2 (Иуда (Лк); Лк 3:26-30; кандидатов no-tipnr-counterpart)
- joseph_lk3 (Иосиф (Лк, отец Илий?); Лк 3:23-26; кандидатов no-tipnr-counterpart)

## v1-скелет: коллизии мэппинга (два v1-id → один TIPNR-ключ) — 0
- нет

## v1-скелет: эвристические сопоставления — сверить редактору (55)
- mahalalel ← disamb:Mahalalel@Gen.5.12
- enoch ← disamb:Enoch@Gen.4.17
- lamech_gen5 ← disamb:Lamech@Gen.4.18
- noah ← disamb:Noah@Gen.5.29
- eber ← disamb:Eber@Gen.10.21
- nahor_serug ← disamb:Nahor@Gen.11.22
- judah ← disamb:Judah@Gen.29.35
- nathan_prince ← disamb:Nathan@2Sa.23.36
- jeconiah ← fuzzy:Jecoliah(0.88)
- shealtiel ← disamb:Shealtiel@1Ch.3.17
- zerubbabel ← disamb:Zerubbabel@1Ch.3.19
- mary ← disamb:Mary@Mat.1.16
- cush ← disamb:Cush@Gen.10.6
- gomer ← disamb:Gomer@Gen.10.2
- elam ← disamb:Elam@Gen.10.22
- aram ← disamb:Aram@Gen.10.22
- simeon ← disamb:Simeon@Gen.29.33
- levi ← disamb:Levi@Gen.29.34
- issachar ← disamb:Issachar@Gen.30.18
- gad ← disamb:Gad@Gen.30.11
- joseph ← disamb:Joseph@Gen.30.24
- benjamin ← disamb:Benjamin@Gen.35.18
- amram ← disamb:Amram@Exo.6.18
- miriam ← disamb:Miriam@Exo.15.20
- eleazar ← disamb:Eleazar@Exo.6.23
- phinehas ← disamb:Phinehas@1Sa.1.3
- hezron ← disamb:Hezron@Gen.46.12
- ram ← disamb:Ram@1Ch.2.25
- amminadab ← disamb:Amminadab@1Ch.15.10
- obed ← disamb:Obed@1Ch.11.47
- abijah ← disamb:Abijah@1Ki.14.1
- asa ← disamb:Asa@1Ki.15.8
- jehoshaphat ← disamb:Jehoshaphat@1Ki.15.24
- joram ← disamb:Joram@2Ki.1.17
- uzziah ← disamb:Uzziah@2Ki.14.21
- jotham ← disamb:Jotham@2Ki.15.5
- ahaz ← disamb:Ahaz@2Ki.15.38
- hezekiah ← disamb:Hezekiah@2Ki.16.20
- manasseh ← disamb:Manasseh@2Ki.20.21
- amon ← disamb:Amon@2Ki.21.18
- josiah ← disamb:Josiah@1Ki.13.2
- eliakim_lk ← disamb:Eliakim@Luk.3.30
- matthat ← disamb:Matthat@Luk.3.24
- eliezer_lk ← disamb:Eliezer@Luk.3.29
- joshua_lk ← disamb:Joshua@Luk.3.29
- er_lk ← disamb:Er@Luk.3.28
- shealtiel_lk ← disamb:Shealtiel@Luk.3.27
- zerubbabel_lk ← disamb:Zerubbabel@Luk.3.27
- naum_lk ← fuzzy:Nahum(0.80)
- naum_lk ← disamb:Nahum@Luk.3.25
- amos_lk ← disamb:Amos@Luk.3.25
- eliakim_mt ← disamb:Eliakim@Mat.1.13
- zadok_mt ← disamb:Zadok@Mat.1.14
- eleazar_mt ← disamb:Eleazar@Mat.1.15
- tamar ← disamb:Tamar@Gen.38.6

> Статус: **phase1-draft**. В рантайм не подключать. Exit-критерии Phase 1 — см. scripts/genealogy-build/README.md.
