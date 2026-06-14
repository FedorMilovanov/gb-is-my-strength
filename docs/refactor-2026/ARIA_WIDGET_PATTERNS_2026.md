# ARIA_WIDGET_PATTERNS_2026.md — паттерны доступных интерактивных компонентов

Дата: 2026-06-12  
Связано с:

- `docs/ACCESSIBILITY_STANDARD_2026.md`
- `docs/ASTRO_COMPONENT_INVENTORY_2026.md`

---

## 1. Цель

React islands должны быть доступны по keyboard/screen reader. Нельзя просто сделать красивый div UI.

---

## 2. Базовое правило

```text
Native HTML first.
ARIA only when native element is insufficient.
```

Примеры:

```text
button action → <button>
link navigation → <a href>
dialog → <dialog> или role="dialog"
select → native select, если подходит
```

---

## 3. Buttons

MDN/Deque: если использовать non-button с `role="button"`, нужен `tabindex="0"` и keydown handlers для Enter/Space. Native `<button>` даёт это бесплатно.

Решение:

```text
Использовать <button> для действий.
SVG icon внутри button: aria-hidden="true" focusable="false".
```

---

## 4. Dialog / modal

Паттерн:

```text
role="dialog" or native <dialog>
aria-modal="true"
aria-labelledby
visible close button
Esc closes
focus moves in on open
focus returns to trigger on close
background inert / not focusable
```

---

## 5. Tabs

Если нужен настоящий tab UI:

```text
role="tablist"
role="tab"
role="tabpanel"
aria-selected
aria-controls / labelledby
Arrow keys move focus
Enter/Space activates if manual activation
```

Если это просто навигация между страницами — использовать обычные links, не tabs.

---

## 6. Combobox / command palette

Command palette может быть проще, чем полный combobox. Но если делать ARIA pattern:

```text
input role="combobox" or native input with listbox relationship
aria-expanded
aria-controls
listbox popup
option items
aria-activedescendant OR roving focus
Esc closes
ArrowDown/ArrowUp navigate
Enter activates
```

WAI-ARIA APG описывает combobox popup as listbox/tree/grid/dialog and `aria-controls` for popup. For complex widgets: Tab moves into/out of widget, arrows navigate inside.

---

## 7. Roving tabindex

Для composite widgets:

```text
один элемент tabindex="0"
остальные tabindex="-1"
стрелки меняют активный элемент
```

Применимо к:

```text
custom menu
result list
map marker list maybe
```

Но не злоупотреблять, если обычный список ссылок работает.

---

## 8. SVG maps / markers

Лучший вариант:

```text
SVG визуальный слой + HTML список мест как доступная альтернатива.
```

Если SVG marker интерактивен:

```html
<g role="button" tabindex="0" aria-label="Открыть место: Ур Халдейский">
```

Тогда обязательно:

```js
keydown Enter/Space → activate
visible focus style
not only color state
```

Но native HTML overlay buttons могут быть доступнее, если возможно.

---

## 9. Menus

Не использовать `role="menu"` для обычной навигации сайта. Для обычной навигации:

```html
<nav aria-label="Основная навигация">
  <a href="/articles/">Статьи</a>
</nav>
```

`role="menu"` имеет desktop-app ожидания по стрелкам и не нужен для простого сайта.

---

## 10. Search results

Простой доступный вариант:

```html
<form role="search">
  <label for="q">Поиск</label>
  <input id="q" name="q" />
</form>
<ol>
  <li><a href="/articles/foo/">...</a></li>
</ol>
```

Сложный combobox делать только если нужен autocomplete/command behavior.

---

## 11. Testing

```text
[ ] keyboard only
[ ] NVDA/VoiceOver smoke
[ ] axe/playwright
[ ] focus visible
[ ] Esc behavior
[ ] mobile touch
```

---

## 12. Итог

ARIA-паттерны нужны только там, где есть настоящий custom widget.

```text
Семантика сначала. ARIA потом.
```
