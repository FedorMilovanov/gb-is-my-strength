# Source Link Audit red on `main` + Baptist media mojibake — root cause, repaired URLs, remaining backlog

**Date:** 2026-10-12
**Mode:** LANE (one root cause, one bounded repair surface)
**Lane / owner:** AuditRepo backlog closure + Baptist media provenance, executed on session branch
`arena/fbf6f1fd-gb-is-my-strength`.
**Base / rollback SHA:** `d14da74cfe9f45e9b03e383e8e622695b01f8e16` (`main`, merge of PR #2182).
**Adjacent work:** open draft PRs #2161, #2162, #2168 (map/article repairs), #2142/#2143/#2164
(research/content lanes) — not touched here, dispositions in §7.
**Source of truth:** current `main`; `baptisty-rossii/research/media-ledger.md`;
`src/components/baptisty-rossii/*.astro`; Wikimedia Commons page metadata; workflow
`.github/workflows/source-links.yml` + uploaded CI job log.

---

## 1. Finding: the weekly Source Link Audit has been red on `main` for a month

`gh run list --workflow=source-links.yml` (100 runs):

| Date (UTC) | Event | Run | Head | Result |
|---|---|---|---|---|
| 2026-09-07 08:02 | schedule | 34098490942 | `99a7b9a7d6` | **success** (last green) |
| 2026-09-12 12:15 | push (PR #2007 merge) | 34693183399 | `7f0496ef03` | failure |
| … 10 further runs … | schedule / push / pull_request | — | — | failure |
| 2026-10-12 10:25 | schedule | 38236281205 | `d14da74cfe` | failure |

Failed job `source-links` (job id `114767661072`), step 6 “Source link audit
(production-like dist)” → exit 1. The step log (artifact
`source-link-chain-38236281205`) reports **15 hard errors**:

```text
❌ Hard errors (15):
- HTTP 404: https://commons.wikimedia.org/wiki/File:?redacted=1 (iniciativnaya-gruppa)      ×1
- HTTP 404: https://commons.wikimedia.org/wiki/File:?redacted=1 (peterburgskaya-liniya)     ×2
- HTTP 404: https://commons.wikimedia.org/wiki/File:?redacted=1 (podpolnaya-pechat)         ×2
- HTTP 404: https://commons.wikimedia.org/wiki/File:?redacted=1 (vsehib-1944)               ×1
- HTTP 404: amazon.com/Mercy-Wilderness-…/dp/B0HKZ7JDV9            (steven-lawson-…)
- HTTP 404: ecfa.org/Content/ECFA-Terminates-RZIM-s-Membership     (diotrefy-nashego-vremeni)
- CERT_HAS_EXPIRED: pravenc.ru/text/{155550,1681015,186873,2564076,389599}.html ×5
- CERT_HAS_EXPIRED: sedmitza.ru/lib/text/7697292/                  ×1
- unusable HTTP 402: tennessean.com/story/news/religion/2025-03-20/steve-lawson-…/82500864007/
```

`sanitizeUrlForEvidence()` masks the failing Commons path with `?redacted=1`, so the CI log
alone cannot name the broken file — see §2 for identifications.

### 1.1 Two CI mechanics that decide whether this repair can be seen to work

Discovered while driving PR #2183 through the checks:

1. **`production-like-contract` and `metadata-ssot-closure` both start with
   `git diff --check "$BASE_SHA" "$HEAD_SHA"`** (step “Verify exact changed diff hygiene”). Any
   trailing whitespace or *blank line at EOF* in a changed file fails two required checks before
   a single project gate runs. This lane hit it once: `git diff --check d14da74… b31b765…` →
   `audit/SOURCE-LINK-RED-AND-BAPTIST-MEDIA-MOJIBAKE-2026-10-12.md:313: new blank line at EOF.`
   Fixed in `c9b27b1`; from now on every report/source edit in this repo must end with exactly one
   newline. **Recorded so the next session does not lose a CI cycle to it.**
2. **The `Source Link Audit` workflow never runs on a PR for the files changed here.** The
   workflow triggers are: `workflow_dispatch`, the weekly Monday 03:00 schedule, a push to `main`
   touching a fixed path list (`source-links.yml`, `antisovetov/AntisovetovBody.astro`,
   `diotrophes/DiotrophesDraft.astro`, `KodDaVinchiSectionSummaryTitleAuto.astro`,
   `BaptistyRossiiNochNaKureBody.astro`, `BaptistyRossiiYuzhnayaShtundaBody.astro`,
   `data/diotrophes-wave11-faithful-witness-sources.json`), and a PR-only `contract` job that
   touches only the audit scripts. **`BaptistyRossii{IniciativnayaGruppa,PeterburgskayaLiniya,
   PodpolnayaPechat,Vsehib1944}Body.astro` are not in that list**, so this PR cannot turn
   `source-links` green by itself and CI cannot exercise the six repaired URLs on this branch.
   The upstream verdict therefore arrives only on the next scheduled run or an explicit
   `workflow_dispatch` on `main` — which is exactly why §5 leans on the Commons byte-identity
   proof instead. The list itself is **pinned by a contract**:
   `scripts/source-link-audit-main-trigger-contract.cjs` asserts the exact seven push paths
   (`governed push path set drift`), so widening it is a governed change for the owner, not a
   side effect of this repair.

## 2. Root cause of the six Commons 404s (and of a wider reader-facing defect)

The affected `sourceUrl` values contain **literal `?` characters instead of Cyrillic**:

```text
src/components/baptisty-rossii/BaptistyRossiiIniciativnayaGruppaBody.astro:54
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:???????????-???????-????.jpg'
```

In a URL the first `?` starts the query string, so the parsed address is
`https://commons.wikimedia.org/wiki/File:` + query → **404**.

Git history: the loss was introduced by commit `059b30245`
“feat(baptists): add authentic historical media and composition guards (#2028)”, merged
2026-09-13. Every damaged line is an *added* line of that commit (`+31 / +40 / +22 …` per file);
the previous revision of each file contains no `???`. A history-wide search for the intended
Cyrillic values (`git log --all -S`, all 48 remote branches) finds nothing: **the text never
existed in correct form in this repository**, so it cannot be restored from git.

Damage is bounded to the 10 files that commit touched:

| File | Damaged lines | Kind |
|---|---:|---|
| `src/components/baptisty-rossii/BaptistyRossiiSpravochnikBody.astro` | 40 | section prose, journey prose, media metadata |
| `…/BaptistyRossiiPodpolnayaPechatBody.astro` | 31 | + 2 broken Commons URLs |
| `…/BaptistyRossiiIniciativnayaGruppaBody.astro` | 22 | + 1 broken Commons URL |
| `…/BaptistyRossiiPeterburgskayaLiniyaBody.astro` | 20 | + 2 broken Commons URLs |
| `…/BaptistyRossiiGoneniyaISovestBody.astro` | 12 | section/journey prose |
| `…/BaptistyRossiiYuzhnayaShtundaBody.astro` | 11 | media metadata |
| `…/BaptistyRossiiNochNaKureBody.astro` | 11 | media metadata |
| `…/BaptistyRossiiVsehib1944Body.astro` | 8 | + 1 broken Commons URL |
| `…/BaptistyRossiiDvaSezda1884Body.astro` | 7 | media metadata |
| `baptisty-rossii/research/media-ledger.md` | 22 rows (5 `?`, 17 backtick) | ledger cells (URL, description, author, licence, attribution) |

Classification of the 167 damaged component lines: `image-meta` 77, `section-prose`
(eyebrow/heading/intro) 48, `journey-prose` 28, `sourceUrl` 6, ledger rows 5, other 3.
Published HTML carries the same text, so these strings are **live reader-facing content**
(media captions, alt texts, section headings), not only audit metadata.

## 3. Repair delivered in this lane (provable, no invention)

All fifteen Baptist media originals are byte-identical to their Commons files. Each repaired
URL was re-derived from content, not guessed: local archived bytes →
SHA-1 (`list=allimages&aisha1=…`) → canonical Commons page, then confirmed with
`prop=imageinfo&iiprop=sha1|size`.

| evidence id | local raw file | size | SHA-1 (local = Commons) | canonical Commons page |
|---|---|---:|---|---|
| `commons-vestnik-spaseniya-1965-pd` | `research/raw-media/commons/vestnik-spaseniya-1965.jpg` | 101 395 | `a1a47ac9…` | `File:Обложка журнала Вестник спасения.jpg` (pageid 65504537) |
| `commons-bulletin-relatives-1972-pd` | `bulletin-relatives-1972.jpg` | 352 367 | `31601c0a…` | `File:Обложка журнала Бюллетень Совета родственников узников ЕХБ.jpg` (65504645) |
| `commons-kryuchkov-vins-trial-1966-pd` | `kryuchkov-vins-trial-1966.jpg` | 55 891 | `7c988ba5…` | `File:Стенограмма-Крючков-Винс.jpg` (71749102) |
| `commons-pashkov-vasily-pd` | `pashkov-vasily.jpg` | 280 819 | `ac9f4cbb…` | `File:Полковник Василий Александрович Пашков.jpg` (114635315) |
| `commons-prokhanov-young-pd` | `prokhanov-young.png` | 397 430 | `cf0e90a3…` | `File:Проханов-инженер.png` (67265255) |
| `commons-vsehb-august-1945-pd` | `vsehb-august-1945.png` | 1 001 074 | `d32bb734…` | `File:Августовское совещание ВСЕХБ 1945 год.png` (65420194) |

Changed files (12 lines): the six `sourceUrl` values in four series components, plus the same
six URL cells in `baptisty-rossii/research/media-ledger.md`. Percent-encoding follows the
existing verified convention of the ledger (`revchurch-1920-9-12-p100` row).

**Not repaired here (needs the author's text):** the 161 remaining damaged lines. Their
sentences cannot be reconstructed verbatim; the recovery path is §6.

## 4. Baseline (clean HEAD `d14da74`) vs this change

Baseline column = checks actually executed on the untouched checkout of `d14da74` (three
repository-wide gates, to keep the audit proportionate); the remaining checks were executed on
the changed tree only and are listed as such.

| Check | Clean HEAD `d14da74` | After this change |
|---|---|---|
| `npm run workflows:check` | PASS | PASS |
| `npm run validate:strict` | PASS | PASS |
| `npm run seo-audit` | PASS (0 errors / 0 warnings) | PASS |
| `npm run page-ownership:check` | not run | PASS |
| `npm run content:guard` | not run | PASS |
| `npm run data:consistency` | not run | PASS |
| `npm run editorial:lint` | not run | PASS |
| `npm run sources:hygiene` | not run | PASS (21 pre-existing warnings) |
| `npm run article:qa` | not run | PASS (31 routes, 0 errors / 0 warnings) |
| `npm run baptisty:roadmap:audit` | not run | PASS |
| `npm run baptisty:authentic-media:audit` | not run | PASS (16 PUBLISHED / VERIFIED items) |
| `npm run astro:audit:baptisty-series:no-build` | not run | PASS |
| `strangler:build:production-like` (production-like dist) | exit 0 | exit 0 |
| rendered `dist/**` still contains `File:?…` Commons links | 6 links / 4 pages | **0** |
| rendered `dist/**` shows the canonical Commons pages | — | 6 links (see §5) |

Pre-existing red **not** caused by this change and not silently repaired:
Source Link Audit (15 hard errors, §1), 24 remote branches without a PR (§7), two abandoned
draft repair lanes (§7).

## 5. Rendered witness

Executed 2026-10-12 on the changed tree (`strangler:build:production-like`, exit code 0 after the
change; the same command on clean `d14da74` had also exited 0):

```bash
# 1) no corrupted Commons link survives anywhere in the rendered Baptist pages
$ grep -c 'File:?' dist/baptisty-rossii/*/index.html
# (no output — every counter is 0)
$ grep -l 'File:`' dist/baptisty-rossii/*/index.html
# (no output — no backtick-corrupted File: link left either)

# 2) the six repaired URLs render as canonical percent-encoded Commons pages
$ for p in iniciativnaya-gruppa peterburgskaya-liniya podpolnaya-pechat vsehib-1944; do
    grep -o 'href="https://commons.wikimedia.org/wiki/File:[^"]*"' \
      dist/baptisty-rossii/$p/index.html; done | sort -u | python3 -c 'import sys,urllib.parse
for l in sys.stdin: print(urllib.parse.unquote(l.strip()[6:-1]))'
→ File:Стенограмма-Крючков-Винс.jpg                      (iniciativnaya-gruppa)
→ File:Полковник_Василий_Александрович_Пашков.jpg         (peterburgskaya-liniya)
→ File:Проханов-инженер.png                               (peterburgskaya-liniya)
→ File:Обложка_журнала_Вестник_спасения.jpg               (podpolnaya-pechat)
→ File:Обложка_журнала_Бюллетень_Совета_родственников_узников_ЕХБ.jpg (podpolnaya-pechat)
→ File:Августовское_совещание_ВСЕХБ_1945_год.png          (vsehib-1944)
```

The three untouched neighbours in the same dist pages (`Letter_of_Initiative_group_jf_EHB_Presbiters.jpg`,
`Obrashenye_to_VSEHB.JPG`, `Kargel_Ivan.jpg`, `BulletenSCEHB.jpg`) are the pre-existing, never-broken
links, which confirms the patch touched exactly its six targets and nothing else.

These six are preview-only checks of the *emitted HTML*: the true HTTP verdict belongs to CI, which
cannot be run from here. Sandbox egress cannot re-run the CI probe: every non-allowlisted host is reset
(`ECONNRESET`) and allowlisted `github.com` TLS fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`
(sandbox TLS interception; anonymous `curl` of the same URL returns 200). The local audit run
therefore reproduces the *transport* class, not the 404 class; the existence of each repaired
page is instead proven by the Commons API calls above (`imageinfo&iiprop=sha1|size`).

## 6. Remaining backlog and recommended dispositions

### 6.1 Nine CI hard errors that survive this lane — verified live status, owner decision required

Re-checked **live on 2026-10-12** through the sandbox browser-egress path (which can reach these
hosts even though `bash` cannot), so the table below is evidence, not guesswork:

| URL (rendered page) | CI result | What is true today (2026-10-12) | Recommended disposition |
|---|---|---|---|
| `pravdenc.ru/text/{155550,1681015,186873,2564076,389599}.html` (5 Baptist chapters) | `CERT_HAS_EXPIRED` ×5 | `text/155550.html` renders the full article (checked); CertSpotter shows `*.pravenc.ru` issued **2026-09-10T20:01Z**, valid to **2026-12-09**, `revoked:false` — i.e. a current, unexpired certificate | **No edit needed; re-run CI first.** The five URLs share one host and one certificate (four of five not individually re-fetched). If the error repeats after 2026-12-09, re-check the certificate before touching citations |
| `sedmitza.ru/lib/text/7697292/` (sovetskaya-noch, spravochnik) | `CERT_HAS_EXPIRED` | Article renders (checked); `*.sedmitza.ru` issued **2026-09-10T20:02Z**, valid to **2026-12-09**, `revoked:false` | same as pravenc |
| `ecfa.org/Content/ECFA-Terminates-RZIM-s-Membership` (Diotrophes, `FW10-RZI-01`) | 404 | Confirmed 404 on the redesigned ECFA site. The statement itself is archived: 18 Wayback captures 2021-02-15 → 2025-11-10; the first `200` is **`https://web.archive.org/web/20210215202400/https://www.ecfa.org/Content/ECFA-Terminates-RZIM-s-Membership`** and it renders the full press release (verified verbatim, incl. the Michael Martin quote). It is not only a CI line: the built page `dist/articles/diotrefy-nashego-vremeni/index.html` still carries this dead href, so a reader on the live route is sent to a 404 | **Repair prepared and locally verified — must ship alone.** Trial patch (swap `href` → the archived URL, label disclosure «(архивная копия 2021-02-15)») ran `node scripts/diotrophes-wave11-faithful-witness-contract.mjs` → **exit 0**; the same holds with a prefixed guard entry `"href": "https://www.ecfa.org/…"` added to `staleRegistryUrls`. One trap found by the trial: adding the **bare** dead URL to `staleRegistryUrls` **fails** the contract (`stale registry URL retained`), because that guard is a raw substring test and the Wayback URL contains the dead URL. Two independent reasons it cannot ride in this PR: the Wave 11 workflow enforces a bounded Wave 11 diff (`Unexpected Wave 11 files` for any extra file), and this PR mixes that file with others. Note for whoever opens the dedicated PR: `diotrophes-wave12-release.yml` also triggers on `data/diotrophes-wave11-faithful-witness-*.json`, so the Wave 12 lane will run too (its browser/transaction contracts do not pin this URL — checked). |
| `amazon.com/…/dp/B0HKZ7JDV9` (Lawson, `LAW-47`) | 404 | Confirmed dead: Amazon answers with its “Sorry! We couldn't find that page” fallback (`plpRedirect=mhFallback`). **Wayback has zero captures of it.** Separately, the *real* book card (`B0HHSR7SFM`, ISBN 9798996167302, $14.99) is live | The copy-cat card can no longer be shown to a reader at all. **Dropping the entry is not an option**: the same control review pins the registry invariant “51 источник, `n` = 1…51 без пропусков”, so `LAW-47` must be re-anchored, not removed — and its `proves` text states a fact about a page that no longer exists (what Amazon showed on 2026-10-03). That is an editorial rewrite for the owner |
| `tennessean.com/…/82500864007/` (Lawson, `LAW-30`) | HTTP 402 | The article is **live** for a browser (full text indexed and readable); 402/anti-bot is how the site answers datacenter clients. `LAW-30.boundary` already records that the body was verified via the Yahoo reprint | **Do not change without the owner.** `docs/LAWSON-2174-CONTROL-REVIEW-2026-10-11.md` is the decision of record: “**LAW-30** (Tennessean, 20 марта 2025) остаётся `near-primary`… тело статьи сверено по перепечатке Yahoo… понижение отменено”, and its known-limits list repeats “тело статьи Tennessean проверено по перепечатке Yahoo, не по каноническому сайту”. Swapping the citation to the reprint would reverse a documented editorial decision; the alternative is to accept 402 as a known access limit and treat that one line as permanently red |

These are editorial-source decisions (the July precedent for issue #806 was to replace dead
archival links with institutional authorities), so they are reported, not changed here. Two
reasons to keep them out of this PR rather than “just fix them”:

1. **The `Source Link Audit` workflow cannot run on this PR** (its triggers are listed in §1.1) —
   any citation swap shipped here would go to `main` unverified, which is exactly what the
   protocol for pre-existing red forbids.
2. Two of the entries carry `evidenceClass` (`near-primary`, `secondary`) and `boundary` text
   written around the *citation of record*. Swapping a URL silently would make those fields lie.

**The bright line this lane applies:** corrupted content is repaired (it is damage, provably
recoverable); rotted citations are reported (they are choices, and the replacement changes what
the reader is being asked to trust).

### 6.2 Mojibake restoration — recovery path

1. Identify every file by content: `sha1sum` of `baptisty-rossii/research/raw-media/commons/*`
   → `https://commons.wikimedia.org/w/api.php?action=query&list=allimages&aisha1=<sha1>`.
2. Read the original description/author/date/licence from the same page
   (`prop=imageinfo&iiprop=extmetadata`) — that is the ledger's stated evidence requirement.
3. Re-author the captions/alt/section prose from those facts plus the intact surrounding
   article text; the damaged word shapes (one `?` per lost character) constrain sentence
   lengths, so a restored caption can be checked against the original layout.
4. Re-run `npm run baptisty:authentic-media:audit` (SHA-256 + usage contract) and the
   production-like `strangler:audit:production-like` before publishing.

## 7. Unfinished work inventory

> **Update (2026-10-13):** the inventory below was the read-only snapshot taken on 2026-10-12.
> The owner then asked for the cleanup itself, so it was re-derived from scratch with two extra
> checks and executed: see `audit/BRANCH-CLEANUP-DISPOSITION-2026-10-13.md`. Summary of the delta:
> 49 non-default refs → **41** (8 refs with zero commits over `main` deleted, each with its head
> SHA and a one-line restore command recorded); of the rest, **7** are complete byte-for-byte
> duplicates of another live ref, **1** is a 2026-09-29 `HOLD` (waiting for #2142), **12** are
> active (open PRs / dependency lanes) and **24** carry content that exists nowhere else — none of
> those was touched. The 2026-10-12 snapshot below is kept for provenance.

`gh pr list --state all` × `git rev-list --left-right --count origin/main...origin/<branch>`
over 48 non-default branches on 2026-10-12:

* **9 branches with an open PR** — #2168 (draft), #2164 (draft), #2162 (draft), #2161 (draft),
  #2143 (draft), #2142, #2181, #2179, #2144. #2181 (map holding overflow, `+1/-1`) has green
  checks and is `BEHIND` — merge is the owner's call; #2179/#2144 are dependency bumps
  (AGENTS.md forbids dependency updates without an explicit request).
* **15 branches whose PR is closed** — already dispositioned in
  `audit/BRANCH-CLEANUP-DISPOSITION-2026-09-29.md` and
  `audit/LAWSON-BRANCH-CLEANUP-DISPOSITION-2026-10-12.md`.
* **24 branches without any PR** — candidates for the next cleanup batch. Eight carry **zero**
  unique commits vs `main` (`arena/quiz-contract-repair`, `arena/quiz-dark-surface-token`,
  `arena/quiz-next-owner-scope-20261002`, `arena/quiz-next-owner-scope-20261003`,
  `arena/quiz-plain-text-contract`, `noop`, `noop2`, `fix/serdce-i-duh-mdx-em-20260930`) →
  `FULLY_REPRESENTED_BY_ANCESTRY`, i.e. deletable with zero information loss. The other 16 need
  content classification; `codex/baptisty-spravochnik-evidence-language`,
  `reconcile/baptisty-media-recovery-20260911` and
  `audit/baptisty-total-production-audit-20260911` overlap this lane's surface and should be
  checked before deletion.
* **Ancestry verification pass (`git cherry origin/main <branch>`)** — run 2026-10-12 on all 16
  no-PR branches that are ahead of `main`: **every one carries commits that are not
  patch-equivalent to `main`**, so none of them can be removed on ancestry grounds; the eight
  zero-commit refs stay the only zero-loss deletions. Two of the 16 overlap this lane's surface
  and are single-document drops dated 2026-09-11: `audit/baptisty-total-production-audit-20260911`
  (`baptisty-rossii/research/147-total-production-audit-2026-09-11.md`, +251: product + Research
  + Drive total audit) and `reconcile/baptisty-media-recovery-20260911`
  (`baptisty-rossii/research/147-media-container-recovery-status-2026-09-11.md`, +103: “source
  containers unavailable / production bytes hold”). Both are numbered 147 while `main`'s numbered
  series stops at 99 → they are unlanded research records, not duplicates. The media one's premise
  is already superseded by today's state (15 archived originals in
  `baptisty-rossii/research/raw-media/commons/` + a passing
  `baptisty:authentic-media:audit`, 16 items) → propose `SUPERSEDED_VERIFIED`; owner decides
  whether to land the record or archive the ref.
* **Two abandoned draft repairs verified as still current on `main`** (checked, not delivered
  here — separate clusters, they must not ride in this PR):
  * #2161 `GBS-AVRAAM-MAP-HEADING-LOST-ON-READY` — `src/pages/karty/avraam/index.astro`
    still deletes `h1.sr-only[data-pagefind-body]` when the map reports `ready`; the patch is
    `-19` lines (delete the observer script).
  * #2162/#2168 `GBS-KOD-DA-VINCHI-TIMELINE-KEYBOARD-SCROLL` — `.ctw-body` in
    `KodDaVinchiSectionCanon.astro` is still a non-focusable `overflow-x:auto` box; the patch
    is `+9/-1` (named `role="region"` + `tabindex="0"` + `:focus-visible` outline); #2168 also
    extends `scripts/public-surface-browser-matrix.mjs`.

## 8. Honest status

* **Done and verified:** root cause of the red audit; identification and repair of the six
  reader-facing Commons 404s in components *and* ledger; rendered-dist witness in §5; gates
  listed in §4.
* **Two governance constraints discovered while trying to close the remaining errors** (both are
  the reason the two “easiest-looking” fixes were *not* shipped here): the Wave 11 workflow fails
  any PR that mixes a Wave 11-owned file with other files (bounded-diff rule), and the audit’s
  push path list is pinned by a contract test. The ECFA repair behind the first constraint was
  nevertheless verified here by running the Wave 11 contract locally on a trial patch (exit 0,
  two variants — and one failing variant that exposed a substring-guard trap). Details in §6.1.
* **CI on this branch: all green.** `gh pr checks 2183` → **14 pass, 3 skipped, 0 fail** on
  `53f27f686` (`production-like-contract`, `metadata-ssot-closure`, `pixel-diff`, `Browser
  contract`, `Chromium + WebKit full-site menu contract`, `Deterministic source index and dist
  witness`, `Search combobox, modal and touch contract`, `a4-paper`, `guard`, `contract`,
  `native-source-contract`, `Source contract`, `Validate source metadata without building dist`,
  `Build and audit production-like candidate`; the three “skipping” entries are autofix jobs that
  only run on their own trigger). The branch was `MERGEABLE` at that moment.
* **Partially closed on 2026-10-13:** the *destination* class "the Commons page is dead" is now
  excluded by a **direct live API response** — `action=query&prop=imageinfo&iiprop=size|sha1` over
  all **16** Commons URLs present in the built `dist/baptisty-rossii/**` returned **no `missing`**,
  and the six repaired ones matched the ledger rows exactly (`size` / `sha1` / `pageid`; table in
  `audit/BAPTISTY-AND-SERIES-BROWSER-AUDIT-2026-10-13.md` §6).
* **Still not verified:** the CI HTTP verdict — `Source Link Audit` does not run on this branch
  (§1.1), so its next verdict arrives after merge (dispatch or the Monday schedule). Nor were the
  URLs opened in a real browser on the public internet (sandbox egress limitation).
* **Not done:** the 161 prose/metadata lines still carrying `?`/backtick (author's text
  required); the nine remaining CI hard errors (owner editorial decision); no PR was merged or
  closed. Branches: the 8 zero-work refs (`FULLY_REPRESENTED_BY_ANCESTRY`) were deleted on
  2026-10-13 with head SHAs and restore commands recorded in
  `audit/BRANCH-CLEANUP-DISPOSITION-2026-10-13.md`; every branch carrying content was kept, and
  the proven-but-unexecuted second batch (4 refs) is listed there for the owner.

## 9. Session disposition (7-part format)

**1. СДЕЛАНО**

* Repaired the six dead `sourceUrl`s (four `.astro` components) + the same six cells in
  `baptisty-rossii/research/media-ledger.md`; each URL rebuilt from the archived file's SHA-1 via
  the Commons API and proven byte-identical (`imageinfo&iiprop=sha1|size`).
* This report: red-CI timeline, root cause, repair table, §6.1 verified live status of the nine
  remaining hard errors, recovery path for the 161 corrupted lines.
* Branch cleanup (owner task 2026-10-13): all 49 non-default refs re-derived with four read-only
  checks; **8 refs carrying zero commits over `main` deleted**, each with head SHA + one-line
  restore command (`audit/BRANCH-CLEANUP-DISPOSITION-2026-10-13.md`); post-batch remote heads
  50 → 42, remote ↔ local tracking refs 0 discrepancies.
* Per-file digest of the 24 content-bearing branches — what exactly exists nowhere else (§6 of
  the disposition file).

**2. ПРОВЕРЕНО (numbers, diff vs baseline)**

* Baseline `d14da74` → head `0bef59b27`: **7 files, +621/−12** (`git diff --stat`); no file
  outside the audit scope touched.
* Gates (all PASS): `workflows:check`, `validate:strict`, `seo-audit`, `page-ownership:check`,
  `content:guard`, `data:consistency`, `editorial:lint`, `sources:hygiene`, `article:qa`,
  `baptisty:roadmap:audit`, `baptisty:authentic-media:audit` (16/16 items),
  `astro:audit:baptisty-series:no-build`; `git diff --check d14da74..HEAD` rc=0.
* Rendered witness: `strangler:build:production-like` exit 0; `File:?` count in
  `dist/baptisty-rossii/**` = 0; the six canonical Commons URLs present in the emitted HTML.
* Branch batch: `git ls-remote --heads` 50 → 42 heads; 0 missing / stale / SHA-mismatched
  tracking refs.
* ECFA repair validated by running the Wave 11 contract locally on a trial patch → exit 0
  (two variants); the bare-URL `staleRegistryUrls` variant fails (substring guard) — recorded so
  the next session does not repeat it.
* Reader-visible proof of the ECFA breakage: `dist/articles/diotrefy-nashego-vremeni/index.html`
  carries the dead href.
* CI on the head `f47dc7b9a`: **14 pass / 3 skipped / 0 fail** (`gh pr checks 2183`),
  `mergeStateStatus = CLEAN`; the following commit is a docs-only note and does not change code.

**3. НЕ ПРОВЕРЕНО**

* Live status of the *destination* pages: **closed for all 16 Commons URLs** by a direct live
  Commons API response (no `missing`; six repaired rows match the ledger by `size`/`sha1`/`pageid`).
  What remains open is the CI *verdict* — `Source Link Audit` does not run on a PR branch (§1.1),
  so the first classification after merge is still pending.
* Browser-level: the four repaired pages were rendered and audited in a real Chromium
  (`audit/BAPTISTY-AND-SERIES-BROWSER-AUDIT-2026-10-13.md`, 10 runs, 0 broken images, 0 `File:?`,
  CLS ≤ 0.016); that audit also found four pre-existing product defects (hero caption collision,
  author-icon contrast, `#mobPartTocBtn` name mismatch, `region`), none of them introduced here.
* The dedicated ECFA PR's full CI: such a PR would run the Wave 11 workflow **and** the Wave 12
  release workflow (`diotrophes-wave12-release.yml` triggers on the same file); only the Wave 11
  contract was executed locally.
* CI on the *note* commit that carries this line (docs-only; the recorded verdict above is for
  `f47dc7b9a`, its parent).
* The 161 prose/alt mojibake lines — needs the author's wording (§6.2).

**4. СРЕДА**

* 2 vCPU / 3 GB RAM; `node_modules` restored with `npm ci`; general outbound internet from bash is
  blocked (Commons and Web through the fetch tool); `gh` works for GitHub.
* Baseline cleanliness honoured: the 15 pre-existing CI hard errors and the 161 corrupted lines
  are reported, not silently patched; `main`, `.github/`, dependencies untouched.

**5. РЕШЕНИЯ САМ (judgement calls, no confirmation asked)**

* Repaired only the mechanically provable part of the corruption (six URLs + six ledger cells);
  prose/alt text was not invented.
* Executed the branch deletion batch: each of the eight refs was proven to carry zero commits over
  `main` (`docs/BRANCH_LIFECYCLE_V4.md` §10), with head SHA and restore command recorded; three
  refs an earlier registry had marked “не трогать” were released explicitly after proving their
  fix had landed through PR #2149.
* Did **not** ship three possible edits, and escalated them instead: the ECFA swap (bounded-diff
  rule → needs its own Wave-11-only PR), the Tennessean swap (`LAW-30` is the owner's decision of
  record in `docs/LAWSON-2174-CONTROL-REVIEW-2026-10-11.md`), the dead Amazon card (the registry
  invariant `n` = 1…51 forbids dropping an entry; re-anchoring is editorial).
* Kept the PR a draft; no merge/close, no force-push, no `main` mutation.

**6. ВЕТКА / SHA / PR / CI**

* Branch `arena/fbf6f1fd-gb-is-my-strength`: head `0bef59b27`, 8 commits over base/rollback
  `d14da74cfe9f45e9b03e383e8e622695b01f8e16` (untouched `main`).
* PR **#2183** (draft); its body is kept in sync with the disposition file.
* CI: **14 pass / 3 skipped / 0 fail, `CLEAN`** on `f47dc7b9a` (`gh pr checks 2183`); earlier
  complete green set was 14/3/0 on `6771b8ec9`.
* Upstream `source-links` is red since run 34693183399 (2026-09-12), last green 34098490942
  (2026-09-07 @ `99a7b9a7d6`); recovery criterion unchanged: `0 hard errors` +
  `systemicTransportFailure:false` from the first run after merge.

**7. ЧТО ДЕЛАТЬ МНЕ (owner)**

1. Read PR #2183; merge or request changes. After merge, trigger the upstream verdict:
   **`workflow_dispatch` on `Source Link Audit`** or wait for the Monday 03:00 schedule — the six
   URLs cannot be probed from the PR itself (§1.1.2).
2. Decide the nine remaining hard errors (§6.1): six need only a CI re-run (certificates verified
   current); the ECFA statement needs a **Wave-11-only PR** with the verified patch; `LAW-30`
   (Tennessean) and `LAW-47` (dead Amazon card) are editorial decisions.
3. Approve the branch second batch (4 byte-twin refs) — §5 of the disposition file.
4. Decide per-branch on the 24 content-bearing branches, now with exact file names
   (§6.1–6.3): “land / archive-ref / drop”.
5. Decide on the 161 mojibake prose/alt lines (§6.2) — needs the original wording (author).
6. Rule on the four defects the browser audit found in the series theme
   (`audit/BAPTISTY-AND-SERIES-BROWSER-AUDIT-2026-10-13.md`): the hero caption collision on all
   9 parts needs a product choice (drop the baked caption from the 11 cover SVGs, or move it out
   of the cropped band); the author-icon contrast (2.22:1), the `#mobPartTocBtn` accessible-name
   mismatch and the `region` nodes are one-file CSS/markup fixes.
