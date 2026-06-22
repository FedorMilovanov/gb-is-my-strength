# GB is My Strength — живой аудит рефакторинга

**Файл:** `docs/refactor-2026/REFRACTOR_AUDIT_LIVING.md`  
**Обновление:** 2026-06-22 (сессия восстановления)  
**Политика:** один живой MD-файл. Новые сессии добавлять в этот же документ.

---

## Правило ведения документа

1. Все новые находки добавлять под новой секцией `## Сессия YYYY-MM-DD`.
2. Не переносить неподтверждённые догадки в список багов — статус `НУЖНО ПРОВЕРИТЬ`.
3. Не закрывать пункт, пока не указаны: коммит/PR, команда проверки, что именно проверено.
4. Lane lock: не давать двум агентам один route без явного владельца.

---

## 0. Статус после сессии восстановления 2026-06-22

### Исправлено (f5d36772)

| Что | Файл | Суть |
|-----|------|------|
| Home stale reading times | `src/components/home/_legacy/publications.html` | Gill I: 21→28, Hermenevtika: 35→50 |
| Home stale reading time | `src/components/home/_legacy/refutations.html` | Kod da Vinci: 22→30 |
| Guard: alias-conflict | `scripts/check-data-consistency.js` | Добавлена секция 0c — ловит `readTime` vs `readingTime` конфликт |
| karty-avraam конфликт | `data/search-manifest.json` | Убран `readingTime=15`, оставлен `readTime=5` |
| Visual Parity CI gate | `scripts/visual-parity-screenshots.js` | OUT_DIR создаётся до async body; `writeSummary()`; chromium try/catch |

### Закрытые CI issues

| Issue | Суть | Статус |
|-------|------|--------|
| #10 | Deploy to GitHub Pages (Visual Parity Guard failure chain) | ✅ Закрыт |
| #9 | IndexNow (зависит от Visual Parity Guard) | ✅ Закрыт |
| #7 | Visual Parity Guard — pixel-diff (41 комментарий) | ✅ Закрыт |
| #8 | Runtime Interactive Audit (12ч без реактивации) | ✅ Закрыт (recheck needed) |
| #6 | Source Link Audit (1 неделя без реактивации) | ✅ Закрыт (recheck needed) |

---

## 1. Сессия 2026-06-22 — восстановление направления

### Контекст

Агенты провели 2 недели активного рефакторинга (Nagornaya componentization, Gill Spravochnik promotion, Home fragment decomposition) но:
- Visual Parity Guard систематически падал, блокируя deploy
- Home page тянула stale reading times из Astro raw fragments
- CI failure issues накапливались без закрытия
- Аудит-документ (`gb-refactor-audit-living.md`) не был принят агентами как приоритет

### Root cause: Visual Parity Guard

Скрипт `scripts/visual-parity-screenshots.js` мог упасть до создания `reports/visual-parity/` если:
1. `chromium.launch()` падал (браузер не установлен)
2. Fatal error внутри async body

Результат: CI upload step не находил файлов → "No files were found", deploy skipping через `workflow_run` trigger.

### Исправления применены

1. `OUT_DIR` создаётся **до** async body — CI upload всегда найдёт папку
2. `writeSummary()` helper — `summary.json` пишется даже при chromium failure
3. Chromium launch обёрнут в try/catch с диагностикой + sentinel `failed=-1`
4. Retry loop делает `mkdirSync` defensive
5. Home stale reading times синхронизированы с canonical values (series.json, search-manifest.json)

---

## 2. Актуальные P0 (незакрытые после f5d36772)

### P0-X — "20 антисоветов" 40 vs 67 минут

**Статус:** частично исправлен. На live-странице article hero показывает 40 мин (article frontmatter), но catalog/related cards показывают 67 мин.

**Source-of-truth:** `data/series.json` → `pastor-series.parts[0].readingTime = 67`

**Что делать:** выбрать canonical value и синхронизировать. Рекомендация: 67 мин (серия total time), обновить article frontmatter.

**Команда:**
```bash
grep -rn "40.*мин\|67.*мин\|readTime.*40\|readTime.*67" articles/20-antisovetov-pastoru data/search-manifest.json
```

### P1 — "Э то" опечатка

**Статус:** ✅ НЕ ЯВЛЯЕТСЯ ОПЕЧАТКОЙ. В `about.html` используется drop-cap эффект: `<span class="h-drop-cap__letter" aria-hidden="true">Э</span>то не лента...`. Это корректная разметка. Видимое "Э то" на live — артефакт рендеринга drop-cap, не баг.

---

## 3. Следующие шаги (lane policy)

```
STOP: Параллельные componentization lanes без координации
START: Lane lock перед любым route

Active lanes после восстановления:
- lane/p0-antisovetov-time: синхронизировать 20-antisovetov readTime
- lane/visual-parity-fix: Visual Parity Guard CI восстановлен (f5d36772)
- lane/source-link-recheck: Source Link Audit (manual workflow_dispatch)
- lane/runtime-audit-recheck: Runtime Interactive Audit (manual workflow_dispatch)
```

---

## 4. Правила lane lock (обновлено)

Перед любой работой агент объявляет:

```md
Lane: <name>
Routes: <list>
Files allowed: <list>
Files forbidden: <list>
Source of truth: <file>
Required checks before commit: <list>
Rollback point: <commit>
```

**Запрещено:** ручное размножение readTime, titles, image src, script hash.
**Обязательно:** `npm run data:consistency` зелёный перед push.
