# Повторная проверка исправления `W106` / `W106b` на PR #2352 (`74f71d9cb9b5f63785d47392133b6c056728756e`)

Сборка `74f71d9cb9b5f63785d47392133b6c056728756e` (`ab401a1c fix(reader-w106): preserve reading position across nested modal locks` + `74f71d9c fix(reader-w106b): sync ReaderState precache asset revision`) выполнена в `/tmp/head-74f7-build` (Node `v22.23.4`).

- **Прогон [`research/reader-w57-audit/analytics/gill-panel-resize-state-repro.mjs`](../../research/reader-w57-audit/analytics/gill-panel-resize-state-repro.mjs):** код выхода **`0` (`PASS: all 4 cases preserved section and resume destination`)**:
  - `toc-control` (`844 → 844`): `44%` / `#sec-pneumatology` → `Продолжить` → `#sec-pneumatology` (`43%`) — **PASS**.
  - `settings-control` (`844 → 844`): `44%` / `#sec-pneumatology` → `Продолжить` → `#sec-pneumatology` (`43%`) — **PASS**.
  - `toc-resize` (`844 → 720`): `44%` / `#sec-pneumatology` → сохранено `44%` / `#sec-pneumatology` → `Продолжить` → `#sec-pneumatology` (`43%`) — **PASS**.
  - `settings-resize` (`844 → 720`): `44%` / `#sec-pneumatology` → сохранено `44%` / `#sec-pneumatology` → `Продолжить` → `#sec-pneumatology` (`43%`) — **PASS**.
- **Смежные сценарии (`74f71d9c`):**
  - `/articles/kod-da-vinchi/` (`#hmSectionBtn` и `#hmSettingsBtn`, ресайз `844 → 720 px`): `45%` / `#canon-timeline-title` сохраняются без искажения (`pass: true`).
  - Модалка «Моя библиотека» (`#gb-hl-panel`) на Gill II (`844 → 720 px`): `44%` / `#sec-pneumatology` сохраняются (`pass: true`).

[Лог прогона](r10-resize-verify.jsonl).

## Раунд 11: Главная «Продолжить чтение», `/app/`, `/izbrannoe/`, `/rodosloviye/`, `/map/` (`74f71d9c`)

- **Главная `/` («Продолжить чтение», `320×568` и `1440×900`):** после чтения Gill II до `44%` карточка на `/` отображается чисто (`docOv: 0`) и по клику `#resumeReadingLink` переносит точно к сохранённому разделу (`#sec-pneumatology`, `43%`).
- **`/izbrannoe/` (`320×568`):** шапка `hdrH: 58 px` обрезается на второй строке кнопок (`bottom: 90 px`, иконки пересекают разделитель шапки), а карточка `«Код да Винчи»` в списке избранного рендерится с пустой градиентной плашкой вместо превью.
- **`/app/` (`320×568`):** сохраняется горизонтальный сдвиг `docOv: 7 px` (блок шагов вплотную к правому краю).
- **`/map/` (`320×568`):** ссылки и подписи частей III и IV серии о Джоне Гилле по-прежнему перепутаны (`dzhon-gill-chast-4-ekzeget/` подписана как «Часть III: Экзегет», а `dzhon-gill-chast-3-nasledie/` — как «Часть IV: Наследие»).
- **`/rodosloviye/` (`320×568`):** без переполнений (`docOv: 0`), интерактивные фильтры и узлы реагируют корректно.

[Коллаж проверок](r11-findings.jpg) · [лог](r11-sitewide.jsonl).
