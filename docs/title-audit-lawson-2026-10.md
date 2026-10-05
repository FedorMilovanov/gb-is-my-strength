# Title audit — Lawson article (2026-10-05, final)

## Original screenshot title
«Он знал язык...»: Стивен Лоусон, самообман и публичный голос
Issues:
- «Он знал язык» — poetic, not sourced, implies intent knowledge
- «самообман» as central claim — article shows Lawson taught about self-deception (LAW-10,11,19,22) and gap between public theology and private life is observable, but asserting self-deception as proven motive risks intent claim. Observed contradiction ≠ proven deception. Self-deception ≠ deceiving others. Need provable, non-intent language.
- Keep slug: steven-lawson-samoobman-i-publichnyy-golos (no URL change without reason)

## Criteria (1-5, 5 best)
- Provability: defensible with sources
- Strength: editorial clarity, memorability
- Clickbait: 5 = low clickbait (not sensational), 1 = high clickbait
- Theological accuracy
- Thesis match: matches deck questions: "как человек может десятилетиями точно учить о личной святости... и всё же не применять к себе? чем подтверждается новая достоверность: словами или плодом и пастырским суждением?"

## Candidates

### 1. Падение Стивена Лоусона: что должно говорить громче слов
- Provability: 5 (fall documented by Trinity Bible Church statements, LAW-02,03)
- Strength: 4 (clear, memorable, 52 chars fits 320px clamp)
- Clickbait: 5 (factual, no sensationalism, no intent claim)
- Theological accuracy: 5 (avoids motive, focuses on fruit/testimony principle)
- Thesis match: 5 (directly matches second deck question)
- Total: 24

### 2. «Одарённость превысила благочестие»: что известно о падении Стивена Лоусона
- Quote from author's own book cover line "My gift exceeded my godliness" (LAW-33) — provable as author's self-diagnosis, not editor's judgment
- Provability: 4 (quote is author's, but interpretive)
- Strength: 3 (quote adds color but may be unclear)
- Clickbait: 4 (quote draws attention)
- Theological accuracy: 4 (gift vs piety biblical but simplified)
- Thesis match: 3 (focuses on what is known, not credibility question)
- Total: 18

### 3. Стивен Лоусон после 2024 года: покаяние, подотчётность и публичный голос
- Provability: 5 (2024 timeline, repentance statements LAW-26, accountability LAW-03)
- Strength: 4 (clear structure)
- Clickbait: 5 (factual)
- Theological accuracy: 5 (proper pastoral terms)
- Thesis match: 4 (covers accountability/voice but less about theology/practice gap)
- Total: 23

### 4. Когда богословие святости не стало практикой: разбор падения Стивена Лоусона
- Provability: 5 (observable gap between teaching and practice documented via sermons vs fall)
- Strength: 5 (strong contrast)
- Clickbait: 4 (contrast strong but not sensational)
- Theological accuracy: 5 (holiness theology vs practice accurate, avoids motive)
- Thesis match: 5 (matches first deck question)
- Total: 24

### 5. Mercy in the Wilderness и вопрос доверия: что меняет и что не меняет книга Стивена Лоусона
- Provability: 4 (book exists, trust question editorial)
- Strength: 3 (English title reduces strength for RU audience)
- Clickbait: 3 (mentions book, promo risk)
- Theological accuracy: 4 (trust theological but narrows focus)
- Thesis match: 3 (book part of thesis not whole)
- Total: 17

## Decision
Tie 1 and 4 at 24. Choose 1 as final H1/title because:
- Shorter (52 chars) vs 4 longer, better for 320px clamp(1.75rem,5vw,3rem) max 22ch
- Lower clickbait risk (5 vs 4)
- Directly states conclusion of article (what should speak louder than words = fruit, time, pastoral judgment) rather than just problem statement
- Avoids any potential implication that theology "should" automatically become practice (which is true but could be read as judgmental)

Implementation:
- H1: Падение Стивена Лоусона: что должно говорить громче слов (52 chars, fits 320px, clamp, line-height 1.18, max 22ch, text-wrap:balance, scroll-margin-top 64px > top bar 57px)
- Title: Падение Стивена Лоусона: что должно говорить громче слов | Господь Бог — Сила Моя (matches H1, no extra quote, provable, low clickbait)
- Description: Что известно о падении Стивена Лоусона, его учение о совести и книга Mercy in the Wilderness: почему новая публичная достоверность проверяется временем, плодом и пастырским суждением. (avoids intent, distinguishes testimony vs verification)
- OG/Twitter/JSON-LD/search: driven from frontmatter title/description via ArticleLayout → BaseLayout Seo component
- Slug kept: steven-lawson-samoobman-i-publichnyy-golos

## Коротко element evaluation
- "Коротко" is in-article .lawson-summary (11 points), not in sticky chrome. No button in mobile chrome. Function: editorial synthesis for 87-min article, quick orientation. Value: high for long-form, gives entry points. Duplicates TOC? No, TOC is navigation, summary is synthesis. Keeping as in-article card justified. If it were in chrome, would be removed/demoted. No removal needed.

## Mobile verification (after fix)
- Viewports: 320x760,360x800,390x844,412x915,430x932,844x390 landscape × light/dark/sepia = 18 cases
- Checks: leakedNavHidden, headerNotCovering, noSecondRow, h1NotClipped, stickyNoOverlap, chromeCollapsed (top 57 bottom 57 ≤96), playExists (38px circle), badgeCompact (gap 6px), toc/theme/settings/share exists, noHorizontalOverflow, noBrokenImages, consoleClean (0 for Lawson), axe no critical, LCP/CLS not degraded
- Result: 18/18 PASS
- Reduced-motion: transition=none when prefers-reduced-motion reduce
- Font scales: 20px root still no overflow, H1 top 90 > topbar bottom 57
- TTS: badge click opens speedrail (opacity 0→1, speed-open class), 1.25× updates badge text and aria-checked, Play is tappable, states idle→loading→playing→paused handled by controller (idle in test without wasm, but no CLS/overlap)
- Regression invariants: leaked menu, ghost text, oversized chrome, second row, compact playback, H1 clip, overflow — all PASS on 3 routes × 4 viewports
