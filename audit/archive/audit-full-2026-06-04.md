# Полный всесторонний аудит — gospod-bog.ru

**Дата:** 2026-06-04
**Репозиторий:** https://github.com/FedorMilovanov/gb-is-my-strength
**Ветка:** main (478 коммитов, 23 тега)

---

## Сводка

| Категория | Статус | Детали |
|---|---|---|
| `audit-pro.js` | ✅ PASSED | 30 passed / 2 warnings / 0 errors |
| `validate:all` | ✅ READY | scripts валидны, cache-bust свежий |
| CI/CD | ✅ OK | deploy.yml + indexnow.yml + notify-on-failure.yml |
| Структура | ✅ OK | 5 CSS / 11 JS — контракт соблюдён |
| SEO мета-теги | ✅ OK | canonical, OG, JSON-LD, BreadcrumbList |
| Атрибуция | ✅ OK | «Автор-редактор» / «Редактор» — контракт соблюдён |
| Безопасность | ✅ OK | CSP, no eval, no http:// mixed content |
| PWA/SW | ✅ OK | manifest.json + sw.js с 4 кэш-стратегиями |
| Данные JSON | ✅ OK | glossary, search-manifest, series, strategic-map |
| Изображения | ⚠️ ПРОБЛЕМЫ | rim7: `<img>` без `<picture>`, 6 изображений без base-версий |
| CSS бюджет | ⚠️ WARN | 432KB / 375KB (gzip: 85KB) |
| JS бюджет | ⚠️ WARN | 453KB / 365KB (gzip: 113KB) |
| !important лимит | ✅ OK | site.css: 199 / 200 |

---

## 🔴 КРИТИЧЕСКИЕ проблемы

### C1. Rim7 статья: 10 изображений `<img srcset>` без `<picture>` обёртки

**Файл:** `articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/index.html`
**Нарушение:** AGENTS.md §3.6 требует `<picture>` с `<source srcset>` + `<img src>` fallback

Все 10 изображений используют `<img src="...-1200w.webp" srcset="..." sizes="...">` напрямую:
- `rim7-threshold-hero` (LCP, `loading="eager"`, `<figure class="article-img wide reveal">`)
- `rim7-rom6-8-banner` (`<figure class="article-img wide reveal">`)
- `rim7-inner-man-scroll` (`<figure class="article-img float-left reveal">`)
- `rim7-positions-map` (`<figure class="article-img wide reveal">`)
- `rim7-believer-heart` (`<figure class="article-img float-right reveal">`)
- `rim7-law-scroll-chain` (`<figure class="article-img float-left reveal">`)
- `rim7-lloyd-threshold` (`<figure class="article-img float-left reveal">`)
- `rim7-old-new-covenant` (`<figure class="article-img wide reveal">`)
- `rim7-broken-chain-hands` (`<figure class="article-img float-right reveal">`)
- `rim7-no-condemnation-banner` (`<figure class="article-img wide reveal">`)

Все 10 имеют `<figcaption>`, 3 класса figure (`wide`×5, `float-left`×3, `float-right`×2).

**Последствия:**
1. Нет `<picture>` → браузеры без webp поддержки не увидят изображения
2. Нет JPG fallback → все 10 изображений не загрузятся в Safari < 14 / старые браузеры
3. `src` указывает на размерную версию (`-1200w.webp`), а не на base-файл — при изменении viewport нет fallback URL
4. Контракт `picture > source[webp] > img[webp]` не соблюдён — это архитектурная регрессия

**Примечание:** `reveal` класс на `<figure>` **работает** (scroll-reveal из `enhancements.js` действует на `<figure>`, не на `<picture>`). Это НЕ проблема.

**Рекомендация:** Обернуть каждый `<img>` в `<picture><source srcset="..." type="image/webp"><img src="...base.webp"></picture>` и создать base-версии отсутствующих изображений.

---

## 🟠 ПРЕДУПРЕЖДЕНИЯ

### W1. CSS бюджет превышен (432KB vs 375KB цель)

| Файл | Размер | % от бюджета |
|---|---|---|
| `css/site.css` | 266KB | 71% |
| `css/home.css` | 51KB | 14% |
| `css/command-palette.css` | 38KB | 10% |
| `css/mobile-hotfix.css` | 12KB | 3% |
| `css/nagornaya-mobile-toc.css` | 23KB | 6% |
| `fonts/fonts.css` | 8KB | 2% |
| `nagornaya/tw.min.css` | 34KB | 9% |
| **Итого** | **432KB** | **115%** |

Gzip: 85KB (приемлемо для wire transfer). Бюджет 375KB — soft limit, не блокирующий.

### W2. JS бюджет превышен (453KB vs 365KB цель)

| Файл | Размер | Примечание |
|---|---|---|
| `js/site.js` | 237KB | 29 модулей, основной движок |
| `js/search.js` | 72KB | Pagefind интеграция |
| `js/enhancements.js` | 37KB | Scroll-эффекты, quiz |
| `js/bookmark-engine.js` | 25KB | Закладки |
| `js/highlights.js` | 19KB | Подсветка текста |
| `js/nagornaya-mobile-toc.js` | 25KB | Мобильное TOC |
| `js/glossary.js` | 9KB | Глоссарий |
| `js/site-utils.js` | 5KB | Утилиты |
| `js/sw-register.js` | 7KB | Регистрация SW |
| `js/scroll-perf.js` | 3KB | Performance |
| `js/series-cards.js` | 2KB | Карточки серий |
| `sw.js` | 11KB | Service Worker |
| **Итого** | **453KB** | **124%** |

Gzip: 113KB. `site.js` — намеренно большой (IIFE, 29 модулей), это архитектурный выбор.

### W3. 130 `addEventListener` без `removeEventListener` в `js/site.js`

Отмечено в AUDIT_HISTORY v28. Большинство на `document/window/body` (живут всегда). Симметризация = архитектурный рефакторинг, не точечная чистка. Риск: утечка памяти при навигации между страницами SPA-style (но сайт статический, страницы перезагружаются).

### W4. Отсутствуют base-версии изображений rim7

Следующие изображения имеют только размерные версии (`-600w`, `-900w`, `-1200w`, `-1600w`), но **не имеют base-файла** (`rim7-*.webp`):
- `rim7-threshold-hero`
- `rim7-rom6-8-banner`
- `rim7-positions-map`
- `rim7-no-condemnation-banner`
- `rim7-old-new-covenant`

`gill-nine-volumes` и `gill-preacher-pulpit` — аналогично.

Это не блокирует работу (HTML ссылается на размерные версии), но нарушает контракт «base + responsive variants».

### W5. `og-preview.jpg` не имеет webp-пары

Файл `images/og-preview.jpg` существует, но `images/og-preview.webp` — нет. По контракту AGENTS.md §3.6, `.webp` — основной формат.

### W6. 12 PNG файлов в images/

По контракту PNG — только backup. Все 12 PNG имеют webp-пары:
- `gill-clarendon-code-acts.png` ✅ есть .webp
- `gill-context-scroll.png` ✅ есть .webp
- `gill-engraving-talmud-study.png` ✅ есть .webp
- `gill-five-volumes-shelf.png` ✅ есть .webp
- `gill-library-shelf.png` ✅ есть .webp
- `gill-portret-full-study.png` ✅ есть .webp
- `gill-study-desk-full.png` ✅ есть .webp
- `gill-transatlantic-map.png` ✅ есть .webp
- `gill-young-boy-shop.png` ✅ есть .webp
- `gill-baptism-scene.png` ❌ нет (только .jpg + .webp)
- `gill-hebrew-scroll-yad.png` ❌ нет (только .jpg + .webp)
- `gill-kettering-1697.png` ❌ нет (только .jpg + .webp)

PNG-дубликаты занимают ~5-10MB дискового пространства. Можно удалить если нет внешних ссылок.

### W7. `underground-puritan-meeting.png` — единственный `<img>` без webp fallback

**Файл:** `articles/dzhon-gill-istoricheskiy-kontekst/index.html` (line 176)
**Проблема:** `<img src="../../images/underground-puritan-meeting.png">` используется напрямую, без `<picture>` обёртки и без webp-версии изображения.

Это единственный `<img>` во всём проекте, который загружает `.png` напрямую. Все остальные изображения используют `<picture><source webp><img webp></picture>` паттерн.

**Рекомендация:** Создать `underground-puritan-meeting.webp` + responsive variants и обернуть в `<picture>`.

### W8. Мёртвые файлы изображений

| Файл | Статус | Размер |
|---|---|---|
| `whitefield-field.png` | ❌ Не используется в HTML/CSS | 2.6MB |
| `whitefield-field.webp` | ❌ Не используется в HTML/CSS | 184KB |
| `whitefield-field-600w.webp` | ❌ Не используется в HTML/CSS | 32KB |
| `whitefield-field-900w.webp` | ❌ Не используется в HTML/CSS | 68KB |
| `whitefield-field-1200w.webp` | ❌ Не используется в HTML/CSS | 108KB |

Эти 5 файлов были созданы для статьи `dzhon-gill-istoricheskiy-kontekst`, но не используются. Занимают ~3MB.

**Рекомендация:** Удалить все `whitefield-field*` файлы.

---

## 🟢 ПОДТВЕРЖДЕНО КОРРЕКТНЫМ

### Структура
- ✅ Ровно 5 CSS файлов в `/css` + `fonts/fonts.css` + `nagornaya/tw.min.css`
- ✅ Ровно 11 JS файлов в `/js`
- ✅ Нет запрещённых файлов в корне (`.patch`, `.py`, `.tsx`, `src/`)
- ✅ CNAME = `gospod-bog.ru`

### SEO
- ✅ Все HTML страницы имеют `<title>`, `description`, `canonical`
- ✅ OG теги корректны (1 `og:image` per page, правильные размеры 1200x630)
- ✅ JSON-LD валиден (24 блока, Article + BreadcrumbList)
- ✅ `sitemap.xml` покрывает все 24 страницы
- ✅ `feed.xml` содержит 17 items
- ✅ `robots.txt` блокирует AI-training ботов, разрешает AI-search ботов
- ✅ `llms.txt` корректен и информативен
- ✅ Нет «Автор: Фёдор Милованов» — только «Автор-редактор» / «Редактор»

### CI/CD
- ✅ `deploy.yml` — checkout → npm ci → download-fonts → cache-bust → pagefind → upload → deploy
- ✅ `indexnow.yml` — update-meta → cache-bust → validate → seo-audit → commit → submit
- ✅ `notify-on-failure.yml` — открывает GitHub Issue при падении deploy/indexnow
- ✅ workflow_run зависимость: deploy ждёт completion indexnow

### Безопасность
- ✅ CSP заголовок настроен (Yandex Metrika, Wikimedia)
- ✅ X-Content-Type-Options: nosniff
- ✅ Нет `eval()` / `Function()` / `innerHTML = userInput`
- ✅ Нет http:// mixed content
- ✅ INDEXNOW_KEY хранится в GitHub Secrets, не в репозитории

### Service Worker
- ✅ 4 кэш-стратегии: Cache First (static/fonts/images), Stale While Revalidate (HTML), Network First (default), Network First With Cache (pagefind data)
- ✅ LRU cleanup для image/content/pagefind кэшей
- ✅ QuotaExceededError обработка
- ✅ Precache 30 URLs, pagefind skipped (генерируется при деплое)
- ✅ CACHE_VERSION обновляется через cache-bust.js

### CSS
- ✅ `!important` лимит: site.css = 199 / 200
- ✅ `html.dark` — всегда, не `.dark` на body
- ✅ Нет дубликатов top-level селекторов (PLAN-04 P1+P1b)
- ✅ Нет мёртвых компонентов (PLAN-04 P5-P7)
- ✅ `@media (hover: hover)` guard для :hover эффектов

### Доступность
- ✅ Все изображения имеют `alt` атрибуты
- ✅ Нет дублирующихся ID
- ✅ FAQPage JSON-LD синхронизирован с faq-accordion
- ✅ `aria-label` на интерактивных элементах
- ✅ `prefers-reduced-motion` учтён

---

## 📊 Метрики проекта

| Метрика | Значение |
|---|---|
| HTML файлов | 28 (25 контентных + 2 verification + 404) |
| CSS файлов | 5 (+ fonts.css + tw.min.css) |
| JS файлов | 11 (+ sw.js) |
| JSON data | 4 файла (glossary 49KB, search 19KB, series 2KB, map 30KB) |
| Изображений | 275 файлов, 69MB total |
| Шрифтов | Cormorant Garamond, Inter, Lora, Noto Sans Greek/Hebrew, Playfair Display, Source Sans 3 |
| Статей | 12 (включая Gill-трилогию, Нагорную 5 частей, pastor-series) |
| Коммитов | 478 |
| Тегов | 23 |
| audit-pro checks | 30 passed / 2 warn / 0 errors |
| Gzip total | ~198KB (CSS 85KB + JS 113KB) |

---

## 📋 Рекомендации (приоритет)

### Высокий приоритет
1. **C1**: Обернуть 10 rim7 `<img>` в `<picture>` с `<source type="image/webp">` и создать base-файлы
2. **C2**: Создать `rim7-*.webp` base-файлы для 5 изображений rim7 без base-версий
3. **C3**: Создать `gill-preacher-pulpit.webp` и `gill-nine-volumes.webp` base-файлы
4. **W7**: Создать `underground-puritan-meeting.webp` и responsive variants, обернуть `<img>` в `<picture>`

### Средний приоритет
5. **W8**: Удалить 5 мёртвых файлов `whitefield-field*` (~3MB)
6. **W5**: Конвертировать `og-preview.jpg` → `og-preview.webp` или удалить
7. **W6**: Удалить 12 PNG-дубликатов (все имеют webp-пары; PNG используются только как fallback, но не в `<img>`)
8. **W4**: Проверить `rim7-believer-heart.webp` — это единственное rim7-изображение с base-файлом; убедиться что остальные тоже имеют base

### Низкий приоритет
9. Рассмотреть minification `js/site.js` (237KB → ~100KB minified)
10. Рассмотреть minification `css/site.css` (266KB → ~180KB minified)
11. Добавить `<link rel="preload" as="image">` для LCP-изображения `rim7-threshold-hero` (сейчас hero загружается с `loading="eager"` но без preload hint)
12. Рассмотреть добавление `fetchpriority="high"` на `rim7-threshold-hero` (текущий `<img>` уже имеет `loading="eager"` — это хорошо, но `fetchpriority` даст дополнительный буст LCP)

---

## 📝 Примечания

- Проект находится в **отличном состоянии** после 6 месяцев интенсивной работы (май-июнь 2026)
- Все 3 крупных плана (PLAN-04, PLAN-05, PLAN-06) выполнены
- Архитектурные контракты (5 CSS / 11 JS, !important ≤ 200, автор-редактор) соблюдаются
- CI/CD pipeline полностью автоматизирован с проверками на каждом этапе
- Budget warnings (CSS/JS) — осознанный компромисс «качество > размер» (AUDIT_HISTORY v28)
- Rim7 статья — самая свежая, требует завершения оформления изображений по контракту
