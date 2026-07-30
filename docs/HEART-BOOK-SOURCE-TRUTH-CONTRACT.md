# Heart Book Source-of-Truth Contract

## Scope

This contract governs the book-shaped series **«Тайны человеческого сердца»** (`seriesId: hard-texts`). It exists to prevent the same data from drifting between the article body, reader chrome, landing page, Pagefind metadata and progress attributes.

## Canonical sources

- Core book-end and lead-page metadata: `src/components/article-pilots/_shared/heartSeriesData.ts`.
- Chapter composition, satellite metadata, article order and page chrome: `src/components/article-pilots/_shared/series/hardTextsSeriesConfig.ts`.
- Actual article headings and page metadata remain in each native Astro article component.
- Reader routes consume `HARD_TEXTS_SERIES.pages[pageId]`; they must not duplicate progress arithmetic.

## Ordered book sequence

The reading sequence is derived exactly once:

1. Prologue.
2. Each chapter lead followed by that chapter’s extra articles in declared order.
3. Reference handbook.

Chapter rows are navigation groups, not pages. They add neither reading minutes nor progress.

The current sequence contains 24 unique reader pages. With `tma-na-serdce` fixed at 34 minutes, the derived total is **727 minutes**. The final handbook page starts at 704 minutes and completes the book at 727.

## Progress invariants

For every actual reader page:

- `doneMin` is the sum of all preceding pages in the ordered sequence;
- `partMin` is that page’s canonical reading time;
- `totalMin` is the single derived full-book total;
- consecutive pages must have strictly increasing cumulative completion;
- an extra article must use its own page id, never its chapter lead, to resolve progress.

Forbidden patterns include:

- assigning all extras in a chapter the lead page’s `doneMin`;
- using the old core-only total for satellite pages;
- adding minutes for chapter headings;
- page-specific DOM repair, runtime override or duplicated route arithmetic.

## `tma-na-serdce` parity

The shared reader TOC must match the article’s twelve actual H2/source-section anchors in exact order. The canonical reading time is 34 minutes in:

- shared series metadata;
- visible article metadata;
- Pagefind metadata;
- `SITE_CONFIG`;
- route progress data.

The substantive scan-first source correction was completed on **30 July 2026**. That modified dateline must agree across:

- the visible article header;
- Open Graph `article:modified_time`;
- Article JSON-LD `dateModified`;
- `SITE_CONFIG.page.modified`.

A machine-readable date must not be advanced without a corresponding reader-visible update, and a substantive reader-facing correction must not retain an earlier machine or visible dateline.

## Enforcement

`scripts/hard-texts-visual-parity-audit.js` is the fail-closed regression contract. It verifies:

- exact TOC anchor/label parity;
- one current TOC row on `#pered-bogom`;
- 34-minute parity across source surfaces;
- visible and machine modified-date parity at 30 July 2026;
- 24 unique actual book pages;
- strictly cumulative progress;
- exact total of 727 minutes;
- final-page completion at 727;
- absence of the retired chapter-lead and core-only progress patterns.

This document does not create a second data source. Numeric values and dates stated here are ratcheted expectations; executable values remain derived from the canonical TypeScript and Astro sources above.
