# ARENA SESSION MANUAL — полное выживание в песочнице

**Обновлено:** 2026-06-21  
**Предыдущая версия:** SANDBOX-ENV-2026-06-20.md (устарела)  
**Цель:** чтобы агент понимал среду с первой секунды и не тратил время на тыканье

---

## 0. АНАТОМИЯ ПЕСОЧНИЦЫ

Системный промт Arena Agent Mode декларирует исключения из workspace snapshot:

```
Исключены: .arena, .cache, .next, .npm, .nuxt, node_modules, dist,
           __pycache__, build, coverage, out, target
           .git/config, .git/credentials, .git-credentials, .netrc ← sensitive
```

**Что это значит на практике (ПРОВЕРЕНО ЭКСПЕРИМЕНТАЛЬНО):**

| Ресурс | После снапшота | Причина |
|--------|---------------|---------|
| Все файлы .ts/.js/.html/.md в `/home/user/repo/` | ✅ **СОХРАНЯЮТСЯ** | Не в списке исключений |
| `.git/config` (remote URL, credentials) | ❌ **УДАЛЁН** | В списке sensitive paths |
| `.git/objects/` (коммиты, история 1335 записей) | ✅ **СОХРАНЯЮТСЯ** | Не в sensitive paths |
| `.git/logs/`, `.git/refs/`, `.git/HEAD` | ✅ **СОХРАНЯЮТСЯ** | Не в sensitive paths |
| `node_modules/` | ❌ **УДАЛЁН** | В списке build-директорий |
| `dist/` | ❌ **УДАЛЁН** | В списке build-директорий |
| `.npm/`, `.cache/` | ❌ **УДАЛЁН** | В списке |
| `/tmp/*` | ❌ **УДАЛЁН** | Не workspace |
| `research/` | ✅ **СОХРАНЯЕТСЯ** | В workspace |
| `audit/`, `reports/`, `docs/` | ✅ **СОХРАНЯЕТСЯ** | В workspace |
| `/home/user/uploads/` | ❓ **НЕ ГАРАНТИРОВАНО** | Папка uploads может сбрасываться |

### Критическое следствие: git после восстановления

```bash
# РАБОТАЕТ (всегда):
git log --oneline -3     # ✅ история коммитов сохранена
git status                # ✅ состояние index сохранено
git diff                  # ✅ изменения сохранены
git show HEAD             # ✅ содержимое коммитов доступно

# НЕ РАБОТАЕТ (всегда):
git push                  # ❌ fatal: remote URL пропал из .git/config
git remote -v             # ❌ пусто
```

---

## 1. ПЕРВЫЕ 3 КОМАНДЫ В НОВОЙ СЕССИИ

```bash
# 1. Диагностика — понять где мы
cd /home/user/repo
echo "Node: $(node --version)"
echo "Git remote: $(git remote -v 2>/dev/null || echo 'NO REMOTE')"
echo "Last commit: $(git log --oneline -1)"

# 2. Если remote пропал — установить (ТОЛЬКО с токеном от пользователя)
git remote set-url origin "https://FedorMilovanov:${GH_TOKEN}@github.com/FedorMilovanov/gb-is-my-strength.git"

# 3. Если нужна сборка
export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH
```

### Как понять, сброшена сессия или нет

```bash
git log --oneline -1
# 0770f99c — та же сессия, remote работает
# 87fcc7b2 — СБРОС! remote пропал, нужен setup
# 5cc29a66 — СБРОС! (более старый)
# e116bec6 — СБРОС!
```

---

## 2. ПОЧЕМУ ПРОПАДАЮТ НАПИСАННЫЕ ФАЙЛЫ (`write_file`)

`write_file` — НЕ НАДЁЖЕН. Подтверждает успех, но файл может не появиться на диске.

**Проверено:** файл, созданный через `write_file`, может не существовать при следующем bash-запросе. Предположительно write_file пишет в staging area, которая сбрасывается между инструментами.

**Решение:** 
1. Использовать `bash` с `cat > file` вместо `write_file`
2. Любой важный файл — сразу в git commit + push в том же сообщении

```bash
# НЕПРАВИЛЬНО (файл пропадёт):
# write_file(path="docs/PLAN.md", content="...") ← может не сработать!

# ПРАВИЛЬНО:
cat > docs/PLAN.md << 'EOF'
содержимое
EOF
git add docs/PLAN.md
git commit -m "docs: plan"
git push origin main
```

---

## 3. ПОЧЕМУ АГЕНТЫ НЕ ВИДЯТ СКРИНШОТЫ

### Техническая причина

Системный промт: `read_file` с `path` изображения возвращает visible content **только если у модели есть vision**. У многих моделей (включая эту) **нет vision API**.

**Что агент БЕЗ vision может:**
- ✅ Проверить что файл существует: `ls -la uploads/`
- ✅ Получить метаданные: `file Screenshot_*.jpg`
- ✅ Попробовать OCR: `tesseract Screenshot_*.jpg stdout -l rus+eng`
- ❌ **НЕ может** увидеть, что нарисовано

**Решение:** описать скриншот словами, или переключиться на модель с vision.

---

## 4. GIT PUSH — ВСЕ РЕЖИМЫ ОТКАЗОВ (проверено в этой песочнице)

```text
ОШИБКА 1: fatal: Authentication failed
Почему: token неверный, истёк, или remote URL не обновлён
Решение: git remote set-url origin "https://user:token@github.com/..."

ОШИБКА 2: fatal: could not read Username: No such device
Почему: git запрашивает логин интерактивно, терминала нет
Решение: токен ОБЯЗАТЕЛЬНО в URL: https://user:token@github.com/...

ОШИБКА 3: fatal: not a git repository
Почему: .git целиком удалён
Решение: git clone https://github.com/...git

ОШИБКА 4: fatal: could not read from remote repository
Почему: сетевые проблемы в песочнице
Решение: повторить через 30 секунд

ОШИБКА 5: fatal: pathspec 'file' did not match any files
Почему: файл не создан (write_file не сработал)
Решение: использовать bash cat > file вместо write_file
```

### Push-сессия (проверена многократно, работает):

```bash
# Разовая настройка remote (каждый раз при сбросе)
git remote set-url origin "https://FedorMilovanov:${GH_TOKEN}@github.com/FedorMilovanov/gb-is-my-strength.git"

# Проверка
git remote -v

# Push
git push origin main

# Защита
unset GH_TOKEN
```

---

## 5. СТАРТОВЫЙ НАБОР (полный)

```bash
cd /home/user/repo

# 1. Git remote (ОБЯЗАТЕЛЬНО!)
git remote set-url origin "https://FedorMilovanov:${GH_TOKEN:?NO TOKEN}@github.com/FedorMilovanov/gb-is-my-strength.git"

# 2. Node 22
export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH
if ! node -e "process.exit(+!process.version.startsWith('v22'))" 2>/dev/null; then
  wget -q https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-x64.tar.xz -O /tmp/node22.tar.xz
  tar -xf /tmp/node22.tar.xz -C /tmp/
  export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH
fi

# 3. Зависимости
npm install --no-audit --no-fund

# 4. Playwright (только если нужны скриншоты)
npx playwright install chromium 2>/dev/null &

# 5. Сборка
npm run strangler:build:production-like

# 6. Проверка
node scripts/audit-pro.js | grep PASSED
```

---

## 6. ЗАПРЕТЫ

- ❌ Писать токен в файл
- ❌ Оставлять токен в env после push (`unset GH_TOKEN`)
- ❌ Пушить без audit-pro
- ❌ Менять visual baseline без owner approval
- ❌ Править Avraam (protected audit 28/28)
- ❌ Удалять research/ и docs/
- ❌ Плодить CSS/JS файлы без проверки AGENTS.md

---

## 7. ФАКТЫ О ПРОЕКТЕ (для быстрого входа)

- **1335 коммитов**, 52 production pages, 51 shadow-wrap, 3 native
- **audit-pro.js**: 4384 строк, 95+ guards (G1-G113)
- **check-mdx-html-parity.js**: новый guard (0770f99c)
- **CSS**: 270 !important в site.css — задача Refactoring 6.0
- **site.js**: 5129 строк, 130+ listeners без cleanup — задача 6.0
- **MapEngine**: 3 пути рендеринга (Avraam + v1 + v2 planned)
- **AGENTS.md**: 237KB — читать перед любой правкой кода
- **README.md**: 42KB — архитектурная документация

---

## 8. БЫСТРЫЕ КОМАНДЫ

```bash
node scripts/audit-pro.js                     # аудит
npm run content:parity                         # MDX vs HTML parity
npm run validate:static-publication             # полная валидация
npm run maps:validate && npm run avraam:audit  # карты
npm run strangler:build:production-like        # сборка
git remote set-url origin "https://user:token@github.com/...git"  # push setup
git push origin main                           # пуш
```

---

## 9. ИСТОРИЯ

| Дата | Версия | Изменения |
|------|--------|-----------|
| 2026-06-20 | v1 | Первая версия (263 строки) |
| 2026-06-21 | v2 | Анатомия снапшота, скриншоты, write_file, push-ошибки, сессии |
