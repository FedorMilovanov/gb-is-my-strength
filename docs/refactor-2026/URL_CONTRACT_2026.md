# URL_CONTRACT_2026.md — текущий URL/SEO контракт перед Astro-миграцией

Дата первичного baseline: 2026-06-12  
Источник: `npm run contract:extract`  
Черновые отчёты:

```text
reports/url-contract-draft.json
reports/url-contract-draft.md
```

---

## 1. Назначение

Этот документ фиксирует: какие URL существуют сейчас и что нельзя потерять при переходе на Astro.

Главное правило:

```text
Переход на Astro не должен менять публичные URL.
```

---

## 2. Baseline summary

На 2026-06-12 extractor нашёл:

```text
Всего HTML: 32
Публичных/контентных: 28
Missing canonical: 0
Bad canonical: 0
Missing description: 0
h1 count != 1: 0
```

Это значит: текущая SEO-база уже достаточно чистая, и миграция должна как минимум сохранить этот уровень.

---

## 3. Системные файлы

Не мигрировать в MDX:

```text
/404.html
/google7e02f9855e02b89a.html
/yandex_42bc0d54a1ca4952.html
/yandex_d8876d66da1b4592.html
```

В Astro:

```text
404 → src/pages/404.astro
verification files → public/*.html
```

---

## 4. Основные публичные разделы

```text
/
/about/
/articles/
/biografii/
/hard-texts/
/nagornaya/
/karty/
/map/
/pastor-series/
```

---

## 5. Карты

```text
/karty/
/karty/avraam/
/map/
```

Важно:

```text
/karty/ — библейские карты
/karty/avraam/ — карта Авраама
/map/ — карта связей статей, не библейская карта
```

Не переименовывать `/map/` в `/karta/` или `/karty/map/` без отдельного решения.

---

## 6. Articles

Существующие article URLs должны сохраниться:

```text
/articles/20-antisovetov-pastoru/
/articles/dzhon-gill-chast-1-chelovek/
/articles/dzhon-gill-chast-2-uchenyi/
/articles/dzhon-gill-chast-3-nasledie/
/articles/dzhon-gill-istoricheskiy-kontekst/
/articles/dzhon-gill-spravochnik/
/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/
/articles/kod-da-vinchi/
/articles/krajne-li-isporcheno-serdce/
/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/
```

---

## 7. Нагорная проповедь

```text
/nagornaya/
/nagornaya/chast-1/
/nagornaya/chast-2/
/nagornaya/chast-3/
/nagornaya/chast-4/
/nagornaya/chast-5/
/nagornaya/istochniki/
/nagornaya/nakhodki/
/nagornaya/seriya/
```

Не мигрировать первой: сложная серия, отдельные стили/TOC/mobile-поведение.

---

## 8. Canonical rule

Каждый публичный URL должен иметь:

```html
<link rel="canonical" href="https://gospod-bog.ru/path/">
```

И canonical должен быть self-referencing.

---

## 9. Robots rule

Публичные страницы:

```html
<meta name="robots" content="index, follow">
```

Черновики/dev:

```html
<meta name="robots" content="noindex, follow">
```

Google robots meta docs определяют `noindex` как директиву не показывать страницу в результатах поиска; если директива не задана, страница может индексироваться [1](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag).

---

## 10. При изменении URL

Изменение URL запрещено без отдельного решения. Если всё же понадобится:

```text
[ ] old URL → relevant new URL
[ ] 301/308 redirect
[ ] no redirect chains
[ ] internal links updated
[ ] canonical updated
[ ] sitemap updated
[ ] Search Console monitored
```

Google site move docs рекомендуют mapping old→new, self-referencing canonical, обновление внутренних ссылок и sitemap [1](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes).

---

## 11. Как обновлять контракт

Команда:

```bash
npm run contract:extract
```

После изменения сайта:

```text
[ ] проверить reports/url-contract-draft.md
[ ] если изменения ожидаемые — обновить этот документ
[ ] если неожиданные — исправить сайт
```

---

## 12. Следующий скрипт

Нужен:

```text
scripts/compare-url-contract.js
```

Он должен сравнивать:

```text
reports/url-contract-baseline.json
vs
reports/url-contract-new.json
```

И падать, если:

```text
[ ] публичный URL исчез
[ ] canonical изменился
[ ] title стал пустым
[ ] description стал пустым
[ ] h1 count != 1
[ ] robots стал noindex
[ ] JSON-LD Article/WebPage исчез
```

---

## 13. Итог

`URL_CONTRACT_2026.md` — защитный документ миграции. Любой Astro build должен быть проверен против этого контракта.
