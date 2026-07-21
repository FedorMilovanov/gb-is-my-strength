# Reader R5 — Unified Overlay Runtime

## Status

Reader R5 is implemented for the reader P0 cluster. Chromium, Firefox and WebKit pass the permanent forward/reverse nested-ownership matrix, exact scroll/style restoration, exact opener focus return, top-layer Escape routing, inert ownership, repeated-open idempotence, reduced motion and pagehide recovery. Transaction-only patchers and workflows have been removed.

Map-engine and generated-app direct writers remain explicitly outside this reader lane and are tracked as special-surface adapter work; they are not represented as completed by R5.

## Scope

R5 implements issue #58 as one isolated runtime lane. It unifies lifecycle, focus and scroll ownership for reader overlays without redesigning their DOM or visuals.

## Target API

```text
OverlayRuntime.register(ownerId, options)
OverlayRuntime.open(ownerId, options)
OverlayRuntime.close(ownerId, reason)
OverlayRuntime.destroy(ownerId)
OverlayRuntime.lockScroll(ownerId)
OverlayRuntime.unlockScroll(ownerId)
OverlayRuntime.topLayer()
OverlayRuntime.forceRecover(reason)
```

The runtime owns named/reference-counted scroll tokens, open-layer ordering, exact opener focus return, Escape routing, `aria-hidden` / `inert` state and pagehide recovery.

## Required invariants

1. One canonical state store; load order cannot replace global methods with a second implementation.
2. Body/html styles are captured once and restored only after the final owner closes.
3. Closing one overlay never unlocks another.
4. Escape affects only the top closable layer.
5. Focus returns to the exact opener when it remains connected and focusable.
6. Destroy releases only the destroyed owner and its listeners.
7. Route navigation/pagehide cannot leave stale body position, top or overflow.
8. Reduced-motion and interrupted transitions do not delay ownership release indefinitely.
9. Existing selectors, buttons, sheets and visual CSS remain stable.
10. Direct body/html lock writers are forbidden outside the canonical module and temporary compatibility bridge.
11. Reopening the same owner is idempotent and cannot leak inert or scroll claims.

## Transaction order

1. Read-only inventory and conflict map.
2. Canonical source module plus compatibility bridge.
3. Runtime/mutation tests before consumer migration.
4. Migrate series and standalone reader settings first.
5. Migrate remaining reader overlays by verified cluster.
6. Browser matrix for nested ownership, Escape, focus return and pagehide.
7. Remove compatibility writers only after parity.

## Non-goals

- reader progress, bookmarks or notes state;
- TTS state;
- content or metadata;
- visual redesign;
- map runtime fixes;
- removal of preference compatibility keys.
