# Lawson branch cleanup disposition — 2026-10-12

**Status:** deletion-authority record; remote cleanup pending at this commit.  
**Mode:** SYSTEM.  
**Owner:** FedorMilovanov; execution lane `arena/a14f49e3-gb-is-my-strength`.  
**Bounded scope:** only the eight remote branches named below. Map work and issue #2180 are outside scope.  
**Base / rollback SHA:** `c3f2f754c867707741bd3f17fe791b5963e1eded` (`main`).  
**Authority:** current `main`, exact branch heads, GitHub PR history, `docs/BRANCH_LIFECYCLE_V4.md`, and the owner's explicit cleanup instruction.

## Pre-cleanup inventory

The read-only `scripts/branch-hygiene-report.py` inventory at
`2026-10-12T08:40:29Z` found 56 non-default branches and exactly eight whose
names contain `lawson`. The generic report is only a review queue; every row was
reclassified below from actual content before deletion was authorized.

| Branch | Exact head | Main-only / branch-only | PR | Final disposition | Replacement or rejection evidence |
|---|---|---:|---:|---|---|
| `audit/lawson-evidence-hardening-2026-10-05` | `05a4549142cf5047138142ea2cd9ce79d55eb13a` | 81 / 0 | — | `FULLY_REPRESENTED_BY_ANCESTRY` | Head is an exact ancestor of `main`; it is merge commit #2163. |
| `audit/lawson-theme-editorial-hardening` | `d771902aac67aff7689eb696c21ddf2f7a33bcb2` | 80 / 1 | — | `DIAGNOSTIC_DISPOSABLE` | Sole delta is a 211-line temporary `contents: write` workflow. Run `37247491724` failed without jobs/logs and produced no product commit. Accepted theme/editorial work arrived through #2170 and later Lawson PRs. |
| `content/lawson-editorial-cover-20261001` | `870beb89845dd0ebd032270d75a1d20e77112fa8` | 87 / 7 | #2154 closed | `SUPERSEDED_VERIFIED` | #2154 records all five changed files as transferred and advanced in #2155; replacement merge is `69d3aa13361063a6aaa6272553c4874866829fa0`. |
| `fix/lawson-premium-polish-20260930` | `46eb698f44ffe75bca408f74c1d9c05f2c282e11` | 90 / 2 | — | `SUPERSEDED_VERIFIED` | Its inline-popover intent is superseded by `2c7712090`; current markup avoids invalid repeated source IDs and adds explicit open/close, Escape, focus return, viewport placement, and mobile bounds. Its TOC/evidence-legend intent is represented by the current 26-entry TOC and bibliography taxonomy (`9a97ec348`, `827cd8c25`). |
| `publication/lawson-catalog-projection-20261012` | `8fa3492b24388d5651211ddf30330d8cb73ae5fd` | 1 / 3 | #2177 closed | `SUPERSEDED_VERIFIED` | Owner rejected the fallback after current-authority review: 52/52 production-owned `/articles/` routes are already in the manifest; component fallback adds zero eligible routes and creates a second metadata path. Decision merged in #2178 at `c3f2f754c`. |
| `publication/lawson-release-hardening-20260930` | `acb25c61b222d7c8b4f632d97a5cb8cad2c939d4` | 87 / 2 | #2150 closed | `SUPERSEDED_VERIFIED` | Its only authored product delta is the older catalog fallback. #2150 was first replaced by #2177 and then explicitly closed as unnecessary; final decision is #2178 / `c3f2f754c`. |
| `publication/steven-lawson-final-20260930-tmp` | `f7d617d0c8b864e79475f7545c842c5f6c3b93f4` | 105 / 0 | — | `FULLY_REPRESENTED_BY_ANCESTRY` | Exact head is an ancestor of `main`; the two `steven-lawson-final` refs are identical. |
| `publication/steven-lawson-final-20260930` | `f7d617d0c8b864e79475f7545c842c5f6c3b93f4` | 105 / 0 | #2147 closed | `FULLY_REPRESENTED_BY_ANCESTRY` | Exact publication history was carried into merged #2148; the head itself is an ancestor of `main`. |

`Main-only / branch-only` is `git rev-list --left-right --count main...branch`
after unshallowing history and fetching each exact head. `git cherry` was also
checked for diverged branches; patch identity alone was not used as deletion
authority because later accepted implementations evolved the same files.

## Unique-material review

### Publication and cover lines

The two `steven-lawson-final` refs and the evidence-hardening ref contain no
branch-only commits. The #2154 description and closing comments explicitly name
its five files and the #2155 salvage commit; the owner-supplied 1200×630 WebP is
present on current `main` and loaded successfully in the browser witness.
Therefore these branches are not evidence archives and need no selective
recovery.

### Premium-polish line

The old two-commit lane changed only `LawsonSourceRef.astro` and the article MDX.
Its useful intent is represented by a later, stricter implementation:

- source references remain phrasing content inside paragraphs;
- 272 trigger instances render with no duplicate IDs or empty paragraphs;
- Enter opens, Escape closes, and focus returns to the trigger;
- the card remains inside both desktop and mobile viewports;
- the current 26-item TOC resolves the current article structure;
- the bibliography explains all three evidence classes and each conclusion boundary.

The old generated `aria-describedby` ID was based only on source ID, although
sources repeat in the article, so recovering that exact implementation would
reintroduce duplicate DOM IDs. The removed `trust-time` and `church-lesson`
labels target an older article structure; their current semantic successor is
the accepted `#pastoral` section and current TOC. No selective recovery is
justified.

### Temporary writer workflow

The theme-hardening branch contains no applied content, CSS, or runtime patch—
only a self-writing temporary workflow. Its proposed broad theme click handler
would compete with current reader-preference/control owners. Current Lawson CSS
already consumes shared semantic theme tokens, and the accepted page is dark-
theme coherent. Preserving or merging the writer would violate the requirement
that temporary branch writers not survive their lane.

### Catalog fallback lines

A current-source recount reproduced the owner decision:

- 52 production-owned routes below `/articles/`;
- 52/52 represented in `data/search-manifest.json`; missing = 0;
- Lawson is `production-dist`, is present in the manifest, and has explicit
  `index/pagefind/searchManifest/sitemap/rss = include` policy.

The #2150/#2177 code is therefore intentionally rejected rather than lost.

## Verification before remote mutation

- Clean baseline at `c3f2f754c`: `npm ci` succeeded (488 packages); npm reported
  7 existing dependency advisories (2 moderate, 5 high), not changed in this lane.
- `npm run ci:check`: exit 0; static publication and workflow policy passed.
- `npm run strangler:build:production-like`: exit 0; Astro check = 0 errors,
  0 warnings, 6 existing hints; 104 pages built; guards G-1…G-8 passed.
- Chromium 153 local production-like witness, explicit dark color scheme and
  reduced motion:
  - desktop 1440×1000 and mobile 390×844 (`isMobile=true`, touch enabled);
  - HTTP/console/page errors/bad responses/failed requests: 0/0/0/0/0;
  - axe WCAG 2 A/AA violations: 0 in both contexts;
  - horizontal overflow, broken/pending images, duplicate IDs, empty paragraphs: 0;
  - fonts loaded; owner cover 1200×630 loaded; source card in viewport;
  - LCP: 480 ms desktop / 340 ms mobile; CLS: 0.000174 / 0;
  - screenshots and JSON are in gitignored `reports/lawson-branch-cleanup-browser/`.
- `git diff --check` and tracked working-tree status were clean before this record.

## Authorized cleanup transaction

The owner's current instruction authorizes deletion after the content review.
Deletion must use the exact heads above, in two small batches:

1. ancestry batch: the evidence-hardening branch and both identical final-publication refs;
2. verified-disposition batch: temporary writer, #2154, premium polish, #2150, and #2177.

Before each deletion, the live remote SHA must still equal this record. After
each batch, rerun the Lawson ref inventory. Any mismatch stops the transaction.
This document will receive the exact deletion receipts and post-cleanup count in
a follow-up commit; no PR is to be merged or closed by this session.
