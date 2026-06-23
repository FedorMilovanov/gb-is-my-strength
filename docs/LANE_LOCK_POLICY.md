# Lane Lock Policy — FAST / LANE / SYSTEM

**Дата:** 2026-06-23  
**Версия:** 2.0 (упрощено по `AGENT_PROTECTION_SIMPLE_v3_0`)

См. также: [docs/WORK_MODES.md](docs/WORK_MODES.md)

---

## 0. Зачем lane lock

Без lane lock параллельные агенты перезаписывают друг друга в shared/route файлах → регрессия, CI падает, сайт ломается.

---

## 1. Три режима

- **FAST** — один агент, маленькая правка, без shared/system файлов. Можно в main.
- **LANE** — route/refactor/много файлов. Ветка `lane/<name>`.
- **SYSTEM** — shared/global/high-risk. Ветка `lane/system-<name>` или `lane/protection-*`.

---

## 2. Branch naming

```text
lane/<route-or-feature>-<phase>
lane/system-<task>
lane/shared-<data-fix>
lane/protection-<version>
```

Примеры:

```text
lane/nagornaya-componentization
lane/system-astro-head-native
lane/shared-readtime-sync
lane/protection-simple-v3-0
```

---

## 3. Lane declaration

Перед работой объявить в первом commit message или в PR:

```text
Lane: lane/<name>
Routes: <list>
Files allowed: <list>
Files forbidden: <list>
Source of truth: <file>
Required checks before commit: <list>
Rollback point: <commit>
```

Каждый commit в lane должен содержать:

```text
[LANE lane/<name>] <type>(<scope>): <message>
```

---

## 4. Правила lane

1. Один route — один владелец lane.
2. Если два агента хотят один route — второй берёт под-lane или ждёт.
3. Route lane не трогает SYSTEM files.
4. SYSTEM lane не трогает production routes/content.
5. Shared data — только через `lane/shared-*` или `lane/system-*`.
6. Out-of-lane проблемы записываем, не исправляем сразу.

---

## 5. Out-of-lane finding

```md
## Out-of-lane finding

Lane: lane/my-lane

Нашёл:
- data/series.json: возможно устарел readTime.

Не исправлял:
- это shared data.

Предложение:
- lane/shared-readtime-sync
```

---

## 6. Lane index

Активные lanes ведутся в:

```text
docs/refactor-2026/lanes/README.md
```

Шаблон отчёта:

```text
docs/refactor-2026/lanes/TEMPLATE.md
```

---

## 7. Чеклист перед началом

```text
□ Проверить существующие branches: git branch -a | grep lane/
□ Проверить lane index: docs/refactor-2026/lanes/README.md
□ Проверить живой аудит: docs/refactor-2026/REFRACTOR_AUDIT_LIVING.md
□ Выбрать свободный lane name
□ Определить files allowed / forbidden
□ Знать source of truth и rollback point
□ [LANE lane/<name>] в каждом commit message
```

---

## 8. Merge и cleanup

```bash
# 1. Checks зелёные
npm run data:consistency
npm run validate:static-publication

# 2. Merge в main
git checkout main
git merge lane/<name> --no-ff

# 3. Lane report (не AGENTS.md!)
# docs/refactor-2026/lanes/<lane-name>.md

# 4. Удалить branch
git branch -d lane/<name>
git push origin --delete lane/<name>
```

`AGENTS.md` обновляет только интегратор после волны lanes.
