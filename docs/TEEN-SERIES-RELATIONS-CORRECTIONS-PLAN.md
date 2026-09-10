# Teen series — relations and correction UX plan

Status: **FOUNDATION / NO PUBLICATION**

This plan records the current site architecture for related-content projection and the currently missing correction/report-error owner so the teen release does not depend on an imagined component.

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

## 3. Teen release relation gate

Before public release:

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

## 5. Correction/report-error owner — current gap

The Article Standard expects a reader-visible way to report a factual or editorial problem. In the current repository pass no established shared implementation was found under the obvious reader-facing identities (`неточность`, `сообщить об ошибке`, `feedback`, or a dedicated mailto/report surface).

This is a **site-wide capability gap**, not a reason to create a one-off teen form.

Foundation rule:

- do not hardcode a teen-only email address or form;
- do not add a third-party form endpoint casually;
- do not expose private maintainer contact details from repository metadata;
- do not claim correction UX is closed until a shared site owner exists.

## 6. Desired shared correction contract

A later site-wide owner should provide a reusable, privacy-conscious correction action that can be mounted by any article route. At minimum it should carry enough context to identify:

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

Before public release decide explicitly:

- whether the correction channel accepts only editorial reports;
- what warning appears before a reader submits sensitive personal information;
- whether the site can operationally receive safeguarding disclosures at all;
- where readers in immediate danger are directed without pretending one jurisdiction's legal route applies globally.

Until that is resolved, the teen series should not invent a contact form that creates an unowned safeguarding inbox.

## 8. Release verdict

Relations: **shared engine exists; wire the teen series into it through canonical graph data.**

Corrections: **shared owner not yet established in this audit; publication dependency remains open.**
