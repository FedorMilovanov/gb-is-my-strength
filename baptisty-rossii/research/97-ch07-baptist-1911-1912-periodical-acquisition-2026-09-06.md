# 97. Chapter 7 — `Баптист` 1911–1912: periodical acquisition lane

Дата: 2026-09-06  
Статус: **SOURCE IDENTITY / EXTERNAL OBJECT PASS; NOT QUOTE-READY**  
Chapter: 7 — Дей Мазаев и Иван Проханов

## 1. Зачем нужен этот pass

Chapter 7 опирается на четыре текста Д. И. Мазаева, которые позволяют показывать его позицию по собственным публикациям, а не через поздние пересказы:

1. `Не та дорога` — `Баптист`, 1911, №34;
2. `Пресвитер или совет` — `Баптист`, 1912, №6, с. 6–8;
3. `Благодетели` — `Баптист`, 1912, №7, с. 9;
4. `Еще по поводу статьи «Пресвитер или Совет»` — `Баптист`, 1912, №15, с. 5–8.

Цель: отделить **bibliographic identity** от controlled receipt, SHA256 и page visual verification.

---

## 2. MASTER archive status

Canonical Google Sheet: MASTER, tab `02 Periodicals`.

### 1911
В MASTER есть много полученных выпусков `Баптиста` 1911 года с filenames/source/archive path/SHA256, но в текущем поиске **№34 не найден как received row**.

### 1912
Поиск `1912` в `02 Periodicals` в текущем pass не дал полученных выпусков.

Следовательно, ни один целевой выпуск 1912 нельзя называть `IN DRIVE` только на основании MASTER.

Это не утверждение, что binary нигде не существует; это утверждение о состоянии канонического receipt ledger.

---

## 3. Target A — `Баптист`, 1911, №34

### Article
Д. И. Мазаев, `Не та дорога`.

### Page-locator discrepancy
Две scholarly bibliography chains расходятся на одну страницу:
- биографическая библиография Мазаева: **с. 268–269**;
- другая исследовательская работа: **с. 267–269**.

До прямой визуальной проверки выпуска canonical locator: `267/268–269 — VERIFY FROM FACSIMILE`.

Не превращать scholarly paraphrase в direct quote.

### External exact issue identity
Wikimedia Commons category `PDF files in Russian - Religion` содержит:
- `Баптист. 1911. №34.pdf`;
- 12 pages;
- 1418 × 1877;
- about 16.46 MB.

Public category:
`https://commons.wikimedia.org/wiki/Category:PDF_files_in_Russian_-_Religion`

### Status
- issue identity: PASS;
- external stable object listing: PASS;
- exact article page range: DISCREPANCY / VISUAL CHECK REQUIRED;
- item-level rights: OPEN until exact file page is read;
- MASTER receipt: OPEN;
- controlled local bytes: OPEN;
- local SHA256: OPEN;
- page visual verification: OPEN;
- quote-ready: NO.

---

## 4. Target B — `Баптист`, 1912, №6

### Article
Д. И. Мазаев, `Пресвитер или совет`, с. 6–8.

Bibliographic locator independently corroborated in scholarship on ministerial election / universal priesthood in prewar ECB history.

### Exact Wikimedia Commons object
`Баптист. 1912. №06.djvu`

Commons metadata:
- editor/publisher: Дей Иванович Мазаев;
- place: Ростов-на-Дону;
- year: 1912;
- 28 pages;
- data size: **613,165 bytes** (display ~599 KB);
- dimensions: 777 × 1039;
- media type: `image/vnd.djvu`;
- external checksum SHA-1: `9749e5cf36f04190aa4c44b956b1afcf067789e5`;
- source trail: `rusbaptist.stunda.org/baptist.htm`;
- Commons states public-domain rationale for the mechanical scan / pre-revolutionary original.

Public object:
`https://commons.wikimedia.org/wiki/File:Баптист._1912._№06.djvu`

### Status
- issue identity: PASS;
- external binary identity: PASS;
- preliminary rights: PASS / Commons PD rationale;
- external SHA-1: PASS;
- controlled local receipt: OPEN;
- local SHA256: OPEN;
- printed pages 6–8 visual verification: OPEN;
- quote-ready: NO.

**Rule:** external SHA-1 is provenance metadata, not a substitute for our SHA256 after controlled receipt.

---

## 5. Target C — `Баптист`, 1912, №7

### Article
Д. И. Мазаев, `Благодетели`, с. 9.

Bibliographic identity is confirmed by the scholarly biography/bibliography of D. I. Mazaev.

### External state
Current Wikimedia Commons category for 1912 exposes only №6. No exact stable binary for №7 was recovered in this pass.

MASTER `02 Periodicals`: no 1912 receipt.

### Status
- bibliographic identity: PASS;
- stable binary source: OPEN;
- rights: OPEN;
- MASTER/local receipt: OPEN;
- page visual verification: OPEN;
- quote-ready: NO.

This is currently the weakest of the four acquisition targets.

---

## 6. Target D — `Баптист`, 1912, №15

### Article
Д. И. Мазаев, `Еще по поводу статьи «Пресвитер или Совет»`, с. 5–8.

### Public file witness
Public Telegram channel `Синичкин рассказывает` exposes a real file entry:
- `"Баптист"_15_август 1912 года.pdf`;
- displayed size **69.6 MB**;
- issue №15, August 1912;
- listed contents include D. I. Mazaev’s continuation of the `Пресвитер или Совет` discussion.

Public witness:
`https://t.me/s/sinichkinAS`

### Status
- bibliographic identity: PASS;
- public binary witness: PASS;
- stable archival mirror: OPEN;
- rights: OPEN;
- MASTER/local receipt: OPEN;
- SHA256: OPEN;
- pages 5–8 visual verification: OPEN;
- quote-ready: NO.

Prefer a stable archival mirror or controlled receipt over treating the Telegram listing itself as publication infrastructure.

---

## 7. Acquisition priority

### P0-A — 1912 №6
1. Receive exact Commons DJVU into controlled archive location.
2. Compute SHA256 of received bytes.
3. Render/check physical pages containing printed pp. 6–8.
4. Record page mapping, provenance and rights.
5. Only then mark quote-ready.

### P0-B — 1911 №34
1. Receive exact Commons PDF.
2. Compute SHA256.
3. Inspect pages around printed 267–269.
4. Resolve `267–269` vs `268–269` bibliography discrepancy.
5. Record item-level rights.

### P1-A — 1912 №15
1. Acquire controlled binary from Telegram file witness or a more stable mirror.
2. SHA256 + pp. 5–8 visual check.
3. Rights/provenance ledger.

### P1-B — 1912 №7
1. Find stable repository/object.
2. Receive/hash.
3. Verify p. 9.

---

## 8. Current acquisition table

| Target | Bibliographic | External object/witness | Rights | Controlled receipt | SHA256 | Page verified |
|---|---|---|---|---|---|---|
| 1911 №34 | PASS; page start 267/268 conflict | PASS — Commons listing | OPEN | OPEN | OPEN | OPEN |
| 1912 №6 | PASS | PASS — exact Commons DJVU | PRELIM PASS | OPEN | OPEN | OPEN |
| 1912 №7 | PASS | OPEN | OPEN | OPEN | OPEN | OPEN |
| 1912 №15 | PASS | PASS — public file witness | OPEN | OPEN | OPEN | OPEN |

## 9. Book impact

Этот pass существенно уменьшает uncertainty, но **не закрывает quote/media gate**.

Для Chapter 7 уже допустимы:
- названия текстов;
- номера выпусков;
- осторожное описание направления полемики со scholarly attribution.

Пока недопустимы:
- длинные прямые цитаты;
- утверждение `page_visual_verified`;
- утверждение `IN DRIVE` для этих targets;
- выдача внешнего checksum за наш SHA256.
