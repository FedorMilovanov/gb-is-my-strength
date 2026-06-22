# Gill context pilot implementation — 2026-06-22

**Route:** `/articles/dzhon-gill-istoricheskiy-kontekst/`
**Status:** Phase G16 complete in source layer — componentized shadow-breakout + header/hero, all 12 article-body sections, and post-article SDG block promoted to Astro, no content/visual change intended.
**Reason:** `/articles/kod-da-vinchi/` is being handled by another agent; Gill is the next high-risk, not-currently-active GBS2 route family.

---

## What changed

The route moved from pure full-body shadow transport:

```astro
const { headHtml, bodyHtml, bodyAttributes } = loadLegacyFullDocument(...)
<Fragment set:html={bodyHtml} />
```

to a Gill-specific componentized shadow-breakout:

```astro
<Fragment set:html={segBefore} />
<GillContextMainShell />
<Fragment set:html={segAfter} />
```

Main shell seams:

- `src/components/article-pilots/gill-context/GillContextMainShell.astro`
- `src/components/article-pilots/gill-context/GillContextHeaderHero.astro`
- `src/components/article-pilots/gill-context/GillContextArticleBody.astro`
- `src/components/article-pilots/gill-context/GillContextPostArticle.astro`
- `src/components/article-pilots/gill-context/_legacy/body-segment-0.html`
- `src/components/article-pilots/gill-context/_legacy/body-segment-1.html`
- `src/components/article-pilots/gill-context/_legacy/header-hero.html`
- `src/components/article-pilots/gill-context/_legacy/post-article.html`

Phase G2 then retired the article-body monolith:

- removed `src/components/article-pilots/gill-context/_legacy/article-body.html`;
- `GillContextArticleBody.astro` now owns `<article class="article-body">`;
- body content was first rendered from 12 ordered fragments under `src/components/article-pilots/gill-context/_legacy/article-sections/`:
  - `00-summary-and-intro.html`
  - `01-sec-from-puritans-to-baptists.html`
  - `02-sec-particular-vs-general.html`
  - `03-sec-great-ejection.html`
  - `04-sec-clarendon.html`
  - `05-sec-academies.html`
  - `06-sec-salters-hall.html`
  - `07-sec-coffee-house.html`
  - `08-sec-southwark.html`
  - `09-sec-books.html`
  - `10-sec-conclusion.html`
  - `11-sec-sources-and-series-tail.html`

Phase G3 promoted the first visible low-risk section:

- removed `src/components/article-pilots/gill-context/_legacy/article-sections/10-sec-conclusion.html`;
- added `src/components/article-pilots/gill-context/GillContextSectionConclusion.astro`.

Phase G4 promoted the second low-risk section:

- removed `src/components/article-pilots/gill-context/_legacy/article-sections/05-sec-academies.html`;
- added `src/components/article-pilots/gill-context/GillContextSectionAcademies.astro`.

Phase G5 promoted the third low-risk section:

- removed `src/components/article-pilots/gill-context/_legacy/article-sections/02-sec-particular-vs-general.html`;
- added `src/components/article-pilots/gill-context/GillContextSectionParticularVsGeneral.astro`.

Phase G6 promoted the fourth low-risk section:

- removed `src/components/article-pilots/gill-context/_legacy/article-sections/09-sec-books.html`;
- added `src/components/article-pilots/gill-context/GillContextSectionBooks.astro`.

Phase G7 promoted the fifth visible section:

- removed `src/components/article-pilots/gill-context/_legacy/article-sections/07-sec-coffee-house.html`;
- added `src/components/article-pilots/gill-context/GillContextSectionCoffeeHouse.astro`.

Phase G8 promoted the sixth visible section:

- removed `src/components/article-pilots/gill-context/_legacy/article-sections/06-sec-salters-hall.html`;
- added `src/components/article-pilots/gill-context/GillContextSectionSaltersHall.astro`.

Phase G9 promoted the seventh visible section:

- removed `src/components/article-pilots/gill-context/_legacy/article-sections/03-sec-great-ejection.html`;
- added `src/components/article-pilots/gill-context/GillContextSectionGreatEjection.astro`.

Phase G10 promoted the eighth visible section:

- removed `src/components/article-pilots/gill-context/_legacy/article-sections/08-sec-southwark.html`;
- added `src/components/article-pilots/gill-context/GillContextSectionSouthwark.astro`.

Phase G11 promoted the ninth visible section:

- removed `src/components/article-pilots/gill-context/_legacy/article-sections/01-sec-from-puritans-to-baptists.html`;
- added `src/components/article-pilots/gill-context/GillContextSectionFromPuritansToBaptists.astro`.

Phase G12 promoted the tenth visible section:

- removed `src/components/article-pilots/gill-context/_legacy/article-sections/04-sec-clarendon.html`;
- added `src/components/article-pilots/gill-context/GillContextSectionClarendon.astro`.

Phase G13 promoted the summary/intro block:

- removed `src/components/article-pilots/gill-context/_legacy/article-sections/00-summary-and-intro.html`;
- added `src/components/article-pilots/gill-context/GillContextSectionSummaryIntro.astro`.

Phase G14 completed article-body promotion:

- removed final raw fragment `src/components/article-pilots/gill-context/_legacy/article-sections/11-sec-sources-and-series-tail.html`;
- removed the now-empty `_legacy/article-sections/` directory;
- added `src/components/article-pilots/gill-context/GillContextSectionSourcesAndSeriesTail.astro`;
- `GillContextArticleBody.astro` now renders all 12 article-body sections as Astro components in original order.

Phase G15 promoted the header/hero seam:

- removed `src/components/article-pilots/gill-context/_legacy/header-hero.html`;
- `GillContextHeaderHero.astro` now directly owns the GBS2 hero figure and article header markup.

Phase G16 promoted the post-article seam:

- removed `src/components/article-pilots/gill-context/_legacy/post-article.html`;
- `GillContextPostArticle.astro` now directly owns the `article-end-sdg-wrap` markup.

The components preserve the existing GBS2 visual world and article content. This is intentionally **not** an MDX activation.

---

## Guard added and expanded

New script:

```bash
npm run gill:context:visual-parity:audit
```

It verifies:

- the route no longer transports `bodyHtml` verbatim;
- the page uses Gill-specific Astro seams;
- generic `BaseLayout` / `ArticleLayout` / `SeriesArticleLayout` are not used;
- GBS2 markers remain present (`gbs2-rail`, `gbs2-hero`, `gbs2-sheet`, etc.);
- the article-body monolith is absent;
- there is no raw article section directory left;
- all 12 article-body sections are promoted Astro components;
- all old raw fragments `00` through `11` are absent;
- reconstructed body matches legacy body after whitespace normalization;
- word count and H2 count are unchanged;
- forbidden generic/legacy-regression markers are absent.

The guard is wired into `validate:static-publication` immediately after the existing articles visual-parity audit.

---

## Verification

Passed locally:

```bash
npm run gill:context:visual-parity:audit
npm run strangler:build:production-like
node scripts/visual-parity-screenshots.js --routes /articles/dzhon-gill-istoricheskiy-kontekst/ --threshold 0.5
```

Pixel parity result:

```txt
desktop: 0.000%
mobile:  0.000%
```

---

## Why this is intentionally conservative

Gill is high-risk because:

1. the trilogy previously suffered a major content deletion incident;
2. Gill pages use the GBS2 series world, not a plain article shell;
3. there are owner locks around images, captions, progress, mobile sheet, and footnote semantics;
4. direct MDX rendering would flatten the premium visual structure.

Therefore G1/G2/G3 change architecture only, not content.

---

## Next safe steps

1. Promote `GillContextHeaderHero` from raw HTML to hand-authored Astro while preserving exact DOM/classes.
2. Continue promoting one article-body section at a time with `gill:context:visual-parity:audit` + pixel parity.
3. Prefer the remaining low-risk sections before table/image-heavy sections.
4. Only after section-level parity is proven, consider syncing approved enrichment drafts from:
   - `research/GILL_HISTORICAL_CONTEXT_SOURCE_PACK_2026-06-21.md`
   - `research/GILL_CONTEXT_AND_SPRAVOCHNIK_DRAFT_INSERTS_2026-06-21.md`

Do **not** activate MDX wholesale and do **not** route through generic Astro article layouts.
