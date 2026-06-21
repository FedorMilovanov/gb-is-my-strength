# Gill quote density and voice audit — 2026-06-21

**Purpose:** verify the owner’s intuition that Gill may feel underquoted / undervoiced even where total article size is large.

---

## 1. Core finding

The Gill corpus is **not small by volume**, but it is indeed **thin in explicit quote architecture**.

That means the problem is not mainly:
- too few words,
- or missing large paragraphs,

but rather:
- too few deliberate “voice anchors”,
- too little direct Gill presence,
- too little memorable witness-language from admirers / memorialists / opponents.

---

## 2. Current quote-density snapshot

Measured inside the article bodies.

| Page | blockquotes | quote-box | pull-quote | fn-markers | gterm | figures |
|---|---:|---:|---:|---:|---:|---:|
| Gill I | 0 | 0 | 0 | 5 | 8 | 6 |
| Gill II | 0 | 0 | 0 | 1 | 1 | 3 |
| Gill III | 0 | 0 | 0 | 0 | 3 | 3 |
| Gill Context | 0 | 0 | 0 | 0 | 0 | 8 |
| Gill Spravochnik | 0 | 0 | 0 | 0 | 0 | 1 |

---

## 3. What this means page by page

## Gill I
- already has some source apparatus;
- still no true pull-quote / blockquote presence.

## Gill II
- startlingly low explicit quote density for a page about the scholar/theologian;
- only 1 `fn-marker` in current body snapshot.

## Gill III
- very large text mass, but zero explicit quote structures;
- feels more narrated *about* Gill than saturated *with* Gill or his reception.

## Gill Context
- the page most likely to benefit from inserted short witness lines and historically anchoring quotations;
- currently many figures, but no textual voice-points.

## Gill Spravochnik
- strong candidate for compact quotation enrichments;
- almost entirely skeletal in voice terms right now.

---

## 4. Practical implication

If the owner says:
> “Gill should feel denser, more atmospheric, more like we are with Gill”

— that instinct is justified.

Not because the corpus is small, but because:
- explicit quotations are underdeployed,
- source-derived lines are underexposed,
- and the rhetorical texture is flatter than the subject deserves.

---

## 5. Safe next move

Do **not** solve this during active refactor by randomly inserting quotes into live HTML.

Instead:
1. collect quotes in research dossiers;
2. map them to exact insertion points;
3. apply later in a controlled pass.

That is exactly why the new Gill quote-bank and insertion-map files exist.
