# 99. Chapter 8 — Республика печати: archival visual dossier

Дата прохода: 2026-09-06  
Authority: Book Authority v2 + MASTER Archive Catalog  
Статус: **DOCUMENTARY VISUAL SHORTLIST / TWO STRONG LOCAL RECEIPTS IDENTIFIED / NOT BOOK-READY**

## 0. Визуальный принцип главы

Chapter 8 нельзя превращать в портретную галерею редакторов.

Предпочтительный visual language:
1. реальный журнал / газета / письмо / листок;
2. реальный читатель / книгоноша / редакционная сцена;
3. документ цензуры / суда / конфискации;
4. только затем — портрет как supporting figure.

Запрещено:
- AI-реконструкция подпольной редакции `Беседы`;
- постановочная фотография, выданная за документальную сцену;
- generic old-newspaper texture;
- внешний случайный портрет вместо архивного объекта;
- `Article ready=YES` трактовать как `site-ready`.

Full gate:
`identity → provenance → rights → exact caption → binary receipt → SHA256 → derivative → media ledger`.

---

## 1. HERO strategy

### Preferred HERO-A — representative early print facsimile

Лучший концептуальный hero — подлинный дореволюционный печатный объект, визуально читаемый как часть реальной print network.

Priority:
1. recovered `Беседа` facsimile, если provenance/rights закроются;
2. `Христианин` 1905/1906 trial/first regular issue;
3. `Баптист` 1907 №1;
4. если ранние объекты не готовы — честный local historical object, а не реконструкция.

### Why not a generic Prokhanov portrait

Глава о медиасистеме. Один редактор визуально скрывает коллективность производства, корреспонденции, подписки и чтения.

---

## 2. PRELUDE — книгоноша как предыстория print network

### FIG-BOOK-01 — Иван Иванович Жидков, книгоноша

MASTER row 760  
`photos/photo_761@18-08-2023_13-51-25.jpg`  
Caption source: DIRECT  
Article ready: YES  
Album A0418 / message 1327.

Caption identifies I. I. Zhidkov as a Bible colporteur.

**Gate warning:** current MASTER category does not naturally match the described person, so `visual_content_verified` is mandatory.

Exact Drive filename search on 2026-09-06 returned no result.

Status: `CATALOG IDENTITY VERIFIED / BINARY NOT RECEIVED / VISUAL CONTENT OPEN / RIGHTS OPEN`.

### EXCLUDE

- MASTER row 348 `Задержание книгоноши 1886` — `Article ready=NO`.
- MASTER row 536 — caption itself says image is probably staged; `Article ready=NO`.

Neither may be used as documentary evidence or dramatic hero.

---

## 3. `Беседа`: P0 missing visual

MASTER rows 991 / 1609 / 2428 preserve the 1895 narrative connecting police discovery, Prokhanov, clandestine `Беседа`, foreign transfer and continued circulation.

These are source/catalog leads, **not proof that the underlying image is an issue facsimile**.

Desired objects:
- early 1889/1890–1893 hectograph/lithograph phase;
- foreign/Stockholm phase after 1894.

Need to verify:
- masthead `Вифезда` / `Беседа`;
- issue/date;
- production method;
- pagination;
- editorial/byline evidence;
- provenance and rights.

Current status:
- series identity: VERIFIED;
- broad chronology: STRONGLY SUPPORTED;
- representative exact issue binary: OPEN;
- page visual: OPEN;
- rights: OPEN.

No generated substitute is allowed.

---

## 4. `Христианин`: trial → regular typography

### MASTER-HR-01

MASTER row 185  
`photos/photo_186@16-09-2022_21-26-54.jpg`  
Historical years: 1905, 1906  
Category: documents/books/press  
Caption source: DIRECT  
Article ready: YES.

Caption records:
- trial issue in Nov 1905;
- regular typography from Jan 1906;
- early programmatic article.

Exact filename Drive search: no result.

Status: `CATALOG IDENTITY / BINARY NOT RECEIVED`.

### Official PDF corpus

Repo ledger 84 stores official `baptist.org.ru` routes for `Христианин` 1906 №1, 4, 5, 6, 8–12; №3 was bibliographically confirmed while the direct binary route remained unresolved in the July pass.

MASTER `02 Periodicals` search for `1906` on 2026-09-06 surfaced received `Братский листок`, not a received `Христианин` 1906 issue.

**Production route:** receive exact official `Христианин` 1906 №1, hash, map pages, then use it. Do not rely on the unresolved Telegram JPEG.

---

## 5. `Братский листок`: acquisition no longer a generic blocker

This section supersedes the earlier assessment that representative 1906 bytes were still missing.

### 5.1 Strong local object — MASTER row 75

Canonical receipt:
- series: `БРАТСКИЙ ЛИСТОК`;
- year: 1906;
- source filename labels May;
- **title audit 2026-07-31 says first page prints it as appendix to `Христианин` №6, 1906**;
- page count: **10 pages**;
- size: **4.650 MiB**;
- SHA256: **`1f2576aeeefdf95f4366b740ecf06a7a1dbd374b82c9575a68d8931021db258b`**.

Status:
- binary receipt: CLOSED;
- SHA256: CLOSED;
- first-page / printed-parent visual verification: CLOSED;
- rights/provenance for site republication: OPEN;
- derivative/web path: OPEN.

This is already one of the best Chapter 8 Book Authority objects.

### 5.2 Other received 1906 objects

- Aug 1906 — SHA256 `48d8611d27ad9d26329e713e4405ae6d11719f9b42704b88ca68f506f26c45b9`;
- Jul 1906 — `09fee235887ae29dd60060e277b7208dae3e6baa6c25e95fca7f26269355f333`;
- Nov 1906 — `fb9030ad4a1309ab578374731c07180b885488406e46ead566b13d7b837a6554`;
- Sep 1906 — `a90c76e0375ac8ac49177ed5d369891123c42f76748519a4f1db88aeb3af5130`.

A second Nov-labelled receipt has a different SHA256 (`67c1de40d68ea200c4cc1ea80fa61db6697437d84ad3a9365bad01db1de2bc25`); do not deduplicate only from month/size.

### 5.3 Series-start precision

MASTER photo caption says the supplement began from March 1906. That first-issue/start-month claim is now independently strengthened by an exact external first-issue image, but calendar/month chronology still must be reconciled against the complete run before asserting a full monthly sequence.

### 5.4 External first-issue object — Wikimedia Commons

Wikimedia Commons exposes exact file `Братский листок.jpg` with metadata:
- description: **title page of the first issue of `Братский листок`, 1906**;
- source: `Братский листок`, 1906, №1;
- original dimensions: **774 × 1175 px**;
- file size: **229,776 bytes**;
- media type: JPEG;
- Commons checksum SHA-1: **`9ba83bc93f22b9c31ea7380a5a50aa52fb08d28a`**;
- rights: **Public Domain** / PD-old-70-expired route on Commons.

This external object is **not the same object** as MASTER row 75 / printed parent `Христианин` №6. Do not collapse them.

Current status for Commons first issue:
- exact issue identity: CLOSED;
- visible title-page identity: CLOSED from Commons object metadata/preview;
- external provenance: CLOSED;
- external rights: CLOSED / PD;
- external SHA-1: CLOSED;
- controlled local receipt: OPEN (runtime download unavailable in this pass);
- our SHA256: OPEN;
- archive `IN DRIVE`: OPEN;
- derivative/web path: OPEN.

Thus:
- representative 1906 local object: CLOSED at byte/hash level via MASTER row75;
- exact first issue: CLOSED at external identity/rights level, but controlled local receipt is still OPEN.

---

## 6. `Баптист`, 1907 №1

Public exact object:
- Wikimedia Commons first-cover scan;
- full 22-page first issue available in public/official corpus;
- preliminary public-domain route established.

MASTER row 2289 also identifies the June 1907 launch.

MASTER `02 Periodicals` search for 1907 did not surface a received `Баптист` 1907 row.

Status:
- title/year/issue identity: CLOSED;
- public facsimile: CLOSED;
- preliminary rights: CLOSED / PD candidate;
- canonical local receipt: OPEN;
- our SHA256: OPEN;
- derivative: OPEN.

Can become hero/focal spread after controlled receipt.

---

## 7. `Утренняя звезда`: weekly tempo

### 7.1 1910 target

MASTER photo row 93 identifies issue №30 / 23 July 1910; exact JPEG filename search returned no Drive result.

Official `baptist.org.ru` index and repo ledger 80 expose the 1910 annual run; ledger 80 recorded 47 direct PDF routes, with №36 as an explicit hole in that pass.

Target article: Prokhanov, `Свобода слова в деле религии или свобода проповеди`, 1910 №4 — especially valuable because it explicitly connects religious liberty with spoken/printed proclamation.

MASTER `02 Periodicals` does **not** currently establish a 1910 local receipt.

Status: `OFFICIAL ROUTE / LOCAL RECEIPT OPEN`.

### 7.2 Strong local censorship object — 30 Oct 1915

MASTER `02 Periodicals`, row 97:
- series: `УТРЕННЯЯ ЗВЕЗДА`;
- date: **30 Oct 1915**;
- file: `Утренняя_Звезда_30_октября_1915_года_.pdf`;
- size: **7.632 MiB**;
- SHA256: **`95751678e4e943de85a2648e79f5e2fa88cb4a55295d0254d1a15e83211c38f7`**.

MASTER annotation explicitly notes **white unprinted strips where material was removed by censorship**.

Contents also include:
- tenth anniversary of `Христианин`;
- `Еще о журналах`;
- war/current affairs;
- community/legal material.

Editorial value: one local object physically joins weekly evangelical current-affairs publishing, the mature print ecosystem, wartime public life and censorship.

Current status:
- canonical receipt: CLOSED;
- SHA256: CLOSED;
- issue/date identity: CLOSED;
- censorship interpretation: MASTER-ANNOTATED;
- exact page visual recheck: OPEN;
- rights/provenance: OPEN;
- derivative: OPEN.

This is the second strongest currently local Chapter 8 object.

---

## 8. 1911–1912 censorship / litigation cross-publication scene

MASTER row 1485 / duplicate 2264 attributes to `Утренняя звезда`, 21 Dec 1912, a report about prosecution of an acting `Баптист` editor, confiscation, trial and destruction of an issue.

### Resolved issue-number conflict

The MASTER caption first says `№97` and later `№27`.

A current full-text issue witness resolves the issue identity as:
- **`Баптист` №27**;
- **29 June 1911**;
- Fedor Noskov, `Автобиография и исповедь сектанта`, on p. 7 of the recovered issue witness;
- the issue is identified as the confiscated number.

Canonical rule:
- `№97` = caption/OCR/transcription error;
- `№27, 29 Jun 1911` = CLOSED issue identity;
- detailed 1912 court sequence (acting editor, legal article, exact hearing date, closed-session detail, acquittal wording, destruction-order wording) = **HOLD** pending primary/independent legal source.

Do not let modern archive publisher metadata override established Baptist editorial chronology where they conflict.

Potential production spread: confiscated issue + later `Утренняя звезда` report, but only after the court-side source is independently closed.

---

## 9. External anti-sect / secular public sphere

Use 1–2 exact objects from existing research 71–76:
- diocesan/missionary page classifying Stundists/Baptists;
- secular/public press item showing a different register.

Do not create a collage of hostile phrases.

Required fields:
- publication title;
- date/issue;
- page;
- institutional provenance;
- rights;
- enough context to avoid misleading quotation.

---

## 10. Audience segmentation

Potential facsimiles:
- `Юный христианин`;
- `Молодой виноградник`;
- a selected `Христианин` leaflet/brochure;
- received `Братский листок` as the strongest concrete evidence of editorial segmentation.

Use only objects that prove a distinct audience/function.

---

## 11. Revised documentary sequence

1. verified colporteur/Bible-distribution object if byte recovered;
2. `Беседа` exact clandestine facsimile — desired early hero but still P0 gap;
3. `Христианин` 1905/1906 trial-to-type object;
4. **external `Братский листок` №1, 1906** for title-page/start identity;
5. **received `Братский листок` 1906 / parent №6** — local object A;
6. `Баптист` 1907 №1 — controlled receipt pending;
7. `Утренняя звезда` 1910 №4 — printed-freedom argument;
8. **received `Утренняя звезда` 30.10.1915** — local censorship object B;
9. one controlled external anti-sect/public witness.

Ideal final chapter: 5–7 visual events. Book Authority minimum still requires at least 2 local historical objects through the full gate.

---

## 12. Immediate P0 media queue

1. Re-open/render MASTER row75 received `Братский листок`; choose one network page and settle rights/provenance.
2. Controlled-receive Commons `Братский листок` №1 and compute our SHA256; do not confuse it with row75.
3. Re-open/render MASTER row97 `Утренняя звезда` 30.10.1915; identify exact censorship-strip page(s), settle rights/provenance.
4. Receive/hash official `Христианин` 1906 №1.
5. Receive/hash `Баптист` 1907 №1.
6. Receive/hash `Утренняя звезда` 1910 №4.
7. Recover representative `Беседа` facsimile.
8. Select one external anti-sect/public press page.
9. Generate derivatives only after source objects are verified.

Current verdict: **SHORTLIST STRONG / TWO LOCAL RECEIPTS IDENTIFIED / FIRST `БРАТСКИЙ ЛИСТОК` EXTERNAL ID+RIGHTS CLOSED / RIGHTS + PAGE-VISUAL + DERIVATIVES STILL OPEN / NOT BOOK-READY**.
