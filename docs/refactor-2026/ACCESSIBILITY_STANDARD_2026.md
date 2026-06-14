# ACCESSIBILITY_STANDARD_2026.md — стандарт доступности WCAG 2.2 для сайта

Дата: 2026-06-12  
Связано с:

- `docs/QUALITY_GATES_AND_TESTING_2026.md`
- `docs/MAPS_ENGINE_RESEARCH_2026.md`
- `docs/CONTENT_MODEL_AND_AUTHORING_2026.md`

---

## 1. Цель

Сайт должен быть доступен для:

```text
клавиатуры;
скринридеров;
мобильных touch-пользователей;
людей с низким зрением;
людей с моторными ограничениями;
читателей с разной когнитивной нагрузкой.
```

Цель соответствия:

```text
WCAG 2.2 AA как практический стандарт.
```

---

## 2. Почему WCAG 2.2

WCAG 2.2 добавил критерии, которые особенно важны для интерактивных сайтов:

```text
Focus Not Obscured
Dragging Movements
Target Size Minimum
Consistent Help
Redundant Entry
Accessible Authentication
```

Deque summary указывает: Dragging Movements требует, чтобы функциональность drag была достижима без dragging; Target Size Minimum — минимум 24×24 CSS px для pointer inputs; Focus Not Obscured — фокус не должен скрываться author-created content [3](https://dequeuniversity.com/resources/wcag-2.2/).

---

## 3. Базовые правила HTML

```text
[ ] один h1
[ ] логичная h2/h3 структура
[ ] списки как ul/ol
[ ] таблицы как table
[ ] кнопки как button
[ ] ссылки как a href
[ ] язык страницы html lang="ru"
[ ] древние языки с lang/he/grc и dir где нужно
```

Для иврита:

```html
<span lang="he" dir="rtl">אַבְרָהָם</span>
```

Для древнегреческого:

```html
<span lang="grc">λόγος</span>
```

---

## 4. Focus

```text
[ ] видимый focus-ring
[ ] focus не скрывается sticky header/footer
[ ] focus order соответствует визуальному порядку
[ ] нет keyboard traps
[ ] Skip link на основной контент
```

CSS стандарт:

```css
:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: 3px;
}
```

---

## 5. Target size

Минимум WCAG 2.2 AA:

```text
24×24 CSS px
```

Проектный стандарт лучше:

```text
desktop interactive: ≥ 32px
mobile/touch: ≥ 40–44px
```

Применить к:

```text
nav links
buttons
map controls
legend chips
close buttons
tabs
search result items
```

---

## 6. Keyboard navigation

Общие клавиши:

```text
Tab / Shift+Tab — переход по интерактивным элементам
Enter / Space — активация кнопок/ссылок/маркеров
Esc — закрыть modal/popup/panel
Arrow keys — внутри composite widgets, если применимо
```

---

## 7. Dialogs / modals

Для модалок:

```text
[ ] role="dialog" или native <dialog>
[ ] aria-modal="true" если modal
[ ] aria-labelledby на заголовок
[ ] видимая кнопка закрытия
[ ] Esc закрывает
[ ] focus moves into dialog on open
[ ] focus returns to trigger on close
[ ] background not accidentally focusable
```

Современные материалы по dialog accessibility подчёркивают focus management, Escape, close button, `aria-modal`, `aria-labelledby` [1](https://www.thewcag.com/examples/modals-dialogs).

---

## 8. MDX components accessibility

Каждый компонент должен быть доступным по умолчанию.

### Verse

```text
[ ] semantic blockquote/figure where appropriate
[ ] reference visible
[ ] no text as image
```

### Note / Warning

```text
[ ] role не злоупотреблять
[ ] цвет не единственный сигнал
[ ] icon + text label
```

### Tabs

Если tabs настоящие интерактивные:

```text
[ ] role=tablist/tab/tabpanel
[ ] arrow navigation
[ ] selected state
```

Если простые ссылки — обычные `<a>`.

---

## 9. Карты accessibility

Карта — самый сложный компонент.

Обязательное:

```text
[ ] transcript HTML до интерактива
[ ] список мест как обычные links/buttons
[ ] маркеры keyboard focusable
[ ] Enter/Space открывает место
[ ] Esc закрывает карточку
[ ] +/- zoom buttons
[ ] fit/reset button
[ ] drag alternative через buttons/list
[ ] touch targets ≥ 40px на mobile
[ ] prefers-reduced-motion
[ ] certainty не только цветом, но и текстом/паттерном
```

WCAG 2.2 Dragging Movements особенно важно для карт: drag-pan должен иметь альтернативу.

---

## 10. Search / command palette

```text
[ ] Ctrl/Cmd+K открывает
[ ] Esc закрывает
[ ] focus moves to input
[ ] results announced or accessible listbox pattern
[ ] arrow keys move selection
[ ] Enter opens result
[ ] focus returns after close
```

Если listbox pattern слишком сложен — лучше сделать простую форму + список ссылок.

---

## 11. Color / contrast

```text
[ ] обычный текст contrast ≥ 4.5:1
[ ] крупный текст ≥ 3:1
[ ] focus indicator ≥ 3:1
[ ] gold-on-dark проверить отдельно
[ ] muted text не должен быть слишком тусклым для важного контента
```

---

## 12. Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

Для карт/туров:

```text
[ ] отключить cinematic fly animations
[ ] заменить мгновенным переходом
```

---

## 13. Automated testing

Инструменты:

```text
axe-core/playwright
Lighthouse accessibility
HTML validator if needed
```

Но автоматические инструменты не ловят всё. WCAG чеклисты 2026 подчёркивают: автоматические checker'ы не могут полностью проверить focus management, keyboard traps, drag alternatives, screen reader UX [4](https://web-accessibility-checker.com/en/blog/wcag-2-2-checklist-2026).

---

## 14. Manual smoke checklist

Для каждого ключевого шаблона:

```text
[ ] пройти Tab от начала до конца
[ ] focus всегда виден
[ ] открыть/закрыть меню
[ ] открыть/закрыть modal
[ ] управлять search keyboard-only
[ ] открыть карту и место keyboard-only
[ ] mobile touch targets достаточно большие
[ ] увеличить zoom browser до 200%
[ ] проверить prefers-reduced-motion
```

---

## 15. CI gates

```text
[ ] axe no serious/critical violations on sample pages
[ ] no img without alt unless decorative
[ ] no button without accessible name
[ ] no link without href for important navigation
[ ] h1 count == 1
[ ] modal tests pass
```

---

## 16. Итог

Доступность — не отдельная полировка, а часть архитектуры:

```text
semantic HTML + Astro static content + accessible React islands + keyboard maps.
```
