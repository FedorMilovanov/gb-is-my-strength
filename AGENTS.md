# AGENTS.md — инструкции для Kilo / AI-ассистентов

Этот файл читается Kilo автоматически при старте сессии в этом репозитории.

## Про проект

- **Название:** Господь Бог — Сила Моя
- **Тип:** статический сайт на GitHub Pages
- **URL:** https://gospod-bog.ru/
- **Стек:** чистый HTML + CSS + JS, без сборщиков
- **Деплой:** автоматический — push в `main` → GitHub Pages обновляется через ~1 минуту

## Структура

```
/
├── index.html          # главная (список публикаций)
├── 404.html
├── articles/           # статьи (по папке на каждую)
│   ├── kod-da-vinchi/index.html
│   ├── krajne-li-isporcheno-serdce/index.html
│   └── hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/index.html
├── css/site.css        # единый CSS всего сайта (~4500 строк, размечен по секциям)
├── js/site.js          # единый JS всего сайта
├── js/bookmark-engine.js
├── images/, assets/    # медиа
├── feed.xml, sitemap.xml, robots.txt
```

Оглавление секций CSS находится в шапке `css/site.css` (строки 1–44).

---

## Правила работы

### Коммиты
- Использовать **Conventional Commits**: `fix:`, `feat:`, `style:`, `refactor:`, `docs:`, `chore:`
- Одна логическая правка = один коммит
- Сообщения по-русски или по-английски (единообразно в рамках коммита)
- НЕ использовать "Add files via upload" — только через `git push`

### Правки JS

- Основной файл — `js/site.js`. Модули пронумерованы, каждый в своём IIFE.
- **ОБЯЗАТЕЛЬНО после любой правки `js/site.js` перед коммитом:**
  ```
  node --check js/site.js
  ```
  Если команда выводит ошибку — исправить до коммита. Синтаксическая ошибка в `site.js` убивает **все** JS-модули на сайте разом (TOC, тема, изображения, tooltips и т.д.).
- Не дублировать тела обработчиков — при редактировании проверять, что старый блок удалён полностью.

### Правки CSS
- Основной файл — `css/site.css`. Файл `css/site.css.bak` — резервная копия, не трогать и не коммитить (в `.gitignore`)
- Ориентироваться по секциям из шапки файла
- Все изменения должны учитывать и светлую, и тёмную тему (`html.dark { ... }`)

### Git
- Ветка по умолчанию — `main`
- Работать напрямую в `main` для мелких правок (CSS, тексты)
- Для крупных фич — создавать ветку `feature/...` и PR
- Перед началом работы: `git pull`
- После правок: `git add . && git commit -m "..." && git push`

### Что НЕ трогать без явного разрешения
- `sitemap.xml`, `feed.xml`, `robots.txt` — SEO-инфраструктура
- `google*.html`, `yandex*.html` — верификация поисковиков
- Разметка JSON-LD в `<head>` — структурированные данные
- Счётчик Yandex.Metrika

---

## Универсальные элементы (правим на ВЕСЬ сайт сразу)

У сайта есть общие «кросс-страничные» UI-элементы. Если меняем их — меняем централизованно в `css/site.css` (и, если нужно, в `js/site.js`), проверяем во ВСЕХ статьях и на главной.

Актуальные статьи для проверки:
- `articles/kod-da-vinchi/index.html`
- `articles/krajne-li-isporcheno-serdce/index.html`
- `articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/index.html`
- плюс `index.html` (главная)

| Элемент | Где в CSS | Правила |
|---|---|---|
| **Хлебные крошки** (`.breadcrumb`) | секция 06 | Без SVG-домика — только текст «Главная». Длинный заголовок — переносится на следующую строку (`white-space: normal`), НЕ обрезается эллипсисом. Подчёркивание hover анимированное. |
| **Тема день/ночь** (`.theme-toggle`) | секция theme + `:root`/`html.dark` | **СВЕТЛАЯ ТЕМА ПО УМОЛЧАНИЮ.** Логика: если `localStorage === 'dark'` — тёмная; иначе — светлая. Кнопка `#themeToggle` расположена в `site.css` через `.theme-toggle { top: calc(clamp(48px,6.5vw,100px) - 13px); }` — **НЕ ДОБАВЛЯТЬ inline `style="top:..."` на кнопку в HTML**, это сломает выравнивание по хлебным крошкам. |
| **TOC sidebar** (`.toc-link`) | секция 15 | Rail без точек. Активный пункт — утолщённый `border-left` цвета `--accent`. H3 — `padding-left: 28px`. |
| **TOC bottom sheet** (`.btoc-nav`) | секция 17 | Тот же Rail-язык. Генерится в `js/site.js`. |
| **Drop-cap первый абзац** (`.drop-cap`) | секция 30 | Автоматически навешивается в `js/site.js` на первый `<p>` в каждой статье. Если класс уже есть в HTML — JS пропускает. |
| **Article End Block** (`.article-end-block`) | секция 38 | Инжектируется JS (модуль 27) автоматически во все статьи. **НЕ добавлять вручную в HTML.** Не добавлять `<div class="share-block">`, `<div class="print-btn-wrap">` или инлайн-блоки SDG/крест в HTML статей — всё это мёртвый код. |
| **Progress bar** (`#reading-progress`) | секция 18 | 2px, цвет `--accent`. |
| **Image viewer** (`.img-viewer`) | секция image viewer | `js/site.js` — универсальный, работает через `.article-figure img`. **НЕ создавать отдельный inline lightbox в HTML статей** — это мёртвый код. |

### Чеклист при правке универсального элемента
1. Изменил в `css/site.css` — проверил в **каждой** статье из списка выше + на главной.
2. HTML-разметка одинакова во всех статьях? Если в новой статье будет отличаться — это баг.
3. Проверил **обе темы** (light + `html.dark`).
4. Проверил мобильный брейкпоинт (≤ 560 px) и планшетный (≤ 820 px).
5. Если добавил новое взаимодействие — обновил `js/site.js` одним общим обработчиком.
6. После правки `js/site.js` — запустил `node --check js/site.js`.

---

## Паттерн новой статьи — Article End Block

Блок «Поделиться / Распечатать + SDG + крест» **инжектируется автоматически** модулем 27 (`js/site.js`) на всех страницах с `page.type === 'article'`.

### Что НЕ нужно добавлять в HTML новой статьи:
```html
<!-- ❌ НЕ ДОБАВЛЯТЬ — это мёртвый код, JS удалит их: -->
<div class="share-block">...</div>
<div class="print-btn-wrap">...</div>
<div style="display:flex; flex-direction:column; ...">
  <span class="sdg">Soli Deo Gloria</span>
  <svg ...><!-- крест --></svg>
</div>
```

### Правильная структура конца `<article>` новой статьи:
```html
<article>
  <!-- ... основной текст ... -->

  <!-- ПОСЛЕДНИЙ параграф основного текста -->
  <p>...</p>

  <!-- ← сюда JS вставит .article-end-block автоматически -->

  <!-- Источники / литература (если есть) -->
  <div class="sources-block">...</div>
  <!-- или -->
  <section class="reading-list">...</section>
  <!-- или -->
  <p class="translation-note">...</p>

</article>
```

### Как работает инжектор (модуль 27):
1. Ищет первый из: `.sources-block`, `.reading-list`, `.translation-note`, `.article-footer`
2. Вставляет `.article-end-block` перед ним через `insertBefore`
3. Если ни один не найден — аппендит в конец `<article>`
4. Удаляет старые `.share-block`, `.print-btn-wrap` и инлайн-SDG блоки

---

## Архитектура квиза (эталон — КДВ)

Статья `kod-da-vinchi` является эталоном разметки квиза. Структура обязательна:

```html
<div class="quiz-wrapper" id="quizWrapper">
  <!-- Launch overlay: блюр + кнопка "Начать тест" -->
  <div class="quiz-overlay" id="quizOverlay">
    <button class="quiz-launch-hero" id="quizLaunch" type="button">
      <div class="quiz-launch-icon"><!-- SVG play --></div>
      <span class="quiz-launch-label">Начать тест</span>
      <span class="quiz-launch-hint">N вопросов · сразу узнаете счёт</span>
    </button>
  </div>
  <!-- Quiz content: скрыт до запуска -->
  <div id="quizMain" class="quiz-main--hidden">
    <div id="quizBody">...</div>
    <div class="quiz-result" id="quizResult" style="display:none">...</div>
    <div class="quiz-score" id="quizScore" style="display:none">...</div>
  </div><!-- /quizMain -->
</div>
```

**Правила:**
- `#quizResult` и `#quizNext` — `style="display:none"` по умолчанию в HTML.
- `qFocus` / `quizBonusFocus` — показывается **только при неправильном ответе**, не при рендере вопроса.
- `animateCountNum()` — для числового счёта в `#quizResultScore` (выводит «7», а не «Результат: 7 из 10»).
- `animateCount(el, target, total, duration)` — для legacy `#quizScoreBadge` (выводит «Результат: X из Y»).
- `passingMode` — мёртвое поле, **не добавлять** в конфиг квиза.
- `quizShare` — шарит результат со счётом через `SiteShare.open()` с подменой заголовка.
- `getScoreBucket(sc, total, scoresArr)` — массив `scoresArr` **должен быть отсортирован по убыванию `.min`**.

---

## Последние значимые коммиты (состояние на 2026-04-17)

| Хеш | Что |
|---|---|
| `9a67164` | fix: тема кнопка выровнена по хлебным крошкам, запрещён inline top |
| `a33733b` | feat: тёмная тема по умолчанию |
| `9842641` | fix: восстановлен quiz launch overlay (КДВ) |
| `d2ed9d0` | fix: хлебные крошки — полный заголовок без обрезки |
| `00c2ade` | feat: drop-cap автоматически на первом абзаце каждой статьи |
| `bcdd1b1` | fix(audit): Б1–Б12 из audit-report.md (animateCount, qFocus, heart-flip, share score, aria-live, lightbox удалён) |
| `2acf881` | feat(share): российские сервисы (TG, VK, OK, WhatsApp, Копировать) |
| `a91f379` | fix(P0): критический SyntaxError в site.js — убивал весь JS |

---

## Бэклог задач

Список известных багов и улучшений. Перед началом работы проверить, что задача не уже сделана.

### 🔴 P0 — Критические баги

- [ ] **#1 myth-bg в тёмной теме** — `--myth-bg: #1f1418` на фоне `#0e1116` даёт «розовый синяк». Заменить: `--myth-bg: #1c1714; --myth-border: #3d2e25; --fact-bg: #141a18; --fact-border: #25382e`.
- [ ] **#2 --muted контраст** — `#8b9099` на `#0e1116` = 5.2:1. Поднять до `#9ca3af` (6.8:1).
- [ ] **#3 Quiz: подсветка ответов** — `.quiz-option.wrong` использует `--myth-bg`. Добавить `--quiz-correct-bg/border`, `--quiz-wrong-bg/border`.

### 🟠 P1 — Важные недоработки

- [ ] **#5 Breadcrumb hover в тёмной теме** — `var(--accent)` сливается с `--text`. Сменить на `var(--accent-strong)`.
- [ ] **#6 TOC rail непрерывный** — рельс прерывается между пунктами. Добавить `border-left: 1px solid var(--border)` на nav, ссылки `margin-left: -1px`.
- [ ] **#7 Sticky header без blur** — при скролле шапка прозрачная. Добавить `.scrolled` + `backdrop-filter: blur(12px)`.
- [ ] **#8 Герменевтика без bottom-bar** — в двух статьях есть, в переводе Чау нет. Добавить.
- [ ] **#9 Сноски: два формата** — КДВ/Сердце используют `<sup><a href="#src1">`, Герменевтика — `<span class="fn-marker">`. Унифицировать.
- [ ] **#10 Share popup доступность** — нет `role="dialog"`, фокус-ловушки, `Esc` не закрывает.

### 🟡 P2 — Структурные улучшения

- [ ] **#13 Title Case в JS** — модуль применяет title case к русскому тексту. Отключить для `:lang(ru)`.
- [ ] **#16 Google Fonts без display=swap** — FOIT на медленном интернете. Добавить `&display=swap`.
- [ ] **#17 Время чтения** — хардкод в одной статье, JS в другой, отсутствует в третьей. Унифицировать.
- [ ] **#18 lang на английских терминах** — скринридер читает с русским произношением. Оборачивать `<i lang="en">`.

### 🟢 P3 — Полировка

- [ ] **#19 scroll-margin-top на якорях** — ✅ закрыт: `--scroll-margin: 96px` в `:root`, `scroll-margin-top: var(--scroll-margin)` (коммит `b52bf88`).
- [ ] **#20 ::selection в тёмной теме** — стандартный синий диссонирует с янтарём.
- [ ] **#22 Опечатки в КДВ** — «Мертвого» → «Мёртвого», «Никейский Собор» → «Никейский собор».
- [ ] **#23 `:hover` без `@media (hover: hover)`** — ~60 hover-правил в `css/site.css` не обёрнуты в `@media (hover: hover) and (pointer: fine)`. На iOS/Android после тапа элемент «застревает» в hover-состоянии (меняется фон, цвет или поднимается transform) до следующего тапа в другое место. **Почему не делаем сейчас:** риск велик — 60 правил, большой рефакторинг, легко случайно сломать стили; залипание заметно только там, где есть сильная смена фона или `transform: translateY`. `touch-action: manipulation` (коммит `d13fa1e`) уже убрал 300ms delay. Делать отдельной задачей: пройти по всем `:hover` с `transform`, `background-color`, `color` и обернуть только их в `@media (hover: hover) and (pointer: fine)`. Остальные (`text-decoration`, `opacity`) — не трогать.
- [ ] **#24 Footer** — минимальный/отсутствует. Добавить единый footer.
