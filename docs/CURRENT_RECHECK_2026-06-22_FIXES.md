# Current recheck fixes — 2026-06-22

Context: recheck was performed against current `main` at `affc61e2` and the two audit notes supplied on 2026-06-22. This file records what was fixed in the follow-up patch and what guards now prevent recurrence.

## Fixed publication/runtime defects

- `/articles/kod-da-vinchi/` theme toggle no longer double-toggles. `site.js` marks legacy theme ownership with `window.__gbLegacyThemeMounted`; extracted `theme.js` / `site-modules.js` skips mounting when legacy already owns the controls.
- `/articles/kod-da-vinchi/` no longer uses fake cache-bust labels. The Astro page computes md5short hashes for `css/site-layered.css` and `js/site-modules.js` at build time.
- Gill III readable defects fixed:
  - `труженикаnister` → `труженика Евангелия`.
  - `Gillism Gillism` duplication removed from reader/search text.
  - `Санhedрин` → `Санхедрин`.
- Stale root legacy text synced where it could become rollback/source truth:
  - home read-time cards: `34 мин`, `47 мин`.
  - `/nagornaya/seriya/`: `89 минут чтения`, `исследовательская находка`.

## Fixed guards / CI policy

- `npm run css:layer:validate` now validates `css/site-layered.css --ceiling=202` and is included in `validate:static-publication`.
- `scripts/css-layer-validator.js` no longer runs a costly duplicate-selector heuristic on very large CSS files.
- `scripts/visual-audit.js` now fails fast if the HTTP server is absent, does not suppress `crash`, and exits non-zero for remaining HIGH/CRITICAL findings.
- `scripts/readable-audit.js` supports `--root dist` and blocks fatal readable-publication patterns.
- `/about/` deploy-readiness no longer compares against stale full-document root legacy; it now guards the approved premium design markers.
- `visual-parity.yml` summary output is redirected by the shell, not embedded inside JS.
- `notify-on-failure.yml` listens for **Dist Strangler Dry Run**, and `scripts/check-workflows.js` enforces it.

## Map publication governance

Temporary map holding pages are intentionally reachable but no longer promoted as finished production content.

For `pavel`, `early-church`, `revelation`, `maccabim`, `melachim`, `shoftim`, `shvatim`, `yeshua`:

- `robots: noindex, follow`.
- `data-pagefind-body` removed; `data-pagefind-ignore` added.
- removed from `sitemap.xml`.
- removed from `llms.txt`.
- removed from `data/search-manifest.json`.
- removed from `data/public-content-baseline.json`.
- `route.json` now records:
  - `publication.status = temporary-placeholder`
  - `indexable/sitemap/llms/pagefind = false`

New guard: `npm run maps:publication-status` (also part of `npm run maps:validate`) verifies these invariants.

## Search manifest / command palette

`js/search.js` fallback recommendations were updated to match `data/search-manifest.json` read times. `scripts/check-data-consistency.js` now verifies fallback recommendation read-time drift so stale hardcoded values cannot silently return.

## Verification performed

The local environment had Node 20 as system Node, so Astro/build gates were run with Node 22.12.0 via `npx -p node@22.12.0`.

Passed:

```bash
npm run css:layer:validate
npm run workflows:check
npm run maps:validate
npm run data:consistency
npm run readable-audit
npm run readable-audit -- --root dist
node scripts/audit-pro.js
npm run validate:static-publication
npm run strangler:deploy-readiness
npm run strangler:build:production-like
npm run pagefind:build:dist
npm run page-ownership:dist:production-like
npm run contract:extract:dist
npm run contract:compare:dist
node scripts/dist-publication-audit.js --require-pagefind --forbid-dev
npm run dist:css-parity
npm run sw:dist:audit:deploy-switch
npm run visual-audit
```

Runtime browser check on production-like `dist` confirmed `/articles/kod-da-vinchi/` theme toggle switches to dark after click while both `site.js` and `site-modules.js` are loaded.

`npm run visual-audit` without a running server was also checked and now exits with failure instead of producing a false green.

## Known non-blocking notes

- `audit-pro` still warns about total CSS budget and long AGENTS changelog size.
- URL contract compare reports an informational title drift for `/karty/ishod/`, because this route is now a ready interactive map instead of an old holding page.

## Follow-up cleanup before refactor continuation

Additional cleanup removed the last non-blocking audit noise:

- AGENTS changelog compacted to the latest 20 rows; older AGENTS-r140..r243 rows were preserved in `AUDIT_HISTORY.md`.
- `audit-pro` CSS budget now treats `css/site-layered.css` as route-scoped/pilot CSS rather than global core CSS, so the global CSS budget measures the real always-loaded surface.
- `data/public-content-baseline.json` was aligned with the ready `/karty/ishod/` title/H1 to remove the stale contract warning.

Current `audit-pro` summary after this cleanup:

```txt
165 passed · 0 warnings · 0 errors
```
