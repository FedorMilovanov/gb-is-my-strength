# Архитектура сайта — Господь Бог — Сила Моя
## Версия 2.0 — Апрель 2026

---

---

## SEO-инфраструктура — Версия 2.0 (Апрель 2026)

### Что настроено

| Файл / место | Что делает |
|---|---|
| `.github/workflows/indexnow.yml` | При каждом push в `main` автоматически уведомляет Яндекс и Bing об изменённых страницах через IndexNow |
| `sitemap.xml` | Содержит все страницы включая `/articles/` |
| `feed.xml` | RSS-лента для агрегаторов и поиска |
| `turbo-feed.xml` | Яндекс Турбо-страницы — ускоренные версии статей для мобильного поиска |
| `articles/index.html` | Страница-каталог всех статей; промежуточный уровень в BreadcrumbList |
| JSON-LD `@graph` главной | `WebSite` + `CollectionPage` + `Person` (с `sameAs` на соцсети) |
| JSON-LD статей | `Article` / `ScholarlyArticle` + `BreadcrumbList` (3 уровня: Главная → Статьи → Статья) |

### IndexNow — что нужно сделать один раз

1. Сгенерировать ключ на [indexnow.org](https://www.indexnow.org/en)
2. Положить файл `{ключ}.txt` в корень репозитория (содержимое файла = сам ключ)
3. В GitHub → Settings → Secrets → Actions добавить секрет `INDEXNOW_KEY` = значение ключа
4. Зарегистрировать ключ в [Яндекс.Вебмастер → IndexNow](https://webmaster.yandex.ru/indexnow/) и [Bing Webmaster](https://www.bing.com/indexnow)

После этого каждый `git push main` будет автоматически уведомлять поисковики.

### Яндекс Турбо — что нужно сделать один раз

Зарегистрировать `turbo-feed.xml` в Яндекс.Вебмастер:
Сайты → gospod-bog.ru → Турбо-страницы → Добавить ленту → `https://gospod-bog.ru/turbo-feed.xml`

---

## Добавление новой статьи — полный чеклист

### 1. Создать файл статьи

```
articles/{slug}/index.html
```

Взять за основу шаблон ниже. Slug — строчные латинские буквы и дефисы, без слэша в начале.

### 2. Обязательные мета-теги в `<head>`

```html
<!-- SEO -->
<title>Заголовок статьи — Господь Бог — Сила Моя</title>
<meta name="description" content="150–160 символов, описывает суть статьи.">
<meta name="keywords" content="ключевое слово 1, слово 2, слово 3">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
<meta name="author" content="Фёдор Милованов">
<!-- Если статья — перевод, добавить обе строки: -->
<!-- <meta name="author" content="Имя Автора Оригинала"> -->
<!-- <meta name="translator" content="Фёдор Милованов"> -->
<meta name="geo.region" content="RU-SPE">
<meta name="geo.placename" content="Санкт-Петербург">
<link rel="canonical" href="https://gospod-bog.ru/articles/{slug}/">
<link rel="alternate" type="application/rss+xml" title="Господь Бог — Сила Моя — RSS" href="https://gospod-bog.ru/feed.xml">

<!-- Open Graph -->
<meta property="og:type" content="article">
<meta property="og:title" content="Краткий заголовок без сайта">
<meta property="og:description" content="Описание для соцсетей, 1–2 предложения.">
<meta property="og:url" content="https://gospod-bog.ru/articles/{slug}/">
<meta property="og:image" content="https://gospod-bog.ru/images/{slug}-preview.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/jpeg">
<!-- Если изображение .webp — менять на image/webp -->
<meta property="og:image:alt" content="Описание изображения">
<meta property="og:site_name" content="Господь Бог — Сила Моя">
<meta property="og:locale" content="ru_RU">
<meta property="article:published_time" content="2026-MM-DDT00:00:00+03:00">
<meta property="article:modified_time" content="2026-MM-DDT00:00:00+03:00">
<meta property="article:author" content="Фёдор Милованов">
<meta property="article:section" content="Богословие">
<!-- Повторить для каждого тега: -->
<meta property="article:tag" content="тег 1">
<meta property="article:tag" content="тег 2">

<!-- Preload LCP-изображения (если есть hero-картинка в начале статьи) -->
<link rel="preload" as="image" fetchpriority="high" href="../../images/{slug}-hero.jpg">
```

### 3. JSON-LD в `<head>`

```json
{
  "@context": "https://schema.org",
  "@graph": [
  {
    "@type": "Article",
    "@id": "https://gospod-bog.ru/articles/{slug}/#article",
    "headline": "Полный заголовок статьи",
    "description": "Краткое описание.",
    "url": "https://gospod-bog.ru/articles/{slug}/",
    "datePublished": "2026-MM-DDT00:00:00+03:00",
    "dateModified": "2026-MM-DDT00:00:00+03:00",
    "inLanguage": "ru",
    "author": { "@id": "https://gospod-bog.ru/about/#person" },
    "publisher": { "@id": "https://gospod-bog.ru/about/#person" },
    "image": {
      "@type": "ImageObject",
      "url": "https://gospod-bog.ru/images/{slug}-preview.jpg",
      "width": 1200,
      "height": 630
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "https://gospod-bog.ru/articles/{slug}/"
    },
    "articleSection": "Богословие",
    "keywords": "ключевые слова через запятую"
  },
  {
    "@type": "BreadcrumbList",
    "itemListElement": [
      {"@type": "ListItem", "position": 1, "name": "Главная", "item": "https://gospod-bog.ru/"},
      {"@type": "ListItem", "position": 2, "name": "Статьи", "item": "https://gospod-bog.ru/articles/"},
      {"@type": "ListItem", "position": 3, "name": "Название статьи", "item": "https://gospod-bog.ru/articles/{slug}/"}
    ]
  }
  ]
}
```

Если статья — перевод, заменить тип `Article` на `ScholarlyArticle` и добавить поле `translator`:
```json
"@type": "ScholarlyArticle",
"author": { "@type": "Person", "name": "Имя Автора Оригинала" },
"translator": { "@id": "https://gospod-bog.ru/about/#person" }
```

### 4. Обновить `sitemap.xml`

Добавить блок перед `</urlset>`:
```xml
<url>
  <loc>https://gospod-bog.ru/articles/{slug}/</loc>
  <lastmod>2026-MM-DDT00:00:00+03:00</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.9</priority>
</url>
```

### 5. Обновить `feed.xml`

Добавить `<item>` в начало `<channel>` (новые статьи идут первыми):
```xml
<item>
  <title>Заголовок статьи</title>
  <link>https://gospod-bog.ru/articles/{slug}/</link>
  <guid isPermaLink="true">https://gospod-bog.ru/articles/{slug}/</guid>
  <pubDate>Mon, 01 Jan 2026 00:00:00 +0000</pubDate>
  <dc:creator>Фёдор Милованов</dc:creator>
  <category>Богословие</category>
  <description><![CDATA[
    <p>Краткое описание статьи для RSS-читалок.</p>
    <p><a href="https://gospod-bog.ru/articles/{slug}/">Читать статью →</a></p>
  ]]></description>
</item>
```

### 6. Обновить `turbo-feed.xml`

Добавить `<item>` аналогично `feed.xml`, добавив Турбо-поля:
```xml
<item>
  <title>Заголовок статьи</title>
  <link>https://gospod-bog.ru/articles/{slug}/</link>
  <guid isPermaLink="true">https://gospod-bog.ru/articles/{slug}/</guid>
  <pubDate>Mon, 01 Jan 2026 00:00:00 +0000</pubDate>
  <turbo:content>enabled</turbo:content>
  <yandex:author>Фёдор Милованов</yandex:author>
  <yandex:topic>Богословие</yandex:topic>
  <enclosure url="https://gospod-bog.ru/images/{slug}-preview.jpg" type="image/jpeg" length="0"/>
  <yandex:full-text><![CDATA[
    <!-- Полный HTML тела статьи из <article>...</article> -->
  ]]></yandex:full-text>
</item>
```

### 7. Добавить карточку на `/articles/index.html` и на `index.html`

В обоих файлах — в нужный раздел (`<section id="publikacii">` или `<section id="razbor">`) добавить `<li>` с карточкой статьи по образцу существующих карточек.

### 8. Обновить `lastBuildDate` в `feed.xml`

```xml
<lastBuildDate>Mon, 01 Jan 2026 00:00:00 +0000</lastBuildDate>
```

### 9. Подготовить OG-изображение

Размер: **1200 × 630 px** (соотношение 40:21).
Форматы: `.jpg` или `.webp`. Если `.jpg` — в мета-теге `og:image:type` указать `image/jpeg`.
Разместить в `/images/`.

### 10. IndexNow — автоматически

После `git push main` GitHub Actions сам отправит URL новой статьи в Яндекс и Bing. Ничего делать не нужно — только убедиться, что секрет `INDEXNOW_KEY` настроен (один раз).

---

## Структура файлов (актуальная)

```
/
├── index.html                              ← Главная страница
├── about/index.html                        ← Страница об авторе
├── articles/
│   ├── index.html                          ← Каталог всех статей (/articles/)
│   ├── {slug}/index.html                   ← Каждая статья в своей папке
│   └── ...
├── css/
│   ├── site.css                            ← Все общие стили
│   └── home.css                            ← Стили главной страницы
├── js/
│   ├── site.js                             ← Все общие скрипты
│   └── bookmark-engine.js                  ← Движок закладок (не трогать)
├── images/                                 ← Все изображения
├── sitemap.xml                             ← Карта сайта для поисковиков
├── feed.xml                                ← RSS-лента
├── turbo-feed.xml                          ← Яндекс Турбо-страницы
├── robots.txt                              ← Управление ботами (вкл. AI-боты)
├── {indexnow-key}.txt                      ← Ключ IndexNow (добавить вручную)
└── .github/
    └── workflows/
        └── indexnow.yml                    ← GitHub Actions: push-индексация
```


---

## Что вынесено в site.css (40 секций)

| # | Секция |
|---|--------|
| 01 | Reset |
| 02 | Variables / Colors / Dark theme |
| 03 | Body / Typography base |
| 04 | Layout (.page-wrap, main.article-main, main.home-main) |
| 05 | Theme toggle |
| 06 | Breadcrumb |
| 07 | Article header |
| 08 | Article body |
| 09 | Homepage header & article list |
| 10 | Utility blocks (info, warn, quote, ehrman, opusdei) |
| 11 | Tables |
| 12 | Figures |
| 13 | Timeline |
| 14 | FAQ |
| 15 | TOC Sidebar (desktop scrollspy) |
| 16 | Mobile Bottom Bar + TOC Overlay (код да Винчи style) |
| 17 | Mobile TOC slide panel (герменевтика style) |
| 18 | Buttons / Progress / Back-to-top / Share / Section label |
| 19 | Flip Cards |
| 20 | Quiz |
| 21 | Bookmark / Resume toast |
| 22 | Homepage Resume Reading blocks |
| 25–27 | Footnote tooltips (fn-ref, fn-marker, bref/btip) |
| 28 | Heading anchors |
| 29 | Sources block |
| 30 | Drop caps |
| 31 | Author card |
| 32 | Footer |
| 33 | Epigraph / About |
| 34 | SDG / Cross |
| 35 | Print |
| 36 | Reduced motion |
| 37 | Article date display |
| 38 | Article end block (кнопки + SDG + крест) |
| 39 | Quiz review mode (разбор ошибок, бонусный тизер) |
| 40 | Article UI components (stat-grid, compare-cards, pq-scripture, faq-accordion, summary-card) |

---

## Что вынесено в site.js (20 модулей)

| # | Модуль | Триггер |
|---|--------|---------|
| 01 | `window.SiteUtils` — helpers | Всегда |
| 02 | Theme Toggle | `#themeToggle`, `#barThemeBtn` |
| 03 | Share | `#shareBtn`, `#barShareBtn` |
| 04 | Reading Progress Bar | `#reading-progress` |
| 05 | Back To Top | `#back-to-top` |
| 06 | Section Label | `#section-label` |
| 07 | Mobile TOC (slide panel) | `#toc-toggle`, `#toc-panel` |
| 08 | Desktop TOC (scrollspy) | `#tocSidebar` |
| 09 | Bottom App Bar + BTOC Overlay | `#bottomBar`, `#btocOverlay` |
| 10 | Timeline Animation | `.timeline-anim li` |
| 11 | Animate Boxes on Scroll | `.quote-box`, `.warn-box` и др. |
| 12 | Footnote Tooltips (fn-ref) | `sup a[href^="#src"]` |
| 13 | Flip Cards toggle + keyboard | `.flip-card`, `.error-flip-card` |
| 14 | Flip Card Fingers | `.flip-card-front` |
| 15 | Flip Card Height Sync | Авто |
| 16 | Quiz Engine v3 (основной тест + разбор ошибок + бонусный раунд) | `#quizWrapper` + `SITE_CONFIG.quiz` |
| 17 | Heading Anchor Copy | `.heading-anchor` |
| 18 | Hover bridge for fn-marker | Desktop only |
| 19 | Bible Reference Tooltips | `.bref[data-ref]` + `#bibleRefs` |
| 20 | Academic Footnotes | `.fn-marker` |
| 21 | Typography (неразрывные пробелы) | `article, .article-body` |
| 22 | Keyboard Shortcuts | `T` TOC · `D` тема · `B` наверх |
| 23 | Selection Share | Выделение текста в `article` |
| 24 | Homepage Reading Progress | `.article-list` |
| 26 | Article Date Display | `meta[property="article:*_time"]` |
| 26a | Auto Drop Cap | Тип A и B; Тип C исключён |
| 27 | Article End Block Injector | `page.type === 'article'` |

**Принцип:** каждый модуль сначала проверяет наличие нужных DOM-элементов. Если элемента нет — ничего не происходит, ошибок нет.

---

## Контракт window.SITE_CONFIG

### Обязательные секции

```js
window.SITE_CONFIG = {
  version: 1,
  site: { id, name, baseUrl, locale, themeStorageKey },
  page: { type, id, title },
  features: { ... }
};
```

### `page.type` — тип страницы

| Значение | Страница |
|----------|----------|
| `'article'` | Статья |
| `'home'` | Главная |
| `'page'` | Прочая страница |

### `features` — что включить на странице

Каждая функция имеет `enabled: true/false`. Если `enabled: false` — модуль в site.js тихо выходит.

```js
features: {
  themeToggle:     { enabled: true },
  share:           { enabled: true, title: '...', text: '...' },
  backToTop:       { enabled: true, showAfter: 400 },
  readingProgress: { enabled: true },
  toc:             { enabled: true, mobile: true, desktop: true },
  footnotes:       { enabled: true },
  timeline:        { enabled: true, threshold: 0.15 },
  flipCards:       { enabled: true, keyboard: true, fingers: true },
  quiz:            { enabled: true, passingMode: 'half', shareResults: true },
  bookmarks:       { enabled: true, ... },
  homepageResume:  { enabled: false, maxItems: 5 },
  headingAnchors:  { enabled: true }
}
```

### Опциональные секции

```js
toc: {
  items: [
    { id: 'sec-intro', label: 'Введение' },
    ...
  ]
}

quiz: {
  questions: [ { id, q, options, answer, ok, err, focus }, ... ],
  scores:    [ { id, min, max, title, desc }, ... ]
}
```

**Если `toc.items` не задан** — desktop TOC и bottom bar TOC строятся автоматически из `article h2[id]`.

**Если `quiz` не задан** — quiz модуль ничего не делает даже при `features.quiz.enabled: true`.

---

## Шаблон новой статьи

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- SEO -->
  <title>Заголовок — Господь Бог — Сила Моя</title>
  <meta name="description" content="..." />
  <link rel="canonical" href="https://gospod-bog.ru/articles/slug/" />
  <link rel="icon" type="image/x-icon" href="/gb-is-my-strength/favicon.ico">

  <!-- Open Graph / Twitter -->
  <!-- JSON-LD -->

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Source+Sans+3:wght@400;500;600&display=swap" rel="stylesheet">

  <!-- Shared styles -->
  <link rel="stylesheet" href="../../css/site.css" />

  <!-- Breadcrumb JSON-LD (ДОЛЖЕН совпадать с видимыми крошками 1:1) -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Главная",
        "item": "https://gospod-bog.ru/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Раздел",
        "item": "https://gospod-bog.ru/#razdel"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": "Заголовок статьи",
        "item": "https://gospod-bog.ru/articles/slug/"
      }
    ]
  }
  </script>

  <script>
  window.SITE_CONFIG = {
    version: 1,
    site: {
      id: 'gb-strength',
      name: 'Господь Бог — Сила Моя',
      baseUrl: 'https://gospod-bog.ru',
      locale: 'ru-RU',
      themeStorageKey: 'theme',
      debug: false
    },
    page: {
      type: 'article',
      id: 'article-slug',
      title: 'Заголовок статьи',
      section: 'Раздел',
      readingTime: 10,
      wordCount: 5000
    },
    features: {
      themeToggle:     { enabled: true },
      share:           { enabled: true, title: '...', text: '...' },
      backToTop:       { enabled: false },
      readingProgress: { enabled: false },
      toc:             { enabled: true, mobile: true, desktop: true },
      footnotes:       { enabled: true },
      timeline:        { enabled: false },
      flipCards:       { enabled: false },
      quiz:            { enabled: false },
      bookmarks: {
        enabled: true,
        articleSelector: 'article',
        headingSelector: 'h2[id]',
        minScrollToSave: 320,
        minProgressToSave: 6,
        maxProgressToSave: 96,
        completedAtProgress: 97,
        minTimeOnPage: 10000,
        scrollThrottle: 600,
        periodicSaveInterval: 15000,
        maxAgeDays: 14,
        cleanupAgeDays: 45,
        cleanupIntervalHours: 24,
        promptDelay: 900,
        promptAutoHide: 12000,
        showPrompt: true,
        dismissForSession: true,
        respectHashNavigation: true,
        minDocumentHeightRatio: 2.0
      }
    }
  };
  </script>
</head>

<body>

<button id="themeToggle" class="theme-toggle" aria-label="Переключить тему">
  <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z"/>
  </svg>
  <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="23"/>
    <line x1="1" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="23" y2="12"/>
    <line x1="4.2" y1="4.2" x2="6.3" y2="6.3"/><line x1="17.7" y1="17.7" x2="19.8" y2="19.8"/>
    <line x1="4.2" y1="19.8" x2="6.3" y2="17.7"/><line x1="17.7" y1="6.3" x2="19.8" y2="4.2"/>
  </svg>
</button>

<div class="toc-sidebar" id="tocSidebar">
  <nav aria-label="Содержание">
    <div class="toc-label">Содержание</div>
  </nav>
</div>

<div class="page-wrap">

  <nav class="breadcrumb" aria-label="Хлебные крошки">
    <ol class="breadcrumb__list">
      <li class="breadcrumb__item">
        <a class="breadcrumb__link" href="../../">
          <span class="breadcrumb__home" aria-hidden="true">⌂</span>
          <span>Главная</span>
        </a>
      </li>
      <li class="breadcrumb__item">
        <a class="breadcrumb__link" href="../../#razdel">Раздел</a>
      </li>
      <li class="breadcrumb__item" aria-current="page">
        <span class="breadcrumb__current">Заголовок статьи</span>
      </li>
    </ol>
  </nav>

  <header class="article-header">
    <p class="section-label">Раздел</p>
    <h1>Заголовок статьи</h1>
    <p class="article-desc">Краткое описание.</p>
  </header>

  <article class="article-body">

    <h2 id="sec-intro">Введение</h2>
    <p>Текст...</p>

    <!-- ... -->

    <!-- ← JS автоматически вставит .article-end-block перед .sources-block -->

  </article>

  <footer>
    <a href="../../">← Господь Бог — Сила Моя</a>
    <span>© 2026</span>
  </footer>

</div><!-- /page-wrap -->

<!-- BOTTOM APP BAR (если нужен) -->
<!-- ... -->

<!-- Bookmark toast (обязателен если bookmarks.enabled: true) -->
<div class="bookmark-toast" id="bookmarkToast" hidden>
  <div class="bookmark-toast-inner">
    <div class="bookmark-toast-top">
      <span class="bookmark-toast-icon" aria-hidden="true">📖</span>
      <div class="bookmark-toast-copy">
        <span class="bookmark-toast-label">Продолжить чтение</span>
        <span class="bookmark-toast-title" id="bookmarkToastTitle"></span>
        <span class="bookmark-toast-meta" id="bookmarkToastMeta"></span>
      </div>
      <button type="button" class="bookmark-toast-close" id="bookmarkToastClose" aria-label="Закрыть">✕</button>
    </div>
    <div class="bookmark-toast-actions">
      <button type="button" class="bookmark-btn bookmark-btn-primary" id="bookmarkToastResume">Продолжить</button>
      <button type="button" class="bookmark-btn bookmark-btn-secondary" id="bookmarkToastRestart">Сначала</button>
    </div>
    <div class="bookmark-toast-progress" aria-hidden="true">
      <div class="bookmark-toast-progress-fill" id="bookmarkToastProgress"></div>
    </div>
  </div>
</div>

<script src="../../js/bookmark-engine.js"></script>
<script src="../../js/site.js"></script>
</body>
</html>
```

---

## Контракт разметки — нельзя менять

Следующие id и классы используются движком — их нельзя переименовывать:

### Секции статьи
- `<h2 id="sec-...">` — якоря разделов (TOC, scrollspy, bookmark)

### Источники
- `<sup><a href="#srcN">[N]</a></sup>` — ссылки на сноски
- `<li data-num="N" id="srcN">` — сами сноски

### Quiz
`#quizWrapper`, `#quizMain`, `#quizBody`, `#quizCounter`, `#quizQuestion`, `#quizFocus`, `#quizOptions`, `#quizFeedback`, `#quizNext`, `#quizFill`, `#quizResult`, `#quizResultScore`, `#quizResultTotal`, `#quizResultLabel`, `#quizResultBar`, `#quizScoreDesc`, `#quizScore`, `#quizScoreTitle`, `#quizScoreBadge`, `#quizRestart`, `#quizShare`, `#quizOverlay`, `#quizLaunch`

**Бонусный раунд** (только если `bonusEnabled: true`):
`#quizBonusSection`, `#quizBonusStart`, `#quizBonusBody`, `#quizBonusCounter`, `#quizBonusQuestion`, `#quizBonusFocus`, `#quizBonusOptions`, `#quizBonusFeedback`, `#quizBonusNext`, `#quizBonusFill`, `#quizBonusScore`, `#quizBonusScoreTitle`, `#quizBonusScoreBadge`, `#quizBonusScoreDesc`, `#quizBonusLock`, `#quizBonusUnlock`

**Разбор ошибок** (инжектируется JS автоматически — не добавлять в HTML):
`#quizStartReview`, `#quizReviewSection`, `#quizReviewDone`

### Flip Cards
`.flip-card > .flip-card-inner > .flip-card-front / .flip-card-back`
`.error-flip-card > .error-flip-inner > .error-flip-front / .error-flip-back`

### Bookmark Toast
`#bookmarkToast`, `#bookmarkToastTitle`, `#bookmarkToastMeta`, `#bookmarkToastProgress`, `#bookmarkToastClose`, `#bookmarkToastResume`, `#bookmarkToastRestart`

### TOC (bottom bar)
`#bottomBar`, `#btocOverlay`, `#btocPanel`, `#btocClose`, `#btocNav`, `#barProgressFill`, `#barProgressText`, `#barSectionName`, `#barSectionBtn`, `#barUpBtn`, `#barThemeBtn`, `#barShareBtn`

### TOC (mobile slide)
`#toc-toggle`, `#toc-panel`, `#toc-overlay`, `#toc-close`, `#toc-list`

### TOC (desktop)
`#tocSidebar`

### Bookmark homepage
`#resumeReadingBlock`, `#resumeReadingTitle`, `#resumeReadingMeta`, `#resumeReadingProgress`, `#resumeReadingLink`, `#resumeReadingDismiss`, `#resumeListBlock`, `#resumeList`

---

## Добавление новой функции

1. Добавить новый ключ в `features` в SITE_CONFIG статьи
2. Добавить CSS в `site.css` (новая пронумерованная секция)
3. Добавить JS модуль в `site.js` (с проверкой `features.newFeature.enabled`)
4. Добавить нужную разметку в HTML статьи

Пример нового модуля в site.js:
```js
(function () {
  var cfg = SiteUtils.getConfig('features.myFeature', {});
  if (cfg.enabled === false) return;

  var el = document.getElementById('myFeatureRoot');
  if (!el) return;

  // ... логика
})();
```
