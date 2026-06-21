# Patch Spec — Visual Parity Route Profiles

**Дата:** 2026-06-21  
**Назначение:** превратить текущий screenshot guard из one-size-fits-all инструмента в route-aware system.

---

## 1. Why a profile system is now necessary

Текущий `scripts/visual-parity-screenshots.js` использует:
- один глобальный threshold,
- один общий CSS normalization block,
- один общий execution mode.

Это уже неплохо, но pilot stage изменил требования.

Теперь в проекте есть как минимум 4 типа visual targets:

1. **critical shell-first pages** — `/about/`
2. **standard article content pilots** — `/articles/kod-da-vinchi/`
3. **hybrid hubs / landings** — `/karty/`, `/konfessii/`, `/articles/`
4. **high-risk special apps** — `karty/*`, `/rodosloviye/`, `/konfessii/russkij-baptizm/`

Им не подходит одинаковая чувствительность.

---

## 2. External facts confirmed

Playwright official docs confirm support for:
- `toHaveScreenshot()` stable capture behavior,
- `animations: 'disabled'`,
- `mask`, `maskColor`,
- `stylePath`,
- per-assertion `threshold`, `maxDiffPixelRatio`, `maxDiffPixels` [1](https://playwright.dev/docs/api/class-pageassertions).

### Consequence
Our custom script should become **profile-aware**, even before any full migration to Playwright test-runner-native snapshots.

---

## 3. Proposed profile model

Add a route profile table near the top of `scripts/visual-parity-screenshots.js`.

### Example

```js
const ROUTE_PROFILES = {
  '/about/': {
    mode: 'critical-shell',
    thresholdPct: 0.1,
    pixelThreshold: 0.1,
    firstFoldOnly: false,
  },
  '/articles/kod-da-vinchi/': {
    mode: 'standard-article-pilot',
    thresholdPct: 0.5,
    pixelThreshold: 0.1,
    firstFoldOnly: false,
    stylePath: 'tests/visual/styles/kod-da-vinchi-normalize.css',
  },
  '/karty/avraam/': {
    mode: 'high-risk-map',
    thresholdPct: 1.0,
    pixelThreshold: 0.12,
    firstFoldOnly: false,
  },
};
```

---

## 4. Resolution rules

### Step 1
For each route, resolve profile:

```js
function getRouteProfile(route) {
  return ROUTE_PROFILES[route] || DEFAULT_PROFILE;
}
```

### Step 2
Use profile values instead of global defaults where present.

Fields to support:
- `thresholdPct`
- `pixelThreshold`
- `fullPage` / `firstFoldOnly`
- `stylePath`
- `maskSelectors`
- `retryAttempts`

---

## 5. Exact script patches

## 5.1 Replace scalar threshold assumptions

### Current
```js
const THRESHOLD_PCT = parseFloat(arg('--threshold', '1.0'));
const PIXEL_THRESHOLD = parseFloat(arg('--pixel-threshold', '0.1'));
```

### New
Keep globals as defaults, but route profile may override them.

```js
const DEFAULT_THRESHOLD_PCT = parseFloat(arg('--threshold', '1.0'));
const DEFAULT_PIXEL_THRESHOLD = parseFloat(arg('--pixel-threshold', '0.1'));
```

Then inside per-route loop:

```js
const profile = getRouteProfile(route);
const thresholdPct = profile.thresholdPct ?? DEFAULT_THRESHOLD_PCT;
const pixelThreshold = profile.pixelThreshold ?? DEFAULT_PIXEL_THRESHOLD;
```

---

## 5.2 Add route-level retry count

### Current
Retry count is hardcoded:
```js
const MAX_ATTEMPTS = 3;
```

### New
```js
const maxAttempts = profile.retryAttempts ?? 3;
```

### Why
Maps and special-app routes may need more stabilization room than `/about/`.

---

## 5.3 Add route-level style normalization

Playwright now supports `stylePath` officially [1](https://playwright.dev/docs/api/class-pageassertions).

Even if current script still uses `page.screenshot()` rather than `expect(page).toHaveScreenshot()`, the architecture should prepare for this feature by storing route-level style profile decisions now.

### Immediate pragmatic patch
Introduce profile field anyway:

```js
stylePath: 'tests/visual/styles/about-normalize.css'
```

### If staying on custom `page.screenshot()` for now
Equivalent behavior can be approximated by reading CSS from file and injecting it with `page.addStyleTag({ content })`.

So add helper:

```js
function loadScreenshotStyle(profile) {
  if (!profile.stylePath) return '';
  const abs = path.join(ROOT, profile.stylePath);
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
}
```

Then merge with existing freeze CSS.

---

## 5.4 Add route-level masks

Even if custom script does not yet use Playwright assertion masks directly, profile contract should define them now.

### Proposed shape

```js
maskSelectors: ['#bookmarkToast', '#barProgressText']
```

### Immediate implementation path
If keeping custom screenshot path:
- temporarily hide these selectors via injected CSS before screenshot.

Example generated CSS:

```css
#bookmarkToast,
#barProgressText {
  visibility: hidden !important;
}
```

### Important rule
Mask-like hiding must be route-specific and justified, never global by default.

---

## 6. Recommended initial profiles for this repo

## `/about/`
```js
{
  mode: 'critical-shell',
  thresholdPct: 0.1,
  pixelThreshold: 0.1,
  retryAttempts: 2,
}
```

### Why
Low dynamic noise, premium owner-sensitive page.

---

## `/articles/kod-da-vinchi/`
```js
{
  mode: 'standard-article-pilot',
  thresholdPct: 0.5,
  pixelThreshold: 0.1,
  retryAttempts: 3,
  hiddenSelectors: [
    '#bookmarkToast',
  ],
}
```

### Why
Article has scroll/progress/bookmark runtime surfaces that may introduce pilot noise.
Start conservative: hide only `bookmarkToast` if proven necessary.

---

## `/karty/avraam/`
```js
{
  mode: 'high-risk-map',
  thresholdPct: 1.0,
  pixelThreshold: 0.12,
  retryAttempts: 4,
}
```

### Why
Heavy interactive surface, highest visual complexity.

---

## 7. Logging patch

Add route profile info to summary/log output.

### Desired console output
```text
✅ /about/ desktop: diff=0.000% [profile=critical-shell threshold=0.1]
✅ /articles/kod-da-vinchi/ mobile: diff=0.132% [profile=standard-article-pilot threshold=0.5]
```

### Desired summary fields
```json
{
  "route": "/about/",
  "profile": "critical-shell",
  "thresholdPct": 0.1,
  "pixelThreshold": 0.1
}
```

This will make later audit interpretation much easier.

---

## 8. Minimal patch sequence

### Commit 1
Introduce `ROUTE_PROFILES` + fallback resolution only.

### Commit 2
Replace hardcoded thresholds with resolved profile values.

### Commit 3
Add route-specific hidden selectors / style injection support.

### Commit 4
Add logging + summary profile metadata.

---

## 9. Red flags

### Red flag 1
If route profiles become a way to silently loosen every route, stop.

### Red flag 2
If all routes get masks by default, stop.

### Red flag 3
If thresholds are raised globally because one route is noisy, stop.

---

## 10. Bottom line

The next maturity step for visual parity in this repo is not “replace everything with new tooling.”

It is:

> keep current dual-server architecture, but add route-aware profile logic so pilots and special apps stop fighting the same global screenshot settings.
