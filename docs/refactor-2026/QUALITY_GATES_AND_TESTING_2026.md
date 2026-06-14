# QUALITY_GATES_AND_TESTING_2026.md — качество, CI и тестирование после перехода на Astro

Дата: 2026-06-12  
Связано с:

- `docs/ASTRO_MIGRATION_PHASE_PLAN_2026.md`
- `docs/SEO_TECHNICAL_CONTRACT_2026.md`
- `docs/ASTRO_STACK_DECISION_RECORD_2026.md`

---

## 1. Цель

После перехода на Astro качество сайта должно стать не ручной надеждой, а автоматическим контрактом.

```text
Нельзя опубликовать страницу без title/description.
Нельзя сломать canonical.
Нельзя потерять sitemap/RSS.
Нельзя случайно поставить noindex.
Нельзя добавить статью с битой картинкой.
Нельзя сломать accessibility базовыми ошибками.
Нельзя ухудшить визуал без явного review.
```

---

## 2. Уровни проверок

```text
Level 0 — content schema
Level 1 — static HTML/SEO contract
Level 2 — link/assets integrity
Level 3 — accessibility smoke
Level 4 — visual regression
Level 5 — interactive smoke
Level 6 — performance budget
```

---

## 3. Level 0 — Content schema

Инструмент:

```text
astro check
Zod schemas в src/content.config.ts
```

Проверяет:

```text
[ ] обязательные поля frontmatter
[ ] правильные даты
[ ] slug pattern
[ ] draft/noindex
[ ] coverAlt при cover
[ ] section enum
[ ] tags/series
[ ] map route.json schema
```

Astro docs подчёркивают: content schemas дают Zod validation и автоматические TypeScript types для content collections [2](https://docs.astro.build/en/guides/content-collections/).

Рекомендуемая команда:

```json
"validate:content": "astro check"
```

Важно: `astro build` сам по себе не обязан быть полноценным type-check. В Astro TypeScript docs указывается использовать `astro check` перед build, если нужно ломать сборку на type errors [3](https://github.com/withastro/docs/blob/main/src/content/docs/en/guides/typescript.mdx).

---

## 4. Level 1 — SEO contract

Инструменты:

```text
scripts/extract-url-contract.js
scripts/compare-url-contract.js — будущий
scripts/validate-jsonld.js — будущий
```

Уже создан extractor:

```text
scripts/extract-url-contract.js
npm run contract:extract
reports/url-contract-draft.json
reports/url-contract-draft.md
```

Проверки:

```text
[ ] URL существует
[ ] canonical self-referencing
[ ] title не пустой
[ ] description не пустой
[ ] robots index/follow для публичных страниц
[ ] h1 ровно один
[ ] og:url совпадает с canonical
[ ] og:image есть для важных страниц
[ ] JSON-LD parseable
[ ] JSON-LD types ожидаемые
```

---

## 5. Level 2 — links/assets integrity

Уже есть часть проверок в текущем `scripts/validate.js`.

Нужно сохранить и усилить:

```text
[ ] внутренние ссылки ведут на существующие маршруты
[ ] ссылки не ведут на .html
[ ] якоря существуют
[ ] img src exists
[ ] og:image exists
[ ] local fonts exist
[ ] sitemap URLs exist
[ ] feed URLs exist
```

Google для crawl budget рекомендует переиспользовать общие ресурсы по одному URL, чтобы Google мог кешировать CSS/JS/images [2](https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget?hl=en). Это значит: при Astro-миграции не плодить случайные дубликаты ассетов.

---

## 6. Level 3 — accessibility smoke

Инструменты:

```text
@axe-core/playwright
Playwright
manual keyboard test
```

Базовый тест:

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('home page has no detectable WCAG violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});
```

Важно: axe не ловит все WCAG-проблемы. Обзоры 2026 по axe/playwright подчёркивают, что автоматические движки покрывают только часть нарушений, поэтому нужен manual keyboard/screen-reader smoke [2](https://qaskills.sh/blog/ai-accessibility-testing-tools-2026).

Минимальный manual smoke:

```text
[ ] Tab проходит по навигации
[ ] focus виден
[ ] Esc закрывает модалки
[ ] кнопки имеют имена
[ ] карта имеет keyboard alternative
[ ] mobile menu работает без мыши
```

---

## 7. Level 4 — visual regression

Инструмент:

```text
Playwright toHaveScreenshot
```

Проблема визуальных тестов: шрифты, OS, dynamic content, анимации.

Рекомендации:

```text
[ ] генерировать baselines на той же OS, что CI
[ ] использовать один браузер для baseline, например chromium-linux
[ ] выключать анимации
[ ] ждать document.fonts.ready
[ ] ждать загрузку изображений
[ ] скрывать динамические элементы
[ ] отдельные snapshots desktop/mobile
```

Playwright visual testing материалы 2026 подчёркивают: baseline нужно генерировать на той же OS/browser, иначе font rendering и subpixel различия будут шуметь [2](https://bug0.com/knowledge-base/playwright-visual-regression-testing).

Пример helper:

```ts
export async function preparePageForScreenshot(page) {
  await page.addStyleTag({ content: `
    *, *::before, *::after {
      animation-duration: 0s !important;
      transition-duration: 0s !important;
    }
  `});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
}
```

---

## 8. Level 5 — interactive smoke

Проверить ключевые интерактивы:

```text
CommandPalette
Search
MapApp
Quiz
Mobile menu
Tabs/accordion
Share buttons
```

Для карт:

```text
[ ] открыть карту
[ ] открыть место
[ ] закрыть карточку Esc
[ ] включить/выключить слой
[ ] zoom buttons работают
[ ] список мест работает
[ ] transcript есть без JS
```

---

## 9. Level 6 — performance budget

Цели:

```text
LCP <= 2.5s
INP <= 200ms
CLS <= 0.1
```

Бюджеты проекта:

```text
Статья без интерактива:
  JS <= 30 KB gzip ideally
  React runtime не должен грузиться

Статья с интерактивом:
  island JS only for component

Карта:
  lazy/client:visible
  transcript first
  map engine cached
```

Проверять:

```text
[ ] Lighthouse sample pages
[ ] WebPageTest/PageSpeed для production
[ ] bundle analysis
[ ] no accidental global React
```

---

## 10. CI pipeline черновик

```yaml
name: Validate publication

on:
  pull_request:
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run contract:extract
      - run: npm run validate:content
      - run: npm run build
      - run: npm run validate:seo
      - run: npm run validate:static-publication
```

Для Playwright:

```yaml
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

---

## 11. Какие страницы тестировать первыми

```text
/                         — главная
/about/                   — author/entity
/articles/                — collection page
/articles/kod-da-vinchi/  — статья + FAQ
/articles/rimlyanam-7.../ — сложная статья
/karty/                   — хаб карт
/karty/avraam/            — тяжёлый интерактив
/map/                     — graph map
/404.html                 — system
```

---

## 12. PR checklist

```text
[ ] content schema проходит
[ ] URL contract не ухудшен
[ ] sitemap/feed обновлены ожидаемо
[ ] no broken links/assets
[ ] accessibility smoke пройден
[ ] visual diff просмотрен
[ ] Lighthouse sample не хуже
[ ] нет лишнего JS на статичных страницах
[ ] если URL менялся — есть redirect и причина
```

---

## 13. Следующие скрипты

После `extract-url-contract.js` добавить:

```text
scripts/compare-url-contract.js
scripts/validate-jsonld.js
scripts/validate-astro-build-assets.js
scripts/check-content-sources.js
scripts/generate-search-manifest-from-content.js
scripts/generate-links-graph-from-content.js
```

---

## 14. Итог

Переход на Astro должен сопровождаться не только новым framework, но и новой культурой качества:

```text
Content schema → SEO contract → Link checks → A11y → Visual → Performance.
```
