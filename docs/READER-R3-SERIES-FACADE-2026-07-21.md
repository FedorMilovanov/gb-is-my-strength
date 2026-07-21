# Reader R3 — neutral SeriesReaderChrome façade

Status: implementation lane opened from source `main` after Reader R1 (`ffdba149`).

## Scope

- inventory every direct `GillSeriesChrome` import;
- add a neutral `SeriesReaderChrome` façade;
- preserve existing props, slot, DOM, CSS selectors and runtime behaviour;
- migrate series/book consumers mechanically;
- add a guard preventing new direct imports outside the façade;
- prove flat series, `series.shape='book'` and Gill reference routes.

## Non-goals

- no new book engine;
- no DOM/CSS rename;
- no visual redesign;
- no overlay lifecycle refactor;
- no content edits;
- no route-registry R4 work in this PR.

## Required gates

Shared Files Guard, Native Source Contract, production-like build, engine contracts, façade guard and browser parity.

## Inventory and implementation

- 41 production consumers migrated.
- façade is the only direct implementation importer.
- no DOM/CSS selector changes.
- permanent guard wired into engine contracts and Shared Files Guard.
