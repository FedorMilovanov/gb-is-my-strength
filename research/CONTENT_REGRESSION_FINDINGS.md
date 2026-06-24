# CONTENT REGRESSION ANALYSIS — 2026-06-21

## 1. MDX vs Legacy HTML Content Discrepancy

### REGRESSION FOUND: MDX improvements NOT reflected in production HTML

**NOTE:** MDX/HTML word counts below use v1 methodology (article body text extraction).
Verified v2 counts (strip HTML + strip frontmatter + strip markdown formatting, 8% tolerance)
are in the UPDATE section at the end. Numbers differ by methodology, not by data error.

The Refactoring 5.0 full-document shadow-wrap (commits e116bec6, 87fcc7b2) 
reverted ALL Astro article pages to emit legacy HTML verbatim via 
`loadLegacyFullDocument`. However, the MDX files (`src/content/articles/*.mdx`)
had been EDITED after initial extraction from HTML, and those improvements
are NOW LOST in production.

### Articles where MDX has MORE content than legacy HTML:

| Article | MDX words | HTML words | Diff | Status |
|---------|-----------|------------|------|--------|
| 20-antisovetov-pastoru | 15,443 | 15,211 | +232 | ⚠️ MDX richer |
| dzhon-gill-istoricheskiy-kontekst | 3,654 | 3,370 | +284 | ⚠️ MDX richer |
| dzhon-gill-spravochnik | 2,144 | 1,849 | +295 | ⚠️ MDX richer |
| dzhon-gill-chast-1-chelovek | 6,662 | 6,549 | +113 | ⚠️ MDX richer |
| kod-da-vinchi | 6,914 | 6,733 | +181 | ⚠️ MDX richer |
| rimlyanam-7 | 2,995 | 2,810 | +185 | ⚠️ MDX richer |

### Article where HTML has MORE content (Gill context):

dzhon-gill-istoricheskiy-kontekst: MDX=3654 HTML=3370 diff=+284 — MDX has more
hermenevticheskaya: MDX=10532 HTML=11144 diff=-612 — HTML richer (footnotes in HTML)

### ROOT CAUSE:
- MDX was created from legacy HTML (June 15 pipeline)
- MDX was then improved/fixed (addition of headings, alt text, metadata fixes)
- Legacy HTML was NOT updated with those improvements
- Shadow-wrap reverted to legacy HTML
- Now the site serves OLDER content than what's in MDX

### FIX NEEDED:
Option A: Port MDX changes back to legacy HTML (workaround)
Option B: Switch to native MDX rendering (proper fix — planned in Refactoring 6.0 Phase 5)


---

## UPDATE (2026-06-21 — verified via local clone + parity scripts)

### Verified metrics (check-mdx-html-parity.js methodology: strip HTML tags, strip frontmatter, strip markdown formatting, 8% tolerance):

| Article | MDX words | HTML words | Diff | Status |
|---------|-----------|------------|------|--------|
| 20-antisovetov-pastoru | 15,332 | 15,224 | +108 | ⚠️ MDX richer (0.7%) |
| dzhon-gill-istoricheskiy-kontekst | 3,514 | 3,385 | +129 | ⚠️ MDX richer (3.7%) |
| dzhon-gill-spravochnik | 1,857 | 1,877 | -20 | ✅ within tolerance |
| kod-da-vinchi | 6,809 | 6,835 | -26 | ✅ within tolerance |
| rimlyanam-7 | 2,978 | 2,853 | +125 | ⚠️ MDX richer (4.2%) |
| hermenevticheskaya | 10,444 | 10,576 | -132 | ✅ HTML richer (footnotes) |

**Critical finding:** All 20 MDX files in `src/content/articles/` are completely orphaned.
Zero production pages reference `getEntry()` or `render()` from `astro:content`.
Only `dev/astro-test.astro` uses native Astro components. Every production page
emits verbatim legacy HTML via `loadLegacyFullDocument`.

**Semantic parity check:** MDX files contain markdown headings (`##`), images with `![]()`
syntax, and blockquotes (`>`) that are not present in the legacy HTML article bodies.
These structural improvements are invisible to word-count parity checks. A full
semantic parity guard (h2/h3/img/figure/a/table counts) is needed — see
`scripts/check-mdx-html-parity.js`.

**Shallow-clone trap:** The original parity check used `git log -1 --format="%ci"` to
detect which file was newer. In a shallow clone (`--depth 50`), this produces identical
dates for MDX and HTML, causing the "MDX is newer" warning to fail silently.
Workaround: use `mtime` or commit a `data/content-versions.json` with explicit timestamps.
