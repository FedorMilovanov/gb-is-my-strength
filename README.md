# Господь Бог — Сила Моя · gospod-bog.ru

Архитектурная и редакционная документация сайта с материалами для серьёзного изучения Писания:
экзегеза, богословие, апологетика, переводы.

**Версия документа:** v11 · 2026-07-04 · runtime/CI green + dist CSP hardening
**Прод:** https://gospod-bog.ru · GitHub Pages из `main`, artifact: Astro/strangler `dist/`

> Этот README — для **владельца, редакторов и контент-менеджеров.**
> Если ты — ИИ-агент, твой первый документ — [`AGENTS.md`](AGENTS.md).
> История правок и аудитов — [`AUDIT_HISTORY.md`](AUDIT_HISTORY.md).
> Редакционно-источниковая политика — [`docs/EDITORIAL-SOURCE-POLICY.md`](docs/EDITORIAL-SOURCE-POLICY.md).
> Мультиагентные аудиты/верификация/bug-матрица живут в отдельном репозитории
> **[FedorMilovanov/AuditRepo](https://github.com/FedorMilovanov/AuditRepo)** — туда кладутся
> отчёты (`incoming/`), а каноническая матрица — `verified/MASTER_BUG_MATRIX.md` (проект `gb-is-my-strength`).
> Перед «исправлением» бага сначала сверься с текущим HEAD и с AuditRepo: описанный баг может
> быть уже закрыт (пример: шаг `Gill pre-v16 submenu regression audit` в `deploy.yml` уже с одним `run`).

---

## Содержание

1. [Стек и хостинг](#1-стек-и-хостинг)
1.1. [Рефакторинг 5.0: текущий production-режим](#11-рефакторинг-50-текущий-production-режим)
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

- **Production output:** GitHub Pages публикует **Astro/strangler `dist/`**, а не корень репозитория. Источник истины по деплою — `.github/workflows/deploy.yml` (`upload-pages-artifact path: dist`).
- **Build stack:** Astro 6 + MDX/content collections + build-time strangler. Astro генерирует уже мигрированные страницы; `scripts/copy-legacy-to-dist.js` докладывает оставшиеся legacy-страницы/ассеты в `dist/` без перезаписи Astro-owned routes.
- **Runtime stack:** статический HTML + handcrafted CSS + vanilla JS. React не является runtime-стеком сайта; Tailwind допускается только в уже изолированных/route-scoped местах (см. `AGENTS.md`).
- **Legacy root:** старые HTML/CSS/JS в корне сохраняются как rollback/source layer и как источник для ещё не переписанных страниц. `dist/` не коммитится.
- **Поисковая индексация:** `.github/workflows/indexnow.yml` (Яндекс + Bing) теперь мапит изменения `src/**`/MDX в реальные публичные URL.
- **Алерты на падение CI:** `.github/workflows/notify-on-failure.yml` (открывает GitHub Issue).
- **Service Worker** (`sw.js`) — версионируется автоматически (`scripts/cache-bust.js`); deploy-switch cache baseline хранится в `migration/sw-cache-version-baseline.json`.
- **Node:** `>=22.12.0`.
- **CNAME:** `gospod-bog.ru`.

### 1.1. Рефакторинг 5.0: текущий production-режим

Состояние на 2026-06-20:

| Направление | Статус |
|---|---|
| Root→dist deploy switch | **Выполнен (с shadow-wrap parity).** Pages artifact = `dist/`; Pages в режиме `build_type: workflow`. Все landing/series/catalog pages используют `loadLegacyFullDocument` full-document shadow — dist emit-ит ровно тот же legacy HTML, сохраняя 100% visual parity. |
| Публичный URL-контракт | **43 indexable public baseline pages** after removing temporary map placeholders from public search/indexing surfaces; root/dist contract compare green. |
| Astro ownership | Все публичные baseline routes объявлены в `migration/page-ownership.json`; статус Astro routes — `production-dist` (native MDX/articles) или `shadow-dist` (full-document parity wrappers). |
| Pagefind | Строится в `dist/pagefind` перед деплоем. Temporary map placeholders are excluded by `data-pagefind-ignore` / lack of `data-pagefind-body`. |
| CSS parity | Blocking gate: `npm run dist:css-parity` — 51/51 страниц несут project CSS. |
| Source links | Weekly/manual workflow строит production-like `dist` и проверяет именно его, не stale legacy root. |
| SW readiness | `sw:dist:audit:deploy-switch` green: CACHE_VERSION bumped, Pagefind в precache, .nojekyll в dist. |
| Visual parity | Full-document shadow-wrap для всех landing pages (about, articles, biografii, baptisty-rossii, nagornaya, karty, hard-texts, konfessii, pastor-series, map, home). Generic `astro-card-grid` заглушки запрещены. |
| Rollback | Малый rollback: вернуть Pages artifact на root только атомарно вместе с Pagefind/IndexNow/.nojekyll/SW-проверками. |

**Правило visual parity:** H1/H2/SEO/word-count не считаются визуальным переносом. Если визуал сломан — 0% parity. Astro-страница допускается в `production-dist` только при 95%+ визуальном совпадении legacy→Astro desktop/mobile, без generic `astro-card` заглушек, с сохранением серийных миров (Гилл = GBS2, Нагорная = Tailwind/sidebar, Карты = MapEngine hub). Пока parity не доказана — `loadLegacyFullDocument` shadow-wrap. Перед крупными визуальными/контентными изменениями обязательно прогонять `npm run strangler:deploy-readiness`.

---

## 2. SEO-инфраструктура

### Что настроено

| Файл / место | Назначение |
|---|---|
| `.github/workflows/indexnow.yml` | При каждом push в `main` уведомляет Яндекс и Bing об изменённых страницах |
| `.github/workflows/notify-on-failure.yml` | При падении deploy/indexnow/source-links/interactive/visual-parity/Dist Dry Run открывает GitHub Issue с тегом `ci-failure` |
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
6. Зарегистрировать ключ в [Яндекс.Вебмастер → IndexNow](https://webmaster.yandex.ru/indexnow/) и [Bing Webmaster](http://web.archive.org/web/20260623135256/https://www.bing.com/indexnow).

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

> **Редакционная планка глубины** (структура статьи и серии, квизы, глоссарий и тултипы,
> картинки, типографика) — в [`docs/CONTENT-QUALITY-STANDARD.md`](docs/CONTENT-QUALITY-STANDARD.md).
> Здесь ниже — технический чеклист (meta, JSON-LD, OG, slug). Оба документа обязательны
> перед публикацией новой статьи или серии.

### 4.1. Язык статей и цитат

Правило проекта: **русская статья должна быть русской по всему читательскому тексту**. Это правило проверяется автоматически в `npm run validate:all` и `node scripts/audit-pro.js`. Подробные правила — в [`docs/EDITORIAL-SOURCE-POLICY.md`](docs/EDITORIAL-SOURCE-POLICY.md).

- Прямые цитаты, авторские позиции, сильные фразы, quiz-вопросы/объяснения, подписи и callout-блоки — переводить на русский.
- Английскими могут оставаться: названия книг и статей, названия журналов, издательства, DOI, URL, `href`, библиографические записи и необходимые технические термины.
- Не оставлять английскую цитату в теле статьи ради «точности». Точность обеспечивается ссылкой на первоисточник, а в статье даётся русский перевод.
- Если важен оригинальный термин, допустим формат: `различный отбор материала (variant selections)`. Но самостоятельная английская цитата без перевода недопустима.

### Чеклист (короткий)

1. Для новых production-страниц предпочитать Astro/MDX: `src/content/articles/<slug>.mdx` + route в `src/pages/<section>/<slug>/index.astro` по существующим шаблонам. Legacy HTML в корне править/создавать только если он остаётся fallback/source layer для конкретного URL.
2. Подготовить OG-изображение **1200 × 630 px** (`.webp` или `.jpg`), положить в `/images/`.
3. Обновить `sitemap.xml` и `feed.xml`, если URL должен быть публичным и индексируемым.
4. Обновить `data/search-manifest.json`, `data/series.json` и связанные hub-карточки.
5. Объявить новый Astro route в `migration/page-ownership.json`; если меняется public baseline — обновить `data/public-content-baseline.json` осознанно.
6. `npm run cache-bust` после правок CSS/JS/SW-visible assets.
7. Gates: во время итераций гонять быстрый релевантный набор из `docs/WORK_MODES.md`; перед commit/merge/push production-impact правок обязательно `npm run validate:static-publication` + `npm run guard:shared-files` (+ `npm run workflows:check`, если менялись workflows/package/system scripts).
8. Для refactor/deploy-impact правок: `npm run strangler:deploy-readiness`.
9. Для внешних источников: `npm run source:links:dist` (network audit; 403/timeout обычно warnings, TLS/404 — hard errors).
10. `git commit && git push main` — IndexNow сам уведомит Яндекс/Bing по изменённым production URL.

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

# Главный production/static gate: root contracts + maps + Astro ownership + content guards
npm run validate:static-publication

# Полный deploy-readiness для refactor-impact правок (builds production-like dist + Playwright smoke)
npm run strangler:deploy-readiness

# Production source-link audit (builds dist, checks dist external links)
npm run source:links:dist

# Дизайн-токены
npm run tokens:check

# Главный аудит
node scripts/audit-pro.js

# CI-чек (cache-bust + static-publication + workflow policy)
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

# Editorial tone lint: overclaim labels, overheated clichés, known publication-Russian risks
npm run editorial:lint

# Data consistency: reading time in HTML / search-manifest / series.json
npm run data:consistency

# External source links in production-like dist (403/429/timeouts are warnings, 404/TLS/bad hosts are errors)
npm run source:links:dist

# CI/workflows:
# - indexnow.yml and deploy.yml run validate:static-publication as blocking gates.
# - source-links.yml builds production-like dist and runs source-link-audit --root dist weekly/manual.
# - interactive-audit.yml runs npm run interactive-audit weekly/manual.
# - workflows:check protects these workflow contracts from accidental weakening.
npm run workflows:check

# Local static CI gate (cache-bust + full static-publication + workflow policy)
npm run ci:check

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
npm run cache-bust            # если были CSS/JS/SW-visible asset правки
npm run validate:static-publication
npm run workflows:check
node scripts/audit-pro.js     # должно: ✅ PASSED
```

**Если правка затрагивает Astro/layout/deploy/maps/search/SW:**
```bash
npm run strangler:deploy-readiness
```

**Если правка затрагивает внешние источники/ссылки:**
```bash
npm run source:links:dist
```

---

## 9. Структура файлов

```
/
├── src/                                    ← Astro/MDX production sources
│   ├── pages/                              ← Astro routes (production-dist ownership)
│   ├── content/articles/*.mdx              ← MDX content collections
│   ├── layouts/, components/, styles/      ← shared Astro shell/SEO/layouts
│   └── utils/legacyShadow.ts               ← wrapper для legacy-faithful routes
├── migration/page-ownership.json           ← route ownership manifest для dist
├── dist/                                   ← generated Pages artifact (НЕ коммитить)
│
├── index.html                              ← legacy root/fallback source главной
├── 404.html                                ← legacy/system page
├── about/index.html                        ← legacy source for /about/
├── articles/
│   ├── index.html                          ← legacy source каталога
│   └── {slug}/index.html                   ← legacy source статьи
├── biografii/index.html                    ← каталог биографий
├── pastor-series/index.html                ← серия «Тёмная сторона кафедры»
├── nagornaya/                              ← серия «Нагорная проповедь»
│   ├── chast-1/ … chast-5/                 ← 5 частей
│   ├── istochniki/, nakhodki/, seriya/     ← вспомогательные страницы
│   ├── index.html
│   └── tw.min.css                          ← Tailwind (НЕ ТРОГАТЬ)
│
├── css/                                    ← 7 ФАЙЛОВ (см. AGENTS §2)
│   ├── site.css                            ← основной слой, тёмная тема
│   ├── home.css                            ← главная + каталоги
│   ├── command-palette.css                 ← поиск Ctrl+K
│   ├── mobile-hotfix.css                   ← touch / pointer:coarse
│   ├── nagornaya-mobile-toc.css            ← мобильный TOC проповеди
│   ├── floating-cluster.css                ← PremiumControls v16 canonical
│   └── site-layered.css                    ← @layer-аудит pilot (НЕ в проде, только Node-аудиты)
├── fonts/fonts.css                         ← @font-face декларации
│
├── js/                                     ← 12 ФАЙЛОВ верхнего уровня + 1 модуль
│   ├── site.js                             ← главный (≈29 модулей)
│   ├── site-utils.js                       ← общие хелперы
│   ├── scroll-perf.js
│   ├── search.js                           ← Ctrl+K
│   ├── enhancements.js                     ← scroll-эффекты, ambient phrases
│   ├── highlights.js                       ← подсветка текста
│   ├── glossary.js                         ← глоссарий
│   ├── bookmark-engine.js                  ← закладки
│   ├── series-cards.js                     ← карточки серий (legacy, тонкий рендер)
│   ├── floating-cluster-controller.js      ← PremiumControls runtime (Phase 1+2)
│   ├── nagornaya-mobile-toc.js
│   ├── sw-register.js                      ← регистрация SW
│   └── modules/
│       └── back-to-top.js                  ← scroll-to-top на 7 страницах
│
├── data/                                   ← JSON-данные runtime
│   ├── glossary.json                       ← 101 термин (definition+detail+category+aliases)
│   ├── search-manifest.json
│   ├── series.json
│   ├── verses.json                         ← стихи для поповеров .gbx-verse
│   ├── original-words.json                 ← слова оригинала для .gbx-ow
│   ├── links-graph.json                    ← граф внутренних ссылок (/map/)
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
├── docs/GBS-PATTERN.md                     ← анатомия GBS-страницы (миграции серий)
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
├── package.json                            ← scripts + Astro/tooling devDependencies
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
| **v10** | 2026-06-26 | Post-audit hardening session: BUG-A1 (порча кириллицы), BUG-A2 (Ishod JSON-LD), BUG-A3 (CSS dual-prefix fc-/gb-cluster-), BUG-A4 (data-fc-root на 10 baptisty + floating-cluster.css link на 15 pages), BUG-A5 (strict-native-app определён в matrix.modes + guard в check-route-migration-matrix.js), BUG-A6 (BreadcrumbList JSON-LD на 10 baptisty), BUG-A8 (gtip-luxury IDs теперь монотонно-уникальны), BUG-B3 (12 коллизий AGENTS-rNNN перенумерованы + guard скрипт), BUG-B5 (hard-texts part 3 readTime), BUG-S1 (deploy.yml парсит dist JSON-LD + contract:compare:dist), BUG-S3 (.gitconfig удалён). Реальная TTS-озвучка через speechSynthesis с live speed change. Канонический PremiumControls контракт перенесён в `AuditRepo/projects/<project>/PremiumControls/`. |
| **v9** | 2026-06-22 | refactoring 6.0 hardening / dist-as-production |
| **v8** | 2026-06-20 | (запись восстановлена post-hoc) Phase 5 visual parity baseline + native-shadow pixel-diff guard |
| **v7** | 2026-06-18 | README приведён к refactoring 4.5: production теперь Astro/strangler `dist`, добавлены deploy-readiness/source-links-dist/ownership notes и обновлён authoring checklist. |
| **v6** | 2026-06-06 | Добавлен документ `docs/EDITORIAL-SOURCE-POLICY.md`; README связан с редакционно-источниковой политикой, а число проверок `audit-pro` обновлено до 36. |
| v5 | 2026-06-06 | Правило раздела 4.1 подкреплено автоматической проверкой в `validate.js` и `audit-pro.js`; английские прямые цитаты в русских статьях теперь блокируются проверками. |
| v4 | 2026-06-06 | Добавлен раздел 4.1: русские статьи не должны содержать английские прямые цитаты в читательском тексте; английские названия источников, URL, DOI и библиографические данные допустимы. |
| v3 | 2026-06-04 | Полная перезапись (PLAN-05). Убраны: двойной `---` в шапке, сломанный ASCII-tree (`pastor-series/…` дублировался ×3), устаревший раздел «Отсутствующие изображения», устаревший «Версия 2.2 — Май 2026», устаревшая «SEO-инфраструктура Версия 2.0 — Апрель 2026». Численные данные о CSS-секциях / JS-модулях приведены в соответствие с фактическим кодом. Добавлены ссылки на AGENTS.md, AUDIT_HISTORY.md. |
| v2 (2026-05) | старая | Множественные редакции после PATCH-V*-серий. |
| v1 (2026-04) | старая | Первая версия + SEO-инфраструктура. |
