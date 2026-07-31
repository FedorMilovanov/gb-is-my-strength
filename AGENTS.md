# AGENTS.md — operational contract

> **Владелец:** Фёдор Милованов.  
> Этот короткий файл обязателен перед mutation. Подробные архитектурные, route,
> content и UI-контракты сохранены без потерь в [`AGENTS-REFERENCE.md`](AGENTS-REFERENCE.md)
> и читаются только по затронутой поверхности.

## 1. Authority and pre-flight

Используй порядок авторитета:

1. текущая инструкция владельца;
2. текущий `main`, релевантные открытые PR/issues и exact branch heads;
3. current source-of-truth files;
4. `docs/OWNER-INVARIANTS.md` для owner-sensitive решений;
5. исторические отчёты и `AGENTS-REFERENCE.md` только как применимый surface contract/evidence.

Перед mutation:

1. зафиксируй `main` и rollback SHA;
2. проверь только ветки/PR и файлы, которые могут пересечься с планируемым scope;
3. выбери `FAST`, `LANE` или `SYSTEM` по `docs/WORK_MODES.md`;
4. объяви owner, bounded scope, source of truth и применимые checks;
5. прочитай в `AGENTS-REFERENCE.md` только разделы затронутой поверхности.

Не требуется перед каждой задачей перечитывать весь reference/changelog, проводить
полный environment inventory или запускать все repository checks. Возможности среды
проверяются только когда выбранные команды от них зависят.

## 2. Minimum lane record

```md
Mode: FAST | LANE | SYSTEM
Lane / owner:
Purpose and bounded scope:
Base / rollback SHA:
Allowed files or surfaces:
Adjacent active work / overlap:
Source of truth:
Required checks:
```

Статус, handoff, recovery, successor и production witness добавляются только когда
применимы. GitHub уже хранит commits, diff, checks и current head SHA.

## 3. Branch and agent safety

- Все обычные изменения идут через branch + PR; direct `main` — только явно
  owner-approved emergency с rollback SHA.
- Один independently mergeable lane имеет одного owner, одну canonical branch и один PR.
- Большая инициатива может иметь несколько непересекающихся independently mergeable lanes.
- Не reset/rebase/force-push/close/delete чужую active branch.
- Не продолжай чужой lane без explicit handoff или решения владельца.
- Не создавай empty remote branch до первого meaningful recoverable commit.
- Draft PR открывается после первого meaningful push; checkpoints event-driven, не по таймеру.
- Diagnostics остаются detached/local, пока результат disposable.
- Recovery и cleanup выполняются только по `docs/BRANCH_LIFECYCLE_V4.md`.

## 4. Proportionate verification

Канонический выбор checks — `docs/WORK_MODES.md`.

- Iteration: только checks, которые могут упасть из-за текущего diff.
- Merge: применимые checks должны покрывать final PR head.
- Production: source merge не доказывает live bytes; deploy/live evidence нужно только
  когда заявляется production state.
- Wording-only docs diff не требует full production build, browser suite,
  `validate:all` или `audit-pro`, если эти поверхности технически не затронуты.
- Workflow/control-plane diff требует соответствующих workflow/control-plane checks.
- CSS/JS, route, content, data и runtime используют только свои targeted contracts.

## 5. Critical invariants

Никогда без отдельного owner-approved SYSTEM scope:

1. не создавай новые CSS/JS-файлы сверх зафиксированной архитектуры;
2. не меняй byline на `Автор: Фёдор Милованов` — только `Автор-редактор:` или `Редактор:`;
3. не возвращай AI-disclosure в статьи; об ИИ — только `/about/`;
4. не запускай repository-wide `prettier --write .` или `eslint --fix .`;
5. не обновляй зависимости без явного запроса;
6. не удаляй/не подменяй generated `?v=...` asset revisions; после CSS/JS запускай
   canonical cache-bust flow;
7. не удаляй `article-header` и `author-card` contracts;
8. не создавай одноразовые root scripts/patch/diff/generated artifacts;
9. не дублируй OG/meta/runtime handlers;
10. не возвращай legacy floating controls; canonical controls определены в reference;
11. не добавляй `!important` без анализа cascade/layer/specificity;
12. не оставляй английские прямые цитаты в читательском тексте русских статей;
13. не меняй owner-sensitive typography, UI hierarchy или protected data по вкусу агента;
14. не редактируй derived route matrix вручную.

## 6. Surface routing

Читай применимый раздел [`AGENTS-REFERENCE.md`](AGENTS-REFERENCE.md) перед изменением:

- CSS/JS/assets and cache bust;
- articles, byline, sources, footnotes, quiz and Russian quote policy;
- route ownership/migration registries;
- series/book/map/overlay engines;
- owner-sensitive Gill, home, typography and protected UI;
- deployment, service worker, publication and release evidence;
- Baptists research/atlas contracts;
- accessibility, browser/visual tests and data registries.

Для route/registry первичны:

```text
migration/page-ownership.json
data/route-profiles/*.json
```

`migration/route-migration-matrix.json` — derived output canonical generator; не правь
его вручную для добавления или переопределения route.

## 7. Protected paths

Следующие поверхности как минимум `SYSTEM` и требуют explicit scope + exact-head evidence:

```text
AGENTS.md
AGENTS-REFERENCE.md
README.md
package.json / package-lock.json
.github/**
docs/WORK_MODES.md
docs/LANE_LOCK_POLICY.md
docs/OWNER-INVARIANTS.md
docs/AGENT_PUSH_MODEL.md
docs/GIT_WORKTREE_POLICY.md
docs/BRANCH_LIFECYCLE_V4.md
migration/**
protected shared data
src/layouts/**
shared runtime / css/** / js/** / sw.js
karty/_engine/**
repository/release policy scripts
```

## 8. Definition of done

Lane завершён, когда:

- diff соответствует bounded scope;
- final head прошёл применимые checks;
- adjacent active branches не изменены;
- review threads обработаны;
- temporary workflow/writer/patcher, введённые lane, удалены;
- recovery/cleanup disposition записан только если применим;
- production witness записан только если заявляется production.

Подробный reference сохраняет прежние surface-specific запреты, historical notes и
инвентари. Его старые blanket-инструкции о полном чтении/универсальных checks
считаются superseded этим operational contract и `docs/WORK_MODES.md`.
