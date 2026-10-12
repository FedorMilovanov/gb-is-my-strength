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
   proof instead.

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

### 6.1 Nine CI hard errors that survive this lane — owner decision required

| URL (rendered page) | CI result | Recommended disposition |
|---|---|---|
| `amazon.com/…/dp/B0HKZ7JDV9` (Lawson) | 404 | replace with an available sales/catalogue page or drop the link; the book itself is cited elsewhere |
| `ecfa.org/Content/ECFA-Terminates-RZIM-s-Membership` (Diotrophes) | 404 | replace with ECFA press archive/Wayback snapshot of the same statement |
| `pravenc.ru/text/{155550,1681015,186873,2564076,389599}.html` (5 Baptist chapters) | `CERT_HAS_EXPIRED` | site-side TLS defect: either cite a stable HTTPS archive snapshot or keep the citation without a link |
| `sedmitza.ru/lib/text/7697292/` (sovetskaya-noch, spravochnik) | `CERT_HAS_EXPIRED` | same as pravenc |
| `tennessean.com/…/82500864007/` (Lawson) | HTTP 402 | paywalled: replace with an accessible report of the same fact |

These are editorial-source decisions (the July precedent for issue #806 was to replace dead
archival links with institutional authorities), so they are reported, not changed here.

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

## 7. Unfinished work inventory (read-only; no ref was changed, closed or deleted)

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
* **Not verified (and not verifiable from here):** the CI HTTP verdict on the six URLs. CI's
  runner is the only place that can both reach `commons.wikimedia.org` *and* freshly fetch
  `dist/`. Strongest local substitute executed: Commons `imageinfo`s match our archived bytes
  (`sha1` + `size`), and the emitted HTML carries exactly those six canonical URLs.
* **Not done:** the 161 prose/metadata lines still carrying `?`/backtick (author's text
  required); the nine remaining CI hard errors (owner editorial decision); no branch was
  deleted, merged or closed.

## 9. Session disposition (7-part format)

**1. СДЕЛАНО**

* Repaired the six dead `sourceUrl`s (four `.astro` components) + the same six cells in
  `baptisty-rossii/research/media-ledger.md`; each URL rebuilt from the archived file's SHA-1
  via the Commons API and proven byte-identical (`imageinfo&iiprop=sha1|size`).
* This report: 48-branch inventory, red-CI timeline, root cause, repair table, backlog
  dispositions, recovery path for the remaining 161 corrupted lines.
* Rendered-dist witness executed (§5): 0 corrupted `File:` links remain in
  `dist/baptisty-rossii/**`.

**2. ПРОВЕРЕНО (numbers, diff vs baseline)**

* Baseline `d14da74` → now: 5 files, **+12/−12 lines** (no other file touched; `git diff --stat`).
* Gates: `workflows:check`, `validate:strict`, `seo-audit`, `page-ownership:check`,
  `content:guard`, `data:consistency`, `editorial:lint`, `sources:hygiene`, `article:qa`,
  `baptisty:roadmap:audit`, `baptisty:authentic-media:audit` (16/16 items),
  `astro:audit:baptisty-series:no-build` — all PASS (§4).
* `strangler:build:production-like` exit 0; `grep -c 'File:?' dist/baptisty-rossii/*/index.html`
  → 0 everywhere; six canonical Commons URLs present in the emitted HTML (§5).
* Commons proof of identity for all six: `size`/`sha1`/`pageid` equal to the archived originals
  (§3).

**3. НЕ ПРОВЕРЕНО**

* Live HTTP status of the six repaired URLs is not verified — sandbox egress returns
  `ECONNRESET` for every non-allowlisted host, so the local link audit reproduces only the
  transport class, not the 404 class. The Commons `imageinfo` byte-identity check is the
  strongest available substitute.
* The CI `source-links` job result for this branch: no run existed at report time.

**4. СРЕДА**

* 2 vCPU / 3 GB RAM; general outbound internet from bash is blocked (Commons API reachable only
  through the fetch-page tool); `gh` works for GitHub; `node_modules` restored with `npm ci`.
* Baseline cleanliness honoured: the 15 pre-existing CI hard errors and the 161 remaining
  corrupted lines are reported, not silently patched.

**5. РЕШЕНИЯ САМ (judgement calls, no confirmation asked)**

* Repaired only the six `sourceUrl`/ledger cells — the only part of the 167-line corruption
  that is *mechanically provable* (SHA-1 → exact Commons title). Prose/alt text (161 lines)
  needs the author's words, so it is documented as a backlog rather than invented.
* Did not touch `.github/`, dependencies, `main`, and did not delete/merge/close any branch
  or PR (§7 lists the proposed cleanup of the eight zero-commit branches for the owner).
* Kept #2161/#2162-#2168 out of this PR although both were verified as still current on
  `main`: separate clusters ⇒ separate lanes.

**6. ВЕТКА / SHA / PR / CI**

* Branch `arena/fbf6f1fd-gb-is-my-strength`: `b31b76545` (repair + this report) and `c9b27b15e`
  (drop blank line at EOF, §1.1); base/rollback = `d14da74cfe9f45e9b03e383e8e622695b01f8e16`
  (untouched `main`).
* PR **#2183** (draft, `arena/fbf6f1fd-gb-is-my-strength` → `main`), body = this section.
  Draft on purpose: the agent does not merge or close its own PR.
* CI at report time: `source-links` red since run 34693183399 (2026-09-12), last green
  34098490942 (2026-09-07 @ `99a7b9a7d6`); recovery criterion `0 hard errors` +
  `systemicTransportFailure:false`.

**7. ЧТО ДЕЛАТЬ МНЕ (owner)**

1. Merge/allow PR #2183, then trigger the upstream verdict: **`workflow_dispatch` on
   `Source Link Audit`**, or wait for the Monday 03:00 schedule — the six URLs cannot be probed
   from the PR itself (§1.1.2). `0 hard errors` + `systemicTransportFailure:false` from that run
   closes the link half of the red audit.
2. Decide the nine remaining hard errors individually (§6): three expired TLS `pravenc.ru` +
   one `sedmitza.ru` (re-point or archive), `amazon B0HKZ7JDV9`, `tennessean` HTTP 402,
   `ecfa.org` RZIM page (dead upstream).
3. Approve the next cleanup batch (eight zero-commit branches, §7) or ask for classification of
   the other 16 no-PR branches first.
4. Decide on the 161 mojibake prose/alt lines — recovery path in §6.2, but the text needs the
   original wording (author).
