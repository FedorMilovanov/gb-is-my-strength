# Пакет селективных улучшений для Агента 8: Windows High Contrast & Print Cohesion

**Назначение:** Готовый к переносу патч для интегратора Агента 8 (`arena/7f634191`) при формировании канонического PR #2338.  
**Источник:** Наработки Агента 7 (`arena/86b34c57`, PR #2341).  
**Совместимость:** 100% совместимо с нативной архитектурой Агента 8 (не затрагивает JS, не перетирает нативный TOC).

---

## 1. Поддержка Windows High Contrast (`forced-colors: active`)

### 1.1. В `src/components/journal/JournalMasthead.astro`
**Проблема:** При включении высококонтрастного режима Windows (`forced-colors: active`) браузер заменяет прозрачные границы `border-bottom: 2px solid transparent;` на системный цвет `CanvasText`. В результате все ссылки навигации мастхеда получают видимое подчёркивание и выглядят одинаково активными.
**Решение:** Явно указать цвет `Canvas` для неактивных ссылок и `Highlight` для активной ссылки `[aria-current]`:

```css
/* Windows High Contrast: прозрачные границы становятся видимыми, текущий раздел выделяется системным Highlight. */
@media (forced-colors: active) {
  .je-masthead__nav a { border-bottom-color: Canvas; }
  .je-masthead__nav a[aria-current] { border-bottom-color: Highlight; }
}
```

### 1.2. В `src/components/journal/journalEditorial.css`
**Проблема:** В режиме высокой контрастности градиентная заливка тега рубрики `.journal-story-tag` (`background: linear-gradient(...)`) отключается браузером, и тег теряет визуальные границы.
**Решение:** Задать явную системную рамку `1px solid CanvasText`:

```css
/* Windows High Contrast: сохранение контура плашки рубрики при отключении градиента. */
@media (forced-colors: active) {
  .journal-edition .journal-story-tag { border: 1px solid CanvasText; }
}
```

---

## 2. Защита заголовков и раскрываемых блоков при печати (`@media print`)

### В `src/components/journal/journalEditorial.css`
**Решение:** Защитить заголовки и элемент `<summary>` от отрыва от последующего текста (`break-after: avoid`):

```css
@media print {
  /* Защита от «висячих» заголовков и раскрываемых описаний */
  .journal-edition :is(h2, h3, h4, .module-label, .eyebrow, summary, .je-history-heading) {
    break-after: avoid;
  }
}
```

---

## 3. Проверочный сценарий для интегратора

После внедрения указанных правил:
1. Запустить проверку контрастности через эмуляцию в Playwright:
   ```js
   await page.emulateMedia({ forcedColors: 'active' });
   ```
2. Убедиться, что:
   - Неактивные ссылки `.je-masthead__nav a:not([aria-current])` имеют вычисленный `border-bottom-color` равный `Canvas` (или совпадает с фоном).
   - Активная ссылка `[aria-current]` имеет `border-bottom-color` равный `Highlight`.
   - `.journal-story-tag` имеет видимую границу `CanvasText`.
