# Current recheck fixes — 2026-06-22

> **Статус: HISTORICAL SNAPSHOT / PROVENANCE-ONLY.** Слово `Current` относится только к recheck, выполненному 2026-06-22 на `main@affc61e2`. Этот файл не описывает текущий Product `main`, current route ownership, актуальное число проверок, текущие CSS/runtime owners или живой backlog. Используйте его как forensic evidence того, что было проверено и исправлено в той волне; нынешнее состояние устанавливается по current source contracts, exact-head CI и AuditRepo.

Context: recheck was performed against then-current `main` at `affc61e2` and the two audit notes supplied on 2026-06-22. This file records what was fixed in the follow-up patch and what guards existed after that repair wave.

## Fixed publication/runtime defects

- `/articles/kod-da-vinchi/` theme toggle no longer double-toggled in that snapshot. `site.js` marked legacy theme ownership with `window.__gbLegacyThemeMounted`; extracted `theme.js` / `site-modules.js` skipped mounting when legacy already owned the controls.
- `/articles/kod-da-vinchi/` no longer used fake cache-bust labels. The Astro page computed md5short hashes for `css/site-layered.css` and `js/site-modules.js` at build time.
- Gill III readable defects fixed in that wave:
  - `труженикаnister` → `труженика Евангелия`.
  - `Gillism Gillism` duplication removed from reader/search text.
  - `Санhedрин` → `Санхедрин`.
- Stale root legacy text synced where it could then become rollback/source truth:
  - home read-time cards: `34 мин`, `47 мин`.
  - `/nagornaya/seriya/`: `89 минут чтения`, `исследовательская находка`.

## Fixed guards / CI policy in that snapshot

- `npm run css:layer:validate` validated `css/site-layered.css --ceiling=202` and was included in `validate:static-publication`.
- `scripts/css-layer-validator.js` no longer ran a costly duplicate-selector heuristic on very large CSS files.
- `scripts/visual-audit.js` failed fast if the HTTP server was absent, did not suppress `crash`, and exited non-zero for remaining HIGH/CRITICAL findings.
- `scripts/readable-audit.js` supported `--root dist` and blocked fatal readable-publication patterns.
- `/about/` deploy-readiness no longer compared against stale full-document root legacy; it guarded the then-approved premium design markers.
- `visual-parity.yml` summary output was redirected by the shell, not embedded inside JS.
- `notify-on-failure.yml` listened for **Dist Strangler Dry Run**, and `scripts/check-workflows.js` enforced it.

These statements are historical evidence, not instructions to restore retired scripts, thresholds or ownership.

## Map publication governance in that snapshot

Temporary map holding pages were intentionally reachable but no longer promoted as finished production content.

For `pavel`, `early-church`, `revelation`, `maccabim`, `melachim`, `shoftim`, `shvatim`, `yeshua` at that time:

- `robots: noindex, follow`.
- `data-pagefind-body` removed; `data-pagefind-ignore` added.
- removed from `sitemap.xml`.
- removed from `llms.txt`.
- removed from `data/search-manifest.json`.
- removed from `data/public-content-baseline.json`.
- `route.json` recorded:
  - `publication.status = temporary-placeholder`
  - `indexable/sitemap/llms/pagefind = false`

The then-new guard was `npm run maps:publication-status` (also part of `npm run maps:validate`). Current publication membership must be checked from current registries and route data.

## Search manifest / command palette

`js/search.js` fallback recommendations were updated in that wave to match `data/search-manifest.json` read times. `scripts/check-data-consistency.js` then verified fallback recommendation read-time drift.

## Verification performed

The local environment used for this historical run had Node 20 as system Node, so Astro/build gates were run with Node 22.12.0 via `npx -p node@22.12.0`.

Passed at the 2026-06-22 anchor:

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

This command list is evidence of that run, not a current mandatory all-purpose validation recipe. Current checks are selected through `docs/WORK_MODES.md` and current package/workflow contracts.

Runtime browser check on the production-like `dist` of that wave confirmed `/articles/kod-da-vinchi/` theme toggle switched to dark after click while both `site.js` and `site-modules.js` were loaded.

`npm run visual-audit` without a running server was also checked and then exited with failure instead of producing a false green.

## Known non-blocking notes at the time

- `audit-pro` still warned about total CSS budget and long AGENTS changelog size.
- URL contract compare reported an informational title drift for `/karty/ishod/`, because that route had become a ready interactive map instead of an old holding page.

## Follow-up cleanup recorded in this snapshot

Additional cleanup removed the then-non-blocking audit noise:

- AGENTS changelog compacted to the latest 20 rows; older AGENTS-r140..r243 rows were preserved in `AUDIT_HISTORY.md`.
- `audit-pro` CSS budget treated `css/site-layered.css` as route-scoped/pilot CSS rather than global core CSS, so the global CSS budget measured the then-current always-loaded surface.
- `data/public-content-baseline.json` was aligned with the ready `/karty/ishod/` title/H1 to remove the stale contract warning.

Historical `audit-pro` summary after that cleanup:

```txt
165 passed · 0 warnings · 0 errors
```

Do not use this number as a current test-count or quality claim.
