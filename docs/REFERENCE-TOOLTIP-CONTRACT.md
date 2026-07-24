# Bible reference data contract

This capability centralizes parsing and provenance for Bible-reference payloads. It is deliberately separate from glossary terms and academic-note triggers.

## Canonical source

- `data/bible/books.json` is the book and alias registry.
- `data/bible/<translation>/<book>.json` stores canonical records.
- `src/lib/bible-reference-core.mjs` parses references, normalizes records and resolves exact verses or contiguous ranges.
- Page-local inline payloads remain consumers and must not silently override a conflicting canonical record.

## Completeness

Every resolved record has one of two meanings:

- `full` — the complete text represented by the key;
- `excerpt` — a deliberately shortened quotation.

A range containing an ellipsis must be stored as an object with `completeness: "excerpt"` and a note explaining the omission. It must never be presented as the full range.

## Provenance boundary

`translation`, `source`, `sourceUrl` and `rights` are provenance fields. Missing provenance is reported explicitly. A catalogue label or an article-local statement is not promoted into a verified edition URL or rights conclusion.

## Strict validation

The blocking command is:

```bash
node scripts/bible-reference-contract.mjs --strict
```

It validates registry aliases, corpus keys, range completeness, central-versus-inline drift, translation drift and parser/resolver fixtures. The GitHub workflow always uses `--strict`, captures stderr in its artifact and verifies that validation is read-only.

## Trigger semantics

- Numbered Bible or academic notes preserve their visible number.
- Standalone unnumbered explanations use the dove marker.
- `.bref > .btip`, `.fn-marker > .tooltip` and `.gterm > .gtip` share positioning/accessibility infrastructure but retain independent data contracts.
