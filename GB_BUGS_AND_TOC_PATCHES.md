# GB — баги и финальный TOC-патч

Дата: 2026-05-11
Репозиторий: `FedorMilovanov/gb-is-my-strength`
Цель: добавить **нижнее мобильное TOC-меню** для независимых страниц `nagornaya/` и убрать CI-блокеры.

---

## 1. Важно: старые BAR-патчи удалены/неактуальны

Старые патчи про верхний navbar были ошибочным направлением и не должны применяться:

- `nagornaya-brand-nav-fix.*`
- `nagornaya-h-navbar-adapter.*`
- `gb-nagornaya-navbar-professional.*`

Правильный финальный патч:

- `gb-nagornaya-mobile-toc-final.patch`
- `gb-nagornaya-mobile-toc-final.zip`

---

## 2. Что делает финальный TOC-патч

Добавляет нижнее мобильное меню чтения и оглавления для страниц:

- `nagornaya/index.html`
- `nagornaya/chast-1/index.html`
- `nagornaya/chast-2/index.html`
- `nagornaya/chast-3/index.html`
- `nagornaya/chast-4/index.html`
- `nagornaya/chast-5/index.html`
- `nagornaya/istochniki/index.html`
- `nagornaya/nakhodki/index.html`

Не трогает `nagornaya/seriya/index.html`, потому что это отдельная страница с уже другим фирменным оформлением.

Новые файлы:

- `css/nagornaya-mobile-toc.css`
- `js/nagornaya-mobile-toc.js`

Логика:

- JS сам инжектит `bottom-bar` и `btoc-overlay`.
- TOC строится из `h2` внутри `[data-pagefind-body]`; если у заголовка нет `id`, JS назначает стабильный slug-id на лету.
- На мобильном появляется нижняя панель:
  - прогресс чтения;
  - текущий раздел;
  - кнопка открытия оглавления;
  - кнопка наверх;
  - переключение темы;
  - ссылка на главную;
  - поделиться.
- На десктопе панель скрыта через CSS.

---

## 3. Найденные баги и фиксы

### BUG-01 — `validate.js` падал: `NAGORNAYA is not defined`

Команда:

```bash
npm run validate
```

Ошибка:

```text
ReferenceError: NAGORNAYA is not defined
```

Фикс:

```js
const NAGORNAYA = path.resolve(__dirname, '../nagornaya');
```

Файл:

- `scripts/validate.js`

Критичность: высокая. Ломал CI.

---

### BUG-02 — `validate --strict` падал на `color-mix()` внутри `linear-gradient()`

Файл:

- `css/command-palette.css`

Проблема: валидатор запрещает `color-mix()` внутри `linear-gradient()`, а в CSS было 5 таких мест.

Фикс: заменены проблемные градиенты на безопасные переменные `--cp-accent-alpha-*` и градиенты без `color-mix()` внутри `linear-gradient()`.

Критичность: высокая. Ломал `validate --strict`.

---

### BUG-03 — `update-meta.js` считал `nagornaya` как `0 слов / 1 мин`

Причина: `countWords()` считал только `<article>`, а страницы `nagornaya` используют:

```html
<main data-pagefind-body>
```

Фикс: `countWords()` теперь считает по приоритету:

1. `<article>`
2. `<main/section data-pagefind-body>`
3. `<main>`

Файл:

- `scripts/update-meta.js`

Проверка после фикса:

```text
nagornaya/chast-1        3108 сл. → 16 мин
nagornaya/chast-2        2056 сл. → 10 мин
nagornaya/chast-3        2354 сл. → 12 мин
nagornaya/chast-4        6323 сл. → 32 мин
nagornaya/chast-5        4996 сл. → 25 мин
nagornaya/istochniki     1317 сл. → 7 мин
nagornaya/nakhodki        662 сл. → 3 мин
```

Критичность: высокая. Иначе auto-meta портил бы страницы после пуша.

---

### BUG-04 — новые TOC CSS/JS должны участвовать в cache-bust

Файл:

- `scripts/cache-bust.js`

Добавлены:

```js
'css/nagornaya-mobile-toc.css'
'js/nagornaya-mobile-toc.js'
```

Критичность: средняя/высокая. Иначе пользователи могли бы видеть старый интерфейс.

---

### BUG-05 — новые TOC CSS/JS должны быть в Service Worker precache

Файл:

- `sw.js`

Добавлены:

```js
'/css/nagornaya-mobile-toc.css'
'/js/nagornaya-mobile-toc.js'
```

Критичность: средняя.

---

## 4. Остались только предупреждения, не блокеры

После финального патча:

```bash
npm run validate -- --strict
```

Результат:

```text
Ошибок: 0
Предупреждений: 3
```

Предупреждения:

1. `css/command-palette.css` — нестандартный breakpoint `720px`.
2. `kod-da-vinchi` — BreadcrumbList не совпадает с `og:title`.
3. `krajne-li-isporcheno-serdce` — BreadcrumbList не совпадает с `og:title`.

Они не прерывают workflow.

---

## 5. Проверки финального патча

Проверено на чистом клоне текущего GitHub-репозитория:

```bash
git apply --check gb-nagornaya-mobile-toc-final.patch
git apply gb-nagornaya-mobile-toc-final.patch
node --check js/nagornaya-mobile-toc.js
node --check scripts/update-meta.js
node --check scripts/validate.js
node --check scripts/cache-bust.js
node --check sw.js
npm run validate -- --strict
npm run cache-bust -- --dry-run
npm run update-meta -- --dry-run --all
npx -y pagefind@1.5.2 --site . --output-path pagefind
```

Также проверены:

```text
BROKEN_INTERNAL_REFS 0
JSONLD_ERRORS 0
DUP_IDS 0
```

Pagefind собирается. Старое предупреждение про `google7e02f9855e02b89a.html` без `<html>` не связано с патчем — это верификационный файл.

---

## 6. Как применить

```bash
git apply gb-nagornaya-mobile-toc-final.patch
npm run validate -- --strict
npm run cache-bust
git status
git add .
git commit -m "feat: add mobile TOC to Nagornaya pages"
git push
```
