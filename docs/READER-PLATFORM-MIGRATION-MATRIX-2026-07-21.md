# Reader Platform — migration matrix

**Baseline date:** 2026-07-21  
**Source baseline:** `main` at `1a66bd8ef6c0316842deef75371db9598f7a16c6`

This is an implementation inventory, not a visual redesign plan.

## 1. Surface classes

| Surface | Canonical engine | Shape | Current implementation | Target |
|---|---|---:|---|---|
| Gill biography/context/reference | `series` | `flat` | `GillSeriesChrome` + Gill-specific sheets/data | Generic series façade, Gill theme/capabilities preserved |
| Heart / hard-texts work | `series` | `book` | Generic `SeriesConfig` rendered through `GillSeriesChrome` | Same series engine, generic name/API, shared preferences |
| Baptist history series | `series` | `flat` | Generic configs rendered through `GillSeriesChrome` | Same series engine, shared preferences and registry |
| Pastor/thematic series | `series` | `flat` | Generic configs rendered through `GillSeriesChrome` | Same series engine, shared preferences and registry |
| Hermenevtika | `article` | — | Dedicated MobileBar/Rail + shared-ish ReaderSettings | Standalone article adapter on shared settings/chrome primitives |
| Kod Da Vinci | `article` | — | `ReaderRail` + `ReaderSettings`, page-specific chrome | Standalone article adapter and registry entry |
| Catalogs (`/articles/`, `/biografii/`, etc.) | `page` | — | `MobileChromePage` on an incomplete registry | Complete registry + shared preference capability where appropriate |
| About/favorites/reference pages | `page` | — | Page-specific chrome/sticky navigation | Explicit page profiles; avoid double headers |
| Biblical maps | `special` | — | Dedicated map engine | Theme capability adapter, no article progress UI |
| Hall / 3D / graph explorer | `special` | — | Dedicated immersive runtime | Shared overlay/preferences contracts only where safe |

## 2. Current coverage evidence

### 2.1 Shared platform already present

- `src/components/article-pilots/_shared/MobileChromeShell.astro`
- `src/components/article-pilots/_shared/MobileChromePage.astro`
- `src/components/article-pilots/_shared/ReaderRail.astro`
- `src/components/article-pilots/_shared/ReaderSettings.astro`
- `src/components/article-pilots/_shared/mobileChromeTypes.ts`
- `src/components/article-pilots/_shared/mobileChromeRegistry.ts`
- `src/components/article-pilots/_shared/series/seriesConfig.ts`
- `scripts/check-engine-contracts.js`
- `scripts/engine-sweep.mjs`
- `docs/SERIES-ENGINE-GUIDE.md`

### 2.2 Quantified duplication / incompleteness

- `GillSeriesChrome` is referenced by 43 source files and already acts as the de facto generic series engine.
- `MobileChromeShell` is referenced by only a small adapter set.
- 62 `*PageHead.astro` files contain route-owned theme/localStorage bootstrap code.
- `mobileChromeRegistry.ts` explicitly covers Gill, Hermenevtika and six page catalogs, but not the full set of routes already using shared series chrome.
- `ArticleLayout.astro` and `SeriesArticleLayout.astro` currently have no source consumers.
- Multiple preference namespaces encode the same concepts.

## 3. Preference migration table

| Existing key/state | Current owner | Canonical field | Migration action |
|---|---|---|---|
| `theme` | global legacy scripts | `theme` | read first launch, normalize, retain compatibility class |
| `html.dark` | global + reader components | derived from `theme === 'dark'` | compatibility output only |
| `gb:font-scale` | floating cluster/shared controls | `fontScale` | import into canonical object; keep bridge until all controls migrated |
| `gb:gill-reader-theme:v1` | Gill reader | `theme` | migrate; stop route-specific writes |
| `gb:gill-line-height:v1` | Gill reader | `lineHeight` | migrate |
| `gb:gill-measure:v1` | Gill reader | `measure` | migrate |
| `gb:hm-reader-theme:v1` | standalone reader | `theme` | migrate |
| `gb:hm-line-height:v1` | standalone reader | `lineHeight` | migrate |
| `gb:hm-measure:v1` | standalone reader | `measure` | migrate |
| scoped `data-gill-reader-theme=sepia` | Gill root | root theme tokens | replace with adapter/token bridge |
| scoped `data-hm-reader-theme=sepia` | article root | root theme tokens | replace with adapter/token bridge |

## 4. Component migration table

| Current component | Problem | Compatibility step | Final role |
|---|---|---|---|
| `GillSeriesChrome` | Generic implementation has Gill name | Add `SeriesReaderChrome` façade forwarding identical props/slots | Generic series chrome; Gill wrapper optional/deprecated |
| `GillReaderSettingsSheet` | Own preference state and keys | Replace handlers with shared preference API; keep DOM/CSS parity | Series settings adapter |
| `ReaderSettings` | Separate HM preference namespace | Replace with shared preference API | Generic settings primitive or standalone adapter |
| `HermenevtikaMobileBar` | Standalone-specific action wiring | Keep semantic adapter, move shell/settings behavior shared | `StandaloneArticleChrome` adapter |
| `MobileChromePage` | Registry coverage incomplete | Drive from complete surface registry | Generic page chrome |
| 62 PageHead bootstraps | Duplicate first-paint logic | Introduce one `ReaderPreferencesHead` include | Route metadata remains local; preference bootstrap shared |
| `ArticleLayout` / `SeriesArticleLayout` | Parallel unused abstraction | Do not force adoption; evaluate after surface convergence | Remove or retain only if a real consumer needs them |

## 5. Route registry rollout

### Wave A — representative routes

The first browser matrix must cover:

1. Gill flat series article;
2. Heart `shape:'book'` article;
3. Baptist flat series article;
4. Hermenevtika standalone article;
5. Kod Da Vinci standalone article;
6. `/articles/` ordinary page;
7. `/izbrannoe/` page with existing sticky navigation;
8. one biblical map special surface;
9. `/hall/` or graph special surface using declared theme capability.

### Wave B — every native route

Generate/check profiles for every `src/pages/**/index.astro` and every published legacy route. New routes fail CI when unclassified.

### Wave C — remove pathname inference

All adapter selection, representative tests and migration reports read the registry. Route-specific components may still render metadata/content, but cannot invent a new engine implicitly.

## 6. System transactions

### R1 — preferences foundation

Permanent files expected:

- shared preference schema/store runtime;
- early head bootstrap;
- global semantic theme tokens including Sepia;
- legacy-key migration tests;
- browser persistence witnesses across at least one series and one article.

No visual chrome redesign in R1.

### R2 — Gill + standalone adapters

- wire Gill settings and generic ReaderSettings to R1;
- preserve existing selectors and visual parity;
- verify preference change on one route is visible on another route;
- remove writes to Gill/HM-specific keys after compatibility window.

### R3 — generic series naming

- introduce `SeriesReaderChrome`;
- migrate imports mechanically in bounded batches;
- keep a compatibility wrapper while visual/parity guards run;
- rename CSS only if necessary and in a later transaction.

### R4 — complete surface registry

- classify all routes;
- connect `MobileChromeShell` adapters through explicit profiles;
- add CI guard for unclassified routes;
- document special surfaces and opt-outs.

### R5 — PageHead convergence

- replace duplicated theme bootstrap in PageHeads;
- keep canonical/OG/JSON-LD local;
- compare generated head output and first-paint behavior.

### R6 — mobile quality/performance sweep

- 320/360/390/430 px overflow matrix;
- 44 px targets and safe areas;
- focus/scroll-lock/overlay matrix;
- scroll-handler and duplicate-runtime audit;
- representative desktop parity.

## 7. Required gates for every transaction

Minimum:

```text
npm run engine:contracts
npm run engine:sweep
npm run guard:shared-files
npm run validate:static-publication
npm run strangler:build:production-like
```

Plus focused pure tests and Playwright witnesses added by the transaction.

No transaction may obtain green by weakening existing publication, ownership, parity or engine guards.

## 8. Non-goals

- no one-shot replacement of every page component;
- no forced article UI on maps/3D;
- no content rewrite bundled with engine migration;
- no global image filter for Sepia;
- no new route-specific preference key;
- no second series implementation for books;
- no merge of old Claude branches wholesale without current-source revalidation.
