# Chapter 7 — Vladikavkaz 1912 date control

Дата прохода: 2026-09-06  
Статус: **DISCREPANCY CONTROL / NARRATIVE RULE**  
Связанный PR: Chapter 7 — Мазаев и Проханов  
Publication status: **research control, not facsimile-complete**

## 1. Почему нужен отдельный контроль

В существующем MASTER caption и в ряде поздних справочных источников Владикавказское совещание Мазаева и Проханова датируется **18 июля 1912 года**.

Однако опубликованный текст самого договора начинается собственной датировочной формулой:

> «Сего 19-го июля 1912 года мы, нижеподписавшиеся, собравшись во Владикавказе…»

Поэтому формула `соглашение подписано 18.07.1912` больше не допустима как бесспорная.

---

## 2. Два уровня события

### A. Совещание / начало переговоров

Поздняя энциклопедическая и историческая традиция датирует встречу:

**18 июля 1912 года, Владикавказ.**

В ней участвовали представители двух братств; среди центральных фигур — И. С. Проханов и Д. И. Мазаев. Встреча была посвящена вопросу о Соединительном комитете и механизму дальнейшего сотрудничества.

### B. Сохранившийся текст договора

В воспроизведённом тексте документа стоит дата:

**19 июля 1912 года.**

То есть наиболее осторожная реконструкция на текущем уровне evidence:

> совещание началось / датируется 18 июля; письменный договор, возникший в результате переговоров, датирован 19 июля 1912 года.

Это объясняет расхождение без искусственного выбора одной даты и без объявления одного из источников ошибочным до проверки первичного facsimile.

---

## 3. Source trail

### Early-source trail

Поздняя `История евангельских христиан-баптистов в СССР` и более развернутая `История ЕХБ 1905–1944` ссылаются на издание:

**`Письма к братьям евангельским христианам-баптистам. Тифлис, 1916`**.

В `Истории ЕХБ 1905–1944` текст Владикавказского договора воспроизводится со ссылкой:

**А. Е. Леушкин, `Письма к братьям`, с. 76.**

Другая ссылка на тот же ранний корпус используется для материала о последующем совещании 1913 года.

Public source trails:
- `https://djvu.online/file/gUelaYOtdwn1E` — section `Владикавказское соглашение`, reproduces the 19 July opening formula and cites A. E. Leushkin, p. 76;
- `https://rusbaptist.stunda.org/zips/historyofecb.pdf` — bibliography/footnotes identify `Письма к братьям евангельским христианам-баптистам. Тифлис, 1916` as an early source used throughout the history;
- `https://mbchurch.ru/upload/iblock/b044d859a8847d7de9541fccf8d8566f/historyofecb33isff.pdf` — same bibliographic object is independently present in the published history apparatus.

### Current acquisition status

Exact searches performed 2026-09-06:
- GitHub `gb-is-my-strength` + `Research`: no standalone Leushkin object found;
- connected Google Drive: no standalone `Письма к братьям... Тифлис, 1916` found by title/author query;
- public web: bibliographic object is repeatedly cited, but no standalone controlled scan was recovered in this pass.

Therefore:

- bibliographic identity: **PASS**
- early documentary citation trail: **PASS**
- exact original/facsimile receipt: **OPEN**
- page 76 visual verification in 1916 edition: **OPEN**
- rights: **OPEN**
- local SHA256: **OPEN**

---

## 4. Attribution of A. E. Leushkin

`Братский Вестник`, 1967, №4 identifies **Андрей Ефимович Леушкин** as a prominent worker of the Tiflis Baptist community and states that he organized a second Tiflis Baptist congregation in 1908.

This supports the identity behind later citations `А. Е. Леушкин`.

But the 1916 title page has not yet been visually inspected. Therefore production bibliography should not invent publisher, print shop, pagination, subtitle or authorship wording beyond what the recovered source trail explicitly gives.

---

## 5. MASTER correction rule

Current Chapter 7 MASTER visual candidates:
- row 1882 — `photos/photo_1883@19-07-2025_21-11-46.jpg`
- row 1883 — `photos/photo_1884@19-07-2025_21-11-46.jpg`

Their catalog caption currently associates the object with **18 July 1912** and the Vladikavkaz agreement.

### Do not silently rewrite MASTER

The connected Sheet is not writable in the current workflow and no shadow catalog is allowed.

Instead record:

`conflict_notes = "MASTER caption uses 18 Jul 1912 for Vladikavkaz agreement; later reference tradition dates meeting to 18 Jul, while reproduced agreement text itself is dated 19 Jul 1912. Preserve distinction until 1916 facsimile/page 76 is recovered."`

### Hero caption rule

Until the binary object and primary page are inspected, **forbidden**:

> «Мазаев и Проханов подписывают соглашение 18 июля 1912 года».

Allowed neutral form:

> «Владикавказ, 18–19 июля 1912 года. Представители двух братств обсуждают механизм совместной работы; сохранившийся текст договора датирован 19 июля.»

If the image turns out not to depict the actual meeting/document, it cannot be used as hero regardless of MASTER caption.

---

## 6. Calendar-style caution

The recovered document preserves the contemporary wording `19-го июля 1912 года`.

Imperial Russia used the Julian calendar in 1912, but this pass has **not** verified whether later historical captions normalized any of these dates to the Gregorian calendar or simply reproduced old-style dates.

Therefore:

- do not automatically convert 18/19 July to 31 July/1 August in Chapter 7;
- do not label `old style` / `new style` until the 1916 source or another primary publication explicitly establishes the editorial convention;
- store calendar-system precision as an open metadata field.

---

## 7. Narrative consequence

The date discrepancy actually improves the chapter's documentary precision:

- **18 July** can describe the reported meeting/negotiation;
- **19 July** can describe the date written into the preserved agreement text;
- the event should be referred to as **18–19 July 1912** when a single range is required.

The agreement was a proposal/mechanism for cooperation and future approval, **not a completed merger of the two unions**.

The later 1913 discussion, as reported in the historical source trail, says that practical steps to implement the Vladikavkaz agreement had not been taken. This further rules out language implying an accomplished institutional union in July 1912.

---

## 8. Next acquisition target

P0 object:

`Письма к братьям евангельским христианам-баптистам. Тифлис, 1916`, especially **p. 76**.

Acquisition DoD:

- [ ] controlled binary received;
- [ ] title page visually verified;
- [ ] authorship/editorial attribution verified from the object itself;
- [ ] page 76 visually verified;
- [ ] agreement opening/signatures transcribed against scan;
- [ ] page count recorded;
- [ ] SHA256 recorded;
- [ ] provenance/rights recorded;
- [ ] calendar-style convention evaluated;
- [ ] Chapter 7 visual dossier and final caption updated.

Until then the correct status is:

**DATE DISTINCTION RESOLVED FOR NARRATIVE / PRIMARY FACSIMILE OPEN.**
