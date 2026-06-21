# Playwright Visual Gate Enhancement — 2026-06-21

**Дата:** 2026-06-21  
**Назначение:** уточнить, как текущий `scripts/visual-parity-screenshots.js` должен эволюционировать в сторону Playwright-native visual gate.

---

## 1. Что уже хорошо в текущем скрипте

`scripts/visual-parity-screenshots.js` уже делает несколько правильных вещей:
- поднимает два static servers
- сравнивает legacy vs dist
- прогоняет desktop + mobile
- фиксирует animation/transition noise через injected CSS
- ждёт `networkidle`
- проверяет image completeness
- делает retry-best-of-3

Это хороший engineering-grade custom tool.

---

## 2. Что подтвердили внешние источники

Playwright official API подтверждает, что `toHaveScreenshot()` и locator screenshot assertions уже поддерживают:
- stable two-consecutive-captures behavior,
- `animations: 'disabled'`,
- `mask`, `maskColor`,
- `stylePath`,
- `fullPage`,
- `maxDiffPixelRatio`, `maxDiffPixels`, `threshold`.

### Самый важный практический инсайт

`stylePath` — недооценённый инструмент.

Он позволяет **не менять runtime code и не инжектить ad-hoc CSS внутрь теста**, а применять специальный stylesheet только во время screenshot capture.

---

## 3. Why this matters for this repo

В проекте много route-specific dynamic/noisy surfaces:
- Yandex Metrika side effects
- progress counters
- bookmark toasts
- bottom bars
- mobile overlays
- runtime-generated TOC state
- map controls / timers / scroll progress indicators

Сейчас скрипт решает это в основном через universal CSS injection.

### Это полезно, но недостаточно

Потому что реальный production-grade visual contract здесь должен быть:
- **global normalization** для animations/caret
- **route-specific masking or stylePath normalization** для noisy islands
- **threshold profiles by route family**

---

## 4. Recommended next evolution of `visual-parity-screenshots.js`

## 4.1 Add route profiles

Вместо одного общего threshold, ввести route profiles:

```js
const ROUTE_PROFILES = {
  '/about/': { thresholdPct: 0.1, mode: 'critical' },
  '/articles/kod-da-vinchi/': { thresholdPct: 0.5, mode: 'standard-article' },
  '/karty/avraam/': { thresholdPct: 1.0, mode: 'high-risk-map' },
};
```

### Why
- `/about/` should be stricter
- content pilots can be standard
- maps/special apps need a different noise budget

---

## 4.2 Add optional `stylePath` support

Official Playwright docs confirm `stylePath` can apply a stylesheet only during screenshot capture, piercing shadow DOM and inner frames.

### Proposed shape

```js
const ROUTE_SCREENSHOT_STYLES = {
  '/articles/kod-da-vinchi/': 'tests/visual/styles/kod-da-vinchi-normalize.css',
  '/about/': 'tests/visual/styles/about-normalize.css',
};
```

And use it in Playwright-native migration path.

### Example use cases
For `kod-da-vinchi`, if needed later, `stylePath` can normalize:
- transient bookmark toast
- progress text counters
- auto-updated section labels

Without touching app code.

---

## 4.3 Add explicit mask profiles

Playwright docs confirm `mask` and `maskColor` are built-in and that mask applies even to invisible elements.

### Proposed shape

```js
const ROUTE_MASKS = {
  '/articles/kod-da-vinchi/': [
    '#bookmarkToast',
    '#barProgressText',
    '#btocProgressPct',
  ],
};
```

### Caution
Masking should be last resort, not default.

Rule:
1. preserve real UI if possible
2. normalize via CSS if deterministic noise is proven
3. mask only if unavoidable

---

## 4.4 Split page-level and locator-level assertions

Official Playwright docs also support `locator.toHaveScreenshot()`.

### Why this matters
Whole-page diff is necessary for final parity, but component-level diff is better for debugging.

### Recommended future pattern
- page-level screenshot for release gate
- locator-level screenshot for pilot component work

Example:
- `/about/` full page for release gate
- `.about-page` locator for component migration of `AboutArticle`
- `.gb-accuracy-block` locator for secondary proof

---

## 5. Specific recommendations for current pilots

## 5.1 `/about/`

### Initial mode
- no masking
- no route-specific stylePath unless flake is proven
- strict threshold

### Possible later locator captures
- `page.locator('.about-page')`
- `page.locator('.gb-accuracy-block')`

---

## 5.2 `/articles/kod-da-vinchi/`

### Initial mode
- no masking first
- preserve bottom bar / TOC overlay / bookmark toast presence
- test whether current global animation-freeze is sufficient

### If flake appears
Try in order:
1. route-specific `stylePath`
2. only then `mask`

### Best candidate selectors for style normalization
- `#bookmarkToast`
- `#barProgressText`
- `#btocProgressPct`
- maybe other progress counters if runtime proves noisy

---

## 6. Concrete code evolution path

### Phase 1
Keep current custom script, but add route profile config object.

### Phase 2
Add route-level optional fields:
- `thresholdPct`
- `pixelThreshold`
- `stylePath`
- `maskSelectors`

### Phase 3
For pilot routes, generate optional locator-level screenshots in addition to full-page ones.

### Phase 4
Longer term, consider moving from fully custom script to Playwright test-runner-native `expect(page).toHaveScreenshot()`-based suite while preserving dual-server topology.

---

## 7. Why this is worth doing now

Because current project is moving from broad audit theory to route-by-route pilot execution.

Once `/about/` and `/articles/kod-da-vinchi/` become real breakouts, visual failures will stop being abstract “whole site drift” and start being **localized component regressions**.

At that moment, route-specific Playwright features (`stylePath`, masks, locator screenshots) become much more valuable than a one-size-fits-all capture script.

---

## 8. Bottom line

The repo already has a serious visual regression foundation.

The next improvement is not to replace it wholesale, but to make it:
- route-aware,
- profile-aware,
- and Playwright-feature-aware.

That is the shortest path from “global screenshot guard” to a real pilot-friendly visual CI system.
