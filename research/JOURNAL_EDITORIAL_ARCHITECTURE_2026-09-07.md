# Журналистский раздел — editorial architecture

**Status:** RESEARCH / NO_PUBLIC_ROUTE / PUBLICATION_HOLD  
**Date:** 2026-09-07  
**Owner:** Фёдор Милованов  
**Lane:** `lane/journal-editorial-architecture-20260907`  
**Mode:** LANE  
**Base / rollback SHA:** `f0527243bd032fe9eee889e05b9a62bea3fdd7c3`

## 1. Purpose

Создать на `gospod-bog.ru` самостоятельную редакционно-журналистскую вертикаль для документальных расследований, проверенных новостей, объясняющих материалов, досье и публикаций по современным церковным/богословским событиям.

Это **не замена** `/articles/`. Существующий каталог статей остаётся evergreen-богословским корпусом. Новый раздел отделяет time-sensitive journalism от обычных статей и сохраняет для расследований более строгий evidence/corrections contract.

## 2. Recommended public information architecture

Предпочтительный root route после отдельного production lane:

```text
/journal/                         — редакционная главная
/journal/investigations/          — глубокие документальные расследования
/journal/news/                    — короткие верифицированные новости/обновления
/journal/explainers/              — контекст и объясняющие материалы
/journal/dossiers/                — тематические досье/серии
/journal/methodology/             — методология, источники, corrections policy
```

Рабочее читательское название: **«Журнал»** или **«Редакция»**. Внутренний SEO/title layer может уточнять: «Документы, расследования и церковные новости».

Почему `/journal/`, а не `/news/`:

- корпус будет содержать не только новости, но и многочастные расследования;
- исторические/документальные досье не устаревают через сутки;
- один раздел может объединить breaking update, explainer, dossier и long-form;
- `/articles/` не превращается в смешанную хронологическую ленту.

## 3. Editorial content types

### `INVESTIGATION`

Большое документальное расследование. Требует claim-level evidence ledger в Research и publication gate перед выпуском.

### `NEWS`

Короткая датированная новость. Только проверенное событие; отделять `что произошло` от интерпретации. Указывать время последнего обновления.

### `EXPLAINER`

Ответ на вопрос `что это значит / как дошло до этого`. Может быть связан с новостью, но должен сохранять пригодность после новостного цикла.

### `DOSSIER`

Landing по одной теме: хронология, связанные публикации, документы, ключевые лица/организации, графики, corrections.

### `DOCUMENT`

Редакторский разбор одного первичного документа: filing, заявление, письмо, протокол, архивный объект. Сам документ не объявляется доказательством всех утверждений внутри него.

## 4. Reader-facing evidence contract

Для расследований и спорных материалов обязательны видимые блоки:

### Что установлено

Только факты, прошедшие публикационный threshold.

### Что остаётся спорным

Конфликтующие свидетельства, неполные первичные документы, вопросы причинности/мотива.

### Что не подтверждено

Распространённые слухи и обвинения, для которых нет достаточного evidence.

### Документы и источники

Не просто список URL. Для ключевых claims читатель должен понимать тип источника: официальный документ, заявление участника, независимая журналистика, discovery-only material.

### Обновления и исправления

Каждый time-sensitive материал получает:

- `Опубликовано`;
- `Обновлено`;
- changelog существенных исправлений;
- прозрачное исправление фактической ошибки без silent rewrite.

## 5. Evidence boundary: Research → Product

`FedorMilovanov/Research` остаётся доказательным контуром.

Публичный `gb-is-my-strength` получает только editorial projection, которая:

1. строится от canonical claims/source ledgers;
2. не повышает `HOLD`, `INFERENCE`, `DISPUTED` или discovery lead до факта;
3. сохраняет точные даты и роли;
4. различает testimony, institutional statement, independent corroboration и government/legal record;
5. не превращает YouTube/reaction video в evidence authority;
6. не публикует private-study artifacts только потому, что они лежат в Research;
7. проходит item-level media rights check.

Для G3 source of truth до отдельного handoff — `Research:G3_HISTORY/**`, а не YouTube transcript и не будущий Product draft.

## 6. G3 as first flagship dossier

Рекомендуемый dossier route после evidence closure:

```text
/journal/dossiers/g3/
```

Внутри:

1. **Большая история G3: 2011–2026** — rise → expansion → 2025 crisis → 2026 collapse.
2. **Финансы** — revenue/expenses/net assets/program-service series, без unsupported fraud rhetoric.
3. **Governance** — board/officer evolution и Pray’s Mill role overlap.
4. **Josh Buice, 2025** — anonymous identities, targets, institutional response.
5. **Tom Buck, 2026** — sermon-attribution evidence отдельно от anonymous campaign.
6. **Как закончилась G3** — Network dissolution, operational wind-down, corporate/asset aftermath.
7. **Документы** — curated primary-source index.
8. **Что мы ещё не знаем** — открытые P0/P1 questions.

Одна огромная статья допустима, но dossier + long-form entry даёт читателю лучший navigation и позволяет обновлять доказательства без переписывания всей истории.

## 7. Visual language

Нужен внешний вид серьёзного editorial desk, но **внутри существующего visual language сайта**, а не отдельный чужой сайт.

Рекомендованный характер:

- крупный editorial headline;
- дата/тип материала/evidence status над заголовком;
- restrained newspaper-like grid для landing;
- hero только документальный или rights-cleared;
- timeline strips;
- data cards и оригинальные графики;
- document callouts;
- side rail `Ключевые факты` / `Связанные документы`;
- визуальное различие `FACT / TESTIMONY / DISPUTED / CORRECTION` без sensational red-alert aesthetics.

**Не создавать новый global CSS/JS layer.** Production design должен использовать существующие разрешённые style/runtime surfaces либо route-local Astro styling в рамках repository contract после отдельного scope review.

## 8. Landing `/journal/`

Предлагаемая композиция:

1. Lead investigation — одна главная карточка.
2. `Последние обновления` — compact dated feed.
3. `Расследования` — 2–4 сильных long-form cards.
4. `Досье` — G3 и будущие тематические series.
5. `Документы` — свежие primary-source explainers.
6. `История и контекст` — bridge к Baptists/book/history material там, где это редакционно уместно.
7. `Методология` — короткий trust panel.
8. `Исправления` — видимая ссылка, не спрятанная мелким шрифтом.

## 9. Article metadata model

Conceptual fields; exact implementation only after current editorial-metadata/route contracts are reviewed:

```text
kind: investigation | news | explainer | document
publishedAt:
updatedAt:
correctionAt?:
editorialStatus: verified | developing | corrected
subjectTags: []
dossierId?:
researchSnapshot:
claimSet:
sourceCount:
primarySourceCount:
mediaRightsState:
```

Reader byline remains repository-canonical:

`Автор-редактор: Фёдор Милованов`

Никакого `Автор: Фёдор Милованов`.

## 10. SEO / structured data direction

Не внедрять до отдельного route contract, но проектировать под:

- `NewsArticle` для действительно новостного материала;
- `Article` для investigations/explainers;
- `datePublished` + `dateModified`;
- canonical + OG/Twitter;
- BreadcrumbList;
- Organization/Person identity через уже существующие canonical site identities;
- sitemap/RSS inclusion только для publication-authorized items;
- noindex для internal drafts, если route вообще создаётся до публикации (предпочтительно не создавать placeholder route).

## 11. Corrections policy

Сильный журналистский раздел должен уметь публично исправлять себя.

Минимум:

- опечатки без смыслового изменения можно править без отдельной correction note;
- существенная фактическая правка получает dated correction note;
- если доказательство изменило verdict, сохраняется предыдущая формулировка/смысл исправления в correction log;
- нельзя silently delete неудобный verified counter-evidence;
- нельзя оставлять устаревший обвинительный headline после опровержения body.

## 12. Safety against sensationalism

Запрещённые shortcut-паттерны без доказательств:

- `афера`, `мошенничество`, `хищение`, `преступление` как журналистский вывод без соответствующего доказательного/правового threshold;
- motive-as-fact (`месть`, `хотели уничтожить`) без communications/testimony;
- guilt by association;
- превращение stale webpage/app metadata в доказательство текущей должности или владения;
- allegation count = proven instance count;
- `все знали`, если официальное/первичное evidence этого не устанавливает.

## 13. Implementation lanes

### Lane A — architecture/research (THIS LANE)

Allowed:
- `research/JOURNAL_EDITORIAL_ARCHITECTURE_2026-09-07.md`

Forbidden:
- `src/**`
- `migration/**`
- `data/**`
- shared CSS/JS/runtime
- sitemap/feed/navigation

### Lane B — native `/journal/` foundation

Только после отдельного live pre-flight и collision check. Own route/components/profile. Не трогать `/articles/` capability work.

### Lane C — first dossier/product handoff

G3 только после explicit Research handoff snapshot и article-ready claim set.

### Lane D — global discovery

Добавление `Журнал` в shared `SiteSectionsMenu`, home discovery, RSS/search. Это SYSTEM/shared surface и должно идти последним, когда route уже доказан.

## 14. Current collision note — 2026-09-07

На base `f0527243...` уже открыты:

- PR #1851 — SYSTEM article retained-capability ownership;
- PR #1842 — Service Worker root-generation authority;
- PR #1849 — pastor-series research reconciliation;
- multiple Baptist book research lanes.

Поэтому этот lane намеренно **не меняет shared article runtime, SiteSectionsMenu, migration registries или production routes**.

## 15. Definition of readiness for public implementation

Перед началом production `/journal/`:

1. текущий `main` и active overlaps повторно проверены;
2. route name окончательно выбран (`/journal/` recommended);
3. exact route ownership/profile strategy определена;
4. design использует существующие permitted assets;
5. metadata/schema model не конфликтует с editorial freeze;
6. article/news corrections contract определён;
7. первый dossier имеет publication-authorized Research handoff;
8. media rights по каждому public image закрыты;
9. no placeholder public route создаётся только ради roadmap.

## Recommendation

**Создавать `/journal/` как отдельную редакционную вертикаль.** `/articles/` оставить библиотекой богословских/evergreen материалов; G3 сделать первым флагманским documentary dossier. Общий стиль — `theological journal + documentary newsroom`, а не tabloid breaking-news feed.