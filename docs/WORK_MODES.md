# Work Modes — FAST / LANE / SYSTEM

**Дата:** 2026-06-23  
**Версия:** 2.0 (упрощено по `AGENT_PROTECTION_SIMPLE_v3_0`)

Цель:

```text
не утонуть в защите,
но не дать агентам ломать проект shared-файлами, main и параллельной работой.
```

---

## 0. Три режима

### FAST

Один агент. Маленькая правка. Нет shared/system файлов.

Примеры:

```text
опечатка
один docs-файл
небольшая правка текста
route-local report
```

Проверки:

```bash
git diff --check
npm run data:consistency # если менялся контент
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

Проверки:

```bash
npm run guard:shared-files
npm run data:consistency
```

Перед merge:

```bash
npm run validate:static-publication
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

Проверки:

```bash
npm run guard:shared-files
npm run workflows:check
npm run validate:static-publication
```

SYSTEM нельзя совмещать с route/content refactor.

---

## 1. Два запрета

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

## 2. Группы файлов

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

## 3. Главное правило поведения

```text
Если нашёл проблему вне своей зоны — не исправляй.
Запиши Out-of-lane finding.
```

Пример:

```md
## Out-of-lane finding

Lane: lane/gill-spravochnik-gs7

Нашёл:
- data/series.json, возможно устарел readTime.

Не исправлял:
- это shared data.

Предложение:
- lane/shared-readtime-sync
```

---

## 4. Lane index

Активные lanes фиксируются в:

```text
docs/refactor-2026/lanes/README.md
```

---

## 5. Lane report

Шаблон:

```text
docs/refactor-2026/lanes/TEMPLATE.md
```

---

## 6. Команды для агента

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
