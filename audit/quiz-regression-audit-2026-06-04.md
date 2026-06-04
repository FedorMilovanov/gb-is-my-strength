# Quiz / tooltip implementation audit — resolved pass (2026-06-04)

## Context
This note consolidates the quiz/tooltips regression review and the repair pass completed on 2026-06-04.

## Initial findings (before fixes)
The recent quiz wave had three root problems:
1. Mixed quiz schemas (`q/answer/ok/err` vs `question/correct/explanation`) while the runtime still assumed the legacy shape.
2. Broken inline `window.SITE_CONFIG` quiz blocks in John Gill Part I / II / III.
3. Decorative `.gterm[data-term]` markup inside quiz questions without real glossary hydration.

## What was repaired
- `js/site.js`
  - Added a backward-compatible quiz normalization layer.
  - Preserved support for both legacy and new schemas.
  - Carried forward `type`, `correct`, `explanation`, `sourceRef` and heading-anchor resolution.
  - Upgraded feedback rendering to show both `explanation.short` and `explanation.full`.
  - Added quiz-render events for dynamic glossary hydration.
- `js/glossary.js`
  - Reworked loading/runtime so existing `.gterm[data-term]` nodes can be hydrated after initial page load.
  - Added support for dynamic quiz content via `gb:quiz-rendered`.
- `data/glossary.json`
  - Added missing aliases/entries for terms introduced by the quiz/tooltips wave.
- `articles/dzhon-gill-chast-1-chelovek/index.html`
  - Fixed broken quiz object syntax.
  - Repaired the swallowed paragraph caused by a malformed footnote tooltip insertion.
- `articles/dzhon-gill-chast-2-uchenyi/index.html`
  - Fixed broken quiz syntax and normalized question quality.
- `articles/dzhon-gill-chast-3-nasledie/index.html`
  - Fixed broken quiz syntax.
  - Cleaned wording and typos (`Сперджен`, `смиренный`).
- `articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/index.html`
  - Fixed the `Heilsgeschichte` question mismatch.
- `articles/kod-da-vinchi/index.html`
  - Fixed typo `текты` → `тексты`.
- `scripts/validate.js`
  - Added inline `<script>` syntax validation for all HTML pages.
- `scripts/audit-pro.js`
  - Added inline `<script>` syntax audit check.
- `README.md`, `AGENTS.md`
  - Updated quiz schema examples to the canonical new format while documenting legacy compatibility.

## Final verification
- `node --check js/*.js scripts/*.js sw.js` → ✅ PASS
- `npm run cache-bust` → ✅ PASS
- `npm run validate:all` → ✅ PASS
- `npm run tokens:check` → ✅ PASS
- `node scripts/audit-pro.js` → ✅ PASS (`31 passed / 2 warnings / 0 errors`)

## Final verdict
The quiz/tooltips wave is now:
- **technically deploy-safe**,
- **backward-compatible** with older quiz pages,
- **editorially stronger** on the repaired Gill / Hermeneutics pages,
- and no longer relies on fake glossary markup inside dynamic quiz HTML.

Remaining warnings are only the pre-existing soft size-budget warnings (CSS / JS totals).
