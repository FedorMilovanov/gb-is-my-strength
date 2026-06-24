# Work Modes — FAST / LANE / SYSTEM

**Дата:** 2026-06-23
**Версия:** 2.0 (упрощено по `AGENT_PROTECTION_SIMPLE_v3_0`)

Цель:

```text
не утонуть в защите,
но не дать агентам ломать проект shared-файлами, main и параллельной работой.
```

---

## 0. Проверки: FAST loop vs FULL gate

**Не гоняй полный `validate:static-publication` после каждой мелкой правки в Arena.**
Это не повышает качество, а сжигает лимит времени/контекста: полный gate включает Astro check/build и десятки route/content audits.

### FAST loop — после маленькой правки / перед следующим шагом

Используй быстрые, точные проверки по зоне риска:

```bash
# всегда, если есть diff
git diff --check

# metadata / refactor / route contracts
npm run migration:metadata:check
npm run native:runtime:audit:strict

# контент / MDX / search / series
npm run data:consistency
npm run content:parity
npm run mdx:structure:audit

# shared/system/workflows
npm run guard:shared-files
npm run workflows:check
```

Выбирай не всё подряд, а релевантный набор. Для system/refactor lanes минимум обычно:

```bash
git diff --check
npm run guard:shared-files
npm run data:consistency
npm run migration:metadata:check
npm run native:runtime:audit:strict
```

### FULL gate — перед commit / merge / push production-impact lane

Перед финальным commit/merge/push, если менялись production route, migration matrix, scripts, package/workflows, shared data или refactor contracts:

```bash
npm run validate:static-publication
npm run guard:shared-files
```

Docs-only typo FAST может не требовать full gate. Но **любой refactor/system/shared lane** должен иметь full gate в lane report или явное объяснение, почему он невозможен.

### Почему так

- быстрые проверки дают feedback за секунды и ловят локальные ошибки;
- полный gate остаётся обязательным release-barrier;
- в Arena sandbox 2 CPU / ~2 GB RAM, поэтому частые Astro build/full gates тормозят работу и иногда провоцируют OOM в fresh worktree;
- качество не теряется, если full gate обязательно проходит перед финальным commit/merge/push.

---

## 1. Три режима

### FAST

Один агент. Маленькая правка. Нет shared/system файлов.

Примеры:

```text
опечатка
один docs-файл
небольшая правка текста
route-local report
```

Проверки FAST:

```bash
git diff --check
npm run data:consistency # если менялся контент/search/series
```

Если правка затрагивает route metadata/contracts, добавь:

```bash
npm run migration:metadata:check
npm run native:runtime:audit:strict
```

---

### LANE

Route/refactor/много файлов/параллельная работа.

Примеры:

```text
Gill route
Nagornaya route
Heart series
Pagefind audit route
Astro shell
_legacy split
```

Ветка:

```bash
git checkout -b lane/<task>
```

FAST loop во время работы:

```bash
git diff --check
npm run guard:shared-files
npm run data:consistency
npm run migration:metadata:check
npm run native:runtime:audit:strict
```

Перед commit/merge/push:

```bash
npm run validate:static-publication
npm run guard:shared-files
```

---

### SYSTEM

Shared/global/high-risk.

Примеры:

```text
AGENTS.md
package.json
package-lock.json
.github/workflows/**
astro.config.*
tsconfig.*
sw.js
migration/**
scripts/cache-bust.js
scripts/copy-legacy-to-dist.js
scripts/check-workflows.js
src/layouts/**
css/**
js/**
karty/_engine/**
```

Ветка:

```bash
git checkout -b lane/system-<task>
# или lane/protection-*
```

FAST loop во время работы:

```bash
git diff --check
npm run guard:shared-files
npm run workflows:check
npm run migration:metadata:check
npm run native:runtime:audit:strict
```

Перед commit/merge/push:

```bash
npm run validate:static-publication
npm run guard:shared-files
```

SYSTEM нельзя совмещать с route/content refactor.

---

## 2. Два запрета

### Запрет 1

```text
Route lane не трогает SYSTEM files.
```

То есть `lane/gill-*` не должен менять:

```text
package.json
package-lock.json
.github/workflows/**
AGENTS.md
src/layouts/**
css/**
js/**
karty/_engine/**
sw.js
migration/**
```

Даже если commit message содержит `[LANE lane/gill-*]`.

---

### Запрет 2

```text
Обычный агент не обновляет AGENTS.md.
```

Он пишет:

```text
docs/refactor-2026/lanes/<lane-name>.md
```

`AGENTS.md` обновляет только интегратор/system lane.

---

## 3. Группы файлов

### SYSTEM files

```text
AGENTS.md
package.json
package-lock.json
.github/workflows/**
astro.config.*
tsconfig.*
sw.js
migration/**
scripts/cache-bust.js
scripts/copy-legacy-to-dist.js
scripts/check-workflows.js
src/layouts/**
css/**
js/**
karty/_engine/**
```

Только:

```text
lane/system-*
lane/protection-*
```

---

### SHARED data / shared docs

```text
docs/WORK_MODES.md
docs/LANE_LOCK_POLICY.md
data/series.json
data/search-manifest.json
data/public-content-baseline.json
scripts/guard-shared-files.js
scripts/check-data-consistency.js
scripts/audit-pro.js
scripts/visual-parity-screenshots.js
```

Только:

```text
lane/shared-*
lane/system-*
lane/protection-*
```

---

### SAFE

```text
docs/refactor-2026/lanes/**
docs/research/**
reports/**
audit/**
sitemap.xml
robots.txt
CNAME
```

Всегда можно.

---

## 4. Главное правило поведения

```text
Если нашёл проблему вне своей зоны — не исправляй.
Запиши Out-of-lane finding.
```

Пример:

```md
## 4.1 Out-of-lane finding

Lane: lane/gill-spravochnik-gs7

Нашёл:
- data/series.json, возможно устарел readTime.

Не исправлял:
- это shared data.

Предложение:
- lane/shared-readtime-sync
```

---

## 5. Lane index

Активные lanes фиксируются в:

```text
docs/refactor-2026/lanes/README.md
```

---

## 6. Lane report

Шаблон:

```text
docs/refactor-2026/lanes/TEMPLATE.md
```

---

## 7. Команды для агента

### FAST

```bash
git diff --check
npm run data:consistency
```

### LANE

```bash
npm run guard:shared-files
npm run data:consistency
```

### SYSTEM

```bash
npm run guard:shared-files
npm run workflows:check
npm run validate:static-publication
```
