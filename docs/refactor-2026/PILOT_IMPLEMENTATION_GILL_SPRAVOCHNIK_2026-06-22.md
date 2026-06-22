# Gill spravochnik pilot implementation — 2026-06-22

**Route:** `/articles/dzhon-gill-spravochnik/`
**Status:** Phase GS4 complete in source layer — componentized shadow-breakout + article-body section seams + two promoted Astro sections, no content/visual change intended.
**Gill route progress:** 2 of 5 Gill pages have a componentized Astro shell (`40%`); 1 of 5 Gill pages is fully componentized (`20%`).

---

## What changed

The route moved from pure full-body shadow transport:

```astro
const { headHtml, bodyHtml, bodyAttributes } = loadLegacyFullDocument(...)
<Fragment set:html={bodyHtml} />
```

to Gill-specific componentized shadow-breakout:

```astro
<Fragment set:html={segBefore} />
<GillSpravochnikMainShell />
<Fragment set:html={segAfter} />
```

New source seams:

- `src/components/article-pilots/gill-spravochnik/GillSpravochnikMainShell.astro`
- `src/components/article-pilots/gill-spravochnik/GillSpravochnikHeaderHero.astro`
- `src/components/article-pilots/gill-spravochnik/GillSpravochnikArticleBody.astro`
- `src/components/article-pilots/gill-spravochnik/GillSpravochnikPostArticle.astro`
- `src/components/article-pilots/gill-spravochnik/_legacy/body-segment-0.html`
- `src/components/article-pilots/gill-spravochnik/_legacy/body-segment-1.html`
- `src/components/article-pilots/gill-spravochnik/_legacy/header-hero.html`
- `src/components/article-pilots/gill-spravochnik/_legacy/article-body.html`
- `src/components/article-pilots/gill-spravochnik/_legacy/post-article.html`

Phase GS2 retired the article-body monolith:

- removed `src/components/article-pilots/gill-spravochnik/_legacy/article-body.html`;
- `GillSpravochnikArticleBody.astro` now owns `<article class="article-body">`;
- body content is rendered from 11 ordered fragments under `src/components/article-pilots/gill-spravochnik/_legacy/article-sections/`:
  - `00-summary.html`
  - `01-sec-prdl.html`
  - `02-sec-timeline.html`
  - `03-sec-works.html`
  - `04-sec-body-structure.html`
  - `05-sec-network.html`
  - `06-sec-disputes.html`
  - `07-sec-terms.html`
  - `08-sec-links.html`
  - `09-sec-sources.html`
  - `10-sec-quiz-tail.html`

Phase GS3 promoted the first compact body section:

- removed `src/components/article-pilots/gill-spravochnik/_legacy/article-sections/08-sec-links.html`;
- added `src/components/article-pilots/gill-spravochnik/GillSpravochnikSectionLinks.astro`.

Phase GS4 promoted the second compact body section:

- removed `src/components/article-pilots/gill-spravochnik/_legacy/article-sections/01-sec-prdl.html`;
- added `src/components/article-pilots/gill-spravochnik/GillSpravochnikSectionPrdl.astro`;
- `GillSpravochnikArticleBody.astro` now renders 9 raw fragments + 2 Astro sections in the original order.

This preserves the existing GBS2 visual world and article content. It is intentionally **not** an MDX activation.

---

## Guard added

New script:

```bash
npm run gill:spravochnik:visual-parity:audit
```

It verifies:

- the route no longer transports `bodyHtml` verbatim;
- the page uses Gill-specific Astro seams;
- generic `BaseLayout` / `ArticleLayout` / `SeriesArticleLayout` are not used;
- GBS2 markers remain present (`gbs2-rail`, `gbs2-hero`, `gbs2-sheet`, etc.);
- the article-body monolith is absent;
- exactly 11 ordered article section fragments remain;
- reconstructed body matches legacy body after whitespace normalization;
- word count and H2 count are unchanged;
- forbidden generic/legacy-regression markers are absent.

The guard is wired into `validate:static-publication` immediately after `gill:context:visual-parity:audit`.

---

## Next safe steps

1. Split `GillSpravochnikArticleBody` into ordered section seams.
2. Promote one compact section at a time to Astro.
3. Keep the same gates as Gill context: route guard + pixel parity.
4. Avoid content enrichment until structure parity is stable.
