# 147. Baptist book media container recovery status

**Дата:** 2026-09-11  
**Статус:** `CATALOG SHORTLIST STRONG / SOURCE CONTAINERS UNAVAILABLE / PRODUCTION BYTES HOLD`  
**Scope:** historical photos and facsimiles for the expanded Baptist book; no public media promotion.

## 1. What is already strong

The connected MASTER spreadsheet `05 Photos Captions` contains a large curated historical-photo corpus with many rows already marked `Article ready=YES`.

Spot-checks during the 2026-09-11 audit found, at minimum:

- Kargel: 24 `YES` rows;
- Mazaev: dozens of `YES` rows;
- Prokhanov: dozens of `YES` rows;
- Fetler / House of Gospel corridor: dozens of `YES` rows;
- VSEHIB/1944 corridor: all eight directly matched candidates were `YES`.

Therefore the current visual blocker is **not** “no candidate images exist”.

## 2. Current blocker

The rows point to historical `Source HTML` archive/export containers. The six high-reuse Drive container IDs checked during this audit are currently unavailable to the connected Drive context:

- `1u8EPC-rMw4l09IWBRYYWaKV_waPBCS5T`
- `1U19ODNBaa6vpjvNllXVqlCC87ydDoBdQ`
- `1ydUg-qbujF32fYBVk2CkyQ2t8qq-2S_q`
- `10fn4zQI-kuC5jgUBy0ZIYpcJXZwSS4kd`
- `1lq6PUIzUy7OPSYovtkusAmz1tmDTwX-Z`
- `1FaDoCLb9eoTQ59lPih8qfwZYfIVhl4EE`

All six returned `404 File not found` on direct metadata/fetch attempts in the current connected account context.

Searches for newer generic replacements such as `messages.html`, `ChatExport`, `Telegram export`, `Telegram`, `photos`, and Baptist photo-archive variants did not reveal a replacement container.

Exact photo basenames sampled from MASTER also did not resolve as separately indexed Drive files.

## 3. Consequence

`Article ready=YES` in MASTER must be interpreted as **editorial shortlist readiness**, not as current production-byte readiness.

Before any historical photo can be promoted into Product, the normal governed chain still applies:

`identity -> provenance -> rights -> accessible binary -> SHA-256 -> optimized derivative -> caption/alt -> route placement`.

A MASTER row alone does not close:

- current binary access;
- rights/license;
- exact file identity;
- local SHA;
- production derivative;
- route-level visual QA.

## 4. Recovery strategy

Do **not** restart the historical-photo search from zero.

Preferred recovery order:

1. restore/re-share the six archive/export containers above in the current Drive owner context;
2. if the original containers are lost, re-export the corresponding source archive preserving original filenames and message/album IDs;
3. reconcile restored bytes against existing MASTER `Photo basename / Album ID / Message ID / Source HTML`;
4. calculate SHA-256 before any image optimization;
5. only then promote selected images into a bounded chapter media lane.

This turns recovery into a container-level task rather than hundreds of independent image searches.

## 5. Periodicals are a separate media lane

The photo sheet is not a substitute for document/periodical ingestion.

Observed 2026-09-11:

- `Братский Вестник` №2/1945 has an older canonical receipt in the periodicals authority;
- №1/1945 remains an exact-byte acquisition gap in Product, although a Russian Baptist Union public catalog/search route exposes a 44-page PDF lead;
- current connected Drive search does not surface exact copies of the sampled №2/1945 filename or Bulletin №44/1977;
- direct photo-sheet search does not cover `Вестник истины` / SRU bulletin corpus adequately.

Therefore late-Soviet publication visuals require a **periodicals/document ingestion** lane, not reuse of photo-catalog status.

## 6. Current Product visual truth

The public nine-article Baptist series is textually mature, but the historical visual layer is not Golden:

- eight of nine public article bodies currently rely on decorative cover artwork rather than embedded historical evidence images;
- `Советская ночь` is the known exception with an embedded, provenance-controlled historical facsimile;
- the canonical media ledger currently has only one row at `PUBLISHED / VERIFIED`.

## 7. Definition of Done for media recovery

- [ ] source containers are accessible again or replacement archive exports are registered;
- [ ] exact candidate bytes mapped back to MASTER rows;
- [ ] identity/provenance/rights classified;
- [ ] SHA-256 recorded;
- [ ] production derivatives generated from verified originals;
- [ ] chapter-specific visual dossiers select evidence-bearing placements;
- [ ] browser/mobile/print visual QA passes;
- [ ] media ledger promoted from candidate to `PUBLISHED / VERIFIED`.

Until then:

`VISUAL CANDIDATE CORPUS = STRONG; PRODUCTION HISTORICAL MEDIA = HOLD`.
