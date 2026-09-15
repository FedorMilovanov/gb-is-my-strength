# Pastor-series integration receipt — 2026-09-15

```
INTEGRATION_BASE              = main@d4d1852e3dc412b0db256287cdd7f2e5918a4fc6
DOSSIER_COMPOSITION           = integration/diotrophes-composition-20260915@d8f33ecc2589208f175cbd286b852218d3b384a2 (PR #2068)
PASTOR_PRODUCT_DONOR          = arena/01a0a1b2-gb-is-my-strength@b51452e7e6f5dcfe2225623750a926499c7e83b1
GOVERNANCE_DONOR              = arena/01a0a1b4-gb-is-my-strength@b8c7f2c07bb5c88a3936cd5b03635d807727a7ed (PR #2058)
READER_RUNTIME_DONOR          = arena/01a0a1ce-gb-is-my-strength@0a1748d2717ee6f8a7fd45c64917216aab742350 (separate follow-up lane)
PUBLICATION_PROMOTION         = APPROVED (existing owner decision)
PRODUCT_COMPOSITION           = APPLIED
EXACT_BLOB_RE_CLEARANCE       = PASS (bounded review, exact blobs)
FORMAL_JURISDICTION_RECHECK   = PASS WITH NON-LEGAL BOUNDARY
```

## 1. Purpose

Этот документ фиксирует композицию трёх независимых агентских lanes без объявления одного из них «победителем». Product/source state берётся из b2, governance fail-closed дисциплина — из b4, reader-runtime/performance — остаётся отдельным последующим PR из ce.

## 2. Transaction boundaries

- Dossier A вынесен в отдельный single-file PR #2068, чтобы не обходить Wave-10 bounded-diff ownership.
- Pastor core не импортирует старые generated snapshots `editorial-metadata.json`, `search-manifest.json`, `links-graph.json`, RSS/sitemap и cross-lane Nagornaya/teen projections. Они должны быть заново получены штатными генераторами на resulting tree.
- `DiotrophesDraft.astro` не входит в pastor-core diff.
- Исторические audit artifacts не смешиваются с production source PR.

## 3. Final II–IX manuscript blob identities in the composed product source

| Part | Manuscript | Git blob |
|---|---|---|
| II | `anatomiya-padeniya-pyat-stadiy.mdx` | `49ecc5d34b92eb11600dc22c230212f189b3382b` |
| III | `teksty-pisaniya-kotorymi-manipuliruyut.mdx` | `8bb2d84ebd7c1c46f856e36c8deb5a2ea9be299d` |
| IV | `sem-tipov-razlichenie-uchiteley.mdx` | `f9dc36e2cc057fcd9bb0319aa2b78a98f1de31f9` |
| V | `cerkovnaya-disciplina-vlast-granicy-zashchita.mdx` | `f04daa0ff05b235ae4c55df3a360748ae3317c90` |
| VI | `kogda-uhodit-kogda-ostavatsya.mdx` | `73893c5505802ed79917efc39e54c156353d1469` |
| VII | `vernye-i-neizvestnye-zdorovoe-pastyrstvo.mdx` | `764c0e975e229a008b9dee6ad946c3b1ef4fefa5` |
| VIII | `priznaki-zdorovoy-cerkvi.mdx` | `037695be17e315427bdd730377c9c7dcea395e60` |
| IX | `nesovershennyy-chelovek-v-nesovershennoy-cerkvi.mdx` | `eb428aae84c5f6a7ed5ff12ae964ea17f70c6084` |

Эта таблица пинит exact identities, переаттестованные отдельным bounded review в `RE-CLEARANCE-II-IX-2026-09-15.md`.

## 4. Semantic ownership decisions

- `PastorSeriesArticlePage.astro`: b2 theme/product semantics + b4 `AboutAccuracyBlock`; удаление `home.css` остаётся reader-runtime lane ce.
- `pastorSeriesConfig.ts`: b2 является semantic owner (157/15, full partToc + summaries, per-part covers).
- `CONTENT-CLEARANCE-II-IX.md`: сохраняется b4 warning о нарушенной blob identity и обязательном bounded re-clearance.
- `MASTER-PLAN.md`: публикационные факты b2 сохраняются, но product-level audit явно отделён от formal exact-blob clearance.
- Derived metadata/cache/service-worker revisions не копируются как stale snapshots.

## 5. Merge criteria

Pastor-core не считается готовым к main до одновременного выполнения:

1. PR #2068 merged или является exact stacked base;
2. штатная regeneration derived metadata/search/feed/sitemap на resulting tree;
3. production-like build + pastor-series visual parity + G-1..G-8;
4. усиленный G-6 подтверждает visible Dossier byline = registry companion time;
5. [x] bounded re-clearance exact blobs II–IX — `RE-CLEARANCE-II-IX-2026-09-15.md`;
6. [x] formal jurisdiction/safeguarding recheck на тех же blob identities — PASS WITH NON-LEGAL BOUNDARY;
7. exact-head GitHub CI green.
