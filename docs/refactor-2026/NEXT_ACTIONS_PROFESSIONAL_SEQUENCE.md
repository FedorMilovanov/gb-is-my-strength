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

Цель:

```text
Astro собирается, production не меняется.
```

Tasks:

```text
[ ] install Astro deps
[ ] add astro.config.mjs
[ ] add tsconfig.json
[ ] add BaseLayout/Seo
[ ] add /dev/astro-test/ noindex
[ ] add astro:* scripts
[ ] no deploy change
```

Risk: low/medium.

---

## 4. Next PR 3 — about pilot local only

Цель:

```text
/about/ воспроизведён в Astro и сравнен локально.
```

Tasks:

```text
[ ] create about Astro page
[ ] build dist
[ ] extract dist contract
[ ] compare against legacy for /about/
[ ] visual screenshot compare
[ ] do not switch production deploy yet if dist incomplete
```

Risk: medium.

---

## 5. Next PR 4 — build-time strangler prototype

Цель:

```text
dist contains full site: Astro-owned pages + copied legacy pages.
```

Tasks:

```text
[ ] migration/page-ownership.json
[ ] scripts/copy-legacy-to-dist.js
[ ] no overwrite Astro-owned pages
[ ] copy assets/system files
[ ] dist contract compare
```

Risk: medium/high.

---

## 6. Next PR 5 — deploy pipeline switch to dist

Only after PR 4 is green.

Tasks:

```text
[ ] deploy.yml upload path changes from . to dist
[ ] pagefind builds on dist
[ ] .nojekyll in dist
[ ] smoke test
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
