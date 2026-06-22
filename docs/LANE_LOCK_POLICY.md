# Lane Lock Policy — координация параллельных агентов

**Версия:** 1.0 · 2026-06-22  
**Цель:** не допустить одновременной работы двух агентов в одном route/lane.  
**Без lane lock — регресс.** Агенты перезаписывают друг другу файлы → данные теряются, CI падает, читатели видят сломанный сайт.

---

## 0. Почему lane lock критичен

В этом проекте:
- Один route (например `/nagornaya/chast-1/`) состоит из **15+ файлов**: page.astro, PageChrome.astro, MainShell.astro, PageFooter.astro, _legacy/*.html, guard.js, visual-parity-audit.js, pagefind body, CSS, JS, data/*.json, и т.д.
- Агент A может менять `NagornayaChast1PageChrome.astro` в то же время, что агент B меняет `NagornayaChast1MainShell.astro`. Оба думают что владеют route, но пересекаются через _legacy fragments и data/series.json.
- Без lane lock: дублирующие коммиты, race conditions в CI, рассинхрон данных.

**Правило:** lane lock **обязателен** для любой работы длиннее 3 минут или затрагивающей более 1 файла.

---

## 1. Формат lane declaration

Перед началом работы агент **объявляет lane в комментарии коммита или PR**:

```
Lane: lane/nagornaya-chast-4-phase2
Routes: /nagornaya/chast-4/
Files allowed:
  - src/pages/nagornaya/chast-4/index.astro
  - src/components/nagornaya/chast-4/NagornayaChast4MainShell.astro
  - src/components/nagornaya/chast-4/_legacy/body-segment-1.html
Files forbidden:
  - data/series.json
  - src/components/home/**
  - src/pages/biografii/**
Source of truth:
  - data/series.json (readTime values)
  - src/pages/nagornaya/chast-4/index.astro (page ownership)
Required checks before commit:
  - npm run nagornaya:visual-parity:audit
  - npm run data:consistency
  - rg "21 мин|35 мин|40+ мин|100+ мин" src/components/nagornaya
Rollback point: b8d0ac60
```

---

## 2. Git branch — основной механизм lane lock

### 2.1 Один агент = один branch = один lane

```
main  ────────────── (стабильный, только merge)
  │
  ├── lane/gill-spravochnik-sections   ← Agent A
  ├── lane/nagornaya-chast-4-phase2   ← Agent B
  └── lane/home-readtime-hotfix       ← Agent C
```

**Как работает:**

1. Агент создаёт branch от актуального `main`
2. Объявляет lane в описании branch или в первом commit message
3. Другой агент проверяет существующие branches перед созданием своего
4. После завершения lane — PR в `main` с review от другого агента

### 2.2 Branch naming convention

```
lane/<route-or-feature>-<phase>
```

Примеры:
- `lane/gill-spravochnik-sections` — Gill Spravochnik section promotion
- `lane/nagornaya-chast-4-phase2` — Nagornaya chast-4 body sections
- `lane/home-source-of-truth-hotfix` — Home readTime fix
- `lane/visual-parity-guard-fix` — Visual parity CI hardening
- `lane/antisovetov-readtime` — 20-antisovetov readTime sync

**Запрещённые имена:** `agent-1`, `work`, `fix`, `refactor`, `update`

### 2.3 Кто какой lane выбирает

**Правило:** первый агент, объявивший lane в Git, владеет им.

Агенты координируются через:
1. **GitHub branch list** — посмотреть существующие branches перед работой
2. **AGENTS.md header** — проверить текущие записи rNNN на активные lanes
3. **docs/refactor-2026/REFRACTOR_AUDIT_LIVING.md** — живой аудит документ

Если два агента одновременно объявили один lane — **стейкается меньший**. Тот кто начал позже — выбирает новый lane или ждёт завершения первого.

---

## 3. File ownership — кому что можно менять

### 3.1 Route-owned files (только владелец lane)

Для route `/nagornaya/chast-4/` владелец lane может менять:

```
src/pages/nagornaya/chast-4/index.astro          — page shell
src/components/nagornaya/chast-4/*.astro          — Astro components этого route
src/components/nagornaya/chast-4/_legacy/*.html   — _legacy fragments этого route
scripts/nagornaya-chast-4-visual-parity-audit.js — guard этого route
```

### 3.2 Shared files (требуют отдельного lane или согласия владельца)

**Запрещено** менять без отдельного lane:

```
data/series.json           — readTime для всех серий
data/search-manifest.json  — search index
data/public-content-baseline.json — URL contract
src/components/home/**     — home page components
src/components/article-pilots/gill-context/** — Gill shared chrome
scripts/check-data-consistency.js  — глобальный guard
scripts/audit-pro.js              — глобальный audit
scripts/visual-parity-screenshots.js — Visual parity gate
AGENTS.md                        — журнал агентов
package.json                     — npm scripts
.github/workflows/*.yml          — CI/CD
```

### 3.3 Read-only для всех (если не объявлен专门的 lane)

```
docs/EDITORIAL-SOURCE-POLICY.md
docs/QUALITY_GATES_AND_TESTING_QUALITY.md
migration/page-ownership.json    — только через lane/migration
```

---

## 4. Сценарии параллельной работы

### Scenario A: 2 агента, разные routes — OK

```
Agent A: lane/gill-spravochnik-sections     (/articles/dzhon-gill-spravochnik/)
Agent B: lane/nagornaya-chast-4-phase2      (/nagornaya/chast-4/)

→ Нет конфликта. Оба работают параллельно.
→ Обязательно: проверить что routes не пересекаются через shared data.
```

### Scenario B: 2 агента, один route — стейк

```
Agent A: lane/gill-spravochnik-sections     (route: Gill Spravochnik)
Agent B: lane/gill-spravochnik-body-sections (route: Gill Spravochnik)

→ КОНФЛИКТ. Второй агент должен либо:
   1. Взять подlane (e.g. lane/gill-spravochnik-body-sections)
   2. Ждать завершения Agent A
   3. Договориться о разделении: A делает chrome, B делает body
```

### Scenario C: 2 агента, разные routes, но общий shared файл

```
Agent A: lane/gill-spravochnik-sections    (меняет data/series.json)
Agent B: lane/nagornaya-chast-4-phase2     (тоже хочет менять data/series.json)

→ КОНФЛИКТ. Один из них должен:
   1. Взять lane/shared-data (отдельный lane для data/ изменений)
   2. Договориться о порядке: A фиксирует данные → коммитит → B мержит → продолжает
   3. Использовать PR review: A создаёт PR → B-reviewer → merge → B продолжает
```

---

## 5. Как 2 агента координируются через GitHub

### 5.1 Перед началом работы

Каждый агент **всегда** делает:

```bash
# 1. Fetch latest
git fetch origin

# 2. Проверить существующие branches
git branch -a | grep lane/

# 3. Проверить AGENTS.md на активные lanes
rg "AGENTS-r[0-9]+" AGENTS.md | head -5

# 4. Проверить живой аудит
cat docs/refactor-2026/REFRACTOR_AUDIT_LIVING.md | grep "^Lane:"

# 5. Если lane свободен — создать branch и объявить
git checkout -b lane/my-lane-name
git push -u origin lane/my-lane-name
```

### 5.2 После завершения lane

```bash
# 1. Все checks зелёные?
npm run data:consistency && npm run validate:static-publication

# 2. Squash в один commit с lane declaration
git rebase -i HEAD~10  # squash into 1-2 commits

# 3. Merge в main (через PR или direct push если разрешено)
git checkout main
git merge lane/my-lane-name --no-ff -m "Lane: lane/my-lane-name completed"

# 4. Удалить branch
git branch -d lane/my-lane-name
git push origin --delete lane/my-lane-name

# 5. Обновить AGENTS.md с результатом
# (добавить запись rNNN о выполненном lane)
```

---

## 6. Lane declaration в commit messages

Каждый коммит в lane **должен** содержать lane reference:

```
[LANE lane/gill-spravochnik-sections] refactor(gill): promote section 3 to Astro
[LANE lane/nagornaya-chast-4-phase2] fix(gill-reading-time): correct mobile sheet times
[LANE lane/home-readtime-hotfix]    fix(home): sync Gill I readTime to 28 мин
```

Это позволяет:
- Быстро понять какой lane делает какую работу
- Найти связанные коммиты через `git log --grep="LANE lane/"`
- Откатить целый lane через `git log --grep="LANE lane/X" | git revert`

---

## 7. Conflict detection — как понять что lane пересекается

### Автоматически (перед коммитом)

```bash
# Проверить что не меняешь shared files других lanes
rg "data/series.json|data/search-manifest.json|package.json" --files-with-matches | \
  xargs git diff --name-only | head -5

# Если вывод не пустой — ты трогаешь shared files, нужен отдельный lane
```

### Визуально (перед созданием branch)

```bash
# Показать все recent lane branches
git for-each-ref --sort=-committerdate refs/heads/lane/ --format='%(committerdate:short) %(refname:short) %(subject)'

# Проверить что твой route не в чужих files allowed
# (если чужой lane меняет _legacy файлы твоего route — конфликт)
```

---

## 8. Rollback — как откатить lane

Если lane сломал production:

```bash
# Найти все коммиты lane
git log --grep="LANE lane/broken-lane" --oneline

# Откатить весь lane одним revert
git revert $(git log --grep="LANE lane/broken-lane" --format=%H | head -1)

# Или через squash-merge
git checkout main
git merge --squash lane/broken-lane
git reset --hard HEAD~1
```

---

## 9. Emergency lane для срочных hotfix

Если нужен срочный fix (например, опечатка на production):

```
Lane: lane/emergency-hotfix
Scope: только исправление критической ошибки
Files allowed: только конкретные файлы ошибки
Duration: максимум 2 коммита
Review: после merge в main, уведомить всех агентов в Slack/Chat
```

Emergency lanes **не блокируют** другие lanes, но должны быть merge в main как можно быстрее.

---

## 10. Чеклист перед началом работы агента

```bash
□ Я проверил существующие branches: git branch -a | grep lane/
□ Я проверил AGENTS.md на активные lanes
□ Я проверил docs/refactor-2026/REFRACTOR_AUDIT_LIVING.md
□ Я выбрал свободный lane name и объявил его в первом commit message
□ Я определил files allowed / files forbidden
□ Я выбрал source of truth file(s)
□ Я знаю rollback point (последний стабильный коммит)
□ Я проверил что НЕ трогаю shared files без отдельного lane
□ Я напишу [LANE lane/X] в каждом commit message
□ После завершения: npm run data:consistency && npm run validate:static-publication
□ После завершения: обновить AGENTS.md с результатом
□ После завершения: удалить branch и push в main
```

---

## Краткая шпаргалка: Lane Lock в 3 шага

```
Шаг 1. Перед работой:
  → git fetch && git branch -a | grep lane/
  → Выбрать lane name → git checkout -b lane/name

Шаг 2. Во время работы:
  → [LANE lane/name] в каждом commit message
  → Не трогать shared files без отдельного lane
  → Перед push: npm run data:consistency

Шаг 3. После завершения:
  → npm run validate:static-publication
  → git merge --no-ff lane/name в main
  → Обновить AGENTS.md
  → git branch -d lane/name
```
