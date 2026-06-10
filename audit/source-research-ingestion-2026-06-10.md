# Source Research Ingestion — 2026-06-10

Статус: рабочая карта перед большой источниковой правкой.  
Источник: secret gist `MASTER-SOURCE-RESEARCH-2026-06-08.md` + pass-001..pass-027.  
Локально загружено в `incoming/source-research/gist-clone/` для анализа; это рабочий материал, не обязательно коммитить.

## 1. Объём полученного корпуса

- Markdown-файлов: 28 (`MASTER` + `pass-001`..`pass-027`).
- Строк: ~10 430.
- Символов: ~526k.
- URL-ссылок: 507 упоминаний, 284 уникальных URL.
- Топ-домены источников: `newadvent.org`, `archive.org`, `british-history.ac.uk`, `commons.wikimedia.org`, `nasscal.com`, `ccel.org`, `web.archive.org`, `gnosis.org`, `5rb.com`, `tms.edu`, `gty.org`, `legislation.gov.uk`, `qmul.ac.uk`, `press.vatican.va`, `catalogue.bnf.fr`, `repository.sbts.edu`.

Отдельный `source-inventory-2026-06-08.md`, указанный в MASTER, в клоне gist отсутствует. Есть только MASTER + pass-001..027.

## 2. Сразу найденное в текущем репо до большой правки

Перед источниковым марафоном уже был найден и исправлен технический блокер:

- `npm run tokens:check` падал из-за 12 legacy `var(--...)` в `css/site.css` внутри `gb-strip`.
- Исправлено на canonical `--color-*` tokens.
- Cache-bust обновил `site.css?v=eefef443` во всех HTML.

После этого зелёные проверки:

- `node --check js/*.js && node --check scripts/*.js && node --check sw.js` — PASS.
- `npm run tokens:check` — PASS, `0 / 0` legacy usages.
- `npm run validate:all` — PASS.
- `npm run ci:check` — PASS.
- `node scripts/audit-pro.js` — PASS: `142 passed / 0 warnings / 0 errors / 9 info`.
- `npm run visual-audit` — PASS: 32 page/viewport, 96 screenshots, 0 console/network, 0 unsuppressed.

## 3. Приоритетная карта правок по gist

### P0 / immediate

1. **P004-GILL-DECLARATION-TABLE** — Gill Part I, таблица статей X/XI/XII Декларации.  
   Gist verdict: `FAIL / NEEDS EDIT / P0`. Нужно сверить текущий HTML: возможно после поздних Gill-правок часть уже изменена, но CLAIM остаётся первым кандидатом.

2. **P004/P010-GILL-TOON-LINK** — Peter Toon / Wayback.  
   Gist verdict: `FAIL / DEAD-SPAM REDIRECT` и `NEEDS CANONICAL FIX / P0`. Нужно заменить любые старые/спам-редиректящие ссылки на точные Wayback captures, указанные в pass-010.

3. **P019-NAG-HAMMADI-IMAGE-RIGHTS/HOTLINK** — Da Vinci Code, внешнее изображение Nag Hammadi/BAS.  
   Gist verdict: `P0/P1`. Нужно проверить текущий HTML: если `<img src="https://www.biblicalarchaeology.org/...avif">` ещё встроен, заменить на безопасный локальный/Commons/PD/CC-вариант или убрать как inline image, оставив текстовую ссылку.

### P1 — Gill cluster

- **P007-CLARENDON-FIVE-ACTS**: не называть Test Act частью Clarendon Code; лучше «Кларендонский кодекс и позднейшие религиозные тесты». Текущий HTML всё ещё имеет заголовок «четыре закона», но таблица содержит 5 строк с Test Act — это нужно выровнять.
- **P007-LEGAL-SOURCES-READING-LIST**: добавить/уточнить прямые legal/source links.
- **P007-SOUTHWARK-GIN-2M**: claim про 2 млн галлонов в Саутварке — FAIL, если есть в тексте.
- **P007-HOGARTH-GIN-LANE-SOUTHWARK**: не привязывать Hogarth Gin Lane топографически к Саутварку без источника.
- **P008-SALTERS-150 / DENOM-TABLE / BIBLE-QUOTE / ISSUE**: Salters’ Hall блок требует нюанса: не просто «Троица vs арианство», а вопрос subscription; цифры/таблица/цитата требуют источниковой точности.
- **P009-ACADEMIES-MORTON-DEFOE-WATTS**: текущая фраза «у Мортона учились Дефо и Уоттс» неверна/слишком смешивает академии. QMUL прямо предупреждает о такой путанице. Уоттс связан с Rowe/Ropemaker’s Alley, а не с Morton/Newington Green.
- **P009-BRISTOL-ACADEMY-FROM-PBF**: связь PBF → Bristol Academy требует смягчения/уточнения.
- **P009-HANOVER-COFFEE-HOUSE-LOCATION / COFFEE-HOUSE-ASSOCIATION / GOAT-YARD-3X**: источники слабые или требуют точного места.
- **P011-AMERICA-BROWN-DONATION / MANNING-QUOTE-52-FOLIOS / GILL-HONORARY-DEGREE-BROWN / CAREY-CARRIED-GILL-TO-INDIA / FULLER-GILL-FOUNDATION / ANN-DUTTON-CORRESPONDENCE**: блок влияния Гилла в Америке/миссиях сильно нуждается в правке и source tightening.
- **P012-WILLIAM-WILLIAMS-DEATHBED-GILL / JOHN-GILL-PROJECT-2023-2025**: источник/датировка проекта и deathbed claim требуют правки.
- **P013-COMMENTARY-DATES / FIRST-IN-ENGLISH-PROTESTANTISM / LORDS-SUPPER-RIPPON**: Part II — даты комментариев, claim «first in English Protestantism», inflated Rippon quote.
- **P014-BIRTH-PROPHECY / EDUCATION-TABLE / PERSONAL-QUOTES-STROTHER / GO-UP-DO-BETTER / EVE-RIB-QUOTE / SOUTHWARK-GIN-LEGAL**: Part I — биографические анекдоты и legal context.

### P1 — Krajne / Jeremiah 17

- **P001/P002 Piper/Beeke/Washer**: date mismatch / loose references / source gap. Нужно убрать кавычность там, где источник не подтверждает дословность, или заменить Owen/Calvin/Spurgeon первичными источниками.
- **P002-CALVIN-4-15-10-11**: смысл PASS, но URL/точное место в reading-list/tooltips проверить.
- **P003-BERKHOF-FLESH-QUOTE / MURRAY-RAA / BAVINCK-IDENTITY**: точные страницы/формулировки.

### P1 — Da Vinci Code

- **P015-DAN-BROWN-TODAY-ABSOLUTELY**: есть archived video, но нет ручной расшифровки; не писать «дословно» без транскрипта. CNN `99 percent` подтверждён.
- **P015-GOSPEL-DATING-44-96**: нуждается в правке.
- **P015/P016/P019 HTML footnote nesting**: pass reports repeated nested tooltip/source bugs around Da Vinci. Нужно отдельно проверить текущий HTML parser/DOM, потому audit-pro span balance может не ловить семантическую вложенность сносок.
- **P016-GOSPEL-PHILIP-MOUTH-LACUNA**: нуждается в правке.
- **P017-GOSPEL-OF-PHILIP-DATING / SOURCE-LIST-QUALITY**: source apparatus upgrade.
- **P018-80-GOSPELS-REBUTTAL / SOURCE-LIST-REBUILD**: нижний список источников требует rebuild.
- **P019 images/captions**: Muratorian fragment, P52, Qumran, Nicaea icon, Gospel of Philip page, Angelo Incarnato — подписи и риск прав/атрибуции.
- **P020/P021/P022**: уже есть сильные первичные/официальные источники для JORF 1956, Vatican 2016, Calendarium Romanum 1969, Josephus/Origen/Philo, 5RB court PDFs, BnF authority notices, Dan Brown archived videos. Их надо внедрить в source list.
- **P023 celibacy/marriage**: смягчить аргументацию: Mishnah позднее Иисуса; 1 Cor 9:5 — сильный argument from silence, но не математическое доказательство; Essenes не монолитны; John the Baptist not explicit.

### P1 — Nagornaya

- **P024 generic TMS archive links**: заменить общие архивы прямыми PDF/страницами.
- **P024/P025 TMS/Farnell/Thomas line**: отделять от «всего консервативного спектра».
- **P025 Papias vs Q overclaim**: не писать, что Papias «в корне разрушает Q» или что первоисточник «назван по имени» в смысле доказательства против Q. Это P0/P1 по gist.
- **P025 Chicago Statement**: Articles XIII/XVIII нельзя использовать как запрет всякой synoptic/source discussion. Нужна таблица с nuance.
- **P026 early-papyri stability claim**: либо дать рукописную базу, либо убрать.
- **P026 MacArthur inerrancy article**: уточнить, что это старый текст/reprint, а не первично «эпохальная статья 2023».
- **P026 Spurgeon/Warfield/Chrysostom**: точные URL/переводы; Chrysostom quote exact source gap.
- **P026 Ehrman / “Christ erred” rhetoric**: смягчить публицистичность.
- **P027 Free Grace / Lordship**: `Free Grace` — самоназвание, «дешёвая благодать» — полемический ярлык; нельзя писать «всеми ведущими консервативными»; Stott/Chantry/Tozer/Boice/Hodges/Ryrie/Hutson требуют точных источников.

## 4. Первичные источники, которые уже стоит использовать как backbone

- CNN transcript Dan Brown 2003-05-25: `https://transcripts.cnn.com/show/sm/date/2003-05-25/segment/21`.
- Vatican Press Office Mary Magdalene 2016: `https://press.vatican.va/content/salastampa/en/bollettino/pubblico/2016/06/10/160610b.html`, `160610c.pdf`.
- 5RB High Court / Court of Appeal PDFs for Baigent/Leigh v Random House.
- Journal Officiel 1956 IA scan/OCR for Prieuré de Sion.
- BnF authority/catalogue notices for Dossiers secrets / Plantard / de Chérisey.
- QMUL Dissenting Academies project for Morton/Rowe/Watts/Defoe corrections.
- legislation.gov.uk / British History / Parliament for legal context.
- Archive.org / CCEL / PRDL for Gill/Rippon/Gill works/Spurgeon/Calvin/Owen.
- TMSJ / GTY / Ligonier direct pages for Nagornaya.

## 5. Proposed execution order

1. **Stabilize current uncommitted technical fix**: commit token/cache-bust fix first when token is available.
2. **P0 source fixes**: Gill declaration/Toon link + Da Vinci Nag Hammadi image/hotlink rights.
3. **Gill legal/context pass**: Clarendon/Test, academies, Salters, Southwark/Gin, coffee-house, reading-list links.
4. **Da Vinci source apparatus rebuild**: source list 1–24 + image captions + nested footnotes.
5. **Krajne source tightening**: Piper/Beeke/Washer/Berkhof/Murray/Bavinck.
6. **Nagornaya nuance pass**: TMS/Farnell/Q/Chicago/Lordship/Inerrancy citations.
7. After every batch: `npm run cache-bust` if CSS/JS changed, then `npm run validate:all`, `npm run tokens:check`, `node scripts/audit-pro.js`, and Playwright for visual/content-heavy pages.

## 6. Important operational note

The gist corpus is research material, not itself a source of truth for final article claims. Each proposed edit still needs one of:

- direct primary/official source URL in article/source-list;
- exact page/paragraph/locus;
- or a softened formulation labelled as secondary/interpretive.

## 7. Batch 001 applied — source P0/P1 hardening (2026-06-10)

Applied before push:

1. `css/site.css` / global HTML cache-bust:
   - migrated remaining `gb-strip` legacy token usages to canonical `--color-*` variables;
   - restored `npm run tokens:check` to `0 / 0` legacy var usages;
   - refreshed `site.css?v=eefef443` in HTML.

2. `articles/dzhon-gill-chast-1-chelovek/index.html`:
   - fixed Goat Yard Declaration table: Article X is now resurrection/second coming/judgment/kingdom; Article XI now combines baptism + Lord’s Supper and communion prerequisite instead of splitting them into false X/XI;
   - softened Peter Toon wording from an unverified “chief architect” quote to a sourced interpretive summary;
   - replaced unstable/dead year-only Wayback Toon URL with exact 2009 captures for `hypercal1.htm` and `hypercal2.htm`;
   - corrected Gill Eve/rib quote source label from Eph. 5:31 to Gen. 2:22, with Eph. 5:31–32 only as typological cross-reference.

3. `articles/kod-da-vinchi/index.html`:
   - removed `biblicalarchaeology.org` from CSP image allowlist after removing the BAS hotlinked image;
   - replaced BAS Nag Hammadi codices hotlink with a Wikimedia Commons public-domain Codex II page image;
   - rewrote Nag Hammadi caption to avoid claiming it is a photo of all thirteen codices;
   - tightened Muratorian Fragment caption: physical manuscript is VIII century; the canon-list text is traditionally dated to late II century;
   - softened P52 caption from categorical “oldest NT fragment” to cautious “often regarded as earliest / dating debated”;
   - softened Qumran caption: Second Temple Jewish texts, not Christian gospels and no direct Jesus/NT biography reference.

Verification after Batch 001:

- `node --check js/*.js && node --check scripts/*.js && node --check sw.js` — PASS.
- `npm run tokens:check` — PASS.
- `npm run validate:all` — PASS.
- `node scripts/audit-pro.js` — PASS: `142 passed / 0 warnings / 0 errors / 9 info`.
- `npm run visual-audit` — PASS: 32 page/viewport, 96 screenshots, 0 console errors, 0 network errors, 0 unsuppressed visual bugs.
- `git diff --check` — PASS.

## 8. Batch 002 applied — Gill historical-context source tightening (2026-06-10)

Applied:

1. `articles/dzhon-gill-istoricheskiy-kontekst/index.html`:
   - corrected Clarendon Code classification: strict Clarendon Code = four acts 1661–1665; Test Act 1673 is now framed as a later religious test, not a fifth Clarendon-Code act;
   - updated Clarendon image figcaption to match the actual image with four scrolls and the legal distinction;
   - tightened legal table wording: Corporation Act, Act of Uniformity, Conventicle Act, Five Mile Act, Test Act;
   - replaced Russian “каторга” wording for Conventicle Act with the more source-faithful transportation/exile language;
   - rewrote Dissenting Academies paragraph to avoid the Morton/Defoe/Watts conflation flagged by QMUL;
   - removed unsupported academy-cost / Edward Gill affordability claim and grounded the education paragraph in Rippon’s grammar-school/funds evidence;
   - corrected Particular Baptist Fund / Bristol Academy genealogy: PBF is no longer presented as the source from which Bristol Academy grew;
   - softened Salters’ Hall attendance from “about 150” to “more than 100” with the decisive 53/57 vote;
   - added subscription nuance: non-subscription was not identical to anti-Trinitarianism;
   - replaced the unsupported “Bible, Bible alone...” eyewitness-shout with the cautious “The Bible carried it by four” tradition;
   - removed the unsupported Southwark “2 million gallons” statistic and Hogarth topographical identification;
   - removed unsupported “direct line of sight” Kennington claim;
   - expanded reading list with direct legal/QMUL/BHO sources.

Verification after Batch 002:

- `npm run tokens:check` — PASS.
- `npm run validate:all` — PASS.
- `node scripts/audit-pro.js` — PASS: `142 passed / 0 warnings / 0 errors / 9 info`.
- `npm run visual-audit` — PASS: 32 page/viewport, 96 screenshots, 0 console errors, 0 network errors, 0 unsuppressed visual bugs.
- `git diff --check` — PASS.

## 9. Batch 003 applied — Da Vinci nested-source tooltip cleanup (2026-06-10)

Applied:

1. `articles/kod-da-vinchi/index.html`:
   - removed nested `fn-marker` inside tooltip 2 (`Holy Blood, Holy Grail` / Random House lawsuit); merged court-case context into the parent tooltip;
   - removed nested `fn-marker` inside tooltip 9 (Nicaea / Ehrman); merged Ehrman note into the parent tooltip;
   - removed nested `fn-marker` inside tooltip 21 (Prieuré de Sion); replaced weak nested CBS-style note with primary/official framing from `Journal Officiel` + BnF catalogue/authority direction;
   - verified with BeautifulSoup parser: `bad count 0`, `fn count 21` for `kod-da-vinchi`.

Verification after Batch 003:

- `npm run tokens:check` — PASS.
- `npm run validate:all` — PASS.
- `node scripts/audit-pro.js` — PASS: `142 passed / 0 warnings / 0 errors / 9 info`.
- `npm run visual-audit` — PASS: 32 page/viewport, 96 screenshots, 0 console errors, 0 network errors, 0 unsuppressed visual bugs.
- `git diff --check` — PASS.

## 10. Batch 004 applied — Da Vinci source-list rebuild (2026-06-10)

Applied:

1. `articles/kod-da-vinchi/index.html` sources block:
   - rebuilt all 24 source-list entries from rough bibliography into URL/locus-aware source apparatus;
   - added direct CNN transcript for Dan Brown’s “99 percent” claim;
   - preserved Today Show “Absolutely all of it” only as requiring manual video transcription, not as a freestanding exact primary transcript;
   - added 5RB High Court and Court of Appeal PDFs for `Baigent & Leigh v Random House`;
   - added NASSCAL for Gospel of Philip;
   - corrected Origen locus from `III.55` to `II.55`;
   - added Vatican Press Office / PDF sources for Mary Magdalene 2016;
   - added direct New Advent / CCEL / Early Church Texts sources for Nicaea, Justin, Irenaeus, Athanasius, Tertullian;
   - added Commons source links for Muratorian Fragment, Great Isaiah Scroll, Codex II Nag Hammadi image;
   - replaced weak Prieuré de Sion source notes with Journal Officiel IA scan and BnF notices for Dossiers/Plantard/de Chérisey;
   - kept popular/apologetic works as secondary/recommended, not primary basis for strong claims.

Verification after Batch 004:

- `npm run validate:all` — PASS.
- `npm run tokens:check` — PASS.
- `node scripts/audit-pro.js` — first caught mixed-content `http://arthistoryresources.net`; fixed to `https://...`; rerun PASS: `142 passed / 0 warnings / 0 errors / 9 info`.
- `npm run visual-audit` — PASS: 32 page/viewport, 96 screenshots, 0 console errors, 0 network errors, 0 unsuppressed visual bugs.
- `git diff --check` — PASS.

## 11. Batch 005 applied — Krajne high-risk attribution tightening (2026-06-10)

Applied:

1. `articles/krajne-li-isporcheno-serdce/index.html`:
   - corrected Piper `Is the Christian's Heart Deceitfully Wicked?` source date from 2014 to 2020;
   - removed unverified Beeke personal quotation/attribution and replaced it with a source-grounded Owen-style mortification paragraph;
   - removed unverified Washer personal quotation/attribution and rewrote it as a general pastoral conclusion without quotation marks;
   - softened Bavinck identity language in both body and quiz: no longer says residual sin is simply “not part of identity” without qualification; now distinguishes renewed “I” from remaining corruption while affirming that sin still remains in the same person;
   - resolved Bavinck source-list inconsistency by listing `Reformed Dogmatics`, vols. 3–4, as broader theological frame rather than exact unsupported quotation source.

Verification after Batch 005:

- `npm run validate:all` — PASS.
- `npm run tokens:check` — PASS.
- `node scripts/audit-pro.js` — PASS: `142 passed / 0 warnings / 0 errors / 9 info`.
- `npm run visual-audit` — PASS: 32 page/viewport, 96 screenshots, 0 console errors, 0 network errors, 0 unsuppressed visual bugs.
- `git diff --check` — PASS.

## 12. Batch 006 applied — Gill Part II/III source-risk tightening (2026-06-10)

Applied:

1. `articles/dzhon-gill-chast-2-uchenyi/index.html`:
   - corrected commentary timeline label to `1746–1766`;
   - softened summary claim from overbroad “first English whole-Bible commentary” to source-safe “first complete verse-by-verse whole-Bible commentary by a Baptist theologian”;
   - replaced blended G3/Spurgeon rabbinic quote with an attributed Spurgeon `Commenting and Commentaries` summary;
   - softened Kennicott assistance claim until exact source/locus is pinned;
   - softened `Body of Divinity` claim to “one of the first and most complete Baptist systems” rather than an overabsolute firstness claim;
   - removed inflated Rippon-style Lord’s Supper quotation and replaced it with a sober pastoral paragraph;
   - upgraded Spurgeon source link from BibleOutlines to direct CCEL `Commenting and Commentaries`.

2. `articles/dzhon-gill-chast-3-nasledie/index.html`:
   - softened America/Brown/Manning claims; removed unsourced exact donation/degree certainty;
   - removed high-risk “52 folio volumes” premium quote block until Brown/Manning archival source is pinned;
   - softened Fuller/Carey/BMS causation claim: next generation read and contested Gill within Baptist Calvinist soil rather than simply continuing him;
   - grounded death paragraph in Rippon’s verified date/place/age rather than literary embellishment;
   - softened Bunhill/Pantycelyn paragraph: kept Bunhill epitaph broadly, marked Pantycelyn deathbed tradition as requiring primary source;
   - removed unsupported Rippon superlative mourning quote and replaced it with cautious wording;
   - removed unsupported “John Gill Project 2023–2025” claim; replaced with concrete modern reassessment via SBJT/Rathel/Green/Mesa/Macritchie;
   - upgraded Spurgeon reading-list link from BibleOutlines to direct CCEL;
   - softened transatlantic map caption.

Verification after Batch 006:

- `npm run validate:all` — PASS.
- `npm run tokens:check` — PASS.
- `node scripts/audit-pro.js` — PASS: `142 passed / 0 warnings / 0 errors / 9 info`.
- `npm run visual-audit` — PASS: 32 page/viewport, 96 screenshots, 0 console errors, 0 network errors, 0 unsuppressed visual bugs.
- `git diff --check` — PASS.

## 13. Batch 007 applied — Nagornaya Part II synoptic/Q nuance (2026-06-10)

Applied:

1. `nagornaya/chast-2/index.html`:
   - separated Thomas/Farnell/TMS framing from “the whole conservative spectrum”;
   - softened “traditional church view for 1700 years = Independence View” into a more precise historical contrast;
   - changed the two-source/Q label from “dominates liberal scholarship” to “widely present in academic discussion”;
   - distinguished Q as a literary hypothesis from Q used as a dehistoricizing tool;
   - rewrote Papias/logia paragraph: Papias is now important early evidence for Matthean tradition, not a mathematical disproof of Q or automatic identification with canonical Greek Matthew;
   - softened the TMS/Farnell critique of literary-dependence models to avoid saying every dependency model is inherently hostile to inerrancy;
   - rewrote ipsissima vox section as an intra-conservative spectrum issue: broad vox becomes dangerous when it dehistoricizes Jesus’ teaching, not merely because it is not the narrow TMS view;
   - changed the “wide ipsissima vox” card from red fail to amber caution.

Verification after Batch 007:

- `npm run validate:all` — PASS.
- `npm run tokens:check` — PASS.
- `node scripts/audit-pro.js` — PASS: `142 passed / 0 warnings / 0 errors / 9 info`.
- `npm run visual-audit` — PASS: 32 page/viewport, 96 screenshots, 0 console errors, 0 network errors, 0 unsuppressed visual bugs.
- `git diff --check` — PASS.

## 14. Batch 008 applied — Nagornaya Part V Lordship/Free-Grace nuance (2026-06-10)

Applied:

1. `nagornaya/chast-5/index.html`:
   - corrected `Free Grace`: no longer presented as neutral translation “дешёвая благодать”; now identified as the movement’s self-designation, with “cheap/antinomian grace” framed as opponents’ critique;
   - replaced overclaim “supported by all leading conservative theologians” with “supported by a number of known Reformed/evangelical theologians”;
   - rewrote the Stott/Chantry/Tozer/Boice paragraph as a cautious overview instead of unverified long quotation chain;
   - rewrote Hodges/Ryrie/Hutson paragraph as fair summary of Free Grace objections without exact page/quote claims pending source-page verification;
   - changed “дешёвая благодать” in the Matthew 7 warning section to source-safer “исповедание без послушания”;
   - corrected Walter Chantry framing: modern Reformed Baptist author in Puritan tradition, not historically “a Puritan theologian.”

Verification after Batch 008:

- `npm run validate:all` — PASS.
- `npm run tokens:check` — PASS.
- `node scripts/audit-pro.js` — PASS: `142 passed / 0 warnings / 0 errors / 9 info`.
- `npm run visual-audit` — PASS: 32 page/viewport, 96 screenshots, 0 console errors, 0 network errors, 0 unsuppressed visual bugs.
- `git diff --check` — PASS.

## 15. Batch 009 applied — source-link hotfix + new probe guards (2026-06-10)

Applied:

1. `articles/kod-da-vinchi/index.html`:
   - replaced SSL-problematic `arthistoryresources.net` Gregory Homily 33 link with Roger Pearse HTTPS page;
   - source note now frames Gregory Homily 33 as a sermon with PL 76 locus, not a papal decree.

2. `articles/dzhon-gill-chast-1-chelovek/index.html`:
   - fixed broken sentence around Corporation Act / Test Acts civil disabilities:
     `...оставались поражёнными... лишали...` → coherent sentence about exclusion from public service/Oxford/Cambridge until repeal in 1828.

3. `scripts/audit-pro.js`:
   - added `nestedSourceTooltipGuard`: fails if `.fn-marker` appears inside another `.tooltip` source apparatus;
   - added `knownBadExternalSourceHostGuard`: fails on known bad external source hosts such as `arthistoryresources.net` that may pass ordinary mixed-content checks but fail browser SSL/certificate probing.

Verification after Batch 009:

- Roger Pearse source fetched successfully; page identifies Homily 33, PL 76, col. 1239A and explicitly notes that a sermon is not a decree.
- `node --check scripts/audit-pro.js` — PASS.
- `node scripts/audit-pro.js` — PASS; new guards report OK.
- `npm run validate:all` — PASS.
- `npm run tokens:check` — PASS.
- `npm run visual-audit` — PASS: 32 page/viewport, 96 screenshots, 0 console errors, 0 network errors, 0 unsuppressed visual bugs.
- `git diff --check` — PASS.

## 16. Batch 010 applied — Nagornaya Part IV inerrancy/source nuance (2026-06-10)

Applied:

1. `nagornaya/chast-4/index.html`:
   - removed unsupported summary claim that Matt 5–7 has high textual stability specifically “by early papyri”; replaced with source-safer wording about well-attested Gospel tradition and variants not destroying meaning/theology;
   - softened “Jesus preached in Aramaic” to “Jesus likely often taught in Aramaic; Greek is also possible in some contexts”;
   - replaced “supernatural translation” wording with organic inspiration language: Spirit used ordinary memory/translation/transmission processes to give true Greek Gospel witness;
   - corrected MacArthur title from “Inspiration under attack” to “Inerrancy under attack” wording;
   - changed GTY #2222 quote from unpinned direct quotation to paraphrase about Jesus teaching with authority;
   - rewrote Papias/logia paragraph: important evidence for Matthean tradition, not a simple disproof of Q or automatic identity with canonical Greek Matthew;
   - softened Chrysostom line: differences support living multiple witness but are not mathematical proof against every literary-dependence model;
   - softened Ehrman paragraph: removed “psychological sophism,” “invented stenography standard,” and “radical flip” rhetoric;
   - softened “if Gospels err then Christ erred” line into a careful confessional claim about canonical witness and John 14:26;
   - removed overclaim that differences “prove historical independence.”

Verification after Batch 010:

- `npm run validate:all` — PASS.
- `npm run tokens:check` — PASS.
- `node scripts/audit-pro.js` — PASS.
- `npm run visual-audit` — PASS: 32 page/viewport, 96 screenshots, 0 console errors, 0 network errors, 0 unsuppressed visual bugs.
- `git diff --check` — PASS.

## 17. Batch 011 applied — Nagornaya source-page direct links (2026-06-10)

Applied:

1. `nagornaya/istochniki/index.html` and `nagornaya/chast-1/index.html`:
   - replaced generic TMS journal archive link for Bruce W. Alvord, “The Question of Application in Preaching: The Sermon on the Mount as a Test Case” with direct PDF `https://tyndale.tms.edu/wp-content/uploads/2021/09/tmsj24f.pdf`;
   - replaced generic TMS journal archive link for Donald E. Green, “Evangelicals and Ipsissima Vox” with direct PDF `https://tms.edu/wp-content/uploads/2021/09/tmsj12d.pdf`.

Verification after Batch 011:

- `npm run validate:all` — PASS.
- `npm run tokens:check` — PASS.
- `node scripts/audit-pro.js` — PASS.
- `npm run visual-audit` — PASS: 32 page/viewport, 96 screenshots, 0 console errors, 0 network errors, 0 unsuppressed visual bugs.
- `git diff --check` — PASS.

## 18. Batch 012 applied — Krajne Berkhof/Murray source tightening (2026-06-10)

Applied:

1. `articles/krajne-li-isporcheno-serdce/index.html`:
   - replaced unverified exact Berkhof quotation/page 427 with source-safe paraphrase tied to CCEL `Systematic Theology`, Sanctification §H.2.c.(2);
   - Berkhof now supports the “old man / human nature controlled by sin” and “warfare between flesh and Spirit” line, not a fabricated exact quote;
   - removed exact Murray page claims where direct edition page verification was not pinned;
   - Murray RAA section now states the supported theological substance: deliverance from sin’s power does not eliminate all sin from the believer’s heart/life;
   - Murray `Principles of Conduct` note now marked as cf./page-to-verify rather than direct quotation with page 214;
   - kept Bavinck as softened broader Reformed frame, not exact unsupported citation.

Verification after Batch 012:

- `npm run validate:all` — PASS.
- `npm run tokens:check` — PASS.
- `node scripts/audit-pro.js` — PASS.
- `npm run visual-audit` — PASS: 32 page/viewport, 96 screenshots, 0 console errors, 0 network errors, 0 unsuppressed visual bugs.
- `git diff --check` — PASS.
