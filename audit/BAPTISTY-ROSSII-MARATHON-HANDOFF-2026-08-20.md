# Баптисты России — marathon implementation handoff

**Дата:** 2026-08-20  
**Статус:** ACTIVE — SYSTEM foundation lane.  
**Owner / lane:** `baptisty-book-authority-v2`  
**Canonical branch:** `codex/baptisty-book-authority-v2`  
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

Старый roadmap хранит route targets на `47 400` слов и может описывать план как будто это финальная книга. Нужен явный разрыв между legacy route baseline и новым book target `90 000–120 000` слов.

### P0/P1 — future route discipline

Будущая архитектура должна существовать как planning graph, но не создавать 17/20 пустых URL.

### P1 — research-to-publication bridge

Research presence, quote-ready status, Drive presence и article-ready visual не должны автоматически означать publication-ready.

### P1 — false-green guards

Registry/payload existence не должно засчитываться как implementation/capability/publication proof.

## 4. Сделано в текущем lane

### Commit `5a390c1c7969e59d877cafe6f5ebb719b40b017a`

Добавлен:

- `docs/BAPTISTY-ROSSII-BOOK-AUTHORITY-V2.md`.

Документ фиксирует:

- текущую публичную поверхность как стабильную;
- long-horizon target `5 частей / 20 глав` как planning architecture, а не route contract;
- book target `90 000–120 000` слов;
- `47 400` как legacy route-growth baseline, а не финальную цель;
- Research evidence bridge;
- независимость Product source-confidence от Research evidenceClass;
- четырёхголосную модель спорной истории;
- publication Definition of Ready / Done;
- rights-first media pipeline;
- reading-time derivation requirement;
- false-green anti-patterns;
- последовательность будущих implementation lanes;
- no-go/rollback boundaries.

### Этот commit

Создан текущий handoff ledger. Он должен обновляться в каждом meaningful checkpoint этого SYSTEM lane.

## 5. Ещё требуется в SYSTEM lane

- [ ] Связать `docs/BAPTISTY-ROSSII-EDITORIAL-ARCHITECTURE.md` с Book Authority v2, не переписывая историю текущих URL.
- [ ] Обновить `data/baptisty-rossii-expansion-roadmap.json` до v4: current published surface + legacy baseline + 5/20 target architecture + evidence bridge + DoR.
- [ ] Усилить **существующий** canonical roadmap audit; не создавать параллельный одноразовый validator.
- [ ] Проверить JSON и machine invariants на final branch head доступными repository checks.
- [ ] Зафиксировать PR/head/checks в этом отчёте.
- [ ] Не трогать статьи, media и runtime в SYSTEM lane.

## 6. Следующие independently mergeable lanes

После закрытия SYSTEM foundation:

1. **Public evidence-language sync** — обновить читательский раздел справочника со старой A/B/C/D модели на современную reader-facing систему без смешения внутренних enum.
2. **Petersburg Golden Chapter** — source-to-section matrix, затем безопасное разделение перегруженной текущей главы.
3. **Origins** — Кура → Южная штунда → 1884/1885.
4. **Public square** — Мазаев/Проханов → периодика → Фетлер.
5. **1917–1928** — самостоятельный документальный блок.
6. **Soviet night** — 1929 → 1930-е → 1944 → 1945–1959.
7. **1960–1991** — Инструктивное письмо → разлом → самиздат/узники/семьи → память.
8. **Book experience** — atlas/quizzes/reader/homepage/structured data после стабилизации текста.

## 7. Guardrails для следующего агента

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

## 8. Recovery

Если SYSTEM lane необходимо отменить, rollback boundary — base SHA `bc7f0d3815e7e41551b3180e3cd22fb55a95dd04`. Публичные статьи, URL, media и runtime в этом lane не должны изменяться, поэтому rollback обязан быть чистым и ограниченным authority/data/audit поверхностью.

## 9. Known cleanup note

Во время connector-проверки был случайно создан duplicate branch ref `codex/baptisty-book-authority-v2-check`, указывающий на тот же meaningful commit. Он не является рабочей веткой и не должен использоваться/продолжаться. Если доступен branch-delete owner, его следует удалить; canonical branch только `codex/baptisty-book-authority-v2`.
