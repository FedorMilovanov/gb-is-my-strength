# 108. Chapter 10 — 1917–1921 date and calendar control

Дата прохода: 2026-09-06  
Authority: `docs/BAPTISTY-ROSSII-BOOK-AUTHORITY-V2.md`  
Статус: **RESEARCH CONTROL / CALENDAR NORMALIZATION RULES CLOSED / SOME EVENT STYLES OPEN**

## 0. Why this file exists

Chapter 10 crosses the Russian calendar transition. A date that is correct in a contemporary 1917 Russian source can be wrong if silently inserted into a modern ISO date as though it were Gregorian.

Production rule: **never normalize a 1917 / early-1918 Russian date silently.**

---

## 1. General calendar contract

### Russian domestic dates before the Soviet calendar reform

For events in the former Russian Empire before the civil calendar transition in February 1918:
- preserve the date exactly as given by the primary source;
- record `calendar_style = OS` only when source/context establishes it;
- if a modern Gregorian equivalent is needed, show it explicitly as a conversion, not as a replacement;
- do not convert a late scholarly author's already-normalized date a second time.

### After the transition

Soviet legal/state dates after the February 1918 calendar transition are treated as new-style civil dates unless the source explicitly says otherwise.

### ISO rule

Do not put a historical source date into `YYYY-MM-DD` metadata unless the calendar basis has been resolved.

---

## 2. 1917 event dates

### Tenishev hall freedom meeting — `12 March 1917`

MASTER rows 538 / 1019 / 1626 / 2551 repeat `12 марта 1917` for the Petrograd evangelical freedom celebration.

Current status:
- event tradition: strong;
- exact original publication/dateline: not yet recovered in this lane;
- calendar style: not explicitly established from the original.

Production:
> write `12 марта 1917 года (дата по источнику)` until the primary source is recovered.

Do **not** publish a Gregorian ISO conversion as if closed.

### Moscow Polytechnic Baptist meeting — `3 April 1917`

Scholarly source based on confessional press gives 3 Apr 1917 and exact article locators in `Слово Истины` №1.

Because this is a Russian event/date in 1917, preserve the cited historical date in prose. If the page or original issue shows calendar style, add it to the ledger.

Status: **EVENT DATE STRONG / CALENDAR LABEL NOT YET PAGE-VERIFIED**.

### Vladikavkaz congress — `20–27 Apr 1917`

Contemporary title in `Гость`, May 1917 №5 p.66 explicitly contains `20 по 27 апреля 1917 г.`

This is the strongest date anchor for the event, but the title itself should be quoted as source dating rather than silently translated into Gregorian equivalents.

Status: **PRIMARY SOURCE DATE CLOSED / DISPLAY STYLE MUST REMAIN SOURCE-AWARE**.

### Evangelical Christian congress — `17–25 May 1917`

Repeated MASTER tradition. Protocol/facsimile remains open.

Status: **STRONG / CALENDAR STYLE OPEN**.

---

## 3. Separation decree date problem — January 1918

This document has a genuine source-history date problem and must not be flattened.

Documentary scholarship establishes two important dates:
- **20 Jan 1918** — date of adoption/signing of the underlying decree text (2 Feb Gregorian);
- **23 Jan 1918** — date of official publication under the title `Об отделении церкви от государства и школы от церкви` (5 Feb Gregorian).

Later Soviet/legal citation practice commonly calls it the decree of **23 January 1918**, Sobr. Uzak. 1918 №18 art.263.

### Book rule

Default legal citation:
> `Декрет СНК «Об отделении церкви от государства и школы от церкви», официально опубликованный 23 января 1918 года (подписанный 20 января), СУ №18, ст.263.`

If dual dating is useful in a note:
- 20 Jan O.S. = 2 Feb N.S.;
- 23 Jan O.S. = 5 Feb N.S.

Do not write only `2 февраля 1918` or only `5 февраля 1918` without explaining what is being dated.

Why: the signed text and official publication are different bibliographic/legal events.

---

## 4. 1919–1921 legal dates

These are post-transition Soviet civil dates and can be used directly:

- **4 Jan 1919** — SNK decree on exemption/substitution for military duty on religious convictions, S.U. 1919 №17 art.192;
- **14 Dec 1920** — amended SNK decree, S.U. 1920 №99 art.527;
- **16 Sep 1921** — VTsIK decree ordering review of cases of persons convicted for military evasion/desertion on religious grounds;
- **18 Sep 1921** — publication of the 16 Sep decree in `Известия ВЦИК` №208.

Production rule: distinguish enactment/signing date from publication date when both matter.

---

## 5. 1921 Tver case

MASTER dates the VI All-Russian Christian Youth Congress opening to **2 May 1921** and arrests to 5 May in later narrative.

The documentary 2024 publication confirms the archival case and later central release process.

Production rule:
- `2 May 1921` may be used as congress opening if supported by the archival publication or original permit;
- exact arrest sequence, sentence dates and release dates should be tied to individual archival documents;
- do not compress `permission → arrest → sentence → VTsIK intervention → release` into one date.

Status: **EVENT CHRONOLOGY STRONG / INDIVIDUAL DOCUMENT DATES NEED LOCATORS IN FINAL CLAIM MATRIX**.

---

## 6. Date fields for future media ledger

For every 1917/early-1918 historical object use:
- `historical_date` — source date string;
- `historical_date_precision` — day/month/year or range;
- `calendar_style` — `OS`, `NS`, `dual`, or `unresolved`;
- `gregorian_equivalent` — optional, only when conversion is proven;
- `date_source` — exact page/caption/archive record;
- `date_conflict_notes` — required when later MASTER captions differ.

Never infer `OS` from appearance alone; document the basis.

---

## 7. Closed production rules

1. 1917 Russian source dates are preserved, not silently modernized.
2. Separation decree gets explicit signed-vs-official-publication treatment.
3. 1919–1921 Soviet legal dates are new-style civil dates.
4. ISO metadata is forbidden until calendar style is resolved.
5. Later modernized dates must not be converted again.

This resolves the chapter-level calendar policy even though several event-specific primary facsimiles remain open.
