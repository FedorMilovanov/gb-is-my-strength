# Universal Reader Platform — architecture baseline

**Status:** source baseline after PRs #94–97, 2026-07-21  
**Purpose:** finish the convergence already started in the repository without creating another parallel reader implementation.

## 1. Owner intent recovered from the Claude export

The required result is not a Gill-only visual mockup. The site needs one maintainable reading platform where changes to chrome, mobile behavior and reading preferences propagate to every compatible surface.

Owner requirements that are treated as architecture constraints:

- production integration must reuse real repository components, SVGs, selectors and runtime contracts;
- mobile top and bottom bars must behave as one seamless app-like chrome with safe areas, touch targets and predictable auto-hide;
- reader preferences must include Day, Night and Sepia, plus text size, line height and measure;
- preferences must be centralized: adding or changing a preference once must update all reader surfaces;
- notes, bookmarks, highlights, glossary, search, playback and learning are capabilities, not reasons to fork a whole engine;
- books, ordinary series, standalone articles and non-article pages must remain semantically different but share platform primitives;
- integration and migration instructions belong in the repositories so later agents do not reproduce isolated mockups.

The original conversation export remains an evidence source; this document records only the durable technical contract.

## 2. Current source truth

The repository already contains the correct beginning of the platform:

- `MobileChromeEngine = 'series' | 'article' | 'page'`;
- `MobileChromeShell.astro` is a shared structural shell;
- `SeriesConfig.shape` supports `flat | book`;
- `defineSeriesConfig()` validates series data;
- `engine:contracts`, `engine:sweep` and `engine:guard` protect shared behavior;
- `SeriesReaderChrome` now fronts the existing Gill implementation for Gill, Heart/book, Baptist and other series routes;
- `ReaderRail` and `ReaderSettings` are already shared by standalone article pilots;
- global design tokens exist in `css/site.css`.

The problem is incomplete convergence, not absence of an engine.

Inventory at this baseline:

- 1,736 relevant text/source files inventoried;
- 41 production consumers import the neutral `SeriesReaderChrome` façade;
- 62 `*PageHead.astro` files contain their own early theme/localStorage bootstrap;
- the mobile registry explicitly lists only a small subset of the real series/article/page surfaces;
- Gill and standalone readers use different localStorage keys for the same concepts;
- Sepia is scoped separately to Gill and Hermenevtika/standalone roots;
- `ArticleLayout.astro` and `SeriesArticleLayout.astro` exist but have no source consumers;
- route-specific PageHead/Body/PageChrome compositions remain the dominant native architecture.

## 3. Canonical surface model

There are three reading engines and one non-reader capability family.

### 3.1 `series`

Use for related publications with sequence, progress and prev/next navigation.

Two shapes are supported by the same engine:

- `shape: 'flat'` — independent parts, optional front matter and satellites;
- `shape: 'book'` — chapter headings with numbered articles inside chapters.

**A book is not a fourth engine.** It is `series.shape = 'book'`.

### 3.2 `article`

Use for a standalone long-form article without series progress. It may still use:

- article TOC;
- reader preferences;
- playback;
- save/notes/highlights;
- glossary/search/learning capabilities.

### 3.3 `page`

Use for ordinary non-article surfaces such as catalogs, reference landing pages and other scrollable pages. Page mode normally provides navigation/search and can opt into selected reading capabilities, but does not pretend to have article or series progress.

### 3.4 `special`

Maps, graph explorers, the 3D Hall and other immersive tools are not forced into reader chrome. They use adapters and capability flags for shared concerns such as:

- global theme/preferences where appropriate;
- back/home/search actions;
- safe-area tokens;
- overlays and scroll-lock coordination;
- performance and accessibility contracts.

They retain their own interaction model.

## 4. Shared preference service

The next implementation foundation is one global preference store.

Canonical persisted object:

```ts
interface ReaderPreferencesV1 {
  version: 1;
  theme: 'light' | 'dark' | 'sepia';
  fontScale: number;
  lineHeight: 'compact' | 'normal' | 'relaxed';
  measure: 'narrow' | 'normal' | 'wide';
  textMode: 'rich' | 'plain';
  motion: 'system' | 'reduced';
}
```

Canonical storage key:

```text
gb:reader-preferences:v1
```

Canonical browser API:

```text
window.GBReaderPreferences
```

Canonical event:

```text
gb:reader-preferences-change
```

Canonical root attributes:

```text
html[data-reader-theme="light|dark|sepia"]
html[data-reader-text-mode="rich|plain"]
html[data-reader-motion="system|reduced"]
```

`html.dark` remains a compatibility alias during migration. It must be derived from the canonical store, not become a competing source of truth.

### 4.1 Legacy key migration

The service must read and normalize at least:

- `theme`;
- `gb:font-scale`;
- `gb:gill-reader-theme:v1`;
- `gb:gill-line-height:v1`;
- `gb:gill-measure:v1`;
- `gb:hm-reader-theme:v1`;
- `gb:hm-line-height:v1`;
- `gb:hm-measure:v1`.

After successful migration, all adapters read the canonical store. Legacy keys may be mirrored temporarily only when an unconverted runtime still requires them.

## 5. Global Sepia

Sepia is a first-class site preference, not a Gill CSS special case.

Implementation rules:

1. Define global semantic tokens under `html[data-reader-theme='sepia']` in the shared token layer.
2. Do not blanket-filter images, video, maps or 3D canvases.
3. Reader surfaces inherit paper, text, muted, border, link, selection and control tokens.
4. Special surfaces may explicitly declare `themeCapability: 'full' | 'chrome-only' | 'none'`.
5. Components must not create new route-specific sepia storage keys.

## 6. Shared head bootstrap

The 62 duplicated early theme scripts in PageHead components must converge on one bootstrap component or generated inline module.

Responsibilities:

- read/migrate preferences before first paint;
- apply root attributes and compatibility classes;
- avoid FOUC;
- contain no route-specific branding;
- be safe when storage is blocked;
- expose the same initial state consumed by the hydrated runtime.

Page-specific metadata, canonical, JSON-LD and visual assets remain local to PageHead components.

## 7. Chrome composition

Keep shell + adapters. Do not create a mega-component with dozens of booleans.

Shared primitives:

- top navigation row;
- bottom reader/actions row;
- progress primitives;
- sheet/overlay skeleton;
- settings UI backed by the shared preference service;
- touch/safe-area/autohide behavior;
- focus management and coordinated scroll lock;
- common icons and action semantics.

Adapters:

- `SeriesReaderChrome` — landed generic façade; it alone imports the existing `GillSeriesChrome` implementation to preserve parity;
- `StandaloneArticleChrome` — article TOC/progress without series navigation;
- `ContentPageChrome` — ordinary page navigation/search/actions;
- special adapters for map/3D only where shared capabilities make sense.

Gill-specific atmosphere, quiz data and artwork remain in a Gill config/theme/capability module. They must not define the platform contract.

## 8. Surface registry

Every public route must have an explicit surface profile. Pathname heuristics are forbidden.

Minimum profile:

```ts
interface ContentSurfaceProfile {
  route: string;
  engine: 'series' | 'article' | 'page' | 'special';
  shape?: 'flat' | 'book';
  adapter: string;
  capabilities: {
    toc?: boolean;
    playback?: boolean;
    save?: boolean;
    notes?: boolean;
    highlights?: boolean;
    learning?: boolean;
    globalTheme?: 'full' | 'chrome-only' | 'none';
  };
  owner: string;
  migrationState: 'legacy' | 'adapter' | 'native';
}
```

The registry becomes the source for:

- chrome selection;
- tests and representative matrices;
- migration reporting;
- route-profile metadata;
- prevention of unclassified new routes.

## 9. Performance and mobile contract

The reader platform is not complete merely because it builds.

Required contracts:

- no horizontal document overflow at 320, 360, 390 and 430 CSS px;
- controls have at least 44×44 CSS px interactive targets;
- bars honor `env(safe-area-inset-*)`;
- only one subsystem owns body scroll lock at a time;
- scroll listeners are passive where possible and scheduled through a single rAF controller;
- hidden sheets do not remain focusable;
- mobile chrome does not duplicate a route's existing sticky navigation;
- long articles use containment/lazy behavior where it does not break anchors/search;
- preferences update without full-page reload or route-specific reinitialization;
- special/immersive pages do not load full reader chrome when they do not need it.

## 10. Migration order

1. Global preferences core + early head bootstrap + site-wide Sepia tokens.
2. Adapt existing Gill and standalone settings to the canonical store without visual redesign.
3. Introduce generic `SeriesReaderChrome` compatibility façade and migrate imports mechanically.
4. Build complete content-surface registry and guard every public route.
5. Converge standalone article and ordinary page adapters on shared settings/chrome primitives.
6. Replace duplicated PageHead theme bootstraps.
7. Add representative Playwright matrix for flat series, book series, standalone article, ordinary page and special surface.
8. Only after parity, remove legacy keys, aliases and unused layouts.

Each stage is a separate system transaction with full publication and browser barriers. Do not combine content redesign with platform migration.

## 11. Definition of done

The platform is considered converged when:

- a change to the shared settings UI appears on every compatible reader surface;
- Sepia works site-wide according to each surface's declared capability;
- one preference change persists across Gill, Heart/book, Baptist series, standalone articles and ordinary pages;
- every public route is classified;
- there are no route-owned duplicate implementations of the canonical preference state;
- engine guards and Playwright cover all representative surface types;
- mobile and desktop have no regressions in overflow, focus, safe areas, scroll lock or first-paint theme;
- special pages remain fast and interaction-appropriate rather than being forced into article UI.
