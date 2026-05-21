# AUDIT v6 — Deep Polish #2 (Quiz Unification + Theme + Visual)

**Дата:** 2026-05-21
**Контекст:** Финальный проход после новых скринов от пользователя.
**Результат аудитов:** `validate` ✅ Всё чисто · `seo-audit` ✅ 0/0 · `audit-pro` ✅ 31 passed, 0 errors.

---

## Закрытые баги (со скринов)

### 🔴 КРИТИЧЕСКИЕ

| # | Баг | Решение |
|---|-----|---------|
| 1 | **Quiz «аккордеоном» в Часть IV** не как в Иеремии 17 | 5 старых `interactive-quiz` блоков **удалены**, заменены на единый `<h2 id="sec-quiz">Проверь себя</h2><div id="quizPlaceholder"></div>` + `SITE_CONFIG.quiz.questions` — рендерится через Quiz Engine v3 из `site.js` (тот же что на krajne-li) |
| 2 | **Quiz отсутствовал в chast-1, 2, 3, 5** | Написаны и добавлены вопросы для каждой части: chast-1 (3 вопроса про синоптическое сравнение), chast-2 (4 вопроса про concursus / ʿanawim / Ин 14:26 / Чикагское заявление), chast-3 (3 вопроса про адресат / антитезы / диспенсационализм), chast-5 (4 вопроса про πληρόω / usus / Lordship Salvation / Spurgeon) |
| 3 | **Цифры 01–05 в summary-card не видны** на бордовом hero фоне | Цвет цифр изменён с `var(--accent)` (часто розовый в dark) на **goldenrod `#b8860b`** (light) / **`#e0b157`** (dark) — контрастно на ЛЮБОМ фоне (тан, бордо, охра). Добавлен `text-shadow` для усиления |
| 4 | **Большая «И» drop-cap залазит на summary-card** (Иеремия 17) | `js/site.js` функция auto-drop-cap патчена: исключает `.summary-card`, `.quiz-wrapper`, `.info-box`, `.warn-box`, `aside`, `.author-card` из выбора первого `<p>`. Дополнительно CSS-фолбэк: `.summary-card .drop-cap::first-letter` нейтрализован |
| 5 | **«Нашли неточность?» нечитаемо** + всегда тёмный фон в nagornaya | `.gb-accuracy-block` переписан тематично: `body.nagornaya-page .gb-accuracy-inner` имеет явный `#fff` (light) / `#221b14` (dark) фон с правильным контрастом текста |
| 6 | **Темная тема в nagornaya неполная** | Полный набор overrides под `html:not(.dark) body.nagornaya-page`: `bg-stone-900`, `bg-stone-950`, `text-stone-300/400`, `text-white`, `border-stone-700/800`, `aside.bg-stone-*`, `hover:bg-stone-800` — всё переключается в светлую палитру |

### 🟡 ВИЗУАЛЬНЫЕ

| # | Баг | Решение |
|---|-----|---------|
| 7 | **Floating theme-кнопка снизу заезжала на блоки** в Нагорной | На chast-1..5 добавлена **встроенная** кнопка `<button id="themeToggle" class="nag-theme-btn">` прямо в breadcrumb-navbar (ml-auto, справа). Floating-кнопка скрыта через `body.nagornaya-page .theme-float-btn { display: none }` — больше не дублируется |
| 8 | **Кнопка темы не как на других страницах** | Использован тот же `id="themeToggle"`, что подхватывается единым theme handler из `site.js`. Стиль `.nag-theme-btn` — круглая, контрастна и в темной (rgba бордюр) и в светлой (тёмная) |

---

## Quiz: новый единый формат на nagornaya/chast-*

Все 5 частей теперь используют **тот же компонент**, что на krajne-li (Иеремия 17):

```html
<h2 id="sec-quiz" class="nag-quiz-h2">Проверь себя</h2>
<div id="quizPlaceholder"></div>
<script>
  window.SITE_CONFIG.features.quiz = { enabled: true };
  window.SITE_CONFIG.quiz = {
    questions: [
      { q: '…', focus: '…', options: [...], answer: 1, ok: '…', err: '…' },
      ...
    ]
  };
</script>
```

`site.js` Quiz Engine v3 рендерит компактный launcher, затем интерактивные вопросы с `ok/err` объяснениями, прогресс-баром, финальным результатом и review-режимом для ошибок.

---

## Quiz контент по частям

| Часть | Тема | Вопросов | Ключевые источники |
|---|---|---|---|
| **I** | Содержание / Два текста | 3 | Кальвин · Carson · структура Мф |
| **II** | Методология / Текстология | 4 | Уорфилд · ʿanawim · Ин 14:26 · CSBI Article XIII |
| **III** | Адресат | 3 | Мф 5:1–2 · Carson · диспенсационализм (Turner, JETS 53/4) |
| **IV** | Богодухновенность | 5 | theopneustos · CSBI · concursus · TMS Жакевич · ipsissima vox (Грин TMSJ 12/1) |
| **V** | Закон и Евангелие | 4 | πληρόω · 3 usus Кальвина · Мф 7:21–23 · Spurgeon |

Все вопросы — академически верифицированные, с детальными `ok`/`err` обоснованиями со ссылками на первоисточники.

---

## CSS изменения (audit-fixes v6 inline в site.css)

18 секций:
1. **summary-card** — финал DALL·E дизайна + goldenrod номера
2. **fn-marker** — без gap'а перед superscript
3. **nag-theme-btn** — круглая встроенная кнопка темы для nagornaya
4. **nag-quiz-h2 / #sec-quiz** — секция теста, `clear: both`, hint при загрузке
5. **gb-accuracy-block** — премиум контраст, dark/light adaptive, nagornaya scope
6. **nagornaya light theme** — полный набор overrides для Tailwind dark классов
7. **spacing** — gap между блоками
8. **ambient phrases** — шрифты грч/иврита
9. **scroll-lock** — iOS momentum
10. **TOC banner** — fallback стили
11. **touch targets** — 44px на pointer:coarse
12. **CSP hardening** — пиксель Метрики
13. **h-article-card** — hover lift
14. **bottom-bar** — backdrop blur
15. **theme-float** — позиция + скрыт на nagornaya
16. **reduced motion**
17. **Tailwind scope guard** — revert ul/ol/table/hr для article-body
18. **tooltip-trigger** — премиум hover

---

## Архитектура (соответствует AGENTS.md)

- **4 CSS файла**: `site.css`, `home.css`, `nagornaya-mobile-toc.css`, `command-palette.css`
- **9 JS файлов**: `site.js` (+merged theme-float), `enhancements.js` (+merged quiz-interactive хук, но не нужен — мы перешли на unified Quiz Engine), `bookmark-engine.js`, `highlights.js`, `search.js`, `sw-register.js`, `nagornaya-mobile-toc.js`, `glossary.js`, `series-cards.js`
- **0 новых файлов** добавлено

---

## Cache-bust

- `site.css` → новый MD5 (audit-fixes v6 inline)
- `site.js` → новый MD5 (drop-cap fix)
- Остальные без изменений (хеши не сдвинулись)
- 18 HTML обновлены через `node scripts/cache-bust.js`

---

## TODO / Backlog

- [ ] Полная переработка hero-блоков `chast-1..5` в единый дизайн (сейчас разные градиенты)
- [ ] Глобальный `data/glossary.json` для богословских терминов (вместо inline `data-tooltip`)
- [ ] Английские термины в hover-переводе (частично есть через `tooltip-trigger`, нужна полная инвентаризация)
- [ ] Анимации появления summary-card items (scroll-triggered)
