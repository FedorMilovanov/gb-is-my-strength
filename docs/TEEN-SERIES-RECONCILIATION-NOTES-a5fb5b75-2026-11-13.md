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

## 7b. Reading time must be recomputed from the final tree, like the index

`4786e4e2` resolved the long-standing reading-time drift by adopting an owner
policy module, `scripts/lib/reading-time-policy.js`, which states the rule once:
**180 Russian words per minute, rounded up, minimum one minute**, together with a
precise definition of what counts as reader text. He then re-pinned every surface
consistently: MDX `readingTime` frontmatter in all seven articles,
`teenSeriesConfig.ts` including `TOTAL_MIN` from 264 to 245, `data/series.json`
(45 lines), `scripts/teen-series-release-contract.mjs` and
`scripts/teen-series-foundation-contract.mjs`.

That re-pinning is **correct**, and it is not a bug. Verified by running his own
policy module over his own tree: his content computes to exactly
29 / 41 / 34 / 31 / 30 / 33 / 47, total 245, matching what he pinned. It also
explains the old drift, because base content computes to
27 / 38 / 31 / 30 / 29 / 32 / 37, total 224, while base pins
32 / 43 / 39 / 37 / 36 / 35 / 42, total 264 — the inherited numbers imply about
129 words per minute, not 180.

The consequence for reconciliation is the same as for the scripture index: these
numbers are derived from content, and every branch has different content.
Computed with his policy module, per article, in the order I / II / III / A / B /
C / D:

| Tree | I | II | III | A | B | C | D | Total words | Total min |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| base `9618e82` | 27 | 38 | 31 | 30 | 29 | 32 | 37 | 39991 | 224 |
| this branch | 29 | 47 | 33 | 34 | 31 | 35 | 42 | 44693 | **251** |
| `4786e4e2` | 29 | 41 | 34 | 31 | 30 | 33 | 47 | 43422 | 245 |
| `5ccbaa3b` | 27 | 38 | 31 | 46 | 58 | 32 | 37 | 48095 | 269 |
| `8c44f067` | 29 | 40 | 33 | 31 | 30 | 34 | 38 | 41675 | 235 |


**Every number in that table came from a defective counter and none of them is
verified reading time** — see §7g. Its `Words` column also counts the whole MDX
file, bibliography included, which on this branch is 5197 of the 44693 words. The
comparison the table supports still holds: this branch computes higher than base and
than `4786e4e2` under every variant measured. The minutes do not stand.

No two branches agree, and the spread is wide: Companion B computes to 31 minutes
here and 58 on `5ccbaa3b`; Companion D computes to 42 here and 47 on `4786e4e2`.
Neither the release contract nor `8c44f067`'s `checkTeenReadingTimes` can detect
this, because both only assert that the static surfaces agree **with each other**
— frontmatter against publication metadata against the rail against per-page
progress against the total. Content-to-minutes drift is invisible to every gate.

So merging `4786e4e2`'s pinned 245 with this branch's content would pass every
gate while understating Part II by six minutes (41 shown, 47 actual), Companion A
by three and Companion C by two, and overstating Companion D by five. The fix is
not to choose a side: after the final merge, recompute all seven values and the
total with his policy module and re-pin all four surfaces together —
`readingTime` frontmatter, `teenSeriesConfig.ts` including `TOTAL_MIN`,
`data/series.json`, and the two contract scripts. This branch deliberately left
every `readingTime` value at its base number rather than guessing, because the
policy module and the re-pinning are owned by `4786e4e2`.

One further note for whoever re-pins: `5ccbaa3b` has grown Companion A to 7085
body words and Companion B to 9231, far beyond every other branch. If that content
is kept, B alone accounts for 58 of the total minutes, and the canonical total
moves well past 269. The total is not a stable number to negotiate around; it is
an output.

## 7c. Correction to §7b: there are five surfaces, not four, and one guard proves nothing

`4786e4e2` has since advanced past `6b99470` to `836d364`, and his own
`docs/editorial-waves/OWNER-REPORT.md` now reports a finding that makes the
four-surface list in §7b incomplete. Reading time also lives hard-coded in page
markup: a visible `⏱ N мин` line, a hidden pagefind meta value, the minutes in
«читайте также» cards (`Богословие · 41 мин`) and in next-part announcements
(`К части I · ~41 мин`). He counts 132 such surfaces across 32 articles, and all
52 header values plus 69 card values diverged from the policy in both directions
(8 shown where 18 was correct, 45 for 25, 41 for 58, 30 for 40).

He taught his audit to see them (`componentLiterals` in `--json`, a report
section, `--list` with file and line) and to rewrite them with `--write-literals`,
value for value without changing line structure, explicitly so that merging with
parallel branches stays trivial. He rewrote 119 values in 47 components and left
15, each justified in `READING-TIME-POLICY.md` §8.3.

Running his audit against this branch's content and data confirms the exposure
here: 551 hard-coded surfaces across 113 pages, of which **231 diverge** from the
policy, and 89 of those sit inside files this branch touched. Running the same
audit against his own tree reports **0 divergent** and exits 0, so he did
reconcile them all on his side. The divergences are not this branch's doing — the
numbers themselves are base values — but they are this branch's exposure, because
a merge that keeps this branch's components and his content, or the reverse, will
silently mix two vintages of literals.

He also corrected himself in a way that matters to every branch: `data:consistency`
does **not** prove policy compliance. It compares surfaces with each other, not
with a calculation, so it goes green when the manifest and a card are stale in the
same way. The only criterion is `reading-time-audit`. This branch's §8 lists
`check-data-consistency.js` as green, and it is, but that gate carries no
information about whether the minutes are right.

Finally, his escalation to the owner is worth knowing before anyone re-pins: the
speed implied by `readingTime` is not uniform across the site — pastor-series
197–226 words per minute, apostasy-series 174–188, the rest of the site 113–138.
That range independently corroborates §7b's measurement that the teen series'
pinned base numbers imply roughly 129 wpm, and it means the choice of 180 wpm in
`lib/reading-time-policy.js` is a policy decision with site-wide consequences, not
a mechanical correction. He left `data/series.json` alone for that reason, since
`series-read-time-drift` compares four surfaces and changing the speed is an owner
decision.

## 7d. Bug in `5ccbaa3b`: reading-time surfaces left inconsistent, and no gate on his branch catches it

`5ccbaa3b` has advanced to `22cbe14` and now carries seven commits against
Companion B, growing that article from 4724 to 9231 body words while keeping all 26
`<h2 id=` sections. In the course of that he re-pinned two `readingTime` values in
MDX frontmatter — Companion A from 37 to 43 and Companion B from 36 to 68 — but
left the other two surfaces untouched. `git diff --numstat 9618e82 22cbe14` reports
both `data/series.json` and
`src/components/article-pilots/_shared/series/teenSeriesConfig.ts` as unchanged
from base.

The result is measurable inconsistency:

| branch | frontmatter `readingTime`, I…D | sum | `TOTAL_MIN` | agree |
| --- | --- | ---: | ---: | --- |
| base `9618e82` | 32/43/39/37/36/35/42 | 264 | 264 | yes |
| this branch | 32/43/39/37/36/35/42 | 264 | 264 | yes |
| `5ccbaa3b` | 32/43/39/**43**/**68**/35/42 | **302** | **264** | **no, off by 38** |
| `4786e4e2` | 29/41/34/31/30/33/47 | 245 | 245 | yes |
| `8c44f067`, `1d569906`, `7b785a3b`, `bf6e18c1` | 32/43/39/37/36/35/42 | 264 | 264 | yes |

Concretely, his Companion A frontmatter says 43 while `data/series.json` still says
37 at `/teen-double-life/parts[3]`, and his Companion B frontmatter says 68 while
the same file still says 36 at `parts[4]`.

Nothing on his own branch fails. `teen-series-release-contract.mjs`,
`check-data-consistency.js`, `series-reader-fragment-audit.js` and
`mdx-structure-audit.js` all exit 0 on his tree, because his copy of the release
contract is still the base version. `8c44f067`'s tightened contract does catch it:
run against `5ccbaa3b`'s sources it reports «A
(vzroslyy-rebenok-ushel-kontakt-pokayanie-vozvrashchenie): frontmatter readingTime
differs from series metadata» and the same for B, via
`scripts/lib/teen-reading-time-contract.mjs`, which compares frontmatter with the
series metadata row by row.

Two further observations for whoever reconciles. First, his re-pinned numbers do
not match the policy either: measured with `4786e4e2`'s
`lib/reading-time-policy.js` (180 wpm, round up, minimum 1), his Companion A
content computes to 46 minutes against his pinned 43, and his Companion B computes
to 58 against his pinned 68, so B is overstated by ten minutes and A understated by
three. Second, this is the same class of failure §7b describes — the surfaces agree
with each other or they do not, and no gate compares any of them with the content —
except that here the surfaces do not even agree with each other, so it is caught by
one contract instead of none. It is reported rather than repaired, because
`readingTime` re-pinning is `4786e4e2`'s declared lane and this branch has
deliberately left every value at its base number.

## 7e. A counter bug in the policy module, reproduced — and proof it does not touch §7b

`8c44f067` reports in his `docs/EDITORIAL-PARALLEL-CONTROL-2026-11-13.md` that
`4786e4e2`'s `reading-time-audit` reports 70 articles with no divergence while the
defect examples still reproduce: nested `hidden` yields 6 words instead of 2, and
`aria-hidden="false"` yields 0 instead of 2. Both reproduce against
`lib/reading-time-policy.js` at `836d364`, and a third case does too:

| input | `readerWordCount` | correct |
| --- | ---: | ---: |
| `<div><div hidden>одно два</div> три четыре пять шесть</div>` | 6 | 4 |
| `<p>видимое <span hidden>скрытое одно скрытое два</span> текст</p>` | 6 | 2 |
| `<p aria-hidden="false">одно два</p>` | 0 | 2 |
| `<p data-hidden="no">одно два</p>` | 0 | 2 |

There are two distinct causes. The over-count comes from the stripping regex
`<([a-zA-Z][\w-]*)\b([^>]*)>([\s\S]*?)<\/\1>`: it matches the outermost element
first, and when that element is not hidden the callback returns the whole match
unchanged, so `lastIndex` advances past every nested element and a nested `hidden`
or `sr-only` child is never inspected. The module's two-pass loop does not help,
because the second pass sees the same structure. The under-count comes from
`/\bhide\b|\bhidden\b/.test(attrs)`, which tests the attribute **string**, so it
matches an attribute *name* rather than a value: `aria-hidden="false"` and
`data-hidden="no"` both satisfy `\bhidden\b` because `-` is a non-word character,
and the element is stripped even though it is visible. The separate
`/aria-hidden=(?:"true"|'true'|true)/` test on the next line is correct but
redundant, since the first test already fires.

This matters to §7b because every figure in that table was produced by this module.
It was therefore checked directly rather than assumed. All seven teen-series
articles contain **zero** occurrences, in the reader body, of every token that can
enter the hidden-stripping path: `hidden`, `aria-hidden`, `data-hidden`, `details`,
`sr-only`, `visually-hidden`, `display:none`, `<script`, `<style`, `<template`. The
buggy branches are never reached for these articles, so the §7b word counts and
minutes stand as measured.

The caveat travels with the recommendation, though. §7c and §9 advise recomputing
minutes across the whole site from the final tree, and the 113 pages carrying 551
hard-coded literals are not all free of these tokens. Whoever runs a mass
`--write` or `--write-literals` should fix the two causes above and add regression
tests first, because a counter that silently drops a visible paragraph or keeps a
hidden one will re-pin wrong numbers into every surface at once, and — as §7c
records — no gate compares any surface with the content.

**Update at his later head `6f2fad3`: the MDX-side bug is unfixed and a second,
correct counter now exists beside it.** `git diff 836d364 6f2fad3 --
scripts/lib/reading-time-policy.js` is empty, so all four cases above still
reproduce unchanged. But he added `scripts/lib/reader-main-words.cjs` (+103), a
dependency-free stack parser exposing `visibleMainWords(html)`, used by
`reading-time-dist-crosscheck` and by a new `scripts/native-route-reading-time.js`
(+211) for native routes that have neither MDX nor a single body file. It is correct
where the other is not. Against the same cases it returns 2 for
`aria-hidden="false"`, 2 for `data-hidden="no"`, 4 for same-tag nested `hidden` and
2 for mixed-tag nested `hidden`, and it does not count attribute text, so
`<button aria-label="пять шесть семь">восемь</button>` yields 1. Its own comments
name the reasons: void elements must not be pushed on the stack, because
`dzhon-gill-chast-3-nasledie` returned 0 words from a single `<img hidden>`, and a
bespoke parser is needed «потому что регулярка `<[^>]+>` оставляет текст атрибутов
(длинные aria-label источников) и не знает про `hidden`». That is an independent
diagnosis of the same defect class recorded above.

So the repository now has two word counters with different answers. Measured on
identical text — frontmatter and the sources section stripped, then the same string
fed to `readerWordCount` directly and to `visibleMainWords` wrapped in `<main>` —
the two disagree on **all ten** articles tested, and the MDX-side counter is always
the higher one:

| article | `readerWordCount` | `visibleMainWords` | gap | minutes |
| --- | ---: | ---: | ---: | --- |
| `steven-lawson-samoobman-i-publichnyy-golos` | 15637 | 14286 | 1351 | 87 vs 80 |
| `teksty-pisaniya-kotorymi-manipuliruyut` | 2942 | 2644 | 298 | 17 vs 15 |
| `vernye-i-neizvestnye-zdorovoe-pastyrstvo` | 3129 | 2835 | 294 | 18 vs 16 |
| `sem-tipov-razlichenie-uchiteley` | 1957 | 1716 | 241 | 11 vs 10 |
| `cerkovnaya-disciplina-vlast-granicy-zashchita` | 2384 | 2159 | 225 | 14 vs 12 |
| `kogda-uhodit-kogda-ostavatsya` | 2314 | 2096 | 218 | 13 vs 12 |
| `priznaki-zdorovoy-cerkvi` | 2277 | 2099 | 178 | 13 vs 12 |
| `anatomiya-padeniya-pyat-stadiy` | 2046 | 1884 | 162 | 12 vs 11 |
| `nesovershennyy-chelovek-v-nesovershennoy-cerkvi` | 2363 | 2200 | 163 | 14 vs 13 |
| `dva-sezda-1884` | 886 | 799 | 87 | 5 vs 5 |
| **totals** | **35935** | **32718** | **3217** | **17.9 min at 180 wpm** |

Twenty MDX articles contain at least one divergence-triggering token in the reader
body, four of them files this branch touched. None of the seven teen-series articles
does, which is why the §7b table is unaffected **by these four defects** — a claim
that §7g later had to narrow, because a fifth defect in the same function does move
the table. But a site-wide recompute is exactly where the choice of counter changes
the answer, by up to seven minutes on a single article. The two should be reconciled to one implementation before any mass
re-pin, and the correct one to keep is `visibleMainWords`, since it is the only one
that handles nesting, void elements, attribute text and `aria-hidden="false"`.

## 7f. The phase-aware foundation contract hardcodes one branch's minutes

The phase logic in `4786e4e2`'s rewritten `teen-series-foundation-contract.mjs` is
sound, as §8 records. The same commit also turns that branch's own minute figures
into repository-wide literal assertions, and that part does not generalize.

The contract contains a per-article `SERIES` table of `expectedMinutes` —
29/41/34/31/30/33/47 — and asserts each article's frontmatter `readingTime` against
it, then asserts `if (total !== 245) fail('canonical total reading time must be 245
min')`, then requires the literal text `const TOTAL_MIN = 245;` in
`teenSeriesConfig.ts` by regex, then requires the literal strings
`readingTime: '29 мин'` and so on for each slug, then requires each
`readingProgressDoneMin` and `readingProgressPartMin` to equal specific numbers.

Measured with his contract at `6f2fad3`:

| tree it is run against | result |
| --- | --- |
| his own `6f2fad3` | **PASS**, exit 0, reporting «total reading time: 245 min» and «released (7 published routes, noindex off, series admitted)» |
| base `9618e82` content | **37 failures**, and all 37 are minute-related: 0 phase-related, 0 other |
| this branch | 14+ failures, every one a minute literal: 264 against an expected 245, and each of the seven `readingTime` values against his per-article number |

The zero phase failures on base are the important half of that result. Base already
declares the published phase, so his phase logic accepts it; the entire rejection is
the frozen numbers. That means the contract as written cannot pass on any tree whose
content differs from his, which is every other branch including `main`.

This collides head-on with §7b's conclusion. That section argues the canonical total
is an **output** of the final merged content, not a number to negotiate around, and
§7c adds that no gate compares any surface with the content. A contract that asserts
`total === 245` as a literal makes the total an **input**: after any content merge it
fails even when all five surfaces agree perfectly with each other, because the merged
text no longer implies 245. Keeping this branch's +4437 words implies 251; keeping
`5ccbaa3b`'s Companion B at 9231 words implies 269; keeping both implies more.

The recommendation for whoever reconciles is to separate the two halves of his
commit. Take the phase-aware logic, which repairs a real stale-premise bug and is
content-independent. Do not take the minute literals: derive the expected minutes
from the content with his own policy module, or read them from a single declared
source and check the other surfaces against it, so that re-pinning after a merge is
a regeneration rather than a contract edit. As written, adopting his contract forces
every future editorial change to the teen series to be accompanied by a manual edit
to five sets of literals inside the contract itself.

## 7g. A fifth counter defect, proved here, and what it does to the §7b table

`8c44f067` found a further defect in `4786e4e2`'s `readerWordCount` and pointed out
that this note's §7b table was produced by that same defective algorithm. Both claims
were verified here independently. Both are true, and the second one is about my own
work, so it is stated first: **§7b's minutes are not verified reading time.**

The defect: `stripTags` matches only HTML `<...>`, so Markdown link syntax survives
and `WORD` then matches inside the URL. The link target is billed as prose:

```
Читайте [источник](https://example.org/very/long/path)                       -> 8 words
Читайте [источник](https://example.org/very/long/path/with/more/segments/...) -> 13 words
```

Both strings show the reader exactly two words. Reproduced byte-for-byte: 8 and 13.

Measured on this branch and on all four trees §7b lists, by emptying only the
Markdown link targets and changing nothing else — exactly `8c44f067`'s experiment:

| tree | links | as-is (what §7b printed) | targets emptied | delta |
| --- | ---: | --- | --- | ---: |
| base `9618e82` | 79 | `27·38·31·30·29·32·37` = 39991w / 224 min | `27·38·31·30·29·32·37` = 39376w / 224 min | 615 words |
| **this branch** | **80** | `29·47·33·34·31·35·42` = 44693w / **251 min** | `28·47·33·33·31·34·42` = 44073w / **248 min** | **620 words** |
| `4786e4e2` | 79 | `29·41·34·31·30·33·47` = 43422w / 245 min | `28·41·34·30·29·33·46` = 42807w / 241 min | 615 words |
| `5ccbaa3b` | 94 | `27·38·31·46·58·32·37` = 48095w / 269 min | `27·38·31·46·58·32·37` = 47437w / 269 min | 658 words |
| `8c44f067` | 113 | `29·40·33·31·30·34·38` = 41675w / 235 min | `28·39·32·30·30·33·38` = 40915w / 230 min | 760 words |

`8c44f067`'s figures for `4786e4e2` reproduce exactly, including which articles move
(I, A, B, D). On this branch 620 words of URL text are counted, three articles change
(I 29→28, A 34→33, C 35→34) and the total drops 251→248 minutes. On `8c44f067`'s own
tree, which carries the most links at 113, five articles move and the total drops
235→230 — so his finding costs his own branch five minutes too, and it is not a
complaint aimed at anyone else's content.

So §7b's headline for this branch is not 251 minutes. It is 248 at best, before the
four other defects and before any policy decision about what counts as visible prose.

**A further measurement recorded nowhere before: the word column includes the
bibliography.** §7b counts the whole MDX file, so each `## Источники и сверка` section
is billed to the reader as reading time. On this branch that is 5197 words of the
44693 — 29 minutes of the 251:

| article | counted in §7b | body only | bibliography |
| --- | ---: | ---: | ---: |
| I | 5049 | 4426 | 623 |
| II | 8409 | 7522 | 887 |
| III | 5898 | 5049 | 849 |
| A | 6043 | 5217 | 826 |
| B | 5579 | 5228 | 351 |
| C | 6159 | 5440 | 719 |
| D | 7556 | 6614 | 942 |
| total | **44693** | **39496** | **5197** |

Body only is 220 minutes at 180 wpm. Whether a bibliography should be billed is an
editorial policy question rather than a bug, and `4786e4e2`'s policy document does not
answer it — but it is a 29-minute decision on this branch and it affects every branch,
so it has to be made explicitly before any mass re-pin.

`8c44f067` also reports a genuine technical fault, recorded here for whoever runs the
audit: at `6f2fad33`, `node scripts/reading-time-audit.js --json` writes large JSON
through `console.log` and calls `process.exit(0)` immediately, which truncates the
stream when piped. He reproduced 65 536 characters and `Unexpected end of JSON input`
three times with a zero exit status from the producer; writing to a file yields valid
JSON with 73 entries. The stdout flush must complete before exit.

Recommended sequence, unchanged in substance and now with one more precondition: fix
the MDX/HTML parsing including Markdown links, fix nested-`hidden` and
`aria-hidden="false"`, decide the bibliography question, keep `visibleMainWords` as
the reference implementation, and only then reconcile and re-pin. Nothing in this
section is a reason to change any teen-series prose, and this branch has changed none.

## 8. Gate state of this branch

`npm run strangler:build:production-like` exits 0: approved/blocked 78/0, 68
files, 74 articles, 227 metadata fields, 235 popup payloads, 7/7 teen source
boundaries, heading-name hygiene post-check passed, and pastor-series guards G-1
through G-8 passed. Additionally all fourteen of the following exit 0:
`teen-series-release-contract.mjs --dist=dist` (this branch's own version),
`scripture-occurrence-index-contract.mjs`,
`reader-toc-projection-contract-test.cjs`, `series-reader-fragment-audit.js`,
`series-reader-facade-regression-test.js`, `check-data-consistency.js`,
`gill-reading-time-canonical-audit.js`, `article:qa`, `sources:hygiene`,
`mdx:structure:audit`, `content:parity`, `content:guard`,
`editorial:lint --sources`, and `document-authority-audit.mjs`.

The file names are given exactly, because two of them are easy to guess wrong:
there is no `reader-toc-projection.mjs` and no
`series-reader-fragment-audit.mjs`. The first is a CommonJS contract test and the
second is plain JS. Both wrong names fail with `MODULE_NOT_FOUND`, which looks
like a broken tree but is only a wrong path, and `git ls-files scripts/` reports
no missing tracked file.

**Correction to how this note previously described
`teen-series-foundation-contract.mjs`.** It was called the repository's only
designed failure because it exits 1 here and on `main`. That framing was wrong. It
is not a deliberate failure but a stale premise: the contract was written for the
foundation phase and still demands `draft: true`, `noindex: true`, no production
route and no admission to `data/series.json`, while the series has in fact been
published — all seven articles declare `draft: false` and `noindex: false`, all
seven routes exist, and the series is admitted to the registry. So the contract
fails on its own outdated assumption about the phase, on `main` and on every branch
alike.

`4786e4e2` fixed exactly this at `e532650`, «teen-series: make the foundation
contract phase-aware and blocking». His version reads the phase from each article's
`draft` flag, requires `noindex` to equal `draft`, requires a draft article to have
no route and a published article to have one, and fails the whole series if the
phase is mixed, since publication is atomic. That logic is correct and it
generalizes: run against base content the phase checks pass with zero failures,
because base already declares the published phase. §7f records the separate problem
his rewrite introduces.

The remaining exit-1 in this branch's own battery is therefore not a designed
failure to be tolerated but a known-broken contract whose repair belongs to
`4786e4e2`. Everything else listed above is green.

Distribution probes after the final build: 25/25 new fragments visible on
Companion A, 18/18 on Companions C and D, with zero `≠` characters, zero
backticks, zero section signs, zero CAPS ladders in reader prose (the only
four-letter capitals inside `#article-content` are the `EEBO` abbreviation in
source links), and zero broken intra-page anchors.

## 8b. Language-of-parts contract: one real defect found here and fixed

`1d569906` added `scripts/language-of-parts-contract.mjs` with
`scripts/lib/language-of-parts-hygiene.js` and `scripts/lib/mixed-script-guard.js`,
and wired `projectLanguageOfPartsHtml` into `scripts/heading-name-hygiene.js`, so
Greek and Hebrew runs are tagged in `dist/` at build time. Running that contract
against this branch's built `dist/` found a genuine defect **on this branch**, and
it has been fixed here rather than left to reconciliation.

The defect: the route
`articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/` is rendered
from `src/components/article-pilots/hermenevtika/HermenevtikaBody.astro`, not from
its MDX. The sitewide language-of-parts pass in commit `d944712` tagged 19 other
pilot bodies (314 to 453 `lang` attributes across
`src/components/article-pilots/`) but missed this one, because it edited the MDX
shadow, which does not drive that page. The commit message claim of "sitewide" was
therefore overstated by exactly one route.

Six untagged Greek runs were wrapped in `<span lang="el">` in that pilot body:
`ὀρθοτομοῦντα`, `ὀρθός`, `τέμνω`, `τὰ περὶ ἑαυτοῦ`,
`ἀνακεφαλαιώσασθαι`, `τὰ γεγραμμένα διὰ τῶν προφητῶν`.
Verification: `<span>` balance +6/+6, every other structural count unchanged,
Greek character count unchanged, and the tag-stripped text byte-identical, so no
visible reader text moved. After rebuild, a full audit of all 116 built HTML files
reports **0 files with untagged foreign runs** (previously 1 file, 5 findings).

Effect on the scripture index: two `context` strings for that one route shifted,
because `scripts/build-scripture-occurrence-index.mjs` line 92 replaces tags with
spaces. Reference, occurrence and route counts are unchanged at 1378 / 3499 / 102.
This is pre-existing builder behaviour, not a new artifact class: the committed
index already contains 493 such `( ` sequences produced by inline tags that were
there before, including the existing `lang="el"` tags
(`ἰὸς θανατηφόρος ( иос танатефорос , Иак.`). The rendered page itself has no
stray space, since the span follows the opening parenthesis directly.

Merge-order dependency that remains, and that is **not** a defect of this branch's
content: check 4 of that contract asserts that `installArticleStrategicMap()`
renders popover terms as `<span lang="grc">ὑπόκρισις</span>` and a `lang="he"`
counterpart. That tagging lives in `1d569906`'s change to
`src/runtime/article-strategic-map.js` (+38/-4), which this branch does not have.
So checks 1 through 3 now pass here and check 4 fails until his runtime change is
merged. `scripts/mixed-script-surface-contract.mjs` passes on this branch as-is.

Also recorded, since it affects how any of the seven branches should be read: of
the 36 article MDX files this branch touched, **17** do not drive a rendered page,
because their routes import a pilot component instead of the MDX, and 19 do. The
correct test is whether the route file imports the MDX and renders `<Content />`,
not whether a `*Body.astro` exists: sixteen of the seventeen render a `*Body.astro`,
but `kod-da-vinchi` renders `KodDaVinchiMainShell.astro` plus per-section
components and has no `*Body.astro` at all, so a `Body`-based census undercounts by
one and reports 16 shadows and 20 live routes. Its MDX is invisible all the same —
`KodDaVinchiMainShell.astro` contains no `.mdx` import and no `<Content`. An earlier
draft of this note carried that 20/16 figure; the verified figure is 19/17.

The earlier draft also wrongly listed four files as having no route file at all.
They are live:
`angely-pod-mrakom-iuda-6-7-2-petra-2`, `blagovestie-mertvym-1-petra-4-5-6`,
`duhi-v-temnice-noi-kreshchenie-pobeda` and
`enoh-prorochestvoval-iuda-14-15-4q204` are rendered from
`src/pages/hard-texts/<slug>/index.astro`, which does
`import Content from '@/content/articles/<slug>.mdx'` and renders `<Content />`
inside `Genesis6ArticlePage`. They publish under `/hard-texts/`, not
`/articles/`, which is why a census that only looks for
`src/pages/articles/<slug>/index.astro` misclassified them. So 19 of the 36 are
live and 17 are shadows, and all seven teen-series articles are MDX-driven and
live, which is why every fragment written by this branch was confirmed visible in
built HTML. A reconciler should not expect MDX-only edits in the seventeen shadow
files to change any page, but should treat the four `/hard-texts/` routes as
published surface.

## 8c. Mixed-script surface: one defect was this branch's, and it is now fixed

`1d569906`'s hardened `article-qa.js` and `readable-audit.js` flag
cyrillic-latin glue. Run against this branch they reported 39 source errors and 13
`fatal-cyrillic-latin-glue` findings in `dist/`. Every one was attributed before
anything was edited, by comparing `git grep -c <literal> 9618e82` with the same
count on this branch, plus a codepoint dump for the homoglyph cases.

Exactly one finding was this branch's, introduced by `d944712`:
`kaige-переводческую` in `enoh-prorochestvoval-iuda-14-15-4q204.mdx`, a Latin
token hyphenated onto a Cyrillic adjective. The base already carried that hybrid
inside a backtick code span, and this branch's removal of backtick schemas exposed
it as raw text; §8e records the full four-way collision. The article's own footnote
four already gives the correct form, since it cites Timothy A. Lee's «Jude's Use of
a Kaige Edition of Enochic Scripture», and line 216 of the same file used `Kaige`
separately. The prose now reads «переводческую технику Kaige», which keeps the
transliteration as a proper name instead of welding it into a Cyrillic word.

One further finding was repaired here even though the token is base content,
because this branch had already rewritten the surrounding lines: the transliteration
`хюперентюнхáней` carried a Latin `á` (U+00E1) inside a Cyrillic word, in
`serdce-i-duh.mdx` and `SerdceIDuhBody.astro`. `d944712` had edited both of those
lines to add `<span lang="el">` tags, so leaving a known mixed-script defect in a
line this branch already touched would have been incomplete work. Both were
normalized to a Cyrillic `а` plus U+0301 combining acute, which is byte-for-byte
the form `1d569906` independently chose, so the two branches converge instead of
diverging. The visible letters are unchanged; only the codepoints moved.

After both fixes, and measured with his scripts against this branch's sources and
this branch's rebuilt `dist/`: source errors 39 → **36**, and dist glue findings
13 → **11**. All 36 remaining source errors are pre-existing base content, and a
per-string check confirms **zero** of them are absent from `9618e82`. They sit in
surfaces this branch never wrote: 32 in `karty/*/route.json` (Latin-accented
transliterations such as `Бавéль`, `Харáн`, plus genuine homoglyphs `Газa`,
`Кенyon`, `Чекy`, `Элияhу`, `hе`), two in
`GillContextSectionSourcesAndSeriesTail.astro` (`PhD-диссертации`, `DOI-запись`),
and one in `kogda-chelovek-uhodit-ot-very.mdx` (`Shepherds-линия`). That last file
is one this branch touched, but its diff hunks do not reach that line and the
string counts base=1, mine=1. The remaining dist findings add the `g3` dossier's
`network-активности`, `email-адресами`, `Substack-каналами`, `commerce-витрина`,
`Wayback-снимок` and `G3-контролируемый`/`-контролируемым`.

`1d569906` fixes all of these on his own branch — his `article-qa.js` exits 0
there against the same 180 article files — so his strict audits are shipped as a
pair with his content corrections. That is the reason this branch did not adopt
his scripts, and the reason a merge must take his audits and his content fixes
together: taking the audit alone turns eleven base spellings into a build failure
on every other branch.

## 8d. A competitor's assessment of this branch's prose, tested and not confirmed

`4786e4e2`'s `OWNER-REPORT.md` says, of Companion B, that this branch
independently reached the same conclusion about capital-letter maxims
(«ГРАНИЦА ≠ МЕСТЬ» → «граница — не месть») but that «их дифф оставляет рваные
абзацы», ragged paragraphs, and so it was not borrowed. The convergence he
describes is real: this branch removed 68 `X ≠ Y` maxim lines and added none
back. The raggedness is not.

Each removal was a rewrite, not a deletion. Where the base had
`**ПОМОЩЬ ≠ НАЛИЧНЫЕ ≠ ПОГАШЕНИЕ ЧУЖОГО ДОЛГА ≠ ПОРУЧИТЕЛЬСТВО ≠ НАСЛЕДСТВО.**`,
this branch wrote «Помощь — это не обязательно наличные, а наличные — не то же
самое, что погашение чужого долга, поручительство или наследство», keeping the
explanatory sentence that followed. Probing the six explanatory sentences that
accompanied the removed maxims finds all of them still present.

A structural scan of all 36 MDX files this branch touched — orphan punctuation,
near-empty bold runs, dangling conjunctions, empty blockquote markers, three or
more consecutive blank lines, ordered-list numbering gaps, surviving CAPS maxims,
surviving backtick schemas — reports **zero** issues.

Paragraph cohesion was then measured across the seven teen articles, counting
words per paragraph in the reader body only, with frontmatter, the sources
section, markup, headings, tables, code fences and footnote markers stripped:

| measure | base | this branch |
| --- | ---: | ---: |
| paragraphs | 1994 | 1947 |
| average words per paragraph | 16.8 | **19.5** |
| paragraphs under 15 words | 61.6% | **56.3%** |
| paragraphs of 5 words or fewer | 23.7% | **18.6%** |

Every one of the seven improves, and Companion A improves most: 314 paragraphs
become 259, its 5-word-or-fewer paragraphs fall from 101 to 48, and its average
rises from 13.9 to 19.2 words. So on the measure the objection names, this branch
is less ragged than the base it started from, not more.

The likely source of the misreading is the line diff. This branch shows
+1629 / −1944 lines, a net negative, while its body word count rises by 4437.
Rewriting a maxim into a sentence, or joining two chopped paragraphs into one,
removes lines and adds words. A net-negative line count is therefore not evidence
of lost or ragged prose here, and any reconciler comparing branches by line count
will reach the same wrong conclusion about this branch and about `7b785a3b`,
whose −309…−624 lines likewise come with +481 net words.

## 8e. Both fixes above collide with other branches, and one branch deviates from corpus convention

Two of the strings in §8c turn out to be edited independently by other branches,
in different ways, so they need a decision at merge time rather than an automatic
resolution.

**The Kaige sentence is a four-way collision.** The base reads
«напоминающими \`kaige\`-переводческую технику», so the Latin token was already
hyphenated onto a Cyrillic adjective in the base, only inside a backtick code span.
This branch's `d944712` removed backtick schemas as a matter of house style and
therefore exposed the hybrid as raw text, which is how the audit came to flag it
here and not on branches that kept the backticks. Four versions now exist:

| branch | form |
| --- | --- |
| base `9618e82`, `4786e4e2`, `7b785a3b`, `8c44f067`, `bf6e18c1` | «напоминающими \`kaige\`-переводческую технику» |
| **this branch** | «напоминающими переводческую технику Kaige» |
| `5ccbaa3b` | «напоминающими переводческую технику \`kaige\`» |
| `1d569906` | rewrote the whole sentence: «переработанную в духе переводческой традиции `<span lang="grc">καίγε</span>` (*kaige*)» |

`5ccbaa3b` reached the same word-order repair as this branch, which is convergence
rather than conflict of intent, but the line will still conflict textually. This
branch's form is preferable on two counts: it drops the backticks, which house
style treats as a schema to remove, and it capitalizes `Kaige` as the proper name
of a recension, matching the article's own footnote four. `1d569906`'s version is
not a deletion — an earlier reading of his diff as «sentence absent» was wrong —
he reworded it and added his own Greek tagging; his copy of the article grew from
23970 to 57616 bytes.

**The accent normalization exists on only two of seven branches.** This branch and
`1d569906` both carry the Cyrillic `а` plus U+0301 in `serdce-i-duh.mdx` and
`SerdceIDuhBody.astro`, byte-for-byte identical. `4786e4e2`, `7b785a3b`,
`8c44f067`, `5ccbaa3b` and `bf6e18c1` all still carry the base Latin U+00E1. A
trial merge of this branch's HEAD against each of the six, with
`git merge-tree --write-tree`, shows what that means in practice:

| branch | conflicting files | the Kaige line | the accent, both files |
| --- | ---: | --- | --- |
| `1d569906` | 61 | conflict | conflict, but both sides chose U+0301, so resolution is trivial |
| `7b785a3b` | 42 | conflict | conflict, and his side keeps U+00E1 |
| `bf6e18c1` | 17 | auto-merges | conflict, and his side keeps U+00E1 |
| `4786e4e2` | 15 | conflict | **auto-merges, this branch's U+0301 survives** |
| `8c44f067` | 10 | conflict | **auto-merges, this branch's U+0301 survives** |
| `5ccbaa3b` | 8 | conflict | **auto-merges, this branch's U+0301 survives** |

The counts in that table were originally reported as 185/133/90/73/36/24 and were
wrong, in a way worth recording because it is easy to repeat. They were taken from
`git merge-tree --write-tree --name-only`, whose output after the first line lists
**every** file the merge touched, including informational `Auto-merging <path>`
lines for files that merged cleanly. Counting those lines overstates conflicts by
roughly a factor of three. The correct count is the number of lines beginning
`CONFLICT`. The per-file cells were always computed correctly, by testing for the
literal string `Merge conflict in <path>`, so the pattern in the table — which
branch collides on which of the three files — was right even when the totals were
not. §12 gives the same correction for the merge against `main`.

One property of these counts is easy to misread and is measured in §11: they are
**relative to the merge target**, not intrinsic to a lane. The same six lanes counted
against `8c44f067`'s head give 13/21/13/19/10/12 instead of 61/15/8/42/10/17, so
`1d569906` looks nearly three times worse against this branch than against his and
`4786e4e2` nearly twice as bad the other way round. Any conflict ranking has to name
its base.

So the resurrection risk is narrower than it first looks but real for three
branches. Against `4786e4e2`, `8c44f067` and `5ccbaa3b` git takes this branch's
side automatically, because they never edited those lines. Against `7b785a3b` and
`bf6e18c1` both sides edited the same paragraphs — `7b785a3b` joins paragraphs,
which is why it touches so much text — and resolving towards either one silently
restores the Latin U+00E1. That restored form passes every gate this branch
currently runs, because only `1d569906`'s hardened audits catch it. Whoever
reconciles should resolve both files towards the U+0301 form explicitly and then
re-run a mixed-script audit rather than trusting a green build.

The Kaige line conflicts against five of the six, which is consistent with §8e's
table above: four different renderings of one sentence now exist across the
branches, and only `bf6e18c1` leaves it far enough alone to auto-merge.

**One deviation worth reporting back.** `5ccbaa3b` also transliterated the
scholar's name in the same sentence, writing «Тимоти А. Ли предложил» where the
base and every other branch write «Timothy A. Lee предложил». The corpus convention
is clearly to keep Western scholarly names in Latin in body prose: `John Owen`
appears 17 times, `Michael J. Kruger` 9, `John Flavel` 9, `Diane Langberg` 8,
`Richard Baxter` 8, `Thomas R. Schreiner` 7. This branch kept the base form for
that reason. It is a small point, but it is the kind of change that reads as a
typographic improvement and actually breaks consistency with 459 distinct Latin
name and title runs across the articles, so it should not be adopted silently at
merge time.

## 8f. A real citation defect in the base, already fixed by `8c44f067`

`8c44f067` has advanced to `32944ea`, «Correct Solomon scripture references and
guard numbering». He added a new test,
`scripts/apostasy-solomon-reference-contract-test.mjs`, which did not exist in the
base. It asserts that the `<h2 id="solomon">` section of
`otstupniki-biblii-iuda-saul-ierovoam-dimas.mdx` contains `3 Цар. 11` exactly twice
and contains no `1 Цар. 11` at all, while the `<h2 id="saul">` section keeps
`1 Цар. 13` and `1 Цар. 15`.

That test fails on the base and on this branch, expected 2 and actual 0, because
the base cites Solomon's late-period fall as «1 Цар. 11». In Russian Synodal
numbering 1 Царств is 1 Samuel, so 1 Цар. 11 is the chapter about Nahash the
Ammonite and Jabesh-gilead, not the chapter where Solomon's wives turn his heart
after other gods. The correct Synodal reference is 3 Цар. 11, which is 1 Kings 11.
This is a substantive citation error, not a style preference: the article is about
apostates, and it supports its Solomon case with a verse that says nothing about
him. The same trap is worth remembering for the other books — 2 Царств is 2 Samuel
and 4 Царств is 2 Kings, so only the two Kings books shift, and only by two.

This branch did not repair it, deliberately. `8c44f067` owns the fix and has
already shipped it, and a trial merge shows the two branches edit different lines
of that file — his at 175 and 183, this branch's single hunk at 271 — so
`merge-tree` reports «Auto-merging» with no conflict. Taking his side is therefore
free, and duplicating the correction here would only manufacture a conflict.

Verified again at his later head `0ede68e`: the Solomon section contains `3 Цар. 11`
twice and `1 Цар. 11` zero times on his branch, and zero and two respectively on
both the base and this branch. That commit also **relaxed his own test**, on his
initiative and for a good reason — requiring exactly two occurrences would fail a
correct edit that cites different verses or a different number of times. The test
now requires at least one `3 Цар. 11` in the section and forbids `1 Цар. 11`, keeps
the separate Saul assertions, and adds positive and negative examples. He records
that the relaxed test also passes on `1d569906@c2e8ca86`. Anyone reconciling should
take the relaxed version, since the strict one would pin an arbitrary citation
count into a contract.

His commit also regenerated `data/scripture-search-index.json`, which makes him one
more branch in the set that rewrites that derived file, and reinforces §5: the
index must be rebuilt from the final merged tree, never taken from a side.

This branch's own added references were checked against the same rule and are
correct: `1 Цар. 2:29` and `1 Цар. 3:13` cite Eli and his sons in 1 Samuel,
`2 Цар. 18:33–19:8` cites David's grief over Absalom in 2 Samuel, and `4 Цар. 17`
with `4 Цар. 17:7–23` cites 2 Kings 17. None of them is a Kings passage numbered
as Samuel.

## 9. Suggested reconciliation order

0. Rebase the whole exercise on the fact that `main` is now `ba9552d`, not
   `9618e82` (§12). Unshallow the clone first — `git fetch --deepen=20 origin main`
   — and confirm `git merge-base` resolves, because a shallow clone reports
   «refusing to merge unrelated histories» and every conflict count taken before
   that is meaningless. Merging main into each lane is cheap for this one: two
   conflicts, one of which is a derived file.
1. Decide the sibling-link owner first, because it is the only requirement that
   fails closed on `main` and on five of seven branches. Keep one branch's link
   set; do not merge both `5ccbaa3b`'s and `8c44f067`'s.
2. Merge content branches pairwise, resolving every hunk by keeping both sides
   where they are complementary. This branch's edits are purely additive prose
   inside existing sections and never move a heading id.
3. Merge `1d569906`'s build-time language-of-parts projection together with his
   `src/runtime/article-strategic-map.js` change. The projection repairs `dist/`
   without touching sources, so it fixes every branch's output at once, and his
   contract's fourth check cannot pass without the runtime change. Never adopt his
   contract script alone.
4. Rebuild `data/scripture-search-index.json` from the final tree, never from a
   side.
5. Recompute all seven `readingTime` values and the canonical total from the final
   tree with `4786e4e2`'s policy module, and re-pin all five surfaces together:
   `readingTime` frontmatter, `teenSeriesConfig.ts` including `TOTAL_MIN`,
   `data/series.json`, the two contract scripts, and the hard-coded component
   literals via his `--write-literals`. Never take one branch's minutes, and never
   merge his contract numbers without his frontmatter, config, `data/series.json`
   and component-literal changes. Do not treat a green `data:consistency` as
   evidence that the minutes are right; only `reading-time-audit` measures them
   against the policy. Two preconditions from §7g come before this step, not after:
   the counter must stop billing Markdown link targets as prose (620 words and three
   minutes on this branch alone), and someone must decide explicitly whether the
   `## Источники и сверка` bibliography is reader time — on this branch it is 5197 of
   44693 words, 29 of 251 minutes, and the policy document does not answer it. Best
   of all, follow the method `4786e4e2` has just adopted for his own MDX-less routes
   and measure the built `<main>` in `dist` rather than trusting the source counter.
6. Take `1d569906`'s mixed-script and language-of-parts audits together with his
   content corrections. His `article-qa.js` exits 0 only on a tree where the base
   spellings are already fixed, so adopting the audit without the fixes turns
   eleven pre-existing strings in `karty/*/route.json`, the Gill context tail and
   the `g3` dossier into a build failure on every other branch. The same pairing now
   applies inside the build itself: his `27c9d1e` adds FAQ structured-data parity as
   **G-10** in `pastor-series-guards-dist.js`, which runs within
   `strangler:build:production-like`, and this branch's dist fails it 1 of 21 because
   the base PageHead schema answer for `20-antisovetov-pastoru` drops one word
   («Практический тест» where the reader sees «Практический тест такой»). His commit
   carries the fix, so take the guard and the schema answer together — see §13.
7. Re-run the full battery, including `8c44f067`'s tightened release contract and
   his link and reading-time tests, `1d569906`'s language-of-parts and
   mixed-script contracts and his G-10 FAQ parity guard, `4786e4e2`'s
   `reading-time-audit`, and `7b785a3b`'s `editorial-checks-7b785a3b.py`, before
   deploying. Each of the last three exits non-zero on a tree that lacks its author's
   paired content fixes (§13, §14), so run them last and read the attribution first.

## 10. Control re-verification of this note, 13 November 2026

Every quantitative claim above was re-measured from scratch after a third
environment reset, against the branch heads current at the time of writing. The
reset had reverted the checkout to base `9618e82` with 83 dirty paths, an empty
`node_modules` and no `dist/`; recovery was `git fetch` of the arena refs followed
by `git reset --hard origin/arena/a5fb5b75-gb-is-my-strength`, after which both
source fixes were confirmed present. Heads at re-verification: this branch
`5a5f8d9`, `1d569906` `c2e8ca8`, `4786e4e2` `836d364`, `7b785a3b` `bcd4719`,
`8c44f067` `32944ea`, `5ccbaa3b` `22cbe14`, `bf6e18c1` `fc2f30b`. Four of the six
had advanced since the figures were first recorded.

Reproduced exactly, no change needed:

- body words, frontmatter and sources stripped, base 34168 to this branch 38605, a
  gain of 4437;
- `<h2 id=` counts unchanged in all seven articles, 16/24/22/22/26/31/40;
- 73 pinned anchor occurrences in `teenSeriesConfig.ts`, 72 distinct because
  `gospel-center` is legitimately pinned twice, once per article at lines 91 and
  106 with different labels, and all of them resolve to an existing `<h2 id`;
- the §7b minutes table, all five rows, recomputed with `4786e4e2`'s own policy
  module: base 27/38/31/30/29/32/37 total 224 at 39991 words, this branch
  29/47/33/34/31/35/42 total 251 at 44693 words, `4786e4e2` 29/41/34/31/30/33/47
  total 245 at 43422 words, `5ccbaa3b` total 269 at 48095 words, `8c44f067` total
  235 at 41675 words;
- the §8d paragraph-cohesion table, 1994 paragraphs to 1947, average 16.8 to 19.5
  words, under-15-word share 61.6% to 56.3%, five-word-or-fewer share 23.7% to
  18.6%;
- the §8c attribution, re-run with `1d569906`'s scripts at his new head `c2e8ca8`:
  his `article-qa.js` exits 0 on his own tree and reports exactly 36 errors on this
  branch's sources, 35 distinct strings, of which **zero** are absent from
  `9618e82`; his `readable-audit.js` reports exactly 11
  `fatal-cyrillic-latin-glue` findings in this branch's rebuilt `dist/`;
- the §8e merge matrix, unchanged despite four branches moving: the Kaige line
  conflicts against five of six, the accent lines conflict against `1d569906`,
  `7b785a3b` and `bf6e18c1` and auto-merge against the other three, totals
  185/133/90/73/36/24 conflicting files;
- the §8f Solomon test, which fails on base and on this branch with `3 Цар. 11`
  present zero times against an expected two, and passes on `8c44f067` with two;
- `1d569906`'s copy of `enoh-prorochestvoval-iuda-14-15-4q204.mdx` at 57616 bytes
  against a base of 23970, still true at his new head, with `καίγε` present and
  `Lee предложил` absent, confirming a rewrite rather than a deletion;
- `5ccbaa3b`'s «Тимоти А. Ли» transliteration, still present at `22cbe14`.

One figure was wrong and is corrected in §8b: the shadow-route census. The verified
split of the 36 touched MDX files is **19 live and 17 shadow**, not the 20 and 16
originally written. The error came from classifying a route as a shadow only when a
`*Body.astro` exists for it; `kod-da-vinchi` has no `*Body.astro` and renders
`KodDaVinchiMainShell.astro` with per-section components instead, so it was counted
as live. Its MDX is invisible all the same, since that component imports no `.mdx`
and renders no `<Content`. The correct test is whether the route file itself imports
the MDX and renders `<Content />`.

Gate battery re-run in full at `5a5f8d9` after a clean `npm ci` and a
`strangler:build:production-like` that exited 0 with G-1 through G-8 passing:
14 of 14 green.

## 11. Cross-check against `8c44f067`'s independent control pass

`8c44f067` published `docs/EDITORIAL-PARALLEL-CONTROL-2026-11-13.md` at `0ede68e`,
an independent audit of the six arena branches plus draft PR #2302, taken from his
own snapshot `32944ea`. It is worth reading alongside this note because it reaches
some of the same conclusions by a different route, and because it grades this
branch.

His assessment of this branch at `5a5f8d9`: 10 pairwise conflicting files against
`32944ea`, index `--check` PASS, the standard static teen release contract PASS, and
his additional AST-based minute-parity check PASS. His parity helper reads
frontmatter, `data/series.json`, the rail and the progress fields independently of
any branch's own contract, so this is a fourth confirmation that the four
reading-time surfaces on this branch agree with each other — which, per §7c, is not
the same as agreeing with the content, and §7b remains the live issue here.

He independently found the same `5ccbaa3b` inconsistency recorded in §7d, reporting
frontmatter A = 43 against metadata and progress = 37, frontmatter B = 68 against 36,
with the series progress still summing to 264, and noting that the branch's own
release contract is green. His framing is more careful than §7d's and should be
preferred: this is a proven surface-consistency error, not evidence of which number
correctly describes the final reading time. §7d's policy-relative figures are
correct as measurements under 180 wpm, but the owner has not settled the wpm
question, so no branch's minutes should yet be called right or wrong.

His other findings that bear on this reconciliation:

- `4786e4e2`'s index `--check` **fails** at `836d364`: a separate `--write` produced
  1369 references and 3486 occurrences against the 1368 and 3474 committed, and a
  second `--check` then passed, so the derived file in that snapshot is stale rather
  than the generator being wrong. Draft PR #2302 fails the same check. This branch
  passes it. It is another instance of §5: the index must be rebuilt from the final
  tree.
- Substantive edits to `kogda-chelovek-uhodit-ot-very` and
  `kogda-uhodit-kogda-ostavatsya` overlap between branches, and both are files this
  branch touched. He lists what must survive the merge: the availability of
  immediate protection without a prior personal meeting or a mandatory sequence of
  addressees; the distinction between unwanted intrusive fears and a conscious
  rejection of faith; the availability of professional assessment and emergency
  help; not turning doubt into a diagnosis; and not compelling a return to a
  dangerous environment. This branch's own edits to those two files are the
  mixed-script and language-of-parts tagging described in §8b and §8c, which change
  markup rather than substance, so they do not compete with those caveats — but a
  reconciler resolving those files should keep his list in front of them.
- Lawson source IDs collide between his branch and PR #2302: his `LAW-55` is the
  Johnson letter and `LAW-56` Protestia, while the PR's `LAW-55` is Protestia,
  `LAW-56` The Roys Report and `LAW-57` Christian Post. The same ID therefore
  denotes different evidence, so neither the registry nor the MDX can be merged by
  picking a side; unique permanent IDs must be assigned and every `LawsonSourceRef`,
  number and generated anchor reconciled. This branch does not touch those files.
- He corrected his own published text on the Bachmann case: his branch and `LAW-29`
  named the 2016 indefinite suspension but omitted the successful appeal, so the
  suspension was overturned, the censure retained and standing in the presbytery
  restored. PR #2302 noticed the same omission independently. He warns that the
  correction is not a full exoneration and not an assessment of the help given to
  Lawson, and that the earlier wording must not return at merge time.
- He acknowledges this branch's note, recording the differing Kaige renderings and
  the Latin `á` repair in `serdce-i-duh.mdx` and its Body as an intersection that is
  **not** an automatically resolvable substantive decision, and asks that both
  MDX/Body pairs and mixed-script be re-checked after the merge. That agrees with
  §8e. He also records that another branch rightly noted the Solomon reference fix
  in his work, which is §8f above.

His stated limits should travel with any use of his table: the results are for the
listed SHAs, conflicts were counted pairwise from his snapshot rather than by
sequentially merging all seven, dist and browser checks were not run against other
branches' archives, and an automatic absence of conflict does not prove the absence
of a semantic collision. Draft PR #2302 remained a draft with several red GitHub
checks at the HEAD he inspected, including source-index, canonical discovery,
dependency security and lane collisions; he could not retrieve the step logs, so he
explicitly declines to treat that PR as release-ready.

**Update after his `74be383` pass.** He re-ran his control check against the newer
heads and published a corrected table, and on every point where it overlaps this note
the two now agree: this branch passes his source-index, teen-release and Teen
AST-parity checks, and `5ccbaa3b` fails AST parity on Companions A and B, which is
§7d. Two of his findings are new and are recorded in §7g: the fifth counter defect
that invalidates the minutes in §7b, including the minutes in his own table, and the
truncated-JSON fault in `4786e4e2`'s `reading-time-audit.js --json` when piped. He
also states plainly that the 235-minute total he had earlier attributed to this
branch's method and the §7b table were both produced by the defective algorithm —
which is correct, and is why §7b now carries a warning at the top of its table.

His conflict counts in that table (13/21/13/19/10/12) differ sharply from §8e's
(61/15/8/42/10/17) for the same lanes, and the reason was checked rather than
assumed: **his rows measure each lane against his own tree, §8e measures each lane
against this one.** Re-running `merge-tree` with `8c44f067`'s head as the base
reproduces his table exactly, lane for lane, 13/21/13/19/10/12. Both columns are
right; they answer different questions. In every pairing measured here, conflicting
files and `CONFLICT` lines came out 1:1, so that is not a source of difference.

| lane | vs `8c44f067` (his table) | vs this branch (§8e) |
| --- | ---: | ---: |
| `1d569906` | 13 | 61 |
| `4786e4e2` | 21 | 15 |
| `5ccbaa3b` | 13 | 8 |
| `7b785a3b` | 19 | 42 |
| this branch | 10 | — |
| `bf6e18c1` | 12 | 17 |

The practical consequence for whoever merges: `1d569906` and `7b785a3b` are nearly
three times worse against this branch than against his, while `4786e4e2` and
`5ccbaa3b` are nearly twice as bad against his. There is no single "most conflicting
lane" — it depends on the merge target, so any conflict ranking has to name its base.

## 12. `main` has moved: the base of this whole reconciliation is no longer `9618e82`

This is the most consequential fact in the note and it postdates every section above.
`origin/main` advanced from `9618e82` to **`ba9552d`** when PR #2292, «feat(reader):
integrated collapsible Grok rail, native Library dock and mobile first fold», merged
at 2026-11-13T22:38:51Z. Its commit subject is «feat(reader): unify Reader Core and
Argon «Коротко»». All seven arena lanes were branched from `9618e82`, so every
merge-base figure recorded above is now one commit stale on the main side.
`1d569906` has already merged the new main into his lane at `3a22a4b`; no other lane
has. This branch is 1 commit behind main and 26 ahead of it.

`ba9552d` changes 296 files against `9618e82`. It touches surfaces this note makes
claims about: all three `podrostok-za-kadrom-*` articles and one each of Companion A,
C and D; `data/scripture-search-index.json`, regenerated at +187/−235; six files
under `src/runtime/`; the `serdce-iduh` pilot component; and five hermenevtika files
including `HermenevtikaBody.astro`. It does **not** touch `teenSeriesConfig.ts`,
`data/series.json`, `scripts/teen-series-*`, `serdce-i-duh.mdx` or the Enoch article.

**Merging the new main into this branch produces exactly two conflicts**, counted as
lines beginning `CONFLICT`: `data/scripture-search-index.json`, which is derived and
should simply be regenerated from the merged tree per §5, and
`src/components/article-pilots/hermenevtika/HermenevtikaBody.astro`. All six teen
articles that both sides touched auto-merge. The change to each teen article is one
line, wrapping parenthesized citation groups in `<span class="reader-atomic-citation">`.

Two measurements make that safe to say. First, main's teen-series content is
**word-identical to base**: every one of the seven articles has exactly the same
body word count on `ba9552d` as on `9618e82`, and the series total is 34168 on both,
so main's one-line edits are markup only and add or remove no prose. Second, the
`<h2 id=` census is 16/24/22/22/26/31/40 on **every** tree measured — new main,
base, this branch and all six lanes — which confirms that `1d569906`'s section
deletions, the bug of record reported in §6, are still repaired at his current head
`53cd39c` and survived his merge of the new main. His Companion B is back to 26
sections and 4724 words, identical to base, and his Companion A to 22 sections.

For orientation, body words per article at the current heads, measured with
frontmatter, the sources section and all tags stripped:

| tree | I | II | III | A | B | C | D | total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| new main `ba9552d` | 4012 | 5776 | 4596 | 4496 | 4724 | 4860 | 5704 | 34168 |
| base `9618e82` | 4012 | 5776 | 4596 | 4496 | 4724 | 4860 | 5704 | 34168 |
| **this branch** | 4266 | 7368 | 4969 | 5111 | 5115 | 5308 | 6468 | **38605** |
| `1d569906` | 4012 | 5776 | 4596 | 4496 | 4724 | 4860 | 5704 | 34168 |
| `4786e4e2` | 4272 | 6350 | 5162 | 4540 | 4759 | 5057 | 7459 | 37599 |
| `7b785a3b` | 4016 | 5809 | 4611 | 4585 | 4874 | 4875 | 5879 | 34649 |
| `8c44f067` | 4192 | 6021 | 4739 | 4541 | 4840 | 5090 | 5873 | 35296 |
| `5ccbaa3b` | 4012 | 5776 | 4596 | 7085 | 9231 | 4860 | 5704 | 41264 |
| `bf6e18c1` | 4013 | 5776 | 4612 | 4529 | 4745 | 4854 | 5703 | 34232 |

### A new contract in main, and its attribution here

`ba9552d` adds `scripts/reader-citation-atomic-source-contract.cjs`. It requires that
every `(<button class="bref"` — an opening parenthesis immediately before a
scripture-reference button — be preceded by
`<span class="reader-atomic-citation">`, so that the bracket cannot be orphaned from
its reference at a line break. It asserts at least 100 such references in `src/` and
at least 100 in `dist/`, and requires `reader-atomic-citation` together with
`white-space:nowrap` in `dist/css/site.css`.

Scanned across three trees, counting only `src/**.astro` and `src/**.mdx` under 900
kB, exactly as the contract does:

| tree | parenthesized `bref` | violations |
| --- | ---: | ---: |
| base `9618e82` | 127 | **127** |
| this branch | 127 | **127**, identical per-file distribution to base |
| new main `ba9552d` | 127 | **0** |

So the wrapping is entirely main's new work — 121 sites in `HermenevtikaBody.astro`
and six elsewhere, including the teen articles — and this branch simply inherits the
base state. It is not a defect introduced here, and it disappears on merging main.
The one `bref` button this branch added, `1 Тим. 2:9` in Companion C, is preceded by
a colon and a space rather than an opening parenthesis, so it is outside the
contract's scope and needs no wrapper.

### Merging main re-introduces the §8b language-of-parts defect unless resolved deliberately

`ba9552d`'s `HermenevtikaBody.astro` contains **zero** `<span lang="el">` tags, while
carrying 77 Greek characters. The six runs §8b tagged are all still present, each
exactly once, and a scan for maximal Greek runs of two or more letters finds exactly
those six and no others. A merge that resolves this file towards main therefore
restores the untagged state and `1d569906`'s language-of-parts contract fails again,
while a merge resolved towards this branch loses main's 121 atomic-citation
wrappers. Neither side can be taken wholesale.

The resolution was constructed and verified rather than assumed. Taking main's
version of the file and wrapping the same six runs programmatically, in one pass by
descending offset, yields a file that satisfies both contracts at once:

| property | main's version | verified resolution |
| --- | ---: | ---: |
| `<span lang="el">` | 0 | **6** |
| untagged Greek runs of ≥2 letters | 6 | **0** |
| `reader-atomic-citation` occurrences | 121 | **121** |
| atomic-citation contract violations | 0 | **0** |
| tag-stripped visible text | — | **identical to main's** |
| bytes | 188205 | 188343 (+138) |

The +138 bytes is exactly six opening spans of 16 bytes plus six closing spans of 7,
which is a useful check that nothing else moved. The recipe for whoever reconciles:
take main's `HermenevtikaBody.astro`, then re-apply the language-of-parts tagging to
it, and regenerate the scripture index afterwards. Do not take this branch's copy of
the file, because it predates the Reader Core unification.

### A trap that produces a false «unrelated histories» result

This repository is a **shallow clone**. `.git/shallow` contained both `9618e82` and
`ba9552d`, so immediately after `git fetch origin main` the new commit had no
parents in the local object graph: `git rev-list --parents -n 1 ba9552d` returned
only itself, `git rev-parse ba9552d^` failed with «unknown revision»,
`git merge-base HEAD ba9552d` returned nothing, and `git merge-tree --write-tree
HEAD ba9552d` aborted with **«fatal: refusing to merge unrelated histories»** — even
though `git cat-file -p ba9552d` plainly shows `parent 9618e82…`. The raw commit
object keeps the parent line; the shallow graft hides it from ancestry traversal.

`git fetch --deepen=20 origin main` fixes it: `ba9552d^` then resolves to `9618e82`,
`git merge-base HEAD ba9552d` returns `9618e82`, and `merge-tree` runs normally.
Anyone reconciling these lanes should check `git rev-parse --is-shallow-repository`
before trusting any merge-base or merge-tree result, because the failure mode is a
confident error message that looks like a real divergence between branches rather
than a truncated local clone. Note also that `git merge-tree` in git 2.39.5 has no
`--merge-base` option; passing one exits 129 with a usage message.

## 13. A new build-level guard, G-10, lands on `1d569906` — and this branch would fail it

`1d569906` advanced twice during this pass, `53cd39c` → `27c9d1e`, adding
`scripts/faq-structured-data-answer-parity.mjs` and wiring it into
`scripts/pastor-series-guards-dist.js` as **G-10**. That matters more than a standalone
script would, because `pastor-series-guards-dist.js` is the guard suite that runs
inside `npm run strangler:build:production-like`. This branch's build currently prints
`G-1 a11y … G-8 print — all passed`; on his branch the same build must also satisfy
G-10. A new requirement inside the build path is invisible to a green battery until it
is merged.

Rule: every FAQPage `acceptedAnswer.text` must appear verbatim in the visible page
copy, with only presentation-level variance tolerated — inline-markup boundaries,
entities, non-breaking spaces, typographic quote and dash variants, and the space that
block-level tag removal introduces before punctuation.

**Run against this branch's dist, it fails 1 of 21 answers**, on
`dist/articles/20-antisovetov-pastoru/index.html`. The failure is not a teen-series
matter, and it is not this branch's defect. Attribution was established rather than
assumed, in four steps.

First, the only change this branch ever made to that article is six `<span lang="el">`
wrappings from `d944712`; the failing answer contains no Greek at all. Second,
removing those six spans from the built page — a faithful simulation of the base build,
365714 → 365576 bytes — reproduces the identical failure, so it pre-exists at base.
Third, the divergence was located by applying his own exported `norm` to both sides and
walking to the first differing character, at offset 673 of 873:

```
structured data : ...политической машины. Практический тест|: после применения власти...
visible copy    : ...политической машины. Практический тест| такой: после применения власти...
```

The schema answer is missing one word, **«такой»**. The visible Body has it; the
PageHead structured data does not. Fourth, that state was checked on four trees:

| tree | PageHead has «Практический тест такой» | Body has it | G-10 |
| --- | --- | --- | --- |
| base `9618e82` | no | yes | would fail |
| **this branch** | no | yes | **fails** |
| `1d569906` `27c9d1e` | **yes** | yes | passes |
| `4786e4e2` `865480e` | no | yes | would fail |

So `1d569906` fixed the content in the same commit that ships the gate. That is rule
(k) from §8d — strict audits ship paired with their author's content fixes — now with a
build-level example rather than a standalone-script one. The fix's minimality was
proved, not assumed: inserting the single word «такой» into this branch's built page,
365714 → 365720 bytes, one occurrence, makes his gate report
`7 acceptedAnswer texts verbatim in visible copy across 1 emitted pages` and exit 0.

Consequences, in the order they bind:

- Nothing here is this branch's to repair. The file is his lane, the defect is base's,
  and the fix is already committed on his branch. Editing the PageHead schema answer
  here would collide with his change for no benefit.
- Merging his branch brings the gate **and** its fix together, so the build stays
  green. Merging only the guard script, or only `pastor-series-guards-dist.js`, would
  turn `strangler:build:production-like` red on this branch and on `4786e4e2`'s.
- `4786e4e2` is exposed to the same trap: his current head still lacks the word, so if
  the guard reaches main before his content fix does, his build fails too. Worth
  telling him, since the two lanes are both editing `AntisovetovPageHead.astro` —
  `4786e4e2` changed it in `865480e` and `1d569906` in `27c9d1e`.
- G-10 is not referenced in any `.github/workflows/` file on his branch and not in
  `package.json`; it reaches CI only through the build guard suite. Anyone checking
  workflows alone would miss it.

The gate itself is sound. It carries a `--selftest` fixture mode, and its `norm`
correctly tolerates inline markup: a fixture whose visible words match the schema
answer exactly, with a `<strong>` ending immediately before a full stop, is accepted.
The earlier suspicion that tag-to-space substitution produced a false positive was
tested and is wrong; the failure is a real one-word content divergence.

Also recorded from this pass, for whoever runs the reading-time audit: `4786e4e2`'s
`865480e` did **not** touch `scripts/lib/reading-time-policy.js` — the diff is empty —
so all five counter defects in §7e and §7g stand at his current head. What he did
change is methodologically the right direction and corroborates §7e's recommendation:
he stopped trusting his own word counter for MDX-less routes and now measures the built
`<main>` in `dist`, writing in his policy document that counting words with your own
code and then checking with the same code is not verification. His first pass by
component traversal was wrong by eight minutes on three routes, which he corrected to
79 / 18 / 27 against 14104 / 3084 / 4704 visible words. That is the same argument §7g
makes for the teen series, arrived at independently: the built page is the reference,
not the source counter.

## 14. `7b785a3b` shipped a permanent checker; it exits 1 on this branch, and one of its two findings is a stale constant of his own

`7b785a3b` advanced `bcd4719` → `ef4be76` with docs only — two files, his owner report
and a new 366-line permanent checker, `docs/editorial-waves/editorial-checks-7b785a3b.py`.
His teen-series numbers are unchanged and every figure this note records for him still
holds exactly at the new head: h2 census 16/24/22/22/26/31/40, 34649 body words, 42 real
`CONFLICT` lines against this branch.

Run against this branch's tree and dist, his checker exits **1** with
`ВСЕГО ПРОВАЛОВ: 25 | адвайзори: 5`. Both categories were attributed before being
believed, and they turn out to have opposite causes.

**24 of the 25 are his content fixes that this branch does not have.** Check 4 rejects an
ASCII ellipsis inside a «…» quotation, on the corpus convention that the character is `…`.
All 24 hits are in the «сердце» chapters — `myslennaya-zhizn-serdca`,
`serdce-i-sokrovishche`, `kak-hranit-serdce`, `serdce-pod-skorbyu`,
`serdce-ne-v-odinochku` — none of them teen-series files. The ellipses are present at base
with exactly the counts this branch has (2, 3 and 4 lines in the three files sampled), so
nothing here was introduced by this branch; and at his own head the same files contain
**zero**. That is rule (k) from §8d for the third time in one pass: a strict audit ships
paired with its author's content corrections, and adopting the audit without the
corrections turns inherited base text into a hard failure on every other branch.

**The 25th is a stale constant in his checker, and it fails on his own tree.** Check 2
compares `anchor=null` counts in the scripture index against recorded `BASE_NULL` values.
For `rimlyanam-7-veruyushchiy-ili-neveruyushchiy` he records base 57, finds 58 on this
branch, and calls it «глубокие ссылки потеряны». It is not a lost deep link. The
occurrence total is **123 on both trees**, and the causality was tested rather than
argued, by rebuilding the index with `scripts/build-scripture-occurrence-index.mjs --write`
after swapping only that one article:

| `rimlyanam-7` source used | occurrences | `anchor=null` | against his `BASE_NULL` 57 |
| --- | ---: | ---: | --- |
| this branch's (with `<span lang="el">`) | 123 | 58 | fails |
| base `9618e82` | 123 | **58** | fails |
| **his own head `ef4be76`** | 123 | **58** | **fails on his own tree** |

So 58 is what a freshly built index gives for that route regardless of whose content is
used. The 57 he recorded came from base's **stored** index, which was stale — the same
staleness §8b describes and this branch corrected by regenerating. His own output already
admits the constants drift, advising `обновите BASE_NULL` for three other routes where the
count fell (`myslennaya-zhizn-serdca` 9→8, `serdce-i-sokrovishche` 13→12,
`osvobozhdennoe-serdce` 11→3); this one drifted the other way and became a hard failure
instead of an advisory. The fix is to re-derive `BASE_NULL` from a rebuilt index, not to
change any article. Both swaps were reverted and the regenerated index verified
byte-identical to the committed one, tree left clean.

Two of his advisories are independent confirmations of findings already in this note.
Check 7 reports **zero** places where Latin diacritics sit inside Cyrillic words, naming
the known case explicitly: «обе ветки `a5fb5b75` и `1d569906` привели к а+U+0301
байт-в-байт» — which corroborates §8c from a third party rather than from this branch's
own probe. Check 6 reports `readingTime` running 1.9–2.7 times the 180-words-per-minute
policy across nine «сердце» routes and states plainly that the policy is
`4786e4e2`'s branch policy with no owner norm behind it, and that the values equal main's
and may only be recomputed by the owner's decision — the same conclusion §7b reached from
the inherited numbers implying about 129 words per minute, and the same reason this branch
left every `readingTime` at its base value.

Two practical notes for anyone reusing his checker. It requires a built `dist`, and
importing its Python module executes the checks at import. Its companion in the other
direction is worth remembering: `1d569906`'s FAQ parity module exports `norm`, but
importing that module also runs its `main` and exits, so extracting the function into a
separate file is what made the character-level diff in §13 possible.
