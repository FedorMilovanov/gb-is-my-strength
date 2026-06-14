# SEO_TECHNICAL_CONTRACT_2026.md — технический SEO-контракт для миграции

Дата: 2026-06-12  
Связано с: `docs/ASTRO_SITE_REFACTOR_RESEARCH_2026.md`

---

## 1. Цель

При переходе на Astro нельзя потерять поисковую видимость. Этот документ фиксирует контракт, который новая сборка должна соблюдать.

---

## 2. URL и canonical

### Правила

```text
[ ] Все публичные URL сохраняются.
[ ] Trailing slash сохраняется.
[ ] Canonical абсолютный: https://gospod-bog.ru/...
[ ] Один canonical на страницу.
[ ] Query-параметры не создают новые canonical.
[ ] Если URL меняется — только 301 redirect.
```

### Примеры

```text
/articles/kod-da-vinchi/
canonical: https://gospod-bog.ru/articles/kod-da-vinchi/

/karty/avraam/
canonical: https://gospod-bog.ru/karty/avraam/
```

---

## 3. Indexing

### Robots meta

По умолчанию:

```html
<meta name="robots" content="index, follow">
```

Для черновиков/dev/system:

```html
<meta name="robots" content="noindex, follow">
```

Запрет:

```text
❌ Случайный noindex на статьях.
❌ Случайный noindex на разделах.
❌ Закрытие CSS/JS/images от Googlebot.
```

---

## 4. HTML-first content

Критический контент должен быть в исходном HTML:

```text
[ ] h1
[ ] lead/description
[ ] основной текст статьи
[ ] внутренние ссылки
[ ] источники
[ ] карта transcript для карт
[ ] breadcrumbs
```

Интерактив может подключаться после, но не заменять контент.

Для карт:

```astro
<MapTranscript />
<MapApp client:visible />
```

---

## 5. Title и description

### Title

Рекомендации:

```text
[ ] уникальный на каждой странице
[ ] главный смысл в начале
[ ] бренд можно в конце
[ ] не переспамливать ключами
```

Формат:

```text
{Название материала} | Господь Бог — Сила Моя
```

Для некоторых длинных статей можно без бренда, если title уже длинный.

### Description

```text
[ ] 70–180 символов
[ ] уникальный
[ ] не пустой
[ ] отражает содержание страницы
[ ] без обмана/кликбейта
```

---

## 6. Heading structure

```text
[ ] один h1
[ ] h2 для основных разделов
[ ] h3 внутри h2
[ ] не использовать h для декоративного текста
[ ] TOC строится из h2/h3
```

---

## 7. Structured data

Google поддерживает JSON-LD, Microdata и RDFa, но рекомендует JSON-LD как наиболее удобный для поддержки [1](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data).

### Базовый graph сайта

```text
Organization
WebSite
WebPage
BreadcrumbList
```

### Для статьи

```text
Article
Person/Organization author
ImageObject
BreadcrumbList
```

Google Article structured data рекомендует указывать `headline`, `image`, `datePublished`, author; изображения должны быть crawlable/indexable и репрезентативными [3](https://developers.google.com/search/docs/appearance/structured-data/article).

### Для карт

```text
WebPage
LearningResource или CreativeWork
Dataset, если данные публикуются
ItemList мест
BreadcrumbList
```

### Правила

```text
[ ] JSON-LD соответствует видимому контенту
[ ] Не размечать скрытое/несуществующее
[ ] Все image URLs доступны
[ ] Author в JSON-LD совпадает с видимым автором
[ ] BreadcrumbList совпадает с UI breadcrumbs
```

Google structured data guidelines предупреждают: structured data должен точно представлять видимый контент, быть полным и не вводить в заблуждение [1](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).

---

## 8. OpenGraph / Twitter

На каждой публичной странице:

```html
<meta property="og:title" content="...">
<meta property="og:description" content="...">
<meta property="og:url" content="...">
<meta property="og:type" content="article|website">
<meta property="og:image" content="https://gospod-bog.ru/images/...webp">
<meta property="og:locale" content="ru_RU">
<meta name="twitter:card" content="summary_large_image">
```

Для статей:

```html
<meta property="article:published_time" content="...">
<meta property="article:modified_time" content="...">
```

---

## 9. Images SEO

Google Image SEO best practices: использовать HTML image elements, descriptive `alt`, responsive images через `picture/srcset`, поддерживаемые форматы, описательные filenames, качественные и быстрые изображения [2](https://developers.google.com/search/docs/appearance/google-images).

Правила проекта:

```text
[ ] контентные изображения через <img>/<picture>, не только CSS background
[ ] alt обязателен для содержательных изображений
[ ] decorative images alt=""
[ ] width/height заданы
[ ] hero image оптимизирована
[ ] OG image 1200x630 где возможно
[ ] image URLs crawlable
```

---

## 10. Sitemap

### Правила

```text
[ ] sitemap.xml сохраняет URL
[ ] draft/noindex исключены
[ ] lastmod из updatedAt || publishedAt
[ ] system verification files не обязаны быть в sitemap
[ ] 404 не включать как обычную страницу
```

Astro `@astrojs/sitemap` позволяет изменять sitemap entries через `serialize`, задавать `lastmod` и исключать страницы [2](https://docs.astro.build/en/guides/integrations-guide/sitemap/).

---

## 11. RSS

Текущий URL:

```text
/feed.xml
```

Должен сохраниться.

Включать:

```text
[ ] новые статьи
[ ] title
[ ] description
[ ] link
[ ] pubDate
[ ] author при необходимости
```

Astro RSS recipe использует `@astrojs/rss` и endpoint `feed.xml.js/ts` с `rss()` helper [2](https://docs.astro.build/en/recipes/rss/).

---

## 12. Internal links

```text
[ ] все внутренние ссылки абсолютны от корня: /articles/.../
[ ] нет ссылок на .html
[ ] нет битых якорей
[ ] related articles генерируются
[ ] prev/next внутри серии
[ ] карта связей обновляется из данных
```

---

## 13. Performance SEO / Core Web Vitals

Целевые пороги web.dev:

```text
LCP <= 2.5s
INP <= 200ms
CLS <= 0.1
75-й перцентиль пользователей
```

Правила:

```text
[ ] минимум JS на статьях
[ ] React только islands
[ ] client:visible для тяжёлых компонентов
[ ] critical CSS аккуратно
[ ] fonts self-hosted
[ ] images optimized
[ ] no layout shifts
```

---

## 14. AI search / llms.txt

По состоянию на июнь 2026 есть много обсуждений `llms.txt`, но для Google AI features не нужно делать отдельную «AI SEO»-схему. Появились сообщения о первом официальном гайде Google по AI Search, где подчёркивается: оптимизация для AI Overviews/AI Mode остаётся обычным SEO, отдельные `llms.txt` и AI-specific markup не обязательны для Google [1](https://gap3.co/blog/google-ai-search-optimization-guide/).

Практическое решение для проекта:

```text
[ ] не строить стратегию на llms.txt как обязательном факторе
[ ] сделать хороший HTML, sitemap, structured data, авторство, источники
[ ] можно позже добавить llms.txt как эксперимент, но не вместо SEO
[ ] критический контент должен быть в initial HTML
```

---

## 15. International / language

Сейчас основной язык — русский.

```html
<html lang="ru">
<meta property="og:locale" content="ru_RU">
```

Для древних языков использовать:

```html
<span lang="he" dir="rtl">אַבְרָהָם</span>
<span lang="grc">λόγος</span>
```

---

## 16. Analytics

Yandex.Metrika должна сохраниться, но не блокировать рендер.

Правила:

```text
[ ] analytics async/defer
[ ] noscript fallback сохранён
[ ] CSP разрешает только нужные домены
[ ] аналитика не ломает preview без сети
```

---

## 17. Verification files

Сохранить:

```text
google7e02f9855e02b89a.html
yandex_42bc0d54a1ca4952.html
yandex_d8876d66da1b4592.html
```

Они не являются контентом и не должны мигрировать в MDX.

---

## 18. 404

```text
[ ] кастомная 404 сохраняется
[ ] HTTP status должен быть 404 на хостинге
[ ] 404 не должна индексироваться как обычная страница
[ ] ссылки на главные разделы есть
```

---

## 19. Pre-deploy SEO checklist

```text
[ ] npm run build
[ ] astro check
[ ] URL contract compare
[ ] sitemap compare
[ ] feed.xml generated
[ ] no broken internal links
[ ] JSON-LD validates
[ ] no accidental noindex
[ ] Lighthouse sample pages
[ ] mobile screenshot check
[ ] Search Console live URL after deploy for pilot pages
```

---

## 20. Итог

Новая Astro-система должна не просто «сохранить SEO», а сделать его управляемым.

```text
SEO больше не должен быть ручным HTML на каждой странице.
SEO должен быть контрактом, компонентом и CI-проверкой.
```
