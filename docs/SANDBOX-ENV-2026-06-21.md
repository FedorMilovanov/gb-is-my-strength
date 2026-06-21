# ARENA SESSION MANUAL — выживание в песочнице

**Обновлено:** 2026-06-21  
**Версия:** v6 (merged from 06-20 + 06-21 verified facts)  
**Среда:** Arena.ai Agent Mode — Linux ext4, 2 CPU, 1.9GB RAM

---

## 0. ЭКСПЕРИМЕНТАЛЬНО ПРОВЕРЕНО (факты, не догадки)

```
✅ Файлы СОХРАНЯЮТСЯ при падении сессии (ext4, не tmpfs)
✅ git remote СОХРАНЯЕТСЯ при падении (но токен в URL — нет, используй env var)
✅ git log/history СОХРАНЯЕТСЯ
✅ write_file РАБОТАЕТ (но иногда не синхронизируется с bash в той же сессии)
✅ python3 -c РАБОТАЕТ
✅ sed -i РАБОТАЕТ (всегда)
❌ edit_file ЧАСТО ПАДАЕТ (используй sed -i или python3)
❌ read_file гигантских файлов >500KB может упасть
❌ Теряется только НЕДОПИСАННЫЙ ответ агента (середина сообщения)
```

## 0.5 ВНЕШНИЕ РЕФЕРЕНСЫ (неподтверждённые данные из поиска, 2026-06-21)

- **Qwen Code Arena docs** (qwenlm.github.io): `maxRoundsPerAgent` default = 50, `timeoutSeconds` = 600.
  Применимость к Arena.ai неподтверждена, но если похожая архитектура — лимит ~50 раундов/итераций,
  не 3 tool calls за turn. Tool calls внутри одного turn могут быть параллельными (Smart Tool Parallelism).
- **Reddit r/lmarena**: пользователи сообщают о баге — нельзя удалить чат в agent mode.
  Также неясно, какая именно модель/провайдер обрабатывает запрос (8B vs 1T+ параметров).
- **Вывод для агентов**: лимит — не количество tool calls за turn, а общее количество раундов (turns)
  + context window + timeout. Практика: 1-2 tool calls + короткий ответ = меньше токенов за раунд,
  что позволяет больше раундов до переполнения context window.

## 1. Главное: версии и обходные пути

| Компонент | Реальная версия | Нужная версия | Workaround |
|---|---|---|---|
| Node.js | **20.20.2** (default) | **22.12.0+** (для Astro 6) | Скачать бинарь: `wget -q https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-x64.tar.xz -O /tmp/node22.tar.xz && tar -xf /tmp/node22.tar.xz -C /tmp/ && export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH` |
| Playwright Chromium | требуется v1223 (или v1228) | любая | `npx playwright install chromium` (~115 MB, ~30 сек). Делать ПОСЛЕ `npm install` — он сам подберёт нужную версию |
| Python (для static server) | 3.13 | любой | `python3 -m http.server PORT --bind 127.0.0.1 --directory DIR` |
| Bash | 5.x | любой | работает нормально |

**Каждая новая сессия → надо ставить заново.** `dist/`, `node_modules/`, `/tmp/node-v22*`, `~/.cache/ms-playwright/` — НЕ переживают между сессиями.

---

## 2. Astro build — почему падает и как чинить

Astro 6 REFUSES запускаться на Node 20:
```
Node.js v20.20.2 is not supported by Astro!
Please upgrade Node.js to a supported version: ">=22.12.0"
```

**Решение (3 команды):**
```bash
cd /home/user/gb-is-my-strength
export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH
npm run astro:build  # или npm run strangler:build:production-like
```

После этого `dist/` создаётся, 52 страницы собираются за ~10 сек.

---

## 3. Playwright quirks

### 3.1 Версия Chromium
- npm install ставит Playwright 1.60+
- Playwright 1.61+ требует chromium-headless-shell v1223 или v1228
- При первом `npm install` Playwright **НЕ** скачивает браузер автоматически
- Нужно отдельный шаг: `npx playwright install chromium`

### 3.2 Алиас пути
По умолчанию Playwright ставит в `~/.cache/ms-playwright/`. Если запустить `npx playwright install` ДО `npm install`, будет конфликт версий. **ПОРЯДОК:**
1. `npm install` (ставит Playwright в node_modules)
2. `npx playwright install chromium` (скачивает нужный браузер)

### 3.3 Lazy-load protection в visual-parity скриптах
`scripts/visual-parity-screenshots.js` (324 строк) делает:
- `img.loading = 'eager'` + `img.decode()` — чтобы lazy-load не врал
- bottom→top scroll для trigger IntersectionObserver
- `waitForLoadState('networkidle')` + повторный после scroll
- `animation: none !important` инжектится inline style tag

Без этих защит первый прогон pixel-diff выдаёт ложные красные пятна. **Не "упрощай"** этот скрипт.

### 3.4 Ошибка которую я ловил
```
FATAL browserType.launch: Executable doesn't exist at /home/user/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell
```
**Причина:** Playwright 1.61 хочет v1223, после `npm install` Playwright обновился до версии, требующей другую версию браузера.  
**Решение:** `npx playwright install chromium` (он скачает нужную).

---

## 4. Static server для Playwright

`python3 -m http.server 8091 --bind 127.0.0.1 --directory dist &` — НО:

### 4.1 Cwd проблема (#1 причина 404)
Если запустить БЕЗ `--directory`, сервер стартует от `/home/user/gb-is-my-strength` (cwd). Нужно **явно**:
```bash
nohup python3 -m http.server 8091 --bind 127.0.0.1 --directory dist > /tmp/server.log 2>&1 &
```
Иначе cwd может измениться между сессиями и сервер будет показывать не то.

### 4.2 Cwd "deleted" проблема (#2 причина 404)
В этом sandbox сервер Python сохраняет cwd через `/proc/$PID/cwd`. Если файл/директория cwd **была пересоздана** (например, sandbox cleanup), то `/proc/$PID/cwd` указывает на `(deleted)`. Сервер тогда отдаёт 404 на все пути, **даже если файл существует**.

**Симптом:** `curl -sI http://127.0.0.1:8091/` возвращает `HTTP/1.0 404 File not found`.  
**Решение:** `kill PID && nohup python3 -m http.server 8091 --bind 127.0.0.1 --directory /home/user/gb-is-my-strength/dist &` (перезапуск с АБСОЛЮТНЫМ путём).

### 4.3 Two servers на разных портах
- `:8090` = legacy root `/home/user/gb-is-my-strength` (там обычные `index.html` файлы)
- `:8091` = dist `/home/user/gb-is-my-strength/dist` (там собрано Astro)

**КРИТИЧНО:** dist НЕ содержит css/ напрямую — CSS лежит в `dist/_astro/*.css`. Поэтому `<link rel="stylesheet" href="/css/site.css">` будет 404 на dist-сервере. Реальные страницы Astro-роуты собирают CSS бандл в `/_astro/*.css` через `<link rel="stylesheet" href="/_astro/...">`. Но **shadow-wrapped legacy** страницы (Astro-owned типа `/about/`, `/articles/`) используют `loadLegacyFullDocument` который добавляет original `<link rel="stylesheet" href="/css/site.css">` — а этого файла в dist нет!

**Решение:** Тестировать shadow-wrapped страницы надо из legacy root (`:8090`). Тестировать native Astro страницы — из dist (`:8091`).

### 4.4 pkill может не убить процесс
`pkill -f "http.server"` иногда не находит. Использовать `ps aux | grep http.server` + `kill PID`.

---

## 5. dist/ исчезает после каждой сессии

После завершения сессии workspace очищается. `dist/`, `node_modules/`, `/tmp/*`, `~/.git/` (иногда!) удаляются. Поэтому:

- НЕ сохраняй критичные артефакты в `dist/` (он gitignored)
- Сохраняй ВСЕ важные отчёты в `audit/` или `reports/` (но они тоже gitignored)
- Если нужны скриншоты для PR — коммить их в отдельный commit с явным сообщением "transient visual artifacts"
- `.git` тоже может исчезнуть — `git clone` снова если нужно

---

## 6. SVG / CSS проверки

`grep -c "!important" css/site.css` — НЕПРАВИЛЬНО. Правильно:
```bash
grep -o "!important" css/site.css | wc -l
```
(grep -c считает СТРОКИ содержащие pattern, не вхождения pattern'а.)

---

## 7. Yandex CSP / external services

`konfessii/_app/index.html` имеет CSP `script-src 'unsafe-eval' blob:` для Three.js — НЕ ТРОГАТЬ. Валидатор `audit-pro` это пропускает, потому что iframe app помечен как `built-app`.

---

## 8. Git operations

### 8.1 Token safety
GitHub token от пользователя приходит в чате. **НИКОГДА не сохраняй** в workspace — только env var. Использовать `git remote set-url origin "https://x-access-token:$GH_TOKEN@github.com/...git"`.

### 8.2 Push failure modes
- `fatal: Authentication failed for 'https://github.com/...'` — token неверный ИЛИ `credential.helper` syntax неправильный. Workaround: `git remote set-url` с токеном в URL.
- `fatal: cannot push to non-bare repository` — нет remote или remote отказывает.
- **После каждой команды `unset GH_TOKEN`** чтобы не leak.

### 8.3 git history важна для owner-approval
Каждый push это публичный коммит. Owner видит его в реальном времени. **Не пушить спекулятивные изменения.** Только проверенные.

---

## 9. Audit scripts нюансы

### 9.1 `scripts/audit-pro.js` имеет кеш
Если `audit/audit-pro-*.md` от прошлой сессии остался — НЕ будет. Это новая сессия.

### 9.2 `scripts/visual-parity-baseline.js` requires baseline
`data/visual-parity-baseline.json` — это committed файл с owner-approved values. Если меняешь diff%, **MUST** быть owner-approved. Скрипт `--update` обновляет — но используй только после owner review.

### 9.3 `node scripts/audit-pro.js` exit 1 vs 0
- exit 0 = все ✅
- exit 1 = errors found (warnings/info не считаются)
- Если exit 1 — последняя строка stdout показывает где failed

---

## 10. Tokens / Secrets

В этой sandbox **можно** использовать GitHub tokens от пользователя. Но:
- НЕ коммитить в git
- НЕ сохранять в файлы workspace
- Использовать только через `export TOKEN=...`
- После использования `unset TOKEN` чтобы не оставить в env для следующей команды

---

## 11. Что я нашёл в этом проекте (не sandbox, но полезно знать)

### 11.1 НЕВИДИМЫЙ БАГ #1 (r252)
`scripts/validate-map-routes.js` имел regex literal `/href=["']\.\/[^\"']*\b${id}\b[^\"']*["']/` — JS regex LITERALS не интерполируют `${id}`. Поиск шёл по буквальной строке `${id}`. Все 10 routes ошибочно помечались как missing. **Сломан с AGENTS-r252 (2026-06-18) до моего фикса 2026-06-20.** Fix: `new RegExp(\`href=["']\\.\\/[^\"']*\\b${id}\\b[^\"']*["']\`)`.

### 11.2 НЕВИДИМЫЙ БАГ #2 (r157+)
AGENTS.md §12.5.6 говорит "19 event listeners без removeEventListener, нет destroy() метода". НО с r157 есть `_cleanupAll()` + `destroy()`. Реальная дыра была только 2 document-level listener'a в panel resize handler. Fix: `_on(document, ...)` вместо raw addEventListener.

### 11.3 8 из 10 карт — заглушки (НЕ РЕШЕНО)
`karty/ishod/`, `karty/pavel/`, `karty/maccabim/`, `karty/melachim/`, `karty/shoftim/`, `karty/shvatim/`, `karty/yeshua/`, `karty/revelation/`, `karty/early-church/` — все имеют `index.html` с текстом "Визуальный аудит карт" (holding page). Только `karty/avraam/` имеет реальную карту. route.json есть для всех 10. **Это owner design decision, не bug — все карты можно включить если owner решит.**

### 11.4 Avraam tour был слишком быстрый (FIXED)
`karty/avraam/avraam-app.js` строка 1680: `},1050);` — задержка между этапами тура 1050ms. Пользователь жаловался. Fixed: 4500ms. Также убран auto-open первой точки при выборе истории (теперь карта primary, не маршрут). `(ложно)gated by false` — код остался, но не выполняется, чтобы владелец мог вернуть.

### 11.5 GenealogyTree initial fitView прятал 79 узлов (FIXED)
`src/components/genealogy/GenealogyTree.tsx`: `minZoom: 0.15` + semantic zoom фильтр по `detailLevel < 0.3` скрывали 79 из 156 узлов при initial fitView. Fix: `minZoom: 0.55` чтобы fitView не зумил меньше уровня "все узлы видны". После: 77 → 143 видимых узлов.

### 11.6 13 из 156 узлов всё ещё missing (НЕ РЕШЕНО)
После genealogy fix 13/156 persons не renderятся. Подозрение: orphan persons (16 с no parents) или edge case в dagre layout. Можно debug: добавить `console.log(persons.filter(p => laidNodes.find(n => n.id === p.id)).length)` в `GenealogyTree.tsx`.

### 11.7 DALL-E reference изображения для genealogy
Владелец приложил 7 reference images в `/home/user/uploads/`. Все показывают messianic tree с центральной messianic line + side branches (Cain, Ham). Цветовая палитра: cream/beige + gold (#d4a857/#c4a04a). Features: era sidebar слева, "VS." comparison в центре, era icons. Текущая реализация использует messianic line + golden path подход — правильное направление.

---

## 12. Частые fail modes

| Симптом | Причина | Решение |
|---|---|---|
| `Cannot find module 'playwright'` | не было `npm install` | `npm install` |
| `Executable doesn't exist at ~/.cache/...` | не было `npx playwright install` | `npx playwright install chromium` |
| `Node.js v20.20.2 is not supported by Astro!` | нужен Node 22 | `export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH` |
| `npm run astro:build` exit 0, но dist пустой | stale node_modules | `rm -rf node_modules && npm install` |
| `fatal: Authentication failed` для GitHub push | неправильный token/credential | использовать `git remote set-url origin "https://x-access-token:$TOKEN@github.com/..."` |
| `playwright install` падает с `EACCES` | permission issue на /root | работает в `/home/user` |
| audit-pro exit 1 без видимых errors | последние `R.err()` строки в stdout | `node scripts/audit-pro.js` напрямую |
| `HTTP/1.0 404 File not found` на всех routes | server cwd `(deleted)` | `kill PID && restart with absolute path` |
| `dist/` не существует | sandbox cleanup | `npm run strangler:build:production-like` |
| `.git` директория исчезла | sandbox cleanup | `git clone https://github.com/...git` |
| ReactFlow tree показывает только 77/156 узлов | `minZoom` слишком мал для semantic zoom | bump `minZoom` до уровня где `zoomLevel >= 0.7` |

---

## 13. Какие файлы реально нужны для полного цикла

1. `npm install` (~7 сек)
2. `npx playwright install chromium` (~30 сек)
3. `wget https://nodejs.org/dist/v22.12.0/...` + extract (~10 сек)
4. `export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH`
5. `npm run strangler:build:production-like` (~15 сек)
6. `nohup python3 -m http.server 8090 --bind 127.0.0.1 --directory /home/user/gb-is-my-strength &` (legacy)
7. `nohup python3 -m http.server 8091 --bind 127.0.0.1 --directory /home/user/gb-is-my-strength/dist &` (dist)

Итого ~60 сек setup. Затем можно делать screenshots / audit / push.

---

## 14. Когда НЕ делать push

- ❌ Нет visual review от пользователя
- ❌ Не все gates прошли (audit-pro ❌, map errors)
- ❌ Изменения в `src/**` Astro pages без прохождения `visual:parity:guard`
- ❌ Изменения в `karty/_engine/map-engine.js` без прохождения avraam:audit (28/28)
- ❌ Изменения baseline без owner approval
- ❌ Удаление или изменение того, что пользователь явно не просил

---

## 15. Команды которые я успешно выполнил в этой сессии

```bash
# Setup
cd /home/user/gb-is-my-strength
wget -q https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-x64.tar.xz -O /tmp/node22.tar.xz
tar -xf /tmp/node22.tar.xz -C /tmp/
export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH
npm install
npx playwright install chromium
mkdir -p dist  # if gone
npm run strangler:build:production-like

# Servers
nohup python3 -m http.server 8090 --bind 127.0.0.1 --directory /home/user/gb-is-my-strength > /tmp/server.log 2>&1 &
nohup python3 -m http.server 8091 --bind 127.0.0.1 --directory /home/user/gb-is-my-strength/dist > /tmp/server.log 2>&1 &

# Visual parity
node scripts/visual-parity-screenshots.js --routes "/,/about/,..."

# Push (with token in URL, NOT in git)
git remote set-url origin "https://x-access-token:$GH_TOKEN@github.com/FedorMilovanov/gb-is-my-strength.git"
git push origin main
unset GH_TOKEN
```

Удачи следующему агенту.
