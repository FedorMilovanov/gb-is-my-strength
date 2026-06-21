# External Migration Constraints — Verified 2026-06-21

**Дата:** 2026-06-21  
**Цель:** зафиксировать внешние технические факты, которые прямо влияют на roadmap репозитория `gb-is-my-strength`.

---

## 1. Playwright visual regression — не просто скриншот, а стабильный capture contract

Внешняя верификация показала:

- `expect(page).toHaveScreenshot()` ждёт, пока **две последовательные page screenshots дадут одинаковый результат**, и только потом сравнивает снимок с baseline.
- `animations: 'disabled'` — встроенная опция, а не кастомный хак.
- `mask: [locatorA, locatorB]` — встроенный механизм для dynamic content.
- Docker normalization остаётся главным способом снизить cross-OS visual flake.

### Практический вывод для репозитория

Текущий проект должен мигрировать от:
- ручного pixelmatch-minded процесса,

к:
- Playwright-first visual contract,
- Docker-normalized rendering,
- route-specific masking для динамики,
- threshold profiles per lane.

---

## 2. CSS `@layer` — legacy unlayered CSS побеждает layered CSS

Внешняя верификация показала:

- **normal unlayered CSS** имеет приоритет над normal layered CSS;
- для `!important` порядок слоёв **инвертируется**;
- значит, механический перенос legacy CSS в `@layer` без явной стратегии может ничего не дать или даже ухудшить predictability.

### Практический вывод для репозитория

В проекте нельзя делать naïve plan вида:
> «обернём всё в `@layer` и specificity-проблема исчезнет».

Нужно:
1. сначала фиксировать layer order,
2. явно разбирать legacy overrides,
3. учитывать, что существующий unlayered legacy CSS будет продолжать бить layered declarations,
4. особо осторожно обращаться с legacy `!important`.

---

## 3. Astro content collections — route breakout должен использовать `render(entry)`

Внешняя верификация показала:

- в Astro content collections build-time collection задаётся через `loader: glob(...)` в `src/content.config.ts`;
- body Markdown/MDX entries рендерится через `render(entry)`;
- MDX entries в content collections должны подключаться через `getEntry()` + `render(entry)`;
- это именно тот production-path, который нужен для content/layout-first breakout.

### Практический вывод для репозитория

Для pure article routes нельзя ограничиться «подключить MDX-файл как текст». Правильный breakout должен идти через:
- `getEntry('articles', slug)`
- `const { Content } = await render(entry)`
- затем `ArticleLayout` / `SeriesArticleLayout`

Иначе migration снова останется псевдо-native.

---

## 4. Strangler / Branch by Abstraction / Parallel Run — это 3 разных режима, не один

Внешняя верификация показала:

- **Strangler Fig** подходит для incremental route replacement и facade-first migrations;
- **Branch by Abstraction** подходит для deeply embedded code refactors внутри одного приложения;
- **Parallel Run** нужен для high-risk migrations, когда старый и новый путь временно живут вместе и сравниваются по output/behavior.

### Практический вывод для репозитория

`gb-is-my-strength` не должен использовать один и тот же rollout recipe для всех страниц.

- Для hybrid hub pages подходит **shell-first strangler**.
- Для pure MDX-backed article routes подходит **layout/content breakout**.
- Для maps / genealogy / special apps нужен **parallel-run or feature-flag path**.

---

## 5. Итоговое правило для roadmap

### Нельзя больше писать
> «переводим все shadow-routes одинаково»

### Нужно писать так
- **shell-first lane** для 18 hybrid routes
- **content/layout-first lane** для 20 MDX-backed pure routes
- **parallel-run lane** для special-app pure routes

Это и есть внешне верифицированная форма следующего этапа рефакторинга.
