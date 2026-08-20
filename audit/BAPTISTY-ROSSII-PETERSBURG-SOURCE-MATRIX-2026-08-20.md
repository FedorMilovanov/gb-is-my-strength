# «Баптисты России» — Petersburg Source-to-Claim Matrix

**Дата:** 2026-08-20  
**Lane:** `EDITORIAL / baptisty-petersburg-source-matrix`  
**Product base / rollback SHA:** `3a6b2fc510ba5acc90df571fb921403633dcaa11`  
**Research authority SHA:** `e8e6b98787019d43a2ffd10eb55bdde04ebfb747`  
**Current route under audit:** `/baptisty-rossii/peterburgskaya-liniya/`  
**Current source body:** `src/components/baptisty-rossii/BaptistyRossiiPeterburgskayaLiniyaBody.astro`  
**Book authority:** `docs/BAPTISTY-ROSSII-BOOK-AUTHORITY-V2.md`

## 0. Lane boundary

This lane creates the source-to-claim matrix required by Book Authority v2 before the Petersburg Golden Chapter is rewritten.

It does **not**:

- rewrite reader-facing route prose;
- change route, canonical, navigation, chapter numbering or current 4-chapter public architecture;
- create any future 5-part / 20-chapter routes;
- create a Baptist Product source-confidence registry;
- rename or duplicate Research evidence classes;
- alter Research evidence/HOLD state;
- mutate media, reading time, quiz, runtime, homepage, 3D map, RSS dates or editorial dates;
- import archive objects directly from Research/Drive into Product.

`READY / VERIFY / HOLD` below are **lane-local editorial dispositions for this matrix only**. They are not a new machine enum and must not be mapped mechanically to Research `A1/A2/A3/B1/C/D`.

## 1. Historical question of the current route

The current public route should answer one bounded question:

> How did the St Petersburg evangelical awakening move from aristocratic house meetings into a wider Russian evangelical network of preaching, social practice, print, cross-regional relationships and organisation — without retroactively treating that whole stream as nineteenth-century Baptist denominational history?

This matches Book Authority v2: the Petersburg line is essential to the future documentary book, while future chapters 5–9 remain a planning graph and do not yet have independent public routes.

## 2. Disposition semantics

### `READY`

The evidence presently supports a careful public paraphrase at the stated strength. Direct quotation is allowed only where the underlying Research object has an exact verified locator/quote-card state sufficient for quotation.

### `VERIFY`

A relevant source exists, but the exact page/section, source voice, visual verification or cross-source check is not yet strong enough for an unqualified sentence or quotation. The content lane may keep the claim only with explicit attribution and reduced strength, or must first close the locator.

### `HOLD`

The current wording is conflicted, teleological, stronger than its evidence, or factually unsafe. Do not strengthen or copy it into the Golden Chapter until the listed correction is completed.

## 3. Canonical evidence anchors

### Product authority

- `docs/BAPTISTY-ROSSII-BOOK-AUTHORITY-V2.md`
  - current public surface remains stable;
  - future 5 parts / 20 chapters are a planning graph only;
  - source-to-claim matrix is a publication-readiness requirement;
  - reader-facing source labels must remain distinct from internal Research evidence classes.

### Research authority

All paths below are pinned conceptually to Research SHA `e8e6b98787019d43a2ffd10eb55bdde04ebfb747`.

- `БАПТИСТЫ РОССИИ/baptists_v120_TRUE_GROUPED/groups/02_HISTORY_NARRATIVE.md`
  - canonical historical framing;
  - Pashkov 1880 confession anchor;
  - House of Gospel 1911 eyewitness anchor;
  - chronology for 1908–1911;
  - explicit caution against collapsing denominations and retrospective labels.
- `.../groups/03_PERIODICAL_CORPUS.md`
  - `Христианин`, `Братский листок`, `Утренняя звезда`, `Молодой виноградник` and other public-print corridors;
  - publication voice/genre risks.
- `.../groups/08_INSTRUCTIONAL_LETTER_1960_AND_VLADIKAVKAZ_1885_OCR.md`
  - quote-ready OCR of the 1885 Vladikavkaz conference;
  - Kargel as representative of St Petersburg brothers;
  - Russian/German support and `союз мира` language.
- `.../groups/09_CONGRESS_EC_1911_AND_BRATSKY_VESTNIK_1945_OCR.md`
  - quote-ready 1910–1911 EC congress protocols;
  - quote-ready 1945 `Братский вестник` Prokhanov retrospective.

### External catalogue / academic anchors

These are not substitutes for Research state; they are stable public locators useful for publication apparatus and cross-checking.

1. University of Birmingham, **Pashkov Papers**, catalogue record `XVP`: 3017 literary manuscript and printed items, fonds date 1877–1909; correspondence series 1874–1901.  
   `https://calmview.bham.ac.uk/Record.aspx?id=XVP&src=Catalog`
2. Edmund Heier, *Religious Schism in the Russian Aristocracy 1860–1900: Radstockism and Pashkovism*. Springer. Chapter `Pashkovism: Diffusion Among the Masses and Persecution`, pp. 107–149.  
   `https://link.springer.com/book/10.1007/978-94-010-3228-5`
3. I. S. Prokhanov, *In the Cauldron of Russia, 1869–1933*, 1933, Theological Commons / Princeton Theological Seminary, 302 pages, public-domain rights note.  
   `https://commons.ptsem.edu/id/incauldronofruss00prok`

## 4. P0 factual conflicts to repair in the next content lane

### PBG-P0-01 — Prokhanov birth year conflict

**Current public wording:** `17 апреля 1866 года`.

**Conflict:**

- Research master currently records Prokhanov as `1869–1935` and describes that route as verified through a metrical-book / Vladikavkaz birth-record path;
- Princeton/Theological Commons catalogues his own autobiography as *In the Cauldron of Russia, 1869–1933* and identifies him as `1869–1935`;
- the quote-ready 1945 `Братский вестник` retrospective by Ya. I. Zhidkov says `17 апреля 1866 г.`.

**Disposition:** `HOLD`.

**Required action:** resolve against the exact metrical/birth-record locator before the reader-facing rewrite. The Golden Chapter must not preserve `1866` merely because a 1945 memorial article says so. Until the primary identity record is opened, treat 1945 as an attributed retrospective, not the identity SSOT.

### PBG-P0-02 — Russian Evangelical Union vs Union of Evangelical Christians

**Current public wording:** `В 1909 году эта линия оформится в Союз евангельских христиан`.

**Problem:** this compresses distinct organisational stages.

Research chronology currently separates:

- June 1907 — Prokhanov charter project for the Russian Evangelical Union;
- May 1908 — MVD approval of the Russian Evangelical Union charter;
- January 1909 — organisational/constitutive stage of that interdenominational union;
- September 1909 — first All-Russian congress of Evangelical Christians and the confessional EC organisational project;
- 28.12.1910–04.01.1911 — second EC congress, with statute/confession and mature institutional form.

**Disposition:** `HOLD` for the current one-line formulation.

**Required action:** rewrite as a short chronology that distinguishes the interdenominational `Русский евангельский союз` from the confessional `Союз евангельских христиан`.

### PBG-P0-03 — Fetler leakage from the 1885 Research summary

Research dossier 08 summary labels the 1885 document as involving `Каргель, Фетлер`, but the quote-card text surfaced for the conference explicitly names **Kargel**, not Fetler. Research master elsewhere gives Wilhelm Fetler as `1883–1957`, making a substantive 1885 conference role chronologically implausible unless the primary scan proves a different referent.

**Current Product status:** the public Petersburg article does **not** presently insert Fetler into the 1885 scene. Preserve that restraint.

**Disposition:** `HOLD` on any future 1885 Fetler claim.

**Required action:** do not propagate the Research summary phrase. Only a page-image locator from the 1885 primary object can remove this HOLD.

## 5. Source-to-claim matrix

| ID | Current / planned claim | Best evidence now | Voice / state | Disposition | Allowed public strength now | Required next action | Future book node |
|---|---|---|---|---|---|---|---|
| PBG-01 | Petersburg is not Baptist history in the narrow denominational sense, but a major line of future Evangelical Christianity | Book Authority v2 + Research 02 canonical framing | editorial synthesis grounded in Research | READY | Keep as clearly editorial framing, not a primary-source fact | none before paraphrase | Ch. 5 |
| PBG-02 | The St Petersburg stream involved Radstock, Pashkov, Korf and aristocratic/urban circles | Research 02 | historical synthesis | READY | concise factual framing | add exact secondary footnote only if names are expanded biographically | Ch. 5 |
| PBG-03 | Sofia Lieven remembers Radstock praying for Russia for about ten years, Paris contacts, and arrival in winter 1874 | Lieven memoir | late participant/family memory; exact page not closed in Product | VERIFY | `По воспоминаниям Софии Ливен...` only | obtain edition + page locator; distinguish what she witnessed from inherited family memory | Ch. 5 |
| PBG-04 | Radstock did not know Russian and preached in English/French to upper-class listeners | Lieven + Heier corridor | memoir + academic reconstruction | VERIFY | attributed paraphrase | exact Lieven/Heier page range | Ch. 5 |
| PBG-05 | Radstock’s preaching centred on personal conversion, grace and Scripture | Lieven memoir; Heier secondary | memoir/academic | VERIFY | attributed synthesis; no floating quotation | page locator for Lieven quotation and Heier corroboration | Ch. 5 |
| PBG-06 | Pashkov’s conversion can be narrated as more than later legend | Pashkov’s own 9 Apr 1880 letter published in `Церковный вестник` №19 | primary participant document; text extracted; Research says quote-ready pending visual masthead check | READY for paraphrase / VERIFY for verbatim | foreground Pashkov’s own self-description and justification-by-grace testimony | visual masthead/page-image quote-card before verbatim quotation | Ch. 5 |
| PBG-07 | The dinner/prayer conversion scene at Alexandra Pashkova’s home happened exactly as current prose narrates | Lieven memoir | late memory, exact locator not closed | VERIFY | keep only as `По Ливен...`; do not make the dramatic mechanics the factual anchor | exact page locator; compare with Pashkov’s 1880 self-testimony | Ch. 5 |
| PBG-08 | Pashkov turned the movement into Russian-language preaching and a broader social practice | Pashkov 1880 self-description + Lieven + Heier + archive corpus | mixed primary/memoir/secondary | READY as cautious synthesis | describe measurable practices, not a heroic causal slogan | replace `сделал проповедь русской` with evidence-led description | Ch. 5 |
| PBG-09 | House meetings crossed social strata; women of the Petersburg circle were part of mission infrastructure | Research 02 explicitly preserves Lieven/Chertkova/Gagarina/Peiker and home/charity/prison/hospital/print roles | canonical Research synthesis; underlying locators uneven | READY for broad synthesis, VERIFY for named scenes | women are infrastructure, not background | source-map each named woman before adding individual anecdotes | Ch. 5 |
| PBG-10 | Pashkov visited hospitals/prisons and the network supported schools, literature, songs and aid | Lieven memoir + broader Pashkovite corpus | memoir-led | VERIFY | attributed broad statement only | page locators + at least one independent/archival corroboration for each concrete institution claimed | Ch. 5 / 8 |
| PBG-11 | Early Radstockism/Pashkovism did not initially set denominational separation from Orthodoxy as its simple goal | Heier, especially chapter pp. 107–149, plus Research caution | academic reconstruction | VERIFY | `Хейер показывает/интерпретирует...` | exact page/section for the proposition; avoid presenting Heier’s interpretation as participant self-description | Ch. 5 |
| PBG-12 | Korf remained a key participant and later continued witness in exile | Lieven/secondary corridor | insufficient exact locator in current Product | VERIFY | short attributed sentence at most | exact biographical locator | Ch. 5 |
| PBG-13 | Meetings moved to the Lieven home at Bolshaya Morskaya 43 and the princess gave the quoted God/Emperor reply | Lieven memoir | late memory; quotation currently lacks page locator | VERIFY | scene may remain only with explicit memoir attribution; quotation not publication-ready | exact edition/page and visual check | Ch. 5 |
| PBG-14 | Kargel lived in the Lieven network and accompanied Baedeker; Baedeker’s prison mission reached Siberia/Sakhalin | Lieven + Pashkov Papers have Baedeker correspondence series, but exact Kargel/Baedeker claim locator is not closed | mixed memoir/archive metadata | VERIFY | broad attributed sentence only | exact Lieven page + archive/secondary corroboration; do not infer Kargel from catalogue metadata alone | Ch. 6 |
| PBG-15 | The 1885 Vladikavkaz document calls the gathering the `первая самостоятельная русская конференция` and names Kargel as representative of the St Petersburg brothers | Research 08, real PDF → OCR → quote-card | primary document; quote_ready | READY | strong factual paraphrase; direct quote only under Research locator rules | retain old-orthography/source note; no Fetler insertion | Ch. 4 / 6 |
| PBG-16 | The same 1885 document records support from Russian and German congregations and the phrase `сохраняя союз мира` | Research 08 | primary document; quote_ready | READY | factual paraphrase / short verified quotation | preserve source context; avoid converting cooperation into later denominational merger teleology | Ch. 4 / 6 |
| PBG-17 | `За три десятилетия до объединения 1944 года ... уже тянулись друг к другу` | inference from 1885 contact | editorial/teleological inference | HOLD | replace with `протокол показывает практический контакт...` | remove 1944 inevitability language | Ch. 6 / 7 |
| PBG-18 | Pashkov Papers are a large archival corpus: 3017 items, fonds 1877–1909, correspondence 1874–1901 | University of Birmingham official catalogue `XVP` | institutional catalogue | READY | exact catalogue facts only | switch Product bibliography to official UoB CalmView as canonical public locator; keep ArchivesHub only if useful as alternate | Ch. 5 |
| PBG-19 | Pashkov was converted during Radstock meetings, then led the movement after Radstock’s departure and was exiled | archive biographical note / Heier / memoir corridor | catalogue/secondary/memoir | VERIFY | separate each event, attribute where necessary | exact UoB administrative-history or Heier page locators; do not treat 3017-item existence as proof of every biography claim | Ch. 5 |
| PBG-20 | April 1884 Petersburg conference was interrupted by police; Pashkov and Korf were soon exiled | current Product + chronology/secondary corridor | strong historical claim but exact primary/secondary locator not yet closed in this matrix | VERIFY | keep concise and cross-link prior route only after locator | attach exact police/administrative or high-quality secondary locator | Ch. 4 / 5 |
| PBG-21 | Prokhanov’s own autobiography describes a plan to return and make Petersburg a centre of evangelical work | *In the Cauldron of Russia* exists publicly, 1933, 302 pp | primary autobiography; exact page not yet closed | VERIFY | `В автобиографии Проханов вспоминал/писал...` only after page closure | open exact page images/text and record page locator | Ch. 7 |
| PBG-22 | Prokhanov inherited the Petersburg line `infrastructurally`: city centre, print, hymns, international contacts, organisational thinking | Research 02 + periodical corpus + autobiography corridor | editorial synthesis | VERIFY | can become chapter thesis only after components are independently evidenced | source each component; avoid single-source causal inheritance claim | Ch. 7 / 8 |
| PBG-23 | `В 1909 году эта линия оформится в Союз евангельских христиан` | Research chronology distinguishes 1908 Russian Evangelical Union and 1909–1911 EC organisation | chronology conflict/compression | HOLD | no current one-line formulation | rewrite with 1908/1909/1910–11 distinction | Ch. 7 |
| PBG-24 | Second All-Russian EC congress ran 28 Dec 1910–4 Jan 1911 in St Petersburg | Research 09 | primary congress protocols; quote_ready | READY | exact factual statement | none beyond normal locator apparatus | Ch. 7 / 9 |
| PBG-25 | Prokhanov was elected congress chair 46 of 47 ballots | Research 09 QC-C1 | primary; quote_ready | READY | exact fact; quote may be used within quote limits/locator rules | preserve `46 из 47` rather than `единогласно` without explaining the ballot | Ch. 7 |
| PBG-26 | Congress adopted statute/confession and discussed education, schools and temperance | Research 09 QC-C2/C3 | primary; quote_ready | READY | factual, source-led description | separate what the protocol literally resolved from editorial interpretation | Ch. 7 / 9 |
| PBG-27 | Temperance resolution was `социальная альтернатива в спивающейся стране` | primary resolution supports abstinence, not the broad social diagnosis by itself | editorial interpretation lacking social-history source | HOLD for current rhetoric | say what the congress required; social-historical context needs separate B1 source | add social-history source or remove loaded phrase | Ch. 7 |
| PBG-28 | Two-year courses were `ответ на правительственный запрет библейских курсов` | Research 09 includes this interpretation, but the quoted protocol itself concerns proceeding after publication of relevant laws | primary + editorial gloss | VERIFY | distinguish protocol language from causal gloss | attach legal/administrative source for the prior ban | Ch. 9 |
| PBG-29 | Latvian Baptist congress accepted EC proposal and chose two representatives for a future joint committee | Research 09 QC-C5 | primary; quote_ready | READY | exact factual statement | none | Ch. 7 |
| PBG-30 | That 1910 joint committee was a `direct predecessor` of the 1944 union | later-history teleology | inference, not the literal primary claim | HOLD | call it an early unity attempt / part of the prehistory of later cooperation | remove inevitability/direct-line wording | Ch. 7 |
| PBG-31 | 1910 delegates reported closed meetings, baptism obstruction, property pressure and children expelled from school | Research 09 QC-C4 | primary congress reports; quote_ready | READY with attribution to delegate reports | `делегаты сообщали...` | do not silently generalise each report to the entire empire | Ch. 7 / 13 |
| PBG-32 | Manifest-era freedom `constantly ran into gubernatorial discretion` | synthesis from local reports | broader legal-historical claim | VERIFY | cautious synthesis only | add imperial legal/administrative B1 or primary circular context | Ch. 13 |
| PBG-33 | House of Gospel opened in St Petersburg in Dec 1911 and had an international Baptist presence | Research 02 v125d, Kuteinikova eyewitness | primary eyewitness; text extracted; Research allows paraphrase, verbatim awaits page-image quote-card | READY for paraphrase / VERIFY for verbatim | strong paraphrase with eyewitness attribution | masthead/page-image quote-card before direct quote | Ch. 9 |
| PBG-34 | Current Petersburg route should add House of Gospel as a major institutional scene | Book Authority ch. 9 + Research 02 primary anchor | editorial architecture | READY as expansion plan | add after congress chronology, without creating a new route | source-led scene, then later extract only when future Ch. 9 meets DoR | Ch. 9 |
| PBG-35 | Prokhanov birth `17 April 1866` | 1945 Zhidkov says 1866; Research identity route + 1933 autobiography metadata say 1869 | direct conflict | HOLD / P0 | do not republish 1866 in rewritten text | resolve primary metric record; likely correction to 1869 | Ch. 7 |
| PBG-36 | Zhidkov calls Prokhanov the largest figure, describes his languages and `десятисборник` of 1237 songs | Research 09 QC-B3 | 1945 insider retrospective; quote_ready | READY **with attribution** | `По воспоминанию/оценке Я. И. Жидкова...` | do not convert evaluative language into neutral fact; cross-check numeric hymnography if used outside attribution | Ch. 7 / 8 |
| PBG-37 | Prokhanov spent 1928–1935 abroad; illness/death in Berlin and last words | Research 09 QC-B3/B4 | insider retrospective, quote_ready; later event outside core Petersburg period | READY with attribution for retrospective detail | concise epilogue, explicitly sourced to Zhidkov | cross-check exact death date and medical detail if used as neutral biography | Ch. 7 / 20 |
| PBG-38 | `через девять лет после его смерти ... соединятся в один союз` | arithmetic/retrospective narrative | factual chronology but teleological closure | VERIFY stylistically | chronology is fine, inevitability is not | rewrite as later historical outcome, not fulfilment of Petersburg destiny | Ch. 7 / 16 |
| PBG-39 | Petersburg `explains the word evangelical` and is the `third source` of future ECB world | Book Authority-compatible editorial thesis | editorial synthesis | READY only as signposted interpretation | keep in conclusion as `в логике этой книги` / `в нашей схеме` | avoid presenting metaphor as settled historiographic taxonomy | Ch. 5–9 synthesis |

## 6. Immediate corrections vs expansion

The next reader-facing content lane must distinguish **corrections** from **growth**.

### 6.1. Corrections first

1. Resolve and correct Prokhanov birth year (`1866` conflict; current authority points to `1869`).
2. Separate Russian Evangelical Union 1908/1909 from the confessional Union of Evangelical Christians 1909–1911.
3. Remove/soften `direct predecessor of 1944` language.
4. Replace `already reached for each other` teleology around 1885 with the narrower claim actually supported by the protocol: practical St Petersburg / Russian-German contact and cooperation.
5. Remove or source the phrase `in a drinking country` / equivalent broad social diagnosis.
6. Distinguish the literal 1911 protocol on courses from the claim that the courses were specifically a response to a government ban.
7. Keep the 1885 Fetler claim out unless the primary page proves it.

### 6.2. Evidence-backed expansion second

After corrections, grow the route through documentary scenes rather than filler:

1. **1874 / Radstock:** short memoir-led opening, with Lieven explicitly identified as memory rather than omniscient narrator.
2. **1880 / Pashkov in his own words:** make the primary confession letter the doctrinal/mission anchor of the Pashkov section.
3. **Homes and social infrastructure:** restore women of the Petersburg circle as actors; add only named scenes with locators.
4. **1884:** keep the police/exile scene compact and sourced; avoid duplicating the previous route.
5. **1885 / Kargel bridge:** use the primary Vladikavkaz protocol.
6. **Archive pause:** Pashkov Papers as a documentary object; explain the difference between catalogue existence and claims actually read from files.
7. **1906–1910 / print public sphere:** use `Христианин`, `Братский листок`, `Утренняя звезда`, youth/print corridors from Research 03; each issue needs issue/page authority before quotation.
8. **1908–1911 / organisation:** distinguish organisational layers; make the 1910–1911 congress protocols the hard primary spine.
9. **December 1911 / House of Gospel:** add Kuteinikova eyewitness scene as the institutional culmination of the Petersburg arc.
10. **Prokhanov epilogue:** use 1945 Zhidkov only as an attributed retrospective and resolve identity date first.

## 7. Proposed Golden Chapter structure for the existing route

This is a rewrite outline for the **existing** `/peterburgskaya-liniya/` route, not a route-creation plan.

1. **Cold open — Petersburg, 1874:** foreign-language salon preaching enters a city of houses and networks.
2. **Radstock and the language of personal conversion:** memory with explicit source voice.
3. **Pashkov speaks for himself, 1880:** primary confession before memoir reconstruction.
4. **The house becomes infrastructure:** women, meetings, aid, literature, prison/hospital work — only source-backed scenes.
5. **1884: publicity meets coercion:** short, linked to the prior article.
6. **Kargel as a bridge, 1885:** primary conference protocol.
7. **An archive, not a legend:** Pashkov Papers and what still has not been opened.
8. **Print changes scale, 1906–1910:** periodicals and hymn/public language.
9. **Do not collapse two unions:** Russian Evangelical Union → 1909 EC congress → 1910–1911 second congress.
10. **1911: a statute, a school programme, a unity attempt:** primary congress protocols with interpretation separated.
11. **House of Gospel:** eyewitness culmination and international network.
12. **Prokhanov after Petersburg:** brief retrospective, not an overloaded biography.
13. **Conclusion:** Petersburg as one line in the later ECB synthesis, explicitly marked as the book’s interpretive architecture.

## 8. Quote policy for this lane and the next

- No direct quotation from a source merely because OCR text exists.
- For Pashkov 1880 and Kuteinikova 1911, follow Research’s explicit warning: paraphrase is currently stronger than unverified verbatim until page-image/masthead quote-card closure.
- For the 1885 conference, 1910–1911 congress and 1945 `Братский вестник`, preserve the existing Research quote-ready provenance and exact document identity.
- Lieven quotations require edition + page locator and must stay marked as memoir testimony.
- Heier is an academic reconstruction; cite the actual English title/chapter/page, not an unsourced Russian shorthand title.
- Catalogue descriptions can prove collection metadata, not every event described elsewhere in the article.

## 9. Media bridge for the Golden Chapter

No media is imported in this matrix lane.

For the subsequent content/media lane:

1. identify 2–5 historically real objects for the existing route;
2. prefer Pashkov/Prokhanov/periodical/document objects that add evidence, not decoration;
3. require rights/provenance/local-file/SHA/media-ledger closure before site use;
4. `article-ready` in MASTER is not `site-ready`;
5. unidentified archive photographs stay excluded from covers and confident captions;
6. no AI-generated pseudo-archival photograph may stand in for a historical object.

Candidate object types, subject to rights/locator closure:

- Pashkov Papers catalogue/facsimile object if reproduction rights permit;
- title/masthead page of Pashkov’s 1880 confession publication;
- 1910–1911 congress protocol title page;
- House of Gospel 1911 document/photograph with proven rights;
- `Христианин` / `Братский листок` / `Утренняя звезда` issue object tied to an actual cited section.

## 10. Definition of Ready for the reader-facing rewrite

The Petersburg Golden Chapter content PR may begin when:

- this matrix is accepted as the claim boundary;
- PBG-P0-01 identity conflict has a primary/authority decision;
- PBG-P0-02 organisational naming/date distinction is fixed in the rewrite plan;
- every direct quotation selected for the article has an exact locator and permitted quote state;
- every strong causal sentence is either supported by a suitable source or explicitly marked as editorial synthesis;
- no 1885 Fetler claim is introduced without primary proof;
- the route remains the existing public route, with no future placeholder URLs;
- reading-time and editorial-date changes, if any, are handled only by their canonical owner/contracts after substantive prose is final;
- media, if added, passes the separate rights/provenance bridge.

## 11. Terminal recommendation

Do **not** commission another total audit before rewriting Petersburg.

The next useful Product work is a bounded reader-facing Golden Chapter lane using this matrix, in this order:

1. factual corrections;
2. Pashkov 1880 primary anchor;
3. memoir/academic locators;
4. Kargel 1885 primary bridge;
5. print/public-sphere expansion;
6. 1908–1911 organisational chronology;
7. House of Gospel 1911 scene;
8. attributed Prokhanov retrospective;
9. media bridge;
10. exact-head publication/browser witness.
