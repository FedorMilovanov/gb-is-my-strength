# CURRENT_REPO_ADAPTATION_2026.md — адаптация плана под актуальный main

Дата: 2026-06-12  
База анализа: `origin/main` на коммите `b2a1fc2`.

---

## 1. Важное обновление актуального репозитория

После первичного аудита в репозитории появилась крупная новая зона:

```text
/konfessii/
/konfessii/russkij-baptizm/
/konfessii/russkij-baptizm/_app/index.html
```

Согласно `AGENTS.md` r118, `/konfessii/russkij-baptizm/` — это нативная SEO/дизайн-обёртка, которая встраивает оригинальный собранный 3D-бандл через iframe:

```html
<iframe src="./_app/index.html">
```

`_app/index.html` — built asset / singlefile bundle, а не обычная страница сайта.

---

## 2. Новое правило для всех будущих агентов

```text
konfessii/russkij-baptizm/_app/ НЕ редактировать вручную.
```

Если нужно менять 3D-приложение:

```text
_build-tools/konfessii-baptizm/ → пересборка → замена _app
```

После любых изменений в отделе конфессий обязательно:

```bash
npm run konfessii:audit
npm run validate:static-publication
```

---

## 3. Как это меняет будущий Astro/strangler-план

В build-time ownership manifest нужен новый тип:

```text
embedded-app-wrapper
built-app
```

Пример будущего `migration/page-ownership.json`:

```json
{
  "/konfessii/": "legacy",
  "/konfessii/russkij-baptizm/": "embedded-app-wrapper",
  "/konfessii/russkij-baptizm/_app/": "built-app"
}
```

Правила:

```text
[ ] wrapper можно когда-нибудь мигрировать в Astro только как wrapper;
[ ] _app нельзя конвертировать в MDX;
[ ] _app нельзя прогонять обычными HTML-миграторами;
[ ] _app должен копироваться как built asset при build-time strangler;
[ ] _app robots=noindex остаётся внутренним iframe-приложением;
```

---

## 4. Обновлённая безопасная позиция

Пока владелец не разрешит рефакторинг:

```text
[ ] не устанавливать Astro;
[ ] не менять deploy.yml;
[ ] не менять production build pipeline;
[ ] не менять hosting;
[ ] не трогать /konfessii/russkij-baptizm/_app вручную;
[ ] не переносить страницы в MDX;
```

Можно:

```text
[ ] работать над статьями в текущей системе;
[ ] запускать существующие проверки;
[ ] читать этот аудит как стратегическую карту;
[ ] улучшать документацию;
```

---

## 5. Актуальные проверки текущего main

На актуальном `origin/main` были проверены:

```bash
npm run validate:static-publication
npm run konfessii:audit
npm run workflows:check
```

Состояние:

```text
validate:static-publication — pass
konfessii:audit — pass
workflows:check — pass
```

---

## 6. Что делать дальше безопасно

Ближайшие безопасные шаги без рефакторинга:

```text
1. Контентные правки статей.
2. Точечные SEO/meta/OG правки.
3. Поддержка data/search-manifest/series/links-graph.
4. Для /konfessii/ — только через текущие правила AGENTS r118.
5. Для карт — только route.draft/schema без подключения к production UI.
```

---

## 7. Первый технический шаг, когда рефакторинг разрешат

Не Astro сразу. Сначала:

```text
scripts/extract-url-contract.js → добавить --root/--out
```

Зачем:

```text
чтобы сравнивать legacy root и будущий Astro dist.
```

---

## 8. Итог

Актуальный репозиторий стал сложнее из-за нового отдела `konfessii` и встроенного 3D-приложения. Поэтому будущая миграция должна учитывать не 3, а минимум 5 типов страниц:

```text
legacy HTML pages
GBS series pages
map pages
embedded-app-wrapper pages
built-app assets
```

Главный принцип не изменился:

```text
One PR. One risk. One rollback.
```
