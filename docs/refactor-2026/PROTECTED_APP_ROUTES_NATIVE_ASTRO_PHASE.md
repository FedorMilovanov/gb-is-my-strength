# 🚀 Protected App Routes Native Astro Phase (Research & Strategy)

**Дата:** 2026-06-24  
**Связано с:** `MAPS_ENGINE_RESEARCH_2026.md`, `MAPS_AND_REACT_REFACTOR_ROADMAP_2026.md`

## 1. Фундаментальный принцип

«Идеал — всё должно быть Astro-owned, но **не всё должно быть статьёй на Astro-компонентах**.»

Обычные страницы (статьи, каталоги, лендинги) успешно переводятся на строгий Native Astro (MDX + `ArticleLayout` / `BaseLayout`). Однако интерактивные маршруты (библейские карты, графы связей, родословие, 3D-визуализации баптизма) имеют сложный runtime, который нельзя ломать или превращать в статический текст.

**Анти-паттерн (как НЕ надо делать):**
❌ Слепая конвертация legacy map HTML в MDX.
❌ Использование `Seo.astro` или `BaseLayout.astro`, так как они инжектят глобальный `site.css` и `site.js`, которые могут сломать стилистику и UI интерактивного приложения (особенно карт, которые используют `map-engine.js` на полный экран).

**Архитектурный идеал (как было сделано в Пилоте `karty/ishod`):**
✅ **Native PageHead component**: Изолированный Astro-компонент, содержащий сырые `<meta>`, `<title>`, `JSON-LD` и `<style is:inline>` без подключения `site.css`.
✅ **Native Map/App component**: Изолированный Astro-компонент, рендерящий `<div id="stage">` и подключающий `map-engine.js`.
✅ **Data Contract**: Использование существующего `route.json` и API движка. Никакого `loadLegacyFullDocument`!

---

## 2. Инвентаризация: Protected App Routes

| Route | Тип App / Движок | Текущее состояние (Transport) | Идеальный Native-формат |
|---|---|---|---|
| `/karty/ishod/` | `map-engine.js` | ✅ **Strict-Native** | `IshodPageHead` + `IshodMap` |
| `/karty/avraam/` | `map-engine.js` (Custom SVG) | `loadLegacyFullDocument` shadow | `AvraamPageHead` + `AvraamMap` |
| `/karty/[остальные 8]` | `map-engine.js` | `loadLegacyFullDocument` shadow | `[Name]PageHead` + `[Name]Map` |
| `/map/` | Интерактивный граф | `loadLegacyFullDocument` shadow | Изолированный Graph Component + PageHead |
| `/rodosloviye/` | React Tree | `loadLegacyFullDocument` shadow | React Island + PageHead |
| `/konfessii/russkij-baptizm/` | 3D App / Canvas | `loadLegacyFullDocument` shadow | Astro wrapper + iframe / protected script |

---

## 3. Инструкция по пакетной миграции (на примере карт)

Пилот на `/karty/ishod/` оказался успешным. Для остальных карт (например, `avraam`):

1. **Создайте `[MapName]PageHead.astro`**:
   - Перенесите все мета-теги из legacy `index.html`.
   - Оставьте `theme-color` (для карт это обычно `#070a10`).
   - Перенесите скрипт `JSON-LD` один в один.
   - Оставьте критически важный `<style is:inline>` для базового сброса CSS.
   - **Не импортируйте `Seo.astro` или `site.css`!**

2. **Создайте `[MapName]Map.astro`**:
   - Перенесите `sr-only` заголовок `<h1>` с `data-pagefind-body` для локального поиска.
   - Создайте `<div id="stage">` (или любой другой корневой элемент движка).
   - Подключите `map-engine.js` через `<script is:inline src="../_engine/map-engine.js"></script>`.
   - Вставьте инлайн-скрипт инициализации, который загружает `route.json`.

3. **Обновите `index.astro`**:
   - Удалите `loadLegacyFullDocument`.
   - Импортируйте и отрендерите `<[MapName]PageHead />` внутри `<head>` и `<[MapName]Map />` внутри `<body>`.

4. **Проверки (GATES)**:
   - `npm run validate:strict`
   - `npm run owner:ui-guard`
   - `npm run karty:visual-parity:audit`
   - Сравните `dist/` версию визуально — не сломался ли zoom/pan.
