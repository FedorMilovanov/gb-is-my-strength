# «Баптисты России» — total audit, 2026-09-11

**Product baseline:** `873a50074e1e1660b944051bafba2dc81353cc10`  
**Scope:** Product repo, Research repo, connected Google Drive, AuditRepo, rescue branches.  
**Status:** operational audit; not publication copy.

## Executive verdict

Current public series is stable, but the expanded book is not finished.

- Public edition: 9 reader-facing articles, grouped as 4 chapters plus series/reference surfaces.
- Expanded internal architecture: 5 parts / 20 chapters.
- Reader texts are substantial and do not contain working TODO/FIXME/HOLD markers.
- Expanded-book research is strong but much of Chapter 6–17 and 20 is still unmerged.
- Historical visual/facsimile layer is the largest production gap.
- Chapter 1 Product authority is stale relative to the separate Research repository.

Project state:

`PUBLIC CURRENT EDITION STABLE / EXPANDED BOOK RESEARCH STRONG BUT PARTLY UNMERGED / HISTORICAL MEDIA NOT PRODUCTION-COMPLETE`.

## Unmerged expanded-book rescue corpus

Pure research Markdown rescue branches:

- `reconcile/ch06-kargel-research-20260911` — 9 unique files;
- `reconcile/ch07-mazaev-prokhanov-research-20260911` — 4;
- `reconcile/ch08-print-republic-research-20260911` — 4;
- `reconcile/ch09-fetler-house-gospel-research-20260911` — 4;
- `reconcile/ch10-1917-1921-research-20260911` — 4;
- `reconcile/ch11-famine-international-brotherhood-research-20260911` — 5;
- `reconcile/ch12-school-bible-failed-unity-research-20260911` — 5;
- `reconcile/ch13-conscience-army-state-research-20260911` — 4;
- `reconcile/ch14-1929-law-church-life-research-20260911` — 4;
- `reconcile/ch15-1930s-unions-great-terror-research-20260911` — 4;
- `reconcile/ch16-war-1944-union-research-20260911` — 3;
- `reconcile/ch17-vsehb-1945-1959-research-20260911` — 4;
- `reconcile/ch20-international-1991-memory-research-20260911` — 11.

Chapter 17 is already represented by PR #1962.

Chapter 18 and Chapter 19 are not missing hidden lanes: they map to the already reconciled «Инициативная группа» and «Подпольная печать» packages.

Readiness remains fail-closed: research/drafting readiness is not BOOK-READY or route readiness.

## Chapter 1 authority reconciliation

Old Product pre-1867 dossiers are cautious but stale.

Newer Research authority records:

- Sinichkin/Voronin article: 14 pages, SHA `3d33eb3691dd18f0109028cf1c2c51bb71e21b882dfddfff4393438311498c1c`;
- Voronin biography dossier: 5 pages, SHA `6d23e500ef19dc457d2f23c06b695ea95e2670759558e0419847022ccc969cc9`;
- both have historical acquisition receipts and text layers;
- current authority still says `VISUAL_PENDING / NOT_QUOTE_READY`.

Research also adds the Voronin→Mazaev 1889 letter route, Kallistov 1879 external control, the V. V. Ivanov manuscript route, and the 1905 `Краткая записка` four-stream self-description.

Current connected Drive recheck on 2026-09-11:

- 2 canonical IDs: 2/2 return 404;
- 2 recorded raw duplicate IDs: 2/2 return 404.

Therefore historical acquisition receipts remain valid evidence, but current binary availability is an ACCESS HOLD.

Prepared Product reconciliation:

`reconcile/ch01-pre-baptist-origins-research-20260911`.

## Research repo

`FedorMilovanov/Research` has no open Baptist PR queue; its Baptist authority is already on `main`.

Research contains newer acquisition/proof state than some Product research files. Product reconciliation must therefore prefer current Research authority over older Product OPEN notes when the two differ.

## Media / Google Drive

MASTER has a large curated visual shortlist. Targeted queries found many `Article ready=YES` candidates, including dozens for Kargel, Mazaev, Prokhanov and Fetler.

The blocker is not candidate selection.

Six recurring old Source HTML/export container IDs referenced by MASTER were direct-checked and all returned 404 in the current Drive context.

Broad Drive search did not find a replacement Telegram/ChatExport/messages.html container.

Conclusion:

> MASTER is a strong catalog/provenance inventory but currently cannot be treated as a complete accessible byte store.

Recovery should target source-container re-export/re-share or archive restoration instead of rediscovering photos one by one.

## Public visual state

Repository/body census:

- decorative cover assets exist for the series;
- only one historical facsimile row is currently `PUBLISHED / VERIFIED` in the media ledger;
- 8 of 9 public articles have no embedded historical photo/facsimile in the article body;
- «Советская ночь» is the exception with an evidence/facsimile component.

Historical visual production is therefore not complete.

## Security debt

Current Baptist PageHead census found seven remaining inert `X-Content-Type-Options` meta pragmas:

- series landing;
- Noch na Kure;
- Petersburg line;
- Underground Press;
- Soviet Night;
- Spravochnik;
- South Shtunda.

Prepared bounded cleanup:

`fix/baptisty-retire-transport-meta-batch2-20260911`.

## Accessibility debt

Old AuditRepo contrast findings were rechecked against current source.

Already obsolete:
- article-card kicker/abstract contrast now passes AA on white cards.

Still current:
- muted Samizdat metadata on newspaper-paper surfaces;
- mobile fallback controls can inherit pale rail text on a near-white pill.

Prepared bounded one-file candidate:

`fix/baptisty-samizdat-contrast-20260911`.

## Stale status artifact

`lane/baptisty-book-production-status-20260906` contains unique
`84-book-production-status-and-marathon-plan-2026-09-06.md`.

It is valuable historical planning provenance, but must not be merged verbatim as current truth because its PR/state table predates later reconciliation work.

## Already-accounted-for old lanes

Not unfinished anymore:

- Petersburg deepening → successor #1953 merged;
- Spravochnik evidence-language → successor #1767 merged;
- prior Baptist transport-meta batch #1941 merged for its declared subset;
- old #1792–1794 research lanes superseded by current-main reconciliation.

## CI/release improvements already landed

- active Pages promotion is no longer cancelled by later pushes;
- IndexNow baseline was hardened against stale `HEAD~1` assumptions;
- Visual/Dateline/Glossary render-heavy workflows exclude `baptisty-rossii/research/**`.

Live proof: Chapter 17 research-only PR runs only lightweight generic guards.

## Priority

1. Finish active current-main owner lanes without avoidable stale-base churn.
2. Merge Chapter 17.
3. Serially admit Chapter 6–16 and 20 research packages.
4. Admit Chapter 1 authority reconciliation.
5. Replace stale production-status truth.
6. Merge Baptist security batch 2.
7. Merge Samizdat contrast fix after browser/visual validation.
8. Recover media source containers and re-register accessible binary receipts.
9. Build governed chapter-specific visual ledgers.
10. Only then add expanded-book public routes.
