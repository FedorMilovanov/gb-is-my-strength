# PLAN-05 — DONE (executed 2026-06-04)

> **Status:** ✅ COMPLETED.
> **Цель:** перепроверить весь PLAN-04 с реальным браузером (Playwright) +
> вычистить мусор из текстовых документов и обновить их до новых версий.

---

## Что сделано

### 1. Visual QA с реальным браузером (Playwright + chromium)

- Установлен Playwright + chromium-headless + системные библиотеки
  (libnspr4, libnss3, libatk, libcups2, libdrm2, libxkbcommon, и др.).
- Запущен `npm run visual-audit` (Playwright по `scripts/visual-audit.js`):
  - **32 page/viewport runs, 96 screenshots**
  - **0 console errors, 0 network errors**
  - 28 raw bugs — все suppressed (известный invisible-text false positive).
- Дополнительно: 12 целевых тёмных скриншотов
  (home, articles index, hermenevticheskaya, 20-antisovetov,
  dzhon-gill-chast-1, nagornaya/chast-1 × desktop+mobile)
  для проверки `html.dark` после PLAN-04.

**Подтверждено:** все PLAN-04 изменения (199 !important, удаление мёртвых
компонентов, перенос `.h-hero-title` и `.h-phrase--greek/hebrew` в home.css)
**визуально идентичны** — никаких регрессий.

### 2. HTML hotfix — найден визуальной проверкой

В тёмной теме `articles/dzhon-gill-chast-1-chelovek/` карточка «Часть I →
Человек» показывала текст «Вы здесь» вертикальным столбиком символов:
**в, ы, з, ё, в, ь**.

**Причина:** HTML5 parsing — `<span>` для синей точки-индикатора 4×4 px не
имел `</span>`. Браузер «впитывал» текст «Вы здесь» внутрь 4px span,
`width:4px;display:inline-block` разбил текст по одному символу в столбик.

**Тот же баг** был во всех 3 файлах dzhon-gill (chast-1, chast-2, chast-3 —
copy-paste шаблона). Все 3 исправлены: `<span style="..."></span> Вы здесь`.

После фикса: htmlparser2 tree-balance check → **0 unclosed tags во всех 24 HTML**.

**Commit:** `e59f6df`

### 3. AGENTS.md полная перезапись (AGENTS-r63)

**Старый AGENTS.md (709 строк, r62):**
- 66+ записей в истории
- **ПРОТИВОРЕЧИЯ**: учил создавать `.theme-float-btn` / `.ai-disclosure`
  (давно удалены в PLAN-04 P5/P7) — из-за этого новые агенты регулярно
  возвращали мёртвые компоненты, отсюда регрессии июня 2026.
- Сломанная нумерация: §0-§8, §10, §11, ВТОРОЙ §11
- Устаревшие счётчики `!important` (~189, ~313, ~320 в разных местах)

**Новый AGENTS.md (567 строк, r63):**
- 11 чистых разделов с явной нумерацией
- §0 TLDR: 13 правил «СРАЗУ нельзя» (включая legacy-кнопки + !important чеклист)
- §4.2 актуальные числа после PLAN-04 (199) + 5-шаговый чеклист перед
  добавлением `!important` + 7 легитимных категорий
- §4.4 CSS Integrity Rules — 10 правил (включая новый п.9 «Мёртвый
  компонент = удалить», п.10 «лимит ≤200»)
- §5.3 — секция про Playwright visual-audit
- §8 (новая) — Service Worker правила
- §9 (новая) — Безопасность / гигиена
- §11 История — компактная таблица из 5 последних вех + ссылка на git log

**Commit:** `971475a`

### 4. AUDIT_HISTORY.md чистка (522 → 246 строк, −53%)

**Добавлено:**
- v27 entry — полное описание работ PLAN-05.

**Убрано:**
- v9..v21 (13 версий) свёрнуты в компактную summary-таблицу.
- «Previous Audit History» — placeholder v1-v7, устарел.
- «Remaining Items» — 8 пунктов, все устарели или закрыты в PLAN-04.
- Сломанный порядок: v9 стоял ПОСЛЕ v10 (раньше по дате, но позже в файле).

**Commit:** `643f4a7`

### 5. README.md полная перезапись (767 → 615 строк, −20%)

**Убрано:**
- Двойной `---` в шапке.
- Шапка «Версия 2.2 — Май 2026» (устарела).
- «SEO-инфраструктура — Версия 2.0 (Апрель 2026)» (старый title, контент полезен).
- ASCII-tree СЛОМАН: `pastor-series/index.html # серия` повторялся ×3.
- «Указано всего 2 CSS / 2 JS файла» — противоречит AGENTS §2 (5 CSS + 11 JS).
- Раздел «Отсутствующие изображения» — все ✅, не отсутствующие.
- «27 модулей site.js» — реально 29.

**Добавлено / переписано:**
- 9 разделов с явным TOC
- §3 атрибуция: 3 типа A/B/C с примерами meta-тегов
- §4 чеклист добавления статьи (10 пунктов)
- §5 полный шаблон <head>/<body>/JSON-LD/sitemap/feed
- §6 SITE_CONFIG контракт с полным bookmarks примером
- §7 контракт разметки — обновлён, добавлен `gb-fc-theme/search`,
  явно указано что `.theme-float-btn / #themeFloat` — DEAD
- §8 build-скрипты + Playwright visual-audit
- §9 правильный ASCII-tree, в соответствии с реальным кодом

**Commit:** `a054d02`

### 6. llms.txt — 3 content-критичных опечатки

- **«Кот да Винчи» → «Код да Винчи»** (книга Дэна Брауна, не про кота)
- **«20 советов пастору» → «20 антисоветов пастору»** (статья — сатира,
  «советы» меняли смысл на противоположный)
- **`/biologiografii/` → `/biografii/`** (опечатка URL — оригинал вёл на 404
  при автоматическом краулинге LLM-индексаторами Perplexity/ChatGPT Search/
  Claude/Grok — критично для AI-индексации)

Также: добавлены отсутствующие серии (pastor-series), Main pages обновлены,
описания статей уточнены, дата обновлена.

### 7. Переименование `audit/AUDIT_CLEANUP_PLAN_2026-06-04.md` → `audit/PLAN-04-DONE.md`

План полностью выполнен. Файл сохранён как историческая ссылка с явной
шапкой «DONE» + ссылкой на AUDIT_HISTORY § v26.

**Commit (6+7):** `5122383`

---

## Проверки

Все после каждой партии:

- `node scripts/audit-pro.js` → ✅ PASSED 29 / 2 warn / 0 err
- `npm run validate:all` → ✅ PASS (0 errors, 0 warnings)
- `npm run cache-bust` → matched
- `npm run tokens:check` → ✅ PASS (0 / 0)
- `npm run visual-audit` (Playwright × 96 screenshots) — финальный после всех правок
  → ✅ 0 console errors, 0 network errors

---

## Сводка коммитов PLAN-05

| Commit | Тема |
|---|---|
| `e59f6df` | hotfix HTML: closed `<span>` dot-indicator in 3 dzhon-gill files |
| `971475a` | AGENTS-r63: full rewrite (709 → 567 lines) |
| `643f4a7` | AUDIT_HISTORY.md cleanup (522 → 246 lines) |
| `a054d02` | README.md v3 full rewrite (767 → 615 lines) |
| `5122383` | llms.txt typos + rename PLAN-04 → DONE |

**Итого: 5 коммитов, ~700 строк текстового мусора удалены/переписаны,
визуальных регрессий 0, HTML-баг с 3 файлов исправлен через визуальное
обнаружение.**

---

> Для следующих агентов: PLAN-05 закрыт. Если требуется новая волна работ —
> создавайте `audit/PLAN-NN-PLAN.md` (после завершения переименовывайте в
> `PLAN-NN-DONE.md`).
