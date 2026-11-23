# Независимый аудит PR #2352 на коммите `7e2280ed` (раунд 18)

Проверено на чистой пересборке `7e2280ede63828f887fe649071e9df3d5b2907dc` (`/tmp/head-7e22-build`, `strangler:build` `BUILD_EXIT=0`) без правки продуктового кода.

## 1. Изменение `7e2280ed` и регрессия `W106`
- Коммит `7e2280ed` (`test(gill): align frontmatter listen contract`) обновляет только `scripts/reader-structured-content-browser-contract.mjs` (без изменений в `src/` и `public/`).
- Регрессия `W106` (`gill-panel-resize-state-repro.mjs`): `REPRO_EXIT=0` ([лог](r18-resize-repro.jsonl)).

## 2. Сквозной сценарий «Избранное» (`/izbrannoe/`) и шапка на `320×568`
- **Сохранение и удаление работают:** добавление через `.mobile-top-save` / `.gb-save` из трёх разных шаблонов (`/articles/dzhon-gill-chast-2-uchenyi/`, `/baptisty-rossii/vsehib-1944/`, `/articles/kod-da-vinchi/`) отображает `3 статьи` в `/izbrannoe/`, удаление кнопкой «Убрать из избранного» срабатывает, `#themeToggle` корректно переключает `html.dark` и `data-reader-theme="dark"`.
- **Проблемы вёрстки и медиа на `/izbrannoe/` (`320×568`):**
  1. Верхняя шапка (`hdrBottom: 58`) переносит 4 кнопки (`📱`, `🔖`, `🔍`, `🌙`) на вторую строку (`top: 46, bottom: 90`), разрезая их линией нижней границы шапки.
  2. Карточка «Код да Винчи» отрисовывается с пустой градиентной заглушкой вместо обложки (`imgs: []`), а у карточки «Баптисты России» отсутствует и превью, и рубрика над заголовком.

## 3. Сброс настроек чтения (`#gillSettingsReset`), поиск (`#gbCommandPalette`) и глоссарий на других шаблонах
- **`#gillSettingsReset` на `/articles/dzhon-gill-chast-2-uchenyi/` (`320×568`):** в текущей сборке сброс темы `dark → light` срабатывает **мгновенно без перезагрузки** (`liveAfterReset.theme === "light"`, сохраняется после reload).
- **Поиск `#gbCommandPalette` (`320×568`):** запрос `"Гилл"` даёт `7 рез.` по локальному индексу даже без Pagefind; пустой запрос `"абырвалг123"` показывает `0 рез. Ничего не найдено` с подсказками популярных запросов.
- **Тултипы глоссария вне серии Гилла (`390×844`):** на `/baptisty-rossii/vsehib-1944/`, `/articles/20-antisovetov-pastoru/` и `/nagornaya/chast-1/` всплывающие подсказки терминов открываются внутри границ вьюпорта.

![Сквозной аудит /izbrannoe/ на 7e2280ed](r18-findings.jpg)

[Сводка замеров](r18-checks.jsonl)
