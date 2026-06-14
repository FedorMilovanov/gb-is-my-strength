# EDITORIAL_AUTHORITY_EEAT_2026.md — авторитет, E-E-A-T, редакционная модель

Дата: 2026-06-12  
Связано с:

- `docs/SEO_TECHNICAL_CONTRACT_2026.md`
- `docs/CONTENT_MODEL_AND_AUTHORING_2026.md`
- `docs/ASTRO_SITE_REFACTOR_RESEARCH_2026.md`

---

## 1. Зачем этот документ

Для богословского сайта SEO — это не только технические meta-теги. Нужна видимая редакционная надёжность:

```text
кто автор;
какова методология;
какие источники;
где текст Писания, где толкование, где гипотеза;
когда материал обновлён;
почему читатель может доверять;
чем материал оригинален;
какие ограничения/дискуссии указаны честно.
```

Google Search Essentials прямо говорит: создавать helpful, reliable, people-first content, использовать слова, которыми люди ищут материал, делать ссылки crawlable, оптимизировать изображения/видео/structured data [3](https://developers.google.com/search/docs/essentials).

---

## 2. Для проекта это особенно важно

Темы сайта:

```text
богословие;
экзегеза;
история церкви;
библейская география;
пасторское служение;
апологетика;
спорные тексты.
```

Это области, где читатель ожидает:

```text
точности;
источников;
различения факта/мнения;
уважения к тексту;
редакционной честности;
аккуратности с полемикой.
```

---

## 3. Авторская сущность

На сайте уже есть `/about/`. После Astro-рефакторинга она должна стать центральной author/entity страницей.

### Видимый блок автора на статьях

```text
Автор: Фёдор Милованов
Редакция / обновлено: дата
Метод: Писание, языки, исторический контекст, источники
```

### JSON-LD

Google Article structured data author best practices рекомендуют:

- включать всех видимых авторов в markup;
- использовать `Person` для человека, `Organization` для организации;
- не смешивать имя автора и должность в `author.name`;
- использовать `url` или `sameAs`, чтобы помочь Google понять автора [1](https://developers.google.com/search/docs/appearance/structured-data/article).

Пример:

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

---

## 4. ProfilePage

Для `/about/` можно использовать `ProfilePage` schema. Google docs по ProfilePage показывают структуру, где `ProfilePage` имеет `mainEntity` типа `Person`, плюс можно связывать статьи через `hasPart` [4](https://developers.google.com/search/docs/appearance/structured-data/profile-page).

Целевой graph для `/about/`:

```text
Organization
WebSite
ProfilePage
Person
BreadcrumbList
ItemList/hasPart recent articles optional
```

---

## 5. Редакционная политика как SEO-сигнал доверия

Уже есть:

```text
docs/EDITORIAL-SOURCE-POLICY.md
```

В будущем стоит сделать публичную страницу:

```text
/about/editorial-policy/ или /about/#method
```

И связать её из footer/about/article pages.

Содержать:

```text
как выбираются источники;
как маркируются гипотезы;
как обновляются материалы;
какие переводы Библии используются;
как обрабатываются ошибки;
как отделяется текст Писания от комментария;
как используются AI-инструменты, если используются.
```

---

## 6. Источниковость как структура

Для каждой серьёзной статьи:

```text
sourceIds в frontmatter или внутри MDX;
видимый блок источников;
источники связаны с data/sources.json;
разделение primary/academic/traditional/web;
```

Пример:

```json
{
  "id": "lloyd-jones-romans-7",
  "title": "Romans: Exposition of Chapter 7",
  "author": "D. Martyn Lloyd-Jones",
  "type": "commentary",
  "reliability": "high",
  "note": "Классическая реформационная позиция по Рим 7"
}
```

---

## 7. Уровни утверждений

В богословских и картографических материалах каждое спорное утверждение лучше маркировать уровнем уверенности.

```text
textual       — прямо следует из текста
historical    — исторически подтверждено
academic      — академический консенсус/широкая позиция
traditional   — церковная/историческая традиция
interpretive  — толковательная позиция
hypothesis    — гипотеза
contested     — спорно
```

Для карт аналогично используется `certainty`.

---

## 8. Обновления материалов

Для статей:

```yaml
publishedAt: 2026-06-12
updatedAt: 2026-06-12
```

Видимо на странице:

```text
Опубликовано: ...
Обновлено: ...
```

В Article schema:

```json
"datePublished": "...",
"dateModified": "..."
```

Правило: `dateModified` должен соответствовать реальному содержательному изменению, не «накручивать свежесть».

---

## 9. AI-generated content policy

Если AI используется как помощник:

```text
[ ] человек отвечает за финальный текст;
[ ] источники проверяются человеком;
[ ] AI не генерирует непроверенные цитаты;
[ ] спорные факты сверяются с первоисточником;
[ ] при существенном использовании можно указать редакционное примечание.
```

Google Search Essentials и helpful content guidance в целом не запрещают AI как инструмент, но оценивают полезность, надёжность и ориентацию на человека, а не способ производства.

---

## 10. Формат статьи для доверия

Идеальная структура серьёзной статьи:

```text
1. Краткий тезис / вопрос
2. Текст Писания / исходный материал
3. Контекст
4. Аргументы
5. Контраргументы
6. Историко-богословская справка
7. Вывод
8. Пастырское применение
9. Источники
10. Дата обновления
```

---

## 11. Для карт

Карты должны показывать не только маршрут, но и метод:

```text
что прямо из Бытия/Исхода/Деяний;
что реконструкция;
что археология;
что традиция;
что спорная гипотеза;
какие источники.
```

Это повышает trust и отличает проект от «красивых, но безответственных» библейских карт.

---

## 12. Компоненты для E-E-A-T

```text
<AuthorBox />
<EditorialNote />
<SourceBox />
<SourceRef />
<ClaimCertainty />
<UpdatedNotice />
<MethodologyBox />
```

---

## 13. Проверки CI

```text
[ ] article has author
[ ] author exists in authors.json
[ ] sourcesRequired => sources exist
[ ] updatedAt >= publishedAt
[ ] visible author == JSON-LD author
[ ] Article schema image crawlable
[ ] no fake FAQ/schema not visible on page
```

---

## 14. Итог

Для проекта «Господь Бог — Сила Моя» E-E-A-T — это не маркетинговая вставка, а редакционная дисциплина:

```text
автор + метод + источники + честность о спорности + обновления + структурированные данные.
```
