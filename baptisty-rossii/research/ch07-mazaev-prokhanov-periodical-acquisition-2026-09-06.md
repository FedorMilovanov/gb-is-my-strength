# Chapter 7 — periodical acquisition pass: `Баптист` 1911–1912

Дата: 2026-09-06  
Статус: **SOURCE IDENTITY / ACQUISITION PASS**  
Chapter: 7 — Дей Мазаев и Иван Проханов  
Publication status: **NOT QUOTE-READY until page visual verification**

## 1. Why this pass exists

Chapter 7 needs the actual periodical objects behind four key D. I. Mazaev locators:

1. `Не та дорога` — `Баптист`, 1911, №34, pp. 267–269;
2. `Пресвитер или совет` — `Баптист`, 1912, №6, pp. 6–8;
3. `Благодетели` — `Баптист`, 1912, №7, p. 9;
4. `Еще по поводу статьи «Пресвитер или Совет»` — `Баптист`, 1912, №15, pp. 5–8.

These bibliographic locators are well-supported in scholarship. This file separates **bibliographic certainty** from **controlled local receipt/page verification**.

---

## 2. MASTER `02 Periodicals` audit

Google Sheet: canonical MASTER.  
Tab: `02 Periodicals`.

### 1911
MASTER contains many received `Баптист` issues from 1911 with:
- filename;
- source HTML;
- relative archive path;
- SHA256.

However the current `02 Periodicals` rows returned in the pass do **not** include №34.

### 1912
Exact sheet search for `1912` returned **zero rows** in `02 Periodicals`.

Therefore:

> none of Chapter 7's 1912 target issues may be called `IN DRIVE` from MASTER evidence as of this pass.

This does not mean the files do not exist elsewhere; it means canonical archive receipt has not been recorded there.

---

## 3. Target A — `Баптист`, 1911, №34

### Bibliographic locator
D. I. Mazaev, `Не та дорога`, `Баптист`, 1911, №34, pp. 267–269.

### External stable corpus discovery
Wikimedia Commons category `Baptist (Russian magazine), 1911` contains a near-complete/full 1911 run and explicitly lists:

- `Баптист. 1911. №34.pdf`
- 12 pages
- displayed size: 16.46 MB
- displayed page dimensions: 1418 × 1877.

Category:
`https://commons.wikimedia.org/wiki/Category:Baptist_(Russian_magazine),_1911`

### Status
- issue identity: **PASS**
- external stable binary source: **PASS**
- MASTER receipt: **OPEN**
- local SHA256: **OPEN**
- page 267–269 visual verification: **OPEN**
- exact article text for quotation: **HOLD until page verification**
- item-level rights statement: **OPEN**

Do not convert the scholarly paraphrase into a direct quotation before page verification.

---

## 4. Target B — `Баптист`, 1912, №6

### Bibliographic locator
D. I. Mazaev, `Пресвитер или совет`, `Баптист`, 1912, №6, pp. 6–8.

Scholarly corroboration:
- research on prewar ECB ministerial election practice gives exactly №6, pp. 6–8;
- related scholarship contrasts Mazaev's emphasis on differentiated ministerial authority with the broader interpretation of universal priesthood in Prokhanov's EC milieu.

### Wikimedia Commons object
Exact file discovered:
`Баптист. 1912. №06.djvu`

Commons metadata reports:
- editor/publisher: Дей Иванович Мазаев;
- place: Ростов-на-Дону;
- publication date: 1912;
- source trail: `rusbaptist.stunda.org/baptist.htm`;
- 28 pages;
- 613,165 bytes (structured data; displayed approx. 599 KB);
- SHA-1: `9749e5cf36f04190aa4c44b956b1afcf067789e5`;
- Commons page marks the mechanical scan / original with a public-domain rationale.

Source page:
`https://commons.wikimedia.org/wiki/File:Баптист._1912._№06.djvu`

### Status
- issue identity: **PASS**
- external binary identity: **PASS**
- preliminary rights: **PASS (Commons PD statement)**
- external SHA-1: **PASS**
- MASTER receipt: **OPEN**
- controlled local bytes: **OPEN**
- local SHA256: **OPEN**
- page 6–8 visual verification: **OPEN**
- quote-ready: **NO**

Important: discovery of a Commons checksum is not a substitute for our own SHA256 after controlled receipt.

---

## 5. Target C — `Баптист`, 1912, №7

### Bibliographic locator
D. I. Mazaev, `Благодетели`, `Баптист`, 1912, №7, p. 9.

Confirmed by the scholarly biography of D. I. Mazaev.

### External binary search result
No exact controlled binary source was recovered in this pass.

Wikimedia Commons `Baptist (Russian magazine), 1912` currently exposes only №6 in that category.

MASTER `02 Periodicals` has no 1912 entries.

### Status
- bibliographic identity: **PASS**
- binary source: **OPEN**
- MASTER receipt: **OPEN**
- page visual: **OPEN**
- rights: **OPEN**
- quote-ready: **NO**

This is currently the weakest of the four acquisition targets.

---

## 6. Target D — `Баптист`, 1912, №15

### Bibliographic locator
D. I. Mazaev, `Еще по поводу статьи «Пресвитер или Совет»`, `Баптист`, 1912, №15, pp. 5–8.

### Public file witness
Public Telegram channel `Синичкин рассказывает` exposes an actual file entry:
- `"Баптист"_15_август 1912 года.pdf`
- displayed size: **69.6 MB**
- issue described as №15, August 1912;
- contents explicitly include D. I. Mazaev, `Еще по поводу статьи «Пресвитеры или Совет»`.

This is a **real file witness**, but it is not yet canonical archive receipt.

### Status
- bibliographic identity: **PASS**
- public binary witness: **PASS**
- MASTER receipt: **OPEN**
- controlled local receipt: **OPEN**
- SHA256: **OPEN**
- page 5–8 visual verification: **OPEN**
- rights: **OPEN**
- quote-ready: **NO**

---

## 7. Acquisition priority

### P0
1. Receive Commons `1912 №6` into controlled archive location.
2. Compute SHA256.
3. Render/check pages containing pp. 6–8.
4. Record rights/provenance and page locator.

### P0
5. Receive Commons `1911 №34`.
6. Compute SHA256.
7. Verify physical pages corresponding to printed pp. 267–269.

### P1
8. Acquire `1912 №15` from the public file witness or a more stable archival mirror.
9. Verify pp. 5–8.

### P1
10. Recover `1912 №7` from a stable repository / source archive.
11. Verify p. 9.

---

## 8. What this changes in Chapter 7

Before this pass all four texts were effectively `bibliographic locator only`.

After this pass:

| Target | Bibliographic | Stable/public binary source | Rights | Local receipt | Page verified |
|---|---|---|---|---|---|
| 1911 №34 | PASS | PASS (Commons corpus) | OPEN | OPEN | OPEN |
| 1912 №6 | PASS | PASS (exact Commons DJVU) | PRELIM PASS | OPEN | OPEN |
| 1912 №7 | PASS | OPEN | OPEN | OPEN | OPEN |
| 1912 №15 | PASS | PASS (Telegram file witness) | OPEN | OPEN | OPEN |

This is a real reduction of research uncertainty, but **not yet completion of the media/quote gate**.
