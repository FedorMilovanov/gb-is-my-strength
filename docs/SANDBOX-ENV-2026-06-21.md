# ARENA SESSION MANUAL — выживание в песочнице

**Обновлено:** 2026-06-22  
**Версия:** v8.0 (v7.1 + §16 VISION/IMAGE — полная диагностика зрения агентов + OCR-обход)  
**Среда:** Arena.ai Agent Mode — Linux ext4, 2 CPU, 1.9GB RAM

---

## 0. ЭКСПЕРИМЕНТАЛЬНО ПРОВЕРЕНО (факты, не догадки) — обновлено v8

```
✅ Файлы СОХРАНЯЮТСЯ при падении сессии (ext4, не tmpfs)
✅ git remote СОХРАНЯЕТСЯ при падении (но токен в URL — нет, используй env var)
✅ git log/history СОХРАНЯЕТСЯ
✅ write_file РАБОТАЕТ (но иногда не синхронизируется с bash в той же сессии)
✅ edit_file В ЭТОЙ СЕССИИ СРАБОТАЛ НАДЁЖНО (3/3 правок без fuzzy-match ошибок) — v7: похоже стабилен для точных правок
✅ python3 -c РАБОТАЕТ
✅ sed -i РАБОТАЕТ (всегда)
✅ npm ci РАБОТАЕТ и БЫСТРЕЕ npm install (~7 сек, 477 пакетов)
✅ generate_image НЕ НУЖЕН для visual proof — pixelmatch + скриншоты дают объективный diff
✅ OCR (tesseract) РАБОТАЕТ для текстовых скриншотов — установить: sudo apt install tesseract-ocr tesseract-ocr-rus + pip install pytesseract
✅ PIL/Pillow РАБОТАЕТ для анализа изображений (цвета, размер, тема)
❌ VISION МОЖЕТ ОТСУТСТВОВАТЬ — зависит от модели, а не от платформы (см. §16)
❌ edit_file иногда ПАДАЕТ на крупных блоках (используй sed -i или python3 для надёжности)
❌ read_file гигантских файлов >500KB может упасть
❌ Теряется только НЕДОПИСАННЫЙ ответ агента (середина сообщения)
❌ Токен в открытом чате = СКОМПРОМЕТИРОВАН (см. §8.4)
```

```
✅ Файлы СОХРАНЯЮТСЯ при падении сессии (ext4, не tmpfs)
✅ git remote СОХРАНЯЕТСЯ при падении (но токен в URL — нет, используй env var)
✅ git log/history СОХРАНЯЕТСЯ
✅ write_file РАБОТАЕТ (но иногда не синхронизируется с bash в той же сессии)
✅ edit_file В ЭТОЙ СЕССИИ СРАБОТАЛ НАДЁЖНО (3/3 правок без fuzzy-match ошибок) — v7: похоже стабилен для точечных правок
✅ python3 -c РАБОТАЕТ
✅ sed -i РАБОТАЕТ (всегда)
✅ npm ci РАБОТАЕТ и БЫСТРЕЕ npm install (~7 сек, 477 пакетов)
✅ generate_image НЕ НУЖЕН для visual proof — pixelmatch + скриншоты дают объективный diff
❌ edit_file иногда ПАДАЕТ на крупных блоках (используй sed -i или python3 для надёжности)
❌ read_file гигантских файлов >500KB может упасть
❌ Теряется только НЕДОПИСАННЫЙ ответ агента (середина сообщения)
❌ Токен в открытом чате = СКОМПРОМЕТИРОВАН (см. §8.4)
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

### 3.5 НЕДОСТАЮЩИЕ СИСТЕМНЫЕ БИБЛИОТЕКИ chromium (v7, КРИТИЧНО)
После `npx playwright install chromium` браузер скачивается, но **НЕ запускается**:
```
chrome-headless-shell: error while loading shared libraries: libnspr4.so: cannot open shared object file
```
Sandbox не имеет нативных библиотек Chromium. **Решение (одно из двух):**
```bash
# Вариант A — официальный установщик Playwright (ставит всё сразу, ~20 сек):
sudo npx playwright install-deps chromium

# Вариант B — точечно через apt (если A недоступен):
sudo apt-get install -y -qq libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
  libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0
```
`sudo` **работает** в sandbox (password-less root). НОВАЯ находка v7.

### 3.6 Симптом «chromium скачан, но launch() exit 127» = тот же баг §3.5
Если `npx playwright install` прошёл без ошибок, но `launch()` падает с exitCode 127 — это 100% отсутствующие shared libraries. Не переустанавливай playwright, не меняй версию — стави `install-deps`.

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

## 6.5 SVG SELF-CLOSING BYTE-PARITY GATE (v7, КРИТИЧНО ДЛЯ РЕФАКТОРИНГ 6.0)

**Невидимый блокер всей миграции leaf-replacement.** `scripts/astro-about-pilot-audit.js`
имел `checkFullDocumentParity()` — побайтовое сравнение нормализованного legacy vs dist HTML.
Он писался под эпоху `set:html` shadow (сырая строка сохраняла `<path/>`).

**Проблема:** hand-authored Astro сериализует пустые элементы как explicit-close:
```
legacy / set:html:   <path d="M...z"/>       <circle r="3"/>       <rect x="2"/>
hand-authored Astro: <path d="M...z"></path>  <circle r="3"></circle> <rect x="2"></rect>
```
Эти формы **СПЕЦИФИКАЦИОННО ЭКВИВАЛЕНТНЫ** в HTML5 — браузерный DOM идентичен,
pixel-diff = 0.0000%. Но byte-gate падал с ложным `❌ differs` (213 «diff-окон» = каскад
от 5 реальных точек сериализации).

**Без фикса КАЖДЫЙ мигрированный Astro-leaf с SVG падал бы в CI** — миграция 6.0 мертва.

**Фикс (применён, 2 коммита fix(audit-about)):** `normalizeHtmlForFullDocumentParity` теперь нормализует
к БРАУЗЕРНО-ЭКВИВАЛЕНТНОЙ форме, покрывая ДВА класса сериализационных ложных срабатываний:

**Класс A — самозакрывающиеся пустые элементы** (шаг 1, AboutArticle):
раскрыть `<x .../>` → `<x ...></x>` на ОБЕИХ сторонах:
```js
.replace(/(<([a-zA-Z][a-zA-Z0-9:-]*)(\s[^>]*?)?)\s*\/\s*>/g, '$1></$2>')
```

**Класс B — пробелы в текстовых узлах** (шаг 2, AboutAccuracyBlock):
компилятор Astro триммит ведущие/хвостовые пробелы внутри flow-text (отступная строка прозы
становится без отступа), а legacy-источник хранит отступ. Браузер коллапсирует их идентично.
Схлопнуть `\s+` → одиночный пробел на ОБЕИХ сторонах, КРОМЕ внутри whitespace-significant
элементов (`<pre>`, `<textarea>`) и raw-text (`<script>`, `<style>`) — их содержимое защищено
через placeholder-swap и сравнивается verbatim.

Проверено (обеими шагами /about/):
  - реальные регрессии **по-прежнему ловятся**: изменённое слово, изменённый id, удалённая секция
  - защищено: `<pre>` пробелы, `&nbsp;` entities, `%20` в mailto URL
  - pixelmatch desktop+mobile = 0 differing pixels

**Главный урок:** ЛЮБОЙ «byte-parity» гейт против hand-authored Astro должен нормализовать к
браузерно-эквивалентной форме, иначе он ловит сериализацию, а не баги. Юзай pixelmatch как
независимый арбитр.

**Урок для будущих агентов:** при любом «byte-parity» гейте ВСЕГДА проверяй, не сериализационная
ли это разница (self-close vs explicit-close, порядок атрибутов, кавычки). Юзай pixelmatch как
независимый объективный арбитр — он смотрит на пиксели, а не на байты.

## 6.6 astro:audit:about ВЫХОДИТ ДО СКРИНШОТОВ (v7, workflow gotcha)

`astro-about-pilot-audit.js` структура:
```
1. strangler:build
2. checkFullDocumentParity  ← если FAIL, process.exit(1) ЗДЕСЬ
3. Playwright screenshots/desktop/mobile/no-JS/SEO/JSON-LD/asset checks  ← не доходят
```
То есть **если byte-parity красная, ты НИКОГДА не увидишь скриншоты** из этого скрипта.
Они выполняются только после зелёного byte-гейта. Для отладки/visual proof когда gate ещё
красный — юзай **независимый** `scripts/about-leaf-parity-shots.js` (не зависит от byte-gate).

## 6.7 МЕТОД: pixelmatch как объективный арбитр parity (v7)

Для доказательства visual parity (особенно когда byte-diff есть, но подозреваешь что он
несущественный) — 3-шаговый метод, не зависит от гейтов проекта:
```bash
# 1. Снять скриншоты legacy + dist (http-сервер на оба root, Playwright fullPage)
# 2. md5sum — если хеши совпадают, diff=0 guaranteed (desktop обычно deterministic)
md5sum reports/X-legacy.png reports/X-astro.png
# 3. pixelmatch для количественного diff (mobile часто даёт разные хеши при 0 пикселях из-за PNG metadata)
node -e "const {PNG}=require('pngjs'),pm=require('pixelmatch'),fs=require('fs');
const a=PNG.sync.read(fs.readFileSync('A.png')),b=PNG.sync.read(fs.readFileSync('B.png'));
const w=Math.min(a.width,b.width),h=Math.min(a.height,b.height),d=new PNG({width:w,height:h});
console.log(pm(a.data,b.data,d.data,w,h,{threshold:0.1}),'differing pixels');"
```
pixelmatch/pngjs/sharp уже есть в node_modules проекта. Запускать **из корня проекта**
(`node ./tmp.js`), иначе `Cannot find module 'pngjs'`.

## 6.8 git identity по умолчанию НЕ задана (v7)
Свежий `git clone` в sandbox НЕ имеет `user.name`/`user.email` (`.gitconfig` в репо есть,
но `--local` config пустой). Перед коммитом:
```bash
git config --local user.name "Arena Agent"; git config --local user.email "agent@arena.ai"
```
Иначе `git commit` упадёт с `Author identity unknown`.

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

### 8.4 ТОКЕН В ОТКРЫТОМ ЧАТЕ = СКОМПРОМЕТИРОВАН (v7, КРИТИЧНО)
Владелец иногда присылает `ghp_...` токен прямо в сообщении чата. Это значит токен:
- виден в истории переписки,
- может логироваться инфраструктурой Arena,
- НЕ под твоим контролем после отправки.

**Действия агента при получении токена в чате:**
1. Использовать его для запрошенной операции (push), **нигде не сохраняя** (см. §8.1).
2. Пушить через `git push "https://x-access-token:$TOKEN@github.com/...git" main` — **одной командой**,
   НЕ через `git remote set-url` (чтобы токен не попал в `.git/config` даже временно).
3. `unset` env var сразу после.
4. **ЯВНО предупредить владельца:** токен скомпрометирован, отозвать в GitHub →
   Settings → Developer settings → Personal access tokens, выпустить новый.
5. Самому НИКОГДА не цитировать токен обратно в ответе.

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
| `chrome-headless-shell ... libnspr4.so` exit 127 | нет системных lib для chromium | `sudo npx playwright install-deps chromium` (см. §3.5) |
| byte-parity gate ❌ но pixel-diff 0.0000% | Astro пишет SVG как `<path></path>` не `<path/>` | канонизация self-close (см. §6.5), не «чинить» разметку |
| `Author identity unknown` при git commit | свежий clone без user.name/email | `git config --local user.name/email` (см. §6.8) |
| `Cannot find module 'pngjs'` при pixelmatch | скрипт запущен вне корня проекта | `cd` в корень, `node ./tmp.js` оттуда |
| `astro:audit:about` exit 1, скриншотов нет | byte-gate падает ДО Playwright стадии | независимый `scripts/about-leaf-parity-shots.js` (см. §6.6) |
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
npm ci                  # быстрее npm install (~7 сек)
npx playwright install chromium
sudo npx playwright install-deps chromium   # v7: системные lib (см. §3.5)
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

---

## 16. VISION / ИЗОБРАЖЕНИЯ — полная диагностика (v8, КРИТИЧНО)

### 16.1 Проблема

Владелец присылает скриншоты (PNG/JPG) в чат Arena Agent Mode. Некоторые агенты
говорят что «вижу скриншот», другие — что «не вижу». Кто врёт? Почему?

### 16.2 Диагноз: модель, не платформа

**Факт:** Arena.ai Agent Mode **поддерживает** загрузку изображений (JPG, PNG, WEBP, PDF).
Платформа **принимает** файлы и **передаёт** их модели. Инструмент `read_file`
**декларирует** поддержку изображений. НО:

```
read_file("screenshot.png") → "[An image was provided here, but you do not have vision capabilities.]"
```

Это сообщение означает: **файл существует, платформа его прочитала, но конкретная
модель-оркестратор НЕ ИМЕЕТ мультимодальных (vision) возможностей.**

**Архитектура Arena.ai Agent Mode:**
1. Пользователь загружает изображение → Arena сохраняет в workspace
2. Агент вызывает `read_file` → платформа рендерит изображение
3. Платформа передаёт рендер модели через API
4. **Если модель — text-only** (нет vision encoder) → возвращает placeholder
5. **Если модель — multimodal** (есть vision encoder) → модель видит изображение

**Ключевой вывод:** Ограничение — НЕ платформа, НЕ sandbox, НЕ инструменты.
Это **КОНКРЕТНАЯ МОДЕЛЬ**, назначенная Arena в данной сессии.

### 16.3 Какие модели видят, какие — нет (по состоянию 2026-06)

| Модель/семейство | Vision? | Примечание |
|---|---|---|
| GPT-5 / GPT-5.1 / GPT-5.2 | ✅ Да | MMMU Pro 70-75% |
| Claude Opus 4.5 / Claude 4.5 Sonnet | ✅ Да | MMMU Pro 69-74% |
| Gemini 3 Flash / Pro | ✅ Да | MMMU Pro 70-80%, лучший vision |
| Qwen3 VL / Qwen2.5-VL | ✅ Да | Open-source vision models |
| **Text-only модели** (большинство code-оптимизированных) | ❌ Нет | Нет vision encoder |
| **Малые модели** (<10B params) | ❌ Обычно нет | Нет ресурсов для vision |

**Arena.ai НЕ раскрывает**, какая модель назначена в Agent Mode. Это by design —
focus на результате, а не на модели. Поэтому **априори неизвестно**, видит ли
текущий агент изображения.

### 16.4 Экспериментальная проверка: есть ли у тебя vision?

**Шаг 1:** Попробуй `read_file` на загруженном PNG:
```
read_file("uploads/screenshot.png")
```
Если ответ содержит `[An image was provided here, but you do not have vision capabilities.]`
→ **У тебя НЕТ vision.** Это финально.

**Шаг 2 (если шаг 1 не дал ясности):** Спроси себя: «Опиши что ты видишь на этом изображении».
Если ты можешь описать цвета, layout, текст — vision есть.
Если ты отказываешься или угадываешь — vision нет, не притворяйся.

### 16.5 Обходной путь #1: OCR (для текстовых скриншотов)

**Установка (один раз за сессию):**
```bash
sudo apt-get install -y -qq tesseract-ocr tesseract-ocr-rus
pip install pytesseract Pillow 2>/dev/null
```

**Использование:**
```python
from PIL import Image
import pytesseract

img = Image.open('/home/user/uploads/screenshot.png')
text = pytesseract.image_to_string(img, lang='rus+eng')
print(text)
```

**Что OCR даёт:**
- ✅ Весь текст на скриншоте (включая русский)
- ✅ Понимание структуры страницы (заголовки, параграфы)
- ✅ Обнаружение UI-элементов (кнопки, меню)
- ❌ НЕ даёт визуальный layout (позиционирование, отступы)
- ❌ НЕ даёт цвета и дизайн
- ❌ Менее точно для мелкого текста, иконок, сложных layout'ов

### 16.6 Обходной путь #2: PIL/Pillow анализ (для цветов и темы)

```python
from PIL import Image
import collections

img = Image.open('/home/user/uploads/screenshot.png').convert('RGB')
pixels = list(img.getdata())

# Определить тему
dark = sum(1 for r,g,b in pixels if r<60 and g<60 and b<60)
light = sum(1 for r,g,b in pixels if r>200 and g>200 and b>200)
total = len(pixels)
print(f'Theme: {"dark" if dark > light else "light"}')
print(f'Dark: {dark/total*100:.1f}%  Light: {light/total*100:.1f}%')

# Доминирующие цвета
top = collections.Counter(pixels).most_common(10)
print('Top colors:', top)
```

Это даёт: размер изображения, тему (dark/light), доминирующие цвета.
Полезно для проверки что страница в правильной теме.

### 16.7 Обходной путь #3: Playwright + pixelmatch (для visual parity)

Если нужно проверить **визуальное совпадение** — не пытайся «смотреть» глазами.
Используй объективный pixel-diff (уже встроен в проект):
```bash
npm run visual:parity:screenshots -- --routes /about/ --threshold 0.5
npm run visual:parity:baseline:check
```

Это даёт **количественный** результат (0.000% diff = идеально), не зависит от
vision-способностей агента.

### 16.8 Обходной путь #4: Firefox DevTools Protocol (для DOM inspection)

Если нужно понять layout, но нет vision — можно извлечь DOM:
```javascript
// В Playwright
const html = await page.content();
const computedStyles = await page.evaluate(() => {
  const el = document.querySelector('.about-page');
  return JSON.stringify(getComputedStyle(el));
});
```

### 16.9 Почему другие агенты говорят что «видят»

**Они НЕ врут.** Если агент на Arena запущен с мультимодальной моделью (например,
Claude с vision, или Gemini), модель **реально получает** изображение через
multimodal API и **реально анализирует** пиксели. Это не галлюцинация — у модели
есть vision encoder, который конвертирует изображение в embedding и объединяет
с текстовым контекстом.

Но: accuracy vision-моделей варьируется. Они могут ошибаться в деталях layout'а,
пропускать мелкий текст, неточно определять цвета. **OCR обычно точнее** для
текстового содержимого.

### 16.10 Правило для владельца: как отправлять визуальную информацию

Если агент сообщает «у меня нет vision» — вот что работает:

1. **Текстовое описание** — самое надёжное. Опиши что не так: «кнопка съехала
   вправо», «текст обрезан», «тёмная тема не работает на /about/»
2. **Скриншот + текст** — даже без vision, агент может использовать OCR (§16.5)
3. **Сравнение «было/стало»** — дай два скриншота, агент прогонит через pixelmatch
4. **DOM dump** — `curl https://gospod-bog.ru/about/ | head -200` даёт структуру
5. **Console errors** — если проблема в JS, скопируй текст из DevTools Console

### 16.11 ЧЕКЛИСТ при получении скриншотов

```
1. Попробуй read_file() → если "do not have vision capabilities" → переходи к OCR
2. Установи tesseract: sudo apt install tesseract-ocr tesseract-ocr-rus
3. Установи pytesseract: pip install pytesseract
4. Прогони OCR на каждом скриншоте
5. Дополнительно: PIL-анализ для темы/цветов
6. Если нужен pixel-diff — Playwright + pixelmatch
7. СООБЩИ ВЛАДЕЛЬЦУ что не видишь изображения напрямую
```

### 16.12 Резюме одним предложением

**Vision в Arena Agent Mode — это свойство модели, не платформы; text-only модели
не видят изображения, но OCR + pixelmatch + DOM-inspection дают 80%+ информации
без зрения; если агент говорит «вижу» — он не врёт, у него просто другая модель.**
