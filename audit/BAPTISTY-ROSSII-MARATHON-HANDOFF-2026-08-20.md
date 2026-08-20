# Баптисты России — marathon implementation handoff

**Дата:** 2026-08-20
**Статус:** ACTIVE — SYSTEM foundation lane, implementation complete pending exact-head CI.
**Owner / lane:** `baptisty-book-authority-v2`
**Canonical branch:** `codex/baptisty-book-authority-v2`
**PR:** `#1765` — `docs(baptisty): establish Book Authority v2`
**Mode:** `SYSTEM`
**Base / rollback SHA:** `bc7f0d3815e7e41551b3180e3cd22fb55a95dd04`
**Current scope:** authority + evidence bridge + machine roadmap/gate + durable handoff.
**Explicit non-scope:** route prose, historical media import, shared runtime, homepage, 3D map, RSS repair.

## 1. Owner request

Начать марафон изменений по итоговому super-audit, работать без костылей, фиксировать в репозитории:

- что требовалось сделать;
- что фактически сделано;
- какие проверки выполнены;
- что осталось;
- какие границы нельзя нарушать следующему агенту.

## 2. Pre-flight

На старте lane:

- Product `main`: `bc7f0d3815e7e41551b3180e3cd22fb55a95dd04`;
- Baptist-specific open PR: не найден;
- Baptist-specific active branch: не найден;
- current `AGENTS.md`, `docs/WORK_MODES.md`, `docs/OWNER-INVARIANTS.md` прочитаны на exact base;
- применимый Baptist research/atlas contract из `AGENTS-REFERENCE.md` прочитан;
- выбрана SYSTEM-модель, потому что меняется authority/control-plane книги;
- route-content намеренно не смешивается с этим PR.

### Environment witness

Локальный `git clone` в этой среде не смог резолвить `github.com`. Поэтому нельзя честно заявлять локальный npm/browser witness. Работа ведётся через GitHub connector на exact SHA, а final-head verification должна опираться на доступные GitHub Actions / repository checks. Это ограничение среды, а не Product defect.

## 3. Что super-audit потребовал исправить

### P0 — authority drift

Product, editorial architecture и новый Research жили по разным поколениям модели. Нужна одна long-horizon authority без разрушения текущей опубликованной поверхности.

### P0 — evidence-model drift

Research уже использует `A1/A2/A3/B1/C/D` плюс независимые `accessState`, `locatorState`, `rightsState`, `publicationState` и типизированные HOLD. Публичный справочник ещё объясняет старую `A/B/C/D` модель.

### P0 — roadmap false-green

Старый roadmap хранил route targets на `47 400` слов и мог восприниматься как финальная книга. Нужен явный разрыв между legacy route baseline и новым book target `90 000–120 000` слов.

### P0/P1 — future route discipline

Будущая архитектура должна существовать как planning graph, но не создавать 17/20 пустых URL.

### P1 — research-to-publication bridge

Research presence, quote-ready status, Drive presence и article-ready visual не должны автоматически означать publication-ready.

### P1 — false-green guards

Registry/payload existence не должно засчитываться как implementation/capability/publication proof.

## 4. Что сделано

### Commit `5a390c1c7969e59d877cafe6f5ebb719b40b017a`

Добавлен `docs/BAPTISTY-ROSSII-BOOK-AUTHORITY-V2.md`.

Документ фиксирует:

- текущую public surface как стабильную: 9 исторических статей + отдельный reference/endpaper;
- current 4-chapter navigation остаётся под authority `docs/BAPTISTY-ROSSII-EDITORIAL-ARCHITECTURE.md`;
- long-horizon target `5 частей / 20 глав` как planning architecture, а не route contract;
- book target `90 000–120 000` слов;
- `47 400` как legacy route-growth baseline, а не финальную цель;
- Research evidence bridge `A1/A2/A3/B1/C/D`;
- независимые `accessState / locatorState / rightsState / publicationState` и HOLD-флаги;
- независимость Product source-confidence от Research evidenceClass;
- reader-facing evidence labels;
- четырёхголосную модель спорной истории;
- publication Definition of Ready / Definition of Done;
- rights-first media pipeline;
- derived reading-time requirement;
- false-green anti-patterns;
- последовательность будущих implementation lanes;
- no-go/rollback boundaries.

### Commit `f4ced65432b092ac98e8f7a6f9625aa1e880e9c5`

Добавлен этот durable handoff ledger и открыт draft PR `#1765`.

### Commit `4979554a5fd05491434f3f34d23502b097034de1`

`data/baptisty-rossii-expansion-roadmap.json` переведён в `2026-08-20.v4` без потери useful legacy route records.

Machine roadmap теперь различает:

- `currentPublishedSurface` — 9 статей + reference, 10 content routes, current 4 chapters;
- `legacyRouteGrowth.targetTotalWords = 47 400`;
- `bookTargetWords = 90 000–120 000`;
- `chapterTargetWords = 4 500–7 000` как typical planning range;
- historical Research binding как `legacy-review-required`, а не current publication authority;
- current Research evidence enum/states/HOLD;
- Product confidence как отдельную axis;
- publication Definition of Ready;
- future `5 × 20` planning graph;
- mapping текущих route-materials в будущие planned chapters через `feedsPlannedChapters`;
- `spravochnik` как `referenceEndpaper`, а не будущую numbered chapter;
- rights-first media pipeline и явное `articleReadyIsSiteReady: false`.

Критическое ограничение: planned chapters **не содержат** route-bearing полей.

### Commit `3f89233f2e5174c5e5f866918e1fa46f74e24b5d`

Усилен существующий canonical `scripts/baptisty-roadmap-audit.js`; параллельный validator не создан.

Новые fail-closed invariants:

- exact v4 authority/data file links существуют;
- current public counts остаются `9 + 1`, 10 content routes, 4 current chapters;
- legacy target остаётся `47 400`, а book target — `90 000–120 000`;
- planning graph ровно `5 частей / 20 уникальных chapter IDs`;
- planned chapter запрещено иметь `href`, `route`, `slug`, `url`, `path`;
- Research evidence classes/state axes/HOLDs должны совпадать с Book Authority v2;
- Product confidence registry существует и mechanical mapping запрещён;
- publication Definition of Ready не может незаметно усохнуть;
- legacy Research binding обязан оставаться review-required;
- `article-ready != site-ready` закреплено машинно;
- media pipeline обязан включать identity/provenance/rights/integrity/ledger/publication;
- mass import и AI-псевдоархив остаются forbidden;
- все 10 текущих parts остаются связаны с publication authority;
- все non-reference текущие parts должны указывать, какие future chapters они питают;
- сумма legacy route targets должна реально равняться `47 400`, а не просто быть записана сверху.

## 5. Authority-document boundary

`docs/BAPTISTY-ROSSII-EDITORIAL-ARCHITECTURE.md` намеренно **не переписан** в этом lane ради формального reciprocal backlink.

Причина: он остаётся исторически и операционно правильной authority текущей опубликованной 4-chapter surface и ближайшей extraction-логики. `Book Authority v2` явно ссылается на него и объявляет эту границу. Перезаписывать большой historical/decision документ целиком только ради строки-ссылки было бы churn без продуктовой ценности и повышало бы риск случайной потери контекста.

Итоговая authority chain:

```text
current public structure / immediate extraction
    → docs/BAPTISTY-ROSSII-EDITORIAL-ARCHITECTURE.md

long-horizon book target / evidence bridge / publication readiness
    → docs/BAPTISTY-ROSSII-BOOK-AUTHORITY-V2.md

machine projection + fail-closed guard
    → data/baptisty-rossii-expansion-roadmap.json
    → scripts/baptisty-roadmap-audit.js
```

## 6. Scope witness

Compare base → SYSTEM branch before this handoff update showed:

- branch ahead of base, not behind;
- modified/added surfaces only:
  - `docs/BAPTISTY-ROSSII-BOOK-AUTHORITY-V2.md`;
  - `data/baptisty-rossii-expansion-roadmap.json`;
  - `scripts/baptisty-roadmap-audit.js`;
  - this audit handoff;
- **0** Baptist Body/PageHead route prose changes;
- **0** media changes;
- **0** shared runtime/CSS changes;
- **0** homepage/3D/RSS changes.

## 7. Verification state

### Proven now

- exact base/rollback SHA recorded;
- branch/PR isolation established;
- GitHub compare confirms bounded SYSTEM diff and no behind-base drift at checkpoint;
- existing canonical npm command is `npm run baptisty:roadmap:audit` → `node scripts/baptisty-roadmap-audit.js`;
- no parallel validator introduced.

### Exact-head CI incident and repair

At head `5ce0e56a330c7f3da887e9d646b58438eed8ce59`, Source Authority Contract run `32355403417` failed at `git diff --check` because the two new MD files used Markdown hard-break trailing spaces. The actual source-authority/build steps were skipped after diff hygiene failed.

This was treated as a real lane defect, not waived. The repair is whitespace-only:

- `docs/BAPTISTY-ROSSII-BOOK-AUTHORITY-V2.md` metadata lines cleaned;
- this handoff metadata block cleaned;
- no workflow or guard relaxation.

### Not yet proven

- local npm execution: **NOT RUN** because environment cannot resolve GitHub for clone;
- browser/live production: **NOT APPLICABLE / NOT CLAIMED** for this SYSTEM authority lane;
- repaired final-head GitHub Actions: **PENDING** after whitespace repair commits.

**Не считать SYSTEM lane зелёным, пока repaired final PR head не получил доступный exact-head CI witness.**

## 8. SYSTEM checklist

- [x] Создать Book Authority v2 и разделить current/public vs future/book horizons.
- [x] Связать authority layers без переписывания historical architecture doc: Book Authority v2 объявляет current architecture authority явно.
- [x] Обновить `data/baptisty-rossii-expansion-roadmap.json` до v4.
- [x] Сохранить legacy route/source material без превращения его в final book authority.
- [x] Усилить **существующий** canonical roadmap audit; не создавать одноразовый validator.
- [x] Закрепить no-placeholder-route, evidence, media и legacy/book target boundaries машинно.
- [x] Разобрать первый exact-head CI failure до root cause; не ослаблять guard.
- [ ] Получить repaired final-head GitHub Actions / repository check witness.
- [ ] Записать final head/check run IDs/conclusions сюда.
- [ ] После verification оставить PR review-ready только если он действительно зелёный.
- [x] Не трогать статьи, media и runtime в SYSTEM lane.

## 9. Следующие independently mergeable lanes

После закрытия SYSTEM foundation:

1. **Public evidence-language sync** — обновить читательский раздел справочника со старой A/B/C/D модели на современную reader-facing систему без смешения внутренних enum.
2. **Petersburg Golden Chapter** — source-to-section matrix, затем безопасное разделение перегруженной текущей главы.
3. **Origins** — Кура → Южная штунда → 1884/1885.
4. **Public square** — Мазаев/Проханов → периодика → Фетлер.
5. **1917–1928** — самостоятельный документальный блок.
6. **Soviet night** — 1929 → 1930-е → 1944 → 1945–1959.
7. **1960–1991** — Инструктивное письмо → разлом → самиздат/узники/семьи → память.
8. **Book experience** — atlas/quizzes/reader/homepage/structured data после стабилизации текста.

## 10. Guardrails для следующего агента

Не делать:

- mega-PR authority + route prose + media + runtime;
- новые placeholder routes;
- массовый импорт `article-ready` фотографий;
- AI-псевдоархив;
- механическое `A1 → Product confidence token` преобразование;
- ручное выставление production reading time по редакционному target;
- дублирование существующего `RSS-SERIES-DATE-COLLAPSE` repair lane;
- ручное редактирование generated route matrix / `_app`;
- `dateModified` на техническом commit без реального изменения читательского материала.

## 11. Recovery

Если SYSTEM lane необходимо отменить, rollback boundary — base SHA `bc7f0d3815e7e41551b3180e3cd22fb55a95dd04`. Публичные статьи, URL, media и runtime в этом lane не изменяются, поэтому rollback должен быть чистым и ограниченным authority/data/audit поверхностью.

## 12. Known branch cleanup note

Во время ранней connector-проверки были случайно созданы duplicate refs:

- `codex/baptisty-book-authority-v2-check`;
- `codex/baptisty-book-authority-v2-check2`;
- `codex/baptisty-book-authority-v2-check3`.

Они **не являются рабочими ветками**, не имеют PR и не должны продолжаться. Canonical branch только `codex/baptisty-book-authority-v2`. Текущий connector не предоставляет delete-ref action; не создавать дополнительные duplicate refs. Если следующий authorized environment имеет branch-delete capability, удалить эти три refs как housekeeping, не смешивая это с Product changes.
