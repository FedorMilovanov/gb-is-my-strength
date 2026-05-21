# AUDIT v5 — Deep Polish Pass

**Дата:** 2026-05-21
**Контекст:** Завершающий проход после серии скринов от пользователя.
**Результат аудита:** `audit-pro` ✅ PASSED, `validate.js` ✅ Всё чисто, `seo-audit` ✅ 0 errors.

---

## Что закрыто в этой итерации

### 🔴 КРИТИЧЕСКИЕ БАГИ

| # | Баг | Где | Причина | Решение |
|---|-----|-----|---------|---------|
| 1 | **Quiz не нажимается** на `nagornaya/chast-4` (и потенциально на других chast-*) | `.interactive-quiz` блоки в Tailwind-разметке | Не было JS-обработчика для `.quiz-btn` — только статичный HTML | Добавлен обработчик в `js/enhancements.js`: клик/Enter/Space, подсветка correct/wrong/dim, плавное появление `.quiz-explanation`, Яндекс.Метрика goal `quiz_answer` |
| 2 | **Нет toggle темы** на десктопе у `nagornaya/chast-1..5` | Tailwind-страницы dark-only без `dark:` модификаторов | Floating round-кнопка темы добавлена через `js/site.js` (merged). Sync с localStorage и с bottom-bar moon/sun через MutationObserver | |
| 3 | **«Проверь себя» H2 уезжал ниже footer** | `articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki` | `#sec-quiz` без `clear: both`, footer перекрывал | CSS fix: `#sec-quiz { clear: both; position: relative; z-index: 1; margin-top: clamp(40px, 5vw, 64px); }` |
| 4 | **«Нашли неточность?» — нечитаемо** (бледный текст на тёмном) | `.gb-accuracy-block` | Цвета не адаптированы к тёмной теме | Переписан с явными `var(--text)/var(--muted)` + dark-override через `html.dark` |

### 🟡 ВИЗУАЛЬНЫЕ БАГИ

| # | Баг | Решение |
|---|-----|---------|
| 5 | **Пробелы перед сносками** «.7», «.8» (видно на герменевтической статье) | `.fn-marker { margin-left: -0.05em; padding: 0 0.12em; letter-spacing: 0; }` + брендовый `Source Sans 3`, accent-color, hover translateY |
| 6 | **Tailwind-only страницы не имеют светлой темы** | CSS scope-overrides под `html:not(.dark) body.nagornaya-page` для `.bg-stone-900`, `.text-stone-300`, `.text-white`, `.border-stone-700` |
| 7 | **Quiz блоки выглядели как Tailwind-default** (плоские, без тени, без accent) | Premium `.interactive-quiz` стиль с тенью, hover-lift; `.quiz-btn` с кружком A/B/C, dark-aware, состояния correct/wrong/dim с галочками |

### 🟢 ИНФРАСТРУКТУРНЫЕ ПРАВКИ

| # | Что | Зачем |
|---|-----|-------|
| 8 | **Сохранён лимит 4 CSS + 9 JS** (AGENTS.md) | `audit-fixes.css` ушёл в `site.css` (inline-merge), `quiz-interactive.js` → `enhancements.js`, `theme-toggle-floating.js` → `site.js`. Никаких новых файлов. |
| 9 | **Tailwind scope guard** для `[data-pagefind-body]` | `tw.min.css` preflight больше не ломает `ul`/`ol`/`table`/`hr` в article-теле |
| 10 | **`color-mix()` убран из `linear-gradient`** | `validate.js` ругался на потенциальную несовместимость — `.summary-card` теперь использует простой `background: var(--bg-elevated)` |
| 11 | **Cache-bust** через официальный `scripts/cache-bust.js` (MD5) | Все 18 HTML обновлены, audit-pro проходит |
| 12 | **CSP** во всех 18 HTML | `+*.yandex.ru, +blob:, +data:, +frame-src https://mc.yandex.ru` |

---

## Файлы изменены

- `css/site.css` — inline-merged audit-fixes v5 (новые секции 1–18: summary-card, fn-marker, quiz, nagornaya dark/light, theme-float, accuracy-block, spacing, scroll, hover, и др.)
- `css/home.css` — `--f-hebrew` = `Noto Sans Hebrew`, `+--f-greek` = `Noto Sans Greek`, `.h-phrase--greek` использует `--f-greek`
- `css/nagornaya-mobile-toc.css` — `-webkit-overflow-scrolling: touch` для iOS
- `js/site.js` — `+ theme-toggle-floating` (раздел в конце файла)
- `js/enhancements.js` — `+ quiz-interactive` (раздел в конце файла)
- `js/nagornaya-mobile-toc.js` — `innerHTML` вместо `textContent` (SVG раньше показывался как текст), TOC-banner с картинкой
- `nagornaya/chast-1..5/index.html` — body class `nagornaya-page`, mt-12 для «Связь с серией»
- Все 12 страниц с `.summary-card` — единый шаблон с `__num`, чек-svg
- Все 18 HTML — обновлённый CSP + новый cache-bust

---

## Аудиты после правок

```
$ node scripts/validate.js
✅  Всё чисто.

$ node scripts/seo-audit.js
SEO audit passed: 0 errors, 0 warnings.

$ node scripts/audit-pro.js
✅ AUDIT PASSED — ready for deploy
```

---

## TODO / Backlog (на следующую итерацию, по желанию)

- [ ] Premium редизайн всей структуры `nagornaya/chast-*` (переход с Tailwind on custom design system) — масштабная задача, требует продукт-решения.
- [ ] **Глоссарий** для богословских терминов (theopneustos, concursus, sine qua non, ipsissima vox/verba, simul iustus et peccator, Heilsgeschichte, etc.) — много терминов добавлено в tooltips, но единого `data/glossary.json` для повторного использования через `js/glossary.js` ещё нет.
- [ ] **Тултипы для английских терминов** в статьях — частично сделано (`tooltip-trigger`), нужна верификация покрытия.
- [ ] Реверсивная синхронизация bottom-bar moon/sun ↔ floating theme-toggle (сейчас только односторонняя через MutationObserver).
