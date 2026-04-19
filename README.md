# Архитектура сайта — Господь Бог — Сила Моя
## Версия 1.0 — Апрель 2026

---

## Структура файлов

```
/
├── index.html                          ← Главная страница
├── css/
│   └── site.css                        ← ВСЕ общие стили (2301 строк)
├── js/
│   ├── site.js                         ← ВСЕ общие скрипты (1234 строк)
│   └── bookmark-engine.js              ← Движок закладок (497 строк, не менять)
├── articles/
│   ├── kod-da-vinchi/
│   │   └── index.html                  ← Статья: только HTML + SEO + SITE_CONFIG
│   └── hermenevticheskaya-otsenka.../
│       └── index.html                  ← Статья: только HTML + SEO + SITE_CONFIG
└── images/
    └── ...
```

---

## Что вынесено в site.css (36 секций)

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
| 16 | Quiz Engine | `#quizWrapper` + `SITE_CONFIG.quiz` |
| 17 | Heading Anchor Copy | `.heading-anchor` |
| 18 | Hover bridge for fn-marker | Desktop only |
| 19 | Bible Reference Tooltips | `.bref[data-ref]` + `#bibleRefs` |
| 20 | Academic Footnotes | `.fn-marker` |

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
  questions: [ { id, q, options, correct, ok, err }, ... ],
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

<body id="top">

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

    <div class="share-block">
      <button id="shareBtn" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
        Поделиться статьёй
      </button>
    </div>

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
`#quizWrapper`, `#quizBody`, `#quizCounter`, `#quizQuestion`, `#quizOptions`, `#quizFeedback`, `#quizNext`, `#quizScore`, `#quizRestart`, `#quizShare`, `#scoreTitle`, `#scoreBadge`, `#scoreDesc`, `#quizFill`

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
