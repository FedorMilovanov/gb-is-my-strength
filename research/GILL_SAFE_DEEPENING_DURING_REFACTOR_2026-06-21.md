# Gill safe deepening during active refactor — 2026-06-21

**Question:** should Gill be expanded right now, while another agent is already touching refactor/migration paths?  
**Answer:** **yes, but not by directly inflating live HTML right now**.

---

## 1. Short answer

The safest route is:

1. **do not bulk-edit live Gill HTML while refactor is moving**;
2. **collect all new Gill material in standalone MD research dossiers**;
3. prepare:
   - quote bank,
   - source ledger,
   - section-by-section insertion map,
   - context-expansion notes,
   - “atmosphere” quote placements;
4. after the refactor stabilizes, apply the material surgically.

This gives the project the best of both worlds:
- no collision with the refactor agent,
- no risk of dirty merge conflicts in large article files,
- but the intellectual expansion work does **not** stop.

---

## 2. Why this is the right strategy

## 2.1 Current risk profile

Gill pages are not actually tiny, but they are:
- long,
- structurally dense,
- tied to current shadow/refactor logic,
- and likely to become merge-conflict magnets if two agents touch them at once.

If we start aggressively editing:
- `articles/dzhon-gill-chast-1-chelovek/index.html`
- `articles/dzhon-gill-chast-2-uchenyi/index.html`
- `articles/dzhon-gill-chast-3-nasledie/index.html`
- `articles/dzhon-gill-istoricheskiy-kontekst/index.html`
- `articles/dzhon-gill-spravochnik/index.html`

while another agent is refactoring architecture, we increase the chance of:
- bad rebases,
- dropped edits,
- accidental content regressions,
- noisy diffs that are hard to audit.

## 2.2 What is safe to do now

These are low-risk and high-value *right now*:
- build research dossiers,
- collect exact Gill quotes,
- map where quotes belong,
- deepen historical context in MD,
- prepare section-expansion tasks,
- identify underweight H2 blocks.

This work is independent from production rendering and can later be merged into articles cleanly.

---

## 3. Recommended working model

## Stage A — now, during refactor

Create / extend research-only assets:
- `research/GILL_CONTENT_INTEGRITY_AUDIT_2026-06-21.md`
- `research/GILL_SECTION_DEPTH_AND_EXPANSION_CANDIDATES_2026-06-21.md`
- new quote bank(s)
- new context dossiers
- new insertion maps

### Allowed now
- pure research `.md`
- quote ledgers
- source ledgers
- structure maps
- candidate copy blocks

### Avoid now
- bulk edits to the live HTML pages
- large tone rewrites of Part I–III
- moving sections around in long production files

## Stage B — after refactor stabilizes

Then do article-facing work in carefully scoped passes:
1. `istoricheskiy-kontekst`
2. `spravochnik`
3. selective strengthening of Part II and Part III
4. only then ornamental/atmospheric redistribution of quotes in Part I–III

---

## 4. What Gill most needs now

Not blind volume inflation.

It needs:
1. **better quote distribution**;
2. **denser context in the historical-context page**;
3. **a stronger research-console in the spravochnik**;
4. **more atmosphere of “Gill himself speaking” throughout the corpus**;
5. **better section balance**, especially where one H2 is carrying too much and another too little.

---

## 5. Priority order for later article edits

### First after refactor
1. `dzhon-gill-istoricheskiy-kontekst`
   - safest and most obviously under-expanded;
   - several H2 blocks are note-sized rather than essay-sized.

2. `dzhon-gill-spravochnik`
   - should become a stronger reference hub;
   - can absorb more quotations, bibliographic pathways, influence map and controversy map.

### Second wave
3. `dzhon-gill-chast-2-uchenyi`
   - especially the “богословские труды” side, which is overshadowed by polemics.

4. `dzhon-gill-chast-3-nasledie`
   - only selective enrichment; it is already large.

### Lower urgency
5. `dzhon-gill-chast-1-chelovek`
   - already substantial; strengthen only if quote/atmosphere layer still feels thin.

---

## 6. Practical implementation rule

For now, every new Gill discovery should be stored in one of three forms:

### A. Quote bank
A short exact or near-exact reusable quotation with:
- source,
- why it matters,
- where it should go.

### B. Context block
A compact historical explanation prepared as a future insert.

### C. Insertion target
A concrete note like:
- “Part II / section X / after paragraph Y”
- “Context page / H2 II needs 250–400 extra words on …”
- “Spravochnik / influence map section should gain quote from …”

This keeps the expansion pipeline clean.

---

## 7. Final recommendation

> During active refactor, Gill should be deepened primarily through MD research infrastructure, not through immediate large edits of production HTML. This is the lowest-risk and highest-yield strategy. It preserves velocity in research while avoiding content/refactor collisions.
