# Gill context pilot implementation — 2026-06-22

**Route:** `/articles/dzhon-gill-istoricheskiy-kontekst/`  
**Status:** Phase G1 complete in source layer — componentized shadow-breakout, no content/visual change intended.  
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

New source seams:

- `src/components/article-pilots/gill-context/GillContextMainShell.astro`
- `src/components/article-pilots/gill-context/GillContextHeaderHero.astro`
- `src/components/article-pilots/gill-context/GillContextArticleBody.astro`
- `src/components/article-pilots/gill-context/GillContextPostArticle.astro`
- `src/components/article-pilots/gill-context/_legacy/body-segment-0.html`
- `src/components/article-pilots/gill-context/_legacy/body-segment-1.html`
- `src/components/article-pilots/gill-context/_legacy/header-hero.html`
- `src/components/article-pilots/gill-context/_legacy/article-body.html`
- `src/components/article-pilots/gill-context/_legacy/post-article.html`

The fragments preserve the existing GBS2 visual world and article content. This is intentionally **not** an MDX activation.

---

## Guard added

New script:

```bash
npm run gill:context:visual-parity:audit
```

It verifies:

- the route no longer transports `bodyHtml` verbatim;
- the page uses Gill-specific Astro seams;
- generic `BaseLayout` / `ArticleLayout` / `SeriesArticleLayout` are not used;
- GBS2 markers remain present (`gbs2-rail`, `gbs2-hero`, `gbs2-sheet`, etc.);
- reconstructed body matches legacy body after whitespace normalization;
- word count and H2 count are unchanged;
- forbidden generic/legacy-regression markers are absent.

The guard is wired into `validate:static-publication` immediately after the existing articles visual-parity audit.

---

## Why this is intentionally conservative

Gill is high-risk because:

1. the trilogy previously suffered a major content deletion incident;
2. Gill pages use the GBS2 series world, not a plain article shell;
3. there are owner locks around images, captions, progress, mobile sheet, and footnote semantics;
4. direct MDX rendering would flatten the premium visual structure.

Therefore Phase G1 changes architecture only, not content.

---

## Next safe steps

1. Promote `GillContextHeaderHero` from raw HTML to hand-authored Astro while preserving exact DOM/classes.
2. Split `GillContextArticleBody` into ordered section seams by H2.
3. Promote one small body section at a time, starting with a low-risk non-interactive section.
4. Only after section-level parity is proven, consider syncing approved enrichment drafts from:
   - `research/GILL_HISTORICAL_CONTEXT_SOURCE_PACK_2026-06-21.md`
   - `research/GILL_CONTEXT_AND_SPRAVOCHNIK_DRAFT_INSERTS_2026-06-21.md`

Do **not** activate MDX wholesale and do **not** route through generic Astro article layouts.
