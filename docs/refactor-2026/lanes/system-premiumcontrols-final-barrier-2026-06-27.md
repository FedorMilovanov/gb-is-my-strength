# Lane: system-premiumcontrols-final-barrier-2026-06-27

**Goal:** Final surgical cleanup of PremiumControls orphan styles, bare variables, magic numbers, parser blindspots, and route classification warnings to leave a 100% green turnkey release barrier.

## Flaws Reconciled

1. **Orphan Duplicate `css/premium-controls.css` (8.8KB)** — Removed from disk and asset helper registries. Reconciled structure guard limit to `exactly 7 CSS files in /css`.
2. **Bare Tokens in `css/floating-cluster.css`** — Defined `:root` token fallbacks at the top of the runtime stylesheet. Cleared 15 bare CSS var warnings.
3. **Magic Z-Index Number** — Replaced hardcoded `z-index: 10` in tooltip rule with `var(--z-tooltip, 10)`. Cleared G65 warning.
4. **JSON-LD Script Parser** — Updated `dist-jsonld-audit.js` regex to handle `<script>` attributes appearing before `type`.
5. **Route Scoped CSS Budget** — Added `home.css` and `nagornaya-mobile-toc.css` to `routeScopedCss` in `audit-pro.js` to measure global core CSS budget accurately.

## Verification

- `npm run ci:check`: ✅ PASSED
- `node scripts/audit-pro.js`: ✅ PASSED (165 passed, 0 warnings, 0 errors)
