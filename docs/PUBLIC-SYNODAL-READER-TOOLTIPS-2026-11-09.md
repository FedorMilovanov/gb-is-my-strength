# Public-domain Synodal Scripture in reader tooltips — 2026-11-09

## Edition and rights boundary
Reader tooltips display the actual Biblical passage, without third-party redirect.
Previously held mixed Kassian/synodal editorial corpus remains separately blocked.
This change does not modify its publication rights or copy its verbatim held text.

Source: eBible.org RUSSYN, Russian Synodal Bible.
Edition and public-domain declaration: https://ebible.org/find/details.php?id=russyn
Original USFX archive: https://ebible.org/Scriptures/russyn_usfx.zip
Archive SHA-256: acd200046b4a4cb9bca8ca375544bc9d58ae10dc64f1862a2b7b73e225931a77
eBible edition date: 2022-11-25.
Reproducible generator: scripts/build-public-synodal-corpus.py
Generated approved source: data/bible/public-domain-russyn.json
Corpus: 66 canonical books, 31,169 verses.
Resolver: src/lib/public-synodal-reference.mjs

This is the eBible digital RUSSYN edition, not a photographic facsimile of 1876.
Translation and eBible provenance are displayed in the tooltip.

## Architecture
ScriptureDataProjection resolves references at static-build time and embeds only
the current route's needed passages and source labels. It does not ship the
whole corpus as a fetchable client payload or download text from third-party
services on hover. Existing article tooltip DOM owner remains authoritative.

Supported: verse, verse range, chapter, chapter range, cross-chapter range,
one-chapter epistles with chapter numbers conventionally omitted.
Invalid chapter/verse returns no fabricated Bible text.

## Index coverage
At this revision the occurrence index contains 1,368 unique references
and 3,474 article occurrences. The local public Synodal resolver covers
1,366 references and 3,472 occurrences.

Two false positives are not Bible passages: "Притчи 37–71" in the 1 Enoch
article is the Book of Parables section of 1 Enoch, not Proverbs, and "Мф 30"
in the Sermon on the Mount index is a count of verses, not Matthew 30.
Do not invent Bible verses to satisfy these false-positive tokens.

## Test gates
- node scripts/public-synodal-regression.mjs
- node scripts/scripture-tooltip-projection-browser-test.mjs (real local browser)
- node scripts/bible-reference-contract.mjs --strict (mixed held rights)
- source revision synchronizer and production-like build
