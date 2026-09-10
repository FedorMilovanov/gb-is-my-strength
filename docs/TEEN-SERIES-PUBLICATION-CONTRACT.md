# Teen double-life series — publication contract

Status: **FOUNDATION / NOT PUBLICATION**

This contract is the release authority for the seven-article teen/adult-child series admitted as Draft/noindex content. It does not itself create routes, discovery entries, media, or indexability.

## Canonical linear order

All seven articles are first-class **core** reading steps. Companion letters A–D are presentation labels only; they are **not** `letter`/`satellite` items in the shared series engine.

| Step | Display mark | Slug | Mobile label | Reading time |
| --- | --- | --- | --- | ---: |
| 1 | I | `podrostok-za-kadrom-dvoynaya-zhizn` | Двойная жизнь | 32 min |
| 2 | II | `podrostok-za-kadrom-roditelyam-posle-razoblacheniya` | После разоблачения | 43 min |
| 3 | III | `podrostok-za-kadrom-chto-delat-tserkvi` | Что делает церковь | 39 min |
| 4 | A | `vzroslyy-rebenok-ushel-kontakt-pokayanie-vozvrashchenie` | Ушёл из дома | 37 min |
| 5 | B | `vzroslyy-rebenok-doma-dengi-pomoshch-posledstviya` | Дом и деньги | 36 min |
| 6 | C | `sovershennoletie-roditelskaya-vlast-chto-menyaetsya` | Власть после 18 | 35 min |
| 7 | D | `vzroslaya-doch-otets-brak-soglasie-granitsy-vlasti` | Дочь и брак | 42 min |

Total reading time: **264 min**.

Required prev/next chain:

`I -> II -> III -> A -> B -> C -> D`

The shared `mark.kind: 'letter'` means a satellite that is excluded from normal prev/next and desktop rail. Therefore A–D MUST NOT use that semantic. Their letters must be rendered as labels on otherwise core items.

## Shared reader engine

Use the existing shared reader platform and `SeriesReaderChrome`; do not create a teen-specific parallel runtime.

Expected shared capabilities:

- theme and reader preferences;
- article progress;
- in-article search;
- TTS;
- print;
- bookmarks/highlights/notes;
- Bible/glossary tooltips;
- share;
- image viewer;
- keyboard/focus management and mobile sheets.

Teen-specific code should be configuration/presentation only unless a proven shared-engine defect requires a separately owned shared repair.

### Quiz

Initial publication contract: **quiz disabled** (`quiz: []`). Do not use cross-part fallback questions or score-style gamification for sexual sin, coercion, repentance, abuse, or family crisis. Any future learning surface requires an explicit pastoral-reflection design review.

## Draft/indexing boundary

`contentStatus: draft` is editorial metadata, not the controlling Astro publication gate. Until the atomic release transaction, every article MUST retain:

- `draft: true`;
- `noindex: true`;
- `sourcesRequired: true`;
- no production article route;
- no series landing/discovery projection;
- no sitemap/feed/search publication.

Do not treat a change to `contentStatus` as sufficient publication authorization.

## Publication metadata

Before indexability, each article must have an authoritative publication projection for:

- series identity;
- canonical URL;
- related/cross-series links where editorially justified;
- final publication and modification dates;
- OG image + OG alt;
- Article/WebPage/BreadcrumbList structured data;
- author/editor identity;
- Pagefind/search metadata;
- feed/sitemap membership.

The series registry, TypeScript config, frontmatter projection, route profiles, landing order and prev/next chain must agree on all seven slugs and order. A valid registry on one side is not sufficient if another projection disagrees.

## Scripture references and glossary

This series is Scripture-first. Plain textual citations must not be assumed to become interactive automatically. Publication QA must verify that intended Bible references use the current Bible-reference owner/markup and current tooltip runtime. Do not create a second regex-based tooltip engine and do not restore legacy reference markup.

Glossary hydration must remain selective. Candidate terms require an editorial decision (`GLOSSARY`, `EXPLAIN INLINE`, or `COMMON WORD`) before adding entries. High-value candidates include regeneration, sanctification, conscience, repentance, apostasy, total depravity and means of grace.

## Media contract

Draft admission does not require images; publication does.

The release needs a deliberate media package with:

- hero/inline media chosen for editorial value rather than decoration;
- provenance and rights record;
- intrinsic dimensions;
- responsive derivatives/crops;
- useful alt text and captions;
- separate social/OG suitability check.

For this subject, do not use sexualized teen stock imagery, clickbait bedroom/phone imagery, pseudo-documentary AI depictions of minors, or identifiable minors in sensitive contexts without a strong documented basis.

Prefer conceptual/editorial imagery that communicates secrecy, truth, family, boundaries, conscience, church, responsibility or restoration without eroticizing the subject.

## Reader-facing language

Internal production language must not leak into published prose. Replace phrases such as `Этот draft...`, raw HOLD/P0/P1 labels, research-chain instructions and internal operator shorthand with reader-facing epistemic language while preserving the underlying guard.

## Safeguarding boundary

Where the article discusses coercion, sextortion, grooming, threats, non-consensual intimate-image sharing or immediate danger, the final article must distinguish ordinary pastoral/parental discipline from a safeguarding situation. The guidance should be jurisdiction-neutral unless a jurisdiction is explicitly sourced.

`ALLOW CONSEQUENCES != ENGINEER MISERY` and pastoral accountability must never become a rationale for withholding necessary protection from coercion or abuse.

## TTS / print / accessibility gates

Before publication verify in the rendered DOM, not just source:

- TTS reads the article body but does not continue through long source machinery or hidden UI unless intentionally requested;
- print hides fixed bars, overlays and interactive-only controls while preserving title, body and sources;
- 320/360/390/768/1024/1440 px layouts have no clipping/overlap;
- iOS safe-area and virtual-keyboard states do not cover controls;
- Tab/Shift+Tab/Escape/focus return work for sheets/tooltips;
- touch targets are usable without hover;
- 200% zoom/reflow works without horizontal scrolling;
- reduced-motion preferences are respected;
- long DOI/URL/source strings wrap safely;
- copy/paste does not inject tooltip chrome;
- selection/highlight and tooltip interactions do not fight;
- deep links to headings survive reload/back navigation.

## Atomic publication transaction

The final release is a separate transaction after content admission. It may own, in one reviewed lane:

1. series configuration and parity contract;
2. landing and article routes;
3. page ownership/route profiles;
4. frontmatter publication metadata;
5. Bible/glossary markup pass;
6. media/OG/provenance package;
7. search/sitemap/feed discovery;
8. final indexability change (`draft/noindex`);
9. desktop/mobile/a11y/TTS/print/browser evidence.

Do not split indexability from discovery in a way that can expose a half-published series.

## Current concurrency boundary

This foundation must not mutate shared release/security infrastructure, `migration/page-ownership.json`, shared discovery registries, shared reader runtime, or the seven MDX files while those paths are owned by active lanes. Stacked work may proceed on new teen-owned contract/config surfaces and be retargeted to `main` only after its parent content admission lands.
