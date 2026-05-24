# AGENTS.md — gb-is-my-strength (gospod-bog.ru)

> **Если ты ИИ-агент (Cursor, Arena Agent, Copilot Workspace, Kilo, любой) — этот файл обязателен к прочтению ДО любого изменения кода.**
>
> Проект — христианский богословский сайт. Ошибки в богословии и в атрибуции авторства недопустимы.

**Владелец:** Фёдор Милованов (редактор, не «автор»)
**Производственный сайт:** https://gospod-bog.ru
**Дата документа:** 2026-05-23 | **Версия:** AGENTS-r6

---

## 0. TLDR — что СРАЗУ нельзя делать

1. ❌ Создавать новые CSS/JS файлы (есть **4 CSS** + **9 JS** — этого достаточно).
2. ❌ Менять byline на «Автор: Фёдор Милованов». Только «Редактор» / «Редакция перевода».
3. ❌ Изменять структуру `articles/<slug>/index.html` или `nagornaya/chast-N/index.html`.
4. ❌ Запускать `prettier --write .` или `eslint --fix` по всему проекту.
5. ❌ Обновлять зависимости в `package.json` без явного запроса.
6. ❌ Удалять или переименовывать `?v=fc6cff8a` хеши (они генерятся `cache-bust.js`).
7. ❌ Удалять заголовки `<header class="article-header">` или `<aside class="author-card">`.
8. ✅ После любой правки CSS/JS — запустить `npm run cache-bust` для обновления хешей.
9. ✅ Перед коммитом — запустить `npm run validate:all`.

---

## 1. О проекте

- **Что это:** христианский сайт со статьями и серией «Нагорная проповедь» (5 частей + источники + находки).
- **Стек:** статический HTML + CSS + JS, без сборщика; есть build-скрипты для cache-bust, validation, SEO-аудита.
- **Хостинг:** GitHub Pages, автодеплой через `.github/workflows/deploy.yml`.
- **Node:** требуется `>=20`.

### 1.1 Целевые браузеры

| Платформа | Браузер | Минимальная версия |
|---|---|---|
| Desktop | Chrome / Edge | 90+ |
| Desktop | Firefox | 90+ |
| Desktop | Safari | 15+ |
| Mobile | iOS Safari | 15+ |
| Mobile | Android Chrome | 90+ |
| Mobile | Samsung Internet | 16+ |

> CSS-фичи, не поддерживаемые в этих версиях (`color-mix()`, `grid-template-rows: 0fr`),
> **обязаны** иметь `@supports`-fallback или каскадный fallback.

### 1.2 Метрики качества

| Метрика | Цель |
|---|---|
| Lighthouse Performance (mobile) | ≥ 90 |
| Lighthouse Accessibility | ≥ 95 |
| Core Web Vitals LCP | < 2.5s |
| Core Web Vitals CLS | < 0.1 |
| CSS `!important` count | снижать, не добавлять новые |

---

## 2. АРХИТЕКТУРА — единственно верная

```
/
├── index.html                      ← главная
├── 404.html                        ← страница ошибки
├── sw.js                           ← Service Worker
├── manifest.json                   ← PWA
├── feed.xml                        ← RSS-лента
├── robots.txt, sitemap.xml         ← SEO
├── llms.txt                        ← правила для LLM
├── AGENTS.md                       ← ⭐ ЭТОТ файл (для AI-агентов)
├── README.md                       ← документация
├── CNAME                           ← gospod-bog.ru
│
├── package.json                    ← build-скрипты, без рантайм-зависимостей
├── .github/workflows/              ← deploy.yml + indexnow.yml
│
├── css/                            ← РОВНО 4 ФАЙЛА. БОЛЬШЕ НЕ СОЗДАВАТЬ.
│   ├── site.css                    ← основной слой (статьи, шапка, тёмная тема)
│   ├── home.css                    ← только главная страница (hero, dashboard)
│   ├── command-palette.css         ← поиск (Ctrl+K)
│   └── nagornaya-mobile-toc.css    ← мобильное оглавление в Нагорной проповеди
│
├── fonts/
│   └── fonts.css                   ← @font-face деклараты, не трогать
│
├── js/                             ← РОВНО 9 ФАЙЛОВ. БОЛЬШЕ НЕ СОЗДАВАТЬ.
│   ├── site.js                     ← главное (theme, nav, mobile menu)
│   ├── search.js                   ← Ctrl+K поиск (CommandPalette)
│   ├── enhancements.js             ← scroll-эффекты, lazy load
│   ├── highlights.js               ← подсветка текста, заметки
│   ├── glossary.js                 ← глоссарий богословских терминов
│   ├── bookmark-engine.js          ← закладки (localStorage)
│   ├── series-cards.js             ← карточки серий на главной
│   ├── nagornaya-mobile-toc.js     ← мобильное TOC для проповеди
│   └── sw-register.js              ← регистрация Service Worker
│
├── data/                           ← JSON-данные для рантайма
│   ├── glossary.json               ← термины глоссария
│   ├── search-manifest.json        ← индекс поиска
│   └── series.json                 ← карточки серий
│
├── articles/                       ← статьи (каждая = папка с index.html)
│   ├── 20-antisovetov-pastoru/
│   ├── kod-da-vinchi/
│   └── ...
│
├── nagornaya/                      ← серия «Нагорная проповедь»
│   ├── chast-1/ ... chast-5/       ← 5 частей
│   ├── istochniki/                 ← библиография
│   ├── nakhodki/                   ← дополнительные находки
│   ├── seriya/                     ← обзор серии
│   ├── tw.min.css                  ← Tailwind для проповеди (см. §3.5 о регенерации)
│   └── index.html                  ← обзор всей серии
│
├── about/, pastor-series/          ← статичные разделы
│
├── scripts/                        ← build-инструменты (Node.js)
│   ├── cache-bust.js               ← ⭐ генерит ?v=... хеши, запускать после правок
│   ├── validate.js                 ← валидация HTML/JSON/манифестов
│   ├── seo-audit.js                ← SEO-проверки
│   ├── update-meta.js              ← обновление meta-тегов
│   ├── download-fonts.js           ← скачка шрифтов
│   ├── build-avif.sh               ← конвертация в AVIF
│   └── _audit-deep.js              ← глубокий audit (внутренний)
│
├── audit/                          ← последние audit-pro отчёты (2-3 файла)
├── AUDIT_HISTORY.md                ← консолидированная история аудитов
└── DEEPENED_AUDIT_2026-05-22.md    ← глубокий технический аудит
```

### ⛔ ЗАПРЕЩЕНО создавать новые CSS-файлы

У сайта **ровно 4 CSS + 1 шрифтовой** — этого достаточно для всего.

> **Почему:** Статический хостинг без bundler'а — каждый файл = отдельный HTTP-запрос.
> 4 файла = оптимальный баланс модульности и сетевой производительности.
> На странице статьи подключаются только 2 CSS (fonts + site). Любая новая правка идёт в существующий файл по таблице:

| Что правишь | В какой CSS |
|---|---|
| Шапка / навигация / общие компоненты / статьи | `site.css` |
| Главная страница (только то, чего нет на других страницах) | `home.css` |
| Поиск (Ctrl+K, всплывашка) | `command-palette.css` |
| Мобильное оглавление Нагорной проповеди | `nagornaya-mobile-toc.css` |
| @font-face декларации | `fonts/fonts.css` |
| Tailwind для проповеди | `nagornaya/tw.min.css` (НЕ ТРОГАТЬ, генерируется отдельно) |

### ⛔ ЗАПРЕЩЕНО создавать новые JS-файлы в `js/`

Все 9 JS-файлов — фиксированный набор. Новая логика идёт **внутрь существующего** файла по теме (если новое — в `enhancements.js`).

---

## 3. PROTECTED — НЕ ТРОГАТЬ БЕЗ ПИСЬМЕННОГО РАЗРЕШЕНИЯ

### 3.1 Атрибуция авторства (КРИТИЧНО)

Фёдор Милованов на сайте — **редактор**, не «автор» в традиционном смысле. Он задаёт направление, редактирует, исправляет неточности и собирает материал при помощи ИИ.

#### Правило: нигде не писать «Автор: Фёдор Милованов».

| Тип контента | Byline в `<header>` | author-card-label | Мелкий футер серий |
|---|---|---|---|
| Авторская статья (Тип A/B) | `Редактор: Фёдор Милованов` | `Редактор` | `Ред.: Фёдор Милованов` |
| Перевод (Тип C) | `Редакция перевода: Фёдор Милованов` | `Редакция перевода` | — |

#### Обязательные HTML-паттерны

**Byline в `<header class="article-header">`** (Тип A/B):
```html
<p class="article-byline"><span class="article-byline__strong">Редактор: Фёдор Милованов</span></p>
```

**Byline (Тип C — перевод):**
```html
<p class="article-byline"><span class="article-byline__strong">Редакция перевода: Фёдор Милованов</span></p>
```

**Author card** в `<article>` перед `.sources-block` / `.reading-list`:
```html
<aside class="author-card">
  <div aria-hidden="true" class="author-card-icon">ФМ</div>
  <div class="author-card-body">
    <div class="author-card-label">Редактор</div>
    <div class="author-card-name">Фёдор Милованов</div>
    <p class="author-card-desc">
      Основатель и редактор проекта «Господь Бог — Сила Моя», Санкт-Петербург.
      <a href="../../about/">Об авторе →</a>
    </p>
  </div>
</aside>
```

### 3.2 JSON-LD структура

В каждой статье есть `<script type="application/ld+json">` с `Article`, `BreadcrumbList`, `Person` (автор оригинала или Фёдор как редактор). **Не упрощать, не «оптимизировать», не удалять**. Это критично для SEO.

### 3.3 OpenGraph + Twitter Card теги

В каждой `index.html` статьи есть полный набор `<meta property="og:*">`. Не удалять и не сокращать «для чистоты».

### 3.4 Service Worker и cache-bust

Версии файлов выглядят так:
```html
<link rel="stylesheet" href="css/site.css?v=2223865f">
<script src="js/site.js?v=54e3f377"></script>
```

Хеши `2223865f`, `54e3f377` — это **CRC32-хеши содержимого файлов**, генерируются скриптом `scripts/cache-bust.js`. Не трогать руками. После правки CSS/JS — запустить `npm run cache-bust`.

`CACHE_NAME` в `sw.js` также пересчитывается автоматически.

### 3.5 Структура Нагорной проповеди

Серия «Нагорная проповедь» состоит из 5 частей + 3 вспомогательных страниц (`istochniki`, `nakhodki`, `seriya`). Внутри каждой части — `<aside class="article-toc">` с оглавлением. **Не упрощать TOC, не сжимать вёрстку, не удалять `tw.min.css` подключение в Нагорной**.

**`tw.min.css`** — минифицированный Tailwind CSS, генерируется отдельно от основного проекта.
Если нужно добавить новый Tailwind-класс в HTML `nagornaya/chast-*`:
1. Класс уже может быть в `tw.min.css` (Tailwind включает стандартные утилиты).
2. Если нет — обратиться к владельцу для регенерации `tw.min.css`.

### 3.6 Богословский контент

Любые правки текста статей по сути богословия / толкований / переводов библейских терминов — **только с прямого согласия владельца**. Не «исправлять» цитаты, не «модернизировать» переводы Писания.

---

## 4. CSS-ПРАВИЛА

### 4.1 Каскад

Порядок подключения CSS в `<head>` (не менять):

1. `fonts/fonts.css` (preload + stylesheet)
2. `css/site.css`
3. `css/home.css` (только на главной)
4. `css/command-palette.css`
5. Дополнительные (только на специфических страницах)

### 4.2 `!important`

Сейчас:
- `site.css`: 110 (много, но контролируемо)
- `home.css`: 12
- `command-palette.css`: 3
- `nagornaya-mobile-toc.css`: 3

Не добавлять новые `!important`, пока возможно через специфичность. Если уже есть `!important` на том же селекторе — **исправь существующий**, не добавляй второй.

### 4.3 Тёмная тема

Используется класс `html.dark` на `<html>` (переключается JS-ом в site.js). Все цвета — через CSS-переменные. **Не хардкодить** `#fff`, `#000` — использовать `var(--text)`, `var(--bg)`, `var(--accent)` и т.д.

---

## 5. JS-ПРАВИЛА

### 5.1 Архитектура

Каждый JS-файл — самодостаточный, под одну тему. **НЕ создавать общий `utils.js`** — это сломает текущую модульность.

### 5.2 Запреты

- ❌ Не использовать `eval()`, `Function()`, `innerHTML = userInput`
- ❌ Не добавлять `addEventListener` без `removeEventListener` (память)
- ❌ Не создавать dependencies на CDN (jQuery, Lodash и т.п.) — проект бессет
- ❌ Не использовать ES2024+ фичи без проверки на старых Safari

### 5.3 Перед коммитом — обязательно:

```bash
node --check js/site.js
node --check js/search.js
node --check js/enhancements.js
node --check js/highlights.js
node --check js/glossary.js
node --check js/bookmark-engine.js
node --check js/series-cards.js
node --check js/nagornaya-mobile-toc.js
node --check js/sw-register.js
node --check sw.js
```

Если хоть один FAIL — **не коммитить**.

---

## 6. СТАТЬИ — как добавлять

Структура каждой статьи:

```
articles/<slug>/
└── index.html
```

Каждая статья имеет:
1. `<head>` с meta description, OG, Twitter Card, canonical link, JSON-LD
2. `<header class="article-header">` с h1, byline, метаданными (дата, читать N мин)
3. `<aside class="author-card">` перед `.sources-block` / `.reading-list`
4. `<aside class="article-toc">` (для длинных статей)
5. Финальный footer с навигацией

**Шаблон** для новой статьи — взять последнюю созданную и копировать структуру.

После добавления статьи:
1. Обновить `sitemap.xml` (добавить URL)
2. Обновить `data/series.json` (если статья входит в серию)
3. Обновить `data/search-manifest.json` (для Ctrl+K поиска)
4. Запустить `npm run cache-bust`

---

## 7. ОБЯЗАТЕЛЬНЫЕ ПРОВЕРКИ

```bash
# 1. Синтаксис JS — все 9 файлов + sw.js + scripts
node --check js/*.js
node --check scripts/*.js
node --check sw.js

# 2. Хеши cache-bust свежие
npm run cache-bust

# 3. Полная валидация (HTML, JSON, манифесты)
npm run validate          # HTML, JSON, манифесты

# 4. SEO-проверки
npm run seo-audit

# 5. Всё вместе (validate + seo-audit + cache-bust)
npm run validate:all      # ← рекомендуется перед каждым коммитом
```

Если хоть одна проверка FAIL — **не коммитить**.

---

## 8. КРАСНЫЕ ФЛАГИ

| Если собираешься сделать | Почему стоп |
|---|---|
| «Создать новый CSS для article-share-buttons.css» | См. §2. Используй `site.css`. |
| «Создать utils.js для общих функций» | См. §5.1. У каждого JS своя тема. |
| «Заменить "Редактор" на "Автор" — короче» | См. §3.1. Это намеренно. |
| «Упростить JSON-LD — слишком много свойств» | См. §3.2. Это для SEO. |
| «Удалить старые AUDIT_*.md — лишний мусор» | Оставить `AUDIT_HISTORY.md` + `DEEPENED_AUDIT_*.md` в корне. |
| «Обновлю pretty каждый файл — для красоты» | НЕТ. Diff будет нечитаем. |
| «Прогоню eslint --fix — улучшит код» | НЕТ. Только точечно. |
| «Поправил CSS, не запустил cache-bust» | См. §4 / §7. Запусти. |
| «Заменю jQuery-стиль селекторы на современный API» | НЕТ. Проект без jQuery, не вмешивайся. |
| «Добавлю TypeScript для надёжности» | НЕТ. Проект на vanilla JS, это архитектурный выбор. |

---

## 9. История этого документа

| Версия | Дата | Что |
|---|---|---|
| AGENTS-r1 | 2026-05-?? | Создан, только правила byline |
| AGENTS-r2 | 2026-05-17 | Расширен: вся архитектура, 9 JS, 4 CSS, защищённые блоки, чек-лист |
| AGENTS-r3 | 2026-05-22 | Удалены ссылки на docs/archive и patch-скрипты, обновлена архитектура |
| AGENTS-r4 | 2026-05-23 | Матрица браузеров §1.1, metrics §1.2, tw.min.css §3.5, html.dark §4.3, хеши §3.4 |
| AGENTS-r5 | 2026-05-24 | Добавлены v27-v30: полное сжатие и исправление кнопок шрифтов A−/A+, удаление дублей CSS, финальная победа над легаси-токенами (0 / 0) |
| AGENTS-r6 | 2026-05-24 | v31: Исправлено агрессивное наследование шрифта в Нагорной серии, исправлен обход валидатора EXTRA_PAGES и предупреждение javascript:void(0) |

---

> Этот файл — **«договор»** между владельцем и любым ИИ.
>
> Нарушение = регресс, который видят сотни читателей сайта. Если правило кажется глупым — спроси, **почему** оно появилось.
