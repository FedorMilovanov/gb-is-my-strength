# Universal Reader W57 — architecture and visual quality gate

Status: DRAFT / release HOLD. Current W57 remains an opt-in research pilot, not a production implementation. This contract records the site-wide product intent after a real Chromium/WebKit screenshot and source audit on 2026-11-20. It **does not authorize global injection**.

## Product intent

One consistent reader engine and event/state owners, independent of the presentation theme. Changes to the global day/night action placement, text preferences, selection UI, highlight rendering, note storage, Library, TTS/Play, TOC and research rail must be made once in the shared engine and must propagate to every adopted article route. Different article series may vary by presentation tokens and structured content projection, not by copy-pasted forked event handlers.

The reader **must not replace** the separate news/G3 and Nagornaya publishing engines.

## Route cohorts and explicit exceptions

| Cohort | Relevant repository surfaces | W57 strategy |
| --- | --- | --- |
| Normal article families | `src/pages/articles/*` (57 entries including index), `src/components/article-pilots/*` | Main target. Migrate existing article-body pages in small cohorts after live parity; the `/articles/` landing is not automatically an article reader. |
| Historical Baptist collections | `src/pages/baptisty-rossii/*`, `src/components/baptisty-rossii/*` | Candidate for shared reader on **chapter/content** routes; retain collection landing, navigation and editorial chrome adapters. |
| Biography and pastoral series | `src/pages/biografii/*`, `src/pages/pastor-series/*`, article-pilot components | Share engine for full articles; landing/catalog routes keep existing page UX. Preserve series progress and Roman TOC semantics. |
| Additional long-form site material | `src/pages/hard-texts/*`, `src/pages/konfessii/*`, related article surfaces | Audit route-by-route with actual built source and article semantics before opt-in. Do not infer eligibility from route prefix alone. |
| **EXCLUDED: news and G3** | `src/pages/updates/*`, `src/pages/journal/*` and G3-specific dossiers | Protected independent runtime. No W57 injection, no hijacking of theme/search/selection, no forced CSS or shared shell substitution. |
| **EXCLUDED: Sermon on the Mount** | `src/pages/nagornaya/*` | Preserve existing independent reader and five-part series experience; integration only by explicit separate approval. |
| Non-article applications | `src/pages/map/*`, `src/pages/karty/*`, `src/pages/rodosloviye/*`, `src/pages/app/*` | Not candidates for whole-page Reader replacement. Independent visual/data owners remain. |

Eligibility source of truth: canonical route/owner contracts and actual article semantic body, never broad `/articles/*` CSS selectors or a catch-all script injector.

## One owner per capability

| Capability | Canonical direction | No-clone rule |
| --- | --- | --- |
| Reading appearance | `ReaderPreferencesHead`, `GBReaderPreferences`, shared semantic tokens | No W57 legacy/localStorage second writer after canonical readiness. |
| Reader controls and audio | `ReaderActionsRuntime`, `ReaderFloatingControlsRuntime`, Product TTS/floating owners | Moving the theme/Play/Library icon changes component/theme config only; never duplicate click listeners or speech engines. |
| Quote/highlight identity | `GBHighlights` / unified Product Library | Anchored ranges must survive identical text on the same page; preserve legacy plain quotes, note associations and export. |
| Selection controls | One shared selection toolbar/action registry | Native `#selection-share-popup` and W57 `#npW57SelectionToolbar` must not both display redundant quote/note commands for the same selected text. |
| Notes and source navigation | One linked note editor, same Product store | No per-series notes key, no accidental duplicate save, no reattachment without trustworthy source context. |
| Research rail and TOC | Shared rail lifecycle and accessibility ownership | Series-specific cards are data adapters; all mobile modal dialogs have truthful `aria-modal`, inert and focus behavior. |
| Text projection | Existing shared ReaderProjection and ScriptureDataProjection | Never guess semantics from presentation HTML; source truth differs per series. |

## Series adapter contract

Each adopted series should supply a concise **data-only** adapter: series ID, article kind, TOC hierarchy (Roman where appropriate), progress model, provenance/reference projection, supplementary research card data, and design tokens (paper/ink/muted/surface/gold/serif/density/illustration crop). Layout and event owners are shared.

Light article, dark archival biography and other series may have distinct skins, **but** 44px mobile targets, keyboard operation, readable secondary text, saved-data consistency and no duplicate actions are global invariants. The dark skin must be audited as a complete 3-column palette rather than independent left/center/right color swaps.

## Evidence and release gates

1. **Data integrity:** plain quote + anchored same-text ranges, same-range dedupe, storage failures/rollback, 200 highlights and 500 notes, edit without new ID, reload, cross-tab, Library delete/undo, provenance after article changes.
2. **Real interactions:** mouse and touch text selection on a genuinely visible paragraph (the window must scroll the actual reading scrollport), marker/underline/quote/note, recolor and CSS Custom Highlight on the actual rendered text, selection action duplication, Play speed, search, bookmark and theme actions.
3. **Personally inspected visuals:** 320/390/768/1121/1280/1440/1920, light/dark, 200% text zoom, open/closed panels, popups, real marked text, populated notes, mobile keyboard and scroll; compare composition and subjective finish, not only absence of exceptions.
4. **Migration:** Gill series first, then a structurally different normal article, then one historical/biographical cohort, then other approved long-form routes. Route-by-route opt-in, screenshots and regression evidence before each cohort. Excluded routes remain demonstrably untouched.
5. **Releases:** W57 PR remains Draft/HOLD until canonical Astro integration, complete screenshot review, green relevant CI, shared-SYS conflicts reconciled on combined bytes, and explicit release approval. No automatic main merge.

## Open design decisions for owner

- The current lime marker color is high-visibility but visually discordant with archival burgundy/gold. Test a softer distinct tone over real marked text before changing it.
- The right research rail's 9–11px metadata, helper text and icons look too faint/small in the reviewed 1440px screenshots, particularly in dark mode; refine type scale and spacing without reducing scholarly information density.
- Floating actions move visually between folded and open states. Preserve one event owner but align SVG centers and active/focus states consistently.
- Mobile reading settings look pleasant, yet overlap/near-contact with bottom navigation merits 320px and zoom/keyboard screenshots.

Reference visual runs: GitHub Actions `44773618125` (first Gill/Kod da Vinci plus mobile and dark), `44775519497` (mobile modal corrected; source selection offscreen test issue). Screenshots were **visually inspected**; highlighted-text paint and CRUD browser acceptance remain unverified until a complete passing scenario.
