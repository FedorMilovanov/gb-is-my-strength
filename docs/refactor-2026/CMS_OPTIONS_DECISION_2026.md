# CMS_OPTIONS_DECISION_2026.md — нужен ли CMS и какой выбрать

Дата: 2026-06-12  
Связано с:

- `docs/CONTENT_MODEL_AND_AUTHORING_2026.md`
- `docs/ASTRO_STACK_DECISION_RECORD_2026.md`

---

## 1. Главный вывод

На первом этапе CMS не нужен.

Рекомендуемая последовательность:

```text
Фаза 1: Git + MDX + Astro Content Collections
Фаза 2: scripts/new-article.js + редакционные шаблоны
Фаза 3: если понадобится UI для редактирования — Keystatic
Фаза 4: если появится редакция/команда/preview/collaboration — Sanity/Storyblok/TinaCMS рассмотреть отдельно
```

---

## 2. Почему не CMS сразу

Сейчас главные риски:

```text
SEO migration;
контентная модель;
URL contract;
карты;
качество сборки;
визуал.
```

CMS добавит:

```text
новые зависимости;
auth;
media workflow;
preview workflow;
сложность деплоя;
новые места для ошибок.
```

Поэтому сначала — прочная файловая модель.

---

## 3. Git + MDX как «CMS для одного автора»

Плюсы:

```text
+ полный контроль
+ никакого vendor lock-in
+ Git history
+ PR review
+ content schema
+ работает offline
+ нет SaaS cost
+ идеально для одного автора/редактора
```

Минусы:

```text
- нужен редактор кода
- нет визуального UI
- картинки нужно дисциплинированно складывать
```

Для текущей стадии это лучший вариант.

---

## 4. Keystatic

Keystatic — Git-based CMS, хорошо подходит к Astro.

Astro docs имеют guide для Keystatic + Astro, где Keystatic настраивается через `keystatic.config.ts`, storage local/GitHub, collections и admin UI на `/keystatic` [5](https://docs.astro.build/en/guides/cms/keystatic/).

### Плюсы

```text
+ content остаётся в Git
+ нет базы данных
+ хорошо для Astro
+ TypeScript schema
+ local mode и GitHub mode
+ можно дать UI не-техническому редактору
+ low vendor lock-in
```

### Минусы

```text
- ещё одна система в проекте
- надо настраивать auth/GitHub mode
- media management ограниченнее, чем у headless CMS
- для большой редакции может быть мало
```

### Когда подключать

```text
после Astro migration;
после стабилизации content schemas;
если ручное редактирование MDX станет неудобным.
```

---

## 5. TinaCMS

TinaCMS — Git-based CMS с visual/in-context editing.

Плюсы:

```text
+ визуальное редактирование
+ Git-backed
+ MDX
+ удобно для редакторов, которые хотят видеть страницу
```

Минусы:

```text
- React/preview integration сложнее
- сильнее подходит Next.js-first проектам
- больше cloud/backend friction
- для Astro может быть тяжелее, чем Keystatic
```

Обзоры 2026 часто формулируют: TinaCMS выбирать, когда visual editing — жёсткое требование; Keystatic — когда важны Astro integration и developer experience [2](https://www.luckymedia.dev/insights/tina-cms).

---

## 6. Sanity / Storyblok / Contentful

Это полноценные headless CMS.

Плюсы:

```text
+ сильная редакционная среда
+ media management
+ роли/права
+ preview
+ collaboration
+ API
+ структурный контент
```

Минусы:

```text
- vendor lock-in
- SaaS cost
- API/build complexity
- нужна миграция данных
- для одного автора избыточно
```

Использовать, если появится:

```text
команда редакторов;
нужны роли;
нужен preview workflow;
много медиа;
много языков;
частые обновления без Git.
```

---

## 7. CMS decision matrix

| Критерий | Git+MDX | Keystatic | TinaCMS | Sanity/Storyblok |
|---|---:|---:|---:|---:|
| SEO control | высокий | высокий | высокий | высокий |
| Простота старта | высокий | средний | средний | низкий/средний |
| Vendor lock-in | низкий | низкий | средний | высокий |
| Visual editing | низкий | средний | высокий | высокий |
| Astro fit | высокий | высокий | средний | высокий |
| Cost | низкий | низкий | средний | средний/высокий |
| Для одного автора | высокий | высокий | средний | избыточно |
| Для команды | средний | средний | высокий | высокий |

---

## 8. Рекомендация

```text
Сейчас: Git + MDX.
Потом: Keystatic как первый CMS-кандидат.
Не начинать с Sanity/Storyblok/Tina, пока нет редакционной необходимости.
```

---

## 9. Как подготовиться к будущему CMS уже сейчас

```text
[ ] строгий content.config.ts
[ ] authors.json
[ ] series.json
[ ] sources.json
[ ] images conventions
[ ] frontmatter documented
[ ] no business logic inside MDX where possible
[ ] components stable
```

Если content model будет чистым, CMS можно подключить позже без боли.

---

## 10. Итог

CMS — не фундамент, а надстройка. Фундамент:

```text
Astro Content Collections + MDX + Zod + Git.
```

Сначала строим фундамент. Потом, если потребуется, подключаем Keystatic.
