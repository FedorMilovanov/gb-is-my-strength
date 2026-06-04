# PLAN-06 — DONE (executed 2026-06-04)

> **Status:** ✅ COMPLETED.
> **Цель:** профессиональная чистка JS с Playwright re-checks.
> **Главный результат:** JS код проекта уже был чистым — обнаружены только
> косметические правки заголовков модулей (P1, P2, P3 — comment-only).
> Глубокий аудит unused functions / dead DOM-refs / dead helpers (P4) подтвердил отсутствие реального dead code.
>
> Этот файл сохранён как **историческая ссылка** на проделанную работу.

---

# PLAN-06 — JS cleanup (исходный план)

> **Status:** ✅ COMPLETED 2026-06-04
> **Owner:** Arena Agent (по запросу Фёдора Милованова)
> **Цель:** профессионально и аккуратно почистить JS — без потери функционала.
> Качество > размер. Каждая партия → проверки → коммит → push → Playwright re-check.

> **Главный вывод:** JS уже был **чистым**. Cosmetic правки в headers (P1, P2, P3),
> аудит-only deep scan (P4) подтвердил отсутствие dead code в site.js / enhancements.js.
> Real-world cleanup в этом репо был сделан правильно — никаких «забытых» legacy функций.

---

## 0. Baseline (2026-06-04, after PLAN-04 + PLAN-05)

```
LINES   BYTES   FILE
 5121  236231   js/site.js           ← главный, потенциал для чистки
 1534   72269   js/search.js         ← Ctrl+K палитра
  856   35799   js/enhancements.js   ← FAQPage, ambient phrases, 20-anti
  528   25365   js/nagornaya-mobile-toc.js
  616   24669   js/bookmark-engine.js
  535   19476   js/highlights.js     ← подсветка текста
  199    9420   js/glossary.js
  203    7210   js/sw-register.js
  122    4829   js/site-utils.js
  101    3258   js/scroll-perf.js
   51    2253   js/series-cards.js
  315   11328   sw.js
```

**Итого JS:** 9436 строк, **440 КБ** (сырых). Gzip ≈ 112 KB.

### Что НЕ есть проблема (по anti-pattern скану)

- `console.log/warn/info` — всего 7 шт, все под `debug: true` гваром или в `console.warn` для error reporting. **Не трогать.**
- TODO / FIXME / XXX / HACK — **0** упоминаний.
- `eval` / `new Function` — **0** упоминаний.
- `addEventListener` без `removeEventListener` — много (130 vs 11 в site.js), но в большинстве случаев listeners на `document/window/body` глобальные навсегда. **Удаление потребовало бы передвинуть тонну логики; не критично.**
- Несбалансированные tag — **0** настоящих (htmlparser2 проверка прошла в PLAN-05).

### Что нашёл подозрительного

1. **`js/site.js` шапка-оглавление модулей рассогласована с кодом:**
   - `25. (зарезервировано)` — модуль 25 в коде НЕТ, мёртвый комментарий.
   - Модуль `28. Font Size Control — a / A` существует в коде (line 4283), но **отсутствует в шапке**.
   - Модули 29 и 30 (Floating Controls, Glossary cross-ref) в шапке отсутствуют (они вне основного IIFE).

2. **`js/site.js:4589-4590` — legacy комментарий**: упоминания `#themeFloat` / `#gbSearchFloat` (мёртвые после PLAN-04 P5). Это historical context в комментарии — **сохранить как есть** (документация модуля 29, объясняет ЗАЧЕМ).

3. **`js/enhancements.js` нумерация модулей рассогласована:**
   - Есть `A`, `B`, потом 3 безымянных блока (`quiz-interactive`, `HOME: Hebrew Word Tap-Toggle`, `HOME: Ambient Scripture Background`), потом `F`, `G`.
   - **Пропущены `C`, `D`, `E`.** Это косметика — переименовать или добавить буквы.

4. **`js/site.js:2314, 2742, 2770` — `/* legacy */` пометки** в quiz-engine. Скорее всего обратная совместимость со старыми SITE_CONFIG. **Проверять конкретно перед удалением.**

5. **`js/search.js:1432-1437` — alias `hCpBtnNav` → `gbSearchBtn`** (active legacy compat). **Не трогать без проверки HTML.**

---

## 1. Стратегия

### 1.1 Принципы

1. **JS гораздо опаснее CSS.** Любое удаление функции/блока может вызвать `TypeError`. Visual-audit Playwright обязателен после каждой партии: `0 console errors, 0 network errors`.
2. **Только косметика и явный dead code** в первых партиях. Никакого «выноса в helpers», никакого реструктурирования.
3. **Перед удалением функции/класса** — `grep -rn` по всему коду (HTML, JS, scripts), включая динамическую конкатенацию `'class--' + variant`.
4. **Каждая партия — отдельный коммит** с детальным описанием что/почему/проверки.
5. **Playwright visual-audit** запускается **после каждой партии**, до push. Если хоть один `console error` — `git reset --hard HEAD~`, разбор, новая попытка.
6. **`audit-pro` + `validate:all` + `node --check`** обязательны, как обычно.

### 1.2 Что НЕ делаем

- ❌ Не разделять `site.js` на новые файлы (контракт AGENTS §2 — ровно 11 JS).
- ❌ Не переписывать с `var → let/const` ради эстетики.
- ❌ Не выносить дубль-функции `openToc` / `closeToc` в общий helper — они работают с разными DOM-элементами, риск регрессии.
- ❌ Не модернизировать `var → arrow functions` ради эстетики.
- ❌ Не убирать `console.warn` под `debug` гваром — это legitimate.
- ❌ Не трогать `addEventListener` / `removeEventListener` симметрию — это требует архитектурного refactor.

### 1.3 Что делаем

| Партия | Тема | Файлы | Тип |
|---|---|---|---|
| **P1** | Косметика заголовков `js/site.js`: убрать «25 reserved», добавить 28/29/30 в шапку | `js/site.js` | comment-only |
| **P2** | Косметика заголовков `js/enhancements.js`: дать буквы C/D/E пропущенным модулям | `js/enhancements.js` | comment-only |
| **P3** | Аудит «legacy» пометок в quiz-engine — что реально мёртво, что compat | `js/site.js` | careful |
| **P4** | Аудит `_searchGen` guard / `validateSiteConfigContract` / другие защитные helpers — может ли что-то быть мёртвым | `js/site.js` | careful |
| **P5** | Поиск unused private helpers внутри IIFE-блоков (function X, которая нигде не вызвана) | `js/site.js` + others | careful |
| **P6** | Финал: `AUDIT_HISTORY.md` v28 + AGENTS-r64 (если есть архитектурные правки) | docs | docs |

### 1.4 После каждой партии (обязательный чеклист)

```bash
# 1. Синтаксис
node --check js/*.js scripts/*.js sw.js

# 2. cache-bust + хеши
npm run cache-bust

# 3. Полная валидация
npm run validate:all
npm run tokens:check

# 4. audit-pro
node scripts/audit-pro.js
# должно: ✅ PASSED 29 / 2 warn / 0 err

# 5. Playwright visual audit (КРИТИЧНО для JS)
# Запустить локальный сервер (отдельная сессия):
python3 -m http.server 8080 --bind 127.0.0.1 &
AUDIT_BASE=http://127.0.0.1:8080 npm run visual-audit
# должно: 32 страницы, 96 скринов, 0 console errors, 0 network errors
```

**Если хоть одна проверка FAIL → `git reset --hard HEAD~`, разобраться, новая попытка.**

---

## 2. Целевые числа (ориентиры, не догма)

| Метрика | Baseline | Цель (после P1..P6) |
|---|-:|-:|
| `js/site.js` строк | 5121 | ≤ 5100 (только мёртвый comment / dead code) |
| Console errors в Playwright | 0 | 0 |
| Network errors в Playwright | 0 | 0 |
| `audit-pro` | ✅ PASSED | ✅ PASSED |
| Рассогласование шапки `site.js` с кодом | 3 (25/28/29/30) | 0 |
| Рассогласование нумерации `enhancements.js` | 3 (C/D/E пропущены) | 0 |

> **Контракт:** размер JS — НЕ цель. Реальная цель — **чистота и читаемость** для следующих агентов. PLAN-04 показал, что когда документация противоречит коду — агенты творят регрессии. То же может случиться с JS: «зарезервированный модуль 25» в шапке заставит будущего агента «добавить функционал», который сломает архитектуру.

---

## 3. История плана

| Версия | Дата | Что |
|---|---|---|
| v1 | 2026-06-04 | Создан, baseline зафиксирован |
| v2 | 2026-06-04 | План завершён (P1-P4 выполнены, P5 пропущен как ненужный, P6 = финал) |

---

## 4. Журнал партий

| Партия | Коммит | Дата | Результат |
|---|---|---|---|
| P1 | `3872ba9` | 2026-06-04 | js/site.js шапка: убрано "25. (зарезервировано)", добавлены 28/29/30 модули с пометками AGENTS-r17 + PLAN-04 P5. Comment-only. |
| P2 | `34ca8d6` | 2026-06-04 | js/enhancements.js: 3 безымянных модуля получили буквы C/D/E (Quiz Interactive, Hebrew Tap-Toggle, Ambient Scripture). Добавлено оглавление A..G в шапку. Comment-only. |
| P3 | `acdd6d2` | 2026-06-04 | js/site.js:2320 — комментарий `qFocus = ...  /* legacy — kept for HTML compat */` заменён на точный (placeholder ref, всегда display:none в main flow). 2 других legacy-пометки (quiz-best key, gbFloatingControls) подтверждены легитимными — оставлены. Comment-only. |
| P4 | (audit-only, без правок кода) | 2026-06-04 | Глубокий поиск unused functions (12 кандидатов через regex, все оказались false positives — функции активно используются), dead DOM-refs (47→16→0, все легитимные defensive/template-literal/documented feature slot), пустых functions (все catch-handlers), early-out checks (119 в site.js — обязательны по AGENTS §2). **Вывод: JS уже чистый.** |
| P5 | (skipped) | — | Поиск unused private helpers не дал результатов в P4 — пропущен. |
| P6 | ⏳ | — | Финал: AUDIT_HISTORY v28 + переименование PLAN-06 → DONE |
