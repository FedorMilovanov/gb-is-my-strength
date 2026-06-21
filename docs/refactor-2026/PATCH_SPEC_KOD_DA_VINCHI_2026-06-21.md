# Patch Spec — `/articles/kod-da-vinchi/`

**Дата:** 2026-06-21  
**Назначение:** довести pilot `/articles/kod-da-vinchi/` до уровня, где следующий агент или разработчик может выполнять работу почти пошагово без повторного ресёрча.

---

## 1. Target state after Phase 1

После первой безопасной фазы route должен перейти из:

- `pure-full-body-shadow`

в:

- `componentized shadow with extracted shell`

При этом:
- `<head>` остаётся verbatim legacy через `loadLegacyFullDocument`
- `body class="gbs-paper"` сохраняется
- before-main и after-main chrome остаются raw legacy fragments
- `<main id="main-content">` становится Astro component boundary
- **MDX body activation может быть отложена на второй commit**, но shell должен быть готов к ней

---

## 2. Expected file tree

### New files

```text
src/components/article-pilots/kod-da-vinchi/
  KodDaVinchiMainShell.astro
  KodDaVinchiArticleHeaderHero.astro      # phase 2+
  KodDaVinchiArticleBody.astro            # phase 2+
  KodDaVinchiPostArticle.astro            # phase 2+
  _legacy/
    body-segment-0.html
    body-segment-1.html
    main.html
```

### Modified files

```text
src/pages/articles/kod-da-vinchi/index.astro
scripts/article-mdx-pilot-audit.js        # позже, когда route перестанет быть astro-article-based
```

---

## 3. Exact extraction command

```bash
node scripts/extract-native-pilot.js \
  --legacy articles/kod-da-vinchi/index.html \
  --out src/components/article-pilots/kod-da-vinchi/_legacy \
  --block 'main:<main id="main-content">|</main>'
```

### Expected output
- `body-segment-0.html`
- `main.html`
- `body-segment-1.html`

### Verified sizes from dry run
- `body-segment-0.html` ≈ 2.0 KB
- `main.html` ≈ 120.9 KB
- `body-segment-1.html` ≈ 7.2 KB

---

## 4. Phase 1 route patch

## 4.1 New page implementation shape

### `src/pages/articles/kod-da-vinchi/index.astro`

```astro
---
import { loadLegacyFullDocument } from '@/utils/legacyFullDocument';
import KodDaVinchiMainShell from '@/components/article-pilots/kod-da-vinchi/KodDaVinchiMainShell.astro';
import segBefore from '@/components/article-pilots/kod-da-vinchi/_legacy/body-segment-0.html?raw';
import segAfter from '@/components/article-pilots/kod-da-vinchi/_legacy/body-segment-1.html?raw';

const { headHtml, bodyAttributes } = loadLegacyFullDocument('articles/kod-da-vinchi/index.html');
---
<!DOCTYPE html>
<html lang="ru">
  <head>
    <Fragment set:html={headHtml} />
  </head>
  <body {...bodyAttributes}>
    <Fragment set:html={segBefore} />
    <KodDaVinchiMainShell />
    <Fragment set:html={segAfter} />
  </body>
</html>
```

### What this commit proves
- route leaves pure `bodyHtml` mode
- head/body attrs contract stays stable
- route becomes extraction-ready without introducing `BaseLayout`

---

## 4.2 New shell component

### `src/components/article-pilots/kod-da-vinchi/KodDaVinchiMainShell.astro`

**Phase 1 version:**

```astro
---
import legacyHtml from './_legacy/main.html?raw';
---
<Fragment set:html={legacyHtml} />
```

This is intentionally boring.

### Why this boring step matters
It proves:
- extractor output is wired correctly,
- route survives as componentized shadow,
- parity can be checked before MDX activation.

---

## 5. Phase 2 shell split

After parity pass, split `main.html` into 3 semantic zones.

## 5.1 Proposed structure

```astro
<main id="main-content">
  <KodDaVinchiArticleHeaderHero />
  <KodDaVinchiArticleBody />
  <KodDaVinchiPostArticle />
</main>
```

---

## 5.2 Component boundaries

### `KodDaVinchiArticleHeaderHero.astro`
Must contain:
- `<header class="article-header">`
- hero `<figure class="article-hero">`

### `KodDaVinchiArticleBody.astro`
Must contain:
- `<article class="article-body" data-pagefind-body>`
- all `data-pagefind-meta` spans
- the actual longform body content

### `KodDaVinchiPostArticle.astro`
Must contain everything after article body but before `</main>`:
- `gb-accuracy-block`
- `author-card`
- `article-end-sdg-wrap`

---

## 6. Phase 3 MDX activation patch

## 6.1 Component target

### `KodDaVinchiArticleBody.astro`

```astro
---
import { getEntry, render } from 'astro:content';

const entry = await getEntry('articles', 'kod-da-vinchi');
if (!entry) {
  throw new Error('Missing MDX entry: articles/kod-da-vinchi');
}

const { Content, headings } = await render(entry);
---

<article class="article-body" data-pagefind-body>
  <span data-pagefind-meta="image" hidden>/images/og-kod-da-vinchi.webp</span>
  <span data-pagefind-meta="author" hidden>Автор-редактор: Фёдор Милованов</span>
  <span data-pagefind-meta="readTime" hidden>30</span>
  <span data-pagefind-meta="category" hidden>Апологетика</span>
  <Content />
</article>
```

### Important
Do **not** replace wrapper classes/attributes during first MDX activation.

The wrapper is the DOM contract for:
- pagefind
- TOC logic
- highlights
- bookmark engine
- article-scoped JS

---

## 6.2 Optional extra safety

Before replacing raw body with `<Content />`, you can ship an intermediate commit where `KodDaVinchiArticleBody.astro` still renders raw legacy article body HTML but inside its own component boundary.

That gives this progression:

1. route componentized
2. main split semantically
3. article body isolated
4. only then MDX swap

---

## 7. Audit implications

## 7.1 `article-mdx-pilot-audit.js` will need route-specific expectations

Current audit assumptions for non-visualShadow article pilots lean toward generic `astro-article` output.

That is **not** what this pilot should do.

### New expected contract for `kod-da-vinchi`
- route should be Astro-owned
- but still use legacy-compatible `article-body` shell
- should **not** require `class="astro-article"`
- should preserve legacy page chrome markers

### Therefore later audit patch should introduce
A per-route strategy field, e.g.:

```js
{
  slug: 'kod-da-vinchi',
  shell: 'legacy-standard-article',
  rel: 'articles/kod-da-vinchi/index.html',
  canonical: 'https://gospod-bog.ru/articles/kod-da-vinchi/'
}
```

And branch assertions accordingly.

---

## 7.2 Recommended parity assertions for this route

The following markers should survive in dist output:
- `body class="gbs-paper"`
- `id="themeToggle"`
- `id="tocSidebar"`
- `class="article-body"`
- `class="gb-accuracy-block"`
- `class="author-card"`
- `class="article-end-sdg-wrap"`
- `id="bottomBar"`
- `id="btocOverlay"`
- `id="bookmarkToast"`
- `id="back-to-top"`

---

## 8. Visual parity strategy

Playwright docs confirm that `toHaveScreenshot()` waits for two consecutive stable screenshots, supports `animations: 'disabled'`, and can `mask` dynamic areas [4](https://playwright.dev/docs/api/class-pageassertions).

### For `/articles/kod-da-vinchi/` specifically, likely dynamic/noisy areas
Potential mask candidates later if needed:
- Yandex Metrika side effects
- progress counters in bottom bar / overlay
- bookmark toast if auto-shown in some state

### But first attempt should be simpler
1. identical legacy frame
2. same runtime includes
3. no masks unless needed

Only introduce masks if screenshot noise is proven.

---

## 9. Command checklist by phase

## Phase 1
```bash
node scripts/extract-native-pilot.js \
  --legacy articles/kod-da-vinchi/index.html \
  --out src/components/article-pilots/kod-da-vinchi/_legacy \
  --block 'main:<main id="main-content">|</main>'

npm run strangler:build:production-like
node scripts/visual-parity-screenshots.js --routes /articles/kod-da-vinchi/
```

## Phase 2
```bash
# split main shell into HeaderHero / ArticleBody / PostArticle
npm run strangler:build:production-like
node scripts/visual-parity-screenshots.js --routes /articles/kod-da-vinchi/
```

## Phase 3
```bash
# activate getEntry()+render() in KodDaVinchiArticleBody.astro
npm run strangler:build:production-like
node scripts/article-mdx-pilot-audit.js --require-content-parity
node scripts/visual-parity-screenshots.js --routes /articles/kod-da-vinchi/
```

---

## 10. Red flags

### Red flag 1
If pilot requires `BaseLayout` immediately, stop.

### Red flag 2
If body class changes away from `gbs-paper`, stop.

### Red flag 3
If bottom app bar / TOC overlay / bookmark toast disappear, stop.

### Red flag 4
If audit must be weakened globally instead of route-specifically, stop.

---

## 11. Best next commit sequence

### Commit A
`feat(refactor-6.0-pilot): extract kod-da-vinchi main shell`

### Commit B
`feat(refactor-6.0-pilot): split kod-da-vinchi main into header/body/post components`

### Commit C
`feat(refactor-6.0-pilot): activate MDX body for kod-da-vinchi`

### Commit D
`fix(audit): add legacy-standard-article contract for kod-da-vinchi pilot`

This keeps rollback granular.

---

## 12. Bottom line

This route is now specified tightly enough that implementation can begin without another architecture round.

The safe recipe is:

> pure full-body shadow → extracted shell → split shell → MDX body activation → route-specific audit adaptation.
