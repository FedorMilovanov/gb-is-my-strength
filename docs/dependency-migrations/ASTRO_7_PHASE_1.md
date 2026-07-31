# Astro 7 phase-one migration

This lane upgrades Astro as one compatible package set instead of
merging the incomplete single-package Dependabot bump.

## Pinned set

- Astro 7.1.6
- MDX integration 7.0.5
- React integration 6.0.2
- Astro Check 0.9.10
- RSS 4.0.19
- Sitemap 3.7.3
- Unified Markdown processor 7.2.2

## Safety boundaries

1. `compressHTML: true` preserves Astro 6 inline whitespace.
2. `unified()` preserves the proven Markdown and MDX processor.
3. Sätteri and JSX whitespace are deferred to separate measured PRs.
4. `npm run astro7:migration:guard` prevents dependency/config drift.
5. Screenshot baselines must not be rewritten merely to make this green.

## Required merge evidence

- clean `npm ci` on Node 22.12 and npm 10.9.0;
- Astro check and production build;
- strict content and MDX parity;
- URL, Pagefind, JSON-LD and service-worker contracts;
- production visual parity and browser smoke;
- complete publication gate.
