# Patch Spec — `scripts/article-mdx-pilot-audit.js`

**Дата:** 2026-06-21  
**Назначение:** адаптировать audit script под новый pilot `/articles/kod-da-vinchi/`, не ломая существующие Gill/GBS2 visual-shadow contracts.

---

## 1. Почему script уже недостаточен

Текущий `article-mdx-pilot-audit.js` фактически различает только два режима:

1. **`visualShadow: true`**  
   Для Gill / GBS2-like routes, где dist intentionally остаётся legacy-visual shell.

2. **default non-visualShadow**  
   Для routes, где ожидается generic Astro-style marker (`class="astro-article"`).

### Проблема
`/articles/kod-da-vinchi/` не подходит ни под один режим:
- это **не** Gill / GBS2 visual shadow;
- но и **не** generic `astro-article` route.

Правильный целевой контракт для этого pilot:

> **legacy-standard-article shell** — dist route Astro-owned, но сохраняет legacy page shell: `body.gbs-paper`, `themeToggle`, `tocSidebar`, `bottomBar`, `bookmarkToast`, `article-body`, `author-card`, `article-end-sdg-wrap`.

---

## 2. New strategy model

Вместо булевого:

```js
visualShadow: true | false
```

нужен явный route strategy field:

```js
strategy: 'gbs2-visual-shadow' | 'legacy-standard-article-shell' | 'generic-astro-article'
```

### Initial mapping

#### `gbs2-visual-shadow`
- `dzhon-gill-spravochnik`
- `dzhon-gill-istoricheskiy-kontekst`
- `dzhon-gill-chast-1-chelovek`
- `dzhon-gill-chast-2-uchenyi`
- `dzhon-gill-chast-3-nasledie`

#### `legacy-standard-article-shell`
- `kod-da-vinchi`
- позже сюда же likely:
  - `hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki`
  - possibly other `body.gbs-paper` standard articles

#### `generic-astro-article`
- все route, которые действительно перейдут на generic `ArticleLayout` / `astro-article` contract

---

## 3. Exact MIGRATED_ARTICLES patch shape

### Current style

```js
{
  slug: 'kod-da-vinchi',
  rel: 'articles/kod-da-vinchi/index.html',
  canonical: `${SITE}/articles/kod-da-vinchi/`,
}
```

### Replace with

```js
{
  slug: 'kod-da-vinchi',
  rel: 'articles/kod-da-vinchi/index.html',
  canonical: `${SITE}/articles/kod-da-vinchi/`,
  strategy: 'legacy-standard-article-shell',
  shellMarkers: [
    'class="gbs-paper"',
    'id="themeToggle"',
    'id="tocSidebar"',
    'class="article-body"',
    'class="gb-accuracy-block"',
    'class="author-card"',
    'class="article-end-sdg-wrap"',
    'id="bottomBar"',
    'id="btocOverlay"',
    'id="bookmarkToast"',
    'id="back-to-top"',
  ],
  forbidMarkers: [
    'class="astro-article"',
    'astro-shell',
    'astro-series-nav',
  ],
  bodySelectorClass: 'article-body',
}
```

---

## 4. Replace boolean checks with strategy switch

## 4.1 Current anti-pattern

Script contains branches like:

```js
if (item.visualShadow) {
  ...
} else {
  ...
}
```

### Required refactor

Introduce helpers:

```js
function isGbs2VisualShadow(item) {
  return item.strategy === 'gbs2-visual-shadow';
}

function isLegacyStandardArticleShell(item) {
  return item.strategy === 'legacy-standard-article-shell';
}

function isGenericAstroArticle(item) {
  return item.strategy === 'generic-astro-article';
}
```

Then replace all `item.visualShadow` branches with explicit strategy tests.

---

## 4.2 Dist ownership assertion

### New contract

#### For `gbs2-visual-shadow`
- route must **not** use `astro-article`
- must preserve GBS2 markers

#### For `legacy-standard-article-shell`
- route must **not** use `astro-article`
- must preserve legacy-standard-article markers
- must be different from legacy file byte-for-byte

#### For `generic-astro-article`
- route **must** use `astro-article`

Pseudo-shape:

```js
if (isGbs2VisualShadow(item)) {
  ...
} else if (isLegacyStandardArticleShell(item)) {
  mustNotContain(..., 'class="astro-article"');
  for (const marker of item.shellMarkers) mustContain(..., marker);
  for (const marker of item.forbidMarkers || []) mustNotContain(..., marker);
} else if (isGenericAstroArticle(item)) {
  mustContain(..., 'class="astro-article"');
}
```

---

## 5. Body parity extraction must become route-aware

Current helper:

```js
assertBodyParity(label, html, className, facts)
```

### Problem
For future standard-shell pilots, class selector must come from route config, not from strategy hardcoding.

### Required patch

Use:

```js
const bodyClass = item.bodySelectorClass || (isGenericAstroArticle(item) ? 'astro-article' : 'article-body');
assertBodyParity(label, publicArticle, bodyClass, facts);
```

This will allow:
- `kod-da-vinchi` → `article-body`
- future generic route → `astro-article`
- GBS2 visual shell → `article-body`

---

## 6. JSON-LD assertions should stay strict, but shell-agnostic

For `kod-da-vinchi`, shell strategy changes, but SEO contract should still remain strict:
- canonical exact
- title exact
- meta description exact
- OG image exact
- article published/modified instants exact
- JSON-LD `Article` node present
- `@id` and `url` canonicalized
- breadcrumb last item canonicalized

### Important
Do **not** weaken JSON-LD contract just because shell is legacy-compatible.

Shell strategy and SEO strategy are separate concerns.

---

## 7. New helper recommended

Add a dedicated helper:

```js
function assertLegacyStandardArticleShell(item, html) {
  for (const marker of item.shellMarkers || []) {
    mustContain(`${item.slug} legacy-standard shell marker`, html, marker);
  }
  for (const marker of item.forbidMarkers || []) {
    mustNotContain(`${item.slug} forbidden shell marker`, html, marker);
  }
}
```

Then call it from `auditArticle(item)` when `strategy === 'legacy-standard-article-shell'`.

---

## 8. Expected first patch sequence

### Commit 1
Refactor strategy model only.

- add `strategy`
- add helper predicates
- preserve existing behavior for Gill routes
- no new route yet

### Commit 2
Register `kod-da-vinchi` in `MIGRATED_ARTICLES`.

- add `shellMarkers`
- add `forbidMarkers`
- add `bodySelectorClass`

### Commit 3
Route-specific assertions.

- `legacy-standard-article-shell` branch
- route-aware body selector

### Commit 4
Only after real pilot route lands:
- tighten content parity expectations if needed

---

## 9. Red flags

### Red flag 1
If the easiest fix is to globally remove `astro-article` assertions, stop.

### Red flag 2
If Gill routes and `kod-da-vinchi` get merged into one generic strategy, stop.

### Red flag 3
If shell markers are reduced to only one or two classes, stop. This route needs multi-marker shell identity.

---

## 10. Minimal success criteria

After patching the audit script:
- Gill routes still pass as `gbs2-visual-shadow`
- `kod-da-vinchi` can pass as `legacy-standard-article-shell`
- future generic article pilots still have a place in the strategy matrix

That will turn `article-mdx-pilot-audit.js` from a two-mode script into a real **route-contract validator**.
