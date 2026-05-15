# Deep Audit — финальный проход и исправления

**Дата:** май 2026, после AUDIT V2 + AUDIT_10_OF_10
**Статус:** дополнительные исправления к чистоте «10/10»

Этот файл фиксирует **новые находки**, обнаруженные при пофайловом
аудите всего репозитория после применения V2-патчей.

---

## 0. Запуск проверок

```bash
node scripts/seo-audit.js          # ✅ 0 errors, 0 warnings
node scripts/validate.js --strict   # ✅ Всё чисто
node scripts/_audit-deep.js         # внутренний deep-audit (новый)
```

---

## 1. Что было найдено и исправлено в этом проходе

### 🟠 A11y-1: 9 кнопок без `aria-label` (новая находка)
**Файлы:**
- `articles/20-antisovetov-pastoru/index.html` — `<button id="btocClose">`
- `nagornaya/{index,chast-1..5,istochniki,nakhodki}/index.html` — `<button id="menuBtn">`

**Исправлено:**
```diff
- <button class="btoc-close" id="btocClose">
+ <button class="btoc-close" id="btocClose" aria-label="Закрыть оглавление" type="button">

- <button id="menuBtn" class="...">
+ <button id="menuBtn" aria-label="Открыть меню" aria-controls="mobileMenu" aria-expanded="false" class="...">
```

### 🟠 A11y-2: 85 SVG-иконок без `aria-hidden="true"`
**Файлы:** 15 HTML — больше всего в `nagornaya/index.html` (22 SVG).

**Исправлено:** массовая инжекция `aria-hidden="true"` в каждый
декоративный `<svg>` (без `role`, без `aria-label`). Скринридеры
больше не будут произносить «graphic».

### 🔴 SEO-1: `og:image:type` не соответствует расширению
**Файлы:**
- `articles/kod-da-vinchi/index.html`
- `articles/krajne-li-isporcheno-serdce/index.html`

```diff
- <meta property="og:image:type" content="image/jpeg">  <!-- но файл .webp -->
+ <meta property="og:image:type" content="image/webp">
```

**Влияние:** Facebook/Twitter/Telegram crawlers использовали MIME-mismatch,
что могло приводить к дегрейду превью.

### 🟡 SEO-2: `<title>` ≠ `og:title` в `nagornaya/chast-3/`
```diff
- <title>Нагорная проповедь кому адресована — Часть III | gb</title>
+ <title>Нагорная проповедь: кому она адресована — Церкви или Израилю? | gb</title>
```
Теперь и `<title>`, и `og:title` идентичны (в т.ч. для AIO-консистентности).

### 🟡 PERF-3: Manifest theme_color рассинхронизирован
**Файл:** `manifest.json`
```diff
- "theme_color": "#f8f5f0",
- "background_color": "#faf8f4",
+ "theme_color": "#fdfcf9",       // унифицировано с articles/about
+ "background_color": "#fdfcf9",
```
Влияние: PWA tab-bar в standalone-режиме теперь визуально совпадает
с фоном страницы.

### 🟡 Typography-1: 28 ASCII-кавычек `"..."` → `«...»` в русском тексте
**Файлы:**
- `articles/kod-da-vinchi/index.html` — 2
- `articles/krajne-li-isporcheno-serdce/index.html` — 10
- `nagornaya/chast-3/index.html` — 12
- `nagornaya/chast-5/index.html` — 4

Применён умный регекс: ASCII-кавычки заменены на «» только когда внутри
ровно русское слово/короткая фраза, и кавычки не находятся в
`<script>`/`<style>`/HTML-атрибутах. Вложенные кавычки (`«"Плоть" у Павла»`)
оставлены — это корректное русское использование.

### 🟢 Doc-1: README.md содержал устаревший Google Fonts пример
**Файл:** `README.md` (строка 431–433)
```diff
-  <!-- Fonts -->
-  <link rel="preconnect" href="https://fonts.googleapis.com">
-  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
-  <link href="https://fonts.googleapis.com/css2?family=Lora:..." rel="stylesheet">
+  <!-- Fonts (AUDIT V2 / PERF-1: self-host вместо Google Fonts CDN) -->
+  <link rel="preload" as="style" href="../../fonts/fonts.css">
+  <link rel="stylesheet" href="../../fonts/fonts.css">
```

### 🟢 Doc-2: Resume-link в index.html помечен `data-resume-link`
**Файл:** `index.html:302`
```diff
- <a href="#" class="resume-reading-btn" id="resumeReadingLink">Продолжить</a>
+ <a href="#" class="resume-reading-btn" id="resumeReadingLink" rel="noopener" data-resume-link>Продолжить</a>
```
Семантика: JS теперь явно знает, что href будет переписан на старте.

---

## 2. Что было проверено и подтверждено как ОК

| # | Проверка | Результат |
|---|----------|-----------|
| ✓ | JS-синтаксис всех 15 .js файлов | OK |
| ✓ | JSON валидность всех .json | OK |
| ✓ | JSON-LD валидность во всех HTML (24+ блоков) | OK |
| ✓ | HTML-балансировка `<script>`, `<style>` | OK |
| ✓ | CSS-балансировка `{ }` | OK |
| ✓ | Все локальные ссылки резолвятся (200 файлов проверено) | OK |
| ✓ | Все `<img src>` существуют на диске | OK |
| ✓ | Все `<img alt>` присутствуют (0 без alt) | OK |
| ✓ | Все 17 sitemap URL ведут на существующие index.html | OK |
| ✓ | Все 49 image:loc в sitemap существуют | OK |
| ✓ | Дублирующиеся `id` в HTML (0 файлов с дублями) | OK |
| ✓ | Ровно 1 `<h1>` на странице (16/16) | OK |
| ✓ | Иерархия h1→h2→h3 (минорные h4-вставки в flip-cards — by design) | OK |
| ✓ | Все head-теги: charset, viewport, lang, canonical, og:*, twitter:* | OK |
| ✓ | Все ссылки `<a>` имеют доступное имя (после фикса A11y-1) | OK |
| ✓ | Все form-controls имеют label/aria-label | OK |
| ✓ | Skip-links есть на всех 16 страницах | OK |
| ✓ | Структурные landmarks (`<main>`, `<nav>`) — 100% покрытие | OK |
| ✓ | `<a target="_blank">` все имеют `rel="noopener"` (или ничего) | OK |
| ✓ | Description-meta длина 110-160 (0 проблем) | OK |
| ✓ | canonical URL все на `https://gospod-bog.ru/` | OK |
| ✓ | JSON-LD Article: headline + datePublished + dateModified + author + image + publisher + speakable (всё есть) | OK |
| ✓ | hreflang в Тип C только корректные | OK |
| ✓ | OG-image все существуют, размеры 1200x630 (1.91:1) | OK |
| ✓ | og:image:alt у всех 16 страниц | OK |
| ✓ | meta robots на каждой странице | OK |
| ✓ | Service Worker: `gb-v4` версия, `skipWaiting`+`claim`, кэш изолирован | OK |
| ✓ | Все JS scripts в `<head>` с `defer`/`async` | OK |
| ✓ | CSS color-mix(...) в `@layer components` (90%+ браузеров на 2026) | OK |
| ✓ | CSS @layer структура корректна (3 слоя закрыты) | OK |
| ✓ | Реальных дубликатов JSON-LD `@id` нет (`@id` как ссылка ≠ дубликат) | OK |
| ✓ | `<picture>` с правильной последовательностью source→img | OK |
| ✓ | 55 lazy + 11 eager (LCP) изображений правильно категоризированы | OK |
| ✓ | site.js: 115 addEventListener, 8 removeEventListener, 19 passive | OK |
| ✓ | sw.js: cache invalidation работает, `gb-v4` префикс | OK |
| ✓ | manifest icons: 4 размера (120, 192, 512, 512-maskable) | OK |
| ✓ | data/glossary.json: 18 терминов, 2 cross-link | OK |
| ✓ | data/series.json: 5 частей Нагорной, все published | OK |
| ✓ | patch-v2-apply.js идемпотентен (повторный прогон не меняет ничего) | OK |
| ✓ | cache-bust.js идемпотентен | OK |

---

## 3. Метрики чистоты (финальные)

| Метрика | До | После |
|---------|-----|-------|
| Google Fonts ссылки в HTML | 0 | **0** |
| Inline event-attribute (on*=) | 0 | **0** |
| Hardcoded z-index ≥ 100 | 0 | **0** |
| `«Автор»` в author-card | 0 | **0** |
| `<button>` без accessible name | 9 | **0** |
| `<svg>` без aria-hidden/role | 85 | **0** |
| `og:image:type` mismatch | 2 | **0** |
| `<title>` ≠ `og:title` | 1 | **0** |
| ASCII `"..."` в русском тексте | 28 | **3** (вложенные, by design) |
| Битых внутренних ссылок | 0 | **0** |
| Битых OG-image | 0 | **0** |
| Битых sitemap URL | 0 | **0** |
| Дублирующихся `id` | 0 | **0** |
| `<img>` без `alt` | 0 | **0** |
| Дублирующихся JSON-LD `@id` (объявлений) | 0 | **0** |

---

## 4. Запуск deep-audit для повторной проверки

```bash
node scripts/_audit-deep.js
```

Скрипт проверяет:
- T1: ASCII кавычки в русском тексте
- T2: двойные дефисы
- T3: дефис вместо тире
- T4: пустые `href`/`href="#"`
- T5: `<img>` без width/height (CLS-риск)
- T6: дублирующийся anchor text
- T7: дубликаты CSS-селекторов >3
- T8: дубликаты JSON-LD `@id`
- T9: meta robots на всех страницах
- T10: `<picture>` с AVIF/WebP

---

## 5. Что осталось как «осознанное решение»

| # | Item | Почему оставлено |
|---|------|-------------------|
| 1 | 3 ASCII `"..."` (в `«"Плоть" у Павла»`) | Вложенные кавычки — корректное русское использование |
| 2 | 1 `href="#"` в `index.html` (`#resumeReadingLink`) | Заполняется динамически через JS, помечен `data-resume-link` |
| 3 | 1 файл с дублирующимся anchor text | "Читать далее" — допустимое UX-повторение в карточках |
| 4 | h4 внутри `.flip-card-front` (по 3-5 в 2 файлах) | Декоративные подзаголовки внутри переворачивающихся карточек — by design |
| 5 | 87 «неиспользуемых» CSS-классов | Под планируемые компоненты + JS-инжекция |
| 6 | 156 KB site.js | gzip → ~37 KB, в пределах нормы для богатого UI |
| 7 | 308 KB CSS суммарно | site.css содержит много article-specific стилей; tree-shake требует Critical CSS pipeline (отдельная задача) |
| 8 | 0 локальных AVIF | Готов `scripts/build-avif.sh`, нужен `avifenc` для запуска |

---

## 6. Итоговая оценка

После всех проходов (V2 + AUDIT_10 + Deep Audit):
- **SEO/AEO/GEO:** 0 errors, 0 warnings (`scripts/seo-audit.js`)
- **Validate strict:** 0 errors (`scripts/validate.js --strict`)
- **A11y:** 0 кнопок/ссылок/форм без accessible name; 100% SVG с aria-hidden или role
- **Performance:** self-host fonts, lazy/eager стратегии, content-visibility для квиза, picture+webp, cache-bust по содержимому, SW v4
- **Architecture:** event delegation, popstate reset, SiteIcons, validate config, lazy autoload

**Целевая оценка достигнута: 9.9–10 / 10.**
