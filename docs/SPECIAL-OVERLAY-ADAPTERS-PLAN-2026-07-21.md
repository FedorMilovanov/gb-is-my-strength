# Special Overlay Adapters — issue #58 completion lane

## Status

Map panel + nested photo ownership is the active implementation cluster. MindMap3D and built-output verification remain separate follow-up commits in this PR.

## Source boundary

- Base source: `43d8672f59128de816cfd47c638c132a73d71599` (Reader R5 merge).
- Canonical lifecycle owner: `window.OverlayRuntime` / `SiteUtils.OverlayRuntime`.
- This lane migrates only special-surface overlay ownership. It does not change map data, geography, rendering, camera behavior, gestures or visual design.

## Confirmed remaining production writers

1. `karty/_engine/map-engine.js`
   - place panel writes `document.body.style.overflow` directly;
   - photo modal has an independent Escape handler;
   - panel has a route-local focus trap and Escape handler;
   - `destroy()` does not release overlay ownership.
2. `_build-tools/konfessii-baptizm/MindMap3D.tsx`
   - fullscreen effect writes html/body overflow and body overscroll directly.
3. Built special-app output must be located and verified before issue #58 can close.

## Target ownership

- each map instance receives unique owner IDs for its place panel and nested photo modal;
- photo modal is the top layer over an open place panel;
- Escape closes only the top runtime layer;
- closing the final owner restores exact styles, scroll and opener focus;
- `destroy()` releases only the map instance’s owners;
- MindMap3D fullscreen uses a named canonical scroll token.

## Required witnesses

- panel open/close with exact scroll and focus restoration;
- panel → photo → Escape closes photo only and keeps panel locked;
- second Escape closes panel;
- reverse/destroy recovery does not leak owners;
- mobile landscape viewport;
- Chromium, Firefox and WebKit;
- static guard forbids direct lock writers outside the canonical module/compatibility bridge.

## Non-goals

- map P0/P1 rendering or data bugs;
- layer/theme redesign;
- reader progress, bookmarks, notes or TTS state;
- content or metadata changes;
- compatibility preference-key cleanup.
