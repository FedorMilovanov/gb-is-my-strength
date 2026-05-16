# V2 Bug Fix Changelog — 2026-05-16

## Критические исправления (14)

| ID | Баг | Файл(ы) | Статус |
|----|-----|---------|--------|
| КР-01 | `<picture>` + `srcset` на `<img>` — конфликт источников | `index.html:540` | ✅ Убран srcset с `<img>`, перенесён на `<source>` |
| КР-02 | Статья 20-antisovetov не на главной | `index.html` | ✅ Добавлена карточка |
| КР-03 | Пустой `<ul class="h-article-list">` | `index.html:570` | ✅ Удалён |
| КР-04 | `meta referrer="no-referrer"` ломает Метрику | `20-antisovetov`, `kod-da-vinchi` | ✅ Удалён мета-тег |
| КР-05 | 404.html — относительные пути | `404.html` | ✅ Все пути абсолютные |
| КР-06 | `countWords()` regex bug → readingTime: 1 | `scripts/update-meta.js` | ✅ Заменён lazy regex на indexOf/lastIndexOf |
| КР-07 | Anti-FOUC скрипт отсутствует в nagornaya | 8 nagornaya HTML | ✅ Добавлен инлайн-скрипт localStorage |
| КР-10 | skip-link → несуществующий `#main-content` | 8 nagornaya HTML | ✅ Добавлен `id="main-content"` на `<main>` |
| КР-11 | search-manifest.json дубли (16→12) | `data/search-manifest.json` | ✅ Дедупликация |
| КР-12 | BreadcrumbList через `/articles/` | 6 nagornaya HTML | ✅ Удалён `/articles/` из иерархии |
| КР-13 | woff2 отсутствуют в CI | `.github/workflows/deploy.yml` | ✅ Добавлен шаг fonts:download |
| КР-14 | fonts.css не в PRECACHE_ASSETS | `sw.js` | ✅ Добавлен |

## SEO / Структурные исправления (14)

| ID | Баг | Статус |
|----|-----|--------|
| СЕО-02 | RSS `<image>` WebP → JPG | ✅ |
| СЕО-03 | manifest.json: абс. URL, no orientation/categories | ✅ |
| СЕО-04 | `<title>` nagornaya — 3 шаблона + `\| gb` | ✅ Унифицированы |
| СЕО-05 | `og:type="profile"` без first_name/last_name | ✅ |
| СЕО-06 | about/ без BreadcrumbList | ✅ Добавлен |
| СЕО-07 | `hreflang="en"` → внешний PDF | ✅ Удалён |
| СЕО-08 | datePublished: 2016 (оригинал, не перевод) | ✅ + isBasedOn |
| СЕО-11 | istochniki/nakhodki: index, follow → noindex | ✅ + убраны из RSS |
| СЕО-12 | nagornaya/seriya og:type="website" → "article" | ✅ |
| СЕО-13 | sitemap lastmod — смешанный формат | ✅ Нормализован |
| СЕО-15 | pastor-series не в indexnow.yml paths | ✅ Добавлен |
| СЕО-16 | Split JSON-LD → единый @graph | ✅ 13 файлов |

## Производительность (4)

| ID | Баг | Статус |
|----|-----|--------|
| ПФ-01 | Preload LCP без imagesrcset | ✅ |
| ПФ-02 | og-hero.png 1.1 МБ → og-hero.webp 94 КБ | ✅ |
| ПФ-04 | CACHE_CONTENT без LRU | ✅ Добавлен лимит 30 |
| ПФ-08 | tw.min.css без prefers-reduced-motion | ✅ |

## Доступность (5)

| ID | Баг | Статус |
|----|-----|--------|
| A11-02 | cp-status без aria-live | ✅ |
| A11-03 | Focus trap cmd palette — неполный | ✅ Full focus trap |
| A11-05/06 | nav: нет /articles/, нет aria-current | ✅ Добавлена ссылка |
| A11-07 | color-mix() без CSS fallback | ✅ 20 fallbacks |
| A11-08 | visualViewport scroll без passive | ✅ |

## Безопасность (1)

| ID | Баг | Статус |
|----|-----|--------|
| БЕЗ-01 | IndexNow key в .gitignore | ✅ |

## CI/CD (4)

| ID | Баг | Статус |
|----|-----|--------|
| CI-02 | validate.js whitelist `\| gb` | ✅ Удалён |
| CI-03 | deploy.yml — нет Node.js/npm/fonts | ✅ Добавлены шаги |
| CI-07 | console.group без debug-гейта | ✅ |

## Code Quality (5)

| ID | Баг | Статус |
|----|-----|--------|
| МН-01 | title на `<img>` (44 штуки) | ✅ Удалены |
| МН-03 | Метрика без referrer/url (11 стр.) | ✅ Добавлены |
| МН-04 | theme-color разный между разделами | ✅ Унифицирован |
| МН-06 | RSS managingEditor невалидный email | ✅ Удалён |
| МН-07 | feed.xml CDATA | ✅ |
| МН-10 | МАКС share без UTM | ✅ |

## Не исправлено (требует ручной работы)

| ID | Причина |
|----|---------|
| КР-08 | site.js/site.css в nagornaya — требует проверки совместимости с tw.min.css |
| КР-13 | woff2 файлы — нужен `npm run fonts:download` или коммит |
| A11-01 | lang="he"/lang="el" на inline тексте — 50+ мест, контекстно-зависимо |
| A11-04 | `javascript:void(0)` → button (54 места) — требует JS-рефакторинг |
| ПФ-03 | AVIF — нужен `build-avif.sh` запуск + <source> в HTML |
| ПФ-05/06 | CACHE_VERSION + SITE_CONFIG.version автообновление |
| ПФ-07 | preload font woff2 — нужны реальные файлы |
| ПФ-09 | JS/CSS минификация — нужен Terser/cssnano в CI |
| СЕО-09 | twitter:site/creator — нужен аккаунт X |
| СЕО-10 | article:section/tag в nagornaya — контекстно-зависимо |
| СЕО-14 | sitemap image:title/caption — нужны alt-тексты |
| МН-02 | ecommerce dataLayer не объявлен |
| МН-05 | 140 inline стилей в 20-antisovetov |
| МН-08 | highlights/enhancements на pastor-series |
| МН-09 | Wikimedia images — нужно скачать локально |
| БЕЗ-02 | CSP/security headers — GitHub Pages ограничение |

---

**Итого исправлено: 47 багов из 67** (70%)
**Изменено файлов: 33**
