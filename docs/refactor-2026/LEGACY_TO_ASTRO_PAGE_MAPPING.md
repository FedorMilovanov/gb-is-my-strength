# LEGACY_TO_ASTRO_PAGE_MAPPING.md — карта переноса страниц

Дата: 2026-06-12

Источник: `reports/url-contract-draft.json`

## Mapping

| Legacy file | URL | Type | Future Astro route | Content source | Priority | Notes |
|---|---|---|---|---|---:|---|
| `about/index.html` | `/about/` | page | `src/pages/about/index.astro` | `src/content/pages/about.mdx or page component` | 1 | первый pilot |
| `articles/index.html` | `/articles/` | article-index | `src/pages/articles/index.astro` | `articles collection` | 3 | после первой статьи |
| `biografii/index.html` | `/biografii/` | section-index | `src/pages/biografii/index.astro` | `collections/data` | 5 | section index |
| `hard-texts/index.html` | `/hard-texts/` | section-index | `src/pages/hard-texts/index.astro` | `collections/data` | 5 | section index |
| `pastor-series/index.html` | `/pastor-series/` | section-index | `src/pages/pastor-series/index.astro` | `collections/data` | 5 | section index |
| `articles/20-antisovetov-pastoru/index.html` | `/articles/20-antisovetov-pastoru/` | article | `src/pages/articles/[slug].astro` | `src/content/articles/20-antisovetov-pastoru.mdx` | 4 | MDX migration |
| `articles/dzhon-gill-chast-1-chelovek/index.html` | `/articles/dzhon-gill-chast-1-chelovek/` | article | `src/pages/articles/[slug].astro` | `src/content/articles/dzhon-gill-chast-1-chelovek.mdx` | 4 | MDX migration |
| `articles/dzhon-gill-chast-2-uchenyi/index.html` | `/articles/dzhon-gill-chast-2-uchenyi/` | article | `src/pages/articles/[slug].astro` | `src/content/articles/dzhon-gill-chast-2-uchenyi.mdx` | 4 | MDX migration |
| `articles/dzhon-gill-chast-3-nasledie/index.html` | `/articles/dzhon-gill-chast-3-nasledie/` | article | `src/pages/articles/[slug].astro` | `src/content/articles/dzhon-gill-chast-3-nasledie.mdx` | 4 | MDX migration |
| `articles/dzhon-gill-istoricheskiy-kontekst/index.html` | `/articles/dzhon-gill-istoricheskiy-kontekst/` | article | `src/pages/articles/[slug].astro` | `src/content/articles/dzhon-gill-istoricheskiy-kontekst.mdx` | 4 | MDX migration |
| `articles/dzhon-gill-spravochnik/index.html` | `/articles/dzhon-gill-spravochnik/` | article | `src/pages/articles/[slug].astro` | `src/content/articles/dzhon-gill-spravochnik.mdx` | 4 | MDX migration |
| `articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/index.html` | `/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/` | article | `src/pages/articles/[slug].astro` | `src/content/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki.mdx` | 4 | MDX migration |
| `articles/kod-da-vinchi/index.html` | `/articles/kod-da-vinchi/` | article | `src/pages/articles/[slug].astro` | `src/content/articles/kod-da-vinchi.mdx` | 4 | MDX migration |
| `articles/krajne-li-isporcheno-serdce/index.html` | `/articles/krajne-li-isporcheno-serdce/` | article | `src/pages/articles/[slug].astro` | `src/content/articles/krajne-li-isporcheno-serdce.mdx` | 4 | MDX migration |
| `articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/index.html` | `/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/` | article | `src/pages/articles/[slug].astro` | `src/content/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy.mdx` | 4 | MDX migration |
| `nagornaya/index.html` | `/nagornaya/` | series | `src/pages/nagornaya/index.astro or dynamic series route` | `src/content/nagornaya/*.mdx + series data` | 6 | сложная серия, не первой |
| `nagornaya/chast-1/index.html` | `/nagornaya/chast-1/` | series | `src/pages/nagornaya/chast-1/index.astro or dynamic series route` | `src/content/nagornaya/*.mdx + series data` | 6 | сложная серия, не первой |
| `nagornaya/chast-2/index.html` | `/nagornaya/chast-2/` | series | `src/pages/nagornaya/chast-2/index.astro or dynamic series route` | `src/content/nagornaya/*.mdx + series data` | 6 | сложная серия, не первой |
| `nagornaya/chast-3/index.html` | `/nagornaya/chast-3/` | series | `src/pages/nagornaya/chast-3/index.astro or dynamic series route` | `src/content/nagornaya/*.mdx + series data` | 6 | сложная серия, не первой |
| `nagornaya/chast-4/index.html` | `/nagornaya/chast-4/` | series | `src/pages/nagornaya/chast-4/index.astro or dynamic series route` | `src/content/nagornaya/*.mdx + series data` | 6 | сложная серия, не первой |
| `nagornaya/chast-5/index.html` | `/nagornaya/chast-5/` | series | `src/pages/nagornaya/chast-5/index.astro or dynamic series route` | `src/content/nagornaya/*.mdx + series data` | 6 | сложная серия, не первой |
| `nagornaya/istochniki/index.html` | `/nagornaya/istochniki/` | series | `src/pages/nagornaya/istochniki/index.astro or dynamic series route` | `src/content/nagornaya/*.mdx + series data` | 6 | сложная серия, не первой |
| `nagornaya/nakhodki/index.html` | `/nagornaya/nakhodki/` | series | `src/pages/nagornaya/nakhodki/index.astro or dynamic series route` | `src/content/nagornaya/*.mdx + series data` | 6 | сложная серия, не первой |
| `nagornaya/seriya/index.html` | `/nagornaya/seriya/` | series | `src/pages/nagornaya/seriya/index.astro or dynamic series route` | `src/content/nagornaya/*.mdx + series data` | 6 | сложная серия, не первой |
| `karty/index.html` | `/karty/` | maps-index | `src/pages/karty/index.astro` | `maps manifest` | 5 | хаб карт |
| `karty/avraam/index.html` | `/karty/avraam/` | map-page | `src/pages/karty/[slug].astro` | `src/content/maps/avraam.json + MapApp` | 8 | после схемы карт |
| `map/index.html` | `/map/` | graph-map | `src/pages/map/index.astro` | `links-graph + React/SVG island` | 8 | позже |
| `index.html` | `/` | home | `src/pages/index.astro` | `layout/data` | 8 | переносить поздно |
| `404.html` | `/404.html` | system | `public/static or src/pages/404.astro` | `system file` | 0 | не MDX |
| `google7e02f9855e02b89a.html` | `/google7e02f9855e02b89a.html` | system | `public/*.html` | `system file` | 0 | не MDX |
| `yandex_42bc0d54a1ca4952.html` | `/yandex_42bc0d54a1ca4952.html` | system | `public/*.html` | `system file` | 0 | не MDX |
| `yandex_d8876d66da1b4592.html` | `/yandex_d8876d66da1b4592.html` | system | `public/*.html` | `system file` | 0 | не MDX |