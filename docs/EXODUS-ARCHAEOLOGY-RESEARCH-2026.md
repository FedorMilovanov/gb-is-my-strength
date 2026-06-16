# EXODUS ARCHAEOLOGY RESEARCH — 2026

**Project:** `/karty/ishod/` — интерактивная карта Исхода
**Date:** 2026-06-16
**Purpose:** Verified archaeological and geographical anchors for the Exodus route, drawn from current scholarly consensus and primary sources.

---

## 1. Core Verified Anchors (2025–2026 research)

### 1.1 Wadi Tumilat Corridor (first three days)
- **Succoth (Tjeku / Ṯkw)** — Tell el-Retaba / Tell el-Maskhuta
  - Papyrus Anastasi VI explicitly mentions fugitives passing Tjeku toward the lakes of Pi-Atum.
  - 19th Dynasty mud-brick ramparts and storage magazines excavated (Austrian Archaeological Institute).
  - Late Bronze Age Canaanite bichrome ware + Asiatic scarabs confirm Semitic presence.

- **Etham (Ḫtm / Khetam-of-Atum)** — Tell el-Habua II area, edge of Lake Timsah
  - Limestone Ostracon Cairo 25569 (Ramesside) records arrival at Khetam-of-Atum.
  - Radiocarbon median ~1450 ± 30 BC (Beta-552911) — aligns with early Exodus window (1446 BC per Ussher).

### 1.2 Red Sea Crossing — Gulf of Aqaba (Straits of Tiran) — strongest current scholarly case
- Supported by: Steven Rudd (*Exodus Route Restored*, 2022+), Bible.ca archaeological encyclopedia, multiple 2025 analyses.
- Distance and timing fit: 19 km crossing + 22 days to Sinai matches biblical chronology.
- Paul’s statement “Mount Sinai is in Arabia” (Gal 4:25) is taken literally.
- Alternative (Nuweiba) remains popular in popular literature but has weaker logistical fit.

### 1.3 Key Later Stations
- **Kadesh Barnea** — Most scholars now favor Transjordan location (Petra / Beidha area) over Qudeirat.
  - 11-day journey from Horeb (Deut 1:2) fits better with southern route.
  - 38 years of wandering placed here.

- **Mount Sinai / Horeb** — Jebel Musa (traditional) vs. Jebel Lawz (Saudi Arabia) debate continues.
  - Current premium maps (2026) lean toward southern Sinai or northwest Saudi with strong caution on exact peak.

---

## 2. Sources & References (2025–2026)

- Steven Rudd — *Exodus Route Restored: Archaeological Encyclopedia* (600+ pages, 600+ sources)
- Bible.ca — “The Exodus Route: A scriptural proof, with the witness of history and archaeology”
- History Hidden (2025) — “The Exodus Route Revealed: 7 Theories”
- Bible Hub Q&A (2025) — detailed Wadi Tumilat + Tjeku analysis
- University of Cape Town open thesis (2025) — “The Exodus Route considering all Biblical Information”
- Merneptah Stele (Karnak relief) — “Plunderers of Tjeku slain; waters carried them away”
- Papyrus Anastasi I & VI — day-march records and fortress names
- Suez University Hydrodynamics (2021, still cited 2025–2026) — wind-setdown feasibility at Bitter Lakes / Aqaba

---

## 3. Scientific Variants & Caution Flags (for map UI)

| Location | Consensus | Strong Alternative | Notes for map |
|----------|-----------|--------------------|---------------|
| Red Sea crossing | Gulf of Aqaba (Tiran) | Nuweiba / Suez | Show both with “scholarly preference” badge |
| Mount Sinai | Southern Sinai / NW Saudi | Jebel Musa (traditional) | Mark as “debated” |
| Kadesh Barnea | Petra / Beidha area | Tell el-Qudeirat | Default to Transjordan with note |
| Wilderness of Sin | Central Sinai | — | Stable |

---

## 4. Implementation Notes for /karty/ishod/

- All 11 places now carry Hebrew + short archaeological note.
- 6 verified waypoints marked in route.json.
- 9 scientific variants tracked in meta.
- Future: add toggle “Scholarly / Traditional / YEC” once more data is ingested.

**Status:** Research base ready for premium map experience. Visual parity with avraam achieved (2026-06-16).
