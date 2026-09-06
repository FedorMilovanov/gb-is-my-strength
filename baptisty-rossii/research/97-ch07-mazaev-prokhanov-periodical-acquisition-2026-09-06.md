# 97. Chapter 7 — periodical acquisition pass: `Баптист` 1911–1912

Дата: 2026-09-06  
Authority: Book Authority v2 + canonical MASTER `02 Periodicals`  
Статус: **SOURCE IDENTITY / ACQUISITION PASS; NOT QUOTE-READY**  
Chapter: 7 — Дей Мазаев и Иван Проханов

## 1. Why this pass exists

Chapter 7 needs the actual periodical objects behind four key D. I. Mazaev locators:

1. `Не та дорога` — `Баптист`, 1911, №34, pp. 267–269;
2. `Пресвитер или совет` — `Баптист`, 1912, №6, pp. 6–8;
3. `Благодетели` — `Баптист`, 1912, №7, p. 9;
4. `Еще по поводу статьи «Пресвитер или Совет»` — `Баптист`, 1912, №15, pp. 5–8.

The bibliographic locators are strong enough for research navigation. They are **not** yet sufficient for long quotation or book facsimile use.

---

## 2. Canonical MASTER `02 Periodicals` audit

### 1911
MASTER contains many received `Баптист` issues from 1911 with filename, archive path and SHA256, but the rows recovered in this pass do **not** include №34.

### 1912
Exact search for `1912` in `02 Periodicals` returned **zero rows**.

Therefore none of the Chapter 7 1912 targets may currently be called `IN DRIVE` on the authority of MASTER.

This statement is intentionally narrow: it means **canonical receipt is not recorded**, not that no copy exists anywhere else.

---

## 3. Target A — `Баптист`, 1911, №34

### Bibliographic locator
D. I. Mazaev, `Не та дорога`, `Баптист`, 1911, №34, pp. 267–269.

### External stable corpus
Wikimedia Commons category `Baptist (Russian magazine), 1911` explicitly lists:
- `Баптист. 1911. №34.pdf`;
- 12 pages;
- displayed size 16.46 MB;
- displayed page dimensions 1418 × 1877.

Category:
`https://commons.wikimedia.org/wiki/Category:Baptist_(Russian_magazine),_1911`

### Gate
- issue identity: **PASS**
- stable external binary source: **PASS**
- item-level rights statement: **OPEN**
- MASTER/local receipt: **OPEN**
- local SHA256: **OPEN**
- pp. 267–269 visual verification: **OPEN**
- quote-ready: **NO**

---

## 4. Target B — `Баптист`, 1912, №6

### Bibliographic locator
D. I. Mazaev, `Пресвитер или совет`, `Баптист`, 1912, №6, pp. 6–8.

### Exact Commons object
`Баптист. 1912. №06.djvu`

Commons metadata reports:
- editor/publisher: Дей Иванович Мазаев;
- Ростов-на-Дону;
- publication date 1912;
- source trail: `rusbaptist.stunda.org/baptist.htm`;
- 28 pages;
- 613,165 bytes in structured metadata;
- SHA-1 `9749e5cf36f04190aa4c44b956b1afcf067789e5`;
- public-domain rationale for the mechanical scan / pre-revolutionary original.

Source:
`https://commons.wikimedia.org/wiki/File:Баптист._1912._№06.djvu`

### Gate
- issue identity: **PASS**
- external binary identity: **PASS**
- preliminary rights: **PASS / Commons PD statement**
- external SHA-1: **PASS**
- controlled local receipt: **OPEN**
- local SHA256: **OPEN**
- pp. 6–8 visual verification: **OPEN**
- quote-ready: **NO**

External checksum discovery is not a substitute for our own SHA256 after controlled receipt.

---

## 5. Target C — `Баптист`, 1912, №7

### Bibliographic locator
D. I. Mazaev, `Благодетели`, `Баптист`, 1912, №7, p. 9.

### Current acquisition state
No exact controlled binary source was recovered in this pass.

The Commons 1912 category currently exposes only №6, and canonical MASTER contains no 1912 entries.

### Gate
- bibliographic identity: **PASS**
- binary source: **OPEN**
- MASTER/local receipt: **OPEN**
- page visual: **OPEN**
- rights: **OPEN**
- quote-ready: **NO**

This is currently the weakest of the four periodical acquisition targets.

---

## 6. Target D — `Баптист`, 1912, №15

### Bibliographic locator
D. I. Mazaev, `Еще по поводу статьи «Пресвитер или Совет»`, `Баптист`, 1912, №15, pp. 5–8.

### Public file witness
Public Telegram channel `Синичкин рассказывает` exposes an actual file entry:
- `"Баптист"_15_август 1912 года.pdf`;
- displayed size **69.6 MB**;
- issue identified as №15, August 1912;
- contents explicitly include D. I. Mazaev's continuation on `Пресвитер / Совет`.

This proves a public binary witness exists. It does **not** establish canonical archive receipt, rights or our SHA256.

### Gate
- bibliographic identity: **PASS**
- public binary witness: **PASS**
- MASTER/local receipt: **OPEN**
- SHA256: **OPEN**
- pp. 5–8 visual verification: **OPEN**
- rights: **OPEN**
- quote-ready: **NO**

---

## 7. Acquisition priority

### P0
1. Receive Commons `1912 №6` into the controlled archive.
2. Compute SHA256.
3. Render/inspect the pages carrying printed pp. 6–8.
4. Record rights/provenance/page locator.

### P0
5. Receive Commons `1911 №34`.
6. Compute SHA256.
7. Verify physical pages corresponding to printed pp. 267–269.

### P1
8. Acquire `1912 №15` from the public file witness or a more stable archival mirror.
9. Verify pp. 5–8.

### P1
10. Recover `1912 №7` from a stable repository/source archive.
11. Verify p. 9.

---

## 8. State transition

| Target | Bibliographic | Stable/public binary source | Rights | Local receipt | Page verified |
|---|---|---|---|---|---|
| 1911 №34 | PASS | PASS (Commons corpus) | OPEN | OPEN | OPEN |
| 1912 №6 | PASS | PASS (exact Commons DJVU) | PRELIM PASS | OPEN | OPEN |
| 1912 №7 | PASS | OPEN | OPEN | OPEN | OPEN |
| 1912 №15 | PASS | PASS (public file witness) | OPEN | OPEN | OPEN |

Result: research uncertainty is materially reduced, but the quote/media gate remains open.
