# CONTENT REGRESSION ANALYSIS — 2026-06-21

## 1. MDX vs Legacy HTML Content Discrepancy

### REGRESSION FOUND: MDX improvements NOT reflected in production HTML

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
