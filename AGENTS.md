# AGENTS.md — gb-is-my-strength (gospod-bog.ru)

> **Если ты ИИ-агент (Cursor, Arena Agent, Copilot Workspace, Kilo, любой) — этот файл обязателен к прочтению ДО любого изменения кода.**
>
> Проект — христианский богословский сайт. Ошибки в богословии и в атрибуции авторства недопустимы.

**Владелец:** Фёдор Милованов (редактор, не «автор»)
**Производственный сайт:** https://gospod-bog.ru
**Дата документа:** 2026-06-03 | **Версия:** AGENTS-r46b

---

## 0. TLDR — что СРАЗУ нельзя делать

1. ❌ Создавать новые CSS/JS файлы (есть **5 CSS** + **11 JS** — этого достаточно).
2. ❌ Менять byline на «Автор: Фёдор Милованов». Только «Редактор» / «Редакция перевода».
3. ❌ Изменять структуру `articles/<slug>/index.html` или `nagornaya/chast-N/index.html`.
4. ❌ Запускать `prettier --write .` или `eslint --fix` по всему проекту.
5. ❌ Обновлять зависимости в `package.json` без явного запроса.
6. ❌ Удалять или переименовывать `?v=...` хеши (у каждого файла свой, генерятся `scripts/cache-bust.js`).
7. ❌ Удалять заголовки `<header class="article-header">` или `<aside class="author-card">`.
8. ❌ Создавать в корне репо `.patch`, `*.py`, `*.tsx` файлы — статический сайт без сборщика (см. §10).
9. ❌ Возвращать AI-disclosure: ни JS-модуль (удалён 2026-06-02), ни ручные `<aside class="ai-disclosure">`, ни «при помощи ИИ» в figcaption. Об ИИ — только на странице `/about/`.
10. ❌ Дублировать `<meta og:*>` теги в `<head>`. Один `og:image` per page. JPG-fallback — только если `.jpg` файл реально существует.
11. ✅ После любой правки CSS/JS — запустить `npm run cache-bust` для обновления хешей.
12. ✅ Перед коммитом — запустить `npm run validate:all`.

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
| CSS `!important` count | снижать, не добавлять новые (см. §4.2 актуальные цифры) |

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
├── css/                            ← РОВНО 5 ФАЙЛОВ. БОЛЬШЕ НЕ СОЗДАВАТЬ.
│   ├── site.css                    ← основной слой (статьи, шапка, тёмная тема)
│   ├── home.css                    ← только главная страница (hero, dashboard)
│   ├── command-palette.css         ← поиск (Ctrl+K)
│   ├── mobile-hotfix.css           ← мобильные производительные hotfix-правки
│   └── nagornaya-mobile-toc.css    ← мобильное оглавление в Нагорной проповеди
│
├── fonts/
│   └── fonts.css                   ← @font-face деклараты, не трогать
│
├── js/                             ← РОВНО 11 ФАЙЛОВ. БОЛЬШЕ НЕ СОЗДАВАТЬ.
│   ├── site.js                     ← главное (theme, nav, mobile menu, quiz, tooltips)
│   ├── site-utils.js               ← утилиты, используемые отдельными страницами
│   ├── scroll-perf.js              ← производительность scroll/observers
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

У сайта **ровно 5 CSS + 1 шрифтовой** — этого достаточно для всего.

> **Почему:** Статический хостинг без bundler'а — каждый файл = отдельный HTTP-запрос.
> 4 файла = оптимальный баланс модульности и сетевой производительности.
> На странице статьи подключаются только 2 CSS (fonts + site). Любая новая правка идёт в существующий файл по таблице:

| Что правишь | В какой CSS |
|---|---|
| Шапка / навигация / общие компоненты / статьи | `site.css` |
| Главная страница (только то, чего нет на других страницах) | `home.css` |
| Поиск (Ctrl+K, всплывашка) | `command-palette.css` |
| Мобильные производительные hotfix-правки (без bundler) | `mobile-hotfix.css` |
| Мобильное оглавление Нагорной проповеди | `nagornaya-mobile-toc.css` |
| @font-face декларации | `fonts/fonts.css` |
| Tailwind для проповеди | `nagornaya/tw.min.css` (НЕ ТРОГАТЬ, генерируется отдельно) |

### ⛔ ЗАПРЕЩЕНО создавать новые JS-файлы в `js/`

Все 11 JS-файлов — фиксированный набор. Новая логика идёт **внутрь существующего** файла по теме (если новое — в `enhancements.js`).

---

## 3. PROTECTED — НЕ ТРОГАТЬ БЕЗ ПИСЬМЕННОГО РАЗРЕШЕНИЯ

### 3.1 Атрибуция авторства (КРИТИЧНО)

Фёдор Милованов на сайте — **редактор**, не «автор» в традиционном смысле. Он задаёт направление, редактирует, исправляет неточности и собирает материал при помощи ИИ.

#### Правило: нигде не писать «Автор: Фёдор Милованов».

| Тип контента | Byline в `<header>` | author-card-label | Мелкий футер серий |
|---|---|---|---|
| Авторская статья (Тип A/B) | `Автор-редактор: Фёдор Милованов` | `Автор-редактор` | `Авт.-ред.: Фёдор Милованов` |
| Перевод (Тип C) | `Редакция перевода: Фёдор Милованов` | `Редакция перевода` | — |

#### Обязательные HTML-паттерны

**Byline в `<header class="article-header">`** (Тип A/B):
```html
<p class="article-byline"><span class="article-byline__strong">Автор-редактор: Фёдор Милованов</span></p>
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
    <div class="author-card-label">Автор-редактор</div>
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

### 3.6 Известный технический долг

Закрыт 2026-06-02 (commit I). История:

- **~12 КБ inline `<style>` блоков** в `articles/dzhon-gill-chast-1-chelovek/index.html`, `…chast-2-uchenyi`, `…chast-3-nasledie`. Класс шаблона `.biography-*` / `.timeline-*` / `.stat-*` / `.foliant-mark`. Вынесены в `css/site.css` под комментарием `/* BIOGRAPHY TEMPLATE — shared by John Gill biography trilogy */`. Канонической версией принята P2/P3 (P1 имел незначительные pixel-tuning расхождения, которые унифицированы). Правило `.biography-portrait figcaption` из P1 не перенесено, т.к. в HTML нет `<figcaption>` внутри `.biography-portrait` (мёртвый CSS).

**Актуальный техдолг (зафиксирован AGENTS-r42, для r43+):**

| Приоритет | Файл | Тип | Размер | Описание |
|-----------|------|-----|--------|----------|
| ~~🔴 P0~~ | `articles/hermenevticheskaya-otsenka-*` | inline JS 76KB | **Переоценено**: `<script type="application/json" id="bibleRefs">` — это правильный JSON data island (браузер не выполняет, используется `getElementById`). Оставить. |
| 🟠 P1 | `articles/20-antisovetov-pastoru/index.html` | inline JS | 17 KB | `STRATEGIC_MAP_DATA` — вынести в `data/strategic-map.json` |
| 🟡 P2 | `articles/20-antisovetov-pastoru/index.html` | inline CSS | 12.5 KB | 16 дублей site.css удалены r43 (−2.5KB); оставшееся специфично для страницы |
| 🟠 P1 | `articles/20-antisovetov-pastoru/index.html` | inline JS | 5.5 KB | Popover widget — вынести в `js/enhancements.js` |
| ~~🟠 P1~~ | ~~`articles/krajne-li-isporcheno-serdce/index.html`~~ | ~~inline JS 1.7KB~~ | **Закрыто r43** — перенесено в `site.js` модуль 15a |
| 🟡 P2 | `articles/krajne-li-isporcheno-serdce/index.html` | inline CSS | 885 b | `.rescue-figure` — вынести в site.css; убрать дубль `.article-img img { cursor:zoom-in }` |

Закрыто в r42: `nagornaya/chast-1..5` inline `<style>#read-progress</style>` → `nagornaya-mobile-toc.css`.

### 3.7 Работа с изображениями (КРИТИЧНО)

Все новые изображения должны быть приведены к стандартам производительности сайта:

1. **Формат:** WebP — основной формат фронтенда. PNG/JPG — backup в `images/<base-name>.png`, не для использования в `<img>` или `<picture>`.
2. **Размеры:** Обязательная генерация 3 вариантов ширины для `srcset`:
   - `600w` (мобильные)
   - `900w` (планшеты)
   - `1200w` (десктоп, ретина)
3. **Именование:** `images/<base-name>.webp`, `images/<base-name>-600w.webp`, и т.д.
4. **Конвертация:** Python (PIL/Pillow) или `cwebp`. Качество WebP: 82–85%.
5. **`<picture>` шаблон**:
   ```html
   <figure class="article-img wide reveal">
     <picture>
       <source srcset="../../images/<name>-600w.webp 600w, ../../images/<name>-900w.webp 900w, ../../images/<name>-1200w.webp 1200w"
               sizes="(max-width: 640px) 92vw, 1200px" type="image/webp">
       <img src="../../images/<name>.webp" alt="…" width="1200" height="630" loading="lazy" decoding="async">
     </picture>
     <figcaption>Подпись без упоминания ИИ.</figcaption>
   </figure>
   ```
6. **OG / Twitter картинки**: один `og:image` per page. JPG-fallback можно ставить ТОЛЬКО если файл `images/<name>.jpg` реально существует. Не плодить теги «на всякий случай».
7. **figcaption**: не вставлять `<span class="ai-note">` или «Изображение сгенерировано ИИ». Прозрачность — на странице `/about/`.

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

Сейчас (2026-06-02, после дедупа в commits A–H):
- `site.css`: ~191 (AGENTS-r46b: −38 more; лимит ≤200)
- `home.css`: 15
- `command-palette.css`: 4
- `mobile-hotfix.css`: 46 (по дизайну: переопределяет поведение для touch / pointer: coarse)
- `nagornaya-mobile-toc.css`: 3

В commits A–H удалено 55+ дублирующих rule-блоков (~10 КБ); удалены 5-кратные дубли `.premium-frame`, 8-кратные `button.bref`, 8-кратные `.mobile-controls .theme-toggle`. Если попадаются новые дубли — это регрессия.

Не добавлять новые `!important`, пока возможно через специфичность. Если уже есть `!important` на том же селекторе — **исправь существующий**, не добавляй второй.

### 4.3 Тёмная тема

Используется класс `html.dark` на `<html>` (переключается JS-ом в site.js). Все цвета — через CSS-переменные. **Не хардкодить** `#fff`, `#000` — использовать `var(--text)`, `var(--bg)`, `var(--accent)` и т.д.


### 4.4 CSS Integrity Rules — анти-регрессия для ИИ-агентов

Эти правила введены в AGENTS-r31 после глубокого аудита. Нарушение = мгновенный регресс.

1. **`html.dark` — всегда, никогда просто `.dark`**  
   JS выставляет `html.dark`. Класс `.dark` на body не используется → переменные не применятся.

2. **Дублирование блоков — запрещено**  
   Перед добавлением правила для `.foo` — сделай `grep ".foo"` по файлу. Найдено → расширяй, не добавляй новый блок.

3. **Пустые правила `{}` — мусор, удалять**  
   Допустимо только намеренное `:empty` с пояснительным комментарием.

4. **Двойное свойство в одном блоке — первое мёртво**  
   Два `box-shadow`, два `color` в одном `{}` — первый всегда перебивается. Удаляй его.

5. **`:hover` с важным эффектом — только внутри `@media (hover: hover) and (pointer: fine)`**  
   Без guard — эффект срабатывает на тапе (iOS, Android). Исключение: декоративные opacity/color которые не меняют layout.

6. **Переключатель темы — singleton, не трогать**  
   Архитектура: `gbFloatingControls` (JS-инжект, модуль 29) + `bar-icon-btn[data-action=theme]` (bottom-bar).  
   ❌ Не создавать `<button class="theme-toggle">` в HTML статей  
   ❌ Не создавать `.theme-float-btn` в новых CSS/JS-модулях  
   ❌ Не добавлять `nag-theme-btn` или аналоги — legacy скрыт через `body.gb-fc-active`

7. **Tooltip — три канонических вида**  
   `.gterm > .gtip` (глоссарий), `.fn-marker > .tooltip` (сноски), `.bref > .btip` (Библия).  
   ❌ Не добавлять четвёртый тип с другими классами/позиционированием.

8. **`!important` — только при реальном конкуренте**  
   Tailwind в `nagornaya/*` — законная причина. Просто "на всякий случай" — нет.  
   Проверь: какой селектор перебивает? Если ответа нет — уберизм `!important`.

9. **CSS-переменные — не объявлять "про запас"**  
   Объявленная в `:root` переменная без `var(--...)` нигде = мёртвый код.  
   Канонические токены: `--color-*`, `--z-*`, `--s-*`, `--shadow-*`, `--scroll-margin`.  
   Убитые в r34: `--fg`, `--link`, `--note-bg`, `--z-toc`, `--z-raised`, `--shadow-md`,  
   `--nicea-color`, `--keyboard-height`, `--color-violet/emerald/green/purple/sky/yellow`.  
   Живые aliases которые используются: `--accent`, `--bg`, `--border`, `--accent-soft`, `--accent-strong`.

10. **Дубль-кнопка темы — запрещено создавать третью точку переключения**

   Три канонических места переключения темы — и только три:
   - `.theme-toggle` (position: absolute) — выровнена по крошкам, в статьях
   - `.theme-float-btn` (position: fixed, FAB) — инжектируется `gbFloatingControls` (site.js модуль 29)
   - `.bar-icon-btn[data-action=theme]` — иконка в bottom-bar (mobile only)

   ❌ Не создавать `<button class="nag-theme-btn">`, `<button id="themeFloat">`, ни любую другую кнопку.
   ❌ Не создавать новую страницу или компонент со своим `onclick` для смены темы.
   JS: единственный handler `data-action=theme` в SiteUtils.initTheme() (site.js модуль 02).

11. **Tooltip-система — ровно три вида, ровно один контроллер**

   Три вида: `.gterm > .gtip` (глоссарий), `.fn-marker > .tooltip` (сноски), `.bref > .btip` (Библия).
   Контроллер: `SiteUtils.makeTooltipController()` — единственная реализация.
   `.tooltip-trigger` — конвертируется в `.gterm` через `initTooltipTriggers()` (site.js модуль 33).

   ❌ Не создавать новый тип tooltip с другими CSS-классами или другим позиционированием.
   ❌ Не добавлять inline `<script>` с логикой показа/скрытия подсказок.

12. **`!important` — лимит и лоцман** (r42+)

   Лимит: `site.css` ≤ 320 `!important`. Если после правки число выросло — это регрессия.
   Проверка: `grep -o '!important' css/site.css | wc -l`
   Легитимные категории: print-override, prefers-reduced-motion, forced-colors, Tailwind-override в nagornaya/*.
   Нелегитимные: перебивание своего же правила в том же файле без реального конкурента.

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
node --check js/*.js
node --check scripts/*.js
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

### 6.1 Обязательные runtime-компоненты новой статьи (2026-05-28)

1. **AI disclosure** не вставлять вручную: `site.js` автоматически добавляет `.ai-disclosure` для `page.type === 'article'`. Отключать только явно:
   ```js
   features: { aiDisclosure: { enabled: false } }
   ```
2. **Глоссарий**: сложные термины размечать как `.gterm` с вложенным `.gtip`. Категория определяется автоматически; при необходимости можно задать:
   ```html
   <span class="gterm" data-category="Богословие" data-category-slug="doctrine">термин<span class="gtip">...</span></span>
   ```
3. **Сноски** `.fn-marker` и глоссарий на мобильных открываются как bottom sheet. Не добавлять отдельные touch-хендлеры в HTML.
4. **Квиз**: для новых вопросов использовать `sourceRef` — строку, объект `{ label, href }` или массив. Это источник, который выводится в feedback при ошибке/ответе.
   ```js
   { q: '...', options: [...], answer: 1, ok: '...', err: '...', sourceRef: { label: 'Иер. 17:9', href: '#istoricheskiy-fon' } }
   ```
5. **Accuracy block email**: не хардкодить subject/body. `site.js` сам формирует тему и тело письма из `h1` и `location.href`. Email должен быть только `viktorcoy2012@gmail.com`.
6. **Sitemap**: `lastmod` только ISO8601 с московским `+03:00`, например `2026-05-26T00:00:00+03:00`.

7. **Share API**: для цитат/квизов использовать объектный payload, а не временную подмену DOM:
   ```js
   window.SiteShare.open(button, { dialogTitle: 'Поделиться цитатой', title, text, url });
   ```
8. **AI disclosure placement**: если `article` содержит собственный `header.article-header` или hero-figure, runtime вставляет `.ai-disclosure` после них — перед основным текстом. Не вставлять второй блок вручную.


После добавления статьи:
1. Обновить `sitemap.xml` (добавить URL)
2. Обновить `data/series.json` (если статья входит в серию)
3. Обновить `data/search-manifest.json` (для Ctrl+K поиска)
4. Запустить `npm run cache-bust`

---

## 7. ОБЯЗАТЕЛЬНЫЕ ПРОВЕРКИ

```bash
# 1. Синтаксис JS — все 11 файлов + sw.js + scripts
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

## 10. ЧТО ИЗ КОРНЯ РЕПО НИКОГДА НЕ КОММИТИТЬ

К 2026-06-02 из репо удалены и больше не должны появляться в корне:

| Файл / маска | Почему нельзя |
|---|---|
| `*.patch` | `.patch`-файлы — рабочие артефакты git, не контент. Не нужны на проде. |
| `*.py` в корне | Статический сайт без серверного Python. Все Python-скрипты — только в `scripts/` (build-tools). |
| `*.tsx`, `*.ts`, `src/components/` | Сайт собран как vanilla HTML+CSS+JS. TypeScript/React-компоненты — мёртвый код, не компилируется. |
| `README-<что-то>.txt`, `README.txt` | Дубли `README.md`. |
| `PATCH-V*-SUMMARY.md`, `AUDIT_REPORT_*.md`, `*_PLAN_*.md` | Истёкшие планы и отчёты. История сохраняется в git log и `AUDIT_HISTORY.md`. |
| `apply_*.py`, `fix_*.py`, `final_*.py`, `split_*.py` | Одноразовые костыли — следы прошлых неудачных правок. Если нужен скрипт — клади в `scripts/` и документируй в `package.json`. |

Если AI-агент создал такой файл в процессе работы — он обязан удалить его перед коммитом.

---

## 11. История этого документа

| Версия | Дата | Что |
|---|---|---|
| AGENTS-r1 | 2026-05-?? | Создан, только правила byline |
| AGENTS-r2 | 2026-05-17 | Расширен: вся архитектура, 9 JS, 4 CSS, защищённые блоки, чек-лист |
| AGENTS-r3 | 2026-05-22 | Удалены ссылки на docs/archive и patch-скрипты, обновлена архитектура |
| AGENTS-r4 | 2026-05-23 | Матрица браузеров §1.1, metrics §1.2, tw.min.css §3.5, html.dark §4.3, хеши §3.4 |
| AGENTS-r5 | 2026-05-24 | Добавлены v27-v30: полное сжатие и исправление кнопок шрифтов A−/A+, удаление дублей CSS, финальная победа над легаси-токенами (0 / 0) |
| AGENTS-r6 | 2026-05-24 | v31: Исправлено агрессивное наследование шрифта в Нагорной серии, исправлен обход валидатора EXTRA_PAGES и предупреждение javascript:void(0) |
| AGENTS-r7 | 2026-05-24 | v32: Полный аудит кода, глубокий селекторный анализ, удаление 140+ строк мёртвого CSS (.epilogue-, .back-to-index), оптимизация веса стилей на 3 КБ |
| AGENTS-r8 | 2026-05-28 | Актуализированы 5 CSS / 11 JS, AI disclosure, glossary categories, mobile footnotes, quiz sourceRef, accuracy mailto |
| AGENTS-r9 | 2026-05-28 | Уточнены SiteShare object payload, AI disclosure placement, quiz sourceRef fallback по focus |
| AGENTS-r10 | 2026-05-30 | Биографии: восстановлена малая карточка `h-intro-card--biographies` на главной + добавлен раздел `biografii/` со страницей серии. Закрыт пакет JS-багов (SiteUtils merge, quizBonusResult показ, tooltip aria-expanded, visualViewport dedup, _searchGen guard, плюрализация). Актуализированы счётчики !important (§4.2), таблица CSS-файлов (§2), пояснение к ?v= хешам (§0/§3.4). |
| AGENTS-r11 | 2026-06-02 | Закрытие техдолга после crash-recovery предыдущего агента. Commits A–H: вырезан AI-disclosure JS-модуль; восстановлены 4 URL в sitemap (+ISO8601); добавлена серия `dzhon-gill` в `series.json`; превью справочника = bookshelf, не Гилл; статья «Исторический контекст» расширена с 790 до 2812 слов (6 → 10 разделов); удалены 55 дубликатов CSS (~10 КБ — `.premium-frame` 5x, `button.bref` 8x, `.mobile-controls .theme-toggle` 8x и др.); определены `.note-box`, `.context-links`, `.manuscript-quote`; добавлен JSON-LD в kontekst; Top-10 must-read с live-ссылками в справочник; унифицирована шапка статей Гилла (удалён чужеродный `<header class="site-header">`); заменена картинка Уайтфилда на исторически достоверную (фигура в чёрной рясе на сколоченной деревянной кафедре); задействованы все 5 остававшихся неиспользуемых изображений Гилла. Удалён мусор из корня (1.1 МБ: `gill-trilogy-split.patch` 941 КБ, `src/components/*.tsx` 135 КБ, ad-hoc Python скрипты, истёкшие `*_PLAN_*.md`). Новые правила: §0 пункты 8–10, §3.6 (известный техдолг), §3.7 расширен (`<picture>` шаблон, OG-правила, без AI-notes), §10 (что не коммитить в корень). |
| AGENTS-r12 | 2026-06-02 | Закрытие §3.6 техдолга (commit I): inline `<style>` из Part 1/2/3 вынесены в `css/site.css` (−36 КБ из HTML, +12.6 КБ в CSS — однократно кэшируется). Дополнительные оптимизации в том же коммите: единый `og:image` в каждой статье Гилла (убраны JPG-двойники, AGENTS §3.7 пункт 6); починены 3 битые ссылки на изображения (`gill-library-shelf.jpg`, `gill-transatlantic-map.png/.webp` сгенерированы из 900w); починена карточка справочника на `articles/index.html` (превью bookshelf вместо портрета); удалены 9 мёртвых файлов изображений (~4 МБ — 4× `og-dzhon-gill-1697-1771.*` после исправления ссылок, 5× `gill-library-interior.*` неиспользованные). CACHE_VERSION → gb-v167-biography-shared-css.|

---

> Этот файл — **«договор»** между владельцем и любым ИИ.
>
> Нарушение = регресс, который видят сотни читателей сайта. Если правило кажется глупым — спроси, **почему** оно появилось.

## AGENTS-r14 (2026-06-02)
- **CSS Audit**: Removed massive blocks of duplicated/broken selectors in `css/site.css` (lines 8500-8800) that were breaking `.theme-toggle` and tooltips.
- **Image Infrastructure**: 
  - Fixed circular reference: `gill-context-scroll` (Boy in Shop) $\to$ `gill-young-boy-shop` link; `gill-young-boy-shop` (Inkwell) $\to$ `gill-inkwell-macro` link.
  - Replaced hero image in Historical Context article with `gill-library-shelf`.
  - Corrected `width` and `height` attributes for 14+ images across the biography trilogy and context articles to match real aspect ratios.
- **Semantic Polish**:
  - Expanded explanation of *Nonconformist* vs *Dissenter* vs *Baptist* in the context article with English terminology.
  - Fixed "Баптист — диссентер" spacing.
  - Wrapped plural and adjective forms of key theological terms in `.gterm` for consistent tooltip support.
- **Stability**: Verified only one George Whitefield image remains (the correct one with spires).

---

## AGENTS-r17 (2026-06-02) — UNIFIED FLOATING CONTROLS + GLOSSARY CROSS-REFS + IMAGE FIXES

> **Контекст:** r16 закрыл glossary-дубликаты и legacy `#gterm-inline-tip`. Оставались три
> разрозненных артефакта плавающих кнопок (тема/поиск), битый «кружочек» вместо солнца на
> части страниц, и два неработающих превью в каталоге `/biografii/`. Прошлые два агента
> (r15/r16) упали на pool-таймауте до того как закрыть. Закрыто здесь.

### 1. Единый блок «тема + поиск» (Floating Controls)

**Новый модуль 29 в `js/site.js`** — `gb-floating-controls`. Один на всё. Заменяет:

| Что было | Где жило | Проблема |
|---|---|---|
| `<button class="theme-toggle">` в шапке статьи | `articles/*/index.html` (inline) | `position: absolute` — уезжал при скролле |
| `#themeFloat` / `.theme-float-btn` | js/site.js (бывший `theme-toggle-floating`) | FAB внизу справа, не на уровне крошек |
| `#gbSearchFloat` | js/site.js (бывший Floating Search Button) | Inline-styled, отдельно от темы |
| `.nag-sidebar-theme-btn` | `nagornaya/chast-*/index.html` (sidebar) | Свой стиль, свой SVG |

#### Правила Floating Controls (НЕ нарушать):
1. **Активация:** `body.gb-fc-active` ставится JS-ом, **если** на странице есть `.breadcrumb`
   **или** `body.nagornaya-page`. На главной/каталогах (index, articles/, biografii/,
   pastor-series/, nagornaya/seriya/, about/-если без хлебных крошек) — не активен:
   там переключатель темы уже встроен в `.mobile-controls` верхнего nav-bar.
2. **Структура:** `<div id="gbFloatingControls"> <button.gb-fc-theme> <button.gb-fc-search>`.
3. **Позиция:** `position: fixed`; `top: calc(clamp(24px, 3.5vw, 44px) - 10px)` (тот же
   уровень что у `.breadcrumb`); `right: max(8.5vw, env(safe-area-inset-right, 12px))`.
   Поиск ниже темы на `gap: 12px` (≈ 56 px центр-к-центру).
4. **Иконки:** канонические `SUN_SVG` / `MOON_SVG` / `SEARCH_SVG` инжектятся JS-ом
   из единых констант в модуле 29. **Никакой другой SVG для темы/поиска
   в HTML/CSS не должен использоваться** — это лечит баг «вместо солнышка кружочек»,
   когда в `articles/dzhon-gill-istoricheskiy-kontekst/` лежал `<circle r="5">`
   без лучей, и `articles/dzhon-gill-spravochnik/` вообще не имел иконки темы.
5. **Логика темы:** переключает `html.dark`, пишет `localStorage.theme`,
   диспатчит `theme:changed`. `MutationObserver` синхронизирует иконку с внешними
   переключениями (bottom-bar и т.п.).
6. **Логика поиска:** `GBSearch.open()` или `window.dispatchEvent(new CustomEvent('gb:openSearch'))`.
7. **Канонизация легаси-иконок:** видимые `.bottom-bar .theme-toggle` /
   `.mobile-controls .theme-toggle` автоматически получают канонический SVG через
   `canonizeLegacyIcons()` (фикс «кружочка» для bottom-bar).
8. **CSS-подавление legacy:** `body.gb-fc-active .theme-toggle, …` → `display: none`.
   Исключение: `.bottom-bar .theme-toggle, .mobile-controls .theme-toggle` остаются видимыми.
9. **⛔ Запрет:** новый агент **НЕ создаёт** отдельные плавающие кнопки темы/поиска
   в HTML или в новых JS-модулях. Только этот единый модуль.

### 2. Glossary cross-ref clicks (новый модуль 30 в `js/site.js`)

В `/data/glossary.json` определения могут содержать ссылки вида
`<a class="gterm" href="#" data-term="экзегеза">…</a>` (cross-ref на другой термин).
До r17 эти ссылки попадали в DOM-у тултипа, но клик по ним не делал ничего полезного.

Теперь делегированный handler:
- Перехватывает клик по `.gtip a.gterm[data-term]` / `.gtip-luxury__body a.gterm[data-term]`.
- Находит на странице первый «настоящий» `.gterm[data-term="<term>"]` (вне любого `.gtip`).
- Скроллит к нему и эмулирует клик → открывается тултип целевого термина.
- Если такого термина на странице нет — клик глушится (preventDefault), без `[object Object]`.

### 3. Glossary унификация (актуальное состояние, r16+r17)

- `js/glossary.js` работает на **любой** странице, где есть `<article>` или
  `<main[data-pagefind-body]>` — НЕ только на `pageType === 'article'`.
- `getDefinitionText()` корректно достаёт строку из `dict[k].definition.definition`
  (двухуровневый legacy-формат glossary.json).
- alias→canonical map: жадный матч по длинным алиасам первыми, Unicode-граница `\p{L}`.
- Никаких больше отдельных `#gterm-inline-tip`. Только `makeTooltipController('.gterm','.gtip', …)`
  через `SiteUtils.initGlossaryTooltips(root)` в module 20b.
- TreeWalker отвергает содержимое `.gtip` / `.gtip-luxury` (не плодим рекурсивные тултипы).

### 4. Превью в каталоге `/biografii/`

| Карточка | Было | Стало |
|---|---|---|
| «Джон Гилл: справочник» | `og-dzhon-gill-1697-1771-600w.webp` (файла нет → битая ссылка) | `gill-nine-volumes-600w.webp` + `gill-nine-volumes-900w.webp` (стопка 9 томов *Body of Divinity*) |
| «Часть I: Человек» (×2 — featured + full list) | `og-dzhon-gill-chast-1-chelovek.jpg` (пейзаж Саутварка — не Гилл) | `dzhon-gill-portret.jpg` + `dzhon-gill-portret.webp` + `dzhon-gill-portret-360w.webp` (аутентичный портрет Гилла за рабочим столом с пером и книгой) |

### 5. Правила, обязательные для будущих агентов

1. **Единая функция вместо per-page стилей.** Если требуется одинаковое поведение
   на >1 странице — это `js/site.js` модуль + правило в `css/site.css`, **не** копипаста
   inline-стилей и не отдельный файл `js/<feature>.js`.
2. **Глоссарий — для всего сайта.** Условие «`pageType === 'article'`» больше
   нигде не должно фильтровать инициализацию глоссария.
3. **Тултипы.** Единственная точка входа — `SiteUtils.makeTooltipController(anchor, tip, opts)`.
   `.bref/.btip` (Bible refs), `.fn-marker/.tooltip` (footnotes), `.gterm/.gtip` (glossary) —
   три типа, один контроллер. Нельзя создавать индивидуальные обработчики
   для конкретной серии или конкретной статьи.
4. **Иконки темы и поиска** — только канонические SVG из модуля 29 `js/site.js`.
   Не редактировать встроенный `<svg>` в HTML — он скрыт CSS-ом и не используется.
5. **Превью изображения** в каталогах: `<picture>` с двумя `srcset` (600w+900w)
   или `360w + base`. `loading="lazy"` (или `eager` для первой карточки above-the-fold),
   `decoding="async"`, явные `width`/`height` — см. §3.7.

---

## 11. История этого документа (продолжение)

| Версия | Дата | Что |
|---|---|---|
| AGENTS-r13 | 2026-06-02 | (резерв, не использовался) |
| AGENTS-r14 | 2026-06-02 | CSS audit (8500-8800), image infrastructure fixes, semantic polish |
| AGENTS-r15.x | 2026-06-02 | Glossary professional logic (canonical keys + aliases), tooltip cleanup, Part I image fix, Whitefield reset, head rendering & recursive tooltips fix |
| AGENTS-r16 | 2026-06-02 | Унификация тултипов и глоссария для всего сайта: убран `#gterm-inline-tip`, glossary.js работает на любой странице с `<article>`, исправлено извлечение definition.definition |
| AGENTS-r17 | 2026-06-02 | **UNIFIED FLOATING CONTROLS** (модуль 29 в site.js): единый sticky-блок «тема + поиск» на уровне breadcrumb, заменяет три разрозненных артефакта (.theme-toggle / #themeFloat / #gbSearchFloat / .nag-sidebar-theme-btn). Канонические SVG sun/moon/search — фикс «вместо солнышка кружочек» на dzhon-gill-istoricheskiy-kontekst и dzhon-gill-spravochnik. **Glossary cross-ref clicks** (модуль 30): клик по `<a class="gterm">` внутри тултипа переключает на тултип целевого термина. **Превью** в `/biografii/`: справочник → gill-nine-volumes (был битый og-dzhon-gill-1697-1771), Часть I → dzhon-gill-portret.jpg (был пейзаж Саутварка). |
| AGENTS-r17.1 | 2026-06-02 | **7 новых ассетов от редактора** в `images/` (полный набор `.jpg/.png + .webp + -600w + -900w + -1200w` для каждого): `gill-five-volumes-shelf` (5 томов Гилла на полке), `gill-clarendon-code-acts` (свитки Corporation/Uniformity/Conventicle/Five Mile Acts), `gill-engraving-talmud-study` (ч/б гравюра Гилла за Талмудом), `gill-portret-full-study` (расширенный 16:9 портрет Гилла за столом — дополняет, не заменяет, существующий `dzhon-gill-portret`), `gill-bunhill-defoe-plaque` (фото мемор. таблички в Bunhill — дополняет существующую гравюру `gill-bunhill-fields` с похоронной процессией), `gill-hebrew-scroll-yad` (свиток с серебряной указкой). Для `gill-baptism-scene` добавлены недостающие base `.jpg` / `.webp` / `-1200w.webp` (раньше серия была неполной — только 600w + 900w). Существующие ассеты не перезаписаны (проверено визуально). |
| AGENTS-r18 | 2026-06-02 | **Чистка мусора + превью Части I + SEO-фикс.** Удалены неиспользуемые ассеты: `gill-bunhill-defoe-plaque*` (это мемор. табличка Defoe, не Gill — не относится к теме), `gill-inkwell-macro*` (визуальный дубликат `gill-five-volumes-shelf` под путаным slug'ом, нигде не используется), `acts-of-suppression.png` (заменён `gill-clarendon-code-acts` в r17, остаток). Превью Части I в `/biografii/` (обе карточки) переведено `dzhon-gill-portret.jpg` (portrait-кроп) → `gill-portret-full-study` (16:9 landscape, корректно ложится в thumb 160×108). SEO-фикс: в JSON-LD `@graph` страницы `dzhon-gill-istoricheskiy-kontekst` добавлен отсутствовавший узел `WebSite #website` (устранена единственная hard-ошибка seo-audit). `whitefield-field` НЕ удалён (оставлен как master-резерв; визуально близок к используемому `whitefield-preaching`). |
| AGENTS-r32 | 2026-06-02 | **Byline «Автор-редактор» + SEO.** Обновлено правило §3.1: для авторских статей (Тип A/B) byline теперь «Автор-редактор: Фёдор Милованов» (он создаёт материалы + редактирует). Переводы (Тип C) без изменений — «Редакция перевода». `about/index.html`: обновлён `article-desc`, `og:description`, JSON-LD Person добавлены `jobTitle`, `description`, `knowsAbout`, YouTube в `sameAs`. Создан `llms.txt` для AI Search (Perplexity, ChatGPT, Claude, Grok). |
| AGENTS-r33 | 2026-06-02 | **CSS bug fixes + dark mode + чистка.** `biography-epigraph::before`: удалён двойной `content: none !important` (был ×2 перед реальным `content: '"'`). z-index токенизированы: `.gb-floating-controls` 9998→`var(--z-toast-high)`, `.theme-float-btn` 90→`var(--z-raised-high)`. Dark mode fix в `20-antisovetov`: 16 inline hex colors (`#d97706/2b6cb0/e11d48`) → `var(--color-amber/blue/rose, fallback)`. Удалён `important_audit.txt` из корня (нарушал §10). |
| AGENTS-r34 | 2026-06-02 | **CSS-переменные аудит + dead var removal.** Глубокий анализ всех 121 объявленных CSS-переменных. Выявлены и удалены 21 мёртвая переменная (39 строк, из `:root` и `html.dark`): legacy aliases `--fg/fg-secondary/text-primary/text-secondary/text-muted/link/note-bg/quote-bg/success-bg/surface-2`, устаревшие z-index `--z-raised/z-toc`, `--shadow-md`, `--nicea-color`, `--keyboard-height`, неиспользуемые Tailwind-токены `--color-violet/emerald/green/purple/sky/yellow`. Объяснение: переменные "про запас" в `:root` = мёртвый код → в §4.4 добавлено правило 9. |
| AGENTS-r44b | 2026-06-03 | **CSS fn-marker unification + hover guards.** Merged .fn-marker base+AUDIT§2 blocks (−8 !important); collapsed :focus+:focus-visible → :focus-visible; added @media(hover:hover) guard to .fn-marker:hover transform; removed !important from .fn-marker.fn-trans. |
| AGENTS-r44c | 2026-06-03 | **JS passive listeners.** site.js: scroll 4→13 passive (+8); touch all correct. Fixed double passive artefact. |
| AGENTS-r44d | 2026-06-03 | **CSS !important deep cleanup (301→257, −44).** Removed §9 SCROLL-LOCK duplicate (in mobile-hotfix.css); §8 phrases −6; §5 gb-accuracy −1; h-hero-title hover transforms −14 (guarded @media); display:none on unused classes −7. site.css: 258KB → 244KB (−5.3%). |
| AGENTS-r44e | 2026-06-03 | **JS passive listeners all files + SEO.** scroll-perf/enhancements/bookmark-engine/nagornaya-toc: +passive. sitemap.xml: lastmod →2026-06-03 (28 URLs). manifest.json: +shortcuts, +categories. sw.js: CACHE_VERSION bumped. |
| AGENTS-r46 | 2026-06-03 | **MAP_DATA data island + CSS dead code.** 20-antisovetov: STRATEGIC_MAP_DATA (17KB) → `data/strategic-map-antisovetov.json` as `<script type="application/json">` data island; popover reads via JSON.parse. CSS: §1 drop-cap guard removed (−392b), hebrew font rules, nagornaya pill, canonTimeline @media, biography-portrait, fn-dove-icon hover guard, gtip-luxury__category, .biography-info. !important 229→198 (−31). |
| AGENTS-r46b | 2026-06-03 | **SiteUtils.ready() + final !important cleanup.** js/site.js: added SiteUtils.ready(fn) helper; replaced 6 readyState patterns (−709b). CSS site.css: §5 gb-accuracy colors −4, §7 spacing margins −3, §16 reduced-motion preserved. !important 198→191. TOTAL site.css reduction from r41: 258,110→242,620b (−15,490b, −6%), !important ~480→319 total CSS (−161). |
| AGENTS-r45a | 2026-06-03 | **CSS !important 257→229 (−28).** Removed unnecessary !important: body.topnav-active, #selection-share-popup in @media 440px, .bookmark-toast-close padding, -webkit-appearance in @layer utilities, .article-img--portrait-wide, 7× @media 600px mobile margins, .kbd-hint-toast, #back-to-top svg, .bref:hover. |
| AGENTS-r45b | 2026-06-03 | **JS critical bug fixes + CSS refactor.** CRITICAL: Fixed 11 broken scroll listeners `function (, {passive})` introduced by r44c automation (across site.js, scroll-perf.js, bookmark-engine.js, nagornaya-mobile-toc.js). Refactored 4 direct clipboard.writeText() → SiteUtils.copyText() (−1.6KB). Removed dead CSS: 5 classes, 5 @media print blocks → 1, 3 @media pointer:coarse blocks → 1, duplicate property declarations (color-mix fallback pattern). nagornaya-mobile-toc.css: 59→31 !important (−28, removed unscoped .nag-summary__* blocks). |
| AGENTS-r44 | 2026-06-03 | **Big Deep Upgrade.** A: Dead CSS −6.4KB (26 мёртвых классов: `.ai-disclosure`, `.fn-sheet`, `.faq-item` ×6, `.ancient-epigraph`, `.card-cover-wrap` и др.); дубль `@keyframes fx-breathe` удалён; CSS структура валидирована (0 orphan braces). B: `:root` blocks 9→2 (consolidated into `@layer base`); `--color-amber/blue/rose/red`, `--f-hebrew-display`, `color-scheme`, `--visual-viewport-h`, `--article-font-size` теперь в canonical `:root`. C: `nagornaya-mobile-toc.css` !important 73→59 (R21 guardrail block + nag-quiz-h2). D: `site.js` mod29: `aria-live` announcer при смене темы; `enhancements.js`: `prefers-reduced-motion` guard для Ambient Scripture. E: `feed.xml` lastBuildDate обновлён. F: SW cache version bumped. Итого: site.css −12.6KB (−4.9%), 258KB→245KB. |
| AGENTS-r43b | 2026-06-02 | **Home page inline dedup + skip-link.** `index.html`: убраны Reading Progress/Navbar/ScrollTop/Reveal (−9882b дублей site.js mod35); Hebrew tap-toggle (2630b) + Ambient Scripture (5177b) → `js/enhancements.js`; добавлен `<script src=js/enhancements.js>`. `404.html`, `pastor-series/`, `about/`: удалён inline `<style>.skip-link</style>` (−848b) — уже в site.css. Итого r43b: −10730b inline. |
| AGENTS-r43c | 2026-06-02 | **Micro inline dedup.** `articles/krajne-li-isporcheno-serdce`: убраны `.article-img img { cursor:zoom-in }` и `.fn-marker { position:relative }` (−148b) — оба в site.css; оставлены `.rescue-figure/.rescue-caption--above` (737b, page-specific). |
| AGENTS-r43 | 2026-06-02 | **Inline JS/CSS dedup — модули 15a + 20 aria.** `js/site.js`: модуль 15a (heart-flip mobile `--back-height` handler, idempotent, все страницы); модуль 20: добавлены `aria-label/role/tabindex` на `.fn-marker`. `articles/krajne-li-isporcheno-serdce`: удалены 2 inline `<script>` (heart-flip 1680b + fn-marker 384b = 2064b). `articles/20-antisovetov-pastoru`: удалены 16 дублей CSS из site.css (−2558b), исправлены `.dark` → `html.dark` (×2). Итого r43: −4622b inline кода. |
| AGENTS-r42 | 2026-06-02 | **CSS anti-regression hardening + !important cleanup.** `css/site.css`: исправлен баг `.dark .quiz-launch-label` → `html.dark .quiz-launch-label` (правило никогда не срабатывало); удалён дублирующий `border-left` в `blockquote` (оставлен только `border-inline-start` — логическое свойство, поддержка Chrome 89+/FF61+/Safari 12.1+); слиты два идентичных псевдоэлемента `.summary-card__check:empty::after` и `:not(:has(svg))::after` в один `:not(:has(svg))`; удалён первый дублирующий блок `.btoc-banner-grad/.btoc-banner-title` (был placeholder с комментарием «canonical below»); убраны 34 лишних `!important` из `.summary-card__item` (×5), `.summary-card__check` (×10), `.summary-card__check svg` (×6), `.summary-card__text strong` (×4), `.btoc-progress-fill-done` (×2), dark variants. Итого: 342 → 301 `!important`. AGENTS.md: обновлён §4.2 (счётчик 313→308); добавлены правила 10–12 в §4.4 (дубль-кнопка темы, дубль-tooltip-система, лимит !important ≤320). `nagornaya/chast-1..5`: удалён inline `<style>#read-progress</style>` (302b × 5) → `nagornaya-mobile-toc.css` (body.nagornaya-page scoped). Tech debt r43: зафиксирован §3.6 (P0: 76KB JSON в hermenevtika; P1: 20-antisovetov widgets). |
| AGENTS-r31 | 2026-06-02 | **CSS/JS глубокий аудит.** `css/site.css`: исправлено 4 P0-бага (`.dark`→`html.dark`, дубль `html.dark .heart-flip-back`, двойной `box-shadow` в `.tooltip`, незащищённый `.h-hero-title:hover` на touch); удалено 12 дублирующихся блоков (`.btoc-banner` x2, `.bar-icon-btn` x3, `.fn-marker` x2, и др.); удалено 3 пустых правила; убраны 42 лишних `!important` (summary-card, touch targets); удалён мёртвый CSS: `.gill-fact-card`, `.btip-tabs`, `.antisovet-label`, `.btip-pane`/`.btip-tab`. `css/nagornaya-mobile-toc.css`: удалены мёртвые `.nag-theme-btn` x4, `.nag-icon-*`, унифицирован `.nag-quiz-h2` dark (был `.dark` вместо `html.dark`); итого −39 строк. Добавлен §4.4 "CSS Integrity Rules" — 8 конкретных правил для предотвращения регрессий. |
| AGENTS-r19–r28 | 2026-06-02 | **Аудит и стабилизация:** Фиксы суммари Нагорной проповеди, доработка минималистичного поиска, закрытие битых span-тегов в байлайнах и каталогах. Унификация тултипов, очистка dangling CSS-селекторов, устранение протечки глоссария в заголовки. Добавлены и разведены баптистские термины в глоссарии, устранены наложения категорий. Полное приведение репозитория в соответствие правилам AGENTS.md (исправлены дубликаты `og:image`, ASCII-кавычки в статьях). |
