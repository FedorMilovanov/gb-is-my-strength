# A04 — Bible UX, glossary, footnotes and original languages

## Baseline

- Fresh base: `main@dec072be664c91ef3d058bfa9f30fc92e02e1b6e`.
- Astro 7 remains owned by draft PR #549; A04 has no package, configuration, migration-guard, page, component or workflow overlap.
- Current public output is the authority: all canonical production routes are rebuilt into `dist` before the A04 witness runs.
- The pre-existing A03 route witness remains byte-for-byte unchanged and executes first.

## Verdict

A04 has one interaction owner and three current public projections:

- Bible references: `.bref[data-ref]` → `.btip`;
- glossary terms: `.gterm` → `.gtip`;
- authored footnotes: `.fn-marker` → `.tooltip`.

All three are owned by `SiteUtils.makeTooltipController`. A fourth tooltip engine is forbidden.

The old `.gbx-verse` and `.gbx-ow` implementations are not current public features. A03 established zero matching public markup while their code remained retained in the shared asset. A04 records `DELETE_DEAD_RUNTIME`; it does not revive them or present runtime presence as product use.

## Ownership diagram

```mermaid
flowchart TD
  Books[data/bible/books.json\n66-book registry]
  Strict[scripts/bible-reference-contract.mjs --strict\nparser + resolver + provenance owner]
  OT[data/bible/synodal/*.json\nOT materialization]
  NT[data/bible/kassian/*.json\nNT materialization]
  BRef[.bref[data-ref] → .btip]
  Glossary[canonical glossary registry]
  Policy[data/glossary-policy.json\nplacement owner]
  GTerm[.gterm → .gtip]
  Cards[quiz / flip-card owners]
  Notes[authored footnote markup]
  FNote[.fn-marker → .tooltip]
  Shared[SiteUtils.makeTooltipController]
  OW[data/original-words.json\ndata-only registry]
  OldVerse[legacy .gbx-verse runtime]
  OldOW[legacy .gbx-ow runtime]
  Flat[data/verses.json\nsuperseded flat dataset]

  Books -->|OT default| OT
  Books -->|NT default| NT
  Books --> Strict
  OT --> Strict
  NT --> Strict
  Strict --> BRef
  Glossary --> GTerm
  Policy --> GTerm
  Policy -->|forbids nested hydration| Cards
  Notes --> FNote
  Shared --> BRef
  Shared --> GTerm
  Shared --> FNote
  Flat -. historical only .-> OldVerse
  OW -. historical only .-> OldOW
```

## Required questions

### Which surfaces are links, tooltips, dialogs or static footnotes?

| Surface | Public contract | Presentation | Activation | Decision |
|---|---|---|---|---|
| Bible reference | `.bref[data-ref]` + `.btip` | shared floating tooltip, viewport constrained on mobile | desktop focus/click; mobile touch/touch-toggle; Escape close | `KEEP_CURRENT` |
| Glossary term | `.gterm` + `.gtip` | shared tooltip; mobile sheet | desktop focus/click; mobile touch/touch-toggle; Escape close | `KEEP_CURRENT` |
| Authored footnote | `.fn-marker` + `.tooltip` | static authored note through shared runtime; mobile sheet | desktop focus/click; mobile touch/touch-toggle; Escape close | `KEEP_CURRENT` |
| Legacy verse preview | `.gbx-verse` + generated `.gbx-verse-tip` | independent custom popover | independent listeners/fetch | `DELETE_DEAD_RUNTIME` |
| Legacy original-word card | `.gbx-ow` + generated `.gbx-ow-card` | independent custom card | independent listeners/fetch | `DELETE_DEAD_RUNTIME_KEEP_DATA` |

A04 records the actual controller behavior. Open state is the trigger's `is-open`/`aria-expanded` state plus an active body-mounted tooltip. The controller does not own a `html.gb-tooltip-open` state and the witness does not invent one. On mobile, the direct universal close path is a second touch on the active trigger; this is the path the witness enforces for all three projections.

### Where can nested interactive controls violate keyboard/touch semantics?

Every canonical production route is scanned. For each owned trigger, A04 requires exactly one non-empty content node, rejects an interactive ancestor and rejects authored interactive descendants after removing the runtime-owned tooltip subtree.

The first exact-head A04 run found nine real glossary conflicts on `/articles/kod-da-vinchi/`:

- five `.gterm` controls inside `.error-flip-card`;
- four `.gterm` controls inside `.flip-card`.

Those card ancestors already own `role="button"`, keyboard activation and touch state. The fix is source-owned policy, not a test exception: `data/glossary-policy.json` now forbids hydration and manual glossary placement inside `.flip-card` and `.error-flip-card`. Existing markers there are reduced to plain text by the canonical glossary runtime.

Additional exact ownership boundaries remain:

- `.gterm` inside `.quiz-wrapper` is quiz-authored content, not a shared glossary tooltip;
- `.fn-marker.map-trigger` belongs to the map popover owner, not authored footnotes.

During real interaction, the shared runtime must move the open tooltip to `document.body`; a tooltip containing its own close/action controls must no longer be nested inside the trigger.

### Is a separate verse dataset needed?

No. `data/bible/books.json` is the catalogue and translation-owner registry for all 66 books:

- `OT` → Synodal;
- `NT` → Kassian.

The registry is complete, while physical corpus materialization is intentionally partial. The A04 run records materialized and catalogue-only books; it does not fabricate missing Bible text. The strict Bible reference contract remains the blocking owner for every public reference and fails on unresolved or unprovenanced records.

`data/verses.json` is a superseded mixed flat dataset. It must leave only in the same atomic patch as the legacy `.gbx-verse` runtime and matching CSS.

### How does an original-word card connect to lemma, transliteration, morphology and source?

`data/original-words.json` currently stores language, original form, transliteration, gloss, definition and source. Metadata keys such as `_provenance` are not lexical entries and are excluded from schema counts.

The registry remains useful owner-controlled data, but it is not yet a UI-ready linguistic contract: lemma identity, morphology and canonical verse linkage are not first-class fields. A04 preserves the data and rejects automatic UI resurrection.

### Which old tooltip solutions are useful but incompatible?

The historical `.gbx-verse` and `.gbx-ow` code demonstrates useful content shapes, but each owns its own fetch, generated floating node and listener lifecycle. That duplicates the present overlay owner and, for verses, duplicates the canonical Bible registry. The correct decision is deletion of the dormant runtimes, not migration by copy-paste or a compatibility shim.

## Enforced contract

The route workflow now executes:

1. the unchanged A03 route-semantics/runtime↔markup core;
2. the A04 ownership witness.

A04 fails closed on:

- anything other than 66 books or a split other than 39 `OT` / 27 `NT`;
- translation-owner drift from `OT→synodal` or `NT→kassian`;
- an incoherent materialization census;
- malformed or unprovenanced original-word lexical data;
- metadata being counted as a lexical entry;
- a missed production route;
- trigger/content mismatch or empty tooltip content;
- authored nested controls;
- an owned surface with no real hit-testable desktop and mobile witness;
- focusability, focus/click open state, Escape close or focus-continuity failure;
- failure to mount the active tooltip through the shared body-level owner;
- mobile viewport escape, second-touch close failure or reduced-motion mismatch;
- any public `.gbx-verse` or `.gbx-ow` markup.

The route-wide census and interaction witnesses are separate: coverage remains exhaustive without multiplying fragile first-element interaction assumptions across all 82 routes. WebKit remains an independent all-route barrier on the same canonical registry.

## Astro 7 boundary

A04 changes no package file, Astro configuration, migration guard, Astro component, page or workflow. The only production behavior change is the canonical glossary placement policy preventing nested controls inside current card owners.

## Physical cleanup boundary

The ownership decision is final. Physical removal of the dormant implementation is a separate atomic source patch covering all three coupled owners:

- `js/site.js` §1.9–§1.10;
- matching `.gbx-verse*` / `.gbx-ow*` CSS;
- `data/verses.json`.

Deleting only the dataset, hiding the fetch behind a flag or adding another bridge would create a latent broken feature and is prohibited. `data/original-words.json` and the canonical Bible registry/corpus remain.
