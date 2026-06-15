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

## 7. Parallel maps work

Can continue independently:

```text
[ ] expand route.draft.json to all 19 places
[ ] validate with maps:validate
[ ] add ajv/ajv-formats later for schema validation
[ ] no production map changes until full parity
```

---

## 8. Do not do yet

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

## 9. Professional mantra

```text
One PR. One risk. One rollback.
```
