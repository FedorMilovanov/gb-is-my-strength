# Reader R4 — public surface registry

## Canonical model

Every public route is already owned by `migration/page-ownership.json` and described by one file in `data/route-profiles/`. R4 extends those existing profiles; it does not create a second handwritten route list.

Required profile fields:

- `surfaceContractVersion: 1`;
- `surface: series | article | page | special`;
- `seriesShape: flat | book` only when `surface=series`.

The build-time registry derives chrome owner, config sources and settings capability from the actual resolved import graph and `mobileChromeRegistry.ts`.

## Verified baseline

- 76 owned public routes;
- 51 series routes: 27 flat and 24 book;
- 2 standalone articles;
- 9 ordinary pages;
- 14 special applications/surfaces;
- 41 exact `SeriesReaderChrome` consumers;
- 0 direct `GillSeriesChrome` leaks outside the façade.

## Invariants

1. A book is always `surface=series` plus `seriesShape=book`; it is never a fifth engine.
2. A resolved `SeriesReaderChrome` import requires `surface=series`.
3. A resolved `hardTextsSeriesConfig` import requires `seriesShape=book`.
4. Map, map-landing, confession and genealogy route types are `special`.
5. Built applications are `special`.
6. Mobile series/article adapters must agree with the profile surface. A page adapter may be reused by a special surface only as navigation chrome.
7. The historical `GillSeriesChrome` implementation may be imported only by `SeriesReaderChrome`.
8. Registry validation is read-only and covers every page-ownership route.

## Change workflow

To add or migrate a public route, edit its existing route profile and production source. Run:

```bash
npm run surface:registry:check
npm run surface:registry:test
npm run migration:metadata:check:strict
```

Changing the series implementation remains centralized behind `SeriesReaderChrome`; changing global preferences remains centralized in Reader R1. R4 classifies and cross-validates surfaces but does not redesign their DOM or visuals.
