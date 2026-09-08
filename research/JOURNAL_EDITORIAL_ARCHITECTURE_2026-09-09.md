# Журналистский раздел — editorial architecture

**Status:** RESEARCH / NO_PUBLIC_ROUTE / PUBLICATION_HOLD  
**Date:** 2026-09-09  
**Lane:** `lane/journal-editorial-architecture-20260909`  
**Admission base:** `f472481a08f32b7f78df0c3f9934b169efc90645`  
**Owner:** journal editorial architecture only

## 1. Decision

Создать на `gospod-bog.ru` отдельную редакционную вертикаль `/journal/` для документальных расследований, проверенных новостей, explainers, primary-document analysis и многочастных dossiers.

`/articles/` остаётся evergreen-богословской библиотекой. Journalism не должен смешиваться с ней в одну хронологическую ленту и не должен создавать второй визуальный/JS framework.

Рекомендуемая public IA после отдельного production lane:

```text
/journal/
/journal/investigations/
/journal/news/
/journal/explainers/
/journal/dossiers/
/journal/documents/
/journal/methodology/
/journal/corrections/
```

Первый flagship dossier после explicit Research handoff:

```text
/journal/dossiers/g3/
```

## 2. Content types

- `INVESTIGATION` — long-form, claim-level evidence gate обязателен.
- `NEWS` — датированное verified событие; факт отделён от интерпретации.
- `EXPLAINER` — контекст, пригодный после новостного цикла.
- `DOSSIER` — hub одной темы: narrative, timeline, documents, data, corrections, unknowns.
- `DOCUMENT` — разбор одного primary object с явным `proves / does not prove`.

## 3. Reader-facing evidence contract

Каждый чувствительный материал должен различать:

1. **Что установлено** — только publication-authorized facts.
2. **Что подтверждено, но требует оговорки** — testimony/corroboration с ограничением.
3. **Где версии расходятся** — conflicting evidence.
4. **Что не подтверждено** — слухи/обвинения ниже threshold.
5. **Что опровергнуто имеющимися данными**.
6. **Документы и источники** — с типом provenance, а не голым списком URL.
7. **Исправления** — dated material corrections без silent rewrite.

Internal Research grades (`A1/A2/B1/C`, `VERIFIED_PRIMARY`, etc.) остаются source-of-truth, но reader UI получает человеческие labels.

## 4. Research → Product authority

`FedorMilovanov/Research` остаётся доказательным контуром. Product принимает только immutable editorial projection.

Минимальный handoff contract:

```text
researchRepo
researchEvidenceCommit
handoffPath
claimIds[]
sourceIds[]
excludedClaims[]
knownOpenQuestions[]
mediaDecisions[]
correctionBaseline
publicationDecision
```

Product запрещено:

- расширять prose за пределы pinned claim set;
- повышать `DISPUTED`, `INFERENCE`, `UNVERIFIED` или HOLD до факта;
- считать зеркала одного документа независимыми witnesses;
- превращать machine transcript в quote-safe source;
- публиковать private/research artifacts только потому, что они доступны в Research;
- использовать platform/storefront/search state как доказательство beneficial ownership;
- превращать allegation count в proven count.

Material Research change после публикации требует нового handoff snapshot и, если смысл reader claim изменился, dated correction/update.

## 5. G3 dossier — approved architecture, not yet public content

Предпочтительная модульная структура:

1. **История G3, 2011–2026** — conception → conference → institutional expansion → boundary conflicts → financial reversal → 2025 crisis → 2026 collapse/wind-down.
2. **Документы** — curated primary-source index.
3. **Финансы** — original charts из filings, без fraud rhetoric сверх evidence.
4. **Governance** — board/officer evolution с видимыми unknown periods.
5. **Josh Buice, 2025** — anonymous identities, confession, response, attempted reset.
6. **Tom Buck, 2026** — attribution/source-dependence отдельно от anonymous-distribution/process conduct.
7. **Завершение G3** — Network dissolution, conference cancellation/refunds, operational wind-down, corporate status, unresolved asset/successor aftermath.
8. **Что ещё не известно** — public projection material external-document holds.
9. **Исправления**.

Unresolved P0/P1 facts не мешают dossier существовать, если handoff их **исключает или явно маркирует как unknown**, а narrative не зависит от них как от доказанных фактов.

## 6. Corrections policy

Material correction fields:

```text
correctedAt
scope: headline | body | data | source | status
previousMeaning
newMeaning
reason
researchSnapshot
```

Правила:

- typo без semantic change может быть silent;
- factual/status reversal — только с correction note;
- нельзя silently delete verified counter-evidence;
- headline обязан быть исправлен, если прежний смысл перестал поддерживаться.

## 7. Metadata direction

Conceptual fields, exact implementation после route preflight:

```text
kind: investigation | news | explainer | document
publishedAt
updatedAt
editorialStatus: verified | developing | corrected
dossierId?
researchSnapshot
claimSet
sourceCount
primarySourceCount
mediaRightsState
corrections[]
```

Reader byline остаётся repository-canonical: `Автор-редактор: Фёдор Милованов`.

Structured data direction:

- `NewsArticle` только для настоящего news material;
- `Article` для investigations/explainers;
- canonical/OG/Twitter/BreadcrumbList;
- sitemap/RSS/search только для publication-authorized items;
- no public placeholder route ради roadmap.

## 8. Visual/editorial language

Характер: **theological journal + documentary newsroom**.

Использовать:

- native typography/tokens;
- restrained editorial grid;
- document cards;
- timelines;
- original charts/diagrams;
- evidence status chips;
- visible methodology/corrections.

Не использовать:

- tabloid red-alert aesthetics;
- police/crime styling для церковных конфликтов;
- giant scandal labels;
- decorative third-party screenshots вместо текстового/document-data presentation;
- новый global CSS/JS owner.

## 9. Current collision state — 2026-09-09

На admission base `f472481a…` прежний главный collision снят:

- Product PR #1851 (retained article capability/runtime) **merged**;
- Service Worker authority lane #1842 ранее **merged**;
- поэтому старая формулировка PR #1853, что #1851 остаётся live Draft owner, устарела.

Это **не** даёт автоматического права менять shared runtime: любой production `/journal/` lane обязан сделать свежий current-main overlap/preflight и владеть только явно заявленными route/components paths.

Этот architecture lane остаётся research-only и не меняет:

- `src/**`;
- shared reader/runtime;
- `SiteSectionsMenu`;
- sitemap/feed/search;
- Service Worker;
- public routes.

## 10. Production sequence

1. Получить publication-authorized immutable Research handoff для первого материала.
2. Re-fetch Product `main`, active PRs и route ownership.
3. Создать route-owned `/journal/` foundation lane.
4. Реализовать native landing + dossier shell без global discovery.
5. Прогнать exact-head build/static/route/visual/browser gates.
6. Добавить G3 только из pinned handoff.
7. После доказанного route отдельно добавить shared discovery (`SiteSectionsMenu`, sitemap/RSS/search) SYSTEM lane.

## Definition of readiness

Production может начаться, когда одновременно выполнено:

- route ownership свободен;
- native reader/mobile conventions определены;
- corrections schema определена;
- G3 имеет pinned publication-authorized handoff;
- public prose не зависит от excluded/unverified claims;
- каждый media item имеет item-level rights decision;
- нет placeholder publication.

## Recommendation

`/journal/` должен быть отдельной evidence-aware редакционной вертикалью внутри существующего сайта. G3 — подходящий первый documentary dossier, **но только через immutable Research handoff и publication-safe claim subset**, а не через перенос Research backlog или реакционных видео напрямую в Product.
