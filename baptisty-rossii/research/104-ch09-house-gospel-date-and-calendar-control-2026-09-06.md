# 104. Chapter 9 — Дом Евангелия: date / calendar control

Дата QA: 2026-09-06  
Scope: Chapter 9 Fetler + House of Gospel  
Статус: **CALENDAR CONTROL / DO NOT SILENTLY NORMALIZE IMPERIAL DATES**

## 0. Problem

Russian imperial newspapers, church periodicals, official petitions and meeting protocols before the 1918 calendar reform normally use the **Julian civil calendar (old style / O.S.)** unless explicitly stated otherwise.

Foreign correspondence and foreign periodicals normally use the Gregorian calendar (new style / N.S.).

For 1900–1917 the offset is **13 days**.

Therefore a single Chapter 9 event can appear with apparently different dates in Russian and Western sources without any factual contradiction.

### Production prohibition

Never:
- silently convert an O.S. source date to Gregorian and present it as if printed that way;
- compare a Russian newspaper date directly to an American/English letter date without calendar metadata;
- use ISO `YYYY-MM-DD` as a supposedly neutral historical date unless `calendar_style` is known.

Recommended data model:

```text
source_date
calendar_style = old_style | new_style | unknown
normalized_gregorian_date
normalization_rule
source_locator
```

---

## 1. Cornerstone — 8 September 1910

Russian Baptist congress / domestic source trail gives:

**8 Sep 1910 O.S.**

Gregorian equivalent:

**21 Sep 1910 N.S.**

Current production rule:
- historical narrative may retain `8 сентября 1910 года (ст. ст.)`;
- where cross-source chronology matters, add `21 сентября по новому стилю`;
- do not silently store `1910-09-08` as a Gregorian machine date.

Status: **DATE EVENT STRONG / STYLE EXPLICITLY CONTROLLED**.

---

## 2. Opening announcement — `Утренняя звезда`, 16 December 1911

Domestic Russian newspaper dateline:

**16 Dec 1911 O.S.**

Gregorian equivalent:

**29 Dec 1911 N.S.**

The announcement names the intended principal opening for Christmas, 25 Dec.

Important:
- the newspaper issue date and the advertised event date are both inside the Russian imperial calendar context;
- do not read `16 Dec` as modern Gregorian while reading `25 Dec` as Orthodox/Julian Christmas.

Status: **SOURCE-STYLE O.S. ASSUMPTION STRONG; page facsimile still needed for exact typography/locator**.

---

## 3. House opening — Christmas, 25 December 1911

Domestic source-style date:

**25 Dec 1911 O.S.**

Gregorian equivalent:

**7 Jan 1912 N.S.**

This explains why a modern reader may otherwise think that a `Christmas 1911` opening conflicts with January 1912 in Gregorian chronology.

### Production wording

Preferred first occurrence:

> `На Рождество, 25 декабря 1911 года по старому стилю (7 января 1912 года по новому), состоялось открытие Дома Евангелия.`

Use this only after the event itself is page/source verified at publication stage; the calendar conversion itself is deterministic.

Avoid:
> `Дом Евангелия открылся 7 января 1912 года`

without explaining that Russian contemporaries dated the event 25 Dec 1911.

---

## 4. 1913 building dispute

MASTER source lead gives:
- technical committee meeting **19 Nov 1913**;
- press report **29 Nov 1913**.

If these are domestic imperial dates:
- 19 Nov 1913 O.S. = **2 Dec 1913 N.S.**;
- 29 Nov 1913 O.S. = **12 Dec 1913 N.S.**.

Publication rule:
- preserve the printed source date as O.S.;
- convert only in parenthetical/metadata field;
- exact facsimile required before asserting calendar style at page level.

Status: **NORMALIZATION READY / SOURCE PAGE OPEN**.

---

## 5. Fetler arrest: `22 Nov 1914` vs `December 1914`

This is the most useful calendar-resolution finding in Chapter 9.

A later Fetler biography says:
> `в последнюю субботу месяца, 22 ноября 1914 года`

### Calendar test

- **22 Nov 1914 Gregorian was Sunday**.
- **22 Nov 1914 Julian = 5 Dec 1914 Gregorian**.
- **5 Dec 1914 Gregorian was Saturday**.

Therefore the phrase `Saturday, 22 November 1914` is internally consistent **if 22 Nov is O.S.**

This also reconciles much of the apparent conflict with later sources that summarize the arrest as occurring in **December 1914**.

### Current canonical treatment

Use:

> `22 ноября 1914 года по старому стилю (5 декабря по новому), в субботу`

only if the underlying source trail for the arrest is retained and clearly attributed.

For high-level prose before legal-document recovery:

> `в конце 1914 года Фетлер был арестован; поздняя биографическая традиция датирует арест 22 ноября по старому стилю, то есть 5 декабря по новому.`

### What this DOES NOT resolve

Calendar normalization does not by itself resolve:
- exact arrest order date;
- exact court/judgment date;
- whether Siberia or Yakutia was the precise sentence destination;
- exact commutation/expulsion order date;
- date Fetler physically crossed the border.

Those remain legal-source HOLDs.

Status: **NOV/DEC APPARENT CONFLICT SUBSTANTIALLY EXPLAINED BY O.S./N.S.; LEGAL CHRONOLOGY STILL OPEN**.

---

## 6. Foreign sources must stay on their own calendar

### MacArthur letter

Robert Stuart MacArthur → Theodore Roosevelt:

**11 Nov 1911**, United States / Library of Congress manuscript record.

Treat as Gregorian/New Style unless the object explicitly states otherwise.

Do not convert this letter into Russian Old Style in the main citation. If aligning timelines:
- keep `11 Nov 1911 N.S.` as source date;
- optional equivalent `29 Oct 1911 O.S.` only in internal chronology metadata.

### Missionary Review / Fetler 1917

American publication datelines are Gregorian.

When Fetler retrospectively gives Russian event dates, preserve his wording and separately classify whether he is using Russian O.S. memory or converting for Western readers. Do not infer style from publication country alone for dates embedded in recollection.

---

## 7. Chapter 9 date ledger

| Event/object | Source-style date | Calendar | Gregorian normalized | State |
|---|---|---|---|---|
| House cornerstone | 8 Sep 1910 | O.S. | 21 Sep 1910 | strong |
| `Утренняя звезда` opening notice | 16 Dec 1911 | O.S. expected | 29 Dec 1911 | exact page open |
| House opening / Christmas | 25 Dec 1911 | O.S. | 7 Jan 1912 | event strong; page control open |
| technical committee | 19 Nov 1913 | O.S. expected | 2 Dec 1913 | page open |
| press report on building dispute | 29 Nov 1913 | O.S. expected | 12 Dec 1913 | page open |
| Fetler arrest tradition | 22 Nov 1914 | O.S. strongly indicated by weekday | 5 Dec 1914 | calendar resolution strong; legal document open |
| MacArthur letter | 11 Nov 1911 | N.S. | 11 Nov 1911 | primary external object closed |

---

## 8. Machine/publication recommendation

Until a project-wide Baptist date-style contract is deliberately created, Chapter 9 should not introduce a new global schema merely to solve its dates.

At Research level, every ambiguous date claim should carry prose/ledger notes sufficient to reconstruct:
- printed/source date;
- calendar system;
- normalized Gregorian date;
- evidence for the classification.

A future Product date field should be introduced only with real consumers and migration rules, not as an empty registry for CI.

---

## 9. P0 date tasks

1. Visual-check `Утренняя звезда` 16 Dec 1911 masthead/date.
2. Visual-check opening report after the event and see which date/formula it uses.
3. Visual-check 29 Nov 1913 report and 19 Nov committee reference.
4. Recover a primary administrative/court object for Fetler's late-1914 arrest/removal.
5. When writing final prose, display O.S./N.S. explicitly on first occurrence of dates that cross Russian/foreign source traditions.

Current verdict: **CALENDAR MODEL CLOSED FOR CHAPTER 9 / SOURCE-PAGE AND LEGAL-DOCUMENT GATES REMAIN OPEN**.
