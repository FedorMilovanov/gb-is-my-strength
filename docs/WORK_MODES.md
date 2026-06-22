# Work Modes for Agents — AGENT PROTECTION v1.5

**Версия:** 1.0 · 2026-06-23  
**Цель:** определить режим работы перед началом любой задачи.

---

## Work Mode Decision Tree

```
Перед началом работы — ответь на 3 вопроса:

1. Сколько агентов работает одновременно?
   → Один → SOLO
   → Несколько → MULTI-AGENT

2. Какие файлы затрагиваются?
   → Только docs, текст статьи, контент
   → Route components, Astro shells, _legacy fragments
   → AGENTS.md, package.json, workflows, data/series.json, layouts, global CSS/JS

3. Какой риск?
   → Docs / мелкий контент-фикс → Risk 0–1
   → Route refactor / componentization → Risk 2
   → Shared/system/global файлы → Risk 3 / HIGH-RISK
```

---

## Mode 1: SOLO

Один агент, один человек. Работает быстро.

**Разрешено на main:**
- Docs-only (Risk 0)
- Content-only без shared файлов (Risk 1)
- Один текстовый фикс
- Мелкий typo/grammar fix

**Требует lane branch:**
- Route refactor (Risk 2)
- Любой shared/high-risk файл
- Всё что меняет более 3 файлов
- Любая задача с названием refactor/migration/stabilization

**Проверки:**
```bash
npm run guard:shared-files    # перед push — блокирует небезопасные shared-изменения
npm run data:consistency       # если менялся контент
```

**НЕ ДЕЛАЙ на SOLO без lane:**
- AGENTS.md
- package.json
- .github/workflows/**
- data/series.json / data/search-manifest.json
- global CSS/JS
- layouts

---

## Mode 2: MULTI-AGENT

Несколько агентов одновременно. Координация обязательна.

**Правила:**
```
✓ main — НЕ трогать напрямую
✓ Каждый агент — в lane/<name>
✓ Один route — один владелец lane
✓ Shared файлы — отдельный lane (lane/shared-xyz)
✓ [LANE lane/NAME] в каждом commit message
✓ Out-of-lane проблемы — записывать, НЕ исправлять сразу
```

**В конце lane — merge в main + обновить AGENTS.md rNNN**

**Проверки:**
```bash
npm run guard:shared-files    # блокирует тихое изменение shared files
npm run data:consistency       # перед merge в main
npm run validate:static-publication  # перед merge в main
```

---

## Mode 3: HIGH-RISK

Любая работа с shared/system/global файлами.

**Разрешено:**
- lane/system-protection-v1-5
- lane/shared-data-fix
- lane/workflow-hardening

**Запрещено:**
- Совмещать с route content refactor в одном lane
- Менять production routes в том же коммите

**Проверки:**
```bash
npm run guard:shared-files    # MUST PASS
npm run workflows:check        # после изменения workflows
npm run validate:static-publication  # после изменения build/deploy
```

---

## Mode 4: EMERGENCY

Только владелец / интегратор. Быстрый hotfix.

**После hotfix — обязательно:**
```markdown
1. Причина emergency:
2. Touched files:
3. Risk gates run:
4. Если production затронут — full gates
```

---

## Risk Levels

| Risk | Что | Проверки |
|------|-----|----------|
| **0** | Docs-only | `git diff --check` |
| **1** | Content-only, без shared | `npm run data:consistency` |
| **2** | Route refactor | `npm run data:consistency && npm run <route>:visual-parity:audit && npm run validate:static-publication` |
| **3** | Shared/system/global | `npm run guard:shared-files && npm run workflows:check && npm run validate:static-publication` |

---

## Shared / High-Risk Files (запрещено без lane)

```
AGENTS.md, README.md, package.json, package-lock.json
.github/workflows/**
data/series.json, data/search-manifest.json, data/public-content-baseline.json
src/layouts/**, css/site.css, js/site.js, js/search.js, sw.js
scripts/guard-shared-files.js, scripts/cache-bust.js, scripts/copy-legacy-to-dist.js
scripts/check-data-consistency.js, scripts/audit-pro.js, scripts/visual-parity-screenshots.js
scripts/check-workflows.js
karty/_engine/**, karty/ishod/**, karty/avraam/**
```

**Исключение:** docs, reports, sitemap.xml, robots.txt, CNAME — всегда разрешено.

---

## Lane Reports (вместо прямого AGENTS.md редактирования)

Обычные агенты пишут отчёты сюда:
```
docs/refactor-2026/lanes/<lane-name>-YYYY-MM-DD.md
```

Шаблон:
```md
# Lane Report

Lane: lane/my-task
Mode: MULTI-AGENT / SOLO
Risk: 2 / content-only
Agent: Arena Agent
Date: 2026-06-23

## Changed files
- ...

## Shared/high-risk files touched
No / Yes → ...

## Checks run
- npm run guard:shared-files ✅
- npm run data:consistency ✅

## Out-of-lane findings
- ... (записываем, НЕ исправляем)

## Merge recommendation
Merge / Do not merge yet

## Rollback point
<commit hash>
```

**AGENTS.md обновляет только интегратор** после волны, не каждый агент после своего lane.

---

## Out-of-Lane Findings — правило

```
Если проблема вне твоего lane:
  → НЕ исправляй
  → Запиши в lane report: "Suggested lane: lane/XYZ"
  → Продолжай свою задачу
```

Пример:
```markdown
## Out-of-lane findings
- data/series.json: Gill I readTime устарел (21 вместо 28)
  Suggested lane: lane/shared-readtime-sync
  Not fixed in this lane (gill-spravochnik-gs7)
```
