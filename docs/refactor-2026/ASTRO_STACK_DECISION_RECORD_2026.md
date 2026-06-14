# ASTRO_STACK_DECISION_RECORD_2026.md — ADR: выбор технологического стека сайта

Дата: 2026-06-12  
Статус: proposed

---

## 1. Контекст

Сайт `gospod-bog.ru` сейчас — статический HTML-проект с ручной вёрсткой, локальными шрифтами, SEO-метаданными, JSON-LD, sitemap/RSS и набором audit scripts.

Проблема:

```text
ручной HTML плохо масштабируется;
сложно менять 100 страниц;
сложно добавлять новые статьи без риска забыть SEO;
интерактивные разделы растут;
карты требуют отдельного движка;
нужна современная, но SEO-first архитектура.
```

---

## 2. Рассмотренные варианты

### 2.1 Оставить текущий HTML

Плюсы:

- максимально просто;
- всё уже работает;
- нет миграционного риска.

Минусы:

- масштабирование плохое;
- много дублирования;
- изменения layout/SEO требуют массовых правок;
- сложно типизировать контент;
- сложно развивать интерактив.

Решение: не подходит как долгосрочный максимум.

---

### 2.2 Чистый React/Vite SPA

Плюсы:

- удобный component DX;
- быстро делать интерактив;
- простая dev-среда.

Минусы:

- SEO-risk, если контент зависит от JS;
- больше JS для статей;
- нужно отдельно решать SSR/SSG;
- статьи и sitemap/RSS менее естественны;
- не подходит SEO-first контентному сайту.

Решение: отклонить.

---

### 2.3 Next.js static export

Плюсы:

- React-first;
- static export возможен;
- сильная экосистема;
- хороший вариант для full-stack/app-like будущего.

Минусы:

- сложнее, чем нужно для контентного сайта;
- больше React mental model;
- MDX/content pipeline нужно собирать аккуратнее;
- выше риск лишнего JS;
- для текущего проекта многие возможности избыточны.

Решение: оставить как запасной вариант, но не основной.

---

### 2.4 Astro + React islands

Плюсы:

- HTML-first;
- SEO-first;
- zero/minimal JS by default;
- React можно использовать точечно;
- MD/MDX content collections;
- Zod validation;
- sitemap/RSS/image tooling;
- удобно для контентных сайтов;
- хорошо подходит под постепенную миграцию.

Минусы:

- нужно изучить `.astro` синтаксис;
- не всё React-only;
- для сложного full-stack приложения Next/Remix могут быть сильнее;
- нужна дисциплина islands, иначе можно натянуть лишний JS.

Решение: выбрать как целевой стек.

---

## 3. Решение

Выбрать:

```text
Astro 6.x+
TypeScript
React islands
MDX
Content Collections
Zod schemas
Static output by default
Optional Cloudflare Pages later
Custom SVG map engine as React island later
```

---

## 4. Целевой стек

```text
Framework: Astro
Language: TypeScript
Interactive UI: React
Content: MD/MDX + JSON
Validation: Zod via Astro content collections
Styling: CSS tokens + component CSS; Tailwind optional, не обязательно
Search: current manifest first, Pagefind experiment later
Sitemap: @astrojs/sitemap
RSS: @astrojs/rss
Images: astro:assets / custom image pipeline
Deploy: current static first, Cloudflare Pages possible later
```

---

## 5. Почему Tailwind не обязательно

Tailwind можно использовать, но текущий сайт имеет сильную авторскую типографику и дизайн-токены. Резкий переход на utility-first может размыть стиль.

Решение:

```text
Сначала CSS tokens + Astro component styles.
Tailwind рассмотреть позже только если будет реальная польза.
```

---

## 6. Почему Astro, а не Next.js

Критерий проекта:

```text
контентность > app-like интерактив
SEO > client-side navigation
статическая публикация > серверные зависимости
точечный React > React везде
```

Поэтому Astro сильнее соответствует задаче.

---

## 7. Последствия решения

### Положительные

```text
+ SEO стабильнее
+ меньше JS
+ проще добавлять статьи
+ проще менять layout
+ строгий content model
+ React сохраняется для карт/поиска/квизов
+ можно мигрировать постепенно
```

### Отрицательные/риски

```text
- появится новый build pipeline
- нужно поддерживать legacy и Astro параллельно в миграции
- нужно написать конвертер/ручной перенос HTML → MDX
- нужно адаптировать audit scripts
```

---

## 8. Не делать в первой фазе

```text
❌ не переписывать карты сразу
❌ не переводить все статьи автоматом
❌ не менять URL
❌ не менять дизайн радикально
❌ не вводить CMS сразу
❌ не включать View Transitions/SPA-router до стабилизации SEO
```

View Transitions могут улучшить UX, но сначала нужен стабильный HTML/SEO. Любая SPA-like навигация усложняет аналитику, scroll restoration и проверку страниц. Добавлять позже, осторожно.

---

## 9. Когда пересмотреть решение

Пересмотреть, если:

```text
[ ] сайт станет приложением с auth/dashboard/API
[ ] появится редакционная команда, требующая визуальный CMS workflow
[ ] появится необходимость SSR-персонализации
[ ] Astro ecosystem резко изменится
```

Даже тогда Astro может остаться для контентной части, а app вынести отдельно.

---

## 10. Итог

ADR decision:

```text
Принять Astro + React islands как целевой стек для общего рефакторинга сайта.
Карты развивать отдельно как data-driven custom SVG, позже интегрировать в Astro как island.
```
