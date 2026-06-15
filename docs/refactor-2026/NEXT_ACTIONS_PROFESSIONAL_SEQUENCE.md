# NEXT_ACTIONS_PROFESSIONAL_SEQUENCE.md — следующий профессиональный порядок действий

Дата: 2026-06-12

---

## 1. Current status

Done:

```text
[✅] URL contract extractor
[✅] URL contract comparator
[✅] map route schema
[✅] map route draft minimal
[✅] map route validator
[✅] search-manifest ids fixed
[✅] validate:static-publication passes
[✅] professional migration docs created
```

---

## 2. Next PR 1 — extractor root/out support

Статус: ✅ выполнено 2026-06-14 (`scripts/extract-url-contract.js`).

Цель:

```text
Сделать contract extractor способным анализировать не только repo root, но и будущий dist.
```

Tasks:

```text
[x] add --root option
[x] add --out-json option
[x] add --out-md option
[x] keep current default behavior
[x] update package scripts:
    contract:extract
    contract:extract:root
    contract:extract:dist
```

Также добавлен `scripts/compare-url-contract.js` и `maps:validate`, чтобы закрыть handoff gaps до Astro scaffold.

Risk: low.

---

## 3. Next PR 2 — Astro scaffold only

Статус: ✅ выполнено 2026-06-14 (`cc85c843 feat(astro): add build-only scaffold`).

Цель:

```text
Astro собирается, production не меняется.
```

Tasks:

```text
[x] install Astro deps
[x] add astro.config.mjs
[x] add tsconfig.json
[x] add BaseLayout/Seo
[x] add /dev/astro-test/ noindex
[x] add astro:* scripts
[x] no deploy change
```

Risk: low/medium.

---

## 4. Next PR 3 — about pilot local only

Статус: ✅ выполнено 2026-06-14 (`3b5cffc4`, усилено `4de814a8`, `fcfe95e9`, `55dcd40f`). Production deploy не переключён.

Цель:

```text
/about/ воспроизведён в Astro и сравнен локально.
```

Tasks:

```text
[x] create about Astro page
[x] build dist
[x] extract dist contract
[x] compare against legacy for /about/
[x] visual screenshot capability via astro:audit:about:shots
[x] do not switch production deploy yet if dist incomplete / not explicitly approved
```

Risk: medium.

---

## 5. Next PR 4 — build-time strangler prototype

Статус: ✅ выполнено и усилено 2026-06-14/15 (`27a16583`, `7b27aa9d`, `0cfc9eee`, `68e30163`, `30e156d4`, ownership guard 2026-06-15). Production deploy не переключён.

Цель:

```text
dist contains full site: Astro-owned pages + copied legacy pages.
```

Tasks:

```text
[x] migration/page-ownership.json
[x] scripts/copy-legacy-to-dist.js
[x] no overwrite Astro-owned pages
[x] copy assets/system files
[x] dist contract compare
[x] dist publication/Pagefind/SW/smoke audits
[x] page ownership guard for manifest + production-like dist
```

Risk: medium/high.

---

## 6. Next PR 5 — deploy pipeline switch to dist

Статус: ⛔ **не делать автоматически**. Только отдельный маленький commit/PR после явного решения владельца, зелёного manual **Dist Strangler Dry Run**, принятого visual review `/about/` и выполнения `DIST_DEPLOY_SWITCH_RUNBOOK_2026-06-15.md`.

Tasks:

```text
[ ] bump sw.js CACHE_VERSION
[ ] deploy.yml upload path changes from . to dist
[ ] build production-like strangler dist
[ ] page-ownership:dist:production-like
[ ] pagefind builds on dist
[ ] .nojekyll in dist
[ ] IndexNow key goes to dist/${KEY}.txt
[ ] dist publication audit + smoke + strict SW cache-bump gate
[ ] rollback plan ready
```

Risk: high. Do not rush.

---

## 7. Current safe continuation — first article MDX pipeline

Статус: 🟢 all article shadow routes green in `dist` 2026-06-15; production root still legacy, no deploy switch.

Done:

```text
[x] src/content.config.ts article collection schema
[x] src/content/articles/dzhon-gill-spravochnik.mdx draft/noindex entry
[x] ArticleLayout.astro static article shell
[x] /dev/article-mdx-pilot/ noindex preview
[x] ownership manifest marks preview as build-only
[x] production-like dist omits build-only article preview
[x] article-mdx-pilot audit checks metadata/H1/OG/dates/Article JSON-LD and legacy public path is unchanged
[x] article-aware SEO meta parity: og:type/article:published_time/article:modified_time/article:author
[x] BreadcrumbList JSON-LD parity on intended public canonical
[x] curated MDX body migration: ratio 0.96, H2 parity 12/12
[x] public Astro shadow route `/articles/dzhon-gill-spravochnik/` in `dist`
[x] public Astro shadow route `/articles/dzhon-gill-istoricheskiy-kontekst/` in `dist`
[x] public Astro shadow route `/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/` in `dist`
[x] public Astro shadow route `/articles/kod-da-vinchi/` in `dist`
[x] public Astro shadow route `/articles/dzhon-gill-chast-1-chelovek/` in `dist`
[x] public Astro shadow route `/articles/dzhon-gill-chast-2-uchenyi/` in `dist`
[x] public Astro shadow route `/articles/dzhon-gill-chast-3-nasledie/` in `dist`
[x] public Astro shadow route `/articles/krajne-li-isporcheno-serdce/` in `dist`
[x] public Astro shadow route `/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/` in `dist`
[x] public Astro shadow route `/articles/20-antisovetov-pastoru/` in `dist`
[x] ownership manifest promotes 10 article URLs to `astro` / `shadow-pilot`
[x] multi-article shadow audit passes for 10 public routes
[x] production-like dist keeps 42 public pages and omits dev routes
[x] `npm run astro:audit:article-mdx:strict` passes
[x] `strangler:deploy-readiness` includes strict article shadow audit
[x] dist dry-run workflow asserts article shadow route exists and dev article preview is absent
[x] dist-publication-audit guards 10 article shadow routes and dev routes
[x] retired `/dev/article-mdx-pilot/` canary after public shadow route became guarded
```

Progress snapshot:

```text
Общий Astro/MDX переход:          ~82%
Safety/gates слой:                ~96%
Build-time strangler readiness:   ~98%
/about/ Astro pilot:              ~95%
MDX/article pipeline:             ~97%
Public shadow ownership:          42/42 baseline pages (100%)
Articles shadow-owned:            10/10 article pages (100%)
Production migration:             ~0–3%, deploy не переключаем
Осталось до production switch:     в основном visual / smoke / operational risk, а не route coverage
```

Next:

```text
[x] manual-ish guard layer for public shadow `/` via astro:audit:home
[x] guard layer for baptisty series shadow routes via astro:audit:baptisty-series
[x] promoted `/konfessii/russkij-baptizm/` wrapper to Astro shadow ownership
[x] promoted `/karty/ishod/` to Astro shadow prelaunch ownership
[x] promoted `/map/` to Astro shadow wrapper ownership
[x] promoted all five `nagornaya/chast-*` pages via legacy-faithful Astro shadow wrappers
[ ] manual Dist Strangler Dry Run visual review before any deploy-switch discussion
[~] focused mobile-first polish of `/` so shadow home feels like the same beautiful site, not a second UI
    - done: first-screen library chooser `.h-mobile-hero-hub`
    - done: resume-first re-entry ordering above dashboard on mobile
    - done: tighter mobile hero rhythm + stronger quick-action dock hierarchy
    - next: browser screenshot pack / touch review in full Playwright env
[ ] representative browser smoke for the newly promoted shadow wrappers/pages in an environment with full Playwright system libs
[ ] if wrapper-parity strategy stays accepted, add one visual/a11y browser audit pass specifically for `/map/`, `/karty/avraam/`, `nagornaya/chast-*`
[ ] still no production deploy switch
```

---

## 8. Parallel maps work

Can continue independently:

```text
[ ] expand route.draft.json to all 19 places
[ ] validate with maps:validate
[ ] add ajv/ajv-formats later for schema validation
[ ] no production map changes until full parity
```

---

## 9. Do not do yet

```text
❌ change hosting
❌ switch to Cloudflare
❌ add CMS
❌ add Algolia
❌ rewrite maps UI
❌ migrate homepage
❌ migrate Nagornaya
```

---

## 10. Professional mantra

```text
One PR. One risk. One rollback.
```
