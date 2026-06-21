# Pilot Implementation Plan — `/articles/kod-da-vinchi/`

**Дата:** 2026-06-21  
**Pilot type:** content/layout-first, extracted-shell breakout  
**Verified against:** local legacy HTML anatomy + `extract-native-pilot.js` dry run + Astro content docs

---

## 1. Final recommendation in one sentence

Для `/articles/kod-da-vinchi/` **не** делать blind switch на `ArticleLayout.astro`; делать **extracted-shell promotion**:

- legacy head stays verbatim,
- legacy body splits into frame + main shell,
- MDX body activates inside that shell via `getEntry()+render()`.

---

## 2. What was verified

## 2.1 Legacy shell anatomy

Локальная проверка legacy `articles/kod-da-vinchi/index.html` показала:

### Body before `<main>`
Содержит:
- `body class="gbs-paper"`
- skip-link
- reading-progress
- section-label
- `themeToggle`
- `tocSidebar`

### `<main id="main-content">`
Содержит:
- article header
- hero figure
- central article area
- accuracy block
- author card
- SDG end block

### After `</main>`
Содержит:
- footer
- bottom app bar
- bottom TOC overlay
- bookmark toast
- `bookmark-engine.js`
- `site-utils.js`
- `scroll-perf.js`
- `site.js`
- `glossary.js`
- `sw-register.js`
- `search.js`
- `highlights.js`
- `enhancements.js`
- `back-to-top`

Это означает: route уже естественно делится на **frame / main / runtime tail**.

---

## 2.2 Verified dry-run extraction

Проверенный helper command:

```bash
node scripts/extract-native-pilot.js \
  --legacy articles/kod-da-vinchi/index.html \
  --out .arena/kdv-extract \
  --block 'main:<main id="main-content">|</main>'
```

Dry run дал:
- `body-segment-0.html` — ~2.0 KB
- `main.html` — ~120.9 KB
- `body-segment-1.html` — ~7.2 KB

### Что это доказывает
Extractor already works on this page.

То есть first implementation step не теоретический, а **механически подтверждён**.

---

## 2.3 Why `ArticleLayout.astro` is not step 1

Current `ArticleLayout.astro` depends on:
- `BaseLayout.astro`
- `astro-shell`
- `Header.astro`
- `Footer.astro`
- `global.css`
- generic layout wrappers

Legacy `kod-da-vinchi` page instead depends on:
- `body.gbs-paper`
- route-specific chrome
- explicit `themeToggle`
- custom TOC sidebar
- bottom app bar and bottom TOC overlay
- bookmark/highlights/glossary runtime contract

### Consequence

If we switch straight to `ArticleLayout`, we risk changing too many layers at once:
- body class contract,
- page frame,
- header/footer chrome,
- runtime markers,
- DOM expected by `site.js` modules.

So `ArticleLayout` is **not disproven**, but it is **too coarse** for the first pilot.

---

## 3. Exact implementation shape

## Phase A — pure route → componentized shadow

### Goal
Transform route from this:

```astro
const { headHtml, bodyHtml, bodyAttributes } = loadLegacyFullDocument(...)
<body {...bodyAttributes}>
  <Fragment set:html={bodyHtml} />
</body>
```

into this structure:

```astro
const { headHtml, bodyAttributes } = loadLegacyFullDocument(...)
import segBefore from '@/components/articles-kdv/_legacy/body-segment-0.html?raw';
import segAfter from '@/components/articles-kdv/_legacy/body-segment-1.html?raw';
import KodDaVinchiMainShell from '@/components/articles-kdv/KodDaVinchiMainShell.astro';

<body {...bodyAttributes}>
  <Fragment set:html={segBefore} />
  <KodDaVinchiMainShell />
  <Fragment set:html={segAfter} />
</body>
```

### Outcome
Even before MDX activation, route leaves the **33 pure** class and becomes **componentized shadow**.

---

## Phase B — split main shell

Inside `KodDaVinchiMainShell.astro`:

### Step B1
Start with:
```astro
import legacyMain from './_legacy/main.html?raw';
<Fragment set:html={legacyMain} />
```

This keeps parity while creating a route-local shell component.

### Step B2
Then split `main.html` semantically into 3 zones:
1. `KodDaVinchiArticleHeaderHero.astro`
2. `KodDaVinchiArticleBody.astro`
3. `KodDaVinchiPostArticle.astro`

Proposed structure:

```astro
<main id="main-content">
  <KodDaVinchiArticleHeaderHero />
  <KodDaVinchiArticleBody />
  <KodDaVinchiPostArticle />
</main>
```

---

## Phase C — activate MDX body only

This is the key step.

`KodDaVinchiArticleBody.astro` should become the first live MDX activation point:

```astro
---
import { getEntry, render } from 'astro:content';
const entry = await getEntry('articles', 'kod-da-vinchi');
if (!entry) throw new Error('Missing articles/kod-da-vinchi MDX entry');
const { Content } = await render(entry);
---
<article class="article-body" data-pagefind-body>
  ... legacy pagefind meta spans ...
  <Content />
</article>
```

### Important nuance
Static hosting does **not** block this path.

Astro content collections work at build time, and prerendered pages can render collection entries using `getEntry()` + `render()` in static output [1](https://docs.astro.build/en/guides/content-collections/) [4](https://docs.astro.build/en/reference/modules/astro-content/).

So:
- GitHub Pages blocks request-time cookies/headers/middleware rollout,
- but does **not** block build-time MDX activation.

---

## 4. File plan

## New directory
Suggested:
- `src/components/article-pilots/kod-da-vinchi/`

### Phase A files
- `_legacy/body-segment-0.html`
- `_legacy/main.html`
- `_legacy/body-segment-1.html`
- `KodDaVinchiMainShell.astro`

### Phase B files
- `KodDaVinchiArticleHeaderHero.astro`
- `KodDaVinchiArticleBody.astro`
- `KodDaVinchiPostArticle.astro`

### Route file
- `src/pages/articles/kod-da-vinchi/index.astro`

---

## 5. Exact command sequence

## Step 0 — confirm extractor
```bash
node scripts/extract-native-pilot.js \
  --legacy articles/kod-da-vinchi/index.html \
  --out src/components/article-pilots/kod-da-vinchi/_legacy \
  --block 'main:<main id="main-content">|</main>'
```

## Step 1 — create shell component
```bash
# write KodDaVinchiMainShell.astro using _legacy/main.html?raw
```

## Step 2 — route promotion to componentized shadow
```bash
# update src/pages/articles/kod-da-vinchi/index.astro
# keep headHtml + bodyAttributes
# replace bodyHtml with segBefore + KodDaVinchiMainShell + segAfter
```

## Step 3 — parity proof before semantic split
```bash
node scripts/visual-parity-screenshots.js --routes /articles/kod-da-vinchi/
```

## Step 4 — split main shell into 3 components
```bash
# first keep each component raw if needed
# then replace ArticleBody with MDX Content
```

## Step 5 — MDX parity + contract checks
```bash
node scripts/article-mdx-pilot-audit.js --require-content-parity
```

## Step 6 — full build smoke
```bash
npm run strangler:build:production-like
```

---

## 6. Success criteria

## Structural
- route no longer uses `bodyHtml` directly
- legacy head stays verbatim
- body class remains `gbs-paper`
- no `BaseLayout` / `astro-shell` drift

## Content
- `kod-da-vinchi.mdx` becomes live rendering source for central article body
- pagefind meta survives
- article body class and runtime hooks remain intact

## Visual
- parity on `/articles/kod-da-vinchi/` remains within threshold
- TOC sidebar, bottom app bar, bookmark toast, theme toggle still render correctly

## Runtime
- glossary / highlights / bookmark / TOC behavior do not lose DOM hooks expected by JS

---

## 7. Known risks

### Risk 1 — MDX body shape mismatch
Legacy article body may include wrappers/anchors/meta spans not currently present in MDX output.

**Mitigation:** preserve all non-content wrapper markup around `<Content />`.

### Risk 2 — JS selectors tied to exact DOM
`site.js`, `glossary.js`, `highlights.js`, `bookmark-engine.js` may depend on:
- `.article-body`
- heading ids
- TOC markers
- bottom bar markers

**Mitigation:** do not rename classes/ids during first pilot.

### Risk 3 — hidden ArticleLayout assumptions
Temptation to reuse `ArticleLayout` too early may create generic-shell drift.

**Mitigation:** keep first pilot extracted-shell only.

---

## 8. Rollback

Rollback is trivial if pilot is done in stages.

### After Phase A
Revert route file back to `bodyHtml`.

### After Phase C
If MDX activation fails:
- keep extracted shell,
- revert only `KodDaVinchiArticleBody.astro` to raw legacy body.

That gives a much safer rollback than whole-route layout replacement.

---

См. также:
- детальный file-by-file spec: `docs/refactor-2026/PATCH_SPEC_KOD_DA_VINCHI_2026-06-21.md`
- patch spec для audit adaptation: `docs/refactor-2026/PATCH_SPEC_ARTICLE_MDX_AUDIT_2026-06-21.md`
- visual gate enhancement note: `docs/refactor-2026/PLAYWRIGHT_VISUAL_GATE_ENHANCEMENT_2026-06-21.md`

## 9. Final verdict

The first practical coding move for real Refactoring 6.0 is now clear:

> `/about/` proves shell-first replacement of raw fragments with Astro markup.  
> `/articles/kod-da-vinchi/` proves content/layout-first activation of MDX inside a legacy-compatible extracted shell.

This pair gives the project two real recipes instead of one abstract migration promise.
