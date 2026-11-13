# Teen series reconciliation notes — branch `arena/a5fb5b75-gb-is-my-strength`

Date: 2026-11-13. Surface-local evidence note. Not an authority document and not
registered in `docs/DOCUMENT_AUTHORITY.md`; it overrides nothing. Written for the
owner who has to reconcile seven parallel `arena/*` branches that all edit the
same seven teen-series articles.

Scope of this branch: substance-level verification of every mandatory Research
chain against the published reader text, plus additive prose for requirements
that were genuinely absent. HEAD at time of writing: `583eb4c`.

## 1. What this branch changed

Reader-word deltas against the merge base `9618e82`, measured on the body only
(frontmatter stripped, everything from `## Источники и сверка` stripped, tags
stripped, Cyrillic and Latin word tokens counted):

| Article | Base | This branch | Delta |
| --- | ---: | ---: | ---: |
| I `podrostok-za-kadrom-dvoynaya-zhizn` | 4012 | 4266 | +254 |
| II `podrostok-za-kadrom-roditelyam-posle-razoblacheniya` | 5776 | 7368 | +1592 |
| III `podrostok-za-kadrom-chto-delat-tserkvi` | 4596 | 4969 | +373 |
| A `vzroslyy-rebenok-ushel-kontakt-pokayanie-vozvrashchenie` | 4496 | 5111 | +615 |
| B `vzroslyy-rebenok-doma-dengi-pomoshch-posledstviya` | 4724 | 5115 | +391 |
| C `sovershennoletie-roditelskaya-vlast-chto-menyaetsya` | 4860 | 5308 | +448 |
| D `vzroslaya-doch-otets-brak-soglasie-granitsy-vlasti` | 5704 | 6468 | +764 |
| Total | 34168 | 38605 | **+4437** |

Invariants this branch never broke, and that a reconciler can rely on:

- No `<h2 id>` was added, removed or renamed in any of the seven articles. Counts
  are unchanged from base: I 16, II 24, III 22, A 22, B 26, C 31, D 40.
- All 73 pinned anchors across the seven `teenSeriesConfig.ts` TOCs are present
  (I 9/9, II 10/10, III 10/10, A 10/10, B 11/11, C 11/11, D 12/12).
- `data/series.json` was not touched.
- No `readingTime` frontmatter was touched, on any article.
- No source, locator, citation or quotation was added. The last three commits add
  prose only and contain no `chapter:verse` pattern, so
  `data/scripture-search-index.json` regenerates byte-identical at 1378
  references / 3499 occurrences / 102 routes.

Because no heading ids moved, any sibling prose link written by another branch
into these four adult articles still resolves after this branch's text is merged
in. That is the property the sibling-link contract depends on.

## 2. Verification scoreboard (all seven chains closed)

| Article | Chain verified | Result |
| --- | --- | --- |
| I | `265` kill switch + own chain | closed earlier; 0 do-not-import violations |
| II | own chain, 34 requirement points | closed earlier |
| III | own chain + `166 §5`, `230`, `271` | closed earlier |
| A | `59 60 66 71 90 210 211 212 215 216 225 226 302 303` | `302` ledger 39/39; `303` 7/7; `90A` GREEN/YELLOW/RED compliant; kill switch 0 violations; 3 requirements written (`212 §7`, `225 §12`, `225 §15`) |
| B | `67 94 172 179 202 219 220 222 227 228 229` | closed; 2 requirements written (`222 §9`, `172 §13`) |
| C | `34 70 182 187_GEN2 194 202(signpost) 205 207 209 264` | 1 requirement written (`264` clinical limit) |
| D | `187_GEN2 205 218 218B 245` + own chain | 1 requirement written (`245` transparency guard) |

Requirements that were confirmed satisfied by *non-use*, and must not be
"repaired" by a reconciler who greps for them and finds nothing:

- `90A §10`: the textual-variant label for 2 Samuel 13:21 is required only if the
  passage is used. Companion A never mentions Амнон, Фамарь or 13:21.
- `245` temptress guard: Companion D never uses the Proverbs adulteress texts, so
  the prohibition on teaching "women are temptresses, boys are passive victims"
  has no trigger in D. Part I does cite Притч. 9:13–18, and there the young man is
  addressed as morally responsible, which is what the guard requires.
- `245` "romantic myths, not universal teen beliefs": Companion D presents no
  catalogue of universal teen beliefs; its single script is already framed as
  «современный роман легко создаёт психологическую картину».
- `34` Deuteronomy 21:18–21: Companion C never uses the passage, so the guard
  against treating its judicial penalty as a parental model has no trigger. The
  module's general-equity point is carried instead by C's
  `#neveruyuschiy-vzroslyy` («не становится нравственно нейтральным») together
  with 1689 ch. 19 and ch. 16.
- `172` Newheiser clause: vacuous on this branch, because no counselling author is
  cited anywhere in the series.

## 3. Highest-priority reconciliation exposure: the sibling-link contract

`8c44f067` added `scripts/lib/teen-article-links.mjs`,
`scripts/teen-article-links-contract-test.mjs`, a CI step, and a **hard
requirement** inside `scripts/teen-series-release-contract.mjs`: each of A, B, C,
D must contain, in its own MDX prose, a markdown link to each of the other three
(`](/articles/<slug>/)`), and the built HTML must render those links inside
`#article-content` with visible text longer than three characters. The contract
fails closed.

Census of that requirement across branches, measured on MDX only (3 links
required per article, 12 total):

| Branch | A | B | C | D | Total | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `8c44f067` | 3/3 | 3/3 | 3/3 | 3/3 | 12/12 | PASS |
| `5ccbaa3b` | 3/3 | 3/3 | 0/3 | 2/3 | 8/12 | fail (4) |
| this branch | 0/3 | 0/3 | 0/3 | 2/3 | 2/12 | fail (10) |
| `4786e4e2` | 0/3 | 0/3 | 0/3 | 2/3 | 2/12 | fail (10) |
| `7b785a3b` | 0/3 | 0/3 | 0/3 | 2/3 | 2/12 | fail (10) |
| `bf6e18c1` | 0/3 | 0/3 | 0/3 | 2/3 | 2/12 | fail (10) |
| `1d569906` | 0/3 | 0/3 | 0/3 | 2/3 | 2/12 | fail (10) |

Base `9618e82` itself carries only the 2 links in D, so **`main` would fail the
new contract too**. The contract and the links must therefore land together; the
script must never be merged without the MDX edits that satisfy it.

Empirical check performed: `8c44f067`'s release contract was run against this
branch's tree and this branch's built `dist`. Result: 20 errors, all of them the
sibling-link rule (10 MDX + 10 rendered). No other rule failed.

Merge exposure measured with `git merge-tree --write-tree` between this branch and
`8c44f067`: 8 files conflict, including three of the four adult articles
(A 12 hunks, B 3 hunks, D 2 hunks). Companion C merges cleanly. Of the 17
conflict hunks in A/B/D, **exactly one** contains a sibling link — in Companion A,
and the two sides are complementary rather than contradictory:

- this branch: «Конкретные условия совместного проживания — отдельный вопрос
  раздела B. Эта статья не превращает притчу в договор аренды.»
- `8c44f067`: «Например, человек просит кров после потери жилья, но говорить о
  случившемся пока не готов. Если это безопасно, законно и семья располагает
  возможностью помочь, родители могут дать временное убежище или помочь найти
  его, …» with the link to Companion B.

Correct resolution keeps both paragraphs. A reconciler who resolves that hunk by
taking one whole side loses either a routing sentence or a contract-mandated link.

This branch deliberately did **not** write sibling links, to avoid duplicating
work already owned and implemented by `8c44f067`, and to avoid creating a second
set of links to the same targets inside the same routing sections.

## 4. Second exposure: two branches wrote sibling links independently

`5ccbaa3b` and `8c44f067` both satisfy the link requirement in A and B, but at
different insertion sites with different wording. Comparing the link-bearing lines
textually: A has 5 such lines on `8c44f067` and 3 on `5ccbaa3b`; B has 6 on each;
**zero lines are identical between the two branches**. Merging both without
manual editing will double the links to the same sibling articles inside the same
prose. This is an editorial defect the contract will not catch, because the
contract only checks that at least one link per target exists.

## 5. Scripture index

Five branches regenerate `data/scripture-search-index.json`, and `1d569906`'s
regeneration alone is 19464 insertions against 4942 deletions. The file conflicts
on every pairwise merge. It must be rebuilt from the **final** merged tree with
`node scripts/build-scripture-occurrence-index.mjs --write` and then re-checked
with `node scripts/scripture-occurrence-index-contract.mjs`. Never resolve this
file by taking one side.

## 6. Resolved: the Companion A deletion

`1d569906` previously deleted the research-authority scaffolding comment in
Companion A, cut 22 `<h2 id>` sections down to 10, reduced the body from 4762 to
3623 words, and lost two of the seven `303` requirements, all while staying
gate-green. Commit `8d72e34` on that branch, "restore immutable legacy HTML &
Companion A", reverses it: 821 insertions against 64 deletions in Companion A.
The branch now measures **34168 body words total, identical to base**, with A at
4496 words and 22 `<h2 id>`. The loss is fully repaired at source and needs no
reconciliation action. The residual lesson stands: pinned-anchor checks are not
content checks, and a branch can delete twelve free sections while keeping all ten
pinned anchors and passing every gate.

The only remaining difference on that branch in the legacy HTML surface is the
declared cache-bust token in `404.html` (`?v=75df3eab` → `?v=ac0b061c`), which is
what its commit message announces. Not a defect.

## 7. Reading-time contract

`8c44f067` has since added `scripts/lib/teen-reading-time-contract.mjs` (+82) with
its own test (+43), and wired `checkTeenReadingTimes` into the release contract so
that frontmatter `readingTime`, publication metadata, the series rail, per-page
progress and the total must agree. Running his updated contract against this
branch produced **no reading-time errors** — only the 20 sibling-link errors from
section 3 — because this branch never touched `readingTime`. The known drift
between the house word counters and the pinned minutes in `data/series.json`
remains an owner-level HOLD and is being handled on `4786e4e2`, which is the only
branch that touches `data/series.json` and `scripts/lib/reading-time-policy.js`.

## 8. Gate state of this branch

`npm run strangler:build:production-like` exits 0: approved/blocked 78/0, 68
files, 74 articles, 227 metadata fields, 235 popup payloads, 7/7 teen source
boundaries, heading-name hygiene post-check passed, and pastor-series guards G-1
through G-8 passed. Additionally all of the following exit 0:
`teen-series-release-contract` (this branch's own version),
`scripture-occurrence-index-contract`, `reader-toc-projection`,
`series-reader-fragment-audit`, `article:qa`, `sources:hygiene`,
`mdx:structure:audit`, `content:parity`, `content:guard`,
`editorial:lint --sources`, and `document-authority-audit`.

The only designed failure in the repository remains
`teen-series-foundation-contract.mjs`, which also fails on `main`.

Distribution probes after the final build: 25/25 new fragments visible on
Companion A, 18/18 on Companions C and D, with zero `≠` characters, zero
backticks, zero section signs, zero CAPS ladders in reader prose (the only
four-letter capitals inside `#article-content` are the `EEBO` abbreviation in
source links), and zero broken intra-page anchors.

## 9. Suggested reconciliation order

1. Decide the sibling-link owner first, because it is the only requirement that
   fails closed on `main` and on five of seven branches. Keep one branch's link
   set; do not merge both `5ccbaa3b`'s and `8c44f067`'s.
2. Merge content branches pairwise, resolving every hunk by keeping both sides
   where they are complementary. This branch's edits are purely additive prose
   inside existing sections and never move a heading id.
3. Rebuild `data/scripture-search-index.json` from the final tree, never from a
   side.
4. Re-run the full battery, including `8c44f067`'s tightened release contract and
   his link and reading-time tests, before deploying.
