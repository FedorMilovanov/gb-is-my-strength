# Господь Бог — Сила Моя · gospod-bog.ru

Архитектурная и редакционная документация сайта-библиотеки для серьёзного изучения Писания:
экзегеза, богословие, апологетика, переводы.

**Версия документа:** v6 · 2026-06-06 · редакционно-источниковая политика
**Прод:** https://gospod-bog.ru · GitHub Pages из ветки `main`

> Этот README — для **владельца, редакторов и контент-менеджеров.**
> Если ты — ИИ-агент, твой первый документ — [`AGENTS.md`](AGENTS.md).
> История правок и аудитов — [`AUDIT_HISTORY.md`](AUDIT_HISTORY.md).
> Редакционно-источниковая политика — [`docs/EDITORIAL-SOURCE-POLICY.md`](docs/EDITORIAL-SOURCE-POLICY.md).

---

## Содержание

1. [Стек и хостинг](#1-стек-и-хостинг)
2. [SEO-инфраструктура (IndexNow + sitemap + feed + JSON-LD)](#2-seo-инфраструктура)
3. [Правила атрибуции авторства](#3-правила-атрибуции-авторства)
4. [Добавление новой статьи — полный чеклист](#4-добавление-новой-статьи)
4.1. [Язык статей и цитат](#41-язык-статей-и-цитат)
5. [Шаблон статьи (`<head>`, `<body>`, обязательные блоки)](#5-шаблон-новой-статьи)
6. [Контракт `window.SITE_CONFIG`](#6-контракт-windowsite_config)
7. [Контракт разметки — нельзя переименовывать](#7-контракт-разметки)
8. [Build-скрипты (`npm run …`)](#8-build-скрипты)
9. [Структура файлов](#9-структура-файлов)

---

## 1. Стек и хостинг

- **HTML + CSS + JS, vanilla**, без bundler'а, без TypeScript, без React.
- **Хостинг:** GitHub Pages, автодеплой через `.github/workflows/deploy.yml`.
- **Поисковая индексация:** `.github/workflows/indexnow.yml` (Яндекс + Bing).
- **Алерты на падение CI:** `.github/workflows/notify-on-failure.yml` (открывает GitHub Issue).
- **Service Worker** (`sw.js`) — версионируется автоматически (`scripts/cache-bust.js`).
- **Node** для build-скриптов: `>=20`.
- **CNAME:** `gospod-bog.ru`.

---

## 2. SEO-инфраструктура

### Что настроено

| Файл / место | Назначение |
|---|---|
| `.github/workflows/indexnow.yml` | При каждом push в `main` уведомляет Яндекс и Bing об изменённых страницах |
| `.github/workflows/notify-on-failure.yml` | При падении `deploy.yml` или `indexnow.yml` открывает GitHub Issue с тегом `ci-failure` |
| `sitemap.xml` | Все страницы. `lastmod` — только ISO8601 с `+03:00` (МСК). |
| `feed.xml` | RSS-лента. Новые статьи — в начало `<channel>`, плюс обновить `<lastBuildDate>`. |
| `robots.txt` | Управление ботами, включая AI-боты (GPTBot, ClaudeBot, Google-Extended). |
| `articles/index.html` | Каталог всех статей; промежуточный уровень в BreadcrumbList. |
| JSON-LD `@graph` главной | `WebSite` + `CollectionPage` + `Person` (с `sameAs` на соцсети). |
| JSON-LD статей | `Article` (или `ScholarlyArticle` для переводов) + `BreadcrumbList` (3 уровня). |
| `llms.txt` | Правила для LLM-краулеров. |

### IndexNow — однократная настройка

1. Сгенерировать ключ на [indexnow.org](https://www.indexnow.org/en).
2. GitHub → Settings → Secrets and variables → Actions → repository secret `INDEXNOW_KEY` = значение ключа.
3. **Не коммитить** `<INDEXNOW_KEY>.txt` в репозиторий: `deploy.yml` сам создаёт его в Pages-артефакте перед деплоем.
4. После добавления/ротации ключа — один раз вручную запустить workflow **Deploy to GitHub Pages**, чтобы новый `<INDEXNOW_KEY>.txt` появился на живом сайте.
5. Проверить: `https://gospod-bog.ru/<INDEXNOW_KEY>.txt` доступен.
6. Зарегистрировать ключ в [Яндекс.Вебмастер → IndexNow](https://webmaster.yandex.ru/indexnow/) и [Bing Webmaster](https://www.bing.com/indexnow).

После этого каждый `git push main` автоматически уведомляет поисковики.

---

## 3. Правила атрибуции авторства

Фёдор Милованов на сайте — **автор-редактор** (оригинальные статьи) и **редактор** (переводы). **НЕ «автор»** в традиционном смысле: он задаёт направление, редактирует, исправляет неточности, собирает материал с помощью ИИ.

### Три типа статей

| Тип | Описание | Byline в `<header>` | `.author-card-label` | Карточки в каталогах |
|---|---|---|---|---|
| **A** | Авторская статья | `Автор-редактор: Фёдор Милованов` | `Автор-редактор` | `Автор-редактор: Фёдор Милованов` |
| **B** | Авторская серия / разбор | `Автор-редактор: Фёдор Милованов` | `Автор-редактор` | `Автор-редактор: Фёдор Милованов` |
| **C** | Перевод зарубежной статьи | `Редактор: Фёдор Милованов` | `Редактор` | `Ред.: Фёдор Милованов` |

### Meta-теги

- **Тип A/B:**
  ```html
  <meta name="author" content="Фёдор Милованов">
  <meta property="article:author" content="Фёдор Милованов">
  ```
- **Тип C (перевод):**
  ```html
  <meta name="author" content="Имя оригинального автора">
  <meta name="translator" content="Фёдор Милованов">
  <meta property="article:author" content="Имя оригинального автора">
  ```

### feed.xml — для всех типов

```xml
<dc:creator>Фёдор Милованов</dc:creator>
```

> Страница `/about/` и SEO-описания используют «автор и редактор» как общую характеристику роли на сайте — это допустимо.

---

## 4. Добавление новой статьи

### 4.1. Язык статей и цитат

Правило проекта: **русская статья должна быть русской по всему читательскому тексту**. Это правило проверяется автоматически в `npm run validate:all` и `node scripts/audit-pro.js`. Подробные правила — в [`docs/EDITORIAL-SOURCE-POLICY.md`](docs/EDITORIAL-SOURCE-POLICY.md).

- Прямые цитаты, авторские позиции, сильные фразы, quiz-вопросы/объяснения, подписи и callout-блоки — переводить на русский.
- Английскими могут оставаться: названия книг и статей, названия журналов, издательства, DOI, URL, `href`, библиографические записи и необходимые технические термины.
- Не оставлять английскую цитату в теле статьи ради «точности». Точность обеспечивается ссылкой на первоисточник, а в статье даётся русский перевод.
- Если важен оригинальный термин, допустим формат: `различный отбор материала (variant selections)`. Но самостоятельная английская цитата без перевода недопустима.

### Чеклист (короткий)

1. Создать папку `articles/<slug>/index.html` по шаблону из §5.
2. Подготовить OG-изображение **1200 × 630 px** (`.webp` или `.jpg`), положить в `/images/`.
3. Обновить `sitemap.xml` (добавить `<url>` с ISO8601 `lastmod`).
4. Обновить `feed.xml` (добавить `<item>` в начало `<channel>` + обновить `<lastBuildDate>`).
5. (Если статья — часть серии) обновить `data/series.json`.
6. Обновить `data/search-manifest.json` для Ctrl+K поиска.
7. Добавить карточку на `/articles/index.html` (и при необходимости — на `/index.html`).
8. `npm run cache-bust` (хеши + SW CACHE_VERSION).
9. `npm run validate:all` + `node scripts/audit-pro.js` — оба должны быть PASS, включая проверку языка цитат.
10. `git commit && git push main` — IndexNow сам уведомит Яндекс/Bing.

### Slug

Строчные латинские буквы и дефисы. Без слэша в начале. Папка статьи = `articles/<slug>/`.

### OG-изображение

- **Размер:** 1200 × 630 px (соотношение 40:21).
- **Формат:** `.webp` (предпочтительно) или `.jpg`. PNG только для backup, не для `<img>`/`<picture>`.
- **JPG-fallback в OG-meta** ставить ТОЛЬКО если `.jpg` файл реально существует.
- **Расположение:** `/images/`.

---

## 5. Шаблон новой статьи

### `<head>` — обязательные мета-теги

```html
<!-- SEO -->
<title>Заголовок статьи — Господь Бог — Сила Моя</title>
<meta name="description" content="150–160 символов, описывает суть статьи.">
<meta name="keywords" content="ключевое слово 1, слово 2, слово 3">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
<meta name="author" content="Фёдор Милованов">
<!-- Если перевод (Тип C), вместо строки выше: -->
<!-- <meta name="author" content="Имя Автора Оригинала"> -->
<!-- <meta name="translator" content="Фёдор Милованов">     -->
<meta name="geo.region" content="RU-SPE">
<meta name="geo.placename" content="Санкт-Петербург">
<link rel="canonical" href="https://gospod-bog.ru/articles/{slug}/">
<link rel="alternate" type="application/rss+xml"
      title="Господь Бог — Сила Моя — RSS"
      href="https://gospod-bog.ru/feed.xml">

<!-- Open Graph -->
<meta property="og:type" content="article">
<meta property="og:title" content="Краткий заголовок без сайта">
<meta property="og:description" content="Описание для соцсетей, 1–2 предложения.">
<meta property="og:url" content="https://gospod-bog.ru/articles/{slug}/">
<meta property="og:image" content="https://gospod-bog.ru/images/{slug}-preview.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/jpeg">
<!-- Если изображение .webp — заменить тип на image/webp -->
<meta property="og:image:alt" content="Описание изображения">
<meta property="og:site_name" content="Господь Бог — Сила Моя">
<meta property="og:locale" content="ru_RU">
<meta property="article:published_time" content="2026-MM-DDT00:00:00+03:00">
<meta property="article:modified_time" content="2026-MM-DDT00:00:00+03:00">
<meta property="article:author" content="Фёдор Милованов">
<meta property="article:section" content="Богословие">
<meta property="article:tag" content="тег 1">
<meta property="article:tag" content="тег 2">

<!-- Preload LCP-изображения (если есть hero в начале статьи) -->
<link rel="preload" as="image" fetchpriority="high" href="../../images/{slug}-hero.jpg">
```

### JSON-LD (Article + BreadcrumbList)

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
      "author":    { "@id": "https://gospod-bog.ru/about/#person" },
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
        { "@type": "ListItem", "position": 1, "name": "Главная", "item": "https://gospod-bog.ru/" },
        { "@type": "ListItem", "position": 2, "name": "Статьи",   "item": "https://gospod-bog.ru/articles/" },
        { "@type": "ListItem", "position": 3, "name": "Название статьи", "item": "https://gospod-bog.ru/articles/{slug}/" }
      ]
    }
  ]
}
```

**Для переводов (Тип C):**
```json
"@type": "ScholarlyArticle",
"author": { "@type": "Person", "name": "Имя Автора Оригинала" },
"translator": { "@id": "https://gospod-bog.ru/about/#person" }
```

### Обновить `sitemap.xml`

Добавить перед `</urlset>`:
```xml
<url>
  <loc>https://gospod-bog.ru/articles/{slug}/</loc>
  <lastmod>2026-MM-DDT00:00:00+03:00</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.9</priority>
</url>
```

### Обновить `feed.xml`

В начало `<channel>` (новые — первыми) + обновить `<lastBuildDate>`:
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

### Каркас body

```html
<body>

<button id="themeToggle" class="theme-toggle" aria-label="Переключить тему">
  <!-- sun/moon SVG-иконки — site.js модуль 02 инжектит канонические -->
</button>

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
    <!-- Тип A/B (авторская): -->
    <p class="article-byline">
      <span class="article-byline__strong">Автор-редактор: Фёдор Милованов</span>
    </p>
    <!-- Тип C (перевод):                                                              -->
    <!-- <p class="article-byline"><span class="article-byline__strong">Редактор: Фёдор Милованов</span></p> -->
  </header>

  <article class="article-body">
    <h2 id="sec-intro">Введение</h2>
    <p>Текст…</p>
    <!-- … -->

    <!-- ← JS автоматически вставит .article-end-block перед .sources-block -->

    <aside class="author-card">
      <div aria-hidden="true" class="author-card-icon">ФМ</div>
      <div class="author-card-body">
        <div class="author-card-label">Автор-редактор</div>
        <div class="author-card-name">Фёдор Милованов</div>
        <p class="author-card-desc">
          Основатель и редактор проекта «Господь Бог — Сила Моя», Санкт-Петербург.
          <a href="../../about/">Об авторе →</a>
        </p>
      </div>
    </aside>
  </article>

  <footer>
    <a href="../../">← Господь Бог — Сила Моя</a>
    <span>© 2026</span>
  </footer>

</div><!-- /page-wrap -->

<script src="../../js/bookmark-engine.js"></script>
<script src="../../js/site.js"></script>
</body>
```

---

## 6. Контракт `window.SITE_CONFIG`

В `<head>` каждой статьи **перед** подключением `js/site.js`:

```html
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
    type: 'article',          // 'article' | 'home' | 'page'
    id: 'article-slug',
    title: 'Заголовок статьи',
    section: 'Раздел',
    readingTime: 10,
    wordCount: 5000
  },
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
    bookmarks:       { enabled: true, /* …см. полный список ниже */ },
    homepageResume:  { enabled: false, maxItems: 5 },
    headingAnchors:  { enabled: true }
  }
};
</script>
```

Если функция не нужна — `enabled: false`. Если `enabled: true`, но в DOM нет нужных элементов — модуль тихо выходит без ошибок.

### Опциональные секции

```js
toc: {
  items: [
    { id: 'sec-intro', label: 'Введение' },
    // ...
  ]
}

quiz: {
  questions: [
    {
      id: 'q1',
      type: 'single',
      category: 'theology',
      difficulty: 'medium',
      question: 'Вопрос...',
      options: ['...', '...', '...'],
      correct: 1,
      explanation: {
        short: 'Короткий вывод.',
        full: 'Развёрнутое богословское или историческое объяснение.',
        anchor: 'sec-intro'
      },
      sourceRef: { label: 'Иер. 17:9', href: '#sec-intro' }
    },
    // ...
  ],
  scores: [
    { id, min, max, title, desc },
    // ...
  ]
}
```

- Если `toc.items` не задан — desktop TOC и bottom-bar TOC строятся автоматически из `article h2[id]`.
- Если `quiz` не задан — quiz-модуль ничего не делает даже при `features.quiz.enabled: true`.
- `quiz.questions[].sourceRef` может быть строкой, объектом `{ label, href }` или массивом — выводится в feedback.
- Legacy-формат `q / answer / ok / err / focus` всё ещё поддерживается рантаймом для старых страниц, но **новые вопросы добавлять только в формате `question / correct / explanation`**.

### Полный пример `bookmarks`

```js
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
```

---

## 7. Контракт разметки — нельзя переименовывать

Эти id и классы используются движком — их нельзя переименовывать.

### Секции статьи
- `<h2 id="sec-...">` — якоря разделов (TOC, scrollspy, bookmark)

### Источники / сноски
- `<sup><a href="#srcN">[N]</a></sup>` — ссылки на сноски
- `<li data-num="N" id="srcN">` — сами сноски
- `<span class="fn-marker" role="button" tabindex="0">N<span class="tooltip">…</span></span>` — академические сноски с tooltip + mobile bottom-sheet

### Глоссарий и tooltip-ы (три канонических вида, см. AGENTS §4.4 п.7)
- `<span class="gterm" tabindex="0">термин<span class="gtip">Определение…</span></span>` — глоссарий
- `.fn-marker > .tooltip` — академические сноски
- `<button class="bref" data-ref="Иер 17:9"><span class="btip">…</span></button>` — Библейские ссылки
- **`.fn-marker--dove`** — вариант сноски с иконкой голубя (не отдельный тип tooltip). Глиф —
  inline-SVG, инжектится `js/site.js` (`e()`); тело `.fn-dove-body` + крыло `.fn-dove-wing`,
  которое машет на hover (desktop + мышь, с учётом `prefers-reduced-motion`). `::before` —
  статический no-JS фолбэк. Инлайновый `<svg class="fn-dove-icon">` в HTML не нужен.

### Quiz Engine v3
Если `features.quiz.enabled: true` и есть `SITE_CONFIG.quiz.questions`, в HTML ставится только канонический mount `<div id="quizPlaceholder"></div>`. `site.js` сам генерирует runtime-разметку ниже; вручную legacy `#quizWrapper` не вставлять.

Runtime ids: `#quizWrapper`, `#quizMain`, `#quizBody`, `#quizCounter`, `#quizQuestion`, `#quizFocus`, `#quizOptions`, `#quizFeedback`, `#quizNext`, `#quizFill`, `#quizResult`, `#quizResultScore`, `#quizResultTotal`, `#quizResultLabel`, `#quizResultBar`, `#quizScoreDesc`, `#quizScore`, `#quizScoreTitle`, `#quizScoreBadge`, `#quizRestart`, `#quizShare`, `#quizOverlay`, `#quizLaunch`

**Бонусный раунд** (если `bonusEnabled: true`):
`#quizBonusSection`, `#quizBonusStart`, `#quizBonusBody`, `#quizBonusCounter`, `#quizBonusQuestion`, `#quizBonusFocus`, `#quizBonusOptions`, `#quizBonusFeedback`, `#quizBonusNext`, `#quizBonusFill`, `#quizBonusScore`, `#quizBonusScoreTitle`, `#quizBonusScoreBadge`, `#quizBonusScoreDesc`, `#quizBonusLock`, `#quizBonusUnlock`

**Разбор ошибок** (инжектируется JS автоматически — не добавлять в HTML):
`#quizStartReview`, `#quizReviewSection`, `#quizReviewDone`

### Flip Cards
- `.flip-card > .flip-card-inner > .flip-card-front / .flip-card-back`
- `.error-flip-card > .error-flip-inner > .error-flip-front / .error-flip-back`

### Bookmark Toast (обязателен если `bookmarks.enabled: true`)
`#bookmarkToast`, `#bookmarkToastTitle`, `#bookmarkToastMeta`, `#bookmarkToastProgress`, `#bookmarkToastClose`, `#bookmarkToastResume`, `#bookmarkToastRestart`

### TOC
- **Bottom bar:** `#bottomBar`, `#btocOverlay`, `#btocPanel`, `#btocClose`, `#btocNav`, `#barProgressFill`, `#barProgressText`, `#barSectionName`, `#barSectionBtn`, `#barUpBtn`, `#barThemeBtn`, `#barShareBtn`
- **Mobile slide:** `#toc-toggle`, `#toc-panel`, `#toc-overlay`, `#toc-close`, `#toc-list`
- **Desktop:** `#tocSidebar`

### Bookmark на главной
`#resumeReadingBlock`, `#resumeReadingTitle`, `#resumeReadingMeta`, `#resumeReadingProgress`, `#resumeReadingLink`, `#resumeReadingDismiss`, `#resumeListBlock`, `#resumeList`

### Плавающие контролы (gbFloatingControls, site.js модуль 29)
- `#gbFloatingControls`, `.gb-fc-theme`, `.gb-fc-search` — единственные canonical классы. Legacy `.theme-float-btn` / `#themeFloat` / `#gbSearchFloat` удалены, **не возвращать**.

---

## 8. Build-скрипты

```bash
# Хеши cache-bust в HTML + CACHE_VERSION в sw.js
npm run cache-bust

# Валидация HTML / JSON / манифестов
npm run validate              # обычная
npm run validate:strict       # строгая

# SEO-аудит
npm run seo-audit

# Полная валидация (strict + SEO)
npm run validate:all

# Дизайн-токены
npm run tokens:check

# Главный аудит (36 проверок)
node scripts/audit-pro.js

# CI-чек (cache-bust + tokens + validate:all)
npm run ci:check

# Visual QA (Playwright + chromium, опционально)
# 1) запустить локальный сервер: python3 -m http.server 8080 --bind 127.0.0.1
# 2) AUDIT_BASE=http://127.0.0.1:8080 npm run visual-audit
#    Должно: 0 console errors, 0 network errors

# Interactive QA (Playwright): series dropdown, quiz launch, glossary, mobile theme, Ctrl+F/Ctrl+K, image viewer, share dialog
# 1) запустить локальный сервер: python3 -m http.server 8080 --bind 127.0.0.1
# 2) AUDIT_BASE=http://127.0.0.1:8080 npm run interactive-audit
#    Должно: Interactive audit passed

# Readable/publication QA: reader-mode/screen-reader/plain-text слой
npm run readable-audit

# Data consistency: reading time in HTML / search-manifest / series.json
npm run data:consistency

# Publication gate после крупных контентных правок
# (validate + tokens + audit-pro + readable + data consistency + interactive; interactive требует локальный сервер)
AUDIT_BASE=http://127.0.0.1:8080 npm run validate:publication

# Обновление meta-тегов (полуавтомат)
npm run update-meta

# Скачать шрифты
npm run fonts:download

# AVIF (опционально)
npm run avif:build
```

**Перед коммитом, как минимум:**
```bash
npm run cache-bust
npm run validate:all
node scripts/audit-pro.js     # должно: ✅ PASSED
```

---

## 9. Структура файлов

```
/
├── index.html                              ← главная
├── 404.html                                ← страница ошибки
├── about/index.html                        ← о проекте
├── articles/
│   ├── index.html                          ← каталог всех статей
│   └── {slug}/index.html                   ← каждая статья
├── biografii/index.html                    ← каталог биографий
├── pastor-series/index.html                ← серия «Тёмная сторона кафедры»
├── nagornaya/                              ← серия «Нагорная проповедь»
│   ├── chast-1/ … chast-5/                 ← 5 частей
│   ├── istochniki/, nakhodki/, seriya/     ← вспомогательные страницы
│   ├── index.html
│   └── tw.min.css                          ← Tailwind (НЕ ТРОГАТЬ)
│
├── css/                                    ← РОВНО 5 ФАЙЛОВ (см. AGENTS §2)
│   ├── site.css                            ← основной слой, тёмная тема
│   ├── home.css                            ← главная + каталоги
│   ├── command-palette.css                 ← поиск Ctrl+K
│   ├── mobile-hotfix.css                   ← touch / pointer:coarse
│   └── nagornaya-mobile-toc.css            ← мобильный TOC проповеди
├── fonts/fonts.css                         ← @font-face декларации
│
├── js/                                     ← РОВНО 11 ФАЙЛОВ
│   ├── site.js                             ← главный (≈29 модулей)
│   ├── site-utils.js                       ← общие хелперы
│   ├── scroll-perf.js
│   ├── search.js                           ← Ctrl+K
│   ├── enhancements.js                     ← scroll-эффекты, ambient phrases
│   ├── highlights.js                       ← подсветка текста
│   ├── glossary.js                         ← глоссарий
│   ├── bookmark-engine.js                  ← закладки
│   ├── series-cards.js                     ← карточки серий
│   ├── nagornaya-mobile-toc.js
│   └── sw-register.js                      ← регистрация SW
│
├── data/                                   ← JSON-данные runtime
│   ├── glossary.json
│   ├── search-manifest.json
│   ├── series.json
│   └── strategic-map-antisovetov.json
│
├── images/                                 ← все изображения (.webp основной)
├── icons/                                  ← favicon/apple-touch
│
├── sitemap.xml, feed.xml, robots.txt, llms.txt, manifest.json
├── sw.js                                   ← Service Worker
├── CNAME                                   ← gospod-bog.ru
│
├── AGENTS.md                               ← ⭐ контракт для ИИ-агентов
├── README.md                               ← этот файл
├── AUDIT_HISTORY.md                        ← changelog аудитов (v1..v27+)
├── audit/                                  ← последние audit-pro отчёты + планы
│
├── scripts/                                ← build-инструменты (Node.js + Bash + Python)
│   ├── cache-bust.js                       ← ⭐ хеши + SW CACHE_VERSION
│   ├── audit-pro.js                        ← главный аудит, 36 проверок
│   ├── validate.js, seo-audit.js
│   ├── visual-audit.js                     ← Playwright
│   ├── check-design-tokens.js
│   ├── update-meta.js
│   ├── download-fonts.js
│   ├── build-avif.sh
│   ├── deep-check.js, _audit-deep.js       ← внутренние
│   └── resize_og.py                        ← Pillow для OG-картинок
│
├── package.json                            ← scripts только, без runtime deps
└── .github/workflows/
    ├── deploy.yml                          ← деплой на GitHub Pages
    ├── indexnow.yml                        ← Яндекс + Bing уведомления
    └── notify-on-failure.yml               ← GitHub Issue при падении CI
```

### Подробности про CSS-секции и JS-модули

- `css/site.css` — основной декларативный слой сайта. После budget-pass 2026-06-04 файл был сжат для продакшн-размера, но архитектурно остаётся единым canonical CSS-слоем проекта.
- `js/site.js` — единый основной runtime-файл сайта. **Не дробить** на новые файлы — это архитектурный выбор (см. AGENTS §5.1). После budget-pass 2026-06-04 файл был сжат, но архитектура «один основной site.js + фиксированный набор вспомогательных файлов» остаётся неизменной.

---

## История этого документа

| Версия | Дата | Что изменилось |
|---|---|---|
| **v6** | 2026-06-06 | Добавлен документ `docs/EDITORIAL-SOURCE-POLICY.md`; README связан с редакционно-источниковой политикой, а число проверок `audit-pro` обновлено до 36. |
| v5 | 2026-06-06 | Правило раздела 4.1 подкреплено автоматической проверкой в `validate.js` и `audit-pro.js`; английские прямые цитаты в русских статьях теперь блокируются проверками. |
| v4 | 2026-06-06 | Добавлен раздел 4.1: русские статьи не должны содержать английские прямые цитаты в читательском тексте; английские названия источников, URL, DOI и библиографические данные допустимы. |
| v3 | 2026-06-04 | Полная перезапись (PLAN-05). Убраны: двойной `---` в шапке, сломанный ASCII-tree (`pastor-series/…` дублировался ×3), устаревший раздел «Отсутствующие изображения», устаревший «Версия 2.2 — Май 2026», устаревшая «SEO-инфраструктура Версия 2.0 — Апрель 2026». Численные данные о CSS-секциях / JS-модулях приведены в соответствие с фактическим кодом. Добавлены ссылки на AGENTS.md, AUDIT_HISTORY.md. |
| v2 (2026-05) | старая | Множественные редакции после PATCH-V*-серий. |
| v1 (2026-04) | старая | Первая версия + SEO-инфраструктура. |
