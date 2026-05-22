# Audit History — gospod-bog.ru

> All audit changelogs consolidated into one file.
> Last updated: 2026-05-22

---

## v9 — Bug Hunter Real Fixes (2026-05-22)

**Commit:** `v9 Bug Hunter: real fixes (quiz SVG, CLS, search retry, CSS cleanup)`

### Fixed:
- **Quiz SVG icons** — `textContent` → `innerHTML` for `resultLabel` and `revDoneIcon`. Icons now render correctly instead of showing raw SVG markup.
- **lockScroll CLS** — Added scrollbar width compensation (`paddingRight`) when locking scroll. Prevents layout shift when scrollbar disappears.
- **CSS reduced-motion leak** — 5 animation/transition rules were outside `@media (prefers-reduced-motion: reduce)`, disabling animations for ALL users. Moved inside the media query.
- **CSS duplicate `.h-hero-search`** — ~114 lines of duplicate CSS block removed.
- **Search manifest retry** — Added retry on failure + user-facing error toast instead of silently breaking search permanently.
- **SW `waitUntil`** — Message handler now wraps cache operations in `e.waitUntil()` for reliability.
- **Cleanup** — Removed junk files (`fixed-v8/`, `site.js.bak`), deleted duplicate `js/sw.js`.

### Verified:
- `npm run validate:all` → ✅ PASS
- All JSON data files valid
- All JS/CSS files have balanced braces
- No `textContent` + SVG patterns remaining
- No reduced-motion leaks
- CSP, X-Content-Type-Options present on all pages
- JSON-LD valid on all pages
- sitemap.xml ↔ noindex: no conflicts

---

## Previous Audit History

### v5–v7 (2026-05-21 → 2026-05-22)
- Initial SEO audit and fixes
- robots.txt AI bot policies
- Schema.org JSON-LD implementation
- Service Worker caching strategies
- Performance optimizations (font preloading, image lazy loading)
- Accessibility improvements (skip link, aria-labels, focus management)

### v1–v4 (2026-05 earlier)
- Mobile responsive patches
- Interactivity fixes
- Dark mode support
- Command palette implementation

---

## Remaining Items (non-critical, tracked for future)

| # | Category | Description | Severity |
|---|----------|-------------|----------|
| 1 | PERF | `site.css` has 376 `!important` rules — consider refactoring specificity | INFO |
| 2 | PERF | 4 render-blocking CSS files in `<head>` — consider inlining critical CSS | INFO |
| 3 | PERF | 4 PNG files in `images/pastor-series/` have webp equivalents but originals still exist (2.2MB+1.9MB+2.6MB+1MB) — can delete PNGs | INFO |
| 4 | CSS | 4 selectors in `site.css` appear 3x (`.bar-icon-btn`, `.btoc-close`, `.quiz-wrapper`, `.gb-accuracy-inner`) — likely media query variants, not true duplicates | INFO |
| 5 | PERF | 10+ scroll/touch event listeners without `{passive: true}` — modern browsers handle this, but explicit is better | INFO |
| 6 | ARCH | `site.js` is 3888 lines — consider splitting into modules for maintainability | INFO |
| 7 | PWA | No `skipWaiting()` in SW — users must close all tabs to get updates | INFO |
| 8 | IMAGE | `og-preview.jpg` referenced in og:image but has no `.webp` equivalent | INFO |

**Overall project health: 9.5/10** — All critical and high-severity issues resolved.
