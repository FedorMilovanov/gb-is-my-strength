# STRUCTURED_DATA_GRAPH_2026.md — единый граф structured data для сайта

Дата: 2026-06-12  
Связано с:

- `docs/SEO_TECHNICAL_CONTRACT_2026.md`
- `docs/EDITORIAL_AUTHORITY_EEAT_2026.md`
- `docs/MAPS_ENGINE_RESEARCH_2026.md`

---

## 1. Цель

Structured data должны быть не набором разрозненных JSON-LD блоков, а единым графом сущностей сайта.

Цель:

```text
Google/Яндекс/AI-crawlers понимают:
кто издатель;
кто автор;
какие страницы являются статьями;
какие страницы являются коллекциями;
какие страницы являются картами/learning resources;
как материалы связаны между собой;
какая иерархия breadcrumbs;
какие изображения относятся к материалам.
```

---

## 2. Главный принцип `@id`

Каждая важная сущность получает стабильный `@id`.

```text
Organization: https://gospod-bog.ru/#organization
WebSite:      https://gospod-bog.ru/#website
Person:       https://gospod-bog.ru/about/#person
Article:      https://gospod-bog.ru/articles/foo/#article
WebPage:      https://gospod-bog.ru/articles/foo/#webpage
Breadcrumb:   https://gospod-bog.ru/articles/foo/#breadcrumb
```

Это позволяет связывать сущности, а не повторять их как несвязанные объекты.

---

## 3. Базовый graph на каждой странице

Минимум:

```text
Organization
WebSite
WebPage
BreadcrumbList
```

Для статей:

```text
Article
Person author
ImageObject
```

Для разделов:

```text
CollectionPage
ItemList optional
```

Для карт:

```text
WebPage
LearningResource или CreativeWork
ItemList мест/этапов
Dataset optional, если route.json публикуется
```

---

## 4. Organization

```json
{
  "@type": "Organization",
  "@id": "https://gospod-bog.ru/#organization",
  "name": "Господь Бог — Сила Моя",
  "url": "https://gospod-bog.ru/",
  "logo": {
    "@type": "ImageObject",
    "url": "https://gospod-bog.ru/icons/icon-512.png",
    "width": 512,
    "height": 512
  },
  "sameAs": [
    "https://t.me/fedormilovanov",
    "https://vk.com/curtmf"
  ]
}
```

Google Search Gallery показывает Organization как поддерживаемый structured data type для информации об организации, логотипе и визуальных элементах [3](https://developers.google.com/search/docs/appearance/structured-data/search-gallery).

---

## 5. WebSite

```json
{
  "@type": "WebSite",
  "@id": "https://gospod-bog.ru/#website",
  "name": "Господь Бог — Сила Моя",
  "url": "https://gospod-bog.ru/",
  "inLanguage": "ru",
  "publisher": {
    "@id": "https://gospod-bog.ru/#organization"
  }
}
```

Если появится `/search/`, можно добавить `SearchAction`.

---

## 6. Person / Author

```json
{
  "@type": "Person",
  "@id": "https://gospod-bog.ru/about/#person",
  "name": "Фёдор Милованов",
  "url": "https://gospod-bog.ru/about/",
  "sameAs": [
    "https://t.me/fedormilovanov",
    "https://vk.com/curtmf"
  ],
  "knowsAbout": [
    "Библия",
    "экзегеза",
    "богословие",
    "история церкви",
    "библейская география"
  ]
}
```

Google Article docs по author markup рекомендуют использовать `Person` для людей, `Organization` для организаций, указывать `url` или `sameAs`, и не писать должность в `author.name` [1](https://developers.google.com/search/docs/appearance/structured-data/article).

---

## 7. ProfilePage для `/about/`

```json
{
  "@type": "ProfilePage",
  "@id": "https://gospod-bog.ru/about/#profilepage",
  "url": "https://gospod-bog.ru/about/",
  "name": "Фёдор Милованов — об авторе",
  "mainEntity": {
    "@id": "https://gospod-bog.ru/about/#person"
  },
  "isPartOf": {
    "@id": "https://gospod-bog.ru/#website"
  }
}
```

Google ProfilePage docs показывают `ProfilePage` с `mainEntity` Person/Organization и возможностью связывать активность/материалы [4](https://developers.google.com/search/docs/appearance/structured-data/profile-page).

---

## 8. Article

```json
{
  "@type": "Article",
  "@id": "https://gospod-bog.ru/articles/foo/#article",
  "headline": "Название статьи",
  "description": "Описание статьи",
  "url": "https://gospod-bog.ru/articles/foo/",
  "mainEntityOfPage": {
    "@id": "https://gospod-bog.ru/articles/foo/#webpage"
  },
  "image": [
    "https://gospod-bog.ru/images/foo-1x1.webp",
    "https://gospod-bog.ru/images/foo-4x3.webp",
    "https://gospod-bog.ru/images/foo-16x9.webp"
  ],
  "datePublished": "2026-06-12",
  "dateModified": "2026-06-12",
  "author": {
    "@id": "https://gospod-bog.ru/about/#person"
  },
  "publisher": {
    "@id": "https://gospod-bog.ru/#organization"
  },
  "inLanguage": "ru"
}
```

Google Article docs рекомендуют `headline`, `image`, `datePublished`, author; для изображений — crawlable/indexable URLs и несколько высококачественных аспектов 16x9, 4x3, 1x1 [1](https://developers.google.com/search/docs/appearance/structured-data/article).

---

## 9. BreadcrumbList

```json
{
  "@type": "BreadcrumbList",
  "@id": "https://gospod-bog.ru/articles/foo/#breadcrumb",
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
      "name": "Статьи",
      "item": "https://gospod-bog.ru/articles/"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Название статьи",
      "item": "https://gospod-bog.ru/articles/foo/"
    }
  ]
}
```

Важно: BreadcrumbList должен совпадать с видимой навигацией.

---

## 10. CollectionPage + ItemList

Для `/articles/`, `/biografii/`, `/karty/`:

```json
{
  "@type": "CollectionPage",
  "@id": "https://gospod-bog.ru/articles/#webpage",
  "url": "https://gospod-bog.ru/articles/",
  "name": "Статьи",
  "isPartOf": {
    "@id": "https://gospod-bog.ru/#website"
  },
  "mainEntity": {
    "@type": "ItemList",
    "numberOfItems": 10,
    "itemListElement": []
  }
}
```

Schema.org `ItemList` предназначен для списков с `itemListElement` и `ListItem` [2](https://schema.org/ItemList).

---

## 11. Карты: LearningResource / CreativeWork

Для `/karty/avraam/`:

```json
{
  "@type": "LearningResource",
  "@id": "https://gospod-bog.ru/karty/avraam/#learning",
  "name": "Путь Авраама: интерактивная библейская карта",
  "description": "Интерактивная карта пути Авраама по Быт 11–25.",
  "learningResourceType": "Interactive map",
  "inLanguage": "ru",
  "about": [
    "Авраам",
    "Книга Бытия",
    "Библейская география"
  ],
  "isPartOf": {
    "@id": "https://gospod-bog.ru/#website"
  }
}
```

---

## 12. Dataset для route.json

Осторожно: Google updates notes указывают, что Dataset structured data используется Dataset Search, а не обычными Google Search results [2](https://developers.google.com/search/updates). Но для открытых данных карт Dataset всё равно может быть полезен как machine-readable описание.

Если публикуется:

```text
/karty/avraam/route.json
```

Можно описать:

```json
{
  "@type": "Dataset",
  "@id": "https://gospod-bog.ru/karty/avraam/route.json#dataset",
  "name": "Путь Авраама — данные интерактивной карты",
  "description": "Места, этапы, источники и уровни уверенности для карты пути Авраама.",
  "url": "https://gospod-bog.ru/karty/avraam/route.json",
  "encodingFormat": "application/json",
  "creator": {
    "@id": "https://gospod-bog.ru/#organization"
  },
  "isAccessibleForFree": true
}
```

Google Dataset docs показывают `Dataset`, `name`, `description`, `url`, `license`, `creator`, `distribution` и JSON-LD как preferred syntax [5](https://developers.google.com/search/docs/appearance/structured-data/dataset).

---

## 13. FAQPage осторожно

В 2026 Google сокращает/снимает поддержку некоторых rich result appearances. Search documentation updates указывают на упрощение rich results, включая изменения FAQ/Practice Problem/Dataset visibility в Search surfaces [2](https://developers.google.com/search/updates).

Правило:

```text
FAQPage использовать только если на странице реально есть видимый FAQ.
Не добавлять FAQ ради rich results.
```

---

## 14. Генерация в Astro

Нужны функции:

```text
buildOrganization()
buildWebSite()
buildPerson()
buildWebPage(page)
buildArticle(entry)
buildBreadcrumbs(items)
buildCollectionPage(items)
buildMapLearningResource(route)
buildDataset(route)
```

Файл:

```text
src/lib/seo/schema.ts
```

---

## 15. CI checks

```text
[ ] JSON-LD parseable
[ ] expected @type exists per page type
[ ] @id stable
[ ] Article author == visible author
[ ] Article image exists/crawlable
[ ] BreadcrumbList matches visible breadcrumbs
[ ] no FAQPage unless visible FAQ exists
[ ] Dataset only for public data files
```

---

## 16. Итог

Structured data стратегия:

```text
меньше типов, но качественнее;
стабильные @id;
видимый контент == JSON-LD;
Article + Breadcrumb + Organization + Person — база;
LearningResource для карт;
Dataset только если реально публикуем данные.
```
