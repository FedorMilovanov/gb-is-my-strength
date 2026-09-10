# Подпольная печать / Совет родственников / издательство «Христианин» — visual dossier

**Дата:** 2026-09-06  
**Целевая глава:** `/baptisty-rossii/podpolnaya-pechat/`  
**Каталог:** `РУССКИЕ БАПТИСТЫ — MASTER ARCHIVE CATALOG`, вкладка `05 Photos Captions`  
**Политика:** использовать реальные лица, документы, издания и места. Не иллюстрировать подпольную печать генеративными «секретными типографиями».

## 1. Визуальная задача главы

У главы есть три разные визуальные линии, и их нельзя свести к одному портрету лидера:

1. **бумага / периодика** — Братский листок, Вестники, Бюллетень;
2. **люди / сеть помощи** — Совет родственников узников;
3. **материальная печать** — издательство `Христианин`, типографские точки, аресты печатников.

Финальный visual rhythm должен идти от **рукописного/гектографического листка → людям, которые собирают сведения → печатной инфраструктуре → конфискованной/раскрытой типографии → сохранённому архиву**.

---

## 2. HERO candidates

### HERO-01 — Совет родственников узников, 1964

Лучший текущий кандидат из MASTER:

- MASTER row: **2505**
- Photo path: `photos/photo_2506@24-02-2026_02-59-44.jpg`
- Historical year: `1964`
- Category: `03 — BAPTISMS, SERVICES, CONGRESSES & EVENTS`
- Article ready: `YES`
- Album: `A1378`
- Message ID: `message4889`
- Catalog caption прямо говорит, что на фото — сёстры, члены Совета родственников узников.
- Intended use: **hero candidate** или крупная человеческая фигура сразу после лида.
- Why strong: глава перестаёт выглядеть как история машин и становится историей людей, которые фиксировали имена, суды и семьи.
- Gate: исходный байт + идентификация состава, если возможно + provenance + rights.

Alternative duplicate-era candidates:

- row **1004**, `photo_1005...`, album `A0576`, message1854, `Article ready YES`;
- row **1604**, `photo_1605...`, album `A0921`, message3258, `Article ready YES`.

Не выбирать по свежести Telegram-поста. Выбирать по качеству оригинального изображения и точности идентификации.

### HERO-02 — Ивангородская типографская точка / арест сотрудников, 1977

- MASTER row: **2599**
- Photo path: `photos/photo_2600@24-03-2026_16-37-32.jpg`
- Historical year: `1977`
- Category: `03 — BAPTISMS, SERVICES, CONGRESSES & EVENTS`
- Article ready: `YES`
- Album: `A1425`
- Message ID: `message5044`
- Catalog caption: 21 марта 1977 года арестована группа сотрудников издательства `Христианин` в Ивангороде, в доме Давида Ивановича Кооп.
- Intended use: alternative hero if actual byte shows the people/place/printing infrastructure strongly; otherwise key mid-article figure.
- Gate: object-level verification. Caption alone does not tell whether byte is group photo, building, press, document, or later memorial image.

---

## 3. Supporting visual candidates

### FIG-01 — Совет родственников, documentary network

Use one of rows 1004 / 1604 / 2505 not chosen as hero only if it is a distinct photo, not a duplicate repost.

**Chronology correction required:** all three MASTER captions incorrectly collapse `Чрезвычайные сообщения` and `Бюллетень`, saying the Bulletin began in 1964.

Final site caption must say:

- Совет родственников документировал преследования с 1964;
- с 1964 выпускались `Чрезвычайные сообщения`;
- регулярный `Бюллетень Совета родственников узников ЕХБ` starts in **1971**.

### FIG-02 — primary Bulletin facsimile

Research inventory names control PDFs:

- `bulletin-council-relatives-009-1972.pdf`
- `bulletin-council-relatives-010-1972.pdf`
- `bulletin-council-relatives-044-1977.pdf`
- `bulletin-council-relatives-084-1980.pdf`
- `bulletin-council-relatives-088-1980.pdf`

Preferred visual: one title/contents page from an early 1972 issue and one later offset-era page to demonstrate the material evolution.

Status: **BYTE RECEIPT NOT YET RECONFIRMED**. Do not create fake facsimile from retyped text.

### FIG-03 — `Вестник спасения` → `Вестник истины`

No clean exact-caption hit for `Вестник истины` appeared in MASTER `05 Photos Captions` during this pass.

Therefore:

- do not substitute a generic old magazine cover;
- retrieve an actual issue from the documented PDF archive;
- preferred comparison: last/late `Вестник спасения` vs `Вестник истины` №1 (53), 1976;
- figure should explain that change of title coincides with a new printing stage, not imply a new unrelated journal.

Status: **SOURCE ACQUISITION / FACSIMILE REQUIRED**.

### FIG-04 — publisher `Христианин`, Ivanogorod 1977

Use MASTER row 2599 after object check.

Independent source trail gives exact date **21 March 1977** and describes the hidden printing room in Ivanogorod. Any names or physical layout in caption must follow the verified object/source, not be reconstructed from memory.

### FIG-05 — Ligukalns / Latvia, 1974

No reliable photo candidate was located in MASTER by `Лигук*`, `9 тонн` or related keyword during this pass.

**Decision:** no generic Latvian house, no map screenshot, no AI press room.

If original case photos/documents are later found, this becomes a figure. Until then, the episode remains text + optional editorial map marker.

### FIG-06 — Georgy Vins, 1979

MASTER has several `Article ready YES` images around the 1979 expulsion / citizenship deprivation, e.g. row **613** and later repetitions.

Use only if the chapter needs an epilogue about international visibility and rights advocacy. It should **not** replace printing-specific visuals.

---

## 4. A specific archive error to preserve in the media manifest

Rows 1004 / 1604 / 2505:

```text
MASTER caption claim: Bulletin began in 1964
verified chronology: Extraordinary Reports from 1964; Bulletin No.1 in 1971
source authority: Memorial + Toronto Samizdat + academic literature
site caption: use corrected chronology
```

This conflict must not be silently forgotten after image ingestion.

---

## 5. Ideal article visual sequence

1. **Hero:** members of Council of Prisoners' Relatives (human network), or Ivanogorod if its original byte is exceptional.
2. **Facsimile:** early `Братский листок` / first-period communication.
3. **Magazine spread:** `Вестник спасения` → `Вестник истины` transition.
4. **Council of Relatives:** photo + early Bulletin facsimile.
5. **Technical editorial graphic:** three printing phases of Bulletin:
   - 1971–1977 — hectograph;
   - 1977–1980 — mimeograph/rotator;
   - 1980–1987 — offset.
   This graphic must be explicitly labeled **редакционная схема по библиографическому описанию**, not a historical artifact.
6. **Ivanogorod 1977:** verified photo/document.
7. **Map:** only if enough exact printing-point geography is verified; editorial map, not decorative vintage map.

---

## 6. Caption policy

### For periodicals

Include:

- title;
- issue/year;
- material type: `факсимиле обложки`, `страница`, `разворот`;
- archive/source;
- printing method only if bibliographically established for the issue period.

### For people

Do not turn a photo caption into a sermon or indictment. Describe people, role, date, event, source.

### For clandestine locations

Avoid sensational language like `секретный бункер`, `подземная типография`, unless a source actually documents that physical setup.

---

## 7. Production media manifest fields

```text
web_path
archive_photo_path
master_sheet_row
album_id
message_id
historical_date
publication_issue
printing_method
people_identified
caption_source_class
visual_content_verified
source_file_verified
rights_status
crop_notes
used_as
conflict_notes
```

For facsimiles add:

```text
pdf_source
pdf_sha256
page_number
page_visual_verified
quote_ready
```

---

## 8. Do not use

- old Prokhanov `Христианин` images as illustrations of 1971 publisher;
- generated printing presses;
- stock photographs of typewriters;
- fake aged-paper recreations of Bulletin text;
- MASTER caption chronology where it conflicts with bibliographic evidence;
- `Article ready = YES` as a substitute for actual byte/object verification;
- dramatic confiscation numbers in an image caption unless attributed to source.

---

## 9. Definition of done

- [x] archival people shortlist identified;
- [x] Ivanogorod visual candidate identified;
- [x] Bulletin chronology conflict documented;
- [x] visual gaps explicitly recorded instead of filled with placeholders;
- [x] facsimile targets defined;
- [ ] original photo bytes retrieved;
- [ ] Bulletin PDFs re-received / hashed / pages checked;
- [ ] `Вестник спасения` / `Вестник истины` facsimiles selected;
- [ ] rights/attribution pass;
- [ ] derivatives and media manifest;
- [ ] HTML + social/schema image integration;
- [ ] desktop/mobile visual QA.
