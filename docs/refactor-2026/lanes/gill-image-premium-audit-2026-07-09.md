# Lane Report: Gill image premium audit

**Branch:** `lane/gill-image-premium-audit-2026-07-09`  
**PR:** `#51`  
**Scope:** five-page John Gill series  
**Base:** `ff55161b6858a1bbb0fad5704a11c6b41c961879`  
**Date:** 2026-07-09  
**Status:** verified / ready for merge

---

## Objective

Audit every editorial image across the Gill series at real browser widths, then correct:

- semantic placement;
- mobile and tablet focal crops;
- detached caption strips;
- undersized portrait/float images;
- unreadable infographic treatment;
- repeated artwork;
- stale source/deployed placement inherited from the pre-Astro generation;
- the expanded current-part cover inside the desktop series rail.

Routes:

1. `/articles/dzhon-gill-istoricheskiy-kontekst/`
2. `/articles/dzhon-gill-chast-1-chelovek/`
3. `/articles/dzhon-gill-chast-2-uchenyi/`
4. `/articles/dzhon-gill-chast-3-nasledie/`
5. `/articles/dzhon-gill-spravochnik/`

Viewports:

- `390 × 844`
- `768 × 1024`
- `1440 × 1100`

---

## Browser evidence

### Baseline

- Workflow run: `29008133977`
- Artifact: `8194462031`
- Second baseline with source CSS: run `29008616488`, artifact `8194679291`

### Post-fix witness

- Workflow run: `29010042777`
- Artifact: `8195260633`

### Final full validation

- Workflow run: `29011803614`
- Result: **success**
- Passed steps:
  - `npm run validate:static-publication`
  - `npm run native:runtime:audit:strict`
  - `npm run strangler:build:production-like`
  - production-like local server
  - Playwright image geometry and screenshots for all 15 route/viewport combinations

The audit package contains route-level screenshots, individual figure screenshots and geometry JSON.

---

## Baseline defects confirmed

### Shared hero defects

- Context, Part II and Part III mobile heroes lost about 24% of the image with generic `center center` cropping.
- The reference hero lost about 38% of its source image on mobile.
- A legacy `height:124%` hero treatment could expose a lower strip and made the visible crop dependent on unrelated global image rules.
- Hero loading/preload behavior differed between routes.
- Caption treatment was inconsistent with the image crop.

### Body-image defects

- Ordinary captions rendered as separate pale strips under images rather than one editorial object.
- Narrow floated images collapsed into postage-stamp widths on phones:
  - context portrait figures: approximately `154 px` wide;
  - Part III portrait figures: approximately `154 px` wide.
- The 3:1 pulpit and bookshop strips became shallow mobile bands.
- The pastoral-succession infographic was not realistically readable on mobile and had no full-size affordance.
- Several `srcset` declarations mixed descriptors or duplicated the same declared width.

### Semantic placement defects

- The Southwark illustration lived in the coffeehouse section rather than the Southwark section.
- Whitefield appeared twice in the context article, including once before the historical narrative had reached Kennington Common.
- The Part I baptism image appeared immediately after the twelve-year-old conversion account, before the actual 1716 baptism narrative.
- Three Part I pastoral images were crowded together instead of following the relevant events.
- The reference page repeated the same five-volume shelf artwork as hero and immediate body image.
- Part III still inherited old Bunhill/Spurgeon copies clustered near the later Spurgeon material; the earlier duplicate guard removed the new canonical copies instead of the stale copies.

### Historical/representational defects

Several AI/reconstruction images were captioned too categorically. The audit distinguished:

- documentary image;
- artistic reconstruction;
- symbolic illustration;
- infographic whose generated labels are not themselves the source of truth.

---

## Implemented image system

### Shared responsive hero

Added:

- `GillSeriesHero.astro`
- `GillSeriesImagePremium.astro`

All five heroes now use one responsive contract:

- eager loading;
- `fetchpriority="high"`;
- matched responsive `srcset`;
- explicit intrinsic dimensions;
- fixed cover geometry;
- route-specific `object-position`;
- compact translucent in-image series label.

The old oversized-image workaround is neutralized. The hero is now a stable framed image rather than a taller image hidden behind an arbitrary crop.

### Premium caption treatment

Body images now use a restrained museum-label composition:

- the caption remains readable outside the destructive focal area;
- it overlaps only the lower frame edge;
- the label uses blur, subtle border and shadow;
- the image and caption read as one object;
- dark mode has its own neutral treatment.

This replaces the detached pale strip without covering important content inside the image.

### Desktop current-part rail cover

The expanded rail card now integrates:

- cover image;
- dark lower gradient;
- “Сейчас читаете” label;
- part title;
- progress bar.

Per-route cover focal positions prevent the background crop from centering irrelevant or baked-in decorative text.

### Mobile art direction

- Floats become centered full editorial figures.
- Tall Southwark and Bunhill figures use a controlled portrait width rather than a tiny float.
- Pulpit and bookshop strips use a 16:9 mobile window with explicit focal edges.
- The succession infographic and Bunhill illustration include a full-size link with an “Увеличить” affordance.

---

## Semantic corrections by page

### Historical context

- Removed the repetitive Whitefield illustration from the introduction.
- Removed Southwark artwork from the coffeehouse section.
- Placed Southwark artwork immediately after the first paragraph describing the district.
- Placed Whitefield after the Kennington Common paragraph.
- Corrected Clarendon responsive candidates and qualified both Clarendon illustrations as reconstructions.
- Added cautious library, underground-meeting and bookshop captions.

### Part I — Человек

- Qualified Kettering as an artistic reconstruction, not a family-house record.
- Moved baptism after the dated account of Gill’s 1716 immersion.
- Placed Horsleydown with the district/first-pastorate material.
- Placed the pulpit after ordination and before the fifty-one-year ministry summary.
- Placed the succession infographic after the explicit lineage paragraph.
- Added a full-size zoom affordance for the infographic.
- Qualified the daughter’s funeral-sermon scene as non-portrait reconstruction.

### Part II — Учёный

A route-local correction bridge updates the existing monolithic article body without replacing it:

- the rabbinic-study scene is identified as reconstruction;
- the inkwell caption now belongs to the Song of Songs manuscript work rather than the nine-volume commentary;
- the Wesley scene is explicitly symbolic, not a record of a specific meeting;
- mobile `sizes` values are corrected.

### Part III — Наследие

- Removes stale old Bunhill and Spurgeon copies.
- Keeps exactly one canonical Spurgeon figure after the 16 August 1859 foundation-stone paragraph.
- Keeps exactly one canonical Bunhill figure immediately after the burial paragraph and before the epitaph.
- Adds Bunhill full-size zoom.
- Qualifies the transatlantic map as symbolic influence mapping, not a reconstructed single journey.

### Reference

- Removed the immediate duplicate five-volume shelf image.
- Retained one high-quality shelf hero as the visual identity of the reference page.

---

## Measured results

Across all 15 route/viewport combinations:

- horizontal overflow: **0**;
- caption/frame overlap contract: **15/15 passed**;
- mobile context minimum body-image width: approximately `154 px → 284 px`;
- mobile Part III minimum body-image width: approximately `154 px → 284 px`;
- mobile Part I/II normal body figures: approximately `340 px`;
- reference figure count: `2 → 1`;
- context figure count: `9 → 8` after removing repetitive Whitefield;
- Part III contains exactly three body images: Spurgeon, Bunhill and the transatlantic map.

Mobile hero crop estimates:

| Page | Before | After |
|---|---:|---:|
| Context | ~24.38% | ~6.21% |
| Part I | ~18.86% | ~0.50% |
| Part II | ~24.14% | ~6.21% |
| Part III | ~24.14% | ~6.21% |
| Reference | ~38.07% | ~23.17% |

The remaining reference crop is intentional art direction around the central five-volume set; the former generic center crop cut the composition without preserving that focal group.

The approximately one-pixel lower edge reported by the geometry probe is the figure border, not an empty image strip.

---

## Verification

- [x] `validate:static-publication`
- [x] `native:runtime:audit:strict`
- [x] production-like strangler build
- [x] 390 px browser screenshots
- [x] 768 px browser screenshots
- [x] 1440 px browser screenshots
- [x] all five hero screenshots
- [x] all five desktop rail-current-card screenshots
- [x] individual figure screenshots
- [x] no horizontal overflow
- [x] no repeated reference shelf
- [x] no repeated Whitefield intro image
- [x] exactly one Bunhill and one Spurgeon canonical figure
- [x] strict shared/system-file guard
- [x] workflow YAML lint during diagnostic phase

The strict-native parity audit previously expected the literal hero class in every route-local header. Each header now documents that `class="gbs2-hero"` is rendered by the shared `GillSeriesHero` component; no hidden DOM marker was introduced.

---

## Final scope

The temporary Playwright workflow and audit script were used only to produce evidence. They must be absent from the merge diff.

No image binary was regenerated in this lane. The work corrects presentation, semantic placement, responsive delivery and historical claims around the existing assets.
