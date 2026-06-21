# Site.js Decomposition Plan

**Дата:** 2026-06-22
**Файл:** `js/site.js` (569 lines minified, 4322 lines prettified, 215KB)
**Слушатели:** 194 addEventListener / 13 removeEventListener (15:1 leak ratio)

## Архитектура

Весь `site.js` — одна IIFE: `! function() { "use strict"; ... }()`
Внутри — каскад вложенных IIFE-секций, каждая вызывается немедленно.
Общая переменная `r` (config/utilities) используется повсюду.

## Функциональные зоны (хронологический порядок)

| Зона | Линии | Размер | Описание |
|------|-------|--------|----------|
| Utilities + TooltipController | 1-160 | 160 | `r.getConfig`, `r.debounce`, `r.positionTip`, `r.makeTooltipController` |
| Pointer/Touch handlers | 168-300 | 132 | `pointermove`, `touchstart/end`, `pointerdown` на document |
| Scroll/Progress | 334-500 | 166 | Reading progress bar, scroll spy |
| Theme toggle | 524-590 | 66 | `#themeToggle` click, localStorage, `html.dark` toggle |
| Share dialog | 590-700 | 110 | Telegram/WhatsApp/VK/FB share modal |
| TOC + Bottom bar | 700-1000 | 300 | TOC sidebar, bottom bar, mobile controls |
| Search/Command palette | 1000-1170 | 170 | Ctrl+K palette, search modal |
| Flip cards | 1172-1297 | 125 | `.flip-card`, `.error-flip-card` click handlers |
| Heading anchors | 2074-2087 | 13 | Copy heading URL |
| Footnotes | 2123-3208 | 1085 | `fn-marker`, `fn-sheet`, `fn-dove`, hover/tap |
| Bookmarks | 2743+ | ~50 | Bookmark engine integration |
| FAQ accordion | 2786 | ~10 | `.faq-accordion__q` click |
| Breadcrumb | 2841 | ~5 | Breadcrumb mobile |
| TTS player | 3330-3584 | 254 | `speechSynthesis`, play/pause |
| GBS2 series chrome | 3346-4238 | 892 | Rail, peek, swipe, resume, mobile head |
| Epigraph reveal | 3589-3616 | 27 | `.gbx-epi` line-by-line |
| Hero shrink | 3589-3641 | 52 | `.gbx-hero-shrink` fallback |
| Bible verse popovers | 3660-3716 | 56 | `.gbx-verse[data-verse]` |
| Original word cards | 3721-3778 | 57 | `.gbx-ow[data-ow]` |
| Next-article suggest | 3786-3830 | 44 | `.gbx-next-suggest` |
| Social share URLs | 3851 | ~5 | Selection share |
| Command palette "Continue" | 3889 | ~50 | Reading progress in Ctrl+K |
| Juxtapose slider | 3956-3959 | 3 | `.gbx-jux` drag |
| Offline save | 3988-4007 | 19 | `.gbs2-offline-btn` |
| Backlinks | 4077-4103 | 26 | `.gbx-backlinks__maplink` |
| StoryMap | 4112-4116 | 4 | `.gbx-storymap` auto-advance |
| Rail thumbnails | 4214+ | ~110 | Roman numeral injection |

## Проблемы

1. **Спагетти-зависимости**: `r` (config) — глобальный объект, используется везде
2. **Нет cleanup**: 194 addEventListener / 13 removeEventListener = memory leak
3. **Нет AbortController**: Невозможно остановить модуль при SPA-навигации
4. **Перекрёстные ссылки**: Tooltip controller (L60-4258) работает с DOM из всех секций
5. **Inline SVG**: ~2KB SVG-иконок внутри JS-кода
6. **Duplicate selectors**: `#themeToggle` обрабатывается 3 раза (L524, L2260, L3309)

## План декомпозиции

### Шаг 1: Создать `js/site-utils.js` (уже существует — проверить)

### Шаг 2: Выделить чистые модули

Приоритет по простоте выделения (минимум зависимостей от `r`):

| # | Модуль | Файл | Сложность | Зависимости от r |
|---|--------|------|-----------|------------------|
| 1 | Theme | `js/modules/theme.js` | Низкая | `r.themeKey`, `r.barThemeBtn` |
| 2 | FAQ accordion | `js/modules/faq-accordion.js` | Низкая | Нет |
| 3 | Flip cards | `js/modules/flip-cards.js` | Низкая | Нет |
| 4 | Heading anchors | `js/modules/heading-anchors.js` | Низкая | Нет |
| 5 | Epigraph reveal | `js/modules/epigraph.js` | Низкая | Нет |
| 6 | Juxtapose slider | `js/modules/juxtapose.js` | Низкая | Нет |
| 7 | TTS player | `js/modules/tts.js` | Средняя | `r.getConfig` |
| 8 | Footnotes | `js/modules/footnotes.js` | Высокая | `r.makeTooltipController`, `r.positionTip` |
| 9 | GBS2 series | `js/modules/gbs2-series.js` | Высокая | `r.getConfig`, `r.debounce` |
| 10 | Search/Command palette | `js/modules/command-palette.js` | Высокая | `r.getConfig`, feature flags |

### Шаг 3: Создать `js/site-v2.js` (бандл)

```bash
# Используя esbuild
npx esbuild js/modules/theme.js js/modules/faq-accordion.js ... \
  --bundle --minify --sourcemap \
  --outfile=js/site-v2.js
```

### Шаг 4: Pilot-страница подключает `site-v2.js` вместо `site.js`

### Шаг 5: Interactive-audit pilot

### Шаг 6: Mass rollout (если pilot OK)

## Оценка времени

- Шаг 1-2 (чистые модули): 4-6 часов ручной работы
- Шаг 3 (бандл): 1 час
- Шаг 4-5 (pilot + audit): 2 часа
- Шаг 6 (rollout): зависит от audit результатов

## Критерий успеха

- 194 → <50 addEventListener (остальные через AbortController)
- 13 → <50 removeEventListener (cleanup на каждый listener)
- Memory: listener count стабилен после 5 переходов
- Interactive-audit: 0 console errors
