# 84. «Баптисты России»: production status и master-plan марафона

**Дата:** 2026-09-06  
**Статус:** execution/status layer — не новая long-horizon authority.  
**Вышестоящая authority:** `docs/BAPTISTY-ROSSII-BOOK-AUTHORITY-V2.md` от 2026-08-20.  
**Current publication architecture:** `docs/BAPTISTY-ROSSII-EDITORIAL-ARCHITECTURE.md`.  
**Machine projection:** `data/baptisty-rossii-expansion-roadmap.json` v4.  
**Historical snapshots:** research 50, 79, 82, 83 сохраняются как история решений и не переписываются задним числом.

> Этот документ отвечает не на вопрос «какой когда-то был план», а на вопрос **что фактически закрыто на 6 сентября 2026 года, что остаётся открытым и в каком порядке продолжать книгу без false-green, пустых URL, декоративных подмен и смешения Research с Product**.

---

## 1. Каноническое решение на сентябрь 2026

Июльский 17-главный editorial audit был полезным переходным документом, но long-horizon архитектура уже заменена `Book Authority v2`.

Канонический target теперь:

- **5 частей**;
- **20 самостоятельных будущих глав**;
- **90 000–120 000 слов** основного читательского текста;
- обычная глава ориентировочно **4 500–7 000 слов**, если документальная сложность не требует другого объёма;
- current public surface остаётся стабильной: **9 исторических статей + отдельный справочник/endpaper**;
- current public navigation остаётся **4-главной** до отдельного publication/system migration;
- наличие future chapter в planning graph **не создаёт URL**;
- existing canonical routes не уничтожаются при extraction в будущую книгу.

### Что считать устаревшим

- `17 глав` из research 79 — historical intermediate architecture, не current target;
- `47 400 слов` — legacy ten-route growth baseline, не финальный объём книги;
- формула `10 частей` — current-route shell legacy, а не смысловая архитектура будущей книги;
- справочник — не «глава 10», а научный аппарат / endpaper.

---

## 2. Что реально закрыто в Product

На current published surface 9 исторических статей. На 2026-09-06 шесть из них уже прошли merged Golden content wave.

| Current route | Golden content | PR / merge state | Что реально закрыто | Что НЕ закрыто автоматически |
|---|---|---|---|---|
| `/noch-na-kure/` | MERGED | #1782 | документальный rewrite; origin claims bounded; source-strength layer | финальный archival hero, 3–5 visual events, rights/media DoD |
| `/yuzhnaya-shtunda/` | MERGED | #1783 | штунда ≠ баптизм; датированная сеть; разные голоса источников | финальный media package и target chapter extraction |
| `/dva-sezda-1884/` | MERGED | #1784 | Петербург ≠ Ново-Васильевка; 1885 без teleology | финальный media package, parallel event visualisation |
| `/peterburgskaya-liniya/` | MERGED + OPEN DEEPENING | #1771 merged; #1791 open | Golden rewrite, source matrix, chronology corrections; дополнительное deepening подготовлено | extraction на главы 5–9, финальный media package, решение по #1791 |
| `/goneniya-i-sovest/` | MERGED | #1785 | расширенная chronology совести/армии/государства | будущая chapter-13 extraction, archival media DoD |
| `/sovetskaya-noch/` | MERGED | #1789 | Golden rewrite; 1929 legal sequence; bounded repression claims | split в chapters 14–16, full visual package |
| `/vsehib-1944/` | ACTIVE GOLDEN RESEARCH | #1792 draft | source-to-claim ledger + archival visual contract | bytes, facsimile, HTML production rewrite, media, QA |
| `/iniciativnaya-gruppa/` | ACTIVE GOLDEN RESEARCH | #1793 draft | двусторонний ledger; 1963 primary gate; 1965 date conflict fixed; visual dossier | remaining primary gates, bytes, HTML production rewrite, media, QA |
| `/podpolnaya-pechat/` | ACTIVE GOLDEN RESEARCH | #1794 draft | chronology normalized; Bulletin conflict fixed; visual dossier | facsimiles/bytes, HTML production rewrite, media, QA |

### Главное различие статусов

`Golden content merged` **не равно** `BOOK-READY`.

Book Authority v2 требует, кроме текста:

- final claim/source review;
- verified locators для прямых цитат;
- отсутствие blocking Research HOLD;
- минимум 2 прошедших publication gate локальных исторических объекта, обычная цель 3–5;
- identity → provenance → rights → exact caption → local binary → SHA → derivatives → media ledger;
- chapter/book data consistency;
- exact-head checks;
- отдельный live witness перед заявлением production state.

Поэтому шесть merged Golden routes надо считать **CONTENT-GOLDEN**, но не автоматически `BOOK-READY`.

---

## 3. Активные lanes, которые нельзя потерять

### #1791 — Petersburg deepening

**Статус:** open, non-draft.  
**Смысл:** углубляет Bedeker/Kargel prison mission, Heier attribution, Pashkov Papers и House of Gospel foundation layer.

Перед merge нужен обычный exact-head/review pass. Этот PR не должен быть затерт новым Petersburg rewrite.

### #1792 — ВСЕХиБ 1944

**Branch:** `book/vsehib-1944-golden-chapter`  
**Статус:** draft research/media lane.

Закрыто:

- 26–29 октября 1944 = полный диапазон совещания;
- 27 октября = дата резолюции о слиянии;
- 45 делегатов;
- Орлов = председатель совещания;
- Жидков = председатель избранного Совета после распределения должностей;
- протокол / официальное самоописание / государственный контекст / редакторский анализ разведены;
- визуальный shortlist строится из MASTER, а не из внешней картинки.

### #1793 — Инициативная группа

**Branch:** `book/iniciativnaya-gruppa-golden-chapter`  
**Статус:** draft research/media lane.

Закрыто:

- Положение и Инструктивное письмо не смешиваются;
- официальный ответ ВСЕХБ 1962 является обязательным counter-source;
- `Братский Вестник №6, 1963` закрывает primary gate съезда 15–17 октября 1963 и нового Устава;
- exact participant structure: 210 + 45 + 195 = 450;
- образование Совета Церквей датируется **18–19 сентября 1965**, а не 20 сентября: primary `Братский листок` сильнее ошибочной поздней MASTER-caption;
- visual dossier помечает этот caption conflict и не копирует его в Product.

### #1794 — Подпольная печать

**Branch:** `book/podpolnaya-pechat-golden-chapter`  
**Статус:** draft research/media lane.

Закрыто:

- `Вестник спасения` — с 1963;
- `Вестник истины` — с 1976;
- `Чрезвычайные сообщения` Совета родственников — с 1964;
- регулярный `Бюллетень Совета родственников узников ЕХБ` — **с 1971**, не с 1964;
- ряд Бюллетеня: №1 (1971) — №141 (1987);
- `Христианин` 1971 как подпольное издательство не смешивается с журналом Проханова;
- численные оценки тиражей / типографий / конфискаций остаются attributed estimates, если нет независимой инвентаризации;
- MASTER-caption conflict 1964/1971 сохраняется явно.

---

## 4. Target architecture 5 / 20 и фактическая готовность

Статус ниже относится к **будущим book chapters**, а не к current URLs.

### Часть I. До имени — рождение русского баптизма

#### 1. До баптистов: поиск Писания

**Current state:** RESEARCH-RICH / NO ROUTE / NOT READY FOR PLACEHOLDER.

Нужно:

- самостоятельный исторический вопрос;
- молоканская, водно-молоканская, пиетистская, немецко-колонистская и Bible-society линии без искусственной прямой генеалогии;
- source-to-claim matrix;
- отдельный visual brief;
- только после DoR решать extraction/new route.

#### 2. Ночь на Куре

**Current state:** CONTENT-GOLDEN / MEDIA-INCOMPLETE.

Основа: current Kura route + #1782.

Следующий gate: archival hero + facsimile + 2–4 supporting visuals + media ledger.

#### 3. Южная штунда

**Current state:** CONTENT-GOLDEN / MEDIA-INCOMPLETE.

Основа: #1783.

Следующий gate: people/event/source visuals, карта сети только из проверенной geography.

#### 4. 1884–1885: две развилки и самостоятельный русский съезд

**Current state:** CONTENT-GOLDEN / MEDIA-INCOMPLETE.

Основа: #1784.

Следующий gate: два события визуально развести, не создавать одну «общую фотографию 1884».

### Часть II. Евангелие выходит в публичность

#### 5. Петербургское пробуждение

**Current state:** CONTENT-GOLDEN / EXTRACTION-READY AFTER #1791 DECISION / MEDIA-INCOMPLETE.

Нужно сохранить current route search history и определить, какие блоки остаются на route после extraction глав 6–9.

#### 6. Каргель: богослов и соединительный мост

**Current state:** SOURCE-RICH / EMBEDDED IN PETERSBURG / NO STANDALONE DoR YET.

P0:

- отдельная source-to-claim matrix;
- Petersburg → south → Bedeker/prison ministry → theology network;
- отделить Каргеля от биографической декоративности;
- собрать реальный portrait/document/event media package.

#### 7. Мазаев и Проханов: два проекта братства

**Current state:** SOURCE-RICH / NO STANDALONE ROUTE.

P0:

- два организационных проекта не превращать в схему «правый/неправый»;
- congress protocols + periodicals + correspondence;
- explicit distinction between Russian Evangelical Union and Union of Evangelical Christians;
- source matrix before prose.

#### 8. Печатная республика

**Current state:** ARCHIVE-RICH / ISSUE-LEVEL RESEARCH ADVANCED / NO ROUTE.

Опора:

- MASTER periodicals;
- `Баптист`, `Христианин`, `Утренняя звезда`, `Гость`, `Братский листок` и связанные печатные проекты;
- existing Bratsky Listok evidence ledger;
- physical/page-level verification, а не обложки из случайного поиска.

Это один из лучших кандидатов на **первую новую book-only chapter**, когда DoR закрыт.

#### 9. Фетлер и Дом Евангелия

**Current state:** SOURCE PACK READY / EMBEDDED IN PETERSBURG / NO ROUTE.

Google Drive Article Dossier S07 уже имеет source pack ready.  
Нужно:

- exact source-to-claim matrix;
- архитектура/открытие/служения/международная сеть;
- exterior/interior/opening services/Fetler media selection;
- rights gate.

### Часть III. Короткое окно — свобода, образование и мировое братство

#### 10. 1917–1921: свобода, революция и новая возможность

**Current state:** STRONG RESEARCH BASE / NO ROUTE.

Нельзя оставлять это коротким мостом между империей и законом 1929.

#### 11. Голод и международное братство, 1921–1924

**Current state:** STRONG RESEARCH / MIXED FILE READINESS.

Нужно различать:

- BWA / ABFMS / relief institutions;
- местные церкви и их agency;
- finding aid / bibliographic record / received file.

#### 12. Школа, Библия и несостоявшееся единство, 1923–1928

**Current state:** CONDITIONAL / PRIMARY GATES OPEN.

Нельзя строить главу из одного упоминания College Fund. Нужны полные congress/union documents, Bible/publishing layer и точная institutional chronology.

#### 13. Совесть, армия и государство

**Current state:** CURRENT ROUTE CONTENT-GOLDEN, FUTURE EXTRACTION REQUIRED.

Основа: #1785, но будущая chapter 13 должна быть хронологически и тематически чище current all-period route.

### Часть IV. Советская ночь и контролируемое единство

#### 14. 1929: закон, который изменил церковную жизнь

**Current state:** CONTENT-GOLDEN INSIDE CURRENT ROUTE / SPLIT-READY.

Основа: #1789.

#### 15. 1930-е: разрушение союзов и Большой террор

**Current state:** CONTENT CORE EXISTS / CASE-LEVEL ARCHIVAL PRECISION REQUIRED.

Нужно:

- не превращать общую репрессию в набор недоказанных биографических деталей;
- person/case matrix;
- local archival objects where rights permit.

#### 16. Война и 1944

**Current state:** ACTIVE GOLDEN RESEARCH (#1792) + current Soviet Night wartime bridge.

Будущая глава должна чётко разводить:

- церковное стремление к единству;
- функционирование временного/совместного центра;
- войну и патриотическую мобилизацию;
- новую государственную религиозную политику;
- октябрьское совещание.

#### 17. ВСЕХБ: цена легального пространства, 1945–1959

**Current state:** MAJOR GAP / MATERIALS EXIST, NO STANDALONE CHAPTER.

Это важнейший missing bridge между 1944 и кризисом 1959.

Нужно:

- `Братский Вестник` как институциональная хроника;
- восстановление общин и международные контакты;
- система старших пресвитеров;
- литургическая/миссионерская жизнь;
- государственное регулирование;
- постепенное усиление ограничений;
- 1959 как финальный pressure point, а не внезапное начало конфликта.

### Часть V. Совесть под давлением

#### 18. 1959–1965: Инструктивное письмо и разлом

**Current state:** ACTIVE GOLDEN RESEARCH (#1793), strongest current late-Soviet claim architecture.

Открытые gates:

- полный визуально проверенный оригинал Инструктивного письма;
- первичная фиксация 25.02.1962 для Оргкомитета;
- count/source reconciliation 1966 как последующий эпилог/bridge.

#### 19. Подпольная церковь: печать, узники и семьи

**Current state:** ACTIVE GOLDEN RESEARCH (#1794), but future chapter is broader than current print route.

Нужно соединить:

- периодику;
- издательство;
- типографии;
- Совет родственников;
- узников и семьи;
- молодёжь;
- международную передачу информации;
- материальную технологию копирования.

#### 20. После ночи: международный голос, 1991 и память

**Current state:** PLANNED / RESEARCH EXISTS / NO PUBLICATION MATRIX.

Нужно:

- эмиграция и высылки;
- BWA/Keston/зарубежные архивы;
- легализация после 1991;
- разные линии ЕХБ после СССР;
- память о разделении без конфессионального победного нарратива;
- современная историография и архивное возвращение источников.

---

## 5. Главный missing narrative bridge

На текущем public surface самое большое структурное отверстие находится не в XIX веке, а между **1945 и 1959**.

Сейчас читатель идёт примерно так:

```text
1944 объединение
    ↓
[слишком короткий послевоенный промежуток]
    ↓
1959 Положение / Инструктивное письмо
    ↓
1961–1965 разлом
```

Для книги это недостаточно.

Поэтому после закрытия #1792–#1794 один из первых новых research lanes должен быть:

> **Chapter 17 — «ВСЕХБ: цена легального пространства, 1945–1959»**

Он объяснит, почему конфликт 1959 вырос не из одного документа, а из пятнадцати лет институциональной жизни, компромиссов, восстановления и контроля.

---

## 6. Визуальный марафон: единый стандарт

### 6.1. Что считать финальным визуалом

Для documentary chapter приоритет:

1. историческая фотография конкретного события/человека/места;
2. facsimile первичного документа/периодики;
3. историческое здание/interior/object;
4. редакционная карта/схема, построенная только из проверенных данных;
5. декоративный visual — только как вспомогательный UI, не как доказательство и не как замена archive hero.

### 6.2. Что делать с текущими SVG-cover

`cover-01...cover-09` и related webp:

- допустимы как current navigation fallback;
- не считаются историческим visual event;
- не закрывают Book Authority media DoD;
- не должны диктовать будущую документальную визуальную систему;
- заменяются на governed archival hero только после media pipeline.

### 6.3. Media pipeline без сокращений

```text
MASTER candidate
→ retrieve original bytes
→ object/face/date identity check
→ provenance
→ rights
→ exact caption
→ local governed binary
→ SHA / integrity
→ responsive derivative
→ media ledger
→ HTML / OG / Twitter / schema integration
→ rendered QA
```

`Article ready = YES` означает тематическую готовность к редакционному отбору, а не `site-ready`.

### 6.4. Минимальный chapter visual package

Для `BOOK-READY`:

- минимум 2 local historical objects после полного gate;
- обычная цель 3–5 visual events;
- минимум одно изображение должно быть содержательно связано с ядром главы, а не просто портретом известного лидера;
- для source-heavy главы желателен хотя бы один facsimile;
- карта/diagram — только когда отвечает на реальный вопрос.

### 6.5. Запрещённые подмены

- AI photo pretending to be archive;
- generic stock press/prison/church image;
- fake aged-paper document;
- random web image with unknown license;
- remote hotlink instead of governed local asset;
- MASTER caption copied after a detected date/content conflict;
- face identification from similarity alone;
- decorative cover counted as one of required documentary objects.

---

## 7. Archive reality, которую нужно использовать, а не обходить

MASTER ARCHIVE CATALOG содержит:

- **2 841** original photos;
- **2 585** captioned photos;
- **2 031** rows marked `Article ready = YES`;
- separate periodical/PDF/acquisition/evidence infrastructure.

Следствие: визуальная стратегия книги не нуждается в генеративной подмене истории. Ей нужен **disciplined selection + byte recovery + provenance/rights pipeline**.

Проблема проекта сейчас не «нет картинок», а:

- нужный объект надо выбрать под конкретный claim;
- некоторые catalog references ещё не дают воспроизводимо полученный byte;
- object identity/caption надо проверять отдельно;
- rights publication gate нельзя выводить из наличия файла.

---

## 8. Source discipline для всей книги

### 8.1. Четыре голоса для конфликтных узлов

Когда глава делает спорный причинный/обвинительный вывод, искать применимые линии:

1. официальный церковный документ;
2. внутренний альтернативный голос;
3. государственный документ;
4. независимое/академическое внешнее исследование.

Не требуется искусственно находить четыре источника к каждому дню календаря. Модель нужна там, где одна оптика способна исказить вывод.

### 8.2. Не смешивать классы и состояния

```text
сильный библиографический источник
≠ файл получен
≠ страница проверена
≠ цитата готова
≠ право публикации очищено
```

Каждый lane обязан сохранять это различие.

### 8.3. MASTER caption не authority над первичкой

Уже пойманы реальные примеры:

- Council of Churches 1965: MASTER `20 Sep` vs primary meeting `18–19 Sep`;
- Council of Prisoners' Relatives: MASTER-caption collapses Bulletin into 1964, while bibliographic chronology separates 1964 Extraordinary Reports from 1971 regular Bulletin.

Правило:

> archival caption — evidence lead / metadata layer; при конфликте authoritative primary/bibliographic evidence должен исправлять Product caption, а conflict сохраняется в media ledger.

---

## 9. Production waves — новый порядок марафона

### Wave A — закрыть current 9-route content layer

1. review/resolve #1791;
2. довести #1792 до production content после evidence/media gates;
3. довести #1793;
4. довести #1794;
5. после каждого content lane — отдельный metadata/media lane, если этого требует ownership model.

**Exit:** все 9 current historical routes имеют Golden claim architecture; merged content может оставаться media-incomplete, но этот долг должен быть явным.

### Wave B — archival visual remaster current surface

Порядок рекомендуется не по номеру статьи, а по готовности сильного archive package:

1. VSEHIB 1944;
2. Initiative Group;
3. Underground Press;
4. Kura;
5. 1884;
6. Petersburg;
7. South Shtunda;
8. Soviet Night;
9. Conscience.

Для каждого route:

- 1 hero candidate;
- 3–5 supporting candidates;
- 1 facsimile target where applicable;
- media manifest;
- rights;
- local derivatives;
- social/schema image;
- rendered QA.

### Wave C — Public-square extraction: future chapters 6–9

Order:

1. Kargel source matrix;
2. Mazaev/Prokhanov source matrix;
3. Print Republic source matrix + issue-level media set;
4. Fetler/House of Gospel source matrix;
5. extraction decisions from Petersburg current route;
6. new route only after each future chapter independently satisfies DoR.

### Wave D — 1917–1928: future chapters 10–13

1. 1917–1921;
2. famine/international brotherhood;
3. school/Bible/unity;
4. conscience/army/state extraction from current route.

### Wave E — Soviet Night: future chapters 14–17

1. law 1929 extraction;
2. 1930s case matrix;
3. War & 1944 integration with #1792;
4. **new Chapter 17 1945–1959 — P0 structural gap**.

### Wave F — 1959–1991: future chapters 18–20

1. close #1793 and extract chapter 18;
2. close #1794 and broaden to prisoners/families for chapter 19;
3. build chapter 20 source matrix and post-1991/memory corpus.

### Wave G — Book experience only after text stabilises

- dynamic book navigation;
- 5-part reader architecture;
- current route → target chapter mapping;
- chapter/book progress separation;
- atlas;
- quizzes;
- structured data Book/isPartOf;
- print/PDF/EPUB pipeline after rights and export audit;
- homepage launch/marketing only after publication truth exists.

---

## 10. Do not make a mega-PR

Книга должна двигаться серией independently reviewable lanes.

Не смешивать в одном PR:

- Research source matrix;
- historical content rewrite;
- media byte ingest;
- shared runtime/navigation;
- generated search/feed projections;
- editorial metadata/date decision;
- book-engine migration.

Причина не бюрократическая: так остаются понятными provenance, rollback и root cause CI failure.

---

## 11. Definition of Done для каждого current-route remaster

### Evidence

- [ ] source-to-claim matrix current;
- [ ] direct quotes locator-verified;
- [ ] no stronger claim than evidence;
- [ ] detected conflicts preserved explicitly;
- [ ] counter-voice for contested claims.

### Narrative

- [ ] chapter question clear;
- [ ] no filler;
- [ ] 4–6 accurate summary points;
- [ ] terms/glossary handled;
- [ ] bridge to adjacent history works without teleology.

### Media

- [ ] historical hero actually verified;
- [ ] 2 minimum / 3–5 target documentary visual events;
- [ ] at least one document/facsimile where source-rich;
- [ ] provenance;
- [ ] rights;
- [ ] local binary;
- [ ] SHA/integrity;
- [ ] exact caption;
- [ ] media ledger;
- [ ] OG/Twitter/schema image aligned.

### Product

- [ ] canonical unchanged unless deliberate migration;
- [ ] metadata ownership respected;
- [ ] reading time derived;
- [ ] previous/next/navigation stable;
- [ ] desktop/mobile rendered QA;
- [ ] links/source hygiene;
- [ ] exact-head CI;
- [ ] live witness before production claim.

Only after all four blocks can a route be called `BOOK-READY`.

---

## 12. Immediate queue from this status file

### P0 — current execution

1. decide #1791 after diff/review/check inspection;
2. continue #1792: facsimile + media byte recovery + production content lane;
3. continue #1793: close Instruction Letter / 1962 primary gates + production content lane;
4. continue #1794: facsimile/byte gates + production content lane;
5. open dedicated **1945–1959 source matrix** lane;
6. begin current-route archival media manifests, starting from chapters with concrete MASTER candidates.

### P1 — next new-book content

7. Kargel matrix;
8. Mazaev/Prokhanov matrix;
9. Print Republic matrix;
10. Fetler/House of Gospel matrix;
11. 1917–1921 matrix.

### P2 — system/book experience

Do not start system migration before the independent future chapter set actually becomes publication-ready. Book engine should consume truth, not create the illusion of it.

---

## 13. One-line production truth

> На 6 сентября 2026 года «Баптисты России» уже имеет шесть merged CONTENT-GOLDEN current routes, три активных Golden research/media PR, каноническую 5-part/20-chapter book authority и мощный 2 841-photo archive; главный следующий фронт — довести последние три current routes, провести governed archival visual remaster и затем извлекать новые самостоятельные chapters только через Definition of Ready.
