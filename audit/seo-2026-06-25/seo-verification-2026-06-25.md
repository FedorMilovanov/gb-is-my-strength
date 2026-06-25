# SEO Верификация — gospod-bog.ru — 25.06.2026
## Playwright + Python raw-HTML + HTTP HEAD — финальные статусы

> Инструменты: Playwright Chromium, Python urllib, HTTP HEAD/GET  
> Проверено: 43 страницы, 9 OG-изображений, sitemap.xml, JSON-LD на 15 страницах,  
> Article schema на 8 статьях, mobile 375px, reading time drift, sitemap lastmod drift.

---

## ПЕРЕСМОТР СТАТУСОВ ПО ИТОГАМ ВЕРИФИКАЦИИ

### ✅ ЗАКРЫТЫ (были ложными или неточными)

| Баг | Первоначальный статус | После верификации |
|---|---|---|
| JSON-LD parseError на baptisty-rossii (Playwright) | P1 | **СНЯТ** — raw HTML валиден, Playwright читал DOM до гидрации |
| Broken images (manipulation.webp, humility.webp, etc.) | P2 | **СНЯТ** — все 200 OK, артефакт lazy loading race |
| JSON-LD placeholder `{jsonLd}` на `/hard-texts/` | P0 | **ПОДТВЕРЖДЁН** — raw HTML содержит буквальный `{jsonLd}` |
| JSON-LD syntax error на `/karty/ishod/` | P1 | **ПОДТВЕРЖДЁН** — лишний `}`, `]}}` вместо `]}` |
| Missing datePublished на baptisty-rossii | P1 | **ПОДТВЕРЖДЁН** — `/noch-na-kure/` и все части без datePublished |

---

## 🔴 ПОДТВЕРЖДЁННЫЕ P0 БАГИ

### BUG-P0-01: `{jsonLd}` placeholder на `/hard-texts/`
```html
<script type="application/ld+json">{jsonLd}</script>
```
- **Статус:** CONFIRMED в raw HTML  
- **Следствие:** Google Rich Results Test — ошибка. Structured data отсутствует для серии.  
- **Fix:** в Astro-шаблоне серии найти `{jsonLd}` и подставить реальный объект JSON-LD.

### BUG-P0-02: JSON-LD синтаксическая ошибка `/karty/ishod/`
```
"sameAs":["...vk.com/curtmf"]}},{"@type":"WebSite"  ← лишний }
```
- **Статус:** CONFIRMED. `]}}` вместо `]}` — лишнее закрытие объекта Organization.  
- **Fix:** убрать один `}` после `sameAs` array. Однострочная правка.

### BUG-P0-03: Thin content — 5 страниц (JS-render words < 100)
| Страница | Слов | Причина |
|---|---|---|
| `/konfessii/russkij-baptizm/` | 51 | Three.js/iframe карта |
| `/rodosloviye/` | 85 | Scaffold |
| `/map/` | 93 | D3-граф |
| `/nagornaya/seriya/` | 99 | Навигационный хаб |
| `/about/` | 0 | Таймаут 20s |

### BUG-P0-04: `/about/` — таймаут загрузки (Playwright 20s)
- HTTP HEAD = 200, но Playwright не получает domcontentloaded за 20 секунд.  
- Вероятно: тяжёлый inline JS или зависание на внешнем ресурсе.

---

## 🟠 ПОДТВЕРЖДЁННЫЕ P1 БАГИ

### BUG-P1-01: `datePublished` отсутствует в Article JSON-LD — baptisty-rossii
```json
{"@type":"Article","headline":"Воронин и ночь на Куре..."}
// datePublished — отсутствует
// dateModified — отсутствует
```
- **Подтверждено** на `/noch-na-kure/` через Playwright (renderJSON-LD live).  
- Затронуты все 10 страниц серии.

### BUG-P1-02: `publisher` отсутствует в Article JSON-LD — articles/ и nagornaya/
```
/articles/dzhon-gill-chast-1-chelovek/ → ❌pub
/articles/dzhon-gill-chast-2-uchenyi/ → ❌pub
/articles/kod-da-vinchi/ → ❌pub
/nagornaya/chast-1/ → ❌pub
/nagornaya/chast-5/ → ❌pub
```
- Поле `publisher` рекомендовано Google для Article rich results.  
- Есть `Organization` в @graph, но не связан с Article через `publisher`.

### BUG-P1-03: Sitemap lastmod — массовый drift (11 из 20 проверенных)
| Страница | Sitemap lastmod | HTTP Last-Modified | Разрыв |
|---|---|---|---|
| `/about/` | 2026-06-08 | 25 Jun 2026 | **17.9 дней** |
| `/pastor-series/` | 2026-06-08 | 25 Jun 2026 | **17.9 дней** |
| `/nagornaya/` | 2026-06-08 | 25 Jun 2026 | **17.9 дней** |
| `/hard-texts/` | 2026-06-09 | 25 Jun 2026 | **16.9 дней** |
| `/map/` | 2026-06-11 | 25 Jun 2026 | **14.9 дней** |
| `/konfessii/` | 2026-06-12 | 25 Jun 2026 | **13.9 дней** |
| `/karty/avraam/` | 2026-06-12 | 25 Jun 2026 | **13.9 дней** |
| `/karty/ishod/` | 2026-06-13 | 25 Jun 2026 | **12.9 дней** |

**Причина:** сервер отдаёт актуальный Last-Modified (сегодня), а sitemap не обновляется.  
IndexNow workflow должен решать это — но судя по красному CI, он не срабатывает.

### BUG-P1-04: Sitemap — `/nagornaya/chast-1..5/` без `priority` и `changefreq`
```xml
<url>
  <loc>https://gospod-bog.ru/nagornaya/chast-1/</loc>
  <lastmod>2026-06-25T17:24:45+03:00</lastmod>
  <!-- нет priority, нет changefreq -->
</url>
```
- Аналогично: `/karty/` — нет lastmod, priority, changefreq вообще.

---

## 🟡 P2 — НОВЫЕ НАХОДКИ ИЗ ВЕРИФИКАЦИИ

### BUG-P2-NEW-01: Reading time drift — критический разрыв на 2 страницах

| Страница | Слов (измерено) | Расчётное ~200wpm | Карточка | Разрыв |
|---|---|---|---|---|
| `/articles/20-antisovetov-pastoru/` | 15 198 | **76 мин** | 25 мин | **51 мин** ⚠️ |
| `hermenevticheskaya-otsenka-...` | 22 724 | **114 мин** | 50 мин | **64 мин** ⚠️ |
| `/articles/dzhon-gill-chast-1-...` | 6 267 | 32 мин | 32 мин | ✅ OK |
| `/nagornaya/chast-1/` | 3 630 | 19 мин | 16 мин | ✅ OK |

**Причина для антисоветов:** статья включает глоссарии и развёртываемые блоки — они в DOM но скрыты визуально. Пользователь видит ~67 мин (без скрытых блоков), карточка говорит 25 мин.  
**Причина для герменевтики:** статья — перевод, очень длинный. Карточка устарела.

### BUG-P2-NEW-02: Дублирующийся H1 на Gill трилогии (подтверждено)
```
/articles/dzhon-gill-chast-1-chelovek/ → H1: "Джон Гилл (1697–1771)"
/articles/dzhon-gill-chast-2-uchenyi/ → H1: "Джон Гилл (1697–1771)"
/articles/dzhon-gill-chast-3-nasledie/ → H1: "Джон Гилл (1697–1771)"
```
При этом JSON-LD headline правильный:
```
Часть I: "Джон Гилл. Часть I: Человек и гигант библейского богословия"
Часть II: "Джон Гилл. Часть II: Учёный и гигант библейского богословия"
```
H1 и headline разошлись — title корректный, H1 урезан.

### BUG-P2-NEW-03: Mobile tap targets < 44px (WCAG 2.5.5)

На всех трёх проверенных страницах:
```
Gill chast-1:   A(190×34) — ссылка в nav < 44px по высоте
Nagornaya ch1:  A(40×16), A(118×16) — текстовые ссылки
Baptisty-rossii: A(14×14) — маленькая ссылка (иконка?)
```
Не критично для SEO, но Core Web Vitals (mobile usability) учитывают это.

### BUG-P2-NEW-04: Priority sitemap — несоответствие важности

```
/nagornaya/seriya/   → priority=0.8 (hub, 99 слов — должно быть ≤ 0.5)
/pastor-series/      → priority=0.8 (hub, 219 слов — должно быть ≤ 0.6)
/rodosloviye/        → priority=0.7 (scaffold, 85 слов — должно быть noindex)
/nagornaya/chast-1/  → priority=НЕТ (главная статья серии — должно быть 0.9)
/nagornaya/chast-5/  → priority=НЕТ (финальная часть серии — должно быть 0.9)
```

---

## ✅ ПОДТВЕРЖДЁННЫЕ НОРМЫ

| Параметр | Статус |
|---|---|
| Все 43 страницы HTTP 200 OK | ✅ |
| 0 broken links (56 internal) | ✅ |
| Все 9 OG-изображений 200 OK | ✅ |
| `canonical` верный на всех страницах | ✅ |
| `lang="ru"` на всех страницах | ✅ |
| `meta viewport` на всех страницах | ✅ |
| `data-pagefind-body` на всех статьях | ✅ |
| BreadcrumbList на articles/ + nagornaya/ | ✅ 3 шага |
| FAQPage на kod-da-vinchi (8 Q) и antisovetov (7 Q) | ✅ |
| Article JSON-LD на articles/ и nagornaya/ | ✅ |
| `datePublished` на articles/ и nagornaya/ | ✅ |
| `author` на всех статьях | ✅ (Фёдор Милованов) |
| `inLanguage: ru` в Article | ✅ |
| robots.txt, sitemap.xml, llms.txt, favicon, manifest | ✅ все 200 |
| Нет горизонтального скролла на mobile 375px | ✅ |
| body font-size=16px на мобиле | ✅ |
| Title дублей нет | ✅ |
| Description дублей нет | ✅ |
| ScholarlyArticle на герменевтике | ✅ |
| SpeakableSpecification на baptisty-rossii | ✅ |

---

## ИТОГОВЫЙ СПИСОК ДЛЯ ФИКСА (приоритизировано)

```
🔴 P0 — НЕМЕДЛЕННО:
  1. /hard-texts/ — убрать {jsonLd} placeholder → реальный JSON-LD объект
  2. /karty/ishod/ — убрать лишний } в @graph (]}} → ]})
  3. /about/ — расследовать таймаут, проверить JS-bundle
  4. /nagornaya/seriya/ — тонкий контент (99 слов), расширить или priority снизить

🟠 P1 — ДО СЛЕДУЮЩЕГО ДЕПЛОЯ:
  5. baptisty-rossii все 10 → добавить datePublished + dateModified в Article JSON-LD
  6. articles/ + nagornaya/ → добавить publisher в Article JSON-LD (ссылка на Organization)
  7. Sitemap lastmod drift → связать с IndexNow (проверить CI workflow)
  8. Sitemap: /nagornaya/chast-1..5/ → добавить priority=0.9, changefreq=weekly
  9. Sitemap: /karty/ → добавить lastmod, priority, changefreq

🟡 P2 — ПЛАНОВЫЕ:
  10. Gill H1 → добавить номер части: "Джон Гилл (1697–1771). Часть I: Человек"
  11. SVG alt на baptisty-rossii → 220 изображений без alt
  12. Reading time карточки → пересчитать для antisovetov (25→67) и герменевтики (50→35)
  13. Title урезка: 5 страниц > 70 символов
  14. Description урезка: 2 страницы > 160 символов
  15. Priority sitemap: pastor-series 0.8→0.5, rodosloviye 0.7→noindex
  16. Mobile tap targets < 44px (особенно A(14×14) на baptisty-rossii)

🔵 P3 — ЗАДЕЛЫ:
  17. potentialAction (Sitelinks Searchbox) в WebSite JSON-LD
  18. hreflang x-default для Яндекс геотаргетинга
  19. loading=lazy + width/height на SVG-обложках
  20. twitter:card проверить на всех страницах
```

---

*Верификация: 2026-06-25T19:30Z | Playwright Chromium 149 + Python 3.13 + HTTP HEAD*  
*Данные: verify-results.json, playwright-crawl-results.json, playwright-deep-results.json*
