from __future__ import annotations

from pathlib import Path


AGENTS = Path("AGENTS.md")
OWNER = Path("docs/OWNER-INVARIANTS.md")


def replace_between(text: str, start_marker: str, end_marker: str, replacement: str, *, label: str) -> str:
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f"{label}: start marker not found: {start_marker!r}")
    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit(f"{label}: end marker not found: {end_marker!r}")
    return text[:start] + replacement.rstrip() + "\n\n" + text[end:]


agents = AGENTS.read_text(encoding="utf-8")

preflight = r'''## 🚦 Читать перед работой — единый pre-flight

> Этот раздел определяет порядок входа в задачу. Подробные правила находятся в
> `docs/WORK_MODES.md`, `docs/LANE_LOCK_POLICY.md` и `docs/OWNER-INVARIANTS.md`.
> При расхождении старой формулировки с этими документами действует более новый
> owner-approved контракт и текущий `main`.

### Обязательная последовательность

Перед любой правкой агент обязан:

1. **Проверить живое состояние GitHub:** открытые issues/PR, активные ветки, текущий
   `main`, точные файлы пересечения и rollback SHA. Старое имя ветки, закрытый PR или
   сохранённый lane-report сами по себе не означают активное владение.
2. **Прочитать `docs/WORK_MODES.md`.** Канонические режимы: `FAST`, `LANE`, `SYSTEM`.
   Любая mutation выполняется в отдельной ветке и PR; FAST определяет объём проверки,
   а не разрешение писать прямо в `main`.
3. **Прочитать `AGENTS.md` полностью.** Особенно архитектурные ограничения,
   protected-подсистемы и владельческие инварианты.
4. **Прочитать `docs/LANE_LOCK_POLICY.md`.** Объявить владельца, разрешённые и
   запрещённые файлы, проверки, зависимости и rollback point.
5. **Прочитать `docs/OWNER-INVARIANTS.md`.** Owner-sensitive контент, данные и UI
   нельзя переопределять по историческому снимку или личному вкусу агента.
6. **Для route/registry-задачи проверить первичные источники:**
   `migration/page-ownership.json` и соответствующий `data/route-profiles/*.json`.
   `migration/route-migration-matrix.json` — производный артефакт; его не редактируют
   вручную для добавления или изменения route.
7. **Для внешних проверок прочитать `audit/external-checks/README.md`.** Текущий
   `npm run workflows:lint` с checksum-verified actionlint является каноническим
   blocking gate; решения по другим инструментам берутся из актуального registry.
8. **Проверить среду фактически.** Версия Node, доступные CPU/RAM/диск, сеть,
   Playwright-браузеры, сохранность файлов и возможности редактора определяются
   live-discovery в текущей сессии. `SANDBOX-ENV-2026-06-21.md` — исторический
   справочник по известным ловушкам, а не универсальная спецификация любой среды.

### Минимальная декларация lane

```md
Mode: FAST | LANE | SYSTEM
Lane: <branch>
Issue/PR: <number>
Routes: <bounded list or none>
Files allowed: <bounded list>
Files forbidden: <list>
Source of truth: <current files / exact SHA>
Required checks: <commands / browser profiles>
Rollback point: <exact main SHA>
Dependencies: <open PRs / owner decisions>
```

### Три уровня доказательства

1. **Iteration evidence** — `git diff --check` и релевантные быстрые контракты.
2. **Exact-head PR evidence** — обязательные checks именно на финальном SHA PR.
3. **Production witness** — отдельное подтверждение deploy/live SHA; зелёный PR не
   является автоматически доказательством продакшена.

Для docs-only SYSTEM PR допустим суженный final barrier, если diff не может влиять
на runtime/build. При этом обязательны Shared Files Guard, проверка ссылок/согласованности
политик и явное описание границы проверки в PR.

---

| **AGENTS-r324** | 2026-07-24 | **Owner governance reconciliation (#219).** Установлен единый контракт FAST/LANE/SYSTEM с обязательными branch+PR, live GitHub ownership discovery, первичностью `page-ownership` + route profiles над производной route matrix, live-discovery среды, checksum-verified actionlint и разделением iteration / exact-head CI / production witness. Исторические sandbox-снимки и pre-v16 UI-детали больше не трактуются как универсальная текущая архитектура; owner-sensitive защиты и data hard-lock сохранены. |'''

agents = replace_between(
    agents,
    "## 🚦 Читать перед работой — порядок обязательных документов",
    "| **AGENTS-r323**",
    preflight,
    label="AGENTS preflight",
)

work_modes = r'''## Work Modes — определи режим перед работой

Канонические документы:

- [docs/WORK_MODES.md](docs/WORK_MODES.md) — режимы и объём проверок;
- [docs/LANE_LOCK_POLICY.md](docs/LANE_LOCK_POLICY.md) — владение, пересечения,
  merge/cleanup и forensic disposition;
- [docs/OWNER-INVARIANTS.md](docs/OWNER-INVARIANTS.md) — неизменяемые без решения
  владельца требования;
- [docs/refactor-2026/lanes/README.md](docs/refactor-2026/lanes/README.md) — навигация,
  но не самостоятельный backlog;
- открытые GitHub issues/PR и текущий `main` — живая операционная правда.

### Режимы

| Mode | Назначение | Branch/PR | Минимальная граница |
|---|---|---|---|
| **FAST** | Одна ограниченная low-risk правка без shared runtime ownership | обязательно | `git diff --check` + целевой контракт |
| **LANE** | Route/feature/refactor с именованным владельцем | обязательно | targeted checks + route/browser/visual evidence |
| **SYSTEM** | Shared/global/control-plane/governance | обязательно, отдельно от контента | shared/control-plane gates + exact-head barrier |

Прямой push в `main` не является обычным FAST-путём. Он допустим только как явно
разрешённая владельцем emergency-операция с немедленной exact-head проверкой и
последующей reconciliation-записью.

### Перед началом

```text
□ Проверить открытые PR/issues и пересекающиеся файлы
□ Зафиксировать текущий main и rollback SHA
□ Объявить allowed / forbidden files
□ Выбрать FAST, LANE или SYSTEM
□ Указать первичный source of truth
□ Назначить iteration checks и final exact-head barrier
□ Отделить source completion от production witness
```

### Route authority

Для route-режима первичны `migration/page-ownership.json` и
`data/route-profiles/*.json`. `migration/route-migration-matrix.json` генерируется
через `node scripts/sync-route-migration-matrix.js --write` и не правится вручную.
Канонический набор migration modes: `strict-native`, `strict-native-app`,
`legacy-shadow-app`.

### Проверки

```bash
# FAST iteration

git diff --check
# + один или несколько релевантных контрактов

# LANE / shared iteration

git diff --check
npm run guard:shared-files
npm run data:consistency
npm run migration:metadata:check
# + route/browser/visual/source checks

# SYSTEM / control plane

git diff --check
npm run guard:shared-files
npm run workflows:check
npm run control-plane:audit
npm run workflows:lint

# Final barrier для production/shared/refactor/system impact
npm run validate:static-publication
npm run guard:shared-files
```

Docs-only SYSTEM PR может не запускать полный production build, когда это технически
не связано с diff. Тогда PR обязан доказать отсутствие runtime/workflow изменений,
пройти Shared Files Guard и все применимые governance/control-plane checks.

### Shared / High-Risk поверхность

К SYSTEM относятся как минимум:

```text
AGENTS.md
README.md
package.json / package-lock.json
.github/workflows/**
docs/WORK_MODES.md
docs/LANE_LOCK_POLICY.md
docs/OWNER-INVARIANTS.md
docs/AGENT_PUSH_MODEL.md
migration/**
data/series.json
data/search-manifest.json
data/public-content-baseline.json
src/layouts/**
css/** / js/**
sw.js
karty/_engine/**
scripts, определяющие repository/release policy
```

Каталог `docs/` не является автоматически свободной зоной: устаревшая инструкция
может направить следующих агентов на разрушительную операцию.

### Пересечения и cleanup

- Один route/shared surface — один активный владелец.
- Второй агент берёт непересекающийся sub-lane или ждёт.
- Out-of-lane дефект фиксируется в issue/forensic register, а не чинится попутно.
- Перед удалением ветки её содержимое классифицируется: represented, diagnostic,
  superseded with verified chain, archive-worthy или selective recovery.
- В финальном дереве не остаются временные workflow, trigger, writer или patcher.
- `AGENTS.md` меняется только в owner-authorized SYSTEM lane, а не после каждой задачи.

'''

agents = replace_between(
    agents,
    "## Work Modes — определи режим перед работой",
    "Older changelog rows **AGENTS-r77–r131**",
    work_modes,
    label="AGENTS work modes",
)

replacements = {
    "**Source of truth:** `AuditRepo/projects/<project>/PremiumControls/README.md` + owner instructions + VR history":
        "**Source of truth:** current `main`, current owner decision and exact-head browser/visual guards. AuditRepo and VR history provide provenance and reverify evidence; they do not override newer owner-approved source contracts.",
    "**DO NOT (without owner + full visual gate + 14-day freeze):**":
        "**DO NOT without a dedicated owner-authorized LANE/SYSTEM PR and exact-head visual/browser evidence:**",
    "- 10-14 day freeze after sign-off on positioning/sizes.":
        "- После owner sign-off защищается точный одобренный baseline и текущие guards; дальнейшее изменение требует новой доказательной серии, а не ожидания произвольного календарного срока.",
}
for old, new in replacements.items():
    count = agents.count(old)
    if count != 1:
        raise SystemExit(f"AGENTS protected subsystem: expected one occurrence of {old!r}, found {count}")
    agents = agents.replace(old, new)

# Fail closed on the concrete contradictions recorded in issue #219.
for stale in (
    "SOLO/MULTI-AGENT/HIGH-RISK/EMERGENCY",
    "Один → SOLO (main разрешён",
    "**Всегда разрешено:** docs/",
    "actionlint, osv-scanner — известные проблемы",
    "2 CPU ~2 GB RAM",
    "Файлы сохраняются между сессиями (ext4)",
    "native / native-with-legacy-head / strict-native",
    "10-14 day freeze after sign-off",
):
    if stale in agents:
        raise SystemExit(f"stale governance phrase survived: {stale!r}")

if agents.count("AGENTS-r324") != 1:
    raise SystemExit("AGENTS-r324 marker must occur exactly once")

owner = r'''# OWNER INVARIANTS — канонический список инвариантов владельца

**Updated:** 2026-07-24  
**Owner decision:** issue #219

> Этот файл хранит устойчивые требования владельца, а не снимок конкретной ветки,
> sandbox-сессии или UI-итерации. Менять его можно только по прямому решению владельца
> в отдельном SYSTEM PR с exact-head проверкой.

## 1. Порядок авторитета

При конфликте используются, по убыванию силы:

1. прямое текущее решение владельца;
2. текущий `docs/OWNER-INVARIANTS.md` и нормативные разделы `AGENTS.md`;
3. текущий `main`, открытые PR/issues и exact-head CI;
4. текущие `WORK_MODES`, `LANE_LOCK_POLICY`, source registries и guards;
5. AuditRepo как канон подтверждённого backlog/reverify evidence;
6. исторические PR, отчёты, sandbox-документы и старые visual baselines.

Исторический документ не становится вечным инвариантом только из-за того, что когда-то
был каноническим. Одновременно новый агент не вправе отменять owner-sensitive правило
только потому, что оно старое.

## 2. Контент и правда

1. **Никакой правдоподобной лжи.** Квизы, «Коротко», числовые заявления, цитаты,
   имена и подписи берутся из фактического текста или заявленного источника. Визуальный
   или Astro↔legacy паритет не доказывает фактологическую истинность.
2. **Свежесть не подделывается.** CSS/JS/технические коммиты не меняют
   `article:modified_time`, `dateModified` и sitemap `lastmod`. Дата обновляется только
   при значимом редакционном изменении.
3. **Цитаты Писания дословны по заявленному изданию** (по умолчанию Синодальный).
   Пересказ или модернизация не выдаются за прямую цитату.
4. **Авторство:** `Автор-редактор` для типов A/B и `Редактор` для типа C. Формулировку
   `Автор: Фёдор Милованов` и удалённый AI-disclosure не восстанавливать.

## 3. UI и владельческие зоны

5. **PremiumControls / Floating Cluster / Gill остаются owner-sensitive.** Запрещены
   самовольный редизайн, перенос контролов, изменение смысловой иерархии, ослабление
   accessibility/keyboard/TTS контрактов и обход текущих visual/browser guards.

   При этом исторический `pre-v16` submenu, rounded-frame или иной старый снимок — это
   provenance, а не бессрочная архитектурная истина. Он обязателен только если закреплён
   текущим owner decision, текущим source contract или exact-head blocking guard.
   Полезное изменение проводится отдельным owner-authorized lane с side-by-side evidence;
   blanket freeze и календарный срок сами по себе не заменяют проверку.
6. **Глоссарий и Bible tooltips — owner-controlled data.** Массовые правки
   `data/glossary.json`, `data/verses.json`, `data/bible/` агентами запрещены без
   отдельного решения. `.summary-card` остаётся plain-text hard lock.
7. **Визуальный контракт нельзя ухудшать.** Нужны текущие screenshots, browser checks
   и owner review; фраза «выглядит нормально» не является доказательством.
8. **Изображения владельца не заменяются AI-генерациями** без прямого запроса.

## 4. Процесс и доверие

9. **Все обычные изменения идут через branch + PR.** FAST означает малый scope,
   а не прямой push в `main`. Emergency direct-main требует явного решения владельца,
   немедленной exact-head проверки и reconciliation.
10. **Production-like green не равен финальному green.** До merge проверяется финальный
    SHA PR; deploy/live witness фиксируется отдельно и не подменяется source-CI.
11. **Зелёный шаг workflow не равен доказательству.** Допуски `continue-on-error`,
    `|| true`, skipped jobs и bot-commits анализируются явно. Закрытие требует fixture,
    fix, применимых gates и immutable SHA.
12. **Каноническая правда аудита — текущий AuditRepo**, прежде всего
    `verified/MASTER_BUG_MATRIX.md` и актуальные verified ledgers/recovery evidence.
    `SUPER_AUDIT_2026-07-06_14a49be8.md` сохраняется как важный исторический baseline,
    но не является единственным или автоматически самым свежим источником.
13. **Среда определяется live-discovery.** Старый sandbox-документ полезен как список
    известных ловушек, но не гарантирует текущие CPU/RAM, persistence, сеть, редактор
    или установленные браузеры.
14. **Временная автоматика не переживает свою транзакцию.** Writer, materializer,
    trigger, patcher и workflow удаляются до финального exact-head merge proof.
'''

AGENTS.write_text(agents, encoding="utf-8")
OWNER.write_text(owner, encoding="utf-8")

print("owner governance reconciled")
