# «Баптисты России» — Soviet Night Source-to-Claim Matrix

**Дата:** 2026-08-24
**Lane:** `EDITORIAL / baptisty-soviet-night-source-matrix`
**Product base / rollback SHA:** `f6e39545d7548500eb00916d9995d3a7c2541ca4`
**Research authority SHA:** `e8e6b98787019d43a2ffd10eb55bdde04ebfb747`
**Current route under audit:** `/baptisty-rossii/sovetskaya-noch/`
**Current source body:** `src/components/baptisty-rossii/BaptistyRossiiSovetskayaNochBody.astro`
**Book authority:** `docs/BAPTISTY-ROSSII-BOOK-AUTHORITY-V2.md`

## 0. Lane boundary

This lane creates the source-to-claim matrix required by Book Authority v2 before the Soviet Night Golden Chapter is rewritten.

It does **not**:

- rewrite reader-facing route prose;
- change PageHead, canonical, navigation, current four-chapter public architecture or future planning graph;
- create routes for future chapters 14–17;
- create a Baptist Product source-confidence registry;
- rename or mechanically map Research evidence classes;
- change Research evidence, acquisition or HOLD state;
- publish media from MASTER, Drive or Telegram;
- mutate reading time, quiz, map, runtime, homepage, RSS, search projections or editorial dates.

`READY / VERIFY / HOLD` below are lane-local editorial dispositions for this matrix. They are not a new machine enum and are not aliases for Research `A1/A2/A3/B1/C/D`.

## 1. Current-state diagnosis

At the exact Product base:

- the route is published and stable;
- the Body contains about 2,000 substantive words and 14 `h2` sections;
- the route still uses the working article transferred in June 2026 rather than a later Golden Chapter commit;
- one real facsimile object is already published through `BaptistyRossiiSovetskayaNochEvidence.astro` and `baptisty-rossii/research/media-ledger.md`;
- the existing body mixes four different evidentiary strengths: legal texts, official church memory, academic reconstruction and biographical/memoir leads;
- several exact personal-case statements are stronger than current Research proof state;
- the article currently carries a direct quotation attributed to N. V. Odintsov without a closed page locator;
- the article compresses the 1918 decree, the 1929 legal turn, the destruction of the 1930s and the wartime bridge to 1944 into one short route.

The current public route must remain one URL. The Golden rewrite should deepen it without pretending that the future planned chapters already exist as independent routes.

## 2. Bounded historical question

The existing route should answer one primary question:

> How did Soviet law, registration, surveillance, propaganda and political repression progressively narrow the public and institutional life of Baptist and Evangelical Christian communities from 1918 through the 1930s, and what remained when wartime policy opened a controlled path toward 1944?

This wording prevents four distortions:

1. the decree of 1918 is not presented as if it already contained the entire later Stalin-era mechanism;
2. 1929 is treated as a sequence of legal changes, not one magic date that mechanically caused every local closure;
3. personal suffering is not reduced to an anonymous chronology of institutions;
4. 1944 remains a short bridge to the separate `/vsehib-1944/` route, not the second half of this chapter.

The current route feeds future planned chapters 14–16 and overlaps the military-conscience material of chapter 13. The Golden rewrite should concentrate on future chapters 14–15, keep 1917–1928 as a bounded prehistory, and end with a concise 1941–1944 transition.

## 3. Disposition semantics

### `READY`

The present evidence supports a careful public paraphrase at the stated strength. Direct quotation is permitted only when the exact edition/version, locator and context meet the Product and Research quote contract.

### `VERIFY`

A relevant source exists, but exact page, source voice, identity, geographic scope, transmission chain or cross-source check is not yet strong enough for an unqualified sentence or quotation. The content lane must either close the gap or reduce and attribute the wording.

### `HOLD`

The current or proposed formulation is conflicted, teleological, stronger than its evidence, identity-unsafe or dependent on a source object that is not primary-quote-ready. Do not carry it into the Golden Chapter at the same strength.

## 4. Canonical authority and evidence anchors

### 4.1. Product authority

- `docs/BAPTISTY-ROSSII-BOOK-AUTHORITY-V2.md`
  - source-to-claim matrix is a publication-readiness requirement;
  - Research evidence class, access, locator, rights and publication state remain independent;
  - future 5-part / 20-chapter records are a planning graph, not route authority.
- `docs/BAPTISTY-ROSSII-EDITORIAL-ARCHITECTURE.md`
  - current public route and four-chapter composition remain stable.
- `docs/EDITORIAL-SOURCE-POLICY.md`
  - precise historical claims and quotations must be calibrated to the source actually inspected.
- `docs/CONTENT-QUALITY-STANDARD.md`
  - no invented certainty, filler or unsupported dramatic detail.
- `baptisty-rossii/research/03-soviet-night-1917-1944-law-repressions-press.md`
  - large June working dossier; useful but not a current Research authority by itself.
- `baptisty-rossii/research/09-soviet-night-article-transfer-and-new-sources-2026-06-13.md`
  - records the current article transfer and its unresolved primary-source tasks.
- `baptisty-rossii/research/16-persecution-case-index-1930s-1980s-2026-06-14.md`
  - separates case evidence from later church memory and explicitly leaves archival files open.
- `baptisty-rossii/research/52-1929-legal-turning-point-spring-to-night-verified-2026-06-19.md`
  - adds the constitutional amendment of 18 May 1929 and marks weaker 1930 claims separately.
- `baptisty-rossii/research/83-initial-claim-to-source-matrix-10-chapters-2026-07-31.md`
  - requires the current article to be split conceptually into state mechanism and human/institutional cost.
- `baptisty-rossii/research/media-ledger.md`
  - controls the one existing published facsimile.

### 4.2. Current Research authority

All Research references below are pinned conceptually to `FedorMilovanov/Research@e8e6b98787019d43a2ffd10eb55bdde04ebfb747`.

- `RUSSIAN_BAPTISTS_ARCHIVE/00_CURRENT_AUTHORITY_2026-08-02.md`
  - acquisition, proof stage and source class are independent;
  - publication readiness is not claimed;
  - modern typed compilations are not archival facsimiles.
- `data/repository-evidence-policy-v2.json`
  - quote-safe use requires eligible evidence, exact locator, context and identified edition/version.
- `RUSSIAN_BAPTISTS_ARCHIVE/SCAN_ACQUISITION_CURRENT_AUTHORITY_2026-08-02.md`
  - catalog/holding, received file, verified file, OCR, quote-ready and rights-cleared are separate states.
- `БАПТИСТЫ РОССИИ/baptists_v120_TRUE_GROUPED/groups/02_HISTORY_NARRATIVE.md`
  - gives the chronology and explicitly treats the 1918–1929 window as a staged problem rather than a simple freedom/night binary.
- `.../groups/04_SAMIZDAT_PERSECUTION.md`
  - current case-control layer for 1923–1933 and later persecution;
  - repeatedly states that the Pavlov/Timoshenko/Dovgalyuk 1933 files and several other organ cases have not been opened as primary archival files.
- `.../groups/06_DATA_AND_PROOF_LEDGERS.md`
  - keeps organ-case language, page states, media candidates and periodical status behind explicit gates.
- `.../groups/09_CONGRESS_EC_1911_AND_BRATSKY_VESTNIK_1945_OCR.md`
  - quote-ready official postwar voice from `Братский вестник` 1945 №2; useful only for the final wartime bridge and official voice.

### 4.3. Legal and documentary corridor

1. **23 January / 5 February 1918 decree** — verified public-domain facsimile in canonical Drive according to MASTER `12 Drive Acquisitions!34`: 3 pages, SHA-256 `7d1e2468f28fcb01e36f521b58f8d51c3e04dfc453be3efb3e4663720e31b400`.
2. **`Революция и церковь` 1920 №9–12** — verified public-domain facsimile in MASTER `12 Drive Acquisitions!35`: 113 pages, SHA-256 `e4049614bd79ea7f9b50f9ebfcf8ddf4d37e2b430f61c9d1080fd1102e50f739`; the existing Product figure links to the [Wikimedia Commons source object](https://commons.wikimedia.org/wiki/File:%D0%96%D1%83%D1%80%D0%BD%D0%B0%D0%BB_%C2%AB%D0%A0%D0%B5%D0%B2%D0%BE%D0%BB%D1%8E%D1%86%D0%B8%D1%8F_%D0%B8_%D1%86%D0%B5%D1%80%D0%BA%D0%BE%D0%B2%D1%8C%C2%BB._%E2%84%96%E2%84%96_9%E2%80%9412,_1920.pdf).
3. **8 April 1929 decree `О религиозных объединениях`** — [official-document image route and bibliography at ЭБИД](https://docs.historyrussia.org/ru/nodes/371831-o-religioznyh-obedineniyah-postanovlenie-vtsik-i-snk-rsfsr-8-aprelya-1929-g), cited as `СУ РСФСР. 1929. №35. Ст.353`; MASTER `11 Alternate Digital Files!123` remains `LINK ONLY — BINARY ENDPOINT NOT EXTRACTED`.
4. **18 May 1929 constitutional amendment** — [full public legal text at Garant](https://base.garant.ru/3946674/); article 4 changes `свобода религиозной и антирелигиозной пропаганды` to `свобода религиозных исповеданий и антирелигиозной пропаганды`.
5. **Instruction №328 and Resolution №329, 1 October 1929** — reproduced in [V. S. Batchenko's scholarly document publication](https://www.sedmitza.ru/lib/text/7697292/) with the `Бюллетень НКВД №37` identity. This is a strong published text route, not yet an opened original bulletin facsimile in current Product.
6. **NKVD Order №00447, 30 July 1937** — [published at Istmat](https://istmat.org/node/32818) from a 2010 documentary edition, pp. 99–115. The order names previously repressed church people and sectarians and includes `сектантские активисты, церковники` in a defined target category.
7. **Siberian anti-sectarian press, 1928–1930** — [A. I. Savin's academic study](https://zaimka.ru/savin-protestants/) is the current interpretive route; its newspaper quotations remain secondary transmissions until the cited issue/page is opened.

### 4.4. MASTER boundary

The [public MASTER workbook](https://docs.google.com/spreadsheets/d/1y9d_7bWAEsz8iYdMuRrtb6onDYEXLQx5PgT95oYNsSM/edit) is an operational inventory, not Product publication authority.

Relevant observed states:

- `08 Article Dossiers!S08` remains `PLANNED`;
- `12 Drive Acquisitions!34–35` prove exact physical custody for the 1918 decree and `Революция и церковь` 1920 №9–12;
- `11 Alternate Digital Files!123` proves an official 1929 document route but not local binary acquisition;
- `12 Drive Acquisitions!53` classifies the Shilov/Lenin PDF as a modern derivative transcription, not an archival facsimile and not primary-quote-ready;
- `05 Photos Captions` contains many apparent Soviet-night candidates, but its `Article ready` flag is not a rights or publication decision.

No MASTER row, Drive filename, Telegram caption or `article-ready=YES` cell removes a Product publication HOLD.

## 5. P0 corrections required before growth

### SN-P0-01 — restore the complete 1929 legal sequence

The current article gives 8 April and 1 October but omits the constitutional amendment of 18 May 1929 from the main narrative.

**Disposition:** `HOLD` on calling the existing sequence complete.

**Required action:** present four distinct steps:

1. 8 April — decree on religious associations;
2. 18 May — constitutional wording changes from religious propaganda to religious confession;
3. 1 October — Instruction №328 operationalizes control;
4. 1 October — Resolution №329 makes re-registration a closure mechanism.

Do not imply that one document alone created every later practice.

### SN-P0-02 — remove the unlocated Odintsov quotation

Current public wording quotes N. V. Odintsov directly: `Мы были вынуждены... прекратить деятельность Союза`.

The quote is transmitted through later official church history in the current Product dossier; an exact primary letter/page card is not closed in current Research.

**Disposition:** `HOLD` for verbatim quotation.

**Required action:** either obtain the exact letter/edition/page or replace with an attributed paraphrase such as `В поздней официальной истории братства письмо Одинцова описывается как свидетельство финансового прекращения работы Союза`.

### SN-P0-03 — disambiguate Ivanov-Klyshnikov identities

The corpus contains at least two different identity corridors:

- V. V. Ivanov-Klyshnikov (1846–1919), early Tiflis missionary/journalist;
- P. V. Ivanov-Klyshnikov, the later Bible-course/1929 repression figure in the Soviet-night dossier.

The current body uses only the surname in a compressed arrest sequence. MASTER photo captions also contain the earlier V. V. identity, increasing the risk of accidental transfer.

**Disposition:** `HOLD` on any undifferentiated `Иванов-Клышников` claim in the Soviet section.

**Required action:** establish full name, lifespan/role and source locator for the 1929 figure before the rewrite. Never attach the earlier man's portrait or biography to the later arrest.

### SN-P0-04 — resolve or disclose the Timoshenko arrest chronology

The old Product dossier says M. D. Timoshenko was arrested `приблизительно в 1930`. Current grouped Research separately records the Pavlov/Timoshenko/Dovgalyuk arrest of 31 March 1933 and an extrajudicial five-year sentence, while stating that the primary case is still not opened.

**Disposition:** `HOLD` on a single exact arrest chronology without reconciliation.

**Required action:** determine whether these are separate arrests, a legacy date error or conflated episodes. Until then use only an attributed, non-exhaustive formulation.

### SN-P0-05 — stop presenting secondary case chains as opened archival files

Current grouped Research explicitly says that the Pavlov/Timoshenko/Dovgalyuk 1933 primary file and several other organ cases remain unfound/unopened.

**Disposition:** `HOLD` on language such as `дело показывает` or an unqualified exact accusatory formula.

**Required action:** say `по опубликованным биографическим/исследовательским данным` and identify investigative language as the language of the organ, not the narrator's verdict.

### SN-P0-06 — narrow the prayer-house total

The current body attributes to I. G. Ermolov a claim that only four prayer houses remained at the start of the war in the RSFSR.

**Disposition:** `VERIFY`.

**Required action:** preserve the geographic and legal scope (`на территории РСФСР`, apparently legally operating houses), cite the exact Ermolov locator and do not transform it into `во всём СССР осталось четыре общины`.

### SN-P0-07 — separate the order's category from individual Baptist guilt

Order №00447 does name church people, sectarians and `сектантские активисты`, and defines first/second punishment categories. It does not by itself identify every Baptist victim or prove the facts alleged in individual cases.

**Disposition:** `HOLD` on any movement-wide causal shortcut from the order to every arrest.

**Required action:** use the order to establish the state operation's vocabulary and mechanism; use separate case evidence for named people.

### SN-P0-08 — distinguish official church memory from administrative proof

The 1989 official history and the 1945 official journal are indispensable voices, but neither is a neutral substitute for NKVD files, local closure acts or state correspondence.

**Disposition:** `HOLD` on unattributed transfer of their causal explanations.

**Required action:** label official memory as official memory; pair it with legal/academic/administrative evidence where causal strength matters.

### SN-P0-09 — keep 1942–1944 as a bridge, not a second article

The current route gives a long 1942/1944 explanation that overlaps the next route.

**Disposition:** `READY` for a concise transition; `HOLD` for duplicating the full union narrative.

**Required action:** end with the conflict of two supported planes: real church survival/unity and a state-authorized controlled center. Move protocol-level 1944 detail to `/vsehib-1944/`.

### SN-P0-10 — do not treat the Telegram photo catalog as rights clearance

The MASTER photo sheet has relevant portraits, buildings and event images, including the House of Gospel and leaders. Caption source is often `DIRECT`, and `Article ready` may be `YES`, but no rights field is present in that tab.

**Disposition:** `RIGHTS / PUBLICATION HOLD` on all new images.

**Required action:** a separate media lane must close identity, original source, rights, exact caption, local binary, integrity and media-ledger entry.

## 6. Source-to-claim matrix

| ID | Current / planned claim | Best evidence now | Voice / proof boundary | Disposition | Allowed public strength now | Required next action | Future book node |
|---|---|---|---|---|---|---|---|
| SN-01 | The 1918 decree separated church from state/school and changed the legal/property position of religious societies | verified 3-page decree facsimile; Batchenko legal history | primary legal text + scholarly context | READY | exact factual paraphrase | record article/page locator for any quotation | Ch. 10 / 14 |
| SN-02 | The 1918 decree immediately created the full late-Stalinist repression system | later chronology only | teleological inference | HOLD | do not use | narrate intervening changes and enforcement stages | Ch. 10 / 14 |
| SN-03 | The 1920s were a `relative window`, not simple freedom | periodical/union history + OGPU/military-pressure corpus | mixed church memory, documents and scholarship | READY with qualification | `относительное и неравномерное окно` | anchor two examples of growth and two of pressure | Ch. 10–13 |
| SN-04 | `Революция и церковь` p.100 shows administrative implementation of the separation decree | exact local facsimile + Product evidence component + media ledger | primary official periodical, page verified | READY | keep current bounded caption | do not imply a specific Baptist community | Ch. 10 / 14 |
| SN-05 | Soviet anti-sectarian press intensified in 1928–1930 | A. I. Savin's study of about 300 Siberian publications | academic reconstruction using contemporary press | READY with attribution | `Савин показывает...` | cite exact article section; primary newspaper pages for direct quotes | Ch. 14 |
| SN-06 | Local press functioned as a public denunciation channel | Savin | academic interpretation | READY with attribution | attributed paraphrase | no floating universal statement | Ch. 14 |
| SN-07 | Slavgorod papers used `паутина`, `ловушка` and darkness rhetoric | quotations transmitted through Savin | secondary transmission of primary press | VERIFY | `Савин приводит...` only | open exact newspaper issues/pages before quoting as primary | Ch. 14 |
| SN-08 | 7 February 1930 Novosibirsk closure relied on a claimed petition of at least 50,000 citizens | Savin's cited local evidence | academic report; local act/page not opened in Product | VERIFY | attributed sentence only | exact Sibkraiispolkom/newspaper locator | Ch. 14 / 15 |
| SN-09 | The 8 April 1929 decree sharply restricted non-cultic religious activity | official image route; published legal text; Batchenko | primary law / published edition | READY | strong structural paraphrase | use `СУ №35, ст.353`; visual locator before long quote | Ch. 14 |
| SN-10 | Article 17 prohibited mutual aid, youth/women's meetings, Bible/literary circles, libraries and other activity | same legal corridor | primary legal text | READY | enumerate accurately and in context | verify wording against selected page images | Ch. 14 |
| SN-11 | The law left believers `only worship` in an absolute sense | editorial shorthand | interpretation, not literal total ban | VERIFY | `сводило легальную коллективную жизнь к узко контролируемому культу` | explain remaining formal permissions and permissions regime | Ch. 14 |
| SN-12 | On 18 May 1929 article 4 changed `religious propaganda` to `religious confessions` while retaining anti-religious propaganda | Garant full legal text | primary legal text route | READY | exact factual statement; short quotation after locator | add this missing step to the route | Ch. 14 |
| SN-13 | The wording change by itself automatically criminalized every act of mission | inference | legal overstatement | HOLD | do not use | connect wording to implementing law/practice, not automatic causation | Ch. 14 |
| SN-14 | Instruction №328 and Resolution №329 were both dated 1 October 1929 and published in `Бюллетень НКВД №37` | Batchenko document publication | published primary-text edition; original bulletin scan pending | READY for identity/paraphrase | exact identity and careful paraphrase | original bulletin facsimile only if verbatim visual authority is needed | Ch. 14 |
| SN-15 | Instruction №328 restricted territorial ministry, reporting, meetings, finance and oversight | Batchenko full reproduced text | published legal document | READY | section-by-section paraphrase | attach point numbers to every strong sentence | Ch. 14 |
| SN-16 | Points 55–56 permitted a state representative at meetings and closure under listed conditions | Batchenko | published legal text | READY for paraphrase / VERIFY for verbatim | precise paraphrase including conditions | quote-card if direct wording is retained | Ch. 14 |
| SN-17 | Resolution №329 treated associations not re-registered by the deadline as closed | Batchenko | published legal text | READY | exact paraphrase | mention later deadline extensions if chronology goes beyond 1 May 1930 | Ch. 14 |
| SN-18 | 1929 was one legal turning point rather than the sole cause of all repression | combined legal and case evidence | editorial synthesis | READY | use as chapter thesis | keep law, enforcement and local cases separate | Ch. 14–15 |
| SN-19 | `Баптист Украины` ended with №11 in 1928 and `Баптист` with №7 in 1929 | official church history 1989; periodical catalog corridors | later official memory / bibliographic claim | VERIFY | attribute to the 1989 history | inspect last issues/title pages or contemporary closure record | Ch. 14 / 15 |
| SN-20 | The revived `Баптист` had a circulation of about 10,000 | official church history 1989 | later official history | VERIFY | attributed approximate figure | issue/colophon or administrative circulation record | Ch. 14 |
| SN-21 | Bible courses opened in late 1927 and produced no graduating class after the arrest of P. V. Ivanov-Klyshnikov | official history + old Product dossier | official memory; identity P0 | HOLD at current specificity | no sentence until identity is disambiguated | full identity + source locator + course record | Ch. 14 / 15 |
| SN-22 | Odintsov wrote that lack of funds forced the Union to stop work in December 1929 | quotation transmitted through later history | unclosed quotation chain | HOLD for quote / VERIFY for paraphrase | attributed paraphrase only | exact letter or printed edition/page | Ch. 14 / 15 |
| SN-23 | The Baptist Union's Moscow house was confiscated in May 1930 and held offices, courses and housing | 1989 official history + G. P. Vins memory | official memory + memoir | VERIFY | explicitly attributed factual synthesis | closure/confiscation act and exact address proof | Ch. 15 |
| SN-24 | 10,000 printed but unbound Bibles were seized | 1989 official history | later official memory | VERIFY | attributed detail, not archival fact | primary act/inventory or contemporary correspondence | Ch. 15 |
| SN-25 | The Federative Baptist Union ceased functioning by 1935 | Orlov's official 1945 retrospective + 1989 history | official institutional retrospective | READY with attribution | `В официальном докладе 1945 года...` | do not turn date into a complete causal account | Ch. 15 / 16 |
| SN-26 | Ivanov-Klyshnikov was repressed on 3 March 1929, exiled and arrested again in 1933 | old Product dossier / official history | identity-unsafe, archival files pending | HOLD | do not keep compressed claim | disambiguate person and open rehabilitation/archive route | Ch. 15 |
| SN-27 | Odintsov was arrested 5–6 November 1933 and received a three-year sentence | Vins/official biographical corridor | memoir/official memory, primary file pending | VERIFY | attributed biographical statement | rehabilitation card or archival case | Ch. 15 |
| SN-28 | Timoshenko was arrested around 1930 | old Product dossier | conflicts with current 1933 case corridor | HOLD | do not use as a sole date | reconcile arrest sequence and identity | Ch. 15 |
| SN-29 | Pavlov, Timoshenko and Dovgalyuk were arrested 31 March 1933 and received five years in northern camps | current grouped Research from published data | B/B+; primary OSO file pending | VERIFY | `по опубликованным данным...` | OSO decision, case files or rehabilitation records | Ch. 15 |
| SN-30 | Datsko received four years in 1934, returned in 1938, was sentenced again and did not return | official church history / biography | later institutional/biographical memory | VERIFY | attributed, concise biography | archival/rehabilitation records | Ch. 15 |
| SN-31 | The narrator may repeat `контрреволюционная группа сектантских проповедников` as a neutral description | investigative language in secondary transmission | hostile state allegation | HOLD | only `в языке следствия...` | exact case text before quotation | Ch. 15 |
| SN-32 | ВСЕХ suspended activity in May 1930 and reorganized at a 40-delegate meeting on 23 August 1931 | 1989 official history / Product dossier | later official history | VERIFY | attributed institutional chronology | contemporaneous protocol or exact edition locator | Ch. 14 / 15 |
| SN-33 | Karev, Zhidkov and other EC leaders were repressed in the 1930s | official history + biographies | mixed official/biographical | READY at broad level / VERIFY per exact sentence | broad attributed statement | person-by-person case cards for exact dates/sentences | Ch. 15 |
| SN-34 | By the start of the war only four legal EC/Baptist prayer houses operated in the RSFSR | Ermolov | scholarly/interpretive secondary | VERIFY | attributed and geographically bounded | exact page/footnote and definition of `operated` | Ch. 15 |
| SN-35 | House of Gospel held its last service and was closed on 5 February 1930 | 1989 history + modern MR7 memory-of-place article | official memory + journalism | VERIFY | attribute and separate closure from later building use | court/municipal closure act | Ch. 15 |
| SN-36 | Five of six Moscow prayer houses were closed | 1989 official history | later official memory | VERIFY | attributed approximate local picture | municipal/local church records | Ch. 15 |
| SN-37 | `Almost all` ECB prayer houses were closed by the mid-1930s | broad synthesis | scope/count basis not centralized | VERIFY | avoid numerical-sounding absolute; say legal infrastructure was drastically reduced | region-by-region register and denominators | Ch. 15 |
| SN-38 | Order №00447 mentions repressed church people/sectarians and `sectarian activists, church people` in its target categories | Istmat documentary publication, pp. 99–115 | primary state order in scholarly edition | READY | exact, contextualized statement | retain category/section context | Ch. 15 |
| SN-39 | Order №00447 proves every named Baptist arrest was part of that operation | order alone cannot prove individual routing | unsupported causal transfer | HOLD | do not use | individual file/order-list evidence | Ch. 15 |
| SN-40 | First category meant execution; second meant 8–10 years in camps/prison | Order №00447 section II | primary state order | READY | exact procedural statement | avoid implying all sectarians automatically received one category | Ch. 15 |
| SN-41 | The chapter should include 5–8 named persecution cases | Book Authority / initial matrix | editorial plan; current proof uneven | VERIFY | select fewer cases if that is all evidence supports | case cards with identity, date, organ, decision, source class and open gap | Ch. 15 |
| SN-42 | Georgy Slesarev's 1935–1938 chain can be told as an opened NKVD file | Popov 2014 citing UFSB/archive material | B/C with A route not opened | HOLD as archival claim | attributed research summary only | archive certificate/copy and exact locators | Ch. 15 |
| SN-43 | Ivan Shilov provides a human bridge from conscience to repeated repression | biography + derivative 2024 transcription + research leads | useful synthesis; derivative PDF not primary-quote-ready | VERIFY | cautious biographical bridge without quoting derivative as original | original letter/response and case/rehabilitation records | Ch. 13 / 15 |
| SN-44 | In May 1942 Orlov, Andreev, Levindanto and Golyaev formed/served a temporary joint center | official reference and church retrospective; alternative interpretations differ | official/referential, state file pending | VERIFY | attribute exact version of events | 1942 letter, permission and Temporary Council documents | Ch. 16 |
| SN-45 | The wartime turn was simply religious freedom | later outcomes contradict this | overstatement | HOLD | `частичная и контролируемая легализация` | show authorization and oversight | Ch. 16 |
| SN-46 | State authorities wanted a controlled Protestant center | administrative interpretation supported by structure but state files not yet closed here | historical synthesis | VERIFY | signpost as interpretation, not quoted motive | Council/state correspondence and scholarship | Ch. 16 |
| SN-47 | Believers also had a real desire for unity and legal church life | 1945 official church documents + longer unity history | participant/institutional self-description | READY with voice label | present alongside, not instead of, state context | route protocol detail to `/vsehib-1944/` | Ch. 16 |
| SN-48 | 1944 was only a free church decision or only a state operation | reduction of conflicting evidence | single-cause distortion | HOLD | do not use | preserve both planes and evidentiary limits | Ch. 16 |
| SN-49 | Existing Soviet-night facsimile is publication-ready | Product media ledger and local asset | identity/provenance/rights/integrity closed for one page | READY | retain unchanged unless separately reviewed | none in source-matrix lane | Ch. 10 / 14 |
| SN-50 | MASTER photo candidates are ready for Product because `Article ready=YES` | photo catalog only; rights independent | candidate workflow state | HOLD | no new media | separate rights-first media lane | Ch. 14–16 |

## 7. Direct-quotation policy

### May remain only with exact existing authority

- the captioned title on the published `Революция и церковь` p.100 facsimile, within its current bounded claim;
- short legal wording when exact document section/page/version is recorded in the final content notes;
- Order №00447 wording only with the document section/category context preserved.

### Must be removed, downgraded or closed first

- Odintsov's sentence about stopping Union activity;
- Slavgorod newspaper phrases when the article has only Savin's transmission rather than the newspaper page;
- investigative formulas from personal cases when the archival case itself is not opened;
- any wording from the Shilov/Lenin modern Word-PDF presented as a facsimile or primary quotation;
- any long quotation from Instruction №328/Resolution №329 without a bounded locator in the identified edition.

A direct quotation is not rescued by the fact that its words appear in a modern PDF, OCR dump, Telegram caption, secondary article or old Product dossier.

## 8. Immediate corrections versus documentary growth

### 8.1. Corrections first

1. Add the 18 May 1929 constitutional amendment to the legal sequence.
2. Remove or locate the Odintsov direct quotation.
3. Disambiguate P. V. and V. V. Ivanov-Klyshnikov.
4. Reconcile the Timoshenko 1930/1933 chronology.
5. Replace `archival case` implications with honest source-voice labels where primary files remain pending.
6. Narrow the four-prayer-house claim to its exact geography and definition.
7. Reframe Order №00447 as state vocabulary/mechanism, not automatic proof for every person.
8. Reduce the 1942–1944 section to a bridge and send protocol detail to the next route.

### 8.2. Evidence-backed growth second

After corrections, grow the route through documentary units rather than a longer list of suffering:

1. **1918:** what the decree changed and what it did not yet predetermine.
2. **The uneven 1920s:** print, courses and unions alongside OGPU pressure.
3. **1928–1930 press campaign:** Savin as named academic interpreter; primary newspaper pages only where opened.
4. **8 April 1929:** prohibited activity by category.
5. **18 May 1929:** the constitutional word change.
6. **1 October 1929:** Instruction №328 and Resolution №329 as operational machinery.
7. **What a community lost:** mission, children/youth, mutual aid, library, itinerant ministry, interchurch organization.
8. **Print and training:** last issues/courses with official-memory disclosure until primary closure.
9. **Union infrastructure:** money, building, courses and Bibles, with source voices separated.
10. **Three to five human cases:** only the strongest case cards, not an unverified roll call.
11. **Local closure mechanisms:** registration, premises, rent/repair, administrative need, arrest.
12. **1937:** Order №00447 and the difference between state category and an individual file.
13. **Wartime threshold:** controlled legalization and the path to 1944 in no more than a transition section.

## 9. Proposed Golden Chapter structure for the existing route

This is a rewrite outline for the existing `/baptisty-rossii/sovetskaya-noch/` route, not a route-creation plan.

1. **Cold open — two legal formulas:** `религиозная пропаганда` becomes `религиозные исповедания`.
2. **1918 is not yet 1937:** the first legal framework and the existing verified facsimile.
3. **An uneven window:** why the 1920s could hold growth and pressure simultaneously.
4. **Before closure came a public enemy image:** Savin and the press campaign.
5. **8 April 1929:** a map of prohibited community activity.
6. **18 May 1929:** what changed in the constitutional language.
7. **1 October 1929:** registration, territorial restriction, observation and liquidation procedure.
8. **A church reduced to a cult point:** careful synthesis, not an absolute legal slogan.
9. **The silencing of print and training:** issues, courses and evidence gaps.
10. **The dismantling of Union infrastructure:** Odintsov, the Moscow house and unbound Bibles with explicit source labels.
11. **People, not only institutions:** three to five controlled case cards.
12. **Prayer houses and local mechanisms:** House of Gospel plus one or two geographically distinct cases.
13. **1937:** the state's category language and the limit of what Order №00447 proves.
14. **What survived:** homes, memory and fragments of leadership without romanticizing invisibility.
15. **The wartime threshold:** partial controlled legalization and a link to `/vsehib-1944/`.
16. **Conclusion:** the state did not ban belief in one sentence; it progressively disabled the forms that made a public brotherhood possible.

## 10. Media bridge

No media is imported in this matrix lane.

The one current facsimile is a valid model because it has:

- exact local path;
- source URL;
- identified printed page;
- bounded caption;
- public-domain basis;
- MASTER identity and SHA-256;
- media-ledger entry;
- a caption that says what the page does **not** prove.

Potential future candidate types, all still separately gated:

- the verified 1918 decree facsimile;
- selected page image from the official 8 April 1929 document route;
- a title/page object for Instruction №328/Resolution №329 if reproduction rights and exact edition are clear;
- a verified House of Gospel 1929/1930 object;
- a named person portrait only after identity disambiguation and original-source rights;
- a local closure document or rehabilitation record if publication is permitted.

Do not use an unidentified prison portrait, Telegram image, modern memorial collage or AI-generated pseudo-archive as historical evidence.

## 11. Research closures that would materially improve the content lane

These are high-value but not all are blockers if the unsafe claim is removed or weakened:

1. exact original/edition/page for the Odintsov letter;
2. identity and records for P. V. Ivanov-Klyshnikov;
3. reconciliation of M. D. Timoshenko's arrest chronology;
4. OSO decision or rehabilitation records for Pavlov/Timoshenko/Dovgalyuk;
5. archival/municipal act for the House of Gospel closure;
6. exact Ermolov locator and denominator for the four-house claim;
7. last-issue/title-page evidence for `Баптист Украины` 1928 №11 and `Баптист` 1929 №7;
8. original bulletin facsimile for Instruction №328/Resolution №329 if direct quotation is selected;
9. the 1942 letter, permission and Temporary Council documents;
10. a small regionally varied case set with exact identity, arresting organ, decision and source status.

The Golden Chapter does not need to wait for every possible archive. It does need to omit or visibly qualify any claim whose blocking evidence remains absent.

## 12. Definition of Ready for the reader-facing rewrite

The Soviet Night Golden Chapter content PR may begin when:

- this matrix is accepted as the claim boundary;
- the content lane declares the existing-route relationship and does not create future placeholder URLs;
- SN-P0-01 through SN-P0-09 have either a closed source action or an explicit downgrade/removal plan;
- every selected direct quotation has exact edition/version, locator and context;
- Ivanov-Klyshnikov is disambiguated before any biographical claim or image is used;
- Timoshenko's chronology is resolved or the exact date is omitted;
- named cases have case cards and do not pretend that secondary biographies are opened archival files;
- the legal sequence distinguishes text, implementation and local outcome;
- the 1942–1944 bridge remains shorter than and subordinate to `/vsehib-1944/`;
- no new media is included unless it independently clears the rights/provenance bridge;
- the targeted diff is limited to the current Body unless a separately justified owner surface is required;
- reading time and editorial date are handled only through their canonical owner/contracts after substantive prose is final;
- exact-head validators and browser witness are planned.

## 13. Terminal recommendation

Do **not** start with another broad archive import or a stylistic expansion of the current 2,000-word article.

The next useful Product work after this matrix is a bounded Body-only Golden Chapter lane in this order:

1. factual/identity corrections;
2. complete four-step 1929 legal spine;
3. source-voice labels for official memory, academic interpretation and state documents;
4. three to five evidence-controlled human cases;
5. bounded local closure scenes;
6. Order №00447 with category limits;
7. concise wartime bridge;
8. no new media unless independently cleared;
9. exact-head content, source, glossary, roadmap, build and browser verification.
