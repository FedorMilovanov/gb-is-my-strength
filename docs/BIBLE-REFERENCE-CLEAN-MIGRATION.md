# Clean Bible reference migration

This branch supersedes only the Bible-reference portion of the former mixed glossary PR.

Included:

- canonical book/alias registry;
- parser and resolver core;
- strict corpus/inline-payload contract;
- explicit `full` versus `excerpt` semantics;
- five known ellipsis/range corrections;
- dedicated exact-head CI.

Excluded:

- glossary runtime and policy;
- Gill article edits;
- route-specific HTML rewrites;
- mass cache-bust changes;
- any unverified edition URL or copyright conclusion.

The migration is accepted only when `node scripts/bible-reference-contract.mjs --strict` is green and the workflow captures stderr, lints itself and leaves the repository unchanged.
