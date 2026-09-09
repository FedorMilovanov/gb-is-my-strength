# `/journal/` — native UI and evidence presentation contract

**Status:** RESEARCH / NO_PUBLIC_ROUTE / PUBLICATION_HOLD  
**Date:** 2026-09-09  
**Parent:** `research/JOURNAL_EDITORIAL_ARCHITECTURE_2026-09-09.md`  
**Scope:** UI/ownership/evidence contract only; no `src/**` mutation in this lane.

## 1. Native-first rule

Journalism must look and behave like a documentary/editorial mode of `gospod-bog.ru`, not a second site.

Reuse current native primitives where ownership permits:

- `ReaderRail.astro` — desktop reader TOC/progress/share/print/settings semantics;
- `MobileChromePage.astro` — landing/page mobile Back/Home/search semantics;
- `MobileChromeShell.astro` — structural mobile shell;
- `ReaderSettings.astro` — reading preferences;
- `StandaloneArticleFooter.astro` — close/footer conventions;
- `SiteSectionsMenu.astro` — only later shared discovery SYSTEM lane.

Product PR #1851 is now merged; the old collision statement that it remains an open Draft is obsolete. Shared surfaces nevertheless require fresh ownership checks before production mutation.

## 2. Surface model

### `/journal/` landing

Page/series shell, not article reader.

- editorial lead;
- latest verified updates;
- investigations;
- dossiers;
- documents;
- explainers/context;
- methodology/trust;
- corrections.

Mobile uses existing page chrome semantics. No fake reading progress or article-only actions on landing.

### Investigation / explainer / document

Single-reader model:

- ReaderRail semantics on desktop;
- existing article/mobile reader conventions;
- article TOC is the internal navigation spine;
- native share and print/PDF actions.

### Dossier landing

Series/document hub distinct from a normal article:

- dossier navigation;
- primary investigation;
- timeline;
- document index;
- data modules;
- related updates;
- corrections;
- `what remains unknown`.

Dossier nav moves **between modules**; ReaderRail TOC moves **inside one document**. They must not compete.

## 3. Route-local conceptual components

Names remain conceptual until production preflight.

### `JournalShell`

Route-local wrapper consuming existing tokens/layout conventions. Never a new global theme.

### `JournalDossierNav`

Example:

```text
Обзор · Хронология · Документы · Финансы · Управление · Люди · Исправления
```

### `JournalEvidenceStrip`

Human-readable summary under header:

```text
Тип: Расследование
Статус: Проверено / Развивается / Исправлено
Опубликовано: …
Обновлено: …
Первичные документы: N
Независимые подтверждения: N
Открытые ключевые вопросы: N
Research snapshot: short immutable ref
```

Do not expose unexplained internal evidence grades.

### `JournalSourceBadge`

Reader labels mapped from pinned Research provenance:

- `Первичный документ`
- `Официальное заявление`
- `Заявление участника`
- `Независимое подтверждение`
- `Архивный источник`
- `Спорное / требует подтверждения`

UI label may never upgrade underlying Research state.

### `JournalClaimMatrix`

For disputed material, prefer row-level states over rhetorical compression:

- `Установлено`
- `Подтверждено`
- `Частично подтверждено`
- `Версии расходятся`
- `Не подтверждено`
- `Опровергнуто имеющимися данными`

Every rendered row must map to a pinned Research claim ID or explicit editorial derived statement whose components are all in the handoff.

### `JournalDocumentCard`

Required fields:

- title;
- issuer/creator;
- event/document date;
- archive/acquisition date when different;
- what it proves;
- what it does not prove;
- publication/rights state.

Authenticity of a document never means every allegation inside it is established.

### `JournalTimeline`

Must distinguish:

- event date;
- publication date;
- filing date;
- archive/capture date;
- correction date.

### `JournalCorrectionLog`

Visible material correction history driven by data, not prose-only `updatedAt`.

## 4. G3-specific evidence UX

### Never show allegation count as verdict

For the Tom Buck controversy, Product must never render `45 proven cases` or equivalent from an accusation-object count.

Allowed conceptual pipeline:

```text
17 sermons alleged
→ independent item audit
→ original-media gate
→ source-edition gate
→ attribution-context gate
→ final item assessment
```

If Research handoff excludes all machine-only item verdicts, Product shows no numerical plagiarism-verdict counter.

### Keep two Buck tracks separate

1. source-dependence / insufficient-attribution evidence;
2. anonymous dossier distribution / PMBC-G3 process conduct.

Misconduct or overreach in one track does not erase evidence in the other.

### Source lineage where material

If Research establishes that a supposed source-specific phrase is older/common, Product may show:

```text
Заявленный источник обвинения: X
Более ранняя/общая линия: Y
Что это меняет: source specificity reduced; proximate dependence not automatically excluded
```

No plagiarism/legal verdict from lineage alone.

## 5. G3 dossier UI modules

Recommended graph:

- `01 История G3, 2011–2026`
- `02 Документы`
- `03 Финансы`
- `04 Governance`
- `05 Josh Buice, 2025`
- `06 Tom Buck, 2026`
- `07 Завершение G3`
- `08 Что ещё не известно`
- `09 Исправления`

### Finance

Use original charts from filing data. Every chart must expose units/year/source note. No crime/fraud visual metaphors.

### Governance

Unknown board periods remain visibly unknown. Do not interpolate a continuous roster through archive gaps.

### Wind-down

Render separate states for:

- Church Network dissolution;
- National Conference cancellation/refunds;
- operational conclusion;
- Georgia corporate status;
- G3+/Press/successor/rights aftermath.

Do not collapse those into a single `G3 dissolved` badge.

## 6. Visual system

Preferred identity: **theological journal + documentary newsroom**.

Use:

- serif-led native headlines;
- restrained paper/document surfaces;
- fine rules and date metadata;
- route-local evidence chips;
- original charts;
- timelines;
- source/document cards;
- documentary imagery only when rights-cleared.

Avoid:

- tabloid alerts;
- police/crime aesthetics;
- sensational scandal typography;
- third-party screenshots as decoration;
- a new global CSS/JS runtime.

## 7. Mobile contract

Do not invent a journal-specific mobile navigation system.

Landing:

- Back;
- Home;
- existing global search;
- no article-only reader controls.

Long-form:

- preserve native reader mobile conventions;
- dossier nav must remain secondary to article reading navigation;
- evidence/correction modules must remain usable without horizontal overflow.

## 8. Corrections as first-class data

Minimum structure:

```text
correctedAt
scope
previousMeaning
newMeaning
reason
researchSnapshot
```

Correction must be renderable:

1. on the article;
2. on dossier correction history;
3. later on `/journal/corrections/` if that index is implemented.

A status downgrade from `verified` to `disputed` is a material correction, not an invisible metadata update.

## 9. Immutable handoff UI gate

Before any G3 page renders public allegations or sensitive conclusions, Product must have:

```text
researchEvidenceCommit
handoffPath
claimIds[]
sourceIds[]
excludedClaims[]
knownOpenQuestions[]
mediaDecisions[]
publicationDecision
```

Runtime/content generation must fail closed if required handoff fields are absent or if public content references an excluded claim.

Recommended implementation direction: store a route-local immutable handoff snapshot or generated editorial manifest in Product and validate it in CI against the authored dossier data. Do not make the public route perform live GitHub/Research network requests.

## 10. Current collision state — 2026-09-09

- PR #1851 — **merged**; no longer a live shared-runtime collision.
- PR #1842 — **merged**; Service Worker root authority no longer blocks planning.
- Old PR #1853 is stale relative to current main and is superseded by this refreshed architecture lane.

Safe production sequence:

1. merge current research-only architecture after exact-head checks;
2. wait for/pin publication-authorized G3 Research handoff;
3. fresh current-main collision audit;
4. create route-owned `/journal/` foundation PR;
5. prove route/build/browser state before shared discovery;
6. add `SiteSectionsMenu` / sitemap / RSS / search in a separate SYSTEM lane only after route stability.

## 11. Definition of UI readiness

Ready for production implementation only when:

- no active owner conflicts on target route/components;
- native search/mobile/reader conventions are reused;
- corrections data model exists before first publication;
- G3 handoff is pinned and publication-authorized for a bounded claim subset;
- excluded/unverified claims cannot leak into public prose;
- every media item has an explicit rights state;
- no placeholder allegation or draft content is publicly reachable.

## Recommendation

Build `/journal/` as a native evidence-aware editorial mode. Its distinctive value should come from transparent claim state, document lineage, corrections and careful unknowns—not from another framework or sensational presentation.
