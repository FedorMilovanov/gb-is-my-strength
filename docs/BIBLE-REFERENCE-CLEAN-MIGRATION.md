# Clean Bible reference migration

**Status:** historical migration handoff / provenance-only
**Accepted in repository:** commit `b4fbb42c70869713dddc7687f7970864becc1aa2`, 2026-07-24
**Current authority:** current Bible-reference source, corpus registries and current blocking contracts

This file records the bounded Bible-reference migration that was accepted at the commit above. Its former wording “This branch” lost its referent after merge, so the historical scope is now tied to the immutable accepted commit instead of an unnamed branch.

The migration superseded only the Bible-reference portion of the former mixed glossary work.

## Included in that migration

- canonical book/alias registry;
- parser and resolver core;
- strict corpus/inline-payload contract;
- explicit `full` versus `excerpt` semantics;
- five known ellipsis/range corrections;
- dedicated exact-head CI.

## Excluded from that migration

- glossary runtime and policy;
- Gill article edits;
- route-specific HTML rewrites;
- mass cache-bust changes;
- any unverified edition URL or copyright conclusion.

## Historical acceptance boundary

At acceptance, the migration required `node scripts/bible-reference-contract.mjs --strict` to be green and its workflow to capture stderr, lint itself and leave the repository unchanged.

That statement describes the 2026-07-24 migration gate; it is not a promise that the command, corpus shape or complete present-day validation surface remains unchanged. For current work, re-read the current source/contracts and select the currently applicable Bible-reference gates.
