# Teen series — reader projection / TTS / print plan

Status: **PUBLISHED / READER-PROJECTION REGRESSION PLAN**

This plan applies the current shared `GBReaderProjection` semantics to the seven teen/adult-child articles.

## 1. Current shared owner

`ReaderActionsRuntime.astro` mounts the canonical reader projection before TTS, speakable metadata, search, print and current-section consumers.

The projection excludes, among other surfaces:

- `nav`, `aside`, `footer`;
- `[data-reader-exclude]`;
- `[data-no-speech]`;
- `.footnote`, `.footnotes`;
- `.sources-block`;
- `.reading-list-section`;
- `.series-navigation`.

The teen series must reuse this owner. No teen TTS parser or print-specific DOM clone is allowed.

## 2. Historical pre-release defect — closed

The pre-release audit found bibliography/source sections that would have entered the linear reader/TTS projection if routed unchanged. That release blocker is closed in the admitted series: the current reader-projection contract reports all seven Teen source boundaries as excluded from the narrative projection.

This was a content-semantic markup issue, not a TTS-engine defect.

## 3. Post-release source-boundary invariant

All seven source/bibliography regions must retain the canonical semantic exclusion boundary used by the current reader projection.

Preferred invariant:

- source heading remains visible and linkable;
- source content remains visible, selectable, printable according to the chosen print policy;
- TTS does not automatically continue into the full bibliography;
- Pagefind/search policy is explicit rather than accidentally inherited;
- the wrapper is semantic and route-local, not a selector special-case added to the global runtime for these seven slugs.

If `.sources-block` is the current canonical class for this purpose, use it consistently. If the final article family has a stronger current component, use that component while preserving the same reader exclusion semantics.

## 4. Search versus TTS versus print are separate decisions

Do not assume one exclusion policy must govern every representation.

Desired baseline:

- **TTS:** exclude full bibliography by default;
- **speakable metadata:** exclude bibliography;
- **article-body linear reader text:** exclude bibliography from the narrative sequence;
- **site search:** keep source titles only if the current source/search policy intentionally indexes them; do not let DOI/URL-heavy bibliography dominate query relevance;
- **print:** sources may remain useful and should not automatically disappear merely because TTS excludes them.

If print needs sources while TTS does not, use the shared explicit policy attributes/classes rather than weakening the common projection.

## 5. Tooltip / glossary / TTS interaction

The shared reader projection already strips tooltip-only DOM such as glossary tooltip text and Bible tooltip payloads from readable text.

Acceptance criteria:

- visible `Еф. 6:1–4` is spoken once;
- hidden Bible tooltip text is not spoken a second time;
- glossary definition text is not injected into normal TTS unless deliberately requested by a future accessibility feature;
- footnote markers do not create duplicated speech;
- selection/highlight wrappers do not alter spoken sentence order.

## 6. Long-article TTS acceptance

These seven articles total 264 estimated reading minutes, so TTS reliability must be tested as a long-form use case rather than a short smoke test.

For each route verify:

- PLAY begins at the expected first narrative segment;
- pause/resume retains the correct segment;
- navigation between sections does not duplicate or skip text;
- opening/closing glossary/Bible overlays does not reset speech;
- locking/background Media Session remains truthful where supported;
- end of narrative does not silently continue into sources;
- stopping at the end clears active/playing UI state;
- moving to next series part does not carry stale current-section state.

## 7. Print acceptance

For all seven routes verify at A4/print preview:

- fixed mobile bars / floating controls / overlays are absent;
- headings are not stranded alone at page bottoms where the print owner can avoid it;
- blockquotes/callouts do not split pathologically;
- long URLs/DOIs wrap without horizontal overflow;
- source lists remain legible if included;
- conceptual diagrams/SVGs scale without clipped labels;
- dark-mode tokens do not produce dark-background print artifacts;
- canonical title, author/date and article identity remain understandable on paper/PDF.

## 8. Release witness

Publication is blocked until browser/DOM evidence proves for every teen route:

1. shared reader projection owner is present exactly once;
2. narrative TTS segment count is nonzero;
3. source bibliography is outside default TTS projection;
4. hidden tooltip/footnote content is not duplicated in TTS;
5. print and TTS policies do not accidentally suppress the main article;
6. no second/legacy speech owner competes with `ReaderActionsRuntime`.
