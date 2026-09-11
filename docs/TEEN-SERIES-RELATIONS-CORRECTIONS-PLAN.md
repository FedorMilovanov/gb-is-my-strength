# Teen series — relations and correction UX plan

Status: **PUBLISHED / RELATIONS + CORRECTION REGRESSION PLAN**

This plan records the current site architecture for related-content projection and the now-admitted shared correction/report-error owner. It is a post-release regression reference, not a publication TODO list.

## 1. Current relation engine is build-time, not an article-local widget

The current implementation compiles relations centrally from:

- `data/links-graph.json`;
- `data/series.json`;
- `data/relations.json`.

`src/lib/relations/compiled.ts` is the canonical composition root. The compiled graph is prerendered through `src/pages/data/relations.compiled.json.ts`, and `scripts/project-relations-to-dist.mjs` injects deterministic semantic relation panels into production-like HTML.

The projector explicitly removes legacy backlink blocks and stale relation panels before inserting the current projection. It does not require a client-side relation fetch/runtime.

Therefore the teen series MUST NOT add a teen-specific `Читайте также` component or hardcoded duplicate lists.

## 2. Series navigation and relation navigation have different jobs

The seven-part reader rail owns the canonical linear sequence:

`I -> II -> III -> A -> B -> C -> D`

The relation panel should not repeat those seven items merely to mimic prev/next.

Use relations for genuinely useful lateral context, for example:

- heart / total-depravity material where it clarifies anthropology;
- church-discipline material where Part III needs broader ecclesial context;
- hermeneutics/methodology material where a disputed text is central;
- family/marriage material only where it actually adds a different argument.

A relation edge should have an editorial rationale and verified status through the shared `data/relations.json` schema. Do not manufacture edges simply to reach a target card count.

## 3. Teen relation regression gate

For post-release regression checks:

1. all seven public article routes must exist as canonical graph nodes;
2. the `teen-double-life` series must be present in the shared series owner;
3. intentional lateral edges must be admitted to `data/relations.json`;
4. strict relation compilation must succeed;
5. the compiled endpoint must include all seven nodes without duplicate/missing identity;
6. the postbuild relation projector must either project an intentional panel or intentionally project none — never a stale legacy block;
7. series prev/next must remain independent from relation ranking;
8. mobile/desktop relation cards must not collide with the fixed series chrome;
9. relation panel links must survive search/canonical/route validation;
10. no runtime relation fetch or second relation JS owner may be introduced.

## 4. Frontmatter `related` is not sufficient release authority

Article frontmatter may still carry editorial related metadata where the content schema uses it, but the public relation surface is controlled by the compiled shared relation engine.

Do not assume that adding `related:` to seven MDX files automatically creates the current production relation panel.

Release parity should explicitly compare any frontmatter relationship intent against the canonical compiled graph rather than allow two contradictory recommendation systems.

## 5. Correction/report-error owner — admitted shared capability

The Article Standard correction surface is now implemented through `TeenSeriesCorrectionBoundary.astro`, which mounts the shared `AboutAccuracyBlock.astro` contact owner and explicitly separates editorial correction from emergency/safeguarding disclosures.

Current rule:

- do not fork a teen-only correction transport;
- do not add a third-party form endpoint casually;
- preserve the shared editorial-contact owner and the Teen safeguarding warning;
- keep correction UI excluded from reader/TTS and Pagefind projection as declared by the Teen boundary.

## 6. Shared correction contract

The shared correction owner must remain a reusable, privacy-conscious action that can be mounted by article routes. Its surrounding route-specific boundary should carry enough context to identify:

- canonical route;
- article title;
- optional section/anchor;
- reader description of the suspected problem.

It should avoid silently collecting unnecessary personal data and must have an explicit destination/retention owner.

For the teen series, the wording must distinguish:

- **editorial correction** — factual, source, wording, broken-link or technical issue in the article;
- **safeguarding/emergency disclosure** — a reader reporting coercion, abuse, sextortion, exploitation or immediate danger.

The correction mechanism MUST NOT present itself as an emergency/safeguarding hotline unless the site has a real operational safeguarding owner capable of receiving such reports.

## 7. Sensitive-disclosure boundary

Because these articles discuss minors, sexual material, coercion and family crisis, a generic `Сообщить о неточности` action can attract personal disclosures.

Post-release regression must preserve the explicit decision:

- whether the correction channel accepts only editorial reports;
- what warning appears before a reader submits sensitive personal information;
- whether the site can operationally receive safeguarding disclosures at all;
- where readers in immediate danger are directed without pretending one jurisdiction's legal route applies globally.

Until that is resolved, the teen series should not invent a contact form that creates an unowned safeguarding inbox.

## 8. Current verdict

Relations: **closed for publication; shared engine owns the series graph, including verified lateral edges in `data/relations.json`.**

Corrections: **closed for publication; Teen uses the shared correction owner behind an explicit safeguarding boundary.**
