# Astro 7 and native Sätteri migration

**Status:** historical dependency-migration snapshot
**Authority:** provenance-only; current versions come from `package.json` / `package-lock.json`

This document records the package/compiler state at the Astro 7 migration acceptance point. Labels such as “package set”, exact versions and the acceptance gate below are historical evidence, not a second current dependency SSOT. Any still-relevant compatibility prohibition must be enforced by current source/contracts rather than inferred from this snapshot alone.

## Package set at migration completion

- Astro `7.1.6` on Node `22.23.1` and npm `10.9.8`.
- `@astrojs/mdx` `7.0.5`, `@astrojs/react` `6.0.2`, `@astrojs/rss` `4.0.19`, `@astrojs/sitemap` `3.7.3`, and `@astrojs/check` `0.9.10`.
- Astro's bundled `@astrojs/markdown-satteri` `0.3.5` remains the native Markdown pipeline at this migration snapshot.
- Astro 7's default JSX whitespace behavior remained enabled at this migration snapshot.

## Migration compatibility constraints

At this migration acceptance point the lane intentionally carried:

- no direct `@astrojs/markdown-remark` dependency;
- no `unified()` processor;
- no `markdown.processor` override;
- no `compressHTML: true` rollback;
- no visual-baseline rewrite used to conceal rendering changes.

These bullets document the accepted migration shape. Recheck current source/tests before treating any of them as an ongoing prohibition.

## Compiler-proven template repairs

Astro 7's production compiler exposed five pre-existing markup defects. The migration carried only the corresponding minimal repairs:

1. remove one unmatched closing `</div>` in `AntisovetovBody.astro`;
2. balance the transliteration emphasis element in `SerdceIDuhBody.astro`;
3. correct the crossed `<main>` / hero `<section>` nesting in `NagornayaSeriyaBody.astro`;
4. move the explanatory comment outside the conditional JSX expression in `SingleArticleCluster.astro`;
5. close each FAQ icon `<span>` inside its owning `<button>` in `KodDaVinchiSectionFaq.astro`.

No other legacy component changes were carried forward by that migration without a concrete compiler failure.

## Migration acceptance evidence

At the migration acceptance point, `npm run astro:7:satteri:contract` verified exact declarations and lockfile resolutions, installed package versions, Astro's bundled Sätteri dependency, the live native processor API, the absence of compatibility overrides, and fail-closed wiring through `astro:check` and `astro:build`.

The migration was accepted only after Astro type/template checks, production build, Markdown/MDX structure and content parity, URL contracts, Pagefind/service-worker readiness, browser interactions, route registry, print, and visual parity passed on one unchanged exact head.

For present-day dependency/toolchain truth, use the current package/lockfile and current CI contracts rather than the versions recorded above.
