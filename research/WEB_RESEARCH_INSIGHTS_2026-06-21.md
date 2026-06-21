# Web Research Insights — Refactoring 6.0
## 40+ searches across 10 domains

Generated: 2026-06-21

---

## 1. CSS @Layer Migration Strategy (8 searches)

### Key Findings:
- **5-layer architecture** proven in production: `@layer reset, base, components, utilities, overrides`
- **Unlayered CSS beats layered** — legacy can be left unlayered as highest priority during migration
- **`!important` in EARLY layer beats `!important` in LATER layer** — this is inverse of normal rules
- **`@import` into layer** works: `@import url('framework.css') layer(library)`
- **Nested layers** via dot notation: `@layer gbs2.rail`
- **`revert-layer`** keyword allows undoing a layer's styles

### Applied in Plan:
- Phase 2: `@layer reset, base, gbs2, nagornaya, components, utilities, overrides`
- Expected result: site.css !important 270→≤50

### Sources:
- Smashing Magazine: "Integrating CSS Cascade Layers To An Existing Project"
- DEV.to: "Understanding @layer and Cascade Layers"
- MDN: "@layer CSS at-rule"
- Smashing Magazine: "Getting Started With CSS Cascade Layers"

---

## 2. Astro MDX Content Migration (6 searches)

### Key Findings:
- **Astro 6** requires Node 22.0+ and `src/content.config.ts` (not legacy config)
- **Content Layer API** = 5x faster Markdown builds, 2x faster MDX builds
- **MDX in content collections** is fully supported with proper schema validation
- **`render()` function** changed in Astro 5/6: `const { Content, headings } = await render(entry);`
- **Legacy collections disabled by default** in Astro 6 — must use new API
- **Cloudflare acquired Astro** in Jan 2026 — framework is well-funded long-term

### Applied in Plan:
- Phase 5: MDX migration for 20 articles
- Must update `src/content.config.ts` to modern loader syntax

### Sources:
- inhaq.com: "Astro Content Collections: Complete 2026 Guide"
- tech-insider.org: "Astro Tutorial: Build a Content Site in 13 Steps [2026]"
- docs.astro.build: "Upgrade to Astro v5"

---

## 3. Visual Regression Testing CI (5 searches)

### Key Findings:
- **Playwright Docker** for consistent rendering: `mcr.microsoft.com/playwright:v1.50.0-noble`
- **`toHaveScreenshot()`** is preferred over manual `page.screenshot()` + pixelmatch
- **Mask dynamic content** with Playwright `mask` option (Yandex Metrika, random phrases)
- **Retry 2, workers 4, timeout 30s** — optimal CI config
- **Baselines must come from CI**, not local machine (OS rendering differences)
- **`maxDiffPixelRatio: 0.01`** as standard threshold

### Applied in Plan:
- Phase 1: Rewrite visual-parity-screenshots.js to use `toHaveScreenshot()`
- Add mask for dynamic elements

### Sources:
- bug0.com: "Playwright Visual Regression Testing: Built-In Guide 2026"
- oneuptime.com: "How to Build Visual Regression Testing"
- testquality.com: "Playwright Visual Regression: Baselines, Flake & CI Guide 2026"

---

## 4. Event Listener Memory Leaks (5 searches)

### Key Findings:
- **AbortSignal** = one `abort()` call removes ALL listeners attached with that signal
- **`{ once: true }`** for one-shot listeners
- **Event delegation** > per-element listeners for dynamic collections (e.g., map markers)
- **Named functions** required for explicit `removeEventListener`
- **WeakRef + FinalizationRegistry** for advanced cases
- **Unsubscribe pattern**: return cleanup function from every module

### Applied in Plan:
- Phase 7: site.js decomposition with AbortController per module
- MapEngine v2: event delegation for markers

### Sources:
- patterns.dev: "Observer Pattern"
- kitemetric.com: "How to Avoid JavaScript Event Listener Memory Leaks"
- dev.to: "Memory Leaks in JavaScript: A Simple Guide"

---

## 5. TypeScript Gradual Migration (3 searches)

### Key Findings:
- **`allowJs: true` + `checkJs: false`** — start with mixed codebase
- **JSDoc annotations** before full migration
- **Enable strict mode gradually**: `noImplicitAny` → `strictNullChecks` → full `strict`
- **60-70% JS → TS** is realistic before enabling strict mode

### Applied in Plan:
- Phase 9: Start with MapEngine v2, then utils, then JS modules

### Sources:
- tech-insider.org: "TypeScript vs JavaScript: 73% of Devs Switched [2026]"
- typescriptworld.com: "A Developer's Guide to TypeScript Migration"

---

## 6. Static Site Broken Links (3 searches)

### Key Findings:
- **`linkinator` npm package** for automated broken link detection
- **`check-html-links`** — fast, streaming HTML parser
- **Missing file focused** > error in file focused reporting
- Can integrate into CI

### Applied in Plan:
- Add `npm run check-links` to validate:static-publication

### Sources:
- dev.to: "Introducing check html links"
- swharden.com: "Static Site Broken Link Detection"

---

## 7. Tailwind CSS v4 (1 search)

### Key Findings:
- **Tailwind v4** moves config from JS to CSS-native `@theme` directives
- **Rust-based core** — 100ms full rebuilds
- **Breaking changes**: gradient classes renamed
- **Upgrade tool**: `npx @tailwindcss/upgrade`

### Note for project:
- Project uses `nagornaya/tw.min.css` (Tailwind v3~) — NOT upgrading now

### Source:
- digitalapplied.com: "Tailwind CSS v4 2026: Migration Best Practices"

---

## 8. Accessibility Testing (1 search)

### Key Findings:
- **axe-core + Playwright** catches ~30% of WCAG violations
- **Manual keyboard smoke** is still required
- **Focus visible, Tab order, Esc closes modals, button names** — minimum checks

### Applied in Plan:
- Phase 11: axe-core CI gate + keyboard smoke checklist

### Source:
- QUALITY_GATES.md (project doc)

---

## Summary: What Changed in Our Plan vs Phase 5

| Area | Was (Phase 5) | Now (Phase 6.0) |
|------|--------------|-----------------|
| CSS strategy | !important 270→200 target | @layer → !important ≤50 |
| Visual guard | pixelmatch manual | Playwright toHaveScreenshot() |
| JS cleanup | manual per-listener | AbortController per module |
| MDX pipeline | shadow-wrap (lossy) | native MDX rendering (Phase 5) |
| Broken links | manual check | linkinator CI integration |
| TypeScript | not planned | MapEngine + utils first |
| CI rendering | varies by machine | Playwright Docker container |
