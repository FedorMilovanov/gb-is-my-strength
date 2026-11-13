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
body words and Companion B to 9135, far beyond every other branch. If that content
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

The only designed failure in the repository remains
`teen-series-foundation-contract.mjs`, which also fails on `main`.

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
the 36 article MDX files this branch touched, 16 do not drive a rendered page,
because their routes import an astro pilot body instead of the MDX. The earlier
draft of this note wrongly listed four more as unrouted. They are live:
`angely-pod-mrakom-iuda-6-7-2-petra-2`, `blagovestie-mertvym-1-petra-4-5-6`,
`duhi-v-temnice-noi-kreshchenie-pobeda` and
`enoh-prorochestvoval-iuda-14-15-4q204` are rendered from
`src/pages/hard-texts/<slug>/index.astro`, which does
`import Content from '@/content/articles/<slug>.mdx'` and renders `<Content />`
inside `Genesis6ArticlePage`. They publish under `/hard-texts/`, not
`/articles/`, which is why a census that only looks for
`src/pages/articles/<slug>/index.astro` misclassified them. So 20 of the 36 are
live and 16 are shadows, and all seven teen-series articles are MDX-driven and
live, which is why every fragment written by this branch was confirmed visible in
built HTML. A reconciler should not expect MDX-only edits in the sixteen shadow
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
token hyphenated onto a Cyrillic adjective. The article's own footnote four
already gives the correct form, since it cites Timothy A. Lee's «Jude's Use of a
Kaige Edition of Enochic Scripture», and line 216 of the same file used `Kaige`
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

## 9. Suggested reconciliation order

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
   against the policy.
6. Take `1d569906`'s mixed-script and language-of-parts audits together with his
   content corrections. His `article-qa.js` exits 0 only on a tree where the base
   spellings are already fixed, so adopting the audit without the fixes turns
   eleven pre-existing strings in `karty/*/route.json`, the Gill context tail and
   the `g3` dossier into a build failure on every other branch.
7. Re-run the full battery, including `8c44f067`'s tightened release contract and
   his link and reading-time tests, `1d569906`'s language-of-parts and
   mixed-script contracts, and `4786e4e2`'s `reading-time-audit`, before
   deploying.
