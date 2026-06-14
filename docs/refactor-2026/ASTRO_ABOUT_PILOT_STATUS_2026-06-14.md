# ASTRO_ABOUT_PILOT_STATUS_2026-06-14.md

Дата: 2026-06-14  
Риск-уровень: **Level 2 shadow/pilot, local dist only**  
Production status: **не переключено**

## Что сделано

Добавлена Astro-версия страницы:

```text
src/pages/about/index.astro
```

Она собирается в локальный `dist/about/index.html`, но текущий production deploy всё ещё публикует legacy root. То есть `/about/` на production пока остаётся legacy HTML.

## Что сохранено

Для Astro pilot сохранены ключевые SEO/контентные поля legacy `/about/`:

```text
URL: https://gospod-bog.ru/about/
Title: Об авторе — Фёдор Милованов | Господь Бог — Сила Моя
Description: Фёдор Милованов — автор и редактор богословского проекта…
H1: Фёдор Милованов
Robots: index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1
JSON-LD: Organization + WebSite + Person + ProfilePage + BreadcrumbList
OG image: /images/og-about-1200x630.webp
```

Visible text перенесён не как автоматический HTML dump, а как чистый Astro/HTML pilot с теми же смысловыми секциями:

- кто я / проект;
- богословская позиция;
- как готовятся материалы;
- о переводах;
- библейские ресурсы;
- обратная связь.

## Contract check

Добавлен single-URL compare режим в `scripts/compare-url-contract.js`:

```bash
--only-url https://gospod-bog.ru/about/
```

Новый npm script:

```bash
npm run contract:compare:dist:about
```

Проверка после `astro:build`:

```text
contract:extract:dist → 1 public page, 0 issues
contract:compare:dist:about → OK, 1 baseline page vs 1 dist page
```

## Что НЕ сделано

- deploy.yml не переключался на `dist`;
- legacy `about/index.html` не удалялся;
- sitemap/feed/search не переключались на Astro output;
- визуальный дизайн не объявлен финальным;
- `/about/` production не мигрирован.

## Следующий безопасный шаг

Перед реальным rollout `/about/` нужно:

1. визуально сравнить legacy vs dist desktop/mobile;
2. добавить build-time strangler/copy legacy mechanism или отдельный controlled deploy strategy;
3. прогнать full dist contract, когда dist содержит все legacy pages;
4. только после этого решать production ownership `/about/`.

## Dist cleanliness update

Before comparing Astro `/about/`, `astro:build` now cleans `dist/` first. This prevents old copied legacy pages from making `contract:extract:dist` look greener than the current build actually is.

## Automated legacy-vs-Astro smoke

Добавлен скрипт:

```text
scripts/astro-about-pilot-audit.js
```

Команды:

```bash
npm run astro:audit:about
npm run astro:audit:about:shots
```

Что делает:

1. запускает `strangler:build`;
2. поднимает локальные static servers для legacy root и `dist/`;
3. открывает `/about/` в обоих;
4. сравнивает title/canonical/H1/word-count/JSON-LD basics;
5. проверяет horizontal overflow и page errors;
6. опционально пишет screenshots в ignored `reports/`.

Текущий результат:

```text
legacy words: 605
astro words: 458
ratio: 0.76
contract + smoke: pass
```

Notes, не blockers:

```text
Astro pilot пока не полностью визуально/content-identical:
- нет отдельного H2 «Нашли неточность?»;
- меньше outbound/contact links, чем в legacy.
```

Это допустимо для shadow pilot, но перед production ownership `/about/` нужен ручной visual/content review.
