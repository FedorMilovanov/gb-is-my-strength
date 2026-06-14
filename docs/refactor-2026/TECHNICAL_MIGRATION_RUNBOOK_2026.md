# TECHNICAL_MIGRATION_RUNBOOK_2026.md — безопасный технический runbook миграции на Astro

Дата: 2026-06-12  
Статус: главный практический runbook. Выполнять по PR, не как big-bang rewrite.

---

## 1. Главный принцип

Миграция должна быть **strangler-style**, но для static site:

```text
Legacy HTML остаётся рабочим.
Astro появляется рядом.
Новый слой постепенно забирает отдельные URL.
Каждый URL проверяется против baseline.
Rollback возможен на каждом шаге.
```

Не делать:

```text
❌ переписать всё в одной ветке;
❌ одновременно менять framework, hosting, дизайн, URL и карты;
❌ удалять legacy до прохождения contract compare;
❌ делать Cloudflare/SSR обязательным;
❌ начинать с главной или карты Авраама.
```

---

## 2. Модель уровней безопасности

### Level 0 — Documentation / no runtime change

Только docs/scripts, production не меняется.

Примеры:

```text
docs/*.md
scripts/extract-url-contract.js
scripts/compare-url-contract.js
scripts/validate-map-routes.js
karty/_shared/route.schema.json
karty/avraam/route.draft.json, если не используется production
```

Риск: низкий.

### Level 1 — Build-only prototype

Astro установлен, но production output не заменяет legacy.

```text
/dev/astro-test/ noindex
локальный dist
CI build only
```

Риск: низкий/средний.

### Level 2 — One real page shadow/pilot

Одна реальная страница перенесена или создана как Astro route, но rollout контролируемый.

Первый кандидат:

```text
/about/
```

Риск: средний.

### Level 3 — Section index

Перенос индексной страницы раздела:

```text
/articles/
/biografii/
/karty/
```

Риск: средний.

### Level 4 — Batch content migration

Партия 3–10 статей.

Риск: средний/высокий.

### Level 5 — Interactive migration

Карты, command palette, search, graph map.

Риск: высокий.

### Level 6 — Hosting/platform migration

GitHub Pages → Cloudflare/Yandex/VPS.

Риск: высокий. Не делать сейчас.

---

## 3. Branching model

```text
main                  — production
astro-prototype-*     — маленькие Astro PR
maps-data-*           — карты/data/schema PR
content-migration-*   — партии статей
```

Правила:

```text
[ ] PR маленький
[ ] одна цель на PR
[ ] rollback очевиден
[ ] docs обновлены
[ ] contract checks зелёные
```

---

## 4. Pre-flight baseline

Перед любым runtime PR:

```bash
npm run contract:extract
cp reports/url-contract-draft.json reports/url-contract-baseline-YYYY-MM-DD.json
npm run validate:static-publication
npm run maps:validate
```

Сохранить:

```text
URL/meta baseline
sitemap.xml
feed.xml
visual screenshots ключевых страниц
размер repo/dist
```

---

## 5. Первый технический PR: astro-prototype-minimal

Цель: Astro собирается, но production не заменяется.

Файлы:

```text
astro.config.mjs
tsconfig.json
src/data/site.ts
src/layouts/BaseLayout.astro
src/components/seo/Seo.astro
src/components/ui/Header.astro
src/components/ui/Footer.astro
src/styles/tokens.css
src/styles/global.css
src/pages/dev/astro-test.astro
```

Команды:

```bash
npm run check
npm run build
npm run preview
```

Exit criteria:

```text
[ ] /dev/astro-test/ noindex
[ ] build successful
[ ] no production URL replaced
[ ] no React runtime unless island used
[ ] docs updated
```

---

## 6. Второй PR: about pilot

Цель: перенести `/about/`.

Почему:

```text
важная SEO/entity страница;
мало интерактива;
идеальна для проверки BaseLayout/Seo/JsonLd.
```

Проверить legacy vs Astro:

```text
title
description
canonical
robots
h1
JSON-LD types
OG
visible content
internal links
visual screenshot desktop/mobile
```

Exit criteria:

```text
[ ] contract compare no errors
[ ] visual diff accepted
[ ] /about/ visible without JS
[ ] ProfilePage/Person schema correct
[ ] Search Console/Yandex Webmaster после деплоя без блокеров
[ ] перед root→dist deploy switch выполнен `docs/refactor-2026/DIST_DEPLOY_SWITCH_RUNBOOK_2026-06-15.md`
```

---

## 7. Третий PR: first article pilot

Выбрать простую статью, не Нагорную, не карту.

Процесс:

```text
legacy HTML → MDX draft
frontmatter schema
ArticleLayout
Article JSON-LD
visible sources/author
related optional
```

Exit criteria:

```text
[ ] URL unchanged
[ ] title/description/canonical unchanged or intentionally improved
[ ] word count close enough
[ ] images present
[ ] internal links valid
[ ] Article schema exists
[ ] feed/search/sitemap expected behavior
```

---

## 8. Batch migration rules

Не более:

```text
3–5 сложных статей за PR
или 10 простых страниц за PR
```

Каждая партия:

```bash
npm run contract:extract
npm run contract:compare
npm run validate:static-publication
npm run maps:validate
npm run check
npm run build
```

Если visual tests подключены:

```bash
npm run test:visual
```

---

## 9. Карты — отдельный поток

Карты не зависят от Astro-первой миграции.

Поток:

```text
1. route.schema.json — done
2. route.draft.json minimal — done
3. validate-map-routes.js — done
4. extract all PLACES
5. extract STAGES/segments
6. extract LIFE/timeline
7. extract sources
8. MapTranscript generator
9. MapApp integration
```

Запрет:

```text
❌ не копировать avraam/index.html под ishod;
❌ не подключать route.draft.json к production без полной сверки;
```

---

## 10. Deployment model on GitHub Pages

Пока:

```text
current GitHub Pages/static hosting remains production baseline.
```

GitHub Pages official limits:

```text
published site <= 1GB;
soft bandwidth 100GB/month;
deployment timeout 10 minutes;
soft 10 builds/hour unless custom GitHub Actions workflow;
```

Поэтому:

```text
[ ] keep dist small;
[ ] optimize images;
[ ] avoid video/large binary;
[ ] monitor build time;
```

---

## 11. Rollback strategy

Для каждого PR:

```text
rollback = revert PR
```

Для deploy:

```text
[ ] keep previous commit SHA
[ ] know how to redeploy previous successful build
[ ] if using gh-pages branch, previous commit can be restored
[ ] if using Actions artifact, keep last successful artifact/logs
```

Rollback trigger:

```text
[ ] homepage/major page 404
[ ] accidental noindex
[ ] canonical broken sitewide
[ ] sitemap missing major URLs
[ ] analytics absent
[ ] major visual break
[ ] build/deploy partial failure
```

---

## 12. Post-deploy monitoring windows

### H+0 to H+1

```text
[ ] open deployed URLs
[ ] check /about/ or pilot page
[ ] check sitemap/feed
[ ] check 404
[ ] check verification files
[ ] check analytics request
```

### H+1 to H+24

```text
[ ] Search Console live URL for pilot
[ ] Yandex Webmaster important URL status
[ ] server/browser console errors
[ ] internal link smoke
```

### Week 1

```text
[ ] impressions/clicks no abnormal drop
[ ] indexing status
[ ] CWV sample
[ ] user-visible issues
```

---

## 13. Freeze rules

Перед production runtime PR:

```text
[ ] не делать параллельных content rewrites
[ ] не менять design radically
[ ] не менять hosting
[ ] не менять URL
[ ] не менять analytics
```

Если нужно менять несколько вещей — отдельные PR и deploy windows.

---

## 14. Decision gates

### Gate A — Astro prototype accepted

```text
Astro builds and no production replacement.
```

### Gate B — about pilot accepted

```text
One real URL migrated with no SEO/visual regression.
```

### Gate C — first article accepted

```text
MDX pipeline proven.
```

### Gate D — section index accepted

```text
Collections generate index pages correctly.
```

### Gate E — batch accepted

```text
Repeatable migration factory works.
```

### Gate F — interactive accepted

```text
Maps/search islands work with a11y/perf.
```

---

## 15. Итог

Безопасный путь:

```text
docs/scripts → build-only Astro → /about/ → one article → index pages → batches → maps/search → only then consider hosting.
```

Самое важное:

```text
Не переписывать сайт. Выращивать новую систему вокруг старой.
```
