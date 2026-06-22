# Audit History — gospod-bog.ru

> All audit changelogs consolidated into one file.
> Last updated: 2026-06-10

---

## v70 — Hebrew hero font restore + hover clipping fix (2026-06-10)

### What was improved:
- Restored the home Habakkuk 3:19 Hebrew hero to the intended serif Hebrew stack by forcing `--f-hebrew-display` back to `Noto Serif Hebrew` first. This removes the later sans override that appeared after page load.
- Explicitly set Russian hover translations to the site body/display serif (`Cormorant Garamond`) instead of inheriting Hebrew fonts.
- Prevented long hover translations from being clipped by making `.h-sacred-block .hb-w` overflow visible and raising hovered/toggled words above neighbors.
- Kept the visual hover/click translation effect intact while retaining the readable `sr-only` Habakkuk summary and `aria-hidden` decorative layer.
- Extended `readable-audit` to guard the Hebrew display font and no-clipping contract.

### Verified:
- Playwright computed-style probe → ✅ `.hb-front` uses `Noto Serif Hebrew`; `.hb-back` uses `Cormorant Garamond`; hover translation visible with `overflow: visible`.
- `npm run readable-audit` → ✅ PASS.

---

## v69 — Home positioning + Habakkuk readable fallback (2026-06-10)

### What was improved:
- Repositioned the home page away from the too-narrow label “богословская библиотека” toward a more accurate and quieter identity: materials for studying Scripture.
- Updated home page visible/SEO wording:
  - hero tagline: `Для изучения Писания`;
  - description: `Материалы для вдумчивого изучения Писания: экзегеза, богословие, апологетика, переводы, биографии и непростые вопросы`;
  - search labels: `по материалам сайта`;
  - nav/about labels: `О проекте`.
- Updated `/about/` wording from “долгая богословская библиотека” to “собрание материалов для изучения Писания”.
- Made the decorative Hebrew Habakkuk 3:19 hero layer `aria-hidden="true"` and removed focusable `tabindex=0` descendants, while preserving hover/click visual translation effects.
- Added a separate `.sr-only` readable verse summary for assistive/readable layers.
- Extended `readable-audit` with home positioning and Habakkuk-readable guards.
- Updated `audit-pro` unified header contract to use `О проекте`.

### Verified:
- Playwright hover probe on Hebrew hero words → ✅ visual translation effect still works.
- `npm run validate:publication` → ✅ PASS.
- `npm run visual-audit` → ✅ PASS.
- `npm run readable-audit` / `data:consistency` / `editorial:lint` → ✅ PASS.

---

## v68 — Workflow policy guard + local CI parity (2026-06-10)

### What was improved:
- Added `scripts/check-workflows.js` + `npm run workflows:check`.
- The workflow policy guard verifies:
  - every workflow has name/on/permissions;
  - deploy and indexnow keep `npm run validate:static-publication`;
  - source link audit remains manual+scheduled and runs `npm run source:links`;
  - runtime interactive audit remains manual+scheduled, installs Chromium, starts a local server and runs `npm run interactive-audit`;
  - notify-on-failure listens for source link and runtime audit failures.
- Updated `ci:check` so local CI parity is now: `cache-bust + validate:static-publication + workflows:check`.
- Added top-level `permissions: contents: write` to `indexnow.yml` so workflow policy is explicit at file level.
- Updated AGENTS/README with the workflow policy contract.

### Verified:
- `npm run workflows:check` → ✅ PASS.
- `npm run ci:check` → ✅ PASS.

---

## v67 — CI/workflow publication gates (2026-06-10)

### What was improved:
- Added blocking static publication gates to GitHub workflows:
  - `indexnow.yml` now runs `npm run validate:static-publication` after metadata/cache-bust and before auto-commit / IndexNow payload;
  - `deploy.yml` also runs `npm run validate:static-publication`, covering asset-only/manual deployments that bypass IndexNow.
- Added scheduled/manual network/runtime workflows:
  - `.github/workflows/source-links.yml` runs `npm run source:links` weekly/manual;
  - `.github/workflows/interactive-audit.yml` installs Playwright Chromium, starts a local server and runs `npm run interactive-audit` weekly/manual.
- Extended `notify-on-failure.yml` so source-link and runtime-interactive failures open/update GitHub issues just like deploy/indexnow failures.
- Added `validate:static-publication` script so CI can run all deterministic static gates without requiring a browser server.

### Verified:
- `npm run validate:static-publication` → ✅ PASS.
- `npm run source:links` → ✅ hard-check PASS (warnings only for known bot-block/rate-limit/timeout cases).
- `npm run interactive-audit` → ✅ PASS locally.
- `node scripts/audit-pro.js` → ✅ PASS.

---

## v66 — Source-link audit + stronger data consistency (2026-06-10)

### What was improved:
- Added `scripts/source-link-audit.js` + `npm run source:links` / `npm run validate:external`.
- The source-link audit checks external `<a href>` URLs and hard-fails browser-invalid source links: malformed URLs, TLS/certificate errors, known bad hosts (for example `arthistoryresources.net`), non-allowlisted `http://`, and HTTP 404/410. Bot blocks and rate limits (403/405/429/timeouts/5xx) are reported as warnings for manual review.
- Strengthened `scripts/check-data-consistency.js` beyond reading time:
  - search-manifest id/url uniqueness;
  - required local image existence;
  - no control characters in manifest/series titles;
  - `generatedAt` not older than newest manifest `modifiedTime`;
  - article search title vs H1 drift heuristic.
- Updated `data/search-manifest.json` generatedAt and Nagornaya part titles to match current public H1s.
- Documented data/source checks in README/AGENTS.

### Verified:
- `npm run data:consistency` → ✅ PASS.
- `npm run source:links` → ✅ hard-check PASS (warnings only for known bot-block/rate-limit/timeout cases).
- `npm run validate:publication` → ✅ PASS.

## v65 — Editorial tone lint + publication-Russian cleanup (2026-06-10)

### What was improved:
- Added `scripts/editorial-lint.js` + `npm run editorial:lint` and included it in `validate:publication`.
- Cleaned exact high-risk publication phrases flagged by the GPT reader audit:
  - Da Vinci: `БРАУН` → `В романе`, `НА САМОМ ДЕЛЕ` → `По источникам`, `Самые грубые ошибки Брауна` → `Ключевые исторические ошибки романа`, `Бонус: ляп` → `Показательный анахронизм`;
  - pastor-series / 20-antisovetov: replaced prominent `пасторские патологии` / `диагностическая рамка` wording with more pastoral language about `искажения пастырской власти`, `библейское зеркало`, подотчётность and restoration;
  - Nagornaya/Gill: softened exact overheated phrases such as `меняет правила игры`, `кромсавшие`, `сокрушительный`.
- Kept the lint surgical: exact known-risk phrases only, not broad bans on legitimate theological or pastoral terms.

### Verified:
- `npm run editorial:lint` → ✅ PASS.
- `npm run validate:publication` → ✅ PASS.
- `npm run visual-audit` → ✅ PASS (52 contexts / 156 screenshots / 0 console / 0 network / 0 unsuppressed).

---

## v64 — Reading-time data consistency sync + guard (2026-06-10)

### What was improved:
- Synchronized reading time across public HTML, `data/search-manifest.json` and `data/series.json` for article pages and series landings.
- Fixed visible/readable drift examples:
  - `20-antisovetov`: 67 min consistently;
  - `Krajne`: 41 min consistently;
  - `Romans 7`: 18 min consistently;
  - `Da Vinci`: 28 min consistently;
  - `Nagornaya` parts and Gill series totals now match their source parts.
- Added `scripts/check-data-consistency.js` + `npm run data:consistency`.
- Extended `validate:publication` so it now runs validate, tokens, audit-pro, readable-audit, data consistency and interactive-audit.

### Verified:
- `npm run data:consistency` → ✅ PASS.
- `npm run readable-audit` → ✅ PASS.
- `npm run validate:publication` → ✅ PASS.

## v63 — Readable/publication layer cleanup + guard (2026-06-10)

### What was improved:
- Added `scripts/readable-audit.js` + npm scripts:
  - `npm run readable-audit`,
  - `npm run validate:publication`.
- Cleaned reader/plain-text layer issues:
  - summary-card decorative numbers are now empty `aria-hidden` spans with `data-num`; visual numbers are CSS-generated, so reader/screen-reader text no longer says `01/02/03`;
  - home H1 now reads `Господь Бог — Сила Моя` in `innerText`;
  - Da Vinci badge changed from overclaiming `Проверено историками` to `С опорой на исторические источники`;
  - Nagornaya source stats labels changed from internal enum labels (`Book`, `Confession`, `ChicagoDoc`, `Father`, `Academic`, `Warning`) to Russian public labels;
  - bibliography separator dots on Nagornaya sources changed to spaced dashes for cleaner reader text.
- Added readable guards for raw visible image-path leaks, summary decorative numbers, home H1 spacing, Da Vinci overclaim badge, enum labels and obvious punctuation-spacing risks.
- Updated AGENTS/README with the readable/publication contract.

### Verified:
- `npm run readable-audit` → ✅ PASS.
- Playwright `innerText` spot-check on `/`, Nagornaya pages, Da Vinci, Krajne → ✅ no `/images` leak, no summary `01` text, home H1 spaced.
- `npm run validate:publication` → ✅ PASS.
- `npm run visual-audit` → ✅ PASS.

---

## v62 — Image viewer + share dialog interactive coverage (2026-06-10)

### What was improved:
- Extended `scripts/interactive-audit.js` with media/share runtime checks on long article pages.
- New checks verify:
  - article image click opens `.img-viewer`;
  - image viewer locks scroll and closes via Escape with overflow restored;
  - `#articleEndShareBtn` opens `#share-dialog-overlay`;
  - share dialog has interactive buttons and closes via Escape;
  - share canonical URL is not preview/local.
- Updated AGENTS/README with the media/share runtime contract.

### Verified:
- `npm run interactive-audit` → ✅ PASS (`media: 2`).
- `npm run validate:all` → ✅ PASS.
- `npm run tokens:check` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS.

---

## v61 — Search keyboard shortcuts hardening (2026-06-10)

### What was improved:
- Fixed command palette keyboard shortcut: `Ctrl/⌘+K` is now case-insensitive (`String(e.key).toLowerCase() === 'k'`), so Chromium/Playwright `key="K"` no longer breaks opening.
- Preserved native browser search: `Ctrl/⌘+F` is not prevented and does not open the command palette.
- Changed Escape behavior inside command palette input to close the palette consistently, matching the footer hint “esc закрыть”.
- Extended `interactive-audit.js` with search checks across home, article, hard-texts article and Nagornaya page:
  - `Ctrl+F` not defaultPrevented and palette remains closed;
  - `Ctrl+K` opens palette and focuses input;
  - query `Гилл` renders results;
  - `Escape` closes.
- Added `audit-pro.js` G112 static guard for the keyboard-search contract.
- Updated AGENTS/README with the search shortcut rule.

### Verified:
- `npm run interactive-audit` → ✅ PASS (`search: 4`).
- `npm run validate:all` → ✅ PASS.
- `npm run tokens:check` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS.

---

## v60 — Meta hygiene guards: article author + 404 social/canonical (2026-06-10)

### What was improved:
- Fixed missing `<meta property="article:author">` on `articles/dzhon-gill-istoricheskiy-kontekst/`.
- Fixed the same article-author meta gap on `nagornaya/seriya/`, which declares `og:type=article`.
- Added canonical URL and OG/Twitter image alt text to `404.html` while keeping it `noindex, nofollow`.
- Added `audit-pro.js` guards:
  - G110: every `og:type=article` page must have `article:author`;
  - G111: `404.html` must keep canonical + `og:image:alt` + `twitter:image:alt`.

### Verified:
- `npm run validate:all` → ✅ PASS.
- `npm run tokens:check` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (**151 passed / 0 warnings / 0 errors**).
- `npm run interactive-audit` → ✅ PASS.

---

## v59 — Visual audit coverage expansion for Gill / catalogs / Rim7 (2026-06-10)

### What was improved:
- Expanded `scripts/visual-audit.js` URL coverage from 16 URLs to 26 URLs.
- Newly covered pages include:
  - `/biografii/`, `/hard-texts/`;
  - all 5 Gill cluster pages (`context`, `part I`, `part II`, `part III`, `spravochnik`);
  - `rimlyanam-7-veruyushchiy-ili-neveruyushchiy`;
  - `/nagornaya/istochniki/`, `/nagornaya/nakhodki/`.
- Visual QA now runs **26 URLs × 2 viewports = 52 page/viewport contexts** and takes **156 screenshots**.
- Kept `interactive-audit` as the click/runtime guard for series dropdown, quizzes, glossary and mobile theme; `visual-audit` remains screenshot/console/network coverage.
- Updated AGENTS/README count documentation.

### Verified:
- `npm run visual-audit` → ✅ PASS (**52 page/viewport runs, 156 screenshots, 0 console errors, 0 network errors, 0 unsuppressed visual bugs**).
- `npm run interactive-audit` → ✅ PASS.
- `npm run validate:all` → ✅ PASS.
- `npm run tokens:check` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS.

---

## v58 — Mobile theme control restoration + interactive guard (2026-06-10)

### What was improved:
- Restored visible mobile theme control on article pages that use the canonical floating controls: `.gb-fc-theme` remains visible even when `body.has-bottom-bar` exists.
- Added coarse-pointer minimum hitbox protection for floating control buttons.
- Added a late bottom-bar theme bridge in `js/site.js`: if `#barThemeBtn` is created after the core theme module cached controls, the bridge toggles/persists theme only when the original listener did not already do so.
- Extended `scripts/interactive-audit.js` with mobile theme checks: visible control, click toggles `html.dark`, reload persists selected theme.
- Updated AGENTS/README with the mobile theme-control contract.

### Verified:
- `npm run interactive-audit` → ✅ PASS (`theme: 6`).
- `npm run validate:all` → ✅ PASS.
- `npm run tokens:check` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS.

---

## v57 — Series strip dropdown hitbox repair + interactive audit (2026-06-10)

### What was improved:
- Fixed `gb-strip` dropdown click regression: `.gb-strip__toggle` no longer contains anchor dots. The toggle now opens the dropdown; `.gb-strip__dots` links live as siblings and still navigate when clicked directly.
- Added CSS hitbox stability for the strip and FAQ blocks: collapsed FAQ bodies no longer intercept clicks above the visible page, and strip center/dropdown has an explicit layer.
- Added `audit-pro.js` G109: no nested interactive controls inside `<button>` and no anchors inside the series toggle template.
- Added `scripts/interactive-audit.js` + `npm run interactive-audit` covering:
  - series dropdown open/close without URL navigation on Gill + hard-texts series;
  - quiz launch renders question/options;
  - glossary smoke and summary no-glossary check.
- Updated AGENTS/README with the series strip and interactive QA rules.

### Verified:
- Playwright series probe on 7 series pages → ✅ URL unchanged, dropdown visible, outside click closes, no anchors inside toggle.
- `npm run interactive-audit` → ✅ PASS.
- `npm run validate:all` → ✅ PASS.
- `npm run tokens:check` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (**149 passed / 0 warnings / 0 errors**).

---

## v56 — Quiz runtime mount repair for Da Vinci + Krajne (2026-06-10)

### What was improved:
- Fixed two user-facing broken quizzes: `articles/kod-da-vinchi/` and `articles/krajne-li-isporcheno-serdce/`.
- Replaced legacy hand-written `#quizWrapper` blocks with the canonical runtime mount `<div id="quizPlaceholder"></div>` so `site.js` can generate the full quiz DOM consistently.
- Added `audit-pro.js` G108: if a page enables quiz and declares `SITE_CONFIG.quiz.questions`, `#quizPlaceholder` is required.
- Updated `AGENTS.md` with the quiz mount contract so future agents do not reintroduce manual wrappers.

### Verified:
- Playwright quiz probe on Da Vinci / Krajne / Gill Part I → ✅ `#quizQuestion` non-empty and `.quiz-option` renders after `#quizLaunch` click.
- `npm run validate:all` → ✅ PASS.
- `npm run tokens:check` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (**148 passed / 0 warnings / 0 errors**).

---

## v55 — Hermeneutics source-tooltip DOM repair (2026-06-10)

### What was improved:
- Repaired the Chou / hermeneutics article source-tooltip DOM corruption: 62 nested `.fn-marker` / `.tooltip` chains were flattened.
- Restored swallowed main text from source tooltips back into visible article prose, including the opening “meaning/significance” definitions and later footnote-heavy sections.
- Strengthened `audit-pro.js` G104 from a fragile regex into a lightweight span-stack parser that catches:
  - `.tooltip .fn-marker`,
  - `.tooltip .tooltip`,
  - `.fn-marker .fn-marker`.
- Updated `AGENTS.md` to lock the flat source-tooltip DOM rule.

### Verified:
- Static DOM check → ✅ `.tooltip .fn-marker = 0`, `.tooltip .tooltip = 0`, `.fn-marker .fn-marker = 0`.
- Playwright probe on hermeneutics → ✅ 116 footnotes, 0 nested tooltip nodes, visible body text restored, sampled source tooltips open with non-zero dimensions.
- `npm run validate:all` → ✅ PASS.
- `npm run tokens:check` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (**147 passed / 0 warnings / 0 errors**).

---

## v54 — Glossary tooltip stability + summary-card cleanup guard (2026-06-10)

### What was improved:
- Investigated owner-reported Gill glossary popup regression with real screenshots and Playwright reproduction.
- Fixed glossary card layout so desktop `.gtip-luxury` content is rendered as a solid block card instead of inline-flow fragments that caused clipped/scrollbar-looking popups.
- Prevented future glossary auto-hydration inside `.summary-card`: summary blocks are now plain minimal text, without dotted glossary underlines or interactive tooltips.
- Added `audit-pro.js` guards:
  - G106: summary cards must not contain active `.gterm` / `.gtip` glossary markup;
  - G107: `js/glossary.js` must explicitly skip `.summary-card` in both auto-hydration and manual hydration.
- Updated `AGENTS.md` with a hard lock for summary-card / tooltip behaviour.

### Verified:
- `npm run validate:all` → ✅ PASS.
- `npm run tokens:check` → ✅ PASS (`0 / 0` legacy vars).
- `node scripts/audit-pro.js` → ✅ PASS (**145 passed / 0 warnings / 0 errors**).
- Playwright glossary probe across Gill context / Gill Part I / Krajne → ✅ no summary gterms, visible opaque glossary cards, no clipped block layout.
- `npm run visual-audit` → ✅ 32 page/viewport, 96 screenshots, 0 console errors, 0 network errors, 0 unsuppressed visual bugs.

---

## v53 — Primary-source marathon: Da Vinci / Gill / Krajne / Nagornaya + probe guards (2026-06-10)

### What was improved:
- Ingested and audited the external `MASTER-SOURCE-RESEARCH-2026-06-08` gist corpus (`pass-001` through `pass-027`, ~10k lines) as the working map for source hardening.
- Applied a sequence of small verified source-fix batches:
  - Da Vinci Code: source apparatus rebuilt; CNN transcript used as the primary proof for Brown’s “99 percent” claim; Today Show “Absolutely all of it” removed as public proof until manual video transcription; BAS Nag Hammadi hotlink replaced; image captions tightened; commercial stats tied to PRH/Britannica/CSMonitor/BoxOfficeMojo.
  - John Gill: Goat Yard Declaration table fixed; Toon Wayback links canonicalized; Clarendon/Test Acts corrected; Dissenting Academies/Morton/Watts issue fixed; Salters’ Hall wording nuanced; America/Carey/Brown/Manning/Bunhill/Spurgeon claims softened or sourced.
  - Krajne: Piper date fixed; Beeke/Washer unpinned quotations removed; Berkhof exact-quote overclaim replaced with CCEL-supported paraphrase; Murray page claims softened pending edition-level verification; Bavinck identity language nuanced.
  - Nagornaya: Q/Papias/Chicago/ipsissima vox overclaims softened; Free Grace/Lordship wording corrected; Part IV inerrancy rhetoric and Aramaic/Greek claims nuanced; generic TMS archive links replaced by direct PDFs.
- Fixed owner-reported source/link bugs:
  - replaced SSL-bad `arthistoryresources.net` Gregory Homily 33 link with a stable Roger Pearse page pointing to Homily 33 / PL 76 locus and noting sermon ≠ decree;
  - corrected broken Gill Part I sentence around Corporation Act / Test Acts / civil disabilities.
- Added `audit/source-research-ingestion-2026-06-10.md` as the working source-marathon ledger.
- Added audit-pro guards:
  - `G104 nestedSourceTooltipGuard` — blocks `.fn-marker` nested inside `.tooltip` source apparatus;
  - `G105 knownBadExternalSourceHostGuard` — blocks known SSL/browser-bad source hosts such as `arthistoryresources.net`.

### Verified:
- `npm run validate:all` → ✅ PASS.
- `npm run tokens:check` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (**145 passed / 0 warnings / 0 errors / 8 info**).
- `npm run visual-audit` → ✅ PASS (**32 page/viewport runs, 96 screenshots, 0 console errors, 0 network errors, 0 unsuppressed visual bugs**).

---

## v52 — John Gill UI polish pass: remove trilogy context-bridge + ordinary summary-card upgrade (2026-06-10)

### What was improved:
- Re-checked the whole John Gill cluster again after v51: documentation, all 5 Gill pages, portrait/vertical images, DOM placement, catalog cards and summary blocks.
- Removed the redundant `context-bridge` block («Исторический фон серии…») from the Gill trilogy pages (`chast-1`, `chast-2`, `chast-3`) after owner review. The links remain available through the series strip and catalogs, so the block was pure duplication.
- Added a focused summary-card polish for **ordinary articles only**:
  - non-Nagornaya article summaries now have a subtle framed card,
  - clearer spacing,
  - visible numbered badges instead of the previous generic checkmark treatment,
  - better first-screen editorial hierarchy on long biography pages.
- Kept Nagornaya’s summary-card untouched via `body:not(.nagornaya-page)` scoping, so the Tailwind-driven Nagornaya rhythm remains intact.
- Re-verified that Gill portrait / 9:16 images remain correctly classed with `article-img--vertical` and are not returning as buggy huge standalone portraits.
- Added an AGENTS lock forbidding future reintroduction of the trilogy `context-bridge` block.

### Verified:
- `npm run validate:all` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (**142 passed / 0 warnings / 0 errors**).
- Browser re-check (desktop + mobile, headless Chromium) → ✅ no overflow, no trilogy `context-bridge`, ordinary summary-card visually upgraded, Nagornaya summary-card unchanged, all Gill portrait images correctly classed.

---

## v51 — John Gill self-audit: image truth-lock + stale preload cleanup (2026-06-10)

### What was improved:
- Per owner request, re-audited the full John Gill cluster end-to-end: documentation, all 5 Gill pages, `/`, `/biografii/`, `/articles/`, metadata and browser rendering.
- Fixed a secondary markup regression in `dzhon-gill-chast-1-chelovek`: the restored birth-date dove footnote marker had been left semantically open and was swallowing the rest of the paragraph.
- Rewrote the `gill-kettering-1697` alt/caption so it describes the **actual** approved image (early Kettering domestic/remeslennaya setting) rather than a generic “town / workshops / church spire” label or the previously broken funeral caption.
- Translated Gill’s baptism hymn into Russian in Part I and kept the English original inside `<details>`.
- Removed a stale Part III preload for `gill-wesley-letters.jpg` that no longer corresponds to rendered content.
- Corrected Part III image truthfulness:
  - `gill-spurgeon-succession` now described as a **symbolic succession / pulpit** scene, not a literal portrait of Spurgeon;
  - `gill-bunhill-fields` now described as a **funeral procession / memorial engraving**, not an empty cemetery view.
- Fixed invalid nested `<picture>` markup in `dzhon-gill-istoricheskiy-kontekst`.
- Added AGENTS-r92 editorial locks so future agents do not blindly trust Gill filenames when writing `alt` / `figcaption`, and do not restore old images merely because a filename sounds “more accurate.”

### Verified:
- `npm run validate:all` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (**142 passed / 0 warnings / 0 errors**).
- Browser re-check (desktop + mobile, headless Chromium) → ✅ overflow-free, no stale Gill preload, no nested `<picture>`, corrected captions visible in DOM.

---

## v50 — Critical span regression fix + dove/digit split (2026-06-08)

### CRITICAL FIX — 464 unclosed `<span>` tags restored

Regression from commit `7f16c2c` (AGENTS-r15.7, "Absolute reset of tooltips") deleted all `</span>` closings from fn-marker+tooltip pairs in 8 article files. Last clean commit: `6820076` (Gill cleanup I).

Fixed using a nesting-aware algorithm that correctly handles nested footnotes (e.g. kod-da-vinchi snoska 21 containing snoska 22 inside its tooltip).

| File | Unclosed spans | After fix |
|---|:---:|:---:|
| hermenevtika | 245 | 0 |
| kod-da-vinchi | 95 | 0 |
| gill-chast-3 | 36 | 0 |
| gill-chast-2 | 28 | 0 |
| gill-chast-1 | 27 | 0 |
| gill-spravochnik | 17 | 0 |
| 20-antisovetov | 15 | 0 |
| gill-kontekst | 1 | 0 |
| **TOTAL** | **464** | **0** |

### Dove/digit footnote split (§9.12)

Per owner requirement: digit footnotes for source references, dove footnotes for editorial notes only.

- **205 digit footnotes** restored (hermenev 114, kodvinchi 24, gill1 7, gill2 6, gill3 8, krajne 38, rim7 8)
- **38 dove footnotes** kept (20-antisovetov: 36, hermenev: 1 †, gill1: 1)
- AGENTS §9.12 added with explicit rules per article type

### Guards added

- `audit-pro.js`: span balance check (threshold >20 catches mass deletion, currently 47 checks)
- `validate.js`: French/accented text excluded from Russian quote policy (false positive fix)

### Also

- `sitemap.xml` lastmod updated to 2026-06-08
- `docs/OWNER-REQUIREMENTS.md` created (consolidated owner requirements from chat)

### Verified

- `npm run validate:all` → ✅ PASS
- `node scripts/audit-pro.js` → ✅ **47 passed / 0 warnings / 0 errors**
- CSS braces: 1783/1783 ✅
- `!important`: 196 ≤ 200 ✅
- Playwright: 10 pages × light/dark, 0 JS errors, 0 visual bugs

---

## v49 — User-reported visual regression pass II + ambient phrases editorial (2026-06-08)

### CRITICAL — site.css cascade restored
- Previous `49882d9 «fix(bugs): close malformed spans + flatten tooltip card»` claimed to balance 151 unclosed braces but inserted them in wrong positions, leaving the file parseable only as **one top-level rule with 19 cssRules** (vs. the expected ~1222).
- Symptoms reported by owner: half of pages rendered without core CSS, fonts fell back to Times New Roman, share icons rendered as gigantic blue squares, theme/search controls collapsed.
- Fix: rebased `css/site.css` on the last fully-clean baseline (`32e8c63`, 1703/1703 braces, 194 `!important` — back inside PLAN-04 ≤200 budget) and re-appended the final clean `.fn-marker--dove` ruleset (FontAwesome 6.7 dove glyph + light/dark variants + hover lift).
- The previously-added structural guard in `audit-pro.js` (`css brace balance`) now catches any future regression of this kind.

### Editorial fixes
- All 31 ambient phrases on the home page (10 Greek, 10 Latin, 11 Hebrew) re-translated for theological precision: Solus Christus → «Только Христос», Dominus illuminatio mea → «Господь — свет мой» (Пс. 26:1), Ego sum via veritas et vita → «Я есмь путь и истина и жизнь» (Ин. 14:6), τὸ ἄλφα καὶ τὸ ὦ → «Альфа и Омега» (Откр. 1:8), ὁ ὢν καὶ ὁ ἦν καὶ ὁ ἐρχόμενος → «Который есть и был и грядёт», אוֹר לְרַגְלִי דְבָרֶךָ → «Светильник ноге моей — слово Твоё» (Пс. 118:105), etc.
- Each phrase now has a `.h-phrase-source` micro-citation rendered on hover beneath the translation label (e.g. «Ин. 1:1», «Реформ. solae», «Быт. 1:1 LXX», «Тосефта Сангедрин 13:2»). Minimal styling, uppercase tracking, mutes to ~70% opacity; never overlaps the main phrase glyph.
- `dzhon-gill-istoricheskiy-kontekst`: replaced second Whitefield image (was visually a duplicate of the first «open field» scene) with a freshly generated «Kennington Common ~1739» — Whitefield on a wooden preaching scaffold, crowd in tricorn hats, St Paul’s dome and a windmill on the London skyline. Full 600/900/1200w webp + jpg fallback per AGENTS §3.6.

### Catalog layout
- `/biografii/` Gill series re-ordered per user request: was `[контекст, справочник, ч.1, ч.2, ч.3]`, now **`[контекст, ч.1, ч.2, ч.3, справочник]`** — reflects natural reading flow (context → biography → reference).
- `/articles/` Gill: «справочник» was first; now `контекст → справочник`.
- Introduced `.h-article-list--grid` modifier on `home.css`: a compact 2-column grid for single articles. Series cards keep full width via `.h-article-li--full`. Mobile collapses cleanly to 1 column. Catalog stays scannable as the corpus grows past 30 articles.
- Removed inline `style="padding-top:0"` overrides on `<section id="razbor">` (both `index.html` and `articles/index.html`) — restored the canonical 56px breathing room defined by `.h-section`.

### Verified
- `node scripts/validate.js` → ✅ clean.
- `node scripts/audit-pro.js` → ✅ **36 passed / 0 warnings / 0 errors** (CSS brace guard ✅, dove integrity ✅, `!important` 194 ≤ 200 ✅).
- Playwright sweep (Chromium 1223, desktop 1366×900 + mobile 390×844, 7 key pages × 3 fold positions = 42 screenshots): cascade restored, fonts loaded, theme/search FAB renders as two separate pill-buttons (no frame), Gill-1 typography restored, articles grid responsive, ambient hover reveals translation + source without overlap.

---

## v47 — Source verification pass + Russian-quote policy (2026-06-06)

### What was improved:
- Added a project-wide rule to `AGENTS.md` and `README.md`: Russian articles must not contain English direct quotations in reader-facing prose. English book/article titles, URLs, DOI and bibliographic identifiers remain allowed; quoted thoughts and direct speech must be translated into Russian with a link to the original source.
- Added automated Russian quote policy guards to `scripts/validate.js` and `scripts/audit-pro.js`; these checks also inspect quiz strings from `SITE_CONFIG`.
- Added `docs/EDITORIAL-SOURCE-POLICY.md` as the single editorial/source policy document for language, citations, primary sources, theological positioning and translation standards.
- Updated current README/AGENTS references to `audit-pro`: the main audit now has 36 checks after the Russian quote guard.
- Replaced remaining English direct-quote fragments in the Nagornaya series and Gill materials with Russian translations while preserving English bibliographic titles and source links.
- Continued the source-verification wave across key articles: TMSJ, GTY, Ligonier, Internet Archive, PRDL, CCEL, JETS and other primary/near-primary sources were linked where relevant.
- Added and maintained `audit/content-source-audit-2026-06-06.md` as the running source-audit log.

### Verified:
- `npm run validate:all` → PASS.
- `node scripts/audit-pro.js` → PASS (**36 passed / 0 warnings / 0 errors**).

---

## v46 — Editorial premium pass III: long-form prose polish on four key articles (2026-06-04)

### What was improved:
- Continued the full editorial polish with a direct prose pass on the longest, highest-impact articles:
  - `20-antisovetov-pastoru`
  - `kod-da-vinchi`
  - `krajne-li-isporcheno-serdce`
  - `rimlyanam-7-veruyushchiy-ili-neveruyushchiy`
- Rewrote several high-visibility opening and concluding paragraphs to make them:
  - less mechanically generated in tone,
  - more syntactically balanced,
  - more pastorally precise,
  - and more publication-ready in Russian style.
- Examples of polish in this pass:
  - `20-antisovetov`: opening frame and conclusion made less slogan-heavy and more analytically sober.
  - `kod-da-vinchi`: introduction tightened; conclusion made more direct and less repetitive.
  - `krajne`: opening thesis and conclusion made smoother and less abrupt.
  - `rimlyanam-7`: framing question and pastoral application sharpened for clarity and pastoral usefulness.
- This pass intentionally focused on reader experience rather than architecture: the goal was to move these articles from “technically solid” to “editorially confident.”

### Verified:
- `npm run validate:all` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (**35 passed / 0 warnings / 0 errors**).
- `AUDIT_BASE=http://127.0.0.1:8080 npm run visual-audit` → ✅ PASS.

---

## v45 — Editorial premium pass II: author-card refinement + full quiz backlink completion (2026-06-04)

### What was improved:
- Completed the last remaining quiz backlink gaps on the Gill trilogy and the final missing Hermeneutics question.
- Result: **all 96 quiz / bonus questions site-wide now include `sourceRef`**.
- Performed a second editorial polish pass on high-visibility article metadata / support copy:
  - refined `author-card-desc` across the John Gill trilogy,
  - refined `author-card-desc` in `dzhon-gill-istoricheskiy-kontekst`,
  - refined `author-card-desc` in `dzhon-gill-spravochnik`,
  - refined `author-card-desc` in `kod-da-vinchi`,
  - refined `author-card-desc` in `krajne-li-isporcheno-serdce`,
  - expanded the terse `author-card-desc` in `rimlyanam-7-veruyushchiy-ili-neveruyushchiy`,
  - polished the translator/editor note in `hermenevtika` to read less mechanically,
  - refined one awkward attribution line in `dzhon-gill-chast-2-uchenyi`.
- Goal of this pass: make the site read more like a finished editorial publication and less like a technically correct draft.

### Verified:
- `npm run validate:all` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (**35 passed / 0 warnings / 0 errors**).
- `AUDIT_BASE=http://127.0.0.1:8080 npm run visual-audit` → ✅ PASS.

---

## v44 — Editorial premium pass: remaining quiz backlinks + article copy polish (2026-06-04)

### What was improved:
- Added missing `sourceRef` backlinks to the remaining pages that still had canonical questions without section references:
  - `dzhon-gill-chast-1-chelovek`
  - `dzhon-gill-chast-2-uchenyi`
  - `dzhon-gill-chast-3-nasledie`
  - `hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki` (final missing question)
- Result: **all 96 quiz / bonus questions site-wide now have `sourceRef`**.
- Polished article prose and metadata in a few high-visibility places:
  - improved `author-card-desc` in `dzhon-gill-istoricheskiy-kontekst`
  - improved `author-card-desc` in `dzhon-gill-spravochnik`
  - normalized one awkward attribution line in `dzhon-gill-chast-2-uchenyi`
  - cleaned the remaining `hreflang` editorial placeholder in `hermenevtika`
  - cleaned the remaining awkward keywords phrase in `dzhon-gill-spravochnik`
- This pass focused on quality-of-reading and editorial dignity rather than architecture, because the main technical debt and budgets were already resolved.

### Verified:
- `npm run validate:all` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (**35 passed / 0 warnings / 0 errors**).
- `AUDIT_BASE=http://127.0.0.1:8080 npm run visual-audit` → ✅ PASS after re-installing browser/system deps for the turn.

---

## v42 — Final polish after budget-pass: tighter 20-Antisovetov inline CSS + Playwright reconfirmation (2026-06-04)

### What was improved:
- Minified the remaining inline `<style>` island in `articles/20-antisovetov-pastoru/index.html` with a safe CSS minification pass.
- Result: inline-style payload reduced further from **12495** → **11569** bytes.
- Re-ran full Playwright audit after the inline-style minification to ensure no visual regressions.

### Playwright verification:
- **32 page/viewport runs**
- **96 screenshots**
- **0 console errors**
- **0 network errors**
- **0 unsuppressed visual bugs**

### Current headline state:
- `validate:all` → ✅ PASS
- `audit-pro.js` → ✅ PASS (**35 passed / 0 warnings / 0 errors**)
- Budget warnings fully eliminated
- Inline script blocks across audited HTML pages: **71**

---

## v41 — Budget-pass: asset minification + budgets fully green (2026-06-04)

### What was improved:
- Minified all shipped runtime JS assets with Terser:
  - `js/site.js`, `js/search.js`, `js/enhancements.js`, `js/bookmark-engine.js`, `js/highlights.js`, `js/glossary.js`, `js/site-utils.js`, `js/scroll-perf.js`, `js/series-cards.js`, `js/nagornaya-mobile-toc.js`, `js/sw-register.js`, `sw.js`
- Minified shipped CSS assets with clean-css:
  - `css/site.css`, `css/home.css`, `css/command-palette.css`, `css/mobile-hotfix.css`, `css/nagornaya-mobile-toc.css`, `fonts/fonts.css`
- Preserved architecture: still exactly **5 CSS + 11 JS** runtime files, no bundler introduced, no new runtime assets added.
- Removed another dead inline config script on the home page and merged split SITE_CONFIG/quiz blocks on article/nagornaya pages, reducing inline-script count further.

### Before / after (raw bytes)
| Asset | Before | After |
|---|---:|---:|
| `js/site.js` | 251,442 | 118,567 |
| `js/search.js` | 72,269 | 33,391 |
| `js/enhancements.js` | 36,558 | 19,022 |
| `css/site.css` | 265,805 | 196,191 |
| `css/home.css` | 51,083 | 40,866 |
| `css/command-palette.css` | 38,132 | 26,952 |

### Audit outcome
- **CSS total**: `432044` → **`331046`** ✅ within budget
- **JS total**: `468231` → **`231938`** ✅ within budget
- **Gzip wire size**: **122975 bytes total** (`CSS 59689 + JS 63286`)

### Browser verification
- Re-ran full Playwright audit after minification and config consolidation:
  - **32 page/viewport runs**
  - **96 screenshots**
  - **0 console errors**
  - **0 network errors**
  - **0 unsuppressed visual bugs**

### Verified:
- `npm run validate:all` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (**35 passed / 0 warnings / 0 errors**).
- `AUDIT_BASE=http://127.0.0.1:8080 npm run visual-audit` → ✅ PASS.

---

## v40 — Split SITE_CONFIG merge + validator hardening + Playwright re-check (2026-06-04)

### What was improved:
- Merged split `window.SITE_CONFIG` + follow-up `window.SITE_CONFIG.quiz = ...` patterns into a single canonical config script on:
  - `articles/20-antisovetov-pastoru/`
  - `articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/`
  - `nagornaya/chast-1`
  - `nagornaya/chast-2`
  - `nagornaya/chast-3`
  - `nagornaya/chast-4`
  - `nagornaya/chast-5`
- Result: inline script blocks across audited HTML pages dropped again **78 → 71**.
- Hardened `scripts/validate.js` further: `validateArticle()` now reads `page.section` from parsed `SITE_CONFIG` rather than brittle regex matching, so canonical JSON-style config blocks validate correctly.
- Continued shrinking the `20-antisovetov` inline-style island by stripping dead explanatory comments and collapsing whitespace:
  - **12940 → 12495 bytes**.
- Re-installed Playwright + Chromium and re-ran full visual audit after these structural changes.

### Playwright verification:
- Installed runtime packages: `npm install --no-save playwright`
- Installed browser: `npx playwright install chromium`
- Installed required system libs (`libnspr4`, `libnss3`, `libatk*`, `libcups*`, `libxdamage1`, `libxkbcommon0`, etc.)
- Full run result:
  - **32 page/viewport runs**
  - **96 screenshots**
  - **0 console errors**
  - **0 network errors**
  - **0 unsuppressed visual bugs**

### Verified:
- `npm run validate:all` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (33 passed / 2 warnings / 0 errors).
- `AUDIT_BASE=http://127.0.0.1:8080 npm run visual-audit` → ✅ PASS.

---

## v39 — Playwright runtime verification + home inline-script dedup (2026-06-04)

### What was improved:
- Installed Playwright locally (`npm install --no-save playwright`) and downloaded Chromium for real-browser QA.
- Installed missing system libraries required by headless Chromium (`libnspr4`, `libnss3`, `libatk*`, `libcups`, `libxdamage`, `libxkbcommon`, etc.).
- Ran full visual audit against a local HTTP server:
  - **16 pages × 2 viewports = 32 runs**
  - **96 screenshots**
  - **0 console errors**
  - **0 network errors**
  - **0 unsuppressed visual bugs**
- Removed a now-dead duplicated inline home-page mobile-menu controller from `index.html` because `js/site.js` already owns `hMobileMenuBtn / hMobileNav / hMobileBackdrop` globally.
- Result: total inline-script blocks across audited HTML pages dropped again (**79 → 78**), with no visual regressions in Playwright.

### Verified:
- `npm run validate:all` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (33 passed / 2 warnings / 0 errors).
- `AUDIT_BASE=http://127.0.0.1:8080 npm run visual-audit` → ✅ PASS.

---

## v38 — 20-Antisovetov comment-stripping pass (2026-06-04)

### What was improved:
- Performed a safe no-behavior-change trim on the remaining inline `<style>` block in `articles/20-antisovetov-pastoru/index.html`.
- Removed explanatory CSS comments and collapsed redundant blank lines inside that block.
- Result: the inline-style payload shrank from **12940** → **12495** bytes without changing runtime behavior or moving more rules into the global CSS budget.

### Verified:
- `npm run validate:all` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (33 passed / 2 warnings / 0 errors).

---

## v37 — 20-Antisovetov generic-style fallback to global CSS (2026-06-04)

### What was improved:
- Continued shrinking the remaining inline `<style>` island in `articles/20-antisovetov-pastoru/index.html`.
- Removed generic styling blocks that are already provided globally by `css/site.css`, letting the page fall back to canonical site-wide styles instead of duplicating them inline:
  - `.note-box`
  - `.info-box`
  - `.warn-box`
  - `.divider`
  - `.article-figure` and descendants
  - `.pullquote`
  - `.drop-cap::first-letter`
- Kept only page-specific inline selectors that still have no safe global home.
- Result: `20-antisovetov` inline-style payload reduced further from **14242** → **12940** bytes.

### Verified:
- `npm run validate:all` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (33 passed / 2 warnings / 0 errors).

---

## v36 — 20-Antisovetov inline-style trim + selector dedup (2026-06-04)

### What was improved:
- Reduced the remaining high-risk inline `<style>` island in `articles/20-antisovetov-pastoru/index.html` by removing clearly dead selector groups:
  - old unused `.series-item*` family
  - dead `.bug-*` family
- Merged duplicated `.article-img img` rules inside `css/site.css` into a single canonical selector block.
- Result:
  - `20-antisovetov` inline-style payload reduced from **16139** → **14242** bytes;
  - CSS budget improved again (**432135** → **432044** bytes);
  - gzip CSS improved again (**85178** → **85137** bytes).

### Verified:
- `npm run cache-bust` → ✅ PASS.
- `npm run validate:all` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (33 passed / 2 warnings / 0 errors).

---

## v35 — Dead inline-style cleanup + small CSS budget recovery (2026-06-04)

### What was improved:
- Removed the now-redundant inline `<style>` block from `articles/krajne-li-isporcheno-serdce/index.html`.
- Deleted dead `.rescue-caption--above*` rules from `css/site.css` after verifying the class is not used anywhere in HTML/JS.
- Kept the still-used `.rescue-figure` rule in global CSS.
- Result:
  - remaining inline `<style>` blocks across the whole site: **1** (only the known high-risk `20-antisovetov` island remains);
  - CSS budget improved slightly (`432887` → `432135` bytes);
  - gzip CSS improved (`85361` → `85178` bytes).

### Verified:
- `npm run cache-bust` → ✅ PASS.
- `npm run validate:all` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (33 passed / 2 warnings / 0 errors).

---

## v34 — Inline-script dedup: topnav/reveal cleanup moved to global JS (2026-06-04)

### What was improved:
- Added a global `.reveal` fallback observer in `js/site.js`, so long-form article reveal animations no longer require page-specific inline IntersectionObserver snippets.
- Removed duplicated inline topnav scroll controllers from:
  - `articles/krajne-li-isporcheno-serdce/`
  - `articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/`
  because `js/site.js` module 34 already owns `#articleTopnav` globally.
- Removed duplicated inline reveal observers from the same pages.
- Removed redundant inline `.fn-marker` aria-label scripts from the same pages because `js/site.js` module 20 already sets those attributes centrally.
- Removed one dead inline `qbc-exclaim` script from `krajne-li-isporcheno-serdce` (selector absent in DOM).
- Result: fewer inline-script blocks (86 → 79), fewer duplicate scroll listeners, cleaner article HTML, and one less class of page-specific JS drift.

### Verified:
- `npm run cache-bust` → ✅ PASS.
- `npm run validate:all` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (33 passed / 2 warnings / 0 errors).

---

## v33 — QA guardrails: canonical quiz schema + OG image uniqueness enforcement (2026-06-04)

### What was improved:
- Extended `scripts/validate.js` with two new global HTML contract checks:
  - canonical quiz-source schema enforcement (`question / correct / explanation` only);
  - duplicate OpenGraph image meta detection (`og:image`, `og:image:width`, `og:image:height`, `og:image:type`, `og:image:alt`).
- Extended `scripts/audit-pro.js` with the same production-facing guarantees.
- Added a lightweight `SITE_CONFIG` extraction path in both validators, so page-level quiz data is now audited semantically, not just syntactically.
- Result: future regressions of the exact kind that caused the June quiz wave issues are now blocked automatically in CI/audit.

### Verified:
- `node --check scripts/validate.js scripts/audit-pro.js` → ✅ PASS.
- `npm run validate:all` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (33 passed / 2 warnings / 0 errors).

---

## v32 — Remaining quiz-source canonicalization + OG duplicate cleanup (2026-06-04)

### What was improved:
- Canonicalized the remaining legacy quiz sources across the site:
  - `20-antisovetov-pastoru`
  - `dzhon-gill-spravochnik`
  - `nagornaya/chast-1`
  - `nagornaya/chast-2`
  - `nagornaya/chast-3`
  - `nagornaya/chast-4`
  - `nagornaya/chast-5`
- Converted those quiz definitions from legacy `q / answer / ok / err` source shape into the canonical `question / correct / explanation` source shape while preserving the current runtime compatibility layer.
- Canonicalized the `20-antisovetov` bonus round as well.
- Result: all site quiz sources are now consistently authored in the modern schema, not just supported by compatibility code.
- Cleaned duplicate OpenGraph image metadata on:
  - `/index.html`
  - `/biografii/index.html`
  removing conflicting duplicate `og:image:type/alt/width/height` blocks.

### Verified:
- Canonical quiz-state check:
  - `20-antisovetov` → 10/10 canonical questions + 6/6 canonical bonus questions
  - `dzhon-gill-spravochnik` → 4/4 canonical questions
  - `nagornaya/chast-1` → 3/3 canonical questions
  - `nagornaya/chast-2` → 4/4 canonical questions
  - `nagornaya/chast-3` → 3/3 canonical questions
  - `nagornaya/chast-4` → 5/5 canonical questions
  - `nagornaya/chast-5` → 4/4 canonical questions
- `npm run validate:all` → ✅ PASS.
- `npm run tokens:check` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (31 passed / 2 warnings / 0 errors).

---

## v31 — Quiz canonicalization + sourceRef enrichment + metadata cleanup (2026-06-04)

### What was improved:
- Converted the three recently affected quiz pages to the canonical schema in source HTML:
  - `kod-da-vinchi`
  - `hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki`
  - `krajne-li-isporcheno-serdce`
- Result: no more mixed `legacy/new` quiz definitions inside those pages; all questions now use `question / correct / explanation` directly in source.
- Rebuilt bonus-question blocks in Hermeneutics and Krajne to the same canonical format.
- Added explicit `sourceRef` objects across the upgraded quiz sets, so feedback now points readers back to relevant sections instead of generic "перечитать раздел" hints.
- Hardened `js/site.js` further:
  - heading lookup now returns real section titles for source references;
  - explanation fallback now combines legacy `ok/err` material more intelligently;
  - bad/legacy anchors are normalized more safely.
- Cleaned malformed HTML/metadata on the same pages:
  - removed stray `</link></link>` garbage;
  - removed conflicting duplicate `og:image:type/alt/width/height` blocks where they contradicted the actual `og:image` file.

### Verified:
- `npm run cache-bust` → ✅ PASS.
- `npm run validate:all` → ✅ PASS.
- `npm run tokens:check` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (31 passed / 2 warnings / 0 errors).
- Canonical quiz-state check:
  - `kod-da-vinchi` → 10/10 canonical questions
  - `hermenevtika` → 11/11 canonical questions + 6/6 canonical bonus questions
  - `krajne` → 12/12 canonical questions + 6/6 canonical bonus questions

---

## v30 — Quiz engine hardening + glossary hydration + inline-script guard (2026-06-04)

### What was improved:
- Fixed the quiz-engine regression where new-format questions (`question / correct / explanation`) crashed the runtime that still expected legacy `q / answer / ok / err` fields.
- Added a backward-compatible normalization layer in `js/site.js`: old and new quiz schemas now work together safely, including `type`, `correct`, `explanation`, `sourceRef`, and heading-anchor resolution.
- Upgraded feedback rendering: `explanation.short` and `explanation.full` are now both surfaced in the UI instead of being silently reduced to a single escaped string.
- Added glossary hydration for dynamic quiz HTML via `js/glossary.js` + `gb:quiz-rendered` events, so `.gterm[data-term]` inside quiz questions/options becomes a real tooltip rather than dead decorative markup.
- Expanded `data/glossary.json` with missing aliases/entries used by the new quiz/tooltips wave (`kettering`, `gin-craze`, `song-of-songs`, `polemic`, `witness`, `gnostic`, `nicea`, `priory-of-sion`, etc.).
- Repaired broken inline `SITE_CONFIG` quiz blocks in John Gill Part I / II / III and cleaned wording/typos (`Сперджен`, `смиренный`, `тексты`, `первый систематик`).
- Fixed John Gill Part I body markup where a footnote tooltip swallowed a whole paragraph after a tooltip insertion.
- Corrected the Hermeneutics quiz mismatch where a question about `Heilsgeschichte` had options/explanations from another question.
- Added inline `<script>` syntax validation to both `scripts/validate.js` and `scripts/audit-pro.js`, closing the QA blind spot that previously missed broken page-level JavaScript.
- Updated `README.md` and `AGENTS.md` quiz examples to document the new canonical quiz schema while explicitly marking legacy schema as backward-compat only.

### Verified:
- `node --check js/*.js scripts/*.js sw.js` → ✅ PASS.
- `npm run cache-bust` → ✅ PASS.
- `npm run validate:all` → ✅ PASS (0 errors, 0 warnings).
- `npm run tokens:check` → ✅ PASS.
- `node scripts/audit-pro.js` → ✅ PASS (31 passed / 2 budget warnings / 0 errors).

---

## v29 — Image contract fixes: `<picture>` wrappers, base files, PNG cleanup (2026-06-04)

**Commits:** `PLAN-07` (this release)

### Что исправлено

| Проблема | Решение | Файлы |
|---|---|---|
| Rim7: 10 `<img srcset>` без `<picture>` | Обёрнуты в `<picture><source type="image/webp"><img>` | `rimlyanam-7-veruyushchiy-ili-neveruyushchiy` |
| Rim7: 5 изображений без base-файлов | Созданы из largest variants (`-1600w` → `.webp`) | `rim7-threshold-hero`, `rim7-rom6-8-banner`, `rim7-positions-map`, `rim7-old-new-covenant`, `rim7-no-condemnation-banner` |
| Gill: 2 изображения без base-файлов | Созданы из largest variants | `gill-preacher-pulpit`, `gill-nine-volumes` |
| `underground-puritan-meeting.png` — единственный `<img>` без webp | Конвертирован в webp + responsive variants + JPG fallback, обёрнут в `<picture>` | `dzhon-gill-istoricheskiy-kontekst` |
| `20-antisovetov-pastoru`: 10 `<img srcset>` без `<picture>` | Обёрнуты в `<picture>`, srcset/sizes перенесены на `<source>` | `20-antisovetov-pastoru` |
| `krajne-li-isporcheno-serdce`: 16 `<img srcset>` без `<picture>` + 2 сломанных `<img <picture>` | Все 18 обёрнуты в `<picture>`, исправлены сломанные теги | `krajne-li-isporcheno-serdce` |
| `kod-da-vinchi`: hero img srcset на `<img>` внутри `<picture>` | srcset перенесён на `<source>`, JPG fallback исправлен | `kod-da-vinchi` |
| PNG-бэкапы Gill (10 файлов, ~7MB) | Удалены (webp-пары существуют) | `images/gill-*.png` |
| `whitefield-field*` (5 файлов, ~3MB) | Удалены (не использовались) | `images/whitefield-field*` |
| `biografii/index.html`: PNG ref | Заменён на `.webp` | `biografii` |
| `dzhon-gill-chast-2`: preload PNG ref | Заменён на `.webp` | `dzhon-gill-chast-2-uchenyi` |
| `krajne`: 14 несуществующих JPG `<source>` fallback | Удалены | `krajne-li-isporcheno-serdce` |

### Результаты

- **`validate:all`**: ✅ 0 errors, 0 warnings
- **`audit-pro.js`**: ✅ 30 passed / 2 warn (budget only) / 0 errors
- Все 44 `<img>` с `srcset` теперь обёрнуты в `<picture>` с `<source type="image/webp">`
- Созданы 7 base-файлов изображений, 7 responsive-вариантов
- Удалено 16 неиспользуемых файлов (~10MB)

---

---

## v28 — PLAN-06: JS cleanup (professional, careful, with Playwright re-checks) (2026-06-04)

**Commits:** `bdf8fe0` (plan) · `3872ba9` (P1) · `34ca8d6` (P2) · `acdd6d2` (P3) · `27d2543` (P6 finalize)

### Цель

Аккуратно проверить и почистить JS-код проекта (9436 строк, 440 КБ raw / 112 KB gzip).
**Главный приоритет:** не сломать функционал. Каждая партия → Playwright visual-audit (0 console / 0 network errors) → push.

### Результат

**JS код был уже чистым.** Обнаружены только косметические/документационные рассогласования:

| Партия | Файл | Что | Изменения в коде |
|---|---|---|---|
| **P1** `3872ba9` | `js/site.js` | Шапка-оглавление: убрано «25. (зарезервировано)» (модуля нет в коде), добавлены 28/29/30 модули с пометками AGENTS-r17 и PLAN-04 P5. | Comment-only |
| **P2** `34ca8d6` | `js/enhancements.js` | 3 безымянных модуля получили буквы C/D/E (Quiz Interactive, Hebrew Tap-Toggle, Ambient Scripture). Добавлено полное оглавление A..G в шапку. | Comment-only |
| **P3** `acdd6d2` | `js/site.js` | Один неточный комментарий `qFocus = ... /* legacy — kept for HTML compat */` заменён на точный. Два других legacy-комментария проверены и подтверждены легитимными. | Comment-only |
| **P4** (audit-only) | весь JS | Глубокий поиск: unused functions, dead DOM-refs, dead helpers. **Реальный dead-code не найден.** Все 12 «unused» из regex-scan оказались false positives (используются через property access / passed as callback / IIFE). 47 dead DOM-refs → 16 → 0 (все легитимные defensive fallback / template-literal injection / documented feature slot из AGENTS §11.2). | None |
| **P5** | — | Пропущена (P4 ничего не дал — нечего чистить). | — |

### Что было исследовано и явно НЕ изменено

- **Модуль 07 TOC Mobile** (~80 строк JS) — `#toc-panel/list/toggle/overlay/close` нет ни в одном HTML. Однако это **documented feature slot** (AGENTS §11.2 «Контракт разметки»), активируется при появлении в будущей статье. **Оставлен.**
- **`/* legacy key: keep for backwards compatibility */`** на `quiz-best-<slug>` localStorage key — это **активный compat** со старыми пользовательскими данными (новый ключ `quiz-result-v2:...` через `writeQuizMemory`). **Оставлен.**
- **`hCpBtnNav` → `gbSearchBtn` alias в `js/search.js`** — активный legacy compat. **Оставлен.**
- **130 `addEventListener` без `removeEventListener` в `js/site.js`** — большинство на `document/window/body` (живут навсегда). Симметризация = архитектурный refactor, не точечная чистка. **Оставлено как есть.**
- **`qFocus` placeholder с `display:none`** — формально мёртвый в main quiz-flow, но возможно используется в review-режиме (через `revFocus`). Полное удаление требует Playwright проверки interactive quiz flow — **отложено** до отдельной сессии.

### Verified after every batch:

- `node --check js/*.js scripts/*.js sw.js` → ✅ PASS
- `npm run cache-bust` → matched
- `npm run validate:all` → ✅ PASS (0 errors, 0 warnings)
- `npm run tokens:check` → ✅ PASS (0/0)
- `node scripts/audit-pro.js` → ✅ PASSED 29 / 2 warn / 0 err
- **`npm run visual-audit` (Playwright × 96 screenshots × 3 раза)** → ✅ **0 console errors, 0 network errors** на baseline, после P1, после P2, после P3

### Numbers

JS baseline и итог совпадают — это была проверка качества, а не оптимизация веса:

| Метрика | Baseline | После P1-P3 |
|---|-:|-:|
| `js/site.js` строк | 5121 | 5129 (+8 строк комментариев) |
| Console errors | 0 | 0 |
| Network errors | 0 | 0 |
| `audit-pro` | ✅ PASSED 29/2/0 | ✅ PASSED 29/2/0 |
| Рассогласование `site.js` шапки с кодом | 3 (25/28/29/30) | **0** ✅ |
| Рассогласование `enhancements.js` нумерации | 3 (C/D/E пропущены) | **0** ✅ |

### Plan & journal

Полный план и журнал партий: [`audit/PLAN-06-DONE.md`](audit/PLAN-06-DONE.md)

### Note для будущих агентов

Если возникнет соблазн «разбить site.js на модули» — **нет**. Это намеренный архитектурный выбор (AGENTS §5.1), подтверждённый в PLAN-06 P4: дублей нет, чистка не нужна.

Если возникнет соблазн «удалить TOC Mobile модуль 07 (он мёртвый)» — **нет**. Это documented feature slot. Активируется при `<div id="toc-toggle">` в HTML статьи.

Если возникнет соблазн «удалить `qFocus`-placeholder» — **сначала тщательная проверка review-режима квиза в Playwright** (interactive flow).

---

## v27 — PLAN-05: docs cleanup + visual QA + HTML hotfix (2026-06-04)

**Commits:** `e59f6df` (hotfix HTML) · `971475a` (AGENTS-r63 rewrite) · `643f4a7` (this changelog cleanup)

### What was improved:

**1. Visual QA с реальным браузером (Playwright + chromium)**
- Установлен Playwright + chromium-headless + system libs (libnspr4/libnss3/etc).
- Запущен `scripts/visual-audit.js` на полном наборе: 32 страницы × 96 скриншотов.
- Результат: **0 console errors, 0 network errors, 0 raw bugs** (28 invisible-text — все подавлены).
- Дополнительно: 12 тёмных скриншотов (key pages × desktop+mobile) для проверки dark theme после PLAN-04.
- Подтверждено: ВСЕ PLAN-04 изменения (199 !important, удаление мёртвых компонентов, перенос .h-hero-title и .h-phrase--* в home.css) не вызвали визуальных регрессий.

**2. HTML hotfix — найден визуальной проверкой**

В тёмной теме страницы `articles/dzhon-gill-chast-1-chelovek/` внутри карточки «Часть I → Человек» текст «Вы здесь» отображался вертикальным столбиком символов «В Ы З Д Е С Ь».

Причина (HTML5 parsing spec): тег `<span>` для синей точки-индикатора 4×4 px не имел `</span>` закрытия. Браузер «впитывал» текст «Вы здесь» внутрь 4px span, и `width:4px;display:inline-block` ломал текст по одному символу в столбик.

Тот же баг был во **всех 3** файлах dzhon-gill (chast-1/2/3 — копи-паст шаблона). Все три исправлены: добавлено `</span>` сразу после style-атрибута точки. Теперь корректно: «ЧАСТЬ I • ВЫ ЗДЕСЬ».

После фикса: HTML balance check (htmlparser2) → **0 unclosed tags во всех 24 HTML**.

**3. AGENTS.md полная перезапись (AGENTS-r63)**

Старый AGENTS.md (709 строк, r62):
- 66+ записей в истории
- ПРОТИВОРЕЧИЯ: учил создавать `.theme-float-btn` / `.ai-disclosure` (давно удалены в PLAN-04 P5/P7) — из-за этого новые агенты регулярно ВОЗВРАЩАЛИ мёртвые компоненты, отсюда регрессии июня 2026.
- Сломанная нумерация: §0-§8, §10, §11, ВТОРОЙ §11
- Устаревшие счётчики !important (~189, ~313, ~320 в разных местах)

Новый AGENTS.md (567 строк, r63):
- 11 чистых разделов, актуальное состояние
- §0 TLDR: 13 правил «СРАЗУ нельзя», включая legacy-кнопки и !important чеклист
- §4.2: актуальный счёт (199), 5-шаговый чеклист перед добавлением !important, точный список 7 легитимных категорий
- §4.4 CSS Integrity Rules: 10 правил, включая п.9 «Мёртвый компонент = удалить»
- §5.3: секция про Playwright visual-audit
- §8 (новая): Service Worker правила
- §9 (новая): Безопасность/гигиена
- §11 История: компактная таблица из 5 последних вех + ссылка на git log

**4. AUDIT_HISTORY.md чистка**
- v9-v21 свёрнуты в краткую summary-таблицу
- Удалена устаревшая секция «Previous Audit History» (v1-v7 placeholder)
- Удалена устаревшая секция «Remaining Items» (8 пунктов, все либо неактуальны после PLAN-04, либо архитектурные «не дробить site.js» противоречат AGENTS)

### Verified:
- `node scripts/audit-pro.js` → ✅ PASSED 29/2 warn/0 err
- `npm run validate:all` → ✅ PASS (0 errors, 0 warnings)
- `npm run tokens:check` → ✅ PASS (0 / 0)
- `npm run visual-audit` (Playwright × 96 screenshots) → ✅ 0 console errors, 0 network errors
- HTML tree-balance check (htmlparser2) → ✅ 0 unclosed tags в 24 HTML

---

## v26 — 🎯 PLAN-04: !important cleanup wave (2026-06-04)

**Commits:** `f0f3982` (plan) ... `a37664a` (P15, target reached) + `notify-on-failure.yml`

**Goal:** Восстановить архитектурный лимит `site.css ≤200 !important` (AGENTS-r42 §4.2)
после регрессии за июнь 2026 (342 vs контракт 200).

**Method:** 15 точечных партий. Для каждого `!important` рассчитана CSS specificity
конкурентов; снимались только те, где **математически доказано**, что каскадная
победа гарантирована без важности-override. Никаких массовых «эстетических»
правок — каждое изменение обосновано.

### What was improved:

| # | Commit | Effect |
|---|--------|--------|
| hotfix | `d0a7193` | Замена мёртвой ссылки `anglicanbooksrevitalized.us` (302 → спам-домен `survey-smiles.com`) на `web.archive.org` снимок 2025-05-14 |
| P1 | `2108bc7` | 3 настоящих top-level дубль-селектора (blockquote, .bottom-bar, article p) слиты |
| P1b | `56367d3` | 6 premium-section дубль-селекторов слиты (body, h1, h1-large, article a, .pq-scripture, #reading-progress, .pullquote::before) |
| P2 | `ce6af68` | `.fn-marker .tooltip:hover` — псевдокласс специфичности (−2) |
| P3 | `af7f3c5` | **`.h-hero-title:hover` архитектурный фикс**: значения перенесены из site.css в home.css БЕЗ важности-override (−13) |
| P4 | `61713f5` | Landscape cascade reorder + 4 мёртвых `.sd-*` правила (−6) |
| P5 | `d683088` | Удалён legacy `.theme-float-btn` (AGENTS-r17 заменил на `.gb-fc-theme`), ~110 строк CSS, −1.2 КБ |
| P6 | `1ee834c` | 4 мёртвых класса: `.epilogue-*`, `.h-section-link`, `.article-img.float-fallback`, `.card.fx-lift` (−7, −900b) |
| P7 | `c141f36` | `.ai-disclosure` (DEAD per AGENTS-r11) + 2 dead Tailwind overrides (−1) |
| P8 | `fd732b0` | `.summary-card__check svg` — нет конкурентов (−6) |
| P9 | `54bce49` | `.summary-card{,__item,__check}` массовая чистка — нет конкурентов (−23) |
| P10 | `945cd4b` | Финальная чистка .summary-card mobile overrides (−10) |
| P11 | `db3860c` | `.gb-accuracy-*` + `.heading-anchor.copied` — specificity (−6) |
| P12 | `a2228a1` | **Добавлен `.github/workflows/notify-on-failure.yml`** — открывает GitHub issue при падении deploy/indexnow |
| P13 | `4582635` | Mobile-overrides где specificity уже выигрывает: `.kbd-hint-toast`, `#back-to-top`, `body.nagornaya-page .flex.*`, `#canonTimeline .ctw-*` (−31) |
| P14 | `7d8df6d` | Specificity-audit: `.mobile-controls .theme-toggle`, `body.nagornaya-page .max-w-4xl > .mb-6 > p.text-stone-*`, `body.has-bottom-bar #back-to-top`, `#selection-share-popup` (−26) |
| **P15** | **`a37664a`** | **🎯 ЦЕЛЬ ДОСТИГНУТА.** `.biography-hero/portrait`, `.h-phrase--greek/hebrew` (move to home.css), `.fn-marker.fn-trans` (−11) |

### Final numbers:

| Metric | Baseline (2026-06-03) | After P15 (2026-06-04) | Target |
|---|-:|-:|-:|
| `site.css` !important | **342** | **199** ✅ | ≤200 |
| `site.css` size | 267 905 b | 264 887 b (−3 КБ) | — |
| `home.css` !important | 20 | 20 | — |
| Top-level duplicate selectors | 14 | 0 (4 legitimate) | 0 |
| audit-pro | ✅ PASSED 29/2/0 | ✅ PASSED 29/2/0 | ✅ |
| `notify-on-failure.yml` | not installed | **installed** ✅ | installed |

### Verified after every batch:

- `node --check js/*.js scripts/*.js sw.js` → PASS
- `npm run cache-bust` → matched
- `npm run validate:all` → PASS (0 errors, 0 warnings)
- `npm run tokens:check` → PASS (0/0)
- `node scripts/audit-pro.js` → PASSED 29 / 2 warn / 0 err

### Plan & per-batch journal:

Полный план и журнал партий: [`audit/AUDIT_CLEANUP_PLAN_2026-06-04.md`](audit/AUDIT_CLEANUP_PLAN_2026-06-04.md)

### Что НЕ менялось (контракт):

- Атрибуция авторства (AGENTS-r4 §3.1) — `Автор-редактор` / `Редактор`
- JSON-LD структура (§3.2), OG/Twitter теги (§3.3)
- Tailwind в nagornaya/tw.min.css — не трогали
- Структура папок, имена файлов
- 5 CSS + 11 JS — никаких новых файлов
- Бюджеты в audit-pro.js (375K CSS / 365K JS) — не повышались

### Note for future agents:

AGENTS.md §4.2 обновлён с актуальными цифрами и историей регрессии-восстановления.
Для предотвращения новой регрессии — следовать §4.2 чеклисту перед добавлением
любого нового `!important`.

---

## v25 — Mobile long-block premium compaction (2026-06-03)

**Commit:** `r61.17: Add mobile long-block compaction`

### What was improved:
- Manual mobile review and measurement found very long editorial blocks (`note-box`, `info-box`, `warn-box`, `summary-card`) creating multi-screen “портянки”.
- Added mobile-only progressive enhancement in `js/enhancements.js`: long blocks get an accessible expand/collapse control.
- Added premium mobile styling in `css/site.css`: 560px preview, gradient fade, pill-shaped expand button, dark-mode support.
- Conservative thresholds avoid button spam: `summary-card ≥ 740px`, other editorial blocks ≥ 950px.
- Desktop is unchanged and all content stays in the DOM/readable after expansion. Cache-bust refreshed.

### Verified:
- `node --check js/*.js scripts/*.js sw.js` → ✅ PASS.
- `npm run validate:all` → ✅ PASS (0 errors, 0 warnings).
- `npm run tokens:check` → ✅ PASS (`0 / 0` legacy var references).
- `node scripts/audit-pro.js` → ✅ PASS (29 passed, 0 errors; only existing CSS/JS budget warnings).
- `npm run visual-audit` → ✅ PASS: 32 page/viewport runs, 96 screenshots, 0 console errors, 0 network errors, 0 filtered findings.

---

## v24 — Mobile compact premium cards (2026-06-03)

**Commit:** `r61.16: Compact mobile archive and series cards`

### What was improved:
- Manual mobile review found archive/series cards becoming tall “портянки”: thumbnails stacked above text and planned cards taking too much vertical space.
- Added a scoped compact row layout for non-home mobile `.h-article-card` lists in `css/home.css` under 440px.
- Mobile list thumbnails are now compact 104×76, titles/abstracts are line-clamped, and planned placeholders remain premium but no longer dominate half the screen.
- Compacted the `20-antisovetov` mobile series navigator: lower padding, wider cards, static badge, smaller meta, and clamped excerpts.
- Desktop layout is unchanged. Cache-bust refreshed.

### Verified:
- `node --check js/*.js scripts/*.js sw.js` → ✅ PASS.
- `npm run validate:all` → ✅ PASS (0 errors, 0 warnings).
- `npm run tokens:check` → ✅ PASS (`0 / 0` legacy var references).
- `node scripts/audit-pro.js` → ✅ PASS (29 passed, 0 errors; only existing CSS/JS budget warnings).
- `npm run visual-audit` → ✅ PASS: 32 page/viewport runs, 96 screenshots, 0 console errors, 0 network errors, 0 filtered findings.

---

## v23 — Manual screenshot QA: 20-Antisovetov series DOM + reliable bottom screenshots (2026-06-03)

**Commit:** `r61.15: Fix antisovetov series card DOM and screenshot scroll`

### What was improved:
- Manual bottom screenshot review found a severe overlap in the `20-antisovetov` series navigator.
- Root cause: unclosed `series-card__current-badge`, `series-card__num`, and `series-card__tag` spans caused nested text/card swallowing.
- Closed the malformed spans and converted raw `h3` block headings inside the series `<ul>` into valid list/grid items.
- Hardened `scripts/visual-audit.js` scrolling with instant scroll behavior and a wait-for-scroll check before CDP screenshot capture, so bottom screenshots reliably reach true page bottoms even on very long articles.

### Verified:
- `node --check js/*.js scripts/*.js sw.js` → ✅ PASS.
- `npm run validate:all` → ✅ PASS (0 errors, 0 warnings).
- `npm run tokens:check` → ✅ PASS (`0 / 0` legacy var references).
- `node scripts/audit-pro.js` → ✅ PASS (29 passed, 0 errors; only existing CSS/JS budget warnings).
- `npm run visual-audit` → ✅ PASS: 32 page/viewport runs, 96 screenshots, 0 console errors, 0 network errors, 0 filtered findings.

---

## v22 — Manual mobile navbar premium fix (2026-06-03)

**Commit:** `r61.14: Fix mobile home navbar overflow`

### What was improved:
- Manual screenshot review found desktop navigation links squeezed into 375px headers on home/archive/series layouts.
- Added a scoped mobile rule in `css/home.css` hiding `.h-navbar .h-nav-links` below 760px, leaving the premium logo + theme/search/burger controls.
- Verified `/`, `/articles/`, and `/pastor-series/` mobile nav now show clean logo + burger instead of clipped desktop links.
- Refreshed cache-bust hashes.

### Verified:
- `node --check js/*.js scripts/*.js sw.js` → ✅ PASS.
- `npm run validate:all` → ✅ PASS (0 errors, 0 warnings).
- `npm run tokens:check` → ✅ PASS (`0 / 0` legacy var references).
- `node scripts/audit-pro.js` → ✅ PASS (29 passed, 0 errors; only existing CSS/JS budget warnings).
- `npm run visual-audit` → ✅ PASS: 32 page/viewport runs, 96 screenshots, 0 console errors, 0 network errors, 0 filtered findings.

---
## v9..v21 (свёрнуто) — 2026-05-22 → 2026-06-03

Полные changelog'и этих версий — в `git log` (`git log --oneline --grep "audit\|AGENTS\|r6[01]"`). Краткое резюме:

| Версия | Дата | Главное |
|---|---|---|
| v21 | 2026-06-03 | Visual-audit screenshot pipeline (CDP document clipping); премиум planned-card placeholders в pastor-series. |
| v20 | 2026-06-03 | Visual audit noise: убраны false-positive accessible-link warnings. |
| v19 | 2026-06-03 | 20-Antisovetov JS/HTML stabilization (mobile bottom-sheet, FAQ). |
| v18 | 2026-06-03 | Playwright visual-audit noise hardening (selector-based filtering). |
| v17 | 2026-06-03 | Safe Biografii inline CSS → `site.css` migration phase C. |
| v16 | 2026-06-03 | Safe CSS inline cleanup phase B (general). |
| v15 | 2026-06-03 | Safe stabilization phase A (cache-bust + audit-pro hardening). |
| v14 | 2026-06-03 | CSS Phase 2 + Quality Safeguards. |
| v13 | 2026-05-30 | Editorial pass: статья «Код да Винчи». |
| v12 | 2026-05-30 | Editorial pass: статья «20 антисоветов пастору». |
| v11 | 2026-05-30 | Final patch: 7 HTML/SEO + 10 JS bugs. |
| v10 | 2026-05-22 | Final Cleanup: 7.7MB PNG → .webp; убраны patch-скрипты, dead `package.json` scripts. |
| v9  | 2026-05-22 | Bug Hunter Real Fixes: critical SEO + IndexNow + sitemap fixes. |

История v1..v8 — в начальной фазе репо (май 2026), полностью покрыта в `git log` за май.

---

## Tracked issues — нет

Все issue из старого «Remaining Items» (8 шт) либо закрыты в PLAN-04 (v26),
либо признаны архитектурным выбором (не дробить `site.js` на модули — §5.1 AGENTS-r63),
либо были false-positives.

Текущие предупреждения `audit-pro` — это **CSS budget** (433KB vs 375KB target)
и **JS budget** (452KB vs 365KB target). Эти бюджеты — пороги в `scripts/audit-pro.js`,
без архитектурного обоснования; качество выше размера (см. PLAN-04 §1.2 контракт).

## 2026-06-22 — Current-main audit fixes and guard hardening

Follow-up patch after rechecking `main` at `affc61e2` and the supplied MD audits.

Fixed: `/articles/kod-da-vinchi/` theme double-toggle, fake `?v=layered-pilot/modules-pilot`, Gill III readable defects (`труженикаnister`, `Gillism Gillism`, `Санhedрин`), stale root read-time text, temporary map placeholder indexing/search promotion, `css:layer:validate`, `visual-audit` false-green, `/about/` stale full-document parity requirement, visual parity summary workflow, and notify workflow coverage for Dist Dry Run.

Added guards: `maps:publication-status`, search fallback read-time drift check in `data:consistency`, `readable-audit --root dist` fatal patterns, stricter `visual-audit` exit behavior, and workflow-policy enforcement. See `docs/CURRENT_RECHECK_2026-06-22_FIXES.md`.

## Archived AGENTS changelog rows — compacted 2026-06-22

Rows AGENTS-r140..AGENTS-r243 were moved out of AGENTS.md to keep the live agent contract scannable. Original rows preserved below.

| **AGENTS-r243** | 2026-06-18 | **Genealogy semantic zoom finished cleanly.** После сорванной попытки другого агента реализован корректный 3-level semantic zoom в `GenealogyTree.tsx`: zoom <0.3 показывает обзорную мессианскую/якорную нить, 0.3–0.7 — ключевых патриархов/царей/пророков/спорные узлы, >=0.7 — все 156 персон. Узлы скрываются через React Flow `hidden`, layout не перестраивается; добавлен live-индикатор уровня детализации. `astro:check` — 0 errors/0 warnings/0 hints. |
| **AGENTS-r242** | 2026-06-18 | **Refactor runtime hardening: Astro-owned production pages restored legacy runtime + map hub truth.** Закрыт false-green gap: `interactive-audit.yml` теперь строит production-like `dist`, строит Pagefind и запускает runtime-audit именно против `dist`, а не stale root. `BaseLayout.astro` автоматически переносит legacy `SITE_CONFIG`/Metrika/body JS runtime на Astro-owned страницы без дублирования shadow-wrappers. `SeriesArticleLayout.astro` получил working GBS controls (`data-gbs2-*`), mobile sheet ids/tabs/close contract и корректный `dateModified` из `updatedAt`. `/karty/` Astro hub переведён на 10 live карт (без disabled “Скоро”), `maps:validate` теперь guard'ит, что every `karty/*/route.json` имеет clickable card. SW cache bumped to evict stale static assets. |
| **AGENTS-r241** | 2026-06-18 | **MapEngine v0.52: signature controls + story focus halo.** Поверх актуального main добавлен объяснимый слой сигнатур: все 9 engine-карт получили `signature.description`; легенда показывает `me-signature-note` с подписью/смыслом overlay, а панель слоёв авто-добавляет toggle `signature` для `#me-signature`. Переключение сюжета теперь кроме `flyTo` рисует bbox-halo `.me-story-focus`, чтобы пользователь видел фокус выбранной истории. `maps:validate` усилен schema-like проверкой allowed signature types и known place ids (`origin`, `place_ids`, `north_ids`, `south_ids`), `route.schema.json` документирует signature contract. `smoke:maps` теперь проверяет signature note, toggle и story-focus halo. Авраам не тронут как protected flagship. |
| **AGENTS-r240** | 2026-06-18 | **MapEngine v0.51: signatures completed for all engine maps.** Завершена сигнатурная Волна 2 для 9 engine-rendered карт: добавлены `split-kingdom` для `melachim` (две полупрозрачные области Израиль/Иуда + разделительная линия), `judge-cycles` для `shoftim` (циклические кольца Судей), `tribe-stars` для `shvatim` (звёздная сеть уделов 12 колен), `ministry-light` для `yeshua` (световая нить служения Христа). Теперь signature overlays есть у всех engine-карт: ishod/pavel/melachim/shoftim/shvatim/yeshua/maccabim/early-church/revelation. QA: `maps:validate` 10/10 ✅, `smoke:maps` 9/9 ✅ (signature=ok/storyFly=ok/sci=ok/viewW guard), `smoke:maps:mobile` 9/9 ✅, `avraam:audit` ✅, `validate:all` ✅, `audit-pro` 0 errors. |
| **AGENTS-r239** | 2026-06-18 | **MapEngine v0.50: signature overlays expanded to Исход/Павел/Маккавеи.** Продолжена Волна 2 «каждая карта со своим характером»: `signature.type=water-split` для `ishod` (расступающееся море у `pihahiroth`), `signature.type=sea-voyage` для `pavel` (кораблики/волны по морским переходам), `signature.type=hanukkah-lights` для `maccabim` (ханукальный светильник у Иерусалима). Движок получил SVG/CSS для water walls, golden lane, ships, menorah flames. Теперь signatures есть у 5 карт: ishod/pavel/maccabim/early-church/revelation. `smoke:maps` проверяет signature DOM для всех route.signature и storyFly/sci/route visuals; дополнительно guards `viewW>50`, чтобы не вернулся collapse viewBox из-за старого zoom-factor API. Исправлена backward-compat проблема `flyTo(cx,cy,0.72)` (старые wrappers передавали zoom factor, engine ожидал width) — малые значения теперь трактуются как zoom factor. QA: `maps:validate` 10/10 ✅, `smoke:maps` 9/9 ✅, `smoke:maps:mobile` 9/9 ✅, `avraam:audit` ✅, `validate:all` ✅, `audit-pro` 0 errors. |
| **AGENTS-r238** | 2026-06-18 | **MapEngine v0.49: data-driven signature overlays for per-map character.** Начата Волна 2 из flagship maps ADR: уникальные сигнатуры карт через `route.signature`, без копипаста рендера и без touching Avraam. Движок рендерит `signature.type=lampstands` (7 светильников — Откровение) и `signature.type=gospel-waves` (волны Евангелия из Иерусалима — Ранняя Церковь). Добавлены CSS `.me-signature`, `.me-sig-lamp`, `.me-sig-wave`, keyframes. `revelation/route.json` получил `signature:{type:"lampstands", place_ids:[7 церквей]}`; `early-church/route.json` получил `signature:{type:"gospel-waves", origin:"jerusalem_upper"}`. `smoke:maps` теперь проверяет signatures: если route.signature есть, в DOM должны появиться `#me-signature .me-signature`; также storyFly/sci/route visuals сохраняются. QA: `maps:validate` 10/10 ✅, `smoke:maps` 9/9 ✅ (signature=ok for early-church/revelation), `smoke:maps:mobile` 9/9 ✅, `avraam:audit` ✅, `validate:all` ✅, `audit-pro` 0 errors. |
| **AGENTS-r237** | 2026-06-18 | **MapEngine v0.48: automatic story viewport flyTo.** У engine-карт почти все `stories[]` не имели `viewport/cam`, поэтому переключение сюжета фильтровало маркеры, но не фокусировало карту. Добавлен pure helper `getStoryViewport(route, storyId, {padding,minW,maxW})`: explicit viewport/cam сохраняет приоритет, main использует `meta.viewport_init`, остальные считаются по bbox story places с padding. `setStory()` теперь всегда вызывает `flyTo()` на вычисленный viewport. Smoke усилен: `smoke:maps` кликает второй story chip и проверяет, что SVG viewBox изменился. QA: `maps:validate`, `smoke:maps`, `smoke:maps:mobile`, `avraam:audit`, `validate:all`, `audit-pro` green. |
| **AGENTS-r236** | 2026-06-18 | **MapEngine v0.46: scientific variants UI polish + collapsible evidence footer + real marker-click regression fix.** Углублён визуал научных вариантов: `sci` tab теперь поддерживает canonical statuses `consensus/primary/candidate/alternative/caveat/minor/rejected` с отдельными цветами, label mapping и source chips (`sources/source/src`). `maps:validate` усилен проверкой статусов scientific_variants (без блокировки contextual keys). `smoke:maps` теперь реально открывает место с scientific variants, кликает вкладку «Наука» и проверяет `.me-sci-item/.me-sci-status`, `.me-arch-footer` и `.me-source-badge`; дополнительно проверяет route underlay/main/labels. Этот smoke поймал живой баг: marker click падал `svg is not defined` из-за top-level `addRipple()`; исправлено — `addRipple(svg, ...)` получает SVG явным параметром. Evidence footer стал collapsible: первые 2 свидетельства видны сразу, остальные раскрываются кнопкой; category mapping расширен для `jerusalem_kings`, `jerusalem_meet`, `jerusalem_upper` и др. QA: `maps:validate` 10/10 ✅, `smoke:maps` 9/9 ✅ включая sci tab, `smoke:maps:mobile` 9/9 ✅, `avraam:audit` ✅, `validate:all` ✅, `audit-pro` 0 errors. |
| **AGENTS-r235** | 2026-06-18 | **MapEngine v0.45: route glow/labels + evidence source badges + smoke guards.** Визуальное углубление всех engine-rendered карт (НЕ Авраам-монолит): stage paths теперь рисуются в два слоя — мягкий glow-underlay `.me-route-underlay` + основной путь `.me-route-main`; добавлены `.me-route-label` для этапов; active-place route highlight переведён на `data-stage`/`data-route-kind`, чтобы не ломался от extra SVG elements. Археологический footer получил компактные source badges (первичный/раскопки/научн./консерв./heritage) через классификацию ref/src, без перегруза UI ссылками. `smoke:maps` расширен: проверяет наличие route underlays/main routes/labels на всех 9 engine-картах. QA: `maps:validate` 10/10 ✅, `smoke:maps` 9/9 ✅, `smoke:maps:mobile` 9/9 ✅. |
| **AGENTS-r234** | 2026-06-18 | **Primary-source pass 01 for «Баптисты России»: /noch-na-kure deepened with Kalweit 1869 scan.** Для статьи «Ночь на Куре» найден и сохранён открытый первичный источник: *The Missionary Magazine*, Vol. 50, No. 1, January 1870, “Letter from Mr. Kalweit”, Tiflis, July 22, 1869 (Internet Archive `sim_baptist-missionary-magazine_1870-01_50_1`); OCR сохранён в `baptisty-rossii/research/raw-sources/missionary-magazine-1870-01-vol50-no1.txt`. Статья и MDX получили блок, который строго разделяет: письмо подтверждает немецко-баптистскую среду и русскоязычный контакт в Тифлисе, но не является прямым доказательством ночи на Куре. Добавлен source-pass документ с очередью поиска: European Harvest Field 1935, автобиография Кальвейта 1913, «Баптист» №5 1927, «Церковный Вестник» №49 1879. QA: `validate:all` ✅, `data:consistency` ✅, `audit-pro` 164 passed · 0 warnings · 0 errors, `astro:audit:baptisty-series` ✅, `source:links:dist` ✅. |
| **AGENTS-r233** | 2026-06-18 | **Refactor 4.5 deep UI parity pass: articles/series/root-vs-dist browser compare + map touch-target hardening.** Выполнен legacy↔dist semantic compare по 48 ключевым routes и Playwright desktop/mobile compare для статей, Баптисты России, Нагорной, карт, /map/, /konfessii/russkij-baptizm/ и /rodosloviye/. Найдены и закрыты реальные UI-долги: MapEngine controls/theme/share/layer toggles/photo close были <44px на mobile; /map/ карточка close была <44px; Astro wrapper breadcrumbs в 3D-баптизме имели маленькую desktop hit area; /rodosloviye/ fallback ругался на missing SITE_CONFIG. `smoke:maps` расширен до всех 9 engine maps, `smoke:maps:mobile` теперь падает на small map controls <44px. QA: `validate:static-publication` ✅, `strangler:audit:production-like` ✅, `smoke:maps` ✅, `smoke:maps:mobile` ✅ (9 maps, smallControls=0), `smoke:content:mobile` ✅, `audit-pro` 164 passed · 0 warnings · 0 errors. |
| **AGENTS-r232** | 2026-06-18 | **Refactoring 4.5 hardening: docs/source-links/IndexNow aligned with dist-as-production.** README and refactor docs now state that production serves Astro/strangler `dist`; `migration/page-ownership.json` statuses moved from `shadow-pilot` to `production-dist`; source-link audit can target `--root dist` and weekly workflow now builds production-like dist before checking external links; `indexnow.yml` uses `scripts/build-indexnow-urls.js` so src/MDX-only changes notify their real public URLs; Astro check hints in layouts removed; new `/rodosloviye/` genealogy route wired into sitemap/search/Pagefind/dist smoke with a root rollback fallback. QA: `validate:static-publication` ✅ (`audit-pro` 165 passed · 0 warnings · 0 errors), `workflows:check` ✅, `source:links:dist` ✅ (hard-check passed; warnings only), `strangler:deploy-readiness` ✅, final `strangler:audit:production-like` ✅, `smoke:maps` ✅, `smoke:maps:mobile` ✅, `smoke:content:mobile` ✅, `npm audit --omit=dev` ✅ (0 vulns). |
| **AGENTS-r231** | 2026-06-18 | **🔥 DEPLOY SWITCH EXECUTED + critical CSS/SEO regression fix.** Production GitHub Pages artifact switched from repo root to Astro/strangler `dist` (deploy.yml `path: dist`, first successful deploy). Two regressions that were blocking + would have broken the switch: (1) **CSS**: 41/50 public dist pages had zero project CSS — `BaseLayout.astro` never linked `css/site.css`/`fonts/fonts.css`; `legacyShadow.ts` dropped inline `<style>` blocks (incl. /karty/avraam/'s 1138-line map stylesheet) and CSP meta from `<head>`. Fixed both; verified 50/50 dist pages carry CSS. (2) **SEO**: 5 new maps (early-church, maccabim, revelation, shvatim, yeshua) missing `twitter:description/site/creator` + JSON-LD `#organization`/`#website` — sole CI blocker (`seo-audit` 25 errors). Fixed. First-ever green `Deploy to GitHub Pages` ✅. `migration/page-ownership.json` description updated to reflect dist-as-production. |
| **AGENTS-r230** | 2026-06-17 | **MapEngine v0.30: photo gallery dots + clickable nav dots + photo fade animation.** Фото-галерея: для мест с >1 фото — dots-навигация (клик по точке = переключение слайда) + fade-анимация слайдов (mePhotoFadeIn). Одиночные фото — кликабельны (data-атрибуты, без inline onclick). Точки навигации (me-nav__dot) стали кликабельными — переход к конкретному месту. CSS: me-photo-gallery, me-photo-slide, me-photo-nav, me-photo-dot, @keyframes mePhotoFadeIn. Движок v0.29→v0.30 (1586→1622 строк). Все gates: 10/10 ✅, 23/23 ✅, 50/50 ✅. |
| **AGENTS-r229** | 2026-06-17 | **MapEngine v0.29: minimap place dots + click-to-navigate + compass tick marks + story fade.** Миникарта теперь показывает точки мест (color-coded circles) и обновляет viewport-прямоугольник при КАЖДОМ изменении вида (pan/zoom/wheel/flyTo), не только при flyTo. Клик по миникарте = навигация в эту точку. Компас улучшен: фоновая подложка, 12 tick-меток (главные направления выделены), утончённые стрелки. Переключение сюжетов теперь с плавным fade-out маркеров (opacity .2s). Движок v0.28→v0.29 (1549→1586 строк). Все gates: 10/10 ✅, 23/23 ✅, 50/50 ✅. |
| **AGENTS-r228** | 2026-06-17 | **MapEngine v0.28: label backgrounds + stage path glow on active place.** Метки (label) получили фоновый `<rect>` с полупрозрачной подложкой `rgba(7,10,16,.75)` + border — читаемость поверх карты резко улучшена. При открытии места соответствующий этапный путь подсвечивается (opacity 0.3→0.8, stroke-width 2.5→4), остальные пути затемняются. При закрытии панели все пути возвращаются к равной яркости. Движок v0.27→v0.28 (1515→1549 строк). Все gates: 10/10 ✅, 23/23 ✅, 50/50 ✅. |
| **AGENTS-r227** | 2026-06-17 | **MapEngine v0.27: panel backdrop + content entrance animation + search pulse + caption micro-animation.** Panel backdrop создаётся в DOM, синхронизируется с open/close, добавляет `body{overflow:hidden}` при открытии. Контент панели получает spring-вход (translateY + opacity). Тур-подпись (caption) анимируется микро-сдвигом 10px→0. Поиск пульсирует найденные маркеры (r:4.5→7 с отскоком). Движок v0.26→v0.27 (1485→1515 строк). Все gates: 10/10 ✅, 23/23 ✅, 50/50 ✅. |
| **AGENTS-r226** | 2026-06-17 | **MapEngine v0.26: SVG arrowheads + parallax compass + outer ring markers.** На stage-путях добавлены directional arrowheads через SVG `<marker>` (треугольники цвета этапа с `orient="auto"`). Компас получил parallax-поворот: `rotate(tiltX)` на основе позиции viewport (извлечено из Авраама). Маркеры получили внешнее кольцо: активное — видимое с glow, hover — расширяется. Индексы circle:nth-child обновлены (2→3) во всех обработчиках. Движок v0.25→v0.26 (1459→1485 строк). Все gates: 10/10 ✅, 23/23 ✅, 50/50 ✅. |
| **AGENTS-r225** | 2026-06-17 | **MapEngine v0.25: CSS-дедупликация (6.1x), SVG-фильтры, анимации.** CSS-блок внутри `createMap()` сокращён с 1074 до 252 строк (дедупликация 32 копий → 1-2). Файл движка: 2235→1459 строк, 161KB→78KB (-51.6%). Добавлены SVG `<defs>`: 5 фильтров (`me-glow`, `me-glow-strong`, `me-shadow`, `me-gold-glow`) + радиальный градиент. Улучшены анимации: spring-вход маркеров (cubic-bezier), анимация отрисовки путей (stroke-dashoffset), клик-пульсация, улучшенный ripple с ease-out cubic, hover-свечение через SVG-фильтры вместо CSS drop-shadow. Исправлен баг `_timer`→`_tm`. Все gates: 10/10 ✅, 23/23 ✅, 50/50 ✅. |
| **AGENTS-r215** | 2026-06-17 | **MapEngine v0.10: data-layer маркеры + контентный поиск.** Маркеры теперь имеют `data-layer` (stage-{n}, type) и `data-place-id` атрибуты, что делает toggle-переключатели слоёв реально работающими. Поиск расширен: теперь ищет не только по названию места, но и по story/bible/arch/kick/id1/id2 — находит места по ключевым словам внутри контента. Все 10 карт получили layer definitions. Движок v0.9→v0.10 (1038→1056 строк). Avraam:audit 23/23 ✅. |
| **AGENTS-r214** | 2026-06-17 | **MapEngine v0.9: извлечены timeline + layer toggles из Авраама в движок.** Timeline компонент (кликабельные точки этапов с эрами и подписями) и панель переключения слоёв (toggle switches с цветовыми точками) теперь часть `createMap()`. Timeline автоматически включается если stages > 1. Слои включаются через `opts.layers` или `route.layers`. Движок v0.8→v0.9 (896→1038 строк, +142). 3 карты получили layer definitions: ishod, avraam (reference), pavel. Стратегия извлечения фич из Авраама зафиксирована в AGENTS.md §12.5.6: правило «НЕ трогать Авраама, извлекать фичи в движок, тестировать на ishod/pavel, затем коммитить». Все gates: maps:validate 10/10 ✅, avraam:audit 23/23 ✅. |
| **AGENTS-r213** | 2026-06-17 | **MapEngine v0.8: photo modal + intro screen extracted into engine. Профессиональная стратегия развития.** Фото-модалка (`openPhoto`, полноэкранный просмотр с подписью и кредитом) и интро-экран (заголовок/иврит/подзаголовок/статистика/кнопка «Начать») вынесены из Авраама в движок `createMap()`. Теперь все 10 карт получают эти фичи автоматически. Интро включается через `opts.showIntro` (по умолчанию true). Стратегия зафиксирована в `docs/MAPENGINE_PROFESSIONAL_STRATEGY_2026-06-17.md`: (1) Авраам НЕ трогать — свой рендеринг, защищён аудитом 23/23; (2) Усиливать движок извлечением HIGH→MEDIUM→LOW reuse фич; (3) Новые карты = ТОЛЬКО движок; (4) Когда движок накопит 80%+ фич Авраама — можно будет портировать. Движок: v0.7.0→v0.8.0 (799→896 строк, +97). Все gates: maps:validate 10/10 ✅, avraam:audit 23/23 ✅, contract 50/50 ✅. |
| **AGENTS-r212** | 2026-06-17 | **MapEngine architecture documentation + regression protection.** Добавлен §12.5 в AGENTS.md с полной документацией: структура файлов, история критических регрессий (модульный рефакторинг сломал Авраама и Исход — данные были выпотрошены, карта восстановлена как монолит), текущая архитектура (780 строк, 0 module references, 19 event listeners без removeEventListener), таблица использования движка картами (avraam=DATA only, остальные=createMap), правила создания новой карты, правила правки движка (НИКОГДА не удалять функции, всегда проверять avraam:audit), список известных долгов. Цель: предотвратить повторение регрессий `c94a3298`–`22abf658`. |
| **AGENTS-r211** | 2026-06-16 | ~~MapEngine v0.3: полный рендеринг-движок + карта Павла~~ **SUPERSEDED — часть описания неточна.** Движок `MapEngine.createMap()` реален и работает, но «Исход переписан на движок (652→50 строк)» неверно: ishod и avraam остались legacy-shadow обёртками. Точные цифры использования — в §12.5.3. |
| **AGENTS-r210** | 2026-06-16 | **Baptisty-Rossii GBS2 shell ported to Astro + Nagornaya shadow guard strengthened.** Создан `SeriesArticleLayout.astro` (292 строки): полноценный GBS2 shell для серии «Баптисты России» — desktop sidebar rail с 10 частями (обложки + reading times + прогресс-ринг), gbs2-next/prev навигация с обложками, gbs2-timeline (5 эпох: 1867→1991), mobile header/sheet/bbar, авторская карточка с редакционным принципом. Все 10 `src/pages/baptisty-rossii/*/index.astro` обновлены на новый layout. `legacy-shadow-wrapper-audit.js` расширен: добавлены nagornaya/index, istochniki, nakhodki, seriya в ROUTES, включён guard на `tw.min.css` (проверка наличия и размера). Nagornaya (9 страниц, 16K слов, Tailwind) оставлена как shadow wrappers согласно AGENTS policy. Итог: page-ownership ✅, contract:compare 42/42 ✅, maps:validate 2/2 ✅. |
| **AGENTS-r209** | 2026-06-16 | ~~React MapApp upgraded to production-quality~~ **SUPERSEDED — phantom entry.** См. r208: React `MapApp.tsx` в коде отсутствует. Реальная функциональность карт — vanilla `MapEngine` (§12.5). |
| **AGENTS-r208** | 2026-06-16 | ~~Map Engine Astro/React/Tailwind extraction pilot~~ **SUPERSEDED — phantom entry.** Описывает React+Tailwind `MapApp.tsx`, которого в коде/пакетах НЕТ (`package.json` без react/@astrojs/react/@astrojs/tailwind; `astro.config.mjs` без React/Tailwind integrations). Реальная архитектура карт — vanilla `MapEngine` (`karty/_engine/map-engine.js`) + `createMap()` (см. §12.5). Запись оставлена для истории, но НЕ воспринимать как описание актуального стека. |
| **AGENTS-r207** | 2026-06-16 | **Home hierarchy pass continued into paired desktop/mobile entry strips.** Hero получил desktop entry strip с основными входами, а leading series shelf (`Биографии` + `Нагорная`) теперь читается как единый paired feature shelf. Mobile rails дополнительно усилились progress dots / tighter pacing. Tailwind policy остаётся зафиксированной как route-scoped exception, не базовый курс проекта. Итог: `audit-pro` 164 passed · 0 errors, `validate:static-publication` ✅, `astro-home-pilot-audit` ✅. |
| **AGENTS-r206** | 2026-06-15 | **Home shelf hierarchy strengthened again: key series now read as a true paired entry shelf, with clearer rail pacing.** Блоки ведущих серий (`Биографии` + `Нагорная`) собраны в единую featured shelf-иерархию; mobile rails получили progress dots и tighter card widths, чтобы shelf-flow читался как библиотечный вход, а не как бесконечная лента. Tailwind policy остаётся локально-исключительной: никакого общего utility-first курса для всего сайта. Итог: `audit-pro` 164 passed · 0 errors, `validate:static-publication` ✅, `astro-home-pilot-audit` ✅. |
| **AGENTS-r205** | 2026-06-15 | **Tailwind policy formalized + home shelf hierarchy strengthened.** В AGENTS закреплено: Tailwind не является общим курсом проекта; он допустим только в route-scoped / app-scoped / explicitly approved self-contained contexts, тогда как `/`, обычные article pages, shared Astro layouts и legacy-faithful wrappers остаются на handcrafted CSS. Home page получила ещё более явную shelf hierarchy для ключевых и будущих серий на mobile+desktop. Итог: `audit-pro` 164 passed · 0 errors, `validate:static-publication` ✅, `astro-home-pilot-audit` ✅. |
| **AGENTS-r204** | 2026-06-15 | **Home premium polish continued with subtle 3D tilt and denser lower-half rhythm.** Для home cards/featured/about/quote на pointer-fine добавлен лёгкий interactive tilt/gloss layer без смены mobile parity, а lower-half mobile blocks дополнительно уплотнены. CSS и JS контракты остаются зелёными: `audit-pro` 164 passed · 0 errors, `validate:static-publication` ✅, `astro-home-pilot-audit` ✅. По факту CSS работает стабильно; открытые долги — budget warning и дальнейший visual polish, не runtime-breakage. |
| **AGENTS-r203** | 2026-06-15 | **Home mobile premium pass continued into the lower half of the page.** На mobile сжаты tertiary shelves (`В планах`), section `О проекте` и scripture-quote block стали компактнее и карточнее; это дополнительно снимает ощущение длинной «портянки» после первых shelf-блоков. Итог: `audit-pro` 164 passed · 0 errors, `validate:static-publication` ✅, `astro-home-pilot-audit` ✅. Production deploy всё ещё legacy root; 42/42 public shadow ownership unchanged. |
| **AGENTS-r202** | 2026-06-15 | **Home mobile premium pass continued: shelves and library-density reduced the remaining “long article strip” feel.** На мобильной главной section `Форматы библиотеки` стал компактной 2-column quick grid вместо длинной вертикальной пачки карточек; публикации и апологетический rail получили shelf-head framing, чтобы mobile home читался как библиотека с полками, а не как бесконечная лента. Итог: `audit-pro` 164 passed · 0 errors, `validate:static-publication` ✅, `astro-home-pilot-audit` ✅, push to `main` completed. Production deploy всё ещё legacy root; dist ownership/42-page contract unchanged. |
| **AGENTS-r201** | 2026-06-15 | **Home mobile premium pass continued without deploy switch.** Главная `/` получила first-screen library chooser `.h-mobile-hero-hub`, более компактный mobile hero rhythm, accentuated search/dock hierarchy и resume-first re-entry ordering: сохранённое чтение теперь показывается раньше dashboard, а не после длинного скролла. `astro-home-pilot-audit` и `audit-pro` home contract усилены новым guard на `.h-mobile-hero-hub`. Итог: `audit-pro` 164 passed · 0 errors, `validate:static-publication` ✅, `astro-home-pilot-audit` ✅, `page-ownership:dist:production-like` ✅, `contract:compare:dist` 42/42 ✅. Production deploy всё ещё legacy root; visual/browser smoke в полноценной env остаётся отдельным обязательным шагом. |
| **AGENTS-r200** | 2026-06-15 | **Public shadow ownership reached 42/42 baseline pages (100%) in `dist`; production deploy still legacy root.** Added cleanup/hardening batch over raw coverage growth: shadow home page moved closer to legacy mobile IA, `/konfessii/russkij-baptizm/` wrapper became Astro-owned, `/karty/ishod/` became Astro prelaunch route, `/map/` became Astro shadow wrapper, and all five `nagornaya/chast-*` pages were promoted via legacy-faithful Astro shadow wrappers. New guards: `astro:audit:home`, `astro:audit:ishod`, `astro:audit:baptisty-series`, `astro:audit:legacy-wrappers`; `dist-publication-audit` and Pagefind now require all 42 public shadow routes. Итог: `audit-pro` 154 passed · 0 errors, `validate:static-publication` ✅, `contract:compare:dist` 42/42 ✅, production-like dist publication + Pagefind source pages 42/42 ✅. Progress: public shadow ownership 100%, build-time strangler readiness ~98%, safety/gates ~96%, production migration still 0–3%, deploy.yml unchanged until explicit owner decision. |
| **AGENTS-r199** | 2026-06-15 | **Nagornaya reference pages shadow-owned: `/nagornaya/istochniki/` and `/nagornaya/nakhodki/`.** Added Astro routes for sources bibliography and verified findings pages; ownership manifest promoted both to `astro` / `shadow-pilot`. Dist publication audit, dry-run workflow and workflow policy now require `dist/nagornaya/istochniki/index.html` and `dist/nagornaya/nakhodki/index.html` and verify Astro-owned/indexable/public canonical. Production-like dist: 42 public pages, explicit Astro baseline routes 21/42 (50%), implicit legacy routes 21. Progress: overall Astro/MDX ~59%, safety/gates ~93%, build-time strangler readiness ~92%, public shadow ownership at halfway point; production migration still 0–3%, deploy.yml unchanged. |
| **AGENTS-r198** | 2026-06-15 | **Next landing batch shadow-owned: `/karty/`, `/konfessii/`, `/nagornaya/seriya/` added after `/nagornaya/`.** Added Astro routes for biblical maps, confessions/denominations, and Nagornaya series index; ownership manifest promoted all to `astro` / `shadow-pilot`. Dist publication audit, dry-run workflow and workflow policy now require these landing files and verify Astro-owned/indexable/public canonical. Production-like dist: 42 public pages, explicit Astro baseline routes 19/42 (~45%), implicit legacy routes 23. Progress: overall Astro/MDX ~57%, safety/gates ~92%, build-time strangler readiness ~91%, public shadow ownership expanding; production migration still 0–3%, deploy.yml unchanged. |
| **AGENTS-r197** | 2026-06-15 | **`/nagornaya/` landing получил Astro shadow ownership.** Added `src/pages/nagornaya/index.astro`; ownership manifest promoted `/nagornaya/` to `astro` / `shadow-pilot`. Page preserves legacy title/H1/description/canonical/OG contract, CollectionPage/BreadcrumbList JSON-LD, data-pagefind-body and links to 5 legacy Nagornaya parts. Dist publication audit, dry-run workflow and workflow policy now require `dist/nagornaya/index.html` and verify `/nagornaya/` as Astro-owned, indexable, public canonical. Production-like dist: 42 public pages, explicit Astro baseline routes 16/42 (~38%), implicit legacy routes 26. Progress: overall Astro/MDX ~55%, safety/gates ~92%, build-time strangler readiness ~90%, public shadow ownership expanding; production migration still 0–3%, deploy.yml unchanged. |
| **AGENTS-r196** | 2026-06-15 | **`/biografii/` landing получил Astro shadow ownership.** Added `src/pages/biografii/index.astro`; ownership manifest promoted `/biografii/` to `astro` / `shadow-pilot`. Page preserves legacy title/H1/description/canonical/OG contract, CollectionPage/BreadcrumbList JSON-LD, data-pagefind-body, era sections and Gill links. Dist publication audit, dry-run workflow and workflow policy now require `dist/biografii/index.html` and verify `/biografii/` as Astro-owned, indexable, public canonical. Production-like dist: 42 public pages, explicit Astro baseline routes 15/42 (~36%), implicit legacy routes 27. Progress: overall Astro/MDX ~53%, safety/gates ~92%, build-time strangler readiness ~90%, MDX/article pipeline ~96%, landing/catalog shadow expanding; production migration still 0–3%, deploy.yml unchanged. |
| **AGENTS-r195** | 2026-06-15 | **Series landing shadow pass: `/hard-texts/` and `/pastor-series/` added as Astro shadow routes.** Added `src/pages/hard-texts/index.astro` and `src/pages/pastor-series/index.astro`; ownership manifest promoted both to `astro` / `shadow-pilot`. Both pages preserve legacy title/H1/description/canonical/OG contracts, CollectionPage/BreadcrumbList JSON-LD and data-pagefind-body, linking to already migrated article routes. Dist publication audit, dry-run workflow and workflow policy now require `dist/hard-texts/index.html` and `dist/pastor-series/index.html` and verify both are Astro-owned, indexable, public canonical. Production-like dist: 42 public pages, explicit Astro baseline routes 14/42 (~33%), implicit legacy routes 28. Progress: overall Astro/MDX ~52%, safety/gates ~92%, build-time strangler readiness ~89%, MDX/article pipeline ~96%, series landing shadow ~30%, production migration still 0–3%; deploy.yml unchanged. |
| **AGENTS-r194** | 2026-06-15 | **`/articles/` catalog получил Astro shadow ownership после завершения 10/10 article pages.** Добавлен `src/pages/articles/index.astro` с CollectionPage/BreadcrumbList JSON-LD, data-pagefind-body, legacy title/H1/description/canonical/OG contract и карточками всех ключевых материалов. `migration/page-ownership.json` перевёл `/articles/` в `astro` / `shadow-pilot`; `dist-publication-audit`, dry-run workflow и workflow policy теперь требуют `dist/articles/index.html` и проверяют, что `/articles/` Astro-owned, indexable и с public canonical. Production-like dist: 42 public pages, explicit Astro baseline routes `/about/`, `/articles/` + 10 articles (12/42 ≈29%), implicit legacy baseline routes 30. Progress: overall Astro/MDX ~50%, safety/gates ~92%, build-time strangler readiness ~88%, MDX/article pipeline ~96%, article catalog shadow 100%, production migration still 0–3%; deploy.yml unchanged. |
| **AGENTS-r193** | 2026-06-15 | **Article shadow migration complete: 10/10 article pages now have public MDX/Astro shadow routes in `dist`.** Финальный article route `/articles/20-antisovetov-pastoru/` добавлен с MDX entry и Astro route; ownership manifest перевёл URL в `astro` / `shadow-pilot`. Multi-article strict audit now checks all 10 articles; final article parity: 13590/13563 words (1.00), H2 17/17, exact SEO/article meta/Article JSON-LD/BreadcrumbList. Dist publication audit, dry-run workflow and workflow policy require all 10 article shadow files. Production-like dist: 42 public pages, explicit Astro baseline routes `/about/` + 10 articles (11/42 ≈26%), implicit legacy baseline routes 31. Progress: overall Astro/MDX ~48%, safety/gates ~91%, build-time strangler readiness ~87%, MDX/article pipeline ~95%, articles shadow-owned 10/10 (100%), production migration still 0–3%; deploy.yml unchanged. |
| **AGENTS-r192** | 2026-06-15 | **Article migration near-complete: добавлены 8-й и 9-й public MDX shadow routes — `krajne-li-isporcheno-serdce` и `hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki`.** Добавлены MDX entries и Astro routes; ownership manifest перевёл оба URL в `astro` / `shadow-pilot`. `ArticleLayout.astro` получил author display mapping для `abner-chou`, чтобы article meta/JSON-LD Абнера Чау зеркалили legacy. Multi-article strict audit теперь проверяет 9 article routes; новые parity: Jeremiah 17 8005/8250 words (0.97), H2 19/19; Hermeneutics 9887/10056 words (0.98), H2 7/7. Dist publication audit, dry-run workflow и workflow policy require all 9 article shadow files. Production-like dist: 42 public pages, explicit Astro baseline routes `/about/` + 9 articles, implicit legacy baseline routes 32. Progress: overall Astro/MDX ~45%, safety/gates ~90%, build-time strangler readiness ~85%, MDX/article pipeline ~87%, articles shadow-owned 9/10 (90%), public shadow ownership 10/42 pages (~24%); production migration still 0–3%, deploy.yml unchanged. |
| **AGENTS-r191** | 2026-06-15 | **Gill article batch completed: 6-й и 7-й public MDX shadow routes — `dzhon-gill-chast-2-uchenyi` и `dzhon-gill-chast-3-nasledie`.** Добавлены MDX entries и Astro routes для `/articles/dzhon-gill-chast-2-uchenyi/` и `/articles/dzhon-gill-chast-3-nasledie/`; ownership manifest перевёл оба URL в `astro` / `shadow-pilot`. Multi-article strict audit теперь проверяет 7 article routes; новые parity: Gill часть II 6789/6837 words (0.99), H2 5/5; Gill часть III 9408/9469 words (0.99), H2 4/4. Dist publication audit, dry-run workflow и workflow policy require all 7 article shadow files. Production-like dist: 42 public pages, explicit Astro baseline routes `/about/` + 7 articles, implicit legacy baseline routes 34. Progress: overall Astro/MDX ~40%, safety/gates ~89%, build-time strangler readiness ~82%, MDX/article pipeline ~68%, articles shadow-owned 7/10 (70%), public shadow ownership 8/42 pages (~19%); production migration still 0–3%, deploy.yml unchanged. |
| **AGENTS-r190** | 2026-06-15 | **Большой article pass: добавлены 4-й и 5-й public MDX shadow routes — `kod-da-vinchi` и `dzhon-gill-chast-1-chelovek`.** Добавлены MDX entries и Astro routes для `/articles/kod-da-vinchi/` и `/articles/dzhon-gill-chast-1-chelovek/`; ownership manifest перевёл оба URL в `astro` / `shadow-pilot`. Multi-article strict audit теперь проверяет 5 article routes: Gill справочник (0.95), Gill исторический контекст (0.99), Romans 7 (0.93), Kod da Vinci (1.01), Gill часть I (0.99), все с exact title/description/H1/OG/article meta/Article JSON-LD/BreadcrumbList and H2 parity. Dist publication audit, dry-run workflow and workflow policy require all 5 article shadow files. Production-like dist: 42 public pages, explicit Astro baseline routes `/about/` + 5 articles, implicit legacy baseline routes 36. Progress: overall Astro/MDX ~35%, safety/gates ~88%, build-time strangler readiness ~80%, MDX/article pipeline ~49%, articles shadow-owned 5/10 (50%), public shadow ownership 6/42 pages (~14%); production migration still 0–3%, deploy.yml unchanged. |
| **AGENTS-r189** | 2026-06-15 | **Третий article MDX shadow route добавлен: `rimlyanam-7-veruyushchiy-ili-neveruyushchiy`.** Добавлены `src/content/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy.mdx` и public shadow route `src/pages/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/index.astro`; ownership manifest перевёл `/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/` в `astro` / `shadow-pilot`. Multi-article strict audit теперь проверяет 3 public shadow articles: Gill справочник (0.95 ratio, H2 12/12), Gill исторический контекст (0.99 ratio, H2 13/13), Romans 7 (0.93 ratio, H2 14/14). Dist publication audit, dry-run workflow and workflow policy require all 3 article shadow files. Production-like dist: 42 public pages, explicit Astro baseline routes `/about/` + 3 articles, implicit legacy baseline routes 38; production deploy remains root legacy. Progress: overall Astro/MDX ~31%, safety/gates ~87%, build-time strangler readiness ~77%, MDX/article pipeline ~37%, production migration still 0–3%. |
| **AGENTS-r188** | 2026-06-15 | **Второй article MDX shadow route добавлен по той же guarded-схеме: `dzhon-gill-istoricheskiy-kontekst`.** Добавлены `src/content/articles/dzhon-gill-istoricheskiy-kontekst.mdx` и `src/pages/articles/dzhon-gill-istoricheskiy-kontekst/index.astro`; ownership manifest перевёл `/articles/dzhon-gill-istoricheskiy-kontekst/` в `astro` / `shadow-pilot`. `article-mdx` audit теперь multi-article и проверяет 2 public shadow routes: справочник (1611/1694 words, H2 12/12) и исторический контекст (2954/2969 words, H2 13/13), оба с exact legacy SEO/article meta/Article JSON-LD/BreadcrumbList parity. `dist-publication-audit`, dry-run workflow и workflow policy теперь требуют оба article shadow files. Production-like dist: 42 public pages, explicit Astro baseline routes `/about/`, `/articles/dzhon-gill-spravochnik/`, `/articles/dzhon-gill-istoricheskiy-kontekst/`; deploy.yml не менялся. |
| **AGENTS-r187** | 2026-06-15 | **Redundant `/dev/article-mdx-pilot/` canary retired after public article shadow route was fully guarded.** Removed `src/pages/dev/article-mdx-pilot/index.astro` and its ownership entry; `scripts/article-mdx-pilot-audit.js` is now a public shadow audit that requires the retired dev preview route to stay absent while checking `/articles/dzhon-gill-spravochnik/` in `dist` against legacy SEO/content contract. This reduces dev surface: only `/dev/astro-test/` remains build-only. Production-like dist still requires `/dev/article-mdx-pilot/` absence via dry-run and dist publication audits. Production deploy remains root legacy. |
| **AGENTS-r186** | 2026-06-15 | **Dist publication audit теперь явно защищает первый article shadow route и оба dev routes.** `scripts/dist-publication-audit.js` требует `dist/articles/dzhon-gill-spravochnik/index.html`, проверяет что он Astro-owned, indexable, с public canonical и без pilot/noindex copy. Production-like `--forbid-dev` теперь запрещает не только `/dev/astro-test/`, но и `/dev/article-mdx-pilot/`; sitemap audit также падает, если legacy sitemap/partial output вдруг содержит `/dev/article-mdx-pilot/`. Это закрывает gap между article-specific shadow audit и general dist publication audit перед manual Dist Strangler Dry Run. Production deploy не переключён. |
| **AGENTS-r185** | 2026-06-15 | **Article shadow gate включён в общий deploy-readiness/dry-run policy.** `strangler:deploy-readiness` теперь запускает не только `astro:audit:about` и production-like dist audit, но и `astro:audit:article-mdx:strict`, чтобы первый public Astro article shadow route нельзя было обойти перед будущим dist dry-run/deploy-switch решением. `.github/workflows/dist-dry-run.yml` дополнительно проверяет наличие `dist/articles/dzhon-gill-spravochnik/index.html` и отсутствие обоих build-only dev routes: `dist/dev/astro-test/index.html` и `dist/dev/article-mdx-pilot/index.html`. `scripts/check-workflows.js` защищает эти требования от удаления. Production deploy по-прежнему root legacy; `deploy.yml` не переключён. |
| **AGENTS-r184** | 2026-06-15 | **Первый MDX article получил public shadow ownership в `dist` без production deploy switch.** Добавлен `src/pages/articles/dzhon-gill-spravochnik/index.astro`; `migration/page-ownership.json` перевёл `/articles/dzhon-gill-spravochnik/` в `owner: astro`, `status: shadow-pilot`, `risk: 2`. `copy-legacy-to-dist` теперь пропускает legacy copy этой статьи в `dist`, но repository root legacy HTML остаётся production truth. `scripts/article-mdx-pilot-audit.js` переведён в shadow audit: проверяет public Astro route на indexable canonical, title/description/H1/OG/article meta, Article JSON-LD, BreadcrumbList, отсутствие pilot note, H2/word parity (1611/1694 = 0.95), а `/dev/article-mdx-pilot/` остаётся noindex с dev canonical и intended public canonical. Production-like dist: 42 public pages, explicit Astro baseline routes `/about/` и `/articles/dzhon-gill-spravochnik/`, dev routes omitted; deploy.yml не менялся. |
| **AGENTS-r183** | 2026-06-15 | **Первый MDX article pilot доведён до strict body/SEO parity, оставаясь build-only/noindex.** `src/content/articles/dzhon-gill-spravochnik.mdx` получил curated body draft по legacy article: word parity 1630/1694 (0.96), H2 parity 12/12. `Seo.astro`/`BaseLayout.astro` поддерживают article-aware meta (`og:type=article`, `article:published_time`, `article:modified_time`, `article:author`), `ArticleLayout.astro` добавляет Article URL/mainEntityOfPage и BreadcrumbList JSON-LD на intended public canonical. `scripts/article-mdx-pilot-audit.js` усилен: теперь проверяет article meta, BreadcrumbList, Article URL/mainEntityOfPage/author и в strict режиме требует H2/body parity. `npm run astro:audit:article-mdx:strict` проходит, но public `/articles/dzhon-gill-spravochnik/` всё ещё byte-identical legacy copy; production deploy не переключён. |
| **AGENTS-r182** | 2026-06-15 | **MDX article pilot получил metadata parity audit против legacy article.** Добавлен `scripts/article-mdx-pilot-audit.js` и npm `astro:audit:article-mdx` / `:no-build` / `:strict`. Audit строит strangler `dist`, проверяет, что public `/articles/dzhon-gill-spravochnik/` остался byte-identical legacy copy, а `/dev/article-mdx-pilot/` остаётся `noindex` с dev canonical, но mirrors legacy title/description/H1/OG image/dates/Article JSON-LD и intended public canonical. Body parity пока advisory: 208/1694 words (0.12), поэтому strict режим оставлен для следующего шага после полного MDX body draft. |
| **AGENTS-r181** | 2026-06-15 | **Начат build-only MDX/article content pipeline без production switch.** Добавлены `src/content.config.ts` с `articles` collection + Zod schema, draft/noindex `src/content/articles/dzhon-gill-spravochnik.mdx`, статический `ArticleLayout.astro`, noindex preview `/dev/article-mdx-pilot/` и npm `astro:pilot:article-mdx`. `migration/page-ownership.json` объявляет preview route как `astro-noindex`/`build-only`, поэтому обычный strangler build проверяет его noindex, а production-like dist удаляет вместе с `/dev/astro-test/`. `astro check/build` снова 0 errors/0 warnings/0 hints. Legacy `/articles/dzhon-gill-spravochnik/` и production deploy не менялись. |
| **AGENTS-r180** | 2026-06-15 | **copy-legacy-to-dist получил dry-run и operation manifest для auditability.** Добавлен npm `strangler:copy:dry-run`; `scripts/copy-legacy-to-dist.js` теперь поддерживает `--dry-run` (не мутирует `dist/`), пишет ignored reports `reports/dist-copy-dry-run-manifest.json` / `reports/dist-copy-manifest.json`, фиксирует copied files/bytes/routes, skipped Astro-owned pages, preserved existing dist files, removed partial Astro sitemaps и omitted build-only routes. Это закрывает copy-legacy safety gap перед будущими batch migrations/deploy-switch без изменения production deploy. |
| **AGENTS-r179** | 2026-06-15 | **Build-time strangler получил page ownership guard перед deploy-switch.** Добавлен `scripts/check-page-ownership.js` и npm `page-ownership:check`, `page-ownership:dist`, `page-ownership:dist:production-like`; `validate:static-publication` теперь проверяет manifest/source coverage, а `strangler:validate`/`strangler:audit*` проверяют ownership сразу после build/copy. Guard требует, чтобы все `src/pages/*` Astro routes были объявлены в `migration/page-ownership.json`, Astro source route совпадал с route key, `/about/` в `dist` не был legacy-copy overwrite, build-only `/dev/astro-test/` отсутствовал в production-like `dist`, built-app `_app/` был скопирован и noindex, а 42 baseline public URLs resolve в `dist`. `scripts/check-workflows.js` дополнительно защищает package gates и будущий dist deploy от удаления ownership check. Production deploy не менялся: root всё ещё публикуется как legacy. |
| **AGENTS-r178** | 2026-06-14 | **Dist deploy-like checks усилены: Pagefind/SW/sitemap/publication audit для strangler output.** Добавлены `scripts/dist-publication-audit.js` и `scripts/build-pagefind.js`; npm `strangler:audit`, `strangler:audit:pagefind`, `pagefind:build`, `pagefind:build:dist`. Audit проверяет required files, отсутствие private dirs, отсутствие частичных Astro `sitemap-index.xml/sitemap-N.xml`, резолв всех legacy sitemap locs в dist, canonical robots sitemap, Astro ownership `/about/`, no technical scaffold copy, dev noindex, SW precache assets, Pagefind presence when required. Первый запуск поймал реальные dist issues: partial Astro sitemap files рядом с legacy sitemap, unstable npx/npm exec Pagefind syntax, и необходимость копировать `sw.js`; исправлено: `copy-legacy-to-dist.js` удаляет partial Astro sitemaps и копирует `sw.js`, `build-pagefind.js` стабильно вызывает Pagefind через npm exec wrapper, `deploy.yml` использует `npm run pagefind:build`. `strangler:audit:pagefind` green: dist publication audit passed, contract 42/42, dist smoke passed. |
| **AGENTS-r177** | 2026-06-14 | **Strangler dist получил representative smoke audit; пойманы и закрыты первые реальные dist-проблемы.** Добавлен `scripts/dist-smoke-audit.js` и npm `strangler:smoke`/`strangler:smoke:shots`: строит `dist`, поднимает local static server и проверяет representative URLs desktop+mobile (`/`, `/about/`, `/articles/`, `kod-da-vinchi`, `/karty/`, `/karty/avraam/`, `/konfessii/`, `/konfessii/russkij-baptizm/`, `/map/`, `/404.html`, `/dev/astro-test/`) на status 200, canonical/H1 basics, overflow=0, pageerrors, iframe wrapper. Первый запуск выявил: (1) `sw.js` не копировался в `dist` → 404 при SW registration на legacy pages; (2) Astro scaffold давал mobile overflow 18px из-за отсутствия global `box-sizing:border-box`. Исправлено: `sw.js` добавлен в `copy-legacy-to-dist` root files, `src/styles/global.css` получил global box-sizing. Повторный `strangler:smoke` green. |
| **AGENTS-r176** | 2026-06-14 | **Astro public `/about/` очищен от scaffold-технических надписей; dev markers оставлены только на `/dev/astro-test/`.** `Header.astro`/`Footer.astro` теперь принимают optional `badge`/`note`, `BaseLayout` прокидывает `technicalBadge`/`footerNote`; публичный `/about/` не показывает «Astro scaffold · noindex» и «Технический прототип, не production switch», а dev page продолжает показывать их явно. `astro-about-pilot-audit` усилен: падает, если public `/about/` снова содержит technical scaffold copy. QA: `astro:audit:about` сохраняет ratio 0.90+ и h2 parity. |
| **AGENTS-r175** | 2026-06-14 | **Astro `/about/` pilot parity polish: закрыты smoke-notes по heading/link/content.** Astro about дополнен ресурсными ссылками (YouTube/Rutube/Telegram/VK/Dzen/Facebook), contact grid (Telegram/VK/Email/Max), блоком «Нашли неточность?» и эпиграфом Авв. 3:19. Повторный `astro:audit:about`: legacy 605 words vs Astro 550 (ratio 0.91), все H2 совпадают включая «Нашли неточность?», прежние notes о missing heading и too-few links исчезли. Production ownership всё ещё НЕ переключён; перед rollout нужен ручной visual review, но content/SEO smoke теперь близок к legacy. |
| **AGENTS-r174** | 2026-06-14 | **Astro about pilot получил автоматический legacy-vs-dist smoke audit.** Добавлен `scripts/astro-about-pilot-audit.js` и npm scripts `astro:audit:about` / `astro:audit:about:shots`: скрипт строит strangler dist, поднимает два локальных static server (legacy root и dist), сравнивает `/about/` по title/canonical/H1/word-count/JSON-LD basics, проверяет overflow/pageerrors и может сохранять screenshots в ignored `reports/`. Локальный legacy CSP-шум от absolute `https://gospod-bog.ru/...` favicon/icon URL фильтруется как не-production false positive. Текущий результат: legacy 605 words vs Astro 458 (ratio 0.76), smoke pass; notes: Astro pilot пока без H2 «Нашли неточность?» и с меньшим числом contact links — это не blocker для shadow, но перед rollout нужен ручной visual/content review. |
| **AGENTS-r173** | 2026-06-14 | **Build-time strangler prototype готов локально: `dist` = Astro-owned `/about/` + copied legacy pages.** Добавлены `migration/page-ownership.json` и `scripts/copy-legacy-to-dist.js`; npm scripts `strangler:build`/`strangler:validate`. Алгоритм: `astro:build` сначала clean `dist`, затем copy legacy public files/dirs, не перезаписывая Astro-owned routes (`/about/`, `/dev/astro-test/`). `/konfessii/russkij-baptizm/_app/` отмечен как built-app/copy-as-built-asset. `strangler:validate` создаёт полный local dist: copied 442 files (~44MB), Astro-owned legacy `/about/` skipped, `contract:extract:dist` видит 42 public pages, `contract:compare:dist` сравнивает 42/42 baseline URLs без ошибок. Production deploy всё ещё НЕ переключён на `dist`; sitemap/feed/SW пока legacy-copied. Документ: `BUILD_TIME_STRANGLER_PROTOTYPE_STATUS_2026-06-14.md`. |
| **AGENTS-r172** | 2026-06-14 | **Astro `/about/` pilot создан в local dist без production switch.** Добавлен `src/pages/about/index.astro` как первая реальная Astro route для shadow-сравнения: сохранены canonical/title/description/H1/robots, JSON-LD graph (Organization/WebSite/Person/ProfilePage/BreadcrumbList), OG image и смысловые секции legacy about. Legacy `about/index.html` не удалялся, deploy.yml всё ещё публикует root, а не `dist`. `compare-url-contract.js` получил `--only-url`; добавлен npm `contract:compare:dist:about`. После `astro:build`, `contract:extract:dist` видит 1 public page, а `contract:compare:dist:about` сравнивает только `https://gospod-bog.ru/about/` и проходит. Документ: `docs/refactor-2026/ASTRO_ABOUT_PILOT_STATUS_2026-06-14.md`. Следующий шаг перед rollout — visual desktop/mobile compare и build-time strangler/copy-legacy, не deploy switch сразу. |
| **AGENTS-r171** | 2026-06-14 | **Astro scaffold Level‑1 создан без production switch.** После pre-Astro baseline tag `pre-astro-refactor-baseline-2026-06-14` добавлен минимальный Astro 6 scaffold: `astro.config.mjs`, `tsconfig.json`, `src/data/site.ts`, `BaseLayout.astro`, SEO/JSON-LD/Header/Footer components, локальные `src/styles/*`, noindex dev page `/dev/astro-test/`. Production deploy path не менялся и legacy HTML не заменялся. Astro 6 требует Node `>=22.12.0`, поэтому `package.json engines` и GitHub Actions `setup-node` переведены на 22; Astro/React/MDX packages находятся в `devDependencies` (build-only). `npm audit --omit=dev` clean; full dev audit advisories по build tools зафиксированы в `ASTRO_SCAFFOLD_STATUS_2026-06-14.md`, без `--force`. Legacy validators теперь игнорируют local `dist/` output. QA: Astro check/build под Node 22.12 — 0 errors/warnings/hints; `validate:static-publication`, `workflows:check`, `konfessii:audit` green. |
| **AGENTS-r170** | 2026-06-14 | **Pre-Astro baseline: audit warning noise closed without risky CSS/runtime deletion.** Перед первым Astro scaffold оставшиеся 3 warnings переведены в корректные контракты: CSS budget теперь считает core CSS отдельно от route-scoped `nagornaya/tw.min.css` (route CSS остаётся info), `site.css` `!important` переведён в hard ratchet `IMPORTANT_CEIL=214` без warning (новые `!important` теперь сразу error; долг +14 над целью 200 остаётся info), большой inline runtime `karty/avraam/index.html` признан известным guarded map-app debt (info), защищён `avraam:audit` и MapEngine extraction plan. Production CSS/HTML/runtime не менялись; audit стал чище без «обмана» и с более строгим ratchet. |
| **AGENTS-r169** | 2026-06-14 | **Перед Astro/refactor закрыты Level‑0 preflight gaps: URL compare + maps route schema/validator + Ishod route consistency.** Без установки Astro, без deploy/runtime/URL изменений: добавлен `scripts/compare-url-contract.js` (`contract:compare`, `contract:compare:dist`) для сравнения baseline vs current/future dist; добавлен `karty/_shared/route.schema.json`; добавлен `scripts/validate-map-routes.js` и npm `maps:validate`; `validate:static-publication` теперь включает `maps:validate` и `contract:compare`; `reports/` добавлен в `.gitignore` и skipDirs `audit-pro`. Найдена и исправлена data-debt в `karty/ishod/route.json`: stories ссылались на отсутствующие `etham/elim/rephidim/aaron_mount`, а stats `places=14` не совпадал с фактическими 7; добавлены 4 минимальных маршрутных узла, stats синхронизирован на 11. Docs обновлены: `AGENT_HANDOFF_NO_REFACTOR`, `NEXT_ACTIONS_PROFESSIONAL_SEQUENCE`, новый `LEVEL0_PREFLIGHT_COMPLETION_2026-06-14.md`. QA: `maps:validate`, `contract:compare`, `validate:static-publication`, `konfessii:audit`, `workflows:check` green. |
| **AGENTS-r168** | 2026-06-14 | **Refactor-2026 handoff принят: Astro + React islands план найден; выполнен первый безопасный Level-0 шаг без runtime-рефакторинга.** После fast-forward на `origin/main` обнаружена новая папка `docs/refactor-2026/` (55+ документов): ADR выбирает Astro + React islands + MDX/content collections; handoff прямо запрещает рефакторинг без отдельного решения владельца. Прочитаны индекс, `AGENT_HANDOFF_NO_REFACTOR_2026.md`, `NEXT_ACTIONS_PROFESSIONAL_SEQUENCE.md`, `ASTRO_MIGRATION_PHASE_PLAN_2026.md`, `TECHNICAL_MIGRATION_RUNBOOK_2026.md`. Найдено расхождение handoff: он заявлял `extract-url-contract.js`, но в main его не было. Реализован безопасный Next PR 1: добавлен `scripts/extract-url-contract.js` с `--root`, `--out-json`, `--out-md`, `--include-noindex`; добавлены npm scripts `contract:extract`, `contract:extract:root`, `contract:extract:dist`; `reports/` добавлен в `.gitignore`; добавлен документ `docs/refactor-2026/CONTRACT_EXTRACTOR_IMPLEMENTATION_2026-06-14.md`. `npm run contract:extract` на текущем root: 42 public pages, 0 issues. Production/deploy/Astro deps не тронуты. |
| **AGENTS-r167** | 2026-06-14 | **Карта Авраама: panel-section extraction into MapEngine.** Продолжен вынос без смены DOM-рендера: `MapEngine` получил `getPanelSections(route, placeId, tab, relatedMap)`, который централизует tab content key и флаги панели (`showRelated`, `showPhotos`, `showDispute`, `showScientificVariants`, `showBibleExtra`). `setTab()` теперь строит section через `MapEngine.getPanelSections(...)`, хранит `window.AvraamCurrentPanelSection`, а условия рендера related/photos/dispute/scientific variants/bible_extra читают section flags с fallback. `avraam:audit` расширен до 51/51: проверяет panel section helper, canonical flags для story/bible, и использование section flags в `setTab`. QA: `npm run avraam:audit` green. |
| **AGENTS-r166** | 2026-06-14 | **Карта Авраама: panel-model extraction into MapEngine.** Продолжен безопасный вынос движка: `MapEngine` получил pure helpers `getPlaceIndex()`, `getPlaceById()`, `getStageForPlace()`, `getRelatedPlaceIds()`, `getTabContentKey()`, `getPanelModel()`. `openPlace()` теперь берёт place/stage/related model через `MapEngine.getPanelModel(window.AvraamRouteData,id,RELATED)` с fallback; stage-hint использует model.stage; `setTab()` использует `MapEngine.getTabContentKey()` и related places через `MapEngine.getRelatedPlaceIds()`. DOM-рендер панели остался прежним, но вычисление модели панели вынесено в engine. `avraam:audit` расширен до 49/49: проверяет panel helpers exports, canonical `getPanelModel/getTabContentKey/getRelatedPlaceIds`, использование helpers в openPlace/setTab. Browser smoke: `openPlace(ur)` даёт model place=ur/stage=I/related=harran+urfa, arch tab рендерит variants/photos, pageerror=0. |
| **AGENTS-r165** | 2026-06-14 | **Карта Авраама: layer/marker visual extraction into MapEngine.** Продолжен безопасный вынос движка: `MapEngine` получил pure helpers `normalizeLayerState()`, `isLayerOn()`, `getPlaceLayerId()`, `getRouteLayerId()`, `getPlaceVisual()`. Inline marker builder теперь берёт `markerClass/cssColor` из `getPlaceVisual`; places-list color тоже из engine visual; `applyLayers()` больше не держит ручные ternary по `cand/lot/war`, а использует `MapEngine.isLayerOn/getRouteLayerId/getPlaceLayerId` с fallback. `avraam:audit` расширен до 45/45: проверяет экспорт layer/visual helpers, canonical ids/colors, использование helpers в marker builder и applyLayers. Browser smoke: 19 markers, candidate layer off hides exactly `urfa/hammam/lahairoi`, Abraham layer off hides `ur`, pageerror=0. |
| **AGENTS-r164** | 2026-06-14 | **Подготовка к будущей платформе: контентный baseline + санитарные warnings + исторический delete-audit.** Полная история поднята (`git fetch --unshallow`, 972 коммита); явного site-wide плана Astro/Next/new-platform в репо/истории не найдено. Прочитаны релевантные планы: удалённый `_agent-handoff/ROADMAP.md` (GBS/серии, не новая платформа), `docs/MAPS-ARCHITECTURE.md`, `docs/MAPS-RD-MASTERPLAN-2026.md`. Safe cleanup: root-preview `karty-preview.html`/`konfessii-preview.html` перенесены в `_build-tools/preview-archive/` (материал сохранён, публичный шум снят), `/karty/ishod/` добавлен в sitemap, meta-description `/karty/` укорочен, `audit-pro` игнорирует template placeholders `${...}` как не-URL, `_build-tools` исключён из public `audit-pro`, `old-tbilisi-kura-xix.jpg` сжат 1.85MB→266KB. Добавлен migration guard: `scripts/check-public-content-baseline.js`, `data/public-content-baseline.json` (42 public indexable pages: URL/title/H1/word-count), npm `content:guard`/`content:baseline`, `content:guard` включён в `validate:static-publication`. Исторический delete-audit: 96 deleted content-like files проверены; Gill old single 20 963 words vs current Gill 5 pages 27 967 words; raw-source HTML по баптистам заменены `.txt`; явной потери содержательного материала не найдено. Документ: `docs/PLATFORM-MIGRATION-PREP-2026-06-14.md`. QA: `validate:static-publication` PASS, `konfessii:audit` PASS; warnings снижены до 3 (CSS budget, 214 !important, Avraam inline script — стратегические, не точечные). |
| **AGENTS-r163** | 2026-06-14 | **3D-карта баптизма: smooth physics polish поверх актуального main без отката новых research/Timeline добавлений.** После проверки remote `main` (`69cd8bb`, уже содержит `baptisty-rossii`, data-driven Timeline metadata, article previews, кейсы гонений, BWA-статистику и I8–I13 guards) правки перенесены НЕ на старую базу, а поверх latest. Смягчена физика 3D: `d3AlphaDecay .0115→.0165`, `d3VelocityDecay .20→.24`, `warmupTicks 140→150`, `cooldownTicks 260→220`, `cooldownTime 9000→7000`, сила `composition` к якорям `*1.6→*1.28`, drag damping `0.32→0.26`, neighbor pull/home `0.0038/0.0016→0.0032/0.0012`, release impulse `0.010→0.006`, release velocity keep `0.32→0.36`. Цель: убрать ощущение «напряжённых» и дёрганных шариков, оставить rubber-band и синхронизацию с картой/Timeline. `scripts/konfessii-map-audit.js` расширен **I14**: static+source guards на calm physics constants, запрет старых jitter constants, live I1–I13 сохранены. Документация: `_build-tools/konfessii-baptizm/3D-PREMIUM-POLISH-2026-06-14.md`; README/3D-RUBBER обновлены. Попутно восстановлен static gate latest-main: `_build-tools` добавлен в skipDirs `audit-pro` (прототипы/мокапы не являются публичными страницами), `old-tbilisi-kura-xix.jpg` сжат 5000px/1.85MB → 1800px/266KB. QA: `npm run konfessii:audit` PASS (I1–I14, live desktop WebGL + mobile smoke), затем полный `validate:static-publication` прогоняется повторно. |
| **AGENTS-r162** | 2026-06-14 | **Карта Авраама: story-state extraction into MapEngine + guards.** Продолжен аккуратный вынос движка без визуального риска: в `MapEngine` добавлены pure helpers `getStoryState(route, storyId)`, `getPlaceOrder(route, storyId)` и `auditStoryDefinitions(route)`; `applyStory()` в `karty/avraam/index.html` теперь берёт place/stage/waypoint sets из `MapEngine.getStoryState`, с fallback на старые данные. Это вынесло story filtering из inline-логики, но DOM-рендер остался прежним. Исправлен нюанс opacity SVG-группы waypoints: теперь dim ставится и на root, и на child `.route-waypoint` атрибутами, чтобы браузеры не расходились по computed opacity. `avraam:audit` расширен до 39/39: проверяет экспорт story-state/place-order helpers, exact story counts, main-order без кандидатов, story-order с кандидатами, использование helpers в `applyStory`/counter/prev-next, child waypoint opacity. Browser smoke по main/lekh/war/lot/akeda: state counts верные, hi/dim маркеры корректны, waypoint opacity .72 только main/Лех-леха и .08 для остальных, `AvraamRouteJsonAudit.ok=true`, pageerror=0; lekh/main next from Ур → Харран, counters 1/6→2/6 и 1/16→2/16. |
| **AGENTS-r161** | 2026-06-14 | **3D-карта баптизма: data-driven Timeline metadata + кейсы гонений.** Продолжение после новых research-коммитов: в `TimelineEvent` добавлены поля `sourceLevel`, `nodeId`, `routeId`, `mapSelectionId`, `articleKey`; `handleTimelineEventSelect` теперь сначала читает эти поля и только потом использует `TIMELINE_TARGETS` как fallback. В Timeline добавлены кейсы из индекса гонений: 1935–1938 Георгий Слесарев (Сиблаг/расстрел), 10.09.1937 Иван Шилов (Соловки/Карлаг/расстрел), 09.01.1964 Николай Хмара (Барнаульская тюрьма), с `sourceLevel` badges. Source snapshot `data/timeline.ts` обновлён, `_app/index.html` пересобран. `konfessii:audit` усилен I12/I13 на case-index events и data-driven metadata. QA: `validate:all`, `audit-pro`, `konfessii:audit` green. |
| **AGENTS-r160** | 2026-06-14 | **Readable-publication guard cleanup after wiring Avraam audit into static gate.** После добавления `npm run avraam:audit` в `validate:static-publication` полный gate выявил существующий readable-audit шум в серии «Баптисты России»: `.summary-card__num` без `aria-hidden`. Исправлено на 11 страницах `baptisty-rossii/` добавлением `aria-hidden="true"` к декоративным номерам summary-card. `npm run readable-audit` и `npm run validate:static-publication` теперь green. |
| **AGENTS-r159** | 2026-06-14 | **Карта Авраама: аккуратный engine extraction + history-derived guards.** По истории коммитов/AGENTS выделены повторные регрессии: script-boundary (`animateStageRoutes`), caption transform off-screen, panel rubber animation conflict, dangling `g/pl` preview block, hint over tour walker, CSP/photo redirects, drift HTML↔route.json. `MapEngine` получил `compareRouteData()` и `collectPhotoHosts()`; `avraam/index.html` теперь preload-ит `route.json` и в фоне выставляет `window.AvraamRouteJsonAudit = MapEngine.compareRouteData(window.AvraamRouteData, routeJson)` — шаг миграции к data-driven engine без визуального риска. `avraam:audit` расширен до 31/31: проверяет dynamic photo hosts vs CSP, route.json preload, runtime drift audit wiring, отсутствие dangling SVG pointerenter, `.panel-opening` вместо `#panel.open` для rubber, отсутствие skeleton console logging. `validate:static-publication` теперь запускает `npm run avraam:audit`, чтобы CI/ручные gate ловили регрессии карты. Browser smoke подтвердил `AvraamRouteJsonAudit.ok=true`, pageerror=0. |
| **AGENTS-r158** | 2026-06-14 | **Карта Авраама: anti-regression audit guard.** Добавлен `scripts/avraam-map-audit.js` + npm script `npm run avraam:audit`: проверяет inline PLACES/STAGES/CTX/STORIES, `route.json`, `MapEngine.validateRoute`, 19/8/5/7/40/5/47 stats, совпадение HTML/route place IDs, scientific variants для всех 19 мест, exact waypoints, layer/legend UI, Shechem title, captionSpring без `translateX(-50%)`, script-boundary GSAP setup, `startTour()`→`killHint()`, CSP для `tile.loc.gov`/Ritmeyer, отсутствие хрупких Wikimedia `/upload` URL и старого LOC redirect, compact Abraham source MD без stale proposal-noise. Текущий результат: 24/24 passed. |
| **AGENTS-r157** | 2026-06-14 | **Карта Авраама: доведение до full-data/verified state + visual QA.** Выполнен большой проход раздела `/karty/avraam/`: `map-engine.js` обновлён до v0.2 reusable core (loadRoute/normalize/validate + viewport/flyTo/zoom/pan + story/tour/share); `route.json` расширен до full data (19 places / 8 stages / 5 stories / 7 ctx / 40 photos / 5 verified_waypoints / 47 scientific_variants); все Wikimedia фото переведены на `Special:FilePath`, LOC Matson на canonical `tile.loc.gov`, CSP расширен под LOC/Ritmeyer; добавлена SVG-фигурка Авраама в кинотуре; исправлены runtime-regressions (`animateStageRoutes` script-boundary, captionSpring off-screen, hint over walker); добавлен слой опорных узлов Ур→Харран (Урук/Ниппур/Вавилон/Мари/Каркемиш) + toggle/legend; добавлен UI-блок «Научные варианты и оговорки» для всех 19 мест; исправлен dispute-title Сихема; `ABRAHAM-ARCHAEOLOGY` очищен до compact source index с BiblePlaces/Commons/LOC/Ritmeyer/AiG/ARJ/Creation/NPAPH + WiBiLex/Jewish/Sefaria. QA: Commons 38/38, 40 thumbnails load, browser smoke pageerror=0, `validate:all` green, `audit-pro` green. |
| **AGENTS-r156** | 2026-06-14 | **3D-карта баптизма: события Бюллетеней Совета родственников перенесены в Timeline.** После коммита `16bda31` (PDF-каталог Бюллетеней Совета родственников узников ЕХБ) Timeline 3D-приложения дополнен событиями: 1972 — Бюллетень №9 о смерти Ивана Моисеева (военный вопрос/молодёжное свидетельство), 1977 — Бюллетень №44 о печатниках «Христианина» под следствием (Левен, Кооп, Людмила и Лариса Зайцевы), 1980 — Бюллетени №84/88: Донченко с Бюллетенями и Евангелиями, отобрание детей, психбольницы во время Олимпиады, 79 узников. `TIMELINE_TARGETS` расширен на эти события (conscience/samizdat previews, советский маршрут, Москва). Source snapshot `data/timeline.ts` обновлён, `_app/index.html` пересобран. `konfessii:audit` усилен I12 на relatives-bulletin events. QA: `validate:all`, `audit-pro`, `konfessii:audit` green. |
| **AGENTS-r155** | 2026-06-14 | **3D-карта баптизма: превью статей серии прямо в Timeline и dossier.** По запросу владельца «умно всё связывать и красиво превью статей раскрывалось» добавлен слой `ARTICLE_PREVIEWS` + `NODE_ARTICLE`: события Timeline и выбранные узлы теперь показывают связанную статью серии `/baptisty-rossii/` (cover SVG, номер части, title, description, переход `target=_top`). Timeline-card показывает мини-preview статьи при hover/focus события; full dossier показывает блок «Связанная статья» перед связями узла. `TIMELINE_TARGETS` получил `article` key, fallback идёт через `articleForNode`. `konfessii:audit` усилен I13 source/_app guards на article previews. Пересборка Vite singlefile → `_app/index.html`. QA: `validate:all`, `audit-pro`, `konfessii:audit` green. |
| **AGENTS-r154** | 2026-06-14 | **3D-карта баптизма: синхронизация с новыми источниками по Инициативной группе и самиздату.** После коммитов `c8f9899` и `614da41` (углубление статьи 8/9 + Братский Вестник №6 1963) Timeline 3D-приложения дополнен событиями: 15–17.10.1963 съезд ВСЕХБ и Устав 1963 (официальная линия), 1963 появление «Вестника спасения», 16–17.05.1966 майская делегация к ЦК КПСС + арест Винса/Хорева, 1970 Совет родственников узников, 05.06.1971 издательство «Христианин» уведомляет Косыгина, 1976 «Вестник спасения» → «Вестник истины». `TIMELINE_TARGETS` расширен на 1963/1966/1970/1971/1976, все ведут в релевантные узлы/маршрут/Москву. Source snapshot `data/timeline.ts` обновлён, `_app/index.html` пересобран. `konfessii:audit` усилен I12 на initiative/samizdat events. QA: `konfessii:audit`, `validate:all`, `audit-pro` 154 passed · 0 errors. |
| **AGENTS-r153** | 2026-06-14 | **3D-карта баптизма: синхронизация с полной серией «Баптисты России» (10 статей) + BWA статистика + события совести.** После публикации 10-й статьи/справочника проверен актуальный `main`: серия `russian-baptism` теперь полностью published (10 частей). 3D-приложение обновлено из Vite-source: hero/root/organizations/quiz/Comparison статистика `~144K/~72 000` заменена на источниково оговорённые BWA `66 732 членов / 1 413 церквей` (independent/unregistered groups требуют отдельной методики); Timeline получил события статьи «Гонения и совесть» — 04.01.1919 декрет о замене воинской повинности, 1923 ОГПУ/«Голос с Востока»/XXV съезд, 1926 новая формула по военному вопросу, 1945 «Братский Вестник» и послевоенная линия; `TIMELINE_TARGETS` расширен для этих событий (фокус графа/маршрута/Москвы). Добавлены source snapshots изменённых Vite-файлов в `_build-tools/konfessii-baptizm/source-snapshot/`. `konfessii:audit` усилен I12: отсутствие `~144K`, наличие BWA 66 732 и событий совести. Пересборка Vite singlefile → `_app/index.html`. Дополнительно исправлена mixed-content ссылка в справочнике (http→https) и проверены `validate:all`/`audit-pro`/`konfessii:audit` green. |
| **AGENTS-r152** | 2026-06-13 | **wave-25: Sprint 3 route.json + MAPS-ANALYSIS P1+P6 + OWNER-REQ #15 глоссарий рамки.** (1) **MAPS-ANALYSIS P1 ЗАКРЫТ**: маршрут Stage I Ур→Харран исправлен — теперь огибает Евфрат через Ниппур/Мари/Каркемиш (исторически верный торговый путь СБ, подтверждён архивом Мари). Описание этапа обновлено. (2) **MAPS-ANALYSIS P6 ЗАКРЫТ**: легенда типов маркеров добавлена в #layersPop — SVG иконки для каждого типа: основные места (круг+золото), Лот (ромб+медь), кандидаты (пунктир+фиолет), контекст (серый кружок). (3) **Sprint 3 ЗАКРЫТ**: `karty/avraam/route.json` создан (131 строка, valid JSON) — meta/places_index(19)/stages_index(8)/stories(5)/ctx_index(7)/yec_position/notes. route.json `<link rel=preload>` добавлен в head. MAPS-RD-MASTERPLAN Sprint 3 checklist обновлён. (4) **OWNER-REQ #15 ЗАКРЫТ**: глоссарий «забагованные рамки» — найден корень: `.gterm.is-open{padding:4px 6px 6px;margin:-4px -5px -5px}` создавал визуальную «рамку» вокруг активного слова. Исправлено: `padding:0 1px 1px;margin:0;outline:none` — рамка исчезает, подчёркивание остаётся. (5) **QA**: route.json валидный JSON (python3 json.load), Stage I path в HTML confirmed, marker-legend в HTML confirmed. 4363 строки avraam | 131 строка route.json | site.css #15 fix. |
| **AGENTS-r151** | 2026-06-13 | **wave-24: MD глубокий проход + SVG красота + кнопки + звёзды + новые фото.** (1) **MD VERIF28/29 данные внедрены**: LOC Matson PD ~1900-1920 фото Пустыни Сур (https://cdn.loc.gov/service/pnp/matpc/01900/01946v.jpg); Ritmeyer Archaeological Design фото Мамре реконструкция (https://www.ritmeyer.com/wp-content/uploads/2020/04/il_mamre_d01_wm.jpg). (2) **SVG красота**: Кинерет — реалистичная форма (вытянуто СЗ→ЮВ); Гевал/Геризим — тройной хребет с боковыми пиками, крупнее (MAPS-ANALYSIS P5); Падающие звёзды — 4 линии с trailing glow, calcMode:discrete; Звезда Мории — мигающая над Шалемом; Млечный путь — nebulaGrad + дыхание 14s; starGlow filter (feGaussianBlur двойной) для ярких звёзд. (3) **Кнопки идеально**: btn 42px→48px(mobile); zin/zout 52px mobile; btn hover scale(1.05)+translateY; active scale(.91); @media(hover:none) guard; haptic на zin/zout/zreset; micro-animation (scale+rotate на zreset); stage-chip min-height:36px; marker hover scale(1.08)→scale(1.15); markerGlow drop-shadow двойной. (4) **Новые CSS**: starGlow filter; nebulaGrad radial; btn::after radial inlay; prefers-reduced-motion guards расширены. (5) **QA**: Node.js vm.Script: block 3/4/5 OK; 4362 строки, 398KB. |
| **AGENTS-r150** | 2026-06-13 | **wave-23: 3 критических бага — день/ночь SVG, карта Авраама, 3D зум.** (1) **День/ночь SVG пропал**: корень — `overflow:hidden` на `.h-navbar__inner` в `css/home.css` обрезал абсолютно позиционированные SVG иконки `.theme-toggle`. Исправлено: `overflow:hidden → overflow:visible`. Баг введён при минификации CSS (коммит a0a363d2). (2) **Карта Авраама — мерцание и нельзя открыть**: `panelRubberIn animation fill:both` конфликтовал с `transform:none` из `#panel.open` — панель мерцала (0% кадр убирает за экран). Решение: rubber animation перенесён на класс `.panel-opening` (добавляется JS в openPlace и убирается через 600ms), не конфликтует с `.open`. Caption `both→forwards`, marker bounce `both→forwards`. (3) **3D карта баптистов — глитч зума**: `wheel` события регистрировались как `passive` на родительской странице, мешая Three.js OrbitControls вызвать `preventDefault()`. Добавлен non-passive wheel listener + touch pinch fix на `.stage`. Проверено: все 3 исправления атомарные, без side effects. |
| **AGENTS-r149** | 2026-06-13 | **wave-22: ЗВЁЗДЫ 5 слоёв + PARALLAX + SPRING/RUBBER анимации + КИНОТУР БАГ FIX.** (1) **ЗВЁЗДЫ**: 5 слоёв глубины — `starDeep` (20 далёких, мелкие, 7–13s), `starMid` (средние, существующий набор), `starField` (6 ярких передних с анимацией r-пульсации), `starMilky` (Млечный Путь — размытая ellipse), `starShoot` (падающие звёзды 60/73s цикл). (2) **PARALLAX**: mousemove/touchmove → CSS transform на 3 слоях с разными коэф. (Deep×0.3, Mid×0.6, Field×1.0) — звёзды «плывут» в глубину при движении. (3) **SPRING АНИМАЦИИ**: `panelRubberIn` (rubber 55% overshoot), `tabFlipIn` (3D flip контента), `markerBounceActive` (spring при клике), `captionSpring` (caption появление), `chipElastic` (elastic chip), `ctxSpring` (ctxCard spring), `introBtnBounce` (кнопки intro появляются поочерёдно), `goRubber` (кинотур-кнопка), `prevSpring` (hover preview), `storyBtnSpring`, `toastRubber`, `markerOpenWave`. (4) **КИНОТУР БАГ FIX**: `_pathLen()` fallback если getTotalLength()=0; guard если paths пустой; caravan dot с goldGlow+trailing glow ring; easeInOutQuart + spring overshoot финал; rafId для отмены; playBtn.style.color gold при туре; рестарт через requestAnimationFrame для layout-ready. (5) **ДОП**: дублированный `<script>` тег удалён; `}open');` JS синтаксис-баг исправлен; panel transition только при .open:not(.open); mobile panel transition тоже. prefers-reduced-motion guards. Wave22 JS блок 5235 chars, OK. 4241 строка, 379KB. |
| **AGENTS-r148** | 2026-06-13 | **wave-21: TTS race condition fix + MD глубокий проход (20+ баш).** TTS ПЛЕЕР: (1) _uttGen счётчик поколений — каждый utt получает myGen; onend/onerror: if(myGen!==_uttGen)return → race condition УСТРАНЁН; (2) 120ms delay (было 50ms); (3) double-check speaking; (4) resumeIdx=idx сохранение; (5) _uttGen++ в pl/pa/st/speed; (6) 6 speeds [0.75,1,1.25,1.5,1.75,2]; (7) visual feedback opacity. MD проход: Гевал/Геризим двойные пики (снежная шапка+блик); Сихем arch NPAPH/BiblePlaces Then/Now note; @container panel-body (max-width:320px) адаптив; .act-btn hover+active; MAPS-ANALYSIS незакрытые P5-P6 закрыты; EDITORIAL-SOURCE-POLICY проверена (нет eng цитат в тексте). QA: 24/24 ✅ | avraam 3804 строки | site.js 565 строк | 159KB. |
| **AGENTS-r147** | 2026-06-13 | **wave-20: Sprint3 _engine/ + MD чеклисты + Hub Web Share + фото.** Глубокий проход всех MD: (1) **_engine/map-engine.js v0.1** (API skeleton: init/flyTo/openPlace/setStory/nextPlace/prevPlace/startTour/stopTour/setZoom/getState/shareURL по MAPS-RD §1.3). (2) **_engine/base-geo.svg** (34KB, 444 строки — базовая география для всех карт). (3) **MD чеклисты обновлены**: Sprint 1 ✅ ЗАКРЫТ, Sprint 2 ✅ ЗАКРЫТ, Sprint 3 В ПРОЦЕССЕ; MAPS-ARCHITECTURE статус таблица. (4) **Фото из ABRAHAM-ARCHAEOLOGY VERIF29**: Харран ворота Ракка (then), Сихем NPAPH Th.C. Vriezen 1957 (then/now). (5) **Источники** в панели: BiblePlaces Vol.2-7, NPAPH/Vriezen 1957, LOC American Colony, CMI creation.com, Ашшер ~2166. (6) **Hub Web Share API** + прогресс-бар Исхода 25%. QA: 12/12 ✅ | 3791 строка | 357KB. |
| **AGENTS-r146** | 2026-06-13 | **wave-19: вторые фото 7 мест + route.json Исхода + waterRipple Нил + preview thumb.** (1) **Вторые фото** для урфа (Гёбекли-Тепе), дамаска (оазис Гута), бет-эля (водораздел), хаммама (Иорданская долина), шур (Синай), лахай-рои (стада Негев LOC), хова (вид к северу). (2) **Sprint 3: karty/ishod/route.json** — 7 мест: Раамсес, Сокхоф, Пи-Гахироф (dispute 3 версии переправы), Мара (he_deep + Откр параллель), Синай/Хорив (dispute Джебель Муса vs Лоз), Кадеш-Барнеа (he_deep Мерива), Равнины Моавитские (he_deep Нево) — все поля story/bible/arch/he_deep/dispute/bible_extra; 6 stages с km/age. (3) **Нил** в <g filter=waterRipple>. (4) Hover preview: thumbnail из photos[0] если есть (img.mp-thumb, CSS .has-photo). (5) tn-item мобайл 180px. QA: 11/11 ✅ | 3790 строк | 356KB. |
| **AGENTS-r145** | 2026-06-13 | **wave-18: Sprint3 scaffold Исхода + MD фото + Ritmeyer Мория + Синай.** Из MD: (1) **karty/ishod/index.html** scaffold (noindex, JSON-LD breadcrumb, preview SVG маршрута, иврит); карточка Исхода на хабе → `<a href=/karty/ishod/>` (была div); CSS hover gold. (2) **Новые фото из MD**: Кадеш (Wadi Ain Qudeirat LOC Matson ~1900s), Герар (Nahal Gerar valley BiblePlaces Vol.5), Египет (Pyramids of Giza). (3) **Arch обновления**: Мория — Ritmeyer «выемка под Ковчег» (1 Цар 8, Holy of Holies на Скале); Кадеш — LOC Matson «оазис с стадами» YEC аргумент; Герар — BiblePlaces Pictorial Vol.5 ref. (4) **SVG**: Раамсес dot (lbl-z2); Синай хребет детальнее (Ум-Шаумер 2587м + Хорив + 2 боковых + снег). (5) Story toast: count «✦ Война · 4 места». Conf badges font-weight:600. QA: 14/14 ✅ | 3766 строк | 351KB. |
| **AGENTS-r144** | 2026-06-13 | **wave-17: waterRipple все 5 морей + a11y маркеры + UX polish + картуш.** (1) waterRipple (<g filter>, Safari-safe) на Средиземном, Красном, Персидском, Мёртвом, Кинерете — живая вода везде. (2) Маркеры: aria-label, tabindex=0, role=button, Enter/Space открывают, .marker:focus outline gold. (3) Прибрежная зона Средиземноморья SVG. (4) Картуш: 4 декоративных угловых орнамента, ярче цвет. (5) CSS: scroll-snap на stage-chips, ::selection gold, contain:content/layout, story-nav translateZ(0), touch-action manipulation. (6) Photo modal swipe-down close mobile. (7) haptic только при touch (maxTouchPoints>0). QA: 13/13 ✅ | 3751 строк | 347KB. |
| **AGENTS-r143** | 2026-06-13 | **Карта Авраама wave-16: waterRipple/terrainTex применены + lot ромб + Tab/story auto-open + UX polish.** (1) **SVG фильтры активированы**: waterRipple (feDisplacementMap) на Средиземном и Красном морях — вода анимированно «колышется»; terrainTex на фоне суши — органическая текстура рельефа; координатная сетка с метками 27–36°N / 31–46°E. (2) **Lot-маркеры = ромбы** (path M0,-8.5 L6.5,0...) — визуально отличают линию Лота от пути Авраама. (3) **Tab keyboard nav**: листает видимые маркеры (story-aware); Shift+Tab обратно. (4) **Story auto-open**: при выборе сюжета через 1.2с автоматически открывается первое место. (5) **Long-press + фото**: показывает метку+кредит первого фото. (6) **CSS polish**: tn-item photo zoom, pfoot стрелки hover, tip .08s, search box gold, panel header gradient, life rail shadow, panel-open story-nav dim mobile. QA: 17/17 ✅ | 3703 строки | 344KB. |
| **AGENTS-r142** | 2026-06-13 | **Технический аудит + bug-fixes Safari/Mobile/A11y/Чистка.** Найдены и исправлены: (1) 🔴 КРИТИЧНО: `92svh` без vh fallback → `92vh / -webkit-fill-available / 92svh` (iOS <16); (2) `user-scalable=no` в viewport (нет Safari zoom при input focus); (3) `aria-modal/aria-hidden` динамически меняются при open/close панели (accessibility); (4) `-webkit-text-size-adjust:100%` (Safari не масштабирует текст); (5) panel `translateZ(0)` GPU layer; (6) `#tourProgress z-index:26` явный; (7) 2 `<style>` блока → 1 (merge без риска); (8) пустой CSS `#tabs .tab[data-t="he"]{}` удалён; (9) photoModal Esc — улучшен handler; (10) `panel setCursorPointer` active. Аудит подтвердил: 28/28 checks green, 0 console.log, GSAP guards есть, pointer-events:none intro::before ✅, overscroll-behavior ✅, prefers-reduced-motion ✅. MAPS-RD-MASTERPLAN обновлён: финальная статистика карты (3625 строк, 7 полей × 19 мест = 133 единицы контента, 20 фото, 41 keyframes, YEC позиция, SVG детали). |
| **AGENTS-r141** | 2026-06-13 | **Карта Авраама wave-15: dispute+bible_extra+he_deep+photos 19/19/19/20 — ПОЛНОЕ ЗАКРЫТИЕ контента.** (1) **dispute 19/19**: Урфа (традиция vs академия), Харран (бесспорная), Дамаск, Сихем, Бет-Эль (Ливингстон 1994), Египет (контекст не точка), Хеврон (Рамат+Тель Румейда), Дан (антиципация + YEC caveat), Беэр-Шева, Шур, Беэр-лахай-рои (богосл. приоритет), Хова (Алалах Ḫbt). (2) **photos 20/20**: Лахай-рои (Wadi Zin spring), Урфа (пруд Балыклыгёль). (3) **SVG**: 18 анимированных звёзд над Харраном (SMIL animate, 3–8s, gold/white/blue); 5 рукавов Нила + glow; меридиан Иерусалима (Иез 5:5, opacity .06). (4) **Анимации**: tourProgressShine (progress bar переливается); tour .active class; sharePulse (⧉ ССЫЛКА пульс при открытии); stars reduced-motion guard. QA: 27/27 ✅ | 3613 строк | 339KB. |
| **AGENTS-r140** | 2026-06-13 | **Карта Авраама wave-14: bible_extra 19/19 + SVG регионы + ambient chord.** (1) **bible_extra ЗАКРЫТ для всех 19 мест**: Ур (Деян 7:2), Урфа (Берешит Рабба), Харран (Лех-леха три круга), Сихем (Ин 4 колодец), Бет-Эль (лестница→тельцы), Хеврон (Быт 18:25), Шалем (Акеда→Голгофа), Дан (война ради Лота), Содом (Иез 16:49 гордость), Хаммам (критерий Соф 2:9), Цоар (молитва меняет суд), Герар (язычник невиновен), Беэр-Шева (Эль Олам посреди боли), Кадеш (перекрёсток 3 эпох), Шур (первое явление ангела — рабыне), Лахай-рои (один источник двух встреч), Хова (ночной рейд); теперь отображается после bible. (2) **SVG**: Суэцкий залив, Едом שֵׂעִיר, Аббана/Барада אֲמָנָה, Вифлеем, Изреель. (3) **Ambient**: changeAmbientChord(i) — 8 тональностей (C/D/Bmin/Cmin/Amin/Bdim/Cmaj/D) с portamento .8s. (4) **CSS**: verse::before ❝, place-counter gold border, zoom-badge glow, cartouche z2 hide. QA: 21/21 ✅ | 3543 строки | 322KB. |

## 2026-06-22 — Refactoring 6.0 Phase 3a: Kod Da Vinci section seams

`/articles/kod-da-vinchi/` article body was split from one `_legacy/article-body.html` monolith into 21 ordered fragments under `src/components/article-pilots/kod-da-vinchi/_legacy/article-sections/`. `KodDaVinchiArticleBody.astro` now owns the article wrapper and loads fragments via eager `import.meta.glob`. `article-mdx-pilot-audit` enforces the seam (no monolith, 21 fragments, pagefind meta first). Normalized legacy article body equals dist article body after the split. This enables one-section-at-a-time MDX/Astro replacement in the next refactor step.

## 2026-06-22 — Refactoring 6.0 Phase 3b: Kod Da Vinci Pagefind meta island

Pagefind metadata for `/articles/kod-da-vinchi/` moved from raw fragment `00-pagefind-meta.html` into `KodDaVinchiPagefindMeta.astro`, the first real Astro-owned island inside the legacy-compatible article body. The visible body now remains as 20 ordered section fragments. Related-card read times were synced to `data/search-manifest.json`, and `scripts/check-data-consistency.js` now blocks related-card read-time drift.

## 2026-06-22 — Refactoring 6.0 Phase 3c: first visible Kod Da Vinci section component

`01-sec-intro.html` was promoted to `KodDaVinchiSectionIntro.astro`, the first visible Astro-owned section inside `/articles/kod-da-vinchi/` article body. The component preserves the legacy DOM hooks/classes (`sec-intro`, `drop-cap`, `fn-marker`, `quote-box`) while remaining visible sections stay as 19 ordered fragments. `article-mdx-pilot-audit` now enforces the intro component markers. Comment-insensitive legacy article body parity remains exact after build.

## 2026-06-22 — Refactoring 6.0 parallel pilot: `/hard-texts/` semantic main split

`/hard-texts/` was advanced on a separate lane from Kod/Gill: `HardTextsMain.astro` no longer imports one monolithic `_legacy/main.html?raw` fragment. The `<main id="main-content">` shell is now assembled from named Astro leaf components — `HardTextsCardsSection.astro`, `HardTextsStatsSection.astro`, `HardTextsSeriesMapSection.astro`, and `HardTextsArticleEndBlock.astro` — while preserving the legacy DOM/classes/text/URLs. `scripts/hard-texts-visual-parity-audit.js` was upgraded to guard this new contract and forbid regression back to the raw main import.

## 2026-06-22 — Refactoring 6.0 parallel pilot: `/pastor-series/` semantic main split

`/pastor-series/` was advanced on the same independent lane: `PastorSeriesMain.astro` no longer imports one monolithic `_legacy/main.html?raw` fragment. The `<main id="main-content">` shell is now assembled from named Astro leaf components — `PastorSeriesCardsSection.astro`, `PastorSeriesStatsSection.astro`, and `PastorSeriesArticleEndBlock.astro` — while preserving the legacy DOM/classes/text/URLs and planned-card states. `scripts/pastor-series-visual-parity-audit.js` was upgraded to guard this new contract and forbid regression back to the raw main import.

## 2026-06-22 — Refactoring 6.0 parallel pilot: `/konfessii/` standalone grid split

`/konfessii/` was advanced on the same independent lane: `KonfessiiMain.astro` no longer imports one monolithic `_legacy/main.html?raw` fragment. The standalone confessions grid is now assembled from named Astro leaf components — `KonfessiiRusskijBaptizmCard.astro`, `KonfessiiPentecostalCard.astro`, and `KonfessiiOverviewCard.astro` — while preserving the legacy DOM/classes/text/SVG/copy. `scripts/konfessii-visual-parity-audit.js` was upgraded to guard this new contract, keep the required inline Pagefind sr-only style, and forbid regression back to the raw main import.

## 2026-06-22 — Refactoring 6.0 parallel pilot: `/karty/` standalone hub split

`/karty/` was advanced on the same independent lane: `KartyMain.astro` no longer imports one monolithic `_legacy/hub.html?raw` fragment. The premium standalone hub is now assembled from named Astro leaf components — `KartyBackLink.astro`, `KartyHeroSection.astro`, `KartyBodySection.astro`, and `KartyNote.astro` — while preserving the legacy DOM/classes/text/copy. `scripts/karty-visual-parity-audit.js` was upgraded to guard this new contract and forbid regression back to the raw hub import.

## 2026-06-22 — Refactoring 6.0 parallel pilot: `/baptisty-rossii/` landing main split

`/baptisty-rossii/` was advanced on the same independent lane: `BaptistyRossiiMain.astro` no longer imports one monolithic `_legacy/main.html?raw` fragment. The GBS2 landing main is now assembled from named legacy-faithful fragments — `header-hero.html`, `article-body.html`, and `post-article.html` — while preserving the premium series DOM/classes/text/copy. `scripts/baptisty-rossii-visual-parity-audit.js` was upgraded to guard this new contract and forbid regression back to the raw main import.
