# AGENTS.md — gb-is-my-strength (gospod-bog.ru)

> **Обязательно к прочтению ДО любой правки кода**, если ты — ИИ-агент
> (Cursor / Arena Agent / Copilot Workspace / Kilo / любой).
>
> Этот файл — **договор** между владельцем (Фёдор Милованов) и любым агентом.
> Нарушение = регресс, который видят сотни читателей сайта.
> Если правило кажется глупым — **спроси, ПОЧЕМУ оно появилось**.

| Версия документа | Дата | Состояние |
|---|---|---|
| **AGENTS-r77** | 2026-06-09 | Smart anti-regression guards added to `scripts/audit-pro.js` (10 новых проверок, **58 passed · 0 warnings · 0 errors**). Каждая проверка появилась как ответ на конкретный инцидент — это «умная» защита, не «тупая». **G1 junkFilesGuard**: блокирует деплой если в репо появятся `*.py` / `*.patch` / `*-patch` / `uploads/` / `.DS_Store` / `Thumbs.db` (ловит брошенные после агентских правок скрипты вроде `fix_home.py`). **G2 oversizedImagesGuard**: PNG/JPG > 700 KB в `/images/` = ошибка (ловит сырые загрузки агентов вроде 2.3 MB `og-rimlyanam-7-new.png`), кроме явного ALLOWLIST (сейчас 1: `whitefield-field.png`) и суффиксов `*-original.*` / `*--keep.*`. **G3 seriesConsistencyGuard**: каждая `published` часть в `data/series.json` должна существовать на диске. **G4 seriesLandingTitleGuard**: cross-check — `/hard-texts/` не должна содержать «кафедры/пасторских патологий/диотреф», `/pastor-series/` не должна содержать «Тайны человеческого сердца/Иеремия 17» (ловит copy-paste-катастрофы при создании нового лендинга из старого). **G5 catalogDuplicatesGuard**: в `/articles/index.html` нет дублей `<a class="h-article-card">` (поймал дубли Иер/Рим7 в коммите ad32a3e6). **G6 unifiedHeaderGuard**: все страницы с `<ul class="h-nav-links">` обязаны содержать канонический набор {Публикации · Разбор заблуждений · Биографии · Все статьи · О библиотеке}. **G7 navListSemanticsGuard**: запрещает `<button>` внутри `<ul class="h-nav-links">` (нарушение §9.7, ломает цвет иконок). **G8 hardTextsLinkAuditGuard**: на `/hard-texts/` все article-card ссылки должны быть из `series.json.hard-texts.parts`. **G9 hashedAssetExistenceGuard**: каждый `?v=…`-хешированный URL должен указывать на существующий файл. **G10 gitignoreSanityGuard**: `.gitignore` должен покрывать `.npm/` / `.DS_Store`. Также очищен реальный мусор: удалены `images/og-series-heart.png` (1.4 MB raw), `images/hard-texts/og-rimlyanam-7-new.png` (2.3 MB) + `og-series-heart.png` (1.4 MB), `scripts/audit-pro.js-patch`. **!important** в site.css: 199 (≤200 ✅). |
| **AGENTS-r76** | 2026-06-09 | Articles index unified header + wide catalog. На странице `/articles/` (`body.articles-index-page`) шапка приведена к единому эталону (как `/biografii/`): убрана нестандартная `<button class="h-cp-btn">` лупа поиска внутри `<ul.h-nav-links>` (нарушала §9.7 — была в `<li>` и наследовала цвет ссылок навигации, выглядела чёрной vs серой луны), убрано второе дублирование `theme-toggle`. Теперь `mobile-controls` содержит только `theme-toggle` + `h-mobile-menu-btn`, как на всех других страницах. В navbar/mobile-nav главной добавлена ссылка «Все статьи»; в navbar/mobile-nav `/articles/` добавлены «Биографии» + «О библиотеке» (раньше шапки на разных страницах сайта отличались). Удалены **дубли карточек** Иеремии 17 и Римлянам 7 в каталоге (были дважды). Добавлен **full-width баннер серии «Тайны человеческого сердца»** на `/articles/` (как у Нагорной), ведущий на `/hard-texts/`. Каталог `/articles/` на десктопе теперь широкий (до 1280–1320px) с 3-колоночной сеткой карточек (≥1100px) — премиальный вид без портянки. На странице `/hard-texts/` ранее найдена и устранена крупная регрессия: H1 был «Тёмная сторона кафедры», summary/hero/stats — про пасторские патологии, видимый HTML содержал Блоки 2/3 с Частями 7–9 («Здоровое пастырство», «Признаки здоровой церкви», «20 пасторских патологий»). Полностью переписано под Иеремия 17 / Римлянам 7 / Римлянам 8 (3 части). Заменена обложка Римлянам 7 на новое изображение (коленопреклонённый перед скрижалями, дуальная стилистика light/obsidian). **!important** в site.css: 199 (≤200 ✅). Новый блок «articles-index-page — wide premium catalog» в `css/home.css` написан без единого `!important`. |
| **AGENTS-r75** | 2026-06-08 | Unified Series Navigator v2. Расширен `js/series-cards.js` (без новых JS-файлов): добавлены 2 новых рендер-режима поверх существующего `[data-series-cards]`: **`[data-series-strip="key"]`** — компактная топ-навигация для статей серии (← prev | dots | next →), **`[data-series-nav="key"]`** — премиум-сайдбар (для будущего использования). Данные читаются из `data/series.json` (добавлены `baseUrl` для nagornaya/pastor-series). Все 5 статей трилогии о Гилле получили `<aside data-series-strip="dzhon-gill">` вверху; одновременно удалены огромные inline-styled блоки «Трилогия о Джоне Гилле» (~12.5 КБ HTML-мусора с тремя ручными карточками опасностью регрессии при добавлении новых частей). Теперь добавление новой части серии = одна правка `data/series.json` + автоматический рендер на всех страницах серии. Стили в `css/site.css` (`.gb-strip`, `.gb-snav`), `!important` без изменений (196 ≤ 200). |
| **AGENTS-r74** | 2026-06-08 | User-reported regression pass III. Восстановлен **анимированный голубь с махающим крылом** (`.fn-marker--dove::before` + JS-inject `.fn-dove-body` + `.fn-dove-wing` + `@keyframes fn-dove-flap`) — был случайно откатан r71 на статичный FA-голубь. Возвращена картинка `whitefield-preaching` (вторая в `/articles/dzhon-gill-istoricheskiy-kontekst/`) — мой Kennington Common был хуже оригинала. Удалены сгенерированные мной файлы `images/whitefield-kennington-common-*` (8 файлов). **Картинка `gill-library-shelf` перенесена** из позиции «впритык после whitefield-field» в Section I после первого параграфа — теперь между ними есть текст. **Удалён `article-topnav`** (sticky шапка при скролле статей) из всех 8 статей — пользователь его не хочет. Чёткое правило: **theme-toggle / search-icon = ЧИСТЫЙ SVG БЕЗ КРУЖОЧКОВ / РАМОК / БЭКГРАУНДА** (см. §9.7). Убран `opacity:.86!important` из `mobile-hotfix.css` который вызывал двойное наложение sun+moon при переключении темы. Убран pill-фон `.gb-fc-btn` (был border + background + box-shadow) — теперь чисто SVG. Добавлен preload для Inter-600 и Playfair-700 — FOUC на «АВВАКУМ 3:19» исчезает. Цвет hover-заголовка `.h-article-title` в тёмной теме изменён с розового `--h-accent` (#d97a6c) на золотистый `#e8c97a`. Восстановлен margin-bottom 24px на `.context-bridge` (был встык со следующим `<p>`). Починен summary-card grid (3 варианта: только-num / check+num) — текст больше не сжимается в 60px. SITE_CONFIG contract guard добавлен в `audit-pro`. **!important** в site.css: 196 (≤200 ✅). |
| **AGENTS-r73** | 2026-06-08 | User-reported quality pass. Восстановлен `window.SITE_CONFIG` контракт на 3 страницах (kontekst/spravochnik: `base:` → `site:`; rim7: добавлен `site:` блок). Topnav layout исправлен: `.article-topnav-title` получил `margin:0 auto;padding:0 16px` чтобы корректно центрироваться между home-ссылкой и search-кнопкой (было: «Сила МояДжон Гилл» слитно). Закрыты `</span>` на 6 файлах. nag-summary внутри indigo/teal hero получил светлый текст (читабельный контраст). Добавлена `audit-pro` проверка SITE_CONFIG runtime contract (46 проверок). |
| AGENTS-r72 | 2026-06-08 | User-reported visual regression pass II (Arena Agent). Перевод 31 ambient-фразы на главной (Solus Christus → «Только Христос», Dominus illuminatio mea → «Господь — свет мой», Ego sum via veritas et vita → «Я есмь путь и истина и жизнь» и т.д.) + источник под подписью (`.h-phrase-source`, минималистично, мелким шрифтом, появляется на hover без перекрытия). Заменена вторая картинка Уайтфилда в `dzhon-gill-istoricheskiy-kontekst` (была визуально дубликатом первой) на новую Kennington Common ~1739. Порядок Гилла на `/biografii/`: [контекст, ч.1, ч.2, ч.3, справочник]. Порядок на `/articles/`: контекст → справочник. Введён 2-колоночный grid `.h-article-list--grid` для одиночных статей (компактнее при росте каталога). Удалены inline `padding-top:0` overrides — секция «Разбор заблуждений» больше не упирается в предыдущую. |
| **AGENTS-r71** | 2026-06-08 | CRITICAL fix: предыдущий `49882d9 «balance 151 unclosed braces»` восстановил счёт `{}`, но в неверных позициях. site.css парсился как 1 top-level правило с 19 cssRules вместо ~1222 — половина страниц рендерилась без основного CSS, шрифт падал в Times New Roman, share-кнопки раздувались. Восстановлен чистый baseline `32e8c63` (1703/1703 braces, 194 !important — снова в рамках PLAN-04 ≤200) + аккуратно дополнен финальным dove-маркером. В `audit-pro` уже есть структурный guard CSS-braces (от r71) — теперь сработает при любой подобной регрессии. |
| AGENTS-r70 | 2026-06-08 | Browser-QA проход (Playwright/Chromium). Исправлены реальные баги, найденные `visual-audit`: (1) 36 незакрытых `<span>`-маркеров и 6 «eyebrow»-лейблов в `20-antisovetov-pastoru` ломали вёрстку (paragraphs становились flex-детьми → horizontal-overflow); (2) тултипы на десктопе теряли width-clamp и фон-карточку (правила погребены во вложенности) — добавлен плоский tooltip-hardening блок на глубине 0; (3) overflow `series-nav` (negative margins) и nagornaya `shrink-0` pills на узких экранах; (4) ложный low-contrast на `.h-featured-series`. `visual-audit`: 8 → 0 raw bugs. !important без изменений (270). |
| **AGENTS-r69** | 2026-06-08 | Голубь-сноска `.fn-marker--dove` обновлён (новый премиум-силуэт, hover-взмах крыла), мёртвый inline `fn-dove-icon` удалён из HTML. В `audit-pro` добавлены guard-проверки: авто-потолок `!important` (`IMPORTANT_CEIL`), целостность dove-маркеров. site.css `!important` 295→270. Проверок теперь 38. |
| **AGENTS-r68** | 2026-06-06 | Добавлен `docs/EDITORIAL-SOURCE-POLICY.md` и ссылки на него; актуализировано число проверок `audit-pro` до 36. |
| AGENTS-r67 | 2026-06-06 | Добавлен технический guard в `validate.js` и `audit-pro.js`: английские прямые цитаты в русских статьях блокируются проверками. |
| AGENTS-r66 | 2026-06-06 | Добавлено правило языка статей: в русских материалах не оставлять английские прямые цитаты; английские названия источников/URL/DOI допустимы только как библиографические идентификаторы. |
| AGENTS-r65 | 2026-06-04 | После budget/perf pass: CSS/JS assets сжаты до продакшн-формата, бюджетные warnings в `audit-pro` сняты. Важно: архитектурный контракт не изменился — всё ещё 5 CSS + 11 JS, один основной `site.js`. |
| AGENTS-r64 | 2026-06-04 | После PLAN-06 JS cleanup: синхронизированы заголовки модулей в `js/site.js` (добавлены 28/29/30) и `js/enhancements.js` (пронумерованы A..G). Подтверждено: реального dead code в JS нет. См. `audit/PLAN-06-DONE.md`. |
| AGENTS-r63 | 2026-06-04 | Полная перезапись (PLAN-05). Старая история свёрнута. |

**Владелец:** Фёдор Милованов (редактор/автор-редактор, не «автор»)
**Прод:** https://gospod-bog.ru · GitHub Pages из ветки `main`
**Node:** требуется `>=20`

---

## 0. TLDR — что СРАЗУ нельзя делать

1. ❌ **Создавать новые CSS/JS файлы.** Архитектурный максимум: **5 CSS + 1 шрифтовой + 11 JS**. Список фиксирован, см. §2.
2. ❌ **Менять byline на «Автор: Фёдор Милованов».** Только `Автор-редактор:` (тип A/B) или `Редактор:` (тип C — переводы). См. §3.1.
3. ❌ **Возвращать `AI-disclosure`.** Удалён 2026-06-02 (`AGENTS-r11`), повторно удалён в PLAN-04 (CSS-остатки). Об ИИ — только на `/about/`.
4. ❌ **Запускать `prettier --write .` или `eslint --fix .`** по всему дереву. Только точечно.
5. ❌ **Обновлять зависимости в `package.json`** без явного запроса.
6. ❌ **Удалять/переименовывать `?v=...` хеши.** Они генерируются `scripts/cache-bust.js`. После любой правки CSS/JS — запусти `npm run cache-bust`.
7. ❌ **Удалять заголовки `<header class="article-header">` или `<aside class="author-card">`.** Это контракт разметки.
8. ❌ **Создавать в корне репо `.patch`, `*.py`, `*.tsx`, `src/components/*`** — статический сайт без сборщика, см. §10.
9. ❌ **Дублировать `<meta og:*>`.** Один `og:image` per page. JPG-fallback — только если `.jpg` файл реально есть на диске.
10. ❌ **Создавать legacy-кнопки** `.theme-float-btn`, `#themeFloat`, `#gbSearchFloat`, `.nag-theme-btn`. Удалены в PLAN-04 P5. Единственный canonical блок плавающих контролов — `gbFloatingControls` (`js/site.js` модуль 29), классы `.gb-fc-theme` / `.gb-fc-search`.
11. ❌ **Добавлять новые `!important` без анализа конкурента.** См. §4.2 — обязательный 5-шаговый чеклист.
12. ✅ **После любой правки CSS/JS** → `npm run cache-bust`.
13. ✅ **Перед коммитом** → `npm run validate:all` + `node scripts/audit-pro.js`. Оба должны быть PASS. Эти проверки теперь включают Russian quote policy guard; подробные правила — в `docs/EDITORIAL-SOURCE-POLICY.md`.
14. ❌ **Не оставлять английские прямые цитаты в русских статьях.** Названия книг/статей, URL, DOI и библиографические данные могут быть на английском; цитируемые мысли, прямые речи и сильные фразы автора в теле русской статьи должны быть переведены на русский. Оригинал можно давать только ссылкой на источник, не вставляя англоязычную цитату в текст.

---

## 1. О проекте

Христианский богословский сайт со статьями, биографиями, серией «Нагорная проповедь» (5 частей), серией «Тёмная сторона кафедры» (pastor-series), серией о Джоне Гилле (5 текстов), статьями о Коде да Винчи / герменевтике / Иеремии и др.

**Стек:** статический HTML + CSS + JS, без сборщика, без TypeScript, без React.
**Хостинг:** GitHub Pages, автодеплой через `.github/workflows/deploy.yml`.
**Поисковая индексация:** `.github/workflows/indexnow.yml` уведомляет Яндекс/Bing при push в main.
**Алерты на падение CI:** `.github/workflows/notify-on-failure.yml` открывает GitHub issue (label `ci-failure`).

### 1.1 Целевые браузеры

| Платформа | Браузер | Минимальная версия |
|---|---|---|
| Desktop | Chrome / Edge | 90+ |
| Desktop | Firefox | 90+ |
| Desktop | Safari | 15+ |
| Mobile | iOS Safari | 15+ |
| Mobile | Android Chrome | 90+ |
| Mobile | Samsung Internet | 16+ |

CSS-фичи, не поддерживаемые в этих версиях (`color-mix()`, `grid-template-rows: 0fr`, `:has()`), **обязаны** иметь `@supports`-fallback или каскадный fallback (`property: rgb(...); property: color-mix(...);`).

### 1.2 Метрики качества

| Метрика | Цель |
|---|---|
| Lighthouse Performance (mobile) | ≥ 90 |
| Lighthouse Accessibility | ≥ 95 |
| Core Web Vitals LCP | < 2.5s |
| Core Web Vitals CLS | < 0.1 |
| `audit-pro` | ✅ PASSED, errors = 0 |
| `validate:all` | ✅ 0 errors, 0 warnings |
| `tokens:check` | ✅ 0 / 0 |
| `visual-audit` (Playwright) | 0 console-errors, 0 network-errors |
| CSS `!important` в `site.css` | цель **≤ 200**; авто-потолок в `audit-pro.js` (сейчас 270, ratchet вниз) |

---

## 2. Архитектура — единственно верная

```
/
├── index.html                      ← главная
├── 404.html                        ← страница ошибки
├── sw.js                           ← Service Worker
├── manifest.json                   ← PWA
├── feed.xml                        ← RSS
├── robots.txt, sitemap.xml         ← SEO
├── llms.txt                        ← правила для LLM
├── AGENTS.md                       ← ⭐ ЭТОТ файл
├── README.md                       ← пользовательская архитектурная документация
├── AUDIT_HISTORY.md                ← консолидированный changelog аудитов
├── CNAME                           ← gospod-bog.ru
│
├── package.json                    ← build-скрипты, без рантайм-зависимостей
├── .github/workflows/              ← deploy.yml + indexnow.yml + notify-on-failure.yml
│
├── css/                            ← РОВНО 5 ФАЙЛОВ. БОЛЬШЕ НЕ СОЗДАВАТЬ.
│   ├── site.css                    ← основной слой (статьи, шапка, тёмная тема)
│   ├── home.css                    ← только главная + каталоги (hero, dashboard)
│   ├── command-palette.css         ← поиск (Ctrl+K)
│   ├── mobile-hotfix.css           ← мобильные производительные hotfix-правки
│   └── nagornaya-mobile-toc.css    ← мобильное оглавление Нагорной проповеди
│
├── fonts/
│   └── fonts.css                   ← @font-face деклараты, не трогать
│
├── js/                             ← РОВНО 11 ФАЙЛОВ. БОЛЬШЕ НЕ СОЗДАВАТЬ.
│   ├── site.js                     ← главное (theme, nav, quiz, tooltips, gbFloatingControls)
│   ├── site-utils.js               ← утилиты, доступные отдельным страницам
│   ├── scroll-perf.js              ← производительность scroll/observers
│   ├── search.js                   ← Ctrl+K поиск (CommandPalette)
│   ├── enhancements.js             ← scroll-эффекты, lazy load, ambient phrases
│   ├── highlights.js               ← подсветка текста, заметки
│   ├── glossary.js                 ← глоссарий богословских терминов
│   ├── bookmark-engine.js          ← закладки (localStorage)
│   ├── series-cards.js             ← карточки серий
│   ├── nagornaya-mobile-toc.js     ← мобильное TOC для проповеди
│   └── sw-register.js              ← регистрация Service Worker
│
├── data/                           ← JSON-данные для рантайма
│   ├── glossary.json               ← термины глоссария
│   ├── search-manifest.json        ← индекс поиска
│   ├── series.json                 ← карточки серий
│   └── strategic-map-antisovetov.json  ← MAP_DATA для 20-antisovetov-pastoru
│
├── articles/                       ← статьи (каждая = папка с index.html)
│   ├── index.html                  ← каталог всех статей
│   ├── 20-antisovetov-pastoru/
│   ├── dzhon-gill-chast-1-chelovek/
│   ├── dzhon-gill-chast-2-uchenyi/
│   ├── dzhon-gill-chast-3-nasledie/
│   ├── dzhon-gill-istoricheskiy-kontekst/
│   ├── dzhon-gill-spravochnik/
│   ├── hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/
│   ├── kod-da-vinchi/
│   └── krajne-li-isporcheno-serdce/
│
├── nagornaya/                      ← серия «Нагорная проповедь»
│   ├── chast-1/ ... chast-5/       ← 5 частей
│   ├── istochniki/                 ← библиография
│   ├── nakhodki/                   ← находки
│   ├── seriya/                     ← обзор серии
│   ├── tw.min.css                  ← Tailwind (НЕ ТРОГАТЬ — отдельная генерация)
│   └── index.html                  ← обзор серии
│
├── about/, pastor-series/, biografii/   ← статичные разделы
│
├── scripts/                        ← build-инструменты (Node.js)
│   ├── cache-bust.js               ← ⭐ генерит ?v=... хеши
│   ├── validate.js                 ← валидация HTML/JSON/манифестов
│   ├── audit-pro.js                ← главный аудит (запускать перед каждым push)
│   ├── seo-audit.js                ← SEO-проверки
│   ├── visual-audit.js             ← Playwright скриншоты + console/network errors
│   ├── update-meta.js              ← обновление meta-тегов
│   ├── check-design-tokens.js      ← валидация дизайн-токенов
│   ├── deep-check.js, _audit-deep.js  ← глубокий аудит (внутренние)
│   ├── download-fonts.js           ← скачка шрифтов
│   ├── build-avif.sh               ← конвертация в AVIF
│   └── resize_og.py                ← рескейл OG-картинок (Pillow)
│
├── audit/                          ← последние audit-pro отчёты + AUDIT_CLEANUP_PLAN
└── images/                         ← все изображения
```

### Запрещено создавать новые CSS-файлы

У сайта **ровно 5 CSS + 1 шрифтовой**. Каждый файл = отдельный HTTP-запрос на статическом хостинге без bundler'а. Новая правка идёт в существующий файл по таблице:

| Что правишь | В какой CSS |
|---|---|
| Общие компоненты, статьи, шапка, тёмная тема | `site.css` |
| Главная + каталоги (только то, чего нет на других страницах) | `home.css` |
| Поиск (Ctrl+K, всплывашка) | `command-palette.css` |
| Мобильные hotfix touch-pointer overrides | `mobile-hotfix.css` |
| Мобильное оглавление Нагорной проповеди | `nagornaya-mobile-toc.css` |
| @font-face декларации | `fonts/fonts.css` |
| Tailwind для Нагорной | `nagornaya/tw.min.css` (НЕ ТРОГАТЬ) |

### Запрещено создавать новые JS-файлы в `js/`

Все 11 файлов — фиксированный набор. Новая логика идёт **внутрь существующего** файла по теме (если ничего не подходит — в `enhancements.js`).

---

## 3. PROTECTED — не трогать без письменного разрешения

### 3.1 Атрибуция авторства (КРИТИЧНО)

Фёдор Милованов на сайте — **автор-редактор** оригинальных статей и **редактор** переводов. **НЕ «автор»** в традиционном смысле. Он задаёт направление, редактирует, исправляет неточности и собирает материал при помощи ИИ.

#### Правило: нигде не писать «Автор: Фёдор Милованов».

| Тип контента | Byline в `<header>` | `.author-card-label` | Карточки в каталогах |
|---|---|---|---|
| Тип A — авторская статья | `Автор-редактор: Фёдор Милованов` | `Автор-редактор` | `Автор-редактор: Фёдор Милованов` |
| Тип B — авторская серия / разбор | `Автор-редактор: Фёдор Милованов` | `Автор-редактор` | `Автор-редактор: Фёдор Милованов` |
| Тип C — перевод зарубежной статьи | `Редактор: Фёдор Милованов` | `Редактор` | `Ред.: Фёдор Милованов` |

#### Meta-теги:

- **Тип A/B:** `<meta name="author" content="Фёдор Милованов">` + `<meta property="article:author" content="Фёдор Милованов">`.
- **Тип C:** `<meta name="author" content="Имя оригинального автора">` + `<meta name="translator" content="Фёдор Милованов">` + `<meta property="article:author" content="Имя оригинального автора">`.

#### feed.xml для всех типов:

```xml
<dc:creator>Фёдор Милованов</dc:creator>
```

### 3.2 JSON-LD структура

В каждой статье есть `<script type="application/ld+json">` с `Article` (или `ScholarlyArticle` для переводов) + `BreadcrumbList` + `Person` (автор оригинала или Фёдор как редактор). **Не упрощать, не «оптимизировать», не удалять.** Это критично для SEO.

Для переводов:
```json
"@type": "ScholarlyArticle",
"author": { "@type": "Person", "name": "Имя Автора Оригинала" },
"translator": { "@id": "https://gospod-bog.ru/about/#person" }
```

### 3.3 OpenGraph + Twitter Card теги

В каждой `index.html` статьи есть полный набор `<meta property="og:*">`. Не удалять, не сокращать «для чистоты». **Один `og:image` per page.** JPG-fallback можно ставить ТОЛЬКО если файл `images/<name>.jpg` реально существует.

### 3.4 Service Worker и cache-bust

Версии файлов в HTML:
```html
<link rel="stylesheet" href="css/site.css?v=2223865f">
<script src="js/site.js?v=54e3f377"></script>
```

Хеши — **CRC32 содержимого файлов**, генерируются `scripts/cache-bust.js`. **Не трогать руками.** После правки CSS/JS — обязательно `npm run cache-bust`.

`CACHE_NAME` в `sw.js` также пересчитывается автоматически.

### 3.5 Структура Нагорной проповеди

Серия = 5 частей + 3 вспомогательных страницы (`istochniki`, `nakhodki`, `seriya`). Внутри каждой части — `<aside class="article-toc">`. **Не упрощать TOC, не сжимать вёрстку, не удалять подключение `tw.min.css`** в Нагорной.

`tw.min.css` — минифицированный Tailwind, генерируется отдельно от основного проекта. Если нужен новый Tailwind-класс в `nagornaya/chast-*` — обратись к владельцу для регенерации.

### 3.6 Изображения

| Правило | Подробнее |
|---|---|
| **Формат** | `.webp` основной; `.png/.jpg` — backup, не для `<img>` напрямую |
| **Размеры** | Обязательно 3 ширины: `600w`, `900w`, `1200w` |
| **Именование** | `images/<name>.webp`, `images/<name>-600w.webp`, ... |
| **Качество WebP** | 82–85% |
| **OG** | один `og:image` per page; JPG-fallback только если файл реален |

### 3.7 Создание новой статьи — требования к качеству (ОБЯЗАТЕЛЬНО)

При создании новой статьи (или значительном обновлении существующей) **обязательно** соблюдать следующие правила качества:

#### 3.7.1 Тултипы и глоссарий
- **Все** исторические названия (города, территории, законы, институты, события) должны быть обёрнуты в `<span class="gterm" data-term="..." data-term-title="...">...</span>`.
- **Все** сложные богословские, герменевтические, раввинистические и апологетические термины должны иметь тултип.
- Пояснения должны быть **не поверхностными** — минимум 1–2 предложения, понятных рядовому читателю, без упрощения до примитива.
- Примеры исторических терминов, требующих тултипа: Кеттеринг, Хорслидаун, Саутварк, Акт о корпорациях, Gin Craze, Банхилл-Филдс, Приорат Сиона, Никейский собор, гностики и т.д.

#### 3.7.2 Квизы
- Каждый квиз должен содержать **минимум 1–2 вопроса по терминологии и понятиям** (не только по фактам и сюжету).
- Все вопросы обязаны иметь `explanation.short` + `explanation.full`.
- `explanation.full` должен давать **глубокое богословское/историческое/методологическое объяснение**, а не просто «верно/неверно».
- Вопросы должны быть **адаптированы под тематику статьи**:
  - Биографии → акцент на личность, решения, контекст.
  - Экзегетика/герменевтика → акцент на метод, термины, аргументацию.
  - Апологетика → акцент на факты, критерий затруднения, контраргументы.
  - Антропология/доктрина → акцент на понятия, различения, богословские нюансы.

#### 3.7.3 Общий принцип
- Статья должна быть **самодостаточной** для читателя без богословского образования.
- Если термин или историческая реалия встречается в статье — читатель должен иметь возможность понять его значение **не выходя из статьи** (через тултип).
| **figcaption** | НЕ вставлять `<span class="ai-note">` или «Изображение сгенерировано ИИ». Прозрачность — только на `/about/`. |

#### Шаблон `<picture>`:

```html
<figure class="article-img wide reveal">
  <picture>
    <source srcset="../../images/<name>-600w.webp 600w,
                    ../../images/<name>-900w.webp 900w,
                    ../../images/<name>-1200w.webp 1200w"
            sizes="(max-width: 640px) 92vw, 1200px" type="image/webp">
    <img src="../../images/<name>.webp" alt="…"
         width="1200" height="630" loading="lazy" decoding="async">
  </picture>
  <figcaption>Подпись без упоминания ИИ.</figcaption>
</figure>
```

---

## 4. CSS-правила

### 4.1 Каскад

Порядок подключения CSS в `<head>` (не менять):

1. `fonts/fonts.css` (preload + stylesheet)
2. `css/site.css`
3. `css/home.css` (на главной и каталогах)
4. `css/command-palette.css`
5. На Нагорной — **сначала** `nagornaya/tw.min.css`, **потом** `site.css` (Tailwind обязан грузиться раньше — site.css перебивает его по каскаду).

### 4.2 `!important` — обязательный чеклист перед добавлением

**Текущее состояние (2026-06-04, после PLAN-04):**

| Файл | `!important` | Назначение |
|---|---:|---|
| `site.css` | **270** ⚠️ | цель ≤200; потолок `IMPORTANT_CEIL` в audit-pro (только вниз) |
| `home.css` | 20 | OK |
| `command-palette.css` | 7 | OK |
| `mobile-hotfix.css` | 74 | touch / pointer:coarse overrides — легитимно |
| `nagornaya-mobile-toc.css` | 122 | Tailwind override на nagornaya-page — легитимно |

**Корректный подсчёт:** `grep -o '!important' file | wc -l` (НЕ `grep -c` — он считает строки).

#### 5-шаговый чеклист перед добавлением нового `!important`:

1. **Найди конкурента.** `grep -nE 'твой-селектор' css/*.css`.
2. **Рассчитай specificity** обоих правил (id=100, class=10, element=1).
3. **Если твоё выше** → `!important` не нужен; используй каскад.
4. **Если ниже** → увеличь специфичность через дополнительный класс/id/атрибут (например, `body.your-page .selector` или `.parent .selector`).
5. **`!important` оправдан ТОЛЬКО для:**
   - `@media print`
   - `@media (prefers-reduced-motion: reduce)`
   - `@media (forced-colors: active)`
   - `@media (scripting: none)` — no-JS fallback
   - Tailwind override на nagornaya (если selectivity не помогает)
   - Defensive disable (`display: none !important`) для скрытия legacy/повреждённого элемента
   - Внутри `@layer components/utilities` — для перебивания правил вне layer (правила вне `@layer` имеют выше priority по spec)

**Если уже есть `!important` на том же селекторе/свойстве — исправь существующий, не добавляй второй.**

### 4.3 Тёмная тема

Используется класс `html.dark` на `<html>` (переключается JS в `site.js`).

| Правило | Пример |
|---|---|
| ✅ Используй переменные | `color: var(--color-text)`, `background: var(--color-bg)` |
| ❌ Не хардкодить `#fff`, `#000` | искл.: фолбэки в `color-mix(in srgb, ... var(--color-x, #fff))` |
| ✅ `html.dark` всегда | НЕ просто `.dark` — JS выставляет именно `html.dark` |
| ✅ `color-mix()` fallback | Сначала простое значение, потом `color-mix` ниже — каскад перебивает |

### 4.4 CSS Integrity Rules — анти-регрессия

Эти правила введены после серии регрессий май-июнь 2026 (см. AUDIT_HISTORY).

1. **`html.dark` — всегда, никогда просто `.dark`.** Класс `.dark` на body не используется.

2. **Дублирование top-level селекторов запрещено.** Перед добавлением правила для `.foo` — `grep ".foo"` по файлу. Найдено → расширяй существующее, не добавляй новый блок. PLAN-04 P1+P1b слили 9 настоящих дублей.

3. **Пустые правила `{}` — мусор, удалять.** Допустимо только намеренное `:empty` с пояснительным комментарием.

4. **Двойное свойство в одном блоке — первое мёртво.** Два `box-shadow`, два `color` в одном `{}` — первый всегда перебивается. Удаляй его. **Исключение:** color-mix fallback pattern (`color: #fff; color: color-mix(...);`) — это намеренно.

5. **`:hover` с важным эффектом — только внутри `@media (hover: hover) and (pointer: fine)`.** Без guard — срабатывает на тапе (iOS/Android). Исключение: декоративные opacity/color, не меняющие layout.

6. **Переключатель темы — singleton.** Три канонических места:
   - `.theme-toggle` (absolute, в статьях рядом с breadcrumbs)
   - `.gb-fc-theme` (FAB через `gbFloatingControls` site.js модуль 29)
   - `.bar-icon-btn[data-action=theme]` (bottom-bar, mobile)

   ❌ Не создавать четвёртую: `.theme-float-btn`, `#themeFloat`, `.nag-theme-btn` — всё удалено в PLAN-04 P5.

7. **Tooltip — три канонических вида, один контроллер.**
   - `.gterm > .gtip` (глоссарий)
   - `.fn-marker > .tooltip` (академические сноски)
   - `.bref > .btip` (Библейские ссылки)

   Контроллер: `SiteUtils.makeTooltipController()` (единственная реализация).
   ❌ Не добавлять четвёртый тип tooltip с другими классами/позиционированием.

   **Модификатор `.fn-marker--dove`** — это НЕ четвёртый тип, а вариант `fn-marker`
   (та же `.tooltip`, тот же контроллер), у которого числовой маркер заменён на иконку
   голубя. Глиф рисует JS: функция `e()` в `js/site.js` инжектит inline-SVG
   `<svg class="fn-dove-icon">` (тело `.fn-dove-body` + отдельное крыло `.fn-dove-wing`).
   `::before` в CSS — это no-JS фолбэк (статический голубь), он скрывается, когда JS
   проставил `data-gb-dove-ready`. Крыло машет на hover (`@keyframes fn-dove-flap`,
   только `@media (hover:hover) and (pointer:fine)`, отключается при `prefers-reduced-motion`).
   ❌ Не возвращать инлайновый `<svg class="fn-dove-icon">` в HTML статей — JS инжектит его сам
   (audit-pro это проверяет и упадёт).
   ⚠️ **Все inline-маркеры закрывай явно** (`<span ...></span>`). `.fn-marker--dove` —
   `display:inline-flex`; незакрытый `<span>` «проглатывает» следующие `<p>/<h4>`, делая их
   flex-детьми → горизонтальный overflow. То же с «eyebrow»-лейблами `<span style="display:inline-flex">`.
   После правок контента/CSS прогоняй **visual-audit** (Playwright) — он ловит overflow и контраст:
   `python3 -m http.server 8080 & ; sudo npx playwright install-deps chromium ; AUDIT_BASE=http://127.0.0.1:8080 npm run visual-audit` → должно быть `0 raw bugs`.

8. **CSS-переменные — не объявлять «про запас».** Объявленная в `:root` переменная без `var(--...)` нигде = мёртвый код, удалить.

9. **Мёртвый компонент = удалить.** Если класс нигде в HTML/JS не используется (включая динамическую конкатенацию в JS `'class--' + variant`) — удалить CSS-правила. PLAN-04 P5-P7 удалил `.theme-float-btn`, `.ai-disclosure`, `.fx-lift`, `.epilogue-*`, `.float-fallback`, `.sd-url-strip/divider/copy/label-default`, `.article-img--portrait-wide`, `.card.fx-lift` и др.

10. **`!important` лимит для `site.css` — цель ≤ 200, жёсткий потолок задан в `audit-pro.js`.**
    Теперь это **автоматическая проверка** (`IMPORTANT_CEIL` / `IMPORTANT_GOAL` в `scripts/audit-pro.js`):
    - выше `IMPORTANT_CEIL` → **ERROR** (audit падает, push блокируется);
    - выше `IMPORTANT_GOAL` (200) но в пределах потолка → **WARNING** (продолжай гасить долг).
    Потолок — храповик: **только вниз**. Снизил `!important` — снизь и `IMPORTANT_CEIL`.
    Ручная проверка: `grep -o '!important' css/site.css | wc -l`.
    История: PLAN-04 342 → 199; затем dove/tooltip-серия дала регрессию 194 → 295,
    после чистки (унификация tooltip-компонентов) → 270.

    **ПРИЧИНА большого числа `!important`** (важно понимать): `css/site.css` исторически
    собран из НЕзакрытых `@media`/`@supports`/`@layer` блоков — на 2026-06-08 в файле был
    дисбаланс **+151** открывающей скобки (браузер закрывал их на EOF). Из-за этого многие
    правила оказывались «погребены» на глубине вложенности ~151 и применялись только при
    накопленных media-условиях — поэтому их и заставляли работать через `!important`.
    Блок `fn-marker--dove` был восстановлен **плоским, на глубине 0, в конце файла** (после
    явного закрытия всех скобок) — и там `!important` ему уже НЕ нужен (un-layered правило
    бьёт любой `@layer`). Дальнейшее снижение к 200 — тем же приёмом: чинить вложенность,
    а не добавлять `!important`. **Проверяй баланс скобок:**
    `python3 -c "s=open('css/site.css').read();print(s.count('{')-s.count('}'))"` → должно быть 0.
    **`!important` сам по себе не «зло», но >50 в одном файле — запах: каскадные слои
    (`@layer reset,base,components,utilities`) решают специфичность без него.**

---

## 5. JS-правила

### 5.1 Архитектура

Каждый JS-файл — самодостаточный, под одну тему. **НЕ создавать общий `utils.js`** — это сломает текущую модульность (`site-utils.js` существует, но имеет узкую роль). Подробная карта 27 модулей внутри `site.js` — в `README.md`.

### 5.2 Запреты

- ❌ `eval()`, `Function()`, `innerHTML = userInput`
- ❌ `addEventListener` без `removeEventListener` (память)
- ❌ CDN-зависимости (jQuery, Lodash) — проект bessebt (vanilla)
- ❌ ES2024+ фичи без проверки на Safari 15+
- ❌ Переход на TypeScript / Vite / любой bundler — архитектурный выбор vanilla

### 5.3 Обязательные проверки перед коммитом

```bash
# Синтаксис JS — все 11 файлов + sw.js + scripts
node --check js/*.js
node --check scripts/*.js
node --check sw.js

# Хеши cache-bust свежие
npm run cache-bust

# Полная валидация (HTML, JSON, manifest, SEO)
npm run validate:all

# Дизайн-токены
npm run tokens:check

# Главный аудит (38 проверок)
node scripts/audit-pro.js
# Должно: ✅ PASSED, errors = 0
```

Если хоть одна — FAIL, **не коммитить**.

#### Visual audit (Playwright, опционально но рекомендовано перед крупными CSS-правками)

```bash
# 1. Локальный HTTP-сервер (отдельная вкладка)
python3 -m http.server 8080 --bind 127.0.0.1

# 2. Playwright + chromium (один раз)
npm install --no-save playwright
npx playwright install chromium

# 3. Аудит (32 страницы × 96 скринов в shots/)
AUDIT_BASE=http://127.0.0.1:8080 npm run visual-audit
```

Должно: `0 console errors, 0 network errors, 0 raw bugs` (или все подавлены).

---

## 6. Статьи — как добавлять

### 6.1 Структура

```
articles/<slug>/
└── index.html
```

slug — строчные латинские буквы и дефисы, без слэша в начале.

### 6.2 Обязательные блоки в `<head>`

См. [`README.md` § «Добавление новой статьи»](README.md) — полный шаблон с meta-тегами, JSON-LD, OG/Twitter, SITE_CONFIG, breadcrumb JSON-LD.

### 6.3 Runtime-компоненты

| Компонент | Поведение |
|---|---|
| `<header class="article-header">` | h1, byline (см. §3.1), метаданные (дата, ≈мин чтения) |
| `<aside class="author-card">` | Перед `.sources-block` / `.reading-list` |
| `<aside class="article-toc">` | Для длинных статей (>20мин) |
| Глоссарий `<span class="gterm">термин<span class="gtip">…</span></span>` | luxury tooltip, mobile bottom-sheet |
| Академические сноски `<span class="fn-marker">N<span class="tooltip">…</span></span>` | mobile bottom-sheet |
| Библейские ссылки `<button class="bref" data-ref="Иер 17:9">` | tooltip с переводами |
| `.gb-accuracy-btn--email` | mailto: только `viktorcoy2012@gmail.com`, subject/body формируются JS из h1 + URL |

### 6.4 SITE_CONFIG — обязательная часть HTML

См. README.md § «Контракт `window.SITE_CONFIG`».

### 6.5 Quiz Engine v3+

Вопросы могут содержать `sourceRef` для академического feedback:

```js
{
  id: 'q1',
  type: 'single',
  category: 'theology',
  difficulty: 'medium',
  question: 'Вопрос...',
  options: ['...', '...', '...'],
  correct: 1,
  explanation: {
    short: 'Короткий вывод.',
    full: 'Развёрнутое объяснение ответа.',
    anchor: 'sec-intro'
  },
  sourceRef: { label: 'Иер. 17:9', href: '#sec-intro' }
}
```

`sourceRef` — строка, объект `{ label, href }` или массив. Результаты квиза сохраняются в `localStorage` как `quiz-result-v2:{page.id}`. Legacy-формат `q / answer / ok / err / focus` поддерживается только для старых страниц; новые вопросы писать в новом формате.

### 6.6 Share API (для цитат, результатов квизов)

```js
window.SiteShare.open(button, {
  dialogTitle: 'Поделиться цитатой',
  title: document.title,
  text: '«цитата» — Название статьи',
  url: 'https://gospod-bog.ru/article/#:~:text=...'
});
```

НЕ подменять заголовок диалога через DOM. Все платформы (TG/WA/VK/MAX/OK/Copy) используют `activeShareUrl/Title/Text` из payload.

### 6.7 Язык статей и цитат

Русскоязычная статья должна читаться как цельный русский текст. Это правило закреплено не только документально, но и технически: `scripts/validate.js` и `scripts/audit-pro.js` блокируют английские прямые цитаты в читательском русском тексте и quiz-строках. Полная редакционно-источниковая политика — `docs/EDITORIAL-SOURCE-POLICY.md`.

- ✅ Основной текст, прямые речи, сильные цитаты, цитаты в quiz/explanation, подписи к иллюстрациям и callout-блоки — **на русском**.
- ✅ Английские названия книг, статей, журналов, издательств, URL, DOI, `href`, библиографические записи и технические термины в скобках допустимы, если они нужны для идентификации источника.
- ❌ Не вставлять в тело русской статьи английскую прямую цитату ради «солидности».
- ✅ Если важно показать, что формулировка верифицирована, дать русский перевод и рядом ссылку на оригинал: `МакАртур формулирует: «…» <a href="...">GTY transcript</a>`.
- ✅ Если перевод спорный или авторский, можно добавить: «перевод наш» / «смысловой перевод», но сам цитируемый текст остаётся русским.
- ❌ Не заменять русскую цитату машинным калькированным английским термином. Сначала русский эквивалент, затем при необходимости оригинальный термин в скобках: «различный отбор материала (variant selections)» — допустимо как термин; «variant selections» как самостоятельная цитата — нет.

### 6.8 После добавления статьи

1. Обновить `sitemap.xml` (ISO8601 lastmod с +03:00)
2. Обновить `feed.xml` (`<item>` в начало `<channel>` + `<lastBuildDate>`)
3. Обновить `data/series.json` (если статья входит в серию)
4. Обновить `data/search-manifest.json` (для Ctrl+K)
5. Добавить карточку на `/articles/index.html` и (если уместно) на `/index.html`
6. Подготовить OG-картинку (1200×630, `.webp` или `.jpg`)
7. `npm run cache-bust`
8. `npm run validate:all` + `node scripts/audit-pro.js`

IndexNow при `git push main` сам уведомит Яндекс/Bing.

---

## 7. Красные флаги

| Если ты собираешься… | …почему НЕТ |
|---|---|
| «Создать новый CSS для article-share-buttons.css» | См. §2. Используй `site.css`. |
| «Создать `utils.js` для общих функций» | См. §5.1. У каждого JS своя тема. |
| «Заменить "Редактор" на "Автор" — короче» | См. §3.1. Это намеренно. |
| «Упростить JSON-LD — слишком много свойств» | См. §3.2. Это для SEO. |
| «Удалить старые AUDIT_*.md — лишний мусор» | Оставлять `AUDIT_HISTORY.md`. `audit/AUDIT_CLEANUP_PLAN_*.md` оставлять до завершения плана. |
| «Обновлю pretty каждый файл — для красоты» | НЕТ. Diff нечитаем. |
| «Прогоню `eslint --fix` — улучшит код» | НЕТ. Только точечно. |
| «Поправил CSS — забыл `cache-bust`» | Запусти. SW не подхватит правки. |
| «Заменю vanilla на TypeScript для надёжности» | НЕТ. Архитектурный выбор vanilla. |
| «Верну AI-disclosure для прозрачности» | См. §0 п.3. Об ИИ — только на `/about/`. |
| «Добавлю `!important` на всякий случай» | См. §4.2 чеклист. |
| «Перепишу `summary-card` с `!important` для надёжности» | НЕТ. PLAN-04 P8-P10 сняли 39 ненужных. Конкурентов в каскаде нет (компонент только на 2 не-nagornaya страницах). |

---

## 8. Service Worker — что важно

`sw.js` — версионируется автоматически (`scripts/cache-bust.js` обновляет `CACHE_VERSION`). При правке `sw.js` руками — **не править version-строку**, скрипт это сделает.

Precache список — в самом `sw.js`. При добавлении нового шрифта/JS-файла — добавь в precache.

---

## 9. Безопасность / гигиена

- ❌ Не добавлять `http://` ссылки в контент — `audit-pro` ругается на mixed-content. Используй `https://` или (для умерших источников) `https://web.archive.org/web/2025/http://...`.
- ❌ Не хранить ключи / токены в репозитории. `INDEXNOW_KEY` — только в GitHub Secrets.
- ❌ Не использовать `eval` / `Function` / `innerHTML = userInput`.

---

## 10. Что из корня репо никогда не коммитить

| Файл / маска | Почему нельзя |
|---|---|
| `*.patch` | git-артефакты, не контент |
| `*.py` в корне | Статический сайт. Python — только в `scripts/` (build-tools) |
| `*.tsx`, `*.ts`, `src/components/` | Vanilla проект, TypeScript-компоненты — мёртвый код |
| `README-<что-то>.txt`, `README.txt` | Дубли `README.md` |
| `PATCH-V*-SUMMARY.md`, `AUDIT_REPORT_*.md`, `*_PLAN_*.md` (в корне) | Истёкшие планы; история — в git log и `AUDIT_HISTORY.md`. План в `audit/` — оставлять до завершения. |
| `apply_*.py`, `fix_*.py`, `final_*.py`, `split_*.py` | Одноразовые костыли. Нужен скрипт — в `scripts/` + `package.json` |
| `shots/`, `visual-audit-report.json`, `deep-check.json`, `node_modules/`, `.playwright-browsers/` | Уже в `.gitignore` |
| `<INDEXNOW_KEY>.txt` | Генерируется `deploy.yml` только в Pages-артефакте |

Если AI-агент создал такой файл во время работы — обязан удалить перед коммитом.

---

## 11. История документа (свёрнуто)

Полная история r1..r62 — в `git log` (`git log --oneline --grep="AGENTS-r"`).

Сохранены здесь только последние 5 значимых вех:

| Версия | Дата | Главное |
|---|---|---|
| **AGENTS-r68** | 2026-06-06 | **Editorial source policy.** Добавлен `docs/EDITORIAL-SOURCE-POLICY.md`; README/AGENTS связаны с единым документом политики. |
| **AGENTS-r67** | 2026-06-06 | **Russian quote policy guard.** `validate.js` и `audit-pro.js` теперь проверяют русские статьи и quiz-строки на английские прямые цитаты. |
| **AGENTS-r66** | 2026-06-06 | **Russian quote policy.** В русских статьях прямые цитаты/сильные фразы должны быть переведены на русский; английский допустим в названиях источников, URL, DOI и терминах-идентификаторах. |
| **AGENTS-r63** | 2026-06-04 | **Полная перезапись (PLAN-05).** Свёрнута история 60+ записей (полная — в git log). Убраны противоречия: AGENTS до этого учил создавать `.theme-float-btn`, `.ai-disclosure` (давно удалены) и держал устаревший счётчик `!important` ~189. Зафиксированы актуальные числа после PLAN-04 (199). Добавлен §9 «Безопасность/гигиена», §8 «Service Worker». §4.4 расширен пунктами 9 (мёртвый код = удалить) и 10 (лимит ≤200). Объединена сломанная нумерация (было два §11). |
| AGENTS-r62 | 2026-06-04 | **PLAN-04 — !important cleanup, site.css 342 → 199.** 15 партий точечной чистки + 1 hotfix HTML-бага + notify-on-failure.yml workflow. См. `audit/AUDIT_CLEANUP_PLAN_2026-06-04.md`. |
| AGENTS-r61.17 | 2026-06-03 | Mobile long-block premium compaction (summary-card / note-box / info-box collapse-to-preview ≥740-950px на мобильных). |
| AGENTS-r17 | 2026-06-02 | **Unified Floating Controls (модуль 29).** Единый `.gb-fc-theme + .gb-fc-search` блок заменяет legacy `.theme-float-btn / #themeFloat / #gbSearchFloat / .nag-sidebar-theme-btn`. Эти legacy окончательно удалены из CSS в PLAN-04 P5. |
| AGENTS-r11 | 2026-06-02 | **AI-disclosure JS-модуль удалён.** Класс `.ai-disclosure` остался в CSS как мёртвый код; удалён из CSS в PLAN-04 P7. |

---

> **Если правило кажется глупым — спроси, ПОЧЕМУ оно появилось.**
> Большинство «странных» правил появилось после реальных регрессий.
> Прежде чем менять контракт — открой `AUDIT_HISTORY.md`.


---

## 9. Железобетонные UI-правила (НИКОГДА не нарушать)

### 9.1 Имена Бога на главной странице
- `js/enhancements.js` содержит блок ambient-фраз (42 фразы: иврит/греческий/латинский (35 боковых + 7 центральных))
- **Страж запуска**: `if (!document.getElementById('hScriptureBg')) return;`  
- НЕ менять на проверку `.h-phrase--ambient` — элемента в статическом HTML нет
- При любых правках `js/enhancements.js` — проверить что `document.querySelectorAll('.h-phrase').length >= 35`

### 9.2 FC-controls (плавающие кнопки тема/поиск)
- Компактный пилл-контейнер с `backdrop-filter`, `border-radius:24px`, `padding:3px`
- Кнопки `36x36px`, NO `border-radius:50%`, NO `background-color` на hover
- Hover: ТОЛЬКО `transform:translateY(-2px)` — никаких кругов, никакого фона
- Высота контейнера ≤ 110px (две кнопки + padding)
- Класс `.gb-floating-controls` в `css/site.css`

### 9.3 bio-cover в статьях о Гилле
- `articles/dzhon-gill-chast-1-chelovek/index.html` ДОЛЖЕН содержать `.bio-cover` с изображением `gill-portret-full-study`
- Это 16:9 "Гилл за письменным столом" — НЕ city-view, НЕ portrait 3:4
- `aspect-ratio` в `.bio-cover` = `16/9` (не 21/9)

### 9.4 Карточки-thumbnails серии Гилла на главной
- Часть 1 (`dzhon-gill-chast-1`): thumbnail = `gill-portret-full-study` (широкоформатный)
- НЕ использовать `og-dzhon-gill-chast-1-chelovek` (показывает город, а не Гилла)

### 9.5 Запрет дублирования контента
- В `chast-1` — НЕ должно быть двух одинаковых портретов Гилла
- `biography-portrait` (малый 3:4) в шапке — оставить
- `float-left article-img` с тем же портретом — УДАЛИТЬ (дублируется bio-cover)

### 9.6 Playwright-регрессионные проверки
`scripts/visual-audit.js` содержит автоматические проверки:
- `ambientPhrases === 0` на `/` → CRITICAL bug
- `fcControlsH > 110` → HIGH bug  
- `.bio-cover` отсутствует на gill chast-1 → HIGH bug

Запуск перед каждым коммитом: `npm run validate:all && node scripts/audit-pro.js`

### 9.7 Theme-toggle / search-icon — ЧИСТЫЙ SVG БЕЗ РАМОК
**Никогда не добавлять** `background`, `border`, `border-radius`, `box-shadow`, `backdrop-filter` к иконкам переключения темы и поиска. Это:
- `.theme-toggle` (absolute, в статьях)
- `.gb-fc-theme`, `.gb-fc-search` (FAB, `js/site.js` модуль 29)
- `.h-cp-btn`, `.gb-nav-search-icon` (в шапке home)
- `.bar-icon-btn` (bottom-bar, mobile)

Должно быть: **только сам SVG** (stroke=currentColor), `background:transparent`, `border:none`, никаких pill/circle обводок. Hover-эффект только `transform:translateY(-2px) scale(1.08)` + изменение `color`, без opacity-флипа (иначе оба `.icon-sun` и `.icon-moon` могут показаться одновременно — баг от 2026-06-08).

**Исключение:** серия «Нагорная проповедь» (`body.nagornaya-page`) — там своя система с Tailwind-классами, не трогать.

### 9.8 article-topnav — УДАЛЁН
Sticky шапка `.article-topnav` (показывалась при скролле статьи с «← Господь Бог — Сила Моя | TITLE | поиск») **удалена из всех 8 статей** по запросу владельца 2026-06-08. **Не возвращать.** Хлебных крошек (`.breadcrumb`) достаточно для навигации.

CSS-правила `.article-topnav*` пока остаются в site.css как dead code (для возможного восстановления). При полной чистке можно удалить через PLAN; до этого не реанимировать в HTML.

### 9.9 Hover на ссылках-карточках в тёмной теме — НЕ розовый
`.h-article-card:hover .h-article-title` в светлой теме = `--h-accent` (#8b2626 темно-красный — ок). В **тёмной** теме `--h-accent` = #d97a6c — это **розово-красный**, плохо контрастирующий с золотисто-палевым телом. Поэтому в `html.dark` hover-цвет переопределён на **золотистый `#e8c97a`** (`css/home.css`). Не возвращать на `var(--h-accent)`.

### 9.10 FOUC шрифтов на главной
Кроме `Lora-cyrillic-400`, **обязательно preload** для:
- `Inter-cyrillic-600` (используется в `.h-sacred-ref` — «АВВАКУМ 3:19»)
- `PlayfairDisplay-cyrillic-700` (используется в `.h-section-title`, hero и др.)

Иначе виден FOUC: сначала рендерится fallback Times New Roman, потом подмена. Это видно на главной при перезагрузке.



### 9.13 Изображения владельца — НЕ ЗАМЕНЯТЬ генерациями

**НИКОГДА** не заменять изображения, которые загрузил владелец, на AI-генерации.
Если изображение визуально не устраивает — спроси владельца, а не генерируй замену.

Конкретно:
- `whitefield-preaching.*` — картинка Уайтфилда на Кеннингтон-Коммон. Загружена владельцем.
  Это ВТОРАЯ картинка Уайтфилда в gill-kontekst. НЕ удалять, НЕ заменять.
- `whitefield-field.*` — картинка Уайтфилда в поле. ПЕРВАЯ в gill-kontekst. НЕ удалять.
- Между двумя Уайтфилдами должен быть текст (не ставить подряд).

### 9.12 Голуби (fn-marker--dove) vs Цифры (fn-marker) — РАЗДЕЛЕНИЕ ТИПОВ СНОСОК

Два типа сносок — **железобетонное правило**, не смешивать:

| Тип | Класс | Иконка | Когда использовать |
|---|---|---|---|
| **Цифровая сноска** | `fn-marker` (без `--dove`) | Число (1, 2, 3…) | Ссылки на источники, библиографические сноски, переводческие ссылки на оригинал |
| **Голубь-сноска** | `fn-marker fn-marker--dove` | 🕊️ SVG-голубь | Пояснения редактора, справочная информация, терминологические справки, контекстные примечания |

**По статьям:**
- **Переводы** (герменевтика Чау и др.) → **ТОЛЬКО ЦИФРЫ**. В оригинале были цифровые сноски.
- **Авторские статьи** (20 антисоветов и др.) → **ГОЛУБИ** для авторских/редакторских комментариев.
- **Биографии Гилла** → цифры для ссылок на источники, голуби для пояснительных вставок (†, ‡ и т.д.).
- **Код да Винчи, Иеремия, Римлянам** → цифры (ссылки на источники).

**Запрещено:** ставить голубей на ВСЕ сноски подряд. Голубь — это визуальный маркер «здесь пояснение», а не «здесь источник».

CSS поддерживает оба типа:
- `.fn-marker` — цифра в суперскрипте, hover показывает tooltip
- `.fn-marker.fn-marker--dove` — SVG-голубь с машущим крылом, hover показывает tooltip

JS `site.js` функция `e()` инжектит SVG тело голубя только в `.fn-marker--dove`.

### 9.11 Series Navigator — единый компонент (с 2026-06-08)
Серии (Нагорная, Гилл, Пастор-серия) **обязаны** использовать единый компонент, не плодя inline-styled карточки на каждой статье:

- **`<aside data-series-strip="<key>"></aside>`** — компактный strip (prev | dots | next) сверху статьи. Авто-выделяет текущую часть по URL slug.
- **`<aside data-series-nav="<key>"></aside>`** — расширенный сайдбар-навигатор (опционально, для очень длинных серий).
- **`<div data-series-cards="<key>"></div>`** — большие карточки для индекс-страниц (`/articles/`, `/biografii/` и т.д.) — без изменений (legacy).

Все 3 компонента читают из `data/series.json`:
```json
{
  "<series-key>": {
    "title": "Название серии",
    "baseUrl": "/articles/",      // или "/nagornaya/" и т.д.
    "parts": [
      {"n": 1, "slug": "url-slug-of-part", "title": "Часть I. Заголовок", "status": "published", "readingTime": 25}
    ]
  }
}
```

Подключение JS: `<script defer src="../../js/series-cards.js?v=..."></script>` (один файл на все 3 режима).

**Запрещено:**
- Дублировать inline-карточки «Часть I / II / III» вручную в HTML (как было в трилогии о Гилле до r75 — 4 КБ inline-styled CSS на каждой странице ⇒ при добавлении новой части серии нужно править 5 страниц синхронно ⇒ регрессии).
- Создавать новые JS-файлы для каждой серии. Один `series-cards.js` обслуживает все.

**Нагорная проповедь** — историческое исключение (свой Tailwind-sidebar + nagornaya-mobile-toc.js). Не трогать; новых серий по такому образцу не плодить — использовать `data-series-strip` / `data-series-nav`.
