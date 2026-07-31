# Bible reference data contract

This capability centralizes parsing and provenance for Bible-reference payloads. It is deliberately separate from glossary terms and academic-note triggers.

## Canonical source

- `data/bible/books.json` is the book and alias registry.
- `data/bible/<translation>/<book>.json` stores canonical records.
- `src/lib/bible-reference-core.mjs` parses references, normalizes records and resolves exact verses or contiguous ranges.
- Page-local inline payloads remain consumers and must not silently override a conflicting canonical record.

## Completeness

Every resolved record has one of two meanings:

- `full` — the complete text represented by the key;
- `excerpt` — a deliberately shortened quotation.

A range containing an ellipsis must be stored as an object with `completeness: "excerpt"` and a note explaining the omission. It must never be presented as the full range.

## Provenance boundary

`translation`, `source`, `sourceUrl` and `rights` are provenance fields. Missing provenance is reported explicitly. A catalogue label or an article-local statement is not promoted into a verified edition URL or rights conclusion.

## Strict validation

The blocking command is:

```bash
node scripts/bible-reference-contract.mjs --strict
```

It validates registry aliases, corpus keys, range completeness, central-versus-inline drift, translation drift and parser/resolver fixtures. The GitHub workflow always uses `--strict`, captures stderr in its artifact and verifies that validation is read-only.

## Trigger semantics

- Numbered Bible or academic notes preserve their visible number.
- Standalone unnumbered explanations use the dove marker.
- `.bref > .btip`, `.fn-marker > .tooltip` and `.gterm > .gtip` share positioning/accessibility infrastructure but retain independent data contracts.

## A04 ownership boundary

The static Bible contract above remains the only parser, resolver and provenance owner. A04 adds a production-output ownership witness; it does not create another corpus, another resolver or another tooltip engine.

- `data/bible/books.json` remains the canonical 66-book registry. `OT` defaults to the Synodal corpus and `NT` defaults to the Kassian corpus.
- Registry completeness and corpus materialization are different facts. A registry entry may be catalogue-only until its corpus file is present; any public reference still has to pass `scripts/bible-reference-contract.mjs --strict`.
- `.bref > .btip`, `.gterm > .gtip` and `.fn-marker > .tooltip` remain projections of `SiteUtils.makeTooltipController`.
- All three current projections open on desktop focus/click, open on mobile touch, close on Escape, and close when the active trigger is touched a second time. Focus continuity is preserved after keyboard close.
- Glossary hydration and manual placement are forbidden inside `.quiz-wrapper`, `.flip-card` and `.error-flip-card`. Those ancestors already own keyboard/touch activation; nested `.gterm[role=button]` controls would create competing interactive semantics.
- `.fn-marker.map-trigger` is a map popover trigger, not an authored footnote.
- `data/original-words.json` is retained as owner-controlled data. Metadata keys beginning with `_` are not lexical records. The data is not a UI-ready linguistic contract until lemma identity, morphology and canonical verse linkage are first-class fields.
- `.gbx-verse` and `.gbx-ow` are dormant legacy projections and are forbidden in public markup. Their independent runtimes must not be revived or copied into Astro components.
- `data/verses.json` is a superseded flat dataset. It may be removed only atomically with the legacy `.gbx-verse` runtime and matching CSS; deleting only the data or hiding the fetch behind a compatibility flag is prohibited.

The route workflow runs the unchanged A03 core first and then A04. A04 performs a route-wide census on every canonical production route, followed by representative real desktop and mobile interactions for every current shared-tooltip projection. Open state is owned by the trigger (`is-open`/`aria-expanded`) plus the active body-mounted tooltip; no undocumented root CSS class is required. The mobile close witness follows the controller's direct toggle path by touching the same active trigger a second time. The same canonical route registry is covered independently by the WebKit public-surface job.

This boundary is dependency-neutral and does not modify Astro configuration, package files, Astro components, workflows or the active Astro 7 migration lane.
