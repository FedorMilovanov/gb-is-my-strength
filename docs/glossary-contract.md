# Universal glossary contract

The glossary is a shared article capability. It must not know route names, series names, authors or individual page layouts.

## Architecture

The implementation is split into four independent layers:

1. `data/glossary.json` — canonical terms, definitions, aliases and optional per-term cadence overrides.
2. `data/glossary-policy.json` — semantic placement and hydration policy.
3. `js/glossary.js` — progressive-enhancement runtime. It reads the dictionary and policy but contains no article-specific rules.
4. `scripts/glossary-*.js` plus `.github/workflows/glossary-contract.yml` — source, normalization and browser contracts.

The shared runtime also remains below the repository's 12,000-byte hard ceiling. Compactness may not remove the declarative selector policy, Russian alias resolution, combined word/block cadence, manual-term normalization or tooltip initialization.

## Two different selector policies

`hydrationForbiddenSelectors` describes where the automatic text walker must not enter. It includes links, existing glossary elements, code and interface containers.

`placementForbiddenSelectors` describes where authors must not place glossary markup at all. It includes summaries, note boxes, contextual bridges, source lists, tables, figures, navigation, headings and other compact interface blocks.

These lists are deliberately separate. An existing `.gtip` is a valid child of a prose `.gterm`, but automatic hydration must never descend into either element.

## Authoring rule

A glossary term belongs in explanatory prose. It does not belong in:

- summaries and quick-reference cards;
- headings;
- note boxes or contextual callouts;
- tables and figures;
- bibliographies and source lists;
- navigation, timelines or related-content cards.

Use `data-glossary-skip` only as a semantic container-level declaration. It is not a route exception and must not be used to hide unresolved source errors.

## Repetition cadence

The default repeated occurrence requires both:

- at least 1,200 words since the previous occurrence;
- at least 20 prose blocks since the previous occurrence.

A term appears no more than three times per article by default. Dictionary entries may override `minWordGap`, `minBlockGap` and `maxPerArticle` when the concept genuinely requires different treatment.

## Russian morphology

All visible forms resolve through normalized aliases. Normalization currently handles:

- `ё` / `е`;
- Unicode dash variants;
- whitespace differences;
- longest alias first.

The source contract rejects alias collisions and unresolved explicit `data-term` values. New Russian inflections should be added to the canonical dictionary entry rather than handled in article code.

## Source normalization

`scripts/glossary-placement-normalizer.js` removes only invalid glossary wrappers and their hidden tooltip payload from forbidden containers. Visible prose and unrelated markup are preserved.

Modes:

```bash
node scripts/glossary-placement-normalizer.js
node scripts/glossary-placement-normalizer.js --write
```

The first command reports pending source changes and exits non-zero. The second writes normalized sources. The algorithm is covered by a route-independent fixture.

The `autofix` pull-request label is an explicit opt-in. For same-repository branches, the workflow may run the universal normalizer, validate the complete source tree and commit only deterministic source changes. When the shared runtime hash changes, the same opt-in job uses the repository's existing `scripts/cache-bust.js --write` contract and immediately verifies it again in read-only mode. Without the label, all jobs remain read-only.

The final v3 branch was reconstructed directly on the current default branch after the home polishing waves. Its bot commit contains only deterministic placement normalization and asset-revision propagation; the `autofix` label was removed before exact-head acceptance, so all final jobs are read-only.

## Floating tooltip hit testing

A desktop tooltip is portaled to `document.body` and positioned above or below its trigger. Its decorative surface must not intercept a click intended for adjacent prose or another footnote marker. Therefore the floating `.tooltip` / `.gtip` container uses pointer pass-through, while links, buttons, form controls, `summary`, explicit focus targets, `role="button"` controls and editable descendants remain interactive.

The shared style normalizer enforces the surface and descendant rules with cascade priority so older runtime declarations cannot restore background hit interception. It also upgrades the earlier non-priority form deterministically and remains idempotent. This must not be replaced by a route-specific z-index adjustment or by weakening the interaction assertion.

On mobile, outside dismissal is tested with a fixed viewport touch point that is known to lie outside the bottom sheet and trigger. A locator-based tap on a distant document element is forbidden in this fixture because Playwright may auto-scroll first and thereby test scroll suppression rather than outside-touch dismissal. The shared runtime force-closes on a genuine outside `touchend`; the short `justOpened` guard remains limited to suppressing the original opening event.

## Required validation

```bash
node --check js/glossary.js
node scripts/glossary-placement-normalizer-test.js
node scripts/glossary-contract-audit.js
node scripts/glossary-runtime-browser-test.js
node scripts/tooltip-marker-browser-test.js
node scripts/cache-bust.js
```

The browser fixture does not load a production route. It verifies the generic contract: allowed prose hydration, forbidden compact blocks, Russian inflection resolution, combined cadence and integration with the shared tooltip initializer. The marker fixture separately verifies dove geometry, hover/focus behavior, viewport containment, mobile dismissal and pointer-safe transitions between adjacent markers.
