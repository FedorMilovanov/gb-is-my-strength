# 126. Chapter 14 — 1929: закон, который изменил церковную жизнь — legal/text control

Дата прохода: 2026-09-06  
Authority: `docs/BAPTISTY-ROSSII-BOOK-AUTHORITY-V2.md`  
Статус: **1929 ACT IDENTITY CLOSED / ORIGINAL-TEXT CONTROL STRONG / CONSOLIDATED-TEXT CONTAMINATION GATE ACTIVE / FACSIMILE RECEIPT OPEN**

## 0. Purpose

Chapter 14 is unusually vulnerable to a subtle source error: modern legal databases often display the 8 April 1929 decree **with later amendments already folded into the text**.

That is acceptable for studying the later legal regime, but unsafe if the book says:

> `8 апреля 1929 года статья N гласила ...`

Therefore this control file separates:
1. the identity/publication of the 1929 act;
2. wording attributable to the **original 1929 text**;
3. later consolidated/amended readings;
4. later implementation acts;
5. the separate 18 May 1929 constitutional amendment.

Rule:

> **No clause is quoted as “the 8 April 1929 wording” from a consolidated text unless it has been checked against a source explicitly tied to the original 1929 publication or the original facsimile.**

---

## 1. Act identity — CLOSED

Canonical act:
- ВЦИК and СНК РСФСР;
- date: **8 April 1929**;
- title: `О религиозных объединениях`;
- official publication: `Собрание узаконений и распоряжений Рабочего и Крестьянского Правительства РСФСР`, 1929, **№35, ст.353**.

Independent publication control:
- HistoryRussia document record identifies the source volume as `Собрание узаконений ... за 1929 г. №24–42. Отдел первый`;
- it records newspaper publication in `Известия ЦИК Союза ССР и ВЦИК`, №96, 26 Apr 1929; №97, 27 Apr; №98, 28 Apr.

External controls:
- HistoryRussia: `https://docs.historyrussia.org/ru/nodes/392501-postanovlenie-vserossiyskogo-tsentralnogo-ispolnitelnogo-komiteta-i-soveta-narodnyh-komissarov-o-religioznyh-obedineniyah-8-aprelya-1929-g`
- Wikisource transcription explicitly citing `СУ РСФСР. 1929. №35. Ст.353`: `https://ru.wikisource.org/wiki/Постановление_ВЦИК_и_СНК_РСФСР_от_08.04.1929._О_религиозных_объединениях`

Verdict: **PRIMARY DOCUMENT IDENTITY CLOSED**.

Still open:
- controlled local image/PDF of the original 1929 pages;
- page-level SHA256;
- exact first/last page mapping within the 1929 volume.

---

## 2. Why modern consolidated text is dangerous

At least one commonly used digital transcription expressly notes later amendments to numerous articles. That means a search hit headed `Постановление ... от 08.04.1929` can contain wording that did **not** exist on 8 April.

Production rule:
- consolidated databases = valid for later legal history;
- original-publication transcription/facsimile = required for claims about wording **on 8 Apr 1929**.

This distinction must survive copyediting. Do not collapse it into a generic `text of law` source note.

---

## 3. Original 1929 core — registration and local legal subject

The source explicitly tied to `СУ РСФСР 1929 №35 ст.353` gives:

### Article 2
Religious associations are registered as:
- religious societies;
- groups of believers.

### Article 3
A religious society is a **local** association of at least 20 adult believers of one cult/confession/direction; societies and groups have **no legal-person status**.

### Article 4
Activity begins only after registration with the competent administrative/local authority.

Safe synthesis:
> `Закон сохранил возможность легального местного религиозного объединения, но сделал регистрацию входным условием его деятельности и не дал ему прав юридического лица.`

Reject:
> `После 8 апреля сама принадлежность к общине стала незаконной.`

Status: **ORIGINAL-1929 WORDING STRONG**.

---

## 4. Article 10 — prayer premises

Original-publication transcription provides:
- a religious society can receive a special prayer building/cult objects in free use by contract;
- society/group may also use rented or otherwise supplied premises;
- such premises remain under the decree's rules;
- each society/group may use only **one prayer premise**.

Narrative meaning:
> legal worship remained possible, but in a bounded, contractually administered local space.

Do not say:
- all prayer houses were closed by the act;
- 1929 first nationalized church property.

The nationalization premise predates 1929 and derives from the post-1918 regime.

Status: **ORIGINAL-1929 TRANSCRIPTION STRONG / FACSIMILE PAGE OPEN**.

---

## 5. Article 11 — print/economic capacity

Original 1929 text distinguishes transactions directly connected with cult maintenance from commercial/industrial relations. It explicitly gives as an example:

- `типографий для печатания религиозно-нравственных книг`.

This is legally important for Baptist publishing history, but it does **not** by itself prove the administrative closure date of a particular Baptist journal or printing operation.

Editorial split:
- statute = legal mechanism;
- `Баптист` final issue/closure = periodical-specific historical claim requiring its own source.

Status: **ORIGINAL-1929 LEGAL MECHANISM STRONG / INDIVIDUAL PRESS CLOSURES SEPARATE**.

---

## 6. Articles 12–16 — meetings and personnel control

### Article 12
General meetings of religious societies/groups occur with permission of the designated local administrative authority.

### Articles 13–14
The association elects its executive body, but the registering authority has an express right to reject individual members of that executive body.

### Article 16
Meetings of executive/audit bodies occur without notification or permission.

This prevents three common overstatements:

1. `Все церковные собрания требовали отдельного разрешения.` — **REJECT**.
2. `Государство прямо назначало пресвитеров по статье 14.` — **REJECT**.
3. `Община свободно выбирала исполнительный орган без государственного фильтра.` — **REJECT**.

Correct mechanism:
> general society meeting = permission gate; executive sessions = different rule; elected executive personnel = administrative rejection power.

Status: **ORIGINAL-1929 WORDING STRONG**.

---

## 7. Article 17 — safest core of the chapter

Original 1929 transcription expressly forbids religious associations to:
- create mutual-aid funds/cooperatives/production associations;
- use association property for purposes other than religious needs;
- materially support their members;
- organize special children's, youth, women's, prayer and other meetings;
- organize general Bible, literary, handicraft, labor, religious-instruction and similar meetings/groups/circles/departments;
- arrange excursions and children's playgrounds;
- open libraries and reading rooms;
- organize sanatoria and medical aid.

It also limits books kept in prayer buildings/premises to those necessary for the cult.

Analytical significance:
- this is not a generic anti-religious slogan;
- it is a legal redefinition of what a registered religious association may *do* beyond worship.

Safe production line:
> `Статья 17 не запрещала человеку читать Библию дома; она запрещала религиозному объединению целый набор организованных социальных, молодежных, образовательных и благотворительных практик.`

Reject:
- `Библию запретили`;
- `любая частная помощь верующему стала запрещена этой статьёй`;
- `все женские разговоры и встречи стали уголовным преступлением`.

Status: **ORIGINAL-1929 CORE CLOSED AT TEXT LEVEL / FACSIMILE OPEN**.

---

## 8. Article 18 — education

Original-publication transcription states:
- religious doctrines may not be taught in state, public or private educational/upbringing institutions;
- special theological courses require special permission from the designated authority.

Critical chronology for Baptist narrative:
- P. V. Ivanov-Klyshnikov arrest and the Moscow course shutdown are dated in later Baptist sources to **3 Mar 1929**;
- the decree is **8 Apr 1929**.

Therefore:
> **the March closure cannot be caused by the April statute.**

Correct narrative:
> the educational shutdown demonstrates a tightening already underway; the April act then formalized a legal regime hostile to ordinary denominational educational infrastructure.

Status: **LEGAL RULE STRONG / BAPTIST EVENT PRIMARY CASE FILE OPEN**.

---

## 9. Article 19 — itinerant preaching

Original 1929 transcription ties the activity area of ministers/preachers/mentors to:
- the residence of members of the religious association served;
- the corresponding prayer premise;
- for a minister serving multiple associations, the territory where those believers permanently reside.

This directly intersects with the older Baptist model of travelling evangelists and inter-congregational ministry.

Do not translate this into:
> `Любая поездка проповедника за город стала уголовным преступлением.`

The provision defines territorial scope; enforcement/sanction requires separate evidence.

Status: **ORIGINAL-1929 WORDING STRONG**.

---

## 10. Articles 20–24 — congress/federation mechanism

### Article 20
Local, all-Russian and all-Union religious congresses/conferences require **special permission in each case** from the specified authority.

### Article 21
Congress may elect an executive body; member lists plus congress materials are submitted to the authority that issued permission.

### Article 22
Congress and its executive body have no legal-person rights and cannot, among other things:
- maintain central donation funds;
- impose compulsory collections;
- own/receive/acquire/rent cult property;
- enter contracts/transactions.

### Article 23
Seals/stamps/forms are restricted to religious business.

### Article 24
Permissible initiators/organizers of religious congresses are defined.

Safe synthesis:
> `Закон не вычеркнул из языка слово «съезд». Он поставил созыв каждого съезда под разрешительный режим и лишил съезд/его исполнительный орган значительной части имущественной и договорной правоспособности, необходимой нормальной федерации.`

Reject:
> `Союзы были формально полностью запрещены одной статьёй 20.`

Status: **ORIGINAL-1929 TEXTUAL CORE STRONG**.

---

## 11. Articles 25+ — property continuity, not a one-day confiscation story

Original text describes cult property as nationalized, registered and placed in believers' use under contracts/inventory/control rules.

The key historical point:
- the state-ownership premise was not invented on 8 Apr 1929;
- Chapter 10 already documents the 1918 separation regime;
- Chapter 14 should show **densification of administrative control**, not falsely date all nationalization to 1929.

Reject:
> `8 апреля государство впервые объявило все молитвенные дома своей собственностью.`

Status: **PRIMARY CONTINUITY FRAME STRONG**.

---

## 12. 18 May 1929 constitutional amendment — separate legal object

Do not bury this inside the 8 April decree.

The XIV All-Russian Congress of Soviets changed Article 4 of the RSFSR Constitution on **18 May 1929**.

Earlier constitutional formula:
- `свобода религиозной и антирелигиозной пропаганды`.

1929 formula:
- `свобода религиозных исповеданий и антирелигиозной пропаганды`.

Interpretive significance:
- religious propaganda disappears from the paired constitutional guarantee;
- anti-religious propaganda remains expressly protected;
- this matters directly to an evangelistic movement.

Do not quote in 1929:
- `свобода отправления религиозных культов` as though it were the May 1929 wording; that is associated with later constitutional formulations.

Status: **PRIMARY WORDING STRONG / ORIGINAL PAGE IMAGE OPEN**.

---

## 13. Implementation layer must be kept separate from statute

The chapter should distinguish at least four kinds of evidence:

### A. Statutory rule
What the 8 Apr decree legally says.

### B. Constitutional rule
What changed on 18 May.

### C. Administrative/political campaign
Examples under separate source control:
- VTsSPS anti-religious circular №53, 1 Mar 1929;
- anti-religious congress/resolutions, June 1929;
- registration instructions / NKVD implementation acts;
- local administrative decisions.

### D. Baptist institutional experience
Examples:
- March Ivanov-Klyshnikov arrest/course closure;
- final 1929 `Баптист` issue;
- Far Eastern Baptist protest/plenum;
- Union financial/administrative contraction;
- later suspension/restoration chronology.

Rule:
> a simultaneous political campaign may explain context, but must not be silently rewritten as a clause of the 8 Apr decree.

---

## 14. Source hierarchy for quotations

For exact statutory quotation, preference order:

1. original 1929 `СУ РСФСР` facsimile/page image;
2. original 1929 newspaper publication facsimile;
3. transcription explicitly identifying `СУ РСФСР 1929 №35 ст.353`, checked against another independent source;
4. later legal collection reproducing the original text with editorial apparatus;
5. consolidated database only when the claim is explicitly about the later amended regime.

Never use a secondary Baptist history to quote the statutory wording when the primary legal text is available.

---

## 15. Production claim matrix

| Claim | Current level | Production rule |
|---|---|---|
| act date/title/publication | PRIMARY CLOSED | may state directly |
| local 20-person society / no legal person / registration | ORIGINAL TEXT STRONG | safe; facsimile preferred for quote |
| one prayer premise | ORIGINAL TEXT STRONG | safe; do not imply automatic closure |
| print/economic restriction art.11 | ORIGINAL TEXT STRONG | separate from actual journal closure |
| general meeting permission art.12 | ORIGINAL TEXT STRONG | distinguish executive sessions |
| personnel rejection power art.14 | ORIGINAL TEXT STRONG | do not call direct appointment |
| art.17 social/youth/Bible/library restrictions | ORIGINAL TEXT STRONG | chapter centerpiece |
| theological-course permission art.18 | ORIGINAL TEXT STRONG | March event predates law |
| territorial preacher rule art.19 | ORIGINAL TEXT STRONG | do not invent criminal sanction |
| congress permission arts.20–21 | ORIGINAL TEXT STRONG | do not call total ban |
| no legal-person/central capacity art.22 | ORIGINAL TEXT STRONG | strong federation mechanism |
| 18 May constitution wording | PRIMARY STRONG | separate legal object |
| specific Baptist closures/arrests | MIXED | require event-specific source |
| enforcement everywhere immediately | NOT PROVEN | reject |

---

## 16. P0 remaining legal acquisitions

1. Acquire controlled original `СУ РСФСР`, 1929 №35 pages containing the decree.
2. Map exact page numbers for arts.1–63.
3. SHA256 the controlled binary.
4. Visually verify at least:
   - opening/title;
   - arts.10–12;
   - art.17;
   - arts.18–22;
   - property section relevant to the chapter.
5. Acquire/verify original 18 May 1929 constitutional-amendment publication page.
6. Keep a small original-vs-later-amended diff for any article quoted in final production.

---

## 17. Final legal verdict

The defensible chapter thesis is not:

> `1929 запретил религию.`

It is:

> **In 1929 the Soviet legal regime preserved a narrow, registered sphere of local worship while systematically reducing the institutional freedoms that had made Baptist life more than a weekly cult meeting: federation, congresses, itinerant ministry, education, organized youth/women/Bible work, mutual aid, libraries and normal publishing/economic capacity were forbidden, permit-dependent, territorially narrowed or legally incapacitated.**

That mechanism can now be demonstrated article by article without importing later wording or turning political context into statutory text.
