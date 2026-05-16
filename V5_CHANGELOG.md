# V5 — Twitter/X attribution + финальная стабилизация

Дата: 2026-05-16
Аккаунт автора: `@FedorMilovanov` (`https://x.com/FedorMilovanov`)

## Что изменено поверх V4

### 1. Twitter/X attribution

На все страницы, где уже есть Twitter Card, добавлены:

```html
<meta name="twitter:site" content="@FedorMilovanov">
<meta name="twitter:creator" content="@FedorMilovanov">
```

Логика:

- `twitter:site` — аккаунт издателя/сайта. Так как отдельного аккаунта проекта нет, используется личный аккаунт автора проекта.
- `twitter:creator` — аккаунт автора материала.

Покрытие: 17 страниц с `twitter:card`.

`404.html` не трогался: у него нет Twitter Card, и добавлять social-card metadata на страницу ошибки не нужно.

### 2. CI-регрессия закрыта

`scripts/seo-audit.js` теперь проверяет:

- наличие `twitter:site` на страницах с `twitter:card`;
- наличие `twitter:creator` на страницах с `twitter:card`;
- наличие `window.dataLayer`, если Яндекс.Метрика инициализируется с `ecommerce:"dataLayer"`.

### 3. Яндекс.Метрика / dataLayer

На страницах, где используется:

```js
ecommerce:"dataLayer"
```

добавлено перед `ym(..., 'init', ...)`:

```js
window.dataLayer = window.dataLayer || [];
```

Теперь нет страниц, где ecommerce-режим Метрики ссылается на необъявленный `dataLayer`.

### 4. Повторный cache-bust

Запущен `npm run cache-bust`.

Asset hash не изменился, потому что изменения V5 касаются HTML и audit script, а не публичных CSS/JS ассетов.

## Проверки

Выполнены:

```bash
npm run validate:strict
npm run seo-audit
node --check sw.js
node --check js/site.js
node --check js/search.js
node --check scripts/seo-audit.js
node --check scripts/download-fonts.js
```

Дополнительная независимая Python-проверка:

- 18 публичных HTML-страниц;
- 17 страниц с Twitter Card имеют `twitter:site` и `twitter:creator`;
- handle везде ровно `@FedorMilovanov`;
- дублей `twitter:site` / `twitter:creator` нет;
- `ecommerce:"dataLayer"` без `window.dataLayer` — 0;
- `javascript:void(0)` — 0;
- `<img title="...">` — 0;
- `| gb` в `<title>` — 0;
- отсутствующие `.woff2` из `fonts.css` — 0;
- битые локальные `href/src/srcset/imagesrcset` — 0;
- JSON-LD валиден;
- `feed.xml` и `sitemap.xml` валидны;
- workflows YAML парсятся;
- публичный IndexNow key-файл отсутствует.

Итог: **0 ошибок**.
