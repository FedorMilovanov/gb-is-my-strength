# Teen series — media and OG plan

Status: **FOUNDATION / NO PRODUCTION MEDIA ADMISSION**

This plan applies the current Article Standard / Content Quality image contract to the seven-part teen/adult-child series without using sensational or pseudo-documentary imagery of minors.

## 1. Release invariant

A public teen route is not media-complete merely because it has an `og:image` string.

Every admitted asset must have:

- exact repository bytes;
- real width/height and aspect ratio;
- responsive derivative plan where needed;
- stable source/provenance;
- explicit rights state;
- accurate `alt`;
- accurate caption where a body figure needs one;
- OG/social crop checked independently from the desktop hero;
- no misleading documentary implication.

A file existing in Research, Drive, a generator output or the repository is not itself rights clearance.

## 2. Sensitive-subject visual guard

For this series do **not** use as default visual language:

- sexualized photographs or renders of minors;
- bedrooms/body poses/underwear/phone imagery designed to imply teen sexuality;
- identifiable real minors in a pornography, sexting, grooming, rebellion or family-crisis context without an exceptional editorial and rights basis;
- AI imagery presented so realistically that a viewer could reasonably read it as a documentary image of an actual endangered child;
- screenshots containing real private chats, names, handles, phone numbers, faces or intimate media;
- sensational `shame`, `caught`, `secret sex` clickbait compositions;
- generic dark-hoodie cybercrime stock imagery that falsely reframes the article as a crime thriller.

The visual system should communicate concealment, truth, relationship, boundaries, responsibility and restoration rather than voyeurism.

## 3. Preferred visual language

Prefer editorial/conceptual objects that do not depict a specific minor as a sexual subject:

- two-layer / double-life composition: visible family/church surface versus hidden digital layer;
- light entering a dark doorway or two rooms separated by a threshold;
- a phone as infrastructure for secrecy without sexual content on screen;
- conversation table / two chairs / open doorway for disclosure and restoration;
- church doorway / empty choir stand / seating geometry for access-versus-role distinctions;
- keys, house threshold, budget notebook or table setting for adult-child co-residence and money;
- open gate / road / returning path for departure and return without pretending to illustrate Luke 15 historically;
- adult handoff / house keys / documents for adulthood and jurisdiction;
- family counsel / wedding invitation / joined adult hands without implying father ownership for the marriage companion.

Conceptual AI or commissioned editorial art is acceptable only when clearly used as illustration and not passed off as a real case photograph.

## 4. Asset architecture

Target one coherent series family rather than seven unrelated hero styles.

Recommended package:

- one series-level visual identity;
- seven route-specific hero derivatives sharing typography-free composition language;
- one route-specific OG 1200x630 image per article OR a single verified series OG system with route-safe title metadata if the current head component supports it;
- responsive body/hero widths derived from real source dimensions;
- optional in-article diagrams only where they explain a distinction better than prose.

Do not bake article titles into images unless the chosen site-wide OG owner explicitly requires text-in-image. HTML/OG metadata remains the semantic title owner.

## 5. Proposed semantic image briefs

### I — Double life

Theme: two incompatible worlds maintained by one person.

Safe composition: a neutral phone and two contrasting but non-sensational spaces, or one doorway dividing public light from hidden digital glow. No sexual content, no frightened child portrait.

Alt concept: `Телефон на границе двух освещённых пространств как образ скрытой и публичной жизни`.

### II — After disclosure

Theme: truth after discovery, boundaries plus relationship.

Safe composition: two chairs at a table, an open notebook/phone placed face-up, daylight rather than interrogation imagery.

Alt concept: `Два места за столом и открытый телефон как образ честного разговора после разоблачения`.

### III — Church response

Theme: access to the Word is not entitlement to every trusted role.

Safe composition: open church doorway leading toward seating, with a secondary closed/guarded service-area boundary; avoid visually branding the child as expelled.

Alt concept: `Открытый вход в церковь и отдельная граница служебной зоны как образ различения доступа и доверенной роли`.

### A — Adult child left home

Theme: departure, continuing love, non-controlling contact, possible return.

Safe composition: road/path leaving a home with light still visible; no staged miserable homeless young adult.

Alt concept: `Дорога от дома и оставшийся свет в окне как образ ухода и открытой возможности возвращения`.

### B — Home, money, help, consequences

Theme: resources and household order without revenge.

Safe composition: house keys beside a simple budget notebook and table setting.

Alt concept: `Ключи от дома и открытая тетрадь бюджета как образ правил, помощи и ответственности`.

### C — Adulthood and parental authority

Theme: changing jurisdiction, continuing honour.

Safe composition: two sets of keys / adult documents separated but aligned on one table; avoid parent physically looming over adult child.

Alt concept: `Два набора ключей рядом как образ самостоятельности взрослого ребёнка и продолжающейся семейной связи`.

### D — Adult daughter, father, marriage

Theme: serious counsel plus real adult consent and marriage transition.

Safe composition: adult family conversation or wedding-related neutral objects with clear adult agency; no father giving/possessing daughter visual metaphor.

Alt concept: `Семейный разговор перед браком как образ совета, согласия и перехода к новой семье`.

## 6. Body figures / diagrams

Do not add filler figures merely to satisfy an image count.

High-value optional diagrams:

1. Part I: `old enemies / new infrastructure` diagram — world, flesh, devil remain theological categories; digital systems increase access/secrecy/repetition but are not a fourth enemy.
2. Part II: disclosure ladder — `caught ≠ confession ≠ voluntary disclosure ≠ asking for help before fall`.
3. Part III: access matrix — Word/hearing versus membership, Supper, choir, leadership, youth/trips/private access; must be clearly labelled as pastoral application, not a new biblical office chart.
4. Companion A/B: `relationship ≠ co-residence ≠ money ≠ trust ≠ ministry access`.
5. Companion C/D: honour/counsel/jurisdiction/marriage relationship distinctions.

If built, diagrams should be semantic HTML/SVG where possible, printable, keyboard-neutral and readable at 320 px rather than raster screenshots of text.

## 7. OG/social acceptance

For each public route verify:

- `og:image` resolves with HTTP 200;
- physical object exists in the promoted build;
- dimensions match metadata;
- crop is legible at common card sizes;
- no key subject is lost in 1.91:1 crop;
- no sensitive implication appears only because mobile/social crop cuts away context;
- `og:image:alt` describes the image rather than repeating the article title;
- Twitter/social projection uses the same approved rights object or an explicitly controlled derivative;
- structured data image points to an admitted object, not a placeholder.

The temporary neutral icon in `teenSeriesConfig.ts` is **foundation-only** and is a release blocker if any public route would expose it as a series cover.

## 8. Rights/provenance record

Before adding an asset, record at minimum:

- asset id / filename;
- source or creation provenance;
- creator / generator / photographer where known;
- acquisition date;
- rights/license/permission state;
- whether synthetic/editorial/documentary;
- source dimensions;
- derivative dimensions and transformation;
- intended routes/usages (hero, body, OG, rail);
- alt/caption owner;
- review status.

No `UNKNOWN` rights state may become a production hero merely because the image is aesthetically strong.

## 9. Browser/media QA

Required before release:

- 320, 360, 390, 768, 1024, 1440 px;
- DPR 1 and representative high-DPR mobile witness;
- no CLS from missing dimensions;
- correct `object-fit` / focal point;
- dark/light theme if the route supports both;
- image viewer only where semantically useful;
- print does not waste pages on decorative hero treatment if current print owner suppresses it;
- alt is not duplicated as visible caption unless both are intentionally useful;
- lazy/eager/fetchpriority follows current hero/body loading policy;
- no horizontal overflow from figure/caption/source links.

## 10. Admission boundary

This document authorizes planning only. No image is production-authorized until its bytes, provenance, rights, crop, alt/caption and route projection are reviewed together.
