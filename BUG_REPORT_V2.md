# 🔬 ВЕРИФИЦИРОВАННЫЙ БАГ-ОТЧЁТ V2

**Проект:** gospod-bog.ru (GitHub Pages)
**Репозиторий:** [FedorMilovanov/gb-is-my-strength](https://github.com/FedorMilovanov/gb-is-my-strength)
**Дата аудита:** 2026-05-16
**Метод:** автоматический + ручной аудит по реальному коду из main-ветки
**Всего HTML-страниц:** 18 (включая articles/index.html, nagornaya/index.html)

---

## Содержание

| № | Раздел | Кол-во |
|---|--------|--------|
| 1 | [🔴 Критические баги](#-1-критические-баги) | 14 |
| 2 | [🟠 SEO / Структурные проблемы](#-2-seo--структурные-проблемы) | 16 |
| 3 | [🟡 Производительность](#-3-производительность) | 9 |
| 4 | [🔵 Доступность (A11Y / WCAG)](#-4-доступность-a11y--wcag) | 8 |
| 5 | [🟣 Безопасность](#-5-безопасность) | 2 |
| 6 | [⚙️ CI/CD и инструменты](#%EF%B8%8F-6-cicd-и-инструменты) | 8 |
| 7 | [⚪ Мелкие недочёты / Code Quality](#-7-мелкие-недочёты--code-quality) | 10 |
| 8 | [❌ Опровергнутые пункты](#-8-опровергнутые-пункты) | 6 |
| | **Итого уникальных багов** | **67** |

---

## 🔴 1. Критические баги

### КР-01. `<picture>` + `srcset` на `<img>` одновременно

**Файл:** `index.html`, строка 540
**Суть:** Карточка «Тёмная сторона кафедры» — внутри `<picture>` тег `<source srcset="...hero-main.webp">`, а на вложенном `<img>` **тоже** прописан `srcset="hero-600w.webp 600w, hero-900w.webp 900w, hero.png 800w"` с `sizes`. Браузер получает два конкурирующих набора источников: `<source>` уже выбрал webp, а `srcset` на `<img>` предлагает ещё и png. Спецификация HTML говорит: если `<picture>` содержит `<source>` с `type`, он побеждает — но `srcset` на `<img>` вносит путаницу и грузит лишние байты при предзагрузке.

**Исправление:** Убрать `srcset` и `sizes` с `<img>` внутри `<picture>`. Оставить `src="...hero.png"` как fallback и `<source>` для каждого формата/размера:
```html
<picture>
  <source srcset="hero-600w.webp 600w, hero-900w.webp 900w, hero-main.webp 800w"
          sizes="(max-width: 640px) 600px, (max-width: 1024px) 900px, 800px"
          type="image/webp">
  <img src="hero.png" alt="..." width="800" height="420" loading="lazy" decoding="async">
</picture>
```

---

### КР-02. Статья `20-antisovetov-pastoru` не представлена на главной

**Файл:** `index.html`
**Суть:** Файл статьи существует (`articles/20-antisovetov-pastoru/index.html`), прописан в `feed.xml`, в `search-manifest.json` и в `pastor-series/index.html`. Но на главной странице (`index.html`) — 0 упоминаний. Ни в секции «Публикации», ни в «Разбор заблуждений». Пользователь не найдёт статью без поиска.

**Исправление:** Добавить карточку статьи в соответствующий `<ul class="h-article-list">`.

---

### КР-03. Пустой `<ul class="h-article-list">` в DOM

**Файл:** `index.html`, ~строка 570
**Суть:** Из трёх экземпляров `<ul class="h-article-list">` один полностью пуст (0 `<li>`). Создаёт лишний отступ (margin/padding от CSS) и вводит скринридер в заблуждение: озвучивает «список, 0 элементов».

**Исправление:** Либо наполнить (вероятно, это место для КР-02), либо удалить пустой `<ul>`.

---

### КР-04. `<meta name="referrer" content="no-referrer">` на двух статьях

**Файлы:** `articles/20-antisovetov-pastoru/` (строка 13), `articles/kod-da-vinchi/` (строка 15)
**Суть:** Полностью обрывает реферальные данные на уровне страницы. Яндекс.Метрика теряет источник трафика → весь он записывается как «прямой». На остальных 16 страницах тега нет — непоследовательно. В `kod-da-vinchi` дополнительно 7 Wikimedia-изображений имеют `referrerpolicy="no-referrer"` на `<img>` — это корректно (не раскрывать origin Wikimedia), но мета-тег страницы ломает именно аналитику.

**Исправление:**
- Убрать `<meta name="referrer" content="no-referrer">` из обоих файлов.
- `referrerpolicy="no-referrer"` на `<img>` Wikimedia оставить — это правильная точечная настройка.

---

### КР-05. `404.html` с относительными путями

**Файл:** `404.html`
**Суть:** Все пути к ресурсам — относительные: `fonts/fonts.css`, `css/site.css`, `js/site.js`. GitHub Pages раздаёт `404.html` по любому несуществующему адресу, но **не меняет базовый путь**. При ошибке на `/articles/foo/` браузер ищет `/articles/fonts/fonts.css` → ещё один 404. Страница ошибки отображается без стилей и скриптов.

**Исправление:** Сделать все пути абсолютными: `/fonts/fonts.css`, `/css/site.css`, `/js/site.js` и т.д. Либо добавить `<base href="/">` в `<head>`.

---

### КР-06. `readingTime: 1` на всех 5 частях Нагорной проповеди + баг `countWords()`

**Файлы:** `nagornaya/chast-{1..5}/index.html`, `scripts/update-meta.js`
**Суть:** В `SITE_CONFIG` каждой части `readingTime: 1`. Причина — **баг regex** в функции `countWords()`:

```js
html.match(/<(?:main|section)[^>]*data-pagefind-body[^>]*>([\s\S]*?)<\/(?:main|section)>/i)
```

Ленивый квантор `[\s\S]*?` останавливается на первом `</section>` (через ~3800 символов), тогда как весь `<main>` = ~70 000 символов. Захватывает ~90 слов → `readTime = max(1, round(90/200)) = 1`.

**Тройное расхождение данных:**
| Источник | chast-1 | chast-2 | chast-3 | chast-4 | chast-5 |
|----------|---------|---------|---------|---------|---------|
| `SITE_CONFIG` (HTML) | 1 мин | 1 мин | 1 мин | 1 мин | 1 мин |
| `data/series.json` | 25 мин | 22 мин | 24 мин | 28 мин | 23 мин |
| Реальный подсчёт | ~16 мин | ~11 мин | ~12 мин | ~32 мин | ~25 мин |

**Цепной эффект:**
- `nagornaya-mobile-toc.js` показывает «1 мин» в нижней панели
- `bookmark-engine.js` использует `readingTime` для `completedAtProgress` — пользователь получает «прочитано» через 1–2 минуты вместо реальных 15–30

**Исправление:**
```js
// Заменить lazy-матч на явный поиск закрывающего тега
const mainOpen = html.search(/<main[^>]*data-pagefind-body[^>]*>/i);
const mainClose = html.lastIndexOf('</main>');
const body = mainOpen >= 0 && mainClose > mainOpen
  ? html.slice(html.indexOf('>', mainOpen) + 1, mainClose)
  : '';
```
Затем: `node scripts/update-meta.js --force-all` для пересчёта.

---

### КР-07. Anti-FOUC скрипт отсутствует на всех страницах `nagornaya/`

**Файлы:** Все 9 HTML в `nagornaya/` (chast-1..5, index, istochniki, nakhodki, seriya)
**Суть:** Главная (`index.html`) содержит инлайн-скрипт `localStorage.getItem('theme')` перед CSS, который добавляет класс `.dark` на `<html>` до рендера. Все страницы `nagornaya/` — 0 вхождений `localStorage`. Пользователь в тёмной теме получает белую вспышку (FOUC) при каждом переходе.

**Исправление:** Добавить в `<head>` каждой nagornaya-страницы **перед** CSS:
```html
<script>
  try { if (localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark'); } catch(e) {}
</script>
```

---

### КР-08. `site.js`, `site.css`, `fonts.css` не подключены в `nagornaya/`

**Файлы:** Все 9 HTML в `nagornaya/`
**Суть:** Grep по всем nagornaya-файлам: 0 совпадений для `site.js`, `site.css`, `fonts.css`. Страницы используют только `tw.min.css`, `nagornaya-mobile-toc.css`, `command-palette.css`. Это означает:
- Нет единой системы переключения темы
- Нет общих CSS-переменных
- Нет шрифтов Lora (системные serif)
- Нет команд-палитры в едином стиле
- Визуально эти страницы — **отдельный сайт**

**Исправление:** Подключить на каждой nagornaya-странице `site.css`, `fonts.css`, `site.js`. Проверить совместимость с `tw.min.css` (конфликты стилей). Долгосрочно — единый CSS-билд.

---

### КР-09. FacebookBot заблокирован в `robots.txt`

**Файл:** `robots.txt`
**Суть:** `User-agent: FacebookBot` / `Disallow: /`. FacebookBot — **не** бот для AI-тренинга; это бот для генерации превью ссылок в Facebook/Instagram (используется для speech recognition и NLP). Но **основной** бот превью — `facebookexternalhit`, который отдельно **не упомянут** и ходит под `User-agent: *` (Allow: /). Таким образом:
- `facebookexternalhit` → разрешён (через `*`) → превью генерируются ✓
- `FacebookBot` → заблокирован → это AI-бот Meta, блок обоснован ✓

**Статус:** ~~Критичный~~ → **Снижен до информационного**. Превью Facebook/Instagram работают через `facebookexternalhit`. Блок `FacebookBot` — корректная защита от AI-тренинга Meta.

---

### КР-10. `skip-link` указывает на несуществующий `#main-content`

**Файлы:** 8 из 9 nagornaya-страниц (все кроме `seriya/`)
**Суть:** `<a href="#main-content" class="skip-link">Перейти к содержимому</a>` присутствует, но элемента с `id="main-content"` — нет. Клавиатурный пользователь нажимает Enter → ничего не происходит. **Нарушение WCAG 2.4.1**.

**Исправление:** Добавить `id="main-content"` на `<main>` каждой nagornaya-страницы.

---

### КР-11. `search-manifest.json` содержит дубликаты

**Файл:** `data/search-manifest.json`
**Суть:** 16 записей при 12 уникальных URL. `/pastor-series/` × 3, `/articles/20-antisovetov-pastoru/` × 3. Пользователь видит одну и ту же статью трижды в результатах поиска команд-палитры.

**Исправление:** Удалить дубли. Добавить проверку уникальности в `validate.js`.

---

### КР-12. BreadcrumbList в 6 nagornaya-страницах ведёт через `/articles/`

**Файлы:** `nagornaya/chast-{1..5}/index.html`, `nagornaya/index.html`
**Суть:** JSON-LD BreadcrumbList: pos 2 = `https://gospod-bog.ru/articles/` (name: «Статьи»). Но `/nagornaya/` **не является** подразделом `/articles/` — это отдельная директория в корне. Google показывает неверный хлебный путь в SERP. У `nagornaya/seriya/`, `istochniki/`, `nakhodki/` — корректный pos 2 = `/nagornaya/`.

**Исправление:** Изменить pos 2 на `https://gospod-bog.ru/nagornaya/` (name: «Нагорная проповедь») для всех 6 страниц.

---

### КР-13. Шрифты .woff2 отсутствуют в репозитории

**Файл:** `fonts/` (содержит только `fonts.css`)
**Суть:** `fonts.css` объявляет 25 `@font-face` правил с путями `./Lora/lora-cyrillic-400.woff2` и т.д. Файлов шрифтов в git нет. `deploy.yml` не вызывает `npm run fonts:download`. При клонировании и деплое — все шрифты отсутствуют, браузер падает на системный.

**Исправление:**
1. Добавить шаг `npm run fonts:download` в `deploy.yml` (после Checkout, перед Pagefind)
2. Либо закоммитить .woff2 в git (они лицензионно свободны, суммарно ~500 КБ)

---

### КР-14. `fonts.css` не в `PRECACHE_ASSETS` Service Worker

**Файл:** `sw.js`
**Суть:** В массиве `PRECACHE_ASSETS` есть `site.css`, `home.css`, все JS, но `/fonts/fonts.css` **отсутствует**. При офлайн-посещении шрифты не загрузятся → FOUT (Flash of Unstyled Text) или системный шрифт.

**Исправление:** Добавить `'/fonts/fonts.css'` в `PRECACHE_ASSETS`.

---

## 🟠 2. SEO / Структурные проблемы

### СЕО-01. og:image в формате WebP без JPEG-fallback

**Страницы:** `index.html`, `about/`, `hermenevtika/`, `kod-da-vinchi/`, `krajne/`, все 9 nagornaya-страниц (11 из 18)
**Суть:** og:image ссылается на .webp. По данным на 2026, Facebook, LinkedIn и все основные мессенджеры **поддерживают WebP** для og:image. Однако некоторые старые клиенты и RSS-ридеры могут не справиться.

**Важно:** JPEG-файлы для 3 страниц уже физически существуют, но не прописаны в мета:
- `images/og-preview.jpg` (272 КБ) → для `index.html`
- `images/og-kod-da-vinchi.jpg` → для `kod-da-vinchi`
- `images/og-krajne-isporcheno.jpg` → для `krajne`

**Исправление (при необходимости обратной совместимости):** Прописать второй `<meta property="og:image">` с JPEG как fallback после WebP-тега. Для большинства современных ботов это необязательно.

---

### СЕО-02. RSS `<image><url>` указывает на .webp

**Файл:** `feed.xml`
**Суть:** `og-preview-1200x630.webp` в `<image><url>`. Спецификация RSS 2.0 рекомендует GIF, JPEG или PNG. Feedly и Inoreader могут не обработать.

**Исправление:** Заменить на `og-preview.jpg` (уже существует в `/images/`).

---

### СЕО-03. `manifest.json`: абсолютные URL + отсутствующие поля

**Файл:** `manifest.json`
**Проблемы:**
1. `start_url`: `https://gospod-bog.ru/` → должен быть `/`
2. `scope`: `https://gospod-bog.ru/` → должен быть `/`
3. Все 4 иконки — абсолютные URL → должны быть относительные пути
4. Отсутствуют: `screenshots` (нужен для PWA install prompt на desktop), `orientation`, `categories`
5. `short_name: "ГБ — СМ"` — длинное тире на Android может обрезаться → лучше «ГБ-СМ» или «ГБ»

**Исправление:**
```json
{
  "start_url": "/",
  "scope": "/",
  "orientation": "portrait-primary",
  "categories": ["education", "books"],
  "icons": [
    { "src": "/favicon-120.png", "sizes": "120x120", "type": "image/png" },
    ...
  ],
  "screenshots": [
    { "src": "/images/screenshot-wide.png", "sizes": "1280x720", "type": "image/png", "form_factor": "wide" }
  ]
}
```

---

### СЕО-04. `<title>` — три разных шаблона в серии «Нагорная проповедь»

| Страница | `<title>` | Длина |
|----------|-----------|-------|
| chast-1 | Два текста, один Иисус — Нагорная проповедь I \| gb | 87 |
| chast-2 | Нагорная проповедь II: синоптическая проблема \| gb | 88 |
| chast-3 | Нагорная проповедь: кому она адресована — Церкви или Израилю? \| gb | **118** |
| chast-4 | Можно ли доверять Евангелиям? \| Нагорная проповедь IV | 95 |
| chast-5 | Закон, Евангелие и Нагорная проповедь \| Часть V \| gb | 89 |

**Проблемы:**
- `| gb` — непрофессиональная аббревиатура, не совпадает с остальным сайтом (`| Господь Бог — Сила Моя`)
- chast-4 — без суффикса `| gb` вовсе, другой формат
- chast-5 — двойной разделитель `|`
- chast-3 — 118 символов (Google обрезает после ~55–60 в SERP)

**Исправление:** Унифицировать шаблон: `Тема — Нагорная проповедь N | Господь Бог — Сила Моя` (≤60 символов). Убрать `| gb` из whitelist в `validate.js`.

---

### СЕО-05. `og:type="profile"` без обязательных полей в `about/`

**Файл:** `about/index.html`
**Суть:** `<meta property="og:type" content="profile">` без `profile:first_name`, `profile:last_name`, `profile:username`. OG Protocol требует эти поля при `type=profile`.

**Исправление:** Добавить:
```html
<meta property="profile:first_name" content="Фёдор">
<meta property="profile:last_name" content="Милованов">
```

---

### СЕО-06. `about/index.html` без `BreadcrumbList`

**Файл:** `about/index.html`
**Суть:** JSON-LD содержит только Organization, WebSite, ProfilePage. BreadcrumbList отсутствует → страница автора не получает хлебных крошек в SERP.

**Исправление:** Добавить BreadcrumbList: Главная → О библиотеке.

---

### СЕО-07. `hreflang="en"` указывает на внешний PDF

**Файл:** `articles/hermenevtika/index.html`, строки 36–38
**Суть:** `<link rel="alternate" hreflang="en" href="https://tms.edu/.../TMSJ-Volume-27-Number-2.pdf">`. Google считает английской версией этой страницы PDF на чужом домене. Это нарушает hreflang-контракт и может размыть ссылочный вес.

**Исправление:** Убрать `hreflang="en"`. Если нужно указать оригинал — использовать `<link rel="cite-as">` или поле `isBasedOn` в JSON-LD.

---

### СЕО-08. `datePublished: 2016-09-01` в `hermenevtika`

**Файл:** `articles/hermenevtika/index.html`
**Суть:** JSON-LD ScholarlyArticle: `datePublished: 2016-09-01T00:00:00+00:00` — это дата оригинала Абнера Чау, не дата публикации перевода. Google воспринимает страницу как 10-летний контент.

**Исправление:** `datePublished` = дата публикации перевода. Дату оригинала → `isBasedOn.datePublished: 2016-09-01`.

---

### СЕО-09. `twitter:site` и `twitter:creator` отсутствуют

**Файлы:** Все 18 страниц
**Суть:** `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image` — есть. Но `twitter:site` и `twitter:creator` — 0 вхождений. Карточки в X работают, но без атрибуции аккаунта.

**Исправление:** Добавить на все страницы (если есть аккаунт X):
```html
<meta name="twitter:site" content="@аккаунт">
<meta name="twitter:creator" content="@аккаунт">
```

---

### СЕО-10. `article:section` и `article:tag` отсутствуют в nagornaya

**Файлы:** Все 5 частей nagornaya (chast-1..5)
**Суть:** У статей в `articles/` есть `article:section` и `article:tag`, у nagornaya — нет. Непоследовательно; Google использует эти теги для категоризации.

---

### СЕО-11. `nagornaya/istochniki` и `nakhodki`: `robots: index, follow`

**Файлы:** `nagornaya/istochniki/index.html`, `nagornaya/nakhodki/index.html`
**Суть:** Вспомогательные страницы (библиография 66+ позиций, заметки) полностью проиндексированы. Конкурируют с основными статьями за один семантический кластер.

**Исправление:** `<meta name="robots" content="noindex, follow">` + убрать из RSS.

---

### СЕО-12. `og:type="website"` на `nagornaya/seriya/`

**Файл:** `nagornaya/seriya/index.html`
**Суть:** Страница содержит полноценный статейный обзор серии, но помечена как `website`. JSON-LD — `CollectionPage` (корректно), но OG-тип не совпадает.

**Исправление:** Заменить на `og:type="article"`.

---

### СЕО-13. Sitemap: смешанный формат `<lastmod>`

**Файл:** `sitemap.xml`
**Суть:** 5 записей — `YYYY-MM-DD`, 12 записей — `YYYY-MM-DDTHH:MM:SS+03:00`. Google предпочитает единый W3C Datetime.

**Исправление:** Привести все к `YYYY-MM-DD`.

---

### СЕО-14. Sitemap: нет `image:title` и `image:caption`

**Файл:** `sitemap.xml`
**Суть:** 49 тегов `image:image` содержат только `<image:loc>`. Google Image Search использует `image:title` и `image:caption` для ранжирования.

**Исправление:** Транслировать `alt`-тексты из HTML в `<image:title>`.

---

### СЕО-15. `pastor-series/` не в `paths` workflow `indexnow.yml`

**Файл:** `.github/workflows/indexnow.yml`
**Суть:** Paths: `articles/**`, `nagornaya/**`, `about/**`, `index.html`, `404.html`, ... — но **нет** `pastor-series/**`. При изменении pastor-series CI не запускается: ни cache-bust, ни validate, ни IndexNow.

**Исправление:** Добавить `'pastor-series/**'` в `paths`.

---

### СЕО-16. Split JSON-LD: два блока `application/ld+json` без единого `@graph`

**Файлы:** 13 из 18 страниц
**Суть:** Первый блок — `@graph` с Organization/WebSite/Article/BreadcrumbList. Второй — JSON-массив `[{ImageObject}]` **без `@id`**, не связанный с `Article.image` из первого блока. Google Search Console предпочитает единый `@graph`.

**Исправление:** Объединить ImageObject в основной `@graph` с `@id` для связывания.

---

## 🟡 3. Производительность

### ПФ-01. Preload LCP: `imagesrcset` не указан

**Файлы:** `index.html` (строка 122), все 5 частей nagornaya
**Суть:** `<link rel="preload" as="image" href="images/og-nagornaya-propoved.webp">` — без `imagesrcset`. На мобильных (`< 640px`) браузер из `srcset` на `<img>` выберет `600w`, но preload тянет `800w` → двойная загрузка LCP-изображения.

**Исправление:**
```html
<link rel="preload" as="image" fetchpriority="high"
  imagesrcset="images/og-nagornaya-propoved-600w.webp 600w,
               images/og-nagornaya-propoved-900w.webp 900w,
               images/og-nagornaya-propoved.webp 800w"
  imagesizes="(max-width: 640px) 600px, (max-width: 1024px) 900px, 800px">
```

---

### ПФ-02. `og-hero.png` (1.1 МБ) как og:image

**Файлы:** `pastor-series/index.html`, `articles/20-antisovetov-pastoru/index.html`
**Суть:** og:image → `og-hero.png` (1.1 МБ). Рядом лежит `og-hero.webp` (94 КБ) — в **11.7 раз** меньше. При шаринге в Telegram/VK/WhatsApp бот-парсер загружает 1.1 МБ.

**Исправление:** Заменить на `og-hero.webp` в мета-тегах (или создать оптимизированный JPEG ≤300 КБ).

---

### ПФ-03. AVIF не используется

**Суть:** Скрипт `scripts/build-avif.sh` существует, но `.avif` файлов — 0, `<source type="image/avif">` в HTML — 0. Потенциальная экономия 30–50% по сравнению с WebP на библиотеке из 100+ изображений.

**Исправление:** Запустить `build-avif.sh`, добавить `<source type="image/avif">` в `<picture>`, прописать шаг в CI.

---

### ПФ-04. `CACHE_CONTENT` без LRU-лимита

**Файл:** `sw.js`
**Суть:** `IMG_CACHE_LIMIT = 60` для изображений есть, для контентного кеша (`CACHE_CONTENT`) — нет `maxEntries`. CacheStorage будет расти неограниченно → может превысить квоту браузера (~50–100 МБ).

**Исправление:** Добавить LRU-механизм аналогично `CACHE_IMAGES`:
```js
var CONTENT_CACHE_LIMIT = 30;
// В staleWhileRevalidate после cache.put:
cache.keys().then(function(keys) {
  if (keys.length > CONTENT_CACHE_LIMIT) cache.delete(keys[0]);
});
```

---

### ПФ-05. `CACHE_VERSION = 'gb-v4'` статичен

**Файл:** `sw.js`
**Суть:** `cache-bust.js` хеширует CSS/JS, но **не трогает** `CACHE_VERSION` в `sw.js`. При изменении стратегий кеширования старые кеши (`gb-v4-static`, `gb-v4-content`) не инвалидируются. Браузер может отдавать устаревшие файлы.

**Исправление:** В `cache-bust.js` вычислять хеш содержимого `sw.js` и записывать его в `CACHE_VERSION`:
```js
const swHash = md5short('sw.js');
// Заменить: var CACHE_VERSION = 'gb-v4';
// На: var CACHE_VERSION = 'gb-v4-' + swHash.slice(0,6);
```

---

### ПФ-06. `SITE_CONFIG.version = 1` статична на всех страницах

**Файлы:** Все HTML с `SITE_CONFIG`
**Суть:** `sw-register.js` регистрирует SW через `/sw.js?v=1`. При деплое версия не обновляется → старый SW может оставаться активным до 24 часов.

**Исправление:** Связать `version` с cache-bust: в `cache-bust.js` обновлять `version: 1` → `version: <timestamp>` в каждом HTML.

---

### ПФ-07. Нет `<link rel="preload" as="font">` ни на одной странице

**Суть:** Несмотря на self-hosting шрифтов, критически важный `Lora cyrillic 400` woff2 не прелоадится. Браузер узнаёт о нём только при разборе `fonts.css` → **два сетевых roundtrip** до первого байта шрифта.

**Исправление:** На каждой странице добавить:
```html
<link rel="preload" as="font" type="font/woff2"
      href="/fonts/Lora/lora-cyrillic-400.woff2" crossorigin>
```

---

### ПФ-08. `tw.min.css` без `prefers-reduced-motion`

**Файл:** `nagornaya/tw.min.css`
**Суть:** 0 вхождений `prefers-reduced-motion`. `site.css` — 5, `home.css` — 2. Все Tailwind-анимации (переходы, трансформации) на nagornaya-страницах срабатывают при системном флаге «снизить анимацию».

**Исправление:** Добавить в конец `tw.min.css`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

---

### ПФ-09. JS/CSS не минифицированы

**Суммарно:** ~590 КБ сырого кода (site.js 166 КБ, site.css 208 КБ, search.js 62 КБ, home.css 61 КБ). GitHub Pages отдаёт gzip (~150–180 КБ), но минификация через Terser + cssnano сократила бы до ~80–90 КБ gzip.

**Исправление:** Добавить шаг минификации в CI (`deploy.yml`) перед Pagefind:
```yaml
- name: Minify assets
  run: |
    npx terser js/site.js -o js/site.js -c -m
    npx cssnano css/site.css css/site.css
```

---

## 🔵 4. Доступность (A11Y / WCAG)

### A11-01. Иврит, греческий, латынь без `lang` атрибута

**Файлы:** `hermenevtika` (43+ вхождений), `krajne` (3), `kod-da-vinchi` (8), `nagornaya/chast-1` (6+)
**Суть:** `<em>πτωχός</em>`, `<span class="hb-front">יְהוִה</span>` — без `lang="el"`, `lang="he"`, `lang="la"`. Скринридер произносит ивритский текст русским TTS-голосом.

**Исправление:** Обернуть все иноязычные вставки:
```html
<em lang="el">πτωχός</em>
<span lang="he" class="hb-front">יְהוִה</span>
```

---

### A11-02. `cp-status` без `aria-live`

**Файл:** `js/search.js`, строка 85
**Суть:** `<span class="cp-status" id="cp-status"></span>` создаётся без `aria-live="polite"`. При обновлении счётчика результатов через `textContent` скринридер не объявляет изменение.

**Исправление:**
```js
'<span class="cp-status" id="cp-status" aria-live="polite" role="status"></span>'
```

---

### A11-03. Focus trap командной палитры — неполный

**Файл:** `js/search.js`, строки 1181–1190
**Суть:** `case 'Tab'` перехватывает нажатие и циклит только по 4 scope-вкладкам (Все/Статьи/Писание/Авторы). Кнопка закрытия `cp-close`, поле ввода `cp-input`, элементы `#cp-listbox` — **вне Tab-цикла**. Пользователь клавиатуры не доберётся до кнопки «×» — только Escape. **Нарушение WCAG 2.4.3**.

**Исправление:** Реализовать полноценный focus trap (как в share dialog, `site.js` строки 698–774):
```js
var focusable = modal.querySelectorAll('input, button, [tabindex]:not([tabindex="-1"])');
// Cycle through all: first → last → first
```

---

### A11-04. `href="javascript:void(0)"` на 54 библейских ссылках

**Файлы:** `hermenevtika` (43), `kod-da-vinchi` (8), `krajne` (3)
**Суть:** Нарушение WCAG 2.1.1 (Keyboard). Не работает Ctrl+Click (новая вкладка), не копируется правой кнопкой, screen reader не объявляет как корректную ссылку.

**Исправление:** Заменить на `<button type="button" class="bref">` или `<span role="button" tabindex="0" class="bref">`.

---

### A11-05. `aria-current` отсутствует в навигации

**Файл:** `index.html` (и другие)
**Суть:** `<ul class="h-nav-links">` — ни один пункт не имеет `aria-current="page"`. Assistive technology не может определить текущую страницу.

**Исправление:** Добавить `aria-current="page"` на активный пункт (или обновлять через JS при навигации).

---

### A11-06. Главная: нет ссылки на `/articles/` в навигации

**Файл:** `index.html`
**Суть:** `<ul class="h-nav-links">` содержит только якоря `#publikacii`, `#razbor`, `#about`. Полный каталог статей `/articles/` недоступен из меню.

**Исправление:** Добавить пункт `<li><a href="/articles/">Все статьи</a></li>`.

---

### A11-07. `color-mix()` без CSS-fallback

**Файл:** `css/site.css`
**Суть:** 20 из 23 вхождений `color-mix()` — без fallback-значения выше. Safari < 16.2 (iOS 16.1 и ниже) рендерит прозрачный фон.

**Исправление:** Перед каждым `color-mix()` добавить строку-fallback:
```css
background: #e8e4df; /* fallback */
background: color-mix(in srgb, var(--surface) 85%, var(--accent));
```

---

### A11-08. `visualViewport.addEventListener('scroll')` без `{passive: true}`

**Файл:** `js/site.js`, строка 403
**Суть:** Единственный оставшийся scroll-listener без passive (все остальные — с passive, ранее заявлялось 3–12, но проверка контекста подтвердила: только 1).

**Исправление:**
```js
window.visualViewport.addEventListener('scroll', vvAdjust, { passive: true });
```

---

## 🟣 5. Безопасность

### БЕЗ-01. IndexNow ключ в открытом репозитории

**Файл:** `34dbdd34-965b-4934-a5d4-d18a0a783600.txt`
**Суть:** Публичный GitHub Pages репо → любой может использовать ключ для IndexNow-запросов от имени домена. В `indexnow.yml` есть fallback: `KEY=$(cat 34dbdd34-*.txt)`, что подтверждает использование файла.

**Исправление:**
1. Удалить файл из git (`git rm`)
2. Добавить `.txt` ключа в `.gitignore`
3. Хранить только в `secrets.INDEXNOW_KEY`
4. Сгенерировать новый ключ (старый считать скомпрометированным)

---

### БЕЗ-02. Нет HTTP-заголовков безопасности

**Суть:** Нет `_headers` файла для CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy`. GitHub Pages не позволяет нативно устанавливать заголовки.

**Исправление:** Если сайт за Cloudflare — Transform Rules или Workers. Если нет — добавить CSP через `<meta>`:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' https://mc.yandex.ru https://commons.wikimedia.org; script-src 'self' 'unsafe-inline' https://mc.yandex.ru;">
```

---

## ⚙️ 6. CI/CD и инструменты

### CI-01. `validate.js` не покрывает `pastor-series/`, `about/`, `index.html`

**Файл:** `scripts/validate.js`
**Суть:** `main()` итерирует `fs.readdirSync(ARTICLES)` → только `articles/`. Все 14 проверок (canonical, og:image, byline, BreadcrumbList, color-mix, inline-стили) не запускаются для остальных страниц. `nagornaya/` проверяется только на наличие в sitemap/feed, но **не через `validateArticle()`**.

**Исправление:** Расширить main() для обхода всех HTML или завести отдельную функцию `validatePage()`.

---

### CI-02. `validate.js` whitelist содержит `' | gb'`

**Файл:** `scripts/validate.js`, строка 208
**Суть:** `for (const sfx of [SITE_SUFFIX, ... ' | gb', ...])` — непрофессиональный суффикс nagornaya пройдёт CI без предупреждения.

**Исправление:** Убрать `' | gb'` из whitelist. Исправить заголовки nagornaya на единый формат с полным брендом.

---

### CI-03. `deploy.yml` не запускает Node.js / `npm run`

**Файл:** `.github/workflows/deploy.yml`
**Суть:** Единственный build-шаг — `npx pagefind`. Шрифты не скачиваются (`fonts:download`), `cache-bust.js` не запускается. Деплоит то, что уже есть в git. `cache-bust.js` запускается в `indexnow.yml`, но `deploy.yml` может сработать через `workflow_dispatch` или `workflow_run` в обход `indexnow.yml`.

**Исправление:** Добавить шаги в `deploy.yml`:
```yaml
- uses: actions/setup-node@v4
  with: { node-version: '20' }
- run: npm ci
- run: node scripts/download-fonts.js
- run: node scripts/cache-bust.js
```

---

### CI-04. `update-meta.js` не обрабатывает `pastor-series/` и `about/`

**Файл:** `scripts/update-meta.js`
**Суть:** Обновляет sitemap/feed только для `articles/` и `nagornaya/`. `article:modified_time` для pastor-series и about обновляется только вручную.

---

### CI-05. `seo-audit.js` не проверяет `twitter:site/creator`, `og:image` формат, focus trap

**Файл:** `scripts/seo-audit.js`
**Суть:** Проверяет twitter:card/title/description/image, но не twitter:site/creator. Не проверяет формат og:image (WebP vs JPEG). Все 11 страниц с WebP-only og:image проходят без ошибок.

---

### CI-06. `series-cards.js` и `glossary.js` — мёртвые файлы

**Файлы:** `js/series-cards.js`, `js/glossary.js`, `data/glossary.json`
**Суть:** Оба в `cache-bust.js` ASSETS, но **ни один** не подключён через `<script src>` на любой странице. `glossary.json` содержит 40+ терминов — живые данные без рендеринга.

**Исправление:** Либо подключить на нужных страницах, либо убрать из ASSETS и пометить как WIP.

---

### CI-07. `console.group('[SITE_CONFIG validation]')` без debug-гейта

**Файл:** `js/site.js`, строки 461–463
**Суть:** При невалидном SITE_CONFIG пишет предупреждения в консоль в продакшене при каждой загрузке.

**Исправление:**
```js
if (window.SITE_CONFIG && window.SITE_CONFIG.debug) {
  console.group('[SITE_CONFIG validation]');
  errors.forEach(function (e) { console.warn(e); });
  console.groupEnd();
}
```

---

### CI-08. Pagefind не работает при локальной разработке

**Суть:** `pagefind/pagefind.js` в `PRECACHE_ASSETS`, но папка `pagefind/` генерируется только в CI. При локальном запуске SW падает на `cache.add('/pagefind/pagefind.js')` с 404 и не активируется.

**Исправление:** Обернуть в `try/catch` с `console.warn`:
```js
cache.add(url).catch(function(err) {
  console.warn('[SW] Failed to precache:', url, err);
});
```
*(Уже частично сделано через `Promise.allSettled`, но стоит проверить что SW всё равно активируется.)*

---

## ⚪ 7. Мелкие недочёты / Code Quality

### МН-01. `title` атрибут на `<img>` — 44+ штук
`kod-da-vinchi` (13), `krajne` (18), `20-antisovetov` (10), `hermenevtika` (2), `index.html` (1). Устаревшая практика, всё нужное уже в `alt`. Расценивается как SEO-спам.

### МН-02. Яндекс.Метрика: `ecommerce: "dataLayer"` без объявления `window.dataLayer`
Файл: `index.html`. Не падает, но ecommerce-события никогда не будут записаны.

### МН-03. Яндекс.Метрика: 11 из 17 страниц без `referrer` и `url` в `ym.init`
| С полным init | Без referrer/url |
|---------------|-----------------|
| index, about, articles/index, hermenevtika, kod-da-vinchi, krajne (6) | 20-antisovetov, pastor-series, все 9 nagornaya (11) |

Трафик на 11 страницах приходит в Метрику без источника перехода. 404.html — без Метрики (намеренно).

### МН-04. `theme-color` различается между разделами
- Главная/articles: `#171411` (dark)
- Nagornaya: `#1c1917` (dark)
- About: `#0e1116` (dark)

Мигание цвета адресной строки Chrome при навигации.

### МН-05. Inline `style=""` — массово
`20-antisovetov`: 140 вхождений, включая ~48 hardcoded hex-цветов (#d97706, #2b6cb0, #e11d48) которые не адаптируются к тёмной теме. `kod-da-vinchi`: 32. `index.html`: 9.

### МН-06. `managingEditor` и `webMaster` в `feed.xml` → невалидный email
`noreply@gospod-bog.ru` — нет MX-записи для домена (GitHub Pages). RSS-агрегаторы могут пометить фид как недостоверный.

### МН-07. `feed.xml`: канальный `<description>` без CDATA + item nagornaya без CDATA с HTML
Канальное описание — без `<![CDATA[]]>`. Item 1 (nagornaya/index) содержит `<p>` и `<a>` в description без CDATA — строгий XML-парсер сломается.

### МН-08. `highlights.js` и `enhancements.js` не подключены на `pastor-series/` и `20-antisovetov/`
Читатели двух объёмных материалов лишены сохранения цитат и прогресс-бара чтения.

### МН-09. 7 внешних изображений Wikimedia в `kod-da-vinchi`
Загружаются через `commons.wikimedia.org/wiki/Special:Redirect/file/` — нестабильный URL. Не кешируются SW (только same-origin). При недоступности Wikimedia — пропадут.

### МН-10. МАКС share: без UTM-параметров
`site.js`, строка 792: `encodeURIComponent(shareUrl)` напрямую, без `utmUrl()`. Все остальные платформы (Telegram, VK, WhatsApp, OK) — через `utmUrl()`. Трафик с МАКС — без источника.

---

## ❌ 8. Опровергнутые пункты

Следующие пункты из оригинального отчёта были **верифицированы и признаны неверными**:

| Заявление | Статус | Причина |
|-----------|--------|---------|
| «about/ без Яндекс.Метрики» | ❌ Опровергнуто | `ym(108353327, 'init', {...})` присутствует с полным набором параметров (referrer, url, ecommerce) |
| «12 scroll без {passive: true}» | ❌ Опровергнуто | Полная проверка контекста показала: только **1** обработчик (L403, `visualViewport`) без passive. Все остальные (L887, L924, L962, L1074, L1290, L3577) закрываются `}, { passive: true });` |
| «XSS через innerHTML в search.js» | ❌ Снижен | `escHtml()` применяется на всех пользовательских данных. Pagefind excerpt генерируется из контента самого сайта. Практического вектора атаки нет |
| «sitemap.xml нет xmlns:image» | ❌ Опровергнуто | Пространство имён объявлено в строке 2. 49 тегов `image:image` / `image:loc` присутствуют |
| «Facebook/Instagram превью не работают» | ❌ Уточнено | `facebookexternalhit` (бот превью) **не заблокирован** — работает через `User-agent: *` (Allow: /). Заблокирован `FacebookBot` (AI-тренинг Meta) — это корректно |
| «highlights.js отсутствует на nagornaya» | ❌ Опровергнуто | Подключён на chast-1..5. Отсутствует только на `pastor-series/` и `20-antisovetov/` |

---

## 📊 Сводная матрица покрытия

| Страница | site.js | site.css | fonts.css | anti-FOUC | Метрика полн. | highlights | enhancements | article:section |
|----------|---------|----------|-----------|-----------|--------------|------------|--------------|-----------------|
| index.html | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — |
| about/ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — |
| articles/index | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — |
| hermenevtika | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| kod-da-vinchi | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| krajne | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 20-antisovetov | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| pastor-series | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | — |
| nagornaya/* (9) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅* | ✅* | ❌ |

*\* на chast-1..5, не на index/istochniki/nakhodki/seriya*

---

## 🏁 Приоритеты исправления

### 🔥 Немедленно (блокирует пользователей / ломает функциональность)
1. **КР-05** — 404.html с относительными путями
2. **КР-06** — countWords() regex → readingTime: 1
3. **КР-07 + КР-08** — nagornaya без site.js/css/fonts/anti-FOUC (системное: подключить единую CSS/JS-инфраструктуру)
4. **КР-10** — skip-link без цели (WCAG)
5. **КР-13** — woff2 в CI (deploy.yml fonts:download)

### ⚡ Скоро (SEO / аналитика / кеш)
6. **КР-01** — picture+srcset
7. **КР-02 + КР-03** — 20-antisovetov на главной + пустой ul
8. **КР-12** — BreadcrumbList через /articles/
9. **СЕО-04** — title шаблоны nagornaya
10. **МН-03** — Метрика referrer/url на 11 страницах
11. **CI-03** — deploy.yml Node.js шаги

### 📋 Плановое (качество / оптимизация)
12. Все остальные SEO, A11Y, Performance пункты
13. Минификация JS/CSS
14. AVIF
15. Удаление мёртвых файлов (glossary.js, series-cards.js)
