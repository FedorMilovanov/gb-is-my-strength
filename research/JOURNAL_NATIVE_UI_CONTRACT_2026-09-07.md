# `/journal/` — native UI and evidence presentation contract

**Status:** RESEARCH / NO_PUBLIC_ROUTE / PUBLICATION_HOLD  
**Date:** 2026-09-07  
**Parent:** `research/JOURNAL_EDITORIAL_ARCHITECTURE_2026-09-07.md`  
**Scope:** design/ownership contract only; no `src/**` mutation in this lane.

> This addendum supersedes the parent spec's older collision-note snapshot where state has changed. As of this pass, Product PR #1842 (Service Worker root-generation authority) is merged; Product PR #1851 remains the live Draft SYSTEM owner for retained article capability/runtime.

## 1. Principle: newsroom UX must be native to `gospod-bog.ru`

Do not create a second mini-site, framework, mobile shell or global interaction layer for journalism.

The Product repository already has reader primitives mature enough to serve the journal:

- `ReaderRail.astro` — article TOC, progress line, site menu, reader settings trigger, share and print/PDF actions;
- `MobileChromePage.astro` — lightweight mobile landing chrome for page/series surfaces with Back, Home and the site's existing search;
- `MobileChromeShell.astro` — slot-based shared mobile structure and safe-area/runtime data contract;
- `ReaderSettings.astro` — established reading preferences;
- `StandaloneArticleFooter.astro` — existing article close/footer conventions;
- `SiteSectionsMenu.astro` — eventual global discovery owner, but only in the final shared SYSTEM lane.

The journal should therefore feel like a more documentary/editorial mode of the same site, not a visually unrelated newspaper template.

## 2. Surface model

### `/journal/` landing

Use a **page/series-style shell**, not a full article reader:

- desktop: editorial grid within the site's existing shell;
- mobile: `MobileChromePage` semantics — Back, Home, global site search;
- no fake reader progress, TTS or article-only actions on the landing.

Recommended sections:

1. lead investigation;
2. latest verified updates;
3. investigations;
4. dossiers;
5. documents;
6. explainers/context;
7. methodology/trust panel;
8. corrections.

### Investigation / explainer / document article

Use the **single-reader model**:

- `ReaderRail` semantics on desktop;
- existing reader mobile chrome/profile once the current article-capability SYSTEM owner is stable;
- article TOC remains the navigational spine;
- share and print/PDF remain site-native actions.

### Dossier landing

A dossier is neither a normal article nor a generic category listing. It is a **series/document hub**:

- timeline;
- main long-form investigation;
- related news/updates;
- document index;
- people/organization map where justified;
- data graphics;
- corrections;
- `what remains unknown` ledger.

The G3 dossier is the first proposed reference implementation after Research handoff.

## 3. Route-local conceptual components

Names are conceptual until the production lane performs a current-main preflight. They must not become shared runtime owners merely because this research file names them.

### `JournalShell`

Route-local visual wrapper for journal surfaces. It should consume existing site tokens and layout conventions, not create a second global theme.

### `JournalDossierNav`

Navigation between dossier modules, for example:

```text
Обзор · Хронология · Документы · Финансы · Управление · Люди · Исправления
```

On long-form G3 content, this is **not** a replacement for the article TOC. Dossier navigation moves between documents/modules; ReaderRail TOC moves inside one document.

### `JournalEvidenceStrip`

Small visible summary under the article header, designed for humans rather than internal Research grades.

Possible fields:

```text
Тип: Расследование
Статус: Проверено / Развивается / Исправлено
Опубликовано: ...
Обновлено: ...
Первичные документы: N
Независимые подтверждения: N
Открытые ключевые вопросы: N
Research snapshot: short immutable reference
```

Do not expose `A1/A2/B1/C` as unexplained reader jargon.

### `JournalSourceBadge`

Human labels mapped from the Research provenance graph:

- `Первичный документ`
- `Официальное заявление`
- `Заявление участника`
- `Независимое подтверждение`
- `Исторический/архивный источник`
- `Спорное / требует подтверждения`

The UI label never upgrades the underlying Research state.

### `JournalClaimMatrix`

For highly disputed investigations, show claims as rows rather than compressing them into rhetorical prose.

Suggested reader states:

- `Установлено`
- `Подтверждено несколькими источниками`
- `Частично подтверждено`
- `Версии расходятся`
- `Не подтверждено`
- `Опровергнуто имеющимися данными`

The Research ledger remains canonical. The Product matrix is a projection of a pinned claim set.

### `JournalDocumentCard`

For filings, statements, letters, screenshots and archive captures:

- document title;
- issuer/creator;
- document/event date;
- acquisition/archive date when different;
- what the object proves;
- what it does **not** prove;
- publication/rights state.

This is important because a document can be authentic while allegations inside it remain unverified.

### `JournalTimeline`

A chronological evidence view that distinguishes:

- event date;
- publication date;
- filing date;
- archive/capture date;
- correction date.

Do not flatten these into one date.

### `JournalCorrectionLog`

Visible correction history for material changes:

```text
2026-09-07 — дата обновления G3+ понижена из «4 сентября» в «спорно»:
разные Google surfaces показывают Jul 23 и Sep 4 для одного package.
```

The correction log is a trust feature, not an embarrassment to hide.

## 4. Reader-facing evidence philosophy

### Never show allegation count as verdict

The G3/Tom Buck dossier demonstrates why.

The accusation object covers **17 sermons** and is reported elsewhere as containing roughly 45 parallels/allegations. Product must never convert that to `45 proven plagiarism cases`.

The correct presentation model is:

```text
17 sermons examined by accusers
→ item-level independent audit
→ source-specificity check
→ original-audio gate
→ source-edition gate
→ attribution-context gate
→ only then final item assessment
```

If only some items are independently closed, say exactly that.

### Show source lineage where it changes meaning

Examples from the active G3 Research:

- a phrase may be strongly Hughes/Jackman/Ryken-linked;
- an apparently similar historical anecdote may predate the cited commentary by decades;
- a statistic may be a widely repeated exegetical datum rather than a commentator's unique insight;
- a source commentary itself may be quoting Howard Vos or another earlier source.

Therefore a useful reader module may state:

```text
Заявлено источником обвинения: Hughes
Установленная более ранняя линия: older/common source
Что это меняет: снижает литературную специфичность, но не обязательно исключает proximate dependence
```

This is much more informative than a red/green plagiarism counter.

## 5. G3 dossier reader architecture

Recommended module graph:

### `01 — История G3, 2011–2026`

Primary narrative: conception → church conference → national scale → institutional ecosystem → coalition boundaries → financial reversal → 2025 crisis → 2026 collapse/wind-down.

### `02 — Документы`

Curated primary-source/document index with claim-safe annotations.

### `03 — Финансы`

Original charts for:

- revenue;
- total expenses;
- surplus/deficit;
- net assets;
- program/admin/fundraising split where raw filing supports it.

No visual implying embezzlement unless evidence ever crosses that threshold.

### `04 — Governance`

Board/officer evolution and PMBC/G3 role overlap, with unknown periods visibly marked rather than interpolated.

### `05 — Josh Buice, 2025`

Anonymous identities, target mapping, confession/resignation, official response, institutional reset.

### `06 — Tom Buck, 2026`

Two explicitly separated tracks:

1. sermon attribution/source-dependence evidence;
2. anonymous dossier distribution / PMBC-G3 process conduct.

Neither track is allowed to erase the other.

### `07 — Завершение G3`

Separate:

- Church Network dissolution;
- conference cancellation/refunds;
- operational wind-down;
- legal corporate dissolution status;
- G3+/Press/rights/assets aftermath.

### `08 — Что ещё не известно`

Public-facing projection of material P0/P1 holds. This prevents an article from sounding more certain than the evidence graph.

### `09 — Исправления`

Substantive correction history.

## 6. Visual system

Preferred visual identity:

**theological journal + documentary newsroom**.

Use:

- generous serif-led headlines consistent with existing reader typography;
- restrained document-paper surfaces;
- fine rules, dates and metadata rather than sensational alert chrome;
- route-local evidence status chips;
- original charts/diagrams;
- small documentary thumbnails only when rights-cleared;
- timelines and source cards as primary visual devices.

Avoid:

- breaking-news red everywhere;
- police/crime aesthetics for ecclesial disputes;
- giant scandal labels;
- decorative screenshots where an original chart or textual document card communicates the evidence better.

## 7. Mobile contract

Do not invent a second mobile navigation system.

`MobileChromePage` already establishes that landing surfaces should get:

- Back;
- Home;
- existing global search;
- no false reader features.

`MobileChromeShell` is intentionally only a structural slot owner and does not know about domain-specific reader engines. Journalism should preserve this separation.

Production implementation should therefore add only journal-specific content/actions that are genuinely needed, and only in the owner lane authorized after #1851 stabilizes.

## 8. Corrections as first-class data

A substantive correction must be renderable on:

1. the article itself;
2. dossier correction history;
3. optional `/journal/corrections/` index later.

Minimum correction fields:

```text
correctedAt
scope: headline | body | data | source | status
previousMeaning
newMeaning
reason
researchSnapshot
```

Do not store only prose `updatedAt`; otherwise readers cannot distinguish a typo cleanup from a material evidence reversal.

## 9. Research handoff contract

Before Product receives a G3 module, Research should provide an immutable handoff record containing at least:

```text
researchRepo
researchCommit
claimIds[]
sourceIds[]
excludedClaims[]
knownOpenQuestions[]
mediaItems[]
correctionBaseline
publicationDecision
```

The Product text must never silently expand beyond this claim set.

If Research later changes a material claim, Product receives a new handoff snapshot and either:

- no public change is required; or
- a dated correction/update is issued.

## 10. Current Product collision state

As of this research pass:

- **PR #1842 — merged.** Service Worker authority is no longer a live collision for journal planning.
- **PR #1851 — open Draft / live SYSTEM owner.** It owns retained article capabilities/runtime and remains the principal reason not to mutate shared reader/runtime surfaces from the journal lane.
- research/content PRs may coexist if path-disjoint but must be rechecked before any production route work.

Therefore the safe production sequence remains:

1. keep this PR research-only;
2. allow #1851 to stabilize/merge or otherwise relinquish shared ownership;
3. take a fresh `main` preflight;
4. create a route-owned `/journal/` foundation lane;
5. prove route locally before adding global menu/RSS/search discovery;
6. publish G3 only from an explicit Research handoff.

## 11. Definition of UI readiness

The journal foundation is ready to enter a Product lane only when:

- current `main` is re-fetched;
- no active PR owns the same route/components/runtime;
- the route uses native search/mobile/reader conventions;
- journalism-specific components remain route-local unless promoted by explicit shared ownership;
- no placeholder allegation or draft evidence is exposed publicly;
- corrections schema is defined before the first live investigation;
- G3 has a pinned publication-authorized Research snapshot;
- every public image has an item-level rights decision.

## Recommendation

Build `/journal/` as a **native evidence-aware editorial mode of the existing site**, not as a separate news theme. The distinctive value should come from documentary structure, corrections and transparent source lineage—not from adding another JavaScript/CSS system or sensational visual language.