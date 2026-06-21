# Patch Spec — `/about/`

**Дата:** 2026-06-21  
**Назначение:** точный file-by-file план для первого shell-first pilot route `/about/`.

---

## 1. Why `/about/` is the cleanest shell-first pilot

`/about/` уже находится в промежуточном состоянии:
- legacy `<head>` сохраняется verbatim,
- body frame уже разрезан,
- смысловые блоки уже выделены в Astro component boundaries.

Фактическая структура:
- `src/components/about/_legacy/body-before.html` ≈ 1.41 KB
- `src/components/about/_legacy/body-mid.html` ≈ 0 KB
- `src/components/about/_legacy/body-after.html` ≈ 1.01 KB
- `src/components/about/_legacy/article.html` ≈ 14.65 KB
- `src/components/about/_legacy/accuracy-block.html` ≈ 1.91 KB

### Главное преимущество
Для реального pilot здесь **не нужно сначала изобретать extraction** — она уже есть.

Задача теперь другая:

> заменить raw legacy leaves на hand-authored Astro markup, не трогая legacy head и page frame.

---

## 2. Verified route anatomy

## 2.1 Before `<main id="main-content">`
Legacy `about/index.html` содержит:
- skip-link
- theme toggle
- `div.page-wrap`
- breadcrumb

Это уже инкапсулировано в `body-before.html`.

## 2.2 Main content
Внутри `<main id="main-content">`:
- `<article class="about-page" data-pagefind-body>`
- `<aside class="gb-accuracy-block">`
- SDG block

Сейчас это соответствует:
- `AboutArticle.astro`
- `AboutAccuracyBlock.astro`
- `body-after.html`

## 2.3 After `</main>`
Содержит:
- footer
- runtime scripts

Это тоже уже сидит в `body-after.html`.

### Consequence
`/about/` уже почти идеально подготовлен для **leaf replacement migration**.

---

## 3. Exact files in scope

## Primary edit targets
- `src/components/about/AboutArticle.astro`
- `src/components/about/AboutAccuracyBlock.astro`

## Context files
- `src/pages/about/index.astro`
- `src/components/about/_legacy/article.html`
- `src/components/about/_legacy/accuracy-block.html`
- `src/components/about/_legacy/body-before.html`
- `src/components/about/_legacy/body-after.html`
- `about/index.html`
- `scripts/about-visual-parity-audit.js`

## Files explicitly out of scope for first patch
- `src/utils/legacyFullDocument.ts`
- `BaseLayout.astro`
- global header/footer components
- route-level ownership / deploy config

---

## 4. Phase 1 patch: rewrite `AboutArticle.astro`

## 4.1 Current file

Current implementation is raw proxy:

```astro
---
import legacyHtml from './_legacy/article.html?raw';
---
<Fragment set:html={legacyHtml} />
```

## 4.2 Target implementation style

Replace with hand-authored Astro markup that preserves:
- exact text content
- same `class` names
- same `id` values
- same `data-pagefind-meta` spans
- same link URLs
- same aria-labels
- same semantic order

### Important rule
Do **not** redesign the markup.

This is not copywriting work and not design work.
This is **structural re-encoding of existing HTML into Astro template syntax**.

---

## 4.3 What must remain byte/contract equivalent

Inside rewritten `AboutArticle.astro`, preserve these markers:
- `<article class="about-page" data-pagefind-body>`
- `data-pagefind-meta="image"`
- `data-pagefind-meta="author"`
- `data-pagefind-meta="category"`
- `data-pagefind-meta="readTime"`
- `id="poziciya"`
- `id="methodology"`
- `id="kak-gotovyatsya-materialy"`
- `id="o-perevodah"`
- `id="resursy"`
- `id="svyaz"`
- `.about-contact-card`
- `.epigraph`

### Why
These markers are not just visual; they affect:
- pagefind
- deep links
- CSS styling
- QA scripts
- owner recognition of page structure

---

## 4.4 Recommended work pattern

### Step A
Copy `src/components/about/_legacy/article.html` into a scratch buffer.

### Step B
Re-encode it into Astro without changing structure.

### Step C
Use literal HTML in template where no dynamic behavior is needed.

### Step D
Do **not** introduce props, loops, abstractions, helpers, or reusable subcomponents in the first pass.

### Why
The first target is parity, not elegance.

---

## 5. Phase 2 patch: rewrite `AboutAccuracyBlock.astro`

## 5.1 Current file

```astro
---
import legacyHtml from './_legacy/accuracy-block.html?raw';
---
<Fragment set:html={legacyHtml} />
```

## 5.2 Target
Hand-authored Astro markup with the same:
- `aside.gb-accuracy-block`
- `aria-label`
- action buttons
- classes
- `mailto:` URL
- Telegram link

This block is much smaller, so after Article rewrite it should be straightforward.

---

## 6. Files that should NOT change in the first `/about/` patch

## 6.1 `src/pages/about/index.astro`
Leave as-is except only if absolutely necessary.

Current contract is already correct:
- `loadLegacyFullDocument('about/index.html')`
- `bodyBefore`
- `AboutArticle`
- `bodyMid`
- `AboutAccuracyBlock`
- `bodyAfter`

That is exactly the shell-first architecture we want.

## 6.2 `body-before.html` / `body-after.html`
Do not rewrite these in the first pass.

They contain high-risk frame/runtime contract pieces:
- theme toggle
- breadcrumb frame
- footer
- scripts
- SDG block positioning

---

## 7. Required checks after each step

## After `AboutArticle.astro`
```bash
node scripts/about-visual-parity-audit.js
node scripts/visual-parity-screenshots.js --routes /about/
```

## After `AboutAccuracyBlock.astro`
```bash
node scripts/about-visual-parity-audit.js
node scripts/visual-parity-screenshots.js --routes /about/
```

### Expected standard
- no `BaseLayout`
- no `astro-shell`
- no generic card/grid markers
- visual diff within approved tolerance

---

## 8. Recommended commit sequence

### Commit A
`feat(refactor-6.0-pilot): rewrite AboutArticle as hand-authored Astro`

### Commit B
`feat(refactor-6.0-pilot): rewrite AboutAccuracyBlock as hand-authored Astro`

### Commit C (optional, only later)
`refactor(refactor-6.0-pilot): reduce raw frame fragments for /about/`

This keeps rollback granular.

---

## 9. Red flags

### Red flag 1
If `AboutArticle.astro` rewrite forces changes to `body-before.html` or `body-after.html`, stop.

### Red flag 2
If parity only passes after adding `BaseLayout`, stop.

### Red flag 3
If the rewrite introduces new class names or removes anchor ids, stop.

### Red flag 4
If the temptation appears to “clean up” content while rewriting, stop.

That should be a later editorial task, not a parity pilot.

---

## 10. Minimal success criteria

After the first two commits:
- `/about/` is still shell-first route
- but its two semantic leaves are no longer raw HTML fragments
- project gains first real proof that extracted legacy blocks can become true Astro templates without changing page frame

---

## 11. Bottom line

`/about/` is not the route where extraction has to be invented.

It is the route where extraction must finally be **completed**.

The correct patch strategy is:

> keep head + frame stable, replace semantic leaves one by one, prove parity after each leaf.
