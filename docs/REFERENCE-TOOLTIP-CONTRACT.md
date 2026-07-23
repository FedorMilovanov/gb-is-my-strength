# Reference tooltip contract

This document defines the site-wide contract for glossary, academic-note, and Bible-reference triggers.

## Trigger semantics

A trigger communicates the kind of reference before the tooltip opens.

- **Numbered academic or Bible note:** retain the visible sequential number (`1`, `2`, `3`, …). A numbered marker must never receive the dove class or dove SVG.
- **Standalone unnumbered explanation:** use `.fn-marker.fn-marker--dove` with no visible dagger, asterisk, cross, or source SVG before the tooltip body.
- **Forbidden trigger forms:** `†`, `‡`, cross-like Unicode glyphs, decorative cross SVGs, and unnumbered asterisks.
- **Close control:** the X inside an open tooltip remains a close control. It is not a reference trigger and is not replaced by the dove.

The shared runtime injects one canonical inline dove SVG only for `.fn-marker--dove`. Its wing reacts to hover/focus when motion is allowed. Source HTML does not duplicate the SVG.

## Optical alignment

The dove is aligned to the text optically rather than to the mathematical bottom of the inline box. The canonical CSS is maintained by `scripts/tooltip-style-normalizer.js` and validated in Chromium. Changes must preserve:

- a compact inline footprint;
- no downward sag relative to the surrounding text;
- a subtle hover lift and scale;
- a separate wing animation;
- `prefers-reduced-motion` support.

## Source normalization

`scripts/tooltip-trigger-normalizer.js` applies the contract to every supported content root. It does not contain route names, article names, or series-specific exceptions.

The normalizer:

1. leaves numbered markers unchanged;
2. removes a mistaken dove class from numbered markers;
3. converts unnumbered dagger/star/cross-SVG triggers to the dove class;
4. removes the obsolete visible trigger glyph/SVG;
5. adds `role`, `tabindex`, and an accessible name when missing;
6. normalizes the shared dove CSS;
7. is idempotent after one canonical pass.

## Browser verification

`scripts/tooltip-marker-browser-test.js` uses the production CSS and JavaScript in a route-independent fixture. It verifies:

- one dove SVG for an unnumbered explanation;
- no dove SVG for a numbered source;
- preservation of the visible number;
- absence of cross/dagger trigger content;
- optical vertical placement;
- hover wing animation and subtle movement on desktop;
- opening by hover/click and closing by Escape/outside interaction;
- mobile tap interaction and viewport containment;
- absence of browser runtime errors.

The CI artifact contains the interaction log and desktop/mobile screenshots.

## Relationship to other reference systems

- `.gterm > .gtip` is the glossary system.
- `.fn-marker > .tooltip` is the academic/explanatory note system.
- `.bref > .btip` is the Bible-reference system.

All three use the shared tooltip positioning and accessibility infrastructure, but their trigger semantics and data sources remain distinct.
