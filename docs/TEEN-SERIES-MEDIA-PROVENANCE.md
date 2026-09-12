# Teen series — publication media provenance

Status: **ROUTE-SPECIFIC PRODUCTION FAMILY / APPROVED 2026-09-12**

This record owns the production image family for «Подросток за кадром». The former
`series-hero.svg` / `series-hero.webp` pair is superseded and must not be used by
landing, article, rail, search, sitemap, OG or structured-data projections.

## Provenance and rights boundary

- Creation provenance: synthetic editorial illustrations generated specifically for this project through OpenAI image generation during the 2026-09-12 editorial session.
- Source dependency: no stock photograph, private chat screenshot, downloaded third-party image or identifiable real case file is used as the image source.
- Editorial status: synthetic/conceptual illustration, never documentary evidence of an actual family, child, church member or pastoral case.
- Publication approval: selected by the project owner for editorial use on gospod-bog.ru.
- Sensitive-subject guard: images contain no sexual content, intimate media, readable private messages, violence or exploitative depiction.
- Confessional guard: visual language is Russian Protestant/Baptist; Orthodox icons, icon corners, liturgical vestments and church-domed shorthand are excluded.
- Text-in-image: none.

## Production derivative contract

Only WebP derivatives are admitted to `public/images/teen-series/` for this family.

- Hero / OG: **1200 × 630**, route-specific, target ceiling **128 KiB**.
- Card / rail: **600 × 315**, route-specific, target ceiling **48 KiB**.
- Generated PNG/JPEG source renders are deliberately **not committed**.
- HTML owns titles and captions; images contain no baked-in article titles.

## Asset map

| Surface | Hero / OG | Card / rail | Editorial meaning |
| --- | --- | --- | --- |
| Series landing | `series-cover.webp` | `series-cover-600w.webp` | phone between cold private space and warm family space |
| I — Double life | `01-double-life.webp` | `01-double-life-600w.webp` | young person, phone and rain-window reflection; divided identity |
| II — After disclosure | `02-after-disclosure.webp` | `02-after-disclosure-600w.webp` | parents after a difficult disclosure; Bible, phone and empty space |
| III — Church response | `03-church-response.webp` | `03-church-response-600w.webp` | rear benches, pastoral presence and the illuminated pulpit/Word |
| A — Left home | `04-left-home.webp` | `04-left-home-600w.webp` | departure across a wet Russian courtyard; open possibility of return |
| B — Home and money | `05-home-money.webp` | `05-home-money-600w.webp` | keys, phone and financial/household responsibility in the entryway |
| C — Adult authority | `06-adult-authority.webp` | `06-adult-authority-600w.webp` | transfer of a house key; changed jurisdiction and continuing relationship |
| D — Daughter and marriage | `07-daughter-marriage.webp` | `07-daughter-marriage-600w.webp` | adult daughter and father speaking at a Russian apartment threshold |

## Canonical media owner

`src/components/article-pilots/_shared/series/teenSeriesMedia.ts` is the single
runtime media authority. It owns hero path, rail/card path and alt text for the
landing and every route. Article wrapper, landing cards and series rail consume
that authority instead of repeating literal paths.

Canonical MDX frontmatter still carries each route-specific `ogImage` so
discovery/indexing pipelines that project directly from content metadata remain
aligned with the runtime owner.
